# Promedic Farma — App de catálogo

Catálogo online de la farmacia: medicamentos, dermatológicos, vitaminas y cuidado
personal. El cliente busca un producto, ve precio y stock, y arma su pedido por
WhatsApp. Incluye un carrusel de promociones y una ruleta de premios.

- **En producción:** https://promedic-farma.vercel.app
- **Repositorio:** https://github.com/promedicamazonas-cell/Promedic-Farma
- **Despliegue:** Vercel, automático con cada push a `main`. Cada rama genera además
  una URL de vista previa — úsala para probar antes de tocar producción.

---

## Arquitectura

Sitio estático, sin backend ni framework. Todo se resuelve en el navegador.

```
index.html    494 líneas   estructura y marcado
styles.css  1.250 líneas   todo el diseño
app.js      1.471 líneas   catálogo, buscador, fichas, carrito, promos, ruleta
sw.js                      service worker (offline)
manifest.json              instalable como app en el móvil
fotos/                     298 imágenes de producto (19 MB)
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

Las promociones salen de la misma hoja: son filas cuyo nombre empieza por `PROMO`
(`PROMO`, `PROMO2`, `PROMO3`…). Alimentan el carrusel y el panel lateral. Si no hay
ninguna, la app no muestra ni la lengüeta ni el panel.

## Imágenes de producto

Estado al día de hoy, sobre 527 productos:

| | |
|---|---|
| Con foto en `fotos/` | 232 |
| Con URL de Imgur (herencia) | 34 |
| Sin imagen | 261 |

La columna `imagen` acepta dos formas y `app.js` las distingue sola:

- **Nombre de archivo** (`effaclar-duo.jpg`) → lo busca en `fotos/`. **Esta es la
  forma correcta.**
- **URL completa** (`https://imgur.com/...`) → la usa tal cual. Queda como herencia.

### Por qué se dejó Imgur

Varias fotos se veían con **fondo negro** en las tarjetas. La causa: eran PNG con
transparencia y con negro guardado en los píxeles invisibles. Al generar la
miniatura, Imgur descarta el canal alfa y ese negro sale a la luz. La foto original
se veía bien; solo fallaba la miniatura.

### Regla para agregar una foto nueva

1. **Fondo blanco sólido, nunca transparencia.** Un PNG transparente es una bomba
   de tiempo: se ve bien hasta que algo aplana el canal alfa.
2. **JPG**, que ni siquiera admite transparencia. Máximo 1200 px de lado.
3. Nombre en minúsculas, sin acentos ni espacios, separado por guiones. Si hay
   varias presentaciones del mismo producto, **la dosis y el laboratorio van en el
   nombre**: `aciclovir-800-mg-fin.jpg`, no `aciclovir.jpg`. De eso depende que el
   cruce automático no confunda una caja con otra.
4. Va en `fotos/`, se sube por git, y en la hoja se escribe **solo el nombre del
   archivo**.

### El cruce automático: `_cruzar3.py`

Está en la carpeta de trabajo y propone la columna `imagen` para las filas que
todavía no tienen foto. Lee la hoja exportada y `MAPEO_FOTOS.csv`, y escribe
`COLUMNA_IMAGEN.csv` (para pegar en la hoja), `REVISAR_sugerencias.csv` y
`REVISAR_sin_foto.csv`. No toca ninguna fila que ya tenga foto local, así que se
puede correr las veces que haga falta.

**Reemplaza a `_cruzar2.py`, que producía errores graves.** Aquel borraba los
números del nombre por considerarlos ruido, así que ACICLOVIR 200 mg y ACICLOVIR
800 mg le parecían el mismo producto: asignó unas 20 fotos con la dosis equivocada
y las marcó con 0,93 de confianza. En una farmacia eso no es un detalle cosmético.
Se corrigieron a mano en agosto de 2026.

El script nuevo compara la dosis en vez de descartarla, distingue la dosis del
tamaño del envase (`frasco 120 ml` no es lo mismo que `15 mg/5 mL`), compara la
forma farmacéutica y el laboratorio, y asigna de forma global: ordena todos los
pares del catálogo por confianza y deja elegir primero a los más seguros, en vez de
dárselo al primero que pase. Corrido sobre el mismo punto de partida donde el viejo
cruzó 20 dosis, produce cero.

A cambio es más prudente: aplica menos y manda más a `REVISAR_sugerencias.csv`, con
una columna `otras_opciones` que trae las siguientes candidatas. **Si vuelves a
subir el umbral, vuelves al problema.**

## Ruleta de premios

Los premios se editan en el arreglo `premios` de `app.js` (busca
`=== RULETA DE PREMIOS`): etiqueta, código, color, si es premio o no, y el peso que
define su probabilidad.

La regla del negocio, que está escrita en la app en cuatro sitios (al abrir la
ruleta, en el premio ganado, en el mensaje de WhatsApp que envía el cliente, y en
Condiciones): **el premio no es acumulable.** Vale solo para una compra del mismo
día en que se gana, un premio por pedido, y no se combina con el 10% de la App. El
código lleva la fecha (`RUL-5-0408`), para que en el mostrador se vea de un vistazo
si venció.

Que el cliente lo repita en su propio mensaje de WhatsApp es deliberado: deja
constancia en el chat antes de que reclame nada.

**Límite conocido:** el "1 giro por día" vive en `localStorage`. Quien borre los
datos del sitio o entre desde otro teléfono puede volver a girar el mismo día. Para
cerrarlo de verdad haría falta algo del lado del servidor o atar el giro a un
número de WhatsApp.

## Flujo de trabajo

La carpeta de trabajo (`Documents\PROMEDIC\PROMEDIC FARMA APP`) tiene los
originales pesados, PDFs, hojas de cálculo y los scripts de cruce. **No es el
repositorio.** El repo es `Documents\PROMEDIC\Promedic-Farma` y solo contiene lo
que se publica.

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

Los finales de línea están fijados en LF por `.gitattributes`. Antes de eso, algo
reescribía los archivos con CRLF y `git status` marcaba los cinco archivos del
sitio como modificados aunque no hubieras tocado nada: un diff de 3.258 líneas
falsas que enterraba cualquier cambio real. Si vuelve a pasar, es que ese archivo
se perdió o que alguna herramienta lo está ignorando.

## Reglas para trabajar con IA en este proyecto

Una conversación murió por exceso de contexto y hubo que abandonarla. Para que no
se repita:

- **No leer archivos completos.** Buscar la línea y leer solo el bloque necesario.
- **Editar por reemplazo puntual**, nunca reescribiendo el archivo entero.
- **Una conversación por tarea.** Cuando la tarea termina, se cierra el chat.
- **Empezar leyendo este archivo**, no arrastrando la conversación anterior.
- Mandar una captura de pantalla, no cuatro.

## Pendientes

- **261 productos sin imagen** en la hoja. Es el hueco más visible del catálogo.
- **34 filas todavía en Imgur.** Migrar a `fotos/` cuando se consigan las fotos.
- **La hoja tiene basura:** 16 filas vacías y 10 productos cargados dos veces
  (CLOTRIMAZOL, FLORIL, HIRUDOID FORTE, LAMIDIZOL, cuatro de ISDIN, GOMITAS
  SOTTCOR). Los duplicados se ven repetidos en el catálogo.
- **PDFs de negocio en el repositorio público.** `Traspaso_Promedic_Amazonas.pdf`
  es descargable por cualquiera. El `.gitignore` impide subir más, pero no saca el
  que ya está — y borrarlo tampoco lo quita del historial. Decidir si se reescribe
  el historial o el repositorio pasa a privado.
- **La ruleta se puede girar más de una vez al día** borrando los datos del sitio
  (ver arriba).
- **Carpeta `ARCODEX 120 mg x 7 TAB_files`** en la carpeta de trabajo: 27 iconos de
  otra web, basura de una página guardada. Se puede borrar.

---

*Última actualización: agosto de 2026, tras corregir las fotos con la dosis
equivocada, reescribir el cruce automático y dejar explícito que el premio de la
ruleta no es acumulable.*
