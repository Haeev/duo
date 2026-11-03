import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Duo lit les notes de version à côté du jeu installé (encadré « Quoi de neuf » du salon):
// le fichier est déjà dans le code du jeu, on en pose aussi une copie au même chemin dans dist/.
const NOTES = 'donnees/notes-de-version.json';

function releaseNotesCopy(): Plugin {
  return {
    name: 'duo-notes-de-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: NOTES,
        source: readFileSync(new URL(`./${NOTES}`, import.meta.url), 'utf8'),
      });
    },
  };
}

// base './': le jeu est servi depuis un sous-dossier (duo-game:// dans Duo, /jeu/ dans le faux hôte).
export default defineConfig({
  base: './',
  plugins: [releaseNotesCopy()],
  server: { port: 5173, host: true },
  build: { target: 'es2024', assetsInlineLimit: 0 },
});
