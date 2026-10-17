// Gastos: totales de tickets por mes y semana, en MXN, USD o todo convertido a MXN.
import * as S from '../store.js';
import { h, select, numInput, field, empty, fmtDate } from '../ui.js';
import { fmtMoney, startOfDay, addDays } from '../calc.js';
import { refresh } from '../nav.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function purchases() {
  return S.all('lists')
    .filter(l => Number(l.total) > 0)
    .map(l => ({ id: l.id, name: l.name, date: new Date(l.closedAt || l.createdAt), total: Number(l.total), currency: l.currency || 'MXN' }))
    .sort((a, b) => b.date - a.date);
}

function amountIn(p, view, rate) {
  if (view === 'ALL') return p.currency === 'USD' ? p.total * rate : p.total;
  return p.currency === view ? p.total : 0;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

function shortMoney(v) {
  if (v >= 1000) return '$' + (Math.round(v / 100) / 10).toString() + 'k';
  return '$' + Math.round(v);
}

function barChart(data, cur) {
  const W = 720, H = 260, padL = 48, padR = 8, padT = 16, padB = 28;
  const max = niceMax(Math.max(...data.map(d => d.value), 0));
  const iw = W - padL - padR, ih = H - padT - padB;
  const slot = iw / data.length;
  const bw = Math.max(Math.min(slot - 8, 36), 6);
  const y = v => padT + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);

  const tip = h('div', { class: 'chart-tip', hidden: true });
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': `Gasto por mes en ${cur}` });
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  ticks.forEach(t => {
    svg.appendChild(mk('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: 'grid' }));
    const tx = mk('text', { x: padL - 6, y: y(t) + 4, class: 'axis', 'text-anchor': 'end' });
    tx.textContent = shortMoney(t);
    svg.appendChild(tx);
  });
  data.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const top = y(d.value);
    const hgt = Math.max(padT + ih - top, d.value > 0 ? 2 : 0);
    if (hgt > 0) {
      const r = Math.min(4, bw / 2, hgt);
      const x0 = cx - bw / 2, x1 = cx + bw / 2, yb = padT + ih, yt = yb - hgt;
      svg.appendChild(mk('path', {
        d: `M${x0},${yb} L${x0},${yt + r} Q${x0},${yt} ${x0 + r},${yt} L${x1 - r},${yt} Q${x1},${yt} ${x1},${yt + r} L${x1},${yb} Z`,
        class: 'bar' + (d.current ? ' bar-current' : ''),
      }));
    }
    const lx = mk('text', { x: cx, y: H - 8, class: 'axis', 'text-anchor': 'middle' });
    lx.textContent = d.label;
    svg.appendChild(lx);
    // Zona de interacción más grande que la barra.
    const hit = mk('rect', { x: padL + slot * i, y: padT, width: slot, height: ih, class: 'hit', tabindex: 0 });
    const show = () => {
      tip.hidden = false;
      tip.replaceChildren(h('strong', null, d.full), h('span', null, fmtMoney(d.value, cur)), d.count ? h('span', { class: 'muted' }, `${d.count} compra${d.count === 1 ? '' : 's'}`) : null);
      const rect = svg.getBoundingClientRect();
      const px = (cx / W) * rect.width;
      tip.style.left = Math.min(Math.max(px, 70), rect.width - 70) + 'px';
      tip.style.top = ((Math.min(top, padT + ih - 10) / H) * rect.height) + 'px';
      svg.querySelectorAll('.bar').forEach(b => b.classList.remove('hover'));
    };
    hit.addEventListener('mouseenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('click', show);
    hit.addEventListener('mouseleave', () => { tip.hidden = true; });
    hit.addEventListener('blur', () => { tip.hidden = true; });
    svg.appendChild(hit);
  });
  return h('div', { class: 'chart' }, svg, tip);
}

export function render() {
  const st = S.settings();
  const rate = Number(st.exchangeRate) || 0;
  let view = S.pref('spendView', st.currency || 'MXN');
  if (view === 'ALL' && !rate) view = 'MXN';
  const cur = view === 'ALL' ? 'MXN' : view;
  const all = purchases();

  const viewOpts = [
    { value: 'MXN', label: 'Solo MXN' },
    { value: 'USD', label: 'Solo USD' },
    { value: 'ALL', label: rate ? `Todo en MXN (1 USD = ${rate} MXN)` : 'Todo en MXN (define el tipo de cambio)', disabled: !rate },
  ];

  const now = new Date();
  const today = startOfDay(now);
  const sum = (from, to) => all.filter(p => p.date >= from && p.date < to).reduce((s, p) => s + amountIn(p, view, rate), 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const tomorrow = addDays(today, 1);
  const thisMonth = sum(monthStart, nextMonth);
  const last30 = sum(addDays(today, -29), tomorrow);
  const last12w = sum(addDays(today, -83), tomorrow);
  const first = all.length ? all[all.length - 1].date : today;
  const weeks = Math.min(12, Math.max(1, Math.ceil((tomorrow - startOfDay(first)) / (7 * 86400000))));
  const year = sum(yearStart, tomorrow);

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const b = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inRange = all.filter(p => p.date >= a && p.date < b && amountIn(p, view, rate) > 0);
    months.push({
      label: MONTHS[a.getMonth()],
      full: `${MONTHS[a.getMonth()]} ${a.getFullYear()}`,
      value: inRange.reduce((s, p) => s + amountIn(p, view, rate), 0),
      count: inRange.length,
      current: i === 0,
    });
  }
  const shown = all.filter(p => amountIn(p, view, rate) > 0);

  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      select(viewOpts, view, v => { S.setPref('spendView', v); refresh(); }, { label: 'Moneda', cls: 'grow-0' }),
      h('div', { class: 'inline' },
        field('Tipo de cambio (MXN por 1 USD)', numInput(rate || null, v => S.setSettings({ exchangeRate: v || 0 }), { k: 'rate', placeholder: 'Ej. 18.50' })))),
    !all.length
      ? empty('Aún no hay gastos', 'Captura el total del ticket en tus listas de compras para verlos aquí.')
      : [
        h('div', { class: 'stats' },
          stat('Este mes', fmtMoney(thisMonth, cur)),
          stat('Últimos 30 días', fmtMoney(last30, cur)),
          stat('Promedio por semana', fmtMoney(last12w / weeks, cur), weeks === 12 ? 'últimas 12 semanas' : `${weeks} semana${weeks === 1 ? '' : 's'} de historial`),
          stat(`En ${now.getFullYear()}`, fmtMoney(year, cur))),
        h('section', { class: 'card' },
          h('h2', null, `Gasto por mes (${cur})`),
          barChart(months, cur)),
        h('section', { class: 'card' },
          h('h2', null, 'Compras'),
          shown.length
            ? h('ul', { class: 'rows' }, shown.map(p => h('li', { class: 'row clickable', onclick: () => { location.hash = '#/compras/' + p.id; } },
              h('div', { class: 'row-main' },
                h('div', { class: 'row-title' }, p.name),
                h('div', { class: 'row-sub' }, fmtDate(p.date))),
              h('strong', { class: 'nowrap' }, fmtMoney(p.total, p.currency)))))
            : h('p', { class: 'muted' }, 'No hay compras en esta moneda.')),
      ],
  );
  return { title: 'Gastos', el };
}

function stat(label, value, hint) {
  return h('div', { class: 'stat card' },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, value),
    hint ? h('span', { class: 'muted small' }, hint) : null);
}
