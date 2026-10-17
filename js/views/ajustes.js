// Ajustes: sincronización con gist, apariencia, moneda, respaldo e instalación.
import * as S from '../store.js';
import * as Sync from '../sync.js';
import { h, btn, field, select, segmented, numInput, confirmDialog, toast, icon, fmtDateTime } from '../ui.js';
import { refresh } from '../nav.js';

let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
});

let tokenDraft = '';
let gistDraft = '';
let showToken = false;
let busy = false;

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function tokenSteps() {
  return h('ol', { class: 'steps' },
    h('li', null, 'Entra a ', h('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=Mi%20Dieta', target: '_blank', rel: 'noopener' }, 'github.com/settings/tokens/new'), ' con tu cuenta (o en GitHub: tu foto › Settings › Developer settings › Personal access tokens › Tokens (classic) › Generate new token (classic)).'),
    h('li', null, 'En "Note" escribe ', h('b', null, 'Mi Dieta'), '.'),
    h('li', null, 'En "Expiration" elige ', h('b', null, 'No expiration'), ' (o una fecha; cuando venza solo generas otro).'),
    h('li', null, 'En los permisos marca ', h('b', null, 'únicamente "gist"'), '. Nada más.'),
    h('li', null, 'Presiona ', h('b', null, 'Generate token'), ' y copia el código que empieza con ', h('code', null, 'ghp_'), '. GitHub solo lo muestra una vez: guárdalo en un lugar seguro (por ejemplo, tu gestor de contraseñas).'),
    h('li', null, 'Pégalo aquí y presiona ', h('b', null, 'Conectar'), '. La app crea el gist secreto sola. En tus otros dispositivos pega el mismo token y la app encontrará el gist automáticamente.'));
}

function syncCard() {
  const cfg = Sync.config();
  const st = Sync.getStatus();
  if (!cfg.connected) {
    const tokenInp = h('input', {
      class: 'input', type: showToken ? 'text' : 'password', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'ghp_…', value: tokenDraft, 'data-k': 'tok', oninput: e => { tokenDraft = e.target.value; },
    });
    return h('section', { class: 'card' },
      h('h2', null, icon('cloud'), ' Sincronización'),
      h('p', null, 'Ahora tus datos solo están en este dispositivo. Conecta un gist secreto de GitHub para tenerlos en tu PC, tablet y celular.'),
      h('details', { class: 'help' }, h('summary', null, '¿Cómo obtengo mi token?'), tokenSteps()),
      field('Token de GitHub', h('div', { class: 'inline' }, tokenInp,
        btn('', () => { showToken = !showToken; refresh(); }, { icon: showToken ? 'eyeOff' : 'eye', kind: 'ghost', title: showToken ? 'Ocultar' : 'Mostrar' })),
      'Se guarda solo en este dispositivo.'),
      h('details', { class: 'help' }, h('summary', null, 'Avanzado: usar un gist específico'),
        field('ID del gist (opcional)', h('input', { class: 'input', value: gistDraft, 'data-k': 'gid', placeholder: 'Se busca o se crea automáticamente', oninput: e => { gistDraft = e.target.value; } }))),
      st.message && st.status !== 'syncing' ? h('p', { class: 'err-text' }, st.message) : null,
      h('div', { class: 'btn-row' },
        btn(busy ? 'Conectando…' : 'Conectar', async () => {
          if (busy) return;
          busy = true; refresh();
          try {
            await Sync.connect(tokenDraft, gistDraft);
            tokenDraft = ''; gistDraft = '';
            toast('Sincronización activada', 'ok');
          } catch (e) {
            toast(e.message || 'No se pudo conectar', 'err', 4000);
          } finally {
            busy = false; refresh();
          }
        }, { kind: 'primary', icon: 'cloud', disabled: busy })));
  }
  const labels = { idle: 'Todo sincronizado', syncing: 'Sincronizando…', pending: 'Cambios pendientes', offline: 'Sin conexión: se sincroniza al volver', error: 'Error' };
  return h('section', { class: 'card' },
    h('h2', null, icon('cloudCheck'), ' Sincronización'),
    h('dl', { class: 'kv' },
      h('dt', null, 'Cuenta'), h('dd', null, '@' + cfg.login),
      h('dt', null, 'Gist'), h('dd', null, h('a', { href: `https://gist.github.com/${cfg.login}/${cfg.gistId}`, target: '_blank', rel: 'noopener' }, cfg.gistId.slice(0, 10) + '…')),
      h('dt', null, 'Estado'), h('dd', { class: st.status === 'error' ? 'err-text' : '' }, labels[st.status] || st.status, st.message && st.status === 'error' ? ` — ${st.message}` : ''),
      h('dt', null, 'Última vez'), h('dd', null, cfg.lastSync ? fmtDateTime(cfg.lastSync) : '—')),
    h('p', { class: 'muted small' }, 'Los cambios se suben solos unos segundos después de hacerlos y se descargan al abrir la app. Si editas en dos dispositivos, se combinan registro por registro (gana el cambio más reciente).'),
    h('div', { class: 'btn-row' },
      btn('Sincronizar ahora', () => Sync.syncNow(), { kind: 'primary', icon: 'sync' }),
      btn('Desconectar este dispositivo', async () => {
        if (!(await confirmDialog('Este dispositivo dejará de sincronizar. Tus datos se quedan aquí y en el gist.', { ok: 'Desconectar' }))) return;
        Sync.disconnect();
        refresh();
      }, { kind: 'ghost' })));
}

function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'mi_dieta', savedAt: new Date().toISOString(), data: S.snapshot() }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `mi_dieta_respaldo_${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importData() {
  const inp = h('input', { type: 'file', accept: 'application/json,.json' });
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const incoming = parsed && parsed.data ? parsed.data : parsed;
      if (!incoming || typeof incoming !== 'object' || !incoming.ingredients) throw new Error('formato');
      if (!(await confirmDialog('Los datos del respaldo se combinarán con los actuales (gana la versión más reciente de cada registro).', { title: 'Importar respaldo', ok: 'Importar' }))) return;
      S.replaceData(S.merge(S.snapshot(), incoming), 'local');
      toast('Respaldo importado', 'ok');
    } catch (e) {
      toast('El archivo no es un respaldo válido', 'err');
    }
  });
  inp.click();
}

export function render() {
  const st = S.settings();
  const theme = S.pref('theme', 'auto');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const el = h('div', { class: 'page settings' },
    syncCard(),
    h('section', { class: 'card' },
      h('h2', null, 'Apariencia'),
      segmented([{ value: 'auto', label: 'Automático' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }], theme, v => {
        S.setPref('theme', v);
        applyTheme(v);
        refresh();
      })),
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-2' }, 'Compras'),
      field('Moneda predeterminada', select([{ value: 'MXN', label: 'MXN (peso mexicano)' }, { value: 'USD', label: 'USD (dólar)' }], st.currency || 'MXN', v => S.setSettings({ currency: v }))),
      field('Tipo de cambio (MXN por 1 USD)', numInput(st.exchangeRate || null, v => S.setSettings({ exchangeRate: v || 0 }), { k: 'set-rate', placeholder: 'Ej. 18.50' }), 'Para ver todos tus gastos juntos en pesos.')),
    !standalone ? h('section', { class: 'card' },
      h('h2', null, 'Instalar en tu dispositivo'),
      installEvent
        ? h('div', null, h('p', null, 'Instálala como app: se abre a pantalla completa y funciona sin internet.'),
          btn('Instalar app', async () => {
            installEvent.prompt();
            await installEvent.userChoice;
            installEvent = null;
            refresh();
          }, { kind: 'primary', icon: 'download' }))
        : isIos
          ? h('p', null, 'En iPhone o iPad: abre esta página en Safari, toca el botón Compartir y elige "Agregar a pantalla de inicio".')
          : h('p', null, 'En Android (Chrome): menú ⋮ › "Instalar app" o "Agregar a la pantalla principal". En PC (Chrome o Edge): ícono de instalar en la barra de direcciones.')) : null,
    h('section', { class: 'card' },
      h('h2', null, 'Respaldo'),
      h('p', { class: 'muted small' }, 'Descarga un archivo con todos tus datos o restaura uno anterior.'),
      h('div', { class: 'btn-row' },
        btn('Descargar respaldo', exportData, { icon: 'download', kind: 'ghost' }),
        btn('Importar respaldo', importData, { icon: 'upload', kind: 'ghost' }))),
    h('section', { class: 'card danger-zone' },
      h('h2', null, 'Zona de riesgo'),
      h('p', { class: 'muted small' }, 'Borra los datos solo de este dispositivo y lo desconecta. Si tienes sincronización, tus datos siguen en el gist y vuelven al reconectar.'),
      btn('Borrar datos de este dispositivo', async () => {
        if (!(await confirmDialog('Se borrarán los datos guardados en este navegador.', { ok: 'Borrar', danger: true }))) return;
        Sync.disconnect();
        S.resetLocal();
        toast('Datos borrados de este dispositivo');
      }, { kind: 'danger', icon: 'trash' })),
    h('p', { class: 'muted small center' }, 'Mi Dieta · tus datos se guardan en tu navegador y, si lo activas, en tu gist secreto.'),
  );
  return { title: 'Ajustes', el };
}

