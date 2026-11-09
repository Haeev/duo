// Effets du café fermé (démo v0.3, A2, A6, D15): contrôles courts des données du rendu.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { DUST_SPOTS, PANE_CELLS, WHITEWASH_PANES, roomLightFor } from '../src/rendu/cafe-ferme';

const content = loadContent(DATA_FILES);
const elements = content.plan.levels[0]?.elements ?? [];
const textures = new URL('../assets/modeles/textures/', import.meta.url);

/** Largeur et hauteur d'un PNG (en-tête IHDR). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(fileURLToPath(new URL(file, textures)));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('café fermé', () => {
  it('chaque vitre blanchie est une baie vitrée de la façade du plan, au même endroit', () => {
    for (const id of WHITEWASH_PANES) {
      const el = elements.find((e) => e.id === id);
      expect(el, id).toBeDefined();
      if (el === undefined || !('rect' in el.shape)) continue;
      const [x, z, w] = el.shape.rect;
      expect(z, id).toBeCloseTo(12.5, 1);
      for (const c of PANE_CELLS.filter((p) => p.id === id)) {
        expect(c.x0, id).toBeGreaterThanOrEqual(x - 0.1);
        expect(c.x1, id).toBeLessThanOrEqual(x + w + 0.1);
      }
    }
  });

  it('les cases de l’atlas du badigeon tiennent dans une moitié et ne se chevauchent pas', () => {
    expect(pngSize('blanc_meudon.png')).toEqual([2048, 1024]);
    expect(pngSize('feuilles_mortes.png')).toEqual([512, 256]);
    for (const a of PANE_CELLS) {
      const [x, y, w, h] = a.cell;
      expect(x + w).toBeLessThanOrEqual(1024);
      expect(y + h).toBeLessThanOrEqual(1024);
      for (const b of PANE_CELLS) {
        if (a === b) continue;
        const [bx, by, bw, bh] = b.cell;
        expect(x >= bx + bw || bx >= x + w || y >= by + bh || by >= y + h).toBe(true);
      }
    }
  });

  it('les sept taches sont au sol de la salle, hors des murs', () => {
    expect(DUST_SPOTS).toHaveLength(7);
    for (const s of DUST_SPOTS) {
      expect(s.x).toBeGreaterThan(4.3);
      expect(s.x).toBeLessThan(10.7);
      expect(s.z).toBeGreaterThan(7.4);
      expect(s.z).toBeLessThan(12.3);
    }
  });

  it('D15: la salle passe de 0,6 (vitres blanches) à 1 (propres), × 0,85 par vitre', () => {
    expect(roomLightFor(0)).toBe(1);
    expect(roomLightFor(1)).toBeCloseTo(0.85, 6);
    expect(roomLightFor(2)).toBeCloseTo(0.7225, 6);
    expect(roomLightFor(4)).toBe(0.6);
  });
});
