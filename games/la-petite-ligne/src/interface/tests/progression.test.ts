// Barre de progression (R10) et invite du survol (R11), lues dans l'état de la vraie simulation:
// durée réelle de la fabrication, avancée des chantiers vue chez les deux, coups portés à un arbre.
import { describe, expect, it } from 'vitest';
import type { AimVerb } from '../../etat/types';
import { secondsToTicks } from '../../simulation/contexte';
import { placeCharacter } from '../../simulation/deplacement';
import { step } from '../../simulation/pas';
import { addToBag } from '../../simulation/sac';
import { aimPromptModel, progressModel } from '../modele-progression';
import { apply, character, playUntil, started, uiContext } from './aides';

/** Jour 1, scène d'arrivée passée, l'horloge en marche. */
function day(): ReturnType<typeof started> {
  const sim = started();
  playUntil(sim, (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null);
  return sim;
}

function idle(
  sim: ReturnType<typeof started>,
  ticks: number,
  held: { p1?: boolean; p2?: boolean } = {},
): void {
  for (let i = 0; i < ticks; i++) {
    step(sim, {
      controls: {
        p1: { seq: i, moveX: 0, moveY: 0, actHeld: held.p1 === true },
        p2: { seq: i, moveX: 0, moveY: 0, actHeld: held.p2 === true },
      },
      intents: [],
    });
  }
}

describe('barre de progression', () => {
  it('fabrication à l’établi: l’avancée suit la durée de la recette dans la simulation, puis la barre part', () => {
    const sim = day();
    const me = character(sim, 'p1');
    const bench = sim.map.points.sawmill_workbench;
    if (bench === undefined) throw new Error('établi absent');
    placeCharacter(sim, me, bench);
    placeCharacter(sim, character(sim, 'p2'), { x: bench.x + 6, y: bench.y + 6 });
    addToBag(sim, me, 'log', 'ordinary', 1);
    apply(sim, 'p1', { type: 'craft', recipe: 'saw_plank' });
    const recipe = sim.content.recipes.saw_plank;
    if (recipe === undefined) throw new Error('recette absente');
    expect(me.crafting?.recipe).toBe('saw_plank');
    expect(me.action.duration).toBe(secondsToTicks(recipe.seconds));
    const ctx = uiContext('p1');
    const half = Math.floor(me.action.duration / 2);
    idle(sim, half);
    const model = progressModel(sim.world, ctx);
    expect(model).toMatchObject({ kind: 'craft', icon: 'plank', together: false });
    expect(model?.label.replace(/[\u00a0\u202f]/g, ' ')).toBe('À l’établi : Scier des planches');
    expect(model?.ratio).toBeCloseTo((sim.world.tick - me.action.since) / me.action.duration, 6);
    expect(model?.ratio).toBeGreaterThan(0.4);
    expect(model?.ratio).toBeLessThan(0.6);
    // L'autre ne voit pas la fabrication de l'un dans sa barre (elle est dite par la carte de l'autre).
    expect(progressModel(sim.world, uiContext('p2'))).toBeNull();
    idle(sim, me.action.duration);
    expect(me.crafting).toBeNull();
    expect(progressModel(sim.world, ctx)).toBeNull();
  });

  it('chantier de la porte: visible chez les deux, « à deux » quand les deux bâtissent, l’avancée vient de l’élément', () => {
    const sim = day();
    const door = sim.map.points.house_door;
    if (door === undefined) throw new Error('porte absente');
    // Mains libres: un outil en main viserait la case (bêcher) et l'action tenue ne bâtirait pas.
    for (const id of ['p1', 'p2'] as const) {
      const c = character(sim, id);
      c.selected = c.bag.findIndex((s, i) => s === null && i < 10);
    }
    placeCharacter(sim, character(sim, 'p1'), { x: door.x, y: door.y + 1 });
    placeCharacter(sim, character(sim, 'p2'), { x: door.x + 0.8, y: door.y + 1 });
    // Sacha seule: Camille voit la barre, au nom de Sacha.
    idle(sim, 30, { p2: true });
    const element = sim.world.constructions.find((k) => k.id === 'house_door')?.elements[0];
    if (element === undefined) throw new Error('élément de la porte absent');
    expect(element.workers).toEqual(['p2']);
    const seen = progressModel(sim.world, uiContext('p1'));
    expect(seen).toMatchObject({ kind: 'build', together: false });
    expect(seen?.label).toContain('Sacha');
    expect(seen?.label).toContain('Porte de la maisonnette');
    expect(seen?.ratio).toBeCloseTo(element.progress, 6);
    expect(progressModel(sim.world, uiContext('p2'))?.label).toBe('Porte de la maisonnette');
    // À deux: les deux barres disent « à deux » et montrent la même avancée.
    idle(sim, 30, { p1: true, p2: true });
    const a = progressModel(sim.world, uiContext('p1'));
    const b = progressModel(sim.world, uiContext('p2'));
    expect(a).toMatchObject({ kind: 'build', together: true });
    expect(a?.label).toContain('à deux');
    expect(a?.ratio).toBe(b?.ratio);
    expect(a?.ratio).toBeCloseTo(element.progress, 6);
    // Relâché: plus de barre.
    idle(sim, 1);
    expect(progressModel(sim.world, uiContext('p1'))).toBeNull();
  });

  it('arbre entamé près de soi: les coups portés sur ceux qu’il faut, puis la barre s’efface', () => {
    const sim = day();
    const me = character(sim, 'p1');
    const tree = sim.world.trees.find((t) => !t.felled);
    if (tree === undefined) throw new Error('arbre absent');
    placeCharacter(sim, me, { x: tree.pos.x + 1, y: tree.pos.y });
    tree.hits = 1;
    tree.lastHitTick = sim.world.tick;
    const total = sim.content.settings.trees.chopsPerTree;
    const model = progressModel(sim.world, uiContext('p1'));
    expect(model).toMatchObject({ kind: 'chop', icon: 'axe' });
    expect(model?.ratio).toBeCloseTo(1 / total, 6);
    expect(model?.label).toContain(`1 coups de hache sur ${total}`);
    idle(sim, secondsToTicks(3));
    expect(progressModel(sim.world, uiContext('p1'))).toBeNull();
  });

  it('un geste long (manger, 2 s) a sa barre; un geste bref (bêcher, 0,5 s) n’en a pas', () => {
    const sim = day();
    const me = character(sim, 'p1');
    me.action = { kind: 'eat', since: sim.world.tick, duration: secondsToTicks(2), target: null };
    idle(sim, secondsToTicks(1));
    const model = progressModel(sim.world, uiContext('p1'));
    expect(model).toMatchObject({ kind: 'gesture', label: 'Tu manges', icon: 'bread' });
    expect(model?.ratio).toBeCloseTo(0.5, 1);
    me.action = {
      kind: 'till',
      since: sim.world.tick,
      duration: secondsToTicks(0.5),
      target: null,
    };
    expect(progressModel(sim.world, uiContext('p1'))).toBeNull();
  });
});

describe('invite du survol', () => {
  it('seulement pour la cible survolée à la souris, avec ce que fera le clic', () => {
    const sim = day();
    const me = character(sim, 'p1');
    const ctx = uiContext('p1');
    me.aim = { cell: { cx: 8, cy: 28 }, verb: 'harvest', blocked: null, source: 'pointer' };
    expect(aimPromptModel(sim.world, ctx)).toEqual({ key: 'clic', text: 'Récolter' });
    me.aim = { cell: { cx: 8, cy: 28 }, verb: 'harvest', blocked: null };
    expect(aimPromptModel(sim.world, ctx)).toBeNull();
    me.aim = { cell: { cx: 8, cy: 28 }, verb: null, blocked: null, source: 'pointer' };
    expect(aimPromptModel(sim.world, ctx)).toBeNull();
  });

  it('chaque verbe de visée a son texte, sans tiret long', () => {
    const all: Record<AimVerb, true> = {
      fish: true,
      till: true,
      sow: true,
      water: true,
      harvest: true,
      chop: true,
      refill: true,
      talk: true,
      pickup: true,
      build: true,
      carry: true,
      open: true,
      sleep: true,
      feed: true,
      place: true,
      give: true,
      dig: true,
      sit: true,
      hold: true,
      call: true,
    };
    const verbs = uiContext().texts.extra.aim.verbs;
    for (const verb of Object.keys(all)) {
      expect(verbs[verb], verb).toBeTruthy();
      expect(verbs[verb], verb).not.toMatch(/[\u2013\u2014]/u);
    }
  });
});
