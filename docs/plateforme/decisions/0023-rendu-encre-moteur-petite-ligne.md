# ADR 0023: Rendu encré dans le moteur de La Petite Ligne: matériau partagé, contour par post-traitement, ambiances en données

| Champ | Valeur |
|---|---|
| Statut | proposée (première tranche livrée, en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | tech-artist |
| À relire par | architecte-technique (cible de rendu, budgets), directeur-artistique (écart à la bible 4.1), dev-gameplay-3d (tuiles, personnages), qa-testeur (parcours en rendu logiciel) |
| Jeu | `games/la-petite-ligne-2/src/rendu/encre/`; essai: `docs/jeux/jeu-1/refonte/essai-encre.md`; bible artistique 0.2 (section 4) |
| Liens | s'appuie sur l'ADR 0018 (un lieu actif, ressources par lieu), 0021 (personnages modulaires), 0022 (tuiles, budgets par tuile) |

## Contexte

Le client a validé le style « bande dessinée encrée » sur la scène d'essai (`src/rendu/demo-encre/`), mais le vrai jeu s'affichait encore dans l'ancien rendu en aplats (matériaux standard de Three.js, ombres de Three.js). Ses règles: éviter le plat absolu; la lisibilité avant la quantité d'encre; nuanceurs et ombres très soignés; un seul niveau de rendu pour le Mac et le PC (Intel UHD 620, 1366 x 768, 30 images par seconde au moins); caméra à 50 degrés qui s'abaisse au zoom serré; zoom de jeu de 18 m.

## Options

| | A. Matériau maison partagé et contour en post-traitement | B. Greffe sur les matériaux de Three.js et coque inversée (bible 4.1) |
|---|---|---|
| Contour | silhouettes, arêtes et joints, hiérarchisé selon la taille à l'écran | silhouettes seulement, le double de triangles |
| Couleur | valeurs d'écran, un ton du nuancier ressort tel qu'écrit | éclairage physique à contourner |
| Coût | une cible à deux sorties, une passe plein écran d'une vingtaine de lectures | aucun post-traitement |
| Preuve | scène d'essai, passes 1 à 3 | `encre-contours-compares.png` (passe 1): écartée |

## Décision

**Option A**, en production dans `src/rendu/encre/`.

1. **Un matériau encré partagé** (`InkMaterial`, `matiere.ts`): un seul nuanceur pour le sol, le décor fusionné, le semis instancié, les modèles livrés et les personnages (variantes `CHARACTER` et `ATLAS`). Rampe à trois tons francs, ombre teintée par l'ambiance, hachures ancrées au monde, relief par la carte de hauteur des couches de traits, zone « peau lisse » du visage. Il parle comme un matériau standard là où le moteur en a besoin (`color`, `opacity`, `transparent`, `emissive`, `clone()`): fondu des murs et des toits, houppiers effacés et lueur de la cible marchent sans changement.
2. **Attribut `aInk`** par sommet (couche de traits, code de pièce, nature, code de morceau; 6 bits de numéro et 2 bits de classe de taille). Il est posé à la fabrication par `GeometryBuilder` (tuiles, bâtiments), et par **conversion automatique** pour tout modèle livré (`conversion.ts`: morceaux d'un seul tenant, couche tirée de la teinte par des règles en configuration). Un nouvel objet de `assets/commun/` en profite sans code.
3. **Contour par post-traitement hiérarchisé** (`contour.ts`): cible à deux sorties (couleur; normale, morceau, pièce) et profondeur, puis une passe qui trace le trait. Cinq rangs; un rang n'est tracé que si ce qu'il cerne dépasse 12 à 28 points à l'écran. La même passe pose teinte dominante, vignette et fondus au noir. Écart assumé à la bible 4.1, à faire entériner par le directeur artistique.
4. **Ombres** (`ombres.ts`): carte du soleil de 2 048 cadrée sur la vue et calée sur ses texels; une carte de 512 en cône pour la lampe la plus proche du joueur local; ombre de contact sous les personnages. Les ombres de Three.js sont coupées en encre.
5. **Ambiances en données** (`ambiances.json`, schéma dans `ambiances.ts`): une fiche par identifiant d'ambiance du climat (`climat.json`), sinon `defaut`; cinq heures repères (aube, midi clair, fin d'après-midi dense, crépuscule, nuit) dehors et dedans, interpolées en continu avec l'heure du jeu; météo en facteurs; un lieu clos peut donner la teinte de ses lampes et du dehors (`ambience` de `lieu.json`). Flaques de lampes et rectangles de fenêtres viennent des bâtiments et des familles de modèles éclairantes.
6. **Bâtiments livrés** (`lieu/batiments.ts`): le manifeste `batiments.json` d'un lieu donne un modèle par bâtiment de la carte; fusionné en une géométrie au chargement (un appel), couche de traits d'après le nom du matériau, fenêtres du rez-de-chaussée pour les rectangles de lumière. Sans modèle, les volumes provisoires restent.
7. **Sol sans grille** (`sol.ts`): une texture d'un point par case (teinte, couche, sol posé par l'homme), lue en un point qui ondule; plancher des pièces et sols déclarés (`floor`) compris.
8. **Un seul niveau de rendu**: rien dans `encre/` ne lit les options graphiques. Deux garde-fous de fluidité, sans effet sur l'image: les programmes se compilent un par image à l'arrivée dans un lieu (au lieu d'un gel de plusieurs secondes), et le rendu saute des images s'il sature (rendu logiciel des tests).
9. **Interrupteur de transition**: `RenderOptions.style` et `?rendu=aplats` rendent l'ancien rendu; `encre` est le défaut (`INK_SETTINGS.style`).
10. **Caméra** du style encré: 50 degrés à 18 m et au-delà, 35 degrés à 6 m, zoom de jeu 18 m, bornes 6 à 28 m (28 m: budget de tuiles de l'ADR 0022; l'essai allait à 40 m).

## Budgets (par vue, toutes passes comprises)

| Poste | Budget | Mesuré au quai d'Aubrune, zoom de jeu |
|---|---|---|
| Triangles | 350 000 | 227 000 de jour, 220 000 de nuit (hôte et invité à 1 000 près) |
| Appels de dessin | 200 | 111 de jour, 105 de nuit |
| Programmes | 14 (technique 3.10) | 11 chez l'hôte, 12 chez l'invité |
| Mémoire ajoutée par l'encre | 64 Mo | 46 Mo (couches 23, ombres 17, cibles 12 à 1366 x 768 comptées à 12 octets par point) |

## Ce qui est abandonné de l'ancien rendu

- Matériaux standard, lumières physiques, tone mapping et brume de Three.js: inertes en encre (gardés pour `aplats`).
- Préréglages d'ombres et mode léger des options graphiques: sans effet en encre (un seul niveau).
- Eau à normales animées, lueur émissive des vitres, damier du sol des lieux d'essai, table de maquette: remplacés par leurs équivalents encrés.
- Rails tirés des arêtes `interieur` du graphe: corrigé (les voies du plan font foi).

## Conséquences

- Les personnages actuels (couleurs de sommets) passent au matériau encré; le remplacement par les corps de l'essai 4 (atlas, traits à la plume) reste à faire: la variante `ATLAS` est prête mais non branchée.
- Le relief du terrain, les dalles et les bâtiments en volumes de la scène d'essai ne sont pas dans cette tranche: voir « Portage » dans `essai-encre.md`.
- Tant que l'interrupteur existe, tout nouveau maillage du moteur doit écrire les deux sorties (matériau encré, contact, aplat): un matériau standard dans la cible à deux sorties laisse une image de contour indéfinie.

## À vérifier

- Images par seconde et temps de compilation des programmes sur l'UHD 620 (non mesurables ici: rendu logiciel).
- Lectures de texture par point: sol 9 à 16, volumes 8 à 15, contour une vingtaine; versions économes listées dans `essai-encre.md`.
