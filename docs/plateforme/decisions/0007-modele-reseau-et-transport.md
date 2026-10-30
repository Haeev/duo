# ADR 0007: Modèle réseau et transport

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | dev-reseau |
| À relire par | architecte-technique (topologie, contrat `net` du SDK), dev-plateforme (modules `session` et `transfer`, réplication), qa-testeur (seuils et banc) |
| Fonctions du cahier | F02, F03, F05, F06, F07, F08, F12, F13, F14 |
| Liens | `docs/plateforme/reseau.md` (conception détaillée), ADR 0003 (processus), 0004 (plantages), 0005 (SDK), 0006 (versions, enveloppes figées), 0008 (découverte et pare-feu), 0009 (données du duo), 0010 (paquets), 0013 (tests), 0015 (rapport) |

## Contexte

Deux machines seulement, dans la même pièce, sur le réseau de la maison, probablement en Wi-Fi: un Mac M1 et un PC Windows 11 supposé i3 de 2018. Le cahier 1.0 demande:

- F02: chaque Duo ouvert s'annonce, l'autre apparaît en 3 s au plus, salon ouvert ou non; adresse IP en recours, retenue.
- F03 et F05: salon avec prêt des deux côtés, décompte annulable par l'un ou l'autre; pause par Échap chez l'un ou l'autre, reprise quand les deux l'ont demandée.
- F06: pause des deux côtés en 3 s au plus, aucune pour une micro-coupure, attente sans limite, reconnexion automatique, reprise là où la partie en était tant que l'application de l'hôte reste ouverte.
- F07, F08, F12, F13: réplication des données du duo à chaque écriture, comparaison des index à chaque connexion (ADR 0009), copie d'un jeu de la machine qui a la version la plus récente vers l'autre, dans un sens ou dans l'autre (ADR 0006, 0010).

Critères chiffrés (qa-testeur): aucune pause pour une coupure de 500 ms (CA-PF-045), reconnexion moins de 5 s après le retour du lien (CA-PF-046), pause affichée en moins de 500 ms avec le profil R1 de 100 ms d'aller-retour, 20 ms de gigue et 2 % de pertes (CA-PF-035), sauvegarde de 20 Mo copiée en moins de 10 s (CA-PF-051).

Contraintes: aucun jeu n'accède au réseau (ADR 0003, 0004); seul le principal de chaque machine parle au réseau; tout message reçu est validé par schéma; hors ligne, sans service extérieur; sous macOS, une connexion TCP sortante vers le réseau local et tout envoi UDP exigent l'autorisation « Réseau local », mais pas l'acceptation d'une connexion entrante (TN3179); sous Windows, le pare-feu bloque par défaut ce qui entre, pas ce qui sort.

Essais jetables du 2026-10-30 (`reseau.md`, section 20): deux espaces de noms réseau reliés par un pont, Node 22.22, `ws` 8.22.0, coupures et pertes par nftables, débit limité par TBF.

## Options

### 1. Topologie

| Option | Pour | Contre |
|---|---|---|
| A. Connexion ouverte seulement quand un salon existe, l'invité appelant l'hôte (`architecture.md` 0.1) | exposition réduite | présence, comparaison des versions avant l'invitation, profils et index des données du duo (exigés par F02, F13, CA-PF-005, CA-PF-055) n'ont pas de canal; un seul sens possible: si l'entrée est bloquée chez l'hôte, rien ne passe |
| B. Liaison permanente entre les deux Duo dès qu'ils se voient, établie dans un sens ou dans l'autre, indépendante des rôles d'hôte et d'invité | un canal pour tout (présence, versions, données, salon, partie); passe dans le sens que pare-feu et autorisations laissent passer: le PC peut toujours appeler, le Mac peut toujours accepter | chaque Duo écoute tant qu'il est ouvert; appel croisé à arbitrer |

### 2. Transport

| Option | Pour | Contre |
|---|---|---|
| A. WebSocket sur TCP entre les principaux (`ws`) | simple, fiable, ordonné, déjà retenu par l'architecture; quelques millisecondes en Wi-Fi | une perte bloque la file: mesuré avec 2 % de pertes, 99,9e centile de 592 ms pour un flux à 30 Hz (sans pertes: 4,8 ms) |
| B. WebRTC DataChannel non fiable | pas de blocage de file | indisponible dans le principal d'Electron sans bibliothèque lourde ou vue cachée; négociation, DTLS; aucune traversée de NAT à faire sur un réseau local |
| C. UDP brut avec fiabilité maison | contrôle total, aucun blocage de file | tout à écrire et à éprouver (fiabilité, ordre, contrôle de congestion) pour un besoin que l'on n'a pas encore mesuré |

### 3. Nombre de connexions

| Option | Pour | Contre |
|---|---|---|
| A. Une seule connexion pour le contrôle, le jeu, la réplication et les paquets | une seule chose à établir et à surveiller | un message de jeu attend derrière les tranches déjà confiées au tampon d'envoi de TCP, que l'application ne peut pas doubler: mesuré, 240 ms de retard médian sur les instantanés pendant un transfert de 20 Mo |
| B. Deux connexions WebSocket sur le même port: liaison (contrôle et jeu) et transfert (contenus de plus de 64 Kio), le transfert régulé pendant une partie | mesuré: 7 ms de retard médian sur une connexion à part, et 6 ms au 95e centile une fois le transfert régulé à 2 Mio/s | une seconde connexion à authentifier et à surveiller |

### 4. Vivacité et coupures

| Option | Pour | Contre |
|---|---|---|
| A. Battement chaque seconde, perte après 3 s de silence (`architecture.md` 0.1) | simple | la pause arrive entre 3 et 4 s après la coupure, hors de F06 |
| B. Battement toutes les 500 ms, perte à 2 s, reconnexion simple | pause en 2,1 s | mesuré: une coupure d'1 s déclenche déjà la perte, à cause du recul des réémissions TCP (200, 400, 800 ms) |
| C. B, plus une reconnexion anticipée dès 1 s de silence sur une connexion neuve, et une reprise logique numérotée qui survit au changement de connexion | mesuré: aucune pause pour 500 ms ni pour 1 s de coupure; perte déclarée 1 995 à 2 047 ms après une coupure franche; liaison rétablie 48 à 72 ms après le retour du lien; aucun message fiable perdu | numéros, accusés et tampon de réémission à écrire |
| D. Battement plus rapide (250 ms), sans reconnexion anticipée | aucun code de plus | mesuré: aucun gain, car c'est le recul de TCP qui domine |

### 5. Lieu de la simulation de l'hôte

| Option | Pour | Contre |
|---|---|---|
| A. Dans la vue jeu de l'hôte (architecture) | le code d'un jeu ne tourne jamais avec les droits de Node; une seule cible par jeu; aucune latence pour le joueur hôte | la simulation dépend des minuteurs de la vue (réglés par l'ADR 0004) |
| B. Dans un processus Node de l'hôte | serveur bien séparé | du code téléchargé avec un accès complet au système; deux points d'entrée par jeu; le joueur hôte interpolé lui aussi |

### 6. Confiance entre les deux machines

| Option | Pour | Contre |
|---|---|---|
| A. Identifiant de machine seul | rien à faire | l'identifiant circule en clair dans les balises: n'importe quel appareil du réseau peut se faire passer pour l'autre et écrire dans les données du duo |
| B. Clé du duo tirée à la première rencontre (échange X25519, HKDF), preuve HMAC dans les deux sens à chaque connexion, sans chiffrement des échanges | personne ne peut se faire passer pour l'autre machine; fonctions natives de `node:crypto` (vérifiées) | confiance à la première rencontre; une clé à ranger sur chaque machine |
| C. TLS avec certificats propres au duo | chiffrement en plus | certificats à fabriquer sans bibliothèque native; contenu non sensible qui ne quitte pas la maison |

## Décision

**Topologie B, transport A, deux connexions (B), vivacité C, simulation dans la vue jeu (A), clé du duo (B).** Le détail est dans `reseau.md`; voici ce qui est tranché.

### 1. Liaison

- Chaque Duo écoute en TCP sur le port 39420 (replis 39421 et 39422, ADR 0008) dès la validation de E03 et tant qu'il est ouvert. Chacun appelle l'autre dès qu'il le voit; si deux liaisons s'établissent, les deux côtés gardent celle dont l'appelant a le plus petit identifiant de machine.
- La liaison relie deux machines; le salon donne les rôles. L'hôte d'un salon est la machine qui l'a ouvert, quel que soit le sens de la connexion.
- Chemins `/duo/liaison`, `/duo/transfert` et `/duo/sonde`, sous-protocole WebSocket `duo`, sans numéro de protocole dans le chemin. Requête refusée si l'adresse source n'est pas privée, si elle porte un en-tête `Origin`, ou si le chemin ou le sous-protocole ne conviennent pas.
- Poignée de main: `hello`, `welcome` (ou `reject` typé), `auth`, `ready`. Le `hello` commence par l'enveloppe figée de l'ADR 0006 (`app`, `envelope`, `type`, `machine`, `appVersion`, `protocol`), puis porte versions du pont et d'Electron, format des données, jeux installés, profil, duos connus et nonce. À l'établissement: versions, profils, comparaison des index des données (ADR 0009), état du salon.

### 2. Messages

- JSON en trames texte pour le contrôle, validé par les schémas Valibot de `@duo/protocol`; trames binaires pour les données du transfert et, si un jeu le choisit, pour ses messages.
- Messages de jeu relayés par les principaux sans décodage: 16 canaux par partie, mode `reliable` (livré une fois, dans l'ordre, y compris à travers une reprise) ou `latest` (seul le dernier message du canal est réémis après une reprise); 64 Kio par message, 120 messages et 512 Kio par seconde et par sens.
- Un `type` inconnu est ignoré et journalisé; le protocole (entier) ne change que pour une incompatibilité (ADR 0006).

### 3. Vivacité, coupures, reprise

| Paramètre | Repos | Salon et partie |
|---|---|---|
| Battement | 2 s | 500 ms |
| Reconnexion anticipée | non | dès 1 s de silence |
| Liaison perdue | 6 s de silence | 2 s de silence |
| Relance | toutes les 250 ms pendant 10 s, puis chaque seconde, sans fin | idem |

- Tout message reçu compte comme signe de vie. Une connexion fermée sans `bye` ne met rien en pause par elle-même: seul le silence décide.
- La liaison est une session logique (identifiant, numéros dans chaque sens, accusés portés par les battements, tampon de réémission de 4 Mio ou 30 s). Une nouvelle connexion la reprend sans perte ni doublon. Reprise impossible (application redémarrée): nouvelle liaison, et resynchronisation par les couches du dessus.
- En partie, chaque machine met son jeu en pause d'elle-même à la perte, sans attendre l'autre. Au retour: pause ordinaire, puis reprise à deux (H-09).
- Fermeture propre: `bye`, et l'autre revient au salon sans attendre (H-13).

### 4. Salon et partie

- État du salon dans le principal de l'hôte, machine à états pure; l'invité envoie des intentions, l'hôte répond par l'état complet numéroté.
- Décomptes du salon et de la reprise, et départ de la partie, fixés à une heure de session commune (horloge de l'hôte, écart estimé sur l'aller-retour le plus court des 16 derniers battements). Une annulation horodatée avant la fin du décompte est honorée si elle arrive dans une marge de min(250 ms, aller-retour / 2 + 50 ms).
- Deux salons à la fois: le premier `join` traité l'emporte; en cas de croisement, c'est le salon de la machine au plus petit identifiant qui reste.

### 5. Transfert

- Contenus de plus de 64 Kio (révisions de sauvegarde compressées, gros index, historique en lot, paquets de jeux, état complet d'une partie) par la connexion de transfert, en tranches de 256 Kio, 1 Mio en vol, reprise à la position atteinte, empreinte de l'ensemble vérifiée avant remise au module `data` ou `packages`.
- Pendant une partie, l'émetteur régule son débit: départ à 2 Mio/s, plafond de 4 Mio/s, plancher de 256 Kio/s, division par deux dès que l'aller-retour médian de la liaison dépasse de 15 ms son minimum récent.
- Copie d'un jeu de la machine qui a la version la plus récente vers l'autre, dans un sens ou dans l'autre (ADR 0006, 0010).

### 6. Modèles de synchronisation offerts aux jeux

- **Hôte qui fait autorité** (`host-authority`, par défaut): simulation à pas fixe dans la vue jeu de l'hôte; instantanés à 20 ou 30 par seconde (`latest`); entrées numérotées de l'invité (`reliable`), jamais d'état; interpolation chez l'invité (retard de deux intervalles plus la gigue, entre 50 et 250 ms); prédiction et réconciliation facultatives; entrées de l'invité considérées relâchées après 200 ms sans nouvelles.
- **Lockstep déterministe** (`lockstep`): graine, pas fixe, retard d'entrée adapté à l'aller-retour (2 à 8 pas), empreinte de l'état tous les 30 pas, état complet de l'hôte en cas d'écart; même version du jeu et même Electron exigés (ADR 0006); aucune fonction mathématique approchée dans la simulation.
- **Tour par tour et événements** (`turns`): intentions numérotées de l'invité, validées et diffusées par l'hôte.
- Chaque jeu choisit son modèle dans son cahier des charges, avec dev-reseau et l'architecte. Un canal non fiable (datagrammes UDP entre les principaux) ne viendra que si un jeu d'action le justifie, sur mesure chez le client: plus d'un à-coup de plus de 150 ms par minute sur les instantanés.
- API `net` du SDK: `reseau.md`, section 12.6, proposée pour l'ADR 0005.

### 7. Confiance

- À la formation du duo (ADR 0009), échange X25519 sur la liaison, clé dérivée par HKDF-SHA256 (sel: identifiant du duo). À chaque connexion, preuve HMAC-SHA256 de chaque côté sur les deux nonces et les deux identifiants de machine, comparée en temps constant; la reprise et la connexion de transfert sont couvertes par la même clé.
- Une liaison non appairée (première rencontre, rattachement d'une machine réinstallée) ne porte que présence, versions, formation et rattachement.
- Clé et adresses retenues dans `<userData>/reseau.json`, propre à la machine, jamais répliqué.
- Pas de chiffrement en version 1. Les paquets de jeux restent protégés par leur signature (ADR 0010).

## Conséquences

- Une seule liaison porte tout ce que les deux machines se disent, du premier lancement à la fin de la soirée; les fonctions F02, F03, F05 à F08, F12 et F13 n'ont pas de canal à elles.
- La liaison s'établit dans le sens qui passe: un PC dont le pare-feu bloque Duo en entrée, ou un Mac privé de l'autorisation « Réseau local » mais joint par son adresse retenue, n'empêchent plus de jouer. Le diagnostic le signale quand même.
- Une micro-coupure, même d'1 s, reste invisible; une vraie coupure met en pause en 2,1 s environ et se répare d'elle-même en moins d'une seconde après le retour du lien.
- Le transfert d'une sauvegarde ou d'un jeu ne gêne pas la partie en cours.
- Avec 2 % de pertes réelles, TCP provoque des à-coups (jusqu'à 600 ms sur un flux à 30 Hz): acceptables pour les jeux de la version 1 et invisibles sur un Wi-Fi ordinaire, qui réémet lui-même ses trames; c'est la limite connue du choix de TCP.
- Chaque Duo écoute tant qu'il est ouvert: l'exposition est limitée au réseau local, aux adresses privées et aux poignées de main authentifiées.
- Coût: numérotation, accusés et tampon de réémission, deux connexions, une machine à états de la liaison, tous testables en unitaire grâce à un transport et une horloge injectés (`reseau.md`, section 18).
- Écarts avec `architecture.md`: écoute permanente au lieu d'une écoute limitée au salon; deux connexions au lieu d'une; liaison indépendante des rôles; battement de 500 ms et perte à 2 s au lieu d'1 s et 3 s; reprise logique au lieu d'une reconnexion suivie d'un instantané complet; authentification par clé du duo (`reseau.md`, section 22).

### À vérifier

- Délai minimal de réémission TCP sous Windows et sous macOS, et silences réels du Wi-Fi du client: histogramme des silences du journal, dès le prototype, pour recaler les seuils.
- Pause affichée en moins de 500 ms avec R1 quand le message de pause lui-même se perd (CA-PF-035): à mesurer au banc; parade prête (trois petits battements après un message de pause).
- Battements d'un Duo caché sous macOS (App Nap), au repos et pendant une invitation (ADR 0008).
- Retard de la boucle d'événements du principal sur le PC de référence pendant une écriture de sauvegarde (ADR 0003, 0009).
