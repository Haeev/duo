/**
 * Souvenirs du duo (tour 7, conception section 2.2 et 2.4): une ligne par moment vu ensemble et
 * par quête secrète finie, quel que soit le nombre de passages. L'hôte les écrit; l'onglet
 * Souvenirs du carnet les lit chez chacun (`interface/modele-souvenirs.ts`).
 */
import type {
  CharacterId,
  MemoriesState,
  MomentMemoryEntry,
  MomentToday,
  SecretMemoryEntry,
} from '../etat/types';
import type { Content, MomentDef } from '../donnees/types';
import type { Sim } from './contexte';

export function emptyMemories(): MemoriesState {
  return { moments: [], secrets: [] };
}

/** Habitant de la première fois: celui de la confidence, sinon celui qui a donné la quête. */
function firstVoice(
  content: Content,
  def: MomentDef,
  origin: MomentToday['origin'],
  hintTo: CharacterId | null,
): string | null {
  if (hintTo !== null) return def.hintFrom;
  if (origin === 'quest' && def.quest !== null)
    return content.quests.find((q) => q.id === def.quest)?.giver ?? null;
  return null;
}

/** Au début de l'apogée (même instant que la récompense): première fois, ou une fois de plus. */
export function recordMoment(sim: Sim, def: MomentDef, today: MomentToday): void {
  const { world } = sim;
  const day = world.clock.day;
  const known = world.memories.moments.find((m) => m.id === def.id);
  if (known !== undefined) {
    known.count += 1;
    known.last = day;
  } else {
    const hintTo = today.origin === 'ambient' ? today.hintTo : null;
    const entry: MomentMemoryEntry = {
      id: def.id,
      first: day,
      hintTo,
      hintFrom: firstVoice(sim.content, def, today.origin, hintTo),
      count: 1,
      last: day,
    };
    world.memories.moments.push(entry);
  }
  sim.runtime.changed = true;
}

/** À la fin d'une quête à secret: qui était l'informé, du premier coup ou non, la variante. */
export function recordSecret(sim: Sim, quest: string): void {
  const { world } = sim;
  const entry = world.secrets.entries.find((e) => e.quest === quest);
  if (entry === undefined || world.memories.secrets.some((m) => m.quest === quest)) return;
  const memory: SecretMemoryEntry = {
    quest,
    day: world.clock.day,
    informed: entry.informed,
    firstTry: entry.errors === 0,
    variant: entry.variant,
  };
  world.memories.secrets.push(memory);
  sim.runtime.changed = true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCharacter(value: unknown): value is CharacterId {
  return value === 'p1' || value === 'p2';
}

/**
 * Format 3 vers 4: les souvenirs se reconstruisent depuis `world.moments.history` (passages
 * `seen` seulement; le destinataire de la confidence n'y est pas, la ligne à soi est donc omise
 * pour un moment d'ambiance) et depuis les quêtes à secret finies (jour de démarrage de la quête:
 * celui de la fin n'était pas gardé). Une sauvegarde d'avant le format 3 n'a pas vécu de secret.
 */
export function memoriesFromSave(
  world: Record<string, unknown>,
  content: Content,
  fromSchema: number,
): MemoriesState {
  const out = emptyMemories();
  const moments =
    isRecord(world.moments) && Array.isArray(world.moments.history) ? world.moments.history : [];
  for (const h of moments) {
    if (!isRecord(h) || h.seen !== true || typeof h.id !== 'string' || typeof h.day !== 'number')
      continue;
    const def = content.moments.find((m) => m.id === h.id);
    if (def === undefined) continue;
    const known = out.moments.find((m) => m.id === h.id);
    if (known !== undefined) {
      known.count += 1;
      known.first = Math.min(known.first, h.day);
      known.last = Math.max(known.last, h.day);
      continue;
    }
    const origin = h.origin === 'quest' ? 'quest' : 'ambient';
    out.moments.push({
      id: h.id,
      first: h.day,
      hintTo: null,
      hintFrom: firstVoice(content, def, origin, null),
      count: 1,
      last: h.day,
    });
  }
  if (fromSchema < 3) return out;
  const entries =
    isRecord(world.secrets) && Array.isArray(world.secrets.entries) ? world.secrets.entries : [];
  const quests = Array.isArray(world.quests) ? world.quests : [];
  for (const e of entries) {
    if (!isRecord(e) || typeof e.quest !== 'string' || !isCharacter(e.informed)) continue;
    const state = quests.find((q): q is Record<string, unknown> => isRecord(q) && q.id === e.quest);
    if (state?.status !== 'done' || out.secrets.some((m) => m.quest === e.quest)) continue;
    out.secrets.push({
      quest: e.quest,
      day: typeof state.startedDay === 'number' ? state.startedDay : 1,
      informed: e.informed,
      firstTry: e.errors === 0,
      variant: typeof e.variant === 'number' ? e.variant : 0,
    });
  }
  return out;
}
