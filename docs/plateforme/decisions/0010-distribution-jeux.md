# ADR 0010: Distribution des jeux

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | ingenieur-build (publication et signature en CI), dev-plateforme (installation), dev-reseau (copie par la liaison) |
| Fonctions du cahier | F12, F13, F04; section 6 (« paquets signés, installés sans réinstaller l'application », dépôt public) |
| Liens | ADR 0005 (manifeste), 0006 (choix de la version), 0011 (installateurs et mises à jour de Duo, ingenieur-build) |

## Contexte

F12: ajouter ou mettre à jour un jeu sans réinstaller l'application; téléchargement automatique en arrière-plan, jamais pendant une partie; copie depuis l'autre ordinateur par le réseau local si l'un n'a pas Internet; installation depuis un fichier en recours; Internet sert seulement à récupérer les jeux. F13 1.0: on joue la version la plus récente présente sur l'une des deux machines, copiée vers l'autre en une action (ADR 0006). Le dépôt `Haeev/duo` est public (Q3): ses fichiers de release se téléchargent sans authentification. Pas de CDN, pas de serveur du studio.

Faits vérifiés le 2026-10-30: les adresses directes `https://github.com/<dépôt>/releases/download/<tag>/<fichier>` d'un dépôt public répondent par une redirection vers le fichier, sans jeton et sans consommer le quota de l'API GitHub (c'est ainsi que `@electron/get` télécharge Electron); Node vérifie Ed25519 sans dépendance (`crypto.verify(null, ...)`, essai jetable: signature de 64 octets, falsification détectée); yauzl 3.4.0 refuse d'office les noms d'entrée absolus, avec `..` ou des barres obliques inverses (`validateFileName`, appliqué à chaque entrée tant que `decodeStrings` est vrai, lu dans sa documentation).

## Options

### Mode de distribution

| Option | Satisfait F12 et F13 | Sans Internet | Coût |
|---|---|---|---|
| A. Jeux embarqués dans l'application | non: chaque jeu impose une nouvelle installation et ses alertes de sécurité | oui | nul |
| B. Paquets publiés sur GitHub Releases, catalogue téléchargé | F12 en partie: une machine sans Internet n'a pas le jeu | jeux déjà installés seulement | moyen |
| C. B, plus copie par le réseau local de la version la plus récente, dans un sens ou dans l'autre, plus import d'un fichier | oui | oui, si l'autre machine a le jeu | moyen |
| D. Fichiers du jeu servis directement par l'autre machine, sans installation | oui | oui | contenu distant dans une vue, rechargé à chaque partie, CSP liée à une adresse du LAN, rien si l'autre machine s'éteint |

### Format et signature du paquet

| Option | Pour | Contre |
|---|---|---|
| Archive zip et signature détachée (fichier à côté) | simple à produire | deux fichiers à garder ensemble, notamment pour l'import manuel |
| Archive zip qui contient la liste signée de ses fichiers (`duo-files.json` et sa signature) | un seul fichier, vérifiable partout (téléchargement, copie LAN, import); chaque fichier extrait est contrôlé par son empreinte | un petit format à définir |
| Archive tar.gz | flux simple | pas d'accès direct aux entrées; même question de signature |

### Fichiers servis au jeu

| Option | Pour | Contre |
|---|---|---|
| Paquet extrait dans le dossier de données | `duo-game://` lit des fichiers ordinaires (flux, requêtes partielles pour les musiques) | extraction à l'installation, place disque doublée tant que l'archive est gardée |
| Fichiers lus directement dans l'archive | installation par simple renommage | requêtes partielles sur des entrées zip, code du protocole plus délicat |

## Décision

**Option C**, archive zip autoportée et signée, paquet extrait.

### 1. Paquet

- Fichier `<id>-<version>.duogame`: une archive zip (créée par yazl, dates figées pour des archives reproductibles) qui contient le site construit du jeu, son manifeste `duo-game.json` (ADR 0005), `duo-files.json` (chemin, taille et SHA-256 de chaque fichier, manifeste compris) et `duo-files.sig` (signature Ed25519 de `duo-files.json`, avec l'identifiant de la clé).
- **Vérification**, identique pour un téléchargement, une copie LAN ou un import: signature de `duo-files.json` par une clé de confiance, manifeste valide, chaque entrée de l'archive listée et d'empreinte juste, aucune entrée de trop, nom d'entrée valide (yauzl), taille totale extraite au plus 200 Mo (plafond de la plateforme; budget conseillé d'un jeu: 50 Mo, `architecture.md` section 14).
- **Clés**: la clé privée de publication vit dans les secrets GitHub Actions et ne sort jamais de la CI; l'application embarque la liste des clés publiques de confiance (identifiant et clé), ce qui permet de préparer une rotation en publiant une version de Duo qui connaît déjà la clé suivante. Une clé de test, versionnée dans le dépôt, n'est connue que des versions de test (ADR 0013): ce n'est pas un secret, puisqu'une version publiée la refuse.

### 2. Catalogue

`catalogue.json` attaché à une release de référence au tag fixe `catalogue`, lu à l'adresse `https://github.com/Haeev/duo/releases/download/catalogue/catalogue.json`. Il porte un `schema` et, pour la dernière version de chaque jeu: identifiant, version, extrait du manifeste (nom, description, mode, durée, `sdk`), taille, adresse du paquet (release au tag `jeu-<id>-v<version>`) et SHA-256 de l'archive, pour écarter un téléchargement abîmé avant toute extraction. Le catalogue n'est pas signé: la signature de chaque paquet suffit, et la règle « jamais de retour en arrière » (ADR 0006) écarte la reprise d'un ancien paquet valide. L'application n'utilise jamais l'API GitHub.

### 3. Publication (ingenieur-build, en CI)

Sur un tag `jeu-<id>-v<version>`: tests du jeu, construction, contrôle du manifeste et des budgets de poids, archive, liste des fichiers, signature, release, puis mise à jour du catalogue. Une version déjà publiée ne se republie jamais.

### 4. Recherche et téléchargement (H-28)

- Au démarrage, une fois le lanceur affiché (pour ne pas retarder le démarrage, CA-PF-088), puis toutes les 6 heures, et sur « Chercher de nouveaux jeux »; seulement si Internet répond.
- Aucun téléchargement pendant une partie (en jeu ou en pause); un téléchargement en cours se suspend au départ et reprend au retour au salon.
- Nouveau jeu ou mise à jour: téléchargés et installés sans action, puis notification. Seules les versions que l'application sait faire tourner (pont suffisant) sont téléchargées; les autres apparaissent indisponibles avec M-13.
- Échec: nouvel essai après 1, 5 puis 15 minutes; après 3 échecs de suite, Duo attend « Réessayer maintenant » ou le démarrage suivant.

### 5. Installation

1. Archive reçue dans `games/.incoming/` (fichier `.part` pendant le transfert), empreinte contrôlée.
2. Vérification complète (point 1), extraction dans `games/<id>/<version>.tmp/`, contrôle de chaque fichier.
3. Renommage en `games/<id>/<version>/`, puis bascule atomique du pointeur `games/<id>/current.json`.
4. L'archive est gardée (`games/<id>/<version>.duogame`) pour la copie vers l'autre machine. L'ancienne version est supprimée dès qu'aucune partie ne l'utilise.

Un jeu n'est jamais installé pendant qu'il est choisi dans un salon ou joué (CA-PF-089). Aucune version n'en remplace une plus récente (ADR 0006).

### 6. Copie par le réseau local

Quand la règle de l'ADR 0006 demande une copie, la machine qui a la version la plus récente envoie son archive par la liaison (ADR 0007), en flux, avec reprise après coupure; la machine qui la reçoit l'installe comme un téléchargement (point 5), la progression s'affiche sur les deux. Déclencheurs: « Installer et rejoindre » ou « Mettre à jour et rejoindre » sur l'invitation, « Mettre à jour » dans le salon de l'hôte en retard (UX section 9). Proposition à ux-ui-designer: dans la bibliothèque d'une machine, un jeu que seule l'autre machine possède apparaît avec « Copier depuis l'ordinateur de Camille » (même mécanisme, une action), pour couvrir F12 quand l'une n'a pas Internet en dehors d'un salon.

### 7. Import depuis un fichier

« Installer un jeu depuis un fichier » (bibliothèque): choix d'un `.duogame` par la boîte de dialogue du système, puis même vérification et même installation. Recours sans Internet, ou si le dépôt devient privé.

### 8. Jeu témoin

Le jeu témoin est un paquet signé comme les autres, copié dans les ressources de l'application au moment de l'empaquetage et installé au premier lancement (ou si la version embarquée est plus récente que l'installée). Il se joue donc sans rien télécharger et se copie par le LAN comme les autres.

### 9. Si le dépôt passe en privé

Les fichiers de release d'un dépôt privé exigent une authentification, et embarquer un jeton dans l'application est exclu (secret diffusé). Parade retenue: un second dépôt public réservé aux fichiers publiés (par exemple `Haeev/duo-jeux`), alimenté par la CI du dépôt privé grâce à un jeton rangé dans ses secrets; l'adresse du catalogue change dans une version de Duo. Recours: import manuel des paquets. Effets à prévoir: minutes de CI comptées sur un dépôt privé (2 000 par mois sur le plan gratuit, macOS compté dix fois), avis de nouvelle version de Duo à faire pointer vers le dépôt public (ADR 0011).

## Conséquences

- Un jeu se publie sans nouvelle version de Duo; chaque machine le reçoit par Internet ou par l'autre machine.
- Le code d'un paquet ne s'exécute jamais avec les droits de Node: il est servi par `duo-game://` dans une vue en bac à sable (ADR 0004). La signature protège surtout la copie LAN (un appareil du réseau qui se ferait passer pour l'autre machine) et l'import de fichiers.
- La menace d'un compte GitHub compromis n'est pas couverte: la clé privée vit dans ses secrets. Accepté pour un jeu familial en réseau local.
- La place disque d'un jeu est environ doublée (archive gardée pour la copie, fichiers extraits).
- Mises à jour complètes en version 1, pas de différentiel: un correctif d'un jeu de 100 Mo se télécharge entier.

### À vérifier

- Débit de la copie LAN d'un paquet de 50 Mo en Wi-Fi chez le client, et sa reprise après coupure (CA-PF-126).
- Requêtes partielles du protocole `duo-game://` pour la lecture en flux des musiques (lot L4).
- Comportement des redirections de GitHub Releases derrière le mandataire de l'environnement cloud et en CI (lot L11).
