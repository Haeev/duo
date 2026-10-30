# Identité sonore de Duo: « Étoile double »

| Champ | Valeur |
|---|---|
| Statut | proposition, à écouter et valider par le client |
| Version | 0.1 |
| Date | 2026-10-30 |
| Auteur | sound-designer |
| Fichiers | `design/son/plateforme/` (OGG pour l'application, copies M4A, planche `ecoute.m4a`, définitions `sons.json`) |
| Régénérer | `duo-python design/son/plateforme/sources/generer.py` (environ 1 min 30, contrôle compris) |
| Liens | piste B dans `identite-visuelle-pistes.md`, F10 dans `cahier-des-charges.md`, événements dans `ux/parcours.md` |

> Les sons de la plateforme Duo: interface, présence de l'autre ordinateur, salon, pause, connexion, fins de partie, et la musique d'ambiance des écrans hors partie. Tout est synthétisé par le studio (aucune banque de sons, aucune ressource externe): rien à inscrire dans `CREDITS.md`.

## 1. Intention

La piste B raconte deux astres qui se trouvent dans la nuit et tournent ensemble. Le son reprend cette image en quatre idées.

1. **Deux voix.** Ta voix est une célesta de verre: frappée, claire, un peu à gauche. Celle de l'autre ordinateur est une harpe de verre: pincée, plus ronde, un peu à droite, comme son pseudo à l'écran. On sait qui a fait quoi sans regarder.
2. **S'accorder.** Le geste signature: deux notes tenues d'harmonica de verre, d'abord légèrement désaccordées (on entend des battements, comme deux instruments qui s'accordent), qui se posent sur la même hauteur. C'est le son de « l'autre ordinateur est là ». À l'inverse, quand la connexion se perd, les deux notes se désaccordent et s'éloignent; quand elle revient, elles se retrouvent.
3. **La nuit.** Rien de sec ni de lourd: attaques douces, aucun grave sous les sons d'interface, aigus adoucis, une réverbération de salle calme où chaque son s'éteint lentement. La musique est une nappe lente qui flotte.
4. **Une soirée entière.** Les gestes fréquents (focus, valider, retour) sont brefs et discrets, avec des variantes contre la lassitude. La mélodie et l'ampleur sont réservées aux moments rares: invitation, départ, fin de partie.

## 2. Palette sonore

### 2.1 Timbres

| Timbre | Fabrication | Rôle |
|---|---|---|
| Célesta de verre | partiels d'une lame frappée (fondamental, 2, 2,756, 5,404), contact du maillet en souffle de 6 ms | ta voix, et celle de Duo (navigation, décompte, notifications) |
| Harpe de verre | corde pincée additive, harmoniques en 1/k^1,3 qui s'éteignent d'autant plus vite qu'elles montent | la voix de l'autre ordinateur |
| Harmonica de verre | son tenu presque pur, dont la hauteur peut glisser | les deux astres qui s'accordent (présence, connexion) |
| Maillet de feutre | presque un sinus, très mat, bref | erreur douce, décompte annulé, appui grave du décompte |
| Nappe chaude | dents de scie additives désaccordées, passe-bas doux, réparties en stéréo | le ciel: une lueur discrète sous les annonces, le fond de la musique |

### 2.2 Tonalité et motifs

- **Ré.** Tous les sons d'interface utilisent la gamme pentatonique de ré majeur (ré, mi, fa dièse, la, si): aucun intervalle dur, deux sons qui se chevauchent restent consonants entre eux et avec la musique.
- **Musique en ré lydien**: ré majeur avec un sol dièse (la quarte augmentée), une harmonie qui flotte sans cadence appuyée, idéale pour une boucle qu'on ne sent pas recommencer.
- **Sens des gestes**: ce qui monte avance (valider, « C'est parti ! », reprise); ce qui descend recule ou se suspend (retour, pause, « Pas encore »). L'erreur douce est une petite tierce mineure qui descend (ré, si) au maillet de feutre: un « hm hm », jamais un buzzer. L'invitation est un arpège qui finit sur mi, la neuvième: une question.

### 2.3 Registre et stéréo

- Fondamentales des sons d'interface entre la 4 (440 Hz) et si 6 (1 976 Hz); l'essentiel de l'énergie entre 500 Hz et 4 kHz, là où les haut-parleurs d'un portable rendent bien. Rien sous 120 Hz (coupé), aigus adoucis de 3 dB au-dessus de 6 kHz.
- Musique: nappe et basse entre 50 Hz et 1 kHz, mélodies entre 500 Hz et 1,5 kHz, quelques « étoiles » plus haut. Spectre volontairement sombre (nuit, confort), mesuré par octave par rapport à celle de 1 kHz: 63 Hz -6 dB, 250 et 500 Hz 0 dB, 2 kHz -7 dB, 4 kHz -21 dB, 8 kHz -34 dB.
- Stéréo discrète, inscrite dans les fichiers: toi légèrement à gauche (panoramique -0,1), l'autre à droite (+0,35), comme la convention « toi à gauche, l'autre à droite » de l'interface. Au casque, la position s'entend; sur des haut-parleurs de portable, c'est le timbre (verre frappé ou harpe) qui distingue.

## 3. Événements et sons

Fichiers dans `design/son/plateforme/ogg/`, à 48 kHz, en stéréo. Copies d'écoute M4A numérotées comme le tableau dans `m4a/` (par exemple `m4a/08-invitation.m4a`). Durée: longueur du fichier, queue de réverbération comprise (le son perçu est plus court). Sonie: sonie momentanée maximale mesurée par ffmpeg `ebur128` sur le fichier OGG décodé (section 5.5). Priorité: 1 critique, 2 important, 3 courant, 4 discret.

| N° | Événement | Ce qu'on entend | Fichiers (`ogg/`) | Bus | Priorité | Durée | Sonie | Variations |
|---|---|---|---|---|---|---|---|---|
| 01 | Déplacement du focus au clavier (Tab, flèches) | un tic de verre très bref sur mi | `focus-1` à `focus-3` | interface | 4 | 0,53 à 0,55 s (perçu 0,1 s) | -28,0 à -28,5 LUFS | 3 variantes; hauteur ±3 %, gain ±1,5 dB; relancé, 45 ms au moins entre deux |
| 02 | Validation (Entrée, Espace, clic sur un bouton) | deux notes de verre qui montent (la, mi), ta voix | `confirm-1` à `confirm-3` | interface | 3 | 0,89 à 0,93 s | -17,9 à -18,0 LUFS | 3 variantes; hauteur ±1,5 %, gain ±1 dB; 80 ms |
| 03 | Retour (Échap, Retour, fermeture d'un panneau) | les mêmes notes qui descendent (mi, la), plus mates | `back-1` à `back-3` | interface | 3 | 0,89 à 0,92 s | -19,0 à -19,1 LUFS | 3 variantes; hauteur ±1,5 %, gain ±1 dB; 80 ms |
| 04 | Erreur douce (caractère refusé, champ vide, action impossible) | deux coups de feutre qui descendent (ré, si) | `error-1`, `error-2` | interface | 3 | 1,05 à 1,06 s | -18,9 à -19,0 LUFS | 2 variantes; hauteur ±1 %, gain ±1 dB; 250 ms |
| 05 | Notification (voir 3.1) | deux notes de verre douces (fa dièse, la) | `notify-1`, `notify-2` | interface | 3 | 1,05 s | -19,0 LUFS | 2 variantes; hauteur ±1 %, gain ±1 dB; 400 ms |
| 06 | Essai de volume (curseurs de Réglages > Son) | une note de verre (la), toujours la même | `volume-test` | celui du curseur réglé (interface par défaut) | 3 | 0,90 s | -18,0 LUFS | aucune (référence de niveau); relancé, 60 ms |
| 07 | L'autre joueur est là (l'autre ordinateur apparaît) | deux notes d'harmonica qui s'accordent, puis la quinte de l'autre à la harpe | `peer-here` | interface | 2 | 2,67 s | -16,0 LUFS | aucune; 5 s |
| 08 | Invitation reçue (bandeau d'invitation) | arpège montant à la harpe (ré, fa dièse, la, mi) et son écho, sur une lueur | `invite` | interface | 1 | 2,25 s | -15,1 LUFS | aucune; 3 s |
| 09 | « C'est parti ! » chez toi | arpège de verre montant (la, ré, fa dièse), ta voix | `ready-self` | interface | 2 | 1,22 s | -18,0 LUFS | aucune; 300 ms |
| 10 | « C'est parti ! » chez l'autre, ou l'autre rejoint le salon | le même arpège une octave plus bas, à la harpe, à droite | `ready-peer` | interface | 2 | 1,24 s | -18,0 LUFS | aucune; 300 ms |
| 11 | L'autre repasse à « Pas encore » ou quitte le salon | l'arpège de l'autre qui redescend, assourdi | `not-ready-peer` | interface | 3 | 1,12 s | -19,0 LUFS | aucune; 300 ms |
| 12 | Décompte 3, 2, 1 (départ et « Reprise dans 3 ») | un tintement de verre sur la, appuyé au feutre | `countdown-tick` | interface | 2 | 0,84 s | -18,0 LUFS | aucune (joué 3 fois, une par seconde); 500 ms |
| 13 | Départ de la partie (fin du décompte) | tes notes et celles de l'autre ensemble, sur un accord de ré qui s'ouvre | `countdown-go` | interface | 2 | 2,31 s | -16,0 LUFS | aucune; 1 s |
| 14 | Décompte annulé (« Pas encore » ou Échap, d'un côté ou de l'autre) | deux coups de feutre qui descendent (la, mi) et s'assourdissent | `countdown-cancel` | interface | 2 | 0,98 s | -19,0 LUFS | aucune; 500 ms |
| 15 | Pause (Échap en partie, chez l'un ou l'autre) | deux notes qui descendent (ré, la) pendant qu'un filtre se referme | `pause` | interface | 2 | 1,13 s | -18,0 LUFS | aucune; 500 ms |
| 16 | Reprise (fin du décompte « Reprise dans 3 ») | le geste inverse: trois notes qui montent, le filtre s'ouvre | `resume` | interface | 2 | 1,15 s | -18,1 LUFS | aucune; 500 ms |
| 17 | Connexion perdue (superposition E12, cartes du salon) | les deux notes accordées se séparent; l'autre descend à la harpe | `connection-lost` | interface | 1 | 2,20 s | -15,0 LUFS | aucune; 5 s |
| 18 | Connexion retrouvée (« Sacha est de retour ») | les deux notes se réaccordent, puis tes notes et les siennes montent | `connection-back` | interface | 2 | 2,61 s | -16,0 LUFS | aucune; 5 s |
| 19 | Fin de partie: « Tu as gagné ! » | une gamme de verre qui monte, puis un accord clair, ta voix | `end-win` | interface | 2 | 2,87 s | -15,0 LUFS | aucune |
| 20 | Fin de partie: « Sacha a gagné » | la même gamme à la harpe, plus grave et plus douce: on salue l'autre | `end-peer-win` | interface | 2 | 2,85 s | -17,0 LUFS | aucune |
| 21 | Fin de partie: « Égalité ! » | vos deux voix sur la même note, puis à l'octave, côte à côte | `end-draw` | interface | 2 | 2,52 s | -16,0 LUFS | aucune |
| 22 | Fin de partie: « Vous avez réussi ! » (coopération) | question et réponse entre tes notes et les siennes, puis le ciel s'ouvre | `end-success` | interface | 2 | 3,57 s | -15,1 LUFS | aucune |
| 23 | Fin de partie: « Pas cette fois » (coopération) | une descente lente qui se pose sur ré majeur: « ce n'est rien » | `end-fail` | interface | 2 | 3,25 s | -17,0 LUFS | aucune |
| 24 | Nouveau jeu disponible (notification « Nouveau jeu ») | une étoile filante: pluie de petites notes de verre de gauche à droite | `new-game` | interface | 2 | 2,02 s | -16,1 LUFS | aucune; 3 s |
| 25 | Ambiance des écrans hors partie | « Deux astres », boucle de 64 s (section 6) | `lounge` | musique | sans objet | 64 s (66 s avec l'amorce) | -21,1 LUFS intégrés | aucune |

Les sons mélodiques (07 à 24) ne varient pas: ils doivent rester justes avec la musique et reconnaissables d'une fois sur l'autre. Les colonnes Bus, Priorité, Variations et intervalles minimaux sont aussi dans `sons.json`, lu par le module audio.

### 3.1 Événements qui reprennent un son

| Événement (texte de `ux/parcours.md`) | Son |
|---|---|
| « Veut reprendre », « Veut rejouer », « Veut continuer » chez toi | `ready-self` |
| Les mêmes chez l'autre; « Sacha a rejoint le salon » (rejoindre vaut « C'est parti ») | `ready-peer` |
| « Pas encore » chez toi (bascule du bouton) | `back` |
| « Sacha a quitté le salon. » | `not-ready-peer` |
| « Reprise dans 3 » | `countdown-tick` à chaque chiffre, puis `resume` |
| « Sacha a demandé d'attendre. » (décompte annulé par l'autre) | `countdown-cancel`, sur les deux ordinateurs |
| « Sacha vient d'arriver sur le réseau. », E04 « Sacha est là » | `peer-here` |
| « Camille a choisi une autre sauvegarde. », « … un autre jeu », « Camille a fermé le salon. », « Camille a arrêté la partie. », « Ton salon est fermé : tu as rejoint celui de Sacha. », copies de sauvegarde différentes, « Autorisation déjà accordée. », « Jeu témoin a été mis à jour (version 1.1). » | `notify` |
| Fenêtres d'échec (impossible de rejoindre, échec du chargement, E13 « Le jeu s'est arrêté »), rapport impossible à enregistrer, disque plein | `error` |
| Connexion perdue dans le salon (cartes « Connexion perdue ») | `connection-lost`; au retour, `connection-back` |
| Réglages > Son, curseur Musique quand aucune musique ne joue | `volume-test` sur le bus Musique (sinon la musique en cours suffit) |

### 3.2 Silences voulus

Pas de son pour: la saisie dans un champ de texte, les changements d'écran et les fondus, le survol à la souris, le focus placé par le programme (ouverture d'un écran ou d'une fenêtre, retour du focus après fermeture), les indicateurs « Enregistré » et « Progression enregistrée », l'écran de chargement, une touche ignorée par l'anti-double-appui, Échap sans effet (accueil, connexion perdue). Le silence fait partie du calme de la piste B.

## 4. Règles de lecture

1. **Un seul son par action.** Quand un bouton déclenche un événement qui a son propre son, celui-ci remplace la validation: Entrée sur « C'est parti ! » joue `ready-self`, pas `confirm`; « Pas encore » pendant le décompte joue `countdown-cancel` seul.
2. **Focus.** Seulement quand le joueur déplace le focus au clavier. Relancé, pas empilé: un nouveau focus coupe le précédent par un fondu de 15 ms; 45 ms au moins entre deux, ce qui suffit pour une flèche maintenue (répétition automatique).
3. **Variantes et variations.** Tirage au hasard sans répéter la variante précédente; variation de la vitesse de lecture (`playbackRate`, donc hauteur et durée) et du gain dans les bornes du tableau.
4. **Intervalle minimal par son**: une seconde demande plus rapprochée est ignorée. Il absorbe les doublons (message réseau répété, double appui).
5. **Polyphonie.** Six sons d'interface au plus en même temps; au-delà, on coupe le plus ancien parmi les plus faibles priorités. Un son de priorité 4 ne démarre pas pendant les 200 premières millisecondes d'un son de priorité 1 ou 2.
6. **Sons venus de l'autre ordinateur** (`ready-peer`, `not-ready-peer`, pause demandée par l'autre): joués à la réception du message, sans compenser la latence du réseau local (quelques millisecondes). Chaque ordinateur joue son décompte au rythme de son propre affichage.
7. **Décodage.** Les sons d'interface sont décodés à l'avance (`decodeAudioData`), une fois: environ 19 Mo en mémoire pour l'ensemble à 48 kHz (49 s de son), dont 6 Mo pour les fins de partie, qui peuvent n'être décodées qu'au lancement de la partie. Chaque lecture crée un `AudioBufferSourceNode` léger.
8. **Contexte audio.** Un seul `AudioContext` par vue (la plateforme a le sien, chaque jeu le sien par le SDK), créé à 48 kHz: `new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })`. Les fichiers sont à 48 kHz: aucun rééchantillonnage au décodage, et la sortie est convertie par le système si la carte son tourne à 44,1 kHz. Electron joue sans geste préalable de l'utilisateur (vérifié par architecte-technique, `architecture.md` section 4.5).

## 5. Mixage et niveaux

### 5.1 Bus

```text
source -> variation de gain -> bus Interface | Effets | Musique (volume de la catégorie)
       -> bus Général (volume général) -> limiteur -> sortie
```

- **Interface**: tous les sons de ce document, et les menus propres aux jeux.
- **Effets**: les sons de jeu. La plateforme n'y joue rien. Les ambiances des jeux (vent, pluie, village) passent aussi par Effets: F10 ne prévoit pas de curseur Ambiance.
- **Musique**: la boucle du salon et les musiques des jeux.
- Réglages enregistrés dans `sons.json`, bloc `mix`, pour que le module audio les lise au lieu de les coder en dur.

### 5.2 Courbe des curseurs (F10)

- Gain d'un curseur = (v / 100)², pour v de 0 à 100 % par pas de 5 %: 50 % donne -12 dB, 25 % -24 dB, 5 % -52 dB, 0 % coupé. Une courbe linéaire laisserait presque toute la plage utile dans le bas du curseur (50 % ne ferait que -6 dB).
- Gain effectif d'une catégorie = gain(général) × gain(catégorie): c'est le produit demandé par H-22 et CA-PF-069, appliqué aux gains de la courbe. À confirmer avec qa-testeur, car le critère parle de « volume général × volume de la catégorie ».
- Changement appliqué par une rampe de 50 ms (`setTargetAtTime`), sans clic, sous les 100 ms de CA-PF-069.

### 5.3 Limiteur et atténuation de la musique

- **Limiteur** sur le bus Général: `DynamicsCompressorNode`, seuil -3 dB, genou 0, rapport 20, attaque 3 ms, relâche 250 ms. Avec les niveaux des fichiers, il ne travaille que si plusieurs annonces se superposent à la musique.
- **Atténuation de la musique** pendant les sons du palier « annonce » (5.5): -6 dB, et -8 dB pour l'invitation et la connexion perdue (priorité 1); attaque 80 ms, maintien pendant le son, relâche 700 ms (valeur `duckMusicDb` de chaque son dans `sons.json`). Les réponses et le focus n'atténuent pas la musique: ils sont brefs et passent au-dessus.

### 5.4 Par-dessus un jeu

- La plateforme (superpositions) et le jeu ont chacun leur `AudioContext` et leur limiteur; le système additionne les deux. La plateforme transmet les quatre volumes au SDK du jeu (prévu en section 6.4 de `architecture.md`).
- **Pause et connexion perdue**: le SDK baisse la musique du jeu de 10 dB et la passe dans un passe-bas à 1,2 kHz en 300 ms, « la nuit tombe »; les effets s'arrêtent avec la partie figée. Retour en 300 ms à la fin du décompte de reprise.
- Les sons de la plateforme qui jouent par-dessus un jeu arrivent donc quand sa musique est déjà atténuée et filtrée: pas de saturation à l'addition, pas de conflit de tonalité audible.

### 5.5 Niveaux

| Palier | Sons | Sonie momentanée maximale | Crête vraie mesurée |
|---|---|---|---|
| Discret | focus | -28 LUFS | -10,7 dBTP au plus |
| Réponse | valider, retour, erreur, notification, essai de volume, « C'est parti ! », « Pas encore », décompte, décompte annulé, pause, reprise | -18 à -19 LUFS | -4,8 dBTP au plus |
| Annonce | l'autre est là, invitation, départ, connexion perdue et retrouvée, fins de partie, nouveau jeu | -15 à -17 LUFS | -5,5 dBTP au plus |
| Musique du salon | boucle « Deux astres » | -21,1 LUFS intégrés (momentanée maximale -17,3; court terme maximal -19,6; plage de sonie 2,2 LU) | -8,4 dBTP |

- **Pourquoi la sonie momentanée maximale** pour les sons d'interface: sur un son bref, la sonie intégrée dépend surtout de sa longueur; la fenêtre de 400 ms mesure l'attaque telle qu'on l'entend. Le tic de focus (50 ms utiles) est mesuré plus bas qu'il n'est perçu, son énergie étant répartie sur la fenêtre: d'où -28 LUFS.
- **Repère commun aux jeux**: musiques à -16 LUFS intégrés (règle du studio). La boucle du salon est 5 LU plus bas, par choix: c'est un fond sur lequel on parle, les sons d'interface passent au-dessus sans effort, et l'entrée dans un jeu donne un léger élan.
- **Crêtes**: toutes sous -1 dBTP, la plus haute à -4,2 dBTP (copie M4A du décompte). Aucun échantillon écrêté dans les 67 fichiers.
- **Mesure**: `ffmpeg -i fichier -af apad=pad_dur=1,ebur128=peak=true -f null -`; résultats par fichier dans `design/son/plateforme/controles/mesures.csv`.

## 6. Musique du salon: « Deux astres »

### 6.1 Écriture

- Ré lydien, 60 battements par minute, 16 mesures à 4 temps: exactement 64 s (3 072 000 échantillons à 48 kHz, 2 822 400 à 44,1 kHz).
- Un accord toutes les deux mesures, sans cadence appuyée:

| Mesures | Accord |
|---|---|
| 1-2 | ré majeur 9 |
| 3-4 | mi sur ré (la couleur lydienne) |
| 5-6 | si mineur 9 |
| 7-8 | la avec neuvième |
| 9-10 | ré majeur 9, autre position |
| 11-12 | mi sur ré |
| 13-14 | fa dièse mineur 9 |
| 15-16 | la suspendu, qui ramène au début |

- **Les deux voix**: la célesta (ta voix, à gauche) appelle dans les mesures 1 à 4, la harpe (l'autre, à droite) répond dans les mesures 5 à 8; la célesta rappelle un peu plus haut (9 à 12); dans les quatre dernières mesures, les deux voix se mêlent.
- **Le fond**: une nappe chaude (accords), une basse ronde et une vingtaine d'« étoiles », notes de verre très douces placées au hasard avec une graine fixe. Toutes les modulations lentes ont une période qui divise 64 s: rien ne saute au raccord.
- Partition dans `design/son/plateforme/sources/salon.mid` (canaux et programmes General MIDI renseignés, pour une préécoute dans n'importe quel logiciel), relue par le script pour le rendu.

### 6.2 Boucle sans couture

- Rendu avec 14 s de queue après la 64e seconde, queue repliée sur le début; réverbération appliquée sur deux copies bout à bout, dont on garde la seconde: la réverbération du début contient celle de la fin.
- Le fichier OGG porte **une seconde d'amorce** de chaque côté (la fin de la boucle avant, son début après): on boucle de 1 s à 65 s, loin des bords du flux. Mesuré sans amorce: Chromium décodait à 44,1 kHz un échantillon de moins que prévu, et le bruit de codage Vorbis marquait le raccord (centile 99,99 des sauts entre échantillons voisins). Avec l'amorce: raccord au centile 50, et les échantillons qui suivent le raccord sont identiques à ceux qu'on entendrait sans boucler (écart nul), à 48 kHz comme à 44,1 kHz.

### 6.3 Lecture

- Décodée en entier dans un `AudioBufferSourceNode`: `loop = true`, `loopStart = 1`, `loopEnd = 65`, démarrage par `start(0, 1)` (valeurs dans `sons.json`, bloc `music.lounge`). Environ 25 Mo en mémoire à 48 kHz.
- C'est une exception assumée à la règle « longues musiques lues en flux »: un élément `<audio loop>` n'est pas garanti sans blanc au raccord dans Chromium. Pour un jeu dont la musique dure plusieurs minutes, la lecture en flux reste la règle.
- Joue sur tous les écrans hors partie (accueil, bibliothèque, historique, réglages, salon), sans redémarrer d'un écran à l'autre. Fondu d'entrée de 3 s; fondu de sortie de 1,5 s au départ de la partie (`countdown-go`); tampon libéré pendant la partie, puis relancé en fondu au retour au salon.
- Atténuée sous les annonces (5.3).

## 7. Ce que les jeux reprennent, et ce qu'ils gardent pour eux

| Sujet | Règle pour chaque jeu |
|---|---|
| Sons des écrans communs (pause, reprise, décompte, départ, connexion, fins) | joués par la plateforme sur les deux ordinateurs; le jeu ne les double pas |
| Célébration propre au jeu | permise, 3 s au plus, avant l'apparition de l'écran de fin; le son de fin de la plateforme joue avec l'écran de fin |
| Échap | aucun son du jeu: la touche est réservée à la pause, qui sonne côté plateforme |
| Bus et volumes | tout passe par le module audio du SDK (bus Musique, Effets, Interface, limiteur); aucun `AudioContext` hors du SDK |
| Niveaux | musiques à -16 LUFS intégrés, crêtes sous -1 dBTP; menus propres au jeu aux paliers « réponse » (-18 à -19 LUFS) et « discret » (-28 LUFS) |
| Règles de lecture | mêmes principes: un son par action, variantes pour les sons fréquents, focus muet quand le programme le place |
| Toi et l'autre | les actions de l'autre s'entendent mais se distinguent des tiennes: timbre ou registre différent, et position (stéréo discrète en 2D, `PannerNode` en 3D) |
| Palette, tonalité, musique | propres à chaque jeu: la célesta, la harpe de verre et la boucle « Deux astres » appartiennent à la plateforme |

## 8. Fichiers et contrôles

| Chemin | Rôle |
|---|---|
| `design/son/plateforme/ogg/` | 33 fichiers Ogg Vorbis pour l'application (32 sons, la boucle) |
| `design/son/plateforme/m4a/` | une copie AAC de chaque fichier, numérotée comme le tableau, pour l'écoute sur Mac |
| `design/son/plateforme/ecoute.m4a` | planche d'écoute (section 9) |
| `design/son/plateforme/sons.json` | définitions lues par le module audio: bus, priorité, fichiers, variations, intervalles, réglages de mixage, points de boucle |
| `design/son/plateforme/controles/mesures.csv` | mesures de chaque fichier (durée, sonies, crête vraie, écrêtage, silence de tête, raccord) |
| `design/son/plateforme/sources/generer.py` | commande unique: rendu, encodage, planche, manifeste, puis contrôle |
| `design/son/plateforme/sources/synthese.py` | instruments, filtres, réverbération, mesures BS.1770 |
| `design/son/plateforme/sources/interface.py` | les sons d'interface, en données (notes, timbres, délais) et leur registre |
| `design/son/plateforme/sources/salon.py`, `salon.mid` | partition et rendu de la boucle |
| `design/son/plateforme/sources/controler.py` | contrôle par la mesure; `--images DOSSIER` produit formes d'onde et spectrogrammes |
| `design/son/plateforme/sources/verifier-chromium.cjs` | décodage dans Chromium (Playwright): longueurs, silence de tête, crêtes, raccord à 48 et 44,1 kHz |

- Poids: OGG 1 053 Ko (dont la boucle 500 Ko), copies M4A 944 Ko, planche 578 Ko, soit 2,5 Mo d'audio; dossier entier, sources comprises, 2,7 Mo.
- Encodage: Vorbis qualité 3 pour les sons, 1,5 pour la boucle; AAC 64 kbit/s pour les copies d'écoute (énergie de chaque octave à 1 dB de la source jusqu'à 12 kHz, mesuré).
- Le rendu est déterministe (graines fixes): deux générations successives donnent des fichiers identiques à l'octet.
- Prérequis: `bash outils/installer-outils.sh` (`duo-python`), ffmpeg avec libvorbis et aac. Aucun accès réseau, aucune banque de sons.

## 9. Planche d'écoute

`design/son/plateforme/ecoute.m4a` enchaîne tous les fichiers dans l'ordre du tableau, variantes comprises, séparés par 0,7 s de silence (1,6 s entre les familles), puis 8 s de la fin de la boucle suivies de 8 s de son début, pour entendre le raccord.

| Temps | Son | Temps | Son |
|---|---|---|---|
| 0:00,0 | 01 focus 1 | 0:33,4 | 10 « C'est parti ! » de l'autre |
| 0:01,2 | 01 focus 2 | 0:35,3 | 11 « Pas encore » de l'autre |
| 0:02,4 | 01 focus 3 | 0:37,2 | 12 décompte |
| 0:03,6 | 02 valider 1 | 0:38,7 | 13 départ |
| 0:05,3 | 02 valider 2 | 0:41,7 | 14 décompte annulé |
| 0:06,9 | 02 valider 3 | 0:45,0 | 15 pause |
| 0:08,5 | 03 retour 1 | 0:46,8 | 16 reprise |
| 0:10,1 | 03 retour 2 | 0:48,7 | 17 connexion perdue |
| 0:11,7 | 03 retour 3 | 0:51,6 | 18 connexion retrouvée |
| 0:13,3 | 04 erreur douce 1 | 0:56,5 | 19 tu as gagné |
| 0:15,1 | 04 erreur douce 2 | 1:00,1 | 20 l'autre a gagné |
| 0:16,8 | 05 notification 1 | 1:03,6 | 21 égalité |
| 0:18,6 | 05 notification 2 | 1:06,8 | 22 vous avez réussi |
| 0:20,3 | 06 essai de volume | 1:11,1 | 23 pas cette fois |
| 0:23,5 | 07 l'autre est là | 1:16,6 | 24 nouveau jeu |
| 0:26,9 | 08 invitation | 1:21,0 | 25 fin de la boucle du salon |
| 0:31,5 | 09 « C'est parti ! » chez toi | 1:29,0 | 25 point de boucle (début de la boucle) |

## 10. À écouter en priorité chez le client

1. **La boucle du salon** (`m4a/25-ambiance-salon.m4a`, et le raccord à 1:29 de la planche): ambiance, niveau, et l'absence de couture.
2. **L'invitation** (0:26,9) et **l'autre est là** (0:23,5): assez présents pour être remarqués depuis l'autre bout de l'écran, sans faire sursauter.
3. **Focus, valider, retour** (0:00 à 0:13): ce sont ceux qu'on entendra des centaines de fois dans une soirée.
4. **Connexion perdue** (0:48,7): doit alerter sans inquiéter.
5. **Les fins de partie** (0:56,5 à 1:16): « l'autre a gagné » et « pas cette fois » ne doivent jamais sonner comme une punition.
6. Au casque, la différence de position entre ta voix (09) et celle de l'autre (10).

## 11. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première version: intention, palette, 24 événements et la boucle du salon, règles de lecture et de mixage, fichiers et contrôles | sound-designer |
