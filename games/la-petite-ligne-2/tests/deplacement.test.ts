// Déplacement au clavier: élan doux, course, murs, meubles solides, glissement, déblocage, caméra.
import { describe, expect, it } from 'vitest';
import { worldMove } from '../src/entrees/commandes';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { gameContent, newSim } from './aides';
import { NORTH, put, run, send } from './aides-noyau';

const content = gameContent();
const { walkSpeed, runSpeed, radius, accelSeconds } = content.settings.movement;

describe('marche et course', () => {
  it('accélère en douceur jusqu’à la vitesse de marche, puis freine sans s’arrêter net', () => {
    const sim = newSim(content);
    put(sim, 0, 10, 20, 0);
    run(sim, SIM_DT, { moveX: 1 });
    const body = sim.world.players[0].body;
    expect(body.speed).toBeGreaterThan(0);
    expect(body.speed).toBeLessThan(walkSpeed);
    run(sim, accelSeconds + 2 * SIM_DT, { moveX: 1 });
    expect(body.speed).toBeCloseTo(walkSpeed, 6);
    expect(body.facing).toBeCloseTo(0, 6);
    run(sim, SIM_DT);
    expect(body.speed).toBeGreaterThan(0);
    expect(body.speed).toBeLessThan(walkSpeed);
    run(sim, accelSeconds + 2 * SIM_DT);
    expect(body.speed).toBe(0);
  });

  it('court en maintenant Maj, marche par défaut; l’autre joueur ne bouge pas', () => {
    const sim = newSim(content);
    put(sim, 0, 5, 20, 0);
    put(sim, 1, 5, 25, 0);
    run(sim, 1, { moveX: 1 }, {});
    const walked = sim.world.players[0].body.x - 5;
    expect(sim.world.players[1].body.x).toBe(5);
    put(sim, 0, 5, 20, 0);
    run(sim, 1, { moveX: 1, run: true });
    const ran = sim.world.players[0].body.x - 5;
    expect(walked).toBeGreaterThan(walkSpeed * 0.8);
    expect(walked).toBeLessThan(walkSpeed);
    expect(ran).toBeGreaterThan(walked * 1.4);
    expect(sim.world.players[0].body.speed).toBeCloseTo(runSpeed, 6);
  });
});

describe('collisions', () => {
  it('s’arrête contre un mur de la carte et glisse le long en diagonale', () => {
    const sim = newSim(content);
    put(sim, 0, 8, 4, NORTH);
    run(sim, 2, { moveY: -1 });
    const body = sim.world.players[0].body;
    // Le mur du nord occupe les rangées 0 et 1: le corps s'arrête à son rayon du bord.
    expect(body.y).toBeGreaterThanOrEqual(2 + radius - 1e-6);
    expect(body.y).toBeLessThan(2 + radius + 0.11);
    const x = body.x;
    run(sim, 1, { moveX: Math.SQRT1_2, moveY: -Math.SQRT1_2 });
    expect(body.x - x).toBeGreaterThan(1);
    expect(body.y).toBeGreaterThanOrEqual(2 + radius - 1e-6);
  });

  it('ne traverse pas un meuble solide et passe son coin sans rester accroché', () => {
    const sim = newSim(content);
    // Le pommier occupe la case (10, 22).
    put(sim, 0, 10.5, 25, NORTH);
    run(sim, 2, { moveY: -1 });
    expect(sim.world.players[0].body.y).toBeGreaterThanOrEqual(23 + radius - 1e-6);
    // Décalé de 25 cm par rapport au bord du meuble: le coin se contourne tout seul.
    put(sim, 0, 11.25, 25, NORTH);
    run(sim, 2, { moveY: -1 });
    expect(sim.world.players[0].body.y).toBeLessThan(22);
  });

  it('ne sort pas de la carte', () => {
    const sim = newSim(content);
    put(sim, 0, 1, 30, Math.PI);
    run(sim, 2, { moveX: -1, run: true });
    expect(sim.world.players[0].body.x).toBeGreaterThanOrEqual(radius - 1e-6);
  });
});

describe('déblocage', () => {
  it('laisse sortir à pied un personnage pris dans un meuble', () => {
    const sim = newSim(content);
    put(sim, 0, 10.5, 22.5, 0);
    run(sim, 1, { moveX: 1 });
    expect(sim.world.players[0].body.x).toBeGreaterThan(11 + radius);
  });

  it('replace sur la case libre la plus proche un personnage enfermé, à sa demande', () => {
    const sim = newSim(content);
    // Au milieu du bâtiment de la gare (rectangle bloqué de la carte).
    put(sim, 0, 20, 12.2, 0);
    const events = send(sim, 0, { type: 'unstick' });
    expect(events).toContainEqual({ type: 'unstuck', player: 0 });
    expect(sim.world.players[0].body).toMatchObject({ x: 19.5, y: 13.5 });
    expect(send(sim, 0, { type: 'unstick' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-stuck',
      target: null,
    });
  });

  it('dégage seul un personnage qui pousse dans un mur sans avancer', () => {
    const sim = newSim(content);
    put(sim, 0, 20, 11.6, NORTH);
    const events = run(sim, 1.5, { moveY: -1 });
    expect(events).toContainEqual({ type: 'unstuck', player: 0 });
    expect(sim.world.players[0].body.y).toBeGreaterThan(13);
  });
});

describe('commande relative à la caméra', () => {
  const out = { moveX: 0, moveY: 0 };
  it('avance vers le nord et va à droite vers l’est quand la caméra regarde le nord', () => {
    worldMove(1, 0, 0, out);
    expect(out.moveX).toBeCloseTo(0, 9);
    expect(out.moveY).toBeCloseTo(-1, 9);
    worldMove(0, 1, 0, out);
    expect(out.moveX).toBeCloseTo(1, 9);
    expect(out.moveY).toBeCloseTo(0, 9);
  });
  it('suit un angle libre: caméra tournée d’un quart vers l’est, avancer va à l’est', () => {
    worldMove(1, 0, Math.PI / 2, out);
    expect(out.moveX).toBeCloseTo(1, 9);
    expect(out.moveY).toBeCloseTo(0, 9);
    worldMove(1, 1, Math.PI / 6, out);
    expect(Math.hypot(out.moveX, out.moveY)).toBeCloseTo(1, 9);
    worldMove(0, 0, 1.2, out);
    expect(out).toEqual({ moveX: 0, moveY: 0 });
  });
});
