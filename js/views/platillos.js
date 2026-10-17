// Platillos (recetas): ingredientes con cantidades, reutilizables en cualquier tiempo de comida.
import * as S from '../store.js';
import { h, btn, iconBtn, field, numInput, textInput, select, checkbox, modal, confirmDialog, promptDialog, toast, empty, icon, segmented } from '../ui.js';
import { UNITS, RECIPE_UNITS } from '../units.js';
import { recipeMacros, anyMacros } from '../calc.js';
import { openIngredientEditor, findIngredientByName, unitOptions } from './ingredientes.js';
import { refresh, go } from '../nav.js';

let search = '';
let show = 'active';
let draftLine = { name: '', qty: null, unit: 'g', cocido: false };
let draftFor = '';

export function macrosLine(m) {
  if (!m || (m.kcal === 0 && m.prot === 0 && m.carb === 0 && m.fat === 0)) return null;
  return h('div', { class: 'macros' },
    h('span', { class: 'macro kcal' }, `${Math.round(m.kcal)} kcal`),
    h('span', { class: 'macro' }, `P ${Math.round(m.prot)} g`),
    h('span', { class: 'macro' }, `C ${Math.round(m.carb)} g`),
    h('span', { class: 'macro' }, `G ${Math.round(m.fat)} g`),
    m.missing ? h('span', { class: 'macro muted', title: 'Algún ingrediente no tiene macros o no tiene equivalencia en gramos' }, 'incompleto') : null);
}

export function usesOf(recipeId) {
  const out = [];
  for (const p of S.all('plans')) {
    for (const m of p.meals || []) {
      if ((m.entries || []).some(e => e.recipeId === recipeId)) out.push({ plan: p, meal: m });
    }
    for (const wd of Object.keys(p.overrides || {})) {
      for (const [mealId, entries] of Object.entries(p.overrides[wd] || {})) {
        if ((entries || []).some(e => e.recipeId === recipeId)) {
          const meal = (p.meals || []).find(x => x.id === mealId);
          if (meal && !out.some(o => o.plan.id === p.id && o.meal.id === mealId)) out.push({ plan: p, meal });
        }
      }
    }
  }
  return out;
}

export function duplicateRecipe(r) {
  const copy = S.put('recipes', { ...JSON.parse(JSON.stringify(r)), id: undefined, name: r.name + ' (copia)', archived: false });
  toast('Platillo duplicado', 'ok');
  return copy;
}

export async function deleteRecipe(r) {
  const uses = usesOf(r.id);
  const msg = uses.length
    ? `"${r.name}" está en ${uses.map(u => `${u.plan.name} › ${u.meal.name}`).join(', ')}. Se quitará de ahí. Si solo quieres dejar de usarlo, mejor archívalo.`
    : `Se eliminará "${r.name}".`;
  if (!(await confirmDialog(msg, { ok: 'Eliminar', danger: true }))) return false;
  for (const p of S.all('plans')) {
    let changed = false;
    const meals = (p.meals || []).map(m => {
      const entries = (m.entries || []).filter(e => e.recipeId !== r.id);
      if (entries.length !== (m.entries || []).length) changed = true;
      return { ...m, entries };
    });
    const overrides = {};
    for (const [wd, map] of Object.entries(p.overrides || {})) {
      overrides[wd] = {};
      for (const [mid, entries] of Object.entries(map || {})) {
        const f = (entries || []).filter(e => e.recipeId !== r.id);
        if (f.length !== (entries || []).length) changed = true;
        overrides[wd][mid] = f;
      }
    }
    if (changed) S.put('plans', { ...p, meals, overrides });
  }
  S.remove('recipes', r.id);
  toast('Platillo eliminado');
  return true;
}

function ingredientDatalist(id) {
  return h('datalist', { id }, S.all('ingredients').sort(S.byName).map(i => h('option', { value: i.name })));
}

// Resuelve un nombre a ingrediente; si no existe ofrece crearlo.
function resolveIngredient(name, cb) {
  const n = name.trim();
  if (!n) return;
  const found = findIngredientByName(n);
  if (found) { cb(found); return; }
  openIngredientEditor(null, saved => cb(saved), { name: n });
}

function lineRow(r, it, idx) {
  const ing = S.get('ingredients', it.ingId);
  const update = patch => {
    const items = r.items.slice();
    items[idx] = { ...items[idx], ...patch };
    S.put('recipes', { ...r, items });
  };
  return h('li', { class: 'line' },
    h('div', { class: 'line-name' },
      textInput(ing ? ing.name : '(ingrediente eliminado)', v => {
        resolveIngredient(v, found => update({ ingId: found.id }));
      }, { list: 'dl-ings', k: `rl-name-${idx}`, label: 'Ingrediente' })),
    h('div', { class: 'line-qty' },
      numInput(it.qty, v => update({ qty: v || 0 }), { k: `rl-qty-${idx}`, label: 'Cantidad' }),
      select(unitOptions(RECIPE_UNITS).map(o => ({ ...o, label: UNITS[o.value].label })), it.unit, v => update({ unit: v }), { k: `rl-unit-${idx}`, label: 'Unidad', cls: 'unit-select' })),
    h('div', { class: 'line-opts' },
      checkbox(it.cocido, v => update({ cocido: v }), 'Cocido', { cls: 'check-sm' }),
      iconBtn('up', 'Subir', () => {
        if (idx === 0) return;
        const items = r.items.slice();
        [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
        S.put('recipes', { ...r, items });
      }, { disabled: idx === 0 }),
      iconBtn('trash', 'Quitar', () => {
        S.put('recipes', { ...r, items: r.items.filter((_, i) => i !== idx) });
      }, { kind: 'danger' })));
}

function addLine(r) {
  const nameInp = textInput(draftLine.name, v => { draftLine.name = v; }, { list: 'dl-ings', k: 'nl-name', placeholder: 'Ingrediente…', label: 'Nuevo ingrediente' });
  nameInp.addEventListener('input', e => { draftLine.name = e.target.value; });
  const qtyInp = numInput(draftLine.qty, v => { draftLine.qty = v; }, { k: 'nl-qty', placeholder: 'Cant.', label: 'Cantidad' });
  qtyInp.addEventListener('input', e => { draftLine.qty = e.target.value; });
  const commit = () => {
    const name = (draftLine.name || '').trim();
    if (!name) { nameInp.focus(); return; }
    const qty = Number(String(draftLine.qty ?? '').replace(',', '.')) || 0;
    resolveIngredient(name, found => {
      const fresh = S.get('recipes', r.id) || r;
      S.put('recipes', { ...fresh, items: [...(fresh.items || []), { ingId: found.id, qty, unit: draftLine.unit, cocido: draftLine.cocido }] });
      draftLine = { name: '', qty: null, unit: draftLine.unit, cocido: false };
      setTimeout(() => { const n = document.querySelector('[data-k="nl-name"]'); if (n) n.focus(); }, 30);
    });
  };
  [nameInp, qtyInp].forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.dispatchEvent(new Event('change')); commit(); }
  }));
  return h('li', { class: 'line line-new' },
    h('div', { class: 'line-name' }, nameInp),
    h('div', { class: 'line-qty' },
      qtyInp,
      select(unitOptions(RECIPE_UNITS).map(o => ({ ...o, label: UNITS[o.value].label })), draftLine.unit, v => { draftLine.unit = v; }, { k: 'nl-unit', label: 'Unidad', cls: 'unit-select' })),
    h('div', { class: 'line-opts' },
      checkbox(draftLine.cocido, v => { draftLine.cocido = v; }, 'Cocido', { cls: 'check-sm' }),
      btn('Agregar', commit, { kind: 'primary', small: true, icon: 'plus' })));
}

export function openAddToPlan(r) {
  const plans = S.all('plans').sort(S.byName);
  if (!plans.length) { toast('Primero crea una dieta', 'warn'); return; }
  let planId = (S.get('plans', S.settings().activePlanId) || plans[0]).id;
  let mealId = '';
  let factor = 1;
  const mealBox = h('div');
  const drawMeals = () => {
    const p = S.get('plans', planId);
    const meals = (p.meals || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    mealId = meals.some(m => m.id === mealId) ? mealId : (meals[0] && meals[0].id) || '';
    mealBox.replaceChildren(meals.length
      ? field('Tiempo de comida', select(meals.map(m => ({ value: m.id, label: `${m.name}${m.time ? ' · ' + m.time : ''}` })), mealId, v => { mealId = v; }))
      : h('p', { class: 'muted' }, 'Esta dieta aún no tiene tiempos de comida.'));
  };
  drawMeals();
  modal({
    title: `Agregar "${r.name}" a la dieta`,
    body: h('div', { class: 'stack' },
      field('Dieta', select(plans.map(p => ({ value: p.id, label: p.name })), planId, v => { planId = v; drawMeals(); })),
      mealBox,
      field('Porciones', numInput(factor, v => { factor = v > 0 ? v : 1; }), 'Multiplica las cantidades del platillo (ej. 0.5 o 2).')),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Agregar', kind: 'primary', onClick: () => {
          const p = S.get('plans', planId);
          if (!mealId) return false;
          const meals = p.meals.map(m => m.id === mealId ? { ...m, entries: [...(m.entries || []), { recipeId: r.id, factor }] } : m);
          S.put('plans', { ...p, meals });
          toast('Agregado a la dieta', 'ok');
        },
      },
    ],
  });
}

function editor(id) {
  const r = S.get('recipes', id);
  if (!r) {
    return { title: 'Platillo', el: empty('No se encontró el platillo', null, btn('Volver a platillos', () => go('platillos'), { icon: 'back' })) };
  }
  r.items = r.items || [];
  if (draftFor !== r.id) {
    draftFor = r.id;
    draftLine = { name: '', qty: null, unit: 'g', cocido: false };
  }
  const uses = usesOf(r.id);
  const macros = anyMacros() ? recipeMacros(r) : null;

  const nameInp = textInput(r.name, v => {
    const name = v.trim();
    if (name) S.put('recipes', { ...r, name });
  }, { k: 'r-name', cls: 'input-title', label: 'Nombre del platillo' });

  const el = h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      iconBtn('back', 'Volver', () => go('platillos')),
      nameInp),
    r.archived ? h('div', { class: 'banner' }, icon('archive'), 'Este platillo está archivado.', btn('Reactivar', () => S.put('recipes', { ...r, archived: false }), { small: true })) : null,
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Ingredientes'), macrosLine(macros)),
      h('p', { class: 'muted small' }, 'Marca "Cocido" cuando la cantidad sea en peso cocido; la lista lo convertirá a crudo con la merma de cocción del ingrediente.'),
      ingredientDatalist('dl-ings'),
      h('ul', { class: 'lines' }, r.items.map((it, i) => lineRow(r, it, i)), addLine(r))),
    h('section', { class: 'card' },
      h('h2', null, 'Notas o preparación'),
      h('textarea', {
        class: 'input textarea', rows: 4, 'data-k': 'r-notes', placeholder: 'Opcional',
        value: r.notes || '', onchange: e => S.put('recipes', { ...r, notes: e.target.value }),
      })),
    h('section', { class: 'card' },
      h('h2', null, 'Dónde se usa'),
      uses.length
        ? h('ul', { class: 'chips' }, uses.map(u => h('li', null, h('a', { class: 'chip', href: '#/dieta/' + u.plan.id }, `${u.plan.name} › ${u.meal.name}`))))
        : h('p', { class: 'muted' }, 'No está en ninguna dieta.'),
      h('div', { class: 'btn-row' },
        btn('Agregar a la dieta', () => openAddToPlan(r), { icon: 'plus', kind: 'ghost' }))),
    h('div', { class: 'btn-row end' },
      btn('Duplicar', () => { const c = duplicateRecipe(r); go('platillos/' + c.id); }, { icon: 'copy', kind: 'ghost' }),
      btn(r.archived ? 'Reactivar' : 'Archivar', () => S.put('recipes', { ...r, archived: !r.archived }), { icon: 'archive', kind: 'ghost' }),
      btn('Eliminar', async () => { if (await deleteRecipe(r)) go('platillos'); }, { icon: 'trash', kind: 'danger' })),
  );
  return { title: r.name, el };
}

async function createRecipe() {
  const name = await promptDialog('Nuevo platillo', '', { placeholder: 'Ej. Quesadilla de pollo' });
  if (!name) return;
  const r = S.put('recipes', { name, items: [], notes: '', archived: false });
  go('platillos/' + r.id);
}

export function render(params) {
  if (params[0]) return editor(params[0]);

  const all = S.all('recipes').sort(S.byName);
  const q = search.trim().toLowerCase();
  const list = all.filter(r => (show === 'archived' ? r.archived : !r.archived) && (!q || r.name.toLowerCase().includes(q)));
  const archivedCount = all.filter(r => r.archived).length;
  const withMacros = anyMacros();

  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icon('search'), h('input', {
        class: 'input', type: 'search', placeholder: 'Buscar platillo…', value: search, 'data-k': 'rec-search',
        oninput: e => { search = e.target.value; refresh(); },
      })),
      segmented([{ value: 'active', label: 'Activos' }, { value: 'archived', label: `Archivados (${archivedCount})` }], show, v => { show = v; refresh(); }),
      btn('Nuevo', createRecipe, { kind: 'primary', icon: 'plus' })),
    !all.length
      ? empty('Aún no tienes platillos', 'Crea tus platillos con sus ingredientes y luego ponlos en cualquier tiempo de comida.', btn('Crear platillo', createRecipe, { kind: 'primary', icon: 'plus' }))
      : !list.length ? empty(show === 'archived' ? 'No hay platillos archivados' : 'Sin resultados')
        : h('div', { class: 'cards' }, list.map(r => {
          const uses = usesOf(r.id);
          return h('article', { class: 'card card-link', onclick: () => go('platillos/' + r.id) },
            h('div', { class: 'card-head' },
              h('h3', null, r.name),
              h('div', { class: 'row-actions', onclick: e => e.stopPropagation() },
                iconBtn('copy', 'Duplicar', () => duplicateRecipe(r)),
                iconBtn('archive', r.archived ? 'Reactivar' : 'Archivar', () => S.put('recipes', { ...r, archived: !r.archived })),
                iconBtn('trash', 'Eliminar', () => deleteRecipe(r), { kind: 'danger' }))),
            h('p', { class: 'muted small' }, (r.items || []).map(it => (S.get('ingredients', it.ingId) || {}).name).filter(Boolean).join(', ') || 'Sin ingredientes'),
            withMacros ? macrosLine(recipeMacros(r)) : null,
            uses.length ? h('p', { class: 'small tag-line' }, icon('plan'), uses.map(u => u.meal.name).filter((x, i, a) => a.indexOf(x) === i).join(', ')) : null);
        })),
  );
  return { title: 'Platillos', el };
}
