import { parseManifest } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { AUCUNE_COMMANDE, avancer, creerMonde, empreinte } from '../src/simulation/monde';

describe('simulation du gabarit', () => {
  it('est déterministe: mêmes commandes, même empreinte', () => {
    const a = creerMonde();
    const b = creerMonde();
    for (let i = 0; i < 120; i++) {
      avancer(a, { down: ['right'] }, AUCUNE_COMMANDE, 1 / 60);
      avancer(b, { down: ['right'] }, AUCUNE_COMMANDE, 1 / 60);
    }
    expect(empreinte(a)).toBe(empreinte(b));
    expect(a.hote.x).toBeGreaterThan(creerMonde().hote.x);
  });

  it('garde les astres dans le terrain', () => {
    const monde = creerMonde();
    for (let i = 0; i < 600; i++) avancer(monde, { down: ['up', 'left'] }, AUCUNE_COMMANDE, 1 / 60);
    expect(monde.hote).toEqual({ x: 0, y: 0 });
  });
});

it('a un manifeste valide', () => {
  expect(parseManifest(manifest)).toMatchObject({ ok: true });
});
