/**
 * Mise en forme des textes affichés: gabarits `{nom}`, heures, jours,
 * quantités, noms d'objets, touches. Fonctions pures, testées dans Node.
 */
import { currentOrder } from '../donnees/commandes';
import type { Content, ItemDef } from '../donnees/types';
import type { ItemStack, Quality } from '../etat/types';
import { PROFILE_SYMBOLS, UI_SETTINGS } from './config';

const MINUTES_PER_HOUR = 60;
const PAD = 2;

export type TextVars = Readonly<Record<string, string | number>>;

/** Remplace `{nom}`; un nom inconnu reste tel quel. */
export function fill(template: string, vars: TextVars = {}): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

export function capitalize(text: string): string {
  const first = text.charAt(0);
  return first === '' ? text : first.toLocaleUpperCase('fr') + text.slice(1);
}

export function lowerFirst(text: string): string {
  const first = text.charAt(0);
  return first === '' ? text : first.toLocaleLowerCase('fr') + text.slice(1);
}

/** Heure et minutes (`{hours}` sans zéro, `{minutes}` sur deux chiffres). */
export function timeParts(minutes: number): { hours: number; minutes: string } {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / MINUTES_PER_HOUR) % 24;
  const m = total % MINUTES_PER_HOUR;
  return { hours: h, minutes: String(m).padStart(PAD, '0') };
}

/** Heure de l'horloge du HUD, arrondie au pas inférieur (10 minutes): « 9 h 20 ». */
export function clockTime(minutes: number, template: string, step: number = UI_SETTINGS.clockStepMinutes): string {
  const rounded = Math.floor(minutes / step) * step;
  return fill(template, timeParts(rounded));
}

/** Heure d'un rendez-vous: « 16 h », ou « 16 h 30 ». */
export function hourLabel(minutes: number, template: string): string {
  const parts = timeParts(minutes);
  if (parts.minutes === '00') return fill(template, { hours: parts.hours, minutes: '' }).trimEnd();
  return fill(template, parts);
}

/** Jour de la semaine du jour de la démo (le jour 1 est le premier de la liste). */
export function weekdayOf(day: number, weekdays: readonly string[]): string {
  if (weekdays.length === 0) return '';
  const index = (((day - 1) % weekdays.length) + weekdays.length) % weekdays.length;
  return weekdays[index] ?? '';
}

/** Nom d'un objet au singulier ou au pluriel. */
export function itemName(def: ItemDef | undefined, count: number, fallback = ''): string {
  if (def === undefined) return fallback;
  return count > 1 ? def.plural : def.name;
}

/** Nom d'objet pour un libellé (majuscule initiale): « Graines de radis ». */
export function itemTitle(def: ItemDef | undefined, count: number, fallback = ''): string {
  return capitalize(itemName(def, count, fallback));
}

/** Liste « 12 radis, 3 laitues, 6 œufs, 10 planches » (`textes.orderFormat`). */
export function joinList(parts: readonly string[], format: { separator: string; lastSeparator: string }): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(format.separator)}${format.lastSeparator}${parts[parts.length - 1] ?? ''}`;
}

export function countedList(
  content: Content,
  lines: readonly { item: string; count: number }[],
  format: { line: string; separator: string; lastSeparator: string },
): string {
  return joinList(
    lines.map((l) => fill(format.line, { count: l.count, item: itemName(content.items[l.item], l.count, l.item) })),
    format,
  );
}

/** Variables communes des textes du courrier et des quêtes (comme la simulation). */
export function contentVars(
  content: Content,
  world: { orderIndex: number; orderResult: { linesDone: number; linesTotal: number; amount: number } | null } | null,
  format: { line: string; separator: string; lastSeparator: string },
): Record<string, string | number> {
  const s = content.settings;
  const lines = currentOrder(s, world ?? { orderIndex: 0 }).lines;
  const orderResult = world?.orderResult ?? null;
  return {
    startPurse: s.economy.startPurse,
    bigPurchase: s.economy.bigPurchaseThreshold,
    order: countedList(content, lines, format),
    linesDone: orderResult?.linesDone ?? 0,
    linesTotal: orderResult?.linesTotal ?? lines.length,
    amount: orderResult?.amount ?? 0,
  };
}

/** Libellés réels des touches pour les jetons des astuces (`{move}`, `{act}`, `{examine}`, `{notebook}`). */
export function keyTokens(label: (code: string) => string): Record<string, string> {
  return {
    move: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(label).join(' '),
    act: label('Space'),
    examine: label('KeyX'),
    notebook: label('Tab'),
  };
}

/** Quantité d'un objet dans une liste de piles (toutes qualités, ou une seule). */
export function countIn(stacks: readonly (Readonly<ItemStack> | null)[], item: string, quality?: Quality): number {
  let n = 0;
  for (const s of stacks) {
    if (s !== null && s.item === item && (quality === undefined || s.quality === quality)) n += s.count;
  }
  return n;
}

const HEX = /^#?([0-9a-f]{6})$/i;
const BYTE = 0xff;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;

function rgb(color: string): [number, number, number] | null {
  const m = HEX.exec(color.trim());
  if (m?.[1] === undefined) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> RED_SHIFT) & BYTE, (n >> GREEN_SHIFT) & BYTE, n & BYTE];
}

/** Symbole du profil Duo le plus proche de la couleur du foulard. */
export function profileSymbol(color: string): string {
  const c = rgb(color);
  let best = PROFILE_SYMBOLS[0]?.id ?? 'orb';
  if (c === null) return best;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const p of PROFILE_SYMBOLS) {
    const q = rgb(p.color);
    if (q === null) continue;
    const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = p.id;
    }
  }
  return best;
}

/** Couleur CSS sûre (`#rrggbb`), sinon celle du premier profil. */
export function safeColor(color: string): string {
  const c = rgb(color);
  if (c === null) return PROFILE_SYMBOLS[0]?.color ?? '#5CE1E6';
  return `#${c.map((x) => x.toString(16).padStart(PAD, '0')).join('')}`;
}

/** Prénom saisi: espaces de bord retirés, normalisé, coupé à la longueur maximale. */
export function cleanName(raw: string, max: number = UI_SETTINGS.nameMaxLength): string {
  return Array.from(raw.normalize('NFC').trim()).slice(0, max).join('');
}
