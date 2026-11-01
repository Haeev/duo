# Carnet du dev gameplay 2D

Apprentissages durables et vérifiés. Ni avancement ni secret. Voir aussi le carnet du dev gameplay 3D (`../dev-gameplay-3d/`), qui couvre la même base de code de La Petite Ligne (interface DOM, simulation, tests).

## Environnement (vérifié le 2026-11-01)

- Membre isolé dans un worktree: un heredoc, même vers `/tmp`, est refusé par l'outil Bash. Écrire les scripts avec l'outil Write dans `/tmp/dg2d/` (dossier à soi), puis `python3 -I /tmp/dg2d/x.py <racine absolue du jeu>`; les commandes git et prettier groupées vont dans un script `bash /tmp/dg2d/x.sh <racine>`. `NODE_PATH=... node` est refusé aussi: `node script.cjs` tout court trouve playwright.
- `pnpm typecheck` dans un worktree neuf installe les dépendances tout seul (`pnpm install` implicite, quelques secondes).
- Les ports 5197 et 5198 peuvent déjà servir les Vite d'autres membres (autres worktrees): une page qui ne connaît pas un scénario attend 240 s puis échoue. Lire le port réel dans le journal de Vite (`npx vite --port 5197 --host 127.0.0.1 > /tmp/dg2d/vite.log 2>&1 &`).
- L'outil Write transforme ` `, ` `, `’` écrits dans une expression régulière en vrais caractères: ESLint refuse (`no-irregular-whitespace`). Remettre les échappements par un petit script Python après chaque Write d'un test qui en contient.
- Prettier n'est pas appliqué partout: formater seulement les fichiers neufs et ceux qui étaient conformes avant (comparer `git show HEAD:f | prettier --check --stdin-filepath f`). Ne jamais formater les sauvegardes de référence.
- `rsvg-convert` est installé: une planche de contrôle d'icônes SVG (symboles + `<use>`) se rend en PNG et se regarde avec Read, à 160 px et à la taille réelle.

## La Petite Ligne: simulation et sauvegardes

- Les robots jouent au-delà de la démo si l'on prolonge `settings.clock.lastDay.day` sur une copie du contenu (`structuredClone(content)`): 42 jours en 30 s environ. La partie ne finit jamais (pas de train ni de commande après le jour 15): arrêter sur `clock.day`, pas sur `phase === 'ended'`.
- Graine 20261031 (page de démonstration et tests de l'interface), démo de 15 jours: noms des poules finis au jour 5 (p1 informé), héron au jour 6 (quête de Jeanne), mot de Lucie fini au jour 11 (p2 informé), oies le soir du jour 11; aucun moment d'ambiance. Graine 20261030 (`SEED` des tests): renard au jour 3, moments d'ambiance réguliers.
- Changer la forme de `WorldState`: `DATA_SCHEMA` + 1, migration dans `sauvegarde.ts` (`migrate`), contrôle de forme dans `checkWorld` (données du disque), puis fabriquer les références du nouveau format par `pnpm exec vitest run --config tests/donnees/sauvegardes/generer.config.ts` (le test des références exige un fichier par format) et les inscrire au README du dossier.
- Une valeur nouvelle de `reglages.json`: type dans `donnees/types.ts`, défaut dans `defauts.ts`, lecture dans `contenu.ts` (clé absente: défaut), ligne au README des données, et contrôle dans `outils/valider_donnees.py` si un texte ou un renvoi en dépend.
- Tirage par empreinte partagé simulation et interface: `etat/tirage.ts` (`unitDraw(graine, clé, jour)`); l'interface n'importe jamais `simulation/`.

## La Petite Ligne: interface

- Ajouter un onglet au carnet: `NotebookTab` et `TABS` de `carnet.ts`, `PanelTab` de `composant.ts`, `ui.notebookTabs` (schéma valibot de `textes.ts`). Le corps se reconstruit sur signature (`renderBody(sig, ...)`): y mettre tout ce qui change l'affichage; `data-autofocus` désigne l'élément focalisé à l'ouverture, `data-nav-item` le rend atteignable aux flèches (navigation spatiale sur tout le panneau).
- Page de démonstration: `setupScenario` peut renvoyer une suite jouée 400 ms après le montage (une entrée ajoutée après coup paraît « nouvelle »); paramètre `onglet=souvenirs` pour ouvrir le carnet sur un onglet (`rememberNotebookTab`).
- Une icône déclarée par les données mais absente du sprite ne lève rien (le `<use>` est vide): retomber sur une icône générique (`document.getElementById(id) === null`) et tester la présence des symboles dans `ui-maquettes/icones.svg`.
- Sprite des icônes: modifier `ui-maquettes/outils/icones-source.svg`, puis `node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs` depuis la racine du dépôt (écrit `icones.svg` et `support/icones.js`). Un symbole peut avoir sa propre grille (`viewBox="0 0 40 40"` pour les vignettes).
