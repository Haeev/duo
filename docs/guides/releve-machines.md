# Relever la configuration de vos deux ordinateurs

Avant de fabriquer Duo, le studio a besoin de connaître vos deux ordinateurs: ce que le PC peut afficher (processeur, mémoire, disque, carte graphique, écran) et la façon dont Duo s'y installera et s'y connectera (version du système, protections de Windows, réseau, compte).

- Durée: environ 9 minutes sur le PC et 3 minutes sur le Mac.
- Rien à installer, rien à modifier: tu regardes et tu notes. Si une fenêtre propose de changer un réglage, ne le fais pas pour l'instant.
- Chaque information va dans une case numérotée du tableau, à la fin de ce guide. Il suffit ensuite de l'envoyer au manager.
- N'envoie jamais de mot de passe, ni le numéro de série du Mac, ni le nom de l'appareil, ni une adresse e-mail: le studio n'en a pas besoin.
- Les noms des menus sont ceux de Windows 11 et de macOS en français. S'ils diffèrent un peu chez toi, note ce que tu vois: c'est utile aussi.
- En cas de doute, une capture d'écran suffit (sur le PC: touches Windows + Maj + S; sur le Mac: Cmd + Maj + 4). Vérifie seulement qu'elle ne montre pas le numéro de série.

## Sur le PC Windows

### Étape 1: processeur, mémoire et version de Windows (2 minutes)

1. Fais un clic droit sur le bouton Démarrer (le logo Windows, en bas de l'écran).
2. Dans le menu qui s'ouvre, clique sur « Système ». La page « Informations système » s'ouvre.
   Si « Système » n'apparaît pas: appuie sur les touches Windows + I pour ouvrir les Paramètres, clique sur « Système », puis tout en bas sur « Informations système ».
3. Dans le cadre « Spécifications de l'appareil », note:
   - « Processeur »: case 1;
   - « Mémoire RAM installée »: case 2;
   - « Type du système »: case 3.
4. Dans le cadre « Spécifications de Windows », note:
   - « Édition »: case 4;
   - « Version »: case 5;
   - « Build du système d'exploitation »: case 6.

### Étape 2: disque et carte graphique (2 minutes)

1. Appuie en même temps sur les touches Ctrl + Maj + Échap: le Gestionnaire des tâches s'ouvre. Si sa fenêtre est toute petite, clique d'abord sur « Plus de détails ».
2. Dans la colonne de gauche, clique sur « Performances » (l'icône en forme de courbe).
3. Clique sur la ligne « Disque 0 (C:) ». Sous le graphique, la ligne « Type » indique « SSD » ou « HDD » (disque dur): case 7. Si tu ne vois pas de ligne « Type », note le nom du disque affiché en haut à droite.
4. Clique sur la ligne « GPU 0 ». En haut à droite s'affiche le nom de la carte graphique: case 8. Sous le graphique, note:
   - « Version du pilote »: case 9;
   - « Date du pilote »: case 10.
5. S'il y a aussi une ligne « GPU 1 », clique dessus et note son nom: case 11. Sinon, écris « aucune ».
6. Ferme le Gestionnaire des tâches.

### Étape 3: écran (1 minute)

1. Fais un clic droit sur un endroit vide du Bureau, puis clique sur « Paramètres d'affichage ».
2. Si plusieurs écrans sont branchés, clique en haut de la page sur le rectangle de l'écran sur lequel tu joueras.
3. Dans la partie « Mise à l'échelle et disposition », note:
   - « Résolution de l'écran »: case 12;
   - « Échelle »: case 13.
4. Note aussi si le PC est un ordinateur portable ou un PC fixe: case 14.

### Étape 4: Smart App Control (1 minute)

Smart App Control, appelé « Contrôle intelligent des applications » dans Windows en français, est une protection qui bloque les applications sans signature payante, ce qui est le cas de Duo. Le studio doit savoir s'il est actif.

1. Clique sur le bouton Démarrer, tape « Sécurité Windows », puis ouvre l'application « Sécurité Windows ».
2. Clique sur « Contrôle des applications et du navigateur ».
3. Dans le cadre « Contrôle intelligent des applications », clique sur « Paramètres du contrôle intelligent des applications ».
4. Note le choix coché: « Activé », « Évaluation » ou « Désactivé »: case 15. Si ce cadre n'existe pas, écris « absent ».
5. Ne change rien: le studio te dira s'il faut le faire, et pourquoi.

### Étape 5: réseau (1 minute)

Vérifie d'abord que le PC est connecté au réseau de la maison, celui sur lequel vous jouerez.

1. Appuie sur les touches Windows + I pour ouvrir les Paramètres, puis clique sur « Réseau et Internet ».
2. En haut de la page, tu vois la connexion en cours: « Wi-Fi » ou « Ethernet » (par câble). Note-la: case 16.
3. Clique sur « Propriétés », à côté de cette connexion.
4. Sous « Type de profil réseau », note le choix coché: « Réseau public » ou « Réseau privé » (l'un des deux peut porter la mention « recommandé »): case 17.
5. Ne change rien pour l'instant: Duo te guidera le moment venu.

### Étape 6: compte et dossier personnel (2 minutes)

1. Appuie sur les touches Windows + I pour ouvrir les Paramètres, puis clique sur « Comptes ».
2. En haut de la page, regarde si le mot « Administrateur » est écrit sous ton nom. Note « administrateur » si c'est le cas, « standard » sinon: case 18.
3. Si le compte est standard: connais-tu le mot de passe d'un compte administrateur de ce PC? Réponds seulement « oui » ou « non », sans jamais écrire le mot de passe: case 19.
4. Ouvre l'Explorateur de fichiers (touches Windows + E).
5. Clique dans la barre d'adresse, tout en haut de la fenêtre, efface ce qui s'y trouve, tape `%USERPROFILE%` puis appuie sur Entrée.
6. Clique de nouveau dans la barre d'adresse: elle affiche le chemin complet de ton dossier personnel, par exemple `C:\Users\Camille`. Note le dernier morceau, après le dernier `\`, exactement comme il est écrit (majuscules, accents, espaces): case 20.
   Si tu préfères ne pas l'écrire, réponds seulement à ces deux questions dans la case 20: contient-il un accent ou un autre signe qu'une lettre ou un chiffre? Contient-il un espace?

Pourquoi cette question: un accent ou un espace dans ce nom est un piège classique pour les logiciels, et le studio veut tester exactement ton cas.

## Sur le Mac

### Étape 7: modèle, puce, mémoire et version de macOS (2 minutes)

1. Clique sur le menu Pomme (la pomme, tout en haut à gauche de l'écran), puis sur « À propos de ce Mac ».
2. Note:
   - le nom du modèle écrit en gros (par exemple « MacBook Air ») et la ligne juste en dessous (par exemple « M1, 2020 »): case 21;
   - « Puce »: case 22;
   - « Mémoire »: case 23;
   - la ligne « macOS », avec son nom et son numéro de version: case 24.
3. Ne recopie pas le « Numéro de série ».

### Étape 8: compte (1 minute)

1. Clique sur le menu Pomme, puis sur « Réglages Système ».
2. Dans la colonne de gauche, clique sur « Utilisateurs et groupes » (fais défiler la colonne si besoin).
3. Sous ton nom, il est écrit « Administrateur » ou « Standard »: case 25.

## Pour les deux ordinateurs

Case 26: le Mac et le PC sont-ils reliés à la même box, en Wi-Fi ou par câble? Réponds « oui » ou « non ».

## Le tableau à renvoyer

Recopie ce tableau dans ton message au manager, ou réponds simplement avec les numéros des cases (« 1: ..., 2: ... »). Les exemples montrent seulement la forme attendue: ce ne sont pas les bonnes réponses.

| Case | Ordinateur | Information | Exemple | Ta réponse |
|---|---|---|---|---|
| 1 | PC | Processeur | Intel(R) Core(TM) i3-8130U CPU @ 2.20GHz | |
| 2 | PC | Mémoire RAM installée | 8,00 Go | |
| 3 | PC | Type du système | Système d'exploitation 64 bits, processeur x64 | |
| 4 | PC | Édition de Windows | Windows 11 Famille | |
| 5 | PC | Version de Windows | 24H2 | |
| 6 | PC | Build du système d'exploitation | 26100.4061 | |
| 7 | PC | Type du disque C: | SSD | |
| 8 | PC | Carte graphique (GPU 0) | Intel(R) UHD Graphics 620 | |
| 9 | PC | Version du pilote graphique | 31.0.101.2111 | |
| 10 | PC | Date du pilote graphique | 12/03/2024 | |
| 11 | PC | Deuxième carte graphique (GPU 1) | aucune | |
| 12 | PC | Résolution de l'écran | 1920 × 1080 | |
| 13 | PC | Échelle | 125 % | |
| 14 | PC | Portable ou PC fixe | portable | |
| 15 | PC | Contrôle intelligent des applications | Désactivé | |
| 16 | PC | Connexion | Wi-Fi | |
| 17 | PC | Type de profil réseau | Réseau privé | |
| 18 | PC | Compte | administrateur | |
| 19 | PC | Si le compte est standard: mot de passe d'un administrateur connu | oui | |
| 20 | PC | Nom du dossier personnel (ou les deux réponses: accent? espace?) | Camille | |
| 21 | Mac | Modèle et ligne du dessous | MacBook Air, M1, 2020 | |
| 22 | Mac | Puce | Apple M1 | |
| 23 | Mac | Mémoire | 8 Go | |
| 24 | Mac | macOS (nom et version) | Sequoia 15.6 | |
| 25 | Mac | Compte | Administrateur | |
| 26 | Les deux | Même box | oui | |

Merci! Ces réponses permettent au studio de régler les jeux pour le PC, de préparer l'installation de Duo sur les deux ordinateurs et de te prévenir à l'avance si une protection de Windows doit être désactivée.
