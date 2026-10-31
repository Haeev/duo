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
| `--duo-liaison-port=<port>` | port de base de la liaison provisoire (défaut 39430; la seconde instance prend le suivant) |
| `--duo-peer-address=<hôte>:<port>` | liaison provisoire entre deux machines, sans découverte: chaque Duo écoute sur toutes ses interfaces et appelle l'autre |

Deux instances sur une machine: `electron . --duo-data-dir=/tmp/a` et `electron . --duo-data-dir=/tmp/b` (même port de base). Sans `--duo-games-dir`, en développement, les jeux viennent de `games/*` (manifeste à la racine du paquet, site construit dans `dist/`); dans une version empaquetée, de `resources/games/` et du dossier de données (`games/`).

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
    liaison/     interface Liaison, machine du salon et de la partie, liaison provisoire (local/)
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
- `src/main/liaison/local/`: liaison TCP provisoire. La plateforme ne dépend que de l'interface `Liaison` (`src/main/liaison/liaison.ts`); `packages/liaison` (dev-reseau) la remplace dans `index.ts`.
- Sauvegardes: un emplacement par jeu chez l'hôte, sans réplication (`data/local-saves.ts`); le lot L9 apporte celles de l'ADR 0009.
- Heure de session: `Date.now()` de chaque machine, écart 0 dans `init`; l'heure commune vient de la liaison de dev-reseau.
