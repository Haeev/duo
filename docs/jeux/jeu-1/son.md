# La Petite Ligne: document sonore (démo d'une heure)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | première livraison, pour la démo (`docs/jeux/jeu-1/demo.md`, section 4.2) |
| Dernière mise à jour | 2026-10-31 |
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
| Samedi, train à quai (10 h à 16 h) | `musique/samedi.ogg` | do majeur, 4/4, 120 | 80 s (40) | accordéon, clarinette, guitare, contrebasse, tambourin | oui |
| Veillée (dès 19 h, les deux dans la maison) | `musique/veillee.ogg` | ré majeur, 3/4, 72 | 100 s (40) | clarinette et flûte en duo, guitare seule, violoncelle | oui |
| Écran de nuit (les deux couchés) | `musique/nuit.ogg` | fa majeur, 3/4, 60 | 84 s (28) | harpe, célesta, flûte, cordes | oui |
| Le train s'arrête au quai | `musique/fanfare-train.ogg` | do majeur, 4/4, 112 | 13 s | trompette, cor, accordéon, tuba, glockenspiel | non, une fois |
| Le train du jour 8 est parti: récapitulatif, fin | `musique/fin.ogg` | sol majeur, 6/8, 84 | 44 s | flûte, clarinette, guitare, cordes, harpe, cor | non, une fois |

- **Matin et après-midi** partagent tempo, tonalité, grille et longueur: le motif de la Halte à la flûte le matin (plus clair, harpe et cordes), à la clarinette l'après-midi (plus chaud, accordéon et violoncelle). On passe de l'un à l'autre pendant un silence de repos (section 3.2), ou en fondu enchaîné à la même position de lecture.
- **Veillée, pour deux**: la clarinette chante, la flûte répond, puis elles chantent ensemble en tierces; une seule guitare les accompagne. Les deux voix sont les deux joueurs.
- **Petit-déjeuner**: le basson pose la question en sautillant, la clarinette répond: tendre et un peu drôle.
- Les partitions sont versionnées en MIDI (`assets-src/son/midi/*.mid`) et rendues par FluidSynth avec la banque General MIDI FluidR3_GM (licence MIT, à inscrire dans `CREDITS.md`).

## 3. Règles de lecture

### 3.1 Bus et mixage

| Bus | Identifiant | Volume par défaut | Contenu |
|---|---|---|---|
| Musique | `music` | 0,8 | les neuf musiques |
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

### 3.4 Le train, battement de cœur du jeu

Le sifflet s'entend dans toute la vallée (TE-05). Deux versions: `train-whistle`, placé sur la locomotive quand le joueur est à moins de 40 m du quai (jamais sous -14 dB); `train-whistle-far`, non placé, avec l'écho des coteaux, partout ailleurs. Séquences dans `plan.sequences`:

| Arrivée (la locomotive est au quai à 14 s) | Départ de 16 h |
|---|---|
| 0 s sifflet, 0,4 s approche (14 s), 11 s cloche du quai, 14 s freinage, 18,3 s jet de vapeur, 18,6 s fanfare, 19 s locomotive à l'arrêt (boucle jusqu'au départ), 32 s musique du samedi | 0 s cloche du quai, 2,2 s sifflet à roulette de Firmin, 3,8 s sifflet du train, 4,6 s fin de la boucle d'attente et départ (16 s, le train s'éloigne), 6 s la musique du samedi s'efface en 4 s |

Pour que le train soit au quai à 10 h pile, la séquence d'arrivée démarre 14 s de temps réel avant (soit 40 minutes de jeu à 0,35 s la minute).

## 4. Effets, événement par événement

Niveau: sonie momentanée maximale visée en LUFS (intégrée pour une boucle), mesurée dans `assets-src/son/controles/mesures.csv`. Écoute: modèle « inverse » du `PannerNode` (distance de référence, facteur 0,5 à 1,3 selon le son); « coupé au-delà » veut dire qu'on ne lance pas le son, « jamais sous » qu'on garantit un niveau plancher où que soit la source.

TABLEAUX_EFFETS

## 5. Les habitants

Un motif de 2 à 4 s par habitant, joué à l'ouverture d'une conversation chez celui qui parle (musique à -8 dB, 4 s au moins entre deux motifs du même habitant). Tous en sol majeur, comme le thème qu'ils interrompent.

| Habitant | Motif | Ce qu'il dit du caractère |
|---|---|---|
| Odette Ferrand, épicière | accordéon qui sautille, pizzicati, et un petit rire en trille à la fin | gourmande, bavarde, rieuse |
| Firmin Lacombe, chef de halte | la pendule de la halte (tic-tac), deux notes bougonnes du basson, puis un accord tendre du cor | bourru, ponctuel, tendre |
| Basile Cornu, menuisier | trois notes de marimba (du bois), lentes, sur un violoncelle | taiseux, patient |
| Jeanne Ribot, dix ans | la flûte à bec qui monte et reste en l'air sur la sixte, comme une question, et un trille d'oiseau | intrépide, mille questions, les oiseaux |
| Lucie Arnaud, factrice (seulement citée dans la démo) | la flûte qui file en gamme, et la sonnette de son vélo | curieuse, pressée |

## 6. Intégration technique

- **Formats**: Ogg Vorbis 48 kHz; musiques en stéréo (qualité 3, environ 110 kbit/s), ambiances mono (qualité 2), effets placés mono (pour le `PannerNode`), interface et airs en stéréo (qualité 4). Poids total: 10,8 Mo (budget visé: 20 Mo).
- **Boucles**: chaque fichier de boucle porte une amorce de chaque côté (la fin de la boucle avant, son début après: 1 s pour les musiques, 0,4 à 0,5 s pour les autres). Jouer avec `AudioBufferSourceNode`: `loop = true`, `loopStart` et `loopEnd` lus dans `loop.startSeconds` et `loop.endSeconds`, départ à `playFromSeconds` (pour une musique, le premier temps, 0,12 s après le début de la boucle: le raccord tombe entre deux notes).
- **Pas de lecture en flux pour les boucles**: mesuré dans Chromium, `<audio loop>` insère 128 à 256 échantillons de silence (2,7 à 5,3 ms) à chaque tour, un clic audible sur une musique. Les boucles doivent être décodées (`decodeAudioData`).
- **Mémoire décodée** (float32 à 48 kHz): effets placés 9,1 Mo, interface 10,6 Mo, motifs 5,6 Mo, train 13,0 Mo, ambiances 33,8 Mo si toutes chargées (jour: rivière, vent, oiseaux, bourg 23,8 Mo; soir: 13 Mo), une musique de 28 à 39 Mo. Chargement conseillé: effets, interface et motifs en permanence (25 Mo); une seule musique décodée à la fois (libérée après son fondu ou pendant le repos); ambiances selon l'heure; train le samedi seulement. Pic d'un samedi en journée: environ 94 Mo, au-dessus des 64 Mo d'audio décodé prévus par l'architecture (question ouverte, section 9).
- **Hauteur**: la variation se fait par `playbackRate` (elle change aussi un peu la durée, voulu).
- **Rien n'est joué deux fois au même instant**: `minIntervalMs` évite les doublons (deux joueurs qui récoltent ensemble, double clic) et `maxVoices` borne les répétitions d'un même son.
- `sons.json` est généré par `generer.py`: ne pas le modifier à la main; tout réglage passe par les sources.

## 7. Contrôles (sans écouter)

- `duo-python games/la-petite-ligne/assets-src/son/generer.py` régénère tout (environ 6 minutes) puis lance `controler.py`: sonie et crête vraie de chaque fichier par le filtre `ebur128` de ffmpeg après décodage (aucune crête au-dessus de -1,5 dBTP, aucun échantillon écrêté), silence en tête des effets (2,6 ms au plus), longueur exacte et raccord de chaque boucle (saut et seconde différence comparés à leur distribution dans le fichier, niveau au raccord comparé aux variations internes), poids du jeu.
- `node games/la-petite-ligne/assets-src/son/verifier-chromium.cjs` (Playwright): les 121 fichiers se décodent dans Chromium; chaque boucle, décodée à 48 et 44,1 kHz puis réellement jouée en boucle dans un `OfflineAudioContext`, passe le raccord sans saut.
- Avant le rendu, un contrôle de l'écriture bloque toute musique où deux instruments tiennent ensemble une seconde mineure, une septième majeure ou un triton hors de l'accord (il a corrigé deux fautes d'harmonie pendant la production).
- Les spectrogrammes et formes d'onde (`controler.py --images DOSSIER`) ont été examinés pour chaque famille de sons.

## 8. Écarts et limites

- **Voix**: ni « hop », ni souffle de l'effort, ni bâillement, ni rire d'habitant (aucune voix enregistrée ni synthétisée, cahier 6.12): remplacés par des sons d'instruments et d'objets.
- **Qualité « superbe »**: livrée (`quality-superb`) bien qu'absente de la démo.
- **Lucie**: son motif est livré, bien qu'elle soit seulement citée dans la démo.
- **Oiseaux**: génériques (trille, « tsip », phrase flûtée, « ti-tu », coucou et pigeon ramier au loin). Les chants des 24 espèces du carnet restent à faire pour le jeu complet; aucun n'est imité ici.
- **Pas absents de la démo**: pêche (P1), pluie qui tombe sur l'eau, bêtes autres que les poules, plan de la maison (crayon, gomme), fêtes, rang atteint.
- **Banque FluidR3_GM**: ses échantillons sont sombres au-dessus de 3 kHz; une correction calculée par la mesure ramène chaque musique vers la même clarté (octave de 4 kHz vers -19 dB).

## 9. Questions ouvertes

| # | Question | Recommandation |
|---|---|---|
| S1 | Mémoire: un samedi en journée demande environ 94 Mo d'audio décodé pour des boucles sans clic, contre 64 Mo prévus (`docs/plateforme/architecture.md`). | Porter le plafond d'audio décodé à 128 Mo pour ce jeu, dans le budget de 1 Go de Duo; sinon, lecture des musiques par segments décodés à la suite (travail du SDK, architecte-technique). |
| S2 | Bus ambiance: le SDK n'en prévoit que trois. | Un quatrième réglage « Ambiance » dans les réglages de Duo; en attendant, un sous-bus des effets. |

## 10. Historique

| Date | Changement |
|---|---|
| 2026-10-31 | Première livraison pour la démo: 9 musiques, 71 sons (121 fichiers), document sonore |
