/**
 * Barre de progression des actions qui durent (R10) et invite de l'action
 * survolée à la souris (R11). Tout se lit dans l'état de la simulation: la
 * durée réelle de l'action (`action.since`, `action.duration`), l'avancée des
 * chantiers (`elements[].progress`), les coups portés à un arbre (`hits`).
 * Fonctions pures, testées sans DOM.
 */
import type { ActionKind, ReadonlyWorld } from '../etat/types';
import { ACTION_ICONS, UI_SETTINGS } from './config';
import { type ReadonlyCharacter, type UiContext, characterOf } from './contexte';
import { capitalize } from './format';
import { itemIcon } from './modele';
import { roomWorkProgress, sleepVerbText } from './modele-maison';

export type ProgressKind = 'craft' | 'build' | 'chop' | 'gesture';

export interface ProgressModel {
  kind: ProgressKind;
  /** Texte de la barre, prêt à afficher (« À l'établi : Table »). */
  label: string;
  icon: string;
  /** Avancée de 0 à 1. */
  ratio: number;
  /** Chantier tenu à deux (deux fois plus vite). */
  together: boolean;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Avancée d'une action à durée, au pas `tick`. */
function actionRatio(tick: number, since: number, duration: number): number {
  return clamp01((tick - since) / Math.max(1, duration));
}

/** Fabrication ou cuisine en cours: la durée posée par la simulation sur l'action du personnage. */
function craftProgress(
  world: ReadonlyWorld,
  ctx: UiContext,
  me: ReadonlyCharacter,
): ProgressModel | null {
  const job = me.crafting;
  if (job === null) return null;
  const recipe = ctx.content.recipes[job.recipe];
  const txt = ctx.texts.extra.progress;
  const name = capitalize(recipe?.name ?? job.recipe);
  const stove = recipe?.station === 'stove';
  // Sans action à durée (sauvegarde reprise en pleine fabrication), on compte depuis la fin prévue.
  const duration =
    me.action.duration > 0
      ? me.action.duration
      : Math.max(1, (recipe?.seconds ?? 1) * UI_SETTINGS.simHz);
  const since = me.action.duration > 0 ? me.action.since : job.endsAt - duration;
  return {
    kind: 'craft',
    label: ctx.t(stove ? txt.cook : txt.craft, { recipe: name }),
    icon: recipe === undefined ? 'ui-hourglass' : itemIcon(ctx, recipe.output.item),
    ratio: actionRatio(world.tick, since, duration),
    together: false,
  };
}

/**
 * Chantier en cours (porte, toit, poulailler): celui où l'on travaille, sinon celui de l'autre,
 * visible chez les deux. Avancée du chantier entier: éléments finis plus celui qu'on bâtit.
 */
function buildProgress(world: ReadonlyWorld, ctx: UiContext): ProgressModel | null {
  const txt = ctx.texts.extra.progress;
  let found: { name: string; ratio: number; mine: boolean; workers: number } | null = null;
  for (const state of world.constructions) {
    if (state.status !== 'ghost' || state.elements.length === 0) continue;
    const working = state.elements.find((e) => e.workers.length > 0);
    if (working === undefined) continue;
    const mine = working.workers.includes(ctx.me);
    if (found !== null && (found.mine || !mine)) continue;
    const done = state.elements.reduce((sum, e) => sum + (e.done ? 1 : clamp01(e.progress)), 0);
    const def = ctx.content.constructions.find((k) => k.id === state.id);
    found = {
      name: def?.name ?? state.id,
      ratio: clamp01(done / state.elements.length),
      mine,
      workers: working.workers.length,
    };
  }
  // Tour 10: le chantier d'une pièce de la maisonnette (cellier, chambre), avancée de la pièce entière.
  const room = roomWorkProgress(world, ctx);
  if (room !== null && (found === null || (room.mine && !found.mine))) found = room;
  if (found === null) return null;
  const partner = characterOf(world, ctx.partner)?.name ?? '';
  const together = found.workers >= 2;
  const template = together ? txt.buildTogether : found.mine ? txt.build : txt.buildPartner;
  return {
    kind: 'build',
    label: ctx.t(template, { construction: found.name, partner }),
    icon: ACTION_ICONS.hammer ?? 'plank',
    ratio: found.ratio,
    together,
  };
}

/** Arbre entamé près de soi: les coups déjà portés sur ceux qu'il faut (`trees.chopsPerTree`). */
function chopProgress(
  world: ReadonlyWorld,
  ctx: UiContext,
  me: ReadonlyCharacter,
): ProgressModel | null {
  const total = ctx.content.settings.trees.chopsPerTree;
  if (total <= 1) return null;
  const recent = UI_SETTINGS.chopProgressSeconds * UI_SETTINGS.simHz;
  let best: { hits: number; d: number } | null = null;
  for (const t of world.trees) {
    if (t.hits <= 0 || world.tick - t.lastHitTick > recent) continue;
    const d = Math.hypot(t.pos.x - me.pos.x, t.pos.y - me.pos.y);
    if (d > UI_SETTINGS.chopProgressRadius) continue;
    if (best === null || d < best.d) best = { hits: Math.min(total, t.hits), d };
  }
  if (best === null) return null;
  return {
    kind: 'chop',
    label: ctx.t(ctx.texts.extra.progress.chop, { hits: best.hits, total }),
    icon: ACTION_ICONS.chop ?? 'axe',
    ratio: clamp01(best.hits / total),
    together: false,
  };
}

/** Geste assez long pour qu'une barre aide (manger; tout geste à endurance nulle, deux fois plus lent). */
function gestureProgress(
  world: ReadonlyWorld,
  ctx: UiContext,
  me: ReadonlyCharacter,
): ProgressModel | null {
  const a = me.action;
  if (a.duration < UI_SETTINGS.progressMinSeconds * UI_SETTINGS.simHz) return null;
  if (world.tick >= a.since + a.duration) return null;
  const txt = ctx.texts.extra.progress;
  const kind: ActionKind = a.kind;
  return {
    kind: 'gesture',
    label: ctx.t(txt.actions[kind] ?? txt.busy),
    icon: ACTION_ICONS[kind] ?? 'ui-hourglass',
    ratio: actionRatio(world.tick, a.since, a.duration),
    together: false,
  };
}

/** La barre à montrer, ou `null`: fabrication, puis chantier, puis arbre entamé, puis geste long. */
export function progressModel(world: ReadonlyWorld, ctx: UiContext): ProgressModel | null {
  const me = characterOf(world, ctx.me);
  if (me?.created !== true) return null;
  return (
    craftProgress(world, ctx, me) ??
    buildProgress(world, ctx) ??
    chopProgress(world, ctx, me) ??
    gestureProgress(world, ctx, me)
  );
}

export interface AimPromptModel {
  /** Libellé de la commande (« clic »). */
  key: string;
  /** Ce que fera le clic (« Récolter »). */
  text: string;
}

/**
 * Invite de la cible survolée à la souris: la simulation la met dans `aim` avec `source: 'pointer'`
 * quand il y a un geste à y faire (le clic gauche et Espace le prennent alors).
 */
export function aimPromptModel(world: ReadonlyWorld, ctx: UiContext): AimPromptModel | null {
  const me = characterOf(world, ctx.me);
  const aim = me?.aim ?? null;
  if (aim?.source !== 'pointer' || aim.verb === null || me?.placement !== null) return null;
  const txt = ctx.texts.extra.aim;
  // L'après-midi, un lit propose la sieste (tour 10, section 3.4).
  const text = aim.verb === 'sleep' ? sleepVerbText(world, ctx) : txt.verbs[aim.verb];
  if (text === undefined) return null;
  return { key: txt.click, text: ctx.t(text) };
}
