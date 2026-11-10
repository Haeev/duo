/**
 * Modèles de vue purs de l'histoire à l'écran: fin de chapitre et consignes des scènes à deux.
 * Ils lisent `chapterEndView` et `sceneView` (une machine comme l'autre) et ne dessinent rien.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { GestureDef } from '../../donnees/schemas/scene';
import type { ReadonlyWorld } from '../../etat/monde';
import { chapterEndView } from '../../simulation/quetes/lecture';
import { STORY } from '../../simulation/quetes/reglages';
import { sceneView } from '../../simulation/scenes/lecture';
import { HISTOIRE_SETTINGS } from './reglages';

function otherOf(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

// ---------- Fin de chapitre ----------

export interface ChapterEndModel {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** Ce joueur a fermé l'écran: il attend l'autre. */
  readonly closed: boolean;
  /** L'autre joueur l'a déjà fermé: la suite n'attend que toi. */
  readonly otherClosed: boolean;
}

export function chapterEndModel(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): ChapterEndModel | null {
  const view = chapterEndView(world, content, player);
  if (view === null) return null;
  return {
    id: view.id,
    title: view.title,
    lines: view.lines,
    closed: view.closed,
    otherClosed: world.common.story?.ending?.closed[otherOf(player)] ?? false,
  };
}

// ---------- Gestes des scènes à deux ----------

export type RowState = 'idle' | 'active' | 'done';

export interface GestureModel {
  readonly type: GestureDef['type'];
  /** Avancement lu dans l'état (0 à 1), sans l'écho local de la touche. */
  readonly progress: number;
  /** Touche tenue, ou joueur arrivé au point. */
  readonly down: boolean;
  /** Durée demandée (s) pour `hold` et `stand`, `null` pour `press`. */
  readonly seconds: number | null;
  /** `stand`: le point à atteindre (m), le rayon et la distance du joueur à ce point. */
  readonly target: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly distance: number;
  } | null;
}

export interface SceneRowModel {
  readonly who: 'me' | 'other';
  readonly player: PlayerIndex;
  readonly name: string;
  /** Consigne en une phrase (accordée au genre du joueur qui lit). */
  readonly text: string;
  readonly done: boolean;
  readonly state: RowState;
  readonly gesture: GestureModel | null;
}

export interface SceneCardModel {
  readonly scene: string;
  /** Indice du temps en cours: change quand une nouvelle attente commence. */
  readonly beat: number;
  readonly roleName: string | null;
  /** Les consignes de ce joueur d'abord, puis celles de l'autre. */
  readonly rows: readonly SceneRowModel[];
  /** Délai de simultanéité (s) des gestes, `null`: chacun à son tour. */
  readonly together: number | null;
  readonly hasGesture: boolean;
  /** Gestes ensemble: tous sont tenus ou réussis en même temps, maintenant. */
  readonly ensemble: boolean;
  /** Toutes les consignes sont faites. */
  readonly allDone: boolean;
}

/** Les parties d'une attente qui visent ce joueur, dans l'ordre où `sceneView` les liste. */
function partsOf(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): { readonly gesture: GestureDef | null }[] {
  const run = world.common.story?.scene ?? null;
  if (run === null) return [];
  const def = content.places[run.place]?.scenes[run.id];
  const beat = def?.beats[run.beat];
  if (def === undefined || beat?.do !== 'await') return [];
  const role = def.roles === null ? null : run.roleA === player ? 'a' : 'b';
  return beat.parts
    .filter((part) => part.role === 'any' || part.role === role)
    .map((part) => ({ gesture: part.gesture ?? null }));
}

function rowsFor(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
  who: 'me' | 'other',
): SceneRowModel[] {
  const view = sceneView(world, content, player);
  if (view?.beat.kind !== 'await') return [];
  const defs = partsOf(world, content, player);
  const run = world.common.story?.scene ?? null;
  const name = world.players[player].name;
  return view.beat.hints.map((hint, i) => {
    const def = defs[i]?.gesture ?? null;
    let gesture: GestureModel | null = null;
    if (hint.gesture !== null) {
      let target: GestureModel['target'] = null;
      if (def?.type === 'stand' && run !== null) {
        const at = content.places[run.place]?.map.points[def.point];
        const body = world.players[player].body;
        if (at !== undefined)
          target = {
            x: at.x,
            y: at.y,
            radius: def.radius ?? STORY.reachRadius,
            distance: Math.hypot(body.x - at.x, body.y - at.y),
          };
      }
      gesture = {
        type: hint.gesture.type,
        progress: hint.gesture.progress,
        down: hint.gesture.down,
        seconds: def !== null && def.type !== 'press' ? def.seconds : null,
        target,
      };
    }
    const active = gesture !== null && (gesture.down || gesture.progress > 0);
    return {
      who,
      player,
      name,
      text: hint.text,
      done: hint.done,
      state: hint.done ? 'done' : active ? 'active' : 'idle',
      gesture,
    };
  });
}

/**
 * Ce qu'une attente de scène demande à ce joueur et à l'autre. `null`: pas d'attente en cours.
 * Une consigne commune aux deux rôles (`any`) n'apparaît qu'une fois.
 */
export function sceneCardModel(
  world: ReadonlyWorld,
  content: Content,
  me: PlayerIndex,
): SceneCardModel | null {
  const view = sceneView(world, content, me);
  const run = world.common.story?.scene ?? null;
  if (view === null || run === null || view.beat.kind !== 'await') return null;
  const mine = rowsFor(world, content, me, 'me');
  const theirs = rowsFor(world, content, otherOf(me), 'other').filter(
    (row) => !mine.some((m) => m.text === row.text && m.gesture === null && row.gesture === null),
  );
  const rows = [...mine, ...theirs];
  const gestures = rows.filter((row) => row.gesture !== null);
  const together = view.beat.together;
  return {
    scene: view.scene,
    beat: run.beat,
    roleName: view.roleName,
    rows,
    together,
    hasGesture: gestures.length > 0,
    ensemble:
      together !== null &&
      gestures.length >= 2 &&
      gestures.every((row) => row.done || row.gesture?.down === true),
    allDone: rows.length > 0 && rows.every((row) => row.done),
  };
}

/**
 * Avancement montré (0 à 1). Le joueur voit sa touche répondre tout de suite: tant qu'elle est
 * tenue, la jauge avance sans attendre l'état de l'hôte (qui peut arriver une image plus tard chez
 * l'invité), sans jamais afficher « fait » avant lui. `heldMs`: durée de la touche tenue ici
 * (`null`: relâchée).
 */
export function shownProgress(row: SceneRowModel, heldMs: number | null): number {
  const gesture = row.gesture;
  if (row.done) return 1;
  if (gesture === null) return 0;
  if (row.who !== 'me' || heldMs === null) return gesture.progress;
  if (gesture.type === 'hold' && gesture.seconds !== null)
    return Math.max(
      gesture.progress,
      Math.min(HISTOIRE_SETTINGS.echoCap, heldMs / 1000 / gesture.seconds),
    );
  if (gesture.type === 'press' && heldMs <= HISTOIRE_SETTINGS.pressEchoMs) return 1;
  return gesture.progress;
}

/** État montré d'une consigne, avec l'écho de la touche tenue. */
export function shownState(row: SceneRowModel, heldMs: number | null): RowState {
  if (row.done) return 'done';
  if (row.state === 'active') return 'active';
  const echo =
    row.who === 'me' &&
    heldMs !== null &&
    (row.gesture?.type === 'hold' || row.gesture?.type === 'press');
  return echo ? 'active' : 'idle';
}
