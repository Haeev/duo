/**
 * Chantier d'une pièce: l'objet visible (brique `worksite`, une ardoise de devis) devant lequel
 * les joueurs apportent, paient et travaillent. La pièce le nomme (`site` dans sa fiche): le
 * moteur ne connaît ni maison ni ardoise. La touche d'action ouvre l'écran de chantier
 * (`worksite_opened`); les gestes restent les intentions `housing_supply`, `housing_pay` et
 * `housing_work` (`index.ts`). Lectures pures: l'hôte, l'invité et l'interface jugent pareil.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { HousingDef, RoomDef, StageDef } from '../../donnees/schemas/logement';
import type { HousingState, RoomProgress } from '../../etat/logement';
import type { DeepReadonly } from '../../etat/monde';
import type { BrickBehaviour, Look } from '../briques/types';
import { footprintOf } from '../noyau/obstacles';
import { evaluateAll } from '../regles/conditions';
import { HOUSING_TUNING } from './reglages';

export type WorksiteBrick = Extract<Brick, { brick: 'worksite' }>;

export interface SiteRef {
  readonly housing: HousingDef;
  readonly room: RoomDef;
}

/** La pièce dont cet objet de la carte porte le chantier, `null`: aucune. */
export function siteRoom(place: PlaceContent, object: string): SiteRef | null {
  for (const housing of Object.values(place.housings))
    for (const room of housing.rooms) if (room.site === object) return { housing, room };
  return null;
}

/**
 * À portée de la pièce pour y apporter, payer ou travailler: près de son sol, ou près de son
 * chantier quand il se tient ailleurs (le pied de l'escalier d'un étage pas encore bâti).
 */
export function nearRoom(
  look: Look,
  place: PlaceContent,
  room: RoomDef,
  x: number,
  y: number,
): boolean {
  const a = room.area;
  const r = HOUSING_TUNING.reach;
  if (x >= a.x - r && x <= a.x + a.w + r && y >= a.y - r && y <= a.y + a.h + r) return true;
  if (room.site === undefined) return false;
  const site = place.map.objects.find((o) => o.id === room.site);
  const def = site === undefined ? undefined : look.content.props[site.type];
  if (site === undefined || def === undefined) return false;
  const size = footprintOf(def, site.rotation);
  const nx = Math.max(site.x - size.w / 2, Math.min(x, site.x + size.w / 2));
  const ny = Math.max(site.y - size.h / 2, Math.min(y, site.y + size.h / 2));
  return Math.hypot(x - nx, y - ny) <= r;
}

/** L'étape en cours d'une pièce et son avancement, `null`: pièce finie ou sans étape. */
export function currentStage(
  room: RoomDef,
  state: DeepReadonly<HousingState> | undefined,
): { stage: StageDef; index: number; progress: DeepReadonly<RoomProgress> } | null {
  const progress = state?.rooms[room.id];
  if (progress === undefined || progress.state === 'restored') return null;
  const stage = room.stages[progress.stage];
  return stage === undefined ? null : { stage, index: progress.stage, progress };
}

/** Tout ce que l'étape demande avant le travail est-il là (matériaux, argent) ? */
export function stageReady(stage: StageDef, progress: DeepReadonly<RoomProgress>): boolean {
  return (
    stage.materials.every((m) => (progress.delivered[m.item] ?? 0) >= m.count) &&
    progress.paid >= stage.cost
  );
}

/** Refus pour commencer ou poursuivre l'étape en cours d'une pièce, `null`: on peut. */
export function stageRefusal(
  look: Look,
  player: PlayerIndex,
  place: PlaceContent,
  state: DeepReadonly<HousingState> | undefined,
  room: RoomDef,
): string | null {
  const current = currentStage(room, state);
  if (current === null) return 'room-done';
  if (room.requires.some((r) => state?.rooms[r]?.state !== 'restored')) return 'room-needs-other';
  if (!evaluateAll({ world: look.world, content: look.content, actor: player }, current.stage.when))
    return 'room-story-not-yet';
  const { x, y } = look.world.players[player].body;
  if (!nearRoom(look, place, room, x, y)) return 'too-far';
  return null;
}

function refOf(look: Look, object: string): (SiteRef & { place: PlaceContent }) | null {
  const place = look.content.places[look.world.common.place];
  const ref = place === undefined ? null : siteRoom(place, object);
  return place === undefined || ref === null ? null : { ...ref, place };
}

export const worksiteBehaviour: BrickBehaviour<WorksiteBrick> = {
  verb: 'Restaurer',
  verbOf(look, _player, target) {
    return refOf(look, target.id)?.room.start === 'absent' ? 'Bâtir' : 'Restaurer';
  },
  // Sans pièce qui le nomme, ou pièce finie: l'objet n'offre plus rien.
  inert(look, _player, target) {
    const ref = refOf(look, target.id);
    if (ref === null) return true;
    const state = look.world.places[look.world.common.place]?.housing?.[ref.housing.id];
    return (state?.rooms[ref.room.id]?.state ?? ref.room.start) === 'restored';
  },
  // L'écran s'ouvre toujours: c'est lui qui dit ce qui manque (autre pièce, devis, matériaux).
  refuse() {
    return null;
  },
  use(sim, player, target) {
    const ref = refOf(sim, target.id);
    if (ref === null) return;
    sim.emit({
      type: 'worksite_opened',
      player,
      target: target.id,
      housing: ref.housing.id,
      room: ref.room.id,
    });
  },
};
