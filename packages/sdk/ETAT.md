# État du lot L3 (SDK et faux hôte)

Compte rendu intermédiaire de l'architecte, mis à jour à chaque étape.

## Étape 1: paquets créés (fait)

- `packages/protocol` (`@duo/protocol`), `packages/sdk` (`@duo/sdk`), `packages/sdk-dev` (`@duo/sdk-dev`) existent avec package.json, tsconfig, eslint, vitest; `pnpm install` lancé une fois à la racine.
- Un jeu peut déjà déclarer `"@duo/sdk": "workspace:*"` (dépendance) et `"@duo/sdk-dev": "workspace:*"` (développement).
- L'API publique n'est pas encore stable: attendre `packages/sdk/README.md`.

## Étape 2: API publique (fait)

- `packages/sdk/src/api.ts`: types publics; `packages/sdk/README.md`: mode d'emploi pour les jeux. API stable, pont `1.0`.
- `packages/protocol`: manifeste `duo-game.json` (schéma Valibot, `parseManifest`), messages du pont, versions.
- Implémentation côté jeu écrite (`connect`, boucle, entrées, réseau, audio, sauvegardes, résultats); `tsc` et `eslint` verts sur `@duo/sdk`. Tests et faux hôte: en cours.

## Étape 3: faux hôte (fait, à documenter)

- `@duo/sdk-dev`: deux vues locales (`/deux-vues.html`) et serveur de démo sur le réseau local (`servir`), avec le jeu d'essai `games/_essais/echo`.
- Prouvé par Playwright (Chromium): un message de l'invité arrive à l'hôte et la réponse revient, en deux vues comme entre deux navigateurs par le serveur; pause par Échap, reprise, sortie avec historique.
- Lancer la démo à deux navigateurs: `pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire` (voir `packages/sdk-dev/README.md`, en cours d'écriture).
- Tests d'un jeu à deux dans Vitest: `import { startLocalDuo } from '@duo/sdk-dev'` (exemple: `games/_essais/echo/tests/echo.test.ts`).

## Étape 4: gabarit, documentation (fait)

- `packages/sdk-dev/README.md`: mode d'emploi du faux hôte, dont la procédure de secours pour jouer à deux navigateurs.
- `games/_template` (`@duo/modele-de-jeu`): gabarit d'un jeu, hôte qui fait autorité, simulation pure avec empreinte, tests; essayé en deux vues.
- ADR 0005: section « Précisions de l'implémentation » pour dev-plateforme (remise du port, `hello`, contenu JSON des messages `net`, `link`, `sessionEnd.finished`, `pauseRequest`).

## Bilan (2026-10-31)

- Vérifié: `tsc`, `eslint`, Vitest (protocol 11, sdk 23, sdk-dev 9, gabarit 3, essai 1) et Playwright (2 parcours à deux) verts; `pnpm verifier` sans problème.
- Pour La Petite Ligne: mettre `duo-game.json` à la racine du paquet (lu par le SDK au démarrage et par `servir`), `base: './'` dans Vite, puis `connect` (voir `packages/sdk/README.md`). La simulation importe `@duo/sdk/sim`.
- Démo de secours à deux navigateurs: `pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire`, puis l'adresse affichée sur l'autre ordinateur.
