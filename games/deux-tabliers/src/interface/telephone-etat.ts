/**
 * État du téléphone en jeu, sans DOM (ux-telephone 4 et 10.3): pile de navigation gardée entre
 * deux sorties et vidée à la nuit, fil des messages, prix et vedettes préparés pendant le
 * service (H1: ils s'écrivent sur l'ardoise à la fermeture).
 */
import type { PhoneApp, ThreadId } from './contexte';

/** Ordre de l'accueil; A et E bouclent dessus, accueil compris. */
export const PHONE_APPS: readonly PhoneApp[] = [
  'orders',
  'stock',
  'catalogue',
  'menu',
  'discounts',
  'marketing',
  'reports',
  'projects',
  'messages',
  'settings',
];

export interface PhoneScreen {
  readonly app: PhoneApp;
  /** Fil ouvert dans Messages (sinon la liste des conversations). */
  readonly thread?: ThreadId | undefined;
}

export interface PhoneMessage {
  readonly id: number;
  readonly thread: ThreadId;
  readonly text: string;
  readonly day: number;
  readonly minutes: number;
  read: boolean;
}

/** Ligne de l'ardoise retouchée pendant le service. */
export interface PendingLine {
  priceCents?: number;
  star?: boolean;
}

export interface PhoneState {
  /** Écrans ouverts depuis l'accueil (vide: l'accueil). */
  stack: PhoneScreen[];
  /** Défilement de chaque écran, par clé (`orders`, `messages:partner`). */
  readonly scroll: Map<string, number>;
  readonly messages: PhoneMessage[];
  readonly pending: Map<string, PendingLine>;
  lastApp: PhoneApp | null;
  nextId: number;
  /** Filtres du catalogue (famille, style), gardés entre deux sorties. */
  readonly catalogue: { family: string | null; style: string | null };
}

export function createPhoneState(): PhoneState {
  return {
    stack: [],
    scroll: new Map(),
    messages: [],
    pending: new Map(),
    lastApp: null,
    nextId: 1,
    catalogue: { family: null, style: null },
  };
}

export function currentScreen(s: PhoneState): PhoneScreen {
  return s.stack[s.stack.length - 1] ?? { app: 'home' };
}

export function screenKey(screen: PhoneScreen): string {
  return screen.thread === undefined ? screen.app : `${screen.app}:${screen.thread}`;
}

/** Ouvre un écran au-dessus du courant (même écran: rien). */
export function pushScreen(s: PhoneState, screen: PhoneScreen): void {
  const top = currentScreen(s);
  if (screenKey(top) === screenKey(screen)) return;
  if (screen.app === 'home') {
    s.stack = [];
    return;
  }
  s.stack.push(screen);
  s.lastApp = screen.app;
}

/** Retour arrière: `false` s'il n'y a plus rien à fermer (le téléphone se range). */
export function popScreen(s: PhoneState): boolean {
  if (s.stack.length === 0) return false;
  s.stack.pop();
  return true;
}

/** A et E: l'appli voisine dans l'ordre de l'accueil, en boucle (accueil compris). */
export function neighbourApp(current: PhoneApp, delta: -1 | 1): PhoneApp {
  const ring: readonly PhoneApp[] = ['home', ...PHONE_APPS];
  const i = Math.max(0, ring.indexOf(current));
  return ring[(i + delta + ring.length) % ring.length] ?? 'home';
}

/** Remplace l'écran courant par l'appli voisine (l'accueil vide la pile). */
export function switchApp(s: PhoneState, delta: -1 | 1): PhoneApp {
  const next = neighbourApp(currentScreen(s).app, delta);
  if (next === 'home') s.stack = [];
  else {
    s.stack = [{ app: next }];
    s.lastApp = next;
  }
  return next;
}

/** La nuit vide la pile et le défilement: le lendemain, le téléphone s'ouvre sur l'accueil. */
export function resetForNight(s: PhoneState): void {
  s.stack = [];
  s.scroll.clear();
}

export function addMessage(
  s: PhoneState,
  thread: ThreadId,
  text: string,
  day: number,
  minutes: number,
): PhoneMessage {
  const m: PhoneMessage = { id: s.nextId++, thread, text, day, minutes, read: false };
  s.messages.push(m);
  // Le fil garde les 60 derniers messages: assez pour relire la semaine, sans grossir sans fin.
  if (s.messages.length > 60) s.messages.splice(0, s.messages.length - 60);
  return m;
}

export function unread(s: PhoneState, thread?: ThreadId): number {
  return s.messages.filter((m) => !m.read && (thread === undefined || m.thread === thread)).length;
}

export function markRead(s: PhoneState, thread: ThreadId): void {
  for (const m of s.messages) if (m.thread === thread) m.read = true;
}
