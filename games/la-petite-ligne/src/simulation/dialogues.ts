/**
 * Conversations (chacun la sienne, SI-06) et scènes à deux (HA-08), d'après
 * `habitants.json` et la section 2.3 du README des données.
 */
import type { Character, CharacterId, DialogueChoiceView, DialogueLineView } from '../etat/types';
import type { Condition, Content, DialogueDef } from '../donnees/types';
import { evaluateAll, NO_CONTEXT, type ConditionContext } from './conditions';
import { type Sim, bump, character, distance, emit, format, itemName, partnerName, partnerOf, point, notifyKey } from './contexte';
import { textVars } from './courrier';
import { pumpScripts, runEffects } from './effets';
import { countInBag, takeFromBag } from './sac';
import { MINUTES_PER_DAY } from './constantes';
import { evaluate } from './conditions';
import { henVars } from '../etat/secrets';
import { answerHenCall, HEN_CALL_DIALOGUE, secretMistake } from './secrets';

const GIVE_PREFIX = 'give:';

function vars(sim: Sim, who: CharacterId | null): Record<string, string | number> {
  // Les couleurs des poules (`{henColor1}`...): seul l'informé entend le dialogue qui les cite.
  const base = { ...textVars(sim), ...henVars(sim.world, sim.content) };
  return who === null ? base : { ...base, partner: partnerName(sim, who) };
}

/** Quête à secret d'un dialogue réservé à un rôle (sa condition `secret_role`), ou `null`. */
function secretQuestOf(def: DialogueDef): string | null {
  for (const c of def.when) if (c.type === 'secret_role') return c.quest;
  return null;
}

const choiceKeyCache = new WeakMap<Content, Set<string>>();

/** Clés des compteurs de choix que lisent les conditions `choice_made` des données. */
function choiceKeys(content: Content): Set<string> {
  let keys = choiceKeyCache.get(content);
  if (keys !== undefined) return keys;
  const found = new Set<string>();
  const visit = (c: Condition): void => {
    if (c.type === 'choice_made') found.add(c.key);
    if (c.type === 'all' || c.type === 'any') c.conditions.forEach(visit);
    if (c.type === 'not') visit(c.condition);
  };
  for (const q of content.quests) for (const s of q.steps) s.conditions.forEach(visit);
  for (const d of Object.values(content.dialogues)) d.when.forEach(visit);
  for (const e of content.envies) [...e.availableWhen, ...e.fulfilledWhen].forEach(visit);
  keys = found;
  choiceKeyCache.set(content, keys);
  return keys;
}

/** Un dialogue à bonne et mauvaise réponse se rejoue tout de suite après une erreur (jamais punitif). */
function retryable(def: DialogueDef): boolean {
  return def.choices.some((ch) => ch.correct !== null);
}

function lineViews(sim: Sim, def: DialogueDef, who: CharacterId | null): DialogueLineView[] {
  const v = vars(sim, who);
  return def.lines.map((l) => ({ speaker: l.speaker, text: format(l.text, v) }));
}

function doneFor(sim: Sim, def: DialogueDef, who: CharacterId): boolean {
  const done = sim.world.dialoguesDone;
  if (def.once === 'duo') return done.includes(def.id);
  if (def.once === 'player') return done.includes(`${def.id}@${who}`);
  return false;
}

function isAvailable(sim: Sim, def: DialogueDef, who: CharacterId): boolean {
  // Les dialogues P1 (pêche) sont gardés par leurs propres conditions (drapeau `fishing_enabled`).
  if (doneFor(sim, def, who)) return false;
  const ctx: ConditionContext = { ...NO_CONTEXT, actor: who };
  return evaluateAll(sim, def.when, ctx);
}

/** Ce que l'habitant dit à ce joueur maintenant (README des données, 2.3). */
export function pickDialogue(sim: Sim, villager: string, who: CharacterId): DialogueDef | null {
  const v = sim.content.villagers.find((x) => x.id === villager);
  if (v === undefined) return null;
  const heard = sim.world.heard[who];
  const today = sim.world.clock.day;
  const heardToday = (d: DialogueDef): boolean => {
    const at = heard[d.id];
    return at !== undefined && Math.floor(at / MINUTES_PER_DAY) === today;
  };
  let best: DialogueDef | null = null;
  for (const d of v.dialogues) {
    if (d.kind === 'daily' || d.kind === 'ending' || (d.kind === 'scene' && d.shared)) continue;
    if (!isAvailable(sim, d, who)) continue;
    // Un rappel répétable déjà entendu aujourd'hui laisse la place au quotidien.
    if (d.once === null && heardToday(d) && !retryable(d)) continue;
    if (best === null || d.priority > best.priority) best = d;
  }
  if (best !== null) return best;
  const daily = eligibleDailies(sim, villager, who);
  if (daily.length === 0) return null;
  // Répliques datées (jour du train, pluie): la plus prioritaire, une fois par jour.
  const story = sim.content.settings.feel.dailyStoryPriority;
  let dated: DialogueDef | null = null;
  for (const d of daily) {
    if (d.priority >= story && !heardToday(d) && (dated === null || d.priority > dated.priority)) dated = d;
  }
  if (dated !== null) return dated;
  // Sinon la moins récemment entendue par ce joueur (jamais entendue d'abord), au hasard à égalité.
  const ordinary = daily.filter((d) => d.priority < story);
  const pool = ordinary.length > 0 ? ordinary : daily;
  let oldest = Infinity;
  for (const d of pool) oldest = Math.min(oldest, heard[d.id] ?? -1);
  return sim.rng.pick(pool.filter((d) => (heard[d.id] ?? -1) === oldest));
}

/** Répliques du quotidien que cet habitant peut dire à ce joueur maintenant (conditions remplies). */
export function eligibleDailies(sim: Sim, villager: string, who: CharacterId): DialogueDef[] {
  const v = sim.content.villagers.find((x) => x.id === villager);
  return v === undefined ? [] : v.dialogues.filter((d) => d.kind === 'daily' && isAvailable(sim, d, who));
}

/** Ce joueur vient d'entendre ce dialogue (mémoire du tirage « la moins récente »). */
export function hearDialogue(sim: Sim, who: CharacterId, def: DialogueDef): void {
  if (def.kind !== 'daily' && def.once !== null) return;
  sim.world.heard[who][def.id] = sim.world.clock.day * MINUTES_PER_DAY + Math.floor(sim.world.clock.minutes);
}

/** Choix « Donner » quand une étape active attend un objet pour cet habitant. */
function giveChoices(sim: Sim, c: Character, villager: string): DialogueChoiceView[] {
  const out: DialogueChoiceView[] = [];
  const raw = sim.content.texts.raw.ui;
  const template =
    typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).give === 'string'
      ? ((raw as Record<string, unknown>).give as string)
      : '{count} {item}';
  for (const state of sim.world.quests) {
    if (state.status !== 'active') continue;
    const step = sim.content.quests.find((q) => q.id === state.id)?.steps[state.step];
    if (step === undefined) continue;
    for (const cond of step.conditions) {
      if (cond.type !== 'counter') continue;
      const parts = cond.key.split(':');
      if (parts[0] !== 'given' || parts[1] !== villager || parts[2] === undefined) continue;
      const item = parts[2];
      const given = (sim.world.counters.duo[cond.key] ?? 0) - (state.baselines[`duo:${cond.key}`] ?? 0);
      const remaining = cond.count - given;
      const have = countInBag(c, item);
      const n = Math.min(remaining, have);
      if (n <= 0 || out.some((o) => o.id.startsWith(`${GIVE_PREFIX}${item}:`))) continue;
      out.push({ id: `${GIVE_PREFIX}${item}:${n}`, text: format(template, { count: n, item: itemName(sim, item, n) }) });
    }
  }
  return out;
}

/** Ouvre la conversation d'un joueur avec un habitant (portée vérifiée par l'appelant). */
export function talkTo(sim: Sim, c: Character, villager: string): boolean {
  const v = sim.world.villagers.find((x) => x.id === villager);
  if (!v?.visible) return false;
  const def = pickDialogue(sim, villager, c.id);
  if (def === null) return false;
  const choices: DialogueChoiceView[] = [
    ...def.choices.map((ch) => ({ id: ch.id, text: format(ch.text, vars(sim, c.id)) })),
    ...giveChoices(sim, c, villager),
  ];
  c.dialogue = { dialogue: def.id, villager, lines: lineViews(sim, def, c.id), line: 0, choices };
  c.status = 'dialogue';
  c.menu = null;
  c.placement = null;
  c.action = { kind: 'talk', since: sim.world.tick, duration: 0, target: { x: v.pos.x, y: v.pos.y } };
  c.facing = Math.atan2(v.pos.y - c.pos.y, v.pos.x - c.pos.x);
  v.facing = Math.atan2(c.pos.y - v.pos.y, c.pos.x - v.pos.x);
  if (!v.talkingWith.includes(c.id)) v.talkingWith.push(c.id);
  v.met = true;
  bump(sim, `talked:${villager}`, c.id);
  emit(sim, { type: 'talk', by: c.id, villager });
  return true;
}

function endConversation(sim: Sim, c: Character, completed: boolean): void {
  const d = c.dialogue;
  if (d === null) return;
  c.dialogue = null;
  c.status = 'active';
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  const v = sim.world.villagers.find((x) => x.id === d.villager);
  if (v !== undefined) v.talkingWith = v.talkingWith.filter((id) => id !== c.id);
  if (!completed) return;
  const def = sim.content.dialogues[d.dialogue];
  if (def === undefined) return;
  const done = sim.world.dialoguesDone;
  if (!done.includes(def.id)) done.push(def.id);
  if (!done.includes(`${def.id}@${c.id}`)) done.push(`${def.id}@${c.id}`);
  hearDialogue(sim, c.id, def);
  runEffects(sim, def.effects, c.id);
}

function give(sim: Sim, c: Character, villager: string, item: string, count: number): void {
  const taken = takeFromBag(c, item, count).reduce((sum, s) => sum + s.count, 0);
  if (taken === 0) return;
  bump(sim, `given:${villager}`, c.id, taken);
  bump(sim, `given:${villager}:${item}`, c.id, taken);
  emit(sim, { type: 'gave', by: c.id, to: villager, item, count: taken });
}

/** Donner hors dialogue (intention `give` vers un habitant à portée). */
export function giveToVillager(sim: Sim, c: Character, villager: string, item: string, count: number): void {
  give(sim, c, villager, item, count);
}

// ---------------------------------------------------------------------------
// Scènes à deux

export function startScene(sim: Sim, dialogueId: string): void {
  const def = sim.content.dialogues[dialogueId];
  if (def === undefined) return;
  sim.world.scene = {
    dialogue: def.id,
    villager: def.villager,
    lines: lineViews(sim, def, null),
    line: 0,
    choices: [],
    picks: {},
    ready: [],
  };
  for (const c of sim.world.characters) {
    if (c.dialogue !== null) endConversation(sim, c, false);
    c.status = 'scene';
    c.menu = null;
    c.placement = null;
    c.destination = null;
    sim.runtime.charPaths[c.id] = [];
    sim.runtime.pendingAct[c.id] = null;
    c.action = { kind: 'talk', since: sim.world.tick, duration: 0, target: null };
  }
  const v = sim.world.villagers.find((x) => x.id === def.villager);
  if (v !== undefined) {
    v.talkingWith = ['p1', 'p2'];
    v.met = true;
  }
  // Une scène avec un habitant compte comme une conversation, pour chacun des deux.
  for (const c of sim.world.characters) bump(sim, `talked:${def.villager}`, c.id);
  emit(sim, { type: 'scene_started', dialogue: def.id, villager: def.villager });
  if (def.lines.length === 0) showSceneChoicesOrEnd(sim);
}

function showSceneChoicesOrEnd(sim: Sim): void {
  const scene = sim.world.scene;
  if (scene === null) return;
  const def = sim.content.dialogues[scene.dialogue];
  if (def !== undefined && def.choices.length > 0 && Object.keys(scene.picks).length === 0) {
    scene.choices = def.choices.map((ch) => ({ id: ch.id, text: ch.text }));
    scene.line = scene.lines.length;
    return;
  }
  endScene(sim);
}

function endScene(sim: Sim): void {
  const scene = sim.world.scene;
  if (scene === null) return;
  sim.world.scene = null;
  const def = sim.content.dialogues[scene.dialogue];
  for (const c of sim.world.characters) {
    if (c.status === 'scene') c.status = 'active';
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  const v = sim.world.villagers.find((x) => x.id === scene.villager);
  if (v !== undefined) v.talkingWith = [];
  if (!sim.world.dialoguesDone.includes(scene.dialogue)) sim.world.dialoguesDone.push(scene.dialogue);
  emit(sim, { type: 'scene_ended', dialogue: scene.dialogue });
  if (def !== undefined) runEffects(sim, def.effects, null);
  pumpScripts(sim);
}

function sceneNext(sim: Sim, c: Character): void {
  const scene = sim.world.scene;
  if (scene === null || scene.choices.length > 0) return;
  if (!scene.ready.includes(c.id)) {
    scene.ready.push(c.id);
    if (scene.ready.length === 1) notifyKey(sim, partnerOf(c.id), 'message', 'partner_waits_scene', { partner: c.name });
  }
  if (scene.ready.length < 2) return;
  scene.ready = [];
  scene.line += 1;
  if (scene.line >= scene.lines.length) showSceneChoicesOrEnd(sim);
}

function sceneChoice(sim: Sim, c: Character, choice: string): void {
  const scene = sim.world.scene;
  const def = scene === null ? undefined : sim.content.dialogues[scene.dialogue];
  if (scene === null || def === undefined || scene.choices.length === 0) return;
  if (!def.choices.some((ch) => ch.id === choice)) return;
  scene.picks[c.id] = choice;
  const a = scene.picks.p1;
  const b = scene.picks.p2;
  if (a === undefined || b === undefined) return;
  const start = scene.lines.length;
  const say = (who: CharacterId, id: string): void => {
    const ch = def.choices.find((x) => x.id === id);
    if (ch === undefined) return;
    scene.lines.push({ speaker: who, text: ch.text });
    for (const r of ch.reply) scene.lines.push({ speaker: r.speaker, text: r.text });
  };
  say('p1', a);
  if (b !== a) say('p2', b);
  scene.choices = [];
  scene.line = start;
  scene.ready = [];
}

/** Lance d'elle-même une scène à deux quand ses conditions sont vraies et que les deux sont au rendez-vous. */
export function autoStartScenes(sim: Sim): void {
  const { world } = sim;
  if (world.scene !== null || world.phase !== 'day' || world.scripts.length > 0) return;
  const free = world.characters.every(
    (c) => c.created && (c.status === 'active' || c.status === 'menu' || c.status === 'dialogue'),
  );
  if (!free) return;
  const range = sim.content.settings.ranges.talk;
  for (const def of Object.values(sim.content.dialogues)) {
    if (!def.shared || def.kind !== 'scene' || def.point === null) continue;
    if (def.once === 'duo' && world.dialoguesDone.includes(def.id)) continue;
    const at = point(sim, def.point);
    if (!world.characters.every((c) => distance(c.pos, at) <= range)) continue;
    if (!evaluateAll(sim, def.when, NO_CONTEXT)) continue;
    startScene(sim, def.id);
    return;
  }
}

// ---------------------------------------------------------------------------
// Intentions

export function dialogueNext(sim: Sim, c: Character): void {
  if (c.status === 'scene') {
    sceneNext(sim, c);
    return;
  }
  const d = c.dialogue;
  if (d === null) return;
  if (d.line < d.lines.length - 1) {
    d.line += 1;
    sim.runtime.changed = true;
    return;
  }
  if (d.choices.length === 0) endConversation(sim, c, true);
}

export function dialogueChoice(sim: Sim, c: Character, choice: string): void {
  if (c.status === 'scene') {
    sceneChoice(sim, c, choice);
    return;
  }
  if (c.dialogue?.dialogue === HEN_CALL_DIALOGUE) {
    answerHenCall(sim, c, choice);
    return;
  }
  const d = c.dialogue;
  if (!d?.choices.some((ch) => ch.id === choice)) return;
  if (choice.startsWith(GIVE_PREFIX)) {
    const [, item, count] = choice.split(':');
    if (item !== undefined && count !== undefined) give(sim, c, d.villager, item, Number(count));
    d.choices = d.choices.filter((ch) => ch.id !== choice);
    if (d.choices.length === 0 && d.line >= d.lines.length - 1) endConversation(sim, c, true);
    return;
  }
  const def = sim.content.dialogues[d.dialogue];
  const picked = def?.choices.find((ch) => ch.id === choice);
  if (def === undefined || picked === undefined) return;
  const quest = secretQuestOf(def);
  const correct = picked.correct === null ? null : evaluate(sim, picked.correct, { actor: c.id, baselines: null, toolEvent: null, quest });
  const start = d.lines.length;
  d.lines.push({ speaker: c.id, text: format(picked.text, vars(sim, c.id)) });
  const reply = correct === false ? picked.replyWrong : picked.reply;
  for (const r of reply) d.lines.push({ speaker: r.speaker, text: format(r.text, vars(sim, c.id)) });
  d.choices = d.choices.filter((ch) => ch.id.startsWith(GIVE_PREFIX));
  d.line = start;
  // Compteurs des conditions `choice_made` (n'importe quel choix, ce choix, un choix juste), seulement
  // ceux que les données lisent: l'état transmis à l'invité reste petit (ADR 0007).
  const used = choiceKeys(sim.content);
  for (const key of [`choice:${def.id}`, `choice:${def.id}:${picked.id}`, ...(correct === true ? [`choice:${def.id}:correct`] : [])]) {
    if (used.has(key)) bump(sim, key, c.id);
  }
  emit(sim, { type: 'dialogue_choice', dialogue: def.id, choice: picked.id, correct, by: c.id });
  if (correct === false) secretMistake(sim, quest);
  runEffects(sim, correct === false ? picked.effectsWrong : picked.effects, c.id);
}

export function dialogueClose(sim: Sim, c: Character): void {
  const d = c.dialogue;
  if (d === null) return;
  const def = sim.content.dialogues[d.dialogue];
  const ownChoicesLeft = d.choices.some((ch) => !ch.id.startsWith(GIVE_PREFIX)) && (def?.choices.length ?? 0) > 0;
  endConversation(sim, c, d.line >= d.lines.length - 1 && !ownChoicesLeft);
}

/** Ferme la conversation d'un joueur (scène, fondu, minuit). */
export function abortConversation(sim: Sim, id: CharacterId): void {
  endConversation(sim, character(sim, id), false);
}
