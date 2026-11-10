# La Petite Ligne, refonte: bible artistique

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (`games/la-petite-ligne-2`), refonte demandée le 2026-11-10 |
| Statut | proposition du directeur artistique, à valider par le manager puis par le client |
| Version | 0.2, 2026-11-10 (rendu « bande dessinée encrée ») |
| Source qui fait foi | `docs/jeux/jeu-1/refonte/reponses-client-2026-11-10.md`, et la « vision définitive des graphismes attendus en jeu » envoyée par le client le 10 novembre (14 images d'un jeu d'action existant vu du dessus et de ses recherches graphiques, non versionnées) |
| Remplace | la version 0.1 (style « maquette de train miniature », figurines lisses), lisible dans l'historique git au commit `851dc23` |
| Planches 0.2 | `planches/04-gabarits-encres.png`, `planches/05-visages-encres.png`, `planches/06-nuancier-lieux-matieres.png`; sources: `planches/source/planches_v02.py`, `planches/source/matieres/*.svg`; régénération: `bash planches/source/construire.sh` |
| Nuancier | `planches/source/nuancier-v02.json` (personnages, encre, échelles de trois tons par lieu); contrôle: `python3 planches/source/controle_nuancier.py planches/source/nuancier-v02.json` |
| Fiche de production | `docs/production/meshy.md` |

Les planches sont des schémas: elles fixent proportions, zones, tons et niveau de détail. Le rendu 3D final se jugera sur l'essai de style de la section 5.

## 0. Ce qui change en 0.2

Le 10 novembre après-midi, le client a d'abord montré des jeux de vie en 3D du début des années 2000 (modèles simples mais texturés), puis, le même jour, il a envoyé sa vision définitive: un rendu de bande dessinée encrée vu du dessus. La seconde remplace la première. La bible 0.2 retient de la première ce qui reste vrai (les vêtements, les visages et les matières **dessinés dans la texture** plutôt que modelés) et l'applique au rendu encré.

| Abandonné | Remplacé par |
|---|---|
| Réponse 46, « lisse et doux, comme une figurine » | formes anguleuses, un peu tordues, cernées d'encre |
| Le fil « maquette de train miniature » en aplats lisses | une bande dessinée encrée de la campagne française, dont la ligne de chemin de fer est le fil |
| Visages en relief à pièces de rechange (nez, yeux, bouches modelés, cibles de morphose) | tête simple, visage dessiné à l'encre dans une texture, expressions par cellules de texture (planche 05) |
| Couleur par pièce posée en couleurs de sommets, « aucune texture » | textures encrées par gabarits (3 tons et l'encre), un atlas de 512 px par personnage |
| Normales lissées, liseré clair, trois brillances | rampe de lumière à 2 tons, aucune brillance, contour d'encre |
| La direction « jeux de vie 3D des années 2000, textures réalistes adoucies » (brouillon de l'après-midi, jamais livré) | ce document |
| Planches 01 (cotes à 5 têtes) et 03 (visages en relief) | planches 04 et 05; la planche 02 (emplacements) reste valable |

| Gardé | Pourquoi |
|---|---|
| Humains: enfant, adulte, âgé, corpulences; femme ou homme pour les joueurs; toutes les pièces portables par tous | décisions du client |
| Catalogue de pièces par emplacement (section 6), règles de composition des habitants, nomenclature | rien ne dépend du rendu |
| Onomatopées au-dessus des têtes (section 7) | elles sont déjà du lettrage encré: elles deviennent la signature du style |
| Trois lieux, ton tendre et drôle avec un mystère très doux | décisions du client |
| Nuancier des personnages de la 0.1 (peaux, cheveux, tissus) | contrôlé contre les couleurs de profil de Duo; il donne aux personnages la couleur vive qui les détache du décor |
| Squelette commun `duo-24`, corps commun, chaîne par gabarits du lot L5, fusion en un maillage | ADR 0021; seuls la forme et le matériau changent (section 5.3) |
| Échelle (1 unité = 1 m), Y en haut, la question « au bon endroit, dans le bon sens, à la bonne taille, pourquoi » | règles du studio |

## 1. Direction

### 1.1 Intention et piliers

**La Petite Ligne est une bande dessinée de campagne, encrée à la main, qu'on regarde d'en haut.** Le trait d'encre, les aplats et les hachures donnent du caractère à un monde paisible; la lumière fait l'ambiance, du soleil d'Aubrune à la pénombre de Combe-Veilleuse.

| Pilier | Ce qu'il impose |
|---|---|
| **Encré** | Tout objet a son contour noir, épais, un peu irrégulier. Les plis, les joints, les fissures et les ombres de contact sont des traits et des aplats d'encre dessinés dans la texture. Rien n'est photographique, rien ne brille. |
| **Trapu** | Formes anguleuses, un peu de guingois, épaisses; quincaillerie surdimensionnée (ferrures, clous, sangles, gonds); silhouettes qui se reconnaissent vues du dessus. |
| **Lumineux** | Chaque lieu a sa teinte dominante et sa lumière: flaques claires où l'on vit, bords qui s'assombrissent (vignette), quelques effets vifs et saturés. Aubrune est chaude et claire de jour; l'ombre profonde est réservée à Combe-Veilleuse et à la nuit. |

### 1.2 La technique retenue, lue sur les références

Ce que l'on garde des 14 images, et seulement cela (on n'y prend ni motif, ni personnage, ni décor, ni palette):

1. **Contour**: trait sombre (brun-noir, jamais un noir pur), 2 à 4 pixels à l'écran, épaisseur qui varie un peu le long du trait; traits intérieurs plus fins aux plis, joints et arêtes.
2. **Couleur**: aplats peints à 2 ou 3 tons par matière, presque aucun dégradé dans les textures. Les dégradés n'existent que dans la lumière (vignette, flaques, brume).
3. **Ombre**: aplats d'ombre à bord net, souvent du côté opposé à la lumière, plus des ombres de contact sombres et franches sous et autour des objets. Quelques hachures parallèles au bord de l'ombre.
4. **Formes**: anguleuses, trapues, proportions exagérées pour les objets (la planche de coffres le montre bien: volume ramassé, ferrures énormes, veines de bois en volutes).
5. **Sols dessinés**: touffes d'herbe en traits en V, dalles et planches cernées, bords de zone qui se fondent dans l'ombre plutôt qu'une limite nette.
6. **Lecture**: caméra haute; décor plus terne, personnages petits mais vifs, lisibles par la silhouette et la couleur; les effets sont la seule chose franchement saturée.
7. **Ambiance**: vignette sombre, une teinte dominante par lieu, flaques de lumière autour des sources et des joueurs.

Ce que l'on corrige pour notre jeu: les références sont sombres, rouges et inquiétantes; nous gardons la technique, pas la noirceur. Valeurs claires et teinte chaude à Aubrune de jour, vignette légère (10 %), hachures rares; la densité monte au crépuscule et la nuit; Hautefonte est urbaine et plus contrastée; Combe-Veilleuse est le seul lieu où la pénombre, la vignette forte (65 %) et les hachures croisées s'expriment, toujours avec une lueur douce, jamais l'horreur.

### 1.3 Identité propre et garde-fous

- **Ce qui est à nous**: la ligne de chemin de fer (rails, ballast, halte à marquise, signaux, wagons de bois), la campagne française (crépi, tuiles canal, volets peints, lavoir, carreaux de ciment, plaques de rue émaillées inventées), une palette chaude et claire (section 2.9 et 3.1), le lettrage des onomatopées, des habitants tendres et drôles.
- **Interdits**: copier, décalquer ou repeindre une image des références; les verser dans le dépôt; les donner en entrée à un outil d'IA (Meshy, génération d'image); reprendre un personnage, une créature, un décor, un motif (entrelacs, tentacules, yeux rouges, runes), une icône, une police, un logo ou la palette rouge et noire des références; nommer le jeu ou ses auteurs dans nos documents.
- **Méthode**: les références se décrivent avec des mots (comme en 1.2). Toute image d'entrée d'un outil est une planche du studio.
- **Revue**: à chaque vague, le directeur artistique compare une capture à la liste des interdits; un élément qui y ressemble est refait.

### 1.4 Caméra

Notre vue du dessus qui tourne librement, avec zoom (technique, section caméra: orthographique, lacet continu, largeur de vue de 8 à 28 m). Le rendu encré gagne à une caméra plus haute: je recommande une inclinaison de **50 degrés** (au lieu de 35), adoucie à 42 au zoom le plus proche (question 1). Les murs coupés et le fondu restent ceux de la technique.

## 2. Charte du personnage encré

Planches: `04-gabarits-encres.png` (proportions, zones, ombre), `05-visages-encres.png` (visages, expressions).

### 2.1 Proportions

Décision du client: « réalistes, mais un peu adoucies ». La bande dessinée ajoute des exagérations de forme, pas de tête géante.

| Gabarit | Hauteur (sommet du crâne) | Tête (haut x large) | Têtes | Entrejambe | Taille | Épaules | Remarques |
|---|---|---|---|---|---|---|---|
| Femme adulte | 1,66 m | 24,5 x 17,5 cm | 6,8 | 0,77 m | 1,03 m | 1,35 m | |
| Homme adulte | 1,76 m | 25,5 x 18 cm | 6,9 | 0,82 m | 1,08 m | 1,44 m | |
| Enfant (8 à 10 ans) | 1,30 m | 22 x 16,5 cm | 5,9 | 0,58 m | 0,77 m | 1,01 m | tête plus grosse, jambes plus courtes |
| Âgée, âgé | 1,59 m, 1,68 m | 24 et 25 cm | 6,6 et 6,7 | 0,72 et 0,78 m | 0,97 et 1,03 m | 1,28 et 1,37 m | dos arrondi, tête avancée de 4 cm, épaules plus basses de 1 à 2 cm |

- Joueurs: femme ou homme, 3 corpulences, taille réglable de plus ou moins 4 %.
- **Exagérations de bande dessinée** (communes à tous): mains et pieds plus grands de 15 % (lecture du geste vu d'en haut), épaules marquées, poignets et chevilles fins, nez un peu plus fort. Aucune anatomie détaillée.
- Repères de couture (cou, taille, poignets, chevilles) à la même hauteur pour toutes les corpulences d'un même gabarit, comme en 0.1: c'est ce qui rend les pièces interchangeables.

Corpulences (largeurs de face, en cm; celles de la chaîne L5 se recalent dessus):

| Corps | Carrure | Poitrine | Taille | Bassin | Bras | Cuisse |
|---|---|---|---|---|---|---|
| `adult-f-slim` | 37 | 30 | 25,5 | 34,5 | 7,8 | 14,5 |
| `adult-f-medium` | 39 | 33 | 29 | 38 | 8,6 | 16 |
| `adult-f-round` | 43 | 39 | 38 | 45 | 10 | 18,5 |
| `adult-m-slim` | 42 | 34 | 29 | 33 | 8,4 | 15 |
| `adult-m-medium` | 45 | 38 | 33 | 35,5 | 9,6 | 16,5 |
| `adult-m-round` | 48 | 45 | 46 | 44 | 11,2 | 19 |
| `child-medium` | 30 | 25 | 23,5 | 26 | 6,4 | 11,8 |
| `elder-f-medium`, `elder-m-slim` | 37 et 41 | 34 | 33 et 32 | 39 et 34 | 8,5 et 8 | 16 et 14,5 |

### 2.2 Maillage

- **Formes**: anguleuses. Sections de membres à 6 ou 8 côtés, torse à 10 côtés, quelques plans francs (épaules, mollets, mâchoire). La rampe à 2 tons (section 4.2) donne une ombre nette: une facette visible fait partie du style, une bosse molle non.
- **Budget**, coque de contour comprise (4.1): 6 000 triangles par personnage assemblé (ADR 0021), soit environ 3 000 de géométrie visible et autant de coque. Répartition visible: corps et vêtements de surface 1 500 à 1 900, tête 400 à 600, cheveux 200 à 500, mains 120 chacune, pièce à géométrie propre 200 à 600.
- **Au-delà de 18 m**: niveau réduit à 1 500 triangles visibles, atlas de 256 px.

### 2.3 Mains, pieds

- Main: paume en bloc, pouce détaché, les quatre doigts en un bloc creusé de deux encoches (vues d'en haut, ce qui compte est la masse et le pouce). Les doigts sont dessinés à l'encre dans la texture.
- Pied: toujours chaussé en jeu; le pied du corps commun a la forme d'une chaussure ronde; la tige, les lacets et la semelle sont dans la texture. Seuls les sabots, bottes hautes rigides et charentaises épaisses ont une géométrie propre.

### 2.4 Tête et visage encré

Planche 05. La tête est un volume simple (crâne commun au-dessus de la ligne de chapeau, mâchoire et menton variables dessous); tout le visage est dessiné.

| Repère (fraction de la hauteur de tête, depuis le sommet) | Adulte | Enfant |
|---|---|---|
| Racine des cheveux | 0,27 | 0,30 |
| Sourcils | 0,41 | 0,45 |
| Yeux (centre) | 0,50 | 0,53 |
| Base du nez | 0,70 | 0,72 |
| Bouche | 0,80 | 0,82 |

- Œil: 3,7 cm de large (un peu plus grand que nature), écart entre les yeux égal à un œil, iris à 45 % de l'œil, blanc toujours visible, petit reflet blanc au même endroit pour tous. Paupière haute: un trait d'encre épais; pas de cils un par un.
- Sourcils: un trait effilé épais, à la couleur des cheveux (gris chez les âgés); ce sont eux qui portent l'expression.
- Nez: un aplat d'ombre et un trait, jamais un contour fermé. Bouche: un trait d'encre; la lèvre n'est teintée que sur les portraits.
- Peau: deux tons (base et ombre à bord net), plus une pastille de rougeur pour la joie, la gêne, le froid et les enfants.
- Peaux sombres (L* sous 45): lèvres plus claires que la peau (`#D9A08F`), trait fermé des yeux doublé d'un liseré clair, sourcils jamais plus sombres que l'encre pour qu'ils restent visibles. Écart d'au moins 25 points de L* entre peau et traits, comme en 0.1.
- À la distance de jeu (caméra haute), l'œil fait 1 à 3 pixels: l'émotion se lit d'abord par l'onomatopée, la pose et le dessus de la tête. Le visage se juge dans l'éditeur, les portraits de dialogue et au zoom le plus proche.

### 2.5 Expressions par textures de rechange

- Onze cellules: neutre, joie, rire, surprise, réflexion, gêne, peine, colère, sommeil (aussi utilisé pour le clignement, toutes les 3 à 6 s), parole (alterne avec neutre au rythme du babil), inquiétude (frissons de Combe-Veilleuse).
- **Atlas commun des traits**, 512 x 256, partagé par tous: 6 formes d'yeux x 6 états (ouvert, plissé de joie, grand ouvert, mi-clos, fermé, regard en coin) en cellules de 64 x 32; 5 sourcils x 4 positions (64 x 16); 10 bouches (64 x 32). Iris, sourcils et lèvres sont teintés par le shader: une seule texture pour tous les visages.
- La tête porte une seconde coordonnée de texture sur la zone des yeux et de la bouche; l'expression change un décalage dans l'atlas des traits. La tête reste le second appel de dessin du personnage (comme dans l'essai 3).
- Chaque caractère a son visage de repos (forme d'yeux et sourcils): le grincheux sourcils bas, le rêveur paupières mi-closes.

### 2.6 Cheveux

- Une coque en volume anguleux (300 à 500 triangles), mèches en 3 à 6 grandes masses; les mèches fines sont des traits d'encre dans la texture, jamais des cartes transparentes.
- Deux tons et l'encre, plus 3 à 6 reflets clairs en traits effilés sur le dessus (c'est le dessus que la caméra voit).
- Variante `--flat` sous un chapeau, comme dans la chaîne L5.

### 2.7 Zones de texture et pièces à géométrie propre

Atlas personnel composé à l'assemblage: **512 x 512 px au plus**, un par personnage (planche 04).

| Bande | Contenu | Taille |
|---|---|---|
| A | visage (fond de peau, ombre, nez, joues), crâne, oreilles, cou, cheveux | 512 x 128 |
| B | haut: avant 160, dos 160, manches en miroir 192 | 512 x 160 |
| C | jambes en miroir 256, bassin 64, mains 96, chaussures 96 | 512 x 128 |
| D | couche 2 haut (veste, gilet, manteau) 192, couche 2 bas (jupe, robe) 192, coiffe ou accessoire 128 | 512 x 96 |

- **Ce qui est une texture** (sur le corps commun, sans géométrie en plus): t-shirt, chemise, pull, débardeur, haut et bas de pyjama, marinière, pantalon droit ou étroit, short, collant, chaussettes, chaussures basses et bottines, gants, tatouage ou taches de rousseur, barbe courte et moustache fine.
- **Ce qui a sa géométrie propre**: jupe, robe, veste ouverte, gilet, manteau, capuche, col roulé épais, pantalon large, chapeau et coiffe, lunettes, sac, écharpe, tablier, barbe fournie, sabots, bottes hautes, charentaises.
- Les pièces rigides (chapeaux, lunettes, sacs) prennent la cellule « coiffe ou accessoire »; au-delà d'une pièce rigide texturée, les suivantes sont en aplats de leurs zones de couleur (pas de texture), ce qui suffit pour des lunettes ou une ceinture.
- **Coloris**: une texture de vêtement est un gabarit en niveaux (traits d'encre, ombre peinte, motif) plus un masque de zones (jusqu'à 3 couleurs); l'assemblage compose l'atlas en teintant les zones avec le nuancier. Un coloris reste une donnée (`top-shirt.moutarde`), jamais une nouvelle image.
- Mémoire vidéo (budget personnages de 16 Mo, technique): 512 x 512 avec mipmaps = 1,4 Mo; 2 joueurs et 4 habitants proches à 512 (8,4 Mo), 8 habitants plus loin à 256 (2,8 Mo), atlas des traits (0,7 Mo): 11,9 Mo.

### 2.8 Peinture des vêtements (règles des gabarits)

1. **Trois tons et l'encre**: base, ombre peinte (dessous des bras, entrejambe, sous le col, intérieur des plis), éventuellement un clair (épaules, haut du dos). Pas de dégradé.
2. **Plis**: 2 à 4 traits d'encre effilés par articulation (coudes, genoux, taille, aisselles), un aplat d'ombre sous chaque pli important. Aucun pli sur le torse d'un vêtement ajusté.
3. **Coutures**: trait d'encre en pointillé (3 texels de long, 2 d'espace) aux épaules, côtés, poignets, ourlets; patte de boutonnage en bande claire, boutons de 2 cm en ronds cernés.
4. **Motifs**: grands et simples. Carreaux d'au moins 2 cm (6 texels), rayures d'au moins 1,5 cm, pois d'au moins 1 cm. Le motif s'arrête sous les ombres peintes (il est assombri, pas effacé).
5. **Épaisseur des traits**: 3 à 6 texels à 320 px/m (1 à 2 cm), jamais 1 texel (il disparaît dans les mipmaps). Le contour extérieur vient de la coque, pas de la texture.
6. **Niveau de détail**: on dessine ce qui se voit de haut à 2 m: col, épaules, poches, ceinture, motif. Pas de fermeture éclair dent par dent, pas de texte.
7. **Usure** (habitants de métier, Combe-Veilleuse): pièces rapportées cernées, genoux plus clairs, 2 ou 3 hachures; jamais de taches sales sur un joueur.

### 2.9 Couleurs des personnages

`nuancier-v02.json`, familles `peaux` (8), `cheveux` (10, plus 3 réservées aux joueurs), `tissus` (24), `iris`, `fixes`: ce sont les teintes contrôlées de la 0.1 (aucune paire de tissus à moins de 8 en CIEDE2000, aucune teinte à moins de 15 d'une couleur de profil de Duo).

- Le décor est plus terne (bases de L* 40 à 80, saturation modérée) et les personnages gardent ces teintes franches: ils se détachent sans contour lumineux.
- Une tenue: une dominante, une secondaire, un accent; au moins 20 points de L* entre haut et bas (lecture en niveaux de gris, vérifiée sur la planche 04 convertie en gris).

### 2.10 Les deux joueurs

- Écusson du profil Duo sur la poitrine (rond de 7 cm, couleur et symbole du profil, cerne d'encre) et **anneau au sol** à la couleur et au symbole du profil, visible à tous les zooms: on se retrouve par la forme du symbole, pas par la teinte.
- La nuit et à Combe-Veilleuse, chaque joueur porte une petite flaque de lumière chaude autour de lui (section 4.4): les joueurs sont toujours les points les plus lisibles de l'écran.
- Si les deux joueurs choisissent la même dominante au même niveau de clarté, l'éditeur le signale sans l'interdire.

## 3. Charte des décors encrés

Planche 06 (nuancier des lieux, ambiances, six matières à leur résolution réelle).

### 3.1 Tons, encre et palettes par lieu

- Chaque matière d'un lieu a **trois tons**: clair, base, ombre (`lieux` dans le nuancier). Contrôle: au moins 15 points de L* entre base et ombre (11 sous une base de L* 40), au moins 6 entre clair et base; aucune échelle hors règle à ce jour.
- **Encre**: `#231A17` (brun-noir), `#141826` la nuit, `#10181A` à Combe-Veilleuse. Jamais de noir pur.
- **Aubrune de jour**: herbe tendre, terre blonde, crépi crème, tuiles orangées, bois miel, volets bleu-vert, eau claire. Teinte d'ambiance crème chaude, vignette 10 %.
- **Aubrune au crépuscule**: lumière ambrée rasante, ombres prune, vignette 30 %; **la nuit**: bleu de nuit, flaques ambrées des fenêtres et des lanternes, vignette 50 %.
- **Hautefonte**: pierre blonde, brique, zinc, fonte verte, pavés gris; accents des stores rouges et des enseignes moutarde; contrastes plus forts, vignette 30 %; la nuit, enseignes et vitrines en émission.
- **Combe-Veilleuse**: herbes folles, pierre moussue, bois gris, ardoise, brume; une seule lueur surnaturelle (vert d'eau pâle des esprits) face à l'ambre des lanternes; vignette 65 %, hachures croisées permises. Quand un esprit est apaisé, son quartier passe à l'échelle de tons plus claire.

### 3.2 Densité de texture et tailles

| Surface | Densité | Texture |
|---|---|---|
| Sols (herbe, terre, chemins) | 64 px/m | tuiles répétables de 512 (8 m), deux variantes par nature, mélange par une carte de 1 texel par 25 cm |
| Murs, toits, sols intérieurs | 128 px/m | tuiles répétables de 512 (4 m) |
| Meubles et objets | 128 à 256 px/m | atlas de 1 024 par famille et par lieu |
| Personnages | 300 px/m environ | atlas personnel de 512 (2.7) |

- Traits d'encre dans les textures: 3 à 6 texels (2,5 à 5 cm à 128 px/m). Si les traits grisent au zoom large, on génère nos propres mipmaps (chaque niveau rendu depuis le SVG avec des traits épaissis), ce que Three.js accepte (`texture.mipmaps`).
- Filtrage bilinéaire avec mipmaps, anisotropie 4 sur les sols.
- Mémoire vidéo par lieu (budget 48 Mo): 20 tuiles de 512 (28 Mo) et 2 atlas de 1 024 (11 Mo), 9 Mo de marge.

### 3.3 Hachures

1. Seulement dans l'ombre peinte, le long de son bord, jamais sur une face éclairée.
2. 3 à 7 traits parallèles, effilés, de longueurs inégales, inclinés à 45 degrés (même sens dans tout le jeu), espacés de 2 à 3 fois leur épaisseur.
3. Aubrune de jour: sur les ombres de contact et sous les avancées seulement. Crépuscule, nuit, Hautefonte: aussi au pied des murs. Combe-Veilleuse: hachures croisées permises dans les coins sombres.
4. Jamais sur un visage; sur un vêtement, 2 ou 3 traits au plus par zone d'ombre.

### 3.4 Murs, sols, toits

- **Murs**: crépi en aplat avec 2 ou 3 plaques plus claires, fissures en trait d'encre, pied du mur assombri et hachuré (remontée d'humidité); soubassement de 0,9 m et plinthe de 10 cm à l'intérieur, cernés; papiers peints à grands motifs simples (lé de 53 cm, motif de 10 à 25 cm), aucun motif copié d'un papier existant. Pierre: moellons cernés de 20 à 40 cm, joints sombres.
- **Sols**: planches de 14 à 18 cm cernées, veines en volutes, aboutages; dalles de 30 à 40 cm cernées, éclats; carreaux de ciment de 20 cm à motif géométrique simple du studio; herbe en touffes en V (encre) sur aplat, plaques claires; chemins de terre aux bords fondus dans l'herbe par une bande d'ombre, jamais une limite droite.
- **Toits**: tuiles canal (rangs de 33 cm) ou plates, chaque tuile cernée, ombre pleine sous chaque rang; ardoise en écailles cernées à Combe-Veilleuse; zinc à joints debout à Hautefonte. Débord de toit épais (15 à 25 cm de rive dessinée), faîtage et rives cernés.
- **Usure**: Aubrune un peu passée (quelques fissures, tuiles dépareillées); Hautefonte entretenue (traits plus droits); Combe-Veilleuse affaissée (mêmes modules, de guingois, peinture écaillée en grands aplats).

### 3.5 Meubles et objets

- Proportions trapues: épaisseurs de planche de 4 à 6 cm, pieds courts et larges, quincaillerie surdimensionnée de 50 à 100 % (ferrures, clous, gonds, poignées, sangles). Un objet est légèrement de guingois (1 à 3 degrés), jamais au point de sembler cassé, sauf dans la série « récup ».
- **Bois**: veines en volutes et nœuds à l'encre, deux tons; **métal**: aplat gris ou laiton, un trait clair de bord, rivets cernés, aucune brillance; **tissu**: aplats et plis à l'encre, comme les vêtements.
- **Étiquettes et emballages**: inventés par le studio (épicerie du bourg, conserves, graines, journaux), marques et logos fictifs, texte réduit à des traits ou à de grosses lettres du lettrage du studio; aucune marque réelle, aucun logo ferroviaire réel.
- Séries de meubles assorties par coloris (réponse 57): emplacements de couleur `bois`, `peinture`, `tissu`, `metal`, teintés par masque comme les vêtements. Les cinq séries de la 0.1 (récup, campagne, chambre douce, halte, jardin) restent la liste de départ.

### 3.6 Végétation

- Arbres: troncs anguleux cernés, feuillage en 3 à 6 grandes masses de cartes ou de volumes, découpées en dents, deux tons et l'encre; vus d'en haut, c'est le dessus de la masse qui compte. Buissons en une ou deux masses.
- Herbes hautes et fleurs: cartes en tests alpha (jamais en transparence mélangée), touffes en V, fleurs en ronds cernés de 3 à 5 cm.
- Lisières: une bande d'ombre peinte au sol fond le bord d'une zone (herbe vers chemin, prairie vers forêt).

### 3.7 Densité de détail

- Un détail encré tous les 50 cm à 1 m environ sur un sol (touffe, fissure, cailloux), 2 à 4 par mètre carré de mur près d'une porte, moins ailleurs. Les zones de passage restent calmes; le détail se concentre aux bords, aux seuils et autour des objets interactifs.
- Les objets interactifs ont un contour plus épais (+1 pixel) et le ton clair le plus franc de leur scène: on les repère sans surbrillance.

## 4. Fabrication du rendu chez nous (Three.js 0.187, UHD 620)

### 4.1 Contour: coque inversée fusionnée

- **Retenu**: une coque inversée **cuite dans la même géométrie** que l'objet (triangles retournés, attribut `outline = 1`), poussée le long d'une normale de contour lissée (attribut à part, cuit à l'export) d'une épaisseur exprimée en pixels d'écran (extrusion dans l'espace de découpage), 2 à 4 px selon le zoom; épaisseur modulée de 60 à 140 % par un canal de couleur de sommet et un bruit en coordonnées monde, pour le trait irrégulier. Avantages: aucun appel de dessin en plus (marche avec l'instanciation et le skinning), aucun post-traitement, même rendu sur le M1 et le PC.
- Coût: le double de triangles pour les objets cernés. Cernés: personnages, meubles, objets, bâtiments, arbres, rochers. Non cernés par coque: sols, eau, herbe en cartes (leur encre est dans la texture).
- **Écarté pour la base**: le contour par post-traitement (détection d'arêtes sur profondeur et normales): passe plein écran et rendu des normales en plus, trop cher pour l'UHD 620; et un rendu différent selon la machine est exclu (même image chez les deux joueurs).
- Traits intérieurs (plis, joints, arêtes): dans les textures.

### 4.2 Matériau commun « encre »

- Un seul programme pour le décor et un pour les personnages (skinning): couleur de la texture, puis **rampe à 2 tons** sur N·L (seuil 0,35, transition de 2 %), ombre portée du soleil échantillonnée puis seuillée de même, teinte d'ombre fournie par le lieu et l'heure (prune au crépuscule, bleu la nuit), lumière d'ambiance plate. Aucune spéculaire, aucune carte de normales, aucune réflexion.
- Brume: brume linéaire teintée de Three.js (coût négligeable).
- **Vignette dans le matériau** (`gl_FragCoord`), sans passe en plus: 10 à 65 % selon le lieu.

### 4.3 Ombres

- Ombre du soleil: une carte d'ombre de 2 048 (préréglage Haute) ou 1 024 (Moyenne), cadrée sur la vue; bord net (pas de filtrage doux): c'est le style.
- Ombres de contact peintes: dans les textures des objets et sous forme de décalques au sol (une texture commune de 128 px à bord net, multipliée), sous chaque personnage, meuble et objet posé.

### 4.4 Lumière et effets

- Flaques de lumière: décalques au sol en mélange additif ou écran (texture radiale de 64 px à deux anneaux nets), sous les fenêtres la nuit, les lanternes, les feux, et autour de chaque joueur la nuit et à Combe-Veilleuse. Elles n'éclairent pas les volumes: au plus 4 lumières ponctuelles réelles par vue pour cela (règle de la technique).
- Effets: sprites en mélange additif, saturés (étincelles, lucioles, poussière des esprits, éclaboussures), animations de 4 à 8 images, contour d'encre dessiné dans le sprite pour les effets opaques (fumée, poussière, bulles de pêche).
- Ciel: rarement visible (caméra haute); couleur de fond et brume à la teinte du lieu.

### 4.5 Textures encrées par gabarits

- Chaque matière est un **script de gabarit** (Python, comme `planches/source/planches_v02.py`): paramètres (taille des planches, densité des touffes, tons du lieu), graine, sortie SVG, puis PNG à la taille voulue par `rsvg-convert`. Les traits sont des fuseaux effilés et les contours des polygones aux sommets bougés: le « fait main » est reproductible et retouchable. Sources et gabarits versionnés à côté des PNG.
- Vêtements: le gabarit dessine sur la disposition d'UV de la zone (bande B, C ou D) connue par la chaîne L5: plis aux articulations, coutures aux bords, motif, ombre peinte; plus un masque de zones pour les coloris.
- Contrôle automatique de chaque texture: épaisseur minimale des traits (3 texels), nombre de couleurs avant filtrage (tons du lieu plus encre), aucune teinte hors nuancier.

### 4.6 Budgets (PC de référence: UHD 620, 1366 x 768, 30 images par seconde au préréglage Moyenne)

| Poste | Budget |
|---|---|
| Triangles, coques comprises | 350 000 par vue, dont personnages 120 000 (6 000 par personnage, coque comprise) |
| Appels de dessin | 200 (personnages: 2 par personnage et par passe; décor instancié par famille et par tuile) |
| Programmes | 4 (décor, personnage, sol, effets) plus ceux de Three.js pour les ombres |
| Mémoire des textures | 96 Mo (lieu 48, personnages 16, ombres 16, interface 16) |
| Passes plein écran | aucune en plus du rendu (vignette et brume dans les matériaux) |

## 5. Production

### 5.1 Ordre

1. **Essai de style encré** (5.4), puis validation du client sur captures.
2. **Personnages**: corps commun anguleux, atlas, visage encré, vague 1 du catalogue (6.2).
3. **Meubles**: séries d'Aubrune (récup d'abord, pour la maison en ruine du début).
4. **Bâtiments**: modules d'Aubrune (murs, toits, ouvertures), maison en ruine et ses états, halte, deux commerces.
5. **Paysage**: sols, chemins, eau, arbres, rochers, lisières. En dernier parce qu'il supporte le mieux d'attendre, et parce que ses textures dépendent des tons validés sur les étapes précédentes.

### 5.2 Méthode par famille

| Famille | Géométrie | Texture |
|---|---|---|
| Corps, vêtements de surface, têtes | chaîne L5 (`gabarits.toml`), formes anguleuses, UV par zone | gabarits encrés (4.5) |
| Pièces à géométrie propre (jupes, vestes, robes) | chaîne L5, coque décalée du corps | gabarits encrés, bande D |
| Chapeaux, sacs, coiffures élaborées, objets organiques | Meshy en maillage seul (`meshy-t2.5`, 5 crédits), image de référence dessinée par le studio dans le style encré, puis mise en conformité et UV par script | gabarits encrés; la texture de Meshy n'est jamais utilisée (elle est réaliste) |
| Meubles, objets droits, bâtiments | scripts Blender (formes trapues, de guingois paramétrable) | gabarits encrés, atlas de famille |
| Sols, herbe, eau | maillage du terrain par tuile | tuiles répétables encrées, mélange par carte |

### 5.3 Ce que deviennent les essais et les livrables déjà faits

| Élément | Devenir |
|---|---|
| Squelette `duo-24`, clips (`walk`, `run`, `idle`, `sit`, `carry`), fusion en un maillage, sections masquées, catalogue piloté par `gabarits.toml` (lot L5, ADR 0021) | **gardés** |
| Volumes ronds et lisses de `figurine.py` (voie D) | **à refaire**: sections à 6 à 10 côtés, plans francs, normales de contour cuites, UV par zone |
| Couleurs de sommets par zone (`TEXCOORD_0` codant zone et section) | **à refaire**: UV réelles vers l'atlas personnel; zone et section passent en attribut à part |
| Visage à cibles de morphose (sourcils, paupières, bouches en relief) | **abandonné**: tête lisse et atlas des traits |
| Bonnet de Meshy (tâche n° 20) | géométrie **à revoir** (trop douce), texture à refaire |
| Essais Meshy personnage (voies A, B, C) | sans objet (déjà écartés) |
| Essai de style en cours (textures réalistes contre personnage entier de Meshy) | **à arrêter**, remplacé par l'essai encré (5.4) |
| Planches 01 et 03 | remplacées par 04 et 05; 02 (emplacements) gardée |
| `nuancier.json` (0.1) | gardé pour la chaîne L5 tant qu'elle ne lit pas `nuancier-v02.json`; mêmes teintes de personnages |
| Carte d'Aubrune, plans, interface, onomatopées | inchangés par le rendu |

### 5.4 Essai de style encré: ce que j'attends du tech-artist

Un coin d'Aubrune de 8 x 8 m: un joueur et un habitant (corps commun anguleux, pyjama à carreaux et tenue de travail en texture encrée, visage encré), un coffre trapu, une table, un pan de façade crépie avec fenêtre et débord de toit en tuiles canal, sol herbe et chemin de terre avec lisière fondue. Trois éclairages (jour, crépuscule, nuit avec une fenêtre éclairée) et le même coin en ambiance Combe-Veilleuse. Contour par coque fusionnée; si possible la même vue avec un contour par post-traitement, pour comparer.

Liste de contrôle avec laquelle je jugerai la planche:

1. **Contour**: 2 à 4 px à tous les zooms, irrégulier mais sans trou ni pointe aux arêtes vives, présent sur les personnages animés (marche, assis).
2. **Tons**: au plus 3 tons par matière plus l'encre, rampe à 2 tons nette, aucune brillance, aucun dégradé dans les textures.
3. **Encre dans les textures**: traits d'au moins 3 texels, lisibles au zoom le plus large sans grisaille ni scintillement en mouvement de caméra.
4. **Lisibilité**: en niveaux de gris, les deux personnages et le coffre se détachent du sol et du mur dans les quatre éclairages; anneau et écusson reconnaissables sous simulation de deutéranopie et de protanopie.
5. **Formes**: silhouettes trapues et anguleuses reconnaissables vues d'en haut; rien qui flotte, dépasse ou traverse (pieds au sol, coffre posé, débord de toit au bon sens).
6. **Personnage**: proportions de la section 2.1, vêtements dessinés suivant le corps à la marche (plis aux coudes et genoux), coutures cachées, atlas de 512 au plus, deux appels de dessin.
7. **Visage**: expressions joie, surprise, sommeil lisibles au zoom le plus proche et dans un portrait; traits visibles sur la peau la plus sombre.
8. **Ambiance**: Aubrune de jour claire et chaude (vignette discrète), nuit avec flaques ambrées, Combe-Veilleuse sombre mais douce; une teinte dominante par lieu, effets saturés seulement sur les sources.
9. **Budgets mesurés**: triangles (coques comprises), appels, programmes et mémoire des textures sur la page de mesure; estimation de l'image par seconde sur l'UHD 620 argumentée (ou mesure sur le PC du client).
10. **Production et originalité**: textures sorties de gabarits versionnés et régénérables d'une commande; aucun élément ressemblant aux références (1.3).

## 6. Catalogue des personnages, révisé

La liste des formes de la 0.1 (section 4 au commit `851dc23`) reste la liste de départ; son écriture change selon la règle de 2.7. Les identifiants suivent la chaîne L5 (`top-tee`, `hat-beanie-pompom`).

### 6.1 Ce qui devient texture, ce qui reste géométrie

| Famille | Pièces (0.1) | Devient |
|---|---|---|
| Corps | 8 corps | 8 morphologies du corps commun (`adult-f-*`, `adult-m-*`, `child-*`, `elder-*`), géométrie |
| Têtes | 15 | 6 têtes (2 enfant, 2 adulte, 2 âgé) en géométrie, la variété passe dans la texture (taches de rousseur, rides, grains de beauté) |
| Pièces du visage | 25 (nez, yeux, sourcils, bouches) | **texture**: atlas commun des traits (2.5); nez dessiné dans le fond de peau (6 formes) |
| Cheveux | 16 | géométrie (coques anguleuses) et texture de mèches |
| Pilosité | 6 | barbe courte, moustaches, bouc: **texture**; barbe fournie et longue barbe: géométrie |
| Hauts | 15 hauts | **texture** (t-shirt, chemises, pulls, marinière, débardeur, polo, sweat, haut de pyjama); col roulé épais et capuche: petit volume ajouté |
| Vestes | 5 couches 2 | géométrie (veste, gilet matelassé, ciré, manteau, blouson), texture en bande D |
| Bas | 14 | **texture** (pantalons droits, étroits, retroussés, short, bermuda, bas de pyjama); pantalon large et culotte courte: géométrie; jupes: géométrie |
| Robes et salopettes | 12 | robes: géométrie (jupe) plus texture du buste; salopettes et bleu de travail: **texture** (bretelles et poche dessinées), sauf la salopette jupe |
| Chaussures | 14 | **texture** sur le pied commun (baskets, bottines, souliers, mocassins, ballerines, espadrilles, sandales); sabots, bottes de pluie, bottes hautes, charentaises: géométrie |
| Chapeaux | 15 | géométrie (Meshy ou script), texture cellule « coiffe »; bandeau et fichu: texture sur la coiffure |
| Lunettes | 10 | géométrie scriptée, sans texture (aplats) |
| Sacs, accessoires | 16 | géométrie; tablier, foulard noué, cravate: texture quand ils collent au corps |

Effet: environ 70 des 164 pièces de la 0.1 deviennent des textures sur le corps commun, sans géométrie ni crédit.

### 6.2 Vague 1

Habiller les deux joueurs avec du choix et six habitants d'Aubrune très différents (archétypes de la 0.1: chef de halte, boulangère, gamine du bourg, factrice, grand-mère, menuisier).

| Famille | Vague 1 |
|---|---|
| Morphologies | 6 adultes, 1 enfant, 2 âgés |
| Têtes, visages | 6 têtes, atlas des traits complet (11 expressions) |
| Cheveux | court, raie de côté, carré, queue de cheval, chignon haut, chignon bas, couettes, couronne dégarnie (et leurs variantes `--flat`) |
| Textures de haut | t-shirt, chemise de travail, chemise à col, pull, blouse, haut de pyjama à carreaux |
| Textures de bas | pantalon droit, pantalon de toile, bermuda, bas de pyjama, salopette |
| Géométrie | jupe trapèze, jupe longue, robe boutonnée, veste de travail, gilet ouvert, veste de chef de halte, tablier à bavette |
| Chaussures | bottines, baskets de toile, souliers à bride (texture); sabots, bottes de pluie (géométrie) |
| Coiffes, accessoires | casquette plate, chapeau de paille, casquette de chef de halte, bonnet court, calot, lunettes rondes et demi-lunes, sacoche de la poste, cartable, canne, châle |

Crédits Meshy estimés pour la vague 1: 6 pièces rigides à 5 crédits, deux essais en moyenne: environ 60 crédits, marge comprise 80. Aucun crédit dépensé dans cette mission.

## 7. Onomatopées, emplacements, composition (repris de la 0.1)

- **Onomatopées**: tableau et règles de la 0.1 (section 6.2 au commit `851dc23`) inchangés: « ! », « !!! », « ? », « ?? », « ?! », « ... », note, cœur, « Zzz », « grr », « pff », « ha ha »; lettrage original du studio, gras et de travers, cerne d'encre `#231A17`, liseré clair; 32 px de haut au moins à 1366 x 768; jaillit en 0,18 s, tient 1,2 s, s'efface en 0,25 s. Elles sont désormais au cœur du style: même encre et même épaisseur de trait que le décor.
- **Emplacements** (`body`, `head`, `hair`, `facial_hair`, `top`, `outer`, `bottom`, `shoes`, `hat`, `glasses`, `neck`, `back`, `side`, `waist`, `hand`, `badge`): planche 02 et section 3.1 de la 0.1. Couches: un vêtement en texture est en couche 0 (peint sur le corps), une géométrie propre en couche 1 ou 2.
- **Composer un habitant**: règles de la 0.1 (section 3.5) inchangées: silhouette d'abord, au moins 4 emplacements visibles de différence dans un même lieu, palette du lieu, âge qui commande, registre des compositions dans la sauvegarde.

## 8. Questions pour le client et risques

### 8.1 Questions (chacune avec une recommandation)

1. **Caméra plus haute** (50 degrés au lieu de 35, toujours libre en rotation et en zoom) pour se rapprocher du « presque vu du dessus » ? Recommandation: oui, à confirmer sur les captures de l'essai.
2. **Proportions**: on garde « réalistes adoucies » (6,5 à 7 têtes) avec des mains et des pieds un peu plus grands, plutôt que des personnages trapus à 5 ou 6 têtes ? Recommandation: oui, c'est ta décision du 10 novembre et elle va bien avec le trait encré.
3. **Combe-Veilleuse** seule à avoir l'ambiance sombre des images (pénombre, vignette forte, hachures croisées), Aubrune restant claire et chaude ? Recommandation: oui, le contraste raconte le voyage.
4. **Même rendu sur les deux machines** (pas de contour plus beau sur le Mac que sur le PC) ? Recommandation: oui, vous voyez la même image.
5. **Essai d'abord**: un coin d'Aubrune encré (personnages, coffre, façade, sol) en jour, nuit et version hantée, avant toute production ? Recommandation: oui, c'est un jour de travail et il évite de refaire le catalogue.

### 8.2 Risques

| Risque | Parade |
|---|---|
| Ressemblance avec le jeu des références | garde-fous de 1.3, palette et sujets à nous, revue à chaque vague |
| Ambiance trop sombre pour un jeu tendre | palettes claires à Aubrune, vignette dosée par lieu, contrôle des valeurs (L*) sur captures |
| Traits d'encre qui grisent ou scintillent au zoom large | traits de 3 texels au moins, mipmaps faits par nous au besoin, critère 3 de l'essai |
| Coque inversée: trous aux arêtes vives, pointes sur les pièces fines | normale de contour lissée cuite à l'export, épaisseur réduite par sommet sur les pièces fines (lunettes, doigts) |
| Le double de triangles des coques | budget de 6 000 coque comprise, coques absentes des sols et de l'herbe, niveau réduit au loin |
| Volume de textures à dessiner | gabarits paramétrés et coloris par masque: une texture de vêtement sert à tous les corps et à tous les coloris |
| Chaîne L5 à reprendre (formes, UV) | squelette, clips, fusion et catalogue gardés; seuls `figurine.py` et l'export changent |
| Visages peu lisibles vus de haut | onomatopées, pose, portraits de dialogue; le visage se juge de près |
| Mesure réelle sur l'UHD 620 impossible ici | estimation argumentée à l'essai, mesure sur le PC du client au premier jalon |

## 9. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-11-10 | 0.1 | Première version: style « maquette de train miniature », figurines lisses, visages en relief, catalogue de 164 pièces, méthode Meshy, onomatopées, trois lieux, séries de meubles | directeur artistique |
| 2026-11-10 | 0.2 | Vision définitive du client: rendu « bande dessinée encrée » vu du dessus. Abandon des figurines lisses (réponse 46), du fil « maquette de train miniature », des visages en relief et de la couleur sans texture; abandon du brouillon « jeux de vie 3D des années 2000 » de l'après-midi. Ajout: piliers encré, trapu, lumineux; garde-fous d'originalité; charte du personnage encré (proportions de 6,6 à 6,9 têtes, atlas de 512, visage et expressions en texture, règles de peinture des vêtements); charte des décors (trois tons par matière, hachures, densités, palettes par lieu et par heure); fabrication dans Three.js (coque inversée fusionnée, rampe à 2 tons, vignette dans le matériau, gabarits de textures); devenir des essais; catalogue révisé; liste de contrôle de l'essai encré; planches 04 à 06 et nuancier 0.2 | directeur artistique |
