# Installer Duo (préversion)

Ce guide explique comment installer Duo sur le Mac et sur le PC, puis lancer la démo de La Petite Ligne à deux. Compte une dizaine de minutes par ordinateur la première fois.

Duo est en préversion: c'est une version d'essai. Elle n'a pas de signature payante, alors le Mac et le PC affichent une alerte de sécurité à l'installation. C'est normal, et ce guide te dit comment passer. Les noms des menus sont ceux de macOS 15 et de Windows 11 en français: s'ils diffèrent un peu chez toi, choisis ce qui s'en rapproche le plus.

Ce qu'il faut:

- un Mac à puce Apple (M1 ou plus récent) avec macOS 13 ou plus récent;
- un PC avec Windows 10 ou 11;
- les deux ordinateurs sur le même réseau de la maison (le même Wi-Fi, ou un câble branché à la même box).

## 1. Télécharger Duo

Ouvre la page de la préversion: <https://github.com/Haeev/duo/releases/tag/v0.1.0>. En bas, dans « Assets », télécharge le fichier de ton ordinateur:

- sur le Mac: **Duo-macOS.dmg** ([lien direct](https://github.com/Haeev/duo/releases/download/v0.1.0/Duo-macOS.dmg));
- sur le PC: **Duo-Windows.exe** ([lien direct](https://github.com/Haeev/duo/releases/download/v0.1.0/Duo-Windows.exe)).

Les autres fichiers de la page servent aux vérifications du studio: tu n'en as pas besoin.

## 2. Sur le Mac

### Installer

1. Ouvre **Duo-macOS.dmg** (dans Téléchargements). Une fenêtre s'ouvre avec Duo et le dossier Applications.
2. Glisse l'icône de Duo sur le dossier **Applications**.
3. Ferme la fenêtre, puis éjecte « Duo » dans la barre latérale du Finder (le petit triangle à côté de son nom).

### Premier lancement

1. Ouvre le dossier **Applications** et double-clique sur **Duo**.
2. macOS dit qu'il n'a pas pu vérifier Duo. Clique sur **Terminé**. Surtout pas sur « Placer dans la corbeille ».
3. Ouvre le menu Pomme, puis **Réglages Système** > **Confidentialité et sécurité**.
4. Descends jusqu'à la partie « Sécurité »: un message dit que Duo a été bloqué. Clique sur **Ouvrir quand même**.
5. Confirme avec ton mot de passe ou Touch ID, puis clique encore sur **Ouvrir quand même**.

Duo s'ouvre. macOS ne repose la question qu'à la prochaine version de Duo.

Si macOS dit que Duo « est endommagé », ne force rien: préviens le studio, c'est un défaut de fabrication de notre côté.

### Autoriser le réseau local

La première fois que Duo cherche l'autre ordinateur, macOS demande s'il peut « trouver des appareils sur des réseaux locaux ». Clique sur **Autoriser**: sans cela, les deux ordinateurs ne se trouvent pas.

Si tu as refusé par erreur: Réglages Système > Confidentialité et sécurité > **Réseau local**, puis active Duo. Le guide de dépannage donne plus de détails: [Dépannage du réseau](depannage-reseau.md), parties 5 et 6.

## 3. Sur le PC

### Avant d'installer: le contrôle intelligent des applications

Windows 11 a une protection, le « Contrôle intelligent des applications » (Smart App Control en anglais), qui bloque les applications sans signature payante, comme Duo.

1. Clique sur le bouton Démarrer, tape « Sécurité Windows » et ouvre l'application.
2. Clique sur **Contrôle des applications et du navigateur**, puis sur **Paramètres du contrôle intelligent des applications**.
3. Regarde le choix coché:
   - **Désactivé**: tout va bien, passe à l'installation.
   - **Activé** ou **Évaluation**: Windows bloquera Duo. Pour l'instant, la seule façon de jouer est de choisir « Désactivé ». L'antivirus Microsoft Defender et SmartScreen restent actifs. Selon ta version de Windows, le réactiver plus tard peut être impossible sans réinstaller Windows: si tu hésites, demande d'abord au studio.

### Installer

1. Télécharge **Duo-Windows.exe**. Si le navigateur dit que ce fichier n'est pas souvent téléchargé, choisis de le **conserver** (dans Edge: le bouton « ... » à côté du fichier, puis « Conserver », puis « Conserver quand même »).
2. Double-clique sur **Duo-Windows.exe**.
3. Windows affiche « Windows a protégé votre ordinateur ». Clique sur **Informations complémentaires**, puis sur **Exécuter quand même**.
4. L'installation prend quelques secondes, sans demander de mot de passe d'administrateur. Duo s'ouvre tout seul à la fin.

Duo s'installe pour ton compte seulement. Tu le retrouves dans le menu Démarrer et sur le Bureau.

### Autoriser Duo dans le pare-feu

La première fois que tu héberges ou rejoins une partie, le pare-feu de Windows demande s'il laisse passer Duo. Duo te prévient juste avant.

1. Laisse **Réseaux privés** coché.
2. Clique sur **Autoriser**.
3. Si Windows demande l'accord d'un administrateur, réponds **Oui**.

Si quelqu'un a cliqué sur « Annuler », ou si l'autre ordinateur n'apparaît pas: [Dépannage du réseau](depannage-reseau.md), parties 2 et 3. Le réseau de la maison doit être réglé sur « Privé » dans Windows.

## 4. Jouer à deux à La Petite Ligne

1. Ouvre Duo sur les deux ordinateurs. La première fois, chacun choisit son pseudo et suit les écrans d'accueil.
2. Sur un des deux ordinateurs, choisis **La Petite Ligne**, puis clique sur **Héberger une partie**. C'est cet ordinateur qui fait tourner la partie.
3. Sur l'autre ordinateur, clique sur **Rejoindre** quand l'invitation apparaît.
4. La démo dure environ une heure: la première semaine au bourg d'Aubrune, jusqu'au train du samedi.

Si l'autre ordinateur n'apparaît pas au bout d'une minute: le bouton « Que faire ? » dans Duo, puis [Dépannage du réseau](depannage-reseau.md).

## 5. Mettre Duo à jour

Duo ne se met pas encore à jour tout seul. Quand le studio annonce une nouvelle version, tu la trouves sur la page des versions de Duo, <https://github.com/Haeev/duo/releases>, avec les mêmes noms de fichiers:

- **Mac**: télécharge le nouveau Duo-macOS.dmg, glisse Duo sur Applications et choisis **Remplacer**. Au lancement, refais le passage par « Ouvrir quand même » (partie 2).
- **PC**: télécharge le nouveau Duo-Windows.exe et lance-le. SmartScreen s'affiche de nouveau: « Informations complémentaires », puis « Exécuter quand même ».

Tes parties, ton pseudo et tes réglages sont gardés.

## 6. Désinstaller Duo

- **Mac**: dans Applications, glisse Duo dans la Corbeille.
- **PC**: Démarrer > **Paramètres** > **Applications** > **Applications installées**, puis « ... » à côté de Duo > **Désinstaller**.

Tes parties restent sur l'ordinateur, pour le jour où tu réinstalles Duo. Pour tout effacer, supprime aussi le dossier `Duo` dans `~/Library/Application Support` (Mac) ou dans `%APPDATA%` (PC).
