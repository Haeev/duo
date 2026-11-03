// R18 (0.12.2): à 13 h, les produits restés sur l'étal s'enfoncent dans leurs cagettes puis
// disparaissent (geste de rangement), au lieu de s'évanouir d'une image à l'autre.
import { Group, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ReadonlyWorld } from '../etat/types';
import { contentAndMap, newSim } from '../../tests/aides';
import type { FrameContext } from './contexte';
import { MarketPart } from './marche';
import type { ModelLibrary } from './modeles';
import type { Terrain } from './terrain';

/** Bibliothèque réduite à ce que lit `MarketPart`: des groupes vides nommés, des cases pour les cagettes. */
function stubLibrary(): ModelLibrary {
  const stub = {
    has: (): boolean => true,
    instantiate: (name: string): Object3D => {
      const g = new Group();
      g.name = name;
      return g;
    },
    extras: (name: string): Record<string, unknown> =>
      name === 'market_stall'
        ? {
            crate_spots: [
              [-0.4, 0.8, 0],
              [0, 0.8, 0],
              [0.4, 0.8, 0],
              [0.8, 0.8, 0],
            ],
          }
        : { goods_height: 0.02 },
  };
  // Seules ces trois méthodes servent à l'étal: le reste de la bibliothèque (chargement des GLB) n'existe pas dans Node.
  return stub as unknown as ModelLibrary;
}

const flat = { heightAt: (): number => 0 } as unknown as Terrain;

function frame(world: ReadonlyWorld, time: number, reducedMotion = false): FrameContext {
  return {
    world,
    alpha: 0,
    dt: 1 / 60,
    time,
    local: 'p1',
    quarter: 0,
    shownYaw: 0,
    night: 0,
    reducedMotion,
  };
}

function goods(part: MarketPart): Object3D[] {
  const out: Object3D[] = [];
  part.group.traverse((o) => {
    if (o.name === 'radish') out.push(o);
  });
  return out;
}

describe('R18: l’étal se range à la fermeture', () => {
  function sundayStall(): {
    part: MarketPart;
    world: ReturnType<typeof newSim>['world'];
    closes: number;
  } {
    const { content, map } = contentAndMap();
    const sim = newSim();
    const m = content.market;
    if (m === null) throw new Error('marché absent');
    const world = sim.world;
    world.flags.push(m.enabledFlag);
    world.market = {
      day: world.clock.day,
      level: 'fair',
      stall: [{ item: 'radish', quality: 'ordinary', count: 3 }],
      buyers: [],
    };
    world.clock.minutes = m.closes - 1;
    return { part: new MarketPart(map, content, stubLibrary(), flat), world, closes: m.closes };
  }

  it('à 13 h, les produits descendent et rapetissent pendant 0,7 s, puis l’étal est vide', () => {
    const { part, world, closes } = sundayStall();
    part.update(frame(world, 0));
    const shown = goods(part);
    expect(shown).toHaveLength(3);
    const restY = shown[0]?.position.y ?? 0;
    // L'étal ferme: la simulation a tout rapporté au coffre.
    world.clock.minutes = closes;
    world.market = { ...(world.market ?? { day: 0, level: 'fair', buyers: [] }), stall: [] };
    part.update(frame(world, 10));
    part.update(frame(world, 10.35));
    expect(goods(part)).toHaveLength(3);
    for (const g of goods(part)) {
      expect(g.position.y).toBeLessThan(restY);
      expect(g.scale.x).toBeGreaterThan(0.2);
      expect(g.scale.x).toBeLessThan(0.8);
    }
    part.update(frame(world, 10.8));
    expect(goods(part)).toHaveLength(0);
    // Plus rien ne bouge ensuite (pas de second rangement).
    part.update(frame(world, 11));
    expect(goods(part)).toHaveLength(0);
  });

  it('mouvement réduit: l’étal se vide aussitôt', () => {
    const { part, world, closes } = sundayStall();
    part.update(frame(world, 0, true));
    world.clock.minutes = closes;
    world.market = { ...(world.market ?? { day: 0, level: 'fair', buyers: [] }), stall: [] };
    part.update(frame(world, 10, true));
    expect(goods(part)).toHaveLength(0);
  });

  it('avant 13 h, un produit repris par un joueur disparaît aussitôt (ce n’est pas la fermeture)', () => {
    const { part, world } = sundayStall();
    part.update(frame(world, 0));
    world.market = { ...(world.market ?? { day: 0, level: 'fair', buyers: [] }), stall: [] };
    part.update(frame(world, 1));
    expect(goods(part)).toHaveLength(0);
  });
});
