# Journal des versions de Duo

Les changements de l'application Duo, version par version, écrits pour les deux joueurs. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent [SemVer](https://semver.org/lang/fr/), propres à l'application (le SDK et chaque jeu ont les leurs).

À chaque version: une section `## [X.Y.Z] - AAAA-MM-JJ`, une première phrase qui résume la version (elle s'affiche dans l'avis de nouvelle version), puis les rubriques utiles parmi Ajouté, Modifié, Corrigé, Retiré et Sécurité. La publication échoue si la section de la version manque.

## [Non publié]

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
