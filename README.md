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
