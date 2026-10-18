// Búsqueda en toda la app: platillos, ingredientes, dietas, listas y notas.
import * as S from '../store.js';
import { h, icon, empty, fmtDate } from '../ui.js';
import { parseIsoDate } from '../calc.js';
import { openIngredientEditor } from './ingredientes.js';
import { openDay } from './hoy.js';
import { refresh, go } from '../nav.js';

let query = '';
const MAX = 8;

export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function ingName(id) {
  return (S.get('ingredients', id) || {}).name || '';
}

export function search(q) {
  const n = norm(q);
  if (!n) return null;
  const has = s => norm(s).includes(n);
  const res = { recipes: [], ingredients: [], plans: [], lists: [], notes: [] };

  for (const r of S.all('recipes').sort(S.byName)) {
    const ings = (r.items || []).map(it => ingName(it.ingId)).filter(has);
    if (has(r.name)) res.recipes.push({ r, why: r.archived ? 'archivado' : '' });
    else if (ings.length) res.recipes.push({ r, why: 'lleva ' + ings.join(', ') });
  }
  for (const i of S.all('ingredients').sort(S.byName)) if (has(i.name)) res.ingredients.push({ i });
  const recipeHit = new Set(res.recipes.map(x => x.r.id));
  for (const p of S.all('plans').sort(S.byName)) {
    if (has(p.name)) { res.plans.push({ p, why: '' }); continue; }
    const names = new Set();
    for (const m of p.meals || []) for (const e of m.entries || []) if (recipeHit.has(e.recipeId)) names.add(`${m.name}: ${(S.get('recipes', e.recipeId) || {}).name}`);
    if (names.size) res.plans.push({ p, why: [...names].slice(0, 3).join(' · ') });
  }
  for (const l of S.all('lists').sort((a, b) => (b.start || '').localeCompare(a.start || ''))) {
    const items = (l.items || []).filter(it => has(it.name)).map(it => it.name)
      .concat((l.extras || []).filter(x => has(x.text)).map(x => x.text));
    if (has(l.name) || has(l.planName)) res.lists.push({ l, why: '' });
    else if (items.length) res.lists.push({ l, why: 'incluye ' + items.join(', ') });
  }
  for (const d of S.all('logs').sort((a, b) => b.date.localeCompare(a.date))) {
    if (d.note && has(d.note)) res.notes.push({ kind: 'Nota del día', date: d.date, text: d.note, day: d.date });
    for (const sw of Object.values(d.swaps || {})) if (sw && has(sw.text)) res.notes.push({ kind: 'Comí otra cosa', date: d.date, text: sw.text, day: d.date });
  }
  for (const b of S.all('body').sort((a, b2) => b2.date.localeCompare(a.date))) if (b.note && has(b.note)) res.notes.push({ kind: 'Peso', date: b.date, text: b.note });
  return res;
}

function group(title, items, row) {
  if (!items.length) return null;
  return h('section', { class: 'group' },
    h('h2', { class: 'group-title' }, title, h('span', { class: 'count' }, String(items.length))),
    h('ul', { class: 'rows' }, items.slice(0, MAX).map(row)),
    items.length > MAX ? h('p', { class: 'muted small' }, `y ${items.length - MAX} más…`) : null);
}

function row(title, sub, onclick) {
  return h('li', { class: 'row clickable', onclick },
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), sub ? h('div', { class: 'row-sub' }, sub) : null),
    icon('back', 'flip muted'));
}

export function render() {
  const res = search(query);
  const input = h('input', {
    class: 'input', type: 'search', placeholder: 'Busca platillos, ingredientes, dietas, listas o notas…',
    value: query, 'data-k': 'global-search', autofocus: true, enterkeyhint: 'search',
    oninput: e => { query = e.target.value; refresh(); },
  });
  setTimeout(() => { if (document.activeElement !== input && !query) input.focus(); }, 30);
  const total = res ? Object.values(res).reduce((s, a) => s + a.length, 0) : 0;

  const el = h('div', { class: 'page' },
    h('div', { class: 'search search-big' }, icon('search'), input),
    !res ? h('p', { class: 'muted small' }, 'Tip: busca un ingrediente (por ejemplo "pechuga") para ver en qué platillos, dietas y listas aparece.')
      : !total ? empty('Sin resultados', `No encontré nada con "${query}".`)
        : [
          group('Platillos', res.recipes, x => row(x.r.name, x.why, () => go('platillos/' + x.r.id))),
          group('Ingredientes', res.ingredients, x => row(x.i.name, null, () => openIngredientEditor(x.i))),
          group('Dietas', res.plans, x => row(x.p.name, x.why, () => go('dieta/' + x.p.id))),
          group('Listas de compras', res.lists, x => row(x.l.name, [fmtDate(parseIsoDate(x.l.start), { day: 'numeric', month: 'short', year: 'numeric' }), x.why].filter(Boolean).join(' · '), () => go('compras/' + x.l.id))),
          group('Notas', res.notes, x => row(x.text, `${x.kind} · ${fmtDate(parseIsoDate(x.date), { day: 'numeric', month: 'short', year: 'numeric' })}`, () => {
            if (x.day) { openDay(x.day); go('hoy'); } else go('progreso');
          })),
        ],
  );
  return { title: 'Buscar', el };
}
