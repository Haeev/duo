import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
  server: { port: 5173 },
  build: { target: 'es2024' },
});
