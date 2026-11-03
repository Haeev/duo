import { describe, expect, it } from 'vitest';
import type { GameNotification } from '../../etat/types';
import { dedupeToasts, messageKeyOf, toastVisual, visibleToasts } from '../notifications';
import { contentAndMap } from './aides';

function note(text: string, key: string | null = null, kind: GameNotification['kind'] = 'message'): GameNotification {
  return { id: 1, kind, text, hint: null, proposal: null, key, tick: 0 };
}

describe('notifications', () => {
  it('retrouve le message de textes.json dont vient un texte', () => {
    const { content } = contentAndMap();
    const m = content.texts.messages;
    expect(messageKeyOf('Déjà pris par Sacha.', m)).toBe('already_taken');
    expect(messageKeyOf('Il manque 40 aubrins.', m)).toBe('not_enough_money');
    expect(messageKeyOf('Le train de samedi est en gare !', m)).toBe('train_arrived');
    expect(messageKeyOf('Un texte composé ailleurs.', m)).toBeNull();
  });

  it('choisit le style: erreur, événement, ou le jeton de l’autre joueur', () => {
    const { content } = contentAndMap();
    const m = content.texts.messages;
    expect(toastVisual(note('Il manque 40 aubrins.'), m)).toMatchObject({ variant: 'error', icon: 'ui-warning' });
    expect(toastVisual(note('Le train part dans une heure.'), m)).toMatchObject({ variant: 'event', icon: 'ui-train' });
    expect(toastVisual(note('Déjà pris par Sacha.'), m).partnerToken).toBe(true);
    // La clé donnée par la simulation l'emporte sur la reconnaissance du texte.
    expect(toastVisual(note('Texte libre', 'no_energy'), m)).toMatchObject({ variant: 'error', icon: 'ui-stamina' });
    expect(toastVisual(note('Du courrier', null, 'letter'), m).icon).toBe('ui-letter');
  });

  it("n'empile pas une notification identique: la plus récente reste, son délai repart", () => {
    const n = (id: number, text: string, kind: GameNotification['kind'] = 'message'): GameNotification => ({ ...note(text, null, kind), id });
    const list = [
      n(1, 'Camille t’attend pour la suite.'),
      n(2, 'Rien ici… pour l’instant.'),
      n(3, 'Camille t’attend pour la suite.'),
      n(4, 'Premières pousses : étape terminée.', 'quest'),
      n(5, 'Premières pousses : étape terminée.', 'quest'),
      n(6, 'Camille t’attend pour la suite.'),
    ];
    expect(dedupeToasts(list).map((x) => x.id)).toEqual([2, 5, 6]);
    // Trois répétitions en 1,3 s: une seule carte, fraîche depuis la dernière.
    const seen = new Map([
      [1, 0],
      [3, 600],
      [6, 1300],
      [2, 100],
      [4, 200],
      [5, 200],
    ]);
    expect(visibleToasts(dedupeToasts(list), seen, 6500, 6000, 3).map((x) => x.id)).toEqual([6]);
    // Même texte, autre sorte: deux cartes.
    expect(dedupeToasts([n(1, 'Texte'), n(2, 'Texte', 'quest')])).toHaveLength(2);
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
