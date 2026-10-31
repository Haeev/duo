# Tester la démo de La Petite Ligne

Pour toi et ta compagne. Compte 10 minutes d'installation, puis environ deux heures de jeu: deux semaines au bourg, d'un train du samedi à l'autre. Vous pouvez faire une semaine par séance: la partie se sauvegarde, et dans le salon de Duo, l'hôte choisit « Continuer » sur la sauvegarde (ou « Héberger et continuer » sans Duo) pour reprendre où vous en étiez. Le but: jouer à deux et nous dire ce qui accroche.

## 1. Lancer la démo

Deux façons. Prends la première si elle marche, sinon la seconde.

### Avec Duo (les installateurs)

Suis le guide [Installer Duo](installer-duo.md) sur le Mac et sur le PC.

Si le lien de téléchargement du guide ne mène à rien (préversion pas encore publiée), les mêmes installateurs t'attendent sur GitHub, connecté à ton compte:

1. Ouvre <https://github.com/Haeev/duo/actions/workflows/systemes.yml?query=branch%3Amain> et clique sur le passage le plus récent (coche verte).
2. En bas de la page, dans « Artifacts », télécharge **duo-macos** sur le Mac et **duo-windows** sur le PC.
3. Ce sont des fichiers zip: ouvre-les pour trouver `Duo-macOS.dmg` et `Duo-Windows.exe`, puis reprends le guide d'installation à l'étape 2.

Si rien de tout ça ne marche, passe à la seconde façon et préviens le manager.

### Sans Duo: le Mac sert la démo, le PC l'ouvre dans son navigateur

Sur le Mac, il faut Node 22 (installateur sur nodejs.org) et pnpm (si `pnpm` est inconnu: `corepack enable`, ou `sudo corepack enable` s'il refuse). Dans le Terminal, la première fois:

```sh
git clone -b main https://github.com/Haeev/duo.git
cd duo
pnpm install
pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire
```

Les fois suivantes, depuis le dossier `duo`: `git pull`, `pnpm install`, puis la dernière commande.

1. Le terminal affiche deux adresses. Sur le Mac, ouvre `http://localhost:8080/` dans Chrome. Sur le PC, ouvre l'autre adresse (`http://192.168.x.y:8080/`) dans Edge ou Chrome.
2. Si le Mac demande d'autoriser `node` à recevoir des connexions: accepte.
3. Chacun écrit son pseudo et choisit sa couleur. Le Mac clique sur **Héberger**, le PC sur **Rejoindre**.
4. Pour arrêter: **Échap**, puis « Quitter la partie »; ensuite Ctrl+C dans le terminal du Mac.

La partie est sauvegardée sur le Mac (dossier `Duo-demo` de ton dossier personnel). Pour reprendre plus tard: relance la commande, puis **Héberger et continuer**.

Si l'un des deux recharge la page ou perd le Wi-Fi, la partie s'arrête des deux côtés: repartez de l'accueil avec « Héberger et continuer ».

## 2. Pendant la partie: ce qu'il faut regarder

Note l'heure du début et de la fin de chaque semaine: chacune doit durer environ une heure (entre 50 et 75 minutes).

- **Fluidité sur le PC**: le personnage avance-t-il sans à-coups? Le jeu se fige-t-il par moments? Si la partie s'arrête avec « Le jeu ne répond plus », note à quel moment (chargement, arrivée, en pleine journée).
- **Chargement**: combien de temps entre « Rejoindre » et l'écran titre, sur le PC?
- **Son**: musique, pas, outils, train, cloche. Rien de trop fort, rien qui manque? Le son est-il le même sur les deux ordinateurs?
- **Lisibilité**: textes, heure, objectif, bourse lisibles sur l'écran du PC? Rien de coupé ni de trop petit?
- **Touches**: Z Q S D pour marcher, Espace pour agir, A et E pour tourner la caméra, Tab pour le carnet, C dans la maison pour désigner ton coin, Échap pour la pause. Les touches affichées à l'écran correspondent-elles à ton clavier?
- **À la souris seule**: l'un de vous peut-il jouer un moment sans le clavier (clic pour marcher et agir, molette pour l'outil)?
- **À deux**: chacun a-t-il quelque chose à faire chaque jour? Les moments ensemble (la poutre, le souper, la scène chez Odette, le train de samedi) font-ils plaisir?
- **La fin**: le train du samedi part-il avec la commande? Combien de lignes sur 4 avez-vous remplies?
- **Textes**: une faute, une phrase bizarre, un « vous » ou un « tu » mal placé? Note-les.

## 3. Remonter un problème

Écris au manager, un message par problème:

1. **Ce qui s'est passé**, en une phrase.
2. **Sur quel ordinateur** (Mac ou PC), et qui hébergeait.
3. **Le jour et l'heure du jeu** (en haut à gauche de l'écran), et ce que tu faisais juste avant.
4. **Une photo de l'écran** si possible (sur le Mac: Cmd+Maj+4; sur le PC: Windows+Maj+S).
5. **Est-ce que ça bloque?** (on ne peut plus jouer, ou c'est gênant, ou c'est un détail).

Les impressions comptent autant que les bugs: ce qui vous a plu, ce qui a paru long ou ennuyeux, ce que vous auriez voulu faire.
