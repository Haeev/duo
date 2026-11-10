// Recette du prologue (qa-testeur): l'heure à l'arrivée à Aubrune. Firmin dit « Il est 8 h et des
// poussières »: l'étape « dormir » ne passe que les deux joueurs couchés (saut de nuit jusqu'à
// 6 h, puis le trajet). Une sieste d'un seul ne la franchit plus (défaut D7: le train arrivait en
// pleine nuit). Les lits se lisent dans les données (brique `sleep`), pas par leur identifiant.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { sceneView } from '../src/simulation/scenes/lecture';
import { newSim } from './aides';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { isLying, lieDown, propsWithBrick } from './aides-prologue';

type Json = Record<string, unknown>;

const PROLOGUE = 'train-de-nuit';
const AUBRUNE = 'aubrune';

/** Une partie neuve: le jeu commence dans le train de nuit à 21 h 30. */
function newGame(): Sim {
  return newSim(
    contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: PROLOGUE, minute: 1290 };
    }),
  );
}

function point(sim: Sim, name: string): { x: number; y: number } {
  const at = sim.content.places[sim.world.common.place]?.map.points[name];
  if (at === undefined) throw new Error(`point ${name}`);
  return at;
}

function playScene(sim: Sim): void {
  for (let i = 0; i < 40 && sim.world.common.story?.scene; i++) {
    for (const p of [0, 1] as const) {
      const view = sceneView(sim.world, sim.content, p);
      if (view?.beat.kind === 'say' && view.beat.mine) act(sim, p, { type: 'scene_next' });
    }
    wait(sim, 1);
  }
}

function talk(sim: Sim, player: PlayerIndex, villager: string, option?: string): void {
  const at = sim.world.places[sim.world.common.place]?.villagers[villager];
  if (at === undefined) throw new Error(`habitant ${villager}`);
  sim.world.players[player].body.x = at.body.x - 0.8;
  sim.world.players[player].body.y = at.body.y;
  expect(startTalk(contextOf(sim), player, villager)).toBe(true);
  for (let i = 0; i < 12 && sim.world.players[player].talk !== null; i++) {
    wait(sim, 0.25);
    const view = talkView(sim.content, sim.world, player);
    if ((view?.options.length ?? 0) > 0)
      act(sim, player, { type: 'talk_choose', option: option ?? '' });
    else act(sim, player, { type: 'talk_next' });
  }
  wait(sim, 0.3);
}

const passedSleep = (sim: Sim): boolean =>
  (sim.world.progress.quests.terminus?.passed ?? []).includes('dormir');

/** Joue le prologue jusqu'à l'étape « dormir », scène du tunnel lue; renvoie la partie et ses lits. */
function untilBedtime(): { sim: Sim; beds: readonly string[] } {
  const sim = newGame();
  playScene(sim);
  talk(sim, 0, 'controleur');
  talk(sim, 1, 'controleur');
  talk(sim, 0, 'controleur', 'sandwich');
  act(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 0 } });
  sim.world.players[0].needs.hunger = 90;
  wait(sim, 0.5);
  expect(sim.world.progress.quests.terminus?.step).toBe('dormir');
  playScene(sim);
  const beds = propsWithBrick(sim.content, PROLOGUE, 'sleep');
  expect(beds.length, 'un lit par joueur dans le wagon').toBeGreaterThanOrEqual(2);
  return { sim, beds };
}

/** Les deux devant la porte, puis le trajet; renvoie le jour et la minute à l'arrivée à Aubrune. */
function getOff(sim: Sim): { day: number; minutes: number } {
  playScene(sim);
  const door = point(sim, 'porte');
  for (const p of [0, 1] as const) {
    sim.world.players[p].body.x = door.x + (p === 0 ? -0.4 : 0.4);
    sim.world.players[p].body.y = door.y;
  }
  wait(sim, 0.5);
  for (
    let i = 0;
    i < 60 && (sim.world.common.place !== AUBRUNE || sim.world.common.phase !== 'day');
    i++
  ) {
    for (const p of [0, 1] as const) act(sim, p, { type: 'place_loaded', place: AUBRUNE });
    wait(sim, 1);
  }
  expect(sim.world.common.place).toBe(AUBRUNE);
  return { day: sim.world.common.day, minutes: sim.world.minutes };
}

describe('prologue: l’heure à l’arrivée à Aubrune', () => {
  it('les deux dorment: réveil à 6 h, arrivée vers 8 h comme le dit Firmin', () => {
    const { sim, beds } = untilBedtime();
    for (const p of [0, 1] as const) lieDown(sim, p, beds[p] ?? '');
    for (let i = 0; i < 10 && !passedSleep(sim); i++) wait(sim, 1);
    expect(passedSleep(sim)).toBe(true);
    expect(sim.world.common.day).toBe(2);
    const arrival = getOff(sim);
    expect(arrival.minutes).toBeGreaterThanOrEqual(8 * 60);
    expect(arrival.minutes).toBeLessThan(8 * 60 + 30);
  });

  it('un seul se couche: l’étape attend l’autre, et l’arrivée ne tombe pas en pleine nuit (D7)', () => {
    const { sim, beds } = untilBedtime();
    // Sommeil déjà haut: avant la correction, cette sieste franchissait l'étape en moins de 30 s.
    for (const p of [0, 1] as const) sim.world.players[p].needs.sleep = 78;
    lieDown(sim, 0, beds[0] ?? '');
    expect(isLying(sim, 0)).toBe(true);
    wait(sim, 60);
    expect(sim.world.players[0].needs.sleep).toBeGreaterThanOrEqual(80);
    expect(passedSleep(sim), 'une sieste seule ne franchit pas « dormir »').toBe(false);
    expect(sim.world.common.day).toBe(1);
    lieDown(sim, 1, beds[1] ?? '');
    for (let i = 0; i < 10 && !passedSleep(sim); i++) wait(sim, 1);
    expect(passedSleep(sim)).toBe(true);
    const arrival = getOff(sim);
    expect(arrival.day).toBe(2);
    expect(arrival.minutes).toBeGreaterThanOrEqual(8 * 60);
    expect(arrival.minutes).toBeLessThan(8 * 60 + 30);
  });
});
