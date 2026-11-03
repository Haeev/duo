// Coin à soi: textes des refus et des confirmations, que `textes.json` n'a pas encore.
import { describe, expect, it } from 'vitest';
import type { GameNotification } from '../../etat/types';
import { placementReason } from '../modele';
import { toastText, toastVisual } from '../notifications';
import { uiContext } from './aides';

const KEYS = [
  'placement_not_yours',
  'corner_set',
  'corner_moved',
  'corner_removed',
  'corner_partner_set',
  'corner_outside',
  'corner_taken',
  'corner_partner_things',
  'corner_not_yours',
];

function note(text: string, key: string | null): GameNotification {
  return { id: 1, kind: 'message', text, key, tick: 0 };
}

describe('coin à soi (interface)', () => {
  it('a un texte pour chaque message de la simulation, sans tiret long', () => {
    const ctx = uiContext();
    for (const key of KEYS) {
      const text = ctx.texts.messages[key] ?? '';
      expect(text, key).not.toBe('');
      expect(text, key).not.toMatch(/[\u2013\u2014]/u);
    }
    expect(ctx.texts.extra.corner.designate).toContain('coin');
  });

  it('traduit la clé donnée par la simulation, avec le prénom de l’autre', () => {
    const ctx = uiContext();
    const m = ctx.texts.messages;
    const text = toastText(note('corner_not_yours', 'corner_not_yours'), m, { partner: 'Sacha' });
    expect(text).toContain('Sacha');
    expect(text).not.toContain('{partner}');
    // Un texte déjà composé par la simulation reste tel quel.
    expect(toastText(note('Déjà pris par Sacha.', 'already_taken'), m, { partner: 'Sacha' })).toBe(
      'Déjà pris par Sacha.',
    );
    expect(toastVisual(note('corner_taken', 'corner_taken'), m)).toMatchObject({
      variant: 'error',
    });
    const reason = placementReason('placement_not_yours', m);
    expect(reason).not.toBeNull();
    expect(ctx.t(reason ?? '', { partner: 'Sacha' })).toContain('Sacha');
  });
});
