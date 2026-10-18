// Progreso: peso y medidas, cumplimiento de la dieta, promedios e historial.
import * as S from '../store.js';
import { h, btn, iconBtn, field, numInput, segmented, modal, confirmDialog, toast, fmtDate, chartWidth, niceStep, select } from '../ui.js';
import { isoDate, parseIsoDate, addDays, startOfDay, dayMacros, activePlan, anyMacros, fmtMoney, WEEK_ORDER, DAY_SHORT } from '../calc.js';
import { trimZeros } from '../units.js';
import { bodyEntries, weightIn, weightToKg, lengthIn, lengthToCm, dayStats, recentLogs, streak, getLog, periods, periodStats, addHistoryEntry, moveHistoryEntry } from '../tracking.js';
import { openDay } from './hoy.js';
import { go } from '../nav.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function fmt1(n) {
  return trimZeros((Math.round(n * 10) / 10).toFixed(1));
}

function signed(n, unit) {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fmt1(Math.abs(r))} ${unit}`;
}

// ---------- Peso ----------

function openBodyEditor(entry) {
  const unit = S.settings().weightUnit || 'kg';
  const lenUnit = unit === 'lb' ? 'in' : 'cm';
  const d = {
    date: entry ? entry.date : isoDate(new Date()),
    weight: entry && entry.weight != null ? weightIn(entry.weight, unit) : null,
    waist: entry && entry.waist != null ? lengthIn(entry.waist, unit) : null,
    fat: entry ? entry.fat : null,
    note: entry ? entry.note || '' : '',
  };
  const dateInp = h('input', { class: 'input', type: 'date', value: d.date });
  const noteInp = h('input', { class: 'input', value: d.note, placeholder: 'Opcional' });
  modal({
    title: entry ? 'Editar registro' : 'Registrar peso y medidas',
    body: h('div', { class: 'stack' },
      field('Fecha', dateInp),
      h('div', { class: 'row-2' },
        field(`Peso (${unit})`, numInput(d.weight, v => { d.weight = v; })),
        field(`Cintura (${lenUnit})`, numInput(d.waist, v => { d.waist = v; }, { placeholder: 'Opcional' }))),
      field('% de grasa', numInput(d.fat, v => { d.fat = v; }, { placeholder: 'Opcional' })),
      field('Nota', noteInp)),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary', onClick: () => {
          if (!dateInp.value) { toast('Elige una fecha', 'warn'); return false; }
          if (d.weight == null && d.waist == null && d.fat == null) { toast('Captura al menos un dato', 'warn'); return false; }
          if ((d.weight != null && d.weight <= 0) || (d.waist != null && d.waist <= 0) || (d.fat != null && (d.fat <= 0 || d.fat >= 100))) {
            toast('Revisa los valores', 'warn'); return false;
          }
          S.put('body', {
            ...(entry || {}),
            date: dateInp.value,
            weight: d.weight == null ? null : weightToKg(d.weight, unit),
            waist: d.waist == null ? null : lengthToCm(d.waist, unit),
            fat: d.fat == null ? null : d.fat,
            note: noteInp.value.trim(),
          });
          toast('Registro guardado', 'ok');
        },
      },
    ],
  });
}

function lineChart(points, unit) {
  const W = chartWidth(), H = W < 500 ? 200 : 240, padL = 44, padR = 12, padT = 14, padB = 28;
  const xs = points.map(p => p.t);
  const ys = points.map(p => p.v);
  const step = niceStep(Math.max(Math.max(...ys) - Math.min(...ys), 1) / 3);
  const minY = Math.floor(Math.min(...ys) / step) * step - (Math.min(...ys) % step === 0 ? step : 0);
  const maxY = Math.ceil(Math.max(...ys) / step) * step + (Math.max(...ys) % step === 0 ? step : 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = t => padL + (maxX === minX ? iw / 2 : ((t - minX) / (maxX - minX)) * iw);
  const y = v => padT + ih - ((v - minY) / (maxY - minY)) * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': `Peso en ${unit}` });
  for (let v = minY; v <= maxY + 1e-9; v += step) {
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid' }));
    const t = svgEl('text', { x: padL - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' });
    t.textContent = fmt1(v);
    svg.appendChild(t);
  }
  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1];
  // De derecha a izquierda, saltando fechas que se encimarían.
  const keep = [];
  [...new Set(labelIdx)].reverse().forEach(i => {
    if (!keep.length || x(points[keep[keep.length - 1]].t) - x(points[i].t) >= 56) keep.push(i);
  });
  keep.forEach(i => {
    const t = svgEl('text', { x: x(points[i].t), y: H - 8, class: 'axis', 'text-anchor': i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle' });
    t.textContent = fmtDate(points[i].t, { day: 'numeric', month: 'short' });
    svg.appendChild(t);
  });
  svg.appendChild(svgEl('path', { d: points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.v)}`).join(' '), class: 'line' }));
  const dots = points.map(p => {
    const c = svgEl('circle', { cx: x(p.t), cy: y(p.v), r: 4, class: 'dot' });
    svg.appendChild(c);
    return c;
  });

  const tip = h('div', { class: 'chart-tip', hidden: true });
  const overlay = svgEl('rect', { x: padL, y: padT, width: iw, height: ih, class: 'hit' });
  const show = clientX => {
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.t) - vx) < Math.abs(x(points[best].t) - vx)) best = i; });
    const p = points[best];
    dots.forEach((d, i) => d.classList.toggle('active', i === best));
    tip.hidden = false;
    tip.replaceChildren(h('strong', null, `${fmt1(p.v)} ${unit}`), h('span', { class: 'muted' }, fmtDate(p.t, { day: 'numeric', month: 'short', year: 'numeric' })));
    tip.style.left = Math.min(Math.max((x(p.t) / W) * rect.width, 60), rect.width - 60) + 'px';
    tip.style.top = ((y(p.v) / H) * rect.height) + 'px';
  };
  overlay.addEventListener('mousemove', e => show(e.clientX));
  overlay.addEventListener('click', e => show(e.clientX));
  overlay.addEventListener('mouseleave', () => { tip.hidden = true; dots.forEach(d => d.classList.remove('active')); });
  svg.appendChild(overlay);
  return h('div', { class: 'chart' }, svg, tip);
}

function weightSection() {
  const unit = S.settings().weightUnit || 'kg';
  const lenUnit = unit === 'lb' ? 'in' : 'cm';
  const entries = bodyEntries();
  const withWeight = entries.filter(e => e.weight != null);
  const points = withWeight.map(e => ({ t: parseIsoDate(e.date).getTime(), v: weightIn(e.weight, unit) }));

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', null, `Peso (${unit})`),
      h('div', { class: 'btn-row' },
        segmented([{ value: 'kg', label: 'kg / cm' }, { value: 'lb', label: 'lb / in' }], unit, v => S.setSettings({ weightUnit: v })),
        btn('Registrar', () => openBodyEditor(null), { kind: 'primary', small: true, icon: 'plus' }))),
    points.length >= 2 ? lineChart(points, unit)
      : h('p', { class: 'muted small' }, points.length ? 'Registra otro peso para ver tu gráfica.' : 'Registra tu peso (por ejemplo, una vez por semana en ayunas) para ver cómo avanzas.'),
    entries.length ? h('details', { class: 'help' },
      h('summary', null, `Ver registros (${entries.length})`),
      h('ul', { class: 'rows' }, entries.slice().reverse().map(e => h('li', { class: 'row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, fmtDate(parseIsoDate(e.date), { day: 'numeric', month: 'short', year: 'numeric' })),
          h('div', { class: 'row-sub' },
            [e.weight != null ? `${fmt1(weightIn(e.weight, unit))} ${unit}` : null,
              e.waist != null ? `cintura ${fmt1(lengthIn(e.waist, unit))} ${lenUnit}` : null,
              e.fat != null ? `${fmt1(e.fat)}% grasa` : null,
              e.note || null].filter(Boolean).join(' · '))),
        h('div', { class: 'row-actions' },
          iconBtn('edit', 'Editar', () => openBodyEditor(e)),
          iconBtn('trash', 'Eliminar', async () => {
            if (await confirmDialog('Se eliminará este registro.', { ok: 'Eliminar', danger: true })) S.remove('body', e.id);
          }, { kind: 'danger' }))))))
      : null);
}

// ---------- Dietas que has seguido ----------

function shortDate(iso) {
  return fmtDate(parseIsoDate(iso), { day: 'numeric', month: 'short', year: 'numeric' });
}

function openHistoryEditor(period) {
  const plans = S.all('plans').sort(S.byName);
  if (!plans.length) { toast('Primero crea una dieta', 'warn'); return; }
  const today = isoDate(new Date());
  let planId = period ? period.planId : plans[0].id;
  const dateInp = h('input', { class: 'input', type: 'date', max: today, value: period ? period.start : today });
  modal({
    title: period ? 'Cambiar inicio de la dieta' : 'Agregar una dieta anterior',
    body: h('div', { class: 'stack' },
      period ? h('p', { class: 'muted small' }, period.planName)
        : field('Dieta', select(plans.map(p => ({ value: p.id, label: p.name })), planId, v => { planId = v; })),
      field('Empezó el', dateInp, 'La dieta dura hasta que empieza la siguiente.')),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary', onClick: () => {
          const iso = dateInp.value;
          if (!iso || iso > today) { toast('Elige una fecha de hoy o antes', 'warn'); return false; }
          if (period) moveHistoryEntry(period.entries[0], iso);
          else addHistoryEntry(iso, planId);
          toast('Historial actualizado', 'ok');
        },
      },
    ],
  });
}

function dietsSection() {
  const list = periods().slice().reverse();
  const unit = S.settings().weightUnit || 'kg';
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', null, 'Dietas que has seguido'),
      btn('Agregar', () => openHistoryEditor(null), { small: true, kind: 'ghost', icon: 'plus' })),
    !list.length ? h('p', { class: 'muted small' }, 'Cuando cambies de dieta activa quedará registrado aquí, con tu avance en cada una.')
      : h('ul', { class: 'periods' }, list.map(p => {
        const st = periodStats(p);
        const spend = Object.entries(st.spend).map(([c, v]) => fmtMoney(v, c)).join(' + ');
        const dw = st.weightCount >= 2 ? weightIn(st.weightEnd - st.weightStart, unit) : null;
        return h('li', { class: 'period' + (p.current ? ' current' : '') },
          h('div', { class: 'card-head' },
            h('div', null,
              h('h3', null, p.planName, p.current ? h('span', { class: 'badge badge-ok' }, 'Actual') : null, !p.exists ? h('span', { class: 'badge' }, 'eliminada') : null),
              h('p', { class: 'muted small' }, `${shortDate(p.start)} – ${p.current ? 'hoy' : shortDate(p.end)} · ${p.days} día${p.days === 1 ? '' : 's'}`)),
            h('div', { class: 'row-actions' },
              iconBtn('edit', 'Cambiar fecha de inicio', () => openHistoryEditor(p)),
              iconBtn('trash', 'Quitar del historial', async () => {
                if (!(await confirmDialog('Se quitará este periodo del historial (tus datos no se borran).', { ok: 'Quitar', danger: true }))) return;
                p.entries.forEach(e => S.remove('planHistory', e.id));
              }, { kind: 'danger' }))),
          h('div', { class: 'period-stats' },
            h('div', null, h('span', { class: 'muted small' }, 'Cumplimiento'), h('strong', null, st.adherence == null ? '—' : Math.round(st.adherence * 100) + '%')),
            h('div', null, h('span', { class: 'muted small' }, 'Peso'), h('strong', null, dw == null ? '—' : signed(dw, unit))),
            h('div', null, h('span', { class: 'muted small' }, 'Kcal/día'), h('strong', null, st.kcal == null ? '—' : String(Math.round(st.kcal)))),
            h('div', null, h('span', { class: 'muted small' }, 'Gasto'), h('strong', null, spend || '—'))));
      })));
}

// ---------- Cumplimiento ----------

const WEEKS = 12;

function heatClass(stats) {
  if (!stats || !stats.total) return 'heat-none';
  if (stats.done === stats.total) return 'heat-4';
  if (stats.pct >= 0.5) return 'heat-3';
  if (stats.pct > 0) return 'heat-2';
  return 'heat-1';
}

function adherenceSection() {
  const today = startOfDay(new Date());
  // Empieza en lunes, WEEKS semanas atrás.
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - (WEEKS - 1) * 7);
  const cols = [];
  for (let w = 0; w < WEEKS; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const iso = isoDate(date);
      const fut = date > today;
      const log = getLog(iso);
      const st = log ? dayStats(log) : null;
      const label = `${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${st && st.total ? `${st.done} de ${st.total} comidas` : 'sin registro'}`;
      cells.push(h('button', {
        type: 'button', class: 'heat-cell ' + (fut ? 'heat-future' : heatClass(st)) + (iso === isoDate(today) ? ' heat-today' : ''),
        title: label, 'aria-label': label, disabled: fut,
        onclick: () => { openDay(iso); go('hoy'); },
      }));
    }
    cols.push(h('div', { class: 'heat-col' }, cells));
  }

  const last7 = recentLogs(7).map(r => (r.log ? dayStats(r.log) : null)).filter(s => s && s.total);
  const last30 = recentLogs(30).map(r => (r.log ? dayStats(r.log) : null)).filter(s => s && s.total);
  const pct = arr => (arr.length ? Math.round((arr.reduce((s, x) => s + x.done, 0) / arr.reduce((s, x) => s + x.total, 0)) * 100) : null);

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', null, 'Cumplimiento'),
      h('span', { class: 'muted small' }, 'Marca "Lo comí" en Hoy')),
    h('div', { class: 'mini-stats' },
      h('div', null, h('span', { class: 'stat-value' }, pct(last7) == null ? '—' : pct(last7) + '%'), h('span', { class: 'muted small' }, 'últimos 7 días')),
      h('div', null, h('span', { class: 'stat-value' }, pct(last30) == null ? '—' : pct(last30) + '%'), h('span', { class: 'muted small' }, 'últimos 30 días')),
      h('div', null, h('span', { class: 'stat-value' }, String(streak())), h('span', { class: 'muted small' }, 'días seguidos al 100%'))),
    h('div', { class: 'heatmap' },
      h('div', { class: 'heat-days' }, WEEK_ORDER.map(d => h('span', null, DAY_SHORT[d].charAt(0)))),
      h('div', { class: 'heat-grid' }, cols)),
    h('div', { class: 'heat-legend' },
      [['heat-none', 'Sin registro'], ['heat-1', '0%'], ['heat-2', 'Menos de 50%'], ['heat-3', '50% o más'], ['heat-4', '100%']]
        .map(([c, t]) => h('span', { class: 'legend-item' }, h('span', { class: 'heat-cell ' + c }), t))));
}

// ---------- Promedios ----------

function averagesSection() {
  if (!anyMacros()) return null;
  const logs = recentLogs(7).map(r => r.log).filter(Boolean).map(dayStats).filter(s => s.total && (s.done || s.swapped));
  const plan = activePlan();
  let target = null;
  if (plan) {
    const totals = [0, 1, 2, 3, 4, 5, 6].map(wd => dayMacros(plan, wd));
    target = { kcal: totals.reduce((s, m) => s + m.kcal, 0) / 7, prot: totals.reduce((s, m) => s + m.prot, 0) / 7 };
  }
  const avg = k => (logs.length ? logs.reduce((s, x) => s + x[k], 0) / logs.length : null);
  const row = (label, k, unit) => h('div', { class: 'avg-row' },
    h('span', null, label),
    h('strong', null, avg(k) == null ? '—' : `${Math.round(avg(k))} ${unit}`),
    target && target[k] ? h('span', { class: 'muted small' }, `meta ${Math.round(target[k])} ${unit}`) : null);
  return h('section', { class: 'card' },
    h('h2', null, 'Promedio diario (últimos 7 días)'),
    h('p', { class: 'muted small' }, logs.length ? `Según lo que marcaste como comido en ${logs.length} día${logs.length === 1 ? '' : 's'}.` : 'Aún no marcas comidas en los últimos 7 días.'),
    row('Calorías', 'kcal', 'kcal'),
    row('Proteína', 'prot', 'g'),
    row('Carbohidratos', 'carb', 'g'),
    row('Grasa', 'fat', 'g'));
}

// ---------- Historial ----------

function historySection() {
  const unit = S.settings().weightUnit || 'kg';
  const events = [];
  bodyEntries().forEach(e => events.push({
    t: parseIsoDate(e.date).getTime() + 1, kind: 'Peso',
    text: [e.weight != null ? `${fmt1(weightIn(e.weight, unit))} ${unit}` : null, e.fat != null ? `${fmt1(e.fat)}% grasa` : null].filter(Boolean).join(' · ') || 'Medidas',
  }));
  S.all('lists').filter(l => l.status === 'closed').forEach(l => events.push({
    t: l.closedAt || l.createdAt, kind: 'Compra', text: `${l.name}${Number(l.total) > 0 ? ' · ' + fmtMoney(l.total, l.currency || 'MXN') : ''}`, href: '#/compras/' + l.id,
  }));
  S.all('logs').filter(l => l.note).forEach(l => events.push({ t: parseIsoDate(l.date).getTime() + 2, kind: 'Nota', text: l.note }));
  S.all('logs').forEach(l => Object.entries(l.swaps || {}).forEach(([mid, sw]) => {
    if (!sw) return;
    const meal = (l.meals || []).find(m => m.id === mid);
    events.push({ t: parseIsoDate(l.date).getTime() + 3, kind: 'Otra comida', text: `${meal ? meal.name + ': ' : ''}${sw.text}${sw.kcal ? ` · ${Math.round(sw.kcal)} kcal` : ''}` });
  }));
  events.sort((a, b) => b.t - a.t);
  const shown = events.slice(0, 40);

  return h('section', { class: 'card' },
    h('h2', null, 'Historial'),
    !shown.length ? h('p', { class: 'muted small' }, 'Aquí aparecerán tus registros de peso, compras y notas del día.')
      : h('ol', { class: 'history' }, shown.map(e => h('li', { class: 'history-item' },
        h('span', { class: 'history-date muted small' }, fmtDate(e.t, { day: 'numeric', month: 'short' })),
        h('span', { class: 'badge' }, e.kind),
        e.href ? h('a', { href: e.href, class: 'history-text' }, e.text) : h('span', { class: 'history-text pre' }, e.text)))));
}

// ---------- Pantalla ----------

export function render() {
  const unit = S.settings().weightUnit || 'kg';
  const withWeight = bodyEntries().filter(e => e.weight != null);
  const first = withWeight[0];
  const last = withWeight[withWeight.length - 1];
  const monthAgo = addDays(startOfDay(new Date()), -30);
  const base30 = withWeight.filter(e => parseIsoDate(e.date) <= monthAgo).pop() || first;

  const el = h('div', { class: 'page' },
    h('div', { class: 'stats' },
      stat('Peso actual', last ? `${fmt1(weightIn(last.weight, unit))} ${unit}` : '—', last ? fmtDate(parseIsoDate(last.date), { day: 'numeric', month: 'short' }) : 'sin registros'),
      stat('Cambio total', first && last && first !== last ? signed(weightIn(last.weight - first.weight, unit), unit) : '—', first ? `desde ${fmtDate(parseIsoDate(first.date), { day: 'numeric', month: 'short' })}` : null),
      stat('Últimos 30 días', base30 && last && base30 !== last ? signed(weightIn(last.weight - base30.weight, unit), unit) : '—'),
      stat('Racha', `${streak()} días`, 'con todas tus comidas')),
    weightSection(),
    dietsSection(),
    adherenceSection(),
    averagesSection(),
    historySection(),
  );
  return { title: 'Progreso', el };
}

function stat(label, value, hint) {
  return h('div', { class: 'stat card' },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, value),
    hint ? h('span', { class: 'muted small' }, hint) : null);
}

