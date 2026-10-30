# Parcours et écrans de la plateforme Duo (version 1)

| Champ | Valeur |
|---|---|
| Statut | brouillon, wireframes basse fidélité à valider par le manager |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |
| Rédigé par | ux-ui-designer |
| Source | `docs/plateforme/cahier-des-charges.md` (brouillon v0.1), sections 1 à 5 |
| Wireframes | `design/maquettes/plateforme-wireframes/` (un fichier HTML par écran clé, captures dans `captures/`, planche `planche.png`) |

Ce document décrit les sept parcours de la section 2 du cahier des charges: étapes, écrans traversés, transitions, touches, états et textes exacts. La liste des écrans et la couverture des fonctions F01 à F13 sont en sections 10 et 11.

Objectifs mesurables:

- depuis l'accueil, l'hôte lance une partie en **trois actions au plus**, l'invité la rejoint en **une** (section 12, prouvé par `verifier-clavier.js`);
- personne ne tape d'adresse IP dans le cas normal: l'hôte apparaît tout seul chez l'autre;
- chaque erreur dit quoi faire;
- tout se fait au clavier (Tab, flèches, Entrée, Échap), la souris en complément.

Les noms des wireframes sont des exemples: **Camille** (le Mac, qui héberge dans les exemples) et **Sacha** (le PC, qui rejoint). Les jeux « Exemple coop » et « Exemple duel » sont des emplacements fictifs; seul le « Jeu témoin » est prévu au cahier.

## 0. Conventions communes à toute la plateforme

### 0.1 Ton et vocabulaire

- Tutoiement, provisoire (question Q2 du cahier). Tous les textes vivent dans un seul fichier de textes: passer au vouvoiement ne touche pas au code.
- Mots de l'interface: héberger, rejoindre, salon, partie, sauvegarde, historique, score cumulé, « l'autre ordinateur ». Jamais serveur, client, hôte, port, LAN, socket. Le mot « adresse » n'apparaît que dans le recours (connexion avec une adresse) et le diagnostic.
- Chaque joueur est désigné par son pseudo; « toi » pour soi-même.
- Une erreur dit, dans cet ordre: ce qui se passe, ce que Duo fait déjà (« Duo réessaie tout seul »), ce que le joueur peut faire, avec un bouton pour la solution principale. Aucun code d'erreur dans le texte principal: il va dans le rapport pour le studio.

### 0.2 Rédaction neutre

Le genre des joueurs n'est pas connu et ne sera pas demandé. Aucun texte ne s'accorde au genre d'un joueur. Les participes avec « avoir » sont neutres (« Sacha a rejoint le salon »), ceux avec « être » ne le sont pas. Même règle pour « vous » (deux personnes): « Vous avez gagné », pas « Vous êtes revenus ».

| À éviter | À écrire |
|---|---|
| Sacha est prête | puce « C'est parti » sur la carte de Sacha |
| Sacha est connectée | Sacha est là |
| Sacha est déconnectée | Connexion perdue avec Sacha |
| Sacha est revenue | Sacha est de retour |
| Vous êtes prêts tous les deux | ... sur les deux ordinateurs |
| Vous êtes revenus au salon | Retour au salon |
| l'autre joueur | l'autre ordinateur, ou le pseudo |

### 0.3 Typographie de l'interface

- Espace insécable (U+00A0) avant « : » et à l'intérieur des guillemets « »; espace fine insécable (U+202F) avant « ; », « ! », « ? » et « % ». Les textes de ce document sont écrits avec des espaces ordinaires pour rester lisibles; les wireframes HTML portent les vraies espaces insécables. Proposition pour ingenieur-build: un test qui refuse une espace ordinaire devant ces signes dans le fichier de textes.
- Points de suspension en un seul caractère (…). Apostrophe typographique (’) dans l'interface.
- Heures « 21 h 40 », dates « mardi 28 octobre », durées « 6 min », « 1 h 12 », « 3 min 12 s ». Plages « 20 à 40 min », jamais avec un tiret.
- Jamais de tiret cadratin ni demi-cadratin: deux-points, parenthèses, virgule, point médian (·) entre des informations courtes, ou nouvelle phrase.
- Majuscule seulement au début d'un libellé: « Héberger une partie ».
- Noms variables (pseudo, jeu): « de » devient « d' » devant une voyelle ou un h (« le salon d'Inès »). La fonction de textes gère cette élision; à défaut, placer le nom après un deux-points (« Partie interrompue : Exemple coop »).

### 0.4 Les deux joueurs à l'écran

- Chaque joueur a une couleur liée à un symbole: rond, carré, triangle, losange, étoile, hexagone. Six choix; les teintes viennent de l'identité visuelle (directeur-artistique). Le symbole accompagne toujours la couleur: les deux joueurs se distinguent sans voir les couleurs.
- Le pseudo est toujours écrit à côté du symbole. La couleur n'est jamais la seule information.
- **Toi à gauche, l'autre à droite**, sur les deux ordinateurs: salon, superpositions, écran de fin, historique.
- Pseudo: 1 à 16 caractères; lettres (accents compris), chiffres, espaces, trait d'union, apostrophe. Espaces de début et de fin retirées.

### 0.5 Clavier et souris

Navigation complète au clavier, souris en complément (survol, clic). Les touches de jeu sont reconnues par leur position (`KeyboardEvent.code`) et affichées selon la disposition réelle (AZERTY). Les menus n'ont pas de raccourci à une lettre: l'action la plus probable a le focus par défaut, Entrée suffit.

| Touche | Effet, partout hors partie |
|---|---|
| Tab, Maj+Tab | élément suivant, précédent. Ordre de lecture: barre du haut, puis contenu de haut en bas et de gauche à droite |
| Flèches | se déplacer dans un groupe: grille des jeux, choix de sauvegarde, choix de couleur, onglets des réglages, curseurs de volume, listes |
| Entrée | activer l'élément qui a le focus; dans un champ de texte, valider |
| Espace | activer un bouton, cocher une case |
| Échap | fermer la couche du dessus: fenêtre de confirmation, puis panneau, puis écran (retour à l'écran précédent). Sans effet sur l'accueil |
| Ctrl+1 à Ctrl+4 (⌘1 à ⌘4 sur Mac) | Accueil, Bibliothèque, Historique, Réglages (raccourcis de confort, hors salon et hors partie) |
| ⌘, (Mac) | Réglages, par le menu de l'application (convention macOS) |
| F11 (Windows), ⌃⌘F (Mac) | plein écran ou fenêtre |

| Touche | Effet en partie |
|---|---|
| Échap | pause (sur les deux ordinateurs). **Réservée à la plateforme dans tous les jeux**: aucun jeu ne l'utilise ni ne permet de l'attribuer |
| autres touches | celles du jeu, réglables dans Réglages > Touches |

Règles:

- **Focus par défaut**: chaque écran place le focus sur l'action la plus probable (liste en section 10). C'est ce qui permet de lancer une partie à coups d'Entrée.
- **Focus toujours visible**: anneau épais (3 px, décalé de 3 px, contraste d'au moins 3:1 avec le fond), jamais supprimé. Affiché au clavier (`:focus-visible`), pas après un clic de souris.
- **Le focus ne se perd jamais**: à la fermeture d'une fenêtre, il revient sur l'élément qui l'a ouverte; si l'élément focalisé disparaît, il passe au suivant logique.
- **Anti-double-appui**: pendant 300 ms après un changement d'écran, Entrée et Espace sont ignorés, et une touche maintenue (répétition automatique) n'active jamais un bouton. Sans cela, un double Entrée sur l'invitation annulerait aussitôt « C'est parti » dans le salon.
- **Fenêtres de confirmation**: le focus reste dedans (Tab boucle); quand l'action fait perdre quelque chose, le bouton sûr a le focus par défaut.
- **Perte du focus de la fenêtre** (Alt+Tab, notification): pas de pause automatique (une simple notification interromprait l'autre joueur), mais toutes les touches sont relâchées.

### 0.6 Modèles communs

| Modèle | Règle |
|---|---|
| Barre du haut | « Duo », onglets Accueil, Bibliothèque, Historique, Réglages; à droite, la présence de l'autre (« Sacha est là ») et ton symbole avec ton pseudo. Masquée dans le salon et en partie |
| Carte de joueur | symbole, pseudo, « (toi) », rôle (« héberge »), puce d'état. La puce a une icône et un texte, jamais une couleur seule |
| Puces d'état | « C'est parti » (coche), « Pas encore » (sablier), « En attente… », « Veut reprendre », « Veut rejouer », « Connexion perdue » (triangle d'alerte) |
| Bandeau d'invitation | en haut au centre, par-dessus tout écran hors partie. Prend le focus sur « Rejoindre », sauf si un champ de texte est en cours de saisie: il attend que le champ soit quitté. Entrée rejoint, Échap met de côté (l'invitation reste dans l'accueil). Signal sonore discret (sound-designer) |
| Notification | en haut à droite, 6 s, ne prend pas le focus, annoncée aux lecteurs d'écran (`aria-live`). Celles qui proposent une action restent jusqu'à ce qu'on les ferme |
| Fenêtre de confirmation | titre en question, conséquence en une phrase, deux boutons: l'action (verbe précis, jamais « OK ») et le retour (« Rester », « Continuer à jouer »). Échap choisit le retour |
| Superposition en partie | le jeu figé et assombri derrière, panneau central. Un seul modèle pour la pause, la connexion perdue et la reprise. Pas de flou: coûteux sur le PC de référence |
| Compte à rebours | « La partie commence dans 3 », une seconde par chiffre; « Pas encore » ou Échap l'annule sur l'un ou l'autre ordinateur. Avec la réduction des animations, seul le chiffre change |
| Indicateur d'enregistrement | « Progression enregistrée », 2 s, coin bas droit, pendant la partie, quand le jeu enregistre |

Transitions entre écrans: fondu de 150 ms; aucune avec « Réduire les animations ».

### 0.7 Les états à prévoir sur chaque écran

| État | Règle |
|---|---|
| Vide | dire pourquoi c'est vide et proposer l'action qui le remplit |
| Chargement | indicateur et texte; au-delà de 10 à 20 s, dire ce qui se passe et proposer une issue |
| Succès | confirmation brève (notification ou puce), sans fenêtre à fermer |
| Erreur | ce qui se passe, ce que Duo fait, ce que tu peux faire, un bouton pour la solution principale |
| Attente de l'autre joueur | qui on attend et pourquoi; toujours une issue (retour, annuler) |
| Déconnexion | « Connexion perdue avec Sacha », Duo réessaie tout seul, ce qui est conservé |
| Reconnexion | « Sacha est de retour », on reprend où on en était |
| Versions incompatibles | quelle version a chacun, qui doit mettre à jour, un bouton pour le faire (section 9) |

### 0.8 Tailles d'écran

- Sans défilement jusqu'à **1280x720 points**: c'est un écran 1920x1080 réglé à 150 % dans Windows (fréquent sur les portables) ou un écran 1366x768 en plein écran.
- En fenêtre sur un petit écran (jusqu'à environ 1280x640 une fois la barre des tâches et la barre de titre déduites), la zone principale défile verticalement; l'action principale reste visible sans défiler; jamais de défilement horizontal.
- Avec « Taille de l'interface » à 125 ou 150 % sur un petit écran: même règle.
- Retina et mise à l'échelle de Windows: tout est vectoriel ou à double résolution.
- Proposition: au premier lancement, fenêtre agrandie (toute la place, barre des tâches visible); plein écran en une touche; Duo retient le dernier choix.

## 1. Parcours 1: premier lancement

Fonctions: F01, F02, F11, F13. Objectif: en deux minutes, chaque ordinateur a un profil, a reçu les autorisations réseau et voit l'autre.

### 1.1 Étape 0, hors de l'application: installer et ouvrir Duo (F11)

Les alertes de sécurité pour une application sans certificat payant apparaissent avant que Duo ne tourne: Duo ne peut pas les expliquer lui-même. C'est le rôle du guide d'installation (E00), sur la page de téléchargement et dans le fichier « Lisez-moi » à côté de l'installateur. Textes proposés, à ajuster par ingenieur-build selon la signature retenue et à vérifier sur les vraies machines:

| Système | Texte du guide |
|---|---|
| Mac | Au premier lancement, macOS dit qu'il ne peut pas vérifier Duo. Ferme ce message, ouvre Réglages Système > Confidentialité et sécurité, descends jusqu'à la ligne qui parle de Duo, clique sur « Ouvrir quand même », puis confirme. Ce n'est à faire qu'une fois. |
| Windows | Au premier lancement, Windows affiche « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires », puis sur « Exécuter quand même ». Ce n'est à faire qu'une fois. |

### 1.2 Étapes dans l'application

| # | Écran | Ce que voit et fait le joueur | Focus par défaut | Transition |
|---|---|---|---|---|
| 1 | E01 Bienvenue | une phrase sur Duo, les trois étapes à venir | Commencer | Entrée: E02 |
| 2 | E02 Profil | pseudo prérempli avec le prénom du compte de l'ordinateur (texte sélectionné, prêt à remplacer), couleur présélectionnée au hasard pour éviter que les deux ordinateurs prennent la même | champ Pseudo | Entrée dans le champ ou Continuer: E03. Échap: E01 |
| 3a | E03 Réseau (Windows) | Duo vérifie d'abord le type de réseau. S'il est « Public », il explique comment le passer en « Privé » **avant** la fenêtre du pare-feu (sinon Windows proposerait d'autoriser Duo sur les réseaux publics) | Continuer | Continuer: fenêtre du pare-feu de Windows, puis E04 |
| 3b | E03 Réseau (macOS) | explication de l'autorisation « Réseau local » | Continuer | Continuer: fenêtre de macOS, puis E04 |
| 4 | E04 L'autre ordinateur | recherche automatique; l'autre apparaît tout seul | Terminer, dès que l'autre est trouvé | Terminer: E05 Accueil |

Chemin le plus court: Entrée, Entrée, Entrée, un clic dans la fenêtre du système, Entrée.

Contrainte technique liée (architecte-technique, dev-reseau): au premier lancement, Duo n'ouvre aucune connexion réseau avant que le joueur ait cliqué sur « Continuer » en E03. Sinon la fenêtre du système apparaît avant l'explication.

Si l'autre ordinateur a déjà fait son premier lancement, il affiche une notification quand le nouveau arrive: « Sacha vient d'arriver sur le réseau. » La première rencontre forme le duo: historique, sauvegardes et scores communs.

### 1.3 Touches

| Écran | Touches |
|---|---|
| E01 | Entrée: commencer |
| E02 | Tab: pseudo, puis couleurs, puis boutons. Flèches: changer de couleur. Entrée: continuer. Échap: retour |
| E03 | Entrée: continuer (déclenche la fenêtre du système). Échap: retour |
| E04 | Tab: Que faire ?, Se connecter avec une adresse, Terminer sans l'autre ordinateur. Entrée sur Terminer quand l'autre est trouvé |

### 1.4 États

| Écran | État | Comportement |
|---|---|---|
| E02 | pseudo vide | message sous le champ, Continuer reste actif et remet le focus dans le champ |
| E02 | caractère refusé | le caractère n'est pas inséré, message sous le champ |
| E02 | 16 caractères atteints | la saisie s'arrête, le compteur l'indique |
| E03 | autorisation déjà accordée (réinstallation) | passage direct à E04 avec la notification « Autorisation déjà accordée. » |
| E03 | en attente de la réponse au système | texte d'attente, sans limite de temps |
| E03 | Windows: réseau « Public » | sous-écran d'explication avant le pare-feu, bouton vers les paramètres réseau, puis « C'est fait, vérifier » |
| E03 | Windows: autorisation refusée | marche à suivre pour autoriser Duo dans le pare-feu, bouton « Ouvrir le pare-feu », puis « C'est fait, vérifier » |
| E03 | macOS: autorisation refusée | marche à suivre dans Réglages Système > Confidentialité et sécurité > Réseau local, bouton « Ouvrir les Réglages Système », puis « C'est fait, vérifier » |
| E03 | « Passer cette étape » | possible, avec la conséquence écrite; l'explication reste accessible dans Réglages > Réseau |
| E04 | recherche | indicateur et texte; après 30 s, aide et boutons du diagnostic (E17) et de la connexion avec une adresse |
| E04 | trouvé | carte des deux joueurs, Terminer prend le focus |
| E04 | l'autre n'a pas fini sa configuration | on l'affiche et on attend |
| E04 | même couleur que l'autre | choix d'une autre couleur sur place, la couleur de l'autre est indisponible |
| E04 | versions de Duo différentes | qui a quelle version, quoi installer (section 9) |
| E04 | terminer sans l'autre | accueil, présence « Personne pour l'instant » |

Si les deux ordinateurs ont fini leur configuration sans s'être vus, et qu'ils ont la même couleur à leur première rencontre: l'ordinateur qui rejoint passe à la couleur libre suivante et l'annonce par une notification (« Sacha a la même couleur que toi : tu passes en carré. Tu peux la changer dans Réglages > Profil. »).

### 1.5 Textes

| Écran | Élément | Texte |
|---|---|---|
| E01 | titre | Bienvenue dans Duo |
| E01 | texte | Duo sert à jouer à deux, sur deux ordinateurs, dans la même pièce. |
| E01 | texte | Trois étapes et c'est prêt : ton profil, le réseau, puis l'autre ordinateur. |
| E01 | bouton | Commencer |
| tous | étapes | Profil · Réseau · L'autre ordinateur (lecteur d'écran: « Étape 1 sur 3 ») |
| E02 | titre | Comment veux-tu t'appeler ? |
| E02 | champ | Pseudo |
| E02 | aide | C'est le nom que l'autre ordinateur affichera. 16 caractères au plus. |
| E02 | groupe | Ta couleur |
| E02 | aide | Chaque couleur a son symbole : vous restez faciles à distinguer, même sans voir les couleurs. |
| E02 | aperçu | Aperçu : (symbole) Camille |
| E02 | erreur vide | Choisis un pseudo d'au moins 1 caractère. |
| E02 | erreur caractère | Ce caractère n'est pas accepté : utilise des lettres, des chiffres, des espaces, - ou '. |
| E02 | boutons | Retour · Continuer |
| E03 Windows | titre | Windows va te demander d'autoriser Duo |
| E03 Windows | texte | Pour que vos deux ordinateurs se trouvent tout seuls, le pare-feu de Windows doit laisser passer Duo sur le réseau de la maison. |
| E03 Windows | consigne | Dans la fenêtre qui va s'ouvrir : 1. Laisse « Réseaux privés » coché. 2. Clique sur « Autoriser ». Si Windows demande l'accord d'un administrateur, réponds « Oui ». |
| E03 | rassurer | Duo n'utilise Internet que pour télécharger les jeux. Pendant vos parties, tout reste chez vous. |
| E03 | boutons | Retour · Continuer |
| E03 | lien | Passer cette étape |
| E03 | conséquence du lien | Sans cette autorisation, l'autre ordinateur ne te trouvera pas. Tu pourras la donner plus tard dans Réglages > Réseau. |
| E03 | attente | En attente de ta réponse à Windows… (ou macOS) |
| E03 Windows public | titre | Ton réseau est réglé sur « Public » |
| E03 Windows public | texte | Sur un réseau public, Windows empêche les ordinateurs de se voir. Si c'est le réseau de ta maison, passe-le sur « Privé » : 1. Clique sur « Ouvrir les paramètres réseau ». 2. Choisis ton réseau (Wi-Fi ou Ethernet). 3. Sous « Type de profil réseau », choisis « Privé ». |
| E03 Windows public | boutons | Ouvrir les paramètres réseau · C'est fait, vérifier |
| E03 Windows refus | titre | Windows bloque Duo |
| E03 Windows refus | texte | Sans cette autorisation, l'autre ordinateur ne peut pas te rejoindre. Pour corriger : 1. Clique sur « Ouvrir le pare-feu ». 2. Clique sur « Modifier les paramètres ». 3. Coche Duo dans la colonne « Privé », puis clique sur « OK ». |
| E03 Windows refus | boutons | Ouvrir le pare-feu · C'est fait, vérifier |
| E03 macOS | titre | macOS va te demander d'autoriser Duo |
| E03 macOS | texte | Pour que vos deux ordinateurs se trouvent tout seuls, Duo doit pouvoir parler aux appareils de ton réseau local, c'est-à-dire le Wi-Fi de la maison. |
| E03 macOS | consigne | Dans la fenêtre qui va s'ouvrir, clique sur « Autoriser ». |
| E03 macOS refus | titre | macOS bloque Duo |
| E03 macOS refus | texte | Sans cette autorisation, Duo ne peut pas trouver l'autre ordinateur. Pour corriger : 1. Clique sur « Ouvrir les Réglages Système ». 2. Dans « Réseau local », active Duo. 3. Reviens ici. |
| E03 macOS refus | boutons | Ouvrir les Réglages Système · C'est fait, vérifier |
| fenêtre de macOS | texte de Duo (`NSLocalNetworkUsageDescription`) | Duo cherche l'autre ordinateur de votre duo sur le réseau de la maison, pour lancer vos parties. |
| E04 | titre | Cherchons l'autre ordinateur |
| E04 | texte | Ouvre Duo sur l'autre ordinateur : il apparaîtra ici tout seul. |
| E04 | état | Recherche en cours… |
| E04 | après 30 s | Toujours rien ? Vérifie que Duo est ouvert sur l'autre ordinateur et que les deux sont sur le même Wi-Fi. |
| E04 | boutons | Que faire ? · Se connecter avec une adresse |
| E04 | lien | Terminer sans l'autre ordinateur |
| E04 | aide du lien | Tu pourras le retrouver plus tard depuis l'accueil. |
| E04 trouvé | titre | Sacha est là |
| E04 trouvé | texte | Sur l'ordinateur « PC-SACHA ». Vous pouvez jouer ensemble. |
| E04 trouvé | bouton | Terminer |
| E04 pas configuré | texte | Duo est ouvert sur « PC-SACHA », mais sa configuration n'est pas finie. On attend… |
| E04 même couleur | texte | Sacha a déjà cette couleur. Choisis-en une autre pour rester faciles à distinguer : |
| E04 versions | texte | Sacha a une autre version de Duo (1.0.3, ici 1.0.2). Pour jouer ensemble, installez la même version. |
| E04 versions | bouton | Comment mettre Duo à jour |
| notification chez l'autre | texte | Sacha vient d'arriver sur le réseau. |

## 2. Parcours 2: lancer une partie

Fonctions: F02, F03, F04, F07, F13. Modèle de départ: chacun dit « C'est parti ! » sur son ordinateur; la partie démarre quand c'est dit des deux côtés. **Rejoindre depuis l'invitation vaut « C'est parti »**: l'invitation montre déjà le jeu, la sauvegarde et qui invite.

### 2.1 Étapes

| Temps | Hôte (Camille, Mac) | Invité (Sacha, PC) |
|---|---|---|
| 1 | Accueil, focus sur « Héberger une partie »: **Entrée** (action 1) | Accueil, ou n'importe quel écran hors partie |
| 2 | Bibliothèque, focus sur le dernier jeu joué: flèches pour en choisir un autre, **Entrée** (action 2) | |
| 3 | Salon ouvert, sauvegarde la plus récente présélectionnée, invitation envoyée. Focus sur « C'est parti ! » | Bandeau d'invitation, focus sur « Rejoindre » |
| 4 | Notification « Sacha a rejoint le salon. » | **Entrée** (action 1): Salon, sa puce passe à « C'est parti » |
| 5 | **Entrée** sur « C'est parti ! » (action 3) | |
| 6 | Compte à rebours « La partie commence dans 3 » sur les deux écrans | idem |
| 7 | Chargement (E09) sur les deux écrans, puis la partie | idem |

L'ordre des temps 4 et 5 peut s'inverser: si Camille dit « C'est parti » avant que Sacha rejoigne, le compte à rebours démarre dès que Sacha rejoint.

Raccourci « Reprendre » sur l'accueil (dernier jeu et dernière sauvegarde): Entrée ouvre directement le salon; l'hôte lance alors en deux actions.

### 2.2 Choisir la sauvegarde dans le salon (F07)

- Le bloc « Sauvegarde » du salon liste les sauvegardes du jeu, la plus récente en premier et sélectionnée, puis « Nouvelle partie ». Chaque ligne: le nom donné par le jeu (« Niveau 3 ») et la date (« hier à 21 h 40 »).
- C'est un groupe de boutons radio: Tab y entre sur la sauvegarde choisie, les flèches haut et bas en choisissent une autre. Aucune validation à part: le choix s'applique tout de suite.
- Seul l'hôte choisit. L'invité voit « Sauvegarde choisie par Camille : Niveau 3, hier à 21 h 40 ».
- Un changement de sauvegarde ou de jeu remet les deux puces à « Pas encore » et prévient l'autre (« Camille a choisi une autre sauvegarde. »): on ne démarre jamais sur un choix que l'autre n'a pas vu.
- Jeu sans sauvegarde: le bloc le dit (« Ce jeu ne garde pas de sauvegarde : chaque partie repart de zéro. »).
- « Nouvelle partie » quand toutes les places du jeu sont prises: Duo demande laquelle remplacer, puis confirme; la sauvegarde remplacée reste en copie de secours.
- Copies différentes sur les deux ordinateurs (section 4 du cahier): à l'ouverture du salon, une fenêtre l'explique; la plus récente est gardée, l'autre reste en copie de secours, visible dans la fiche du jeu (bibliothèque).
- Une sauvegarde se reprend quel que soit l'ordinateur qui héberge: elle existe sur les deux.

### 2.3 Transitions et touches

| Écran | Touches | Échap |
|---|---|---|
| E05 Accueil | Tab, Entrée | sans effet |
| E06 Invitation | Entrée: rejoindre. Tab: Plus tard | Plus tard (l'invitation reste dans l'accueil, bloc Rejoindre) |
| E07 Bibliothèque | flèches dans la grille, Entrée sur un jeu: héberger. Tab: fiche du jeu | retour à l'accueil |
| E08 Salon hôte | Entrée sur « C'est parti ! » (bascule avec « Pas encore »). Tab: Changer de jeu, Sauvegarde (flèches), Commandes | « Fermer le salon ? » si Sacha est dans le salon, sinon fermeture directe |
| E08 Salon invité | Entrée sur « Pas encore » ou « C'est parti ! » (bascule) | « Quitter le salon ? » |
| compte à rebours | Entrée ou Échap sur « Pas encore »: annule | annule |
| E09 Chargement | aucune; « Revenir au salon » apparaît si le chargement est long | sans effet |

Le salon masque la barre du haut: on n'en sort que par « Fermer le salon » ou « Quitter le salon ».

Deux salons ouverts en même temps: chacun reçoit l'invitation de l'autre. Le premier qui rejoint l'emporte; le salon de l'autre se ferme tout seul (« Ton salon est fermé : tu as rejoint celui de Sacha. »).

### 2.4 États

| Écran | État | Comportement |
|---|---|---|
| E05 | vide (aucune partie ouverte) | le bloc Rejoindre explique que l'invitation apparaîtra ici |
| E05 | Sacha n'est pas visible | ligne de présence en alerte, bouton « Que faire ? » (E17). Héberger reste possible: l'invitation partira dès que Sacha sera là |
| E06 | Sacha écrit dans un champ | le bandeau apparaît sans prendre le focus, puis le prend quand le champ est quitté |
| E06 | le jeu manque chez l'invité | bouton « Installer et rejoindre (12 Mo) », progression dans le bandeau, puis entrée dans le salon sans autre action |
| E06 | jeu plus ancien chez l'invité | « Mettre à jour et rejoindre (2 Mo) »: toujours une seule action |
| E06 | jeu plus ancien chez l'hôte | l'invité est prévenu, l'hôte voit le bouton « Mettre à jour » dans son salon |
| E06 | versions de Duo différentes | pas d'invitation possible: la ligne de présence de l'accueil l'explique des deux côtés (section 9) |
| E06 | l'hôte ferme le salon avant la réponse | le bandeau disparaît, notification « Camille a fermé le salon. » |
| E07 | Sacha n'est pas visible | sous-titre adapté; héberger reste possible |
| E08 | attente de l'invité | carte de Sacha « En attente… », texte « Invitation envoyée à Sacha. »; après 20 s, l'aide et l'adresse de l'ordinateur pour le recours |
| E08 | invité arrivé | notification, carte de Sacha remplie |
| E08 | invité parti | notification « Sacha a quitté le salon. », retour à l'attente |
| E08 | salon fermé par l'hôte | l'invité revient à l'accueil avec une notification |
| E08 | connexion perdue dans le salon | cartes « Connexion perdue », Duo réessaie; au retour, puces remises à « Pas encore » |
| E08 | impossible de rejoindre | fenêtre avec Réessayer et Que faire ? |
| E08 | compte à rebours annulé | notification « Sacha a demandé d'attendre. » |
| E08 | copies de sauvegarde différentes | fenêtre d'explication (texte ci-dessous) |
| E09 | chargement | progression de chacun; la partie démarre en même temps des deux côtés |
| E09 | chargement long (plus de 20 s) | « Le chargement prend du temps chez Sacha. » et « Revenir au salon » |
| E09 | échec du chargement | retour au salon des deux côtés avec une fenêtre d'explication |

### 2.5 Textes

| Écran | Élément | Texte |
|---|---|---|
| E05 | bloc | Héberger |
| E05 | texte | Tu choisis le jeu, Sacha reçoit l'invitation. |
| E05 | bouton | Héberger une partie |
| E05 | bloc | Rejoindre |
| E05 | vide | Aucune partie ouverte pour l'instant. Quand Sacha en ouvrira une, l'invitation apparaîtra ici. |
| E05 | salon trouvé | Sacha a ouvert un salon · Jeu témoin · Nouvelle partie |
| E05 | bouton | Rejoindre |
| E05 | lien | Sacha n'apparaît pas ? Se connecter avec une adresse |
| E05 | bloc | Reprendre |
| E05 | ligne | Exemple coop · Niveau 3 · hier à 21 h 40 |
| E05 | bouton | Héberger cette partie |
| E06 | titre | Camille t'invite à jouer |
| E06 | détail | Exemple coop · Coopération · 20 à 40 min |
| E06 | sauvegarde | Sauvegarde : Niveau 3, hier à 21 h 40 (ou : Nouvelle partie) |
| E06 | boutons | Rejoindre (Entrée) · Plus tard (Échap) |
| E06 jeu absent | texte | Tu n'as pas encore ce jeu. |
| E06 jeu absent | bouton | Installer et rejoindre (12 Mo) |
| E06 progression | texte | Installation : 40 % |
| E06 jeu ancien | texte | Ta version de ce jeu est plus ancienne que celle de Camille. |
| E06 jeu ancien | bouton | Mettre à jour et rejoindre (2 Mo) |
| E06 hôte en retard | texte | Camille doit d'abord mettre ce jeu à jour. C'est indiqué sur son écran. |
| E07 | titre | Bibliothèque |
| E07 | sous-titre | Choisis un jeu, puis Entrée pour l'héberger avec Sacha. |
| E07 | sous-titre si absent | Sacha n'est pas visible : tu peux ouvrir le salon, l'invitation partira dès que Sacha sera là. |
| E07 | bouton de fiche | Héberger ce jeu |
| E08 | en-tête | Salon · Exemple coop |
| E08 | bouton hôte | Fermer le salon (Échap) |
| E08 | bouton invité | Quitter le salon (Échap) |
| E08 | carte | Camille (toi) · héberge |
| E08 | puces | C'est parti · Pas encore · En attente… · Connexion perdue |
| E08 | bouton principal | C'est parti ! (après appui : Pas encore) |
| E08 | aide | La partie commence dès que vous avez dit « C'est parti » sur les deux ordinateurs. |
| E08 invité | aide | Tu as dit « C'est parti » en rejoignant. On attend Camille. |
| E08 attente | texte | Invitation envoyée à Sacha. |
| E08 attente 20 s | texte | Sacha ne voit pas l'invitation ? Sur l'ordinateur de Sacha : Accueil > Rejoindre. Sinon : Se connecter avec une adresse, puis taper 192.168.1.42. |
| E08 | bloc | Sauvegarde |
| E08 | options | Continuer : Niveau 3 (hier à 21 h 40) · Niveau 1 (12 octobre à 20 h 05) · Nouvelle partie |
| E08 | aide de sauvegarde (fournie par le jeu) | Le jeu enregistre à la fin de chaque niveau. |
| E08 invité | sauvegarde | Sauvegarde choisie par Camille : Niveau 3, hier à 21 h 40 |
| E08 | sans sauvegarde | Ce jeu ne garde pas de sauvegarde : chaque partie repart de zéro. |
| E08 | bouton hôte | Changer de jeu |
| E08 | bloc | Commandes |
| E08 | notifications | Sacha a rejoint le salon. · Sacha a quitté le salon. · Camille a fermé le salon. · Camille a choisi une autre sauvegarde. · Camille a choisi un autre jeu : Exemple duel. · Sacha a demandé d'attendre. · Sacha est de retour. |
| E08 | connexion perdue | Connexion perdue avec Sacha. Duo réessaie tout seul… |
| E08 | compte à rebours | La partie commence dans 3 |
| E08 | bouton du compte à rebours | Pas encore (Échap) |
| E08 | fenêtre hôte | Fermer le salon ? · Sacha reviendra à l'accueil. · Fermer le salon · Rester |
| E08 | fenêtre invité | Quitter le salon ? · Camille restera dans le salon et pourra t'inviter à nouveau. · Quitter le salon · Rester |
| E08 | fenêtre d'échec | Impossible de rejoindre le salon de Camille · Vérifie que vos deux ordinateurs sont sur le même Wi-Fi, puis réessaie. · Réessayer · Que faire ? |
| E08 | fenêtre copies différentes | Vos deux copies de cette sauvegarde étaient différentes · Duo garde la plus récente (chez Sacha, hier à 22 h 10). L'autre reste en copie de secours dans la fiche du jeu. · Compris |
| E08 | places pleines | Toutes les places de sauvegarde de ce jeu sont prises. Laquelle remplacer ? |
| E08 | fenêtre de remplacement | Remplacer « Niveau 1 » ? · Elle restera en copie de secours dans la fiche du jeu. · Remplacer · Annuler |
| E08 | deux salons | Ton salon est fermé : tu as rejoint celui de Sacha. |
| E09 | titre | Chargement · Exemple coop |
| E09 | progression | Toi : 80 % · Sacha : 45 % |
| E09 | long | Le chargement prend du temps chez Sacha. |
| E09 | bouton | Revenir au salon |
| E09 | échec | Exemple coop n'a pas pu démarrer chez Sacha. Retour au salon. · Compris · Enregistrer un rapport pour le studio |

## 3. Parcours 3: jouer

Fonctions: F05, F06, F07, F10.

### 3.1 Étapes

| # | Écran | Ce qui se passe | Focus par défaut |
|---|---|---|---|
| 1 | E10 Partie | le jeu occupe la fenêtre; en haut, « Échap : pause » pendant 4 s au début de chaque partie | le jeu |
| 2 | E11 Pause | Échap sur l'un ou l'autre ordinateur: le jeu se fige sur les deux, la superposition apparaît sur les deux | Reprendre |
| 3 | E11 Pause | menu: Reprendre, Commandes, Réglages, Retour au salon; en bas, la carte de chacun avec sa puce | |
| 4 | E11 Reprise | « Reprendre » (ou Échap) met ta puce à « Veut reprendre ». Quand c'est fait sur les deux ordinateurs: « Reprise dans 3 », puis le jeu | |
| 5 | E11 Commandes | panneau des touches du jeu en cours (lues dans les réglages) | Retour |
| 6 | E11 Réglages | Son, Affichage et Touches du jeu en cours. L'autre voit la puce « Dans les réglages » | premier onglet |
| 7 | E11 Retour au salon | fenêtre de confirmation; si confirmé, les deux reviennent au salon, l'autre reçoit une notification | Continuer à jouer |

Pourquoi la reprise se fait des deux côtés: personne n'est surpris par une reprise pendant qu'il lit les commandes ou règle le son. Le compte à rebours de 3 s laisse le temps de reposer les mains sur le clavier.

### 3.2 Déconnexion et reconnexion (F06)

| # | Ce qui se passe | Écran |
|---|---|---|
| 1 | Duo ne reçoit plus rien de l'autre ordinateur depuis quelques secondes (seuil fixé par dev-reseau) | |
| 2 | La partie se met en pause sur l'ordinateur qui reste; superposition « Connexion perdue avec Sacha ». Duo réessaie tout seul; la durée de la coupure s'affiche | E12 |
| 3 | Après 30 s: l'aide s'enrichit (Duo ouvert chez Sacha ? Wi-Fi ?) | E12 |
| 4 | Sacha revient: « Sacha est de retour. Reprenez quand vous voulez. »; la superposition devient la pause normale, reprise des deux côtés | E11 |
| 5 | Ou bien « Arrêter la partie » (confirmation): progression gardée jusqu'à la dernière sauvegarde, retour à l'accueil | E05 |

- L'ordinateur qui a perdu le réseau affiche la même superposition, en miroir (« Connexion perdue avec Camille »). Si c'est son propre réseau qui est coupé, il le dit: « Ton ordinateur n'est plus connecté au réseau. »
- Pas de délai d'abandon automatique: on peut attendre aussi longtemps qu'on veut. Après 60 s, la superposition rappelle ce qui est enregistré.
- Si l'application de l'hôte s'est fermée ou a planté, l'invité voit la même superposition. À la réouverture de Duo chez l'hôte, l'accueil propose de reprendre depuis la dernière sauvegarde (« Partie interrompue »). La reprise exacte au même instant dépend de l'architecture (instantané de la partie): à trancher par architecte-technique.

### 3.3 Le jeu s'arrête à cause d'une erreur (F05)

Le jeu qui plante ne ferme pas Duo. Les deux ordinateurs reviennent au salon; une fenêtre l'explique, avec l'état de la sauvegarde. « Enregistrer un rapport pour le studio » écrit un fichier (journal, versions, système) dans le dossier Téléchargements et l'indique. Si le même jeu s'arrête deux fois de suite, la fenêtre insiste sur le rapport.

### 3.4 Touches

| Écran | Touches | Échap |
|---|---|---|
| E10 | celles du jeu | pause |
| E11 menu | flèches haut et bas ou Tab, Entrée | Reprendre (même effet que le bouton) |
| E11 compte à rebours de reprise | | retour à la pause |
| E11 Commandes, Réglages | Tab, flèches | retour au menu de pause |
| fenêtre « Arrêter la partie ? » | Tab boucle, Entrée | Continuer à jouer |
| E12 | Tab, Entrée | sans effet (la pause est imposée par la coupure) |

### 3.5 États

| État | Comportement |
|---|---|
| pause demandée par l'autre | « Pause demandée par Camille. », même menu |
| les deux appuient sur Échap en même temps | une seule pause; « Pause demandée par Camille et Sacha. » |
| l'un des deux est dans les réglages | sa puce « Dans les réglages »; la reprise attend son « Reprendre » |
| connexion perdue pendant la pause | la superposition passe à E12 |
| connexion perdue pendant le compte à rebours de reprise | compte à rebours annulé, E12 |
| fenêtre de Duo fermée pendant une partie | confirmation « Quitter Duo ? La partie s'arrêtera pour vous deux. » |
| enregistrement par le jeu | indicateur « Progression enregistrée » 2 s |
| mise en veille | empêchée pendant une partie (dev-plateforme); si l'ordinateur dort quand même, c'est une coupure (E12) |

### 3.6 Textes

| Écran | Élément | Texte |
|---|---|---|
| E10 | indice | Échap : pause |
| E10 | indicateur | Progression enregistrée |
| E11 | titre | Pause |
| E11 | sous-titre | Pause demandée par Camille. (chez Camille : Tu as mis la partie en pause.) |
| E11 | boutons | Reprendre · Commandes · Réglages · Retour au salon |
| E11 | puces | En pause · Veut reprendre · Dans les réglages |
| E11 | aide | La partie reprend quand vous avez choisi « Reprendre » sur les deux ordinateurs. |
| E11 | reprise | Reprise dans 3 |
| E11 | fenêtre | Arrêter la partie ? · La progression est enregistrée jusqu'à la fin du niveau 2 : ce que vous avez fait depuis sera perdu. · Arrêter la partie · Continuer à jouer |
| E11 | texte par défaut de la fenêtre (jeu sans moment d'enregistrement déclaré) | Ce que vous avez fait depuis la dernière sauvegarde sera perdu. |
| E11 | notification chez l'autre | Camille a arrêté la partie. |
| E12 | titre | Connexion perdue avec Sacha |
| E12 | texte | La partie est en pause. Elle reprendra là où vous en étiez dès que Sacha sera de retour. |
| E12 | statut | Duo réessaie tout seul… depuis 0:42 |
| E12 | aide après 30 s | Vérifiez que Duo est toujours ouvert sur l'ordinateur de Sacha et que son Wi-Fi fonctionne. |
| E12 | rappel après 60 s | Progression enregistrée jusqu'à la fin du niveau 2. |
| E12 | boutons | Que faire ? · Arrêter la partie |
| E12 | réseau local coupé | Ton ordinateur n'est plus connecté au réseau. Vérifie ton Wi-Fi : la partie reprendra dès que la connexion reviendra. |
| E12 | retour | Sacha est de retour. Reprenez quand vous voulez. |
| E12 | fenêtre | Arrêter la partie ? · Progression enregistrée jusqu'à la fin du niveau 2. · Arrêter la partie · Continuer d'attendre |
| E13 | titre | Le jeu s'est arrêté |
| E13 | texte | Exemple coop a rencontré un problème et s'est fermé. Votre dernière sauvegarde est intacte : niveau 2 terminé. |
| E13 | boutons | Compris · Enregistrer un rapport pour le studio |
| E13 | rapport enregistré | Rapport enregistré dans Téléchargements : duo-rapport-2026-10-30.txt |
| E13 | deuxième fois | Ce jeu s'est encore arrêté. Envoie le rapport au studio : il en a besoin pour corriger. |
| fenêtre de Duo | fermeture en partie | Quitter Duo ? · La partie s'arrêtera pour vous deux. Progression enregistrée jusqu'à la fin du niveau 2. · Quitter Duo · Continuer à jouer |

## 4. Parcours 4: finir

Fonctions: F05, F07, F08, F09.

### 4.1 Étapes

| # | Ce qui se passe | Focus par défaut |
|---|---|---|
| 1 | Le jeu annonce la fin et le résultat; il peut jouer sa propre courte célébration | |
| 2 | Écran de fin commun (E14) sur les deux ordinateurs: titre du résultat, cartes des deux joueurs avec leurs scores et jusqu'à trois statistiques fournies par le jeu, durée | Rejouer |
| 3 | Mise à jour du score cumulé (affrontement) ou de la progression commune (coopération), avec le « +1 » du vainqueur; l'historique et la sauvegarde sont confirmés en une ligne | |
| 4a | « Rejouer »: ta puce « Veut rejouer »; quand c'est fait sur les deux ordinateurs, compte à rebours puis chargement. Le jeu peut renommer ce bouton (« Niveau suivant ») | |
| 4b | « Retour au salon »: retour au salon. L'autre voit « Sacha attend dans le salon. » et son bouton principal devient « Retour au salon ». On n'emmène personne de force: les résultats restent à l'écran aussi longtemps qu'on veut | |

Une partie interrompue (« Arrêter la partie ») n'a pas d'écran de fin. Proposition: elle est notée « interrompue » dans l'historique, sans effet sur le score (décision à prendre, voir le compte rendu).

### 4.2 Touches

Tab ou flèches entre « Rejouer » et « Retour au salon », Entrée. Échap: « Retour au salon ».

### 4.3 États

| État | Comportement |
|---|---|
| victoire, défaite, égalité (affrontement) | titre vu de chaque ordinateur: « Tu as gagné ! » chez le vainqueur, « Sacha a gagné » chez l'autre, « Égalité ! » |
| réussite, échec (coopération) | « Vous avez réussi ! », « Pas cette fois », sous-titre fourni par le jeu (« Niveau 3 terminé ») |
| premier score | « Premier point au score cumulé ! » au lieu de l'évolution |
| copie chez l'autre impossible (coupure à la fin) | les résultats restent enregistrés ici et seront copiés à la prochaine connexion; la ligne de confirmation le dit |
| connexion perdue sur l'écran de fin | notification; « Rejouer » devient indisponible avec la raison écrite |
| enregistrement impossible (disque plein) | message qui dit quoi faire; Duo garde les résultats et réessaie |
| l'autre veut rejouer | sa puce « Veut rejouer » |
| l'autre a choisi « Retour au salon » | sa puce « Attend dans le salon », ton bouton principal devient « Retour au salon » |

### 4.4 Textes

| Élément | Texte |
|---|---|
| titres affrontement | Tu as gagné ! · Sacha a gagné · Égalité ! |
| titres coopération | Vous avez réussi ! · Pas cette fois |
| sous-titre | Jeu témoin · 3 min 12 s |
| cartes | Camille (toi) · 9 points · Sacha · 12 points |
| bloc | Score cumulé · Jeu témoin |
| ligne | Camille 12 · Sacha 15 (+1) · 2 égalités |
| total | Tous les jeux en affrontement : Camille 31 · Sacha 34 |
| premier score | Premier point au score cumulé ! |
| coopération, bloc | Progression commune · Exemple coop |
| coopération, ligne | Niveau 4 sur 10 débloqué · 12 parties ensemble |
| confirmations | Partie enregistrée dans votre historique. · Progression enregistrée. |
| copie en attente | Résultats enregistrés sur cet ordinateur. Ils seront copiés chez Sacha à votre prochaine connexion. |
| disque plein | Impossible d'enregistrer la partie : le disque est plein. Libère de la place ; Duo garde les résultats et réessaie. |
| boutons | Rejouer (ou le libellé du jeu, par exemple Niveau suivant) · Retour au salon |
| puces | Veut rejouer · Attend dans le salon |
| rejouer impossible | Connexion perdue avec Sacha : impossible de rejouer pour l'instant. |

## 5. Parcours 5: consulter l'historique et les scores

Fonctions: F08, F09.

### 5.1 Étapes

| # | Écran | Ce que voit et fait le joueur | Focus par défaut |
|---|---|---|---|
| 1 | E05 ou barre du haut | « Voir l'historique » sur l'accueil, ou l'onglet Historique (Ctrl+3) | |
| 2 | E15 | en haut, le score cumulé des jeux en affrontement; puis un tableau par jeu (victoires, égalités, ou progression pour la coopération); puis les dernières parties, les plus récentes d'abord | filtre « Jeu » |
| 3 | E15 | le filtre « Jeu » restreint le tableau et la liste à un jeu | |
| 4 | E15 | « Afficher 20 parties de plus » en bas de la liste | |

Une partie dans la liste: date et heure, jeu, durée, résultat en phrase (« Sacha a gagné 12 à 9 », « Niveau 3 réussi »). L'historique est lisible même si l'autre ordinateur est absent: chaque ordinateur en a une copie complète.

### 5.2 Touches

Tab: filtre, tableau des jeux, liste des parties, « Afficher plus ». Flèches dans le filtre (liste déroulante) et dans la liste. Échap: retour à l'accueil.

### 5.3 États

| État | Comportement |
|---|---|
| vide | texte d'accueil et bouton « Héberger une partie » |
| chargement | « Chargement de l'historique… » (rare, fichier local) |
| copies fusionnées | si une partie jouée pendant une coupure manquait d'un côté, elle est ajoutée et c'est dit une fois. Proposition: l'historique se fusionne (aucune partie perdue), les sauvegardes suivent la règle « la plus récente l'emporte » |
| fichier abîmé | Duo restaure la copie de l'autre ordinateur ou la version précédente et le dit |
| aucun jeu en affrontement | le bloc du score cumulé l'explique |

### 5.4 Textes

| Élément | Texte |
|---|---|
| titre | Historique et scores |
| filtre | Jeu : Tous les jeux |
| bloc | Score cumulé |
| aide | Jeux en affrontement, toutes parties confondues |
| égalités | 3 égalités |
| colonnes | Jeu · Type · Camille · Sacha · Égalités · Dernière partie |
| ligne coopération | Progression : niveau 4 sur 10 · 12 parties |
| bloc | Dernières parties |
| exemple de ligne | Aujourd'hui à 21 h 40 · Jeu témoin · 3 min · Sacha a gagné 12 à 9 |
| bouton | Afficher 20 parties de plus |
| vide | Pas encore de partie. Votre historique commencera à la fin de votre première partie. |
| vide, bouton | Héberger une partie |
| aucun affrontement | Le score cumulé compte les jeux en affrontement. Vous n'en avez pas encore joué. |
| fusion | 2 parties jouées pendant une coupure ont été ajoutées depuis l'ordinateur de Sacha. |
| abîmé, récupéré chez l'autre | L'historique de cet ordinateur était abîmé : Duo l'a récupéré depuis l'ordinateur de Sacha. |
| abîmé, version précédente | L'historique de cet ordinateur était abîmé : Duo a restauré sa version du 28 octobre. Les parties suivantes reviendront à votre prochaine connexion avec Sacha. |

## 6. Parcours 6: régler

Fonctions: F01, F10, et F02 pour l'onglet Réseau.

### 6.1 Étapes

| # | Écran | Ce que voit et fait le joueur | Focus par défaut |
|---|---|---|---|
| 1 | E16 | onglet Réglages (Ctrl+4, ⌘, sur Mac) | onglet Profil |
| 2 | E16 | onglets verticaux: Profil, Son, Affichage, Touches, Réseau, À propos. Flèches haut et bas pour changer d'onglet, Tab pour entrer dans son contenu | |
| 3 | E16 | chaque changement s'applique et s'enregistre tout de suite; « Enregistré » s'affiche 2 s. Seul le pseudo se valide (Entrée ou « Enregistrer ») | |
| 4 | E16 | Échap: retour à l'écran précédent | |

Depuis la pause d'une partie, « Réglages » ouvre les onglets Son, Affichage et Touches (celles du jeu en cours).

Contenu des onglets:

- **Profil**: pseudo (mêmes règles qu'en E02), couleur (la couleur de Sacha est indisponible, marquée « Prise par Sacha »). Les changements s'affichent tout de suite chez Sacha si Sacha est là, sinon à la prochaine connexion.
- **Son**: quatre curseurs, Général, Musique, Effets, Interface, de 0 à 100 %. Flèches: 5 % par appui; Origine et Fin: 0 et 100 %. Un son court confirme chaque changement. À 0 %, le curseur indique « Coupé ».
- **Affichage**: « Fenêtre » ou « Plein écran » (avec le raccourci écrit); « Taille de l'interface »: 100 %, 125 %, 150 %, appliquée tout de suite; « Réduire les animations », qui suit au départ le réglage de l'ordinateur.
- **Touches**: choix du jeu, puis la liste de ses actions avec leur touche. « Modifier » attend la nouvelle touche; Échap annule. Une touche déjà prise propose l'échange. Échap n'est jamais attribuable. « Rétablir les touches par défaut » demande confirmation. Les touches ne concernent que le clavier de cet ordinateur.
- **Réseau**: nom et adresse de cet ordinateur (pour le recours de l'autre), état de l'autre ordinateur, « Lancer le diagnostic » (E17), « Revoir l'explication des autorisations » (E03).
- **À propos**: version de Duo et de chaque jeu, « Copier les informations pour le studio », « Crédits et licences » (obligatoire pour les ressources sous CC-BY).

### 6.2 Touches

| Zone | Touches |
|---|---|
| onglets | flèches haut et bas, Origine, Fin; Tab entre dans le contenu |
| curseurs | flèches gauche et droite (5 %), Origine (0 %), Fin (100 %) |
| choix (fenêtre, taille, couleur) | flèches |
| cases à cocher | Espace |
| capture d'une touche | la prochaine touche appuyée est retenue; Échap annule |
| partout | Échap: retour (ou annule la capture en cours) |

### 6.3 États

| État | Comportement |
|---|---|
| changement enregistré | « Enregistré » 2 s près du réglage, annoncé aux lecteurs d'écran |
| pseudo vide ou caractère refusé | mêmes messages qu'en E02 |
| touche déjà prise | fenêtre d'échange |
| touche réservée | message, la capture continue |
| enregistrement des réglages impossible | message: les réglages s'appliquent jusqu'à la fermeture de Duo |
| taille de l'interface trop grande pour la fenêtre | la page défile verticalement |
| autre ordinateur absent (Réseau) | état écrit et bouton du diagnostic |

### 6.4 Textes

| Onglet | Élément | Texte |
|---|---|---|
| tous | titre | Réglages |
| tous | onglets | Profil · Son · Affichage · Touches · Réseau · À propos |
| tous | confirmation | Enregistré |
| Profil | champ | Pseudo |
| Profil | bouton | Enregistrer |
| Profil | groupe | Ta couleur |
| Profil | couleur indisponible | Prise par Sacha |
| Profil | aide | Sacha voit tes changements tout de suite. (absent : Sacha les verra à votre prochaine connexion.) |
| Son | curseurs | Volume général · Musique · Effets · Interface |
| Son | à zéro | Coupé |
| Affichage | groupe | Mode d'affichage : Fenêtre · Plein écran (F11) |
| Affichage | groupe | Taille de l'interface : 100 % · 125 % · 150 % |
| Affichage | case | Réduire les animations |
| Affichage | aide | Au départ, Duo suit le réglage de ton ordinateur. |
| Touches | choix | Jeu : Jeu témoin |
| Touches | aide | Ces touches ne concernent que le clavier de cet ordinateur. |
| Touches | colonnes | Action · Touche |
| Touches | bouton | Modifier |
| Touches | capture | Appuie sur la nouvelle touche pour « Avancer ». Échap : annuler. |
| Touches | touche prise | Z sert déjà à « Avancer ». Échanger les deux touches ? · Échanger · Annuler |
| Touches | touche réservée | Échap sert à mettre en pause dans tous les jeux. Choisis une autre touche. |
| Touches | ligne réservée | Pause · Échap (réservée) |
| Touches | bouton | Rétablir les touches par défaut |
| Touches | fenêtre | Rétablir les touches de Jeu témoin ? · Tes changements pour ce jeu seront effacés. · Rétablir · Annuler |
| Réseau | lignes | Cet ordinateur : « MacBook Air de Camille » · Adresse : 192.168.1.42 |
| Réseau | autre ordinateur | Sacha est là, sur « PC-SACHA ». (ou : Sacha n'est pas visible pour l'instant.) |
| Réseau | boutons | Lancer le diagnostic · Revoir l'explication des autorisations |
| À propos | lignes | Duo 1.0.0 · Jeu témoin 1.0.0 |
| À propos | boutons | Copier les informations pour le studio · Crédits et licences |
| À propos | confirmation | Informations copiées : colle-les dans ton message au studio. |
| erreur | texte | Impossible d'enregistrer tes réglages. Ils s'appliquent quand même jusqu'à la fermeture de Duo. |

## 7. Parcours 7: recevoir un nouveau jeu

Fonctions: F12, F13, F04.

### 7.1 Étapes

| # | Ce qui se passe | Écran |
|---|---|---|
| 1 | Au démarrage, puis régulièrement, Duo regarde s'il existe de nouveaux jeux ou des mises à jour, seulement si Internet est disponible, jamais pendant une partie | |
| 2 | Proposition: un nouveau jeu ou une mise à jour se télécharge et s'installe tout seul en arrière-plan (les jeux sont légers; aucune action à faire, aucune réinstallation de Duo) | carte « Téléchargement : 45 % » dans E07 |
| 3 | Notification « Nouveau jeu : Exemple duel est dans la bibliothèque. » avec « Voir » | E05 ou tout écran hors partie |
| 4 | « Voir » ouvre la bibliothèque, focus sur le nouveau jeu, badge « Nouveau » jusqu'à la première partie | E07 |
| 5 | L'autre ordinateur reçoit le même jeu de son côté. S'il n'a pas Internet, la vérification des versions du salon propose de le copier depuis l'ordinateur qui l'a (proposition, à confirmer par architecte-technique et dev-reseau) | E06, E08 |

Recherche à la demande: « Chercher de nouveaux jeux » dans la bibliothèque.

Une mise à jour prête pendant une partie attend la fin de la partie. Les sauvegardes sont conservées d'une version à l'autre (la migration éventuelle est le travail du jeu).

### 7.2 Touches

Notification: elle ne prend pas le focus. Tab l'atteint en dernier; Entrée sur « Voir ». Dans la bibliothèque, le nouveau jeu a le focus.

### 7.3 États

| État | Comportement |
|---|---|
| recherche en cours | « Recherche de nouveaux jeux… » à côté du bouton |
| rien de nouveau | « Tu as déjà tous les jeux. » |
| pas d'Internet | message rassurant: les jeux installés restent jouables, Duo réessaiera |
| téléchargement | progression sur la carte, jeu « Pas encore jouable » |
| échec du téléchargement | message, Duo réessaie tout seul, bouton « Réessayer maintenant » |
| fichier abîmé | Duo le supprime et recommence tout seul |
| disque plein | combien de place il faut, quoi faire |
| jeu qui demande une version plus récente de Duo | carte indisponible, explication et lien « Comment mettre Duo à jour » |
| mise à jour d'un jeu | badge « Mis à jour », « Quoi de neuf » dans la fiche |
| versions différentes entre les deux ordinateurs | section 9 |

### 7.4 Textes

| Élément | Texte |
|---|---|
| bouton | Chercher de nouveaux jeux |
| recherche | Recherche de nouveaux jeux… |
| rien de nouveau | Tu as déjà tous les jeux. |
| pas d'Internet | Pas de connexion à Internet. Les jeux installés restent jouables, et Duo réessaiera tout seul. |
| notification | Nouveau jeu : Exemple duel est dans la bibliothèque. · Voir |
| notification de mise à jour | Jeu témoin a été mis à jour (version 1.1). · Voir |
| badges | Nouveau · Mis à jour · Pas encore jouable |
| téléchargement | Téléchargement : 45 % |
| échec | Téléchargement interrompu : Exemple duel. Duo réessaiera tout seul. · Réessayer maintenant |
| fichier abîmé | Le fichier téléchargé était abîmé. Duo recommence le téléchargement. |
| disque plein | Il manque 120 Mo sur le disque pour installer Exemple duel. Libère de la place, puis réessaie. · Réessayer |
| Duo trop ancien | Exemple duel demande Duo 1.1 ou plus récent (ici 1.0.2). · Comment mettre Duo à jour |
| mise à jour en attente | La mise à jour de Jeu témoin est prête : elle s'installera à la fin de la partie. |
| fiche | Quoi de neuf |
| sauvegardes | Tes sauvegardes sont conservées. |

## 8. Diagnostic: l'autre ordinateur n'apparaît pas (F02)

Exemples vus depuis le PC de Sacha (192.168.1.23), l'autre ordinateur étant le Mac de Camille (192.168.1.42). Écran E17, ouvert depuis: E04 (premier lancement), la ligne de présence de l'accueil, le salon de l'hôte qui attend, la superposition de connexion perdue (par-dessus le jeu figé), Réglages > Réseau.

### 8.1 Étapes

| # | Ce que voit et fait le joueur |
|---|---|
| 1 | Duo lance tout seul ses vérifications et affiche chaque résultat: réussi (coche), problème (croix), à vérifier soi-même (point d'interrogation) |
| 2 | Chaque problème dit quoi faire, avec un bouton qui ouvre le bon réglage du système |
| 3 | « Relancer les vérifications » après une correction |
| 4 | Dernier recours: « Se connecter avec une adresse ». L'adresse à taper s'affiche sur l'autre ordinateur (Réglages > Réseau, et dans son salon). Duo la retient pour la prochaine fois |
| 5 | « Copier le rapport pour le studio » si rien ne marche |

Vérifications (dev-reseau fixe comment les détecter; celles qui ne sont pas détectables restent « à vérifier soi-même »):

| Vérification | Système | Si problème |
|---|---|---|
| Cet ordinateur est connecté à un réseau | les deux | se connecter au Wi-Fi de la maison |
| Le réseau est réglé sur « Privé » | Windows | marche à suivre et bouton « Ouvrir les paramètres réseau » |
| Le pare-feu de Windows laisse passer Duo | Windows | marche à suivre et bouton « Ouvrir le pare-feu » |
| Duo a accès au réseau local | macOS | marche à suivre et bouton « Ouvrir les Réglages Système » |
| Le coupe-feu de macOS accepte Duo (s'il est activé) | macOS | Réglages Système > Réseau > Coupe-feu > Options, Duo: autoriser les connexions entrantes |
| Aucun VPN actif | les deux | le couper le temps de jouer |
| Les deux ordinateurs se voient dans les deux sens | les deux | si Sacha te voit mais que tu ne vois pas Sacha, le blocage est de ton côté, et inversement: Duo dit lequel |
| Duo est ouvert sur l'autre ordinateur | à vérifier soi-même | |
| Même Wi-Fi, et pas le Wi-Fi « invités » de la box (il empêche souvent les appareils de se voir) | à vérifier soi-même | |

### 8.2 Touches

Tab: vérifications et leurs boutons, puis « Relancer les vérifications », puis le champ d'adresse et « Se connecter », puis « Copier le rapport ». Entrée dans le champ: se connecter. Échap: retour à l'écran d'où l'on vient.

### 8.3 États de la connexion avec une adresse

| État | Comportement |
|---|---|
| saisie | exemple dans le champ, aide qui dit où trouver l'adresse |
| adresse mal écrite | message sous le champ, focus dans le champ |
| connexion en cours | « Connexion à 192.168.1.42… » |
| réussite | « Camille est là. Duo retiendra cette adresse. »; retour à l'écran d'origine |
| pas de réponse | message qui dit quoi vérifier |
| un appareil répond, mais pas Duo | message dédié |
| versions différentes | section 9 |

### 8.4 Textes

| Élément | Texte |
|---|---|
| titre | L'autre ordinateur n'apparaît pas ? |
| intro | Duo vérifie ce qui peut l'empêcher de voir l'autre ordinateur. |
| réseau, réussi | Cet ordinateur est connecté au réseau (Wi-Fi). |
| réseau, problème | Cet ordinateur n'est connecté à aucun réseau. Connecte-le au Wi-Fi de la maison. |
| Windows, profil, réussi | Le réseau est réglé sur « Privé ». |
| Windows, profil, problème | Ton réseau est réglé sur « Public » : Windows y empêche les ordinateurs de se voir. Si c'est le réseau de ta maison, passe-le sur « Privé » : Ouvrir les paramètres réseau, choisis ton réseau, puis « Type de profil réseau » : « Privé ». |
| Windows, pare-feu, réussi | Le pare-feu de Windows laisse passer Duo. |
| Windows, pare-feu, problème | Le pare-feu de Windows bloque Duo. Ouvre le pare-feu, clique sur « Modifier les paramètres », coche Duo dans la colonne « Privé », puis « OK ». |
| macOS, réussi | Duo a accès au réseau local. |
| macOS, problème | macOS empêche Duo de voir le réseau local. Ouvre Réglages Système > Confidentialité et sécurité > Réseau local, et active Duo. |
| macOS, coupe-feu | Le coupe-feu de macOS bloque Duo. Ouvre Réglages Système > Réseau > Coupe-feu > Options, et choisis « Autoriser les connexions entrantes » pour Duo. |
| VPN, réussi | Aucun VPN actif. |
| VPN, problème | Un VPN est actif : il peut cacher l'autre ordinateur. Coupe-le le temps de jouer. |
| sens unique | Camille voit cet ordinateur, mais cet ordinateur ne voit pas Camille : le blocage est sur cet ordinateur. (ou l'inverse : le blocage est sur l'ordinateur de Camille.) |
| à vérifier | Duo est-il ouvert sur l'autre ordinateur ? |
| à vérifier | Les deux ordinateurs sont-ils sur le même Wi-Fi ? Pas le Wi-Fi « invités » de la box : il empêche souvent les appareils de se voir. |
| boutons | Ouvrir les paramètres réseau · Ouvrir le pare-feu · Ouvrir les Réglages Système · Relancer les vérifications |
| bloc | Se connecter avec une adresse |
| aide | L'adresse s'affiche sur l'autre ordinateur, dans Réglages > Réseau, et dans son salon. |
| champ | Adresse de l'autre ordinateur (exemple : 192.168.1.42) |
| bouton | Se connecter |
| adresse de cet ordinateur | Adresse de cet ordinateur : 192.168.1.23 |
| mal écrite | Ce n'est pas une adresse valide. Exemple : 192.168.1.42 |
| en cours | Connexion à 192.168.1.42… |
| réussite | Camille est là. Duo retiendra cette adresse. |
| pas de réponse | Pas de réponse de 192.168.1.42. Vérifie l'adresse, et que Duo est ouvert sur l'autre ordinateur. |
| pas Duo | Un appareil répond à cette adresse, mais ce n'est pas Duo. Vérifie l'adresse affichée sur l'autre ordinateur. |
| bouton | Copier le rapport pour le studio |
| confirmation | Rapport copié : colle-le dans ton message au studio. |

## 9. Versions incompatibles (F13)

Les deux ordinateurs comparent leurs versions dès qu'ils se voient (et pas seulement au moment de rejoindre): le problème s'affiche sur l'accueil avant même d'essayer de jouer. On propose toujours de mettre à jour vers la version la plus récente, jamais de revenir en arrière. Les règles de compatibilité exactes (quelles versions peuvent jouer ensemble) sont fixées par architecte-technique et dev-reseau; ces écrans couvrent le cas « incompatibles ».

| Cas | Où | Chez l'ordinateur en retard | Chez l'ordinateur à jour | Action |
|---|---|---|---|---|
| Duo différent | accueil (ligne de présence), E04 | Duo n'a pas la même version sur vos deux ordinateurs : ici 1.0.2, chez Sacha 1.0.3. Installe la version 1.0.3 sur cet ordinateur pour jouer ensemble. | Sacha doit installer Duo 1.0.3 pour jouer avec toi. C'est expliqué sur son écran. | Comment mettre Duo à jour (guide pas à pas, la mise à jour automatique de Duo est prévue plus tard) |
| jeu plus ancien chez l'invité | invitation (E06) | Ta version de ce jeu est plus ancienne que celle de Camille. | Sacha met le jeu à jour… | Mettre à jour et rejoindre (2 Mo) |
| jeu plus ancien chez l'hôte | salon (E08), invitation | Sacha a une version plus récente d'Exemple coop (1.2). Mets la tienne à jour pour jouer ensemble. | Camille doit d'abord mettre ce jeu à jour. C'est indiqué sur son écran. | Mettre à jour (2 Mo) |
| jeu absent chez l'invité | invitation (E06) | Tu n'as pas encore ce jeu. | Sacha installe le jeu… | Installer et rejoindre (12 Mo) |
| pas d'Internet pour la mise à jour | invitation, salon | Pas de connexion à Internet pour télécharger le jeu. | | Copier depuis l'ordinateur de Camille (proposition) |
| jeu qui demande un Duo plus récent | bibliothèque | Exemple duel demande Duo 1.1 ou plus récent (ici 1.0.2). | | Comment mettre Duo à jour |
| sauvegarde venue d'une version plus récente du jeu | salon | Cette sauvegarde vient d'une version plus récente d'Exemple coop. Mets le jeu à jour pour la reprendre. | | Mettre à jour (2 Mo) |

## 10. Liste des écrans

| Id | Écran | Rôle | Fonctions | Focus par défaut | Wireframe |
|---|---|---|---|---|---|
| E00 | Guide d'installation (hors de l'application) | passer les alertes de sécurité de macOS et de Windows au premier lancement | F11 | | texte en 1.1, à mettre en page avec ingenieur-build |
| E01 | Bienvenue | dire ce qu'est Duo, annoncer les trois étapes | F11 | Commencer | `premier-lancement.html#bienvenue` |
| E02 | Profil | pseudo et couleur de cet ordinateur | F01 | champ Pseudo | `premier-lancement.html#profil` |
| E03 | Autorisations réseau | expliquer avant la fenêtre du système, guider en cas de refus | F02, F11 | Continuer | `premier-lancement.html#reseau-macos`, `#reseau-windows` |
| E04 | L'autre ordinateur | vérifier que l'autre est visible, former le duo | F02, F13 | Terminer (quand trouvé) | `premier-lancement.html#recherche`, `#trouve` |
| E05 | Accueil | présence de l'autre, les deux actions centrales, reprendre, score cumulé | F02, F09, F12, F13 | Héberger une partie (Rejoindre si une invitation attend) | `accueil.html` (états `#absent`, `#versions`) |
| E06 | Bandeau d'invitation | rejoindre d'une touche, depuis n'importe quel écran hors partie | F02, F03, F13 | Rejoindre | `accueil.html#invitation` |
| E07 | Bibliothèque et fiche du jeu | choisir un jeu à héberger, voir sa fiche, ses sauvegardes, les nouveautés | F04, F07, F12, F13 | dernier jeu joué | `bibliotheque.html` |
| E08 | Salon (hôte, invité) | les deux joueurs et leur état, le jeu, la sauvegarde, le départ | F03, F07, F13, F06 | C'est parti ! | `salon-hote.html` (états `#attente`, `#decompte`), `salon-invite.html` |
| E09 | Chargement | charger le jeu des deux côtés, rappeler les commandes | F05 | | (pas de wireframe: modèle simple) |
| E10 | Partie | le jeu; la plateforme n'affiche que l'indice « Échap : pause » et l'indicateur d'enregistrement | F05 | | |
| E11 | Superposition de pause | pause commune, commandes, réglages, retour au salon | F05, F10, F07 | Reprendre | `superposition.html#pause` |
| E12 | Superposition de connexion perdue | pause automatique, attente, reprise | F06 | Que faire ? | `superposition.html#deconnexion` |
| E13 | Fenêtre « Le jeu s'est arrêté » (sur le salon) | revenir au salon sans fermer Duo, rassurer sur la sauvegarde | F05, F07 | Compris | (fenêtre de confirmation standard) |
| E14 | Fin de partie | résultat, scores, score cumulé, rejouer ou revenir au salon | F05, F08, F09, F07 | Rejouer | `fin-de-partie.html` (état `#cooperation`) |
| E15 | Historique et scores | score cumulé, scores par jeu, dernières parties | F08, F09 | filtre Jeu | `historique.html` |
| E16 | Réglages | profil, son, affichage, touches, réseau, à propos | F01, F10, F02 | onglet Profil | `reglages.html` (état `#touches`) |
| E17 | Diagnostic et connexion avec une adresse | dire pourquoi l'autre n'apparaît pas et comment corriger | F02, F13 | Relancer les vérifications | `diagnostic.html` (état `#macos`) |
| E18 | Messages de versions | dire qui doit mettre à jour quoi, et le faire en un bouton | F13 | le bouton de mise à jour | dans `accueil.html#versions` et la section 9 |
| E19 | Nouveau jeu (notification et cartes) | annoncer et montrer les jeux reçus | F12 | Voir | cartes de `bibliotheque.html` |

## 11. Couverture des fonctions F01 à F13

| Fonction | Parcours | Écrans |
|---|---|---|
| F01 Profil | P1, P6 | E02, E04 (couleur prise), E16 Profil, cartes de joueur partout |
| F02 Découverte et connexion | P1, P2, P3, P6 | E03, E04, E05 (présence, Rejoindre), E06, E16 Réseau, E17 |
| F03 Salon | P2 | E06, E08 |
| F04 Bibliothèque | P2, P7 | E07 |
| F05 Cycle de vie d'un jeu | P2, P3, P4 | E09, E10, E11, E13, E14 |
| F06 Déconnexion | P3 (et P2 pour le salon) | E12, E08 |
| F07 Sauvegardes | P2, P3, P4 | E07 (fiche, copies de secours), E08 (choix), E11 et E12 (ce qui est gardé), E13, E14 |
| F08 Historique | P4, P5 | E14, E15 |
| F09 Score cumulé | P4, P5 | E05, E14, E15 |
| F10 Réglages | P3, P6 | E11 Réglages, E16 |
| F11 Installation | P1 | E00, E01, E03 |
| F12 Nouveaux jeux | P7 | E05 (notification), E07, E19 |
| F13 Compatibilité | P1, P2, P7 | E04, E05, E06, E08, E18 |

## 12. Comptage des actions (critère d'acceptation)

Une action est un appui sur Entrée ou un clic qui fait avancer le parcours. Se déplacer avec les flèches pour choisir un autre jeu ou une autre sauvegarde ne compte pas.

| Joueur | Depuis | Actions | Total |
|---|---|---|---|
| Hôte | accueil | 1. Héberger une partie (focus par défaut) · 2. Entrée sur un jeu de la bibliothèque · 3. C'est parti ! | 3 |
| Hôte | accueil, bloc Reprendre | 1. Héberger cette partie · 2. C'est parti ! | 2 |
| Invité | n'importe quel écran hors partie | 1. Rejoindre (focus par défaut dans le bandeau) | 1 |

La partie démarre après le compte à rebours de 3 s, sans autre action. Preuve: `node design/maquettes/plateforme-wireframes/verifier-clavier.js` rejoue ces séquences au clavier seul sur les wireframes.

## 13. Dépendances et points à trancher avec l'équipe

| Pour | Point |
|---|---|
| architecte-technique, dev-reseau | Présence: chaque Duo ouvert s'annonce sur le réseau (pas seulement l'hôte), pour que l'accueil dise « Sacha est là » et compare les versions avant toute invitation |
| architecte-technique, dev-reseau | Premier lancement: aucune connexion réseau avant « Continuer » en E03, sinon la fenêtre du système précède l'explication |
| dev-reseau | Détection de l'état des autorisations (réseau local de macOS, règle du pare-feu et profil du réseau sous Windows), test de visibilité dans les deux sens, détection d'un VPN |
| dev-reseau | Adresse saisie retenue pour la prochaine fois; recours possible dans les deux sens |
| architecte-technique | Reprise après la fermeture de Duo chez l'hôte: depuis la dernière sauvegarde, ou depuis un instantané de la partie |
| architecte-technique, dev-reseau | Copie d'un jeu depuis l'autre ordinateur quand l'un n'a pas Internet |
| architecte-technique | Fusion de l'historique (aucune partie perdue) et règle « la plus récente l'emporte » pour les sauvegardes |
| dev-plateforme | Contrat des jeux: chaque jeu fournit ses textes de fin (statistiques, libellé de « Rejouer »), ses moments d'enregistrement (pour « ce qui sera perdu »), ses commandes par défaut; Échap lui est interdite |
| directeur-artistique | Six couleurs de joueur, chacune liée à un symbole, distinguables deux à deux en niveaux de gris et pour les daltoniens; anneau de focus visible sur tous les fonds; superposition sans flou |
| sound-designer | Signal d'invitation, compte à rebours, connexion perdue et retour, confirmation de réglage du son |
| ingenieur-build | Guide d'installation (E00); test typographique du fichier de textes (espaces insécables, aucun tiret cadratin ni demi-cadratin) |
| qa-testeur | Critères tirés des sections 0.5, 0.8 et 12: comptage des actions, focus par défaut, anti-double-appui, tailles d'écran |
