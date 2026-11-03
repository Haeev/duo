# La Petite Ligne 0.12.0: l'aubrin, le marché du dimanche, la basse-cour et la chèvre (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | conception urgente, à produire le 2026-11-03 en quelques heures par 4 à 5 développeurs en parallèle |
| Version du document | 1 |
| Date | 2026-11-03 |
| Rédaction | game-designer, sur brief du manager (demande du client: économie plus poussée, monnaie inventée, activités, quêtes, élevage) |
| Point de départ | branche `claude/stoic-lamport-lueey2` (0.11.1) |
| Sources | `donnees/reglages.json` (`economy`, `order`, `board`, `hens`, `improvements`), `objets.json`, `catalogue.json`, `annonces.json`, `quetes.json`, `chantiers.json`, `donnees/README.md` (conditions et effets), `tour-09-conception.md` (revenus mesurés), `tour-10-conception.md` (Achille, Solange, rue Haute), `retours/2026-11-02/retours.md` |
| Pêche | conçue à part (`peche-0-12-conception.md`, en cours): ce document ne la redessine pas, il la compte comme une source de revenus (section 2.6) |
| Simulation | `simulations/v0_12_economie.py` (bibliothèque standard, 10 s pour 1 000 graines). Sa partie 0 relit 11 valeurs des tables de ce document et échoue en cas d'écart |

## En bref

**Pitch.** Le dimanche, on tient l'étal de la Halte sur la place pendant que la basse-cour glousse et que la chèvre broute le talus: tout ce que le duo fait pousser, cueillir, pêcher et cuisiner se vend désormais en aubrins, la monnaie de la vallée.

**Fantasme.** « Ce matin j'ai trait Noisette pendant que tu lui tenais le collier; on a fait deux fromages frais. L'ardoise d'Odette veut des carottes à prix et demi, je descends. Toi, tu files porter les plis de Lucie avant midi. Dimanche, on tient l'étal: Achille vient pour nos œufs, Jeanne pour les mûres. »

| # | Lot | Ce qui change | Section |
|---|---|---|---|
| 1 | L-monnaie | « sou » devient **aubrin** (même valeur), petite pièce percée à la lanterne | 1 |
| 2 | L-économie | prix d'Odette qui varient (saison, offre), ardoise du jour, marché du dimanche, plis de Lucie, conserves et fromages, nouveaux achats utiles | 2, 3 |
| 3 | L-élevage | poules (bonheur, grain, paille, couvée, six couleurs, coq), chèvre au piquet sur le talus (traite à deux, fromage); ruches en P1 | 4 |
| 4 | L-quêtes | 5 quêtes principales (la trame « Le marché d'Aubrune », une semaine de jeu) et 9 quêtes secondaires | 5 |
| 5 | L-rendu-modèles et son | étal, chevrerie, chèvre, coq, poussins, mangeoire, ardoise, sacoche, piquet | 6 |

Chiffres clés (simulation, 1 000 graines, jours 1 à 64): un duo médian gagne environ 20 000 aubrins, dont environ 30 % par les sources nouvelles (marché, plis, chèvre, œufs des poules nées ici, conserves, quêtes nouvelles); la commande du samedi reste la première source (44 à 46 %), le marché fait 10 %, la pêche 10 % (hypothèse), la chèvre 5 à 8 %, les plis 5 %. Les dépenses utiles passent d'environ 9 650 à 15 940 aubrins: la bourse médiane reste sous 900 aubrins jusqu'au jour 43, puis remonte quand presque tout est acheté (jours 50 à 57). Un duo tranquille finit la partie à 81 à 91 % des achats; la halle du marché est le dernier grand but. Vendre 20 radis d'un coup à Odette rapporte 90 au lieu de 120: on a intérêt à varier et à garder pour l'étal.

## 1. La monnaie: l'aubrin

### 1.1 Le nom

| Champ | Valeur |
|---|---|
| Singulier | **aubrin** |
| Pluriel | **aubrins** |
| Genre | masculin (« un aubrin », « deux aubrins », « pas un aubrin ») |
| Élision | « d'aubrins » (« une bourse d'aubrins », « plein d'aubrins »): l'initiale est une voyelle |
| Accord | singulier pour 0 et 1 (« 0 aubrin », « 1 aubrin »), pluriel à partir de 2 (règle de l'Académie pour zéro) |
| Raison | dérivé de l'Aubrune, la rivière qui donne son nom à la Halte et à la vallée: une monnaie de vallée, émise par la coopérative de la ligne et acceptée tout le long de la voie (comme les monnaies locales réelles des coopératives). Court, facile à dire, sans homonyme trouvé (recherche du 2026-11-03: aucune monnaie, aucun jeu de ce nom) |
| Alternative si le client n'aime pas | « picot » (« picots »): le petit trou que le contrôleur poinçonne dans le billet. Même règle de remplacement |

**L'icône.** Une petite pièce ronde en laiton, percée au centre (comme les vieilles pièces trouées), avec la lanterne du quai frappée d'un côté du trou et une ligne de rail de l'autre. Pas de symbole typographique: dans l'interface, le montant est suivi de l'icône là où la place manque (HUD, prix des panneaux), et du mot en toutes lettres partout ailleurs (messages, dialogues, lettres, carnet). Fichier: `ui_coin_aubrin.svg` (16 et 24 px, lisible à 16 px: trou et lanterne seulement, la rail disparaît sous 20 px).

**Dans le monde.** Une lettre de Firmin, à la première aube jouée avec la 0.12 (`firmin_aubrin`, une seule fois, aussi dans une partie reprise): « La coopérative a enfin donné un nom à ses pièces: l'aubrin, comme la rivière. Rien ne change, un sou d'hier vaut un aubrin d'aujourd'hui. Odette a déjà repeint ses étiquettes; Basile dit que ça ne fera pas pousser les radis. F. »

### 1.2 Conversion

1 sou = 1 aubrin. Aucune somme ne change: bourse, prix, récompenses, chantiers, tests, références de sauvegarde. Raison: le changement est un nom, pas une dévaluation; garder les nombres garde les mesures des tours 9 et 10 et évite de migrer la bourse. Le format de sauvegarde ne change pas pour la monnaie (la bourse est un nombre).

### 1.3 Règle de remplacement (lot L-monnaie)

Piège: en français, « sous » est aussi la préposition (« sous la pluie », « sous le toit »). On ne remplace donc jamais le mot seul à l'aveugle.

| Règle | Détail |
|---|---|
| Source unique | `reglages.economy.currency` devient `{ "singular": "aubrin", "plural": "aubrins", "icon": "ui_coin_aubrin" }`. Tout code d'interface qui écrit l'unité la lit là (fonction `formatMoney(n)` qui applique l'accord de 1.1) |
| Données (textes) | remplacer seulement: un nombre ou un espace réservé suivi de « sous » (`[0-9}] sous`, ex. « {amount} sous », « 30 sous »); « Cinq sous », « deux sous » et tout nombre en lettres suivi de « sous »; « leurs sous », « des sous », « pas un sou », « de sous » (qui devient « d'aubrins ») après relecture de la phrase |
| Ne jamais toucher | « sous » suivi d'un article ou d'un nom (« sous la pluie », « sous le toit », « dort sous », « glissent sous ») |
| Méthode | un script jetable liste chaque occurrence de `\bsous?\b` dans `donnees/*.json`, `src/**/*.ts` (chaînes, pas les commentaires) et `tests/`, classe en « monnaie » et « préposition », et le développeur relit la liste « monnaie » ligne à ligne. Repères mesurés: environ 45 occurrences monétaires dans les données (courrier 14, textes 13, quêtes 13, habitants 3, astuces 1), plus les chaînes de l'interface (`modele.ts` découpe « {amount} sous » en montant et unité: le découpage doit lire l'unité dans les réglages) |
| Commentaires du code | remplacés dans la même passe quand ils citent un exemple de texte (« Il manque 40 aubrins »); sinon laissés |
| Tests | chercher les phrases exactes dans `tests/` et `src/**/tests/` (« Il manque 40 sous », « Merci: 110 sous ») et les mettre à jour dans le même commit |
| Validateur | `outils/valider_donnees.py` avertit de toute occurrence `[0-9}] sous` dans un texte du jeu (garde-fou pour les textes futurs) |
| Notes de version | les anciennes notes gardent « sous » (c'est l'histoire); seule la 0.12.0 dit « aubrins » |

## 2. L'économie

### 2.1 Principe

Le duo garde un revenu sûr (la commande du samedi), et gagne des sources plus petites, variées, qui récompensent l'attention et la coopération plutôt que le volume: vendre au bon moment, au bon client, transformer ce qu'on récolte. Les dépenses nouvelles servent toutes à quelque chose qu'on voit (un abri, une bête, l'étal, la halle) ou qu'on ressent (un geste en moins, une vente de plus). Semer et manger restent bon marché (graines 6, 8 et 12; pain 5): c'est le cœur du jeu, on n'y touche pas.

### 2.2 Le comptoir d'Odette: prix qui varient

Prix d'un article vendu à Odette = arrondi de `sellPrice x qualité x 0,8 x saison x offre (x 1,5 si c'est l'article de l'ardoise)`, au moins 1 aubrin. Le prix se recalcule à chaque unité: le panneau de vente montre le prix de la prochaine unité et le total de la ligne.

| Réglage (`reglages.economy.grocer`) | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Taux d'Odette (`buyRate`) | 0,8 | facteur | 0,7 à 0,9 | inchangé: elle revend, elle garde sa marge |
| Plancher de l'offre | 0,6 | facteur | 0,5 à 0,8 | même en vendant beaucoup, on gagne encore quelque chose |
| Pente de l'offre | 0,4 | facteur | 0,2 à 0,6 | à `saturation` unités vendues, le prix a perdu 40 % |
| Oubli de l'offre à l'aube | 0,5 | facteur | 0,3 à 0,7 | chaque matin, le compteur d'unités vendues de chaque article est multiplié par 0,5 (arrondi vers le bas): en deux jours, Odette a écoulé |
| Plafond par jour (`dailyCap`) | 400 | aubrins | 300 à 500 | 300 avant: les fromages et les poissons rares le touchaient trop vite |
| Ardoise du jour (`ardoise.factor`) | 1,5 | facteur | 1,3 à 2 | un petit but quotidien, lisible de loin |
| Ardoise, unités au plus (`ardoise.max`) | 10 | unités | 5 à 15 | au-delà, prix ordinaire (toujours avec l'offre) |

Offre: `offre = max(0,6 ; 1 - 0,4 x vendus / saturation)`, où `vendus` est le compteur de l'article (`world.grocerSupply[item]`).

| Article | Saturation (unités) | Article | Saturation |
|---|---|---|---|
| radis | 20 | œuf | 12 |
| carotte | 15 | bidon de lait | 8 |
| laitue | 6 | fromage frais | 6 |
| planche | 20 | pot de confiture, gelée | 6 |
| cueillettes (chacune) | 10 | poissons communs | 8 |
| poissons rares | 3 | poissons épiques et au-delà | 1 (le second de la semaine vaut moins: Odette n'a qu'une vitrine) |

Saison (`seasonFactor`): un produit en pleine saison est abondant partout, il vaut un peu moins; un produit gardé hors de sa saison (au cellier) vaut plus.

| Article | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| radis | 1,0 | 0,9 | 1,0 | 1,3 |
| laitue | 1,1 | 0,9 | 1,0 | 1,3 |
| carotte | 1,1 | 1,0 | 0,9 | 1,2 |
| œuf | 0,9 (les poules pondent beaucoup) | 1,0 | 1,1 | 1,3 |
| mûre | 1,3 | 0,9 | 1,2 | 1,3 |
| noisette, cèpe, sureau | 1,3 | 1,3 | 0,9 | 1,2 |
| pissenlit, ail des ours | 0,9 | 1,3 | 1,3 | 1,3 |
| fromage frais, lait | 0,9 (les chèvres donnent beaucoup) | 1,0 | 1,1 | 1,3 |
| tout le reste | 1,0 | 1,0 | 1,0 | 1,0 |

Résultat (partie 1 de la simulation, radis à 7): 10 radis d'un coup rapportent 51 au lieu de 60; 20 radis, 90 au lieu de 120; 40 radis, 150 au lieu de 240. Vendre un peu chaque jour ou garder pour l'étal rapporte davantage, sans jamais rien bloquer.

**L'ardoise d'Odette.** Chaque matin à 7 h (si Odette achète, drapeau `grocer_buys`), une ardoise à la craie, accrochée à côté de la porte de l'épicerie, montre un article: tiré par la graine (`unitDraw(seed, "ardoise", jour)`) parmi les articles de saison que le duo a déjà obtenus au moins une fois, jamais le même deux jours de suite. Texte de l'ardoise (dessin de l'article et légende): « Aujourd'hui: carottes, prix et demi ». Dans le panneau de vente, la ligne de cet article porte « Ardoise du jour » et le prix majoré jusqu'à 10 unités.

Mots du panneau de vente (`textes.ui.grocer`): offre au plus 0,85: « Odette en a déjà beaucoup »; facteur total (saison x offre) au moins 1,15: « Recherché »; sinon rien. Pas de flèches ni de courbes: un mot suffit.

### 2.3 Le marché du dimanche (activité A1)

**Raison d'être.** Avant que la ligne ne se vide, la place avait son marché le dimanche matin. Odette ne peut pas quitter sa boutique; elle propose au duo de le relancer (quête principale 1). Les habitants viennent faire leurs courses à l'étal, chacun avec sa liste.

**Le lieu.** L'étal se pose sur la place (`village_square`), côté soleil du matin, dos à l'épicerie, à plus de 2 m du chemin de la halte pour ne pas le barrer. Il est rangé contre le mur de l'épicerie en semaine (on le voit plié, tréteaux et planche) et se déplie seul le dimanche à 8 h. L'étal fait 2 m de long: une planche sur deux tréteaux, quatre cagettes posées dessus (six après la quête des cagettes), une ardoise pour les prix.

| Règle | Valeur |
|---|---|
| Quand | dimanche, 8 h à 13 h (heures de jeu), dès que l'étal est posé (quête `market_stall`) |
| Garnir | Agir sur l'étal ouvre un panneau à cases comme le coffre: 4 cases (6 avec `market_crates`), une pile par case; on y met ce qu'on veut, depuis son sac. Les deux joueurs garnissent le même étal |
| Prix | un réglage pour tout l'étal, choisi au panneau: « Doux » (x 1,0 du prix de base), « Juste » (x 1,25), « Fort » (x 1,5). Le prix de base est `sellPrice x qualité` (sans le taux d'Odette ni l'offre: on vend soi-même) |
| Acheteurs | les six habitants, chacun une fois par marché, à une heure tirée par la graine entre 8 h 15 et 12 h 30 (jamais deux à moins de 20 minutes de jeu, sauf la quête `market_rush`), avec une liste de 1 à 3 articles (table 2.3.1); chacun passe par son trajet habituel puis vient à l'étal |
| Servir | l'habitant attend devant l'étal, une bulle au-dessus de lui montre sa liste en petites icônes; un joueur à moins de 1,5 m derrière l'étal appuie sur Espace (ou clique l'habitant): il sert. Ce qui est sur l'étal et dans la liste part, au prix de l'étal; s'il manque un article de la liste, l'habitant prend une unité d'un article qu'il aime (table) s'il y en a, sinon rien |
| Accepter le prix | « Doux »: toujours, et lien +2 avec l'habitant; « Juste »: 90 %; « Fort »: 60 %. Un refus est gentil (« C'est un peu cher pour moi aujourd'hui. Je reprendrai dimanche. ») et l'habitant achète quand même un article de sa liste au prix « Doux » s'il est sur l'étal |
| Attente | 30 minutes de jeu (21 s réelles à 0,7 s); personne derrière l'étal: l'habitant dit « Je repasse tout à l'heure » et revient une fois, 40 minutes plus tard; la seconde fois sans personne, il rentre (« Ce sera pour dimanche. »). Aucune perte |
| À deux | deux habitants peuvent attendre en même temps (la file a deux places); deux joueurs derrière l'étal servent chacun le sien. Celui qui ne sert pas peut aller chercher au cellier ce qui manque à la liste: la bulle reste affichée chez les deux |
| Pluie | 30 % des habitants restent chez eux (`rainFactor` 0,7) tant que la halle n'est pas bâtie |
| Fin | à 13 h, ce qui reste sur l'étal retourne au cellier (« L'étal est rangé: le reste est au cellier. »), l'étal se replie |
| Argent | à la bourse commune, à chaque vente (son de pièces, montant qui monte au-dessus de l'étal chez les deux) |
| Pas de plafond | le marché ne compte pas dans le plafond d'Odette; il est limité par les listes (environ 6 x 2 unités) |

#### 2.3.1 Listes des habitants

Chaque liste est tirée par la graine parmi les articles de la colonne « Cherche », selon la saison et ce que le duo a déjà obtenu une fois (on ne demande jamais un produit jamais vu).

| Habitant | Cherche (1 à 3 unités de 1 à 3 articles) | Aime (repli) | Réplique d'arrivée |
|---|---|---|---|
| Odette | laitue, carotte, œuf | gelée de sureau | « Je ferme boutique cinq minutes. Qu'est-ce qu'il y a de beau ? » |
| Firmin | truite, chevesne, fromage frais | noisettes grillées | « Pour mon souper. Le reste, c'est pour la conversation. » |
| Basile | radis, cèpe, omelette | confiture de mûres | « Du solide. Je ne mange pas de la dentelle. » |
| Jeanne | mûre, noisette, confiture de mûres | œuf | « J'ai mes économies ! Trois aubrins, c'est beaucoup ? » |
| Achille | œuf, bidon de lait, noisette | fromage frais | « Pour la pâte de demain. Des œufs, surtout. » |
| Solange | laitue, gelée de sureau, fromage frais | pissenlit | « Un petit rien pour le goûter des clientes. » |

Fanions de Solange posés (quête principale 4): chaque habitant achète une unité de plus. Balance achetée: une unité de plus encore pour les légumes et cueillettes (« Pesé juste: je vous en prends un de plus »).

### 2.4 Les plis de Lucie (activité A3, livraisons)

**Raison d'être.** Lucie, la factrice, est en longue tournée; Jeanne est chez Solange. Firmin trie le courrier du train à la halte, mais il ne peut pas quitter le quai. Il confie la sacoche au duo (quête secondaire `lucie_round`).

| Règle | Valeur |
|---|---|
| Quand | chaque jour sauf le dimanche, dès que `lucie_round` est faite: la sacoche est posée sur le banc du quai (`quay_bench`) à 8 h |
| Combien | 2 plis (50 %), 3 (35 %) ou 4 (15 %), tirés par la graine (`unitDraw(seed, "plis", jour)`) |
| Sortes | lettre (petit objet, se met au sac), paquet (au sac), gros colis (porté à deux, comme `heavy_parcel`; au plus un par jour, 20 % des jours) |
| Destinataire | un habitant tiré parmi ceux qui ont une porte sur la carte: Odette (`grocery_door`), Basile (atelier), Achille (`bakery_window`), Solange et Jeanne (`lucie_house_door` et `salon_counter`), Firmin jamais (il trie) |
| Livrer | donner le pli à l'habitant (choix « Donner », règle existante) ou le glisser à sa porte: Espace devant la porte avec le pli en main. Le pli porte le nom du destinataire dans son libellé (« lettre pour Basile ») |
| Prendre | Agir sur la sacoche: chaque joueur prend les plis qu'il veut (on se répartit le bourg à voix haute) |
| Avant 18 h | payé à la livraison; avant midi, +3 aubrins (« Le courrier est passé tôt ! ») |
| Après 18 h | Firmin reprend les plis non livrés et les porte lui-même le lendemain: rien n'est perdu, rien n'est payé, aucun message de reproche (« Firmin a repris la sacoche. Il fera le reste demain. ») |

| Pli | Paie (aubrins) | Raison |
|---|---|---|
| Lettre | 6 | une course de 30 s, le prix d'un pain et d'un peu plus |
| Paquet | 12 | un détour plus long (rue Haute) |
| Gros colis (à deux) | 30 | deux joueurs mobilisés, porter à 0,9 m/s chacun |

Environ 90 aubrins par semaine pour un duo médian (60 % des plis): une petite source, régulière, qui fait traverser le bourg et croiser les habitants.

### 2.5 Conserves, fromages et petit artisanat (activité A2)

**Raison d'être.** La cueillette et les produits des bêtes se vendent mieux transformés, et l'étal du dimanche demande des produits qui se gardent. Le réchaud de la maisonnette et l'établi de Basile suffisent; deux ingrédients nouveaux s'achètent chez Odette.

| Ingrédient (`objets.json`) | Prix d'achat | Où | Raison |
|---|---|---|---|
| sucre (`sugar`, « paquet de sucre ») | 3 | Odette | une confiture demande du sucre; petit coût, vraie décision |
| bocal (`jar`, « bocal ») | 2 | Odette | le pot part avec la confiture |
| Sac de grain | 25 | Odette | 30 rations (section 4.2) |

| Recette (`recipes`) | Poste | Entrées | Sortie | Secondes | Prix de vente (`sellPrice`) |
|---|---|---|---|---|---|
| Confiture de mûres (`cook_blackberry_jam`) | réchaud | 8 mûres, 1 sucre, 2 bocaux | 2 pots de confiture de mûres | 6 | 20 |
| Gelée de sureau (`cook_elder_jelly`) | réchaud | 6 grappes de sureau, 1 sucre, 2 bocaux | 2 pots de gelée de sureau (objet existant) | 6 | 18 |
| Noisettes grillées (`cook_roasted_hazelnuts`) | réchaud | 8 noisettes | 1 cornet de noisettes grillées | 4 | 30 |
| Poêlée de girolles (`cook_chanterelle_pan`) | réchaud | 3 girolles, 1 œuf | 2 poêlées de girolles (plat simple, Ventre +30) | 4 | 22 |
| Fromage frais (`cook_fresh_cheese`) | réchaud | 2 bidons de lait | 1 fromage frais | 4 | 24 |
| Cagette (`craft_crate`) | établi | 2 planches, 1 clou | 1 cagette | 4 | 14 |
| Nichoir (`craft_nest_box`) | établi | 3 planches, 2 clous | 1 nichoir (décoration murale ou de jardin, beauté 2) | 6 | 30 |
| L'étal (`craft_market_stall`, quête) | établi | 8 planches, 4 clous | 1 étal (porté à deux) | 10 | invendable |

Règle commune: à deux devant le même réchaud ou le même établi, la durée est divisée par deux (règle `building.twoPlayersSpeedMultiplier` déjà en place pour bâtir, étendue à ces recettes). Valeur ajoutée d'une confiture: 8 mûres vendues à Odette font 19, deux pots font 32 chez elle et 50 à l'étal en « Juste », moins 7 de sucre et de bocaux.

### 2.6 La pêche, comme source de revenus

La pêche (vingt poissons, cinq raretés, ombres, zones poissonneuses) est conçue dans `peche-0-12-conception.md`; ses prix priment. Ce document lui demande seulement:

| Ce que l'économie attend de la pêche | Valeur visée |
|---|---|
| Revenu espéré d'un duo médian | environ 25 aubrins par jour de jeu (10 % des revenus), avec un pic rare de 150 et plus |
| Offre chez Odette | saturations de 2.2 (communs 8, rares 3, épiques et au-delà 1) |
| Marché | Firmin cherche truite et chevesne; les poissons rares ne sont pas demandés au marché (on les montre, on les vend à Odette ou on les garde) |
| Si la table de la pêche s'écarte de plus de 50 % | relancer `v0_12_economie.py` avec la nouvelle valeur (`peche` des profils) |

### 2.7 Dépenses nouvelles (puits utiles)

| Achat | Prix (aubrins) | Où | Ce que ça change | Raison du prix |
|---|---|---|---|---|
| Chevrerie (chantier) | 600 | à Basile, file nouvelle `elevage`, plus 10 planches (10 de moins chacune, 20 au plus, règle existante) | abri de la chèvre, ouvre la quête de la chevrette | une demi-semaine de commande: un but rapide de la semaine qui vient |
| Chevrette (quête) | 250 | Firmin, arrive par le train | la première chèvre | prix d'une poule: le duo ne doit pas hésiter |
| Deuxième chèvre | 450 | catalogue, automne semaine 1 | lait doublé | un vrai choix contre une poule de plus |
| Poulailler agrandi (chantier) | 800 | Basile, file `elevage`, plus 8 planches | 9 poules au lieu de 5 | il ne sert qu'avec la couvée: on l'achète quand on en a besoin |
| Mangeoire à trémie | 120 | catalogue, été semaine 2 | plus besoin de jeter le grain chaque jour: la trémie nourrit à l'aube tant qu'il reste des rations | confort: un geste en moins pour qui veut |
| Balance de marché | 180 | catalogue, été semaine 1 | une unité de plus par habitant pour les légumes et cueillettes | se rembourse en 4 à 6 marchés |
| Halle du marché (chantier du bourg, `order` 5) | 2 400 | souscription au tableau (file `bourg`, après le réverbère) | un toit de charpente sur l'étal: la pluie n'éloigne plus personne, et chaque habitant prend une unité de plus | le dernier grand but d'épargne de l'automne |
| Décoration (catalogue): fanions de toile pour la façade 60, pot de géraniums 35, volets repeints 150 (trois couleurs), banc de jardin 120, nichoir peint 45, lanterne de porche 90, peinture du poulailler 80, plaque au nom de la chèvre 40 | 620 en tout | catalogue, pages nouvelles | beauté de la maison (règle existante) | petits plaisirs, à acheter quand on veut |
| Sucre, bocaux, grain | 3, 2, 25 | Odette | consommables | petits coûts qui donnent un prix aux transformations |
| P1: enfumoir 60, ruche 150 (trois au plus), essaims 120 chacun | 870 en tout | catalogue | miel (section 4.4) | si le lot P1 sort |

### 2.8 Résultats de la simulation

`python3 -I docs/jeux/jeu-1/simulations/v0_12_economie.py --graines 1000` (4 s). Hypothèses: commande calée sur le tour 9 (540 et 990 aux jours 8 et 15, puis environ 1 150 par samedi pour un duo médian), annonces dès le jour 16, quêtes anciennes 350 et nouvelles de la section 5 (790 dans le script, 850 dans les tables: écart négligeable), pêche à 15, 25 et 40 aubrins par jour selon le duo (hypothèse), achats dans l'ordre des envies en gardant 150 de réserve (règle des robots du tour 9), deux ordres de priorité. Partie 0: aucun écart entre les tables et le script.

Bourse médiane (aubrins), duo médian:

| Jour | 1 | 8 | 15 | 22 | 29 | 36 | 43 | 50 | 57 | 64 |
|---|---|---|---|---|---|---|---|---|---|---|
| L'élevage d'abord | 239 | 367 | 205 | 267 | 505 | 419 | 828 | 1 760 | 1 482 | 4 174 |
| La maison d'abord | 173 | 201 | 311 | 331 | 286 | 428 | 818 | 1 746 | 625 | 3 282 |

| Duo, ordre | Revenus j1 à j64 | Part des achats faits au jour 64 (médiane; P10) | Chevrerie (jour médian) | Halle du marché (jour médian; avant le 64) |
|---|---|---|---|---|
| tranquille, l'élevage d'abord | 15 800 | 81 %; 81 % | 14 | après 64; 35 % |
| tranquille, la maison d'abord | 15 400 | 91 %; 76 % | 36 | 64; 52 % |
| médian, l'élevage d'abord | 20 800 | 100 %; 100 % | 13 | 53; 100 % |
| médian, la maison d'abord | 19 900 | 100 %; 100 % | 22 | 53; 100 % |
| assidu, l'élevage d'abord | 24 900 | 100 % | 13 | 45; 100 % |

Parts des revenus, duo médian: commande 44 à 46 %, marché 10 %, pêche 10 %, chèvre 5 à 8 %, Odette 7 %, quêtes 5 à 6 %, plis 5 %, œufs nouveaux (belle qualité, poules nées ici) 5 %, annonces 5 %, conserves 1 % (sous-estimées: le modèle ne compte que les mûres et le sureau). Le grain coûte environ 210 aubrins sur la partie, les dépenses courantes 770.

Lecture: jusqu'au jour 43, la bourse médiane reste sous 900: l'argent sert, on choisit. La chevrerie arrive dans la semaine qui suit la quête (jour 13 en médiane), ce que veut la trame. Aucune source nouvelle ne dépasse 10 %: chaque activité vaut d'être faite, aucune n'est obligatoire. Limite assumée: après le jour 50, un duo médian a tout acheté et la bourse remonte (3 300 à 4 200 au jour 64). Le levier pour la suite est du contenu (hiver, ruches, étape 3 du monde: le moulin), pas une baisse des revenus; la halle à 2 400 est le dernier but. Si le client trouve l'argent trop facile, la première valeur à bouger est le facteur « Juste » du marché (1,25 vers 1,15).

## 3. Activités nouvelles: récapitulatif

| # | Activité | Geste | Raison d'être dans le bourg | À deux | Section |
|---|---|---|---|---|---|
| A1 | Le marché du dimanche | garnir l'étal, choisir le prix, servir (Espace) | la place avait son marché; Odette ne peut pas quitter la boutique | deux files, l'un sert, l'autre va chercher | 2.3 |
| A2 | Conserves, fromages, artisanat | maintenir Agir au réchaud ou à l'établi | la cueillette se perd si on ne la garde pas; l'étal veut des produits qui se gardent | deux fois plus vite à deux | 2.5 |
| A3 | Les plis de Lucie | prendre à la sacoche, donner ou glisser à la porte | la factrice est en tournée, Firmin ne quitte pas le quai | on se répartit le bourg; le gros colis se porte à deux | 2.4 |
| A4 | L'ardoise d'Odette | lire l'ardoise, vendre au comptoir | Odette cherche chaque jour un produit pour ses clients | l'un regarde l'ardoise en passant et le dit à l'autre | 2.2 |
| A5 | Élevage | nourrir, pailler, caresser, mener la chèvre, traire | la maison de garde-barrière a toujours eu sa basse-cour et sa chèvre sur le talus | l'un tient la chèvre, l'autre trait; l'un nourrit, l'autre ramasse | 4 |
| A6 | La pêche | (autre document) | | | 2.6 |

## 4. L'élevage

### 4.1 Principe

Des bêtes qu'on soigne parce qu'on les aime, jamais par peur. Aucune bête ne meurt, ne tombe malade, ne s'enfuit pour de bon ni ne se vend. Négliger une bête la rend un peu moins productive et un peu moins gaie, jamais plus bas qu'un plancher; un jour de soin suffit à le voir. Le bonheur se lit sans chiffre: posture et petit mot au survol (« Ravie », « Tranquille », « Ébouriffée » pour une poule; « Gaie », « Tranquille », « Boudeuse » pour la chèvre).

### 4.2 Les poules

État existant: trois poules (Bichette, Cocotte, la Duchesse) au poulailler réparé, une poule de plus au catalogue (Brioche, rousse; Pervenche, blanche), 5 au plus, un œuf par poule nourrie et par jour (`reglages.hens`).

| Réglage (`reglages.hens`) | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Bonheur de départ | 60 (poules existantes, à la migration); 55 (nouvelles) | points sur 100 | | « Tranquille »: rien ne change pour qui ne fait que nourrir |
| Dérive du bonheur (poules) | -6 | points par aube | -4 à -10 | la journée passe |
| Nourries | +6 | points, si nourrie la veille | 4 à 8 | nourrir seul compense la dérive: le minimum garde la poule telle qu'elle est |
| Paille fraîche | +4 | points par aube, si la litière a été changée il y a 3 jours au plus | 2 à 6 | le soin de plus qui fait monter |
| Caresse | +3 | points, une fois par joueur, par poule et par jour | 2 à 5 | geste doux, deux fois plus à deux |
| Appeler par son nom (secret des noms connu) | +2 | points, une fois par jour | | récompense la quête des noms |
| Plancher | 30 | points | 20 à 40 | jamais de punition dure |
| Œuf un jour sur deux en dessous de | 40 | points | | la seule conséquence de la négligence |
| Bel œuf (qualité `fine`, x 1,5) à partir de | 80 | points | 70 à 90 | le soin se voit au panier |
| Couveuse possible à partir de | 70 | points | | une poule heureuse veut couver |
| Sans grain | pas d'œuf (règle existante); au printemps et en été, un œuf un jour sur deux (« elles picorent le pré ») | | | plus doux qu'aujourd'hui |
| Grain | 1 ration par poule et par jour, au sac de grain (25 aubrins les 30 rations, chez Odette; un sac offert à la migration et à la fin de `hens`) | | | 0,8 aubrin par œuf qui en vaut 6,4 chez Odette |
| Capacité | 5, puis 9 (poulailler agrandi) | poules | | règle existante, puis le chantier |

Gestes: **jeter le grain** (Espace devant la mangeoire, sac de grain au sac; existant, il consomme maintenant les rations), **pailler** (Agir sur la botte de paille de la remise puis sur le poulailler: 3 s; la litière change de couleur, de jaune pâle à jaune doré), **caresser** (Espace sur une poule à moins de 1,2 m: elle s'accroupit, petit gloussement, deux petits cœurs chez celui qui caresse), **ramasser** (existant).

**Le coq.** Donné par la quête `coq_arrive` (le cousin d'Odette l'envoie par le train): un coq doré, nommé par le duo (choix parmi trois noms, table 4.5). Il chante à l'aube (6 h, chez les deux joueurs, plus fort près de la maisonnette), ne pond pas, ne compte pas dans la capacité. Sans coq, pas de couvée.

**La couvée.**

| Règle | Valeur |
|---|---|
| Lancer | Agir sur le nid avec au moins 3 œufs dans le sac: menu « Mettre à couver » qui liste les poules à 70 ou plus. La poule choisie s'installe au nid (posture gonflée) |
| Saison | printemps, été, automne jusqu'au jour 14 de la saison |
| Place | refusé si poules + poussins + 3 dépasse la capacité (« Le poulailler est plein: il faudrait l'agrandir. ») |
| Durée | 7 nuits (`broodNights`); la couveuse ne pond pas pendant ce temps |
| Éclosion | à l'aube de la 8e journée, chacun des 3 œufs éclot avec 75 % de chances; scène à deux si les deux joueurs passent au poulailler avant midi (« Trois petits becs ! »), sinon simple message |
| Coquelets | un poussin sur quatre est un coquelet: à la première aube, le cousin d'Odette le reprend à la ferme (« Un coquelet ! Le cousin d'Odette le prendra: là-haut, il sera roi. ») et laisse un sac de grain. Aucune vente, aucune viande |
| Croissance | les poussines suivent leur mère 10 nuits (`growNights`), puis deviennent poules et pondent |
| Noms | chaque poussine reçoit un nom à l'éclosion: les joueurs nomment à tour de rôle (le premier joueur de la liste la première), choix parmi trois noms tirés de la table 4.5 |

**Les six couleurs** (collection « La basse-cour », onglet du carnet, une case par couleur): blanche, rousse, noire (existantes), dorée (celle du coq), cendrée (gris-bleu), coucou (rayée gris et blanc). Couleur d'une poussine: celle de la mère 60 %, dorée 25 %, et 15 % une couleur tirée parmi celles que la basse-cour n'a pas encore (si toutes y sont: parmi toutes), pour que la collection se finisse sans traîner (règle du coup de pouce du carnet).

### 4.3 La chèvre

**Raison d'être.** Les gardes-barrières gardaient souvent une chèvre qui broutait le talus de la voie: l'herbe y est gratuite, et le lait fait le fromage. Firmin s'en souvient (quête principale 5).

| Élément | Règle |
|---|---|
| Chevrerie | cabane de planches de 2 x 2 m, toit à une pente, porte à mi-hauteur, à l'est de la maisonnette au pied du talus, porte tournée vers la maison (on la voit de la fenêtre est). Construite par Basile (file `elevage`), parait au matin |
| Piquet | la chèvre broute attachée à un piquet, corde de 2,5 m. Cinq places de pâture (`goat_graze_01` à `_05`) sur le talus côté maison et le pré, chacune à plus de 3,5 m du rail le plus proche: la corde ne laisse jamais la chèvre atteindre la voie (Firmin y tient, quête `firmin_goat_rope`). Le level designer place les points et le vérifie par l'outil de la carte |
| Déplacer le piquet | Agir sur le piquet: le joueur prend la corde, la chèvre le suit (à 1,5 m, vitesse de marche x 0,8); Agir sur une place libre: il plante le piquet. Une place broutée la veille ou l'avant-veille montre une herbe rase |
| Le soir | à 20 h, la chèvre rentre seule à la chevrerie (« elle connaît le chemin »), le piquet reste; à 7 h, elle ressort au dernier piquet |
| Eau | puiser un seau au puits (Agir sur le puits), le verser dans le baquet de la chevrerie |
| Brosser | Espace sur la chèvre avec la brosse (donnée avec la chevrette), une fois par joueur et par jour |
| Traire | de 6 h à 11 h, une fois par chèvre et par jour: maintenir Espace 6 s seul; si l'autre joueur tient la chèvre (Espace près de sa tête, « Tenir la chèvre »), 3 s et +2 de bonheur. Donne 1 bidon de lait (2 à partir de 80 de bonheur) |
| Nombre | 1 (quête), puis 2 (catalogue) |
| Fromage | 2 bidons de lait au réchaud: 1 fromage frais (section 2.5) |

| Réglage (`reglages.goats`) | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Bonheur de départ | 55 | points | | « Tranquille » |
| Dérive | -6 | par aube | -4 à -10 | comme les poules: une règle à retenir |
| Pâture fraîche (place non broutée depuis 2 jours) | +6 | par aube | 4 à 8 | déplacer le piquet chaque jour compense la dérive |
| Eau versée la veille | +4 | | 2 à 6 | |
| Brossage | +3 par joueur | | | |
| Traite tenue à deux | +2 | | | |
| Plancher | 30 | points | | |
| Lait | aucun sous 40; 1 bidon de 40 à 79; 2 à partir de 80 | bidons par jour | | une chèvre boudeuse ne donne rien, sans autre suite |
| Lait (`sellPrice`) | 9 | aubrins | | 2 bidons en fromage font 24 au lieu de 18 |
| Nourriture | l'herbe de la pâture (gratuite); en hiver, foin (hors périmètre: la partie finit au jour 64) | | | aucune dépense obligatoire |

### 4.4 Les ruches (P1, si le temps le permet)

Trois ruches au plus, en bout de potager, entrée tournée vers le sud-est (soleil du matin), à plus de 4 m de la porte et du chemin. Chaque ruche donne 2 pots de miel (`sellPrice` 30) tous les 7 jours au printemps et en été, 1 en automne; récolte avec l'enfumoir: l'un enfume (Espace maintenu), l'autre lève les cadres (3 clics); seul, deux fois plus long, « les abeilles bourdonnent fort » (aucune piqûre, aucun dégât). Achille et Solange cherchent le miel au marché. Si le lot P1 ne sort pas, rien ailleurs n'en dépend.

### 4.5 Noms proposés

Chevrettes (trois proposés): Noisette, Bergamote, Réglisse, Châtaigne, Quenotte, Biscotte. Coq: Gaspard, Hector, Fanfaron, Cacahuète, Sultan, Panache. Poussines (40, tirées sans redite): Praline, Pâquerette, Capucine, Mirabelle, Galette, Tartine, Brindille, Plumette, Cannelle, Pépite, Myrtille, Pistache, Clafoutis, Coquelicot, Marjolaine, Prunelle, Violette, Bise, Frisette, Caramel, Muscade, Paprika, Groseille, Câpre, Ficelle, Bobine, Dentelle, Rosée, Grêle, Aubépine, Églantine, Chicorée, Fauvette, Perlette, Nougatine, Gaufrette, Bergère, Mésange, Pivoine, Câline.

### 4.6 Cas limites

| Cas | Règle |
|---|---|
| Une partie reprise sans chevrerie ni coq | rien ne change aux poules sauf grain, paille, caresse; bonheur 60 |
| Deux joueurs traient la même chèvre | le premier qui maintient trait; l'autre voit « Tenir la chèvre » |
| Un joueur absent (règle d'absence) | les bêtes ne bougent pas; la chèvre reste au piquet; les gestes à deux se font seuls, plus lentement |
| La chèvre au piquet pendant le passage du train | aucune réaction, la corde la tient loin; elle lève la tête (petit geste) |
| Le piquet planté hors des places | refusé: « Pas ici: trop près de la voie » ou « Rien à brouter ici » |
| Sac plein à la traite | le bidon tombe au sol devant le joueur (règle des objets au sol) |

## 5. Quêtes

### 5.1 La trame: « Le marché d'Aubrune » (5 quêtes principales, une semaine de jeu)

Départ: à la première aube jouée avec la 0.12 à partir du jour 3 (dans une partie neuve, le jour 3; dans la partie du client, le premier matin de ce soir), lettre d'Odette `odette_market_letter`. Les étapes sont calées sur les jours de la semaine (dimanche du marché, samedi du train) et non sur des jours fixes: elles tiennent quel que soit le jour de départ. Une nouveauté par journée.

| Id | Titre | Donneur | Départ | Étapes (objectif du carnet) | Récompense | Forme |
|---|---|---|---|---|---|---|
| `market_stall` | L'étal du dimanche | Odette | lettre `odette_market_letter` lue | 1. Parler à Odette de l'ancien marché. 2. Fabriquer l'étal à l'établi de Basile: 8 planches, 4 clous. 3. Porter l'étal à deux jusqu'à la place. | 50 aubrins; l'étal est posé (drapeau `market_open`); l'ardoise d'Odette commence le lendemain | fabriquer, porter à deux |
| `market_first` | Le premier marché | Odette | `market_stall` finie | 1. Garnir l'étal avant dimanche 8 h (au moins 3 sortes). 2. Servir 4 habitants au marché du dimanche. | 80 aubrins; scène à deux à 13 h devant l'étal (`market_first_scene`): Odette, Firmin et Jeanne trinquent au sirop | servir à deux |
| `achille_oven` | La voûte du fournil | Achille | `market_first` démarrée, au plus tôt le lendemain de `achille_basket` | 1. Écouter Achille au guichet (la voûte du four est fêlée: plus de brioche pour le marché). 2. Commander les briques réfractaires à Firmin (40 aubrins). 3. Décharger la caisse de briques du train de samedi, à deux. 4. Réparer la voûte à deux: l'un tient le cintre (Espace maintenu), l'autre pose six briques (six clics). | 120 aubrins; Achille achète au guichet œufs, lait et noisettes au prix plein (`sellPrice` x 1,0, 6 unités par jour au plus); brioche au marché le dimanche | porter à deux, rôles partagés |
| `solange_garland` | Des fanions pour la place | Solange | `market_first` finie | 1. Apporter à Solange 3 coupons de toile (au catalogue, 10 aubrins pièce, ou 6 plumes de poule). 2. Revenir le lendemain chercher les fanions cousus. 3. Tendre les fanions entre le réverbère de la place et le tilleul, à deux: l'un tient l'échelle, l'autre noue (les deux au point 3 s). | 60 aubrins; les fanions flottent sur la place le dimanche; chaque habitant achète une unité de plus au marché; page « Fanions de toile » au catalogue | apporter, geste à deux |
| `goat_talus` | Une chèvre sur le talus | Firmin | `market_first` finie et lettre `firmin_goat_letter` (le lendemain) | 1. Écouter Firmin: l'ancien garde-barrière avait une chèvre. 2. Commander la chevrerie à Basile (600 aubrins et 10 planches). 3. Aller chercher la chevrette au train de samedi et la mener à deux jusqu'à la chevrerie (l'un tient la corde, l'autre marche derrière: elle ne suit que si les deux sont à moins de 4 m). 4. Lui donner un nom. 5. La traire une première fois. | 100 aubrins rendus par la coopérative; la chevrette (250, payés à Firmin à l'étape 3); recette du fromage frais | bâtir, mener à deux, choisir à deux |

Cas limites. Si le samedi tombe avant que les briques ou la chevrette soient commandées, elles arrivent au samedi suivant (le texte de Firmin le dit). Si personne n'est au train, la caisse ou la chevrette attend au quai, sous la garde de Firmin, jusqu'au lendemain 18 h, puis chez Firmin (« Elle broute devant la halte, viens quand tu veux »); jamais perdue. Bourse trop basse pour la chevrerie: la quête attend, sans échéance. Un seul joueur connecté: les étapes à deux attendent l'autre (règle existante); le reste avance.

Textes de départ:

| Clé | Texte |
|---|---|
| `odette_market_letter` (lettre, Odette) | « Le dimanche, autrefois, la place sentait la fraise et le pain chaud. Il y avait des tréteaux partout. Moi, je ne peux pas quitter ma boutique. Mais vous, avec votre potager... Passez me voir. O. » |
| `market_first_scene` | Odette: « Quatre clients, et on m'a demandé où vous étiez. Ça faisait longtemps. » Firmin: « Au marché d'Aubrune ! » Jeanne: « Et au sirop ! » |
| `achille_oven_ask` | « La voûte est fêlée. Le pain passe encore, mais la brioche, elle sent le moindre courant d'air. Il me faudrait des briques réfractaires, et quatre mains. » |
| `solange_garland_ask` | « Une place sans fanions, c'est une scène sans rideau. Apporte-moi de la toile, je couds; et puis il faudra grimper. » |
| `firmin_goat_letter` (lettre, Firmin) | « Ta maisonnette avait une chèvre, du temps de l'ancien garde-barrière. Elle broutait le talus et ne passait jamais la voie: corde courte, disait-il. Une ferme des Combes en a une à placer. F. » |
| `goat_named` (message) | « {name} broute déjà. » |

### 5.2 Quêtes secondaires (9)

Au format de `quetes.json` (`kind: "side"`, conditions du `README.md`). Les conditions marquées d'un astérisque dans la colonne « nouveau » de la section 6 sont à ajouter au moteur.

```json
[
  {
    "id": "coq_arrive", "kind": "side", "tier": "P0", "title": "Un coq pour la basse-cour", "giver": "odette",
    "start": { "when": [{ "type": "quest_done", "quest": "hens" }, { "type": "quest_active", "quest": "market_first" }] },
    "steps": [
      { "id": "train", "objective": "Aller chercher la cage du coq au train de samedi.", "conditions": [{ "type": "item_in_bag", "item": "rooster_crate", "count": 1, "who": "either" }] },
      { "id": "coop", "objective": "Le lâcher au poulailler.", "conditions": [{ "type": "animal_released", "animal": "rooster", "point": "chicken_coop" }] },
      { "id": "name", "objective": "Lui choisir un nom, à deux.", "conditions": [{ "type": "animal_named", "animal": "rooster" }] }
    ],
    "completionEffects": [{ "type": "set_flag", "flag": "brood_enabled" }, { "type": "give_item", "item": "grain_sack", "count": 1, "to": "cellar" }],
    "completionText": "Un coq chante à l'aube. Les poules peuvent couver."
  },
  {
    "id": "first_brood", "kind": "side", "tier": "P0", "title": "La première couvée", "giver": "jeanne",
    "start": { "when": [{ "type": "flag", "flag": "brood_enabled" }, { "type": "season_is", "seasons": ["spring", "summer", "autumn"] }] },
    "steps": [
      { "id": "brood", "objective": "Mettre une poule heureuse à couver (3 œufs au nid).", "conditions": [{ "type": "brood_started" }] },
      { "id": "hatch", "objective": "Être là tous les deux à l'éclosion, au poulailler.", "conditions": [{ "type": "brood_hatched" }, { "type": "stayed_at", "point": "chicken_coop", "seconds": 3, "who": "both" }] }
    ],
    "completionEffects": [{ "type": "give_item", "item": "jeanne_chick_drawing", "count": 1, "to": "cellar" }, { "type": "give_money", "amount": 40 }],
    "completionText": "Jeanne a dessiné les poussines. 40 aubrins de Jeanne, « pour le grain »."
  },
  {
    "id": "jeanne_shuttlecock", "kind": "side", "tier": "P0", "title": "Le jeu de volant de Jeanne", "giver": "jeanne",
    "start": { "when": [{ "type": "day_at_least", "day": 4 }, { "type": "flag", "flag": "eggs_enabled" }] },
    "steps": [
      { "id": "feathers", "objective": "Ramasser 4 plumes de poule au poulailler et les donner à Jeanne.", "conditions": [{ "type": "given", "villager": "jeanne", "item": "hen_feather", "count": 4, "label": "4 plumes" }] },
      { "id": "play", "objective": "Jouer au volant avec Jeanne sur la place, à deux.", "conditions": [{ "type": "scene_played", "dialogue": "jeanne_shuttlecock_scene", "since": "step_start" }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 30 }],
    "completionText": "Le volant est monté jusqu'au toit de l'épicerie. 30 aubrins."
  },
  {
    "id": "achille_eggs", "kind": "side", "tier": "P0", "title": "Douze œufs pour la brioche", "giver": "achille",
    "start": { "when": [{ "type": "quest_done", "quest": "achille_oven" }, { "type": "weekday_is", "weekdays": ["thursday", "friday"] }] },
    "steps": [
      { "id": "bring", "objective": "Apporter 12 œufs à Achille avant dimanche 6 h.", "conditions": [{ "type": "given", "villager": "achille", "item": "egg", "count": 12, "label": "12 œufs" }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 120 }, { "type": "give_item", "item": "brioche", "count": 1, "to": "each" }],
    "completionText": "La brioche du dimanche est sauvée. 120 aubrins et une brioche à chacun."
  },
  {
    "id": "lucie_round", "kind": "side", "tier": "P0", "title": "La tournée de Lucie", "giver": "firmin",
    "start": { "when": [{ "type": "day_at_least", "day": 4 }, { "type": "quest_done", "quest": "meet_village" }, { "type": "time_is", "from": "08:00", "to": "12:00" }] },
    "steps": [
      { "id": "bag", "objective": "Prendre la sacoche de Lucie sur le banc du quai.", "conditions": [{ "type": "item_in_bag", "item": "mail_letter", "count": 1, "who": "either" }] },
      { "id": "deliver", "objective": "Livrer les 3 plis, dont le gros colis à deux, avant 18 h.", "conditions": [{ "type": "delivered", "count": 3, "since": "step_start" }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 50 }, { "type": "set_flag", "flag": "mail_round_open" }],
    "completionText": "Firmin vous laisse la sacoche: chaque matin sauf le dimanche, des plis à livrer."
  },
  {
    "id": "market_crates", "kind": "side", "tier": "P0", "title": "Des cagettes pour l'étal", "giver": "basile",
    "start": { "when": [{ "type": "quest_done", "quest": "market_stall" }] },
    "steps": [
      { "id": "craft", "objective": "Fabriquer 4 cagettes à l'établi (2 planches et 1 clou chacune).", "conditions": [{ "type": "crafted", "recipe": "craft_crate", "count": 4 }] },
      { "id": "give", "objective": "Les poser sur l'étal.", "conditions": [{ "type": "given_to_stall", "item": "crate", "count": 4 }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 30 }, { "type": "set_flag", "flag": "stall_six_slots" }],
    "completionText": "L'étal a six cagettes."
  },
  {
    "id": "market_rush", "kind": "side", "tier": "P0", "title": "Le coup de feu du marché", "giver": "odette",
    "start": { "when": [{ "type": "quest_done", "quest": "market_first" }, { "type": "weekday_is", "weekdays": ["saturday"] }] },
    "steps": [
      { "id": "rush", "objective": "Dimanche, servir deux habitants arrivés ensemble, chacun le sien.", "conditions": [{ "type": "market_served", "together": true }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 60 }],
    "completionText": "Deux clients à la fois, et personne n'a attendu. 60 aubrins de la part d'Odette."
  },
  {
    "id": "firmin_goat_rope", "kind": "side", "tier": "P0", "title": "Corde courte", "giver": "firmin",
    "start": { "when": [{ "type": "quest_done", "quest": "goat_talus" }] },
    "steps": [
      { "id": "graze", "objective": "Planter le piquet à 3 places différentes, 3 jours de suite.", "conditions": [{ "type": "goat_grazed_spots", "count": 3, "since": "step_start" }] }
    ],
    "completionEffects": [{ "type": "give_item", "item": "goat_bell", "count": 1, "to": "cellar" }, { "type": "give_money", "amount": 40 }],
    "completionText": "Firmin offre une clochette: on entend la chèvre de partout."
  },
  {
    "id": "odette_cheese", "kind": "side", "tier": "P0", "title": "Le fromage d'Odette", "giver": "odette",
    "start": { "when": [{ "type": "quest_done", "quest": "goat_talus" }, { "type": "nights_passed", "count": 2 }] },
    "steps": [
      { "id": "bring", "objective": "Apporter 2 fromages frais à Odette.", "conditions": [{ "type": "given", "villager": "odette", "item": "fresh_cheese", "count": 2, "label": "2 fromages frais" }] }
    ],
    "completionEffects": [{ "type": "give_money", "amount": 70 }],
    "completionText": "Le fromage est en vitrine. 70 aubrins."
  }
]
```

Notes pour le lot L-quêtes: `nights_passed` dans un `start` doit compter depuis la fin de `goat_talus` (sinon le remplacer par `day_at_least` calculé au démarrage); `who: "either"` est à ajouter à `item_in_bag` s'il n'existe pas; `achille_eggs` se clôt seule, sans reproche, dimanche 6 h si les œufs ne sont pas là (`resolve: "at_deadline"`, `onDeadline` vide, message « Achille a fait sa brioche aux œufs d'Odette. Une autre fois ! »), et peut revenir la semaine suivante.

Scène `jeanne_shuttlecock_scene` (à deux, sur la place): Jeanne lance le volant; chaque joueur appuie sur Espace quand il passe au-dessus de lui (fenêtre de 0,8 s, trois échanges); chaque échange réussi donne une réplique de Jeanne; un raté donne « Encore ! » et on recommence; la scène finit après trois échanges réussis ou cinq essais (« On reprendra demain, j'ai mal au bras »), toujours réussie.

Plumes de poule (`hen_feather`): une plume tombe au sol de l'enclos chaque matin avec 30 % de chances par poule à 60 de bonheur ou plus (deux au plus par jour); décoration (beauté 1) ou don.

## 6. Découpage pour les développeurs

Ordre: L-monnaie d'abord (une heure, tout le monde en dépend pour les textes), puis L-économie, L-élevage, L-quêtes et L-rendu-modèles en parallèle; intégration par le manager dans cet ordre: monnaie, économie, élevage, quêtes, rendu, son. Chaque lot ajoute ses réglages à `reglages.json` et ses textes à `textes.json` (clés propres au lot, pas de modification croisée).

### L-monnaie (dev gameplay, 1 h)

| Fichiers | Travail |
|---|---|
| `donnees/reglages.json` (`economy.currency`), `src/donnees/contenu.ts`, `src/donnees/types.ts` | `icon`, validation |
| `src/interface/modele.ts`, `typographie.ts`, `panneaux.ts`, `modele-tableau.ts`, `modele-salon.ts`, `modele-maison.ts`, `refus.ts` | `formatMoney(n)` lu des réglages, accord 0 et 1 au singulier, découpage montant et unité |
| `donnees/*.json` (courrier, textes, quêtes, habitants, astuces) | règle 1.3, script de liste à relire |
| `donnees/courrier.json` | lettre `firmin_aubrin` (section 1.1), à la première aube jouée en 0.12 |
| `outils/valider_donnees.py` | avertissement `[0-9}] sous` |
| `tests/` | phrases exactes mises à jour |
| interface | icône `ui_coin_aubrin.svg` (artiste 2D) au HUD de la bourse |

Critères: CA-M1 aucun `[0-9}] sous` dans `donnees/` ni dans les chaînes de `src/` (grep); CA-M2 « sous la pluie » et les 10 autres prépositions toujours là (grep compté avant et après: même nombre); CA-M3 `formatMoney(0)`, `(1)`, `(2)`, `(1200)` donnent « 0 aubrin », « 1 aubrin », « 2 aubrins », « 1 200 aubrins » (test unitaire); CA-M4 une sauvegarde de format 8 se charge avec la même bourse (test sur `format-8-milieu-semaine-2.json`); CA-M5 la lettre `firmin_aubrin` arrive une fois, aussi dans une partie reprise.

### L-économie (dev gameplay, 3 h)

| Fichiers | Travail |
|---|---|
| `src/simulation/economie.ts`, `src/interface/modele-panneaux.ts`, `panneaux.ts` | prix d'Odette (2.2): saison, offre (`world.grocerSupply`, oubli à l'aube), ardoise (`world.ardoise { day, item, sold }`), mots du panneau, plafond 400 |
| `src/simulation/marche.ts` (nouveau), `src/etat/marche.ts` (pur), `donnees/marche.json` (nouveau: listes 2.3.1, prix, heures) | étal (cases, niveau de prix), arrivées des habitants (`unitDraw(seed, "marche", jour, habitant)`), file de deux, intention `market_serve`, fin à 13 h vers le cellier; entrée d'emploi du temps `market` des habitants le dimanche (`habitants.json`) |
| `src/simulation/plis.ts` (nouveau) | sacoche, tirage, livraison (`given` ou porte), paie, reprise à 18 h; objets `mail_letter`, `mail_parcel`, `mail_heavy` (porté à deux) |
| `donnees/objets.json` | sucre, bocal, sac de grain, confiture, noisettes grillées, poêlée de girolles, bidon de lait, fromage frais, cagette, nichoir, étal, plume, coupon de toile, clochette; `sellPrice` de la gelée de sureau (18); recettes 2.5 |
| `donnees/catalogue.json` | pages nouvelles: été semaine 1 (balance), semaine 2 (mangeoire), automne semaine 1 (deuxième chèvre); décoration 2.7 répartie |
| `donnees/chantiers.json` | `market_hall` (file `bourg`, `order` 5, 2 400), file `elevage` (`goat_shed` 600, `coop_extension` 800) |
| Événements | `ardoise_posted`, `market_buyer_arrived`, `market_sale { by, villager, items, amount }`, `market_refused`, `market_closed`, `mail_ready`, `mail_delivered { by, villager, amount }`, `mail_returned` |

Critères: CA-E1 vendre 20 radis de base 7 le même jour donne 90 aubrins, et le lendemain le premier radis vaut 4 (compteur 10 après l'oubli, offre 0,8) (test unitaire); CA-E2 l'ardoise ne montre jamais un article jamais obtenu ni le même deux jours de suite (robot 64 jours, 20 graines); CA-E3 au marché, sans joueur derrière l'étal, aucun objet ne sort et aucun aubrin n'entre; l'objet reste et retourne au cellier à 13 h (test); CA-E4 deux joueurs servent deux habitants en même temps, deux ventes dans le même tick (test); CA-E5 un pli non livré à 18 h ne paie rien et revient le lendemain (test); CA-E6 la partie 0 de `v0_12_economie.py` affiche « aucun écart » après les réglages livrés (valeurs des tables = `reglages.json`); CA-E7 robot médian: bourse jamais négative, au moins 35 % de la bourse dépensée par semaine en moyenne jours 22 à 50 (critère O-11 du tour 9).

### L-élevage (dev gameplay 3D et interface, 4 h)

| Fichiers | Travail |
|---|---|
| `src/simulation/basse-cour.ts` (nouveau, ou l'existant des poules) | bonheur des poules (4.2), grain en rations, paille (`world.coopStrawDay`), caresse, plumes, couvée, poussins, coquelets, couleurs, noms; `reglages.hens` complété |
| `src/simulation/chevres.ts` (nouveau), `reglages.goats` | piquet, places, corde, retour du soir, eau, brosse, traite seul ou à deux (intention `goat_hold`), lait |
| `src/etat/types.ts`, sauvegarde | format 9: `hens[i].happiness`, `brood`, `chicks`, `rooster`, `goats[]`, `grocerSupply`, `ardoise`, `market`, `mail`; migration depuis le 8 (bonheur 60, un sac de grain au cellier) |
| Interface | survol des bêtes (nom, mot du bonheur, « pas encore nourrie aujourd'hui »), menu « Mettre à couver », nommage à deux (choix parmi trois, à tour de rôle, visible des deux), onglet « La basse-cour » du carnet (six couleurs) |
| Carte (`construire_carte_halte.py`, level designer) | points `goat_graze_01` à `_05`, `goat_shed`, `coop_nest`, `straw_bale` (remise), `market_stall`, `market_stall_stored`, `mail_bag` (`quay_bench`); vérifier corde de 2,5 m à plus de 1 m du rail |

Critères: CA-L1 une poule seulement nourrie garde son bonheur (60 reste 60 sur 10 jours, test); CA-L2 aucune poule ni chèvre ne descend sous 30, même 30 jours sans soin (test); CA-L3 aucune bête ne disparaît jamais de l'état, hors coquelet le matin de son éclosion (robot 64 jours); CA-L4 couvée: 3 œufs, 7 nuits, 0 à 3 poussines, jamais plus que la capacité (test sur 1 000 graines: moyenne 2,25 éclos, 1,7 poussine); CA-L5 la corde ne laisse jamais la chèvre à moins de 1 m d'un rail (contrôle de la carte); CA-L6 traire à deux prend 3 s et seul 6 s (test); CA-L7 le nom choisi par l'un s'affiche chez l'autre dans la seconde (test réseau à deux clients); CA-L8 sauvegarde 8 vers 9: aucune perte, bonheur 60 (test de migration).

### L-quêtes (dev gameplay, 2 h, après L-économie et L-élevage pour les conditions)

| Fichiers | Travail |
|---|---|
| `donnees/quetes.json` | 5 principales (5.1) et 9 secondaires (5.2) |
| `donnees/courrier.json`, `habitants.json`, `textes.json` | lettres `odette_market_letter`, `firmin_goat_letter`; dialogues `*_ask`, scènes `market_first_scene`, `jeanne_shuttlecock_scene`, réparation de la voûte (cintre et briques), fanions (échelle et nœud), menée de la chevrette |
| Moteur de quêtes (`src/simulation/quetes.ts`) | conditions nouvelles: `animal_released`, `animal_named`, `brood_started`, `brood_hatched`, `delivered`, `given_to_stall`, `market_served` (`together`), `goat_grazed_spots`; `who: "either"` pour `item_in_bag`; objets de quête `rooster_crate`, `brick_crate` (porté à deux), `goat_lead` |
| Validateur | conditions nouvelles connues |

Critères: CA-Q1 dans une partie au jour 10 (sauvegarde de référence), la lettre d'Odette arrive à la première aube et la trame se finit en 8 jours de jeu au plus par le robot assidu (robot); CA-Q2 chaque quête principale se termine avec un seul joueur connecté jusqu'à son étape à deux, qui attend sans échec (test); CA-Q3 aucune quête ne reste bloquée si un samedi est manqué (robot qui saute un train); CA-Q4 toutes les récompenses en aubrins de la section 5 sont versées une fois (test); CA-Q5 le validateur ne lève aucune erreur ni avertissement de tournure genrée.

### L-rendu-modèles (artiste 3D et dev rendu, 4 h)

| Modèle | Détail | Pourquoi ainsi |
|---|---|---|
| Étal (`market_stall`) | planche de 2 m sur deux tréteaux, 0,85 m de haut, 4 à 6 cagettes, ardoise de prix; état replié contre le mur de l'épicerie | hauteur d'un plan de travail; replié, il ne barre rien |
| Halle du marché (`market_hall`, P1 si le temps manque: le chantier peut sortir sans modèle en 0.12.1) | quatre poteaux, charpente à deux pentes, 4 x 3 m, au-dessus de l'étal | elle abrite l'étal et ses clients, pas plus |
| Chevrerie (`goat_shed`) | 2 x 2 m, toit à une pente vers le talus, porte à mi-hauteur côté maison, baquet | la pente rejette la pluie vers le talus, pas vers la porte |
| Chèvre (`goat`, squelette à quatre pattes) | animations `idle`, `walk`, `graze`, `milk_stand` (immobile, tête tenue), `bell` (clochette, nœud `socket_goat_neck`) | |
| Piquet et corde | piquet de 0,5 m, corde dessinée par le rendu du piquet au collier (ligne, comme la pêche) | la corde tendue montre la limite |
| Coq, poussins, couleurs | coq doré (plus grand que la poule, crête, queue en faucille), poussin (0,12 m), poules cendrée et coucou (variantes de `hen`) | |
| Ardoise d'Odette | ardoise sur pied à droite de la porte de l'épicerie, icône de l'article à la craie | lisible depuis la place au zoom 1 |
| Sacoche de Lucie | sacoche de cuir sur le banc du quai, de 8 h à la prise | |
| Mangeoire, litière | mangeoire à trémie (achat); litière qui change de couleur | le soin se voit |
| Fanions | guirlande tendue entre le réverbère de la place et le tilleul, le dimanche seulement | deux appuis réels |

Critères: CA-R1 budgets de la place au zoom 2, étal garni et fanions: au plus +4 appels de dessin et +6 000 triangles (mesure `triangleSplit()`); CA-R2 chaque modèle a son substitut dans `src/rendu/substituts.ts` (sinon `rendu.test.ts` échoue); CA-R3 revue de près: l'étal touche le sol par ses quatre pieds, la corde part du piquet et finit au collier, rien ne flotte (captures examinées, quatre orientations).

### Son (sound-designer, 1 h)

| Son | Quand |
|---|---|
| `coins-market` | vente à l'étal (pièces dans la boîte en fer) |
| `market-bell` | 8 h le dimanche, l'étal s'ouvre (petite cloche à main d'Odette) |
| `chalk-scribble` | l'ardoise change, au passage près de l'épicerie le matin |
| `rooster-crow` | 6 h, chez les deux, plus fort près du poulailler |
| `hen-cluck-happy`, `hen-cluck-ruffled`, `chick-peep` | caresse, survol, poussins |
| `goat-bleat`, `goat-bell` (boucle, suit la chèvre), `milk-squirt` | chèvre, traite |
| `straw-rustle`, `grain-scatter` | pailler, jeter le grain (existant: le garder) |
| `mail-drop` | pli glissé sous une porte |
| `jar-lid` | fin d'une confiture |

## 7. Notes de version proposées (0.12.0)

Titre: « L'aubrin et le marché du dimanche »

- Les sous s'appellent désormais des aubrins, la monnaie de la vallée: même valeur, nouvelle pièce.
- Le dimanche matin, tiens l'étal de la Halte sur la place: les habitants viennent avec leur liste, et tu choisis tes prix.
- Odette paie selon la saison et selon ce qu'elle a déjà: son ardoise dit chaque jour ce qu'elle cherche, à prix et demi.
- Confitures, gelée, noisettes grillées et fromage frais au réchaud; cagettes et nichoirs à l'établi.
- Les plis de Lucie: chaque matin, des lettres et des colis à porter dans le bourg.
- Ta basse-cour s'agrandit: un coq, des couvées, six couleurs de poules à réunir, et des poules plus gaies quand on les soigne.
- Une chèvre sur le talus: mène-la au piquet, trais-la à deux, fais ton fromage.
- La pêche s'enrichit: une vingtaine de poissons, du commun au mythique, et des ombres dans l'eau.
- Cinq missions pour relancer le marché d'Aubrune, avec Odette, Achille, Solange et Firmin, et neuf petites missions de plus.

## 8. Hors périmètre de la 0.12.0

Hiver et foin; vente ou mort d'une bête; maladies; races achetées (les couleurs viennent de la couvée); lapins; prix d'achat qui varient (graines, pain: fixes); spéculation (Odette n'achète jamais pour revendre au joueur); marché d'autres jours que le dimanche; habitants nouveaux pour le marché (seulement les six); ruches si le lot P1 ne sort pas; modèle de la halle si le temps manque (le chantier attend la 0.12.1).

## 9. Questions pour le client (par le manager)

1. **Le nom de la monnaie: « aubrin » (de l'Aubrune).** Recommandation: le garder; s'il ne plaît pas, « picot » (le trou du poinçon du contrôleur) se remplace par la même règle, sans autre travail.
2. **L'ordre de sortie si le temps manque ce soir.** Recommandation: livrer d'abord la monnaie, les prix d'Odette, le marché du dimanche et les poules; la chèvre et sa trame (quête 5) en 0.12.1 si les modèles ne sont pas prêts, parce que la trame du marché tient seule et que la chèvre demande le plus de modèles.

## Annexe A: sortie de la simulation

Voir la section 2.8; commande: `python3 -I docs/jeux/jeu-1/simulations/v0_12_economie.py --graines 1000`.

## Historique

| Version | Date | Changement |
|---|---|---|
| 1 | 2026-11-03 | première version (game-designer) |
