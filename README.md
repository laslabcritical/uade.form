# UADE Form

Formulario estatico de investigacion para publicar en GitHub Pages con autosave en Supabase.

## Lo importante

- La web publica vive en `docs/`.
- Cada click en `Si` o `No` puede guardarse inmediatamente en Supabase.
- GitHub Actions exporta una vista consolidada a `data/responses.xlsx`, `data/responses.csv` y `data/responses.json`.

## Arquitectura

GitHub Pages solo sirve archivos estaticos. Para guardar respuestas reales y luego verlas en GitHub, este proyecto usa:

1. GitHub Pages para publicar la pagina.
2. Supabase para recibir cada respuesta al instante.
3. Una tabla de eventos llamada `research_response_events`.
4. Una vista consolidada llamada `research_responses`.
5. GitHub Actions para exportar esa vista a Excel dentro del repo.

## Estructura

- `docs/`: pagina publica del formulario.
- `docs/config.js`: conexion del frontend con Supabase.
- `supabase/schema.sql`: tabla, politicas y vista consolidada.
- `scripts/export-responses.mjs`: exporta la vista a JSON, CSV y XLSX.
- `.github/workflows/sync-responses.yml`: workflow que actualiza los archivos dentro de GitHub.
- `data/`: carpeta de archivos exportados.

## Que cambia con el autosave

- Cada seleccion de `Si` o `No` inserta un evento en `research_response_events`.
- Cada cambio de nombre o email al salir del campo puede insertar un evento de perfil.
- Al apretar `Enviar respuestas`, se inserta un evento final de cierre.
- La vista `research_responses` toma el ultimo valor de cada pregunta y te muestra una fila por formulario.

## Paso 1: crear la base en Supabase

1. Crea un proyecto nuevo en `https://supabase.com/dashboard`.
2. Abri `SQL Editor`.
3. Crea una query nueva.
4. Pega el contenido de `supabase/schema.sql`.
5. Ejecuta el script completo.

Si ya habias creado la tabla vieja de pruebas, este script la reemplaza.

## Paso 2: verificar que la base quedo bien

En Supabase deberias ver:

- Tabla: `research_response_events`
- View: `research_responses`

La tabla guarda cada click o cambio.
La view te muestra el estado consolidado de cada formulario.

## Paso 3: copiar las claves correctas

En Supabase entra a `Project Settings` > `API` y copia:

- `Project URL`
- `Publishable key`

Si tu panel no muestra `Publishable key` y en cambio muestra `anon`, usa `anon`.

Tambien copia una clave privada para GitHub Actions:

- `secret key`

Si tu proyecto usa claves legacy, usa `service_role`.

## Paso 4: conectar el frontend

Edita `docs/config.js` y completa:

```js
window.UADE_FORM_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabasePublishableKey: "TU_PUBLISHABLE_O_ANON_KEY",
  eventsTableName: "research_response_events",
  responsesViewName: "research_responses",
  repoSyncPath: "data/responses.xlsx"
};
```

Nunca pongas la `secret key` o `service_role` en el frontend.

## Paso 5: probar localmente

```bash
cd "/Users/gabriel/Documents/Gabriel/UADE/UADE Form Software"
python3 -m http.server 8080 --directory docs
```

Abre:

`http://localhost:8080/`

Prueba esto:

1. Escribe un nombre.
2. Marca una respuesta `Si` o `No`.
3. En Supabase abre `Table Editor` > `research_response_events`.
4. Deberias ver el evento nuevo casi al instante.

Si queres ver la fila consolidada:

1. Abre `Database` > `Views`
2. Entra a `research_responses`

## Paso 6: exportar a Excel dentro de GitHub

En GitHub entra al repo y crea estos secretos en:

`Settings` > `Secrets and variables` > `Actions`

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Despues el workflow `.github/workflows/sync-responses.yml` va a leer la view `research_responses` y generar:

- `data/responses.xlsx`
- `data/responses.csv`
- `data/responses.json`

Puedes ejecutarlo manualmente desde:

`Actions` > `Sync Research Responses` > `Run workflow`

Tambien corre cada 15 minutos.

## Paso 7: publicar la pagina

1. Haz push del repo a `main`.
2. En GitHub entra a `Settings` > `Pages`.
3. Elige `Deploy from a branch`.
4. Selecciona `main` y la carpeta `/docs`.
5. Guarda.

La URL esperada es:

`https://laslabcritical.github.io/uade.form/`

## Push inicial

```bash
git add .
git commit -m "Autosave inmediato con Supabase"
git push -u origin main
```

## Privacidad

Si el repo es publico y exportas `responses.xlsx` dentro del repo, cualquiera que vea el repo puede descargar ese archivo.

Si quieres que la pagina sea publica pero no exponer respuestas:

- deja los datos solo en Supabase y no exportes al repo
- o usa un repo privado con un plan de GitHub compatible con Pages privadas
