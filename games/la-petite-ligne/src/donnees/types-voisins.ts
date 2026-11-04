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

/** Réglages des liens (`reglages.json`, `bonds`, conception `v0-13-habitants.md`, section 6). */
export interface BondSettings {
  /** Lien de départ d'une partie reprise d'une version antérieure, par quête finie avec l'habitant. */
  earlierSaveStartPerQuest: number;
  earlierSaveStartMax: number;
  /** Seuils des six niveaux (0 « De vue » à 5 « Comme la famille »), croissants, le premier à 0. */
  levels: number[];
  /** Plafond du lien (le seuil du dernier niveau). */
  max: number;
  gains: BondGains;
  /** Être là à son habitude d'anniversaire: à moins de `distance` m pendant `seconds` s de jeu. */
  birthdayPresence: { distance: number; seconds: number };
  /** Sortes d'objets qui ne s'offrent pas (outils, objets de quête, charges portées). */
  giftExcluded: string[];
  /** Rythme des quêtes d'histoire (champ `story`, section 5.1). */
  storyPace: StoryPace;
}

/** Rythme des quêtes d'histoire (section 5.1, mesuré en 5.7). */
export interface StoryPace {
  /** Histoires en cours au plus: les autres prêtes attendent. */
  maxActive: number;
  /** Quêtes d'histoire neuves au plus par jour de jeu. */
  newPerDay: number;
  /** Jours au moins entre la fin d'une étape d'un habitant et le début de la suivante. */
  cooldownDays: number;
}

/** Gains de lien (section 6.2); aucun n'est négatif. */
export interface BondGains {
  /** Première conversation du jour, par joueur. */
  talk: number;
  /** Cadeau, selon le goût (un cadeau qu'il n'aime pas ne donne rien et revient au sac). */
  gift: { loves: number; likes: number; neutral: number };
  /** Facteur du gain d'un cadeau le jour de son anniversaire. */
  birthdayGiftFactor: number;
  /** « Bon anniversaire » (choix de dialogue, une fois par joueur). */
  birthdayWish: number;
  /** Être là à son anniversaire (une fois par an, pour le duo). */
  birthdayPresence: number;
  /** Quête finie dont il est le donneur, sans `add_bond` pour lui dans ses effets. */
  quest: number;
  /** Étape de son histoire (quête `story`), sans `add_bond` pour lui dans ses effets. */
  story: number;
  /** Annonce du tableau remplie pour lui. */
  annonce: number;
  /** Toutes ses habitudes connues (une fois). */
  allHabits: number;
}
