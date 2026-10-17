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

// El plan que aplica a un día: el que quedó registrado ese día, o el activo.
export function planForDay(iso) {
  const log = getLog(iso);
  return (log && S.get('plans', log.planId)) || activePlan();
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
    eaten: { ...((prev && prev.eaten) || {}) }, note: (prev && prev.note) || '',
    ...patch,
  });
}

export function setEaten(iso, mealId, value) {
  const prev = getLog(iso);
  return writeLog(iso, { eaten: { ...((prev && prev.eaten) || {}), [mealId]: !!value } });
}

export function setAllEaten(iso, mealIds, value) {
  const prev = getLog(iso);
  const eaten = { ...((prev && prev.eaten) || {}) };
  mealIds.forEach(id => { eaten[id] = !!value; });
  return writeLog(iso, { eaten });
}

export function setDayNote(iso, note) {
  return writeLog(iso, { note });
}

export function dayStats(log) {
  const meals = ((log && log.meals) || []).filter(m => !m.empty);
  const eaten = (log && log.eaten) || {};
  const done = meals.filter(m => eaten[m.id]);
  const sum = k => done.reduce((s, m) => s + (Number(m[k]) || 0), 0);
  return {
    total: meals.length,
    done: done.length,
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
