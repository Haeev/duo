# Cosy Café: essai de style 3D du café du village

Essai demandé par le client (« stylisé chaleureux et semi-réaliste: fais-moi un essai 3D pour avoir une idée de ce que ça va rendre »). Une scène Three.js 0.187, pas un niveau jouable. Deux variantes ont été faites; **le client a choisi la variante B (semi-réaliste) le 2026-11-07**. La variante A est arrêtée: ses fichiers restent pour mémoire, sans les dernières retouches.

## Ce qu'on voit

Le café de la place du Tilleul à Ormeval, état « arrivée » du plan `plans/plans.json` (`village-arrivee`, salle et comptoir de 7,00 x 5,40 m, plafond à 2,80 m), en fin d'après-midi (soleil doré à 16 degrés, moment signature de la bible).

| Vue | Capture (B) | Contenu |
|---|---|---|
| 1. Derrière le comptoir, vers la salle et la place | `captures/B-vue1-1366x768.png`, `captures/B-vue1-1920x1080.png` | passe et vaisselle sur le noyer, rail à tickets écrits (pinces des deux joueurs, ticket qui attend au bandeau ambre et sablier), taches de soleil sur les murs, le partenaire de dos avec un plateau, client qui lit la carte, place pavée, maisons à volets, tilleul, passant |
| 2. Depuis l'entrée, vers le comptoir | `captures/B-vue2-1366x768.png` | comptoir sauge à deux niveaux, ombres des petits bois sur sa face, ardoise du jour, la partenaire de face derrière la caisse, cliente qui paie, cloche à viennoiseries, livre d'or |
| 3. À hauteur de main, la machine et la tasse | `captures/B-vue3-1366x768.png` | machine à deux groupes en cuivre et laiton (têtes chromées, porte-filtres à poignée noire, buse vapeur, manomètre), tasse sous le groupe, passe, cliente qui attend |

Planche des deux variantes (avant le choix du client): `planche-comparative.png`. Contrôle en gris de la vue 1: `captures/B-vue1-gris.png`.

### Les personnages

Cinq personnages Meshy (image vers 3D en topologie intelligente, environ 5 200 triangles, riggés par Meshy, 24 os aux mêmes noms): un flâneur qui lit la carte, une cliente qui attend sa commande, une cliente pressée à la caisse, et les deux avatars. Les poses viennent des clips déjà achetés par le tech-artist sur son client pressé (`idle`, `sit`, `drink`): un clip sert à tous, aucun n'a été racheté. Le passant de la place est ce client pressé du tech-artist (clip de marche).

Les avatars portent la tenue de travail de la maison (chemise, tablier vert bouteille), sans couleur vive: le seul signe du joueur est un **badge rond de 3 cm** à sa couleur sur la bavette; les pinces du rail à tickets gardent la couleur et le symbole du joueur (demande du client, 2026-11-07).

## Comment c'est fait

- **Coque, mobilier, vaisselle, rue**: Blender 5.2 scripté (`blender/`), aux cotes du plan. Repère du plan: x vers l'est, y vers le sud; dans Three.js, `x` et `z` se lisent directement sur le plan.
- **Lumière cuite**: Cycles, carte de lumière de 2 048 px sur une seconde UV (96 échantillons, débruitage OpenImageDenoise), soleil, ciel et cinq suspensions; elle voyage dans le GLB comme texture d'occlusion (`texCoord: 1`) et la scène la rebranche en `lightMap`. Le décor cuit est dessiné **sans aucune lumière dynamique**; les personnages, dans une seconde scène, reçoivent **4 lumières réelles** (hémisphérique, soleil sans ombre, deux suspensions du comptoir). Aucune carte d'ombre (C10). Les reflets des métaux et émaux viennent d'**une capture de la salle faite une fois au chargement** (pas de reflet calculé à chaque image; à valider par le tech-artist au regard de C11).
- **Matières de B**: textures générées par script (`blender/textures.py`, tuiles de 256 à 512 px, aucune photographie): bois veiné, tomettes hexagonales, chaux, peinture, faïence vert sombre, paille, pierre, pavés; métaux et émaux par rugosité et métal; le reste sur la texture de palette de la bible.
- **Meshy**: chaise paillée (variante B), plante en pot, personnages. Fiche complète: `meshy/essai-style.meshy.json`; images d'entrée: `meshy/references/`.
- **Textes du monde**: ardoise en Caveat, tickets en Patrick Hand, écrits par la scène (toiles 2D), polices de la bible (OFL), sans réseau.

## Mesures de B (scène Three.js sous Chromium, SwiftShader)

| Mesure | Vue 1 | Vue 2 | Vue 3 | Budget du village (bible 13.5, technique C8) | Tenu |
|---|---|---|---|---|---|
| Triangles dessinés | 75 106 | 70 816 | 85 591 | 150 000 | oui |
| Appels de dessin | 40 | 36 | 39 | 80 | oui |
| Programmes de shader | 14 | 14 | 13 | 10 | **non** (voir plus bas) |
| Mémoire de textures | 47,1 Mo | 47,1 Mo | 47,1 Mo | 128 Mo visés | oui |
| Lumières dynamiques | 4 | 4 | 4 | 4 | oui |
| Cartes d'ombre | 0 | 0 | 0 | 0 | oui |

- Fichier: `modeles/cafe_B.glb`, **3,8 Mo** (carte de lumière en WebP, maillages Meshopt), validateur glTF: 0 erreur, 0 avertissement.
- Triangles chargés: décor cuit 54 837 (dont la rue), personnages 30 342. Par personnage: 5 240 à 5 270 (budget de la bible: 4 000 visés pour un client de près, 5 000 pour un joueur habillé): **un peu au-dessus**, à ramener par la topologie demandée à Meshy (4 000) ou une décimation.
- Programmes: les 13 à 14 comptent ceux de la capture d'environnement faite au chargement (environ 4); en régime, la vue en garde 9 à 10. À confirmer par le tech-artist.
- Ardoise vue de l'entrée: majuscules d'environ 10 pixels à 1366 x 768, **sous les 14 pixels du critère E5**. Il faudra une ardoise plus grande ou des lettres plus grosses (environ 1,5 fois).
- **SwiftShader ne dit rien des images par seconde sur l'Intel UHD 620** du PC de référence: à mesurer chez le client.

Variante A (arrêtée), pour comparaison: 61 000 à 75 000 triangles, 16 à 18 appels, 7 à 8 programmes, 27,7 Mo de textures, `modeles/cafe_A.glb` de 1,3 Mo.

## Ce qui est provisoire

- Une seule lumière cuite (fin d'après-midi); les états matin et soir, le mélange selon l'heure et le canal séparé des taches de soleil sont au tech-artist.
- Personnages figés dans une pose (pas d'animation dans la scène), sans morphoses du visage, sans liseré du client qui attend.
- Mains en vue subjective, vapeur, filet de café, halos des lampes: absents.
- Croissants scriptés (le croissant de Meshy, droit et trop haut, a été écarté); ils restent simples de près.
- Le tilleul n'est vu qu'en partie par les vitrines (sa place est celle du plan; le bas de la couronne passe sous le linteau).

## Ce que B demande pour devenir la direction du jeu

1. **Bible**: réécrire les sections 4.1 (chanfreins discrets de 3 à 5 mm, pièces rondes à 24 à 32 pans), 6 (textures de matière autorisées, tuiles de 256 à 512 px générées par script; reflets d'environnement figés au chargement) et 12 (le veinage du bois n'est plus « à éviter »). Les règles de valeurs (porcelaine claire sur surface sombre) et la palette restent.
2. **Matières**: une bibliothèque de textures scriptées par adresse (bois, sols, enduits, carrelages, pierre, pavés), tintées par la palette; un atlas par adresse pour limiter les matériaux (B en compte 18 pour le seul village, d'où 36 à 40 appels).
3. **Lumière**: la cuisson par script et la capture d'environnement sont prêtes à reprendre; prévoir les états matin, après-midi et soir et leur poids en mémoire (2 048 px par état).
4. **Personnages Meshy**: chaîne prouvée (image vers 3D, rig, clips partagés par les noms d'os). À faire: topologie à 4 000 triangles, mise en conformité par `conformite_personnage.py` (un GLB par personnage avec ses clips), squelette commun et morphoses du visage (technique 4.1), paires de clips assis et debout propres au jeu. Coût observé: 23 crédits par personnage (image 3, modèle 15, rig 5), clips en plus (3 par action, une seule fois pour tous).
5. **Budgets**: triangles, appels et mémoire tenus avec de la marge sur le village; programmes à tenir sous 10 (une seule famille de matériau standard, capture d'environnement libérée après usage); personnages à ramener à 4 000 triangles. Le vrai juge reste le PC du client.

## Régénérer

```
# depuis docs/jeux/cosy-cafe/essai-style/
duo-python blender/construire.py -- --variante B          # environ 3 min (cuisson comprise)
bash blender/optimiser.sh <chemin de gltf-transform>       # @gltf-transform/cli 4
THREE_DIR=<dossier du paquet three 0.187> node scene/capturer.mjs B 1,2,3 1366x768
node scene/serveur.mjs                                      # puis ouvrir http://127.0.0.1:8765/scene/?v=B&vue=1
```

Prérequis: `npm ci` dans `../bible/` (polices), Playwright et Chromium, les personnages riggés de Meshy dans `meshy_output/rigs/` (sorties brutes, ignorées par git; sans eux le script pose des silhouettes scriptées) et `docs/production/essais-meshy/modeles/char_essai_presse.glb` (clips du tech-artist).

## Fichiers

| Chemin | Rôle |
|---|---|
| `blender/construire.py` | construction, UV de lumière, cuisson, export d'une variante |
| `blender/geo.py`, `blender/scene_cafe.py`, `blender/materiaux.py`, `blender/textures.py` | géométrie, scène du plan, matériaux des variantes, textures de B |
| `blender/personnages_meshy.py`, `blender/conformer_meshy.py`, `blender/meshy_import.py` | personnages Meshy posés, mise en conformité des aperçus Meshy |
| `blender/personnages.py` | silhouettes scriptées (repli si les rigs manquent) |
| `blender/exporter_palette.cjs` | palette de la bible pour les scripts |
| `blender/optimiser.sh` | WebP et Meshopt |
| `modeles/cafe_B.glb`, `modeles/cafe_B.json` | scène B et sa fiche (triangles, matériaux, cuisson) |
| `meshy/` | fiche Meshy, modèles conformes (chaise, plante), images d'entrée |
| `scene/` | page Three.js, serveur, captures, planche |
| `captures/` | captures et `mesures.json` |
