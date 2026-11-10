// Descente du train et accueil: les deux joueurs sur la paire écartée du lieu, face au lieu, et
// l'habitant envoyé « sur le quai » par une scène s'arrête en face d'eux, à distance de conversation.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { HOOKS } from '../src/simulation/quetes/crochets';
import { detourAround, queueScene } from '../src/simulation/scenes/lecteur';
import { SCENE_STAGING } from '../src/simulation/scenes/reglages';
import { arrivalFrame } from '../src/simulation/voyage/arrivee';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

function startAt(place: string): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
    settings.start = { ...settings.start, place, minute: 600 };
  });
}

function gap(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('arrivée dans un lieu', () => {
  it('les deux joueurs descendent côte à côte, à 1,2 m, face au lieu', () => {
    for (const place of ['aubrune', 'train-de-nuit']) {
      const sim = newSim(startAt(place));
      const [a, b] = sim.world.players;
      const frame = arrivalFrame(sim.content.places[place] ?? expect.unreachable());
      expect(frame).not.toBeNull();
      expect(gap(a.body, b.body)).toBeCloseTo(1.2, 5);
      // Côte à côte: la ligne qui les joint est perpendiculaire à leur regard commun.
      const along = (b.body.x - a.body.x) * Math.cos(a.body.facing);
      expect(Math.abs(along + (b.body.y - a.body.y) * Math.sin(a.body.facing))).toBeLessThan(1e-6);
      expect(a.body.facing).toBe(b.body.facing);
      expect(a.body.facing).toBe(frame?.facing);
    }
  });

  it("l'habitant de la scène d'accueil se tient en face, à 1,5 à 2 m, sans chevaucher personne", () => {
    const sim = newSim(startAt('aubrune'));
    wait(sim, 0.5);
    // La quête d'arrivée la lance d'elle-même; sinon on la demande.
    const story = sim.world.common.story;
    if (
      story?.scene?.id !== 'firmin-en-pantoufles' &&
      !story?.queue.includes('firmin-en-pantoufles')
    )
      expect(queueScene(contextOf(sim), 'firmin-en-pantoufles', 0, HOOKS)).toBe(true);
    let seen = false;
    let closest = Infinity;
    const ended: { at: { x: number; y: number; facing: number } | null } = { at: null };
    const [a, b] = sim.world.players;
    const mid = { x: (a.body.x + b.body.x) / 2, y: (a.body.y + b.body.y) / 2 };
    const firminBody = (): { x: number; y: number; facing: number } =>
      sim.world.places.aubrune?.villagers.firmin?.body ?? expect.unreachable();
    // Pas à pas d'un dixième de seconde: aucun instant où Firmin chevauche un joueur.
    const watch = (seconds: number): void => {
      for (let t = 0; t < seconds * 10; t++) {
        wait(sim, 0.1);
        closest = Math.min(closest, gap(firminBody(), a.body), gap(firminBody(), b.body));
        if (seen && ended.at === null && !sim.world.common.story?.scene)
          ended.at = { ...firminBody() };
      }
    };
    for (let i = 0; i < 40 && sim.world.common.story?.scene; i++) {
      seen ||= sim.world.common.story.scene.id === 'firmin-en-pantoufles';
      for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
      watch(1);
    }
    expect(seen).toBe(true);
    const firmin = ended.at ?? expect.unreachable();
    const talk = gap(firmin, mid);
    expect(talk).toBeGreaterThanOrEqual(1.5);
    expect(talk).toBeLessThanOrEqual(2);
    expect(gap(firmin, a.body)).toBeGreaterThanOrEqual(1.2);
    expect(gap(firmin, b.body)).toBeGreaterThanOrEqual(1.2);
    // En face: du côté où regardent les joueurs, et tourné vers eux.
    const ahead =
      (firmin.x - mid.x) * Math.cos(a.body.facing) + (firmin.y - mid.y) * Math.sin(a.body.facing);
    expect(ahead).toBeGreaterThan(1);
    expect(Math.cos(firmin.facing - a.body.facing)).toBeLessThan(-0.7);
    // Après la scène, il rejoint son poste en contournant les joueurs (corps de 0,3 m).
    watch(20);
    expect(closest).toBeGreaterThanOrEqual(0.6);
  });

  it("la première réplique d'accueil arrive en moins de 4,5 s: la marche de Firmin presse le pas", () => {
    // Avant ce réglage: 9,6 s de marche sans rien à lire (8,3 s sans le contournement).
    const sim = newSim(startAt('aubrune'));
    let startedAt: number | null = null;
    let saidAt: number | null = null;
    for (let i = 0; i < 300 && saidAt === null; i++) {
      wait(sim, 0.1);
      const run = sim.world.common.story?.scene;
      if (run?.id !== 'firmin-en-pantoufles') continue;
      startedAt ??= i;
      const beat = sim.content.places.aubrune?.scenes[run.id]?.beats[run.beat];
      if (beat?.do === 'say') saidAt = i;
    }
    expect(startedAt).not.toBeNull();
    expect(saidAt).not.toBeNull();
    expect(((saidAt ?? 0) - (startedAt ?? 0)) / 10).toBeLessThan(
      SCENE_STAGING.walkBudgetSeconds + 0.5,
    );
  });

  it('le détour autour des joueurs arrive toujours, sans jamais les chevaucher', () => {
    // Paire écartée de 1,2 m, tournée d'un angle quelconque; départs tout autour, arrivées sur
    // chaque place que `stageSpot` peut donner (à 1,7 m du milieu, à 1,2 m de chacun au moins).
    const { talkDistance, playerClearance, steps } = SCENE_STAGING;
    for (const turn of [0, 0.7, Math.PI / 2]) {
      const a = { x: -0.6 * Math.cos(turn), y: -0.6 * Math.sin(turn) };
      const b = { x: 0.6 * Math.cos(turn), y: 0.6 * Math.sin(turn) };
      for (let k = 0; k < steps; k++) {
        const angle = (2 * Math.PI * k) / steps;
        const to = { x: Math.cos(angle) * talkDistance, y: Math.sin(angle) * talkDistance };
        if (gap(to, a) < playerClearance || gap(to, b) < playerClearance) continue;
        for (let f = 0; f < 24; f++) {
          const pos = { x: 8 * Math.cos((f * Math.PI) / 12), y: 8 * Math.sin((f * Math.PI) / 12) };
          let travelled = 0;
          let closest = Infinity;
          while (gap(pos, to) > 1e-6 && travelled < 30) {
            const next = detourAround(a, b, pos, to) ?? to;
            const step = Math.min(0.05, gap(pos, next));
            const d = gap(pos, next);
            pos.x += ((next.x - pos.x) / d) * step;
            pos.y += ((next.y - pos.y) / d) * step;
            travelled += step;
            closest = Math.min(closest, gap(pos, a), gap(pos, b));
          }
          expect(travelled, `départ ${f}, place ${k}`).toBeLessThan(14);
          expect(closest, `départ ${f}, place ${k}`).toBeGreaterThanOrEqual(0.59);
        }
      }
    }
  });
});
