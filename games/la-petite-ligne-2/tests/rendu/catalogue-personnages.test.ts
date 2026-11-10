// Catalogue des personnages (lot L5): chaque pièce a un nom français court, affichable dans l'éditeur.
import { describe, expect, it } from 'vitest';
import { gameContent } from '../aides';

const content = gameContent();

describe('catalogue des personnages', () => {
  it('donne un nom affichable à chaque pièce', () => {
    for (const piece of content.catalogue.pieces) {
      expect(piece.name, piece.id).toBeDefined();
      expect(piece.name?.length ?? 0, piece.id).toBeGreaterThan(1);
    }
  });
});
