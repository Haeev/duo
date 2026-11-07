# Carnet de dev-gameplay-3d

Apprentissages durables et vérifiés. Ni avancement ni secret.

## SDK et faux hôte (vérifié le 2026-10-31)

- Un message de `net.channel(...).send` fait 64 Kio au plus une fois en JSON: au-delà, `send` lève une `RangeError`. Envoyer l'état complet seulement quand il change, et les positions à part (canal `latest`).
- `startLocalDuo` (`@duo/sdk-dev`) relie deux vrais SDK en mémoire: on fait avancer les deux séances à la main (`step`, puis `await setTimeout`), sans `duo.loop`, pour tester le réseau du jeu dans Vitest.
- Dans l'environnement cloud, deux vues WebGL dans `deux-vues.html` (rendu logiciel SwiftShader) rendent une image toutes les quelques secondes: le faux hôte peut déclarer « Le jeu ne répond plus ». Réduire la fenêtre Playwright (900x420) pour les essais; la partie complète se prouve par robot dans Node.
- Les journaux du jeu (`duo.log`) ne vont pas dans la console du navigateur: les lire dans `window.__duoDeuxVues.views[i].logs`.

## Outillage

- Vitest du dépôt n'affiche pas `console.info` par défaut: `--silent=false --reporter=verbose` pour un essai exploratoire.
- `pgrep -f "pnpm install"` trouve aussi la commande qui contient ce texte: regarder `ps aux | grep "[p]npm"`.
- `pnpm install` ajoute de lui-même à `minimumReleaseAgeExclude` (pnpm-workspace.yaml) les paquets publiés depuis moins d'un jour: le signaler au manager.
- TypeScript: une méthode `fail(): never` appelée par `this.fail()` restreint le type, mais une fonction passée en paramètre ou appelée dans une boucle `for...of` sur une chaîne non: utiliser une aide `need(valeur, lecteur, message)`.
- ESLint du dépôt: `switch-exhaustiveness-check` exige tous les cas d'une union même avec `default`; préférer des `if` pour ne traiter que quelques cas.

## Deux Tabliers, aménagement (vérifié le 2026-11-07)

- GLB à textures externes (`textures/<nom>.jpg` à côté des modèles): importés par `?url`, Vite renomme le GLB mais ne copie pas ses textures (404, meubles noirs). `rendu/modeles.ts` les importe aussi par `import.meta.glob` et les sert par `loader.manager.setURLModifier`.
- Lint du dépôt: un `switch` avec `default` sur l'union des intentions casse dès qu'un chantier ajoute les siennes (`switch-exhaustiveness-check`): des `if` dans le cœur. `a.carry === null || a.carry.handles[i] === null` déclenche `prefer-optional-chain` alors que l'optionnel changerait le sens (`undefined`): passer par une petite aide.
- Grille de passages (C13) de 1 700 cases sur 70 obstacles: 3,3 ms par vérification avec `Math.cos` à chaque test, 1,1 ms avec les obstacles aplatis (cosinus et sinus calculés une fois). Ne revérifier le fantôme que quand sa pose aimantée change.
- Invité qui porte à deux: sa position vient de la charge; la correction douce à 30 % de la marche le laisse 60 cm en arrière à 1,2 m/s. La rattraper au double de la vitesse de port.
- Banc de captures sans le faux hôte: une page Vite temporaire (`banc.html` et un script dans le dossier du jeu, `vite build --config` copié dans le jeu, sortie dans le scratchpad), le monde construit par les vraies intentions (`stepWorld`), servie par `python3 -m http.server`. Supprimer les fichiers du banc avant de rendre.
- Le scratchpad est partagé entre membres en parallèle: un autre a réécrit `capture.cjs` pendant la mission. Toujours un sous-dossier à soi.
- Faux hôte sous Playwright: un clic sur le canevas de l'iframe verrouille bien le pointeur en headless; les touches (`KeyB`, `Tab`) arrivent ensuite au jeu, et les boutons d'un panneau se cliquent par `frame.evaluate`.
