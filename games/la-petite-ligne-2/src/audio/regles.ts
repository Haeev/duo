/**
 * De l'événement au son, par la table `evenements.json`. Logique pure (testée dans Node): le moteur
 * Web Audio ne fait que jouer ce qu'elle décide.
 */
import type { GameEvent } from '../simulation/noyau/evenements';
import type { EventRule, EventTable } from './schemas';

/** Un événement que le son écoute: ceux de la simulation, et ceux que le moteur se donne (joints). */
export interface HeardEvent {
  readonly type: string;
}

export interface EventSound {
  readonly sound: string;
  /** Joueur qui a fait le geste (`null`: sans position, ou un coffre commun). */
  readonly actor: 0 | 1 | null;
  readonly placed: boolean;
  /** L'événement concerne l'autre joueur: plus bas et placé. */
  readonly own: boolean;
  /** Faire taire ce son (tenu) au lieu de le jouer. */
  readonly stop: boolean;
}

type Fields = Readonly<Record<string, unknown>>;

function matches(expected: unknown, actual: unknown): boolean {
  if (typeof expected === 'object' && expected !== null) {
    const bounds = expected as { gt?: number; lt?: number; notNull?: boolean };
    if (bounds.notNull === true && actual === null) return false;
    if (bounds.notNull === true && actual === undefined) return false;
    if (bounds.gt !== undefined && !(typeof actual === 'number' && actual > bounds.gt))
      return false;
    if (bounds.lt !== undefined && !(typeof actual === 'number' && actual < bounds.lt))
      return false;
    return true;
  }
  return expected === actual;
}

function ruleMatches(rule: EventRule, type: string, event: Fields): boolean {
  if (type !== rule.on) return false;
  for (const [field, expected] of Object.entries(rule.where)) {
    if (!matches(expected, event[field])) return false;
  }
  return true;
}

/**
 * Les sons que cet événement déclenche pour le joueur `local`, dans l'ordre de la table. Le premier
 * gabarit qui convient décide, même s'il n'est pas pour ce joueur; une règle `also` laisse la
 * recherche continuer après elle (la butée sonne, et la règle suivante fait taire le roulement).
 */
export function soundsForEvent(
  table: EventTable,
  event: HeardEvent | GameEvent,
  local: 0 | 1 | null,
): EventSound[] {
  const fields = event as unknown as Fields;
  const out: EventSound[] = [];
  for (const rule of table.rules) {
    if (!ruleMatches(rule, event.type, fields)) continue;
    const raw = fields[rule.actor];
    const actor = raw === 0 || raw === 1 ? raw : null;
    const own = actor !== null && actor === local;
    const heard = !(rule.audience === 'own' && !own) && !(rule.audience === 'other' && own);
    if (heard)
      out.push({
        sound: rule.sound,
        actor,
        placed: rule.placed && actor !== null,
        own,
        stop: rule.stop === true,
      });
    if (rule.also !== true) break;
  }
  return out;
}

/** Le premier son que cet événement déclenche pour le joueur `local`, ou `null`. */
export function soundForEvent(
  table: EventTable,
  event: HeardEvent | GameEvent,
  local: 0 | 1 | null,
): EventSound | null {
  return soundsForEvent(table, event, local)[0] ?? null;
}
