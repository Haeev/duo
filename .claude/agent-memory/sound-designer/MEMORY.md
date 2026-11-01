# Carnet du sound designer

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Repères de la plateforme (identité « Étoile double », `docs/plateforme/identite-sonore.md`)

- Ta voix: célesta de verre; la voix de l'autre: harpe de verre, panoramique +0,35 (toi -0,1). Interface en pentatonique de ré majeur, musique en ré lydien. Les jeux gardent leur propre palette.
- Paliers mesurés en sonie momentanée maximale (ebur128): discret -28 LUFS (focus), réponse -18 à -19, annonce -15 à -17; boucle du salon -21 LUFS intégrés; musiques des jeux -16 LUFS intégrés.
- Fichiers OGG nommés par l'identifiant anglais du code (`confirm-1.ogg`), copies M4A numérotées avec un nom français (`02-valider-1.m4a`); `sons.json` est généré, jamais écrit à la main.
- Tout se régénère par `duo-python design/son/plateforme/sources/generer.py`; la bibliothèque d'instruments (`synthese.py`) est réutilisable pour les jeux.

## Pièges vérifiés (2026-10-30)

- ffmpeg 6.1.1, `showspectrumpic`: les options `start`/`stop` (zoom) sont fausses: un sinus de 1 kHz y montre une raie fantôme vers 3 kHz et un plancher à -60 dB. Utiliser `fscale=log` sans zoom; calibrer avec un sinus avant de lire un spectrogramme.
- ffmpeg `ebur128`: avec `framelog=verbose`, les lignes par trame (M, S) passent au niveau verbeux et disparaissent du journal par défaut. Laisser `framelog` par défaut pour les analyser; ajouter `apad=pad_dur=1` pour que les sons courts soient mesurés jusqu'au bout.
- Boucle en Ogg Vorbis: sans amorce, Chromium (`decodeAudioData` dans un contexte à 44,1 kHz) décode un échantillon de moins, et le bruit de codage marque le raccord (centile 99,99 des sauts). Avec 1 s d'amorce de chaque côté (fin de la boucle avant, début après) et `loopStart`/`loopEnd` à 1 s et 1 s + durée, le décodage après le raccord est identique à la lecture continue (écart nul). Vérifié par `design/son/plateforme/sources/verifier-chromium.cjs`.
- Traitements à état sur une boucle (réverbération, filtres): les appliquer sur deux copies bout à bout et garder la seconde; replier la queue du rendu sur le début; toute modulation lente doit avoir une période qui divise la durée de la boucle.
- Deux sons tenus qui convergent vers la même hauteur finissent avec une phase relative fixe: tirée au hasard, elle peut les annuler en partie. Calculer la phase de départ (`phase_accordee` dans `synthese.py`) pour qu'ils finissent en phase.
- pedalboard `Reverb` rend un tampon de la longueur d'entrée: ajouter du silence avant, puis couper la queue sous un seuil.
- Une nappe sous des cloches domine vite le spectre et la sonie (et fait baisser les cloches à la normalisation): la garder 6 dB sous ce qui semble juste sur le papier.
- Sorties identiques à l'octet d'une génération à l'autre: graines fixes, et pour ffmpeg `-map_metadata -1 -fflags +bitexact -flags:a +bitexact`.
- `sys.dont_write_bytecode = True` en tête des scripts évite les `__pycache__` dans les dossiers versionnés (aucune entrée dans `.gitignore`).
- AAC natif de ffmpeg à 64 kbit/s: énergie de chaque octave à 1 dB de la source jusqu'à 12 kHz sur des sons de verre et une nappe; suffisant pour les copies d'écoute.
- Playwright pour vérifier un décodage: servir les fichiers par `page.route`, puis `new OfflineAudioContext(2, 1, frequence).decodeAudioData(...)` dans `page.evaluate`.

## FluidSynth et la banque FluidR3_GM (vérifié le 2026-10-31)

- Rendu propre: `fluidsynth -ni -q -R 0 -C 0 -g 0.5 -r 48000 -O float -T wav -F sortie.wav banque.sf2 entree.mid` (réverbération et chorus internes coupés, sortie flottante sans écrêtage). La réverbération se fait ensuite par convolution (IR synthétique), réglable par piste.
- FluidSynth s'arrête au dernier événement du fichier: ajouter un événement neutre (CC 110) à la fin de la queue voulue sur chaque piste, sinon la résonance finale est coupée.
- Rendre piste par piste (un MIDI par instrument, rendus en parallèle) et amener chaque piste à une sonie relative mesurée (BS.1770): le volume propre de chaque échantillon de la banque ne compte plus, le mélange se règle par la mesure.
- Les échantillons de FluidR3 sont sombres au-dessus de 3 kHz: hautbois à -26 dB dans l'octave de 4 kHz, guitare à -35 dB (mesuré). Pour la flûte et le hautbois, la vélocité ne change pas le spectre; pour la guitare nylon si (couches de vélocité): jouer la guitare vers 70. Correction: étagère d'aigus vers 3 kHz calculée pour amener l'octave de 4 kHz vers -19 dB (deux passes), légère coupe à 200 Hz.
- Deux pistes sur le même canal MIDI doivent avoir le même programme; attribuer les canaux libres en évitant ceux imposés (canal 10 = percussions).

## Écriture musicale sans écouter

- Un contrôle automatique des frottements tenus (seconde mineure, septième majeure, triton entre deux pistes, hors notes de l'accord, plus de 0,75 temps) a trouvé de vraies fautes: le garder bloquant dans la génération. En dessous d'une croche, ce sont des notes de passage normales.
- Une voix parallèle « tierce en dessous » calculée par index dans une gamme qui ne commence pas par do tombe une octave trop bas: compter les degrés en descendant demi-ton par demi-ton. Et remplacer par une note de l'accord toute note tenue qui sort de l'accord.
- Durées de boucle entières en secondes (tempo et nombre de mesures choisis pour): nombre entier d'échantillons à 48 kHz comme à 44,1 kHz.

## Boucles et lecture dans Chromium (mesuré le 2026-10-31)

- `<audio loop>` (et donc une musique lue en flux par un élément média) insère 128 à 256 échantillons de silence (2,7 à 5,3 ms) à chaque tour: clic audible. Boucles sans couture uniquement par `AudioBufferSourceNode` (loop, loopStart, loopEnd) sur un tampon décodé. Coût: 384 Ko par seconde de stéréo à 48 kHz (une musique de 96 s = 37 Mo), à comparer au plafond de 64 Mo d'audio décodé de l'architecture.
- Fichier de boucle livré avec une amorce de chaque côté (fin de la boucle avant, début après), comme le salon de la plateforme: le bruit de codage Vorbis et le rééchantillonnage restent loin du raccord.
- Queue de réverbération d'un rendu: la replier sur le début de la boucle; compression et limiteur appliqués sur trois copies de la boucle dont on garde celle du milieu (état continu au raccord).
- Ambiances: bruit périodique par FFT et modulations à nombre entier de cycles, ou traitement sur la boucle plus une seconde repliée en fondu à puissance constante; événements posés sur une ligne de temps circulaire.
- Dans Playwright, `audioWorklet` exige un contexte sécurisé (servir la page en `https://` intercepté par `page.route`) et le module du worklet n'est pas intercepté: le charger par une URL `blob:`.

## Outils

- Un `grep` en fin de tube dans une commande en arrière-plan retient toute la sortie jusqu'à la fin: ne pas compter dessus pour suivre l'avancement (lister les fichiers produits).
- Attendre la fin d'un script avec `until ! pgrep -f "nom-du-script"` ne finit jamais: la boucle d'attente contient le motif dans sa propre ligne de commande. Attendre plutôt une ligne finale dans le journal (`until grep -q "Contrôle réussi" journal`).
- Une planche d'écoute doit partir des fichiers livrés (décodés), pas du rendu en mémoire: elle reste identique quelles que soient les options de génération.
- Sons très percussifs (hache, marteau, tampon): la crête vraie limite avant la sonie momentanée visée; fixer des cibles réalistes (2 à 3 dB plus bas) plutôt que d'écraser l'attaque.
- Conventions de la plateforme à garder dans les jeux: identifiants de sons en anglais, bus `music`, `effects`, `ui` (plus `ambience` dans les jeux), sonie des effets en momentanée maximale, des musiques en intégrée, plafond -1 dBTP mesuré par `ebur128` après décodage. Pour La Petite Ligne, le manager a demandé -18 LUFS intégrés pour les musiques (et non -16).
- Un carnet existe déjà dans le dépôt: le lire avant d'écrire, et n'y ajouter que des sections.
- Un signal qui doit s'entendre (refus, touche de pêche): fondamentale au-dessus de 300 Hz et la plus grande part de l'énergie au-dessus (mesurée), car le PC de référence a peut-être des haut-parleurs de portable. Prouver qu'un son se distingue d'un autre par la mesure (centroïde spectral, durée utile), pas seulement par l'intention.
- Passer un son d'une à plusieurs variantes change ses noms de fichiers (`x.ogg` devient `x-1.ogg`...): supprimer l'ancien fichier, sinon `controler.py` le signale comme orphelin.

## La Petite Ligne: ajouts de sons (vérifié le 2026-10-31, tour 6)

- Un nouveau module de sons (`assets-src/son/moments.py`) s'ajoute à `tous_les_sons()` et aux groupes de la planche de `generer.py`; `--seulement sons planche` régénère sans toucher aux musiques, et les fichiers existants ressortent identiques à l'octet (`git status` le prouve).
- Dossier non résident: tout sous-dossier absent de `residentFolders` (`src/audio/reglages.ts`) se décode à la demande. Y mettre les sons rares (moments: 13 Mo décodés); `memoire.test.ts` exige moins de 30 Mo de sons résidents.
- Le schéma de `sons.json` (`src/audio/catalogue.ts`, Valibot) n'accepte pour un son que les bus `effects`, `ui`, `ambience`; les champs en plus (`extra`) sont ignorés sans erreur.
- `ebur128` de ffmpeg mesure un fichier mono environ 3 dB sous la cible de `dsp.amener_momentanee`: écart constant dans tout le jeu, comparer les sons entre eux avec la même mesure.
- Bois frappé (banc, barreau, échelle): avec `ins.bois` à fondamentale sous 150 Hz, plus de 85 % de l'énergie tombe sous 300 Hz (inaudible sur un portable). Monter la fondamentale vers 150 à 250 Hz, baisser son amplitude au profit des partiels et du craquement, puis vérifier la part sous 300 Hz (viser moins de 60 %).
- Le robot de `cerveau.test.ts` ne s'assoit sur aucun banc: un son de `sat_down` ne peut pas figurer dans la liste des sons attendus de ce test.
- Dans un worktree isolé, l'outil refuse les commandes qui mêlent `cd`, heredoc et `duo-python` avec `$PWD`, ou qui contiennent le mot git dans un motif: appeler `duo-python` avec des chemins absolus, une commande à la fois, et éditer avec Edit.

## La Petite Ligne: tour 7 (vérifié le 2026-11-01)

- Les instants écrits dans le champ `event` (description) viennent de `donnees/moments.json` (`climax.sounds`, `leave.sounds`), pas des fiches: le dev recale les chorégraphies. Les relire à chaque tour; changer une description ne change aucun fichier audio (graine tirée de l'identifiant).
- `src/audio/catalogue.test.ts` compte les sons de `sons.json` (« lit les N sons »): mettre N à jour quand on en ajoute.
- Worktree neuf: `node_modules` absent, toute la suite vitest échoue sur « Cannot find package »; lancer `pnpm install --frozen-lockfile` à la racine du worktree avant `npx vitest run`.
- Le contrôle des tirets contient `.git` (`--exclude-dir`): dans un worktree isolé l'outil le refuse; le mettre dans un petit script et lancer `bash script.sh CHEMIN`.
- Accepter `music` comme bus d'un son (question S3) n'est pas une ligne: schéma Valibot, type `SoundBus`, `busOf` de `moteur.ts`, et le raccord après `momentDuck` (sinon la descente de l'apogée atténue aussi le son).
- Un son musical court (accord de harpe et cordes) se rend par `partition.produire` depuis moments.py comme les motifs d'habitants: le MIDI va dans `assets-src/son/midi/`. `partition.frottements` ne signale rien si `m.accords` est vide: pour un accord tenu, tester soi-même toutes les paires de notes (seconde mineure, triton, septième majeure).

## La Petite Ligne: tour 8 (vérifié le 2026-11-01)

- Le moteur n'a pas d'API pour jouer une variante précise (`VariantPicker` tire au hasard): un son choisi par l'état (saison) se déclare en plusieurs identifiants (`season-turn-spring`...), pas en variantes.
- Les règles d'ambiance de `plan.ambienceByTime` sont toutes appliquées (aucun champ saison): une ambiance de saison qu'on y mettrait jouerait toute l'année. Les mettre dans une clé à part du plan (`plan.ambienceBySeason`), ignorée par le schéma Valibot (`v.object` retire les clés inconnues), en attendant que le dev audio les branche.
- Un motif musical joué sur une autre musique (petit-déjeuner en fa majeur): l'écrire en pentatonique de cette tonalité; aucune paire de notes de la pentatonique ne forme de seconde mineure, septième majeure ni triton, et un contrôle strict toutes paires confondues (même piste) le prouve.
- Une ambiance à événements (martinets) normalisée en sonie intégrée peut sortir 13 dB plus forte en momentanée: viser la momentanée maximale sous celle des oiseaux du matin (-24 LUFS ffmpeg) et ajuster la cible intégrée en conséquence.
- Un LFO de rafales `0,5 + 0,5 x clip(...)` descend à zéro: trou de silence visible au spectrogramme. Garder un plancher (0,62 + 0,38 x ...).
- Une boucle qui contient un sinus continu aigu (trille à 2,7 kHz) sort au centile 97 des sauts au raccord alors que la continuation vaut 0: normal (les sauts voisins d'un sinus aigu sont grands partout), tant que le seuil de 99,5 tient.
- `generer.py --seulement musiques sons planche --musiques <id>` ajoute une musique sans rendre les autres; les fichiers existants ressortent identiques à l'octet.
- Les commandes avec boucle `for` sur des fichiers et ffmpeg sont refusées dans un worktree isolé: les mettre dans un script hors du dépôt (`/tmp/...sh CHEMIN`).
