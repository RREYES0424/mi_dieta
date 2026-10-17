// Catálogo de ingredientes y pasillos.
import * as S from '../store.js';
import { h, btn, iconBtn, field, numInput, textInput, select, modal, confirmDialog, promptDialog, toast, empty, icon } from '../ui.js';
import { UNITS, BUY_UNITS, RECIPE_UNITS, trimZeros } from '../units.js';
import { refresh } from '../nav.js';

let search = '';
let aisleFilter = '';

export function aisleOptions(includeNone = true) {
  const opts = S.sortedAisles().map(a => ({ value: a.id, label: a.name }));
  return includeNone ? [{ value: '', label: 'Sin pasillo' }, ...opts] : opts;
}

export function unitOptions(list) {
  return list.map(u => ({ value: u, label: `${UNITS[u].label} (${UNITS[u].name})` }));
}

export function findIngredientByName(name) {
  const n = name.trim().toLowerCase();
  return S.all('ingredients').find(i => i.name.trim().toLowerCase() === n) || null;
}

export function recipesUsing(ingId) {
  return S.all('recipes').filter(r => (r.items || []).some(it => it.ingId === ingId));
}

function pctLabel(n) {
  return trimZeros((Number(n) || 0).toFixed(1)) + '%';
}

function summary(ing) {
  const bits = [`Compra en ${UNITS[ing.buyUnit || 'g'].label}`];
  if (Number(ing.mermaCrudo) > 0) bits.push(`merma ${pctLabel(ing.mermaCrudo)}`);
  if (Number(ing.mermaCocido) > 0) bits.push(`cocción ${pctLabel(ing.mermaCocido)}`);
  if (Number(ing.margen) > 0) bits.push(`+${pctLabel(ing.margen)} extra`);
  if (ing.pack && Number(ing.pack.size) > 0) bits.push(`${ing.pack.name || 'paquete'} de ${trimZeros(String(ing.pack.size))} ${UNITS[ing.pack.unit || 'g'].label}`);
  if (Number(ing.gPorPieza) > 0) bits.push(`1 pz = ${trimZeros(String(ing.gPorPieza))} g`);
  return bits.join(' · ');
}

// Editor de ingrediente en una ventana. `prefill` permite precargar el nombre.
export function openIngredientEditor(ing, onSaved, prefill = {}) {
  const d = ing ? JSON.parse(JSON.stringify(ing)) : {
    name: prefill.name || '', aisleId: prefill.aisleId || '', buyUnit: prefill.buyUnit || 'g',
    mermaCrudo: 0, mermaCocido: 0, margen: 0, gPorPieza: null, gPorMl: null,
    pack: { name: '', size: null, unit: 'g' }, macros: {}, notes: '',
  };
  d.pack = d.pack || { name: '', size: null, unit: 'g' };
  d.macros = d.macros || {};

  const set = (k, v) => { d[k] = v; };
  const nameInp = textInput(d.name, v => set('name', v.trim()), { placeholder: 'Ej. Pechuga de pollo' });
  nameInp.addEventListener('input', e => set('name', e.target.value.trim()));

  const body = h('div', { class: 'form-grid' },
    h('div', { class: 'span-2' }, field('Nombre', nameInp)),
    field('Pasillo', select(aisleOptions(), d.aisleId, v => set('aisleId', v))),
    field('Unidad de compra', select(unitOptions(BUY_UNITS), d.buyUnit, v => set('buyUnit', v)), 'Cómo aparece en la lista de compras.'),

    h('h3', { class: 'span-2 form-section' }, 'Mermas y extra'),
    field('Merma al limpiar (%)', numInput(d.mermaCrudo, v => set('mermaCrudo', v || 0)), 'Cáscara, hueso, tallo… Aplica siempre.'),
    field('Merma de cocción (%)', numInput(d.mermaCocido, v => set('mermaCocido', v || 0)), 'Solo cuando en el platillo se pesa cocido.'),
    field('Compra extra (%)', numInput(d.margen, v => set('margen', v || 0)), 'Margen adicional al comprar.'),

    h('h3', { class: 'span-2 form-section' }, 'Equivalencias'),
    field('Gramos por pieza', numInput(d.gPorPieza, v => set('gPorPieza', v)), 'Ej. 1 tortilla = 30 g. Permite mezclar piezas y gramos.'),
    field('Densidad (g por ml)', numInput(d.gPorMl, v => set('gPorMl', v), { placeholder: '1' }), 'Para líquidos que pesas pero compras por litro. Sin dato se usa 1.'),

    h('h3', { class: 'span-2 form-section' }, 'Presentación de compra (opcional)'),
    field('Nombre', textInput(d.pack.name, v => { d.pack.name = v.trim(); }, { placeholder: 'Ej. cartón, bolsa, paquete' })),
    h('div', { class: 'row-2' },
      field('Contenido', numInput(d.pack.size, v => { d.pack.size = v; })),
      field('Unidad', select(unitOptions(RECIPE_UNITS.concat(['floz', 'gal']).filter((u, i, a) => a.indexOf(u) === i)), d.pack.unit, v => { d.pack.unit = v; }))),

    h('h3', { class: 'span-2 form-section' }, 'Macros por 100 g (opcional)'),
    h('div', { class: 'span-2 row-4' },
      field('kcal', numInput(d.macros.kcal, v => { d.macros.kcal = v; })),
      field('Proteína', numInput(d.macros.prot, v => { d.macros.prot = v; })),
      field('Carbs', numInput(d.macros.carb, v => { d.macros.carb = v; })),
      field('Grasa', numInput(d.macros.fat, v => { d.macros.fat = v; }))),
    h('small', { class: 'span-2 hint' }, 'Captura los valores del ingrediente tal como lo pesas en tus platillos.'),
  );

  modal({
    title: ing ? 'Editar ingrediente' : 'Nuevo ingrediente',
    wide: true,
    body,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary', onClick: () => {
          if (!d.name) { toast('Escribe un nombre', 'warn'); nameInp.focus(); return false; }
          const dup = findIngredientByName(d.name);
          if (dup && (!ing || dup.id !== ing.id)) { toast('Ya existe un ingrediente con ese nombre', 'warn'); return false; }
          if (!d.pack.name && !(Number(d.pack.size) > 0)) d.pack = null;
          const saved = S.put('ingredients', d);
          toast('Ingrediente guardado', 'ok');
          if (onSaved) onSaved(saved);
        },
      },
    ],
  });
}

export function openAisleManager() {
  const draw = (box) => {
    const aisles = S.sortedAisles();
    box.replaceChildren(
      aisles.length ? h('ul', { class: 'reorder-list' }, aisles.map((a, i) => h('li', { class: 'reorder-item' },
        h('span', { class: 'reorder-n' }, String(i + 1)),
        textInput(a.name, v => {
          if (v.trim()) S.put('aisles', { ...a, name: v.trim() });
        }, { label: 'Nombre del pasillo' }),
        iconBtn('up', 'Subir', () => { move(aisles, i, -1); draw(box); }, { disabled: i === 0 }),
        iconBtn('down', 'Bajar', () => { move(aisles, i, 1); draw(box); }, { disabled: i === aisles.length - 1 }),
        iconBtn('trash', 'Eliminar', async () => {
          const used = S.all('ingredients').filter(x => x.aisleId === a.id);
          const ok = await confirmDialog(used.length
            ? `${used.length} ingrediente(s) quedarán sin pasillo.`
            : `Se eliminará "${a.name}".`, { ok: 'Eliminar', danger: true });
          if (!ok) return;
          used.forEach(x => S.put('ingredients', { ...x, aisleId: '' }));
          S.remove('aisles', a.id);
          draw(box);
        }, { kind: 'danger' }),
      ))) : empty('Sin pasillos'),
      btn('Agregar pasillo', async () => {
        const name = await promptDialog('Nuevo pasillo');
        if (name) {
          const max = Math.max(-1, ...S.sortedAisles().map(x => x.order ?? 0));
          S.put('aisles', { name, order: max + 1 });
          draw(box);
        }
      }, { icon: 'plus', kind: 'ghost' }),
    );
  };
  const box = h('div', { class: 'stack' });
  draw(box);
  modal({
    title: 'Pasillos',
    body: h('div', null, h('p', { class: 'muted small' }, 'El orden de los pasillos es el orden de tu recorrido en la tienda: así se acomoda la lista de compras.'), box),
    actions: [{ label: 'Listo', kind: 'primary' }],
  });
}

function move(list, i, dir) {
  const arr = list.slice();
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  S.putMany('aisles', arr.map((a, k) => ({ ...a, order: k })));
}

export async function deleteIngredient(ing) {
  const used = recipesUsing(ing.id);
  const msg = used.length
    ? `"${ing.name}" se usa en: ${used.map(r => r.name).join(', ')}. Se quitará de esos platillos.`
    : `Se eliminará "${ing.name}".`;
  if (!(await confirmDialog(msg, { ok: 'Eliminar', danger: true }))) return false;
  used.forEach(r => S.put('recipes', { ...r, items: r.items.filter(it => it.ingId !== ing.id) }));
  S.remove('ingredients', ing.id);
  S.remove('pantry', ing.id);
  toast('Ingrediente eliminado');
  return true;
}

export function render() {
  const all = S.all('ingredients').sort(S.byName);
  const q = search.trim().toLowerCase();
  const list = all.filter(i => (!q || i.name.toLowerCase().includes(q)) && (!aisleFilter || (i.aisleId || '') === (aisleFilter === '_none' ? '' : aisleFilter)));

  const groups = [];
  const aisles = S.sortedAisles();
  aisles.forEach(a => {
    const items = list.filter(i => i.aisleId === a.id);
    if (items.length) groups.push({ name: a.name, items });
  });
  const orphan = list.filter(i => !i.aisleId || !S.get('aisles', i.aisleId));
  if (orphan.length) groups.push({ name: 'Sin pasillo', items: orphan });

  const searchInp = h('input', {
    class: 'input', type: 'search', placeholder: 'Buscar ingrediente…', value: search, 'data-k': 'ing-search',
    oninput: e => { search = e.target.value; refresh(); },
  });

  const el = h('div', { class: 'page' },
    h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icon('search'), searchInp),
      select([{ value: '', label: 'Todos los pasillos' }, ...aisles.map(a => ({ value: a.id, label: a.name })), { value: '_none', label: 'Sin pasillo' }],
        aisleFilter, v => { aisleFilter = v; refresh(); }, { label: 'Filtrar por pasillo', cls: 'grow-0' }),
      btn('Pasillos', openAisleManager, { kind: 'ghost', icon: 'pantry' }),
      btn('Nuevo', () => openIngredientEditor(null), { kind: 'primary', icon: 'plus' }),
    ),
    !all.length
      ? empty('Aún no tienes ingredientes', 'Agrégalos aquí o directamente al crear un platillo.', btn('Agregar ingrediente', () => openIngredientEditor(null), { kind: 'primary', icon: 'plus' }))
      : !list.length ? empty('Sin resultados')
        : groups.map(g => h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, g.name, h('span', { class: 'count' }, String(g.items.length))),
          h('ul', { class: 'rows' }, g.items.map(i => h('li', { class: 'row clickable', onclick: () => openIngredientEditor(i) },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title' }, i.name),
              h('div', { class: 'row-sub' }, summary(i))),
            h('div', { class: 'row-actions', onclick: e => e.stopPropagation() },
              iconBtn('trash', 'Eliminar', () => deleteIngredient(i), { kind: 'danger' }))))))),
  );
  return { title: 'Ingredientes', el };
}

