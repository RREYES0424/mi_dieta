// Unidades y conversiones.
// Internamente toda cantidad es un "vector" con tres dimensiones base:
//   g  = gramos (masa), ml = mililitros (volumen), pz = piezas.
// La conversión entre dimensiones depende del ingrediente:
//   gPorMl     (densidad, por defecto 1)
//   gPorPieza  (opcional; sin él, piezas y gramos no se mezclan)

export const UNITS = {
  g: { dim: 'g', f: 1, label: 'g', name: 'gramos' },
  kg: { dim: 'g', f: 1000, label: 'kg', name: 'kilos' },
  oz: { dim: 'g', f: 28.349523125, label: 'oz', name: 'onzas' },
  lb: { dim: 'g', f: 453.59237, label: 'lb', name: 'libras' },
  ml: { dim: 'ml', f: 1, label: 'ml', name: 'mililitros' },
  l: { dim: 'ml', f: 1000, label: 'l', name: 'litros' },
  floz: { dim: 'ml', f: 29.5735295625, label: 'oz fl', name: 'onzas líquidas' },
  gal: { dim: 'ml', f: 3785.411784, label: 'gal', name: 'galones' },
  taza: { dim: 'ml', f: 240, label: 'taza', name: 'tazas' },
  cda: { dim: 'ml', f: 15, label: 'cda', name: 'cucharadas' },
  cdita: { dim: 'ml', f: 5, label: 'cdita', name: 'cucharaditas' },
  pz: { dim: 'pz', f: 1, label: 'pz', name: 'piezas' },
};

// Unidades para capturar cantidades en platillos.
export const RECIPE_UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'taza', 'cda', 'cdita', 'pz'];
// Unidades para comprar.
export const BUY_UNITS = ['g', 'kg', 'lb', 'oz', 'ml', 'l', 'floz', 'gal', 'pz'];

export const DIM_NAME = { g: 'peso', ml: 'volumen', pz: 'piezas' };

export const zero = () => ({ g: 0, ml: 0, pz: 0 });

export function unitOf(u) {
  return UNITS[u] || UNITS.g;
}

export function toVec(qty, unit) {
  const v = zero();
  const u = unitOf(unit);
  const n = Number(qty) || 0;
  v[u.dim] = n * u.f;
  return v;
}

export function addVec(a, b) {
  return { g: (a.g || 0) + (b.g || 0), ml: (a.ml || 0) + (b.ml || 0), pz: (a.pz || 0) + (b.pz || 0) };
}

export function scaleVec(a, k) {
  return { g: (a.g || 0) * k, ml: (a.ml || 0) * k, pz: (a.pz || 0) * k };
}

export function isZeroVec(a) {
  return !(Math.abs(a.g || 0) > 1e-9 || Math.abs(a.ml || 0) > 1e-9 || Math.abs(a.pz || 0) > 1e-9);
}

function density(ing) {
  const d = Number(ing && ing.gPorMl);
  return d > 0 ? d : 1;
}

function gpp(ing) {
  const n = Number(ing && ing.gPorPieza);
  return n > 0 ? n : 0;
}

// Lleva un vector a una sola dimensión destino usando las equivalencias del ingrediente.
// Devuelve { val, rest } donde rest contiene lo que no se pudo convertir.
export function collapse(vec, ing, dim) {
  const d = density(ing);
  const p = gpp(ing);
  const rest = zero();
  let val = 0;
  const g = vec.g || 0, ml = vec.ml || 0, pz = vec.pz || 0;
  if (dim === 'g') {
    val = g + ml * d;
    if (p) val += pz * p; else rest.pz = pz;
  } else if (dim === 'ml') {
    val = ml + g / d;
    if (p) val += (pz * p) / d; else rest.pz = pz;
  } else {
    val = pz;
    if (p) val += (g + ml * d) / p; else { rest.g = g; rest.ml = ml; }
  }
  return { val, rest };
}

// Formatea un valor base (g, ml o pz) en una unidad concreta.
export function fmtIn(baseVal, unit, opts = {}) {
  const u = unitOf(unit);
  let n = baseVal / u.f;
  if (u.dim === 'pz' && opts.ceil) n = Math.ceil(n - 1e-9);
  return `${fmtNum(n, u)} ${u.label}`;
}

export function fmtNum(n, u) {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  let dec;
  if (u && (u.label === 'g' || u.label === 'ml')) dec = abs >= 10 ? 0 : 1;
  else if (u && u.dim === 'pz') dec = abs >= 10 ? 1 : 2;
  else dec = abs >= 100 ? 1 : 2;
  const s = n.toFixed(dec);
  return trimZeros(s);
}

export function trimZeros(s) {
  if (s.indexOf('.') === -1) return s;
  return s.replace(/\.?0+$/, '');
}

// Formatea un vector, mostrando la parte principal en `unit` y lo no convertible aparte.
export function fmtVec(vec, ing, unit, opts = {}) {
  const u = unitOf(unit);
  const { val, rest } = collapse(vec, ing, u.dim);
  const parts = [];
  if (Math.abs(val) > 1e-9 || isZeroVec(rest)) parts.push(fmtIn(val, unit, opts));
  if (Math.abs(rest.g) > 1e-9) parts.push(fmtIn(rest.g, 'g'));
  if (Math.abs(rest.ml) > 1e-9) parts.push(fmtIn(rest.ml, 'ml'));
  if (Math.abs(rest.pz) > 1e-9) parts.push(fmtIn(rest.pz, 'pz', opts));
  return parts.join(' + ');
}

// Parsea números escritos con coma o punto. Devuelve NaN si no hay número.
export function parseNum(s) {
  if (typeof s === 'number') return s;
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  return Number(t);
}

// Unidad de visualización según la preferencia global ('pref', 'g', 'kg', 'lb', 'oz').
// Solo cambia unidades de peso; volumen y piezas conservan la unidad preferida.
export function displayUnit(prefUnit, globalPref, baseVal) {
  const u = unitOf(prefUnit);
  if (!globalPref || globalPref === 'pref' || u.dim !== 'g') return prefUnit;
  if (globalPref === 'metric') return baseVal >= 1000 ? 'kg' : 'g';
  return globalPref;
}
