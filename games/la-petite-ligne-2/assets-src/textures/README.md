# Textures répétables: sources de la bibliothèque

Style « bande dessinée encrée » (vision définitive du client, 2026-11-10): aplats peints à 2 ou 3 tons par matière, contours et joints à l'encre épais et irréguliers, éléments un peu de travers, ombres en taches plates et en hachures, herbe en touffes de traits sombres. Aucun bruit photographique, aucun relief réaliste, aucune brillance. Tout est calculé par nos scripts; aucune image existante n'est reprise.

```text
bash games/la-petite-ligne-2/assets-src/textures/construire.sh
```

Environ 25 s: fabrique les atlas, les contrôle (`VERIFICATION ... 0 erreur(s)`) et refait la planche `docs/jeux/jeu-1/refonte/planches/textures.png` (chaque texture répétée 4 x 4, caméra inclinée de 35 degrés depuis la verticale, et trois mises en situation avec des figurines de 1,70 m).

## Ajouter une texture (aucun code)

1. Ouvre `gabarits.toml` et repère une entrée `[[textures]]` du même `motif` (`herbe`, `terre`, `paves`, `dalles`, `planches`, `bardage`, `crepi`, `pierre`, `tuiles`, `eau`, `brique`).
2. Copie-la juste en dessous; change `id` (anglais, traits d'union), `nom` (français), `matiere`.
3. Règle les `tons` (clair, moyen, sombre) et les paramètres en mètres: `pave`, `dalle`, `lame`, `longueur`, `assise`, `tuile`, `trait` (épaisseur d'encre), `hachures` (part des éléments hachurés), `fissures`, `cailloux`, `touffes`, `densite` et `brin` (herbe), `rides` (eau), `ecaille`, `mousse`.
4. `palettes = ["aubrune", "hautefonte", "combe-veilleuse"]` décline la texture par lieu (même dessin, autre ambiance; la première garde l'identifiant, les autres prennent le suffixe du lieu). Une nouvelle ambiance = une section `[palettes.<lieu>]` (`encre`, `teinte`, `desature`, `clarte`).
5. Essaie-la seule: `bash .../construire.sh <id>` écrit `assets-src/textures/.essai/essai/<id>.png`, répétée 2 x 2 (ignoré par git).
6. Lance `construire.sh` sans argument et regarde la planche de près.

Les éléments sont arrondis au nombre entier qui tient dans la taille couverte (sinon la texture ne se raccorderait pas); la taille réellement obtenue est dans `textures.json` (`mesures_m`), et c'est elle que le contrôle d'échelle juge. Un nouveau motif s'écrit dans `encre.py` (fonction `e_<nom>` inscrite dans `MOTIFS`), toujours sur le tore: `ctx.bruit`, `rangees`, `voronoi`, `traits`, `Gauchi`, jamais de filtre sans `mode="wrap"`.

## Fichiers

| Fichier                  | Rôle                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `gabarits.toml`          | palettes de lieu, familles, contrôles, une entrée par texture: la seule chose à modifier pour ajouter du contenu |
| `encre.py`               | les motifs encrés et leurs outils (traits effilés, hachures, touffes, éléments cernés, coordonnées gauchies)     |
| `motifs.py`              | outils du tore: contexte, bruit périodique, rangées d'éléments, Voronoï périodique                               |
| `construire_textures.py` | déclinaisons par palette, atlas, `textures.json` (normales possibles, coupées par famille)                       |
| `verifier_textures.py`   | relit les WebP: variantes par matière, tailles, poids, raccord, contraste, clarté par lieu, échelle              |
| `planche.py`             | planche de contrôle et mises en situation (rayons sur des plans, sans moteur 3D)                                 |

## Contrôles (`[controles]` de `gabarits.toml`)

- **Raccord**: l'écart entre la dernière et la première colonne (puis ligne) ne doit pas dépasser le plus grand écart entre voisines à l'intérieur (au pixel, et sur des bandes glissantes de 5 cm pour une dérive lente). Le contrôleur vérifie à chaque passage qu'il voit un dégradé fabriqué exprès. Une couture fine dans un motif très dessiné ne se mesure pas ainsi: c'est la fabrication sur un tore qui la rend impossible.
- **Variété**: chaque matière prioritaire (herbe, terre, pavés, dalles, plancher, crépi, pierre, tuiles, bardage, eau) a au moins 2 variantes à Aubrune.
- **Poids**: moins de 6 Mo (0,8 Mo au 2026-11-10).
- **Contraste et clarté**: écart-type de L* au plus 24, détail à moins de 25 cm au plus 22 (le style est contrasté par nature); clarté moyenne de 45 à 88 à Aubrune (jour tendre et clair), 38 à 85 à Hautefonte, 25 à 70 à Combe-Veilleuse.
- **Échelle**: lame de plancher 8 à 14 cm (12 à 30 cm pour `large = true`), pavé 9 à 16 cm, dalle 30 à 80 cm, tuile 18 à 30 cm, brique 20 à 26 cm.

## Note d'intégration pour le rendu (sans modifier `src/rendu/`)

**Fichiers** (`assets/commun/textures/`): par famille, `<famille>.webp` est une bande verticale de `couches` images de `pixels` (largeur x hauteur) empilées dans l'ordre de `textures.json`. Couleurs en sRGB. `relief` vaut `null`: le style n'a pas de normales.

**Chargement**: deux façons, au choix du lot de rendu.

1. _Tableau de textures_ (recommandé): décoder la bande (`ImageBitmap` puis canvas, `getImageData`) et créer une `THREE.DataArrayTexture(data, largeur, hauteur, couches)`; la couche se choisit par un attribut ou un uniforme, `RepeatWrapping` marche par couche. Un objet texture par famille.
2. _Textures simples_: découper la bande en canvas et créer une `CanvasTexture` par texture employée.

Réglages: `colorSpace = SRGBColorSpace`, `wrapS = wrapT = RepeatWrapping`, `generateMipmaps = true`, `minFilter = LinearMipmapLinearFilter`, `magFilter = LinearFilter`, `anisotropy = min(4, renderer.capabilities.getMaxAnisotropy())` (sols vus de biais: sans elle, les joints d'encre se brouillent en moiré). Matériau mat, sans carte de relief ni brillance; l'éclairage du jeu module les aplats.

**Plaquer selon la taille réelle** (`taille_m = [L, H]` dans `textures.json`), en coordonnées du monde pour que deux zones voisines se raccordent:

- _Sol ou tuile de terrain_: `u = x / L`, `v = z / H`. Une tuile de terrain de 32 m reçoit un sol extérieur de 4 m répété 8 fois; ne jamais étirer une texture à la taille de la tuile. Pour casser la répétition, alterner les variantes d'une même matière par tuile ou par zone (même `matiere`, couches différentes).
- _Mur_: `u = abscisse le long du mur / L`, `v = hauteur au-dessus du sol / H`. Un soubassement de pierre sous un crépi est une seconde face, ou une seconde couche choisie sous une hauteur donnée.
- _Toit_: `u` le long de l'égout, `v` dans le sens de la pente vers le faîtage: les rangs de tuiles restent horizontaux et leur ombre tombe vers l'égout.
- _Eau_: même plaquage qu'un sol; un léger glissement de `u` dans le temps (quelques cm/s) suffit à la faire couler sans autre effet.
- _Lieu_: prendre la déclinaison de la palette du lieu (`palette` dans `textures.json`).

**Budget mémoire** (vidéo, lieu: 48 Mo dans `technique.md`): une couche RGBA avec mipmaps coûte 4/3 x largeur x hauteur x 4 octets: 0,35 Mo en 256 x 256, 1,40 Mo en 512 x 512. Bibliothèque entière: 22 sols extérieurs (30,8 Mo), 26 couches de 256 (9,1 Mo), soit 40 Mo. Ne charger que la palette du lieu (21 Mo pour Aubrune), et mieux, que les couches que le lieu cite. Fichiers sur disque: 0,8 Mo.
