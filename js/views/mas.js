// Menú "Más" para celular.
import { h, icon } from '../ui.js';
import { showTutorial } from '../tutorial.js';

const ITEMS = [
  { path: 'progreso', label: 'Progreso', icon: 'chart', text: 'Peso, cumplimiento e historial' },
  { path: 'ingredientes', label: 'Ingredientes', icon: 'leaf', text: 'Catálogo, mermas, unidades y pasillos' },
  { path: 'gastos', label: 'Gastos', icon: 'money', text: 'Cuánto gastas por semana y por mes' },
  { path: 'ajustes', label: 'Ajustes', icon: 'gear', text: 'Sincronización, recordatorios, moneda y respaldo' },
  { path: 'buscar', label: 'Buscar', icon: 'search', text: 'Platillos, ingredientes, dietas, listas y notas' },
  { path: 'papelera', label: 'Papelera', icon: 'trash', text: 'Recupera lo que borraste' },
];

export function render() {
  const el = h('div', { class: 'page' },
    h('ul', { class: 'menu-list' }, ITEMS.map(i => h('li', null,
      h('a', { class: 'menu-item card', href: '#/' + i.path },
        icon(i.icon, 'menu-ico'),
        h('span', { class: 'menu-text' }, h('strong', null, i.label), h('span', { class: 'muted small' }, i.text)),
        icon('back', 'flip muted'))))),
    h('button', { type: 'button', class: 'menu-item card', onclick: showTutorial },
      icon('star', 'menu-ico'),
      h('span', { class: 'menu-text' }, h('strong', null, 'Cómo funciona'), h('span', { class: 'muted small' }, 'Ver el tutorial otra vez'))));
  return { title: 'Más', el };
}
