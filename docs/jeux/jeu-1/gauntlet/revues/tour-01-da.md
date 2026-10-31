# Gauntlet, tour 1: revue du directeur artistique (piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Jeu | La Petite Ligne (jeu 1), démo de deux semaines |
| Relecteur | directeur-artistique (n'a produit aucun asset ni code du jeu) |
| Date | 2026-10-31, de 8 h 57 à 9 h 20 UTC |
| Arbre relu | `/home/user/duo`, branche `claude/stoic-lamport-lueey2`, commit `6b797a0` |
| Barème | `docs/modeles/gauntlet-qualite.md`: 10 = aucune différence de soin avec Animal Crossing, Stardew Valley, A Short Hike; 8 = un joueur ne remarque aucun manque; 5 = fonctionne mais nu; 3 = provisoire |
| Notes | **pilier 2, vie du monde et animation: 5/10**; **pilier 3, direction artistique: 6/10** |

## Méthode

- Serveur Vite à moi (port 5301, rechargement coupé), rendu normal (jamais `?rendu=leger`), fenêtre de 1366 x 768 (l'écran du PC de référence). Captures par Playwright dans le Chromium du cloud (SwiftShader, environ 10 images par seconde, 95 à 200 s par capture).
- Pages: `rendu.html` (vrai moteur, vraie carte, état d'exemple: Camille se promène avec la bêche, Sacha arrose, les poules picorent, les habitants à leur poste) avec `vie=0` pour les plans de lieu; `src/interface/demo/index.html?scenario=jour` (vraie simulation, l'autre joueur joué par le robot) pour les habitants en mouvement.
- Plans: place le matin (8 h 15), quai avec le train à l'arrêt (10 h), potager en action (10 h 30, planche de cinq images à 0,5 s), gué et pêche (14 h), place le soir (18 h 30) et la nuit (22 h 30) au même cadrage, intérieur à la tombée du jour (19 h 45), pluie sur le potager (11 h).
- Lisibilité: passage en niveaux de gris (`convert -colorspace Gray`, gris moyen et écart type sur 0 à 255), simulation de deutéranopie et de protanopie (matrices de Machado 2009, RGB linéaire) sur les deux joueurs.
- Lecture du code pour ce qui ne se voit pas sur une image fixe: `src/rendu/personnages.ts` (clips joués par action), `vegetation.ts` et `terrain.ts` (végétation et sol), `src/simulation/habitants.ts` et `dialogues.ts` (orientation des habitants), liste des clips de `assets/modeles/personnages.glb`.

Mesures en niveaux de gris (moyenne, écart type):

| Plan | Moyenne | Écart |
|---|---|---|
| Place, 8 h 15 | 109 | 25 |
| Quai, 10 h | 118 | 31 |
| Potager, 10 h 30 | 131 | 29 |
| Gué, 14 h | 141 | 34 |
| Pluie, 11 h | 87 | 19 |
| Place, 18 h 30 | 80 | **19** |
| Intérieur, 19 h 45 (pièce seule) | 44 | **15** |
| Place, 22 h 30 | 53 | 37 |

Limites: la fluidité réelle (images par seconde, glissement des pieds, rythme des fondus) ne se juge pas à 10 images par seconde en rendu logiciel; elle va dans « À tester chez le client ». L'état d'exemple de `rendu.html` fige les habitants à leur poste, quelle que soit l'heure: leur emploi du temps se juge sur la vraie simulation.

## Pilier 2: vie du monde et animation, 5/10

### Justification

Le socle est bon et parfois très bon: la journée et la nuit changent vraiment l'ambiance, l'eau est vivante, la pluie existe, les actions de la ferme ont leur clip avec des fondus de 0,22 s, les visages clignent et changent d'expression avec la forme. Mais entre deux actions, le monde est immobile: aucun vent (ni arbre, ni herbe, ni store, ni fumée de cheminée), aucune faune hors des trois poules et du poisson pris, une seule attente pour tous les personnages, des habitants qui restent plantés dans la même pose et ne regardent les joueurs que lorsqu'une conversation s'ouvre. Plusieurs gestes empruntent le clip d'un autre (cuisiner joue « scier »). C'est la définition du 5: ça fonctionne, mais c'est nu. Les références se distinguent justement par cette vie de fond, visible même quand le joueur ne fait rien.

### Déjà au niveau (à préserver)

- Courbes de lumière continues sur toute la journée (matin à l'est, soir doré, nuit bleue avec îlots chauds des fenêtres et des lampadaires): la nuit est le plus beau plan du jeu, lisible (écart 37) et chaleureuse (`da-05-soir-nuit-gris.png`, à droite).
- Eau: écume en paillettes, ronds de pluie sur la rivière, ronds du bouchon à la touche (`da-03`, `da-06`); pluie fine, sol mouillé et flaques, lumière voilée (`da-06`, à droite).
- Marche réglée sur la vitesse (`walkReferenceSpeed`), virages lissés, outil tenu en main et rangé quand il le faut, fondus entre les clips, clignement décalé par personnage, expressions par cibles de morphose (`personnages.ts`). La planche `da-02-potager-marche-planche.png` montre un cycle de marche propre, sans pose cassée.
- Pêche complète et soignée (lancer, attente, touche, ferrage enchaînés depuis la même pose, ligne tendue du bout de la canne au bouchon), poules animées qui picorent, roues du train, barrière du passage à niveau, portes de la remise, panache de vapeur hérité de la vitesse.

### Les 5 défauts les plus visibles, par impact

| # | Constat | Preuve | Correction proposée | Membre | Effort | Gain |
|---|---|---|---|---|---|---|
| 1 | **Aucun vent: le décor est une maquette figée.** Arbres, buissons, touffes, fleurs, store rayé de l'épicerie, linge et lambrequin de la marquise ne bougent jamais; aucune cheminée ne fume (Odette, Firmin, la scierie), alors que le jeu compte des dizaines d'arbres à l'écran. | Toutes les captures; `vegetation.ts` et `instances.ts` n'ont aucune déformation dans le temps; aucune recette de fumée de cheminée dans `particules.ts`. | Balancement dans le nuanceur de sommets de `lpl_palette` (variante instanciée): décalage proportionnel à la hauteur du sommet au-dessus de l'origine de l'instance, bruit de vent global lent plus rafales, réservé aux cases de feuillage et d'herbe de la palette (lues par l'UV, donc sans couleur de sommet). Amplitude réglée par la météo (pluie et nuages plus forts). Fumée de cheminée avec le système de particules existant (`particules.ts`), plus dense le matin et le soir, coupée quand l'habitant est absent. Coût: zéro appel de dessin, zéro programme de plus. | tech-artist | 150 min | +1 |
| 2 | **Pas de petite faune.** Hors des trois poules et du poisson qui saute au sac, rien ne vit: ni oiseau sur la place ou les fils, ni papillon au-dessus des fleurs, ni insecte, ni luciole la nuit au bord de la rivière, ni ombre de poisson dans l'eau. Le barème cite la petite faune nommément. | `da-01` (place vide hors des habitants), `da-05` (nuit sans luciole); aucun code de faune dans `src/rendu/` (recherche de « oiseau », « bird », « papillon », « luciole »: rien). | Une couche « faune » instanciée et décorative: moineaux (40 triangles, deux clips: picorer, s'envoler) en groupes de 3 à 5 sur la place et près du potager, qui s'envolent quand un joueur passe à moins de 2 m et reviennent plus tard; 4 à 6 papillons près des fleurs de 9 h à 17 h par soleil; lucioles en particules près de l'eau de 21 h à 1 h; ombres de poisson qui glissent près du gué. Positions tirées d'une graine commune pour l'identique sur les deux écrans. | artiste-3d (moineau, papillon), tech-artist (lucioles, vol), dev rendu (fuite à l'approche) | 240 min | +1 |
| 3 | **Une seule attente pour tous.** Dès qu'un joueur s'arrête, il joue la boucle `idle`, sans fin; les habitants à leur poste aussi (Firmin à la cloche, Odette au comptoir, Jeanne sur le banc). Aucun geste d'oisiveté, aucune attente liée à l'heure, à la météo ou à la forme. | `da-01` et `da-04`: Firmin, Odette et Jeanne dans la même pose de face; `personnages.ts`, `villagerClip()` renvoie `idle` pour `serve`, `stand`, `wait_train`, `host`. | Deux ou trois attentes par gabarit, tirées au hasard (graine par personnage) après 5 à 8 s d'immobilité: regarder autour, s'étirer, épousseter sa manche; bâiller le soir et en forme basse; s'abriter de la main sous la pluie. Attentes propres aux habitants: Firmin consulte sa montre, Odette essuie le comptoir, Jeanne balance les jambes sur le banc, Basile s'essuie le front. Fondu de 0,3 s depuis et vers `idle`. | artiste-3d (clips), dev rendu (choix et enchaînement) | 210 min | +0,5 à +1 |
| 4 | **Les habitants ignorent les joueurs hors dialogue.** Un habitant ne se tourne vers un joueur qu'à l'ouverture d'une conversation (`dialogues.ts`); sinon il regarde dans la direction de sa marche ou de son poste. Personne ne salue, ne suit du regard, ne lève la tête quand le train siffle. | `src/simulation/habitants.ts` (orientation = direction du déplacement), `dialogues.ts` lignes 102 et 103. En simulation réelle, aucun habitant n'est entré dans le cadre du potager en 20 minutes de jeu (`da-08`): la réaction n'a pas pu être filmée, le constat vient du code. | Côté rendu seulement (rien dans l'état partagé): tête et buste tournés vers le joueur le plus proche à moins de 4 m, limités à 70°, avec un amorti; clip `wave` (déjà livré) au premier croisement de la journée; tous les habitants tournent la tête vers la locomotive au sifflet. | dev rendu | 90 min | +0,5 |
| 5 | **Gestes empruntés et clips livrés mais jamais joués.** Cuisiner au réchaud joue `saw` (scier), nourrir les poules joue `sow` (semer), remplir l'arrosoir joue `water` (arroser dans le vide), ramasser un objet joue `harvest`. Les clips `give`, `pet`, `high_five` et `sit_eat` existent dans `personnages.glb` sans être branchés: le souper à table se mange debout ou assis sans geste de repas. | `personnages.ts`, table `CLIP_FOR_ACTION` (`cook: 'saw'`, `feed: 'sow'`, `refill: 'water'`, `pickup: 'harvest'`); liste des clips du modèle. | Brancher tout de suite `sit_eat` (manger assis), `give` (offrir, livrer), `pet` (poules); demander à l'artiste 3D `cook` (remuer la poêle, 1,5 s) et `refill` (pencher l'arrosoir dans le tonneau ou le puits, 1 s); `high_five` à la fin d'une tâche à deux (commande expédiée). | dev rendu (30 min), artiste-3d (120 min) | 150 min | +0,5 |

Remarques secondaires (hors classement): dans la vraie simulation (`da-08`), Sacha, joué par le robot, reste au même endroit près du poulailler de 9 h 20 à 9 h 40 alors que sa carte affiche « En chemin » (à signaler à la QA, hors de mon périmètre); à 18 h 30 et 22 h 30, les habitants de l'état d'exemple restent dehors à leur poste; dans la vraie simulation ils rentrent (`home`), donc rien à corriger dans le jeu, mais la page de démonstration devrait suivre l'emploi du temps pour ne pas tromper les revues. L'arrosage de l'état d'exemple ne montre aucune goutte (l'effet part de l'événement `watered`, que la page ne produit pas): non jugé.

## Pilier 3: direction artistique, 6/10

### Justification

Le style est cohérent d'un modèle à l'autre: low poly en aplats, palette chaude et douce tenue partout (pierre crème, lauzes ardoise, tuiles, volets peints), silhouettes d'habitants distinctes (casquette de Firmin, chignon d'Odette, tresses de Jeanne), lumière soignée du matin à la nuit. On est loin du provisoire. Mais trois choses se voient dans presque chaque plan et trahissent le prototype: le sol découpé en cases d'un mètre (damier de pavés, carrés d'herbe à bords francs, chemins et berges en escalier), une rivière en canal rectangulaire avec un gué en dallage, et des moments de la journée qui perdent leur relief (soir, intérieur). Un joueur les remarque: on reste sous 8, et au-dessus de 5 grâce à la cohérence et à la lumière.

### Déjà au niveau (à préserver)

- La palette de la bible (`palette.py`), unique pour tout le décor: aucune couleur hors bible repérée sur les huit plans; les foulards restent la seule note vive des personnages.
- Bâtiments et accessoires: épicerie ocre au store rayé, maisonnette en moellons, puits, lampadaires, bancs, barils, tonnelle; densité de détail homogène, échelle juste (`da-01`, `da-04`).
- Nuit: fenêtres et lanternes chaudes sur un bleu profond, halos sobres, personnages encore lisibles (`da-05`, à droite; écart 37, le meilleur de la journée).
- Potager: les trois états de terre se lisent en niveaux de gris (herbe, bêchée, arrosée), la case visée a un cadre clair net (`da-07`, en haut à droite).
- Joueurs distincts entre eux en vision normale, en deutéranopie et en protanopie, par la tenue, la coiffure et la couleur du foulard (`da-07`).

### Les 5 défauts les plus visibles, par impact

| # | Constat | Preuve | Correction proposée | Membre | Effort | Gain |
|---|---|---|---|---|---|---|
| 1 | **Le sol se lit comme une grille de cases d'un mètre.** Les pavés de la place sont tirés au hasard case par case entre deux gris très écartés: un damier qui occupe la moitié de l'écran au cœur du bourg. L'herbe change de vert par seuils, en grands carrés à bords francs; les bords des chemins, du ballast et des berges sont en escalier. C'est le premier signe « prototype » pour un joueur, dans toutes les captures. | `da-01-place-matin-damier.png` (place), `da-02` et `da-06` (herbe en carrés), `da-03` (berges en escalier); `terrain.ts`, `topCell()`: une case de palette par case de carte, choisie par seuil (`grass_dark`, `grass`, `grass_light`) ou par tirage au hasard (`cobble` ou `cobble_dark` pour la pierre, `ballast` pour le gravier). | (a) Place: un vrai appareillage de pavés (rangs de petits pavés en éventail ou en lignes décalées), en deux ou trois tuiles modélisées de 2 x 2 m tournées au hasard, écart de gris entre pavés ramené d'environ 30 niveaux (`cobble` #ABA498 contre `cobble_dark` #8E877C) à 8, joints plus sombres; (b) herbe: teinte continue en coordonnées du monde dans le nuanceur du terrain (mélange interpolé des trois verts par un bruit doux, plus de seuils par case), ce qui garde les aplats par face; (c) bords: coins coupés en diagonale ou arrondis en deux segments (cas de « marching squares ») pour chemins, ballast et berges. J'amende la bible en conséquence: la teinte continue du terrain est permise (section 3), elle reste sans texture détaillée. | tech-artist (teinte), dev rendu (`terrain.ts`, coins), artiste-3d (tuiles de pavés) | 300 min | +1 à +1,5 |
| 2 | **La rivière ressemble à un canal et le gué à un trottoir.** Berges droites à angles droits, dalles beiges à carreaux gris, gué en dalle continue parsemée de galets posés dessus: aucune pierre émergée, aucun roseau, aucune herbe aquatique, pas d'écume au pied des berges. C'est le lieu de la pêche et de la deuxième semaine, et le moins travaillé de la carte. | `da-03-gue-canal-premier-plan.png`; `da-06` (pluie, berge en escalier en bas à gauche). | Contour des berges décalé par un bruit doux (sans toucher aux cases franchissables de la simulation), deux niveaux de pierres sur la berge; gué en pierres plates espacées, la lame d'eau de `eau.ts` passant entre elles; roseaux, joncs et quelques nénuphars instanciés dans `vegetation.ts`; liseré d'écume le long des berges et autour des pierres (l'écume existe déjà dans `eau.ts`). | level-designer (contour), dev rendu (terrain), artiste-3d (pierres, roseaux), tech-artist (écume) | 240 min | +0,5 à +1 (et +0,3 au pilier 2) |
| 3 | **Le soir et l'intérieur perdent leur relief.** À 18 h 30, tout vire à l'orange-brun: écart des gris 19, contre 29 à 34 en journée et 37 la nuit; la place, le quai et les personnages se fondent (`da-05`, en bas à gauche). À 19 h 45, la pièce de la maisonnette est le coin le plus sombre et le plus terne de l'écran (moyenne 44, écart 15): le chez-soi n'a rien de douillet, seul le poêle luit. | `da-05-soir-nuit-gris.png`, `da-06-interieur-soir-pluie.png` (à gauche). | Soir: garder la chaleur dans le soleil mais refroidir l'hémisphérique côté ciel (bleu-violet clair, vers #8F9BC8) pour séparer lumière chaude et ombre froide, soleil 10 % plus fort; cible écart ≥ 25 à 18 h et 19 h, moyenne 80 à 95. Intérieur: une lumière de foyer chaude (une des quatre ponctuelles du budget) tant que le joueur local est dans la maison après 18 h, plus une flaque de lumière au sol (`surfaces.ts`); cible moyenne ≥ 70 et écart ≥ 25 dans la pièce. | tech-artist | 90 min | +0,5 |
| 4 | **Premiers plans qui bouchent la vue et trous de visibilité trop visibles.** Les houppiers de la forêt du pourtour couvrent le bas de l'écran (environ un tiers de l'image au gué), sans s'effacer puisqu'aucun joueur n'est derrière. Sous la marquise, le trou ménagé pour le joueur laisse un halo tramé brun autour de lui, qui se lit comme une tache. | `da-03` (bas de l'image), `da-04-quai-train.png` (Camille sous la marquise). | Forêt du pourtour: couper ou effacer en fondu, à hauteur réglable, les arbres entre la caméra et la bande basse du cadre (même principe que les trous des joueurs, appliqué au bord d'écran), ou les abaisser côté caméra. Trou du joueur: bord plus net (trame plus fine ou liseré clair de 1 px), et ne trouer que ce qui cache plus d'un tiers de la silhouette. | dev rendu, tech-artist | 120 min | +0,3 à +0,5 |
| 5 | **Grandes surfaces nues.** Le toit de la marquise du quai est une dalle grise unie avec quelques points noirs, celui de la voiture aussi: au cœur du lieu le plus important (train, cloche, banc de l'énigme), ce sont les plus grandes surfaces de l'écran et les moins finies. Même remarque, plus légère, pour les grands aplats de la place (une fois le damier traité, prévoir bancs de fleurs, bornes, caniveau). | `da-04-quai-train.png`. | Tôle ondulée en facettes ou bandes alternées `lauze` et `lauze_light`, faîtière et gouttière, quelques taches de mousse; lanterneaux sur le toit de la voiture; bacs de fleurs et une borne-fontaine sur la place. Budget: moins de 2 000 triangles en tout. | artiste-3d | 120 min | +0,3 |

Remarque de finition (non classée): la vapeur de la locomotive est faite de disques blancs flous, seul élément « doux » dans un monde en facettes; des bouffées à facettes (icosphères aplaties, deux tons) tiendraient mieux le style (`da-04` et l'arrivée du train, non jointe faute de place).

Point de vigilance (non classé, il touche aussi la coopération): les deux joueurs se distinguent par la tenue et la coiffure, et le foulard (le signe du profil Duo) ne fait que 6 à 10 px à 1366 x 768 au zoom courant. En niveaux de gris, les tenues bleue et sauge sont de valeur proche (`da-07`, en haut à droite). Comme la création autorise deux tenues identiques (« Déjà portée par Sacha »), il faut un signe qui reste lisible de loin: anneau au sol à la couleur du profil sous le joueur local, ou foulard agrandi d'un tiers avec un pan qui flotte. À trancher au tour qui traitera la coopération.

## Synthèse pour le manager

| Pilier | Note | Les trois chantiers qui rapportent le plus |
|---|---|---|
| 2. Vie du monde et animation | 5/10 | vent et fumées (+1), petite faune (+1), attentes variées (+0,5 à +1) |
| 3. Direction artistique | 6/10 | sol sans damier ni escalier (+1 à +1,5), rivière et gué (+0,5 à +1), soir et intérieur (+0,5) |

Ordre conseillé pour le tour suivant: le sol (pilier 3, défaut 1) puis le vent (pilier 2, défaut 1). Ce sont les deux défauts visibles dans chaque plan, et le vent se fait sans aucun coût de rendu.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-01/`:

- `da-01-place-matin-damier.png`: la place à 8 h 15 (damier des pavés, habitants dans la même attente).
- `da-02-potager-marche-planche.png`: cinq images successives (0,5 s) du potager, Camille marche la bêche en main, Sacha arrose.
- `da-03-gue-canal-premier-plan.png`: le gué à 14 h, pêche à la touche (canal rectangulaire, gué en dallage, forêt qui bouche le bas).
- `da-04-quai-train.png`: le quai à 10 h, train à l'arrêt (marquise nue, halo tramé autour du joueur).
- `da-05-soir-nuit-gris.png`: la place à 18 h 30 et à 22 h 30, même cadrage, en couleur puis en niveaux de gris.
- `da-06-interieur-soir-pluie.png`: l'intérieur à 19 h 45 et le potager sous la pluie à 11 h.
- `da-07-joueurs-gris-daltonisme.png`: les deux joueurs en couleur, en niveaux de gris, en deutéranopie et en protanopie.
- `da-08-jeu-reel-hud-planche.png`: la vraie simulation avec l'interface (mercredi, jour 5, de 9 h 20 à 9 h 40), trois images: taille réelle des personnages à 1366 x 768, poules qui bougent, aucun habitant dans le cadre.
