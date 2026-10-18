// Ajustes: sincronización con gist, apariencia, moneda, respaldo e instalación.
import * as S from '../store.js';
import * as Sync from '../sync.js';
import { h, btn, field, select, segmented, numInput, confirmDialog, toast, icon, fmtDateTime, modal, toggle, dateInput } from '../ui.js';
import { reset as resetVersions } from './versiones.js';
import * as Rem from '../reminders.js';
import { AVG_OPTIONS, avgN } from '../prices.js';
import { refresh, go } from '../nav.js';

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
      h('dt', null, 'Última vez'), h('dd', null, cfg.lastSync ? fmtDateTime(cfg.lastSync) : '—'),
      h('dt', null, 'Token vence'), h('dd', null, expiryText())),
    cfg.tokenExpires ? null : field('¿Cuándo vence tu token? (opcional)', dateInput(cfg.manualExpires || '', v => { Sync.setManualExpiry(v); refresh(); },
      { k: 'tok-exp', label: 'Vencimiento del token', clearable: true, placeholder: 'Sin fecha' }), 'Es la fecha que elegiste en "Expiration" al crearlo. Te avisaremos una semana antes.'),
    h('p', { class: 'muted small' }, 'Los cambios se suben solos unos segundos después de hacerlos y se descargan al abrir la app. Si editas en dos dispositivos, se combinan registro por registro (gana el cambio más reciente).'),
    h('div', { class: 'btn-row' },
      btn('Sincronizar ahora', () => Sync.syncNow(), { kind: 'primary', icon: 'sync' }),
      btn('Cambiar token', () => openTokenChange(), { kind: 'ghost', icon: 'lock' }),
      btn('Desconectar este dispositivo', async () => {
        if (!(await confirmDialog('Este dispositivo dejará de sincronizar. Tus datos se quedan aquí y en el gist.', { ok: 'Desconectar' }))) return;
        Sync.disconnect();
        refresh();
      }, { kind: 'ghost' })));
}

function expiryText() {
  const d = Sync.tokenExpiry();
  if (!d) return 'No sé la fecha';
  const days = Math.ceil((d - Date.now()) / 86400000);
  const when = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  if (days < 0) return `Venció el ${when}`;
  return `${when} (${days} día${days === 1 ? '' : 's'})`;
}

function openTokenChange() {
  let tok = '';
  const inp = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'ghp_…', oninput: e => { tok = e.target.value; } });
  modal({
    title: 'Cambiar token',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted small' }, 'Pega el token nuevo. Se usa el mismo gist; tus datos no cambian.'),
      h('details', { class: 'help' }, h('summary', null, '¿Cómo obtengo un token nuevo?'), tokenSteps()),
      field('Token nuevo', inp)),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary', onClick: async () => {
          try {
            await Sync.connect(tok, Sync.config().gistId);
            toast('Token actualizado', 'ok');
            refresh();
          } catch (e) {
            toast(e.message || 'No se pudo conectar', 'err', 4000);
            return false;
          }
        },
      },
    ],
  });
}

function remindersCard(standalone, isIos) {
  const st = Rem.settings();
  const perm = Rem.permission();
  const permText = {
    granted: 'Notificaciones permitidas.',
    denied: 'Bloqueaste las notificaciones para esta página: actívalas en la configuración del navegador. Mientras, verás el aviso dentro de la app.',
    default: 'El navegador te pedirá permiso para mostrar notificaciones.',
    unsupported: 'Este navegador no muestra notificaciones; verás el aviso dentro de la app.',
  }[perm];
  return h('section', { class: 'card' },
    h('h2', null, icon('clock'), ' Recordatorios de comida'),
    toggle(st.enabled, async v => {
      if (v) await Rem.enable(); else Rem.disable();
      refresh();
    }, 'Avisarme a la hora de cada comida', 'Solo en este dispositivo. No avisa de comidas que ya marcaste como hechas.'),
    st.enabled ? field('Avisar', select([0, 5, 10, 15, 30].map(m => ({ value: m, label: m ? `${m} minutos antes` : 'A la hora exacta' })), st.offset, v => { Rem.setOffset(v); refresh(); })) : null,
    st.enabled ? h('p', { class: 'muted small' }, permText) : null,
    h('p', { class: 'muted small' }, isIos
      ? 'En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o más) y mientras siga abierta en segundo plano.'
      : 'Como la app no usa servidor, los avisos llegan mientras la app esté abierta o en segundo plano.' + (standalone ? '' : ' Funcionan mejor con la app instalada.')),
    st.enabled ? btn('Probar aviso', async () => {
      if (Rem.permission() === 'granted') {
        try {
          const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
          if (reg) await reg.showNotification('Mi Dieta', { body: 'Así se verán tus recordatorios.', icon: 'icons/icon-192.png', data: { url: './#/hoy' } });
          else new Notification('Mi Dieta', { body: 'Así se verán tus recordatorios.' });
        } catch (e) { toast('No se pudo mostrar la notificación', 'err'); }
      } else toast('Así se verán tus recordatorios dentro de la app.', 'ok', 5000);
    }, { kind: 'ghost', small: true, icon: 'clock' }) : null);
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
      field('Promedio de precios', select(AVG_OPTIONS.map(n => ({ value: n, label: n === 1 ? 'Solo la última compra' : `Últimas ${n} compras` })), avgN(), v => S.setSettings({ priceAvgN: Number(v) })), 'Para estimar el costo de tus listas, platillos y dietas.'),
      field('Moneda predeterminada', select([{ value: 'MXN', label: 'MXN (peso mexicano)' }, { value: 'USD', label: 'USD (dólar)' }], st.currency || 'MXN', v => S.setSettings({ currency: v }))),
      field('Tipo de cambio (MXN por 1 USD)', numInput(st.exchangeRate || null, v => S.setSettings({ exchangeRate: v || 0 }), { k: 'set-rate', placeholder: 'Ej. 18.50' }), 'Para ver todos tus gastos juntos en pesos.')),
    remindersCard(standalone, isIos),
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
        btn('Importar respaldo', importData, { icon: 'upload', kind: 'ghost' }),
        Sync.config().connected ? btn('Versiones guardadas', () => { resetVersions(); go('versiones'); }, { icon: 'clock', kind: 'ghost' }) : null,
        btn('Papelera', () => go('papelera'), { icon: 'trash', kind: 'ghost' }))),
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

