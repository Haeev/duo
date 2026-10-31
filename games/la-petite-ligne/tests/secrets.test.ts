// Informations propres à un seul joueur (R16, gauntlet tour 6; conception, sections 2 et 4):
// rôles et alternance (S-06), dialogues réservés à un rôle (S-03), rien du secret chez l'autre
// (S-02), erreurs jamais punies et coup de coude, sauvegarde au milieu d'une quête secrète (S-07),
// migration des sauvegardes d'avant, robots qui se parlent ou non (S-04, S-05).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CharacterId, Hen } from '../src/etat/types';
import { HEN_NAMES_QUEST, henLabel, objectiveFor, secretCards } from '../src/etat/secrets';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { dialogueChoice, dialogueClose, pickDialogue, talkTo } from '../src/simulation/dialogues';
import { placeCharacter } from '../src/simulation/deplacement';
import { runEffects } from '../src/simulation/effets';
import { step } from '../src/simulation/pas';
import { startQuest, updateQuests } from '../src/simulation/quetes';
import { HEN_CALL_DIALOGUE } from '../src/simulation/secrets';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const NAMES = ['Bichette', 'Cocotte', 'la Duchesse'];
const SAVES = new URL('./donnees/sauvegardes/', import.meta.url);

function readySim(seed = 5): Sim {
  const sim = newSim(seed);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null && s.world.scripts.length === 0, SIM_HZ * 600);
  sim.world.beam = null;
  // Tous les habitants déjà rencontrés (sinon la rencontre passe avant tout le reste).
  for (const d of Object.values(sim.content.dialogues)) if (d.kind === 'meeting') sim.world.dialoguesDone.push(d.id, `${d.id}@p1`, `${d.id}@p2`);
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    // Mains libres: Espace près d'une poule appelle au lieu de bêcher.
    c.selected = c.bag.findIndex((s, i) => s === null && i < 10);
  }
  return sim;
}

/** Les poules arrivées (fin de la quête des poules), puis la quête des noms démarrée (jour 5, 9 h). */
function henNamesSim(seed = 5): Sim {
  const sim = readySim(seed);
  sim.world.quests.push({ id: 'hens', status: 'done', step: 2, checklist: [], baselines: {}, startedDay: 1 });
  const hens = sim.content.quests.find((q) => q.id === 'hens');
  runEffects(sim, hens?.completionEffects ?? [], null);
  sim.world.clock.day = 5;
  sim.world.clock.minutes = 9 * 60;
  updateQuests(sim);
  return sim;
}

function finishListen(sim: Sim): void {
  sim.world.dialoguesDone.push('odette_hen_names_tell');
  updateQuests(sim);
}

function near(sim: Sim, id: CharacterId, hen: Hen): void {
  const c = character(sim, id);
  placeCharacter(sim, c, { x: hen.pos.x - 0.9, y: hen.pos.y });
  c.facing = 0;
  // Les poules ne bougent plus pendant le test (elles picorent au hasard sinon).
  for (const h of sim.world.hens) h.wander = { ...h.pos };
}

function act(sim: Sim, id: CharacterId): void {
  step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'act' } }] });
}

function choose(sim: Sim, id: CharacterId, choice: string): void {
  step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'dialogue_choice', choice } }] });
}

/** Le choix du nom `name` dans la conversation ouverte. */
function nameChoice(sim: Sim, id: CharacterId, name: string): string {
  const found = character(sim, id).dialogue?.choices.find((ch) => ch.text === name);
  if (found === undefined) throw new Error(`choix ${name} absent`);
  return found.id;
}

describe('secrets: rôles et alternance (S-06)', () => {
  it('« Les noms des poules » va à p1, « Le mot de Lucie » à p2; le tour passe ensuite à p1', () => {
    const sim = henNamesSim();
    const hens = sim.world.secrets.entries.find((e) => e.quest === HEN_NAMES_QUEST);
    expect(hens).toMatchObject({ informed: 'p1', doer: 'p2', errors: 0, revealed: false });
    expect(sim.world.secrets.turn).toBe('p2');
    startQuest(sim, 'lucie_note');
    expect(sim.world.secrets.entries.find((e) => e.quest === 'lucie_note')).toMatchObject({ informed: 'p2', doer: 'p1' });
    expect(sim.world.secrets.turn).toBe('p1');
  });

  it('les poules portent la permutation tirée par la graine, la même que la variante du secret', () => {
    const order = ['hen_white', 'hen_red', 'hen_black'];
    const table = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const seen = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const sim = henNamesSim(seed);
      const entry = sim.world.secrets.entries.find((e) => e.quest === HEN_NAMES_QUEST);
      const k = entry?.variant ?? -1;
      seen.add(k);
      expect(sim.world.hens.map((h) => h.name)).toEqual(NAMES);
      expect(sim.world.hens.map((h) => order.indexOf(h.variant))).toEqual(table[k]);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('secrets: dialogues réservés à un rôle (S-03)', () => {
  it('Odette ne donne le secret qu’à l’informé; l’autre est renvoyé vers lui', () => {
    const sim = henNamesSim();
    expect(pickDialogue(sim, 'odette', 'p1')?.id).toBe('odette_hen_names_tell');
    expect(pickDialogue(sim, 'odette', 'p2')?.id).toBe('odette_hen_names_redirect');
  });

  it('Jeanne ne pose la question qu’à l’autre; l’informé l’entend refuser', () => {
    const sim = readySim();
    sim.world.clock.day = 11;
    startQuest(sim, 'lucie_note');
    expect(pickDialogue(sim, 'jeanne', 'p1')?.id).toBe('jeanne_lucie_ask');
    expect(pickDialogue(sim, 'jeanne', 'p2')?.id).toBe('jeanne_lucie_redirect');
    const state = sim.world.quests.find((q) => q.id === 'lucie_note');
    if (state === undefined) throw new Error('lucie_note absente');
    state.step = 2;
    expect(pickDialogue(sim, 'jeanne', 'p2')?.id).toBe('jeanne_lucie_quiz');
    expect(pickDialogue(sim, 'jeanne', 'p1')?.id).toBe('jeanne_lucie_not_you');
    const variant = sim.world.secrets.entries.find((e) => e.quest === 'lucie_note')?.variant ?? 0;
    expect(pickDialogue(sim, 'firmin', 'p1')?.id).toBe(`firmin_lucie_reply_${String(variant)}`);
    expect(pickDialogue(sim, 'firmin', 'p2')?.id).not.toMatch(/^firmin_lucie_reply_\d$/);
  });

  it('seul l’autre appelle les poules; l’informé apprend que c’est la voix de l’autre', () => {
    const sim = henNamesSim();
    finishListen(sim);
    const hen = sim.world.hens[0];
    if (hen === undefined) throw new Error('pas de poule');
    near(sim, 'p1', hen);
    act(sim, 'p1');
    expect(character(sim, 'p1').dialogue).toBeNull();
    expect(character(sim, 'p1').notifications.some((n) => n.key === 'hen_names_informed_call')).toBe(true);
    near(sim, 'p2', hen);
    step(sim, { controls: {}, intents: [] });
    expect(character(sim, 'p2').aim?.verb).toBe('call');
    act(sim, 'p2');
    const d = character(sim, 'p2').dialogue;
    expect(d?.dialogue).toBe(HEN_CALL_DIALOGUE);
    expect(d?.choices.map((c) => c.text)).toEqual([...NAMES, 'Laisser']);
    expect(d?.lines[0]?.text).toMatch(/^Comment s'appelle la poule (blanche|rousse|noire) \?$/);
  });
});

describe('secrets: rien du secret chez l’autre (S-02)', () => {
  it('fiche, étiquettes, objectifs et messages de l’autre ne contiennent ni les couleurs du secret ni les noms', () => {
    const sim = henNamesSim();
    const { content } = contentAndMap();
    const colors = (sim.content.texts.raw.henColors ?? {}) as Record<string, string>;
    const cardLines = (hen: Hen, i: number): string => `${NAMES[i] ?? ''}, c'est ${colors[hen.variant] ?? ''}`;
    const leaks = (id: CharacterId): string[] => {
      const w = sim.world;
      const texts = [
        ...secretCards(w, content, id).flatMap((k) => [k.title, ...k.lines]),
        ...w.hens.map((h) => henLabel(w, content, h, id)),
        ...w.quests.map((q) => objectiveFor(w, content, q.id, q.step, id)),
        ...character(sim, id).notifications.map((n) => n.text),
      ].join('\n');
      return [...w.hens.map((h, i) => cardLines(h, i)), ...NAMES].filter((s) => texts.includes(s));
    };
    expect(leaks('p2')).toEqual([]);
    expect(secretCards(sim.world, content, 'p1')).toEqual([]);
    finishListen(sim);
    // L'informé lit sa fiche et voit les noms au-dessus des poules; l'autre, rien.
    const card = secretCards(sim.world, content, 'p1');
    expect(card).toHaveLength(1);
    expect(card[0]?.title).toBe("Les poules d'Odette");
    expect(card[0]?.lines.join(' ')).toContain(colors[sim.world.hens[0]?.variant ?? ''] ?? '?');
    expect(sim.world.hens.map((h) => henLabel(sim.world, content, h, 'p1'))).toEqual(NAMES);
    expect(leaks('p2')).toEqual([]);
    expect(objectiveFor(sim.world, content, HEN_NAMES_QUEST, 1, 'p2')).toContain('Camille');
    // Les trois nommées: le secret devient celui des deux.
    for (const hen of sim.world.hens) {
      near(sim, 'p2', hen);
      act(sim, 'p2');
      choose(sim, 'p2', nameChoice(sim, 'p2', hen.name));
    }
    updateQuests(sim);
    expect(sim.world.quests.find((q) => q.id === HEN_NAMES_QUEST)?.status).toBe('done');
    expect(secretCards(sim.world, content, 'p2')).toHaveLength(1);
    expect(sim.world.hens.map((h) => henLabel(sim.world, content, h, 'p2'))).toEqual(NAMES);
  });

  it('« Le mot de Lucie »: la réponse de Firmin ne figure qu’au carnet de l’informé', () => {
    const sim = readySim();
    const { content } = contentAndMap();
    sim.world.clock.day = 11;
    startQuest(sim, 'lucie_note');
    const entry = sim.world.secrets.entries.find((e) => e.quest === 'lucie_note');
    const lines = content.quests.find((q) => q.id === 'lucie_note')?.secret?.card.lines as string[][];
    const secret = lines[entry?.variant ?? 0]?.[0] ?? '?';
    const state = sim.world.quests.find((q) => q.id === 'lucie_note');
    if (state === undefined || entry === undefined) throw new Error('lucie_note absente');
    state.step = 2;
    sim.world.dialoguesDone.push(`firmin_lucie_reply_${String(entry.variant)}`);
    updateQuests(sim);
    expect(entry.revealed).toBe(true);
    expect(objectiveFor(sim.world, content, 'lucie_note', 2, 'p1')).toContain(secret);
    expect(objectiveFor(sim.world, content, 'lucie_note', 2, 'p2')).not.toContain(secret);
    expect(secretCards(sim.world, content, 'p1')[0]?.lines).toEqual([secret]);
    expect(secretCards(sim.world, content, 'p2')).toEqual([]);
  });
});

describe('secrets: une erreur ne coûte jamais rien', () => {
  it('poules: mauvais nom, la poule penche la tête; à 2 erreurs l’informé reçoit un coup de coude, une fois', () => {
    const sim = henNamesSim();
    finishListen(sim);
    const entry = sim.world.secrets.entries.find((e) => e.quest === HEN_NAMES_QUEST);
    const hen = sim.world.hens[0];
    if (hen === undefined || entry === undefined) throw new Error('pas de poule');
    const wrong = NAMES.filter((n) => n !== hen.name);
    const purse = sim.world.purse;
    near(sim, 'p2', hen);
    for (const name of wrong) {
      act(sim, 'p2');
      choose(sim, 'p2', nameChoice(sim, 'p2', name));
      expect(character(sim, 'p2').notifications.at(-1)?.key).toBe('hen_named_wrong');
      expect(hen.namedBy).toBeNull();
    }
    expect(entry.errors).toBe(2);
    expect(sim.world.purse).toBe(purse);
    const nudges = (id: CharacterId): number => character(sim, id).notifications.filter((n) => n.key === 'secret_nudge_hens').length;
    expect(nudges('p1')).toBe(1);
    expect(nudges('p2')).toBe(0);
    // On réessaie tout de suite: juste.
    act(sim, 'p2');
    choose(sim, 'p2', nameChoice(sim, 'p2', hen.name));
    expect(hen.namedBy).toBe('p2');
    expect(hen.nameKnownBy).toEqual(['p1', 'p2']);
    expect(character(sim, 'p2').notifications.at(-1)?.text).toBe(`Elle glousse et vient vers toi: c'est bien ${hen.name} !`);
    // « Laisser » ferme sans rien compter.
    const other = sim.world.hens[1];
    if (other === undefined) throw new Error('pas de deuxième poule');
    near(sim, 'p2', other);
    act(sim, 'p2');
    choose(sim, 'p2', 'leave');
    expect(character(sim, 'p2').dialogue).toBeNull();
    expect(entry.errors).toBe(2);
    expect(nudges('p1')).toBe(1);
  });

  it('du premier coup: « Du premier coup ! » et un peu de Cœur pour chacun; 15 sous d’Odette', () => {
    const sim = henNamesSim();
    finishListen(sim);
    const purse = sim.world.purse;
    for (const hen of sim.world.hens) {
      near(sim, 'p2', hen);
      act(sim, 'p2');
      choose(sim, 'p2', nameChoice(sim, 'p2', hen.name));
    }
    updateQuests(sim);
    expect(sim.world.purse).toBe(purse + 15);
    for (const c of sim.world.characters) {
      expect(c.heartToday.firstTry).toBe(true);
      expect(c.notifications.some((n) => n.key === 'secret_first_try')).toBe(true);
    }
  });

  it('Lucie: un mauvais choix chez Jeanne se rejoue tout de suite, sans perte; le bon finit la quête', () => {
    const sim = readySim();
    sim.world.clock.day = 11;
    startQuest(sim, 'lucie_note');
    const state = sim.world.quests.find((q) => q.id === 'lucie_note');
    const entry = sim.world.secrets.entries.find((e) => e.quest === 'lucie_note');
    const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
    if (state === undefined || entry === undefined || jeanne === undefined) throw new Error('lucie_note absente');
    state.step = 2;
    const square = sim.map.points.village_square ?? { x: 38.5, y: 30.5 };
    jeanne.visible = true;
    jeanne.pos = { ...square };
    jeanne.prev = { ...square };
    sim.runtime.villagerPaths.jeanne = { target: jeanne.target, path: [] };
    const doer = character(sim, entry.doer);
    placeCharacter(sim, doer, { x: jeanne.pos.x - 1, y: jeanne.pos.y });
    const talk = (): void => {
      jeanne.visible = true;
      talkTo(sim, doer, 'jeanne');
    };
    // Sans pas de simulation: l'emploi du temps de Jeanne la ferait partir (la journée est truquée).
    const wrong = [0, 1, 2].filter((k) => k !== entry.variant);
    for (const k of wrong) {
      talk();
      expect(doer.dialogue?.dialogue).toBe('jeanne_lucie_quiz');
      expect(doer.dialogue?.choices.map((c) => c.id)).toEqual(['reply_0', 'reply_1', 'reply_2']);
      dialogueChoice(sim, doer, `reply_${String(k)}`);
      expect(doer.dialogue?.lines.at(-1)?.text).toContain('Ça ne ressemble pas à Firmin');
      dialogueClose(sim, doer);
      updateQuests(sim);
      expect(state.status).toBe('active');
    }
    expect(entry.errors).toBe(2);
    expect(character(sim, entry.informed).notifications.filter((n) => n.key === 'secret_nudge_lucie')).toHaveLength(1);
    talk();
    dialogueChoice(sim, doer, `reply_${String(entry.variant)}`);
    dialogueClose(sim, doer);
    updateQuests(sim);
    expect(state.status).toBe('done');
  });
});

describe('secrets: sauvegarde (S-07) et sauvegardes d’avant', () => {
  it('au milieu de la quête des noms: rôles, variante, étiquettes et erreurs gardés', () => {
    const sim = henNamesSim();
    finishListen(sim);
    const hen = sim.world.hens[0];
    if (hen === undefined) throw new Error('pas de poule');
    near(sim, 'p2', hen);
    act(sim, 'p2');
    choose(sim, 'p2', nameChoice(sim, 'p2', NAMES.find((n) => n !== hen.name) ?? ''));
    act(sim, 'p2');
    choose(sim, 'p2', nameChoice(sim, 'p2', hen.name));
    const before = structuredClone(sim.world.secrets);
    const snap = snapshotOf(sim);
    const { content, map } = contentAndMap();
    // L'autre machine héberge cette fois: les rôles suivent le personnage.
    const back = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [B, A]);
    expect(back.world.secrets).toEqual(before);
    expect(back.world.hens.map((h) => [h.namedBy, h.nameKnownBy])).toEqual(sim.world.hens.map((h) => [h.namedBy, h.nameKnownBy]));
    expect(back.world.quests.find((q) => q.id === HEN_NAMES_QUEST)?.step).toBe(1);
    expect(back.world.characters.find((c) => c.playerId === A.id)?.id).toBe('p1');
  });

  it('format 2: les poules déjà là gardent leurs noms chez les deux, la quête des noms ne démarre pas; Lucie finie le reste', () => {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL('format-2-milieu-semaine-2.json', SAVES)), 'utf8')) as { dataSchema: number; data: unknown };
    const { content, map } = contentAndMap();
    const sim = restoreWorld(content, map, decodeSave(structuredClone(raw.data)), raw.dataSchema, [A, B]);
    const w = sim.world;
    expect(w.hens.length).toBe(3);
    for (const h of w.hens) expect(h.nameKnownBy).toEqual(['p1', 'p2']);
    expect(w.flags).toContain(content.settings.secrets.knownHensFlag);
    expect(w.moments).toEqual({ today: null, history: [], hintTurn: 'p2' });
    const lucie = w.quests.find((q) => q.id === 'lucie_note');
    expect(lucie?.status).toBe('done');
    expect(lucie?.step).toBe(3);
    expect(w.secrets.entries.map((e) => e.quest)).toEqual(['lucie_note']);
    play(sim, createRobot(), (s) => s.world.clock.day > 11, SIM_HZ * 60 * 60);
    expect(sim.world.quests.some((q) => q.id === HEN_NAMES_QUEST)).toBe(false);
  });

  it('format 2 avec « Le mot de Lucie » en cours: l’étape gagne un cran, l’informé est celui qui a la lettre', () => {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL('format-2-milieu-semaine-2.json', SAVES)), 'utf8')) as {
      dataSchema: number;
      data: { quests: { id: string; status: string; step: number }[]; characters: { id: string; bag: unknown[] }[] };
    };
    const data = structuredClone(raw.data);
    const lucie = data.quests.find((q) => q.id === 'lucie_note');
    const p2 = data.characters.find((c) => c.id === 'p2');
    if (lucie === undefined || p2 === undefined) throw new Error('référence inattendue');
    lucie.status = 'active';
    lucie.step = 0;
    p2.bag[20] = { item: 'lucie_letter', quality: 'ordinary', count: 1 };
    const { content, map } = contentAndMap();
    const sim = restoreWorld(content, map, data, raw.dataSchema, [A, B]);
    const state = sim.world.quests.find((q) => q.id === 'lucie_note');
    expect(state?.step).toBe(1);
    expect(sim.world.secrets.entries.find((e) => e.quest === 'lucie_note')).toMatchObject({ informed: 'p2', doer: 'p1' });
    expect(sim.world.secrets.turn).toBe('p1');
  });
});

describe('secrets: les robots finissent les deux quêtes (S-04, S-05)', () => {
  it('robots sourds: ils devinent, au plus 3 erreurs pour les poules et 2 pour Lucie, le coup de coude à la 2e erreur', () => {
    const sim = newSim(42);
    play(sim, createRobot({ secrets: 'deaf' }), (s) => s.world.phase === 'ended', SIM_HZ * 60 * 120);
    const w = sim.world;
    expect(w.phase).toBe('ended');
    for (const id of [HEN_NAMES_QUEST, 'lucie_note']) expect(w.quests.find((q) => q.id === id)?.status, id).toBe('done');
    const hens = w.secrets.entries.find((e) => e.quest === HEN_NAMES_QUEST);
    const lucie = w.secrets.entries.find((e) => e.quest === 'lucie_note');
    expect(hens?.errors ?? 99).toBeLessThanOrEqual(3);
    expect(lucie?.errors ?? 99).toBeLessThanOrEqual(2);
    for (const e of [hens, lucie]) {
      if (e === undefined) continue;
      expect(e.nudged).toBe(e.errors >= 2);
    }
    expect((hens?.errors ?? 0) + (lucie?.errors ?? 0)).toBeGreaterThan(0);
  }, 300_000);
});
