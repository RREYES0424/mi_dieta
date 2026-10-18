// Papelera: recuperar lo que se borró.
import * as S from '../store.js';
import { h, btn, iconBtn, confirmDialog, toast, empty, fmtDateTime, fmtDate } from '../ui.js';
import { parseIsoDate } from '../calc.js';
import { go } from '../nav.js';

export const KIND = {
  ingredients: 'Ingrediente',
  recipes: 'Platillo',
  plans: 'Dieta',
  lists: 'Lista',
  aisles: 'Pasillo',
  body: 'Peso y medidas',
  planHistory: 'Cambio de dieta',
};

const NOTES = {
  ingredients: 'Si estaba en platillos, vuelve a agregarlo en cada platillo.',
  recipes: 'Si estaba en tu dieta, vuelve a ponerlo en el tiempo de comida.',
};

function title(col, r) {
  if (r.name) return r.name;
  if (col === 'body' || col === 'planHistory') return fmtDate(parseIsoDate(r.date), { day: 'numeric', month: 'short', year: 'numeric' }) + (r.planName ? ` · ${r.planName}` : '');
  return '(sin nombre)';
}

const LINK = { ingredients: () => 'ingredientes', recipes: r => 'platillos/' + r.id, plans: r => 'dieta/' + r.id, lists: r => 'compras/' + r.id, aisles: () => 'ingredientes', body: () => 'progreso', planHistory: () => 'progreso' };

export function render() {
  const items = S.trash(Object.keys(KIND));
  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      h('p', { class: 'muted grow' }, 'Lo que borras queda aquí hasta que vacíes la papelera. Se sincroniza entre tus dispositivos.'),
      items.length ? btn('Vaciar papelera', async () => {
        if (!(await confirmDialog(`Se borrarán para siempre ${items.length} elemento(s).`, { ok: 'Vaciar', danger: true }))) return;
        S.emptyTrash(items);
        toast('Papelera vacía');
      }, { kind: 'danger', icon: 'trash' }) : null),
    !items.length ? empty('La papelera está vacía')
      : h('ul', { class: 'rows' }, items.map(({ col, rec }) => h('li', { class: 'row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, title(col, rec)),
          h('div', { class: 'row-sub' }, `${KIND[col]} · borrado ${fmtDateTime(rec.deletedAt)}`)),
        h('div', { class: 'row-actions' },
          btn('Recuperar', () => {
            S.restore(col, rec.id);
            toast(`${KIND[col]} recuperado. ${NOTES[col] || ''}`, 'ok', 4000);
            if (LINK[col] && col !== 'aisles' && col !== 'ingredients') go(LINK[col](rec));
          }, { small: true, kind: 'ghost' }),
          iconBtn('x', 'Borrar para siempre', async () => {
            if (!(await confirmDialog(`"${title(col, rec)}" se borrará para siempre.`, { ok: 'Borrar', danger: true }))) return;
            S.emptyTrash([{ col, rec }]);
          }, { kind: 'danger' }))))),
  );
  return { title: 'Papelera', el };
}
