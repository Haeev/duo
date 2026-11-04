/**
 * Décisions à deux (0.13, conception `v0-13-habitants.md`, section 5.2). Une décision s'ouvre par
 * l'effet `open_decision`, ou d'elle-même quand l'étape en cours d'une quête attend
 * `decision_made` sur elle. Chaque joueur choisit sur son écran (intention validée ici, chez
 * l'hôte); deux choix pareils font l'accord, et la décision se prend `agreeSeconds` plus tard si
 * personne ne change d'avis entre-temps. Pas de minuteur pour se décider, rien ne se prend seul:
 * un joueur absent fait attendre la décision. Le résultat s'écrit dans `world.decisions`, que
 * l'invité reçoit avec l'état.
 */
import { decisionDef, type DecisionDef } from '../donnees/decisions';
import type { Condition } from '../donnees/types';
import type { CharacterId } from '../etat/types';
import type { OpenDecision } from '../etat/types-voisins';
import { SIM_HZ } from './constantes';
import { type Sim, character, emit, notifyKey } from './contexte';
import { runEffects } from './effets';

const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

/** Ouvre la décision chez les deux (rien si elle est inconnue, déjà ouverte ou déjà prise). */
export function openDecision(sim: Sim, id: string): void {
  const { world } = sim;
  const def = decisionDef(sim.content.decisions, id);
  if (def === undefined || world.decisions[id] !== undefined || world.decisionsOpen[id] !== undefined) return;
  world.decisionsOpen[id] = {};
  sim.runtime.changed = true;
  const name = sim.content.villagers.find((v) => v.id === def.villager)?.firstName ?? def.villager;
  notifyKey(sim, 'both', 'message', 'decision_opened', { name, question: def.question });
  emit(sim, { type: 'decision_opened', decision: id, villager: def.villager });
}

/** Le choix d'un joueur (`null`: il reprend le sien). Ignoré si la décision n'est pas ouverte ou l'option inconnue. */
export function voteDecision(sim: Sim, by: CharacterId, id: string, option: string | null): void {
  const open = sim.world.decisionsOpen[id];
  const def = decisionDef(sim.content.decisions, id);
  if (open === undefined || def === undefined) return;
  if (option !== null && !def.options.some((o) => o.id === option)) return;
  if ((open[by] ?? null) === option) return;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- choix d'un des deux joueurs, repris.
  if (option === null) delete open[by];
  else open[by] = option;
  sim.runtime.changed = true;
  emit(sim, { type: 'decision_vote', decision: id, by, option });
  settleAgreement(sim, id, open);
}

/** L'accord se fait (ou se défait) selon les deux choix et la présence des deux joueurs. */
function settleAgreement(sim: Sim, id: string, open: OpenDecision): void {
  const agreed = agreedOption(sim, open);
  if (agreed === null) {
    if (open.agreedAt !== undefined) {
      delete open.agreedAt;
      sim.runtime.changed = true;
    }
    return;
  }
  if (open.agreedAt !== undefined) return;
  open.agreedAt = sim.world.tick;
  sim.runtime.changed = true;
  emit(sim, { type: 'decision_agreed', decision: id, option: agreed });
}

/** L'option choisie par les deux, présents tous les deux, ou `null`. */
function agreedOption(sim: Sim, open: OpenDecision): string | null {
  const a = open.p1;
  if (a === undefined || a !== open.p2) return null;
  return PLAYERS.some((p) => character(sim, p).absent) ? null : a;
}

/** `decision_made` cités par ces conditions, `all` et `any` compris (pas sous un `not`: celui-là n'attend rien). */
function citedDecisions(conditions: readonly Condition[], out: string[]): void {
  for (const c of conditions) {
    if (c.type === 'decision_made') out.push(c.decision);
    else if (c.type === 'all' || c.type === 'any') citedDecisions(c.conditions, out);
  }
}

/**
 * Décisions que l'étape en cours d'une quête attend (« La montre d'Émile »: `any` des deux options
 * de `minute`). Une étape qui lit une décision prise plus tôt (Léon et `cabane`) ne rouvre rien.
 */
function awaitedDecisions(sim: Sim): string[] {
  const out: string[] = [];
  for (const q of sim.world.quests) {
    if (q.status !== 'active') continue;
    const step = sim.content.quests.find((d) => d.id === q.id)?.steps[q.step];
    if (step !== undefined) citedDecisions(step.conditions, out);
  }
  return out;
}

/** À chaque pas, chez l'hôte: ouvertures attendues par les quêtes, accords à confirmer, décisions prises. */
export function updateDecisions(sim: Sim): void {
  const { world } = sim;
  if (sim.content.decisions.list.length === 0) return;
  for (const id of awaitedDecisions(sim)) openDecision(sim, id);
  const wait = Math.round(sim.content.decisions.agreeSeconds * SIM_HZ);
  for (const [id, open] of Object.entries(world.decisionsOpen)) {
    // Un joueur parti pendant les deux secondes: l'accord attend son retour.
    settleAgreement(sim, id, open);
    const option = agreedOption(sim, open);
    if (option === null || open.agreedAt === undefined || world.tick - open.agreedAt < wait) continue;
    const def = decisionDef(sim.content.decisions, id);
    if (def !== undefined) take(sim, def, option);
  }
}

function take(sim: Sim, def: DecisionDef, option: string): void {
  const { world } = sim;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- décision par identifiant: prise, elle n'est plus ouverte.
  delete world.decisionsOpen[def.id];
  world.decisions[def.id] = option;
  sim.runtime.changed = true;
  const opt = def.options.find((o) => o.id === option);
  notifyKey(sim, 'both', 'message', 'decision_taken', { choice: opt?.label ?? option });
  emit(sim, { type: 'decision_taken', decision: def.id, option });
  runEffects(sim, opt?.effects ?? [], null);
}
