/**
 * 0.13 (lot H5, conception `v0-13-habitants.md` section 5.4): les suites de quêtes de Lucie,
 * Armand, Berthe, l'abbé, Marthe, Honorine et Inès, jouées de bout en bout par un script (pas par
 * le robot): chaque étape est remplie par le vrai mécanisme (conversation, scène à deux lancée
 * d'elle-même, temps passé à un point, don, charge portée, panneau de décision à deux), au jour et à
 * l'heure que ses conditions demandent; les récompenses sont contrôlées à la fin de chaque quête.
 *
 * Raccourcis assumés: les niveaux d'amitié qui ouvrent les étapes 2 à 4 sont posés directement (les
 * gagner prend des semaines), les nuits sont comptées sans dormir, les récoltes sans cultiver, la
 * charge portée est posée sans marcher (le portage a ses tests), le rythme des histoires est mis de
 * côté (il a ses tests), et les quêtes des autres lots (Mado, Paulin, Ambroise, Barnabé, Firmin)
 * sont tenues pour faites.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, QuestDef } from '../src/donnees/types';
import { dialogueDone } from '../src/etat/dialogues-faits';
import type { Character } from '../src/etat/types';
import { evaluate, NO_CONTEXT } from '../src/simulation/conditions';
import { voteDecision } from '../src/simulation/decisions';
import { SIM_HZ } from '../src/simulation/constantes';
import { type Sim, bump, character } from '../src/simulation/contexte';
import { dialogueChoice, dialogueNext, giveToVillager, talkTo } from '../src/simulation/dialogues';
import { placeVillagers } from '../src/simulation/habitants';
import { step } from '../src/simulation/pas';
import { loadPlaced } from '../src/simulation/portages';
import { updateQuests } from '../src/simulation/quetes';
import { addToBag, countInBag, duoOwns } from '../src/simulation/sac';
import { newSim, SEED } from './aides';

/** Dans l'ordre de jeu: chaque quête ne dépend que des précédentes (ou de l'autre lot). */
const ORDER = [
  'lucie_return',
  'honorine_yarn',
  'armand_registers',
  'berthe_sluice',
  'martial_seeds',
  'marthe_angelus',
  'ines_trail',
  'lucie_camera',
  'armand_chronicle',
  'berthe_millstone',
  'martial_chain',
  'marthe_dahlias',
  'ines_keep_trees',
  'honorine_photo',
  'lucie_darkroom',
  'armand_choir',
  'berthe_share',
  'martial_red_wheat',
  'marthe_wedding_dress',
  'ines_owls',
  'honorine_side_by_side',
  'lucie_exhibition',
  'armand_line_plan',
  'berthe_hamlet_sacks',
  'martial_small_bell',
  'ines_question_marks',
  'honorine_handcar',
  'marthe_lumignons',
] as const;

/** Quêtes de l'autre lot de la 0.13 que ces suites attendent. */
const OTHER_LOT = [
  'ambroise_springs',
  'mado_bellows',
  'paulin_sacks',
  'paulin_mill_again',
  'paulin_field',
  'barnabe_first_kiln',
];

const TIME_TYPES = new Set([
  'time_is',
  'weekday_is',
  'weather_is',
  'special_day',
  'season_is',
  'season_day_is',
  'school_day',
  'day_at_least',
]);

function questDef(sim: Sim, id: string): QuestDef {
  const q = sim.content.quests.find((x) => x.id === id);
  if (q === undefined) throw new Error(`quête absente ${id}`);
  return q;
}

/** Conditions de moment (jour, heure, temps) d'une liste, à plat. */
function timeConds(conds: readonly Condition[]): Condition[] {
  const out: Condition[] = [];
  for (const c of conds) {
    if (TIME_TYPES.has(c.type)) out.push(c);
    else if (c.type === 'not' && TIME_TYPES.has(c.condition.type)) out.push(c);
    else if (
      c.type === 'any' &&
      c.conditions.every((x) => TIME_TYPES.has(x.type) || x.type === 'all')
    )
      out.push(c);
  }
  return out;
}

/**
 * Avance l'horloge (jamais en arrière) jusqu'au premier moment où `ok` est vrai, par pas de 10
 * minutes, sous le soleil puis sous la pluie, et replace les habitants.
 */
function seek(sim: Sim, ok: () => boolean, what: string): void {
  const from = 6 * 60;
  const w = sim.world;
  const day0 = w.clock.day;
  const min0 = w.clock.minutes;
  for (let day = day0; day <= sim.content.settings.clock.lastDay.day; day++) {
    for (let m = day === day0 ? Math.max(from, min0) : 6 * 60; m < 24 * 60; m += 10) {
      for (const weather of ['sunny', 'rain'] as const) {
        w.clock.day = day;
        w.clock.minutes = m;
        w.weather = weather;
        placeVillagers(sim);
        if (ok()) return;
      }
    }
  }
  throw new Error(`aucun moment ne convient: ${what}`);
}

function holds(sim: Sim, conds: readonly Condition[]): boolean {
  return conds.every((c) => evaluate(sim, c, NO_CONTEXT));
}

function both(sim: Sim): Character[] {
  return [character(sim, 'p1'), character(sim, 'p2')];
}

function run(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) step(sim, { controls: {}, intents: [] });
}

function stepId(sim: Sim, quest: string): string | null {
  const q = sim.world.quests.find((x) => x.id === quest);
  if (q?.status !== 'active') return null;
  return questDef(sim, quest).steps[q.step]?.id ?? null;
}

/** Une conversation jusqu'au bout; `choice` pour un dialogue à choix. */
function talk(sim: Sim, dialogue: string, choice: string | null): void {
  const def = sim.content.dialogues[dialogue];
  if (def === undefined) throw new Error(`dialogue absent ${dialogue}`);
  seek(
    sim,
    () => {
      const v = sim.world.villagers.find((x) => x.id === def.villager);
      return v?.visible === true && holds(sim, def.when);
    },
    dialogue,
  );
  const v = sim.world.villagers.find((x) => x.id === def.villager);
  const c = character(sim, 'p1');
  if (v === undefined) throw new Error('habitant absent');
  c.pos = { x: v.pos.x + 1, y: v.pos.y };
  expect(talkTo(sim, c, def.villager), `parler à ${def.villager}`).toBe(true);
  expect(c.dialogue?.dialogue).toBe(dialogue);
  for (let i = 0; i < 20 && c.dialogue !== null; i++) {
    if (choice !== null && c.dialogue.choices.some((ch) => ch.id === choice))
      dialogueChoice(sim, c, choice);
    else dialogueNext(sim, c);
  }
  expect(c.dialogue).toBeNull();
}

function sceneOf(sim: Sim): Sim['world']['scene'] {
  return sim.world.scene;
}

/** Une scène à deux: les deux au point, au bon moment; elle se lance d'elle-même. */
function scene(sim: Sim, dialogue: string): void {
  const def = sim.content.dialogues[dialogue];
  if (def?.point === null || def === undefined) throw new Error(`scène absente ${dialogue}`);
  const at = sim.map.points[def.point];
  if (at === undefined) throw new Error(`point absent ${def.point}`);
  seek(sim, () => holds(sim, def.when), dialogue);
  for (const c of both(sim)) c.pos = { x: at.x, y: at.y };
  run(sim, 0.2);
  expect(sim.world.scene?.dialogue, `scène ${dialogue}`).toBe(dialogue);
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    for (const c of both(sim)) {
      // Relue après chaque geste: le choix de l'autre joueur peut la clore.
      const current = sceneOf(sim);
      if (current === null) break;
      const first = current.choices[0];
      if (first !== undefined) dialogueChoice(sim, c, first.id);
      else dialogueNext(sim, c);
    }
  }
  expect(sim.world.scene).toBeNull();
  expect(dialogueDone(sim.world.dialoguesDone, dialogue)).toBe(true);
}

/** Remplit une condition d'étape par son mécanisme. */
function satisfy(sim: Sim, quest: string, cond: Condition, all: readonly Condition[]): void {
  const w = sim.world;
  if (cond.type === 'dialogue_done') {
    const def = sim.content.dialogues[cond.dialogue];
    if (def?.shared === true) scene(sim, cond.dialogue);
    else talk(sim, cond.dialogue, null);
    return;
  }
  if (cond.type === 'any') {
    // La première branche possible maintenant (décision prise, ou conversation proposée).
    const options = cond.conditions.filter((c) => {
      if (c.type !== 'dialogue_done') return true;
      const def = sim.content.dialogues[c.dialogue];
      return (
        def?.when.every((x) => x.type !== 'decision_made' || evaluate(sim, x, NO_CONTEXT)) === true
      );
    });
    const first = options[0];
    if (first === undefined) throw new Error('aucune branche');
    satisfy(sim, quest, first, all);
    return;
  }
  if (cond.type === 'choice_made') {
    const [, dialogue, choice] = cond.key.split(':');
    talk(sim, dialogue ?? '', choice ?? null);
    return;
  }
  if (cond.type === 'counter') {
    if (cond.key === 'nights') bump(sim, 'nights', null, cond.count);
    else if (cond.key.startsWith('harvested:')) bump(sim, cond.key, 'p1', cond.count);
    else if (cond.key.startsWith('choice:')) {
      const [, dialogue, choice] = cond.key.split(':');
      talk(sim, dialogue ?? '', choice ?? null);
    } else if (cond.key.startsWith('given:')) {
      const [, villager, item] = cond.key.split(':');
      if (villager === undefined || item === undefined) throw new Error(cond.key);
      const c = character(sim, 'p1');
      const missing = cond.count - countInBag(c, item);
      const def = sim.content.items[item];
      // Les objets de quête viennent des étapes d'avant; le reste s'achète ou se récolte.
      if (missing > 0 && def?.category === 'quest') {
        const other = character(sim, 'p2');
        expect(
          countInBag(other, item),
          `${item} reçu par une étape d'avant`,
        ).toBeGreaterThanOrEqual(missing);
        giveToVillager(sim, other, villager, item, missing);
        giveToVillager(sim, c, villager, item, cond.count - missing);
        return;
      }
      if (missing > 0) addToBag(sim, c, item, 'ordinary', missing);
      giveToVillager(sim, c, villager, item, cond.count);
    } else throw new Error(`compteur non scripté ${cond.key}`);
    return;
  }
  if (cond.type === 'stayed_at') {
    const stays = all.filter(
      (c): c is Extract<Condition, { type: 'stayed_at' }> => c.type === 'stayed_at',
    );
    const rest = timeConds(all);
    seek(sim, () => holds(sim, rest), `${quest}: rendez-vous`);
    const [p1, p2] = both(sim);
    if (p1 === undefined || p2 === undefined) throw new Error('joueurs');
    const a = sim.map.points[stays[0]?.point ?? ''];
    const b = sim.map.points[stays[1]?.point ?? stays[0]?.point ?? ''];
    if (a === undefined || b === undefined) throw new Error('point de rendez-vous absent');
    p1.pos = { x: a.x, y: a.y };
    p2.pos = { x: b.x, y: b.y };
    run(sim, Math.max(...stays.map((s) => s.seconds)) + 0.5);
    return;
  }
  if (cond.type === 'flag') {
    const carry = sim.content.settings.carry.quests.find((c) => c.flag === cond.flag);
    if (carry === undefined) throw new Error(`drapeau non scripté ${cond.flag}`);
    seek(sim, () => holds(sim, timeConds(carry.when)), carry.item);
    run(sim, 0.2);
    const beam = w.beam;
    expect(beam?.item, `charge ${carry.item}`).toBe(carry.item);
    if (beam === null) return;
    loadPlaced(sim, beam);
    w.beam = null;
    return;
  }
  if (cond.type === 'item_owned') {
    const def = sim.content.items[cond.item];
    expect(def?.shop, `${cond.item} en vente`).toBe('grocery');
    addToBag(sim, character(sim, 'p1'), cond.item, 'ordinary', cond.count);
    return;
  }
  if (cond.type === 'decision_made') {
    // Le vrai panneau: il s'ouvre de lui-même pour l'étape, les deux votent, l'accord tient 2 s.
    const def = sim.content.decisions.list.find((d) => d.id === cond.decision);
    const option = cond.option ?? def?.options[0]?.id;
    if (option === undefined) throw new Error(`décision inconnue ${cond.decision}`);
    run(sim, 0.2);
    expect(w.decisionsOpen[cond.decision], `panneau ${cond.decision}`).toBeDefined();
    voteDecision(sim, 'p1', cond.decision, option);
    voteDecision(sim, 'p2', cond.decision, option);
    run(sim, sim.content.decisions.agreeSeconds + 0.5);
    expect(w.decisions[cond.decision]).toBe(option);
    return;
  }
  if (TIME_TYPES.has(cond.type) || cond.type === 'not') return;
  throw new Error(`condition non scriptée ${cond.type} (${quest})`);
}

function playQuest(sim: Sim, id: string): void {
  const def = questDef(sim, id);
  const w = sim.world;
  // Chaque quête repart du jour 16 (début d'une partie reprise): l'horloge n'avance ensuite que
  // pour ses propres rendez-vous, ce qui garde la moisson et les lumignons dans la limite du jour 64.
  w.clock.day = 16;
  w.clock.minutes = 7 * 60;
  // Les niveaux d'amitié demandés au départ (raccourci assumé, voir l'en-tête).
  for (const c of def.start.when) {
    if (c.type !== 'bond_at_least') continue;
    const need = sim.content.settings.bonds.levels[c.level] ?? 0;
    w.bonds[c.villager] = Math.max(w.bonds[c.villager] ?? 0, need);
  }
  w.quests = w.quests.filter((q) => q.id !== id);
  seek(sim, () => holds(sim, def.start.when), `${id}: départ`);
  updateQuests(sim);
  expect(stepId(sim, id), `${id} démarre`).toBe(def.steps[0]?.id);
  const purse = w.purse;
  const bonds = { ...w.bonds };
  for (let guard = 0; guard < 12 && stepId(sim, id) !== null; guard++) {
    const before = stepId(sim, id);
    const current = def.steps.find((s) => s.id === before);
    if (current === undefined) break;
    const handled = new Set<string>();
    for (const cond of current.conditions) {
      if (stepId(sim, id) !== before) break;
      if (cond.type === 'stayed_at' && handled.has('stay')) continue;
      if (cond.type === 'stayed_at') handled.add('stay');
      satisfy(sim, id, cond, current.conditions);
    }
    updateQuests(sim);
    expect(stepId(sim, id), `${id}: l'étape ${before ?? ''} se finit`).not.toBe(before);
  }
  expect(w.quests.find((q) => q.id === id)?.status).toBe('done');
  // Récompenses: aubrins, liens, objets au cellier.
  for (const e of def.completionEffects) {
    if (e.type === 'give_money')
      expect(w.purse - purse, `${id}: aubrins`).toBeGreaterThanOrEqual(e.amount);
    if (e.type === 'add_bond')
      expect(
        (w.bonds[e.villager] ?? 0) - (bonds[e.villager] ?? 0),
        `${id}: lien ${e.villager}`,
      ).toBeGreaterThanOrEqual(e.amount);
    if (e.type === 'give_item' && e.to === 'cellar')
      expect(duoOwns(sim, e.item), `${id}: ${e.item}`).toBeGreaterThan(0);
    if (e.type === 'set_flag') expect(w.flags).toContain(e.flag);
  }
  expect(w.storyDone[def.giver]).toContain(id);
  // Le rythme des histoires (une neuve par jour, trois jours d'écart) a ses propres tests: ici,
  // la quête finie est datée du jour 1 pour que la suivante parte sans attendre.
  const state = w.quests.find((q) => q.id === id);
  if (state !== undefined) {
    state.startedDay = 1;
    state.doneDay = 1;
  }
}

describe('0.13: suites de quêtes de Lucie, Armand, Berthe, Martial, Marthe, Honorine et Inès', () => {
  it('se jouent toutes de bout en bout, dans l’ordre, avec leurs récompenses', () => {
    const sim = newSim(SEED);
    const w = sim.world;
    w.phase = 'day';
    w.clock.day = 16;
    w.clock.minutes = 8 * 60;
    for (const c of w.characters) {
      c.created = true;
      c.status = 'active';
      c.inside = null;
    }
    // Partie reprise: tout ce qui n'est pas à ce lot est fini (démo, 0.12, autres lots de la 0.13).
    // Les quêtes du lot sont tenues de côté (fausses « finies ») jusqu'à leur tour: une seule part
    // à la fois, sans que le rythme des histoires (une neuve par jour) ne la fasse attendre.
    for (const q of sim.content.quests) {
      w.quests.push({ id: q.id, status: 'done', step: q.steps.length, startedDay: 1, doneDay: 1 });
    }
    for (const id of OTHER_LOT)
      expect(
        w.quests.some((q) => q.id === id),
        `quête de l'autre lot ${id}`,
      ).toBe(true);
    // Ce que la démo a déjà posé: la rue Haute habitée, la remise ouverte.
    w.flags.push('solange_here', 'achille_here', 'shed_open');
    // La poutre du jour 1 est posée depuis longtemps.
    w.beam = null;
    for (const k of w.constructions) k.status = 'done';
    // Les rencontres faites (première conversation de chaque habitant).
    for (const d of Object.values(sim.content.dialogues))
      if (d.kind === 'meeting') w.dialoguesDone.push(`${d.id}@p1`, `${d.id}@p2`);
    expect(ORDER.length).toBe(28);
    for (const id of ORDER) playQuest(sim, id);
    expect(w.clock.day).toBeLessThanOrEqual(sim.content.settings.clock.lastDay.day);
  });

  it('aucune ne démarre dans une partie neuve tant que le duo n’a rencontré aucun habitant nouveau (le robot ne les joue pas)', () => {
    const sim = newSim(SEED);
    const w = sim.world;
    w.clock.day = 30;
    w.clock.minutes = 10 * 60;
    for (const id of ['lucie_note', 'emile_riddle_2', 'handcar'])
      w.quests.push({ id, status: 'done', step: 1, startedDay: 1 });
    updateQuests(sim);
    expect(w.quests.filter((q) => (ORDER as readonly string[]).includes(q.id))).toEqual([]);
  });
});
