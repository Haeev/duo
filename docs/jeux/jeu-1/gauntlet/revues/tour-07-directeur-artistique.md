# Gauntlet, tour 7: revue adverse du directeur artistique (G6 visuel, G8, G9, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-11-01 |
| Version revue | branche `claude/stoic-lamport-lueey2`, `ddcbca0` (arbre principal servi par une copie de `/tmp/dg3d-budget/serveur.sh`, port 5231, relancé avant les captures) |
| Référence | revue du tour 6 (`tour-06-directeur-artistique.md`, contrôle après correctifs compris), conception du tour 7 (`tour-07-conception.md`, fiches 1.4.7 à 1.4.9, section 7), bible 8 et 8.10 |
| Verdict G6 (visuel) | **oui, mieux qu'avant**: trois moments neufs qui se voient au zoom de jeu, une faune d'ambiance permanente, plus aucun trou tramé autour des bêtes, aucune régression vue |
| Verdict G8 | **non**: la chevrette a des oreilles en lames étroites et dressées qui, de profil, se lisent comme des dagues de brocard, au moment précis où les joueurs la regardent (regard du « figer »). 20 min de reprise. Deux défauts légers à côté |
| Verdict G9 | **oui**: chaque élément posé a sa raison (pieu à l'eau profonde, chevrette entre rocher et haie, lisières reculées justifiées par une pâture et un pré de fauche, brume arrêtée au ponton). Deux retouches légères (bitte du ponton en double avec le pieu, pieds du joueur est sur la rive du toit) |
| Bloquant pour `main` | oreilles de la chevrette (G8). Rien d'autre |
| Notes proposées | **pilier 2: 8/10** (7,5 avant); **pilier 3: 7,5/10** (inchangé) |

## Méthode

- Page `rendu.html?stats=0&vie=0&manuel=1&moment=<id>&t=<s>&phase=..&zoom=..&orientation=..`, 1366 x 768, rendu normal, 40 images de 1/30 s avancées avant chaque capture. Piège noté pour la suite: en `manuel=1`, `lplRendu.frames` n'avance pas tout seul; attendre `ready`, puis avancer.
- 15 captures faites par moi (script `/tmp/da-t7/cap.cjs`, hors dépôt): martin-pêcheur (orientations 0 et 1, zooms 0 et 1, t 1,9 et 2,9 s), chevrette (apogée 5 s en orientation 0, regard de l'attente en orientation 3), brume (attente, apogée 3 s en orientation 2, 5,2 s en orientation 0), pâture de l'est (orientations 0 et 3), pré inondable (orientations 0 et 1), échelle de Basile (t 2,85 s). Aucune erreur de page ni de console. Plan le plus chargé de ces captures: 135 674 triangles, 79 appels de dessin (échelle), dans les budgets de la bible 8.8.
- Gros plans agrandis x 4 au plus proche (pixels réels); L* CIELAB mesuré par ImageMagick sur des zones de la brume, de l'eau et des berges; niveaux de gris de la brume.
- Relu: toutes les planches de l'équipe dans `captures/tour-07/` (`faune-*`, `moment-*`, `eclaircie-*`, `echelle-4-orientations`, `main-nichoir`, `place-joueur-est*`, `souvenirs-*`, `interface-moments-*`, `correctif-qa7-*`); les 12 symboles `memory-*` de `ui-maquettes/outils/icones-source.svg` rendus à 40, 60 et 190 px, en couleur et en gris; `brume.ts`, `ciel.ts`, `RENDER_SETTINGS.terrain.forestClearings`, `faune.py` (`KF_SCALE`), `bourg.py` (`pontoon`).

Planches probantes (`captures/tour-07/`): `da-martin-pecheur.png`, `da-chevrette-oreilles.png`, `da-brume.png`, `da-nappes-matin.png`, `da-lisieres.png`, `da-retouches-g9.png`, `da-vignettes.png`.

## Point 1: le martin-pêcheur et l'ablette se lisent-ils ? Oui par ce qu'ils font, pas par leur silhouette

Planche `da-martin-pecheur.png`.

- **Échelle x 1,5: je la retiens, et je n'irai pas plus loin.** Au zoom 1, l'oiseau fait 5 pixels sur son pieu en orientation 0, 8 pixels au zoom 0: une tache bleue et orange au sommet d'un poteau. À x 2 (0,34 m), il serait plus large que le fût de 16 cm qui le porte et plus gros que la tête du héron: l'échelle du bourg casserait, pour gagner 2 pixels. La fiche ne demande pas de le viser (déclenchement sans regard): ce qui doit se lire, c'est le poste, le plongeon et le retour.
- **Ce qui se lit**: le pieu (0,45 m au-dessus du plancher, il dépasse nettement du coin du ponton), la gerbe et les ronds du plongeon, le sifflet. En orientation 1, l'oiseau se détache sur l'eau et se lit mieux qu'en orientation 0, où il se détache sur le plancher brun et gris.
- **Ce qui manque, et qui ferait la lecture**: la **traînée bleue** de 0,3 s en vol et **l'éclat d'argent** de l'ablette, tous deux écrits dans la fiche 1.4.8 (« un éclat d'argent au bec », « traînée bleue de 0,3 s ») et dans les tâches du tech-artist (section 4), ne sont pas livrés (`grep` sans résultat dans `src/rendu/`). Aujourd'hui, l'ablette (12 cm à x 1,5, `fish_silver` #BAC4C7 sur une eau de même valeur) est invisible au zoom 1, et le texte d'apogée annonce un éclat qu'on ne voit pas.
- **Ablette**: je ne l'agrandis pas (elle doit tenir en travers du bec). C'est l'éclat qui la porte.

Corrections (non bloquantes, avant la bêta):

| Correction | Pourquoi | Qui |
|---|---|---|
| Éclat sur l'ablette: petite étoile blanche (#FFFFFF, 0,12 m, 2 ou 3 images de 0,1 s) quand elle sort de l'eau (t 1,8 s) et à chaque coup sur le pieu (2,7 et 3,2 s); programme des particules, aucun matériau neuf | rend vrai le texte d'apogée; seul repère visible du poisson au zoom 1 | tech-artist |
| Traînée bleue `kingfisher_teal` #2BB5C8 au ras de l'eau pendant `kf_fly` (0,3 s de persistance, 6 à 8 quadrilatères) | c'est ainsi qu'on voit un martin-pêcheur en vrai: un trait bleu au ras de l'eau; se lit à 5 pixels de large | tech-artist |

## Point 2: la chevrette (G8, bloquant)

Planche `da-chevrette-oreilles.png`.

Le modèle est juste dans l'ensemble (pelage roux, ventre clair, museau noir et blanc, écusson crème qui se voit dans les bonds, faon tacheté aux pattes grêles: `faune-4angles-*`, `faune-echelle-tour7.png`). Mais ses oreilles sont des **lames étroites, plantées haut et dressées**: de face ou de trois quarts, elles se lisent comme des oreilles; **de profil, chacune devient un trait pointu qui monte au-dessus du crâne**, exactement la silhouette d'un brocard à dagues. En jeu, au zoom 1, c'est ce qu'on voit pendant `deer_lookup` et `deer_watch_fawn` (capture d'orientation 3: une pointe au-dessus de la tête), c'est-à-dire pendant le regard du « figer », l'instant où les deux joueurs la fixent. Une chevrette n'a pas de bois: la scène dit « une mère et son faon », la silhouette dit « un mâle ». Même défaut sur la vignette provisoire (point 6).

Correction (artiste-3d, 20 min; `faune.py`, clips inchangés):

- Oreilles **en ovale large** (0,13 m de long, 0,07 m de large au plus large, soit à peu près la moitié de la longueur), **creusées** (deux faces décalées de 1 cm, intérieur crème), **écartées en V** à 35 à 40° de la verticale et un peu ouvertes vers l'avant, plantées sur les côtés du crâne et non sur le dessus.
- Contrôle: rendu de profil strict (azimut 90 et 270) en `deer_lookup`: le contour des oreilles doit être un ovale, jamais une pointe; puis capture en jeu au zoom 1, orientation 3, attente 8,2 s.

Défaut léger à reprendre dans le même passage: le « pinceau » sous l'écusson est une **plaque blanche qui pend** sous la croupe (`faune-4angles-roe_deer.png`, vues 2 et 3): le fondre dans l'écusson en un petit lobe (une forme gonflée, pas une planche).

## Point 3: la brume de l'Aubrune (transparence, coût, beauté)

Planche `da-brume.png`.

- **Ce qui marche**: la nappe reste sous la taille des personnages et on reconnaît l'autre sur la rive d'en face; elle ne touche ni les toits ni le banc de la berge; elle s'effiloche au ponton; le front qui se lève de l'aval vers le gué se lit très bien (à 5,2 s, eau claire et scintillante d'un côté, nappe de l'autre, bord doux). Le mouvement est beau.
- **Ce qui ne marche pas: la valeur.** Mesuré sur l'attente en orientation 0: nappe au-dessus de l'eau **L\* 40**, eau claire 26, berge de sable dans la brume **48**. **La brume est plus sombre que les berges**: elle se lit comme de la fumée ou de la poussière mauve, pas comme un voile de lumière. En gris (dernière vignette de la planche), on lit un ruban terne. Une brume de petit jour est la chose la plus claire du cadre après le ciel. Deuxième point: les 700 bouffées de 0,45 à 1 m se voient une à une (texture « coton » à bosses régulières), au lieu d'un banc continu.
- **Teinte dorée de l'apogée** (`lightGrade` #FFD9A0, force 0,35, montée en 3 s): je la fixe telle quelle sur le décor; c'est la brume elle-même qui doit la prendre et s'éclaircir (crème pêche), sinon la lumière dorée roussit tout le cadre sans rien faire briller.
- **Coût**: un appel de dessin, aucun programme neuf; les plans de la brume que j'ai capturés font 120 800 à 128 900 triangles et 58 à 69 appels. Le vrai coût est le remplissage: 700 bouffées d'environ 0,5 m² au zoom 1 font de l'ordre d'un écran et demi de pixels mélangés, concentrés sur la rivière (7 à 8 couches au plus épais). Supportable sur un UHD 620 avec un programme aussi simple, mais non mesuré ici (rendu logiciel): à mesurer chez le client (mode léger: 260 bouffées).

Correction (tech-artist, 45 min, non bloquante pour `main`, à faire avant la bêta):

1. Couleur éclairée de la nappe plus claire que tout ce qui l'entoure: viser **L\* 70 à 78 au-dessus de l'eau** à l'aube (au lieu de 40), par une part de lumière propre (mélange vers la couleur du ciel) plutôt que par l'opacité; à l'apogée, la couleur suit la teinte dorée vers une crème pêche (vers #FFE9CF).
2. Bouffées **moins nombreuses, plus larges et aplaties** au ras de l'eau (par exemple 350 de 1,2 à 2 m, étirées dans le sens du courant, 2 pour 1); garder les petites pour les volutes du front seulement. Même surface couverte, donc même remplissage, sans « coton ».
3. Opacité au-dessus de l'eau de 0,7 à 0,55: l'éclaircissement suffira à la lecture et laissera voir l'eau.
4. Contrôle: même cadre que `da-brume.png` (attente, orientation 0, zoom 1): L\* de la nappe au moins 15 au-dessus de la berge, aucun bord de bouffée visible à l'œil.

## Point 4: les nappes de brume du matin ont des bords droits (moyen, ancien, révélé par le tour)

Planche `da-nappes-matin.png`.

Aux heures du matin (6 h à 8 h 30, donc pendant la chevrette et la brume), de grands **parallélogrammes plus clairs aux bords droits** traversent le pré et la place: bord bas horizontal à l'écran, coins nets. Ce sont les 26 bancs de brume d'ambiance de `ciel.ts` (bouffées de 5,5 m, centre à 0,5 m du sol, toujours face à la caméra): la moitié basse de chaque carré passe sous le sol, qui le coupe en ligne droite. Ce n'est pas une régression du tour 7, mais les deux moments neufs ont lieu à l'aube et le montrent dans leurs plans clés (on le voit aussi sur `eclaircie-chevrette.png` et `moment-brume.png`).

Correction (tech-artist, 30 min, non bloquante pour `main`, nécessaire pour le 8 du pilier 3): bancs **posés à plat** (mode « sprites posés » des particules, comme la brume de l'Aubrune) à 0,3 m du sol, ou fondu de l'alpha sur le bas de la bouffée; aucun programme neuf. Contrôle: même cadre que la planche, niveaux resserrés, aucune ligne droite.

## Point 5: lisières reculées, pâture et pré inondable

Planche `da-lisieres.png`, avec `eclaircie-*.png` de l'équipe.

- **Cohérence: oui.** La raison est juste et écrite dans les réglages: derrière la haie du bord est, le pré se prolonge en pâture que le bétail garde ouverte; face à l'anse, le fond de vallée inondé l'hiver reste en prairie de fauche, et c'est son air froid qui fait fumer la rivière le matin de la brume. La lisière recule là où un vrai bois reculerait, et revient à sa place avant la voie.
- **Sol trop nu ? Non.** Hors de la carte, le sol garde le même semis que dans la carte (mélange des trois verts, touffes, fleurs, buissons): la pâture se raccorde au pré sans couture, le pré inondable a ses buissons et un arbre isolé. Rien à ajouter pour la lisibilité.
- **Lisière**: en orientation 1 et sur la pâture, le bord est naturel (ondulation de 0,8 m et fondu de 3 à 4 m). En orientation 0, au pré inondable, la lisière forme un rideau d'arbres assez régulier en bas d'écran: acceptable.
- **Bénéfice visuel**: plus aucun trou tramé autour de la chevrette ni des joueurs de la brume (comparer les colonnes « avant » et « après » de `eclaircie-chevrette.png` et `eclaircie-brume.png`): les plans sont plus propres, c'est un vrai gain du tour.

Suggestions (facultatives, après la bêta, level designer et dev rendu): trois ou quatre touffes de joncs au bord de l'anse sud et un saule isolé dans le pré inondable (milieu humide), une barrière de pâture en bois dans la haie de l'est (là où l'on fait passer le bétail). Elles disent le lieu; aucune n'est nécessaire à la lecture.

## Point 6: les vignettes provisoires du carnet (à confier à l'artiste 2D)

Planche `da-vignettes.png` (les 12 symboles actuels à 40, 60 et 190 px, couleur et gris).

Les substituts du dev sont de bonne tenue (même encre, même disque teinté, sujets reconnaissables à 40 px pour le héron, les oies, le renard, les vers luisants, les mésanges, les poules et le mot de Lucie). Mais ce sont des substituts, visibles dans un écran que le duo ouvrira souvent: ils ne peuvent pas rester à la bêta. Défauts relevés:

| Vignette | Constat |
|---|---|
| `memory-roe-deer` | deux pointes dressées sur la tête: on lit des bois (le game designer l'a vu aussi). La chevrette a le gabarit d'un cheval, le faon est collé à elle sans geste |
| `memory-ladder` | l'échelle est désormais dessinée, mais elle ne s'appuie sur rien de net et le nichoir est posé au sommet d'un tronc coupé, comme sur un poteau |
| `memory-mist` | deux silhouettes en pions identiques, sans visage ni distinction; la brume est deux bandes blanches; aucune lumière d'aube |
| ensemble | épaisseurs d'encre inégales (renard et poules épais, héron et oies fins); lignes de sol de styles différents |

### Liste et consignes pour l'artiste 2D

Livrable: les **14 vignettes définitives** dans `games/la-petite-ligne/ui-maquettes/outils/icones-source.svg`, **mêmes identifiants de symbole** (aucun code à toucher), sprite régénéré par `outils/generer-icones.mjs`, captures de l'onglet par `outils/capturer-souvenirs.cjs` (100 et 150 %, les deux joueurs), plus une planche à 40, 60 et 190 px en couleur et en gris comme `da-vignettes.png`.

| Identifiant | Sujet (une action, celle de la phrase du souvenir) |
|---|---|
| `memory-heron` | le héron, cou en S, qui s'envole au ras de l'eau du gué |
| `memory-geese` | le V des oies au-dessus de l'eau, cap au nord |
| `memory-ladder` | l'échelle appuyée contre le tronc du grand chêne, le nichoir redressé sur le tronc (pas au sommet), un bout de houppier |
| `memory-tits` | une mésange à l'entrée du nichoir, l'autre sur le toit |
| `memory-fox` | le renard qui mulote (bond, pattes avant groupées) dans l'herbe près du ballast |
| `memory-glowworms` | les points vert-jaune #B8F05A dans l'herbe haute, nuit bleue |
| `memory-roe-deer` | la chevrette **sans bois**, oreilles larges en V, qui lèche le faon tacheté en train de téter; herbe à mi-pattes |
| `memory-kingfisher` | le martin-pêcheur sur le pieu (bande de mousse), l'ablette en travers du bec avec son éclat blanc |
| `memory-mist` | deux silhouettes de dos et de face de part et d'autre de l'eau, une claire et une foncée (forme ou motif différent, pas seulement la teinte), nappe blanche effilochée au ras de l'eau, soleil bas doré |
| `memory-hen-names` | les trois poules (rousse, blanche, noire) qui accourent |
| `memory-lucie-note` | le billet plié sous son galet |
| `memory-falling-stars` (à créer, moment des étoiles) | deux dos assis au bout du ponton, une traînée claire reflétée dans l'eau sombre |
| `memory-odette-waltz` (à créer) | le phonographe à pavillon et deux silhouettes qui tournent, mains jointes |
| `memory-train-salute` (à créer) | la locomotive de trois quarts, le mécanicien penché qui lève sa casquette, une lisse levée |

Garder `memory-generic` (carnet ouvert) pour un moment pas encore dessiné.

Consignes communes:

1. Grille de 40 x 40, sujet tenu dans le disque de 36 px (2 px de marge), disque teinté de la palette du décor (`palette.py`), un ton par moment, comme aujourd'hui.
2. Encre #2A2522, **une seule épaisseur pour toutes**: 1,5 px à 40 px (1,5 unité du `viewBox`), 2 px pour le contour extérieur du sujet. Pas de dégradé, pas de flou, pas de texte.
3. Trois couleurs au plus en plus de l'encre et du disque, prises dans la palette du décor; les bêtes reprennent leurs cases (`fox_red`, `heron_grey`, `kingfisher_teal`, etc.).
4. **Lisible en niveaux de gris à 40 px**: au moins 25 points de L\* entre le sujet et son disque; la silhouette seule (ombre chinoise) doit dire la bête.
5. Profil ou trois-quarts, un seul sujet principal, une ligne de sol commune (trait de 1,5 px, couleur de l'élément: eau, herbe, ballast).
6. Rien qui trompe sur le sujet (pas de bois à une chevrette, pas de pions à la place des joueurs); rien d'emprunté à un jeu existant.
7. Contrôle avant rendu: la planche en gris, et l'onglet à 40 px (100 %) et 60 px (150 %) sur les deux postes de la page de démonstration.
8. Si un dessin change ce que dit le texte de remplacement (`texts.vignette` dans `moments.json` et `textes.json`), le signaler au game designer, qui l'aligne.

Effort estimé: 3 h pour les 11 actuelles, 1 h pour les 3 à créer.

## Point 7: autres livrables du tour

- **Faune d'ambiance** (`faune-ambiance.png`): mésanges posées sur les buissons de la lisière, qui fuient en arc vers le chêne à l'approche d'un joueur; papillons du pré à midi par beau temps, aucun sous la pluie. Juste, discret, du même style. Défaut léger vu de près: les fleurs des buissons sont des **cubes blancs** à la loupe de 5 m (`faune-ambiance.png`, vignette 2): les remplacer par de petites étoiles à 5 pointes ou des icosphères de 20 faces (artiste-3d, 15 min; modèle de buisson ancien, défaut non introduit par le tour).
- **Échelle sous les quatre orientations** (`echelle-4-orientations.png`): le correctif du tour 6 est fait. En orientation 1, tête et bras de Basile dégagés; en orientation 2, échelle et Basile visibles dans le trou du moment; l'orientation 3 garde un recouvrement du joueur 1 sur Basile, acceptable.
- **Main de Basile au nichoir** (`main-nichoir.png`): à 2,7 s, la main droite tient le bas de la caisse pendant le pivot, puis se relâche au marteau. Réglé.
- **Place du joueur est** (`place-joueur-est*.png`, `da-retouches-g9.png`): les pieds ne sont plus coupés par le toit de la remise, mais ils tombent **pile sur la rive du toit** à l'écran: au zoom 1, il semble debout sur le bord du toit. Léger (point 9).
- **Interface des moments** (`interface-moments-*`): mêmes cartes, mêmes icônes et même voix que le tour 6; la ligne « Sacha est sur la même rive que toi » se lit bien à 100 et 150 %. Rien à reprendre côté visuel (le défaut de logique de la ligne de brume relève du game designer et de la QA).
- **Correctifs QA7** (`correctif-qa7-*`): le joueur écarté du trajet des bonds ne recoupe plus la chevrette. Rien à reprendre côté visuel.
- **Modèles neufs, liste 8.10** (point 8 ci-dessous).

## G6 visuel: « mieux qu'avant » ? Oui

1. **Trois moments neufs qui se voient au zoom de jeu**: la chevrette et le faon (lever, tétée, bonds avec l'écusson clair), le martin-pêcheur par son pieu et son plongeon, la brume et son front qui se lève entre les deux joueurs. Chacun a un lieu juste et une lumière de matin.
2. **La faune vit hors des moments**: mésanges et papillons d'ambiance, le manque qui bloquait le 8 du pilier 2 au tour 6.
3. **Plans plus propres**: les trous tramés de la chevrette et de la brume disparaissent avec les lisières reculées; l'échelle se lit mieux en orientations 1 et 2; la main de Basile touche enfin le nichoir.
4. Aucune régression de lumière, de palette ni de lisibilité vue sur les plans relus; budgets tenus sur mes captures (au plus 135 674 triangles et 79 appels).

Les oreilles de la chevrette ne font pas tomber le « oui » (le moment est un gain net), mais elles font tomber G8.

## G8: détails de construction (liste 8.10)

| Modèle | Points | Constat | Gravité | Correction (artiste-3d) |
|---|---|---|---|---|
| `roe_deer` | 9, 10 | Oreilles en lames étroites et dressées: de profil, deux dagues de brocard (point 2) | **bloquant** (visible au zoom 1 pendant le regard du « figer ») | Oreilles en ovale large, creusées, écartées en V à 35 à 40°. 20 min |
| `roe_deer` | 3 | Pinceau en plaque blanche qui pend sous l'écusson | léger | Lobe gonflé fondu dans l'écusson. Même passage |
| `kingfisher` | 3 | Queue en plaque bleue plate posée sous le croupion, qui déborde du corps en vues 2 et 3 (`faune-4angles-kingfisher.png`) | léger (invisible en jeu) | Queue courte en coin épais (2 cm à la base), dans le prolongement du dos. 10 min |
| `fawn` | 1 à 10 | Taches en rangées, pattes grêles, oreilles larges (elles, justes), queue courte | aucun | |
| `small_fish` | 1 à 10 | Fuseau à facettes, nageoires simples; 8 cm de long, ce qui est voulu | aucun (la lecture passe par l'éclat, point 1) | |
| `mooring_post` | 1 à 10 | Fût de 16 cm à 6 pans, sommet usé chanfreiné, bande de mousse à la ligne d'eau, anneau de fer sur la face du large; 0,45 m au-dessus du plancher | aucun | |
| Ponton (`pontoon`, ancien) | 10 | Sa bitte de coin et sa corde sont à 10 cm du pieu neuf (G9, point 9) | léger | voir point 9 |

## G9: cohérence du monde

| Élément | Au bon endroit, dans le bon sens, à la bonne taille ? | Verdict |
|---|---|---|
| Chevrette du pré | Herbe rase entre le rocher et la haie, faon dans l'herbe haute à 1,8 m, sortie et retour par la haie; rien de haut au sud-est en orientation 0 | oui |
| Pieu du martin-pêcheur | Coin du ponton sur la seule eau profonde accessible à pied sec, 0,45 m au-dessus du plancher (poste d'affût visible), mousse à la ligne d'eau, anneau vers le large | oui, avec la retouche de la bitte (point 9) |
| Brume | Seul passage où les rives se font face à 4 m, nappe sous les épaules, arrêtée au ponton, rien au nord de la berge | oui |
| Lisières reculées | Pâture derrière la haie de l'est, pré de fauche au fond de vallée inondable: un bois recule là, pas ailleurs; la lisière revient avant la voie | oui |
| Mésanges et papillons d'ambiance | Mésanges sur les buissons de lisière, fuite vers le chêne; papillons sur le pré de fauche, au soleil seulement | oui |
| Place du joueur est (échelle) | Au montant, de côté; mais ses pieds tombent sur la rive du toit de la remise à l'écran | oui, retouche légère (point 9) |

## Notes proposées

### Pilier 2, vie du monde et animation: 8/10 (7,5 avant)

Ce que je demandais au tour 6 pour le 8 est là: une petite faune d'ambiance permanente (mésanges qui se posent et fuient, papillons au soleil qui se cachent à la pluie), et des moments qui ne sont plus seulement des bêtes: la brume naît de la pluie de la veille, la journée et la météo écrivent enfin un spectacle. La chevrette réagit aux joueurs (regard, coup de sabot, recul), le martin-pêcheur fuit qui s'approche trop. Restent sous le 8,5: l'eau du gué qui ne court toujours pas (lame d'eau peu visible), la traînée et l'éclat du martin-pêcheur, et une brume qui bouge bien mais brille mal.

### Pilier 3, direction artistique: 7,5/10 (inchangé)

Gains réels: faune neuve du même style et de la même palette (une seule case ajoutée, `kingfisher_teal`), plans sans trous tramés, échelle et main de Basile réglées, interface du carnet soignée. Mais le tour fait entrer une forme qui trompe (la chevrette « à bois »), une brume plus sombre que ses berges, 14 vignettes encore provisoires dans un écran qu'on ouvrira souvent, et il met en avant les bancs de brume du matin à bords droits. Et les trois points qui bloquaient déjà le 8 restent ouverts: place en aplat gris, berges à angle droit (damier sable et pierre, encore très visible sur toutes les captures de la rivière), gué sans eau qui court. Le 8 viendra avec ces trois-là, les bords des nappes du matin et les vignettes définitives.

## Défauts restants, par gravité

| Gravité | Défaut | Correction | Propriétaire | Effort |
|---|---|---|---|---|
| **Bloquant** (G8) | Oreilles de la chevrette lues comme des dagues de profil | Ovales larges, creusées, en V (point 2); capture de contrôle en jeu, orientation 3, attente 8,2 s | artiste-3d, puis dev gameplay 3D (capture) | 20 min |
| Moyen | Brume de l'Aubrune plus sombre que les berges (L\* 40 contre 48), bouffées visibles une à une | Nappe à L\* 70 à 78, bouffées larges et aplaties, opacité 0,55 (point 3) | tech-artist | 45 min |
| Moyen (ancien, révélé) | Bancs de brume du matin à bords droits, coupés par le sol | Bancs posés à plat ou fondu du bas (point 4) | tech-artist | 30 min |
| Moyen | Pas de traînée bleue ni d'éclat sur l'ablette, alors que le texte d'apogée les annonce | Point 1 | tech-artist | 40 min |
| Moyen | Vignettes du carnet encore provisoires (chevrette « à bois », brume en pions, échelle sans appui, encres inégales) | 14 vignettes définitives selon la liste et les consignes du point 6 | artiste-2d (texte de remplacement: game designer) | 4 h |
| Léger | Bitte et corde du ponton à 10 cm du pieu neuf: deux amarrages côte à côte | Retirer la bitte du coin sud-est de `pontoon` (`bourg.py`) et nouer le bout de corde à l'anneau du pieu (il pend vers l'eau); le pieu devient l'amarrage de la barque, comme le dit la fiche; aucune image clé à changer | artiste-3d | 15 min |
| Léger | Pieds du joueur est sur la rive du toit de la remise à l'écran (zoom 1) | `ladder_hold_east` reculé encore de 0,12 m en x et en y le long de l'échelle, vers (51,36 ; 5,54): même colonne, environ 5 pixels plus haut, tronc à 0,86 m; ou accepter tel quel (aucun recouvrement) | level-designer (`construire_carte_halte.py`) | 10 min |
| Léger | Pinceau de la chevrette en plaque, queue du martin-pêcheur en plaque | Point 8 | artiste-3d | 15 min |
| Léger (ancien) | Fleurs des buissons en cubes blancs vus de près | Étoiles à 5 pointes ou icosphères de 20 faces | artiste-3d | 15 min |
| Léger (ancien) | Sous le ponton, un rectangle de fond plus clair au contour net se voit à travers l'eau (`da-martin-pecheur.png`) | Fond de rivière continu sous l'emprise du ponton | dev rendu | 20 min |
| Ouvert (tours 5 et 6) | Place en aplat gris, berges à angle droit en damier, gué sans eau qui court | Voir la revue du tour 6 | tech-artist, dev rendu, level-designer | 240 min |

## À tester chez le client

- Fluidité pendant l'apogée de la brume sur le PC (700 bouffées mélangées sur la rivière; le mode léger en garde 260): ce coût de remplissage ne se mesure pas en rendu logiciel.
- Lisibilité du martin-pêcheur sur un écran de portable de 1366 x 768: le voit-on sur son pieu sans le chercher ?

## Contrôle après correctifs

Version contrôlée: `56bad2f` (commits `56d77ec` oreilles et amarre, `8ed936e` place est de l'échelle), arbre principal servi sur le port 5231 par une copie de `/tmp/dg3d-budget/serveur.sh`, 1366 x 768, `manuel=1`, 40 images de 1/30 s avancées par `lplRendu.advance`. Six captures faites par moi, aucune erreur de page ni de console; plan le plus chargé 136 174 triangles et 80 appels (dans les budgets). Planches relues: `correctif-oreilles-*` (dont `jeu-o1` et `jeu-o3`), `correctif-ponton-*`.

Planches probantes: `da-controle-chevrette.png`, `da-controle-ponton-echelle.png`.

| Point | Constat en jeu | Verdict |
|---|---|---|
| Oreilles de la chevrette, orientation 3, attente 8,2 s | La pointe au-dessus du crâne a disparu: l'oreille est une feuille large couchée vers l'arrière, intérieur crème visible. Plus aucune lecture de dague | corrigé |
| Oreilles de la chevrette, orientation 1, attente 8,2 s | L'oreille proche est un ovale clair ouvert sur le côté; l'oreille du fond reste un petit coin gris-brun dressé (environ 2 pixels de base, 4 de haut au zoom 1), comme l'a signalé l'artiste. Il se lit avec l'ovale clair comme une paire d'oreilles en V, pas comme un bois: une dague serait un trait fin et sombre, ici c'est un coin à base large et de teinte claire. C'est d'ailleurs ce qu'on voit d'une vraie chevrette de profil. En gris, même lecture | accepté |
| Profils stricts et faon (planches de l'artiste) | Ovales creusés en V sur les quatre azimuts et les deux profils, dos gris-brun, faon aux oreilles cohérentes avec la mère; pinceau fondu en lobe dans l'écusson | corrigé |
| Ponton, zoom 1, orientations 0 et 1 | Plus de bitte au coin: la glène est posée sur le plancher, l'amarre court jusqu'à l'anneau du pieu et le bout pend vers l'eau. Un seul amarrage, au bon endroit (le pieu sur l'eau profonde) | corrigé |
| Place est de l'échelle, zoom 1, orientation 0 | Le joueur est remonte d'environ 5 pixels le long de l'échelle. La pointe de ses pieds effleure encore le haut de la rive du toit de la remise (1 à 2 pixels, avec la trame d'occlusion du toit autour des chaussures); aucun recouvrement du corps | amélioré, accepté |

**G8: oui.** La silhouette de la chevrette dit « une mère », sous les deux orientations du regard du « figer ».

**G9: oui** (confirmé), les deux retouches légères sont faites.

Ce qui reste, **rien de bloquant pour `main`**:

- Léger, facultatif: dans `deer_lookup`, ouvrir l'oreille du fond de 10° de plus vers l'extérieur rendrait l'orientation 1 encore plus nette (artiste-3d, 5 min). À faire seulement si l'on repasse sur le modèle.
- Léger, facultatif: les pieds du joueur est frôlent la rive du toit à l'écran; reculer encore de 0,06 m le long de l'échelle effacerait le contact (level-designer, 5 min). Acceptable tel quel.
- Les défauts moyens et ouverts du tableau précédent (brume trop sombre, bancs du matin, traînée et éclat du martin-pêcheur, vignettes, place, berges, gué) sont inchangés par ce correctif et restent à traiter avant la bêta.
