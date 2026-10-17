// Sincronización con un gist privado de GitHub.
// El token se guarda solo en este dispositivo (localStorage) y nunca se sube a ningún lado
// más que a la API de GitHub.
import * as S from './store.js';

const LS_SYNC = 'midieta.sync.v1';
const API = 'https://api.github.com';
const FILE = 'mi_dieta.json';
const DESCRIPTION = 'Mi Dieta - datos de la app (no borrar)';

let cfg = (() => {
  try { return JSON.parse(localStorage.getItem(LS_SYNC) || '{}'); } catch (e) { return {}; }
})();

// status: 'off' | 'idle' | 'syncing' | 'pending' | 'offline' | 'error'
let state = { status: cfg.token ? 'pending' : 'off', message: '' };
const listeners = new Set();
let running = null;
let again = false;
let timer = null;
let applyingRemote = false;

function saveCfg() {
  try { localStorage.setItem(LS_SYNC, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ }
}

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

export function onStatus(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getStatus() {
  return state;
}

export function config() {
  return { login: cfg.login || '', gistId: cfg.gistId || '', lastSync: cfg.lastSync || 0, connected: !!cfg.token };
}

class SyncError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

async function api(path, opts = {}, token = cfg.token) {
  let res;
  try {
    res = await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (e) {
    throw new SyncError('Sin conexión', 'offline');
  }
  if (res.status === 401) throw new SyncError('El token no es válido o ya venció.', 'auth');
  if (res.status === 403) throw new SyncError('GitHub rechazó la petición. Revisa que el token tenga permiso "gist".', 'auth');
  if (res.status === 404) throw new SyncError('No se encontró el gist.', 'notfound');
  if (!res.ok) throw new SyncError('Error de GitHub (' + res.status + ').', 'http');
  return res.status === 204 ? null : res.json();
}

function packData() {
  return JSON.stringify({ app: 'mi_dieta', savedAt: new Date().toISOString(), data: S.snapshot() });
}

async function readGistData(gist) {
  const f = gist.files && gist.files[FILE];
  if (!f) return null;
  let text = f.content;
  if (f.truncated && f.raw_url) {
    const r = await fetch(f.raw_url, { cache: 'no-store' });
    text = await r.text();
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed.data ? parsed.data : null;
  } catch (e) {
    return null;
  }
}

async function findGist(token) {
  for (let page = 1; page <= 5; page++) {
    const list = await api('/gists?per_page=100&page=' + page, {}, token);
    const hit = list.find(g => g.files && g.files[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

// Conecta este dispositivo: valida el token, busca el gist o lo crea.
export async function connect(token, gistId = '') {
  token = token.trim();
  if (!token) throw new SyncError('Escribe tu token.', 'input');
  setState({ status: 'syncing', message: 'Conectando…' });
  try {
    const user = await api('/user', {}, token);
    let id = gistId.trim();
    if (id) {
      await api('/gists/' + id, {}, token);
    } else {
      id = await findGist(token);
    }
    if (!id) {
      const created = await api('/gists', {
        method: 'POST',
        body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content: packData() } } }),
      }, token);
      id = created.id;
    }
    cfg = { token, gistId: id, login: user.login, lastSync: 0 };
    saveCfg();
    await syncNow();
    return config();
  } catch (e) {
    setState({ status: cfg.token ? 'error' : 'off', message: e.message });
    throw e;
  }
}

export function disconnect() {
  cfg = {};
  saveCfg();
  setState({ status: 'off', message: '' });
}

async function doSync() {
  const gist = await api('/gists/' + cfg.gistId);
  const remote = await readGistData(gist);
  const local = S.snapshot();
  const merged = remote ? S.merge(local, remote) : local;
  const fpMerged = S.fingerprint(merged);
  if (fpMerged !== S.fingerprint(local)) {
    applyingRemote = true;
    try { S.replaceData(merged, 'remote'); } finally { applyingRemote = false; }
  }
  if (!remote || fpMerged !== S.fingerprint(remote)) {
    await api('/gists/' + cfg.gistId, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [FILE]: { content: packData() } } }),
    });
  }
  cfg.lastSync = Date.now();
  saveCfg();
}

// Descarga, combina y sube. Si ya hay una sincronización en curso, se repite al terminar.
export async function syncNow() {
  if (!cfg.token || !cfg.gistId) return;
  if (running) { again = true; return running; }
  setState({ status: 'syncing', message: '' });
  running = (async () => {
    try {
      do {
        again = false;
        await doSync();
      } while (again);
      setState({ status: 'idle', message: '' });
    } catch (e) {
      const offline = e.code === 'offline' || !navigator.onLine;
      setState({ status: offline ? 'offline' : 'error', message: e.message });
    } finally {
      running = null;
    }
  })();
  return running;
}

export function schedule(delay = 1500) {
  if (!cfg.token) return;
  setState({ status: state.status === 'syncing' ? 'syncing' : 'pending' });
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), delay);
}

export function init() {
  S.subscribe(source => {
    if (source === 'local' && !applyingRemote) schedule();
  });
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  // Revisión periódica mientras la app está abierta (por si otro dispositivo cambió algo).
  setInterval(() => {
    if (document.visibilityState === 'visible') syncNow();
  }, 60000);
  syncNow();
}
