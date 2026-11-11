import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * Empreinte de la fabrication: sources, données et manifeste du jeu. Deux fabrications différentes
 * sous le même numéro de version n'ont pas la même: l'hôte et l'invité la comparent avant de
 * jouer (`src/reseau/compatibilite.ts`, ADR 0006).
 */
function buildFingerprint(root: string, entries: readonly string[]): string {
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry);
    if (statSync(full).isFile()) files.push(entry);
    else
      for (const item of readdirSync(full, { recursive: true, withFileTypes: true }))
        if (item.isFile())
          files.push(
            path.relative(root, path.join(item.parentPath, item.name)).split(path.sep).join('/'),
          );
  }
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(path.join(root, file)));
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Budget du code fabriqué par lot (octets après minification): relevé du 2026-11-11 plus environ
 * 15 %. Le lot principal porte aussi les fiches de données (1,4 Mo); les portraits dessinés ont
 * leur lot, chargé à part. Dépasser arrête la fabrication: on décide (découper, charger à la
 * demande) ou on relève le budget en le disant. Les autres familles: `tests/poids-paquet.test.ts`.
 */
const CODE_BUDGET: Readonly<Record<string, number>> = {
  index: 3_650_000, // relevé: 3 168 730
  'portraits-dessins': 2_650_000, // relevé: 2 308 720
};
/** Tout autre lot (sonde d'essai, mémoire): petit par construction. */
const OTHER_CHUNK_BUDGET = 256 * 1024;

function codeBudget(): Plugin {
  return {
    name: 'lpl-budget-code',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const size = Buffer.byteLength(output.code);
        const budget = CODE_BUDGET[output.name] ?? OTHER_CHUNK_BUDGET;
        if (size > budget)
          this.error(
            `Lot « ${output.name} »: ${String(size)} octets, budget ${String(budget)} (vite.config.ts).`,
          );
      }
    },
  };
}

// base './': le jeu est servi depuis un sous-dossier (duo-game:// dans Duo, /jeu/ dans le faux hôte).
export default defineConfig({
  base: './',
  define: {
    __LPL_BUILD_FINGERPRINT__: JSON.stringify(
      buildFingerprint(path.dirname(fileURLToPath(import.meta.url)), [
        'src',
        'donnees',
        'duo-game.json',
      ]),
    ),
  },
  plugins: [codeBudget()],
  server: { port: 5173 },
  build: { target: 'es2024' },
});
