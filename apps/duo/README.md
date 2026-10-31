# duo: l'application

Application Electron 45 de Duo (lot L2): processus principal, preloads en bac à sable, vue plateforme en Preact à l'identité « Étoile double », hébergement des jeux dans une `WebContentsView` par partie, pont `MessagePort` du protocole 1.0. Décisions suivies: ADR 0001, 0003, 0004, 0005, 0009 (données de la machine), 0011 (identifiants), 0012, 0013, 0015 (journal).

## Commandes

Depuis `apps/duo`:

| Commande | Effet |
|---|---|
| `pnpm build` | construit `out/` (principal, preloads CommonJS, interface) |
| `pnpm build:test` | idem avec `DUO_TEST` vrai (crochets de test, ADR 0013) |
| `pnpm start` | lance l'application construite |
| `pnpm dev` | serveur de Vite pour l'interface et relance du principal |
| `pnpm test` | tests unitaires (Vitest) |
| `pnpm test:e2e` | tests Playwright: Electron (deux instances) et écrans dans Chromium; construire avant |

Sous Linux sans écran: `xvfb-run -a -s "-screen 0 1600x1000x24" pnpm test:e2e`. Les tests qui envoient Échap ont besoin de `xdotool` (vraie touche X11: les touches simulées par Playwright ne passent pas par `before-input-event`). En root (environnement cloud), l'aide de test ajoute `--no-sandbox`.

## Options de ligne de commande (aussi dans les versions publiées)

| Option | Rôle |
|---|---|
| `--duo-data-dir=<dossier>` | dossier de données, appliqué avant le verrou d'instance unique: deux instances aux dossiers distincts coexistent |
| `--duo-games-dir=<dossier>` | dossier de jeux supplémentaire; chaque sous-dossier porte l'identifiant du jeu: paquet à plat (`<id>/duo-game.json`) ou paquet du dépôt (`<id>/duo-game.json` et le site dans `<id>/dist/`) |
| `--duo-port=<n>` | port UDP et TCP de base du réseau local (39420 par défaut; replis TCP sur les deux suivants) |
| `--duo-peer=<adresse>:<port>` | destination directe en plus des diffusions, répétable (boucle locale, réseau qui filtre la diffusion) |
| `--duo-allow-loopback` | admet les sources 127.0.0.0/8 et n'écoute que sur la boucle locale (deux instances sur une machine) |

Deux instances sur une machine: `electron . --duo-data-dir=/tmp/a --duo-port=41410 --duo-peer=127.0.0.1:41415 --duo-allow-loopback` et `electron . --duo-data-dir=/tmp/b --duo-port=41415 --duo-peer=127.0.0.1:41410 --duo-allow-loopback`. Sur deux machines du même réseau: aucune option, les deux Duo se trouvent par diffusion sur le port 39420.

Version de test seulement (`pnpm build:test`): la variable d'environnement `DUO_TEST_GAME_QUERY` ajoute des paramètres à l'adresse du jeu (`rendu=leger` pour La Petite Ligne dans le Chromium logiciel du cloud). Sans `--duo-games-dir`, en développement, les jeux viennent de `games/*` (manifeste à la racine du paquet, site construit dans `dist/`); dans une version empaquetée, de `resources/games/` et du dossier de données (`games/`).

## Organisation

```text
src/
  shared/        types et règles communs (état publié, canaux IPC, pseudo, profils de joueur)
  preload/       platform.ts (window.duo), game.ts (port du pont, avec relais)
  main/
    index.ts     ordre de démarrage, IPC, fenêtre, crochets de test
    platform.ts  état publié, intentions, réconciliation de la partie avec la vue jeu
    window.ts    BaseWindow, vue plateforme (pleine, bandeau d'indication, masquée)
    protocols.ts duo://app/ et duo-game://<id>/ (CSP, chemins contrôlés, requêtes partielles)
    game-host/   vue jeu, pont, battement de cœur
    liaison/     interface Liaison, machine du salon et de la partie, adaptateur réseau (network-liaison.ts), liaison provisoire (local/, tests)
    data/        écriture sûre, machine.json, profile.json, settings.json, sauvegardes du prototype
    games/       catalogue et manifeste
    protocol/    copie à l'identique de packages/protocol/src (provisoire)
  renderer/      interface Preact: textes.ts (fichier de textes unique), écrans, faux pont
tests/
  unit/          Vitest
  e2e/           Playwright (fumée, partie à deux, écrans)
  fixtures/jeux/ jeu d'essai du pont, sans SDK
```

## Provisoire, à reprendre à la fusion

- `src/main/protocol/`: copie de `packages/protocol/src`; remplacer les imports `../protocol` par `@duo/protocol` (dépendance `workspace:*`) et supprimer le dossier.
- `src/main/liaison/local/`: liaison TCP provisoire, gardée pour ses tests unitaires. `index.ts` branche `NetworkLiaison` (`network-liaison.ts`), l'adaptateur sur `@duo/liaison` (dev-reseau): découverte, liaison authentifiée par la clé du duo (`<userData>/reseau.json`), vivacité, reprise numérotée, heure de session et relais; le salon et la partie restent ceux de `session-machine.ts`. Les schémas des messages du salon viennent encore de `local/wire.ts`.
- Sauvegardes: un emplacement par jeu chez l'hôte, sans réplication (`data/local-saves.ts`); le lot L9 apporte celles de l'ADR 0009.
- Heure de session: celle de l'hôte, sur la base `performance.timeOrigin + performance.now()` du SDK; écart fourni par `liaison.sessionOffsetMs()` dans `init` et tenu à jour chaque seconde par les messages `link` (qualité du lien). Le départ reste « tout de suite » à la réception de la phase `playing`: un départ fixé à une heure commune un peu plus tard (reseau.md, section 10.1) est la prochaine étape.
