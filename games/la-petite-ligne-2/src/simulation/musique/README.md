# Musique jouée

Cahier 4.5 (instrument: 3, 6 puis tous les airs; il se désaccorde après 20 airs, accordé par Armand ou au diapason) et 4.7 (mini-jeu de rythme à quatre touches, duo). Accordage gardé par le client le 2026-11-11 (q32).

Instrument en main à un endroit où jouer, on ouvre le cahier de fanfare, on choisit un air de la collection, et on le joue sur quatre touches (positions de Q, S, D, F) par-dessus l'accompagnement. Rien n'est punitif: une frappe en l'air ne coûte rien, une note fausse sonne faux et passe, l'air va toujours au bout, et la fin est un mot gentil.

| Fichier         | Rôle                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `reglages.ts`   | toutes les valeurs: touches, fenêtres, aide, décompte, tolérance de l'hôte, mots, duo, auditeurs, chapeau, amitié, son |
| `accord.ts`     | pur: accord d'un instrument (juste, un peu faux, faux), décalage des notes, gain, geste au diapason                    |
| `jugement.ts`   | pur: verdict d'une frappe (juste, tôt, tard, fausse, manquée), décompte, justesse, mot                                 |
| `lecture.ts`    | pur: instrument en main, cahier de fanfare, notes d'une voix, décompte                                                 |
| `local.ts`      | pur: l'air joué sur la machine du joueur (`createPerformance`), robot (`botPresses`)                                   |
| `partenaire.ts` | pur: faire entendre l'autre voix malgré le réseau                                                                      |
| `poste.ts`      | pur: le poste d'un joueur (cahier, attente, air, mot de la fin); l'écran et le son le servent                          |
| `index.ts`      | le système de l'hôte: s'installer, rejoindre, lancer, valider les notes, auditeurs, fin                                |
| `briques.ts`    | brique `perform` (« jouer ici »), inscrite dans `briques/registre.ts`                                                  |
| `valider.ts`    | contrôles croisés des airs et des instruments (appelé par `donnees/valider.ts`)                                        |

Écran: `src/interface/musique/` (démonstration: `demo/index.html?ecran=cahier|attente|jeu|resultat&duo=1&joueur=0|1&t=12`). Son: `src/audio/musique/scene.ts`, timbres dans `donnees/timbres.json`. Test: `tests/musique-jouee.test.ts`.

## Ajouter du contenu (sans toucher à ce dossier)

- **Un air jouable**: `donnees/README.md`, ligne « Air jouable » (gabarit `donnees/_gabarits/air-jouable.jsonc`). Les notes ne s'écrivent jamais à la main: `pnpm partition <id>` les tire du MIDI de l'air.
- **Un instrument**: un objet avec `"instrument": { "timbre": "<timbre>", "tier": 0, "holds": 20 }` (exemples: `cornet.json`, `clarinette.json`). `holds`: sa tenue d'accord en airs (0: ne se désaccorde jamais; absent: `MUSIC.tuning.holdAirs`).
- **Un diapason**: un objet avec `"tuner": { "midi": 69 }` (la note qu'il donne), pile de 1 (exemple: `diapason.json`, plan `commun/plans/diapason.json`). Un timbre nouveau: une entrée de `src/audio/musique/donnees/timbres.json` (harmoniques, enveloppe, vibrato).
- **Un endroit où jouer**: la brique `{ "brick": "perform" }` sur un meuble (l'estrade de la fanfare, le pupitre, le banc). En tête des briques d'un meuble qui sert aussi à autre chose: sans instrument en main elle s'efface (on s'assoit sur le banc).

## Déroulement et messages

1. Touche d'action sur le meuble: `music_opened` (avec les airs appris par le duo). Le premier tient le cahier; l'autre, au même meuble, le rejoint: ce sera un duo.
2. Aide réglable: celle de chaque joueur (`assistFactor(world, player)` de `simulation/aide/`, cran envoyé par `set_assist`). L'hôte la fige au lancement de l'air; la machine du joueur lit la même dans l'état au même instant.
3. Le meneur lance (`music_go`): l'hôte vérifie l'air (appris, à la portée des instruments), fixe le premier temps en pas de simulation et annonce `music_started` (voix de chacun, `startTick`, `startAtMs`).
4. Chaque machine juge ses frappes et envoie chaque note jugée (`music_note`: rang, touche, écart); l'hôte refait le jugement et l'annonce (`music_note`).
5. Celui qui ne joue pas l'entend d'où il est (poste en écoute, sans écran): accompagnement et voix de l'autre, par le même chemin que la voix de l'autre dans un duo (`music_started`, puis `music_note`), plein volume jusqu'à `listen.nearM`, de moins en moins jusqu'à `listen.farM`, plus rien au-delà (`StageSound.level`); la musique du lieu se tait au-dessus de `listen.hushAbove`.
6. Fin (`music_finished`): mot de chacun, mot commun, auditeurs, chapeau, amitié. `music_leave` range l'instrument à tout moment (`music_closed`); s'éloigner ou changer d'objet en main aussi.

Un air en cours n'est ni sauvegardé ni transmis (moins d'une minute, `WeakMap` chez l'hôte). Ce qui reste est en faits de mémoire: `musique.joue.<air>` (meilleur mot du duo), `musique.chapeau.j<n>` (jour du dernier chapeau), `habitants.<id>.concert.j<n>` (dernier jour d'écoute). Ni la sauvegarde ni l'état transmis ne changent de forme.

## Horloge et duo en réseau: le choix

1. Rien ne se joue « à l'arrivée d'un message »: à 50 ms de latence, deux voix seraient toujours décalées.
2. La machine qui lance propose le premier temps sur l'heure de session commune du SDK (`net.sessionTimeMs`), après un décompte de 2,4 s au moins: l'annonce a le temps d'arriver, et les deux machines font partir l'accompagnement au même instant.
3. L'hôte, lui, tient l'horloge de l'air en pas de simulation (`startTick`): elle fait foi pour valider. Une note annoncée plus de 0,7 s avant ou 1,8 s après son heure d'hôte est comptée manquée.
4. Chaque machine convertit le premier temps en instant de son contexte audio tel qu'il est entendu (`getOutputTimestamp`, sortie de la carte son comprise) et date ses frappes sur cette même horloge: le jugement ne dépend ni du réseau ni de la carte son.
5. Le verdict est refait par l'hôte avec ses réglages (fenêtres, aide du joueur, bonus des besoins): même calcul pour l'hôte et l'invité, aucun avantage à héberger.
6. La voix de l'autre est programmée d'avance à ses instants écrits, sur l'horloge locale, tant que son dernier verdict connu n'est pas « manquée »: elle tombe donc exactement en mesure.
7. Les verdicts qui arrivent ensuite corrigent: une note fausse déjà partie s'affaisse (couac), une note manquée fait taire la voix jusqu'à la prochaine réussie, une note réussie apprise moins de 180 ms trop tard se joue encore.
8. Ce qu'on entend de l'autre a donc une note de retard sur ses silences et ses reprises, jamais sur sa mise en place: c'est le prix d'un duo qui sonne ensemble.
9. L'aide se lit dans l'état du joueur (`players[i].assist`), le même chez l'hôte et l'invité; l'album des collections ne voyageant pas vers l'invité, les airs appris sont annoncés dans `music_opened`.
10. Test: `tests/musique-jouee.test.ts`, « réseau à 50 ms » (mêmes verdicts des deux côtés, voix de l'autre programmée à l'heure).

## Récompenses (proposition du studio, réglable)

- Mot de 0 à 3 selon la justesse (juste 1, presque 0,8, fausse 0,3, manquée 0). À deux, le mot commun est celui du moins assuré.
- Auditeurs: les habitants à moins de 9 m s'arrêtent et regardent le joueur (`habitants/ecoute.ts`); il faut 6 s d'écoute pour compter.
- Chapeau: 0, 20, 35 ou 50 centimes par auditeur selon le mot, 4 € au plus, une fois par jour et par joueur. Amitié: 1 à 4 points par auditeur, une fois par jour, par joueur et par habitant.
- Duo réussi ensemble (chacun au moins « Joli ! »): chapeau et amitié de chacun multipliés par 1,5 (R12).

## Accord (cahier 4.5)

- Un instrument ne s'use pas, il se désaccorde: juste pendant sa tenue (`holds`, 20 airs), puis « un peu faux », puis « faux » au fil de `MUSIC.tuning.slideAirs` (8) airs. Toutes ses notes descendent de 20 puis jusqu'à 60 cents (`MUSIC.tuning.cents`), chez soi et chez l'autre (`StageSound.note`, champ `cents`). Il reste jouable: le jugement des notes ne change pas.
- Ce qu'il rapporte: chapeau et amitié des auditeurs multipliés par `MUSIC.tuning.reward` (1; 0,8; 0,6), au moins un point d'amitié. Le mot de la fin porte une phrase gentille des auditeurs (`interface/musique/textes.ts`, `tuneListeners`).
- État: l'accord qui reste, en airs, dans le champ `wear` de la pile (le même que l'usure des outils: un instrument n'a jamais de bloc `tool`). Absent: juste (instrument neuf, accordé, ou d'une partie d'avant). Il baisse d'un cran à chaque air allé au bout. Ni la sauvegarde ni l'état transmis ne changent de forme.
- Chez Armand: son dialogue `armand-accordage` paraît quand celui qui lui parle porte un instrument désaccordé (condition `instrument_out_of_tune`), l'accorde gratuitement (effet `tune_instrument`, tous les instruments portés) et, la première fois, donne le plan du diapason (établi, une planche).
- Au diapason: cahier ouvert, entre deux airs, avec un diapason dans ses poches ou tenu en main par l'autre à `pairReach` (3 m) ou moins. Touche A (position Q): on tient Espace, la note glisse vers celle du diapason (plus vite de loin, lentement tout près) et le battement entre les deux ralentit puis se tait; on lâche là. Lâcher trop tôt ne coûte rien. Tolérance: 3 cents, multipliée par l'aide du joueur (`assistFactor`) et par 1,5 quand l'autre tient le diapason. Repère visuel: un anneau qui palpite au rythme du battement (taille fixe en mouvement réduit). La machine annonce l'écart au lâcher (`music_tune`); l'hôte vérifie instrument, diapason et tolérance (refus `need-tuner` sans diapason).
- Le mot (« juste », « un peu faux », « faux »): dans le cahier de fanfare, à côté de l'instrument, avec une ligne qui dit où l'accorder; dans le sac, en étiquette sur la case et dans la fiche de l'objet.
- Test: `tests/musique-accord.test.ts`. Démonstration: `demo/index.html?ecran=cahier&faux=1`, `?ecran=accord&t=1.5`, `?ecran=resultat&faux=1`.
