# ADR 0005: Contrat des jeux et SDK

| Champ | Valeur |
|---|---|
| Statut | acceptée (manager, 2026-10-30) |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme, dev-reseau (module `net`), dev-gameplay-2d, dev-gameplay-3d, ux-ui-designer (textes fournis par les jeux) |
| Fonctions du cahier | F04, F05, F07, F08, F09, F10; section 4 |
| Liens | ADR 0004 (hébergement), 0006 (versions), 0007 (modèle réseau), 0009 (données), 0010 (paquets) |

## Contexte

Duo accueillera des jeux originaux, en 2D, 3D ou isométrique, ajoutés un par un pendant des années. Ajouter un jeu doit coûter le moins possible, et un jeu publié doit continuer à fonctionner quand l'application évolue. Le cahier 1.0 fixe ce que la plateforme attend de chaque jeu: une fiche (F04: vignette, description, durée, coopération ou affrontement), un cycle de vie commun avec Échap réservé à la pause (F05), des sauvegardes déclarées (section 4: emplacements et moments), des résultats qui alimentent l'historique et les scores (F08, F09), des touches réaffectables et des volumes communs (F10). La spécification UX ajoute ce que le jeu doit fournir à l'écran de fin (jusqu'à trois statistiques, libellé de « Rejouer ») et aux superpositions (ce qui est enregistré, pour dire ce qui sera perdu).

## Options

### Où vit le SDK

| Option | Pour | Contre |
|---|---|---|
| SDK compilé dans chaque jeu, qui parle un protocole versionné à la plateforme | chaque jeu garde la version du SDK avec laquelle il a été testé; la plateforme doit seulement rester compatible avec les versions du pont qu'elle annonce; un jeu se développe et se teste hors d'Electron, dans le faux hôte | un correctif du SDK demande de republier les jeux concernés |
| SDK fourni par la plateforme à l'exécution (script injecté, API du preload) | un correctif touche tous les jeux d'un coup | une mise à jour de l'application peut casser un jeu publié; un jeu ne se teste plus seul |

### Transport du pont

| Option | Pour | Contre |
|---|---|---|
| Un `MessagePort` par partie, ouvert par le principal et remis à la page par `preload-game` | messages structurés, tampons transférables sans copie (sauvegarde de 20 Mo); même API que `MessageChannel` dans le faux hôte; 0,10 ms d'aller-retour mesuré | un protocole de messages à définir (c'est voulu: il est versionné) |
| API exposée par `contextBridge` dans `preload-game` | appels de fonction directs | lie le jeu à Electron, pas de faux hôte simple, chaque fonction à sécuriser |
| `window.postMessage` vers une page parente | standard | suppose une iframe (écartée par l'ADR 0004) |

### Format du manifeste

| Option | Pour | Contre |
|---|---|---|
| Fichier JSON `duo-game.json` validé par schéma | lisible sans exécuter le jeu (installation, catalogue, bibliothèque), validable en CI et à l'installation | pas de calcul possible (aucun besoin) |
| Module TypeScript qui exporte le manifeste | typé à l'écriture | il faudrait exécuter du code téléchargé pour lire une fiche |

## Décision

### 1. SDK compilé, pont par `MessagePort`, manifeste JSON

`@duo/sdk` est une dépendance de chaque jeu, empaquetée avec lui. Il parle à la plateforme par un unique `MessagePort` dont les messages sont typés, versionnés et validés à l'arrivée par le principal (Valibot), et par le SDK pour ceux qui viennent de la plateforme.

### 2. Manifeste `duo-game.json`, version 1

| Champ | Règle |
|---|---|
| `schema` | `1`, version du format du manifeste |
| `id` | `^[a-z][a-z0-9-]{1,31}$`, stable pour toujours (nom du dossier, clé des sauvegardes et de l'historique) |
| `name` | 1 à 40 caractères, en français |
| `version` | SemVer `MAJEUR.MINEUR.CORRECTIF`, sans préversion |
| `sdk` | version minimale du pont exigée, `"1.N"`; écrite par le script d'empaquetage d'après la version de `@duo/sdk` réellement utilisée |
| `view` | `2d`, `3d` ou `iso` |
| `engine` | `three`, `pixi`, `phaser` ou `none` |
| `mode` | `coop` ou `versus` (F04, F09; un jeu asymétrique ou en coopétition choisit l'un des deux, H-21) |
| `play` | `match` (parties avec un résultat) ou `session` (séances sans fin de partie, H-20) |
| `durationMinutes` | `[min, max]`, entiers de 1 à 600, durée typique d'une partie ou d'une séance |
| `network` | `host-authority`, `lockstep` ou `turns` (ADR 0007) |
| `entry` | page d'entrée, `index.html` |
| `thumbnail` | image WebP ou PNG d'au moins 640x360 pixels, soit le double de sa taille d'affichage (CA-PF-114) |
| `description` | 1 à 200 caractères |
| `whatsNew` | 0 à 400 caractères, « Quoi de neuf » de cette version |
| `actions` | 1 à 32 actions `{ id, label, keys, mouse?, rebindable? }`; `keys` en `KeyboardEvent.code` (position physique: `KeyW` est la touche Z d'un clavier AZERTY); `Escape` interdit; `rebindable` vaut `true` par défaut |
| `saves` | `null`, ou `{ slots, maxBytes, moments, autosaveSeconds?, help? }`: `slots` de 1 à 10; `maxBytes` au plus 32 Mio (plafond de la plateforme, ADR 0009); `moments` parmi `level-end`, `exit`, `auto`, `manual`; `autosaveSeconds` de 60 à 1 800, exigé si `auto` est déclaré; `help`, 120 caractères au plus (« Le jeu enregistre à la fin de chaque niveau. ») |
| `credits` | chemin d'un `credits.json` du paquet (fichier, auteur, source, licence), ou `null`; affiché dans Réglages > À propos |

Les clés sont des identifiants du code (anglais), les textes affichés sont en français. Le manifeste est validé par le schéma de `@duo/protocol` en CI, à l'installation et au chargement; un manifeste invalide rend le jeu illisible (M-12) sans toucher aux autres.

### 3. Cycle de vie et messages du pont 1.0

États: chargement, prêt, en jeu, en pause, fin, erreur (diagramme dans `architecture.md`, section 6). Délais: ADR 0004.

| Sens | Message | Contenu et règle |
|---|---|---|
| plateforme vers jeu | `init` | rôle (`host` ou `guest`), joueurs (identifiant de membre du duo, pseudo, couleur, symbole, local ou non), graine, version du jeu, réglages (volumes, taille de l'interface, réduction des animations, touches), sauvegarde choisie chez l'hôte seulement |
| | `start` | départ synchronisé (ADR 0007) |
| | `pause`, `resume` | raison de la pause (demande d'un joueur, coupure); reprise décidée par la plateforme quand les deux l'ont demandée |
| | `settings` | réglages changés pendant la pause |
| | `saveRequest` | sauvegarde automatique (période du manifeste, et à chaque pause) ou de sortie |
| | `stop` | raison (`end`, `stopped`, `quit`, `peer-crash`, `disconnect-stop`) et sauvegarde de sortie demandée ou non |
| | `net` | message de l'instance du jeu sur l'autre machine (ADR 0007) |
| jeu vers plateforme | `loading`, `ready` | progression du chargement, puis prêt |
| | `heartbeat`, `perf` | envoyés par le SDK chaque seconde: battement de cœur (ADR 0004), temps d'image et rythme de simulation pour l'affichage des performances |
| | `saveWrite` | hôte seulement: moment, libellé (« Niveau 3 »), progression facultative, `dataSchema`, données JSON en UTF-8 dans un `ArrayBuffer` transféré; réponse `saveResult` (succès, trop gros, moment non déclaré, erreur d'écriture) |
| | `matchEnd` | hôte seulement, jeux `match`: issue (`versus`: vainqueur ou égalité; `coop`: réussite ou échec), scores par joueur, jusqu'à trois statistiques, progression, libellé de « Rejouer » (« Niveau suivant ») |
| | `sessionEnd` | hôte seulement, jeux `session`: progression atteinte, en réponse à `stop` |
| | `fatal`, `log` | erreur non rattrapée (envoyée par les gestionnaires du SDK), journal (ADR 0015) |

L'API du SDK est typée par rôle (union discriminée `HostContext | GuestContext`): chez l'invité, `saves.write` et `results.end` n'existent pas, le compilateur l'empêche.

### 4. API offerte par le SDK

| Module | Ce qu'il offre | Règles |
|---|---|---|
| `session` | rôle, joueurs, graine, version, événements du cycle de vie | |
| `loop` | boucle à pas fixe (60 Hz par défaut, réglable par jeu), facteur d'interpolation pour le rendu | chez l'hôte, la simulation est cadencée par des minuteurs, le rendu par `requestAnimationFrame` (fenêtre réduite, ADR 0004) |
| `random` | générateur pseudo-aléatoire à graine | `Math.random` interdit dans la simulation |
| `input` | actions du manifeste (`isDown`, `wasPressed` par pas), pointeur (position, boutons, verrouillage), libellé réel d'une touche (`navigator.keyboard.getLayoutMap()`) | touches lues par `KeyboardEvent.code`; tout relâché à `blur`; liaisons fournies par les réglages de la machine; pas de manette |
| `net` | messages entre les deux instances, aides pour les instantanés et les entrées | défini par dev-reseau (ADR 0007) |
| `audio` | un `AudioContext`, bus musique, effets et interface; gain effectif = volume général × volume de la catégorie (H-22); effets décodés au chargement, musiques en flux | |
| `assets` | préchargement avec progression; adresses relatives au paquet, servies par `duo-game://` | compilation des shaders pendant le chargement (`compileAsync`) |
| `saves` | lecture de la sauvegarde choisie (dans `init`), écriture (hôte seulement), sauvegarde automatique à la période du manifeste et à chaque pause | seul l'emplacement choisi au salon s'écrit; taille et moments contrôlés par la plateforme (CA-PF-057) |
| `results` | `end` pour les jeux `match`, `sessionEnd` pour les jeux `session` (hôte seulement) | alimentent l'historique et les scores (ADR 0009) |
| `ui` | taille de l'interface (1, 1,25 ou 1,5), réduction des animations | le HUD du jeu les applique (H-24, CA-PF-122); les écrans bloquants restent ceux de la plateforme |
| `perf` | compteur d'images et rythme de simulation, envoyés à la plateforme | présent dans toutes les versions (affichage des performances, ADR 0013) |
| `log` | journal du jeu vers celui de la plateforme | remplace `console.log`, interdit |

### 5. Obligations d'un jeu

- **Simulation séparée du rendu**: `src/simulation/` est du TypeScript pur, sans DOM, sans `Math.random` ni lecture d'horloge (le temps vient du pas de la boucle), testable dans Node par Vitest. Elle fournit `hash(state): string`, une empreinte peu coûteuse de son état: elle sert aux tests (CA-PF-035, 036, 046, 116) et aux contrôles de désynchronisation en lockstep.
- **Sauvegardes**: données JSON portant un `dataSchema`; les migrations d'un `dataSchema` au suivant sont du code du jeu, testé en CI avec des sauvegardes de chaque version publiée (section 4 du cahier: les anciennes sauvegardes restent lisibles).
- **Textes**: en français, tutoiement, rédaction neutre, mêmes règles typographiques que la plateforme; les polices affichent tout pseudo valide (alphabet latin avec ses accents, dont Œ et Ç, H-01).
- **Aucun accès** au réseau, au disque ni au stockage du navigateur en dehors du SDK (CSP et session non persistante, ADR 0004); aucune ressource hors du paquet.
- **Budgets** de `architecture.md` (section 14).
- **Pour les tests** (ADR 0013): un robot facultatif par jeu (fonction qui produit des entrées), compilé seulement dans les versions de test.

### 6. Versions du pont

Le pont porte une version `majeure.mineure`. Une mineure n'ajoute que des messages ou des champs facultatifs; une majeure peut casser. L'application annonce les versions qu'elle implémente (par exemple `1.4`); un jeu qui exige `1.2` est compatible si la majeure est la même et si la mineure de l'application est au moins égale (ADR 0006). Quand une majeure 2 viendra, l'application gardera la 1 tant qu'un jeu publié l'utilise.

### 7. Outillage livré avec le contrat

- `@duo/sdk-dev`: faux hôte dans un navigateur, deux onglets (hôte et invité) reliés par un relais local qui ajoute latence, gigue et pertes; un jeu se développe avec le serveur de Vite sans Electron et se teste avec Playwright à deux contextes. L'application accepte aussi, en développement, un jeu servi par Vite.
- `games/_template` et `pnpm nouveau-jeu <id>`: manifeste, simulation avec `hash`, rendu minimal (Three.js ou PixiJS), robot, textes, tests de la simulation, du manifeste et des migrations de sauvegarde, configuration de Vite (`base: './'`).

## Conséquences

- Un jeu publié ne casse pas quand Duo évolue, tant que la plateforme garde la majeure du pont qu'il utilise; la contrepartie est qu'un correctif du SDK demande de republier les jeux concernés.
- La fiche du jeu, sa durée, son type et ses moments de sauvegarde sont connus sans exécuter le jeu.
- Les textes de l'écran de fin et des superpositions viennent du jeu (statistiques, libellés, ce qui est enregistré): ux-ui-designer fixe leurs longueurs maximales, le schéma les contrôle.
- `hash` coûte un peu de travail à chaque jeu, mais rend testables la pause, la reprise et la synchronisation.

### À vérifier

- `navigator.keyboard.getLayoutMap()` donne les bons libellés AZERTY sur le Mac et le PC (vérifié disponible dans `duo-game://` sous Linux; disposition réelle chez le client).
- Coût d'une écriture de 20 Mo depuis le jeu (sérialisation JSON sur le fil du jeu, transfert du tampon) sur le PC de référence, au banc de mesure.
