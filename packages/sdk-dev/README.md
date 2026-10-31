# @duo/sdk-dev: le faux hôte

Fait tourner un jeu Duo sans l'application (ADR 0005, point 7): la page du faux hôte joue le rôle de la plateforme (pont `MessagePort`, cycle de vie, pause, sauvegardes, historique) et relie les deux instances du jeu. Trois usages:

| Usage | Pour quoi | Comment |
|---|---|---|
| Deux vues locales | développer, essayer, tests Playwright | hôte et invité côte à côte dans une page, relais local à latence réglable |
| Réseau local | jouer à la démo sur deux ordinateurs, sans Duo | un petit serveur Node sur une machine, un navigateur sur chacune |
| Tests Vitest à deux | logique réseau d'un jeu, dans Node | `startLocalDuo` relie deux instances du SDK en mémoire |

## Jouer à deux sur le réseau local (filet de sécurité de la démo)

Sur la machine qui sert (le Mac), depuis le dossier du dépôt:

```sh
pnpm install
pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire
```

- `--construire` construit le jeu avant de le servir (sinon: `pnpm --filter @duo/la-petite-ligne build` d'abord).
- Le terminal affiche les adresses: `http://localhost:8080/` sur cette machine, `http://192.168.x.y:8080/` pour l'autre ordinateur du même réseau.
- macOS peut demander d'autoriser `node` à recevoir des connexions: accepter. Le PC n'installe rien, il ouvre seulement l'adresse dans Edge ou Chrome.
- Chacun choisit son pseudo et sa couleur (gardés par le navigateur), puis l'un clique « Héberger » et l'autre « Rejoindre ». L'hôte choisit de continuer la dernière sauvegarde ou de commencer une nouvelle partie.
- Échap met les deux en pause (volumes, « Reprendre », « Quitter la partie »).
- Sauvegardes et historique: sur le disque de la machine qui sert, dans `~/Duo-demo/<jeu>/` (`sauvegardes/emplacement-1.json`, la version précédente en `.bak`, `historique.jsonl`). Autre dossier: `--donnees <dossier>`. Autre port: `--port 8081`.
- Une coupure (page rechargée, Wi-Fi perdu) arrête la partie des deux côtés; la dernière sauvegarde reste. On repart de l'accueil avec « Héberger et continuer ».
- Ctrl+C dans le terminal arrête le serveur.

Navigateurs: Chrome ou Edge récents conseillés (le même moteur que Duo). Sur une adresse `http://192.168...`, le navigateur ne donne pas la disposition du clavier: les libellés des touches suivent alors l'AZERTY.

## Deux vues locales

- Avec le serveur ci-dessus: `http://localhost:8080/deux-vues.html`.
- En développement, avec le serveur de Vite du jeu (rechargement à chaud):

  ```sh
  pnpm --filter @duo/la-petite-ligne dev        # jeu sur http://localhost:5173/
  pnpm --filter @duo/sdk-dev dev                # faux hôte sur http://localhost:5180/
  ```

  puis `http://localhost:5180/deux-vues.html?jeu=http://localhost:5173/`.

Paramètres d'adresse: `jeu` (page du jeu, son `duo-game.json` est lu à côté), `latence` (ms, 30 par défaut), `gigue` (ms, 5), `pertes` (pourcentage de messages retardés de 200 ms comme une réémission TCP, 0), `hote` et `invite` (pseudos), `couleur-hote` et `couleur-invite` (`orb`, `crescent`, `star`, `sun`, `planet`, `comet`). La barre du haut règle latence, gigue et réémissions pendant la partie. Les sauvegardes de ce mode vivent dans le navigateur (« Effacer les sauvegardes »). Un rechargement complet du jeu relance les deux vues.

Chaque vue porte `data-statut` (`waiting-peer`, `loading`, `waiting-start`, `running`, `paused`, `ended`, `stopped`, `error`), et `window.__duoDeuxVues` donne accès aux deux vues: de quoi écrire un test Playwright à deux contextes (exemple: `tests/e2e/faux-hote.spec.ts`).

## Tests d'un jeu à deux dans Vitest

```ts
import { startLocalDuo } from '@duo/sdk-dev';
import manifest from '../duo-game.json';

const duo = await startLocalDuo({ manifest, conditions: { latencyMs: 20 }, seed: 7 });
await duo.start();
// duo.hostGame et duo.guestGame: deux contextes du vrai SDK, reliés par la fausse plateforme
duo.dispose();
```

Exemple complet: `games/_essais/echo/tests/echo.test.ts`.

## Ce que le faux hôte simplifie

- Reprise après coupure: la partie s'arrête, sans reconnexion ni réémission (la vraie liaison de Duo le fera, ADR 0007).
- Pause: Échap ou le bouton de l'un met les deux en pause; « Reprendre » de l'un relance les deux (Duo attendra les deux).
- Un seul emplacement de sauvegarde (le premier), sans copies de secours ni réplication sur l'autre machine.
- Pas de contrôle de débit des messages; taille et validation des messages comme dans Duo.

## Contenu

- `src/coeur/`: fausse plateforme sans DOM (`plateforme.ts`), relais local (`lien.ts`), messages entre les deux plateformes (`pair.ts`), stockage (`stockage.ts`), `startLocalDuo` (`duo-local.ts`).
- `src/coque/`: pages du navigateur (`index.html` accueil du réseau local, `deux-vues.html`), écrans de la plateforme (`vue.ts`).
- `src/serveur/`: serveur `servir` (Node, lancé sans construction), relais WebSocket (`relais.ts`), sauvegardes sur disque (`disque.ts`).
- Tests: `pnpm --filter @duo/sdk-dev test` (Vitest), `pnpm --filter @duo/sdk-dev test:e2e` (construit le jeu d'essai et les pages, puis Playwright).
