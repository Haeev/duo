// Coin à soi (MA-06 de la démo): un carré de 2x2 cases de la pièce, désigné par chacun, où seul son propriétaire pose ses objets.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, Intent } from '../src/etat/actions';
import type { CharacterId } from '../src/etat/types';
import { IntentSchema } from '../src/reseau/schemas';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { canPlace, cornerAt, placementProblem } from '../src/simulation/amenagement';
import { type Sim, character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag } from '../src/simulation/sac';
import { contentAndMap, newSim } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

// Pièce de la maisonnette: cases 6 à 10 sur 22 à 25 (paillasses en 6 et 7, réchaud en 10:22, coffre en 6:25).
const P1_POINT = { x: 10, y: 25 };
const P1_CORNER = { cx: 9, cy: 24 };
const P2_POINT = { x: 8, y: 25 };
const P2_CORNER = { cx: 7, cy: 24 };

function act(sim: Sim, by: CharacterId, intent: Intent): void {
  const intents: AuthoredIntent[] = [{ by, intent }];
  step(sim, { controls: {}, intents });
}

/** Jour 1, les deux personnages créés, scène d'arrivée passée, les deux dans la pièce. */
function inHouse(): Sim {
  const sim = newSim();
  step(sim, {
    controls: {},
    intents: [
      { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
      { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
    ],
  });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent:
        scene.choices.length > 0
          ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' }
          : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  placeCharacter(sim, character(sim, 'p1'), { x: 8.5, y: 22.5 });
  placeCharacter(sim, character(sim, 'p2'), { x: 9.5, y: 22.5 });
  return sim;
}

function lastKey(sim: Sim, id: CharacterId): string | null {
  const list = character(sim, id).notifications;
  return list[list.length - 1]?.key ?? null;
}

describe('coin à soi', () => {
  it('se désigne au carré visé dans la pièce, se déplace, et se retire en visant le même endroit', () => {
    const sim = inHouse();
    const p1 = character(sim, 'p1');
    expect(p1.corner ?? null).toBeNull();
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    expect(p1.corner).toEqual(P1_CORNER);
    expect(lastKey(sim, 'p1')).toBe('corner_set');
    // L'autre est prévenu.
    expect(lastKey(sim, 'p2')).toBe('corner_partner_set');
    act(sim, 'p1', { type: 'corner', x: 7.2, y: 23.1 });
    expect(p1.corner).toEqual({ cx: 6, cy: 22 });
    expect(lastKey(sim, 'p1')).toBe('corner_moved');
    // Au même endroit: retiré.
    act(sim, 'p1', { type: 'corner', x: 7, y: 23 });
    expect(p1.corner).toBeNull();
    expect(lastKey(sim, 'p1')).toBe('corner_removed');
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    act(sim, 'p1', { type: 'corner_clear' });
    expect(p1.corner).toBeNull();
  });

  it('reste dans la pièce (collé au mur), ne se choisit que dans la maison, et ne touche pas le coin de l’autre', () => {
    const sim = inHouse();
    const { map } = contentAndMap();
    expect(cornerAt(map, 30, -5)).toEqual({ cx: 9, cy: 22 });
    expect(cornerAt(map, 0, 100)).toEqual({ cx: 6, cy: 24 });
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    act(sim, 'p2', { type: 'corner', x: 9.4, y: 25 });
    expect(character(sim, 'p2').corner ?? null).toBeNull();
    expect(lastKey(sim, 'p2')).toBe('corner_taken');
    act(sim, 'p2', { type: 'corner', ...P2_POINT });
    expect(character(sim, 'p2').corner).toEqual(P2_CORNER);
    placeCharacter(sim, character(sim, 'p2'), { x: 20.5, y: 20.5 });
    act(sim, 'p2', { type: 'corner', x: 7, y: 23 });
    expect(character(sim, 'p2').corner).toEqual(P2_CORNER);
    expect(lastKey(sim, 'p2')).toBe('corner_outside');
  });

  it("dans le coin de l'un, l'autre ne pose ni ne reprend rien; le propriétaire, si; hors des coins, rien ne change", () => {
    const sim = inHouse();
    const p1 = character(sim, 'p1');
    const p2 = character(sim, 'p2');
    addToBag(sim, p1, 'chair', 'ordinary', 2);
    addToBag(sim, p2, 'chair', 'ordinary', 2);
    act(sim, 'p1', { type: 'hold_furniture', item: 'chair' });
    act(sim, 'p2', { type: 'hold_furniture', item: 'chair' });
    act(sim, 'p1', { type: 'corner', ...P1_POINT });

    // Refus pour l'autre, avec la raison.
    expect(placementProblem(sim, 'chair', { cx: 10, cy: 25 }, 0, null, 'p2')).toBe('not_yours');
    expect(canPlace(sim, 'chair', { cx: 10, cy: 25 }, 0)).toBe(false);
    const before = sim.world.furniture.length;
    act(sim, 'p2', { type: 'place_furniture', cell: { cx: 10, cy: 25 }, rotation: 0 });
    expect(sim.world.furniture.length).toBe(before);
    expect(countInBag(p2, 'chair')).toBe(2);
    expect(lastKey(sim, 'p2')).toBe('placement_not_yours');

    // Le propriétaire pose dans son coin.
    expect(placementProblem(sim, 'chair', { cx: 10, cy: 25 }, 0, null, 'p1')).toBeNull();
    act(sim, 'p1', { type: 'place_furniture', cell: { cx: 10, cy: 25 }, rotation: 0 });
    const chair = sim.world.furniture.find((f) => f.cell.cx === 10 && f.cell.cy === 25);
    expect(chair?.placedBy).toBe('p1');
    if (chair === undefined) throw new Error('chaise non posée');

    // L'autre ne la reprend pas; le propriétaire, si.
    act(sim, 'p2', { type: 'take_furniture', furniture: chair.id });
    expect(sim.world.furniture.some((f) => f.id === chair.id)).toBe(true);
    expect(lastKey(sim, 'p2')).toBe('corner_not_yours');
    act(sim, 'p1', { type: 'take_furniture', furniture: chair.id });
    expect(sim.world.furniture.some((f) => f.id === chair.id)).toBe(false);
    expect(countInBag(p1, 'chair')).toBe(2);

    // Hors des coins: chacun pose et reprend comme avant, même ce que l'autre a posé.
    act(sim, 'p2', { type: 'place_furniture', cell: { cx: 8, cy: 24 }, rotation: 0 });
    const outside = sim.world.furniture.find((f) => f.cell.cx === 8 && f.cell.cy === 24);
    expect(outside?.placedBy).toBe('p2');
    if (outside === undefined) throw new Error('chaise non posée');
    act(sim, 'p1', { type: 'take_furniture', furniture: outside.id });
    expect(sim.world.furniture.some((f) => f.id === outside.id)).toBe(false);
    expect(countInBag(p1, 'chair')).toBe(3);
  });

  it("ne se désigne pas sur un meuble posé par l'autre; un meuble de départ peut y être", () => {
    const sim = inHouse();
    addToBag(sim, character(sim, 'p2'), 'chair', 'ordinary', 1);
    act(sim, 'p2', { type: 'hold_furniture', item: 'chair' });
    act(sim, 'p2', { type: 'place_furniture', cell: { cx: 10, cy: 25 }, rotation: 0 });
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    expect(character(sim, 'p1').corner ?? null).toBeNull();
    expect(lastKey(sim, 'p1')).toBe('corner_partner_things');
    // Le réchaud de départ (10:22) n'empêche rien.
    act(sim, 'p1', { type: 'corner', x: 10, y: 23 });
    expect(character(sim, 'p1').corner).toEqual({ cx: 9, cy: 22 });
  });

  it("l'aperçu du meuble en main montre le refus dans le coin de l'autre", () => {
    const sim = inHouse();
    const p2 = character(sim, 'p2');
    act(sim, 'p1', { type: 'corner', x: 11, y: 23 });
    expect(character(sim, 'p1').corner).toEqual({ cx: 9, cy: 22 });
    addToBag(sim, p2, 'chair', 'ordinary', 1);
    act(sim, 'p2', { type: 'hold_furniture', item: 'chair' });
    // Sacha en 9:22, tourné vers l'est: l'aperçu tombe en 10:22... sur le réchaud. Vers le sud: 9:23, dans le coin de Camille.
    p2.facing = Math.PI / 2;
    step(sim, { controls: {}, intents: [] });
    expect(p2.placement?.cell).toEqual({ cx: 9, cy: 23 });
    expect(p2.placement?.valid).toBe(false);
    const blocked = p2.placement?.blocked ?? '';
    expect(blocked === 'placement_not_yours' || blocked.includes('Camille')).toBe(true);
  });

  it("se sauvegarde, se relit avec l'autre machine hôte, et les anciennes sauvegardes se relisent sans coin", () => {
    const sim = inHouse();
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    act(sim, 'p2', { type: 'corner', ...P2_POINT });
    const snap = snapshotOf(sim);
    const { content, map } = contentAndMap();
    const restored = restoreWorld(
      content,
      map,
      JSON.parse(JSON.stringify(snap.data)) as unknown,
      snap.dataSchema,
      [B, A],
    );
    const byPlayer = (s: Sim, id: string): unknown =>
      s.world.characters.find((c) => c.playerId === id)?.corner;
    expect(byPlayer(restored, A.id)).toEqual(P1_CORNER);
    expect(byPlayer(restored, B.id)).toEqual(P2_CORNER);
    // Le refus survit au rechargement.
    expect(placementProblem(restored, 'chair', { cx: 10, cy: 25 }, 0, null, 'p2')).toBe(
      'not_yours',
    );

    // Sauvegarde d'avant le coin (sans le champ), et coin abîmé hors de la pièce.
    const old = JSON.parse(JSON.stringify(snap.data)) as { characters: Record<string, unknown>[] };
    const [first, second] = old.characters;
    if (first === undefined || second === undefined) throw new Error('personnages manquants');
    delete first.corner;
    second.corner = { cx: 40, cy: 2.5 };
    const migrated = restoreWorld(content, map, old, snap.dataSchema, [A, B]);
    expect(migrated.world.characters.map((c) => c.corner)).toEqual([null, null]);
  });

  it("passe le contrôle réseau des intentions de l'invité", () => {
    expect(v.safeParse(IntentSchema, { type: 'corner', x: 9.5, y: 24.5 }).success).toBe(true);
    expect(v.safeParse(IntentSchema, { type: 'corner_clear' }).success).toBe(true);
    expect(v.safeParse(IntentSchema, { type: 'corner', x: Number.NaN, y: 1 }).success).toBe(false);
  });

  it("refuse un meuble qui touche le coin de l'autre, même s'il touche aussi le sien", () => {
    const sim = inHouse();
    act(sim, 'p1', { type: 'corner', ...P1_POINT });
    act(sim, 'p2', { type: 'corner', ...P2_POINT });
    // Table de 2x1 en 8:24 et 9:24: dans le coin de Sacha (8:24) et dans celui de Camille (9:24).
    expect(placementProblem(sim, 'table', { cx: 8, cy: 24 }, 0, null, 'p1')).toBe('not_yours');
    expect(placementProblem(sim, 'table', { cx: 8, cy: 24 }, 0, null, 'p2')).toBe('not_yours');
  });
});
