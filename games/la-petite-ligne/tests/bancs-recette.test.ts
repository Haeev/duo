// Recette de l'assise (qa-testeur, gauntlet tour 5): cas trouvés en exploration. Les bugs y gardent
// leur référence; corrigés, leurs tests sont devenus des tests de non-régression.
import { isHome } from '../src/etat/interieurs';
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ControlFrame } from '../src/etat/actions';
import { benchById, seatPlace } from '../src/etat/bancs';
import type { CharacterId, ItemId, Vec2, WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { createRobot, newSim, play } from './aides';

const BENCH = 'quay_bench';
const SOUTH = Math.PI / 2;

let seq = 0;
const still = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
function tick(sim: Sim, intents: AuthoredIntent[] = []): WorldEvent[] {
  step(sim, { controls: { p1: still(), p2: still() }, intents });
  return [...sim.events];
}
const press = (sim: Sim, id: CharacterId): WorldEvent[] => tick(sim, [{ by: id, intent: { type: 'act' } }]);

function seatAt(sim: Sim, slot: number): Vec2 {
  const prop = benchById(sim.map, BENCH);
  if (prop === null) throw new Error('banc du quai absent');
  const p = seatPlace(prop, slot, sim.content.settings.benches, { x: 0, y: 0, facing: 0 });
  return { x: p.x, y: p.y };
}

/** Devant la place `slot` (côté de l'assise, au nord), tourné vers le banc. */
function standBefore(sim: Sim, id: CharacterId, slot: number): void {
  const at = seatAt(sim, slot);
  const c = character(sim, id);
  placeCharacter(sim, c, { x: at.x, y: at.y - 0.9 });
  c.facing = SOUTH;
}

/** Centre du corps dans l'emprise d'un banc du quai (rétrécie de 5 cm). */
function insideQuayBench(sim: Sim, x: number, y: number): boolean {
  const r = benchById(sim.map, BENCH)?.rect ?? null;
  return r !== null && x > r.x + 0.05 && x < r.x + r.w - 0.05 && y > r.y + 0.05 && y < r.y + r.h - 0.05;
}

/** Les robots jouent jusqu'au jour et à l'heure dits (journée, aucune scène), puis plus personne ne joue. */
function at(day: number, minutes: number): Sim {
  const sim = newSim(42);
  play(sim, createRobot(), (s) => s.world.clock.day === day && s.world.phase === 'day' && s.world.clock.minutes >= minutes && s.world.scene === null, SIM_HZ * 60 * 120);
  for (const c of sim.world.characters) {
    if (c.dialogue !== null) tick(sim, [{ by: c.id, intent: { type: 'dialogue_close' } }]);
    if (c.menu !== null) tick(sim, [{ by: c.id, intent: { type: 'menu', menu: null } }]);
    if (isHome(c)) placeCharacter(sim, c, { x: 36, y: 22 });
  }
  return sim;
}

function hideJeanne(sim: Sim): void {
  const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
  if (jeanne !== undefined) jeanne.visible = false;
}

describe('assise: cas de recette', () => {
  it('appuis simultanés sur la dernière place libre (Jeanne sur l’autre): un seul s’assoit, personne ne se superpose', () => {
    const sim = at(3, 9 * 60);
    const s0 = seatAt(sim, 0);
    placeCharacter(sim, character(sim, 'p1'), { x: s0.x - 0.35, y: s0.y - 0.9 });
    placeCharacter(sim, character(sim, 'p2'), { x: s0.x + 0.4, y: s0.y - 0.9 });
    for (const c of sim.world.characters) {
      c.facing = SOUTH;
      c.bag[c.selected] = null;
    }
    tick(sim);
    const events = tick(sim, [{ by: 'p1', intent: { type: 'act' } }, { by: 'p2', intent: { type: 'act' } }]);
    expect(events.filter((e) => e.type === 'sat_down')).toHaveLength(1);
    expect(sim.world.characters.filter((c) => c.seat !== null)).toHaveLength(1);
  });

  it('assis à minuit: ramené à la maison, la place est rendue', () => {
    const sim = at(5, 18 * 60);
    hideJeanne(sim);
    standBefore(sim, 'p1', 0);
    tick(sim);
    press(sim, 'p1');
    expect(character(sim, 'p1').seat).not.toBeNull();
    // Les deux joueurs sont là, sans toucher au clavier: l'absence (PA-04, 3 min sans entrée)
    // n'arrête pas l'horloge avant minuit, quel que soit le temps qu'ont laissé les robots.
    for (let n = 0; sim.world.clock.minutes < 24 * 60 && n < SIM_HZ * 60 * 30; n++) {
      for (const c of sim.world.characters) c.lastInputTick = sim.world.tick;
      tick(sim);
    }
    tick(sim);
    const c = character(sim, 'p1');
    expect(c.seat).toBeNull();
    expect(isHome(c)).toBe(true);
  });

  // B-T5-07 (corrigé): le point `quay_bench` est au milieu de l'emprise du banc; Jeanne y apparaissait à 8 h et en sortait à pied.
  it('B-T5-07 Jeanne n’apparaît pas dans l’emprise du banc du quai à son arrivée du matin', () => {
    const sim = at(3, 7 * 60 + 55);
    let inside = 0;
    while (sim.world.clock.minutes < 8 * 60 + 10) {
      tick(sim);
      const j = sim.world.villagers.find((v) => v.id === 'jeanne');
      if (j?.visible === true && j.speed > 0 && insideQuayBench(sim, j.pos.x, j.pos.y)) inside++;
    }
    expect(inside).toBe(0);
  });

  // B-T5-08 (corrigé): un objet non outil en main, devant la place libre à côté du partenaire assis, Espace donnait au lieu d'asseoir.
  for (const item of ['radish', 'plank'] as ItemId[]) {
    it(`B-T5-08 partenaire assis, ${item} en main devant la place libre: Espace assoit (ne donne pas)`, () => {
      const sim = at(4, 14 * 60);
      hideJeanne(sim);
      standBefore(sim, 'p1', 0);
      character(sim, 'p1').bag[character(sim, 'p1').selected] = null;
      tick(sim);
      press(sim, 'p1');
      const c = character(sim, 'p2');
      c.bag[c.selected] = { item, quality: 'ordinary', count: 1 };
      standBefore(sim, 'p2', 1);
      tick(sim);
      const events = press(sim, 'p2');
      expect(events.some((e) => e.type === 'gave')).toBe(false);
      expect(c.seat).not.toBeNull();
    });
  }

  // B-T5-09 (corrigé): après la fin de la démo, Espace devant un banc assoyait puis relevait au même pas, et laissait le corps dans le banc.
  it('B-T5-09 écran de fin: Espace devant un banc ne pose personne dans le banc', () => {
    const sim = at(15, 15 * 60 + 40);
    for (let n = 0; sim.world.phase !== 'ended' && n < SIM_HZ * 60 * 60; n++) {
      tick(sim);
      if (sim.world.scene !== null) for (const c of sim.world.characters) tick(sim, [{ by: c.id, intent: { type: 'dialogue_next' } }]);
    }
    expect(sim.world.phase).toBe('ended');
    standBefore(sim, 'p1', 0);
    tick(sim);
    const events = press(sim, 'p1');
    tick(sim);
    const c = character(sim, 'p1');
    expect(events.some((e) => e.type === 'sat_down')).toBe(false);
    expect(insideQuayBench(sim, c.pos.x, c.pos.y)).toBe(false);
  });
});
