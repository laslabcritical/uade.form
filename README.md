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
- `services/documentos/`: servicio de cargas y descargas con Cloudflare Workers y GitHub, sin base de datos.
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

Los documentos se guardan en `docs/documentos/archivos/` y sus datos en
`docs/documentos/catalogo.json`, sin base de datos. Un Worker de Cloudflare
permite cargar sin cuenta de GitHub y guarda archivo y catálogo en un mismo commit.

El límite es **1 GB total**, **25 MB por archivo** y 1000 documentos. La cuota
cuenta los archivos de la versión actual del repositorio, incluido el catálogo;
no incluye versiones anteriores del historial de Git. Al alcanzar el límite se
rechazan nuevas cargas. No se utiliza R2 ni se activa un plan pago.

Las cargas requieren Turnstile y un token fine-grained de GitHub limitado a este
repositorio con permiso Contents de lectura y escritura. Ambos secretos quedan
en el Worker, nunca en el navegador ni en Git. Las instrucciones están en
[services/documentos/README.md](services/documentos/README.md).

Los visitantes pueden subir y descargar, pero no eliminar ni reemplazar archivos.
La administración puede borrar archivos y sus entradas del catálogo desde GitHub;
las versiones anteriores permanecen en el historial. Las descargas del Worker
están disponibles al confirmar el commit, sin esperar la reconstrucción de Pages.
Con `apiBaseUrl` vacío, la página muestra el catálogo estático y deshabilita cargas.

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
