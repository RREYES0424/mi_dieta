// Almacenamiento de datos.
// Los datos viven en localStorage y se sincronizan (opcionalmente) con un gist privado.
// Cada registro lleva `updatedAt`; borrar deja una "lápida" (`deleted: true`) para que
// la sincronización entre dispositivos sepa que se eliminó.

const LS_DATA = 'midieta.data.v1';
const LS_PREFS = 'midieta.prefs.v1';

export const COLLECTIONS = ['aisles', 'ingredients', 'recipes', 'plans', 'lists', 'logs', 'body'];

const DEFAULT_AISLES = [
  'Frutas y verduras', 'Carnes', 'Pescados y mariscos', 'Salchichonería', 'Lácteos y huevo',
  'Tortillería', 'Panadería', 'Cereales', 'Abarrotes', 'Congelados', 'Bebidas', 'Otros',
];

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
}

function seed() {
  // IDs fijos y updatedAt = 1 para que, al sincronizar, cualquier dato real gane.
  const d = emptyData();
  DEFAULT_AISLES.forEach((name, i) => {
    const id = 'aisle-' + slug(name);
    d.aisles[id] = { id, name, order: i, updatedAt: 1 };
  });
  d.plans['plan-principal'] = {
    id: 'plan-principal', name: 'Mi dieta', meals: [], overrides: {}, updatedAt: 1,
  };
  d.settings = {
    activePlanId: 'plan-principal',
    currency: 'MXN',
    exchangeRate: 0,
    weightUnit: 'kg',
    updatedAt: 1,
  };
  return d;
}

function emptyData() {
  const d = { version: 1, settings: { updatedAt: 0 } };
  COLLECTIONS.forEach(c => { d[c] = {}; });
  return d;
}

function normalize(d) {
  const out = emptyData();
  if (!d || typeof d !== 'object') return out;
  COLLECTIONS.forEach(c => { if (d[c] && typeof d[c] === 'object') out[c] = d[c]; });
  if (d.settings && typeof d.settings === 'object') out.settings = d.settings;
  return out;
}

function loadData() {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* datos dañados: se reinicia */ }
  return seed();
}

let data = loadData();
let version = 0;
let lastStamp = 0;
const listeners = new Set();

export function now() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}

function persist() {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

function emit(source) {
  version++;
  listeners.forEach(fn => {
    try { fn(source); } catch (e) { console.error(e); }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getVersion() {
  return version;
}

// ---------- Lectura ----------

export function get(col, id) {
  const r = data[col] && data[col][id];
  return r && !r.deleted ? r : null;
}

export function all(col) {
  return Object.values(data[col] || {}).filter(r => !r.deleted);
}

export function settings() {
  return data.settings || {};
}

export function sortedAisles() {
  return all('aisles').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'es'));
}

export function byName(a, b) {
  return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
}

// ---------- Escritura ----------

export function put(col, rec) {
  const r = { ...rec };
  if (!r.id) r.id = uid();
  r.updatedAt = now();
  delete r.deleted;
  data[col][r.id] = r;
  persist();
  emit('local');
  return r;
}

export function putMany(col, recs) {
  recs.forEach(rec => {
    const r = { ...rec };
    if (!r.id) r.id = uid();
    r.updatedAt = now();
    delete r.deleted;
    data[col][r.id] = r;
  });
  persist();
  emit('local');
}

export function remove(col, id) {
  if (!data[col][id]) return;
  data[col][id] = { id, deleted: true, updatedAt: now() };
  persist();
  emit('local');
}

export function setSettings(patch) {
  data.settings = { ...data.settings, ...patch, updatedAt: now() };
  persist();
  emit('local');
}

// ---------- Sincronización ----------

export function snapshot() {
  return data;
}

// Combina dos copias registro por registro: gana la versión más reciente.
export function merge(a, b) {
  const A = normalize(a), B = normalize(b);
  const out = emptyData();
  COLLECTIONS.forEach(c => {
    const ids = new Set([...Object.keys(A[c]), ...Object.keys(B[c])]);
    ids.forEach(id => {
      const x = A[c][id], y = B[c][id];
      if (!x) out[c][id] = y;
      else if (!y) out[c][id] = x;
      else out[c][id] = newer(x, y);
    });
  });
  out.settings = newer(A.settings, B.settings);
  return out;
}

// Gana el más reciente; si empatan, una regla fija para que todos los dispositivos coincidan.
function newer(x, y) {
  const tx = x.updatedAt || 0, ty = y.updatedAt || 0;
  if (tx !== ty) return ty > tx ? y : x;
  return JSON.stringify(y) > JSON.stringify(x) ? y : x;
}

// Huella para saber si dos copias son iguales sin comparar todo el contenido.
export function fingerprint(d) {
  const N = normalize(d);
  const parts = [];
  COLLECTIONS.forEach(c => {
    Object.keys(N[c]).sort().forEach(id => parts.push(c + ':' + id + ':' + (N[c][id].updatedAt || 0)));
  });
  parts.push('settings:' + (N.settings.updatedAt || 0));
  return parts.join('|');
}

export function replaceData(d, source = 'remote') {
  data = normalize(d);
  persist();
  emit(source);
}

export function resetLocal() {
  data = seed();
  persist();
  emit('local');
}

// ---------- Preferencias de este dispositivo (no se sincronizan) ----------

let prefs = (() => {
  try { return JSON.parse(localStorage.getItem(LS_PREFS) || '{}'); } catch (e) { return {}; }
})();

export function pref(key, def) {
  return key in prefs ? prefs[key] : def;
}

export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  try { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); } catch (e) { /* sin almacenamiento */ }
}
