# @duo/liaison

Réseau local de Duo (lot L5), pour le processus principal d'Electron: découverte des deux machines, liaison WebSocket authentifiée, salon, partie, relais des messages de jeu. Le paquet ne dépend que de Node, `ws` et `valibot`: il ne connaît ni Electron ni les fenêtres.

Conception: `docs/plateforme/reseau.md`; décisions: ADR 0006 (enveloppes figées), 0007 (modèle et transport), 0008 (découverte et pare-feu).

## En bref

```ts
import { createFileStore, createLiaison, parseNetworkCommandLine } from '@duo/liaison';

const liaison = createLiaison({
  identity: { machine: machineId, appVersion: app.getVersion(), computer: os.hostname() },
  profile: { pseudo: 'Camille', color: 'rond' },
  games: [{ id: 'la-petite-ligne', version: '0.1.0' }],
  store: createFileStore(path.join(app.getPath('userData'), 'reseau.json')),
  ...parseNetworkCommandLine(process.argv),
  log: (event, data) => journal.info(`reseau.${event}`, data),
});

liaison.on('partner', (state) => {
  // { kind: 'absent' } ou { kind: 'present', partner, link: 'connected' | 'unstable' | 'lost' }
});
liaison.on('session', (view) => {
  // salon et partie, à transmettre à la vue plateforme et au jeu
});
liaison.on('game', ({ channel, payload }) => {
  // message du jeu de l'autre machine, à remettre au jeu par son MessagePort
});

await liaison.start(); // seulement après la validation de l'écran E03 (CA-PF-079)
// ...
await liaison.stop(); // à la fermeture de Duo: bye sur la liaison et trois adieux UDP
```

Rien n'écoute avant `start()`. `start()` ouvre l'écoute TCP d'abord (c'est elle qui déclenche l'alerte du pare-feu de Windows), puis la socket UDP, puis la découverte.

### Intégration dans le principal (electron-vite)

- Le paquet expose ses sources TypeScript (`exports` vers `src/index.ts`, imports en `.ts`, syntaxe effaçable). Il doit être **regroupé** dans le principal; le tsconfig du principal porte `allowImportingTsExtensions`. L'application Duo regroupe tout (`externalizeDeps: false`).
- `ws` se regroupe sans souci: Vite remplace ses dépendances natives facultatives (`bufferutil`, `utf-8-validate`) par des modules qui lèvent une erreur dans les `try` de `ws`, qui repasse alors sur son code JavaScript (vérifié dans Electron 45 par le test Playwright à deux instances). Ne pas installer ces deux paquets natifs.
- Le principal ne doit rien faire de lourd sur son fil (ADR 0003): un blocage de 2 s ferait déclarer la liaison perdue par l'autre machine.
- Pendant un salon ou une partie, `powerSaveBlocker.start('prevent-app-suspension')` sur les deux machines (App Nap de macOS espacerait les battements).

## Options de `createLiaison`

| Option | Rôle | Par défaut |
|---|---|---|
| `identity.machine` | identifiant stable de la machine (`machine.json`, ADR 0009): 8 à 64 caractères, lettres, chiffres, tirets | obligatoire |
| `identity.appVersion` | version de Duo (SemVer), comparée en cas de protocole différent | obligatoire |
| `identity.computer` | nom de l'ordinateur (E04), tronqué à 32 caractères, jamais journalisé | obligatoire |
| `identity.instance` | identifiant de ce lancement: distingue une reprise d'un redémarrage | tiré au démarrage |
| `identity.bridge`, `electron`, `dataFormat`, `os`, `arch` | champs de l'ADR 0006, transportés tels quels dans la poignée de main | absents |
| `profile` | `{ pseudo, color }` du joueur (F01) | obligatoire |
| `games` | jeux installés `{ id, version, hash? }`, envoyés à la poignée de main | `[]` |
| `setup` | `done` ou `in-progress` (E04 « pas configuré ») | `done` |
| `store` | mémoire de la liaison: clés des duos et adresses retenues | en mémoire vive |
| `port` | port UDP et TCP de base (`--duo-port`) | 39420 |
| `peers` | destinations directes en plus des diffusions (`--duo-peer`), `"adresse:port"` ou `{ host, port }` | aucune |
| `allowLoopback` | admet les sources 127.0.0.0/8 (`--duo-allow-loopback`) | non |
| `listenHost` | adresse d'écoute | `0.0.0.0` (IPv4 seulement) |
| `pairingPolicy` | `any`: forme un duo avec tout Duo rencontré; `first-partner-only`: seulement tant qu'aucun duo n'existe | `any` (prototype, voir plus bas) |
| `config` | remplacements des valeurs de `DEFAULT_CONFIG` (cadences, seuils, plafonds) | aucun |
| `driver` | pilote réseau injecté (réseau simulé des tests) | Node: `ws`, `dgram`, `os` |
| `log` | `(event, data) => void`, événements courts sans pseudo ni nom d'ordinateur (ADR 0015) | aucun journal |
| `externalSession` | salon et partie tenus par l'application (voir « Salon externe ») | non |

`parseNetworkCommandLine(process.argv)` lit `--duo-port=<n>`, `--duo-peer=<adresse>:<port>` (répétable) et `--duo-allow-loopback`, et rend `{ port?, peers, allowLoopback, invalid }`: on peut l'étaler dans les options. Les options mal écrites sont dans `invalid`, à journaliser.

Mémoire: `createFileStore(chemin)` lit et valide un fichier JSON (illisible: mémoire vide, le duo se reforme), écrit par fichier temporaire puis renommage, droits 0600. La clé du duo est un secret de la machine: ce fichier n'est jamais répliqué ni versionné.

## L'objet `Liaison`

| Membre | Rôle |
|---|---|
| `start(): Promise<StartReport>` | ouvre l'écoute et la découverte. Rend `{ tcpPort, udpPort, problems }`: TCP essaie 39420, 39421 puis 39422; si UDP 39420 est pris, un port éphémère (on voit sans être vu) |
| `stop(): Promise<void>` | fermeture propre: `bye` sur la liaison, trois adieux UDP à 50 ms d'écart, écoute fermée |
| `on(event, listener): () => void` | abonnement typé; rend la fonction de désabonnement |
| `partner(): PartnerState` | présence du partenaire, à l'instant |
| `session(): SessionView` | salon et partie, à l'instant |
| `quality(): LinkQuality \| null` | aller-retour (médiane et 95e centile sur 10 s), gigue, écart d'horloge, silence, `good` ou `unstable` |
| `sessionTime(): number` | heure de session: horloge de l'hôte du salon où l'on est (la nôtre si l'on est hôte ou seul) |
| `now(): number` | horloge locale du module: `performance.timeOrigin + performance.now()` du principal, la base de l'heure de session du SDK |
| `interfaces()` | interfaces retenues (nom, adresse, préfixe, diffusion, physique ou virtuelle), pour Réglages > Réseau |
| `others()` | autres ordinateurs avec Duo vus sur le réseau, hors partenaire relié |
| `connectTo(adresse)` | connexion par adresse saisie (recours): virgule acceptée pour le point, trois ports essayés ensemble, 5 s au plus |
| `searchNow()` | série de requêtes immédiate (ouverture de E04 ou E17) |
| `updateProfile(profile)`, `updateGames(games)` | envoyés tout de suite à l'autre par la liaison (`profile.update`, `games.update`), et repris dans les balises et les poignées de main suivantes |
| `sendApp(type, body)` | salon externe: message fiable vers l'autre machine (une fois, dans l'ordre, à travers les reprises); `false` sans liaison. `body` ne porte ni `type` ni `seq` |
| `setActive(active)` | salon externe: régime actif (battement de 500 ms, perte à 2 s) tant que vrai |
| `lobby` | `open(game)`, `select(game)`, `join()`, `setReady(ready)`, `leave()` |
| `match` | `reportLoaded()`, `pause()`, `resume()`, `end(result, reason?)`, `send(channel, payload, mode)` |

## Événements

| Événement | Contenu | Quand |
|---|---|---|
| `partner` | `{ kind: 'absent' }` ou `{ kind: 'present', partner, link }` | à chaque changement. `present` dès la liaison authentifiée (« Sacha est là »); `link` vaut `connected`, `unstable` (reprise en cours, rien à afficher) ou `lost` (salon ou partie: « Connexion perdue »). Au repos, une liaison perdue (6 s), un `bye` ou un refus net donnent `absent` (« Sacha n'est pas visible pour l'instant. ») |
| `session` | `SessionView` | à chaque changement du salon ou de la partie |
| `game` | `{ channel, payload }` | message du jeu de l'autre machine, pendant une partie |
| `notice` | `lobby-closed`, `peer-left` (raison `bye`, `refused`, `overflow`, `reset`), `match-ended` (raison et résultat) | faits ponctuels à afficher une fois |
| `incompatible` | `{ machine, appVersion, protocol, update: 'self' \| 'peer' \| 'both' }` | un Duo au protocole différent (M-27): `update` désigne la machine à mettre à jour, la plus ancienne |
| `others` | liste des autres Duo vus | à chaque apparition ou disparition |
| `interfaces` | interfaces retenues | à chaque changement (Wi-Fi, câble) |
| `app` | `{ type, body }` | salon externe: message fiable de l'application de l'autre machine |

`partner.partner` porte `machine`, `instance`, `appVersion`, `protocol`, `pseudo`, `color`, `computer`, `games` et les champs facultatifs de l'ADR 0006.

## Salon et partie

L'hôte est la machine qui ouvre le salon; l'état vit chez lui et part complet et numéroté à chaque changement. L'invité n'envoie que des intentions.

```text
open(game)                 l'autre voit view.invitation en quelques millisecondes
join() chez l'autre        « Rejoindre » vaut « C'est parti »: l'invité est prêt
setReady(true) chez l'hôte les deux prêts: décompte de 3 s (phase countdown)
fin du décompte            phase match, match.phase loading, graine commune match.seed
reportLoaded() des deux    match.phase starting, départ commun à localTimes.startsAt
à startsAt                 match.phase playing
pause()                    match.phase paused, pause { reason: 'player', by }
resume() des deux          match.phase resuming, reprise à localTimes.resumeAt, puis playing
end(result) chez l'hôte    retour au salon des deux côtés, lastResult, notice match-ended
leave()                    l'invité quitte (la partie se clôt chez l'hôte); l'hôte ferme son salon
```

`SessionView`:

| Champ | Sens |
|---|---|
| `role` | `host`, `guest` ou `null` |
| `lobby` | le salon où l'on est (`LobbyState`): le sien si l'on est hôte, celui de l'autre si l'on a rejoint |
| `invitation` | le salon de l'autre, si l'on n'y est pas |
| `joining` | `join()` envoyé, pas encore accueilli |
| `connection` | `ok`, `unstable`, `lost` ou `absent` |
| `localTimes` | `countdownEndsAt`, `startsAt`, `resumeAt` convertis sur l'horloge locale du principal (`liaison.now()`) |
| `pausedByConnection` | chez l'invité, la liaison est perdue pendant la partie: pause locale avant tout message de l'hôte |

Règles tenues par le paquet:

- Un « Pas encore » appuyé avant la fin du décompte annule pour les deux, même s'il arrive après (marge de min(250 ms, aller-retour / 2 + 50 ms)); appuyé après, il est ignoré. La partie part si et seulement si les deux étaient prêts à la fin du décompte.
- `select(game)` remet les deux joueurs à « Pas encore ».
- Deux salons ouverts: chacun voit l'invitation de l'autre. Rejoindre ferme son propre salon une fois accueilli. Deux `join()` croisés: le salon de la machine au plus petit identifiant reste.
- Liaison perdue (2 s de silence en salon ou en partie): décompte annulé et les deux à « Pas encore »; en partie, pause des deux côtés, chacun de son côté, raison `connection`. Au retour: pause ordinaire, puis `resume()` des deux et « Reprise dans 3 ».
- L'autre redémarre (reprise impossible): l'hôte clôt la partie (`peer-restarted`) et garde son salon; l'invité perd le salon de l'hôte (`peer-left`, raison `reset`).
- `bye` reçu (l'autre ferme Duo): présence retirée aussitôt, salon et partie clos.

Heures: `localTimes` et `now()` sont sur l'horloge du principal, `performance.timeOrigin + performance.now()`: la même base que l'heure de session du SDK dans la vue jeu (sur une même machine, à la milliseconde près). L'écart à donner au jeu est donc 0 chez l'hôte et `quality().clockOffsetMs` chez l'invité.

## Salon externe

L'application Duo garde sa propre machine à états du salon et de la partie (`apps/duo/src/main/liaison/session-machine.ts`); son adaptateur (`network-liaison.ts`) crée la liaison avec `externalSession: true`:

- le salon intégré reste inutilisé; `match.send` et l'événement `game` passent à tout moment;
- l'état du salon et les intentions de l'invité voyagent par `sendApp` et l'événement `app` (types `session` et `intent`), avec les garanties de la liaison: une fois, dans l'ordre, à travers une coupure;
- l'application règle le régime par `setActive(true)` dès qu'un salon est ouvert d'un côté ou de l'autre;
- les heures de l'hôte se convertissent par `quality().clockOffsetMs` (horloge de l'autre moins la nôtre), juste même pour un message réémis après une coupure.

## Messages de jeu

```ts
liaison.match.send(0, { tick, entities }, 'latest'); // instantanés de l'hôte
liaison.match.send(1, { n, held, pressed }, 'reliable'); // entrées de l'invité
liaison.match.send(2, new Uint8Array(bytes), 'reliable'); // contenu binaire, transmis tel quel
```

- 16 canaux (0 à 15), contenu JSON ou `Uint8Array`, 64 Kio au plus par message.
- `reliable`: livré une fois, dans l'ordre, y compris à travers une coupure et une reprise. `latest`: livré dans l'ordre tant que la connexion tient; à la reprise, seul le dernier message du canal est réémis.
- Les messages ne passent que pendant une partie (de `loading` à la fin). Le contenu n'est pas lu par la plateforme: le SDK du jeu qui le reçoit le valide par son schéma.
- `send` rend `{ ok: true }` ou `{ ok: false, reason }`: `no-match`, `no-link`, `bad-channel`, `too-big`, `invalid` (JSON impossible), `rate` (au-delà de 120 messages et 512 Kio par seconde, rafale de 240 messages et 1 Mio).
- Pendant une coupure, les messages s'accumulent (4 Mio au plus) et partent à la reprise. Au-delà, la reprise devient impossible: nouvelle liaison, et la partie se clôt.

## Connexion par adresse

`connectTo(adresse)` rend `{ ok: true, already }` ou `{ ok: false, failure, peer? }`:

| `failure` | Ce que cela veut dire | Message proposé |
|---|---|---|
| `invalid-address` | saisie mal formée, aucune tentative | M-09 |
| `refused` | un ordinateur répond, Duo n'y est pas ouvert | M-10 « Duo n'y est pas ouvert » |
| `unreachable` | personne à cette adresse | M-10 « Aucun ordinateur ne répond » |
| `timeout` | aucune réponse (pare-feu, Wi-Fi qui isole, ordinateur éteint) | M-10 « pas de réponse » |
| `not-duo` | un programme répond, pas Duo | M-10 « pas Duo » |
| `protocol` | Duo de protocole différent (`peer` porte sa version) | M-27 |
| `self` | c'est l'adresse de cette machine | à proposer à l'UX |
| `busy`, `not-paired`, `bad-proof` | déjà relié à un autre Duo; duo refusé par la politique; preuve fausse | diagnostic |

L'adresse qui a marché est retenue (avec le port) et sondée toutes les 5 s quand le partenaire n'est pas relié: le recours tapé une fois sert à chaque démarrage.

## Ce que fait le paquet

- **Découverte** (ADR 0008): balise chaque seconde en diffusion dirigée sur chaque interface privée retenue (10/8, 172.16/12, 192.168/16, 169.254/16), plus les destinations `--duo-peer`; requêtes à 0, 250, 750 et 1 500 ms puis toutes les 5 s tant que le partenaire n'est pas relié, réponse directe; interfaces relues toutes les 1 à 2 s; enveloppe figée de l'ADR 0006; schémas stricts, 1 200 octets, 20 datagrammes par seconde et par source. Une balise ne montre jamais personne: elle déclenche un appel, et le partenaire n'est présent qu'une fois la liaison authentifiée.
- **Liaison** (ADR 0007): WebSocket sur `/duo/liaison`, sous-protocole `duo`, sans compression, trames de 128 Kio au plus. Le serveur refuse une source non privée (sans réponse), un en-tête `Origin` (403), un autre chemin ou sous-protocole (404), plus de 5 connexions par seconde et par adresse (503); 4 poignées de main non authentifiées à la fois. Poignée de main `hello`, `welcome` ou `reject`, `auth`, `ready`, enveloppe figée en tête.
- **Clé du duo**: à la première rencontre, échange X25519 (clés éphémères dans `hello` et `welcome`), clé dérivée par HKDF-SHA256 (sel: identifiant du duo); ensuite, preuves HMAC-SHA256 dans les deux sens à chaque connexion, sur les deux nonces, les deux machines et l'identifiant de liaison, comparées en temps constant. Une preuve fausse ferme la connexion et met l'adresse de côté 60 s.
- **Appel croisé**: une seule poignée de main à la fois; si les deux machines s'appellent, l'appel de la machine au plus petit identifiant l'emporte.
- **Vivacité**: battement de 2 s au repos, 500 ms en salon et en partie (le régime actif de l'un vaut pour les deux); tout message reçu compte comme signe de vie; reconnexion anticipée dès 1 s de silence en régime actif; liaison perdue à 2 s (actif) ou 6 s (repos); relance toutes les 250 ms pendant 10 s puis chaque seconde, sans fin. L'appelant rappelle aussitôt, l'appelé après 5 s.
- **Reprise numérotée**: numéros par sens, accusés portés par les battements, tampon de réémission de 4 Mio; une nouvelle connexion reprend la même liaison sans perte ni doublon.
- **Messages invalides**: tout message passe par son schéma; un message invalide est jeté et journalisé, dix en une minute ferment la connexion (la liaison se reprend sur une neuve); un type inconnu est ignoré (ADR 0006).

## Pas encore fait (suite du lot)

- Connexion de **transfert** (`/duo/transfert`) pour les contenus de plus de 64 Kio (sauvegardes, paquets de jeux, état complet d'une partie): à faire avec L9 et L11. En attendant, un jeu découpe lui-même un gros état en messages de 64 Kio au plus.
- Diagnostic (L12): sondes croisées `/duo/sonde`, verdicts, lectures du pare-feu de Windows et de l'autorisation « Réseau local » de macOS; rattachement d'une machine réinstallée (M-23); `match.rejoin` d'un invité relancé.
- Politique de formation du duo: `any` par défaut pour que la démo ne bute jamais sur un ancien appairage; la recommandation de `reseau.md` (`first-partner-only`) attend la décision du manager (ADR 0009, point 2).

## Banc d'essai

`@duo/liaison/sim` fournit `SimNetwork`: plusieurs machines sur une horloge manuelle, des connexions qui imitent TCP (délai, gigue, pertes réémises après 200 ms doublés, blocage en tête de file, coupures sans fermeture, fermetures par le système, processus tué) et des datagrammes qui imitent UDP (diffusion dirigée, pertes). Profils `PROFILE_R0` et `PROFILE_R1` (100 ms d'aller-retour, 20 ms de gigue, 2 % de pertes).

```ts
const net = new SimNetwork({ profile: PROFILE_R1, seed: 7 });
const mac = createLiaison({ ...options, driver: net.addHost('192.168.1.10') });
const pc = createLiaison({ ...options, driver: net.addHost('192.168.1.20', { clockOffsetMs: 5000 }) });
await Promise.all([mac.start(), pc.start()]);
net.clock.advance(100); // le temps n'avance que sur demande
net.cut('192.168.1.10', '192.168.1.20'); // coupure sur le trajet
net.restore('192.168.1.10', '192.168.1.20');
```

Commandes du paquet:

- `pnpm --filter @duo/liaison test`: tests unitaires et d'intégration (lien simulé, puis vrais sockets sur la boucle locale).
- `pnpm --filter @duo/liaison demo`: deux processus Duo sur cette machine (ports 39520 et 39530) qui se trouvent, jouent quelques secondes et se quittent; sortie 0 si tout s'est bien passé.
- `node demo/instance.ts --role=hote` sur une machine et `node demo/instance.ts --role=invite` sur une autre du même réseau: essai réel sans Electron (port 39420, diffusion).
