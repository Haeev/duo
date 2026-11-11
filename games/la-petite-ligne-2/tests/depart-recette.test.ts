// Défauts D2, D3 et D4 de la recette du jalon 1: le vrai départ du jeu (prologue puis Aubrune),
// la boutique toujours offerte par le commerçant, le point d'arrivée dégagé et la visée du regard.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { restoreWorld } from '../src/sauvegarde/sauvegarde';
import { aimOf } from '../src/simulation/briques/visee';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { DIALOGUES } from '../src/simulation/dialogues/reglages';
import { VILLAGERS } from '../src/simulation/habitants/reglages';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { boardingChoices } from '../src/simulation/voyage/index';
import { DATA_SCHEMA } from '../src/etat/monde';
import { gameContent, gameDataFiles, MEMBERS, newSim, SEED } from './aides';
import { act, contextOf, wait } from './aides-l3';
import { put } from './aides-noyau';
import { referenceSave } from './aides-sauvegarde';

const CHIEF = 'cheffe-de-gare';

describe('D4: une partie neuve commence par le prologue, puis Aubrune', () => {
  const content = loadContent(gameDataFiles());

  it('part du train de nuit à 21 h 30, scène du compartiment lancée', () => {
    const sim = createSim(content, createWorld(content, SEED, MEMBERS));
    wait(sim, 0.5);
    expect(sim.world.common.place).toBe('train-de-nuit');
    expect(content.settings.start.minute).toBe(21 * 60 + 30);
    expect(sim.world.progress.quests.terminus?.step).toBe('papiers');
    expect(sim.world.common.story?.scene?.id).toBe('le-compartiment');
  });

  it('la fin du prologue fait partir le train vers le quai d’Aubrune, sans ligne de retour', () => {
    const sim = createSim(content, createWorld(content, SEED, MEMBERS));
    const terminus = content.places['train-de-nuit']?.quests.terminus;
    const steps = terminus?.chapters.flatMap((c) => c.steps.map((s) => s.id)) ?? [];
    // Prologue franchi jusqu'à la dernière étape (« descendre »), puis les deux à la porte.
    sim.world.progress.quests.terminus = {
      chapter: 'prologue',
      step: 'descendre',
      done: false,
      passed: steps.slice(0, -1),
    };
    const door = content.places['train-de-nuit']?.map.points.porte ?? { x: 0, y: 0 };
    put(sim, 0, door.x - 0.3, door.y, 0);
    put(sim, 1, door.x + 0.3, door.y, 0);
    for (let i = 0; i < 20 && sim.world.common.place !== 'aubrune'; i++) wait(sim, 0.5);
    expect(sim.world.common.place).toBe('aubrune');
    for (let i = 0; i < 30 && sim.world.common.phase !== 'day'; i++) {
      for (const p of [0, 1] as const) act(sim, p, { type: 'place_loaded', place: 'aubrune' });
      wait(sim, 0.5);
    }
    const quai = content.places.aubrune?.map.points.quai ?? { x: 0, y: 0 };
    for (const player of sim.world.players)
      expect(Math.hypot(player.body.x - quai.x, player.body.y - quai.y)).toBeLessThan(1);
    expect(boardingChoices(sim, 0)).toEqual([]);
    wait(sim, 0.5);
    expect(sim.world.progress.quests['le-train-de-5h12']).toBeDefined();
  });

  it('la sauvegarde de référence reste lisible avec le vrai départ', () => {
    const restored = restoreWorld(content, referenceSave(DATA_SCHEMA), MEMBERS);
    expect(restored.ok).toBe(true);
  });
});

/** Parle à la cheffe de gare et suit le dialogue (premier choix) jusqu'à la page de la boutique ou la fin. */
function talkToChief(sim: Sim, option = 'oui'): string[] {
  expect(startTalk(contextOf(sim), 0, CHIEF)).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const talk = sim.world.players[0].talk;
    if (talk === null || talk.node === DIALOGUES.shopOffer.node) break;
    seen.push(`${talk.dialogue}#${talk.node}`);
    const view = talkView(sim.content, sim.world, 0);
    if ((view?.options.length ?? 0) > 0) act(sim, 0, { type: 'talk_choose', option });
    else act(sim, 0, { type: 'talk_next' });
  }
  return seen;
}

describe('D2: un dialogue de quête ne masque pas la boutique du commerçant', () => {
  it('après la besace, la sonnerie passe sans boutique derrière; le comptoir ouvre la buvette', () => {
    const sim = newSim(gameContent());
    put(sim, 0, 20, 16, -Math.PI / 2);
    talkToChief(sim);
    expect(sim.world.players[0].bag).not.toBeNull();
    // L'accueil ouvre déjà la buvette lui-même: pas de page en plus.
    expect(sim.world.players[0].talk).toBeNull();
    wait(sim, 1);
    const seen = talkToChief(sim);
    expect(seen[0]).toMatch(/^sonnerie-debut#/);
    // Une réplique de quête ne débouche pas sur la boutique: la conversation se clôt.
    expect(sim.world.players[0].talk).toBeNull();
    // Le comptoir, lui, ouvre la buvette: la quête ne la cache jamais.
    put(sim, 0, 24.6, 15, Math.PI);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'comptoir-buvette', verb: 'Acheter' });
    const events = act(sim, 0, { type: 'act' });
    expect(events).toContainEqual({ type: 'shop_opened', player: 0, shop: 'buvette-de-la-gare' });
  });

  it('boutique fermée (la nuit): pas de page en plus', () => {
    const sim = newSim(gameContent());
    sim.world.minutes = 23 * 60;
    put(sim, 0, 20, 16, -Math.PI / 2);
    talkToChief(sim, 'non');
    expect(sim.world.players[0].talk).toBeNull();
  });
});

describe('D3: point d’arrivée dégagé, la visée préfère ce que l’on regarde', () => {
  it('après la scène d’accueil, aucun habitant d’Aubrune ne reste près de la descente', () => {
    const files = gameDataFiles();
    const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
    settings.start = { ...settings.start, place: 'aubrune', minute: 8 * 60 };
    const aubrune = loadContent(files);
    const sim = createSim(aubrune, createWorld(aubrune, SEED, MEMBERS));
    // La scène d'accueil mène Firmin devant les joueurs; les répliques passent au délai.
    wait(sim, 1);
    expect(sim.world.common.story?.scene?.id).toBe('firmin-en-pantoufles');
    for (let i = 0; i < 40 && (sim.world.common.story?.scene ?? null) !== null; i++) wait(sim, 3);
    expect(sim.world.common.story?.scene ?? null).toBeNull();
    wait(sim, 8);
    const arrival = aubrune.places.aubrune?.map.points.quai ?? { x: 0, y: 0 };
    const firmin = sim.world.places.aubrune?.villagers.firmin;
    expect(firmin?.life?.activity).toBe('surveiller-le-quai');
    for (const [id, v] of Object.entries(sim.world.places.aubrune?.villagers ?? {}))
      expect(
        Math.hypot(v.body.x - arrival.x, v.body.y - arrival.y),
        `${id} loin de la descente`,
      ).toBeGreaterThanOrEqual(VILLAGERS.arrivalClearance - 0.05);
  });

  it('un habitant tout proche mais de biais ne prend pas la cible de l’objet regardé', () => {
    const sim = newSim(gameContent());
    const place = sim.world.places['essai-gare'];
    const chief = place?.villagers[CHIEF];
    if (place === undefined || chief === undefined) throw new Error('gare d’essai');
    // Le joueur regarde vers l'est; la pomme est droit devant à 1,15 m (10 degrés), la cheffe à
    // 0,2 m mais à 22 degrés: plus proche, hors du regard (20 degrés).
    put(sim, 0, 30, 30, 0);
    const at = (deg: number, d: number): { x: number; y: number } => ({
      x: 30 + Math.cos((deg * Math.PI) / 180) * d,
      y: 30 + Math.sin((deg * Math.PI) / 180) * d,
    });
    const apple = at(10, 1.15);
    place.ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, ...apple });
    const near = at(22, 0.2);
    chief.body.x = near.x;
    chief.body.y = near.y;
    expect(aimOf(sim, 0)?.kind).toBe('ground');
    // Dans le regard, le plus proche l'emporte toujours.
    const inSight = at(15, 0.5);
    chief.body.x = inSight.x;
    chief.body.y = inSight.y;
    expect(aimOf(sim, 0)?.id).toBe(CHIEF);
  });
});
