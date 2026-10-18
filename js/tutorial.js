// Tutorial de bienvenida: pasos cortos para entender la app.
import * as S from './store.js';
import { h, btn, icon, modal } from './ui.js';

const STEPS = [
  {
    icon: 'leaf', title: 'Bienvenido a Mi Dieta',
    text: 'Aquí guardas tu dieta, tus platillos y tu lista de compras. Todo se guarda en este dispositivo y, si conectas la sincronización, en todos tus dispositivos.',
  },
  {
    icon: 'leaf', title: '1. Ingredientes',
    text: 'Agrega lo que compras: pasillo del súper, unidad de compra (g, kg, lb, l, piezas…), mermas y % extra. Si algo lo pesas pero lo compras por litro o por pieza, pon la densidad o los gramos por pieza.',
  },
  {
    icon: 'dish', title: '2. Platillos',
    text: 'Arma tus platillos con sus ingredientes y cantidades. Marca "Cocido" si lo pesas ya cocinado; la lista lo convierte a crudo con la merma. Si tu nutriólogo te dio los macros del platillo, captúralos ahí.',
  },
  {
    icon: 'plan', title: '3. Dieta',
    text: 'Crea tu dieta con tiempos de comida y horarios, y pon tus platillos en cada uno. Es igual todos los días, pero puedes personalizar cualquier día de la semana.',
  },
  {
    icon: 'cart', title: '4. Lista de compras',
    text: 'Genera la lista para los días que quieras, escribe lo que ya tienes y solo te pedirá lo que falta. Marca lo que vas comprando y al final captura el ticket y los precios.',
  },
  {
    icon: 'today', title: '5. Hoy y Progreso',
    text: 'En Hoy ves tu menú y marcas "Lo comí". Si comiste algo diferente, toca "Comí otra cosa" y escribe qué fue y sus macros. En Progreso registras tu peso y ves tu cumplimiento, tus dietas anteriores y cómo vas.',
  },
  {
    icon: 'cloud', title: '6. Tus datos',
    text: 'En Ajustes conecta la sincronización con tu gist, activa recordatorios y descarga respaldos. Si borras algo por error, búscalo en la Papelera.',
  },
];

export function shouldShow() {
  return !S.pref('tutorialSeen', false);
}

export function showTutorial() {
  let i = 0;
  const box = h('div', { class: 'tutorial' });
  let m = null;
  const finish = () => { S.setPref('tutorialSeen', true); if (m) m.close(); };
  const draw = () => {
    const st = STEPS[i];
    box.replaceChildren(
      h('div', { class: 'tutorial-icon' }, icon(st.icon)),
      h('h3', null, st.title),
      h('p', null, st.text),
      h('div', { class: 'tutorial-dots' }, STEPS.map((_, k) => h('span', { class: 'dot' + (k === i ? ' active' : '') }))),
      h('div', { class: 'btn-row tutorial-nav' },
        i > 0 ? btn('Anterior', () => { i--; draw(); }, { kind: 'ghost' }) : btn('Saltar', finish, { kind: 'ghost' }),
        i < STEPS.length - 1 ? btn('Siguiente', () => { i++; draw(); }, { kind: 'primary' }) : btn('Empezar', finish, { kind: 'primary', icon: 'check' })));
  };
  draw();
  m = modal({ title: 'Cómo funciona', body: box, onClose: () => S.setPref('tutorialSeen', true) });
}
