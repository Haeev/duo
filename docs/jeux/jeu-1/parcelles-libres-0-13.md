# La Petite Ligne 0.13: les parcelles libres (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | conception, à valider par le manager puis à produire en 0.13 (lots P1 à P6, section 8) |
| Version du document | 1 |
| Date | 2026-11-04 |
| Rédaction | game-designer, sur brief du manager (mission 0.13, retour R09 du 3 novembre) |
| Demande du client | « Les parcelles de cultures devraient commencer à 6 en début de partie, mais avec la possibilité d'en avoir de plus en plus, de manière assez linéaire, pour cultiver rapidement en quantité, et pouvoir les placer sur notre terrain comme on le veut (et les supprimer pour les mettre ailleurs). » |
| Point de départ | branche `claude/stoic-lamport-lueey2`: carte 0.13 chargée (164 x 78 m, origine x -24, y -30), potager fixe de 12 cases (`reglages.garden`, zone `garden` x 7 à 10, y 28 à 30), format de sauvegarde 14 |
| Sources | `v0-13-carte.md` (section 6: friche, jardins de la Rive, champs du Haut), `economie-chaines-0-12-2.md` (règle des marges, tableau des activités), `v0-12-conception.md` (offre d'Odette, commandes), `interface-imagee-0-12-2.md`, `cahier-des-charges.md` (FE-01 à FE-06), code: `src/simulation/potager.ts`, `amenagement.ts`, `chevres.ts`, `poules.ts`, `src/rendu/potager.ts`, `src/etat/commande-generee.ts`, `src/sauvegarde/sauvegarde.ts` |
| Simulation | `simulations/parcelles_0_13.py` (bibliothèque standard, environ 20 s): terre posable lue dans la carte, rendement du potager avec l'offre d'Odette, prix et remboursement, courbes de croissance, taille de l'état transmis. `--croise` relit ce document (réglages et valeurs marquées) et échoue en cas d'écart |

## En bref

**Pitch.** Ton potager n'est plus un carré fixe: tu tends le cordeau où tu veux sur ton jardin, tu poses tes parcelles une à une ou d'un trait, et chaque matin Odette en a deux de plus à te vendre.

**Fantasme.** « On a six parcelles devant la porte. Je file chez Odette en prendre deux, pendant que tu défriches le coin du bief: quatre cases de ronces arrachées, une parcelle de plus. Ce soir on trace une rangée de carottes le long de la haie, loin de la chèvre. »

- **Une parcelle = une case** (le « carré » à sillons d'aujourd'hui). **6 au départ**, posées devant la porte.
- **On en gagne de deux façons**, qui remplissent le même compteur: **les acheter chez Odette** (30 aubrins pièce, 2 de plus en rayon chaque matin, 10 en rayon au plus) ou **défricher la friche** (4 cases défrichées offrent 1 parcelle, 12 au plus). **Plafond: 40 parcelles à toi.**
- **On les pose avec le cordeau**, nouvel outil de la barre: un clic pose une parcelle, un clic maintenu trace un rectangle d'un coup. On les pose sur **la terre du garde-barrière**: le pré du jardin (100 cases posables) et la friche une fois défrichée (48 cases).
- **On les reprend** avec le cordeau (clic droit ou X): une parcelle vide part tout de suite; une parcelle qui porte une culture se reprend en maintenant 0,6 s, et **rien ne se perd**: une culture mûre est récoltée, une culture qui pousse rend sa graine.
- **Un seul système** avec la carte agrandie: la friche est de la terre à toi qui s'ouvre en défrichant; les carrés à louer des jardins de la Rive sont des parcelles louées, fixes, comptées à part (lot P6); les champs du Haut attendent les cultures de plein champ (hors 0.13).
- **Sauvegarde 0.12**: les 12 carrés deviennent 12 parcelles posées au même endroit, cultures comprises; le duo possède 12 parcelles, reçoit ses deux cordeaux et trouve 10 parcelles en rayon chez Odette.
- **Équilibrage**: avec l'offre d'Odette (le prix baisse quand on lui vend beaucoup du même légume), une heure de potager rapporte 28 à 51 aubrins l'heure de jeu active selon le nombre de parcelles et les débouchés, entre le bois (29) et les poules (59 à 97). Le potager devient la première source par jour (il grandit), mais la parcelle de plus rapporte de moins en moins au-delà de 20, et au-delà de 40 elle ne rapporte plus rien chez Odette: c'est le plafond.

## 1. Intention

| | |
|---|---|
| Ce que ça change pour le duo | Le potager devient un projet commun qu'on dessine: où mettre les carottes, laisser un passage, garder le coin de la chèvre, aller vers le bief pour arroser plus vite. On le voit grandir chaque jour. |
| Pourquoi c'est meilleur à deux | On se répartit naturellement: l'un achète chez Odette ou défriche, l'autre pose et bêche; on discute du plan à voix haute (« plutôt le long de la haie »). Les deux cordeaux posent dans le même compteur, et le gros achat (4 parcelles, 120 aubrins) passe par l'accord de l'autre comme tout achat de plus de 100. |
| Lisibilité en une minute | Un compteur « 8/10 » (posées sur possédées), un aperçu vert ou rouge sous la souris, une vignette chez Odette avec « en rayon ×4 ». |
| Équité entre les deux joueurs | Rien n'est personnel: parcelles, compteur et rayon sont au duo. Défricher ou acheter mènent au même résultat: le joueur qui préfère l'effort ou celui qui gère la bourse contribuent autant. |

## 2. Les règles

### 2.1 La parcelle

- **Une parcelle est une case de 1 m** du potager, exactement le carré à sillons d'aujourd'hui (`GardenCell`): mêmes états (herbe piquetée, terre bêchée, arrosée), mêmes gestes (bêcher, semer, arroser, récolter), une culture à la fois.
- **Pourquoi une case et pas un bloc**: c'est l'unité que le client voit et compte (« 12 carrés »), la plus fine pour dessiner librement (une rangée le long d'une haie, un L autour du poulailler), et le tracé au cordeau rend la pose en quantité aussi rapide qu'un bloc. Un bloc de 2 x 2 aurait fait 6 parcelles = 24 cases, plus que les 12 d'aujourd'hui, à rebours de la demande.
- **Identité**: chaque parcelle garde un numéro stable (`index`, jamais réutilisé, `world.plots.nextIndex`), pour les intentions des robots (`recolter:<index>`) et les tests. Le sens « 0 à 11 » du commentaire de `GardenCell.index` disparaît.
- **Sorte** (`kind`): `own` (à toi, posée au cordeau, compte dans le compteur) ou `rented` (louée, fixe, comptée à part: section 2.9). Une parcelle `own` est la valeur par défaut, omise dans l'état transmis.

### 2.2 Le compteur

- **Possédées** = parcelles de départ + achetées + offertes par la friche, au plus 40 (`max`).
- **Posées** = parcelles `own` présentes sur la carte. Toujours posées ≤ possédées.
- Le compteur affiche **posées/possédées** (« 8/10 »). Une parcelle reprise redevient libre: le compteur passe à « 7/10 », on peut la reposer ailleurs, autant de fois qu'on veut, sans frais.
- On ne perd jamais une parcelle possédée: ni en la reprenant, ni à la saison, ni à la reprise d'une sauvegarde.

### 2.3 En gagner

**Le rayon d'Odette (l'argent).**

| Règle | Valeur |
|---|---|
| Où | comptoir d'Odette, vignette « Parcelle » au rayon des graines (les bordures que Basile taille le soir et laisse en dépôt chez elle) |
| Prix | 30 aubrins la parcelle, fixe |
| Rayon | 2 au départ d'une partie neuve; 2 de plus chaque matin à l'aube, 10 au plus en rayon |
| Achat | « Acheter 1 » ou « Acheter 4 » (s'il en reste moins, on prend ce qu'il y a); acheter 4 coûte 120, au-dessus du seuil des gros achats (100): l'autre joueur valide d'abord, comme pour tout gros achat |
| Effet | le compteur monte tout de suite (« 8/10 » devient « 8/11 »); rien n'entre dans le sac |
| Plafond atteint | la vignette affiche « 40/40 » barré et le bouton est grisé; le rayon continue de se remplir sans servir |

Pourquoi un rayon qui se remplit: la croissance est **linéaire dans le temps** (au plus 2 par jour en moyenne), comme le demande le client, et **rattrapable** (10 en rayon: trois jours sans passer chez Odette ne font rien perdre). Pourquoi un prix fixe: chaque parcelle coûte la même chose, la progression reste lisible et linéaire aussi en argent. Pourquoi 30: les premières parcelles se remboursent en moins d'une semaine, les suivantes en deux à trois semaines (section 6), assez pour que l'achat se pense sans jamais être un piège.

**La friche (l'effort).**

| Règle | Valeur |
|---|---|
| Où | les 48 cases de friche du garde-barrière (`wild_plot_01` à `_04`, carte 0.13, x -8 à -1, y 29 à 31 et 33 à 35), à 4 s de la porte |
| Geste | la houe sur une case de friche: « Défricher », un geste de 1,2 s, 3 points d'endurance (FE-01) |
| Effet | la case devient de l'herbe (terre à toi, posable); toutes les 4 cases défrichées par le duo, **+1 parcelle possédée** (12 au plus, puisque 48 cases) |
| Plafond | les parcelles offertes comptent dans les 40; au plafond, défricher ouvre encore de la place mais n'offre plus rien (la pastille « +1 » ne vole plus) |
| Ce qu'on ne fait pas | on ne pose pas sur une case de friche non défrichée (aperçu rouge, icône de la houe) |

Pourquoi deux sources: c'est une **aide réglable sans le dire**. Un duo qui gagne peu d'argent, ou qui préfère l'effort, obtient 12 parcelles par la sueur; un duo qui préfère gérer la bourse les achète. Et la friche a enfin une raison d'être: elle borde le bief, une eau à portée pour arroser un grand potager (point de puisage proposé, section 8, lot P5).

**Plafond: 40 parcelles possédées** (`max`). Raisons, mesurées (section 6): au-delà de 40, la parcelle de plus ne rapporte plus rien chez Odette, même en cuisinant (son budget du jour est plein); et 40 parcelles demandent déjà environ 230 minutes de jeu de soins par jour (2,7 minutes réelles d'un joueur sur une journée de 12,6), assez pour une activité parmi d'autres. Réglage: le passer à 60 si le client veut aller plus loin (question 2).

### 2.4 Où poser: la terre du garde-barrière

**La terre à toi** est ce qui revient à la maisonnette du garde-barrière, côté jardin:

| Terre | Où | Cases posables | Pourquoi |
|---|---|---|---|
| Le pré du jardin (zone neuve `garden_land`) | x 1 à 15, y 28 à 35: entre la haie (x 0), le chemin de la maisonnette (y 27), la clôture de la rive (y 36) et la route du gué (x 17) | <!-- terre_pre -->100 | c'est la réserve du potager prévue depuis la démo (`garden_extension_reserved`, que cette zone remplace), devant la porte, au tonneau |
| La friche, une fois défrichée | x -8 à -1, y 29 à 31 et 33 à 35 (allée y 32) | <!-- terre_friche -->48 | « le grand potager du duo pousse vers l'ouest » (carte 0.13), au bord du bief |

**Cases interdites**, avec leur raison (l'aperçu dit laquelle, section 5):

| Interdit | Cases | Pourquoi | Icône et mot |
|---|---|---|---|
| Hors de ta terre | tout ce qui n'est ni le pré du jardin ni la friche défrichée: chemins, place, rue, autour de la maison (`house_plan_reserved`, où se bâtissent le cellier et la chambre), entre la maison et la route (chevrerie, tonneau, banc, réverbère, boîte aux lettres) | la terre du garde-barrière s'arrête là; le reste est au bourg ou à la Compagnie | clôture barrée, « Hors de ta terre » |
| Objet ou chantier | poulailler (et son agrandissement, même emprise), botte de paille (12, 28), rocher (3, 33), toute emprise d'objet ou de chantier déclaré dans la carte, même pas commencé | on ne cultive pas sous un objet; un chantier futur garde sa place | caisse barrée, « Déjà pris » |
| Le coin des poules | zone `hen_pen` (x 13 à 16, y 31 à 34): mangeoire, porte du poulailler | les poules picorent là: elles mangeraient les semis | poule, « Le coin des poules » |
| La chèvre broute ici | le cercle de corde (2,5 m) autour du piquet où une chèvre est attachée en ce moment | elle brouterait la parcelle | chèvre, « La chèvre broute ici » |
| Friche pas encore défrichée | une case de friche | les ronces d'abord | houe, « Défriche d'abord » |
| Déjà une parcelle | une case qui porte déjà une parcelle, à toi ou louée | | parcelle, « Déjà une parcelle » |
| Un objet au sol | une case où traîne un objet posé (pile tombée d'un sac, panier) | on ramasse d'abord | main, « Ramasse d'abord » |
| Plus de parcelle libre | posées = possédées | | compteur « 10/10 » barré, « Plus de parcelle libre » |

Ce qui reste permis: poser sous un personnage (les parcelles se traversent à pied, comme aujourd'hui); poser contre une autre parcelle (les bordures se touchent, comme les 12 carrés).

**La chèvre et le pré.** Trois des cinq places de pâture (`goat_graze_03` à `_05`) sont dans le pré du jardin; leurs cercles de corde couvrent <!-- terre_hors_chevre -->35 cases hors cercles sur 100. Règle: **une place dont le cercle touche une parcelle ne reçoit plus le piquet** (refus « Elle mangerait le potager », icône chèvre et parcelle); la chèvre broute ailleurs. Pour qu'il reste toujours de quoi brouter frais (`freshDays` 2), le level designer ajoute **deux places de pâture hors de la terre cultivable**, à moins de 10 m de la chevrerie (lot P5). Ainsi le duo choisit: un grand potager dans le pré, ou le pré laissé à la chèvre et le potager à la friche.

### 2.5 Poser: le cordeau

**Le cordeau** (`garden_line`) est un outil, comme la houe et l'arrosoir: une bobine de bois, sa ficelle et deux piquets. Chaque joueur en a un (`startingInventory.eachPlayer`). On le prend dans la barre (molette, ou son chiffre).

| Entrée | Effet, cordeau en main |
|---|---|
| Souris, survol | l'aperçu d'une parcelle suit la case sous le pointeur, sur ta terre; hors de ta terre, l'aperçu reste devant le personnage (comme les meubles, R11) |
| Clic gauche | pose une parcelle sur la case visée, si l'aperçu est vert |
| Clic gauche maintenu et glissé | trace un rectangle de la case du clic à la case sous le pointeur; au relâché, pose toutes les cases vertes, dans la limite des parcelles libres, en partant du coin du clic, rangée par rangée |
| Clavier: Espace | pose une parcelle sur la case devant le personnage |
| Clic droit, ou X | reprend la parcelle visée (section 2.6) |
| Clic droit maintenu et glissé | trace un rectangle de reprise: au relâché, reprend les parcelles vides du rectangle; celles qui portent une culture clignotent et restent |

Poser ne coûte **ni endurance ni temps de geste** (on plante deux piquets et on tend la ficelle: 0,3 s d'animation, la marche n'est pas bloquée au-delà). Une parcelle posée naît **en herbe piquetée** (`soil: grass`) et se bêche à la houe comme aujourd'hui (2 points d'endurance, une fois: elle reste bêchée après chaque récolte). Garder le bêchage, c'est garder le geste que le joueur connaît et le coût d'endurance qui fait d'un grand potager un vrai travail.

Partie neuve: les **6 parcelles de départ sont posées** en 3 x 2 devant la porte (x 7 à 9, y 28 et 29, centré sur la porte en x 8), en herbe piquetée: la première quête (« semer une graine ») marche telle quelle. Le cordeau arrive dans la barre de chaque joueur dès le départ, avec la houe et l'arrosoir.

### 2.6 Reprendre, déplacer

| Parcelle visée | Ce que fait la reprise | Retour |
|---|---|---|
| En herbe piquetée, ou bêchée sans culture | reprise tout de suite | les piquets sautent, la terre redevient herbe, petit bruit de motte; compteur « 7/10 » |
| Avec une culture qui pousse | il faut **maintenir** le clic droit ou X 0,6 s (un anneau se remplit autour du pointeur); relâcher avant annule. La culture est arrachée et **rend sa graine** (FE-03, 100 %) | la graine vole vers le sac (« +1 » sur l'icône de la graine) |
| Avec une culture mûre | même maintien de 0,6 s; la culture est **récoltée** comme par la récolte (même qualité: belle si arrosée chaque jour) | la récolte vole vers le sac |

- Si le sac est plein, la graine ou la récolte va au coffre de la maisonnette (comme les piles qui débordent aujourd'hui), avec la pastille du coffre; jamais au sol, jamais perdue.
- **Déplacer** = reprendre puis reposer. Une culture ne se transplante pas (version 1): la reprendre en cours de pousse rend la graine et perd les jours de pousse, et le maintien de 0,6 s rend ce choix toujours volontaire. Transplanter avec la motte est un bonus pour plus tard (section 9).
- Une parcelle reprise par l'autre joueur alors qu'elle portait une culture: le joueur qui l'avait semée voit une petite notification imagée (le jeton de l'autre, l'icône de la parcelle, « −1 » et la graine rendue). Pas de reproche, une information: on en parle dans la pièce.
- Reprendre n'enlève jamais une parcelle louée (refus « Carré loué », section 2.9) ni une parcelle de la friche non défrichée (il n'y en a pas).

### 2.7 À deux, simultanéité, pause, déconnexion

| Cas | Règle |
|---|---|
| Deux joueurs posent sur la même case au même pas | l'hôte traite les intentions dans l'ordre reçu: la première pose, la seconde reçoit le refus « Déjà une parcelle » (aperçu qui tremble), comme « Déjà pris par... » (SI-01) |
| Deux joueurs posent la dernière parcelle libre au même pas | la première l'obtient; la seconde voit le compteur « 10/10 » barré |
| Un rectangle tracé dépasse les parcelles libres | les cases en trop restent en pointillé barré dans l'aperçu; au relâché, seules les premières (rangée par rangée depuis le coin du clic) sont posées |
| Un joueur reprend une parcelle que l'autre arrose ou récolte au même pas | l'ordre de l'hôte tranche: si la récolte passe d'abord, la reprise trouve une parcelle vide; si la reprise passe d'abord, la récolte voit « Déjà pris par... » |
| Pause de la plateforme | la simulation est arrêtée: un tracé en cours est abandonné, rien n'est posé |
| Déconnexion d'un joueur | ses tracés en cours sont abandonnés; ce qu'il a déjà posé reste; le compteur est au duo |
| Nuit, retour de minuit | aucun effet; les parcelles restent où elles sont |
| Hiver (après la limite actuelle de la partie) | on pose et on reprend comme en toute saison; semer reste refusé hors saison (règle existante) |
| La chèvre est menée au piquet sur une place dont le cercle touche une parcelle | refus « Elle mangerait le potager »; les autres places restent possibles |
| On pose dans le cercle de la place où une chèvre est attachée | refus « La chèvre broute ici »; une fois la chèvre rentrée (20 h) ou menée ailleurs, la case redevient posable |
| Validation | l'invité envoie des intentions (`plot_place`, `plot_remove`, liste de cases); l'hôte valide chaque case avec les règles de 2.4 et 2.6, l'aperçu de l'invité n'est qu'une prévision |

### 2.8 Autour du potager

| Système | Ce qui change |
|---|---|
| Commandes du samedi (`order.generated.resources.garden`) | la ressource du potager n'est plus fixe (54 cases-jours = 12 cases x 6 jours x 75 %): elle vaut **4,5 cases-jours par parcelle possédée ou louée**, au plus 24 parcelles comptées (108 cases-jours), calculée au tirage de la commande. Avec 12 parcelles, on retrouve 54. Les deux commandes écrites (jours 8 et 15) tiennent avec 6 parcelles (12 radis et 3 laitues en une semaine: 4 + 3 cases) |
| Pluie | arrose toutes les parcelles bêchées, à toi ou louées (règle existante, sur la liste) |
| Poules | elles restent dans `hen_pen` (code actuel): aucune parcelle n'y est posable |
| Robots de test | ils achètent une parcelle quand le rayon en a et que la bourse dépasse 300, la posent sur la case libre de la terre la plus proche de la porte, et défrichent le matin s'il reste de la friche (lot P4); les tests qui épinglent une bourse se recalent |
| Quêtes, annonces, envies | aucune ne demande plus de légumes que 6 parcelles n'en donnent en une semaine (vérifié: au plus 6 radis, 4 carottes, 2 laitues) |
| Stats de fin de partie | « parcelles » (posées/possédées) peut entrer dans les stats de l'historique de Duo (bonus) |

### 2.9 Un seul système avec la carte agrandie

La section 6 de la carte 0.13 prévoit trois natures de parcelles (`defricher`, `louer`, `partage`). Elles deviennent trois façons d'avoir de la terre, dans le **même** système de parcelles d'une case:

| Lieu (carte 0.13) | Nature | Dans ce système | Lot |
|---|---|---|---|
| Friche, `wild_plot_01` à `_04` (48 cases) | `defricher` | **terre à toi** qui s'ouvre case par case en défrichant; on y pose ses parcelles `own`; 4 cases défrichées offrent 1 parcelle | P3, version 1 |
| Jardins de la Rive, carrés nord-est et sud-est (`shared_plot_02`, `_04`, 20 cases chacun) | `louer` | **parcelles louées** (`kind: rented`), posées d'office sur les 20 cases du carré le temps du bail, fixes (le cordeau les refuse), hors du compteur et du plafond (« +20 louées » en pastille à côté du compteur) | P6, bonus 0.13 |
| Jardins de la Rive, carrés nord-ouest et sud-ouest (`shared_plot_01`, `_03`) | `partage` | les carrés de Colette et d'un autre habitant: décor vivant (cultures qui changent avec les saisons), jamais posables | décor (lot L4 de la carte) |
| Champs du Haut 1 et 2 (63 cases chacun) | `louer`, sans arrosage | réservés aux cultures de plein champ (blé, pommes de terre, courges), qui n'existent pas encore: la même mécanique de location, plus tard | hors 0.13 |
| Verger communal, vigne du curé, prés du Haut | | pas des parcelles (arbres, rangs de vigne, foin) | hors de ce document |

**Location des carrés de la Rive (lot P6), règles complètes pour ne rien laisser à définir:**

| Règle | Valeur |
|---|---|
| À qui | Armand, secrétaire de mairie (les jardins de la Rive sont communaux), à la mairie-école, aux heures où il y est |
| Quand | à partir du jour 22 (premier jour de l'été, inauguration) |
| Prix | 3 aubrins par case et par semaine: 60 la semaine pour un carré de 20 |
| Bail | du jour de la location au samedi suivant 6 h, puis renouvelé chaque samedi à 6 h si la bourse a la somme; sinon le bail s'arrête |
| Rendre un carré | parler à Armand, « Rendre le carré »; la semaine en cours n'est pas remboursée |
| Fin du bail | une culture mûre est récoltée, une culture qui pousse rend sa graine, le tout au coffre de la maisonnette; une lettre d'Armand le dit en une ligne, avec l'icône du coffre |
| Eau | la pompe à bras du croisement des allées (geste à deux de `v0-13-habitants.md`: l'un pompe, l'autre tient l'arrosoir) |
| Pourquoi louer | de la place tout de suite sans acheter, au milieu des voisins (Colette y jardine le mardi), près de la pompe; c'est l'été qui s'ouvre, quand le potager à soi est souvent déjà au plafond |

## 3. Les valeurs

Proposition pour `reglages.json` (le lecteur du jeu lit par clé et ignore les clés qu'il ne connaît pas):

```json
"garden": {
  "cells": 12,
  "layout": { "w": 4, "d": 3 },
  "zone": "garden",
  "startState": "grass",
  "plots": {
    "start": 6,
    "startRect": { "x": 7, "y": 28, "w": 3, "h": 2 },
    "max": 40,
    "land": { "zone": "garden_land", "clearable": "defricher" },
    "forbiddenZones": ["hen_pen", "house_plan_reserved"],
    "price": 30,
    "shop": "grocery",
    "restockPerDay": 2,
    "stockMax": 10,
    "stockAtStart": 2,
    "stockAtMigration": 10,
    "removeHoldSeconds": 0.6,
    "clearSeconds": 1.2,
    "clearEndurance": 3,
    "clearCellsPerPlot": 4,
    "orderGardenPerPlot": 4.5,
    "orderGardenPlotsCap": 24,
    "rental": { "plots": ["shared_plot_02", "shared_plot_04"], "rentPerCellPerWeek": 3, "rentFromDay": 22, "landlord": "armand" }
  }
}
```

`cells`, `layout` et `zone` restent pour la carte de secours et les anciennes cartes (zone `garden` de 12 cases): la reprise d'une sauvegarde 0.12 lit la zone `garden` pour savoir où étaient les 12 carrés.

Types (`src/donnees/types.ts`, validés à l'exécution comme le reste des réglages):

```ts
interface GardenPlotsSettings {
  start: number;                 // entier >= 1
  startRect: Rect;               // dans la terre, start <= w x h
  max: number;                   // entier >= start
  land: { zone: string; clearable: 'defricher' };
  forbiddenZones: readonly string[];
  price: number;                 // aubrins, entier > 0
  shop: 'grocery';
  restockPerDay: number;         // entier >= 0
  stockMax: number;              // entier >= restockPerDay
  stockAtStart: number;          // entier <= stockMax
  stockAtMigration: number;      // entier <= stockMax
  removeHoldSeconds: number;     // secondes réelles
  clearSeconds: number;          // secondes réelles
  clearEndurance: number;        // points d'endurance
  clearCellsPerPlot: number;     // entier >= 1
  orderGardenPerPlot: number;    // cases-jours par parcelle
  orderGardenPlotsCap: number;   // entier
  rental: { plots: readonly string[]; rentPerCellPerWeek: number; rentFromDay: number; landlord: string } | null;
}
```

Table d'équilibrage (le script `--croise` relit la colonne Valeur):

| Clé | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| `start` | 6 | parcelles | 4 à 8 | la demande du client; assez pour la première commande (12 radis, 3 laitues en une semaine) |
| `max` | 40 | parcelles possédées | 30 à 60 | au-delà, la parcelle de plus ne rapporte plus rien chez Odette (section 6) et les soins dépassent 230 min de jeu par jour |
| `price` | 30 | aubrins par parcelle | 20 à 40 | premières parcelles remboursées en 3 à 6 jours, celles de 20 à 40 en 7 à 19 jours (vente brute ou cuisinée); à 20 c'est sans réflexion, à 40 la tranche 20 à 30 vendue brute met 26 jours |
| `restockPerDay` | 2 | parcelles par matin | 1 à 3 | linéaire et sensible: environ 7 parcelles de plus par séance de 45 minutes (3,5 journées); 1 par jour n'en donnerait que 3 ou 4 |
| `stockMax` | 10 | parcelles en rayon | 6 à 14 | trois à cinq jours sans passer chez Odette ne font rien perdre; au-delà, la croissance resterait linéaire en moyenne mais par à-coups |
| `stockAtStart` | 2 | parcelles | 0 à 4 | de quoi en acheter le premier jour, pour découvrir le cordeau tout de suite |
| `stockAtMigration` | 10 | parcelles | 4 à 10 | une partie reprise rattrape d'un coup ce qu'elle aurait pu acheter (section 4) |
| `removeHoldSeconds` | 0,6 | secondes réelles | 0,4 à 1 | arracher une culture est un choix: assez long pour ne pas le faire par erreur, assez court pour ne pas agacer |
| `clearSeconds` | 1,2 | secondes réelles | 0,8 à 1,6 | plus lourd que bêcher (0,4 à 0,8 s): les ronces résistent |
| `clearEndurance` | 3 | points par case | 2 à 4 | FE-01 du cahier |
| `clearCellsPerPlot` | 4 | cases défrichées par parcelle offerte | 3 à 6 | 12 points d'endurance par parcelle offerte, soit environ un sixième de la journée d'un joueur: l'effort vaut à peu près le prix d'une parcelle |
| `orderGardenPerPlot` | 4,5 | cases-jours par parcelle | 4 à 5 | 6 jours x 75 % d'occupation, la règle du tour 8; 12 parcelles redonnent les 54 d'aujourd'hui |
| `orderGardenPlotsCap` | 24 | parcelles | 16 à 30 | la commande grandit avec le potager jusqu'au double d'aujourd'hui, pas au-delà: elle reste une commande, pas un débouché sans fond |
| `rentPerCellPerWeek` | 3 | aubrins par case et par semaine | 2 à 4 | un carré de 20 coûte 60 la semaine: posséder les mêmes 20 parcelles coûte 600, la location revient au même en dix semaines |
| `rentFromDay` | 22 | jour de jeu | 16 à 29 | l'été et l'inauguration ouvrent le bourg; le potager à soi est alors souvent au plafond |

Un réglage hors de `garden`, recommandé (petit code dans le comptoir): **`economy.grocer.categoryCap.crop` = 250**, au plus 250 aubrins de légumes bruts payés par Odette chaque jour, sur son budget de 400. Raison: avec 40 parcelles vendues brutes, les légumes prennent déjà <!-- recette_40 -->246 aubrins de ses 400; sans garde-fou, au-delà de 40, ils mangeraient tout son budget et les œufs, les poissons ou les conserves du même jour ne se vendraient plus. Avec ce plafond, les autres activités gardent au moins 150 aubrins de place chaque jour chez Odette; les plats (soupe, croque-au-sel) n'y sont pas soumis, la cuisine reste le débouché des grands potagers. Le marché du dimanche, l'ardoise et les commandes ne changent pas.

## 4. Reprise d'une sauvegarde 0.12

Format de sauvegarde: le premier format libre après ceux de la 0.13 (15 si aucun autre lot ne l'a pris avant). Migration `migrateToPlots`, dans l'ordre des migrations:

1. **Les 12 carrés deviennent 12 parcelles posées au même endroit.** Chaque `GardenCell` de `world.garden` garde sa case, son sol, son état mouillé, sa culture (jours, stade, belle ou non, semée par, jour de semis) et sa dernière récolte; il reçoit `kind: own` (omis) et garde son `index` (0 à 11). `world.plots.nextIndex` vaut 12.
2. **Possédées: 12** (`world.plots.base` = le plus grand de 12 et de `start`), achetées 0, friche défrichée vide. Le compteur affiche « 12/12 ».
3. **Rayon d'Odette: 10** (`stockAtMigration`), dernier réapprovisionnement au jour en cours: une partie avancée peut rattraper tout de suite ce qu'une partie neuve aurait acheté peu à peu.
4. **Deux cordeaux**: un par joueur, dans la première case libre de sa barre, sinon de son sac, sinon au coffre de la maisonnette (avec la pastille du coffre). Une astuce à la première aube: « Ton potager est libre: prends le cordeau pour poser ou déplacer tes parcelles. »
5. **Les cases restent valides**: les 12 cases (x 7 à 10, y 28 à 30) sont dans le pré du jardin, sans objet ni zone interdite (vérifié dans la carte 0.13). Règle générale quand même: une parcelle migrée sur une case devenue interdite reste où elle est et fonctionne; on peut la reprendre, pas la reposer là.
6. Sur la carte 0.13, les 12 cases de terre `p` deviennent de l'herbe (`.`): sous une parcelle reprise, on retrouve le pré, pas un rectangle de terre nue. La zone `garden` reste (rect de départ des anciennes sauvegardes et de la carte de secours).

Le joueur n'y perd rien: mêmes cultures aux mêmes places, 12 parcelles à lui au lieu des 6 d'une partie neuve, 10 à acheter tout de suite. Une sauvegarde d'une version de développement 0.13 sans parcelles (format 14) suit la même migration.

## 5. L'interface en images

Selon `interface-imagee-0-12-2.md`: une icône et un nombre plutôt qu'une phrase, une ligne au plus, couleur jamais seule, clavier et souris complets, animations coupées par la réduction des animations.

### 5.1 Le mode « poser une parcelle » (cordeau en main)

```text
   pré du jardin, vu par la caméra
   +---+---+---+---+
   | ▓ | ▓ | ▓ |   |      ▓ parcelle posée (bordure de bois, sillons)
   +---+---+---+---+      ░ aperçu vert: ficelle tendue entre quatre piquets fantômes
   | ▓ | ▓ | ░ |   |      X aperçu rouge: contour hachuré, croix, icône de la raison au-dessus
   +---+---+---+---+
   |   |   | XP|   |      P icône de la raison (ici le coin des poules)
   +---+---+---+---+
                         [ bobine ] 8/10   au-dessus de la barre d'outils
```

- **Aperçu vert**: une parcelle fantôme à la case visée (même modèle que la parcelle en herbe piquetée, translucide), ficelle claire, piquets qui oscillent légèrement. Contour plein.
- **Aperçu rouge**: même fantôme teinté, **contour hachuré et croix** (la couleur n'est jamais seule), et au-dessus l'icône de la raison (clôture barrée, caisse, poule, chèvre, houe, parcelle, main, compteur barré) avec un mot court au survol et pour le lecteur d'écran (`aria-live` poli): textes en 5.4.
- **Rectangle tracé**: les cases qui seront posées en vert plein, numérotées par l'ordre de pose seulement au survol long (pas de chiffres à l'écran sinon); les cases interdites en rouge hachuré; les cases en trop (au-delà des parcelles libres) en **pointillé barré**. À côté du pointeur, la pastille du compteur prévisionnel: « +5 » vert, ou « +7 » barré avec « 10/10 » si ça dépasse.
- **Reprise au clic droit maintenu** sur une culture: un anneau se remplit autour du pointeur en 0,6 s, avec l'icône de ce qui reviendra (la graine, ou la récolte).
- La caméra ne change pas en mode cordeau: la molette change d'outil (règle existante), le zoom reste à R et F.

### 5.2 Le compteur

- **Cordeau en main**: au-dessus de la barre d'outils, une bobine dessinée et « 8/10 » en gros (posées/possédées). Au plafond, « 40/40 » avec un petit cadenas doré (l'icône du plafond, pas un manque).
- **Sur la case du cordeau dans la barre**: une pastille « 2 » = parcelles libres à poser, visible même sans le tenir (on sait qu'il en reste à poser). Pas de pastille à 0.
- **Parcelles louées** (lot P6): pastille « +20 » à côté du compteur, avec l'icône d'un écriteau.
- Quand une parcelle s'ajoute (achat, défrichage), la pastille « +1 » vole de l'endroit où elle naît (le comptoir, la case défrichée) jusqu'au compteur, qui rebondit (`transform` seulement).

### 5.3 Le comptoir d'Odette

Une vignette de plus dans la vitrine du comptoir, au rayon des graines:

| Élément | Contenu |
|---|---|
| Dessin | une parcelle bordée de planches avec ses deux piquets et la ficelle (icône de l'artiste 2D, `ui-plot`) |
| Pastilles | prix (pièce « 30 »), « en rayon ×4 » (icône du rayon), compteur « 8/10 » |
| Détail (à la sélection) | nom « Parcelle », une ligne « Une case de plus pour ton potager. », les pastilles, puis Acheter 1, Acheter 4 (ou « Proposer à l'autre » pour un gros achat) |
| Rayon vide | vignette grisée, pastille « en rayon ×0 » barrée, et la lune (« demain ») en marque: elle revient à l'aube |
| Plafond | pastille « 40/40 » barrée, boutons grisés |
| Animation | la pièce vole de la bourse à la vignette (existant), puis la pastille « +1 » part vers le coin du compteur |

### 5.4 Textes du jeu (tutoiement, une ligne)

| Clé | Texte |
|---|---|
| objet `garden_line` | nom « cordeau », pluriel « cordeaux », « un cordeau »; description « Tends-le pour tracer tes parcelles. » |
| produit `plot` | nom « parcelle », pluriel « parcelles », « une parcelle »; description « Une case de plus pour ton potager. » |
| `placement_plot_outside` | « Hors de ta terre. » |
| `placement_plot_occupied` | « Déjà pris. » |
| `placement_plot_hens` | « Le coin des poules. » |
| `placement_plot_goat` | « La chèvre broute ici. » |
| `placement_plot_friche` | « Défriche d'abord. » |
| `placement_plot_exists` | « Déjà une parcelle. » |
| `placement_plot_ground_item` | « Ramasse d'abord. » |
| `placement_plot_none` | « Plus de parcelle libre. » |
| `plot_rented_locked` | « Carré loué. » |
| `goat_stake_plots` | « Elle mangerait le potager. » |
| astuce `plot_free` (une parcelle libre, cordeau pas en main) | « Une parcelle t'attend: prends le cordeau et pose-la sur l'herbe du jardin. » |
| astuce `plot_drag` (première prise du cordeau à la souris) | « Clic maintenu: trace plusieurs parcelles d'un coup. » |
| astuce `plot_remove` (première parcelle posée) | « {examine} sur une parcelle: tu la reprends. » |
| astuce `plot_clear` (première approche de la friche, houe en main) | « Quatre cases défrichées, une parcelle de plus. » |
| astuce `plot_migration` (reprise d'une 0.12) | « Ton potager est libre: prends le cordeau pour poser ou déplacer tes parcelles. » |
| réplique d'Odette, première fois que le rayon est plein (priorité datée, une seule fois) | « Basile me laisse des bordures de carré. Il en taille deux par soir: elles t'attendent ici. » |
| lettre d'Armand, fin de bail (P6) | « Le carré de la Rive est rendu. Ce qui poussait t'attend au coffre. » |

Aucune de ces phrases ne dit « chacun » ni « tous les deux », aucune ne s'accorde au genre du joueur. Les astuces citent les touches par jeton (`{examine}`), le clic est écrit en toutes lettres (souris).

### 5.5 Chaque action a son retour

| Action | Visuel | Son |
|---|---|---|
| Poser une parcelle | deux piquets plantés, ficelle tendue d'un coup sec, petite poussière | deux « toc » de maillet et une corde pincée (grave et court) |
| Poser un rectangle | les parcelles apparaissent en vague, rangée par rangée (40 ms d'écart, coupé par la réduction des animations) | un « toc » par rangée, pas par case |
| Refus | le fantôme tremble, l'icône de la raison grossit un instant | « tut » doux, le même que les autres refus de pose |
| Reprendre une parcelle vide | piquets arrachés, motte qui retombe, l'herbe revient | « plop » mat |
| Reprendre avec culture | anneau de 0,6 s, puis la graine ou la récolte vole vers le sac | froissement de feuilles, puis le son de la récolte existant |
| Défricher | les ronces tremblent et disparaissent dans une bouffée de feuilles; la case devient herbe | froissement et craquement de tiges |
| Parcelle offerte (4e case) | pastille « +1 » qui vole vers le compteur, compteur qui rebondit | petit carillon (celui des quêtes, plus court) |
| Acheter chez Odette | pièce qui vole (existant), « +1 » vers le compteur | tintement de la caisse (existant) |
| L'autre a repris ma parcelle semée | notification imagée: jeton de l'autre, parcelle « −1 », graine rendue | aucun (un son n'est jamais secret dans la pièce, et ce n'est pas une alerte) |

## 6. Équilibrage

Calcul: `python3 -I docs/jeux/jeu-1/simulations/parcelles_0_13.py`. Valeurs d'Odette (prix de vente x 0,8, unité ordinaire, saison neutre), **avec l'offre d'Odette** (chaque légume perd jusqu'à 40 % de son prix quand on lui en vend beaucoup, la moitié s'oublie chaque matin) et son budget du jour, nettes des graines. Le meilleur partage entre radis, laitues et carottes est cherché exhaustivement. Pluie 28 % des jours (on n'arrose pas). Une heure de jeu = 42 s réelles. Gestes: 2 s par geste sur une parcelle, 8 s par remplissage d'arrosoir (10 parcelles), 30 s par jour pour le détour chez Odette, 7 s par fournée au réchaud. Garde-fou des légumes (250 par jour) compris.

### 6.1 Ce que rapporte le potager

| Parcelles | Net par jour, tout vendu brut | Temps actif par jour (min de jeu) | Par heure de jeu active, brut | Net par jour avec soupe et croque-au-sel | Par heure active, cuisiné | Budget d'Odette pris (sur 400), brut; cuisiné |
|---|---|---|---|---|---|---|
| 6 | <!-- net_6 -->35,4 | <!-- min_6 -->75 | <!-- heure_6 -->28,3 | <!-- netc_6 -->50,9 | <!-- heurec_6 -->30,1 | <!-- recette_6 -->52; <!-- recettec_6 -->68 |
| 12 | <!-- net_12 -->63,2 | <!-- min_12 -->110 | <!-- heure_12 -->34,5 | <!-- netc_12 -->106,7 | <!-- heurec_12 -->42,1 | <!-- recette_12 -->97; <!-- recettec_12 -->142 |
| 20 | <!-- net_20 -->88,4 | <!-- min_20 -->142 | <!-- heure_20 -->37,4 | <!-- netc_20 -->158,9 | <!-- heurec_20 -->50,5 | <!-- recette_20 -->145; <!-- recettec_20 -->217 |
| 30 | <!-- net_30 -->103,8 | <!-- min_30 -->190 | <!-- heure_30 -->32,8 | <!-- netc_30 -->201,6 | <!-- heurec_30 -->46,1 | <!-- recette_30 -->191; <!-- recettec_30 -->290 |
| 40 (plafond) | <!-- net_40 -->128,2 | <!-- min_40 -->229 | <!-- heure_40 -->33,6 | <!-- netc_40 -->235,4 | <!-- heurec_40 -->44,3 | <!-- recette_40 -->246; <!-- recettec_40 -->350 |
| 50 (au-delà du plafond, pour voir) | <!-- net_50 -->113,0 | <!-- min_50 -->298 | <!-- heure_50 -->22,7 | <!-- netc_50 -->255,6 | <!-- heurec_50 -->36,9 | <!-- recette_50 -->248; <!-- recettec_50 -->400 |

Sans le garde-fou des légumes: 40 parcelles <!-- sansgf_net_40 -->129,4 brut et <!-- sansgf_netc_40 -->235,4 cuisiné; 50 parcelles <!-- sansgf_net_50 -->157,0 brut et <!-- sansgf_netc_50 -->255,6 cuisiné (le budget d'Odette est alors plein: 400).

Pour relier au tableau de l'économie 0.12.2 (qui compte au prix de base, sans baisse de l'offre): 12 cases de carottes y font 79 aubrins par jour et 92 l'heure active. L'offre d'Odette en retire près d'un quart dès 12 parcelles, et le détour quotidien par son comptoir pèse sur l'heure active.

### 6.2 Comparé aux autres activités

Mêmes unités, tableau de `economie-chaines-0-12-2.md` (section 4), au prix de base:

| Activité | Net par jour (plafond) | Par heure de jeu active |
|---|---|---|
| **potager, 6 parcelles** (brut; cuisiné) | 35; 51 | 28; 30 |
| **potager, 12 parcelles** | 63; 107 | 35; 42 |
| **potager, 20 parcelles** | 88; 159 | 37; 51 |
| **potager, 30 parcelles** | 104; 202 | 33; 46 |
| **potager, 40 parcelles** | 128; 235 | 34; 44 |
| poules nourries (5); soignées | 25; 41 | 97; 59 |
| bois (2 arbres par jour, en planches) | 77 | 29 |
| plis de Lucie | 29 | 20 |
| cueillette | 26 à 30 | 17 à 20 |
| chèvre, lait; en fromage | 14; 22 | 16; 21 |
| pêche | sans plafond | 10 à 14 |

**Lecture.**

- **À l'heure active, le potager est au milieu**: au-dessus du bois, des plis, de la cueillette, de la chèvre et de la pêche, au-dessous des poules. Il ne domine pas les autres activités (règle de l'économie: aucune ne domine toutes les autres à la fois par jour et par heure active): les poules le battent à l'heure, la pêche reste la seule activité sans plafond.
- **Par jour, il devient la première source**, et c'est la demande du client: cultiver vite en quantité. Ce qui l'empêche de devenir la seule activité rentable: (1) la parcelle de plus rapporte de moins en moins (6.3), car Odette paie moins quand on lui vend beaucoup du même légume; (2) au plafond, les soins prennent 229 minutes de jeu par jour, soit 2,7 minutes réelles d'un joueur sur 12,6: le reste de la journée va ailleurs; (3) le garde-fou des légumes laisse au moins 150 aubrins par jour chez Odette aux œufs, aux poissons, aux conserves; (4) la cuisine (soupe, croque-au-sel) double presque le gain d'un grand potager: elle fait travailler le réchaud et l'autre joueur, ce que veut la règle des chaînes.
- **À 6 parcelles, le début est plus maigre qu'en 0.12** (35 au lieu de 63 par jour, brut): c'est voulu par la demande, et rattrapé en trois jours par un duo médian (6.4).

### 6.3 La parcelle de plus, et son prix

Gain net par jour d'une parcelle de plus, et en combien de jours elle se rembourse à 30 aubrins:

| Tranche | Gain par jour, brut | Remboursée en (jours) | Gain par jour, cuisiné | Remboursée en (jours) |
|---|---|---|---|---|
| 6 à 12 | <!-- marg_6_12 -->4,64 | 6 | <!-- margc_6_12 -->9,30 | 3 |
| 12 à 20 | <!-- marg_12_20 -->3,15 | 10 | <!-- margc_12_20 -->6,54 | 5 |
| 20 à 30 | <!-- marg_20_30 -->1,54 | 19 | <!-- margc_20_30 -->4,27 | 7 |
| 30 à 40 | <!-- marg_30_40 -->2,44 | 12 | <!-- margc_30_40 -->3,38 | 9 |
| 40 à 50 | <!-- marg_40_50 -->-1,52 | jamais | <!-- margc_40_50 -->2,02 | 15 |

La tranche 20 à 30 rapporte moins que la suivante en vente brute: c'est là que les trois légumes atteignent ensemble le plancher d'Odette; ensuite chaque carotte de plus se vend au plancher, un gain faible mais constant, jusqu'au garde-fou. Au-delà de 40, la vente brute perd de l'argent (graines payées, légumes refusés) et la cuisine ne rapporte plus que 2 aubrins par jour et par parcelle: **le plafond de 40 tombe là où le potager cesse de valoir sa peine**.

Prix essayés (remboursement de la parcelle de plus, brut): à 20 aubrins, 4 à 13 jours (achat sans réflexion); à 25, 5 à 16; **à 30, 6 à 19**; à 40, 9 à 26 (la tranche 20 à 30 brute devient lente, le duo prudent s'arrête à 20 et le juge cher). 30 garde l'achat attirant tout en coûtant: 1 020 aubrins pour aller de 6 à 40 (660 si on défriche toute la friche), un vrai but pour la bourse dans les trois premières semaines.

### 6.4 La croissance

Parcelles possédées selon le jour, rayon de 2 par matin (10 au plus), 30 aubrins, trois duos (hypothèses en tête du script: revenus hors potager, part dépensée ailleurs, réserve gardée, délai de remboursement accepté, friche):

| Duo | Jour 8 | Jour 22 | Jour 64 | 12 atteintes | 20 atteintes | 30 atteintes |
|---|---|---|---|---|---|---|
| prudent (vend brut, n'achète que si remboursé en 10 jours, ne défriche pas) | 20 | <!-- crois_prudent_22 -->20 | <!-- crois_prudent_64 -->20 | jour 5 | jour 8 | jamais |
| médian (cuisine, défriche 4 cases par jour) | 29 | <!-- crois_médian_22 -->40 | <!-- crois_médian_64 -->40 | jour 3 | jour 5 | jour 9 |
| pressé (cuisine, défriche 12 cases par jour) | 34 | <!-- crois_pressé_22 -->40 | <!-- crois_pressé_64 -->40 | jour 2 | jour 4 | jour 6 |

Borne du rayon seul, sans friche et en achetant tout chaque matin: 20 parcelles au jour <!-- borne_20 -->7, 30 au jour <!-- borne_30 -->12, 40 au jour <!-- borne_max -->17.

**Lecture.** La croissance est **linéaire** (2 par jour par le rayon, plus ce qu'on défriche), rapide (12 parcelles au troisième jour pour un duo médian, autant qu'en 0.12, puis 20 au cinquième), et s'arrête au plafond vers la fin de la deuxième semaine pour un duo qui joue le potager à fond. Le duo prudent s'arrête de lui-même vers 20, là où la parcelle brute se rembourse lentement. Après le plafond, l'été ouvre la location des carrés de la Rive (lot P6), et la suite du jeu (lopin des Vergers, FE-01) reprendra la croissance.

### 6.5 Taille de l'état transmis

Le potager part chez l'invité à chaque état. Un `GardenCell` complet (culture et dernière récolte) fait environ 220 octets en JSON: 12 parcelles <!-- etat_12 -->2629 octets, 30 <!-- etat_30 -->6571, 60 <!-- etat_60 -->13141, 100 <!-- etat_100 -->21901, à comparer à l'alerte de 35 Kio de l'état (format 13). **Forme compacte demandée** (lot P1, à valider par dev-reseau): une parcelle en tableau `[cx, cy, sol et mouillé en un chiffre, culture, jours, belle, semée par]`, `kind` omis s'il vaut `own`, `lastHarvest` gardé côté hôte seulement le temps du message « Déjà pris par... ». Elle fait 12 parcelles <!-- etatc_12 -->337 octets, 30 <!-- etatc_30 -->841, 60 <!-- etatc_60 -->1681, 100 <!-- etatc_100 -->2801.

## 7. Critères d'acceptation

| Id | Critère | Preuve |
|---|---|---|
| PL-01 | Partie neuve: 6 parcelles posées en x 7 à 9, y 28 et 29, en herbe; compteur 6/6; rayon d'Odette 2 | test de simulation sur `createWorld` |
| PL-02 | Chaque joueur a un cordeau dans sa barre au départ | test |
| PL-03 | Cordeau en main, poser sur une case valide du pré crée une parcelle en herbe, compteur +1 posée, sans endurance | test |
| PL-04 | Poser est refusé, avec la bonne raison (`placement_plot_*`), sur: case hors de la terre, chemin, objet (poulailler, paille, rocher), emprise d'un chantier déclaré, `hen_pen`, cercle de la place où une chèvre est attachée, friche non défrichée, parcelle existante, objet au sol, et quand posées = possédées | test paramétré, une case par raison |
| PL-05 | La terre posable de la carte 0.13 compte 100 cases dans le pré et 48 de friche (script et test sur la carte) | `parcelles_0_13.py`, test de la carte |
| PL-06 | Un rectangle tracé de N cases valides avec K parcelles libres pose min(N, K) parcelles, rangée par rangée depuis le coin du clic; les cases interdites du rectangle sont sautées | test |
| PL-07 | Reprendre une parcelle vide: elle disparaît, compteur -1 posée, possédées inchangé | test |
| PL-08 | Reprendre une parcelle avec culture demande un maintien de 0,6 s; relâché avant, rien ne change | test (durée en pas), observation |
| PL-09 | Reprendre avec culture non mûre rend la graine; avec culture mûre, donne la récolte avec sa qualité; sac plein: au coffre. Aucun cas ne perd d'objet (somme des objets avant et après) | test |
| PL-10 | Clic droit glissé: reprend les parcelles vides du rectangle, laisse celles qui portent une culture | test |
| PL-11 | Acheter 1 chez Odette: bourse -30, possédées +1, rayon -1; Acheter 4 avec 3 en rayon: 3 achetées; acheter 4 (120) demande l'accord de l'autre | test, et e2e du comptoir |
| PL-12 | Le rayon gagne 2 à chaque aube, plafonné à 10 | test sur plusieurs jours |
| PL-13 | Au plafond (40 possédées), la vignette est barrée « 40/40 », l'achat refusé, le défrichage n'offre plus rien | test, capture |
| PL-14 | Défricher une case de friche (houe): 3 d'endurance, 1,2 s, la case devient posable; à la 4e case, possédées +1; 48 cases offrent 12 parcelles | test |
| PL-15 | Une place de pâture dont le cercle touche une parcelle refuse le piquet (« Elle mangerait le potager »); les autres places restent possibles | test |
| PL-16 | Deux poses sur la même case au même pas: une seule parcelle, le second joueur reçoit le refus; dernière parcelle libre demandée par les deux: une seule posée | test `simultane` |
| PL-17 | L'invité pose et reprend par intentions; l'hôte refuse une case invalide même si l'aperçu de l'invité était vert | test réseau (hôte et invité simulés) |
| PL-18 | Reprise d'une sauvegarde 0.12 (format 14 sans parcelles): 12 parcelles aux mêmes cases avec les mêmes sols, eau, cultures et dernières récoltes; possédées 12; rayon 10; un cordeau par joueur (barre, sinon sac, sinon coffre) | test de migration sur une vraie sauvegarde 0.12 du dépôt de tests |
| PL-19 | Après reprise, sauvegarder puis recharger rend un état identique (parcelles, compteur, rayon, friche défrichée) | test aller-retour |
| PL-20 | Ressource potager de la commande générée: 4,5 x min(possédées + louées, 24); 54 avec 12 parcelles | test de `commande-generee` |
| PL-21 | Pluie: toutes les parcelles bêchées sont mouillées, où qu'elles soient | test |
| PL-22 | Le rendu affiche 40 parcelles posées et 40 louées (capacité des instances au moins 96), l'herbe et les touffes disparaissent sous une parcelle et reviennent quand on la reprend | test de rendu, capture `rendu.html` |
| PL-23 | Aperçu: vert plein ou rouge hachuré avec croix et icône de la raison; rectangle avec cases en trop en pointillé barré et pastille du compteur prévisionnel | capture examinée (quatre orientations, zoom de départ) |
| PL-24 | Compteur « posées/possédées » au-dessus de la barre quand le cordeau est en main; pastille des parcelles libres sur la case du cordeau | capture, test du modèle d'interface |
| PL-25 | Chaque action de 5.5 émet son événement (et donc son son et son effet): pose, refus, reprise, défrichage, parcelle offerte, achat | test des événements |
| PL-26 | Garde-fou d'Odette: au plus 250 aubrins de légumes bruts payés par jour; les plats et les autres familles restent payés dans la limite des 400 | test du comptoir |
| PL-27 | État transmis: 40 parcelles avec culture tiennent sous 2 Kio dans la forme compacte | test de taille (comme `taille_sauvegarde.py`) |
| PL-28 | Le script `parcelles_0_13.py --croise` ne signale aucun écart avec ce document; `economie_chaines.py` ne signale rien | sortie des scripts |
| PL-29 | Aucun texte nouveau ne contient de tiret cadratin ou demi-cadratin, ni « chacun », ni « tous les deux »; le validateur des données ne lève rien | contrôle typographique, `valider_donnees.py` |
| PL-30 | Location (lot P6): à partir du jour 22, louer un carré chez Armand coûte 60, pose 20 parcelles louées fixes (le cordeau les refuse), renouvelle chaque samedi 6 h si la bourse suffit; en fin de bail, rien n'est perdu (cultures au coffre) | test |

À tester chez le client: la sensation du tracé au cordeau à la souris sur le PC (1366 x 768, pavé tactile possible), la lisibilité de l'aperçu rouge et des icônes de raison sur l'écran du portable, et le rythme ressenti (6 au départ, 2 par jour) sur une vraie séance.

## 8. Découpage pour le développement

| Lot | Qui | Contenu | Dépend de | Taille |
|---|---|---|---|---|
| **P1** Modèle et règles | dev gameplay (simulation) | `world.plots` (`base`, `bought`, `clearedCells`, `stock`, `lastRestockDay`, `nextIndex`); `GardenCell.kind`; `index` stable; réglages `garden.plots` typés et validés; terre posable (zone `garden_land`, friche défrichée, interdits de 2.4) dans une fonction pure `plotPlacement(sim, cell)` qui rend la raison; intentions `plot_place` et `plot_remove` (listes de cases) validées par l'hôte; reprise avec rendu de graine ou récolte (sac, sinon coffre); rayon à l'aube; ressource potager de la commande; forme compacte de l'état transmis (avec dev-reseau) | rien | 1 jour |
| **P2** Cordeau et aperçu | dev gameplay 3D (rendu) et interface | objet `garden_line` (et son substitut dans `src/rendu/substituts.ts`, sinon `rendu.test.ts` échoue); aperçu de case sous le pointeur sur toute la terre (aujourd'hui `pointerCell` ne vise que les pièces); rectangle glissé, clic droit glissé, anneau de maintien; rendu dynamique des parcelles (`GARDEN_CAPACITY` 16 à 96 au moins; `vegetation.ts` et `effets.ts` lisent aujourd'hui `map.garden` fixe: lire `world.garden`); compteur et pastille de la barre; sons et effets de 5.5 | P1 | 1 jour |
| **P3** Comptoir et friche | dev gameplay, interface | vignette « Parcelle » au comptoir (produit sans objet: l'achat incrémente `bought`), rayon, plafond, gros achat; geste « Défricher » à la houe sur la friche, état des 48 cases, parcelle offerte toutes les 4 cases; rendu des ronces qui disparaissent; garde-fou `categoryCap.crop` | P1 (P2 pour les captures) | 0,5 jour |
| **P4** Reprise et robots | dev gameplay | migration `migrateToPlots` (section 4), astuces et réplique d'Odette, robots (achat, pose, défrichage), recalage des tests qui épinglent une bourse ou 12 cases | P1, P3 | 0,5 jour |
| **P5** Carte, modèles, icônes, son | level designer, artiste 3D, artiste 2D, sound designer | zone `garden_land` (x 1, y 28, 15 x 8) à la place de `garden_extension_reserved`; cases `p` du potager de la démo en herbe sur la carte 0.13; deux places de pâture hors de la terre; point de puisage au bord du bief près de la friche (case d'eau (-8, 36), joué depuis (-7, 36), à vérifier par l'outil de la carte); modèle du cordeau (bobine, ficelle, deux piquets, tenu en main) et de la parcelle en herbe piquetée; icônes `ui-plot`, bobine, raisons; sons de 5.5 | ce document | 0,5 jour par métier |
| **P6** Location des carrés de la Rive (bonus 0.13) | dev gameplay, écriture | règles de 2.9 (Armand, bail, renouvellement, fin de bail, écriteau), parcelles `rented` fixes, pastille « +20 », lettre | P1 à P4, carte 0.13 en jeu (jardins de la Rive rendus) | 0,5 jour |
| **Recette** | qa-testeur | PL-01 à PL-30, captures, séance à deux | P1 à P5 (P6 s'il est livré) | 0,5 jour |

Ordre: P1 d'abord, puis P2, P3 et P5 en parallèle, puis P4; P6 si le temps le permet. Le manager vérifie `parcelles_0_13.py --croise` et `economie_chaines.py` après chaque changement de réglage.

## 9. Périmètre

| Version 1 (0.13) | Bonus (0.13 si le temps le permet, sinon plus tard) | Hors périmètre |
|---|---|---|
| parcelles d'une case, 6 au départ, plafond 40; cordeau (clic, rectangle, reprise, maintien); rayon d'Odette; friche défrichée; terre et interdits; chèvre et poules; reprise 0.12; commande; garde-fou d'Odette; interface en images, sons | location des carrés de la Rive (P6); maintenir Espace en marchant pour poser une rangée au clavier; stats « parcelles » dans l'historique de Duo; transplanter une culture avec sa motte (geste à deux: l'un soulève, l'autre porte) | champs du Haut et cultures de plein champ; vigueur du sol et rotation (FE-05); serre (FE-01); lopin des Vergers; parcelles hors de la terre du garde-barrière; vendre une parcelle |

## 10. Questions pour le client (par le manager)

1. **Six parcelles d'une case au départ, c'est moins que les 12 carrés d'aujourd'hui.** C'est ce que tu as demandé; un duo qui achète et défriche retrouve 12 parcelles dès le troisième jour. Recommandation: garder 6, et vérifier à la séance que le début ne paraît pas trop maigre (sinon 8, une ligne de réglage).
2. **Plafond de 40 parcelles.** Au-delà, la parcelle de plus ne rapporte plus rien chez Odette et les soins dépassent 3 minutes réelles par jour (3,5 à 50 parcelles). Recommandation: 40 pour la 0.13; si tu veux aller plus loin, 60 avec un débouché de plus (la halle du marché, la commande) plutôt qu'en changeant Odette.
3. **Deux par jour chez Odette, à 30 aubrins.** Environ 7 parcelles de plus par séance de 45 minutes, et le plafond atteint vers la fin de la deuxième semaine si vous jouez le potager à fond. Recommandation: garder ce rythme; « plus lent » serait 1 par jour (le plafond vers la fin du printemps).
4. **La friche offre aussi des parcelles** (4 cases défrichées, une parcelle), en plus de faire de la place. Recommandation: oui, c'est une façon de grandir sans argent, et elle donne à la friche une raison d'être.
5. **Location des carrés de la Rive dès la 0.13 ?** Recommandation: oui si le temps le permet (lot P6, une demi-journée), à partir de l'été; sinon en 0.14, sans rien changer au reste.

Pour le manager (pas pour le client): le format de sauvegarde à prendre (15 ou suivant selon les lots de la 0.13); le garde-fou `categoryCap.crop` touche le comptoir d'Odette (à confier au même dev que P3); la forme compacte du potager dans l'état transmis est à faire valider par dev-reseau.

## Historique

- 2026-11-04: création (mission 0.13, retour R09), règles, valeurs, reprise 0.12, interface, équilibrage et script `parcelles_0_13.py`.
