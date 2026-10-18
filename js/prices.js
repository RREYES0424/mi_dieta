// Precios: se capturan en las listas de compras y se promedian las últimas compras
// de cada ingrediente para estimar cuánto cuesta una lista, un platillo o un día de dieta.
import * as S from './store.js';
import { zero, collapse, unitOf, toVec, scaleVec, isZeroVec } from './units.js';
import { buyDim, purchaseVec, mealsFor, fmtMoney } from './calc.js';

export const AVG_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export function avgN() {
  return Math.max(1, Number(S.settings().priceAvgN) || 3);
}

// Cantidad que realmente se compró de un artículo (en su unidad base).
export function boughtQty(it) {
  if (it.bought != null) return it.bought;
  if (it.packs && it.packSize) return it.packs * it.packSize;
  return it.buy;
}

let index = { version: -1, map: {} };

// Todas las compras con precio, por ingrediente, de la más reciente a la más vieja.
function entriesByIngredient() {
  if (index.version === S.getVersion()) return index.map;
  const map = {};
  for (const l of S.all('lists')) {
    for (const it of l.items || []) {
      const price = Number(it.price);
      if (!it.ingId || !(price > 0)) continue;
      const q = boughtQty(it);
      if (!(q > 0)) continue;
      (map[it.ingId] || (map[it.ingId] = [])).push({
        date: l.closedAt || l.createdAt, per: price / q, dim: it.dim, unit: it.unit,
        currency: l.currency || 'MXN', price, qty: q, listId: l.id, listName: l.name,
      });
    }
  }
  Object.values(map).forEach(arr => arr.sort((a, b) => b.date - a.date));
  index = { version: S.getVersion(), map };
  return map;
}

export function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  const rate = Number(S.settings().exchangeRate) || 0;
  if (!rate) return null;
  return from === 'USD' ? amount * rate : amount / rate;
}

// Precio por unidad base de `fromDim` → precio por unidad base de `toDim`.
function perInDim(per, fromDim, toDim, ing) {
  if (fromDim === toDim) return per;
  const v = zero();
  v[toDim] = 1;
  const { val, rest } = collapse(v, ing, fromDim);
  if (!isZeroVec(rest)) return null;
  return per * val;
}

function mean(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

// Precio estimado de un ingrediente por unidad base de su unidad de compra.
// Usa el promedio de las últimas N compras; si no hay, el precio de referencia.
export function priceInfo(ing, currency = S.settings().currency || 'MXN') {
  if (!ing) return null;
  const dim = buyDim(ing);
  const N = avgN();
  const entries = (entriesByIngredient()[ing.id] || []).map(e => {
    const p = perInDim(e.per, e.dim, dim, ing);
    const c = p == null ? null : convertCurrency(p, e.currency, currency);
    return c == null ? null : { ...e, perTarget: c };
  }).filter(Boolean);
  if (entries.length) {
    const lastN = entries.slice(0, N).map(e => e.perTarget);
    const values = entries.map(e => e.perTarget);
    const older = entries.slice(1, N + 1).map(e => e.perTarget);
    return {
      per: mean(lastN), n: lastN.length, total: entries.length,
      last: entries[0].perTarget, lastDate: entries[0].date,
      prev: older.length ? mean(older) : null,
      min: Math.min(...values), max: Math.max(...values),
      source: 'historial', entries, currency, dim,
    };
  }
  const ref = Number(ing.refPrice);
  if (ref > 0) {
    const per = convertCurrency(ref / unitOf(ing.buyUnit || 'g').f, ing.refCurrency || 'MXN', currency);
    if (per != null) return { per, n: 0, total: 0, source: 'referencia', entries: [], currency, dim };
  }
  return null;
}

// Costo de una cantidad (en unidad base de la dimensión de compra).
export function costOf(ing, baseQty, currency) {
  const pi = priceInfo(ing, currency);
  return pi ? pi.per * baseQty : null;
}

// Precio por unidad; gramos y mililitros se muestran por kilo y por litro para que se lean mejor.
export function fmtUnitPrice(per, unit, currency) {
  const shown = unit === 'g' ? 'kg' : unit === 'ml' ? 'l' : (unit || 'g');
  const u = unitOf(shown);
  return `${fmtMoney(per * u.f, currency)} / ${u.label}`;
}

// Costo de lo que se usa (con mermas, sin el % extra) de una lista de líneas de platillo.
function itemsCost(items, factor, currency) {
  let total = 0, missing = 0, priced = 0;
  for (const it of items || []) {
    const ing = S.get('ingredients', it.ingId);
    if (!ing) continue;
    const v = scaleVec(toVec(it.qty, it.unit), factor);
    const slot = it.cocido ? { raw: zero(), cooked: v } : { raw: v, cooked: zero() };
    const { val, rest } = collapse(purchaseVec(slot, ing.mermaCrudo, ing.mermaCocido, 0), ing, buyDim(ing));
    const c = costOf(ing, val, currency);
    if (c == null || !isZeroVec(rest)) { missing++; if (c != null) total += c; continue; }
    total += c;
    priced++;
  }
  return { total, missing, priced };
}

export function recipeCost(r, factor = 1, currency = S.settings().currency || 'MXN') {
  return itemsCost(r && r.items, factor, currency);
}

export function entriesCost(entries, currency = S.settings().currency || 'MXN') {
  const out = { total: 0, missing: 0, priced: 0 };
  for (const e of entries || []) {
    const r = S.get('recipes', e.recipeId);
    if (!r) continue;
    const c = recipeCost(r, Number(e.factor) > 0 ? Number(e.factor) : 1, currency);
    out.total += c.total; out.missing += c.missing; out.priced += c.priced;
  }
  return out;
}

export function dayCost(plan, wd, currency = S.settings().currency || 'MXN') {
  const out = { total: 0, missing: 0, priced: 0 };
  for (const m of mealsFor(plan, wd)) {
    const c = entriesCost(m.entries, currency);
    out.total += c.total; out.missing += c.missing; out.priced += c.priced;
  }
  return out;
}

export function anyPrices() {
  return S.all('lists').some(l => (l.items || []).some(it => Number(it.price) > 0)) ||
    S.all('ingredients').some(i => Number(i.refPrice) > 0);
}

// Texto corto de costo: "≈ $45.00 MXN" (con aviso si faltan precios).
export function costText(c, currency) {
  if (!c || (!c.priced && !c.total)) return '';
  return `≈ ${fmtMoney(c.total, currency)}${c.missing ? ' (faltan precios)' : ''}`;
}
