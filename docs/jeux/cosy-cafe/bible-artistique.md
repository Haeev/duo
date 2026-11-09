# Cosy Café: bible artistique (section 7 du cahier des charges)

| Champ | Valeur |
|---|---|
| Jeu | `cosy-cafe`, Cosy Café (titre de travail) |
| Statut | proposition du directeur artistique, à consolider par le manager; un essai de style en 3D (section 14) la confirmera avant la production |
| Version | 0.1 |
| Date | 2026-11-07 |
| Auteur | directeur-artistique |
| À relire par | artiste-3d, artiste-2d, tech-artist (sections 6, 11, 13), ux-ui-designer (sections 5 et 10), level-designer (sections 4 et 9), game-designer (sections 7 et 8), architecte-technique (sections 6 et 13.5) |
| Alignée sur | `docs/jeux/cosy-cafe/cadrage.md`; `docs/jeux/cosy-cafe/technique.md` (sections 2.3, 2.4, 3, 4 et contraintes C8 à C11, C18, C21); normes de `docs/jeux/cosy-cafe/plans/plans.json` (yeux à 1,65 m, passages); `docs/plateforme/identite-visuelle.md` et `design/identite/b/joueurs.json` |
| Source des couleurs | `docs/jeux/cosy-cafe/bible/source/palette.cjs` (seule source; les tableaux ci-dessous en sont l'extrait) |
| Planches | `docs/jeux/cosy-cafe/bible/` (section 15); régénérer: `npm ci`, puis `npm run tout` dans ce dossier |

## En bref

1. **Le style**: une maquette peinte à la main. Formes simples et arrondies, aplats de couleur par matière, lumière dorée cuite dans la coque, aucun détail de texture photographique. Trois piliers: **chaleureux**, **arrondi**, **fait main**.
2. **La règle qui passe avant tout**: en niveaux de gris, ce qui se prend ou se sert est aux deux bouts de l'échelle (porcelaine et papier très clairs, café et encre très sombres) et se pose sur une surface moyenne à sombre; le décor reste au milieu. Mesuré sur toute la palette: aucune règle en défaut (211 couleurs).
3. **Les deux joueurs**: bandeau noué et tablier à bretelles croisées à la couleur de Duo, écusson au symbole dans le dos; celui des deux dont la couleur est la plus claire porte un haut sombre, l'autre un haut clair. Les 15 paires se distinguent de dos, en niveaux de gris et sous deutéranopie et protanopie.
4. **Caméra**: yeux à 1,65 m, champ vertical de 60 degrés (réglable de 50 à 75), aucun roulis ni balancement; **mains stylisées** recommandées (objet seul au prototype).
5. **Lumière**: coque cuite en trois états (matin, après-midi, soir) mêlés selon l'heure, taches de soleil cuites, aucune ombre ni aucun reflet calculés (C10, C11), flaques de lumière en décalques (C9).
6. **Clients**: un profil se reconnaît à ce qu'il fait et à ce qu'il porte pour le faire, jamais à son corps; humeur au visage et à la posture; un client qui attend porte un liseré de lumière, pas de jauge.
7. **Six styles** sur une roue: les voisins s'accordent par une matière partagée, les opposés se heurtent.
8. **Cinq adresses** de plus en plus hautes et claires: plafond à solives du village, boutique de la halle, atelier à sheds, café d'angle à l'heure bleue, halle sous verrière.
9. **Production**: coques, vaisselle et mains en Blender scripté; meubles organiques, plantes et nourriture par Meshy puis mise en conformité (palette, budget, échelle); personnages mixtes sur un squelette commun. Images de référence prêtes dans `bible/references/`.
10. **Essai de style** (section 14): le café du village en trois vues subjectives, jugé sur la lisibilité en gris, les budgets mesurés et la sensation de douceur.

## 1. Intention et piliers

> Un café qu'on n'a pas envie de quitter: une lumière dorée qui tombe sur des objets ronds et chauds, la rue fraîche derrière la vitre, et deux tabliers de couleur qui s'affairent.

| Pilier | Ce que ça veut dire à l'écran |
|---|---|
| **Chaleureux** | lumière de lampe (2 700 K environ) et soleil doré; bois miel, terre cuite, cuivre, lin; dehors plus frais que dedans; aucun blanc pur ni noir pur sur une grande surface |
| **Arrondi** | aucune arête vive là où l'œil s'arrête: chanfreins à facettes, coussins gonflés, tasses évasées, têtes rondes; rien qui coupe, rien qui clignote, aucun rouge vif |
| **Fait main** | l'écriture à la craie et à l'encre, la vaisselle au liseré de la maison, les meubles choisis un à un, de petites asymétries; chaque objet a une raison d'être là |

**Lisibilité d'abord**: les trois piliers s'arrêtent là où ils gênent la lecture du jeu (section 3).

**Douillet, en vue subjective**:

- **Ce qui est à portée de main est riche, ce qui est loin est calme.** On voit sa tasse à 40 cm, la vapeur, la mousse, le grain de la croûte: le détail se met là. Les murs, la rue et le plafond restent en aplats doux.
- **Dedans chaud, dehors frais.** La vitrine montre une rue un peu bleutée, plus claire le jour et bleue le soir; l'intérieur est ambré. C'est le contraste de l'abri.
- **La lumière désigne le travail.** Lampes basses au-dessus du comptoir, de la passe et des tables (jamais sous 2,05 m sur un passage): la vaisselle et les visages y sont plus clairs que les murs.
- **Rien ne presse l'œil.** Pas de rouge d'alerte, pas de clignotement, pas de secousse; une alerte douce est ambre et porte son pictogramme.
- **Le corps est calme.** La caméra ne bouge jamais sans le joueur (section 5).
- **Le lieu est habité.** Carte écrite à la main, mots au livre d'or, tasses dépareillées dans le style campagne, plante sur le comptoir, manteau sur la patère.

Le style hérite du « low poly arrondi » validé par le client sur La Petite Ligne (rondeurs par chanfreins, couleurs douces), adapté à une caméra à hauteur d'yeux qui voit les objets de près.

## 2. Palette

Valeurs sRGB; L* CIELAB entre parenthèses. Planche: `bible/palette.png`; contrôles: `bible/controles/palette-controles.png` et `bible/controles/mesures.json`.

### 2.1 Couleurs par rôle (palette commune)

| Rôle | Couleurs | Règle |
|---|---|---|
| Objets de jeu clairs | porcelaine `#F5F0E6` (95), papier `#FBF6EA` (97), lait et mousse `#FAF4EA` (96) | L* 88 au moins: tasses, assiettes, tickets, cartes, sacs de pâtisserie |
| Contenus et encre | café `#3B2318` (16), encre `#2B2622` (16), chocolat `#5A3426` (26) | le sombre qui fait ressortir la tasse claire |
| Contenus moyens | crème du café `#B57844`, thé `#A65A2C`, croûte `#C68845`, mie `#EBD5A2`, kraft `#B48C5E`, fruits rouges `#9E3647`, agrumes `#E5AE38`, verre `#C9D6D3` | petites surfaces; fruits et agrumes sous 2 % de l'image |
| Surfaces de travail | noyer `#5E4130` (30), chêne foncé `#7A5A3E` (41), ardoise `#343938` (23), zinc `#858C91` (58), marbre vert-gris `#4F5A55` (37), plateau `#4A3A31` (26) | L* 20 à 58, au moins 35 sous la porcelaine (mesuré: 37 à 71) |
| Décor commun | chêne miel `#B3834F`, enduit crème `#D5C4A5` (80), lin `#CBBEA6`, feuillage `#5D7D47`, feuillage clair `#8A9C5E`, terre cuite `#A5603F`, cuivre `#A2643D`, laiton `#C2A05A`, inox `#A3A8AC`, acier sombre `#4C5156`, ombre de contact `#2A1E18` | L* 82 au plus, chroma C* 45 au plus |
| Lumière | lampe `#FFC27A`, abat-jour allumé `#FFE0B0`, tache de soleil `#FFD9A0` | couleurs de lumière, pas de matière |
| Alerte douce | ambre `#E0A030` (70), ambre foncé `#5A3A10` pour le pictogramme (4,51:1) | jamais seule: sablier, thermomètre, carton vide (section 10) |
| Joueurs | les six couleurs de Duo (`joueurs.json`), symbole en `#0E1126`, liseré sombre `#1C1A26` (10) | les seules couleurs vives du jeu (section 7.1) |
| Hauts des joueurs | clairs: crème `#EEE6D6`, ciel pâle `#DDE6EC`, rose pâle `#EEDCD6`, sauge pâle `#DDE6D4` (L* 89 à 92); sombres: indigo `#2B2F45`, lie-de-vin `#43262D`, vert bouteille `#23372E`, brun expresso `#3A2C25` (L* 19 à 21) | écart de 68 au moins entre un haut clair et un haut sombre |
| Couleurs de la maison | bordeaux `#6E2E35`, vert bouteille `#2F4F3E`, bleu canard `#2F5560`, bleu nuit `#313D5B`, terre de Sienne `#934B33`, moutarde `#94742A`, prune `#5A3450`, olive `#5E6234` | L* 25 à 55: tabliers des employés, store, enseigne, livre d'or, liseré des tasses |
| Interface | expresso `#2B211C`, filet `#5C4A3E`, crème `#F6EEDF`, crème second `#CDBBA6`; or `#FFC857`, succès `#6BD69A`, erreur `#FF6B81` de Duo; craie `#F1EDE3`, craie jaune `#E9C98A`, ardoise `#2F3634`, page du livre d'or `#F2E8D2` | contrastes en section 10 |

### 2.2 Règles mesurées

`source/mesurer.cjs` vérifie ces règles sur chaque couleur et sort en erreur si l'une manque (dernier passage: 211 couleurs, aucune erreur).

- Décor: L* 82 au plus, chroma 45 au plus. Décor haut (plafonds, moulures, abat-jour): L* 90 au plus.
- Objets de jeu clairs: L* 88 au moins. Surfaces de travail: L* 20 à 58 et au moins 35 sous la porcelaine.
- Tenues des clients, des employés et des habitués: L* 28 à 76 (accessoires exceptés), chroma 45 au plus.
- Hauts des joueurs: 87 au moins ou 26 au plus. Couleurs de la maison: 25 à 55.
- **Aucune couleur du monde à moins de 15 (CIEDE2000, vision normale) d'une couleur de joueur** (pire cas: le bleu ciel des familles, à 15,4 du mauve). Sous deutéranopie et protanopie, des tons chauds du décor (cuivre, laiton, ocre) rejoignent le corail ou le jade (jusqu'à 0,3): c'est attendu et sans danger, parce qu'un joueur ne se reconnaît jamais à sa teinte seule (bandeau, X des bretelles, symbole, clarté du haut).

### 2.3 Nuances de chaque adresse

| Adresse | Dedans | Dehors, par les vitrines | Accent |
|---|---|---|---|
| `village` | chaux crème `#D5C4A5`, solives de chêne `#6B4B35`, tomettes `#A65A3E`, comptoir peint sauge `#7E937B`, carreaux vert sombre derrière le comptoir `#4A5249` | pierre blonde `#CDB892`, volets gris-bleu `#7F979B`, tuiles `#A9674A`, tilleul `#6E8A4C`, pavés `#A49B8A` | sauge |
| `bourg` | parquet de chêne `#97683F`, enduit ocre pâle `#D2BC97`, lambris vert-de-gris `#5B6B62`, moulures `#E3D6BF`, faïence vert d'eau `#A9BDB1` (laboratoire) | devanture bleu-vert `#2F4F55`, enduits ocre `#D5AE78` et rose `#D6A794`, charpente et tuiles de la halle `#7A5538`, `#9C5E45`, toile des étals `#B7A27E` | ocre doré |
| `ville` | brique `#985842`, acier noirci `#3D4346`, béton ciré `#A29D94`, bois brut `#A6825E`, blanc d'atelier `#CFC9BD` | brique `#A5684F`, enduit clair `#CEC4B2`, tramway à la livrée inventée bleu pétrole `#3E6B7A` et crème, tilleuls `#5F7F4A` | bleu acier |
| `paris-quartier` | mosaïque crème `#CDBDA0` à frise brique `#7A4034`, boiseries sombres `#4E3A2D`, plafond mouluré `#E2D5BB`, miroir peint `#8E9A9C`, moleskine à la couleur de la maison | pierre de taille `#DBCBAE`, toits de zinc `#8A949B`, fer forgé `#2B3230`, platanes `#708D50`, kiosque inventé `#3E5B4A` | vert fer forgé et laiton |
| `paris-maison` | fer peint vert-de-gris `#5E7A71`, parquet en point de Hongrie `#8A5A38`, stuc clair `#D3C2A3`, émail vert sombre `#2F3E3A` (torréfacteur), noyer des marches `#6F4A33` | ciel de la verrière (teinte du moment), pierre de la cour `#D9CCB2`, devantures `#5A3F2E` | laiton et vert-de-gris |

### 2.4 Nuances de chaque moment

Planche: `bible/moments.png` (la même vue du village sous les six lumières) et `bible/controles/moments-controles.png`.

| Moment | Soleil (couleur, hauteur) | Ciel (haut, horizon) | Lampes | Ambiance | Réalisation (section 6) |
|---|---|---|---|---|---|
| Matin (7 h à 10 h, préparation) | `#FFD9AE`, 18 degrés | `#B9D3E8`, `#EAD9C4` | 60 % | frais et calme: longues taches basses, rue bleutée | état cuit « matin » |
| Midi (11 h à 14 h) | `#FFF3DE`, 58 degrés | `#A9CBE6`, `#DCE8F0` | 25 % | net et clair, taches courtes près des vitres | mélange matin et après-midi |
| Fin d'après-midi (15 h à 18 h) | `#FFC788`, 16 degrés | `#C9C9D6`, `#F5D3A8` | 50 % | doré, le soleil rase les tables: le moment signature | état cuit « après-midi » |
| Soir (fermeture) | aucun | `#26304F`, `#55607F` | 100 % | heure bleue: dedans chaud, dehors bleu, fenêtres allumées en face | état cuit « soir » |
| Pluie | aucun (taches éteintes) | `#8E9AA4`, `#B7C0C6` | 80 % | abri: gouttes sur la vitre, rue mouillée et plus sombre | état de l'heure, taches à zéro, teinte froide, gouttes |
| Hiver | `#FFE8CC`, 12 degrés | `#C3CFDA`, `#E7EBEE` | 80 % | foyer: neige dehors, buée aux coins des vitres, vapeur plus visible | état de l'heure, rue enneigée, buée |

Saisons de la rue: feuillage de printemps et d'été (palette ci-dessus), automne (roux `#A86F3E` et ocre `#C08A4A`, feuilles au sol), hiver (branches nues, neige `#EEF1F3` sur les toits et la chaussée). Elles ne touchent que le décor de fond et les plantes extérieures.

## 3. Structure des valeurs

Planche: `bible/palette.png` (bandeau 9). Contrôles en gris de chaque vue: `bible/controles/<adresse>-vue-gris.png`.

| Étage | L* | Qui |
|---|---|---|
| Très clair | 88 à 100 | vaisselle, papier, mousse; hauts clairs des joueurs (87 et plus) |
| Clair à moyen | 30 à 82 | murs, sols, meubles, rue; décor haut jusqu'à 90 |
| Moyen | 28 à 76 | tenues des clients et des employés |
| Moyen à sombre | 20 à 58 | surfaces où l'on pose: comptoirs, tables, plateaux, fonds de comptoir |
| Très sombre | 0 à 27 | café, encre, chocolat; hauts sombres des joueurs (26 et moins) |

Règles qui en découlent:

1. **Pas de surface claire sous la vaisselle**: ni nappe blanche, ni marbre blanc, ni plateau de bois clair. Les guéridons du bistrot sont en marbre vert-gris, les tables nordiques en linoléum vert sapin, la table rétro en formica orange brûlé; la moutarde (L* 66) reste aux chaises et aux lampes.
2. **Fond sombre derrière la vaisselle rangée**: carreaux, lambris ou boiseries de L* 25 à 45 derrière les étagères de tasses et la machine.
3. **Vu depuis la salle, aucun comptoir ni poste ne se détache sur une vitrine** (contre-jour): les clients voient le barista sur le mur du fond. Les plans du village et du bourg le respectent (comptoirs tournés vers la rue); à garder pour les trois autres adresses.
4. **Les joueurs aux extrémités, les clients au milieu**: un joueur se repère par sa clarté dans la foule.
5. **Un client qui attend se détache**: posture et regard vers le comptoir, objet (carte fermée posée, ticket), et un **liseré de lumière** sur sa silhouette (terme de Fresnel du programme des personnages, sans passe de plus), qui se renforce doucement avec l'attente. Aucune jauge, aucune bulle.
6. **L'objet visé** s'éclaircit d'un ton (teinte par exemplaire du `BatchedMesh`, technique 3.6): aucun contour dessiné, aucun programme de plus.

Contrôles faits sur les vues des planches (1366 x 768): la vaisselle, les tickets, la carte ouverte et les cartes fermées ressortent en gris dans les cinq vues; les clients de la file se détachent du mur par leur liseré; dans la vue du village prise derrière le comptoir, sous deutéranopie et protanopie, les pinces des tickets restent distinctes par leur symbole et l'ambre par son sablier (`controles/village-vue-controles.png`).

Méthode de revue (sur capture du jeu): `convert capture.png -colorspace Gray gris.png`, puis les simulations de Machado 2009 de `docs/plateforme/identite-visuelle.md` (section 12) sur les vues où apparaissent les joueurs.

## 4. Formes, proportions, échelle

### 4.1 Langage des formes

- **Low poly arrondi**: facettes visibles sur l'architecture et les meubles, chanfreins à facettes sur toute arête vue, volumes un peu gonflés (coussins, assises, abat-jour), petites asymétries de 1 à 3 cm.
- **Normales**: lissées sur ce qui se voit à moins d'un mètre et qui est rond (vaisselle, mains, nourriture, coussins); facettes franches ailleurs. Jamais de lissage qui « mollit » une arête droite de meuble.
- Aucune pièce de moins de 1 cm d'épaisseur (scintillement à distance); un détail utile au jeu fait au moins 3 cm.

| Plus grande dimension | Chanfrein | Segments |
|---|---|---|
| moins de 0,5 m (vaisselle, objets) | 0,5 à 1,5 cm | 1 |
| 0,5 à 2 m (meubles, postes) | 2 à 3 cm | 2 |
| plus de 2 m (comptoirs, murs, poutres) | 4 à 6 cm | 2 |

| Pièce ronde | Pans |
|---|---|
| tasse, verre, pot de lait | 12 |
| soucoupe, assiette | 16 |
| plateau de guéridon, table ronde | 16 à 20 |
| pied, tige, cordon | 5 à 6 |
| abat-jour, globe | 12 à 16 |

### 4.2 Échelle humaine

Mannequin de **1,80 m**; **yeux à 1,65 m** (valeur des plans et de la technique). Les normes de taille sont celles du level designer (`plans.json`); celles-ci servent à l'art:

| Élément | Hauteur ou mesure | Pourquoi |
|---|---|---|
| comptoir, côté clients | 1,10 m | on s'y accoude debout (plans) |
| plan de travail du barista sous la tablette | 0,95 m | la machine s'y pose; son dessus reste sous les yeux (comptoir à deux niveaux, vues du village et du bourg) |
| arrière-comptoir | 0,90 m | plans |
| tables, assises, tabourets hauts | 0,75 m, 0,45 m, 0,75 m | |
| allée derrière un comptoir | 0,9 m au moins, 1 à 1,2 m conseillé | deux joueurs s'y croisent |
| étagère la plus haute à portée | 1,80 m | visible et atteignable depuis 1,65 m |
| rien ne pend sous | 2,05 m sur un passage | ni lampe ni enseigne dans le regard ou dans la tête d'un avatar |
| portes publiques | 2,10 x 0,90 m au moins (1,20 pour les livraisons) | plans |
| marches | 17 cm de haut, 28 cm de profondeur, toutes égales | escalier de la maison parisienne |

**Vaisselle et nourriture à 120 %** de la taille réelle (tasse d'expresso de 7 cm, cappuccino de 9 à 11 cm, assiette de 24 cm, croissant de 16 cm): à 4 m, une tasse fait encore 12 pixels de haut sur l'écran du PC (planche `camera-echelle.png`). Les mains suivent (115 %); meubles et architecture restent à 100 %.

**Texte écrit dans le monde** (C21): hauteur des lettres d'au moins 2,1 % de la distance de lecture, soit 2 cm à 1 m (tickets du rail), 5 cm à 2,5 m (ardoise du comptoir), 8,5 cm à 4 m (ardoise vue de la salle). Le livre d'or se lit en surimpression 2D.

### 4.3 Personnages

- 6,6 têtes: tête de 27 cm pour 1,80 m, un peu large, menton rond; épaules rondes, torse en tonneau, mains en moufles (pouce et index détachés), pieds en galets. Statures de 1,62 à 1,85 m par mise à l'échelle du même squelette (enfants à 0,62).
- **Silhouette**: chaque profil se reconnaît en noir à 4 m (section 7.2). Constat de la planche `silhouettes.png`: en silhouette pure, étudiants, télétravail, bruncheurs et connaisseurs se ressemblent trop. Correctif demandé à l'artiste 3D: accessoire signature grossi d'un quart (casque, ordinateur, lunettes, sac), et posture propre (connaisseur penché vers la machine, bruncheurs toujours en groupe).

## 5. Caméra subjective

Planche: `bible/camera-echelle.png`.

- **Champ de vision**: 60 degrés en vertical par défaut (91,5 degrés en horizontal à 1366 x 768, 85,5 sur l'écran 16:10 du Mac), réglable de 50 à 75 (technique 2.3). Plans de coupe à 0,05 et 80 m.
- **Hauteur des yeux**: 1,65 m pour les deux joueurs, quelle que soit la stature de l'avatar (l'écart de quelques centimètres avec les yeux d'un avatar de 1,80 m ne se voit pas, et les plans restent justes pour les deux). Pour travailler, on baisse le regard de 30 à 45 degrés: le HUD ne couvre jamais le bas de l'écran.
- **Confort**: ni roulis, ni balancement de tête, ni secousse, ni flou de mouvement, ni effet de vitesse sur le champ de vision; accélération et arrêt en 0,15 s au plus; aucun cadrage imposé à un poste ni cinématique; un fondu enchaîné pour changer de lieu; option « balancement doux » (1 cm, vertical) désactivée par défaut.
- **Point de visée**: point fixe de 4 px au centre, crème avec un liseré expresso de 1 px.

**Présentation de l'objet tenu: mains stylisées (recommandé)**

| | Mains stylisées | Objet seul |
|---|---|---|
| Ce qu'on voit | deux moufles à pouce et index détachés, manche du haut du joueur, poignet à sa couleur; elles tiennent, versent, tassent, tendent | l'objet flotte en bas à droite |
| Sensation | tactile et chaleureuse; on voit qui fait quoi, on se passe la tasse de la main à la main | abstraite; gestes de précision moins lisibles |
| Modèle | 1 800 triangles au plus pour les deux mains et les avant-bras, 10 os | rien |
| Animation | une quinzaine de poses (repos, tasse, soucoupe, pichet, porte-filtre, tasser, verser, plateau, carton à deux mains, craie, tablette, chiffon, bouton, tendre, faire signe), passages de 150 ms, gestes par petits mouvements calculés | positions de l'objet par geste |
| Coût | artiste-3d 2 à 3 jours; dev 2 à 3 jours (couche « vue » dans la scène, rayon de 0,3 m de l'avatar, technique 2.3); un appel de dessin (prévu par la technique, 3.2) | une demi-journée |
| Avatar vu par l'autre | six poses de bras suffisent (une main, deux mains, plateau, carton, poste, signe) | même chose |

Prototype avec l'objet seul pour valider le plaisir de jeu; mains à l'alpha.

## 6. Lumière et matières

Ce que la technique impose (sections 3.4 à 3.6, C9 à C11), et la manière de le peindre:

- **Coque cuite** (Blender, Cycles, par script) en **trois états**: matin, après-midi, soir, mêlés selon l'heure par le même programme. Lumière du ciel par les vitrines, rebonds chauds du sol (les tomettes teintent les murs de rose), lampes fixes de la coque cuites dans l'état du soir. Occlusion douce dans les angles et sous les comptoirs; jamais de sol noir.
- **Taches de soleil cuites** dans les états du jour, à bords doux (pénombre de 3 à 5 cm), d'intensité modérée: un meuble posé dans une tache ne reçoit pas le soleil, et son ombre de contact assombrit la tache sous lui, ce qui suffit à la vue. Cuites dans un canal à part pour pouvoir s'éteindre sous la pluie et le ciel couvert (à arbitrer par le tech-artist dans les 48 Mo de la coque).
- **Lumières réelles**: une hémisphérique (ciel et sol), une directionnelle sans ombre (le soleil par les vitrines éclaire meubles et personnages), quatre ponctuelles attribuées aux luminaires qui comptent le plus pour la caméra (C9).
- **Luminaires posés**: abat-jour émissif, **flaque de lumière** en décalque sur la table ou le sol (64 visibles au plus), et **halo peint** (carte face à la caméra, dégradé radial); jamais de flou ni de bloom en version 1.
- **Ombres**: aucune carte d'ombre (C10). Ombre de contact cuite dans chaque modèle (décalque ou couleurs de sommets), ombre ronde sous chaque personnage.
- **Reflets**: aucun (C11). Miroirs, vitres et inox portent un **reflet peint**: deux bandes claires en biais à 12 à 18 % d'opacité, fixes.
- **Matières**: une texture de palette par famille (cases de 4 px, filtrage au plus proche, une face par case) et l'occlusion dans les couleurs de sommets, comme La Petite Ligne. Seules exceptions texturées: motifs des sols et des papiers peints, tissus à motif (vichy, carreaux de ciment), en petites tuiles de 256 px générées par script (deux à quatre couleurs de la palette). Aucune texture photographique, aucune carte de normales.
- **Métaux** (cuivre, laiton, inox): aplats et deux ou trois bandes de reflet peintes dans la palette; pas de programme de métal.
- **Verre et liquides** (programme 5 de la technique): voile des vitres `#DCE6E4` à 12 à 18 %, verres et vitrines `#C9D6D3`, liquide opaque sous le bord; vitrine à gâteaux lisible sans transparence parfaite.

## 7. Personnages

Planche: `bible/silhouettes.png`; contrôles: `bible/controles/silhouettes-controles.png`.

### 7.1 Les avatars des joueurs

- **Signes permanents**, que la personnalisation ne retire jamais: **bandeau noué** sur la tête (nœud et deux pans dans le dos), **tablier à bretelles croisées** à la couleur du joueur dans Duo, bordé du liseré sombre `#1C1A26`; **écusson** de 20 cm au croisement des bretelles, dans le dos, avec le symbole du joueur en `#0E1126`; poche de bavette au symbole (13 cm) devant; poignets à la couleur du joueur. La personnalisation porte sur la coupe et le motif du tissu, la coiffure, la peau, la stature et la teinte du haut, jamais sur ces signes.
- **Règle de la paire**: le joueur dont la couleur de Duo est la plus claire (L*) porte un **haut sombre**, l'autre un **haut clair**; chacun choisit sa teinte dans sa famille (section 2.1). Écart entre les deux hauts: 68 L* au moins. Bretelles sur haut sombre: 42 L* au moins d'écart; sur haut clair, l'écart descend à 9 (aqua avec anis), et c'est le liseré sombre (13,8:1 sur le haut crème) qui dessine le X.
- **Pourquoi le tablier croisé**: un tablier ordinaire ne montre que deux liens de dos, or on voit surtout l'autre de dos quand il travaille. Le X et l'écusson se lisent à 8 m (écusson de 17 pixels sur le PC), le bandeau dépasse de la foule.
- **Contrôle**: les 15 paires possibles, de dos, en vision normale, en gris, en deutéranopie et en protanopie: une figure sombre et une figure claire, deux symboles différents, dans chaque cas.

### 7.2 Les clients, par profil

Un profil se reconnaît à ce qu'il fait et à ce qu'il porte pour le faire, jamais à son corps, à son âge supposé, à son genre ni à son origine: chaque profil mêle toutes les statures, peaux, âges adultes et coiffures. Tenues de L* 28 à 76, sans couleur de joueur.

| Profil | Signe (accessoire, grossi d'un quart) | Posture | Palette de tenue |
|---|---|---|---|
| `presses` | manteau droit, sacoche en bandoulière, gobelet à emporter | debout, poids en avant, regarde l'heure | mastic, anthracite, marine, cognac |
| `flaneurs` | écharpe longue, journal sous le bras | mains dans les poches, assis en arrière | moutarde douce, velours brun, gris bleuté |
| `familles` | un enfant, une poussette ou un sac à dos d'enfant | groupe; l'adulte se penche vers l'enfant | ciré moutarde, rouge tomate doux, bleu ciel, vert pomme |
| `gourmands` | boîte à gâteaux nouée d'un ruban | penchés vers la vitrine à gâteaux, montrent du doigt | framboise douce, caramel, crème pâtissière |
| `promeneurs` | sac à dos (dépasse des épaules), casquette ou casque de vélo | debout, bâton ou carte à la campagne, appareil en ville | vert forêt, rouille, beige, kaki |
| `etudiants` | casque audio au cou, sac de toile | assis à plusieurs, penchés sur la table | bordeaux, jean, toile kaki |
| `teletravail` | ordinateur sous le bras puis ouvert (écran mat, pas clair), gilet ouvert | seul, longtemps, face à l'écran | gris chiné, bleu pâle, sacoche noire |
| `brunch` | lunettes de soleil sur la tête | toujours à deux ou plus, rient | lin terracotta, sauge, jean |
| `connaisseurs` | carnet de cuir, sac kraft d'un torréfacteur inventé, col roulé | au comptoir, penchés vers la machine, hument la tasse | anthracite, velours olive |

### 7.3 Les habitués

Un habitué = la silhouette de son profil + **un trait qu'aucun autre personnage ne porte** (couleur, accessoire, coiffure, compagnon), visible de dos et à 6 m. Exemples pour le village, à caler sur les noms du game designer:

- **L'ancienne patronne**: long gilet tricoté prune, chignon gris piqué d'un crayon, lunettes au bout d'une chaînette, panier d'osier; elle s'assoit sur son banc sous la vitrine.
- **Le randonneur du dimanche et son chien**: le chien couché sous la table (pose fixe, aucun clip de plus).
- **La maraîchère du jeudi**: tablier de marché vert, cagette sous le bras (au bourg).
- Les habitués qui suivent la maison à Paris gardent leur trait et changent de saison (manteau, écharpe).

### 7.4 Les employés

- Tablier à bavette **à la couleur de la maison** avec l'emblème clair, sur une chemise neutre (chambray, lin, gris pierre; veste de pâtisserie lin, jamais blanche). De dos: un lien de cou et un nœud à la taille, **jamais de X**: on ne confond pas un employé avec un joueur.
- Un signe par rôle: service en salle (carnet à la ceinture), barista (torchon sur l'épaule), commis (manches retroussées, cartons), pâtisserie (calot de toile), plonge (tablier imperméable plus long), gérance (gilet sans tablier).
- Surmené: épaules basses, s'essuie le front, visage « fatigué »; il le dit (bulle de texte de l'interface, pas de jauge).

### 7.5 Les fournisseurs

Un visage et un véhicule chacun: la laitière (foulard rouge doux, bouteilles de verre dans un panier, triporteur), le boulanger (tablier fariné, panière), le petit torréfacteur (casquette, sacs de jute), et à Paris le grossiste (blouse, diable) et la livreuse en vélo cargo (caisse à la couleur de son entreprise inventée). Aucune marque réelle.

### 7.6 L'humeur, sans jauge

- **Visage**: huit expressions par six cibles de morphose communes à tous (sourire, yeux plissés, sourcils hauts, sourcils froncés, bouche ronde, paupières basses), en nombre fixe pour tous les personnages (technique 4.1): neutre, content, ravi (yeux en arc, joues roses), lit la carte, attend (regard vers le comptoir), impatient (sourcils un peu froncés), déçu, fatigué. Jamais de colère.
- **Posture**: content (droit, détendu), attend (se tourne vers le comptoir), impatient (se balance, regarde l'heure, croise les bras), ravi (se renverse, mains autour de la tasse), déçu (épaules basses).
- **Objets**: carte ouverte (choisit), carte fermée posée (prêt à commander), ticket ou numéro (attend sa commande), manteau remis (va payer), pourboire posé sur la table.
- Le visage se lit à moins de 5 m (tête de 33 pixels à 4 m), au-delà la posture et le liseré prennent le relais.

### 7.7 Specs des personnages

| Élément | Triangles au plus | Matériau, texture | Remarque |
|---|---|---|---|
| Personnage à moins de 4 m | 5 000 (joueur habillé), 4 000 visé pour un client | un matériau, palette des personnages (une rangée par tenue, repeinte par le jeu), atlas des yeux et de la bouche si besoin (512 px) | un seul maillage à peau, un appel de dessin; cheveux, vêtements et accessoires fusionnés |
| 4 à 10 m | 2 500 | idem | même squelette, mêmes cibles de morphose |
| plus de 10 m | 1 200 | idem | animation une image sur deux |
| Mains en vue subjective | 1 800 | palette des personnages | un appel |
| Ombre ronde | décalque instancié | | un appel pour tous |

Moyenne visée: 2 250 triangles par personnage visible (technique 4.1); 40 personnages visibles au plus (C1).

## 8. Les six styles de décoration

Planche: `bible/styles.png`.

| Style | Matières | Couleurs (L*) | Pièces maîtresses | Esprit |
|---|---|---|---|---|
| `campagne` | chêne miel, lin écru, terre cuite, paille, faïence | chêne `#B3834F` (58), lin `#D4C7AE` (81), terre cuite `#A65A3D` (47), sauge `#8C9F84` (63), bleu faïence `#93A9BC` (68), paille `#C9AE76` (72) | vaisselier peint en sauge, table de ferme, chaises paillées, suspension d'osier | la cuisine d'une maison de famille |
| `bistrot` | bois sombre, moleskine, laiton, zinc, carreaux noir et crème, marbre vert-gris | moleskine `#6B2E33` (28), bois `#4F3426` (25), laiton `#C2A05A` (68), zinc `#858C91` (58), carreaux `#2E2C2B` et `#D3C7B0`, marbre `#4F5A55` (37) | banquette capitonnée sous un grand miroir peint, guéridons, chaises cintrées, globes opalins | le café de quartier d'autrefois |
| `nordique` | frêne miel, laine, blanc cassé, linoléum | frêne `#C4A77E` (70), blanc cassé `#DDD6C9` (86, en hauteur), laine `#A7A39C` (67), bleu gris `#97A9B5` (68), rose poudré `#C9AAA0` (72), vert sapin `#4E6656` (41) | poêle à bois et son conduit jusqu'au plafond, banc à coussins et plaid, suspension à lamelles, tables à plateau de linoléum sapin | la chaleur dans la simplicité |
| `jardin` | rotin, fer peint, terre cuite, carreaux de ciment, plantes | rotin `#C9A26C` (69), vert feuille `#5D7D47` (49), vert d'eau `#A9BDB1` (75), terre cuite `#A5603F` (48), fer peint `#3E5A4C` (36), ciment `#C9B79A` (75) | fauteuils de rotin, grand olivier en pot, treillage, suspensions-cloches de verre | un jardin d'hiver |
| `atelier` | acier, brique, bois brut, béton, cuir | acier `#3D4346` (28), brique `#985842` (44), bois brut `#A6825E` (57), béton `#A29D94` (65), cuir `#7A4E33` (38), bleu de travail `#4F6A8A` (44) | établi devenu comptoir, étagère tubulaire, lampes cages, horloge d'atelier | le lieu où l'on fabrique |
| `retro` | teck, formica, chrome, céramique vernissée | teck `#93603A` (45), moutarde `#BC9E52` (66), orange brûlé `#A8693A` (50), brun `#5B3B2A` (28), crème `#E3D6BA` (86, en hauteur), olive `#7D7F45` (52), pétrole `#3F6670` (41) | enfilade de teck et tourne-disque, chaises coques, tables de formica orange cerclées de chrome, lampes champignons | le salon des années soixante-dix |

**Compatibilités: la roue des styles** (campagne, jardin, nordique, rétro, bistrot, atelier, dans cet ordre):

- voisins sur la roue, **ils s'accordent** par une matière partagée: campagne et jardin (osier, terre cuite), jardin et nordique (végétal, lumière), nordique et rétro (bois blond, lignes simples), rétro et bistrot (laiton, chrome, nostalgie), bistrot et atelier (métal, bois sombre), atelier et campagne (bois brut, objets de métier);
- en face, **ils se heurtent**: campagne et rétro (le rustique contre le formica), jardin et bistrot (l'air contre le sombre et le poli), nordique et atelier (le doux et clair contre le brut et sombre);
- les autres **se côtoient** sans s'aider. Un ensemble cohérent (un style, ou deux voisins) vaut mieux qu'un entassement; la règle chiffrée reste au game designer.

Règle commune: chaque style garde ses surfaces de travail sous L* 58 (section 3) et ses couleurs à plus de 15 des couleurs de joueur. Chaque meuble existe dans un seul style; les objets neutres (plantes, livres, horloges simples) vont avec tous.

## 9. Les adresses

Vues à l'échelle, caméra du jeu, 1366 x 768; ce sont des intentions d'ambiance. Le village et le bourg sont calés sur les plans du level designer (`plans/village-arrivee`, `plans/bourg-maximum`); la ville et Paris attendent leurs plans.

| Adresse | Planche | Identité | Lumière signature | La rue par les vitrines |
|---|---|---|---|---|
| `village`, Ormeval, le café de la place du Tilleul (38 m²) | `adresse-village.png` (derrière le comptoir près de la passe; près du point « entrée » du plan) | plafond bas à solives sur poutre maîtresse, chaux crème, tomettes, comptoir peint sauge à deux niveaux, carreaux vert sombre derrière, lampes émaillées; style montré: campagne | fin d'après-midi: le soleil rase les tomettes | la place du Tilleul: pierre blonde, volets gris-bleu, tilleul, fontaine, église au fond, boulangerie à côté, banc de la patronne sous la vitrine |
| `bourg`, Mérelles, la boutique de la place de la Halle (81 m²) | `adresse-bourg.png` (depuis l'entrée; derrière le comptoir) | ancienne pâtisserie: parquet, lambris vert-de-gris, corniches, ardoise sur le lambris, vitrine à gâteaux, laboratoire et son four au fond (porte entrouverte sur la lueur); style montré: nordique | matin de marché, globes de papier | la halle aux grains en face (charpente, tuiles), étals du jeudi sous leurs toiles, façades ocre et rose, réverbère |
| `ville`, l'ancien atelier (120 à 150 m²) | `adresse-ville.png` | brique, acier noirci, béton ciré, sheds; établi devenu comptoir, étagère tubulaire, grande table commune, coin salon de cuir; style montré: atelier | midi sous les sheds, lumière du nord égale | tilleuls, tramway à la livrée inventée (bleu pétrole et crème), vélos, brique et enduit clair |
| `paris-quartier`, le café d'angle (80 à 100 m²) | `adresse-paris-quartier.png` | mosaïque à frise, zinc et laiton, boiseries sombres, miroir peint, banquettes à la couleur de la maison, vitrines sur deux rues; style montré: bistrot | l'heure bleue: le contraste le plus fort du jeu | terrasse aux chaises tournées vers la rue, immeubles de pierre aux balcons filants, toits de zinc, kiosque inventé, platanes, réverbères |
| `paris-maison`, sous la verrière (250 à 350 m², deux niveaux) | `adresse-paris-maison.png` | halle sous verrière de fer vert-de-gris, mezzanine et escalier (17 x 28 cm, palier relié), torréfacteur en pièce maîtresse (conduit jusqu'au toit), comptoir de marbre vert-gris, laboratoire vitré (prévu, hors de la vue); style montré: jardin | lumière zénithale qui suit le ciel: pluie qui tambourine, neige au bas des carreaux | la cour pavée et ses deux arbres, les immeubles de pierre autour; la fête finale s'y tient |

- **Paris sans monument ni enseigne réels**: la ville se reconnaît à sa matière (pierre crème, zinc, balcons filants, cheminées, platanes, kiosques, terrasses), jamais à un monument, une bouche de métro, une marque ou un nom de rue réel. La question « Paris réel ou métropole inventée » reste ainsi ouverte sans rien redessiner.
- **Au-delà du trottoir**, la rue est un décor de fond fusionné (C18: 15 000 triangles, 10 appels): façades en boîtes chanfreinées, fenêtres en aplats (allumées le soir), arbres en boules, quelques passants (ils comptent dans les 40 personnages visibles, C1).
- **Cohérence**: chaque élément de rue a sa raison (le banc regarde la place, l'ardoise de trottoir est tournée vers les passants, le conduit du torréfacteur et celui du poêle montent jusqu'au toit, le store couvre la terrasse et non la vitrine voisine).

## 10. Interfaces dans le monde et HUD

Le monde d'abord: l'heure se lit à l'horloge murale, la recette à la caisse, la commande au ticket. Le HUD de ux-ui-designer reprend les formes, les polices et les règles de Duo dans des teintes chaudes.

| Interface | Matière et écriture | Taille et lecture | Signes |
|---|---|---|---|
| Ardoise murale | ardoise `#2F3634` dans un cadre de chêne foncé, craie `#F1EDE3` (10,6:1), titres et prix en craie jaune `#E9C98A` (7,8:1), police Caveat | lettres de 5 cm au moins (lue à 2,5 m), 6 lignes environ sur 1,1 x 0,75 m | face à la porte et à la file |
| Ardoise de trottoir | même matière, sur chevalet | lettres de 8 cm (lue de la rue) | tournée vers les passants; c'est elle qui fait entrer |
| Tickets et rail | papier `#FBF6EA`, encre `#2B2622` (13,9:1), Patrick Hand; pictogrammes de 3 cm; rail inox au-dessus de la passe | ticket de 10 x 15 cm, lettres de 2 cm (lu à 1 m) | **pince à la couleur et au symbole du joueur** qui le prend; ticket qui attend: bandeau ambre en tête et sablier, puis coin qui se recourbe |
| Tablette de la maison | objet en noyer et laiton; écran au style du HUD | panneau qui rend le curseur (C20), jamais fermé par Échap (C19) | |
| Livre d'or | couverture à la couleur de la maison, pages `#F2E8D2`; une main par client (Caveat, Kalam, Patrick Hand, tailles et inclinaisons variées) | lu en surimpression 2D | les mots disent ce qui a plu ou manqué |
| Caisse | tiroir de noyer et clavier de laiton; petit afficheur sombre | chiffres de 2 cm | aucune monnaie à rendre en mini-jeu (cadrage, section 6) |
| Pichet à lait | thermomètre à cadran à pince: zone verte, puis ambre | cadran de 4 cm | la température se lit dans le monde |

Les trois polices manuscrites sont sous licence OFL-1.1 (paquets `@fontsource` 5.3.0, embarqués), et couvrent tout le français (accents, œ, guillemets, apostrophe, points de suspension, €; vérifié par fontkit le 2026-11-07). À inscrire dans `CREDITS.md` quand le jeu les livre.

**HUD**: capsules et panneaux **opaques** expresso `#2B211C`, liseré d'un pixel `#5C4A3E`, texte crème `#F6EEDF` (13,6:1), texte second `#CDBBA6` (8,4:1); DM Sans et Jost comme Duo; **or de Duo** pour l'action principale (10,2:1), succès et erreur de Duo toujours avec leur icône; couleur de joueur seulement avec son symbole; aucun flou, aucun panneau semi-transparent; rien sous 14 px; icônes au trait de Duo (grille de 24, trait de 1,75). Le bas de l'écran reste aux mains et au plan de travail.

## 11. Effets

| Effet | Intention | Réalisation (programme 6 ou 7 de la technique) | À éviter |
|---|---|---|---|
| Vapeur | dit « chaud »; s'élève lentement et s'efface en 2 s | deux ou trois rubans peints (bande déformée et texture qui défile), blancs à 60 à 75 %; plus visible l'hiver | fumée réaliste, particules plein écran devant la caméra (fondu sous 0,5 m) |
| Café qui coule | le geste d'extraction se voit et se juge | filet en bande texturée qui défile, brun puis plus clair quand l'extraction dure trop (le signe du réel) | jets qui éclaboussent |
| Mousse et dessin sur le lait | récompense du geste | surface montante dans le pichet, tourbillon de la buse; six dessins de lait (cœur, tulipe, rosette, feuille, spirale, maison) en décalques avec trois qualités | logos, dessins reconnaissables d'une enseigne |
| Miettes, taches, propreté | une table sale se voit sans jauge | décalques instanciés: miettes, rond de café, serviette froissée; une table propre a un reflet peint un peu plus net | saleté répugnante |
| Sol mouillé, traces de pas | la pluie entre avec les clients | décalques qui s'effacent avec la serpillière | flaques animées coûteuses |
| Taches de soleil | l'heure qui tourne | cuites dans la coque (section 6) | ombres calculées (C10) |
| Pluie, neige, buée | l'abri | gouttes et filets peints sur la vitre, flocons en particules dehors, buée en décalque aux coins des vitres | pluie plein écran à l'intérieur |
| Lueurs | lampes, four, vitres le soir | halos en cartes et abat-jour émissifs | flou, bloom, reflets de lentille |

Aucun scintillement « propre », aucune étoile de succès: la satisfaction se voit sur les visages et au livre d'or.

## 12. À faire, à éviter, références

À faire:

- Partir de `palette.cjs`; repasser `source/mesurer.cjs` à chaque nouvelle couleur.
- Arrondir là où la lumière accroche; grossir ce qui se sert (120 %) et ce qui identifie (accessoires +25 %).
- Regarder chaque modèle de près et à distance de jeu, en gris; cocher la liste « détails de construction » de La Petite Ligne (`docs/jeux/jeu-1/bible-artistique-demo.md`, 8.10): rien ne flotte, rien ne traverse, structure lisible, échelle humaine, au bon endroit et pourquoi.

À éviter:

- Textures photographiques, veinage de bois, rayures et salissures peintes, cartes de normales, matériaux réalistes.
- Surfaces claires sous la vaisselle; nappes blanches; marbre blanc; vitrine en contre-jour derrière un poste.
- Blanc pur et noir pur en grande surface; rouge vif; couleurs de joueur dans le décor.
- Flou, bloom, vignettage, aberration chromatique, grain, profondeur de champ, balancement de caméra.
- Stéréotypes de corps, d'âge, de genre ou d'origine pour un profil; colère sur un visage.
- Toute marque, enseigne, logo, monument ou établissement réel; toute ressemblance avec un jeu de café existant (interface, mascotte, enchaînement).

Références, décrites avec des mots (aucune image copiée): les cafés de village du sud de la France avec leurs tomettes et leurs chaises paillées; les intérieurs intimistes peints vers 1900, avec leurs lampes à abat-jour, leurs nappes et leurs papiers peints, où la lumière se pose sur les mains; les maquettes et maisons de poupée en bois peint; la céramique émaillée artisanale; les livres d'images à la gouache; l'heure bleue sur les terrasses de café, vue de l'intérieur.

## 13. Assets de la version 1

### 13.1 Conventions

- 1 unité = 1 m, Y en haut, **façade et regard vers +Z**, origine au centre de l'emprise au sol; GLB.
- Noms anglais en `snake_case`, préfixe de famille: `shell_<adresse>`, `street_<adresse>`, `station_<poste>_<niveau>`, `counter_<module>_<finition>`, `furn_<objet>_<style>`, `deco_<objet>`, `ware_<objet>`, `food_<recette>`, `crate_<contenu>`, `char_<partie>_<variante>`, `hands_fp`, `fx_<effet>`, `ui_<support>`. Niveaux de détail: suffixe `_lod1`, `_lod2`.
- Extras et douilles comme La Petite Ligne: `seat_height`, `top_height`, `socket_<nom>` (emplacements de vaisselle, point d'usage d'un poste, accroche murale), relus par un test contre `meubles.json` (technique 8.2).
- Sources versionnées à côté des modèles: script Blender, ou dossier Meshy (consigne, images d'entrée, date, réglages, sortie brute) puis script de mise en conformité.

### 13.2 Méthode par famille

| Famille | Méthode recommandée | Pourquoi |
|---|---|---|
| Coques des adresses | **Blender scripté** depuis `plans.json` | cotes exactes des plans, coordonnées de carte de lumière, cuisson par script |
| Décor de fond (rue) | **Blender scripté** | boîtes chanfreinées, fusion en 10 appels |
| Comptoirs, étagères, tables, bancs, cadres, tapis, miroirs | **Blender scripté** | formes droites, dimensions du catalogue, plus sûr et plus rapide que la mise en conformité |
| Postes et machines | **Mixte**: Meshy (texte ou images vers 3D) pour l'esquisse de la machine, du torréfacteur, du four; reprise dans Blender aux cotes, avec douilles | silhouette riche, mais points d'usage et dimensions à tenir |
| Meubles organiques (fauteuil de rotin, banquette capitonnée, chaise cintrée, chaise coque, poêle) | **Meshy puis mise en conformité** | courbes longues à modéliser par script |
| Plantes, vases, objets de décoration | **Meshy puis mise en conformité** | formes libres |
| Vaisselle et contenants | **Blender scripté** (révolution) | tailles à 120 %, 12 pans, niveaux de liquide |
| Nourriture | **Meshy puis mise en conformité** (viennoiseries, gâteaux), Blender pour les formes simples (tartines, parts) | formes organiques, petites |
| Personnages | **Mixte**: corps de base, squelette commun, cibles de morphose et rangées de palette dans Blender; coiffures, chapeaux, sacs et accessoires par Meshy puis mise en conformité et soudure au corps; clips dans Blender sur le squelette commun (texte vers mouvement de Meshy pour explorer, pas pour livrer) | un squelette et un programme pour tous (technique 4.1) |
| Mains | **Blender** | rig précis, poses |
| Effets, motifs, pictogrammes | **SVG par script**, atlas PNG | aplats exacts de la palette |
| Interfaces dans le monde | **code** (toile 2D en texture) et polices OFL | textes changeants |

### 13.3 Meshy: ce qu'on impose aux sorties

Entrées de style réutilisables: `docs/jeux/cosy-cafe/bible/references/` (fond uni, trois quarts, un objet par image: chaise paillée, guéridon de bistrot, tasse, machine à expresso, suspension, plante; avatar et client de face et de dos pour l'image vers 3D à plusieurs vues), les élévations de `styles.png` et la planche `palette.png` pour la retexture guidée par image. Liste: `references/LISEZ-MOI.txt`. La fiche d'outil complète est celle du tech-artist (`docs/production/meshy.md`).

Consigne de départ (à affiner à l'essai): « stylized low poly, rounded chamfered edges, flat matte colors, no texture detail, cozy French café, simple readable shapes »; à exclure: « photorealistic, PBR, wood grain, scratches, dirt, text, logo ».

Mise en conformité, par script Blender, avant toute livraison:

1. **Budget**: topologie demandée à Meshy sous le plafond de la catégorie (C8), puis décimation et nettoyage; faces cachées retirées (dessous posé, intérieurs).
2. **Couleurs**: textures de Meshy jetées (elles portent de la lumière cuite et du détail); chaque face reçoit la case de palette la plus proche (CIEDE2000) parmi les couleurs permises du style; une couleur par face; occlusion recalculée dans les couleurs de sommets par notre script.
3. **Échelle et repère**: 1 unité = 1 m, cotes de `meubles.json`, vaisselle et nourriture à 120 %, origine à la base, avant vers +Z.
4. **Formes**: chanfreins de la section 4.1, aucune pièce de moins de 1 cm, rien ne flotte ni ne traverse, symétrie rétablie où elle est attendue.
5. **Proportions des personnages**: 6,6 têtes, mains à 115 %, accessoires grossis d'un quart, soudés au maillage du corps (un seul maillage, un appel).
6. **Contrôle**: rendus de près sous quatre angles, en gris, à côté du mannequin de 1,80 m; refus si un seul point de la liste « détails de construction » manque.
7. **Provenance**: génération par l'outil fourni par le client (règle du studio); consigne, images d'entrée et date gardées dans le dossier source de l'asset.

### 13.4 Liste des assets par famille

Triangles: plafonds C8 de la technique (au plus); textures: palettes partagées, sauf mention.

| Famille | Contenu de la version 1 (ordre de grandeur) | Triangles au plus | Matériaux, textures | Noms |
|---|---|---|---|---|
| Coques | 5 adresses, états d'arrivée et extensions (arrière-salle, terrasse, cuisine) | 30 000 visibles dans la pire vue (technique 3.2) | programme « coque cuite »; palette de la coque, motifs de sol et de mur (tuiles de 256 px), cartes de lumière de 2048 au plus, 48 Mo au plus par adresse | `shell_village`, `shell_village_ext_terrasse` |
| Décor de fond | 5 rues, saisons et neige | 15 000, 10 appels (C18) | programme « dehors »; une palette | `street_bourg` |
| Postes | machines à expresso à 1, 2 et 3 groupes, moulins (2), fours (2), réfrigérateurs (2), lave-vaisselle, plonge, presse-agrumes, blender, bouilloire, vitrines à gâteaux (2), caisses (3), torréfacteur, batteur, rail à tickets: 22 environ | machine et torréfacteur 4 000; four, réfrigérateur, lave-vaisselle 2 000; vitrine, étagère 1 000; module de comptoir 1 500; petits postes 600 | palette des meubles; verre pour les vitrines | `station_espresso_2g`, `station_roaster` |
| Comptoirs | droit, angle, passe, portillon, fin; trois finitions (bois peint, bois sombre, zinc): 15 | 1 500 par module | palette | `counter_straight_zinc` |
| Meubles par style | par style: chaise, tabouret, table de 2, table de 4, banc ou banquette, fauteuil, suspension, applique ou lampe, étagère, une à deux pièces maîtresses: 60 à 66 | chaise, tabouret, table 600; fauteuil, banquette 1 200; luminaire 600; étagère 1 000; pièce maîtresse 1 500 (2 000 pour le poêle et l'enfilade) | palette des meubles, teinte par exemplaire | `furn_chair_campagne`, `furn_banquette_bistrot` |
| Décoration | plantes (8), cadres et tableaux (8, toiles générées par script), miroirs (2), tapis (6), horloges (3), vases, livres, bocaux, tourne-disque, objets du métier: 40 environ | plante 1 200; cadre, ardoise, tapis 150; objet 250 à 600 | palette; toiles de tableaux de 256 px | `deco_plant_olive`, `deco_frame_02` |
| Revêtements | sols (8), papiers peints (8), carrelages (6), peintures (12 teintes de la palette) | | tuiles de 256 px, deux à quatre couleurs, générées par script | `tex_floor_tomette` |
| Extérieur | store (couleur de la maison), jardinières, enseigne (nom de la maison écrit par le jeu), ardoise de trottoir, parasol, mange-debout: 10 | 600 à 1 200 | palette; enseigne en toile 2D | `deco_awning`, `ui_sidewalk_slate` |
| Vaisselle et contenants | tasses (expresso, cappuccino, grande tasse, tasse à thé), soucoupes (2), verres (3), assiettes (2), bol, théière, pichet à lait, porte-filtre, tasseur, plateau, carafe, sucrier, cuillère, gobelet à emporter, boîte à gâteaux, sac de papier: 24 | 250 | palette; liseré à la couleur de la maison par teinte | `ware_cup_cappuccino` |
| Nourriture | viennoiseries (6), gâteaux entiers et parts (12), salé (6), fruits (6): 30 | 250 | palette | `food_croissant` |
| Livraisons | cartons (4 tailles), sacs de grains, bouteilles de lait, cagettes: 8 | 100 (carton) à 250 | palette | `crate_box_m` |
| Personnages | 2 corps de base (adulte, enfant), 12 coiffures, 9 profils x 3 tenues, 25 accessoires, hauts des joueurs (4 + 4), tabliers et bandeaux, 6 rôles d'employés, 20 à 30 habitués, 6 fournisseurs, un chien couché | section 7.7 | palette des personnages (rangées), atlas du visage au besoin (512 px) | `char_body_adult`, `char_hair_bun` |
| Clips | marcher, attendre, s'asseoir, assis (3 variantes), lire la carte, boire, payer, porter, servir, faire signe, se pencher, rire, soupirer, poser, essuyer, tasser, verser: 25 environ | | squelette commun | `anim_sit_read` |
| Mains | une paire, 15 poses | 1 800 | palette des personnages | `hands_fp` |
| Effets | vapeur, filets, mousse, dessins de lait (6 x 3), miettes, taches, gouttes, flocons, buée, halos | 3 000 en tout dans la pire vue | un atlas de 512 px | `fx_steam` |
| Interfaces dans le monde | ardoises, tickets, tablette, livre d'or, caisse, horloge | 2 000 avec les textes | toiles 2D (1024 x 512 pour l'ardoise, atlas de tickets de 1024) | `ui_wall_slate` |

### 13.5 Budgets par scène

Repris de la technique (3.2 et 3.7) pour la pire vue de chaque adresse, personnages compris:

| Poste | Triangles | Appels |
|---|---|---|
| Coque (murs, sols, plafonds, escaliers, cadres) | 30 000 | 12 |
| Dehors, décor de fond | 15 000 | 10 |
| Meubles et décorations posés (150 visibles au plus) | 70 000 | 4 |
| Objets mobiles (150 visibles au plus) | 15 000 | 4 |
| Personnages (40 au plus) et mains | 90 000 | 42 |
| Effets et décalques | 3 000 | 8 |
| Textes du monde, objet visé | 2 000 | 10 |
| **Total visé** | **225 000** (plafond 250 000) | **90** (cible 135, plafond 150) |

| Adresse | Pire vue visée | Mémoire de textures |
|---|---|---|
| `village` | 150 000 triangles, 80 appels | 128 Mo visés par adresse (256 au plus): coque 48, palettes et personnages 32, textes et interface 16 |
| `bourg` | 210 000, 110 | idem |
| `ville`, `paris-quartier`, `paris-maison` | 225 000, 135 | idem |

Dix programmes de shader au plus (technique 3.6); aucune carte d'ombre; quatre lumières ponctuelles. Les vues des planches respectent ces effectifs (la vue du village derrière le comptoir montre 8 personnages, passant compris, pour un plafond de 24).

## 14. Brief de l'essai de style en 3D (artiste-3d)

**Objectif**: valider la bible en vrai 3D avant la production, sur le café du village, en trois vues subjectives. Une scène, pas un niveau jouable.

**Scène**: le café de la place du Tilleul, état « arrivée » du plan `plans/village-arrivee` (7,00 x 5,40 m), avec la place vue par la vitrine. À modéliser:

- la coque (murs de chaux, solives sur poutre maîtresse, tomettes, vitrines à petits bois, porte vitrée, portes du fond), cuite par script dans Cycles en deux états (après-midi et soir), taches de soleil comprises;
- le comptoir à deux niveaux (1,10 et 0,95 m), l'arrière-comptoir (0,90 m) avec carreaux sombres, étagères de tasses, ardoise; la machine à expresso à deux groupes (cuivre), le moulin, la caisse, le livre d'or, la cloche à viennoiseries, le rail à tickets et quatre tickets (deux pinces de joueurs, un ticket qui attend);
- trois tables rondes et deux tables carrées, chaises paillées (style campagne), cinq lampes (deux émaillées vert sombre au comptoir, trois sur les tables) avec flaques en décalques et halos peints;
- vaisselle: tasses d'expresso et de cappuccino, soucoupes, assiettes, deux croissants, au liseré vert bouteille;
- trois clients (une cliente à la caisse, un client qui lit la carte, un client carte fermée qui attend), l'avatar d'un joueur (astre aqua, haut sombre) de dos avec un plateau, et l'avatar de l'autre (croissant mauve, haut clair) de face derrière le comptoir;
- la place en décor de fond: façades de pierre blonde, tilleul, fontaine, église au fond.

**Trois vues** (1366 x 768 et 1920 x 1080, champ vertical de 60 degrés, yeux à 1,65 m):

1. **Vue A, derrière le comptoir, 16 h, soleil**: point de vue « machine » du plan (ou près de la passe, comme la planche), regard vers la place. On doit voir: la vaisselle claire sur le noyer, la file et son liseré, les tickets et leurs pinces, le partenaire de dos (bandeau, X, écusson), la place par la vitrine, les taches de soleil sur les tomettes.
2. **Vue B, « entrée », 19 h, pluie**: point de vue « entrée », regard vers le comptoir. On doit voir: l'ardoise lisible, la partenaire de face (bavette au symbole), les lampes allumées et leurs flaques, la pluie sur la vitre de la porte, la rue bleue et mouillée.
3. **Vue C, le geste, 9 h**: derrière la machine, regard baissé de 40 degrés. On doit voir: les mains stylisées (pichet sous la buse, thermomètre à cadran), la tasse sur la grille, la vapeur, le rail au-dessus.

**Livrables**: le script Blender et les GLB (`games/cosy-cafe/assets-src/essai-style/` ou le chemin que fixera l'architecte), les captures des trois vues dans Three.js 0.187 sous Chromium, leurs versions en gris et en deutéranopie, et les mesures de `renderer.info` (triangles, appels, programmes) pour chaque vue.

**Réussite** (chaque point se vérifie sur les captures):

| # | Critère | Mesure |
|---|---|---|
| E1 | En gris, la vaisselle, les tickets et les cartes se détachent de leur fond | écart de L* de 35 au moins entre porcelaine et surface dessous, mesuré sur la capture |
| E2 | Les deux joueurs se distinguent de dos et de face, en gris et en deutéranopie | figure sombre et figure claire; X et symbole lisibles à 4 m |
| E3 | Les clients qui attendent se repèrent sans jauge | trois relecteurs les désignent sur la vue A sans légende |
| E4 | Budgets tenus | vue A et B sous 150 000 triangles et 80 appels (budget du village), 10 programmes au plus, aucune carte d'ombre |
| E5 | Textes lisibles | lettres de l'ardoise d'au moins 14 pixels à 1366 x 768 depuis le point « entrée » |
| E6 | Détails de construction | liste 8.10 de La Petite Ligne cochée pour chaque modèle (rendus de près sous quatre angles) |
| E7 | Douceur | aucune arête vive au premier plan; le manager et le client trouvent la salle chaleureuse sur les trois vues (avis noté) |
| E8 | Fidélité à la bible | palette respectée (couleurs prises dans `palette.cjs`), revue du directeur artistique classée lisibilité, cohérence, finition |

Durée visée: trois jours d'artiste 3D, plus une demi-journée de tech-artist pour la cuisson et les décalques.

## 15. Contrôles réalisés et planches

| Fichier | Contenu |
|---|---|
| `bible/palette.png` | palette et rôles, interfaces, structure des valeurs |
| `bible/adresse-village.png`, `adresse-bourg.png`, `adresse-ville.png`, `adresse-paris-quartier.png`, `adresse-paris-maison.png` | une planche par adresse: vue subjective légendée, matières, seconde vue, lumière, rue |
| `bible/moments.png` | les six moments sur la vue du village |
| `bible/styles.png` | les six styles et la roue |
| `bible/silhouettes.png` | profils en couleur et en noir, avatars, employé, habitués, humeurs, 15 paires de dos |
| `bible/camera-echelle.png` | confort, élévation, tailles à l'écran, vue rapprochée avec les mains |
| `bible/references/*.png` | images d'entrée pour Meshy |
| `bible/controles/` | `mesures.json`; montages en gris, deutéranopie et protanopie de la palette, des moments, des styles, des silhouettes et de la vue du village; vues des cinq adresses en gris |
| `bible/source/` | `palette.cjs` (couleurs), `mesurer.cjs` (règles), `scene3d.cjs`, `mobilier.cjs`, `adresses.cjs`, `figures.cjs` (dessin à l'échelle), `planches.cjs` (assemblage), `rendre.cjs` (Chromium et ImageMagick) |

Les vues sont dessinées par un petit moteur de perspective (caméra du jeu, éclairage approché de la cuisson): elles valent pour l'échelle, la composition et les valeurs, pas pour le rendu final de Three.js. `rsvg-convert` ne sait pas dessiner les polices WOFF2 des paquets @fontsource (carrés vides): le rendu passe par Chromium, sans aucune requête réseau.

## 16. Points ouverts

| Pour | Point |
|---|---|
| game-designer | noms et histoires des habitués (section 7.3); règle chiffrée de la roue des styles (section 8); liste des recettes pour la nourriture à modéliser |
| ux-ui-designer | HUD aux couleurs de la section 10 (les maquettes basses fidélités le laissent à la bible); écran de personnalisation qui garde bandeau, bretelles et écusson; liseré du client qui attend: d'accord ou autre signe |
| level-designer | plans de la ville et de Paris; vitrines jamais derrière un poste vu de face; comptoirs à deux niveaux (0,95 et 1,10 m); rien sous 2,05 m sur un passage |
| tech-artist | canal séparé des taches de soleil dans la cuisson; liseré de Fresnel dans le programme des personnages; teinte de l'objet visé; fiche Meshy |
| architecte-technique | mains stylisées dans la scène (un appel) confirmées; poids des tuiles de motifs et des toiles de tableaux |
| client (par le manager) | voir le compte rendu |

## 17. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-11-07 | 0.1 | Première version: intention, palette mesurée, valeurs, formes, caméra, lumière alignée sur la technique (C8 à C11, C18, C21), personnages et paires de joueurs, six styles et leur roue, cinq adresses (village et bourg calés sur les plans), interfaces, effets, assets et méthode Meshy, budgets, brief de l'essai de style; planches et contrôles | directeur-artistique |
