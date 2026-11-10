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
