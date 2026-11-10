/**
 * Modèles de vue de l'interface: fonctions pures et petites machines à états, sans DOM, testées
 * dans Node. Les composants (`hud.ts`, `dialogue.ts`, `carnet.ts`...) ne font que les dessiner.
 */
import type { Content } from '../donnees/charger';
import type { NeedState } from '../donnees/schemas/besoins';
import type { NeedId, PlayerIndex } from '../donnees/schemas/communs';
import type { DeepReadonly, ReadonlyWorld } from '../etat/monde';
import type { Stack } from '../etat/joueur';
import type { Aim } from '../simulation/briques/types';
import { stackLimit } from '../simulation/sac/inventaire';
import { toolWearRatio } from '../simulation/sac/outils';
import { formatEuros } from '../simulation/sac/argent';
import { onPlatform } from '../simulation/voyage/index';
import { UI_TUNING, type UiTuning } from './reglages';
import { fill, refusalText, TEXTS } from './textes';

const NBSP = String.fromCharCode(0xa0);
export const NEEDS: readonly NeedId[] = ['hunger', 'sleep', 'hygiene'];

// ---------- Horloge et bourse ----------

export interface ClockModel {
  readonly time: string;
  readonly day: string;
  readonly night: boolean;
  readonly canSleep: boolean;
  /** Avancement du jour, de 0 (aube) à 1 (crépuscule), pour l'astre du cadran. */
  readonly arc: number;
  readonly money: string;
}

/** « 10 h 40 »: heures et minutes de jeu, espaces insécables. */
export function formatClock(minutes: number): string {
  const total = Math.floor(minutes) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}${NBSP}h${NBSP}${m.toString().padStart(2, '0')}`;
}

export function clockModel(
  world: ReadonlyWorld,
  local: PlayerIndex,
  tuning: UiTuning = UI_TUNING,
): ClockModel {
  const minutes = world.minutes;
  const night = minutes >= tuning.nightFrom || minutes < tuning.nightUntil;
  const span = tuning.nightFrom - tuning.nightUntil;
  const arc = night ? 1 : (minutes - tuning.nightUntil) / span;
  return {
    time: formatClock(minutes),
    day: fill(TEXTS.clock.day, { n: world.common.day }),
    night,
    canSleep: minutes >= tuning.sleepFrom || minutes < tuning.nightUntil,
    arc: Math.max(0, Math.min(1, arc)),
    money: formatEuros(world.players[local].money),
  };
}

// ---------- Besoins ----------

export interface NeedModel {
  readonly need: NeedId;
  readonly value: number;
  readonly state: NeedState;
  readonly visible: boolean;
  /** Bas: hachures, bord en pointillé, battement (sous le seuil ou palier bas). */
  readonly low: boolean;
}

/**
 * Médaillons des besoins: montrés au changement de palier (quelques secondes), tant que la jauge
 * est sous le seuil, et pendant le coup d'œil. Le premier palier lu n'est pas un changement.
 */
export class NeedsWatcher {
  private readonly last = new Map<NeedId, NeedState>();
  private readonly until = new Map<NeedId, number>();

  constructor(private readonly tuning: UiTuning = UI_TUNING) {}

  update(
    nowMs: number,
    needs: Readonly<Record<NeedId, number>>,
    tiers: Readonly<Record<NeedId, NeedState>>,
    glance: boolean,
  ): NeedModel[] {
    return NEEDS.map((need) => {
      const state = tiers[need];
      const before = this.last.get(need);
      if (before !== undefined && before !== state)
        this.until.set(need, nowMs + this.tuning.tierShowMs);
      this.last.set(need, state);
      const value = needs[need];
      const low = value < this.tuning.lowNeed || state === 'low' || state === 'blocked';
      const recent = nowMs < (this.until.get(need) ?? -1);
      return { need, value, state, low, visible: glance || recent || low };
    });
  }
}

// ---------- Barre d'outils ----------

/** Barre qui se replie après un délai sans changement; le coup d'œil et le carnet la montrent. */
export class ToolbarFold {
  private shownAt = Number.NEGATIVE_INFINITY;
  private signature: string | null = null;

  constructor(private readonly tuning: UiTuning = UI_TUNING) {}

  /** `signature`: case en main et contenu de la barre; un changement la déplie. */
  update(nowMs: number, signature: string): void {
    if (this.signature !== null && signature !== this.signature) this.shownAt = nowMs;
    this.signature = signature;
  }

  /** Dépliée par un geste qui ne change pas l'état (molette sur la case déjà en main). */
  poke(nowMs: number): void {
    this.shownAt = nowMs;
  }

  visible(nowMs: number, pinned: boolean): boolean {
    return pinned || nowMs - this.shownAt < this.tuning.toolbarFoldMs;
  }
}

export interface SlotModel {
  readonly item: string;
  readonly name: string;
  readonly count: number;
  readonly limit: number;
  readonly full: boolean;
  /** Part d'usure restante (0 à 1) d'un outil qui s'use, sinon `null`. */
  readonly wear: number | null;
  readonly edible: boolean;
}

/**
 * Taille d'interface réellement appliquée: celle du réglage, sauf carnet ouvert dans une fenêtre
 * trop petite pour la contenir (le carnet passe avant la taille, sans jamais descendre sous 1).
 */
export function fitScale(
  factor: number,
  notebookOpen: boolean,
  width: number,
  height: number,
): number {
  if (!notebookOpen) return factor;
  const fit = Math.min(width / UI_TUNING.notebookWidthPx, height / UI_TUNING.notebookHeightPx);
  return Math.max(1, Math.min(factor, fit));
}

/** Nom court d'un objet: 4 mots au plus (principe 2). */
export function shortName(name: string, words: number = UI_TUNING.nameWords): string {
  return name.split(/\s+/).filter(Boolean).slice(0, words).join(' ');
}

export function slotModel(content: Content, stack: DeepReadonly<Stack> | null): SlotModel | null {
  if (stack === null) return null;
  const def = content.items[stack.item];
  const limit = stackLimit(content, stack.item);
  const durability = def?.tool?.durability ?? 0;
  return {
    item: stack.item,
    name: shortName(def?.name ?? stack.item),
    count: stack.count,
    limit,
    full: stack.count >= limit && limit > 1,
    wear: durability > 0 ? toolWearRatio(content, stack) : null,
    edible: def?.food !== null && def?.food !== undefined,
  };
}

/** Signature de la barre (case en main et piles), pour ne redessiner qu'au changement. */
export function toolbarSignature(world: ReadonlyWorld, local: PlayerIndex): string {
  const me = world.players[local];
  const slots = me.toolbar.map((s) => (s === null ? '-' : `${s.item}:${s.count}:${s.wear ?? ''}`));
  return `${me.selected ?? 'x'}|${slots.join(',')}`;
}

// ---------- Bulle d'action ----------

export type PromptModel =
  | {
      readonly kind: 'act';
      readonly key: string;
      readonly verb: string;
      readonly refusal: string | null;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: 'board';
      readonly key: string;
      readonly verb: string;
      readonly refusal: string | null;
      readonly waiting: string | null;
    };

/**
 * Ce que dit la bulle: la cible de la touche d'action, sinon, à bord, l'invite pour redescendre
 * (et qui l'on attend). `keys`: libellés des touches selon le clavier réel; on monte et descend
 * par la touche d'action sur le poteau du quai.
 */
export function promptModel(
  content: Content,
  world: ReadonlyWorld,
  local: PlayerIndex,
  aim: Aim | null,
  keys: { readonly act: string; readonly board: string },
): PromptModel | null {
  const me = world.players[local];
  if (me.talk !== null) return null;
  if (aim !== null)
    return {
      kind: 'act',
      key: keys.act,
      verb: aim.verb,
      refusal: aim.refusal === null ? null : refusalText(aim.refusal),
      x: aim.x,
      y: aim.y,
    };
  const look = { content, world };
  if (!onPlatform(look, local)) return null;
  const other: PlayerIndex = local === 0 ? 1 : 0;
  const travel = world.common.travel;
  const otherName = world.players[other].name;
  if (travel?.boarded[local] === true)
    return {
      kind: 'board',
      key: keys.board,
      verb: TEXTS.prompt.unboard,
      refusal: null,
      waiting: travel.boarded[other] ? null : fill(TEXTS.prompt.waitOther, { nom: otherName }),
    };
  // Pas encore à bord: c'est le poteau du quai (brique `travel`) qui porte l'invite, en le visant.
  return null;
}

// ---------- Dialogue ----------

/** Coupe un texte en pages de `lines` lignes de `width` caractères au plus, aux espaces. */
export function paginate(
  text: string,
  width: number = UI_TUNING.charsPerLine,
  lines: number = UI_TUNING.linesPerPage,
): string[] {
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (row === '') row = word;
    else if (row.length + 1 + word.length <= width) row += ` ${word}`;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row !== '') rows.push(row);
  const pages: string[] = [];
  for (let i = 0; i < rows.length; i += lines) pages.push(rows.slice(i, i + lines).join('\n'));
  return pages.length === 0 ? [''] : pages;
}

/**
 * Texte écrit lettre par lettre, avec une pause après la ponctuation forte. `onBabble` part toutes
 * les N lettres (le son, lot L9, le relaie). Animations réduites: tout s'affiche d'un coup.
 */
export class Typewriter {
  private text = '';
  private shown = 0;
  private wait = 0;
  private letters = 0;

  constructor(
    private readonly onBabble: (char: string) => void = () => undefined,
    private readonly tuning: UiTuning = UI_TUNING,
  ) {}

  start(text: string, instant: boolean): void {
    this.text = text;
    this.shown = instant ? text.length : 0;
    this.wait = 0;
    this.letters = 0;
  }

  get visible(): string {
    return this.text.slice(0, this.shown);
  }

  get done(): boolean {
    return this.shown >= this.text.length;
  }

  revealAll(): void {
    this.shown = this.text.length;
  }

  /** Avance de `dtMs`; renvoie vrai si le texte visible a changé. */
  advance(dtMs: number): boolean {
    if (this.done) return false;
    const before = this.shown;
    this.wait -= dtMs;
    const perChar = 1000 / this.tuning.typeCharsPerSecond;
    while (this.wait < 0 && this.shown < this.text.length) {
      const char = this.text.charAt(this.shown);
      this.shown += 1;
      this.wait += perChar;
      if (/[\p{L}\p{N}]/u.test(char)) {
        this.letters += 1;
        if (this.letters % this.tuning.babbleEvery === 1) this.onBabble(char);
      }
      if (/[.!?…]/.test(char)) this.wait += this.tuning.punctuationPauseMs;
    }
    return this.shown !== before;
  }
}

// ---------- Coup d'œil ----------

/** Minuteur du coup d'œil: un appui l'ouvre (ou le relance) pour une durée fixe. */
export class GlanceTimer {
  private until = Number.NEGATIVE_INFINITY;

  constructor(private readonly tuning: UiTuning = UI_TUNING) {}

  open(nowMs: number): void {
    this.until = nowMs + this.tuning.glanceMs;
  }

  active(nowMs: number): boolean {
    return nowMs < this.until;
  }

  /** Part restante, de 1 à 0. */
  left(nowMs: number): number {
    return Math.max(0, Math.min(1, (this.until - nowMs) / this.tuning.glanceMs));
  }
}

/**
 * Direction de l'autre joueur à l'écran, en radians (0: vers le haut de l'écran, positif: sens
 * horaire), et sa distance (m). `yaw`: lacet de la caméra (convention de `entrees/commandes.ts`).
 */
export function otherDirection(
  me: { readonly x: number; readonly y: number },
  other: { readonly x: number; readonly y: number },
  yaw: number,
): { angle: number; distance: number } {
  const dx = other.x - me.x;
  const dy = other.y - me.y;
  const right = dx * Math.cos(yaw) + dy * Math.sin(yaw);
  const up = dx * Math.sin(yaw) - dy * Math.cos(yaw);
  return { angle: Math.atan2(right, up), distance: Math.hypot(dx, dy) };
}

// ---------- Carnet ----------

/** Une case de ses affaires: la barre d'abord (indices 0 à 4), puis le sac. */
export interface SlotRefModel {
  readonly area: 'toolbar' | 'bag';
  readonly index: number;
}

export function slotAt(
  world: ReadonlyWorld,
  local: PlayerIndex,
  linear: number,
): SlotRefModel | null {
  const me = world.players[local];
  if (linear < me.toolbar.length) return { area: 'toolbar', index: linear };
  const bagIndex = linear - me.toolbar.length;
  if (me.bag !== null && bagIndex < me.bag.slots.length) return { area: 'bag', index: bagIndex };
  return null;
}

export function slotCount(world: ReadonlyWorld, local: PlayerIndex): number {
  const me = world.players[local];
  return me.toolbar.length + (me.bag?.slots.length ?? 0);
}

/** Case voisine dans une grille de `columns` colonnes et `count` cases (bords bloquants). */
export function gridMove(
  index: number,
  count: number,
  columns: number,
  dir: 'left' | 'right' | 'up' | 'down',
): number {
  const col = index % columns;
  let next = index;
  if (dir === 'left' && col > 0) next = index - 1;
  if (dir === 'right' && col < columns - 1) next = index + 1;
  if (dir === 'up') next = index - columns;
  if (dir === 'down') next = index + columns;
  return next >= 0 && next < count ? next : index;
}

export function chestModel(
  world: ReadonlyWorld,
  local: PlayerIndex,
): { chest: string; purse: string } {
  return { chest: formatEuros(world.common.chest), purse: formatEuros(world.players[local].money) };
}
