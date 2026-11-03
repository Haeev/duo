/**
 * Élevage (0.12, conception section 4), règles pures partagées par la simulation, l'interface et le
 * rendu: humeur d'une bête, capacité du poulailler, couleurs réunies, bêtes qui bougent, distance
 * d'un point à la voie. Rien ici ne modifie l'état.
 */
import type { Content, HappinessSettings } from '../donnees/types';
import { type GameMap, groundAt } from './carte';
import type {
  BreedingState,
  CharacterId,
  DeepReadonly,
  Fowl,
  Goat,
  Hen,
  ReadonlyWorld,
  Vec2,
  WorldState,
} from './types';

/** Mot de l'humeur (sans chiffre): « Ravie », « Tranquille », « Ébouriffée » (ou « Gaie », « Boudeuse »). */
export type Mood = 'happy' | 'calm' | 'low';

export function moodOf(happiness: number, s: HappinessSettings): Mood {
  if (happiness >= s.happy) return 'happy';
  return happiness >= s.calm ? 'calm' : 'low';
}

/** Valeur de bonheur bornée entre le plancher et le maximum. */
export function clampHappiness(value: number, s: HappinessSettings): number {
  return Math.max(s.floor, Math.min(s.max, value));
}

export function emptyBreeding(): BreedingState {
  return {
    rooster: null,
    chicks: [],
    brood: null,
    strawDay: null,
    grainRations: 0,
    goats: [],
    grazed: {},
    naming: [],
    namesUsed: [],
    nextNamer: 'p1',
  };
}

/** Places du poulailler: 5, puis 9 une fois l'appentis bâti. */
export function coopCapacity(content: Content, world: Pick<ReadonlyWorld, 'improvements'>): number {
  const s = content.settings.hens;
  const care = s.care;
  if (care === null) return s.max;
  const built = world.improvements[care.extensionImprovement]?.builtDay ?? null;
  return built === null ? s.max : care.maxExtended;
}

/** Les couleurs de poule réunies dans la basse-cour (poules et poussines), dans l'ordre de la collection. */
export function colorsCollected(
  content: Content,
  world: Pick<ReadonlyWorld, 'hens' | 'breeding'>,
): string[] {
  const order = content.settings.hens.care?.colors ?? [];
  const have = new Set<string>();
  for (const h of world.hens) have.add(h.variant);
  for (const c of world.breeding.chicks) if (c.roosterling !== true) have.add(c.variant);
  return order.filter((c) => have.has(c));
}

/** Bêtes qui bougent (positions envoyées souvent à l'invité): poules, poussines, coq, chèvres. */
export function movingAnimals(world: WorldState): (Hen | Fowl | Goat)[] {
  const out: (Hen | Fowl | Goat)[] = [
    ...world.hens,
    ...world.breeding.chicks,
    ...world.breeding.goats,
  ];
  if (world.breeding.rooster !== null) out.push(world.breeding.rooster);
  return out;
}

/** Une bête de l'élevage par son identifiant, avec sa sorte. */
export type AnimalRef =
  | { kind: 'hen'; animal: DeepReadonly<Hen> }
  | { kind: 'chick'; animal: DeepReadonly<Fowl> }
  | { kind: 'rooster'; animal: DeepReadonly<Fowl> }
  | { kind: 'goat'; animal: DeepReadonly<Goat> };

export function findAnimal(world: ReadonlyWorld, id: string): AnimalRef | null {
  const hen = world.hens.find((h) => h.id === id);
  if (hen !== undefined) return { kind: 'hen', animal: hen };
  const chick = world.breeding.chicks.find((c) => c.id === id);
  if (chick !== undefined) return { kind: 'chick', animal: chick };
  const rooster = world.breeding.rooster;
  if (rooster?.id === id) return { kind: 'rooster', animal: rooster };
  const goat = world.breeding.goats.find((g) => g.id === id);
  return goat === undefined ? null : { kind: 'goat', animal: goat };
}

/** Une place n'a pas été broutée depuis `freshDays` jours (aujourd'hui exclu). */
export function spotFresh(
  grazed: Readonly<Record<string, number>>,
  spot: string,
  day: number,
  freshDays: number,
): boolean {
  const last = grazed[spot];
  return last === undefined || last < day - freshDays;
}

/** Herbe rase: la place a été broutée la veille ou l'avant-veille (ou aujourd'hui). */
export function spotShorn(
  grazed: Readonly<Record<string, number>>,
  spot: string,
  day: number,
  freshDays: number,
): boolean {
  const last = grazed[spot];
  return last !== undefined && last >= day - freshDays;
}

/** Une case de la voie: ballast, ou planches du passage à niveau entre deux cases de ballast. */
function railCell(map: GameMap, cx: number, cy: number): boolean {
  const g = groundAt(map, cx, cy);
  if (g === 'rail') return true;
  if (g !== 'wood') return false;
  // Le passage à niveau: une bande de planches dans la voie (ballast à l'ouest ou à l'est de la bande).
  for (const dir of [-1, 1]) {
    for (let k = 1; k <= 4; k++) {
      const n = groundAt(map, cx + dir * k, cy);
      if (n === 'rail') return true;
      if (n !== 'wood') break;
    }
  }
  return false;
}

/** Distance d'un point à la case de voie la plus proche (m), cherchée dans un rayon de `limit`. */
export function railDistance(map: GameMap, p: Vec2, limit = 8): number {
  let best = limit;
  const x0 = Math.floor(p.x - limit);
  const y0 = Math.floor(p.y - limit);
  for (let cy = y0; cy <= Math.floor(p.y + limit); cy++) {
    for (let cx = x0; cx <= Math.floor(p.x + limit); cx++) {
      if (!railCell(map, cx, cy)) continue;
      const dx = Math.max(cx - p.x, 0, p.x - (cx + 1));
      const dy = Math.max(cy - p.y, 0, p.y - (cy + 1));
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}

/** Le joueur qui choisit le nom en cours, s'il y en a un. */
export function namingTurn(
  world: ReadonlyWorld,
): { request: DeepReadonly<BreedingState['naming'][number]>; by: CharacterId } | null {
  const first = world.breeding.naming[0];
  return first === undefined ? null : { request: first, by: first.by };
}
