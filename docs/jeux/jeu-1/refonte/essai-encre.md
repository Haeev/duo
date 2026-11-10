# Essai du rendu « bande dessinée encrée »

Tech-artist, 2026-11-10, passe 3. Page d'essai: `games/la-petite-ligne-2/src/rendu/demo-encre/` (`pnpm dev`, puis `/src/rendu/demo-encre/index.html`; touches et paramètres en tête de `main.ts`). Captures: `captures/encre-*.png`, toutes sorties du vrai rendu Three.js à 1366 x 768, sans retouche, temps figé (`joue=0&t=3`). Outils: `captures/outils-encre/`. Rien n'est branché au jeu.

## Les règles du client, appliquées partout

1. **Éviter le plat absolu.** Le relief vient de la géométrie d'abord, du nuanceur ensuite. Depuis la passe 3 le sol lui-même est un terrain.
2. **La lisibilité passe avant la quantité d'encre.** Trait hiérarchisé selon la taille à l'écran; les aplats font la lecture, le noir cerne et pose l'ombre.
3. **Volume ou texture.** Ce qui borde, ponctue ou dépasse du sol est un vrai petit volume; la texture ne garde que le dessin à plat.
4. **Un seul niveau de rendu** pour le Mac et le PC (UHD 620, 1366 x 768, plancher de 30 images par seconde): aucun réglage de qualité, les effets ont un coût fixe et borné.
5. **Caméra**: 50 degrés de plongée au zoom de jeu (18 m de large) et au-delà; en zoomant plus près elle s'abaisse jusqu'à 35 degrés à 6 m (les visages se voient). Libre de tourner et de zoomer (6 à 40 m).

## Ce que montre la scène

- Dehors: le coin de la halte d'Aubrune tiré du plan (origine au point 146; 94): voie, quai de 30 x 4 m et ses marches de bout, traversée de service, fossé, barrière, maison de Firmin, halte, pendule arrêtée sur 5 h 12, réverbère, chemin de terre. Cinq personnages animés: Gaston assis sur le banc, Odette qui parle à la joueuse (Maëlle) sur le sentier, Lou qui va et vient sur le chemin, Basile qui attend sur le quai.
- Dedans: la pièce de la même maison (murs effacés côté caméra), et autour d'elle son jardin: soubassement de moellons, pierre de seuil, allée, banc, tonneau sous la gouttière, tas de bois, barrière, pommiers, haie.
- Ambiances: dehors jour, jour « dense », crépuscule, nuit, aube; dedans jour, jour « dense », nuit.
- Écarts au plan, voulus: seconde porte de la halte à l'ouest, de plain-pied sur le quai; banc de Gaston contre sa façade; fossé entre le ballast et la barrière (il draine la voie), comblé sous la traversée.

## Passe 3: ce qui a changé

| Sujet             | Avant                                                         | Maintenant                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Personnages       | corps de l'essai 3 figés en géométrie                         | les 5 corps de l'essai 4 avec leur squelette: clips `marche` et `repos` joués, gestes posés par-dessus à chaque image (s'asseoir, parler, regarder, respirer), marche qui suit le relief; atlas de traits à la plume (grille de `traits.json`, `traits-<id>.png`); un appel de dessin par personnage (corps, tête, coiffure et col fondus, coiffure et col liés à un os) |
| Nuanceur          | variante à part, greffe sur `MeshToonMaterial` dans l'essai 4 | un seul `ShaderMaterial` de volumes pour décor, semis, végétation et personnages (variante `ATLAS`, squelette par les morceaux `skinning_*` de Three.js); le sol partage la même lumière                                                                                                                                                                                 |
| Visage            | taches d'ombre                                                | masque du visage: ton clair garanti, ombre à deux tons sans relief ni hachure, aucune arête intérieure (numéro de morceau « peau lisse »), traits épaissis d'un demi-point d'écran                                                                                                                                                                                       |
| Végétation        | polyèdres                                                     | touffes en festons: calotte bombée, bord découpé en dents inégales, feuilles détachées, normales qui rayonnent du coeur (l'ombre dessine une masse), bord d'ombre dentelé, noir plein dessous, vent dans le nuanceur de sommets (et dans la passe d'ombre); 3 arbres (chêne, bouleau, pommier) et 2 buissons (noisetier, églantier), un appel instancié par essence      |
| Sol               | un plan                                                       | terrain: bosses du pré, chemin creusé de 7 cm avec talus, ornières, fossé de 30 cm, terre remontée au dos du quai, sol relevé de 5 cm contre les murs (leur pied s'enfonce) et herbe haute à leur pied; les tons de l'herbe suivent la pente vraie; de près, lit de gravillons en relief                                                                                 |
| Pierres et fleurs | boîtes biseautées, pastilles                                  | galets cabossés de quatre gabarits (rond, plat, dressé, moussu), étirés un par un, à demi enterrés; coquelicots à quatre pétales en coupe, marguerites en étoile                                                                                                                                                                                                         |
| Lumière           | flaques sans ombre                                            | ombre portée par la lampe la plus proche du joueur (une carte de 512 en cône, une seule à la fois); rectangle de lumière des fenêtres sur le sol dehors, croisillon compris (calcul direct); brume au sol en deux voiles à bord net (crépuscule, nuit, aube); lucioles ou poussière (un appel instancié); reflet du ciel en bandes sur les vitres de jour                |
| Intérieur         | pré vide autour, peu d'objets                                 | jardin autour de la pièce; plinthe moulurée, chambranles à corniche, tablettes d'appui; horloge comtoise, malle, chevet, chat, bottes, balai, bouilloire, panier, sac, herbes pendues                                                                                                                                                                                    |

## Choix faits, sur preuve

| Question             | Retenu                                                                                 | Pourquoi                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Contour              | Post-traitement sur numéros d'objet et de morceau, normales et profondeur, hiérarchisé | `encre-contours-compares.png` (passe 1): la coque inversée ne cerne que la silhouette; la coque comparée a été retirée du code à la passe 3   |
| Trait irrégulier     | Épaisseur de 55 à 145 % et tremblé d'un demi-trait, bruit ancré au monde               | `encre-stabilite.png`: six images d'une rotation de 25 degrés pendant que Lou marche; hachures, bord d'ombre et trait restent attachés au sol |
| Ombrage              | 3 tons francs multipliés à l'aplat; l'ombre est une couleur de l'ambiance              | prune le jour dense et le soir, bleu la nuit                                                                                                  |
| Ombre portée         | Aplat net teinté avec hachures lâches                                                  | `encre-ombres-comparees.png` (passe 1)                                                                                                        |
| Ombre de lampe       | Une seule carte en cône, lampe la plus proche du joueur                                | `encre-interieur-nuit.png` (chaises, table, personnages), `encre-exterieur-jeu-nuit.png` (Gaston et son banc)                                 |
| Lumière des fenêtres | Calcul direct par fenêtre (8 au plus, les plus proches du point visé)                  | ni texture ni passe; `encre-chemin-rasant.png`, `encre-exterieur-jeu-nuit.png`                                                                |
| Feuillage            | Géométrie instanciée, pas de carte découpée                                            | le contour par numéros le cerne sans surcoût; pas de tri ni de transparence                                                                   |
| Couleur              | Tout en valeurs d'écran, sans éclairage physique                                       | un ton du nuancier ressort tel qu'écrit                                                                                                       |

Avis contraire à la bible 0.2 (section 4.1), toujours à arbitrer: elle écarte le post-traitement pour son coût (une passe plein écran de 22 lectures par pixel).

## Hiérarchie du trait (lisibilité)

- Chaque objet et chaque morceau reçoit à la fabrication une classe de taille mesurée sur sa boîte. Cinq rangs de trait; un rang est tracé quand ce qu'il cerne dépasse 12 à 28 points à l'écran (`rankWeights`). Seuls les deux premiers rangs sont épais.
- Le détail suit la même règle (`SETTINGS` de `main.ts`): trait peint des textures de 45 à 85 points par mètre, hachures et gravillons de 80 à 150, traits du visage de 34 à 80; les niveaux de loin des atlas de personnages sont des aplats.
- Personnages: un seul contour, teintes poussées de 18 %, ombre relevée, liseré clair côté soleil, tache de contact qui les suit.

## Nuanceurs et ombres

- **Volumes** (`OBJECT_*`, `matiere.ts`): aplat de la pièce, second ton et trait de la couche de texture, relief, lumière encrée, vitres, flammes, feuillage, vent. Variante `ATLAS` (personnages): atlas, hauteur dans l'alpha (normale penchée et sommets poussés), traits du visage, hachures ancrées au personnage et de près seulement.
- **Sol** (`GROUND_*`): matières par carte seuillée, bord cerné, touffes, pente du terrain lue dans la même carte (canaux B et A).
- **Lumière encrée** (`LIGHTING`): trois tons, ombre du soleil (5 lectures), flaques de lampe, ombre de la lampe locale (5 lectures), fenêtres, hachures projetées sur le monde, noirs pleins, pied encré, brume.
- **Ombre de contact**, **particules** (`effets.ts`), **encrage** (`contours.ts`).
- Réglages par lieu et par ambiance en données (`ambiances.ts`, type `Ambiance`).

## Gabarits: ajouter sans coder

- **Petit décor semé** (`semis.ts`): une forme dans `SHAPES`, une ligne dans `RULES` (nature de sol: herbe, terre, bord, ballast, fossé, pied de mur).
- **Essence** (`vegetation.ts`): une fonction dans `SPECIES` (tronc, branches, touffes par `tuft`), puis des emplacements `PlantSpot`.
- **Relief d'un lieu** (`terrain.ts`): une fiche `TerrainSpec` (bosses, emprises à niveau, creux des chemins, ornières, fossés).
- **Personnage** (`acteurs.ts`): une ligne `ActorSpec` (fiche de l'essai 4, expression par son nom, rôle, trajet); les fichiers sont pris par leur nom.
- **Bâtiment** (`BuildingSpec`), **ambiance** (`Ambiance`), **objet** (une fonction autour de son pied, posée par une matrice).

## Mesures

| Vue                                     | Appels | Triangles (toutes passes) | Programmes |
| --------------------------------------- | ------ | ------------------------- | ---------- |
| Dehors, jour                            | 45     | 302 738                   | 10         |
| Dehors, nuit (ombre de lampe, lucioles) | 51     | 338 463                   | 10         |
| Dedans, jardin compris                  | 55     | 136 612                   | 10         |

- Budget de la bible: 350 000 triangles, 200 appels, 4 programmes. Triangles tenus de peu la nuit, appels tenus, programmes dépassés.
- Une passe de couleur dehors: 180 000 triangles environ, dont terrain 34 800, décor bâti 22 720, semis 80 000, végétation 33 000, personnages 13 000 (2 600 chacun). La passe d'ombre du soleil redessine tout sauf fleurs et cailloux; celle de la lampe seulement le bâti et les personnages (35 700).
- Programmes: volumes (simple, instancié, personnage), sol, contact, profondeur (simple, instanciée, à squelette), particules, encrage. Pour revenir vers 6: tout instancier (une seule variante de volumes et de profondeur).
- Textures (61 Mo environ): 13 couches de trait de 512 (18 Mo avec mipmaps), ombre du soleil 2 048 (16 Mo), cibles de rendu (12,6 Mo), 5 atlas de personnages (7 Mo), 5 atlas de traits de 512 x 384 (5,2 Mo), carte du sol 720 x 560 (1,6 Mo), ombre de lampe 512 (1 Mo).
- Lectures de texture par pixel: volumes 9 le jour et 16 la nuit (5 pour l'ombre de lampe, 2 pour la brume, sautées quand elles sont éteintes), sol 17 le jour et 24 la nuit, encrage 22.
- Temps par image sous Chromium logiciel, machine chargée (charge 13): 0,6 à 2,6 s, inutilisable pour classer les réglages. Rien ici ne dit le temps sur le GPU.
- Estimation UHD 620 (non mesurée): 1,05 million de pixels; le sol (17 à 24 lectures) et l'encrage (22) sont les deux postes lourds. Ordre de grandeur attendu 11 à 18 ms: au-dessus de 30 images par seconde, sans marge pour 60.

Versions économes prêtes ou à une ligne, si la mesure sur le PC déçoit:

| Effet                | Version économe                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ombre de lampe       | une lecture au lieu de cinq (bord un peu crénelé); carte rendue une image sur deux; coupée de jour (déjà le cas) |
| Lumière des fenêtres | 4 fenêtres au lieu de 8; ou cuite dans la carte du sol par lieu                                                  |
| Encrage              | 4 directions au lieu de 8 (11 lectures)                                                                          |
| Sol                  | une seule couche de touffes, gravillons coupés (2 lectures de moins)                                             |
| Ombre du soleil      | carte de 1 024, 3 lectures                                                                                       |
| Semis                | densités divisées par deux hors du rayon de 15 m autour du joueur                                                |

## Ce qu'il faudra porter dans le moteur (matière pour un ADR)

1. **Deux sorties de rendu et une passe d'encrage**: cible à deux textures (couleur; normale, morceau, pièce) plus profondeur. À décider: accepter le post-traitement malgré la bible 4.1.
2. **Numéros et classes de taille à la fabrication**: tout maillage du jeu doit porter `aMeta` (couche, pièce, nature, morceau) et `aFoot`. À faire dans la chaîne d'assets (glTF: attributs personnalisés `_META`, `_FOOT`), pas à l'exécution.
3. **Un nuanceur de volumes unique** avec ses variantes (instancié, squelette, atlas): les personnages du catalogue doivent arriver en un seul maillage par personnage, coiffure et accessoires liés à un os.
4. **Terrain en données**: `TerrainSpec` par lieu, tiré du plan; la simulation doit lire la même hauteur que le rendu (marche, pose des objets). La fonction de hauteur est pure et sans Three.js: elle peut vivre côté simulation.
5. **Ambiances en données** (`Ambiance`), interpolées dans le temps (non fait ici: on passe d'une fiche à l'autre d'un coup).
6. **Ombres**: carte du soleil cadrée sur la vue et calée sur ses texels; une carte de lampe pour la lampe la plus proche du joueur local (chaque machine choisit la sienne: rien à synchroniser).
7. **Gabarits de contenu**: semis (`RULES`), essences (`SPECIES`), bâtiments (`BuildingSpec`), acteurs (`ActorSpec`), à brancher sur les schémas validés du paquet.
8. **Caméra**: plongée fonction du zoom (50 à 35 degrés).
9. **Mesure sur l'UHD 620** avant tout: c'est elle qui choisit entre la version pleine et les versions économes; elle fixe aussi le budget de programmes.
10. **Gestes par-dessus les clips**: le mélangeur d'animation ne réécrit pas un os dont la valeur ne change pas; tout geste posé à la main doit remettre l'os à la pose du clip avant de s'appliquer.

## Notes franches, capture par capture (contre les références du client)

| Capture                                                 | Note | Pourquoi                                                                                                                |
| ------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `encre-exterieur-jeu-nuit`                              | 9    | fenêtres qui jettent leur croisillon, ombre de Gaston sous la lanterne, brume, lucioles, noirs pleins: dense et lisible |
| `encre-exterieur-nuit` (large)                          | 9    | trois foyers de lumière, masses d'arbres découpées                                                                      |
| `encre-interieur-nuit`                                  | 9    | ombres de la lampe à pétrole qui rayonnent, jardin dans la nuit                                                         |
| `encre-relief-mur`                                      | 9    | pierre à pierre, pied de mur dans l'herbe, gravillons                                                                   |
| `encre-exterieur-jeu-jour-dense`                        | 8,5  | lisible et dense; les feuillages restent des festons anguleux (« artichaut »)                                           |
| `encre-exterieur-jour-dense` (large)                    | 8,5  | même réserve sur les houppiers vus de haut, tous de même famille                                                        |
| `encre-interieur-jour-dense`, `encre-interieur-proche`  | 8,5  | pièce habitée, visages lisibles à 35 degrés; le chat se lit mal                                                         |
| `encre-exterieur-jeu-crepuscule`, `encre-chemin-rasant` | 8,5  | relief du chemin net en lumière rasante; beaucoup de hachures au sol                                                    |
| `encre-exterieur-proche`                                | 8    | visages visibles et traits lisibles, matière au sol; têtes de l'essai 4 encore sommaires, mains raides                  |
| `encre-exterieur-jeu-jour`, `encre-exterieur-jour`      | 8    | propre mais sage: le jour clair reste moins proche des références                                                       |
| `encre-exterieur-jeu-aube`                              | 7,5  | la brume en plaques pâles fait « camouflage »; tout le lieu est dans l'ombre du soleil bas                              |

## Ce qui bloque sous 9

1. **Feuillage**: la géométrie en festons a des facettes de 30 à 60 cm; les références ont des masses peintes à la main. Pour passer 9: des touffes modelées dans Blender (silhouette dessinée, 3 ou 4 variantes par essence), même nuanceur.
2. **Têtes et mains**: modelé de l'essai 4 en cours de reprise par un autre membre; le chargement prendra les nouveaux GLB sous le même nom. Les coiffures « tignasse » (Basile, Lou) couvrent le visage vu de haut: à retailler dans leur fiche.
3. **Jour clair**: par nature moins dense; le client tranchera entre jour clair et jour dense.
4. **Trait de machine**: épaisseur variable mais ni pleins ni déliés selon la courbure.
5. **Aube**: la brume demande des nappes en volume (cartes posées au sol) plutôt qu'un voile dans le nuanceur.
6. **Clip de repos**: une seule pose dans les fichiers actuels; la vie vient des gestes posés par code.

## Portage dans le vrai jeu (tranche 1, 2026-11-10, ADR 0023)

Module `games/la-petite-ligne-2/src/rendu/encre/` (README sur place). Le style encré est le rendu par défaut du jeu; `?rendu=aplats` rend l'ancien. Captures du vrai jeu au banc à deux vues, 1366 x 768, sans retouche: `captures/jeu-encre-*.png`; montages côte à côte avec les références de l'essai: `captures/jeu-encre-compare-*.png`.

### Ce qui est porté

| De la liste « à porter » | État |
| --- | --- |
| 1. Deux sorties et passe d'encrage | fait (`contour.ts`), trait de l'essai (1,55 point, épaissi au zoom serré) |
| 2. Numéros et classes de taille | fait à la fabrication des tuiles (`GeometryBuilder`) et par conversion automatique des modèles (`conversion.ts`); pas dans les GLB eux-mêmes |
| 3. Nuanceur de volumes unique | fait (`InkMaterial`): sol, décor, semis, modèles, personnages actuels; variante atlas prête, non branchée |
| 4. Terrain en données | non fait: le sol du jeu est plat (voir plus bas) |
| 5. Ambiances en données, interpolées | fait (`ambiances.json`): aube, midi clair, fin d'après-midi dense, crépuscule, nuit; dedans; météo; lieu clos |
| 6. Ombres | fait: soleil cadré sur la vue, lampe la plus proche du joueur local, contact |
| 7. Gabarits de contenu | ambiances, lampes par famille de modèle, matériaux de bâtiment par nom, semis par surface: en données; essences et bâtiments de l'essai non repris |
| 8. Caméra | fait: 50 degrés à 18 m et plus, 35 degrés à 6 m, zoom de jeu 18 m |
| 9. Mesure sur l'UHD 620 | non faite (rendu logiciel ici) |
| 10. Gestes par-dessus les clips | appliqué à la pose assise (`personnages/assise.ts`) |

En plus: sol sans grille (carte du sol lue en un point qui ondule, bords droits pour les sols posés par l'homme), plancher et murs coupés des pièces, bâtiments livrés d'Aubrune posés à leur place avec leurs fenêtres éclairées, semis de cailloux et de touffes en volumes, sols déclarés des petits lieux, ambiance du wagon lue dans `lieu.json`, pose assise par cinématique inverse.

### Mesures (zoom de jeu, toutes passes)

| Vue | Appels | Triangles | Programmes |
| --- | --- | --- | --- |
| Quai d'Aubrune, 17 h, hôte | 111 | 227 324 | 11 |
| Quai d'Aubrune, 17 h, invité | 113 | 228 268 | 12 |
| Quai d'Aubrune, 22 h, hôte | 105 | 220 046 | 11 |
| Quai d'Aubrune, 22 h, invité | 104 | 220 336 | 12 |
| La halte, 17 h | 115 | 247 369 | 11 |
| Gare d'essai | 44 | 60 723 | 9 |
| Wagon du train de nuit | 93 | 59 233 | 10 |
| Trajet en train | 21 | 53 869 | 10 |

Budgets (350 000 triangles, 200 appels, 14 programmes): tenus partout. Mémoire ajoutée par l'encre: 46 Mo (budget 64). Aller et retour gare, halte, gare, deux fois: textures 17, 15, 17, 17 et programmes 10, 10, 10 (reviennent à l'identique); géométries 38, 34, 34, 36 (elles comptent aussi les personnages présents selon l'heure: pas de croissance, mais pas une preuve nette).

### Notes franches, vue par vue (contre les références validées)

| Capture | Note | Écarts avec l'essai, un par un |
| --- | --- | --- |
| `jeu-encre-halte-nuit` | 7,5 | fenêtres éclairées et croisillons au sol, ombres de lune, lucioles: le langage de l'étalon y est; manquent la lanterne et sa flaque sur la façade, les masses de feuillage, la clôture, le chemin de terre caillouteux en relief; personnages de l'ancien catalogue |
| `jeu-encre-halte-jour` | 7,5 | pierre à pierre, volets, vitres, toits de tuile, ombres prune hachurées; sol dallé dessiné à plat (l'essai posait ses dalles en volume), aucun relief de terrain, pas d'arbres en festons |
| `jeu-encre-quai-jour-hote`, `-invite` | 6,5 | trait, tons, ombres, ballast en cailloux; quai nu: dalles à plat, pas de bordure en marche travaillée, pas de mobilier de quai ni de végétation |
| `jeu-encre-quai-nuit-hote`, `-invite` | 6 | nuit lisible, brume, lucioles; aucune lampe sur le quai dans les données: pas de foyer de lumière |
| `jeu-encre-place-bourg`, `-nuit` | 6,5 | pompe, banc, chemin au bord sinueux, semis; un bâtiment entre la caméra et le joueur s'efface en entier et ne laisse que son ombre |
| `jeu-encre-interieur` | 6,5 | plancher lame par lame, murs coupés avec épaisseur et soubassement, meubles encrés; pas de fenêtres ni de soleil qui entre, pas de jardin autour (les pièces sont hors de la carte), peu d'objets posés |
| `jeu-encre-wagon` | 7 | lampes chaudes, plancher et tapis encrés, parois coupées; les deux joueurs ne sont pas assis sur la capture (« place prise » dans cette sauvegarde) |
| `jeu-encre-trajet` | 6,5 | train et diorama encrés, ombres hachurées; herbe des collines étirée, formes provisoires |
| `jeu-encre-gare-essai` | 6 | lieu d'essai en formes provisoires: le style s'applique, le contenu reste un prototype |
| `jeu-encre-assis` | 8 | bassin sur l'assise, cuisses à l'horizontale, genoux au bord, pieds à plat, dos au dossier, entre les accoudoirs; deux gabarits seulement (ceux du catalogue actuel) |

Seuil de 9 non atteint. Ce qui sépare encore le vrai jeu de l'essai n'est plus le nuanceur mais la géométrie et les personnages.

### Ce qui reste, par ordre d'effet à l'écran

1. **Relief du terrain et dalles en volume** (règle « éviter le plat absolu »): le sol du jeu est un plan; chemin creusé, talus, fossé, dalles désaffleurées demandent une hauteur de terrain partagée avec la simulation (point 4 de la liste) et les générateurs de l'essai (`terrain.ts`, `decor.ts`) branchés sur le plan.
2. **Végétation en festons**: les arbres du jeu sont des modèles et des boules; reprendre `vegetation.ts` (essences en données) pour les arbres semés par tuile.
3. **Personnages de l'essai 4**: corps riggés, tenues en fiches, atlas de traits; la variante `ATLAS` du matériau les attend. Les personnages actuels sont encrés (aplats, ombre relevée, hachures de près, contour) mais restent d'un modelé lisse d'un autre style.
4. **Lampes et mobilier du quai, clôtures, cailloux de chemin modelés**: contenu à poser dans les données du lieu.
5. **Effacement des bâtiments livrés**: aujourd'hui le bâtiment entier s'efface; il faut couper le toit et garder les murs (deux plages d'index par bâtiment).
6. **Fenêtres et soleil dans les pièces**, jardin visible autour: les pièces vivent hors de la carte.
7. **Mesure sur l'UHD 620**: images par seconde et temps de compilation des programmes à l'arrivée dans un lieu.

## Optimisation et couleurs (2026-11-10, après le premier essai du client sur ses deux machines)

Retour du client: « le style graphique est magnifique », « la version PC rame légèrement », « les couleurs sont plus fades sur la version PC que sur la version Mac ». Décisions et comptages: ADR 0023, points 11 à 14. Ici, ce qui se voit et ce qui se mesure.

### Ce qui change à l'écran: rien, sauf la finesse

- `encre-perf-avant-apres.jpg`: quai de jour, quai de nuit, wagon, avant et après, avec deux détails agrandis deux fois. Regardé de près: même trait, mêmes tons, mêmes ombres, mêmes hachures (les personnages ont bougé entre les deux prises, l'heure du jeu aussi de quelques minutes).
- `encre-perf-echelles.png`: la même vue à 100, 90, 80 et 70 % d'échelle interne, détails agrandis trois fois. La composition est la même (mêmes traits, mêmes hachures, même épaisseur); à 70 % le trait fin s'adoucit et les joints des dalles perdent du piqué. C'est le pire cas, et il ne sert que si la machine passe sous 30 images par seconde.
- `encre-perf-ecran-dense.png`: une piste essayée et écartée. Sur un écran dense (fenêtre de 1 440 x 900 points, tampon de 1 821 x 1 138), les seuils de détail se comptent en points du tampon: le Mac trace un rang de trait fin de plus que le PC. Les compter en points d'un écran de référence (colonne de droite) ne rapproche pas les deux images, au contraire: le trait peint des dalles, plus fin sur l'écran dense, pâlit. L'ancien comptage (colonne du milieu) donne l'image la plus proche de celle du PC: il est gardé (`sameOnEveryScreen` à `false`).

### Couleurs d'un écran à l'autre

Cherché côté jeu d'abord, point par point:

| Point | Constat |
| --- | --- |
| Espace de couleur du canevas | sRGB déclaré sur les deux machines (`drawingBufferColorSpace`, posé par Three.js avec `outputColorSpace`); pas de P3 implicite sur le Mac |
| Conversion linéaire vers sRGB | faite une fois, par sommet, dans le matériau encré; ni la cible intermédiaire ni la passe de contour ne reconvertissent |
| Tampon intermédiaire | 8 bits par canal, en valeurs d'écran: même précision que le canevas, aucune perte de saturation; pas de bandes visibles sur les aplats du style |
| Mappage tonal | celui de Three.js ne s'applique pas à un `ShaderMaterial` sans son inclusion: aucun |
| Alpha et prémultiplié | le canevas a un canal alpha (Three.js le demande toujours), écrit à 1 partout: aucun mélange avec la page |
| Mire de l'outil de mesure | cinq tons connus passés par la chaîne du jeu et relus dans le canevas: écart 0 sur 255 ici; à confirmer sur les deux machines par le relevé |
| Défaut trouvé | la couleur de fond était convertie en linéaire (plus sombre que la donnée), sur toutes les machines; corrigée, presque jamais visible (le sol la couvre) |
| Différence d'image venue du jeu | aucune qui se voie: les seuils de détail en points du tampon donnent des images très proches sur un écran dense et sur le PC (voir plus haut) |

À données égales, le jeu envoie donc les mêmes valeurs sRGB aux deux écrans. Ce qui reste leur appartient:

- **L'écran du Mac** couvre plus que sRGB (P3), il est étalonné, lumineux (400 à 500 nits) et contrasté; macOS convertit le sRGB du jeu vers la dalle: les couleurs sortent justes.
- **Un écran de portable d'entrée de gamme** couvre souvent 60 % de sRGB (dalle dite « 45 % NTSC »), 250 nits, contraste de 700 pour 1: les rouges et les verts vifs n'existent pas sur la dalle, les noirs sont gris. Tout y est plus fade, pas seulement le jeu. Le jeu ne peut pas le compenser sans fausser le Mac: une couleur hors de la gamme de la dalle ne s'obtient pas en poussant les nombres.
- **Ce qui se règle sur le PC**, à vérifier avant de conclure: HDR de Windows activé (le contenu ordinaire y paraît délavé; le relevé dit « plage dynamique haute »), éclairage nocturne, économiseur de batterie, « économie d'énergie de l'écran » et « amélioration des couleurs » du pilote Intel, profil de couleur de l'écran.
- **Essai simple pour trancher**: regarder sur les deux écrans, côte à côte, l'accueil de Duo (hors du jeu) et une même photo. S'ils sont plus fades sur le PC eux aussi, c'est l'écran.

### Proposition, non appliquée: un peu plus de saturation et de contraste

`encre-perf-proposition-couleurs.jpg`: les deux références validées et deux vues du jeu, telles quelles et avec saturation x 1,08 et contraste x 1,04 (`INK_SETTINGS.grade`, aujourd'hui à 1 et 1). L'effet est le même sur les deux machines: il rend un peu de tenue à une dalle terne sans déborder sur le Mac, où les tons restent dans la gamme sRGB. Risque: les nuits, déjà denses, se bouchent un peu dans les ombres (contraste), et les ocres du quai chauffent. Avis du technical artist: essayer 1,08 et 1,00 d'abord (saturation seule). Décision au directeur artistique.

### Ce que le client doit relever (outil de mesure, `F9`)

1. Sur le PC puis sur le Mac, dans Duo en plein écran: aller au quai d'Aubrune vers 17 h au jeu, ouvrir l'outil (`F9`, ou `Ctrl` + `Maj` + `M`), marcher une minute le long du quai, puis « Copier le relevé » et le coller.
2. Au même endroit, bouton « Échelle » une fois (figée à 100 %), une minute de marche, « Copier le relevé ». Remettre ensuite l'échelle en adaptative (bouton jusqu'à « adaptative »).
3. Au quai de nuit (après 21 h au jeu), une minute, relevé.
4. Dans un intérieur (une maison, ou le wagon du train de nuit), une minute, relevé.
5. Sur le PC seulement: la définition de l'écran et l'échelle d'affichage de Windows (Paramètres, Système, Écran), et si « HDR » y est activé.
