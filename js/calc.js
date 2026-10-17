// Cálculos de dieta: menú por día, necesidades por periodo, mermas y macros.
import * as S from './store.js';
import { toVec, addVec, scaleVec, zero, collapse, unitOf } from './units.js';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ---------- Fechas ----------

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isoDate(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

export function parseIsoDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

// ---------- Menú ----------

function byTime(a, b) {
  return (a.time || '99:99').localeCompare(b.time || '99:99');
}

// Comidas de un plan para un día de la semana (0 = domingo), con las personalizaciones del día.
export function mealsFor(plan, wd) {
  const ov = (plan.overrides && wd != null && plan.overrides[wd]) || {};
  return (plan.meals || []).slice().sort(byTime).map(m => {
    const overridden = Object.prototype.hasOwnProperty.call(ov, m.id);
    return { ...m, entries: overridden ? ov[m.id] : (m.entries || []), overridden };
  });
}

export function activePlan() {
  const st = S.settings();
  return S.get('plans', st.activePlanId) || S.all('plans').sort(S.byName)[0] || null;
}

// ---------- Necesidades ----------

// Acumula lo que se come en un día: por ingrediente, separando lo que se pesa crudo y cocido.
export function addDayNeeds(plan, wd, acc) {
  for (const meal of mealsFor(plan, wd)) {
    for (const e of meal.entries) {
      const r = S.get('recipes', e.recipeId);
      if (!r) continue;
      const factor = Number(e.factor) > 0 ? Number(e.factor) : 1;
      for (const it of r.items || []) {
        if (!S.get('ingredients', it.ingId)) continue;
        const v = scaleVec(toVec(it.qty, it.unit), factor);
        const slot = acc[it.ingId] || (acc[it.ingId] = { raw: zero(), cooked: zero(), usedIn: new Set() });
        if (it.cocido) slot.cooked = addVec(slot.cooked, v);
        else slot.raw = addVec(slot.raw, v);
        slot.usedIn.add(meal.name || 'Comida');
      }
    }
  }
  return acc;
}

export function rangeNeeds(plan, start, days) {
  const acc = {};
  if (!plan) return acc;
  const s = startOfDay(start);
  for (let i = 0; i < days; i++) addDayNeeds(plan, addDays(s, i).getDay(), acc);
  return acc;
}

function pct(n) {
  const x = Number(n) || 0;
  return Math.min(Math.max(x, 0), 95) / 100;
}

// Cantidad a comprar (antes de restar lo que ya tienes):
//   lo cocido se convierte a crudo con la merma de cocción, luego se aplica la merma
//   de limpieza (cáscara, hueso…) y al final el margen extra.
export function purchaseVec(slot, mermaCrudo, mermaCocido, margen) {
  const cooked = scaleVec(slot.cooked, 1 / (1 - pct(mermaCocido)));
  const edible = addVec(slot.raw, cooked);
  const bought = scaleVec(edible, 1 / (1 - pct(mermaCrudo)));
  return scaleVec(bought, 1 + (Math.max(Number(margen) || 0, 0) / 100));
}

export function buyDim(ing) {
  return unitOf(ing.buyUnit || 'g').dim;
}

// Tamaño de la presentación expresado en la dimensión de compra del ingrediente.
export function packSize(ing) {
  const p = ing.pack;
  if (!p || !(Number(p.size) > 0)) return 0;
  const { val, rest } = collapse(toVec(p.size, p.unit), ing, buyDim(ing));
  return rest.g || rest.ml || rest.pz ? 0 : val;
}

// ---------- Macros ----------

export const MACROS = [
  { key: 'kcal', label: 'kcal', unit: '' },
  { key: 'prot', label: 'Proteína', short: 'P', unit: 'g' },
  { key: 'carb', label: 'Carbohidratos', short: 'C', unit: 'g' },
  { key: 'fat', label: 'Grasa', short: 'G', unit: 'g' },
];

export function zeroMacros() {
  return { kcal: 0, prot: 0, carb: 0, fat: 0, missing: false };
}

export function addMacros(a, b) {
  return {
    kcal: a.kcal + b.kcal, prot: a.prot + b.prot, carb: a.carb + b.carb, fat: a.fat + b.fat,
    missing: a.missing || b.missing,
  };
}

export function lineMacros(it, factor = 1) {
  const ing = S.get('ingredients', it.ingId);
  const m = zeroMacros();
  if (!ing) return m;
  const mac = ing.macros || {};
  const has = ['kcal', 'prot', 'carb', 'fat'].some(k => Number(mac[k]) > 0);
  if (!has) { m.missing = true; return m; }
  const { val, rest } = collapse(scaleVec(toVec(it.qty, it.unit), factor), ing, 'g');
  if (rest.pz) m.missing = true;
  const k = val / 100;
  m.kcal = (Number(mac.kcal) || 0) * k;
  m.prot = (Number(mac.prot) || 0) * k;
  m.carb = (Number(mac.carb) || 0) * k;
  m.fat = (Number(mac.fat) || 0) * k;
  return m;
}

export function recipeMacros(r, factor = 1) {
  let m = zeroMacros();
  for (const it of (r && r.items) || []) m = addMacros(m, lineMacros(it, factor));
  return m;
}

export function entriesMacros(entries) {
  let m = zeroMacros();
  for (const e of entries || []) {
    const r = S.get('recipes', e.recipeId);
    if (r) m = addMacros(m, recipeMacros(r, Number(e.factor) > 0 ? Number(e.factor) : 1));
  }
  return m;
}

export function dayMacros(plan, wd) {
  let m = zeroMacros();
  for (const meal of mealsFor(plan, wd)) m = addMacros(m, entriesMacros(meal.entries));
  return m;
}

export function anyMacros() {
  return S.all('ingredients').some(i => i.macros && ['kcal', 'prot', 'carb', 'fat'].some(k => Number(i.macros[k]) > 0));
}

// ---------- Dinero ----------

export function fmtMoney(n, cur = 'MXN') {
  const v = Number(n) || 0;
  const s = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${v < 0 ? '-' : ''}$${s} ${cur}`;
}
