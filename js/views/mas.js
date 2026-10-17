// Menú "Más" para celular.
import { h, icon } from '../ui.js';

const ITEMS = [
  { path: 'alacena', label: 'Alacena', icon: 'pantry', text: 'Lo que tienes en casa' },
  { path: 'ingredientes', label: 'Ingredientes', icon: 'leaf', text: 'Catálogo, mermas, unidades y pasillos' },
  { path: 'gastos', label: 'Gastos', icon: 'money', text: 'Cuánto gastas por semana y por mes' },
  { path: 'ajustes', label: 'Ajustes', icon: 'gear', text: 'Sincronización, tema, moneda y respaldo' },
];

export function render() {
  const el = h('div', { class: 'page' },
    h('ul', { class: 'menu-list' }, ITEMS.map(i => h('li', null,
      h('a', { class: 'menu-item card', href: '#/' + i.path },
        icon(i.icon, 'menu-ico'),
        h('span', { class: 'menu-text' }, h('strong', null, i.label), h('span', { class: 'muted small' }, i.text)),
        icon('back', 'flip muted'))))));
  return { title: 'Más', el };
}
