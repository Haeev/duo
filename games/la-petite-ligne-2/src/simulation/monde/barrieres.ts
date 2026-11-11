/**
 * Barrières de passage à niveau (brique `barrier` d'un meuble de carte): chacune se lie au passage
 * à niveau le plus proche (`levelCrossings`), se baisse quand il sonne et se relève quand il se
 * tait (`crossingClosed`). Fonctions pures de l'heure, des trains et de la progression: rien à
 * sauvegarder ni à transmettre, l'hôte, la prédiction de l'invité et les deux rendus trouvent la
 * même barrière, aussi après un chargement.
 *
 * Baissée, la barrière barre la route dans un seul sens: on ne passe pas de la route vers la voie,
 * mais qui est déjà engagé (du côté de la voie) sort librement. C'est une lisse, un trait: elle
 * n'entre pas dans la grille des obstacles (`noyau/obstacles.ts` la donne à part, `Blockers.bars`)
 * et ne pousse jamais personne sur la voie.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { MapObject } from '../../donnees/schemas/lieu';
import type { Look } from '../briques/types';
import type { Bar } from '../noyau/grille';
import { isObjectPresent } from '../lieux/presents';
import { TRAINS, type TrainSettings } from './reglages-trains';
import { crossingClosed, levelCrossings, type LevelCrossing } from './trains';

/** Une barrière de la carte, lue une fois: sa lisse (un segment) et le passage qu'elle garde. */
export interface Barrier {
  readonly object: MapObject;
  /** La partie mobile du modèle et la durée de sa course (brique `barrier`). */
  readonly node: string;
  readonly seconds: number;
  readonly crossing: LevelCrossing;
  /** La lisse sur la carte: centre, sens de sa longueur, demi-longueur, et le côté de la voie. */
  readonly bar: Bar;
}

const cache = new WeakMap<PlaceContent, readonly Barrier[]>();

/** Les barrières de la carte du lieu, dans l'ordre du fichier (le même chez les deux joueurs). */
export function barriersOf(
  look: Pick<Look, 'content'>,
  place: PlaceContent,
  settings: TrainSettings = TRAINS,
): readonly Barrier[] {
  const known = cache.get(place);
  if (known !== undefined) return known;
  const out: Barrier[] = [];
  const crossings = levelCrossings(place, settings);
  for (const object of place.map.objects) {
    const def = look.content.props[object.type];
    const brick = def?.bricks.find((b) => b.brick === 'barrier');
    if (def === undefined || brick?.brick !== 'barrier') continue;
    let crossing: LevelCrossing | null = null;
    let best: number = settings.barriers.linkMeters;
    for (const c of crossings) {
      const d = Math.hypot(c.x - object.x, c.y - object.y);
      if (d < best) {
        best = d;
        crossing = c;
      }
    }
    // Aucun passage à niveau assez proche: elle reste levée, rien à lier.
    if (crossing === null) continue;
    // La lisse court le long de la largeur de la fiche (x du modèle), tournée par quarts de tour.
    const turned = object.rotation % 2 === 1;
    const ax = turned ? 0 : 1;
    const ay = turned ? 1 : 0;
    // Le côté de la voie: la normale qui regarde le milieu du passage.
    const side = (crossing.x - object.x) * -ay + (crossing.y - object.y) * ax;
    const sign = side >= 0 ? 1 : -1;
    out.push({
      object,
      node: brick.node,
      seconds: brick.seconds,
      crossing,
      bar: {
        x: object.x,
        y: object.y,
        ax,
        ay,
        half: def.size.w / 2,
        nx: -ay * sign,
        ny: ax * sign,
      },
    });
  }
  cache.set(place, out);
  return out;
}

/** Cette barrière est-elle baissée à l'heure de l'état ? Absente (`when`), jamais. */
export function barrierClosed(
  look: Look,
  place: PlaceContent,
  barrier: Barrier,
  settings: TrainSettings = TRAINS,
): boolean {
  return (
    isObjectPresent(look, barrier.object) && crossingClosed(look, place, barrier.crossing, settings)
  );
}

/** Masque des barrières baissées (un bit par barrière): les obstacles se refont quand il change. */
export function barrierSignature(look: Look, place: PlaceContent): number {
  const list = barriersOf(look, place);
  let mask = 0;
  for (let i = 0; i < list.length; i++) {
    const barrier = list[i];
    if (barrier !== undefined && barrierClosed(look, place, barrier)) mask |= 1 << (i % 30);
  }
  return mask;
}

/** Écrit dans `out` les lisses des barrières baissées (vidé d'abord). */
export function closedBars(look: Look, place: PlaceContent, out: Bar[]): void {
  out.length = 0;
  for (const barrier of barriersOf(look, place))
    if (barrierClosed(look, place, barrier)) out.push(barrier.bar);
}

/**
 * Un pas de (x, y) vers (nx, ny), d'un corps de rayon `radius`, passerait-il une barrière baissée
 * depuis la route ? (Habitants, qui marchent sur leur trajet sans la grille: ils attendent au bord.)
 * Depuis le côté de la voie, jamais: on en sort.
 */
export function crossesClosedBarrier(
  look: Look,
  place: PlaceContent,
  x: number,
  y: number,
  nx: number,
  ny: number,
  radius: number,
): boolean {
  for (const barrier of barriersOf(look, place)) {
    const bar = barrier.bar;
    const from = (x - bar.x) * bar.nx + (y - bar.y) * bar.ny;
    if (from >= 0) continue;
    const dx = nx - bar.x;
    const dy = ny - bar.y;
    const along = dx * bar.ax + dy * bar.ay;
    const to = dx * bar.nx + dy * bar.ny;
    if (Math.abs(along) > bar.half + radius || to <= Math.max(from, -radius)) continue;
    if (barrierClosed(look, place, barrier)) return true;
  }
  return false;
}
