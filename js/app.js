// Arranque de la app: navegación, render y estado de sincronización.
import * as S from './store.js';
import * as Sync from './sync.js';
import { h, icon } from './ui.js';
import { setRenderer } from './nav.js';
import * as Hoy from './views/hoy.js';
import * as Dieta from './views/dieta.js';
import * as Platillos from './views/platillos.js';
import * as Ingredientes from './views/ingredientes.js';
import * as Compras from './views/compras.js';
import * as Alacena from './views/alacena.js';
import * as Gastos from './views/gastos.js';
import * as Ajustes from './views/ajustes.js';
import * as Mas from './views/mas.js';

const NAV = [
  { path: 'hoy', label: 'Hoy', icon: 'today', mobile: true },
  { path: 'dieta', label: 'Dieta', icon: 'plan', mobile: true },
  { path: 'platillos', label: 'Platillos', icon: 'dish', mobile: true },
  { path: 'compras', label: 'Compras', icon: 'cart', mobile: true },
  { path: 'alacena', label: 'Alacena', icon: 'pantry' },
  { path: 'ingredientes', label: 'Ingredientes', icon: 'leaf' },
  { path: 'gastos', label: 'Gastos', icon: 'money' },
  { path: 'ajustes', label: 'Ajustes', icon: 'gear' },
];

const ROUTES = {
  hoy: Hoy, dieta: Dieta, platillos: Platillos, ingredientes: Ingredientes,
  compras: Compras, alacena: Alacena, gastos: Gastos, ajustes: Ajustes, mas: Mas,
};

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, ...rest] = raw.split('/').filter(Boolean);
  return { path: ROUTES[path] ? path : 'hoy', params: rest };
}

function navLink(item, active, cls) {
  return h('a', { href: '#/' + item.path, class: cls + (active ? ' active' : ''), 'aria-current': active ? 'page' : null },
    icon(item.icon), h('span', null, item.label));
}

function renderNav(path) {
  const side = document.getElementById('side-nav');
  side.replaceChildren(...NAV.map(n => navLink(n, n.path === path, 'side-link')));
  const bottom = document.getElementById('bottom-nav');
  const inMore = !NAV.find(n => n.path === path && n.mobile);
  bottom.replaceChildren(
    ...NAV.filter(n => n.mobile).map(n => navLink(n, n.path === path, 'tab-link')),
    navLink({ path: 'mas', label: 'Más', icon: 'more' }, inMore, 'tab-link'),
  );
}

let lastPath = '';
let pending = false;
let deferredUntilBlur = false;

function isEditing() {
  const a = document.activeElement;
  return a && a.closest && a.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox';
}

export function render() {
  const { path, params } = parseHash();
  const view = document.getElementById('view');
  const samePage = path + params.join('/') === lastPath;

  // Conservar foco y scroll al volver a pintar la misma pantalla.
  const active = document.activeElement;
  const focusKey = samePage && active && active.dataset ? active.dataset.k : null;
  let sel = null;
  try { sel = focusKey ? [active.selectionStart, active.selectionEnd] : null; } catch (e) { sel = null; }
  const scroll = window.scrollY;

  let out;
  try {
    out = ROUTES[path].render(params);
  } catch (e) {
    console.error(e);
    out = { title: 'Error', el: h('div', { class: 'card' }, h('p', null, 'Ocurrió un error al mostrar esta pantalla.'), h('pre', { class: 'muted small' }, String(e && e.stack || e))) };
  }
  document.getElementById('page-title').textContent = out.title;
  document.title = out.title === 'Mi Dieta' ? 'Mi Dieta' : `${out.title} · Mi Dieta`;
  view.replaceChildren(out.el);
  renderNav(path === 'mas' ? 'mas' : path);

  if (samePage) {
    window.scrollTo(0, scroll);
    if (focusKey) {
      const el = view.querySelector(`[data-k="${CSS.escape(focusKey)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* no aplica */ } }
      }
    }
  } else {
    window.scrollTo(0, 0);
  }
  lastPath = path + params.join('/');
}

// Pinta en el siguiente ciclo (después de que el foco se mueva al siguiente campo).
export function scheduleRender() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    render();
  }, 0);
}

function renderSyncPill(st) {
  const pill = document.getElementById('sync-pill');
  const map = {
    off: { icon: 'cloudOff', text: 'Solo local', cls: 'muted' },
    idle: { icon: 'cloudCheck', text: 'Sincronizado', cls: 'ok' },
    syncing: { icon: 'sync', text: 'Sincronizando', cls: 'busy' },
    pending: { icon: 'cloud', text: 'Pendiente', cls: 'busy' },
    offline: { icon: 'cloudOff', text: 'Sin conexión', cls: 'warn' },
    error: { icon: 'alert', text: 'Error', cls: 'err' },
  };
  const m = map[st.status] || map.off;
  pill.className = 'sync-pill ' + m.cls;
  pill.title = st.message || m.text;
  pill.replaceChildren(icon(m.icon, st.status === 'syncing' ? 'spin' : ''), h('span', null, m.text));
}

function boot() {
  setRenderer(scheduleRender);
  window.addEventListener('hashchange', render);
  S.subscribe(source => {
    if (source === 'remote' && isEditing()) {
      // No interrumpir mientras se escribe: pintar al salir del campo.
      if (!deferredUntilBlur) {
        deferredUntilBlur = true;
        document.addEventListener('focusout', () => {
          deferredUntilBlur = false;
          scheduleRender();
        }, { once: true });
      }
      return;
    }
    scheduleRender();
  });
  Sync.onStatus(renderSyncPill);
  Sync.init();
  if (!location.hash) history.replaceState(null, '', '#/hoy');
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  }
}

boot();
