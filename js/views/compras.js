// Listas de compras: generar a partir de la dieta, historial con casillas, total del ticket.
import * as S from '../store.js';
import { h, btn, iconBtn, field, numInput, textInput, select, checkbox, toggle, modal, confirmDialog, toast, empty, icon, fmtDate } from '../ui.js';
import { unitOf, collapse, fmtIn, isZeroVec, displayUnit, trimZeros } from '../units.js';
import {
  activePlan, rangeNeeds, purchaseVec, buyDim, packSize,
  isoDate, parseIsoDate, addDays, fmtMoney,
} from '../calc.js';
import { refresh, go } from '../nav.js';

const CURRENCIES = [{ value: 'MXN', label: 'MXN' }, { value: 'USD', label: 'USD' }];
const LIST_UNITS = [
  { value: 'pref', label: 'Unidad de cada ingrediente' },
  { value: 'metric', label: 'Gramos / kilos (auto)' },
  { value: 'g', label: 'Todo en gramos' },
  { value: 'kg', label: 'Todo en kilos' },
  { value: 'lb', label: 'Todo en libras' },
  { value: 'oz', label: 'Todo en onzas' },
];

let gen = null;

function newGen() {
  const plan = activePlan();
  return {
    planId: plan ? plan.id : '',
    start: isoDate(new Date()),
    days: 7,
    rows: {},
    open: new Set(),
  };
}

function pctTxt(n) {
  return trimZeros((Number(n) || 0).toFixed(1)) + '%';
}

// ---------- Cálculo de la lista ----------

export function computeRows(g) {
  const plan = S.get('plans', g.planId);
  if (!plan) return [];
  const start = parseIsoDate(g.start);
  const needs = rangeNeeds(plan, start, g.days);
  const out = [];
  for (const [ingId, slot] of Object.entries(needs)) {
    const ing = S.get('ingredients', ingId);
    if (!ing) continue;
    const ov = g.rows[ingId] || {};
    const mc = ov.mc ?? (Number(ing.mermaCrudo) || 0);
    const mk = ov.mk ?? (Number(ing.mermaCocido) || 0);
    const mg = ov.mg ?? (Number(ing.margen) || 0);
    const dim = buyDim(ing);
    const vec = purchaseVec(slot, mc, mk, mg);
    const { val: need, rest } = collapse(vec, ing, dim);
    const have = Math.max(0, ov.have ?? 0);
    let buy = Math.max(0, need - have);
    if (dim === 'pz') buy = Math.ceil(buy - 1e-9);
    const ps = packSize(ing);
    const packs = ps > 0 && buy > 0 ? Math.ceil(buy / ps - 1e-9) : 0;
    const covered = buy <= 1e-9 && isZeroVec(rest);
    out.push({
      ing, slot, mc, mk, mg, dim, need, rest, have, buy, ps, packs, covered,
      include: ov.include ?? !covered,
      usedIn: [...slot.usedIn],
      hasCooked: !isZeroVec(slot.cooked),
    });
  }
  const aisleOrder = {};
  S.sortedAisles().forEach((a, i) => { aisleOrder[a.id] = i; });
  out.sort((a, b) => (aisleOrder[a.ing.aisleId] ?? 999) - (aisleOrder[b.ing.aisleId] ?? 999) || S.byName(a.ing, b.ing));
  return out;
}

function restText(rest) {
  const parts = [];
  if (rest.g > 1e-9) parts.push(fmtIn(rest.g, 'g'));
  if (rest.ml > 1e-9) parts.push(fmtIn(rest.ml, 'ml'));
  if (rest.pz > 1e-9) parts.push(fmtIn(rest.pz, 'pz', { ceil: true }));
  return parts.join(' + ');
}

export function freeze(g, rows) {
  const plan = S.get('plans', g.planId);
  const aisles = S.sortedAisles();
  const items = rows.filter(r => r.include).map(r => {
    const a = S.get('aisles', r.ing.aisleId);
    return {
      id: S.uid(),
      ingId: r.ing.id,
      name: r.ing.name,
      aisleId: a ? a.id : '',
      aisleName: a ? a.name : 'Sin pasillo',
      aisleOrder: a ? aisles.indexOf(a) : 999,
      unit: r.ing.buyUnit || 'g',
      dim: r.dim,
      need: r.need,
      have: r.have,
      buy: r.buy,
      packName: r.ps ? (r.ing.pack.name || 'paquete') : '',
      packSize: r.ps || 0,
      packs: r.packs,
      extra: restText(r.rest),
      mermas: { crudo: r.mc, cocido: r.mk, extra: r.mg },
      usedIn: r.usedIn,
      checked: false,
      bought: null,
      note: '',
    };
  });
  // Foto de lo que tenías ese día (no se usa para la siguiente lista, solo para consultar).
  const inventory = rows.filter(r => r.have > 1e-9 || !r.include).map(r => ({
    ingId: r.ing.id,
    name: r.ing.name,
    unit: r.ing.buyUnit || 'g',
    need: r.need,
    have: r.have,
    status: r.covered && r.have > 1e-9 ? 'completo' : r.include ? 'parcial' : 'fuera',
  }));
  const start = parseIsoDate(g.start);
  return {
    name: 'Lista ' + fmtDate(start, { day: 'numeric', month: 'short' }),
    createdAt: Date.now(),
    planId: plan.id,
    planName: plan.name,
    start: g.start,
    days: g.days,
    items,
    inventory,
    extras: [],
    total: null,
    currency: S.settings().currency || 'MXN',
    status: 'open',
    closedAt: null,
  };
}

// ---------- Generador ----------

function generator() {
  if (!gen) gen = newGen();
  const plans = S.all('plans').sort(S.byName);
  if (!plans.length) return { title: 'Nueva lista', el: empty('Necesitas una dieta', null, btn('Ir a Dieta', () => go('dieta'), { kind: 'primary' })) };
  if (!S.get('plans', gen.planId)) gen.planId = (activePlan() || plans[0]).id;

  const rows = computeRows(gen);
  const setRow = (id, patch) => { gen.rows[id] = { ...(gen.rows[id] || {}), ...patch }; refresh(); };
  const start = parseIsoDate(gen.start);
  const end = addDays(start, gen.days - 1);
  const included = rows.filter(r => r.include);
  const covered = rows.filter(r => r.covered);

  let lastAisle = null;
  const list = [];
  rows.forEach(r => {
    const a = S.get('aisles', r.ing.aisleId);
    const an = a ? a.name : 'Sin pasillo';
    if (an !== lastAisle) { list.push(h('li', { class: 'gen-aisle' }, an)); lastAisle = an; }
    const u = unitOf(r.ing.buyUnit || 'g');
    const open = gen.open.has(r.ing.id);
    const details = h('details', {
      class: 'gen-details', open,
      ontoggle: e => { if (e.target.open) gen.open.add(r.ing.id); else gen.open.delete(r.ing.id); },
    },
    h('summary', null, 'Mermas y extra', h('span', { class: 'muted' }, ` · ${pctTxt(r.mc)} limpieza${r.hasCooked ? ` · ${pctTxt(r.mk)} cocción` : ''} · +${pctTxt(r.mg)}`)),
    h('div', { class: 'row-3' },
      field('Merma limpieza %', numInput(r.mc, v => setRow(r.ing.id, { mc: v || 0 }), { k: 'mc-' + r.ing.id })),
      field('Merma cocción %', numInput(r.mk, v => setRow(r.ing.id, { mk: v || 0 }), { k: 'mk-' + r.ing.id }), r.hasCooked ? null : 'Sin cantidades en cocido'),
      field('Extra %', numInput(r.mg, v => setRow(r.ing.id, { mg: v || 0 }), { k: 'mg-' + r.ing.id }))),
    btn('Guardar como predeterminado del ingrediente', () => {
      S.put('ingredients', { ...r.ing, mermaCrudo: r.mc, mermaCocido: r.mk, margen: r.mg });
      toast('Guardado en el ingrediente', 'ok');
    }, { small: true, kind: 'ghost' }));

    list.push(h('li', { class: 'gen-row' + (r.include ? '' : ' excluded') },
      h('div', { class: 'gen-top' },
        checkbox(r.include, v => setRow(r.ing.id, { include: v }), null, { k: 'inc-' + r.ing.id }),
        h('div', { class: 'gen-name' },
          h('strong', null, r.ing.name),
          h('span', { class: 'muted small' }, r.usedIn.join(', '))),
        h('div', { class: 'gen-buy' },
          r.covered ? h('span', { class: 'badge badge-ok' }, 'Ya lo tienes') : h('strong', null, r.packs ? `${r.packs} × ${r.ing.pack.name || 'paquete'}` : fmtIn(r.buy, r.ing.buyUnit, { ceil: true })),
          r.packs ? h('span', { class: 'muted small' }, fmtIn(r.buy, r.ing.buyUnit)) : null,
          r.rest && !isZeroVec(r.rest) ? h('span', { class: 'warn-text small', title: 'Define gramos por pieza en el ingrediente para convertir' }, '+ ' + restText(r.rest)) : null)),
      h('div', { class: 'gen-mid' },
        h('span', { class: 'muted small' }, 'Necesitas ', h('b', null, fmtIn(r.need, r.ing.buyUnit))),
        h('label', { class: 'have' },
          h('span', { class: 'muted small' }, 'Tienes'),
          numInput(r.have ? r.have / u.f : null, v => setRow(r.ing.id, { have: v == null ? 0 : Math.max(0, v * u.f), include: undefined }), { k: 'have-' + r.ing.id, label: 'Tienes', placeholder: '0' }),
          h('span', { class: 'small' }, u.label),
          r.have > 0
            ? iconBtn('x', 'No tengo nada', () => setRow(r.ing.id, { have: 0, include: undefined }), { cls: 'icon-btn-sm' })
            : btn('Lo tengo', () => setRow(r.ing.id, { have: r.need, include: undefined }), { small: true, kind: 'ghost', cls: 'btn-xs' }))),
      details));
  });

  const el = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, iconBtn('back', 'Volver', () => go('compras')), h('h2', { class: 'grow' }, 'Nueva lista de compras')),
    h('section', { class: 'card form-grid' },
      field('Dieta', select(plans.map(p => ({ value: p.id, label: p.name })), gen.planId, v => { gen.planId = v; refresh(); })),
      field('Primer día', h('input', { class: 'input', type: 'date', value: gen.start, 'data-k': 'g-start', onchange: e => { if (e.target.value) { gen.start = e.target.value; refresh(); } } })),
      field('Días', numInput(gen.days, v => { gen.days = Math.min(Math.max(Math.round(v || 7), 1), 90); refresh(); }, { k: 'g-days' }), `Del ${fmtDate(start, { day: 'numeric', month: 'short' })} al ${fmtDate(end, { day: 'numeric', month: 'short' })}`),
      h('p', { class: 'muted small span-2' }, 'Escribe cuánto tienes de cada ingrediente (o toca "Lo tengo") y la lista solo pedirá lo que falta. Desmarca lo que no quieras comprar.')),
    !rows.length
      ? empty('No hay nada que comprar', 'La dieta no tiene platillos con ingredientes en esos días.')
      : h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', null, `${included.length} de ${rows.length} ingredientes`),
          covered.length ? h('span', { class: 'muted small' }, `${covered.length} ya los tienes`) : null),
        h('ul', { class: 'gen-list' }, list)),
    rows.length ? h('div', { class: 'sticky-actions' },
      btn('Reiniciar ajustes', () => { gen = newGen(); refresh(); }, { kind: 'ghost' }),
      btn('Guardar lista', () => {
        if (!included.length) { toast('No hay ingredientes seleccionados', 'warn'); return; }
        const saved = S.put('lists', freeze(gen, rows));
        gen = null;
        toast('Lista guardada', 'ok');
        go('compras/' + saved.id);
      }, { kind: 'primary', icon: 'check' })) : null,
  );
  return { title: 'Nueva lista', el };
}

// ---------- Detalle de una lista ----------

function itemQtyText(it, pref) {
  const unit = displayUnit(it.unit, pref, it.buy);
  const main = it.packs ? `${it.packs} × ${it.packName}` : fmtIn(it.buy, unit, { ceil: true });
  const sub = it.packs ? fmtIn(it.buy, unit) : '';
  return { main, sub, unit };
}

function updateList(l, patch) {
  S.put('lists', { ...l, ...patch });
}

function updateItem(l, id, patch) {
  updateList(l, { items: l.items.map(it => it.id === id ? { ...it, ...patch } : it) });
}

function editItem(l, it) {
  const u = unitOf(it.unit);
  const d = { buy: it.buy / u.f, bought: it.bought == null ? null : it.bought / u.f, note: it.note || '', packs: it.packs };
  modal({
    title: it.name,
    body: h('div', { class: 'stack' },
      it.packSize ? field(`Presentaciones (${it.packName})`, numInput(d.packs, v => { d.packs = Math.max(0, Math.round(v || 0)); })) : null,
      field(`Cantidad a comprar (${u.label})`, numInput(d.buy, v => { d.buy = v || 0; })),
      field(`Lo que compraste realmente (${u.label})`, numInput(d.bought, v => { d.bought = v; }, { placeholder: 'Igual a la lista' }), 'Opcional: si compraste de más o de menos, para tu registro.'),
      field('Nota', textInput(d.note, v => { d.note = v; }, { placeholder: 'Ej. marca, precio…' })),
      h('p', { class: 'muted small' },
        `Necesitabas ${fmtIn(it.need, it.unit)} · tenías ${fmtIn(it.have, it.unit)}`,
        it.mermas ? ` · merma ${pctTxt(it.mermas.crudo)}, cocción ${pctTxt(it.mermas.cocido)}, extra ${pctTxt(it.mermas.extra)}` : '',
        it.usedIn && it.usedIn.length ? ` · ${it.usedIn.join(', ')}` : '')),
    actions: [
      {
        label: 'Quitar de la lista', kind: 'danger', icon: 'trash', onClick: async () => {
          updateList(l, { items: l.items.filter(x => x.id !== it.id) });
        },
      },
      {
        label: 'Guardar', kind: 'primary', onClick: () => {
          const fresh = S.get('lists', l.id) || l;
          let packs = it.packSize ? d.packs : 0;
          let buy = d.buy * u.f;
          // Si cambió el número de presentaciones, la cantidad sigue a las presentaciones.
          if (it.packSize && packs !== it.packs) buy = packs * it.packSize;
          updateItem(fresh, it.id, { buy, packs, bought: d.bought == null ? null : d.bought * u.f, note: d.note.trim() });
        },
      },
    ],
  });
}

function addCatalogItem(l) {
  const ings = S.all('ingredients').sort(S.byName);
  if (!ings.length) { toast('No tienes ingredientes', 'warn'); return; }
  let ingId = ings[0].id;
  let qty = null;
  const unitLabel = h('span', { class: 'muted' }, unitOf(ings[0].buyUnit).label);
  modal({
    title: 'Agregar ingrediente a la lista',
    body: h('div', { class: 'stack' },
      field('Ingrediente', select(ings.map(i => ({ value: i.id, label: i.name })), ingId, v => { ingId = v; unitLabel.textContent = unitOf(S.get('ingredients', v).buyUnit).label; })),
      h('div', { class: 'inline' }, field('Cantidad', numInput(qty, v => { qty = v; })), unitLabel)),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Agregar', kind: 'primary', onClick: () => {
          const ing = S.get('ingredients', ingId);
          const u = unitOf(ing.buyUnit || 'g');
          const a = S.get('aisles', ing.aisleId);
          const fresh = S.get('lists', l.id) || l;
          const buy = (qty || 0) * u.f;
          const ps = packSize(ing);
          updateList(fresh, {
            items: [...fresh.items, {
              id: S.uid(), ingId: ing.id, name: ing.name, aisleId: a ? a.id : '', aisleName: a ? a.name : 'Sin pasillo',
              aisleOrder: a ? S.sortedAisles().indexOf(a) : 999, unit: ing.buyUnit || 'g', dim: u.dim,
              need: buy, have: 0, buy, packName: ps ? (ing.pack.name || 'paquete') : '', packSize: ps,
              packs: ps && buy ? Math.ceil(buy / ps - 1e-9) : 0, extra: '', mermas: null, usedIn: [],
              checked: false, bought: null, note: '',
            }],
          });
        },
      },
    ],
  });
}

function closePurchase(l) {
  let total = l.total;
  let currency = l.currency || 'MXN';
  const unchecked = l.items.filter(it => !it.checked).length + (l.extras || []).filter(x => !x.checked).length;
  let markAll = true;
  modal({
    title: 'Cerrar compra',
    body: h('div', { class: 'stack' },
      h('div', { class: 'row-2' },
        field('Total del ticket', numInput(total, v => { total = v; }, { placeholder: '0.00' })),
        field('Moneda', select(CURRENCIES, currency, v => { currency = v; }))),
      unchecked ? toggle(markAll, v => { markAll = v; }, `Compré todo (${unchecked} sin marcar)`, 'Si lo apagas, lo no marcado queda como no comprado.') : null),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Cerrar compra', kind: 'primary', icon: 'check', onClick: () => {
          let fresh = S.get('lists', l.id) || l;
          if (markAll && unchecked) {
            fresh = {
              ...fresh,
              items: fresh.items.map(it => ({ ...it, checked: true })),
              extras: (fresh.extras || []).map(x => ({ ...x, checked: true })),
            };
          }
          updateList(fresh, { total, currency, status: 'closed', closedAt: Date.now() });
          toast('Compra cerrada', 'ok');
        },
      },
    ],
  });
}

function shareText(l, pref) {
  const lines = [`*${l.name}*`, `${l.days} días desde ${fmtDate(parseIsoDate(l.start), { day: 'numeric', month: 'short' })}`];
  for (const g of groupItems(l)) {
    lines.push('', `*${g.name.toUpperCase()}*`);
    g.items.forEach(it => {
      const q = itemQtyText(it, pref);
      lines.push(`${it.checked ? '☑' : '☐'} ${it.name} — ${q.main}${q.sub ? ` (${q.sub})` : ''}${it.extra ? ` + ${it.extra}` : ''}${it.note ? ` · ${it.note}` : ''}`);
    });
  }
  if ((l.extras || []).length) {
    lines.push('', '*OTROS*');
    l.extras.forEach(x => lines.push(`${x.checked ? '☑' : '☐'} ${x.text}`));
  }
  return lines.join('\n');
}

async function share(l, pref) {
  const text = shareText(l, pref);
  if (navigator.share) {
    try { await navigator.share({ title: l.name, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

function groupItems(l) {
  const current = {};
  S.sortedAisles().forEach((a, i) => { current[a.id] = i; });
  const groups = new Map();
  l.items.slice()
    .sort((a, b) => (current[a.aisleId] ?? (500 + (a.aisleOrder ?? 999))) - (current[b.aisleId] ?? (500 + (b.aisleOrder ?? 999))) || a.name.localeCompare(b.name, 'es'))
    .forEach(it => {
      const a = S.get('aisles', it.aisleId);
      const name = a ? a.name : it.aisleName;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(it);
    });
  return [...groups].map(([name, items]) => ({ name, items }));
}

function detail(id) {
  const l = S.get('lists', id);
  if (!l) return { title: 'Lista', el: empty('No se encontró la lista', null, btn('Volver', () => go('compras'), { icon: 'back' })) };
  const pref = S.pref('listUnit', 'pref');
  const hideChecked = S.pref('hideChecked', false);
  const done = l.items.filter(i => i.checked).length + (l.extras || []).filter(x => x.checked).length;
  const totalCount = l.items.length + (l.extras || []).length;
  const start = parseIsoDate(l.start);
  const end = addDays(start, l.days - 1);
  const closed = l.status === 'closed';
  let extraText = '';

  const itemRow = it => {
    const q = itemQtyText(it, pref);
    return h('li', { class: 'shop-item' + (it.checked ? ' checked' : '') },
      checkbox(it.checked, v => updateItem(S.get('lists', l.id), it.id, { checked: v }), null, { cls: 'check-lg', k: 'ck-' + it.id }),
      h('div', { class: 'shop-main', onclick: () => updateItem(S.get('lists', l.id), it.id, { checked: !it.checked }) },
        h('span', { class: 'shop-name' }, it.name),
        h('span', { class: 'shop-sub muted small' },
          it.have > 1e-9 ? `tienes ${fmtIn(it.have, displayUnit(it.unit, pref, it.have))}` : '',
          it.bought != null ? `${it.have > 1e-9 ? ' · ' : ''}compraste ${fmtIn(it.bought, displayUnit(it.unit, pref, it.bought))}` : '',
          it.note ? ` · ${it.note}` : '')),
      h('div', { class: 'shop-qty', onclick: () => editItem(S.get('lists', l.id), it) },
        h('strong', null, q.main),
        q.sub ? h('span', { class: 'muted small' }, q.sub) : null,
        it.extra ? h('span', { class: 'warn-text small' }, '+ ' + it.extra) : null),
      iconBtn('edit', 'Editar', () => editItem(S.get('lists', l.id), it), { cls: 'no-print' }));
  };

  const groups = groupItems(l);
  const extraInp = h('input', {
    class: 'input', placeholder: 'Agregar otra cosa (ej. jabón)', 'data-k': 'extra-new',
    oninput: e => { extraText = e.target.value; },
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addExtra(); } },
  });
  const addExtra = () => {
    const t = (extraText || extraInp.value).trim();
    if (!t) return;
    const fresh = S.get('lists', l.id);
    updateList(fresh, { extras: [...(fresh.extras || []), { id: S.uid(), text: t, checked: false }] });
    extraText = '';
    setTimeout(() => { const n = document.querySelector('[data-k="extra-new"]'); if (n) n.focus(); }, 30);
  };

  const el = h('div', { class: 'page shopping' },
    h('div', { class: 'page-head' },
      iconBtn('back', 'Volver', () => go('compras'), { cls: 'no-print' }),
      textInput(l.name, v => { if (v.trim()) updateList(l, { name: v.trim() }); }, { k: 'l-name', cls: 'input-title', label: 'Nombre de la lista' }),
      h('span', { class: 'badge ' + (closed ? '' : 'badge-ok') }, closed ? 'Cerrada' : 'Abierta')),
    h('p', { class: 'muted small' },
      `${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })} · ${l.days} días · ${l.planName}`),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': totalCount, 'aria-valuenow': done },
      h('div', { class: 'progress-bar', style: { width: totalCount ? (done / totalCount * 100) + '%' : '0%' } }),
      h('span', { class: 'progress-text' }, `${done} de ${totalCount}`)),
    h('div', { class: 'toolbar list-tools no-print' },
      select(LIST_UNITS, pref, v => { S.setPref('listUnit', v); refresh(); }, { label: 'Unidades', cls: 'grow-0' }),
      btn(hideChecked ? 'Mostrar marcados' : 'Ocultar marcados', () => { S.setPref('hideChecked', !hideChecked); refresh(); }, { kind: 'ghost', icon: hideChecked ? 'eye' : 'eyeOff' }),
      btn('Compartir', () => share(l, pref), { kind: 'ghost', icon: 'share' }),
      btn('Imprimir', () => window.print(), { kind: 'ghost', icon: 'print' })),
    groups.map(g => {
      const items = hideChecked ? g.items.filter(i => !i.checked) : g.items;
      if (!items.length) return null;
      return h('section', { class: 'group' },
        h('h2', { class: 'group-title' }, g.name, h('span', { class: 'count' }, `${g.items.filter(i => i.checked).length}/${g.items.length}`)),
        h('ul', { class: 'shop-list' }, items.map(itemRow)));
    }),
    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Otros'),
      h('ul', { class: 'shop-list' }, (l.extras || []).filter(x => !(hideChecked && x.checked)).map(x => h('li', { class: 'shop-item' + (x.checked ? ' checked' : '') },
        checkbox(x.checked, v => {
          const fresh = S.get('lists', l.id);
          updateList(fresh, { extras: fresh.extras.map(e => e.id === x.id ? { ...e, checked: v } : e) });
        }, null, { cls: 'check-lg' }),
        h('div', { class: 'shop-main' }, h('span', { class: 'shop-name' }, x.text)),
        iconBtn('x', 'Quitar', () => {
          const fresh = S.get('lists', l.id);
          updateList(fresh, { extras: fresh.extras.filter(e => e.id !== x.id) });
        }, { cls: 'no-print' })))),
      h('div', { class: 'inline no-print' }, extraInp, btn('Agregar', addExtra, { icon: 'plus', kind: 'ghost' })),
      h('div', { class: 'btn-row no-print' }, btn('Agregar ingrediente del catálogo', () => addCatalogItem(l), { kind: 'ghost', small: true, icon: 'leaf' }))),
    inventorySection(l, pref),
    h('section', { class: 'card ticket' },
      h('h2', null, 'Ticket'),
      h('div', { class: 'row-2' },
        field('Total', numInput(l.total, v => updateList(S.get('lists', l.id), { total: v }), { k: 'l-total', placeholder: '0.00' })),
        field('Moneda', select(CURRENCIES, l.currency || 'MXN', v => updateList(S.get('lists', l.id), { currency: v }), { k: 'l-cur' }))),
      l.total ? h('p', { class: 'ticket-total' }, fmtMoney(l.total, l.currency || 'MXN')) : null,
      closed ? h('p', { class: 'muted small' }, `Cerrada el ${fmtDate(l.closedAt)}`) : null),
    h('div', { class: 'btn-row end no-print' },
      closed
        ? btn('Reabrir', () => updateList(l, { status: 'open' }), { kind: 'ghost' })
        : btn('Cerrar compra', () => closePurchase(l), { kind: 'primary', icon: 'check' }),
      btn('Eliminar lista', async () => {
        if (!(await confirmDialog(`Se eliminará "${l.name}" del historial.`, { ok: 'Eliminar', danger: true }))) return;
        S.remove('lists', l.id);
        go('compras');
      }, { kind: 'danger', icon: 'trash' })),
  );
  return { title: l.name, el };
}

// Lo que tenías al generar la lista. Las listas viejas solo guardaban lo de los artículos.
function listInventory(l) {
  if (Array.isArray(l.inventory)) return l.inventory;
  return l.items.filter(it => it.have > 1e-9).map(it => ({ ingId: it.ingId, name: it.name, unit: it.unit, need: it.need, have: it.have, status: 'parcial' }));
}

const INV_STATUS = {
  completo: { label: 'Lo tenías completo', cls: 'badge-ok' },
  parcial: { label: 'Compraste el resto', cls: '' },
  fuera: { label: 'No lo compraste', cls: '' },
};

function inventorySection(l, pref) {
  const inv = listInventory(l).slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!inv.length) return null;
  return h('section', { class: 'card inventory' },
    h('details', { class: 'help' },
      h('summary', null, `Lo que tenías al hacer la lista (${inv.length})`),
      h('ul', { class: 'rows' }, inv.map(x => {
        const st = INV_STATUS[x.status] || INV_STATUS.parcial;
        const u = displayUnit(x.unit, pref, x.need);
        return h('li', { class: 'row' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, x.name),
            h('div', { class: 'row-sub' }, x.have > 1e-9 ? `Tenías ${fmtIn(x.have, u)} · necesitabas ${fmtIn(x.need, u)}` : `Necesitabas ${fmtIn(x.need, u)}`)),
          h('span', { class: 'badge ' + st.cls }, st.label));
      }))));
}

// ---------- Historial ----------

function history() {
  const lists = S.all('lists').sort((a, b) => (b.start || '').localeCompare(a.start || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      h('p', { class: 'muted grow' }, 'Genera tu lista a partir de la dieta. Se guarda con fecha para que veas qué compraste y cuánto gastaste.'),
      btn('Nueva lista', () => { gen = null; go('compras/nueva'); }, { kind: 'primary', icon: 'plus' })),
    !lists.length
      ? empty('Aún no tienes listas', null, btn('Generar mi primera lista', () => { gen = null; go('compras/nueva'); }, { kind: 'primary', icon: 'cart' }))
      : h('div', { class: 'cards' }, lists.map(l => {
        const done = l.items.filter(i => i.checked).length;
        const start = parseIsoDate(l.start);
        return h('article', { class: 'card card-link', onclick: () => go('compras/' + l.id) },
          h('div', { class: 'card-head' },
            h('h3', null, l.name),
            h('span', { class: 'badge ' + (l.status === 'closed' ? '' : 'badge-ok') }, l.status === 'closed' ? 'Cerrada' : 'Abierta')),
          h('p', { class: 'muted small' }, `${fmtDate(start, { day: 'numeric', month: 'short', year: 'numeric' })} · ${l.days} días · ${l.planName}`),
          h('div', { class: 'progress small-progress' },
            h('div', { class: 'progress-bar', style: { width: l.items.length ? (done / l.items.length * 100) + '%' : '0%' } }),
            h('span', { class: 'progress-text' }, `${done}/${l.items.length}`)),
          l.total ? h('p', { class: 'ticket-total small-total' }, fmtMoney(l.total, l.currency || 'MXN')) : null,
          listInventory(l).length ? h('p', { class: 'muted small' }, `Tenías ${listInventory(l).length} ingrediente${listInventory(l).length === 1 ? '' : 's'}`) : null);
      })),
  );
  return { title: 'Compras', el };
}

export function render(params) {
  if (params[0] === 'nueva') return generator();
  if (params[0]) return detail(params[0]);
  return history();
}
