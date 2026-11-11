# Journal des versions de Duo

Les changements de l'application Duo, version par version, écrits pour les deux joueurs. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent [SemVer](https://semver.org/lang/fr/), propres à l'application (le SDK et chaque jeu ont les leurs).

À chaque version: une section `## [X.Y.Z] - AAAA-MM-JJ`, une première phrase qui résume la version (elle s'affiche dans l'avis de nouvelle version), puis les rubriques utiles parmi Ajouté, Modifié, Corrigé, Retiré et Sécurité. La publication échoue si la section de la version manque.

## [Non publié]

## [0.4.0] - 2026-11-11

Duo te prévient désormais quand une nouvelle version est prête, garde l'historique de tes séances dans le salon de chaque jeu, et montre la mise à jour des jeux pendant qu'elle se fait.

Cette version reprend aussi tout le contenu de la 0.3.1, qui n'a jamais été publiée. Installe-la sur les deux ordinateurs: tes sauvegardes et tes jeux sont gardés.

### Ajouté

- Avis de nouvelle version: au démarrage, puis toutes les 6 heures si Duo reste ouvert, Duo regarde si une version plus récente est publiée. Si oui, un bandeau en haut de la bibliothèque dit « Duo X.Y.Z est disponible », résume la nouveauté et propose « Télécharger » (le bon fichier pour ton ordinateur s'ouvre dans ton navigateur; rien ne s'installe tout seul) ou « Plus tard » (le bandeau ne revient qu'au prochain lancement de Duo ou à la version suivante). Sans Internet, rien ne s'affiche et rien n'est bloqué; jamais pendant une partie.
- Dans le salon d'un jeu, un bloc « Dernières séances » montre les trois dernières séances jouées sur cet ordinateur: date, durée, avancement, et les nombres que le jeu donne (pour La Petite Ligne: jours vécus, étapes de quête franchies, entrées de collection ajoutées). Les mêmes nombres apparaissent à l'écran de fin quand on revient au salon depuis la pause.

- Venu de la 0.3.1: la mise à jour d'un jeu se voit sur sa carte et dans son salon (progression, installation, « à jour »), le jeu attend la fin de l'installation pour se lancer, et un échec propose « Réessayer » ou de jouer quand même à la version installée. Sans Internet, rien n'est bloqué. Dans le salon, Duo dit lequel des deux ordinateurs doit mettre son jeu à jour quand les versions diffèrent.

### Modifié

- Si le fichier d'une mise à jour de jeu arrive abîmé, Duo ne l'installe pas et le dit clairement; ta version actuelle du jeu reste jouable.

## [0.3.1] - 2026-11-04

Duo montre quand il télécharge la mise à jour d'un jeu et attend qu'elle soit installée avant de le lancer.

Cette version n'a jamais été publiée: tout son contenu est sorti dans la 0.4.0.

### Ajouté

- À chaque lancement de Duo, et à l'ouverture de la bibliothèque ou d'un salon si le dernier contrôle date de plus de 3 minutes, un contrôle rapide (3 secondes au plus) cherche les mises à jour des jeux.
- Une mise à jour trouvée se télécharge tout de suite. Sur la carte du jeu et dans son salon, un bandeau l'indique avec une barre de progression (« Mise à jour de La Petite Ligne vers 0.13.0 : 45 % »), puis « installation », puis « à jour ».
- Si le téléchargement échoue: un message clair, un bouton « Réessayer », et un bouton pour jouer quand même à la version installée.
- Dans le salon, si les deux ordinateurs n'ont pas la même version du jeu, Duo le dit et indique qui doit mettre son jeu à jour.

### Modifié

- Pendant une mise à jour, les boutons pour héberger, rejoindre ou lancer ce jeu sont désactivés, avec la raison affichée.
- Le téléchargement continue quand le salon est ouvert; seule une partie l'interrompt.
- Sans Internet, ou si le catalogue ne répond pas dans le délai, rien n'est bloqué: tu joues à la version installée, et la bibliothèque affiche seulement « Impossible de vérifier les mises à jour ».

## [0.3.0] - 2026-11-04

Sur le Mac, Duo ajoute le carnet de séance: Ctrl+N note en jeu ce que tu vois, avec les images des 10 secondes d'avant et d'après.

### Ajouté

- Sur le Mac, le carnet de séance: pendant une partie, Ctrl+N ouvre une note pour le studio par-dessus le jeu, qui continue (Entrée enregistre, Échap annule). La note, l'état du jeu, les images des 10 s d'avant et des 10 s d'après et deux captures de l'écran vont dans Documents > Duo > carnet-de-seance. Ctrl+Maj+N le coupe ou le rallume. Rien n'est envoyé sur Internet.
- Le pont avec les jeux passe en 1.1 (SDK 1.1.0), compatible avec les jeux en 1.0.

## [0.2.1] - 2026-11-03

Duo propose le plein écran dans ses réglages et montre, dans le salon, ce qui a changé dans le jeu.

### Ajouté

- Un onglet Réglages avec la case « Plein écran », qui suit l'état de la fenêtre; la touche est indiquée (F11 sur le PC, Ctrl+Cmd+F sur le Mac) et Duo retient ton choix.
- Dans le salon, un encadré « Quoi de neuf » donne la version installée du jeu et ses nouveautés, avec « Toutes les notes » quand le jeu les fournit, et une pastille « Nouveau » après une mise à jour.
- La Petite Ligne 0.12.0: l'aubrin, le marché du dimanche, la basse-cour, la pêche refaite, la mercerie et ses vêtements; toutes les notes sont dans le salon du jeu.

### Corrigé

- Un test de la liaison entre deux Duo échouait parfois sur la machine de construction Windows: il choisit maintenant des ports vraiment libres et attend chaque étape sans délai fixe.

## [0.2.0] - 2026-11-02

Duo met désormais à jour ses jeux tout seul, sans réinstaller l'application, et embarque La Petite Ligne 0.11.1.

### Ajouté

- Mise à jour automatique des jeux: Duo cherche les nouvelles versions au démarrage puis toutes les 6 heures, les vérifie (signature) et les installe hors des parties.
- « Installer un jeu depuis un fichier » dans la bibliothèque, en secours sans Internet.
- La Petite Ligne 0.11.1: la rue Haute et ses habitants, la maison qui grandit, les besoins, le rangement, les tenues; toutes les notes sont sur l'écran titre du jeu.

## [0.1.0] - 2026-10-31

Première préversion de Duo, pour jouer à deux à la démo de La Petite Ligne sur le réseau de la maison.

### Ajouté

- Duo pour le Mac (puce Apple) et pour le PC Windows, avec un installateur pour chacun.
- La démo de La Petite Ligne, incluse dans Duo: deux semaines au bourg d'Aubrune, du train de l'arrivée à celui du deuxième samedi, en environ deux heures (une heure par semaine), avec la sauvegarde pour la jouer en plusieurs séances.
- Un ordinateur héberge la partie, l'autre la rejoint, sur le réseau de la maison.
