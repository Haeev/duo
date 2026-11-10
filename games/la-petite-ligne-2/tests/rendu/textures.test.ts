// Bibliothèque de textures (assets-src/textures): description, atlas WebP présents et à la bonne
// taille, poids total. Les contrôles d'image (raccord, contraste, échelle) sont dans
// verifier_textures.py, lancé par construire.sh.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../../assets/commun/textures/', import.meta.url));

interface Family {
  nom: string;
  fichier: string;
  relief: string | null;
  pixels: [number, number];
  couches: number;
  repetition: 'x' | 'xy';
}
interface TextureEntry {
  id: string;
  nom: string;
  famille: string;
  matiere: string;
  palette: string;
  couche: number;
  taille_m: [number, number];
  repetition: 'x' | 'xy';
  couleurs_dominantes: { couleur: string; part: number }[];
  mesures_m: Record<string, number>;
}
interface Library {
  familles: Record<string, Family>;
  textures: TextureEntry[];
}

const library = JSON.parse(readFileSync(dir + 'textures.json', 'utf8')) as Library;

/** Largeur et hauteur lues dans l'en-tête WebP (VP8, VP8L ou VP8X). */
function webpSize(file: string): [number, number] {
  const b = readFileSync(dir + file);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF');
  expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

describe('bibliothèque de textures', () => {
  it('donne au moins 2 variantes à Aubrune de chaque matière prioritaire, et des palettes de lieu', () => {
    const priority = [
      'herbe',
      'terre',
      'paves',
      'dalles',
      'plancher',
      'crepi',
      'pierre',
      'tuiles',
      'bardage',
      'eau',
    ];
    for (const m of priority) {
      const n = library.textures.filter((t) => t.matiere === m && t.palette === 'aubrune').length;
      expect(n, m).toBeGreaterThanOrEqual(2);
    }
    for (const lieu of ['hautefonte', 'combe-veilleuse']) {
      expect(library.textures.some((t) => t.palette === lieu)).toBe(true);
    }
    expect(new Set(library.textures.map((t) => t.id)).size).toBe(library.textures.length);
  });

  it('décrit chaque texture (nom, couche, taille réelle, couleurs)', () => {
    for (const t of library.textures) {
      const fam = library.familles[t.famille];
      expect(fam, t.id).toBeDefined();
      if (!fam) continue;
      expect(t.couche).toBeLessThan(fam.couches);
      expect(t.nom.length).toBeGreaterThan(3);
      expect(t.repetition).toBe(fam.repetition);
      // pixels carrés: la taille couverte garde le rapport de l'image
      expect(t.taille_m[0] / t.taille_m[1]).toBeCloseTo(fam.pixels[0] / fam.pixels[1], 5);
      expect(t.couleurs_dominantes.length).toBeGreaterThan(0);
      for (const c of t.couleurs_dominantes) expect(c.couleur).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('livre des atlas WebP à la bonne taille, sous 6 Mo en tout', () => {
    let bytes = 0;
    for (const fam of Object.values(library.familles)) {
      for (const file of [fam.fichier, fam.relief]) {
        if (!file) continue;
        expect(webpSize(file), file).toEqual([fam.pixels[0], fam.pixels[1] * fam.couches]);
        bytes += statSync(dir + file).size;
      }
    }
    expect(bytes).toBeLessThan(6 * 1024 * 1024);
  });
});
