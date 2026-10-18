// Dietas (planes): tiempos de comida con horario y platillos; personalizables por día.
import * as S from '../store.js';
import { h, btn, iconBtn, field, numInput, textInput, select, modal, confirmDialog, promptDialog, toast, empty, icon, segmented, fmtTime, fmtDate } from '../ui.js';
import { mealsFor, entriesMacros, dayMacros, anyMacros, DAY_SHORT, DAY_NAMES, WEEK_ORDER, parseIsoDate, fmtMoney } from '../calc.js';
import { macrosLine } from './platillos.js';
import { refresh, go } from '../nav.js';
import { setActivePlan, periods } from '../tracking.js';
import { entriesCost, dayCost, costText, anyPrices } from '../prices.js';

let dayTab = 'all';
let tabFor = '';

function setActive(p) {
  setActivePlan(p.id);
  toast(`"${p.name}" es tu dieta activa`, 'ok');
}

async function createPlan() {
  const name = await promptDialog('Nueva dieta', '', { placeholder: 'Ej. Dieta definición' });
  if (!name) return;
  const p = S.put('plans', { name, meals: [], overrides: {} });
  if (!S.get('plans', S.settings().activePlanId)) setActivePlan(p.id);
  go('dieta/' + p.id);
}

function duplicatePlan(p) {
  const copy = JSON.parse(JSON.stringify(p));
  delete copy.id;
  copy.name = p.name + ' (copia)';
  const c = S.put('plans', copy);
  toast('Dieta duplicada', 'ok');
  return c;
}

async function renamePlan(p) {
  const name = await promptDialog('Renombrar dieta', p.name);
  if (name) S.put('plans', { ...p, name });
}

async function deletePlan(p) {
  if (!(await confirmDialog(`Se eliminará la dieta "${p.name}". Los platillos no se borran.`, { ok: 'Eliminar', danger: true }))) return false;
  S.remove('plans', p.id);
  if (S.settings().activePlanId === p.id) {
    const other = S.all('plans').sort(S.byName)[0];
    setActivePlan(other ? other.id : '');
  }
  toast('Dieta eliminada');
  return true;
}

function recipeOptions() {
  return S.all('recipes').filter(r => !r.archived).sort(S.byName).map(r => ({ value: r.id, label: r.name }));
}

async function addMeal(p) {
  let name = '';
  let time = '';
  const nameInp = h('input', { class: 'input', placeholder: 'Ej. Desayuno, Snack, Pre entreno', list: 'dl-meal-names' });
  const timeInp = h('input', { class: 'input', type: 'time' });
  const used = new Set((p.meals || []).map(m => m.name));
  const suggestions = ['Desayuno', 'Colación', 'Snack', 'Comida', 'Pre entreno', 'Post entreno', 'Cena'].filter(s => !used.has(s));
  modal({
    title: 'Nuevo tiempo de comida',
    body: h('div', { class: 'stack' },
      field('Nombre', nameInp),
      h('datalist', { id: 'dl-meal-names' }, suggestions.map(s => h('option', { value: s }))),
      field('Hora', timeInp)),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Agregar', kind: 'primary', onClick: () => {
          name = nameInp.value.trim();
          time = timeInp.value;
          if (!name) { nameInp.focus(); return false; }
          S.put('plans', { ...p, meals: [...(p.meals || []), { id: S.uid(), name, time, entries: [] }] });
        },
      },
    ],
  });
}

function entriesFor(p, meal) {
  if (dayTab === 'all') return meal.entries || [];
  const ov = (p.overrides || {})[dayTab] || {};
  return Object.prototype.hasOwnProperty.call(ov, meal.id) ? ov[meal.id] : null;
}

function setEntries(p, mealId, entries) {
  if (dayTab === 'all') {
    S.put('plans', { ...p, meals: p.meals.map(m => m.id === mealId ? { ...m, entries } : m) });
  } else {
    const overrides = { ...(p.overrides || {}) };
    overrides[dayTab] = { ...(overrides[dayTab] || {}), [mealId]: entries };
    S.put('plans', { ...p, overrides });
  }
}

function clearOverride(p, mealId) {
  const overrides = { ...(p.overrides || {}) };
  const day = { ...(overrides[dayTab] || {}) };
  delete day[mealId];
  if (Object.keys(day).length) overrides[dayTab] = day; else delete overrides[dayTab];
  S.put('plans', { ...p, overrides });
}

async function quickRecipe(p, meal, entries) {
  const name = await promptDialog('Nuevo platillo', '', { placeholder: 'Ej. Claras a la mexicana' });
  if (!name) return;
  const r = S.put('recipes', { name, items: [], notes: '', archived: false });
  setEntries(S.get('plans', p.id), meal.id, [...entries, { recipeId: r.id, factor: 1 }]);
  toast('Platillo creado. Agrégale sus ingredientes.', 'ok', 3500);
  go('platillos/' + r.id);
}

function entryList(p, meal, entries, editable) {
  const withMacros = anyMacros();
  let pick = '';
  const opts = recipeOptions();
  return h('div', { class: 'entries' },
    entries.length
      ? h('ul', { class: 'entry-list' }, entries.map((e, i) => {
        const r = S.get('recipes', e.recipeId);
        return h('li', { class: 'entry' },
          h('div', { class: 'entry-main' },
            r ? h('a', { href: '#/platillos/' + r.id, class: 'entry-name' }, r.name) : h('span', { class: 'muted' }, '(platillo eliminado)'),
            r && r.archived ? h('span', { class: 'badge' }, 'archivado') : null,
            withMacros && r ? macrosLine(entriesMacros([e])) : null),
          editable ? h('div', { class: 'entry-actions' },
            h('label', { class: 'factor', title: 'Porciones' }, '×',
              numInput(e.factor || 1, v => {
                const next = entries.slice();
                next[i] = { ...e, factor: v > 0 ? v : 1 };
                setEntries(p, meal.id, next);
              }, { k: `f-${meal.id}-${i}`, label: 'Porciones' })),
            iconBtn('trash', 'Quitar', () => setEntries(p, meal.id, entries.filter((_, j) => j !== i)), { kind: 'danger' }))
            : h('span', { class: 'muted small' }, '×' + (e.factor || 1)));
      }))
      : h('p', { class: 'muted small' }, dayTab === 'all' ? 'Sin platillos.' : 'Este día no se come nada en este horario.'),
    editable ? h('div', { class: 'entry-add' },
      opts.length
        ? select([{ value: '', label: 'Agregar platillo…' }, ...opts], '', v => { pick = v; if (pick) setEntries(p, meal.id, [...entries, { recipeId: pick, factor: 1 }]); }, { k: `add-${meal.id}`, label: 'Agregar platillo' })
        : null,
      btn('Nuevo platillo', () => quickRecipe(p, meal, entries), { small: true, kind: 'ghost', icon: 'plus' })) : null);
}

function mealCard(p, meal) {
  const general = dayTab === 'all';
  const ownEntries = entriesFor(p, meal);
  const overridden = !general && ownEntries !== null;
  const shownEntries = general || overridden ? ownEntries : (meal.entries || []);
  const mealsSorted = mealsFor(p, null);

  return h('article', { class: 'card meal-card' + (overridden ? ' overridden' : '') },
    h('div', { class: 'meal-head' },
      general
        ? h('div', { class: 'meal-fields' },
          h('input', {
            class: 'input time-input', type: 'time', value: meal.time || '', 'data-k': `t-${meal.id}`, 'aria-label': 'Hora',
            onchange: e => S.put('plans', { ...p, meals: p.meals.map(m => m.id === meal.id ? { ...m, time: e.target.value } : m) }),
          }),
          textInput(meal.name, v => {
            if (v.trim()) S.put('plans', { ...p, meals: p.meals.map(m => m.id === meal.id ? { ...m, name: v.trim() } : m) });
          }, { k: `n-${meal.id}`, cls: 'meal-name-input', label: 'Nombre del tiempo de comida' }))
        : h('div', { class: 'meal-fields' },
          h('span', { class: 'time-pill' }, icon('clock'), fmtTime(meal.time) || 'Sin hora'),
          h('h3', null, meal.name)),
      general
        ? iconBtn('trash', 'Eliminar tiempo de comida', async () => {
          if (!(await confirmDialog(`Se eliminará "${meal.name}" de esta dieta (también de los días personalizados).`, { ok: 'Eliminar', danger: true }))) return;
          const overrides = {};
          for (const [wd, map] of Object.entries(p.overrides || {})) {
            const m = { ...map };
            delete m[meal.id];
            if (Object.keys(m).length) overrides[wd] = m;
          }
          S.put('plans', { ...p, meals: p.meals.filter(m => m.id !== meal.id), overrides });
        }, { kind: 'danger' })
        : overridden
          ? btn('Usar lo general', () => clearOverride(p, meal.id), { small: true, kind: 'ghost' })
          : btn('Personalizar', () => setEntries(p, meal.id, (meal.entries || []).map(e => ({ ...e }))), { small: true, kind: 'ghost', icon: 'edit' })),
    !general && !overridden ? h('p', { class: 'muted small' }, 'Igual que todos los días.') : null,
    entryList(p, meal, shownEntries, general || overridden),
    anyPrices() && costText(entriesCost(shownEntries), S.settings().currency || 'MXN') ? h('p', { class: 'cost-line small' }, costText(entriesCost(shownEntries), S.settings().currency || 'MXN')) : null,
    mealsSorted.length && general && !meal.time ? h('p', { class: 'hint' }, 'Tip: ponle hora para ordenarlo.') : null);
}

// Costo de la dieta: el día elegido y el promedio de la semana.
function costCard(p) {
  if (!anyPrices()) return null;
  const cur = S.settings().currency || 'MXN';
  const day = dayTab === 'all' ? dayCost({ ...p, overrides: {} }, null, cur) : dayCost(p, Number(dayTab), cur);
  const week = [0, 1, 2, 3, 4, 5, 6].map(wd => dayCost(p, wd, cur));
  const weekTotal = week.reduce((s, c) => s + c.total, 0);
  const missing = week.some(c => c.missing);
  if (!day.priced && !weekTotal) return null;
  return h('div', { class: 'card totals-card' },
    h('span', { class: 'muted small' }, dayTab === 'all' ? 'Costo por día' : `Costo del ${DAY_NAMES[Number(dayTab)].toLowerCase()}`),
    h('span', { class: 'cost-figures' },
      h('strong', null, costText(day, cur).replace(' (faltan precios)', '')),
      h('span', { class: 'muted small' }, ` · semana ≈ ${fmtMoney(weekTotal, cur)}`),
      missing ? h('span', { class: 'warn-text small' }, ' · faltan precios') : null));
}

function editor(id) {
  const p = S.get('plans', id);
  if (!p) return { title: 'Dieta', el: empty('No se encontró la dieta', null, btn('Volver', () => go('dieta'), { icon: 'back' })) };
  if (tabFor !== id) { tabFor = id; dayTab = 'all'; }
  p.meals = p.meals || [];
  const isActive = S.settings().activePlanId === p.id;
  const overrides = p.overrides || {};
  const meals = mealsFor(p, null);
  const withMacros = anyMacros();
  const dayOpts = [{ value: 'all', label: 'Todos los días' }, ...WEEK_ORDER.map(wd => ({
    value: String(wd), label: DAY_SHORT[wd], marked: overrides[wd] && Object.keys(overrides[wd]).length > 0,
  }))];

  const totals = withMacros ? (dayTab === 'all' ? dayMacros({ ...p, overrides: {} }, null) : dayMacros(p, Number(dayTab))) : null;

  const el = h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      iconBtn('back', 'Volver', () => go('dieta')),
      textInput(p.name, v => { if (v.trim()) S.put('plans', { ...p, name: v.trim() }); }, { k: 'p-name', cls: 'input-title', label: 'Nombre de la dieta' }),
      isActive ? h('span', { class: 'badge badge-ok' }, icon('star'), 'Activa') : btn('Usar esta dieta', () => setActive(p), { small: true, kind: 'primary', icon: 'star' })),
    h('div', { class: 'day-tabs' }, segmented(dayOpts, dayTab, v => { dayTab = String(v); refresh(); }, { cls: 'scroll-x' })),
    dayTab !== 'all'
      ? h('p', { class: 'muted small' }, `${DAY_NAMES[Number(dayTab)]}: toca "Personalizar" en un tiempo de comida para cambiar lo que comes solo ese día. Los días con cambios tienen un punto.`)
      : h('p', { class: 'muted small' }, 'Lo que pongas aquí se repite todos los días, salvo los días que personalices.'),
    totals ? h('div', { class: 'card totals-card' }, h('span', { class: 'muted small' }, dayTab === 'all' ? 'Total por día' : `Total del ${DAY_NAMES[Number(dayTab)].toLowerCase()}`), macrosLine(totals) || h('span', { class: 'muted small' }, 'Sin macros')) : null,
    costCard(p),
    meals.length ? h('div', { class: 'meal-list' }, meals.map(m => mealCard(p, p.meals.find(x => x.id === m.id))))
      : empty('Sin tiempos de comida', 'Agrega desayuno, comida, cena o los que necesites.'),
    dayTab === 'all' ? h('div', { class: 'btn-row' }, btn('Agregar tiempo de comida', () => addMeal(p), { kind: 'primary', icon: 'plus' })) : null,
    h('div', { class: 'btn-row end' },
      btn('Duplicar', () => { const c = duplicatePlan(p); go('dieta/' + c.id); }, { icon: 'copy', kind: 'ghost' }),
      btn('Eliminar', async () => { if (await deletePlan(p)) go('dieta'); }, { icon: 'trash', kind: 'danger' })),
  );
  requestAnimationFrame(() => {
    const bar = el.querySelector('.day-tabs .segmented');
    const act = bar && bar.querySelector('.seg.active');
    if (act && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = act.offsetLeft - (bar.clientWidth - act.offsetWidth) / 2;
  });
  return { title: p.name, el };
}

export function render(params) {
  if (params[0]) return editor(params[0]);
  const plans = S.all('plans').sort(S.byName);
  const activeId = S.settings().activePlanId;
  const cur = periods().filter(x => x.current)[0];
  const since = cur && cur.planId === activeId ? cur.start : '';
  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      h('p', { class: 'muted grow' }, 'Tus dietas guardadas. La dieta activa es la que se usa en "Hoy" y para la lista de compras.'),
      btn('Nueva dieta', createPlan, { kind: 'primary', icon: 'plus' })),
    !plans.length ? empty('No tienes dietas', null, btn('Crear dieta', createPlan, { kind: 'primary', icon: 'plus' }))
      : h('div', { class: 'cards' }, plans.map(p => {
        const meals = mealsFor(p, null);
        const customDays = Object.keys(p.overrides || {}).filter(k => Object.keys(p.overrides[k] || {}).length).map(Number);
        return h('article', { class: 'card card-link' + (p.id === activeId ? ' card-active' : ''), onclick: () => go('dieta/' + p.id) },
          h('div', { class: 'card-head' },
            h('h3', null, p.name, p.id === activeId ? h('span', { class: 'badge badge-ok' }, 'Activa') : null),
            p.id === activeId && since ? h('span', { class: 'muted small since' }, `desde ${fmtDate(parseIsoDate(since), { day: 'numeric', month: 'short' })}`) : null,
            h('div', { class: 'row-actions', onclick: e => e.stopPropagation() },
              p.id !== activeId ? iconBtn('star', 'Usar esta dieta', () => setActive(p)) : null,
              iconBtn('edit', 'Renombrar', () => renamePlan(p)),
              iconBtn('copy', 'Duplicar', () => duplicatePlan(p)),
              iconBtn('trash', 'Eliminar', () => deletePlan(p), { kind: 'danger' }))),
          meals.length
            ? h('ul', { class: 'meal-summary' }, meals.map(m => h('li', null,
              h('span', { class: 'time' }, fmtTime(m.time) || '—'),
              h('span', { class: 'name' }, m.name),
              h('span', { class: 'muted' }, m.entries.map(e => (S.get('recipes', e.recipeId) || {}).name).filter(Boolean).join(', ') || 'sin platillos'))))
            : h('p', { class: 'muted small' }, 'Sin tiempos de comida'),
          customDays.length ? h('p', { class: 'small muted' }, 'Días personalizados: ' + WEEK_ORDER.filter(d => customDays.includes(d)).map(d => DAY_SHORT[d]).join(', ')) : null);
      })),
  );
  return { title: 'Dieta', el };
}
