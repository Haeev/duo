# Critères d'acceptation: plateforme Duo, version 1

| Champ | Valeur |
|---|---|
| Référence | `docs/plateforme/cahier-des-charges.md`, version 0.1 (décisions Q2 et Q3 incluses) |
| Statut | brouillon, à valider avec le cahier des charges |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |
| Rédigé par | qa-testeur |

> Ce document est la section 7 du cahier des charges de la plateforme. Une fois le cahier validé par le client, la plateforme n'est livrée que si chaque critère est satisfait au jalon indiqué. Toute modification passe par le manager et s'inscrit dans l'historique (section 9).

En bref: 117 critères, dont 105 vérifiés automatiquement dans l'environnement cloud, 8 rejoués sur les machines macOS et Windows de l'intégration continue, et 45 vérifiés chez le client (un critère peut avoir plusieurs modes). 31 hypothèses attendent une décision (section 2). La liste à tester chez le client pour la 1.0 tient en 12 points (section 8).

## 1. Mode d'emploi

### 1.1 Forme d'un critère

Chaque critère a un identifiant stable (CA-PF-001 à CA-PF-117), un titre, trois clauses (étant donné, quand, alors), ses modes de vérification et le jalon à partir duquel il doit être satisfait, puis le rester jusqu'à la 1.0. Un identifiant n'est jamais réattribué: un critère retiré reste listé avec la mention « retiré » et la date, un nouveau critère prend le premier numéro libre après le dernier.

Un renvoi H-xx désigne une hypothèse de la section 2, M-xx un message de la section 3. Un critère est satisfait quand tous ses essais réussissent, dans chacun de ses modes. Le rapport de recette (`docs/plateforme/recette/AAAA-MM-JJ.md`) donne pour chaque critère le test, le résultat et la preuve.

### 1.2 Modes de vérification

| Code | Mode | Où | Ce que ça prouve, et les limites |
|---|---|---|---|
| U | Test unitaire (Vitest, sous Node) | cloud, CI | La logique: règles, calculs, machines à états, validation des données. Pas l'intégration. |
| E | Application Electron sous `xvfb-run`, pilotée par Playwright (`_electron`): une instance, ou deux sur la boucle locale avec des dossiers de données distincts | cloud | L'application réelle, sous Linux. Ni le matériel, ni macOS, ni Windows. WebGL2 y tourne en rendu logiciel: images valables, mesures de performance sans valeur. |
| EL | Mode E en réseau local virtuel: deux instances (hôte et invité), chacune dans son espace de noms réseau, reliées par un pont; coupure par désactivation d'une interface; pertes par nftables; latence et gigue par un mandataire de perturbation (Toxiproxy, licence MIT, outil de test non livré); passerelle piège qui compte tout paquet sortant du réseau local | cloud | Découverte par vraie diffusion, coupures, reconnexions, absence d'Internet. Ni les pare-feu de macOS et de Windows, ni le Wi-Fi réel. |
| P2 | Playwright à deux contextes Chromium (hôte et invité) sur l'interface du lanceur servie par Vite, les services du processus principal étant fournis par le banc de test | cloud | Variante rapide de E et EL pour vérifier les écrans à chaque modification. La recette se fait toujours en E ou EL. |
| CI | Tests U et E rejoués sur les machines macOS et Windows de GitHub Actions, gratuites pour un dépôt public | CI | Les vrais systèmes (chemins, remplacement de fichiers, installateurs), pas le matériel du client. À confirmer avec ingenieur-build. |
| D | Relecture d'un document du dépôt par qa-testeur, selon la liste donnée par le critère | dépôt | Le contenu des guides. |
| M | Recette manuelle chez le client, sur le Mac et sur le PC, pas à pas | chez le client | Ce qui dépend du matériel, du réseau et des systèmes réels: installation, pare-feu, son, performances, clavier AZERTY réel. |

Faisabilité vérifiée le 2026-10-30 dans l'environnement cloud, avec des prototypes jetables hors du dépôt: deux instances d'Electron 38 sous `xvfb-run` pilotées par Playwright, avec des dossiers de données aux noms accentués; deux espaces de noms réseau reliés par un pont (diffusion UDP reçue, coupure franche, Internet inaccessible); passerelle piège (68 paquets comptés pour une police chargée par erreur depuis un CDN); relevé des appels `connect` par `strace`; facteur d'échelle 1,5 forcé; événements clavier AZERTY injectés; plantage d'un rendu détecté sans fermeture de la fenêtre; pertes aléatoires par nftables. Limites constatées: le noyau n'a pas netem (la latence passe donc par un mandataire), et la disposition du clavier de l'Xvfb ne change pas (`setxkbmap` reste sans effet): l'AZERTY réel se vérifie chez le client.

### 1.3 Règles de mesure

- **Délai « en moins de N s »**: de l'action qui déclenche (touche, coupure, lancement) à l'affichage de l'élément attendu, ou à l'événement correspondant dans le journal de Duo. En automatique, 10 essais, chacun sous le seuil: c'est le pire essai qui compte, pas la moyenne. Chez le client, 3 essais, au chronomètre ou d'après les horodatages du journal.
- **Identique sur les deux machines**: mêmes valeurs, champ par champ (EL), ou constatées côte à côte (M).
- **Empreinte**: SHA-256 d'un fichier; pour l'état d'un jeu, l'empreinte fournie par le crochet de test du jeu (section 6).
- **Mémoire de Duo**: somme des `workingSetSize` de tous ses processus (`app.getAppMetrics()`), relevée après un ramasse-miettes forcé.
- **Images par seconde**: intervalles entre deux images successives du rendu mesuré (lanceur ou jeu), relevés sur 60 s par l'affichage des performances de Duo (section 6).
- **Message M-xx**: l'identifiant du message est présent à l'écran (attribut de test) et son texte est exactement celui de la spécification UX; tant que celle-ci ne le donne pas, on vérifie le contenu obligatoire de la section 3.
- Les délais et seuils chiffrés sont des propositions de qa-testeur, cohérentes avec les piliers du cahier; les plus structurants figurent en hypothèses.

### 1.4 Environnements et données de test

- **Machines du client**: le Mac (puce M1, version de macOS à relever) et le PC, machine de référence pour les performances (configuration à relever, question Q4 du cahier; hypothèse en attendant: Intel Core i3 de 2018 à graphique intégré).
- **Profils réseau**: R0, réseau local virtuel sans perturbation; R1, 80 ms de latence, 20 ms de gigue et 2 % de pertes (valeurs du banc de dev-reseau); coupure, lien désactivé (EL) ou Wi-Fi coupé (M); micro-coupure, lien désactivé pendant 500 ms.
- **Zones d'affichage de référence** (taille en pixels CSS et facteur d'échelle):

| Zone | Facteur | Cas réel |
|---|---|---|
| 1280x640 | 1,5 | écran 1920x1080 à 150 % (portable Windows), fenêtre agrandie: la plus petite zone (H-31) |
| 1280x720 | 1,5 | même écran, plein écran |
| 1366x688 | 1 | portable 1366x768 à 100 %, fenêtre agrandie |
| 1366x768 | 1 | même écran, plein écran |
| 1536x864 | 1,25 | écran 1920x1080 à 125 %, plein écran |
| 1920x1080 | 1 | écran 1920x1080 à 100 %, plein écran |
| 1440x900 | 2 | MacBook Air M1 à son réglage par défaut, plein écran |

- **Pseudos de test** (H-01):
  - acceptés tels quels: « Lou », « Hélène », « Jean-Kévin », « D'Artagnan », « D’Artagnan », « Zoé 2 », « Œdipe Çà », seize « W » d'affilée;
  - acceptés après transformation: « Max » entouré de trois espaces de chaque côté, enregistré « Max »; « Hélène » saisi en Unicode décomposé (e suivi de U+0301), enregistré en NFC;
  - refusés: champ vide, trois espaces, dix-sept « W », « Lou » suivi de l'émoji U+1F338, « a<b », « Lou_92 », « Lou! », « Max » puis une tabulation puis « Lou », « Max » puis un retour à la ligne puis « Lou ».
- **Chemins de test**: sous Linux, un dossier de données nommé « Hélène d'Arc Ü » suivi de l'émoji U+1F600, puis le même nom en Unicode décomposé; sous Windows, `C:\Users\Hélène Dupont-Lefèvre\AppData\Roaming\Duo`.
- **Jeux**: le jeu témoin, livré avec Duo, et les jeux d'essai, réservés aux tests (section 6).

## 2. Hypothèses en attente de décision

Le cahier v0.1 laisse ces points ouverts. Les critères les supposent tranchés comme ci-dessous. Toute décision différente du client ou du manager entraîne la mise à jour des critères cités et une ligne dans l'historique.

| # | Sujet | Règle supposée par les critères | Fonctions | Critères |
|---|---|---|---|---|
| H-01 | Pseudo | 1 à 16 caractères (graphèmes): lettres latines accentuées ou non, chiffres, espaces intérieures, trait d'union, apostrophe (droite ou typographique). Espaces de début et de fin retirées, enregistrement en NFC. Émojis et autres symboles refusés, pour que tout jeu puisse afficher les pseudos, même avec une police en pixels. | F01 | 002 |
| H-02 | Couleur de joueur | Choisie dans une palette fixe définie par la direction artistique (pas de couleur libre, pour garantir contraste et daltonisme). Si les deux profils ont la même couleur, l'invité reçoit pour la session la première couleur libre de la palette. | F01 | 003, 006, 109 |
| H-03 | Identité du duo | Chaque profil a un identifiant interne stable, indépendant du pseudo; le duo est la paire de ces identifiants. Historique, scores et sauvegardes s'y rattachent et s'affichent avec les pseudos actuels. | F01, F07, F08 | 004 |
| H-04 | Invitation | Visible sur tout écran du lanceur, sauf pendant le premier lancement. Elle prend le focus si aucun champ de saisie n'est actif. Entrée rejoint; Échap l'écarte, et elle reste dans la liste « Rejoindre ». | F02 | 007, 008 |
| H-05 | Saisie de l'adresse IP | Les touches de la rangée des chiffres donnent des chiffres même sans Maj (lecture par position de touche), la virgule vaut un point, aucun port à saisir. | F02 | 010 |
| H-06 | Deux salons en même temps | Chacun voit l'invitation de l'autre; en rejoindre une ferme son propre salon. | F02 | 020 |
| H-07 | Délais de découverte | Invitation visible en moins de 5 s; aide affichée après 15 s sans hôte; échec d'une adresse IP signalé en moins de 10 s. | F02 | 007, 011, 018 |
| H-08 | Salon | L'hôte seul choisit le jeu et la sauvegarde; tout changement remet les deux joueurs à « pas prêt ». Démarrage après un compte à rebours de 3 s, annulé si l'un n'est plus prêt. | F03 | 024, 025, 026 |
| H-09 | Pause et reprise | Échap met la partie en pause sur les deux machines et affiche qui l'a demandée; l'un ou l'autre peut reprendre; compte à rebours de 3 s avant toute reprise, après une pause comme après une reconnexion. | F05, F06 | 035, 036, 046 |
| H-10 | Fin de partie | « Rejouer » relance quand les deux l'ont choisi; « Revenir au salon », choisi par l'un, ramène les deux. | F05 | 037 |
| H-11 | Partie interrompue | Une partie quittée avant la fin, arrêtée par un plantage ou abandonnée pendant une déconnexion est inscrite à l'historique comme « interrompue », avec sa durée, sans compter dans les scores. | F05, F08, F09 | 038, 047, 062, 067 |
| H-12 | Fenêtre réduite | Réduire la fenêtre met la partie en pause pour les deux; une simple perte du focus ne met pas en pause, mais relâche les touches. | F05 | 041 |
| H-13 | Fermer Duo en pleine partie | Confirmation, sauvegarde de sortie, puis l'autre machine est prévenue et revient au salon sans attendre de reconnexion. | F05, F06 | 042 |
| H-14 | Coupure du réseau | Pause en moins de 3 s; aucune pause pour une interruption de 500 ms ou moins; attente sans limite de durée, « Quitter la partie » toujours possible; reconnexion et reprise automatiques. | F06 | 044, 045, 046, 047 |
| H-15 | Redémarrage de Duo en pleine partie | Chez l'invité: la partie reprend, car l'hôte garde l'état. Chez l'hôte: la partie ne peut pas reprendre, on repart de la dernière sauvegarde. | F06 | 048, 049 |
| H-16 | Taille des sauvegardes | Jusqu'à 20 Mo (le premier jeu envisagé est une simulation de vie d'une centaine d'heures), à confirmer par le cahier de ce jeu. | F07 | 051, 053, 106 |
| H-17 | Sens de « la plus récente » | La copie au plus grand numéro de version (incrémenté à chaque écriture), indépendamment des horloges des machines; à numéro égal, la date d'écriture la plus récente. | F07 | 055, 056 |
| H-18 | Machine réinstallée ou remplacée | À la première connexion, après confirmation des deux joueurs, l'autre machine lui recopie toutes les données du duo, et le nouveau profil prend la place de l'ancien. | F07 | 059 |
| H-19 | Date et durée dans l'historique | Date et heure de début, en heure locale; durée de jeu hors pauses et hors attentes de reconnexion. | F08 | 060 |
| H-20 | Jeux sans fin de partie | Le jeu déclare s'il a des parties (avec un résultat) ou des sessions (sans résultat). Une session est inscrite quand on la quitte, avec la progression atteinte; la bibliothèque affiche alors la durée typique d'une session. | F04, F08, F09 | 065 |
| H-21 | Modèle de score | Chaque jeu se range dans l'un des deux modèles, même s'il est asymétrique ou en coopétition: affrontement (un vainqueur ou une égalité) ou coopération (progression commune, dernière valeur déclarée par le jeu). | F04, F09 | 029, 068 |
| H-22 | Volumes | De 0 à 100 % par pas de 5 %; gain effectif d'une catégorie = volume général × volume de la catégorie. | F10 | 069 |
| H-23 | Plein écran | Aussi par raccourci: F11 sous Windows, Ctrl+Cmd+F sous macOS. | F10 | 071 |
| H-24 | Taille de l'interface | 100, 125 ou 150 %, appliquée au lanceur et aux surcouches de la plateforme; les jeux reçoivent la valeur. | F10 | 072 |
| H-25 | Touches des jeux | Pour chaque jeu qui le permet; Échap réservée à la pause; touche déjà prise refusée; touches et volumes modifiables aussi depuis le menu de pause. | F10 | 074 |
| H-26 | Premier lancement | Moins de 5 min par machine jusqu'à voir l'autre machine, en suivant seulement les écrans de Duo. | F11 | 080 |
| H-27 | Désinstallation | Elle conserve les données du duo; une réinstallation les retrouve. | F11 | 082 |
| H-28 | Nouveaux jeux | Recherche automatique au démarrage et à l'ouverture de la bibliothèque si Internet répond; installation à la demande, sans redémarrage; sans Internet, une simple mention. | F12 | 084, 088 |
| H-29 | Compatibilité | Versions strictement identiques exigées pour l'application (les trois numéros) et pour le jeu choisi. | F13 | 090, 091, 107 |
| H-30 | Mesure des 60 images par seconde | Sur 60 s par scénario: moyenne d'au moins 58 images par seconde, et au moins 99 % des intervalles entre images à 20 ms ou moins. La machine de référence est le PC réel du client. | Transverse | 095, 096 |
| H-31 | Plus petite zone d'affichage | 1280x640 pixels CSS, soit un écran 1920x1080 à 150 % en fenêtre agrandie. | Transverse | 072, 113 |

## 3. Catalogue des messages

Chaque message attendu par un critère a un identifiant. ux-ui-designer en fixe le texte exact dans `docs/plateforme/ux/parcours.md`; ce texte contient au moins les éléments ci-dessous et tutoie le joueur.

| Message | Situation | Affiché sur | Contenu obligatoire |
|---|---|---|---|
| M-01 | Pseudo refusé | la machine qui saisit, sous le champ | la règle non respectée: longueur, ou caractère refusé (cité) |
| M-02 | Même couleur que l'hôte | l'invité | la couleur attribuée pour cette session; le profil n'est pas modifié |
| M-03 | Pare-feu de Windows qui bloque Duo | le PC | la cause; les étapes pour autoriser Duo sur les réseaux privés, avec les libellés exacts de Windows; « Réessayer » |
| M-04 | Réseau Windows de type « Public » | le PC | la cause; les étapes pour passer le réseau en « Privé »; « Réessayer » |
| M-05 | Accès au réseau local refusé par macOS | le Mac | la cause; les étapes dans Réglages Système; « Réessayer », ou l'indication de redémarrer Duo si macOS l'impose |
| M-06 | Pare-feu de macOS qui bloque les connexions entrantes | le Mac hôte | la cause; les étapes pour autoriser Duo; « Réessayer » |
| M-07 | Aucun réseau | la machine concernée | l'ordinateur n'est relié à aucun réseau; se connecter au même réseau que l'autre ordinateur; le message disparaît seul au retour du réseau |
| M-08 | Aucun hôte trouvé après 15 s | l'invité | vérifier que l'autre a ouvert un salon et que les deux ordinateurs sont sur le même réseau, pas sur un réseau invité; accès direct à la connexion par adresse IP |
| M-09 | Adresse IP mal formée | l'invité | le format attendu, avec un exemple |
| M-10 | Hôte injoignable | l'invité | l'adresse essayée; les causes possibles (salon fermé, mauvaise adresse, ordinateur de l'hôte qui bloque Duo); « Réessayer » et « Modifier l'adresse » |
| M-11 | Salon fermé par l'hôte | l'invité | le pseudo de l'hôte |
| M-12 | Jeu illisible | la machine concernée | le nom du dossier du jeu; les autres jeux restent jouables |
| M-13 | Jeu qui exige un Duo plus récent | la machine concernée | la version de Duo nécessaire; comment mettre Duo à jour |
| M-14 | Plantage ou échec de chargement d'un jeu | les deux machines | le nom du jeu; la machine où le problème a eu lieu; la date de la dernière sauvegarde conservée, si le jeu sauvegarde |
| M-15 | Fermeture de Duo en pleine partie | la machine qui ferme | la partie s'arrête pour les deux joueurs; une sauvegarde de sortie sera écrite ou non; « Quitter » et « Annuler » |
| M-16 | L'autre joueur a quitté Duo | l'autre machine | son pseudo; la date de la dernière sauvegarde, si le jeu sauvegarde |
| M-17 | Attente de reconnexion | l'hôte | le pseudo de l'invité; « Quitter la partie » |
| M-18 | Reconnexion en cours | l'invité | le pseudo de l'hôte; « Quitter la partie » |
| M-19 | Partie impossible à reprendre | l'invité | Duo a redémarré chez l'hôte; la date de la dernière sauvegarde |
| M-20 | Sauvegarde illisible | la machine concernée | le jeu et la sauvegarde; la date de la version précédente utilisée à la place |
| M-21 | Sauvegardes remises d'accord | les deux machines | le jeu et la sauvegarde; la date de la version retenue; l'autre version est gardée en secours |
| M-22 | Écriture d'une sauvegarde impossible | la machine concernée | la cause (droits, place sur le disque); la copie de l'autre machine est à jour |
| M-23 | Machine sans les données du duo | les deux machines | la proposition de recopier les données du duo depuis l'autre machine, ce qui sera recopié, « Recopier » et « Plus tard » |
| M-24 | Touche déjà utilisée | la machine qui règle | l'action qui utilise déjà cette touche |
| M-25 | Téléchargement ou installation d'un jeu échoué | la machine concernée | le jeu; la cause (connexion coupée, fichier abîmé); la version précédente reste installée; « Réessayer » |
| M-26 | Recherche de nouveaux jeux impossible | la bibliothèque | une ligne, non bloquante: pas d'Internet, les jeux installés restent jouables |
| M-27 | Versions de Duo différentes | les deux machines | les deux versions; le pseudo de la machine à mettre à jour; la marche à suivre (guide, page de téléchargement) |
| M-28 | Version d'un jeu différente, ou jeu absent | les deux machines | le jeu; les deux versions, ou « non installé »; la machine concernée; le bouton ou le chemin pour installer ou mettre à jour |
| M-29 | Données d'une version plus récente de Duo | la machine concernée | aucune donnée n'a été modifiée; installer la dernière version de Duo |

## 4. Critères par fonction

### F01 Profil

**CA-PF-001. Profil obligatoire au premier lancement**
- Étant donné un dossier de données Duo vide,
- quand Duo démarre,
- alors le parcours de premier lancement s'affiche, et ni la bibliothèque, ni le salon, ni l'historique, ni les scores ne sont atteignables, au clavier comme à la souris, avant l'enregistrement d'un profil valide.
- Vérification: E. Jalon: alpha.

**CA-PF-002. Règles du pseudo**
- Étant donné l'écran de création ou de modification du profil,
- quand on valide chacun des pseudos de test (section 1.4),
- alors chaque pseudo accepté est enregistré sous la forme indiquée dans la liste, et chaque pseudo refusé l'est avec le message M-01 sous le champ, sans perte de la saisie.
- Vérification: U (règle), E (saisie et message). Jalon: alpha. Hypothèse: H-01.

**CA-PF-003. Choix de la couleur**
- Étant donné l'écran de profil,
- quand on ouvre le choix de la couleur,
- alors il propose exactement les couleurs de la palette des joueurs (conforme à CA-PF-109), une et une seule est sélectionnée, et on la change au clavier seul (flèches, puis Entrée) comme à la souris.
- Vérification: E. Jalon: alpha. Hypothèse: H-02.

**CA-PF-004. Profil modifiable sans rien perdre**
- Étant donné un profil qui a des parties dans l'historique, des scores et des sauvegardes,
- quand on change son pseudo et sa couleur dans les réglages,
- alors les nouvelles valeurs apparaissent sur tous les écrans de la machine en moins de 1 s et sont conservées après redémarrage, et l'historique, les scores et les sauvegardes du duo sont inchangés (même nombre d'entrées, mêmes valeurs, mêmes empreintes), affichés avec le nouveau pseudo.
- Vérification: E. Jalon: alpha. Hypothèse: H-03.

**CA-PF-005. Profil modifié vu par l'autre machine**
- Étant donné les deux machines A et B,
- quand A enregistre un nouveau pseudo ou une nouvelle couleur,
- alors B affiche la nouvelle valeur en moins de 2 s si A et B sont connectées, sinon dès leur connexion suivante.
- Vérification: EL. Jalon: alpha.

**CA-PF-006. Jamais deux fois la même couleur dans un salon**
- Étant donné deux profils de même couleur,
- quand ils se retrouvent dans le même salon,
- alors l'invité reçoit pour la session la première couleur de la palette différente de celle de l'hôte, les deux écrans montrent deux couleurs différentes, l'invité voit M-02, et son profil enregistré garde sa couleur.
- Vérification: EL. Jalon: alpha. Hypothèse: H-02.

### F02 Découverte et connexion

**CA-PF-007. Découverte automatique de l'hôte**
- Étant donné A et B sur le même réseau local, autorisations réseau accordées, profils créés, B sur n'importe quel écran du lanceur,
- quand A ouvre un salon,
- alors B affiche l'invitation d'A (pseudo d'A et nom du jeu) en moins de 5 s, sans aucune saisie: 10 essais sur 10 en automatique; chez le client, 3 essais sur 3 avec le Mac comme hôte et 3 sur 3 avec le PC comme hôte.
- Vérification: EL, M. Jalon: prototype. Hypothèses: H-04, H-07.

**CA-PF-008. Rejoindre d'une touche**
- Étant donné l'invitation d'A affichée chez B, sans champ de saisie actif chez B,
- quand B appuie une fois sur Entrée,
- alors B entre dans le salon d'A, et les deux écrans montrent les deux profils en moins de 2 s.
- Vérification: EL, M. Jalon: prototype. Hypothèse: H-04.

**CA-PF-009. Invitation retirée quand l'hôte s'en va**
- Étant donné l'invitation d'A affichée chez B,
- quand A ferme son salon ou quitte Duo par la fermeture habituelle, puis, dans un second essai, quand le processus Duo d'A est tué,
- alors l'invitation disparaît de l'écran de B en moins de 3 s dans le premier cas, en moins de 10 s dans le second, et ne peut plus être choisie.
- Vérification: EL. Jalon: alpha.

**CA-PF-010. Connexion par adresse IP**
- Étant donné A qui a ouvert un salon et dont l'écran d'hôte affiche ses adresses IPv4 privées,
- quand B saisit l'une de ces adresses, sans port, dans « Rejoindre par adresse IP » et valide,
- alors B entre dans le salon d'A en moins de 5 s; le champ accepte les chiffres du pavé numérique et ceux de la rangée du haut, avec ou sans Maj, et la virgule à la place du point.
- Vérification: U (lecture de la saisie), EL, M. Jalon: prototype. Hypothèse: H-05.

**CA-PF-011. Adresse mal formée ou injoignable**
- Étant donné l'écran « Rejoindre par adresse IP »,
- quand B valide une valeur mal formée (« 192.168.1 », « 192.168.1.300 », « abc », champ vide), puis une adresse bien formée où aucun Duo n'écoute,
- alors la valeur mal formée provoque M-09 en moins de 0,5 s, sans tentative de connexion; l'adresse injoignable provoque M-10 en moins de 10 s; dans les deux cas, la saisie reste modifiable dans le champ.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-07.

**CA-PF-012. Hôte qui bloque les connexions entrantes**
- Étant donné un hôte dont l'invitation parvient à B mais qui bloque les connexions entrantes (règle de pare-feu simulée en EL; pare-feu du système chez le client),
- quand B tente de rejoindre,
- alors B affiche M-10 en moins de 10 s, en citant le blocage par l'ordinateur de l'hôte parmi les causes possibles; l'hôte affiche le message de son système (M-03 sous Windows, M-06 sous macOS) selon CA-PF-013 et CA-PF-016.
- Vérification: EL (côté invité), M. Jalon: alpha.

**CA-PF-013. Diagnostic: pare-feu de Windows**
- Étant donné le PC où l'accès réseau de Duo est refusé par le pare-feu de Windows (« Annuler » à la première demande, ou règle de blocage),
- quand on ouvre l'écran pour héberger ou pour rejoindre,
- alors le PC affiche M-03 en moins de 5 s, et une fois ses étapes suivies, « Réessayer » suffit, sans redémarrer Duo, pour retrouver le Mac.
- Vérification: M; CI Windows pour la détection d'une règle de blocage créée par script. Jalon: bêta.

**CA-PF-014. Diagnostic: réseau Windows « Public »**
- Étant donné le PC dont la connexion active est de type « Réseau public » dans Windows,
- quand on ouvre l'écran pour héberger ou pour rejoindre,
- alors le PC affiche M-04 en moins de 5 s, et une fois le réseau passé en « Réseau privé » selon ses étapes, « Réessayer » suffit, sans redémarrer Duo, pour retrouver le Mac.
- Vérification: M. Jalon: bêta.

**CA-PF-015. Diagnostic: réseau local refusé par macOS**
- Étant donné le Mac où l'accès au réseau local est refusé à Duo (Réglages Système, Confidentialité et sécurité, Réseau local),
- quand on ouvre l'écran pour héberger ou pour rejoindre,
- alors le Mac affiche M-05 en moins de 5 s, et une fois l'accès rétabli, « Réessayer » suffit pour retrouver le PC, ou M-05 dit de redémarrer Duo si macOS l'impose.
- Vérification: M. Jalon: bêta.

**CA-PF-016. Diagnostic: pare-feu de macOS**
- Étant donné le Mac dont le pare-feu est actif et règle Duo sur « bloquer les connexions entrantes »,
- quand le Mac ouvre un salon,
- alors il affiche M-06 en moins de 5 s, et une fois ses étapes suivies, « Réessayer » suffit pour que le PC rejoigne.
- Vérification: M. Jalon: bêta.

**CA-PF-017. Aucun réseau**
- Étant donné une machine sans connexion réseau (Wi-Fi coupé, câble débranché),
- quand on ouvre l'écran pour héberger ou pour rejoindre,
- alors M-07 s'affiche en moins de 3 s, puis disparaît de lui-même moins de 10 s après le retour du réseau, la recherche reprenant sans action.
- Vérification: EL, M. Jalon: alpha.

**CA-PF-018. Aucun hôte trouvé**
- Étant donné B sur l'écran pour rejoindre, sans aucune invitation reçue (A n'héberge pas, ou réseau qui isole les appareils, simulé en EL en bloquant la diffusion),
- quand 15 s s'écoulent,
- alors B affiche M-08; la recherche continue, et une invitation qui arrive ensuite s'affiche en moins de 5 s à la place du message.
- Vérification: EL. Jalon: alpha. Hypothèse: H-07.

**CA-PF-019. Plusieurs interfaces réseau**
- Étant donné un hôte qui a, en plus de l'interface du réseau commun, au moins une autre interface privée (VPN, adaptateur virtuel Hyper-V, WSL ou VirtualBox),
- quand il ouvre un salon,
- alors l'invité le découvre en moins de 5 s, l'écran d'hôte liste toutes ses adresses IPv4 privées avec le nom de leur interface, et la connexion par adresse IP réussit avec l'adresse du réseau commun.
- Vérification: EL (interface supplémentaire dans l'espace de noms de l'hôte), M si le PC a de tels adaptateurs. Jalon: alpha.

**CA-PF-020. Deux salons ouverts en même temps**
- Étant donné A et B qui ouvrent chacun un salon à moins de 2 s d'intervalle,
- quand B rejoint le salon d'A depuis l'invitation,
- alors le salon de B se ferme, son invitation disparaît chez A en moins de 3 s, et il reste exactement un salon, celui d'A, avec les deux joueurs.
- Vérification: EL. Jalon: alpha. Hypothèse: H-06.

**CA-PF-021. Messages réseau invalides**
- Étant donné un hôte en salon,
- quand une autre adresse du réseau envoie à ses ports de découverte et de connexion 10 000 messages aléatoires, tronqués, de 1 Mo, ou au format d'une autre application,
- alors Duo ne plante pas, aucun faux hôte n'apparaît chez l'invité, et un invité légitime rejoint ensuite le salon en moins de 5 s.
- Vérification: U (validation des messages), EL. Jalon: alpha.

### F03 Salon

**CA-PF-022. Contenu du salon**
- Étant donné A et B dans le salon d'A, A ayant choisi un jeu et une sauvegarde,
- quand on compare les deux écrans,
- alors chacun affiche les deux pseudos avec leur couleur, l'état de chaque joueur écrit en toutes lettres (pas seulement par une couleur ou une icône), le nom du jeu, et la sauvegarde choisie (nom, date et heure de dernière écriture) ou la mention d'une nouvelle partie, avec des valeurs identiques sur les deux écrans.
- Vérification: EL, M. Jalon: prototype pour les pseudos, les états et le jeu; alpha pour la sauvegarde.

**CA-PF-023. État « prêt » partagé**
- Étant donné le salon,
- quand un joueur change son état, par une touche ou un clic,
- alors le nouvel état s'affiche sur les deux écrans en moins de 1 s, y compris avec le profil réseau R1.
- Vérification: EL, M. Jalon: prototype.

**CA-PF-024. Démarrage quand les deux sont prêts**
- Étant donné le salon avec un jeu choisi et un seul joueur prêt,
- quand le second se déclare prêt,
- alors un compte à rebours de 3 s s'affiche sur les deux écrans, puis le chargement commence sur les deux machines; si l'un repasse à « pas prêt » pendant le compte à rebours, celui-ci s'arrête sur les deux écrans en moins de 1 s et rien ne démarre.
- Vérification: EL, M. Jalon: prototype. Hypothèse: H-08.

**CA-PF-025. Jamais de démarrage partiel ni double**
- Étant donné le salon,
- quand les deux joueurs changent leur état selon 1 000 séquences aléatoires, dont des changements simultanés à moins de 50 ms d'écart, avec le profil réseau R1,
- alors la partie démarre si et seulement si les deux joueurs sont prêts à la fin du compte à rebours, jamais deux fois, et 1 s après la dernière action les deux machines sont dans le même état (salon ou chargement).
- Vérification: U (machine à états du salon), EL (50 séquences tirées des 1 000). Jalon: alpha. Hypothèse: H-08.

**CA-PF-026. Choix réservé à l'hôte**
- Étant donné le salon avec au moins un joueur prêt,
- quand l'hôte change de jeu ou de sauvegarde,
- alors les deux joueurs repassent à « pas prêt », le nouveau choix s'affiche chez l'invité en moins de 1 s, et l'invité n'a aucun moyen de changer le jeu ni la sauvegarde.
- Vérification: EL. Jalon: alpha. Hypothèse: H-08.

**CA-PF-027. Départ de l'invité**
- Étant donné le salon avec deux joueurs,
- quand l'invité quitte le salon,
- alors l'hôte voit en moins de 3 s qu'il attend un joueur, son invitation est de nouveau diffusée, et l'invité peut revenir comme en CA-PF-008.
- Vérification: EL. Jalon: alpha.

**CA-PF-028. Salon fermé par l'hôte**
- Étant donné le salon avec deux joueurs,
- quand l'hôte ferme le salon,
- alors l'invité revient à la bibliothèque en moins de 3 s, avec M-11.
- Vérification: EL. Jalon: alpha.

### F04 Bibliothèque

**CA-PF-029. Fiche de chaque jeu**
- Étant donné le jeu témoin et les jeux d'essai installés, dont les manifestes déclarent nom, vignette, description, type et durée,
- quand on ouvre la bibliothèque,
- alors chaque jeu valide y figure une seule fois, avec sa vignette (image chargée, de dimensions non nulles), son nom, sa description et sa durée identiques au texte du manifeste, son type en toutes lettres (« Coopération » ou « Affrontement »), et le nombre de sauvegardes du duo, zéro compris.
- Vérification: E. Jalon: alpha. Hypothèse: H-21.

**CA-PF-030. Sauvegardes d'un jeu**
- Étant donné un jeu qui a deux sauvegardes du duo,
- quand on ouvre sa fiche dans la bibliothèque,
- alors les deux sauvegardes sont listées de la plus récente à la plus ancienne, chacune avec son nom ou son emplacement, la date et l'heure de sa dernière écriture et la progression déclarée par le jeu, et la liste est identique sur les deux machines.
- Vérification: EL. Jalon: alpha.

**CA-PF-031. Jeu illisible**
- Étant donné, à côté de jeux valides, un paquet de jeu au manifeste absent, illisible ou incomplet,
- quand on ouvre la bibliothèque,
- alors Duo ne plante pas, les jeux valides restent affichés et jouables, le jeu illisible ne peut pas être choisi, et M-12 nomme son dossier.
- Vérification: U, E. Jalon: alpha.

**CA-PF-032. Jeu qui exige un Duo plus récent**
- Étant donné un jeu dont le manifeste exige une version du SDK plus récente que celle de l'application,
- quand on ouvre la bibliothèque,
- alors le jeu est marqué indisponible avec M-13 et ne peut pas être choisi pour un salon.
- Vérification: U, E. Jalon: alpha.

### F05 Cycle de vie d'un jeu

**CA-PF-033. Chargement synchronisé**
- Étant donné les deux joueurs prêts,
- quand le compte à rebours se termine,
- alors les deux machines affichent un écran de chargement en moins de 0,5 s, avec le nom du jeu et l'avancement de chaque joueur; le jeu ne démarre que lorsque les deux ont fini de charger, et les deux démarrages ont lieu à moins de 200 ms d'écart (horloge commune du réseau virtuel, profil R0).
- Vérification: EL. Jalon: prototype.

**CA-PF-034. Échec du chargement**
- Étant donné un jeu d'essai qui échoue pendant son chargement sur l'une des machines (fichier manquant ou erreur levée),
- quand le chargement est lancé,
- alors les deux machines reviennent au salon moins de 5 s après l'échec, avec M-14, et un autre jeu peut être lancé aussitôt.
- Vérification: EL. Jalon: alpha.

**CA-PF-035. Pause demandée par l'un ou l'autre**
- Étant donné une partie en cours,
- quand l'un des joueurs appuie sur Échap,
- alors le menu de pause s'affiche sur les deux machines en moins de 500 ms avec le profil R1, avec le pseudo de qui l'a demandée, et la partie est figée: l'empreinte de l'état du jeu ne change pas pendant 10 s de pause.
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-09.

**CA-PF-036. Reprise**
- Étant donné une partie en pause,
- quand l'un ou l'autre joueur choisit « Reprendre »,
- alors un compte à rebours de 3 s s'affiche sur les deux écrans, puis la partie reprend sur les deux machines depuis l'état figé (empreinte identique à celle de la mise en pause).
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-09.

**CA-PF-037. Fin de partie**
- Étant donné une partie du jeu témoin menée à son terme,
- quand le jeu annonce la fin,
- alors l'écran de résultats s'affiche sur les deux machines en moins de 1 s, avec le même résultat et les mêmes scores, et propose « Rejouer » et « Revenir au salon »; la partie recommence quand les deux ont choisi « Rejouer »; dès que l'un choisit « Revenir au salon », les deux machines y reviennent en moins de 2 s.
- Vérification: EL, M. Jalon: prototype pour une partie jouée jusqu'à la fin; alpha pour l'écran de résultats complet. Hypothèse: H-10.

**CA-PF-038. Quitter une partie en cours**
- Étant donné une partie en pause,
- quand un joueur choisit « Quitter la partie » et confirme,
- alors les deux machines reviennent au salon en moins de 2 s; si le jeu déclare une sauvegarde à la sortie, elle est écrite sur les deux machines avant le retour au salon; la partie est inscrite à l'historique comme interrompue.
- Vérification: EL. Jalon: alpha. Hypothèse: H-11.

**CA-PF-039. Un jeu qui plante ne ferme pas Duo**
- Étant donné une partie en cours,
- quand le jeu d'essai plante sur l'une des machines selon chacun de ses quatre modes (exception non rattrapée, promesse rejetée non gérée, arrêt brutal du processus qui exécute le jeu, boucle infinie qui fige le jeu),
- alors sur les deux machines Duo reste ouvert et revient au salon avec M-14 en moins de 5 s (en moins de 15 s pour la boucle infinie, détection comprise); la dernière sauvegarde écrite est intacte (empreinte); une nouvelle partie se lance aussitôt, sans redémarrer Duo.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-040. Aucune touche bloquée à la perte du focus**
- Étant donné une partie où un joueur maintient enfoncée une touche de déplacement,
- quand la fenêtre de Duo perd le focus (Alt+Tab, Cmd+Tab, clic dans une autre application) avant que la touche soit relâchée,
- alors le jeu considère toutes les touches comme relâchées en moins de 100 ms (le personnage s'arrête), et au retour du focus aucune touche n'est enfoncée tant qu'on n'en presse pas une.
- Vérification: E, M. Jalon: alpha.

**CA-PF-041. Fenêtre réduite**
- Étant donné une partie en cours,
- quand un joueur réduit la fenêtre de Duo,
- alors la partie se met en pause sur les deux machines en moins de 1 s, comme en CA-PF-035; une simple perte du focus ne la met pas en pause.
- Vérification: E, EL. Jalon: alpha. Hypothèse: H-12.

**CA-PF-042. Fermer Duo en pleine partie**
- Étant donné une partie en cours,
- quand un joueur ferme Duo (Cmd+Q, Alt+F4 ou bouton de fermeture de la fenêtre),
- alors Duo met la partie en pause et demande confirmation (M-15); « Annuler » laisse la partie en pause; « Quitter » écrit la sauvegarde de sortie si le jeu en déclare une, puis ferme Duo, et l'autre machine affiche M-16 et revient au salon en moins de 3 s, sans attente de reconnexion.
- Vérification: E, EL, M. Jalon: alpha. Hypothèse: H-13.

**CA-PF-043. Ressources libérées à la sortie d'un jeu**
- Étant donné le jeu témoin lancé, joué 30 s, puis quitté,
- quand le salon est revenu à l'écran,
- alors aucun contexte WebGL, contexte audio, minuteur ni écouteur créé par le jeu ne reste actif (compteurs du mode test à zéro).
- Vérification: E. Jalon: alpha.

### F06 Déconnexion

**CA-PF-044. Pause automatique à la coupure**
- Étant donné une partie en cours,
- quand le lien entre les deux machines est coupé (interface désactivée en EL; Wi-Fi coupé sur une machine chez le client),
- alors les deux machines sont en pause en moins de 3 s; l'hôte affiche M-17 et l'invité M-18.
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-14.

**CA-PF-045. Pas de pause pour une micro-coupure**
- Étant donné une partie en cours,
- quand le lien est interrompu pendant 500 ms puis rétabli,
- alors aucune pause ni message de déconnexion n'apparaît, et l'état reste synchronisé (empreintes identiques au contrôle suivant).
- Vérification: EL. Jalon: alpha. Hypothèse: H-14.

**CA-PF-046. Reprise là où la partie en était**
- Étant donné une partie en pause après une coupure,
- quand le lien revient après 10 s, après 60 s, puis après 10 min (trois essais),
- alors la connexion se rétablit sans action des joueurs moins de 5 s après le retour du lien, un compte à rebours de 3 s s'affiche sur les deux écrans, et la partie reprend avec une empreinte d'état identique à celle de la mise en pause.
- Vérification: EL, M (coupure de 30 s). Jalon: alpha. Hypothèses: H-09, H-14.

**CA-PF-047. Attente sans limite, sortie toujours possible**
- Étant donné une partie en attente de reconnexion,
- quand 30 min s'écoulent, puis qu'un joueur choisit « Quitter la partie »,
- alors l'attente se poursuit toujours au bout de 30 min, puis le joueur revient au salon (à la bibliothèque s'il était l'invité) en moins de 2 s; la partie est inscrite comme interrompue et la dernière sauvegarde est intacte.
- Vérification: EL. Jalon: alpha. Hypothèses: H-11, H-14.

**CA-PF-048. Duo relancé chez l'invité**
- Étant donné une partie en cours,
- quand Duo est tué chez l'invité, puis relancé,
- alors l'hôte attend comme en CA-PF-044; au relancement, l'invité se voit proposer de reprendre la partie en cours moins de 10 s après l'affichage du lanceur, l'accepte d'une touche, et la partie reprend avec l'empreinte d'état du moment de la coupure.
- Vérification: EL. Jalon: alpha. Hypothèse: H-15.

**CA-PF-049. Duo arrêté chez l'hôte**
- Étant donné une partie en cours,
- quand Duo est tué chez l'hôte, puis relancé,
- alors l'invité passe en attente de reconnexion comme en CA-PF-044; moins de 10 s après le relancement chez l'hôte, l'invité affiche M-19 et revient à la bibliothèque; la dernière sauvegarde est intacte sur les deux machines.
- Vérification: EL. Jalon: alpha. Hypothèse: H-15.

**CA-PF-050. Mise en veille d'une machine**
- Étant donné une partie en cours,
- quand une machine se met en veille pendant 1 min (couvercle fermé chez le client; processus suspendu puis repris en EL),
- alors la partie se met en pause comme en CA-PF-044, puis reprend sans action des joueurs moins de 30 s après le réveil.
- Vérification: EL (simulation), M. Jalon: bêta.

### F07 Sauvegardes

**CA-PF-051. Sauvegarde écrite sur les deux machines**
- Étant donné une partie qui atteint un moment de sauvegarde déclaré par le jeu,
- quand le jeu sauvegarde,
- alors la sauvegarde existe sur les deux machines avec le même contenu (empreinte) et le même numéro de version, en moins de 2 s pour 1 Mo et en moins de 10 s pour 20 Mo.
- Vérification: EL, M (avec le jeu témoin, sans mesure de délai). Jalon: alpha. Hypothèse: H-16.

**CA-PF-052. Reprise quelle que soit la machine qui héberge**
- Étant donné une sauvegarde écrite pendant une partie hébergée par A,
- quand B héberge la partie suivante et choisit cette sauvegarde,
- alors B la propose avec la même date et la même progression qu'A, et la partie reprend avec une empreinte d'état identique à celle obtenue en la chargeant chez A.
- Vérification: EL, M. Jalon: alpha.

**CA-PF-053. Écriture sûre en cas d'arrêt brutal**
- Étant donné une machine qui écrit une sauvegarde de 20 Mo,
- quand le processus Duo est tué à un instant aléatoire de l'écriture (100 essais),
- alors après chaque relancement, la sauvegarde se lit sans erreur et vaut exactement l'ancienne ou la nouvelle version (empreinte), et aucun fichier temporaire n'est proposé comme sauvegarde.
- Vérification: E (Linux), CI macOS et Windows (même test: le remplacement d'un fichier ouvert se comporte autrement sous Windows). Jalon: alpha. Hypothèse: H-16.

**CA-PF-054. Version précédente conservée**
- Étant donné une sauvegarde écrite au moins deux fois, dont la version courante est ensuite rendue illisible (fichier tronqué de moitié, ou remplacé par des octets aléatoires),
- quand on ouvre la bibliothèque ou le salon,
- alors Duo ne plante pas, propose la version précédente avec M-20, et garde le fichier illisible à part, sans l'effacer.
- Vérification: E. Jalon: alpha.

**CA-PF-055. Copies divergentes après une coupure**
- Étant donné une sauvegarde en version 5 chez A et en version 4 chez B (copie interrompue par une coupure),
- quand A et B se reconnectent, que l'hôte soit A ou B,
- alors, avant que le salon ne propose les sauvegardes, les deux machines ont la version 5 (même empreinte), la version 4 est gardée en secours chez B, les deux écrans affichent M-21, et la version 4 n'est jamais proposée comme sauvegarde courante.
- Vérification: EL. Jalon: alpha. Hypothèse: H-17.

**CA-PF-056. Copies de même numéro mais différentes**
- Étant donné deux copies de même numéro de version mais de contenus différents (faute injectée),
- quand les machines se connectent,
- alors la copie dont la date d'écriture est la plus récente l'emporte sur les deux machines, l'autre est gardée en secours, et M-21 s'affiche.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-17.

**CA-PF-057. Emplacements et moments déclarés par le jeu**
- Étant donné le jeu d'essai qui déclare 3 emplacements et les moments « fin de niveau », « sortie de partie » et « à la demande »,
- quand chacun de ces moments survient,
- alors seule la sauvegarde de l'emplacement choisi au salon est écrite (empreintes des deux autres inchangées), et rien n'est écrit en dehors des moments déclarés.
- Vérification: U, E. Jalon: alpha.

**CA-PF-058. Écriture impossible sur une machine**
- Étant donné un dossier de sauvegardes non inscriptible sur l'une des machines (droits retirés, ou disque plein simulé),
- quand le jeu sauvegarde,
- alors la partie continue, la machine concernée affiche M-22, l'autre machine a bien la nouvelle version, la version précédente de la machine en échec reste intacte, et sa copie est rattrapée à la connexion suivante une fois le dossier redevenu inscriptible.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-059. Machine réinstallée ou remplacée**
- Étant donné un duo qui a des sauvegardes, un historique et des scores, et une machine B dont le dossier de données a été effacé (nouveau profil),
- quand B se connecte à A,
- alors A et B affichent M-23, et après confirmation sur les deux machines, B reçoit toutes les données du duo (mêmes empreintes que chez A), et le nouveau profil de B prend la place de l'ancien dans l'historique et les scores.
- Vérification: EL. Jalon: alpha. Hypothèse: H-18.

### F08 Historique

**CA-PF-060. Partie terminée enregistrée**
- Étant donné une partie du jeu témoin menée à son terme, avec une pause de 20 s et une coupure de 10 s,
- quand l'écran de résultats s'affiche,
- alors, en moins de 2 s, l'historique des deux machines contient une même nouvelle entrée avec le jeu, la date et l'heure de début (heure locale), la durée de jeu hors pause et hors attente de reconnexion (à 1 s près de la durée mesurée par le test), le résultat et le score de chaque joueur.
- Vérification: EL. Jalon: alpha. Hypothèse: H-19.

**CA-PF-061. Écran de l'historique**
- Étant donné un historique de 3 parties,
- quand on ouvre l'historique,
- alors les 3 parties s'affichent de la plus récente à la plus ancienne, chacune avec les informations de CA-PF-060, de façon identique sur les deux machines.
- Vérification: E. Jalon: alpha.

**CA-PF-062. Parties interrompues**
- Étant donné une partie quittée avant la fin et une partie arrêtée par un plantage,
- quand on ouvre l'historique,
- alors les deux figurent avec le résultat « interrompue » et leur durée jouée, et ne changent pas le score cumulé.
- Vérification: EL. Jalon: alpha. Hypothèse: H-11.

**CA-PF-063. Rattrapage sans doublon**
- Étant donné 10 parties terminées, dont 5 avec une coupure du lien au moment de l'écriture de l'historique,
- quand les machines se sont reconnectées,
- alors les deux historiques contiennent exactement les 10 parties, sans doublon ni manque, dans le même ordre.
- Vérification: EL. Jalon: alpha.

**CA-PF-064. Gros historique**
- Étant donné un historique généré de 2 000 parties,
- quand on ouvre l'historique et qu'on le parcourt au clavier jusqu'à la dernière entrée,
- alors aucune erreur ne survient, chaque entrée est atteignable, et le premier affichage prend moins de 1 s dans l'environnement de test (garde-fou, non représentatif du PC).
- Vérification: E. Jalon: alpha.

**CA-PF-065. Jeux sans fin de partie**
- Étant donné un jeu qui déclare des sessions sans fin de partie (cas du premier jeu envisagé, une simulation de vie),
- quand les joueurs quittent une session,
- alors une entrée de session est inscrite sur les deux machines avec le jeu, la date et l'heure de début, la durée et la progression déclarée par le jeu en fin de session, sans résultat ni effet sur les victoires.
- Vérification: EL. Jalon: alpha. Hypothèse: H-20.

### F09 Score cumulé

**CA-PF-066. Victoires en affrontement**
- Étant donné l'historique de test suivant: jeu d'essai A avec 3 victoires de « Lou », 2 de « Max » et 1 égalité; jeu d'essai B avec 1 victoire de « Max »,
- quand on ouvre l'écran des scores,
- alors il affiche, pour le jeu A, Lou 3, Max 2, égalités 1; pour le jeu B, Lou 0, Max 1, égalités 0; au total, Lou 3, Max 3, égalités 1; valeurs identiques sur les deux machines.
- Vérification: U, E. Jalon: alpha.

**CA-PF-067. Scores cohérents avec l'historique**
- Étant donné 500 historiques générés au hasard, parties interrompues et égalités comprises,
- quand le score cumulé est calculé,
- alors, pour chaque jeu d'affrontement et pour le total, les victoires de chaque joueur égalent le nombre d'entrées de l'historique où il est vainqueur; égalités et parties interrompues ne comptent pour personne.
- Vérification: U. Jalon: alpha. Hypothèse: H-11.

**CA-PF-068. Progression commune en coopération**
- Étant donné un jeu de coopération qui déclare sa progression à chaque sauvegarde (par exemple « Niveau 4 sur 10 »),
- quand on ouvre l'écran des scores,
- alors la progression affichée pour ce jeu est la dernière déclarée, identique sur les deux machines.
- Vérification: E. Jalon: alpha. Hypothèse: H-21.

### F10 Réglages

**CA-PF-069. Quatre volumes**
- Étant donné le jeu témoin qui joue en même temps une musique, un effet et un son d'interface,
- quand on règle chaque volume (général, musique, effets, interface) de 0 à 100 % par pas de 5 %,
- alors le gain effectif de chaque catégorie vaut le volume général multiplié par celui de la catégorie, à 1 % près (lu par le crochet de test), le changement s'applique en moins de 100 ms pendant la lecture, 0 % donne un gain nul, et chaque réglage ne touche que sa catégorie.
- Vérification: E, M (à l'écoute, sur les deux machines). Jalon: alpha. Hypothèse: H-22.

**CA-PF-070. Réglages conservés et propres à chaque machine**
- Étant donné des réglages modifiés sur A (volumes, affichage, taille de l'interface, touches),
- quand on redémarre Duo sur A, puis qu'A et B jouent ensemble,
- alors A retrouve exactement ses réglages, et ceux de B ne changent pas.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-071. Plein écran ou fenêtre**
- Étant donné le lanceur en fenêtre,
- quand on choisit le plein écran dans les réglages, ou avec F11 sous Windows et Ctrl+Cmd+F sous macOS,
- alors la fenêtre passe en plein écran en moins de 1 s, le retour en fenêtre fonctionne de la même façon, et le mode choisi est rétabli au démarrage suivant.
- Vérification: E, M. Jalon: alpha. Hypothèse: H-23.

**CA-PF-072. Taille de l'interface**
- Étant donné les tailles d'interface 100 %, 125 % et 150 %,
- quand on choisit chacune,
- alors la taille calculée du texte courant du lanceur est multipliée par ce facteur, à 1 px près, sans redémarrage; à 150 % dans la plus petite zone d'affichage (1280x640), aucun contenu n'est coupé ni ne demande de défilement horizontal (le défilement vertical est admis), et toutes les actions restent atteignables au clavier.
- Vérification: E. Jalon: alpha. Hypothèses: H-24, H-31.

**CA-PF-073. Touches affichées selon le clavier réel**
- Étant donné un jeu qui autorise la reconfiguration des touches,
- quand on ouvre ses touches dans les réglages,
- alors chaque action est listée avec sa touche, affichée selon la disposition réelle: l'action liée à la touche physique `KeyW` s'affiche « Z » sur un clavier AZERTY et « W » sur un clavier QWERTY.
- Vérification: E (disposition simulée), M (AZERTY réel du Mac et du PC). Jalon: alpha.

**CA-PF-074. Changer une touche**
- Étant donné la liste des touches d'un jeu,
- quand on choisit une action et qu'on presse une nouvelle touche,
- alors l'action prend cette touche, enregistrée par sa position physique (`KeyboardEvent.code`), et le jeu l'utilise dès la reprise ou la partie suivante; Échap annule la saisie sans rien changer et ne peut pas être attribuée; une touche déjà prise par une autre action du même jeu est refusée avec M-24; « Rétablir les touches par défaut » remet celles du manifeste.
- Vérification: U, E. Jalon: alpha. Hypothèse: H-25.

**CA-PF-075. Réglages illisibles**
- Étant donné un fichier de réglages tronqué, invalide, ou avec des valeurs hors limites,
- quand Duo démarre,
- alors Duo démarre jusqu'à la bibliothèque sans plantage ni message bloquant, chaque réglage invalide reprend sa valeur par défaut, les réglages valides sont conservés, et le profil, les sauvegardes et l'historique ne sont pas modifiés (empreintes).
- Vérification: U, E. Jalon: alpha.

### F11 Installation

**CA-PF-076. Installation sur le Mac**
- Étant donné le fichier d'installation pour macOS publié et le guide d'installation,
- quand on suit le guide sur le Mac du client,
- alors Duo s'installe dans Applications et s'ouvre après l'alerte de sécurité de macOS, franchie exactement comme le guide l'indique; dans le Moniteur d'activité, Duo apparaît comme processus « Apple » et non « Intel ».
- Vérification: M; CI macOS pour la fabrication et l'architecture arm64 de l'exécutable. Jalon: bêta.

**CA-PF-077. Installation sur le PC sans droits d'administrateur**
- Étant donné l'installateur Windows publié et le guide,
- quand on l'exécute sur le PC du client depuis un compte standard,
- alors aucune demande d'autorisation d'administrateur (Contrôle de compte d'utilisateur) n'apparaît, l'alerte SmartScreen est franchie comme le guide l'indique, et Duo apparaît dans le menu Démarrer et s'ouvre.
- Vérification: M; CI Windows (installation silencieuse, fichiers en place, lancement). Jalon: bêta.

**CA-PF-078. Guide d'installation**
- Étant donné le guide publié avec la version et lié depuis la page de téléchargement,
- quand on le relit,
- alors il donne, pour macOS et pour Windows: l'adresse de téléchargement; chaque alerte de sécurité avec le libellé exact des boutons à utiliser; la demande d'autorisation réseau et la réponse à donner; que faire après un refus; comment installer une nouvelle version; comment désinstaller. Il est en français, tutoie le lecteur et n'exige aucune ligne de commande.
- Vérification: D, M (les libellés du guide sont ceux qui apparaissent sur les machines du client). Jalon: bêta.

**CA-PF-079. Autorisation réseau expliquée avant la demande du système**
- Étant donné un premier lancement, profil créé,
- quand Duo s'apprête à utiliser le réseau pour la première fois,
- alors un écran de Duo explique la demande du système qui va suivre et la réponse à donner, et Duo n'ouvre aucune socket réseau avant que cet écran ait été validé (relevé des appels système `bind`, `listen`, `connect` et `sendto`).
- Vérification: E (`strace`), M (ordre des fenêtres sur les deux machines). Jalon: bêta.

**CA-PF-080. Premier lancement jusqu'à voir l'autre machine**
- Étant donné deux machines où Duo vient d'être installé pour la première fois,
- quand chaque joueur suit seulement les écrans de Duo (profil, autorisations),
- alors chacun voit l'autre machine (invitation reçue, ou invité arrivé dans son salon) en moins de 5 min par machine, sans aide extérieure.
- Vérification: M. Jalon: bêta. Hypothèse: H-26.

**CA-PF-081. Nouvelle version installée par-dessus**
- Étant donné Duo en version N avec un profil, des réglages, des sauvegardes, un historique et des jeux ajoutés,
- quand on installe la version N+1 par-dessus, selon le guide,
- alors tout est conservé à l'identique (empreintes des sauvegardes, nombre d'entrées de l'historique, réglages, jeux installés), et toute migration du format des données se fait sans perte.
- Vérification: E (version N+1 lancée sur les données de la version N), CI, M (bêta remplacée par la 1.0). Jalon: bêta.

**CA-PF-082. Désinstallation**
- Étant donné Duo installé avec des données du duo,
- quand on le désinstalle (Windows: Paramètres, puis Applications; macOS: application mise à la corbeille),
- alors l'application est retirée, les données du duo restent dans le dossier de données, et une réinstallation les retrouve.
- Vérification: CI Windows, M. Jalon: bêta. Hypothèse: H-27.

**CA-PF-083. Une seule instance**
- Étant donné Duo ouvert,
- quand on le lance une seconde fois,
- alors aucune seconde instance ne reste ouverte, et la fenêtre existante passe au premier plan en moins de 2 s.
- Vérification: E, M. Jalon: alpha.

### F12 Nouveaux jeux

**CA-PF-084. Ajout d'un jeu sans réinstaller Duo**
- Étant donné Duo en version N relié à Internet, et un nouveau jeu publié dans le catalogue,
- quand on ouvre la bibliothèque et qu'on choisit d'installer ce jeu,
- alors le jeu est téléchargé, vérifié (empreinte SHA-256 publiée par le catalogue), puis apparaît dans la bibliothèque et se lance, sans réinstaller ni redémarrer Duo; la version de Duo reste N.
- Vérification: E (catalogue et paquets servis localement), M (jeu réellement publié). Jalon: alpha. Hypothèse: H-28.

**CA-PF-085. Mise à jour d'un jeu sans perdre ses sauvegardes**
- Étant donné un jeu installé en 1.0.0 avec deux sauvegardes du duo, et sa version 1.1.0 publiée,
- quand on lance la mise à jour,
- alors le jeu passe en 1.1.0 sans réinstaller Duo, ses deux sauvegardes restent listées et se chargent (après la migration éventuelle fournie par le jeu), et leurs versions d'avant la mise à jour sont gardées en secours.
- Vérification: E. Jalon: alpha.

**CA-PF-086. Paquet corrompu**
- Étant donné un paquet de jeu dont l'empreinte ne correspond pas à celle du catalogue,
- quand on l'installe,
- alors l'installation est refusée avec M-25, aucun fichier du paquet n'est utilisé, et la version précédente du jeu, s'il y en avait une, reste installée et jouable.
- Vérification: E. Jalon: alpha.

**CA-PF-087. Téléchargement interrompu**
- Étant donné un téléchargement de jeu en cours,
- quand la connexion est coupée à 50 %, ou que Duo est fermé,
- alors aucun jeu partiel n'apparaît dans la bibliothèque, la version précédente reste jouable, M-25 propose de réessayer, et une nouvelle tentative aboutit.
- Vérification: E. Jalon: alpha.

**CA-PF-088. Sans Internet, aucune gêne**
- Étant donné une machine reliée au réseau local mais sans accès à Internet,
- quand Duo démarre et qu'on ouvre la bibliothèque,
- alors aucune fenêtre ni aucun message bloquant n'apparaît, le lanceur s'affiche au plus 1 s plus tard qu'avec Internet, et seule la mention M-26 signale que la recherche de nouveaux jeux n'a pas pu se faire.
- Vérification: EL. Jalon: alpha. Hypothèse: H-28.

**CA-PF-089. Aucune installation pendant une partie**
- Étant donné un salon ouvert ou une partie en cours avec le jeu X, et une mise à jour de X disponible,
- quand la recherche de nouveaux jeux la trouve,
- alors rien n'est installé avant le retour à la bibliothèque, et la partie n'est pas interrompue.
- Vérification: E. Jalon: alpha.

### F13 Compatibilité

**CA-PF-090. Versions de Duo différentes**
- Étant donné A en version 1.0.0 et B en version 1.0.1 (versions simulées par le crochet de test),
- quand B voit l'invitation d'A, puis tente de la rejoindre ou de se connecter par adresse IP,
- alors l'invitation reste visible chez B, avec la mention d'une version différente; la tentative échoue en moins de 3 s sans entrer dans le salon; les deux machines affichent M-27, qui désigne la machine de version la plus ancienne comme celle à mettre à jour.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-29.

**CA-PF-091. Version d'un jeu différente**
- Étant donné le jeu X en 1.1.0 chez A et en 1.0.0 chez B,
- quand A choisit X pour son salon et que B le rejoint,
- alors les deux machines affichent M-28, B ne peut pas se déclarer prêt, et dès que X est en 1.1.0 chez B, le salon se débloque sans redémarrer Duo ni recréer le salon.
- Vérification: EL. Jalon: alpha. Hypothèse: H-29.

**CA-PF-092. Jeu absent chez l'un des deux**
- Étant donné le jeu X installé chez A seulement,
- quand A choisit X pour son salon et que B le rejoint,
- alors les deux machines affichent M-28, B ne peut pas se déclarer prêt, et l'installation de X chez B (comme en CA-PF-084) débloque le salon sans redémarrer.
- Vérification: EL. Jalon: alpha.

**CA-PF-093. Données d'une version plus récente de Duo**
- Étant donné un dossier de données écrit par une version plus récente de Duo, dans un format plus récent,
- quand une version plus ancienne démarre dessus,
- alors elle ne modifie aucune donnée (empreintes inchangées) et affiche M-29.
- Vérification: E. Jalon: alpha.

## 5. Critères transverses

### Zéro friction (pilier 1)

**CA-PF-094. Une partie en moins d'une minute**
- Étant donné les deux machines allumées et sur le même réseau depuis plus de 2 min, Duo fermé des deux côtés, profils déjà créés, jeu témoin installé,
- quand les deux joueurs ouvrent Duo, que l'un héberge le jeu témoin, que l'autre rejoint, et que les deux se déclarent prêts,
- alors la partie démarre moins de 60 s après le premier double-clic d'ouverture, sans aucun réglage réseau ni saisie d'adresse: 3 essais sur 3, avec pour hôte le Mac, puis le PC, puis le Mac.
- Vérification: M (chronomètre); EL (même parcours automatisé en moins de 20 s, garde-fou de non-régression). Jalon: 1.0, avec une mesure pour information dès le prototype.

### Performances

**CA-PF-095. 60 images par seconde dans le lanceur**
- Étant donné le PC du client (machine de référence), Duo en plein écran à la définition native de l'écran et à la mise à l'échelle de Windows en usage, l'affichage des performances activé,
- quand on enchaîne, pendant 60 s chacun, trois scénarios: parcours de toute la bibliothèque au clavier; salon ouvert avec changements d'état et invitations; réglages avec changements de volume,
- alors chaque scénario donne une moyenne d'au moins 58 images par seconde, et au moins 99 % des intervalles entre deux images durent 20 ms ou moins.
- Vérification: M (l'environnement cloud dessine par logiciel, ses mesures ne valent pas). Jalon: bêta, avec une mesure pour information dès le prototype. Hypothèse: H-30.

**CA-PF-096. 60 images par seconde dans le jeu témoin**
- Étant donné les conditions de CA-PF-095,
- quand on joue 2 min au jeu témoin avec le PC comme hôte, puis 2 min avec le PC comme invité,
- alors les seuils de CA-PF-095 sont tenus sur le PC.
- Vérification: M. Jalon: bêta. Hypothèse: H-30.

### Sans Internet

**CA-PF-097. Tout fonctionne sans Internet**
- Étant donné les deux machines sur un réseau local sans accès à Internet,
- quand on enchaîne le parcours complet: démarrage, découverte, salon, partie du jeu témoin avec sauvegarde, pause, fin, historique, scores, réglages,
- alors chaque étape réussit, et Internet n'est mentionné que par M-26.
- Vérification: EL (réseau virtuel sans route vers Internet), M (box débranchée d'Internet, Wi-Fi gardé). Jalon: prototype en EL, 1.0 chez le client.

**CA-PF-098. Aucune sortie hors du réseau local**
- Étant donné le parcours de CA-PF-097 dans le réseau local virtuel, avec une route par défaut vers une passerelle piège qui compte et jette tout paquet destiné à une adresse hors du réseau local, et sans aucune variable de mandataire HTTP,
- quand le parcours se déroule une fois avec la recherche de nouveaux jeux désactivée par le crochet de test, puis une fois avec la recherche active,
- alors la passerelle piège compte 0 paquet sur tout le premier parcours, et 0 paquet entre l'ouverture du salon et le retour à la bibliothèque dans le second; de plus, l'application construite ne contient aucune adresse http ou https vers un hôte extérieur autre que celle du catalogue des jeux.
- Vérification: EL (faisabilité vérifiée: une police chargée par erreur depuis un CDN produit 68 paquets comptés), U (analyse de l'application construite). Jalon: alpha.

### Clavier AZERTY

**CA-PF-099. Touches par position, libellés selon le clavier**
- Étant donné le jeu témoin, dont les actions par défaut sont déclarées par position physique (`KeyW`, `KeyA`, `KeyS`, `KeyD` pour se déplacer),
- quand on joue avec un clavier AZERTY, puis avec une disposition QWERTY simulée,
- alors les mêmes touches physiques commandent les mêmes actions, et toutes les touches citées à l'écran (réglages, aides du jeu, menus) sont celles gravées sur le clavier utilisé: « Z », « Q », « S », « D » en AZERTY.
- Vérification: E (événements injectés avec leur code et leur caractère AZERTY, la disposition du système ne pouvant pas être changée dans l'environnement cloud), M. Jalon: alpha.

**CA-PF-100. Accents et touches mortes dans les champs**
- Étant donné le champ du pseudo,
- quand on tape au clavier AZERTY « Gaëlle » (tréma par la touche morte), puis « Jérôme » (accent circonflexe par la touche morte), sur le Mac et sur le PC,
- alors le champ contient exactement « Gaëlle », puis « Jérôme », et aucune lettre tapée dans un champ ne déclenche de raccourci du lanceur.
- Vérification: M; E pour la partie sans touche morte. Jalon: alpha.

### Chemins et noms d'utilisateur

**CA-PF-101. Chemins avec espaces, accents, apostrophe et émoji**
- Étant donné un dossier de données au chemin de test (section 1.4), puis le même chemin en Unicode décomposé (NFD),
- quand on enchaîne création du profil, partie avec sauvegarde, historique, réglages et ajout d'un jeu,
- alors chaque écriture et chaque relecture réussit, les données relues sont identiques, et rien n'est écrit hors de ce dossier, à part le dossier temporaire du système.
- Vérification: E (faisabilité vérifiée avec deux instances Electron), CI Windows et macOS. Jalon: alpha.

**CA-PF-102. Compte Windows au nom accentué**
- Étant donné un compte Windows dont le dossier utilisateur contient un espace et un accent (par exemple `C:\Users\Hélène D`),
- quand on y installe Duo, qu'on le lance, qu'on joue une partie et qu'on sauvegarde,
- alors chaque étape réussit.
- Vérification: CI Windows (compte créé par script), M si le compte du PC a un tel nom. Jalon: bêta.

### Plantage d'un jeu

**CA-PF-103. Dix plantages de suite**
- Étant donné Duo ouvert,
- quand on enchaîne 10 fois: lancer le jeu d'essai, le faire planter selon un mode tiré au hasard parmi ceux de CA-PF-039, revenir au salon,
- alors Duo reste ouvert, chaque retour au salon respecte le délai de CA-PF-039, une onzième partie, avec le jeu témoin, va jusqu'à son écran de résultats sans aucun message d'erreur, et la mémoire de Duo après le dixième cycle dépasse de moins de 20 Mo celle mesurée après le deuxième.
- Vérification: E. Jalon: alpha.

**CA-PF-104. Dix lancements et sorties sans fuite**
- Étant donné Duo ouvert,
- quand on enchaîne 10 fois: lancer le jeu témoin, jouer 30 s, le quitter par « Quitter la partie »,
- alors la mémoire de Duo après le dixième cycle dépasse de moins de 20 Mo celle mesurée après le deuxième, et les compteurs de CA-PF-043 reviennent à zéro après chaque sortie.
- Vérification: E. Jalon: alpha.

### Coupure du réseau pendant une sauvegarde

**CA-PF-105. Coupure pendant la copie d'une sauvegarde**
- Étant donné une partie hébergée par A, la copie des sauvegardes vers B étant retardée de 2 s par le crochet de test,
- quand le lien est coupé pendant ce délai, après l'écriture chez A et avant la fin de la copie chez B,
- alors chez A la nouvelle version est complète; chez B la version précédente est intacte, et aucun fichier partiel n'est pris pour une sauvegarde; les deux machines passent en pause comme en CA-PF-044; après reconnexion, la copie de B est à jour en moins de 5 s, et M-21 l'indique.
- Vérification: EL. Jalon: alpha.

**CA-PF-106. Arrêt brutal pendant l'écriture de la copie**
- Étant donné B en train d'écrire la copie d'une sauvegarde de 20 Mo,
- quand Duo est tué chez B à un instant aléatoire de cette écriture (50 essais),
- alors la copie de B est à chaque fois l'ancienne ou la nouvelle version complète (empreinte), et la connexion suivante remet les deux machines d'accord comme en CA-PF-055.
- Vérification: EL. Jalon: alpha. Hypothèse: H-16.

### Versions incompatibles

Les cas de base sont décrits en F13 (CA-PF-090 à CA-PF-093); ce critère couvre toutes les combinaisons.

**CA-PF-107. Toutes les combinaisons de versions**
- Étant donné les combinaisons suivantes: application identique, ou différente au premier, au deuxième ou au troisième numéro; jeu identique, différent ou absent; jeu exigeant un SDK plus récent,
- quand les deux machines tentent de jouer ensemble,
- alors seule la combinaison « application identique et jeu identique » permet de jouer; chaque autre combinaison affiche sur les deux machines le message prévu (M-13, M-27 ou M-28), sans plantage ni salon bloqué; aucune sauvegarde n'est copiée entre deux versions différentes d'un jeu.
- Vérification: U (toutes les combinaisons), EL (au moins une combinaison par message). Jalon: alpha. Hypothèse: H-29.

### Accessibilité

**CA-PF-108. Contrastes**
- Étant donné chaque écran du lanceur et chaque surcouche de la plateforme (pause, résultats, notifications, messages), dans chacun de ses états (repos, survol, focus, erreur), aux tailles d'interface 100 % et 150 %,
- quand on mesure les contrastes,
- alors tout texte atteint au moins 4,5:1 sur son fond (3:1 pour un texte d'au moins 24 px, ou d'au moins 18,66 px en gras), et les composants d'interface et graphismes porteurs d'information au moins 3:1 contre les couleurs adjacentes (WCAG 2.2, critères 1.4.3 et 1.4.11, éléments désactivés exemptés).
- Vérification: E (axe-core, outil de test sous licence MPL-2.0, non livré, plus un script qui mesure les états de survol et de focus). Jalon: bêta.

**CA-PF-109. Couleurs des joueurs distinctes pour les daltoniens**
- Étant donné la palette des couleurs de joueurs,
- quand on calcule, pour chaque paire de couleurs, l'écart CIEDE2000 en vision normale, puis après simulation de la protanopie, de la deutéranopie et de la tritanopie (méthode de Machado, Oliveira et Fernandes, 2009, sévérité 1,0, en RVB linéaire),
- alors l'écart est d'au moins 20 en vision normale et d'au moins 10 après chaque simulation. Ces seuils sont atteignables: la palette de référence d'Okabe et Ito obtient au pire 21,7 et 10,9 (calcul du 2026-10-30).
- Vérification: U (calcul sur les jetons de couleur). Jalon: bêta. Hypothèse: H-02.

**CA-PF-110. Jamais la couleur seule**
- Étant donné chaque écran où apparaissent des joueurs ou des états (salon, invitation, résultats, historique, scores, pause, déconnexion),
- quand on l'affiche,
- alors chaque marque de couleur d'un joueur est accompagnée de son pseudo écrit, et chaque état (prêt, pas prêt, connecté, déconnecté, erreur) est dit par un texte, ou par une icône munie d'un nom accessible, en plus de la couleur (WCAG 1.4.1).
- Vérification: E (contrôle automatique de la page affichée, et captures converties en niveaux de gris examinées). Jalon: alpha.

**CA-PF-111. Tout au clavier seul**
- Étant donné un test qui n'émet aucun événement de souris,
- quand on enchaîne au clavier le parcours complet: premier lancement, profil, héberger, rejoindre par invitation et par adresse IP, se déclarer prêt, jouer, mettre en pause, reprendre, quitter, finir une partie, historique, scores, réglages (volumes, touches, affichage), ajout d'un jeu, chaque message d'erreur avec son bouton,
- alors chaque étape se réalise avec Tab, Maj+Tab, les flèches, Entrée, Espace et Échap; aucun piège de focus (WCAG 2.1.2); Échap ramène à l'écran précédent ou ferme la fenêtre ouverte, sans jamais quitter Duo; à l'ouverture d'un écran, le focus est sur son premier élément utile; l'ordre de tabulation suit celui de la spécification UX de l'écran.
- Vérification: E (script Playwright sans souris), M (sur les deux machines). Jalon: alpha.

**CA-PF-112. Focus toujours visible**
- Étant donné chaque élément qui peut recevoir le focus,
- quand il le reçoit au clavier,
- alors un indicateur de focus apparaît, d'au moins 2 px CSS d'épaisseur à la taille d'interface 100 %, avec un contraste d'au moins 3:1 entre les pixels de la zone avec et sans focus, sans jamais être caché par un autre élément (WCAG 2.4.7 et 2.4.11), y compris dans les listes qui défilent.
- Vérification: E (comparaison automatique de captures avec et sans focus). Jalon: alpha pour la présence, bêta pour l'épaisseur et le contraste.

### Affichage

**CA-PF-113. Lisible de 1366x768 à l'écran Retina**
- Étant donné chaque zone d'affichage de référence (section 1.4), en fenêtre et en plein écran, à la taille d'interface 100 %, avec les textes les plus longs (pseudo de seize « W », description de la longueur maximale admise par le manifeste, messages),
- quand on affiche chaque écran du lanceur et chaque surcouche,
- alors aucun texte n'est coupé ni ne déborde de son élément (contrôle automatique: largeur de défilement au plus égale à la largeur visible), aucun élément n'en recouvre un autre, aucune barre de défilement horizontale n'apparaît, et toute action est visible ou atteignable par défilement vertical.
- Vérification: E (contrôle automatique, captures examinées), M (écrans réels). Jalon: alpha. Hypothèse: H-31.

**CA-PF-114. Images nettes sur écran Retina**
- Étant donné le facteur d'échelle 2,
- quand on affiche chaque écran du lanceur,
- alors chaque image matricielle affichée (vignettes, icônes) a une définition au moins double de sa taille affichée en pixels CSS, dans chaque dimension, ou bien elle est vectorielle.
- Vérification: E. Jalon: bêta.

### Langue

**CA-PF-115. Français, tutoiement et typographie**
- Étant donné tous les textes visibles de la plateforme: écrans, messages, info-bulles, menus de l'application, boîtes de dialogue ouvertes par Duo,
- quand on les relève (catalogue des textes, puis textes affichés sur chaque écran du parcours complet),
- alors ils sont tous en français; le joueur est tutoyé (décision Q2), et chaque occurrence de « vous » figure dans la liste, tenue avec le catalogue des textes, des phrases adressées aux deux joueurs ensemble; une espace insécable (U+00A0 ou U+202F) précède « : », « ; », « ! » et « ? »; les guillemets sont « »; aucun tiret cadratin ni demi-cadratin; aucun texte anglais ne subsiste, y compris dans le menu de l'application sous macOS et dans les menus par défaut d'Electron, supprimés ou traduits.
- Vérification: U (contrôle du catalogue des textes), E (textes affichés), M (menus du système sur les deux machines). Jalon: alpha.

### Réseau dégradé et endurance

**CA-PF-116. Réseau dégradé de référence**
- Étant donné le profil réseau R1 entre les deux machines,
- quand deux robots jouent au jeu témoin pendant 10 min,
- alors aucune pause de déconnexion ne se déclenche, l'état reste synchronisé (empreintes identiques à chaque contrôle, au moins un par seconde), et pause, reprise et sauvegarde fonctionnent.
- Vérification: EL (pertes réelles par nftables, latence et gigue par le mandataire de perturbation). Jalon: alpha.

**CA-PF-117. Endurance de deux heures**
- Étant donné deux robots qui enchaînent des parties du jeu témoin pendant 2 h, avec une coupure de 10 s toutes les 15 min,
- quand l'essai se termine,
- alors aucun plantage ni aucune désynchronisation n'est survenu, chaque partie figure une fois dans l'historique des deux machines, et la mémoire de chaque Duo dépasse de moins de 50 Mo celle mesurée après la première partie.
- Vérification: EL. Jalon: bêta.

## 6. Prérequis de testabilité

À prévoir dans l'architecture dès le prototype, faute de quoi les critères ci-dessus ne peuvent pas être vérifiés automatiquement.

1. **Deux instances sur une machine**: dossier de données imposé au lancement (option de ligne de commande), ports réseau configurables, verrou d'instance unique pris après le choix du dossier de données, pour que deux instances de test coexistent.
2. **Identifiants de test**: un attribut stable sur chaque élément interactif, et l'identifiant M-xx sur chaque message.
3. **Mode test**, absent ou inactif dans les versions publiées: empreinte de l'état du jeu; retard ou blocage de la copie des sauvegardes; versions simulées de l'application et des jeux; adresse du catalogue des jeux; désactivation de la recherche de nouveaux jeux; compteurs de ressources (contextes WebGL et audio, minuteurs, écouteurs); gains audio effectifs par catégorie; ramasse-miettes forcé; robots qui jouent au jeu témoin.
4. **Jeux d'essai**, réservés aux tests: un affrontement et une coopération minimaux; un jeu à 3 emplacements et aux trois moments de sauvegarde; un jeu à sauvegarde de 20 Mo; un jeu à sessions sans fin de partie; un jeu qui plante sur commande selon les quatre modes de CA-PF-039 ou échoue à son chargement; un paquet au manifeste invalide; un jeu qui exige un SDK plus récent.
5. **Journal local** horodaté des événements de session (salon, prêt, démarrage, pause, coupure, reprise, sauvegarde, copie) et des erreurs, sur chaque machine, que le client ouvre depuis les réglages pour le joindre à ses retours de recette.
6. **Affichage des performances**, activable sans ligne de commande, qui donne la moyenne d'images par seconde, la part des intervalles à 20 ms ou moins sur les 60 dernières secondes, et la mémoire de Duo.
7. **Banc réseau virtuel**, outillé par qa-testeur avec dev-reseau: espaces de noms reliés par un pont, passerelle piège, pertes par nftables, latence par mandataire. Chaque pilote Playwright doit tourner dans l'espace de noms de son instance, car Playwright joint Electron par la boucle locale; les tests retirent les variables de mandataire HTTP de l'environnement cloud, que Chromium suivrait sinon (constaté).

## 7. Traçabilité

### 7.1 Fonctions du cahier vers les critères

| Fonction | Critères | Modes | Premier jalon | Hypothèses |
|---|---|---|---|---|
| F01 Profil | CA-PF-001 à CA-PF-006 | U, E, EL | alpha | H-01, H-02, H-03 |
| F02 Découverte et connexion | CA-PF-007 à CA-PF-021 | U, EL, CI, M | prototype (007, 008, 010) | H-04 à H-07 |
| F03 Salon | CA-PF-022 à CA-PF-028 | U, EL, M | prototype (022, 023, 024) | H-08 |
| F04 Bibliothèque | CA-PF-029 à CA-PF-032 | U, E, EL | alpha | H-20, H-21 |
| F05 Cycle de vie d'un jeu | CA-PF-033 à CA-PF-043 | E, EL, M | prototype (033, 037) | H-09 à H-13 |
| F06 Déconnexion | CA-PF-044 à CA-PF-050 | EL, M | alpha | H-09, H-14, H-15 |
| F07 Sauvegardes | CA-PF-051 à CA-PF-059 | U, E, EL, CI, M | alpha | H-16, H-17, H-18 |
| F08 Historique | CA-PF-060 à CA-PF-065 | E, EL | alpha | H-11, H-19, H-20 |
| F09 Score cumulé | CA-PF-066 à CA-PF-068 | U, E | alpha | H-11, H-21 |
| F10 Réglages | CA-PF-069 à CA-PF-075 | U, E, EL, M | alpha | H-22 à H-25 |
| F11 Installation | CA-PF-076 à CA-PF-083 | E, CI, D, M | alpha (083), bêta | H-26, H-27 |
| F12 Nouveaux jeux | CA-PF-084 à CA-PF-089 | E, EL, M | alpha | H-28 |
| F13 Compatibilité | CA-PF-090 à CA-PF-093, CA-PF-107 | U, E, EL | alpha | H-29 |

### 7.2 Exigences transverses vers les critères

| Exigence | Source dans le cahier | Critères |
|---|---|---|
| Une partie en moins d'une minute | pilier 1 | CA-PF-094 |
| 60 images par seconde sur la machine de référence | section 6 | CA-PF-095, CA-PF-096 |
| Sans Internet | section 6, F12 | CA-PF-097, CA-PF-098, CA-PF-088 |
| Clavier AZERTY | section 1 | CA-PF-099, CA-PF-100, CA-PF-073, CA-PF-010 |
| Noms d'utilisateur et chemins avec espaces et accents | règles techniques du studio | CA-PF-101, CA-PF-102 |
| Reprise après le plantage d'un jeu | F05 | CA-PF-039, CA-PF-103, CA-PF-104 |
| Coupure du réseau pendant une sauvegarde | section 4 | CA-PF-105, CA-PF-106, CA-PF-055 |
| Versions incompatibles | F13 | CA-PF-107, CA-PF-090 à CA-PF-093 |
| Contraste | section 5 | CA-PF-108, CA-PF-112 |
| Daltonisme | section 5 | CA-PF-109, CA-PF-110 |
| Navigation au clavier seul | section 5 | CA-PF-111, CA-PF-112 |
| Lisible de 1366x768 à Retina | section 5 | CA-PF-113, CA-PF-114, CA-PF-072 |
| Interface en français | section 5, Q2 | CA-PF-115 |
| Aucune perte en cas de plantage ou de coupure | section 4 | CA-PF-053, CA-PF-054, CA-PF-058, CA-PF-105, CA-PF-106 |
| Réseau dégradé, endurance | qualité du jeu en réseau | CA-PF-116, CA-PF-117 |

### 7.3 Parcours du cahier vers les critères

| Parcours (section 2 du cahier) | Critères |
|---|---|
| 1. Premier lancement | CA-PF-001, CA-PF-002, CA-PF-003, CA-PF-079, CA-PF-080 |
| 2. Lancer une partie | CA-PF-007, CA-PF-008, CA-PF-022 à CA-PF-026, CA-PF-033, CA-PF-094 |
| 3. Jouer | CA-PF-035, CA-PF-036, CA-PF-040, CA-PF-041, CA-PF-044 à CA-PF-050 |
| 4. Finir | CA-PF-037, CA-PF-060, CA-PF-066 |
| 5. Consulter | CA-PF-061, CA-PF-066, CA-PF-067, CA-PF-068 |
| 6. Régler | CA-PF-004, CA-PF-069 à CA-PF-075 |
| 7. Recevoir un nouveau jeu | CA-PF-084 à CA-PF-089 |

### 7.4 Couverture par mode

| Mode | Nombre de critères qui l'emploient |
|---|---|
| Automatique dans le cloud (U, E ou EL) | 105 |
| CI macOS ou Windows | 8 (CA-PF-013, 053, 076, 077, 081, 082, 101, 102) |
| Relecture de document (D) | 1 (CA-PF-078) |
| Chez le client (M) | 45 |
| Sans aucun mode automatique dans le cloud | 12: chez le client seulement, CA-PF-014, 015, 016, 080, 095, 096; chez le client et en CI, CA-PF-013, 076, 077, 082, 102; chez le client et par relecture, CA-PF-078 |

Premier jalon d'exigence: 9 critères au prototype, 88 à l'alpha, 19 à la bêta, 1 à la 1.0; tous doivent être satisfaits à la 1.0.

## 8. À tester chez le client (jalon 1.0)

À faire à deux, chacun sur son ordinateur, à la maison. Compter une heure environ. Pour chaque point, noter « OK » ou ce qui s'est passé; une photo de l'écran aide beaucoup. À la fin, envoyer aussi les journaux de Duo (bouton dans les réglages).

- [ ] 1. **Installer** Duo 1.0 sur le Mac et sur le PC en suivant le guide, par-dessus la version bêta si elle est là. Attendu: Duo s'ouvre après l'alerte de sécurité, sans mot de passe administrateur sur le PC; profils, sauvegardes, historique et scores de la bêta sont toujours là.
- [ ] 2. **Premier lancement**, seulement sur un ordinateur où Duo n'avait jamais été installé: créer son profil, accepter l'autorisation réseau. Attendu: chacun voit l'autre ordinateur en moins de 5 minutes, sans aide.
- [ ] 3. **Lancer une partie** du jeu témoin, Duo fermé au départ, chronomètre en main. Trois fois: le Mac héberge, puis le PC, puis le Mac. Attendu: la partie commence en moins d'une minute, sans taper d'adresse.
- [ ] 4. **Couper le Wi-Fi** d'un ordinateur 30 secondes pendant une partie, puis le remettre. Recommencer en fermant le couvercle (ou en mettant l'ordinateur en veille) 1 minute. Attendu: pause des deux côtés, puis la partie reprend toute seule là où elle en était.
- [ ] 5. **Sauvegarde croisée**: jouer jusqu'à une sauvegarde quand le Mac héberge, quitter, puis reprendre cette sauvegarde quand le PC héberge. Attendu: on repart exactement au même endroit.
- [ ] 6. **Son**: pendant une partie, baisser puis remonter chacun des quatre volumes, sur chaque ordinateur, avec les haut-parleurs puis avec un casque si possible. Attendu: chaque réglage change seulement son type de son; à 0, on ne l'entend plus.
- [ ] 7. **Clavier**: regarder les touches du jeu témoin dans les réglages, puis jouer. Taper aussi « Gaëlle » et « Jérôme » comme pseudo. Attendu: les touches affichées sont celles du clavier (Z, Q, S, D), elles marchent, et les accents s'écrivent normalement.
- [ ] 8. **Écran**: passer en plein écran puis en fenêtre, sur chaque ordinateur. Attendu: tout est lisible, rien n'est coupé ni flou.
- [ ] 9. **Fluidité sur le PC**: afficher le compteur d'images (raccourci donné dans le guide), parcourir la bibliothèque 1 minute, puis jouer 2 minutes. Photographier le compteur après chaque minute. Attendu: au moins 58 images par seconde; le reste se lit sur les photos.
- [ ] 10. **Sans Internet**: débrancher le câble qui relie la box à la prise du mur (la box reste allumée), puis jouer une partie. Attendu: tout marche comme d'habitude. Si ce câble est délicat à manipuler (fibre), passer ce point: il est vérifié chez nous.
- [ ] 11. **Nouveau jeu**: installer depuis la bibliothèque le jeu d'essai publié pour la recette, sur les deux ordinateurs. Attendu: il apparaît et se lance sans réinstaller Duo.
- [ ] 12. **Facultatif, 10 minutes**: sur le PC, passer le Wi-Fi en réseau « Public » (Paramètres, Réseau et Internet, Wi-Fi, propriétés du réseau), puis ouvrir Duo pour héberger. Attendu: Duo explique comment repasser en « Privé », et après l'avoir fait, « Réessayer » retrouve le Mac.

## 9. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première version, d'après le cahier des charges v0.1 (décisions Q2 et Q3 incluses) | qa-testeur |
