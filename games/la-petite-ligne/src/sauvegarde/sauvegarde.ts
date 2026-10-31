/**
 * Sauvegarde du monde (SV-02, SV-04, SV-06 réduits à la démo): l'état complet
 * en JSON, contrôlé et migré à la lecture, personnages liés à l'identifiant
 * stable des joueurs (jamais au rôle d'hôte ou d'invité).
 */
import type { GameMap } from '../etat/carte';
import type { CharacterId, WorldState } from '../etat/types';
import type { Content } from '../donnees/types';
import { DATA_SCHEMA, MINUTES_PER_HOUR } from '../simulation/constantes';
import { type Sim, format, wrapWorld } from '../simulation/contexte';
import { startScene } from '../simulation/dialogues';
import { runEffects } from '../simulation/effets';
import type { PlayerInfo } from '../simulation/monde';

/** Ce que le SDK enregistre (`SaveSnapshot`). */
export interface WorldSnapshot {
  label: string;
  progress: number;
  dataSchema: number;
  data: WorldState;
}

const LABEL_MAX = 40;

/** « samedi, jour 1, 14 h 20 » (libellé de la fiche du jeu, 40 caractères au plus). */
export function saveLabel(sim: Sim): string {
  const { day, minutes } = sim.world.clock;
  const texts = sim.content.texts;
  const weekday = texts.weekdays[(day - 1) % texts.weekdays.length] ?? '';
  const raw = texts.raw.ui;
  const hud = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).hud : undefined;
  const pick = (key: string, fallback: string): string => {
    const value = typeof hud === 'object' && hud !== null ? (hud as Record<string, unknown>)[key] : undefined;
    return typeof value === 'string' ? value : fallback;
  };
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.floor(minutes % MINUTES_PER_HOUR);
  const dayText = format(pick('day', '{weekday}, jour {day}'), { weekday, day });
  const timeText = format(pick('time', '{hours} h {minutes}'), { hours: h, minutes: String(m).padStart(2, '0') });
  const label = `${dayText}, ${timeText}`;
  return label.length > LABEL_MAX ? label.slice(0, LABEL_MAX) : label;
}

/** Avancement dans la semaine de la démo, de 0 à 1. */
export function progressOf(sim: Sim): number {
  const s = sim.content.settings.clock;
  const days = s.lastDay.day - s.firstDay.day;
  if (sim.world.phase === 'ended' || days <= 0) return 1;
  const elapsed = sim.world.clock.day - s.firstDay.day + sim.world.clock.minutes / (MINUTES_PER_HOUR * 24);
  return Math.max(0, Math.min(1, elapsed / days));
}

/** Instantané à enregistrer. L'état est copié: il continue de vivre pendant l'écriture. */
export function snapshotOf(sim: Sim): WorldSnapshot {
  return {
    label: saveLabel(sim),
    progress: progressOf(sim),
    dataSchema: DATA_SCHEMA,
    data: structuredClone(sim.world),
  };
}

export class SaveError extends Error {
  override readonly name = 'SaveError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Contrôle de forme d'une sauvegarde relue (données venues du disque). */
function checkWorld(data: unknown): WorldState {
  if (!isRecord(data)) throw new SaveError('sauvegarde: objet attendu');
  const required: [string, string][] = [
    ['tick', 'number'],
    ['revision', 'number'],
    ['seed', 'number'],
    ['phase', 'string'],
    ['purse', 'number'],
    ['nextId', 'number'],
  ];
  for (const [key, type] of required) {
    if (typeof data[key] !== type) throw new SaveError(`sauvegarde: champ « ${key} » invalide`);
  }
  const arrays = ['characters', 'garden', 'trees', 'constructions', 'furniture', 'groundItems', 'villagers', 'hens', 'quests', 'letters', 'flags', 'scripts'];
  for (const key of arrays) {
    if (!Array.isArray(data[key])) throw new SaveError(`sauvegarde: liste « ${key} » attendue`);
  }
  const characters = data.characters as unknown[];
  if (characters.length !== 2 || !characters.every((c) => isRecord(c) && typeof c.playerId === 'string' && isRecord(c.pos))) {
    throw new SaveError('sauvegarde: deux personnages attendus');
  }
  if (!isRecord(data.clock) || typeof data.clock.day !== 'number' || typeof data.clock.minutes !== 'number') {
    throw new SaveError('sauvegarde: horloge invalide');
  }
  const rng = data.rng;
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every((n) => typeof n === 'number')) {
    throw new SaveError('sauvegarde: état du générateur invalide');
  }
  return data as unknown as WorldState;
}

/**
 * Format 1 vers 2 (la démo passe à deux semaines): la commande payée au jour 8
 * entre dans l'historique et la suivante devient la commande en cours; une fin
 * de démo au jour 8 n'en est plus une, la partie reprend le soir du jour 8.
 */
function migrateToTwoWeeks(world: Record<string, unknown>, content: Content): void {
  const result = world.orderResult;
  const paid = isRecord(result);
  world.orderIndex = paid ? Math.min(1, content.settings.order.trains.length - 1) : 0;
  world.orderHistory = paid ? [structuredClone(result)] : [];
  const clock = world.clock;
  if (world.phase === 'ended' && isRecord(clock) && typeof clock.day === 'number' && clock.day < content.settings.clock.lastDay.day) {
    world.phase = 'day';
    world.ending = null;
    clock.running = true;
    clock.stoppedBy = null;
  }
}

/** Migrations d'un format au suivant. */
function migrate(data: unknown, dataSchema: number, content: Content): unknown {
  if (dataSchema > DATA_SCHEMA) throw new SaveError(`sauvegarde d'une version plus récente (format ${dataSchema})`);
  if (dataSchema < 2 && isRecord(data)) migrateToTwoWeeks(data, content);
  return data;
}

/**
 * Une sauvegarde du format 1 dont la commande du jour 8 est payée n'a pas joué
 * les effets durables que les données ajoutent depuis à cette échéance
 * (drapeaux, lettres, quête suivante): on les joue, sans les scènes.
 */
function catchUpFirstDeadline(sim: Sim): void {
  const first = sim.content.settings.order.trains[0];
  if (first === undefined || sim.world.orderHistory.length === 0) return;
  const durable = new Set(['set_flag', 'start_quest', 'send_letter']);
  for (const quest of sim.content.quests) {
    for (const step of quest.steps) {
      if (step.resolve !== 'at_deadline' || step.deadline?.day !== first.day) continue;
      runEffects(
        sim,
        step.onDeadline.filter((e) => durable.has(e.type)),
        null,
      );
    }
  }
}

/**
 * Lie chaque personnage à l'identifiant stable d'un joueur (SV-04): chacun
 * retrouve le sien quelle que soit la machine qui héberge. Un identifiant
 * inconnu (machine réinstallée) prend le personnage qui reste.
 */
export function bindPlayers(world: WorldState, players: readonly [PlayerInfo, PlayerInfo]): void {
  const known = new Map<string, CharacterId>();
  for (const c of world.characters) known.set(c.playerId, c.id);
  const free = world.characters.filter((c) => !players.some((p) => p.id === c.playerId));
  for (const player of players) {
    if (known.has(player.id)) continue;
    const take = free.shift();
    if (take !== undefined) take.playerId = player.id;
  }
  for (const c of world.characters) {
    const player = players.find((p) => p.id === c.playerId);
    if (player !== undefined) c.appearance.scarf = player.color;
  }
}

/**
 * Reprend un monde sauvegardé. Ce qui ne se sauvegarde pas (SV-02) est remis
 * à zéro: menus fermés, conversations closes, scène reprise à son début.
 */
export function restoreWorld(
  content: Content,
  map: GameMap,
  data: unknown,
  dataSchema: number,
  players: readonly [PlayerInfo, PlayerInfo],
): Sim {
  const world = checkWorld(migrate(data, dataSchema, content));
  bindPlayers(world, players);
  for (const c of world.characters) {
    // Nouvelle séance: l'écran titre se repasse à deux.
    c.titleReady = false;
    c.endReady = false;
    // Personne n'est absent au début d'une séance.
    c.lastInputTick = world.tick;
    c.absent = false;
    c.menu = null;
    c.dialogue = null;
    c.destination = null;
    c.placement = null;
    c.aim = null;
    if (c.status === 'menu' || c.status === 'dialogue') c.status = 'active';
  }
  for (const v of world.villagers) v.talkingWith = [];
  const scene = world.scene;
  world.scene = null;
  const sim = wrapWorld(content, map, world);
  if (dataSchema < 2) catchUpFirstDeadline(sim);
  if (scene !== null) startScene(sim, scene.dialogue);
  return sim;
}

/** Lit le JSON d'une sauvegarde (texte UTF-8 ou valeur déjà décodée par le SDK). */
export function decodeSave(data: unknown): unknown {
  if (typeof data === 'string') return JSON.parse(data) as unknown;
  return data;
}
