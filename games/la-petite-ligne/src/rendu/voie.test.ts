import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TrainPhase } from '../etat/types';
import { RENDER_SETTINGS } from './reglages';
import { GATE_ARM, GATE_CLOSED, GATE_OPEN, gateAngleStep, trainOffset, trainSlides } from './voie';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
/** Une image à 60 Hz. */
const FRAME = 1 / 60;
/** Six secondes d'images: le bras a fini de bouger (demi-vie de 0,35 s). */
const SETTLE_FRAMES = 360;

/** Noms des nœuds de `bourg.glb` et de leurs enfants. */
function glbNodes(): { name: string; children: string[] }[] {
  const path = fileURLToPath(new URL('../../assets/modeles/bourg.glb', import.meta.url));
  const data = readFileSync(path);
  const length = data.readUInt32LE(GLB_HEADER);
  const json = JSON.parse(
    data.subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + length).toString('utf8'),
  ) as { nodes: { name?: string; children?: number[] }[] };
  return json.nodes.map((node) => ({
    name: node.name ?? '',
    children: (node.children ?? []).map((index) => json.nodes[index]?.name ?? ''),
  }));
}

function settle(angle: number, phase: TrainPhase): number {
  let a = angle;
  for (let i = 0; i < SETTLE_FRAMES; i += 1) {
    a = gateAngleStep(a, phase, FRAME, false);
  }
  return a;
}

const STEPS = 50;
/** Pente maximale des courbes d'accélération cubiques. */
const CUBIC_SLOPE = 3;

/** Positions du train à chaque pas d'une phase, `progress` évoluant comme dans la simulation. */
function positions(phase: 'arriving' | 'departing'): number[] {
  const out: number[] = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS;
    out.push(trainOffset(phase, phase === 'arriving' ? t : 1 - t));
  }
  return out;
}

describe('glissement du train (retour R06: il ne repart jamais à reculons)', () => {
  const travel = RENDER_SETTINGS.train.travel;
  const distance = RENDER_SETTINGS.train.slideDistance;

  it('arrive de l’amont et s’arrête au quai, en roulant toujours dans son sens de marche', () => {
    const xs = positions('arriving');
    expect(xs[0]).toBeCloseTo(-travel * distance, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(0, 6);
    for (let i = 1; i < xs.length; i += 1) {
      // Chaque pas avance dans le sens de marche (jamais de recul).
      expect(((xs[i] ?? 0) - (xs[i - 1] ?? 0)) * travel).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('repart du quai sans saut et continue tout droit vers l’aval (l’ouest, comme le son)', () => {
    const xs = positions('departing');
    expect(travel).toBe(-1);
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(travel * distance, 6);
    for (let i = 1; i < xs.length; i += 1) {
      expect(((xs[i] ?? 0) - (xs[i - 1] ?? 0)) * travel).toBeGreaterThanOrEqual(-1e-9);
    }
    // Pas de saut: le premier pas est minuscule (le train démarre doucement), et aucun pas ne
    // dépasse la pente maximale d'une courbe cubique (trois fois le pas moyen).
    expect(Math.abs(xs[1] ?? 0)).toBeLessThan(distance / STEPS);
    for (let i = 1; i < xs.length; i += 1) {
      expect(Math.abs((xs[i] ?? 0) - (xs[i - 1] ?? 0))).toBeLessThanOrEqual(
        (CUBIC_SLOPE * distance) / STEPS + 1e-9,
      );
    }
  });

  it('arrive et repart par les deux bouts opposés de la carte, entièrement dehors', () => {
    // Le train de la carte: arrêt en x 38,5, queue 11,75 m derrière, tête 12,15 m devant.
    const stop = 38.5;
    const width = 100;
    const slides = trainSlides(stop, -11.75, 12.15, width);
    const clearance = RENDER_SETTINGS.train.offMapClearance;
    const start = trainOffset('arriving', 0, slides);
    const end = trainOffset('departing', 0, slides);
    // Début de l'arrivée: la tête (vers l'ouest) est au-delà du bord est.
    expect(stop + start + travel * 12.15).toBeGreaterThanOrEqual(width + clearance - 1e-6);
    // Fin du départ: la queue est au-delà du bord ouest.
    expect(stop + end + travel * -11.75).toBeLessThanOrEqual(-clearance + 1e-6);
    expect(Math.sign(start)).toBe(-travel);
    expect(Math.sign(end)).toBe(travel);
  });

  it('n’est pas dessiné une fois parti, et reste au quai à l’arrêt', () => {
    expect(Number.isNaN(trainOffset('away', 0))).toBe(true);
    expect(trainOffset('stopped', 1)).toBe(0);
  });
});

describe('barrières du passage à niveau', () => {
  it('trouvent le bras dans le modèle de l’artiste (sinon il reste figé)', () => {
    const gate = glbNodes().find((node) => node.name === 'level_crossing_gate');
    expect(gate?.children).toContain(GATE_ARM);
  });

  it('se baissent quand le train arrive et se relèvent à quai puis une fois parti', () => {
    const away = settle(GATE_OPEN, 'away');
    expect(away).toBeCloseTo(GATE_OPEN, 3);
    const arriving = settle(away, 'arriving');
    expect(arriving).toBeCloseTo(GATE_CLOSED, 3);
    // Le bras bouge dès la première image, sans saut.
    const first = gateAngleStep(away, 'arriving', FRAME, false);
    expect(first).toBeLessThan(away);
    expect(first).toBeGreaterThan(GATE_CLOSED);
    const stopped = settle(arriving, 'stopped');
    expect(stopped).toBeCloseTo(GATE_OPEN, 3);
    expect(settle(stopped, 'departing')).toBeCloseTo(GATE_CLOSED, 3);
  });

  it('change d’un coup avec le mouvement réduit', () => {
    expect(gateAngleStep(GATE_OPEN, 'arriving', FRAME, true)).toBeCloseTo(GATE_CLOSED, 9);
  });
});
