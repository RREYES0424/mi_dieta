// Alacena: lo que tienes en casa. Se descuenta sola según tu dieta activa (opcional)
// y se suma al cerrar una compra.
import * as S from '../store.js';
import { h, btn, iconBtn, numInput, select, toggle, empty, icon, fmtDateTime, confirmDialog, toast } from '../ui.js';
import { UNITS, unitOf, fmtNum, collapse } from '../units.js';
import { pantryAt, setPantry, buyDim, activePlan, rangeNeeds, purchaseVec, startOfDay } from '../calc.js';
import { refresh, go } from '../nav.js';

let showAll = false;
let search = '';

function dailyUse(ing, needs) {
  const slot = needs[ing.id];
  if (!slot) return 0;
  const used = purchaseVec(slot, ing.mermaCrudo, ing.mermaCocido, 0);
  return collapse(used, ing, buyDim(ing)).val / 7;
}

export function render() {
  const st = S.settings();
  const auto = st.autoConsumo !== false;
  const plan = activePlan();
  const weekNeeds = plan ? rangeNeeds(plan, startOfDay(new Date()), 7) : {};
  const ings = S.all('ingredients').sort(S.byName);
  const q = search.trim().toLowerCase();
  const rows = ings.filter(i => (showAll || S.get('pantry', i.id)) && (!q || i.name.toLowerCase().includes(q)));
  const inPantry = ings.filter(i => S.get('pantry', i.id));
  const notIn = ings.filter(i => !S.get('pantry', i.id));

  const groups = [];
  S.sortedAisles().forEach(a => {
    const items = rows.filter(i => i.aisleId === a.id);
    if (items.length) groups.push({ name: a.name, items });
  });
  const orphan = rows.filter(i => !i.aisleId || !S.get('aisles', i.aisleId));
  if (orphan.length) groups.push({ name: 'Sin pasillo', items: orphan });

  const row = ing => {
    const p = S.get('pantry', ing.id);
    const u = unitOf(ing.buyUnit || 'g');
    const have = pantryAt(ing.id);
    const perDay = dailyUse(ing, weekNeeds);
    const daysLeft = perDay > 0 ? Math.floor(have / perDay) : null;
    return h('li', { class: 'row' + (p && have <= 1e-9 ? ' row-empty' : '') },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, ing.name),
        h('div', { class: 'row-sub' },
          p ? `Ajustado ${fmtDateTime(p.asOf)}` : 'No registrado',
          perDay > 0 ? ` · usas ${fmtNum(perDay / u.f, u)} ${u.label}/día` : '',
          daysLeft != null && p ? ` · alcanza ~${daysLeft} día${daysLeft === 1 ? '' : 's'}` : '')),
      h('div', { class: 'pantry-qty' },
        numInput(p ? have / u.f : null, v => {
          if (v == null) return;
          setPantry(ing.id, v * u.f);
        }, { k: 'pan-' + ing.id, placeholder: '0', label: `Cantidad de ${ing.name}` }),
        h('span', { class: 'unit' }, UNITS[ing.buyUnit || 'g'].label)),
      h('div', { class: 'row-actions' },
        p ? iconBtn('x', 'Quitar de la alacena', () => S.remove('pantry', ing.id)) : null));
  };

  const el = h('div', { class: 'page' },
    h('section', { class: 'card' },
      toggle(auto, v => S.setSettings({ autoConsumo: v }), 'Descontar consumo automáticamente',
        plan ? `Cada día que pasa se resta lo que marca tu dieta activa ("${plan.name}"), incluyendo mermas. Corrige las cantidades cuando quieras.` : 'Necesitas una dieta activa.'),
      h('p', { class: 'muted small' }, 'Las cantidades se muestran en la unidad de compra de cada ingrediente. Al cerrar una compra, lo comprado se suma aquí.')),
    h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icon('search'), h('input', {
        class: 'input', type: 'search', placeholder: 'Buscar…', value: search, 'data-k': 'pan-search',
        oninput: e => { search = e.target.value; refresh(); },
      })),
      notIn.length && !showAll ? select([{ value: '', label: 'Agregar ingrediente…' }, ...notIn.map(i => ({ value: i.id, label: i.name }))], '', v => {
        if (v) setPantry(v, 0);
      }, { label: 'Agregar ingrediente a la alacena' }) : null,
      btn(showAll ? 'Solo lo que tengo' : 'Ver todos', () => { showAll = !showAll; refresh(); }, { kind: 'ghost', icon: showAll ? 'eyeOff' : 'eye' }),
      inPantry.length ? btn('Vaciar', async () => {
        if (!(await confirmDialog('Se quitarán todos los ingredientes de la alacena.', { ok: 'Vaciar', danger: true }))) return;
        inPantry.forEach(i => S.remove('pantry', i.id));
        toast('Alacena vacía');
      }, { kind: 'ghost', icon: 'trash' }) : null),
    !ings.length ? empty('Aún no tienes ingredientes', null, btn('Ir a ingredientes', () => go('ingredientes'), { kind: 'primary' }))
      : !rows.length ? empty(q ? 'Sin resultados' : 'Tu alacena está vacía', q ? null : 'Agrega lo que tienes en casa o toca "Ver todos" para capturar rápido.')
        : groups.map(g => h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, g.name, h('span', { class: 'count' }, String(g.items.length))),
          h('ul', { class: 'rows' }, g.items.map(row)))),
  );
  return { title: 'Alacena', el };
}
