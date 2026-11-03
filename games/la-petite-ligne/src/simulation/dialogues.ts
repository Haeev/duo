/**
 * Conversations (chacun la sienne, SI-06) et scènes à deux (HA-08), d'après
 * `habitants.json` et la section 2.3 du README des données.
 */
import { dialogueDone } from '../etat/dialogues-faits';
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
import { fnv1a } from '../etat/tirage';
import { answerHenCall, HEN_CALL_DIALOGUE, secretMistake } from './secrets';

const GIVE_PREFIX = 'give:';

const annonceScenes = new WeakMap<Content, Set<string>>();

/** Scènes à deux des annonces (tour 9): comptées (`scene:<id>`), lancées seulement l'habitant présent. */
function annonceSceneIds(content: Content): Set<string> {
  let ids = annonceScenes.get(content);
  if (ids === undefined) {
    ids = new Set<string>();
    for (const a of content.annonces) {
      if (a.scene !== null) ids.add(a.scene);
      if (a.uniqueScene !== null) ids.add(a.uniqueScene);
    }
    annonceScenes.set(content, ids);
  }
  return ids;
}

/** L'habitant d'une scène d'annonce est là, près du point de la scène (section 1.7: sinon elle attend). */
function sceneVillagerHere(sim: Sim, def: DialogueDef): boolean {
  if (!annonceSceneIds(sim.content).has(def.id) || def.point === null) return true;
  const v = sim.world.villagers.find((x) => x.id === def.villager);
  return v !== undefined && v.visible && distance(v.pos, point(sim, def.point)) <= sim.content.settings.ranges.talk + 2;
}

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
  if (def.once === 'duo') return dialogueDone(done, def.id);
  if (def.once === 'player') return done.includes(`${def.id}@${who}`);
  return false;
}

function isAvailable(sim: Sim, def: DialogueDef, who: CharacterId): boolean {
  // Les dialogues P1 (pêche) sont gardés par leurs propres conditions (drapeau `fishing_enabled`).
  if (doneFor(sim, def, who)) return false;
  const ctx: ConditionContext = { ...NO_CONTEXT, actor: who };
  return evaluateAll(sim, def.when, ctx);
}

// ---------------------------------------------------------------------------
// Mémoire des répliques entendues (tour 9): heures récentes, puis un ensemble de bits

/** Alphabet de l'ensemble de bits (6 bits par caractère). */
const BITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

interface HeardIndex {
  pos: Map<string, number>;
  key: string;
}

const heardIndexes = new WeakMap<Content, HeardIndex>();

/** Répliques qui se gardent dans `heard` (quotidien et rappels répétables), triées: leur rang est leur bit. */
function heardIndex(content: Content): HeardIndex {
  let index = heardIndexes.get(content);
  if (index === undefined) {
    const ids = Object.values(content.dialogues)
      .filter((d) => d.kind === 'daily' || d.once === null)
      .map((d) => d.id)
      .sort();
    index = { pos: new Map(ids.map((id, i) => [id, i])), key: fnv1a(ids.join(',')).toString(36) };
    heardIndexes.set(content, index);
  }
  return index;
}

function hasBit(bits: string, i: number): boolean {
  const c = BITS.indexOf(bits.charAt(Math.floor(i / 6)));
  return c > 0 && (c & (1 << (i % 6))) !== 0;
}

function withBit(bits: string, i: number): string {
  const at = Math.floor(i / 6);
  const padded = bits.length > at ? bits : bits + 'A'.repeat(at + 1 - bits.length);
  const c = Math.max(0, BITS.indexOf(padded.charAt(at))) | (1 << (i % 6));
  return padded.slice(0, at) + (BITS.charAt(c) || 'A') + padded.slice(at + 1);
}

/**
 * Quand ce joueur a entendu cette réplique: l'heure absolue (jour x 1440 + minutes) si c'est
 * récent, 0 si c'est vieux (toutes les vieilles à égalité, avant toute heure réelle), `undefined`
 * jamais.
 */
export function heardAt(sim: Sim, who: CharacterId, id: string): number | undefined {
  const at = sim.world.heard[who][id];
  if (at !== undefined) return at;
  const old = sim.world.heardOld;
  const index = heardIndex(sim.content);
  const i = index.pos.get(id);
  return old.key === index.key && i !== undefined && hasBit(old[who], i) ? 0 : undefined;
}

/** Ce que l'habitant dit à ce joueur maintenant (README des données, 2.3). */
export function pickDialogue(sim: Sim, villager: string, who: CharacterId): DialogueDef | null {
  const v = sim.content.villagers.find((x) => x.id === villager);
  if (v === undefined) return null;
  const heard = (id: string): number | undefined => heardAt(sim, who, id);
  const today = sim.world.clock.day;
  const heardToday = (d: DialogueDef): boolean => {
    const at = heard(d.id);
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
  // Répliques datées (jour du train, pluie): la plus prioritaire, une fois par jour. Après la démo
  // (tour 8, section 5.5), seulement si ce joueur ne l'a pas entendue depuis `datedRepeatDays`
  // jours; sinon elle rejoint la réserve ordinaire.
  const story = sim.content.settings.feel.dailyStoryPriority;
  const rule = sim.content.settings.dialogues;
  const recentlyHeard = (d: DialogueDef): boolean => {
    const at = heard(d.id);
    return today >= rule.datedRepeatFromDay && at !== undefined && today - Math.floor(at / MINUTES_PER_DAY) < rule.datedRepeatDays;
  };
  let dated: DialogueDef | null = null;
  for (const d of daily) {
    if (d.priority < story || heardToday(d) || recentlyHeard(d)) continue;
    if (dated === null || d.priority > dated.priority) dated = d;
  }
  if (dated !== null) return dated;
  // Sinon la moins récemment entendue par ce joueur (jamais entendue d'abord), au hasard à égalité.
  const ordinary = daily.filter((d) => d.priority < story || recentlyHeard(d));
  const pool = ordinary.length > 0 ? ordinary : daily;
  let oldest = Infinity;
  for (const d of pool) oldest = Math.min(oldest, heard(d.id) ?? -1);
  return sim.rng.pick(pool.filter((d) => (heard(d.id) ?? -1) === oldest));
}

/** Répliques du quotidien que cet habitant peut dire à ce joueur maintenant (conditions remplies). */
export function eligibleDailies(sim: Sim, villager: string, who: CharacterId): DialogueDef[] {
  const v = sim.content.villagers.find((x) => x.id === villager);
  return v === undefined ? [] : v.dialogues.filter((d) => d.kind === 'daily' && isAvailable(sim, d, who));
}

/**
 * Compacte la mémoire des répliques entendues (QA8-02, I-06), chaque matin après la démo. Une
 * entrée plus vieille que `datedRepeatDays` ne sert plus qu'au tirage « la moins récente » (son
 * rang parmi les autres) et à dire qu'elle a été entendue: l'heure absolue (jour x 1440 + minutes)
 * est remplacée par son rang parmi les vieilles entrées (0, 1, 2...), plus petit que toute heure
 * réelle et toujours au-dessus de -1 (jamais entendue). Même ordre, mêmes égalités, et aucune
 * vieille entrée ne passe pour « entendue aujourd'hui » ni « depuis moins de 28 jours ».
 */
export function foldOldHeard(sim: Sim): void {
  const rule = sim.content.settings.dialogues;
  const today = sim.world.clock.day;
  if (today < rule.datedRepeatFromDay) return;
  const index = heardIndex(sim.content);
  const old = sim.world.heardOld;
  // Le contenu a changé (une version nouvelle): l'ordre des bits ne vaut plus, l'ensemble repart.
  if (old.key !== index.key) {
    old.key = index.key;
    old.p1 = '';
    old.p2 = '';
  }
  // Entendue avant ce jour: plus « récente » au sens de la règle des répliques datées.
  const oldBefore = Math.min(today - rule.datedRepeatDays + 1, today) * MINUTES_PER_DAY;
  for (const who of ['p1', 'p2'] as const) {
    const heard = sim.world.heard[who];
    for (const [id, at] of Object.entries(heard)) {
      if (at >= oldBefore) continue;
      const i = index.pos.get(id);
      if (i !== undefined) old[who] = withBit(old[who], i);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mémoire bornée: la vieille entrée passe dans l'ensemble.
      delete heard[id];
    }
  }
}

/** Ce joueur vient d'entendre ce dialogue (mémoire du tirage « la moins récente »). */
export function hearDialogue(sim: Sim, who: CharacterId, def: DialogueDef): void {
  if (def.kind !== 'daily' && def.once !== null) return;
  sim.world.heard[who][def.id] = sim.world.clock.day * MINUTES_PER_DAY + Math.floor(sim.world.clock.minutes);
}

/** Texte de `textes.ui.<key>`, ou `null`. */
function uiText(sim: Sim, key: string): string | null {
  const raw = sim.content.texts.raw.ui;
  const value = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : null;
}

/** Les conditions d'une liste, celles des `all` et `any` comprises. */
function flatConditions(list: readonly Condition[]): Condition[] {
  return list.flatMap((c) => (c.type === 'all' || c.type === 'any' ? [c, ...flatConditions(c.conditions)] : [c]));
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
    // Dons au choix (`any`, 0.12: trois coupons de toile ou six plumes): chaque objet a sa ligne « Donner ».
    for (const cond of flatConditions(step.conditions)) {
      if (cond.type !== 'counter') continue;
      const parts = cond.key.split(':');
      if (parts[0] !== 'given' || parts[1] !== villager || parts[2] === undefined) continue;
      const item = parts[2];
      const offer = sim.content.items[item]?.category === 'gift' ? uiText(sim, 'offer') : null;
      const given = (sim.world.counters.duo[cond.key] ?? 0) - (state.baselines[`duo:${cond.key}`] ?? 0);
      const remaining = cond.count - given;
      const have = countInBag(c, item);
      const n = Math.min(remaining, have);
      if (n <= 0 || out.some((o) => o.id.startsWith(`${GIVE_PREFIX}${item}:`))) continue;
      const article = sim.content.items[item]?.indefinite ?? itemName(sim, item, n);
      out.push({ id: `${GIVE_PREFIX}${item}:${n}`, text: offer === null ? format(template, { count: n, item: itemName(sim, item, n) }) : format(offer, { item: article }) });
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
  // Une réplique du quotidien répétable ne se garde que dans `heard` (tirage « la moins récente »):
  // l'écrire aussi ici ferait grossir la sauvegarde de trois entrées par réplique (tour 8, I-06).
  if (def.kind !== 'daily' || def.once !== null) {
    // `<id>@<joueur>` suffit: « fini par l'un des deux » se lit aussi dessus (`dialogueDone`, format 8).
    const done = sim.world.dialoguesDone;
    if (!done.includes(`${def.id}@${c.id}`)) done.push(`${def.id}@${c.id}`);
  }
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
  if (annonceSceneIds(sim.content).has(scene.dialogue)) bump(sim, `scene:${scene.dialogue}`, null);
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
  const agreed = a === b ? def.agreement?.same : def.agreement?.different;
  for (const line of agreed ?? []) scene.lines.push({ speaker: line.speaker, text: line.text });
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
    if (def.once === 'duo' && dialogueDone(world.dialoguesDone, def.id)) continue;
    const at = point(sim, def.point);
    if (!world.characters.every((c) => distance(c.pos, at) <= range)) continue;
    if (!evaluateAll(sim, def.when, NO_CONTEXT) || !sceneVillagerHere(sim, def)) continue;
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
