# Gauntlet, tour 8: revue adverse du directeur artistique (G6 visuel, G8, G9, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-11-01 |
| Version revue | branche `claude/stoic-lamport-lueey2`, `5625f72` (rendu identique à `0e12872`: les commits suivants ne touchent que la simulation et l'interface), arbre principal servi par une copie de `/tmp/dg3d-budget/serveur.sh`, port 5231, relancé avant les captures |
| Référence | revue du tour 7 (`tour-07-directeur-artistique.md`), conception du tour 8 (`tour-08-conception.md`), bible (`bible-artistique-demo.md`, liste de contrôle 8.10), `ETAT.md` du jeu (tour 8) |
| Verdict G6 (visuel) | **oui, mieux qu'avant**: la place, les berges et le gué quittent enfin le damier provisoire, la passe de rendu donne du volume, les saisons changent le monde, et les trois retouches du tour 7 (brume claire, bancs couchés, traînée du martin-pêcheur) sont faites |
| Verdict G8 | **non**: le roncier, au zoom de jeu, se lit comme une araignée verte (quatre tiges arquées terminées par une boule de feuilles, bouts suspendus en l'air). 25 min de reprise. Le reste passe |
| Verdict G9 | **oui, avec deux réserves moyennes non bloquantes**: la vigne de la tonnelle reste verte en automne et en hiver; les pierres du gué forment une grille au lieu d'un passage. Tout le reste a sa raison |
| Bloquant pour `main` | le roncier (G8). Rien d'autre |
| Notes proposées | **pilier 2: 8/10** (inchangé); **pilier 3: 8/10** (7,5 avant), à confirmer après la reprise du roncier |

## Méthode

- 16 captures faites par moi sur l'arbre principal, plus 7 des variantes d'étalonnage, `rendu.html?stats=0&vie=0&...`, 1366 x 768, rendu normal (script `/tmp/da-t8/cap.cjs`, hors dépôt): place à 8 h 15 et 19 h (orientations 0 et 2), bord sud de la place (zoom 0), gué (zoom 0, orientations 0 et 1), quai à 16 h (lauzes), place en automne, en hiver et en été, tonnelle en automne au zoom 0, brume du matin sur la rivière (`brume=1`, 7 h 15), lisière (`lisiere=1`, zoom 0, orientations 0, 1 et 2). Aucune erreur de page ni de console. Plan le plus chargé de mes captures: 171 486 triangles et 80 appels (quai, train à quai), dans les budgets de la bible 8.8.
- Essais d'étalonnage sans toucher au dépôt: copie du jeu dans `/tmp/da-t8/jeu`, Vite à part (port 5239, arrêté depuis), trois variantes de `AMBIANCE_SETTINGS.look` (A, B, C ci-dessous) capturées aux mêmes cadrages que l'arbre principal.
- Mesures L\*, a\*, b\* CIELAB par ImageMagick sur des zones fixes; conversions en niveaux de gris.
- Relu: toutes les planches de l'équipe dans `captures/tour-08/` (`rendu-*`, `decor-*`, `saisons-*`, `objets-*`, `cueillette-*`, `interface-saison-*`, `interface-etape-15-*`), `ta-*.png` du dossier `tour-07`; réglages `look` et clés de lumière de `reglages-ambiance.ts`, variantes de saison de `assets-src/modeles/palette.py`, `arbor` de `bourg.py`.
- Pas de simulation de daltonisme ce tour: aucun signe ni aucune couleur de joueur n'a changé; la passe de rendu ne touche pas les écharpes (vu à l'œil sur `place-815`: écharpe et badge du joueur 1 inchangés).

Planches probantes (`captures/tour-08/`): `da-ombres-etalonnage.png`, `da-toit-lauzes-19h.png`, `da-roncier.png`, `da-gue-grille.png`, `da-place-bords.png`, `da-vigne-saisons.png`, `da-niveaux-de-gris.png`.

## 1. La passe de rendu: ombres teintées et étalonnage

### Ce qui marche

- **Le volume**: l'occlusion cuite pose enfin les objets (pied des murs, sous les bancs, au pied du puits et des troncs), la lumière de bord détache les personnages du sol. C'est le plus grand gain de lecture depuis le tour 3, sans programme ni appel de plus.
- **Les ombres froides du jour** (8 h à 16 h) sont justes: elles restent lisibles et donnent l'air d'une maquette éclairée, ce que demande le pilier « paisible ».
- **En gris** (`da-niveaux-de-gris.png`): le joueur, les bancs, les lampadaires et le puits se détachent à 8 h 15 comme à 19 h; l'eau reste 10 points de L\* sous le sable (48 contre 57 à 8 h 15).

### Ce qui va trop loin: la place à 19 h et les lauzes à l'ombre

- **La place à 19 h est trop violette, l'avis du manager est fondé.** Mesuré à l'ombre sur la terre battue (19 h, orientation 0): a\* +7 à +11, b\* -3 à +10, soit un mauve rosé; avant la passe, la même ombre valait a\* +5, b\* +16 (brun chaud). Trois choses s'additionnent: la teinte des ombres très saturée (#7d8fe0, chroma 46), le ciel de 19 h déjà bleu-violet (#c4c6de, voulu dans la revue du tour 3), et surtout la **saturation de l'étalonnage (1,25), qui agit le plus sur les teintes ternes, donc sur les ombres**. Le vignettage mauve (#3a2c3c) ajoute encore du violet aux coins du cadre, là où il fait le plus sombre.
- **Les toits de lauzes à l'ombre (question du technical artist): trop bleus en fin de journée, oui.** Les lauzes doivent rester « bleu ardoise » (bible, palette #737B86, b\* -7). À 16 h, l'ombre portée des lucarnes sur le pan de la halte vaut #1A2339 (L\* 14, b\* -16): limite haute acceptable. À 19 h en orientation 2, le pan arrière du toit de l'épicerie vaut **#182146 (L\* 14, b\* -25)**: on lit une tôle peinte en bleu roi, plus une ardoise (`da-toit-lauzes-19h.png`). La lucarne et la noue se lisent aussi en bleu marine franc.

### Réglages recommandés (essayés en jeu, `da-ombres-etalonnage.png`)

À reporter dans `AMBIANCE_SETTINGS.look` (`src/rendu/reglages-ambiance.ts`), technical artist, 10 min:

| Clé | Actuel | Recommandé | Pourquoi |
|---|---|---|---|
| `shadeTint` | `'#7d8fe0'` | `'#8794d0'` | même teinte (bleu froid), chroma 34 au lieu de 46: l'ombre reste froide sans virer au mauve |
| `shadeTintAmount` | `0.36` | `0.3` | |
| `saturation` | `1.25` | `1.15` | l'étalonnage resaturait les ombres ternes plus que tout le reste; l'herbe du matin perd aussi son côté acide |
| `vignetteColor` | `'#3a2c3c'` | `'#302a2f'` | vignettage presque neutre: il assombrit sans teinter |
| le reste (`shadeLift`, occlusion, `rim`, `gradeBalance`, `contrast`, `lift`, `vignette`, `vignetteStart`, `light`) | | inchangé | justes tels quels |

Effet mesuré de cette variante A (mêmes cadrages): ombre de la place à 19 h de b\* -3 / +4 / +10 à **+2 / +9 / +12**, a\* abaissé de 1 à 1,5, **L\* inchangé** (lisibilité et écarts de valeurs gardés); lauzes à l'ombre à 16 h de b\* -16 à -11.

Je **ne recommande pas** de toucher au ciel de 19 h (variante C: `skyColor` de la clé 1140 en `'#cac7d3'`): l'ombre de la place passe à b\* +8 à +17, brun tiède, et l'on perd l'opposition « lumière chaude, ombres froides » de la soirée. Ni d'aller plus bas sur la teinte (variante B: `'#8c97c8'` x 0,26, saturation 1,12): gain négligeable sur le toit (b\* -19) et les ombres de midi s'affadissent.

### Ce que le réglage global ne règle pas: le pan de lauzes à 19 h

Même avec A, B ou C, le pan arrière de l'épicerie reste à b\* -17 à -21 (`da-toit-lauzes-19h.png`). La cause est locale: une face entière tournée à l'opposé du soleil ne reçoit que la lumière du ciel teintée, sur une couleur déjà froide et sombre. Correction (technical artist, 30 min, dans le programme de la palette, aucun coût): **réduire la part de `shadeTint` sur les cases déjà froides** (par exemple multiplier la part par `1 - 0,6 x froideur`, la froideur valant la part de bleu de la case de palette au-delà du gris, bornée à 0..1), ou une liste de cases épargnées (`lauze`, `lauze_light`, `lauze_dark`, `slate` s'il en vient). Contrôle: même cadre que `da-toit-lauzes-19h.png` (19 h, orientation 2, zoom 1), pan à l'ombre entre **b\* -8 et -14**, L\* au moins 14; et le pan éclairé reste lisible comme la même ardoise.

## 2. Décor: place, berges, gué

### Place pavée et terre battue: oui, et c'est le gain le plus visible du tour

- Plus d'aplat gris: pavés en rangs décalés, anneaux autour du puits, terre battue mouchetée. Chaque zone pavée a sa raison écrite (eau renversée autour du puits, façade et comptoir de l'épicerie, chemin des seaux vers Odette, liaison vers la rue de la Gare), l'est reste en terre de foire. C'est exactement ce que la revue du tour 6 demandait.
- **Bord des pavés en escalier (moyen, `da-place-bords.png`, gauche)**: le bord suit les joints, pavé entier ou pas, ce qui est juste en principe; mais à 8 h 15 et au zoom 1 on lit un **contour en marches d'escalier** et une dizaine de **pavés isolés** dans la terre (au nord-est du puits): on croit à un pavage arraché, ou à un masque pixelisé. Un bourg finit un pavage par une **rangée de bordure**. Correction (dev rendu, `surfaces.ts`, 30 min): un rang de boutisses (pavés posés en travers, un ton plus foncé, joint plus large de 1 cm) le long du bord de chaque zone pavée, le bord tracé sur une courbe douce plutôt qu'en marches; au plus deux ou trois pavés isolés, seulement là où l'on passe (devant le comptoir, au départ du chemin des seaux).
- **Bord sud de la terre battue sans bordure (point soumis): je le garde sans bordure.** Une place de foire en terre rejoint un chemin de terre sans rien entre les deux; une bordure de pierre y serait fausse. Mais la ligne de raccord est **droite sur toute la longueur de la place** (`da-place-bords.png`, droite) et les deux terres ont presque la même valeur: on lit une limite tirée à la règle. Correction (dev rendu, 15 min, léger): onduler la limite de 0,2 à 0,3 m (même bruit que les berges) et laisser une frange d'herbe rase et de touffes de 0,3 à 0,6 m par endroits, là où personne ne marche (au pied des lampadaires, derrière le banc sud); même traitement pour le bord est contre le pré, aujourd'hui droit lui aussi.

### Berges courbes, galets, roseaux: oui

- Ligne d'eau courbe, anses et langues de sable, sable mouillé: les berges en damier du tour 6 ont disparu. Roseaux au fond des anses calmes de la rive nord, loin du gué et du ponton: au bon endroit et pour la bonne raison.
- Léger: les galets du bord de l'eau dessinent un **pointillé trop régulier** qui suit exactement la ligne d'eau (`gue-z0-o0`). Grouper les pierres par trois à six, laisser des vides de 0,5 à 1,5 m, en mettre davantage à l'aval des anses (là où le courant les dépose) (dev rendu, 15 min).
- Léger: chaque touffe de roseaux est un bouquet de traits isolés, sans pied; une base en touffe sombre (même maillage, quelques brins plus courts et plus foncés au pied) les planterait dans le sable mouillé (artiste-3d, 10 min).
- Le fond clair rectangulaire sous le ponton (relevé au tour 7) a disparu.

### Le gué: l'eau court, mais les pierres sont en grille (moyen, G9)

- L'eau vit enfin: écume, collerettes, traînées du courant vers l'aval, eau plus claire au-dessus du haut-fond. Les pierres crèvent la surface, aucune ne flotte.
- **Pierres presque en grille (point soumis), `da-gue-grille.png`**: une cinquantaine de prismes hexagonaux de même taille, en **quinconce régulier** sur sept ou huit rangs, très visible au zoom 0 comme en gris. On lit un dallage posé, pas un gué. Un gué, c'est un haut-fond de galets où l'on traverse **là où vont les chemins**: le chemin du poulailler arrive au nord, celui de la lisière repart au sud-ouest.
- Correction (dev rendu, `riviere.ts`, 30 min):
  1. une **ligne de passage** de 8 à 10 grandes pierres plates (0,45 à 0,6 m), espacées d'un pas (0,55 à 0,65 m d'axe en axe), légèrement sinueuse, qui relie le bout du chemin nord au départ du chemin sud;
  2. autour, 15 à 20 pierres plus petites (0,2 à 0,4 m), dispersées sans grille (tirage de Poisson avec rayon minimal, pas de jitter sur une grille), certaines à fleur d'eau, plus nombreuses à l'aval de la ligne (le courant les y pousse);
  3. rotation libre et tailles variées; garder 6 et 7 côtés pour casser la répétition;
  4. contrôle: zoom 0, orientations 0 et 1, en gris: plus aucun alignement de plus de trois pierres hors de la ligne de passage.

## 3. Saisons

- **Palettes et lumière: oui.** L'automne roussit chênes, bouleaux, noisetiers et buissons sans toucher aux sapins; l'hiver blanchit l'herbe par plaques et garde la lisibilité (place à 11 h, `hiver-place-11h`). Les journées raccourcissent, les soirées d'hiver s'allument plus tôt (`saisons-place.png`): le bourg vit à l'échelle de l'année.
- **Brume du matin**: voile clair au ras de l'eau, plus clair que les berges (nappe L\* 65 contre sable 49 à 57 à 7 h 15), aucune ligne droite. Juste.
- **Vigne de la tonnelle (moyen, G9, `da-vigne-saisons.png`)**: elle reste verte en automne et en hiver, alors qu'une vigne est caduque; pire, l'une de ses touffes (case `leaf_oak`, une sur trois dans `arbor` de `bourg.py`) roussit seule en automne, et en hiver devient une boule brune au milieu de touffes vertes. La raison: la vigne utilise la case `ivy` (le lierre, persistant à juste titre ailleurs) et la case `leaf_oak`. Correction (artiste-3d, 20 min): une case **`vine_leaf`** dans `palette.py` (printemps #5E8B45, été #577F3E, automne **#B8862F** avec quelques touffes `vine_leaf_dark` **#8E4A2E** pour le rouge de la vigne, hiver **#6E5A48** pour les dernières feuilles sèches), toutes les touffes de `arbor` sur ces deux cases, plus aucune sur `ivy` ni `leaf_oak`. Mieux encore en hiver si c'est bon marché: masquer les touffes de la vigne (`setSeason`, dev rendu) pour ne laisser que les sarments sur la pergola.
- Léger, après la bêta: en hiver, chênes et buissons gardent une boule de feuilles brunes. Pour le chêne c'est défendable (jeune chêne marcescent), pour les buissons moins; à revoir si l'on ajoute des modèles d'hiver.

## 4. Objets de cueillette, roncier, noisetier, souche, rejet, jeune sapin (G8)

Planches de l'équipe (`objets-4angles-*`, `objets-sol.png`, `objets-echelle.png`, `cueillette-*`) et mes captures au zoom 0 (`lisiere-z0-o0`, `roncier-z0-o1`).

| Modèle | Constat de près et au zoom de jeu | Gravité | Correction |
|---|---|---|---|
| `bramble` (roncier) | Quatre tiges arquées qui sortent de la masse et se terminent chacune par **une boule de feuilles suspendue à 15 ou 20 cm du sol**, plus une tige dressée devant. Au zoom 0, sous les deux orientations, la silhouette se lit comme **une araignée ou un scarabée vert sur pattes** (`da-roncier.png`). Une ronce fait l'inverse: ses tiges retombent et **piquent du bout dans le sol** (elles y marcottent), et leurs feuilles sont le long de la tige, pas en pompon | **bloquant** (G8: visible au zoom de jeu, sur chaque roncier de la lisière, et c'est un lieu de cueillette qu'on regarde) | artiste-3d, 25 min: chaque tige arquée **redescend jusqu'au sol** à 0,3 à 0,5 m de la masse (bout enfoncé de 2 cm, rien en l'air); remplacer la boule terminale par 3 ou 4 petites feuilles plates (losanges de 6 à 8 cm) réparties le long de la tige; deux tiges plus courtes peuvent se dresser au-dessus de la masse, sans boule; aucune tige devant la face +Z (celle des mûres). Contrôle: zoom 0, orientations 0 et 1, plus aucune lecture de pattes; vérifier que les `berry_spots` restent sur la masse |
| `oak_sapling` (rejet) | Les tiges partent **du milieu de la coupe**, sur le bois. Un chêne rejette de l'écorce, sur le pourtour et juste sous la coupe (c'est ce qui fait le taillis) | léger | artiste-3d, 10 min: pieds des tiges sur le flanc de la souche, 3 à 6 cm sous la coupe, qui s'écartent puis montent; la coupe reste nue (avec sa charnière, juste) |
| `tree_stump` (souche) | Coupe claire avec le reste de charnière, contreforts des racines: crédible, à bonne hauteur (environ 0,5 m), elle se lit à toutes les orientations | aucun | |
| `fir_sapling` (jeune sapin) | Sapin à trois étages sur une cuvette de terre fraîche: on lit « replanté », ce que disent la lettre et la réplique de Basile (le sapin ne rejette pas). La souche disparaît au même endroit | léger (G9, ci-dessous) | |
| `bush_hazel` (noisetier) | Cépée de quatre brins, houppier en boules du même style que les buissons; 2,3 m, à l'échelle d'un jeune noisetier | aucun | |
| `wild_garlic`, `chanterelle`, `blackberry`, `hazelnut` | Lisibles au zoom 1 par leur couleur (girolle orange sur l'herbe, tas de noisettes brunes sur sa feuille, ombelles blanches de l'ail); posés au sol, rien ne flotte (`objets-sol.png`). Mûres rouges (pas encore mûres) et noires mêlées: juste. Agrandis par rapport au réel (la grappe de girolles fait environ 25 cm), ce qui est voulu par la conception (lisible à 0,25 m) | aucun | |
| Fleurs des buissons (ancien) | toujours des cubes blancs vus de près (`cueillette-noisettes.png`) | léger (ancien) | artiste-3d, 15 min, voir tour 7 |

## 5. Brume de l'Aubrune, bancs du matin, martin-pêcheur (retouches du tour 7)

- **Brume de l'Aubrune** (`tour-07/ta-brume.png`): nappe L\* 71 contre berge 51 à l'attente (demandé: au moins 15 au-dessus), crème pêche à l'apogée, plus claire que tout le cadre en gris. Fait. Les bouffées sont plus larges et couchées; il reste un léger moutonnement au plus épais, acceptable.
- **Bancs du matin** (`ta-bancs-matin.png`): couchés à 0,3 m, fondus près du sol, plus aucune ligne droite, même niveaux resserrés. Fait.
- **Traînée et éclat du martin-pêcheur** (`ta-martin-pecheur-reel.png`): la traînée bleue se lit sans agrandissement au zoom 1 sur l'eau. Fait.

## 6. Interface: écran d'étape et carte de saison

- Mêmes cartes, mêmes encres, mêmes icônes que le reste du carnet; la carte « Premier jour de l'été » a son étoile à contour sombre (lisible sur crème), son filet vert à gauche et trois lignes concrètes. L'écran d'étape du jour 15 tient à 100 et 150 %, les deux joueurs gardent leur signe (astre, croissant) à côté du portrait. Rien à reprendre côté visuel.
- Léger (ux-ui-designer, 5 min): sur l'écran d'étape à 150 %, la ligne « samedi 8 : 4 sur 4 · » finit par son séparateur avant le retour à la ligne; poser le point médian en début de seconde ligne, ou une ligne par samedi sans séparateur.

## G6 visuel: « mieux qu'avant » ? Oui

1. **Les derniers sols provisoires disparaissent**: place pavée et terre battue, berges courbes, gué où l'eau court (le défaut ouvert depuis les tours 5 et 6).
2. **La lumière gagne en volume** (occlusion, lumière de bord, ombres froides) sans coût de rendu.
3. **Le monde change avec l'année** (palettes, durée du jour, brume du matin) et la lisière se renouvelle (souches, rejets, sapins replantés, cueillettes).
4. **Les trois retouches du tour 7 sont faites.**
5. Deux excès de la passe de rendu (place violette à 19 h, lauzes bleu roi à l'ombre du soir) sont réels mais localisés à la fin du jour; ils ne font pas tomber le « oui » et se corrigent par des réglages (section 1).

## G8: non

Un seul défaut bloquant: la silhouette du roncier. Les autres modèles du tour passent la liste 8.10 (rien qui flotte, rien qui traverse, échelle juste); le rejet a un défaut léger.

## G9: oui (deux réserves moyennes, non bloquantes)

| Élément | Au bon endroit, dans le bon sens, à la bonne taille ? Pourquoi ? | Verdict |
|---|---|---|
| Zones pavées de la place | anneau du puits (eau renversée), façade de l'épicerie, chemin des seaux, liaison vers la gare: là où l'on piétine en portant | oui (bord à finir, section 2) |
| Terre battue à l'est | sol de foire, sans bordure contre le chemin: juste | oui (limite à onduler) |
| Berges et roseaux | roseaux au fond des anses calmes de la rive nord, loin du courant du gué et du ponton | oui |
| Gué | au croisement des chemins du poulailler et de la lisière: bon endroit; mais les pierres en grille ne disent pas où l'on passe | réserve moyenne (section 2) |
| Ronciers | en lisière, entre la voie et le bois, face aux coins de cueillette (fruits côté soleil, au sud): là où poussent les ronces | oui |
| Noisetiers | au nord des coins de sous-bois, noisettes à leur pied (1,2 m, sous le bord du houppier) | oui |
| Girolles, ail des ours | au bord du bois, près des chênes et des noisetiers | oui |
| Rejet de chêne | sur la souche du chêne abattu | oui (pieds des tiges à déplacer, léger) |
| Jeune sapin | replanté par Basile, la lettre le dit; mais la souche disparaît en quatre jours pour laisser la place au plant. On ne dessouche pas pour replanter au même trou: on plante à côté | léger: garder la souche (`tree_stump`, mousse) et poser le jeune sapin à 0,35 m au sud dans la même case (dev rendu, `potager.ts`, 15 min); ou accepter, la cuvette de terre disant « replanté » |
| Vigne de la tonnelle | caduque, mais verte en automne et en hiver | réserve moyenne (section 3) |

## Défauts classés par gravité

| Gravité | Défaut | Correction | Qui | Effort |
|---|---|---|---|---|
| **Bloquant pour `main`** (G8) | Roncier lu comme une araignée (tiges terminées par des boules en l'air) | Section 4 | artiste-3d | 25 min |
| Moyen | Place violette à 19 h (saturation de l'étalonnage, teinte d'ombre trop saturée, vignettage mauve) | Variante A de `look` (section 1) | tech-artist | 10 min |
| Moyen | Pan de lauzes à l'ombre bleu roi le soir (b\* -25) | Part de teinte réduite sur les cases froides (section 1) | tech-artist | 30 min |
| Moyen (G9) | Pierres du gué en grille | Ligne de passage et dispersion (section 2) | dev rendu | 30 min |
| Moyen (G9) | Vigne verte en automne et en hiver, une touffe rousse seule | Case `vine_leaf` (section 3) | artiste-3d (dev rendu si masquage l'hiver) | 20 min |
| Moyen | Bord des pavés en escalier, pavés isolés | Rang de boutisses, bord en courbe (section 2) | dev rendu | 30 min |
| Léger | Limites droites de la terre battue (sud et est) | Ondulation et frange d'herbe (section 2) | dev rendu | 15 min |
| Léger | Galets en pointillé régulier le long de l'eau | Groupes et vides (section 2) | dev rendu | 15 min |
| Léger | Roseaux sans pied | Base en touffe (section 2) | artiste-3d | 10 min |
| Léger | Tiges du rejet au milieu de la coupe | Sur le flanc, sous la coupe (section 4) | artiste-3d | 10 min |
| Léger (G9) | Souche remplacée par le jeune sapin au même endroit | Souche gardée, plant à côté (section G9) | dev rendu | 15 min |
| Léger | Séparateur en fin de ligne sur l'écran d'étape (150 %) | Section 6 | ux-ui-designer | 5 min |
| Léger (ancien) | Fleurs des buissons en cubes blancs | Étoiles ou icosphères (tour 7) | artiste-3d | 15 min |
| Ouvert (tour 7) | Vignettes du carnet provisoires | Liste et consignes du tour 7, point 6 | artiste-2d | 4 h |

## Notes proposées

- **Pilier 2, vie du monde et animation: 8/10** (inchangé). Gains réels: l'année passe (saisons, jours plus longs ou plus courts, brume du matin), la lisière repousse, l'eau court au gué. Ce qui manque pour 8,5: une vigne et des arbres qui suivent vraiment la saison (vigne verte en hiver, un joueur le remarque), et les habitants n'ont rien gagné à l'écran ce tour.
- **Pilier 3, direction artistique: 8/10** (7,5 avant), **à confirmer après la reprise du roncier**. Plus aucun sol provisoire, lumière en volume, palette tenue par saison, lisible en gris à toutes les heures capturées. Ce qui manque pour 8,5: l'étalonnage du soir (violet, lauzes), le gué naturel, le bord des pavés et les vignettes définitives du carnet. Tant que le roncier n'est pas repris, je laisse 7,5.

## À tester chez le client

- Sur l'écran du PC (portable possible, dalle peu fidèle), la place à 19 h avec les réglages A: le mauve doit disparaître sans que les ombres deviennent brunes.
- Fluidité au gué et sur la rivière (lit en tronçons, texture du lit, eau qui lit la profondeur): non mesurable en rendu logiciel.
