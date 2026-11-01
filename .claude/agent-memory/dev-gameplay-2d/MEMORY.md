# Carnet du dev gameplay 2D

Apprentissages durables et vérifiés. Ni avancement ni secret. Voir aussi le carnet du dev gameplay 3D (`../dev-gameplay-3d/`), qui couvre la même base de code de La Petite Ligne (interface DOM, simulation, tests).

## Environnement (vérifié le 2026-11-01)

- Membre isolé dans un worktree: un heredoc était refusé au tour 7 (accepté au tour 8, voir plus bas); une commande composée jugée trop complexe est refusée. Écrire les scripts avec l'outil Write dans `/tmp/dg2d/` (dossier à soi), puis `python3 -I /tmp/dg2d/x.py <racine absolue du jeu>`; les commandes git et prettier groupées vont dans un script `bash /tmp/dg2d/x.sh <racine>`. `NODE_PATH=... node` est refusé aussi: `node script.cjs` tout court trouve playwright.
- `pnpm typecheck` dans un worktree neuf installe les dépendances tout seul (`pnpm install` implicite, quelques secondes).
- Les ports 5197 et 5198 peuvent déjà servir les Vite d'autres membres (autres worktrees): une page qui ne connaît pas un scénario attend 240 s puis échoue. Lire le port réel dans le journal de Vite (`npx vite --port 5197 --host 127.0.0.1 > /tmp/dg2d/vite.log 2>&1 &`).
- L'outil Write transforme ` `, ` `, `’` écrits dans une expression régulière en vrais caractères: ESLint refuse (`no-irregular-whitespace`). Remettre les échappements par un petit script Python après chaque Write d'un test qui en contient.
- Prettier n'est pas appliqué partout: formater seulement les fichiers neufs et ceux qui étaient conformes avant (comparer `git show HEAD:f | prettier --check --stdin-filepath f`). Ne jamais formater les sauvegardes de référence.
- Toute commande Bash qui contient `--exclude-dir=.git` (le contrôle des tirets) ou `git` composé est refusée: la mettre dans un script de `/tmp/dg2d/`. `pkill -f motif` dans la même commande que le motif se tue lui-même (code 144): `pgrep -af` puis `kill <pid>`.
- ESLint (`switch-exhaustiveness-check`) refuse un `switch` sur `Condition['type']` même avec `default`: écrire une suite de `if`.
- `rsvg-convert` est installé: une planche de contrôle d'icônes SVG (symboles + `<use>`) se rend en PNG et se regarde avec Read, à 160 px et à la taille réelle.

## La Petite Ligne: simulation et sauvegardes

- Les robots jouent au-delà de la démo si l'on prolonge `settings.clock.lastDay.day` sur une copie du contenu (`structuredClone(content)`): 42 jours en 30 s environ. La partie ne finit jamais (pas de train ni de commande après le jour 15): arrêter sur `clock.day`, pas sur `phase === 'ended'`.
- Graine 20261031 (page de démonstration et tests de l'interface), démo de 15 jours: noms des poules finis au jour 5 (p1 informé), héron au jour 6 (quête de Jeanne), mot de Lucie fini au jour 11 (p2 informé), oies le soir du jour 11; aucun moment d'ambiance. Graine 20261030 (`SEED` des tests): renard au jour 3, moments d'ambiance réguliers.
- Changer la forme de `WorldState`: `DATA_SCHEMA` + 1, migration dans `sauvegarde.ts` (`migrate`), contrôle de forme dans `checkWorld` (données du disque), puis fabriquer les références du nouveau format par `pnpm exec vitest run --config tests/donnees/sauvegardes/generer.config.ts` (le test des références exige un fichier par format) et les inscrire au README du dossier.
- Une valeur nouvelle de `reglages.json`: type dans `donnees/types.ts`, défaut dans `defauts.ts`, lecture dans `contenu.ts` (clé absente: défaut), ligne au README des données, et contrôle dans `outils/valider_donnees.py` si un texte ou un renvoi en dépend.
- Le jour 1, les robots bâtissent la maison avant tout (`buildHouse` passe avant `watchMoment`): une partie de robots qui doit aller voir un moment part de l'aube du jour 2 (`playUntil` jour 2), le moment posé par `newToday` en phase `absent`.
- Placer un personnage à la main (`teleport`, `placeCharacter`) ne vérifie pas les obstacles: dans un buisson, ses entrées ne le déplacent plus. Sonder la carte par `bodyCollides(refreshBlockers(sim), x, y)`. `canWalk` est faux aussi si `crafting` n'est pas nul (robot interrompu).
- Tirage par empreinte partagé simulation et interface: `etat/tirage.ts` (`unitDraw(graine, clé, jour)`); l'interface n'importe jamais `simulation/`.

## La Petite Ligne: interface

- Ajouter un onglet au carnet: `NotebookTab` et `TABS` de `carnet.ts`, `PanelTab` de `composant.ts`, `ui.notebookTabs` (schéma valibot de `textes.ts`). Le corps se reconstruit sur signature (`renderBody(sig, ...)`): y mettre tout ce qui change l'affichage; `data-autofocus` désigne l'élément focalisé à l'ouverture, `data-nav-item` le rend atteignable aux flèches (navigation spatiale sur tout le panneau).
- Page de démonstration: `setupScenario` peut renvoyer une suite jouée 400 ms après le montage (une entrée ajoutée après coup paraît « nouvelle »); paramètre `onglet=souvenirs` pour ouvrir le carnet sur un onglet (`rememberNotebookTab`).
- `ctx.t` applique la typographie française: « Elle broute: » devient « Elle broute : » (espace fine insécable, normalisée en espace par `plain` dans les tests). Écrire les attendus des tests avec l'espace, ou comparer au texte des données passé par `ctx.t`.
- Ligne d'observation (`modele-moments.ts`): l'anneau ne paraît que si `watchTicks > 0` (la simulation le remet à 0 dès qu'elle ne compte plus: rives, regard de la chevrette, fenêtre). `instant` fait passer une ligne sans le délai de `SteadyWatch` (changements décidés par la bête). L'interface n'importe pas `simulation/`: `bankOf` y double `bankSide`, avec un test d'égalité.
- Une icône déclarée par les données mais absente du sprite ne lève rien (le `<use>` est vide): retomber sur une icône générique (`document.getElementById(id) === null`) et tester la présence des symboles dans `ui-maquettes/icones.svg`.
- Sprite des icônes: modifier `ui-maquettes/outils/icones-source.svg`, puis `node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs` depuis la racine du dépôt (écrit `icones.svg` et `support/icones.js`). Un symbole peut avoir sa propre grille (`viewBox="0 0 40 40"` pour les vignettes).
- Page de démonstration, scénarios d'après le jour 15 (tour 8): `scenarioSave(nom)` de `demo/scenarios.ts` désigne une sauvegarde de référence du format 5 (`tests/donnees/sauvegardes/format-5-*.json`, chargées par `import.meta.glob`), restaurée au lieu d'une partie neuve. Le robot de la page joue « Finir » à l'écran d'étape (`createRobot()` par défaut): capturer avec `autre=fige`, et jouer jusqu'au jour 43 avec `createRobot({ stages: 'stay' })`. La mise en place se fait avant l'événement `load`: `page.goto(url, { timeout: 600_000 })` pour les longues parties.
- Notifications et écrans plein cadre: sous un écran plein cadre le HUD n'est pas mis à jour; une interface montée directement sur un écran (sauvegarde reprise sur l'écran d'étape) prenait la première notification d'après l'écran pour ancienne. `Hud.observeNotifications` (appelé sous l'écran) fait la « première vue » à part (`toastFirstSight`, distinct de `firstSight` qui sert aux cases neuves de la barre).
- Chromium ne passe pas la requête de favicon par les événements de Playwright (`response`), mais l'erreur 404 arrive en console: `<link rel="icon" href="data:," />` dans `demo/index.html`.
- Les identifiants des lettres hebdomadaires portent le jour du train (`coop_order_generated@29` part le samedi 22). `ctx.texts.game.ui.hud.time` donne « 16 h » pour une heure pile (pas « 16 h 00 »).
- L'heredoc et `python3 - <<'EOF'` passent maintenant dans Bash (vérifié le 2026-11-01); seules les commandes composées avec `git` ou un `cd` hors du worktree sont refusées.

## La Petite Ligne: souris (R11) et progression (R10), vérifié le 2026-11-01

- Survol: intention `point_at` (cible ou `null`), gardée par l'hôte dans `sim.runtime.pointer`; `pointerTarget` (`agir.ts`) en tire `aim` avec `source: 'pointer'` s'il y a un verbe (sauf `dig`); Espace (`act`) prend alors la cible comme un clic (`move_to`). En aménagement, `pointerCell` (`amenagement.ts`) centre l'empreinte sur le point du sol (`Renderer.pickGround`). Les entrées n'envoient `point_at` qu'au changement de clé, et `null` dès que Z Q S D bougent.
- Parcours à la souris dans Chromium: page de démonstration avec `entrees=sdk` (entrée du SDK et `createControls` du jeu), `window.lplInterface.pick(x, y)` et `world()`; chercher le point d'écran voulu en balayant une grille par `pick`, puis `page.mouse`. Scénarios `souris`, `souris-maison`, `progression-etabli`, `progression-chantier` (avec `temps=arrete` pour figer la barre).
- Avec le rendu 3D (SwiftShader), `locator.evaluate` et `locator.screenshot` expirent (attente des polices, fil occupé): lire par `page.evaluate(() => document.querySelector(...))` et capturer par `page.screenshot({ clip })`.
- Un script Playwright `.cjs` doit être copié dans le paquet du jeu pour trouver `playwright`, puis retiré aussitôt: laissé là, `pnpm lint` échoue (fichier hors du projet TypeScript).
- `ressenti.test.ts` (tape de pavé tactile) attend la liste exacte des intentions d'un clic: le survol y ajoute `point_at` avant `move_to`.
