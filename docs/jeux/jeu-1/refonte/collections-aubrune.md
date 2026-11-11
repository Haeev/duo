# Collections d'Aubrune

Version 1 du 2026-11-11 (game-designer). Complète le cahier des charges (4.7 et 4.8) pour le premier lieu. Les valeurs vivent dans les données du jeu (`games/la-petite-ligne-2/donnees/`); les tableaux ci-dessous en sont tirés. En cas d'écart, les données font foi.

Principe (réponse du client: « toutes activités qui s'adaptent au lieu actuel »): chaque entrée est rattachée à Aubrune (`place: "aubrune"`) et à un endroit réel du plan, et s'obtient par une brique qui existe déjà: la pêche (coins de `lieu.json`), le filet (zones de `nature.json`), la bêche (sols qui scintillent), le potager (cultures), la cuisine (recettes), l'appareil photo (sujets), et les effets d'histoire `give_entry`, `give_recipe`, `give_item` posés à la fin d'étapes de quêtes déjà écrites. Aucun code du moteur n'a changé.

Test: `tests/collections-aubrune.test.ts` vérifie les comptes et que chaque entrée est atteignable (lieu réel, condition possible avec le climat d'Aubrune, source branchée sur une quête, un commerce ou la carte).

| Collection | Cahier | Livré | Comment |
|---|---|---|---|
| Poissons | 16 | 16 | pêche, 6 coins |
| Insectes | 16 | 16 | filet, 16 zones |
| Fossiles et trésors | 12 | 12 | fouilles (10), histoire (2) |
| Fleurs | 12 | 12 | potager: 8 graines en rayon, 4 reçues dans l'histoire |
| Recettes | 18 | 18 | 8 existantes, 10 nouvelles |
| Cartes postales | 12 | 12 | appareil photo, 12 points de vue |
| Musiques | 8 | 8 | 7 étapes d'histoire, 1 événement (fiches seulement) |

## 1. Poissons (16)

Rareté au tirage d'une ombre: commune x1, peu commune x0,45, rare x0,15 (réglage de la pêche). Prix: meilleur rachat, au Café de la Halte.

| Poisson | Coins (poids) | Heures | Météo | Saisons | Rareté | Prix (€) |
|---|---|---|---|---|---|---|
| Ablette | ponton (eau calme) 4, aval (eau vive) 2, vanne (déversoir) 2 | 6 h à 0 h | tous | tous | commune | 2,40 (Café de la Halte) |
| Anguille | fosse du bief 1, saule de l'Île (bief) 1, vanne (déversoir) 1 | 21 h à 5 h | couvert, pluie, orage | été, automne | rare | 8,40 (Café de la Halte) |
| Barbeau | aval (eau vive) 2, fosse du bief 1 | 18 h à 6 h | tous | printemps, été, automne | peu commune | 5,20 (Café de la Halte) |
| Brème | ponton (eau calme) 1, fosse du bief 2, étang de la Côte 2 | 6 h à 0 h | couvert, pluie, brume | tous | peu commune | 4,20 (Café de la Halte) |
| Brochet | fosse du bief 1, vanne (déversoir) 2 | 9 h à 19 h | tous | été, automne, hiver | rare | 12,00 (Café de la Halte) |
| Carpe de l'étang | étang de la Côte 1 | 19 h à 7 h | beau, couvert | été, automne | rare | 9,60 (Café de la Halte) |
| Chevesne | aval (eau vive) 2, vanne (déversoir) 1 | 9 h à 19 h | beau | printemps, été | peu commune | 4,40 (Café de la Halte) |
| Gardon | ponton (eau calme) 4, saule de l'Île (bief) 3, étang de la Côte 2 | 6 h à 0 h | tous | tous | commune | 2,60 (Café de la Halte) |
| Goujon | ponton (eau calme) 4, aval (eau vive) 2, fosse du bief 3, saule de l'Île (bief) 3, étang de la Côte 2 | 6 h à 0 h | tous | tous | commune | 2,90 (Café de la Halte) |
| Loche franche | aval (eau vive) 2, vanne (déversoir) 3 | 6 h à 12 h | tous | tous | commune | 2,20 (Café de la Halte) |
| Ombre commun | aval (eau vive) 1, vanne (déversoir) 1 | 7 h à 11 h | beau, brume | automne, hiver | rare | 8,80 (Café de la Halte) |
| Perche | ponton (eau calme) 2, fosse du bief 3, saule de l'Île (bief) 2, étang de la Côte 2 | 9 h à 19 h | tous | tous | peu commune | 4,80 (Café de la Halte) |
| Rotengle | ponton (eau calme) 2, saule de l'Île (bief) 2, étang de la Côte 3 | 10 h à 20 h | beau, couvert | printemps, été, automne | commune | 2,80 (Café de la Halte) |
| Tanche | fosse du bief 2, saule de l'Île (bief) 2, étang de la Côte 3 | 18 h à 6 h | beau, couvert | été, automne | peu commune | 6,00 (Café de la Halte) |
| Truite fario | aval (eau vive) 3, vanne (déversoir) 2 | 6 h à 0 h | pluie, couvert, brume | printemps, été, automne | rare | 7,20 (Café de la Halte) |
| Vairon | aval (eau vive) 3, vanne (déversoir) 2 | 7 h à 20 h | tous | printemps, été, automne | commune | 2,00 (Café de la Halte) |

## 2. Insectes (16)

Au filet, dans les zones de `nature.json` (section 8). Rareté: poids de tirage parmi les espèces possibles (10 commun, 1 rare). Ils ne donnent pas d'objet: seulement l'entrée du carnet, donc aucun prix.

| Insecte | Terrains | Heures | Météo | Saisons | Poids |
|---|---|---|---|---|---|
| Anax empereur | berge | 10 h à 17 h | beau | été | 2 |
| Bourdon des prés | pré, potager | 7 h à 19 h | beau, couvert | printemps, été | 8 |
| Caloptéryx éclatant | berge | 9 h à 18 h | beau | printemps, été | 5 |
| Carabe des bois | bois | toute heure | pluie, brume, couvert | tous | 4 |
| Coccinelle à sept points | potager, pré | 7 h à 19 h | tous | printemps, été, automne | 8 |
| Criquet des pâtures | pré | 10 h à 19 h | beau | été, automne | 10 |
| Écaille chinée | réverbères | 21 h à 3 h | beau, couvert, brume | été | 4 |
| Gerris | berge | 7 h à 20 h | beau, couvert, brume, pluie | printemps, été, automne | 8 |
| Grand paon de nuit | réverbères | 21 h à 1 h | beau, couvert | printemps | 1,5 |
| Grande sauterelle verte | pré, lisière | 17 h à 23 h | beau | été | 4 |
| Hanneton commun | réverbères, lisière | 20 h à 23 h | beau | printemps | 4 |
| Lucane cerf-volant | bois, lisière | 19 h à 23 h | beau, couvert | été | 1,5 |
| Paon-du-jour | lisière, pré | 10 h à 17 h | beau | tous | 5 |
| Papillon citron | pré, lisière | 6 h à 20 h | beau, couvert | printemps, été | 10 |
| Piéride du chou | potager | 7 h à 19 h | beau, couvert | printemps, été, automne | 10 |
| Ver luisant | pré, lisière | 22 h à 2 h | beau | été | 2 |

## 3. Fossiles et trésors (12)

Les fouilles (`point-de-fouille`, 6 sols qui scintillent sur la carte, un tous les 2 jours) tirent une ligne parmi celles possibles; la vieille pièce pèse 6. Les lignes de trésor sont « rares » (la chance du bonus de besoins les multiplie). Aucun ne se revend: ils vont au carnet.

| Trésor | Où | Quand | Poids |
|---|---|---|---|
| Ammonite | fouilles | toujours | 0,5 |
| Bélemnite | fouilles | toujours | 0,3 |
| Bille d'agate | fouilles | printemps, été | 0,4 |
| Bouton de livrée | fouilles | toujours | 0,5 |
| Clou de voie daté | fouilles | toujours | 0,5 |
| Dent de requin | fouilles | automne, hiver | 0,4 |
| Coquille fossile | fouilles | toujours, plus souvent par pluie ou brume | 1 + 3 (pluie, brume) |
| Horaire de 1987 | Ceux qui partent, étape « cachette » | une fois, dans l'histoire | |
| Jeton de cantine | fouilles | toujours | 0,4 |
| Lampe de mineur | Ceux qui partent, étape « tunnel » | une fois, dans l'histoire | |
| Oursin fossile | fouilles | pluie, brume | 0,5 (pluie, brume) |
| Pointe de silex | fouilles | toujours | 0,3 |

## 4. Fleurs (12)

Au potager: une graine, une culture (rien ne meurt), une ou deux fleurs selon l'arrosage. Les fleurs ne se revendent pas (elles ne touchent pas à l'économie); les graines s'achètent ou se reçoivent.

| Fleur | Graine | Où l'avoir | Saisons de pousse | Jours (arrosés) | Repousse |
|---|---|---|---|---|---|
| Bleuet | Graines de bleuet | 0,30 (Cour des Delmas) | printemps, été | 4 (2) | non |
| Capucine | Graines de capucine | 0,30 (Épicerie Ferrand) | printemps, été | 4 (2) | oui |
| Giroflée | Graines de giroflée | 0,40 (Épicerie Ferrand) | printemps | 5 (2,5) | non |
| Marguerite | Graines de marguerite | 0,30 (Cour des Delmas) | printemps, été | 4 (2) | oui |
| Muguet | Griffes de muguet | La robe et la cloche, étape « coulee » | printemps | 6 (3) | oui |
| Nigelle de Damas | Graines de nigelle | 0,40 (Cour des Delmas) | printemps, été | 4 (2) | non |
| Œillet de poète | Graines d'œillet de poète | La fanfare de la halte, étape « concert » | printemps, été | 5 (2,5) | oui |
| Pensée | Graines de pensée | 0,40 (Épicerie Ferrand) | automne, hiver, printemps | 5 (2,5) | non |
| Rose des Lacombe | Bouture de rosier | Ceux qui partent, étape « marthe-manque » | printemps, été, automne | 7 (3,5) | oui |
| Souci | Graines de souci | 0,30 (Épicerie Ferrand) | printemps, été, automne | 3 (1,5) | oui |
| Tournesol | Graines de tournesol | 0,50 (Cour des Delmas) | été | 6 (3) | non |
| Violette | Plants de violette | Les lettres en retard, étape « odette » | printemps, automne | 4 (2) | oui |

## 5. Recettes (18)

Une recette s'inscrit au carnet à la première réussite en cuisine de ce plat par ce joueur (chacun des deux pour un repas à deux), ou quand l'histoire la donne (`give_recipe`); un plat acheté ou reçu ne l'inscrit pas (source `recipe` de l'entrée). Ce qui est déjà au carnet y reste. Prix: meilleur rachat du plat.

| Recette | Poste | Ingrédients | Comment l'apprendre | Prix du plat (€) |
|---|---|---|---|---|
| Compotée de mûres | réchaud | mûres x3, pomme x1 | en essayant ses ingrédients | ne se vend pas |
| Friture d'ablettes | réchaud | ablette x3 | en essayant ses ingrédients | ne se vend pas |
| Gratin de pommes de terre | cuisinière | pomme de terre x3, œuf x1 | livre de cuisine (Épicerie, 12 €) | ne se vend pas |
| Matelote du bief | cuisinière | perche x1, goujon x2, poireau x1 | livre de cuisine (Épicerie, 12 €) | ne se vend pas |
| Œuf au plat | réchaud | œuf x1 | en essayant ses ingrédients | 1,20 (Café de la Halte) |
| Omelette aux herbes | cuisinière | œuf x2 | la Fête des barrières fleuries, étape « levee » (la première fois; seule source, 2026-11-11) | 2,80 (Café de la Halte) |
| Pain perdu | réchaud | pain x1, œuf x1 | Le fantôme du moulin, étape « parrain » | ne se vend pas |
| Perche meunière | réchaud | perche x1, farine x1 | La Baronne, étape « epilogue » | ne se vend pas |
| Pomme cuite | réchaud | pomme x1 | connue dès le début | ne se vend pas |
| Pommes sautées | réchaud | pomme de terre x2 | livre de cuisine (Épicerie, 12 €) | 2,00 (Café de la Halte) |
| Pot-au-feu du dimanche | plan de travail | carotte x2, poireau x1 | Ceux qui partent, étape « honorine-prix » | ne se vend pas |
| Salade de radis | plan de travail | radis x3 | en essayant ses ingrédients | ne se vend pas |
| Soupe de légumes | cuisinière | carotte x1, poireau x1, pomme de terre x1 | connue dès le début | 2,00 (Café de la Halte) |
| Tarte aux mûres | four | mûres x4, farine x1, œuf x1 | livre de cuisine (Épicerie, 12 €) | ne se vend pas |
| Tarte aux pommes | four | pomme x3, farine x1, œuf x1 | Les lettres en retard, étape « oeufs » (la tarte du dimanche de la mère de Colette), ou livre de cuisine (Épicerie, 12 €) | 1,70 (Fournil Pradel) |
| Tartine grillée | réchaud | pain x1 | connue dès le début | ne se vend pas |
| Tomates farcies | cuisinière | tomate x2, morceau de bœuf x1 | La guerre de la soupe, étape « vexee » | ne se vend pas |
| Truite grillée | réchaud | truite fario x1 | La guerre de la soupe, étape « truite » | ne se vend pas |

Légumes des recettes (2026-11-11): carotte, poireau et pomme de terre se cultivent désormais au potager (fiches `cultures/carotte.json`, `poireau.json`, `pomme-de-terre.json`; graines et plants chez Margot et chez Odette, voir `economie-aubrune.md`, section 2). La soupe de légumes, le pot-au-feu du dimanche, la matelote du bief, le gratin et les pommes sautées ne dépendent plus de l'étal des Delmas. En hiver, seul le poireau pousse; carotte et pomme de terre se gardent de la récolte d'avant ou s'achètent chez les Delmas.

## 6. Cartes postales (12)

L'appareil photo en main (Lucie le prête à l'acte 3), cadrer le point à 20 m au plus, dans les 25° de l'axe, quand la condition est vraie.

| Carte | Point visé | Condition |
|---|---|---|
| Aubrune vue des Crêtes | le banc des Crêtes (`k2`) | par beau |
| La barrière au crépuscule | la barrière du passage à niveau (`pn-s`) | de 19 h 30 à 21 h 30 |
| Le belvédère de l'Éperon | le belvédère de l'Éperon (`bv`) | toujours |
| Le clocher sous la neige | le parvis (`pv`) | par neige |
| La croix de chemin | la croix de chemin (`croix`) | de 18 h à 21 h |
| L'étang de la Côte | le coin de l'étang (`et`) | de 18 h à 21 h |
| Le Gros Noyer en automne | le Gros Noyer (`fs2`) | en automne |
| La halte dans la brume | le quai (`quai`) | de 6 h à 10 h, par brume |
| Le moulin qui tourne | la cour du moulin (`mc`) | la roue tourne (acte 3, vanne ouverte) |
| La place aux lumières | la place (`pl`) | de 21 h à 0 h |
| Le train du samedi | le quai (`quai`) | le train du samedi à quai (après l'acte 2) |
| La vanne du bief | la vanne (`vn`) | par beau |

## 7. Musiques (8)

Fiches seulement (aucun fichier son). Un air s'inscrit pour le duo à l'étape d'histoire qui le fait entendre (effet `give_entry`), ou au début de l'événement du calendrier (`tune`).

| Air | Lié à | Comment |
|---|---|---|
| Canon de la répétition | Armand, la fanfare | La fanfare de la halte, étape « repetition » |
| Carillon des deux sœurs | Marthe et Honorine, Mado | La robe et la cloche, étape « coulee » |
| Chanson des marmites | Odette et Colette, le concours | La guerre de la soupe, étape « concours » |
| Chant de la coupe | Barnabé | Le fantôme du moulin, étape « tablier » |
| Marche de la halte | Armand, la fanfare | La fanfare de la halte, étape « concert » |
| Le sifflet du samedi | Rosalie, le train | événement « Train du samedi », chaque samedi après l'acte 2 |
| Sonnerie de 5 h 12 | Marthe, Firmin, la veillée | Ceux qui partent, étape « veillee » |
| Valse de la minute | Ambroise et Firmin | La minute d'écart, étape « aveu-firmin » |

## 8. Zones des insectes (`lieux/aubrune/nature.json`)

| Zone | Terrain | Cases (x, y, l, h) | Au plus | Pourquoi là |
|---|---|---|---|---|
| lisiere-du-bourg | lisière | 193, 86, 12, 5 | 2 | herbe rase au pied des chênes de la lisière, au nord de la voie (acte 1) |
| jardins-de-la-rive | potager | 250, 117, 12, 8 | 2 | les jardins potagers de la Rive, au sud de la Grand-Route (acte 1) |
| potager-de-la-maison | potager | 166, 120, 12, 5 | 2 | le potager de la maison du garde: les piérides viennent aux radis |
| verger-communal | pré | 304, 115, 12, 10 | 2 | herbe du verger communal, au bout du bourg (acte 1) |
| berge-de-la-rive | berge | 240, 122, 16, 4 | 2 | la berge herbue devant le banc, au bord de l'Aubrune (acte 1) |
| roseaux-de-l-ile | berge | 108, 135, 10, 3 | 2 | prairie humide de l'Île, entre bief et rivière (acte 2) |
| berge-de-la-fosse | berge | 130, 131, 10, 1 | 1 | la rive de l'Île face à la fosse de la Baronne (acte 2) |
| pre-aux-foins | pré | 152, 158, 14, 10 | 2 | le pré aux balles de foin des Delmas (acte 3) |
| pre-bas | pré | 294, 153, 14, 10 | 2 | le pré bas, à l'est des ruches (acte 3) |
| prairie-du-milieu | pré | 202, 35, 14, 10 | 2 | la prairie du milieu de la Côte (acte 3) |
| pres-du-haut | pré | 260, 17, 16, 10 | 2 | les prés du Haut, sous la crête (acte 3) |
| clairiere | lisière | 177, 47, 12, 8 | 2 | la clairière du tronc-banc, bordée de bois (acte 3) |
| bois-de-la-coupe | bois | 154, 52, 12, 10 | 2 | le sous-bois de la coupe de Basile (acte 3) |
| chataigniers | bois | 170, 66, 12, 8 | 1 | le sous-bois des châtaigniers, bas de la Côte (acte 3) |
| bois-de-la-roche | bois | 262, 46, 12, 10 | 2 | le sous-bois de la roche aux fossiles (acte 3) |
| place-aux-reverberes | réverbères | 199, 114, 14, 8 | 2 | la place, entre la pompe et le réverbère: les papillons de nuit viennent à la lumière |

## 9. Branchements sur l'histoire

Effets ajoutés à la fin (`onDone`) d'étapes existantes; ils ne changent ni les conditions ni l'ordre des quêtes.

| Quête, étape | Effet ajouté | Raison |
|---|---|---|
| La minute d'écart, `aveu-firmin` | air « Valse de la minute » | Ambroise et Firmin réconciliés |
| La fanfare de la halte, `repetition` | air « Canon de la répétition » | la répétition devant l'école |
| La fanfare de la halte, `concert` | air « Marche de la halte », 3 graines d'œillet de poète | le concert; l'œillet est la boutonnière des musiciens |
| Le fantôme du moulin, `parrain` | recette « Pain perdu » | Achille, boulanger, parle de Barnabé |
| Le fantôme du moulin, `tablier` | air « Chant de la coupe » | Barnabé chante en travaillant |
| La robe et la cloche, `coulee` | air « Carillon des deux sœurs », 2 griffes de muguet | la Fêlée refondue; le muguet que les sœurs offraient à leur mère |
| La guerre de la soupe, `vexee` | recette « Tomates farcies » | Odette, piquée, montre ce qu'elle sait faire |
| La guerre de la soupe, `truite` | recette « Truite grillée » | Colette reçoit sa truite |
| La guerre de la soupe, `concours` | air « Chanson des marmites » | le concours sur la place |
| La Baronne, `epilogue` | recette « Perche meunière » | la fin de l'histoire de la perche, racontée à Colette |
| Les lettres en retard, `odette` | 2 plants de violette | la lettre de Basile, trente ans de retard |
| Les lettres en retard, `oeufs` | recette « Tarte aux pommes » | Colette refait la tarte du dimanche de sa mère avec tes œufs, et t'en donne la recette (2026-11-11: l'omelette aux herbes ne s'apprend plus qu'à la Fête des barrières) |
| Ceux qui partent, `repas` (dialogue `colette-repas`) | recette « Pot-au-feu du dimanche » | Honorine réclame un vrai pot-au-feu; Colette en donne la recette (légumes des Delmas, bœuf d'Odette) |
| Ceux qui partent, `marthe-manque` | 1 bouture de rosier | une rose pour la dalle des Lacombe |
| Ceux qui partent, `tunnel` | trésor « Lampe de mineur » | la première niche du tunnel (plan: `niche`) |
| Ceux qui partent, `cachette` | trésor « Horaire de 1987 » | la boîte d'Émile: le verre roulé dans un horaire de 1987 |
| Ceux qui partent, `veillee` | air « Sonnerie de 5 h 12 » | la nuit de 5 h 12 |
| Événement « Train du samedi » | air « Le sifflet du samedi » | chaque samedi, quand le train entre en gare |

L'omelette et le pot-au-feu existaient sans que rien ne les apprenne à Aubrune: le pot-au-feu vient de « Ceux qui partent », l'omelette de la Fête des barrières fleuries (sa seule source depuis le 2026-11-11). Chaque don a sa réplique, dans la voix de qui le donne (2026-11-11: dialogues `<habitant>-don-<sujet>`, liste dans `ecriture-habitants.md`, section 9).

## 10. Économie

- Poissons: les 10 nouveaux se revendent au Café de la Halte, de 2,00 € (vairon) à 9,60 € (carpe), sous le brochet (12,00 €). Prix des 6 anciens inchangés. Plafond du café inchangé (85 € par jour).
- Le prix moyen d'une prise, tous coins confondus (script, poids des tables, sans la rareté), passe de 4,72 € à 4,31 €: les coins gagnent surtout des poissons communs. Revenu d'une journée (script `docs/jeux/jeu-1/simulations/economie_aubrune.py`): duo tranquille 99,42 € à l'acte 2 et 101,07 € à l'acte 3 (103,30 et 104,90 avant, soit -3,7 %); duos médian et appliqué inchangés (131,43 et 133,63 €), bornés par le plafond du café. Aucune hausse, donc sous la limite de +15 %.
- Fouilles: les 9 lignes de trésor (poids 0,3 à 0,5, « rares ») font passer la part de la vieille pièce d'environ 86 % à environ 61 % des fouilles par temps sec: environ 1,50 € de moins par jour (3 fouilles), que le script ne compte pas (il ne lit que les lignes ordinaires).
- Fleurs, insectes, trésors, nouveaux plats: aucun rachat. Les graines s'achètent (0,30 à 0,50 €, 5 par jour et par commerce) et ne rapportent rien: pas de boucle. Les nouvelles recettes ne rapportent rien non plus: on les cuisine pour manger, offrir et remplir le carnet.
- `tests/commerces-aubrune.test.ts` reste vert sans changement.

## 11. Ce que les briques ne font pas encore

| Manque | Conséquence aujourd'hui | Brique proposée |
|---|---|---|
| Fouille propre à un endroit (le plan donne le même type `point-de-fouille` aux 6 sols) | brique livrée le 2026-11-11: un objet de la carte peut déclarer sa fiche (`resource`), et `fouille-roche`, `fouille-ballast`, `fouille-pierre-levee` existent; reste à les donner aux trois points par le plan | `"resource": "<fiche>"` sur `fouille-roche`, `fouille-ballast`, `fouille-pierre-levee` de la carte |
| Cueillette sauvage: le plan nomme coquelicots, châtaignes, champignons, myrtilles, noix, coquillages | les coquelicots sont posés et repoussent depuis le 2026-11-11. Tranché le même jour: pas d'entrée au carnet. La famille des fleurs est pleine (12, compte du cahier) et ses règles l'excluent (une fleur pousse d'une graine et ne se revend pas; le coquelicot se cueille et se revend). Il reste un cadeau: adoré d'Honorine, de Lucie et de Solange, aimé de Margot et de Martial, mal reçu de Basile, Mado, Marthe et Paulin | une collection « fleurs sauvages » (coquelicot, primevère, digitale) le jour où le cahier ouvre une treizième famille |
| La cuisine n'inscrit pas l'entrée de la recette | corrigé le 2026-11-11: source `recipe`, inscrite à la première réussite en cuisine ou par `give_recipe` | |
| Fossile en plusieurs morceaux à assembler au carnet (cahier 4.7) | chaque fossile est d'une pièce | une entrée à fragments |
| Insectes rendus par espèce | toutes les zones montrent le même repère d'insecte | un modèle par espèce (liste des assets) |
| Coquillages de rivière (cahier 4.7, grèves de la berge et de l'Île) | pas de collection de coquillages; les grèves n'ont que des cailloux | ressource de ramassage par le plan |
| Répliques de cadeau | fait le 2026-11-11: une réplique par branchement de la section 9 | (fait) |

Les 6 tables de pêche proposées par le plan (`peche_lieu`) ne sont pas recopiées: `lieu.json` fait foi pour les poissons et leurs poids, comme le dit la note de l'assembleur.
