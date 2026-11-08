// Recette de nuit (2026-11-08), corrections RN-02 (reprise) à RN-12: un test court par règle.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { wireInterface } from '../src/branchement/interface';
import { jumpToDay } from '../src/clientele';
import { addGuestbook, guestbookLines } from '../src/clientele/clients';
import { ctxOf } from '../src/clientele';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { World } from '../src/etat/monde';
import { T } from '../src/interface/textes';
import { fill } from '../src/interface/typo';
import type { GameView } from '../src/reseau/vue';
import { restoreWorld, saveLabel, saveProgress } from '../src/session';
import { IDLE_INPUT } from '../src/simulation/entrees';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';
import { WORLD_FORMAT } from '../src/etat/monde';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);

function setup(seed = 3): {
  world: World;
  sim: SimContext;
  step: (intents?: QueuedIntent[]) => void;
} {
  const world = createWorld(content, ['a', 'b']);
  const random = createRandom(seed);
  const sim: SimContext = {
    world,
    content,
    dt: DT,
    random,
    inputs: [IDLE_INPUT, IDLE_INPUT],
    emit: () => undefined,
  };
  const step = (intents: QueuedIntent[] = []): void => {
    stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, () => undefined);
  };
  step();
  return { world, sim, step };
}

function viewOf(world: World, local: 0 | 1 = 0): GameView {
  return {
    content,
    local,
    world: () => world,
    pose: () => ({ x: 0, z: 0, yawDeg: 0, pitchDeg: 0 }),
    onEvent: () => () => undefined,
  };
}

describe('Deux Tabliers, corrections de la recette de nuit', () => {
  it('RN-02: une sauvegarde aux tickets orphelins se rouvre avec un rail vide', () => {
    const { world } = setup();
    for (let i = 0; i < 500; i++)
      world.service.tickets.push({
        id: 10_000 + i,
        customer: `g${String(90_000 + i)}`,
        articles: [{ recipe: 'espresso', options: [], price: 1.5, object: null }],
        taker: null,
        createdTick: 0,
        status: 'open',
        total: 1.5,
      });
    const data: unknown = JSON.parse(JSON.stringify(world));
    const restored = restoreWorld(data, WORLD_FORMAT, ['a', 'b']);
    expect(restored?.service.tickets).toEqual([]);
    expect(JSON.stringify(restored?.service).length).toBeLessThan(64 * 1024);
  });

  it('RN-03: la carte de la scène en cours revient depuis l’état (reprise, invité)', () => {
    const { world, sim } = setup();
    jumpToDay(sim, 4);
    world.clientele.event = {
      id: 'le_car_de_8h12',
      startedAt: 0,
      stage: 'waiting',
      flags: [],
      count: 0,
      holder: null,
      marks: [0, 0],
    };
    const wired = wireInterface(viewOf(world, 1));
    const scene = wired.sources.scene?.(world, 1) ?? null;
    expect(scene?.title).toBe('Le car de 8 h 12');
    expect(scene?.lines.join(' ')).toContain('car');
    // Fermée par le joueur, elle ne revient pas toute seule.
    wired.intents['scene-dismiss']?.({ type: 'scene-dismiss', id: 'scene-le_car_de_8h12' });
    expect(wired.sources.scene?.(world, 1) ?? null).toBeNull();
  });

  it('RN-04: l’emplacement dit le jour et l’adresse, la progression suit les jours', () => {
    const { world, sim } = setup();
    jumpToDay(sim, 9);
    expect(saveLabel(content, world)).toBe('Jour 9 (mardi), Ormeval');
    expect(saveProgress(content, world)).toBeCloseTo(9 / 15);
    world.clientele.houseName = 'La Tasse Bleue';
    expect(saveLabel(content, world)).toBe('Jour 9 (mardi), La Tasse Bleue');
  });

  it('RN-05: René attend « Partir » ou « Rester »', () => {
    expect([T.night.continue, T.night.finish]).toEqual(['Partir', 'Rester']);
  });

  it('RN-06: livre d’or sans doublon du jour ni fauteuil absent', () => {
    const { world, sim } = setup();
    jumpToDay(sim, 5);
    const ctx = ctxOf(sim);
    addGuestbook(ctx, 'Mes clés sont entre de bonnes mains.', 'S.', true);
    addGuestbook(ctx, 'Mes clés sont entre de bonnes mains.', 'S.', true);
    expect(world.clientele.guestbook.filter((w) => w.day === 5)).toHaveLength(1);
    const ambiance = content.clientele.texts.guestbook.positive.ambiance ?? [];
    const sansFauteuil = guestbookLines(ctx, ambiance);
    expect(sansFauteuil.some((l) => l.includes('fauteuil'))).toBe(false);
    world.furniture.push({
      id: 'test-fauteuil',
      type: 'fauteuil-crapaud',
      x: 0,
      z: 0,
      y: 0,
      rotDeg: 0,
    });
    expect(guestbookLines(ctx, ambiance).some((l) => l.includes('fauteuil'))).toBe(true);
  });

  it('RN-07: la puce suit la page que lit l’autre', () => {
    const { world, step } = setup(9);
    const both = (topic: 'next-day' | 'open'): void => {
      step([
        { player: 0, intent: { type: 'clientele-vote', topic, yes: true } },
        { player: 1, intent: { type: 'clientele-vote', topic, yes: true } },
      ]);
    };
    both('next-day');
    both('open');
    for (let i = 0; i < 60 * 60 * 15 && world.clientele.phase !== 'evening'; i++) step();
    expect(world.clientele.phase).toBe('evening');
    const wired = wireInterface(viewOf(world, 0));
    const intent = wired.intents['evening-page']?.({ type: 'evening-page', page: 3 }) ?? null;
    expect(intent).not.toBeNull();
    if (intent !== null) step([{ player: 1, intent }]);
    expect(wired.sources.evening?.(world, 0)?.partner).toEqual({ kind: 'reading', page: 3 });
  });

  it('RN-08: « Le car de 8 h 12 » une seule fois sous « Aujourd’hui »', () => {
    const { world, sim } = setup();
    jumpToDay(sim, 4);
    expect(world.clientele.phase).toBe('prep');
    const today = wireInterface(viewOf(world)).sources.morning?.(world, content)?.today ?? [];
    expect(today.filter((l) => l === 'Le car de 8 h 12')).toHaveLength(1);
  });

  it('RN-09: élision devant un prénom à voyelle', () => {
    expect(fill("un achat attend l'accord de {partner}", { partner: 'Alex' })).toBe(
      "un achat attend l'accord d'Alex",
    );
    expect(fill("tant que {partner} n'a pas choisi", { partner: 'Émilie' })).toBe(
      "tant qu'Émilie n'a pas choisi",
    );
    expect(fill('En attente de {partner}...', { partner: 'Sacha' })).toBe('En attente de Sacha...');
    expect(fill('passage de {n} cm', { n: 80 })).toBe('passage de 80 cm');
  });

  it('RN-12: Octave ne compte plus en minutes ce qui dure 75 s', () => {
    const car = content.clientele.events.get('le_car_de_8h12');
    const texts = [car?.announce ?? '', ...(car?.scene ?? []).map((l) => l.text)].join(' ');
    expect(texts).not.toMatch(/minute/i);
  });
});
