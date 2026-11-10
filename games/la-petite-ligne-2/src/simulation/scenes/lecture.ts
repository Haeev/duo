/**
 * Ce que chaque machine affiche d'une scène en cours (lot L7 pour la bulle et la consigne, L4
 * pour la caméra suggérée et le fondu). Fonction pure sur l'état reçu: l'invité la lit comme l'hôte.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { BeatDef, Focus, Role } from '../../donnees/schemas/scene';
import type { ReadonlyWorld } from '../../etat/monde';
import { agreeFor } from '../dialogues/accords';
import { audienceOf, playerOfRole } from './lecteur';

export type SceneBeatView =
  | {
      readonly kind: 'say';
      /** Habitant, `a`/`b` (personnage d'un joueur, voir `speakerPlayer`) ou `narrator`. */
      readonly speaker: string;
      readonly speakerPlayer: PlayerIndex | null;
      readonly text: string;
      readonly emote: Extract<BeatDef, { do: 'say' }>['emote'];
      readonly sound: string | null;
      /** La réplique s'adresse à ce joueur (sinon: il voit seulement que l'autre lit). */
      readonly mine: boolean;
      readonly read: boolean;
    }
  | {
      readonly kind: 'await';
      /** Consignes de ce joueur (son rôle, ou `any`), et si elles sont faites. */
      readonly hints: readonly { readonly text: string; readonly done: boolean }[];
    }
  | { readonly kind: 'other' };

export interface SceneView {
  readonly scene: string;
  readonly title: string;
  readonly role: Role | null;
  readonly roleName: string | null;
  readonly beat: SceneBeatView;
  /** Caméra suggérée tant qu'elle dure, `null`: libre. */
  readonly camera: { readonly x: number; readonly y: number } | null;
  readonly fade: 'black' | 'clear';
}

function focusAt(
  world: ReadonlyWorld,
  content: Content,
  place: string,
  focus: Focus,
): { x: number; y: number } | null {
  if ('point' in focus) return content.places[place]?.map.points[focus.point] ?? null;
  const body = world.places[place]?.villagers[focus.villager]?.body;
  return body === undefined ? null : { x: body.x, y: body.y };
}

export function sceneView(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): SceneView | null {
  const run = world.common.story?.scene ?? null;
  if (run === null) return null;
  const def = content.places[run.place]?.scenes[run.id];
  const beat = def?.beats[run.beat];
  if (def === undefined || beat === undefined) return null;
  const role: Role | null = def.roles === null ? null : run.roleA === player ? 'a' : 'b';
  let view: SceneBeatView = { kind: 'other' };
  if (beat.do === 'say') {
    view = {
      kind: 'say',
      speaker: beat.who,
      speakerPlayer: beat.who === 'a' || beat.who === 'b' ? playerOfRole(run, beat.who) : null,
      text: agreeFor(world, player, beat.text),
      emote: beat.emote,
      sound: beat.sound,
      mine: audienceOf(run, beat.to).includes(player),
      read: run.read[player],
    };
  } else if (beat.do === 'await') {
    view = {
      kind: 'await',
      hints: beat.parts.flatMap((part, i) =>
        part.role === 'any' || part.role === role
          ? [{ text: agreeFor(world, player, part.hint), done: run.parts[i] === true }]
          : [],
      ),
    };
  }
  const camera =
    run.camera !== null && run.camera.until > world.tick
      ? focusAt(world, content, run.place, run.camera.focus)
      : null;
  return {
    scene: def.id,
    title: def.title,
    role,
    roleName: def.roles === null || role === null ? null : def.roles[role],
    beat: view,
    camera,
    fade: run.fade,
  };
}
