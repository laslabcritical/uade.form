(() => {
  "use strict";

  const config = window.UADE_DOCUMENTS_CONFIG || {};
  const root = document.getElementById("uade-documentos");
  const el = (id) => root.querySelector(`#${id}`);
  const MAX_BYTES = 25_000_000;
  const categories = ["Bibliografía", "Presentaciones", "Material de trabajo", "Otros"];
  const extensions = new Set(el("ud-files").accept.split(",").map((value) => value.slice(1)));
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  let files = [];
  let api = "";
  let uploadsEnabled = false;
  let busy = false;
  let widgetId;
  let verificationToken = "";
  let turnstileReady;

  function status(id, message, error = false) {
    el(id).textContent = message;
    el(id).dataset.error = String(error);
  }

  function apiURL(path) { return `${api}/${path}`; }

  function formatBytes(bytes) {
    return bytes < 1_000_000
      ? `${Math.max(1, Math.ceil(bytes / 1000))} KB`
      : `${(bytes / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
  }

  function documentRecord(file, fromAPI) {
    if (!file || typeof file.name !== "string" || !file.name.trim() || !Number.isFinite(file.size) || file.size < 0) {
      throw new Error("El listado de documentos no tiene un formato válido.");
    }
    let href;
    if (fromAPI) {
      if (!/^[a-f0-9-]{36}$/.test(file.id || "")) throw new Error("Documento no válido.");
      href = apiURL(`files/${file.id}`);
    } else {
      const base = new URL("archivos/", location.href);
      const path = new URL(file.path || "", location.href);
      if (path.origin !== base.origin || !path.pathname.startsWith(base.pathname) || path.pathname === base.pathname) {
        throw new Error("La dirección de un documento no es válida.");
      }
      href = path.href;
    }
    return { ...file, href, category: categories.includes(file.category) ? file.category : "Otros" };
  }

  function render() {
    const query = normalize(el("ud-search").value.trim());
    const category = el("ud-filter").value;
    const selected = files.filter((file) => normalize(file.name).includes(query) && (!category || file.category === category));
    const result = document.createDocumentFragment();
    selected.forEach((file) => {
      const row = document.createElement("article");
      row.className = "ud-file";
      const format = document.createElement("span");
      format.className = "ud-format";
      format.textContent = file.name.includes(".") ? file.name.split(".").pop().toUpperCase().slice(0, 6) : "ARCH.";
      const info = document.createElement("div");
      info.className = "ud-file-info";
      const name = document.createElement("p");
      name.className = "ud-file-title";
      name.textContent = file.name;
      const metadata = document.createElement("p");
      metadata.className = "ud-file-meta";
      const date = new Date(file.uploadedAt);
      metadata.textContent = [file.category, formatBytes(file.size), Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("es-AR")].filter(Boolean).join(" · ");
      info.append(name, metadata);
      const download = document.createElement("a");
      download.className = "ud-download";
      download.href = file.href;
      download.download = file.name;
      download.textContent = "Descargar";
      download.setAttribute("aria-label", `Descargar ${file.name}`);
      row.append(format, info, download);
      result.append(row);
    });
    el("ud-results").replaceChildren(result);
    el("ud-count").textContent = `${selected.length} documento${selected.length === 1 ? "" : "s"}`;
    el("ud-empty").hidden = selected.length > 0;
    el("ud-empty").textContent = files.length ? "No encontramos documentos con esa búsqueda." : "Todavía no hay documentos disponibles.";
  }

  async function getJSON(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000), ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo completar la operación. Intentá nuevamente.");
    return data;
  }

  async function loadFiles() {
    el("ud-library").setAttribute("aria-busy", "true");
    el("ud-retry").hidden = true;
    status("ud-status", "Cargando documentos…");
    try {
      const nextFiles = [];
      const cursors = new Set();
      let cursor = "";
      do {
        const url = api ? apiURL(`files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`) : "catalogo.json";
        const data = await getJSON(url);
        if (!Array.isArray(data.files)) throw new Error("No se pudo leer el listado de documentos.");
        nextFiles.push(...data.files.map((file) => documentRecord(file, Boolean(api))));
        cursor = api ? data.cursor || "" : "";
        if (cursor && (typeof cursor !== "string" || cursors.has(cursor))) throw new Error("No se pudo completar el listado de documentos.");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      files = nextFiles.sort((a, b) => (Date.parse(b.uploadedAt) || 0) - (Date.parse(a.uploadedAt) || 0));
      render();
      status("ud-status", "");
    } catch (error) {
      el("ud-empty").hidden = true;
      status("ud-status", error.message || "No se pudieron cargar los documentos.", true);
      el("ud-retry").hidden = false;
    } finally {
      el("ud-library").setAttribute("aria-busy", "false");
    }
  }

  function updateUploadControls() {
    el("ud-upload-fields").disabled = !uploadsEnabled || busy;
    el("ud-upload-unavailable").hidden = uploadsEnabled;
    el("ud-submit").disabled = !uploadsEnabled || busy || !verificationToken;
    el("ud-close-upload").disabled = busy;
    el("ud-submit").textContent = busy ? "Subiendo…" : "Subir archivo";
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (turnstileReady) return turnstileReady;
    turnstileReady = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        turnstileReady = undefined;
        reject(new Error("No se pudo cargar la verificación. Cerrá la carga y volvé a abrirla."));
      };
      document.head.append(script);
    });
    return turnstileReady;
  }

  async function toggleUpload(open) {
    if (busy) return;
    el("ud-upload").hidden = !open;
    el("ud-open-upload").setAttribute("aria-expanded", String(open));
    if (!open) { el("ud-open-upload").focus(); return; }
    if (!uploadsEnabled || widgetId !== undefined) return;
    try {
      await loadTurnstile();
      if (widgetId !== undefined) return;
      widgetId = window.turnstile.render(el("ud-verification"), {
        sitekey: config.turnstileSiteKey,
        action: "upload",
        language: "es",
        size: "flexible",
        callback: (token) => { verificationToken = token; updateUploadControls(); },
        "expired-callback": () => { verificationToken = ""; updateUploadControls(); },
        "error-callback": () => {
          verificationToken = "";
          updateUploadControls();
          status("ud-upload-status", "No se pudo completar la verificación. Intentá nuevamente.", true);
        }
      });
    } catch (error) { status("ud-upload-status", error.message, true); }
  }

  el("ud-upload").addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = el("ud-files").files[0];
    if (busy || !uploadsEnabled || !verificationToken || !file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (!file.size || file.size > MAX_BYTES || !extensions.has(extension)) {
      status("ud-upload-status", "Elegí un archivo de un formato admitido, que no esté vacío y que no supere los 25 MB.", true);
      return;
    }
    busy = true;
    updateUploadControls();
    status("ud-upload-status", `Subiendo ${file.name}…`);
    try {
      const data = await getJSON(apiURL("files"), {
        method: "POST",
        signal: AbortSignal.timeout(180_000),
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-File-Category": encodeURIComponent(el("ud-category").value),
          "X-File-Size": String(file.size),
          "X-Turnstile-Token": verificationToken
        },
        body: file
      });
      const saved = documentRecord(data.file, true);
      files.unshift(saved);
      el("ud-search").value = "";
      el("ud-filter").value = "";
      el("ud-files").value = "";
      render();
      status("ud-upload-status", `Se guardó ${saved.name}. Ya está disponible para descargar.`);
    } catch (error) {
      const uncertain = error.name === "TimeoutError" || error instanceof TypeError;
      status("ud-upload-status", uncertain ? "No se pudo confirmar la carga. Volvé a cargar el listado antes de intentarlo nuevamente." : error.message, true);
      el("ud-retry").hidden = false;
    } finally {
      busy = false;
      verificationToken = "";
      if (widgetId !== undefined) window.turnstile.reset(widgetId);
      updateUploadControls();
    }
  });

  el("ud-copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(config.publicUrl);
      el("ud-share-status").textContent = "Enlace copiado.";
    } catch { el("ud-share-status").textContent = `Copiá este enlace: ${config.publicUrl}`; }
  });
  el("ud-open-upload").addEventListener("click", () => toggleUpload(el("ud-upload").hidden));
  el("ud-close-upload").addEventListener("click", () => toggleUpload(false));
  el("ud-search").addEventListener("input", render);
  el("ud-filter").addEventListener("change", render);
  el("ud-retry").addEventListener("click", loadFiles);

  async function initialize() {
    if (config.apiBaseUrl) {
      try {
        const url = new URL(config.apiBaseUrl);
        if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error();
        if (url.username || url.password || url.search || url.hash) throw new Error();
        api = url.href.replace(/\/$/, "");
      } catch {
        status("ud-status", "El servicio de documentos no está disponible.", true);
        updateUploadControls();
        el("ud-library").setAttribute("aria-busy", "false");
        return;
      }
    }
    updateUploadControls();
    await Promise.all([
      loadFiles(),
      (async () => {
        if (api && config.turnstileSiteKey) {
          try { uploadsEnabled = (await getJSON(apiURL("status"))).uploadsEnabled === true; }
          catch { uploadsEnabled = false; }
          updateUploadControls();
          if (uploadsEnabled && !el("ud-upload").hidden) await toggleUpload(true);
        }
      })()
    ]);
  }
  initialize();
})();
