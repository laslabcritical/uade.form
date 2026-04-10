# UADE Form

Formulario estatico de investigacion para publicar en GitHub Pages.

## Lo importante

- La web publica vive en `docs/`.
- Las respuestas reales se guardan en Supabase.
- Un workflow de GitHub Actions exporta esas respuestas a `data/responses.xlsx`, `data/responses.csv` y `data/responses.json`.

## Por que no se guarda directo en GitHub Pages

GitHub Pages solo sirve archivos estaticos. Eso significa que una pagina publicada ahi no puede escribir por si sola dentro del repositorio ni generar un `.xls` sin un backend o servicio intermedio.

Para resolverlo, este proyecto usa:

1. GitHub Pages para mostrar la pagina publica.
2. Supabase para recibir respuestas desde el navegador.
3. GitHub Actions para copiar esas respuestas al repo en formato Excel.

## Estructura

- `docs/`: pagina publica del formulario.
- `supabase/schema.sql`: tabla y politica RLS para la base.
- `scripts/export-responses.mjs`: exporta respuestas a JSON, CSV y XLSX.
- `.github/workflows/sync-responses.yml`: workflow que actualiza los archivos dentro de GitHub.
- `data/`: carpeta de archivos exportados.

## Paso 1: publicar la pagina en GitHub Pages

1. Hace commit y push de este proyecto a `main`.
2. En GitHub entra a `Settings` > `Pages`.
3. En `Build and deployment`, elegi `Deploy from a branch`.
4. En `Branch`, selecciona `main` y la carpeta `/docs`.
5. Guarda.

Si la organizacion usa GitHub Free, lo normal es publicar esto desde un repositorio publico. Con planes pagos, GitHub Pages tambien puede salir desde repos privados.

La URL esperada va a ser:

`https://laslabcritical.github.io/uade.form/`

## Paso 2: crear la base en Supabase

1. Crea un proyecto nuevo en Supabase.
2. Abri el SQL editor.
3. Pega el contenido de `supabase/schema.sql`.
4. Ejecuta el script para crear la tabla `research_responses`.

Despues copia estos datos del proyecto:

- `Project URL`
- `Publishable key`
- `Secret key`

## Paso 3: conectar la pagina publica

Edita `docs/config.js` y completa:

```js
window.UADE_FORM_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabasePublishableKey: "TU_PUBLISHABLE_KEY",
  tableName: "research_responses",
  repoSyncPath: "data/responses.xlsx"
};
```

El `publishable key` puede estar en una pagina publica si la tabla tiene RLS bien configurado. No subas nunca el `secret key` al frontend.

## Paso 4: conectar la exportacion a Excel dentro de GitHub

En GitHub entra a `Settings` > `Secrets and variables` > `Actions` y crea estos secretos del repositorio:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Con eso, el workflow `.github/workflows/sync-responses.yml` va a poder:

- leer respuestas de Supabase
- generar `data/responses.xlsx`
- hacer commit automatico de los cambios

Podes ejecutarlo manualmente desde `Actions` > `Sync Research Responses` > `Run workflow`.

Tambien corre cada 15 minutos.

## Paso 5: publicar cambios

```bash
git add .
git commit -m "Base inicial del formulario UADE"
git push -u origin main
```

## Importante sobre privacidad

Si el repositorio es publico y el workflow guarda `responses.xlsx` en el repo, cualquiera que vea el repo tambien va a poder descargar esas respuestas.

Si queres que la pagina sea publica pero que las respuestas no sean publicas, tenes dos opciones:

- dejar los datos solo en Supabase y no exportarlos al repo
- usar un repo privado con un plan de GitHub que permita Pages desde privado
