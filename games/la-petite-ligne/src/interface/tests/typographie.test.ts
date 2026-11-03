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

  it('pose une espace insécable avant les deux-points et les signes doubles, même sans espace dans le texte (LPL-R05)', () => {
    expect(typographier('Bien dormi, bien mangé: en forme.')).toBe(`Bien dormi, bien mangé${NBSP}: en forme.`);
    expect(typographier('avant samedi 16 h: 12 radis')).toBe(`avant samedi 16${NBSP}h${NBSP}: 12${NBSP}radis`);
    expect(typographier('Reprendre : jeudi 6')).toBe(`Reprendre${NBSP}: jeudi 6`);
    expect(typographier('Bonjour!')).toBe(`Bonjour${NNBSP}!`);
    expect(typographier('Quoi?! Vraiment;')).toBe(`Quoi${NNBSP}?! Vraiment${NNBSP};`);
    expect(typographier('« Vingt ans, vraiment? »')).toBe(`«${NBSP}Vingt ans, vraiment${NNBSP}?${NBSP}»`);
  });

  it('les deux formes du deux-points donnent le même texte (lettre et phrase du foulard côte à côte)', () => {
    expect(typographier('samedi prochain à 16 h: 12 radis')).toBe(typographier('samedi prochain à 16 h : 12 radis'));
  });

  it("ne touche ni aux heures (12:30) ni aux adresses", () => {
    expect(typographier('Départ à 12:30 précises')).toBe('Départ à 12:30 précises');
    expect(typographier('https://duo.local/aide')).toBe('https://duo.local/aide');
  });

  it('lie les nombres à leur unité et à ce qu’ils comptent', () => {
    expect(typographier('9 h 20')).toBe(`9${NBSP}h${NBSP}20`);
    expect(typographier('120 aubrins')).toBe(`120${NBSP}aubrins`);
    expect(typographier('1 aubrin')).toBe(`1${NBSP}aubrin`);
    expect(typographier('3 œufs et 12 radis')).toBe(`3${NBSP}œufs et 12${NBSP}radis`);
    expect(typographier('2 lignes sur 4')).toBe(`2${NBSP}lignes sur 4`);
  });

  it('remplace les trois points par des points de suspension', () => {
    expect(typographier('Sacha prépare son personnage...')).toBe('Sacha prépare son personnage…');
  });

  it('est idempotente', () => {
    const once = typographier("« C'est l'heure! » 9 h 20: 3 œufs... Quoi?! 12:30");
    expect(typographier(once)).toBe(once);
  });
});
