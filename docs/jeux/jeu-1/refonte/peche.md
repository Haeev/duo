# La pêche, mini-jeu (refonte, conception en une page)

Rédaction: dev-gameplay-3d, 2026-11-10. Règles de référence: cahier 4.7 (R29) et 4.8, ressenti section 3, `technique.md` (mini-jeux locaux, résultat validé par l'hôte). De la 0.12 on garde: chaque ombre est un vrai poisson, viser n'est jamais puni (une ombre lointaine vient quand même, plus lentement), l'eau se lit à deux. On laisse: l'absence d'épreuve après le ferrage (le client veut « un vrai mini-jeu »).

## La boucle (un poisson: 15 à 35 s en tout, combat de 10 à 25 s)

1. **Repérer**: dans l'eau d'un coin de pêche, des ombres glissent. Leur taille dit déjà quelque chose (petite, moyenne, grande, immense); l'espèce, non. Elles se renouvellent toutes les 30 minutes de jeu, tirées d'une table propre au coin, filtrée par l'heure, la météo et la saison.
2. **Lancer**: canne en main, face à l'eau, Espace. Un repère part devant le personnage et va et vient en distance; Q et D tournent la visée. Espace lâche le bouchon où est le repère. Près d'une ombre, elle vient vite; loin, l'ombre la plus proche finit par venir.
3. **Ferrer**: l'ombre tourne autour du bouchon, qui frémit (feintes: petits creux), puis plonge franchement. Espace pendant le plongeon: le poisson est pris. Trop tôt ou trop tard: il s'en va.
4. **Tenir la ligne**: un arc au-dessus du personnage, une aiguille (la ligne) et un secteur vert (la bonne tension). Le poisson tire à gauche ou à droite par élans; Q et D contrent. Quand il souffle (bulles, aiguille calme, moulinet qui brille), Espace mouline et le rapproche. Mouliner pendant un élan tend la ligne. Hors du vert trop longtemps (1,5 s cumulées, qui se résorbent dans le vert): il casse et s'en va.
5. **La prise**: taille tirée, qualité (une à trois étoiles), record personnel. Espèce nouvelle: le personnage la montre, jingle, fiche du poisson (nom, taille, record), l'entrée s'écrit au carnet. Espèce connue: une vignette et la taille, deux secondes.

**Échec doux** (mission du 2026-11-10, qui prime sur « on perd l'appât » de R29): rien n'est perdu, l'ombre s'éloigne et une autre viendra à la vague suivante.

## Commandes, clavier seul

Espace (lancer, ferrer, mouliner), Q et D (viser, contrer), Retour arrière (ranger la ligne). Pendant la pêche, l'interface prend le clavier: le personnage ne marche pas.

## Pourquoi c'est amusant dix fois de suite

- Chaque poisson se lit avant d'être pris: la taille de l'ombre fait espérer, le combat révèle l'espèce par son caractère (le goujon frétille, la tanche tire lourd et lentement, la truite change de côté sans prévenir).
- Le combat est un dialogue en deux temps (il tire, je tiens; il souffle, je gagne du fil), assez court pour ne jamais lasser, assez nerveux pour qu'on rate parfois.
- La prise rapporte toujours quelque chose de petit: une taille à battre, une étoile de plus, une chance de prise double (repas), une espèce qui n'existe qu'à l'aube sous la pluie.
- La connue va vite: on n'attend jamais une fête qu'on a déjà vue.

## Ce qui varie d'un poisson à l'autre (données de la fiche de prise, bloc `fish`)

`force` (poids de l'élan), `nervousness` (changements de côté, frétillement de l'aiguille), `rhythm.pull` et `rhythm.rest` (durée des élans et des souffles), `stamina` (secondes à tenir dans le vert pour l'épuiser), `feints` (creux avant le vrai plongeon), `sizeCm`, `shadow`. Rareté et créneaux (heure, météo, saison) restent ceux de la prise.

## À deux, côte à côte

Chacun sa ligne et son mini-jeu, sur sa machine (aucune attente réseau). L'autre voit le bouchon, l'ombre qui approche, la canne pliée quand ça mord, et la fête. Les ombres sont les mêmes chez les deux: on se dit « la grande, sous la saule ».

**Le petit bonus**: quand on sort un poisson et que l'autre est à moins de 4 m, il tend l'épuisette (sans rien faire): une étoile de plus. On a donc envie de pêcher l'un à côté de l'autre plutôt que chacun dans son coin.

## Aides

La canne améliorée élargit le secteur vert (30 %, émoussée: 15 % de moins), le bonus « Bien reposé » (`minigame`) l'élargit aussi, ainsi que la fenêtre du ferrage; « Chance » (`rareLuck`) fait venir plus volontiers l'ombre la plus rare, et donne de plus grandes tailles; le repas « prise double » (`extraCatch`) donne parfois un deuxième exemplaire.

## Technique

L'hôte tire l'ombre qui mord et une graine; tout le reste (touche, combat) se joue sur la machine du joueur à partir de cette graine et part en fin de partie sous forme de journal compact des touches. L'hôte rejoue le journal: le résultat n'est accepté que s'il le retrouve. Code: `games/la-petite-ligne-2/src/simulation/peche/` et `src/interface/peche/`.
