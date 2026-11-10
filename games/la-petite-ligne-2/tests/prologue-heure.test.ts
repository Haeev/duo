// Recette du prologue (qa-testeur): l'heure à l'arrivée à Aubrune. Firmin dit « Il est 8 h et des
// poussières »: c'est vrai quand les deux joueurs dorment ensemble (saut de nuit jusqu'à 6 h, puis
// le trajet), faux quand un seul se couche (une sieste suffit à l'étape « dormir »: le train
// arrive en pleine nuit). Le second cas est un défaut connu (`it.fails`): il devient rouge à la
// correction, il faudra alors retirer `.fails`.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { sceneView } from '../src/simulation/scenes/lecture';
import { newSim } from './aides';
import { act, contentWith, contextOf, wait } from './aides-l3';

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

/** Se couche sur la banquette dont le point `bed` est le centre, comme un joueur face au lit. */
function lieDown(sim: Sim, player: PlayerIndex, bed: string): void {
  const prop = sim.content.places[PROLOGUE]?.map.objects.find((o) => o.id === bed);
  if (prop === undefined) throw new Error(`banquette ${bed}`);
  const body = sim.world.players[player].body;
  body.x = prop.x;
  body.y = prop.y + 1.6;
  body.facing = -Math.PI / 2;
  body.speed = 0;
  wait(sim, 0.3);
  act(sim, player, { type: 'act' });
  wait(sim, 0.3);
}

/** Joue le prologue jusqu'à la descente; renvoie la minute du monde à l'arrivée à Aubrune. */
function playPrologue(sleepers: readonly PlayerIndex[]): { day: number; minutes: number } {
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
  // Le sommeil part de 78 (au lieu de 65) pour que la sieste d'un seul joueur reste courte.
  for (const p of [0, 1] as const) sim.world.players[p].needs.sleep = 78;
  const beds = ['banquette-ouest', 'banquette-est'] as const;
  sleepers.forEach((p) => {
    lieDown(sim, p, beds[p]);
  });
  for (
    let i = 0;
    i < 120 && !(sim.world.progress.quests.terminus?.passed ?? []).includes('dormir');
    i++
  )
    wait(sim, 1);
  expect(sim.world.progress.quests.terminus?.passed).toContain('dormir');
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
    const arrival = playPrologue([0, 1]);
    expect(arrival.minutes).toBeGreaterThanOrEqual(8 * 60);
    expect(arrival.minutes).toBeLessThan(8 * 60 + 30);
  });

  // Défaut: une sieste d'un seul joueur franchit « dormir » sans saut de nuit; arrivée vers 0 h 45.
  it.fails('un seul se couche: l’arrivée ne tombe pas en pleine nuit (Firmin dit 8 h)', () => {
    const arrival = playPrologue([0]);
    expect(arrival.minutes).toBeGreaterThanOrEqual(6 * 60);
  });
});
