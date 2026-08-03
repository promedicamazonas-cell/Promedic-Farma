# Promedic Farma — App de catálogo

Catálogo online de la farmacia: medicamentos, dermatológicos, vitaminas y cuidado
personal. El cliente busca un producto, ve precio y stock, y arma su pedido por
WhatsApp.

- **En producción:** https://promedic-farma.vercel.app
- **Repositorio:** https://github.com/promedicamazonas-cell/Promedic-Farma
- **Despliegue:** Vercel, automático con cada push a `main`. Cada rama genera además
  una URL de vista previa — úsala para probar antes de tocar producción.

---

## Arquitectura

Sitio estático, sin backend ni framework. Todo se resuelve en el navegador.

```
index.html    470 líneas   estructura y marcado
styles.css  1.173 líneas   todo el diseño
app.js      1.381 líneas   catálogo, buscador, fichas, carrito de WhatsApp
sw.js                      service worker (offline)
manifest.json              instalable como app en el móvil
fotos/                     298 imágenes de producto
```

Hasta agosto de 2026 esto era **un solo `index.html` de 3.026 líneas**. Se separó
porque cualquier cambio obligaba a mover un archivo de 178 KB, y eso hacía lentas
las ediciones y agotaba el contexto de las herramientas de IA. El corte fue
puramente mecánico: no se movió ni una línea de lógica.

Dependencias externas: PapaParse (parseo de CSV, vía CDN) y Google Analytics.

## De dónde salen los datos

El catálogo **no está en el código**. `app.js` lo descarga en cada carga de página
desde una hoja de Google publicada como CSV:

```
https://docs.google.com/spreadsheets/d/182UZKEzDkVuph-woSp-ZjA6adIU1HTisEatJpxRCFvM
  /gviz/tq?tqx=out:csv&headers=1&gid=2093510093
```

Cambiar un precio o un stock es editar la hoja. **No requiere tocar el código ni
desplegar.** Las columnas que consume la app: `imagen`, `nombre`, `concentracion`,
`formaFarmaceutica`, `fabricante`, `categoria`, `precio_por_unidad`,
`stock_unidades`, `condicion_venta`, `descripcion`, `uso`, `principio_activo`,
`advertencias`, `destacado`, `imagen2`, `imagen3`.

## Imágenes de producto

La columna `imagen` acepta dos formas y `app.js` las distingue sola:

- **Nombre de archivo** (`effaclar-duo.jpg`) → lo busca en `fotos/`. **Esta es la
  forma correcta.**
- **URL completa** (`https://imgur.com/...`) → la usa tal cual. Queda como
  herencia; unas 57 filas siguen así.

### Por qué se dejó Imgur

Varias fotos se veían con **fondo negro** en las tarjetas. La causa: eran PNG con
transparencia y con negro guardado en los píxeles invisibles. Al generar la
miniatura, Imgur descarta el canal alfa y ese negro sale a la luz. La foto original
se veía bien; solo fallaba la miniatura.

### Regla para agregar una foto nueva

1. **Fondo blanco sólido, nunca transparencia.** Un PNG transparente es una bomba
   de tiempo: se ve bien hasta que algo aplana el canal alfa.
2. **JPG**, que ni siquiera admite transparencia. Máximo 1200 px de lado.
3. Nombre en minúsculas, sin acentos ni espacios, separado por guiones:
   `aciclovir-400-mg-medrock.jpg`.
4. Va en `fotos/`, se sube por git, y en la hoja se escribe **solo el nombre del
   archivo**.

`MAPEO_FOTOS.csv` (en la carpeta de trabajo, fuera del repo) guarda la
correspondencia entre cada original y su versión optimizada.

## Flujo de trabajo

La carpeta de trabajo (`Documents\PROMEDIC\PROMEDIC FARMA APP`) tiene los
originales pesados, PDFs y hojas de cálculo. **No es el repositorio.** El repo es
`Documents\PROMEDIC\Promedic-Farma` y solo contiene lo que se publica.

Para cualquier cambio que no sea trivial:

```bash
git checkout -b nombre-del-cambio    # rama nueva: main queda intacto
# ... editar ...
git add -A
git status                           # mirar antes de confirmar
git commit -m "Descripción del cambio"
git push -u origin nombre-del-cambio # Vercel genera vista previa
# si la vista previa se ve bien:
git checkout main && git merge nombre-del-cambio && git push
```

Nota sobre Windows: git avisa `LF will be replaced by CRLF`. Es solo el carácter
de fin de línea, no altera el contenido.

## Reglas para trabajar con IA en este proyecto

Una conversación murió por exceso de contexto y hubo que abandonarla. Para que no
se repita:

- **No leer archivos completos.** Buscar la línea y leer solo el bloque necesario.
- **Editar por reemplazo puntual**, nunca reescribiendo el archivo entero.
- **Una conversación por tarea.** Cuando la tarea termina, se cierra el chat.
- **Empezar leyendo este archivo**, no arrastrando la conversación anterior.
- Mandar una captura de pantalla, no cuatro.

## Pendientes

- **255 productos sin imagen** en la hoja. Es el hueco más visible del catálogo.
- **57 filas todavía en Imgur.** Migrar a `fotos/` cuando se consigan las fotos.
- **`REVISAR_sugerencias.csv`**: 33 filas donde el cruce automático encontró una
  foto parecida pero sin certeza. Revisar a mano.
- **PDFs de negocio en el repositorio público.** `Traspaso_Promedic_Amazonas.pdf`
  es descargable por cualquiera. El `.gitignore` impide subir más, pero no saca el
  que ya está — y borrarlo tampoco lo quita del historial. Decidir si se reescribe
  el historial o el repositorio pasa a privado.
- **Carpeta `ARCODEX 120 mg x 7 TAB_files`** en la carpeta de trabajo: 27 iconos de
  otra web, basura de una página guardada. Se puede borrar.

---

*Última actualización: agosto de 2026, tras migrar las imágenes a `fotos/` y
separar `index.html` en módulos.*
