/**
 * Informations propres à un seul joueur (R16, conception du tour 6, section 2): au démarrage
 * d'une quête à secret, l'informé le reçoit, l'autre agit; une erreur ne coûte jamais rien.
 * Les poules s'appellent par leur nom (geste « appeler »), Jeanne vérifie la réponse de Firmin
 * par un choix de dialogue (`dialogues.ts`).
 */
import type { Character, CharacterId, Hen, SecretEntry } from '../etat/types';
import type { QuestDef } from '../donnees/types';
import { HEN_NAMES_QUEST, henUnknown } from '../etat/secrets';
import { evaluate, secretEntry, variantOf } from './conditions';
import { type Sim, character, distance, emit, message, partnerName, partnerOf, say } from './contexte';

/** Conversation « Comment s'appelle... ? » ouverte chez celui qui appelle une poule (pas un dialogue des données). */
export const HEN_CALL_DIALOGUE = 'hen_call';
const NAME_CHOICE = 'name:';
const LEAVE_CHOICE = 'leave';

function questDef(sim: Sim, quest: string): QuestDef | undefined {
  return sim.content.quests.find((q) => q.id === quest);
}

/** Démarrage d'une quête à secret: l'informé est celui dont c'est le tour, puis le tour passe à l'autre. */
export function startSecret(sim: Sim, def: QuestDef): void {
  const secret = def.secret;
  const world = sim.world;
  if (secret === null || world.secrets.entries.some((e) => e.quest === def.id)) return;
  const informed: CharacterId = secret.informed === 'turn' ? world.secrets.turn : secret.informed;
  const entry: SecretEntry = {
    id: secret.id,
    quest: def.id,
    informed,
    doer: partnerOf(informed),
    variant: secret.of > 1 ? variantOf(world.seed, secret.variantGroup, secret.of) : 0,
    errors: 0,
    revealed: false,
    shared: false,
    nudged: false,
  };
  world.secrets.entries.push(entry);
  if (secret.informed === 'turn') world.secrets.turn = entry.doer;
  sim.runtime.changed = true;
  updateSecrets(sim);
}

/** La fiche secrète apparaît chez l'informé quand sa condition `revealOn` devient vraie. */
export function updateSecrets(sim: Sim): void {
  for (const entry of sim.world.secrets.entries) {
    if (entry.revealed) continue;
    const reveal = questDef(sim, entry.quest)?.secret?.revealOn ?? null;
    if (reveal !== null && !evaluate(sim, reveal, { actor: entry.informed, baselines: null, toolEvent: null, quest: entry.quest })) continue;
    entry.revealed = true;
    sim.runtime.changed = true;
    emit(sim, { type: 'secret_revealed', quest: entry.quest, to: entry.informed });
  }
}

/** Effet `reveal_secret`: le secret devient visible des deux (les poules gardent leur nom chez les deux). */
export function revealToBoth(sim: Sim, quest: string): void {
  const entry = secretEntry(sim, quest);
  if (entry === null || entry.shared) return;
  entry.shared = true;
  if (quest === HEN_NAMES_QUEST) {
    for (const hen of sim.world.hens) hen.nameKnownBy = ['p1', 'p2'];
  }
  sim.runtime.changed = true;
  emit(sim, { type: 'secret_revealed', quest, to: 'both' });
}

/** Une mauvaise réponse de l'autre: compter (jamais affiché), et souffler une fois à l'informé de parler. */
export function secretMistake(sim: Sim, quest: string | null): void {
  const entry = secretEntry(sim, quest);
  if (entry === null) return;
  entry.errors += 1;
  sim.runtime.changed = true;
  const s = sim.content.settings.secrets;
  const nudge = questDef(sim, entry.quest)?.secret?.nudge ?? null;
  if (entry.nudged || entry.errors < s.nudgeAfterErrors || nudge === null) return;
  entry.nudged = true;
  say(sim, entry.informed, nudge, { partner: character(sim, entry.doer).name });
}

/** Fin d'une quête à secret: réussie sans aucune erreur, un petit Cœur en plus pour chacun. */
export function finishSecret(sim: Sim, quest: string): void {
  const entry = secretEntry(sim, quest);
  if (entry?.errors !== 0) return;
  for (const c of sim.world.characters) c.heartToday.firstTry = true;
  say(sim, 'both', 'secret_first_try');
}

// ---------------------------------------------------------------------------
// Appeler une poule par son nom (« Les noms des poules »)

/** La quête des noms attend-elle qu'on appelle les poules (étape à condition `hens_named`) ? */
function callingStep(sim: Sim): boolean {
  const state = sim.world.quests.find((q) => q.id === HEN_NAMES_QUEST && q.status === 'active');
  const step = state === undefined ? undefined : questDef(sim, HEN_NAMES_QUEST)?.steps[state.step];
  return step?.conditions.some((c) => c.type === 'hens_named') === true;
}

/** La poule pas encore nommée la plus proche, à portée d'appel, pendant l'étape où l'on appelle. */
export function callableHen(sim: Sim, c: Character): Hen | null {
  if (!callingStep(sim)) return null;
  const range = sim.content.settings.secrets.henChoiceRange;
  let best: Hen | null = null;
  let bestD = Infinity;
  for (const hen of sim.world.hens) {
    const d = distance(c.pos, hen.pos);
    if (hen.namedBy !== null || d > range || d >= bestD) continue;
    best = hen;
    bestD = d;
  }
  return best;
}

function henVar(sim: Sim, hen: Hen): Record<string, string> {
  return { henName: hen.name, henUnknown: henUnknown(sim.content, hen.variant) };
}

/** Agir près d'une poule: l'autre reçoit le choix du nom; l'informé apprend que ce n'est pas à lui. */
export function callHen(sim: Sim, c: Character, hen: Hen): void {
  const entry = secretEntry(sim, HEN_NAMES_QUEST);
  c.facing = Math.atan2(hen.pos.y - c.pos.y, hen.pos.x - c.pos.x);
  if (entry?.informed === c.id) {
    say(sim, c.id, 'hen_names_informed_call', { ...henVar(sim, hen), partner: partnerName(sim, c.id) });
    return;
  }
  const names = sim.world.hens.map((h) => h.name);
  c.dialogue = {
    dialogue: HEN_CALL_DIALOGUE,
    villager: hen.id,
    lines: [{ speaker: 'narrator', text: message(sim, 'hen_call_question', henVar(sim, hen)) }],
    line: 0,
    choices: [
      ...names.map((name, i) => ({ id: `${NAME_CHOICE}${String(i)}`, text: name })),
      { id: LEAVE_CHOICE, text: message(sim, 'hen_call_leave') },
    ],
  };
  c.status = 'dialogue';
  c.menu = null;
  c.placement = null;
  c.action = { kind: 'talk', since: sim.world.tick, duration: 0, target: { x: hen.pos.x, y: hen.pos.y } };
  sim.runtime.changed = true;
}

function closeCall(sim: Sim, c: Character): void {
  c.dialogue = null;
  if (c.status === 'dialogue') c.status = 'active';
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
}

/** Le choix du nom: une bonne réponse nomme la poule chez les deux, une mauvaise ne coûte rien. */
export function answerHenCall(sim: Sim, c: Character, choice: string): void {
  const d = c.dialogue;
  if (d?.dialogue !== HEN_CALL_DIALOGUE || !d.choices.some((ch) => ch.id === choice)) return;
  const hen = sim.world.hens.find((h) => h.id === d.villager);
  closeCall(sim, c);
  if (hen === undefined || !choice.startsWith(NAME_CHOICE)) return;
  const name = sim.world.hens[Number(choice.slice(NAME_CHOICE.length))]?.name ?? '';
  const correct = name === hen.name;
  emit(sim, { type: 'hen_called', hen: hen.id, name, correct, by: c.id });
  if (!correct) {
    secretMistake(sim, HEN_NAMES_QUEST);
    say(sim, c.id, 'hen_named_wrong', henVar(sim, hen));
    return;
  }
  hen.namedBy = c.id;
  hen.nameKnownBy = ['p1', 'p2'];
  // Elle fait trois pas vers celui qui l'a appelée (la mangeoire et l'enclos la ramènent ensuite).
  const dx = c.pos.x - hen.pos.x;
  const dy = c.pos.y - hen.pos.y;
  const d2 = Math.hypot(dx, dy);
  if (d2 > 0.5) {
    hen.wander.x = hen.pos.x + (dx / d2) * Math.min(0.6, d2 - 0.4);
    hen.wander.y = hen.pos.y + (dy / d2) * Math.min(0.6, d2 - 0.4);
  }
  say(sim, c.id, 'hen_named_right', henVar(sim, hen));
}

/** Le choix reste ouvert tant que la poule est à moins de `henChoiceKeepOpen` m. */
export function updateHenCalls(sim: Sim): void {
  const keep = sim.content.settings.secrets.henChoiceKeepOpen;
  for (const c of sim.world.characters) {
    if (c.dialogue?.dialogue !== HEN_CALL_DIALOGUE) continue;
    const id = c.dialogue.villager;
    const hen = sim.world.hens.find((h) => h.id === id);
    if (hen === undefined || distance(c.pos, hen.pos) > keep) closeCall(sim, c);
  }
}
