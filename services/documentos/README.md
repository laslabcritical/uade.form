# Servicio de documentos

Cloudflare Worker con archivos en GitHub, sin base de datos ni R2. La página
estática continúa en GitHub Pages. Utiliza Workers Free y las cuotas de GitHub.

## Activación

1. Ejecutá `npm ci` en esta carpeta y autenticá con `npx wrangler login`.
2. Creá un token fine-grained de GitHub con acceso únicamente a `uade.form` y
   permiso Contents → Read and write. Guardalo con `npx wrangler secret put GITHUB_TOKEN`.
3. Creá un widget Turnstile para `laslabcritical.github.io` y guardá su secreto
   con `npx wrangler secret put TURNSTILE_SECRET_KEY`.
4. Revisá repositorio, rama, origen y `UPLOADS_ENABLED` en `wrangler.jsonc`.
5. Ejecutá `npm test`, `npm run check` y `npm run deploy`.
6. Configurá la URL del Worker y la clave pública Turnstile en
   `../../docs/documentos/config.js` y publicá los cambios en GitHub.
7. Probá una carga y su descarga desde la página publicada antes de repartir el QR.

Los secretos nunca se agregan al JavaScript público ni al repositorio. `.env`
y `.dev.vars` están ignorados por Git. Renovar el token antes de su vencimiento.
El despliegue del Worker se hace con Wrangler; el push a GitHub publica Pages,
pero no despliega automáticamente el Worker.

## Límites

- 25 MB por archivo (25 000 000 bytes).
- 1 GB total (1 000 000 000 bytes), contando todos los archivos de la versión
  actual del repositorio. El historial de Git no está incluido en esta cuota.
- 1000 documentos en el catálogo.
- 5 intentos de carga y 120 solicitudes por minuto e IP; los contadores de
  Cloudflare son por ubicación y quienes comparten conexión comparten límite.

Al alcanzar la capacidad se rechazan cargas. No se habilitan recursos pagos ni
ampliaciones automáticas. También aplican las cuotas de Workers Free y de la API
GitHub: el servicio no ofrece tráfico ilimitado. Git conserva versiones antiguas;
borrar documentos no elimina su historial. Los blobs de cargas interrumpidas
pueden permanecer hasta la recolección de objetos de GitHub.

## Operación

- `GET /status`: disponibilidad y límites configurados.
- `GET /files`: catálogo público y ocupación registrada al guardar.
- `POST /files`: JSON `{ "encoding": "base64", "content": "…" }`, con
  `X-File-Name`, `X-File-Category` codificados con encodeURIComponent,
  `X-File-Size` en bytes originales y `X-Turnstile-Token` válido.
- `GET /files/:id` y `HEAD /files/:id`: descarga con nombre original.

El Worker transmite el JSON hacia GitHub sin convertir el archivo completo en
memoria. Comprueba tamaño real y cuota antes de confirmar un commit que incorpora
archivo y catálogo juntos. Si otra carga modifica la rama, vuelve a leerla y
comprueba la cuota nuevamente. No confirma éxito antes del commit.

Los visitantes no pueden borrar ni reemplazar. La administración elimina desde
GitHub el archivo y su entrada en `docs/documentos/catalogo.json`. Cada carga
recibe un identificador propio. Los nombres y categorías son públicos.
Los formatos admitidos se validan por extensión; no se incluye antivirus.
Las descargas usan attachment, nosniff y sandbox para evitar servir HTML activo.

Para pausar cargas, cambiá `UPLOADS_ENABLED` a `"false"` y desplegá nuevamente.
Con `apiBaseUrl` vacío, el navegador usa el catálogo estático sin permitir cargas.

## Comprobación

```bash
npm test
npm run check
```

Las pruebas cubren cuota, tamaño real, concurrencia, permisos, Turnstile,
frecuencia, errores de GitHub y descargas. `check` empaqueta sin desplegar.
Para desarrollo, utilizá una rama separada y claves de prueba Turnstile;
nunca desactives la verificación en producción.

Referencias: [Git blobs](https://docs.github.com/en/rest/git/blobs),
[Git trees](https://docs.github.com/en/rest/git/trees),
[límites de Workers](https://developers.cloudflare.com/workers/platform/limits/),
[tokens de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
