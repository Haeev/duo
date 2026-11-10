// Pose couchée d'un dormeur (brique `sleep`): elle vient de la fiche du meuble, pas du moteur.
import { describe, expect, it } from 'vitest';
import { type LyingPose, lyingPose } from '../../src/rendu/personnages/allonge';
import { gameContent, newSim } from '../aides';
import { contentWith, NORTH, put, send } from '../aides-noyau';

const FALLBACK = { height: 0.9, pillowInset: 0.35 };
const HEAD = 1.58;

function poseOf(sim: ReturnType<typeof newSim>, index: 0 | 1): LyingPose | null {
  const place = sim.world.places[sim.world.common.place];
  if (place === undefined) throw new Error('lieu absent');
  const out = { x: 0, y: 0, facing: 0, height: 0 };
  return lyingPose(sim.content, sim.world, place, index, HEAD, FALLBACK, out);
}

describe('pose couchée', () => {
  it('couche les deux dormeurs du lit double de la gare côte à côte, tête sur l’oreiller', () => {
    const content = gameContent();
    const bed = content.props['lit-double'];
    const lie = bed?.bricks.find((b) => b.brick === 'sleep');
    if (lie?.brick !== 'sleep' || lie.lie === undefined)
      throw new Error('pose absente de la fiche');
    expect(bed?.model).toBe('bed-double');
    const sim = newSim(content);
    // Le lit de la gare: 2 x 2 m au milieu de (17,5; 14), façade au sud.
    expect(poseOf(sim, 0)).toBeNull();
    put(sim, 0, 17, 15.6, NORTH);
    put(sim, 1, 18, 15.6, NORTH);
    send(sim, 0, { type: 'use_brick', target: 'lit-double-de-gare', brick: 'sleep' });
    send(sim, 1, { type: 'use_brick', target: 'lit-double-de-gare', brick: 'sleep' });
    const a = poseOf(sim, 0);
    const b = poseOf(sim, 1);
    if (a === null || b === null) throw new Error('les deux devraient être couchés');
    // Pieds vers la façade (sud), donc tête au nord, sur l'oreiller à 0,7 m du milieu.
    expect(a.facing).toBeCloseTo(Math.PI / 2);
    expect(a.y - HEAD).toBeCloseTo(14 - lie.lie.pillow);
    // Pieds dans le lit (bord du pied à 15 m), dos sur le couchage, places à l'écart de la fiche.
    expect(a.y).toBeLessThan(15);
    expect(a.height).toBe(lie.lie.height);
    expect(b.x - a.x).toBeCloseTo(lie.lie.spacing);
    expect((a.x + b.x) / 2).toBeCloseTo(17.5);
  });

  it('suit la fiche d’un meuble factice tourné, sans rien changer au moteur', () => {
    const content = contentWith(
      [
        {
          id: 'hamac-essai',
          size: { w: 1, h: 2 },
          bricks: [
            {
              brick: 'sleep',
              places: 1,
              wakeAt: 80,
              lie: { height: 1.1, pillow: 0.8, spacing: 0 },
            },
          ],
        },
      ],
      [{ id: 'hamac', type: 'hamac-essai', x: 30, y: 20, rotation: 1 }],
    );
    const sim = newSim(content);
    put(sim, 0, 31.6, 20, Math.PI);
    send(sim, 0, { type: 'use_brick', target: 'hamac', brick: 'sleep' });
    const pose = poseOf(sim, 0);
    if (pose === null) throw new Error('couché attendu');
    // Façade à l'est: pieds à l'est, tête à l'ouest sur l'oreiller.
    expect(pose.facing).toBeCloseTo(0);
    expect(pose.x - HEAD).toBeCloseTo(30 - 0.8);
    expect(pose.y).toBeCloseTo(20);
    expect(pose.height).toBe(1.1);
  });
});
