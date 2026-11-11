# Recette de Duo 0.4.0 chez vous

Duo 0.4.0 est à installer sur les deux ordinateurs, le Mac puis le PC. Compte cinq minutes d'installation par ordinateur, puis dix minutes de vérifications à deux. Tes sauvegardes, ton pseudo, tes réglages et tes jeux installés sont gardés: on installe par-dessus l'ancienne version, sans rien désinstaller.

Ce qui change: Duo te préviendra désormais tout seul quand une nouvelle version sera prête (un bandeau dans la bibliothèque, avec « Télécharger » et « Plus tard »). Cette fois-ci, ton Duo 0.3.0 ne peut pas te prévenir, puisqu'il ne sait pas encore le faire: c'est pour ça que ce guide existe. Le salon de chaque jeu montre aussi tes dernières séances, et la mise à jour des jeux se voit pendant qu'elle se fait.

## 1. Télécharger

Deux liens qui ne changent jamais, toujours vers la dernière version de Duo:

- sur le Mac: <https://github.com/Haeev/duo/releases/latest/download/Duo-macOS.dmg>
- sur le PC: <https://github.com/Haeev/duo/releases/latest/download/Duo-Windows.exe>

Si un lien affiche « Not Found », la version n'est pas encore en ligne: attends le message du studio.

## 2. Installer sur le Mac

1. Quitte Duo s'il est ouvert (menu Duo > Quitter Duo).
2. Ouvre **Duo-macOS.dmg** (dans Téléchargements), glisse l'icône de Duo sur le dossier **Applications**, puis choisis **Remplacer**.
3. Ferme la fenêtre, puis éjecte « Duo » dans la barre latérale du Finder.
4. Ouvre Duo depuis Applications. macOS dit qu'il n'a pas pu vérifier Duo: clique sur **Terminé** (surtout pas sur « Placer dans la corbeille »).
5. Menu Pomme > **Réglages Système** > **Confidentialité et sécurité**. Dans la partie « Sécurité », un message dit que Duo a été bloqué: clique sur **Ouvrir quand même**, confirme avec ton mot de passe ou Touch ID, puis clique encore sur **Ouvrir quand même**.
6. Réseau local: macOS peut redemander s'il laisse Duo « trouver des appareils sur des réseaux locaux », car il voit chaque nouvelle version comme une nouvelle application. Clique sur **Autoriser**. S'il ne demande rien, vérifie quand même: Réglages Système > Confidentialité et sécurité > **Réseau local**, Duo doit être activé.

## 3. Installer sur le PC

1. Quitte Duo s'il est ouvert.
2. Télécharge **Duo-Windows.exe**. Si le navigateur dit que ce fichier n'est pas souvent téléchargé, choisis de le **conserver** (dans Edge: « ... » à côté du fichier, puis « Conserver », puis « Conserver quand même »).
3. Double-clique sur **Duo-Windows.exe**. Windows affiche « Windows a protégé votre ordinateur »: clique sur **Informations complémentaires**, puis sur **Exécuter quand même**.
4. L'installation prend quelques secondes, sans mot de passe d'administrateur, et Duo s'ouvre tout seul.
5. Pare-feu: si Windows redemande s'il laisse passer Duo à la première partie, laisse **Réseaux privés** coché, clique sur **Autoriser**, et réponds **Oui** si Windows demande l'accord d'un administrateur.

## 4. Vérifier en dix minutes

Coche au fur et à mesure; note ce qui ne va pas (ce que tu as fait, ce que tu as vu, sur quel ordinateur).

| | Vérification | Mac | PC |
|---|---|---|---|
| 1 | Duo s'ouvre, sans écran d'erreur. | [ ] | [ ] |
| 2 | Le numéro de version est 0.4.0 (Mac: menu Duo > À propos de Duo; PC: Paramètres > Applications > Applications installées, ligne Duo). | [ ] | [ ] |
| 3 | Ton pseudo et ta couleur sont toujours là. | [ ] | [ ] |
| 4 | Bibliothèque: les jeux installés sont toujours là (La Petite Ligne, Deux Tabliers...). | [ ] | [ ] |
| 5 | Dans le salon d'un jeu à sauvegarde, la dernière sauvegarde est proposée (« Continuer »). | [ ] | [ ] |
| 6 | L'autre ordinateur est trouvé tout seul sur le réseau de la maison en moins d'une minute (accueil: « ... est là »). | [ ] | [ ] |
| 7 | Une partie à deux se lance: l'un héberge, l'autre rejoint, le jeu démarre chez les deux. | [ ] | [ ] |
| 8 | Après quelques minutes de jeu: Échap (pause), « Retour au salon » (ou « Arrêter la partie », selon le jeu), puis l'écran de fin et le salon: le bloc « Dernières séances » montre la séance (date, durée et, pour La Petite Ligne, les nombres du jeu). | [ ] | [ ] |
| 9 | En rouvrant le jeu, la sauvegarde de la séance est reprise. | [ ] | [ ] |
| 10 | Aucun bandeau « Duo ... est disponible » dans la bibliothèque (c'est normal: 0.4.0 est la dernière version). | [ ] | [ ] |

Si l'autre ordinateur n'apparaît pas (point 6): le bouton « Que faire ? » dans Duo, puis le guide [Dépannage du réseau](../guides/depannage-reseau.md). Sur le Mac, commence par vérifier l'autorisation Réseau local (partie 2, étape 6).

## 5. Revenir à la 0.3.0 si quelque chose casse

Reviens à la 0.3.0 sur les deux ordinateurs à la fois: ils doivent avoir la même version de Duo pour jouer ensemble sans surprise. Tes sauvegardes restent sur l'ordinateur et la 0.3.0 les relit: la 0.4.0 n'a pas changé leur format (l'historique des séances est rangé à part, la 0.3.0 l'ignore simplement).

- sur le Mac: télécharge <https://github.com/Haeev/duo/releases/download/v0.3.0/Duo-macOS.dmg>, glisse Duo sur Applications et choisis **Remplacer**, puis repasse par **Ouvrir quand même** (partie 2, étapes 4 et 5);
- sur le PC: Démarrer > **Paramètres** > **Applications** > **Applications installées**, « ... » à côté de Duo > **Désinstaller** (tes parties restent sur l'ordinateur), puis télécharge <https://github.com/Haeev/duo/releases/download/v0.3.0/Duo-Windows.exe> et installe-le comme en partie 3.

Puis préviens le studio avec ce que tu as vu: on corrige, et la version suivante te sera proposée par le bandeau de Duo.
