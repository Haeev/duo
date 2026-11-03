/**
 * Contexte de la simulation: l'état du monde, le contenu, la carte, le
 * générateur, les événements du pas et des caches qui ne se sauvegardent pas.
 */
import { createRandom, type RandomSource } from '@duo/sdk/sim';
import type { ClickTarget, Intent } from '../etat/actions';
import type { GameMap } from '../etat/carte';
import type {
  Character,
  CharacterId,
  GameNotification,
  NotificationKind,
  Vec2,
  WorldEvent,
  WorldState,
} from '../etat/types';
import type { Content } from '../donnees/types';
import type { BuildingId } from '../etat/carte';
import type { Blockers } from './grille';
import { SIM_DT } from './constantes';

/** Clic sur une cible encore loin: on agira en arrivant. */
export interface PendingAct {
  target: ClickTarget;
  /** Pas du clic. */
  since: number;
}

/** Objet ramassé au sol (il n'existe plus dans le monde). */
export interface RecentPickup {
  id: string;
  by: CharacterId;
  tick: number;
  pos: Vec2;
}

/** Caches recalculables, jamais sauvegardés ni transmis. */
export interface Runtime {
  /** Cases bloquées par les arbres debout et les meubles (0 ou 1). */
  dynamicBlocked: Uint8Array;
  dynamicDirty: boolean;
  /** Trajet restant d'un clic au sol. */
  charPaths: Record<CharacterId, Vec2[]>;
  /** Ce qu'il faudra faire en arrivant (clic sur une cible), et le pas du clic. */
  pendingAct: Record<CharacterId, PendingAct | null>;
  /** Derniers objets ramassés au sol, pour « Déjà pris » (SI-01). */
  recentPickups: RecentPickup[];
  villagerPaths: Record<string, { target: string; path: Vec2[] }>;
  /** Le monde a changé de façon discrète à ce pas. */
  changed: boolean;
  /** Une suite d'effets est en cours d'exécution (pas de réentrance). */
  pumping: boolean;
  /** Décalage de chaque porteur par rapport à la poutre. */
  beamOffsets: Record<CharacterId, Vec2>;
  /** « Il manque... » déjà dit pendant ce maintien de l'action. */
  holdNotified: Record<CharacterId, boolean>;
  /** Ce maintien de l'action a servi à un geste d'outil: il ne bâtit pas avant d'être relâché. */
  holdForTool: Record<CharacterId, boolean>;
  /** Appui reçu pendant un geste (Espace, clic à portée), joué à la fin du geste (`feel.inputBufferSeconds`). */
  bufferedAct: Record<CharacterId, { intent: Intent; tick: number } | null>;
  /** Espace tenu: case du dernier geste et fin de ce geste, pour passer à la case suivante de la rangée. */
  heldRepeat: Record<CharacterId, { cx: number; cy: number; endsAt: number } | null>;
  /** Ce que survole la souris de chaque joueur (intention `point_at`, R11), ou `null`: visée au clavier. */
  pointer: Record<CharacterId, ClickTarget | null>;
  /** Bâtiments fermés écrits dans `dynamicBlocked` (masque de `closedMask`), -1 avant le premier calcul. */
  closedDoors: number;
  /** Bâtiments fermés déjà annoncés à qui est dedans, `null` avant le premier pas. */
  announcedClosed: number | null;
  /** Collisions vues de dedans, par code de porte (`interieurs.ts`). */
  doorBlockers: Record<number, Blockers>;
  /** Porte fermée déjà dite à ce joueur (et où), jusqu'à ce qu'il s'en éloigne. */
  doorKnocked: Record<CharacterId, { building: BuildingId; at: Vec2 } | null>;
  /** « On ne passe pas la porte à deux avec ça. » déjà dit pendant ce portage. */
  doorCarryNotified: boolean;
  /** Minute de jeu du dernier chocolat chaud de chacun (bu ensemble dans la demi-heure: Cœur +5). */
  chocolateAt: Record<CharacterId, number | null>;
}

export interface Sim {
  readonly content: Content;
  readonly map: GameMap;
  world: WorldState;
  rng: RandomSource;
  events: WorldEvent[];
  runtime: Runtime;
}

export function createRuntime(map: GameMap): Runtime {
  return {
    dynamicBlocked: new Uint8Array(map.width * map.height),
    dynamicDirty: true,
    charPaths: { p1: [], p2: [] },
    pendingAct: { p1: null, p2: null },
    recentPickups: [],
    villagerPaths: {},
    changed: true,
    pumping: false,
    beamOffsets: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
    holdNotified: { p1: false, p2: false },
    holdForTool: { p1: false, p2: false },
    bufferedAct: { p1: null, p2: null },
    heldRepeat: { p1: null, p2: null },
    pointer: { p1: null, p2: null },
    closedDoors: -1,
    announcedClosed: null,
    doorBlockers: {},
    doorKnocked: { p1: null, p2: null },
    doorCarryNotified: false,
    chocolateAt: { p1: null, p2: null },
  };
}

/** Crée le contexte autour d'un état (nouveau ou rechargé). */
export function wrapWorld(content: Content, map: GameMap, world: WorldState): Sim {
  return { content, map, world, rng: createRandom(world.rng), events: [], runtime: createRuntime(map) };
}

export function dt(): number {
  return SIM_DT;
}

export function character(sim: Sim, id: CharacterId): Character {
  const found = sim.world.characters.find((c) => c.id === id);
  if (found === undefined) throw new Error(`personnage inconnu: ${id}`);
  return found;
}

export function partnerOf(id: CharacterId): CharacterId {
  return id === 'p1' ? 'p2' : 'p1';
}

export function emit(sim: Sim, event: WorldEvent): void {
  sim.events.push(event);
  sim.runtime.changed = true;
}

export function changed(sim: Sim): void {
  sim.runtime.changed = true;
}

export function newId(sim: Sim, prefix: string): string {
  sim.world.nextId += 1;
  return `${prefix}${sim.world.nextId}`;
}

/** Remplace `{nom}` dans un texte. Un nom absent reste tel quel (jetons de touches). */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

export function message(sim: Sim, key: string, vars: Record<string, string | number> = {}): string {
  const template = sim.content.texts.messages[key];
  return template === undefined ? key : format(template, vars);
}

/** Nom d'un objet au singulier ou au pluriel. */
export function itemName(sim: Sim, item: string, count: number): string {
  const def = sim.content.items[item];
  if (def === undefined) return item;
  return count > 1 ? def.plural : def.name;
}

/** L'objet dans une phrase: « un matelas » (champ `indefinite`, sinon le nom seul), « 4 planches ». */
export function itemWithArticle(sim: Sim, item: string, count: number): string {
  const def = sim.content.items[item];
  if (def === undefined) return item;
  return count > 1 ? `${count} ${def.plural}` : (def.indefinite ?? def.name);
}

export function notify(
  sim: Sim,
  who: CharacterId | 'both',
  kind: NotificationKind,
  text: string,
  extra: { hint?: string; proposal?: string; key?: string } = {},
): void {
  const targets: CharacterId[] = who === 'both' ? ['p1', 'p2'] : [who];
  for (const id of targets) {
    const c = character(sim, id);
    sim.world.nextId += 1;
    const notification: GameNotification = {
      id: sim.world.nextId,
      kind,
      text,
      hint: extra.hint ?? null,
      proposal: extra.proposal ?? null,
      key: extra.key ?? extra.hint ?? null,
      tick: sim.world.tick,
    };
    c.notifications.push(notification);
    const kept = sim.content.settings.feel.notificationsKept;
    if (c.notifications.length > kept) c.notifications.splice(0, c.notifications.length - kept);
  }
  sim.runtime.changed = true;
}

/** Notification d'un message de `textes.json` (sa clé suit, pour l'interface et le son). */
export function notifyKey(
  sim: Sim,
  who: CharacterId | 'both',
  kind: NotificationKind,
  key: string,
  vars: Record<string, string | number> = {},
  extra: { proposal?: string } = {},
): void {
  notify(sim, who, kind, message(sim, key, vars), { ...extra, key });
}

export function say(
  sim: Sim,
  who: CharacterId | 'both',
  key: string,
  vars: Record<string, string | number> = {},
): void {
  notifyKey(sim, who, 'message', key, vars);
}

/** Comme `say`, mais rien si le texte manque dans `textes.json` (message facultatif). */
export function sayIfWritten(
  sim: Sim,
  who: CharacterId | 'both',
  key: string,
  vars: Record<string, string | number> = {},
): void {
  if (Object.hasOwn(sim.content.texts.messages, key)) say(sim, who, key, vars);
}

/** Prénom de l'autre joueur, pour `{partner}`. */
export function partnerName(sim: Sim, id: CharacterId): string {
  return character(sim, partnerOf(id)).name;
}

/** Ajoute à un compteur, pour le duo et pour le personnage s'il est donné. */
export function bump(sim: Sim, key: string, by: CharacterId | null, amount = 1): void {
  const counters = sim.world.counters;
  counters.duo[key] = (counters.duo[key] ?? 0) + amount;
  if (by !== null) counters[by][key] = (counters[by][key] ?? 0) + amount;
  const today = sim.world.countersToday;
  today.duo[key] = (today.duo[key] ?? 0) + amount;
  if (by !== null) today[by][key] = (today[by][key] ?? 0) + amount;
  sim.runtime.changed = true;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function point(sim: Sim, id: string): Vec2 {
  const found = sim.map.points[id];
  if (found === undefined) throw new Error(`point de carte inconnu: ${id}`);
  return found;
}

/** Secondes de simulation en pas. */
export function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds / SIM_DT));
}
