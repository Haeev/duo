/**
 * Réglages de la rue Haute (tour 10, sections 1.5, 1.6, 2 et 7.1) tels que la simulation les lit:
 * fournil d'Achille, salon de Solange, heures et chocolat chaud d'Odette, bornes de l'apparence.
 * Ils viennent des clés `bakery`, `salon`, `grocer` et `appearance` de `reglages.json`, lues par
 * `maison.ts`; sans elles, les valeurs de la conception ci-dessous valent. Les barbes (réponse du
 * client du 2026-11-01) n'ont pas encore de clé: quatre choix, aucune comprise.
 */
import { SEASONS } from './calendrier';
import type {
  AppearanceSettings as AppearanceSource,
  BakerySettings as BakerySource,
  GrocerSettings as GrocerSource,
  SalonSettings as SalonSource,
} from './maison';
import type { Season } from './types';

/** Jours de la semaine dans l'ordre de `weekdayOf` (0: samedi, comme `contenu.ts`). */
const WEEKDAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const H = 60;

export interface BakerySettings {
  /** Pain chaud (minutes de jeu). */
  warmFrom: number;
  warmTo: number;
  /** Pain ordinaire jusqu'à cette heure. */
  breadUntil: number;
  closedWeekdays: number[];
  breadPrice: number;
  briochePrice: number;
  briocheWeekdays: number[];
  dailyCapPerPlayer: { bread: number; brioche: number };
  /** À cette heure, tout pain chaud devient du pain (sacs, coffre, sol). */
  warmBecomesBreadAt: number;
}

export interface SalonSettings {
  open: [number, number][];
  weekdays: number[];
  /** Le samedi, le salon n'ouvre qu'à cette heure (colis de tissu du train). */
  saturdayFrom: number;
  cutPrice: number;
  colorPrice: number;
  bothPrice: number;
}

export interface GrocerSettings {
  /** Heures de la boutique, dedans (la porte). */
  hours: [number, number];
  chocolate: {
    price: number;
    belly: number;
    until: number;
    seasons: Season[];
    rainAnySeason: boolean;
    perPlayerPerDay: number;
  };
}

export interface AppearanceSettings {
  /** Coupes au salon (0 à `hairStyles` - 1). */
  hairStyles: number;
  /** Coupes de la création (les premières de la liste). */
  creationHairStyles: number;
  hairColors: number;
  /** Barbes: 0 aucune, puis barbe courte, barbe fournie, moustache (réponse du client du 2026-11-01). */
  beards: number;
}

export interface TownSettings {
  bakery: BakerySettings;
  salon: SalonSettings;
  grocer: GrocerSettings;
  appearance: AppearanceSettings;
}

/** Valeurs de la conception (section 7.1). */
export const DEFAULT_TOWN: TownSettings = {
  bakery: {
    warmFrom: 6 * H,
    warmTo: 9 * H,
    breadUntil: 12 * H,
    closedWeekdays: [2],
    breadPrice: 5,
    briochePrice: 12,
    briocheWeekdays: [1],
    dailyCapPerPlayer: { bread: 4, brioche: 2 },
    warmBecomesBreadAt: 12 * H,
  },
  salon: {
    open: [
      [9 * H, 12 * H],
      [14 * H, 18 * H],
    ],
    weekdays: [3, 4, 5, 6, 0],
    saturdayFrom: 10 * H + 45,
    cutPrice: 15,
    colorPrice: 10,
    bothPrice: 20,
  },
  grocer: {
    hours: [7 * H, 19 * H],
    chocolate: { price: 5, belly: 15, until: 18 * H, seasons: ['autumn', 'winter'], rainAnySeason: true, perPlayerPerDay: 1 },
  },
  appearance: { hairStyles: 15, creationHairStyles: 12, hairColors: 8, beards: 4 },
};

function days(names: readonly string[]): number[] {
  return names.map((n) => WEEKDAYS.indexOf(n as (typeof WEEKDAYS)[number])).filter((i) => i >= 0);
}

/**
 * Les règles de la rue Haute, d'après les clés de `reglages.json` lues par `maison.ts` (lot L4):
 * jours en rangs de `weekdayOf`; une clé absente garde les valeurs de la conception.
 */
export function townFrom(
  bakery: BakerySource | null,
  salon: SalonSource | null,
  grocer: GrocerSource | null,
  appearance: AppearanceSource | null,
): TownSettings {
  const d = DEFAULT_TOWN;
  return {
    bakery:
      bakery === null
        ? d.bakery
        : {
            ...bakery,
            closedWeekdays: days(bakery.closedWeekdays),
            briocheWeekdays: days(bakery.briocheWeekdays),
            dailyCapPerPlayer: {
              bread: bakery.dailyCapPerPlayer.bread ?? d.bakery.dailyCapPerPlayer.bread,
              brioche: bakery.dailyCapPerPlayer.brioche ?? d.bakery.dailyCapPerPlayer.brioche,
            },
          },
    salon: salon === null ? d.salon : { ...salon, weekdays: days(salon.weekdays) },
    grocer:
      grocer === null
        ? d.grocer
        : {
            hours: grocer.hours,
            chocolate: { ...grocer.chocolate, seasons: grocer.chocolate.seasons.filter((s): s is Season => (SEASONS as readonly string[]).includes(s)) },
          },
    appearance: appearance === null ? d.appearance : { ...appearance, beards: d.appearance.beards },
  };
}
