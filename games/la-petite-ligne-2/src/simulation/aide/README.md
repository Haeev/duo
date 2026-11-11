# Aide réglable

Cahier 2.4 et CA-23: trois crans par joueur (Normal, Coup de pouce, Grand coup de pouce) qui élargissent de 0, 25 et 50 % les fenêtres de temps et les tolérances de ses mini-jeux. Valeurs: `reglages.ts` (`ASSIST.factor`).

- Le cran est un réglage de la machine (onglet Réglages du carnet, `interface/carnet/options.ts`), gardé d'une séance à l'autre (`interface/carnet/memoire.ts`). L'interface l'envoie à l'hôte (`set_assist`) au départ et à chaque écart (`interface/carnet/memoire.ts`, `assistToSend`).
- L'hôte le range dans `players[i].assist` (absent: `normal`) et l'applique. L'autre joueur ne le voit nulle part à l'écran.

## Brancher un mini-jeu (dix lignes au plus)

1. `import { assistFactor } from '../aide';` (depuis un dossier de `simulation/`).
2. Lire le facteur du joueur qui joue: `const f = assistFactor(world, player);` (1, 1,25 ou 1,5).
3. Multiplier par `f` les fenêtres de temps (ferrage, remontée, note « bon ») et les tolérances (zone, portée, angle); diviser par `f` ce qu'il faut tenir ou endurer. Ne jamais toucher aux récompenses.
4. Mini-jeu joué sur la machine du joueur puis rejoué par l'hôte: figer `f` dans l'état au départ (comme `help` d'une ligne de pêche), pour que les deux machines jouent la même partie même si le cran change en route.
5. Test court: le même mini-jeu à deux joueurs, l'un aidé et l'autre non (exemple: `tests/aide.test.ts`).

Déjà branchés: pêche seule (`help` de la ligne), pêche à deux (`rodAid`, `netAid` du combat), cuisine (`windowScaleOf`), filet à insectes (`swingNet`), musique jouée (`windowScaleOf`, figée au lancement de l'air).
