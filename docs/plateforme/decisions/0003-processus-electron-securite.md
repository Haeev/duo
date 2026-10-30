# ADR 0003: Processus Electron et sécurité

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme, dev-reseau |
| Fonctions du cahier | F02, F05, F10, F11, F14; section 6 |
| Liens | ADR 0004 (hébergement des jeux), 0007 et 0008 (réseau, dev-reseau), 0013 (tests), 0015 (journal et rapport) |

## Contexte

L'application Electron porte trois sortes de code de confiance très différente: le processus principal (Node, accès complet au système), l'interface du lanceur (écrite par le studio) et les jeux (paquets téléchargés ou reçus d'une autre machine du réseau). Elle écoute aussi sur le réseau local, où n'importe quel appareil peut lui envoyer des messages. Il faut répartir les responsabilités entre processus et fixer les règles de sécurité une fois pour toutes, avant le squelette (lot L2).

Faits vérifiés le 2026-10-30 sur Electron 45.2.0 (essai jetable sous `xvfb-run` et documentation au tag `v45.2.0`): une `WebContentsView` et une iframe d'un autre schéma tournent chacune dans leur processus; l'aller-retour par `MessagePort` entre principal et page coûte 0,10 ms en médiane; un preload en bac à sable n'a plus `Buffer`, `events`, `timers` ni `url`; le verrou d'instance unique est pris dans le dossier `userData` (code source `electron_api_app.cc`, `RequestSingleInstanceLock` lit `chrome::DIR_USER_DATA`).

## Options

### Répartition du travail système

| Option | Pour | Contre |
|---|---|---|
| A. Un seul processus principal pour tout (fenêtre, réseau, données, paquets, diagnostics) | un seul endroit qui tient l'état; aucun IPC interne; le relais réseau coûte 0,1 ms par passage | un traitement lourd mal écrit peut faire trembler le relais réseau |
| B. Principal plus un `utilityProcess` pour la session réseau | relais réseau à l'abri des autres tâches | état de session réparti sur deux processus, IPC interne à valider, plus de code |
| C. Principal plus un `utilityProcess` pour les données et les paquets | écritures lourdes isolées | même coût de répartition; les écritures sont déjà asynchrones |

### Chargement de l'interface du lanceur

| Option | Pour | Contre |
|---|---|---|
| `file://` | aucun code | origine opaque, `fetch` limité, CSP moins nette, mauvaise pratique documentée par Electron |
| Protocole personnalisé `duo://app/` déclaré `standard` et `secure` | origine stable, contexte sécurisé, CSP envoyée par le protocole, chemins contrôlés | un gestionnaire `protocol.handle` à écrire |

### API de l'interface vers le principal

| Option | Pour | Contre |
|---|---|---|
| Canaux IPC nommés, décrits dans une table partagée, arguments validés par schéma | chaque canal a un type et un schéma; le preload n'expose que ces canaux | table à tenir |
| Un canal générique de type RPC | moins de code au départ | surface d'attaque floue, validation au cas par cas |

## Décision

1. **Option A**: un seul processus principal, avec trois règles: aucun accès disque ou réseau synchrone; les traitements lourds (empreinte et extraction d'un paquet de 50 Mo, écriture d'une sauvegarde de 20 Mo) passent par des flux, par l'API asynchrone de `zlib` ou par un `worker_threads`; les modules ne se parlent que par des appels typés, pour qu'un module puisse partir dans un `utilityProcess` plus tard sans tout reprendre. On y reviendra si une mesure montre de la gigue sur le relais réseau (banc de l'ADR 0013).
2. **Modules du principal**:

| Module | Responsabilités |
|---|---|
| `window` | une `BaseWindow` et deux vues empilées (jeu dessous, plateforme dessus); fenêtre agrandie au premier lancement, plein écran retenu (F10); instance unique; invitation signalée par `app.dock.bounce()` sous macOS et `flashFrame(true)` sous Windows (H-35) |
| `protocols` | `duo://app/` sert l'interface; `duo-game://<id>/` sert le jeu installé (ADR 0004) |
| `ipc` | canaux de la vue plateforme, arguments validés, émetteur vérifié |
| `game-host` | vue jeu, pont du SDK, battement de cœur, plantages (ADR 0004) |
| `session` | liaison avec l'autre machine, salon, partie, pause, reprise (ADR 0007, dev-reseau) |
| `discovery` | présence et découverte sur le LAN (ADR 0008, dev-reseau) |
| `duo` | identité de la machine, profil, formation du duo et rattachement d'une machine (ADR 0009) |
| `data` | réglages, sauvegardes, historique, scores, écriture sûre, réplication (ADR 0009) |
| `packages` | catalogue, téléchargement, vérification, installation, copie LAN, import par fichier (ADR 0010) |
| `versions` | numéros de version, règles de compatibilité (ADR 0006), avis de nouvelle version de Duo (ADR 0011) |
| `diagnostics` | journal, état du rendu et du réseau, rapport pour le studio (ADR 0015) |

3. **Vues et preloads**: toutes les vues ont `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`.
   - `preload-platform` expose par `contextBridge` un objet `duo` généré à partir de la table des canaux de `@duo/protocol`: des appels (`invoke`) et des abonnements à des flux d'état (présence, salon, partie, téléchargements). Rien d'autre.
   - `preload-game` transmet à la page le `MessagePort` du pont et rien d'autre (une dizaine de lignes, API web seulement).
4. **IPC**: chaque canal a un nom, un schéma d'entrée et un type de sortie; le principal valide chaque appel avec Valibot et vérifie que l'émetteur est bien la vue plateforme (URL du cadre en `duo://app/`). Un appel invalide est refusé et journalisé, sans planter.
5. **Protocoles**: `duo` et `duo-game` déclarés par `protocol.registerSchemesAsPrivileged` avec `standard`, `secure`, `supportFetchAPI`, et `stream` pour `duo-game` (lecture en flux des musiques). Aucun `file://`. Chaque réponse porte sa CSP:
   - lanceur: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. Les styles posés par Preact passent par le CSSOM, que `style-src` ne bloque pas. En développement seulement, la CSP admet le serveur de Vite.
   - jeux: celle de l'ADR 0004.
6. **Autorisations et navigation**: `setPermissionRequestHandler` et `setPermissionCheckHandler` refusent tout, sauf le plein écran et le verrouillage du pointeur pour la vue jeu; `will-navigate` est annulé et `setWindowOpenHandler` refuse tout. Les liens externes (page de téléchargement, guides) et les réglages du système (pare-feu, réseau, Réseau local de macOS) s'ouvrent par `shell.openExternal` sur une liste fermée d'adresses tenue dans le principal.
7. **Fusibles** (option `electronFuses` d'electron-builder, ADR 0011): `runAsNode`, `enableNodeOptionsEnvironmentVariable` et `enableNodeCliInspectArguments` désactivés; `onlyLoadAppFromAsar` et `enableEmbeddedAsarIntegrityValidation` activés.
8. **Menus et raccourcis**: pas de menu d'application sous Windows (neutralise Alt, Ctrl+R, Ctrl+W et les outils de développement); sous macOS, un menu minimal en français (Duo, Quitter, Copier, Coller, Plein écran avec ⌃⌘F, Réglages avec ⌘,). Outils de développement fermés dans les versions publiées. F11 sous Windows est lu par `before-input-event` sur les deux vues.
9. **Ligne de commande** (ADR 0013, prérequis 1 de qa-testeur): `--duo-data-dir=<chemin>` est lu avant tout, appliqué par `app.setPath('userData', ...)`, puis seulement le verrou d'instance unique est demandé: deux instances aux dossiers distincts coexistent, deux instances sur le même dossier jamais. Les ports imposés suivent la même règle (option définie par dev-reseau). Ces options existent aussi dans les versions publiées (utiles au dépannage); les crochets de test, eux, n'y existent pas (ADR 0013).
10. **Réseau**: aucune socket n'est ouverte avant la validation de l'écran E03 au premier lancement (CA-PF-079); le principal mémorise cet accord dans les réglages. Tout message reçu du réseau est validé par schéma avant usage (ADR 0007 et 0008).
11. **Plantages du principal et des vues**: `crashReporter.start({ uploadToServer: false })`, rapports locaux seulement, jamais envoyés (ADR 0015 pour ce qui entre dans le rapport pour le studio).

## Conséquences

- Le code d'un jeu ne s'exécute jamais avec les droits de Node, et l'interface du lanceur n'appelle que des canaux typés et validés.
- La table des canaux et ses schémas vivent dans `@duo/protocol`: le preload, le principal et les tests de l'interface (faux pont, ADR 0012) partagent la même définition.
- L'accord réseau du premier lancement conditionne le démarrage des modules `discovery` et `session`.
- Les versions de développement ont une CSP plus large: la CI vérifie la CSP de l'application construite, pas celle du serveur de Vite.

### À vérifier

- Validation d'intégrité de l'archive (`enableEmbeddedAsarIntegrityValidation`) sur macOS arm64 et Windows x64 (lot L7).
- Bac à sable de Chromium sur les runners Ubuntu de GitHub Actions (restriction AppArmor des espaces de noms utilisateur); dans l'environnement cloud, qui tourne en root, Electron exige `--no-sandbox`, donc le bac à sable n'y est pas éprouvé (ADR 0013).
- Comportement de `app.dock.bounce()` et `flashFrame()` sur les machines du client (CA-PF-131).
