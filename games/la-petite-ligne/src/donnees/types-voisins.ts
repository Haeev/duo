/**
 * Types des habitudes des habitants et du calendrier du bourg (0.13, lot H1; conception
 * `v0-13-habitants.md`, sections 3 et 4; README des données, section 2.12).
 */
import type { Season } from './types';

/** Sorte d'une habitude (colonne « Sorte » des tableaux 3.2). */
export type HabitKind =
  'routine' | 'home' | 'rain' | 'season' | 'day' | 'after_quest' | 'market' | 'birthday';

export const HABIT_KINDS: readonly HabitKind[] = [
  'routine',
  'home',
  'rain',
  'season',
  'day',
  'after_quest',
  'market',
  'birthday',
];

/** Une habitude, désignée hors de son habitant par le couple habitant et habitude. */
export interface HabitRef {
  villager: string;
  habit: string;
}

/** Comment apprendre une habitude sans la voir: une réplique (de lui ou d'un autre) ou une ligne d'écriteau. */
export type HabitReveal =
  { kind: 'line'; by: string; text: string } | { kind: 'sign'; sign: string; text: string };

export interface HabitDef {
  id: string;
  kind: HabitKind;
  /** La ligne du carnet. */
  label: string;
  reveals: HabitReveal[];
  /** Ce qu'il dit en passant quand il part vers elle (section 7.3), ou `null`. */
  announce: string | null;
}

/** Un jour particulier de `calendrier.json`. */
export interface SpecialDayDef {
  id: string;
  name: string;
  /** Jours de la semaine (0: samedi, comme `weekdayOf`). */
  weekdays: number[];
  /** Jours de saison (1 à `calendar.seasonDays`), par saison. */
  seasonDays: Partial<Record<Season, number[]>>;
  /** Heures publiques (minutes), pour l'interface seulement; `null`: aucune. */
  from: number | null;
  to: number | null;
  noSchool: boolean;
  noBirthday: boolean;
  tier: 'P0' | 'P1';
}

export interface VillageCalendar {
  school: { weekdays: number[]; holidaySeasons: Season[] };
  specialDays: SpecialDayDef[];
  /** Anniversaires des habitants du contenu (les autres sont ignorés). */
  birthdays: Record<string, { season: Season; day: number }>;
}

/** Un écriteau: ses lignes, chacune avec les habitudes qu'elle révèle. */
export interface SignDef {
  id: string;
  lines: { text: string; habits: HabitRef[] }[];
}

/** Réglages de la découverte des habitudes (`reglages.json`, `habits`). */
export interface HabitSettings {
  seeDistance: number;
  nightSeeDistance: number;
  /** Minute du jour à partir de laquelle on ne voit qu'à `nightSeeDistance`. */
  nightFrom: number;
  watchSeconds: number;
  arrivedDistance: number;
  doorDistance: number;
  signRange: number;
  gossipAfterDays: number;
  logKept: number;
  announce: { distance: number; minutes: number; bondAtLeast: number };
  windowPoints: string[];
  knownInEarlierSaves: Record<string, string[]>;
}

/** Réglages des liens (`reglages.json`, `bonds`): ici, seulement le départ d'une partie reprise. */
export interface BondSettings {
  earlierSaveStartPerQuest: number;
  earlierSaveStartMax: number;
}
