/**
 * Lectures pures de la pêche, les mêmes chez l'hôte et chez l'invité: canne en main, coin devant
 * le pêcheur, ombres du moment, et ce que le rendu et le carnet affichent.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { FishingSpot, ShadowSize } from '../../donnees/schemas/peche';
import type { Stack } from '../../etat/joueur';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { FishingLine } from '../../etat/peche';
import { modifiersOf } from '../besoins/jauges';
import { SIM_DT } from '../noyau/constantes';
import { toolCondition } from '../sac/outils';
import { fishOf, gameSeconds, shadowPosition, spotShadows, type Shadow } from './ombres';
import { FISHING } from './reglages';

/** La canne en main (case de la barre), ou `null`. */
export function heldRod(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): { slot: number; stack: DeepReadonly<Stack> } | null {
  const state = world.players[player];
  if (state.selected === null) return null;
  const stack = state.toolbar[state.selected] ?? null;
  if (stack === null || content.items[stack.item]?.tool?.kind !== 'rod') return null;
  return { slot: state.selected, stack };
}

/** Aide du pêcheur: état de la canne et bonus des besoins (`minigame`). 0: pas de canne. */
export function helpOf(content: Content, world: ReadonlyWorld, player: PlayerIndex): number {
  const rod = heldRod(content, world, player);
  if (rod === null) return 0;
  const condition = toolCondition(content, { ...rod.stack });
  const rodFactor = FISHING.rod[condition ?? 'base'];
  return Math.max(0.2, Math.min(4, rodFactor * modifiersOf(content, world, player).minigame));
}

export function placeSpots(content: Content, world: ReadonlyWorld): readonly FishingSpot[] {
  return content.places[world.common.place]?.def.fishing ?? [];
}

function distanceToRect(x: number, y: number, spot: FishingSpot): number {
  const { area } = spot;
  const dx = Math.max(area.x - x, 0, x - (area.x + area.w));
  const dy = Math.max(area.y - y, 0, y - (area.y + area.h));
  return Math.hypot(dx, dy);
}

export function insideSpot(spot: FishingSpot, x: number, y: number): boolean {
  return distanceToRect(x, y, spot) === 0;
}

/** Le coin d'eau devant le pêcheur, à portée (`FISHING.reach`), ou `null`. */
export function spotInFront(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): FishingSpot | null {
  const body = world.players[player].body;
  const cos = Math.cos(body.facing);
  const sin = Math.sin(body.facing);
  for (const spot of placeSpots(content, world)) {
    for (let d = 0.5; d <= FISHING.reach; d += 0.5) {
      if (insideSpot(spot, body.x + cos * d, body.y + sin * d)) return spot;
    }
  }
  return null;
}

export function spotById(content: Content, world: ReadonlyWorld, id: string): FishingSpot | null {
  return placeSpots(content, world).find((s) => s.id === id) ?? null;
}

/** Ombres d'un coin en ce moment (sans celles déjà parties). */
export function shadowsNow(content: Content, world: ReadonlyWorld, spot: FishingSpot): Shadow[] {
  const fishing = world.places[world.common.place]?.fishing;
  if (fishing === undefined) return [];
  return spotShadows(content, spot, {
    seed: fishing.seed,
    taken: fishing.taken,
    day: world.common.day,
    minutes: world.minutes,
    weather: world.common.weather,
  });
}

// --- Rendu ---------------------------------------------------------------------------------

export interface ShadowView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Cap de nage (rad, convention du corps: 0 vers l'est). */
  readonly heading: number;
  readonly size: ShadowSize;
  /** Ombre attirée par un bouchon. */
  readonly biting: boolean;
}

export interface LineView {
  readonly player: PlayerIndex;
  readonly spot: string;
  /** Bouchon et pointe de la canne côté pêcheur (m). */
  readonly bobberX: number;
  readonly bobberY: number;
  readonly hooked: boolean;
  /** Posture du pêcheur: attendre la touche ou tenir la ligne. */
  readonly pose: 'waiting' | 'fighting';
}

export interface FishingView {
  readonly shadows: readonly ShadowView[];
  readonly lines: readonly LineView[];
}

/**
 * Ce que le rendu dessine: ombres (position, cap, taille) et lignes. `seconds`: horloge de jeu
 * (`gameSeconds`); `sinceCast(line)`: secondes depuis le lancer, pour l'approche de l'ombre.
 */
export function fishingView(
  content: Content,
  world: ReadonlyWorld,
  tickSeconds: number,
): FishingView {
  const shadows: ShadowView[] = [];
  const lines: LineView[] = [];
  const place = world.places[world.common.place];
  const fishing = place?.fishing;
  if (fishing === undefined) return { shadows, lines };
  const seconds = gameSeconds(content, world.common.day, world.minutes);
  const here = { x: 0, y: 0 };
  const ahead = { x: 0, y: 0 };
  const byShadow = new Map<string, DeepReadonly<FishingLine>>();
  fishing.lines.forEach((line, index) => {
    if (line === null) return;
    byShadow.set(`${line.spot}:${line.shadow}`, line);
    lines.push({
      player: index as PlayerIndex,
      spot: line.spot,
      bobberX: line.x,
      bobberY: line.y,
      hooked: line.hooked,
      pose: line.hooked ? 'fighting' : 'waiting',
    });
  });
  for (const spot of placeSpots(content, world)) {
    for (const shadow of shadowsNow(content, world, spot)) {
      shadowPosition(shadow, seconds, here);
      shadowPosition(shadow, seconds + 0.2, ahead);
      const line = byShadow.get(`${spot.id}:${shadow.id}`);
      let x = here.x;
      let y = here.y;
      if (line !== undefined) {
        // L'ombre glisse vers le bouchon pendant son approche, puis tourne autour.
        const since = Math.max(0, tickSeconds - line.tick * SIM_DT);
        const k = line.approach <= 0 ? 1 : Math.min(1, since / line.approach);
        const orbit = line.hooked ? 0.1 : 0.35;
        const a = since * 2.2;
        x = here.x + (line.x + Math.cos(a) * orbit - here.x) * k;
        y = here.y + (line.y + Math.sin(a) * orbit - here.y) * k;
      }
      shadows.push({
        id: `${spot.id}:${shadow.id}`,
        x,
        y,
        heading: Math.atan2(ahead.y - here.y, ahead.x - here.x),
        size: shadow.size,
        biting: line !== undefined,
      });
    }
  }
  return { shadows, lines };
}

// --- Carnet --------------------------------------------------------------------------------

/** Clé de mémoire du record de taille d'un joueur pour une espèce. */
export function recordKey(player: PlayerIndex, catchId: string): string {
  return `${FISHING.collection}.record-j${String(player)}.${catchId}`;
}

export interface FishEntryView {
  readonly catch: string;
  readonly item: string;
  readonly seen: boolean;
  /** Record de taille de chaque joueur (mm), 0: pas encore pris par lui. */
  readonly records: readonly [number, number];
}

/** Les poissons du jeu pour le carnet, dans l'ordre des identifiants. */
export function fishCollectionView(content: Content, world: ReadonlyWorld): FishEntryView[] {
  const album = world.progress.album?.f ?? {};
  const out: FishEntryView[] = [];
  for (const id of Object.keys(content.catches).sort()) {
    const def = fishOf(content, id);
    if (def === null) continue;
    const record = (p: PlayerIndex): number => {
      const value = world.progress.memory[recordKey(p, id)]?.v;
      return typeof value === 'number' ? value : 0;
    };
    out.push({
      catch: id,
      item: def.item,
      seen: album[id] !== undefined,
      records: [record(0), record(1)],
    });
  }
  return out;
}
