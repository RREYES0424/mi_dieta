# Mi Dieta

Aplicación web para planear tu dieta, guardar tus platillos y generar tu lista de compras.
Está hecha solo con HTML, CSS y JavaScript, así que se publica gratis en **GitHub Pages**.
Funciona en PC, tablet y celular, se puede instalar como app y funciona sin internet.

## Qué hace

- **Dietas**: crea varias dietas, agrega o quita tiempos de comida, cambia horarios y elige cuál está activa.
  Cada dieta es igual todos los días, pero puedes **personalizar cualquier día de la semana**.
- **Platillos**: guarda tus platillos con sus ingredientes y cantidades. Puedes editarlos, renombrarlos, duplicarlos,
  archivarlos y ponerlos en cualquier tiempo de comida, con porciones (×0.5, ×2…).
- **Ingredientes**: pasillo, unidad de compra (g, kg, lb, oz, ml, l, piezas…), merma al limpiar, merma de cocción,
  % de compra extra, gramos por pieza, densidad (para lo que pesas pero compras por litro),
  presentación de compra (cartón de 946 ml, bolsa de 1 kg…) y macros opcionales.
- **Lista de compras**: se genera a partir de la dieta para los días que elijas. Al generarla escribes cuánto tienes
  de cada ingrediente (o tocas "Lo tengo") y solo pide lo que falta; también puedes ajustar mermas y extra por
  ingrediente. La lista se guarda con fecha y tiene casillas para ir marcando. Puedes compartirla por WhatsApp
  o imprimirla, y al cerrarla capturas el total del ticket en MXN o USD ("Compré todo" marca lo que falte).
- **Hoy**: el menú del día con horarios; marca "Lo comí" en cada comida y escribe una nota del día.
- **Progreso**: peso, cintura y % de grasa con gráfica; cumplimiento de la dieta (mapa de las últimas 12 semanas,
  porcentaje y racha); promedio de calorías y macros que comiste contra la meta; historial de registros y compras.
- **Gastos**: total por mes, últimos 30 días, promedio semanal y una gráfica de los últimos 12 meses.
- **Sincronización** con un gist secreto de tu cuenta de GitHub para tener los mismos datos en todos tus dispositivos.
- Modo oscuro, respaldo en archivo y funcionamiento sin conexión.

### Cómo se calcula lo que hay que comprar

```
crudo     = lo que se pesa crudo + (lo que se pesa cocido ÷ (1 − merma de cocción))
comprar   = crudo ÷ (1 − merma al limpiar) × (1 + extra)
a comprar = comprar − lo que ya tienes
```

Las piezas y las presentaciones siempre se redondean hacia arriba.

## Publicar en GitHub Pages

1. En el repositorio entra a **Settings › Pages**.
2. En **Source** elige **Deploy from a branch**.
3. En **Branch** elige `main` y la carpeta `/ (root)`, y presiona **Save**.
4. En uno o dos minutos la app queda en `https://<tu-usuario>.github.io/mi_dieta/`.

> Con una cuenta gratuita de GitHub, Pages solo funciona en repositorios **públicos**.
> El código es público, pero **tus datos no**: se guardan en tu navegador y en tu gist secreto, nunca en este repositorio.

## Sincronizar entre dispositivos (gist secreto)

La app guarda todo en el navegador. Para tener lo mismo en tu PC, tablet y celular se conecta a un gist secreto
de tu cuenta de GitHub. Solo necesitas un token; el gist lo crea la app.

### 1. Crear el token (una sola vez)

1. Entra a <https://github.com/settings/tokens/new?scopes=gist&description=Mi%20Dieta>
   (o en GitHub: tu foto › **Settings** › **Developer settings** › **Personal access tokens** › **Tokens (classic)** ›
   **Generate new token (classic)**).
2. **Note**: `Mi Dieta`.
3. **Expiration**: `No expiration`, o una fecha. Cuando venza, generas otro y lo vuelves a pegar.
4. En **Select scopes** marca **únicamente `gist`**.
5. Presiona **Generate token** y copia el código que empieza con `ghp_`.
   GitHub lo muestra **una sola vez**: guárdalo en tu gestor de contraseñas.

### 2. Conectar cada dispositivo

1. Abre la app y ve a **Ajustes › Sincronización**.
2. Pega el token y presiona **Conectar**.
   - En el primer dispositivo la app crea el gist secreto `mi_dieta.json` con tus datos.
   - En los demás, la app encuentra ese gist automáticamente y combina los datos.
3. Listo. Los cambios se suben solos unos segundos después de hacerlos y se descargan al abrir la app.

### Cosas importantes

- **No compartas el token** con nadie ni lo pegues en el código, en un issue o en un chat. Solo va en la app.
  Si crees que alguien lo vio, bórralo en GitHub y crea otro.
- El token solo tiene permiso sobre tus gists: no puede tocar tus repositorios.
- Un gist "secreto" no aparece en búsquedas ni en tu perfil, pero cualquiera que tenga su enlace exacto puede verlo.
  No guardes ahí nada sensible.
- Si editas en dos dispositivos, los datos se combinan registro por registro y gana el cambio más reciente.
- Puedes descargar un respaldo en **Ajustes › Respaldo** cuando quieras.

## Instalar como app

- **Android (Chrome)**: menú ⋮ › **Instalar app** o **Agregar a la pantalla principal**.
- **iPhone/iPad (Safari)**: botón **Compartir** › **Agregar a pantalla de inicio**.
- **PC (Chrome o Edge)**: ícono de instalar en la barra de direcciones.

## Estructura

```
index.html              Página principal
css/styles.css          Estilos (responsivo, claro y oscuro)
js/app.js               Arranque y navegación
js/store.js             Datos locales y combinación para sincronizar
js/sync.js              Sincronización con el gist
js/calc.js              Cálculos: menú, necesidades, mermas, macros
js/tracking.js          Registro diario (comidas hechas) y peso
js/units.js             Unidades y conversiones
js/ui.js                Componentes de interfaz
js/views/*.js           Pantallas
sw.js                   Modo sin conexión
manifest.webmanifest    Datos para instalar como app
```

Para probar localmente: `python3 -m http.server` en la carpeta del proyecto y abre `http://localhost:8000`.

Cada vez que cambies archivos de la app, sube el número de `CACHE` en `sw.js` (`mi-dieta-v1`, `mi-dieta-v2`…)
para que los dispositivos instalados reciban la versión nueva.
