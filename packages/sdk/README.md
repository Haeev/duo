# @duo/sdk

SDK des jeux Duo (ADR 0005). Un jeu ne parle à la plateforme qu'à travers lui: cycle de vie, joueurs, boucle à pas fixe, aléa à graine, entrées, réseau, sauvegardes, résultats, audio, journal. L'API publique est dans `src/api.ts` (types commentés); ce fichier en donne l'usage.

État: API 1.0 stable (pont `1.0`). Les changements à venir n'ajouteront que des champs ou fonctions facultatifs.

## Déclarer le paquet d'un jeu

```json
{
  "dependencies": { "@duo/sdk": "workspace:*" },
  "devDependencies": { "@duo/sdk-dev": "workspace:*" }
}
```

- `duo-game.json` à la racine du paquet (manifeste, ADR 0005 point 2), importé par le jeu: `import manifest from '../duo-game.json';`.
- Vite avec `base: './'` (le jeu est servi depuis un sous-dossier, dans Duo comme dans le faux hôte).
- Valibot est réexporté par le SDK (`import { v } from '@duo/sdk'`), à la même version que lui: pas besoin de le déclarer.
- La simulation (`src/simulation/`, sans DOM) importe `@duo/sdk/sim` seulement: `createRandom`, `deriveSeed`, `hashState`, `createFixedStepper`. Ce sous-module se teste dans Node.

## Démarrer

```ts
import { connect, v } from '@duo/sdk';
import manifest from '../duo-game.json';

type Action = 'up' | 'down' | 'left' | 'right' | 'act';

const duo = await connect<Action>({ manifest });
// duo.role: 'host' | 'guest'; duo.localPlayer, duo.remotePlayer, duo.host, duo.guest
// Joueur: { id (stable, membre du duo), role, name (pseudo), color ('orb'...), colorHex ('#5CE1E6'), local }

// Chargement (progression affichée par la plateforme)
duo.reportLoading(0.5);
const clic = await duo.audio.load('sons/clic.ogg');
duo.reportLoading(1);

await duo.ready(); // attend le départ synchronisé des deux machines

duo.input.attach(canvas);
duo.loop.start({
  hz: 60,
  step: ({ tick, dt }) => {
    /* simulation: duo.input.isDown('up'), duo.input.wasPressed('act') */
  },
  render: ({ alpha }) => {
    /* rendu interpolé entre le pas précédent et le courant */
  },
});

duo.on('stop', () => {
  duo.dispose();
});
```

- La boucle s'arrête d'elle-même pendant les pauses de la plateforme (les pas, pas le rendu), et tourne fenêtre réduite.
- `duo.on('pause' | 'resume' | 'settings' | 'stop' | 'link' | 'start', ...)` renvoie une fonction de désabonnement.
- Échap n'est jamais une action: elle appartient à la pause de la plateforme.

## Typage par rôle

`connect` renvoie `HostContext | GuestContext`. Chez l'invité, `saves` et `results` n'existent pas: le compilateur l'empêche.

```ts
if (duo.role === 'host') {
  duo.saves.provide(() => ({ label: `Jour ${monde.jour}`, dataSchema: 1, data: serialiser(monde) }));
  const reprise = duo.saves.loaded; // null pour une nouvelle partie; sinon { dataSchema, data: unknown, ... }
}
```

## Réseau: l'hôte fait autorité

Les deux instances ouvrent les mêmes canaux (0 à 15), avec un mode et un schéma Valibot. Chaque message reçu est validé avant d'arriver au jeu; un message invalide est jeté et journalisé. Contenu JSON, 64 Kio au plus par message. Les messages arrivés avant le premier écouteur d'un canal sont gardés et lui sont remis.

```ts
const Intention = v.variant('kind', [
  v.strictObject({ kind: v.literal('bêcher'), x: v.number(), y: v.number() }),
  v.strictObject({ kind: v.literal('arroser'), x: v.number(), y: v.number() }),
]);
const intentions = duo.net.channel(0, { mode: 'reliable', schema: Intention }); // invité vers hôte
const evenements = duo.net.channel(1, { mode: 'reliable', schema: Evenement }); // hôte vers invité
const instantanes = duo.net.channel(2, { mode: 'latest', schema: Instantane }); // hôte vers invité, 10 à 30 par seconde

if (duo.role === 'host') {
  intentions.onMessage((intention) => appliquer(monde, intention)); // premier reçu, premier servi
} else {
  instantanes.onMessage((etat) => tampon.push(etat));
}
```

- `reliable`: dans l'ordre, une seule fois. `latest`: seul le dernier compte (instantanés).
- `duo.net.sessionTimeMs()`: heure commune aux deux machines; `duo.net.quality()`: aller-retour, gigue, `good` ou `unstable`.
- Pour envoyer les entrées brutes de l'invité: `duo.input.frame()` et le schéma `InputFrameSchema`.

## Aléa, empreinte

```ts
import { createRandom, hashState } from '@duo/sdk/sim';
const alea = duo.random('meteo'); // flux indépendant et reproductible, même suite sur les deux machines
alea.int(0, 6); alea.pick(liste); alea.getState(); // état à mettre dans une sauvegarde
hashState(monde); // empreinte stable, pour les tests et les contrôles de désynchronisation
```

`Math.random` et la lecture d'horloge sont interdits dans la simulation: le temps vient du pas.

## Entrées

- Actions du manifeste: `isDown`, `wasPressed`, `wasReleased` (appuis vus pendant un seul pas).
- Touches lues par `KeyboardEvent.code`, position physique: `KeyW` est la touche Z d'un clavier AZERTY. Réaffectation par les réglages de la machine.
- `duo.input.actionLabel('up')` donne « Z » sur un AZERTY; `keyLabel(code)` suit la disposition réelle quand le navigateur la donne, AZERTY sinon.
- Souris: `duo.input.pointer` (`x`, `y`, `ndcX`, `ndcY` pour un lancer de rayon Three.js, `left`, `right`, `wheel`), et actions liées à `left`, `middle`, `right`, `wheel-up`, `wheel-down` dans le manifeste.
- Tout est relâché à la perte du focus et pendant la pause.

## Sauvegardes et résultats (hôte)

- `saves.provide(fn)`: l'état à enregistrer quand la plateforme le demande (période `auto` du manifeste, pause, sortie). La sauvegarde de sortie est écrite avant l'événement `stop`.
- `saves.write(moment, instantané)`: écriture immédiate à un moment déclaré (`level-end`, `manual`); renvoie `ok`, `too-large`, `moment-not-declared`, `write-error` ou `refused`.
- `results.endMatch({ outcome, scores, stats, replayLabel })` pour un jeu `match`.
- `results.endSession({ progress, stats })` pour un jeu `session` qui finit de lui-même (fin de la démo). Si c'est la plateforme qui arrête la séance, le SDK répond seul.
- `results.provideSummary(() => ({ progress, stats }))` (SDK 1.2), jeu `session`: le résumé de la séance, lu quand la plateforme l'arrête (« Retour au salon ») et par `endSession()` sans argument. Duo le range dans l'historique et le montre à l'écran de fin et dans le salon (« Dernières séances »). Trois statistiques au plus, libellé de 32 caractères, valeur de 16, progression de 0 à 1: le SDK coupe ce qui dépasse. Pas de changement du pont: un jeu qui s'en sert tourne aussi dans une application plus ancienne, qui ne range simplement pas le résumé.

## Audio

Un `AudioContext`, bus `music`, `effects`, `interface`; gain effectif = volume général x volume du bus (réglages de la machine, appliqués d'eux-mêmes). `audio.load` et `audio.play` pour les effets, `audio.playMusic` pour les musiques en flux. Le contexte se réveille au premier geste du joueur.

## Journal

`duo.log.info | warn | error(message, données?)` remplace `console.log`, interdit dans le code livré.

## Jouer sans Duo: le faux hôte

Voir `packages/sdk-dev/README.md`: deux vues locales côte à côte (développement, tests Playwright), et serveur de démo sur le réseau local (deux navigateurs).
