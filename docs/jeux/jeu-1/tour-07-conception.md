# La Petite Ligne: conception du tour 7 (douze moments, onglet Souvenirs)

| Champ | Valeur |
|---|---|
| Auteur | game-designer |
| Date | 2026-11-01 |
| Branche lue | `claude/stoic-lamport-lueey2` (égale à `main`) |
| Répond à | `gauntlet/revues/tour-06-game-designer.md`, priorité 3 (« Les moments, finis et doublés ») |
| Suit | `tour-06-conception.md` (format des fiches, règles communes du système, annexe A); ce document ne redit pas ce qui y est écrit et reste juste |
| Règles du plan | R1, R8, R9 (variété), R15 (gestes à deux), R16 (savoirs propres) de `plan-100-heures.md` |
| Simulations | `simulations/moments_rares.py` (parties 6 à 10 nouvelles, annexe A), `simulations/moments_tour7_geometrie.py` (nouveau, annexe B) |
| Destinataires | dev gameplay, dev rendu 3D, dev interface, artiste 3D, sound-designer, tech-artist, level designer, directeur artistique, qa-testeur |

## En bref

- **Douze moments.** Aux six joués s'ajoutent les deux P1 esquissés (la chevrette, déplacée au pré de l'est et dotée d'un faon; le martin-pêcheur du ponton) et quatre moments qui ne sont pas des bêtes: **la brume de l'Aubrune** (la météo: le matin d'après la pluie), **les étoiles de l'Aubrune** (le ciel, vu dans l'eau puisque la caméra ne montre pas le ciel), **la valse d'Odette** (un habitant) et **le salut du mécanicien** (le train).
- **Cinq poses nouvelles**, toutes différentes de « immobiles et tournés vers lui »: se figer quand la chevrette lève la tête (« un, deux, trois, soleil »), se tenir face à face de part et d'autre de la rivière, s'asseoir côte à côte au bout du ponton, se prendre les mains pour valser, tenir chacun sa barrière du passage à niveau à l'heure du train.
- **Vérifié sur la carte jouée**, par un script qui retrouve au centième les mesures du jeu sur les six moments joués (héron 3,60 s, oies 3,75 s, renard 3,60 s, mésanges 3,70 s): M-02 tenu par les six nouveaux (4,4 à 16 s au pire, seuil 3,4 s), acteur principal jamais caché en orientation 0, dans le cadre au zoom de départ pendant 4,8 à 16 s.
- **Onglet Souvenirs**: une page de carnet par duo, qui garde les moments vus ensemble et les quêtes secrètes, datés, chacun avec sa vignette et une ligne écrite du point de vue de qui la lit (« Tu étais dans la confidence. »). Aucun compteur, aucune case vide; une seule « rumeur du bourg » en bas de page, différente chez les deux joueurs, donne envie de revenir.
- **Simulation**: démo à 5,2 moments (au lieu de 4,8), sans reprise à moins de 7 jours. Au long cours, avec trois réglages nouveaux (chance réduite quand la réserve de la saison est petite, fenêtre de 10 jours à partir de J2, coup de pouce x 3 aux moments jamais vus), l'écart médian entre deux passages d'un même moment est de **46 jours au printemps et 21 en été** (objectif de la revue: 19). L'automne (3,4 moments) et l'hiver (1,9) restent pauvres tant qu'ils n'ont pas leur réserve propre, et après l'année 1 il faut **2 moments neufs par saison et par année** pour garder au moins une première fois dans neuf saisons sur dix.

---

## 1. Six moments de plus

### 1.1 Les leçons du tour 6, appliquées

| Leçon | Ce qu'elle change ici |
|---|---|
| La caméra isométrique ne montre pas le ciel | les étoiles filantes se voient **dans l'eau** calme au pied du ponton; aucun acteur nouveau ne monte au-dessus de 2,6 m (la cabine du train) |
| Un bâtiment au sud-est d'un lieu le cache (orientation 0, caméra au sud-est) | le point de la chevrette prévu au tour 6, (52,5 ; 4,5), est caché par la remise; la bande au nord-ouest du chêne l'est par son houppier (annexe B, partie 5). La chevrette passe au pré de l'est, où rien de haut n'est au sud-est |
| Les bêtes de moins de 0,2 m se lisent mal | le martin-pêcheur (0,17 m, 10 px au zoom de départ) se lit par ce qu'il fait: son poste est un pieu de 1,4 m bien visible, sa gerbe d'eau, sa traînée bleue en vol (tech-artist), son « tac tac »; l'échelle de lisibilité x 1,5 reste à trancher (question 3). Aucun autre moment nouveau ne repose sur une bête de moins de 0,45 m |
| Lisible au zoom 1 en orientation 0 | « zoom 1 » est le zoom de départ (`initialZoom: 1`, 24 m de large, 57 px par mètre à 1366 px). Chaque fiche donne le temps où l'acteur est dans le cadre, au zoom 0 (16 m) et au zoom 1, depuis la pire case (annexe B, partie 2 bis) |
| Le texte de l'apogée part à la fin du spectacle (QA6-07) | règle reprise telle quelle; chaque texte ne dit que ce qui se voit ou s'entend (M-06), relu ligne à ligne dans les fiches |
| M-02: 3,4 s à moins de 6 m depuis toute case de l'anneau | mesuré pour chaque moment (annexe B). Pour les moments à places imposées (tenir, s'asseoir, rives), on mesure depuis ces places: c'est là que sont les joueurs. Le seuil est 6 m pour tous (le test actuel prend `watch.radius`, qui vaut 3 pour l'échelle: proposition de le fixer à 6, section 1.8) |

### 1.2 Ce que les six moments demandent au système

Tout le reste du système (phases, tirage du matin par empreinte, confidence alternée, récompense au début et texte à la fin, cas limites) est celui du tour 6.

**Poses nouvelles** (champ `watch`):

| Champ | Forme | Sens | Moment |
|---|---|---|---|
| `freeze` | `{ "everySeconds": [6, 10], "lookSeconds": 2.0, "lookClip", "startleBack": 1.5, "resumeAfterSeconds": 4 }` | la bête lève la tête toutes les 6 à 10 s (tiré par la graine du moment) pendant `lookSeconds`; le compteur de `holdSeconds` ne tourne que pendant un regard; si un joueur à moins de `noticeRadius` bouge pendant un regard, elle recule de `startleBack` m vers son point d'arrivée et reprend après `resumeAfterSeconds` | chevrette |
| `opposite` | `{ "axis": "y", "at": 40.5, "gap": 1.5 }` | un joueur à au plus `at - gap`, l'autre à au moins `at + gap` sur l'axe: de part et d'autre de l'eau | brume |
| `facing` | `true` ou `"partner"` | `"partner"`: chaque joueur regarde l'autre à 30° près (même cône que `LOOK_CONE`) | brume |
| `seated` + `bench` | objet de siège sans modèle | `pontoon_edge`: deux places assises au bout du ponton, jambes au-dessus de l'eau (même geste que les bancs: Espace près d'une place libre) | étoiles |
| `hold` + `arm` | `{ "armSeconds": 2.5, "climaxAt": "16:00", "lock": true }` | tenir arme le moment: les lisses descendent en 2,5 s et restent baissées; l'apogée part à l'heure dite, même si les joueurs ont lâché | train |
| `hold` + `climax.pauseWhenReleased` | déjà joué (échelle) | lâcher met l'apogée en pause, le reprendre la relance au même instant | valse |

**Chorégraphies nouvelles** (champ `climax`): `players` (la valse fait tourner les deux personnages: `{ "orbit": { "center": "waltz_floor", "radius": 0.4, "turns": 1.5, "from": 1.0, "to": 14.0, "clip": "waltz" } }`; les joueurs ne commandent plus leur personnage pendant l'orbite, une touche de déplacement les fait lâcher); `train` (le départ suit la piste de l'acteur `driver`: décalage du train = x du mécanicien moins 44,5, au lieu de la courbe de 6 s de `trainOffset`); `lightGrade` (la brume: teinte dorée de la lumière, montée en 3 s au début de l'apogée, rendue à la lumière du matin en 6 s après); `hiddenUntil` (le faon est invisible dans l'herbe jusqu'à son image clé `fawn_rise`).

**Règles du tirage, nouvelles ou changées** (valeurs dans `reglages.moments`, table 1.6):

1. **Jours du train.** Un moment marqué `trainDays: "only"` n'est admissible que les jours du train; les autres ne le sont jamais ces jours-là (règle du tour 6 inchangée pour eux).
2. **Jours de fête.** Aucun moment d'ambiance les jours de fête (`noAmbientOnFestivalDays`): fête des semailles (jour 16) et inauguration (jour 23), puis chaque fête du calendrier. Ces jours ont déjà leur scène à deux; une valse d'Odette le soir du bal ferait doublon.
3. **Saisons et veille.** Deux conditions nouvelles pour `availableWhen`: `season_is` (livrée avec les saisons, lot L1 du plan) et `weather_was` (la météo de la veille, que la simulation garde déjà puisqu'elle la tire la veille, FE-09).
4. **Fenêtre propre.** `cooldownDays` peut être donné par moment (le train: 14 jours, pour qu'il reste une surprise alors qu'il revient chaque samedi).
5. **Chance réduite quand la réserve est petite.** À partir de J2 (jour 24), la chance du jour vaut `dailyChance x min(1, n / seasonPoolFull)`, où n est le nombre de moments d'ambiance possibles dans la saison (hors train). Au printemps (9) elle reste 0,5; en été (8) 0,44; en automne (4) 0,22; en hiver (2) 0,11. Sans cette règle, l'hiver repasse les deux mêmes bêtes tous les 11 jours (annexe A, partie 7).
6. **Fenêtre de 10 jours dès J2.** `cooldownDays` passe de 7 à 10 à partir du jour 24. La démo et J1 gardent 7 (M-07, tirages épinglés).
7. **Coup de pouce aux moments jamais vus.** À partir de J2, le poids d'un moment que le duo n'a jamais vu ensemble est multiplié par `unseenWeightFactor` (3). Le jour où les douze ont été vus passe d'une médiane de 254 à 173 jours, et 98 % des duos les ont tous vus en 100 heures (86 % sans coup de pouce).
8. **L'échelle revient au printemps 2.** Une graine sur deux ne tire pas « Où est passé Basile ? » au jour 10 (variante 0): le nichoir reste penché et les mésanges n'arrivent jamais. Proposition: si `nest_box_straight` n'est pas posé à la fin du printemps de l'année 1, la quête de l'échelle démarre au 10e jour du printemps de l'année 2 (jour 94), avec une réplique de Basile: « Mon nichoir pend toujours. Cette année, je le redresse. Vous me tenez l'échelle ? ».

**Mémoire bornée** (pour l'onglet Souvenirs et pour la taille de l'état transmis): `world.moments.history` grandit d'une ligne par occurrence, vue ou non (environ 150 lignes, 7 Kio, en 100 heures, alors que l'alerte de taille de l'état est à 34 Kio). Proposition à l'architecte (question 4): la remplacer par `world.moments.lastEnd` (dernier jour par moment, pour la fenêtre), `world.moments.seasonCount` (passages de la saison en cours, pour `maxPerSeason`) et `world.memories` (section 2.4), bornés par le nombre de moments et non par la durée.

### 1.3 Ce que chaque moment demande aux deux joueurs

| Moment | Où, quand | Ce que font les deux | Ce qu'on se dit |
|---|---|---|---|
| Héron (joué) | gué, après-midi | immobiles et tournés vers lui, à 2,5 à 6 m | « Chut, bouge plus. » |
| Oies (joué) | berge, fin d'après-midi | assis à deux sur le banc de la berge (quête), ou à moins de 6 m | « Viens t'asseoir, elles vont partir. » |
| Échelle (joué) | grand chêne | chacun tient un montant; si l'un lâche, tout s'arrête | « Tiens bon ! » |
| Mésanges, renard, vers luisants (joués) | nichoir, voie, pré | être là, dehors, à moins de 6 m | « Viens vite ! » |
| **Chevrette** | pré de l'est, aube | s'approcher pendant qu'elle broute, **se figer quand elle lève la tête**, finir entre 3 et 5,5 m | « Stop, elle regarde ! ... Vas-y. » |
| **Martin-pêcheur** | bout du ponton, matin | immobiles à 2,5 à 5,5 m, sans avoir à le regarder (il est trop petit pour viser) | « Ne bouge pas, il revient sur le pieu. » |
| **Brume** | bancs de sable face à face, aube après la pluie | **un sur chaque rive, face à face**, immobiles | « Je te vois à peine. Passe de l'autre côté. » |
| **Étoiles** | bout du ponton, nuit d'été claire | **assis côte à côte**, jambes au-dessus de l'eau | « Regarde l'eau, pas le ciel. » |
| **Valse** | sous le lampadaire de la place, soir | **face à face, chacun prend une place**: on valse; lâcher arrête le disque | « Tu m'accordes cette danse ? » |
| **Train** | passage à niveau, samedi avant 16 h | **chacun sa barrière**, de part et d'autre de la voie, à une heure fixe | « Tu prends le nord, je prends le quai. Vite, il est presque quatre heures. » |

Quatre des six nouveaux font se parler pour s'organiser (qui va où, quand bouger), un fait se toucher (la valse), un fait se taire ensemble (les étoiles). Aucun ne peut échouer: au pire, on attend le prochain regard de la chevrette, ou le moment s'en va sans rien retirer.

### 1.4 Les six fiches

Conventions du tour 6: coordonnées en mètres dans le repère de `cartes/halte.json` (x vers l'est, y vers le sud); z depuis le sol ou la surface de l'eau; images clés `[t, x, y, z, clip]`, Catmull-Rom; durées en secondes réelles; heures de jeu. Les valeurs « M-02 » et « cadre » viennent de l'annexe B (pire case de l'anneau ou pire place imposée). Les numéros suivent ceux du tour 6 (1.4.1 à 1.4.6 joués).

#### 1.4.7 La chevrette du pré (`roe_deer`, P1 du tour 6, à produire au tour 7)

**Raison d'être.** Fin mai et juin, la chevrette cache son faon dans les herbes hautes et s'en éloigne le jour pour ne pas attirer les renards; elle revient l'allaiter à l'aube. Le pré de l'est (zone `meadow`, x 50 à 61, y 24 à 33) est le seul pré non fauché du bourg, et il touche la haie du bord est (`X`, x 62 et 63), d'où elle sort. Odette, qui ouvre sa porte à 6 h et regarde la place vers l'est, est celle qui l'a vue.

**Pourquoi plus à la lisière nord.** Le point du tour 6, (52,5 ; 4,5), est caché en orientation 0 par la remise (4,5 m de haut, juste au sud-est); la bande au nord-ouest du chêne l'est par son houppier, et le seul coin visible est collé au mur de Firmin, à 0,6 m (annexe B, partie 5). Au pré, rien de haut n'est au sud-est (la rivière et la promenade): l'acteur n'est jamais caché en orientation 0. Le nom suit le lieu: « La chevrette du pré ».

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 9 au moins (fin de printemps: le faon est né); printemps (à partir du 9e jour de la saison) ou été; soleil ou nuages; poids 2 |
| Présence | 6 h à 8 h 30 (52,5 s réelles à 0,35 s par minute, 120 s à 0,8) |
| Arrivée (`waiting`, 5 s) | sort de la haie en `roe_deer_edge` (62,2 ; 27,0) (fondu de 1 s), marche (`deer_walk`, 0,8 m/s) jusqu'à `roe_deer_graze` |
| Point `roe_deer_graze` | (58,0 ; 27,0), herbe rase (case (58, 27) `.`), entre le rocher (56,5 ; 27,5) et la haie |
| Lit du faon `fawn_bed` | (59,4 ; 25,9), herbe haute (case (59, 25) `,`), à 1,8 m d'elle, au nord-est: l'axe horizontal de l'écran en orientation 0, pour que le faon reste dans le cadre depuis toute case de l'anneau. Le faon est invisible jusqu'à l'apogée; seules ses deux oreilles dépassent de l'herbe, 4 cm, pour les curieux (détail, pas un indice nécessaire) |
| Attente | `deer_graze` en boucle (4 s); toutes les 6 à 10 s, `deer_lookup` (tête dressée, oreilles en avant, 2 s), tournée vers le joueur le plus proche |
| Déclenchement (`freeze`) | les deux dehors, entre 3 et 5,5 m d'elle, et tous les deux immobiles (moins de 0,05 m/s) pendant un regard entier (2 s) |
| Effarouchée | si un joueur à moins de 12 m bouge pendant un regard: `deer_stamp` (elle frappe du pied), `roe_bark` (un aboiement), puis elle recule de 1,5 m vers la haie (sans jamais passer x 61,2), et broute de nouveau 4 s après; si un joueur passe sous 3 m: même chose. Elle ne s'enfuit jamais pour de bon avant 8 h 30 |
| Collision | rayon 0,4 m (elle, et le faon pendant l'apogée) |

Pourquoi 5,5 m et non 6: le faon est à 1,8 m d'elle; à 6 m, depuis la case (54,5 ; 22,5), son lever sortait du cadre du zoom 0 par le bas; à 5,5 m il y reste avec 0,8 m de marge (calcul joint au script, partie 2 bis).

Apogée (9,2 s; positions de la chevrette, puis du faon):

| t (s) | Chevrette (x ; y) | Clip | Faon (x ; y ; z) | Clip | Ce qui se voit et s'entend |
|---|---|---|---|---|---|
| 0,0 | 58,0 ; 27,0 | `deer_call` | 59,4 ; 25,9 ; -0,3 | caché | elle baisse la tête et appelle tout bas (`roe_call`) |
| 1,0 | 58,0 ; 27,0 | | 59,4 ; 25,9 ; -0,3 | `fawn_rustle` | l'herbe haute frémit au lit du faon (`fawn_rustle`) |
| 1,6 | 58,0 ; 27,0 | `deer_watch_fawn` | 59,4 ; 25,9 ; 0 | `fawn_rise` | le faon se dresse, d'abord l'arrière-train, puis les pattes avant (lever réel d'un faon) |
| 2,4 | 58,0 ; 27,0 | | 59,3 ; 26,1 ; 0 | `fawn_trot` | il trottine vers elle, maladroit; `fawn_bleat` à 2,6 s |
| 3,6 | 58,0 ; 27,0 | | 58,8 ; 26,5 ; 0 | `fawn_trot` | |
| 4,6 | 58,0 ; 27,0 | `deer_lick` | 58,5 ; 26,7 ; 0 | `fawn_suckle` | il tète à son flanc, la queue qui frétille; elle lui lèche le dos |
| 6,8 | 58,0 ; 27,0 | `deer_walk` | 58,5 ; 26,7 ; 0 | `fawn_trot` | elle relève la tête et part vers la haie |
| 7,6 | 59,2 ; 27,0 | `deer_bound` | 59,4 ; 26,5 ; 0 | `fawn_bound` | deux bonds chacun; l'écusson clair de sa croupe se voit |
| 8,4 | 60,9 ; 27,1 | `deer_bound` | 61,0 ; 26,6 ; 0 | `fawn_bound` | |
| 9,2 | 62,4 ; 27,2 | | 62,4 ; 26,7 ; 0 | | dans la haie, fondu de 8,4 à 9,2 s (`deer_bounds` à 7,6 s) |

Temps à l'écran: M-02 tenu à 7,5 s au pire (la chevrette ne bouge pas avant 6,8 s); le faon seul reste 3,35 s à moins de 6 m de la case la plus au sud-ouest, mais 8,6 s dans le cadre au zoom 0. Ligne de vue en orientation 0: 0 % caché. Seule l'orientation nord-ouest les cache derrière la halte (la règle de découpe des personnages ne vaut pas pour les bêtes: à signaler au rendu, section 4). État `after`: rien (ils sont rentrés). Départ sans apogée (`leave`, 8 h 30): elle relève la tête et rentre au pas dans la haie, sans le faon, en 4 s.

Modèles: `roe_deer` (chevrette, femelle sans bois): 0,70 m au garrot, tête dressée à 1,05 m, 1,15 m de long; pelage d'été roux vif, ventre plus clair, museau noir et blanc, oreilles de 0,13 m; écusson fessier crème en cœur renversé avec, dessous, le pinceau de poils propre aux femelles (détail juste, visible pendant les bonds). `fawn` (faon de trois semaines): 0,45 m au garrot, 0,65 m de long, livrée rousse à taches blanches en rangées le long du dos, pattes longues et grêles. Clips de la chevrette: `deer_walk` (boucle de 1,2 s), `deer_graze` (4 s), `deer_lookup` (2 s), `deer_stamp` (0,5 s), `deer_call` (1,6 s), `deer_watch_fawn` (boucle de 2 s), `deer_lick` (boucle de 2,2 s), `deer_bound` (0,8 s par bond, en place, sommet 0,6 m). Clips du faon: `fawn_rustle` (herbe qui bouge, porté par l'herbe), `fawn_rise` (0,8 s), `fawn_trot` (boucle de 0,5 s), `fawn_suckle` (boucle de 1,1 s), `fawn_bound` (0,8 s, sommet 0,35 m).

Sons: `roe_call` (appel doux et nasal de la mère, 0,4 s, 2 variantes, audible à 15 m), `fawn_rustle` (froissement d'herbe haute, 0,6 s), `fawn_bleat` (petit « mi » aigu, 0,3 s, 2 variantes), `deer_stamp` (coup de sabot sourd, 0,3 s), `roe_bark` (« bö » rauque, 0,6 s, 2 variantes, audible à 30 m: il prévient aussi l'autre joueur), `deer_bounds` (appuis sourds, 1,6 s).

Textes: confidence `moment_roe_deer_hint` (d'Odette), apogée `moment_roe_deer_climax`, souvenir `moment_roe_deer_memory`, rumeur `moment_roe_deer_rumor`, lignes d'observation `moment_freeze_look` et `moment_freeze_graze`, effarouchée `moment_roe_deer_startled` (section 1.7). Récompense: Cœur +10 chacun.

#### 1.4.8 Le martin-pêcheur du ponton (`kingfisher`, P1 du tour 6, à produire au tour 7)

**Raison d'être.** Le martin-pêcheur chasse à l'affût depuis un perchoir bas au-dessus d'une eau calme et profonde. Le bout du ponton donne sur la seule eau profonde où l'on accède à pied sec; le pieu d'amarrage du coin est (on y attache la barque des jours de crue) est son poste. Il assomme sa prise contre le perchoir avant de l'avaler, tête la première: comportement réel.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 4 au moins; printemps, été ou automne; soleil; poids 2 |
| Présence | 9 h à 12 h (63 s réelles à 0,35) |
| Point `kingfisher_post` | pieu `mooring_post` (accroche, sans emprise) en (46,10 ; 39,90), dans l'eau au coin sud-est du ponton (le ponton occupe x 44 à 46, y 37 à 40); sommet à 0,95 m au-dessus de l'eau, 0,45 m au-dessus du plancher; l'oiseau s'y tient à 0,97 m |
| Attente | posé, hoche la tête (`kf_perch`); toutes les 15 à 25 s, un plongeon manqué (`kf_dive`, gerbe, retour au pieu), `kf_whistle` à chaque envol |
| Déclenchement | les deux dehors, entre 2,5 et 5,5 m du pieu, immobiles, 3 s (sans condition de regard) |
| Timidité | un joueur à moins de 2,5 m (le bout du ponton est à 0,7 m du pieu): il file à 6 m vers l'amont au ras de l'eau, puis revient au pieu 6 s après le départ du joueur. Les places de vue: la racine du ponton (y 37 à 38) et la berge |

Pourquoi 5,5 m: à 6 m, depuis la rive sud (50,5 ; 43,5), le pieu sortait par le haut du cadre du zoom 0 (1,7 s dans le cadre); à 5,5 m, 5,2 s au pire.

Apogée (5,8 s):

| t (s) | x | y | z | Clip | Ce qui se voit et s'entend |
|---|---|---|---|---|---|
| 0,0 | 46,1 | 39,9 | 0,97 | `kf_perch` | il fixe l'eau, tête basse, hochements |
| 1,0 | 46,1 | 39,9 | 0,97 | `kf_dive` | il se lance, ailes fermées |
| 1,3 | 46,6 | 40,6 | 0,0 | | plongeon (`kf_dive`), gerbe et rides (tech-artist) |
| 1,8 | 46,6 | 40,6 | 0,0 | `kf_fly` | il ressort, un éclat d'argent au bec (l'ablette, reflet spéculaire) |
| 2,1 | 46,4 | 40,3 | 0,5 | | |
| 2,4 | 46,1 | 39,9 | 0,97 | `kf_beat` | de retour au pieu, il frappe deux fois le poisson (`kf_beat` à 2,7 et 3,2 s) |
| 3,6 | 46,1 | 39,9 | 0,97 | `kf_swallow` | il l'avale, tête renversée |
| 4,1 | 46,1 | 39,9 | 0,97 | `kf_perch` | sifflet (`kf_whistle`) |
| 4,8 | 46,1 | 39,9 | 0,97 | `kf_fly` | envol |
| 5,3 | 43,0 | 40,3 | 0,4 | `kf_fly` | au ras de l'eau vers l'amont, traînée bleue de 0,3 s |
| 5,8 | 39,0 | 40,3 | 0,4 | | fondu de 5,4 à 5,8 s |

Temps à l'écran: M-02 4,4 s au pire; cadre 5,2 s au zoom 0, 5,65 s au zoom 1; jamais caché dans les quatre orientations. État `after`: rien. Départ sans apogée: même envol, sans texte.

Modèles: `kingfisher` (0,17 m de long dont 4 cm de bec, envergure 0,25 m; dos bleu cobalt avec une raie turquoise vive, ventre roux orangé, gorge blanche, pattes rouges; à l'échelle x 1,5 si le directeur artistique la retient: 0,25 m); `small_fish` (ablette, 0,08 m, argentée, porte un reflet spéculaire fort); `mooring_post` (pieu de chêne de 0,14 m de diamètre, 1,4 m dont 0,45 m dans l'eau et 0,95 m dehors, sommet usé, anneau de fer à 0,6 m). Clips: `kf_perch` (boucle de 2 s), `kf_dive` (0,3 s), `kf_fly` (boucle de 0,12 s), `kf_beat` (1,2 s, deux coups), `kf_swallow` (0,5 s).

Sons: `kf_whistle` (« tiiii » aigu, 0,4 s, 3 variantes, audible à 25 m: c'est lui qu'on entend avant de le voir), `kf_dive` (plouf net, 0,4 s, 2 variantes), `kf_beat` (« tac tac » sec, 0,5 s).

Textes: confidence `moment_kingfisher_hint` (de Jeanne, texte du tour 6), apogée `moment_kingfisher_climax` (réécrit pour dire vrai: le poisson est un éclat, pas une silhouette), souvenir et rumeur. Récompense: Cœur +10 chacun.

#### 1.4.9 La brume de l'Aubrune (`mist`, météo, nouveau)

**Raison d'être.** Après un jour de pluie, une nuit claire et calme refroidit la vallée; au petit jour, l'eau de l'Aubrune, plus tiède que l'air, fume, et un banc de brume couvre la rivière jusqu'à hauteur de taille. Elle se lève quand le soleil passe la colline de l'est. C'est le seul moment écrit par la météo de la veille: les joueurs qui ont subi la pluie en ont la récompense le lendemain. Le lieu: entre la langue de sable de la rive nord (x 27 à 34, y 38) et l'anse de sable de la rive sud (x 23 à 31, y 42), l'Aubrune n'a que trois mètres d'eau (y 39 à 41): le seul endroit où l'on se tient face à face, chacun sur une rive, à quatre mètres l'un de l'autre.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 2 au moins; printemps, été ou automne; pluie ou orage la veille (`weather_was`); soleil ou nuages ce jour; poids 3 |
| Présence | 6 h à 8 h 30 |
| Point `mist_narrows` | (29,5 ; 40,5), eau profonde au milieu du passage |
| Places de vue (indicatives) | `mist_bank_north` (29,5 ; 38,5, case `b`), `mist_bank_south` (29,5 ; 42,5, case `b`); la rive sud se gagne par le gué (x 16 à 20): 27 m, environ 8 s de marche depuis la rive nord |
| Attente | brume sur l'eau de x 14 à 44: épaisse au-dessus de l'eau (opacité 0,7 jusqu'à 0,3 m, sommet à 1,2 m), légère sur les berges (0,3); elle dérive vers l'est à 0,35 m/s, comme le courant (`flow` +x). Les joueurs sur les berges y entrent jusqu'à la taille. Son: `mist_ambience` |
| Déclenchement | les deux à moins de 6 m de `mist_narrows`, **sur deux rives opposées** (`opposite`: y au plus 39,0 pour l'un, au moins 42,0 pour l'autre), **tournés l'un vers l'autre** (`facing: "partner"`), immobiles, 3 s |

Apogée (9 s; la brume est un effet, sa « cible » ne bouge pas):

| t (s) | Ce qui se voit et s'entend |
|---|---|
| 0,0 | la lumière se réchauffe (teinte dorée, montée en 3 s, `lightGrade`) |
| 1,5 | la brume se lève et s'amincit en un front qui part de l'aval (x 44) vers le gué à 4 m/s; des volutes montent à 2,5 m sur le front; `mist_lift` (bus musique) |
| 3,0 | un merle chante dans les arbres de la rive nord (`blackbird_wake`, non localisé) |
| 5,1 | le front passe entre les deux joueurs: chacun voit l'autre en entier |
| 5,2 | un poisson saute entre eux en (29,0 ; 40,4): éclaboussure et ronds qui s'élargissent 2 s (`fish_jump`) |
| 6,0 | éclats de soleil sur l'eau du passage (tech-artist) |
| 9,0 | plus de brume de x 14 à 44 (le front continue vers l'ouest hors du cadre) |

Temps à l'écran: la brume couvre le cadre pendant toute l'apogée (9 s depuis chaque place); places des joueurs jamais cachées en orientation 0. État `after`: matin ordinaire, lumière rendue en 6 s. Départ sans apogée (8 h 30): la brume se dissipe sur place en 20 s, sans front ni son.

Ce qu'il faut voir de près (règle de la carte): la brume ne monte pas au-dessus des têtes (1,2 m en attente, sous les épaules d'un personnage de 1,7 m, pour qu'on reconnaisse l'autre); elle ne couvre pas les toits ni le banc de la berge (au nord de y 37, opacité 0); elle s'arrête au ponton (x 44) en s'effilochant, sans le traverser.

Modèles: aucun. Effets (tech-artist): nappes de brume (quadrilatères doux instanciés, un appel de dessin), volutes du front, éclats sur l'eau, ronds du poisson (réutiliser ceux du martin-pêcheur). Rendu: teinte de lumière `lightGrade` (`#FFD9A0`, force 0,35, à fixer par le directeur artistique).

Sons: `mist_ambience` (rivière toute proche et feutrée, gouttes qui tombent des herbes, boucle de 8 s, audible à 20 m, -6 dB pendant l'attente), `mist_lift` (accord ouvert qui monte, harpe et cordes douces, 4 s, bus musique, 2 variantes), `blackbird_wake` (phrase de merle, 3 s, 3 variantes), `fish_jump` (petit plouf, 0,4 s, 2 variantes).

Textes: confidence `moment_mist_hint` (de Firmin), apogée, souvenir, rumeur, lignes d'observation `moment_opposite_same_bank` et `moment_face_partner`. Récompense: Cœur +10 chacun.

#### 1.4.10 Les étoiles de l'Aubrune (`falling_stars`, ciel vu dans l'eau, nouveau)

**Raison d'être.** En août, la Terre traverse l'essaim des Perséides (« les larmes de saint Laurent », disaient les anciens): plusieurs étoiles filantes par minute, les nuits claires. La caméra ne montre pas le ciel, mais l'eau profonde et lente au pied du ponton le reflète comme un miroir quand il n'y a pas de vent: c'est le seul endroit du bourg où l'on s'assoit au-dessus d'une eau calme, dos aux lampadaires de la place (le plus proche, `lamp_square_south`, est à 7 m au nord, derrière les joueurs).

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 22 au moins; été; soleil (nuit claire); poids 2; `maxPerSeason` 2 |
| Présence | 22 h à 24 h; fenêtre de l'apogée 22 h à 23 h 30 (l'apogée de 10 s dure 29 minutes de jeu à 0,35 s par minute: elle finit avant minuit) |
| Point `stars_water` | (45,0 ; 40,6), l'eau au pied du ponton |
| Siège `pontoon_edge` | deux places: `pontoon_seat_west` (44,55 ; 39,80) et `pontoon_seat_east` (45,45 ; 39,80), tournées vers le sud (cap 180), assis au bord du plancher (0,5 m), jambes au-dessus de l'eau |
| Attente | sur l'eau, de x 41,5 à 48,5 et de y 40,5 à 42,8: 40 étoiles reflétées (points de 2 à 4 px qui tremblent avec les rides), et une étoile filante toutes les 15 à 25 s (ce qui attire le promeneur) |
| Déclenchement | les deux assis sur `pontoon_edge` pendant 3 s |

Apogée (10 s; chaque étoile filante est une traînée lumineuse posée sur l'eau, z 0,01):

| Étoile | t (s) | Départ (x ; y) | Arrivée (x ; y) | Ce qui se voit et s'entend |
|---|---|---|---|---|
| 1 | 0,0 à 0,6 | 42,5 ; 41,0 | 44,0 ; 42,2 | courte traînée; `star_chime` (note 1) |
| 2 | 2,4 à 3,0 | 47,8 ; 40,8 | 46,2 ; 42,4 | `star_chime` (note 2) |
| 3, la grosse | 4,5 à 5,9 | 41,8 ; 40,7 | 47,6 ; 42,6 | longue traînée qui éclaire l'eau autour d'elle 1 s et laisse une trace 1 s; à 4,6 s, les deux personnages lèvent la tête (`look_up`, 1,5 s); `star_chime` (accord) |
| 4 | 7,6 à 8,2 | 45,2 ; 40,9 | 43,6 ; 42,5 | `star_chime` (note 3) |
| 5 | 9,4 à 10,0 | 46,0 ; 40,6 | 47,4 ; 41,9 | `star_chime` (note 4) |

Le sens des traînées est celui d'un reflet: elles semblent tomber vers le sud, en s'éloignant du ponton. Temps à l'écran: 4,8 s de traînées visibles (M-02 et cadre), devant les jambes des joueurs en orientation 0; le reflet fixe reste là toute l'apogée. État `after`: le reflet et une étoile filante toutes les 15 à 25 s jusqu'à minuit. Départ sans apogée: le reflet s'éteint en 10 s à minuit.

Modèles: aucun. Effets (tech-artist): reflet d'étoiles et traînées en sprites émissifs instanciés (un appel de dessin, même programme que les vers luisants), lueur de la grosse étoile sur l'eau (un sprite additif, pas de lumière ponctuelle). Clips des joueurs: `sit_edge` (assis au bord, jambes pendantes qui se balancent, boucle de 4 s), `look_up` (1,5 s).

Sons: `star_chime` (notes de célesta d'une gamme pentatonique, 1,5 s, 5 variantes jouées dans l'ordre, bus musique: les étoiles filantes ne font aucun bruit, la musique les accompagne), `night_water` (clapotis contre les pieux du ponton, boucle de 6 s, audible à 12 m), `crickets_night` (déjà livré). Musique de la nuit à -9 dB pendant l'apogée.

Textes: confidence `moment_falling_stars_hint` (de Basile), apogée, souvenir, rumeur, ligne `moment_seat_edge`. Récompense: Cœur +10 chacun.

#### 1.4.11 La valse d'Odette (`odette_waltz`, un habitant, nouveau)

**Raison d'être.** Du temps où la ligne roulait, les pensionnaires de l'épicerie-pension Ferrand dansaient le soir sur la place. Depuis le bal de la fête des semailles (jour 16), Odette ressort certains soirs le phonographe de la pension et le pose sur le rebord de son comptoir, ouvert sur la place à l'est. Le pavé sous le lampadaire nord de la place (`lamp_square_north`, (34,5 ; 24,5)), à deux mètres du comptoir, est le seul coin éclairé et dégagé (le puits, la tonnelle et les bancs sont plus au sud). Odette ne danse pas: elle regarde, elle bat la mesure, elle applaudit.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 17 au moins (après le bal); printemps ou été; soleil ou nuages; poids 2; la confidence suppose d'avoir rencontré Odette (`hintFrom: odette`) |
| Présence | 20 h 30 à 22 h 30; Odette quitte sa porte (`grocery_door`) pour son comptoir (`grocery_counter`) le temps du moment, comme Basile pour l'échelle |
| Phonographe `odette_phonograph` | accroche sur le rebord du comptoir, (30,85 ; 26,0), à 1,0 m, pavillon tourné vers la place (est) |
| Piste `waltz_floor` | (33,4 ; 25,6), pavés, à 1,6 m du lampadaire et 2,5 m du comptoir |
| Places | `waltz_a` (33,0 ; 25,6), cap 90 (tourné vers l'est); `waltz_b` (33,8 ; 25,6), cap 270 (tourné vers l'ouest): face à face, à une longueur de bras |
| Geste | Espace à moins de 1,2 m d'une place libre: le personnage s'y place en 0,2 s et tend les mains (`waltz_ready`); une place prise ne se prend pas; toute touche de déplacement le fait lâcher |
| Attente | Odette remonte le phonographe (`odette_wind`, toutes les 20 s) et laisse tourner un disque à bas volume (`waltz_waiting`, audible à 18 m) |
| Déclenchement | les deux tiennent une place pendant 0,5 s |

Apogée (16 s; `pauseWhenReleased`, `pauseBefore` 14,0):

| t (s) | Joueurs | Odette | Ce qui se voit et s'entend |
|---|---|---|---|
| 0,0 | `waltz_ready` | `odette_needle` | elle remet l'aiguille au début du disque (`needle_drop`); bulle « Allez, en piste ! » |
| 0,8 | | `odette_sway` | la valse démarre (`waltz_odette`, 15 s); la musique du jeu baisse de 18 dB |
| 1,0 à 14,0 | `waltz`, orbite d'un tour et demi autour de `waltz_floor` (rayon 0,4 m, sens des aiguilles d'une montre) | `odette_sway` | ils valsent sous le lampadaire; leurs ombres tournent avec eux |
| 14,0 à 15,0 | `waltz_bow` | | dernier tour, petit salut |
| 15,2 | | `odette_clap` | Odette applaudit (`odette_clap`); bulle « Bravo ! » |
| 16,0 | rendus à leur place | `odette_sway` arrêté | fin |

**Lâcher n'est jamais un échec.** Avant 14 s, si un joueur lâche, Odette soulève le bras du phonographe (`needle_lift`, la musique s'arrête net), bulle « On ne lâche pas en pleine valse ! » chez les deux; quand les deux tiennent de nouveau, elle repose l'aiguille et tout reprend au même instant. Après 14 s, on peut lâcher.

Temps à l'écran: 16 s (M-02 et cadre, aux deux zooms). Ligne de vue en orientation 0: rien ne cache la piste. Dans les orientations où la caméra est à l'ouest, l'épicerie cache la piste: la découpe des personnages s'applique déjà aux joueurs, et Odette, à son comptoir, est vue de face en orientation 0. État `after`: Odette reste au comptoir jusqu'à 22 h 30, le disque tourne de nouveau doucement, puis elle rentre. Départ sans apogée: à 22 h 30, elle ferme le phonographe et rejoint sa porte.

Modèles: `phonograph` (socle de bois de 0,32 x 0,32 x 0,15 m, plateau de 0,25 m, pavillon de laiton en fleur de 0,45 m de diamètre, manivelle sur le côté; origine au centre du socle); disque noir de 0,25 m. Clips des joueurs (squelette commun): `waltz_ready` (main droite tendue, boucle de 2 s), `waltz` (pas de valse à trois temps, 0,625 s par temps, boucle de 1,875 s, mains jointes), `waltz_bow` (1 s). Clips d'Odette: `odette_wind` (2 s), `odette_needle` (0,8 s), `odette_sway` (boucle de 1,875 s, au tempo), `odette_clap` (1,2 s).

Sons: `waltz_odette` (valse originale à trois temps, 96 noires par minute, 15 s jouées plus une fin, timbre de disque ancien: bande étroite, souffle et craquements légers; spatialisée au phonographe, audible à 30 m), `waltz_waiting` (la même, plus lointaine et plus filtrée, en boucle), `phonograph_wind` (manivelle à cliquets, 1,5 s), `needle_drop` (aiguille qui se pose, 0,6 s), `needle_lift` (rayure brève et silence, 0,4 s), `odette_clap` (applaudissements d'une personne, 1,2 s). Musique du jeu à -18 dB pendant la valse, pour que le disque soit seul.

Textes: confidence `moment_odette_waltz_hint`, apogée, souvenir, rumeur, bulles `odette_waltz_start`, `odette_waltz_pause`, `odette_waltz_bravo`, ligne `moment_waltz_take_place`. Récompense: Cœur +10 chacun.

#### 1.4.12 Le salut du mécanicien (`train_salute`, le train, nouveau)

**Raison d'être.** Le duo habite la maisonnette du garde-barrière: baisser les barrières du passage à niveau était le métier de la maison. Depuis la réouverture, elles se baissent seules au passage du train. La coopérative a gardé une vieille coutume de cheminots: quand le garde-barrière tourne lui-même la manivelle, le mécanicien ralentit au passage à niveau, salue de la casquette et donne deux coups de sifflet. Les deux barrières sont de part et d'autre de la voie (poteau nord (16,5 ; 11,5), lisse vers l'est au-dessus de la route; poteau sud (20,5 ; 15,5), lisse vers l'ouest): il faut être deux.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance, **seulement les jours du train** (`trainDays: "only"`); jour 22 au moins; tout temps sauf la neige; poids 1; `cooldownDays` 14 (une fois toutes les deux semaines au plus) |
| Présence | 15 h à 16 h 30; fenêtre pour armer: 15 h 20 à 16 h (14 s réelles à 0,35 s par minute, 32 s à 0,8) |
| Point `level_crossing` | (18,5 ; 13,5), existant, au milieu de la traversée en planches |
| Places | `gate_north_crank` (15,6 ; 11,5), sur le chemin à l'ouest du poteau nord, cap 90; `gate_south_crank` (21,4 ; 15,5), au bout du quai à l'est du poteau sud, cap 270. Chacune face à la manivelle de son poteau, à 3,5 m du milieu de la traversée |
| Geste | Espace à moins de 1,2 m d'une manivelle libre: le personnage la prend (`crank_hold`) |
| Armer | les deux tiennent 1 s: ils tournent ensemble (`crank_turn`, `gate_crank`), les lisses descendent en 2,5 s et se verrouillent (`gate_lock`); les cases de la traversée (x 17 à 19, y 12 à 14) deviennent infranchissables jusqu'au passage du train, et un joueur qui s'y trouve est poussé vers la case libre la plus proche, côté quai. Ensuite, on peut lâcher |
| Attente, avant d'armer | le train à quai; à 15 h, ligne `moment_crank_take` chez qui est à moins de 12 m d'une manivelle |
| Pas armé à 16 h | départ ordinaire (6 s, barrières automatiques), le moment passe à `left` sans texte |

Apogée (20 s, départ « au pas » à 16 h; positions de la cabine, côté sud, où se penche le mécanicien; le chauffeur se penche côté nord, en y 12,2):

| t (s) | x de la cabine | Clip | Ce qui se voit et s'entend |
|---|---|---|---|
| 0,0 | 44,5 | `train_depart` | sifflet de départ (déjà joué), le train s'ébranle vers l'ouest |
| 2,0 | 43,5 | | |
| 4,0 | 40,5 | | |
| 6,0 | 35,5 | | |
| 8,0 | 29,5 | | il ralentit (`train_slow_roll` en boucle) |
| 9,5 | 25,0 | `driver_wave` | le mécanicien et le chauffeur se penchent et agitent leur casquette; les deux personnages lèvent la main (`wave_back`, 2 s) |
| 10,0 | 24,2 | | deux coups de sifflet courts (`train_whistle_salute`, 10,0 et 10,6 s) |
| 11,0 | 21,6 | | purgeurs ouverts (`cylinder_cocks`, 2,5 s): deux jets de vapeur blanche au ras du ballast, puis un nuage qui roule sur la traversée |
| 12,5 | 19,0 | | la cabine passe la traversée, au pas (1,6 m/s) |
| 14,0 | 16,6 | `driver_lean` | |
| 15,5 | 13,6 | | |
| 17,0 | 9,0 | | il accélère |
| 18,5 | 2,0 | | |
| 20,0 | -8,0 | | hors de la carte; les lisses remontent seules à 18 s, les cases se libèrent |

Le décalage du train est `x de la cabine - 44,5` (cabine à quai, d'après `voie.ts`: voiture centrée sur `train_stop`, locomotive de x 43,25 à 50,65). Vitesse au passage à niveau: 1,6 à 1,7 m/s, pointe à 6,7 m/s en sortie. Temps à l'écran: M-02 5,8 s au pire (depuis la manivelle nord); cadre 5,9 s au zoom 0 et 10,4 s au zoom 1. Le joueur de la manivelle nord est derrière le train pendant son passage: découpe obligatoire du rendu (règle de la carte, déjà demandée pour le train). Le côté sud du train est celui que voit l'orientation 0; le chauffeur, côté nord, salue pour les orientations où la caméra est au nord.

Modèles: `rail_crew_driver` et `rail_crew_stoker` (mécanicien et chauffeur, bleus de travail, casquettes; attachés à la cabine de la locomotive, buste visible à la fenêtre); manivelle `level_crossing_crank` (volant de 0,30 m à rayons, à 1,0 m de haut sur chaque poteau, côté de la place du joueur; nœud animé, une révolution par seconde pendant l'armement). Clips des joueurs: `crank_hold` (boucle de 2 s), `crank_turn` (une révolution par seconde, 2,5 s), `wave_back` (2 s). Clips de l'équipage: `driver_wave` (casquette agitée, 2 s), `driver_lean` (penché, boucle). Effet (tech-artist): vapeur des purgeurs (particules, au ras du sol, poussées par le vent).

Sons: `gate_crank` (cliquets de manivelle, 2,5 s, 2 variantes, spatialisé à chaque poteau), `gate_lock` (verrou qui claque, 0,3 s), `train_slow_roll` (roulement lent sur les joints de rail, boucle de 2 s, suit la locomotive), `train_whistle_salute` (deux coups courts, 0,4 s chacun, distincts du sifflet de départ), `cylinder_cocks` (souffle de vapeur, 2,5 s).

Textes: confidence `moment_train_salute_hint` (de Firmin), apogée, souvenir, rumeur, lignes `moment_crank_take`, `moment_crank_partner`, `moment_gates_down`, `moment_crank_too_early`. Récompense: Cœur +10 chacun.

### 1.5 Points et objets de carte (level designer)

Par `outils/construire_carte_halte.py` (la carte ne se retouche pas à la main). Cases et sols vérifiés par le script (annexe B, partie 1).

| Identifiant | Nature | x ; y | Case et sol | Pourquoi là |
|---|---|---|---|---|
| `roe_deer_edge` | point (remplace celui du tour 6) | 62,2 ; 27,0 | (62, 27), bord `X` | la haie du bord est, au droit du pré |
| `roe_deer_graze` | point (déplacé) | 58,0 ; 27,0 | (58, 27), `.` | herbe rase du pré, rien de haut au sud-est |
| `fawn_bed` | point | 59,4 ; 25,9 | (59, 25), `,` | herbe haute à 1,8 m d'elle, sur l'axe horizontal de l'écran |
| `kingfisher_post` | point et accroche (existants) | 46,10 ; 39,90 | (46, 39), `~` | pieu au coin sud-est du ponton; modèle `mooring_post` à produire |
| `mist_narrows` | point | 29,5 ; 40,5 | (29, 40), `~` | milieu des trois mètres d'eau entre les deux bancs de sable |
| `mist_bank_north`, `mist_bank_south` | points (robots, indicatifs) | 29,5 ; 38,5 et 29,5 ; 42,5 | `b` et `b` | face à face, à 4 m |
| `stars_water` | point | 45,0 ; 40,6 | (45, 40), `~` | l'eau au pied du ponton |
| `pontoon_edge` | siège sans modèle, deux places | 44,55 ; 39,80 et 45,45 ; 39,80, cap 180 | sur le ponton | assis au bout, jambes au-dessus de l'eau |
| `waltz_floor`, `waltz_a`, `waltz_b` | points | 33,4 ; 25,6 / 33,0 ; 25,6 (cap 90) / 33,8 ; 25,6 (cap 270) | (33, 25), `+` | sous le lampadaire nord, à 2,5 m du comptoir |
| `odette_phonograph` | accroche `phonograph` | 30,85 ; 26,0 ; z 1,0 | rebord du comptoir | là où Odette sert, pavillon vers la place |
| `gate_north_crank`, `gate_south_crank` | points | 15,6 ; 11,5 (cap 90) / 21,4 ; 15,5 (cap 270) | `:` et `q` | à côté de chaque poteau, hors de la route |
| `level_crossing_crank_n`, `_s` | accroches `level_crossing_crank` | sur les poteaux, z 1,0, côté de la place | | la manivelle que l'on tourne |

Les places du train et de la valse sont hors des trajets des habitants; `gate_south_crank` est au bout du quai, où personne ne se tient à 16 h (Firmin est au `train_stop`, à 17 m). Contrôle visuel à faire de près: la lisse baissée passe au-dessus de la route et non de la voie, la manivelle est du côté de la place du joueur, le phonographe tient sur le rebord sans dépasser dans le mur.

### 1.6 Données: `moments.json` et `reglages.moments`

Mêmes champs que le tour 6 (section 3.1), plus ceux de la section 1.2. Valeurs:

| id | tier | mode | anchor | weight | cooldownDays | maxPerSeason | availableWhen | present | window | watch |
|---|---|---|---|---|---|---|---|---|---|---|
| `roe_deer` | P1 (tour 7) | ambient | `roe_deer_graze` | 2 | | | jour ≥ 9; printemps (jour de saison ≥ 9) ou été; soleil ou nuages | 06:00 à 08:30 | 06:00 à 08:30 | rayon 5,5, min 3, cible l'acteur `roe_deer`, `freeze` (6 à 10 s, regard 2 s, recul 1,5 m, reprise 4 s), `holdSeconds` 2 |
| `kingfisher` | P1 (tour 7) | ambient | `kingfisher_post` | 2 | | | jour ≥ 4; printemps, été ou automne; soleil | 09:00 à 12:00 | 09:00 à 12:00 | rayon 5,5, min 2,5, immobiles, 3 s |
| `mist` | P0 (tour 7) | ambient | `mist_narrows` | 3 | | | jour ≥ 2; printemps, été ou automne; `weather_was` pluie ou orage; soleil ou nuages | 06:00 à 08:30 | 06:00 à 08:30 | rayon 6, `opposite` (y, 40,5, 1,5), `facing: "partner"`, immobiles, 3 s |
| `falling_stars` | P0 (tour 7) | ambient | `stars_water` | 2 | | 2 | jour ≥ 22; été; soleil | 22:00 à 24:00 | 22:00 à 23:30 | rayon 3, assis sur `pontoon_edge`, 3 s |
| `odette_waltz` | P0 (tour 7) | ambient | `waltz_floor` | 2 | | | jour ≥ 17; printemps ou été; soleil ou nuages | 20:30 à 22:30 | 20:30 à 22:30 | rayon 3, `hold`: `waltz_a`, `waltz_b`, 0,5 s; `pauseWhenReleased`, `pauseBefore` 14 |
| `train_salute` | P0 (tour 7) | ambient, `trainDays: "only"` | `level_crossing` | 1 | 14 | | jour ≥ 22; pas de neige | 15:00 à 16:30 | 15:20 à 16:00 | rayon 4, `hold`: les deux manivelles, 1 s, `arm` (2,5 s, apogée à 16:00, verrou) |

Confidences: `odette` pour la chevrette et la valse, `jeanne` pour le martin-pêcheur, `firmin` pour la brume et le train, `basile` pour les étoiles. Ordre de production si le tour manque de temps: brume, martin-pêcheur, chevrette, étoiles, valse, train (du moins au plus dépendant: le train touche la voie, l'équipage et un départ propre).

`reglages.moments`, valeurs nouvelles:

```json
"noAmbientOnFestivalDays": true,
"festivalDays": [16, 23],
"cooldownDaysLong": 10,
"longFromDay": 24,
"seasonPoolFull": 9,
"unseenWeightFactor": 3,
"waltzMusicDuckDb": -18,
"starsMusicDuckDb": -9
```

Table d'équilibrage:

| Valeur | Initiale | Unité | Plage | Raison |
|---|---|---|---|---|
| `cooldownDaysLong` | 10 | jours | 7 à 14 | écart médian en été de 18 à 21 jours, sans moins de moments (annexe A, partie 7 et sensibilité); 14 ne gagne que 2 jours |
| `longFromDay` | 24 | jour | 24 | la démo et J1 restent identiques aux tirages épinglés |
| `seasonPoolFull` | 9 | moments | 6 à 12 | à 9, le printemps garde 0,5; l'hiver, avec 2 moments, tombe à 0,11 (1,9 moment par hiver, un écart médian de 21 jours au lieu de 11) |
| `unseenWeightFactor` | 3 | facteur | 1 à 4 | les douze vus en 173 jours en médiane au lieu de 254, 98 % des duos au lieu de 86 %; au-delà de 3, les premiers jours de J2 n'offriraient que du neuf, au détriment des retours aimés |
| `cooldownDays` du train | 14 | jours | 7 à 21 | un samedi sur deux au plus; à 7 il deviendrait un rite hebdomadaire, plus une surprise |
| `watch.radius` chevrette, martin-pêcheur | 5,5 | m | 5 à 6 | le faon et le pieu restent dans le cadre du zoom 0 depuis toute case (section 1.4) |
| `freeze.everySeconds` | 6 à 10 | s | 4 à 12 | assez pour avancer de 20 à 35 m entre deux regards (3,5 m/s), assez souvent pour qu'on la sente aux aguets |
| `freeze.lookSeconds` | 2 | s | 1,5 à 3 | le temps de dire « stop » et de s'arrêter; c'est aussi le `holdSeconds` du déclenchement |
| `arm` du train, fenêtre | 15 h 20 à 16 h | heures de jeu | 15 h à 16 h | 14 s réelles à 0,35 s par minute: le temps de marcher du quai aux deux manivelles (25 m au plus, 7 s) |
| `waltzMusicDuckDb` | -18 | dB | -12 à -24 | le disque doit être seul, comme un vrai phonographe dans le silence du soir |

### 1.7 Textes (`textes.json`, messages)

Tutoiement, rédaction neutre: aucun participe ni adjectif accordé au genre d'un joueur; « chacun » évité. Les noms de lieux et les heures parlées restent dans les répliques (« quatre heures »), l'heure de l'horloge dans les lignes du HUD (« 16 h »).

| Clé | Texte |
|---|---|
| `moment_roe_deer_hint` | Odette te l'a dit hier: « À l'aube, de ma porte, je vois une chevrette dans le pré de l'est. Si elle lève la tête, ne bougez plus: elle vous prendra pour des piquets. » |
| `moment_roe_deer_climax` | La chevrette baisse la tête et appelle tout bas. Dans l'herbe haute, un faon tacheté se lève, court à elle et tète un instant. Puis tous deux rentrent dans la haie, en bondissant. |
| `moment_roe_deer_memory` | La chevrette et son faon, un {weekday} matin. |
| `moment_roe_deer_rumor` | On dit qu'une chevrette vient au pré de l'est, avant le café. |
| `moment_freeze_graze` | Elle broute: approche. |
| `moment_freeze_look` | Ne bouge plus: elle regarde ! |
| `moment_roe_deer_startled` | Elle a vu bouger quelqu'un: elle recule un peu. Attends qu'elle broute. |
| `moment_kingfisher_hint` | Jeanne te l'a juré hier: « Il y a un oiseau bleu au bout du ponton, le matin. Bleu comme un bouton de veste ! » (inchangé) |
| `moment_kingfisher_climax` | Un éclair bleu plonge et ressort, un éclat d'argent au bec. Tac, tac, contre le pieu, et le poisson est avalé. Puis l'oiseau file au ras de l'eau. |
| `moment_kingfisher_memory` | Le martin-pêcheur du ponton, un {weekday} matin. |
| `moment_kingfisher_rumor` | On dit qu'un oiseau bleu pêche au bout du ponton. |
| `moment_mist_hint` | Firmin te l'a dit hier, sous la pluie: « Demain à l'aube, la brume couvrira l'Aubrune. Là où les deux bancs de sable se font face, la rivière n'a pas quatre mètres de large. » |
| `moment_mist_climax` | La lumière dore d'un coup. La brume se lève, de l'aval vers le gué, et vous voilà face à face, de part et d'autre de l'eau. Un poisson saute entre vous. |
| `moment_mist_memory` | La brume de l'Aubrune, un {weekday} matin, de part et d'autre de l'eau. |
| `moment_mist_rumor` | On dit qu'après la pluie, l'Aubrune fume au petit jour. |
| `moment_opposite_same_bank` | {partner} est sur la même rive que toi: l'un de vous deux doit passer de l'autre côté de l'eau. |
| `moment_face_partner` | Tourne-toi vers {partner}. |
| `moment_falling_stars_hint` | Basile te l'a dit hier: « En été, des étoiles tombent dans l'Aubrune. Gamin, je les regardais du bout du ponton, assis, sans un mot. » |
| `moment_falling_stars_climax` | Des étoiles filent dans l'eau noire. La plus grosse éclaire l'Aubrune d'un coup; vous levez la tête, trop tard. |
| `moment_falling_stars_memory` | Les étoiles de l'Aubrune, une nuit d'été, les pieds au-dessus de l'eau. |
| `moment_falling_stars_rumor` | On dit que des étoiles tombent dans l'Aubrune, les nuits d'été. |
| `moment_seat_edge` | Assieds-toi au bout du ponton ({act}). |
| `moment_odette_waltz_hint` | Odette te l'a dit hier: « Certains soirs, je sors mon phonographe. Sous le lampadaire de la place, le pavé est juste assez lisse pour une valse. » |
| `moment_odette_waltz_climax` | Odette remet le disque au début. Vous valsez sous le lampadaire, un tour et demi, et elle applaudit derrière son comptoir. |
| `moment_odette_waltz_memory` | La valse d'Odette, un {weekday} soir, sous le lampadaire. |
| `moment_odette_waltz_rumor` | On dit qu'Odette garde un phonographe sous son comptoir. |
| `odette_waltz_start` (bulle) | Allez, en piste ! |
| `odette_waltz_pause` (bulle) | On ne lâche pas en pleine valse ! |
| `odette_waltz_bravo` (bulle) | Bravo ! |
| `moment_waltz_take_place` | Prends une place face à {partner}, sous le lampadaire ({act}). |
| `moment_train_salute_hint` | Firmin te l'a dit hier: « Samedi, au départ de quatre heures, baissez les barrières à la main, une de chaque côté de la voie. Le mécanicien salue toujours les gardes-barrières. » |
| `moment_train_salute_climax` | Le train sort au pas. Au passage à niveau, le mécanicien et le chauffeur agitent leur casquette, deux coups de sifflet, et un nuage de vapeur roule sur la route. |
| `moment_train_salute_memory` | Le salut du mécanicien, au train d'un samedi. |
| `moment_train_salute_rumor` | On dit que les mécaniciens saluent quand on tourne la manivelle à la main. |
| `moment_crank_take` | Le train part à 16 h. Prends la manivelle d'une barrière ({act}). |
| `moment_crank_partner` | {partner} tient l'autre barrière. |
| `moment_gates_down` | Barrières baissées. Le train part à 16 h. |
| `moment_crank_too_early` | Trop tôt: on baisse les barrières à partir de 15 h 20. |

Rumeurs des six moments joués (onglet Souvenirs, section 2): `moment_heron_rumor` « On dit qu'un héron pêche au gué, certains après-midi. », `moment_geese_rumor` « On dit que des oies font halte sur l'Aubrune au printemps. », `moment_tits_rumor` « On dit que les mésanges aiment les nichoirs bien droits. », `moment_fox_rumor` « On dit qu'un renard suit la voie, à la tombée du jour. », `moment_glowworms_rumor` « On dit que le pré de l'est s'allume, certaines nuits douces. ». L'échelle, moment de quête, n'a pas de rumeur.

Relecture texte contre chorégraphie (M-06): chevrette (baisse la tête, appel `roe_call`, faon qui se lève et tète, bonds dans la haie: tout est dans les images clés); martin-pêcheur (plongeon, éclat du poisson, deux « tac », avalé par `kf_swallow`, vol au ras de l'eau); brume (teinte dorée, front de l'aval vers l'amont, poisson à 5,2 s); étoiles (cinq traînées, la grosse éclaire l'eau, `look_up` à 4,6 s, après le début de la grosse: « trop tard » est vrai); valse (aiguille remise, un tour et demi, applaudissements); train (sortie au pas, deux casquettes, deux coups de sifflet, vapeur).

### 1.8 Critères d'acceptation proposés (à rendre testables par qa-testeur)

| N° | Critère | Vérification |
|---|---|---|
| M-13 | La réserve compte 12 moments, chacun avec ses modèles, sons et textes (souvenir et rumeur compris) | validateur, comme M-01 |
| M-14 | Chaque apogée reste au moins 3,4 s à moins de 6 m de chaque case libre de l'anneau, ou de chaque place imposée (tenir, s'asseoir) | `tests/moments.test.ts`, seuil fixé à 6 m au lieu de `watch.radius`, places imposées lues dans `watch.hold` et `watch.bench`; valeurs attendues annexe B |
| M-15 | L'acteur principal des six nouveaux moments est dans le cadre du zoom 0, orientation 0, au moins 3,4 s depuis toute case ou place | test calculé sur la projection de la caméra (même formule que le script), et une capture par moment au zoom de départ |
| M-16 | Une capture en vrai jeu par moment nouveau montre l'anneau sous l'horloge et l'acteur dans le même cadre, chez l'hôte et chez l'invité, regardée de près (rien ne traverse le ponton, l'eau, le pavé, la haie) | `captures/tour-07/moment-<id>-hote.png` et `-invite.png` (réserve 3 du tour 6) |
| M-17 | Chevrette: bouger pendant un regard la fait reculer de 1,5 m, jamais au-delà de x 61,2, et jamais fuir; l'apogée part quand les deux restent figés un regard entier entre 3 et 5,5 m | tests unitaires avec deux robots (l'un bouge, l'autre non) |
| M-18 | Brume: rien ne part si les deux sont sur la même rive ou ne se font pas face; tout part s'ils sont sur deux rives, tournés l'un vers l'autre, 3 s | tests unitaires de `opposite` et `facing: "partner"` |
| M-19 | Valse: lâcher avant 14 s arrête la musique et l'orbite chez les deux, la reprise repart au même instant; après 14 s, lâcher ne coupe rien | test, comme M-09 |
| M-20 | Train: les lisses ne descendent que si les deux tiennent une manivelle entre 15 h 20 et 16 h; l'apogée part à 16 h; la traversée est infranchissable entre l'armement et la remontée des lisses; sans armement, départ ordinaire de 6 s | tests unitaires et robot |
| M-21 | Aucun moment d'ambiance les jours de fête; les jours du train, seul `train_salute` peut sortir; deux saluts sont séparés d'au moins 14 jours | robot longue vie (premier jet de la priorité 2 du tour 7), 8 graines |
| M-22 | Au long cours, écart médian entre deux passages d'un même moment d'au moins 19 jours au printemps et en été; jamais moins de 7 jours, jamais moins de 10 à partir du jour 24 | robot longue vie; simulation: 46 et 21 jours (annexe A, partie 7) |
| M-23 | Les tirages épinglés de la démo (`PYTHON_DEMOS`, `PYTHON_UNITS` de `tests/moments.test.ts`) sont remplacés par ceux de la réserve de 12, recalculés par le script (annexe A, partie 6, graines 1 à 8) | test existant, données mises à jour |
| M-24 | Le texte d'apogée des six nouveaux part à la fin de la chorégraphie, la récompense au début | test de QA6-07 étendu |
| M-25 | Onglet Souvenirs: critères S-10 à S-16 (section 2.6) | |

---

## 2. L'onglet Souvenirs du carnet

### 2.1 Ce qu'on veut ressentir

« Tu te souviens, la brume, ce mardi ? » Le carnet garde ce que le duo a vécu ensemble et que personne d'autre n'a vu: c'est l'album d'un couple, pas une collection. On l'ouvre pour se rappeler, pour se le montrer, et en refermant, une phrase entendue au bourg donne envie de sortir voir.

Trois règles:

1. **Rien de ce qui manque ne se voit.** Pas de « 7 sur 12 », pas de case grisée, pas de pourcentage, pas de silhouette de bête à découvrir, pas de rareté affichée. Seul ce qui a été vécu est écrit.
2. **Chacun lit son propre carnet.** Les mêmes souvenirs, mais racontés du point de vue de qui lit: qui était dans la confidence, qui avait le secret, qui a appelé les poules.
3. **On revient par curiosité, pas par devoir.** Une seule rumeur du bourg en bas de page, différente chez les deux joueurs: de quoi se dire « Toi aussi tu as entendu ça ? ».

### 2.2 Ce qu'il garde

| Sorte | Quand une entrée naît | Ce qu'elle garde |
|---|---|---|
| Moment vu ensemble | au début de l'apogée (même instant que la récompense; une sortie pendant l'apogée la compte, règle du tour 6) | le moment, le jour, la saison et l'année de la première fois; le destinataire de la confidence de cette première fois (s'il y en avait une) et son habitant; le nombre de fois vues ensemble; le jour de la dernière fois |
| Quête secrète finie (R16) | à la fin de la quête | la quête, le jour, qui était l'informé, si c'était du premier coup (`firstTry`), la variante (pour la réponse de Firmin) |
| Moment de quête (héron, oies, échelle) | comme un moment | comme un moment; il n'a pas de confidence |

Pas d'entrée pour un moment vu seul (l'apogée attend les deux: il n'y a rien à garder), ni pour un moment manqué.

### 2.3 Ce qu'il montre, chez chacun

Une page du carnet, onglet « Souvenirs » (`ui.notebookTabs.memories`, déjà prévu), en une colonne qui défile, du plus récent au plus ancien, avec un intercalaire par saison (« L'été, première année »). Chaque entrée tient en trois lignes à côté de sa vignette:

| Élément | Contenu | Exemple |
|---|---|---|
| Vignette | une illustration de 40 px (60 px à 150 %) à l'encre et au lavis, du même jeu que les icônes du carnet (`ui-maquettes/outils/icones-source.svg`), une par moment et par quête secrète (14), avec son texte de remplacement | le héron, cou en S, en vol au ras de l'eau |
| Titre | `texts.memory` du moment, ou titre de la quête secrète | « La brume de l'Aubrune, un mardi matin, de part et d'autre de l'eau. » |
| Date | jour, saison et année | « Jour 13 · printemps, première année » |
| Ligne à soi | dépend de qui lit (tableau suivant) | « {partner} était dans la confidence (Firmin). » |
| Retours | si vu plus d'une fois: « Vu deux fois ensemble », « trois fois », puis « souvent », et la dernière date | « Vu trois fois ensemble; la dernière, un jeudi soir d'été. » |

La ligne à soi:

| Cas | Chez qui avait la confidence ou le secret | Chez l'autre |
|---|---|---|
| Moment avec confidence d'un habitant | Tu étais dans la confidence ({habitant}). | {partner} était dans la confidence ({habitant}). |
| Moment avec confidence sans habitant (héron, oies, renard) | Tu avais eu un indice la veille. | {partner} avait eu un indice la veille. |
| Moment de quête | C'est {habitant} qui vous en avait parlé. | C'est {habitant} qui vous en avait parlé. |
| Les noms des poules | Odette te les avait confiés; {partner} les a appelées. | {partner} te les a soufflés; tu les as appelées. |
| Le mot de Lucie | Firmin t'a répondu: « {secret} » C'est {partner} qui l'a dit à Jeanne. | {partner} t'a confié la réponse de Firmin: « {secret} » Et tu l'as rapportée à Jeanne. |
| Premier coup (en plus) | Du premier coup. | Du premier coup. |

Aucune ligne n'accorde un participe au duo ni à un joueur (« vous y avait envoyés » ou « l'avais vu venir », qui s'accorderait aux oies, ont été écartés). Les participes restants s'accordent à « les » (les noms, les poules) ou « l' » (la réponse), jamais à un joueur. « {secret} » n'est permis chez l'autre qu'une fois la quête finie (l'autre a lui-même donné la bonne réponse à Jeanne): le validateur doit l'accepter dans `souvenirs.*` et le refuser partout ailleurs pour le rôle de l'autre.

Bas de page, la **rumeur du bourg** (`moment_<id>_rumor`): une seule ligne, en italique, précédée de « On dit au bourg... » rien d'autre. Elle porte sur un moment jamais vu ensemble, possible dans la saison en cours ou la suivante. Les deux joueurs n'ont pas la même: le premier joueur de la liste tire parmi les moments non vus d'index pair, l'autre d'index impair (s'il n'en reste qu'un, les deux ont la même; s'il n'en reste aucun, pas de rumeur et la page finit sur l'intercalaire de la saison). La rumeur change chaque matin, par empreinte (graine, joueur, jour), sans toucher au générateur. Elle dit moins qu'une confidence: un lieu vague, jamais l'heure exacte ni la pose.

Page vide (début de partie): « Pas encore de souvenir. Le bourg garde ses plus beaux moments pour les jours où l'on flâne à deux. », puis la rumeur.

Intercalaire de saison: au premier petit-déjeuner d'une saison, si la saison passée a au moins une entrée, une notification discrète « Une page du carnet se tourne: le printemps est fini. » et, dans l'onglet, l'intercalaire « Le printemps, première année » au-dessus de ses entrées. Pas de bilan chiffré.

### 2.4 Données et sauvegarde

`world.memories` (dans l'état, sauvegardé à l'aube et à la sortie comme le reste du monde, `dataSchema` + 1):

```json
"memories": {
  "moments": [
    { "id": "mist", "first": 13, "hintTo": "p2", "hintFrom": "firmin", "count": 1, "last": 13 }
  ],
  "secrets": [
    { "quest": "hen_names", "day": 7, "informed": "p1", "firstTry": true, "variant": 4 }
  ]
}
```

Une ligne par moment et par quête secrète, quel que soit le nombre de passages: au plus 12 x 70 octets et quelques quêtes, moins de 1,5 Kio pour toute la partie (contre 7 Kio pour l'historique actuel en 100 heures). Le jour de la semaine, la saison et l'année se déduisent du jour. Migration: une sauvegarde du format 3 construit `memories` depuis `history` (entrées `seen` seulement, `hintTo` inconnu: la ligne à soi est omise pour ces entrées) et `world.secrets.entries` (quêtes finies). Un joueur qui ne se reconnaît plus (écran « Qui joue qui ? ») garde les entrées: `hintTo` et `informed` suivent l'identifiant du personnage.

La plateforme (historique de Duo): proposition au manager, la ligne d'historique d'une séance peut citer les souvenirs nés pendant la séance (« Souvenir: la valse d'Odette »), sans changer ce qui compte comme résultat de la séance.

### 2.5 Retours et commandes

| Action | Retour |
|---|---|
| Ouvrir l'onglet (clic, ou Tab dans le carnet) | son d'ouverture du carnet déjà livré (`journal-open`), défilement en haut, sur l'entrée la plus récente |
| Survoler ou sélectionner une entrée (flèches haut et bas) | la vignette se colore légèrement; l'entrée passe au premier plan pour le lecteur d'écran |
| Nouvelle entrée pendant la séance | à la fin de l'apogée, la notification d'apogée porte « Dans ton carnet: Souvenirs » (son `journal-new` déjà livré); à l'ouverture suivante, l'entrée nouvelle a un petit filet de laiton jusqu'à ce qu'on l'ait vue |
| Fermer | Retour arrière ou la touche du carnet (jamais Échap, réservé à la pause) |

### 2.6 Critères d'acceptation de l'onglet

| N° | Critère | Vérification |
|---|---|---|
| S-10 | Chaque moment vu ensemble et chaque quête secrète finie ont une entrée, chez les deux, avec date, saison, année et vignette | test unitaire du modèle d'interface sur une partie de robots de 42 jours |
| S-11 | Aucun compteur de collection: le texte du DOM de l'onglet ne contient ni « sur 12 », ni « / », ni « % », ni nom de moment jamais vu (hors rumeur) | test Chromium, comme S-02 |
| S-12 | La ligne à soi diffère chez les deux pour un moment à confidence et pour chaque quête secrète; elle ne contient le secret chez l'autre qu'après la fin de la quête | test unitaire des deux points de vue |
| S-13 | Quand au moins deux moments possibles n'ont jamais été vus, les deux joueurs ont une rumeur différente; jamais de rumeur sur un moment déjà vu | test sur 8 graines |
| S-14 | `world.memories` reste sous 1,5 Kio après 372 journées de robot | robot longue vie |
| S-15 | Captures à 100 % et 150 % (1366 x 768), page vide, page d'une saison, page de deux années, chez les deux joueurs; à 150 %, une entrée tient sans couper son titre | `captures/tour-07/souvenirs-*.png`, regardées de près |
| S-16 | Le couple en parle | observation chez le client: « Avez-vous ouvert les Souvenirs ? Qu'est-ce que vous vous êtes dit ? » |

---

## 3. Simulation: ce que changent douze moments

Résultats complets en annexe A. Lecture:

1. **La démo s'enrichit sans changer de nature.** Avec la même chance (0,5), la démo passe de 4,8 à **5,2 moments** (p10 3, p90 7), dont 1,3 des moments nouveaux (martin-pêcheur 0,61, chevrette 0,42, brume 0,30 par démo; la valse, les étoiles et le train viennent après la démo). Aucune reprise à moins de 7 jours sur 20 000 graines. Les tirages des 8 graines du robot changent: ils sont listés en annexe pour remplacer ceux qu'épingle le test (M-23).
2. **J1 (jours 1 à 23)**: 7,5 moments, 6,2 sortes différentes; le salut du mécanicien sort au jour 22 une fois sur deux. Les jours de fête n'en ont aucun.
3. **Au long cours, la réserve tient au printemps et en été, pas encore à l'automne et en hiver.** La réserve d'ambiance compte 9 moments au printemps, 8 en été, 4 en automne et 2 en hiver. Avec la règle du tour 6 (0,5 fixe, 7 jours), l'hiver repasse le héron et le renard tous les 11 jours. La règle recommandée (chance réduite quand la réserve est petite, 10 jours dès J2) donne un écart médian de **46 jours au printemps, 21 en été, 20 en automne et 21 en hiver**, avec 7,4 moments au printemps, 7,3 en été, 3,4 en automne et 1,9 en hiver: l'hiver est calme, ce qui est juste pour un hiver, mais trop calme pour 21 journées de jeu. Il faut une réserve d'automne et d'hiver (grues, traces dans la neige, givre sur la voie, feu de la Saint-Martin...) avant l'arc A3 (jours 43 à 84).
4. **Les premières fois s'épuisent après l'année 1.** Même avec le coup de pouce, un duo vit 8,5 premières fois l'année 1, 2,7 l'année 2, puis presque plus. Pour garder au moins une première fois dans neuf saisons sur dix à partir de l'année 2, il faut **2 moments neufs par saison et par année** (1,8 première fois par saison, 11 % de saisons sans; à 1 par saison, 26 % de saisons sans). Sur les années 2 à 5, cela fait 32 moments de plus, à loger dans l'almanach des années (R9, système 16 du plan: « 60 événements rares »).

Limites: la météo d'après la démo est tirée selon FE-09 avec au plus 3 jours mouillés d'affilée, mais par une empreinte propre au script (le code de L1 n'existe pas encore); le duo est supposé assister à 70 % des moments d'ambiance (hypothèse, à remplacer par la mesure du robot longue vie); les moments neufs de la partie 10 sont génériques (poids 2, temps sec). La géométrie (annexe B) suppose des bâtiments pleins jusqu'au faîtage: c'est prudent (le renard joué y paraît caché 58 % du temps par le toit de la maisonnette, ce que les captures du tour 6 ne montrent pas), donc un « 0 % caché » est sûr, un pourcentage élevé est à recouper par capture.

Constats sur les moments joués, relevés en passant par le même script (pour le manager, hors de cette commande): les mésanges, au nichoir à 2,25 m, sortent par le haut du cadre du zoom 0 depuis les cases au sud-est de l'anneau (0 s dans le cadre depuis (53,5 ; 8,5); 4,5 s au zoom 1), et le houppier les cache dans les quatre orientations sans le trou tramé du rendu, qui reste donc indispensable.

---

## 4. Ce que chaque métier produit

| Métier | À produire |
|---|---|
| Artiste 3D | Modèles: `roe_deer`, `fawn`, `kingfisher`, `small_fish`, `mooring_post`, `phonograph` (et son disque), `rail_crew_driver`, `rail_crew_stoker`, `level_crossing_crank` (nœud animé sur les deux poteaux). Clips des bêtes: chevrette (8), faon (5), martin-pêcheur (5). Clips des joueurs, sur le squelette commun: `sit_edge`, `look_up`, `crank_hold`, `crank_turn`, `wave_back`, `waltz_ready`, `waltz`, `waltz_bow`. Clips d'Odette: `odette_wind`, `odette_needle`, `odette_sway`, `odette_clap`. Clips de l'équipage: `driver_wave`, `driver_lean`. Tailles réelles des fiches; le martin-pêcheur à x 1,5 si le directeur artistique le retient. Substituts à déclarer dans `src/rendu/substituts.ts` pour chaque objet nouveau (sinon `rendu.test.ts` échoue) |
| Sound-designer | 26 sons: chevrette 6 (`roe_call`, `fawn_rustle`, `fawn_bleat`, `deer_stamp`, `roe_bark`, `deer_bounds`), martin-pêcheur 3 (`kf_whistle`, `kf_dive`, `kf_beat`), brume 4 (`mist_ambience`, `mist_lift`, `blackbird_wake`, `fish_jump`), étoiles 2 (`star_chime` en 5 variantes ordonnées, `night_water`), valse 6 (`waltz_odette`, musique originale de 15 s plus une fin, `waltz_waiting`, `phonograph_wind`, `needle_drop`, `needle_lift`, `odette_clap`), train 5 (`gate_crank`, `gate_lock`, `train_slow_roll` en boucle suivie à la locomotive, `train_whistle_salute`, `cylinder_cocks`). Distances d'audition des fiches; descentes de musique: -6 dB par défaut, -9 dB pour les étoiles, -18 dB pour la valse. `mist_lift` et `star_chime` sur le bus musique (question S3 de `son.md`, déjà ouverte) |
| Dev gameplay | `moments.json` (six entrées), conditions `season_is`, `weather_was`, champs `freeze`, `opposite`, `facing: "partner"`, `arm`, `trainDays`, `cooldownDays` par moment, `climax.players` (orbite), `climax.train`, `hiddenUntil`; siège `pontoon_edge`; gestes « manivelle » et « valse » (variantes du geste « tenir »); règles du tirage 1 à 8 de la section 1.2 avec leurs réglages; verrou de la traversée; `world.memories` borné et sa migration, remplacement de `history` (si l'architecte le valide); robots: chaque pose nouvelle (se figer pendant un regard, passer sur l'autre rive et se faire face, s'asseoir au ponton, valser, armer les barrières avant 16 h); tirages épinglés recalculés (M-23); textes de la section 1.7 |
| Dev rendu | Lecteur de chorégraphies étendu: faon caché puis levé (l'herbe s'écarte), orbite des deux personnages pendant la valse, départ du train piloté par la piste de la cabine (au lieu de `trainOffset`), lisses baissées par les joueurs puis verrouillées, manivelles qui tournent, équipage penché aux deux côtés de la cabine; teinte `lightGrade` de la brume; découpe du joueur de la manivelle nord derrière le train; bêtes cachées par un bâtiment dans une orientation où la caméra est au nord-ouest (chevrette derrière la halte): même découpe que les personnages, ou silhouette |
| Tech-artist | Nappes de brume et volutes du front (un appel de dessin, mode léger à 4 nappes), reflet d'étoiles et traînées sur l'eau, lueur de la grosse étoile (un appel de dessin, programme des vers luisants), vapeur des purgeurs, traînée bleue du martin-pêcheur (0,3 s), gerbe et rides (plongeon, poisson de la brume), éclats de soleil sur l'eau; budgets du rendu au moment le plus chargé (brume au-dessus de la rivière avec les deux joueurs, train au passage à niveau) |
| Dev interface | Lignes d'observation nouvelles (section 1.7) dans l'ordre de `watchPart`: s'approcher pendant qu'elle broute, se figer, passer sur l'autre rive, se tourner vers {partner}, s'asseoir au bout du ponton, prendre une place pour la valse, prendre une manivelle, barrières baissées; l'anneau pendant le regard de la chevrette se remplit en 2 s et se vide si elle s'effarouche. Onglet Souvenirs (section 2): liste, vignettes (14 icônes nouvelles dans le sprite), intercalaires, ligne à soi, retours, rumeur différente chez les deux, page vide, notification d'intercalaire, captures à 100 et 150 % |
| Level designer | Points et accroches de la section 1.5, par le script de la carte |
| Directeur artistique | Teinte dorée de la brume, couleur des traînées d'étoiles, style des 14 vignettes, échelle du martin-pêcheur, revue de près du phonographe et des manivelles |
| QA | Critères M-13 à M-25 et S-10 à S-16 |

---

## 5. Périmètre

- **P0 du tour 7**: les six moments (dans l'ordre de production de la section 1.6), les règles du tirage 1 à 7, l'onglet Souvenirs avec sa rumeur, `world.memories`.
- **P1**: l'échelle rejouée au printemps 2 (règle 8, utile seulement quand la partie dépasse le jour 84), la ligne d'historique de la plateforme, l'intercalaire de saison avec sa notification.
- **Plus tard**: réserve d'automne et d'hiver (au moins 4 moments avant l'arc A3), 2 moments neufs par saison et par année ensuite; variantes saisonnières d'un même moment (la chevrette seule en automne, le héron sur la glace du gué en hiver); un journal lancé par le mécanicien lors du salut (amorce des annonces).
- **Hors périmètre**: compteur de collection, récompense de collection complète, moment vu par un seul joueur qui donnerait quelque chose, une bête qui fuit pour de bon, un train qui attendrait les joueurs (l'heure du train ne bouge jamais).

## 6. Questions ouvertes

1. **Pour le client: faire valser les deux personnages.** C'est le premier geste tendre entre les deux personnages du jeu (mains jointes, un tour et demi). Recommandation: oui; c'est aussi le geste du bal de la fête des semailles (J1), qui pourra le réutiliser.
2. **Pour le client: un train qui ralentit au passage à niveau.** Les jours du salut, le départ dure 20 s au lieu de 6, au pas devant la maisonnette. Recommandation: oui, seulement ces jours-là (un samedi sur deux au plus).
3. **Pour le directeur artistique: échelle de lisibilité du martin-pêcheur** (reste de la question 4 du tour 6). Recommandation: x 1,5 (0,25 m, 14 px au zoom de départ), décidée sur la capture M-16.
4. **Pour l'architecte (via le manager): remplacer `world.moments.history` par une mémoire bornée** (`lastEnd`, `seasonCount`, `memories`). Recommandation: oui, dans la même passe que l'onglet Souvenirs: l'historique actuel grossirait l'état transmis de 7 Kio en 100 heures.
5. **Pour le manager: l'hiver presque sans moment** (1,9 par hiver de 21 jours) tant que la réserve d'hiver n'existe pas. Recommandation: accepter pour J1 et J2 (le premier hiver commence au jour 64), et commander 2 moments d'automne et 2 d'hiver au tour qui ouvrira l'arc A3.
6. **Pour le manager: la chevrette change de lieu et de nom** (« La chevrette du pré », au lieu de la lisière nord, cachée par la remise et le chêne en orientation 0). Recommandation: valider; l'esquisse du tour 6 n'était pas produite.

---

## Annexe A: résultats de la simulation

`python3 -I docs/jeux/jeu-1/simulations/moments_rares.py` (environ 80 s, bibliothèque standard). Les parties 1 à 5 sont identiques à l'annexe A du tour 6, au caractère près (vérifié par `diff` avant et après la modification du script); seules les parties nouvelles sont reproduites.

```text
== 9. Taille de la réserve d'ambiance par saison (hors quête et hors train) ==
printemps: 9 (heron, geese, tits, fox, glowworms, roe_deer, kingfisher, mist, odette_waltz); chance réduite: 0.50
été: 8 (heron, fox, glowworms, roe_deer, kingfisher, mist, falling_stars, odette_waltz); chance réduite: 0.44
automne: 4 (heron, fox, kingfisher, mist); chance réduite: 0.22
hiver: 2 (heron, fox); chance réduite: 0.11

== 6. Démo (15 jours) et J1 (23 jours), réserve de 12, chance 0,5, 20 000 graines ==
période | moments (moy., p10, p90, min, max) | sortes vues (moy.) | reprises < 7 j | moments du tour 7 vus (moy.)
démo, jours 1 à 15 | 5.21, 3, 7, 1, 9 | 4.70 | 0 | 1.32
   par moment: fox 1.11, heron 1.04, geese 0.78, kingfisher 0.61, ladder 0.50, roe_deer 0.42, glowworms 0.32, mist 0.30, tits 0.15
J1, jours 1 à 23 | 7.47, 5, 10, 1, 14 | 6.15 | 0 | 2.59
   par moment: fox 1.43, heron 1.35, geese 0.82, kingfisher 0.75, roe_deer 0.68, train_salute 0.50, ladder 0.50, glowworms 0.47, mist 0.38, tits 0.29, odette_waltz 0.28

8 graines du robot, démo (réserve de 12):
graine 1: 6 moments | j5 fox, j6 heron*, j7 kingfisher, j10 roe_deer, j11 geese*, j13 mist
graine 2: 6 moments | j3 fox, j5 kingfisher, j7 heron, j10 ladder*, j13 fox, j14 tits
graine 3: 5 moments | j5 mist, j6 heron*, j9 glowworms, j11 geese*, j13 kingfisher
graine 4: 5 moments | j5 heron, j6 geese, j10 ladder*, j11 fox, j13 mist
graine 5: 5 moments | j3 fox, j6 heron*, j10 fox, j11 geese*, j14 kingfisher
graine 6: 5 moments | j3 fox, j6 heron, j7 geese, j10 ladder*, j13 tits
graine 7: 6 moments | j6 heron*, j7 fox, j9 kingfisher, j10 roe_deer, j11 geese*, j13 glowworms
graine 8: 5 moments | j5 geese, j6 fox, j7 heron, j10 ladder*, j14 roe_deer

== 7. 100 heures (372 journées, 4,4 années), réserve de 12, 2 000 graines ==
règle | saison | moments par saison | sortes par saison | écart médian (j) | écart p10 (j) | part des reprises dans la même saison
0,5 fixe, 7 j | printemps | 7.5 | 6.1 | 28 | 8 | 23%
0,5 fixe, 7 j | été | 8.3 | 6.2 | 18 | 8 | 26%
0,5 fixe, 7 j | automne | 6.3 | 4.1 | 14 | 7 | 35%
0,5 fixe, 7 j | hiver | 4.6 | 2.6 | 11 | 7 | 43%
0,5 réduite, 7 j | printemps | 7.5 | 6.1 | 40 | 9 | 24%
0,5 réduite, 7 j | été | 7.4 | 5.8 | 18 | 8 | 23%
0,5 réduite, 7 j | automne | 3.6 | 2.9 | 18 | 9 | 19%
0,5 réduite, 7 j | hiver | 1.9 | 1.7 | 21 | 11 | 13%
0,5 réduite, 10 j dès J2 | printemps | 7.4 | 6.3 | 46 | 12 | 19%
0,5 réduite, 10 j dès J2 | été | 7.3 | 6.1 | 21 | 11 | 17%
0,5 réduite, 10 j dès J2 | automne | 3.4 | 3.0 | 20 | 12 | 15%
0,5 réduite, 10 j dès J2 | hiver | 1.9 | 1.7 | 21 | 13 | 10%

== 8. Souvenirs: premières fois (2 000 graines, 0,5 réduite, 10 j dès J2, échelle rejouée au printemps 2;
   le duo assiste à 70 % des moments d'ambiance et à tous les moments de quête) ==
coup de pouce aux moments jamais vus | jour où les 12 sont vus (médiane, p90) | duos qui les voient tous en 100 h | premières fois par année (1 à 5) | jamais vus à la fin
x 1 | 254, 373 | 86% | 8.0, 2.5, 0.8, 0.4, 0.1 | 0.15
x 3 | 173, 273 | 98% | 8.5, 2.7, 0.6, 0.1, 0.0 | 0.02
(jour 373 = pas encore tous vus à la fin des 100 heures)

== 10. Apport nécessaire après l'année 1: k moments neufs par saison et par année (poids 2, temps sec),
   règle recommandée (0,5 réduite, 10 j dès J2, coup de pouce x 3), 70 % vus; premières fois par saison
   à partir de l'année 2 (moy., part des saisons sans aucune), moments par saison ==
k = 0: 0.26 premières fois par saison, 83% des saisons sans aucune, 5.2 moments par saison
k = 1: 1.07 premières fois par saison, 26% des saisons sans aucune, 6.0 moments par saison
k = 2: 1.78 premières fois par saison, 11% des saisons sans aucune, 6.6 moments par saison
k = 3: 2.32 premières fois par saison, 6% des saisons sans aucune, 6.9 moments par saison
```

Sensibilité de la fenêtre et de la chance (script jetable sur les fonctions du même fichier, 500 graines, chance réduite; moments par saison et écart médian en jours):

| Fenêtre | Chance | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|---|
| 7 j | 0,5 | 7,4 et 38 | 7,5 et 18 | 3,5 et 18 | 1,9 et 21 |
| 7 j | 0,4 | 6,0 et 45 | 6,0 et 21 | 2,9 et 21 | 1,6 et 21 |
| 10 j | 0,5 | 7,4 et 46 | 7,4 et 20 | 3,4 et 20 | 1,9 et 21 |
| 12 j | 0,5 | 7,3 et 49 | 7,3 et 21 | 3,4 et 21 | 1,9 et 21 |

(Ce tableau date d'avant la règle des jours de fête et de l'échelle rejouée, d'où un écart d'un jour avec la partie 7; la conclusion est la même: 10 jours atteint l'objectif en été sans retirer de moments, baisser la chance en retire 1,4 par saison.)

## Annexe B: contrôles géométriques sur la carte jouée

`python3 -I docs/jeux/jeu-1/simulations/moments_tour7_geometrie.py games/la-petite-ligne` (environ 50 s). Le script lit `cartes/halte.json` et `moments.json`, rejoue la spline de `sampleResolved`, et retrouve exactement les mesures du jeu sur les moments joués (`ETAT.md`, tour 6: héron 3,6 s, oies 3,75 s, renard 3,6 s, mésanges 3,7 s): c'est la preuve que la méthode est la même.

```text
== 1. Points nouveaux: case, sol, franchissable ==
roe_deer_edge        (62.20 ; 27.00)  case (62, 27) 'X' bord infranchissable (décor lointain: forêt, haies, champs), bloquée
roe_deer_graze       (58.00 ; 27.00)  case (58, 27) '.' herbe, libre
fawn_bed             (59.40 ; 25.90)  case (59, 25) ',' herbe haute, libre
kingfisher_post      (46.10 ; 39.90)  case (46, 39) '~' eau de la rivière (profonde), bloquée
kingfisher_dive      (46.60 ; 40.60)  case (46, 40) '~' eau de la rivière (profonde), bloquée
mist_narrows         (29.50 ; 40.50)  case (29, 40) '~' eau de la rivière (profonde), bloquée
mist_bank_north      (29.50 ; 38.50)  case (29, 38) 'b' berge (sable et galets), libre
mist_bank_south      (29.50 ; 42.50)  case (29, 42) 'b' berge (sable et galets), libre
pontoon_seat_west    (44.55 ; 39.80)  case (44, 39) '~' eau de la rivière (profonde), libre
pontoon_seat_east    (45.45 ; 39.80)  case (45, 39) '~' eau de la rivière (profonde), libre
waltz_floor          (33.40 ; 25.60)  case (33, 25) '+' pavés, libre
waltz_a              (33.00 ; 25.60)  case (33, 25) '+' pavés, libre
waltz_b              (33.80 ; 25.60)  case (33, 25) '+' pavés, libre
odette_phonograph    (30.85 ; 26.00)  case (30, 26) 's' sol de bâtiment, bloquée
gate_north_crank     (15.60 ; 11.50)  case (15, 11) ':' chemin de terre, libre
gate_south_crank     (21.40 ; 15.50)  case (21, 15) 'q' quai (dalles de pierre, bordure en bois), libre

== 2. M-02: pire temps à moins de 6 m (anneau ou places imposées), décompte arrêté à mi-fondu ==
moment | cases ou places | pire (s) | case du pire | verdict (3,4 s)
heron                        |  66 | 3.60 | (17.5 ; 34.5) | tenu
geese                        |  66 | 3.75 | (23.5 ; 34.5) | tenu
ladder                       |   2 | 8.25 | (51.6 ; 5.8) | tenu
tits                         |  61 | 3.70 | (46.5 ; 9.5) | tenu
fox                          | 100 | 3.60 | (9.5 ; 22.5) | tenu
glowworms                    | 107 | 8.05 | (56.5 ; 23.5) | tenu
roe_deer                     |  48 | 7.50 | (53.5 ; 24.5) | tenu
roe_deer, faon seul (info)   |  48 | 3.35 | (53.5 ; 29.5) | NON TENU
kingfisher                   |  37 | 4.40 | (46.5 ; 34.5) | tenu
mist                         |   6 | 9.05 | (29.5 ; 38.5) | tenu
falling_stars                |   2 | 4.80 | (44.5 ; 39.8) | tenu
odette_waltz                 |   2 | 16.05 | (33.0 ; 25.6) | tenu
train_salute                 |   2 | 5.80 | (15.6 ; 11.5) | tenu

== 2 bis. Acteur principal dans le cadre, orientation 0, caméra sur le joueur: pire temps de l'apogée ==
moment | durée vue | zoom 0 (16 m) | zoom 1 (24 m, départ)
heron                        |  7.4 s |  5.00 s, pire depuis (16.5 ; 43.5) |  6.10 s, pire depuis (16.5 ; 43.5)
geese                        | 16.3 s |  4.90 s, pire depuis (22.5 ; 35.5) |  6.35 s, pire depuis (20.5 ; 42.5)
ladder                       |  8.2 s |  8.25 s, pire depuis (51.6 ; 5.8) |  8.25 s, pire depuis (51.6 ; 5.8)
tits                         |  4.4 s |  0.00 s, pire depuis (53.5 ; 8.5) |  4.50 s, pire depuis (48.5 ; 2.5)
fox                          |  6.7 s |  4.10 s, pire depuis (12.5 ; 19.5) |  5.55 s, pire depuis (12.5 ; 19.5)
glowworms                    |  8.0 s |  8.05 s, pire depuis (56.5 ; 23.5) |  8.05 s, pire depuis (56.5 ; 23.5)
roe_deer                     |  8.8 s |  8.75 s, pire depuis (55.5 ; 22.5) |  8.85 s, pire depuis (55.5 ; 22.5)
roe_deer, faon seul (info)   |  8.8 s |  8.60 s, pire depuis (53.5 ; 29.5) |  8.85 s, pire depuis (55.5 ; 22.5)
kingfisher                   |  5.6 s |  5.20 s, pire depuis (49.5 ; 43.5) |  5.65 s, pire depuis (45.5 ; 34.5)
mist                         |  9.0 s |  9.05 s, pire depuis (29.5 ; 38.5) |  9.05 s, pire depuis (29.5 ; 38.5)
falling_stars                | 10.0 s |  4.80 s, pire depuis (44.5 ; 39.8) |  4.80 s, pire depuis (44.5 ; 39.8)
odette_waltz                 | 16.0 s | 16.05 s, pire depuis (33.0 ; 25.6) | 16.05 s, pire depuis (33.0 ; 25.6)
train_salute                 | 19.8 s |  5.90 s, pire depuis (21.4 ; 15.5) | 10.40 s, pire depuis (21.4 ; 15.5)

== 3. Ligne de vue de l'acteur principal pendant l'apogée (part du temps caché, premier obstacle) ==
moment | SE (défaut) | SO | NO | NE
heron                        |   0% |   0% |  16% (ferrand_shop) |  67% (ferrand_shop)
geese                        |   0% |   0% |  12% (ferrand_shop) |   0%
ladder                       |   0% |  42% (tree_oak_01:houppier) | 100% (tree_oak_01:tronc) | 100% (handcar_shed)
tits                         | 100% (tree_oak_01:houppier) | 100% (tree_oak_01:houppier) | 100% (tree_oak_01:houppier) | 100% (tree_oak_01:houppier)
fox                          |  58% (gatekeeper_house) |   0% |  96% (tree_oak_24:houppier) |  37% (sawmill)
glowworms                    |   0% |   0% |   0% |   0%
roe_deer                     |   0% |   0% | 100% (station) |   0%
roe_deer, faon seul (info)   |   0% |   0% | 100% (station) |   0%
kingfisher                   |   0% |   0% |   0% |   0%
mist                         |   0% |   0% |   0% |   0%
falling_stars                |   0% |   0% |   0% |   0%
odette_waltz                 |   0% | 100% (ferrand_shop) | 100% (ferrand_shop) | 100% (lamp_square_north)
train_salute                 |   0% |   0% |   5% (tree_oak_24:houppier) |   3% (tree_oak_24:houppier)

== 4. Places des joueurs: cachées en orientation 0 (hauteur des yeux 1,5 m, puis 0,9 m) ==
mist_bank_north      z 1.5: visible, z 0.9: visible
mist_bank_south      z 1.5: visible, z 0.9: visible
pontoon_seat_west    z 1.5: visible, z 0.9: visible
pontoon_seat_east    z 1.5: visible, z 0.9: visible
waltz_a              z 1.5: visible, z 0.9: visible
waltz_b              z 1.5: visible, z 0.9: visible
gate_north_crank     z 1.5: visible, z 0.9: visible
gate_south_crank     z 1.5: visible, z 0.9: ferrand_shop
gate_north_crank     pendant le passage du train: train (découpe obligatoire du rendu, règle de la carte)

== 5. Lieux écartés pour la chevrette (centre du corps à 0,35 m), orientation 0 ==
roe_deer_graze du tour 6 (52,5 ; 4,5): handcar_shed
bande au nord-ouest du chêne (49,0 ; 3,2): tree_oak_01:houppier
contre la maison de Firmin (48,6 ; 6,5): visible
roe_deer_graze du tour 7: visible
fawn_bed: visible
```

Lecture: « faon seul » est donné pour information (M-02 compte tout acteur, comme le test du jeu: la chevrette reste là 6,8 s). « gate_south_crank, z 0,9: ferrand_shop » vient du faîtage de l'épicerie compté plein, à 10,6 m sur le rayon: au plus les genoux du personnage, à recouper sur la capture M-16. Les points `kingfisher_post`, `mist_narrows` et `stars_water` sont dans l'eau: ce sont des cibles, pas des places; `odette_phonograph` est une accroche sur le rebord du comptoir, sans emprise.

## Historique

| Date | Version | Changement |
|---|---|---|
| 2026-11-01 | 1 | Première version (tour 7 du gauntlet, priorité 3 de la revue du tour 6) |
