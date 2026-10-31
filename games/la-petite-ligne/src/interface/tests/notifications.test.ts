import { describe, expect, it } from 'vitest';
import type { GameNotification } from '../../etat/types';
import { messageKeyOf, toastVisual, visibleToasts } from '../notifications';
import { contentAndMap } from './aides';

function note(text: string, key: string | null = null, kind: GameNotification['kind'] = 'message'): GameNotification {
  return { id: 1, kind, text, hint: null, proposal: null, key, tick: 0 };
}

describe('notifications', () => {
  it('retrouve le message de textes.json dont vient un texte', () => {
    const { content } = contentAndMap();
    const m = content.texts.messages;
    expect(messageKeyOf('Déjà pris par Sacha.', m)).toBe('already_taken');
    expect(messageKeyOf('Il manque 40 sous.', m)).toBe('not_enough_money');
    expect(messageKeyOf('Le train de samedi est en gare !', m)).toBe('train_arrived');
    expect(messageKeyOf('Un texte composé ailleurs.', m)).toBeNull();
  });

  it('choisit le style: erreur, événement, ou le jeton de l’autre joueur', () => {
    const { content } = contentAndMap();
    const m = content.texts.messages;
    expect(toastVisual(note('Il manque 40 sous.'), m)).toMatchObject({ variant: 'error', icon: 'ui-warning' });
    expect(toastVisual(note('Le train part dans une heure.'), m)).toMatchObject({ variant: 'event', icon: 'ui-train' });
    expect(toastVisual(note('Déjà pris par Sacha.'), m).partnerToken).toBe(true);
    // La clé donnée par la simulation l'emporte sur la reconnaissance du texte.
    expect(toastVisual(note('Texte libre', 'no_energy'), m)).toMatchObject({ variant: 'error', icon: 'ui-stamina' });
    expect(toastVisual(note('Du courrier', null, 'letter'), m).icon).toBe('ui-letter');
  });

  it('montre au plus trois notifications fraîches, la plus récente en bas', () => {
    const list = [1, 2, 3, 4, 5].map((id) => ({ id }));
    const seen = new Map([
      [1, 0],
      [2, 1000],
      [3, 2000],
      [4, 3000],
      [5, 4000],
    ]);
    expect(visibleToasts(list, seen, 6500, 6000, 3).map((n) => n.id)).toEqual([3, 4, 5]);
    expect(visibleToasts(list, seen, 8500, 6000, 3).map((n) => n.id)).toEqual([4, 5]);
    expect(visibleToasts(list, new Map(), 0, 6000, 3)).toEqual([]);
  });
});
