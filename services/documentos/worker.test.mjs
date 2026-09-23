import test from "node:test";
import assert from "node:assert/strict";
import worker, { MAX_BYTES } from "./worker.mjs";

const ORIGIN = "https://laslabcritical.github.io";
const ENDPOINT = "https://uade-documentos.workers.dev";

class MemoryBucket {
  objects = new Map();
  async put(key, bytes, options) {
    const record = {
      key, bytes: bytes.slice(), size: bytes.byteLength,
      uploaded: new Date(), httpEtag: '"stored-file"', ...options
    };
    this.objects.set(key, record);
    return record;
  }
  async list() { return { objects: [...this.objects.values()], truncated: false }; }
  async get(key) {
    const record = this.objects.get(key);
    return record ? { ...record, body: new Response(record.bytes).body } : null;
  }
  async head(key) { return this.objects.get(key) || null; }
}

function environment() {
  return {
    DOCUMENTS: new MemoryBucket(),
    ALLOWED_ORIGINS: ORIGIN,
    UPLOADS_ENABLED: "true",
    TURNSTILE_SECRET_KEY: "secret-for-unit-tests",
    UPLOAD_LIMITER: { limit: async () => ({ success: true }) }
  };
}

function uploadRequest({ name = "Guía de investigación.pdf", category = "Bibliografía", body = "%PDF-1.7\ncontenido", size, origin = ORIGIN } = {}) {
  return new Request(`${ENDPOINT}/files`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(name),
      "X-File-Category": encodeURIComponent(category),
      "X-File-Size": String(size ?? new TextEncoder().encode(body).byteLength),
      "X-Turnstile-Token": "verified-token"
    },
    body
  });
}

function verify(t, result = {}) {
  return t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    return Response.json({ success: true, hostname: "laslabcritical.github.io", action: "upload", ...result });
  });
}

test("una carga anónima verificada se guarda, se lista y se descarga con el nombre acentuado", async (t) => {
  verify(t);
  const env = environment();
  const uploaded = await worker.fetch(uploadRequest(), env);
  assert.equal(uploaded.status, 201);
  const { file } = await uploaded.json();
  assert.equal(file.name, "Guía de investigación.pdf");
  const listed = await worker.fetch(new Request(`${ENDPOINT}/files`), env);
  assert.deepEqual((await listed.json()).files, [file]);
  const download = await worker.fetch(new Request(`${ENDPOINT}/files/${file.id}`), env);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "%PDF-1.7\ncontenido");
  assert.match(download.headers.get("Content-Disposition"), /Gu%C3%ADa/);
  assert.equal(download.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(download.headers.get("Content-Type"), "application/octet-stream");
  const deletion = await worker.fetch(new Request(`${ENDPOINT}/files/${file.id}`, { method: "DELETE" }), env);
  assert.equal(deletion.status, 405);
  assert.equal(env.DOCUMENTS.objects.size, 1);
});

test("el listado conserva el cursor aunque una página de R2 esté incompleta", async () => {
  const env = environment();
  env.DOCUMENTS.list = async (options) => {
    assert.equal(options.cursor, "previous");
    assert.ok(options.include.includes("customMetadata"));
    return { objects: [], truncated: true, cursor: "next" };
  };
  const response = await worker.fetch(new Request(`${ENDPOINT}/files?cursor=previous`), env);
  assert.deepEqual(await response.json(), { files: [], cursor: "next" });
});

test("sin configuración completa no habilita ni acepta cargas", async () => {
  const env = environment();
  delete env.TURNSTILE_SECRET_KEY;
  const state = await worker.fetch(new Request(`${ENDPOINT}/status`), env);
  assert.equal((await state.json()).uploadsEnabled, false);
  assert.equal((await worker.fetch(uploadRequest(), env)).status, 503);
  assert.equal(env.DOCUMENTS.objects.size, 0);
});

test("rechaza un origen ajeno sin devolver permisos CORS", async () => {
  const env = environment();
  const response = await worker.fetch(uploadRequest({ origin: "https://other.example" }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(env.DOCUMENTS.objects.size, 0);
});

test("valida tamaño, extensiones y rutas antes de consumir la verificación", async (t) => {
  const verifier = verify(t);
  const env = environment();
  for (const options of [
    { size: MAX_BYTES + 1 }, { size: 0 }, { name: "archivo.html" },
    { name: "../archivo.pdf" }, { category: "no existe" }
  ]) {
    const response = await worker.fetch(uploadRequest(options), env);
    assert.ok([400, 413].includes(response.status));
  }
  assert.equal(verifier.mock.callCount(), 0);
  assert.equal(env.DOCUMENTS.objects.size, 0);
});

test("no guarda un cuerpo más grande ni más corto que el declarado", async (t) => {
  verify(t);
  const env = environment();
  assert.equal((await worker.fetch(uploadRequest({ size: 2 }), env)).status, 413);
  assert.equal((await worker.fetch(uploadRequest({ size: 100 }), env)).status, 400);
  assert.equal(env.DOCUMENTS.objects.size, 0);
});

test("un token inválido, de otra acción o de otro dominio no permite cargar", async (t) => {
  for (const result of [{ success: false }, { hostname: "other.example" }, { action: "login" }]) {
    const verifier = verify(t, result);
    const env = environment();
    assert.equal((await worker.fetch(uploadRequest(), env)).status, 403);
    assert.equal(env.DOCUMENTS.objects.size, 0);
    verifier.mock.restore();
  }
});

test("el límite de frecuencia bloquea la carga antes de guardar", async (t) => {
  const verifier = verify(t);
  const env = environment();
  env.UPLOAD_LIMITER.limit = async () => ({ success: false });
  const response = await worker.fetch(uploadRequest(), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(verifier.mock.callCount(), 0);
  assert.equal(env.DOCUMENTS.objects.size, 0);
});

test("una falla del almacenamiento nunca devuelve confirmación de carga", async (t) => {
  verify(t);
  const env = environment();
  env.DOCUMENTS.put = async () => { throw new Error("storage unavailable"); };
  assert.equal((await worker.fetch(uploadRequest(), env)).status, 503);
});

test("las descargas ausentes dan 404 y el preflight autoriza solo al origen previsto", async () => {
  const env = environment();
  const missing = await worker.fetch(new Request(`${ENDPOINT}/files/${crypto.randomUUID()}`), env);
  assert.equal(missing.status, 404);
  const options = await worker.fetch(new Request(`${ENDPOINT}/files`, { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(options.headers.get("Access-Control-Allow-Headers"), /X-Turnstile-Token/);
});
