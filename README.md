# UADE Form

Encuesta estatica de investigacion para publicar en GitHub Pages con guardado en Supabase.

## Lo importante

- La web publica vive en `docs/`.
- La encuesta usa escala de acuerdo, opciones cerradas y un campo de texto.
- Cada respuesta puede guardarse inmediatamente en Supabase.
- Ya no hay exportacion a Excel ni workflows de sincronizacion.

## Estructura

- `docs/`: pagina publica del formulario.
- `docs/config.js`: conexion del frontend con Supabase.
- `docs/documentos/`: biblioteca pública de documentos, independiente de Supabase.
- `services/documentos/`: servicio de cargas y descargas con Cloudflare Workers y R2, sin base de datos.
- `supabase/schema.sql`: tabla, politicas y vista consolidada.

## Supabase

1. Crea un proyecto en `https://supabase.com/dashboard`.
2. Abri `SQL Editor`.
3. Ejecuta el script de `supabase/schema.sql`.
4. En `Project Settings` > `API`, copia `Project URL` y `Publishable key`.
5. Pegalos en `docs/config.js`.

El script de `supabase/schema.sql` borra la tabla/vista anterior y crea la estructura nueva para esta encuesta.

## Probar localmente

```bash
cd "/Users/gabriel/Documents/Gabriel/UADE/UADE Form Software"
python3 -m http.server 8080 --directory docs
```

Abre `http://localhost:8080/`.

## Publicar

1. Haz push del repo a `main`.
2. En GitHub entra a `Settings` > `Pages`.
3. Elige `Deploy from a branch`.
4. Selecciona `main` y la carpeta `/docs`.
5. Guarda.

La URL esperada es:

`https://laslabcritical.github.io/uade.form/`

## Documentos compartidos

La nueva página se publica en:

`https://laslabcritical.github.io/uade.form/documentos/`

Conserva el diseño del sitio y permite buscar por nombre, filtrar por categoría,
descargar archivos y compartir el enlace o el QR. Los QR PNG y SVG están en
`docs/documentos/qr/` y apuntan a esa dirección pública. No cambian al agregar documentos.

Para verla localmente, serví `docs/` con el comando anterior y abrí `/documentos/`.

### Almacenamiento

Esta sección no usa Supabase, SQL, D1 ni una base de datos. Los archivos y sus
datos asociados (nombre y categoría) se guardan juntos en Cloudflare R2.
El Worker permite subir sin cuenta de GitHub; valida tamaño y formato, aplica
límites de frecuencia y verifica Turnstile. Las descargas son públicas.

El código está preparado, pero **las cargas permanecen deshabilitadas hasta
conectar el servicio**. No se incluyeron archivos ficticios ni cargas simuladas.
La configuración pública `docs/documentos/config.js` está vacía para evitar
apuntar a un servicio inexistente. La activación se describe en
[services/documentos/README.md](services/documentos/README.md).

Sin ese servicio, la página muestra `docs/documentos/catalogo.json`. Se pueden
publicar documentos desde Git agregándolos en `docs/documentos/archivos/` y
anotando su ruta relativa, nombre, categoría, tamaño en bytes y fecha ISO:

```json
{
  "files": [
    {
      "path": "archivos/guia.pdf",
      "name": "Guía de lectura.pdf",
      "category": "Bibliografía",
      "size": 123456,
      "uploadedAt": "2026-09-23T15:00:00Z"
    }
  ]
}
```

Cuando se conecta el Worker, el listado proviene de R2; los archivos del catálogo
estático no se migran automáticamente. Para eliminarlos de R2, la administración
usa el panel de Cloudflare. Los visitantes no tienen permisos de borrado.

### Logo

El logo vectorial transparente se descargó sin modificar de
[Wikimedia Commons, Looo UADE.svg](https://commons.wikimedia.org/wiki/File:Looo_UADE.svg).
La fuente registra el sitio y un PDF institucional de UADE como procedencia.
Commons lo identifica como `PD-textlogo`; la marca pertenece a UADE.

### Verificación

```bash
node --check docs/documentos/documentos.js
node --test services/documentos/worker.test.mjs
```

El servicio también incluye una comprobación de empaquetado local (`npm run check`)
que no publica ni modifica recursos de Cloudflare.
