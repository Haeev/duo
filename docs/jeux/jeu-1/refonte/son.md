# La Petite Ligne (refonte): document sonore, jalon 1

| Champ | Valeur |
|---|---|
| Statut | lot L9 (moteur, babil, sons de base, ambiances jour et nuit), lot musique d'Aubrune (10 morceaux, 7 jingles, régie par table) et deuxième lot d'effets (2026-11-11: pêche, cuisine, déco, cloches, passage à niveau, 5 h 12, porte, boutique, pièces, décision à deux, photo, pas sur bois, eau, gravier, tapis), six points d'accroche branchés (2026-11-11 au matin) et les 8 airs de la collection avec la musique des fêtes (2026-11-11), troisième lot (draisine, applaudissements, épuisette) et timbres de la musique jouée (2026-11-11 après-midi); reste: quatre briques du moteur pour la draisine (section Troisième lot), le bouton « Écouter » du carnet (section Airs), un air propre à chaque fête si le client le souhaite, les bruitages des scènes de fête |
| Rédaction | sound-designer, 2026-11-10 |
| Fichiers | sons: `games/la-petite-ligne-2/assets/commun/son/`; sources: `games/la-petite-ligne-2/assets-src/son/`; tables et moteur: `games/la-petite-ligne-2/src/audio/` (README) |

## Principes

- Un son à chaque geste, en moins d'un dixième de seconde (références de ressenti, section 3): les sons de geste durent de 0,07 à 0,4 s et partent à l'événement.
- Couleur: bois, tissu, papier, eau, clochettes en sol majeur (tout ce qui tinte reste dans l'accord de sol). Aucun son inquiétant à Aubrune.
- Les actions de l'autre joueur s'entendent, placées et 3 dB plus bas; les retours privés (refus, argent, besoins, sac plein) ne s'entendent que chez leur joueur.
- Niveaux de fichier: effets et notes de babil à -16 LUFS momentanés (les sons percussifs courts sont limités par la crête, à -1,2 dBFS au plus), boucles à -16 LUFS intégrés. Le niveau de jeu se règle en dB dans `donnees/sons.json`. Mesures: `assets-src/son/mesures.csv`.

## Événements

| Événement | Son | Niveau (dB) | Priorité | Variations | Qui l'entend |
|---|---|---|---|---|---|
| pas sur l'herbe, la terre, le pavé (un par foulée de 0,85 m) | `pas-herbe`, `pas-terre`, `pas-pave` | -14, -13, -9 | 3 | 3 variantes, hauteur 5 à 6 %, niveau 1,5 dB | les deux, l'autre placé |
| cible visée qui change | `cible` | -10 | 3 | hauteur 2 % | soi |
| geste réussi (général) | `reussite` | -8 | 2 | niveau 0,5 dB | les deux |
| geste réussi, ramasser | `ramasser` | -8 | 2 | hauteur 5 % | les deux |
| refus | `refus` | -8 | 2 | hauteur 3 % | soi |
| s'asseoir | `asseoir` | -9 | 3 | hauteur 5 % | les deux |
| poser (signal de l'interface `poser`) | `poser` | -9 | 2 | hauteur 5 % | soi |
| ouvrir un rangement | `rangement-ouvre` | -8 | 2 | hauteur 4 % | les deux |
| fermer un rangement (signal `rangement-ferme`) | `rangement-ferme` | -8 | 2 | hauteur 4 % | soi |
| sac plein, outil émoussé | `sac-plein`, `refus` | -8 | 2 | | soi |
| gain d'argent (vente, récompense) | `pieces-vente` (pièces qui tintent et tombent dans la bourse) | -11 | 2 | hauteur 4 %, niveau 0,5 dB | soi |
| dépense (achat, loyer) | `pieces-achat` (trois pièces posées sur le comptoir de bois) | -11 | 2 | hauteur 4 %, niveau 0,5 dB | soi |
| ouvrir, fermer le carnet (signaux) | `carnet-ouvre`, `carnet-ferme` | -9 | 2 | hauteur 3 % | soi |
| page de dialogue | `page` | -10 | 3 | hauteur 6 % | soi |
| choix (signal `choix`) | `choix` | -6 | 3 | aucune | soi |
| palier de besoin bas ou bloqué, bonus, repas à deux | `palier-bas`, `palier-bonus` | -11 | 2 | aucune (tintements accordés) | soi |
| eau de la pompe (geste de lavage) | `eau-pompe` | -10 | 3 | hauteur 3 % | les deux |
| réveil du matin (les deux ont dormi) | `reveil` | -10 | 1 | aucune | les deux |
| montée à bord | `embarquement` | -9 | 1 | aucune | les deux |
| train qui arrive | `train-arrive` | -8 | 1 | aucune | les deux |
| trajet (phase de voyage) | `ambiances/trajet` (boucle 8 s) | -16 | | | les deux |

### Deuxième lot (2026-11-11)

Sources: `assets-src/son/sons_aubrune.py` (une fabrique par son, table `SONS` avec le nombre de variantes), rendu et mesure par `duo-python assets-src/son/mesurer_lot.py`, contrôle par `controler.py`. Les cloches et sonneries ne sont pas placées: elles s'entendent dans tout le lieu, de loin (réverbération de plein air, aigus adoucis).

| Événement | Son | Niveau (dB) | Priorité | Variations | Qui l'entend |
|---|---|---|---|---|---|
| `fish_cast` | `peche-lancer`: fouet de la canne, fil qui file, bouchon posé à 0,62 s | -9 | 2 | hauteur 4 % | les deux, placé |
| `fish_hooked` | `peche-touche`: le bouchon plonge, deux tintements (sol 6, ré 7) | -6 | 1 | hauteur 2 % | les deux, placé |
| `fish_lost` raté au ferrage (`missed`) | `peche-bouchon`: « bloup » du bouchon qui remonte | -10 | 3 | hauteur 6 % | les deux, placé |
| `fish_lost` décroché (`escaped`) | `peche-casse`: claquement, corde qui vibre en descendant, sans drame | -10 | 2 | hauteur 4 % | les deux, placé |
| `fish_lost` ligne rangée (`cancelled`), signal `peche-moulinet` | `peche-moulinet`: cliquet qui accélère | -8 | 3 | hauteur 5 % | les deux, placé |
| `fish_caught` | `peche-prise`: gerbe et gouttes | -8 | 2 | hauteur 4 % | les deux, placé |
| signaux `cuisine-chop`, `cuisine-stir`, `cuisine-heat` | `cuisine-decoupe` (3 variantes), `cuisine-mijote`, `cuisine-friture` | -10, -12, -13 | 3 | hauteur 4 à 6 % | soi |
| `dish_cooked` qualité 2 ou 3 | `plat-reussi`: assiette qui tinte, ré, sol, si qui montent | -8 | 2 | niveau 0,5 dB | les deux, placé |
| `dish_cooked` qualité 1 | `plat-rate`: deux notes de bois qui descendent (ré, si), « plof » | -9 | 2 | hauteur 2 % | les deux, placé |
| `deco_changed` `drop` ou `cancel` | `meuble-poser` (2 variantes): deux appuis de bois | -8 | 2 | hauteur 5 % | les deux, placé |
| `deco_changed` `grab` ou `take` | `meuble-soulever` | -9 | 2 | hauteur 5 % | les deux, placé |
| `deco_changed` `store` | `meuble-ranger`: froissement, couvercle, note de verre | -9 | 2 | hauteur 4 % | les deux, placé |
| signal `meuble-tourner` | `meuble-tourner`: pied qui frotte puis se cale | -10 | 3 | hauteur 5 % | soi |
| `door_passed` | `porte`: loquet, grincement léger, porte refermée à 0,78 s (couvre le fondu d'entrée) | -10 | 2 | hauteur 4 % | les deux, placé |
| `shop_opened` | `clochette-boutique`: clochette de laiton sur ressort (si 6, ré 7) | -12 | 2 | hauteur 1 % | les deux, placé |
| `decision_changed` `agreed` | `decision-accord`: ré et sol ensemble, puis si (accord de sol) | -7 | 1 | aucune | les deux (l'autre 3 dB plus bas) |
| `decision_changed` `split` | `decision-desaccord`: do puis la, en suspens, sans reproche | -9 | 2 | aucune | les deux |
| `photo_taken` | `photo-declic`: déclencheur, rideau, ressort | -8 | 2 | hauteur 3 % | les deux, placé |
| scène `en-voiture` temps 1, `l-autorail-creme` temps 1 | `cloche-marthe`: trois coups de la grande cloche, juste (sol, tierce majeure), 8,5 s | -10 | 1 | aucune | les deux, dans tout le lieu |
| `clock_struck` (heures pleines de 7 h à 19 h, coup par coup, 3 s d'écart; quatre minutes de retard jusqu'au fait `aubrune.cloche.juste`) | `cloche-marthe-coup`: un coup, 5,5 s | -10 | 1 | aucune | les deux |
| scène `la-felee-sonne` temps 0 | `cloche-felee`: la petite cloche fendue, partiels désaccordés qui battent, un peu de râpe; drôle, pas inquiétante | -11 | 1 | aucune | les deux |
| `calendar_started` de `train-du-samedi`, `depart-du-train-du-samedi`, `autorail-de-5h12`, `depart-de-l-autorail` (le train passe la barrière) | `passage-a-niveau`: timbre électrique (si 5) frappé 9 fois par seconde, 3,5 s | -13 | 2 | aucune | les deux |
| scène `la-sonnerie-de-5h12` temps 1, `la-pose-longue` temps 2 | `cinq-douze`: deux coups isolés du même timbre, de loin, puis un roulement grave qu'on peut prendre pour le vent | -8 | 1 | aucune | les deux |
| pas sur `bois` (plancher), `eau` (gué), `gravier` (galets, ballast), `tapis`; `sable` joue `pas-terre` | `pas-bois`, `pas-eau`, `pas-gravier`, `pas-tapis` (3 variantes chacun) | -10, -15, -12, -15 | 3 | hauteur 5 à 6 %, niveau 1,5 dB | les deux, l'autre placé |

`monnaie` reste dans la table, sans règle (remplacé par `pieces-vente` et `pieces-achat`). Le joueur qui cuisine entend aussi `poser` (signal `dish` de l'interface) avec `plat-reussi`: l'assiette posée sous le tintement, voulu.

**Mesures** (ffmpeg `ebur128`, fichiers décodés; `assets-src/son/mesures.csv`): sonie momentanée maximale de -16,0 à -19,4 LUFS pour les sons de plus de 0,4 s (sauf `peche-moulinet`, -22,9, limité par la crête de ses cliquets: niveau de jeu -8 dB au lieu de -10), crêtes de -1,2 à -6,9 dBFS; les sons de moins de 0,4 s (pas, découpe, meuble posé, déclic) sont limités par leur crête (-1,3 à -2,4 dBFS), mesurés de -20 à -29 LUFS par une fenêtre plus longue qu'eux, comme les pas du lot L9. Part de l'énergie sous 300 Hz: 0 à 14 % partout, sauf `meuble-poser` (49 à 52 %, sous le plafond de 60 %). Poids: 44 fichiers, 382 Ko. Mémoire décodée: environ 50 s de son mono, soit 9,6 Mo à 48 kHz, dont 30 s pour les cinq cloches et sonneries (candidates à un décodage à la demande si le plafond l'exige).

### Points d'accroche (branchés le 2026-11-11 au matin, `src/audio/donnees/evenements.json`, test `tests/audio-accroches.test.ts`)

| Accroche | Branchement | Son |
|---|---|---|
| Surface sous les pas | `main.ts` passe `surfaceAt` (`createSurfaceLookup`, `src/audio/sol.ts`) | `pas-herbe`, `pas-terre`, `pas-pave`, `pas-bois`, `pas-eau`, `pas-gravier`, `pas-tapis` (`vase` et `potager` rendent `terre`) |
| Gestes de cuisine | l'interface envoie `cuisine-${kind}`; `cook_step_done` porte `kind`, une règle par nature pour l'autre joueur | `cuisine-decoupe`, `cuisine-mijote`, `cuisine-friture` |
| Moulinet pendant la tirée | signal `peche-moulinet` de l'interface de pêche à chaque tour (délai minimal 200 ms) | `peche-moulinet` |
| Tourner un meuble | `deco_changed` avec `action: "rotate"` | `meuble-tourner` |
| Cloche des heures | `clock_struck` de l'hôte (`simulation/monde/cloche.ts`, réglages `reglages-cloche.ts`) | `cloche-marthe-coup` |
| Passage à niveau | `calendar_started` des quatre passages de train | `passage-a-niveau` |

### Troisième lot (2026-11-11 après-midi): draisine, applaudissements, épuisette

Sources: `assets-src/son/sons_lot3.py` (table `SONS`, et `BOUCLES` pour les sons tenus), rendu et mesure par `duo-python assets-src/son/mesurer_lot.py --lot 3`, planche par `planche_lot.py --lot 3` (`assets-src/son/ecoute/lot-3-aubrune.m4a`). Draisine: bois et fonte, rien de métallique aigu; joints de rail tous les 6 m, essieux à 1,4 m.

| Événement | Son | Niveau (dB) | Priorité | Variations | Qui l'entend |
|---|---|---|---|---|---|
| `vehicle_stroke` (`push`, `same`, `alone`) | `draisine-balancier`: le bras de bois grince sur son palier, la bielle cogne doucement en bout de course | -13 | 3 | 3 variantes, hauteur 5 %, niveau 1,5 dB | les deux, l'autre placé |
| `vehicle_stroke` `jam` | `draisine-bloque`: choc sourd et rond, court gémissement du bois, sans claquement | -11 | 2 | hauteur 4 % | les deux, placé |
| `vehicle_started` (jusqu'à `vehicle_stopped`, ou `vehicle_in` d'office pour un train) | `draisine-roulement-moyenne`: roulement tenu, joints qui claquent par paires toutes les secondes (6 m/s) | -18 | 2 | aucune (boucle de 3 s) | les deux |
| aucun pour l'instant (vitesse lente, rapide) | `draisine-roulement-lente`: roulement tenu au pas, joints toutes les 2,5 s (2,4 m/s, boucle de 5 s), `draisine-roulement-rapide`: roulement tenu plus clair, joints toutes les 0,75 s (8 m/s, boucle de 3 s) | -20, -16 | 2 | aucune | les deux |
| aucun pour l'instant (frein serré) | `draisine-frein`: le levier tombe, le patin de bois frotte la roue, frottement qui ralentit | -12 | 2 | hauteur 4 % | les deux |
| aucun pour l'instant (arrivée en bout de voie) | `draisine-butee`: tampon de bois contre la butée, petit rebond | -10 | 2 | hauteur 3 % | les deux |
| aucun pour l'instant (un essieu passe un joint) | `draisine-joint`: tic du fer, cognement du plancher | -14 | 3 | 2 variantes, hauteur 5 % | les deux |
| `vehicle_warning` | `draisine-avertissement`: sifflet de la rame, de loin (sol et ré), un long, un court | -9 | 1 | aucune | les deux |
| `music_finished`, au moins un auditeur, mot 3 | `applaudissements-enthousiastes`: onze personnes, vite, deux « bravo » et un « ah ! » sans paroles | -6 | 2 | hauteur 3 % | les deux |
| `music_finished`, au moins un auditeur, mot 2 | `applaudissements-chaleureux`: huit personnes, un « ah ! » ravi | -8 | 2 | hauteur 3 % | les deux |
| `music_finished`, au moins un auditeur, mot 0 ou 1 | `applaudissements-polis`: cinq personnes, quelques mains | -10 | 2 | hauteur 3 % | les deux |
| `fish_caught` avec `together` (l'épuisette de l'autre) | `epuisette-plonge`: l'épuisette plonge, remonte en ruisselant, le poisson frétille dans le filet | -8 | 2 | hauteur 4 % | les deux, placé |
| `fish_net_missed` | `epuisette-rate`: « flouch » mat de l'épuisette vide, deux gouttes | -12 | 3 | hauteur 6 % | les deux, placé |

Sans auditeur, pas d'applaudissements (on répète seul). L'annonce d'un train jouait auparavant `passage-a-niveau`, son tenu que rien ne faisait taire: elle a maintenant son sifflet, qui s'arrête de lui-même.

**Briques manquantes** (moteur `src/audio/moteur.ts` et `regles.ts`, hors des données):

1. Plusieurs sons pour un événement: `soundForEvent` s'arrête à la première règle. `vehicle_stopped` avec `end` doit à la fois faire taire le roulement et jouer `draisine-butee`. Proposition: un champ `"also": true` sur une règle, qui laisse la recherche continuer après elle.
2. Boucle réglée par une valeur de l'état: le roulement suit la vitesse (`speed` du véhicule dans la tranche du lieu, de 0 à `speed.max`). Proposition: une table `held` dans `reglages.json` (`{ "sound": "draisine-roulement", "source": "vehicle.speed", "steps": [[0.3, "lente"], [3.5, "moyenne"], [6.5, "rapide"]] }`) lue par `frame()`, avec fondu croisé de 0,3 s entre deux allures et `playbackRate` de 0,9 à 1,1 dans chaque allure; les trois fichiers se raccordent (même grain, même niveau de fichier).
3. Frein: aucun événement quand `state.brake` change (`vehicules/index.ts`); il faudrait `vehicle_brake` (`on`: vrai ou faux), ou la brique 2 sur `vehicle.brake`.
4. Joints de rail: un compteur de distance comme `StepTracker` (`pas.ts`) sur la position du véhicule, `joint` tous les 6 m pour chaque essieu (1,4 m d'écart). En attendant, les claquements sont dans les boucles de roulement.

**Mesures** (`mesures.csv`, `mesurer_lot.py --lot 3`): crêtes de -1,4 à -8,9 dBFS; sons longs de -15,9 à -22,4 LUFS momentanés (les roulements limités par la crête de leurs joints); part de l'énergie sous 300 Hz: 0 à 46 % (`draisine-bloque` 46 %, roulements 41 à 45 %, sous le plafond de 60 %). Raccord des roulements: lus dans Chromium à 44,1 et 48 kHz par `AudioBufferSourceNode` en boucle, la suite après le raccord est identique au fichier (écart nul), et le saut au raccord reste dans la plage des sauts ordinaires (centile 69 à 98); l'écart entre les deux bords de la boucle est le seul bruit de codage (0,8 à 1,8 % de la crête). Poids: 17 fichiers, 295 Ko; les sons du jeu passent à 1,45 Mo et 97 fichiers (plafond 1,8 Mo et 120).

### Musique jouée: timbres (2026-11-11 après-midi)

`src/audio/musique/donnees/timbres.json`: cornet à douze harmoniques décroissantes (cuivre rond, passe-bas 4,2 kHz, attaque 32 ms qui retombe à 80 %, vibrato de 11 cents à 5,4 Hz après 280 ms), clarinette à harmoniques impaires dominantes (attaque 48 ms, tenue 88 %, vibrato discret de 4 cents). Rendu hors ligne par le vrai moteur (`ecoute-musique-jouee.cjs`, `assets-src/son/ecoute/musique-jouee.m4a`) sur « Marche de la halte »: chaque instrument seul à 4,4 et 4,6 dB au-dessus de l'accompagnement (soliste qui passe devant sans écraser), mélange à -16,0 LUFS, crête -5,0 dBFS (duo du canon: -2,2 dBFS). Note fausse (`MUSIC.sound`, simulation): elle part 41 cents bas et s'affaisse à 98 cents en 60 ms environ (mesuré). Le format n'a ni souffle d'attaque, ni éclat qui suit l'intensité, ni glissé d'entrée: ce sont trois champs à ajouter au schéma et à `scene.ts` si le client veut des cuivres plus vivants.

## Babil

Une note par lettre annoncée par l'interface (toutes les trois lettres, réglage de l'interface), sur un timbre d'instrument: voyelle plus longue, consonne plus brève, `?` monte, `.` retombe, `!` appuie. Même caractère, même degré de la gamme: la voix se reconnaît d'une phrase à l'autre.

| Voix (champ `voice` de la fiche) | Timbre | Tonique | Caractère |
|---|---|---|---|
| `medium` | clarinette | mi 4 | neutre, pentatonique majeure |
| `low` | basson | ré 3 | posé, gamme mineure |
| `grumpy` | basson | si 2 | lent, demi-ton grinçant |
| `high` | flûte | do 5 | vif |
| `shy` | flûte | mi 5 | court et retenu |
| `bright` | boîte à musique | sol 5 | clair |
| `soft` | ocarina | la 4 | rond, lent |
| `bouncy` | marimba | sol 4 | sautillant, large étendue |

## Ambiances

`jour` (vent, feuillage, oiseaux, 32 s) et `nuit` (vent grave, grillons, 32 s) en boucle, fondues à puissance constante selon l'heure (aube 5 h 30 à 7 h 30, soir 19 h à 21 h, fondu de 3 s); `trajet` (rails, 8 s) remplace les deux pendant le voyage. Niveaux de couche: -22 dB (jour, nuit), -16 dB (trajet).

## Musique (lot musique, 2026-11-10)

Réponse 72 du client: « un air différent selon l'heure et la météo, et selon les lieux ». Direction: maquette de train miniature, douceur (bible artistique 1), petite formation acoustique (accordéon, guitare nylon, clarinette, piano, contrebasse, glockenspiel, brosses), jamais d'accord tendu: Aubrune ne fait pas peur, même au 5 h 12. On garde l'esprit de l'ancien jeu (acoustique, sol majeur, boucles propres, repos de la musique), pas ses morceaux: le fil est un **motif du quai** nouveau, ré, sol, si, la, sol (une quarte, une tierce, un pas qui redescend, un repos). Tout le détail technique est dans `src/audio/musique/README.md`.

### Le système

- **Une table de données** (`src/audio/musique/donnees/musique.json`): des règles « contexte vers morceau » (lieu, zone, tranche horaire, météo, saison, phase de voyage, scène en cours, événement du calendrier; première règle qui convient), des **couches** qui s'appliquent ensemble (pluie ou brume: passe-bas à 4,2 kHz, air 3 dB plus bas, ensemble 1,5 dB plus bas; orage: passe-bas à 3 kHz; nuit: air 6 dB plus bas, passe-bas à 5,5 kHz; hiver: un peu plus doux), des rythmes de silence, des jingles. Ajouter un morceau ou une règle = des lignes de données.
- **Fondus**: enchaîné de 6 s entre deux morceaux (les deux tiges changent ensemble), 4 s vers un silence ou depuis un silence; niveaux de tige et passe-bas se déplacent en 2 à 4 s (pas de saut quand la pluie tombe).
- **Silences voulus**: après 150 à 240 s de musique (90 à 150 s la nuit et au 5 h 12), 50 à 100 s de calme (90 à 170 s la nuit) où seule l'ambiance reste. Pas de silence pendant le voyage ni les scènes.
- **Thème d'arrivée**: un lieu qu'on atteint (ou la partie qui commence) joue son thème court de 5,8 s, la musique attend 5 s.
- **Jingles**: la musique recule de 5 à 10 dB pendant le jingle et revient doucement. L'autre joueur entend les jingles « les deux » 3 dB plus bas; le repas partagé ne s'entend que chez son joueur.
- **Réglage du joueur**: volume de la musique séparé (`setSettings({ music })`, défaut 0,8, clé `la-petite-ligne-2.musique`) et coupure; la musique sort sur le bus `music` du SDK, sous les effets (niveau de jeu -6 dB).

### Morceaux (60 à 90 s, boucle sans couture, deux tiges `fond` et `air`)

| Morceau | Quand | Mesure, tempo | Durée | Tonalité (centre) | Instruments |
|---|---|---|---|---|---|
| `bourg-aube` | 5 h à 8 h | 4/4, 60 | 64 s | sol | piano en arpèges, glockenspiel, contrebasse à l'archet, clarinette dans la seconde moitié |
| `bourg-matin` | 8 h à 12 h 30 | 4/4, 96 | 80 s | sol | guitare, contrebasse, accordéon puis clarinette au motif, piano et glockenspiel à la reprise |
| `bourg-apres-midi` | 12 h 30 à 18 h | 6/8, 90 | 64 s | sol | clarinette puis accordéon, guitare, contrebasse, piano, glockenspiel |
| `bourg-soir` | 18 h à 21 h | 4/4, 80 | 72 s | mi (mode relatif: le motif décalé d'un degré) | accordéon lent, guitare, contrebasse, clarinette en tierce, éclats de glockenspiel |
| `bourg-nuit` | 21 h à 5 h | 4/4, 60 | 64 s | sol | piano seul (le début de chaque phrase du motif), contrebasse à l'archet, un éclat de verre de loin en loin |
| `bourg-pluie` | pluie, orage, neige, de jour | 4/4, 80 | 72 s | sol | piano doux, gouttes de glockenspiel, contrebasse à l'archet, clarinette lointaine |
| `riviere` | zone `riviere` d'Aubrune | 6/8, 72 | 70 s | ré mixolydien (mélodie une quarte plus bas) | guitare qui coule, piano en ruisseau aigu, clarinette, glockenspiel |
| `train` | embarquement, voyage, visiteur du samedi | 4/4, 120 | 64 s | sol | brosses en balancement, contrebasse qui marche, guitare, accordéon puis clarinette |
| `mystere` | 4 h 45 à 5 h 30, scène `sonnerie` | 4/4, 60 | 60 s | mi mineur | quelques notes de piano séparées de silences, contrebasse à l'archet, éclats de verre |
| `fete` | événement de fête | 3/4, 108 | 80 s | sol | valse: contrebasse, guitare, accordéon, clarinette, piano, glockenspiel |

**Tonalités compatibles.** Les dix morceaux et les sept jingles n'emploient que les sept notes de sol majeur (sol, la, si, do, ré, mi, fa dièse), vérifié sur les fichiers MIDI par `verifier_ecriture.py`. Les centres sont des degrés de la même gamme (sol, mi, ré): n'importe quel fondu enchaîné se fait sur des notes communes, sans frottement, et les jingles, écrits sur sol, s'accordent à tous. Les tempos diffèrent (60 à 120): sur 6 s de fondu, ce sont deux mouvements qui se croisent, jamais une dissonance. Les ambiances et les motifs d'habitants (sol majeur) restent justes aussi.

### Jingles (2 à 4 s, plus le thème d'arrivée de 5,8 s)

| Jingle | Événement | Son | Durée |
|---|---|---|---|
| `prise-nouvelle` | `collection_found` avec `first` (les deux, l'autre plus bas) | arpège de glockenspiel qui monte (ré, sol, si, ré) sur un accord de guitare et d'accordéon | 2,7 s |
| `etape-quete` | `quest_step_done` (les deux) | la quarte du motif, clarinette et verre | 2,0 s |
| `quete-terminee` | `quest_done` (les deux) | le motif complet posé sur sol | 4,2 s |
| `reveil` | `day_started` quand les deux ont dormi | arpège de guitare qui monte, clarinette, éclat de verre | 4,0 s |
| `repas-partage` | `meal_shared` (soi seulement) | trois notes d'accordéon en valse, basse qui rebondit | 3,8 s |
| `collection-complete` | `collection_completed` (les deux) | cascade pentatonique de glockenspiel, accord de sol qui s'ouvre | 3,6 s |
| `arrivee-aubrune` | arrivée dans le lieu (`arrivals`) | le début du motif du quai, accordéon et guitare | 5,8 s |

### Niveaux et poids (mesurés, `assets-src/son/musique/mesures.csv`)

- Chaque morceau, tiges additionnées, mesuré par `ebur128` de ffmpeg sur les fichiers décodés: -16,0 à -16,5 LUFS intégrés (cible -16, tolérance 0,7), crêtes vraies de -1,6 à -5,1 dBTP (plafond -1); le rendu corrige son écart avec la mesure de ffmpeg (trois passes). Chaque tige est 1 à 7 dB sous le morceau (mesure ci-dessus) pour que leur somme retombe à -16.
- Poids: 6,4 Mo pour les 17 fichiers de jeu (11,09 Mo avec les 8 airs de la collection, plafond 12 Mo), Opus mono 36 kbit/s. Mémoire: décodés à 24 kHz, un morceau de 70 s pèse 13 Mo (deux tiges); un morceau résident en plus de celui qui joue: 27 Mo en régime, 40 Mo au pire pendant un fondu (à confirmer contre le plafond de 64 Mo de l'architecture avec le reste du son).
- Niveau de jeu: musique -6 dB (donc environ -22 LUFS au niveau 1), ambiance -22 dB, jingles -3 à -4 dB (musique reculée de 5 à 10 dB).

### Airs de la collection et musique des fêtes (2026-11-11)

Les huit fiches « Musiques » du carnet ont chacune leur air, au même identifiant dans `musique.json` (le morceau `air-marche-de-la-halte` est l'air de l'entrée `air-marche-de-la-halte`). Partitions: `assets-src/son/musique/airs.py` (liste `AIRS`, rendue par `generer.py` comme les autres morceaux), MIDI dans `assets-src/son/musique/midi/`. Compositions originales, sept notes de sol majeur seulement (vérifié par `verifier_ecriture.py`, aucun frottement), deux tiges `fond` et `air`, boucle sans couture.

| Air (fiche) | Intention | Écriture | Durée | Sonie, crête vraie | Poids |
|---|---|---|---|---|---|
| `air-marche-de-la-halte` | fanfare du quai | marche 2/4 à 120: bugle (trompette douce), tuba, cors, caisse claire; le trombone relance un temps avant le motif; trio à la clarinette, reprise en tutti avec glockenspiel | 64 s | -16,2 LUFS, -1,5 dBTP | 590 Ko |
| `air-valse-de-la-minute` | valse du dernier bal | 3/4 à 135, accordéon; le pont sifflé par Ambroise pendant que la pendule bat (bois très doux); reprise accordéon et clarinette en tierce | 64 s | -16,1, -1,9 | 597 Ko |
| `air-carillon-des-deux-soeurs` | complainte de la Fêlée | clarinette en mi mineur doux sur harpe et contrebasse à l'archet; puis la grande cloche (sol) et la Fêlée refondue (ré) sonnent juste, en sol, boîte à musique | 64 s | -16,0, -2,0 | 597 Ko |
| `air-chanson-des-marmites` | berceuse d'Honorine | 3/4 à 100: boîte à musique seule; le bourg la reprend à l'accordéon et à la clarinette en tapant sur les couvercles (cloche de cymbale, tom grave); elle redevient berceuse | 72 s | -16,0, -1,6 | 668 Ko |
| `air-canon-de-la-repetition` | ritournelle des grenouilles | 4/4 à 120: canon à trois voix à deux mesures d'écart (basson, clarinette, pizzicati) sur un ostinato; chacun s'arrête à son tour; le guiro fait les grenouilles | 64 s | -16,1, -1,7 | 584 Ko |
| `air-chant-de-la-coupe` | trombone du bief | blues gentil en ré mixolydien (le do naturel seule couleur bleue), 4/4 à 90 en balancement; trombone, puis appel et réponse avec la clarinette; un coup de bois par mesure pour la hache | 64 s | -16,1, -1,5 | 595 Ko |
| `air-sifflet-du-samedi` | chanson de la draisine | 6/8 à 135: guitare en arpèges qui roulent, brosses sur les éclisses; la chanson commence par deux brèves et une longue, que le sifflet double | 64 s | -16,0, -1,8 | 597 Ko |
| `air-sonnerie-de-5h12` | hymne de la ligne | le motif du quai en choral à quatre voix: harmonium, puis cor, chœur, tous; la cloche (sol et sa tierce) et un sifflet lointain | 64 s | -16,0, -2,1 | 597 Ko |

Mesures: `controler.py` sur les fichiers décodés (`mesures.csv`), raccord au plus 0,45 fois le centile 99,5 des deuxièmes différences (seuil 4). Poids des airs: 4,8 Mo; total de la musique: 11,09 Mo (plafond 12 Mo). Spectrogrammes et formes d'onde examinés: sections visibles là où elles sont écrites, aucun écrêtage.

**Musique des fêtes** (règles de `musique.json`, placées avant celle du train du samedi, qui tombe le même jour que les fêtes):

| Événement | De jour (aube, matin, après-midi) | Le soir et la nuit |
|---|---|---|
| `fete-des-barrieres-fleuries` | `air-marche-de-la-halte` (la fanfare à la barrière) | `fete` (le bal) |
| `nuit-des-lumignons` | `air-carillon-des-deux-soeurs` (les cierges de Marthe, le parvis) | `air-sonnerie-de-5h12` (l'air de nuit demandé: une lumière pour ceux qui partent) |
| `concours-de-la-soupe` | `air-chanson-des-marmites` | `fete` (« tous premiers ») |
| `veillee-du-premier-train` | `air-sifflet-du-samedi` (le jour du train) | `air-sonnerie-de-5h12` (l'anniversaire de 5 h 12) |
| `premiere-veillee-du-quai`, `veillee-du-quai-<saison>` | `air-valse-de-la-minute` | `air-valse-de-la-minute` |
| `train-du-samedi` (hors fête) | `air-sifflet-du-samedi` (rythme normal, avec silences) | |

Rythme `long` pour les fêtes et veillées. Test: `tests/airs-aubrune.test.ts` (chaque fiche a son air, ses fichiers durent la boucle annoncée et se décodent; chaque fête et veillée désigne un air livré, de jour et le soir).

**Ce qui manque pour écouter depuis le carnet** (code, hors de ce lot): le bouton « Écouter » de la page d'une musique (`interface/carnet/collections.ts`, `canListen`) n'a ni touche ni action, et la régie (`MusicDirector`) n'a pas de méthode pour jouer un morceau précis. Il faudrait `listen(trackId)` (fondu vers le morceau, rythme `steady`, au-dessus des règles) et `stopListening()` à la fermeture du carnet, appelés avec l'identifiant de l'entrée; aucune donnée de plus n'est nécessaire. Les fiches gardent leur schéma strict (`CollectionEntrySchema`): le lien passe par l'identifiant, pas par un champ de fichier.

**Planche d'écoute**: `assets-src/son/ecoute/airs-aubrune.m4a` (86 s, un extrait de 10 s par air, instants dans `airs-aubrune.txt`), produite par `assets-src/son/musique/planche_airs.py` depuis les fichiers livrés. Copies M4A complètes (hors dépôt): `assets-src/son/musique/ecoute/`.
