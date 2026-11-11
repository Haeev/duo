// Aucun corps dans un meuble ni dans un mur (revue visuelle du 2026-11-11, correction 3): à chaque
// poste de planning de chaque habitant de chaque lieu (dedans et dehors), à chaque place assise et
// à chaque place couchée, la boîte du personnage ne coupe aucun meuble solide ni aucune case de mur,
// et il regarde du bon côté (un commerçant derrière son comptoir a ses clients devant lui, une
// place assise ne fait pas face au mur). Règle générale, sans cas par identifiant: le test liste
// les fautes avec leur endroit.
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import { postFaults } from './aides-postes';
import { gameDataFiles } from './aides';

/**
 * Fautes connues qui demandent de retoucher une pièce ou une carte: aucune. Une faute nouvelle fait
 * échouer le test; la liste existe pour y consigner, avec sa raison, une faute qu'on ne peut pas
 * corriger en données.
 */
const KNOWN: readonly string[] = [];

describe('postes des habitants, sièges et lits', () => {
  const content: Content = loadContent(gameDataFiles());

  it('aucun corps ne coupe un meuble solide ni un mur, chacun tourné du bon côté', () => {
    expect(postFaults(content)).toEqual([...KNOWN].sort());
  });

  it('la règle voit un poste posé dans un meuble (exemplaire factice)', () => {
    const files = gameDataFiles();
    const fiche = files['lieux/aubrune/habitants/odette.json'] as {
      life: { schedule: { at: unknown }[] };
    };
    const first = fiche.life.schedule[0];
    if (first === undefined) throw new Error('planning vide');
    // Un point libre pour la grille (case voisine du four), mais à 0,2 m de lui: le corps y entre.
    first.at = { point: 'factice-dans-le-four' };
    const interior = files['lieux/aubrune/interieurs/fournil.json'] as {
      points: Record<string, { x: number; y: number }>;
    };
    interior.points['factice-dans-le-four'] = { x: 5.5, y: 1.2 };
    const faults = postFaults(loadContent(files));
    expect(faults.some((f) => f.startsWith('aubrune/odette') && f.includes('fournil-four'))).toBe(
      true,
    );
  });
});
