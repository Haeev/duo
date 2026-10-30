# ADR 0009: Données du duo

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme (lot L9), dev-reseau (transport de la réplication), qa-testeur (critères F07 à F09) |
| Fonctions du cahier | F01, F06, F07, F08, F09, F10; section 4 |
| Liens | ADR 0003 (processus), 0005 (sauvegardes et résultats déclarés par les jeux), 0006 (format des données), 0007 (liaison, dev-reseau), 0015 (journal) |

## Contexte

Section 4 du cahier 1.0: les sauvegardes, l'historique et les scores appartiennent au duo et sont copiés sur les deux machines à chaque écriture; aucune perte en cas de plantage ou de coupure (écriture sûre, copies de secours); si deux copies d'une sauvegarde divergent, « la plus avancée dans sa chaîne de révisions l'emporte (et non la plus récente selon les horloges) », l'autre est gardée en secours et la plateforme le signale, mais un simple rattrapage ne se signale pas; une machine réinstallée doit pouvoir se rattacher au duo et récupérer ses données depuis l'autre. F08: une partie interrompue (plantage, abandon) est inscrite « interrompue », sans effet sur le score cumulé. F06: si l'application de l'hôte s'arrête, on reprend au dernier point de sauvegarde. F07: les trois versions précédentes d'une sauvegarde restent en copies de secours, visibles dans la fiche du jeu; une suppression garde une copie de secours.

Volumes: le premier jeu envisagé (simulation de vie d'une centaine d'heures) peut produire des sauvegardes de 20 Mo (H-16). Les horloges des deux machines peuvent différer. Les deux machines ne sont pas toujours allumées ensemble, mais on ne joue jamais seul: une sauvegarde ne s'écrit que pendant une partie à deux.

Essai jetable du 2026-10-30 (Node 22, 4 cœurs): une sauvegarde JSON de 8 Mo se sérialise en 46 ms, s'empreinte (SHA-256) en 8 ms, se compresse en gzip niveau 1 en 34 ms avec un rapport de 8,7, sans bloquer la boucle d'événements (retard maximal 5,6 ms, compression dans le pool de fils de `zlib`).

## Options

### Stockage

| Option | Pour | Contre |
|---|---|---|
| Fichiers JSON dans le dossier de données | lisibles pour le diagnostic à distance; réplication fichier par fichier; aucune dépendance; conforme à la section 6 du cahier | écriture sûre et index à écrire soi-même |
| SQLite par `node:sqlite` (présent dans le Node d'Electron 45) | transactions, requêtes | base à répliquer enregistrement par enregistrement, illisible sans outil, module récent |
| IndexedDB dans une vue | rien à installer | hors de portée du principal qui réplique; vue jeu non persistante (ADR 0004): exclu |

### Identité du duo

| Option | Pour | Contre |
|---|---|---|
| Identifiant dérivé des identifiants des deux machines (`architecture.md` 0.1) | rien à stocker | une machine réinstallée change d'identifiant, donc forme un autre duo: contraire à la section 4 du cahier |
| Identifiant tiré au hasard à la formation du duo, avec une liste de deux membres (membre, machine) | une machine peut prendre la place d'une autre sans toucher à l'historique | un fichier `duo.json` de plus, une procédure de rattachement |

### Révisions des sauvegardes

| Option | Pour | Contre |
|---|---|---|
| Fichier courant, plus `.bak` et copies datées (`architecture.md` 0.1) | habituel | copies de secours à gérer à part; écriture sûre d'un gros fichier à chaque fois |
| Révisions immuables nommées par leur empreinte, plus un petit fichier de tête | les trois versions précédentes sont déjà là (F07); un gros fichier n'est jamais réécrit; l'intégrité se vérifie par le nom; réplication simple (« as-tu ce fichier? ») | quelques fichiers par emplacement |

### Résolution d'une divergence

| Option | Pour | Contre |
|---|---|---|
| La plus récente selon la date d'écriture | simple | dépend des horloges; ne distingue pas un retard d'une divergence; contraire au cahier 1.0 |
| Chaîne de révisions: la plus avancée l'emporte | conforme au cahier; distingue le rattrapage (silencieux) de la vraie divergence (signalée); aucune horloge | une règle d'égalité à fixer |

### Rattrapage après coupure

| Option | Pour | Contre |
|---|---|---|
| File d'attente des écritures non confirmées (`outbox.json`) | rejoue exactement ce qui manque | un fichier d'état de plus, à garder cohérent; ne couvre pas une machine restaurée ou rattachée |
| Comparaison des index à chaque connexion, en plus de l'envoi immédiat de chaque écriture | un seul mécanisme couvre la coupure, l'arrêt brutal, la réinstallation et le rattachement | un index à échanger à chaque connexion (quelques dizaines de Ko) |

## Décision

Fichiers JSON; duo à identifiant aléatoire et membres; révisions immuables nommées par leur empreinte; chaîne de révisions; envoi immédiat et comparaison des index à chaque connexion, sans file d'attente.

### 1. Emplacement et arborescence

Dossier `app.getPath('userData')` (`~/Library/Application Support/Duo` sous macOS, `%APPDATA%\Duo` sous Windows), ou celui de `--duo-data-dir` (ADR 0003). Chemins construits avec `path.join`; aucun nom de fichier ne vient d'une saisie libre (identifiants en minuscules, chiffres et traits d'union; empreintes en hexadécimal), ce qui évite les soucis d'accents, d'espaces et de casse.

```text
<userData>/
  format.json                   format du dossier (entier), lu avant tout le reste
  machine.json                  identifiant de cette machine
  profile.json                  pseudo et couleur de cette machine (F01)
  settings.json                 réglages de cette machine (F10), accord réseau du premier lancement
  duos/<duoId>/                 données d'un duo, répliquées sur ses deux machines
    duo.json                    membres, dernier profil connu de chacun, rattachements
    saves/<jeu>/<emplacement>/
      head.json                 tête de l'emplacement
      <sha256>.json             révisions immuables: données du jeu, telles que le jeu les a écrites
    history/<AAAA-MM>/<partieId>.json   une entrée par partie ou séance, immuable
    live/<partieId>.json        partie en cours, chez l'hôte seulement
  games/                        paquets installés (ADR 0010)
  logs/                         journal et rapports de plantage (ADR 0015)
  backups/                      copies faites avant une migration du format
```

### 2. Identités

- **Machine**: `machine.json` contient un identifiant UUID v4 tiré au premier lancement. La désinstallation garde le dossier de données (`deleteAppDataOnUninstall` vaut `false` par défaut dans electron-builder 26.18.0, vérifié dans son schéma; sous macOS, mettre l'application à la corbeille laisse `Application Support`): une réinstallation retrouve tout (H-27).
- **Profil** (F01): pseudo et couleur, propres à la machine. Pseudo de 1 à 16 graphèmes (`Intl.Segmenter`), espaces de début et de fin retirées, enregistré en NFC; lettres de l'alphabet latin avec leurs accents, chiffres, espaces intérieures, trait d'union, apostrophes droite et typographique; aucun émoji ni autre symbole (H-01). Couleur: l'une des six de la palette, chacune liée à son symbole.
- **Duo**: identifiant UUID v4 tiré à la formation; `duo.json` liste deux membres `{ memberId, machineId, profile }`. L'historique, les scores et les sauvegardes se rattachent au duo et aux identifiants de membre, jamais aux pseudos ni aux machines; ils s'affichent avec les pseudos actuels (H-03).
- **Formation**: à la première rencontre de deux machines qui ont chacune un profil et aucun duo commun, hors cas de rattachement (point 9). La machine au plus petit identifiant tire l'identifiant du duo, pour qu'une rencontre simultanée n'en crée jamais deux. Si les deux couleurs sont égales, la machine au plus grand identifiant prend la couleur libre suivante dans l'ordre de la palette et l'annonce (M-02); pendant un premier lancement, c'est la machine en cours de configuration qui choisit sur place (E04).
- **Duo affiché**: celui dont l'autre membre est visible; si aucun ne l'est, le dernier joué. Une machine peut garder plusieurs duos dans son dossier (après un nouveau duo, point 9), l'interface n'en montre qu'un à la fois.

### 3. Sauvegardes

- Une **révision** est un fichier immuable `<sha256>.json`: exactement les octets JSON transmis par le jeu, nommés par leur SHA-256. La plateforme ne les interprète pas (pas d'analyse de 20 Mo dans le principal); elle contrôle leur taille: au plus le `maxBytes` du manifeste, et au plus 32 Mio (33 554 432 octets) par emplacement, plafond de la plateforme (H-16).
- La **tête** `head.json` décrit l'emplacement: numéro de révision (compteur), empreinte courante, empreinte parente, ancêtres (les 64 dernières empreintes), libellé et progression donnés par le jeu, version du jeu, `dataSchema`, taille, date d'écriture (horloge de l'hôte, pour l'affichage seulement), machine qui a écrit, suppression éventuelle, et la liste des copies de secours (empreinte, révision, libellé, date, raison: `previous`, `replaced`, `deleted` ou `conflict`).
- **Écrire** (hôte seulement, au moment déclaré et dans l'emplacement choisi au salon): si l'empreinte ne change pas, rien n'est écrit; sinon la révision est écrite, puis la tête passe à la révision suivante, l'ancienne courante rejoint les copies de secours (`previous`).
- **Copies de secours**: les trois révisions précédentes (F07), plus les cinq plus récentes copies `replaced`, `deleted` ou `conflict`. Au démarrage, un ménage supprime les révisions qu'aucune tête ne cite. Les deux machines appliquent la même règle à la même tête: leurs fiches de jeu sont identiques (CA-PF-030).
- **Remplacer** un emplacement plein par une nouvelle partie (après confirmation, M-33): révision suivante, l'ancien contenu en copie `replaced`. **Supprimer** (après confirmation): révision suivante marquée supprimée, l'ancien contenu en copie `deleted`.
- **Restaurer** une copie de secours se fait par construction (révision suivante au contenu de la copie); l'existence d'un bouton « Restaurer » dans la fiche du jeu reste à décider par ux-ui-designer et le manager.
- Une sauvegarde écrite par une version du jeu plus récente que celle qu'on jouerait n'est ni lue ni écrite (ADR 0006, M-34).

### 4. Écriture sûre

1. Écrire `x.tmp` dans le même dossier, puis `fsync`.
2. Pour les petits fichiers mutables (`head.json`, `profile.json`, `settings.json`, `duo.json`): copier le `x` actuel vers `x.bak`.
3. Renommer `x.tmp` en `x` (remplacement atomique sur un même volume).

Une révision n'est jamais réécrite: si son fichier existe déjà, l'écriture est sautée. Sous Windows, reprises courtes sur `EPERM`, `EBUSY` et `EACCES` pendant une seconde au plus (antivirus, indexeur). Toutes les écritures passent par une file unique dans le principal, par fichier: jamais deux écritures concurrentes du même fichier. Un disque plein ou un dossier en lecture seule n'arrête pas la partie: M-22, la version précédente reste intacte, la copie est rattrapée plus tard (CA-PF-058).

### 5. Lecture et récupération

Chaque fichier porte un champ `schema` et passe par son schéma Valibot à la lecture; une révision est valide si son empreinte correspond à son nom. Fichier absent ou invalide: `x.bak`, puis la copie de l'autre machine à la synchronisation suivante, puis la révision précédente; le fichier abîmé est renommé `x.abime-<date>` et gardé (CA-PF-054), et la plateforme le signale (M-20).

### 6. Réplication

- **Envoi immédiat**: chaque écriture de l'hôte part aussitôt vers l'autre machine par la liaison (ADR 0007): révision (compressée en gzip niveau 1 pour le transport au-delà de 64 Kio), puis tête, puis accusé de réception. L'autre machine vérifie l'empreinte, écrit la révision, puis applique la tête selon le point 7. Même chemin pour une entrée d'historique, pour `duo.json` et pour le profil de chaque machine.
- **Comparaison à chaque connexion**, et après chaque reconnexion, avant que le salon ne propose les sauvegardes (CA-PF-055): les machines échangent l'index de chaque duo commun (membres et profils; tête de chaque emplacement; identifiants des entrées d'historique par mois, ou une empreinte par mois quand rien n'a changé), puis chacune envoie ce qui manque à l'autre. Ce seul mécanisme rattrape une coupure, un arrêt brutal, une machine restaurée ou rattachée: il n'y a pas de file d'attente des écritures.
- **Qui écrit quoi**: sauvegardes et historique, la plateforme de l'hôte de la partie; profil, chaque machine pour le sien; membres du duo, la machine qui reste lors d'un rattachement. Aucune donnée n'a deux auteurs au même moment.

### 7. Conflits de sauvegarde (section 4 du cahier)

Comparaison de deux têtes d'un même emplacement:

| Cas | Règle | Signalé |
|---|---|---|
| mêmes empreintes | union des copies de secours et des ancêtres, si elles diffèrent | non |
| l'empreinte de l'une figure parmi les ancêtres de l'autre (copie en retard) | la plus avancée remplace l'autre; la révision en retard est déjà parmi les copies `previous` | non (simple rattrapage) |
| divergence (aucune ne descend de l'autre) | le plus grand numéro de révision l'emporte; à égalité, la plus petite empreinte dans l'ordre lexical (règle arbitraire mais identique sur les deux machines); la perdante devient une copie `conflict` et rejoint les ancêtres de la gagnante | oui: M-21 sur les deux machines, à l'ouverture du salon de ce jeu (E08), et la copie apparaît dans la fiche du jeu |

La fusion est une fonction pure et commutative: les deux machines obtiennent la même tête, quel que soit l'hôte. Aucune horloge n'intervient.

### 8. Historique et parties interrompues

- **Entrée** (une par partie ou séance, immuable, identifiant UUID v4 tiré au départ): duo, jeu et version, `match` ou `session`, date et heure de début (ISO 8601 avec le décalage horaire de l'hôte, affichée à l'heure locale), durée jouée hors pauses et hors attentes de reconnexion (horloge monotone de l'hôte, H-19), membre hôte, joueurs (identifiant de membre et pseudo du moment, pour le diagnostic), issue.
- **Issue**, union discriminée: `versus` (vainqueur, ou égalité), `coop` (réussite ou échec), `session` (séance quittée), `interrupted` (raison: `stopped`, `crash`, `host-quit`, `guest-quit`, `disconnect-stop`); chacune avec scores, statistiques et progression quand le jeu les a fournis.
- **Un seul auteur**: la plateforme de l'hôte de la partie écrit l'entrée, une fois. Les deux copies se fusionnent par union des identifiants (F08); deux contenus pour un même identifiant ne peuvent pas se produire, et seraient journalisés comme anomalie.
- **Partie interrompue** (F08, Q5, H-11): arrêt par un joueur (« Retour au salon » en pause, « Arrêter la partie » pendant une coupure), plantage ou blocage du jeu sur l'une des machines, fermeture de Duo pendant la partie. L'entrée porte la durée jouée et la progression de la dernière sauvegarde. Un échec du chargement n'est pas une partie: rien n'est inscrit.
- **Arrêt pendant une coupure**: si c'est l'hôte qui arrête, il inscrit aussitôt l'entrée, qui part chez l'invité à la connexion suivante. Si c'est l'invité, l'hôte inscrit l'entrée quand il l'apprend (reconnexion), ou quand il arrête lui-même.
- **Partie en cours chez l'hôte**: `live/<partieId>.json` (jeu, version, début, durée jouée, dernière sauvegarde, joueurs), écrit au départ, à chaque pause, reprise et sauvegarde, et toutes les 30 s; supprimé quand l'entrée est inscrite. Au démarrage, un marqueur resté en place signifie que Duo s'est arrêté chez l'hôte: l'entrée est inscrite `interrupted` (`host-quit`), et l'accueil propose de reprendre depuis la dernière sauvegarde (M-19, chez les deux dès qu'ils se voient, CA-PF-049). Pas d'instantané complet de la partie en version 1: la sauvegarde automatique du jeu (ADR 0005) fixe ce qui peut être perdu (H-15).
- **Invité relancé**: l'hôte garde l'état de la partie et l'annonce sur la liaison; l'invité relancé propose de la rejoindre d'une touche, puis la reprise se fait des deux côtés (CA-PF-048). Rien ne s'inscrit.

### 9. Rattachement d'une machine réinstallée ou remplacée

Condition: une machine A, membre d'un duo D dont l'autre membre M est sur la machine X, voit une machine N qui n'est membre d'aucun duo de A, et X n'est pas visible.

1. A et N affichent M-23: N semble remplacer l'ordinateur de M. Choix: « Recopier les données du duo », « Plus tard », et un lien discret « Ce n'est pas le même duo ».
2. **Recopier** (accepté sur les deux machines, chacune envoyant son accord par la liaison): A écrit `duo.json` avec N à la place de X pour le membre M (rattachement daté), puis la comparaison des index envoie tout le duo à N. N prend l'identifiant de membre de M: historique et scores le suivent (CA-PF-059). Le profil de N devient celui de M (couleur ajustée si besoin, M-02). Si N détenait déjà une ancienne copie de D (ancienne machine restaurée), la fusion des points 6 et 7 s'applique, sans perte.
3. **Plus tard**: rien n'est écrit; la proposition revient à chaque connexion. Tant qu'elle n'est pas tranchée, les deux machines n'ont pas de duo commun et ne peuvent pas jouer ensemble; la ligne de présence de l'accueil le dit, avec le bouton de la proposition.
4. **Ce n'est pas le même duo**: un nouveau duo se forme (point 2); D reste intact chez A, et redevient le duo affiché si X revient.
5. Si l'ancienne machine X revient après un rattachement, A lui dit qu'elle a été remplacée, à quelle date; ses données locales restent intactes, et elle peut à son tour se rattacher selon cette même procédure (si N est absent) ou former un nouveau duo.

Si les deux machines ont perdu leurs données en même temps, rien ne peut être récupéré: l'export et l'import des sauvegardes sont prévus « plus tard » au cahier.

### 10. Scores (F09)

Le score cumulé est une fonction pure de l'historique du duo, recalculée à l'affichage: victoires de chaque membre par jeu et au total, égalités, pour les jeux `versus`; nombre de parties et dernière progression déclarée pour les jeux `coop`. Les entrées `interrupted` ne comptent pour rien dans le score (ni victoire, ni égalité, ni nombre de parties, ni progression); l'historique les affiche « interrompue » avec leur durée (CA-PF-062, CA-PF-067).

### 11. Format du dossier et migrations

`format.json` porte le format du dossier. Plus récent que ce que l'application connaît: elle ne modifie rien et affiche M-29 (CA-PF-093). Plus ancien: les fichiers à migrer sont d'abord copiés dans `backups/migration-<de>-<vers>-<date>/`, puis migrés, et `format.json` est écrit en dernier. Les révisions de sauvegarde ne sont jamais migrées par la plateforme: leurs données appartiennent au jeu (`dataSchema`, migrations du jeu, ADR 0005).

### 12. Données personnelles

Le dossier ne contient, en fait de données personnelles, que les pseudos. Ni nom de compte, ni nom de l'ordinateur, ni adresse. Le dépôt public ne contient aucune donnée de joueur.

## Conséquences

- Les trois versions précédentes d'une sauvegarde, les copies de conflit et les copies supprimées ne coûtent aucun mécanisme à part: ce sont des révisions que la tête cite encore.
- Une sauvegarde de 20 Mo occupe jusqu'à 80 Mo avec ses trois versions précédentes, et davantage avec des copies de conflit ou de remplacement (plafond théorique de 9 révisions par emplacement). Si la place manque sur le PC, on compressera les révisions sur le disque dans un format de dossier suivant.
- Le salon attend la fin de la comparaison des index pour proposer les sauvegardes: quelques dizaines de millisecondes en temps normal, davantage s'il faut recopier une grosse sauvegarde (une seconde ou deux pour 20 Mo compressés en Wi-Fi).
- L'invité ne voit une partie interrompue par lui pendant une coupure qu'après la reconnexion: le critère CA-PF-047 est à préciser en ce sens (`resolution-hypotheses.md`).
- Le message M-23 a trois choix au lieu de deux; ux-ui-designer écrit son texte.
- La progression d'une partie interrompue après une sauvegarde n'apparaît dans le score qu'à la partie suivante non interrompue, même si la sauvegarde, elle, est bien à jour.

### À vérifier

- Chargement de 2 000 entrées d'historique (2 000 fichiers) sous Windows, antivirus actif: moins d'1 s exigé (CA-PF-064). Repli si la mesure échoue: un cache d'index reconstructible.
- Reprises sur `EPERM` et `EBUSY` face à Microsoft Defender sur le PC du client (CA-PF-053 en CI Windows d'abord).
- Durabilité de `fsync` sous macOS (Node n'emploie pas `F_FULLFSYNC`): acceptable pour une coupure de courant rare, à surveiller.
