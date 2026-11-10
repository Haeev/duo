import { parseManifest } from '@duo/sdk';
import { expect, it } from 'vitest';
import manifest from '../duo-game.json';
import pkg from '../package.json';
import type { GameAction } from '../src/actions';

it('a un manifeste valide, à la version du paquet', () => {
  const parsed = parseManifest(manifest);
  expect(parsed).toMatchObject({ ok: true });
  expect(manifest.id).toBe('la-petite-ligne-2');
  expect(manifest.version).toBe(pkg.version);
});

it('déclare exactement les actions connues du code', () => {
  // `satisfies` casse la compilation si une action du type manque ici; le test casse si le manifeste diverge.
  const known = {
    up: 1,
    down: 1,
    left: 1,
    right: 1,
    run: 1,
    act: 1,
    'camera-left': 1,
    'camera-right': 1,
    'camera-drag': 1,
    'zoom-in': 1,
    'zoom-out': 1,
    'slot-next': 1,
    'slot-1': 1,
    'slot-2': 1,
    'slot-3': 1,
    'slot-4': 1,
    'slot-5': 1,
    stow: 1,
    notebook: 1,
    glance: 1,
    deco: 1,
    back: 1,
    confirm: 1,
    click: 1,
  } satisfies Record<GameAction, 1>;
  expect(manifest.actions.map((a) => a.id).sort()).toEqual(Object.keys(known).sort());
});
