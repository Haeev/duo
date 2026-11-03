// Gestes (demande du 2026-11-03: « les animations doivent correspondre à ce que font les
// personnages »): chaque action a un clip qui existe chez l'artiste, et la foulée mesurée sur un
// clip fait tenir le pied posé immobile au sol.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AnimationClip, Bone, Group, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { plantedFootSpeed } from './foulee';
import { CLIP_FOR_ACTION } from './gestes';
import { RENDER_SETTINGS } from './reglages';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const SETTINGS = RENDER_SETTINGS.characters;

/** Noms des clips de `personnages.glb` (bloc JSON du fichier de l'artiste). */
function clipNames(): Set<string> {
  const path = fileURLToPath(new URL('../../assets/modeles/personnages.glb', import.meta.url));
  const data = readFileSync(path);
  const length = data.readUInt32LE(GLB_HEADER);
  const json = JSON.parse(
    data.subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + length).toString('utf8'),
  ) as { animations?: { name?: string }[] };
  return new Set((json.animations ?? []).map((animation) => animation.name ?? ''));
}

describe('clip joué par action', () => {
  it('chaque action, s’asseoir et se lever, porter seul, boire, la poussée de la draisine et les travaux des habitants ont leur clip', () => {
    const names = clipNames();
    const wanted = [
      ...Object.entries(CLIP_FOR_ACTION).map(([action, clip]) => [`action ${action}`, clip] as const),
      ['poussée à l’arrêt', SETTINGS.push.stillClip] as const,
      ['travail par défaut', SETTINGS.villagerWorkDefault] as const,
      ['s’asseoir', SETTINGS.posture.sitDown] as const,
      ['se lever', SETTINGS.posture.standUp] as const,
      ['porter seul en marchant', SETTINGS.carryOne.walk] as const,
      ['porter seul à l’arrêt', SETTINGS.carryOne.idle] as const,
      ['boire', SETTINGS.drinkClip] as const,
      ['traire', SETTINGS.milkClip] as const,
      ...Object.entries(SETTINGS.villagerWork).map(([post, clip]) => [`travail à ${post}`, clip] as const),
    ];
    for (const [what, clip] of wanted) expect(names.has(clip), `${what}: ${clip}`).toBe(true);
  });

  it('cuisiner et remplir ne jouent plus des gestes contraires (tendre un objet, vider l’arrosoir)', () => {
    expect(CLIP_FOR_ACTION.cook).not.toBe('give');
    expect(CLIP_FOR_ACTION.refill).not.toBe('water');
  });
});

describe('foulée mesurée sur un clip', () => {
  it('la cheville posée recule à la vitesse du clip; levée, elle ne compte pas', () => {
    // Pas synthétique de 1 s: la cheville posée (y = 0,1) recule de 0,8 m en 0,5 s, puis revient en l'air.
    const rig = new Group();
    const foot = new Bone();
    foot.name = 'foot_l';
    rig.add(foot);
    const track = new VectorKeyframeTrack(
      'foot_l.position',
      [0, 0.5, 0.75, 1],
      [0, 0.1, 0.4, 0, 0.1, -0.4, 0, 0.4, 0, 0, 0.1, 0.4],
    );
    const clip = new AnimationClip('pas', 1, [track]);
    expect(plantedFootSpeed(rig, clip, ['foot_l'], 40)).toBeCloseTo(1.6, 1);
    expect(plantedFootSpeed(rig, clip, ['absent'], 40)).toBeNull();
  });
});
