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

// Lista desplegable propia (no usa el control del sistema). Misma forma de uso que antes:
// options = [{ value, label, disabled }] o grupos { group, options: [...] }.
export function select(options, value, onChange, opts = {}) {
  return dropdown(options, value, onChange, opts);
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
  else { form.setAttribute('tabindex', '-1'); form.focus({ preventScroll: true }); }
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

// ======================================================================
// Controles propios: ventana flotante, lista desplegable, autocompletar,
// calendario y selector de hora.
// ======================================================================

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEK_HEAD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

let currentPop = null;

export function closePopover() {
  if (currentPop) currentPop.close();
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Muestra `content` junto a `anchor`. En pantallas angostas sale como panel desde abajo.
export function openPopover(anchor, content, { onClose, title, minWidth = 200, width: fixedWidth = 0, sheet: allowSheet = true } = {}) {
  closePopover();
  const host = anchor.closest('dialog') || document.body;
  const sheet = allowSheet && window.innerWidth < 560;
  const pop = h('div', { class: 'pop' + (sheet ? ' pop-sheet' : '') },
    sheet && title ? h('div', { class: 'pop-title' }, title) : null,
    content);
  const backdrop = sheet ? h('div', { class: 'pop-backdrop' }) : null;
  let closed = false;

  const position = () => {
    if (sheet) return;
    const r = anchor.getBoundingClientRect();
    const width = fixedWidth ? Math.min(fixedWidth, window.innerWidth - 16) : Math.max(r.width, minWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    pop.style.width = width + 'px';
    pop.style.left = left + 'px';
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const cap = fixedWidth ? 480 : 360;
    const natural = Math.min(pop.scrollHeight, cap);
    if (below < natural && above > below) {
      pop.style.maxHeight = Math.min(cap, above) + 'px';
      pop.style.top = Math.max(8, r.top - Math.min(natural, above) - 4) + 'px';
    } else {
      pop.style.maxHeight = Math.min(cap, Math.max(below, 160)) + 'px';
      pop.style.top = (r.bottom + 4) + 'px';
    }
  };
  const onDown = e => {
    if (pop.contains(e.target) || anchor.contains(e.target)) return;
    close();
  };
  const onScroll = e => { if (!pop.contains(e.target)) position(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); anchor.focus && anchor.focus(); }
  };
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
    pop.remove();
    if (backdrop) backdrop.remove();
    if (currentPop && currentPop.pop === pop) currentPop = null;
    if (onClose) onClose();
  }
  if (backdrop) { backdrop.addEventListener('click', close); host.appendChild(backdrop); }
  host.appendChild(pop);
  position();
  setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', close);
  document.addEventListener('keydown', onKey, true);
  currentPop = { pop, close, position };
  return currentPop;
}

function flattenOptions(options) {
  const out = [];
  for (const o of options) {
    if (o.group) o.options.forEach(x => out.push({ ...x, value: String(x.value), groupLabel: o.group }));
    else out.push({ ...o, value: String(o.value) });
  }
  return out;
}

// Lista desplegable.
export function dropdown(options, value, onChange, opts = {}) {
  const flat = flattenOptions(options);
  let cur = value == null ? '' : String(value);
  const label = h('span', { class: 'dd-label' });
  const btn = h('button', {
    type: 'button', class: 'input dd ' + (opts.cls || ''), 'data-k': opts.k, 'aria-label': opts.label,
    'aria-haspopup': 'listbox', 'aria-expanded': 'false',
  }, label, icon('down', 'dd-chev'));
  const setLabel = () => {
    const o = flat.find(x => x.value === cur);
    label.textContent = o ? o.label : (opts.placeholder || 'Elegir…');
    btn.dataset.value = cur;
    btn.classList.toggle('dd-empty', !o);
  };
  Object.defineProperty(btn, 'value', { get: () => cur, set: v => { cur = v == null ? '' : String(v); setLabel(); } });
  setLabel();

  const open = () => {
    let query = '';
    let shown = flat;
    let active = Math.max(0, shown.findIndex(o => o.value === cur));
    const list = h('ul', { class: 'pop-list', role: 'listbox', tabindex: '-1' });
    const search = flat.length > 10
      ? h('input', { class: 'input pop-search', placeholder: 'Buscar…', autocomplete: 'off', 'aria-label': 'Buscar opción' })
      : null;
    const choose = o => {
      if (!o || o.disabled) return;
      pop.close();
      btn.focus({ preventScroll: true });
      if (o.value !== cur) { cur = o.value; setLabel(); onChange(cur); }
    };
    const draw = () => {
      let lastGroup = null;
      const kids = [];
      shown.forEach((o, i) => {
        if (o.groupLabel && o.groupLabel !== lastGroup) { kids.push(h('li', { class: 'pop-group' }, o.groupLabel)); lastGroup = o.groupLabel; }
        kids.push(h('li', {
          class: 'pop-opt' + (o.value === cur ? ' selected' : '') + (i === active ? ' active' : '') + (o.disabled ? ' disabled' : ''),
          role: 'option', 'aria-selected': String(o.value === cur), 'data-i': i, 'data-value': o.value,
          onpointerdown: e => e.preventDefault(),
          onclick: () => choose(o),
          onmousemove: () => { if (active !== i) { active = i; mark(); } },
        }, h('span', null, o.label), o.value === cur ? icon('check', 'pop-check') : null));
      });
      if (!shown.length) kids.push(h('li', { class: 'pop-empty' }, 'Sin resultados'));
      list.replaceChildren(...kids);
    };
    const mark = () => {
      list.querySelectorAll('.pop-opt').forEach(el => el.classList.toggle('active', Number(el.dataset.i) === active));
      const el = list.querySelector(`.pop-opt[data-i="${active}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    };
    const move = d => {
      if (!shown.length) return;
      let i = active;
      for (let n = 0; n < shown.length; n++) {
        i = (i + d + shown.length) % shown.length;
        if (!shown[i].disabled) break;
      }
      active = i;
      mark();
    };
    let typed = '', typedAt = 0;
    const onKeys = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
      else if (e.key === 'End') { e.preventDefault(); active = shown.length - 1; mark(); }
      else if (e.key === 'Enter' || (e.key === ' ' && !search)) { e.preventDefault(); choose(shown[active]); }
      else if (e.key === 'Tab') pop.close();
      else if (!search && e.key.length === 1) {
        const now = Date.now();
        typed = (now - typedAt > 700 ? '' : typed) + norm(e.key);
        typedAt = now;
        const i = shown.findIndex(o => norm(o.label).startsWith(typed));
        if (i >= 0) { active = i; mark(); }
      }
    };
    list.addEventListener('keydown', onKeys);
    if (search) {
      search.addEventListener('keydown', onKeys);
      search.addEventListener('input', () => {
        query = norm(search.value);
        shown = flat.filter(o => norm(o.label).includes(query));
        active = Math.max(0, shown.findIndex(o => !o.disabled));
        draw();
      });
    }
    draw();
    const pop = openPopover(btn, h('div', { class: 'pop-inner' }, search, list), {
      title: opts.label, onClose: () => btn.setAttribute('aria-expanded', 'false'),
    });
    btn.setAttribute('aria-expanded', 'true');
    mark();
    if (search && window.innerWidth >= 560) search.focus(); else list.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-expanded') === 'true') closePopover(); else open();
  });
  btn.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(); }
  });
  return btn;
}

// Campo de texto con sugerencias propias (reemplaza a <datalist>).
// onCommit(texto) se llama al elegir una sugerencia o al salir del campo con texto nuevo.
export function combo({ value = '', options = [], onCommit, onInput, placeholder = '', k, label, createLabel = t => `Crear «${t}»` }) {
  const input = h('input', {
    class: 'input combo', value, placeholder, 'data-k': k, 'aria-label': label, autocomplete: 'off',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', spellcheck: 'false',
  });
  let pop = null, items = [], active = -1, committed = value;
  const list = h('ul', { class: 'pop-list', role: 'listbox' });
  const commit = (v, picked) => {
    committed = v;
    if (onCommit) onCommit(v, picked);
  };
  const pick = it => {
    const v = it.create != null ? it.create : it;
    input.value = v;
    close();
    if (onInput) onInput(v);
    commit(v, true);
  };
  const draw = () => {
    list.replaceChildren(...items.map((it, i) => h('li', {
      class: 'pop-opt' + (i === active ? ' active' : '') + (it.create != null ? ' pop-create' : ''),
      role: 'option', 'data-i': i,
      onpointerdown: e => e.preventDefault(),
      onclick: () => pick(it),
      onmousemove: () => { if (active !== i) { active = i; draw(); } },
    }, it.create != null ? [icon('plus'), h('span', null, createLabel(it.create))] : h('span', null, it))));
    const el = list.querySelector('.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  };
  const refresh = () => {
    const q = norm(input.value);
    const exact = options.some(o => norm(o) === q);
    items = options.filter(o => !q || norm(o).includes(q))
      .sort((a, b) => (norm(a).startsWith(q) ? 0 : 1) - (norm(b).startsWith(q) ? 0 : 1))
      .slice(0, 60);
    if (q && !exact && createLabel) items.push({ create: input.value.trim() });
    active = q && items.length ? 0 : -1;
    if (!items.length) { close(); return; }
    draw();
    if (!pop) {
      pop = openPopover(input, h('div', { class: 'pop-inner' }, list), {
        title: label, sheet: false, onClose: () => { pop = null; input.setAttribute('aria-expanded', 'false'); },
      });
      input.setAttribute('aria-expanded', 'true');
    } else pop.position();
  };
  const close = () => { if (pop) pop.close(); };
  input.addEventListener('click', () => { if (!pop) refresh(); });
  input.addEventListener('input', () => { if (onInput) onInput(input.value); refresh(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!pop) refresh(); else { active = Math.min(items.length - 1, active + 1); draw(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
    else if (e.key === 'Enter' && pop && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(items[active]); }
    else if (e.key === 'Escape' && pop) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === input) return;
      close();
      const v = input.value.trim();
      if (v !== String(committed).trim()) commit(v, false);
    }, 120);
  });
  return input;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateOf(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Selector de fecha con calendario propio. El elemento tiene .value = 'AAAA-MM-DD' o ''.
export function dateInput(iso, onChange, opts = {}) {
  let cur = iso || '';
  const label = h('span', { class: 'dd-label' });
  const btn = h('button', { type: 'button', class: 'input dd date-btn ' + (opts.cls || ''), 'data-k': opts.k, 'aria-label': opts.label || 'Fecha', 'aria-haspopup': 'dialog' },
    icon('today', 'dd-lead'), label, icon('down', 'dd-chev'));
  const setLabel = () => {
    label.textContent = cur ? cap(dateOf(cur).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) : (opts.placeholder || 'Elegir fecha');
    btn.dataset.value = cur;
    btn.classList.toggle('dd-empty', !cur);
  };
  Object.defineProperty(btn, 'value', { get: () => cur, set: v => { cur = v || ''; setLabel(); } });
  setLabel();
  const allowed = d => (!opts.max || isoOf(d) <= opts.max) && (!opts.min || isoOf(d) >= opts.min);

  btn.addEventListener('click', () => {
    let view = cur ? dateOf(cur) : new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    let focusIso = cur || isoOf(new Date());
    const box = h('div', { class: 'cal' });
    const choose = d => {
      if (!allowed(d)) return;
      pop.close();
      btn.focus({ preventScroll: true });
      const v = isoOf(d);
      if (v !== cur) { cur = v; setLabel(); onChange(cur); }
    };
    const draw = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1);
      const offset = (first.getDay() + 6) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const today = isoOf(new Date());
      const cells = [];
      for (let i = 0; i < offset; i++) cells.push(h('span', { class: 'cal-pad' }));
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const di = isoOf(date);
        cells.push(h('button', {
          type: 'button', class: 'cal-day' + (di === cur ? ' selected' : '') + (di === today ? ' today' : '') + (di === focusIso ? ' focus' : ''),
          disabled: !allowed(date), 'data-iso': di, 'aria-label': date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          tabindex: di === focusIso ? '0' : '-1',
          onclick: () => choose(date),
        }, String(d)));
      }
      box.replaceChildren(
        h('div', { class: 'cal-head' },
          iconBtn('back', 'Mes anterior', () => { view = new Date(y, m - 1, 1); draw(); }, { cls: 'icon-btn-sm' }),
          h('strong', null, `${cap(MONTHS_LONG[m])} ${y}`),
          iconBtn('back', 'Mes siguiente', () => { view = new Date(y, m + 1, 1); draw(); }, { cls: 'icon-btn-sm flip' })),
        h('div', { class: 'cal-grid cal-week' }, WEEK_HEAD.map(w => h('span', null, w))),
        h('div', { class: 'cal-grid' }, cells),
        h('div', { class: 'cal-foot' },
          opts.clearable && cur ? btn2('Borrar', () => { pop.close(); cur = ''; setLabel(); onChange(''); }) : h('span'),
          allowed(new Date()) ? btn2('Hoy', () => choose(new Date())) : h('span')));
    };
    const btn2 = (t, fn) => h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: fn }, t);
    box.addEventListener('keydown', e => {
      const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (map[e.key] != null) {
        e.preventDefault();
        const d = dateOf(focusIso);
        d.setDate(d.getDate() + map[e.key]);
        focusIso = isoOf(d);
        view = new Date(d.getFullYear(), d.getMonth(), 1);
        draw();
        const el = box.querySelector('.cal-day.focus');
        if (el) el.focus();
      }
    });
    draw();
    const pop = openPopover(btn, box, { title: opts.label || 'Fecha', width: 312 });
    const el = box.querySelector('.cal-day.focus') || box.querySelector('.cal-day:not([disabled])');
    if (el && window.innerWidth >= 560) el.focus();
  });
  return btn;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Selector de hora propio (hora, minutos y a. m./p. m.). .value = 'HH:MM' o ''.
export function timeInput(hhmm, onChange, opts = {}) {
  let cur = hhmm || '';
  const label = h('span', { class: 'dd-label' });
  const btn = h('button', { type: 'button', class: 'input dd time-btn ' + (opts.cls || ''), 'data-k': opts.k, 'aria-label': opts.label || 'Hora', 'aria-haspopup': 'dialog' },
    icon('clock', 'dd-lead'), label);
  const setLabel = () => {
    label.textContent = cur ? fmtTime(cur) : (opts.placeholder || 'Sin hora');
    btn.dataset.value = cur;
    btn.classList.toggle('dd-empty', !cur);
  };
  Object.defineProperty(btn, 'value', { get: () => cur, set: v => { cur = v || ''; setLabel(); } });
  setLabel();

  btn.addEventListener('click', () => {
    const start = cur;
    let [H, M] = (cur || '07:00').split(':').map(Number);
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    if (!minutes.includes(M)) { minutes.push(M); minutes.sort((a, b) => a - b); }
    const box = h('div', { class: 'tp' });
    const set = (h24, m) => { H = h24; M = m; cur = `${pad2(H)}:${pad2(M)}`; setLabel(); draw(); };
    const col = (items, isSel, onPick, name) => h('ul', { class: 'tp-col', 'aria-label': name },
      items.map(it => h('li', null, h('button', {
        type: 'button', class: 'tp-opt' + (isSel(it) ? ' selected' : ''), onclick: () => onPick(it),
      }, it.label))));
    const draw = () => {
      const pm = H >= 12;
      const h12 = H % 12 === 0 ? 12 : H % 12;
      box.replaceChildren(
        h('div', { class: 'tp-cols' },
          col([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => ({ v: n, label: String(n) })), it => it.v === h12, it => set((it.v % 12) + (pm ? 12 : 0), M), 'Hora'),
          col(minutes.map(n => ({ v: n, label: pad2(n) })), it => it.v === M, it => set(H, it.v), 'Minutos'),
          col([{ v: 0, label: 'a. m.' }, { v: 1, label: 'p. m.' }], it => it.v === (pm ? 1 : 0), it => set((H % 12) + (it.v ? 12 : 0), M), 'Mañana o tarde')),
        h('div', { class: 'cal-foot' },
          opts.clearable !== false && cur ? h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => { cur = ''; setLabel(); pop.close(); } }, 'Quitar hora') : h('span'),
          h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => { if (!cur) { cur = `${pad2(H)}:${pad2(M)}`; setLabel(); } pop.close(); } }, 'Listo')));
      box.querySelectorAll('.tp-col').forEach(c => {
        const sel = c.querySelector('.selected');
        if (sel) c.scrollTop = sel.offsetTop - c.clientHeight / 2 + sel.offsetHeight / 2;
      });
    };
    draw();
    const pop = openPopover(btn, box, {
      title: opts.label || 'Hora', width: 300,
      onClose: () => { if (cur !== start) onChange(cur); },
    });
    requestAnimationFrame(() => box.querySelectorAll('.tp-col').forEach(c => {
      const sel = c.querySelector('.selected');
      if (sel) c.scrollTop = sel.offsetTop - c.clientHeight / 2 + sel.offsetHeight / 2;
    }));
  });
  return btn;
}
