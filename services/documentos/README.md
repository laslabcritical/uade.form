# Servicio de documentos

Worker HTTP con un bucket R2. No utiliza base de datos. Los nombres y categorías
se guardan como metadatos de cada objeto. La página estática sigue en GitHub Pages.

## Activación

Requiere una cuenta de Cloudflare con R2 habilitado. Su activación y las tarifas
dependen de esa cuenta; no se crea ni contrata nada al hacer commit en GitHub.

1. En esta carpeta, con Node 22 o posterior, ejecutá `npm ci`.
2. Autenticá tu cuenta con `npx wrangler login`.
3. Creá el bucket privado con `npx wrangler r2 bucket create uade-documentos`.
   Si usás otro nombre, actualizá `r2_buckets` en `wrangler.jsonc`.
4. Creá un widget de Turnstile para `laslabcritical.github.io` en Cloudflare.
   Guardá su clave secreta con `npx wrangler secret put TURNSTILE_SECRET_KEY`.
   Nunca agregues esta clave al repositorio o al JavaScript público.
5. En `wrangler.jsonc`, cambiá `UPLOADS_ENABLED` a `"true"`. `ALLOWED_ORIGINS`
   ya incluye el origen de este GitHub Pages; admite varios separados por comas.
   Las dos `namespace_id` de límites deben estar libres en esa cuenta para no
   compartir contadores con otros Workers.
6. Ejecutá `npm test`, `npm run check` y después `npm run deploy`.
7. Copiá la URL HTTPS que informa Cloudflare en `apiBaseUrl` de
   `docs/documentos/config.js`, sin `/files` ni otras rutas. Copiá la clave
   **pública** de Turnstile en `turnstileSiteKey`.
8. Publicá estos cambios en GitHub. El sitio sigue usando `main` → `/docs`;
   no necesita cambios de permisos ni workflows adicionales.
9. En la página publicada, subí un archivo pequeño, recargá y descargalo para
   comprobar la configuración real antes de repartir el QR.

Con `apiBaseUrl` vacío se muestra el catálogo estático y las cargas quedan
deshabilitadas. Con el Worker configurado, `/status` confirma si todos los
requisitos para cargar están disponibles. Ninguna respuesta exitosa se envía
antes de que R2 confirme el guardado.

## Operación

- `GET /status`: disponibilidad de cargas y límite por archivo.
- `GET /files?cursor=…`: listado paginado de objetos y metadatos.
- `POST /files`: cuerpo binario, hasta 25 MB. Requiere verificación Turnstile
  válida para el dominio autorizado y la acción `upload`.
- `GET /files/:id` y `HEAD /files/:id`: descarga pública con nombre original.
- No hay endpoint de eliminación ni de reemplazo para visitantes. El personal
  autorizado administra los archivos desde el panel R2 de Cloudflare.

Los límites iniciales son 5 intentos de carga y 120 solicitudes por minuto por
IP. Los límites de Workers se aplican en cada ubicación de Cloudflare, no son
una cuota global de almacenamiento ni un tope de facturación. Quienes compartan
la misma conexión también comparten esos límites.

Los formatos admitidos están enumerados en `worker.mjs` y en el selector de la
página. Los archivos se sirven como descargas adjuntas y no como páginas web.
La validación de formato usa la extensión; no incluye análisis antivirus.
Los nombres originales y categorías son públicos. No se guardan cuentas de
usuarios ni historiales de navegación. Cada nueva carga recibe un identificador
propio, incluso si su nombre coincide con otro archivo.

Para pausar cargas, cambiá `UPLOADS_ENABLED` a `"false"` y volvé a desplegar.
No hace falta eliminar archivos ni interrumpir las descargas.

## Desarrollo y comprobación

```bash
npm ci
npm test
npm run check
```

`npm run check` valida el paquete con Wrangler sin desplegarlo. Los archivos de
trabajo `.build/`, `.wrangler/` y `.dev.vars` están ignorados por Git.

`npm run dev` inicia el Worker con almacenamiento local de Wrangler. Para probar
cargas locales usá las claves de prueba oficiales de Turnstile, configurá la
clave secreta en `.dev.vars`, habilitá `UPLOADS_ENABLED` y agregá el origen local
a `ALLOWED_ORIGINS`. Restaurá las claves públicas y los orígenes de producción
antes del commit. Nunca habilites un bypass de la verificación en producción.

Referencias: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[validación Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[límites por frecuencia](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
