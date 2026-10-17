// Navegación compartida por las pantallas.
let renderFn = () => {};

export function setRenderer(fn) {
  renderFn = fn;
}

// Vuelve a pintar la pantalla actual (por ejemplo, tras cambiar una pestaña).
export function refresh() {
  renderFn();
}

export function go(path) {
  location.hash = '#/' + path;
}
