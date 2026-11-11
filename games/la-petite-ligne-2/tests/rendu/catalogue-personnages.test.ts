// Catalogue des personnages (lot L5): chaque pièce a un nom français court, affichable dans l'éditeur.
// Garde-robe d'Aubrune: les pièces à gagner restent hors de l'éditeur jusqu'à leur don.
import { describe, expect, it } from 'vitest';
import { piecesFor } from '../../src/interface/editeur/modele';
import { defaultPlayerLook } from '../../src/rendu/personnages/apparence';
import { pieceKey, WARDROBE, wardrobeOf } from '../../src/simulation/regles/recompenses';
import { gameContent, newSim } from '../aides';

const content = gameContent();

describe('catalogue des personnages', () => {
  it('donne un nom affichable à chaque pièce', () => {
    for (const piece of content.catalogue.pieces) {
      expect(piece.name, piece.id).toBeDefined();
      expect(piece.name?.length ?? 0, piece.id).toBeGreaterThan(1);
    }
  });

  it('garde-robe: douze pièces à gagner au moins, décrites; celles de la mercerie aussi à gagner', () => {
    const locked = content.catalogue.pieces.filter((p) => p.tags.includes(WARDROBE.lockedTag));
    expect(locked.length).toBeGreaterThanOrEqual(12);
    for (const piece of locked) expect(piece.description, piece.id).toBeDefined();
    const shop = content.catalogue.pieces.filter((p) => p.tags.includes('mercerie'));
    expect(shop.length).toBeGreaterThanOrEqual(6);
    for (const piece of shop) expect(piece.tags, piece.id).toContain(WARDROBE.lockedTag);
  });

  it('une pièce à gagner paraît dans l’éditeur une fois donnée, jamais dans le look de départ', () => {
    const sim = newSim(content);
    const hat = content.catalogue.pieces.find(
      (p) => p.slot === 'hat' && p.tags.includes(WARDROBE.lockedTag),
    );
    if (hat === undefined) throw new Error('aucun chapeau à gagner');
    const shown = (): string[] =>
      piecesFor(wardrobeOf(content.catalogue, sim.world), 'hat').map((p) => p.id);
    expect(shown()).not.toContain(hat.id);
    sim.world.progress.memory[pieceKey(hat.id)] = { v: true, by: 0, day: 1 };
    expect(shown()).toContain(hat.id);
    for (const index of [0, 1] as const) {
      for (const gender of ['f', 'm'] as const) {
        const look = defaultPlayerLook(
          index,
          gender,
          content.settings.start.shapes,
          '#c0563c',
          content.catalogue,
        );
        for (const worn of look.pieces) {
          const def = content.catalogue.pieces.find((p) => p.id === worn.id);
          expect(def?.tags, worn.id).not.toContain(WARDROBE.lockedTag);
        }
      }
    }
  });
});
