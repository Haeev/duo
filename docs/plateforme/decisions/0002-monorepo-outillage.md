# ADR 0002: Monorepo et outillage

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | ingenieur-build (responsable du lot L1) |
| Fonctions du cahier | F12 (un paquet par jeu), section 6 |
| Liens | ADR 0001 (versions), 0005 (contrat des jeux), 0013 (tests et CI) |

## Contexte

L'orientation validée prévoit un monorepo: l'application, un SDK commun, un paquet par jeu. Les jeux arriveront un par un pendant des années; chacun doit déclarer ses dépendances, garder sa version de moteur et ne jamais dépendre d'un autre jeu (CLAUDE.md: le code partagé monte dans des paquets, il n'est jamais copié). Les deux joueurs sont sur macOS et Windows, et l'équipe travaille sous Linux: chaque commande du dépôt doit tourner sur les trois systèmes.

## Options

### Gestionnaire de paquets

| Critère | npm workspaces | pnpm workspaces | Yarn 4 |
|---|---|---|---|
| Installation | déjà présent | par corepack (présent avec Node 22), version figée par le champ `packageManager` | par corepack |
| Dépendances fantômes (un jeu qui importe `three` sans le déclarer) | possibles: installation à plat | refusées: liens stricts | refusées en mode PnP, qui gêne Electron et certains outils |
| Une version commune d'un moteur pour plusieurs jeux | à surveiller à la main | catalogues (`catalog:`) | `resolutions`, moins souple |
| Commandes ciblées | `-w`, sans les dépendances | `--filter`, avec les dépendances | `workspaces foreach` |
| Scripts d'installation des dépendances | exécutés | bloqués par défaut, autorisés un par un | exécutés |

### Découpage du dépôt

| Option | Pour | Contre |
|---|---|---|
| Un monorepo (application, paquets partagés, jeux) | une modification du SDK et du jeu qui l'utilise dans le même commit; CI unique; gabarit à jour | dépôt qui grossit avec les assets |
| Un dépôt par jeu | dépôts légers | SDK publié et versionné à part, synchronisation pénible, contraire à l'orientation validée |

## Décision

1. **Monorepo pnpm 12.16.1**, activé par corepack (`"packageManager": "pnpm@12.16.1"`), fichier de verrouillage versionné, versions exactes. Les scripts d'installation restent bloqués, sauf liste explicite (`onlyBuiltDependencies`). Depuis Electron 42, le paquet `electron` n'a plus de `postinstall` (vérifié sur 45.2.0): le binaire se télécharge au premier lancement ou par `npx install-electron --no`, ce que la CI met en cache.
2. **Arborescence**:

```text
duo/
  apps/
    duo/                    application Electron
      src/main/             processus principal (modules de l'ADR 0003)
      src/preload/          preload-platform, preload-game
      src/renderer/         lanceur et écrans superposés (ADR 0012)
      tests/e2e/            Playwright sur Electron
  packages/
    protocol/               @duo/protocol: schémas Valibot (IPC, pont, liaison LAN, manifeste, catalogue, données) et numéros de version
    sdk/                    @duo/sdk: API des jeux (ADR 0005)
    sdk-dev/                @duo/sdk-dev: faux hôte navigateur, relais local avec latence simulée, aides de test
    config/                 tsconfig, ESLint, Vitest partagés
  games/
    _template/              gabarit copié par `pnpm nouveau-jeu <id>`
    _essais/                jeux d'essai pour les tests, jamais publiés (ADR 0013)
    jeu-temoin/
      src/simulation/       logique pure, testable dans Node
      src/render/           Three.js, PixiJS ou Phaser
      assets/               fichiers livrés et leurs sources
      duo-game.json         manifeste (ADR 0005)
  outils/                   scripts du dépôt, en Node (création de jeu, empaquetage, signature, contrôles)
  docs/
```

3. **Règles de dépendance**, vérifiées par un contrôle en CI: un jeu dépend de `@duo/sdk` et de son moteur, jamais d'un autre jeu ni de `apps/duo`; `apps/duo` ne dépend d'aucun jeu (le jeu témoin y est copié comme paquet signé au moment de l'empaquetage, ADR 0010); `@duo/protocol` ne dépend que de Valibot. Les moteurs sont déclarés dans un catalogue pnpm; un jeu peut figer sa propre version pour garder celle de ses tests.
4. **TypeScript**: une configuration de base partagée, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`, `moduleResolution: "bundler"` (tout le code livré passe par Vite ou electron-vite).
5. **Qualité**:
   - ESLint 10 (configuration plate) et typescript-eslint en mode typé, règles strictes: `no-explicit-any`, `no-non-null-assertion`, `no-floating-promises`, `explicit-module-boundary-types`, `switch-exhaustiveness-check` (unions discriminées), `no-console` et `no-debugger` hors des tests. Une dérogation (un `any` justifié, par exemple) passe par un commentaire `eslint-disable-next-line` qui donne sa raison, vérifié en revue.
   - Prettier 3.9 pour le formatage; `.editorconfig`; `.gitattributes` avec `* text=auto eol=lf` pour que les fins de ligne soient les mêmes sous Windows.
   - Contrôles du dépôt en un script Node (`pnpm controler`), lancé en CI et avant chaque rendu: aucun tiret cadratin ni demi-cadratin (équivalent du `grep` de CLAUDE.md, qui reste la référence), aucun `TODO` sans référence (`TODO(#12)`), aucune ressource externe absente de `CREDITS.md`, règles de dépendance du point 3.
6. **Scripts communs**, tous en Node, sans bash, pour que Windows lance tout: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm controler`, `pnpm nouveau-jeu <id>`, `pnpm paquet:jeu <id>`.
7. **Assets lourds**: pas de Git LFS pour l'instant (quota limité, complexité); un fichier versionné ne dépasse pas 50 Mo. Si un jeu en a besoin, décision à prendre dans son cahier des charges.

## Conséquences

- Une dépendance oubliée casse la construction au lieu de passer en silence; ajouter un jeu ne touche ni l'application ni les autres jeux.
- Le gabarit `_template` est la documentation exécutable du contrat des jeux: il est construit et testé en CI à chaque push, donc toujours à jour.
- L'archive de l'application ne contient pas de `node_modules`: le principal est empaqueté avec ses dépendances par electron-vite.

### À vérifier

- electron-builder 26 avec pnpm quand l'application est entièrement empaquetée par Vite (aucun `node_modules` embarqué): à confirmer au lot L7; repli `node-linker=hoisted` pour `apps/duo` seul.
- Cache du binaire Electron et de pnpm sur les runners macOS et Windows (lot L1).
