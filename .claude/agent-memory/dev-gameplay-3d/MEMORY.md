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
- Habitants et bancs (La Petite Ligne): le point d'emploi du temps d'un banc est au milieu de son emprise (infranchissable). Un habitant ne va jamais au point lui-même: il va à `villagerRestSpot` (devant la place, comme `standPlace`) et n'est dessiné assis qu'arrêté exactement là (`BenchSeating`, écart de 1 cm). Une tolérance plus large le fait clignoter assis/debout quand un joueur lui parle juste avant l'arrivée (il s'arrête, `speed` 0). Les trajets des habitants ne sont pas sauvegardés: après une reprise, `updateVillagers` les recalcule.
- `findPath` vers un point déjà atteint renvoie un pas de longueur nulle: l'habitant passe une image à `speed > 0` (dessiné debout). Ne pas tracer de chemin quand on est déjà rendu.
- Le soleil du soir de `DaylightRig` (17 h 30) a une hauteur d'environ 24°: une ombre de 1,7 m fait 3,8 m vers l'est. Sonde rapide: un test Vitest jetable qui écrit `rig.direction` dans un fichier, puis un calcul de rayons en Python.

## Revues visuelles et sondes de rendu (La Petite Ligne, vérifié le 2026-10-31)

- Avant de corriger un « défaut de couleur » signalé en revue, le regarder de très près: les « ornières en bandes gris clair » étaient des lames `wood_old` (#908879, un gris) posées contre le rail, pas le fond de l'ornière. Gros plan sans toucher au code: un greffon Vite du scratchpad (`transform`) qui remplace `viewWidths: [16, ...]` par `[4, ...]` dans `reglages.ts`.
- Comparer avant et après sans toucher à l'arbre: greffon Vite `load(id)` qui sert, pour quelques fichiers, la version copiée par `git show HEAD:...` dans le scratchpad (second serveur sur un autre port, choisi par une variable d'environnement). Même astuce pour neutraliser une optimisation (`transform`) et prouver par `compare -metric AE` qu'elle ne change pas l'image.
- Talus d'une rampe qui descend au niveau du sol: forcément un triangle en plan (le pied rejoint la rampe au bout). À 1 pour 1, il ne pointe plus vers le haut; à l'ombre, il reste un coin sombre, c'est la lumière. Coin contre le bout du platelage: un triangle dans le même plan à 1 pour 1, aucune face verticale.
- Les cases `wood` (traversées) ne sont pas dessinées par le sol: tout côté du platelage sans rampe doit être fermé jusque sous le sol, sinon on voit le ciel sous les planches là où le voisin (modèle du quai) s'abaisse.
- `heightAt` du terrain: un relief ajouté hors des cases (talus) doit y entrer aussi (maximum avec le sol), sinon pieds et touffes s'y enfoncent.
- Fusion des pièces fixes d'un bâtiment à coupe: un maillage par matériau et réglage d'ombre, montré seulement si toutes les pièces sont visibles après la logique normale (remises visibles au début de `apply`, cachées si la fusion prend la main). Les toits qui s'effacent pendant le chantier et les éléments à construire restent à part, sinon la fusion ne sert jamais.
- Page de rendu: `x` et `y` de l'adresse déplacent le joueur 1 (point de vue); un joueur assis reste dessiné assis (le rendu suit `seat`).

## Moments rares et secrets (La Petite Ligne, vérifié le 2026-10-31, tour 6)

- Tout nouveau type de `WorldEvent` casse le lint (`switch-exhaustiveness-check`) de `src/audio/declencheurs.ts`: y ajouter les cas, même sans son.
- Les JSON de `donnees/` ne sont pas au format de `json.dumps(indent=2)`: les retoucher par remplacement de texte exact (script `rep.py` du scratchpad: paires ancien/nouveau, échec si l'ancien manque), jamais par relecture et réécriture.
- Outil Bash isolé: `cd <jeu> && python3 /tmp/<moi>/rep.py <fichier relatif> /dev/stdin <<'EOF' ... EOF` passe; un `python3 - <<EOF` qui ouvre des fichiers du dépôt ou une boucle `for f in ...` est refusé.
- Un trajet au clic s'arrête au centre d'une case: à 0,5 m d'un point posé hors du centre (les places de l'échelle). Un robot qui doit « être au point » vise une portée (ici `moments.holdRange - 0,2`) et laisse la simulation le placer.
- Une étape finie par un compteur posé au début d'une chorégraphie (`moment_seen`) rend la quête finie pendant la chorégraphie: ce qui dépend de « l'étape en cours » (tenir l'échelle) ne doit plus l'exiger une fois l'apogée partie.
- Spline de Catmull-Rom entre deux images clés au même point: léger dépassement (environ 0,1 m) si la suivante s'éloigne; doubler l'image clé ou l'accepter.
- Tests sur un monde « truqué » (jour 1 avancé à la main): les rencontres passent avant tout dialogue (marquer les `meeting` comme faits), l'emploi du temps d'un habitant le rend invisible au pas suivant (appeler `talkTo`, `dialogueChoice`, `dialogueClose` directement), et la bêche en main vole Espace (verbe `dig`): vider la main (`selected` sur une case vide).

## Rendu des moments rares (La Petite Ligne, vérifié le 2026-10-31, tour 6)

- `/tmp/dg3d-t6` appartient déjà à un autre membre: prendre un dossier à son nom de mission (`/tmp/dg3d-moments`).
- Clip calé sur un temps extérieur (chorégraphie): `action.timeScale = 0` puis `action.time = t` à chaque image. Avec un pas nul, `AnimationAction` ne replie pas le temps d'une boucle: faire le modulo soi-même; les fondus avancent quand même (temps du mélangeur).
- Plusieurs bêtes dans un GLB (`faune.glb`): cloner le nœud de la bête seul (`SkeletonUtils.clone(node)`), pas toute la scène comme `cloneRig`.
- Catmull-Rom entre deux images clés au même point: dépassement vers la voisine. Deux images clés au même instant (la seconde sans clip) donnent un arrêt net sans bosse; `null` en clip garde le clip d'avant.
- Halo émissif sans programme de plus: les sprites posés du programme des particules (`createParticleMaterial(PARTICLE_MODE.sprites)`, groupe 2 immobile, forme `glow`), avec un `DataTexture` 1x1 comme champ.
- Habitant joué par une chorégraphie: `CharactersPart.setVillagerDirector` (pose et clip imposés, ou seulement la tête), appelé pendant la mise à jour des personnages; l'horloge du moment est calculée une fois par image (mémo sur `context.time`).
- Page de rendu: `vue=x,y` pose la caméra sans déplacer les joueurs (`setFocusOverride`), `moment=<id>&t=<s>` fige une apogée. Boucles shell refusées dans le worktree isolé: une capture par ligne d'un fichier lu par `lot.sh`.
- Le contrôle des tirets refuse de tourner en ligne de commande dans le worktree (mot « git » dans l'exclusion): le mettre dans un script du scratchpad.

## Mise en scène autour du décor (La Petite Ligne, vérifié le 2026-11-01, correctifs du tour 6)

- Contrôle « rien ne traverse » sans écran: lire les positions des maillages d'un GLB en Python (en-tête GLB, accesseurs, matrices des nœuds), échantillonner la surface des triangles (pas de 1 à 2 cm) avec leurs normales, poser chaque pièce comme le rendu (`rotation.set(0, yaw, tilt)`: Ry puis Rz local), puis `cKDTree` de scipy (`duo-python`): distance minimale entre pièces, et « dedans » si (p - plus proche) · normale < 0. Séparer bois et feuillage par la hauteur (dessous du houppier).
- `tree_oak_large` (bourg.glb, échelle 1,45): tronc de 0,23 m de rayon à 2 m, 0,19 m à 2,9 m; branche basse à l'est (Blender +X) de 1,9 à 2,9 m qui sort jusqu'à 0,65 m, autre branche à l'ouest-sud-ouest de 2,1 à 2,6 m; dessous du houppier vers 2,6 à 2,7 m près du tronc. Un objet de la carte se tourne par quarts (`rotation` dans `objet(...)`): le quart 1 envoie l'est au nord (yaw +90° autour de Y).
- Échelle de 0,45 m contre un tronc plus étroit: les montants passent de part et d'autre, c'est le dernier barreau qui appuie; avancer le pied jusqu'à quelques millimètres (mesurés) plutôt que viser un point « tête contre l'écorce ».
- Le test M-02 (`tests/moments.test.ts`) prend chaque case libre de l'anneau: avec un point d'ancrage hors du centre d'une case, des cases du bord tombent à 5,9 à 6 m et une bête à 0,3 m de l'ancrage du mauvais côté les perd. Sonde utile: test jetable qui écrit les pires cases dans un fichier.
- Serveur Vite de capture avec `watch: null`: il ne voit pas les fichiers modifiés après son départ (modules en cache). Le relancer après chaque modification du code avant de capturer; `pkill -f` sur sa ligne de commande renvoie 144 dans l'outil, vérifier le port avec `ss -ltnp` et tuer le pid.
- Trou tramé d'un lieu (pas d'un personnage): avancer le repère de profondeur (`nearer`) pour que ce qui est juste devant (échelle, tronc) reste plein, et ne l'ouvrir que si la caméra voit la face de l'objet (sinon il coupe le tronc qui est devant).
- Un compteur qui finit une quête (`moment_seen`) posé à la fin d'un spectacle: les tests qui attendaient la quête finie juste après le début doivent attendre la fin; une sauvegarde faite pendant le spectacle doit le finir au rechargement (`settleSavedClimax`), sinon le compteur n'est jamais posé.
- Les tests audio fabriquent un monde par `newSim` (phase du titre, pas `day`): tout filtre « journée seulement » demande `world.phase = 'day'` dans leur préparation.

## Correctifs légers et faune d'ambiance (La Petite Ligne, vérifié le 2026-11-01, tour 7)

- Hachage `h ^= h >>> 16; return h / 2 ** 32`: le dernier XOR rend un entier signé, donc parfois négatif. Finir par `(h >>> 0) / 2 ** 32` (bug encore présent dans `vers-luisants.ts`: des lanternes peuvent tomber hors de l'ellipse).
- Boîte d'un modèle dans son propre repère: ne pas composer `child.matrixWorld` et l'inverse du `matrixWorld` du parent (matrices des enfants pas à jour au premier passage, écart de 9 cm sur le nichoir); multiplier les `matrix` locales du maillage jusqu'au nœud.
- Trous de visibilité: un trou par personnage mené par un moment (`momentSeeThrough.actor`), calculé après la mise à jour des parties (pose de l'image en cours); `nearer` de 0,6 m garde l'échelle pleine et efface houppier et sapin devant.
- Main posée par le rendu (`portee.ts`): deux os et le buste, après le mélangeur, avec retour des rotations du clip avant sa mise à jour (comme `BoneOffsets`, sinon la pose s'accumule quand le clip est figé). Basile en haut de l'échelle (`reach_up`): épaules à 1,13 m au-dessus des pieds (genoux pliés), bras de 0,55 m jusqu'à `socket_hand_r`.
- Sonde de pose dans la page: `window.dgEngine.world.parts` donne les parties (`constructor.name`), leurs champs privés se lisent à l'exécution. Déplacer un joueur après le chargement: muter `engine.view.world().characters[0].pos` et `prev` avant `advance`.
- Petite faune côté rendu: le test du cadre (`Frustum` de la caméra, une sphère par bête, une pour tout le pré) suffit à ne rien animer hors champ; les papillons en deux instances d'aile par bête dans le programme des semis (palette instanciée avec couleur): zéro programme de plus, un appel.

## Moments du tour 7: chevrette, martin-pêcheur, brume (La Petite Ligne, vérifié le 2026-11-01)

- `/tmp/dg3d-t7` appartient déjà à un autre membre: prendre `/tmp/dg3d-t7m` (nom de la mission).
- Outil Bash isolé: un `python3 - <<'EOF'` qui n'ouvre que des chemins relatifs du jeu passe, sauf s'il contient le mot du gestionnaire de versions ou un dictionnaire littéral de chemins; un fichier de remplacements (`rep.py` + spécification `FILE ... %%% ancien === nouveau`) passe toujours. Le carnet s'édite avec Edit.
- Fusionner la branche du manager en cours de mission avec un arbre sale: diff dans un fichier, remettre les fichiers touchés, avance rapide, `apply -3` du diff, puis `reset -q` (l'application à trois voies remplit l'index).
- Pourtour: la forêt du bord (`vegetation.ts`, `plantOuterForest`) n'est pas dans la carte; le script de géométrie du game designer l'ignore. En orientation 0 elle cache le pré de l'est (bord est) et la rive sud (bord sud). Remèdes sans programme de plus: trou tramé sur les bêtes (`momentSeeThrough.animals`, milieu des bêtes dessinées) et trous des joueurs élargis pendant un moment (`momentSeeThrough.players`). Le trou du décor tranche aussi la forêt instanciée.
- Bouffées du programme des particules (brume): sans tampon de profondeur, une bouffée coupée par l'eau ou la berge montre un bord droit. Les poser au-dessus du plus haut sol sous elles et sous leur bas côté caméra (0,84 rayon plus bas, 0,4 rayon plus près à 35°), en petites bouffées nombreuses (700, rayon 0,55): plus de bords, une nappe continue.
- Couleur des bouffées: `uLitColor` = couleur du soleil x intensité / π, `uShadeColor` idem pour le ciel (comme `ambiance.ts`); `uLightView` = direction de la lumière dans le repère de la caméra.
- Un état « aux aguets » sans champ sauvegardé: les regards se tirent par empreinte (`unitDraw`) depuis `phaseTick` ou la fin du dernier effarouchement, et l'effarouchement se lit dans `today.shyUntil` (début = fin moins sa durée fixe). Mêmes instants pour la simulation, le rendu, le son et les robots, aucune migration.
- Les tirages épinglés du script se recalculent par `python3 -c "import moments_rares as m; m.play_12(seed, 15, 0.5, scaled=False)"` depuis `docs/jeux/jeu-1/simulations/`.
- Page de rendu figée (`today.paused`): les gerbes émises au franchissement de la surface n'apparaissent pas sur une capture figée (rien ne franchit); les juger en jeu ou au son.
- `eqeqeq` et `prefer-optional-chain` se contredisent sur `x?.y != null`: passer par une variable (`const s = x?.y ?? null; if (s !== null)`).
- Serveur Vite de capture lancé en arrière-plan: il est coupé à la limite de temps de la tâche (30 min par défaut); le lancer avec un `timeout` long.

## Correctifs de la recette QA7 (La Petite Ligne, vérifié le 2026-11-01)

- Une bête jouée par une chorégraphie doit repousser les joueurs à chaque instant où elle est dessinée (arrivée, effarouchement, apogée, départ), pas seulement à son point: `drawnPose` de `etat/moments.ts` donne la pose du rendu, `back = 1` le pas d'avant (sens de marche). Écarter perpendiculairement au trajet, sinon la bête pousse le joueur devant elle jusqu'à un mur et le traverse.
- `leaveNow` depuis l'état d'après rejoue `leave` depuis `afterPosition`: si tous les acteurs sont partis pendant l'apogée, aller droit à `gone` (`allGoneAfterClimax`), sinon la bête revient pour repartir.
- Preuve en jeu réel d'un correctif de phase: la recette QA garde ses sauvegardes et ses specs Playwright à deux navigateurs dans `/tmp/qa7/`; en copier la spec (sorties, port, dossier de données à soi), `vite build --outDir` du worktree dans un dossier avec `duo-game.json` et `package.json`, et le serveur `packages/sdk-dev/src/serveur/servir.ts` de la copie principale (sa `dist/coque` existe, pas celle du worktree). Deux minutes.
- Libellés `convert -annotate` dans une commande: refusés par l'outil isolé (texte trop complexe); les mettre dans un script du scratchpad.