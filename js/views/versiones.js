// Versiones guardadas en el gist: ver y regresar a una anterior.
import * as S from '../store.js';
import * as Sync from '../sync.js';
import { h, btn, iconBtn, confirmDialog, toast, empty, fmtDateTime } from '../ui.js';
import { refresh, go } from '../nav.js';

let state = { loading: false, versions: null, page: 1, more: false, error: '', preview: {} };

async function load(page = 1) {
  state = { ...state, loading: true, error: '' };
  refresh();
  try {
    const list = await Sync.listVersions(page);
    state.versions = page === 1 ? list : [...(state.versions || []), ...list];
    state.page = page;
    state.more = list.length === 30;
  } catch (e) {
    state.error = e.message || 'No se pudieron cargar las versiones';
  } finally {
    state.loading = false;
    refresh();
  }
}

async function preview(v) {
  state.preview[v.sha] = { loading: true };
  refresh();
  try {
    const data = await Sync.getVersion(v.sha);
    state.preview[v.sha] = { data, counts: data ? S.counts(data) : null };
  } catch (e) {
    state.preview[v.sha] = { error: e.message };
  }
  refresh();
}

function countsText(c) {
  return `${c.ingredients} ingredientes · ${c.recipes} platillos · ${c.plans} dietas · ${c.lists} listas · ${c.body} pesos · ${c.logs} días registrados`;
}

export function render() {
  const cfg = Sync.config();
  if (!cfg.connected) {
    return {
      title: 'Versiones',
      el: h('div', { class: 'page' }, empty('Conecta la sincronización primero', 'Las versiones anteriores se guardan en tu gist.', btn('Ir a Ajustes', () => go('ajustes'), { kind: 'primary' }))),
    };
  }
  if (state.versions === null && !state.loading && !state.error) setTimeout(() => load(1), 0);
  const now = S.counts(S.snapshot());

  const el = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, iconBtn('back', 'Volver', () => go('ajustes')), h('h2', { class: 'grow' }, 'Versiones guardadas')),
    h('p', { class: 'muted small' }, 'GitHub guarda una versión cada vez que la app sube cambios. Si algo se borró o se cambió por error, puedes regresar todo a como estaba. Lo que no esté en esa versión se manda a la papelera.'),
    h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Ahora tienes'), h('span', null, countsText(now))),
    state.error ? h('p', { class: 'err-text' }, state.error) : null,
    state.versions && !state.versions.length ? empty('Aún no hay versiones') : null,
    state.versions ? h('ul', { class: 'rows' }, state.versions.map((v, i) => {
      const pv = state.preview[v.sha];
      return h('li', { class: 'row version-row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, fmtDateTime(v.date), i === 0 ? h('span', { class: 'badge badge-ok' }, 'Actual') : null),
          pv && pv.counts ? h('div', { class: 'row-sub' }, countsText(pv.counts)) : null,
          pv && pv.loading ? h('div', { class: 'row-sub' }, 'Cargando…') : null,
          pv && pv.error ? h('div', { class: 'row-sub err-text' }, pv.error) : null),
        h('div', { class: 'row-actions' },
          !pv ? btn('Ver', () => preview(v), { small: true, kind: 'ghost' }) : null,
          pv && pv.data && i > 0 ? btn('Restaurar', async () => {
            if (!(await confirmDialog(`Tus datos quedarán como estaban el ${fmtDateTime(v.date)}. Lo que no exista en esa versión se manda a la papelera.`, { title: 'Restaurar versión', ok: 'Restaurar' }))) return;
            S.restoreSnapshot(pv.data);
            toast('Versión restaurada', 'ok');
            Sync.syncNow();
            go('hoy');
          }, { small: true, kind: 'primary' }) : null));
    })) : null,
    state.loading ? h('p', { class: 'muted center' }, 'Cargando…') : null,
    state.more && !state.loading ? h('div', { class: 'btn-row' }, btn('Ver más antiguas', () => load(state.page + 1), { kind: 'ghost' })) : null,
  );
  return { title: 'Versiones', el };
}

export function reset() {
  state = { loading: false, versions: null, page: 1, more: false, error: '', preview: {} };
}
