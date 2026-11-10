/**
 * Interfaces de lecture étroites des onglets du carnet. Chaque onglet ne connaît que ces formes:
 * quand le système qui les remplit arrive (moteur de quêtes, habitants, collections), il suffit de
 * réécrire l'adaptateur correspondant de `worldSources`; les modèles de vue et l'affichage ne
 * bougent pas. Ce qui n'existe pas encore est rempli par `fictif.ts` (état factice documenté).
 *
 * Lu aujourd'hui dans l'état réel: les quêtes en cours (`progress.quests` et les fiches du lieu),
 * les habitants rencontrés, leurs positions et leurs cœurs (`progress.bonds`), les entrées trouvées
 * (`progress.collections`), les joueurs. Pas encore dans l'état: métier, goûts, planning, bulles
 * « j'ai quelque chose », conditions de rencontre des collections, plan du lieu, zones fermées.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { bondKey } from '../../etat/progression';
import { glanceTarget, journal } from '../../simulation/quetes/lecture';
import type { ReadonlyWorld } from '../../etat/monde';
import type { GraphicsOptions } from '../../rendu/options';
import { UI_TUNING } from '../reglages';
import type { PlanRead } from './plan';

// ---------- Quêtes ----------

export type QuestKind = 'main' | 'side' | 'errand';

export interface QuestChapterRead {
  readonly id: string;
  readonly title: string;
  readonly state: 'done' | 'current' | 'todo';
}

export interface QuestLineRead {
  readonly id: string;
  readonly kind: QuestKind;
  readonly title: string;
  /** Habitant qui la donne (portrait de la carte), `null`: aucun. */
  readonly giver: { readonly id: string; readonly name: string } | null;
  readonly chapters: readonly QuestChapterRead[];
  readonly finished: boolean;
  /** L'étape courante en une phrase (vide si finie). */
  readonly step: string;
  /** L'étape exige les deux joueurs ensemble. */
  readonly together: boolean;
  /** Où mène l'étape courante, en mètres du lieu courant; `null`: nulle part ou autre lieu. */
  readonly target: { readonly x: number; readonly y: number } | null;
}

// ---------- Habitants ----------

export interface TasteRead {
  /** Identifiant d'objet découvert, `null`: pas encore découvert (affiché « ? »). */
  readonly item: string | null;
  readonly name: string | null;
}

export interface VillagerRead {
  readonly id: string;
  readonly name: string;
  readonly met: boolean;
  /** Cœurs en demi-cœurs (0 à 10) pour [toi, l'autre joueur]. */
  readonly halves: readonly [number, number];
  /** Métier en un ou deux mots, `null`: pas encore su. */
  readonly craft: string | null;
  readonly likes: readonly TasteRead[];
  readonly dislikes: readonly TasteRead[];
  /** Où le trouver à cette heure, `null`: on ne sait pas. */
  readonly where: { readonly label: string; readonly x: number; readonly y: number } | null;
  /** Bulle « j'ai quelque chose pour toi ». */
  readonly something: 'story' | 'request' | 'gift' | null;
}

// ---------- Collections ----------

export const COLLECTION_FAMILIES = [
  'fish',
  'insects',
  'fossils',
  'flowers',
  'outfits',
  'recipes',
  'postcards',
  'music',
] as const;
export type CollectionFamily = (typeof COLLECTION_FAMILIES)[number];

export interface CollectionEntryRead {
  readonly id: string;
  readonly name: string;
  readonly rarity: 1 | 2 | 3;
  readonly found: boolean;
  /** Qui l'a trouvé en premier. */
  readonly firstBy: 0 | 1 | 'duo' | null;
  /** Conditions découvertes; `null`: pas encore su. */
  readonly clues: {
    readonly moments: readonly string[] | null;
    readonly weathers: readonly string[] | null;
    readonly seasons: readonly string[] | null;
    readonly where: string | null;
  };
}

export interface CollectionRead {
  readonly family: CollectionFamily;
  readonly entries: readonly CollectionEntryRead[];
}

// ---------- Carte ----------

export interface MapRead {
  readonly plan: PlanRead;
  readonly players: readonly {
    readonly index: PlayerIndex;
    readonly name: string;
    readonly x: number;
    readonly y: number;
  }[];
  readonly villagers: readonly {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly something: boolean;
  }[];
  /** Zones encore fermées (identifiants du plan). */
  readonly closed: readonly string[];
  readonly night: boolean;
}

// ---------- Réglages ----------

export type UiScale = 'normal' | 'large' | 'xlarge';

/** Réglages de la machine, hors qualité graphique (portée par le rendu). */
export interface UiSettings {
  /** Volume général, 0 à 100. */
  readonly volume: number;
  readonly needsAlways: boolean;
  readonly scale: UiScale;
  readonly reducedMotion: boolean;
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  volume: 80,
  needsAlways: false,
  scale: 'normal',
  reducedMotion: false,
};

/** Facteur de chaque taille d'interface (police racine du carnet et du HUD). */
export const UI_SCALE_FACTOR: Readonly<Record<UiScale, number>> = {
  normal: 1,
  large: 1.08,
  xlarge: 1.15,
};

/**
 * Port des réglages: `graphics` et `setGraphics` sont ceux du rendu (`Renderer`); le reste
 * est tenu par l'interface (volume à brancher au SDK audio par `main.ts`).
 */
export interface SettingsPort {
  ui(): UiSettings;
  setUi(next: UiSettings): void;
  graphics(): GraphicsOptions;
  setGraphics(options: GraphicsOptions): void;
}

// ---------- Sources ----------

export interface CarnetSources {
  quests(world: ReadonlyWorld, local: PlayerIndex): readonly QuestLineRead[];
  villagers(world: ReadonlyWorld, local: PlayerIndex): readonly VillagerRead[];
  collections(world: ReadonlyWorld, local: PlayerIndex): readonly CollectionRead[];
  map(world: ReadonlyWorld, local: PlayerIndex): MapRead | null;
}

export interface WorldSourcesExtras {
  /** Plan du lieu (par identifiant de lieu), tant que le contenu des lieux n'en porte pas. */
  readonly plans?: Readonly<Record<string, PlanRead>>;
  /** Fiches des entrées de collection, tant que le contenu n'en porte pas. */
  readonly catalogue?: readonly CollectionRead[];
  /** Zones fermées par lieu, tant que le moteur d'actes n'existe pas. */
  readonly closed?: (placeId: string, world: ReadonlyWorld) => readonly string[];
}

const HALF_HEART_POINTS = 50;
const MAX_HALVES = 10;

/** Demi-cœurs d'un total de points d'amitié (100 points par cœur, cahier 4.9). */
export function halvesOf(points: number): number {
  return Math.max(0, Math.min(MAX_HALVES, Math.floor(points / HALF_HEART_POINTS)));
}

/** Position d'une cible d'étape dans le lieu: un point de la carte, ou le point où se tient l'habitant. */
function targetOf(
  place: Content['places'][string],
  target: { readonly point: string } | { readonly villager: string } | null,
): { readonly x: number; readonly y: number } | null {
  if (target === null) return null;
  const pointId =
    'point' in target
      ? target.point
      : place.villagers.find((x) => x.id === target.villager)?.stands;
  const spot = pointId === undefined ? undefined : place.map.points[pointId];
  return spot === undefined ? null : { x: spot.x, y: spot.y };
}

/** Adaptateurs sur l'état réel; ce qui manque est vide (jamais inventé). */
export function worldSources(content: Content, extras: WorldSourcesExtras = {}): CarnetSources {
  return {
    quests(world, local) {
      // Le moteur de quêtes fait foi: étapes ouvertes (en parallèle comprises), textes accordés
      // pour ce joueur, repère du coup d'œil quand la suite est suivie.
      const glance = glanceTarget(world, content, local);
      return journal(world, content, local).map((entry) => {
        const place = content.places[entry.place];
        const def = place?.quests[entry.quest];
        const progress = world.progress.quests[entry.quest];
        const index = Math.max(0, def?.chapters.findIndex((c) => c.id === progress?.chapter) ?? 0);
        const giver =
          def?.giver === null || def === undefined
            ? undefined
            : place?.villagers.find((x) => x.id === def.giver);
        const first = entry.steps[0];
        const firstDef = def?.chapters.flatMap((c) => c.steps).find((st) => st.id === first?.id);
        const target =
          glance?.quest === entry.quest
            ? { x: glance.target.x, y: glance.target.y }
            : entry.done || place === undefined || entry.place !== world.common.place
              ? null
              : targetOf(place, firstDef?.target ?? null);
        return {
          id: entry.quest,
          kind: entry.kind,
          title: entry.title,
          giver: giver === undefined ? null : { id: giver.id, name: giver.name },
          chapters: (def?.chapters ?? []).map((c, i) => ({
            id: c.id,
            title: c.title,
            state: entry.done || i < index ? 'done' : i === index ? 'current' : 'todo',
          })),
          finished: entry.done,
          step: entry.steps.map((st) => st.objective).join(' ; '),
          together: entry.steps.some((st) => st.together),
          target,
        };
      });
    },
    villagers(world, local) {
      const other: PlayerIndex = local === 0 ? 1 : 0;
      const placeId = world.common.place;
      const place = content.places[placeId];
      const state = world.places[placeId];
      if (place === undefined) return [];
      return place.villagers.map((def) => {
        const slot = state?.villagers[def.id];
        const met = slot?.met[local] ?? false;
        return {
          id: def.id,
          name: def.name,
          met,
          halves: [
            halvesOf(world.progress.bonds[bondKey(def.id, local)] ?? 0),
            halvesOf(world.progress.bonds[bondKey(def.id, other)] ?? 0),
          ],
          craft: null,
          likes: [],
          dislikes: [],
          where:
            met && state?.villagers[def.id] !== undefined
              ? {
                  label: place.def.name,
                  x: state.villagers[def.id]?.body.x ?? 0,
                  y: state.villagers[def.id]?.body.y ?? 0,
                }
              : null,
          something: null,
        };
      });
    },
    collections(world) {
      const catalogue = extras.catalogue ?? [];
      return COLLECTION_FAMILIES.map((family) => {
        const found = new Set(world.progress.collections[family] ?? []);
        const entries = catalogue.find((c) => c.family === family)?.entries ?? [];
        return {
          family,
          entries: entries.map((e) => ({ ...e, found: found.has(e.id) || e.found })),
        };
      });
    },
    map(world, local) {
      const placeId = world.common.place;
      const plan = extras.plans?.[placeId];
      const place = content.places[placeId];
      const state = world.places[placeId];
      if (plan === undefined || place === undefined) return null;
      return {
        plan,
        players: world.players.map((p, i) => ({
          index: i === 0 ? 0 : 1,
          name: p.name,
          x: p.body.x,
          y: p.body.y,
        })),
        villagers: place.villagers.flatMap((def) => {
          const slot = state?.villagers[def.id];
          if (slot?.met[local] !== true) return [];
          return [{ id: def.id, name: def.name, x: slot.body.x, y: slot.body.y, something: false }];
        }),
        closed: extras.closed?.(placeId, world) ?? [],
        night: world.minutes >= UI_TUNING.nightFrom || world.minutes < UI_TUNING.nightUntil,
      };
    },
  };
}
