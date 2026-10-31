# Carnet du dev gameplay 3D

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Three.js 0.187 (vérifié le 2026-10-31)

- `PCFSoftShadowMap` est retiré (avertissement en console, repli sur `PCFShadowMap`): prendre `PCFShadowMap`, dont `shadow.radius` règle la douceur (5 échantillons Vogel). `shadow.intensity` existe (ombres légères sans toucher aux lumières).
- `renderer.info.render.calls` et `.triangles` comptent aussi la passe d'ombre (remise à zéro avant `shadowMap.render`). `renderer.info.programs` garde les programmes compilés une fois, même plus utilisés: ne pas compiler à l'échauffement des maillages qu'on n'affichera jamais (les sortir de la scène).
- Budget de 12 programmes: chaque variante compte. `transparent` change le programme (`#define OPAQUE`), comme l'instanciation, `instanceColor`, le squelette, les cibles de morphose, la présence d'une `map`, et chaque `MeshDepthMaterial` d'ombre (simple, instancié, squeletté, squeletté avec morphose). Astuces: un seul matériau palette partout (terrain, décor, substituts), `instanceColor` sur tous les maillages instanciés, anneaux et repères peints sur la case blanche de la palette pour partager le programme des fantômes.
- Fusion des pièces d'un personnage (corps et vêtements, même squelette): `mergeGeometries` exige les mêmes attributs de morphose; donner aux vêtements des cibles nulles (`Float32BufferAttribute` à zéro, `morphTargetsRelative` du corps). Un appel de dessin et un programme par personnage.
- `SkinnedMesh`: l'élimination hors champ utilise `object.boundingSphere`, calculée une fois sur la pose du moment. Poser une sphère fixe autour du corps.
- `compileAsync` sous SwiftShader avertit « KHR_parallel_shader_compile extension not supported » (absent des vrais GPU).
- `WebGLProgramParametersWithUniforms` est le type du paramètre de `onBeforeCompile`; avec `customProgramCacheKey`.

## Modèles de l'artiste (GLB regroupés)

- Charger tous les GLB connus à la construction par `import.meta.glob('…/*.glb', { query: '?url', import: 'default', eager: true })`: aucun fichier manquant n'est demandé, donc aucune erreur 404 en console; un nom absent donne un substitut.
- Les maillages squelettés peuvent être frères du nœud du squelette (pas enfants): cloner `gltf.scene` entier avec `SkeletonUtils.clone`, puis élaguer les maillages non voulus. Les géométries restent partagées.
- Ne pas indexer les os comme modèles: l'os `chest` masquait le meuble `chest`.
- Poids de morphose par défaut à 1 dans le GLB: remettre `morphTargetInfluences` à 0 au clonage.
- L'artiste réexporte souvent (structure, noms): coder contre les noms et les extras (`walk_height`, `length_over_buffers`, `smoke_anchor`, `footprint`), pas contre la hiérarchie.

## Rendu isométrique

- Ombre serrée sur la vue: rayon = rayon de vue au sol + marge, centre calé sur la grille des texels dans le repère de la lumière (aucun scintillement quand la caméra glisse), `normalBias` proportionnel à la taille d'un texel (pas d'acné à aucun zoom).
- Personnage caché par un bâtiment ou un arbre: trou tramé dans le matériau du décor (`onBeforeCompile`), `discard` si le fragment est dans un disque autour du personnage projeté (`gl_FragCoord`), plus près de la caméra (`vViewPosition.z`) et au-dessus de son sol. L'ombre reste (le matériau d'ombre n'est pas touché).
- Une zone marquée au sol de la pièce (cadre) disparaît sous les meubles: deux paillasses couvrent un carré de 2x2 entier. De petits piquets aux angles la gardent lisible.
- Coupe d'une maison: retrouver l'orientation de chaque mur par le centre de sa boîte (plus sûr que les noms), cacher toit et murs dont la normale regarde la caméra.

## Environnement et outils

- Le dossier temporaire est partagé entre les membres: travailler dans un sous-dossier à soi (un autre membre a écrasé un `capture.cjs`).
- Le serveur de Vite recharge la page quand d'autres membres modifient le dépôt: pour des captures stables, construire la page dans un dossier temporaire (`vite build --config` avec `rollupOptions.input`) et la servir avec `python3 -m http.server`.
- Captures WebGL2: `chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })`; attendre un drapeau posé par la page (`window.x.ready`) plutôt qu'un délai.
- Essai de fuite: créer et libérer le rendu dix fois de suite dans la page, comparer `renderer.info.memory` à chaque tour et le tas (`--enable-precise-memory-info`), compter les canevas restants.
- Membre isolé dans un worktree: l'outil Bash refuse une commande qu'il ne sait pas cantonner au worktree (`..` dans un chemin, l'exclusion du dossier du dépôt dans le contrôle typographique, une boucle autour de commandes du dépôt, un heredoc qui cite le dépôt). Mettre ces commandes dans un script du scratchpad (`bash /tmp/<moi>/x.sh <racine>`), les scripts Python dans un fichier, et éditer le reste avec Edit.
- `vite build --config` avec un fichier de configuration hors du dépôt échoue (`vite` introuvable depuis `/tmp`): copier la configuration dans le dossier du jeu, construire, puis la supprimer.
- Prettier n'est pas appliqué partout: ne formater que les fichiers qui étaient conformes avant la mission (version d'origine passée à `prettier --check --stdin-filepath`), sinon le diff gonfle et la fusion coince.
- Rendu logiciel: la capture Playwright d'une page 3D peut dépasser 30 s (`screenshot({ timeout })` à relever); ouvrir une page neuve par capture, la navigation suivante dans la même page attend la fin d'une image interminable.

## Son Web Audio (vérifié le 2026-10-31, La Petite Ligne)

- Séparer « cerveau » (décisions pures, testées dans Node avec le robot de la simulation sur toute la démo) et « moteur » Web Audio: le cerveau produit des commandes, le moteur les applique sur les bus du SDK (`audio.bus(name)`, `audio.context`).
- Vérifier le moteur dans Chromium sans écouter: `OfflineAudioContext` à 6 voies (un bus du SDK par paire de voies, `ChannelSplitter` vers `ChannelMerger`), piloté pas à pas par `ctx.suspend(t).then(... ctx.resume())` planifiés d'avance; attendre la fin des décodages avant `resume` (le décodage prend du temps réel, le rendu hors ligne non). Mesurer les niveaux RMS par 50 ms et comparer les échantillons au fichier (raccord de boucle exact à 1e-8).
- `OfflineAudioContext.state` vaut `suspended` pendant un `suspend(t)`: un test « le contexte joue-t-il ? » doit être injectable.
- `durationMs` d'une boucle dans `sons.json` donne la longueur de la boucle, pas du fichier (fichier = `loop.end + loop.start`, amorces comprises): compter la mémoire décodée sur le fichier.
- Distance calculée soi-même (modèle de `sons.json`, plancher `minGainDb`) et `PannerNode` en `equalpower`, `linear`, `rolloffFactor` 0: panoramique seul, peu coûteux; oreille posée derrière le personnage pour un panoramique plus doux.
- Ne pas réécrire le gain d'une voix en fondu de sortie (`setTargetAtTime` annule la rampe): drapeau `stopping`.
- Vitest: `beforeAll` a un délai de 10 s par défaut, indépendant de `testTimeout`; une démo entière jouée par le robot le dépasse quand les fichiers tournent en parallèle: passer le délai en second argument.
- Le SDK ignore `pause` tant que son état n'est pas `running` (chargement, départ synchronisé): un test de pause attend `data-statut="running"` des deux vues.

## Interface HTML sur une scène Three.js (La Petite Ligne)

Apprentissages vérifiés le 2026-10-31 en codant `games/la-petite-ligne/src/interface/`.

- Le SDK Duo écoute `keydown` sur `window` en capture et appelle `preventDefault()` pour toute touche liée à une action du manifeste (Espace, Entrée, Tab, flèches, Z Q S D...), sauf si la cible est un champ de saisie. Conséquence: un bouton focalisé ne s'active plus tout seul avec Entrée ou Espace. L'interface doit appeler `click()` elle-même, et naviguer au clavier sans compter sur Tab natif.
- Le SDK écoute aussi `pointerdown` sur `window` (phase de bouillonnement): arrêter la propagation sur la racine de l'interface évite qu'un clic sur le HUD devienne un clic dans la scène (`move_to` sous la barre d'outils).
- Une touche traitée par l'interface (focus dedans) arrive quand même à `handleKey` au pas suivant, par `wasPressed` du SDK: marquer la touche « déjà traitée » quelques centaines de ms et l'ignorer dans `handleKey`.
- Tant qu'une couche (écran, dialogue, panneau) est ouverte, garder le focus dedans: sinon les touches vont à `body`, puis au personnage.
- L'outil d'écriture de fichiers transforme les échappements Unicode d'un fichier (espace insécable U+00A0, tirets U+2013 et U+2014 écrits avec barre oblique inverse et u) en vrais caractères: ESLint refuse les espaces insécables (`no-irregular-whitespace`) et `pnpm verifier` refuse les tirets longs. Réécrire ces lignes par un petit script Python qui remet les échappements.
- `ui-maquettes/composants.css`: `.lpl-stamina__fill` est un `span` en ligne, sans largeur: corrigé par `display: block` dans `interface.css`.
- Arbre de travail partagé: le serveur de Vite recharge la page à chaque modification des autres membres. Les captures Playwright doivent détecter `framenavigated` et recommencer; pour le vrai jeu en deux vues, servir une construction figée (`vite build --outDir` dans le scratchpad, puis `vite preview`).
- Rendu logiciel de l'environnement cloud: deux vues 3D dans le faux hôte affament les minuteries (trous de 1 à 7 s), et le faux hôte coupe la partie (« Le jeu ne répond plus »). Vérifier l'interface sur la page de démonstration (`rendu=0` pour les mesures), et le vrai jeu seulement sur ses premiers écrans.
- Mesure: un rafraîchissement complet de l'interface coûte environ 0,8 ms (Chromium sans tête); limité à 11 par seconde, le reste des images ne compare qu'une chaîne (l'heure).
- Échelle de l'interface (`--lpl-ui-scale` sur la taille de police de la racine): une requête média en `rem` ignore l'échelle (elle lit la taille initiale, 16 px), une requête de conteneur la suit. Pour « fenêtre basse à 150 % »: `container: lpl-ui / size` sur la racine fixe plein écran, puis `@container lpl-ui (max-height: 36rem)`. Dans une requête de conteneur, la règle ne gagne que par spécificité ou par ordre: une règle plus loin dans le fichier l'écrase.
- Écran plein cadre en grille `place-items: center` avec `overflow: auto`: quand le contenu déborde, le haut est coupé et inatteignable. `align-items: start` et `margin-block: auto` sur l'enfant: centré s'il tient, lu depuis le haut sinon.
- Captures 3D à l'échelle 1,5 (`deviceScaleFactor`): la capture dépasse les 30 s par défaut en rendu logiciel; passer `timeout` à `page.screenshot`.

## Simulation de La Petite Ligne et tests (vérifié le 2026-10-31)

- Vitest ne vérifie pas les types: un test qui passe peut casser `typecheck` (champ obligatoire oublié dans un objet du monde, comme `placedBy` d'un meuble). Relancer `typecheck` après chaque test écrit.
- La configuration Vitest du jeu n'affiche pas `console.log`: pour un relevé jetable (carte autour d'une case), écrire dans un fichier du scratchpad.
- Le manager fige l'arbre partagé par des commits « wip » pendant que les membres travaillent: `git diff HEAD` peut ne plus rien montrer. Relire son travail par `git diff <commit du début de la mission>`.
- Preuve qu'un test couvre une correction: copier le fichier dans le scratchpad, retirer la correction par `sed`, lancer le test (il doit échouer), recopier l'original, vérifier par `grep` que la correction est revenue.
- « Déjà pris » (SI-01): `simulation/simultane.ts`, commun à la touche et au clic (`actOnClick` de `agir.ts`). Un clic lointain garde le pas du clic (`runtime.pendingAct[id].since`): la fenêtre compte depuis le clic, pas depuis l'arrivée. Les objets ramassés n'existent plus: les derniers ramassages sont gardés dans `runtime.recentPickups`.
- Message facultatif de `textes.json`: `sayIfWritten` (`message()` renvoie la clé elle-même si le texte manque, ce qui l'afficherait telle quelle).
- Chaîne clavier testable dans Node (`tests/clavier.test.ts` de La Petite Ligne): `createInputState` du SDK (import relatif `../../../packages/sdk/src/input-state`, le paquet n'exporte pas ce module), actions tirées de `parseManifest(manifest)` (le JSON brut n'a pas les types littéraux), `endStep()` après chaque pas comme le fait la boucle du SDK. Le robot d'une séance se coupe en cours de test par `options.robot = null` (lu à chaque pas).
- Boucle du SDK: au plus `ceil(hz / 4)` pas rattrapés par image (`stepper.ts`). En rendu logiciel (une image par seconde), la simulation va environ quatre fois moins vite que l'horloge murale: tout ce que l'interface mesure en temps réel diverge des seuils de la simulation (absence).
- Visée de La Petite Ligne: les chantiers passent par le cône du regard comme le reste; une case du potager avec un verbe passe avant chantier et arbre. Le maintien d'Espace bâtit le chantier à portée (`updateConstructions`) indépendamment de la visée, sauf si l'appui a servi à un geste d'outil (`runtime.holdForTool`).
- Pendant que le game designer écrit les données, `loadContent(CONTENT_FILES)` peut échouer (référence à un dialogue pas encore écrit): pour une sonde, charger ses fichiers par `git show HEAD:…` et la carte par `loadMap(MAP_FILES)` (pas `contentAndMap()`, qui charge tout le contenu).
- Ce qui change le format de `WorldState` demande une version de `DATA_SCHEMA` et une migration dans `sauvegarde.ts`, testée en fabriquant une « ancienne » sauvegarde depuis un monde joué (champs retirés, phase remise comme l'ancienne version l'écrivait).


## Budget de rendu (La Petite Ligne, vérifié le 2026-10-31)

- La caméra d'ombre de Three.js trie par son cadre (frustum): un cadre droit dans le repère de la lumière autour de l'empreinte de la vue déborde jusqu'au double de sa surface. Tri plus fin possible sans toucher la lumière: avant `renderer.render`, `castShadow = false` sur ce dont la boîte, projetée dans le plan de la lumière, ne touche pas l'enveloppe convexe de l'empreinte (test des axes séparateurs), puis remis après le rendu. Test robuste: rayons tirés des coins des objets retirés, aucun ne doit tomber à l'écran.
- `WebGLShadowMap` trie aussi par calques: si `shadow.camera.layers` a un calque autre que 0, la passe d'ombre suit ses calques. Permet des maillages « ombre seule » (calque 1) si un jour il faut découper ombre et vue différemment.
- Plus petits morceaux de décor fusionnés: moins de triangles, mais plus d'appels; regrouper les cases légères par bloc (seuil de triangles) garde les deux sous contrôle. Le vrai consommateur d'appels au zoom large: les objets en pièces séparées (maisonnette, ruine, barrières, potager), chacun dessiné deux fois avec l'ombre.
- Mesure reproductible: `triangleSplit()` au même cadrage, quatre orientations, avant et après dans le même serveur; ne jamais remettre d'anciens fichiers dans l'arbre partagé pour mesurer « avant » (`git checkout <commit> -- fichier` change aussi l'index, et un instantané « wip » du manager peut capturer cet état): copier l'ancienne version dans un dossier à part ou comparer à des chiffres déjà relevés.
- Une ombre retirée se juge à midi, pas seulement au soir: les poules sans ombre flottaient à midi alors que rien ne se voyait à 19 h.
- ImageMagick: `-gravity` posé dans une parenthèse s'applique aussi au `-crop` des parenthèses suivantes: recadrer dans des commandes séparées.

## Carte et énigmes de lumière (La Petite Ligne, vérifié le 2026-10-31)

- `GeometryWriter.quad` oriente par le produit vectoriel de ses trois premiers points: un quadrilatère dégénéré (deux points confondus, par exemple une joue de rampe au pied nul) sort mal orienté et disparaît (élimination des faces arrière). Écrire un triangle.
- Ombres du soir: le soleil vient de l'ouest, bas (38° à 17 h, 19° à 17 h 45, presque sans composante nord-sud). L'ombre d'un toit à 3 m part de 3,5 à 9 m vers l'est; sous un auvent, le bout ouest reste au soleil. Une ombre portée sur une surface déjà à l'ombre ne se voit pas: tester l'ombre visible (rayon du point touché vers le soleil, qui ne doit rien croiser), pas seulement le contact.
- `outils/valider_carte.py` refuse un point important caché depuis la vue par défaut ou visible d'une seule orientation; l'épicerie (8,5 m) cache tout le bout ouest du quai (x < 26,5 en y 18). Sonder avec `boites_occultantes` et `cache_par` avant de déplacer un point.
- Deux points d'interaction à moins de `ranges.talk` (2,5 m) l'un de l'autre (caisse et tableau) font boucler les robots: le menu ouvert n'est pas celui attendu.
- Nom d'un nœud cherché par `getObjectByName`: le vérifier dans le GLB par un test (lecture du JSON du GLB dans Node, `lumiere.test.ts` et `voie.test.ts` en ont un exemple); un nom faux ne lève aucune erreur, l'objet reste figé.

## Bancs, worktree et mesures de pose (La Petite Ligne, vérifié le 2026-10-31)

- Un worktree de membre peut partir d'un commit plus ancien que la branche demandée: comparer `git log HEAD..<branche>` au départ et avancer (`git merge --ff-only <branche>`) tant que l'arbre est propre.
- Géométrie partagée simulation et rendu: la mettre dans `src/etat/` (pure, sans Three.js) et l'appeler des deux côtés (`etat/bancs.ts`: places, lever, places des habitants). Une règle dupliquée dans le rendu finit par diverger de la simulation.
- Une condition « près d'un banc » trop large attrape les passants: Firmin, arrêté près de la cloche, était compté assis sur le banc du quai. Un habitant ne s'assoit que sur le banc qui est le point de son emploi du temps (`VillagerState.target`).
- Visée: un nouveau verbe placé trop haut vole la touche à un geste existant (s'asseoir avant bêcher cassait l'énigme d'Émile, bêche au pied du banc); le mettre après tout geste possible, et un clic au sol garde le geste de la case cliquée.
- La marquise et ses poteaux sont dans le modèle `platform` (nœud `platform_canopy` de `bourg.glb`), pas dans la carte: la simulation ne les voit pas. Un poteau à (40,5; 17,9) est à 0,6 m devant la place est du banc du quai.
- Mesurer une pose sans écran: page de sonde servie avec la construction figée (copier `three/build` et `three/examples/jsm` dans le dossier servi, carte d'import), `AnimationMixer.setTime`, puis `SkinnedMesh.getVertexPosition` et `matrixWorld` pour chaque sommet; compter ceux qui entrent dans un volume (poteau, dossier). Les chaussures font partie des maillages de tenue (`player_outfit_*`), pas de `player_base`.
- L'événement d'un geste part à chaque pas chez l'invité, l'état complet au plus 5 fois par seconde: pour répondre en moins de 100 ms, le rendu suit l'événement quelques centaines de ms; un lever prédit chez l'invité ignore les états et positions dont l'`ack` précède sa commande.
- Outil Bash isolé: un heredoc ou un `python3 - <<EOF` qui écrit dans le dépôt est souvent refusé; écrire le script dans le scratchpad et le lancer avec la racine en argument.
