/**
 * L'état complet tel que l'hôte l'envoie à l'invité (0.13, mission 0.13 de dev-reseau). Les
 * habitants y perdent leur position, leur position précédente, leur cap et leur vitesse: le canal
 * rapide (`fast`, `hote.ts`) les porte déjà pour les 21, visibles ou cachés, à la même précision
 * (nombres JSON sans arrondi), à chaque pas. Gain mesuré: 1,2 à 1,8 Ko au pire de la démo.
 * La sauvegarde, elle, garde les positions (`writtenWorld` de `habitants-ecrits.ts`).
 */
import { readVillager, writeVillager, type WrittenVillager, type WrittenWorld } from '../etat/habitants-ecrits';
import type { VillagerId, WorldState } from '../etat/types';

/** Champs d'un habitant portés par le canal rapide, absents du message d'état. */
type FastFields = 'pos' | 'prev' | 'facing' | 'speed';

export type SentVillager = Omit<WrittenVillager, FastFields>;

/** L'état du monde dans le message d'état de l'hôte. */
export type SentWorld = Omit<WrittenWorld, 'villagers'> & { villagers: SentVillager[] };

/** Ce que l'invité sait d'un habitant par le canal rapide (ou, à défaut, par son planning). */
export interface VillagerPlace {
  x: number;
  y: number;
  f: number;
  s: number;
}

export function sendVillager(w: WrittenVillager): SentVillager {
  const out: SentVillager = { id: w.id, target: w.target, activity: w.activity };
  if (w.visible !== undefined) out.visible = w.visible;
  if (w.talkingWith !== undefined) out.talkingWith = w.talkingWith;
  if (w.met !== undefined) out.met = w.met;
  if (w.inside !== undefined) out.inside = w.inside;
  return out;
}

/** L'état à envoyer: copie de surface, habitants sans leurs champs du canal rapide. */
export function sentWorld(world: WorldState): SentWorld {
  return { ...world, villagers: world.villagers.map((v) => sendVillager(writeVillager(v))) };
}

/**
 * L'état relu chez l'invité. `placeOf` rend la dernière valeur rapide connue de l'habitant, ou
 * `null`: il est alors posé au point de son planning, puis l'invité l'y ajuste (`placeAtTarget`).
 * Les ids renvoyés sont ceux qui n'avaient aucune valeur rapide.
 */
export function worldFromSent(
  world: SentWorld,
  placeOf: (id: VillagerId) => VillagerPlace | null,
  fallback: (v: SentVillager) => VillagerPlace,
): { world: WorldState; unplaced: VillagerId[] } {
  const unplaced: VillagerId[] = [];
  const villagers = world.villagers.map((sent) => {
    let place = placeOf(sent.id);
    if (place === null) {
      unplaced.push(sent.id);
      place = fallback(sent);
    }
    const written: WrittenVillager = { ...sent, pos: { x: place.x, y: place.y }, facing: place.f };
    if (place.s !== 0) written.speed = place.s;
    return readVillager(written);
  });
  return { world: { ...world, villagers }, unplaced };
}
