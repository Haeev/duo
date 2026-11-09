# Cosy Café: les cinq adresses

| Champ | Valeur |
|---|---|
| Jeu | `cosy-cafe` (titre de travail « Cosy Café ») |
| Statut | proposition du level designer: blockouts dessinés et validés par script, à confronter au cahier des charges |
| Version | 0.1 |
| Date | 2026-11-07 |
| Rédaction | level-designer |
| Documents liés | cadrage `docs/jeux/cosy-cafe/cadrage.md` (sections 4.2 à 4.11); technique `docs/jeux/cosy-cafe/technique.md` (section 11, contraintes C1 à C18); budgets `docs/plateforme/architecture.md` (section 14); ADR 0016 (un intérieur tient dans son bâtiment) |
| Fichiers | `docs/jeux/cosy-cafe/plans/`: `construire_plans.py` (compose les plans, écrit `plans.json`, dessine les SVG et les PNG), `valider_plans.py` (contrôle `plans.json`), `eprouver_validateur.py` (éprouve le validateur sur des plans cassés exprès), dix plans `<adresse>-arrivee` et `<adresse>-maximum` en `.svg` et `.png` |

## En bref

- **Cinq adresses**, du village à Paris, chacune dessinée à l'arrivée et agrandie au maximum: Ormeval (village, le Café de la place), Mérelles (bourg, la boutique de la place de la Halle), Montaurel (ville universitaire, l'Imprimerie), Paris (le café de l'angle des Plumassiers), Paris (la Graineterie du boulevard des Horticulteurs). Lieux, rues et commerces sont inventés; aucun ne reprend un lieu connu.
- **Capacités** (places assises, intérieur + dehors), à l'arrivée puis au maximum: village 8 + 2 puis 12 + 6; bourg 11 + 0 puis 21 + 18; ville 23 + 4 puis 35 + 10; Paris quartier 18 + 6 puis 29 + 16; Graineterie 41 + 12 puis 62 + 34.
- **Une seule règle de lisibilité, vérifiée partout**: depuis chaque caisse, d'un seul regard (100 degrés), on voit le client qui paie, toute la file et la porte. La file longe un mur ou le devant du comptoir et ne passe jamais derrière; une allée de 1,20 m mène de la porte à la passe à côté de la file pleine.
- **Plafonds de l'architecte tenus** (C1 à C18): au pire 37 personnages dans le champ (bourg agrandi, un jour de marché), sur les points de vue déclarés et sur une grille d'un point par mètre jouable; présents au pire sous C2 sans compter sur un taux d'occupation (le village et le bourg agrandis sont pile au plafond, 24 et 48); files de 6 places au plus; deux niveaux au plus; dehors jouable limité à la terrasse et au trottoir.
- **Une terrasse limitée par la foule**: à l'angle des Plumassiers, vu depuis le trottoir, un second rang de terrasse ferait dépasser 40 personnages (42). Ce second rang (10 places) attend la décision de l'architecte sur la foule lointaine (option B de `technique.md`, section 4.1). À la Graineterie, les vitrines garnies du graineur laissent tenir deux rangs.
- **Contrôles**: `python3 -I docs/jeux/cosy-cafe/plans/valider_plans.py` (0 erreur sur les dix plans, 21 s) et `python3 -I docs/jeux/cosy-cafe/plans/eprouver_validateur.py` (8 cas cassés sur 8 détectés). Sortie complète en annexe.

## 1. Normes d'aménagement communes

Toutes les adresses sont dessinées avec les mêmes tailles, pour qu'un comptoir, une chaise ou une porte gardent la même taille d'un café à l'autre. Les valeurs vérifiées par script sont dans `plans.json` (clé `norms`).

### 1.1 Les personnages (hypothèses à confirmer)

| Grandeur | Valeur | Remarque |
|---|---|---|
| Yeux de la caméra subjective | 1,65 m (avatar de 1,75 m) | reprise par l'architecte (`technique.md`, section 2.3) |
| Gabarit d'un personnage | 0,60 m de large (rayon de 0,30 m) | l'avatar garde 0,30 m contre murs et meubles |
| Gabarit le plus mince | 0,50 m | sert à vérifier qu'aucun client ne se glisse derrière un comptoir |
| Marche d'un joueur | 3 m/s, à fixer par le game designer | repère: 10 m de marche font un peu plus de 3 s |
| Marche d'un client | 1,2 m/s | repère pour les files |
| Port à deux | 1,2 m/s au plus (C14) | |
| Portée de la main | 1,5 m | hypothèse pour les postes |

### 1.2 Le mobilier

| Élément | Dimensions | Hauteur |
|---|---|---|
| Comptoir | 0,70 m de profondeur | 1,10 m côté clients, plan de travail à 0,90 m côté service |
| Arrière-comptoir | 0,60 m de profondeur | 0,90 m; étagères de 1,40 à 2,20 m |
| Allée de travail entre les deux | 1,10 m | deux joueurs s'y croisent de profil |
| Portillon du comptoir | 0,90 m | à hauteur du comptoir: il ne cache rien |
| Machine à espresso | 0,80 à 1,00 m de large, 0,55 m de profondeur | sommet à 1,40 ou 1,45 m: on voit les visages par-dessus |
| Vitrine réfrigérée (gâteaux, viennoiseries) | 1,10 à 1,50 m de long, 0,60 m sur le comptoir | 1,25 m |
| Table pour deux | ronde de 0,60 m, ou carrée de 0,60 à 0,70 m | 0,75 m |
| Table pour quatre | 0,80 x 0,80 m (une chaise par côté) ou 1,20 x 0,70 m (deux par grand côté) | 0,75 m |
| Grande table de ferme | 2,40 x 0,90 m, huit chaises | 0,75 m |
| Table de terrasse parisienne | 0,90 x 0,50 m, deux chaises côte à côte tournées vers la rue | 0,75 m |
| Chaise | 0,45 x 0,45 m, posée à 0,05 m du bord de la table (convive assis) | assise à 0,45 m |
| Tabouret haut | rond de 0,40 m, 0,60 m par place | assise à 0,75 m |
| Tablette (vitrine, comptoir debout) | 0,35 m de profondeur | 1,05 m |
| Banquette | 0,55 m de profondeur, 0,60 m par place | assise à 0,45 m, dossier à 0,90 m |
| Fauteuil | 0,75 x 0,75 m | assise à 0,42 m; table basse à 0,45 m |
| Banc | 0,45 m de profondeur, 0,60 m par place | 0,45 m |

### 1.3 Passages, portes et files

| Règle | Valeur | Contrôle |
|---|---|---|
| Passage minimal, partout où l'on circule | 0,90 m | un gabarit de 0,90 m va de l'entrée à chaque caisse, chaque passe, chaque place, chaque toilette et chaque sortie |
| Atteindre une place | le bord d'un passage de 0,90 m à 0,25 m au plus de l'assise (un pas), rien entre les deux | la banquette s'atteint par l'intervalle de 0,90 m entre deux tables |
| Allée principale | 1,20 m de la porte à la passe, à côté de la file pleine (C13) | la file compte comme un obstacle |
| Livraisons, meubles portés à deux | 1,20 m (C13), de la livraison à la réserve et jusqu'à chaque zone libre | les meubles se portent avant l'aménagement: seule la coque compte |
| Porte d'entrée | 1,20 m au moins, deux vantaux, vitrée | la plus large porte qu'un duo franchit avec un meuble |
| Porte de livraison | 1,20 à 1,40 m, deux vantaux | le four du bourg et la table de ferme y passent |
| Porte intérieure, toilettes | 0,90 m; les toilettes ouvrent vers l'extérieur | |
| Hauteur des portes | 2,10 m | aucun linteau sous 2,05 m: la caméra à 1,65 m ne le frôle jamais |
| File d'attente | 0,60 m par personne, couloir de 1,00 à 1,10 m, 6 places au plus (C4) | elle part à 2,5 m au plus de sa porte et finit à sa caisse |
| Seconde sortie | dès 20 personnes à l'intérieur, à 5 m au moins de la première | à la manière des règles des petits établissements qui reçoivent du public |
| Trottoir | 1,80 m laissés aux passants devant une terrasse | rue des Plumassiers, rue des Facultés, boulevard |

### 1.4 Marches, escaliers, plafonds

- Marche de 17 cm sur 28 cm de giron (deux hauteurs et un giron font 62 cm, le pas d'un adulte). Escalier public de 1,20 m au moins (1,30 m à la Graineterie), volées de 18 marches au plus, main courante des deux côtés, dans une cage fermée: deux salles qui ne doivent pas se voir ne se voient pas par l'escalier (C17), et le bruit ne monte pas.
- Escalier de service (cave du café d'angle): 0,80 m, raide, réservé au personnel, sous une trappe.
- Seuils de plain-pied (2 cm au plus); une pente douce dehors plutôt qu'une marche.
- Hauteurs sous plafond: village 2,70 m sous les solives de chêne; bourg 3,10 m; ville 3,20 m dans la boutique, 4,20 m sous les fermes de l'atelier et 6,00 m au faîte des sheds; café d'angle 3,40 m; Graineterie 4,00 m dans la boutique, 7,50 m au faîte de la verrière, 3,20 m à l'étage.

### 1.5 Distances de service

Mesurées par le validateur, du premier poste des joueurs à la place la plus lointaine (marche réelle, en contournant les meubles): village 10,8 m; bourg 28,1 m (la remise, au fond de la cour); ville 14,2 m; café d'angle 22,8 m (terrasse de la rue des Coudriers); Graineterie 27,7 m (la serre). Règle proposée: au-delà de 15 m, la salle éloignée a sa desserte (couverts, eau, serviettes) pour qu'un service ne coûte qu'un aller et retour. La remise du bourg en a une; la Graineterie a son office de la halle et son office de l'étage.

## 2. Lisibilité en vue subjective

### 2.1 Règles

1. **D'un seul regard depuis la caisse**: le client qui paie, chaque place de la file et la porte d'où elle vient tiennent dans le champ de la caméra (100 degrés), sans rien d'opaque entre. Le validateur cherche le plus petit angle qui les contient tous: de 6 à 32 degrés selon les adresses.
2. **La caisse est au bout de la file**, et la passe (où l'on prend sa commande) au-delà: le client paie puis glisse le long du comptoir, il ne revient jamais sur la file.
3. **La file longe un mur ou le devant du comptoir**, jamais derrière (vérifié); elle laisse à côté d'elle une allée de 1,20 m de la porte à la passe, pour ceux qui ressortent avec leur tasse.
4. **Le barista voit la porte** dans son axe de travail, face à sa machine (de 3 à 45 degrés selon les adresses).
5. **Ce qui est haut** (plus de 1,60 m: étagères, réfrigérateurs, casiers à casses, meubles à graines, plantes hautes) est adossé aux murs ou sert à séparer deux espaces, jamais entre le comptoir et la porte.
6. **Au-dessus du comptoir**, rien entre 1,40 et 2,00 m: le rail des tickets court au-dessus de la passe à 1,90 m (on le lit d'un coup d'œil vers le haut), les lampes pendent au-dessus de 2,00 m. Les visages restent visibles.
7. **Un repère par salle**, vu depuis sa porte: le tilleul par la vitrine du village, la halle en face du bourg, la presse de l'Imprimerie, le zinc du café d'angle, la verrière et le laboratoire de la Graineterie.
8. **Contre une vitrine, rien de plus haut que 1,10 m** (tablette, banquette, tables), pour que la rue voie le café et que le café voie la rue. Deux exceptions voulues: le brise-bise des vitrines parisiennes (il cache les clients assis, pas la rue) et les vitrines garnies du graineur (opaques, c'est leur rôle).
9. **Portes**: une porte vitrée laisse voir, une porte pleine (toilettes, couloir, réserve) cache; les portes de couloir de l'Imprimerie sont pleines exprès, sinon l'atelier verrait la boutique et la rue en enfilade.

### 2.2 Ce que voit chaque poste

Sortie du validateur (annexe), au maximum de chaque adresse. « Au pire » compte toutes les places occupées, les files pleines, les figurants des espaces vus et l'autre joueur.

| Adresse | Caisse: client, file et porte d'un regard | Barista: porte depuis l'axe de travail | Foule au pire depuis la caisse | Ce qu'on ne voit pas d'un poste |
|---|---|---|---|---|
| Village | 14 degrés (4 places de file) | 3 degrés | 19 | la pièce du fond (derrière le refend), la réserve |
| Bourg | 11 degrés (6 places) | 15 degrés | 37 | la remise et la cour (il faut y passer la tête par le couloir), le laboratoire seulement par la vitre |
| Ville, boutique | 13 degrés (5 places) | 9 degrés | 24 | tout l'atelier |
| Ville, atelier | 32 degrés (6 places, deux portes) | 33 degrés | 25 | la boutique, le coin lecture derrière les casses, la cuisine |
| Café d'angle | 6 degrés (5 places) | 45 degrés | 34 | la salle du fond (portes battantes), la cave |
| Graineterie, boutique | 17 degrés (4 places) | 3 degrés | 16 | la halle (par les arches seulement), l'étage, le boulevard (vitrines garnies) |

Les postes techniques (four, plonge, cuisine, laboratoire) tournent le dos à la salle: c'est voulu, la vue subjective fait de la parole l'outil du duo (« trois personnes attendent à la caisse »). Ils restent à quelques pas de la passe; la cuisine de la Graineterie est reliée à la halle par sa passe vitrée.

## 3. La coque: éléments fixes et zones libres

### 3.1 Éléments fixes

Une coque est ce que le duo trouve en arrivant et ne déplace pas. Le duo choisit ce qu'il pose dessus (quel comptoir, quelle machine, quel four), pas où passent l'eau et le conduit.

| Élément | Règle de placement | Pourquoi |
|---|---|---|
| Murs porteurs, refends, poteaux | jamais déplacés | ils portent les étages et découpent les espaces; ce sont eux qui limitent la foule visible |
| Vitrines | sur la rue, allège à 0,45 m | la rue voit le café, le café voit la rue; à Paris, brise-bise ou vitrine garnie |
| Porte d'entrée | 1,20 m au moins, à l'extrémité de la façade du côté de la file | la file ne bouche jamais l'entrée; ceux qui sortent passent à côté |
| Emplacement du comptoir | fixé par la coque, parallèle à la façade ou face aux portes | derrière lui, on fait face à la porte (règle 2.1.1); le duo choisit ses modules |
| Points d'eau et évacuations | contre un mur où passent les colonnes (refend, mitoyen, mur des toilettes) | ils fixent la plonge, l'évier, les toilettes; la machine, posée sur le comptoir, est alimentée par le dessous de l'allée |
| Prises de force | 32 A pour la machine, 400 V pour le four, le torréfacteur, le lave-vaisselle | une machine ne se branche pas n'importe où: c'est l'emplacement du poste |
| Hotte et conduit | au-dessus du four ou des feux, contre le mur où un conduit monte au toit (vieux conduit de cheminée d'un mur mitoyen, pignon) | on ne perce pas un conduit neuf dans un immeuble; le four se met là où l'ancien montait |
| Toilettes des clients | au moins une accessible (1,60 x 2,00 m environ), porte de 0,90 m ouvrant vers l'extérieur, porte pleine | près de la salle, hors du chemin de la file, jamais par la zone de travail |
| Réserve | près de l'arrière-comptoir et de la livraison; tableau électrique dedans | ranger la livraison du matin en peu de pas |
| Porte de livraison | 1,20 à 1,40 m, sur une cour, une ruelle, un passage ou une trappe de trottoir | les livraisons ne traversent pas la salle (au village, elles arrivent par la cour) |
| Vestiaire du personnel | dès la ville | les employés arrivent à la troisième adresse |
| Seconde sortie | dès 20 personnes à l'intérieur | porte de cour, de terrasse ou de passage, à 5 m au moins de l'entrée |
| Escaliers | dans une cage fermée; trappe derrière le zinc pour la cave du café d'angle | deux niveaux ne se voient pas (C17) |

### 3.2 Zones

| Zone | Sur les plans | Ce qu'on y fait |
|---|---|---|
| Zone libre | hachures vertes | le duo y pose tables, assises, décoration |
| Zone de travail | aplat orange | derrière les comptoirs: joueurs et employés seulement; les modules se posent sur des emplacements prévus |
| Réserve, cuisine, laboratoire, locaux du personnel | aplat beige | personnel seulement |
| Passage à garder libre | hachures violettes | file, allée de la porte à la passe, dégagements, abords des portes: aucun meuble |
| Extension possible | pointillés verts, sur les plans « à l'arrivée » | ce que le duo pourra ouvrir avant de partir |
| Décor de fond | hachures grises | au-delà du trottoir et de la terrasse (C18): on n'y joue pas, les passants y passent |

### 3.3 Ce que le jeu vérifie quand le duo pose un meuble (proposition au game designer et à l'architecte)

Les contrôles de `valider_plans.py` sont ceux que le jeu peut faire à chaque pose, sur sa grille de navigation (25 cm d'après l'architecte, section 5.8): refuser un meuble qui ferme un passage de 0,90 m vers une place, qui coupe l'allée de 1,20 m entre la porte et la passe, qui se pose dans un passage à garder libre, qui cache la porte ou la file à la caisse (s'il est haut), ou qui ferait dépasser 150 meubles visibles (C6). Le fantôme du meuble prend une couleur et une phrase dit pourquoi (« Les clients ne pourraient plus aller à la table du coin »).

## 4. Les adresses

Chaque plan se lit seul: grille d'un mètre, échelle, nord, légende, cotes, éléments fixes nommés, zones, files numérotées, parcours. La rue est toujours en bas du dessin, la flèche du nord donne l'orientation vraie.

### 4.1 Ormeval, le Café de la place (village)

Plans: `plans/village-arrivee.png`, `plans/village-maximum.png`.

**Le lieu.** Ormeval, six cents habitants, sur un coteau au-dessus de la vallée de l'Arvelle. Le café occupe le rez-de-chaussée d'une maison de pierre au nord de la place du Tilleul: la mairie-école à l'est de la place, l'église au sud, la boulangerie juste de l'autre côté de la ruelle du Lavoir, l'arrêt du car départemental vers Mérelles devant la fontaine. Le sentier des crêtes traverse la place; la voie verte (l'ancienne voie ferrée, devenue piste cyclable) passe au fond de la vallée, à un kilomètre.

**Pourquoi le café est là.** C'est le seul café du village, à l'endroit où tout le monde passe: les parents à la grille de l'école, ceux qui attendent le car, les randonneurs qui remplissent leur gourde à la fontaine. L'ancienne patronne l'a tenu trente ans; l'annonce « Café de la place cherche repreneurs » (cadrage, 4.13) est collée sur sa vitrine.

**La coque.** Boutique de 7,00 x 5,40 m (38 m², toilettes comprises), murs de pierre de 0,50 m, plafond à 2,70 m sous des solives de chêne qui portent de la façade au refend, la plus courte portée (5 m). Derrière le refend de 0,40 m: la pièce du fond, ancienne cuisine de 4,00 x 3,20 m avec sa cheminée, et la réserve de 2,90 x 3,20 m qui ouvre sur la cour. Vitrine plein sud en deux panneaux de 2,00 m: le soleil sur la terrasse toute la journée, d'où le store de l'été. Porte de 1,20 m en deux vantaux à l'extrémité est de la façade, petite fenêtre au-dessus de la file. L'escalier du logement de l'étage a sa propre porte sur la place, hors du café.

**Éléments fixes et pourquoi.**
- Le comptoir de 3,00 m est parallèle à la façade, contre le refend: derrière lui, on fait face à la porte et à la place. Sa caisse est au bout est, là où la file arrive en longeant le mur; la passe au bout ouest, d'où les clients repartent vers les tables.
- L'arrière-comptoir est contre le refend parce que l'eau et l'évacuation de l'ancienne cuisine arrivent derrière ce mur; la plonge et le réfrigérateur à lait y sont, à un pas de la machine.
- La machine est sur le comptoir, face à la salle: c'est le seul point du comptoir où arrivent l'eau, l'évacuation et la prise de 32 A, passées sous le plancher de l'allée.
- La joue basse et le portillon ferment la zone de travail à l'ouest; la porte de la réserve est au bout est de l'allée, derrière la caisse.
- Les toilettes sont dans l'angle nord-ouest de la boutique, ouvertes sur un dégagement de 1,20 m qui mène aussi à la pièce du fond: on y va sans passer devant la file.
- La cheminée est sur le mur du fond, côté cour, où monte son conduit, comme dans les anciennes cuisines du village.
- La livraison arrive par la ruelle et le portail de la cour (1,60 m); la porte de la cour (1,20 m) donne dans la réserve.

**À l'arrivée.** Le vieux comptoir en zinc, une machine à levier qu'on manie à la main (cadrage, 4.4), trois guéridons le long de la vitrine et une table dans le coin des toilettes: 8 places. Dehors, le banc de la patronne (2 places). La pièce du fond est fermée: la patronne y garde ses affaires.

**Extensions avant de partir.**

| Extension | Ce qu'elle ajoute | Intention |
|---|---|---|
| E1, la terrasse sous le store | l'autorisation de la mairie, un store banne, deux guéridons: 4 places dehors de plus | apprendre le temps qu'il fait: la terrasse se remplit au soleil, se vide à l'averse; les promeneurs voient le café depuis la place |
| E2, la pièce du fond | une arche de 1,20 m percée dans le refend, deux fauteuils au coin du feu, une table pour deux, des livres: 4 places | le coin douillet de l'hiver, pour les flâneurs et les télétravailleurs; on y emmène une table portée à deux par l'arche |

**Capacité.** À l'arrivée 8 à l'intérieur et 2 dehors; au maximum 12 et 6. Présents au pire 24 (plafond C2: 24).

**Circulation.** Clients: de la place à la porte, la file le long du mur est (4 places), la caisse, la passe, les tables; les toilettes et la pièce du fond par le dégagement. Joueurs: l'allée de 1,10 m derrière le comptoir, le portillon vers la salle, la réserve au bout de l'allée. Livraisons: le camion s'arrête en bas de la ruelle, le livreur dépose les caisses derrière le portail de la cour, le duo les rentre dans la réserve (deux mètres).

**Par les vitrines.** Le tilleul et la fontaine, le car qui s'arrête, les enfants à la grille de l'école à 16 h 30, les clients de la boulangerie, les randonneurs qui remplissent leur gourde.

**Temps forts.** Le car du matin (7 h 30), l'école (8 h 20 et 16 h 30), les retraités en fin de matinée, la secrétaire de mairie et les artisans à midi, les randonneurs et les cyclistes l'après-midi en saison et le week-end, la messe un dimanche sur quatre (le curé dessert plusieurs villages).

**Clientèle.** Pressés (le car), familles (l'école), flâneurs (les retraités, la patronne), promeneurs (randonneurs, cyclistes), gourmands (les viennoiseries du boulanger).

**Difficulté et durée.** 1 sur 5; environ 4 heures.

### 4.2 Mérelles, la boutique de la place de la Halle (bourg)

Plans: `plans/bourg-arrivee.png`, `plans/bourg-maximum.png`.

**Le lieu.** Mérelles, trois mille habitants, neuf kilomètres en aval dans la vallée de l'Arvelle. La place de la Halle et sa halle aux grains à charpente de chêne, le marché du jeudi matin; la Grand-Rue qui monte vers la gare, sur la ligne régionale de la vallée; derrière, la ruelle des Tanneurs qui descend à la rivière, où étaient les tanneries.

**Pourquoi le café est là.** En face de la halle: le marché du jeudi, les visiteurs de la halle, et sur le chemin des voyageurs entre le centre et la gare, matin et soir. C'était la pâtisserie du bourg; son salon de thé avait des habitués.

**La coque.** Maison étroite et profonde, typique d'une grand-rue: 7,00 m de façade sur la place, 11,60 m de profondeur (81 m²): la boutique (6,80 m), puis le laboratoire du pâtissier, la réserve et les toilettes. Derrière, une cour de 7,00 x 5,50 m, puis une remise de 4,60 x 4,00 m sur la ruelle, à côté d'un porche de 2,30 m. Plafond à 3,10 m. Façade à l'est, face à la halle: le soleil du matin sur la terrasse les jours de marché, l'ombre l'après-midi en été.

**Éléments fixes et pourquoi.**
- Le comptoir de 4,75 m fait face à la porte; la file longe le mur sud et arrive à la caisse, dans l'angle; la vitrine à gâteaux est juste après la caisse: la file passe devant en arrivant et le client voit les gâteaux en payant.
- L'arrière-comptoir est adossé à la cloison du laboratoire, vitrée sur 3 m: la salle voit les fournées par-dessus l'épaule du barista. La plonge est contre le mur des toilettes, sur la même colonne d'eau.
- Le four (à acheter) se pose contre le mur mitoyen sud, sous la hotte, parce que le conduit de l'ancien four du pâtissier y monte jusqu'au toit; la prise de 400 V est à côté. Le marbre du pâtissier est scellé au milieu du laboratoire; l'évier est sous la fenêtre de la cour.
- Les clients vont aux toilettes, à la cour et à la remise par un couloir de 1,25 m le long du mur nord, qui ne passe jamais par le laboratoire.
- La porte de livraison (1,40 m, deux vantaux) donne de la cour dans le laboratoire: le four y passe, porté à deux; la réserve suit par une porte de 1,20 m.
- Le porche et son portail de 2,30 m sur la ruelle reçoivent les livraisons et, au maximum, servent de seconde sortie; les poubelles y sont rangées.

**À l'arrivée.** Le salon de thé de l'ancienne pâtisserie: trois petites tables au milieu et le rang le long de la vitrine, 11 places. Le laboratoire attend son four: c'est le premier gros achat, porté à deux. La remise et la cour servent de débarras.

**Extensions avant de partir.**

| Extension | Ce qu'elle ajoute | Intention |
|---|---|---|
| E1, la terrasse de la halle | store, cinq guéridons sur le trottoir de la place: 10 places | le jour de marché, la place déborde de clients |
| E2, la salle de la remise | une grande table de ferme de huit places et sa desserte, portées à deux par le porche | les repas de famille et les anniversaires; le service à table au loin (28 m du comptoir) |
| E3, la cour sous la treille | une treille, quatre tables: 8 places | l'été, le coin frais à l'abri de la place |

**Capacité.** À l'arrivée 11 à l'intérieur, rien dehors; au maximum 21 et 18. Présents au pire 48 (plafond C2: 48), dont un coup de main les jours de marché.

**Circulation.** Clients: la porte (côté sud), la file le long du mur sud (6 places), la caisse, la vitrine à gâteaux, la passe; vers la remise et la cour par le couloir nord. Joueurs: l'allée derrière le comptoir, le portillon au nord, le laboratoire au sud de l'allée, la réserve par le laboratoire. Livraisons: le camion dans la ruelle des Tanneurs, le porche, la cour le long du mur, la porte du laboratoire, la réserve, toujours par 1,20 m au moins.

**Par les vitrines.** La halle de l'autre côté de la place, les étals du jeudi, le réverbère, les voyageurs qui remontent la Grand-Rue avec leur valise.

**Temps forts.** Les voyageurs vers la gare (6 h 45 à 8 h), le marché du jeudi (8 h à 13 h), le mercredi après-midi sans école (familles, goûter), midi (quiches et tartes), le retour du train et les collégiens (17 h à 18 h 30), les visiteurs de la halle le samedi.

**Clientèle.** Pressés (voyageurs), flâneurs (marché), familles (mercredi, marché), gourmands (la pâtisserie), promeneurs (visiteurs de la halle).

**Difficulté et durée.** 2 sur 5; environ 6 heures.

### 4.3 Montaurel, l'Imprimerie (ville)

Plans: `plans/ville-arrivee.png`, `plans/ville-maximum.png`.

**Le lieu.** Montaurel, préfecture et ville universitaire, quarante-cinq kilomètres en aval. Au pied de la vieille ville, le quartier des Facultés: la faculté des lettres et la bibliothèque universitaire en face, l'arrêt de tram « Facultés » à 40 m, une librairie à côté, des reprographies. L'Imprimerie, fermée depuis vingt ans, puis café associatif dans sa boutique.

**Pourquoi le café est là.** Les étudiants et les enseignants à toute heure, le flot du tram le matin, le brunch du week-end dans un lieu qui a du caractère, et l'amour du café de spécialité qu'on trouve dans une ville universitaire.

**La coque.** 165 m²: la boutique sur la rue (7,00 x 6,20 m), les services entre la boutique et l'atelier (35 m²: couloir des clients de 1,40 m, deux toilettes dont une accessible, passage du personnel, réserve et vestiaire de 19 m²), l'atelier au fond (12,00 x 7,20 m, murs de brique, trois sheds vitrés au nord sur des fermes de 12 m, sans poteau). Une petite cour pavée entre l'atelier et la librairie, et le porche de 2,80 m de l'ancienne porte cochère. Le cadrage disait 120 à 150 m²: les 35 m² de services sont ce que demandent deux salles et des employés.

**Éléments fixes et pourquoi.**
- Les sheds regardent le nord: la lumière égale que voulaient les imprimeurs, sans soleil direct; l'atelier n'a donc pas de fenêtre sur la rue, ses murs sont pleins, et il ne voit ni la boutique ni la rue.
- Deux comptoirs, deux caisses, deux files. Dans la boutique, la file longe le mur ouest jusqu'à la caisse; dans l'atelier, le comptoir court le long du mur nord, face aux deux portes (la cour et le couloir), et la barre lente est au bout: les amateurs s'assoient devant et regardent faire.
- La réserve fait le lien entre les deux comptoirs: une porte depuis l'allée de la boutique, une autre par le passage du personnel depuis le couloir.
- La cuisine du brunch prend l'ancienne salle de composition, dans l'angle nord-ouest de l'atelier: les feux contre le pignon, où la hotte rejoint un conduit qui monte le long du pignon; la passe chaude est contre la porte, le serveur prend l'assiette sans entrer.
- Les casiers à casses de l'imprimerie, restés en place, ferment le coin lecture de l'atelier: ils coupent la vue entre le comptoir et le coin.
- Les portes du couloir sont pleines: vitrées et alignées, elles montreraient la boutique et la rue depuis l'atelier.
- La livraison arrive par le porche et la cour, entre par la porte de la cour du couloir (1,20 m) et gagne la réserve par le passage du personnel.

**À l'arrivée.** La boutique du café associatif (une tablette de sept tabourets face à la rue, une table: 9 places), la moitié ouest de l'atelier ouverte (banquette, tables, deux tabourets à la barre lente: 14 places), quatre places sur le trottoir. Les presses occupent la moitié est; la salle de composition est pleine de casses; la cour sert de dépôt.

**Extensions avant de partir.**

| Extension | Ce qu'elle ajoute | Intention |
|---|---|---|
| E1, l'atelier entier | les presses parties, la plus belle gardée sous le porche; tables et coin salon: 12 places | la grande salle des étudiants et du télétravail |
| E2, la cuisine du brunch | feux, four mixte, plonge, passe chaude | le brunch du week-end, la file à la porte de l'atelier |
| E3, la cour sous la glycine | deux tables et un banc: 6 places | le coin frais de l'été, à l'ombre de la maison de la rue |

**Capacité.** À l'arrivée 23 à l'intérieur et 4 dehors; au maximum 35 et 10. Deux employés à l'arrivée, cinq au maximum. Présents au pire 63 (plafond C2: 72).

**Circulation.** Clients: la boutique par la rue; l'atelier par le porche et la cour, ou de l'intérieur par le couloir; toilettes sur le couloir. Joueurs et employés: deux zones de travail, la réserve entre elles, la cuisine depuis l'allée de l'atelier. Livraisons: l'aire de livraison de la rue, le porche, la cour, le couloir, la réserve.

**Par les vitrines.** Dans la boutique, le tram qui passe, les étudiants qui sortent de la faculté, le kiosque de l'arrêt. Dans l'atelier, le ciel par les sheds et la cour par les grandes portes.

**Temps forts.** Le tram et les étudiants avant les cours (7 h 30 à 9 h, à emporter), les ordinateurs dans l'atelier en milieu de matinée et d'après-midi, le coup de midi, le brunch du samedi et du dimanche (10 h à 14 h), les périodes d'examens (l'atelier plein toute la journée), la rentrée de septembre, un été plus calme.

**Clientèle.** Étudiants, télétravailleurs, connaisseurs (barre lente), bruncheurs (week-end), pressés (tram). Le café du village devient une succursale (cadrage, 4.11).

**Difficulté et durée.** 3 sur 5; environ 8 heures.

### 4.4 Paris, le café de l'angle des Plumassiers (Paris quartier)

Plans: `plans/paris-quartier-arrivee.png`, `plans/paris-quartier-maximum.png` (rez-de-chaussée et cave côte à côte).

**Le lieu.** Un quartier de faubourg, à l'angle de la rue des Plumassiers (rue commerçante: primeur, fromagerie, fleuriste, librairie; la bouche de métro « Plumassiers » sur la placette d'en face) et de la rue des Coudriers (rue calme, l'école élémentaire à 60 m au nord, un petit square). Au pied d'un immeuble de rapport de six étages, en pierre de taille. Rues et commerces inventés.

**Pourquoi le café est là.** À la sortie du métro et au coin d'une rue de marché: les voyageurs du matin, les clients des commerces, les parents de l'école, les visiteurs qui viennent pour la rue commerçante. Le vieux café d'angle a fermé au départ de son patron.

**La coque.** Salle de 10,00 x 7,00 m moins le pan coupé (68 m²), plafond à 3,40 m; cave voûtée dessous (70 m²), avec un bout de cave sous le trottoir. Façade principale au sud, sur la rue des Plumassiers: le soleil sur la terrasse. Entrée dans le pan coupé, porte vitrée de 1,58 m à deux vantaux; vitrines à brise-bise sur les deux rues; une porte de 1,20 m sur la rue des Plumassiers, côté ouest, pour la terrasse et comme seconde sortie.

**Éléments fixes et pourquoi.**
- Le zinc de 6,20 m court le long du mur du fond, face à la porte d'angle et aux vitrines; l'arrière-comptoir est contre le mur de la cour, où passent les colonnes d'eau de l'immeuble.
- La caisse est au bout est du zinc, en face du pan coupé: elle voit la porte et la file (5 places) d'un regard. À côté, le comptoir de retrait; au milieu, on boit son café debout au zinc, à la parisienne (3 ou 4 personnes debout, non comptées comme places assises).
- La trappe de la cave est dans l'allée, derrière le zinc, comme dans les vieux cafés: on descend le matin par un escalier raide de 0,80 m réservé au personnel.
- Les toilettes accessibles sont au rez-de-chaussée, dans l'angle nord-ouest, plutôt qu'à la cave: aucun client ne descend.
- La livraison passe par la trappe du trottoir de la rue des Coudriers, ouverte le matin avant qu'on installe la terrasse; les caisses glissent dans la cave sous le trottoir, le duo les range sous la voûte.
- Le brise-bise, sur les vitrines et la porte d'angle, cache les clients assis de part et d'autre: c'est l'une des parades de l'architecte contre la foule visible, et le café en garde son intimité.

**À l'arrivée.** Le vieux zinc et ses banquettes usées: trois tables le long de la vitrine, quatre au milieu, quatre tabourets à la tablette de la rue des Coudriers (18 places); trois tables de terrasse (6 places). La cordonnerie voisine est à vendre.

**Extensions avant de partir.**

| Extension | Ce qu'elle ajoute | Intention |
|---|---|---|
| E1, la salle du fond | la cordonnerie rachetée, ouverte par des portes battantes de 1,40 m: banquette, tables, tablette sur la rue: 11 places; sa porte devient une troisième sortie | une salle calme à part, pour les réunions et les anniversaires; les portes pleines la cachent de la salle |
| E2, la terrasse sur les deux rues | deux tables devant la cordonnerie, trois sur la rue des Coudriers: 16 places dehors en tout | la terrasse parisienne, chaises côte à côte tournées vers la rue |

Un second rang de terrasse (10 places) est dessiné en pointillés: vu de l'angle du trottoir, il ferait dépasser 40 personnages. Il attend la décision de l'architecte sur la foule lointaine (section 6).

**Capacité.** À l'arrivée 18 à l'intérieur et 6 dehors; au maximum 29 et 16, plus 3 ou 4 personnes debout au zinc. Quatre employés à l'arrivée, six au maximum (« l'équipe complète »). Présents au pire 58, debout au zinc compris 62 (plafond C2: 80).

**Circulation.** Clients: la porte d'angle, la file devant le bout du zinc, la caisse, le retrait; service à table en salle et en terrasse. Joueurs et employés: l'allée du zinc, le portillon à l'ouest, la porte de la terrasse pour servir dehors sans traverser la file, la cave par la trappe. Livraisons: la trappe du trottoir, la cave.

**Par les vitrines.** La bouche de métro, la rue commerçante et l'étal du primeur, les enfants de l'école rue des Coudriers, les façades de six étages d'en face.

**Temps forts.** Le métro du matin (7 h 30 à 9 h 30, le café debout au zinc), l'école (8 h 20, 16 h 30), le coup de midi des bureaux, le samedi de la rue commerçante, le dimanche matin des flâneurs, les touristes l'après-midi.

**Clientèle.** Pressés (métro, zinc), flâneurs (le journal), promeneurs (touristes), familles (l'école), télétravailleurs (fin de matinée), gourmands.

**Difficulté et durée.** 4 sur 5; environ 7 heures.

### 4.5 Paris, la Graineterie du boulevard des Horticulteurs (Paris maison)

Plans: `plans/paris-maison-arrivee.png`, `plans/paris-maison-maximum.png` (rez-de-chaussée et étage côte à côte).

**Le lieu.** Un boulevard planté de platanes, au bord de l'ancien faubourg des maraîchers et des pépiniéristes qui lui ont donné son nom; marché sur le terre-plein central le mercredi et le samedi. La maison d'un ancien graineur: la boutique sur le boulevard, la halle sous verrière où l'on triait et vendait les graines, le jardin des semis au fond, un passage de service le long de la maison.

**Pourquoi le café est là.** C'est la maison du duo, celle qu'on fait venir: l'odeur du torréfacteur sur le boulevard, la halle qu'on vient voir, les salons de l'étage, le marché deux fois par semaine; c'est ici que passe le guide (cadrage, 4.13).

**La coque.** Environ 300 m² sur deux niveaux (C17). Au rez-de-chaussée: la boutique (13,00 x 5,50 m, plafond à 4,00 m), la halle (13,00 x 8,00 m sous la verrière, deux colonnes de fonte), le bâtiment du fond (13,00 x 4,00 m: laboratoire, cuisine, couloir du jardin et ses deux toilettes, réserve). À l'étage, au-dessus de la boutique: l'ancien appartement du graineur (grand salon sur le boulevard, petit salon, palier, office, toilettes). Le jardin de 13,00 x 5,20 m avec sa serre et un tilleul; le passage du graineur, 2,00 m, à l'est. Façade au sud sur le boulevard.

**Éléments fixes et pourquoi.**
- Les vitrines sont garnies de sacs de grains et de bocaux jusqu'à hauteur d'homme: c'est la vitrine d'un graineur; elles cachent l'intérieur et le boulevard l'un à l'autre, et seule la porte vitrée (avec son brise-bise) laisse voir. Sans elles, la halle verrait le boulevard en enfilade par les arches.
- Le comptoir de la boutique (3,30 m) est entre les deux arches de la halle: la file longe la vitrine est jusqu'à la caisse; le monte-plats, sur l'arrière-comptoir, monte à l'office de l'étage, et les plateaux ne prennent pas l'escalier.
- Le torréfacteur (E1) est en vitrine, contre le mur mitoyen ouest, où monte son conduit: on le voit du boulevard; il lui faut du 400 V.
- La halle est partagée par les meubles à tiroirs du graineur (2,10 m de haut): deux salles qui ne se voient pas toutes; l'office des serveurs est au nord, devant la passe vitrée de la cuisine.
- Le laboratoire de pâtisserie (E2) est vitré sur la halle au-dessus d'une allège pleine de 1,20 m: on regarde travailler les pâtissiers, debout, sans que le laboratoire voie toutes les tables. Son four à soles est contre le mur mitoyen ouest, où monte le conduit de l'ancienne cheminée du graineur.
- La cuisine a sa hotte sur le mur du jardin, où le conduit monte en façade arrière.
- L'escalier public (deux volées de 9 marches de 17 x 28 cm, 1,30 m de large) est dans une cage fermée, ouverte sur la boutique: les salons de l'étage ne voient pas la halle.
- La réserve ouvre sur le passage par une porte de livraison de 1,40 m; la halle a sa sortie de secours sur le passage, et le passage son portail de 2,00 m sur le boulevard.

**À l'arrivée.** La boutique (comptoir, tablette de cinq tabourets, deux tables: 9 places), la halle meublée de banquettes et de tables (32 places), un rang de terrasse (12 places). L'étage est fermé, le laboratoire vide, le jardin en friche, pas encore de torréfacteur.

**Extensions.**

| Extension | Ce qu'elle ajoute | Intention |
|---|---|---|
| E1, la torréfaction | le torréfacteur en vitrine | « notre mélange »; les connaisseurs, l'odeur sur le boulevard |
| E2, le laboratoire de pâtisserie | four à soles, marbre, cellule de refroidissement, batteur | la pâtisserie maison, vue depuis la halle |
| E3, les salons de l'étage | grand salon et petit salon: 17 places, servis par l'office et le monte-plats | le thé de l'après-midi au calme |
| E4, le jardin et sa serre | deux fauteuils dans la serre, trois tables pour quatre sous le tilleul: 14 places | la fête finale, les familles l'été |
| E5, le second rang de terrasse | quatre tables de plus sur le boulevard: 8 places | les jours de marché |

Au maximum, une tablette de quatre tabourets s'ajoute contre les meubles à graines.

**Capacité.** À l'arrivée 41 à l'intérieur et 12 dehors; au maximum 62 et 34. Six employés à l'arrivée, dix au maximum. Présents au pire 112 (plafond C2: 120), sans compter sur un taux d'occupation.

**Circulation.** Clients: la porte du boulevard; la file à emporter (4 places) jusqu'à la caisse; la halle par les arches, où un employé place les clients; l'étage par l'escalier; le jardin par le couloir du fond, qui passe devant les toilettes. Joueurs et employés: la zone de travail de la boutique et son monte-plats, l'office de la halle, la cuisine et le laboratoire derrière, la réserve. Livraisons: le portail du passage, la porte de la réserve.

**Par les vitrines.** De la halle, les pâtissiers derrière leur vitre et le ciel par la verrière; de l'étage, les platanes et le marché du terre-plein par les portes-fenêtres voilées; de la boutique, presque rien: la vitrine est garnie, on voit le boulevard par la porte.

**Temps forts.** Le marché du mercredi et du samedi, l'emporter du matin, le thé de l'après-midi dans les salons, le brunch du week-end dans la halle, les séances de torréfaction, la visite du guide, la fête finale qui réunit des habitués de toutes les adresses.

**Clientèle.** Tous les profils; les connaisseurs (torréfaction), les gourmands (laboratoire), les promeneurs (touristes), les bruncheurs, les familles (jardin).

**Difficulté et durée.** 5 sur 5; environ 10 heures.

## 5. Tableau de progression

| Adresse | Nouveauté introduite | Places au maximum (intérieur + dehors) | Difficulté | Durée estimée |
|---|---|---|---|---|
| `village`, Ormeval | le service à deux, la carte, les gestes, la décoration, les habitués; la terrasse au soleil, le coin du feu | 12 + 6 | 1 | 4 h |
| `bourg`, Mérelles | le four et les fournées, le service à table au loin (la remise), le jour de marché, les gros meubles portés à deux | 21 + 18 | 2 | 6 h |
| `ville`, Montaurel | deux salles et deux comptoirs, les employés, le brunch et sa cuisine, le café de spécialité; le village devient une succursale | 35 + 10 | 3 | 8 h |
| `paris-quartier`, l'angle des Plumassiers | le flux du métro, le zinc debout, l'équipe complète, la cave et la trappe, la terrasse parisienne, plusieurs cafés à suivre | 29 + 16 | 4 | 7 h |
| `paris-maison`, la Graineterie | deux niveaux, la torréfaction, le laboratoire, les salons, le jardin, la maison au complet | 62 + 34 | 5 | 10 h |
| **Total** | | | | **35 h** |

Les durées sont des ordres de grandeur pour un duo médian; le game designer les fixe par simulation (cadrage, 4.10).

## 6. Foule et plafonds de l'architecte

### 6.1 Comment le validateur compte

- **Places**: chaque place assise visible est un client. Une place derrière un brise-bise, une allège ou une vitrine garnie est cachée; un mur ou une porte pleine cachent tout.
- **Files**: chaque place de file visible est une personne debout.
- **Figurants**: chaque espace a un nombre de figurants (employés, clients qui marchent, passants, gens debout au zinc), répartis sur sa surface; on compte la part de l'espace visible dans le champ, arrondie au-dessus. Un espace vu par une porte en montre peu.
- **L'autre joueur** compte toujours.
- **Points de vue**: les postes déclarés sur chaque plan, et une grille d'un point par mètre partout où l'on peut marcher (suggestion de l'architecte, section 4.4), dans les 72 directions; le champ fait 100 degrés.

### 6.2 Résultats au maximum de chaque adresse

| Adresse | Pire point (champ de 100 degrés) | Présents au pire (C2) | Meubles dessinés (C6) | Espaces qui ne se voient pas |
|---|---|---|---|---|
| Village | 21 | 24 sur 24 | 31 sur 60 | salle, pièce du fond |
| Bourg | 37 | 48 sur 48 | 63 sur 120 | salle et laboratoire (par la vitre), couloir, cour, remise |
| Ville | 28 | 63 sur 72 | 68 sur 200 | boutique, atelier, coin lecture (derrière les casses), cuisine, cour |
| Café d'angle | 34 | 58 sur 80 | 73 sur 180 | salle, salle du fond (portes pleines), cave, terrasse (brise-bise) |
| Graineterie | 36 | 112 sur 120 | 137 sur 350 | boutique, halle ouest et halle est (meubles à graines), laboratoire (allège), cuisine, étage (cage d'escalier), jardin |

Les meubles dessinés ne comptent ni la décoration ni les luminaires: le reste du plafond C6 est pour eux. Depuis les points de vue déclarés, au plus 49 meubles dessinés sont visibles à la fois (plafond: 150).

### 6.3 Ce qui limite les terrasses

Une grande vitrine sur une terrasse pleine additionne deux salles (`technique.md`, section 4.4). Deux parades tiennent les plans sous 40: le brise-bise (café d'angle) et la vitrine garnie (Graineterie). À la Graineterie, elles suffisent pour deux rangs de terrasse (20 places, 36 personnages au pire). À l'angle des Plumassiers, la terrasse court sur deux rues et se voit d'un seul coup depuis le coin du trottoir: avec un second rang, 42 personnages au pire (mesure du validateur, le second rang ajouté en mémoire). La terrasse de l'angle reste donc d'un rang (16 places), et le second rang est dessiné en pointillés. Si l'architecte retient l'option B pour la foule lointaine (personnages cuits dans une texture, au-delà d'une distance), il revient: 10 places de plus.

## 7. Validation

- `python3 -I docs/jeux/cosy-cafe/plans/construire_plans.py` recompose les dix plans, réécrit `plans.json` (un élément par ligne), les SVG et les PNG (rsvg-convert, puis ImageMagick en 256 couleurs; `--sans-png` si rsvg-convert manque). Deux passes donnent les mêmes fichiers à l'octet. Ne jamais retoucher `plans.json` à la main: il se régénère.
- `python3 -I docs/jeux/cosy-cafe/plans/valider_plans.py` contrôle `plans.json` (raster de 5 cm): capacité annoncée égale à la capacité dessinée; plafonds C2, C4, C5, C6 et C17; passages de 0,90 m vers la caisse, la passe, chaque place, les toilettes et les sorties; allée principale de 1,20 m à côté de la file pleine; livraisons et meubles portés à deux par 1,20 m; seconde sortie; aucune fuite d'un client mince (0,50 m) dans une zone de travail ou un local du personnel; postes, réserve et livraison atteints par les joueurs; files (porte, caisse, longueur, hors des zones de travail); passages à garder libres; largeur des portes et des escaliers; regard de la caisse et du barista; foule (C1, C3) depuis chaque point de vue et chaque point jouable. Options: `--plan <id>`, `--sans-grille`. Code de sortie 0 sans erreur.
- `python3 -I docs/jeux/cosy-cafe/plans/eprouver_validateur.py` casse exprès une copie du village de huit façons (table dans la file, portillon ouvert aux clients, porte des toilettes de 0,80 m, étagère haute entre la caisse et la porte, capacité fausse, place enfermée, file derrière le comptoir, foule au-dessus du plafond) et vérifie que chaque faute est trouvée. Il a déjà servi: le contrôle de fuite et celui de la file derrière le comptoir ne pouvaient pas échouer avant lui.

Sortie complète en annexe; résultat le 2026-11-07: 0 erreur sur les dix plans, 8 cas cassés sur 8 détectés.

## 8. Écarts avec le cadrage et points ouverts

- **Ville**: 165 m² au lieu de 120 à 150 m², à cause des services (35 m²) qu'exigent deux salles et des employés; places dans la fourchette (35).
- **Café d'angle**: 29 places assises au lieu de 30 à 36, plus 3 ou 4 debout au zinc; une table de plus fermerait l'allée de 1,20 m ou la porte de la terrasse.
- **Terrasse du café d'angle**: un rang au lieu d'une « grande terrasse » (section 6.3), en attendant la décision de l'architecte.
- **Village et bourg** sont pile au plafond C2 au maximum (24 et 48): un employé de plus (au village, ou un second coup de main les jours de marché au bourg) demanderait un taux d'occupation inférieur à 100 % ou un plafond relevé.
- **Étage de la Graineterie**: une seule cage d'escalier pour 17 places; une seconde issue (escalier de service, passerelle sur le passage) est à étudier avec l'architecte si l'étage dépasse 19 personnes.
- **Vue d'un niveau à l'autre**: le validateur ne compte pas ce qu'on voit d'un étage par une fenêtre (la terrasse en plongée depuis les salons); les portes-fenêtres de l'étage ont des voilages, et rien ne s'ouvre en mezzanine.
- **Ascenseur de la Graineterie**: à prévoir dans la cage de l'escalier (cabine de 1,10 x 1,40 m) pour les fauteuils et les poussettes; non dessiné.

## Annexe: sortie du validateur (2026-11-07)

```text
== village-arrivee: Ormeval, le Café de la place, à l'arrivée
  places dessinées: 8 à l'intérieur, 2 dehors (annoncées: 8 et 2)
  présents au pire: 16 (10 places, 4 en file, 0 employés, 2 joueurs; C2: 24)
  meubles dessinés: 18; il en reste 42 pour la décoration (C6: 60)
  file « comptoir »: caisse à 6,5 m de marche de l'entrée la plus proche
  10/10 places atteintes par 0,90 m; la plus lointaine à 9,1 m d'une entrée (salle)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  10 personnes au plus à l'intérieur: 1 sortie(s)
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  7/7 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 10,3 m du comptoir (terrasse)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « comptoir »: 4 personnes sur 2,10 m, hors des zones de travail
  grille de 84 points jouables (un par mètre): au pire 17 personnages dans le champ, en (10,5 ; 7,5) du niveau rdc
  vue « caisse »; client, file (4 places) et porte d'un seul regard: 14 degrés sur 100; foule au pire 17 dans le champ (regard vers le sud), 17 en se retournant; 12 meubles dessinés en vue
  vue « machine »; porte à 3 degrés de l'axe de travail; foule au pire 16 dans le champ (regard vers le sud), 17 en se retournant; 12 meubles dessinés en vue
  vue « entrée »; foule au pire 13 dans le champ (regard vers le ouest), 18 en se retournant; 13 meubles dessinés en vue
  0 erreur(s)
== village-maximum: Ormeval, le Café de la place, agrandi au maximum
  places dessinées: 12 à l'intérieur, 6 dehors (annoncées: 12 et 6)
  présents au pire: 24 (18 places, 4 en file, 0 employés, 2 joueurs; C2: 24)
  meubles dessinés: 31; il en reste 29 pour la décoration (C6: 60)
  file « comptoir »: caisse à 6,5 m de marche de l'entrée la plus proche
  18/18 places atteintes par 0,90 m; la plus lointaine à 13,1 m d'une entrée (fond)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  14 personnes au plus à l'intérieur: 1 sortie(s)
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  7/7 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 10,8 m du comptoir (terrasse)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « comptoir »: 4 personnes sur 2,10 m, hors des zones de travail
  grille de 83 points jouables (un par mètre): au pire 21 personnages dans le champ, en (7,5 ; 15,5) du niveau rdc
  vue « caisse »; client, file (4 places) et porte d'un seul regard: 14 degrés sur 100; foule au pire 19 dans le champ (regard vers le sud), 19 en se retournant; 15 meubles dessinés en vue
  vue « machine »; porte à 3 degrés de l'axe de travail; foule au pire 19 dans le champ (regard vers le sud), 20 en se retournant; 17 meubles dessinés en vue
  vue « entrée »; foule au pire 14 dans le champ (regard vers le ouest), 20 en se retournant; 15 meubles dessinés en vue
  0 erreur(s)
== bourg-arrivee: Mérelles, la boutique de la place de la Halle, à l'arrivée
  places dessinées: 11 à l'intérieur, 0 dehors (annoncées: 11 et 0)
  présents au pire: 19 (11 places, 6 en file, 0 employés, 2 joueurs; C2: 48)
  meubles dessinés: 25; il en reste 95 pour la décoration (C6: 120)
  file « comptoir »: caisse à 8,1 m de marche de l'entrée la plus proche
  11/11 places atteintes par 0,90 m; la plus lointaine à 9,3 m d'une entrée (salle)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  13 personnes au plus à l'intérieur: 1 sortie(s)
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  13/13 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 8,3 m du comptoir (salle)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « comptoir »: 6 personnes sur 3,30 m, hors des zones de travail
  grille de 102 points jouables (un par mètre): au pire 25 personnages dans le champ, en (3,5 ; 14,5) du niveau rdc
  vue « caisse »; client, file (6 places) et porte d'un seul regard: 11 degrés sur 100; foule au pire 25 dans le champ (regard vers le nord-est), 25 en se retournant; 18 meubles dessinés en vue
  vue « machine »; porte à 15 degrés de l'axe de travail; foule au pire 24 dans le champ (regard vers le est), 26 en se retournant; 22 meubles dessinés en vue
  vue « fond de salle »; foule au pire 25 dans le champ (regard vers le sud-est), 27 en se retournant; 21 meubles dessinés en vue
  vue « couloir »; foule au pire 9 dans le champ (regard vers le nord-est), 9 en se retournant; 7 meubles dessinés en vue
  0 erreur(s)
== bourg-maximum: Mérelles, la boutique de la place de la Halle, agrandie au maximum
  places dessinées: 21 à l'intérieur, 18 dehors (annoncées: 21 et 18)
  présents au pire: 48 (39 places, 6 en file, 1 employés, 2 joueurs; C2: 48)
  meubles dessinés: 63; il en reste 57 pour la décoration (C6: 120)
  file « comptoir »: caisse à 8,1 m de marche de l'entrée la plus proche
  39/39 places atteintes par 0,90 m; la plus lointaine à 34,7 m d'une entrée (remise)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  24 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  13/13 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 28,1 m du comptoir (remise)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « comptoir »: 6 personnes sur 3,30 m, hors des zones de travail
  grille de 76 points jouables (un par mètre): au pire 37 personnages dans le champ, en (2,5 ; 18,5) du niveau rdc
  vue « caisse »; client, file (6 places) et porte d'un seul regard: 11 degrés sur 100; foule au pire 37 dans le champ (regard vers le nord-est), 38 en se retournant; 32 meubles dessinés en vue
  vue « machine »; porte à 15 degrés de l'axe de travail; foule au pire 36 dans le champ (regard vers le est), 45 en se retournant; 42 meubles dessinés en vue
  vue « fond de salle »; foule au pire 35 dans le champ (regard vers le sud-est), 38 en se retournant; 34 meubles dessinés en vue
  vue « couloir »; foule au pire 13 dans le champ (regard vers le nord-est), 14 en se retournant; 14 meubles dessinés en vue
  vue « remise »; foule au pire 16 dans le champ (regard vers le sud-est), 24 en se retournant; 19 meubles dessinés en vue
  vue « cour »; foule au pire 17 dans le champ (regard vers le sud), 28 en se retournant; 31 meubles dessinés en vue
  vue « terrasse »; foule au pire 32 dans le champ (regard vers le nord-ouest), 37 en se retournant; 37 meubles dessinés en vue
  0 erreur(s)
== ville-arrivee: Montaurel, l'Imprimerie, à l'arrivée
  places dessinées: 23 à l'intérieur, 4 dehors (annoncées: 23 et 4)
  présents au pire: 42 (27 places, 11 en file, 2 employés, 2 joueurs; C2: 72)
  meubles dessinés: 49; il en reste 151 pour la décoration (C6: 200)
  file « boutique »: caisse à 6,6 m de marche de l'entrée la plus proche
  file « atelier »: caisse à 20,2 m de marche de l'entrée la plus proche
  27/27 places atteintes par 0,90 m; la plus lointaine à 27,6 m d'une entrée (atelier)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  27 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  19/19 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 25,3 m du comptoir (atelier)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « boutique »: 5 personnes sur 2,90 m, hors des zones de travail
  file « atelier »: 6 personnes sur 3,15 m, hors des zones de travail
  grille de 132 points jouables (un par mètre): au pire 25 personnages dans le champ, en (7,5 ; 15,5) du niveau rdc
  vue « caisse de la boutique »; client, file (5 places) et porte d'un seul regard: 13 degrés sur 100; foule au pire 24 dans le champ (regard vers le sud-est), 24 en se retournant; 16 meubles dessinés en vue
  vue « machine de la boutique »; porte à 9 degrés de l'axe de travail; foule au pire 22 dans le champ (regard vers le sud), 25 en se retournant; 17 meubles dessinés en vue
  vue « caisse de l'atelier »; client, file (6 places) et porte d'un seul regard: 32 degrés sur 100; foule au pire 17 dans le champ (regard vers le sud), 18 en se retournant; 10 meubles dessinés en vue
  vue « machine de l'atelier »; porte à 33 degrés de l'axe de travail; foule au pire 17 dans le champ (regard vers le sud), 18 en se retournant; 10 meubles dessinés en vue
  vue « porte de l'atelier »; foule au pire 19 dans le champ (regard vers le ouest), 24 en se retournant; 14 meubles dessinés en vue
  vue « couloir »; foule au pire 3 dans le champ (regard vers le nord), 3 en se retournant; 1 meubles dessinés en vue
  vue « cour »; foule au pire 4 dans le champ (regard vers le nord), 7 en se retournant; 2 meubles dessinés en vue
  vue « trottoir »; foule au pire 18 dans le champ (regard vers le nord), 25 en se retournant; 16 meubles dessinés en vue
  0 erreur(s)
== ville-maximum: Montaurel, l'Imprimerie, agrandie au maximum
  places dessinées: 35 à l'intérieur, 10 dehors (annoncées: 35 et 10)
  présents au pire: 63 (45 places, 11 en file, 5 employés, 2 joueurs; C2: 72)
  meubles dessinés: 68; il en reste 132 pour la décoration (C6: 200)
  file « boutique »: caisse à 6,6 m de marche de l'entrée la plus proche
  file « atelier »: caisse à 20,2 m de marche de l'entrée la plus proche
  45/45 places atteintes par 0,90 m; la plus lointaine à 27,6 m d'une entrée (atelier)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  42 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  25/25 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 14,2 m du comptoir (atelier)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « boutique »: 5 personnes sur 2,90 m, hors des zones de travail
  file « atelier »: 6 personnes sur 3,15 m, hors des zones de travail
  grille de 134 points jouables (un par mètre): au pire 28 personnages dans le champ, en (5,5 ; 2,5) du niveau rdc
  vue « caisse de la boutique »; client, file (5 places) et porte d'un seul regard: 13 degrés sur 100; foule au pire 24 dans le champ (regard vers le sud-est), 24 en se retournant; 16 meubles dessinés en vue
  vue « machine de la boutique »; porte à 9 degrés de l'axe de travail; foule au pire 22 dans le champ (regard vers le sud), 25 en se retournant; 17 meubles dessinés en vue
  vue « caisse de l'atelier »; client, file (6 places) et porte d'un seul regard: 32 degrés sur 100; foule au pire 25 dans le champ (regard vers le sud-est), 36 en se retournant; 31 meubles dessinés en vue
  vue « machine de l'atelier »; porte à 33 degrés de l'axe de travail; foule au pire 26 dans le champ (regard vers le sud-est), 34 en se retournant; 29 meubles dessinés en vue
  vue « porte de l'atelier »; foule au pire 26 dans le champ (regard vers le nord-ouest), 42 en se retournant; 35 meubles dessinés en vue
  vue « couloir »; foule au pire 8 dans le champ (regard vers le est), 9 en se retournant; 8 meubles dessinés en vue
  vue « cour »; foule au pire 20 dans le champ (regard vers le nord-est), 24 en se retournant; 23 meubles dessinés en vue
  vue « trottoir »; foule au pire 18 dans le champ (regard vers le nord), 25 en se retournant; 16 meubles dessinés en vue
  0 erreur(s)
== paris-quartier-arrivee: Paris, le café de l'angle des Plumassiers, à l'arrivée
  places dessinées: 18 à l'intérieur, 6 dehors (annoncées: 18 et 6)
  présents au pire: 35 (24 places, 5 en file, 4 employés, 2 joueurs; C2: 80)
  meubles dessinés: 41; il en reste 139 pour la décoration (C6: 180)
  file « zinc »: caisse à 6,3 m de marche de l'entrée la plus proche
  24/24 places atteintes par 0,90 m; la plus lointaine à 10,7 m d'une entrée (salle)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  24 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  12/12 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 18,3 m du comptoir (terrasse)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « zinc »: 5 personnes sur 2,40 m, hors des zones de travail
  grille de 150 points jouables (un par mètre): au pire 33 personnages dans le champ, en (15,5 ; 4,5) du niveau rdc
  vue « caisse »; client, file (5 places) et porte d'un seul regard: 6 degrés sur 100; foule au pire 33 dans le champ (regard vers le sud), 35 en se retournant; 34 meubles dessinés en vue
  vue « machine »; porte à 45 degrés de l'axe de travail; foule au pire 30 dans le champ (regard vers le sud-est), 35 en se retournant; 36 meubles dessinés en vue
  vue « milieu de la salle »; foule au pire 23 dans le champ (regard vers le est), 36 en se retournant; 36 meubles dessinés en vue
  vue « terrasse »; foule au pire 17 dans le champ (regard vers le nord), 23 en se retournant; 27 meubles dessinés en vue
  0 erreur(s)
== paris-quartier-maximum: Paris, le café de l'angle des Plumassiers, agrandi au maximum
  places dessinées: 29 à l'intérieur, 16 dehors (annoncées: 29 et 16)
  présents au pire: 58 (45 places, 5 en file, 6 employés, 2 joueurs; C2: 80)
  meubles dessinés: 73; il en reste 107 pour la décoration (C6: 180)
  file « zinc »: caisse à 6,3 m de marche de l'entrée la plus proche
  45/45 places atteintes par 0,90 m; la plus lointaine à 17,7 m d'une entrée (salle du fond)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  37 personnes au plus à l'intérieur: 3 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  12/12 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 22,8 m du comptoir (terrasse des Coudriers)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « zinc »: 5 personnes sur 2,40 m, hors des zones de travail
  grille de 151 points jouables (un par mètre): au pire 34 personnages dans le champ, en (6,5 ; 6,5) du niveau rdc
  vue « caisse »; client, file (5 places) et porte d'un seul regard: 6 degrés sur 100; foule au pire 34 dans le champ (regard vers le sud), 36 en se retournant; 40 meubles dessinés en vue
  vue « machine »; porte à 45 degrés de l'axe de travail; foule au pire 30 dans le champ (regard vers le sud-est), 36 en se retournant; 42 meubles dessinés en vue
  vue « milieu de la salle »; foule au pire 23 dans le champ (regard vers le est), 37 en se retournant; 43 meubles dessinés en vue
  vue « terrasse »; foule au pire 18 dans le champ (regard vers le nord), 28 en se retournant; 33 meubles dessinés en vue
  vue « salle du fond »; foule au pire 9 dans le champ (regard vers le sud-ouest), 16 en se retournant; 22 meubles dessinés en vue
  0 erreur(s)
== paris-maison-arrivee: Paris, la Graineterie du boulevard des Horticulteurs, à l'arrivée
  places dessinées: 41 à l'intérieur, 12 dehors (annoncées: 41 et 12)
  présents au pire: 65 (53 places, 4 en file, 6 employés, 2 joueurs; C2: 120)
  meubles dessinés: 78; il en reste 272 pour la décoration (C6: 350)
  file « boutique »: caisse à 7,4 m de marche de l'entrée la plus proche
  53/53 places atteintes par 0,90 m; la plus lointaine à 19,8 m d'une entrée (halle)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  49 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  20/20 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 14,6 m du comptoir (terrasse)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « boutique »: 4 personnes sur 2,10 m, hors des zones de travail
  grille de 318 points jouables (un par mètre): au pire 32 personnages dans le champ, en (15,5 ; 11,5) du niveau rdc
  vue « caisse de la boutique »; client, file (4 places) et porte d'un seul regard: 17 degrés sur 100; foule au pire 16 dans le champ (regard vers le sud), 26 en se retournant; 24 meubles dessinés en vue
  vue « machine de la boutique »; porte à 3 degrés de l'axe de travail; foule au pire 17 dans le champ (regard vers le sud), 22 en se retournant; 13 meubles dessinés en vue
  vue « office de la halle »; foule au pire 22 dans le champ (regard vers le sud-est), 40 en se retournant; 45 meubles dessinés en vue
  vue « halle ouest »; foule au pire 19 dans le champ (regard vers le nord), 35 en se retournant; 33 meubles dessinés en vue
  vue « halle est »; foule au pire 20 dans le champ (regard vers le nord), 35 en se retournant; 30 meubles dessinés en vue
  vue « terrasse »; foule au pire 11 dans le champ (regard vers le nord-est), 22 en se retournant; 19 meubles dessinés en vue
  vue « palier »; foule au pire 2 dans le champ (regard vers le nord), 2 en se retournant; 0 meubles dessinés en vue
  0 erreur(s)
== paris-maison-maximum: Paris, la Graineterie du boulevard des Horticulteurs, la maison au complet
  places dessinées: 62 à l'intérieur, 34 dehors (annoncées: 62 et 34)
  présents au pire: 112 (96 places, 4 en file, 10 employés, 2 joueurs; C2: 120)
  meubles dessinés: 137; il en reste 213 pour la décoration (C6: 350)
  file « boutique »: caisse à 7,4 m de marche de l'entrée la plus proche
  96/96 places atteintes par 0,90 m; la plus lointaine à 36,4 m d'une entrée (serre)
  allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine
  74 personnes au plus à l'intérieur: 2 sorties éloignées
  aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel
  26/26 postes atteints par les joueurs par des passages de 0,90 m
  service: place la plus lointaine à 27,7 m du comptoir (serre)
  livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m
  file « boutique »: 4 personnes sur 2,10 m, hors des zones de travail
  grille de 254 points jouables (un par mètre): au pire 36 personnages dans le champ, en (15,5 ; 11,5) du niveau rdc
  vue « caisse de la boutique »; client, file (4 places) et porte d'un seul regard: 17 degrés sur 100; foule au pire 16 dans le champ (regard vers le sud), 27 en se retournant; 24 meubles dessinés en vue
  vue « machine de la boutique »; porte à 3 degrés de l'axe de travail; foule au pire 17 dans le champ (regard vers le sud), 22 en se retournant; 13 meubles dessinés en vue
  vue « office de la halle »; foule au pire 26 dans le champ (regard vers le sud-est), 45 en se retournant; 49 meubles dessinés en vue
  vue « halle ouest »; foule au pire 21 dans le champ (regard vers le nord), 38 en se retournant; 33 meubles dessinés en vue
  vue « halle est »; foule au pire 23 dans le champ (regard vers le nord), 39 en se retournant; 35 meubles dessinés en vue
  vue « terrasse »; foule au pire 15 dans le champ (regard vers le nord-est), 31 en se retournant; 31 meubles dessinés en vue
  vue « jardin »; foule au pire 13 dans le champ (regard vers le nord), 17 en se retournant; 18 meubles dessinés en vue
  vue « palier »; foule au pire 14 dans le champ (regard vers le sud-ouest), 14 en se retournant; 13 meubles dessinés en vue
  vue « grand salon »; foule au pire 14 dans le champ (regard vers le sud), 19 en se retournant; 20 meubles dessinés en vue
  vue « petit salon »; foule au pire 17 dans le champ (regard vers le sud-ouest), 21 en se retournant; 23 meubles dessinés en vue
  0 erreur(s)
Total: 0 erreur(s)
```
