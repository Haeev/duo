# Gabarit d'un jeu Duo

Point de départ d'un nouveau jeu (ADR 0005, point 7): copier ce dossier sous `games/<id>`, changer `name` dans `package.json`, et `id`, `name`, `description`, `actions` dans `duo-game.json`.

- `duo-game.json`: manifeste, validé par le SDK au démarrage et par le test du gabarit.
- `src/simulation/`: logique pure, sans DOM ni horloge ni `Math.random`, avec `empreinte` (`hashState` du SDK); valeurs de jeu dans `reglages.ts`.
- `src/main.ts`: hôte qui fait autorité. L'invité envoie ses commandes (canal 0, `reliable`), l'hôte simule et diffuse des instantanés (canal 1, `latest`).
- Développer à deux: `pnpm --filter @duo/modele-de-jeu dev`, `pnpm --filter @duo/sdk-dev dev`, puis `http://localhost:5180/deux-vues.html?jeu=http://localhost:5173/`.
- Mode d'emploi du SDK: `packages/sdk/README.md`; faux hôte: `packages/sdk-dev/README.md`.
