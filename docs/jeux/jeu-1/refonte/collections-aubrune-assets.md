# Collections d'Aubrune: assets à produire

Version 1 du 2026-11-11 (game-designer), pour l'artiste 2D, l'artiste 3D et le tech-artist. Contenu et règles: `collections-aubrune.md`. Rien n'a été produit: en attendant, le jeu montre la pastille à lettres de repli (`itemThumb`, `src/interface/pictos.ts`) pour une vignette absente, le repère d'insecte commun de chaque zone, et le modèle provisoire `crop-radis` pour les fleurs au potager.

Tailles: vignette d'objet 96 x 96 (grille 96, nuancier de la bible, à la plume, recette dans `assets-src/interface-encre/README.md`), rendue aussi en 48 px. Modèle 3D: la taille réelle de l'objet en jeu (1 unité = 1 m). Quand une vignette est livrée, retirer l'identifiant de `COLLECTIONS_AUBRUNE` dans `tests/interface-plume.test.ts`.

| Lot | Vignettes | Modèles 3D |
|---|---|---|
| Poissons | 10 | 10 |
| Fossiles et trésors | 11 | 0 |
| Fleurs (fleur coupée) | 12 | 12 cultures (3 stades, plus « à arroser ») |
| Graines et plants | 12 | 0 |
| Plats | 10 | 0 |
| Insectes (vignette du carnet) | 16 | 16 (facultatif, voir lot 6) |
| Total | 71 | 38 |

Pas d'asset pour les cartes postales (le carnet montre la photo prise, à confirmer avec l'interface) ni pour les musiques (pictogramme de la famille).

## 1. Poissons (vignette 96 px et modèle 3D)

Le modèle sert à la posture « montrer la prise »: longueur réelle au milieu de la plage de taille du poisson (`sizeCm` de la prise), de profil, gueule à gauche.

| Identifiant | Nom | Description | Couleurs | Taille du modèle |
|---|---|---|---|---|
| `gardon` | Gardon | poisson blanc trapu, écailles argentées, œil et nageoires rouges | argent, gris-vert, rouge | 20 cm |
| `vairon` | Vairon | tout petit poisson fuselé, dos tacheté, ventre rouge vif | olive, doré, rouge coquelicot | 8 cm |
| `loche` | Loche franche | petit poisson allongé couché sur le fond, six barbillons, marbrures | brun, sable, olive | 9 cm |
| `rotengle` | Rotengle | poisson haut et plat, flancs dorés, toutes nageoires rouge vif | or pâle, vert, rouge | 25 cm |
| `chevesne` | Chevesne | poisson robuste à grosse tête, écailles bordées de noir en filet | argent, gris-bleu, orange pâle | 38 cm |
| `breme` | Brème | poisson très haut et plat, bossu, flancs bronze | bronze, doré, gris | 45 cm |
| `barbeau` | Barbeau | poisson long, museau pointu vers le bas, quatre barbillons | brun-vert, crème, orange | 48 cm |
| `carpe` | Carpe de l'étang | grosse carpe cuivrée, grandes écailles, deux paires de barbillons | cuivre, bronze, ocre | 60 cm |
| `anguille` | Anguille | anguille en S, peau lisse sans écailles visibles | olive sombre, jaune pâle | 65 cm |
| `ombre` | Ombre commun | poisson svelte à très grande nageoire dorsale en drapeau, pointillé violet | gris-argent, violet, rouge | 35 cm |

## 2. Fossiles et trésors (vignette 96 px)

Les deux trésors de l'histoire n'ont pas d'objet: leur vignette sert au carnet (identifiant de l'entrée).

| Identifiant | Nom | Description | Couleurs | Taille réelle |
|---|---|---|---|---|
| `ammonite` | Ammonite | coquille fossile enroulée en spirale, côtes régulières | pierre ocre, gris | 6 cm |
| `dent-de-requin` | Dent de requin | dent triangulaire fossile, émail noir brillant, racine brune | noir, brun | 3 cm |
| `oursin-fossile` | Oursin fossile | oursin de pierre en forme de cœur, cinq rangées de points en étoile | craie, beige | 5 cm |
| `belemnite` | Bélemnite | rostre fossile en balle de fusil, lisse et translucide | ambre, caramel | 7 cm |
| `pointe-de-silex` | Pointe de silex | pointe de flèche taillée, bords dentelés, ailerons | silex gris-bleu, blond | 4 cm |
| `bouton-de-livree` | Bouton de livrée | bouton de laiton bombé, petite locomotive gravée | laiton, vert-de-gris | 2 cm |
| `jeton-de-cantine` | Jeton de cantine | jeton rond percé au centre, inscription « soupe » | cuivre terni, brun | 3 cm |
| `bille-d-agate` | Bille d'agate | bille de verre veiné de rouge et de blanc | rouge brique, crème, reflet blanc | 1,5 cm |
| `clou-de-voie-date` | Clou de voie daté | clou de traverse à tête ronde frappée « 34 », tige rouillée | rouille, gris fer | 15 cm |
| `horaire-de-1987` (entrée) | Horaire de 1987 | horaire de train plié en trois, colonnes d'heures, 5 h 12 entouré | papier jauni, encre noire, rouge | 15 x 10 cm |
| `lampe-de-mineur` (entrée) | Lampe de mineur | lampe de mineur en laiton à grille, crochet en haut | laiton, verre fumé | 25 cm |

## 3. Fleurs (vignette 96 px) et cultures (modèles 3D)

Vignette: la fleur coupée, tige comprise. Culture: une entrée par fleur dans `assets-src/decors/recoltables-aubrune/recoltables.toml` (comme `crop-radis`), 3 stades (levée, bouton, en fleur) et leurs variantes « à arroser », puis le champ `model` de `donnees/commun/cultures/<id>.json` passe de `crop-radis` à `crop-<id>`. Il manque sans doute un port « fleur » (tige et corolle) au générateur, à côté de « rosette » et « tuteur ».

| Identifiant | Nom | Description | Couleurs | Hauteur en fleur |
|---|---|---|---|---|
| `capucine` | Capucine | capucine orange en cornet, feuille ronde | orange, vert tendre | 0,30 m |
| `souci` | Souci | fleur ronde à pétales serrés | jaune d'œuf, orange | 0,40 m |
| `pensee` | Pensée | pensée à cinq pétales, petite figure sombre au centre | violet, jaune | 0,15 m |
| `giroflee` | Giroflée | grappe de petites fleurs à quatre pétales | brique, ocre | 0,40 m |
| `bleuet` | Bleuet | fleur étoilée en dentelle | bleu vif, vert gris | 0,60 m |
| `tournesol` | Tournesol | grand capitule, cœur brun, pétales en couronne | jaune, brun | 1,60 m |
| `nigelle` | Nigelle de Damas | fleur bleue dans une collerette de fils verts | bleu ciel, vert | 0,45 m |
| `marguerite` | Marguerite | pétales blancs, cœur jaune | blanc, jaune | 0,50 m |
| `muguet` | Muguet | brin à clochettes blanches, deux feuilles larges | blanc, vert | 0,20 m |
| `violette` | Violette | petite fleur à cinq pétales, cœur blanc | violet, blanc | 0,12 m |
| `oeillet-de-poete` | Œillet de poète | bouquet d'œillets frangés, rouge bordé de blanc | rouge, blanc | 0,45 m |
| `rose-des-lacombe` | Rose des Lacombe | rose ancienne très pleine, en coupe | rose pâle, vert sombre | 1,00 m |

## 4. Graines et plants (vignette 96 px)

Les sachets suivent `graines-radis`: même sachet de papier, l'illustration de la fleur sur le devant.

| Identifiant | Nom | Description | Couleurs |
|---|---|---|---|
| `graines-capucine` | Graines de capucine | sachet de papier kraft, capucine dessiné sur le devant | kraft, couleur de la fleur |
| `graines-souci` | Graines de souci | sachet de papier kraft, souci dessiné sur le devant | kraft, couleur de la fleur |
| `graines-pensee` | Graines de pensée | sachet de papier kraft, pensée dessiné sur le devant | kraft, couleur de la fleur |
| `graines-giroflee` | Graines de giroflée | sachet de papier kraft, giroflée dessiné sur le devant | kraft, couleur de la fleur |
| `graines-bleuet` | Graines de bleuet | sachet de papier kraft, bleuet dessiné sur le devant | kraft, couleur de la fleur |
| `graines-tournesol` | Graines de tournesol | sachet de papier kraft, tournesol dessiné sur le devant | kraft, couleur de la fleur |
| `graines-nigelle` | Graines de nigelle | sachet de papier kraft, nigelle dessiné sur le devant | kraft, couleur de la fleur |
| `graines-marguerite` | Graines de marguerite | sachet de papier kraft, marguerite dessiné sur le devant | kraft, couleur de la fleur |
| `graines-oeillet` | Graines d'œillet de poète | sachet de papier kraft, œillet dessiné sur le devant | kraft, couleur de la fleur |
| `griffes-de-muguet` | Griffes de muguet | trois griffes de muguet (rhizomes), ficelées | brun, crème |
| `plants-de-violette` | Plants de violette | petit pot de terre avec un plant de violette | terre cuite, vert, violet |
| `bouture-de-rosier` | Bouture de rosier | tige de rosier coupée, deux feuilles, papier humide autour | vert sombre, papier |

## 5. Plats (vignette 96 px)

| Identifiant | Nom | Description | Couleurs |
|---|---|---|---|
| `friture` | Friture d'ablettes | cornet de papier rempli de petites ablettes frites | doré, papier crème |
| `truite-grillee` | Truite grillée | truite entière grillée sur une assiette, rondelle de citron | doré, rose, jaune |
| `matelote` | Matelote du bief | cocotte de poisson en sauce, poireaux | brun rouge, vert pâle |
| `compotee-de-mures` | Compotée de mûres | bol de compote violette, cuillère | violet, crème |
| `tarte-aux-mures` | Tarte aux mûres | tarte ronde garnie de mûres | violet sombre, pâte dorée |
| `salade-de-radis` | Salade de radis | assiette de rondelles de radis | rose, blanc, vert |
| `gratin` | Gratin de pommes de terre | plat à gratin ovale, croûte dorée | doré, brun, crème |
| `pain-perdu` | Pain perdu | deux tranches de pain doré | doré, brun |
| `perche-meuniere` | Perche meunière | filets de perche dorés, noisette de beurre | doré, jaune |
| `tomates-farcies` | Tomates farcies | trois tomates farcies dans un plat, chapeaux posés | rouge, brun |

## 6. Insectes (vignette du carnet, modèle 3D facultatif)

Aujourd'hui chaque zone montre le même repère d'insecte (`src/rendu/lieu/recoltes.ts`). Un modèle par espèce demande aussi que le rendu le choisisse selon `place.insects.list[].s`: tâche de rendu, pas de données.

| Identifiant | Nom | Description | Couleurs | Taille réelle |
|---|---|---|---|---|
| `papillon-citron` | Papillon citron | papillon aux ailes pointues, jaune citron uni | jaune citron, vert pâle | 5 cm |
| `pieride-du-chou` | Piéride du chou | papillon blanc, pointes d'ailes noires | blanc, noir | 5 cm |
| `coccinelle` | Coccinelle à sept points | coccinelle bombée, sept points | rouge, noir | 7 mm |
| `bourdon-des-pres` | Bourdon des prés | bourdon rond et velu, bandes | noir, jaune, roux | 2 cm |
| `criquet-des-patures` | Criquet des pâtures | criquet aux grandes pattes arrière | brun, vert | 2 cm |
| `grande-sauterelle` | Grande sauterelle verte | sauterelle verte, très longues antennes | vert vif | 4 cm |
| `calopteryx` | Caloptéryx éclatant | demoiselle au corps fin, ailes à bande sombre | bleu métallique, noir | 5 cm |
| `anax-empereur` | Anax empereur | grande libellule, abdomen bleu, thorax vert | bleu ciel, vert, noir | 8 cm |
| `gerris` | Gerris | punaise d'eau sur quatre longues pattes, posée sur l'eau | brun sombre | 1,5 cm |
| `lucane` | Lucane cerf-volant | gros coléoptère aux mandibules en bois de cerf | brun acajou, noir | 7 cm |
| `carabe` | Carabe des bois | coléoptère coureur, élytres striées | cuivre, vert métal | 3 cm |
| `paon-du-jour` | Paon-du-jour | papillon roux, quatre ocelles en yeux de paon | roux, bleu, noir | 6 cm |
| `ver-luisant` | Ver luisant | petite larve allongée au bout lumineux | brun, vert phosphorescent | 2 cm |
| `grand-paon-de-nuit` | Grand paon de nuit | très grand papillon de nuit, quatre ocelles | gris-brun, crème | 15 cm |
| `hanneton` | Hanneton commun | coléoptère trapu, antennes en éventail | roux, noir | 3 cm |
| `ecaille-chinee` | Écaille chinée | papillon de nuit rayé de crème, dessous rouge | noir, crème, rouge | 5 cm |
