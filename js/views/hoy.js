// Menú del día según la dieta activa.
import * as S from '../store.js';
import { h, btn, iconBtn, empty, icon, fmtTime, fmtDate, checkbox } from '../ui.js';
import { planForDay, getLog, setEaten, setAllEaten, setDayNote, dayStats } from '../tracking.js';
import { mealsFor, entriesMacros, dayMacros, anyMacros, addDays, startOfDay, isoDate, parseIsoDate } from '../calc.js';
import { UNITS, fmtNum } from '../units.js';
import { macrosLine } from './platillos.js';
import { refresh, go } from '../nav.js';

let dateIso = '';

export function openDay(iso) {
  dateIso = iso;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function qtyText(it, factor) {
  const u = UNITS[it.unit] || UNITS.g;
  return `${fmtNum((Number(it.qty) || 0) * factor, u)} ${u.label}`;
}

export function render() {
  const today = startOfDay(new Date());
  if (!dateIso) dateIso = isoDate(today);
  const date = parseIsoDate(dateIso);
  const isToday = dateIso === isoDate(today);
  const plan = planForDay(dateIso);
  const future = dateIso > isoDate(today);
  const log = getLog(dateIso);

  const nav = h('div', { class: 'date-nav' },
    iconBtn('back', 'Día anterior', () => { dateIso = isoDate(addDays(date, -1)); refresh(); }),
    h('div', { class: 'date-nav-label' },
      h('strong', null, isToday ? 'Hoy' : cap(fmtDate(date, { weekday: 'long' }))),
      h('span', { class: 'muted small' }, cap(fmtDate(date, isToday ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long' })))),
    h('button', { class: 'icon-btn flip', type: 'button', title: 'Día siguiente', 'aria-label': 'Día siguiente', onclick: () => { dateIso = isoDate(addDays(date, 1)); refresh(); } }, icon('back')),
    !isToday ? btn('Hoy', () => { dateIso = isoDate(today); refresh(); }, { small: true, kind: 'ghost' }) : null);

  if (!plan) {
    return { title: 'Hoy', el: h('div', { class: 'page' }, empty('No tienes una dieta activa', 'Crea una dieta y agrégale tus tiempos de comida.', btn('Ir a Dieta', () => go('dieta'), { kind: 'primary' }))) };
  }

  const wd = date.getDay();
  const meals = mealsFor(plan, wd);
  const withMacros = anyMacros();
  const nowHm = new Date().toTimeString().slice(0, 5);
  const nextId = isToday ? (meals.find(m => (m.time || '') >= nowHm) || {}).id : null;

  const el = h('div', { class: 'page' },
    nav,
    h('div', { class: 'card plan-banner' },
      h('div', null,
        h('span', { class: 'muted small' }, 'Dieta activa'),
        h('h2', null, plan.name)),
      btn('Editar', () => go('dieta/' + plan.id), { small: true, kind: 'ghost', icon: 'edit' })),
    trackCard(plan, meals, log, future),
    withMacros ? h('div', { class: 'card totals-card' }, h('span', { class: 'muted small' }, 'Total del día'), macrosLine(dayMacros(plan, wd)) || h('span', { class: 'muted small' }, 'Sin macros')) : null,
    !meals.length
      ? empty('Tu dieta aún no tiene tiempos de comida', null, btn('Agregar', () => go('dieta/' + plan.id), { kind: 'primary', icon: 'plus' }))
      : h('ol', { class: 'timeline' }, meals.map(m => h('li', { class: 'timeline-item' + (m.id === nextId ? ' next' : '') },
        h('div', { class: 'timeline-time' }, fmtTime(m.time) || '—'),
        h('article', { class: 'card meal-today' + (log && log.eaten && log.eaten[m.id] ? ' eaten' : '') },
          h('div', { class: 'card-head' },
            h('h3', null, m.name, m.id === nextId ? h('span', { class: 'badge badge-ok' }, 'Siguiente') : null, m.overridden ? h('span', { class: 'badge' }, 'Personalizado') : null),
            m.entries.length && !future
              ? checkbox(!!(log && log.eaten && log.eaten[m.id]), v => setEaten(dateIso, m.id, v), 'Lo comí', { cls: 'eaten-check', k: 'eat-' + m.id }) : null,
            withMacros ? macrosLine(entriesMacros(m.entries)) : null),
          m.entries.length ? m.entries.map(e => {
            const r = S.get('recipes', e.recipeId);
            if (!r) return null;
            const f = Number(e.factor) > 0 ? Number(e.factor) : 1;
            return h('div', { class: 'dish' },
              h('a', { class: 'dish-name', href: '#/platillos/' + r.id }, r.name, f !== 1 ? h('span', { class: 'muted' }, ` ×${f}`) : null),
              h('ul', { class: 'dish-items' }, (r.items || []).map(it => {
                const ing = S.get('ingredients', it.ingId);
                if (!ing) return null;
                return h('li', null, h('span', null, ing.name), h('span', { class: 'qty' }, qtyText(it, f), it.cocido ? h('span', { class: 'muted' }, ' cocido') : null));
              })),
              r.notes ? h('p', { class: 'muted small pre' }, r.notes) : null);
          }) : h('p', { class: 'muted small' }, 'Nada en este horario.'))))),
  );
  return { title: 'Hoy', el };
}

function trackCard(plan, meals, log, future) {
  const withFood = meals.filter(m => m.entries.length);
  if (future || !withFood.length) return null;
  // Las estadísticas usan las comidas de hoy (no las de un registro viejo).
  const eaten = (log && log.eaten) || {};
  const done = withFood.filter(m => eaten[m.id]).length;
  const all = done === withFood.length;
  const stats = log ? dayStats(log) : null;
  return h('section', { class: 'card track-card' },
    h('div', { class: 'card-head' },
      h('h2', null, `Comidas hechas: ${done} de ${withFood.length}`),
      btn(all ? 'Desmarcar todo' : 'Marcar todo', () => setAllEaten(dateIso, withFood.map(m => m.id), !all), { small: true, kind: 'ghost', icon: 'check' })),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': withFood.length, 'aria-valuenow': done },
      h('div', { class: 'progress-bar', style: { width: (done / withFood.length * 100) + '%' } }),
      h('span', { class: 'progress-text' }, Math.round(done / withFood.length * 100) + '%')),
    stats && stats.kcal > 0 ? h('p', { class: 'muted small' }, `Llevas ${Math.round(stats.kcal)} kcal · ${Math.round(stats.prot)} g de proteína`) : null,
    h('textarea', {
      class: 'input textarea note-input', rows: 2, 'data-k': 'day-note', placeholder: 'Nota del día (cómo te sentiste, entrenamiento, cambios…)',
      value: (log && log.note) || '', onchange: e => setDayNote(dateIso, e.target.value.trim()),
    }));
}
