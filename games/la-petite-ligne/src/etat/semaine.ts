/**
 * Ce que l'interface affiche de la suite après le jour 15 (tour 8, sections 1.2, 2.6, 3.4 et 4.9),
 * lu dans l'état et le contenu: l'écran d'étape, la carte de saison du petit-déjeuner, la saison
 * du HUD, la météo du matin et le titre de la quête de la semaine. Pur (ni DOM ni Three.js).
 */
import {
  dayOfSeason,
  seasonOfDay,
  seasonStartingOn,
  stageCanContinue,
} from '../donnees/calendrier';
import { agreeMoney } from '../donnees/monnaie';
import type { Content, Season, StageId } from '../donnees/types';
import type { CharacterId, DeepReadonly, QuestState, StageChoice, WorldState } from './types';

type ReadWorld = DeepReadonly<WorldState>;

function rawAt(content: Content, path: readonly string[]): unknown {
  let node: unknown = content.texts.raw;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function text(content: Content, path: readonly string[]): string | null {
  const value = rawAt(content, path);
  return typeof value === 'string' ? value : null;
}

function fill(template: string, vars: Record<string, string | number>): string {
  const filled = template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
  return agreeMoney(filled);
}

export interface StageScreen {
  stage: StageId;
  /** `textes.stages.<id>`: titre, sous-titre, texte; `next`: pourquoi « Rester » manque (sinon `null`). */
  title: string;
  subtitle: string;
  text: string;
  next: string | null;
  /** « Rester à la Halte » existe (une journée jouable suit l'étape dans cette version). */
  canStay: boolean;
  /** Choix de chacun (« Veut rester », « Veut finir »). */
  choices: Record<CharacterId, StageChoice | null>;
  /** Compteurs: journées vécues, lignes des commandes remplies sur demandées, toutes commandes. */
  days: number;
  linesDone: number;
  linesTotal: number;
  orders: number;
  /** Chantiers bâtis (tour 9). */
  chantiers: number;
}

/** L'écran d'étape ouvert (phase `ended`), ou `null`. */
export function stageScreen(world: ReadWorld, content: Content): StageScreen | null {
  const stage = world.stages.current;
  if (world.phase !== 'ended' || stage === null) return null;
  const def = content.settings.stages.find((s) => s.id === stage);
  const block = def?.texts ?? stage;
  const canStay = stageCanContinue(content.settings, stage);
  return {
    stage,
    title: text(content, ['stages', block, 'title']) ?? '',
    subtitle: text(content, ['stages', block, 'subtitle']) ?? '',
    text: text(content, ['stages', block, 'text']) ?? '',
    next: canStay ? null : text(content, ['stages', block, 'next']),
    canStay,
    choices: { p1: world.stages.choice.p1, p2: world.stages.choice.p2 },
    days: world.ending?.days ?? world.clock.day,
    linesDone: world.orderTotals.linesDone,
    linesTotal: world.orderTotals.linesTotal,
    orders: world.orderTotals.orders,
    // Tour 9: quatrième compteur de l'écran d'étape (`ui.stage.chantiers`).
    chantiers: Object.values(world.improvements).filter((x) => x.builtDay !== null).length,
  };
}

export interface SeasonCard {
  season: Season;
  title: string;
  lines: string[];
}

/** Carte de saison du petit-déjeuner, le premier matin d'une saison (jours 22, 43, 64, 85), sinon `null`. */
export function seasonCard(world: ReadWorld, content: Content): SeasonCard | null {
  const season = seasonStartingOn(content.settings, world.clock.day);
  if (season === null) return null;
  const lines = rawAt(content, ['seasonCards', season, 'lines']);
  return {
    season,
    title: text(content, ['seasonCards', season, 'title']) ?? '',
    lines: Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string') : [],
  };
}

/** Saison du HUD, sous la date: « Été · jour 3 » (`ui.hud.season`, `ui.hud.seasonNames`). */
export function hudSeason(world: ReadWorld, content: Content): string {
  const season = seasonOfDay(content.settings, world.clock.day);
  const name = text(content, ['ui', 'hud', 'seasonNames', season]) ?? season;
  return fill(text(content, ['ui', 'hud', 'season']) ?? '{season} · jour {day}', {
    season: name,
    day: dayOfSeason(content.settings, world.clock.day),
  });
}

/** Météo du petit-déjeuner: « Soleil », ou « Soleil, brume au lever » un matin de brume. */
export function weatherLabel(world: ReadWorld, content: Content): string {
  const base = content.texts.weather[world.weather] ?? world.weather;
  const mist = content.texts.weather.mistMorning;
  return world.morningMist && mist !== undefined ? `${base}, ${mist}` : base;
}

/** Titre d'une quête, `{day}` remplacé par le jour du train de la quête de la semaine. */
export function questTitleOf(content: Content, state: DeepReadonly<QuestState>): string {
  const def = content.quests.find((q) => q.id === state.id);
  return def === undefined ? state.id : fill(def.title, { day: state.train ?? '' });
}
