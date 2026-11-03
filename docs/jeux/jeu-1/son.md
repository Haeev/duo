# La Petite Ligne: document sonore (démo d'une heure)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | première livraison, pour la démo (`docs/jeux/jeu-1/demo.md`, section 4.2) |
| Dernière mise à jour | 2026-11-03 (0.13: cloches, harmonium, forge, moulin, lavoir, puits, belvédère, chat, carnet et amitié, forêt, ferme, nef, café, motifs des quatorze habitants nouveaux) |
| Rédaction | sound-designer |
| Fichiers | sons: `games/la-petite-ligne/assets/son/` et leurs définitions `sons.json`; sources: `games/la-petite-ligne/assets-src/son/`; écoute pour le client: `design/son/la-petite-ligne/` |
| Documents liés | cahier des charges (sections 5.2, 6.3, 8), démo (sections 1 et 4.2), identité sonore de la plateforme (`design/son/plateforme/`) |

## 1. Intention

- **Couleur du jeu**: champêtre et acoustique. Guitare nylon, flûte, hautbois, clarinette, basson, accordéon, harpe, cordes en pizzicato; pour les effets, du bois, de la terre, de l'eau, du laiton et des clochettes. Rien de numérique, aucune tension, aucune voix.
- **Cohabitation avec Duo**: la plateforme parle en verre (célesta et harpe de verre, ré lydien). Le jeu parle en bois et en laiton, ce qui les distingue sans les opposer. L'écran titre est en ré majeur, comme le salon de Duo: le passage de la plateforme au jeu se fait en douceur.
- **Le motif de la Halte** (si, la, sol, ré, en balançant à 6/8) est le fil du jeu: thème du jour (matin et après-midi), écran titre, air de fin. Le sifflet du train sonne ré, sol, si: le même accord de sol majeur.
- **Tonalités**: tout ce qui tinte (clochettes de récolte, repères, notifications, motifs des habitants) est en sol majeur, la tonalité du jour, et reste juste sur les autres musiques (ré, do, fa majeur): un tintement ne détonne jamais.
- **Sans voix ni charabia** (cahier, 6.12): les habitants ont un motif instrumental; le « hop » du geste à deux est une appoggiature de marimba; le souffle de l'effort et le bâillement sont remplacés par la poutre qui craque et l'air du coucher.
- **Une longue soirée**: aigus adoucis, variations à chaque lecture, musique qui laisse régulièrement la place aux ambiances (section 3.2).

## 2. Musiques

Toutes à -18 LUFS intégrés dans le fichier (mesuré: -18,1), crêtes entre -3,2 et -7,9 dBTP, lues à -4 dB par le moteur (`volumeDb`) pour rester sous les effets. Boucles de durée entière en secondes, raccord vérifié (section 7).

| Moment | Fichier | Tonalité, mesure, tempo | Durée | Instruments | Boucle |
|---|---|---|---|---|---|
| Écran titre | `musique/titre.ogg` | ré majeur, 6/8, noire à 75 | 72 s (30 mesures) | flûte, cor, hautbois, piano, cordes, harpe | oui |
| Petit-déjeuner (6 h) | `musique/petit-dejeuner.ogg` | fa majeur, 4/4, 96 | 70 s (28) | basson qui sautille, clarinette qui répond, piano, pizzicati | oui |
| Dehors, 6 h à 13 h | `musique/halte-matin.ogg` | sol majeur, 6/8, 90 | 96 s (48) | flûte, hautbois, guitare, pizzicati, harpe, cordes | oui |
| Dehors, 13 h à 19 h | `musique/halte-apres-midi.ogg` | sol majeur, 6/8, 90 | 96 s (48) | clarinette, accordéon, violoncelle, guitare, contrebasse | oui |
| Dehors l'été, 13 h à 19 h (proposé, à la place de l'après-midi; tour 8) | `musique/halte-ete.ogg` | sol majeur, 6/8, 90 | 96 s (48) | violon, flûte, violoncelle, guitare, pizzicati, harpe | oui |
| Samedi, train à quai (10 h à 16 h) | `musique/samedi.ogg` | do majeur, 4/4, 120 | 80 s (40) | accordéon, clarinette, guitare, contrebasse, tambourin | oui |
| Veillée (dès 19 h, les deux dans la maison) | `musique/veillee.ogg` | ré majeur, 3/4, 72 | 100 s (40) | clarinette et flûte en duo, guitare seule, violoncelle | oui |
| Écran de nuit (les deux couchés) | `musique/nuit.ogg` | fa majeur, 3/4, 60 | 84 s (28) | harpe, célesta, flûte, cordes | oui |
| Le train s'arrête au quai | `musique/fanfare-train.ogg` | do majeur, 4/4, 112 | 13 s | trompette, cor, accordéon, tuba, glockenspiel | non, une fois |
| Le train du jour 8 est parti: récapitulatif, fin | `musique/fin.ogg` | sol majeur, 6/8, 84 | 44 s | flûte, clarinette, guitare, cordes, harpe, cor | non, une fois |
| Lanternes du quai allumées ensemble, apogée à t = 6,5 s (tour 9, P1) | `musique/halte-evening.ogg` | sol majeur, 6/8, 72 | 27,5 s plus la résonance | célesta, harpe, cordes lentes | non, une fois |

- **Matin et après-midi** partagent tempo, tonalité, grille et longueur: le motif de la Halte à la flûte le matin (plus clair, harpe et cordes), à la clarinette l'après-midi (plus chaud, accordéon et violoncelle). On passe de l'un à l'autre pendant un silence de repos (section 3.2), ou en fondu enchaîné à la même position de lecture.
- **L'été** (`halte-ete`, tour 8): même grille, tempo et longueur que le matin et l'après-midi, donc fondu enchaîné possible à la même position de lecture. Le violon chante le motif (A), la flûte prend le pont (B), le violoncelle la partie C; guitare, pizzicati et harpe gardent le balancement. Proposé l'après-midi en été (`plan.musicByMoment`), à brancher par le dev audio quand la saison sera dans l'état.
- **Veillée, pour deux**: la clarinette chante, la flûte répond, puis elles chantent ensemble en tierces; une seule guitare les accompagne. Les deux voix sont les deux joueurs.
- **Petit-déjeuner**: le basson pose la question en sautillant, la clarinette répond: tendre et un peu drôle.
- **Le soir des lanternes** (`halte-evening`, tour 9, P1): le motif de la Halte (partie A) au célesta, une octave au-dessus du jour, plus lent (72), sur une harpe qui arpège et des cordes lentes, puis une cadence douce (do/sol, sol). Le célesta est la voix de la nuit dans le jeu (nuit, vers luisants, étoiles). Lancé à 6,5 s de l'apogée, il subit la descente de l'apogée (-6 dB jusqu'à 2 s après la fin): c'est le « en douceur » de la fiche, sans réglage de plus.
- Les partitions sont versionnées en MIDI (`assets-src/son/midi/*.mid`) et rendues par FluidSynth avec la banque General MIDI FluidR3_GM (licence MIT, à inscrire dans `CREDITS.md`).

## 3. Règles de lecture

### 3.1 Bus et mixage

| Bus | Identifiant | Volume par défaut | Contenu |
|---|---|---|---|
| Musique | `music` | 0,8 | les onze musiques, et les motifs accordés des moments et des saisons (`star-chime-*`, `glow-shimmer`, `mist-lift`, `season-turn-*`) |
| Effets | `effects` | 1,0 | sons du monde, train, coq |
| Interface | `ui` | 0,9 | monnaie, tampon, notifications, carnet, propositions, airs courts, motifs des habitants |
| Ambiance | `ambience` | 0,9 | rivière, vent, oiseaux, grillons, bourg, pluie |

- Le SDK prévoit trois bus (ADR 0005); l'ambiance peut passer par un sous-bus des effets (`fallbackBus` dans `sons.json`), avec son propre réglage si le SDK en ajoute un quatrième.
- Limiteur sur le bus principal (seuil -3 dB), comme la plateforme.
- **Musique atténuée** sous les sons importants (`duckMusicDb`, attaque 80 ms, retour 900 ms): -9 dB sous le sifflet du train, -8 dB sous un motif d'habitant, -6 dB sous un repère, une proposition d'achat, un air du carnet.
- **Priorités** (cahier, section 8): 1 train, repère, proposition d'achat; 2 récoltes, airs, motifs, gestes à deux; 3 outils et pas; 4 ambiances et sons d'interface très fréquents. Au-delà de 24 voix d'effets, on coupe d'abord les priorités 4 puis 3, jamais 1.
- **Variations**: chaque son fréquent a 2 à 4 variantes tirées sans répétition immédiate (`pick: shuffle-no-repeat`), plus une variation de hauteur (`pitchVariation`, appliquée par `playbackRate`, de 2 à 8 %) et de niveau (`gainVariationDb`). Les tintements accordés (clochettes, airs) n'ont pas de variation de hauteur, pour rester justes.
- **Les sons de l'autre joueur** sont placés à sa position (`PannerNode`) et joués 3 dB plus bas que les siens: on les entend sans les confondre. Ses sons d'interface ne s'entendent pas chez soi, sauf le repère (`ping-peer`, plus grave et en trois notes: on sait sans regarder qui a fait signe) et la proposition d'achat.

### 3.2 Repos de la musique

Contre la lassitude sur une longue séance (le cahier vise des journées de 16,6 minutes; la démo, 4,7 minutes dehors), la musique du jour joue une boucle complète, puis laisse place aux ambiances 40 à 80 s (tirage), puis revient en fondu de 2,5 s. Le petit-déjeuner, la veillée et la nuit jouent sans repos (scènes courtes). Réglages: `plan.rest` dans `sons.json`.

### 3.3 Quelle musique, quelle ambiance, à quel moment

`plan.musicByMoment` et `plan.ambienceByTime` dans `sons.json`:

- Oiseaux du matin de 6 h à 12 h, à -6 dB l'après-midi, jamais sous la pluie ni après 19 h; grillons dès 19 h; bourg de 8 h à 19 h; vent et rivière toujours (le vent à -3 dB); pluie le jour 4 (dehors `rain`, dans la maisonnette `rain-roof`).
- Rivière: plusieurs sources placées le long du bord sud (une tous les 15 m, chacune avec son propre décalage de départ), entendues jusqu'à la maisonnette, plus fortes au gué.
- Dans la maisonnette: les ambiances du dehors passent derrière un passe-bas à 900 Hz et à -10 dB (rampe de 600 ms).
- Saisons et brume du matin (tour 8): règles dans `plan.ambienceByTime` (`seasons`: seulement ces saisons; `exceptSeasons`: pas pendant celles-ci) et `plan.morningMist`, lues par le moteur selon la saison du jour et `world.morningMist` (l'ancienne clé `plan.ambienceBySeason` est retirée). Section 4.6.

### 3.4 Le train, battement de cœur du jeu

Le sifflet s'entend dans toute la vallée (TE-05). Deux versions: `train-whistle`, placé sur la locomotive quand le joueur est à moins de 40 m du quai (jamais sous -14 dB); `train-whistle-far`, non placé, avec l'écho des coteaux, partout ailleurs. Séquences dans `plan.sequences`:

| Arrivée (la locomotive est au quai à 14 s) | Départ de 16 h |
|---|---|
| 0 s sifflet, 0,4 s approche (14 s), 11 s cloche du quai, 14 s freinage, 18,3 s jet de vapeur, 18,6 s fanfare, 19 s locomotive à l'arrêt (boucle jusqu'au départ), 32 s musique du samedi | 0 s cloche du quai, 2,2 s sifflet à roulette de Firmin, 3,8 s sifflet du train, 4,6 s fin de la boucle d'attente et départ (16 s, le train s'éloigne), 6 s la musique du samedi s'efface en 4 s |

Pour que le train soit au quai à 10 h pile, la séquence d'arrivée démarre 14 s de temps réel avant (soit 40 minutes de jeu à 0,35 s la minute).

## 4. Effets, événement par événement

Niveau: sonie momentanée maximale visée en LUFS (intégrée pour une boucle), mesurée dans `assets-src/son/controles/mesures.csv`. Écoute: modèle « inverse » du `PannerNode` (distance de référence, facteur 0,5 à 1,3 selon le son); « coupé au-delà » veut dire qu'on ne lance pas le son, « jamais sous » qu'on garantit un niveau plancher où que soit la source. Les sons de pêche joués au bouchon ont une distance de référence de 6 m (la portée du lancer): la touche, signal qu'il faut ferrer, s'entend nettement chez le pêcheur.

**Pêche, noms attendus par le code** (événements de la simulation): `cast` joue `fishing-cast` au pêcheur, puis `fishing-splash` au bouchon (`event.at`) 0,55 s plus tard; `bite` joue `fishing-bite` au bouchon; `caught` joue `fishing-catch` au bouchon (il remplace `harvest` et `quality-fine`); `escaped` joue `fishing-escape` au bouchon.

### 4.1 Train

| Événement | Son | Niveau | Priorité | Variations | Bus | Écoute | Atténue la musique |
|---|---|---|---|---|---|---|---|
| Sifflet du train, de près (samedi 10 h et 16 h) | `train-whistle` | -14 | 1 | aucune | effets | placé, réf. 15 m, jamais sous -14 dB | -9 dB |
| Sifflet du train, de loin (partout ailleurs dans le bourg et au-delà) | `train-whistle-far` | -19 | 1 | aucune | effets | non placé | -6 dB |
| Le train approche (14 s, de loin jusqu'à l'entrée en gare) | `train-approach` | -17 | 1 | aucune | effets | placé, réf. 15 m, jamais sous -14 dB | -4 dB |
| Freinage et arrêt (6 s) | `train-brake` | -19 | 1 | aucune | effets | placé, réf. 15 m, jamais sous -14 dB | -4 dB |
| Grand jet de vapeur à l'arrêt | `train-steam` | -19 | 1 | hauteur ±3 %, niveau ±0,5 dB | effets | placé, réf. 15 m, jamais sous -14 dB | -4 dB |
| Locomotive à l'arrêt, de 10 h à 16 h (boucle) | `train-idle-loop` (boucle) | -30 LUFS int. | 3 | aucune | effets | placé, réf. 8 m, coupé au-delà de 160 m |  |
| Départ du train (16 s, s'éloigne) | `train-depart` | -17 | 1 | aucune | effets | placé, réf. 15 m, jamais sous -14 dB | -4 dB |
| Cloche du quai (trois coups, arrivée et départ) | `station-bell` | -17 | 1 | aucune | effets | placé, réf. 8 m, coupé au-delà de 160 m | -4 dB |
| Sifflet à roulette de Firmin avant le départ | `guard-whistle` | -21 | 2 | hauteur ±2 % | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |

### 4.2 Monde (effets placés)

| Événement | Son | Niveau | Priorité | Variations | Bus | Écoute | Atténue la musique |
|---|---|---|---|---|---|---|---|
| Pas sur l'herbe | `step-grass` | -29 | 3 | 4 variantes, hauteur ±6 %, niveau ±1,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Pas sur la terre et le chemin | `step-path` | -28,5 | 3 | 4 variantes, hauteur ±6 %, niveau ±1,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Pas sur le bois (quai, plancher) | `step-wood` | -27,5 | 3 | 4 variantes, hauteur ±5 %, niveau ±1,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Pas sur la pierre (place, puits) | `step-stone` | -28,5 | 3 | 4 variantes, hauteur ±5 %, niveau ±1,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Bêcher une case | `hoe` | -23 | 3 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Semer | `sow` | -26 | 3 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Arroser une case | `water` | -25 | 3 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Arrosoir vide | `water-empty` | -24 | 2 | hauteur ±3 %, niveau ±0,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Remplir l'arrosoir au puits ou au tonneau | `water-fill` | -24 | 3 | 2 variantes, hauteur ±3 %, niveau ±0,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Récolter (« pop ») | `harvest` | -21 | 2 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Récolte de qualité « belle » (un tintement, joué avec le « pop ») | `quality-fine` | -21 | 2 | aucune | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Récolte de qualité « superbe » (deux tintements) | `quality-superb` | -19,5 | 2 | aucune | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Coup de hache | `axe-chop` | -21,5 | 3 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| L'arbre craque avant de tomber | `tree-crack` | -21 | 2 | hauteur ±3 %, niveau ±0,5 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Chute de l'arbre | `tree-fall` | -18 | 2 | hauteur ±4 %, niveau ±0,5 dB | effets | placé, réf. 8 m, coupé au-delà de 160 m |  |
| Scier à l'établi (boucle tant que l'action dure) | `saw-loop` (boucle) | -25 LUFS int. | 3 | hauteur ±2 % | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Planches sciées qui tombent sur l'établi | `saw-end` | -22 | 3 | hauteur ±4 %, niveau ±0,5 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Coup de marteau sur un élément fantôme | `hammer` | -22 | 3 | 3 variantes, hauteur ±6 %, niveau ±1,5 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Élément terminé (« tchonk ») | `build-done` | -19 | 2 | hauteur ±4 %, niveau ±0,5 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Poser un meuble | `furniture-place` | -22 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Tourner un meuble dans le plan | `furniture-rotate` | -27 | 3 | hauteur ±8 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Ramasser un objet (il saute au sac) | `pickup` | -24 | 3 | 3 variantes, hauteur ±6 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Ranger au sac, donner à l'autre | `bag` | -26 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Ouvrir la porte (elle grince) | `door-open` | -22 | 3 | 2 variantes, hauteur ±3 %, niveau ±1 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Fermer la porte | `door-close` | -21 | 3 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| Ouvrir le coffre | `chest-open` | -23 | 3 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Fermer le coffre | `chest-close` | -22 | 3 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Déposer un produit dans la caisse de la coopérative | `crate-deposit` | -23 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Faire signe (G): ton repère | `ping-self` | -16 | 1 | aucune | effets | placé, réf. 6 m, jamais sous -10 dB | -6 dB |
| Repère posé par l'autre joueur | `ping-peer` | -16 | 1 | aucune | effets | placé, réf. 6 m, jamais sous -10 dB | -6 dB |
| Geste à deux: on soulève ensemble (« hop ») | `duo-hop` | -20 | 2 | hauteur ±2 %, niveau ±0,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Geste à deux: la poutre portée (boucle) | `duo-carry-loop` (boucle) | -28 LUFS int. | 3 | aucune | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Allumer le réchaud | `stove-light` | -23 | 3 | hauteur ±4 %, niveau ±0,5 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Le réchaud qui mijote (boucle) | `stove-loop` (boucle) | -30 LUFS int. | 4 | aucune | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Manger (« croque ») | `eat` | -24 | 3 | 2 variantes, hauteur ±6 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Pêche: lancer la ligne (événement cast) | `fishing-cast` | -24 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Pêche: le bouchon se pose sur l'eau (« plouf ») | `fishing-splash` | -23 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 6 m, coupé au-delà de 40 m |  |
| Pêche: touche, le bouchon plonge (« ploc », événement bite) | `fishing-bite` | -21 | 2 | 3 variantes, hauteur ±3 %, niveau ±0,5 dB | effets | placé, réf. 6 m, coupé au-delà de 40 m |  |
| Pêche: le poisson sort de l'eau (éclaboussure, frétillement; événement caught) | `fishing-catch` | -20 | 2 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 6 m, coupé au-delà de 40 m |  |
| Pêche: le poisson s'échappe (« flop », événement escaped) | `fishing-escape` | -25 | 3 | hauteur ±4 %, niveau ±0,5 dB | effets | placé, réf. 6 m, coupé au-delà de 40 m |  |
| Gloussements des poules | `hen` | -24 | 3 | 3 variantes, hauteur ±8 %, niveau ±2 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |
| S'asseoir sur un banc de bois (événement `sat_down`) | `bench-sit` | -26 | 3 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Le coq du bourg, au réveil | `wake-rooster` | -22 | 3 | hauteur ±3 % | effets | non placé |  |

### 4.3 Interface et airs courts

Les menus du jeu ont leur propre famille, « papier et bois » (le carnet, le crayon, la table de la maisonnette), distincte du verre de la plateforme: tic de crayon pour le focus (`ui-focus`, le plus discret, -31 LUFS), ongle sur le papier pour la réplique suivante (`ui-next`), coin de page pour l'onglet (`ui-tab`), « tok » de bois rond pour valider (`ui-confirm`), feuille qui glisse et « tok » plus mat pour revenir (`ui-back`), feuille qu'on déplie ou replie pour un panneau (`ui-panel-open`, `ui-panel-close`). Le refus (`ui-refusal`) est un double « toc-toc » feutré à la même hauteur, sans mélodie: rien de punitif, et rien de commun avec le carillon de marimba qui monte (`notify`, réservé aux bonnes nouvelles) ni avec l'erreur de Duo (coups de feutre qui descendent). Mesuré: centroïde spectral vers 410 Hz contre 1 050 Hz pour `notify`, deux coups brefs contre un arpège de 280 ms, 88 à 93 % de l'énergie au-dessus de 300 Hz pour rester audible sur des haut-parleurs de portable.

| Événement | Son | Niveau | Priorité | Variations | Bus | Écoute | Atténue la musique |
|---|---|---|---|---|---|---|---|
| Interface du jeu: le focus se déplace (Tab, flèches) | `ui-focus` | -31 | 4 | 3 variantes, hauteur ±3 %, niveau ±1,5 dB | interface | non placé |  |
| Interface du jeu: réplique suivante (Espace, « Suite ») | `ui-next` | -28 | 4 | 3 variantes, hauteur ±4 %, niveau ±1 dB | interface | non placé |  |
| Interface du jeu: changer d'onglet (carnet, panneaux, A et E) | `ui-tab` | -26 | 3 | 3 variantes, hauteur ±5 %, niveau ±1 dB | interface | non placé |  |
| Interface du jeu: valider (Entrée, Espace, clic sur un bouton) | `ui-confirm` | -23 | 3 | 3 variantes, hauteur ±2 %, niveau ±1 dB | interface | non placé |  |
| Interface du jeu: revenir ou fermer (Retour arrière, « Fermer ») | `ui-back` | -24 | 3 | 2 variantes, hauteur ±2 %, niveau ±1 dB | interface | non placé |  |
| Interface du jeu: un panneau s'ouvre (caisse, comptoir, catalogue, coffre, plan) | `ui-panel-open` | -25 | 3 | 2 variantes, hauteur ±3 %, niveau ±1 dB | interface | non placé |  |
| Interface du jeu: un panneau se ferme | `ui-panel-close` | -26 | 3 | 2 variantes, hauteur ±3 %, niveau ±1 dB | interface | non placé |  |
| Refus doux: action impossible, bouton désactivé, pose refusée, notification d'erreur | `ui-refusal` | -24 | 2 | 2 variantes, hauteur ±2 %, niveau ±1 dB | interface | non placé |  |
| Coup de tampon: une ligne de la commande se coche | `order-stamp` | -22,5 | 2 | 3 variantes, hauteur ±3 %, niveau ±0,5 dB | interface | non placé |  |
| Monnaie (vendre, acheter, paiement de la coopérative) | `coins` | -21 | 2 | 3 variantes, hauteur ±4 %, niveau ±1 dB | interface | non placé |  |
| Notification douce (ligne de notifications du HUD) | `notify` | -21 | 2 | 2 variantes, niveau ±1 dB | interface | non placé | -3 dB |
| Ouvrir le carnet, tourner une page | `journal-open` | -25 | 3 | 2 variantes, hauteur ±5 %, niveau ±1 dB | interface | non placé |  |
| Proposition de gros achat (chez celui qui doit répondre) | `purchase-proposal` | -17 | 1 | aucune | interface | non placé | -6 dB |
| Gros achat accepté (tampon « D'accord ») | `purchase-accept` | -19 | 2 | aucune | interface | non placé |  |
| Gros achat refusé (la carte se replie) | `purchase-decline` | -24 | 2 | aucune | interface | non placé |  |
| Clic sur le sol (repère de destination) | `ui-click` | -28 | 4 | 2 variantes, hauteur ±5 %, niveau ±1 dB | interface | non placé |  |
| Changer d'outil | `tool-switch` | -27 | 4 | 2 variantes, hauteur ±6 %, niveau ±1 dB | interface | non placé |  |
| Nouvelle page du carnet, nouvelle quête, quête réussie (court air) | `journal-new` | -18 | 2 | 3 variantes | interface | non placé | -6 dB |
| Geste à deux réussi (petit air « à deux ») | `duo-done` | -18,5 | 2 | aucune | interface | non placé | -6 dB |
| Se coucher (endormissement) | `sleep` | -21 | 3 | aucune | interface | non placé | -10 dB |
| Réveil (air du matin, avant le petit-déjeuner) | `wake` | -20 | 3 | aucune | interface | non placé |  |

### 4.4 Ambiances (boucles mono)

| Événement | Son | Durée de boucle | Sonie intégrée | Bus |
|---|---|---|---|---|
| Rivière Aubrune (le long du bord sud) | `river` | 24 s | -26 LUFS | ambiance |
| Vent léger dans les arbres | `wind` | 24 s | -30 LUFS | ambiance |
| Oiseaux du matin (6 h à 12 h, plus rares l'après-midi) | `birds-morning` | 36 s | -28 LUFS | ambiance |
| Grillons du soir (dès 19 h, et la nuit) | `crickets` | 20 s | -31 LUFS | ambiance |
| Petit bruit du bourg (8 h à 19 h) | `village` | 40 s | -32 LUFS | ambiance |
| Pluie dehors (jour 4) | `rain` | 16 s | -27 LUFS | ambiance |
| Pluie sur le toit, à l'intérieur de la maisonnette | `rain-roof` | 16 s | -29 LUFS | ambiance |
| Matin de brume (tour 8) | `mist-morning` | 24 s | -31 LUFS | ambiance |
| Grillons d'un soir d'été (tour 8) | `crickets-summer` | 20 s | -30 LUFS | ambiance |
| Martinets du jour d'été (tour 8) | `swifts` | 30 s | -36 LUFS | ambiance |
| Vent d'automne dans les feuilles sèches (tour 8) | `wind-leaves` | 24 s | -30 LUFS | ambiance |
| Corneilles au loin, jour d'automne (tour 8) | `crows` | 40 s | -34 LUFS | ambiance |

### 4.5 Moments rares (tours 6 et 7)

Sons des fiches de `docs/jeux/jeu-1/tour-06-conception.md` et `tour-07-conception.md` (section 1.4), dans `assets/son/moments/`. Ce dossier n'est pas décodé au lancement (`residentFolders` de `src/audio/reglages.ts`): 22 Mo décodés pour l'ensemble des neuf moments (float32 à 48 kHz), à charger quand le moment du jour passe en `waiting` (au plus un moment par jour, donc 0,4 Mo pour le martin-pêcheur à 6,7 Mo pour les oies ou la brume). Les instants de l'apogée suivent `donnees/moments.json` (relus au tour 7: héron, oies, échelle et mésanges recalés). Chaque entrée de `sons.json` porte `moment` (identifiant du moment) et `momentSound` (nom de la fiche). « Audible à N m » dans une fiche devient « coupé au-delà de N m », avec un gain d'environ -17 dB au bord: le son n'apparaît ni ne disparaît d'un coup.

| Moment | Fiche | Son | Quand | Niveau | Priorité | Variations | Bus | Écoute |
|---|---|---|---|---|---|---|---|---|
| héron | `heron_wade` | `heron-wade` | attente, toutes les 6 à 12 s | -29 | 3 | 3 variantes, hauteur ±6 %, niveau ±1,5 dB, 2 s au moins entre deux | effets | réf. 2,5 m, coupé au-delà de 15 m |
| héron | `heron_strike` | `heron-strike` | clip `heron_strike` | -26 | 3 | 2 variantes, hauteur ±5 % | effets | coupé au-delà de 15 m |
| héron | `heron_croak` | `heron-croak` | apogée, t = 3,8 s | -21 | 2 | 2 variantes, hauteur ±3 % | effets | réf. 4 m, coupé au-delà de 25 m |
| héron | `heron_wings` | `heron-wings` | apogée, t = 2,6 s; départ sans apogée, t = 0 | -22 | 2 | hauteur ±4 % | effets | réf. 3 m, coupé au-delà de 20 m |
| héron | `heron_land` | `heron-land` | apogée, t = 6,6 s, à `heron_rest_far` | -24 | 2 | hauteur ±4 % | effets | coupé au-delà de 20 m |
| oies | `geese_rest` | `geese-rest` (boucle de 6 s) | attente, placé à `geese_rest` | -30 LUFS int. | 3 | aucune | ambiance | réf. 3 m, coupé au-delà de 20 m |
| oies | `geese_alarm` | `geese-alarm` | apogée et départ sans apogée, t = 0 | -21 | 2 | hauteur ±3 % | effets | réf. 3 m, coupé au-delà de 45 m |
| oies | `geese_takeoff` | `geese-takeoff` | apogée, t = 2,8 s; départ sans apogée, t = 1 s | -19,5 | 2 | hauteur ±3 % | effets | coupé au-delà de 45 m |
| oies | `geese_flight` | `geese-flight` | apogée, t = 5,8 s; départ sans apogée, t = 3 s | -21 | 2 | 3 variantes, hauteur ±2 % | effets | placé à l'oie de tête et déplacé avec elle, réf. 8 m, coupé au-delà de 160 m |
| échelle | `ladder_lean` | `ladder-lean` | début de `basile_lost`, si un joueur est à moins de 15 m | -23 | 3 | hauteur ±4 % | effets | coupé au-delà de 15 m |
| échelle | `ladder_grip` | `ladder-grip` | on prend une place | -27 | 3 | 3 variantes, hauteur ±5 % | effets | réf. 2 m, coupé au-delà de 28 m |
| échelle | `ladder_step` | `ladder-step` | chaque barreau de Basile: apogée, 0,5, 1,1, 1,7 puis 4,9, 5,73, 6,57 s | -27 | 2 | 4 variantes, hauteur ±5 %, niveau ±1,5 dB | effets | coupé au-delà de 28 m |
| échelle | `nest_box_turn` | `nest-box-turn` | apogée, t = 2,3 s | -26 | 2 | hauteur ±3 % | effets | coupé au-delà de 28 m |
| échelle | `hammer_tap` | `hammer-tap` | apogée, 3,35, 3,95 et 4,55 s | -25 | 2 | 3 variantes, hauteur ±4 % | effets | réf. 3 m, coupé au-delà de 45 m |
| échelle | `tit_call` | `tit-call` | apogée, t = 7,8 s | -26 | 2 | 3 variantes, hauteur ±3 % | effets | réf. 2 m, coupé au-delà de 12 m |
| mésanges | `tit_song` | `tit-song` | attente toutes les 8 s; apogée, t = 1,9 s | -25 | 3 | 3 variantes, hauteur ±3 % | effets | coupé au-delà de 12 m |
| mésanges | `tit_wings` | `tit-wings` | envol et posé; apogée, t = 4,3 s | -31 | 4 | 2 variantes, hauteur ±8 % | effets | coupé au-delà de 12 m |
| renard | `fox_pounce` | `fox-pounce` | clip `fox_pounce` (attente) | -27 | 3 | 2 variantes, hauteur ±5 % | effets | coupé au-delà de 12 m |
| renard | `fox_bark` | `fox-bark` | apogée, t = 1,0 s | -21 | 2 | 2 variantes, hauteur ±3 % | effets | réf. 4 m, coupé au-delà de 25 m |
| renard | `hens_alarm` | `hens-alarm` | apogée, t = 1,2 s, au poulailler, si les poules y sont | -23 | 3 | hauteur ±4 % | effets | réf. 3 m, coupé au-delà de 45 m |
| vers luisants | `crickets_night` | `crickets-night` (boucle de 8 s) | placé à `meadow_glow`; attente à -6 dB, pleine force en 4 s à l'apogée (`waitingDb`, `climaxRampMs`) | -29 LUFS int. | 3 | aucune | ambiance | coupé au-delà de 20 m |
| vers luisants | `glow_shimmer` | `glow-shimmer` | apogée, t = 0,5 s | -22 | 2 | 2 variantes, aucune variation de hauteur (sol pentatonique) | musique | non placé |
| chevrette | `roe_call` | `roe-call` | apogée, t = 0 | -26 | 2 | 2 variantes, hauteur ±3 % | effets | réf. 2,5 m, coupé au-delà de 15 m |
| chevrette | `fawn_rustle` | `fawn-rustle` | apogée, t = 1,0 s, au lit du faon | -29 | 2 | hauteur ±4 % | effets | réf. 2 m, coupé au-delà de 12 m |
| chevrette | `fawn_bleat` | `fawn-bleat` | apogée, t = 2,6 s, au faon | -25 | 2 | 2 variantes, hauteur ±3 % | effets | coupé au-delà de 12 m |
| chevrette | `deer_stamp` | `deer-stamp` | effarouchée: clip `deer_stamp` | -24 | 2 | hauteur ±5 %, 1,5 s au moins entre deux | effets | réf. 3 m, coupé au-delà de 20 m |
| chevrette | `roe_bark` | `roe-bark` | effarouchée, juste après `deer_stamp` | -21 | 2 | 2 variantes, hauteur ±3 %, 1,5 s au moins entre deux | effets | réf. 4 m, coupé au-delà de 30 m (`faune-30`): prévient l'autre joueur |
| chevrette | `deer_bounds` | `deer-bounds` | apogée, t = 7,6 s | -25 | 2 | hauteur ±3 % | effets | placé à la chevrette et déplacé avec elle, coupé au-delà de 20 m |
| martin-pêcheur | `kf_whistle` | `kf-whistle` | chaque envol (attente); apogée, t = 4,1 s | -25 | 3 | 3 variantes (la troisième en deux notes), hauteur ±3 %, 0,8 s au moins entre deux | effets | réf. 4 m, coupé au-delà de 25 m |
| martin-pêcheur | `kf_dive` | `kf-dive` | plongeons manqués (attente); apogée, t = 1,3 s | -24 | 2 | 2 variantes, hauteur ±4 % | effets | coupé au-delà de 20 m |
| martin-pêcheur | `kf_beat` | `kf-beat` | apogée, **un seul déclenchement** à 2,7 s (le fichier contient les deux coups, 2,7 et 3,2 s) | -26 | 2 | hauteur ±3 % | effets | réf. 2,5 m, coupé au-delà de 15 m |
| brume | `mist_ambience` | `mist-ambience` (boucle de 8 s) | placé à `mist_narrows`; attente à -6 dB, pleine force en 3 s au début de l'apogée (`waitingDb`, `climaxRampMs`) | -29 LUFS int. | 3 | aucune | ambiance | réf. 3 m, coupé au-delà de 20 m |
| brume | `mist_lift` | `mist-lift` | apogée, t = 1,5 s | -22 | 2 | 2 variantes (sol majeur, do majeur), aucune variation de hauteur | musique | non placé, stéréo |
| brume | `blackbird_wake` | `blackbird-wake` | apogée, t = 3,0 s | -26 | 2 | 3 phrases, hauteur ±2 % | effets | non localisé (fiche) |
| brume | `fish_jump` | `fish-jump` | apogée, t = 5,2 s, en (29,0 ; 40,4) | -25 | 2 | 2 variantes, hauteur ±4 % | effets | coupé au-delà de 20 m |

- **Descente de la musique pendant l'apogée** (fiche 1.2, `moments.musicDuckDb`): -6 dB en 0,5 s au début, retour en 2 s après la fin, chez les deux. Elle se règle dans le moteur, pas dans `sons.json` (aucun son des moments n'a de `duckMusicDb`, pour ne pas cumuler deux atténuations).
- **`glow-shimmer` et `mist-lift` sur le bus musique** (question S3, réglée au tour 9): ils suivent le réglage Musique du joueur et passent après la descente de l'apogée, qui ne les baisse donc pas. `mist-lift` est rendu par FluidSynth (harpe et cordes lentes, partitions `assets-src/son/midi/mist-lift-1.mid` et `-2.mid`), accords sans seconde mineure, septième majeure ni triton: juste sous la musique du matin en sol majeur.
- **`kf-beat` ne se joue qu'une fois**: le « tac tac » entier est dans le fichier; le déclencher aussi à 3,2 s donnerait quatre coups.
- **`deer-stamp` puis `roe-bark`**: le coup de sabot et l'aboiement disent tous deux « elle t'a vu bouger »; l'aboiement porte à 30 m pour que l'autre joueur, plus loin, l'entende aussi.
- **Se distinguer par la mesure**: `fawn-bleat` (centroïde 1,3 à 1,4 kHz) est deux fois plus haut que `roe-call` (0,6 à 0,7 kHz); `fish-jump` est en deux temps (sortie, puis rentrée vers 700 Hz) quand `kf-dive` n'en a qu'un (1 à 1,1 kHz, gerbe fine) et que le bouchon de la pêche reste vers 500 Hz; `deer-stamp` et `deer-bounds` gardent moins de 25 % de leur énergie sous 300 Hz (haut-parleurs de portable).
- **Ne pas confondre**: `crickets-night` (grillons champêtres du pré, placé, net) n'est pas l'ambiance générale `crickets` (non placée, lointaine). Le premier s'ajoute au second pendant le moment.
- **Les cris** suivent l'espèce sans imiter d'enregistrement: héron « kraak » grave et rauque (fondamentale vers 300 Hz qui retombe, voix rugueuse), oies nasales (330 à 495 Hz, neuf hauteurs distinctes dans la volée), mésange bleue fine (notes vers 6 kHz, trille vers 4 kHz), renard en deux jappements brefs, chevrette en « pi-é » nasal (vers 500 Hz) et aboiement rauque « bö » (vers 350 Hz), faon en « mi » vers 1 kHz, martin-pêcheur en sifflet droit vers 4,2 kHz, merle en phrase flûtée de 1,6 à 2,7 kHz suivie d'un gazouillis aigu et doux (trois phrases écrites). Tout est filtré au-dessus de 4 à 8 kHz et plus bas que les actions du joueur.

### 4.6 Saisons, brume du matin, cueillette (tour 8)

Sons de `docs/jeux/jeu-1/tour-08-conception.md` (sections 2.2, 2.6, 3.4, 5.1, 5.2 et 9), source `assets-src/son/saisons.py`. Déclencheurs branchés au tour 8 (seconde vague): `season_started`, `world.morningMist`, `picked_up` selon l'objet, `chop_refused` (`src/audio/declencheurs.ts` et `ambiances.ts`).

| Événement | Son | Niveau | Priorité | Variations | Bus | Écoute | Atténue la musique |
|---|---|---|---|---|---|---|---|
| Premier jour d'une saison, au petit-déjeuner, sous la carte de saison (chez les deux) | `season-turn-spring`, `-summer`, `-autumn`, `-winter` (`saisons/`) | -20 | 2 | aucune: un fichier par saison, choisi par la saison du jour (`plan.seasonTurn`) | musique | non placé, stéréo | -6 dB |
| Cueillir de l'ail des ours ou des pissenlits | `pick-herb` | -24 | 2 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Cueillir des girolles | `pick-mushroom` | -24 | 2 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Cueillir des mûres (froissement du roncier) | `pick-berries` | -24 | 2 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Ramasser des noisettes | `pick-nuts` | -24 | 2 | 3 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Hache sur une souche ou un rejet (`stump_hint`, `tree_too_young`) | `axe-thud-soft` | -25 | 2 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 3 m, coupé au-delà de 45 m |  |

- **Le tournant de saison**: quatre couleurs, toutes en fa pentatonique (fa, sol, la, do, ré), justes sur la musique du petit-déjeuner (fa majeur) et sans aucune paire de notes dure (contrôle bloquant dans `saisons.py`). Printemps: la flûte monte sur un accord roulé de harpe. Été: la guitare s'étale sur un accord de sixte, le hautbois balance et s'attarde sur le la, une pointe de glockenspiel. Automne: la clarinette descend, le violoncelle pose ré puis fa, le cor tient le la. Hiver: quatre notes de célesta espacées sur une nappe de cordes lentes. Trois secondes de motif, 4,3 à 4,5 s avec la résonance. Partitions dans `assets-src/son/midi/season-turn-*.mid`, rendu FluidSynth. Dossier `saisons/` non résident (6,8 Mo décodés pour les quatre, 1,7 Mo pour un seul): décoder la veille du premier jour de saison, ou au début du petit-déjeuner.
- **La cueillette** remplace `pickup` pour ces objets (un son par sorte, demande de la section 9). Elles se distinguent par la mesure: herbes centroïde 1,7 à 1,8 kHz (une cassure de tige et des feuilles), girolles 0,6 à 0,7 kHz (couinement puis « pop » rond), mûres 2,1 à 2,6 kHz (froissement et épines, deux ou trois « plic »), noisettes 2,8 à 3,0 kHz (trois à cinq « toc » secs). `pickup` est à 1,9 à 2,1 kHz mais ne dure que 0,11 s et n'a qu'un temps. Aucune n'a d'énergie notable sous 300 Hz.
- **La hache refusée** est le refus lui-même: le jouer seul, sans `ui-refusal`. Elle se distingue de `axe-chop` par l'absence de fer qui sonne et de copeaux, une durée utile plus courte (0,22 à 0,24 s contre 0,29 à 0,37 s), 3,5 dB de moins, et le frémissement des feuilles du rejet à la fin; 34 à 43 % de l'énergie sous 300 Hz (contre 49 à 67 % pour `axe-chop`), pour rester audible sur un portable.

Ambiances (boucles mono, non placées, bus ambiance, dossier `ambiance/`), règles dans `plan.ambienceByTime` et `plan.morningMist`:

| Ambiance | Quand | Remplace | Niveau |
|---|---|---|---|
| `mist-morning` | matins où `world.morningMist` est vrai: dès le lever, fondu de sortie de 9 h à 10 h 30 (comme la nappe visible) | rien; oiseaux du matin -4 dB et bourg -3 dB tant qu'elle dure | 0 dB |
| `crickets-summer` | été, dès 19 h et la nuit, pas sous la pluie | `crickets` | 0 dB |
| `swifts` | été, de 7 h à 21 h, pas sous la pluie | rien | 0 dB |
| `wind-leaves` | automne, toujours | `wind` | -3 dB, comme le vent |
| `crows` | automne, de 7 h à 18 h, pas sous la pluie | rien | 0 dB |
| `birds-morning` | automne, de 6 h à 12 h | la règle de 6 h à 12 h | -6 dB (moins d'oiseaux chanteurs) |
| `crickets` | hiver | (se tait) |  |

- **`mist-morning` n'est pas `mist-ambience`**: la première couvre toute la carte (air presque immobile, centroïde 0,29 kHz, gouttes des feuilles, une goutte ronde dans une flaque de temps en temps, un merle très lointain deux fois par tour de 24 s, phrases différentes de `blackbird-wake`); la seconde est l'eau toute proche du moment de la brume, placée à `mist_narrows` (centroïde 0,68 kHz). Un matin de brume après la pluie, les deux s'entendent ensemble près du rétrécissement. Sur des haut-parleurs de portable, `mist-morning` se réduit volontairement aux gouttes et au merle: c'est le feutré du matin.
- **Été**: `crickets-summer` ajoute au chœur des grillons champêtres le trille continu du grillon d'Italie vers 2,7 kHz, qui signe l'été (centroïde 3,97 kHz contre 4,48 kHz pour `crickets`). `swifts`: cinq passages de bandes de martinets par tour de 30 s, cris coupés au-dessus de 6,5 kHz, à -28 LUFS de sonie momentanée maximale (ffmpeg), sous les oiseaux du matin (-24).
- **Automne**: `wind-leaves` garde un vent qui ne tombe jamais tout à fait, avec le crépitement sec des feuilles dans les rafales et des feuilles qui roulent sur le chemin trois fois par tour (centroïde 1,05 kHz contre 0,84 kHz pour `wind`). `crows`: des corneilles sur l'autre rive, quatre séries de deux à quatre « kraa » (fondamentale vers 500 Hz, formants vers 1,1 et 1,7 kHz: plus haut et plus bref que le héron), le reste du tour en silence.

### 4.7 Moments de l'été et de l'automne, chantiers, catalogue (tour 9)

Sons de `docs/jeux/jeu-1/tour-09-conception.md` (sections 2, 4, 7 et 9; fiches 1.4.10 et 1.4.12 du tour 7), sources `assets-src/son/moments_tour9.py` et `bourg.py`. Aucun déclencheur n'existe encore pour ces moments ni pour les chantiers: les sons sont déclarés dans `sons.json`, le dev gameplay et le dev audio les branchent (noms de la fiche dans `momentSound`).

| Moment | Fiche | Son | Quand | Niveau | Priorité | Variations | Bus | Écoute |
|---|---|---|---|---|---|---|---|---|
| étoiles | `star_chime` (note 1) | `star-chime-1` | apogée, t = 0,0 s: sol 5 | -24 | 2 | aucune variation de hauteur | musique | non placé, stéréo |
| étoiles | `star_chime` (note 2) | `star-chime-2` | t = 2,4 s: mi 6 | -24 | 2 | idem | musique | non placé |
| étoiles | `star_chime` (accord) | `star-chime-3` | t = 4,5 s, la grosse étoile: la, ré, sol, do roulés vers le grave | -21 | 2 | idem | musique | non placé |
| étoiles | `star_chime` (note 3) | `star-chime-4` | t = 7,6 s: ré 6 | -24 | 2 | idem | musique | non placé |
| étoiles | `star_chime` (note 4) | `star-chime-5` | t = 9,4 s: do 6 | -24 | 2 | idem | musique | non placé |
| étoiles | `night_water` | `night-water` (boucle de 6 s) | présence, attente et apogée, placé à `stars_water` | -30 LUFS int. | 3 | aucune | ambiance | coupé au-delà de 12 m |
| salut | `gate_crank` | `gate-crank` | armement, 2,5 s, à chaque manivelle | -24 | 2 | 2 variantes (11 et 13 crans par tour), hauteur ±3 % | effets | réf. 3 m, coupé au-delà de 45 m |
| salut | `gate_lock` | `gate-lock` | fin de l'armement (2,5 s), à chaque poteau | -22 | 2 | hauteur ±4 % | effets | idem |
| salut | `train_slow_roll` | `train-slow-roll` (boucle de 2 s) | apogée, de t = 8 s à la sortie, suit la cabine | -24 LUFS int. | 1 | aucune | effets | réf. 8 m, coupé au-delà de 160 m |
| salut | `train_whistle_salute` | `train-whistle-salute` | **un seul déclenchement** à t = 10,0 s (le fichier contient les deux coups, 10,0 et 10,6 s) | -15 | 1 | aucune | effets | réf. 15 m, jamais sous -14 dB |
| salut | `cylinder_cocks` | `cylinder-cocks` | t = 11 s, à la locomotive | -20 | 2 | hauteur ±3 % | effets | réf. 8 m, coupé au-delà de 160 m |
| dame blanche | `owl_screech` | `owl-screech` | attente, toutes les 20 à 30 s; apogée, t = 13,4 s | -23 | 2 | 3 cris, hauteur ±3 %, 5 s au moins entre deux | effets | réf. 4 m, coupé au-delà de 25 m |
| dame blanche | `grass_strike` | `grass-strike` | apogée, t = 6,2 s | -25 | 2 | hauteur ±4 % | effets | réf. 3 m, coupé au-delà de 20 m |
| lanternes | `lantern_light` | `lantern-light` | chaque allumage, à la lanterne; les deux à t = 0 de l'apogée | -24 | 2 | 2 variantes, hauteur ±4 %, aucun intervalle minimal | effets | réf. 3 m, coupé au-delà de 45 m |
| lanternes | `lantern_out` | `lantern-out` | flamme allumée seule, 0,8 s après | -26 | 2 | hauteur ±5 % | effets | réf. 2 m, coupé au-delà de 28 m |
| lanternes | `quay_bell_once` | `quay-bell-once` | apogée, t = 6,0 s, à la cloche du quai | -18 | 2 | aucune | effets | réf. 8 m, coupé au-delà de 160 m |

| Événement | Son | Niveau | Priorité | Variations | Bus | Écoute | Atténue la musique |
|---|---|---|---|---|---|---|---|
| Verser au chantier | `coins-drop` | -21 | 2 | 2 variantes, hauteur ±3 %, niveau ±1 dB | interface | non placé |  |
| Un chantier est bâti (notification du matin, chez les deux) | `chantier-built` | -19 | 2 | aucune | interface | non placé | -6 dB |
| Offrir un cadeau | `gift-give` | -24 | 2 | 2 variantes, hauteur ±5 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Odette moud du café (moulin offert, sur son comptoir) | `coffee-grind` | -27 | 4 | 2 variantes, hauteur ±4 %, 8 s au moins entre deux | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Horloge murale (boucle, posée au mur) | `clock-tick` (boucle de 2 s) | -38 LUFS int. | 4 | aucune | effets | placé, réf. 0,8 m, coupé au-delà de 3 m (préréglage `horloge`) |  |
| Arroser avec l'arrosoir de cuivre (P1) | `water-pour-copper` | -25 | 3 | 2 variantes, hauteur ±4 %, niveau ±1 dB | effets | placé, réf. 2 m, coupé au-delà de 28 m |  |
| Soir d'automne sans la dame blanche: l'effraie au loin | `owl-far` (`ambiance/`) | -30 | 4 | 2 cris | ambiance | non placé, une fois par soir (`plan.eveningCalls`) |  |

- **Les étoiles « dans l'ordre »**: le moteur tire les variantes au hasard (`VariantPicker`), donc les cinq notes sont cinq sons (`star-chime-1` à `-5`, champ `order`), comme les tournants de saison: la chorégraphie nomme `star_chime_1` à `star_chime_5`. Do pentatonique (do, ré, mi, sol, la), dans fa majeur (la nuit), sol majeur (le jour) et do majeur (le samedi); aucune paire de notes dure (contrôle bloquant dans `moments_tour9.py`). La phrase monte (sol, mi), s'ouvre sur l'accord de la grosse étoile, puis se pose (ré, do). Les étoiles filantes ne font aucun bruit: c'est la musique qui les accompagne. La musique de la nuit à -9 dB pendant l'apogée (`starsMusicDuckDb`) se règle dans le moteur; ces notes, sur le bus musique, n'en sont pas baissées.
- **Le salut**: le sifflet du salut est la même locomotive (les trois tuyaux ré, sol, si de `train-whistle`), mais deux coups brefs de 0,4 s au lieu du « pou-pouuu »: on reconnaît le train et on comprend que c'est un autre message. `cylinder-cocks` est plus rauque et plus bas que le grand jet de l'arrêt (centroïde 2,6 kHz contre 6,6 kHz pour `train-steam`), deux jets décalés (un par cylindre). `train-slow-roll`: quatre bouffées douces par tour de 2 s, la bielle, un joint de rail « ta... dam » (deux essieux à 2,4 m, 1,5 s d'écart à 1,6 m/s); 49 % de l'énergie sous 300 Hz, sous la limite de 60 % du jeu.
- **L'effraie**: un chuintement rauque et soufflé (« chhhrrééé », 1,1 à 1,3 s), presque sans note, centroïde 3,3 à 3,4 kHz: rien de commun avec le héron (1,0 kHz) ni les corneilles (0,9 kHz). Son vol reste silencieux (fiche): aucun son d'aile. `owl-far` est le même cri passé au loin (aigus coupés vers 2,6 kHz, écho des granges, -7 dB sous le cri proche).
- **Les lanternes**: la mèche qui prend (centroïde 2,1 kHz, 0,5 s utiles, un « fffou » qui monte), la flamme seule qui vacille trois fois et s'éteint dans un « pff ». `quay-bell-once` est le premier coup de `station-bell`, seul.
- **Les chantiers**: `coins-drop` (7 ou 9 pièces en tas dans le tronc de bois, deux qui roulent, 0,66 à 0,72 s utiles) se distingue de `coins` (3 à 6 pièces comptées, 0,26 à 0,32 s). `chantier-built`: deux coups de maillet de Basile, puis le marimba monte sol, si, ré, sol sous une clochette (si): plus ample que `notify`, à jouer à sa place pour ce message.
- **Dossier `objets/`**: `chantier-built`, `gift-give`, `coffee-grind`, `clock-tick` et `water-pour-copper` tiennent à un objet acheté ou offert. Ils ne sont pas décodés au lancement (le plafond de 30 Mo des sons permanents, `memoire.test.ts`, aurait été dépassé: 32,3 Mo mesurés avec eux dans `effets/` et `interface/`). Chacun porte `decodeWhen` dans `sons.json`: le moment où le dev audio le demande au cache (chantier payé, cadeau dans un sac, moulin offert et écouteur près du comptoir, horloge posée et écouteur dans la maisonnette, arrosoir de cuivre dans un sac). Sans cette demande, le moteur décode au premier appel et le premier son manque (une boucle, elle, démarre à l'image suivante).
- **L'arrosoir de cuivre** est plus clair que celui de zinc (centroïde 3,4 à 3,5 kHz contre 2,8 kHz), avec deux résonances longues du cuivre sous le filet.
- **Noms de la section 7 de la conception**: plusieurs sons y sont cités comme « actuels » sous un autre nom. Correspondance proposée: `letter-open` est `journal-open`; `crate-drop` est `crate-deposit`; `coins-gain` est `coins`; `catalogue-order` est `order-stamp`; `tool-pickup` est `pickup`; `hen-cluck` est `hen` (aussi pour le caquet de la nouvelle poule). Le départ du train du 64 garde le sifflet et `fin`.
- **Ambiances d'automne**: `wind-leaves`, `crows` et les oiseaux du matin plus rares (tour 8) restent; le tour 9 ajoute seulement `owl-far` pour les soirs. Les grillons (`crickets`) jouent toujours en automne dès 19 h, ce qui reste juste pour la fin de septembre et octobre (grillons champêtres tardifs).

### 4.8 La rue Haute, les intérieurs, les besoins, la maison qui grandit (tour 10)

Sons de `docs/jeux/jeu-1/tour-10-conception.md` (liste de la section 10, actions de la section 8) et de l'ADR 0016 (section 4, ambiance par bâtiment), source `assets-src/son/tour10.py`. Aucun déclencheur n'existe encore: le lot L5 (rendu et son) les branche à partir du catalogue ci-dessous.

**Mémoire.** Les sons permanents (`effets/`, `interface/`, `habitants/`) font 29,3 Mo décodés pour un plafond de 30 Mo (`memoire.test.ts`). Rien de ce tour n'y entre: quatre dossiers décodés à la demande, chaque son avec son champ `decodeWhen` (le moment où le dev audio le demande au cache, pour que le premier coup ne manque pas). `besoins/` (2,9 Mo décodés) gagnerait à être permanent, parce que ses sons tombent n'importe où: question S4.

**Niveaux.** Colonne « Niveau »: sonie momentanée maximale visée (intégrée pour une boucle), en LUFS, au sens de `dsp.amener_momentanee`; `volumeDb` vaut 0 pour tous (le niveau est dans le fichier). Mesures après décodage dans `assets-src/son/controles/mesures.csv` (filtre `ebur128`: les fichiers mono y sortent environ 3 dB sous la cible, comme partout dans le jeu).

#### Catalogue pour le lot L5

| Identifiant | Fichier(s) | Bus | Niveau | Boucle | Quand il joue | Où, chez qui | Variations, garde-fous |
|---|---|---|---|---|---|---|---|
| `door-locked` | `rue-haute/door-locked-1.ogg`, `-2` | effets | -23 | non | Agir sur une porte d'intérieur hors de ses heures (texte `door_closed_*`, `bakery_closed`) | à la porte, préréglage `moyen`; chez qui essaie, et placé chez l'autre | 2 variantes, hauteur ±4 %, 600 ms entre deux |
| `bakery-bell` | `rue-haute/bakery-bell.ogg` | effets | -22 | non | achat au guichet du fournil (pain, pain chaud, brioche) | à `bakery_window`, `moyen` | ré 6, aucune variation de hauteur |
| `bread-crack` | `rue-haute/bread-crack-1.ogg`, `-2` | effets | -26 | non | pain chaud reçu (6 h à 9 h), 0,3 s après `bakery-bell` | au joueur qui achète, `pres` | 2 variantes, hauteur ±5 % |
| `salon-bell` | `rue-haute/salon-bell.ogg` | effets | -23 | non | on passe la porte du salon (entrée), avec `door-open` | à `salon_door`, `moyen` | sol 6 et si 6, aucune variation de hauteur; 1,5 s entre deux |
| `chair-creak` | `rue-haute/chair-creak-1.ogg`, `-2` | effets | -25 | non | s'asseoir au fauteuil de coiffure (`haircut_sit`) | à `salon_chair`, `pres` | 2 variantes, hauteur ±5 % |
| `scissors-snip` | `rue-haute/scissors-snip-1.ogg` à `-3` | effets | -24 | non | valider une coupe: 2 ou 3 coups espacés de 0,2 à 0,35 s pendant `cut_hair`, puis `hair-reveal` | à Solange, `pres` | 3 variantes (la 2e coupe deux fois), hauteur ±5 %, 120 ms entre deux, 2 voix |
| `hair-reveal` | `rue-haute/hair-reveal.ogg` | interface | -20 | non | la coupe ou la couleur change (après les ciseaux) | non placé; chez la personne au fauteuil, et chez l'autre s'il est au salon | sol majeur, aucune variation; musique -6 dB |
| `hair-noticed` | `besoins/hair-noticed.ogg` | interface | -21 | non | coupe remarquée (« {name} a changé de coiffure. ») | non placé, chez les deux | ré 6 puis sol 6; musique -3 dB |
| `eat-together` | `besoins/eat-together.ogg` | effets | -23 | non | manger ensemble (repas partagé, table d'Odette), en plus de `eat` | entre les deux mangeurs, `pres` | hauteur ±4 %, 3 s entre deux |
| `belly-rumble` | `besoins/belly-rumble-1.ogg`, `-2` | effets | -30 | non | le Ventre passe sous le seuil du petit creux (une fois) | non placé, **chez soi seulement** (`localOnly`); muet avec « Besoins en sourdine » | 2 variantes, hauteur ±6 %, 20 s entre deux |
| `cup-sip` | `rue-haute/cup-sip.ogg` | effets | -26 | non | boire un chocolat chaud (`drink_cup`) | au buveur, `grocery_table`, `pres` | hauteur ±4 % |
| `yawn-soft` | `besoins/yawn-soft.ogg` | effets | -25 | non | commencer une sieste (au lit, 12 h à 16 h) | au lit, `pres`; l'autre l'entend placé | hauteur ±4 %; aucune voix (petite flûte qui glisse) |
| `nap-tick` | `besoins/nap-tick.ogg` | interface | -34 int. | oui, 2 s | sieste à deux: de l'horloge x 4 au réveil du premier (fondu de 0,4 s) | non placé, chez les deux | aucune |
| `reunion-chime` | `besoins/reunion-chime.ogg` | interface | -19 | non | retrouvailles (« Retrouvailles ! ») | non placé, chez les deux au même instant | sol majeur, aucune variation; musique -6 dB |
| `beam-ridge` | `maison/beam-ridge.ogg` | effets | -21 | non | la panne faîtière arrive à son repère au faîte (fin du porter à deux); `duo-done` suit | au repère du faîte, `moyen` | hauteur ±3 % |
| `room-built` | `maison/room-built.ogg` | interface | -18 | non | notification du matin: une pièce est bâtie (`room_built`), à la place de `chantier-built` et `notify` | non placé, chez les deux | sol majeur, aucune variation; musique -6 dB |
| `chest-full` | `maison/chest-full.ogg` | effets | -24 | non | dépôt refusé, rangement plein (`storage_full`), à la place de `ui-refusal` | au meuble de rangement, `pres` | hauteur ±4 %, 600 ms entre deux |
| `rack-hang` | `maison/rack-hang-1.ogg`, `-2` | effets | -24 | non | un outil va au râtelier | au râtelier, `pres` | 2 variantes, hauteur ±5 % |
| `curtain-hang` | `maison/curtain-hang.ogg` | effets | -25 | non | accrocher des rideaux à une fenêtre (à la place de `furniture-place`) | à la fenêtre, `pres` | hauteur ±4 % |
| `curtain-draw` | `maison/curtain-draw-1.ogg`, `-2` | effets | -27 | non | ouvrir (variante 1) ou fermer (variante 2) les rideaux (`curtain_pull`) | à la fenêtre, `pres` | hauteur ±5 %, 300 ms entre deux; au hasard si le moteur ne choisit pas la variante |
| `school-recess` | `rue-haute/school-recess.ogg` | effets | -22 | non, 16 s | jours d'école, à 10 h 30 et 15 h | au milieu de la cour (x 79, y 16), préréglage `loin`; chez les deux | aucune |
| `footbridge-steps` | `rue-haute/footbridge-steps-1.ogg` à `-4` | effets | -27,5 | non | chaque appui de pied sur la passerelle du ru, à la place de `step-wood` | au pied, `pres` | 4 variantes, hauteur ±5 %, niveau ±1,5 dB, 120 ms entre deux |
| `talk-achille` | `rue-haute/talk-achille.ogg` | interface | -19,5 | non | ouvrir une conversation avec Achille | non placé, chez qui parle | musique -8 dB, 4 s entre deux |
| `talk-solange` | `rue-haute/talk-solange.ogg` | interface | -19 | non | ouvrir une conversation avec Solange | non placé, chez qui parle | musique -8 dB, 4 s entre deux |
| `stream-ru` | `ambiance/stream-ru.ogg` | ambiance | -28 int. | oui, 20 s | toujours (6 h à 6 h), comme la rivière | sources le long du ru tous les 8 m (`plan.stream`), préréglage `ru` (réf. 3 m, coupé au-delà de 30 m), +3 dB au gué | chaque source à son propre décalage de départ |
| `room-tone-shop` | `ambiance/room-tone-shop.ogg` | ambiance | -36 int. | oui, 30 s | l'écouteur est dans l'épicerie | non placé (`plan.interiorByBuilding`), fondu de 0,6 s à la porte | aucune |
| `room-tone-salon` | `ambiance/room-tone-salon.ogg` | ambiance | -36 int. | oui, 30 s | l'écouteur est dans le salon de Solange | non placé, idem | aucune |

**Le dehors entendu de dedans** (`plan.interiorByBuilding`, clé ignorée par le schéma tant que L5 ne la lit pas): le filtre de la maisonnette (`plan.interior`, passe-bas 900 Hz et -10 dB, rampe de 600 ms) devient une règle par bâtiment, appliquée dès que `listener.inside` n'est pas nul: maisonnette 900 Hz et -10 dB; épicerie 1 100 Hz et -9 dB (porte vitrée, comptoir sur la place); salon 1 300 Hz et -8 dB (la vitrine laisse passer la rue). La pluie sur le toit (`rain-roof`) sert dans les trois. L'autre joueur dans un autre bâtiment: ses sons placés passent par le même étouffement (900 Hz, -8 dB, en plus de `peerWorldSoundsDb`), puisque je l'entends à travers des murs. Les identifiants des bâtiments (`house`, `grocery`, `salon`) sont à confirmer par L0; le champ d'ambiance d'un bâtiment de la carte nomme directement le son (`room-tone-shop`).

- **Achille** (`talk-achille`): deux pas de valse lente au basson qui descendent comme un bâillement (ré, si, sol; do, la, fa dièse), puis sol tenu; les pizzicati font le « pom-pom » des temps faibles. 3/4, noire à 100, sol majeur.
- **Solange** (`talk-solange`): la clarinette file (sol, do, ré), les pizzicati aigus vont par deux comme des coups de ciseaux, et l'air se pose sur si, sur mi mineur: vive, avec la pointe de mélancolie de la fiche. 4/4, 132.
- **Sans voix**: le bâillement est une petite flûte de bois qui glisse (fondamentale 300 à 520 Hz, aucun formant: épicène); la récréation se devine sans cris d'enfants (cloche à main de l'instituteur, galopades sur le gravier, balle contre le mur, corde à sauter, une bille), passée au loin et par-dessus le mur de la cour.
- **Les deux clochettes** se distinguent: celle du guichet est une clochette à main secouée trois fois (ré 6, centroïde 1,3 kHz); celle du salon, deux petites cloches sur un ressort qui rebondissent neuf fois en se serrant (sol 6 et si 6, centroïde 1,9 kHz).
- **Le ru** est plus clair que l'Aubrune (centroïde 2,0 kHz, presque rien sous 300 Hz): un filet d'eau vive sur des galets.
- **Les pièces**: la boutique a sa pendule de comptoir (un « toc » par seconde), le plancher, les bocaux et deux poids de balance; le salon, le robinet du bac qui goutte, le journal du banc, une bobine, un flacon. Ni l'une ni l'autre ne contient de feu ni de ciseaux: le poêle d'Odette ne chauffe pas en été, les ciseaux ne sonnent que quand on coupe.
- **Portable**: la panne faîtière, la passerelle et le coffre plein gardent moins de 60 % de leur énergie sous 300 Hz (mesuré: 59, 39 à 47 et 41 %); le gargouillis passe par deux résonances de 380 et 760 Hz (1 % sous 300 Hz) pour rester entendu, discret, sur des haut-parleurs de portable.
- **Tonalités**: tout ce qui chante (`hair-reveal`, `hair-noticed`, `reunion-chime`, `room-built`, `bakery-bell`, `salon-bell`, motifs) est en sol majeur, en général sur sa pentatonique; les accords tenus sont contrôlés à la génération (aucune seconde mineure, septième majeure ni triton tenus, toutes paires confondues).

### 4.9 Les habitants et le village agrandi (0.13, lots H8 et L4 bis)

Sons de `docs/jeux/jeu-1/v0-13-habitants.md` (sections 4, 6, 7 et 8: carnet, amitié, vie du village, chat) et de `docs/jeux/jeu-1/v0-13-carte.md` (lot L4 bis: église, forge, moulin, lavoir, café, forêt, ferme). Source: `assets-src/son/v0_13.py`, branchée dans `generer.py`. Aucun déclencheur n'existe encore: les lots H1 à H3 (habitudes, amitié, carnet) et L4 (simulation, cloches) les branchent à partir du catalogue ci-dessous.

**Mémoire.** Rien n'entre dans les sons permanents (toujours 29,3 Mo sur 30). Cinq dossiers neufs, tous décodés à la demande avec leur champ `decodeWhen`: `eglise/` (11,3 Mo décodés, dont 6,4 pour l'harmonium), `metiers/` (9,9 Mo), `decor/` (4,8 Mo), `carnet/` (4,6 Mo), `voisins/` (17,1 Mo si les quatorze motifs étaient chargés à la fois; chacun est demandé quand son habitant passe à moins de 20 m, 1,1 à 1,7 Mo pièce). Ambiances neuves dans `ambiance/`: `forest-deep` et `farm` 7,5 Mo chacune, `church-inside` et `room-tone-cafe` 5,7 Mo (une seule ambiance de pièce à la fois). `carnet/` sonne partout et à tout moment: question S5.

**Niveaux.** Comme en 4.8: sonie momentanée maximale visée (intégrée pour une boucle), au sens de `dsp.amener_momentanee`; `volumeDb` vaut 0; mesures après décodage dans `assets-src/son/controles/mesures.csv` (les fichiers mono y sortent environ 3 dB sous la cible).

**Sans voix.** « Crier dans le puits » et « crier au belvédère » (gestes 1 et 19) sont joués par un hululement soufflé dans les mains jointes, comme un appeau: un son d'ocarina presque pur vers 400 Hz, sans formant de voix, donc épicène. Le « hou… ou… » du puits est son écho dans le cylindre de pierre.

#### Catalogue pour le rendu

| Identifiant | Fichier(s) | Bus | Niveau | Boucle | Quand il joue | Où, chez qui | Variations, garde-fous |
|---|---|---|---|---|---|---|---|
| `angelus-toll` | `eglise/angelus-toll-1.ogg`, `-2` | effets | -18 | non | angélus de 7 h, 12 h et 19 h (séquence `plan.sequences.angelus`: trois fois trois coups, 1,6 s entre deux coups, 3,2 s entre deux séries); un coup par traction de corde dans « L'angélus à deux » | au clocher (x 87, y -12), préréglage `vallee` (jamais sous -14 dB); chez les deux | 2 variantes (force du coup), aucune variation de hauteur; 5 voix (les coups résonnent les uns sur les autres) |
| `bell-peal` | `eglise/bell-peal.ogg` | effets | -16 | non, 15 s | fin de l'angélus (19,5 s après le premier coup); geste `bell_rope_pull` (une fois par jour, jamais à moins de 30 minutes d'un angélus) | au clocher, `vallee`; chez les deux | aucune; musique -4 dB |
| `harmonium-note` | `eglise/harmonium-note-1.ogg` à `-5` | effets | -22 | non | geste 11 `harmonium_note` (hors messe et chorale) | à l'harmonium, `moyen` | 5 notes de la pentatonique de sol (sol 3, la 3, si 3, ré 4, mi 4), tirées sans répétition, aucune variation de hauteur; 1 s entre deux |
| `harmonium-chord` | `eglise/harmonium-chord-1.ogg` à `-4` | effets | -21 | non | les deux touchent l'harmonium à moins de 3 s (« À deux » du geste 11), à la place de `harmonium-note` | à l'harmonium, `moyen` | 4 accords doux (sol, mi mineur, do, ré), tirés sans répétition |
| `anvil-strike` | `metiers/anvil-strike-1.ogg` à `-3` | effets | -21 | non | gestes des quêtes de Mado (cercler la roue, la grille du père Joseph), coup par coup | à l'enclume de la cour (x 105, y 17), `moyen` | coup sur le fer, coup à vide, coup et rebond; hauteur ±4 %, 150 ms entre deux |
| `forge-loop` | `metiers/forge-loop.ogg` | effets | -30 int. | oui, 12 s | Mado à son habitude de forge dans la cour, hors dimanche (`plan.placedLoops`) | à l'enclume, `moyen`; fondu de 1 s | aucune |
| `mill-wheel` | `metiers/mill-wheel.ogg` | effets | -27 int. | oui, 16 s | le moulin tourne (après « La vanne coincée »), jour et nuit; c'est « la berceuse de Berthe » du geste 16 | à la roue (x -14, y 34,5), `moyen`; fondu de 1,5 s | aucune |
| `millstone` | `metiers/millstone.ogg` | effets | -29 int. | oui, 12 s | le moulin moud (Berthe à l'ensachage, 6 h 30 à 12 h, une fois remis en marche) | aux meules (x -15, y 31), `moyen`; dedans et de la cour | aucune |
| `sluice-open` | `metiers/sluice-open.ogg` | effets | -19 | non, 7 s | fin du geste à deux de « La vanne coincée »; `mill-wheel` prend le relais en fondu de 1,5 s | à la vanne (x -12, y 34), `moyen`; chez les deux | aucune |
| `washboard-beat` | `metiers/washboard-beat-1.ogg` à `-3` | effets | -23 | non | geste 14 `washhouse_scrub` (un coup toutes les 0,6 à 0,8 s tant qu'Agir est maintenu); Margot et Colette le lundi de 9 h à 11 h (un coup toutes les 1,5 à 3 s) | au lavoir, `moyen` | 3 variantes, hauteur ±5 %, 350 ms entre deux |
| `plic` | `decor/plic-1.ogg` à `-3` | effets | -26 | non | geste 4 `skim_stone`: un par rebond (0 à 7), chaque rebond 1,5 dB plus bas et 12 % plus tôt que le précédent | au point du rebond, `moyen` | 3 variantes, hauteur ±6 %, 60 ms entre deux, 4 voix |
| `well-drop` | `decor/well-drop-1.ogg`, `-2` | effets | -24 | non | geste 1 `well_peek` (Agir) | au puits, `pres` | une ou deux gouttes; 10 s entre deux (règle 7.0) |
| `well-echo` | `decor/well-echo.ogg` | effets | -22 | non | geste 1, maintien | au puits, `pres` | aucune voix; 10 s entre deux |
| `lookout-echo` | `decor/lookout-echo-1.ogg`, `-2` | effets | -20 | non | geste 19 `lookout_shout` | au belvédère, `moyen`; chez celui qui crie, placé chez l'autre s'il est à moins de 45 m | 2 hauteurs de hululement, double écho à 0,95 et 1,75 s; une fois par minute |
| `lookout-echo-far` | `decor/lookout-echo-far.ogg` | effets | -30 | non | en même temps que `lookout-echo`, chez l'autre joueur s'il est à plus de 45 m | non placé | une fois par minute |
| `step-leaves` | `decor/step-leaves-1.ogg` à `-4` | effets | -28,5 | non | chaque pas sur le sol « feuilles » de la forêt (et de la lisière en automne), à la place de `step-path` | au pied, `pres` | 4 variantes (la quatrième casse une brindille), hauteur ±6 %, niveau ±1,5 dB, 120 ms entre deux |
| `cat-purr` | `decor/cat-purr-1.ogg`, `-2` | effets | -27 | non | geste 30 `cat_pet` | au chat, `pres` | 2 variantes (respiration plus ou moins lente); 10 s entre deux |
| `cat-meow` | `decor/cat-meow-1.ogg`, `-2` | effets | -25 | non | variante 1 (« mrrp » qui monte): le chat se met à suivre un joueur; variante 2 (« miaou » tendre): il dépose sa trouvaille devant la maisonnette | au chat, `faune-12` | au hasard si le moteur ne choisit pas; 20 s entre deux |
| `pencil-note` | `carnet/pencil-note-1.ogg`, `-2` | interface | -27 | non | une habitude découverte (notification « Carnet: … »), une habitude barrée qui se réécrit | non placé, chez les deux | 2 variantes, hauteur ±3 %; 1,5 s entre deux |
| `bond-chime` | `carnet/bond-chime-1.ogg`, `-2` | interface | -24 | non | premier gain d'amitié du jour avec un habitant (la lanterne frémit) | non placé, chez qui parle | ré 6 ou sol 6, aucune variation de hauteur |
| `bond-level` | `carnet/bond-level.ogg` | interface | -19 | non | un niveau d'amitié passé (une lanterne s'allume) | non placé, chez les deux | aucune; musique -6 dB |
| `birthday-chime` | `carnet/birthday-chime.ogg` | interface | -19 | non | « Bon anniversaire » choisi en dialogue | non placé, chez qui souhaite, et chez l'autre s'il est à moins de 8 m | aucune; musique -6 dB |
| `decision-agree` | `carnet/decision-agree.ogg` | interface | -19 | non | décision à deux: les deux choix sont les mêmes, tampon « Décidé ensemble » (0,2 s après `order-stamp`) | non placé, chez les deux | aucune; musique -6 dB; aucun son pour un désaccord |
| `talk-armand` à `talk-colette` | `voisins/talk-<id>.ogg` (14) | interface | -19 | non | ouvrir une conversation avec l'habitant (section 5) | non placé, chez qui parle | musique -8 dB, 4 s entre deux |
| `forest-deep` | `ambiance/forest-deep.ogg` | ambiance | -30 int. | oui, 40 s | l'écouteur est dans la forêt (y < 2, hors lisière du bourg): plein à 8 m dans le bois, éteint à la lisière; le vent baisse de 4 dB, le bourg de 6 dB, les oiseaux du matin de 3 dB (`plan.ambienceByRegion`) | non placé | aucune |
| `farm` | `ambiance/farm.ogg` | ambiance | -31 int. | oui, 40 s | de 6 h à 21 h (`plan.ambienceByRegion`) | dans la cour de la ferme (x 112, y 33), préréglage `loin` | aucune |
| `church-inside` | `ambiance/church-inside.ogg` | ambiance | -37 int. | oui, 30 s | l'écouteur est dans l'église (`plan.interiorByBuilding.church`) | non placé, fondu de 0,6 s | aucune |
| `room-tone-cafe` | `ambiance/room-tone-cafe.ogg` | ambiance | -35 int. | oui, 30 s | l'écouteur est dans le café (`plan.interiorByBuilding.cafe`) | non placé, fondu de 0,6 s | aucune |

**Le plan** (`sons.json`): la séquence `plan.sequences.angelus` (lue par le moteur), quatre intérieurs neufs dans `plan.interiorByBuilding` (lus par le moteur dès que `listener.inside` vaut leur identifiant: `church` 700 Hz et -13 dB avec `church-inside`, `cafe` 1 100 Hz et -9 dB avec `room-tone-cafe`, `forge` 1 400 Hz et -6 dB sans ambiance de pièce, la grande porte étant ouverte, `mill` 900 Hz et -10 dB, `millstone` étant placée dedans); trois clés à part, ignorées par le schéma tant que le dev audio ne les lit pas: `plan.angelus` (heures, point du clocher, pause de 3 s des habitants de la scène S10), `plan.placedLoops` (forge, roue, meules, avec leur condition), `plan.ambienceByRegion` (forêt et ferme). Les identifiants des bâtiments et les coordonnées sont ceux de `v0-13-carte.md` (sections 4 et 7.2), à confirmer par le lot L1.

- **Les cloches** de Saint-Aubin sont trois cloches d'église synthétisées (bourdon, octave grave, tierce mineure, quinte, nominale et octave de la nominale, chaque partiel doublé d'un voisin qui bat lentement), nominales sol 4, si 4 et ré 5: l'accord de sol, la tonalité du jour. La tierce mineure, couleur de toute cloche, est gardée faible pour ne pas heurter le si. Le bourdon tinte seul (les coups de l'angélus); la volée lance les trois l'une après l'autre, chacune à son balancement (1,18, 0,94 et 0,78 s entre deux coups), en crescendo puis en ralentissant quand la sonneuse lâche les cordes. Plus grave et plus long que la cloche du quai (sol 4, 3 s): on sait sans regarder que c'est l'église.
- **L'harmonium** est l'orgue à anches de la banque, dans une nef de 2,6 s de réverbération.
- **La forge**: le marteau sur le fer chaud sonne mat (choc et calamine qui grésille), le coup à vide sur la table sonne clair (« ting » de 1,25 s); la boucle enchaîne deux volées de cinq coups sur le fer et deux à vide, le soufflet trois fois, le feu qui ronfle.
- **Le moulin**: la roue (huit aubes, un tour en 4 s, une aube toutes les 0,5 s, l'axe qui grince à chaque tour) est claire et mouillée (centroïde 2,1 kHz); la salle des meules est grave (grondement de la meule, rouet de bois à 9 dents par seconde, auget à 3 coups par seconde): 71 % de son énergie sous 300 Hz, c'est une machine de pierre; le rouet et l'auget, au-dessus de 500 Hz, la font entendre sur un portable.
- **Le chat**: le ronronnement passe par trois résonances (250, 700 et 1 600 Hz), 7 à 9 % de son énergie sous 300 Hz: il reste entendu sur un portable. Le miaulement est doux (sonie -25, une voyelle qui glisse), jamais plaintif.
- **Le carnet** garde la famille « papier et bois » (`pencil-note`: la mine sur le papier, centroïde 5,3 kHz, le plus discret après `ui-focus`); l'amitié est en verre et laiton (la lanterne), ce qui la distingue des notifications en marimba. `decision-agree` (deux marimbas, l'un à gauche, l'autre à droite, qui se répondent puis frappent ensemble la quinte sol et ré sur un cor) se distingue de `duo-done` (flûte et clarinette en tierces) et de `reunion-chime` (deux voix qui se rejoignent sur sol).
- **Les ambiances**: la forêt profonde est plus sourde que la lisière (cimes, feuilles par bouffées, pic au loin deux fois, geai deux fois, ramier, une phrase de merle, un tronc qui grince, deux brindilles); la ferme a ses poules, sa vache au loin, une clochette de pâture, la chaîne de l'étable, un seau, la porte de la grange, des moineaux; la nef n'a ni pas ni voix (l'horloge du clocher toutes les 2 s, un banc qui craque, les pigeons du clocher assourdis, un oiseau derrière le vitrail, 3 s de réverbération); le café, ni voix ni musique (le poêle, tasses et soucoupes, une cuillère, un verre sur le zinc, une chaise, la manille: cartes battues et abattues, la monnaie). Les événements de chaque ambiance sont réglés pour que la sonie momentanée maximale reste sous celle des oiseaux du matin (mesuré après décodage: forêt -26,9, ferme -27,7, `birds-morning` -23,9; nef -34,5 et café -32,1, contre -36 pour les pièces du tour 10: le café est plus vivant qu'une boutique).
- **Tonalités**: tout ce qui chante (cloches, harmonium, lanternes, clochettes, anniversaire, décision, motifs) est en sol majeur, en général sur sa pentatonique; les accords tenus sont contrôlés à la génération (aucune seconde mineure, septième majeure ni triton tenus, toutes paires confondues).

## 5. Les habitants

Un motif de 2 à 4 s par habitant, joué à l'ouverture d'une conversation chez celui qui parle (musique à -8 dB, 4 s au moins entre deux motifs du même habitant). Tous en sol majeur, comme le thème qu'ils interrompent.

| Habitant | Motif | Ce qu'il dit du caractère |
|---|---|---|
| Odette Ferrand, épicière (`talk-odette`) | accordéon qui sautille, pizzicati, et un petit rire en trille à la fin | gourmande, bavarde, rieuse |
| Firmin Lacombe, chef de halte (`talk-firmin`) | la pendule de la halte (tic-tac), deux notes bougonnes du basson, puis un accord tendre du cor | bourru, ponctuel, tendre |
| Basile Cornu, menuisier (`talk-basile`) | trois notes de marimba (du bois), lentes, sur un violoncelle | taiseux, patient |
| Jeanne Ribot, dix ans (`talk-jeanne`) | la flûte à bec qui monte et reste en l'air sur la sixte, comme une question, et un trille d'oiseau | intrépide, mille questions, les oiseaux |
| Lucie Arnaud, factrice, seulement citée dans la démo (`talk-lucie`) | la flûte qui file en gamme, et la sonnette de son vélo | curieuse, pressée |
| Achille Pradel, boulanger (`talk-achille`, tour 10, dossier `rue-haute/`) | deux pas de valse lente au basson qui descendent comme un bâillement, sol tenu, pizzicati des temps faibles | lent, ensommeillé, poète de la pâte |
| Solange Mérigot, coiffeuse et mercière (`talk-solange`, tour 10, dossier `rue-haute/`) | la clarinette vive qui file et tourne, des pizzicati aigus par deux comme des ciseaux, fin sur mi mineur | vive, observatrice, une pointe de mélancolie |

Les quatorze habitants nouveaux de la 0.13 (dossier `voisins/`, décodé à la demande): chacun a son instrument principal, différent de celui de tous les autres motifs (la trompette bouchée de Mado et la trompette ouverte de Léon se distinguent par le timbre et le rythme); les accompagnements (pizzicati, harpe, cor, basson) peuvent se retrouver d'un motif à l'autre.

| Habitant | Motif | Ce qu'il dit du caractère |
|---|---|---|
| Armand Castagné, instituteur (`talk-armand`) | l'orgue à anches (son harmonium): deux notes hésitantes, un silence, puis une phrase qui monte d'un pas égal et se pose sur ré, sur une pédale de sol | timide en face, sûr de lui au pupitre |
| Berthe Lavergne, meunière (`talk-berthe`) | le cor dit sa phrase d'un trait, les pizzicati tournent à trois temps comme la roue, et la fin éclate de rire | franche, têtue, rit fort |
| Martial Roques, curé (`talk-martial`) | le trombone rebondit, les pizzicati pédalent à la croche, le tambourin rit une fois | jovial, sportif |
| Marthe Bousquet, sonneuse (`talk-marthe`) | trois coups de cloche tubulaire pile en mesure, puis le hautbois glisse une petite phrase pincée | sèche, exacte, drôle sans le vouloir |
| Honorine Valade, la doyenne (`talk-honorine`) | une boîte à musique lente, une note glissée de travers comme un clin d'œil, les aiguilles à tricoter (claves) dessous | malicieuse, tricote pour tout le bourg |
| Inès Garrigue, garde forestière (`talk-ines`) | la flûte de Pan pose quatre notes, un oiseau répond au loin, puis un seul pizzicato grave | calme, précise, pince-sans-rire, compte les oiseaux |
| Barnabé Tixier, charbonnier (`talk-barnabe`) | le violoncelle chante à la place de sa voix de basse, la harpe arpège, un coup sourd de bois (la hache posée) | colosse doux, chanteur |
| Mado Cazals, forgeronne (`talk-mado`) | deux coups d'enclume accordés sur sol, puis la trompette bouchée éclate de rire | forte, rieuse, son rire couvre l'enclume |
| Paulin Delmas, cultivateur (`talk-paulin`) | le tuba dit trois notes fermes, doublées deux octaves plus haut par le cor, les cordes tiennent la terre | têtu, peu de mots mais justes |
| Margot Delmas, cultivatrice (`talk-margot`) | le violon pose une question et y répond lui-même, en deux phrases égales | gaie, organisée, diplomate |
| Léon Delmas, onze ans (`talk-leon`) | une petite fanfare de trompette, la caisse claire qui roule, un coup de son sifflet de chef de train | fanfaron au grand cœur, veut conduire une locomotive |
| Ambroise Pélissier, horloger (`talk-ambroise`) | le clavecin égrène des doubles croches parfaitement égales, une montre bat vite et fin, le basson grommelle une note | pointilleux, ronchon |
| Nour Belkacem, vétérinaire (`talk-nour`) | le xylophone file vers le haut, rit (mi et ré qui sautillent) et retombe sur sol | énergique, pressée, rieuse |
| Colette Lafon, cafetière (`talk-colette`) | une valse musette lente au bandonéon (plus lente et plus tendre que l'accordéon d'Odette), oom-pah-pah, la tasse posée sur le comptoir | chaleureuse, l'accordéon de son oncle |

Mesuré: tous à -19 de sonie momentanée maximale avant encodage, 1,9 à 4,6 s; Paulin, d'abord à 91 % de son énergie sous 300 Hz (tuba seul), est descendu à 35 % avec le cor; Barnabé 41 %, les autres 1 à 22 %.

## 6. Intégration technique

- **Formats**: Ogg Vorbis 48 kHz; musiques en stéréo (qualité 3, environ 110 kbit/s), ambiances mono (qualité 2), effets placés mono (pour le `PannerNode`), interface et airs en stéréo (qualité 4). Poids total: 16,7 Mo mesuré au tour 10, 19,6 Mo à la 0.13 (budget: 20 Mo, presque plein: question S6). Mémoire décodée des sons du tour 10: `rue-haute/` 8,7 Mo, `besoins/` 2,9 Mo, `maison/` 2,6 Mo, `stream-ru` 3,9 Mo, chaque ambiance de pièce 5,7 Mo (une seule à la fois: on n'est que dans un intérieur).
- **Boucles**: chaque fichier de boucle porte une amorce de chaque côté (la fin de la boucle avant, son début après: 1 s pour les musiques, 0,4 à 0,5 s pour les autres). Jouer avec `AudioBufferSourceNode`: `loop = true`, `loopStart` et `loopEnd` lus dans `loop.startSeconds` et `loop.endSeconds`, départ à `playFromSeconds` (pour une musique, le premier temps, 0,12 s après le début de la boucle: le raccord tombe entre deux notes).
- **Pas de lecture en flux pour les boucles**: mesuré dans Chromium, `<audio loop>` insère 128 à 256 échantillons de silence (2,7 à 5,3 ms) à chaque tour, un clic audible sur une musique. Les boucles doivent être décodées (`decodeAudioData`).
- **Mémoire décodée** (float32 à 48 kHz): effets placés 9,1 Mo, interface 10,6 Mo, motifs 5,6 Mo, train 13,0 Mo, ambiances 33,8 Mo si toutes chargées (jour: rivière, vent, oiseaux, bourg 23,8 Mo; soir: 13 Mo), une musique de 28 à 39 Mo. Chargement conseillé: effets, interface et motifs en permanence (25 Mo); une seule musique décodée à la fois (libérée après son fondu ou pendant le repos); ambiances selon l'heure; train le samedi seulement. Tour 8: ambiances de saison décodées selon la saison (`mist-morning` 4,8 Mo, `crickets-summer` 4,0 Mo à la place de `crickets`, `swifts` 6,0 Mo, `wind-leaves` 4,8 Mo à la place de `wind`, `crows` 7,9 Mo), motifs de saison 6,8 Mo dans `saisons/`, `halte-ete` 37,6 Mo comme les autres thèmes du jour. Tour 9: `coins-drop` rejoint les sons permanents (0,5 Mo); les sons des moments nouveaux sont dans `moments/` (décodés avec leur moment), ceux des objets dans `objets/` (section 4.7); `halte-evening` 12 Mo décodés, une fois. Pic d'un samedi en journée: environ 94 Mo, au-dessus des 64 Mo d'audio décodé prévus par l'architecture (question ouverte, section 9).
- **Hauteur**: la variation se fait par `playbackRate` (elle change aussi un peu la durée, voulu).
- **Rien n'est joué deux fois au même instant**: `minIntervalMs` évite les doublons (deux joueurs qui récoltent ensemble, double clic) et `maxVoices` borne les répétitions d'un même son.
- `sons.json` est généré par `generer.py`: ne pas le modifier à la main; tout réglage passe par les sources.

## 7. Contrôles (sans écouter)

- `duo-python games/la-petite-ligne/assets-src/son/generer.py` régénère tout (environ 6 minutes) puis lance `controler.py`: sonie et crête vraie de chaque fichier par le filtre `ebur128` de ffmpeg après décodage (aucune crête au-dessus de -1,5 dBTP, aucun échantillon écrêté), silence en tête des effets (2,6 ms au plus), longueur exacte et raccord de chaque boucle (saut et seconde différence comparés à leur distribution dans le fichier, niveau au raccord comparé aux variations internes), poids du jeu.
- `node games/la-petite-ligne/assets-src/son/verifier-chromium.cjs` (Playwright): les 384 fichiers se décodent dans Chromium; chaque boucle, décodée à 48 et 44,1 kHz puis réellement jouée en boucle dans un `OfflineAudioContext`, passe le raccord sans saut.
- Avant le rendu, un contrôle de l'écriture bloque toute musique où deux instruments tiennent ensemble une seconde mineure, une septième majeure ou un triton hors de l'accord (il a corrigé deux fautes d'harmonie pendant la production).
- Les spectrogrammes et formes d'onde (`controler.py --images DOSSIER`) ont été examinés pour chaque famille de sons.
- Deux générations successives donnent les mêmes fichiers à l'octet (graines fixes, encodage sans métadonnées variables).

**Pour l'écoute du client** (`design/son/la-petite-ligne/`, AAC à 96 kbit/s, lisible directement sur Mac): `ecoute.m4a` (22,5 min) enchaîne les musiques (pour chaque boucle, 14 s avant le raccord et 10 s après: on entend le passage de la fin au début), la séquence du train (arrivée, attente, départ), le sifflet lointain, chaque effet avec toutes ses variantes, les motifs des habitants et les ambiances; `musiques/` contient une boucle complète de chaque musique. Les niveaux relatifs sont ceux du jeu, sauf les musiques, jouées 4 dB plus fort que dans le jeu.

## 8. Écarts et limites

- **Voix**: ni « hop », ni souffle de l'effort, ni bâillement, ni rire d'habitant (aucune voix enregistrée ni synthétisée, cahier 6.12): remplacés par des sons d'instruments et d'objets.
- **Qualité « superbe »**: livrée (`quality-superb`) bien qu'absente de la démo.
- **Lucie**: son motif est livré, bien qu'elle soit seulement citée dans la démo.
- **Oiseaux**: génériques (trille, « tsip », phrase flûtée, « ti-tu », coucou et pigeon ramier au loin). Les chants des 24 espèces du carnet restent à faire pour le jeu complet; aucun n'est imité ici.
- **Pas absents de la démo**: pluie qui tombe sur l'eau, bêtes autres que les poules et celles des moments rares (section 4.5), plan de la maison (crayon, gomme), fêtes, rang atteint.
- **Banque FluidR3_GM**: ses échantillons sont sombres au-dessus de 3 kHz; une correction calculée par la mesure ramène chaque musique vers la même clarté (octave de 4 kHz vers -19 dB).

## 9. Questions ouvertes

| # | Question | Recommandation |
|---|---|---|
| S1 | Mémoire: un samedi en journée demande environ 94 Mo d'audio décodé pour des boucles sans clic, contre 64 Mo prévus (`docs/plateforme/architecture.md`). | Porter le plafond d'audio décodé à 128 Mo pour ce jeu, dans le budget de 1 Go de Duo; sinon, lecture des musiques par segments décodés à la suite (travail du SDK, architecte-technique). |
| S2 | Bus ambiance: le SDK n'en prévoit que trois. | Un quatrième réglage « Ambiance » dans les réglages de Duo; en attendant, un sous-bus des effets. |
| S3 | Réglée au tour 9. | `sons.json` accepte `music` comme bus d'un son (schéma de `catalogue.ts`, type `SoundBus`); `busOf` de `moteur.ts` branche ces sons sur la pause de la musique, après `duck` et `momentDuck`. Test: `src/audio/moteur-bus.test.ts` (vrai moteur, faux contexte qui note les branchements). Sur ce bus: `star-chime-1` à `-5`, `glow-shimmer`, `mist-lift`, `season-turn-*`. |
| S4 | Mémoire des sons permanents: 29,3 Mo décodés pour un plafond de 30 Mo (`memoire.test.ts`); les sons du tour 10 sont donc décodés à la demande (`decodeWhen`). Les petits sons des besoins (`besoins/`, 2,9 Mo décodés) tombent n'importe où: le premier `belly-rumble` ou `reunion-chime` risque de manquer s'il n'est pas demandé à temps. | Porter le plafond des permanents à 33 Mo et ajouter `besoins/` à `residentFolders` (lot L5, `src/audio/reglages.ts` et `memoire.test.ts`); sinon, demander `besoins/` au cache au lancement de la partie, comme l'indique `decodeWhen`. |
| S5 | Les sons du carnet et de l'amitié (`carnet/`, 4,6 Mo décodés) tombent n'importe où et n'importe quand, comme ceux des besoins (S4); le plafond des permanents est plein. | Avec S4: plafond des permanents à 38 Mo, `besoins/` et `carnet/` dans `residentFolders` (lots H3 et L5); sinon, demander les deux au cache au lancement de la partie, comme l'indique `decodeWhen`. |
| S6 | Poids du jeu: 19,6 Mo de sons pour un plafond de 20 Mo (`controler.py`, `POIDS_MAX_MO`); les musiques en font 10. | Porter le plafond à 30 Mo (le jeu entier reste petit pour une application de bureau); sinon, passer les ambiances de qualité Vorbis 2 à 1 (à mesurer). |

## 10. Historique

| Date | Changement |
|---|---|
| 2026-10-31 | Première livraison pour la démo: 9 musiques, 71 sons (121 fichiers), document sonore |
| 2026-10-31 | Pêche jouable dans la démo: cinq sons (`fishing-cast`, `fishing-splash`, `fishing-bite`, `fishing-catch`, `fishing-escape`, 10 fichiers); note du vent rattachée à la zone `forest_edge` de la carte |
| 2026-10-31 | Gauntlet, tour 2 (défauts S1 à S3): famille d'interface « papier et bois » (`ui-focus`, `ui-next`, `ui-tab`, `ui-confirm`, `ui-back`, `ui-panel-open`, `ui-panel-close`), refus doux `ui-refusal`, variantes du tampon (3), du remplissage de l'arrosoir (2) et du coffre (2 et 2); 84 sons, 156 fichiers |
| 2026-10-31 | Gauntlet, tour 6: sons des six moments rares P0 (22 sons, 43 fichiers dans `moments/`, section 4.5) et `bench-sit` (s'asseoir sur un banc, 3 variantes), branché sur `sat_down` à la place de `furniture-place`; 107 sons, 202 fichiers |
| 2026-11-01 | Gauntlet, tour 7: sons de la chevrette du pré, du martin-pêcheur du ponton et de la brume de l'Aubrune (13 sons, 23 fichiers dans `moments/`, préréglage `faune-30` pour l'aboiement); instants du champ `event` recalés sur `donnees/moments.json` (héron, oies, échelle, mésanges); 120 sons, 225 fichiers |
| 2026-11-01 | Gauntlet, tour 9: sons des étoiles de l'Aubrune, du salut du mécanicien, de la dame blanche et des lanternes du quai (16 sons dans `moments/`, plus `owl-far` dans `ambiance/` et `plan.eveningCalls`), chantiers, cadeaux et objets du catalogue (`coins-drop`, et 5 sons dans le nouveau dossier `objets/`), musique `halte-evening` (P1); question S3 réglée: bus musique pour les motifs accordés (étoiles, vers luisants, brume, saisons), avec son test; section 4.7; 157 sons, 11 musiques, 282 fichiers |
| 2026-11-01 | Gauntlet, tour 8: motifs du tournant de saison (`season-turn-*`, 4 couleurs, dossier `saisons/`), ambiances `mist-morning`, `crickets-summer`, `swifts`, `wind-leaves`, `crows` et leurs règles (`plan.ambienceBySeason`), cueillette (`pick-herb`, `pick-mushroom`, `pick-berries`, `pick-nuts`), refus de la hache (`axe-thud-soft`), variation d'été du thème (`halte-ete`, P1); section 4.6; 134 sons, 10 musiques, 249 fichiers |
| 2026-11-01 | Tour 10 (lot L7): sons de la rue Haute et des intérieurs (fournil, salon, portes fermées, chocolat, école, passerelle), motifs d'Achille et de Solange, besoins doux (petit creux, repas à deux, sieste, retrouvailles, coupe remarquée), pièces bâties, rangement, râtelier, rideaux, ambiances du ru et des deux pièces; étouffement du dehors par bâtiment (`plan.interiorByBuilding`) et sources du ru (`plan.stream`); quatre dossiers décodés à la demande (`rue-haute/`, `besoins/`, `maison/`, et `ambiance/`); section 4.8, question S4; 184 sons, 11 musiques, 320 fichiers |
| 2026-11-03 | 0.13 (lots H8 et L4 bis): angélus (tintements et volée des trois cloches, séquence `plan.sequences.angelus`), harmonium (notes et accords), enclume et forge, roue et meules du moulin, vanne du bief, battoir, ricochet, puits et écho, belvédère, pas dans les feuilles, chat (ronron, miaulement), carnet et amitié (`pencil-note`, `bond-chime`, `bond-level`, `birthday-chime`, `decision-agree`), ambiances de la forêt profonde, de la ferme, de la nef et du café, motifs des quatorze habitants nouveaux; intérieurs `church`, `cafe`, `forge`, `mill`; clés `plan.angelus`, `plan.placedLoops`, `plan.ambienceByRegion`; cinq dossiers décodés à la demande (`eglise/`, `metiers/`, `decor/`, `carnet/`, `voisins/`); section 4.9, questions S5 et S6; 225 sons, 11 musiques, 384 fichiers |
