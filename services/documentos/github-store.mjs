export const MAX_TOTAL_BYTES = 1_000_000_000;
export const MAX_FILES = 1000;
const CATALOG = 'docs/documentos/catalogo.json';
const DIRECTORY = 'docs/documentos/archivos/';

export class StorageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function apiURL(env, path) {
  return `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`;
}

async function github(env, path, options = {}) {
  const response = await fetch(apiURL(env, path), {
    ...options,
    redirect: 'error',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'UADE-documentos',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new StorageError(response.status, response.status === 403 || response.status === 429
      ? 'GitHub no permite la operación en este momento. Intentá más tarde.'
      : 'No se pudo completar la operación en GitHub.');
  }
  return response;
}

async function data(env, path, method = 'GET', body) {
  const response = await github(env, path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
  return response.json();
}

function treeSize(tree) {
  if (tree.truncated) throw new StorageError(507, 'El repositorio contiene demasiados archivos para procesar la carga.');
  return tree.tree.reduce((sum, entry) => sum + (entry.type === 'blob' ? entry.size || 0 : 0), 0);
}

export async function catalog(env, ref = env.GITHUB_BRANCH) {
  const response = await github(env, `contents/${CATALOG}?ref=${encodeURIComponent(ref)}`, {
    headers: { Accept: 'application/vnd.github.raw+json' }
  });
  const result = await response.json();
  if (!Array.isArray(result.files)) throw new StorageError(503, 'El catálogo de documentos no está disponible.');
  return result;
}

async function snapshot(env) {
  const head = await data(env, `git/ref/heads/${env.GITHUB_BRANCH}`);
  const commit = await data(env, `git/commits/${head.object.sha}`);
  const tree = await data(env, `git/trees/${commit.tree.sha}?recursive=1`);
  const usedBytes = treeSize(tree);
  const index = await catalog(env, head.object.sha);
  return { head: head.object.sha, tree: commit.tree.sha, usedBytes, index,
    catalogBytes: tree.tree.find((entry) => entry.path === CATALOG)?.size || 0 };
}

// El navegador codifica el archivo. El Worker transmite el JSON sin cargarlo
// entero en memoria ni convertir 25 MB a base64 dentro del plan gratuito.
// Antes de publicar se verifica el tamaño REAL del blob en el árbol de GitHub.
function boundedStream(body, maxBytes) {
  if (!body) throw new StorageError(400, 'No se recibió el archivo.');
  let received = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maxBytes) throw new StorageError(413, 'La carga supera el tamaño permitido.');
      controller.enqueue(chunk);
    }
  }));
}

function checkCapacity(state, size) {
  if (state.usedBytes + size > MAX_TOTAL_BYTES) throw new StorageError(507, 'Se alcanzó el límite total de 1 GB. No se guardó el archivo.');
  if (state.index.files.length >= MAX_FILES) throw new StorageError(507, 'Se alcanzó el límite de 1000 documentos.');
}

export async function saveFile(request, env, { name, category, size }) {
  let state = await snapshot(env);
  checkCapacity(state, size);
  const blobResponse = await github(env, 'git/blobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: boundedStream(request.body, Math.ceil(size / 3) * 4 + 128),
    duplex: 'half'
  });
  const blob = await blobResponse.json();
  if (!/^[a-f0-9]{40}$/.test(blob.sha || '')) throw new StorageError(503, 'GitHub no confirmó la recepción del archivo.');
  const id = crypto.randomUUID();
  const extension = name.split('.').pop().toLowerCase();
  const file = { id, name, category, size, uploadedAt: new Date().toISOString(),
    path: `archivos/${id}.${extension}`, blobSha: blob.sha };
  const path = DIRECTORY + `${id}.${extension}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) state = await snapshot(env);
    checkCapacity(state, size);
    const nextIndex = { files: [file, ...state.index.files], usedBytes: state.usedBytes + size,
      maxTotalBytes: MAX_TOTAL_BYTES };
    let content;
    // El propio catálogo también ocupa espacio en el sitio publicado.
    for (let i = 0; i < 4; i++) {
      content = JSON.stringify(nextIndex, null, 2) + '\n';
      const bytes = new TextEncoder().encode(content).byteLength;
      const total = state.usedBytes + size + bytes - state.catalogBytes;
      if (total === nextIndex.usedBytes) break;
      nextIndex.usedBytes = total;
    }
    const nextTree = await data(env, 'git/trees', 'POST', {
      base_tree: state.tree,
      tree: [
        { path, mode: '100644', type: 'blob', sha: blob.sha },
        { path: CATALOG, mode: '100644', type: 'blob', content }
      ]
    });
    const verifiedTree = await data(env, `git/trees/${nextTree.sha}?recursive=1`);
    const actualTotal = treeSize(verifiedTree);
    const actualFile = verifiedTree.tree.find((entry) => entry.path === path);
    if (!actualFile || actualFile.size !== size) throw new StorageError(400, 'El tamaño recibido no coincide con el archivo declarado. No se publicó la carga.');
    if (actualTotal > MAX_TOTAL_BYTES) throw new StorageError(507, 'Se alcanzó el límite total de 1 GB. No se guardó el archivo.');
    const commit = await data(env, 'git/commits', 'POST', {
      message: `Agregar documento ${name}`,
      tree: nextTree.sha,
      parents: [state.head]
    });
    try {
      // Nunca force: dos cargas simultáneas deben conservar ambas entradas
      // y volver a comprobar el espacio con la última versión del catálogo.
      await data(env, `git/refs/heads/${env.GITHUB_BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
      return { file, usedBytes: actualTotal, maxTotalBytes: MAX_TOTAL_BYTES };
    } catch (error) {
      if (![409, 422].includes(error.status)) throw error;
    }
  }
  throw new StorageError(409, 'Hubo otras cargas simultáneas. Intentá nuevamente.');
}

export async function getFile(env, id, headOnly = false) {
  const index = await catalog(env);
  const file = index.files.find((entry) => entry.id === id);
  if (!file || !/^[a-f0-9]{40}$/.test(file.blobSha || '')) throw new StorageError(404, 'El documento ya no está disponible.');
  if (headOnly) return { file, body: null };
  const response = await github(env, `git/blobs/${file.blobSha}`, {
    headers: { Accept: 'application/vnd.github.raw+json' }
  });
  return { file, body: response.body };
}
