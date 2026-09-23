export const MAX_BYTES = 25_000_000;
const PREFIX = "files/";
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const EXTENSIONS = new Set("pdf doc docx xls xlsx ppt pptx odt ods odp jpg jpeg png webp gif zip txt csv mp3 mp4".split(" "));
const CATEGORIES = new Set(["Bibliografía", "Presentaciones", "Material de trabajo", "Otros"]);

class HTTPError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function origins(env) {
  return new Set((env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function uploadEnabled(env) {
  return env.UPLOADS_ENABLED === "true" && Boolean(env.DOCUMENTS && env.TURNSTILE_SECRET_KEY && env.UPLOAD_LIMITER);
}

function record(object) {
  return {
    id: object.key.slice(PREFIX.length),
    name: object.customMetadata?.name || "Documento",
    category: object.customMetadata?.category || "Otros",
    size: object.size,
    uploadedAt: object.uploaded.toISOString()
  };
}

function decodedHeader(request, name) {
  try { return decodeURIComponent(request.headers.get(name) || "").normalize("NFC"); }
  catch { throw new HTTPError(400, "Los datos del archivo no son válidos."); }
}

async function limitedBody(request, expected) {
  if (!request.body) throw new HTTPError(400, "El archivo está vacío.");
  const reader = request.body.getReader();
  const bytes = new Uint8Array(expected);
  let offset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expected) throw new HTTPError(413, "El tamaño del archivo supera el declarado.");
      bytes.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== expected) throw new HTTPError(400, "El archivo llegó incompleto. Intentá nuevamente.");
    return bytes;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}

async function verifyUpload(request, env, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rate = await env.UPLOAD_LIMITER.limit({ key: ip });
  if (!rate.success) throw new HTTPError(429, "Alcanzaste el límite de cargas. Esperá un minuto antes de continuar.");
  const token = request.headers.get("X-Turnstile-Token") || "";
  if (!token || token.length > 2048) throw new HTTPError(403, "Completá la verificación antes de subir el archivo.");
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body, signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new HTTPError(503, "La verificación no está disponible. Intentá nuevamente.");
  const verification = await response.json();
  if (!verification.success || verification.hostname !== new URL(origin).hostname || verification.action !== "upload") {
    throw new HTTPError(403, "La verificación venció o no es válida. Volvé a intentarlo.");
  }
}

async function upload(request, env, origin) {
  if (!origin) throw new HTTPError(403, "Abrí la página de documentos para subir un archivo.");
  if (!uploadEnabled(env)) throw new HTTPError(503, "La carga de archivos no está habilitada en este momento.");
  if (request.headers.get("Content-Type") !== "application/octet-stream") throw new HTTPError(415, "El formato de la solicitud no es válido.");
  const name = decodedHeader(request, "X-File-Name");
  const category = decodedHeader(request, "X-File-Category");
  const expected = Number(request.headers.get("X-File-Size"));
  if (!Number.isInteger(expected) || expected <= 0) throw new HTTPError(400, "El archivo está vacío o su tamaño no es válido.");
  if (expected > MAX_BYTES) throw new HTTPError(413, "El archivo supera el límite de 25 MB.");
  if (!name || name.length > 180 || /[\u0000-\u001f\u007f/\\]/.test(name) || name.startsWith(".") || !EXTENSIONS.has(name.split(".").pop().toLowerCase())) {
    throw new HTTPError(400, "El nombre o el formato del archivo no está permitido.");
  }
  if (!CATEGORIES.has(category)) throw new HTTPError(400, "Seleccioná una categoría válida.");
  await verifyUpload(request, env, origin);
  const bytes = await limitedBody(request, expected);
  const key = PREFIX + crypto.randomUUID();
  const object = await env.DOCUMENTS.put(key, bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { name, category }
  });
  if (!object) throw new HTTPError(503, "No se pudo guardar el archivo. Intentá nuevamente.");
  return json({ file: record(object) }, 201);
}

async function route(request, env, origin) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (!origin) throw new HTTPError(403, "Origen no permitido.");
    return new Response(null, { status: 204 });
  }
  if (url.pathname === "/status" && request.method === "GET") {
    return json({ uploadsEnabled: uploadEnabled(env), maxFileBytes: MAX_BYTES });
  }
  if (!env.DOCUMENTS) throw new HTTPError(503, "El servicio de documentos no está disponible.");
  if (url.pathname === "/files") {
    if (request.method === "POST") return upload(request, env, origin);
    if (request.method !== "GET") throw new HTTPError(405, "Operación no permitida.");
    const cursor = url.searchParams.get("cursor") || undefined;
    if (cursor && cursor.length > 2048) throw new HTTPError(400, "La página solicitada no es válida.");
    const listing = await env.DOCUMENTS.list({ prefix: PREFIX, limit: 200, cursor, include: ["customMetadata"] });
    const files = listing.objects.filter((object) => ID.test(object.key.slice(PREFIX.length))).map(record);
    return json({ files, cursor: listing.truncated ? listing.cursor : null });
  }
  const match = /^\/files\/([^/]+)$/.exec(url.pathname);
  if (!match || !ID.test(match[1])) throw new HTTPError(404, "El documento no existe.");
  if (!["GET", "HEAD"].includes(request.method)) throw new HTTPError(405, "Operación no permitida.");
  const key = PREFIX + match[1];
  const object = request.method === "HEAD" ? await env.DOCUMENTS.head(key) : await env.DOCUMENTS.get(key);
  if (!object) throw new HTTPError(404, "El documento ya no está disponible.");
  const name = object.customMetadata?.name || "documento";
  const safeName = name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 180);
  const encodedName = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(request.method === "HEAD" ? null : object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(object.size),
      "ETag": object.httpEtag,
      "Content-Security-Policy": "sandbox; default-src 'none'"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = origin && origins(env).has(origin);
    let response;
    try {
      if (origin && !allowed) throw new HTTPError(403, "Origen no permitido.");
      if (env.READ_LIMITER && request.method !== "OPTIONS") {
        const { success } = await env.READ_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
        if (!success) throw new HTTPError(429, "Hay demasiadas solicitudes. Intentá nuevamente en un minuto.");
      }
      response = await route(request, env, origin);
    } catch (error) {
      response = json({ error: error instanceof HTTPError ? error.message : "El servicio no pudo completar la operación. Intentá nuevamente." }, error instanceof HTTPError ? error.status : 503);
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("Vary", "Origin");
    if (response.status === 429) headers.set("Retry-After", "60");
    if (allowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, X-File-Name, X-File-Category, X-File-Size, X-Turnstile-Token");
      headers.set("Access-Control-Max-Age", "3600");
    }
    return new Response(response.body, { status: response.status, headers });
  }
};
