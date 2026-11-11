// Poids du paquet du jeu par famille de fichiers livrés: une dérive se voit ici avant d'arriver
// sur le PC du client (graphique intégré, disque inconnu). Les budgets partent du relevé du
// 2026-11-11, avec la place du contenu d'Aubrune encore attendu (tenues, modèles repris,
// vignettes); les dépasser demande une décision (compresser, charger à la demande, ou relever
// le budget en le disant). Le code fabriqué a son propre
// garde-fou dans `vite.config.ts` (`codeBudget`).
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..');
const MO = 1024 * 1024;

interface Family {
  readonly id: string;
  /** Dossiers parcourus (récursivement), relatifs au paquet. */
  readonly dirs: readonly string[];
  readonly ext: string;
  /** Exclus: chemins relatifs qui commencent par l'un de ces préfixes. */
  readonly skip?: readonly string[];
  readonly maxBytes: number;
  readonly maxFiles: number;
}

/** Relevé du 2026-11-11 entre parenthèses (Mo de 1 048 576 octets, fichiers). */
const FAMILIES: readonly Family[] = [
  // (2,28 Mo, 1 383): fiches de données et manifestes, embarqués dans le lot principal.
  { id: 'données', dirs: ['donnees', 'assets'], ext: '.json', maxBytes: 3.2 * MO, maxFiles: 2000 },
  // (2,20 Mo, 26): lot à part (`src/interface/portraits-dessins.ts`).
  {
    id: 'portraits',
    dirs: ['assets/commun/interface/portraits'],
    ext: '.svg',
    maxBytes: 2.7 * MO,
    maxFiles: 32,
  },
  // (4,05 Mo, 195 avec les objets d'intérieur): chargées à la demande, par adresse.
  {
    id: 'vignettes',
    dirs: ['assets/commun/interface/vignettes'],
    ext: '.svg',
    maxBytes: 5.5 * MO,
    maxFiles: 280,
  },
  // Modèles (Mo, fichiers): bâtiments 13,65 et 28, décors 6,13 et 14, objets 2,01 et 18,
  // personnages 1,20 et 9.
  {
    id: 'bâtiments',
    dirs: ['assets/lieux'],
    ext: '.glb',
    maxBytes: 16 * MO,
    maxFiles: 34,
  },
  { id: 'décors', dirs: ['assets/commun/decors'], ext: '.glb', maxBytes: 8.5 * MO, maxFiles: 22 },
  { id: 'objets', dirs: ['assets/commun/objets'], ext: '.glb', maxBytes: 3.2 * MO, maxFiles: 30 },
  {
    id: 'personnages',
    dirs: ['assets/commun/personnages'],
    ext: '.glb',
    maxBytes: 2.2 * MO,
    maxFiles: 16,
  },
  // (11,09 Mo, 43; sons: 1,17 Mo, 80). Plafond de 12 Mo fixé par la direction sonore (`tests/musique.test.ts`).
  {
    id: 'musiques',
    dirs: ['assets/commun/son/musique'],
    ext: '.ogg',
    maxBytes: 12 * MO,
    maxFiles: 50,
  },
  {
    id: 'sons',
    dirs: ['assets/commun/son'],
    ext: '.ogg',
    skip: ['assets/commun/son/musique'],
    maxBytes: 1.8 * MO,
    maxFiles: 120,
  },
];

/** Total des fichiers livrés relevés ici (hors code et polices): 43,0 Mo le 2026-11-11. */
const TOTAL_BUDGET = 56 * MO;

function filesOf(family: Family): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  for (const dir of family.dirs)
    for (const entry of readdirSync(path.join(ROOT, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith(family.ext)) continue;
      const full = path.join(entry.parentPath, entry.name);
      const relative = path.relative(ROOT, full).split(path.sep).join('/');
      if (family.skip?.some((prefix) => relative.startsWith(prefix)) === true) continue;
      bytes += statSync(full).size;
      files += 1;
    }
  return { bytes, files };
}

const measured: Record<string, string> = {};

describe('poids du paquet', () => {
  afterAll(() => {
    // Relevé pour les comptes rendus (lu par `vitest run tests/poids-paquet.test.ts`).
    process.stdout.write(`poids par famille: ${JSON.stringify(measured)}\n`);
  });

  it('chaque famille tient son budget de poids et de nombre de fichiers', () => {
    let total = 0;
    for (const family of FAMILIES) {
      const { bytes, files } = filesOf(family);
      measured[family.id] = `${(bytes / MO).toFixed(2)} Mo, ${String(files)} fichiers`;
      total += bytes;
      expect(files, `${family.id}: aucun fichier, dossier déplacé ?`).toBeGreaterThan(0);
      expect(bytes, `${family.id} (octets)`).toBeLessThanOrEqual(family.maxBytes);
      expect(files, `${family.id} (fichiers)`).toBeLessThanOrEqual(family.maxFiles);
    }
    measured.total = `${(total / MO).toFixed(2)} Mo`;
    expect(total, 'total').toBeLessThanOrEqual(TOTAL_BUDGET);
  });
});
