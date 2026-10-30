# Critères d'acceptation: plateforme Duo, version 1

| Champ | Valeur |
|---|---|
| Références | `docs/plateforme/cahier-des-charges.md` v0.2; `docs/plateforme/architecture.md` v0.1 (proposition); `docs/plateforme/ux/parcours.md` v0.1 (brouillon) |
| Statut | brouillon, à valider avec le cahier des charges |
| Version du document | 0.2 |
| Dernière mise à jour | 2026-10-30 |
| Rédigé par | qa-testeur |

> Ce document est la section 7 du cahier des charges de la plateforme. Une fois le cahier validé par le client, la plateforme n'est livrée que si chaque critère est satisfait au jalon indiqué. Toute modification passe par le manager et s'inscrit dans l'historique (section 9).

En bref: 132 critères, dont 120 vérifiés automatiquement dans l'environnement cloud, 8 rejoués sur les machines macOS et Windows de l'intégration continue, et 56 vérifiés chez le client (un critère peut avoir plusieurs modes). 35 hypothèses attendent une décision (section 2). La liste à tester chez le client pour la 1.0 tient en 13 points, dont un facultatif (section 8).

## 1. Mode d'emploi

### 1.1 Forme d'un critère

Chaque critère a un identifiant stable (CA-PF-001 à CA-PF-132), un titre, trois clauses (étant donné, quand, alors), ses modes de vérification et le jalon à partir duquel il doit être satisfait, puis le rester jusqu'à la 1.0. Un identifiant n'est jamais réattribué: un critère retiré reste listé avec la mention « retiré » et la date, un nouveau critère prend le premier numéro libre après le dernier, et se range dans la section de sa fonction.

Un renvoi H-xx désigne une hypothèse de la section 2, M-xx un message de la section 3, E01 à E19 un écran de la spécification UX. Un critère est satisfait quand tous ses essais réussissent, dans chacun de ses modes. Le rapport de recette (`docs/plateforme/recette/AAAA-MM-JJ.md`) donne pour chaque critère le test, le résultat et la preuve.

### 1.2 Modes de vérification

| Code | Mode | Où | Ce que ça prouve, et les limites |
|---|---|---|---|
| U | Test unitaire (Vitest, sous Node) | cloud, CI | La logique: règles, calculs, machines à états, validation des données. Pas l'intégration. |
| E | Application Electron sous `xvfb-run`, pilotée par Playwright (`_electron`): une instance, ou deux sur la boucle locale avec des dossiers de données et des ports distincts | cloud | L'application réelle, sous Linux. Ni le matériel, ni macOS, ni Windows. Exécution en root: le bac à sable de Chromium n'y est pas éprouvé. WebGL2 n'y tourne qu'en rendu logiciel (`--enable-unsafe-swiftshader`): images valables, mesures de performance sans valeur. |
| EL | Mode E en réseau local virtuel: deux instances (hôte et invité), chacune dans son espace de noms réseau, reliées par un pont; coupure par désactivation d'une interface; pertes par nftables; latence et gigue par un mandataire de perturbation (Toxiproxy, licence MIT, outil de test non livré); passerelle piège qui compte tout paquet sortant du réseau local | cloud | Découverte par vraie diffusion, coupures, reconnexions, absence d'Internet. Ni les pare-feu de macOS et de Windows, ni le Wi-Fi réel. |
| P2 | Playwright à deux contextes Chromium (hôte et invité) sur l'interface du lanceur ou sur un jeu dans le faux hôte `@duo/sdk-dev` | cloud | Variante rapide de E et EL pour vérifier les écrans et les jeux à chaque modification. La recette se fait toujours en E ou EL. |
| CI | Tests U et E rejoués sur les machines macOS et Windows de GitHub Actions, gratuites pour un dépôt public | CI | Les vrais systèmes (chemins, remplacement de fichiers, installateurs), pas le matériel du client. À confirmer avec ingenieur-build. |
| D | Relecture d'un document du dépôt par qa-testeur, selon la liste donnée par le critère | dépôt | Le contenu des guides. |
| M | Recette manuelle chez le client, sur le Mac et sur le PC, pas à pas | chez le client | Ce qui dépend du matériel, du réseau et des systèmes réels: installation, pare-feu, son, performances, clavier AZERTY réel. |

Faisabilité vérifiée le 2026-10-30 dans l'environnement cloud, avec des prototypes jetables hors du dépôt (Electron 38 pour ces essais; l'architecture retient Electron 45, essayé de son côté sous `xvfb-run`): deux instances d'Electron sous `xvfb-run` pilotées par Playwright, avec des dossiers de données aux noms accentués; deux espaces de noms réseau reliés par un pont (diffusion UDP reçue, coupure franche, Internet inaccessible); passerelle piège (68 paquets comptés pour une police chargée par erreur depuis un CDN); relevé des appels `connect` par `strace`; facteur d'échelle 1,5 forcé; événements clavier AZERTY injectés; plantage d'un rendu détecté sans fermeture de la fenêtre; pertes aléatoires par nftables. Limites constatées: le noyau n'a pas netem (la latence passe donc par un mandataire), et la disposition du clavier de l'Xvfb ne change pas (`setxkbmap` reste sans effet): l'AZERTY réel se vérifie chez le client.

### 1.3 Règles de mesure

- **Délai « en moins de N s »**: de l'action qui déclenche (touche, coupure, lancement) à l'affichage de l'élément attendu, ou à l'événement correspondant dans le journal de Duo. En automatique, 10 essais, chacun sous le seuil: c'est le pire essai qui compte, pas la moyenne. Chez le client, 3 essais sauf mention contraire, au chronomètre ou d'après les horodatages du journal.
- **Temps machine**: somme des attentes de Duo (lancement, découverte, chargement), lue dans les horodatages du journal, hors temps de réaction des joueurs.
- **Identique sur les deux machines**: mêmes valeurs, champ par champ (EL), ou constatées côte à côte (M).
- **Empreinte**: SHA-256 d'un fichier; pour l'état d'un jeu, l'empreinte fournie par le crochet de test du jeu (section 6).
- **Mémoire de Duo**: somme, sur tous ses processus, de la mémoire privée (`privateBytes` sous Windows, `workingSetSize` ailleurs) relevée par `app.getAppMetrics()`; dans les tests automatiques, après un ramasse-miettes forcé.
- **Images par seconde**: intervalles entre deux images successives du rendu mesuré (lanceur ou jeu), relevés sur 60 s par l'affichage des performances de Duo (section 6).
- **Message M-xx**: l'identifiant du message est présent à l'écran (attribut de test) et son texte est exactement celui de la spécification UX (colonne « Texte de référence » de la section 3); quand la spécification ne le donne pas encore, on vérifie le contenu obligatoire.
- Les délais et seuils chiffrés viennent de l'architecture (budgets de la section 13.2) et de la spécification UX quand elles les donnent, sinon de qa-testeur; les plus structurants figurent en hypothèses.

### 1.4 Environnements et données de test

- **Machines du client**: le Mac (puce M1, version de macOS à relever) et le PC, machine de référence pour les performances (configuration à relever, question Q4 du cahier; hypothèse en attendant: Intel Core i3 de 2018, Intel UHD 620).
- **Profils réseau**: R0, réseau local virtuel sans perturbation; R1, 100 ms d'aller-retour (50 ms dans chaque sens), 20 ms de gigue et 2 % de pertes (budget réseau de l'architecture); coupure, lien désactivé (EL) ou Wi-Fi coupé (M); micro-coupure, lien désactivé pendant 500 ms.
- **Zones d'affichage de référence** (taille en pixels CSS et facteur d'échelle):

| Zone | Facteur | Cas réel |
|---|---|---|
| 1280x640 | 1,5 | écran 1920x1080 à 150 % (portable Windows), fenêtre agrandie: la plus petite zone (H-31) |
| 1280x720 | 1,5 | même écran, plein écran |
| 1366x688 | 1 | portable 1366x768 à 100 %, fenêtre agrandie |
| 1366x768 | 1 | même écran, plein écran |
| 1536x864 | 1,25 | écran 1920x1080 à 125 %, plein écran |
| 1920x1080 | 1 | écran 1920x1080 à 100 %, plein écran |
| 1440x900 | 2 | MacBook Air M1 à son réglage par défaut, plein écran (modèle exact du Mac à confirmer) |

- **Pseudos de test** (H-01):
  - acceptés tels quels: « Lou », « Hélène », « Jean-Kévin », « D'Artagnan », « D’Artagnan », « Zoé 2 », « Œdipe Çà », seize « W » d'affilée;
  - acceptés après transformation: « Max » entouré de trois espaces de chaque côté, enregistré « Max »; « Hélène » saisi en Unicode décomposé (e suivi de U+0301), enregistré en NFC;
  - saisies refusées: un caractère refusé, tapé ou collé, n'entre pas dans le champ et M-01 s'affiche (l'émoji U+1F338 après « Lou », « < » dans « a<b », « _ » dans « Lou_92 », « ! » dans « Lou! », une tabulation ou un retour à la ligne collés); la saisie s'arrête au seizième caractère (un dix-septième « W » n'entre pas); un champ vide ou fait d'espaces ne se valide pas et affiche M-01.
- **Chemins de test**: sous Linux, un dossier personnel et un dossier de données nommés « Hélène d'Arc Ü » suivi de l'émoji U+1F600, puis les mêmes noms en Unicode décomposé; sous Windows, `C:\Users\Hélène Dupont-Lefèvre\AppData\Roaming\Duo`.
- **Jeux**: le jeu témoin, livré avec Duo, et les jeux d'essai, réservés aux tests (section 6).

## 2. Hypothèses en attente de décision

Le cahier v0.2 laisse ces points ouverts, ou les tranche autrement que l'architecture ou la spécification UX. Les critères les supposent tranchés comme ci-dessous. Toute décision différente du client ou du manager entraîne la mise à jour des critères cités et une ligne dans l'historique.

| # | Sujet | Règle supposée par les critères | Fonctions | Critères |
|---|---|---|---|---|
| H-01 | Pseudo | 1 à 16 caractères (graphèmes): lettres accentuées ou non, chiffres, espaces intérieures, trait d'union, apostrophe droite ou typographique (UX 0.4). Espaces de début et de fin retirées, enregistrement en NFC. Recommandation QA, plus stricte que l'UX: alphabet latin seulement, et aucun émoji ni autre symbole, pour que tout jeu puisse afficher les pseudos, même avec une police en pixels. | F01 | 002 |
| H-02 | Couleur de joueur | Six couleurs de la direction artistique, chacune liée à un symbole (UX 0.4); pas de couleur libre. Au premier lancement, la couleur de l'autre est indisponible; si deux profils se rencontrent plus tard avec la même couleur, la machine qui rejoint passe à la couleur libre suivante et l'annonce (UX 1.4). | F01 | 003, 006, 109 |
| H-03 | Identité du duo | Le duo est la paire des identifiants stables des deux machines (`machine.json`, architecture 8.2), indépendants des pseudos. Historique, scores et sauvegardes s'y rattachent et s'affichent avec les pseudos actuels. | F01, F07, F08 | 004 |
| H-04 | Invitation | Bandeau visible sur tout écran hors partie, sauf pendant le premier lancement; il prend le focus sur « Rejoindre », sauf pendant une saisie de texte. Entrée rejoint, et rejoindre vaut « C'est parti »; Échap le met de côté dans l'accueil (UX 0.6, 2.1). | F02 | 007, 008 |
| H-05 | Saisie de l'adresse IP | Les touches de la rangée des chiffres donnent des chiffres même sans Maj (lecture par position de touche), la virgule vaut un point, aucun port à saisir. Absent de l'UX: proposition QA pour le clavier AZERTY. | F02 | 010 |
| H-06 | Deux salons en même temps | Chacun voit l'invitation de l'autre; le premier qui rejoint l'emporte et l'autre salon se ferme (UX 2.3). | F02 | 020 |
| H-07 | Délais de découverte | Invitation visible en moins de 3 s (budget de l'architecture); aide au bout de 30 s sans trouver l'autre au premier lancement (UX E04); échec d'une adresse IP signalé en moins de 10 s. | F02 | 007, 011, 018 |
| H-08 | Salon | L'hôte seul choisit le jeu et la sauvegarde; tout changement remet les deux joueurs à « Pas encore » et prévient l'autre. Démarrage après « La partie commence dans 3 », annulé par « Pas encore » ou Échap sur l'un ou l'autre ordinateur (UX 2.2, 0.6). | F03 | 024, 025, 026 |
| H-09 | Pause et reprise | Échap met la partie en pause sur les deux machines et affiche qui l'a demandée. La reprise attend « Reprendre » sur les deux ordinateurs, puis « Reprise dans 3 » (UX 3.1), après une pause comme après une reconnexion. | F05, F06 | 035, 036, 046 |
| H-10 | Fin de partie | « Rejouer » relance quand les deux l'ont choisi; « Retour au salon » n'y emmène que celui qui le choisit, l'autre voit qu'il l'attend (UX 4.1). | F05 | 037 |
| H-11 | Partie interrompue | Une partie arrêtée avant la fin, par un joueur ou par un plantage, est inscrite à l'historique comme « interrompue », avec sa durée, sans compter dans les scores (question Q5 du cahier, recommandation de l'architecture et de l'UX). | F05, F08, F09 | 038, 047, 062, 067 |
| H-12 | Fenêtre réduite | Réduire la fenêtre ne met pas la partie en pause (comme une perte du focus: les touches sont relâchées), et la simulation de l'hôte garde son rythme (architecture 7.5, UX 0.5). | F05 | 041 |
| H-13 | Fermer Duo en pleine partie | Confirmation « Quitter Duo ? », sauvegarde de sortie, puis l'autre machine est prévenue et revient au salon sans attendre de reconnexion (UX 3.5). | F05, F06 | 042 |
| H-14 | Coupure du réseau | Pause en moins de 3 s (perte déclarée après 3 s sans battement, architecture 7.5); aucune pause pour une interruption de 500 ms ou moins; attente sans limite de durée, « Arrêter la partie » toujours possible; reconnexion sans action, puis pause ordinaire et reprise selon H-09 (UX 3.2). | F06 | 044, 045, 046, 047 |
| H-15 | Redémarrage de Duo en pleine partie | Conforme au cahier v0.2 (F06): chez l'invité, la partie reprend à l'identique, car l'hôte garde l'état; chez l'hôte, on repart de la dernière sauvegarde, que l'accueil de l'hôte propose comme partie interrompue (UX 3.2). | F06 | 048, 049 |
| H-16 | Taille des sauvegardes | Les critères éprouvent 20 Mo par emplacement (premier jeu envisagé: simulation de vie d'une centaine d'heures); le plafond absolu de la plateforme se fixe dans l'ADR 0009. | F07 | 051, 053, 106 |
| H-17 | Sens de « la plus récente » | Chaîne de révisions (architecture 8.6). Copie en retard (l'une descend de l'autre): la plus avancée remplace l'autre. Divergence vraie: la plus récente selon la date d'écriture l'emporte. Dans les deux cas, l'autre copie reste en secours, visible dans la fiche du jeu, et c'est signalé (cahier, section 4; UX E08). L'architecture propose de ne signaler que la divergence vraie: si ce choix est retenu, CA-PF-055 et CA-PF-105 n'exigent plus M-21. | F07 | 055, 056 |
| H-18 | Machine réinstallée ou remplacée | À la première connexion, après confirmation des deux joueurs, l'autre machine lui recopie toutes les données du duo, et la nouvelle machine prend la place de l'ancienne dans le duo. Non prévu par l'architecture, où une machine réinstallée formerait un nouveau duo. | F07 | 059 |
| H-19 | Date et durée dans l'historique | Date et heure de début, en heure locale; durée de jeu hors pauses et hors attentes de reconnexion. | F08 | 060 |
| H-20 | Jeux sans fin de partie | Le jeu déclare s'il a des parties (avec un résultat) ou des sessions (sans résultat). Une session est inscrite quand on la quitte, avec la progression atteinte; la bibliothèque affiche alors la durée typique d'une session. | F04, F08, F09 | 065 |
| H-21 | Modèle de score | Chaque jeu se range dans l'un des deux modes du manifeste, même s'il est asymétrique ou en coopétition: affrontement (un vainqueur ou une égalité) ou coopération (progression commune, dernière valeur déclarée par le jeu). | F04, F09 | 029, 068 |
| H-22 | Volumes | De 0 à 100 % par pas de 5 % (Origine et Fin: 0 et 100 %); gain effectif d'une catégorie = volume général × volume de la catégorie. | F10 | 069 |
| H-23 | Plein écran | Aussi par raccourci: F11 sous Windows, Ctrl+Cmd+F sous macOS (UX 0.5). | F10 | 071 |
| H-24 | Taille de l'interface | 100, 125 ou 150 %, appliquée au lanceur et aux surcouches de la plateforme; les jeux reçoivent la valeur par le SDK. | F10 | 072 |
| H-25 | Touches des jeux | Pour chaque jeu qui le permet; Échap réservée à la pause; une touche déjà prise fait proposer l'échange; « Rétablir les touches par défaut » demande confirmation; touches et volumes modifiables aussi depuis le menu de pause (UX 6.1). | F10 | 074 |
| H-26 | Premier lancement | Seuil d'acceptation: moins de 5 min par machine jusqu'à voir l'autre machine, en suivant seulement les écrans de Duo (objectif de conception de l'UX: 2 min). | F11 | 080 |
| H-27 | Désinstallation | Elle conserve les données du duo; une réinstallation les retrouve. | F11 | 082 |
| H-28 | Nouveaux jeux | Recherche au démarrage, puis régulièrement, si Internet répond, jamais pendant une partie; téléchargement et installation sans action, puis notification (UX 7.1); « Chercher de nouveaux jeux » à la demande; après 3 échecs de suite, Duo attend « Réessayer maintenant » (proposition QA). | F12 | 084, 086, 088 |
| H-29 | Compatibilité | Règles de l'architecture (section 10), reprises par le cahier v0.2: protocole de session identique, API du pont de chaque machine suffisante pour le SDK exigé par le jeu, versions d'Electron identiques pour un jeu en lockstep; des versions différentes de Duo jouent ensemble si ces conditions tiennent. Incompatibilité affichée dès que les machines se voient (UX 9). | F13 | 090, 091, 107 |
| H-30 | Mesures de performance | Budgets de l'architecture (13.2) pris comme seuils d'acceptation, sur le PC réel du client: sur 60 s par scénario, moyenne d'au moins 58 images par seconde, au moins 99 % des intervalles à 20 ms ou moins, aucun au-delà de 34 ms après les 5 premières secondes; 350 Mo au repos et 1 Go en partie; lanceur utilisable en 3 s (6 s sur disque dur), partie jouable 5 s après le départ. | Transverse | 095, 096, 128, 129 |
| H-31 | Plus petite zone d'affichage | 1280x640 pixels CSS, soit un écran 1920x1080 à 150 % en fenêtre agrandie (UX 0.8). | Transverse | 072, 113 |
| H-32 | Version d'un jeu entre les deux machines | On joue toujours la version la plus récente présente sur l'une des deux machines: elle est copiée par le réseau local vers l'autre, sans Internet, en une action (UX 9: « Mettre à jour et rejoindre »). Le cahier v0.2 dit « le jeu de l'hôte est copié chez l'invité », ce qui ferait jouer une version plus ancienne quand l'hôte est en retard. | F07, F13 | 091, 092, 107, 124, 125 |
| H-33 | Rapport pour le studio | La question Q6 du cahier v0.2 (fonction F14) est acceptée; la spécification UX prévoit déjà ce rapport (E13, E17, réglages À propos). | F05, F02 | 132 |
| H-34 | Présence de l'autre ordinateur | Chaque Duo ouvert s'annonce sur le réseau local, même sans salon, pour que l'accueil dise « Sacha est là » et que le premier lancement trouve l'autre (UX 13, à confirmer par architecte-technique et dev-reseau). | F02 | 118 |
| H-35 | Invitation quand Duo est en arrière-plan | L'icône de Duo rebondit dans le Dock (Mac) ou clignote dans la barre des tâches (PC), faute de notifications du système pour une application non signée sous macOS (architecture 11.2). | F02 | 131 |

## 3. Catalogue des messages

Chaque message attendu par un critère a un identifiant. Son texte exact est celui de la spécification UX (`docs/plateforme/ux/parcours.md`), à l'écran et à l'élément indiqués; « à écrire » signale un texte qui manque encore. Tous tutoient le joueur et contiennent au moins les éléments de la dernière colonne.

| Message | Situation | Affiché sur | Texte de référence | Contenu obligatoire |
|---|---|---|---|---|
| M-01 | Pseudo refusé | la machine qui saisit, sous le champ | E02 « erreur vide », « erreur caractère »; mêmes textes dans les réglages | la règle non respectée |
| M-02 | Même couleur que l'autre | la machine qui rejoint | E04 « même couleur »; notification de la section 1.4 de l'UX | la nouvelle couleur et son symbole; où la changer |
| M-03 | Pare-feu de Windows qui bloque Duo | le PC | E03 « Windows refus »; E17 « Windows, pare-feu, problème » | la cause; les étapes avec les libellés exacts de Windows; un bouton qui ouvre le réglage; un bouton de vérification |
| M-04 | Réseau Windows de type « Public » | le PC | E03 « Windows public »; E17 « Windows, profil, problème » | la cause; les étapes pour passer en « Privé »; un bouton qui ouvre le réglage; un bouton de vérification |
| M-05 | Accès au réseau local refusé par macOS | le Mac | E03 « macOS refus »; E17 « macOS, problème » | la cause; les étapes dans Réglages Système; un bouton qui ouvre le réglage; un bouton de vérification, ou l'indication de redémarrer Duo si macOS l'impose |
| M-06 | Coupe-feu de macOS qui bloque Duo | le Mac | E17 « macOS, coupe-feu » | la cause; les étapes; un bouton de vérification |
| M-07 | Aucun réseau | la machine concernée | E17 « réseau, problème »; E12 « réseau local coupé » | l'ordinateur n'est relié à aucun réseau; se connecter au Wi-Fi de la maison |
| M-08 | L'autre ordinateur reste introuvable | la machine qui cherche | E04 « après 30 s »; présence en alerte sur l'accueil (E05); E08 « attente 20 s » | ce qu'il faut vérifier; accès au diagnostic et à la connexion avec une adresse |
| M-09 | Adresse mal écrite | la machine qui saisit | E17 « mal écrite » | le format attendu, avec un exemple |
| M-10 | Adresse sans réponse, ou qui n'est pas Duo; échec pour rejoindre | la machine qui se connecte | E17 « pas de réponse », « pas Duo »; E08 « fenêtre d'échec » | l'adresse essayée; ce qu'il faut vérifier; « Réessayer » |
| M-11 | Salon fermé par l'hôte | l'invité | E08, notification « Camille a fermé le salon. » | le pseudo de l'hôte |
| M-12 | Jeu illisible | la machine concernée | à écrire | le nom du dossier du jeu; les autres jeux restent jouables |
| M-13 | Jeu qui exige un Duo plus récent | la machine concernée | E07 « Duo trop ancien »; UX section 9 | la version de Duo nécessaire; comment mettre Duo à jour |
| M-14 | Plantage ou échec de chargement d'un jeu | les deux machines | E13; E09 « échec » | le nom du jeu; la machine concernée; l'état de la dernière sauvegarde |
| M-15 | Fermeture de Duo en pleine partie | la machine qui ferme | UX 3.6, « fenêtre de Duo, fermeture en partie » | la partie s'arrête pour les deux; ce qui est enregistré; « Quitter Duo » et « Continuer à jouer » |
| M-16 | L'autre joueur a arrêté la partie ou quitté Duo | l'autre machine | E11, notification « Camille a arrêté la partie. » (variante pour la fermeture de Duo: à écrire) | son pseudo |
| M-17 | Attente de reconnexion | la machine qui reste | E12 | le pseudo de l'autre; depuis combien de temps; « Arrêter la partie » |
| M-18 | Reconnexion en cours | la machine qui a perdu l'autre | E12, en miroir | le pseudo de l'autre; « Arrêter la partie » |
| M-19 | Partie interrompue, Duo arrêté chez l'hôte | les deux machines | UX 3.2, « Partie interrompue » sur l'accueil (texte à écrire) | la reprise possible depuis la dernière sauvegarde, avec sa date |
| M-20 | Fichier illisible | la machine concernée | E15 « abîmé, récupéré chez l'autre », « abîmé, version précédente » (variante pour les sauvegardes: à écrire) | ce qui a été restauré, et d'où |
| M-21 | Copies remises d'accord | les deux machines | E08 « fenêtre copies différentes »; E15 « fusion » | le jeu et la sauvegarde, ou le nombre de parties ajoutées; la version gardée; l'autre en secours |
| M-22 | Écriture impossible | la machine concernée | E14 « disque plein »; E16 « erreur »; variante pour les sauvegardes: à écrire | la cause (droits, place sur le disque); ce que Duo fait |
| M-23 | Machine sans les données du duo | les deux machines | à écrire | la proposition de recopier les données du duo depuis l'autre machine; un choix pour recopier, un pour plus tard |
| M-24 | Touche déjà prise, ou réservée | la machine qui règle | E16 « touche prise », « touche réservée » | l'action qui utilise la touche; « Échanger » et « Annuler » |
| M-25 | Téléchargement, copie ou installation d'un jeu échoués | la machine qui reçoit | E07 « échec », « fichier abîmé », « disque plein » | le jeu; la cause; la version précédente reste jouable; « Réessayer maintenant » |
| M-26 | Pas d'Internet pour les jeux | la bibliothèque | E07 « pas d'Internet » | les jeux installés restent jouables; Duo réessaiera |
| M-27 | Duo incompatible entre les deux machines | les deux machines | UX section 9, « Duo différent » | les deux versions; la machine à mettre à jour; « Comment mettre Duo à jour » |
| M-28 | Jeu à installer ou à mettre à jour avant de jouer | les deux machines | E06 « jeu absent », « jeu ancien », « hôte en retard »; UX section 9 | le jeu; la machine concernée; un bouton qui fait tout en une action, avec la taille |
| M-29 | Données d'une version plus récente de Duo | la machine concernée | à écrire | aucune donnée n'a été modifiée; installer la dernière version |
| M-30 | Présence de l'autre ordinateur | les deux machines | barre du haut; E16 Réseau « Sacha est là », « Sacha n'est pas visible pour l'instant. » | le pseudo; présent ou non |
| M-31 | VPN actif | la machine concernée | E17 « VPN, problème » | le couper le temps de jouer |
| M-32 | Blocage d'un seul côté | la machine qui diagnostique | E17 « sens unique » | de quel côté est le blocage |
| M-33 | Places de sauvegarde pleines | l'hôte | E08 « places pleines », « fenêtre de remplacement » | laquelle remplacer; elle reste en copie de secours |
| M-34 | Sauvegarde d'une version plus récente du jeu | la machine qui héberge | UX section 9, dernière ligne | mettre le jeu à jour pour la reprendre, en une action |
| M-35 | Nouvelle version de Duo | la machine concernée | à écrire | le numéro de la nouvelle version; le lien vers la page de téléchargement et le guide |
| M-36 | Rapport pour le studio | la machine concernée | E13 « rapport enregistré »; E17 « confirmation » | où se trouve le rapport, ou qu'il est copié |

## 4. Critères par fonction

### F01 Profil

**CA-PF-001. Profil obligatoire au premier lancement**
- Étant donné un dossier de données Duo vide,
- quand Duo démarre,
- alors le parcours de premier lancement (E01 à E04) s'affiche, et ni la bibliothèque, ni le salon, ni l'historique, ni les scores ne sont atteignables, au clavier comme à la souris, avant l'enregistrement d'un profil valide.
- Vérification: E. Jalon: alpha.

**CA-PF-002. Règles du pseudo**
- Étant donné l'écran de profil (E02) ou l'onglet Profil des réglages,
- quand on tape ou colle chacun des pseudos de test (section 1.4), puis qu'on valide,
- alors chaque pseudo accepté est enregistré sous la forme indiquée par la liste, et chaque saisie refusée se comporte comme la liste le dit (caractère qui n'entre pas, arrêt au seizième caractère, M-01); de plus, le pseudo prérempli à partir du nom du compte de l'ordinateur respecte ces règles, y compris pour un compte au nom de 25 caractères contenant un émoji.
- Vérification: U (règle), E (saisie et message). Jalon: alpha. Hypothèse: H-01.

**CA-PF-003. Choix de la couleur**
- Étant donné l'écran de profil,
- quand on ouvre le choix de la couleur,
- alors il propose exactement les six couleurs de la palette des joueurs, chacune avec son symbole, conformes à CA-PF-109; une et une seule est sélectionnée; on la change au clavier seul (flèches) comme à la souris; la couleur de l'autre joueur, s'il est connu, est indisponible et marquée comme prise par lui.
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

**CA-PF-006. Jamais la même couleur que l'autre**
- Étant donné deux profils de même couleur,
- quand les deux machines se voient pour la première fois, d'abord pendant le premier lancement de l'une (E04), puis, dans un second essai, après deux premiers lancements faits sans se voir,
- alors, dans le premier cas, Duo fait choisir une autre couleur sur place, celle de l'autre étant indisponible; dans le second, la machine qui rejoint passe à la couleur libre suivante et l'annonce par M-02; dans les deux cas, les deux machines affichent ensuite deux couleurs et deux symboles différents, et la couleur de l'autre reste indisponible dans les réglages.
- Vérification: EL. Jalon: alpha. Hypothèse: H-02.

### F02 Découverte et connexion

**CA-PF-007. Découverte automatique de l'hôte**
- Étant donné A et B sur le même réseau local, autorisations réseau accordées, profils créés, B sur n'importe quel écran hors partie,
- quand A ouvre un salon,
- alors B affiche l'invitation d'A (pseudo d'A, jeu et sauvegarde choisis) en moins de 3 s, sans aucune saisie: 10 essais sur 10 en automatique; chez le client, 4 essais sur 4, dont 2 avec chaque machine comme hôte.
- Vérification: EL, M. Jalon: prototype. Hypothèses: H-04, H-07.

**CA-PF-008. Rejoindre d'une touche**
- Étant donné l'invitation d'A affichée chez B, sans saisie de texte en cours chez B,
- quand B appuie une fois sur Entrée,
- alors B entre dans le salon d'A, déjà déclaré prêt (rejoindre vaut « C'est parti »), et les deux écrans montrent les deux profils en moins de 2 s.
- Vérification: EL, M. Jalon: prototype. Hypothèse: H-04.

**CA-PF-009. Invitation retirée quand l'hôte s'en va**
- Étant donné l'invitation d'A affichée chez B,
- quand A ferme son salon ou quitte Duo par la fermeture habituelle, puis, dans un second essai, quand le processus Duo d'A est tué,
- alors l'invitation disparaît de l'écran de B en moins de 3 s dans le premier cas, en moins de 10 s dans le second, et ne peut plus être choisie.
- Vérification: EL. Jalon: alpha.

**CA-PF-010. Connexion par adresse IP**
- Étant donné A qui a ouvert un salon, et dont les adresses IPv4 privées s'affichent dans Réglages > Réseau et, après 20 s d'attente, dans son salon,
- quand B saisit l'une de ces adresses, sans port, dans la connexion avec une adresse (E17) et valide,
- alors B est connecté à A en moins de 5 s, et Duo retient l'adresse pour la fois suivante; le champ accepte les chiffres du pavé numérique et ceux de la rangée du haut, avec ou sans Maj, et la virgule à la place du point.
- Vérification: U (lecture de la saisie), EL, M. Jalon: prototype. Hypothèse: H-05.

**CA-PF-011. Adresse mal écrite, sans réponse, ou qui n'est pas Duo**
- Étant donné la connexion avec une adresse (E17),
- quand B valide une valeur mal formée (« 192.168.1 », « 192.168.1.300 », « abc », champ vide), puis une adresse bien formée où rien ne répond, puis l'adresse d'un appareil dont un autre programme écoute sur le port de Duo,
- alors la valeur mal formée provoque M-09 en moins de 0,5 s, sans tentative de connexion; l'adresse sans réponse provoque M-10 en moins de 10 s; l'appareil qui n'est pas Duo provoque la variante de M-10 qui le dit, en moins de 10 s; dans tous les cas, la saisie reste modifiable dans le champ.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-07.

**CA-PF-012. Hôte qui bloque les connexions entrantes**
- Étant donné un hôte dont l'invitation parvient à B mais qui bloque les connexions entrantes (règle de pare-feu simulée en EL; pare-feu du système chez le client),
- quand B tente de rejoindre,
- alors B affiche M-10 en moins de 10 s, en citant le blocage par l'ordinateur de l'hôte parmi les causes possibles; l'hôte affiche le message de son système (M-03 sous Windows, M-06 sous macOS) selon CA-PF-013 et CA-PF-016.
- Vérification: EL (côté invité), M. Jalon: alpha.

**CA-PF-013. Diagnostic: pare-feu de Windows**
- Étant donné le PC où l'accès réseau de Duo est refusé par le pare-feu de Windows (« Annuler » à la première demande, ou règle de blocage),
- quand Duo cherche l'autre ordinateur (premier lancement, accueil, salon ou diagnostic),
- alors le PC affiche M-03 en moins de 5 s, et une fois ses étapes suivies, le bouton de vérification (« C'est fait, vérifier » ou « Relancer les vérifications ») suffit, sans redémarrer Duo, pour retrouver le Mac.
- Vérification: M; CI Windows pour la détection d'une règle de blocage créée par script. Jalon: bêta.

**CA-PF-014. Diagnostic: réseau Windows « Public »**
- Étant donné le PC dont la connexion active est de type « Public » dans Windows,
- quand Duo cherche l'autre ordinateur (premier lancement, accueil, salon ou diagnostic),
- alors le PC affiche M-04 en moins de 5 s, avant toute fenêtre du pare-feu au premier lancement, et une fois le réseau passé en « Privé » selon ses étapes, le bouton de vérification suffit, sans redémarrer Duo, pour retrouver le Mac.
- Vérification: M. Jalon: bêta.

**CA-PF-015. Diagnostic: réseau local refusé par macOS**
- Étant donné le Mac où l'accès au réseau local est refusé à Duo (Réglages Système, Confidentialité et sécurité, Réseau local),
- quand Duo cherche l'autre ordinateur (premier lancement, accueil, salon ou diagnostic),
- alors le Mac affiche M-05 en moins de 5 s, et une fois l'accès rétabli, le bouton de vérification suffit pour retrouver le PC, ou M-05 dit de redémarrer Duo si macOS l'impose.
- Vérification: M. Jalon: bêta.

**CA-PF-016. Diagnostic: coupe-feu de macOS**
- Étant donné le Mac dont le coupe-feu (le pare-feu de macOS) est activé et bloque les connexions entrantes de Duo,
- quand le Mac ouvre un salon, ou qu'on lance le diagnostic,
- alors il affiche M-06 en moins de 5 s, et une fois ses étapes suivies, le bouton de vérification suffit pour que le PC rejoigne.
- Vérification: M. Jalon: bêta.

**CA-PF-017. Aucun réseau**
- Étant donné une machine sans connexion réseau (Wi-Fi coupé, câble débranché),
- quand Duo cherche l'autre ordinateur (premier lancement, accueil, salon ou diagnostic),
- alors M-07 s'affiche en moins de 3 s, puis disparaît de lui-même moins de 10 s après le retour du réseau, la recherche reprenant sans action.
- Vérification: EL, M. Jalon: alpha.

**CA-PF-018. Autre ordinateur introuvable**
- Étant donné B au premier lancement (E04) sans que l'autre ordinateur soit trouvé (Duo fermé chez A, ou réseau qui isole les appareils, simulé en EL en bloquant la diffusion),
- quand 30 s s'écoulent,
- alors B affiche M-08, avec l'accès au diagnostic et à la connexion avec une adresse; la recherche continue, et l'autre ordinateur, dès qu'il est visible, s'affiche en moins de 3 s à la place du message.
- Vérification: EL. Jalon: alpha. Hypothèse: H-07.

**CA-PF-019. Plusieurs interfaces réseau**
- Étant donné un hôte qui a, en plus de l'interface du réseau commun, au moins une autre interface privée (VPN, adaptateur virtuel Hyper-V, WSL ou VirtualBox),
- quand il ouvre un salon,
- alors l'invité le découvre en moins de 3 s, Réglages > Réseau liste toutes ses adresses IPv4 privées avec le nom de leur interface, et la connexion par adresse IP réussit avec l'adresse du réseau commun.
- Vérification: EL (interface supplémentaire dans l'espace de noms de l'hôte), M si le PC a de tels adaptateurs. Jalon: alpha.

**CA-PF-020. Deux salons ouverts en même temps**
- Étant donné A et B qui ouvrent chacun un salon à moins de 2 s d'intervalle,
- quand B rejoint le salon d'A depuis l'invitation,
- alors le salon de B se ferme, B en est prévenu, son invitation disparaît chez A en moins de 3 s, et il reste exactement un salon, celui d'A, avec les deux joueurs.
- Vérification: EL. Jalon: alpha. Hypothèse: H-06.

**CA-PF-021. Messages et connexions refusés**
- Étant donné un hôte en salon,
- quand une autre adresse du réseau envoie à ses ports de découverte et de connexion 10 000 messages aléatoires, tronqués, de 1 Mo, ou au format d'une autre application; puis qu'une page web tente de s'y connecter (en-tête `Origin`); puis qu'une adresse non privée tente de s'y connecter,
- alors Duo ne plante pas, aucun faux hôte n'apparaît chez l'invité, la page web et l'adresse non privée sont refusées, et un invité légitime rejoint ensuite le salon en moins de 5 s.
- Vérification: U (validation des messages), EL. Jalon: alpha.

**CA-PF-118. Présence de l'autre ordinateur**
- Étant donné Duo ouvert sur A, sans salon, et B sur le même réseau,
- quand B démarre Duo, puis le ferme,
- alors A affiche que B est là (M-30), avec son pseudo, moins de 3 s après l'affichage du lanceur de B, puis qu'il n'est plus visible moins de 10 s après sa fermeture; B voit A de la même façon; au premier lancement, E04 trouve ainsi l'autre machine sans qu'aucun salon soit ouvert.
- Vérification: EL, M. Jalon: prototype. Hypothèse: H-34.

**CA-PF-119. Diagnostic: vérifications et blocage d'un seul côté**
- Étant donné le diagnostic (E17) ouvert sur B, d'abord quand A voit B mais que B ne voit pas A (diffusion d'A bloquée à l'entrée de B), puis avec un VPN actif sur B,
- quand B lance les vérifications,
- alors chaque vérification de la spécification UX (section 8.1) affiche son résultat (réussi, problème, à vérifier soi-même) en moins de 10 s; le blocage d'un seul côté est situé sur B par M-32; le VPN actif est signalé par M-31; « Relancer les vérifications » refait tout après correction, sans redémarrer Duo.
- Vérification: EL (blocage d'un seul côté), U (détection d'un VPN d'après la liste des interfaces), M. Jalon: alpha.

**CA-PF-131. Invitation quand Duo est en arrière-plan**
- Étant donné Duo ouvert chez B mais en arrière-plan (une autre application au premier plan),
- quand A ouvre un salon,
- alors, en moins de 3 s, l'icône de Duo rebondit dans le Dock (Mac) ou clignote dans la barre des tâches (PC), et au retour dans Duo l'invitation attend, prête à être acceptée d'une touche.
- Vérification: E (appels au système relevés par le crochet de test), M. Jalon: alpha. Hypothèse: H-35.

### F03 Salon

**CA-PF-022. Contenu du salon**
- Étant donné A et B dans le salon d'A, A ayant choisi un jeu et une sauvegarde,
- quand on compare les deux écrans,
- alors chacun affiche les deux pseudos avec leur couleur et leur symbole, qui héberge, l'état de chaque joueur écrit en toutes lettres (pas seulement par une couleur ou une icône), le nom du jeu, et la sauvegarde choisie (nom donné par le jeu, date et heure de dernière écriture) ou la mention d'une nouvelle partie, avec des valeurs identiques sur les deux écrans.
- Vérification: EL, M. Jalon: prototype pour les pseudos, les états et le jeu; alpha pour la sauvegarde.

**CA-PF-023. État « prêt » partagé**
- Étant donné le salon,
- quand un joueur change son état, par une touche ou un clic,
- alors le nouvel état s'affiche sur les deux écrans en moins de 1 s, y compris avec le profil réseau R1.
- Vérification: EL, M. Jalon: prototype.

**CA-PF-024. Démarrage quand les deux sont prêts**
- Étant donné le salon avec un jeu choisi et un seul joueur prêt,
- quand le second se déclare prêt,
- alors « La partie commence dans 3 » s'affiche sur les deux écrans, puis le chargement commence sur les deux machines; si l'un choisit « Pas encore » ou appuie sur Échap pendant le compte à rebours, celui-ci s'arrête sur les deux écrans en moins de 1 s, l'autre en est prévenu, et rien ne démarre.
- Vérification: EL, M. Jalon: prototype. Hypothèse: H-08.

**CA-PF-025. Jamais de démarrage partiel ni double**
- Étant donné le salon,
- quand les deux joueurs changent leur état selon 1 000 séquences aléatoires, dont des changements simultanés à moins de 50 ms d'écart, avec le profil réseau R1,
- alors la partie démarre si et seulement si les deux joueurs sont prêts à la fin du compte à rebours, jamais deux fois, et 1 s après la dernière action les deux machines sont dans le même état (salon ou chargement).
- Vérification: U (machine à états du salon), EL (50 séquences tirées des 1 000). Jalon: alpha. Hypothèse: H-08.

**CA-PF-026. Choix réservé à l'hôte**
- Étant donné le salon avec au moins un joueur prêt,
- quand l'hôte change de jeu ou de sauvegarde,
- alors les deux joueurs repassent à « Pas encore », le nouveau choix s'affiche chez l'invité en moins de 1 s avec une notification, et l'invité n'a aucun moyen de changer le jeu ni la sauvegarde.
- Vérification: EL. Jalon: alpha. Hypothèse: H-08.

**CA-PF-027. Départ de l'invité**
- Étant donné le salon avec deux joueurs,
- quand l'invité quitte le salon et confirme,
- alors l'hôte en est prévenu en moins de 3 s et revient à l'attente d'un joueur, son invitation est de nouveau diffusée, et l'invité peut revenir comme en CA-PF-008.
- Vérification: EL. Jalon: alpha.

**CA-PF-028. Salon fermé par l'hôte**
- Étant donné le salon avec deux joueurs,
- quand l'hôte ferme le salon et confirme,
- alors l'invité revient à l'accueil en moins de 3 s, avec M-11.
- Vérification: EL. Jalon: alpha.

**CA-PF-120. Nombre d'actions pour lancer une partie**
- Étant donné les deux machines sur l'accueil, le duo ayant déjà joué à un jeu (bloc « Reprendre »),
- quand l'hôte lance une partie et que l'invité la rejoint, au clavier seul,
- alors il suffit à l'hôte de 3 actions depuis l'accueil (héberger, choisir le jeu, dire « C'est parti »), ou de 2 depuis le bloc « Reprendre », et à l'invité d'une seule (rejoindre), chaque action étant un appui sur Entrée sur l'élément qui a déjà le focus; la partie démarre ensuite après le compte à rebours, sans autre action.
- Vérification: E (séquences rejouées au clavier), M. Jalon: alpha.

### F04 Bibliothèque

**CA-PF-029. Fiche de chaque jeu**
- Étant donné le jeu témoin et les jeux d'essai installés, dont les manifestes déclarent nom, vignette, description, mode et durée,
- quand on ouvre la bibliothèque,
- alors chaque jeu valide y figure une seule fois, avec sa vignette (image chargée, de dimensions non nulles), son nom et sa description identiques au manifeste, son type en toutes lettres (« Coopération » ou « Affrontement »), sa durée écrite d'après les deux valeurs du manifeste (« 20 à 40 min » pour 20 et 40), et le nombre de sauvegardes du duo, zéro compris.
- Vérification: E. Jalon: alpha. Hypothèse: H-21.

**CA-PF-030. Sauvegardes d'un jeu**
- Étant donné un jeu qui a deux sauvegardes du duo et une copie de secours,
- quand on ouvre sa fiche dans la bibliothèque,
- alors les deux sauvegardes sont listées de la plus récente à la plus ancienne, chacune avec son nom, la date et l'heure de sa dernière écriture et la progression déclarée par le jeu; la copie de secours est listée à part; la fiche est identique sur les deux machines.
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
- alors les deux machines affichent l'écran de chargement (E09) en moins de 0,5 s, avec le nom du jeu et l'avancement de chaque joueur; le jeu ne démarre que lorsque les deux ont fini de charger, et les deux démarrages ont lieu à moins de 200 ms d'écart (horloge commune du réseau virtuel, profil R0); si le chargement dépasse 20 s chez l'un, les deux écrans le disent et proposent « Revenir au salon ».
- Vérification: EL. Jalon: prototype.

**CA-PF-034. Échec du chargement**
- Étant donné un jeu d'essai qui échoue pendant son chargement sur l'une des machines (fichier manquant, erreur levée, ou chargement de plus de 30 s),
- quand le chargement est lancé,
- alors les deux machines reviennent au salon moins de 5 s après l'échec, avec M-14, et un autre jeu peut être lancé aussitôt.
- Vérification: EL. Jalon: alpha.

**CA-PF-035. Pause demandée par l'un ou l'autre**
- Étant donné une partie en cours,
- quand l'un des joueurs appuie sur Échap; puis, dans un second essai, quand les deux appuient sur Échap à moins de 50 ms d'écart,
- alors le menu de pause s'affiche sur les deux machines en moins de 500 ms avec le profil R1, avec le pseudo de qui l'a demandée (les deux pseudos dans le second essai, pour une seule pause), et la partie est figée: l'empreinte de l'état du jeu ne change pas pendant 10 s de pause.
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-09.

**CA-PF-036. Reprise des deux côtés**
- Étant donné une partie en pause,
- quand un joueur choisit « Reprendre », puis l'autre,
- alors, après le premier choix, la partie reste en pause et la puce de ce joueur l'indique sur les deux écrans; après le second, « Reprise dans 3 » s'affiche sur les deux écrans, puis la partie reprend sur les deux machines depuis l'état figé (empreinte identique à celle de la mise en pause); un joueur resté dans les réglages du menu de pause retarde la reprise jusqu'à son propre « Reprendre ».
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-09.

**CA-PF-037. Fin de partie**
- Étant donné une partie du jeu témoin menée à son terme,
- quand le jeu annonce la fin,
- alors l'écran de fin (E14) s'affiche sur les deux machines en moins de 1 s, avec le même résultat, les mêmes scores et la même durée, et propose « Rejouer » (ou le libellé fourni par le jeu) et « Retour au salon »; la partie recommence quand les deux ont choisi « Rejouer »; celui qui choisit « Retour au salon » y va seul, en moins de 2 s, et l'écran de l'autre indique qu'il l'attend dans le salon, sans quitter les résultats.
- Vérification: EL, M. Jalon: prototype pour une partie jouée jusqu'à la fin; alpha pour l'écran de fin complet. Hypothèse: H-10.

**CA-PF-038. Arrêter une partie en cours**
- Étant donné une partie en pause,
- quand un joueur choisit « Retour au salon » dans le menu de pause et confirme,
- alors les deux machines reviennent au salon en moins de 3 s, et l'autre joueur en est prévenu par une notification; si le jeu déclare une sauvegarde à la sortie, elle est écrite sur les deux machines avant ce retour; la partie est inscrite à l'historique comme interrompue.
- Vérification: EL. Jalon: alpha. Hypothèse: H-11.

**CA-PF-039. Un jeu qui plante ne ferme pas Duo**
- Étant donné une partie en cours,
- quand le jeu d'essai plante sur l'une des machines selon chacun de ses quatre modes (exception non rattrapée, promesse rejetée non gérée, arrêt brutal du processus qui exécute le jeu, boucle infinie qui fige le jeu),
- alors sur les deux machines Duo reste ouvert et revient au salon avec M-14 en moins de 5 s (en moins de 10 s pour la boucle infinie, détection comprise); la dernière sauvegarde écrite est intacte (empreinte); une nouvelle partie se lance aussitôt, sans redémarrer Duo.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-040. Aucune touche bloquée à la perte du focus**
- Étant donné une partie où un joueur maintient enfoncée une touche de déplacement,
- quand la fenêtre de Duo perd le focus (Alt+Tab, Cmd+Tab, clic dans une autre application) avant que la touche soit relâchée,
- alors le jeu considère toutes les touches comme relâchées en moins de 100 ms (le personnage s'arrête), la partie n'est pas mise en pause, et au retour du focus aucune touche n'est enfoncée tant qu'on n'en presse pas une.
- Vérification: E, M. Jalon: alpha.

**CA-PF-041. Fenêtre réduite: la partie continue**
- Étant donné une partie en cours,
- quand l'hôte, puis dans un second essai l'invité, réduit la fenêtre de Duo pendant 30 s,
- alors la partie ne se met pas en pause, les touches de celui qui a réduit sont relâchées comme en CA-PF-040, et la simulation de l'hôte garde son rythme: 60 pas par seconde, à 1 près, relevés par le crochet de test pendant les 30 s.
- Vérification: E (fenêtre masquée par le test), M (fenêtre réduite sur le Mac et sur le PC). Jalon: alpha. Hypothèse: H-12.

**CA-PF-042. Fermer Duo en pleine partie**
- Étant donné une partie en cours,
- quand un joueur ferme Duo (Cmd+Q, Alt+F4 ou bouton de fermeture de la fenêtre),
- alors Duo met la partie en pause et demande confirmation (M-15); « Continuer à jouer » ramène à la partie en pause; « Quitter Duo » écrit la sauvegarde de sortie si le jeu en déclare une, puis ferme Duo, et l'autre machine affiche M-16 et revient au salon en moins de 3 s, sans attente de reconnexion.
- Vérification: E, EL, M. Jalon: alpha. Hypothèse: H-13.

**CA-PF-043. Ressources libérées à la sortie d'un jeu**
- Étant donné le jeu témoin lancé, joué 30 s, puis quitté,
- quand le salon est revenu à l'écran,
- alors le processus qui exécutait le jeu n'existe plus (absent de `app.getAppMetrics()`), et la vue de la plateforme ne garde aucun contexte WebGL ni audio créé pour le jeu (compteurs du mode test à zéro).
- Vérification: E. Jalon: alpha.

**CA-PF-130. Pas de mise en veille pendant une partie**
- Étant donné une partie en cours, sur un ordinateur dont l'écran se met en veille après 1 min sans activité,
- quand personne ne touche ni au clavier ni à la souris pendant 2 min,
- alors l'écran ne s'éteint pas et l'ordinateur ne se met pas en veille; une fois revenu au salon, la mise en veille habituelle reprend.
- Vérification: E (blocage de la mise en veille actif pendant la partie et levé après, lu par le crochet de test), M. Jalon: alpha.

**CA-PF-132. Rapport pour le studio**
- Étant donné l'écran « Le jeu s'est arrêté » (E13), le diagnostic (E17) et l'onglet À propos des réglages,
- quand on choisit d'enregistrer ou de copier le rapport pour le studio,
- alors un fichier est écrit dans le dossier Téléchargements de l'utilisateur (ou le texte est copié dans le presse-papiers), M-36 le confirme avec le nom du fichier, et le rapport contient les versions de Duo et des jeux, le système, l'état du réseau et du rendu, et les journaux récents.
- Vérification: E (contenu du rapport), M (rapport joint à la recette). Jalon: alpha. Hypothèse: H-33.

### F06 Déconnexion

**CA-PF-044. Pause automatique à la coupure**
- Étant donné une partie en cours,
- quand le lien entre les deux machines est coupé (interface désactivée en EL; Wi-Fi coupé sur une machine chez le client), y compris pendant le compte à rebours de reprise,
- alors les deux machines sont en pause en moins de 3 s, et un compte à rebours de reprise en cours s'annule; la machine qui reste affiche M-17, l'autre M-18, et celle dont c'est le propre réseau qui est coupé affiche M-07 dans la même superposition.
- Vérification: EL, M. Jalon: alpha. Hypothèse: H-14.

**CA-PF-045. Pas de pause pour une micro-coupure**
- Étant donné une partie en cours,
- quand le lien est interrompu pendant 500 ms puis rétabli,
- alors aucune pause ni message de déconnexion n'apparaît, et l'état reste synchronisé (empreintes identiques au contrôle suivant).
- Vérification: EL. Jalon: alpha. Hypothèse: H-14.

**CA-PF-046. Reconnexion sans action, puis reprise là où la partie en était**
- Étant donné une partie en pause après une coupure,
- quand le lien revient après 10 s, après 60 s, puis après 10 min (trois essais),
- alors la connexion se rétablit sans action des joueurs moins de 5 s après le retour du lien, les deux écrans annoncent le retour de l'autre et passent à la pause ordinaire, et après « Reprendre » sur les deux machines (CA-PF-036), la partie reprend avec une empreinte d'état identique à celle de la mise en pause.
- Vérification: EL, M (coupure de 30 s). Jalon: alpha. Hypothèses: H-09, H-14.

**CA-PF-047. Attente sans limite, arrêt toujours possible**
- Étant donné une partie en attente de reconnexion,
- quand 30 min s'écoulent, puis qu'un joueur choisit « Arrêter la partie » et confirme,
- alors l'attente se poursuit toujours au bout de 30 min, puis ce joueur revient à l'accueil en moins de 2 s; la partie est inscrite comme interrompue, et la dernière sauvegarde est intacte.
- Vérification: EL. Jalon: alpha. Hypothèses: H-11, H-14.

**CA-PF-048. Duo relancé chez l'invité**
- Étant donné une partie en cours,
- quand Duo est tué chez l'invité, puis relancé,
- alors l'hôte attend comme en CA-PF-044; au relancement, l'invité se voit proposer la partie en cours moins de 10 s après l'affichage du lanceur, l'accepte d'une touche, et la partie reprend, après « Reprendre » des deux côtés, avec l'empreinte d'état du moment de la coupure.
- Vérification: EL. Jalon: alpha. Hypothèse: H-15.

**CA-PF-049. Duo arrêté chez l'hôte**
- Étant donné une partie d'un jeu d'essai qui sauvegarde automatiquement toutes les 2 min, en cours depuis 5 min,
- quand Duo est tué chez l'hôte, puis relancé,
- alors l'invité passe en attente de reconnexion comme en CA-PF-044; à la réouverture, l'accueil de l'hôte propose de reprendre la partie interrompue depuis la dernière sauvegarde, et l'invité affiche M-19 en moins de 10 s; cette sauvegarde est intacte sur les deux machines et date de moins de 2 min avant l'arrêt.
- Vérification: EL. Jalon: alpha. Hypothèse: H-15.

**CA-PF-050. Mise en veille d'une machine**
- Étant donné une partie en cours,
- quand une machine se met en veille pendant 1 min (couvercle fermé chez le client; processus suspendu puis repris en EL),
- alors la partie se met en pause comme en CA-PF-044, puis la connexion se rétablit sans action des joueurs moins de 30 s après le réveil, et la partie reprend comme en CA-PF-046.
- Vérification: EL (simulation), M. Jalon: bêta.

### F07 Sauvegardes

**CA-PF-051. Sauvegarde écrite sur les deux machines**
- Étant donné une partie qui atteint un moment de sauvegarde déclaré par le jeu,
- quand le jeu sauvegarde,
- alors la sauvegarde existe sur les deux machines avec le même contenu (empreinte) et la même révision, en moins de 2 s pour 1 Mo et en moins de 10 s pour 20 Mo, et l'indicateur « Progression enregistrée » s'affiche 2 s sur les deux écrans.
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

**CA-PF-054. Fichier de sauvegarde ou d'historique illisible**
- Étant donné une sauvegarde écrite au moins deux fois et un historique de 3 parties, dont on rend ensuite illisible, sur une machine, la version courante (fichier tronqué de moitié, ou remplacé par des octets aléatoires),
- quand on ouvre la bibliothèque, le salon ou l'historique,
- alors Duo ne plante pas, utilise la version précédente ou la copie de l'autre machine, le signale par M-20, et garde le fichier illisible à part, sans l'effacer.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-055. Copie en retard après une coupure**
- Étant donné une sauvegarde en révision 5 chez A et en révision 4 chez B, la 5 descendant de la 4 (copie interrompue par une coupure),
- quand A et B se reconnectent, que l'hôte soit A ou B,
- alors, avant que le salon ne propose les sauvegardes, les deux machines ont la révision 5 (même empreinte), la révision 4 est gardée en secours chez B et visible dans la fiche du jeu, les deux écrans affichent M-21, et la révision 4 n'est jamais proposée comme sauvegarde courante.
- Vérification: EL. Jalon: alpha. Hypothèse: H-17.

**CA-PF-056. Copies divergentes**
- Étant donné deux copies d'une sauvegarde dont aucune ne descend de l'autre (synchronisation interrompue, faute injectée),
- quand les machines se connectent,
- alors la copie dont la date d'écriture est la plus récente l'emporte sur les deux machines, l'autre est gardée en secours et visible dans la fiche du jeu, et M-21 s'affiche sur les deux écrans à l'ouverture du salon.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-17.

**CA-PF-057. Emplacements, moments et plafond déclarés par le jeu**
- Étant donné le jeu d'essai qui déclare 3 emplacements, un plafond de taille, les moments « fin de niveau », « sortie de partie » et « à la demande », et une sauvegarde automatique toutes les 2 min,
- quand chacun de ces moments survient pendant 10 min de jeu, puis que le jeu tente d'écrire une sauvegarde plus grosse que son plafond,
- alors seule la sauvegarde de l'emplacement choisi au salon est écrite (empreintes des deux autres inchangées), la sauvegarde automatique a lieu toutes les 2 min, à 5 s près, rien n'est écrit en dehors des moments déclarés, et l'écriture trop grosse est refusée, la version précédente restant intacte et le jeu recevant une erreur.
- Vérification: U, E. Jalon: alpha.

**CA-PF-058. Écriture impossible sur une machine**
- Étant donné un dossier de sauvegardes non inscriptible sur l'une des machines (droits retirés, ou disque plein simulé),
- quand le jeu sauvegarde,
- alors la partie continue, la machine concernée affiche M-22, l'autre machine a bien la nouvelle version, la version précédente de la machine en échec reste intacte, et sa copie est rattrapée à la connexion suivante une fois le dossier redevenu inscriptible.
- Vérification: E, EL. Jalon: alpha.

**CA-PF-059. Machine réinstallée ou remplacée**
- Étant donné un duo qui a des sauvegardes, un historique et des scores, et une machine B dont le dossier de données a été effacé (nouvel identifiant de machine, nouveau profil),
- quand B se connecte à A,
- alors A et B affichent M-23, et après confirmation sur les deux machines, B reçoit toutes les données du duo (mêmes empreintes que chez A), et la nouvelle machine B prend la place de l'ancienne dans l'historique et les scores.
- Vérification: EL. Jalon: alpha. Hypothèse: H-18.

**CA-PF-123. Remplacer une sauvegarde quand toutes les places sont prises**
- Étant donné un jeu dont tous les emplacements de sauvegarde sont pris,
- quand l'hôte choisit « Nouvelle partie »,
- alors Duo demande quel emplacement remplacer, puis confirme (M-33); après confirmation, la sauvegarde remplacée reste en copie de secours, visible dans la fiche du jeu, sur les deux machines; « Annuler » ne change rien (empreintes inchangées).
- Vérification: EL. Jalon: alpha.

**CA-PF-124. Sauvegarde écrite par une version plus récente du jeu**
- Étant donné une sauvegarde écrite par la version 1.1.0 d'un jeu, et un hôte qui n'a que la version 1.0.0,
- quand l'hôte choisit cette sauvegarde au salon,
- alors la version 1.0.0 ne la charge pas et ne l'écrase jamais (empreinte inchangée), M-34 propose de mettre le jeu à jour en une action, et après cette mise à jour la sauvegarde se charge.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-32.

### F08 Historique

**CA-PF-060. Partie terminée enregistrée**
- Étant donné une partie du jeu témoin menée à son terme, avec une pause de 20 s et une coupure de 10 s,
- quand l'écran de fin s'affiche,
- alors, en moins de 2 s, l'historique des deux machines contient une même nouvelle entrée avec le jeu, la date et l'heure de début (heure locale), la durée de jeu hors pause et hors attente de reconnexion (à 1 s près de la durée mesurée par le test), le résultat et le score de chaque joueur.
- Vérification: EL. Jalon: alpha. Hypothèse: H-19.

**CA-PF-061. Écran de l'historique**
- Étant donné un historique de 3 parties de deux jeux,
- quand on ouvre l'historique, puis qu'on filtre sur l'un des jeux,
- alors les parties s'affichent de la plus récente à la plus ancienne, chacune avec les informations de CA-PF-060, de façon identique sur les deux machines, et le filtre ne garde que les parties du jeu choisi.
- Vérification: E. Jalon: alpha.

**CA-PF-062. Parties interrompues**
- Étant donné une partie arrêtée avant la fin et une partie arrêtée par un plantage,
- quand on ouvre l'historique,
- alors les deux figurent avec le résultat « interrompue » et leur durée jouée, et ne changent pas le score cumulé.
- Vérification: EL. Jalon: alpha. Hypothèse: H-11.

**CA-PF-063. Rattrapage sans doublon**
- Étant donné 10 parties terminées, dont 5 avec une coupure du lien au moment de l'écriture de l'historique,
- quand les machines se sont reconnectées,
- alors les deux historiques contiennent exactement les 10 parties, sans doublon ni manque, dans le même ordre, et cette fusion est signalée une fois (M-21).
- Vérification: EL. Jalon: alpha.

**CA-PF-064. Gros historique**
- Étant donné un historique généré de 2 000 parties,
- quand on ouvre l'historique et qu'on le parcourt au clavier jusqu'à la dernière entrée (« Afficher 20 parties de plus » compris),
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
- alors le gain effectif de chaque catégorie vaut le volume général multiplié par celui de la catégorie, à 1 % près (lu par le crochet de test), le changement s'applique en moins de 100 ms pendant la lecture, 0 % donne un gain nul et le curseur indique « Coupé », Origine et Fin donnent 0 et 100 %, et chaque réglage ne touche que sa catégorie.
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
- alors la taille calculée du texte courant du lanceur est multipliée par ce facteur, à 1 px près, sans redémarrage; à 150 % dans la plus petite zone d'affichage (1280x640), aucune barre de défilement horizontale n'apparaît, la zone principale peut défiler verticalement, l'action principale de chaque écran reste visible sans défiler, et toutes les actions restent atteignables au clavier.
- Vérification: E. Jalon: alpha. Hypothèses: H-24, H-31.

**CA-PF-073. Touches affichées selon le clavier réel**
- Étant donné un jeu qui autorise la reconfiguration des touches,
- quand on ouvre ses touches dans les réglages,
- alors chaque action est listée avec sa touche, affichée selon la disposition réelle: l'action liée à la touche physique `KeyW` s'affiche « Z » sur un clavier AZERTY et « W » sur un clavier QWERTY; la pause figure avec Échap, marquée réservée.
- Vérification: E (disposition simulée), M (AZERTY réel du Mac et du PC). Jalon: alpha.

**CA-PF-074. Changer une touche**
- Étant donné la liste des touches d'un jeu,
- quand on choisit une action et qu'on presse une nouvelle touche,
- alors l'action prend cette touche, enregistrée par sa position physique (`KeyboardEvent.code`), et le jeu l'utilise dès la reprise ou la partie suivante; Échap annule la saisie sans rien changer; essayer d'attribuer Échap affiche M-24 et la saisie continue; une touche déjà prise par une autre action du même jeu fait proposer l'échange (M-24): « Échanger » permute les deux touches, « Annuler » ne change rien; « Rétablir les touches par défaut » demande confirmation, puis remet celles du manifeste.
- Vérification: U, E. Jalon: alpha. Hypothèse: H-25.

**CA-PF-075. Réglages illisibles ou impossibles à enregistrer**
- Étant donné un fichier de réglages tronqué, invalide, ou avec des valeurs hors limites; puis un dossier de réglages non inscriptible,
- quand Duo démarre, puis qu'on change un réglage,
- alors Duo démarre jusqu'à l'accueil sans plantage ni message bloquant, chaque réglage invalide reprend sa valeur par défaut, les réglages valides sont conservés, et le profil, les sauvegardes et l'historique ne sont pas modifiés (empreintes); le réglage changé s'applique quand même jusqu'à la fermeture de Duo, et M-22 dit qu'il n'a pas pu être enregistré.
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
- alors aucune demande d'autorisation d'administrateur (Contrôle de compte d'utilisateur) n'apparaît pendant l'installation, l'alerte SmartScreen est franchie comme le guide l'indique, et Duo apparaît dans le menu Démarrer et s'ouvre.
- Vérification: M; CI Windows (installation silencieuse, fichiers en place, lancement). Jalon: bêta.

**CA-PF-078. Guide d'installation**
- Étant donné le guide publié avec la version et lié depuis la page de téléchargement,
- quand on le relit,
- alors il donne, pour macOS et pour Windows: l'adresse de téléchargement; chaque alerte de sécurité avec le libellé exact des boutons à utiliser, y compris celle de macOS qui revient à chaque nouvelle version de Duo; comment savoir si Smart App Control est actif et comment le désactiver; la demande d'autorisation réseau et la réponse à donner, y compris la demande de droits d'administrateur de Windows; que faire après un refus; comment installer une nouvelle version; comment désinstaller. Il est en français, tutoie le lecteur et n'exige aucune ligne de commande.
- Vérification: D, M (les libellés du guide sont ceux qui apparaissent sur les machines du client). Jalon: bêta.

**CA-PF-079. Autorisation réseau expliquée avant la demande du système**
- Étant donné un premier lancement, profil créé,
- quand Duo s'apprête à utiliser le réseau pour la première fois,
- alors un écran de Duo (E03) explique la demande du système qui va suivre et la réponse à donner, sous Windows après avoir vérifié le type de réseau (CA-PF-014), et Duo n'ouvre aucune socket réseau avant que cet écran ait été validé (relevé des appels système `bind`, `listen`, `connect` et `sendto`).
- Vérification: E (`strace`), M (ordre des fenêtres sur les deux machines). Jalon: bêta.

**CA-PF-080. Premier lancement jusqu'à voir l'autre machine**
- Étant donné deux machines où Duo vient d'être installé pour la première fois,
- quand chaque joueur suit seulement les écrans de Duo (profil, autorisations) et ceux du système,
- alors chacun voit l'autre machine (E04 « trouvé ») en moins de 5 min par machine, sans aide extérieure et sans redémarrer Duo après avoir répondu aux fenêtres du système.
- Vérification: M. Jalon: bêta. Hypothèse: H-26.

**CA-PF-081. Nouvelle version installée par-dessus**
- Étant donné Duo en version N avec un profil, des réglages, des sauvegardes, un historique et des jeux ajoutés,
- quand on installe la version N+1 par-dessus, selon le guide,
- alors tout est conservé à l'identique (empreintes des sauvegardes, nombre d'entrées de l'historique, réglages, jeux installés), toute migration du format des données se fait sans perte, et chaque machine voit de nouveau l'autre en moins de 5 min en suivant seulement les écrans de Duo et du système (macOS peut redemander l'autorisation du réseau local).
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

**CA-PF-127. Avis de nouvelle version de Duo**
- Étant donné une version de Duo plus récente publiée sur la page de téléchargement,
- quand Duo démarre avec Internet, puis sans Internet, puis qu'une partie est en cours au moment où la nouvelle version est publiée,
- alors, avec Internet, M-35 annonce la nouvelle version en moins de 10 s sans bloquer le lanceur; sans Internet, rien ne s'affiche à ce sujet; pendant la partie, aucun avis n'apparaît avant le retour au salon.
- Vérification: E (fichier de version servi localement), M (la bêta annonce la 1.0). Jalon: alpha.

### F12 Nouveaux jeux

**CA-PF-084. Nouveau jeu sans réinstaller Duo**
- Étant donné Duo en version N relié à Internet, et un nouveau jeu publié dans le catalogue,
- quand Duo démarre, ou qu'on choisit « Chercher de nouveaux jeux »,
- alors le jeu est téléchargé, vérifié (empreinte SHA-256 et signature) et installé sans autre action, la notification « Nouveau jeu » s'affiche, et le jeu se lance depuis la bibliothèque sans réinstaller ni redémarrer Duo; la version de Duo reste N.
- Vérification: E (catalogue et paquets servis localement, signés avec la clé de test), M (jeu réellement publié). Jalon: alpha. Hypothèse: H-28.

**CA-PF-085. Mise à jour d'un jeu sans perdre ses sauvegardes**
- Étant donné un jeu installé en 1.0.0 avec deux sauvegardes du duo, et sa version 1.1.0 publiée,
- quand Duo trouve la mise à jour,
- alors le jeu passe en 1.1.0 sans réinstaller Duo, ses deux sauvegardes restent listées et se chargent (après la migration éventuelle fournie par le jeu), et leurs versions d'avant la mise à jour sont gardées en secours.
- Vérification: E. Jalon: alpha.

**CA-PF-086. Paquet abîmé ou falsifié**
- Étant donné un paquet dont l'empreinte ne correspond pas au catalogue, puis un paquet d'empreinte juste mais de signature invalide,
- quand Duo l'installe,
- alors le paquet est refusé et supprimé, aucun de ses fichiers n'est utilisé, la version précédente du jeu, s'il y en avait une, reste jouable, M-25 s'affiche, et Duo recommence de lui-même au plus 3 fois de suite avant d'attendre « Réessayer maintenant ».
- Vérification: E. Jalon: alpha. Hypothèse: H-28.

**CA-PF-087. Téléchargement interrompu ou disque plein**
- Étant donné un téléchargement de jeu en cours,
- quand la connexion est coupée à 50 %, ou que Duo est fermé, ou que le disque est plein,
- alors aucun jeu partiel n'apparaît dans la bibliothèque, la version précédente reste jouable, M-25 s'affiche (avec la place qui manque pour le disque plein), et une nouvelle tentative aboutit une fois la cause levée.
- Vérification: E. Jalon: alpha.

**CA-PF-088. Sans Internet, aucune gêne**
- Étant donné une machine reliée au réseau local mais sans accès à Internet,
- quand Duo démarre et qu'on ouvre la bibliothèque,
- alors aucune fenêtre ni aucun message bloquant n'apparaît, le lanceur s'affiche au plus 1 s plus tard qu'avec Internet, et seule la mention M-26 signale que la recherche de nouveaux jeux n'a pas pu se faire.
- Vérification: EL. Jalon: alpha. Hypothèse: H-28.

**CA-PF-089. Aucune installation pendant une partie**
- Étant donné un salon ouvert ou une partie en cours avec le jeu X, et une mise à jour de X disponible,
- quand la recherche de nouveaux jeux la trouve,
- alors rien n'est installé avant le retour à la bibliothèque, un message dit que la mise à jour s'installera à la fin de la partie, et la partie n'est pas interrompue.
- Vérification: E. Jalon: alpha.

### F13 Compatibilité

**CA-PF-090. Versions de Duo différentes**
- Étant donné A et B dont les versions de Duo diffèrent (versions simulées par le crochet de test), d'abord avec le même protocole de session, puis avec des protocoles différents,
- quand les deux machines se voient,
- alors, avec le même protocole, elles jouent ensemble comme si leurs versions étaient égales; avec des protocoles différents, l'accueil des deux machines affiche M-27 en moins de 3 s, avant toute invitation, M-27 désigne la machine de version la plus ancienne comme celle à mettre à jour, et aucune invitation ne peut être acceptée ni aucune connexion par adresse aboutir.
- Vérification: U, EL. Jalon: alpha. Hypothèse: H-29.

**CA-PF-091. Jeu plus ancien chez l'invité**
- Étant donné le jeu X en 1.1.0 chez A, qui héberge, et en 1.0.0 chez B, sans Internet,
- quand A ouvre un salon avec X,
- alors l'invitation de B propose de mettre à jour et de rejoindre (M-28) en une seule action; celle-ci copie la 1.1.0 depuis A par le réseau local, vérifie sa signature, l'installe en affichant la progression chez les deux, puis fait entrer B dans le salon, prêt, sans autre action; la 1.1.0 de B a la même empreinte que celle d'A.
- Vérification: EL. Jalon: alpha. Hypothèses: H-29, H-32.

**CA-PF-092. Jeu absent chez l'invité**
- Étant donné le jeu X installé chez A seulement, sans Internet,
- quand A ouvre un salon avec X,
- alors l'invitation de B propose d'installer et de rejoindre (M-28) en une seule action, avec la taille du jeu, et la suite est celle de CA-PF-091.
- Vérification: EL. Jalon: alpha. Hypothèse: H-32.

**CA-PF-093. Données d'une version plus récente de Duo**
- Étant donné un dossier de données écrit par une version plus récente de Duo, dans un format plus récent,
- quand une version plus ancienne démarre dessus,
- alors elle ne modifie aucune donnée (empreintes inchangées) et affiche M-29.
- Vérification: E. Jalon: alpha.

**CA-PF-125. Jeu plus ancien chez l'hôte**
- Étant donné le jeu X en 1.0.0 chez A, qui héberge, et en 1.1.0 chez B, sans Internet,
- quand A ouvre un salon avec X et que B le voit,
- alors la 1.0.0 n'est jamais jouée ensemble: les deux écrans affichent M-28, qui désigne A comme la machine à mettre à jour, et une seule action chez A copie la 1.1.0 depuis B par le réseau local, vérifie sa signature et l'installe; la partie se joue ensuite en 1.1.0 des deux côtés.
- Vérification: EL. Jalon: alpha. Hypothèse: H-32.

**CA-PF-126. Copie d'un jeu interrompue ou falsifiée**
- Étant donné une copie de jeu en cours d'une machine à l'autre par le réseau local,
- quand le lien est coupé à 50 % de la copie; puis, dans un second essai, quand un appareil qui se fait passer pour l'hôte envoie un paquet de signature invalide,
- alors aucun jeu partiel n'est installé, la version déjà présente reste jouable, M-25 s'affiche sur la machine qui reçoit, la copie reprend d'elle-même au retour du lien, et le paquet falsifié est refusé.
- Vérification: EL. Jalon: alpha.

## 5. Critères transverses

### Zéro friction (pilier 1)

**CA-PF-094. Une partie en moins d'une minute**
- Étant donné les deux machines allumées et sur le même réseau depuis plus de 2 min, Duo fermé des deux côtés, profils déjà créés, jeu témoin installé,
- quand les deux joueurs ouvrent Duo, que l'un héberge le jeu témoin, que l'autre rejoint, et que les deux se déclarent prêts,
- alors la partie démarre moins de 60 s après le premier double-clic d'ouverture, sans aucun réglage réseau ni saisie d'adresse, et le temps machine est de 15 s au plus: 4 essais sur 4, avec pour hôte le Mac, puis le PC, puis le Mac, puis le PC.
- Vérification: M (chronomètre et journal); EL (même parcours automatisé en moins de 20 s, garde-fou de non-régression). Jalon: 1.0, avec une mesure pour information dès le prototype.

### Performances

**CA-PF-095. 60 images par seconde dans le lanceur**
- Étant donné le PC du client (machine de référence), Duo en plein écran à la définition native de l'écran et à la mise à l'échelle de Windows en usage, l'affichage des performances activé,
- quand on enchaîne, pendant 60 s chacun, trois scénarios: parcours de toute la bibliothèque au clavier; salon ouvert avec changements d'état et invitations; réglages avec changements de volume,
- alors chaque scénario donne une moyenne d'au moins 58 images par seconde, au moins 99 % des intervalles entre deux images à 20 ms ou moins, et aucun intervalle au-delà de 34 ms après les 5 premières secondes.
- Vérification: M (l'environnement cloud dessine par logiciel, ses mesures ne valent pas). Jalon: bêta, avec une mesure pour information dès le prototype (banc de mesure de l'architecture). Hypothèse: H-30.

**CA-PF-096. 60 images par seconde dans le jeu témoin**
- Étant donné les conditions de CA-PF-095,
- quand on joue 2 min au jeu témoin avec le PC comme hôte, puis 2 min avec le PC comme invité,
- alors les seuils de CA-PF-095 sont tenus sur le PC.
- Vérification: M. Jalon: bêta. Hypothèse: H-30.

**CA-PF-128. Mémoire**
- Étant donné le PC du client et l'affichage des performances,
- quand Duo reste 1 min sur l'accueil, puis pendant 2 min de jeu témoin,
- alors la mémoire de Duo, tous processus compris, est de 350 Mo au plus au repos et de 1 Go au plus en partie.
- Vérification: M; E (même mesure sous Linux, garde-fou). Jalon: bêta. Hypothèse: H-30.

**CA-PF-129. Démarrage et chargement**
- Étant donné le PC et le Mac du client, Duo fermé depuis au moins 1 min,
- quand on lance Duo, puis une partie du jeu témoin,
- alors le lanceur est utilisable 3 s au plus après le double-clic (6 s si le disque du PC est un disque dur), et le jeu est jouable 5 s au plus après la fin du compte à rebours, sur les deux machines (horodatages du journal).
- Vérification: M; EL (garde-fou, non représentatif). Jalon: bêta. Hypothèse: H-30.

### Sans Internet

**CA-PF-097. Tout fonctionne sans Internet**
- Étant donné les deux machines sur un réseau local sans accès à Internet,
- quand on enchaîne le parcours complet: démarrage, découverte, salon, partie du jeu témoin avec sauvegarde, pause, fin, historique, scores, réglages,
- alors chaque étape réussit, et Internet n'est mentionné que par M-26.
- Vérification: EL (réseau virtuel sans route vers Internet), M (box débranchée d'Internet, Wi-Fi gardé). Jalon: prototype en EL, 1.0 chez le client.

**CA-PF-098. Aucune sortie hors du réseau local**
- Étant donné le parcours de CA-PF-097 dans le réseau local virtuel, avec une route par défaut vers une passerelle piège qui compte et jette tout paquet destiné à une adresse hors du réseau local, et sans aucune variable de mandataire HTTP,
- quand le parcours se déroule une fois avec la recherche de nouveaux jeux et de nouvelles versions désactivée par le crochet de test, puis une fois avec cette recherche active,
- alors la passerelle piège compte 0 paquet sur tout le premier parcours, et 0 paquet entre l'ouverture du salon et le retour à la bibliothèque dans le second; de plus, l'application construite ne contient aucune adresse http ou https vers un hôte extérieur autre que celles du catalogue des jeux et des versions de Duo.
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
- Étant donné un dossier personnel et un dossier de données aux chemins de test (section 1.4), puis les mêmes en Unicode décomposé (NFD),
- quand on enchaîne création du profil, partie avec sauvegarde, historique, réglages, ajout d'un jeu et enregistrement d'un rapport pour le studio,
- alors chaque écriture et chaque relecture réussit, les données relues sont identiques, et rien n'est écrit hors du dossier personnel de test et du dossier temporaire du système.
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
- alors Duo reste ouvert, chaque retour au salon respecte le délai de CA-PF-039, une onzième partie, avec le jeu témoin, va jusqu'à son écran de fin sans aucun message d'erreur, et la mémoire de Duo après le dixième cycle dépasse de moins de 20 Mo celle mesurée après le deuxième.
- Vérification: E. Jalon: alpha.

**CA-PF-104. Dix lancements et sorties sans fuite**
- Étant donné Duo ouvert,
- quand on enchaîne 10 fois: lancer le jeu témoin, jouer 30 s, l'arrêter par le menu de pause,
- alors CA-PF-043 est satisfait après chaque sortie, la mémoire de Duo après le dixième cycle dépasse de moins de 20 Mo celle mesurée après le deuxième, et la vue de la plateforme ne grossit pas de plus de 10 %.
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

Les cas de base sont décrits en F13 (CA-PF-090 à CA-PF-093, CA-PF-125, CA-PF-126) et en F07 (CA-PF-124); ce critère couvre toutes les combinaisons.

**CA-PF-107. Toutes les combinaisons de versions**
- Étant donné les combinaisons suivantes: protocole de session identique ou différent; API du pont de chaque machine suffisante ou non pour le SDK exigé par le jeu; jeu identique, plus ancien chez l'invité, plus ancien chez l'hôte, ou absent chez l'invité; jeu en lockstep avec des versions d'Electron différentes,
- quand les deux machines tentent de jouer ensemble,
- alors elles jouent dès que le protocole est identique, que l'API de chaque machine suffit, que le jeu est le même des deux côtés (au besoin après copie) et, pour un jeu en lockstep, que les versions d'Electron sont égales; chaque autre combinaison affiche sur les deux machines le message prévu (M-13, M-27 ou M-28), sans plantage ni salon bloqué; aucune sauvegarde n'est lue ni écrite par une version plus ancienne du jeu que celle qui l'a écrite.
- Vérification: U (toutes les combinaisons), EL (au moins une par message). Jalon: alpha. Hypothèses: H-29, H-32.

### Accessibilité

**CA-PF-108. Contrastes**
- Étant donné chaque écran du lanceur et chaque surcouche de la plateforme (pause, résultats, notifications, messages), dans chacun de ses états (repos, survol, focus, erreur), aux tailles d'interface 100 % et 150 %,
- quand on mesure les contrastes,
- alors tout texte atteint au moins 4,5:1 sur son fond (3:1 pour un texte d'au moins 24 px, ou d'au moins 18,66 px en gras), et les composants d'interface et graphismes porteurs d'information au moins 3:1 contre les couleurs adjacentes (WCAG 2.2, critères 1.4.3 et 1.4.11, éléments désactivés exemptés).
- Vérification: E (axe-core, outil de test sous licence MPL-2.0, non livré, plus un script qui mesure les états de survol et de focus). Jalon: bêta.

**CA-PF-109. Couleurs des joueurs distinctes pour les daltoniens**
- Étant donné la palette des six couleurs de joueurs,
- quand on calcule, pour chaque paire de couleurs, l'écart CIEDE2000 en vision normale, puis après simulation de la protanopie, de la deutéranopie et de la tritanopie (méthode de Machado, Oliveira et Fernandes, 2009, sévérité 1,0, en RVB linéaire),
- alors l'écart est d'au moins 20 en vision normale et d'au moins 10 après chaque simulation. Ces seuils sont atteignables: la palette de référence d'Okabe et Ito obtient au pire 21,7 et 10,9 (calcul du 2026-10-30).
- Vérification: U (calcul sur les jetons de couleur). Jalon: bêta. Hypothèse: H-02.

**CA-PF-110. Jamais la couleur seule**
- Étant donné chaque écran où apparaissent des joueurs ou des états (salon, invitation, résultats, historique, scores, pause, déconnexion),
- quand on l'affiche,
- alors chaque marque de couleur d'un joueur est accompagnée de son symbole et de son pseudo écrit, et chaque état (prêt, pas prêt, connecté, déconnecté, erreur) est dit par un texte, ou par une icône munie d'un nom accessible, en plus de la couleur (WCAG 1.4.1).
- Vérification: E (contrôle automatique de la page affichée, et captures converties en niveaux de gris examinées). Jalon: alpha.

**CA-PF-111. Tout au clavier seul**
- Étant donné un test qui n'émet aucun événement de souris,
- quand on enchaîne au clavier le parcours complet: premier lancement, profil, héberger, rejoindre par invitation et par adresse IP, se déclarer prêt, jouer, mettre en pause, reprendre, arrêter, finir une partie, historique, scores, réglages (volumes, touches, affichage), chaque message d'erreur avec son bouton,
- alors chaque étape se réalise avec Tab, Maj+Tab, les flèches, Entrée, Espace et Échap; aucun piège de focus (WCAG 2.1.2), les fenêtres de confirmation gardant le focus tant qu'elles sont ouvertes; Échap ferme la couche du dessus (fenêtre, panneau, puis écran), reste sans effet sur l'accueil et ne quitte jamais Duo; à l'ouverture d'un écran, le focus est sur l'élément « Focus par défaut » de la liste des écrans de la spécification UX (section 10); l'ordre de tabulation suit l'ordre de lecture de la spécification UX (barre du haut, puis contenu de haut en bas et de gauche à droite).
- Vérification: E (script Playwright sans souris), M (sur les deux machines). Jalon: alpha.

**CA-PF-112. Focus toujours visible**
- Étant donné chaque élément qui peut recevoir le focus,
- quand il le reçoit au clavier,
- alors un indicateur de focus apparaît, d'au moins 2 px CSS d'épaisseur à la taille d'interface 100 %, avec un contraste d'au moins 3:1 entre les pixels de la zone avec et sans focus, sans jamais être caché par un autre élément (WCAG 2.4.7 et 2.4.11), y compris dans les listes qui défilent; quand l'élément qui a le focus disparaît, le focus passe à l'élément suivant logique, jamais au document entier.
- Vérification: E (comparaison automatique de captures avec et sans focus). Jalon: alpha pour la présence, bêta pour l'épaisseur et le contraste.

**CA-PF-121. Pas de double appui accidentel**
- Étant donné un changement d'écran, puis une touche Entrée maintenue enfoncée,
- quand on appuie sur Entrée ou sur Espace moins de 300 ms après l'affichage du nouvel écran, puis qu'on laisse la répétition automatique du clavier envoyer Entrée,
- alors l'appui précoce est ignoré, et la répétition automatique n'active aucun bouton; en particulier, deux Entrée à 100 ms d'intervalle sur l'invitation laissent B dans le salon, déclaré prêt.
- Vérification: E. Jalon: alpha.

**CA-PF-122. Réduire les animations**
- Étant donné le système réglé pour réduire les animations, puis la case « Réduire les animations » des réglages,
- quand Duo démarre pour la première fois, puis qu'on coche et décoche la case,
- alors au premier démarrage la case suit le réglage du système; case cochée, les transitions entre écrans n'ont aucune durée et le compte à rebours ne fait que changer de chiffre; la valeur est transmise aux jeux par le SDK.
- Vérification: E (réglage du système simulé par `prefers-reduced-motion`), M. Jalon: alpha.

### Affichage

**CA-PF-113. Lisible de 1366x768 à l'écran Retina**
- Étant donné chaque zone d'affichage de référence (section 1.4), en fenêtre et en plein écran, à la taille d'interface 100 %, avec les textes les plus longs (pseudo de seize « W », description de la longueur maximale admise par le manifeste, messages),
- quand on affiche chaque écran du lanceur et chaque surcouche,
- alors aucun texte n'est coupé ni ne déborde de son élément (contrôle automatique: largeur de défilement au plus égale à la largeur visible), aucun élément n'en recouvre un autre, et aucune barre de défilement horizontale n'apparaît; à partir de 1280x720, aucun défilement n'est nécessaire; dans les zones plus petites (1280x640, 1366x688), la zone principale peut défiler verticalement, mais l'action principale de chaque écran reste visible sans défiler.
- Vérification: E (contrôle automatique, captures examinées), M (écrans réels). Jalon: alpha. Hypothèse: H-31.

**CA-PF-114. Images nettes sur écran Retina**
- Étant donné le facteur d'échelle 2,
- quand on affiche chaque écran du lanceur,
- alors chaque image matricielle affichée (vignettes, icônes) a une définition au moins double de sa taille affichée en pixels CSS, dans chaque dimension, ou bien elle est vectorielle.
- Vérification: E. Jalon: bêta.

### Langue

**CA-PF-115. Français, tutoiement et typographie**
- Étant donné tous les textes visibles de la plateforme: écrans, messages, info-bulles, menus de l'application, boîtes de dialogue ouvertes par Duo,
- quand on les relève (fichier des textes, puis textes affichés sur chaque écran du parcours complet),
- alors ils sont tous en français; le joueur est tutoyé (décision Q2), et chaque occurrence de « vous » figure dans la liste, tenue avec le fichier des textes, des phrases adressées aux deux joueurs ensemble; une espace insécable (U+00A0) précède « : » et borde l'intérieur des guillemets « », une espace fine insécable (U+202F) précède « ; », « ! », « ? » et « % »; les points de suspension tiennent en un caractère (…) et l'apostrophe est typographique (’); aucun tiret cadratin ni demi-cadratin; aucune des formes accordées au genre de la liste « À éviter » de la spécification UX (section 0.2); aucun texte anglais ne subsiste, y compris dans le menu de l'application sous macOS.
- Vérification: U (contrôle du fichier des textes), E (textes affichés), M (menus du système sur les deux machines). Jalon: alpha.

### Réseau dégradé et endurance

**CA-PF-116. Réseau dégradé de référence**
- Étant donné le profil réseau R1 entre les deux machines,
- quand deux robots jouent au jeu témoin pendant 10 min,
- alors aucune pause de déconnexion ne se déclenche, l'état reste synchronisé (empreintes identiques à chaque contrôle, au moins un par seconde), et la pause, la reprise et la sauvegarde respectent CA-PF-035, CA-PF-036 et CA-PF-051.
- Vérification: EL (pertes réelles par nftables, latence et gigue par le mandataire de perturbation). Jalon: alpha.

**CA-PF-117. Endurance de deux heures**
- Étant donné deux robots qui enchaînent des parties du jeu témoin pendant 2 h, avec une coupure de 10 s toutes les 15 min,
- quand l'essai se termine,
- alors aucun plantage ni aucune désynchronisation n'est survenu, chaque partie figure une fois dans l'historique des deux machines, et la mémoire de chaque Duo dépasse de moins de 50 Mo celle mesurée après la première partie.
- Vérification: EL. Jalon: bêta.

## 6. Prérequis de testabilité

À prévoir dans l'architecture dès le prototype, faute de quoi les critères ci-dessus ne peuvent pas être vérifiés automatiquement.

1. **Deux instances sur une machine**: dossier de données et ports imposés en ligne de commande (déjà prévu par l'architecture, section 12), verrou d'instance unique pris après le choix du dossier de données, pour que deux instances de test coexistent.
2. **Identifiants de test**: un attribut stable sur chaque élément interactif, et l'identifiant M-xx sur chaque message.
3. **Mode test**, absent ou inactif dans les versions publiées: empreinte de l'état du jeu et rythme de sa simulation; retard ou blocage de la copie des sauvegardes; versions simulées de l'application, du protocole, de l'API du pont et des jeux; adresses du catalogue des jeux et du fichier de version de Duo; désactivation de ces recherches; clé de signature de test, acceptée seulement par les versions de test; période de la sauvegarde automatique réglable; compteurs de ressources (contextes WebGL et audio, processus du jeu); gains audio effectifs par catégorie; état du blocage de la mise en veille; appels au Dock et à la barre des tâches; ramasse-miettes forcé; robots qui jouent au jeu témoin.
4. **Jeux d'essai**, réservés aux tests et signés avec la clé de test: un affrontement et une coopération minimaux; un jeu à 3 emplacements, aux trois moments de sauvegarde, à sauvegarde automatique et à plafond de taille; un jeu à sauvegarde de 20 Mo; un jeu à sessions sans fin de partie; un jeu qui plante sur commande selon les quatre modes de CA-PF-039 ou échoue à son chargement; un paquet au manifeste invalide; un jeu qui exige un SDK plus récent; deux versions d'un même jeu, la plus récente avec un format de sauvegarde plus récent.
5. **Journal local** horodaté des événements de session (présence, salon, prêt, démarrage, pause, coupure, reprise, sauvegarde, copie) et des erreurs, sur chaque machine, repris dans le rapport pour le studio (CA-PF-132): c'est lui qui fournit les délais et le temps machine mesurés chez le client.
6. **Affichage des performances**, activable sans ligne de commande et indiqué dans le guide, qui donne la moyenne d'images par seconde, la part des intervalles à 20 ms ou moins, le plus long intervalle sur les 60 dernières secondes, et la mémoire de Duo.
7. **Banc réseau virtuel**, outillé par qa-testeur avec dev-reseau: espaces de noms reliés par un pont, passerelle piège, pertes par nftables, latence par mandataire. Chaque pilote Playwright doit tourner dans l'espace de noms de son instance, car Playwright joint Electron par la boucle locale; les tests retirent les variables de mandataire HTTP de l'environnement cloud, que Chromium suivrait sinon (constaté).

## 7. Traçabilité

### 7.1 Fonctions du cahier vers les critères

| Fonction | Critères | Modes | Premier jalon | Hypothèses |
|---|---|---|---|---|
| F01 Profil | CA-PF-001 à CA-PF-006 | U, E, EL | alpha | H-01, H-02, H-03 |
| F02 Découverte et connexion | CA-PF-007 à CA-PF-021, CA-PF-118, CA-PF-119, CA-PF-131 | U, E, EL, CI, M | prototype (007, 008, 010, 118) | H-04 à H-07, H-34, H-35 |
| F03 Salon | CA-PF-022 à CA-PF-028, CA-PF-120 | U, E, EL, M | prototype (022, 023, 024) | H-08 |
| F04 Bibliothèque | CA-PF-029 à CA-PF-032 | U, E, EL | alpha | H-20, H-21 |
| F05 Cycle de vie d'un jeu | CA-PF-033 à CA-PF-043, CA-PF-130, CA-PF-132 | E, EL, M | prototype (033, 037) | H-09 à H-13, H-33 |
| F06 Déconnexion | CA-PF-044 à CA-PF-050 | EL, M | alpha | H-09, H-14, H-15 |
| F07 Sauvegardes | CA-PF-051 à CA-PF-059, CA-PF-123, CA-PF-124 | U, E, EL, CI, M | alpha | H-16, H-17, H-18, H-32 |
| F08 Historique | CA-PF-060 à CA-PF-065 | E, EL | alpha | H-11, H-19, H-20 |
| F09 Score cumulé | CA-PF-066 à CA-PF-068 | U, E | alpha | H-11, H-21 |
| F10 Réglages | CA-PF-069 à CA-PF-075 | U, E, EL, M | alpha | H-22 à H-25 |
| F11 Installation | CA-PF-076 à CA-PF-083, CA-PF-127 | E, CI, D, M | alpha (083, 127), bêta | H-26, H-27 |
| F12 Nouveaux jeux | CA-PF-084 à CA-PF-089 | E, EL, M | alpha | H-28 |
| F13 Compatibilité | CA-PF-090 à CA-PF-093, CA-PF-125, CA-PF-126, CA-PF-107 | U, E, EL | alpha | H-29, H-32 |

### 7.2 Exigences transverses vers les critères

| Exigence | Source | Critères |
|---|---|---|
| Une partie en moins d'une minute | cahier, pilier 1 | CA-PF-094, CA-PF-120 |
| 60 images par seconde, mémoire et temps sur la machine de référence | cahier, section 6; architecture, 13.2 | CA-PF-095, CA-PF-096, CA-PF-128, CA-PF-129 |
| Sans Internet | cahier, section 6 et F12 | CA-PF-097, CA-PF-098, CA-PF-088 |
| Clavier AZERTY | cahier, section 1 | CA-PF-099, CA-PF-100, CA-PF-073, CA-PF-010 |
| Noms d'utilisateur et chemins avec espaces et accents | règles techniques du studio (`CLAUDE.md`) | CA-PF-101, CA-PF-102 |
| Reprise après le plantage d'un jeu | cahier, F05 | CA-PF-039, CA-PF-103, CA-PF-104 |
| Coupure du réseau pendant une sauvegarde | cahier, section 4 | CA-PF-105, CA-PF-106, CA-PF-055 |
| Versions incompatibles | cahier, F13 | CA-PF-107, CA-PF-090 à CA-PF-093, CA-PF-124 à CA-PF-126 |
| Contraste | absent du cahier v0.2, demandé par le manager et par la spécification UX (à ajouter en section 5) | CA-PF-108, CA-PF-112 |
| Daltonisme | absent du cahier v0.2, demandé par le manager et par la spécification UX (à ajouter en section 5) | CA-PF-109, CA-PF-110 |
| Navigation au clavier seul | cahier, section 5; UX 0.5 | CA-PF-111, CA-PF-112, CA-PF-121, CA-PF-122 |
| Lisible de 1366x768 à Retina | cahier, section 5; UX 0.8 | CA-PF-113, CA-PF-114, CA-PF-072 |
| Interface en français | cahier, section 5 et Q2; UX 0.1 à 0.3 | CA-PF-115 |
| Aucune perte en cas de plantage ou de coupure | cahier, section 4 | CA-PF-053, CA-PF-054, CA-PF-058, CA-PF-105, CA-PF-106 |
| Réseau dégradé, endurance | cahier, F05 et F06; architecture, 13.2 | CA-PF-116, CA-PF-117 |

### 7.3 Parcours du cahier vers les critères

| Parcours (section 2 du cahier) | Critères |
|---|---|
| 1. Premier lancement | CA-PF-001, CA-PF-002, CA-PF-003, CA-PF-006, CA-PF-079, CA-PF-080, CA-PF-118 |
| 2. Lancer une partie | CA-PF-007, CA-PF-008, CA-PF-022 à CA-PF-026, CA-PF-033, CA-PF-094, CA-PF-120, CA-PF-131 |
| 3. Jouer | CA-PF-035, CA-PF-036, CA-PF-040, CA-PF-041, CA-PF-044 à CA-PF-050, CA-PF-130 |
| 4. Finir | CA-PF-037, CA-PF-060, CA-PF-066 |
| 5. Consulter | CA-PF-061, CA-PF-066, CA-PF-067, CA-PF-068 |
| 6. Régler | CA-PF-004, CA-PF-069 à CA-PF-075, CA-PF-122 |
| 7. Recevoir un nouveau jeu | CA-PF-084 à CA-PF-089, CA-PF-091, CA-PF-092 |

### 7.4 Couverture par mode

| Mode | Nombre de critères qui l'emploient |
|---|---|
| Automatique dans le cloud (U, E ou EL) | 120 |
| CI macOS ou Windows | 8 (CA-PF-013, 053, 076, 077, 081, 082, 101, 102) |
| Relecture de document (D) | 1 (CA-PF-078) |
| Chez le client (M) | 56 |
| Sans aucun mode automatique dans le cloud | 12: chez le client seulement, CA-PF-014, 015, 016, 080, 095, 096; chez le client et en CI, CA-PF-013, 076, 077, 082, 102; chez le client et par relecture, CA-PF-078 |

Premier jalon d'exigence: 10 critères au prototype, 100 à l'alpha, 21 à la bêta, 1 à la 1.0; tous doivent être satisfaits à la 1.0.

## 8. À tester chez le client (jalon 1.0)

À faire à deux, chacun sur son ordinateur, à la maison: compter une heure et demie. Pour chaque point, noter « OK » ou ce qui s'est passé; une photo de l'écran aide beaucoup. À la fin, enregistrer le rapport pour le studio (Réglages > À propos) sur chaque ordinateur et l'envoyer avec les notes. Les numéros entre parenthèses renvoient aux critères: inutile de les lire.

- [ ] 1. **Installer** Duo 1.0 sur le Mac et sur le PC en suivant le guide, par-dessus la bêta si elle est là: en ouvrant la bêta juste avant, elle doit annoncer la nouvelle version. Après l'installation, double-cliquer encore une fois sur l'icône de Duo. Attendu: Duo s'ouvre après l'alerte de sécurité, sans mot de passe administrateur sur le PC; profils, sauvegardes, historique et scores de la bêta sont toujours là; le second double-clic ramène la même fenêtre. Si le Mac redemande l'autorisation du réseau local, l'accepter et le noter. (CA-PF-076, 077, 078, 081, 083, 127)
- [ ] 2. **Premier lancement**, seulement sur un ordinateur où Duo n'a jamais été installé: créer son profil, accepter l'autorisation réseau (Windows peut demander l'accord d'un administrateur: répondre « Oui »). Attendu: Duo explique la demande avant qu'elle n'apparaisse, et chacun voit l'autre ordinateur en moins de 5 minutes, sans aide. (CA-PF-079, 080, 118)
- [ ] 3. **Lancer une partie** du jeu témoin, Duo fermé au départ, chronomètre en main, quatre fois: le Mac héberge, puis le PC, puis le Mac, puis le PC. Une fois, laisser Duo en arrière-plan chez celui qui rejoint. Une cinquième fois, rejoindre en tapant l'adresse affichée chez l'hôte. Attendu: l'invitation arrive toute seule (l'icône de Duo bouge si Duo est en arrière-plan); l'hôte n'appuie que 3 fois sur Entrée, l'autre une seule; la partie commence en moins d'une minute; l'adresse tapée marche aussi. (CA-PF-007, 008, 010, 022, 023, 024, 094, 120, 131)
- [ ] 4. **Jouer**: pendant une partie, appuyer sur Échap, puis choisir « Reprendre » sur les deux ordinateurs; tenir une touche de déplacement et passer à une autre fenêtre (Alt+Tab ou Cmd+Tab); réduire la fenêtre de Duo 30 secondes; aller jusqu'à la fin; dans une autre partie, fermer Duo en plein jeu. Attendu: la pause s'affiche chez les deux, la reprise suit un décompte; le personnage s'arrête au changement de fenêtre; la partie continue quand la fenêtre est réduite; les résultats sont les mêmes chez les deux; Duo demande confirmation avant de fermer, et l'autre ordinateur revient au salon. (CA-PF-035, 036, 037, 040, 041, 042)
- [ ] 5. **Coupures**: couper le Wi-Fi d'un ordinateur 30 secondes pendant une partie, puis le remettre; recommencer en fermant le couvercle (ou en mettant l'ordinateur en veille) 1 minute; enfin, Wi-Fi coupé, ouvrir l'accueil. Attendu: pause des deux côtés; Duo retrouve l'autre tout seul, et après « Reprendre » des deux côtés, la partie repart là où elle en était; sans Wi-Fi, Duo dit qu'il n'y a pas de réseau, puis retrouve l'autre quand le Wi-Fi revient. (CA-PF-017, 044, 046, 050)
- [ ] 6. **Sauvegarde croisée**: jouer jusqu'à une sauvegarde quand le Mac héberge, quitter, puis reprendre cette sauvegarde quand le PC héberge. Attendu: on repart exactement au même endroit. (CA-PF-051, 052)
- [ ] 7. **Son**: pendant une partie, baisser puis remonter chacun des quatre volumes, sur chaque ordinateur, avec les haut-parleurs puis avec un casque si possible. Attendu: chaque réglage change seulement son type de son; à 0, on ne l'entend plus. (CA-PF-069)
- [ ] 8. **Clavier**: regarder les touches du jeu témoin dans les réglages, puis jouer; taper « Gaëlle » et « Jérôme » comme pseudo; enfin, lancer une partie sans toucher la souris (Tab, flèches, Entrée, Échap). Attendu: les touches affichées sont celles du clavier (Z, Q, S, D) et elles marchent; les accents s'écrivent; tout se fait au clavier. (CA-PF-073, 099, 100, 111)
- [ ] 9. **Écran et langue**: passer en plein écran puis en fenêtre, sur chaque ordinateur; cocher « Réduire les animations »; ouvrir les menus de Duo en haut de l'écran du Mac. Attendu: tout est lisible, rien n'est coupé; les animations disparaissent; tout est en français, menus compris. (CA-PF-071, 113, 115, 122)
- [ ] 10. **Fluidité sur le PC**: afficher le compteur d'images (raccourci donné dans le guide), passer 1 minute dans la bibliothèque, 1 minute dans le salon et 1 minute dans les réglages, puis jouer 2 minutes comme hôte et 2 minutes comme invité. Photographier le compteur après chaque minute. Attendu: au moins 58 images par seconde; le reste (mémoire, régularité, temps de démarrage) se lit sur les photos et dans le rapport. (CA-PF-095, 096, 128, 129)
- [ ] 11. **Sans Internet**: débrancher le câble qui relie la box à la prise du mur (la box reste allumée), puis jouer une partie. Attendu: tout marche, sans autre message sur Internet qu'une mention discrète dans la bibliothèque. Si ce câble est délicat à manipuler (fibre), passer ce point: il est vérifié chez nous. (CA-PF-097)
- [ ] 12. **Nouveau jeu**: attendre que le jeu d'essai publié pour la recette arrive dans la bibliothèque (ou cliquer « Chercher de nouveaux jeux »), sur les deux ordinateurs. Attendu: il apparaît tout seul, avec une notification, et se lance sans réinstaller Duo. (CA-PF-084)
- [ ] 13. **Facultatif, 10 minutes**: sur le PC, passer le Wi-Fi en réseau « Public » (Paramètres, Réseau et Internet, Wi-Fi, propriétés du réseau), puis ouvrir Duo. Attendu: Duo explique comment repasser en « Privé », et une fois que c'est fait, le bouton de vérification retrouve le Mac. (CA-PF-014)

Les autres critères à vérifier chez le client (pare-feu et autorisations refusés, CA-PF-012 à CA-PF-016; plusieurs interfaces réseau, CA-PF-019; diagnostic et VPN, CA-PF-119; mise en veille de l'écran pendant une partie, CA-PF-130; désinstallation, CA-PF-082; compte Windows au nom accentué, CA-PF-102; rapport pour le studio, CA-PF-132) se vérifient à la recette bêta, pas à pas, avec les instructions du studio. La 1.0 ne les reprend que si le code concerné a changé depuis la bêta, ce que le rapport de recette établit par l'historique Git.

## 9. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première version, d'après le cahier des charges v0.1 (décisions Q2 et Q3 incluses) | qa-testeur |
| 2026-10-30 | 0.2 | Alignement sur le cahier v0.2 (F02, F06, F13, section 6, Q5, Q6), sur l'architecture v0.1 (compatibilité, copie des jeux, chaîne de révisions, budgets) et sur la spécification UX v0.1 (reprise des deux côtés, fin de partie, échange de touches, présence, tailles d'écran); critères CA-PF-118 à CA-PF-132 ajoutés; hypothèses H-32 à H-35 ajoutées | qa-testeur |
