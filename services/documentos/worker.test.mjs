import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker, { MAX_BYTES } from './worker.mjs';
import { MAX_TOTAL_BYTES } from './github-store.mjs';

const ORIGIN = 'https://laslabcritical.github.io';
const ENDPOINT = 'https://uade-documentos.workers.dev';
const CATALOG = 'docs/documentos/catalogo.json';
const encoder = new TextEncoder();

class GitHub {
  blobs = new Map();
  trees = new Map();
  commits = new Map();
  counter = 100;
  blobWrites = 0;
  updates = 0;
  conflict;
  verification = { success: true, hostname: 'laslabcritical.github.io', action: 'upload' };
  constructor(bytes = 8000) {
    const catalog = this.blob(JSON.stringify({ files: [] }) + '\n');
    const tree = this.sha();
    this.trees.set(tree, [
      { path: 'docs/index.html', type: 'blob', sha: this.sha(), size: bytes },
      { path: CATALOG, type: 'blob', sha: catalog.sha, size: catalog.size }
    ]);
    this.head = this.sha();
    this.commits.set(this.head, { tree });
  }
  sha() { return (++this.counter).toString(16).padStart(40, '0'); }
  blob(content) {
    const bytes = typeof content === 'string' ? encoder.encode(content) : content;
    const sha = createHash('sha1').update(bytes).digest('hex');
    this.blobs.set(sha, bytes);
    return { sha, size: bytes.byteLength };
  }
  entries() { return this.trees.get(this.commits.get(this.head).tree); }
  index(head = this.head) {
    const entries = this.trees.get(this.commits.get(head).tree);
    const item = entries.find((entry) => entry.path === CATALOG);
    return JSON.parse(new TextDecoder().decode(this.blobs.get(item.sha)));
  }
  concurrentChange(extraBytes = 0) {
    const entries = structuredClone(this.entries());
    entries.find((entry) => entry.path === 'docs/index.html').size += extraBytes;
    const index = this.index();
    index.files.push({ id: '22222222-2222-4222-8222-222222222222', name: 'Otro.pdf', category: 'Otros', size: 3, blobSha: this.blob('pdf').sha });
    const replacement = this.blob(JSON.stringify(index));
    Object.assign(entries.find((entry) => entry.path === CATALOG), replacement);
    const tree = this.sha(); this.trees.set(tree, entries);
    this.head = this.sha(); this.commits.set(this.head, { tree });
  }
  async fetch(url, options = {}) {
    if (String(url).includes('challenges.cloudflare.com')) return Response.json(this.verification);
    const path = new URL(url).pathname.replace('/repos/laslabcritical/uade.form/', '');
    const method = options.method || 'GET';
    if (path === 'git/ref/heads/main') return Response.json({ object: { sha: this.head } });
    if (path.startsWith('git/commits/') && method === 'GET') {
      const commit = this.commits.get(path.split('/').pop());
      return Response.json({ tree: { sha: commit.tree } });
    }
    if (path.startsWith('git/trees/') && method === 'GET') {
      return Response.json({ tree: this.trees.get(path.split('/').pop()), truncated: false });
    }
    if (path.startsWith('contents/')) {
      const ref = new URL(url).searchParams.get('ref');
      return Response.json(this.index(ref === 'main' ? this.head : ref));
    }
    if (path === 'git/blobs' && method === 'POST') {
      const payload = JSON.parse(await new Response(options.body).text());
      this.blobWrites++;
      const bytes = payload.encoding === 'base64' ? Buffer.from(payload.content, 'base64') : encoder.encode(payload.content);
      return Response.json({ sha: this.blob(bytes).sha }, { status: 201 });
    }
    if (path === 'git/trees' && method === 'POST') {
      const payload = JSON.parse(options.body);
      const entries = structuredClone(this.trees.get(payload.base_tree));
      for (const entry of payload.tree) {
        const blob = entry.content === undefined
          ? { sha: entry.sha, size: this.blobs.get(entry.sha).byteLength }
          : this.blob(entry.content);
        const next = { path: entry.path, type: 'blob', ...blob };
        const index = entries.findIndex((e) => e.path === entry.path);
        if (index < 0) entries.push(next); else entries[index] = next;
      }
      const sha = this.sha(); this.trees.set(sha, entries);
      return Response.json({ sha }, { status: 201 });
    }
    if (path === 'git/commits' && method === 'POST') {
      const sha = this.sha(); this.commits.set(sha, JSON.parse(options.body));
      return Response.json({ sha }, { status: 201 });
    }
    if (path === 'git/refs/heads/main' && method === 'PATCH') {
      const payload = JSON.parse(options.body);
      assert.equal(payload.force, false);
      if (this.conflict) {
        const change = this.conflict; this.conflict = undefined; change();
        return Response.json({ message: 'Not a fast forward' }, { status: 422 });
      }
      assert.equal(this.commits.get(payload.sha).parents[0], this.head);
      this.head = payload.sha; this.updates++;
      return Response.json({ object: { sha: this.head } });
    }
    if (path.startsWith('git/blobs/')) return new Response(this.blobs.get(path.split('/').pop()));
    throw new Error(`Unexpected GitHub API request ${method} ${path}`);
  }
}

function setup(t, size) {
  const github = new GitHub(size);
  t.mock.method(globalThis, 'fetch', github.fetch.bind(github));
  return { github, env: {
    GITHUB_TOKEN: 'test-only-token', GITHUB_REPOSITORY: 'laslabcritical/uade.form', GITHUB_BRANCH: 'main',
    ALLOWED_ORIGINS: ORIGIN, UPLOADS_ENABLED: 'true', TURNSTILE_SECRET_KEY: 'test-only-secret',
    UPLOAD_LIMITER: { limit: async () => ({ success: true }) }
  } };
}

function upload({ name = 'Guía de investigación.pdf', category = 'Bibliografía', bytes = '%PDF-1.7\ncontenido', size, origin = ORIGIN } = {}) {
  const data = encoder.encode(bytes);
  return new Request(`${ENDPOINT}/files`, {
    method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json',
      'X-File-Name': encodeURIComponent(name), 'X-File-Category': encodeURIComponent(category),
      'X-File-Size': String(size ?? data.byteLength), 'X-Turnstile-Token': 'verified-token'
    }, body: JSON.stringify({ encoding: 'base64', content: Buffer.from(data).toString('base64') })
  });
}

test('archivo y catálogo se publican juntos y permiten una descarga binaria con tildes', async (t) => {
  const { env, github } = setup(t);
  const response = await worker.fetch(upload(), env);
  assert.equal(response.status, 201);
  const { file, usedBytes } = await response.json();
  assert.equal(file.name, 'Guía de investigación.pdf');
  assert.equal(github.updates, 1);
  assert.equal(github.index().usedBytes, usedBytes);
  assert.ok(usedBytes > 8000);
  const list = await worker.fetch(new Request(`${ENDPOINT}/files`), env);
  assert.deepEqual((await list.json()).files, [file]);
  const download = await worker.fetch(new Request(`${ENDPOINT}/files/${file.id}`), env);
  assert.equal(await download.text(), '%PDF-1.7\ncontenido');
  assert.match(download.headers.get('Content-Disposition'), /Gu%C3%ADa/);
  assert.equal(download.headers.get('Content-Type'), 'application/octet-stream');
  const deletion = await worker.fetch(new Request(`${ENDPOINT}/files/${file.id}`, { method: 'DELETE' }), env);
  assert.equal(deletion.status, 405);
});

test('rechaza superar 1 GB antes de recibir un blob nuevo', async (t) => {
  const { env, github } = setup(t, MAX_TOTAL_BYTES - 100);
  const response = await worker.fetch(upload({ size: 1000 }), env);
  assert.equal(response.status, 507);
  assert.equal(github.blobWrites, 0);
  assert.equal(github.updates, 0);
});

test('también cuenta el crecimiento del catálogo en el límite de 1 GB', async (t) => {
  const { env, github } = setup(t, MAX_TOTAL_BYTES - 200);
  const response = await worker.fetch(upload(), env);
  assert.equal(response.status, 507);
  assert.equal(github.updates, 0);
});

test('una carga simultánea no desaparece al reintentar el commit', async (t) => {
  const { env, github } = setup(t);
  github.conflict = () => github.concurrentChange();
  assert.equal((await worker.fetch(upload(), env)).status, 201);
  assert.equal(github.index().files.length, 2);
  assert.ok(github.index().files.some((file) => file.name === 'Otro.pdf'));
  assert.equal(github.blobWrites, 1);
});

test('vuelve a comprobar la cuota tras un commit simultáneo', async (t) => {
  const { env, github } = setup(t);
  github.conflict = () => github.concurrentChange(MAX_TOTAL_BYTES);
  assert.equal((await worker.fetch(upload(), env)).status, 507);
  assert.equal(github.updates, 0);
});

test('valida el tamaño real del blob y no solo el encabezado del visitante', async (t) => {
  const { env, github } = setup(t);
  const response = await worker.fetch(upload({ size: 100 }), env);
  assert.equal(response.status, 400);
  assert.equal(github.updates, 0);
});

test('no acepta cargas sin token de GitHub, con formato inválido o de más de 25 MB', async (t) => {
  const { env, github } = setup(t);
  for (const fields of [{ size: MAX_BYTES + 1 }, { size: 0 }, { name: '../archivo.pdf' }, { name: 'archivo.html' }]) {
    assert.ok([400, 413].includes((await worker.fetch(upload(fields), env)).status));
  }
  delete env.GITHUB_TOKEN;
  const state = await worker.fetch(new Request(`${ENDPOINT}/status`), env);
  assert.equal((await state.json()).uploadsEnabled, false);
  assert.equal((await worker.fetch(upload(), env)).status, 503);
  assert.equal(github.updates, 0);
});

test('un origen o token Turnstile ajeno no permite escribir', async (t) => {
  const { env, github } = setup(t);
  assert.equal((await worker.fetch(upload({ origin: 'https://other.example' }), env)).status, 403);
  for (const invalid of [{ success: false }, { hostname: 'other.example' }, { action: 'login' }]) {
    github.verification = { success: true, hostname: 'laslabcritical.github.io', action: 'upload', ...invalid };
    assert.equal((await worker.fetch(upload(), env)).status, 403);
  }
  assert.equal(github.blobWrites, 0);
});

test('limita la frecuencia antes de escribir y no muestra éxito ante una falla de GitHub', async (t) => {
  const { env, github } = setup(t);
  env.UPLOAD_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(upload(), env)).status, 429);
  assert.equal(github.updates, 0);
  env.UPLOAD_LIMITER.limit = async () => ({ success: true });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
  assert.equal((await worker.fetch(upload(), env)).status, 503);
});

test('preflight habilita únicamente el origen de la página', async (t) => {
  const { env } = setup(t);
  const response = await worker.fetch(new Request(`${ENDPOINT}/files`, { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});
