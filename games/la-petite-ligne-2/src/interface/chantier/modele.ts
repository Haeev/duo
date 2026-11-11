/**
 * Écran de chantier: modèle de vue pur. Ce que la pièce demande (matériaux apportés sur demandés,
 * somme due, travail restant), qui travaille, ce qui la verrouille encore, et le texte en clair
 * de chaque refus de la simulation. Lu dans l'état transmis: l'hôte et l'invité voient la même
 * chose, en direct.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Look } from '../../simulation/briques/types';
import { currentStage, stageReady, stageRefusal } from '../../simulation/logement/chantier';
import { HOUSING_TUNING } from '../../simulation/logement/reglages';
import { formatEuros } from '../../simulation/sac/argent';
import { UI_TUNING } from '../reglages';
import { fill } from '../textes';
import { isSiteRefusal, SITE_TEXTS as T } from './textes';

/**
 * Le travail restant dit dans l'unité du joueur: la règle compte en secondes de marteau
 * (`stage.work`), le joueur en « encore un peu ». `todo`: rien de fait encore; les autres
 * paliers se lisent sur les secondes qu'il faudrait au rythme du moment (`UI_TUNING.worksiteFeel`).
 */
export type WorkFeel = 'todo' | 'long' | 'while' | 'little' | 'almost' | 'done';

export function workFeel(work: {
  readonly total: number;
  readonly done: number;
  readonly left: number;
}): WorkFeel {
  if (work.done >= work.total) return 'done';
  if (work.done <= 0) return 'todo';
  const { almostS, littleS, whileS } = UI_TUNING.worksiteFeel;
  if (work.left <= almostS) return 'almost';
  if (work.left <= littleS) return 'little';
  if (work.left <= whileS) return 'while';
  return 'long';
}

export type SiteGesture = 'supply' | 'pay' | 'work';
export const SITE_GESTURES: readonly SiteGesture[] = ['supply', 'pay', 'work'];

export interface SiteMaterial {
  readonly item: string;
  readonly name: string;
  readonly need: number;
  readonly delivered: number;
  /** Ce que ce joueur en a dans son sac et sa barre. */
  readonly inBag: number;
}

export interface WorksiteModel {
  readonly housing: string;
  readonly room: string;
  readonly houseName: string;
  readonly roomName: string;
  /** Pièce finie: l'écran montre l'indice de l'histoire, plus aucun geste. */
  readonly done: boolean;
  readonly clue: string | null;
  readonly stage: { readonly name: string; readonly index: number; readonly count: number } | null;
  readonly materials: readonly SiteMaterial[];
  readonly cost: {
    readonly total: number;
    readonly due: number;
    readonly chest: number;
    /** Part prise au coffre commun, puis à la bourse de ce joueur, s'il payait maintenant. */
    readonly fromChest: number;
    readonly fromPurse: number;
    /** Ce qui manquerait encore, coffre et bourse vidés (0: on peut payer). */
    readonly missing: number;
  };
  readonly work: {
    /** Secondes de travail d'un joueur seul. */
    readonly total: number;
    readonly done: number;
    /** Secondes restantes au rythme actuel (seul, ou à deux). */
    readonly left: number;
    readonly workers: readonly [boolean, boolean];
    readonly rate: number;
    readonly ready: boolean;
  };
  /** Ce qui ferme encore tout le chantier (autre pièce, histoire), avec sa phrase. */
  readonly lock: { readonly reason: string; readonly text: string } | null;
  /** Gestes encore utiles: un geste accompli (tout apporté, tout payé) reste montré, coché. */
  readonly todo: Readonly<Record<SiteGesture, boolean>>;
}

/** Ce que le joueur a de cet objet, barre et sac réunis (lecture seule de l'état transmis). */
function carried(player: ReadonlyWorld['players'][number], item: string): number {
  let total = 0;
  for (const stack of [...player.toolbar, ...(player.bag?.slots ?? [])])
    if (stack?.item === item) total += stack.count;
  return total;
}

function missingText(materials: readonly SiteMaterial[]): string {
  return materials
    .filter((m) => m.delivered < m.need)
    .map((m) => `${m.name} x ${String(m.need - m.delivered)}`)
    .join(', ');
}

/** Le chantier d'une pièce vu par ce joueur, `null`: logement ou pièce inconnus du lieu courant. */
export function worksiteModel(
  look: Look,
  me: PlayerIndex,
  housing: string,
  room: string,
): WorksiteModel | null {
  const { content, world } = look;
  const place = content.places[world.common.place];
  const def = place?.housings[housing];
  const roomDef = def?.rooms.find((r) => r.id === room);
  if (place === undefined || def === undefined || roomDef === undefined) return null;
  const state = world.places[world.common.place]?.housing?.[housing];
  const current = currentStage(roomDef, state);
  const player = world.players[me];
  const base = { housing, room, houseName: def.name, roomName: roomDef.name };
  const chest = world.common.chest;
  if (current === null)
    return {
      ...base,
      done: true,
      clue: roomDef.clue,
      stage: null,
      materials: [],
      cost: { total: 0, due: 0, chest, fromChest: 0, fromPurse: 0, missing: 0 },
      work: { total: 0, done: 0, left: 0, workers: [false, false], rate: 1, ready: false },
      lock: null,
      todo: { supply: false, pay: false, work: false },
    };
  const { stage, index, progress } = current;
  const materials = stage.materials.map((m) => ({
    item: m.item,
    name: content.items[m.item]?.name ?? m.item,
    need: m.count,
    delivered: Math.min(m.count, progress.delivered[m.item] ?? 0),
    inBag: carried(player, m.item),
  }));
  const due = Math.max(0, stage.cost - progress.paid);
  const fromChest = Math.min(chest, due);
  const fromPurse = due - fromChest;
  const workers: [boolean, boolean] = [state?.working[0] === room, state?.working[1] === room];
  const rate = workers[0] && workers[1] ? HOUSING_TUNING.duoWorkRate : 1;
  const workDone = Math.min(stage.work, progress.work);
  const refusal = stageRefusal(look, me, place, state, roomDef);
  let lock: WorksiteModel['lock'] = null;
  if (refusal === 'room-needs-other') {
    const names = roomDef.requires
      .filter((id) => state?.rooms[id]?.state !== 'restored')
      .map((id) => def.rooms.find((r) => r.id === id)?.name ?? id);
    lock = { reason: refusal, text: fill(T.lockRooms, { pieces: names.join(', ') }) };
  } else if (refusal === 'room-story-not-yet')
    lock = { reason: refusal, text: stage.says ?? T.lockStory };
  return {
    ...base,
    done: false,
    clue: roomDef.clue,
    stage: { name: stage.name, index, count: roomDef.stages.length },
    materials,
    cost: {
      total: stage.cost,
      due,
      chest,
      fromChest,
      fromPurse,
      missing: Math.max(0, fromPurse - player.money),
    },
    work: {
      total: stage.work,
      done: workDone,
      left: Math.ceil((stage.work - workDone) / rate),
      workers,
      rate,
      ready: stageReady(stage, progress),
    },
    lock,
    todo: {
      supply: materials.some((m) => m.delivered < m.need),
      pay: due > 0,
      work: stage.work > workDone,
    },
  };
}

/** Le premier geste encore utile, dans l'ordre du chantier (apporter, payer, travailler). */
export function firstTodo(model: WorksiteModel): SiteGesture {
  return SITE_GESTURES.find((g) => model.todo[g]) ?? 'work';
}

/** Le refus de la simulation, en clair: ce qui manque, combien, pourquoi. */
export function siteRefusalText(model: WorksiteModel | null, reason: string): string {
  const lock = model?.lock ?? null;
  if (lock?.reason === reason) return lock.text;
  if (!isSiteRefusal(reason)) return T.refusalDefault;
  const cents = reason === 'room-not-paid' ? model?.cost.due : model?.cost.missing;
  return fill(T.refusals[reason], {
    manque: model === null ? '' : missingText(model.materials),
    montant: formatEuros(cents ?? 0),
  });
}
