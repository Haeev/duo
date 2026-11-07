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

## Deux Tabliers, chantier service (vérifié le 2026-11-07)

- Visée (`simulation/visee.ts`): un poste est visé au centre du meuble avec un rayon de la moitié de sa plus petite empreinte, et une cible « actionnable » gagne: un gros meuble-poste vole la visée des tasses posées dessus. Remèdes: de petits meubles pour les pièces (groupes, buse posés sur la machine), et des `transforms` à l'identique (`tasse` vers `tasse`) pour qu'un poste ne soit une cible que si son récipient est posé (sinon refus « Pose d'abord : tasse », et l'objet voisin gagne).
- Postes « au clic » menés par le chantier (maintien lu dans `sim.inputs[p].actHeld`, durées en pas depuis `startTick`): recopier l'avancement dans `players[p].use` donne l'anneau du HUD et « Poste occupé » chez l'autre sans toucher au cœur, à condition que `seconds` du poste soit grand (600) pour que `advanceUse` ne termine jamais.
- Étendre un domaine sans monter `WORLD_FORMAT`: champs `v.optional(schéma, () => défaut)` dans le `strictObject`; une sauvegarde ancienne se relit avec les défauts.
- `etat.ts` d'un chantier ne doit pas importer `etat/monde.ts` (cycle à l'initialisation: `monde.ts` importe le schéma du chantier). Redéclarer `v.picklist([0, 1])`.
- Ajouter des intentions de chantier fait échouer le lint de `simulation/pas.ts` (`switch` sans les nouveaux cas): une ligne `eslint-disable-next-line ... -- raison` suffit, identique pour chaque chantier.
- `prettier --write` sur `donnees/` réaligne les tableaux de `SCHEMA.md`: ne formater que les JSON. Pour toucher un JSON commun sans conflit, remplacer les éléments par identifiant en gardant le texte des autres (`outils/service-donnees.mjs`, `mergeFile`).
- Worktree isolée: les commandes Bash avec heredoc, `$(...)` ou enchaînements longs sont refusées; écrire les scripts avec Write et lancer des commandes simples.
