// Recordatorios de los horarios de comida.
// Sin servidor no hay notificaciones "push": solo funcionan mientras la app está abierta
// o en segundo plano (más confiable con la app instalada, sobre todo en Android).
import * as S from './store.js';
import { mealsFor, isoDate } from './calc.js';
import { planForDay, getLog } from './tracking.js';
import { toast } from './ui.js';

const LS_SENT = 'midieta.reminders.sent';
const WINDOW_MIN = 20; // si la app se abre hasta 20 min tarde, todavía avisa

export function settings() {
  return { enabled: !!S.pref('remindersOn', false), offset: Number(S.pref('remindersOffset', 0)) || 0 };
}

export function supported() {
  return 'Notification' in window;
}

export function permission() {
  return supported() ? Notification.permission : 'unsupported';
}

export async function enable() {
  if (supported() && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) { /* navegador sin soporte */ }
  }
  S.setPref('remindersOn', true);
  check();
  return permission();
}

export function disable() {
  S.setPref('remindersOn', false);
}

export function setOffset(min) {
  S.setPref('remindersOffset', Number(min) || 0);
}

function sentMap() {
  try { return JSON.parse(localStorage.getItem(LS_SENT) || '{}'); } catch (e) { return {}; }
}

function markSent(key) {
  const map = sentMap();
  map[key] = Date.now();
  // Limpia avisos de días anteriores.
  const today = isoDate(new Date());
  Object.keys(map).forEach(k => { if (!k.startsWith(today)) delete map[k]; });
  try { localStorage.setItem(LS_SENT, JSON.stringify(map)); } catch (e) { /* sin almacenamiento */ }
}

// Comidas que tocan avisar ahora mismo.
export function due(now = new Date()) {
  const st = settings();
  const iso = isoDate(now);
  const plan = planForDay(iso);
  if (!plan) return [];
  const log = getLog(iso);
  const sent = sentMap();
  const out = [];
  for (const m of mealsFor(plan, now.getDay())) {
    if (!m.time || !m.entries.length) continue;
    if (log && log.eaten && log.eaten[m.id]) continue;
    const key = `${iso}|${m.id}|${m.time}`;
    if (sent[key]) continue;
    const [hh, mm] = m.time.split(':').map(Number);
    const at = new Date(now);
    at.setHours(hh, mm - st.offset, 0, 0);
    const diff = (now - at) / 60000;
    if (diff >= 0 && diff <= WINDOW_MIN) out.push({ key, meal: m });
  }
  return out;
}

async function notify(meal, offset) {
  const names = meal.entries.map(e => (S.get('recipes', e.recipeId) || {}).name).filter(Boolean).join(', ');
  const title = offset ? `En ${offset} min: ${meal.name}` : `Hora de: ${meal.name}`;
  const body = names || 'Revisa tu menú de hoy';
  let shown = false;
  if (permission() === 'granted') {
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, { body, tag: 'comida-' + meal.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/hoy' } });
      } else {
        const n = new Notification(title, { body, tag: 'comida-' + meal.id, icon: 'icons/icon-192.png' });
        n.onclick = () => { window.focus(); location.hash = '#/hoy'; n.close(); };
      }
      shown = true;
    } catch (e) { shown = false; }
  }
  if (document.visibilityState === 'visible' || !shown) toast(`${title} · ${body}`, 'ok', 6000);
}

export function check() {
  if (!settings().enabled) return;
  const list = due();
  list.forEach(({ key, meal }) => {
    markSent(key);
    notify(meal, settings().offset);
  });
}

export function init() {
  setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 2000);
}
