# La Petite Ligne, refonte: bible artistique

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (`games/la-petite-ligne`), refonte demandée le 2026-11-10 |
| Statut | proposition du directeur artistique, à valider par le manager puis par le client |
| Version | 0.1, 2026-11-10 |
| Source qui fait foi | `docs/jeux/jeu-1/refonte/reponses-client-2026-11-10.md` (réponses 6, 8, 17, 36, 43 à 51, 57, 73, 74 et décisions antérieures du même jour) |
| Remplace | `docs/jeux/jeu-1/bible-artistique-demo.md` pour les personnages dès maintenant; pour le décor, la bible de la démo reste la référence jusqu'aux sections « meubles », « bâtiments » et « paysage » des versions suivantes |
| Fiche de production | `docs/production/meshy.md` (outil, coûts, pièges vérifiés) |
| Planches | `docs/jeux/jeu-1/refonte/planches/` (`01-gabarits.png`, `02-emplacements.png`, `03-visages-onomatopees-nuancier.png`), sources dans `planches/source/` |
| Nuancier | `planches/source/nuancier.json` (seule source des couleurs de personnage; contrôle: `python3 controle_nuancier.py nuancier.json`) |

Les planches sont des schémas en aplats: elles fixent les proportions, les repères et les couleurs, pas le rendu 3D final, qui sera jugé sur les premières pièces de la vague 1.

## 1. Direction

### 1.1 Intention et piliers

Le client trouve que le jeu fait encore « codé à la va-vite ». Il veut un rendu lisse et doux, comme une figurine, des humains aux proportions actuelles, des visages en relief, des habitants mémorables. Le jeu ira de lieu en lieu en train.

L'idée qui tient tout: **La Petite Ligne est un train miniature, et son monde est la maquette qu'il traverse.** Les personnages sont des figurines peintes, les maisons des bâtiments de maquette, les arbres des boules de mousse, le tout posé à la main par quelqu'un de soigneux. Ce fil rouge est une tradition d'artisanat (le modélisme ferroviaire, la figurine peinte, l'animation en volume), pas l'identité d'un jeu existant, et il s'accorde aux trois lieux: un bourg de campagne, une grande ville et un village hanté sont trois dioramas de la même main.

| Pilier | Ce qu'il impose |
|---|---|
| **Doux** | Surfaces lisses, aucune facette, aucun coin vif, bords épais et ronds, couleurs mates en aplats, lumière chaude qui enveloppe. On a envie de prendre l'objet dans la main. |
| **Miniature** | Peu de détails, mais chacun modelé en volume (un bouton est une pastille, une couture un bourrelet). Rien n'est peint en trompe-l'œil, rien n'est une texture. Tout tient debout et s'emboîte proprement. |
| **Expressif** | Chaque habitant se reconnaît à sa silhouette, puis à sa couleur, puis à sa pièce signature. Le visage joue par des pièces franches, et les émotions fortes sautent au-dessus des têtes en onomatopées. |

### 1.2 Ce qu'on garde, ce qu'on jette

| On garde | Pourquoi |
|---|---|
| Les proportions actuelles: adulte de 5 têtes, tête d'un cinquième de la hauteur (réponse 45: « comme maintenant ») | choix du client |
| L'échelle (1 unité = 1 m), Y en haut, regard vers +Z, noms anglais en `snake_case` | tout le jeu s'y appuie |
| Les couleurs par cases de palette et les emplacements de couleur teintés au rendu, un seul matériau et un seul appel de dessin par personnage | budget du PC, et accord avec la fiche Meshy (couleur par pièce) |
| Les teintes douces et chaudes d'Aubrune, les lueurs de nuit | elles plaisent, le client ne les critique pas |
| La règle des 10 cm, la liste « détails de construction » (bible de la démo, 8.10), la question « au bon endroit, dans le bon sens, à la bonne taille, pourquoi » | règles du studio |
| L'écusson du profil Duo sur la poitrine des joueurs | signe du joueur, sans foulard |

| On jette | Remplacé par |
|---|---|
| L'ombrage en aplats à facettes (une normale par face), les chanfreins à 2 segments, les cylindres à 6 pans | normales lissées, formes continues, arêtes rondes modelées |
| Les personnages bâtis par script à partir de boîtes et de cylindres | pièces modelées par Meshy d'après nos références, mises en conformité par script |
| Les visages plats à clés de forme (yeux et bouche presque dessinés) | tête en relief et pièces de visage en volume (section 2.3) |
| Les gabarits obtenus par simple mise à l'échelle (l'enfant à 0,75) | 8 corps vrais: enfant, adulte, âgé, en 2 ou 3 corpulences |
| Les 21 habitants actuels en tant que modèles (réponse 74: page blanche) | habitants composés depuis le catalogue; leur esprit peut inspirer le game designer |
| Les tenues d'un tenant et les 73 vêtements de la 0.12 | le catalogue de la section 4 |

### 1.3 Références de style, en mots

- **Formes**: la figurine de vinyle ou de résine moulée. Volumes pleins et gonflés, transitions en congé, aucun creux fin. Les bords de vêtement font 8 à 12 mm d'épaisseur, comme un moulage qui doit sortir du moule. Les cheveux sont une ou quelques masses, jamais des mèches fines.
- **Matières**: peinture mate posée au pinceau large sur une pièce lisse. Trois niveaux de brillance seulement: mat (tissu, cheveux, peau), satiné (cuir, bois ciré, lèvres), brillant (bottes de pluie, ciré, verres, yeux, laiton). Aucune texture, aucun grain, aucune carte de relief.
- **Lumière**: une table de maquettiste près d'une fenêtre. Une lumière principale chaude, un ciel doux qui débouche les ombres, un liseré clair sur le bord des volumes (terme de bord dans le shader, pas un post-traitement), une ombre de contact sous chaque pied.
- **Ce qu'on évite**: le réalisme, le style « cubes », le contour noir de dessin animé, le flou de mise au point qui imite la photo de maquette (trop coûteux sur le PC de référence), tout ce qui rappellerait les personnages d'un jeu de vie connu (têtes géantes sur petits corps, yeux en pastilles peintes).

### 1.4 Budgets (PC de référence: Intel UHD 620, 1366 x 768)

Le client préfère la beauté à la fluidité (réponse 73). On vise 30 images par seconde au plancher dans le plan le plus chargé, la qualité adaptative (résolution, puis ombres) restant le filet. Plafonds de scène inchangés tant que le tech-artist n'a pas mesuré le nouveau style: 350 000 triangles, 200 appels de dessin, 12 programmes.

| Élément | Budget |
|---|---|
| Personnage complet, vu de près (toutes pièces portées, sections masquées retirées) | 9 000 triangles au plus, 6 500 en tenue courante |
| Personnage au-delà de 18 m de la caméra | niveau de détail réduit à 2 500 triangles, fabriqué à la composition |
| Personnages à l'écran | 2 joueurs et 10 habitants au plus près: 90 000 triangles dans le pire cas, soit un quart de la scène |
| Appels de dessin | 1 par personnage (pièces fusionnées à la composition), plus 1 pour toutes les onomatopées |
| Matériau | 1 programme pour tous les personnages; aucune texture par pièce; une texture de couleurs commune (32 cases par personnage) |
| Os | squelette commun unique; son choix (18 os du studio ou 24 os de Meshy) revient à l'essai du tech-artist |
| Éditeur de personnage et portraits de dialogue | scène à part, personnage seul: on peut y monter le lissage et l'ombre, pas le nombre de triangles |

Par pièce (plafonds): tête 1 400, pièces du visage 400 en tout, cheveux 1 200, pilosité 300, corps visible 1 500 (mains 250 chacune), haut 1 200, veste 1 400, bas 1 000, robe ou salopette 1 800, chaussures 500 la paire, chapeau 600, lunettes 200, sac ou accessoire 500.

## 2. Charte du personnage

Planche: `planches/01-gabarits.png`.

### 2.1 Proportions

Hauteurs au sommet du crâne, sans cheveux ni chapeau. « Têtes » = hauteur divisée par la hauteur de la tête.

| Âge | Hauteur | Tête (haut x large) | Têtes | Entrejambe | Taille | Base du cou | Remarques |
|---|---|---|---|---|---|---|---|
| Enfant (7 à 10 ans) | 1,22 m | 30 x 29 cm | 4,1 | 0,53 m | 0,67 m | 0,89 m | jambes courtes, tête presque aussi grosse que celle d'un adulte, cou très court |
| Adulte | 1,70 m (1,60 à 1,80 par mise à l'échelle de 0,94 à 1,06) | 34 x 31,5 cm | 5,0 | 0,80 m | 0,98 m | 1,33 m | proportions de la démo, conservées |
| Âgé | 1,62 m | 33,5 x 31 cm | 4,8 | 0,74 m | 0,92 m | 1,25 m | dos arrondi, épaules tombantes, tête avancée de 2 cm, genoux à peine fléchis |

Corpulences (largeurs de face, en cm):

| Corps | Carrure | Taille | Bassin | Bras | Jambe | Caractère |
|---|---|---|---|---|---|---|
| `body_child_slim` | 30 | 22 | 24 | 6 | 8 | menu, vif |
| `body_child_round` | 32 | 28 | 28 | 7 | 10 | potelé |
| `body_adult_slim` | 38 | 26 | 30 | 7 | 10 | élancé |
| `body_adult_medium` | 42 | 32 | 35 | 8,5 | 11,5 | le mannequin de référence |
| `body_adult_round` | 46 | 43 | 44 | 10 | 14 | ventre et hanches pleins, cou plus court de 1 cm |
| `body_elder_slim` | 35 | 26 | 30 | 6,5 | 9 | sec, fragile |
| `body_elder_medium` | 40 | 34 | 36 | 8 | 11 | ventre un peu en avant |
| `body_elder_round` | 42 | 44 | 44 | 9,5 | 13 | rond, assis sur ses hanches |

- Aucun choix de genre: les 8 corps sont neutres, toutes les pièces vont à tous (une jupe, une barbe ou une robe se portent sur n'importe quel corps du même âge).
- Les repères de couture (cou, taille, poignets, chevilles) sont à la même hauteur pour toutes les corpulences d'un même âge: seule la largeur change. C'est ce qui permet d'adapter une pièce par script.
- Les joueurs sont des adultes (3 corpulences, taille de 1,60 à 1,80 m). Enfants et âgés sont des habitants (question 3 de la section 8).

### 2.2 Corps, mains, pieds

- Torse en tonneau doux, épaules rondes sans carré, taille à peine marquée, aucun détail anatomique. Le corps nu est neutre et ne se voit que dans l'éditeur, en sous-vêtement uni (`#E4DCCB`).
- Mains: moufle arrondie de 9 cm, pouce détaché, les quatre doigts suggérés par trois sillons doux sur le dos. Pas de doigts animés (aucun des deux squelettes n'en a). La main fait partie du corps: elle n'est jamais couverte par une manche.
- Pieds: jamais nus en jeu. La chaussure remplace le pied: forme de galet, bout rond, 24 cm de long chez l'adulte (un peu grande, pour asseoir la figurine), semelle de 2 cm au moins.
- Cou: cylindre de 8,6 cm de diamètre, 3 à 5 cm visibles. C'est la pièce de liaison entre tête et col.

### 2.3 Tête et visage

Réponse 51: visages modélisés en relief. Une tête de Meshy n'a pas de cibles de morphose (fiche Meshy, section 8): on ne déforme donc pas la tête, on change et on bouge des pièces, comme sur une figurine d'animation en volume. Planche: `03-visages-onomatopees-nuancier.png`.

| Pièce | Relief | Animation |
|---|---|---|
| `head` (15 formes) | joues, menton, mâchoire, arcades, oreilles, orbites creusées de 6 mm; rides en sillons doux chez les âgés | aucune déformation |
| `nose` (6) | 2,5 à 5 cm de saillie, soudé à la tête à la composition | aucune |
| `eyes` (6 formes, 6 iris) | perle sombre brillante de 2,6 cm avec un reflet modelé, blanc visible selon la forme | regard: glissement de 3 mm; clignement et sommeil par la paupière (coque à la couleur de la peau qui pivote) |
| `brows` (5) | boudins de 4 à 5 cm, à la couleur des cheveux | deux pièces mobiles: montée, descente, inclinaison de 20 degrés au plus |
| `mouth` (jeu de 8) | lèvres en relief de 4 mm, intérieur sombre, dents en un bloc | remplacement d'une bouche par une autre; pendant un dialogue, alternance de deux bouches au rythme du babil |
| joues | pastille rosée de 4 cm, à peine bombée | apparaît sur la joie, la gêne, le froid |

- Niveau de détail: 13 éléments au plus sur un visage (2 yeux, 2 paupières, 2 sourcils, nez, bouche, 2 joues, 2 oreilles, menton). Pas de cils, pas de narines percées, pas de dents séparées.
- Lisibilité: sourcils et bouche doivent s'écarter de la peau d'au moins 25 points de clarté L*. Sur les peaux sombres (acajou, ébène), le blanc de l'œil est toujours visible et les lèvres prennent la teinte claire (`#F3D3BC` sur la planche); sur les peaux claires, sourcils jamais plus clairs que blond miel.
- À la distance de jeu, l'œil fait 2 à 4 pixels: l'émotion se lit d'abord par l'onomatopée, la pose et les sourcils. Le visage en relief se juge dans l'éditeur, les portraits du bandeau de dialogue et le zoom le plus proche.
- Au-dessus de la **ligne de chapeau** (1,58 m chez l'adulte), toutes les têtes d'un même âge ont exactement le même crâne (ellipsoïde de 31,5 x 30 cm): toutes les coiffures et tous les chapeaux vont à toutes les têtes. Les têtes ne diffèrent qu'en dessous.

### 2.4 Matières et couleurs

- Une pièce, une à trois couleurs: `principale`, `secondaire`, `motif`. Pas de texture, pas de motif imprimé: une rayure est une bande en léger relief, un bouton une pastille.
- La couleur se décide par pièce, jamais face par face: c'est la position du tech-artist dans la fiche Meshy (16.1, point 1), et je la fais mienne pour ce jeu. La texture de Meshy, quand on la paie, ne sert qu'à répartir les faces entre les emplacements de couleur, puis elle est jetée.
- Brillance par emplacement de couleur, pas par pièce: rugosité 0,85 (mat), 0,55 (satiné), 0,25 (brillant). Métal réservé au laiton et à l'acier des boucles.
- Occlusion douce cuite dans les couleurs de sommets (sous le menton, sous les bras, entre les jambes), comme pour les assets de Cosy Café.

Nuancier (`planches/source/nuancier.json`, clarté L* contrôlée):

| Famille | Teintes |
|---|---|
| Peaux (8) | porcelaine `#F6DCC8`, pêche `#EFC7A6`, miel `#E0AE86`, doré `#C99368`, noisette `#A9744D`, cannelle `#8A5A3B`, acajou `#6B432E`, ébène `#4A2F24` (L* de 89 à 22, pas réguliers) |
| Cheveux (10) | noir `#2B2523`, brun `#4A3327`, châtain `#6E4B33`, auburn `#8C4A2E`, roux `#AE5F2E`, blond miel `#C99A55`, blond paille `#E2C582`, gris `#9A948C`, blanc `#E9E5DC`, poivre et sel `#6A6763` |
| Cheveux réservés aux joueurs (3) | bleu nuit `#3E5578`, framboise `#A65C7C`, vert mousse `#6F8F5A` |
| Iris (6) | noisette `#6E4B33`, brun `#3A2A22`, gris `#6A6763`, bleu `#44618A`, vert `#3F6453`, ambre `#C0803A` |
| Tissus clairs | craie `#F3EDE0`, lin `#D9CAAE`, ficelle `#B8A17E`, perle `#B9B7B0`, ciel `#A9C7D9` |
| Tissus chauds | moutarde `#D4A33E`, ocre `#C0803A`, rouille `#A85837`, brique `#8F3B34`, coquelicot `#C5443D`, rose ancien `#CC9C96`, prune `#7E3F55`, noisette `#96704C`, chocolat `#5E4233` |
| Tissus froids | lilas `#A58BB8`, ardoise `#587F8E`, bleu de travail `#44618A`, marine `#2C3B57`, canard `#2F6E73`, sauge `#96A98C`, bouteille `#3F6453`, olive `#7A7B45` |
| Tissus sombres | anthracite `#4A4D52`, encre `#26282E` |
| Fixes | laiton `#C8A150`, acier `#8C8E91`, cuir `#8C5A35`, cuir sombre `#4F3626`, semelle `#3A3331`, caoutchouc clair `#EDE6D3`, œil `#2B2A33`, blanc de l'œil `#F7F3EA`, bouche `#A2473F`, joue `#E58E84` |

- Vérifié par le script: aucune paire de tissus à moins de 8 d'écart (CIEDE2000); aucune teinte de peau, de cheveux ou de tissu à moins de 15 d'une couleur de profil Duo (aqua, mauve, anis, corail, rose, vert), qui restent réservées à l'écusson des joueurs.
- Une tenue: une dominante, une secondaire, un accent au plus, et toujours un écart d'au moins 20 points de L* entre le haut et le bas, pour que la silhouette se lise en niveaux de gris.

### 2.5 Les deux joueurs

- Écusson du profil Duo en relief (pastille émaillée de 7 cm, couleur du profil, symbole et cerne `#0E1126`), sur le haut ou sur la veste portée. C'est la seule couleur vive d'un personnage.
- Anneau au sol à la couleur et au symbole du profil sous chaque joueur, visible à tous les zooms: un joueur se retrouve sans lire une teinte (forme du symbole et cerne sombre).
- Dans l'éditeur, si les deux joueurs choisissent la même dominante au même niveau de clarté, l'éditeur le signale sans l'interdire: l'écusson et l'anneau suffisent.

## 3. Architecture du catalogue

Planche: `planches/02-emplacements.png`.

### 3.1 Emplacements

| Emplacement | Contenu | Obligatoire | Remplace ou couvre | Se superpose à |
|---|---|---|---|---|
| `body` | un des 8 corps | oui | | |
| `head`, `nose`, `eyes`, `brows`, `mouth` | visage | oui | | |
| `hair` | coiffure, ou aucune (chauve) | non | variante `_hat` sous un chapeau | tête |
| `facial_hair` | barbe, moustache | non | | tête, sous les lunettes |
| `top` | t-shirt, chemise, pull, blouse | oui, sauf robe | masque torse et bras couverts | corps |
| `outer` | veste, gilet, manteau | non | | `top` (couche 2) |
| `bottom` | pantalon, short, jupe; ou robe, salopette | oui | une robe couvre `top` (champ `covers`); une salopette exige un `top` ajusté | corps |
| `shoes` | chaussures | oui | remplacent les pieds | |
| `hat` | chapeau, coiffe | non | appelle la variante `_hat` de la coiffure (sauf bandeau) | cheveux |
| `glasses` | lunettes | non | | visage |
| `neck` | écharpe, foulard, cravate, châle | non | | col du haut ou de la veste |
| `back`, `side` | sac à dos, hotte; besace, sacoche | non | | couche portée la plus haute |
| `waist` | tablier, ceinture, banane | non | | haut et bas |
| `hand` | canne, panier (objet tenu par habitude) | non | cède la main aux outils | main droite |
| `badge` | écusson du profil | joueurs | | couche portée la plus haute |

### 3.2 Pour que les pièces s'emboîtent sans se traverser

1. **Volumes d'encombrement par couche**, mesurés depuis la surface du corps de même corpulence: couche 1 (`top`, `bottom`) de 1 à 2,5 cm; couche 2 (`outer`) de 2,5 à 5 cm; sangles et tabliers de 5 à 6 cm. Jupes et robes libres vers l'extérieur sous la taille. Une pièce qui sort de son volume est refusée à la conformité.
2. **Sections du corps masquées**: le corps est découpé en `head`, `neck`, `torso`, `upper_arm`, `forearm`, `hand`, `pelvis`, `thigh`, `shin`. Chaque pièce déclare ce qu'elle cache (`hides`); le jeu retire ces sections à la composition. Il n'y a donc jamais de peau sous un vêtement, donc rien qui traverse quand le personnage bouge, et moins de triangles.
3. **Coutures cachées par un bord épais** (8 à 12 mm), toujours du côté du vêtement:
   - cou: le col du haut monte à 1,34 m et recouvre la base du cou (1,33 m); un haut sans col a une bande d'encolure;
   - taille: le haut tombe au moins 5 cm sous la taille (ourlet en bourrelet), ou bien il est déclaré rentré (`tucked`) et c'est la ceinture du bas qui monte de 3 cm;
   - poignets: toute manche finit par un revers ou un bourrelet; manche longue arrêtée 1 cm avant la main, manche courte à mi-bras, manche retroussée sous le coude; jamais de coupe entre deux;
   - chevilles: le bas du pantalon tombe 2 cm sur la chaussure, ou la tige de la botte monte par-dessus un pantalon étroit. Chaque bas porte `ankle: slim | wide`, chaque chaussure `shaft: low | high`; `wide` avec `high` est interdit par les données, pas par un bricolage du rendu.
4. **Calotte commune** (2.3): chapeaux et coiffures sont modelés sur le même crâne. Sous un chapeau, la coiffure passe à sa variante `_hat` (rasée au-dessus de la ligne, fabriquée par script). Les oreilles restent dégagées: aucun chapeau ne descend sous 1,53 m, sauf fichu et suroît, qui masquent la coiffure entière.
5. **Longueurs permises**: rien de rigide sous le genou. Manteau à mi-cuisse au plus (le manteau long de l'essai Meshy se déformait en tente une fois assis); jupe longue à mi-mollet, en cloche large; cheveux longs à mi-dos au plus, en une masse qui suit le cou et le haut du dos.
6. **Sangles**: le sac vient de Meshy, sa sangle est fabriquée par script sur le volume de la couche portée (une version couche 1, une version couche 2), pour ne jamais flotter ni mordre.
7. **Corpulences et âges**: chaque pièce est modelée une fois sur le mannequin adulte moyen, puis adaptée aux 7 autres corps par la même déformation que celle qui a produit ces corps (cage commune, script Blender). Les pièces réservées aux enfants ou aux âgés sont modelées sur leur mannequin.
8. **Pose de référence**: pose en A, bras écartés de 40 degrés, pieds écartés de 20 cm. À confirmer par l'essai d'assemblage du tech-artist.

### 3.3 Couleurs et variantes

- Une variante de couleur est une donnée, jamais un maillage: `top_sweater_crew.moutarde` désigne le pull et son coloris. Chaque pièce déclare ses emplacements de couleur (1 à 3) et 4 à 8 coloris nommés, tirés du nuancier; les joueurs peuvent en plus teindre librement dans le nuancier chez un commerçant (proposition au game designer).
- Rangée de couleurs par personnage (32 cases): peau, ombre de peau, lèvres, joues, iris, cheveux, sourcils, puis 3 cases par emplacement visible (`top`, `outer`, `bottom`, `shoes`, `hat`), 2 pour `neck`, `back` ou `side`, `waist`, 1 pour `glasses`, et les fixes (laiton, acier, semelle, blanc de l'œil, profil, cerne du profil).

### 3.4 Pièces pour tous, pour les joueurs, pour les habitants

| Marque | Sens | Exemples |
|---|---|---|
| T | tous: l'éditeur, les boutiques et le compositeur d'habitants | t-shirt, pantalon droit, bottines, casquette plate |
| J | joueurs seulement: tenues de départ, récompenses, pièces de ville voyantes, teintes de cheveux de fantaisie | sweat à capuche, baskets épaisses, lunettes de soleil, écusson |
| H | habitants seulement: métiers, uniformes, âges | veste et casquette de chef de halte, képi, calot, châle, canne, cartable, charentaises |

Un habitant qui compte dans une suite de quêtes reçoit une **pièce signature** H que personne d'autre ne porte dans son lieu. Les pièces H de métier ne sont jamais vendues: un joueur ne peut pas se déguiser en chef de halte par hasard (une récompense de fin de quête peut l'offrir, au choix du game designer).

### 3.5 Composer un habitant (réponses 36 et 50)

Tous les habitants sortent du même catalogue, avec le même budget: pas de différence de qualité entre un personnage de quête et un passant. Ce qui change, c'est le soin de la composition.

- Habitants de quête: composés à la main par le directeur artistique avec le game designer (fiche: corps, tête, coiffure, tenue, pièce signature, deux coloris de saison), validés sur capture.
- Habitants secondaires: tirés par le jeu d'après une graine, puis filtrés par ces règles:
  1. silhouette d'abord: dans un même lieu, jamais deux habitants avec le même couple coiffure et chapeau, ni le même trio corps, tête et nez;
  2. deux habitants d'un même lieu diffèrent par au moins 4 emplacements visibles, dont la dominante de couleur;
  3. une tenue suit la règle des couleurs de 2.4 et la palette du lieu (section 7);
  4. l'âge commande: pièces H d'âge possibles seulement sur leur corps; pas de barbe sur un enfant;
  5. le registre des compositions déjà sorties est gardé dans la sauvegarde: une composition ne ressort jamais, même dans un autre lieu.
- Ordre de grandeur: avec la seule vague 1 (7 têtes, 3 nez, 3 formes d'yeux, 8 coiffures, 8 hauts, 8 bas ou robes), les combinaisons valides se comptent en dizaines de milliers avant même les couleurs.

### 3.6 Nomenclature

- Identifiant: `<emplacement>_<forme>`, en anglais, `snake_case`, stable à vie (`hat_cap_flat`). Variante technique après deux tirets bas: `hair_bob__hat`, `top_tee_crew__adult_round`, `side_messenger__l2`. Coloris après un point: `hat_cap_flat.bouteille`.
- Sources, une pièce par dossier: `games/la-petite-ligne/assets-src/modeles/catalogue/<emplacement>/<identifiant>/` avec `reference.png` (et `reference-dos.png`), `<identifiant>.meshy.json` (fiche de génération), les réglages de conformité.
- Livrés: `games/la-petite-ligne/assets/modeles/catalogue/<emplacement>.glb`, un nœud par pièce et par corps (proposition; le découpage en fichiers revient à l'architecte et au tech-artist).
- Données: `games/la-petite-ligne/donnees/catalogue-personnages.json` (emplacement, `hides`, `covers`, `ankle`, `shaft`, `tucked`, marque T, J ou H, âges permis, emplacements de couleur, coloris, lieu d'origine, vague).

## 4. Premier catalogue

164 lignes: 131 pièces à générer avec Meshy et 33 scriptées dans Blender (corps dérivés, pièces du visage, lunettes: trop fines ou trop simples pour Meshy, qui signale mal les pièces de moins de 1 cm). S'y ajoutent les 6 écussons de profil, repris de l'existant.

Lecture des tableaux:

- **Consigne**: la forme seule, en anglais (langue de l'outil). Elle sert à produire l'image de référence et, sur la route texte, se complète du préfixe et des exclusions de la section 5.2. Pour les pièces scriptées, c'est une description en français.
- **Pour**: T, J ou H (3.4). **Couleurs**: emplacements de couleur. **Route**: A = maillage seul (5 crédits), B = avec texture de répartition (15 crédits), S = script Blender (0 crédit). **Vague**: 1, 2 ou 3.

@@CATALOGUE@@
### 4.1 Ordre de production

| Vague | But | Pièces Meshy | Pièces scriptées |
|---|---|---|---|
| Étalonnage | 6 pièces témoins pour figer la route et le rendu avant toute série: mannequin adulte, `head_round`, `hair_bob`, `top_sweater_crew`, `bottom_pants_straight`, `shoes_boots_ankle` (elles comptent dans la vague 1 si elles sont bonnes) | 6 | visage de base |
| 1 | habiller les deux joueurs avec du choix (4 têtes adultes, 7 coiffures, 5 hauts, 3 vestes, 5 bas, 3 robes ou salopettes, 5 chaussures) et 6 habitants d'Aubrune très différents | 52 | 17 |
| 2 | élargir l'éditeur et la boutique d'Aubrune, deuxième série d'habitants | 42 | 11 |
| 3 | pièces de ville (métropole) et compléments, pièces J de récompense | 37 | 5 |

Les 6 habitants témoins de la vague 1 sont des archétypes de contrôle, choisis pour éprouver les 6 corps les plus éloignés; leurs noms et leurs rôles reviennent au game designer.

| Archétype | Corps | Tête, visage | Coiffure, coiffe | Tenue | Signature |
|---|---|---|---|---|---|
| Chef de halte | `body_elder_round` | `head_elder_jowly`, nez rond, `mustache_handlebar` | `hair_bun_low` remplacé par crâne nu sous `hat_cap_station` | `outer_jacket_station` marine, `top_shirt_collar` craie, `bottom_pants_straight` anthracite, `shoes_boots_ankle` | casquette et veste d'uniforme |
| Boulangère | `body_adult_round` | `head_round`, nez bouton | `hair_bun_high` roux, `hat_baker_cap` | `top_blouse_puff` craie, `bottom_skirt_long` rose ancien, `waist_apron_bib` lin, `shoes_clogs` | calot et tablier |
| Gamine du bourg | `body_child_slim` | `head_child_round`, yeux ovales | `hair_pigtails` châtain | `top_tee_crew` moutarde, `onepiece_overalls` bleu de travail, `shoes_sneakers_canvas` coquelicot, `back_school` | couettes et cartable |
| Factrice | `body_adult_slim` | `head_heart`, nez long, `glasses_round` | `hair_ponytail` noir, `hat_cap_flat` | `top_shirt_work` ciel, `bottom_shorts_bermuda` marine, `shoes_boots_ankle`, `side_satchel_postal` | sacoche débordante |
| Grand-mère | `body_elder_slim` | `head_elder_gaunt`, nez long, `glasses_half` | `hair_bun_low` blanc | `onepiece_dress_granny` prune, `neck_shawl` lilas, `shoes_mary_janes`, `hand_cane` | châle et canne |
| Menuisier | `body_adult_medium` | `head_square`, nez rond, `beard_full` | `hair_crop`, `hat_beanie_fisher` | `top_shirt_work` rouille, `bottom_pants_work` olive, `waist_apron_bib` cuir, `shoes_boots_ankle` | barbe, bonnet court, tablier de cuir |

## 5. Production avec Meshy

### 5.1 Route recommandée

1. **Image de référence** (directeur artistique): la pièce seule, comme portée par un mannequin invisible, en pose en A, de trois quarts face, fond uni gris clair, couleurs du coloris par défaut avec des emplacements de couleur bien séparés (au moins 20 d'écart CIEDE2000 entre eux), rien d'autre dans l'image. Vue de dos pour les pièces qui en ont une (sacs, capuches, coiffures longues). Fabrication: rendu du mannequin gris du studio dans Blender, puis `meshy_image_to_image` (`nano-banana`, 3 crédits) pour habiller la vue, ou dessin SVG du directeur artistique pour les formes simples. La référence est validée avant de payer la 3D, et versionnée.
2. **Image vers 3D**, modèle `meshy-t2.5` en topologie intelligente, `target_polycount` au budget de la pièce plus 20 %, `target_formats: ["glb"]`. Route A: `should_texture: false` (5 crédits) quand la pièce a un seul emplacement de couleur. Route B: texture `meshy-n1` (15 crédits) quand il faut répartir les faces entre 2 ou 3 emplacements; la texture est jetée ensuite.
3. **Pourquoi l'image et pas le texte**: l'essai du studio montre que la route image suit fidèlement la référence (forme et couleurs) alors que la route texte dérive (une machine à un groupe au lieu de deux). Un catalogue demande un air de famille et des cotes tenues: c'est la référence qui les porte. Le texte vers 3D (5 crédits) reste utile pour les formes sans piège (galets, chapeaux simples) ou pour dégrossir.
4. **Jamais** `meshy-7.1`, ni 4K, ni PBR, ni géométrie Ultra (règles de la fiche); jamais plus de deux essais par pièce avant de reprendre la référence.
5. **Corps, squelette, poids de peau, pièces du visage, variantes `_hat`, sangles, adaptation aux corpulences**: scripts Blender du studio. Meshy ne rigge pas nos pièces: elles héritent des poids du corps par transfert.

Réserve à lever par l'essai du tech-artist: un vêtement généré seul peut sortir fermé aux ouvertures ou mal proportionné. Solution de repli si le recalage coûte trop cher: les vêtements près du corps (t-shirt, pantalon droit, short) sont obtenus par épaississement des sections du corps dans Blender, avec bords modelés, et Meshy garde ce qu'il fait le mieux, c'est-à-dire tout ce qui a du volume: têtes, cheveux, barbes, pulls, vestes, jupes, robes, chaussures, chapeaux, sacs. Le catalogue et les crédits baisseraient d'environ un cinquième.

### 5.2 Consigne commune (route texte et images de référence)

Préfixe: « smooth vinyl toy figurine style, soft rounded shapes, thick rounded edges, matte flat colors, single object, plain light grey background, ».

Exclusions, en fin de consigne (l'outil n'a pas de consigne négative): « no body, no mannequin, no face, no texture detail, no fabric grain, no pattern, no text, no logo, no photorealism ».

Pour les têtes: remplacer « no body, no mannequin, no face » par « no hair, no eyes, no nose, no mouth ».

### 5.3 Mise en conformité et contrôles

| # | Contrôle | Seuil | Qui |
|---|---|---|---|
| 1 | Quatre angles en gris avant tout travail | silhouette lisible, style « figurine », pas de détail fin | artiste-3d, puis directeur artistique |
| 2 | Recalage sur le mannequin, échelle, repère, pose | repères de couture à 5 mm près | script |
| 3 | Volume d'encombrement de l'emplacement | aucune face hors volume, aucune sous la couche du dessous | script |
| 4 | Budget de triangles, trous bouchés, faces retournées, pièces de moins de 1 cm | plafonds de 1.4 | script |
| 5 | Emplacements de couleur: une couleur par pièce | moins de 2 % de surface en taches | script, puis œil |
| 6 | Lissage: normales lissées, arêtes de plus de 50 degrés gardées | aucune facette visible au zoom le plus proche | œil |
| 7 | Adaptation aux 8 corps et variantes | aucune traversée en pose de repos | script |
| 8 | Traversées en mouvement: marche, course, assis, accroupi, bras levés, porter, sur les 3 corpulences | aucune peau ni couche du dessous visible | captures, directeur artistique |
| 9 | Planche d'essayage: la pièce portée avec 5 pièces voisines tirées au hasard | air de famille, coutures cachées | directeur artistique |
| 10 | Lisibilité au zoom de jeu, en gris et sous simulations de daltonisme pour les joueurs | haut et bas séparés de 20 points de L* | directeur artistique |
| 11 | Fiche `.meshy.json` complète, référence versionnée, sortie brute non versionnée | contrôle automatique | CI |

Une pièce refusée deux fois change de référence ou passe en script: on ne s'acharne pas avec des crédits.

### 5.4 Crédits

Hypothèses: référence par image à 3 crédits, refaite une fois sur trois (4 en moyenne); une génération 3D sur deux à refaire (hypothèse de la fiche Meshy); marge de 30 %. Soit 11,5 crédits par pièce en route A et 26,5 en route B, avant marge.

| Vague | Route A | Route B | Sous-total | Avec marge de 30 % |
|---|---|---|---|---|
| 1 (étalonnage compris) | 30 | 22 | 928 | 1 210 |
| 2 | 25 | 17 | 738 | 960 |
| 3 | 17 | 20 | 726 | 945 |
| **Total** | 72 | 59 | 2 392 | **3 115** |

- Solde: 2 323 crédits, environ 3 000 de plus par mois; les crédits mensuels expirent à la remise à zéro (le 7 du mois d'après la fiche Meshy). Proposition: vague 1 tout de suite (environ 1 210), puis le début de la vague 2 avec ce qui reste avant la remise à zéro, en gardant 300 crédits pour l'essai du tech-artist et les reprises; fin de la vague 2 et vague 3 sur les crédits du mois suivant, ce qui laisse encore environ 1 500 crédits pour la première série de meubles.
- Ces chiffres sont une estimation: aucun crédit n'a été dépensé dans cette mission. Le premier chiffre réel sera celui de l'étalonnage (6 pièces, 60 à 160 crédits).

## 6. Expressions et onomatopées

Planche: `planches/03-visages-onomatopees-nuancier.png`.

### 6.1 Expressions du visage

Huit expressions, chacune faite d'une bouche, d'une position de sourcils et d'un état de paupières: neutre, joie, surprise, réflexion, gêne, peine, colère, sommeil. Plus le clignement (toutes les 3 à 6 s) et le babil (deux bouches alternées). Chaque caractère (réponse 44) a son visage de repos: le grincheux part sourcils bas, le rêveur paupières mi-closes, le bavard bouche entrouverte.

### 6.2 Onomatopées

| Signe | Sens | Couleur | Quand |
|---|---|---|---|
| « ! » | surprise, remarque | coquelicot | un habitant vous aperçoit, une touche à la pêche, un objet trouvé |
| « !!! » | alarme, choc | coquelicot, plus gros, tremblant | rebondissement de quête, frayeur (village hanté) |
| « ? » | question | ardoise | l'habitant ne comprend pas, objet inconnu |
| « ?? » | perplexité | ardoise, deux signes inclinés | dialogue raté, énigme |
| « ?! » | incrédulité | prune | révélation |
| « ... » | attente, silence | perle, les points arrivent un à un | réflexion, gêne, écoute |
| note | joie, sifflote | moutarde | bonne humeur, musique, cadeau reçu |
| cœur | tendresse, amitié | rose ancien | un cœur d'amitié gagné |
| « Zzz » | sommeil | lilas, lettres de taille croissante | sieste, fatigue du joueur |
| « grr » | colère | brique, lettres serrées | habitant vexé |
| « pff » | lassitude, odeur | olive | remarque d'hygiène (réponse 23), ennui |
| « ha ha » | rire | moutarde, deux mots qui sautent | blague, moment drôle |

- **Dessin**: lettrage original du studio, dessiné en SVG par l'artiste 2D (pas une police du commerce): lettres grasses et rondes, un peu de travers, remplies d'une couleur du nuancier, liseré clair `#FFF8E8`, cerne d'encre `#2B2A33`, petite ombre décalée. Chaque famille a sa couleur **et** sa forme (signe, nombre, inclinaison): rien ne repose sur la teinte seule. Le cerne et le liseré les gardent lisibles sur l'herbe, la pierre et la nuit.
- **Où**: à 25 cm au-dessus du sommet de la tête ou du chapeau, face à la caméra, à taille d'écran constante (32 pixels de haut au moins à 1366 x 768, quel que soit le zoom). Elles passent devant le décor. Les mêmes dessins servent près du portrait dans le bandeau de dialogue et dans le carnet.
- **Mouvement**: jaillit en 0,18 s (de 0 à 115 % puis 100 %), deux petites secousses, tient 1,2 s, s'efface en 0,25 s. Une seule à la fois par personnage; la plus récente chasse l'autre.
- **Technique**: une planche unique de signes, tous les signes de l'écran en un seul appel de dessin.
- **À ne pas confondre** avec la bulle « j'ai quelque chose pour toi » (réponse 69): celle-ci est une vraie bulle blanche à pictogramme, fixe et durable; l'onomatopée est un lettrage nu et bref.

## 7. Les lieux, puis meubles, bâtiments, paysage

Les trois lieux partagent les piliers, les personnages, les règles de forme et le nuancier des tissus. Chacun a sa lumière, ses matières et une dominante que les autres n'ont pas. Les palettes ci-dessous sont des intentions à affiner dans les versions consacrées au décor.

### 7.1 Aubrune: le bourg de campagne autour de sa halte

- **Ambiance**: tendre, ensoleillée, un peu passée. La maquette d'un bourg où tout est à portée de pas.
- **Palette**: herbe `#93B45E`, chemins de terre claire `#CFB489`, pierre crème `#C0B4A1`, lauzes `#737B86`, tuiles `#B86B4F`, enduit crème `#EBDCBF`, volets rouge cheminot `#9B4C3B`, sauge `#7F9C79`, bleu `#7090A5` (palette de la démo, conservée et lissée).
- **Lumière**: soleil chaud et bas le matin et le soir, ombres longues et douces; nuit bleue trouée de fenêtres ambrées `#FFC874`.
- **Matières**: pierre et bois peints à la main, arbres en boules de mousse, eau en résine lisse et brillante.
- **Architecture**: maisons basses d'un étage, toits qui débordent, halte à marquise, murs un peu ventrus, rien de tiré à la règle. Tenues des habitants: chauds et sauge, toiles de travail, tabliers.

### 7.2 La métropole

- **Ambiance**: vive, dense, drôle. La maquette d'une grande ville de province: boulevards, passages, gare à verrière, commissariat, commerces. Le mystère y prend la forme d'une enquête.
- **Palette**: pierre blonde `#D8C9A8`, brique `#A8604A`, zinc des toits `#8C99A3`, fonte vert sombre `#3F6453`, pavé `#9A948A`, chaussée `#6B6661`, stores coquelicot `#C5443D` et craie, enseignes émaillées marine `#2C3B57` et moutarde `#D4A33E`, vitrines ambrées.
- **Lumière**: plus contrastée; grandes ombres portées des immeubles qui découpent la rue, matins gris perle, soirs dorés entre les façades; la nuit, les fenêtres et les enseignes éclairent par émission (pas de lumières ponctuelles en plus des quatre permises).
- **Matières**: pierre taillée lisse, fonte et laiton satinés, verre brillant, affiches en aplats sans texte lisible.
- **Architecture**: immeubles de 3 à 5 niveaux en modules répétés (rez-de-chaussée commerçant, étages, toit de zinc à lucarnes), que la caméra coupe au-dessus du premier étage quand on entre. Tenues: neutres sombres et clairs avec un accent vif, vestes de ville, chapeaux de feutre.

### 7.3 Le village abandonné et hanté

- **Ambiance**: mélancolique et taquine, jamais horrifique (réponse 8: tendre et drôle, avec du mystère). Une maquette oubliée au grenier, sous la poussière, que l'on répare en aidant ses esprits.
- **Palette**: pierre moussue `#8E9488`, bois gris `#7A746B`, ardoise sombre `#4E5560`, herbes folles `#7F8E62`, lierre `#4F6B4A`, brume `#C5CFCF`; une seule couleur surnaturelle, le vert d'eau pâle des esprits `#CFEFE2` (vérifié à plus de 15 de toutes les couleurs de profil), face à l'ambre des lanternes des joueurs `#FFC264`.
- **Lumière**: jour voilé, sans ombres dures; brume au sol en nappes plates; la nuit, deux familles de lueurs seulement, froide pour les esprits, chaude pour les vivants. Quand une suite de quêtes apaise un esprit, son coin du village retrouve des couleurs: la palette se réchauffe par quartier.
- **Matières**: mêmes surfaces lisses, mais peinture écaillée en grands aplats, toiles d'araignée en voiles pleins, vitres ternes.
- **Architecture**: les modules d'Aubrune, affaissés: toits fléchis, volets pendants, portes de guingois, lierre. Les esprits sont des figurines du même catalogue en une seule teinte pâle et lumineuse, sans jambes (le bas finit en volute), rendues en tramage plutôt qu'en transparence.

### 7.4 Ordre de production après les personnages

1. **Meubles**, par séries assorties en plusieurs couleurs (réponse 57). Emplacements de couleur d'un meuble: `bois`, `peinture`, `tissu`, `metal`; 4 coloris par série; 300 à 1 500 triangles, 2 500 pour les grandes pièces. Meshy pour les formes organiques, script pour les formes droites (méthode de la fiche Meshy). Premières séries proposées pour Aubrune, 10 à 12 pièces chacune:

| Série | Esprit | Pièces | Coloris |
|---|---|---|---|
| Récup | la maison en ruine du début: on fait avec ce qu'on trouve | caisse, paillasse, tabouret, étagère de planches, réchaud, seau, lanterne, malle, table sur tréteaux, patère | bois brut, bois gris, peint écaillé sauge, peint écaillé bleu |
| Campagne | cuisine et salle de ferme | table de ferme, chaise paillée, banc, buffet, vaisselier, évier de pierre, cuisinière à bois, plan de travail, garde-manger, pendule, suspension, tapis tressé | miel, crème, sauge, ardoise |
| Chambre douce | chambre et coin à soi | lit, chevet, armoire, commode, miroir, fauteuil, lampe, tapis, coffre, paravent | crème et rose ancien, miel et moutarde, bleu de travail, bouteille |
| Halte | objets de gare, souvenirs de la ligne | banc de quai, horloge, guichet, chariot à bagages, lampe d'aiguilleur, porte-manteau, cadre d'affiche, malle de voyage, panneau de quai, tabouret de chef de halte | vert sombre, rouge cheminot, crème, noir |
| Jardin | autour de la maison (réponse 53) | banc, table ronde, chaise pliante, jardinière, tonnelle, lanterne, arrosoir décoratif, nichoir, bordure, brouette fleurie | blanc cassé, sauge, coquelicot, canard |

   Suivront une série de cuisine complète (réponse 32), puis pour la métropole un appartement de ville et un bistrot, et pour le village hanté un grenier et une veillée.

2. **Bâtiments**: mêmes règles de forme, lissées; modules de murs, toits et ouvertures communs à un lieu, pour composer et pour agrandir la maison pièce par pièce (réponse 54). D'abord la maison en ruine et ses états, la halte, deux commerces.
3. **Paysage**: sol, chemins, eau, arbres et buissons en boules de mousse lisses, rochers en galets; en dernier parce que c'est ce qui supporte le mieux d'attendre et ce qui pèse le plus dans le budget de triangles.

## 8. Questions pour le client et risques

### 8.1 Questions (chacune avec une recommandation)

1. **Le fil rouge « maquette de train miniature »** (personnages en figurines, monde en diorama) te convient-il pour les trois lieux ? Recommandation: oui; c'est ce qui rend le « lisse et doux » cohérent partout et propre à ton jeu.
2. **Visages à pièces de rechange** (sourcils qui bougent, paupières, 8 bouches en relief) plutôt qu'un visage qui se déforme ? Recommandation: oui; c'est franc, lisible, et compatible avec des têtes générées.
3. **Vos deux personnages sont-ils forcément des adultes**, avec 3 corpulences et une taille réglable ? Recommandation: oui; enfants et âgés restent des habitants.
4. **Aucun choix de genre**: tous les vêtements, coiffures et barbes vont à tous les corps. Recommandation: oui.
5. **Teintes de cheveux de fantaisie** (bleu nuit, framboise, vert mousse) réservées à vos personnages ? Recommandation: oui, trois, pas plus.
6. **Crédits**: lancer la vague 1 maintenant (environ 1 210 crédits sur 2 323), après 6 pièces témoins que tu verras avant la série ? Recommandation: oui; les crédits du mois se perdent s'ils ne servent pas.

### 8.2 Risques

| Risque | Parade |
|---|---|
| Les vêtements générés seuls s'ajustent mal au corps (ouvertures fermées, proportions) | essai du tech-artist, étalonnage de 6 pièces, solution de repli de 5.1 |
| Dérive de style d'une pièce à l'autre (131 générations) | même mannequin et mêmes réglages de référence, planche d'essayage (contrôle 9), deux essais au plus |
| Pièces molles ou fondues vues de près (la caméra se rapproche, réponse 17) | bords épais imposés dans les références, reprise dans Blender, refus sans état d'âme |
| Visage en relief peu lisible à la distance de jeu | onomatopées, sourcils épais, pose; le visage se juge de près |
| Combinaisons laides ou jumelles dans les habitants tirés au sort | règles de 3.5, registre, validation sur planche des habitants de quête |
| Coût en performances du lissé et de 12 personnages de 9 000 triangles | niveau de détail réduit au loin, sections masquées, un appel de dessin par personnage, mesure sur le PC dès la vague 1 |
| Adaptation automatique aux 8 corps imparfaite sur les pièces amples | contrôle 7 et 8; au besoin, pièce remodelée pour le corps rond |
| Crédits sous-estimés | chiffres réels dès l'étalonnage, marge de 30 %, routes A et S privilégiées |
| Ressemblance involontaire avec un jeu de vie connu | proportions de 5 têtes, visage en relief, palette et lettrage propres; revue à chaque vague |

## 9. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-11-10 | 0.1 | Première version: direction de la refonte, charte du personnage, architecture et liste du premier catalogue, méthode Meshy et crédits, onomatopées, trois lieux, séries de meubles | directeur artistique |
