// Coucher (retour R05): tête du côté de la tête de lit, pour chaque lit et chaque sens de pose.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { yawFromFacing, yawFromQuarter } from './contexte';
import { sleepPose, type SleepPose } from './coucher';
import { RENDER_SETTINGS } from './reglages';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;

/** Extras glTF d'un nœud de `maison.glb` (données de l'artiste: places, hauteur de couche). */
function extrasOf(name: string): Record<string, unknown> {
  const path = fileURLToPath(new URL('../../assets/modeles/maison.glb', import.meta.url));
  const data = readFileSync(path);
  const length = data.readUInt32LE(GLB_HEADER);
  const json = JSON.parse(
    data.subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + length).toString('utf8'),
  ) as { nodes: { name?: string; extras?: Record<string, unknown> }[] };
  return json.nodes.find((node) => node.name === name)?.extras ?? {};
}

const BEDS = [
  { item: 'straw_mattress', footprint: { w: 1, d: 2 } },
  { item: 'double_bed', footprint: { w: 2, d: 2 } },
] as const;
/** Tête du dormeur dans son propre repère: vers -Z, à 0,8 m du bassin (clip `sleep`). */
const HEAD_LOCAL_Z = -0.8;

/** Point (x, z du modèle) tourné par un lacet Three.js autour de Y. */
function turn(x: number, z: number, yaw: number): { x: number; y: number } {
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), y: -x * Math.sin(yaw) + z * Math.cos(yaw) };
}

describe('pose couchée (R05)', () => {
  for (const bed of BEDS) {
    const extras = extrasOf(bed.item);
    it(`${bed.item}: le modèle donne sa hauteur de couche`, () => {
      expect(typeof extras.sleep_height).toBe('number');
    });
    for (let rotation = 0; rotation < 4; rotation += 1) {
      it(`${bed.item}, rotation ${String(rotation)}: tête à la tête de lit, corps dans le lit`, () => {
        const placement = { cell: { cx: 10, cy: 20 }, rotation };
        const turned = rotation % 2 !== 0;
        const w = turned ? bed.footprint.d : bed.footprint.w;
        const d = turned ? bed.footprint.w : bed.footprint.d;
        const centre = { x: 10 + w / 2, y: 20 + d / 2 };
        const bedYaw = yawFromQuarter(rotation);
        // Tête de lit: -Z du modèle (vérifié sur les GLB: dosseret du lit double, oreiller de la paillasse).
        const headboard = turn(0, -1, bedYaw);
        const sides = bed.item === 'double_bed' ? [-0.45, 0.45] : [0];
        const places: SleepPose[] = [];
        for (const side of sides) {
          const pose = sleepPose(
            placement,
            bed.footprint,
            extras,
            { x: centre.x + side, y: centre.y },
            RENDER_SETTINGS.characters.sleepClipBackHeight,
            { x: 0, y: 0, facing: 0, lift: 0 },
          );
          places.push(pose);
          const head = turn(0, HEAD_LOCAL_Z, yawFromFacing(pose.facing));
          // La tête part vers la tête de lit.
          expect(head.x * headboard.x + head.y * headboard.y).toBeGreaterThan(0.7);
          // Bassin et tête dans l'emprise du lit.
          for (const p of [pose, { x: pose.x + head.x, y: pose.y + head.y }]) {
            expect(p.x).toBeGreaterThan(10);
            expect(p.x).toBeLessThan(10 + w);
            expect(p.y).toBeGreaterThan(20);
            expect(p.y).toBeLessThan(20 + d);
          }
          // Couché sur la couche: la paillasse est plus basse que le lit double.
          expect(pose.lift).toBeCloseTo(
            (extras.sleep_height as number) - RENDER_SETTINGS.characters.sleepClipBackHeight,
            6,
          );
        }
        if (places.length === 2) {
          const [a, b] = places;
          // Deux places distinctes, côte à côte en travers du lit.
          expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThan(
            0.5,
          );
        }
      });
    }
  }
});
