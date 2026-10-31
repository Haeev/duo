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
