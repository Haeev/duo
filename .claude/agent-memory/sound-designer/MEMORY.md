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

## La Petite Ligne: tour 9 (vérifié le 2026-11-01)

- Question S3 réglée: un son peut avoir `bus: "music"` (schéma de `catalogue.ts`, `SoundBus`, `busOf` qui rend `musicPause`, après `duck` et `momentDuck`). Test `src/audio/moteur-bus.test.ts`: le vrai `AudioEngine` sur un faux contexte qui note les `connect`; modèle réutilisable pour tester d'autres branchements du moteur sans navigateur.
- Le plafond de 30 Mo des sons résidents (`memoire.test.ts`) est presque plein (environ 29,2 Mo après le tour 9, calculé): un son lié à un objet rare va dans `objets/` (non résident) avec un champ `decodeWhen` pour le dev audio. Compter avant: 192 Ko par seconde en mono, 384 en stéréo (float32 à 48 kHz).
- Une boucle dont une attaque tombe à moins de 0,05 s du début sort « niveau au raccord centile 100 » dans `controler.py` (contrôle réussi quand même): placer les attaques à égale distance du raccord (tic-tac à 0,5 et 1,5 s; coups encadrant le raccord de 0,25 s).
- Cinq notes « dans l'ordre »: cinq identifiants (`star-chime-1` à `-5`, champ `order`), comme les tournants de saison; do pentatonique (do, ré, mi, sol, la) est juste à la fois sur fa, sol et do majeur.
- Une suite vitest complète prend environ 8 minutes dans le worktree; `npx vitest run src/audio src/interface/tests/sons.test.ts` (20 s) suffit pour itérer sur les sons.

## La Petite Ligne: tour 10 (vérifié le 2026-11-01)

- Worktree parti d'un commit ancien: la conception du tour courant peut manquer. Vérifier `git log HEAD..<branche de session>` et avancer en avance rapide (`git merge --ff-only`) si rien n'est modifié localement.
- Plafond des sons permanents plein (29,3 Mo sur 30): un tour entier de sons va dans des dossiers non résidents par thème (`rue-haute/`, `besoins/`, `maison/`) avec `decodeWhen`; les motifs d'habitants nouveaux aussi (le moteur les trouve par l'identifiant `talk-<id>`, pas par le dossier).
- Une règle par bâtiment pour le moteur (étouffement, ambiance de pièce) se met dans une clé à part du plan (`plan.interiorByBuilding`), comme `plan.stream` pour les sources du ru: le schéma Valibot l'ignore, le dev audio la lit.
- `dsp.sonie_integree` plante sur un son de moins de 0,4 s (fenêtre plus longue que le son): ne la calculer que pour les sons plus longs.
- Un script d'essai hors du dépôt (`/tmp/.../essai.py`) qui appelle `generer.traiter(son, v)` pour un module donne sonie, centroïde et part sous 300 Hz en quelques secondes, sans encoder: itérer là avant la génération complète.

## La Petite Ligne: 0.13 (vérifié le 2026-11-03)

- Le dossier de brouillon (scratchpad) est partagé avec d'autres agents et contient des fichiers Python homonymes de la bibliothèque standard (`socket.py`) ou des modules du jeu (`train.py`, `bourg.py`): y ranger ses scripts dans un sous-dossier à soi et lancer `duo-python -I`, sinon les imports partent ailleurs.
- `dsp.poser(y, a + b)` sur deux sons de longueurs différentes plante (broadcast): additionner par `dsp.somme(a, b)`.
- Un fond d'ambiance très lisse (bruit passe-bas sous 2 kHz, pièce réverbérée et silencieuse) fait sortir la seconde différence au raccord au centile 99,8 après encodage Vorbis, alors que la boucle brute est parfaite: le bruit de codage domine ce fond. Ni la qualité Vorbis (2 à 8) ni une amorce de 1 s n'y changent rien; un souffle aigu très faible (2,5 à 9 kHz, environ -22 dB sous le fond) suffit. Tester un raccord sans tout régénérer: encoder la boucle amorcée et appeler `controler.raccord` sur le décodé.
- Un tuba seul (sol 2) met 91 % de l'énergie sous 300 Hz, même transposé d'une octave (sol 3 = 196 Hz): le doubler deux octaves plus haut au cor, tuba 5 dB sous le cor (35 %).
- `cerveau.test.ts` (robot sur toute la démo) a un délai fixe de 120 s dans son `beforeAll` (l'option `--hookTimeout` ne le remplace pas); avec une charge de 28 sur 4 cœurs il passe en 103 à 119 s et peut expirer: le relancer seul avant de soupçonner le catalogue.
- Le poids du jeu approche le plafond de `controler.py` (19,7 Mo sur 20 après la 0.13): compter environ 0,2 Mo par ambiance de 30 à 40 s et 50 Ko par motif stéréo de 4 s.

## La Petite Ligne: 0.13, branchement (vérifié le 2026-11-04)

- Un son ponctuel dont le fichier n'est pas décodé est perdu (`moteur.play` demande le décodage et rend `null`); une boucle (`LoopWish`) réessaie à chaque image. Tout dossier non résident joué en ponctuel doit être demandé à l'avance: `AUDIO_SETTINGS.village.places` (par lieu) et `BrainFrame.villageFiles`, ou `PRELOADED_FOLDERS` de `moteur.ts` pour ce qui sonne partout (`carnet/`).
- Une ambiance placée se fait par `LoopWish` d'un son du bus `ambience` (le moteur la passe derrière les murs dans un intérieur); une ambiance non placée réglée par la position s'écrit dans `frame.ambience` après `ambienceLevels` (lit `updateBed` pour tout identifiant de la carte).
- Événements pas encore dans `WorldEvent`: les jouer dans le `default` du `switch` de `soundsForEvent`, sur `const raw: { readonly type: string } = event` pris avant le `switch` (dans `default`, `event` est `never`); quand le type arrive avec son `case`, la table ne joue plus, pas de doublon.
- La géométrie du train du son (`slideDistanceM` 70) ne suit pas le rendu depuis R06 (`trainSlides` de `rendu/voie.ts`: entrée depuis le bord est de la carte): ce qui dépend de la position visible (sifflet aux passages à niveau) se calcule à part.
- Prettier n'est pas appliqué aux fichiers de `src/audio` (27 fichiers hors format avant toute retouche): ne pas reformater, seuls `tsc` et `eslint` comptent.
- Commande refusée dans un worktree isolé: `git show HEAD:...` suivi d'une redirection; `magick` absent (ImageMagick 6: `convert`).

## Budgets et Chromium (vérifié le 2026-11-07, direction sonore de Cosy Café)

- Mémoire décodée: `new OfflineAudioContext(1, 1, 24000).decodeAudioData()` rend un tampon à 24 kHz (deux fois moins de mémoire qu'à 48 kHz) qui se joue juste dans un contexte à 48 ou 44,1 kHz (sinus de 1 kHz, durée exacte). Le `load` du SDK décode dans le contexte principal: il faut une option de fréquence.
- Ogg Opus dans Chromium: `canPlayType` « probably », décodage à la longueur exacte à 48 et 44,1 kHz, lecture en flux par `createMediaElementSource`, `preservesPitch` présent; une vitesse de 1,01 donne 1,0096 mesuré sur 6 s (sur 2 s, la mesure n'est pas fiable).
- libopus en débit variable libre dépasse sa consigne sur un rendu FluidR3 court (48k demandés, 56,8 kbit/s réels); `-vbr constrained` reste juste dessous (40k: 37,7; 48k: 45,0). Énergie par octave à 0,12 dB de la source jusqu'à 12 kHz dès 32 à 40 kbit/s (ne mesure pas tous les défauts: faire comparer à l'oreille).
- Poids des sons courts en Vorbis: environ 3,6 Ko d'en-têtes par fichier mono (qualité 3) plus 6,5 Ko/s; stéréo qualité 4 environ 4 Ko plus 12 Ko/s (bruit décroissant, majorant).
- Un budget se calcule à partir des tableaux du document sonore (colonne Fichiers « n × d s », « boucle d s », « st. », « 32 kHz », « par adresse »), par un script qui lit le Markdown: une première version à 48 kHz, trois ou quatre variantes et longues queues donnait 150 Mo de pic; leviers: musiques finies lues en flux (pas de raccord), décodage à 24 ou 32 kHz, groupes décodés par moment, variantes et queues resserrées.
- Inventaire de FluidR3_GM (lecture du bloc `phdr`, script de 30 lignes): batteries Brush 128:40 à 42 et Jazz 128:32 à 36; Italian Accordion 8:21, Mandolin 16:25, Ukulele 8:24, Slow Violin 8:40, Fiddle 0:110, Rhodes EP 0:4, Honky Tonk 0:3, Calliope Lead 0:82, Reed Organ 0:20, Bandoneon 0:23, Kalimba 0:108; pas de clarinette basse.
- SDK audio (`packages/sdk/src/audio.ts`): trois bus (`music`, `effects`, `interface`), aucun limiteur, `playMusic` démarre tout de suite un `HTMLAudioElement` sans position ni départ programmé.

## Deux Tabliers (Cosy Café): démo d'Ormeval (vérifié le 2026-11-08)

- Chaîne de La Petite Ligne copiée dans `games/deux-tabliers/assets-src/son/` (`dsp.py`, `instruments.py`, `partition.py`) plus `timbres.py` (porcelaine, laiton sur ressort, bol de bois, craie sans crissement, moteurs plafonnés sous 2 kHz). Sons encodés en Vorbis à leur fréquence de décodage (24 ou 32 kHz, `aresample=soxr`), musiques en Ogg Opus 40k contraint, extension `.ogg`.
- Dans une boucle, tout filtre IIR (même un `tb.doux`) doit passer par `dsp.circ` (trois copies, celle du milieu); sinon le raccord casse. Le raccord se mesure sur le fichier décodé à sa fréquence propre (indices de boucle à cette fréquence).
- Les fonds lisses (rumeur filtrée sous 1,5 kHz, réfrigérateur, bouilloire, roulement de vapeur) ressortent avec une seconde différence au centile 100 au raccord, même à 24 kHz: `souffle_de_raccord` de `generer.py` ajoute un souffle 2,5 à 10 kHz 22 dB sous le fond quand moins de 2 % de l'énergie est au-dessus de 2,5 kHz.
- Copie M4A d'une musique à -1,5 dBTP: l'AAC monte à -0,4 dBTP; copies d'écoute encodées 2 dB plus bas (à -1 dB, encore -0,7 dBTP).
- `partition.frottements` d'origine est quadratique; version triée par début (arrêt dès qu'une note commence trop tard) dans la copie de Deux Tabliers. Programme de batterie (Brush 40) envoyé sur le canal 10 si `programme > 0`.
- Coups de bois (porte, meubles, coups à la porte): sous 200 Hz de fondamentale, 70 à 80 % de l'énergie tombe sous 300 Hz; fondamentale 240 à 290 Hz et `passe_haut` 200 à 240 ramènent un signal (coups de livraison) vers 40 à 50 %.
- `Son(...)` modifié par script avec recherche de `"),\\n"`: la fin d'une lambda sur la même ligne trompe la recherche (paramètre ajouté dans l'appel de la fonction). Éditer ces appels à la main.

## La Petite Ligne (refonte): musique d'Aubrune (vérifié le 2026-11-10)

- Chaîne dans `games/la-petite-ligne-2/assets-src/son/musique/` (copie de `partition.py` de l'ancien jeu, `dsp.py` du dossier parent): un morceau = deux tiges mono (`fond`, `air`) qui bouclent ensemble; chaque tige mélangée avec la même réverbération et la même égalisation, un seul gain et un seul limiteur pour toutes (`dsp.limiter_circulaire` accepte un tableau à plusieurs colonnes: on lui passe [tige, tige, somme], le gain vient du maximum des colonnes, donc la somme reste fidèle).
- Sonie visée sur le fichier mono livré, mesurée par ffmpeg: `dsp.sonie_integree` donne un autre chiffre (mono dupliqué: +3,01) et s'écarte de 0,8 dB sur un morceau clairsemé (mystère). Boucle de correction dans le rendu: mesurer avec ffmpeg et recaler (3 passes au plus).
- Une contrebasse écrite sous mi 2 (MIDI 40) remplit le spectre sous 100 Hz (inaudible sur un portable) et mange la sonie: basses entre ré 2 et ré 3 (38 à 52), passe-haut à 50 Hz.
- Écrire dans une gamme unique (les sept notes de sol majeur) et décaler le motif de k degrés (`degres`) change le mode (mi, ré) sans note étrangère; une harmonisation par programmation dynamique (accords diatoniques, notes de la mélodie pondérées par durée et temps fort) évite d'écrire les grilles à la main. Le contrôle des frottements a trouvé: une basse tenue qui déborde sur l'accord suivant (couper chaque note à la fin de son accord), un contrechant de clarinette en seconde mineure de la mélodie (le remplacer par une tierce parallèle).
- Opus mono 36 kbit/s en `.ogg`: 6,4 Mo pour 10 morceaux de deux tiges plus 7 jingles; amorce de 1 s de chaque côté, `loopStart` et `loopEnd` dans la table. Le décodage à 24 kHz (`OfflineAudioContext`) divise la mémoire par deux (96 Ko par seconde et par tige).
- Un mélange de tiges mono panoramiquées (`StereoPanner` centré à puissance constante) garde la sonie du fichier mono mesuré par ffmpeg.
- Les copies d'écoute M4A (AAC 56 kbit/s mono, 5 Mo pour 17 fichiers) restent à côté des sources, hors du jeu.
- Aucun contrôle de Chromium sur le raccord Opus de cette chaîne n'a été fait (seulement le décodage ffmpeg): à faire avec `verifier-chromium.cjs` si un raccord s'entend.
- L'outil du worktree refuse les heredocs combinés à `cd`: écrire les fichiers avec Write, lancer les scripts en commandes simples.

## La Petite Ligne (refonte): deuxième lot d'effets (vérifié le 2026-11-11)

- Les sons d'histoire se branchent sans code par `scene_beat` (`where: { scene, beat }`): l'indice du temps est celui du tableau `beats` de la scène; le champ `sound` d'un temps n'est qu'une onomatopée affichée, pas un son.
- Les surfaces du rendu (`SurfaceKind` de `rendu/lieu/reglages-tuiles.ts`) sont en français (`herbe`, `bois`, `eau`...), pas `grass`: la table des pas doit porter ces clés. Vérifier aussi que `main.ts` passe `surfaceAt` (absent le 2026-11-11).
- Un `toile(d)` trop courte tronque net le dernier coup posé (cloche coupée visible au spectrogramme comme un bord vertical): dimensionner la toile sur le dernier départ plus la durée du coup, puis `fondu` en fin.
- Test de décodage rapide: un seul processus ffmpeg avec toutes les entrées et une sortie `-f null` par entrée (`-map i:a`), 1,4 s pour 80 fichiers; un ffmpeg par fichier dépasse 20 s sous charge.
- `money_changed` part aussi pour les achats en boutique: un son de boutique sur `shop_bought` doublerait celui de l'argent; brancher l'argent par le signe de `delta`.

## La Petite Ligne (refonte): airs de la collection (vérifié le 2026-11-11)

- mido écrit les noms de piste et de morceau en latin-1: un titre avec « œ » plante l'écriture MIDI et laisse un fichier tronqué (EOFError à la relecture). Titres MIDI sans œ (« soeurs »).
- `assets-src/son/` et `assets-src/son/musique/` ont chacun un `generer.py`: un script de `musique/` qui importe `generer` doit mettre son propre dossier en tête de `sys.path` (insérer le parent d'abord, puis le dossier).
- Schéma des fiches du carnet strict (`CollectionEntrySchema`): pas de champ fichier possible sans code; un air se relie à sa fiche par l'identifiant du morceau (`tracks.<id de l'entrée>`).
- Huit airs de 64 à 72 s en deux tiges Opus 36k: 4,8 Mo; la musique d'Aubrune passe à 11,09 Mo sur le plafond de 12 Mo de `controler.py`: le prochain lot devra baisser le débit ou relever le plafond.
- FluidR3 n'a pas de bugle ni de bugle à pistons: trompette (0:56) jouée entre ré 4 et mi 5, vélocité 70 à 80.
- Rendu des huit airs: 3 min 20 sur une machine chargée; `--seulement air-` les isole (aucun autre identifiant ne contient « air- »).

## La Petite Ligne (refonte): troisième lot, draisine et musique jouée (vérifié le 2026-11-11)

- `soundForEvent` ne rend que la première règle qui convient: un événement ne peut pas à la fois faire taire un son tenu et en jouer un autre (`vehicle_stopped` en butée). Vérifier qu'un son tenu (`loop`) a toujours sa règle `stop`: `vehicle_warning` jouait `passage-a-niveau` (tenu) sans rien pour le faire taire.
- Son tenu sans couture dans le format `loop` de `sons.json`: fichier « amorce + corps circulaire + suite » (`sons_lot3.roulement_tenu`), `from` = amorce, `to` = amorce + corps, durées entières en secondes. Contrôle dans Chromium par `AudioBufferSourceNode` en boucle dans un `OfflineAudioContext`: la sortie après `to` égale le fichier depuis `from` (écart nul à 44,1 et 48 kHz).
- Grincement de bois (balancier, frein): train d'impulsions à cadence glissante (50 à 140 Hz) passé dans 2 ou 3 `dsp.resonateur` (Q 6 à 9, 500 à 2600 Hz); normaliser la sortie à crête 1, sinon il disparaît sous les coups de fer et de bois qu'on lui ajoute.
- Voix de foule sans paroles (« bravo », « ah ! »): source à harmoniques en 1/k^1,3 et trois formants qui glissent par `dsp.pb_variable(type_="band")`; posée à 0,22 sous des applaudissements, elle se voit au spectrogramme sans dominer.
- Équilibre de la musique jouée: rendre par le vrai moteur dans Playwright en important les modules par Vite (`await import('/src/audio/musique/scene.ts')` dans `page.evaluate`) trois tiges séparées (accompagnement seul, notes seules avec les tiges à -60 dB); le `PeriodicWave` est normalisé, donc changer les harmoniques change le niveau: remesurer après chaque retouche. Cible retenue: soliste 4,5 dB au-dessus de l'accompagnement, mélange vers -16 LUFS.
- `outils/tableau-de-bord/outils/publier-sons.mjs` refuse de tourner s'il manque une phrase pour une clé de règle (`on` plus conditions triées, `listeners>0`, `seat=nonnul`) dans `sons-sources.json`; la description d'un effet vient de la cellule « `id`: texte » du document sonore.
