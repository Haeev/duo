/**
 * État des voisins (0.13, format 14): le carnet des habitudes (lot H1, conception
 * `v0-13-habitants.md`, section 4) et les champs de l'amitié qu'écrira le lot H2 (section 6.5).
 */
import type { CharacterId, ItemId, QuestId, VillagerId } from './types';

/** Comment une habitude est arrivée au carnet. */
export type HabitSource =
  /** vue sur place, en conversation, ou en le voyant franchir sa porte */
  | 'seen'
  /** entendue dans une réplique (de lui ou d'un autre) */
  | 'heard'
  /** lue sur un écriteau */
  | 'read'
  /** écrite par un effet (fin de quête, décision) */
  | 'noted'
  /** au carnet d'office, partie reprise d'une version antérieure */
  | 'resume';

/** Une découverte (les `habits.logKept` dernières, pour la notification de retour d'un absent). */
export interface HabitDiscovery {
  villager: VillagerId;
  habit: string;
  day: number;
  source: HabitSource;
  /** Qui: un joueur, les deux ensemble, ou `null` (effet, reprise). */
  by: CharacterId | 'both' | null;
}

const SOURCES: readonly HabitSource[] = ['seen', 'heard', 'read', 'noted', 'resume'];

/**
 * Une découverte écrite en une ligne (`firmin:quay:12:seen:p1`, `-` pour personne): 30 objets de
 * sept champs pesaient 3 Ko dans l'état transmis à l'invité, ces lignes environ 1 Ko.
 */
export function writeDiscovery(d: HabitDiscovery): string {
  return `${d.villager}:${d.habit}:${String(d.day)}:${d.source}:${d.by ?? '-'}`;
}

export function readDiscovery(line: string): HabitDiscovery | null {
  const [villager, habit, day, source, by] = line.split(':');
  const s = SOURCES.find((x) => x === source);
  const who = by === 'p1' || by === 'p2' || by === 'both' ? by : by === '-' ? null : undefined;
  if (
    villager === undefined ||
    habit === undefined ||
    s === undefined ||
    who === undefined ||
    !/^\d+$/.test(day ?? '')
  )
    return null;
  return { villager, habit, day: Number(day), source: s, by: who };
}

export interface HabitsState {
  /** Habitudes au carnet, par habitant (identifiants de `habits[]`), dans l'ordre de découverte. */
  known: Record<VillagerId, string[]>;
  /**
   * Habitudes pas encore connues d'un habitant rencontré, dont une entrée a tenu: `[jours où elle a
   * tenu, dernier jour compté]`. Au moins un jour: la variante peut paraître au carnet en « ? »
   * (4.5); `habits.gossipAfterDays` jours: rattrapage (4.8).
   */
  pending: Record<VillagerId, Record<string, [number, number]>>;
  /** Les dernières découvertes (`writeDiscovery`), la plus récente à la fin. */
  log: string[];
}

/** Goût découvert d'un habitant pour un objet (lot H2, section 6.2). */
export type TasteLevel = 'loves' | 'likes' | 'neutral' | 'dislikes';

/** Une décision à deux ouverte (section 5.2). */
export interface OpenDecision {
  p1?: string;
  p2?: string;
  /** Pas où les deux choix sont devenus les mêmes (absent: pas d'accord). */
  agreedAt?: number;
}

/** Champs de la 0.13 dans l'état du monde (format 14). */
export interface VillageWorldFields {
  habits: HabitsState;
  /** Lien de chaque habitant avec le duo (0 à 1000, lot H2); un habitant absent vaut 0. */
  bonds: Record<VillagerId, number>;
  /** Goûts découverts, par habitant et par objet (lot H2). */
  tastesKnown: Record<VillagerId, Record<ItemId, TasteLevel>>;
  /** Décisions à deux prises (section 5.2): l'option retenue, par décision. */
  decisions: Record<string, string>;
  /**
   * Décisions à deux ouvertes, pas encore prises (section 5.2): le choix de chaque joueur (absent:
   * pas encore choisi) et, quand les deux choix sont les mêmes, le pas de l'accord (la décision se
   * prend `agreeSeconds` plus tard). Absent des sauvegardes du format 14 d'avant: vide à la reprise.
   */
  decisionsOpen: Record<string, OpenDecision>;
  /** Étapes d'histoire faites, par habitant (lot H5). */
  storyDone: Record<VillagerId, QuestId[]>;
}

export function emptyVillageFields(): VillageWorldFields {
  return {
    habits: { known: {}, pending: {}, log: [] },
    bonds: {},
    tastesKnown: {},
    decisions: {},
    decisionsOpen: {},
    storyDone: {},
  };
}
