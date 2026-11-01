# La Petite Ligne: conception du tour 6 (moments rares, informations propres)

| Champ | Valeur |
|---|---|
| Auteur | game-designer |
| Date | 2026-10-31 |
| Branche lue | `claude/stoic-lamport-lueey2` |
| Répond à | `gauntlet/revues/tour-05-game-designer.md`, priorités 1 et 2 (la priorité 3, s'asseoir, est déjà dans les données: `reglages.benches`, `stayed_at.seated`) |
| Règles du plan | R1, R8, R9 (variété), R13 (formes de quêtes), R15 (gestes à deux), R16 (savoirs propres à chaque joueur) de `plan-100-heures.md` |
| Simulation | `docs/jeux/jeu-1/simulations/moments_rares.py` (résultats en annexe A) |
| Destinataires | dev gameplay (simulation, données), dev rendu 3D, dev interface, artiste 3D, sound-designer, tech-artist, level designer (points de carte), qa-testeur |

## En bref

- **Moments rares**: une réserve de 8 moments vivants (6 en P0, 2 en P1), chacun avec un animal ou un geste qui bouge, un son et une raison d'être là. Au plus un par jour, environ un tous les trois jours, jamais le même deux fois en 7 jours. Le moment fort (« l'apogée ») ne se joue que quand les deux joueurs sont assez près pour le voir sur leurs deux écrans en même temps.
- **Informations propres (R16)**: deux quêtes où un seul joueur sait, l'autre agit, et seule la parole les relie. Semaine 1: « Les noms des poules » (nouvelle). Semaine 2: « Le mot de Lucie » (refonte). En bonus P1: « Le carnet perdu de Jeanne » en guidage. Le premier rôle d'informé revient au joueur 1, puis les rôles alternent. Une erreur n'a jamais de coût.
- **Fantasme visé**: « On a vu le héron s'envoler, tous les deux, et personne d'autre ne l'a vu. » Et pour R16: « Je sais quelque chose que tu ne sais pas, et j'ai hâte de te le dire. »

---

## 1. Les moments rares

### 1.1 Ce qu'on veut ressentir

Le bourg vit sans les joueurs. Une bête passe, un oiseau pêche, un voisin bricole, et si les deux joueurs sont là au bon moment, ils assistent à quelque chose de bref et beau. On n'y gagne presque rien (un peu de Cœur, un souvenir), et c'est voulu: le moment est une récompense en soi, qui pousse à flâner et à s'appeler (« Viens vite au gué ! »).

Trois principes:

1. **Ce qui se voit est vrai.** Chaque texte décrit ce qui bouge et ce qui s'entend à l'écran, rien de plus (correction de la réserve 1 du tour 5).
2. **À deux ou pas du tout.** L'apogée attend les deux joueurs; seul, on voit l'animal en attente, et le jeu souffle « Montre-le à {partner} ».
3. **Chaque bête est là pour une raison.** Le héron pêche là où l'eau est basse, les oies se reposent sur l'eau calme, le renard chasse les mulots dans l'herbe non fauchée, le nichoir est sur un vrai chêne de la carte qu'on ne coupera pas. Les raisons sont écrites dans chaque fiche (section 1.4).

### 1.2 Le système

#### Phases d'un moment

| Phase | Ce qui se passe | Fin de la phase |
|---|---|---|
| `absent` | rien à l'écran | l'heure `present.from` du jour où le moment a lieu |
| `waiting` | l'animal ou la scène est en place et joue sa boucle d'attente (le héron pêche, les oies flottent, le renard mulote); visible de quiconque passe; son d'attente spatialisé | apogée déclenchée (voir ci-dessous), ou heure `present.to` atteinte |
| `climax` | la chorégraphie de l'apogée, identique sur les deux machines, de durée `climax.seconds` | fin de la chorégraphie, puis `after` |
| `after` | l'état d'après (le héron se repose sur la grève d'en face, les vers luisants restent allumés) | heure `present.to` |
| `left` | chorégraphie de départ discrète (`leave`), sans texte ni récompense, si l'apogée n'a pas eu lieu | fin de la chorégraphie, puis `absent` |

#### Déclenchement de l'apogée

L'apogée part quand toutes ces conditions sont vraies **sans interruption pendant `watch.holdSeconds` secondes réelles**:

1. l'heure est dans `window` (`[from, to[`, heure de jeu);
2. **les deux** personnages sont à au plus `watch.radius` mètres de la cible (le point `anchor`, ou la position de l'animal s'il se déplace: renard, chevrette), et à au moins `watch.minRadius` mètres;
3. les deux sont dehors (`inHouse` faux), sans menu ouvert (`menu === null`), sans conversation (`dialogue === null`), ni absents, ni endormis;
4. si `watch.still`: les deux ont une vitesse au sol inférieure à `moments.stillSpeed` (0,05 m/s); si `watch.facing`: les deux regardent la cible à 30° près (même cône que `looked_at`, `LOOK_CONE`); si `watch.seated`: les deux sont assis sur le banc `watch.bench`; si `watch.hold`: les deux tiennent une des places `watch.hold` (geste « tenir », section 1.4.3).

Le compteur repart de zéro dès qu'une condition tombe. Si l'apogée a commencé, elle va jusqu'au bout, même si l'heure sort de la fenêtre ou si un joueur bouge (exception: l'échelle, qui se met en pause, voir 1.4.3).

**Pourquoi 6 mètres.** La vue la plus serrée fait 16 m de large (`camera.viewWidths[0]`), soit 9 m de haut à l'écran en 16:9; en isométrie (élévation 35,26°), un point au sol à d mètres « vers le haut de l'écran » se projette à d x 0,577, et un objet de 1 m de haut monte encore de 0,82 m. À 6 m: 6 x 0,577 + 0,82 = 4,28 m, sous la demi-hauteur de 4,5 m. Une cible à 6 m de chaque joueur est donc à l'écran chez les deux, à tous les zooms et dans les quatre orientations. Les moments qui volent (oies, héron) sortent ensuite du cadre; leur temps à l'écran est compté dans chaque fiche.

**Mêmes images au même instant.** L'hôte émet l'événement `moment_climax { moment, startTick }`; chaque machine joue la chorégraphie à partir de `startTick` dans son propre temps de simulation (l'invité affiche déjà les autres avec 50 à 250 ms de retard, ADR 0007). Écart attendu entre les deux écrans: sous 0,25 s; critère: sous 0,5 s.

**Pendant l'attente, un retour.** Quand un joueur remplit sa part (dans le rayon, et immobile, assis ou tenant selon le moment), son HUD affiche sous l'horloge une ligne discrète: `moment_watch_self` (« Sans bouger... »), ou `moment_watch_partner` (« {partner} n'est pas encore là. ») si l'autre manque. Quand les deux y sont, un anneau fin autour de l'horloge se remplit en `holdSeconds`, chez les deux. Un joueur qui entre seul dans `moments.noticeRadius` (12 m) d'un moment d'ambiance en attente voit une fois par moment `moment_notice` (« Montre-le à {partner} ! »). C'est ce qui répond au manque relevé au tour 5 (« rien n'indique qu'on regarde »).

**Le son de l'apogée.** La musique baisse de `moments.musicDuckDb` (6 dB) en 0,5 s au début de l'apogée et remonte en 2 s après sa fin, chez les deux.

#### Deux origines: quête et ambiance

- **Moment de quête** (`mode: "quest"` ou `"both"`, champ `quest`): présent chaque jour où la quête est active, dans `present`, jusqu'à ce que l'apogée ait lieu. Les jours où on le manque, il revient le lendemain: c'est la même « occurrence » qui continue (le héron revient pêcher l'après-midi tant qu'on ne l'a pas vu, les oies restent sur l'Aubrune). L'étape de quête est finie par la condition `moment_seen`.
- **Moment d'ambiance** (`mode: "ambient"` ou `"both"`): tiré le matin, présent ce jour-là seulement.

#### Le tirage du matin (à 6 h, sur l'hôte)

1. Si un moment de quête est présent aujourd'hui (quête active, ou quête qui démarre aujourd'hui d'après son `start.when` et ses jours fixes), c'est le moment du jour: pas de tirage.
2. Sinon, pas de moment les jours du train (`reglages.train.days`, 1, 8 et 15: jours chargés) ni avant `moments.firstAmbientDay` (2).
3. Sinon, tirer `u = unit(graine, "moment", jour)`; si `u >= moments.dailyChance` (0,5), pas de moment.
4. Sinon, choisir parmi les moments admissibles, au prorata de `weight`, avec `v = unit(graine, "moment_pick", jour)`. Un moment est admissible si: son `availableWhen` est vrai ce matin-là (jour, météo du jour, drapeaux); il n'est pas dans la fenêtre (`moments.cooldownDays` = 7: dernier jour de son occurrence précédente + 7 au plus tôt); sa quête n'est ni active ni prévue dans moins de 7 jours; il n'a pas atteint `maxPerSeason`; son `tier` est produit.
5. `unit(graine, clé, jour) = fmix32(fnv1a("<graine>:<clé>:<jour>")) / 2^32`. Comme `variantOf`, ce tirage **ne consomme pas le générateur de la partie**: ajouter ou retirer un moment ne change rien d'autre. `fmix32` est le mélange final de MurmurHash3 (constantes `0x85ebca6b`, `0xc2b2ae35`), écrit dans le script de simulation.

#### La règle des 7 jours

Un même moment ne commence jamais une nouvelle occurrence moins de 7 jours après la fin de la précédente (vue ou non), et deux apogées d'un même moment sont séparées d'au moins 7 jours. Le tirage ne peut pas la violer (étape 4); le robot la vérifie quand même (critère M-07). Une occurrence de quête qui dure plusieurs jours (on n'est pas venu) compte comme une seule occurrence, terminée le jour de l'apogée.

#### Confidence du matin (information propre, bonus R16)

Pour un moment d'ambiance, **un seul joueur** reçoit au petit-déjeuner une confidence qui dit où et quand (texte `texts.hint`). Le destinataire alterne à chaque moment d'ambiance (`world.moments.hintTurn`, premier: `moments.firstHint` = `p2`, pour que le joueur 2 ait la première information propre de la partie, le joueur 1 ayant la première quête secrète). Si la confidence vient d'un habitant (`hintFrom`) que ce joueur n'a jamais rencontré, elle va à l'autre; si aucun des deux ne l'a rencontré, pas de confidence. La confidence s'affiche sur l'écran du petit-déjeuner de ce joueur et reste dans son carnet (ligne « Aujourd'hui ») jusqu'à l'apogée ou au départ. Aucun moment de quête n'a de confidence (la quête l'annonce aux deux).

#### Récompense

- À l'apogée: Cœur `+moments.heartBonus` (10) à chaque joueur, une fois par jour (nouveau champ `heartToday.moment`), et le texte `texts.climax` en notification chez les deux (sorte `moment`, sinon `message`).
- Le moment entre dans l'historique (`world.moments.history`) avec le jour et le jour de la semaine. P1: un onglet « Souvenirs » du carnet affiche cet historique avec `texts.memory`.
- Les moments de quête gardent en plus la récompense de leur quête (sous).

#### Cas limites

| Cas | Règle |
|---|---|
| Pause de la plateforme (Échap) | tout se fige, chorégraphie comprise; reprise au même instant |
| Horloge arrêtée (les deux dans un menu) | l'apogée ne peut pas partir (condition 3); une apogée en cours continue (elle compte en temps de simulation, pas en heures de jeu) |
| Un joueur se déconnecte ou devient absent | attente: le moment reste en place, l'apogée ne part pas; apogée en cours: elle va au bout et compte comme vue par les deux |
| L'heure `present.to` arrive pendant l'apogée | l'apogée va au bout, puis `left` n'a pas lieu (l'état `after` se termine aussitôt) |
| Minuit, retour forcé | le moment passe à `absent` sans chorégraphie |
| Sauvegarde (aube, sortie) | sauvés: `history`, `hintTurn`, la confidence du jour; `today` est recalculé au chargement; une sortie pendant l'apogée la compte comme vue (la récompense est donnée au début de l'apogée) |
| Un joueur marche sur l'animal | l'animal a un rayon de collision (`collisionRadius`) et des réactions de timidité (`shy`): il recule ou se redresse, il ne fuit jamais pour de bon, ce qui serait punitif |
| Un habitant est là (Jeanne à la berge) | il regarde la cible pendant l'apogée (tête tournée), sans réplique |
| Deux joueurs dans des endroits différents | seul l'un voit l'attente; le jeu l'invite à appeler l'autre; rien ne se perd avant `present.to` |

### 1.3 Fréquence (simulation, annexe A)

Avec `dailyChance` = 0,5 et les 6 moments P0, une démo de 15 jours compte **4,8 moments en moyenne** (10 % des parties en ont 3 ou moins, 10 % en ont 6 ou plus; minimum 1, maximum 8), soit un jour sur trois environ, quêtes de moment comprises. **Aucune reprise à moins de 7 jours** sur 20 000 graines, y compris quand les joueurs repoussent les quêtes d'un ou deux jours. Les 8 graines du robot donnent 4 à 6 moments chacune (annexe A).

Lecture: 0,5 garde le mot « rare » (deux journées sur trois sans moment) tout en promettant au moins trois moments à neuf duos sur dix. 0,65 rendrait les moments attendus plutôt que surprenants. Avec les 2 moments P1, la même chance donne 5,7 moments par démo.

Long cours (indication pour R8 et R9): à une chance de 0,5, une saison de 21 jours compte environ 9 moments; avec une réserve de 6 moments par saison, le même revient en médiane tous les 10 jours, avec 12 moments tous les 19 jours. Le plan des 100 heures devra prévoir **au moins 12 moments par saison** pour que le retour d'un moment reste une surprise.

### 1.4 Les huit moments

Les coordonnées sont en mètres dans le repère de `cartes/halte.json` (x vers l'est, y vers le sud, 1 case = 1 m). La hauteur z est comptée depuis le sol, ou depuis la surface de l'eau pour ce qui flotte. Les durées sont en secondes réelles; les heures sont des heures de jeu (à 0,35 s par minute de jeu, une heure dure 21 s). Les chorégraphies sont des images clés `[t, x, y, z, clip]` (t depuis le début de l'apogée); le rendu interpole les positions par une spline de Catmull-Rom, oriente l'animal dans le sens du mouvement, et lance `clip` à l'image clé qui le porte.

Tailles: réelles. Exception proposée au directeur artistique pour les oiseaux de moins de 0,2 m (mésange, martin-pêcheur), lisibles à 7 à 10 pixels seulement: une échelle de lisibilité jusqu'à x 1,5, à décider en revue visuelle.

#### 1.4.1 Le héron du gué (`heron`, P0, quête et ambiance)

**Raison d'être.** Le gué est le seul endroit de l'Aubrune où l'eau est basse sur des galets (`g`, x 16 à 20, y 37 à 43): un héron y pêche à pied. Il se poste au bord aval du gué, là où l'eau basse plonge vers l'eau profonde et où les poissons se tiennent. L'eau coule vers l'est (`flow` de l'eau: +x), donc l'aval est le bord est. Le bourg passe au gué tous les jours: c'est un héron habitué aux gens, qui se redresse quand on approche mais ne s'en va pas.

| Élément | Valeur |
|---|---|
| Déclencheur, quête | quête `heron_watch` (variante 1 de `afternoon_d6`, jour 6, nuageux: un temps couvert où le héron pêche volontiers), puis chaque jour tant qu'elle est active |
| Déclencheur, ambiance | jour 4 au moins, soleil ou nuages, poids 3 |
| Présence | 14 h à 19 h (105 s réelles) |
| Point d'attente `heron_stand` | (20,6 ; 39,6), dans la lame d'eau du gué (case (20, 39), `g`), tourné vers l'est-sud-est (`facing` 0,3 rad); pattes dans 10 cm d'eau |
| Déclenchement | les deux entre 2,5 et 6 m de `heron_stand`, immobiles, tournés vers lui, pendant 4 s. On le regarde depuis la berge nord (vers (22,5 ; 35,5), à 4,5 m) ou depuis la grève sud (vers (17 ; 43,5)) |
| Timidité | un joueur à moins de 2,5 m: `heron_alert` (cou tendu, 1 s), puis deux pas vers le sud jusqu'à (20,6 ; 40,3) (`heron_shy_step`, 0,8 s); retour à `heron_stand` 5 s après le départ du dernier joueur proche. Le chemin du gué (x 17 à 19) passe à 1,6 à 3,6 m: le héron se redresse au passage, c'est un retour visible, pas un échec |
| Collision | rayon 0,3 m |

Apogée (7,4 s, version jouée depuis le tour 6: l'alerte tenue 2,6 s au lieu de 1 s pour tenir M-02), puis `after`:

| t (s) | x | y | z | Clip | Ce qui se voit |
|---|---|---|---|---|---|
| 0,0 | 20,6 | 39,6 | 0 | `heron_alert` | cou dressé, tête tournée vers le joueur le plus proche, tenu 2,6 s |
| 2,6 | 20,6 | 39,6 | 0 | `heron_takeoff` | il s'accroupit, trois battements lourds, crie à 3,8 s |
| 3,5 | 20,6 | 39,6 | 0,15 | | les pattes quittent l'eau sur place |
| 4,6 | 22,0 | 39,8 | 1,0 | `heron_fly` | il prend son vol, pattes pendantes |
| 5,6 | 26,0 | 40,8 | 2,0 | `heron_fly` | vol au ras de l'eau vers l'aval, cou replié en S, pattes tendues derrière |
| 6,6 | 28,8 | 41,9 | 1,0 | `heron_land` | freinage, pattes en avant |
| 7,4 | 29,5 | 42,3 | 0 | `heron_rest` | posé sur la grève d'en face (anse de sable, `b`, x 23 à 31, y 42), point `heron_rest_far` |

Sons datés (données): `heron_wings` à 2,6 s, `heron_croak` à 3,8 s, `heron_land` à 6,6 s.

Temps à l'écran: depuis la berge nord (places de la conception et des robots), le héron reste 3,4 s à moins de 6 m des deux (test `tests/moments.test.ts`); au pire, depuis une case libre de l'anneau, 3,6 s. Il se pose à 7 à 9 m, à l'écran au zoom moyen. État `after`: `heron_rest` en boucle à `heron_rest_far` jusqu'à 19 h. Départ (`leave`, et fin de `after`): il s'envole vers le sud-est, (29,5 ; 42,3 ; 0) vers (40 ; 47,5 ; 4) en 2 s, fondu sur la dernière demi-seconde (le bord sud est un décor infranchissable).

Modèle `heron` (héron cendré): hauteur debout 0,95 m (cou tendu 1,0 m), longueur 0,90 m, envergure 1,70 m, pattes 0,35 m; dos gris, cou blanc, bandeau noir au-dessus de l'œil, bec jaune de 0,12 m. Clips: `heron_idle` (boucle de 4 s: tête qui pivote, cou qui rentre; un `heron_strike` tous les 10 à 20 s, tirés par la graine du moment), `heron_strike` (0,8 s, cou lancé vers l'eau), `heron_alert` (1 s), `heron_shy_step` (0,8 s), `heron_takeoff` (1,4 s), `heron_fly` (boucle de 1 s, deux battements), `heron_land` (0,8 s), `heron_rest` (boucle de 4 s, cou rentré dans les épaules). Détail qui fait vrai: en vol, cou replié en S (et non tendu comme une cigogne).

Sons: `heron_wade` (pas dans l'eau peu profonde, 0,3 s, 3 variantes, un toutes les 6 à 12 s en attente, audible à 15 m); `heron_strike` (plouf court du bec, 0,4 s, 2 variantes); `heron_croak` (cri rauque « kraak », 0,6 s, 2 variantes, à t = 3,8 s); `heron_wings` (trois battements lourds, 1,4 s, à t = 2,6 s); `heron_land` (froissement d'ailes, 0,6 s, à t = 6,6 s).

Textes: confidence `moment_heron_hint`, apogée `heron_seen` (remplace le texte actuel, qui disait « sans un bruit »), souvenir `moment_heron_memory` (section 3.4).

Récompense: Cœur +10 chacun; en quête, 20 sous de Jeanne (inchangé).

#### 1.4.2 Les oies de l'Aubrune (`geese`, P0, quête et ambiance)

**Raison d'être.** Au printemps, les oies cendrées remontent vers le nord-est et font halte sur les rivières calmes. Elles se posent sur l'eau profonde devant le banc de la berge (le seul banc tourné vers la rivière, `riverbank_bench`, rotation 0, façade au sud), à l'est du gué, et repartent ensemble en fin d'après-midi. Le changement par rapport au tour 5 est voulu: vue du banc du quai, une volée « très haut » est hors de l'écran (la caméra isométrique ne montre pas le ciel); vue de la berge, on assiste à l'envol, puis la volée passe au-dessus des joueurs, de la place et du quai.

| Élément | Valeur |
|---|---|
| Déclencheur, quête | quête `wild_geese` (variante 1 de `afternoon_d11`, jour 11, soleil), puis chaque jour tant qu'elle est active |
| Déclencheur, ambiance | jour 5 au moins, soleil ou nuages, poids 2, `maxPerSeason` 1 (une seule halte par printemps); jamais si la quête est prévue plus tard |
| Présence | posées de 14 h à 18 h 30; apogée possible de 16 h 30 à 18 h 30 (42 s réelles) |
| Point `geese_rest` | (25,5 ; 40,0), eau profonde (cases x 24 à 27, y 39 à 40, toutes `~`), à 4,3 m du banc de la berge (28,0 ; 36,5) |
| Groupe | 9 oies en grappe lâche autour de `geese_rest`, décalages fixes (m): (0 ; 0), (-1,2 ; 0,4), (0,9 ; -0,5), (-0,4 ; 1,1), (1,4 ; 0,6), (-1,5 ; -0,7), (0,3 ; -1,3), (1,0 ; 1,4), (-0,9 ; -1,4) |
| Déclenchement, quête | les deux assis sur `riverbank_bench` pendant 5 s |
| Déclenchement, ambiance | les deux à moins de 6 m de `geese_rest`, dehors, 3 s (assis ou debout) |
| Avant 16 h 30 | assis sur le banc, rien ne part; ligne `geese_not_yet` dans le HUD des deux |

Apogée (16,8 s, version jouée depuis le tour 6: l'alerte tenue 2,8 s au lieu de 1 s pour tenir M-02; positions de l'oie de tête, les autres suivent):

| t (s) | x | y | z | Clip | Ce qui se voit |
|---|---|---|---|---|---|
| 0,0 | 25,5 | 40,0 | 0 | `goose_alert` | les neuf cous se dressent, premiers cris, tenu 2,8 s |
| 2,8 | 25,5 | 40,0 | 0 | `goose_run` | course sur l'eau vers l'est, ailes battantes, pattes qui frappent l'eau, gerbes d'eau |
| 3,8 | 26,1 | 40,0 | 0 | | la course prend de la vitesse |
| 5,8 | 31,0 | 39,9 | 0,4 | `goose_fly` | elles quittent l'eau |
| 6,8 | 35,0 | 38,0 | 2,0 | `goose_fly` | virage à gauche au-dessus de la langue de sable (x 27 à 34, y 38) |
| 7,8 | 37,6 | 34,4 | 3,6 | `goose_fly` | au-dessus du chemin de la berge |
| 8,8 | 39,4 | 30,6 | 5,0 | `goose_fly` | au-dessus de la place |
| 9,8 | 41,0 | 26,6 | 6,4 | `goose_fly` | au-dessus du puits (2,6 m de haut) |
| 10,8 | 42,5 | 22,6 | 7,8 | `goose_fly` | le V est formé |
| 11,8 | 44,0 | 18,6 | 9,2 | `goose_fly` | au-dessus du quai, à côté du panneau « Aubrune » |
| 12,8 | 45,5 | 14,6 | 10,6 | `goose_fly` | au-dessus de la voie |
| 14,8 | 48,5 | 6,6 | 13,4 | `goose_fly` | à l'est de la maison de Firmin (6 m de haut) |
| 16,8 | 51,5 | -1,4 | 16,2 | `goose_fly` | hors de la carte, fondu sur la dernière seconde |

Sons datés (données): `geese_alarm` à 0 s, `geese_takeoff` à 2,8 s, `geese_flight` à 5,8 s. Le départ sans apogée (`leave`, ambiance) garde l'ancien rythme de 14 s (alerte de 1 s): personne ne le regarde de près.

Cap: nord-nord-est, celui d'une migration de printemps. Vitesse au sol en vol: environ 4,5 m/s, volontairement ralentie (une vraie oie va à 15 m/s et traverserait la vue en une seconde); le battement d'ailes garde son rythme réel (3 par seconde), si bien que l'œil lit un vol et non un ralenti. Formation: de t = 5,8 à t = 10,8 s (de 3 à 8 s pour le départ sans apogée), chaque oie glisse (lissage en S) de sa place dans la grappe vers sa place dans le V: l'oie i (1 à 8) va sur le bras gauche si i est impair, droit si i est pair, au rang k = arrondi supérieur de i/2, à k x 2,2 m de l'oie de tête dans la direction du cap tournée de 145° (bras gauche) ou de -145° (bras droit). Passage à au moins 3 m au-dessus de tout obstacle de la trajectoire (puits, lampadaires, panneau, maison de Firmin, chêne de la remise: vérifié sur la liste des objets de la carte).

Temps à l'écran: la volée reste au moins 3,75 s à moins de 6 m de chaque case libre de l'anneau (test `tests/moments.test.ts`); au zoom moyen, on la suit jusqu'à environ 10 s au-dessus de la place.

Si l'apogée n'a pas eu lieu à 18 h 30: en ambiance, départ `leave` (même trajet, sans texte, les cris s'entendent de loin); en quête, elles restent (on ne les voit plus de 18 h 30 à 14 h le lendemain) et reviendront.

Modèle `goose` (oie cendrée): longueur 0,80 m, envergure 1,60 m, tête à 0,40 m au-dessus de l'eau quand elle nage; gris-brun, bec orange, pattes roses. Clips: `goose_swim` (boucle de 3 s, léger roulis, tête qui plonge parfois), `goose_alert` (1 s), `goose_run` (boucle de 0,4 s), `goose_fly` (boucle de 1 s, trois battements). Neuf instances d'un seul maillage.

Sons: `geese_rest` (murmures et caquètements de groupe, boucle de 6 s, audible à 20 m: c'est ce qui attire le passant); `geese_alarm` (cris montants, 1 s, à t = 0); `geese_takeoff` (ailes et pattes qui fouettent l'eau, cris, 3 s, à t = 1); `geese_flight` (chœur de neuf voix qui s'éloigne, 8 s, 3 variantes, panoramique qui suit la volée, à t = 3).

Textes: `moment_geese_hint`, `geese_seen` (réécrit), `moment_geese_memory`.

Récompense: Cœur +10 chacun; en quête, 20 sous de Firmin (inchangé).

#### 1.4.3 L'échelle de Basile (`ladder`, P0, quête seulement)

**Raison d'être.** Les douze arbres de la lisière sont à couper (`map.trees`): un nichoir n'y a pas sa place. Le grand chêne près de la remise de la draisine (`tree_oak_01`, (52,5 ; 5,5), arbre de décor qu'on ne coupe pas) est le seul vieux chêne sain près du bourg. Basile y a posé un nichoir quand la ligne a fermé; le vent l'a fait pendre de travers sur un seul clou. Le nichoir est donc là **dès le jour 1, penché de 25°**, dans toutes les parties: un détail que les curieux remarquent avant que l'histoire ne le nomme. Son entrée regarde le sud, vers l'espace ouvert (herbe, chemin, voie), à l'ombre du houppier.

| Élément | Valeur |
|---|---|
| Déclencheur | quête `basile_lost` (variante 1 de `afternoon_d10`, jour 10, nuageux), étape `help` |
| Objets permanents | `nest_box` sur la face sud du tronc: clou (52,50 ; 5,71 ; 2,015) sur l'écorce, centre de la caisse (52,50 ; 5,80 ; 1,84), trou à 1,89 m, entrée au sud, penché de 25° autour de l'axe nord-sud (il pend de son clou haut). Chicot `oak_branch_stub`: bout à (52,85 ; 5,95 ; 2,19) |
| Objets de quête | `ladder_wood` posée au **sud-ouest** du tronc, du début de la quête jusqu'à la fin de l'apogée: pied `ladder_foot` (51,77 ; 6,23), tête contre le tronc en (52,32 ; 5,68) à 2,90 m, soit 3,0 m de long à 75° du sol, axe sud-ouest vers nord-est |
| Basile | point d'emploi du temps `nest_oak_basile` (51,42 ; 6,58), derrière le pied de l'échelle, tourné vers le nord-est (cap 45°) |
| Places à tenir | `ladder_hold_east` (52,36 ; 6,42), cap 315° (tourné vers le nord-ouest); `ladder_hold_west` (51,58 ; 5,64), cap 135° (tourné vers le sud-est). Les deux sont à 0,55 m de l'axe, de part et d'autre, et à 0,28 m du pied vers le tronc: mains sur les montants |
| Geste « tenir » | Agir à moins de 1,2 m d'une place libre: le personnage s'y place en 0,2 s, face à l'échelle, et joue `hold_ladder`; toute touche de déplacement le fait lâcher. Une place prise par l'autre ne se prend pas (`ladder_hold_taken`) |
| Déclenchement | les deux tiennent pendant 0,5 s |

**Pourquoi cette hauteur et ce côté (décision du manager au tour 6, relue ici).** Le nichoir a été abaissé de 0,56 m (centre de 2,40 à 1,84 m) et l'échelle déplacée de la face ouest au sud-ouest. Contrôle de cohérence: le clou est à 2,02 m, hors de portée confortable d'un homme qui doit taper au marteau (on cloue à hauteur de poitrine, pas bras tendus au-dessus de la tête); sur le troisième barreau (pieds à 0,84 m), la poitrine de Basile arrive vers 2,05 m, juste à hauteur du clou. Trois barreaux suffisent donc, et l'échelle de 3 m dépasse le point de travail d'un mètre, comme on la pose vraiment. Le nichoir est à 0,63 m à sa droite, à portée de bras. Réserve: 1,84 m est bas pour un nichoir à mésange (on les pose plutôt à 2 m et plus, à l'abri des chats); acceptable ici, le chêne est loin des maisons.

Apogée (8,2 s, version jouée):

| t (s) | Basile | Ce qui se voit et s'entend |
|---|---|---|
| 0,0 à 0,5 | `walk` de (51,42 ; 6,58) au pied (51,77 ; 6,23) | |
| 0,5 à 2,3 | `climb_ladder`, 3 barreaux (0,6 s chacun), pieds de 0 à 0,84 m, le long de l'échelle vers (51,93 ; 6,07) | `ladder_step` à 0,5, 1,1 et 1,7 s; l'échelle vibre de 1 cm |
| 2,3 à 3,1 | `reach_up` vers le nichoir | le nichoir pivote de 25° à 0° (douceur en S), `nest_box_turn` à 2,3 s |
| 3,1 à 4,9 | `hammer_tap` trois fois | `hammer_tap` à 3,35, 3,95 et 4,55 s |
| 4,9 à 7,4 | `climb_ladder` à l'envers, 3 barreaux (0,83 s chacun) | `ladder_step` à 4,9, 5,73 et 6,57 s |
| 7,4 à 8,2 | recule jusqu'à (51,42 ; 6,58) sans se retourner (marche jouée à l'envers) | une mésange bleue arrive du houppier à 7,3 s, se pose sur le toit du nichoir de 7,6 à 8,0 s, `tit_call` à 7,8 s, repart à 8,0 s |

**Lâcher l'échelle n'est jamais un échec.** Si un joueur lâche pendant les 7,4 premières secondes (`pauseBefore`), Basile s'arrête (clip figé), dit `ladder_hold_on` (« Tenez bon, là en bas ! », bulle chez les deux), et reprend au même instant quand les deux tiennent de nouveau. Après 7,4 s, Basile est au sol: on peut lâcher. L'étape `help` est finie par `moment_seen: ladder`. L'échelle disparaît à la fin de l'apogée; Basile reste au chêne jusqu'à 18 h.

Réserve de lisibilité (captures `moment-ladder.png`, `faune-echelle-sequence.png`): la mésange ne reste que 0,4 s sur le toit, au moment où Basile recule; c'est le « merci » de la scène, il passe presque inaperçu. Dans l'orientation de caméra par défaut, le joueur à `ladder_hold_east` est entre la caméra et l'échelle et cache le haut du corps de Basile pendant la montée. Propositions au tour 7: mésange posée 1,2 s (fin d'apogée à 9 s, sans toucher au reste), et silhouette ou léger fondu du personnage qui masque l'acteur principal d'un moment (rendu), plutôt que de déplacer les places.

Effets de fin: drapeau `nest_box_straight` (le nichoir reste droit pour toujours; il ouvre le moment des mésanges).

Modèles: `ladder_wood` (3,0 m, 0,45 m de large, 10 barreaux espacés de 0,28 m, le premier à 0,28 m; montants de 0,05 x 0,07 m; origine au milieu du pied); `nest_box` (0,15 m de large, 0,25 m de haut, 0,18 m de profondeur, toit débordant de 0,04 m, trou de 28 mm, le diamètre d'un nichoir à mésange bleue, à 0,17 m du bas; bois grisé, toit de planche goudronnée; origine sur le clou, en haut au milieu du dos, pour la rotation); `blue_tit` (mésange bleue, 0,12 m, calotte bleue, ventre jaune). Clips de Basile, sur le squelette commun: `climb_ladder` (0,6 s par barreau à la montée, 0,83 s à la descente, en place: le rendu déplace la racine le long de l'échelle), `reach_up` (0,8 s), `hammer_tap` (0,6 s). Clip des joueurs: `hold_ladder` (boucle de 2 s, mains sur un montant à 0,9 et 1,2 m, pieds écartés, léger appui). Clips de la mésange: `tit_perch` (boucle de 2 s, sautille, tourne la tête), `tit_fly` (boucle de 0,2 s), `tit_sing` (1,5 s), `tit_enter` (0,3 s), `tit_exit` (0,3 s). Le personnage de Basile porte déjà un marteau (geste `hammer` de la construction).

Sons: `ladder_lean` (choc sourd du bois contre l'écorce, 0,4 s, au démarrage de la quête quand un joueur est à moins de 15 m), `ladder_grip` (craquement des montants, 0,5 s, 3 variantes, quand on prend une place), `ladder_step` (barreau qui craque, 0,25 s, 4 variantes), `nest_box_turn` (couinement de bois sur le clou, 0,6 s), `hammer_tap` (petit marteau sur un clou, 0,2 s, 3 variantes), `tit_call` (« tsi-tsi-tsi », 0,8 s, 3 variantes).

Textes: étape et répliques de Basile réécrites (section 3.5), `ladder_hold_on`, `ladder_hold_taken`, texte de fin `basile_lost` (« Le nichoir est droit. 30 sous de Basile. », inchangé et désormais vrai à l'écran).

Récompense: Cœur +10 chacun et 30 sous de Basile (inchangé).

#### 1.4.4 Les mésanges du nichoir (`tits`, P0, ambiance)

**Raison d'être.** En avril et mai, les mésanges bleues bâtissent leur nid de mousse. Une fois le nichoir redressé, un couple s'y installe: c'est la suite visible du coup de main à Basile (« Les mésanges vous diront merci au printemps »).

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; drapeau `nest_box_straight`; jour 4 au moins; soleil ou nuages; poids 3 |
| Présence | 8 h à 11 h (63 s réelles) |
| Point `nest_box` | (52,50 ; 5,80), centre de la caisse à 1,84 m, trou à 1,89 m |
| Perchoirs | toit du nichoir (52,50 ; 5,835 ; 1,97); chicot `oak_branch_stub` (branche morte de 0,6 m sur la face sud du chêne, sous le houppier, à hauteur du nichoir): bout à (52,85 ; 5,95 ; 2,19) |
| Attente | une mésange va et vient entre le chicot et le toit du nichoir toutes les 2 s (`tit_perch`, `tit_fly`), `tit_song` toutes les 8 s |
| Déclenchement | les deux à moins de 6 m de `nest_box`, dehors, 2 s |

Apogée (4,6 s): t = 0, mésange A au chicot, un brin de mousse au bec (`moss_tuft`, 0,04 m, attaché au bec); 0,6 s, elle se pose sur le toit du nichoir; 0,6 à 1,8 s, elle regarde autour; 1,5 à 4,0 s, mésange B chante au chicot (`tit_sing`); 1,8 s, A descend devant le trou (52,50 ; 5,93 ; 1,85, pattes au bord sous le trou); 2,1 s, elle entre (`tit_enter`, puis cachée); 4,0 s, elle ressort sans la mousse (`tit_exit`); 4,3 s, A et B s'envolent vers le houppier (fondu à 4,6 s, cachées par le feuillage). Après: l'attente reprend jusqu'à 11 h.

Modèles: `blue_tit` (deux instances), `moss_tuft`, `oak_branch_stub`. Sons: `tit_song` (« tsi-tsi-tsuhuhuhu », 1,8 s, 3 variantes, audible à 12 m), `tit_wings` (froissement, 0,2 s).

Confidence (de Basile): `moment_tits_hint`. Apogée: `moment_tits_climax`. Souvenir: `moment_tits_memory`. Récompense: Cœur +10 chacun.

Note: les parties où le jour 10 tire la variante 0 n'ont pas ce moment dans la démo (nichoir resté penché); la simulation en tient compte (0,23 par démo).

#### 1.4.5 Le renard de la voie (`fox`, P0, ambiance)

**Raison d'être.** Les renards suivent les voies ferrées comme des couloirs. La grande pelouse non fauchée entre la voie et la maisonnette (x 2 à 12, y 15 à 20, réservée au plan de la maison du jeu complet: rien de fixe n'y est posé) abrite des mulots; au crépuscule, le renard vient y « muloter » (il écoute, puis saute à pieds joints dans l'herbe). Il ne s'approche pas du poulailler, fermé le soir.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 3 au moins; soleil ou nuages; poids 3 |
| Présence | 19 h à 21 h 30 (52,5 s réelles) |
| Arrivée (`waiting`, 5 s) | au trot (2 m/s, `fox_trot`) le long du ballast depuis le bord ouest (0,2 ; 13,5) jusqu'à (5,5 ; 13,5), puis descente vers (7,0 ; 16,0) et (7,5 ; 17,0) |
| Point `fox_mousing` | (7,5 ; 17,0), herbe, à 4 m du mur nord de la maisonnette |
| Attente | boucle d'environ 7 s: `fox_listen` (2,5 s, tête penchée, oreilles), `fox_pounce` (1,2 s, saut en arc: 1,0 m vers l'avant, sommet à 0,9 m), `fox_sniff` (2 s), puis quelques pas vers un nouveau point tiré à moins de 1,5 m de `fox_mousing` |
| Déclenchement | les deux à moins de 6 m du renard, **dehors**, 2 s |

Pourquoi « dehors »: vue de l'intérieur, la caméra regarde du sud-est et le mur nord de la maisonnette (environ 3 m) cache le sol sur 4 m derrière lui; un renard derrière ce mur ne se verrait pas.

Apogée (6,9 s, version jouée depuis le tour 6: il regarde encore 1,3 s après ses jappements, pour tenir M-02): 0 à 1,0 s, il s'arrête et regarde le joueur le plus proche (`fox_look`); 1,0 à 2,2 s, deux jappements (`fox_bark`, son à 1,0 s; `hens_alarm` à 1,2 s si les poules sont là); 2,2 à 3,5 s, il regarde encore (`fox_look`); 3,5 à 6,9 s, demi-tour au trot à 3 m/s par (7,0 ; 16,0), (5,5 ; 13,5), puis vers l'ouest le long de la voie jusqu'à (0,2 ; 13,5), fondu sur la dernière demi-seconde. À l'écran chez les deux: au moins 3,6 s à moins de 6 m depuis toute case libre de l'anneau. Départ sans apogée (21 h 30): même trajet, sans jappement.

Modèle `fox` (renard roux): 0,40 m au garrot, corps de 0,65 m, queue de 0,40 m; roux, gorge et bout de queue blancs, pattes noires. Clips: `fox_trot` (boucle de 0,6 s), `fox_listen` (2,5 s), `fox_pounce` (1,2 s, en place: le rendu suit l'arc), `fox_sniff` (2 s), `fox_look` (1 s), `fox_bark` (1,2 s). Sons: `fox_pounce` (froissement d'herbe, 0,5 s, 2 variantes), `fox_bark` (deux jappements rauques, 1,2 s, 2 variantes, audible à 25 m); si les poules sont là, `hens_alarm` (caquètement inquiet, 1,5 s) depuis le poulailler à t = 1,2 s.

Confidence (perçue la veille): `moment_fox_hint`. Apogée: `moment_fox_climax`. Souvenir: `moment_fox_memory`. Récompense: Cœur +10 chacun.

#### 1.4.6 Les vers luisants du pré (`glowworms`, P0, ambiance)

**Raison d'être.** Fin mai et juin, par nuit douce, les femelles du ver luisant grimpent sur les herbes hautes et allument leur lanterne vert-jaune; elles fuient la lumière des lampadaires. Le pré de l'est (zone `meadow`, x 50 à 61, y 24 à 33) est le seul endroit d'herbes hautes à l'écart des lampes (le lampadaire le plus proche, `lamp_square_south` (47,5 ; 32,5), est à 9,5 m du centre).

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 9 au moins (fin du printemps); soleil (nuit claire et douce); poids 2 |
| Présence | 21 h à 23 h 30 (52,5 s réelles) |
| Point `meadow_glow` | (56,5 ; 29,5) |
| Lumières au sol | 25, tirées par la graine du monde (tirage de Poisson, écart minimal 0,8 m) sur les cases d'herbe haute (`,`) d'une ellipse de 4,5 x 3,5 m autour du centre, hors du buisson (58,5 ; 29,5) et des rochers (56,5 ; 27,5) et (60,5 ; 32,5); z de 0,05 à 0,30 m (sur une tige) |
| Lumières volantes | 6, marche au hasard dans l'ellipse, z de 0,4 à 1,6 m, 0,3 à 0,5 m/s, un éclat de 0,15 s toutes les 1,2 à 2,0 s |
| Attente | 5 lumières au sol allumées, les autres éteintes |
| Déclenchement | les deux à moins de 6 m de `meadow_glow`, dehors, 2 s |

Apogée (8 s): de 0 à 4 s, les lumières au sol s'allument une à une depuis le centre (front qui avance à 1,2 m/s); les volantes descendent vers la lumière au sol la plus proche puis repartent; chaque lumière au sol « respire » (intensité de 60 à 100 % sur 3 à 5 s). Après: tout reste allumé jusqu'à 23 h 30, puis s'éteint en 10 s. Couleur: vert-jaune (proposition #B8F05A, à fixer par le directeur artistique). Aucune lumière ponctuelle: des sprites émissifs instanciés (un appel de dessin, budget du tech-artist); en mode léger, pas moins de 12 lumières au sol.

Sons: `crickets_night` (grillons champêtres, qui chantent bien en mai et juin, boucle de 8 s, audible à 20 m; en attente à -6 dB, à pleine force pendant l'apogée en 4 s); `glow_shimmer` (quatre notes pentatoniques douces, timbre de célesta ou de verre, 3 s, 2 variantes, bus musique, à t = 0,5 s).

Confidence (d'Odette): `moment_glowworms_hint`. Apogée: `moment_glowworms_climax`. Souvenir: `moment_glowworms_memory`. Récompense: Cœur +10 chacun.

#### 1.4.7 La chevrette de la lisière (`roe_deer`, P1, ambiance)

**Raison d'être.** Le chevreuil sort au bord des bois à l'aube pour brouter. Entre la maison de Firmin (x 41 à 48) et la remise (x 54 à 60), une bande d'herbe touche directement le bois du bord nord (décor infranchissable, y < 2): c'est le seul endroit où le bois descend jusqu'au bourg sans lisière à couper. Une chevrette (une femelle, donc sans bois) y vient avant que Firmin ne sorte.

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 2 au moins; soleil ou nuages; poids 2 |
| Présence | 6 h à 8 h 30 (52,5 s réelles) |
| Arrivée | sort du bois en (49,8 ; 1,6) (fondu de 1 s), marche (`deer_walk`, 0,8 m/s) jusqu'à `roe_deer_graze` |
| Point `roe_deer_graze` | (50,0 ; 5,5) |
| Attente | `deer_graze` en boucle (4 s), tête relevée 1 s toutes les 8 à 12 s |
| Timidité | un joueur à moins de 4 m alors que l'autre est loin: elle relève la tête et recule de 1,5 m vers le bois, puis se remet à brouter |
| Déclenchement | les deux à moins de 6 m de la chevrette, dehors, 2 s |

Apogée (3,4 s): 0 à 0,8 s, oreilles dressées, tête vers les joueurs (`deer_alert`); 0,8 à 1,6 s, aboiement rauque (`deer_bark`); 1,6 à 3,4 s, trois bonds (`deer_bound`, 0,5 s chacun, sommet à 0,6 m) par (49,9 ; 4,1), (49,8 ; 2,7), (49,7 ; 1,3), fondu dans le bois de 2,6 à 3,4 s. Le miroir blanc de la croupe se voit pendant les bonds.

Modèle `roe_deer`: 0,70 m au garrot, 1,15 m de long, sans bois, miroir blanc. Clips: `deer_graze`, `deer_walk`, `deer_alert`, `deer_bark`, `deer_bound` (en place). Sons: `roe_bark` (« bö » rauque, 0,6 s, 2 variantes), `deer_bounds` (trois appuis sourds, 1 s).

Confidence (de Firmin): `moment_roe_deer_hint`. Apogée: `moment_roe_deer_climax`. Souvenir: `moment_roe_deer_memory`. Récompense: Cœur +10 chacun.

#### 1.4.8 Le martin-pêcheur du ponton (`kingfisher`, P1, ambiance)

**Raison d'être.** Le martin-pêcheur chasse à l'affût depuis un poste au-dessus d'une eau calme et profonde. Le bout du ponton de pêche donne sur l'eau profonde; un pieu d'amarrage au coin est du bout lui sert de poste. Il assomme sa prise contre le pieu avant de l'avaler (comportement réel).

| Élément | Valeur |
|---|---|
| Déclencheur | ambiance; jour 4 au moins; soleil; poids 2 |
| Présence | 9 h à 12 h (63 s réelles) |
| Point `kingfisher_post` | pieu `mooring_post` (nouvel objet de carte) en (46,10 ; 39,90), dans l'eau au coin est du bout du ponton (le ponton occupe x 44 à 46, y 37 à 40); haut du pieu à 0,45 m au-dessus du plancher |
| Attente | posé sur le pieu, hoche la tête (`kf_perch`); toutes les 15 à 25 s, un plongeon manqué (plouf, retour au pieu) |
| Déclenchement | les deux à moins de 6 m du pieu, dehors, 3 s |

Apogée (5,4 s): 0 à 0,6 s, tête baissée; 0,6 s, plongeon (`kf_dive`) vers (46,6 ; 40,6), éclaboussure à 0,9 s; 1,4 s, il ressort avec un poisson (`small_fish`, 0,06 m); 1,9 s, retour au pieu; 1,9 à 3,1 s, il frappe deux fois le poisson sur le pieu (`kf_beat`) puis l'avale; 3,1 s, sifflet; 3,4 à 5,4 s, il file au ras de l'eau (z 0,4 m) vers l'amont (ouest) le long de y = 40,3 à 8 m/s, fondu à 5,4 s.

Modèles: `kingfisher` (0,17 m; dos bleu vif, ventre orange), `small_fish`, `mooring_post` (diamètre 0,14 m, 1,4 m de haut). Clips: `kf_perch` (boucle de 2 s), `kf_dive` (0,3 s), `kf_beat` (1,2 s), `kf_fly` (boucle de 0,12 s). Sons: `kf_whistle` (« tiiii » aigu, 0,4 s, 3 variantes), `kf_dive` (plouf net, 0,4 s), `kf_beat` (« tac tac », 0,5 s).

Confidence (de Jeanne): `moment_kingfisher_hint`. Apogée: `moment_kingfisher_climax`. Souvenir: `moment_kingfisher_memory`. Récompense: Cœur +10 chacun.

### 1.5 Ce qui change dans les quêtes existantes

| Quête | Avant (tour 5) | Après |
|---|---|---|
| `heron_watch` | étape `watch`: `looked_at` du gué à 8 m, `time_is` 14 h à 19 h, puis `show_text heron_seen` | `watch`: une seule condition `{ "type": "moment_seen", "moment": "heron" }`; objectif « Regarder le héron du gué à deux, sans bouger, entre 14 h et 19 h. »; l'effet `show_text` est retiré (l'apogée affiche `heron_seen`) |
| `wild_geese` | `stayed_at quay_bench` assis 10 s, 17 h à 18 h 30 | `watch`: `{ "type": "moment_seen", "moment": "geese" }`; objectif « S'asseoir à deux sur le banc de la berge entre 16 h 30 et 18 h 30, et regarder les oies. »; `show_text` retiré |
| `basile_lost` | étape `help`: `stayed_at forage_edge_03` 8 s à deux | `help`: `{ "type": "moment_seen", "moment": "ladder" }`; objectif « Tenir à deux l'échelle de Basile, de part et d'autre, au grand chêne près de la remise. »; ajout de `completionEffects`: `set_flag nest_box_straight` |
| Emploi du temps de Basile | `forage_edge_03` quand `basile_lost` est active | `nest_oak_basile` |

Les dialogues de ces quêtes sont réécrits section 3.5 pour dire vrai (lieux, cris, banc de la berge).

### 1.6 Points et objets de carte à ajouter (level designer)

Ajoutés par `outils/construire_carte_halte.py` (la carte ne se retouche pas à la main). Valeurs mises à jour d'après la carte jouée au tour 6 (`cartes/halte.json`); le nichoir, le chicot et le pieu sont des `accroches` sans emprise au sol.

| Identifiant | Nature | x ; y | Case et sol | Pourquoi là |
|---|---|---|---|---|
| `heron_stand` | point | 20,6 ; 39,6 | (20, 39), `g` | bord aval du gué, eau basse au-dessus d'une eau profonde |
| `heron_rest_far` | point | 29,5 ; 42,3 | (29, 42), `b` | grève de sable de l'anse sud, en face, à l'écart du chemin |
| `geese_rest` | point | 25,5 ; 40,0 | (25, 40), `~` | eau profonde et calme devant le banc de la berge, à 4,3 m de lui |
| `nest_box` | accroche `nest_box` et point | clou 52,50 ; 5,71 (z 2,015); point et centre de la caisse 52,50 ; 5,80 (z 1,84) | sur `tree_oak_01` | face sud du seul vieux chêne qu'on ne coupe pas |
| `oak_branch_stub` | accroche | bout à 52,85 ; 5,95 (z 2,19) | sur `tree_oak_01` | perchoir visible sous le houppier, à hauteur du nichoir |
| `ladder_foot` | point | 51,77 ; 6,23 | (51, 6) | pied de l'échelle, au sud-ouest du tronc (cap 45°) |
| `ladder_hold_east`, `ladder_hold_west` | points | 52,36 ; 6,42 (cap 315°) et 51,58 ; 5,64 (cap 135°) | (52, 6) et (51, 5) | de part et d'autre du pied de l'échelle, face à elle |
| `nest_oak_basile` | point | 51,42 ; 6,58 (cap 45°) | (51, 6) | Basile derrière le pied de son échelle |
| `fox_track_west` | point | 0,2 ; 13,5 | (0, 13), `=` | bout ouest de la voie, d'où vient le renard |
| `fox_mousing` | point | 7,5 ; 17,0 | (7, 17), `.` | herbe non fauchée entre la voie et la maisonnette |
| `meadow_glow` | point | 56,5 ; 29,5 | (56, 29), `,` | herbes hautes du pré, à plus de 9 m des lampadaires |
| `roe_deer_edge` | point | 49,8 ; 1,6 | bord du bois (`X`) | là où le bois descend jusqu'au bourg |
| `roe_deer_graze` | point | 50,0 ; 5,5 | (50, 5), `.` | herbe entre la maison de Firmin et la remise |
| `kingfisher_post` | accroche `mooring_post` et point | 46,10 ; 39,90 | (46, 39), `~` | pieu d'amarrage au coin est du bout du ponton |
| `notebook_spot_pontoon`, `notebook_spot_bench`, `notebook_spot_rock` | points (P1, section 2.4) | 43,8 ; 37,6 / 28,0 ; 36,5 / 38,5 ; 37,2 | (43, 37) `b` / banc / (38, 37) `b` | lieux où Jeanne joue l'après-midi |

Tous ces points sont hors des chemins parcourus par les habitants (`trajets` de la carte), sauf `notebook_spot_bench` (le banc de la berge, où passe Jeanne: c'est voulu).

### 1.7 Récapitulatif par métier

| Métier | À produire |
|---|---|
| Artiste 3D | P0: `heron`, `goose`, `ladder_wood`, `nest_box`, `oak_branch_stub`, `blue_tit`, `moss_tuft`, `fox`; clips de Basile `climb_ladder`, `reach_up`, `hammer_tap`; clip des joueurs `hold_ladder`. P1: `roe_deer`, `kingfisher`, `small_fish`, `mooring_post`. Un seul fichier `faune.glb` proposé (squelettes propres aux bêtes) |
| Sound-designer | les sons listés dans chaque fiche (21 sons P0, 6 P1), spatialisés, avec les distances d'audition données; descente de la musique de 6 dB pendant l'apogée |
| Tech-artist | gerbes d'eau (course des oies, plongeons), lame d'eau autour des pattes du héron, lumières des vers luisants (sprites émissifs instanciés, un appel de dessin), rides du plouf du martin-pêcheur |
| Dev rendu 3D | lecteur de chorégraphies (images clés, Catmull-Rom, clips), formation en V, animaux en attente, étiquettes des poules par joueur (section 2.2) |
| Dev gameplay | `moments.json`, tirage, phases, déclenchement, geste « tenir », conditions et effets nouveaux, robots (section 4) |
| Dev interface | ligne d'observation et anneau sous l'horloge, confidence au petit-déjeuner, fiche secrète du carnet, choix « Appeler », onglet Souvenirs (P1) |
| Level designer | points et objets de la section 1.6 |

---

## 2. Informations propres à un seul joueur (R16)

### 2.1 Le principe commun

**Le fantasme.** « C'est moi qui sais. » L'un des deux tient un secret confié par un habitant; l'autre a les mains. La seule façon d'aller vite, c'est de se parler, et comme le couple est dans la même pièce, c'est naturel. Chaque secret est un **jeu inventé par un habitant**, ce qui lui donne sa raison d'être: Odette, qui « sait tout », aime les confidences; Jeanne, dix ans et demi, invente des règles.

**Les rôles.** Au démarrage d'une quête secrète (effet implicite, champ `secret` de la quête):

- l'**informé** (`informed`) est le personnage dont c'est le tour: `world.secrets.turn`, initialisé à `reglages.secrets.firstInformed` (`p1`: le personnage du premier joueur de la liste de la plateforme à la création, `players[0]` de `createWorld`, rattaché ensuite à l'identifiant stable du joueur et non au rôle d'hôte);
- l'**autre** (`doer`) est l'autre personnage;
- `turn` passe à l'autre personnage. L'alternance suit l'ordre de démarrage des quêtes secrètes: en pratique, « Les noms des poules » (semaine 1) va à p1, « Le mot de Lucie » (semaine 2) à p2, « Le carnet perdu » (P1) de nouveau à p1. Les confidences du matin des moments (section 1.2) alternent de leur côté et commencent par p2.

**Ce qui s'affiche chez qui.**

| | Informé | Autre |
|---|---|---|
| Notification de démarrage | « Nouvelle quête: {quest} » | la même |
| Objectif au carnet | `objectiveByRole.informed` (peut citer `{secret}`) | `objectiveByRole.doer` (ne cite jamais le secret) |
| Fiche secrète (carnet, onglet Quêtes, sous l'objectif) | oui, titre et lignes du secret | rien |
| Signes à l'écran (étiquettes des poules) | oui | non |
| Dialogue qui donne le secret | lui seul peut le jouer | réplique de renvoi vers l'informé |
| Action qui vérifie | renvoi gentil vers l'autre | lui seul peut la faire |

**Comment le jeu garantit que l'autre écran ne montre rien.** Le secret vit dans `world.secrets.entries[]` (identifiant, quête, informé, variante, erreurs). L'interface et le rendu n'affichent un secret que si `entry.informed === view.localCharacter()`; les dialogues réservés à un rôle ne sont proposés qu'à ce rôle (condition `secret_role`), et les conversations sont déjà personnelles (SI-06). Recommandé en plus (P1, à trancher avec l'architecte): l'hôte retire les lignes du secret de l'instantané envoyé à l'invité quand l'invité n'est pas l'informé.

**Jamais punitif.** Une mauvaise réponse ne coûte rien: une réaction drôle, un nouvel essai immédiat, aucun compteur visible. Après `reglages.secrets.nudgeAfterErrors` (2) erreurs dans une même quête, l'informé reçoit une fois un coup de coude (« souffle-lui ») sur son écran. Réussir sans aucune erreur donne un petit bonus (« Du premier coup ! », Cœur +`firstTryHeart`, 5, à chacun). Deviner au hasard finit toujours la quête: les choix sont en nombre fini.

**Accessibilité des niveaux.** Aucun des rôles ne demande d'adresse: l'informé parle, l'autre se déplace et choisit. L'alternance fait jouer les deux rôles aux deux joueurs.

### 2.2 Semaine 1: Les noms des poules (`hen_names`, nouvelle quête, P0)

**Pitch.** Odette présente les trois poules à un seul des deux. L'autre doit les appeler par leur nom: « la rousse, c'est Cocotte ! ».

**Raison d'être.** Les poules arrivent sans qu'on sache qui est qui (`odette_hens_done` les nomme sans les décrire). Odette, qui « sait tout », en fait une confidence: « une poule, ça apprend une voix à la fois ». À la fin, les noms sont connus des deux et s'affichent pour toujours: les poules deviennent les leurs.

**Le secret.** Qui porte quel nom change d'une partie à l'autre: permutation n° `k = variantOf(graine, "hen_names", 6)` des trois variantes, dans cet ordre (l'effet `spawn_animals` de `hens` reçoit `shuffleVariantsBy: "hen_names"`):

| k | Bichette | Cocotte | la Duchesse |
|---|---|---|---|
| 0 | blanche | rousse | noire |
| 1 | blanche | noire | rousse |
| 2 | rousse | blanche | noire |
| 3 | rousse | noire | blanche |
| 4 | noire | blanche | rousse |
| 5 | noire | rousse | blanche |

(variantes `hen_white`, `hen_red`, `hen_black`; la poule i porte `names[i]` et la variante donnée par la ligne k.)

**Déroulé.**

| | Règle |
|---|---|
| Démarrage | `quest_done hens`, `day_at_least 5`, `time_is 07:00 à 19:00` (Odette au comptoir). Les poules arrivent d'habitude le soir du jour 4 (demo.md); la quête démarre donc le jour 5, et en semaine 1 pour tout duo qui prépare la commande du jour 8 (6 œufs) |
| Étape 1 `listen` | l'informé parle à Odette: dialogue `odette_hen_names_tell` (réservé à l'informé), qui donne le secret. L'autre qui parle à Odette entend `odette_hen_names_redirect` |
| Étape 2 `call` | l'autre appelle chaque poule par son nom. Agir à moins de 1,5 m d'une poule ouvre chez lui seul un petit choix: « Comment s'appelle {henUnknown} ? », trois réponses dans un ordre fixe (Bichette, Cocotte, la Duchesse) et « Laisser » |
| Bonne réponse | la poule glousse (`hen_happy`), fait trois pas vers lui, et son nom s'affiche au-dessus d'elle **chez les deux** (`nameKnownBy` passe aux deux); message chez l'autre: `hen_named_right` |
| Mauvaise réponse | la poule penche la tête (`hen_puzzled`, 0,8 s; son `hen_puzzled`); message chez l'autre: `hen_named_wrong`; on peut réessayer tout de suite; `errors` + 1 |
| Coup de coude | à 2 erreurs, une fois, chez l'informé: `secret_nudge_hens` |
| L'informé appelle une poule | aucun choix; message `hen_names_informed_call` |
| Fin | les trois poules nommées par l'autre: condition `hens_named { count: 3, who: "doer" }` |
| Récompense | 15 sous (Odette); Cœur +5 à chacun si `errors` vaut 0 (message `secret_first_try`) |

**Ce que voit l'informé pendant l'étape 2.** Une étiquette au-dessus de chaque poule (même style que les noms d'habitants, plus petite), seulement sur son écran, et la fiche secrète au carnet: « Les poules d'Odette » avec trois lignes (`{henColor1}` etc., section 3.4). **Ce que voit l'autre.** Aucune étiquette avant le bon nom; partout où un nom de poule s'afficherait (survol, messages), il lit « la poule blanche », « la poule rousse », « la poule noire » (`textes.henUnknown`).

**Cas limites.** Une poule qui picore s'éloigne: le choix reste ouvert tant que l'autre est à moins de 3 m. Les deux joueurs près de la même poule: seul l'autre a le choix. Une poule déjà nommée: Agir ne propose plus de choix (comportement normal). Sauvegarde: `secrets`, `nameKnownBy` et l'étape sont sauvés. Déconnexion ou absence de l'informé: la quête attend, l'autre peut toujours deviner. Les deux personnages échangent leur joueur à la reprise (« Qui joue qui ? »): les rôles suivent le personnage.

### 2.3 Semaine 2: Le mot de Lucie (`lucie_note`, refonte, P0)

**Pitch.** L'informé porte la lettre de Lucie à Firmin et entend seul sa réponse. Jeanne refuse de l'entendre de sa bouche (« tu vas rougir ») et veut que ce soit l'autre qui la lui raconte.

**Raison d'être.** La quête existe déjà, et sa fin (« Raconter à Jeanne comment Firmin l'a prise ») se jouait par une simple conversation: on y gagne un vrai relais de parole, dans le caractère des personnages (Firmin hésite, Jeanne invente une règle).

**Le secret.** La réponse de Firmin, variante `k = variantOf(graine, "lucie_reply", 3)`:

| k | Firmin, à l'informé seul | Choix juste chez Jeanne |
|---|---|---|
| 0 | « Dis-lui que samedi, au train, je mettrai ma casquette du dimanche. » | « Il mettra sa casquette du dimanche, samedi. » |
| 1 | « Dis-lui qu'il reste une place sur le banc du quai. À côté de la mienne. » | « Il lui garde une place sur le banc du quai. » |
| 2 | « Dis-lui que les jonquilles du quai, c'est moi qui les ai plantées. Pour elle. » | « Les jonquilles du quai, c'est lui. Pour elle. » |

**Déroulé.**

| | Règle |
|---|---|
| Démarrage | `day_at_least 11`, `dialogue_done jeanne_meeting`, `time_is 08:00 à 20:00` (le démarrage ne dépend plus de qui parle à Jeanne: les rôles sont fixés à ce moment) |
| Étape 1 `receive` | l'informé parle à Jeanne: `jeanne_lucie_ask` (réservé à l'informé) lui donne `lucie_letter`. L'autre entend `jeanne_lucie_redirect` |
| Étape 2 `give` | l'informé donne la lettre à Firmin (condition `given` existante). Firmin joue alors chez l'informé seul `firmin_lucie_reply_k`. Si l'autre a la lettre (posée puis ramassée) et la donne, Firmin la prend et dit `firmin_lucie_reply_wrong_person`: la réponse ira à l'informé, qui doit venir lui parler |
| Étape 3 `tell_jeanne` | l'autre parle à Jeanne: `jeanne_lucie_quiz`, un choix entre les trois réponses du tableau, dans l'ordre 0, 1, 2. Bon choix: réplique `correct`, étape finie. Mauvais choix: réplique `wrong`, la quête reste à l'étape, on peut réessayer à la conversation suivante, `errors` + 1 |
| L'informé parle à Jeanne à l'étape 3 | `jeanne_lucie_not_you` |
| L'autre parle à Firmin à l'étape 3 | `firmin_lucie_already_told` |
| Coup de coude | à 2 erreurs (le maximum possible avec trois réponses), une fois, chez l'informé: `secret_nudge_lucie` |
| Fin | condition `choice_made { dialogue: "jeanne_lucie_quiz", correct: true, who: "doer" }` |
| Récompense | 20 sous (inchangé); Cœur +5 à chacun du premier coup |

Fiche secrète de l'informé (après la réponse de Firmin): « La réponse de Firmin » et la phrase de la variante, pour s'en souvenir.

### 2.4 Bonus P1: Le carnet perdu de Jeanne en guidage (`jeanne_notebook`, variante 0 du jour 13)

**Pitch.** Jeanne a dessiné à l'informé où elle croit avoir laissé son carnet; c'est l'autre qui cherche, guidé à la voix. Jeanne: « Qui a la carte ne cherche pas, c'est la règle ! » Le guidage est la forme de coopération qui manquait (revue du tour 5, pilier 7).

| | Règle |
|---|---|
| Secret | cachette `k = variantOf(graine, "notebook_spot", 3)`: 0 `notebook_spot_pontoon` (sous les planches du ponton, côté d'où vient l'eau, donc l'ouest), 1 `notebook_spot_bench` (sous le banc de la berge), 2 `notebook_spot_rock` (derrière le gros rocher de la berge, côté rivière) |
| Carnet de l'informé | fiche « Le dessin de Jeanne », texte de la cachette (`notebook_sketch_k`) |
| L'objet | caché (pas d'objet au sol à l'écran, l'effet `spawn_object` actuel est retiré); l'autre le trouve par Examiner à moins de 1,2 m de la cachette; il apparaît alors dans sa main avec `notebook_found` |
| L'informé examine la cachette | `notebook_not_you` |
| Mauvais endroit | Examiner près d'un autre lieu de la liste: `notebook_not_here` (« Rien ici. Jeanne a dessiné autre chose. »); ailleurs, le « Rien ici. » habituel |
| Fin | `given jeanne jeanne_notebook` (inchangé) |

Le repère (G, épingle visible des deux) reste permis: s'en servir pour guider est aussi une transmission.

### 2.5 Pourquoi pas plus

Le défi de pêche (variante 1 du jour 13) pourrait devenir « le coin du pêcheur » (l'informé sait où ça mord), mais l'information n'y est qu'un avantage, pas une nécessité: gardé pour plus tard. Les quêtes secrètes ne doivent pas devenir une routine (même logique que R15): une par semaine, plus les confidences du matin.

---

## 3. Configuration proposée (`donnees/*.json`)

Les noms suivent les conventions du README des données: identifiants en `snake_case`, clés en `camelCase`, heures `"HH:MM"`, secondes réelles en nombres décimaux.

### 3.1 Nouveau fichier `donnees/moments.json`

```json
{
  "version": 1,
  "moments": [
    {
      "id": "heron",
      "tier": "P0",
      "name": "Le héron du gué",
      "mode": "both",
      "quest": "heron_watch",
      "anchor": "heron_stand",
      "weight": 3,
      "maxPerSeason": null,
      "availableWhen": [
        { "type": "day_at_least", "day": 4 },
        { "type": "any", "conditions": [{ "type": "weather_is", "weather": "sunny" }, { "type": "weather_is", "weather": "cloudy" }] }
      ],
      "present": { "from": "14:00", "to": "19:00" },
      "window": { "from": "14:00", "to": "19:00" },
      "watch": { "radius": 6, "minRadius": 2.5, "holdSeconds": 4, "still": true, "facing": true, "seated": false, "bench": null, "hold": null, "target": "anchor" },
      "questWatch": null,
      "actors": [
        {
          "id": "heron", "model": "heron", "count": 1, "at": "heron_stand", "facing": 0.3,
          "idle": "heron_idle", "idleExtra": { "clip": "heron_strike", "everySeconds": [10, 20] },
          "collisionRadius": 0.3,
          "shy": { "distance": 2.5, "clip": "heron_alert", "stepTo": [20.6, 40.3], "stepClip": "heron_shy_step", "returnAfterSeconds": 5 }
        }
      ],
      "climax": {
        "seconds": 5.2,
        "keyframes": {
          "heron": [
            [0.0, 20.6, 39.6, 0.0, "heron_alert"],
            [1.0, 20.6, 39.6, 0.0, "heron_takeoff"],
            [2.4, 22.0, 39.8, 1.0, "heron_fly"],
            [3.4, 26.0, 40.8, 2.0, "heron_fly"],
            [4.4, 28.8, 41.9, 1.0, "heron_land"],
            [5.2, 29.5, 42.3, 0.0, "heron_rest"]
          ]
        },
        "sounds": [[1.0, "heron_wings"], [1.2, "heron_croak"], [4.4, "heron_land"]],
        "lookers": ["jeanne"]
      },
      "after": { "actors": { "heron": { "at": "heron_rest_far", "idle": "heron_rest" } } },
      "leave": {
        "seconds": 2.0,
        "keyframes": { "heron": [[0.0, null, null, 0.0, "heron_takeoff"], [2.0, 40.0, 47.5, 4.0, "heron_fly"]] },
        "fadeLastSeconds": 0.5,
        "sounds": [[0.0, "heron_wings"]]
      },
      "sounds": { "idle": [{ "id": "heron_wade", "everySeconds": [6, 12], "range": 15 }] },
      "texts": { "hint": "moment_heron_hint", "climax": "heron_seen", "memory": "moment_heron_memory" },
      "hintFrom": null,
      "reward": { "heart": 10 }
    }
  ]
}
```

Règles du schéma:

| Champ | Type | Sens |
|---|---|---|
| `id` | identifiant | unique |
| `tier` | `"P0"` ou `"P1"` | un moment P1 absent du jeu ne casse rien (il n'est jamais tiré) |
| `name` | texte | titre au carnet (Souvenirs) |
| `mode` | `"quest"`, `"ambient"`, `"both"` | origine possible |
| `quest` | identifiant de quête ou `null` | quête qui l'impose (`quest`, `both`) |
| `anchor` | point de carte | lieu du moment |
| `weight` | entier ≥ 0 | poids au tirage (0: jamais tiré en ambiance) |
| `maxPerSeason` | entier ou `null` | plafond par saison, quête comprise |
| `availableWhen` | conditions | admissible au tirage du matin (évaluées à 6 h) |
| `present`, `window` | `{ from, to }` | présence à l'écran, fenêtre de l'apogée (`window` incluse dans `present`) |
| `watch` | objet | `radius`, `minRadius` (m), `holdSeconds` (s réelles), `still`, `facing`, `seated` (booléens), `bench` (objet banc ou `null`), `hold` (liste de points à tenir ou `null`), `target` (`"anchor"` ou l'identifiant d'un acteur qui bouge) |
| `questWatch` | même forme ou `null` | remplace `watch` quand le moment vient de sa quête (les oies: assis sur le banc) |
| `actors[]` | liste | `id`, `model`, `count`, `at` (point), `offsets` (liste de `[dx, dy]` si `count` > 1), `facing` (rad), `idle`, `idleExtra`, `arrive` (images clés de l'arrivée), `collisionRadius` (m, 0: aucune), `shy` |
| `climax` | objet | `seconds`, `keyframes` (par acteur: `[t, x, y, z, clip]`; `null` en x ou y: position courante), `formation` (facultatif, section 1.4.2), `sounds` (`[t, son]`), `lookers` (habitants qui tournent la tête), `pauseWhenReleased` (booléen, l'échelle) |
| `after`, `leave` | objets | état après l'apogée; départ discret (`seconds`, `keyframes`, `fadeLastSeconds`, `sounds`) |
| `sounds.idle` | liste | sons d'attente: `id`, `everySeconds` (intervalle tiré), `range` (m) |
| `texts` | clés de `textes.messages` | `hint` (confidence), `climax`, `memory` |
| `hintFrom` | habitant ou `null` | la confidence suppose que le destinataire l'a rencontré |
| `reward` | `{ heart, money? }` | Cœur à chacun; sous facultatifs (les quêtes paient à part) |

Valeurs des sept autres moments (mêmes champs; les images clés sont celles des fiches 1.4.2 à 1.4.8):

| id | tier | mode | quest | anchor | weight | maxPerSeason | availableWhen | present | window | watch | questWatch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `geese` | P0 | both | `wild_geese` | `geese_rest` | 2 | 1 | jour ≥ 5; soleil ou nuages | 14:00 à 18:30 | 16:30 à 18:30 | rayon 6, 3 s | assis sur `riverbank_bench`, 5 s |
| `ladder` | P0 | quest | `basile_lost` (étape `help`) | `ladder_foot` | 0 | null | aucune | 12:00 à 18:00 | 12:00 à 18:00 | rayon 3, 0,5 s, `hold`: les deux places | null |
| `tits` | P0 | ambient | null | `nest_box` | 3 | null | drapeau `nest_box_straight`; jour ≥ 4; soleil ou nuages | 08:00 à 11:00 | 08:00 à 11:00 | rayon 6, 2 s | null |
| `fox` | P0 | ambient | null | `fox_mousing` | 3 | null | jour ≥ 3; soleil ou nuages | 19:00 à 21:30 | 19:00 à 21:30 | rayon 6, 2 s, cible: l'acteur `fox` | null |
| `glowworms` | P0 | ambient | null | `meadow_glow` | 2 | null | jour ≥ 9; soleil | 21:00 à 23:30 | 21:00 à 23:30 | rayon 6, 2 s | null |
| `roe_deer` | P1 | ambient | null | `roe_deer_graze` | 2 | null | jour ≥ 2; soleil ou nuages | 06:00 à 08:30 | 06:00 à 08:30 | rayon 6, 2 s, cible: l'acteur `roe_deer` | null |
| `kingfisher` | P1 | ambient | null | `kingfisher_post` | 2 | null | jour ≥ 4; soleil | 09:00 à 12:00 | 09:00 à 12:00 | rayon 6, 3 s | null |

Confidences: `hintFrom` vaut `null` pour le héron, les oies et le renard (choses vues ou entendues), `basile` pour les mésanges, `odette` pour les vers luisants, `firmin` pour la chevrette, `jeanne` pour le martin-pêcheur. Toutes les valeurs de dynamique (vitesses, durées des clips, tailles) restent dans ce fichier ou dans les modèles, jamais dans le code.

### 3.2 `reglages.json`: deux blocs nouveaux

```json
"moments": {
  "dailyChance": 0.5,
  "maxPerDay": 1,
  "cooldownDays": 7,
  "firstAmbientDay": 2,
  "noAmbientOnTrainDays": true,
  "stillSpeed": 0.05,
  "noticeRadius": 12,
  "heartBonus": 10,
  "musicDuckDb": -6,
  "musicDuckInSeconds": 0.5,
  "musicDuckOutSeconds": 2.0,
  "firstHint": "p2",
  "maxSyncGapSeconds": 0.5
},
"secrets": {
  "firstInformed": "p1",
  "nudgeAfterErrors": 2,
  "firstTryHeart": 5,
  "henChoiceRange": 1.5,
  "henChoiceKeepOpen": 3.0,
  "hideFromGuestSnapshot": false
}
```

Table d'équilibrage:

| Valeur | Initiale | Unité | Plage | Raison |
|---|---|---|---|---|
| `moments.dailyChance` | 0,5 | probabilité | 0,35 à 0,65 | 4,8 moments par démo, deux jours sur trois sans moment: rare sans être absent (annexe A) |
| `moments.cooldownDays` | 7 | jours | 7 à 21 | exigence du brief; au long cours, la variété viendra de la taille de la réserve (au moins 12 par saison) |
| `moments.maxPerDay` | 1 | moment | 1 | au-delà, le moment devient décor |
| `moments.firstAmbientDay` | 2 | jour | 2 à 4 | le jour 1 est l'accueil |
| `watch.radius` | 6 | m | 5 à 8 | à l'écran chez les deux au zoom le plus serré (section 1.2); 8 m ne vaut qu'aux zooms 2 et 3 |
| `watch.holdSeconds` | 2 à 5 selon le moment | s réelles | 0,5 à 6 | assez pour un « on y est », trop court pour s'ennuyer; le héron demande 4 s d'immobilité (c'est le jeu), les oies 5 s assis |
| `moments.stillSpeed` | 0,05 | m/s | 0,02 à 0,1 | tolère la marche résiduelle de l'interpolation de l'invité |
| `moments.noticeRadius` | 12 | m | 8 à 15 | le joueur seul voit l'animal à l'écran au zoom moyen |
| `moments.heartBonus` | 10 | points de Cœur | 5 à 15 | comme un geste à deux (`needs.heart.gestureTogether`); moins qu'une envie à deux (25), car on ne le choisit pas |
| `moments.musicDuckDb` | -6 | dB | -3 à -12 | laisser la place aux cris et aux battements d'ailes |
| `secrets.nudgeAfterErrors` | 2 | erreurs | 2 à 3 | à 2, l'autre a essayé presque toutes les réponses (au pire 2 pour Lucie, 3 pour les poules): on rappelle de parler, sans l'humilier |
| `secrets.firstTryHeart` | 5 | points de Cœur | 0 à 10 | encourage à écouter, sans rien retirer à qui devine |
| `secrets.henChoiceKeepOpen` | 3,0 | m | 2 à 4 | une poule qui picore s'éloigne pendant le choix |
| `secrets.hideFromGuestSnapshot` | faux | booléen | | durcissement facultatif (section 2.1) |

### 3.3 `quetes.json`, `habitants.json`, `objets.json`: champs, conditions et effets nouveaux

Champs de quête:

| Champ | Type | Sens |
|---|---|---|
| `secret` | objet ou absent | `{ "id", "informed": "turn", "variantGroup", "of", "card": { "title", "lines" } }`; `lines` est une liste de textes (`{secret}` et `{henColor1..3}` permis) ou, si `of` > 1 et que le texte dépend de la variante, une liste de listes indexée par la variante; `revealOn` facultatif: condition qui fait apparaître la fiche (Lucie: après la réponse de Firmin) |
| `steps[].objectiveByRole` | `{ "informed", "doer" }` | objectif vu par chaque rôle; `objective` reste le texte par défaut et celui des quêtes sans secret |

Conditions (README, section 3):

| `type` | Paramètres | Vraie quand |
|---|---|---|
| `moment_seen` | `moment`, `since` (défaut `step_start`) | l'apogée de ce moment a eu lieu depuis `since` |
| `looked_at` (étendu) | en plus: `minDistance` (m, défaut 0), `seconds` (défaut 0), `still` (défaut faux) | comme avant, et d'affilée pendant `seconds`, à au moins `minDistance`, immobile si `still` |
| `secret_role` | `quest`, `role` (`informed` ou `doer`) | le joueur concerné (celui qui parle, qui agit) a ce rôle dans le secret de cette quête |
| `hens_named` | `count`, `who` | poules différentes nommées juste |
| `choice_made` | `dialogue`, `choice` (facultatif), `correct` (facultatif), `who` | le joueur a fait ce choix dans ce dialogue (ou un choix juste) |

`who` accepte en plus `"informed"` et `"doer"` dans une quête qui a un `secret`.

Effets:

| `type` | Paramètres | Effet |
|---|---|---|
| `give_item` (étendu) | `to` accepte `"informed"`, `"doer"` | donne l'objet au rôle |
| `spawn_animals` (étendu) | `shuffleVariantsBy` (groupe de variante) | permutation des variantes (section 2.2) |
| `reveal_secret` | `quest` | rend le secret visible des deux (fin d'une quête secrète: étiquettes des poules) |

Choix de dialogue (personnels uniquement; la règle HA-08 « un choix ne change jamais la suite » reste vraie pour les scènes à deux): un choix peut porter `correct` (une condition, souvent `variant`), `reply` (si juste), `replyWrong` (sinon), `effects` et `effectsWrong`. Le jeu émet `dialogue_choice { dialogue, choice, correct, by }`.

Dialogues réservés à un rôle: une condition `secret_role` dans `when`. Événements nouveaux: `moment_waiting`, `moment_climax { moment, startTick }`, `moment_paused`, `moment_resumed`, `moment_left`, `hen_called { hen, name, correct, by }`.

État (sauvegarde, `dataSchema` + 1): `world.moments = { today: { id, origin, phase, startTick, pausedAt } | null, history: [{ id, day, origin, seen }], hintTurn }`, `character.momentHint: { moment, text } | null`, `character.holding: PointId | null` (geste « tenir »), `world.secrets = { turn, entries: [{ id, quest, informed, doer, variant, errors }] }`, `hen.nameKnownBy: CharacterId[]`, `heartToday.moment: boolean`. Une ancienne sauvegarde reçoit `history` vide, `hintTurn` `p2`, `turn` `p1`, `nameKnownBy` aux deux (les poules déjà là gardent leurs noms visibles).

Quête nouvelle, en entier:

```json
{
  "id": "hen_names",
  "kind": "side",
  "tier": "P0",
  "title": "Les noms des poules",
  "giver": "odette",
  "start": { "when": [
    { "type": "quest_done", "quest": "hens" },
    { "type": "day_at_least", "day": 5 },
    { "type": "time_is", "from": "07:00", "to": "19:00" }
  ] },
  "secret": {
    "id": "hen_names",
    "informed": "turn",
    "variantGroup": "hen_names",
    "of": 6,
    "card": { "title": "Les poules d'Odette", "lines": [
      "Bichette, c'est {henColor1}: elle pond la première.",
      "Cocotte, c'est {henColor2}: elle se dispute avec tout le monde.",
      "La Duchesse, c'est {henColor3}: elle se prend pour une reine."
    ] },
    "revealOn": { "type": "dialogue_done", "dialogue": "odette_hen_names_tell" }
  },
  "steps": [
    {
      "id": "listen",
      "objective": "Odette veut présenter les poules.",
      "objectiveByRole": {
        "informed": "Odette a une confidence pour toi, au comptoir.",
        "doer": "Odette a une confidence pour {partner}, au comptoir."
      },
      "conditions": [{ "type": "dialogue_done", "dialogue": "odette_hen_names_tell" }]
    },
    {
      "id": "call",
      "objective": "Appeler les trois poules par leur nom.",
      "objectiveByRole": {
        "informed": "Leurs noms, il n'y a que toi qui les connais. Dis-les à {partner}: c'est sa voix qu'elles doivent apprendre.",
        "doer": "Appelle chaque poule par son nom ({act} près d'une poule). Les noms, c'est {partner} qui les connaît."
      },
      "conditions": [{ "type": "hens_named", "count": 3, "who": "doer", "label": "3 poules" }]
    }
  ],
  "completionEffects": [
    { "type": "reveal_secret", "quest": "hen_names" },
    { "type": "give_money", "amount": 15 }
  ],
  "completionText": "Bichette, Cocotte et la Duchesse répondent à leur nom. 15 sous d'Odette."
}
```

`lucie_note` réécrite: même identifiant et même titre; `start.when` du tableau 2.3; `secret` `{ "id": "lucie_reply", "informed": "turn", "variantGroup": "lucie_reply", "of": 3, "card": { "title": "La réponse de Firmin", "lines": [["Samedi, au train, il mettra sa casquette du dimanche."], ["Il reste une place sur le banc du quai, à côté de la sienne."], ["Les jonquilles du quai, c'est lui qui les a plantées. Pour elle."]] }, "revealOn": { "type": "any", "conditions": [{ "type": "dialogue_done", "dialogue": "firmin_lucie_reply_0" }, { "type": "dialogue_done", "dialogue": "firmin_lucie_reply_1" }, { "type": "dialogue_done", "dialogue": "firmin_lucie_reply_2" }] } }`; étapes `receive` (`dialogue_done jeanne_lucie_ask`), `give` (`given firmin lucie_letter`), `tell_jeanne` (`choice_made jeanne_lucie_quiz`, `correct: true`, `who: "doer"`), avec les `objectiveByRole` de la section 3.4; `completionEffects` `give_money 20`.

`objets.json`: `jeanne_notebook` garde son modèle; aucun objet nouveau pour R16. `animals.hen` inchangé (les variantes existent).

### 3.4 `textes.json`: textes nouveaux et réécrits

Placeholders nouveaux (à ajouter au tableau du README et au validateur): `{henColor1}`, `{henColor2}`, `{henColor3}` (couleur de Bichette, Cocotte, la Duchesse: « la blanche », « la rousse », « la noire »), `{henName}` (nom d'une poule), `{henUnknown}` (« la poule blanche »...), `{secret}` (ligne du secret, permise seulement dans les textes vus par l'informé: le validateur refuse `{secret}` dans un `objectiveByRole.doer`, un texte partagé ou un `show_text`).

Nouveaux blocs: `henColors` `{ "hen_white": "la blanche", "hen_red": "la rousse", "hen_black": "la noire" }`; `henUnknown` `{ "hen_white": "la poule blanche", "hen_red": "la poule rousse", "hen_black": "la poule noire" }`; `ui.notebookTabs.memories` « Souvenirs » (P1); `ui.secretCard` « Rien que pour toi » (en-tête de la fiche secrète).

Messages (`textes.messages`):

| Clé | Texte |
|---|---|
| `moment_watch_self` | Sans bouger... |
| `moment_watch_partner` | {partner} n'est pas encore là. |
| `moment_notice` | Montre-le à {partner} ! |
| `heron_seen` | Le héron se redresse, vous regarde, pousse un cri rauque et s'envole au ras de l'eau. Il se pose sur la grève d'en face. |
| `moment_heron_hint` | Hier soir, au bord de l'eau, tu as vu un grand oiseau gris remonter la rivière vers le gué. Les hérons pêchent l'après-midi. |
| `moment_heron_memory` | Le héron du gué, un {weekday} après-midi. |
| `geese_not_yet` | Les oies se reposent encore. Elles repartent en fin d'après-midi, à partir de 16 h 30. |
| `geese_seen` | Les oies courent sur l'eau, s'élèvent en criant et passent au-dessus de la berge, puis forment un grand V au-dessus du quai. |
| `moment_geese_hint` | Cette nuit, tu as entendu des oies se poser sur l'Aubrune, pas loin du banc de la berge. |
| `moment_geese_memory` | Le V des oies, cap au nord, un {weekday} soir. |
| `ladder_hold_on` | Tenez bon, là en bas ! |
| `ladder_hold_taken` | {partner} tient déjà ce côté: prends l'autre. |
| `moment_tits_hint` | Basile te l'a dit hier: « Mes mésanges visitent le nichoir du grand chêne, le matin. » |
| `moment_tits_climax` | Une mésange entre dans le nichoir de Basile, un brin de mousse au bec. Elle y bâtit son nid. |
| `moment_tits_memory` | Les mésanges du grand chêne, un {weekday} matin. |
| `moment_fox_hint` | Hier soir, tu as vu une ombre rousse filer le long de la voie, derrière la maison. |
| `moment_fox_climax` | Le renard s'arrête, vous regarde, jappe deux fois, et file le long de la voie. |
| `moment_fox_memory` | Le renard de la voie, un {weekday} soir. |
| `moment_glowworms_hint` | Odette te l'a dit hier: « Par une nuit douce, les vers luisants s'allument dans le pré de l'est. Après neuf heures du soir ! » |
| `moment_glowworms_climax` | Une à une, de petites lanternes vertes s'allument dans l'herbe haute. Le pré tout entier scintille. |
| `moment_glowworms_memory` | Les vers luisants du pré, un {weekday} soir. |
| `moment_roe_deer_hint` | Firmin te l'a dit hier: « Une chevrette sort du bois derrière chez moi, avant huit heures et demie. » |
| `moment_roe_deer_climax` | La chevrette dresse les oreilles, aboie une fois, et rentre au bois en trois bonds. On ne voit plus que sa tache blanche. |
| `moment_roe_deer_memory` | La chevrette de la lisière, un {weekday} matin. |
| `moment_kingfisher_hint` | Jeanne te l'a juré hier: « Il y a un oiseau bleu au bout du ponton, le matin. Bleu comme un bouton de veste ! » |
| `moment_kingfisher_climax` | Un éclair bleu plonge, ressort avec un poisson, le tape deux fois sur le pieu, et file au ras de l'eau. |
| `moment_kingfisher_memory` | Le martin-pêcheur du ponton, un {weekday} matin. |
| `hen_named_right` | Elle glousse et vient vers toi: c'est bien {henName} ! |
| `hen_named_wrong` | Elle penche la tête: ce n'est pas son nom. |
| `hen_names_informed_call` | Tu appelles {henName}, mais elle regarde {partner}. Odette l'a dit: c'est la voix de {partner} qu'elles doivent apprendre. |
| `secret_nudge_hens` | {partner} cherche les noms des poules: souffle-lui la réponse ! |
| `secret_nudge_lucie` | Jeanne attend la réponse de Firmin: raconte-la à {partner}. |
| `secret_first_try` | Du premier coup ! |
| `notebook_found` | Le carnet de galets de Jeanne ! Il était là. |
| `notebook_not_here` | Rien ici. Jeanne a dessiné autre chose. |
| `notebook_not_you` | La règle de Jeanne: qui a le dessin ne cherche pas. Guide {partner} ! |
| `notebook_sketch_0` | Le ponton, trois planches, et une croix sous la planche du bord, du côté d'où vient l'eau. |
| `notebook_sketch_1` | Un banc qui regarde la rivière, et une croix dessous, au milieu. |
| `notebook_sketch_2` | Le gros rocher de la berge, et une croix derrière lui, du côté de l'eau. |
| `quest.hen_names.call.choice` (texte du choix) | Comment s'appelle {henUnknown} ? |

Les noms des poules commencent parfois par une minuscule (« la Duchesse »): aucun texte ne commence par `{henName}`.

Objectifs de `lucie_note`:

| Étape | Informé | Autre |
|---|---|---|
| `receive` | Jeanne a quelque chose à te confier. | Jeanne a quelque chose à confier à {partner}. |
| `give` | Porte la lettre de Lucie à Firmin, sur le quai. | {partner} porte une lettre de Lucie à Firmin. Jeanne voudra savoir la réponse: c'est toi qui la lui diras. |
| `tell_jeanne` | Firmin a répondu: « {secret} » Raconte-le à {partner}: c'est {partner} qui le dira à Jeanne. | Demande à {partner} ce que Firmin a répondu, puis va le dire à Jeanne. |

### 3.5 `habitants.json`: dialogues nouveaux et réécrits

| id | Habitant | `when` (en plus de l'étape active) | Texte |
|---|---|---|---|
| `odette_hen_names_tell` | Odette | `step_active hen_names listen`, `secret_role informed` | « Approche, que je te présente vos poules. Bichette, c'est {henColor1}: elle pond la première. Cocotte, c'est {henColor2}: elle se dispute avec tout le monde. Et la Duchesse, c'est {henColor3}: elle se prend pour une reine. » puis « Mais c'est {partner} qui les appellera. Une poule, ça apprend une voix à la fois. Tu lui diras ? » |
| `odette_hen_names_redirect` | Odette | `step_active hen_names listen`, `secret_role doer` | « J'ai une confidence pour les oreilles de {partner}. Envoie-moi {partner}, et ensuite, c'est toi qui joueras. » |
| `jeanne_lucie_ask` (réécrit) | Jeanne | `step_active lucie_note receive`, `secret_role informed`; effet `give_item lucie_letter to informed` | « Ma tante Lucie a écrit une lettre à Firmin. Elle n'ose pas la lui donner. Moi non plus. Toi, tu oses ? » puis « Et après, ne me raconte rien, tu vas rougir. C'est {partner} qui me dira ce qu'il a répondu. » |
| `jeanne_lucie_redirect` | Jeanne | `step_active lucie_note receive`, `secret_role doer` | « C'est un secret pour {partner}. Toi, tu auras ton tour après. Va me chercher {partner} ! » |
| `firmin_lucie_reply_0` à `_2` (remplacent `firmin_lucie_reply`) | Firmin | `step_active lucie_note tell_jeanne`, `secret_role informed`, `variant lucie_reply k of 3`; `once: "duo"` | « Une lettre de Lucie. Pour moi. Je la lirai ce soir, au calme. » puis la phrase de la variante (tableau 2.3) |
| `firmin_lucie_reply_wrong_person` | Firmin | `step_active lucie_note tell_jeanne`, `secret_role doer`, la lettre vient de l'autre | « Merci. Ma réponse, je la donnerai à {partner}: c'est à {partner} que Jeanne l'a confiée. » |
| `firmin_lucie_already_told` | Firmin | `step_active lucie_note tell_jeanne`, `secret_role doer` | « J'ai tout dit à {partner}. Je ne vais pas le répéter: j'ai déjà rougi une fois. » |
| `jeanne_lucie_quiz` (remplace `jeanne_lucie_done`) | Jeanne | `step_active lucie_note tell_jeanne`, `secret_role doer` | « Alors ? Qu'est-ce qu'il a dit ? » Choix: les trois réponses du tableau 2.3, chacune avec `correct: { "type": "variant", "group": "lucie_reply", "value": k, "of": 3 }`. `reply`: « Ça, c'est Firmin tout craché ! Ma tante va devenir rouge comme une tomate. Tenez, mon argent de poche. » `replyWrong`: « Hmm... Ça ne ressemble pas à Firmin. Va redemander à {partner} ! » |
| `jeanne_lucie_not_you` | Jeanne | `step_active lucie_note tell_jeanne`, `secret_role informed` | « Non, pas toi: tu vas rougir ! Je veux l'entendre de {partner}. » |
| `jeanne_lucie_reminder` (réservé à l'informé, passé au tutoiement) | Jeanne | `step_active lucie_note give`, `secret_role informed` | « Tu l'as donnée ? Non ? Firmin passe ses journées sur le quai, près de la cloche. Il ne mord pas. Enfin, je crois. » |
| `jeanne_heron_ask` (réécrit) | Jeanne | inchangé | « Le héron est revenu au gué ! Il pêche l'après-midi, au bord, là où l'eau devient profonde. Allez-y à deux, et regardez-le sans bouger. » |
| `firmin_geese_ask` (réécrit) | Firmin | inchangé | « Des oies sauvages se sont posées sur l'Aubrune, devant le banc de la berge. En fin d'après-midi, elles repartent vers le nord. Asseyez-vous à deux sur ce banc, et regardez-les partir. » |
| `firmin_basile_lost` (réécrit) | Firmin | inchangé | « Basile est passé tout à l'heure, une échelle sur l'épaule. Il allait vers le grand chêne, près de la remise. » |
| `odette_basile_lost` (réécrit) | Odette | inchangé | « Basile ? Je l'ai vu partir vers la remise avec une échelle sur l'épaule. À son âge ! » |
| `basile_lost_help` (réécrit) | Basile | inchangé | « Mettez-vous de part et d'autre de l'échelle, et tenez bon. Je monte. » |

`jeanne_notebook_ask` (P1, réservé à l'informé): « J'ai perdu mon carnet de galets ! Je t'ai fait un dessin de là où je crois l'avoir laissé. Mais la règle, c'est: qui a le dessin ne cherche pas. C'est {partner} qui cherche ! »; renvoi pour l'autre: « J'ai fait un dessin pour {partner}. Toi, tu cherches, et {partner} te guide ! »

---

## 4. Critères d'acceptation proposés (à rendre testables par qa-testeur)

### Moments rares

| N° | Critère | Vérification |
|---|---|---|
| M-01 | La réserve compte au moins 6 moments P0 avec modèle animé, son d'attente et son d'apogée | validateur: chaque moment a `actors[].model` présent dans `assets/modeles/index.json`, des sons présents dans `sons.json`, et `texts` valides |
| M-02 | Chaque apogée reste au moins 3 s à moins de `watch.radius` de chacun des deux personnages | test unitaire: pour chaque moment, échantillonner la chorégraphie à 20 Hz depuis les positions de déclenchement extrêmes (anneau de `minRadius` à `radius`) et mesurer le temps où la cible est à moins de 6 m |
| M-03 | L'apogée commence sur les deux écrans à moins de 0,5 s d'écart | test de bout en bout à deux instances (`deux-vues.html?rendu=leger`): horodatage de `moment_climax` reçu par l'invité contre l'hôte |
| M-04 | Une capture par moment, chez l'hôte et chez l'invité, au milieu de l'apogée, regardée de près: rien qui traverse l'eau, le tronc, le banc ni le sol, l'échelle touche le tronc, les pattes du héron dans la lame d'eau | captures `captures/tour-06/moment-<id>-hote.png` et `-invite.png` |
| M-05 | L'apogée ne part pas si un seul joueur est là, si l'un est dans la maison, dans un menu ou une conversation | tests unitaires de la condition de déclenchement |
| M-06 | Le texte d'apogée ne décrit rien qui ne se voie ni ne s'entende | relecture croisée texte contre chorégraphie et liste des sons (une ligne par affirmation du texte) |
| M-07 | Aucun moment ne revient en moins de 7 jours | robot sur 8 graines, démo entière: `history` ne contient jamais deux fois le même moment à moins de 7 jours; et 20 000 graines par le script de simulation |
| M-08 | Les quêtes `heron_watch`, `wild_geese` et `basile_lost` se finissent sur toutes les graines où elles sortent | robots: les deux robots vont au point, prennent la pose demandée (immobiles et tournés, assis, ou tenant) et attendent l'apogée |
| M-09 | Lâcher l'échelle met Basile en pause sans faire échouer | test: un robot lâche à t = 4 s, Basile s'arrête, `ladder_hold_on` affiché; il reprend au même instant quand les deux tiennent; après 7,4 s (Basile au sol), lâcher ne l'arrête plus |
| M-10 | La confidence du matin ne s'affiche que chez son destinataire et alterne | test unitaire du modèle d'interface des deux personnages sur 8 graines |
| M-11 | Le tirage ne change rien au reste de la partie | test: même graine, avec et sans `moments.json`, mêmes envies, mêmes variantes, même météo |
| M-12 | Budget tenu | captures de performance au moment le plus chargé (oies en vol au-dessus de la place, vers luisants): appels de dessin et triangles sous les budgets du rendu (150 appels, 250 000 triangles) |

### Informations propres

| N° | Critère | Vérification |
|---|---|---|
| S-01 | Une quête secrète par semaine de la démo: `hen_names` démarre au plus tard le jour 7 et `lucie_note` dans la semaine 2 | robots sur 8 graines |
| S-02 | L'écran de l'autre ne montre jamais le secret | test unitaire: le modèle d'interface et la liste d'étiquettes du rendu de l'autre ne contiennent ni les lignes de `card` ni les noms des poules avant `reveal_secret`; test de bout en bout à deux instances: le texte du DOM de l'autre ne contient pas ces chaînes à chaque étape |
| S-03 | Le dialogue qui donne le secret n'est jamais proposé à l'autre, l'action qui vérifie jamais à l'informé | tests unitaires de `secret_role` |
| S-04 | Les robots finissent les deux quêtes sur toutes les graines, en transmettant le secret | robots avec une « voix » simulée: le robot informé lit son propre état d'interface et le passe au robot de l'autre; 0 erreur attendue |
| S-05 | Des robots qui ne se parlent pas les finissent aussi | robots « sourds » qui devinent: au plus 3 erreurs pour les poules, 2 pour Lucie; le coup de coude apparaît chez l'informé à la 2e erreur |
| S-06 | L'alternance tient | test: premier secret à p1, deuxième à p2, confidences du matin en commençant par p2 |
| S-07 | Sauvegarde et reprise au milieu d'une quête secrète gardent rôles, variante, étiquettes et erreurs | test de sauvegarde |
| S-08 | Le couple se parle | observation chez le client: question au compte rendu de session (« Qui a dit les noms des poules à qui ? ») |

## 5. Périmètre

- **P0 (tour 6)**: système de moments (tirage, phases, déclenchement, retours d'observation, règle des 7 jours, confidence du matin); moments héron, oies, échelle, mésanges, renard, vers luisants; quêtes `hen_names` et `lucie_note` refaites; geste « tenir »; textes et dialogues de la section 3.
- **P1**: chevrette, martin-pêcheur, onglet Souvenirs, carnet perdu en guidage, filtrage du secret dans l'instantané de l'invité.
- **Plus tard (plan des 100 heures)**: au moins 12 moments par saison et par arc (R8, R9), moments propres à chaque saison (hirondelles, brume sur l'Aubrune, grues à l'automne, traces dans la neige), une quête secrète nouvelle par arc (R16), le coin du pêcheur.
- **Hors périmètre**: moments qui punissent (bête qui fuit pour de bon, poules mangées), moments vus par un seul joueur qui donneraient une récompense, son privé (les deux machines sont dans la même pièce: un son n'est jamais un secret).

## 6. Questions ouvertes

1. **Pour le client: fréquence des moments.** Environ un tous les trois jours (4 à 5 par démo). Recommandation: garder 0,5, et ajuster après la première session (0,35 pour plus de rareté, 0,65 pour plus de vie).
2. **Pour le client: qui reçoit le premier secret.** Le joueur 1 (le premier personnage de la partie, `p1`) a la première quête secrète, le joueur 2 la première confidence du matin. Recommandation: garder, chacun a ainsi « son » premier secret dans la semaine 1.
3. **Pour l'architecte (via le manager): filtrer le secret de l'instantané de l'invité.** Recommandation: non pour la démo (les deux joueurs sont dans la même pièce, l'interface suffit et se teste), oui plus tard si le coût est faible.
4. **Pour le directeur artistique: échelle de lisibilité des petits oiseaux.** Recommandation: x 1,5 au plus pour la mésange et le martin-pêcheur, décidé sur capture au zoom moyen.

---

## Annexe A: résultats de la simulation

`python3 -I docs/jeux/jeu-1/simulations/moments_rares.py` (10 s, bibliothèque standard):

```text
== 1. Démo, 8 graines du robot (dailyChance 0,5, P0 seulement) ==
graine 1: 4 moments, reprises < 7 j: 0 | j5 fox, j6 heron*, j11 geese*, j13 glowworms
graine 2: 6 moments, reprises < 7 j: 0 | j3 fox, j5 heron, j7 geese, j10 ladder*, j13 tits, j14 fox
graine 3: 5 moments, reprises < 7 j: 0 | j5 fox, j6 heron*, j9 glowworms, j11 geese*, j13 fox
graine 4: 5 moments, reprises < 7 j: 0 | j5 heron, j6 geese, j10 ladder*, j11 fox, j13 glowworms
graine 5: 5 moments, reprises < 7 j: 0 | j3 fox, j6 heron*, j10 fox, j11 geese*, j14 glowworms
graine 6: 5 moments, reprises < 7 j: 0 | j3 fox, j6 heron, j7 geese, j10 ladder*, j13 heron
graine 7: 5 moments, reprises < 7 j: 0 | j6 heron*, j7 fox, j9 glowworms, j11 geese*, j13 heron
graine 8: 5 moments, reprises < 7 j: 0 | j5 heron, j6 fox, j7 geese, j10 ladder*, j14 glowworms
(* = moment de quête)

== 2. Démo, 20 000 graines ==
chance | réserve | moments par démo (moy., p10, p90, min, max) | jours de 2 à 14 sans train avec un moment | sortes vues (moy.) | reprises < 7 j
0.35 | P0    | 3.88, 2, 5, 1, 8 | 32% | 3.46 | 0
0.50 | P0    | 4.79, 3, 6, 1, 8 | 40% | 4.03 | 0
0.65 | P0    | 5.62, 4, 7, 1, 8 | 47% | 4.47 | 0
0.35 | P0+P1 | 4.46, 3, 6, 1, 10 | 37% | 4.06 | 0
0.50 | P0+P1 | 5.70, 4, 8, 1, 10 | 47% | 4.91 | 0
0.65 | P0+P1 | 6.90, 5, 9, 2, 10 | 58% | 5.61 | 0

== 3. Retard des joueurs sur les quêtes (0, 1 ou 2 jours), chance 0,5, P0 ==
moments par démo: 4.82; reprises < 7 j: 0

== 4. Part de chaque moment (chance 0,5, P0), 20 000 graines ==
fox        1.34 par démo
heron      1.27 par démo
geese      0.87 par démo
glowworms  0.58 par démo
ladder     0.50 par démo
tits       0.23 par démo

== 5. Long cours (21 jours par saison, 4 saisons x 4 ans, chance 0,5) ==
réserve par saison | moments par saison | écart médian entre deux passages du même moment (jours) | écart p10
 6 | 9.8 | 10 | 7
 8 | 8.6 | 15 | 7
12 | 9.3 | 19 | 8
```

Limites: le script suppose que les robots voient chaque moment de quête le jour où il sort (la partie 3 teste un retard de 0 à 2 jours); il ne simule pas la présence des joueurs pour les moments d'ambiance (un moment présent mais manqué compte quand même dans la fenêtre de 7 jours, ce qui est la règle). Les variantes de quête sont calculées avec la même empreinte que `variantOf`; les graines 1 à 8 du script sont donc celles du robot si le robot utilise ces graines.

## Historique

| Date | Version | Changement |
|---|---|---|
| 2026-10-31 | 1 | Première version (tour 6 du gauntlet) |
| 2026-10-31 | 2 | Fiches 1.4 et table 1.6 alignées sur ce qui est joué: apogées du héron (7,4 s), des oies (16,8 s) et du renard (6,9 s) allongées pour M-02 (alerte tenue plus longtemps); échelle au sud-ouest du chêne, places renommées `ladder_hold_east` et `ladder_hold_west`, nichoir abaissé à 1,84 m, chicot à 2,19 m, 3 barreaux, apogée de 8,2 s, lâcher permis après 7,4 s (décision du manager); raison de la hauteur écrite; réserves de lisibilité de l'échelle notées. Textes corrigés à la revue: fin de `heron_watch` (accord au genre retiré), `geese_not_yet` (heure de l'horloge), `moment_ladder_climax` (la mésange se pose sur le toit), `odette_hen_names_tell` (« vos poules »), `jeanne_lucie_reminder` (Firmin n'est au quai que le jour) |
| 2026-11-01 | 3 | Correctifs de la revue du DA (G9) et de la recette (QA6-04 à QA6-08), dev gameplay 3D; les fiches 1.4.3, 1.4.4 et la table 1.6 ci-dessus gardent les valeurs de la version 2, ce sont celles-ci qui font foi (`cartes/halte.json`, `moments.json`). Chêne `tree_oak_01` en (50,5 ; 5,5), tourné d'un quart (sa branche basse au nord); échelle contre la face sud-est, vue de face en orientation 0: pied `ladder_foot` (51,19 ; 6,19), cap 315°, tête en (50,64 ; 5,64) appuyée par le dernier barreau; places `ladder_hold_east` (51,61 ; 5,79, cap 225°) et `ladder_hold_west` (50,79 ; 6,61, cap 45°), noms gardés (l'une est à l'est de l'autre); Basile en (51,58 ; 6,58), cap 315°; nichoir sur la face est, clou (50,732 ; 5,40 ; 2,425), centre de la caisse à 2,25 m, trou à 2,30 m, 3 barreaux (pieds à 0,84 m, mains à hauteur d'épaule), apogée de 8,2 s inchangée; chicot sur la face nord-est, bout (50,915 ; 4,996 ; 2,67) (au sud, une branche vivante; au sud-est, l'échelle); mésanges: B quitte le chicot à 1,7 s et chante sur le toit du nichoir de 1,9 à 4,0 s pendant que A est dedans (`tit_song` à 1,9 s); houppier tramé devant le nichoir pendant l'attente, l'apogée et l'après de `ladder` et `tits` quand la caméra voit la face du nichoir. Héron posé sur la langue de sable de la rive nord, `heron_rest_far` (31,5 ; 38,5), vol au ras de l'eau (4,6 s: 22,0 ; 39,6; 5,6 s: 26,0 ; 39,3; 6,6 s: 30,4 ; 38,7). `moment_seen` (et donc la fin de l'étape de quête et son texte) arrive à la fin du spectacle; la récompense reste au début; une apogée en pause se termine à `present.to`; une sauvegarde faite pendant l'apogée la termine au rechargement (texte et fin d'étape). Renard: champ `roam` (2,2 m) couvert par la zone d'où les joueurs sont repoussés; héron: zone étendue jusqu'à son pas de côté. Sons des moments muets hors de la journée |
