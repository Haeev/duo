import { describe, expect, it } from 'vitest';
import { NBSP, NNBSP, typographier } from '../typographie';

describe('typographier', () => {
  it('pose les apostrophes, les guillemets et les espaces insécables', () => {
    expect(typographier("C'est l'heure")).toBe('C’est l’heure');
    expect(typographier('« Promis. »')).toBe(`«${NBSP}Promis.${NBSP}»`);
    expect(typographier('Belle : arrosée')).toBe(`Belle${NBSP}: arrosée`);
    expect(typographier("C'est parti !")).toBe(`C’est parti${NNBSP}!`);
    expect(typographier('D accord ?')).toBe(`D accord${NNBSP}?`);
  });

  it("ne crée pas d'espace là où le texte n'en a pas (style de textes.json)", () => {
    expect(typographier('Bien dormi, bien mangé: en forme.')).toBe('Bien dormi, bien mangé: en forme.');
  });

  it('lie les nombres à leur unité et à ce qu’ils comptent', () => {
    expect(typographier('9 h 20')).toBe(`9${NBSP}h${NBSP}20`);
    expect(typographier('120 sous')).toBe(`120${NBSP}sous`);
    expect(typographier('3 œufs et 12 radis')).toBe(`3${NBSP}œufs et 12${NBSP}radis`);
    expect(typographier('2 lignes sur 4')).toBe(`2${NBSP}lignes sur 4`);
  });

  it('remplace les trois points par des points de suspension', () => {
    expect(typographier('Sacha prépare son personnage...')).toBe('Sacha prépare son personnage…');
  });

  it('est idempotente', () => {
    const once = typographier("« C'est l'heure ! » 9 h 20 : 3 œufs...");
    expect(typographier(once)).toBe(once);
  });
});
