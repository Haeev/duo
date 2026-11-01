# La Petite Ligne, tour 9: des buts, de quoi dépenser, et l'automne entier (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | conception, à produire au tour 9 |
| Version du document | 1 |
| Date | 2026-11-01 |
| Rédaction | game-designer (gauntlet, tour 9) |
| Point de départ | branche `claude/stoic-lamport-lueey2` à `757c3b0` (égale à `main`) |
| Sources | `gauntlet/revues/tour-08-game-designer.md` (priorités 1 à 3, réserves 1 à 7); `tour-08-conception.md` (sections 1 à 14); `tour-07-conception.md` (fiches 1.4.10 et 1.4.12, tables 1.6 et 1.7); `plan-100-heures.md` (L4, arcs, R1 à R16); `gauntlet/rapports/longue-vie-tour-08.md`; `games/la-petite-ligne/ETAT.md`; `donnees/` (reglages, objets, courrier, habitants, envies, moments, textes, carte `halte.json`) |
| Simulation | `simulations/tour9_automne.py` (bibliothèque standard, 60 s; `--rapide`: 22 s). Il réutilise `tour8_suite.py` (météo, `unitDraw`, commande générée) et `moments_tour7_geometrie.py` (ligne de vue, M-02, cadre). Les tables 1.3, 2.3, 2.6 et 3.4 sont relues par le script (partie 0): un écart entre ce document et le script fait échouer le contrôle |
| Mesure faite pour ce tour | deux parties de robots médians à `757c3b0`, jours 1 à 63, sans aucun achat après la démo (test jetable hors du dépôt, section 2.1) |
| Décisions du client en attente | D1 à D9 du plan, questions de la valse et du train (tour 7): rien de ce document ne les tranche. La valse reste hors périmètre tant que D7 n'est pas tranchée; le ralenti du train reste le réglage `train.saluteSlowRoll` (livré à `true`, un samedi sur deux au plus) |

## En bref

**Pitch.** Après le jour 15, la Halte demande des coups de main, propose de quoi s'équiper et rêve de chantiers: vous gagnez vos sous le samedi pour les dépenser ensemble, jusqu'au premier matin d'hiver.

**Fantasme.** « On a fini la commande, il nous reste 400 sous: on prend la canne en bambou pour toi, ou on met tout dans le banc du gué ? » Dimanche, Odette épingle une annonce; mercredi, Jeanne veut un public pour sa poésie. L'automne arrive: Jeanne retourne à l'école, le sureau donne une semaine, une chouette blanche chasse au-dessus du pré, et Firmin vous confie les lanternes.

| # | Livraison | En une phrase | Section |
|---|---|---|---|
| 1 | Le tableau du quai: petites annonces | deux annonces par semaine (dimanche: un coup de main; mercredi: une à deux), 18 gabarits tirés, jamais le même en 10 jours | 1 |
| 2 | À quoi sert l'argent | catalogue renouvelé chaque samedi (outils, poules, maison, cadeaux), chantiers du bourg payés par souscription, chantiers de la maisonnette commandés à Basile: 8 080 sous de choses désirables du jour 16 au jour 64 | 2 |
| 3 | Correctifs de la commande | coût de chaque poisson selon la saison (la truite d'été), lignes du potager arrondies et plafonnées | 2.11 |
| 4 | L'automne entier | limite au samedi 64 à 16 h, étape `autumn_end`; « Rester » au jour 43; Jeanne à l'école; sureau et cèpe; 76 répliques, 15 envies | 3 |
| 5 | Quatre moments | les étoiles de l'Aubrune et le salut du mécanicien (été, fiches du tour 7), la dame blanche et les lanternes du quai (automne, nouveaux) | 4 |
| 6 | Lisibilité | mûres, noisettes, sureau et cèpes lisibles au zoom de départ; titres dans la liste du courrier; carnet qui ne garde que les dernières commandes | 5 |
| 7 | Robot longue vie | achats, annonces et chantiers joués; mesures de la bourse et des buts; état borné revérifié sur 84 jours | 2.12, 3.8, 8 |

Chiffres clés (simulation, annexe A): sans aucun achat, un duo médian finit l'automne avec 7 300 sous (les deux robots: 6 825 et 7 561). Avec ce tour, le même duo, s'il achète tout ce qu'il peut, dépense 70 % de ce qu'il a chaque semaine, a un but d'épargne 88 % des semaines, finit tout le jour 58 en médiane et garde 579 sous au jour 63; un duo tranquille finit tout dans 20 % des parties seulement (96 % des achats en médiane). Annonces: 14 par partie jusqu'au jour 63, 0 redite à moins de 10 jours, 67 sous en moyenne (coup de main) et 93 (à deux). Répliques: redites à moins de 28 jours de 37 à 49 % en automne pour un joueur assidu sans les ajouts, 0 % avec. Envies jamais reçues en automne: 58 %. Moments: au moins deux moments différents vus ensemble en automne dans 97 % des parties (57 % avec la réserve et les réglages du tour 8).

## 0. Ce qui avance sans les décisions, et comment

| Chantier | Dépend de | Traitement dans ce tour |
|---|---|---|
| Annonces, catalogue, chantiers, cadeaux, correctifs de la commande | rien | livrés |
| Automne jusqu'au jour 64, étape `autumn_end` | rien (D4 ne change que la version suivante) | livrés; la sauvegarde continue (`continuation.mode: same_save`, tour 8, 7.2) |
| Étoiles de l'Aubrune | rien | livrées (fiche du tour 7, section 4.1) |
| Salut du mécanicien | question 2 du tour 7 | livré; ralenti du train par `train.saluteSlowRoll` (`true`, recommandation déjà faite: un samedi sur deux au plus, `cooldownDays` 14) |
| Valse d'Odette | D7 et question 1 du tour 7 | hors périmètre; rien de ce document ne l'appelle ni ne la cite |
| Rythme après le jour 23 | D1 | inchangé: 0,35 s partout (`clock.schedule`); l'équilibrage de la section 2 est fait à ce rythme, à resimuler si D1 passe à 0,8 s |
| Contenu de J1 (Lucie, fête, marquise, inauguration) | D6, D7 | hors périmètre; ce tour ouvre le tableau des annonces par Firmin au jour 16, J1 s'y adaptera (section 11, question 5) |

## 1. Le tableau du quai: petites annonces (L4, EC-10)

### 1.1 Principe

Le tableau du quai (`notice_board`, (41,5 ; 18,5)) montrait la commande, le catalogue et le courrier. Il gagne deux onglets: **Annonces** et **Chantiers** (section 2.6). Firmin y épingle les demandes des habitants: un service court, à faire en deux ou trois jours, payé en sous et parfois en objets. Les annonces donnent un but de quelques jours entre l'envie du matin (un jour) et la commande (une semaine): c'est l'horizon qui manquait (R11).

Une annonce n'est jamais une corvée: elle ne demande pas plus d'une à deux heures de jeu (10 à 20 minutes réelles), on peut l'ignorer sans perte, et elle se retire seule à son échéance.

### 1.2 Calendrier et tirage

| Règle | Valeur | Raison |
|---|---|---|
| Ouverture du tableau | jour 16, 6 h (lettre `firmin_board`); une partie reprise après le jour 16 l'ouvre à l'aube suivante | même ancrage que le reste de la suite (tour 8, 1.5): par jour minimal, rattrapé à la reprise |
| Affiches | dimanche 6 h: une annonce « coup de main »; mercredi 6 h: une annonce « à deux » | deux par semaine, jamais un samedi (le train a déjà son rendez-vous) |
| Échéance | 20 h du troisième jour, jour de l'affiche compris: mardi 20 h et vendredi 20 h | trois soirées pour s'organiser; jamais deux annonces en cours en même temps |
| Tirage | parmi les gabarits de la sorte du jour, possibles ce jour-là (saison, produit déjà obtenu par le duo, cueillette de saison pendant les trois jours), par `unitDraw(seed, "annonce", jour)` | jours 1 à 15 inchangés, graine épinglable (comme la commande) |
| Poids | 1; x 2 si le gabarit n'a jamais été affiché; x 0,3 si l'habitant est celui de l'annonce précédente | du neuf d'abord, et pas deux fois Odette de suite |
| Jamais le même gabarit | à moins de 10 jours (R7) | |
| Aucun gabarit possible | pas d'annonce ce jour-là (jamais observé: au moins 5 coups de main et 4 à deux possibles chaque fois) | rien plutôt qu'une redite |
| Variante | `odette_shelf` tire sa ligne (6 radis, 4 carottes ou 2 laitues) par `unitDraw(seed, "annonce-variant", jour)`, parmi les légumes obtenus | |

Une annonce « à deux » se fait mieux à deux, de deux façons: soit elle demande deux produits de deux familles (l'un au potager, l'autre au poulailler), soit elle finit par une scène partagée qui demande les deux joueurs au même endroit (la scène à deux de la démo, `shared: true`, qui se lance quand les deux sont au point et que ses conditions sont vraies). Elle reste faisable par un seul joueur pour les livraisons (on donne à l'habitant comme dans une quête), jamais pour les scènes.

### 1.3 Les 18 gabarits

Chaque annonce est une quête de coup de main tirée (`kind: "side"`, groupe « Annonces » du carnet), d'un habitant (`giver`). Remise: on parle à l'habitant, le choix « Donner {count} {item} » apparaît (mécanique de la démo, condition `given`). Récompense en sous (section 1.4) donnée à la dernière étape, avec la réplique de remerciement.

| Gabarit | Sorte | Habitant | Saisons | Demande | Récompense |
|---|---|---|---|---|---|
| `odette_shelf` | coup de main | Odette | P, E, A | 6 radis, 4 carottes ou 2 laitues (tirage) | 80, 110 ou 110 |
| `firmin_trout` | coup de main | Firmin | P, E, A | 1 truite | 40 |
| `basile_planks` | coup de main | Basile | P, E, A | 6 planches | 70 |
| `jeanne_chub` | coup de main | Jeanne | P, E, A | 1 chevesne | 40 |
| `odette_eggs` | coup de main | Odette | P, E, A | 6 œufs | 85 |
| `firmin_soup` | coup de main | Firmin | A | 1 soupe de légumes | 105 |
| `basile_tisane` | coup de main | Basile | P | 6 pissenlits | 55 |
| `basile_nuts` | coup de main | Basile | A | 8 noisettes | 55 |
| `odette_blackberries` | coup de main | Odette | E | 10 mûres | 65 |
| `odette_elder` | coup de main | Odette | A, jours 1 à 10 | 6 grappes de sureau | 55 |
| `jeanne_mushroom` | coup de main | Jeanne | E, A | 1 girolle | 40 |
| `firmin_omelettes` | coup de main | Firmin | P, E, A | 2 omelettes | 75 |
| `odette_basket` | à deux | Odette | P, E, A | 3 carottes et 3 œufs | 140 |
| `firmin_supper` | à deux | Firmin | P, E, A | 1 truite et 1 laitue | 95 |
| `basile_fence` | à deux | Basile | P, E, A | 4 planches, puis la scène de la barrière (les deux dans la cour de la scierie) | 75 |
| `jeanne_poem` | à deux | Jeanne | P, E, A | la scène de la poésie (les deux sur la place, 17 h à 19 h) | 60 |
| `jeanne_snack` | à deux | Jeanne | E | 2 œufs et 4 mûres, puis le goûter (les deux au banc de la berge, 14 h à 17 h 30) | 80 |
| `jeanne_snack_nuts` | à deux | Jeanne | A | 2 œufs et 4 noisettes, puis le goûter (les deux à la margelle du puits, 16 h 30 à 18 h 30) | 80 |
| `odette_preserves` | à deux | Odette | A | 6 noisettes et 6 radis | 125 |

Faisabilité, vérifiée au tirage: produit obtenu (même compteur que la commande, `obtained`, tour 8, 4.2); planches: le duo en a au moins autant dans les sacs et le coffre, ou il y a au moins un arbre adulte; soupe: recette déjà faite; cueillette: de saison pendant les trois jours de l'annonce (`odette_elder` n'est donc tirée que jusqu'au 10e jour de l'automne, le sureau finissant au 14e). La scène de Jeanne exige qu'elle soit au lieu à l'heure dite (emploi du temps, section 3.3): la poésie de 17 h à 19 h tient aussi les jours d'école, puisque Jeanne rentre à 16 h 30.

En réserve pour plus tard (P1, demandent de généraliser le portage à deux, `carry`, à un départ et une arrivée donnés par l'annonce): `basile_beam` (porter une poutre de la cour de la scierie à la cloche du quai, à deux) et `odette_parcel` (porter le gros colis du quai à la porte de la pension, à deux).

### 1.4 Récompenses

| Valeur | Initiale | Unité | Plage | Raison |
|---|---|---|---|---|
| Coup de main | 1,3 x V + 25, arrondi à 5, entre 40 et 120 | sous | facteur 1,1 à 1,5 | V = somme des quantités x prix de vente (tour 8, 4.2). Un peu mieux qu'Odette (80 % du prix), bien moins qu'une commande: une annonce est un service, pas un salaire. Moyenne mesurée: 67 sous |
| À deux | 1,3 x V + 45, arrondi à 5, entre 60 et 150 | sous | ajout 30 à 60 | le détour d'un second joueur; moyenne mesurée: 93 sous |
| Cœur, annonce à deux faite | +10 chacun | Cœur | 5 à 15 | `needs.heart.gestureTogether`, déjà réglé à 10 |
| Objets uniques | `jeanne_drawing` (dessin de Jeanne, la première poésie), `elder_jelly` (pot de gelée de sureau, les premiers bocaux d'Odette) | | | un souvenir qu'on ne peut pas acheter; les fois suivantes, des sous seulement |
| Annonce manquée | rien | | | « Annonce retirée: {giver} a trouvé une autre solution. Rien de perdu. » au carnet, sans son ni pénalité |

Les annonces rapportent environ 900 sous du jour 16 au jour 63 à un duo médian (85 % des coups de main et 75 % des annonces à deux faites), soit 11 % de ses revenus: c'est compté dans l'équilibrage de la section 2.

### 1.5 Textes

Les annonces sont écrites à la main par l'habitant: les adultes vouvoient le duo, Jeanne aussi quand elle s'adresse aux deux (elle tutoie un joueur seul). Aucun accord au genre d'un joueur.

| Gabarit | Affiche (`annonces.<id>.text`) | Remerciement (`annonces.<id>.thanks`) |
|---|---|---|
| `odette_shelf` | Ma vitrine a l'air d'une étagère de pension un lundi matin. Il me faudrait {count} {item}, frais si possible. Odette | Les voilà ! Ma vitrine reprend des couleurs. |
| `firmin_trout` | Ce soir, le chef de halte aimerait une truite. Une seule: il n'est pas glouton. Firmin | Une truite ! Émile la faisait au beurre. Je vais essayer de faire pareil, en moins bien. |
| `basile_planks` | Commande de la ville: une caisse à outils. Il me manque 6 planches. Je paie. B. | Six. Le compte est bon. |
| `jeanne_chub` | Je voudrais voir un chevesne de près, un vrai. Je le dessine, et après on le remet à l'eau. Jeanne | Il a les yeux rouges ! Je le dessine vite, et il retourne à la rivière. Promis. |
| `odette_eggs` | Crêpes de dimanche prochain à la pension: il me faut 6 œufs. Vos poules pondent mieux que les miennes, qui n'existent pas. Odette | Six beaux œufs. Gardez-vous une place pour les crêpes. |
| `firmin_soup` | Les soirées de garde fraîchissent. Une soupe chaude ferait un chef de halte heureux. Firmin | Encore chaude ! Je la garde pour ce soir. Le quai sera moins froid. |
| `basile_tisane` | Ma tisane du soir: 6 pissenlits, les feuilles surtout. Les fleurs, gardez-les pour les vœux de Jeanne. B. | Ça ira pour la semaine. |
| `basile_nuts` | L'hiver, je casse des noisettes au coin du poêle. Il m'en faut 8 pour commencer. B. | Huit. Le poêle sera content. Moi aussi. |
| `odette_blackberries` | Confitures de mûres à la pension: il me faut 10 mûres. Elles griffent, je sais. Odette | Dix belles mûres. Vous goûterez la confiture, c'est la moindre des choses. |
| `odette_elder` | La gelée de sureau ne se fait qu'une semaine par an. Il me faut 6 grappes, sans les tiges. Odette | Parfaites. Le sureau, il faut le prendre quand il passe. |
| `jeanne_mushroom` | Je fais un herbier des champignons. Il me manque une girolle. (On ne mange pas l'herbier.) Jeanne | Elle sent l'abricot ! C'est la plus belle page de mon herbier. |
| `firmin_omelettes` | Jeudi, pique-nique du chef de halte et du scieur. Il nous faut 2 omelettes: Basile ne sait pas cuisiner, moi non plus. Firmin | Deux omelettes ! Basile dira qu'elles sont trop cuites. C'est sa façon de dire merci. |
| `odette_basket` | Le panier des voyageurs du samedi: 3 carottes et 3 œufs. Un passage au potager, un au poulailler, et le tour est joué. Odette | Un panier complet ! Les voyageurs ne sauront jamais d'où vient tout ça. Moi, si. |
| `firmin_supper` | Souper du chef de halte: une truite et une laitue. Une ligne à lancer, un rang à cueillir, et Firmin dit merci. Firmin | Truite et salade ! Je me croirais en ville, un dimanche. |
| `basile_fence` | La barrière de ma cour penche. Apportez 4 planches, puis venez à deux: une paire de mains pour tenir, une autre pour me passer les clous. B. | (scène, ci-dessous) |
| `jeanne_poem` | Spectacle sur la place, n'importe quel soir jusqu'à vendredi, entre 17 h et 19 h. Venez à deux, sinon je ne commence pas. Jeanne | (scène, ci-dessous) |
| `jeanne_snack` | Je fais un goûter au bord de l'eau. Il me faut 2 œufs et 4 mûres. Après, venez le manger avec moi sur le banc de la berge, à deux, l'après-midi. Jeanne | (scène, ci-dessous) |
| `jeanne_snack_nuts` | Goûter d'automne ! Il me faut 2 œufs et 4 noisettes. Après l'école, venez le manger avec moi sur la margelle du puits, à deux. Jeanne | (scène, ci-dessous) |
| `odette_preserves` | Les bocaux de l'hiver: 6 noisettes et 6 radis. Si vous vous partagez le travail, ce sera fait avant le café. Odette | Tout y est. Prenez ce pot de gelée de sureau: il est de cette année, comme vous. (la première fois; ensuite: « Tout y est. L'hiver peut venir, mes bocaux l'attendent. ») |

Scènes partagées (dialogues `kind: "scene"`, `shared: true`, `point` du lieu, `when`: l'étape de l'annonce active et l'heure):

| Scène | Point | Répliques |
|---|---|---|
| `basile_fence_scene` | `sawmill_yard` | Basile: « Tenez-la droite. Une paire de mains à chaque bout. » / Narrateur: « Vous tenez la barrière pendant que Basile cloue. Trois coups, puis trois autres. » / Basile: « Droite. Comme une planche qu'on a écoutée. » |
| `jeanne_poem_scene` | `village_square`, 17 h à 19 h | Jeanne: « Bonsoir, le public ! Poésie de Jeanne. » / Jeanne: « Le samedi, le train siffle deux fois, / une fois pour bonjour, une fois pour moi. / Il emporte nos radis jusqu'à la ville, / et nous laisse la Halte, bien tranquille. » / Jeanne: « Vous pouvez applaudir, maintenant. » / (la première fois) Jeanne: « Pour votre maison. C'est le train. Enfin, c'est vous dans le train. Non, c'est le train. » (`give_item jeanne_drawing`, `to: cellar`) |
| `jeanne_snack_scene` | `riverbank`, 14 h à 17 h 30 | Narrateur: « Jeanne partage le goûter en trois parts presque égales. » / Jeanne: « La plus grosse, c'est la mienne. C'est moi qui ai eu l'idée. » |
| `jeanne_snack_nuts_scene` | `village_square`, 16 h 30 à 18 h 30 | Narrateur: « Jeanne casse les noisettes avec un galet. Elle en rate une sur deux et rit à chaque fois. » / Jeanne: « La margelle, c'est la meilleure table du bourg. Elle ne bouge pas. » |

Lettre `firmin_board` (nouvel expéditeur `firmin`, « Firmin, chef de halte »; jour 16, 6 h, rattrapée à la reprise). Titre: « Le tableau des annonces ». Texte: « Les gens du bourg ont toujours un service à demander, et maintenant ils savent à qui. J'épinglerai leurs annonces au tableau du quai, le dimanche et le mercredi matin. Le bourg a aussi ses projets: un banc au gué, des fleurs sur le quai. J'en tiendrai les comptes au même tableau, et Basile se met au travail dès que la somme est là. Rien n'oblige, tout fait plaisir. F. »

Notifications (`messages`): `annonce_posted` « Nouvelle annonce au tableau du quai: {title}. » (à 6 h, chez les deux, une fois); `annonce_done` « Annonce faite: {amount} sous. » ; `annonce_expired` « Annonce retirée: {giver} a trouvé une autre solution. Rien de perdu. »

Titres au carnet (`annonces.<id>.title`): « La vitrine d'Odette », « Une truite pour Firmin », « Des planches pour Basile », « Le chevesne de Jeanne », « Les crêpes de la pension », « Une soupe pour le chef de halte », « La tisane de Basile », « Les noisettes de Basile », « Les confitures d'Odette », « La gelée de sureau », « L'herbier de Jeanne », « Le pique-nique du jeudi », « Le panier du samedi », « Le souper de Firmin », « La barrière de Basile », « Le spectacle de Jeanne », « Le goûter de Jeanne », « Le goûter d'automne », « Les bocaux de l'hiver ». Vérifié contre `quetes.json`: aucun titre déjà pris.

### 1.6 Ce que montre le tableau

Onglet « Annonces » (consignes pour l'interface, section 5.2 pour le gabarit commun): l'annonce en cours en carte (titre, texte en écriture manuscrite, demande en liste à cocher, échéance « jusqu'à mardi, 20 h », récompense « Merci: 110 sous »), puis la précédente avec son état (« Faite », « Retirée »). Une annonce faite affiche le tampon « Fait » à la couleur du joueur qui l'a remise. Le carnet range les annonces dans un groupe « Annonces », sous les coups de main.

### 1.7 Cas limites

| Cas | Règle |
|---|---|
| Les deux donnent en même temps | règles de la caisse et des dons (SI-01): le premier don reçu par l'hôte compte, le second ne fait rien (« Déjà donné ») |
| Un joueur donne une partie, l'autre le reste | les dons se cumulent (condition `given` avec comptage, `who: either`) |
| Scène à deux, l'habitant absent | la scène attend: ses conditions comprennent l'heure et la présence; le carnet dit l'heure et le lieu |
| Pause, absence de l'autre | horloge arrêtée (PA-04): l'échéance ne passe pas pendant l'absence |
| Échéance pendant une scène ou un menu | l'étape se clôt à la fin de la scène ou du menu, jamais au milieu |
| Partie reprise après une échéance | l'annonce passe à « Retirée » à l'aube, sans message |
| Le duo possède déjà l'objet au tirage | permis: c'est un plaisir de l'avoir sous la main |

## 2. À quoi sert l'argent

### 2.1 Le constat, chiffré

- Les robots médians à `757c3b0` (graines 20261030 et 1, profil médian, jours 1 à 63, test jetable qui relève la bourse à chaque aube) n'achètent que des graines après la démo: **6 825 et 7 561 sous au jour 63**, pour 1 405 et 1 428 au jour 16. Les commandes payées vont de 556 à 1 512 sous.
- Le catalogue et le comptoir vendent huit meubles et objets pour 500 sous en tout, une fois chacun; restent les graines (6 à 12 sous). La pièce de la maisonnette fait 5 x 4 cases (`house_interior`) et se remplit vite: les meubles au sol ne peuvent pas être la réponse.
- Le modèle de la simulation, calé sur ces robots (paie des commandes ramenée à 88 % de celle du modèle du tour 8, partie 6), donne 7 300 sous au jour 63 en médiane (7 038 à 7 547). Le duo médian peut donc dépenser **environ 7 300 sous de la commande, plus 900 sous d'annonces**, du jour 16 au jour 63.

### 2.2 Cinq usages, et pourquoi chacun

| Usage | Ce qu'on y gagne | Pourquoi on le veut | Où |
|---|---|---|---|
| Outils de la Halte | un geste plus facile: arrosoir qui porte deux fois plus, hache qui abat en deux coups, canne qui laisse plus de temps pour ferrer | utile chaque jour, et chacun le sien: « je prends la canne, tu prends la hache » | catalogue, rayon Outillage |
| Basse-cour | une poule de plus, nommée par Jeanne: un œuf de plus par jour | la commande demande des œufs; une poule de plus, c'est une poule de plus à aimer | catalogue, rayon Basse-cour |
| Maison | des objets muraux de saison, un fauteuil | voir sa maison changer avec les semaines, dans une pièce déjà pleine | catalogue, rayon Maison |
| Cadeaux aux habitants | une réplique de remerciement et un changement visible chez l'habitant | on a entendu un souhait, on y répond: le bourg se souvient de vous | catalogue, rayon Pour offrir |
| Chantiers | un banc, des fleurs, un toit, un réverbère dans le bourg; un banc et un auvent chez vous | les plus gros prix: on économise à deux, et le résultat reste sur la carte | tableau du quai (bourg), Basile (maisonnette) |

### 2.3 Le catalogue de la semaine

**Règle des pages.** Le catalogue garde sa forme (commande jusqu'au vendredi à minuit, livraison le samedi à 10 h avec le train, `economy.catalogue.repeatWeekly`). Chaque samedi à 10 h, il gagne la page de la semaine: les articles de la saison et de la semaine de saison (1, 2 ou 3) y paraissent; ceux des semaines passées restent tant qu'ils ne sont pas tous achetés, et un article de saison s'en va à la fin de sa saison (il reviendra la même semaine de la saison suivante de cette sorte, l'année d'après). L'ancrage se fait par saison et semaine de saison, jamais par jour absolu: une partie reprise au jour 43 voit d'un coup toutes les pages déjà parues. Les articles d'avant ce tour (lampe, tapis, rideaux, poste à galène, poêle) restent en vente comme aujourd'hui. Un rayon « Pour offrir » ne montre un cadeau qu'une fois le souhait de l'habitant entendu par l'un des deux (section 2.7).

| Article | `id` | Rayon | Prix | Exemplaires | Paraît | Retiré | Effet et emprise |
|---|---|---|---|---|---|---|---|
| Arrosoir de cuivre | `watering_can_copper` | outillage | 220 | 2 | été, semaine 1 | | outil, capacité 20 au lieu de 10 |
| Hache de la forge | `axe_forged` | outillage | 260 | 2 | été, semaine 1 | | outil, 2 coups par arbre au lieu de 3 |
| Canne en bambou refendu | `fishing_rod_bamboo` | outillage | 300 | 2 | été, semaine 2 | | outil, attente avant la touche x 0,8, fenêtre pour ferrer 2 s au lieu de 1,5 |
| Une poule de plus (Brioche) | `hen_extra` | basse-cour | 250 | 1 | été, semaine 2 | | une quatrième poule, rousse, nommée par Jeanne |
| Une poule de plus (Pervenche) | `hen_extra_2` | basse-cour | 300 | 1 | automne, semaine 1 | | une cinquième poule, blanche; le poulailler en loge cinq |
| Chapeau de paille au clou | `straw_hat` | maison | 30 | 1 | été, semaine 1 | fin de l'été | mural, beauté 2 |
| Herbier encadré | `pressed_flowers` | maison | 45 | 1 | été, semaine 2 | fin de l'été | mural, beauté 3 |
| Fauteuil d'osier | `wicker_armchair` | maison | 160 | 1 | été, semaine 3 | | au sol, 1 x 1, confort 3, s'y asseoir comme sur une chaise |
| Calendrier de la coopérative | `coop_calendar` | maison | 50 | 1 | automne, semaine 1 | | mural, son image suit la saison (quatre gravures) |
| Horloge murale | `wall_clock` | maison | 140 | 1 | automne, semaine 2 | | mural, ses aiguilles donnent l'heure du jeu, tic-tac à moins de 3 m dans la pièce |
| Couronne de feuilles | `autumn_wreath` | maison | 40 | 1 | automne, semaine 3 | fin de l'automne | mural, beauté 3 |
| Boîte de craies | `chalk_box` | pour offrir | 35 | 1 | souhait de Jeanne | | cadeau (2.7) |
| Moulin à café | `coffee_mill` | pour offrir | 110 | 1 | souhait d'Odette | | cadeau (2.7) |
| Tablier de cuir | `leather_apron` | pour offrir | 120 | 1 | souhait de Basile | | cadeau (2.7) |
| Écharpe de laine | `wool_scarf` | pour offrir | 90 | 1 | souhait de Firmin | | cadeau (2.7) |

Textes du catalogue (`objets.json`, `description`): arrosoir de cuivre « Deux fois plus d'eau, deux fois moins d'allers au puits. »; hache de la forge « Forgée dans la vallée. Deux coups, et l'arbre se couche. »; canne en bambou refendu « Souple et sensible: on sent la touche plus tôt, on a plus de temps pour ferrer. »; poule « Une poule de plus pour le poulailler. Jeanne a déjà un nom pour elle. »; chapeau de paille « Pour les jours de soleil. Le clou est fourni. »; herbier « Les fleurs de la vallée, pressées et encadrées. »; fauteuil « En osier tressé. Il grince juste ce qu'il faut. »; calendrier « La gravure change avec la saison. Celle de l'automne montre la Halte. »; horloge « Elle sonne les heures, et elle a toujours raison. »; couronne « Feuilles de chêne et de vigne vierge, nouées d'un ruban. »

### 2.4 Les outils de la Halte

- **Un par joueur.** Un outil acheté arrive dans le sac de celui qui l'a commandé; l'ancien va au coffre (rien ne se perd). Les deux exemplaires se commandent séparément: c'est une conversation (« d'abord la tienne ou la mienne ? »). Un outil se prête: on le pose dans le coffre, l'autre le prend.
- **Même verbe, meilleur geste.** Un outil amélioré a le `toolKind` de l'outil de départ (`watering_can`, `axe`, `fishing_rod`) et ses valeurs propres (`capacity`, `chops`, `biteWaitFactor`, `hookWindowSeconds`). Les astuces, les quêtes et les conditions qui parlent de l'arrosoir, de la hache ou de la canne marchent avec lui (`used_tool_at` lit le `toolKind`).
- **Pourquoi ces trois.** L'arrosoir allège la corvée qui pèse le plus (R12: les soins restent sous 30 % du temps dehors, mesuré à 0,5 % au tour 8, mais c'est l'aller au puits qui se sent); la hache rend la lisière plus rapide sans changer ce qu'elle donne; la canne aide le joueur le moins à l'aise avec le ferrage (fenêtre de 2 s), sans qu'on parle de « mode facile ». Aucun outil ne change ce que donne une ressource: la commande garde sa capacité (tour 8, 4.3), seul le temps passé baisse.
- **Le texte d'aide.** À la première prise en main, astuce `tool_upgrade_hint`: « {item}: même geste qu'avant, en mieux. L'ancien t'attend au coffre. »

### 2.5 La basse-cour

- La poule commandée arrive le samedi avec le train, dans une cage posée devant le poulailler; à 10 h 30, Jeanne vient la nommer (scène personnelle de celui qui l'a commandée, pas une scène à deux): « Celle-là, c'est Brioche. Elle a la couleur d'une brioche. Je ne discute pas. » puis « Celle-là, c'est Pervenche. Elle a un air de fleur qui pousse dans les fossés. » La poule rejoint les autres (`spawn_animals`, variantes `hen_red` puis `hen_white`).
- Elle pond un œuf par jour si elle est nourrie (règle de la démo); la mangeoire est commune, rien de plus à faire.
- Les noms des trois premières poules restent le secret de la quête du tour 6; ceux des nouvelles sont connus des deux.
- **La commande en tient compte**: la capacité d'œufs d'une semaine vaut `poules x 6 x 0,9` (16,2 avec trois poules, 21,6 avec quatre, 27 avec cinq), lue au tirage.
- Plafond: cinq poules (`hens.max`). Pourquoi cinq: le poulailler a été bâti avec quatre éléments pour trois poules; l'artiste vérifie qu'il montre cinq places au perchoir (section 9).

### 2.6 Les chantiers

Deux files de chantiers, dont un seul ouvert à la fois par file. Un chantier fini est bâti par Basile dans la nuit; il paraît au matin suivant, avec une notification chez les deux et deux répliques d'habitants (section 3.5).

| Chantier | `id` | Sorte | Prix | Où | Pourquoi là | Ce que ça change |
|---|---|---|---|---|---|---|
| Un banc au gué | `ford_bench` | bourg | 600 | cases (23, 36) et (24, 36), rive nord, tourné vers l'eau (cap 180) | on y attend une touche ou le héron; à 2 m à l'est du point de pêche nord du gué (21,5 ; 37,5), hors du chemin du gué (x 17 à 19); la clôture de la rive (x 10 à 15) occupe l'ouest | un banc à deux places (`benches`); envie `ford_bench_sit` |
| Des jardinières au quai | `quay_planters` | bourg | 700 | cases (25, 18), (34, 18) et (49, 18), au bord sud du quai, côté place | jamais devant la porte de la voiture (38,5 ; 17,5), ni sur les deux passages vers la place (x 30 et 31, x 43 et 44), ni contre le panneau de la gare (x 45 et 46) | fleurs de saison (été: géraniums rouges; automne: asters mauves; hiver: paillage), une salutation de plus dans la lettre de la coopérative (« Le chef de train a remarqué vos fleurs sur le quai. ») |
| Un toit pour le puits | `well_roof` | bourg | 950 | au-dessus du puits (40,0 ; 28,0): quatre poteaux, toit de tuiles à deux pans, faîte à 2,4 m, treuil | un puits ouvert prend les feuilles d'automne et la pluie; le toit ne déborde pas de la margelle | les jours de pluie, Jeanne joue sous le toit du puits au lieu du banc du quai |
| Le réverbère du chemin | `path_lamp` | bourg | 1 300 | (14,5 ; 26,5), bord nord du chemin de la maisonnette | le tronçon le plus sombre du retour de la place: le lampadaire le plus proche, au passage à niveau (20,5 ; 20,5), est à 9 m; loin du ponton, qui doit rester sombre pour les étoiles | lumière la nuit (modèle `lamp_post`, déjà livré); envie `lamp_walk_home` |
| Un banc au pignon | `house_bench` | maisonnette | 700 | cases (12, 22) et (12, 23), contre le pignon est de la maisonnette, tourné vers l'est (cap 90) | le soleil du matin, le chemin du quai et le passage des trains; entre le mur (x 11) et le chemin (x 13), sans le toucher | un banc à deux places; envie à deux `morning_bench` |
| Un auvent sur la porte | `door_canopy` | maisonnette | 800 | au-dessus de la porte (case (8, 26)), sans emprise au sol | la porte donne au sud, sur le chemin: la pluie y entre | sous l'auvent, la pluie ne tombe pas sur le personnage (rendu); envie `canopy_rain` |

Règles:

| Règle | Valeur | Raison |
|---|---|---|
| Ouverture | bourg: jour 16 (`firmin_board`); maisonnette: jour 22 (lettre `basile_works`); le suivant de chaque file s'ouvre le matin qui suit le précédent bâti | un but à la fois par file, deux files pour ne jamais attendre |
| Souscription du bourg | on verse au tableau par 50 ou 100 sous, ou « le reste »; un versement de 100 sous ou plus passe par l'accord de l'autre (`bigPurchaseThreshold`, EC-04) | la bourse est commune: un gros versement se décide à deux |
| Commande à Basile | à son établi, prix payé d'un coup (accord de l'autre au-delà de 100 sous), 10 sous de moins par planche apportée, 20 planches au plus | on peut payer en bois: le duo qui a de la lisière en profite |
| Le bourg participe | aucun | le chantier est le vôtre; la souscription du bourg est un pot commun que vous seuls remplissez pour l'instant (J1 ajoutera Lucie) |
| Rien ne se perd | ce qui est versé reste au chantier, même des semaines | |

Lettre `basile_works` (jour 22, 6 h, rattrapée à la reprise). Titre: « Basile prend des commandes ». Texte: « Maintenant que la lisière repousse, j'ai du bois pour vous. Un banc contre votre pignon, un auvent sur votre porte. Passez à l'établi. Si vous m'apportez des planches, ce sera moins cher. B. »

Textes du tableau (`ui.board`): « Chantiers du bourg », « {name}: {paid} sur {price} sous », « Verser 50 sous », « Verser 100 sous », « Verser le reste ({amount} sous) », « Le chantier est payé: Basile s'y met cette nuit. » Établi de Basile: « Commander à Basile », « {name}: {price} sous », « Apporter des planches: {n} sur 20 ({discount} sous de moins) ». Notification du matin `chantier_built`: « Basile a fini dans la nuit: {name}. »

### 2.7 Les cadeaux aux habitants

Chaque habitant a un souhait, dit une fois par une réplique (priorité 3, `once: player`, section 3.5) à partir d'un jour donné. Dès que l'un des deux l'a entendu, l'article paraît au rayon « Pour offrir » avec le nom de l'habitant (« Pour Jeanne: boîte de craies »). Acheté, il arrive au sac de l'acheteur le samedi; une quête de coup de main `gift_<habitant>` démarre (« Un cadeau pour Jeanne », étape `given`), et le choix « Offrir {item} » apparaît dans la conversation.

| Habitant | Souhait, à partir de | Article | Ce qui change ensuite |
|---|---|---|---|
| Jeanne | jour 16 | boîte de craies | une marelle à la craie paraît sur la place (décalque au sol, 1 x 3 m, sur les pavés, hors des passages et à plus de 3 m des places des moments); la pluie l'efface, Jeanne la redessine au premier jour sans pluie (elle joue à la marelle le soir, `play` au point `hopscotch`) |
| Odette | jour 22 | moulin à café | un moulin sur le rebord du comptoir (accroche du comptoir), et le bruit du moulin à la première ouverture de la boutique chaque jour |
| Basile | jour 29 | tablier de cuir | Basile porte le tablier (P1 pour le modèle; en P0, sa réplique le dit) |
| Firmin | jour 43 | écharpe de laine | Firmin porte une écharpe en automne et en hiver, dès le lendemain (le maillage du foulard des joueurs, ajusté à son modèle) |

Remerciements (dialogue personnel, à la remise): Jeanne « Des craies ! Toutes les couleurs, même le vert qui ne sert à rien. Demain, il y aura une marelle sur la place. » / Odette « Un moulin neuf ! L'ancien ira au grenier, avec les souvenirs qui grincent. » / Basile « Un tablier. Du bon cuir. Je ne dis pas merci, je le mets. » / Firmin « Une écharpe ! Émile en avait une pareille. Je la porterai le soir, sur le quai, et je penserai à lui. Et à vous. »

### 2.8 Ce qui reste bon marché, et pourquoi

Les graines restent à 6, 8 et 12 sous, le pain d'Odette à son prix: semer et manger ne doivent jamais coûter cher, c'est le cœur du jeu. Aucune culture nouvelle dans ce tour (modèles à cinq stades, hors périmètre). Odette continue d'acheter comme aujourd'hui (80 %, 300 sous par jour): la production d'un duo, pas son plafond, limite ce qu'il lui vend (environ 400 sous par semaine au plus pour un duo qui ne fait que ça, modèle « glouton »).

### 2.9 L'équilibrage

| Valeur | Initiale | Unité | Plage | Raison |
|---|---|---|---|---|
| Prix total de ce qui est désirable, jours 16 à 64 | 8 080 | sous | 7 000 à 9 300 | un peu plus que ce que dépense un duo médian qui achète tout dès qu'il peut (il finit le jour 58 en médiane); x 0,85 il finit le jour 57 et garde 1 791 sous; x 1,15 il ne finit jamais et ne garde que 183 sous |
| Outils | 220, 260, 300 | sous | x 0,8 à x 1,2 | deux à trois jours de commande chacun; deux exemplaires: 1 560 sous pour les six |
| Poules | 250, 300 | sous | 200 à 400 | une poule rapporte 8 sous d'œufs par jour: amortie en cinq semaines, c'est un plaisir avant d'être un placement |
| Chantiers du bourg | 600, 700, 950, 1 300 | sous | x 0,8 à x 1,3 | le dernier (le réverbère) vaut plus d'une semaine de revenu: un but d'épargne pour la fin de l'automne |
| Chantiers de la maisonnette | 700, 800, moins 10 sous par planche | sous | | le bois de la lisière se transforme en confort |
| Réserve d'un duo (simulation) | 150 | sous | | ce qu'un duo garde pour ses graines |

Résultats (partie 6, 2 000 graines, jours 16 à 64):

| Duo | Part achetée au jour 64 (médiane, au plus bas) | Tout acheté (jour médian; parties) | Bourse au jour 63 (médiane) | Semaines avec un but d'épargne | Part de ce qu'il a dépensée chaque semaine |
|---|---|---|---|---|---|
| médian | 100 %, 96 % | jour 58; 95 % des parties | 579 | 88 % | 70 % |
| tranquille | 96 %, 67 % | jamais en médiane; 20 % des parties | 191 | 97 % | 71 % |
| glouton (vend 400 sous par semaine à Odette) | 100 % | jour 57; toutes | 3 437 | 67 % | 53 % |

Lecture: l'argent garde un sens jusqu'au jour 58 pour un duo médian qui achète tout ce qu'il peut, jusqu'au jour 64 pour un duo tranquille; un vrai duo choisira et ne prendra pas tout (le fauteuil, l'horloge), ce qui lui laisse un chantier à financer en fin d'automne. Le duo glouton finit une semaine avant la fin avec 3 400 sous: c'est assumé (il a travaillé plus), et l'hiver apportera de quoi dépenser. Ordre médian des achats: banc du gué (jour 16), craies (18), arrosoirs et haches (23), moulin (24), cannes et Brioche (30), tablier (31), fauteuil (36), jardinières (37), toit du puits et Pervenche (44), écharpe (45), horloge (50), banc au pignon (51), couronne et réverbère (57), auvent (58).

### 2.10 À chaque achat, son retour

Voir section 7 (actions et retours). Un achat de catalogue joue `catalogue-order` (déjà livré); un versement au chantier joue `coins-drop` (pièces dans une boîte en fer, 0,6 s, nouveau); un chantier bâti joue au matin `chantier-built` (trois coups de marteau lointains puis un accord, 2 s, nouveau).

### 2.11 Correctifs de la commande

**La truite d'été (réserve 3 de la revue).** Le coût d'un poisson suit désormais la saison du tirage: `cost(saison) = cost(printemps) x part(printemps) / part(saison)`, où `part` est le poids du poisson divisé par la somme des poids de la saison (`feel.fishWeightsBySeason`). La règle se calcule à partir des poids: aucune table à tenir à la main. Résultat (partie 2):

| Poisson | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Goujon | 0,083 | 0,083 | 0,1 | 0,061 |
| Chevesne | 0,167 | 0,125 | 0,167 | 0,182 |
| Truite | 0,333 | 0,667 | 0,222 | jamais commandée |

La saison de référence est celle du tirage (le samedi d'avant) si les 6 jours de production sont dans la même saison, sinon la saison qui en compte le plus (règle « 4 jours sur 6 » du tour 8). Réglage: `order.generated.fishCostFromWeights: true`, `fishCostReferenceSeason: "spring"`.

**Les lignes du potager (réserve 5).** Une quantité de radis ou de carottes s'arrondit au rendement d'une case (3), et chaque ligne a un plafond:

| Produit | Plafond | Produit | Plafond | Produit | Plafond |
|---|---|---|---|---|---|
| radis, carotte | 18 | laitue, croque-au-sel | 8 | soupe | 6 |
| omelette | 8 | œuf | 12 | goujon, mûre, noisette, pissenlit | 12 |
| chevesne, ail des ours, girolle | 6 | truite | 3 | planche | 20 |
| cèpe | 4 | grappe de sureau | 10 | | |

Si la part perdue au plafond dépasse 0,2 semaine de travail et que la commande a moins de 6 lignes, elle gagne une ligne, tirée par les règles habituelles (familles, produits de base, saison), avec cette part. Résultat (partie 3, 3 500 commandes, 16 743 lignes): 6,2 % des lignes dépassaient 18 unités (jusqu'à 32 radis et 21 croque-au-sel); plus aucune; 23 % des commandes gagnent une ligne; la paie médiane passe de 1 315 à 1 246 sous (-5 %), parce qu'une part perdue sous 0,2 n'est pas redonnée. C'est voulu: la commande est un peu plus légère et se lit mieux.

### 2.12 Ce que le robot ajoute

**Routine.** Après la démo, chaque robot: lit le tableau à l'aube; fait l'annonce « coup de main » s'il a le produit ou peut l'obtenir dans la journée; pour l'annonce « à deux », les deux robots se partagent les lignes et vont ensemble à la scène; achète selon la liste de la simulation (`WISH_ORDER` de `tour9_automne.py`, premier article abordable en gardant 150 sous); verse au chantier ouvert ce qui dépasse 300 sous (par 100); apporte ses planches de trop à Basile; offre un cadeau dès qu'il l'a. Le profil glouton vend en plus à Odette ce qui ne sert pas à la commande.

**Mesures** (nouvelles lignes du relevé):

| # | Mesure | Définition |
|---|---|---|
| L-13 | Bourse | sous à chaque aube; dépenses du jour par usage (outil, poule, maison, cadeau, chantier, graines) |
| L-14 | Buts | à chaque aube, les buts ouverts au carnet: envie, annonce, commande, chantier ouvert, cadeau en attente; but nouveau du jour (annonce ou chantier jamais vu, article jamais paru, souhait entendu) |
| L-15 | Annonces | gabarit affiché, faite ou retirée, jour, récompense |
| L-16 | Achats | article, jour, prix; chantiers: versements et jour bâti |

**Objectifs** (calculés, ne font pas échouer; seuils proposés):

| # | Objectif | Seuil | Période |
|---|---|---|---|
| O-11 | Part de la bourse dépensée par semaine (dépensé / bourse du samedi matin plus revenus de la semaine) | au moins 35 % en moyenne, profil médian | jours 22 à 63 |
| O-12 | Un but d'épargne | au moins 60 % des samedis matin, un article ou chantier ouvert coûte plus que la bourse moins 150 sous (profil médian) | jours 16 à 63 |
| O-13 | Un but nouveau par semaine | toutes les semaines, au moins un but nouveau au carnet (L-14) | jours 16 à 63 |
| O-14 | Bourse qui dort | bourse au jour 63 sous 2 500 sous en profil médian | |
| O-15 | Annonces | au moins 70 % des annonces faites par les robots médians | jours 16 à 63 |

**Invariants** (font échouer):

| # | Invariant |
|---|---|
| I-09 | deux annonces par semaine (dimanche, mercredi) dès l'ouverture du tableau; jamais le même gabarit à moins de 10 jours; jamais deux annonces en cours; jamais une cueillette hors saison ni un produit jamais obtenu |
| I-10 | bourse jamais négative; jamais plus d'exemplaires achetés que le catalogue n'en propose; un chantier bâti a reçu exactement son prix (moins les planches); un chantier n'est jamais bâti deux fois |
| I-11 | état sous la borne de la section 3.8 à chaque aube, sur 84 jours, profil glouton compris |

## 3. L'automne entier, jusqu'au samedi 64

### 3.1 La limite et les étapes

`clock.lastDay` passe à `{ "day": 64, "end": "16:00" }`. Une étape `autumn_end` s'ajoute au samedi 64 à 16 h. Pourquoi le 64 et pas le 63: même raison qu'au tour 8 (1.4), la partie finit sur un départ de train, commande payée; le samedi 64 ouvre l'hiver, on en voit le premier matin (palette d'hiver, potager au repos, carte de saison déjà écrite).

| Étape | Jour et heure | Après | « Rester à la Halte » | Écran |
|---|---|---|---|---|
| `demo` | samedi 15, 16 h | inchangé | oui | « Deux semaines à la Halte d'Aubrune » |
| `summer_end` | samedi 43, 16 h | paiement, `firmin_stage_summer` (inchangé) | **oui désormais** (`lastDay` est après l'étape) | « Six semaines à la Halte d'Aubrune », textes réécrits ci-dessous |
| `autumn_end` | samedi 64, 16 h | paiement de la commande du 64, scène `firmin_stage_autumn` | seulement si une version future porte `lastDay` plus loin | « Neuf semaines à la Halte d'Aubrune » |

Rien d'autre ne change dans la règle des étapes (tour 8, 1.1 et 1.2). Une sauvegarde arrêtée sur l'écran du jour 43 (phase `ended`, étape non franchie) se charge sur ce même écran, qui propose maintenant « Rester »: aucune migration de la partie. `world.stages.passed` accepte `autumn_end`; le type `StageId` gagne `'autumn_end'`.

Textes (`textes.json`, `stages`):

| Clé | Texte |
|---|---|
| `stages.summer_end.text` | Restez pour l'automne: le bois roussit, les noisettes tombent, et le bourg a des projets pour vous. |
| `stages.summer_end.next` | (inchangé, ne s'affiche plus dans cette version) |
| `stages.autumn_end.title` | Neuf semaines à la Halte d'Aubrune |
| `stages.autumn_end.subtitle` | Du premier train au premier matin d'hiver. |
| `stages.autumn_end.text` | L'hiver arrive à la Halte, et la suite de votre histoire est en préparation. Votre partie s'arrête au départ de ce train: rien n'est perdu, elle reprendra ici. |
| `stages.autumn_end.next` | « Rester à la Halte » reviendra avec la prochaine mise à jour du jeu. |
| `stages.autumn_end.highlight` | Neuf semaines à la Halte |
| `title.ticket` (`textes-interface.json`) | Neuf semaines à la Halte d'Aubrune |

Scène `firmin_stage_autumn` (au départ du train du 64, après `pay_order` et `gather_players` au point `quay_bell`, avant `end_stage autumn_end`):

- Firmin: « Neuf trains. Les feuilles sont tombées, et vous êtes toujours là. »
- Firmin: « L'hiver, la halte se tient chaud comme elle peut. Elle a vos fenêtres allumées, maintenant. »

Les compteurs de l'écran d'étape (journées vécues, lignes des commandes, meubles posés) gagnent une quatrième case, « chantiers bâtis » (`ui.stage.chantiers`, « {n} chantiers »), à toutes les étapes.

Ce qui est riche jusqu'au jour 64, et ce qui ne l'est pas (à dire au client tel quel):

| Riche | Pas encore là |
|---|---|
| la météo et la brume, trois saisons de lumière, la commande de chaque samedi, deux annonces par semaine, six chantiers et quinze articles à s'offrir, la cueillette de trois saisons (sept sortes), l'école de Jeanne, 146 répliques et 33 envies écrites après la démo, 13 moments en tout, dont 8 possibles en été et 6 en automne | aucune scène d'histoire après le jour 15 (les annonces font de petites scènes); pas de nouveau lieu; pas de fête; Lucie n'arrive pas; l'hiver se limite au matin du 64 |

### 3.2 Ce qui change en automne

| Aspect | Automne (jours 43 à 63) | Déjà livré ou nouveau |
|---|---|---|
| Palette, lumière, fin du jour 19 h 30, lever 6 h 30 | `palette-automne.png`, déformation de l'heure | livré (tour 8, 2.2 et 2.5) |
| Carte de saison (jour 43) | lignes réécrites, ci-dessous | nouveau texte |
| Météo | 35 / 30 / 35, brume à 25 % | livré |
| Cueillette | noisette, girolle, et maintenant cèpe (après la pluie) et sureau (jours 1 à 14) | nouveau (3.4) |
| Poissons | 5 / 3 / 3, les truites reviennent | livré |
| Habitants | Jeanne à l'école (3.3); les autres comme dans la démo | nouveau |
| Répliques, envies | 10 répliques d'automne par habitant, 15 envies | nouveau (3.5, 3.6) |
| Moments | la dame blanche, les lanternes du quai, plus ceux d'avant | nouveau (4) |
| Ambiance sonore | vent dans les feuilles, corneilles (livré); nouveau: chuintement de la chouette au loin certains soirs (`owl_far`, une fois entre 19 h 30 et 21 h, les jours sans le moment) | nouveau |

Carte de saison d'automne (`seasonCards.autumn.lines`): « Le soir tombe plus tôt, vers 19 h 30. » / « À la lisière: noisettes, baies de sureau, et des cèpes après la pluie. » / « Jeanne a repris l'école: on la croise le soir et le mercredi. » (La ligne des truites part dans une réplique de Firmin, 3.5.)

### 3.3 Jeanne retourne à l'école

L'école est au haut du bourg (sortie `exit_east_promenade`, par `village_exit`): Jeanne y part et en revient à pied, comme les habitants qui rentrent chez eux hors carte.

| Jours d'automne | Jeanne |
|---|---|
| lundi, mardi, jeudi, vendredi | 8 h 00 à 8 h 30: elle traverse la place vers `village_exit` (cartable); 8 h 30 à 16 h 30: `absent` (`offstage`); 16 h 30 à 18 h 30: `play` sur la place (`village_square`), puis comme dans la démo |
| mercredi, samedi, dimanche | comme dans la démo (et l'été pour le samedi du train) |
| jour de pluie, jour d'école | 16 h 30 à 18 h 30 sous le toit du puits si `well_roof` est bâti, sinon sur le banc du quai (règle du tour 8) |

Entrées ajoutées en tête de son emploi du temps (`season_is: ["autumn"]`, `weekday_is: ["monday", "tuesday", "thursday", "friday"]`). 12 jours d'école sur 21 en automne (partie 1). Pourquoi le mercredi libre: c'est la coutume des écoles de campagne de l'époque du jeu, et cela garde Jeanne un jour de semaine pour les annonces et les envies. Les confidences venues de Jeanne (martin-pêcheur, dame blanche) arrivent au petit-déjeuner: elles ne dépendent pas de sa présence.

### 3.4 Cueillette d'automne

Deux cueillettes nouvelles, chacune là où elle pousserait:

- **Le cèpe** pousse au pied des chênes, à l'automne, après la pluie: coins de sous-bois `forage_edge_01` et `_02` (chênes `tree_edge_01`, `_03` et `_05` tout près). Rare (poids 2), trois fois plus probable le lendemain d'une pluie, comme la girolle.
- **Le sureau** est le buisson `bush_41` (33,5 ; 8,5), à la lisière au soleil (déplacé au tour 8). Ses baies mûrissent au début de l'automne et ne durent pas: jours 1 à 14 de l'automne seulement. Coin nouveau `forage_edge_06` (33,5 ; 9,5), au pied du sureau, au sud (côté chemin), comme les ronciers aux coins 03 à 05; les grappes se posent sur le buisson (points `berry_spots` du sureau), jamais dans l'herbe.

| Cueillette | `id` | Saisons | Poids | Quantité | Coins | Prix | Modèle |
|---|---|---|---|---|---|---|---|
| Pissenlit | `dandelion` | P | 6 | 2 à 3 | lisière | 4 | `dandelion` |
| Ail des ours | `wild_garlic` | P | 3 | 1 à 2 | sous-bois | 8 | `wild_garlic` |
| Mûre | `blackberry` | E | 6 | 2 à 3 | lisière | 3 | `blackberry` |
| Girolle | `chanterelle` | E, A | 3 | 1 à 2 | sous-bois, `_05` | 12 | `chanterelle` |
| Noisette | `hazelnut` | A | 6 | 2 à 3 | sous-bois | 3 | `hazelnut` |
| Cèpe | `cep` | A | 2 | 1 à 2 | sous-bois | 15 | `cep`, deux ou trois cèpes, chapeau brun sur pied clair, 0,25 m |
| Grappe de sureau | `elderberry` | A, jours 1 à 14 | 6 | 2 à 3 | `_06` | 4 | `elderberry`, ombelles de baies noires sur tiges rouges, posées sur le sureau |

Règles du tour 8 (5.2) inchangées; une cueillette a désormais une plage de jours de saison facultative (`days: [1, 14]`): hors de la plage, elle est hors saison (elle s'en va la nuit, sans message). Simulation (partie 4), par semaine d'automne pour un duo médian: 7 noisettes, 8 girolles, 2,3 cèpes, 5,8 grappes de sureau (les deux premières semaines); premier cèpe au jour 46 en médiane, 97 % des graines en ont un avant le jour 50.

Objets (`objets.json`): `cep` (« cèpe », pluriel « cèpes », « un cèpe », catégorie `forage`, 15 sous); `elderberry` (« grappe de sureau », « grappes de sureau », « une grappe de sureau », `forage`, 4 sous); sons `pick-mushroom` et `pick-berries` (déjà livrés). Commande générée: deux produits nouveaux, famille lisière, ressource cueillette (`cep`: minimum 2, saison A, `obtained` `picked:cep`, `leadDays` 2, conseil « Les cèpes sortent sous les chênes, au lendemain des pluies. »; `elderberry`: minimum 4, saison A, conseil « Le sureau ne donne que deux semaines: profitez-en. »). Astuce `forage_hint` inchangée.

### 3.5 Répliques

Ajouts par habitant: 2 de fin d'été (été, à partir du 15e jour de la saison: les derniers jours de l'été étaient les plus pauvres), 1 du lendemain de l'étape (automne à partir du 2e jour, priorité 6, `once: player`), 10 d'automne, 1 de pluie d'automne (priorité 5, règle des répliques datées), 1 souhait (priorité 3, `once: player`), 1 après le cadeau (priorité 3, `once: player`, condition `given`). Plus 12 réactions aux chantiers (priorité 3, `once: player`, condition `flag <chantier>_built`). Les adultes vouvoient, Jeanne tutoie. Toutes en priorité 1 sauf mention.

Firmin:

| `id` | Condition | Texte |
|---|---|---|
| `firmin_ls9_1` | été, jour de saison 15 et plus | L'été tire à sa fin. Les rails chauffent moins, ils craquent moins. Ces craquements vont me manquer. |
| `firmin_ls9_2` | idem | Encore une semaine ou deux, et je ressortirai la veste. Je l'ai brossée; elle n'y croit pas encore. |
| `firmin_autumn1` | automne, jour de saison 2 et plus, priorité 6, une fois | L'automne, déjà. Vous restez ? Tant mieux. La halte est plus grande quand il y a du monde dedans. |
| `firmin_au1` | automne | L'automne, le quai se couvre de feuilles venues de la lisière. Elles prennent le train sans billet. Je ferme les yeux. |
| `firmin_au2` | automne | Les jours raccourcissent. J'allume la lanterne plus tôt et je l'éteins plus tard. Au total, elle travaille autant. |
| `firmin_au3` | automne | En automne, Émile graissait l'aiguillage de la voie de garage avant les gelées. Je le fais encore. Il ne sert jamais, mais il est prêt. |
| `firmin_au4` | automne | Le samedi matin, le train arrive avec ses vitres embuées. Le mécanicien y dessine un soleil. Il dit que ça aide. |
| `firmin_au5` | automne | À l'automne, la cloche du quai sonne plus clair. C'est l'air froid, dit Basile. Moi, je crois qu'elle est contente qu'on rentre. |
| `firmin_au6` | automne | Je compte les feuilles sur le quai, puis je les balaie. Ça fait deux métiers pour le prix d'un. |
| `firmin_au7` | automne | Ma mère disait qu'un automne sec fait un hiver long. Elle disait aussi l'inverse, selon les années. |
| `firmin_au8` | automne | Avec le froid, le sifflet porte plus loin. Samedi dernier, on a entendu le train avant de le voir. Même Odette, qui n'entend rien avant midi. |
| `firmin_au9` | automne | Les truites sont revenues dans l'Aubrune. L'été, elles se cachent au fond; à l'automne, elles ont faim. Moi aussi. |
| `firmin_au10` | automne | La voie des Vergers dort sous les feuilles. Un jour, on la dégagera. Aujourd'hui, je la regarde dormir. |
| `firmin_rain_au` | automne, pluie, priorité 5 | Pluie d'automne: la plus têtue. Elle ne tombe pas, elle s'installe. |
| `firmin_wish` | jour 43 et plus, priorité 3, une fois | Les soirs fraîchissent sur le quai. Émile avait une écharpe de laine. Je ne sais pas où elle est passée. |
| `firmin_after_gift` | `given firmin wool_scarf`, priorité 3, une fois | Je porte l'écharpe tous les soirs. Odette dit qu'elle me va. Je fais semblant de ne pas l'avoir entendue. |

Odette:

| `id` | Condition | Texte |
|---|---|---|
| `odette_ls9_1` | été, jour de saison 15 et plus | Fin d'été: les mûres se font rares et les guêpes nombreuses. Prenez les premières, laissez les secondes. |
| `odette_ls9_2` | idem | J'ai rangé les chapeaux de paille. Sauf un. On ne sait jamais. |
| `odette_autumn1` | automne, jour de saison 2 et plus, priorité 6, une fois | Vous voilà pour l'automne ! Je vous préviens: ici, on parle de confitures jusqu'à la neige. |
| `odette_au1` | automne | Les bocaux de l'automne prennent toute l'étagère. Je les compte le soir, comme d'autres comptent leurs sous. |
| `odette_au2` | automne | La gelée de sureau, c'est noir comme de l'encre et doux comme un dimanche. |
| `odette_au3` | automne | Le soir tombe tôt. J'allume la lampe du comptoir à sept heures, et le bourg vient voir ce qui brille. |
| `odette_au4` | automne | Les cèpes, on les coupe au couteau, on ne les arrache pas. Sinon, le bois vous en veut. |
| `odette_au5` | automne | À l'automne, on m'achète moins de fleurs et plus de soupe. Je vends les deux, et je mange le reste. |
| `odette_au6` | automne | Ma tonnelle perd ses feuilles. Elle a l'air d'un parapluie retourné. Je l'aime bien comme ça aussi. |
| `odette_au7` | automne | Jeanne est rentrée de l'école avec de l'encre jusqu'aux coudes. Elle dit que c'est une carte de la vallée. |
| `odette_au8` | automne | Les noisettes, je les grille à la poêle. Ça sent jusqu'au quai, et Firmin arrive comme par hasard. |
| `odette_au9` | automne | Quand il pleut à l'automne, la pension sent le bois mouillé et la confiture. Si vous connaissez une meilleure odeur, dites-la-moi. |
| `odette_au10` | automne | Les jours raccourcissent, alors je parle plus vite. C'est une question d'organisation. |
| `odette_rain_au` | automne, pluie, priorité 5 | Pluie d'automne. Le comptoir est plein de parapluies qui attendent leur propriétaire. Ils attendent bien, les parapluies. |
| `odette_wish` | jour 22 et plus, priorité 3, une fois | Mon moulin à café grince comme la porte de Basile. Le catalogue de la coopérative en vend des neufs, paraît-il. |
| `odette_after_gift` | `given odette coffee_mill`, priorité 3, une fois | Mon moulin neuf ronronne comme un chat. Enfin, j'imagine: il n'y a pas de chat au bourg. |

Basile:

| `id` | Condition | Texte |
|---|---|---|
| `basile_ls9_1` | été, jour de saison 15 et plus | Fin d'été. Le bois a bien séché. Les planches de la semaine seront droites, je le sens. |
| `basile_ls9_2` | idem | Les jours raccourcissent déjà. Je scie plus tôt, je m'assois plus tôt. Le reste ne change pas. |
| `basile_autumn1` | automne, jour de saison 2 et plus, priorité 6, une fois | Vous restez pour l'automne. Bien. Le bois aussi reste. On sera trois. |
| `basile_au1` | automne | L'automne, je rentre le bois. Une bûche rangée, c'est une soirée au chaud qu'on a mise de côté. |
| `basile_au2` | automne | Le bois coupé à l'automne sèche mieux. Il a moins de sève et plus de patience. |
| `basile_au3` | automne | Les feuilles de chêne tiennent longtemps. Elles restent jusqu'à ce qu'on les pousse. Comme moi. |
| `basile_au4` | automne | Les rejets de l'été ont pris de l'avance. L'an prochain, vous ne les reconnaîtrez pas. |
| `basile_au5` | automne | Le soir, j'aiguise mes outils dans la cour. Le bruit de la pierre, c'est ma musique d'automne. |
| `basile_au6` | automne | Un cèpe sous un chêne, c'est le chêne qui dit merci. On l'a laissé tranquille assez longtemps. |
| `basile_au7` | automne | Jeanne m'a demandé pourquoi les arbres perdent leurs feuilles. J'ai dit: pour avoir de la place. Elle a eu l'air de comprendre. Moi pas. |
| `basile_au8` | automne | Pour le poêle, il faut du chêne. Le sapin flambe et s'en va. Le chêne reste. |
| `basile_au9` | automne | La scierie est froide le matin. Je la réveille en faisant tourner la lame à vide. Elle grogne, puis elle se met au travail. |
| `basile_au10` | automne | L'automne, le bois parle. Il craque, il se tend, il se plaint. Je l'écoute. Je ne réponds pas. |
| `basile_rain_au` | automne, pluie, priorité 5 | La pluie d'automne sur le toit de la scierie est plus lourde que celle d'été. On l'entend réfléchir. |
| `basile_wish` | jour 29 et plus, priorité 3, une fois | Mon tablier est plus troué qu'une passoire. Je ne le dirai pas deux fois. |
| `basile_after_gift` | `given basile leather_apron`, priorité 3, une fois | Le tablier est solide. Il durera plus que moi. Il ne le sait pas encore. |

Jeanne:

| `id` | Condition | Texte |
|---|---|---|
| `jeanne_ls9_1` | été, jour de saison 15 et plus | L'école revient bientôt. Je fais comme si je ne savais pas. Ça marche à moitié. |
| `jeanne_ls9_2` | idem | J'ai compté les jours de vacances qui restent. Je ne les dépense pas tous à la fois. |
| `jeanne_autumn1` | automne, jour de saison 2 et plus, priorité 6, une fois | Tu restes pour l'automne ? Tant mieux. Moi, je reste pour l'école. C'est moins drôle, mais c'est obligatoire. |
| `jeanne_au1` | automne | C'est la rentrée ! La voix de la maîtresse monte quand elle est contente. Aujourd'hui, elle est montée deux fois. |
| `jeanne_au2` | automne | À l'école, on apprend les rivières. L'Aubrune n'est pas dans le livre. Je l'ai ajoutée au crayon. |
| `jeanne_au3` | automne | J'ai ramassé une feuille rouge, une jaune et une marron. La marron, personne n'en veut. Je l'ai gardée exprès. |
| `jeanne_au4` | automne | Le mercredi, il n'y a pas école. C'est le meilleur jour, parce que les autres jours, il y a école. |
| `jeanne_au5` | automne | Les noisettes, il faut les ouvrir avec un galet. Avec les dents, c'est Odette qui crie. |
| `jeanne_au6` | automne | Le soir, il fait nuit avant le souper. Ça fait un souper de nuit. C'est plus mystérieux. |
| `jeanne_au7` | automne | Ma tante Lucie m'a envoyé une carte avec une montagne dessus. Je l'ai accrochée à l'envers. Comme ça, c'est une vallée. |
| `jeanne_au8` | automne | J'ai un cartable neuf. Il sent le cuir et la peur de la rentrée. La peur est partie, le cuir est resté. |
| `jeanne_au9` | automne | Quand il pleut, je saute dans les flaques avec mes bottes d'école. Ça les prépare. |
| `jeanne_au10` | automne | La maîtresse dit que les feuilles tombent pour nourrir la terre. Alors je les laisse tomber. Je ne ramasse que les belles. |
| `jeanne_rain_au` | automne, pluie, priorité 5 | Il pleut. À l'école, j'ai compté les gouttes sur la vitre. J'en suis à beaucoup. |
| `jeanne_wish` | jour 16 et plus, priorité 3, une fois | Si j'avais des craies de couleur, je dessinerais une marelle sur la place. La pluie l'effacerait, et je recommencerais. |
| `jeanne_after_gift` | `given jeanne chalk_box`, priorité 3, une fois | La marelle est sur la place ! Le premier carré, c'est la terre. Le dernier, c'est le ciel. Entre les deux, il faut sauter. |

Réactions aux chantiers (priorité 3, `once: player`, `flag <id>_built`):

| Chantier | Habitant | Texte |
|---|---|---|
| `ford_bench` | Firmin | Un banc au gué ! Maintenant, le héron a des spectateurs assis. Il va faire son fier. |
| `ford_bench` | Basile | Le banc du gué est en chêne de la lisière. Il fait un meilleur banc qu'un arbre: il ne perd plus ses feuilles. |
| `quay_planters` | Odette | Les jardinières du quai ! Je les arroserai quand il ne pleut pas. Donc pas si souvent. |
| `quay_planters` | Firmin | Des fleurs sur mon quai. Samedi, le mécanicien les a regardées en passant. Enfin, je crois. |
| `well_roof` | Jeanne | Le puits a un chapeau ! Maintenant, quand il pleut, je joue dessous. |
| `well_roof` | Odette | Plus de feuilles dans l'eau du puits. Mon thé vous remercie. |
| `path_lamp` | Basile | De ma cour, je vois le réverbère de votre chemin. Ça me fait un voisin de plus. |
| `path_lamp` | Firmin | Le soir, on voit la maisonnette depuis le quai. Comme du temps d'Émile. |
| `house_bench` | Basile | Votre banc est en chêne. Il tiendra plus longtemps que nous trois. |
| `house_bench` | Odette | Un banc devant chez vous ! Au bourg, c'est ce qui fait d'une maison une maison. |
| `door_canopy` | Firmin | Avec cet auvent, la pluie restera dehors. C'est sa place. |
| `door_canopy` | Jeanne | Sous ton auvent, on entend la pluie sans la recevoir. C'est le meilleur des deux. |

Confrontées au monde: l'aiguillage existe (voie de garage, tour 5); le bourg n'a pas de chat; la vigne de la tonnelle est caduque (tour 8); le banc du gué n'empiète pas sur la clôture de la rive; Basile voit le chemin de la maisonnette depuis sa cour, de l'autre côté de la voie, à 16 m; aucune réplique ne dévoile un moment (la dame blanche n'est citée que par la confidence) ni la marelle avant le cadeau. Les mots « contente », « prêt » qualifient la cloche et l'aiguillage, jamais un joueur.

Simulation (partie 7, 200 graines, redites à moins de 28 jours):

| Réserve | Médian, jours 16 à 43 | Médian, 44 à 64 | Assidu, 16 à 43 | Assidu, 44 à 64 |
|---|---|---|---|---|
| sans les ajouts du tour 9 | 0 % | 0 % | 0 à 0,1 % | 36,7 à 49,4 % |
| avec les ajouts | 0 % | 0 % | 0 % | 0 % |

### 3.6 Envies d'automne

| `id` | Sorte | Disponible | Texte | Réalisée quand |
|---|---|---|---|---|
| `autumn_hazelnuts` | personnelle | automne | Ramasser des noisettes sous les noisetiers. | `picked hazelnut`, 1, `actor` |
| `find_cep` | personnelle | automne, `weather_was rain` | Trouver un cèpe au pied des chênes. | `picked cep`, 1 |
| `elder_berries` | personnelle | automne, jours 1 à 12 | Cueillir des baies de sureau avant qu'il soit trop tard. | `picked elderberry`, 1 |
| `autumn_trout` | personnelle | automne | Pêcher une truite d'automne. | `caught trout`, 1 |
| `dusk_on_quay` | personnelle | automne | Regarder la nuit tomber depuis le banc du quai. | `stayed_at quay_bench` 10 s, `seated`, `time_is` 19 h à 20 h 30 |
| `wood_for_winter` | personnelle | automne, un arbre adulte | Abattre un arbre pour l'hiver. | `chopped`, 1, `actor` |
| `jeanne_after_school` | personnelle | automne, jours d'école | Attendre Jeanne à la sortie de l'école, sur la place. | `talked_to jeanne`, `time_is` 16 h 30 à 18 h 30 |
| `warm_soup` | personnelle | automne, recette de la soupe connue | Manger une soupe chaude un soir d'automne. | `ate vegetable_soup`, `time_is` 18 h à 24 h |
| `rain_indoors` | personnelle | automne, pluie | Écouter la pluie depuis la maisonnette. | `stayed_at house_spawn` 20 s |
| `fallen_leaves` | personnelle | automne, jour de saison 8 et plus | Faire un tour à la lisière quand les feuilles tombent. | `stayed_at forage_edge_03` 5 s |
| `ford_bench_sit` | personnelle | `flag ford_bench_built` | S'asseoir sur le banc neuf du gué. | `stayed_at ford_bench` 10 s, `seated` |
| `lamp_walk_home` | personnelle | `flag path_lamp_built` | Rentrer à la maisonnette à la lueur du réverbère. | `stayed_at path_lamp` 3 s, `time_is` 19 h 30 à 23 h 30 |
| `hazelnuts_together` | à deux | automne | Ramasser des noisettes à deux. | `picked hazelnut`, `both` |
| `dusk_together` | à deux | automne | Regarder la nuit tomber à deux, sur le banc du quai. | `stayed_at quay_bench` 10 s, `seated`, `both`, `time_is` 19 h à 20 h 30 |
| `morning_bench` | à deux | `flag house_bench_built` | S'asseoir à deux sur le banc du pignon, le matin. | `stayed_at house_bench` 10 s, `seated`, `both`, `time_is` 6 h 30 à 10 h |

Points nouveaux pour les envies: `ford_bench`, `house_bench` (bancs, `benches`), `path_lamp` (point au pied du réverbère). Le banc du quai a deux places: `dusk_together` y tient. Simulation (partie 8): 58 % d'envies jamais reçues en automne (30 % visés), au moins 24 envies possibles chaque matin d'automne, aucune envie à deux forcée à se redire.

### 3.7 La commande en automne et au jour 64

Rien de nouveau dans la règle: produits de saison (règle « 4 jours sur 6 »), cèpe et sureau ajoutés, truite au coût d'automne (0,222: elle redevient une ligne facile), poules comptées. La commande du 64, tirée le 57, est une commande d'automne (jours 58 à 63); elle est payée au départ du train du 64, puis l'écran d'étape s'ouvre. Le sureau n'entre dans une commande que si ses jours couvrent au moins 4 des 6 jours de production: commandes des samedis 50 (jours 44 à 49) et 57 (jours 51 à 56), jamais celle du 64.

### 3.8 État borné

| Champ nouveau | Contenu | Borne | Octets (estimation) |
|---|---|---|---|
| `board` | annonce en cours (gabarit, variante, jour, échéance, état), précédente, 4 derniers gabarits avec leur jour | fixe | 230 |
| `improvements` | par chantier: versé, bâti (jour) | 6 chantiers | 190 |
| `catalogue.bought` | identifiant et nombre | articles du catalogue (15) | 260 |
| `characters[].tools` | aucun champ: l'outil est un objet du sac | | 0 |
| `animals` | deux poules de plus | `hens.max` | 180 |
| drapeaux | cadeaux offerts, chantiers bâtis | 10 | 120 |
| `heard` | répliques nouvelles entendues | 76 répliques par joueur, au plus | 3 650 |

Le reste est déjà borné (tour 8 et correctif `565439e`): envies, lettres (3 lettres de plus, uniques), commande, sol rangé chaque nuit. Le point faible reste `heard`: une entrée par réplique et par joueur, bornée par le contenu et non par le temps; chaque tour d'écriture l'augmente (environ +3,6 Ko ici). Proposition à l'architecte (question 2): au-delà de 28 jours, ne garder qu'un ensemble de répliques déjà entendues (un bit par réplique, environ 40 octets par joueur pour 300 répliques), toutes à égalité pour le tirage « la moins récente ». La règle R2 ne regarde que les 28 derniers jours: rien ne change pour elle; seul l'ordre entre de vieilles répliques se perd, sans effet mesurable. Bornes proposées pour I-06 et I-11: état sous 52 000 octets à chaque aube jusqu'au jour 84, au plus 4 096 octets de plus au jour 84 qu'au jour 64 (au lieu de 48 000 et du jour 43, puisque le contenu du tour 9 ajoute environ 4,6 Ko); si la proposition sur `heard` est retenue, revenir à 48 000.

## 4. Les moments: deux d'été, deux d'automne

### 4.1 Les étoiles de l'Aubrune (`falling_stars`, été, fiche du tour 7)

Production complète de la fiche 1.4.10 du tour 7, sans changement de chorégraphie ni de texte. Rappel de ce qu'il faut livrer:

| Métier | À livrer |
|---|---|
| Dev gameplay | entrée `moments.json` (table 1.6 du tour 7: P0, ambiance, ancre `stars_water`, poids 2, `maxPerSeason` 2, été, soleil, jour 22 et plus, présence 22 h à 24 h, fenêtre 22 h à 23 h 30, `watch` rayon 3, assis sur `pontoon_edge`, 3 s); siège sans modèle `pontoon_edge` à deux places (`benches`, cap 180, assise au bord du plancher à 0,5 m); confidence de Basile; récompense Cœur +10 chacun; texte d'apogée à la fin du spectacle |
| Level designer | points `stars_water` (45,0 ; 40,6), `pontoon_seat_west` (44,55 ; 39,80) et `pontoon_seat_east` (45,45 ; 39,80) par `construire_carte_halte.py` |
| Tech-artist et dev rendu | reflet de 40 étoiles sur l'eau calme (x 41,5 à 48,5, y 40,5 à 42,8), points de 2 à 4 px qui tremblent avec les rides; une étoile filante toutes les 15 à 25 s pendant l'attente; cinq traînées de l'apogée (table du tour 7), la grosse éclaire l'eau 1 s (sprite additif); un appel de dessin (même programme que les vers luisants) |
| Artiste 3D | clips `sit_edge` (assis au bord, jambes qui se balancent, boucle de 4 s) et `look_up` (1,5 s) sur le squelette commun |
| Sound-designer | `star_chime` (célesta, gamme pentatonique, 1,5 s, 5 variantes dans l'ordre, bus musique), `night_water` (clapotis contre les pieux, boucle de 6 s, audible à 12 m); musique de la nuit à -9 dB pendant l'apogée (`starsMusicDuckDb`) |
| Textes | déjà écrits (tour 7, 1.7): `moment_falling_stars_hint`, `_climax`, `_memory`, `_rumor`, `moment_seat_edge` |

Vérification de cohérence faite pour ce tour: le réverbère du chemin (2.6) est à 31 m du ponton, à l'ouest; rien de nouveau n'éclaire l'eau du ponton. Les étoiles et les vers luisants partagent les nuits d'été claires: un seul moment par jour, rien à changer.

### 4.2 Le salut du mécanicien (`train_salute`, jours du train, fiche du tour 7)

Production complète de la fiche 1.4.12 du tour 7. Réglage `train.saluteSlowRoll`: `true` (départ au pas de 20 s les jours du salut); à `false`, le salut reste jouable avec le départ ordinaire de 6 s (le mécanicien salue au passage, sans ralentir). Fenêtre propre `cooldownDays` 14: un samedi sur deux au plus.

| Métier | À livrer |
|---|---|
| Dev gameplay | entrée `moments.json` (P0, `trainDays: "only"`, ancre `level_crossing`, poids 1, jour 22 et plus, présence 15 h à 16 h 30, fenêtre d'armement 15 h 20 à 16 h, `watch.hold` sur les deux manivelles 1 s, `arm` 2,5 s, apogée à 16 h, verrou); cases de la traversée (x 17 à 19, y 12 à 14) infranchissables de l'armement à la remontée des lisses, joueur poussé vers la case libre la plus proche côté quai; départ du train qui suit la piste du mécanicien (`x - 44,5`); sans armement à 16 h: départ ordinaire, moment `left` sans texte |
| Level designer | points `gate_north_crank` (15,6 ; 11,5, cap 90) et `gate_south_crank` (21,4 ; 15,5, cap 270); accroches `level_crossing_crank_n` et `_s` sur les poteaux, à 1,0 m, du côté de la place |
| Artiste 3D | `rail_crew_driver` et `rail_crew_stoker` (bustes à la fenêtre de la cabine), `level_crossing_crank` (volant de 0,30 m à rayons, nœud animé); clips `crank_hold`, `crank_turn`, `wave_back` (joueurs), `driver_wave`, `driver_lean` (équipage) |
| Tech-artist et dev rendu | vapeur des purgeurs au ras du ballast; découpe du rendu pour le joueur de la manivelle nord, derrière le train pendant son passage |
| Sound-designer | `gate_crank` (2 variantes), `gate_lock`, `train_slow_roll`, `train_whistle_salute`, `cylinder_cocks` |
| Textes | déjà écrits (tour 7, 1.7), sauf la confidence, ajustée ci-dessous |

Ajustement de la confidence (`moment_train_salute_hint`), parce que la caisse du quai ferme aussi à 16 h: « Firmin te l'a dit hier: « Samedi, une fois la caisse remplie, baissez les barrières à la main pour le départ de quatre heures, une de chaque côté de la voie. Le mécanicien salue toujours les gardes-barrières. » » Raison: depuis le tour 8, la commande se dépose jusqu'à 16 h; sans ce rappel, un duo qui arme les barrières à 15 h 20 découvrirait à 16 h que la caisse n'était pas pleine.

### 4.3 La dame blanche (`barn_owl`, automne, nouveau)

**Raison d'être.** L'effraie des clochers niche dans les granges et les greniers; à la Halte, dans la remise de la draisine (57,0 ; 6,5). À l'automne, la nuit tombe vers 19 h 30, quand on est encore dehors: on la voit chasser au ras du pré de l'est, sans un bruit (son vol est silencieux, c'est vrai et c'est le spectacle). Elle fait du surplace, plonge dans l'herbe haute, se pose sur le rocher du pré avec sa proie, et tourne la tête vers vous: sa face en cœur, blanche, se lit de loin.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 44 et plus; automne; soleil ou nuages (elle ne chasse pas sous la pluie); poids 2; confidence de Jeanne (`hintFrom: jeanne`) |
| Présence | 18 h 45 à 20 h 30; fenêtre de l'apogée 19 h à 20 h 15 |
| Ancre | `roe_deer_graze` (58,0 ; 27,0): l'herbe rase du pré, déjà vérifiée pour la chevrette (rien de haut au sud-est); la chevrette est un moment de printemps et d'été, à l'aube: aucun conflit |
| Attente | l'effraie quadrille le pré à 2,5 à 3 m, en boucles lentes autour de l'ancre (rayon 3 m), un cri (`owl_screech`) toutes les 20 à 30 s; elle ne se pose jamais pendant l'attente |
| Ce que font les deux | **côte à côte**: à moins de 1,8 m l'un de l'autre, immobiles, entre 3 et 5,5 m de l'ancre, pendant 3 s (`watch`: rayon 5,5, `minRadius` 3, `still`, `closeTogether` 1,8, `holdSeconds` 3) |
| Départ sans apogée | à 20 h 30, elle file au nord vers la remise |

Champ nouveau `watch.closeTogether` (m): la distance entre les deux joueurs ne dépasse pas cette valeur. Ligne du HUD tant qu'elle manque: `moment_side_by_side` « Mets-toi tout près de {partner} et ne bouge plus. »

Apogée (16 s), images clés `[t, x, y, z, clip]` (les mêmes que `OWL_TRACK` du script):

| t (s) | x ; y ; z | Clip | Ce qui se voit et s'entend |
|---|---|---|---|
| 0,0 | 61,0 ; 22,5 ; 3,2 | `owl_glide` | elle arrive de la haie du nord-est, ailes ouvertes, sans un bruit |
| 1,6 | 59,6 ; 24,8 ; 2,6 | `owl_glide` | |
| 3,0 à 5,6 | 58,3 ; 26,8 à 26,9 ; 2,2 | `owl_hover` | surplace au-dessus du pré, tête baissée (2,6 s) |
| 6,2 | 58,6 ; 27,6 ; 0,1 | `owl_strike` | plongeon, serres en avant; froissement d'herbe (`grass_strike`) |
| 6,2 à 7,8 | 58,6 ; 27,6 ; 0,1 | `owl_mantle` | ailes en manteau sur l'herbe haute |
| 8,6 | 57,4 ; 27,6 ; 0,9 | `owl_flap` | elle se relève, un campagnol au bec |
| 9,2 à 12,4 | 56,6 ; 27,5 ; 0,8 | `owl_land`, `owl_look` | posée sur le rocher `rock_02` (0,8 m), elle tourne la tête vers les joueurs à 10,0 s (face en cœur) |
| 13,4 | 56,0 ; 25,6 ; 2,0 | `owl_flap` | elle repart, un cri (`owl_screech`) |
| 14,6 | 56,4 ; 22,4 ; 3,6 | `owl_glide` | |
| 16,0 | 56,8 ; 19,6 ; 7,4 | `owl_glide` | au-dessus du toit de la halte (7 m), vers la remise; fondu sur la dernière seconde |

Contrôles (partie 10, carte jouée): M-02 10,6 s au pire depuis l'anneau (3,4 s visés); dans le cadre 6,7 s au pire au zoom 0 et 13,6 s au zoom 1; cachée 2 % du temps en orientation 0 (le toit de la halte, au départ), 2 %, 39 % et 14 % dans les trois autres. État `after`: aucun (elle est partie). Taille: 0,35 m de haut, 0,9 m d'envergure; blanche et chamois, face blanche en cœur: lisible au zoom de départ (20 px de haut) parce qu'elle est claire sur l'herbe sombre du soir. Récompense: Cœur +10 chacun.

Textes:

| Clé | Texte |
|---|---|
| `moment_barn_owl_hint` | Jeanne te l'a dit hier: « Le soir, une chouette toute blanche chasse au-dessus du pré de l'est. Si vous restez côte à côte sans bouger, elle vous prend pour un buisson. » |
| `moment_barn_owl_climax` | Une chouette blanche glisse sans un bruit au-dessus du pré, fait du surplace, plonge dans l'herbe. Posée sur le rocher, une proie au bec, elle tourne vers vous sa face en cœur. Puis elle repart vers la remise. |
| `moment_barn_owl_memory` | La dame blanche du pré de l'est, un {weekday} soir. |
| `moment_barn_owl_rumor` | qu'une chouette blanche chasse au-dessus du pré de l'est, les soirs d'automne. |
| `moment_side_by_side` | Mets-toi tout près de {partner} et ne bouge plus. |

Relu contre la chorégraphie (M-06): glisse (0 à 1,6 s), surplace (3 à 5,6), plonge (6,2), posée sur le rocher avec la proie (9,2), tourne la tête (10,0), repart vers le nord (13,4 à 16). « Sans un bruit » est vrai: aucun son de vol.

Modèle (artiste 3D): `barn_owl`, sur un squelette d'oiseau à ailes (comme le héron), clips `owl_glide`, `owl_hover` (battements rapides, corps fixe), `owl_strike`, `owl_mantle`, `owl_flap`, `owl_land`, `owl_look` (rotation de la tête de 120°), plus un campagnol `vole` de 0,08 m porté au bec (`carried_by_barn_owl`). Sons: `owl_screech` (cri rauque et soufflé de l'effraie, 1,2 s, 3 variantes, audible à 25 m), `grass_strike` (0,4 s), `owl_far` (le même cri, lointain, pour l'ambiance des soirs sans le moment).

### 4.4 Les lanternes du quai (`quay_lanterns`, automne, nouveau)

**Raison d'être.** Du temps d'Émile, la Halte allumait à la même seconde la lanterne du quai et celle de la place: de là-haut, aux Vergers, on voyait la Halte s'éveiller d'un coup. À l'automne, la nuit tombe à 19 h 30, à l'heure où l'on est encore dehors: Firmin propose au duo de reprendre la coutume. Les deux lanternes sont à 14 m l'une de l'autre, de part et d'autre de la pension: **on ne se voit pas** (13,4 m d'écart à l'écran, plus que la demi-largeur du cadre aux zooms 0 et 1). Il faut se parler pour allumer ensemble: « Trois, deux, un... maintenant ! »

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 44 et plus; automne (et l'hiver, plus tard); soleil ou nuages; poids 2; confidence de Firmin (`hintFrom: firmin`); jamais un jour du train (règle générale) |
| Présence | 18 h 45 à 20 h; fenêtre 19 h à 19 h 45 |
| Places | `lantern_quay` (48,5 ; 18,5), à l'est de la lanterne `lamp_quay_east`, tournée vers l'ouest (cap 270); `lantern_square` (35,5 ; 24,5), à l'est du lampadaire `lamp_square_north`, tournée vers l'ouest (cap 270). Cases libres, quai et pavés (partie 10) |
| Geste | Espace à moins de 1,2 m d'une place: le personnage lève la perche (`pole_raise`, 0,6 s) et allume |
| Ensemble | les deux allumages à moins de 0,8 s l'un de l'autre (`watch.syncPress`: places, `gapSeconds` 0,8) déclenchent l'apogée |
| Pas ensemble | la flamme allumée seule vacille et s'éteint au bout de 0,8 s (`lantern_out`); ligne `moment_lantern_alone` chez celui qui a allumé; on recommence autant qu'on veut, rien ne se perd |
| Avant l'apogée | ces jours-là, les lampadaires du bourg restent éteints jusqu'à l'apogée ou 19 h 45 |
| Départ sans apogée | à 19 h 45, Firmin allume lui-même (tous les lampadaires s'allument comme les autres soirs), sans texte |

Champ nouveau `watch.syncPress`: `{ "places": [...], "gapSeconds": 0.8 }`. Pourquoi 0,8 s et pas 0,5 (`maxSyncGapSeconds`): un compte à voix haute, dans la même pièce, se tient à quelques dixièmes près; 0,5 s ferait rater un duo qui compte bien.

Apogée (12 s):

| t (s) | Ce qui se voit et s'entend |
|---|---|
| 0,0 | les deux lanternes s'allument (flamme qui grandit en 0,6 s, halo), `lantern_light` à chaque lanterne |
| 1,5 | `lamp_square_east` (47,5 ; 24,5) s'allume (vu par les deux: à 6 m du quai, à 12 m de la place) |
| 2,5 | `lamp_quay_west` (22,5 ; 18,5) |
| 3,5 | `lamp_level_crossing` (20,5 ; 20,5) |
| 4,5 | `lamp_square_south` (47,5 ; 32,5) |
| 6,0 | Firmin, à la cloche du quai (`quay_bell`), sonne une fois (`quay_bell_once`), audible des deux places |
| 6,5 à 12,0 | les fenêtres du bourg s'allument une à une (halte, pension, maison de Firmin, scierie, maisonnette), musique `halte-evening` en douceur (P1: le thème de la Halte au celesta) |

Contrôles (partie 10): M-02 et cadre 12 s depuis chaque place (la flamme est à 1 m); flamme du quai visible dans les quatre orientations; flamme de la place cachée par la pension en orientation 1 (sud-ouest) seulement, visible dans les trois autres. Les lanternes de l'ouest du quai sont cachées par la pension en orientation 0: c'est pourquoi les places sont à l'est. Récompense: Cœur +10 chacun.

Textes:

| Clé | Texte |
|---|---|
| `moment_quay_lanterns_hint` | Firmin te l'a dit hier: « Du temps d'Émile, on allumait la lanterne du quai et celle de la place à la même seconde. De là-haut, aux Vergers, on voyait la Halte s'éveiller d'un coup. Demain soir, je vous les laisse, si le cœur vous en dit. » |
| `moment_quay_lanterns_climax` | Les deux lanternes s'allument au même instant. Autour de vous, les lampadaires prennent le relais un à un, et la cloche du quai sonne une fois: la Halte veille. |
| `moment_quay_lanterns_memory` | Les lanternes du quai et de la place, allumées ensemble un {weekday} soir. |
| `moment_quay_lanterns_rumor` | qu'autrefois, on allumait les lanternes de la Halte d'un seul coup. |
| `moment_lantern_take` | Lève la perche et allume ({act}), au même instant que {partner}. |
| `moment_lantern_alone` | Ta flamme vacille et s'éteint: il faut allumer au même instant que {partner}. Comptez ensemble. |
| `moment_lantern_where_square` | L'autre lanterne est celle de la place, au nord, près de l'épicerie. |
| `moment_lantern_where_quay` | L'autre lanterne est au bout est du quai. |

Les lignes `where` s'affichent chez celui qui est à une place pendant que l'autre n'est à aucune (une fois par moment). Relu contre la chorégraphie: deux lanternes au même instant, les lampadaires « autour de vous » (chacun voit ceux de son côté), la cloche (entendue par les deux).

Modèles (artiste 3D): perche d'allumeur `lamp_pole` (2,2 m, crochet et mèche), portée en main (`socket_hand_r`); flamme et halo par le tech-artist (même programme que les lampadaires allumés). Clips: `pole_raise` (0,6 s), `pole_lower` (0,5 s). Sons: `lantern_light` (chuintement de mèche et souffle, 0,6 s), `lantern_out` (flamme soufflée, 0,4 s), `quay_bell_once` (un coup de la cloche du quai, existant raccourci), `halte-evening` (P1).

### 4.5 Données et réglages

| id | tier | mode | anchor | weight | cooldownDays | maxPerSeason | availableWhen | present | window | watch |
|---|---|---|---|---|---|---|---|---|---|---|
| `falling_stars` | P0 | ambient | `stars_water` | 2 | | 2 | jour ≥ 22; été; soleil | 22:00 à 24:00 | 22:00 à 23:30 | tour 7 |
| `train_salute` | P0 | ambient, `trainDays: "only"` | `level_crossing` | 1 | 14 | | jour ≥ 22; pas de neige | 15:00 à 16:30 | 15:20 à 16:00 | tour 7 |
| `barn_owl` | P0 | ambient | `roe_deer_graze` | 2 | | | jour ≥ 44; automne; soleil ou nuages | 18:45 à 20:30 | 19:00 à 20:15 | rayon 5,5, min 3, `still`, `closeTogether` 1,8, 3 s |
| `quay_lanterns` | P0 | ambient | `lantern_square` | 2 | | 2 | jour ≥ 44; automne ou hiver; soleil ou nuages | 18:45 à 20:00 | 19:00 à 19:45 | `syncPress` (`lantern_quay`, `lantern_square`), 0,8 s |

Réglages des moments, à partir du jour 24 seulement (la démo et ses tirages épinglés ne changent pas, M-23):

| Valeur | Avant | Après | Plage | Raison |
|---|---|---|---|---|
| `longCooldownDays` du héron et du renard (champ nouveau par moment, lu à partir de `longFromDay`) | 10 | 16 | 12 à 21 | les deux moments possibles presque tous les jours de toutes les saisons, au poids 3: ce sont eux qui reviennent trop tôt (réserve 6 de la revue) |
| `seasonPoolFull` | 9 | 7 | 6 à 9 | à 9, l'automne (6 moments) n'a qu'une chance sur trois par jour: 9,7 % des parties y voient moins de deux moments différents; à 7, 2,8 % |

Résultats (partie 9, 2 000 graines, jours 16 à 64):

| Réserve et réglages | Écart médian, été | Écart médian, automne | Au moins 2 moments différents vus, été | Idem, automne | Passages qui redisent un moment de la saison (été, automne) |
|---|---|---|---|---|---|
| tour 8, livrés | 13 j | 19 j | 92,5 % | 57,4 % | 18 %, 11 % |
| tour 9, réglages d'avant | 14 j | 18 j | 99 % | 90,3 % | 19 %, 12 % |
| tour 9, héron et renard à 16 jours seulement | 16 j | 21 j | 99 % | 90,1 % | 15 %, 10 % |
| tour 9, proposés (16 jours et `seasonPoolFull` 7) | 14 j | 19 j | 99,7 % | 97,2 % | 18 %, 14 % |

Les deux réglages tirent en sens contraire: la fenêtre longue espace le héron et le renard, `seasonPoolFull` à 7 donne plus de moments à l'automne, donc un peu plus de retours. Le second compte plus: un duo qui ne voit qu'un moment de tout l'automne manque l'essentiel, un héron revu au bout de 14 jours ne gâche rien.

**Ce que dit O-06, honnêtement.** Dans une saison de 21 jours, un même moment ne peut pas revenir à 19 jours ou plus d'écart s'il passe deux fois: l'écart médian visé (19 jours) se mesure sur plusieurs années, quand les écarts enjambent les saisons. Sur 84 jours, le robot mesure surtout des retours dans la même saison. Proposition à qa-testeur (question 4): garder O-06 à 19 jours pour le robot de cinq années (plan, 4.4); pour le robot de 84 jours, le remplacer par O-06a « écart médian d'au moins 14 jours en été et 18 en automne » et O-06b « au plus 20 % des passages redisent un moment déjà passé dans la saison », plus le plancher de 10 jours après le jour 24, inchangé.

## 5. Lisibilité

### 5.1 Ce qu'on cueille doit se voir (directeur artistique, artiste 3D, dev rendu)

Règle commune à toutes les cueillettes: au zoom de départ (57 px par mètre à 1366 px de large), une cueillette couvre au moins 14 x 14 px à l'écran, se détache de son support par la valeur (contraste de luminance d'au moins 3 pour 1 avec le feuillage ou l'herbe autour), et se lit dans les quatre orientations à 6 m du joueur. Elle est posée là où elle pousse, contre son support, jamais à plus de 0,6 m du pied de son buisson.

| Cueillette | Défaut constaté | Consigne |
|---|---|---|
| Mûres | quelques pixels sur le roncier, même en gros plan (`cueillette-roncier-mures.png`); noir sur vert sombre | trois grappes de 0,12 m sur la face sud du roncier (côté chemin), entre 0,35 et 0,6 m de haut; des mûres noires et quelques rouges pas encore mûres dans chaque grappe (vrai: elles mûrissent en échelonné), le rouge porte le contraste; un point de lumière par grappe; les grappes dépassent un peu du feuillage |
| Noisettes | tas posé à 1,5 m du noisetier, dans l'herbe nue (`cueillette-noisettes.png`) | tas de 6 à 8 noisettes avec leurs collerettes vert pâle, posé sur un disque de feuilles mortes ocre de 0,6 m, sous la couronne du noisetier, à moins de 0,6 m de son pied (points `nut_spots` du noisetier, comme `berry_spots` du roncier); les feuilles ocre font lire « sous un arbre » et portent le contraste avec l'herbe |
| Grappes de sureau | nouvelles | ombelles de baies noires portées par des tiges rouges qui retombent, sur la face sud du sureau `bush_41`, entre 0,6 et 1,1 m de haut; les tiges rouges portent la lecture |
| Cèpes | nouveaux | deux ou trois cèpes serrés, chapeau brun châtaigne, pied clair et ventru (le clair se détache de l'herbe), 0,25 m en tout, au pied d'un chêne côté sud |
| Girolles, ail des ours, pissenlits | déjà lisibles | inchangés |

Preuves demandées: une capture par cueillette au zoom 1 dans les quatre orientations, à 6 m, de jour (8 h) et au soleil couchant (19 h en automne), regardées de près (rien qui flotte ni traverse le buisson), dans `captures/tour-09/cueillette-<id>-<orientation>.png`. Le directeur artistique juge le contraste sur la capture du soir.

### 5.2 Courrier: un titre par lettre (designer UX, dev interface)

Défaut: la liste montre l'expéditeur et la date (`lpl-letter-item`: `from`, `day`); la lettre de commande et le récapitulatif du même samedi s'affichent tous deux « La coopérative de la ligne, Samedi 22 ».

Consignes:

1. Chaque entrée de la liste montre **le titre en premier** (texte principal, une ligne, coupé par des points de suspension s'il dépasse), puis en petit l'expéditeur et le jour (« La coopérative · samedi 22 »). L'état non lu reste marqué (gras et pastille), comme aujourd'hui.
2. Les titres commencent par ce qui les distingue, pour rester lisibles même coupés. Titres changés (`courrier.json`): `coop_order_generated` « Commande pour samedi {day} » (au lieu de « La commande du samedi {day} »); `coop_recap_generated` « Bilan du samedi {day} » (au lieu de « La commande du samedi {day} est partie »). La quête de la semaine garde « La commande du samedi {day} » au carnet. Tests à mettre à jour: `tests/suite-etapes.test.ts` (ligne 174), `tests/suite-commande.test.ts` (lignes 201 et 242), `src/interface/tests/etape.test.ts` (ligne 365).
3. Ordre: la plus récente en haut; la lettre ouverte reste sélectionnée quand une nouvelle arrive.
4. Lecteur d'écran: l'étiquette de l'entrée lit « {titre}, de {expéditeur}, {jour}, non lue ».
5. Lisible à 100 et 150 % sur 1366 x 768: la colonne de la liste garde au moins 26 caractères de titre visibles à 150 % (« Commande pour samedi 22 » en fait 23).

Le même gabarit sert à l'onglet « Annonces » du tableau (titre, puis habitant et échéance).

### 5.3 Carnet: les dernières commandes seulement (dev interface)

Le carnet garde sous « Faites » les deux dernières commandes de la semaine (`weekly_order`) avec leur résultat (« 5 lignes sur 5, 1 137 sous »); les plus anciennes ne s'affichent plus (les totaux restent sur l'écran d'étape et dans `orderTotals`). Même règle pour les annonces: les deux dernières.

## 6. Données et configuration typée

### 6.1 `reglages.json` (ajouts et changements)

```json
{
  "clock": { "lastDay": { "day": 64, "end": "16:00" } },
  "stages": [
    { "id": "demo", "day": 15, "time": "16:00", "texts": "demo" },
    { "id": "summer_end", "day": 43, "time": "16:00", "texts": "summer_end" },
    { "id": "autumn_end", "day": 64, "time": "16:00", "texts": "autumn_end" }
  ],
  "board": {
    "fromDay": 16,
    "post": [{ "weekday": "sunday", "kind": "help" }, { "weekday": "wednesday", "kind": "together" }],
    "postTime": "06:00",
    "deadlineDays": 3,
    "deadlineTime": "20:00",
    "noRepeatDays": 10,
    "weights": { "neverPosted": 2, "sameGiver": 0.3 },
    "reward": {
      "help": { "factor": 1.3, "add": 25, "min": 40, "max": 120, "round": 5 },
      "together": { "factor": 1.3, "add": 45, "min": 60, "max": 150, "round": 5, "heart": 10 }
    },
    "keepDone": 2
  },
  "catalogue": { "pages": "voir catalogue.json", "maxCopies": "par article" },
  "improvements": {
    "queues": { "bourg": { "opensFromDay": 16 }, "maisonnette": { "opensFromDay": 22 } },
    "steps": [50, 100],
    "plankDiscount": 10,
    "plankDiscountMax": 20
  },
  "hens": { "eggsPerHenPerDay": 1, "feedRequired": true, "feedFree": true, "max": 5 },
  "order": {
    "generated": {
      "fishCostFromWeights": true,
      "fishCostReferenceSeason": "spring",
      "roundTo": { "radish": 3, "carrot": 3 },
      "lineMax": { "radish": 18, "carrot": 18, "lettuce": 8, "crunchy_radishes": 8, "vegetable_soup": 6, "omelette": 8, "egg": 12, "gudgeon": 12, "chub": 6, "trout": 3, "plank": 20, "dandelion": 12, "wild_garlic": 6, "chanterelle": 6, "blackberry": 12, "hazelnut": 12, "cep": 4, "elderberry": 10 },
      "extraLineMinShare": 0.2,
      "resources": { "eggsPerHenPerWeek": 5.4 }
    }
  },
  "forage": {
    "points": [
      { "point": "forage_edge_01", "items": ["wild_garlic", "chanterelle", "hazelnut", "cep"] },
      { "point": "forage_edge_02", "items": ["wild_garlic", "chanterelle", "hazelnut", "cep"] },
      { "point": "forage_edge_03", "items": ["dandelion", "blackberry"] },
      { "point": "forage_edge_04", "items": ["dandelion", "blackberry"] },
      { "point": "forage_edge_05", "items": ["dandelion", "blackberry", "chanterelle"] },
      { "point": "forage_edge_06", "items": ["elderberry"] }
    ],
    "items": [
      { "item": "cep", "seasons": ["autumn"], "weight": 2, "count": [1, 2] },
      { "item": "elderberry", "seasons": ["autumn"], "days": [1, 14], "weight": 6, "count": [2, 3] }
    ],
    "rainBoost": [{ "item": "chanterelle", "factor": 3 }, { "item": "cep", "factor": 3 }]
  },
  "moments": { "seasonPoolFull": 7 }
}
```

`resources.eggs` (16,2) devient `eggsPerHenPerWeek x poules` (5,4 x 3 = 16,2: la démo et les jours 16 à 21 ne changent pas). `rainBoost` passe d'un objet à une liste (le validateur accepte les deux formes un tour, puis seulement la liste). Le JSON livré est complet; les lignes qui ne changent pas ne sont pas recopiées ici.

Fichier nouveau `donnees/catalogue.json` (le catalogue de la semaine, à côté de `objets.json`, qui garde les objets):

```json
{
  "version": 1,
  "pages": [
    { "season": "summer", "week": 1, "items": ["watering_can_copper", "axe_forged", "straw_hat"] },
    { "season": "summer", "week": 2, "items": ["fishing_rod_bamboo", "hen_extra", "pressed_flowers"] },
    { "season": "summer", "week": 3, "items": ["wicker_armchair"] },
    { "season": "autumn", "week": 1, "items": ["hen_extra_2", "coop_calendar"] },
    { "season": "autumn", "week": 2, "items": ["wall_clock"] },
    { "season": "autumn", "week": 3, "items": ["autumn_wreath"] }
  ],
  "gifts": [
    { "item": "chalk_box", "villager": "jeanne", "wish": "jeanne_wish" },
    { "item": "coffee_mill", "villager": "odette", "wish": "odette_wish" },
    { "item": "leather_apron", "villager": "basile", "wish": "basile_wish" },
    { "item": "wool_scarf", "villager": "firmin", "wish": "firmin_wish" }
  ],
  "copies": { "watering_can_copper": 2, "axe_forged": 2, "fishing_rod_bamboo": 2 },
  "seasonal": { "straw_hat": "summer", "pressed_flowers": "summer", "autumn_wreath": "autumn" }
}
```

Fichier nouveau `donnees/annonces.json`: un gabarit par ligne de la table 1.3 (`id`, `kind` `help` ou `together`, `giver`, `seasons`, `seasonDays` facultatif, `lines` ou `variants`, `scene` facultatif, `unique` facultatif), textes dans `textes.json` (`annonces.<id>.title`, `.text`, `.thanks`). Fichier nouveau `donnees/chantiers.json`: un chantier par ligne de la table 2.6 (`id`, `queue`, `order`, `price`, `model`, `cells`, `rotation`, `effects`), noms et textes dans `textes.json` (`chantiers.<id>.name`, `.done`).

### 6.2 Types (`src/donnees/types.ts`, extraits)

```ts
export type StageId = 'demo' | 'summer_end' | 'autumn_end';
export type AnnonceKind = 'help' | 'together';
export interface AnnonceDef {
  id: string; kind: AnnonceKind; giver: VillagerId; seasons: readonly Season[];
  seasonDays: readonly [number, number] | null;
  lines: readonly { item: ItemId; count: number }[] | null;
  variants: readonly (readonly { item: ItemId; count: number }[])[] | null;
  scene: DialogueId | null; unique: ItemId | null;
}
export type ImprovementQueue = 'bourg' | 'maisonnette';
export interface ImprovementDef {
  id: string; queue: ImprovementQueue; order: number; price: number; model: string;
  cells: readonly { cx: number; cy: number }[]; rotation: number; flag: string;
}
export interface ToolStats { toolKind: 'watering_can' | 'axe' | 'fishing_rod'; capacity?: number; chops?: number; biteWaitFactor?: number; hookWindowSeconds?: number }
export interface ForageItem { item: ItemId; seasons: readonly Season[]; days: readonly [number, number] | null; weight: number; count: readonly [number, number] }
export interface MomentWatch { /* champs du tour 7, plus: */ closeTogether?: number; syncPress?: { places: readonly string[]; gapSeconds: number } }
```

Chaque bloc est validé à la lecture: gabarits aux saisons et objets connus, habitants existants, scènes existantes; chantiers sur des cases libres de la carte (le validateur de carte le vérifie); pages du catalogue aux objets en vente (`shop: "catalogue"`); `days` dans `[1, seasonDays]`.

### 6.3 État du monde (format 6)

| Champ | Type | Borné par |
|---|---|---|
| `board` | `{ current: { gabarit: string; variant: number; posted: number; deadline: number; state: 'open' \| 'done' \| 'expired'; by: CharacterId \| null } \| null; previous: (même forme) \| null; recent: { gabarit: string; day: number }[]; uniquesGiven: ItemId[] }` | `recent`: 4; `uniquesGiven`: 2 |
| `improvements` | `Record<ImprovementId, { paid: number; builtDay: number \| null }>` | 6 chantiers |
| `catalogueBought` | `Record<ItemId, number>` | articles du catalogue |
| `stages.passed` | accepte `autumn_end` | |

Migration du format 5: `board` vide (le tableau s'ouvre à l'aube suivante si le jour est au moins 16, avec la lettre `firmin_board`); `improvements` à zéro; `catalogueBought` reconstruit depuis les achats déjà faits des articles d'avant (meubles posés ou au coffre); lettre `basile_works` rattrapée si le jour est au moins 22. Aucune autre donnée ne change.

### 6.4 Conditions, effets et autres données

- Conditions nouvelles: `annonce_active` (`gabarit` facultatif), `improvement_built` (`id`), `bought` (`item`); `stayed_at` accepte les points des bancs nouveaux. Changée: `used_tool_at` lit le `toolKind`.
- Effets nouveaux: `post_annonce` (interne), `build_improvement` (`id`, la nuit), `name_hen` (`name`, `variant`).
- `objets.json`: `watering_can_copper` (`tool`, `toolKind` `watering_can`, `capacity` 20, modèle `watering_can_copper`), `axe_forged` (`toolKind` `axe`, `chops` 2), `fishing_rod_bamboo` (`toolKind` `fishing_rod`, `biteWaitFactor` 0,8, `hookWindowSeconds` 2,0), `hen_extra`, `hen_extra_2` (catégorie `animal_order`, livrés en poule), `straw_hat`, `pressed_flowers`, `coop_calendar`, `wall_clock`, `autumn_wreath` (`decoration`, `wall: true`), `wicker_armchair` (`furniture`, 1 x 1, `seat_height`), `chalk_box`, `coffee_mill`, `leather_apron`, `wool_scarf` (`gift`), `jeanne_drawing` (`decoration`, `wall: true`), `elder_jelly` (`food`, en-cas `simple`), `cep`, `elderberry`; chacun avec `plural`, `indefinite`, prix de la table 2.3 et un substitut dans `src/rendu/substituts.ts` (sinon `rendu.test.ts` échoue).
- `habitants.json`: 76 répliques (3.5), scènes des annonces (1.5), remerciements des cadeaux (2.7), noms des poules (2.5), emplois du temps d'automne de Jeanne (3.3) et de pluie sous le toit du puits.
- `envies.json`: 15 envies (3.6).
- `moments.json`: 4 moments (4.5); `textes.json`: textes des moments (4.3, 4.4), confidence du salut ajustée (4.2).
- `courrier.json`: expéditeur `firmin`; lettres `firmin_board`, `basile_works`; titres de 5.2.
- `textes.json`: `stages.summer_end.text`, `stages.autumn_end`, `seasonCards.autumn.lines`, `annonces`, `chantiers`, `ui.board`, `ui.stage.chantiers`, messages `annonce_posted`, `annonce_done`, `annonce_expired`, `chantier_built`, `moment_side_by_side`, `moment_lantern_*`; `orderGreetings.all` gagne « Le chef de train a remarqué vos fleurs sur le quai. » avec la condition `improvement_built quay_planters`; `orderTips` du cèpe et du sureau.
- `astuces.json`: `tool_upgrade_hint` (2.4); `board_hint` « Le tableau du quai a de nouvelles annonces: approche-toi, puis {act} pour les lire. » (première affiche, à moins de 6 m du tableau).
- `cartes/halte.json` (par `construire_carte_halte.py`): points `forage_edge_06`, `lantern_quay`, `lantern_square`, `hopscotch`, `path_lamp`; bancs `ford_bench`, `house_bench` (objets posés quand le chantier est bâti, cases réservées sinon); emprises des chantiers (2.6).

## 7. Actions et retours

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Lire une annonce au tableau | carte de l'annonce, demande en liste à cocher | `letter-open` (actuel) |
| Donner pour une annonce | ligne cochée, puis remerciement de l'habitant et « +110 sous » | `crate-drop` (actuel), `coins-gain` (actuel) |
| Annonce à deux finie | scène à deux, « +95 sous », Cœur +10 chez les deux | `ui-confirm`, motif de l'habitant |
| Annonce retirée | ligne grise au carnet | aucun |
| Commander au catalogue | article coché, « Livré samedi, 10 h » | `catalogue-order` (actuel) |
| Prendre un outil amélioré | astuce `tool_upgrade_hint`, nouvel outil en main | `tool-pickup` (actuel) |
| Arroser avec le cuivre, abattre en deux coups, ferrer avec le bambou | jauge d'eau à 20, l'arbre tombe au deuxième coup, fenêtre de ferrage plus longue (anneau du bouchon) | sons actuels; le cuivre a un timbre plus clair (`water-pour-copper`, P1) |
| La poule arrive | cage devant le poulailler, Jeanne la nomme | `hen-cluck` (actuel), caquet de la nouvelle |
| Verser au chantier | barre « 450 sur 950 sous » qui monte | `coins-drop` (nouveau) |
| Chantier bâti | notification du matin, l'objet posé sur la carte | `chantier-built` (nouveau) |
| Offrir un cadeau | remerciement, changement chez l'habitant le lendemain | `gift-give` (papier froissé, 0,5 s, nouveau) |
| Cueillir un cèpe, du sureau | la cueillette disparaît (le sureau reste), « +2 grappes de sureau » | `pick-mushroom`, `pick-berries` (actuels) |
| Dame blanche | voir 4.3 | `owl_screech`, `grass_strike` |
| Allumer une lanterne seul | flamme qui vacille et s'éteint, ligne `moment_lantern_alone` | `lantern_light` puis `lantern_out` |
| Allumer ensemble | apogée 4.4 | `lantern_light`, `quay_bell_once` |
| Départ du train du 64 | scène de Firmin, écran « Neuf semaines » | sifflet (actuel), musique de fin |

## 8. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| T9-01 | Le tableau s'ouvre au jour 16 à 6 h avec la lettre `firmin_board`; une sauvegarde du jour 43 (format 5) l'ouvre à l'aube suivante | test et migration |
| T9-02 | Sur 1 000 graines, jours 16 à 63: une annonce chaque dimanche (coup de main) et chaque mercredi (à deux), jamais le même gabarit à moins de 10 jours, jamais deux en cours, jamais une cueillette hors saison pendant ses trois jours, jamais un produit jamais obtenu | test unitaire |
| T9-03 | Graine 20261030: suite des gabarits affichés des jours 16 à 61 égale à celle du script (même `unitDraw`) | test unitaire, liste produite par `tour9_automne.py` |
| T9-04 | Une annonce faite paie la récompense de la table 1.3 (formule 1.4); une annonce à deux donne Cœur +10 aux deux; l'objet unique n'est donné qu'une fois par partie | test unitaire |
| T9-05 | Une annonce non faite se retire à 20 h du troisième jour, sans pénalité, avec `annonce_expired`; pendant l'absence d'un joueur, l'échéance ne passe pas | test unitaire |
| T9-06 | Les scènes `basile_fence_scene`, `jeanne_poem_scene`, `jeanne_snack_scene`, `jeanne_snack_nuts_scene` ne se lancent qu'avec les deux joueurs au point, à l'heure dite, l'annonce active, l'habitant présent | test à deux joueurs |
| T9-07 | Catalogue: chaque samedi à 10 h, les articles de la page (saison, semaine) paraissent; un article de saison part à la fin de sa saison; une partie reprise au jour 43 voit toutes les pages passées; jamais plus d'exemplaires que prévu | test unitaire |
| T9-08 | Outils: l'arrosoir de cuivre contient 20, la hache de la forge abat en 2 coups, la canne en bambou multiplie l'attente par 0,8 et laisse 2 s pour ferrer; l'ancien outil va au coffre; les astuces et conditions de l'outil d'origine marchent avec l'outil amélioré | test unitaire |
| T9-09 | Poules: la poule commandée arrive le samedi, est nommée par Jeanne (Brioche puis Pervenche), pond nourrie; jamais plus de 5 poules; la capacité d'œufs de la commande suit le nombre de poules | test unitaire |
| T9-10 | Cadeaux: l'article ne paraît qu'après la réplique du souhait entendue; offert, il déclenche le remerciement, la réplique d'après et le changement visible (marelle effacée par la pluie et redessinée au premier jour sans pluie; moulin sur le comptoir; écharpe de Firmin en automne) | test unitaire et captures |
| T9-11 | Chantiers: un seul ouvert par file; un versement d'au moins 100 sous demande l'accord de l'autre; payé, le chantier est bâti dans la nuit, paraît au matin avec `chantier_built` et deux répliques; les planches apportées à Basile retirent 10 sous chacune, 20 au plus | test unitaire |
| T9-12 | Chaque chantier bâti est sur ses cases (2.6), ne bloque aucun chemin vers un point important (`valider_carte.py`), et n'entre pas dans l'anneau d'un moment sans que M-14 tienne encore | validateur de carte, `tests/moments.test.ts` |
| T9-13 | Captures de près des six chantiers bâtis, au zoom 1, orientation 0 et une autre: rien qui flotte, traverse ou barre un passage; le banc du gué face à l'eau, le banc du pignon face à l'est, les jardinières hors des passages du quai | captures `captures/tour-09/chantier-*.png` |
| T9-14 | Truite: coût 0,667 en été, 0,222 en automne; chevesne et goujon selon la formule 2.11; aucune truite commandée l'hiver | test unitaire |
| T9-15 | Sur 1 000 graines, commandes 3 à 10: aucune ligne au-dessus de son plafond; radis et carottes en multiples de 3; une ligne ajoutée quand la part perdue dépasse 0,2 et qu'il reste de la place; I-04 du tour 8 toujours tenu | test unitaire |
| T9-16 | Étapes: au jour 43, l'écran propose « Rester », le texte réécrit s'affiche; au jour 64 à 16 h, commande payée, scène `firmin_stage_autumn`, écran « Neuf semaines » sans « Rester », texte `next`; avec `lastDay` porté au jour 70 dans le test, « Rester » apparaît | test |
| T9-17 | Une sauvegarde finie au jour 43 par la version du tour 8 se charge sur l'écran d'étape avec « Rester »; « Rester » chez les deux reprend la partie au départ du train | test de migration (sauvegarde de référence du tour 8) |
| T9-18 | Jeanne: les jours d'école d'automne, absente de 8 h 30 à 16 h 30, sur la place de 16 h 30 à 18 h 30; le mercredi, comme dans la démo | test |
| T9-19 | Cueillette: cèpes seulement aux coins de sous-bois, en automne, plus fréquents le lendemain d'une pluie; sureau seulement au coin 06, jours 1 à 14 de l'automne, disparu la nuit du 14 au 15 | test unitaire |
| T9-20 | Répliques: robot assidu, jours 44 à 64, redites à moins de 28 jours sous 2 % pour chaque habitant; les répliques de souhait et de chantier ne sont dites qu'une fois par joueur | robot longue vie |
| T9-21 | Envies: au moins 30 % d'envies jamais reçues en automne; jamais la même deux fois en 7 jours; les envies des chantiers ne sortent qu'une fois le chantier bâti | robot longue vie |
| T9-22 | Étoiles: critères M-14 à M-16 et M-24 du tour 7 pour `falling_stars`; capture chez l'hôte et l'invité | test et captures |
| T9-23 | Salut: critère M-20 du tour 7; confidence ajustée affichée; avec `saluteSlowRoll` à `false`, départ de 6 s et salut joué | test |
| T9-24 | Dame blanche: rien ne part si les deux sont à plus de 1,8 m l'un de l'autre ou si l'un bouge; tout part côte à côte, immobiles, entre 3 et 5,5 m, 3 s; jamais sous la pluie; M-14 (10,6 s au pire) et M-15 (6,7 s au zoom 0) | tests unitaires, `tests/moments.test.ts` |
| T9-25 | Lanternes: deux allumages à moins de 0,8 s déclenchent l'apogée; à plus de 0,8 s, la flamme s'éteint et l'on peut recommencer; les lampadaires restent éteints jusqu'à l'apogée ou 19 h 45; aucun texte d'apogée sans apogée | tests unitaires avec deux robots |
| T9-26 | Moments, robot de 84 jours: au moins 2 moments différents vus ensemble par saison d'au moins 7 jours jouée (O-07); O-06a et O-06b (4.5); jamais moins de 10 jours entre deux passages après le jour 24; les tirages de la démo inchangés (M-23) | robot longue vie |
| T9-27 | Lisibilité: captures de 5.1 pour chaque cueillette, quatre orientations, 8 h et 19 h; chaque cueillette couvre au moins 14 x 14 px au zoom 1 et se tient à moins de 0,6 m du pied de son buisson | captures, jugement du directeur artistique |
| T9-28 | Courrier: chaque entrée montre son titre en premier; la lettre de commande et le bilan d'un même samedi se distinguent à 100 et 150 % sur 1366 x 768; le lecteur d'écran lit titre, expéditeur, jour, état | captures Chromium et test d'interface |
| T9-29 | Robot longue vie (84 jours, 7 parties): invariants I-01 à I-11 tenus (I-06 et I-11 aux bornes de 3.8); objectifs O-01 à O-15 listés avec leur valeur; durée et tailles par clé dans le rapport | robot longue vie |
| T9-30 | Textes nouveaux: validateur sans avertissement d'écriture neutre; aucun tiret cadratin ni demi-cadratin; aucune variable non remplie (I-08) | validateur |
| T9-31 | Chaque action de la section 7 a son retour visuel et sonore | test et écoute chez le client |
| T9-32 | Chez le client: le duo discute au moins une fois de ce qu'il achète ou finance, fait au moins une annonce à deux, et dit qu'il « a des projets » après le jour 22 | observation |

## 9. Travail par métier

| Métier | Travail |
|---|---|
| Dev gameplay | tableau et annonces (tirage `unitDraw`, échéances, scènes, récompenses, objets uniques); catalogue par pages, exemplaires, rayon « Pour offrir » et souhaits; outils à `toolKind`; poules commandées et nommées, capacité d'œufs; chantiers (souscription, commande à Basile, planches, construction de nuit, cases réservées, effets: bancs, pluie de Jeanne, salutation); correctifs de la commande (poissons par saison, arrondis, plafonds, ligne ajoutée); étape `autumn_end`, `lastDay` 64, compteur des chantiers; Jeanne à l'école; cèpe, sureau, plage de jours des cueillettes, `rainBoost` en liste; moments `falling_stars`, `train_salute`, `barn_owl`, `quay_lanterns` (`closeTogether`, `syncPress`, lampadaires éteints jusqu'à l'apogée), `longCooldownDays`, `seasonPoolFull` 7; format 6 et migration; robots: routine d'achat, annonces, chantiers, mesures L-13 à L-16; données passées au validateur |
| Dev rendu et tech-artist | les six chantiers à leurs cases; marelle à la craie (décalque, effacée par la pluie); écharpe de Firmin; moulin sur le comptoir; reflet et traînées des étoiles; vapeur des purgeurs et découpe du rendu au passage à niveau; dame blanche (vol, surplace, plongeon); flammes des lanternes et vague des lampadaires, fenêtres du bourg; cueillettes posées sur leur buisson (`berry_spots` du sureau, `nut_spots` des noisetiers, disque de feuilles), pluie arrêtée sous l'auvent; substituts de tous les objets nouveaux |
| Dev interface | onglets « Annonces » et « Chantiers » du tableau; catalogue par rayons, « Pour {habitant} »; commande à l'établi de Basile; écran d'étape à quatre compteurs; liste du courrier à titres (5.2); carnet: deux dernières commandes et annonces (5.3); lignes des moments nouveaux |
| Designer UX | gabarit commun des listes (courrier, annonces), maquettes du tableau et du versement au chantier à 100 et 150 %, focus et parcours au clavier, lecteur d'écran |
| Sound-designer | `coins-drop`, `chantier-built`, `gift-give`, `star_chime`, `night_water`, `gate_crank`, `gate_lock`, `train_slow_roll`, `train_whistle_salute`, `cylinder_cocks`, `owl_screech`, `owl_far`, `grass_strike`, `lantern_light`, `lantern_out`, `quay_bell_once`, `coffee_grind`, tic-tac de l'horloge; P1: `water-pour-copper`, `halte-evening` |
| Artiste 3D | outils améliorés (variantes de matériau: cuivre, acier forgé, bambou à ligatures), poule rousse et blanche (variantes existantes), cage de transport, objets muraux (chapeau, herbier, calendrier à 4 gravures, horloge à aiguilles animées, couronne, dessin de Jeanne), fauteuil d'osier, craies, moulin, tablier (P1), écharpe de Firmin; chantiers (banc du gué en chêne, trois jardinières à fleurs de saison, toit de puits avec treuil, auvent de porte, le banc du pignon; le réverbère reprend `lamp_post`); `cep`, `elderberry`; `barn_owl` et `vole`; `lamp_pole`; équipage du train, manivelles; clips listés en 4.1 à 4.4; vérifier que le poulailler montre cinq places au perchoir; chaque objet vu de près |
| Level designer | points et cases de 2.6, 3.4, 4.3 et 4.4 par `construire_carte_halte.py`; point `hopscotch` sur la place hors des passages et à plus de 3 m des places des moments; réserver les cases des chantiers; relancer `valider_carte.py` et `moments_tour7_geometrie.py` (via `tour9_automne.py`, partie 10) après pose |
| Directeur artistique | revue des cueillettes (5.1) sur captures du soir, des chantiers et des objets muraux dans la pièce; palette des fleurs des jardinières par saison |
| QA | critères T9-01 à T9-32; robot longue vie étendu (2.12, 3.8), rapport du tour 9; sauvegardes de référence du jour 43 (tour 8) et du jour 64 |
| Game designer (fait dans ce document) | textes (1.5, 2.3, 2.5 à 2.7, 3.1 à 3.6, 4.2 à 4.4), tables d'équilibrage, simulation `tour9_automne.py`; relecture en situation après production |

## 10. Hors périmètre

- La valse d'Odette et toute danse (D7, question 1 du tour 7).
- Contenu de J1 (Lucie, fête des semailles, marquise, inauguration, appareil photo); annonces portées à deux (`basile_beam`, `odette_parcel`, P1); balançoire de Jeanne (modèle et animation, plus tard).
- L'hiver au-delà du matin du jour 64: répliques, envies, cueillettes d'hiver, neige, poêle allumé.
- Cultures nouvelles, rayons du catalogue liés à la confiance (EC-09), agrandissement du potager (réservé à J2), maison qui grandit, nouveaux lieux.
- Changer le plafond d'achat d'Odette (2.8: inutile, mesuré).
- Rythme à 0,8 s (D1): l'équilibrage est fait à 0,35 s.

## 11. Questions ouvertes

1. **Pour le client (par le manager): les chantiers du bourg se paient avec la bourse commune.** Le bourg ne participe pas encore (Lucie, en J1, pourrait y verser). Recommandation: garder ainsi; c'est le plus gros usage de l'argent, il se décide à deux, et le résultat reste sur la carte.
2. **Pour l'architecte: la mémoire des répliques entendues au-delà de 28 jours** (3.8). Recommandation: un ensemble de bits au-delà de 28 jours, toutes les vieilles répliques à égalité; la taille de `heard` ne dépend plus du contenu écrit; sinon, porter la borne I-06 à 52 000 octets.
3. **Pour l'architecte: les outils améliorés comme objets à part** (`toolKind`), plutôt qu'un niveau d'outil sur le personnage. Recommandation: des objets, parce qu'ils se prêtent par le coffre (« prête-moi la canne ») et que l'ancien reste.
4. **Pour qa-testeur: O-06 sur 84 jours** (4.5). Recommandation: O-06a et O-06b pour le robot de 84 jours, O-06 à 19 jours gardé pour le robot de cinq années.
5. **Pour le manager: J1 et le tableau.** Le plan faisait ouvrir le tableau des annonces par Firmin après l'arrivée de Lucie; il s'ouvre maintenant au jour 16. Recommandation: en J1, Lucie ajoute ses propres gabarits (porter des lettres et des colis à deux), sans rouvrir le tableau.
6. **Pour le manager: une séance chez le client entre les jours 15 et 22** (priorité 3 de la revue du tour 8), pour observer S-08, T8-30 et maintenant T9-32. Recommandation: la proposer avec cette livraison.

## Annexe A: résultats de la simulation

`python3 -I docs/jeux/jeu-1/simulations/tour9_automne.py` (60 s, 2 000 graines; `--rapide`: 300). Repères:

| Partie | Résultat |
|---|---|
| 0 | contrôle croisé des tables 1.3, 2.3, 2.6 et 3.4 avec le script: aucun écart |
| 1 | jour 43 samedi, premier jour de l'automne; jour 64 samedi, premier jour de l'hiver; annonces les dimanches 16 à 58 et les mercredis 19 à 61; 12 jours d'école sur 21 en automne |
| 2 | coût des poissons par saison: table 2.11 |
| 3 | 16 743 lignes: 6,2 % au-dessus de 18 avant, aucune après; 23,4 % des commandes gagnent une ligne; paie médiane 1 315 puis 1 246 sous |
| 4 | par semaine d'automne: 7,1 noisettes, 8,3 girolles, 2,3 cèpes, 5,8 grappes de sureau; premier cèpe au jour 46 en médiane |
| 5 | 14 annonces par partie; 0 redite à moins de 10 jours; au moins 5 coups de main et 4 à deux possibles; même habitant que la précédente 9,7 %; récompense moyenne 67 et 93 sous (40 à 110, 60 à 140); tous les gabarits tirés au moins une fois |
| 6 | sans achat: 7 300 sous au jour 63 (7 038 à 7 547); table 2.9 |
| 7 | répliques: table 3.5 |
| 8 | envies jamais reçues: 86 % au printemps (16 à 21), 76 % en été, 58 % en automne; au moins 24 possibles chaque matin d'automne |
| 9 | moments: table 4.5 |
| 10 | points nouveaux sur des cases libres; dame blanche M-02 10,6 s, cadre 6,7 s (zoom 0); lanternes: 14,3 m entre les places, 13,4 m à l'écran, flammes visibles en orientation 0 |
| 11 | état: environ 4,6 Ko de plus au plus (dont 3,65 Ko de `heard`) |

Mesure jointe: test jetable `/tmp/lpl-gd9/bourse.test.ts` (robots de `tests/aides.ts`, `lastDay` porté au jour 63 dans le contenu du test), deux graines, 99 s chacune: bourse à chaque aube, commandes payées (22: 851 et 1 181; 29: 631 et 1 159; 36: 1 137 et 1 312; 43: 1 084 et 556; 50: 1 512 et 1 313; 57: 694 et 1 143), aucune vente à Odette, aucun achat après la démo sauf des graines.

## Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-11-01 | 1 | Première rédaction: annonces (L4), catalogue de la semaine, outils, poules, cadeaux, chantiers, équilibrage chiffré, correctifs de la commande, automne jusqu'au jour 64 et étape `autumn_end`, école de Jeanne, sureau et cèpe, 76 répliques, 15 envies, étoiles et salut (production complète), dame blanche et lanternes du quai, lisibilité des cueillettes et du courrier, état borné, mesures du robot, simulation `tour9_automne.py` | manager (gauntlet, tour 9) |
