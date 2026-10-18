// Registro diario (comidas hechas) y peso/medidas.
import * as S from './store.js';
import { activePlan, mealsFor, entriesMacros, parseIsoDate, isoDate, startOfDay, addDays } from './calc.js';

// ---------- Comidas hechas ----------

export function logId(iso) {
  return 'day-' + iso;
}

export function getLog(iso) {
  return S.get('logs', logId(iso));
}

function snapshotMeals(plan, wd) {
  return mealsFor(plan, wd).map(m => {
    const mac = entriesMacros(m.entries);
    return {
      id: m.id, name: m.name, time: m.time || '', empty: !m.entries.length,
      kcal: mac.kcal, prot: mac.prot, carb: mac.carb, fat: mac.fat,
    };
  });
}

// El plan que aplica a un día: hoy, la dieta activa; otros días, la que quedó registrada
// ese día o la que marcaba el historial de dietas en esa fecha.
export function planForDay(iso) {
  if (iso >= isoDate(new Date())) return activePlan();
  const log = getLog(iso);
  const fromLog = log && S.get('plans', log.planId);
  if (fromLog) return fromLog;
  const h = entryAt(iso);
  return (h && S.get('plans', h.planId)) || activePlan();
}

// ---------- Historial de dietas ----------

export function historyEntries() {
  return S.all('planHistory').sort((a, b) => a.date.localeCompare(b.date));
}

function entryAt(iso) {
  let found = null;
  for (const e of historyEntries()) {
    if (e.date <= iso) found = e; else break;
  }
  return found;
}

export function addHistoryEntry(iso, planId) {
  const plan = S.get('plans', planId);
  return S.put('planHistory', { id: 'ph-' + iso, date: iso, planId, planName: plan ? plan.name : '' });
}

// Cambia la dieta activa y lo anota en el historial (una entrada por día).
export function setActivePlan(planId) {
  S.setSettings({ activePlanId: planId });
  if (!planId) return;
  const today = isoDate(new Date());
  const prev = entryAt(isoDate(addDays(new Date(), -1)));
  if (prev && prev.planId === planId) {
    // Se regresó a la dieta de ayer el mismo día: no es un cambio nuevo.
    if (S.get('planHistory', 'ph-' + today)) S.remove('planHistory', 'ph-' + today, false);
    return;
  }
  addHistoryEntry(today, planId);
}

export function moveHistoryEntry(entry, newIso) {
  if (!newIso || newIso === entry.date) return;
  S.remove('planHistory', entry.id, false);
  addHistoryEntry(newIso, entry.planId);
}

// Crea el historial la primera vez a partir de los días registrados (o con la dieta activa).
export function ensureHistory() {
  if (S.all('planHistory').length) return;
  const logs = S.all('logs').sort((a, b) => a.date.localeCompare(b.date));
  let last = null;
  const recs = [];
  for (const l of logs) {
    if (l.planId && l.planId !== last) {
      recs.push({ id: 'ph-' + l.date, date: l.date, planId: l.planId, planName: l.planName || '' });
      last = l.planId;
    }
  }
  const active = activePlan();
  if (active && last !== active.id) {
    const iso = recs.length ? isoDate(new Date()) : (logs[0] ? logs[0].date : isoDate(new Date()));
    recs.push({ id: 'ph-' + iso, date: iso, planId: active.id, planName: active.name });
  }
  if (recs.length) S.putMany('planHistory', recs);
}

// Periodos continuos con la misma dieta.
export function periods() {
  const today = isoDate(new Date());
  const entries = historyEntries().filter(e => e.date <= today);
  const out = [];
  entries.forEach(e => {
    const prev = out[out.length - 1];
    if (prev && prev.planId === e.planId) { prev.entries.push(e); return; }
    out.push({ planId: e.planId, start: e.date, entries: [e] });
  });
  out.forEach((p, i) => {
    const next = out[i + 1];
    p.end = next ? isoDate(addDays(parseIsoDate(next.start), -1)) : today;
    p.current = !next;
    const plan = S.get('plans', p.planId);
    p.planName = plan ? plan.name : (p.entries[0].planName || 'Dieta eliminada');
    p.exists = !!plan;
    p.days = Math.round((parseIsoDate(p.end) - parseIsoDate(p.start)) / 86400000) + 1;
  });
  return out;
}

export function periodStats(p) {
  const inRange = iso => iso >= p.start && iso <= p.end;
  const logs = S.all('logs').filter(l => inRange(l.date)).map(dayStats).filter(s => s.total);
  const done = logs.reduce((s, x) => s + x.done, 0);
  const total = logs.reduce((s, x) => s + x.total, 0);
  const eatenDays = logs.filter(x => x.done || x.swapped);
  const body = bodyEntries().filter(b => inRange(b.date) && b.weight != null);
  const spend = {};
  S.all('lists').filter(l => l.status === 'closed' && Number(l.total) > 0 && inRange(isoDate(new Date(l.closedAt || l.createdAt))))
    .forEach(l => { const c = l.currency || 'MXN'; spend[c] = (spend[c] || 0) + Number(l.total); });
  return {
    loggedDays: logs.length,
    adherence: total ? done / total : null,
    kcal: eatenDays.length ? eatenDays.reduce((s, x) => s + x.kcal, 0) / eatenDays.length : null,
    prot: eatenDays.length ? eatenDays.reduce((s, x) => s + x.prot, 0) / eatenDays.length : null,
    weightStart: body.length ? body[0].weight : null,
    weightEnd: body.length ? body[body.length - 1].weight : null,
    weightCount: body.length,
    spend,
  };
}

function writeLog(iso, patch) {
  const prev = getLog(iso);
  const plan = planForDay(iso);
  if (!plan) return null;
  const wd = parseIsoDate(iso).getDay();
  const today = iso === isoDate(new Date());
  // El día de hoy siempre refleja la dieta actual; los días pasados quedan congelados.
  const meals = !prev || today || !prev.meals ? snapshotMeals(plan, wd) : prev.meals;
  return S.put('logs', {
    id: logId(iso), date: iso, planId: plan.id, planName: plan.name, meals,
    eaten: { ...((prev && prev.eaten) || {}) }, swaps: { ...((prev && prev.swaps) || {}) }, note: (prev && prev.note) || '',
    ...patch,
  });
}

// Marcar "Lo comí" quita el reemplazo de esa comida (son excluyentes).
export function setEaten(iso, mealId, value) {
  const prev = getLog(iso);
  const swaps = { ...((prev && prev.swaps) || {}) };
  if (value) delete swaps[mealId];
  return writeLog(iso, { eaten: { ...((prev && prev.eaten) || {}), [mealId]: !!value }, swaps });
}

// "Marcar todo" respeta las comidas que reemplazaste por otra cosa.
export function setAllEaten(iso, mealIds, value) {
  const prev = getLog(iso);
  const eaten = { ...((prev && prev.eaten) || {}) };
  const swaps = (prev && prev.swaps) || {};
  mealIds.forEach(id => { if (!(value && swaps[id])) eaten[id] = !!value; });
  return writeLog(iso, { eaten });
}

// Reemplazo: lo que comiste en lugar de la comida del plan, con macros opcionales.
export function setSwap(iso, mealId, swap) {
  const prev = getLog(iso);
  const swaps = { ...((prev && prev.swaps) || {}) };
  const eaten = { ...((prev && prev.eaten) || {}) };
  if (swap) {
    swaps[mealId] = {
      text: String(swap.text || '').trim(),
      kcal: Number(swap.kcal) > 0 ? Number(swap.kcal) : 0,
      prot: Number(swap.prot) > 0 ? Number(swap.prot) : 0,
      carb: Number(swap.carb) > 0 ? Number(swap.carb) : 0,
      fat: Number(swap.fat) > 0 ? Number(swap.fat) : 0,
    };
    eaten[mealId] = false;
  } else delete swaps[mealId];
  return writeLog(iso, { swaps, eaten });
}

export function setDayNote(iso, note) {
  return writeLog(iso, { note });
}

// Cumplimiento: solo cuentan las comidas del plan. Las reemplazadas no cumplen,
// pero sus macros sí se suman a lo que comiste.
export function dayStats(log) {
  const meals = ((log && log.meals) || []).filter(m => !m.empty);
  const eaten = (log && log.eaten) || {};
  const swaps = (log && log.swaps) || {};
  const done = meals.filter(m => eaten[m.id] && !swaps[m.id]);
  const swapped = Object.values(swaps).filter(Boolean);
  const sum = k => done.reduce((s, m) => s + (Number(m[k]) || 0), 0) + swapped.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  return {
    total: meals.length,
    done: done.length,
    swapped: swapped.length,
    pct: meals.length ? done.length / meals.length : 0,
    kcal: sum('kcal'), prot: sum('prot'), carb: sum('carb'), fat: sum('fat'),
  };
}

// Registros de los últimos `days` días (hasta hoy), uno por día; null si no hay registro.
export function recentLogs(days, until = new Date()) {
  const end = startOfDay(until);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    const iso = isoDate(d);
    out.push({ iso, date: d, log: getLog(iso) });
  }
  return out;
}

// Días seguidos (hasta ayer u hoy) con todas las comidas marcadas.
export function streak(until = new Date()) {
  let n = 0;
  let d = startOfDay(until);
  const todayStats = dayStats(getLog(isoDate(d)));
  if (!(todayStats.total && todayStats.done === todayStats.total)) d = addDays(d, -1);
  for (let i = 0; i < 3650; i++) {
    const s = dayStats(getLog(isoDate(d)));
    if (s.total && s.done === s.total) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}

// ---------- Peso y medidas ----------

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function bodyEntries() {
  return S.all('body').sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.updatedAt || 0) - (b.updatedAt || 0));
}

export function weightIn(kg, unit) {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function weightToKg(v, unit) {
  return unit === 'lb' ? v * KG_PER_LB : v;
}

export function lengthIn(cm, unit) {
  return unit === 'lb' ? cm / CM_PER_IN : cm;
}

export function lengthToCm(v, unit) {
  return unit === 'lb' ? v * CM_PER_IN : v;
}
