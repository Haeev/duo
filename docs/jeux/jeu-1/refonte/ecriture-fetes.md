# Écriture jouable: les quatre fêtes d'Aubrune et la veillée du quai

Auteur: game-designer, 2026-11-11. Suite de `ecriture-habitants.md`. Source: cahier des charges, sections 4.3, 4.7 (R35) et 6.3, et `ecriture-actes-2-3.md` (section 8, point 7: « il faut un événement veillée qui amène les vingt sur le quai »). Tout est en fiches de données, aucune ligne de moteur; contrôle: `tests/fetes-aubrune.test.ts`.

## En bref

- Quatre fêtes, une par saison, le **samedi 13** (le jour du train: Rosalie reste jusqu'au soir), plus la **veillée du quai**: la première attend les joueurs après l'acte 3, puis elle revient un samedi sur deux.
- 145 fiches nouvelles: 10 événements, 10 scènes (9 à deux rôles, avec des gestes à faire ensemble), 4 suites de fête, 121 dialogues (392 répliques, plus 69 de scène), et 119 lignes de planning ajoutées chez 20 habitants.
- Chacun des 21 habitants a 3 répliques par fête et pour la veillée (4 à la Nuit des lumignons), en tournante, dont une sur « ta moitié ».
- Chaque fête: une scène d'ouverture et une de clôture à deux rôles, une activité existante, une décision à deux qui devient une tradition, un cadeau chaque année et une récompense la première fois.
- Rien ne bloque: aucune étape de l'histoire ni des six suites ne cite une fête; une fête manquée revient l'an suivant et sa suite reprend où elle en était.

| Fête                        | Date (jour de jeu, an 1) | Heures      | Lieu du plan                         | Ouverte par                                 |
| --------------------------- | ------------------------ | ----------- | ------------------------------------ | ------------------------------------------- |
| Fête des barrières fleuries | samedi 13 du printemps (13) | 10 h à 22 h | passage à niveau (`pn-s`)            | la fin de l'acte 3                          |
| Nuit des lumignons          | samedi 13 de l'été (27)  | 10 h à 2 h  | parvis (`pv`), puis tout le bourg    | la fin de l'acte 3                          |
| Concours de la soupe        | samedi 13 de l'automne (41) | 10 h à 22 h | place (`pl`)                         | l'acte 3 et la fin de « La guerre de la soupe » |
| Veillée du premier train    | samedi 13 de l'hiver (55) | 10 h à 22 h | quai (`quai`)                        | la fin de l'acte 3                          |
| Veillée du quai, la première | chaque soir tant qu'elle n'est pas vécue | 18 h 30 à 22 h | quai                          | la fin de l'acte 3                          |
| Veillée du quai             | samedi 6 de chaque saison (6, 20, 34, 48) | 18 h 30 à 22 h | quai                | la première veillée                         |

Le jour de jeu va d'une aube à l'autre: une nuit de fête et le passage de 5 h 12 qui la suit sont le même jour. Une année fait 56 jours: la première fête qu'un duo médian rencontre (histoire finie vers le jour 17) est la Nuit des lumignons, celle de la coutume que l'acte 3 vient de raconter.

## 1. Comment c'est fait

| Besoin | Fiche | Règle |
| --- | --- | --- |
| La fête a lieu | `evenements/<fête>.json` | se lit partout par la condition `{ "type": "event_is", "events": ["<fête>"], "when": "begun" }` (commencée aujourd'hui, jusqu'à l'aube); annoncée la veille; ferme les commerces (`closes`) |
| Le bourg range | `evenements/le-bourg-range-la-fete.json` | chaque matin de 6 h à 10 h: lisses relevées |
| Qui vient | `habitants/<id>.json` | lignes de planning en tête de fiche: samedi, saison, heures, et `event_is` sur la fête; juste après les lignes d'une étape en cours (l'histoire et les suites gardent la main) |
| Scènes | `scenes/` | déclencheur `daily` (`event_is` sur la fête, l'heure, les deux joueurs à 8 m du point): elles se rejouent chaque année |
| La première fois | `quetes/<suite de fête>.json` (`kind: side`) | s'ouvre au début de la fête: ouverture, puis activité et décision en parallèle, puis clôture; les récompenses uniques sont dans sa dernière étape |
| Répliques | `<habitant>-fete-<fête>`, `<habitant>-veillee-du-quai` | priorité 45, tournante de trois (`aubrune.tour-fete.<habitant>`) |
| Étapes de fête | demande 52, merci 57, décision 55 | sous l'histoire (60 et plus); elles ne parlent que le jour de la fête |

Priorités: une réplique de fête (45) passe devant le quotidien (0), les souvenirs (30) et les secrets (40); elle reste sous la première rencontre (50), sous les étapes des suites (52 à 58) et sous l'histoire (60 et plus). Seule la remarque d'hygiène (90) passe devant tout, comme avant.

**Ta moitié.** La deuxième réplique de chaque tournante parle de l'autre joueur: elle le taquine, lui prête un mot, ou envoie le chercher (« Va chercher ta moitié », « Dis à ta moitié que... »). Chez les quatre habitants qui recueillent une décision, une réplique vraie s'y ajoute quand l'autre a déjà choisi (« Ta moitié m'a déjà dit son idée. Je ne te la souffle pas. »).

**Rosalie et le Contrôleur.** Les jours de fête, le train du samedi attend la fin de la fête: Rosalie reste jusqu'à 22 h (sa règle de départ lit la fête du jour, `event_is`). Le Contrôleur ne vient à aucune fête: il passe à 5 h 12 la nuit même, quand le bourg dort, et parle de ce qu'il a vu en arrivant (des pétales sur la voie, un lumignon encore allumé, une gamelle sur le banc, la part gardée « pour qui arrive en retard »). Personne d'autre que les gardes ne le voit: la règle de l'histoire tient. Comme son autorail de chaque nuit, ces répliques n'existent qu'une fois le premier départ pour Hautefonte fait.

**Les boutiques ferment** un jour de fête (`"closes": { "shops": "all" }` de la fiche, du début de la fête à l'aube): les commerçants sont à la fête dès 10 h; un commerçant qui a sa réplique `lines.closed` le dit. Ce qu'une activité demande d'acheter est donné sur place (le panier de Margot, les pommes d'Odette).

**Cadeaux.** Le système de cadeaux ne change pas, mais la fête le sert: tout le bourg est au même endroit, et le cadeau de chaque fête est l'objet adoré de quelqu'un (la soupe aux herbes pour Marthe, la tourte du quai pour Odette et Honorine, le billet poinçonné pour le Contrôleur, l'omelette pour Martial, le pain pour Rosalie).

**Ajouter une fête** (sans code): 1. `pnpm nouveau evenement <id> aubrune`: date, heures, `closes`. 2. Dans chaque fiche d'habitant, une ligne de planning (`days`, `seasons`, `when` avec `event_is` sur la fête) vers un point du plan, cinq ou six par point au plus. 3. Deux scènes à déclencheur `daily` (ouverture, clôture), sur `event_is`. 4. Un dialogue `<habitant>-fete-<id>` par habitant, priorité 45, sur le modèle de `firmin-fete-barrieres`. 5. Facultatif: une suite `kind: side` ouverte par `event_is`, pour l'activité, la décision (`reopens`: rejouée chaque année) et la récompense de la première fois. 6. Une ligne dans `FEASTS` de `tests/fetes-aubrune.test.ts`.

## 2. Fête des barrières fleuries (printemps, passage à niveau)

Du temps de la ligne, le garde fleurissait ses lisses au premier beau samedi: une barrière fleurie promet d'être levée pour tout le monde. Trente ans sans fête, faute de garde. Les gardes, c'est vous.

| Moment | Lieu | Ce qui se passe | Ce que fait chaque joueur |
| --- | --- | --- | --- |
| Ouverture, 10 h à 17 h | `pn-s` | scène `les-lisses-en-fleurs`: Firmin lit l'article 44, Honorine raconte 1951, on baisse les lisses | l'un tourne la manivelle sans voir la lisse d'en face, l'autre voit les deux bras et noue le ruban: il faut se dire quand ralentir |
| Bouquet | Firmin (`firmin-barriere`) | porter 3 coquelicots (cueillette), ou 3 radis du potager faute de fleurs: « Le règlement dit garnies. Il ne dit pas de quoi. » | à se partager avec la décision |
| Décision | Honorine (`gr0`) | qui passe le premier sous la barrière fleurie et fait un vœu: la doyenne, ou les enfants (Jeanne a parié) | chacun dit son choix; il n'est retenu que si les deux concordent |
| Tour du bourg | autour du passage | 20 habitants et leurs fleurs: le lilas rival d'Odette et de Colette, les bleuets noués en cachette par Paulin, l'enveloppe vide de Lucie, le chou monté de Léon | cadeaux: tout le bourg est au même endroit |
| Clôture, 17 h à 22 h | `pn-s` | scène `la-barriere-se-leve`: il pleut des pétales | l'un à la manivelle, l'autre au contrepoids, à trois, ensemble |

- **Où ils se tiennent**: Firmin à la barrière; Jeanne, Léon et Solange au pied de la lisse sud; Honorine, Marthe, Odette, Colette et Margot au carrefour (`gr0`); Basile, Mado et Barnabé au nord de la voie (`n0`), du côté de l'atelier; Ambroise, Martial et Rosalie au bout ouest du quai, Achille assis sur le banc; Lucie, Armand, Paulin et Berthe devant la maison du garde (`hd`).
- **Chaque année**: 2 graines de tomate par joueur (Margot: « une fleur se fane; une tomate, on en reparle en août »).
- **La première fois**: la recette de l'omelette aux herbes (`give_recipe`, « l'omelette de la barrière »: elle ne s'apprend nulle part ailleurs), une omelette par joueur, amitié de Firmin (+30), d'Honorine et de Jeanne (+20).
- **Faits pour le rendu**: `aubrune.barrieres.lisses` (`baissees`, `levees`), `.garniture` (`coquelicots`, `radis`), `.premier` (`doyenne`, `enfants`).
- **Manques**: les coquelicots ne se cueillent pas encore à Aubrune (meuble `coquelicots` à poser, ou `nature.json`); lisses en position baissée, treillis et guirlandes de fleurs, pétales; tonneau du café sur la route.

## 3. Nuit des lumignons (été, parvis puis tout le bourg)

La coutume de l'acte 3: un lumignon à la barrière « pour ceux qui partent ». Cette nuit, tout le bourg fait ce que le garde faisait seul: une lumière par âme. Le jour, on les coule sur le parvis, dans des coquilles d'œuf, avec les bouts de cierge que Marthe garde depuis trente ans. La nuit, chacun pose le sien là où il compte, et dit pour qui.

| Moment | Lieu | Ce qui se passe | Ce que fait chaque joueur |
| --- | --- | --- | --- |
| Ouverture, 10 h à 20 h 30 | `pv` | scène `la-cire-et-la-meche`: le lumignon des gardes | l'un tient la mèche et ne voit pas le niveau, l'autre verse et ne voit pas la mèche |
| Coquilles | Marthe (`marthe-parvis`) | porter 2 œufs (basse-cour): les coquilles pour les derniers arrivés, le dedans pour l'omelette de Colette | à se partager avec la décision |
| Décision | Marthe | pour qui brûle le lumignon de la barrière: ceux qui partent (la coutume), ou ceux qui reviennent (l'idée de Firmin) | à deux, à voix haute |
| Clôture, 20 h 30 à 2 h | `pn-s` | scène `le-lumignon-de-la-barriere`: la flamme se prend à la lanterne d'Émile | l'un allume entre deux rafales, l'autre abrite de ses mains et sent le vent venir |
| Le tour des lumignons, jusqu'à 2 h | tout le bourg | chaque habitant est près de sa lumière et dit pour qui elle brûle | se partager le bourg, puis se raconter |

- **Où brûlent les lumières** (20 h 30 à 2 h): Firmin à la barrière (pour son oncle), Jeanne à côté (pour le train de 5 h 12), Odette sous la tonnelle, Basile à l'établi, Achille à la fenêtre du fournil, Solange devant la mercerie, Mado sur l'enclume et Barnabé devant la forge, Ambroise sous la pendule (pour la minute), Honorine sur son seuil (deux: sa marraine, et « pour le plaisir »), Marthe au pied du clocher, Lucie à la boîte aux lettres, Colette sur le tonneau de la terrasse, Armand au lavoir, Paulin et Margot au gué, Léon sur la grève, Berthe au ponton (le sien part sur l'eau), Martial au cimetière (un seul, pour tous), Rosalie sur le tampon de sa locomotive jusqu'à 22 h.
- **Chaque année**: un pain de minuit par joueur, laissé par Achille sur la lisse.
- **La première fois**: le plan de la lanterne (`give_plan`, la brique existe; il se trouve aussi en fouille), amitié de Marthe (+30), de Firmin et d'Honorine (+20).
- **Faits pour le rendu**: `event_is` sur `nuit-des-lumignons` (21 lumières après 20 h 30), `aubrune.lumignons.pour` (`partent`, `reviennent`).
- **Manques**: un objet et un modèle de lumignon (coquille, flamme, lumière chaude) à 21 emplacements; la table de cire du parvis; une lumière qui dérive au ponton; un air de nuit (la valse de fête ne convient pas à cette nuit-là).

## 4. Concours de la soupe (automne, place)

Honorine l'a dit à la fin de « La guerre de la soupe »: « À l'automne, on recommence. » Deux marmites sur la place: la soupe des mères (Odette et Colette, à quatre mains) et la panade du moulin (Berthe, avec le pain d'Achille). La doyenne préside, assise sur le banc. Les gardes sont le jury, et ils concourent.

| Moment | Lieu | Ce qui se passe | Ce que fait chaque joueur |
| --- | --- | --- | --- |
| Ouverture, 10 h à 17 h | `pl` | scène `les-marmites-de-la-place` | chacun goûte une marmite différente: il faut se décrire ce qu'on a goûté |
| La marmite des gardes | Margot, puis la cuisine de la maison, puis Honorine | Margot donne le panier du concours (carotte, poireau, pomme de terre); on cuisine une soupe de légumes et on la porte à Honorine | cuisine; à se partager avec la décision |
| Décision | Honorine (banc de la place) | à qui va la louche des gardes, forgée par Mado: aux mères, ou au moulin | on n'a pas goûté la même soupe: se raconter, puis trancher à deux |
| Clôture, 17 h à 22 h | `pl` | scène `tous-premiers`: « Premier prix: tout le monde. Je reprends de tout. » | une anse du grand chaudron par joueur, levées ensemble |

- **Où ils se tiennent**: Honorine assise sur le banc de la place; Odette, Colette et Martial devant l'épicerie (`pl-o`); Berthe, Marthe, Firmin, Ambroise et Achille sur la place; Basile, Mado, Barnabé, Solange, Lucie et Rosalie côté Grand-Route (`gr1`); Jeanne, Léon et Armand devant la vitrine; Paulin et Margot sous la tonnelle.
- **Chaque année**: une soupe aux herbes par joueur (elle ne s'obtient qu'ici; Marthe l'adore, Firmin et le Contrôleur l'aiment).
- **La première fois**: 2 soupes aux herbes et 10 € par joueur (la catégorie « gardes »), amitié d'Honorine (+30), d'Odette, de Colette et de Berthe (+20).
- **Faits pour le rendu**: `aubrune.concours.laureate` (`meres`, `moulin`: la louche au mur de la gagnante).
- **Manques**: la recette de la soupe aux herbes (l'objet existe, pas la recette: c'est la récompense attendue de la première fois); deux marmites sur trépied, la grande table et ses bancs, le chaudron; un verdict par année (voir 7).

## 5. Veillée du premier train (hiver, quai)

L'anniversaire de la nuit de 5 h 12. Tout le jour sur le quai: la tourte du quai d'Odette, le brasero de Mado, les pommes de terre de Paulin dans la braise. À la nuit, les gardes refont le geste des anciens: lever la lanterne, sonner la cloche du quai. Puis le bourg rentre se coucher, et le premier train passe à 5 h 12 pour qui veille encore.

| Moment | Lieu | Ce qui se passe | Ce que fait chaque joueur |
| --- | --- | --- | --- |
| Ouverture, 10 h à 19 h | `quai` | scène `l-appel-du-registre`: « Présent ! », vingt et une fois | l'un lit les noms du registre, l'autre tire les traits à la craie |
| Le dessert | Odette, le réchaud de la maison, puis Colette | Odette donne 2 pommes d'hiver; on les fait cuire et on les porte à Colette, qui les pose au bout de la table, « côté voie: c'est la place du voyageur » | cuisine; à se partager avec la décision |
| Décision | Firmin (`firmin-quai`) | la devise sous la ligne de 5 h 12: « À l'heure, ou presque. » (Ambroise) ou « On a de la place. » (Odette, d'après le toast de Firmin) | à deux, à voix haute |
| Clôture, 19 h à 22 h | `quai` | scène `la-lanterne-et-la-cloche` | l'un lève la lanterne sans voir la flamme, l'autre la voit et sonne quand elle est droite |
| 5 h 12 | `quai` | le Contrôleur: « Il y avait une part en bout de table. Personne n'a su me dire pour qui. Je l'ai prise. » | veiller à deux, ou dormir: rien n'y oblige |

- **Où ils se tiennent**: Firmin au milieu du quai; Honorine et Ambroise assis sur les deux bancs; Odette, Colette, Marthe, Achille et Rosalie au quai; Jeanne, Solange, Lucie et Armand au bout ouest; Mado, Barnabé, Basile et Berthe au bout est, vers le brasero; les Delmas côté Grand-Route (`gr1`); Martial devant la halte (`gr2`), où il a posé son vélo.
- **Chaque année**: un billet de quai poinçonné par joueur (l'objet que le Contrôleur adore: on peut le lui offrir la nuit même).
- **La première fois**: une tourte du quai par joueur (repas qui épargne les outils; Odette et Honorine l'adorent), amitié de Firmin (+30), d'Ambroise et de Colette (+20).
- **Faits pour le rendu**: `aubrune.halte.devise` (`a-l-heure`, `de-la-place`: la ligne à la craie du tableau).
- **Manques**: la recette de la tourte du quai (objet sans recette); brasero, table et bols, lampions, cloche du quai à sonner, tableau des horaires qui affiche la devise.

## 6. La veillée du quai

**La première** est la récompense de la fin de l'acte 3. La scène du matin (`la-veillee-du-premier-train`) raconte la soirée; cette fois elle a lieu: dès que l'acte est fini, chaque soir de 18 h 30 à 22 h, les 19 habitants sont sur le quai (Martial arrive le jour même), jusqu'au soir où les deux joueurs y viennent. Firmin invite une fois chaque joueur (« Présence souhaitée. ... Présence espérée. »). Scène `la-veillee-du-quai`, à deux rôles: Ambroise glisse un mot à l'un, Honorine à l'autre (« Firmin a ri, tout à l'heure. Trente ans que je guettais ça. »), on se le répète, on lève son bol ensemble. Cadeau: la soupe d'Odette et la tarte de Colette que la scène du matin annonçait, une part par joueur, et l'amitié de Firmin, d'Ambroise, d'Honorine et d'Odette (+20).

**Ensuite**, le samedi 6 de chaque saison (un samedi sur deux: l'autre, le 13, est celui de la fête; quatre fiches `veillee-du-quai-<saison>`, annoncées la veille): mêmes places que la Veillée d'hiver, scène courte `le-banc-du-samedi`, un bol de soupe par joueur, et trois répliques par habitant en tournante. Rosalie, qui repart à 14 h 40, en parle le matin (« Gardez-moi un bol »); le Contrôleur, à 5 h 12, trouve « le banc encore tiède ».

- **Manques**: lampions et table du quai (le fait `aubrune.decor.veillee` existe depuis l'acte 3); un conteur par veillée demanderait une tournante de scènes.

## 7. Ce que le moteur ne permet pas encore

1. ~~Savoir qu'un événement est en cours.~~ Fait (2026-11-11): condition `event_is` (`on`, `begun`, `today`, `tomorrow`); le fait `aubrune.fete.jour` est retiré.
2. ~~`activates.villagers` et `activates.scene`~~ Retirés (2026-11-11): la présence passe par les plannings et les scènes par leur déclencheur, qui lisent `event_is`; une seule source pour chaque chose.
3. ~~Le contrôle des suites ignore les faits écrits par le calendrier.~~ Fait (2026-11-11): `collectFacts` les connaît; les six effets de contournement des scènes sont retirés.
4. ~~Une décision à deux est prise une fois pour toutes.~~ Fait (2026-11-11): `reopens` de la décision, rouverte à chaque fête, l'an dernier lisible (`decision_is`, `last`); appliqué aux quatre décisions. Reste à écrire les répliques « comme l'an dernier ». Les traditions (qui passe le premier, pour qui brûle la lumière, la louche, la devise) se rejouent donc chaque année.
5. **Rien ne lit l'année** (`year_is`, jours écoulés depuis un fait): pas de « l'an dernier », pas de cadeau par joueur chaque année dans un dialogue. Les cadeaux annuels passent par l'effet `to: duo` de la clôture.
6. **Vendre à la fête**: une réplique de priorité 10 ou plus cache l'offre de boutique, et `activates.shop` n'ouvre rien. Les commerces sont fermés par la règle `closes` de la fiche (2026-11-11), du début de la fête à l'aube; réplique `lines.closed` à écrire par commerçant.
7. **Une scène ne branche pas**: la clôture ne peut pas dire la décision prise (les répliques, si). Ses gestes sont tenir et appuyer: pas de mini-jeu de rythme pour une fanfare de fête, pas d'objet à poser dans le monde (le lumignon est raconté).
8. **Pêche de fête**: aucune prise ne peut dépendre d'un fait ou d'un événement (pas de « friture de la veillée »).
9. **Rendu**: le train de Rosalie à quai, les lisses baissées et les faits de décor ci-dessus ne se voient pas encore.

## 8. Ce qu'il manque, précisément

| Sorte | Manque | Pour |
| --- | --- | --- |
| Carte | coquelicots à cueillir à Aubrune (meuble `coquelicots`, ressource livrée) | la fête des barrières (aujourd'hui jouable aux radis) |
| Recettes | `soupe-aux-herbes`, `tourte-du-quai` (objets livrés, sans recette, `known: learned`) | `give_recipe` à la première fois du Concours et de la Veillée d'hiver |
| Musiques (entrées de source `tune`) | air des barrières, air des lumignons, valse de la soupe, air du premier train | `activates.tune` de chaque fête, aujourd'hui `null` |
| Cartes postales | une par fête (barrière fleurie, bourg aux lumignons, les deux marmites, le quai de la veillée) | `give_entry` à la fin de chaque suite de fête; ou un sujet de photo de cible `event` |
| Tenues à gagner (étiquette `a-gagner`) | couronne de fleurs, tablier du concours, écharpe de la veillée, casquette de garde | `give_piece`: aucune pièce à gagner n'existe au catalogue |
| Objets | lumignon (posable, lumière), louche des gardes, billet de quai distinct du billet du prologue | cadeaux et décor |
| Décor de fête, lu par `event_is` | guirlandes et treillis des lisses, pétales; 21 lumignons; marmites, grande table, chaudron; lampions, brasero, table du quai, devise à la craie | les quatre fêtes et la veillée |
| Animations | clips des activités `fleurir-la-barriere`, `fondre-les-lumignons`, `veiller-son-lumignon`, `gouter-les-soupes`, `veiller-sur-le-quai`, `veiller-au-quai` | les habitants sont debout, sans geste |
| Son | la règle `fete` de `src/audio/musique/donnees/musique.json` ne cite que `fete-d-essai`: y ajouter les fêtes et les veillées (neuf identifiants); un air de nuit pour les lumignons; manivelle, cloche du quai, cuillères, chaudron | musique et bruitages des scènes |

## 9. Choix laissés au client (par le manager)

1. **Le samedi 13 de chaque saison**, jour du train. Recommandation: garder; le train amène Rosalie, et l'autre samedi de la saison garde sa veillée.
2. **Le Concours de la soupe attend la fin de « La guerre de la soupe »** (le cahier le dit, et la suite fonde le concours); les trois autres fêtes n'attendent que l'histoire, alors que le cahier attache aussi la fête d'été à « La robe et la cloche ». Recommandation: garder; la première fête après l'histoire doit avoir lieu pour tout le monde.
3. **La Nuit des lumignons dure jusqu'à 2 h** (le cahier dit 22 h pour toutes). Recommandation: oui; la nuit tombe à 20 h 30 et le tour du bourg demande du temps.
4. **Le Contrôleur ne vient à aucune fête**; il passe à 5 h 12 et prend la part gardée « pour qui arrive en retard ». Recommandation: garder, le mystère reste entier.
5. **Marthe explique le préfet**: Honorine a dansé avec le facteur d'alors, « il s'appelait Préfet ». Recommandation: garder, c'est une explication raisonnable de plus; à retirer d'une ligne si le client préfère le doute.
6. **Les boutiques sont fermées les jours de fête.** Recommandation: garder, et donner sur place ce que l'activité demande.
7. **Le plan de la lanterne est offert** à la première Nuit des lumignons, alors qu'il se trouve aussi en fouille. Recommandation: le remplacer par l'air des lumignons dès que l'entrée existe.

## 10. Contrôles

`tests/fetes-aubrune.test.ts` (8 essais, environ 15 s): les quatre fêtes tombent un samedi 13, deux années de suite, dans quatre saisons, sur un point du plan; 21 habitants ont 3 répliques par fête et pour la veillée, dont une sur ta moitié, à la priorité 45, en pages de 150 caractères au plus; chaque fête jouée de bout en bout par la simulation (la fête commencée à 10 h, les 20 présents rendus à pied sur place, Rosalie qui reste après le départ du train, ouverture à deux rôles, don sur place, objet remis, décision à une voix puis à deux, tournante entendue, lumières de la nuit, clôture, cadeau et récompense, passage du Contrôleur à 5 h 12, bourg rangé le lendemain, retour l'an suivant); une fête manquée laisse sa suite ouverte et reprend aux radis l'an d'après; sans la guerre de la soupe, pas de concours; la première veillée attend les joueurs d'un soir sur l'autre, puis revient le samedi 6 de la saison; le samedi 13 reste à la fête.
