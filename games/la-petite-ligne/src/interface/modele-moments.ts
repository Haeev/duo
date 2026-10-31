/**
 * Moments rares vus de l'interface (tour 6): ligne d'observation et anneau sous l'horloge,
 * confidence du matin. Fonctions pures (aucun DOM), testées dans Node; la simulation décide,
 * l'interface ne fait que dire ce qu'elle a décidé et ce qui manque encore.
 */
import type { MomentWatch } from '../donnees/types';
import { activeWatch, momentDef, watchTarget } from '../etat/moments';
import type { DeepReadonly, MomentToday, ReadonlyWorld } from '../etat/types';
import { UI_SETTINGS } from './config';
import { type ReadonlyCharacter, type UiContext, characterOf, nameOf } from './contexte';
import { keyTokens } from './format';

// ---------------------------------------------------------------------------
// Ligne d'observation

/**
 * `pose`: ce joueur n'est pas encore dans la pose demandée; `partner`: lui y est, l'autre manque;
 * `together`: les deux y sont, l'anneau se remplit; `early`: les deux y sont, trop tôt (les oies);
 * `climax`: l'apogée joue (anneau plein, puis il s'efface).
 */
export type WatchTone = 'pose' | 'partner' | 'together' | 'early' | 'climax';

export interface WatchModel {
  /** Identité de ce qui est dit: un changement de clé passe par le délai de `SteadyWatch`. */
  key: string;
  tone: WatchTone;
  /** Ligne principale, ou `null` (l'anneau seul). */
  line: string | null;
  /** Seconde ligne, plus petite (l'autre est déjà en place), ou `null`. */
  detail: string | null;
  /** Remplissage de l'anneau autour de l'horloge (0 à 1), ou `null` s'il est caché. */
  ring: number | null;
}

/** Ce joueur peut-il regarder (dehors, sans menu ni conversation, éveillé) ? Même règle que la simulation. */
function free(world: ReadonlyWorld, c: ReadonlyCharacter): boolean {
  return c.created && !c.inHouse && c.menu === null && c.dialogue === null && c.status === 'active' && !c.absent && world.scene === null;
}

function angleGap(a: number, b: number): number {
  let diff = Math.abs(a - b) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff;
}

/**
 * La première chose qui manque à ce joueur pour remplir sa part, en mots (`null`: rien ne
 * manque, ou il est trop loin pour qu'on lui en parle). Même ordre que `watchPart` de la
 * simulation: rayon, immobilité et regard, banc, place tenue.
 */
function missingPose(ctx: UiContext, c: ReadonlyCharacter, w: DeepReadonly<MomentWatch>, target: { x: number; y: number }): string | null {
  const pose = ctx.texts.extra.moments.pose;
  const vars = keyTokens(ctx.key);
  const d = Math.hypot(target.x - c.pos.x, target.y - c.pos.y);
  if (d > w.radius + UI_SETTINGS.watchNearMargin) return null;
  if (w.hold !== null && (c.holding === null || !w.hold.includes(c.holding))) return ctx.t(pose.hold, vars);
  if (d > w.radius) return ctx.t(pose.close);
  if (d < w.minRadius) return ctx.t(pose.tooClose);
  if (w.seated && c.seat?.bench !== w.bench) return ctx.t(pose.seated, vars);
  const moving = w.still && c.speed >= ctx.content.settings.moments.stillSpeed;
  const turned = !w.facing || d < 0.5 || angleGap(Math.atan2(target.y - c.pos.y, target.x - c.pos.x), c.facing) <= UI_SETTINGS.lookCone;
  if (moving && !turned) return ctx.t(pose.stillFacing);
  if (moving) return ctx.t(pose.still);
  if (!turned) return ctx.t(w.still ? pose.stillFacing : pose.facing);
  return null;
}

function ringOf(today: DeepReadonly<MomentToday>, w: DeepReadonly<MomentWatch>): number {
  const needed = Math.max(1, Math.round(w.holdSeconds * UI_SETTINGS.simHz));
  return Math.max(0, Math.min(1, today.watchTicks / needed));
}

/**
 * Ce que dit la ligne sous l'horloge pour ce joueur, ou `null` (rien à dire: pas de moment,
 * trop loin, dans un menu, après l'apogée). Pendant l'attente: la pose demandée, puis
 * « {partner} n'est pas encore là. », puis « Sans bouger... » et l'anneau qui se remplit chez
 * les deux. Pendant l'apogée: l'anneau plein, sauf l'échelle lâchée (la place à reprendre).
 */
export function watchModel(world: ReadonlyWorld, ctx: UiContext): WatchModel | null {
  const today = world.moments.today;
  if (today === null) return null;
  const def = momentDef(ctx.content, today.id);
  const me = characterOf(world, ctx.me);
  const other = characterOf(world, ctx.partner);
  if (def === null || me === null || other === null || !free(world, me)) return null;
  const w = activeWatch(def, today);
  const m = ctx.texts.extra.moments;
  const partner = { partner: nameOf(world, ctx.partner) };
  const messages = ctx.texts.messages;

  if (today.phase === 'climax') {
    if (today.paused) {
      // L'échelle lâchée: celui qui ne tient plus reprend sa place, l'autre sait qui attendre.
      const mine = me.holding === null || (w.hold !== null && !w.hold.includes(me.holding));
      const line = mine ? ctx.t(m.pose.hold, keyTokens(ctx.key)) : ctx.t(m.partnerLetGo, partner);
      return { key: `paused:${mine ? 'self' : 'partner'}`, tone: mine ? 'pose' : 'partner', line, detail: null, ring: null };
    }
    return { key: 'climax', tone: 'climax', line: null, detail: null, ring: 1 };
  }
  if (today.phase !== 'waiting') return null;

  const target = watchTarget(ctx.map, def, w.target, today);
  const selfOk = today.watching[ctx.me];
  const partnerOk = today.watching[ctx.partner];
  if (!selfOk) {
    const line = missingPose(ctx, me, w, target);
    if (line === null) return null;
    const detail = partnerOk ? ctx.t(m.partnerReady, partner) : null;
    return { key: `pose:${line}|${detail ?? ''}`, tone: 'pose', line, detail, ring: null };
  }
  if (today.early) {
    return { key: 'early', tone: 'early', line: ctx.t(messages.geese_not_yet ?? ''), detail: null, ring: null };
  }
  if (!partnerOk) {
    // L'autre est là mais pas dans la pose: on ne dit pas qu'il manque (ce qui se voit est vrai).
    const d = Math.hypot(target.x - other.pos.x, target.y - other.pos.y);
    const here = free(world, other) && d <= w.radius + UI_SETTINGS.watchNearMargin;
    const line = here ? ctx.t(m.partnerNotSettled, partner) : ctx.t(messages.moment_watch_partner ?? '', partner);
    return { key: here ? 'partner:here' : 'partner', tone: 'partner', line, detail: null, ring: null };
  }
  return { key: 'together', tone: 'together', line: ctx.t(messages.moment_watch_self ?? ''), detail: null, ring: ringOf(today, w) };
}

/**
 * Stabilise la ligne d'observation: une nouvelle ligne (ou sa disparition) doit tenir
 * `settleMs` avant d'être affichée, pour qu'un pas de trop au bord du rayon ou l'élan
 * résiduel de l'invité ne la fassent pas clignoter. La même ligne se met à jour aussitôt
 * (l'anneau qui se remplit); l'apogée s'affiche sans attendre.
 */
export class SteadyWatch {
  private shown: WatchModel | null = null;
  private pending: { model: WatchModel | null; since: number } | null = null;

  constructor(private readonly settleMs: number = UI_SETTINGS.watchSettleMs) {}

  next(model: WatchModel | null, now: number): WatchModel | null {
    const key = model?.key ?? '';
    if (key === (this.shown?.key ?? '')) {
      this.shown = model;
      this.pending = null;
      return this.shown;
    }
    if (this.pending === null || (this.pending.model?.key ?? '') !== key) this.pending = { model, since: now };
    else this.pending.model = model;
    if (model?.tone === 'climax' || now - this.pending.since >= this.settleMs) {
      this.shown = model;
      this.pending = null;
    }
    return this.shown;
  }
}

// ---------------------------------------------------------------------------
// Confidence du matin

export interface MomentHintModel {
  moment: string;
  overline: string;
  chip: string;
  text: string;
  help: string;
}

/**
 * La confidence du matin de ce joueur (`characters[me].momentHint`), ou `null`. Elle n'est
 * jamais lue chez l'autre: c'est l'état de ce personnage seul, et la simulation l'efface à
 * l'apogée ou au départ du moment.
 */
export function momentHintModel(world: ReadonlyWorld, ctx: UiContext): MomentHintModel | null {
  const me = characterOf(world, ctx.me);
  const hint = me?.momentHint ?? null;
  if (hint === null || hint.text.trim() === '') return null;
  const m = ctx.texts.extra.moments;
  return {
    moment: hint.moment,
    overline: ctx.t(m.hintOverline),
    chip: ctx.t(m.hintChip),
    text: ctx.t(hint.text),
    help: ctx.t(m.hintHelp, { partner: nameOf(world, ctx.partner) }),
  };
}
