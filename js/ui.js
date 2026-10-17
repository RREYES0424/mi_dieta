// Utilidades de interfaz: creación de elementos, íconos, diálogos y avisos.
import { parseNum } from './units.js';

const PROPS = new Set(['checked', 'disabled', 'selected', 'hidden', 'textContent', 'readOnly', 'open', 'indeterminate']);

export function h(tag, props, ...kids) {
  const el = tag === 'svg' || tag === 'path' || tag === 'rect' || tag === 'g' || tag === 'line' || tag === 'text'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  let value;
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

// ---------- Íconos (trazos simples, heredan el color del texto) ----------

const P = {
  today: '<path d="M7 3v3M17 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M9 14l2 2 4-4"/>',
  plan: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  dish: '<path d="M3 13h18"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M12 6v3M9 7l1 2M15 7l-1 2"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  pantry: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 6h4M10 12h4M10 18h4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 12h.01M17 12h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
  cloudCheck: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
  cloudOff: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M4 4l16 16"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15"/><path d="M20 20v-5h-5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5"/><path d="M4 4l16 16"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'ico ' + cls;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  return span;
}

// ---------- Botones ----------

export function btn(label, onClick, opts = {}) {
  const cls = ['btn', opts.kind ? 'btn-' + opts.kind : '', opts.small ? 'btn-sm' : '', opts.block ? 'btn-block' : '', opts.cls || ''].join(' ').trim();
  return h('button', { type: opts.type || 'button', class: cls, onclick: onClick, disabled: opts.disabled, title: opts.title || label || null },
    opts.icon ? icon(opts.icon) : null, label ? h('span', null, label) : null);
}

export function iconBtn(name, title, onClick, opts = {}) {
  return h('button', {
    type: 'button', class: 'icon-btn ' + (opts.kind ? 'icon-btn-' + opts.kind : '') + (opts.cls ? ' ' + opts.cls : ''),
    title, 'aria-label': title, onclick: onClick, disabled: opts.disabled,
  }, icon(name));
}

// ---------- Campos ----------

let fieldSeq = 0;

export function field(label, control, hint) {
  const id = control.id || 'f' + (++fieldSeq);
  control.id = id;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    control,
    hint ? h('small', { class: 'hint' }, hint) : null);
}

// Campo numérico que acepta coma o punto decimal.
export function numInput(value, onCommit, opts = {}) {
  const inp = h('input', {
    type: 'text', inputmode: 'decimal', class: 'input num ' + (opts.cls || ''),
    value: value == null || value === '' || Number.isNaN(value) ? '' : String(roundForInput(value)),
    placeholder: opts.placeholder || '', 'data-k': opts.k, 'aria-label': opts.label,
    onchange: e => {
      const n = parseNum(e.target.value);
      onCommit(Number.isNaN(n) ? null : n, e);
    },
    onfocus: e => e.target.select(),
  });
  return inp;
}

function roundForInput(v) {
  const n = Number(v);
  if (!isFinite(n)) return '';
  return Math.round(n * 1000) / 1000;
}

export function textInput(value, onCommit, opts = {}) {
  return h('input', {
    type: opts.type || 'text', class: 'input ' + (opts.cls || ''), value: value || '',
    placeholder: opts.placeholder || '', 'data-k': opts.k, 'aria-label': opts.label,
    list: opts.list, autocomplete: opts.autocomplete || 'off',
    onchange: e => onCommit(e.target.value, e),
  });
}

export function select(options, value, onChange, opts = {}) {
  return h('select', {
    class: 'input select ' + (opts.cls || ''), 'data-k': opts.k, 'aria-label': opts.label,
    value: value == null ? '' : String(value),
    onchange: e => onChange(e.target.value, e),
  }, options.map(o => (o.group
    ? h('optgroup', { label: o.group }, o.options.map(x => h('option', { value: String(x.value) }, x.label)))
    : h('option', { value: String(o.value), disabled: o.disabled }, o.label))));
}

export function checkbox(checked, onChange, label, opts = {}) {
  return h('label', { class: 'check ' + (opts.cls || '') },
    h('input', { type: 'checkbox', checked: !!checked, 'data-k': opts.k, onchange: e => onChange(e.target.checked, e) }),
    h('span', { class: 'check-box' }, icon('check')),
    label ? h('span', { class: 'check-label' }, label) : null);
}

export function toggle(checked, onChange, label, hint) {
  return h('label', { class: 'toggle' },
    h('span', { class: 'toggle-text' }, h('span', null, label), hint ? h('small', { class: 'hint' }, hint) : null),
    h('input', { type: 'checkbox', role: 'switch', checked: !!checked, onchange: e => onChange(e.target.checked) }),
    h('span', { class: 'toggle-track' }, h('span', { class: 'toggle-thumb' })));
}

export function segmented(options, value, onChange, opts = {}) {
  return h('div', { class: 'segmented ' + (opts.cls || ''), role: 'tablist' },
    options.map(o => h('button', {
      type: 'button', role: 'tab', class: 'seg' + (String(o.value) === String(value) ? ' active' : '') + (o.marked ? ' marked' : ''),
      'aria-selected': String(String(o.value) === String(value)),
      onclick: () => onChange(o.value),
    }, o.label)));
}

export function empty(title, text, action) {
  return h('div', { class: 'empty' },
    h('p', { class: 'empty-title' }, title),
    text ? h('p', { class: 'muted' }, text) : null,
    action || null);
}

// ---------- Diálogos ----------

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const dlg = h('dialog', { class: 'modal' + (wide ? ' modal-wide' : '') });
  const close = () => {
    if (dlg.open) dlg.close();
  };
  const content = typeof body === 'function' ? body(close) : body;
  const form = h('form', { method: 'dialog', class: 'modal-card', onsubmit: e => e.preventDefault() },
    h('div', { class: 'modal-head' },
      h('h2', null, title),
      iconBtn('x', 'Cerrar', close)),
    h('div', { class: 'modal-body' }, content),
    actions.length ? h('div', { class: 'modal-actions' },
      actions.map(a => btn(a.label, async () => {
        const r = a.onClick ? await a.onClick(close) : undefined;
        if (r !== false) close();
      }, { kind: a.kind, icon: a.icon }))) : null);
  dlg.appendChild(form);
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (onClose) onClose();
  });
  dlg.addEventListener('click', e => {
    if (e.target === dlg) close();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  const first = dlg.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
  if (first && !window.matchMedia('(pointer: coarse)').matches) first.focus();
  return { close, el: dlg };
}

export function confirmDialog(message, { title = '¿Estás seguro?', ok = 'Sí, continuar', danger = false } = {}) {
  return new Promise(resolve => {
    let result = false;
    modal({
      title,
      body: h('p', null, message),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { result = true; } },
      ],
      onClose: () => resolve(result),
    });
  });
}

export function promptDialog(title, value = '', { label = 'Nombre', ok = 'Guardar', placeholder = '' } = {}) {
  return new Promise(resolve => {
    let result = null;
    const inp = h('input', { class: 'input', value, placeholder });
    const m = modal({
      title,
      body: field(label, inp),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: ok, kind: 'primary', onClick: () => {
            const v = inp.value.trim();
            if (!v) { inp.focus(); return false; }
            result = v;
          },
        },
      ],
      onClose: () => resolve(result),
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = inp.value.trim();
        if (v) { result = v; m.close(); }
      }
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

// ---------- Avisos ----------

export function toast(msg, kind = 'info', ms = 2600) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast toast-' + kind, role: 'status' }, msg);
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// ---------- Fechas legibles ----------

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(d).toLocaleDateString('es-MX', opts);
}

export function fmtDateTime(d) {
  return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(t) {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  const ap = hh >= 12 ? 'p. m.' : 'a. m.';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

// Ancho del dibujo según la pantalla, para que el texto de los ejes se lea en celular.
export function chartWidth() {
  const v = document.getElementById('view');
  const w = v ? v.clientWidth - 64 : 720;
  return Math.round(Math.min(Math.max(w, 280), 760));
}

// Paso "bonito" para ejes (1, 2, 2.5, 5 × 10^n).
export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
