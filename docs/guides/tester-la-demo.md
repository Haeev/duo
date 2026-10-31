# Tester la démo de La Petite Ligne

Pour toi et ta compagne, demain matin. Compte 10 minutes d'installation, puis une heure de jeu. Le but: jouer la semaine entière à deux et nous dire ce qui accroche.

## 1. Lancer la démo

Deux façons. Prends la première si elle marche, sinon la seconde.

### Avec Duo (les installateurs)

Suis le guide [Installer Duo](installer-duo.md) sur le Mac et sur le PC. Si le lien de téléchargement du guide ne mène à rien, passe à la seconde façon et préviens le manager.

### Sans Duo: le Mac sert la démo, le PC l'ouvre dans son navigateur

Sur le Mac, il faut Node 22 et pnpm (si `pnpm` est inconnu: `corepack enable`). Dans un terminal, depuis le dossier du dépôt:

```sh
git pull
pnpm install
pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire
```

1. Le terminal affiche deux adresses. Sur le Mac, ouvre `http://localhost:8080/` dans Chrome. Sur le PC, ouvre l'autre adresse (`http://192.168.x.y:8080/`) dans Edge ou Chrome.
2. Si le Mac demande d'autoriser `node` à recevoir des connexions: accepte.
3. Chacun écrit son pseudo et choisit sa couleur. Le Mac clique sur **Héberger**, le PC sur **Rejoindre**.
4. Pour arrêter: **Échap**, puis « Quitter la partie »; ensuite Ctrl+C dans le terminal du Mac.

La partie est sauvegardée sur le Mac (dossier `Duo-demo` de ton dossier personnel). Pour reprendre plus tard: relance la commande, puis **Héberger et continuer**.

Si l'un des deux recharge la page ou perd le Wi-Fi, la partie s'arrête des deux côtés: repartez de l'accueil avec « Héberger et continuer ».

## 2. Pendant l'heure de jeu: ce qu'il faut regarder

Note l'heure du début et de la fin: la démo doit durer entre 50 et 75 minutes.

- **Fluidité sur le PC**: le personnage avance-t-il sans à-coups? Le jeu se fige-t-il par moments? Si la partie s'arrête avec « Le jeu ne répond plus », note à quel moment (chargement, arrivée, en pleine journée).
- **Chargement**: combien de temps entre « Rejoindre » et l'écran titre, sur le PC?
- **Son**: musique, pas, outils, train, cloche. Rien de trop fort, rien qui manque? Le son est-il le même sur les deux ordinateurs?
- **Lisibilité**: textes, heure, objectif, bourse lisibles sur l'écran du PC? Rien de coupé ni de trop petit?
- **Touches**: Z Q S D pour marcher, Espace pour agir, A et E pour tourner la caméra, Tab pour le carnet, Échap pour la pause. Les touches affichées à l'écran correspondent-elles à ton clavier?
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
