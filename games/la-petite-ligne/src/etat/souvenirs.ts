/**
 * Souvenirs du duo (tour 7, conception section 2): calendrier des saisons et taille de la mémoire.
 * Pur (sans DOM ni Three.js): la simulation, l'interface et les tests lisent les mêmes règles.
 */
import type { MemorySettings } from '../donnees/types';
import type { DeepReadonly, MemoriesState } from './types';

/** Saison d'un jour (0: printemps, 1: été...), le jour 1 ouvrant le printemps de la première année. */
export function seasonOf(s: MemorySettings, day: number): number {
  return Math.floor((Math.max(1, day) - 1) / s.seasonDays) % s.seasonsPerYear;
}

/** Année d'un jour, de 1 à l'infini. */
export function yearOf(s: MemorySettings, day: number): number {
  return Math.floor((Math.max(1, day) - 1) / (s.seasonDays * s.seasonsPerYear)) + 1;
}

/** Rang absolu de la saison d'un jour depuis le début de la partie (0, 1, 2...). */
export function seasonIndex(s: MemorySettings, day: number): number {
  return Math.floor((Math.max(1, day) - 1) / s.seasonDays);
}

/** Dernier jour de la saison de rang absolu `index`. */
export function lastDayOfSeason(s: MemorySettings, index: number): number {
  return (index + 1) * s.seasonDays;
}

/** Taille de la mémoire telle qu'elle est sauvegardée et transmise (JSON, octets UTF-8). */
export function memoriesBytes(memories: DeepReadonly<MemoriesState>): number {
  return new TextEncoder().encode(JSON.stringify(memories)).length;
}
