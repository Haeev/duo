// Textes des refus nouveaux des lots (outils, potager, lieux, pêche, logement): aucun ne tombe
// sur le texte générique, aucun ne dépasse quatre mots.
import { describe, expect, it } from 'vitest';
import { refusalText, TEXTS } from '../src/interface/textes';

const KEYS = [
  'needs-axe',
  'needs-spade',
  'tool-too-weak',
  'not-yet-back',
  'nothing-now',
  'needs-tilling',
  'needs-seed',
  'not-ripe',
  'already-watered',
  'nothing-to-water',
  'no-more-plots',
  'plot-taken',
  'wrong-season',
  'missing-materials',
  'cannot-upgrade',
  'not-yet',
  'door-locked',
  'shop-closed',
  'need-rod',
  'fish-no-water',
  'fish-none',
  'deco-overlap',
  'room-not-paid',
  'missing-item',
  'other-missing-item',
  'other-not-enough-money',
  'story-item',
];

describe('textes des refus', () => {
  it('chaque raison nouvelle a son texte court', () => {
    for (const key of KEYS) {
      const text = refusalText(key);
      expect(text, key).not.toBe(TEXTS.refusalDefault);
      expect(text.split(' ').length, key).toBeLessThanOrEqual(4);
    }
  });
});
