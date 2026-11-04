/**
 * L'état complet tel que l'hôte l'envoie à l'invité (0.13, mission 0.13 de dev-reseau). Les
 * habitants y perdent leur position, leur position précédente, leur cap et leur vitesse: le canal
 * rapide (`fast`, `hote.ts`) les porte déjà pour les 21, visibles ou cachés, à la même précision
 * (nombres JSON sans arrondi), à chaque pas. Gain mesuré: 1,2 à 1,8 Ko au pire de la démo.
 * La sauvegarde, elle, garde les positions (`writtenWorld` de `habitants-ecrits.ts`).
 *
 * Les ombres des poissons n'y sont pas non plus (mission 0.13 de dev-gameplay-3d): elles
 * partent sur leur canal (`shadows`, `hote.ts`), seulement quand elles changent. Elles ne bougent
 * dans l'état qu'aux événements (apparition, approche, touche, départ), mais pesaient jusqu'à
 * 3,2 Ko dans chaque message d'état, envoyé à chaque changement de n'importe quoi. Les reconstituer
 * chez l'invité n'est pas possible: elles naissent quand un joueur s'approche d'un coin et suivent
 * les lignes des deux joueurs, pas seulement la graine et l'heure.
 *
 * Le potager y part sous sa forme compacte (0.13, parcelles libres, `SentPlot` de
 * `etat/parcelles.ts`): 40 parcelles avec culture pesaient environ 9 Ko en objets, 1,3 Ko en
 * tableaux. La dernière récolte (« Déjà pris par... ») reste chez l'hôte, seul à la lire.
 */
import type { FishShadow, FishingState } from '../etat/peche';
import { readVillager, writeVillager, type WrittenVillager, type WrittenWorld } from '../etat/habitants-ecrits';
import type { VillagerId, WorldState } from '../etat/types';
import { readPlot, sendPlot, type SentPlot } from '../etat/parcelles';

/** Champs d'un habitant portés par le canal rapide, absents du message d'état. */
type FastFields = 'pos' | 'prev' | 'facing' | 'speed';

export type SentVillager = Omit<WrittenVillager, FastFields>;

/** La pêche dans le message d'état: tout sauf les ombres, portées par leur canal. */
export type SentFishing = Omit<FishingState, 'shadows'>;

/** L'état du monde dans le message d'état de l'hôte. */
export type SentWorld = Omit<WrittenWorld, 'villagers' | 'fishing' | 'garden'> & { villagers: SentVillager[]; fishing: SentFishing; garden: SentPlot[] };

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

export function sendFishing(fishing: FishingState): SentFishing {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retirées par la déstructuration, le reste part tel quel
  const { shadows, ...sent } = fishing;
  return sent;
}

/** L'état à envoyer: copie de surface, habitants sans leurs champs du canal rapide, pêche sans ses ombres. */
export function sentWorld(world: WorldState): SentWorld {
  return {
    ...world,
    villagers: world.villagers.map((v) => sendVillager(writeVillager(v))),
    fishing: sendFishing(world.fishing),
    garden: world.garden.map(sendPlot),
  };
}

/**
 * L'état relu chez l'invité. `placeOf` rend la dernière valeur rapide connue de l'habitant, ou
 * `null`: il est alors posé au point de son planning, puis l'invité l'y ajuste (`placeAtTarget`).
 * Les ids renvoyés sont ceux qui n'avaient aucune valeur rapide. `shadows`: les dernières ombres
 * reçues sur leur canal (l'hôte les envoie juste avant l'état qui les a vues changer).
 */
export function worldFromSent(
  world: SentWorld,
  placeOf: (id: VillagerId) => VillagerPlace | null,
  fallback: (v: SentVillager) => VillagerPlace,
  shadows: FishShadow[],
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
  const garden = world.garden.map((p) => readPlot(p));
  return { world: { ...world, villagers, fishing: { ...world.fishing, shadows }, garden }, unplaced };
}
