# La Petite Ligne, démo: la semaine 2

Document de cadrage du game designer (2026-10-31). La semaine 1 reste celle de `demo.md`; seule sa fin change. Mêmes mécaniques, mêmes modèles 3D, même carte.

## 1. Intention

La première commande est partie: pendant la deuxième semaine, vous remettez en route la draisine d'Émile et vous remplissez une commande plus exigeante, qui demande de planter tôt, de pêcher et de cuisiner.

Ce qui change pour les joueurs: plus de planification (les carottes poussent en 4 jours), une ligne de la caisse qui se cuisine, une ligne qui se pêche, et un fil qui tient les sept jours (la draisine), avec une deuxième énigme d'Émile en récompense de la première.

## 2. Déroulé

| Jour | Semaine 2 |
|---|---|
| 8 (samedi) | 16 h: départ du train, commande 1 payée, scènes de Firmin (inchangées), puis la partie continue. 18 h: lettre de la coopérative avec la commande 2. Nouvelle quête « La commande du samedi 15 » |
| 9 (dimanche) | lettre de Basile; la draisine (si la remise est ouverte), la deuxième énigme; envie à deux |
| 10 à 14 | quêtes des habitants, potager, pêche, cuisine; 13: rappel du catalogue; 14 à minuit: fermeture du catalogue |
| 15 (samedi) | 10 h: le train, livraison du catalogue; 16 h: départ, commande 2 payée, scène de fin, fin de la démo |

Météo proposée pour les jours 9 à 15 (à écrire dans `reglages.weatherByDay`): soleil, nuages, soleil, pluie, soleil, soleil, soleil. La pluie du jour 12 arrose tout le potager; l'énigme 1, encore ouverte pour qui a manqué la clé, garde cinq jours de soleil.

## 3. La commande 2 (samedi 15, 16 h)

| Ligne | Quantité | Prix de base | Ce que ça demande |
|---|---|---|---|
| carottes | 15 | 16 | 5 cases, 4 jours de pousse arrosés: semées au plus tard le jour 11 |
| laitues | 4 | 32 | 4 cases, 3 jours |
| œufs | 8 | 8 | 3 poules nourries: 21 œufs sur la semaine |
| omelettes | 4 | 20 (nouveau prix de vente) | 6 œufs au réchaud (3 œufs donnent 2 omelettes, recette connue dès le début) |
| truites | 2 | 8 | une prise sur 5,5 en moyenne: environ 11 prises, 2 à 4 minutes de pêche |

- Potager: 5 + 4 = 9 cases, il en reste 3 pour les radis (en-cas, soupe, envies). Œufs: 8 + 6 = 14 sur 21.
- Pas de planches: les 12 arbres ne repoussent pas, et la semaine 1 en abat environ 7; le bois qui reste sert à la draisine.
- Paiement complet: (15 x 16 + 4 x 32 + 8 x 8 + 4 x 20 + 2 x 8) x 1,5 = 792, plus 25 % = 990 sous (commande 1: 540).
- Plus de défi que la 1: deux lignes qui ne viennent pas du potager, et une culture lente qu'il faut lancer dès le dimanche ou le lundi.

## 4. Quêtes nouvelles

Principales (`main`):

| Id | Titre | Étapes | Récompense |
|---|---|---|---|
| `second_order` | La commande du samedi 15 | déposer la commande 2 (échéance jour 15, 16 h) | paiement; scènes de fin; fin de la démo |
| `handcar` | La draisine d'Émile | démarre le jour 9 si la remise est ouverte (drapeau `shed_open`). 1. montrer la draisine à Basile (il travaille devant la remise); 2. lui apporter 8 planches et 4 clous; 3. une nuit de travail; 4. scène à deux devant la remise: on pousse la draisine, elle roule | drapeau `handcar_ready`, réplique de fin dédiée |

La remise reste fermée tant que la première énigme n'est pas résolue: elle reste ouverte en semaine 2, avec des indices plus directs. Résolue après le jour 8, elle ouvre la remise sur-le-champ.

Secondaires (`side`), une par habitant:

| Id | Habitant | Titre | Demande | Récompense |
|---|---|---|---|---|
| `odette_fry` | Odette | La friture d'Odette | 4 goujons | 40 sous et un pain par joueur |
| `basile_omelette` | Basile | Un repas chaud pour Basile | 1 omelette | 30 sous |
| `lucie_letter` | Jeanne | Le mot de Lucie | porter à Firmin la lettre de sa tante, puis le dire à Jeanne | 20 sous; Firmin rougit |
| `firmin_flowers` | Firmin | Le quai en fête | 2 pots de fleurs (épicerie, 15 sous) donnés à Firmin | 50 sous |
| `emile_riddle_2` | (Émile) | La deuxième énigme d'Émile | voir section 5 | le carnet de route d'Émile |

## 5. La deuxième énigme d'Émile

- Départ: le jour 9 au plus tôt, la remise ouverte. Les deux joueurs reçoivent la deuxième carte, trouvée dans le coffre à outils de la draisine.
- Carte: « Chaque matin, quand le train approchait, je baissais la barrière et j'attendais à son pied. Ce que je gardais pour la suite de la ligne y dort encore. É. L. »
- Solution: bêcher à moins de 2 m du passage à niveau (point `level_crossing`, à côté de la maisonnette), entre 9 h et 10 h, n'importe quel jour à partir du 9. Ailleurs ou à une autre heure: « Rien ici... pour l'instant. »
- Différence avec la 1: pas de météo; c'est l'heure qu'il faut retrouver, en parlant aux habitants.
- Indices: Basile (« De mon temps, le train passait la barrière vers dix heures. Émile la baissait bien avant. »), Firmin (« Mon oncle disait que la barrière, c'était sa montre. »), Jeanne (« Une barrière ? Il n'y en a qu'une, au passage à niveau. Juste à côté de chez vous ! »).
- Trouvaille: le carnet de route d'Émile, qui se lit (tracé de la voie des Vergers). Il nourrit une réplique de la fin.

## 6. Nouveaux objets (modèles existants)

| Id | Nom | Où | Prix | Détail |
|---|---|---|---|---|
| `picture_frame` | cadre | épicerie, dès le jour 9 | 25 | décoration murale (`wall`), beauté 3: pour la vieille photo |
| `wood_stove` | poêle à bois | catalogue, dès le jour 9 (livré le jour 15) | 90 | confort 3, beauté 1 |
| `riddle_card_2` | deuxième carte d'Émile | quête | | modèle `riddle_card`, se lit |
| `emile_logbook` | carnet de route d'Émile | quête | | modèle `riddle_card`, se lit |
| `lucie_letter` | lettre de Lucie | quête | | modèle `riddle_card` |

Les omelettes gagnent un prix de vente (20 sous) pour entrer dans la commande.

## 7. Lettres, envies, astuces

- Lettres: `coop_order_2` (jour 8, 18 h: merci et commande 2), `basile_handcar` (jour 9, 6 h; deux versions selon que la remise est ouverte), `coop_catalogue_reminder_2` (jour 13, 6 h), `coop_recap_2` (au départ du jour 15).
- Envies personnelles nouvelles (dès le jour 9): pêcher un goujon, manger une omelette, accrocher un cadre, rendre visite à Basile, une belle récolte de carottes, rapporter du bois; « Voir arriver le train » vaut aussi le jour 15.
- Envies à deux: jour 9 « Un goujon pour chaque canne », jour 11 « Cuisiner des omelettes, à tour de rôle », jour 13 « Souper à la même table ».
- Astuces: la commande 2 (« les carottes poussent en 4 jours: sème-les tôt »), l'omelette (au départ de la quête de Basile).
- Écran de fin: « Deux semaines à la Halte d'Aubrune ».

## 8. Besoins moteur (dev simulation)

1. Une commande par train, décrite dans les données (schéma au choix du dev): commande 1 au jour 8, commande 2 au jour 15 (section 3). `{order}` donne la commande du prochain train; la lettre du jour 8 à 18 h et l'objectif de `second_order` citent donc la commande 2.
2. `order_complete` accepte un paramètre facultatif `day` (jour du train de la commande). Les données l'écrivent partout (`"day": 8` dans la fin de la semaine 1, `"day": 15` dans celle de la semaine 2), pour qu'il n'y ait jamais de doute après un `pay_order`. `pay_order` paie la commande dont le train part.
3. Fin de la semaine 1: les données retirent `end_demo` des effets du jour 8; la partie continue après les scènes. `end_demo` est dans les effets de l'échéance de `second_order` (jour 15, 16 h).
4. Objets: champ facultatif `availableFromDay` (entier): l'objet n'est en vente (épicerie ou catalogue) qu'à partir de ce jour. Il évite de changer la semaine 1.
5. Catalogue: deux échéances (jour 7 à minuit, livraison jour 8 à 10 h; jour 14 à minuit, livraison jour 15 à 10 h).
6. `reglages.json`: 15 météos (section 2), `train.days` [1, 8, 15], `clock.lastDay.day` 15.
7. Écran de fin: `{linesDone}` et `{linesTotal}` additionnent les deux commandes; `{days}` compte les deux semaines.
8. Aucune condition ni effet nouveau en dehors du paramètre `day` de `order_complete`. Utilisés: `flag`, `set_flag`, `given`, `nights_passed`, `dialogue_done`, scène partagée au point `handcar_shed`, `used_tool_at` au point `level_crossing`, `time_is`, `item_owned`, `set_world_state` (la remise s'ouvre aussi en semaine 2), `caught`, `crafted`, `ate`, `placed`, `chopped`, `harvested` avec qualité.
9. Robots: semer les carottes tôt, cuisiner 4 omelettes, pêcher 2 truites; la draisine et l'énigme 2 se jouent si la remise est ouverte.
