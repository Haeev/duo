# ADR 0006: Versions et compatibilité

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-reseau (présence et poignée de main), ingenieur-build (numéros de version, publication) |
| Fonctions du cahier | F13, F12, F07 (sauvegardes d'une version plus récente) |
| Liens | ADR 0005 (pont), 0007 et 0008 (liaison et présence, dev-reseau), 0009 (format des données), 0010 (copie des paquets), 0011 (mises à jour de Duo) |

## Contexte

F13 (cahier 1.0): « Les versions sont comparées dès que les deux ordinateurs se voient. On joue la version la plus récente d'un jeu présente sur l'une des deux machines: elle est copiée vers l'autre par le réseau local, en une action (« Mettre à jour et rejoindre »). Si l'application elle-même est trop ancienne sur une machine, message clair et marche à suivre. »

Ce texte remplace la proposition de `architecture.md` 0.1, où l'invité recevait toujours le jeu de l'hôte: un hôte en retard aurait fait jouer une version plus ancienne. Contraintes de fond:

- Duo se met à jour à la main (ADR 0011): les deux machines auront souvent des versions différentes de l'application pendant quelques jours.
- Les jeux, eux, se mettent à jour sans l'application (F12), par Internet ou par le réseau local.
- Un jeu en lockstep exige le même code et le même moteur JavaScript des deux côtés (`architecture.md`, section 7.4).

## Options

| Option | Pour | Contre |
|---|---|---|
| A. Versions identiques exigées partout (application et jeux) | règle simple à expliquer | une mise à jour de Duo faite sur une seule machine bloque la soirée; contraire à F13 |
| B. Compatibilité de l'application par numéros de protocole; le jeu de l'hôte est copié chez l'invité (`architecture.md` 0.1) | une seule direction de copie | un hôte en retard fait jouer une version plus ancienne, et écraser une version plus récente chez l'invité serait une régression: contraire à F13 1.0 |
| C. Compatibilité de l'application par numéros de protocole; on joue la version la plus récente du jeu présente sur l'une des deux machines, copiée dans un sens ou dans l'autre | conforme à F13; jamais de retour en arrière; une seule action quel que soit le côté en retard | la copie peut aller de l'invité vers l'hôte; règle de choix un peu plus riche |

## Décision

**Option C.**

### 1. Numéros portés

| Numéro | Porté par | Règle |
|---|---|---|
| Version de Duo (SemVer) | l'application | affichée; désigne la machine à mettre à jour; ne bloque pas à elle seule |
| Protocole de la liaison (entier) | l'application | identique sur les deux machines, sinon la machine dont la version de Duo est la plus ancienne doit être mise à jour (M-27) |
| Versions du pont (`majeure.mineure`, ADR 0005) | l'application | doivent couvrir le `sdk` exigé par la version du jeu qu'on va jouer, sur chacune des deux machines (sinon M-13 sur la machine concernée) |
| Format des données (entier, ADR 0009) | le dossier de données | plus récent que ce que l'application connaît: elle ne modifie rien et affiche M-29 |
| Version du jeu (SemVer) et empreinte du paquet | le paquet | identiques avant le départ, au besoin après copie de la plus récente |
| Version d'Electron | l'application | identique sur les deux machines pour un jeu en lockstep seulement |
| Version du catalogue et du manifeste (`schema`) | le catalogue, le paquet | un `schema` inconnu rend l'entrée indisponible (M-13), sans erreur |

Le protocole n'est incrémenté que pour un changement incompatible. Une addition dans une version mineure de Duo (message ou champ nouveau) doit fonctionner face à un pair qui l'ignore: les champs inconnus sont retirés par les schémas `object()` de Valibot (vérifié dans ses `.d.ts`), les messages inconnus sont ignorés et journalisés. Si ce n'est pas possible, on incrémente le protocole.

### 2. Enveloppes figées pour toujours

Pour que deux versions de Duo, même très éloignées, sachent au moins se dire « incompatible, voici qui doit se mettre à jour », deux messages gardent une enveloppe qui ne changera jamais:

- l'annonce de présence sur le LAN (ADR 0008): signature de l'application, version de l'enveloppe, identifiant de la machine, version de Duo, protocole;
- le premier message de la liaison, dans chaque sens (ADR 0007): les mêmes champs, puis, si les protocoles sont égaux, le reste de la poignée de main (versions du pont, version d'Electron, format des données, jeux installés avec version et empreinte, duos connus).

Le format exact de ces messages appartient à dev-reseau; cet ADR fixe les champs qu'ils doivent porter et leur stabilité.

### 3. Moment de la comparaison

Dès que les deux machines se voient (présence, F02), avant toute invitation: l'accueil affiche une incompatibilité de Duo des deux côtés (M-27, CA-PF-090). Les écarts de version d'un jeu s'affichent sur l'invitation et dans le salon, quand ce jeu est choisi (M-28).

### 4. Règle de choix pour un jeu donné

Une fonction pure de `@duo/protocol`, testée sur toutes les combinaisons (CA-PF-107), prend l'état des deux machines et le jeu choisi, et rend une union discriminée:

| Résultat | Condition | Message et action |
|---|---|---|
| `ok` | même version et même empreinte des deux côtés, pont suffisant des deux côtés, Electron identique si lockstep | départ possible |
| `copy` | versions différentes, ou jeu absent d'un côté | la plus récente (SemVer) est copiée vers la machine en retard, en une action: « Mettre à jour et rejoindre » ou « Installer et rejoindre » chez l'invité, « Mettre à jour » chez l'hôte (M-28, CA-PF-091, 092, 125) |
| `app-too-old` | la version la plus récente du jeu exige un pont que l'application d'une machine n'a pas | M-13 sur cette machine, « Comment mettre Duo à jour »; on ne joue pas l'ancienne version |
| `engine-mismatch` | jeu en lockstep et versions d'Electron différentes | variante de M-27 propre à ce jeu, qui désigne la machine dont la version de Duo est la plus ancienne; les autres jeux restent jouables |
| `save-too-new` | la sauvegarde choisie a été écrite par une version du jeu plus récente que celle qu'on jouerait | M-34, mise à jour en une action; la sauvegarde n'est jamais lue ni écrite par la version plus ancienne (CA-PF-124) |

Règles complémentaires:

- **Jamais de retour en arrière**: aucune version d'un jeu n'en remplace une plus récente, ni par copie, ni par téléchargement, ni par import d'un fichier. Pour annuler une version défectueuse, le studio publie une version supérieure.
- Même version et empreintes différentes (erreur de publication, refusée par la CI): la copie de l'hôte l'emporte, et l'anomalie est journalisée.
- La copie passe par la liaison LAN, vérifie la signature du paquet comme un téléchargement (ADR 0010), s'affiche sur les deux machines, et ne demande pas Internet.
- Pour un jeu qui demande un Duo plus récent que celui de la machine, la bibliothèque le marque indisponible (M-13, CA-PF-032).

### 5. Désigner la machine à mettre à jour

Le message nomme toujours une machine par le pseudo de son joueur, jamais un code d'erreur. Pour Duo: la machine dont la version SemVer est la plus ancienne (à versions égales, ce qui ne devrait pas arriver avec des protocoles différents, les deux). Pour un jeu: la machine qui n'a pas la version la plus récente. Le texte dit « trop ancienne », pas « différente »: deux versions différentes de Duo jouent ensemble tant que les règles ci-dessus tiennent (H-29).

## Conséquences

- Une mise à jour de Duo faite sur une seule machine ne bloque pas la soirée, sauf changement de protocole (rare, annoncé dans les notes de version) ou jeu en lockstep après une montée d'Electron.
- La copie d'un jeu peut aller de l'invité vers l'hôte: l'hôte voit alors « Mettre à jour » dans son salon, en une action.
- Si une machine a un Duo trop ancien et pas d'Internet, il faut l'installateur sur une clé ou par un autre moyen: Duo ne copie pas sa propre mise à jour par le LAN en version 1 (risque inscrit dans `architecture.md`, section 16).
- La fonction de compatibilité est pure et exhaustive: chaque combinaison de CA-PF-107 a un test unitaire.

### À vérifier

- Libellés M-27 et E04 « versions » de la spécification UX, à reformuler en « trop ancienne » (proposition transmise au manager).
- Champs exacts de l'annonce de présence et de la poignée de main, avec dev-reseau (ADR 0007 et 0008).
