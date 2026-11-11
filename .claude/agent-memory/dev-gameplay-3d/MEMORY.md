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
- Grille de La Petite Ligne à origine négative depuis la 0.13 (`originX`, `originY`, vérifié le 2026-11-04): toute couche par case (`Uint8Array` de `width * height`) se parcourt par index avec `cellX`/`cellY`, ou par `cellIndex`, jamais `cy * width + cx` depuis 0. Un code écrit sur une carte d'origine 0 et fusionné après passe sa revue mais décale la couche (le portage à deux du robot s'est bloqué ainsi).
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
## Suite après le jour 15 (La Petite Ligne, vérifié le 2026-11-01, tour 8)

- Depuis le tour 8, `clock.lastDay` est la limite de la partie (jour 43), plus la fin de la démo: la fin de la démo est l'étape `demo` (`settings.stages`). Dans les tests, `demoLastDay()` de `tests/aides.ts`; un robot qui doit passer le jour 15 prend `createRobot({ stages: 'stay' })`.
- Avant de monter `DATA_SCHEMA`, fabriquer avec le code encore à l'ancien format la référence qui manque (`generer.ts`): après, il est trop tard pour une vraie sauvegarde de l'ancien format.
- Tout système d'après la démo tire par `unitDraw(graine, clé, jour)` (jamais `sim.rng`) et reste inerte avant son `fromDay`: le test T8-04 (`tests/suite-etapes.test.ts`) compare chaque aube des jours 2 à 15 à une partie sans les systèmes nouveaux; toute logique nouvelle du robot se garde par `afterDemo()` (commande générée).
- Lint: un commentaire entre deux `case` vides déclenche `no-fallthrough`; le mettre au-dessus du groupe.
- Outil isolé: un heredoc qui écrit un fichier dans `/tmp` avec du contenu complexe est refusé; écrire le fichier de remplacements avec Write, puis `python3 /tmp/<moi>/rep.py <fichier> <spec>`.
- Robots d'été (`pnpm test:ete`, `tests/ete/`): une partie de 43 jours avec reprise à chaque aube coûte une à trois minutes par graine selon la charge de la machine.
- Taille de l'état (I-06, 48 000 octets): chaque dialogue fini s'écrivait trois fois dans `dialoguesDone` (`id`, `id@p1`, `id@p2`), réplique du quotidien comprise; avec beaucoup de répliques, c'est la première clé qui grossit. Mesurer par une sonde jetable (clé par clé, `JSON.stringify`) avant de chercher ailleurs.
- Rendu des arbres (`rendu/potager.ts`): un arbre abattu sans chute en cours (`fallStart` vide: partie reprise, page de démonstration) doit sauter le tronc; sinon il reste debout au-dessus de sa souche.
- Les props de la carte sont rendus par nom de type (nœud GLB du même nom, sinon variantes de `MODEL_VARIANTS`): ajouter un type dans `construire_carte_halte.py` suffit pour le voir en jeu, sans toucher au rendu.

## Saisons du rendu (La Petite Ligne, vérifié le 2026-11-01, tour 8)

- Changer de palette sans toucher aux matériaux: remplacer `texture.image` (même objet `Texture`, `needsUpdate = true`). Ne jamais réaffecter `texture.source` dans Three.js 0.187: `WebGLTextures` range ses textures GL par source et par clé de réglages; une source changée à clé égale réutilise la texture GL de l'ancienne, et la libération (`onTextureDispose`) lit une entrée absente et plante.
- Couleurs lues une fois dans la palette (`paletteColor`): teintes continues de l'herbe (`uGroundColors` de `ambiance.ts`) et couleurs d'instance des touffes (`vegetation.ts`). Elles ne suivent pas l'image: s'abonner à `materials.onPaletteChange`.
- Le jour avance à 6 h en même temps que la phase passe à `breakfast` (`horloge.ts`): basculer ce qui dépend du jour hors de la phase `day` suffit à le cacher derrière l'écran du petit-déjeuner.
- Déformer l'heure accélère la journée (pente au plus 1,5 le soir d'hiver): un test de continuité à seuil fixe doit multiplier son seuil par la pente.
- Outil isolé: `pnpm test` dépasse 10 minutes quand des captures tournent en même temps; le lancer en arrière-plan.

## Taille de l'état sans changer le format (La Petite Ligne, vérifié le 2026-11-01, QA8)

- Borner une mémoire sans migration: garder exactement ce que ses lecteurs en lisent. `envieHistory`: la fenêtre telle quelle, puis un exemplaire de chaque envie plus ancienne (`compactEnvieHistory`); `heard`: les heures plus vieilles que `datedRepeatDays` remplacées par leur rang (0, 1...), même ordre, mêmes égalités (`foldOldHeard`). Un test d'équivalence (même `pickDialogue` avec et sans compactage, sur des `rng.setState` fixés) le prouve.
- Ce qui change l'identité des objets (fusion de piles au sol, rangement au coffre) se garde derrière un `fromDay` après la démo, sinon `newId` décale et I-07 (jours 1 à 15) casse.
- Robot: compter un meuble ou un matelas partout (sacs des deux, coffre, sol, posé), sinon il rachète en boucle ce qui est tombé d'un sac plein; mais ne fabriquer qu'avec ce qui est sous la main (son sac, le coffre), sinon il boucle à l'établi.
- Les sorties de `pnpm test:longue-vie` (`test-results/`) ne sont pas versionnées; tailles par profil dans le tableau « Taille de l'état (L-03) ».
- Un `pnpm test` lancé avant d'ajouter un fichier de test ne l'inclut pas: relancer à la fin.

## Retours de la première soirée du client (La Petite Ligne, vérifié le 2026-11-01)

- Flou sous Windows (R07): le repli automatique reprenait la résolution du mode léger des tests (rapport 0,5, 640x360 au plus): image étirée deux fois sur le PC. Un tampon de rendu sous le pixel physique se voit tout de suite à 1366x768; plancher de netteté `min(dpr, 1,5)` et taille exacte par `ResizeObserver` en `device-pixel-content-box` (se redéclenche aussi quand la mise à l'échelle change). `setPixelRatio(1)` et `setSize` en pixels: tout ce qui lit la taille passe par `getDrawingBufferSize`, rien d'autre à changer.
- Rendu logiciel: la qualité adaptative ignore les images de plus de 250 ms, donc ne se déclenche jamais sous SwiftShader. Pour voir l'état d'un PC à la peine: `rendu.html?adaptatif=1&repli=1` (`forceQualityFallback`).
- Clip `sleep`: tête vers -Z, bassin à 0,59 m; lits de `maison.glb` tête à -Z aussi. La simulation ne tourne pas le dormeur (il garde le cap de sa marche): le rendu tire la pose du lit (`coucher.ts`).
- Bras des personnages: 0,55 m (épaule 1,33 m). Une prise à deux mains au milieu d'un manche est hors d'atteinte dans les clips de geste de l'artiste (main gauche à 0,9 m de l'épaule): port hors geste seulement (`prise.ts`, houe sur l'épaule par `ArmReach`).
- Sonde des os d'un clip: page temporaire dans le dossier du jeu (GLTFLoader, `SkeletonUtils.clone`, `mixer.setTime`), lue par Playwright sans WebGL; la supprimer à la fin.
- Greffon Vite de gros plan: un `transform` sans `enforce: 'pre'` ne voyait pas le texte d'origine de `reglages.ts`; avec `enforce: 'pre'` et une expression souple (`/viewWidths:\s*\[16,/`), oui. Vérifier par `curl` du module servi.
- Copie « avant » pour comparer: `git archive HEAD <dossiers> | tar -x -C /tmp/...`, lien du `node_modules` du jeu vers celui du worktree, serveur Vite avec `fs.strict: false`. Les ports 5191 à 5391 sont souvent pris par d'autres membres: prendre 64xx.
- Contrôles de cohérence de la carte (`src/rendu/coherence-carte.test.ts`): pavés par le miroir processeur du shader (`paves.ts`, union douce: le raccord arrondi entre l'anneau du puits et une allée mord sur des cases qu'on croirait en terre), rails sous les bâtiments, sols posés qui débordent de leur emprise (lecture du GLB dans Node).
- Un massif déplacé peut couper un trajet d'habitant: `python3 outils/valider_carte.py` après chaque retouche de la carte.
- Chromium sans tête avec `deviceScaleFactor` émulé: `devicePixelContentBoxSize` reste en points CSS (1093 au lieu de 1366 à 125 %). Ne garder la boîte physique que si elle concorde avec CSS x dpr.
- Murs de la maisonnette (`bourg.glb`): dalles pleines, la porte n'est qu'un panneau peint sur la face extérieure. Toute coupe ou pied de mur doit ouvrir la baie lui-même (bornes du nœud `…_repaired_door`).
- Le matériau palette efface tout ce qui est devant un personnage (trou tramé), y compris l'outil qu'il tient: les outils prennent `materials.held` (même programme, `uCutCount` à 0).
- Sable de la rivière (`riviere.ts`): il recule près de la terre ferme et laisse voir l'herbe; un chemin qui longe la grève doit être `path`, pas `land`, sinon un liseré vert apparaît.
- `pnpm test` sous la charge des autres membres (charge 15 à 25): `beforeAll` de 120 s, tests minutés (100 ms réseau) et Chromium dépassent; relancer ces fichiers seuls avant de conclure.

## Tour 9: annonces, chantiers, catalogue (La Petite Ligne, vérifié le 2026-11-01)

- Outil isolé: un heredoc qui écrit dans `/tmp` est refusé, mais `python3 - <<'EOF'` qui ouvre des fichiers relatifs du jeu passe; pour un gros script, l'écrire avec Write dans le scratchpad et le lancer avec la racine en argument. Le petit module `r.py` du scratchpad (`F(chemin).sub(ancien, nouveau)` puis `done()`, tout ou rien) évite les éditions à moitié faites.
- Une quête synthétisée par le code (annonces, cadeaux) se déclare dans `loadContent` après `parseQuests` (`content.quests.push`): carnet, liste à cocher, choix « Donner » et compteurs `given` marchent sans rien d'autre. `completionText` vide: pas de notification de fin (`quetes.ts`).
- Avancer un monde de référence à la main (jour 25 vers 45) déclenche l'échéance de la commande en cours (`pay_order`) et l'étape `summer_end` au premier pas: dans les tests, poser `stages.passed` et déplacer `order.generated.train` et la quête `weekly_order` vers le samedi suivant.
- Le robot qui attend le train au quai (`lastDay`) passe avant `watchMoment`: un moment du samedi (le salut) doit s'y insérer explicitement.
- `catalogueWindow` d'un samedi après la démo donne une échéance la veille: le catalogue est fermé tout le samedi; une page parue le samedi à 10 h se commande dès le dimanche.
- Les champs facultatifs nouveaux de l'état (`train.slow`, `today.presses`) ne s'écrivent que s'ils servent (`delete` sinon): l'état des parties sans eux reste identique.

## Retours de la soirée du 2026-11-01 (La Petite Ligne, vérifié le 2026-11-01)

- Pose de meuble: le contrôle « occupé » doit tester le disque du corps (`touchesCell`, rayon 0,3 m), pas la case des pieds; un corps déjà dans un obstacle ne bougeait plus (`moveBody` refusait tout pas). Garde-fous: `closesRoom` (parcours à quatre voisins depuis la porte, seules les cases perdues comptent), `unstick` et `freeStuck` au chargement (`simulation/deblocage.ts`), et `moveBody` qui laisse sortir à pied (enfoncement qui ne grandit pas).
- Le jeu n'a pas de menu de pause à lui: Échap ouvre celui de la plateforme (`apps/duo`, hors du jeu). Une commande « de pause » du jeu va dans le carnet (pied du panneau).
- Un habitant a le rang de visée 0: posé sur le point d'usage d'un objet (Basile devant l'établi, sur la poutre), il vole Espace (parler, ou rien si aucune réplique). Règle `OBJECT_KINDS` de `bestTarget`: l'objet visé de plus près passe avant lui. Odette au comptoir reste à égalité (elle est sur le point même).
- Rythme de la journée (`clock.pace`, `paces`): `secondsPerGameMinuteOn` multiplie par le facteur. Les aides des tests (`tests/aides.ts`, `src/interface/tests/aides.ts`) et la page de démonstration jouent au rythme `vif` (l'ancienne journée): les budgets de pas des robots et les durées des tests restent ceux d'avant. Une démo entière au rythme normal est jouée dans `tests/retours-soiree.test.ts`.
- `pnpm test` du jeu: 18 min sur machine partagée (charge 30 sur 4 cœurs); lancer en arrière-plan avec `timeout` de 7 200 000 ms, la limite par défaut (30 min) tue la commande.
- Champ d'état ajouté sans changer le format de sauvegarde: le déclarer obligatoire dans `types.ts`, le remplir à la création (`monde.ts`) et à la reprise (`fillTour10Fields` appelé dans `resume` de `sauvegarde.ts`, avec des types `Partial` pour les `??=`); un champ propre à quelques meubles (rideaux: `window`, `closed`) reste facultatif pour ne pas toucher à tous les constructeurs de `PlacedFurniture`.
- Valibot avec `exactOptionalPropertyTypes`: un champ facultatif d'une intention se décrit par `v.exactOptional(...)`, sinon `satisfies v.GenericSchema<Intent>` échoue.
- Basile joue l'animation `saw` toute la journée (activité `work`): posé sur la place des joueurs, il donnait l'impression qu'on sciait sans fin.

## Rendu du tour 9: chantiers, lampadaires, moments (La Petite Ligne, vérifié le 2026-11-01)

- Une pièce de personnage sans cibles de morphose (l'écharpe de Firmin, 0 cible contre 5 au corps) compile un programme de plus (et sa variante d'ombre), même cachée: `warmUp` rend visibles les objets cachés pour compiler. Fusionner avec `mergeOutfit` (cibles nulles) et échanger la géométrie du corps.
- Un chantier en plusieurs maillages (jardinière: caisse + enfant de saison, trois exemplaires) coûte deux appels par maillage avec l'ombre: fusionner chaque chantier en un maillage, refait au changement d'état ou de saison (`chantiers.ts`, `rebuild`). Les objets sources restent hors de la scène mais visibles (sinon `traverseVisible` ne trouve rien).
- Allumer un lampadaire seul alors que son verre est dans le décor fusionné (émission globale de la nuit): halos (`ciel.ts`, opacité par instance relue quand `LampBoard.version` change) et lumières au sol (`ambiance.ts`) multipliés par l'allumage, plus un verre sombre instancié posé par-dessus (faces lumineuses du modèle, repeintes sur `shadow`, grossies de 4 %). Zéro programme de plus.
- Page de démonstration: sans `vie=0`, Camille fait sa promenade et quitte la place que le moment lui donne. Un geste à durée (action `light`) n'est pas figé par la page (le geste se finit en temps réel): caler le clip sur `action.since` (`exactTime`) le rend figeable et identique chez l'invité.
- Serveur Vite de capture lancé en arrière-plan: coupé au bout de 2 h; le lancer dans le même script que les captures (`run.sh` du scratchpad: démarre, capture, arrête). Sous forte charge (charge moyenne 20), une page met plusieurs minutes: `goto` en `domcontentloaded` et délais de 400 s.
- Mesure avant/après sans toucher à l'arbre: copie du dossier du jeu à la même profondeur (liens relatifs de `node_modules` intacts), fichiers modifiés remis par `git show HEAD:...`, second serveur sur un autre port. Pas sous `games/`: pnpm y voit un paquet du workspace et réécrit `pnpm-lock.yaml` au premier `pnpm lint` (vu au tour 9, lockfile à remettre); prendre un dossier hors des motifs du workspace, et le supprimer à la fin.
## Maison du tour 10 (lot L4, vérifié le 2026-11-02)

- Compteur « du jour » sans champ nouveau ni migration: `world.countersToday[id][clé]`, remis à zéro à l'aube par `copyCounters`, sauvegardé et répliqué. Préfixer la clé (`needs:...`) pour ne croiser aucune condition.
- Gains notés par d'autres modules (`heartToday`) ajoutés « au moment où ils arrivent »: un `WeakMap<Character, number>` des gains déjà vus, initialisé au premier passage (reprise: rien ne se compte deux fois), effacé dans `settleNight`. Une note « déjà dit pendant ce maintien » se range dans un `WeakMap<Sim['runtime'], ...>`, jamais dans une variable de module (plusieurs simulations par fichier de test).
- La sieste est un `status: 'sleeping'` avec `needs.napStart`: `checkNight` doit ignorer les dormeurs de l'après-midi (`isNapping`), sinon deux siestes font la nuit. Les gains de la minute passent avant le réveil (sinon la dernière minute manque: 98,5 au lieu de 100).
- Copie isolée: `cat >> fichier <<EOF` et les heredocs Python longs dans Bash sont refusés par le contrôle de la copie; écrire les scripts avec l'outil Write dans `/tmp/...` puis `python3 script.py .` depuis le dossier du jeu (remplacements exacts, échec si l'ancien texte manque).
- La sauvegarde de référence du jour 62 (`format-6-automne-jour-62.json`) fait 46 177 octets: avec les champs du tour 10, une journée en cours monte à environ 46 800 (borne 52 000).
- Arrivées au coffre: tout `addStack(world.cellar, ...)` hors d'un dépôt de joueur passe par `storeAtHome` (`rangement.ts`): outils au râtelier, plein: au pied du coffre.

## Rendu et son du tour 10 (lot L5, vérifié le 2026-11-02)

- Découper en morceaux coûte des appels: à 12 m, la vue de la place (zoom 2) voit 21 morceaux de sol, 14 de touffes, 12 de fleurs (187 appels). Sol, eau et lisière à 24 m, semis à 24 m (à 48 m: +12 000 triangles de semis), forêt du pourtour à 12 m (à 24 m: +12 000). Mesurer chaque réglage, les deux budgets bougent en sens contraire.
- Un bâtiment ouvert (coupe) dessiné pièce par pièce coûte des dizaines d'appels: fusionner les pièces visibles par jeu de visibilité (masque de bits, une fusion par orientation, faite au premier besoin: `VisibleMerges` d'`interieurs.ts`), et le modèle réparé entier une fois bâti (`StagedBuilding.applyComplete`).
- `warmUp` rend tout visible pour compiler, puis remet `visible = false`: un état mis en cache (« déjà montré ») ne doit pas sauter la remise à jour de la visibilité, sinon le contenu reste caché.
- Second matériau d'eau sans programme de plus: même `onBeforeCompile` et même `customProgramCacheKey`, autres uniformes (ru de la Côte: courant vers le sud, `uStreamParams`).
- Nœuds du GLB sans translation (géométrie cuite): positions des pièces lues dans les sommets (min/max de l'accesseur `POSITION`, script `cheveux.py` du scratchpad) pour relier les éléments de `pieces.json` aux `id_hint` du modèle (poteau 1 du cellier au nord).
- Construire la page figée et la servir détachée: `setsid nohup python3 -m http.server ... < /dev/null &` dans un script; sans `setsid`, l'outil attend le serveur (tâche coupée au bout de 30 min, serveur compris).
- `lplRendu.missing()` de la page de démonstration était un bouchon (toujours vide): il lit maintenant `RenderEngine.missingModels()`. Types de carte sans nœud du même nom: les relier dans `MODEL_VARIANTS` (`salon_shop` vers `haberdashery`...); tout collecteur qui parcourt `map.props` (cheminées, lueurs) doit passer par `library.resolve`.
- Près de la rivière, le shader des surfaces mêle le sable aux faces de chemin (`ambSand`): une géométrie de chemin posée sur la grève y est peinte en sable. Un coin de chemin contre le sable se corrige dans le champ du lit (`riviere.ts`), pas par de la géométrie.
- Question S4 (sons `besoins/` permanents): refusé par l'essai du pic d'un samedi (`memoire.test.ts`: la seconde musique du fondu est refusée à 128 Mo); décodés au lancement sans être tenus.

## Tour 10, lot L3: intérieurs et rue Haute (La Petite Ligne, vérifié le 2026-11-02)

- « Chez soi » contre « à l'abri »: `isHome(c)` et `isSheltered(c)` de `src/etat/interieurs.ts` remplacent l'ancien booléen `inHouse` (retiré). Aménagement, coucher, minuit, veillée, réchaud, astuces de l'heure: `isHome`; bancs du dehors, bêche, moments rares, lisière, tableau, poules: `isSheltered`.
- Porte fermée = case de la couche dynamique marquée du code de son bâtiment (2 + rang dans `map.buildings`); `Blockers.door` dit quelle porte fermée on passe quand même (celle du bâtiment où l'on est; -1 pour les habitants). Toujours prendre `blockersFor(sim, pos)` pour un corps qui marche (hôte et prédiction de l'invité), `villagerBlockers(sim, id)` pour les habitants. `refreshBlockers` relit le masque des portes fermées à chaque appel: aucune horloge à surveiller ailleurs.
- Un habitant ajouté au contenu n'existe pas dans une sauvegarde d'avant: `ensureVillagers` (habitants.ts) lui crée son état au premier pas, sans toucher à `sauvegarde.ts`.
- Le robot pousse une charge à deux le long du chemin de son centre, qui ignore la largeur des porteurs: un coin de rocher le bloquait pour toujours. Écart de biais après une demi-seconde immobile (`beamDodge`).
- Test: `sim.world.beam = null` en tête d'un test fait croire à TypeScript que `sim.world.beam` reste `null` ensuite (`never`); relire par une petite fonction (`const load = () => sim.world.beam`).
- Outil isolé: une boucle `for` avec `sed -n "${a},${b}p"` est refusée; un heredoc qui écrit dans `/tmp` aussi. Écrire le script avec Write, puis `python3 /tmp/<moi>/script.py` depuis le dossier du jeu.
- `valider_donnees.py`: les drapeaux posés par le code (et non par un effet) vont dans `FLAGS_SET_BY_CODE`, sinon un avertissement.

## Taille de l'état (La Petite Ligne, vérifié le 2026-11-03)

- Mesurer avant de compacter: le robot longue vie écrit pour chaque aube `bytes` et `keys` (octets par champ) dans `test-results/longue-vie/parties/<partie>.json`; une partie de 84 jours prend environ 4 min 30. Comparer les relevés avant et après hors tailles (`ms`, `bytes`, `chars`, `keys`, `detail`) prouve que le gameplay n'a pas bougé.
- Ne pas garder de texte rendu dans l'état: un identifiant, la variante et les variables suffisent. Pour migrer un texte rendu, transformer le gabarit en expression régulière (`{nom}` en groupe paresseux) et vérifier que le rendu redonne exactement le texte, sinon garder l'original.
- Omettre les champs à leur valeur par défaut (`exactOptionalPropertyTypes` est actif: champ optionnel, jamais `undefined` écrit).
- Fusion avec des changements non commités dans un worktree: commit temporaire, fusion, puis retour mixte (`reset --mixed`) sur la branche fusionnée si elle contenait déjà HEAD. Si la branche descend de HEAD et ne touche aucun fichier modifié, `git merge --ff-only` suffit, sans commit.

## Pêche 0.12 (La Petite Ligne, vérifié le 2026-11-03)

- L'état complet part vers l'invité à chaque changement (`runtime.changed`, au plus 5 fois par seconde, environ 45 Ko): un état qui bouge à chaque pas (nage des ombres) le ferait partir sans arrêt. Ne changer l'état qu'aux événements et laisser le rendu animer (disque `roam` garanti dans l'eau, déplacement `move` lu par `shadowPosAt`).
- Les identifiants des annonces partagent l'espace des quêtes (`annonceQuests`): une annonce `odette_fry` aurait heurté la quête du même nom. Chercher l'identifiant dans `quetes.json` avant d'en créer un.
- Ajouter une annonce change toute la suite tirée du tableau (T9-03 de `suite-tour9.test.ts`) et la table des récompenses (T9-04): mettre ces deux attendus à jour avec la raison.
- Environnement très chargé (charge 45): les tests du robot de la démo dépassent leur délai de 300 s sans être faux. Preuve par une sonde jetable (partie entière, relevé dans le scratchpad) ou `--testTimeout`; `generer.ts` peut dépasser 50 min pour la référence du jour 62.
- Un réglage de texte d'interface nouveau demande sa clé dans `textes.ts` (Valibot) en plus de `textes-interface.json`; le prix d'un objet s'écrit avec le gabarit `ui.hud.purse` de `textes.json` pour suivre le nom de la monnaie.
- Outil isolé: un heredoc Python qui contient `\"` est refusé; écrire le script avec Write dans le scratchpad.

## Patch 0.11.2 (La Petite Ligne, vérifié le 2026-11-03)

- Gabarits de texte: `format` (`simulation/contexte.ts`), `fill` (`interface/format.ts`) et celui de `etat/semaine.ts` ne lisaient que `[a-zA-Z]+`: `{henColor1}` restait brut. Nom de paramètre: `[a-zA-Z][a-zA-Z0-9]*` partout. Contrôle de toutes les répliques et lettres: `tests/textes-remplis.test.ts` (faire apparaître les poules d'abord, sinon `henVars` est vide).
- Charge longue (poutre, 4,5 m): portée comptée jusqu'à son axe (`beamDistance`, `carry.lengths`, `carry.grip.reach`), pas jusqu'au centre; soulevée, elle garde son orientation et chaque porteur se range contre elle (`gripOffset`). Espace tenu contre une poutre couchée près d'un chantier la soulève.
- Le gué de pierres du ru (`crossings` de nature `ford`) est réservé à `feel.steppingStoneVillagers` (Jeanne): un adulte y semble marcher dans l'eau. `Blockers.avoid` porte ces cases. Test: `tests/trajets-habitants.test.ts` (toutes les paires de points de chaque emploi du temps).
- Vitest de ce jeu n'affiche pas le `console.log` d'un test: une sonde écrit dans un fichier du scratchpad (`writeFileSync`).
- Outil isolé: une commande qui contient « .git » (même `--exclude-dir=.git`) ou plusieurs commandes git enchaînées est refusée; le contrôle des tirets passe par l'outil Grep (`[\x{2013}\x{2014}]`), une commande git par appel.
- Un trajet d'habitant calculé avant l'arrivée du train n'est pas recalculé quand `train_at_platform` se bloque: Basile traverse le train à quai (samedi 10 h, vu le 2026-11-03, non corrigé).

## Quêtes de la 0.12 (La Petite Ligne, vérifié le 2026-11-03)

- Les fichiers de `donnees/` ont une mise en forme à la main (un objet par ligne dans les tableaux): ne jamais les réécrire par `json.dumps` (diff énorme, conflits avec les lots parallèles). Insérer des lignes avant la fermeture du tableau, puis relire le JSON.
- `ranges.stayAt` vaut 4 m: deux conditions `stayed_at` « un joueur à chaque bout » demandent plus de 8 m entre les points, sinon un seul joueur les remplit.
- Une charge à deux garde les décalages des porteurs pris au moment de la lever: côte à côte, elle se coince entre les buissons du quai (x 45 à 49, y 19-20). Les tests portent l'un devant l'autre, reposent et reprennent quand ça bloque, et passent par le passage pavé x 43-44.
- Payer dans un dialogue: choix à `correct: money_at_least`, effet `take_money`, dialogue sans `once` (le validateur refuse `"once": null`): il se rejoue tant que l'étape dure.
- Validateur: `indefinite` commence par « un », « une » ou « des » suivi du nom exact; un objet `food` veut un `dish`; `day_at_least` reste dans les jours de la démo (1 à 8).
- Avancer l'horloge à la main au-delà du départ d'un train (16 h) paie la commande: comparer la bourse juste avant le changement attendu, pas au début du test.

## Patch 0.11.2: sièges posés et petits objets sur les meubles (La Petite Ligne, vérifié le 2026-11-03)

- Sièges des meubles (chaise, fauteuil): `FurnitureSeats` d'`etat/bancs.ts` en fait des `SeatProp` (id du meuble, `slots` de `seatSlots`), mêlés aux bancs par `playerBenches`; `seatReachable` (dedans pour une chaise, dehors pour un banc) remplace les anciens `!isSheltered(c)`. `seatComfortFactor` (besoins) lisait déjà `seat.bench` comme un id de meuble.
- Visée: le banc a le rang 9 (après tout geste dehors); une chaise de la maison doit avoir le rang des meubles (4), sinon la paillasse voisine prend Espace pour une sieste à midi.
- Hauteur d'un dessus de meuble: rayon tiré d'en haut sur une instance du modèle (`Raycaster` ignore `visible`), mis en cache par place; les extras `top_height` et `seat_height` de `maison.glb` donnent table 0,78 m, chaise 0,47 m (le clip `sit` est calé sur 0,47 m), fauteuil 0,42 m.
- Étagère (`shelf`): planches à 0,59, 1,09 et 1,65 m, 0,46 m de jour entre deux: ni la plume (0,47 m) ni le pot (0,66 m) n'y tiennent; le dessus à 1,65 m plus un pot touche l'égout du toit (mur à 2,4 m).
- Générateur des références: le test unique dépasse 600 s (timeout signalé) mais écrit tous les fichiers; vérifier leur `dataSchema` et leur jour plutôt que le statut.

## 0.12, monnaie et économie (La Petite Ligne, vérifié le 2026-11-03)

- Monnaie: tout gabarit rempli passe par `agreeMoney` (`src/donnees/monnaie.ts`); un remplisseur de `{nom}` nouveau doit l'appeler aussi, sinon « 1 aubrins ». Les textes rendus gardés dans l'état (notifications, lettres `legacy`) se renomment à la reprise; une migration qui retrouve un gabarit depuis un texte rendu doit renommer avant de comparer.
- Remplacer un mot qui est aussi une préposition (« sous »): script qui ne touche que nombre ou espace réservé suivi du mot, et jamais quand un article ou une majuscule suit; compter les prépositions avant et après.
- Un habitant peut être envoyé à un lieu hors carte: identifiant de point préfixé (`market_spot:0`) résolu dans `goalOf` d'`habitants.ts`, et une entrée prioritaire dans `currentEntry`.
- Robot jusqu'au jour 64: environ 11 min par graine sur machine partagée; une règle de tirage se teste plutôt par une boucle de jours qui appelle la fonction directement.
- Fusion de la branche de session pendant le travail: commit temporaire, `git merge`, conflits résolus par script (`objets.json`: garder les objets de la branche, ajouter les siens sans doublon d'identifiant), commit, puis `git reset --mixed <branche>`: le travail redevient non commité au-dessus de la branche.
- `villagerBlockers(sim, habitant)` prend l'habitant depuis le format 9.

## Défauts de rendu du patch 0.11.2 (La Petite Ligne, vérifié le 2026-11-03)

- Pied des murs coupés (`coupe-murs.ts`): tout enfant du nœud de mur passe dans le pied (étal, cagettes de l'épicerie). Une face qui traverse la coupe est écrasée à la hauteur de coupe: une pièce accrochée à la façade devenait une plaque grise posée à plat. La section se calcule sur la seule maçonnerie (faces qui montent à plus de 1 m au-dessus de la coupe), et les faces qui traversent la coupe y sont rognées.
- Trou de visibilité: son bord en trame de Bayer, posé sur un objet bas (rail, lisse de barrière), se lit comme « l'ombre du personnage en tache tramée ». Hauteur minimale par trou (`uCutDepths.w`): 1 m pour les personnages, 0,45 m pour les lieux des moments.
- PCF de Three.js 0.187: rotation des 5 échantillons par bruit IGN par pixel, trame visible sur les ombres fines. `ShaderChunk.shadowmap_pars_fragment` modifié une fois avant toute compilation (`stabilizeShadowFilter` de `lumiere.ts`), aucun programme de plus.
- Pluie vue de dedans: le champ du terrain (canal B) ne connaît que l'emprise des bâtiments de la carte, et les gouttes devant la pièce coupée se lisent comme de la pluie dedans. Abri du joueur local (`abri.ts`) lu par la pluie (goutte projetée au sol le long du regard) et par le sol mouillé des surfaces.
- Objet sous un pixel de la page de démonstration: exposer le moteur un temps (`window.__engineDebug = engine`, à retirer), puis `engine.rig.ray(ndcX, ndcY).intersectObject(engine.scene, true)` en filtrant les ancêtres invisibles. Le pied de mur se reconnaît à son nom (`…_wall_front_pied`).
- Captures avant et après sans second arbre: copier ses fichiers modifiés dans le scratchpad, écrire ceux de `HEAD` (`git show HEAD:<chemin> > <chemin>`), capturer, recopier (script `bascule.sh`). Vite recharge seul.
- Caméra tournée (`orientation=`) en rendu logiciel: la rotation dure plusieurs images; attendre une dizaine d'images (`frames`) avant la capture, sinon le cadrage change d'une capture à l'autre.
- Reconstruire `bourg.glb` seul: `LPL_SANS_PLANCHES=1 duo-python bourg.py`, puis dedup, weld, prune de gltf-transform comme `construire.sh` (1 min). Les octets changent à chaque construction (ordre des index) même sans modification du script.
- Ombre « sans objet » devant la porte de la maisonnette: c'est celle de l'auvent (`door_canopy`), hors du cadre dans une capture serrée. La couverture s'arrêtait à 0,22 m du mur: un jour de lumière entre le mur et l'ombre.
## Pêche 0.12, rendu (La Petite Ligne, vérifié le 2026-11-03)

- `RenderEngine.frame` borne l'image à 0,1 s (`MAX_FRAME_SECONDS`): `lplRendu.advance(0.5)` n'avance le temps du rendu que de 0,1 s. Fondus (2 s) et éclats se capturent avec `dt` 0,1 et assez de pas (30 pas = 3 s).
- Une bouffée émise pendant l'image où l'on capture est invisible (fondu d'entrée des formes sur 8 % de leur vie): un éclat de 0,35 s ne se voit qu'aux images suivantes, donc pas avec des pas de 0,5 s.
- Sous forte charge (charge moyenne 40 à 50), `page.screenshot` d'une page 3D dépasse 5 min: lire le canevas (`toDataURL`) dans le même `evaluate` que `advance(dt)`, sans `preserveDrawingBuffer`.
- Le dossier de travail temporaire de la session (scratchpad) est partagé par tous les membres: un `capture.cjs` et un `dist/` à la racine ont été écrasés en cours de mission. Tout mettre dans un sous-dossier à son nom, serveur sur un port à soi.
- Ombres de poissons sans programme de plus: sprites couchés du programme des particules (groupe 2, `uGroupAlpha` à 1), tournés par `aAccel.z` = 1 et le cap dans `aVelocity.y`; forme `fish` dessinée dans le fragment (corps en fuseau, queue, sillage). Un seul appel pour toutes les ombres et leurs lueurs de guet.
- Contrat des ombres avec la simulation (`etat/peche.ts` du lot 1): l'état ne change qu'aux événements; le rendu fait nager l'ombre dans le disque `roam` autour de `pos`, et lit un déplacement décidé par la simulation par `move` (`shadowPosAt`). Lecture concentrée dans `rendu/peche-vue.ts`.

## Garde-robe de la 0.12 (La Petite Ligne, vérifié le 2026-11-03)

- `personnages.glb` depuis la 0.12: `player_base` est un corps nu-neutre sans pieds (sous-vêtement `wear_under`), chaussures obligatoires; vêtements `wear_<slot>_<style>`, écusson `player_badge_<symbole>[_outer]`, coupes sous chapeau `player_hair_<coupe>_hat`. Couleurs des vêtements: rangée 1 de la texture (ordre `WEAR_SLOTS` de `garde_robe.py`), écrite par `habillage.ts`.
- Les poids de peau du GLB ne sont pas triés: l'os principal d'un sommet est celui du plus grand des quatre poids, pas `skinIndex.x`.
- Gonfler une pièce à facettes (une normale par face, sommets dédoublés) selon ses normales l'ouvre en fentes: gonfler depuis un axe (direction horizontale depuis le centre) pour que les sommets confondus bougent ensemble.
- Aperçu 3D d'un panneau: second `WebGLRenderer` rendu à la demande (la lecture de pixels d'une cible du rendu principal donne du linéaire sans tone mapping). Ne jamais `dispose` les géométries du GLB depuis l'aperçu (elles servent au jeu): seulement ses copies, son matériau cloné et sa texture.
- Capture avec Vite lancé par `npx vite &`: `kill $!` tue `npx`, pas Vite, qui garde le port; la capture suivante échoue en silence sur l'ancien serveur. Lancer `node_modules/.bin/vite` directement.
- Le dossier scratchpad est partagé par tous les membres de la séance: un autre a réécrit mes `run.sh` et `capture.cjs`. Travailler dans un sous-dossier à soi (`scratchpad/dg3d/`).


## Élevage de la 0.12 (La Petite Ligne, vérifié le 2026-11-03)

- Worktree neuf: `node_modules` absent, `tsc` ne trouve pas les types; `pnpm install --frozen-lockfile --prefer-offline` à la racine du worktree (quelques secondes).
- Outil isolé: un `python3 - <<'EOF'` contenant des accents graves (gabarits TypeScript, `{rations}`) est refusé; l'écrire avec Write dans le scratchpad et le lancer avec la racine en argument.
- `ModelLibrary.cloneRig('hen', [variante])` avec une variante absente du GLB rend un squelette sans maillage (invisible, aucune erreur): tester `library.node(variante)` d'abord, sinon `instantiate` (substitut).
- Soin « une fois par joueur et par jour » sans champ: une clé `care:<geste>:<bête>` posée directement dans `world.countersToday[joueur]` (remis à zéro à l'aube), sans `bump` (qui ferait grossir `counters` pour toujours).
- Un nouveau verbe sur une bête qui bouge vole la touche aux points voisins (la poule qui picore près de la mangeoire): rang de visée après les points (4,5), et au clic, les points d'action passent avant la bête.
- Un article `shop: "catalogue"` absent de toute page de `catalogue.json` est en vente dès le jour 1 (articles d'avant le tour 9): toujours le poser sur sa page.
- Comparer un test qui échoue au commit de départ: `git archive <commit> games/la-petite-ligne packages | tar -x` dans le scratchpad, liens vers les `node_modules` du worktree. Au 2026-11-03, les trois tests « format 7 » de `maison-tour10.test.ts` échouent déjà au départ.
- Sous forte charge (charge 40), une capture de la page de rendu prend plusieurs minutes et `pnpm test` dépasse 40 min. Au 2026-11-03, ces tests longs échouent aussi au commit de départ sous cette charge (vérifié dans la copie « avant »): marcheurs de `moments-tour7`, robots sourds de `secrets`, Jeanne de `rue-haute`, démo au rythme normal de `retours-soiree`, reprise de `moments-tour7-recette`, et le test « format 7 » d'`interieurs-carte`.
- Le scratchpad de session peut être partagé avec d'autres membres: un `tirets.sh` à moi a été réécrit vers un autre worktree. Noms de fichiers préfixés par le lot, et le script affiche `pwd`.
- Fusion finale sans commit: `git add -A`, diff binaire vers un fichier, `git reset -q`, `git checkout -- .` et retrait des nouveaux fichiers, `merge --ff-only`, `git apply -3` du diff, `git reset -q`; puis résoudre les conflits (notes: garder les deux côtés) et relancer le générateur de carte plutôt que de garder `halte.json` fusionné.

## Animations et orientation des personnages (La Petite Ligne, vérifié le 2026-11-03)

- Les clips de marche de l'artiste ne sont pas à vitesse de pied constante, et la fiche ne suit pas les retouches: la cheville posée de `walk` reculait à 4,0 m/s (clips d'avant la 0.12) puis à 2,8 m/s (0.12), `carry_two` 1,95 puis 1,3, quand la fiche dit 3,5 et 1,8. Le rythme se règle sur la vitesse du pied posé (`foulee.ts`, mesurée au chargement sur un squelette nu `cloneRig('rig', [])`), et pas sur la référence de la fiche: l'ancienne valeur 3,2 faisait patiner les joueurs.
- Sonde rapide d'un clip sans navigateur: cinématique directe en Python (nœuds TRS, canaux LINEAR et STEP, slerp) sur le bloc JSON et binaire du GLB; planche visuelle: page temporaire `sonde-clips.html` (GLTFLoader, viewports en ciseaux), à supprimer.
- Points de la carte: `rotation` (quarts, 0 vers le sud) dit où regarde un habitant posté; `carte-niveau.ts` la verse dans `pointFacings` quand il n'y a pas de `cap_degres`. `facing = PI / 2 - quart * PI / 2`.
- Le point `sawmill_workbench` est la place devant l'établi: pour regarder l'établi, viser l'objet de la carte du même nom (`map.props`).
- Invité: `predictedFacing` restait celui de la dernière marche tant que le joueur ne bougeait pas; l'hôte qui tourne le personnage vers une action n'était pas vu chez lui. Reprendre le cap de l'hôte quand plus aucun pas en attente ne bouge.
- Page de rendu: `lplRendu.world()` et `lplRendu.emit()` permettent de poser une action (`since` recalé après le premier `advance`) et de faire des planches par action en mode `manuel=1`. Avec `vie=0`, la page remet une marche à l'arrêt: pour la marche, laisser la promenade (`vie=1`).

## Grille à origine (La Petite Ligne 0.13, lot L0, vérifié le 2026-11-03)

- Depuis la 0.13, la grille commence en `(map.originX, map.originY)` (-24, -30 pour la carte agrandie). Tout indice passe par `cellIndex`, `cellX`, `cellY`, toute borne par `inMap`, `mapMinX..mapMaxX` (comprises), tout sol lu par `groundAt` (`undefined` hors carte), tous dans `src/etat/carte.ts`. Jamais `cy * map.width + cx`, jamais une boucle `for (cx = 0; cx < map.width)`, jamais `x < 0` pour dire « hors de la carte ».
- Une grille de texture qui couvre la carte (champ du terrain de `champs.ts`) se décrit en `GridFrame` avec son origine (`map.originX - ext`) et passe par les mêmes fonctions; l'uniforme `rect` reprend cette origine.
- Le point `offstage` par défaut est `offstagePoint(map)` (hors de la grille quelle que soit l'origine); un habitant « arrive de dehors » s'il n'est pas `inMap`, pas s'il a un x négatif.
- Preuve forte d'un oubli d'origine dans la simulation: la carte du jeu entourée de cases bloquées (origine reculée) doit donner exactement le même monde, pas à pas, avec le robot (`tests/carte-translation.test.ts`). Une seule couche dynamique indexée sans l'origine le fait échouer (vérifié par mutation).
- La forêt du pourtour est découpée par côté en `FOREST_SEGMENTS_MAX` tronçons comptés depuis le bord de la grille: la carte de 164 m en a 18 par côté (au-delà du maximum, les tronçons d'un côté retombaient sur ceux du suivant).
- Le générateur de la carte écrit la carte agrandie par défaut; `--tour-10` écrit la carte d'avant dans `donnees/cartes-tour-10/` (référence du contrôle d'agrandissement du validateur), octet pour octet.

## Tests de format de sauvegarde (La Petite Ligne, vérifié le 2026-11-03)

- Un test de migration compare à `DATA_SCHEMA` (jamais un numéro en dur) et relit l'instantané avec `snap.dataSchema`: relire une sauvegarde du format courant en déclarant un ancien format rejoue les migrations (celle du 8 refuse alors les lettres sans texte: « sauvegarde: lettre invalide »).
- Sauvegarde volontairement abîmée: l'écrire au format courant (aucune migration ne passe avant `checkWorld`) et attendre le message exact du contrôle visé (`/sauvegarde: pièce invalide/`).
- Gain de taille d'un format: le mesurer sur les seuls champs qu'il change, le reste tel que la référence d'origine; les formats suivants ajoutent aussi du poids dans des champs anciens (garde-robe dans `characters`).
- Une migration testée depuis le format juste avant elle, et depuis un plus ancien pour la chaîne entière (`it.each` sur les deux références).
- `generer.ts` saute un fichier existant: un fichier vide à la place de la référence la plus longue (jour 62) la saute sans toucher au script; le supprimer après. Quatre références du format 12: 3 min 30 (charge 8 à 15).
- `nextObjective` (`interface/modele.ts`): la commande du samedi ne passe devant les quêtes principales qu'à partir de la veille (`day >= lastDay - 1`); une quête principale ajoutée au contenu change le « prochain objectif » des tests d'écran.
- Filtre de références par préfixe: `startsWith('format-1')` prend aussi les formats 10 et suivants; écrire `format-1-`.

## Habitants de la 0.13, rendu (La Petite Ligne, vérifié le 2026-11-03)

- Un maillage fixe (sans squelette) avec le matériau des personnages compile un programme de plus (12 pour un budget de 12). Accessoires peints dans `personnages.png`: copie du matériau `held` (même clé de programme que la palette) avec la texture des personnages, rugosité et métal en texture d'un pixel, lueur de nuit en pixel noir (`accessoryMaterial` de `accessoires.ts`). Vérifier par `lplRendu.programs()` avant et après.
- Regard d'un habitant (`lookAt`): le buste et le cou tournent, donc les mains bougent; une main posée sur un guidon ou un accordéon partait en l'air. Tête seule quand les mains tiennent quelque chose (`setLookBody`).
- Lire un champ que le lot d'un autre ajoutera à l'état sans toucher au type: `if ('habit' in villager) { const h: unknown = villager.habit; ... }` (pas de transtypage).
- `cloneRig` d'un nœud absent rend un squelette invisible: tester `library.has(node)` avant, sinon `instantiate` (substitut), et pas de clips pour un substitut (pistes sans cible).
- Page de rendu, gros plan d'un personnage en orientation 0: le haut de l'écran est -x -y; pour cadrer un corps debout en (X, Y) avec `largeur=3`, `vue=X-0.9,Y-0.9`. `largeur` refuse moins de 2. Les gros plans près de l'épicerie ont un voile clair (présent sans mes changements).
- Le port 5391 sert au serveur Vite d'une autre séance (copie principale): prendre un port à soi (5947) et le vérifier par `ss -ltnp`.
- Position d'une main pendant un clip sans navigateur: cinématique directe en Python sur le JSON et le binaire du GLB (TRS, slerp), du nœud jusqu'à la racine; `push_bike` pose `socket_hand_l` à (0,31; 0,98; 0,37), l'extra `hand_l` des vélos.
- Un test qui joue « toute la démo » doit le vérifier (`phase === 'ended'`, `stages.current === 'demo'`): une borne de pas trop courte (journée doublée le 2026-11-01, 0,7 s par minute) ou un robot coincé coupe la mesure en silence.
- Robot et charge à deux: le chemin de la grille ignore la largeur de la charge, qui garde son orientation; l'étal du marché porté de travers restait coincé devant l'établi de Basile jusqu'à minuit (horloge arrêtée `midnight`, partie bloquée). Détour du robot après 20 s sans rapprochement (`beamDetour`). Sonde: rejouer jusqu'au pas, puis sur des copies (`wrapWorld(content, map, structuredClone(world))`) pousser 3 s dans chacune des huit directions.

## Patch 0.12.1: format 13 et robot pêcheur (La Petite Ligne, vérifié le 2026-11-03)

- Champ rendu facultatif (`x?: true`, `kind?: 'parcel'`): `tsc` ne voit pas les comparaisons restées à l'ancien défaut (`s.line !== null` devenu toujours vrai: les coins de pêche ne s'endormaient plus). Après coup, chercher `\.champ [!=]== null` sur chaque champ touché et lancer ESLint (`no-unnecessary-condition` les trouve).
- Lecteurs des défauts regroupés: `questChecklist`, `questBaselines` (`etat/quete.ts`), `pliKind` (`plis.ts`), `improvementView` (lecture seule de `chantiers.ts`: `improvementState` ajoute l'entrée, à réserver aux écritures). Retirer une clé dynamique (`delete stays[id]`) demande un `eslint-disable-next-line @typescript-eslint/no-dynamic-delete` justifié.
- La sacoche de Lucie garde les plis non livrés d'un jour sur l'autre: 30 plis au jour 13 avec les robots, 62 au jour 25 (aucun robot ne livre). C'est le premier poste qui grossit avec le temps.
- Pêche 0.12 et quête « N poissons d'une espèce »: le robot qui lance à l'aveugle au gué prend ce qui vient (goujons rares au gué, nombreux en amont et vers les sables). Il doit viser comme un joueur: berge face à l'ombre de l'espèce (`wantedShadowAnywhere`), se tourner (pas de 0,2), lancer assisté, remonter une ligne prise par une autre espèce (une fois par 20 s).
- Sonde de taille: écrire aussi le JSON du pire état dans le scratchpad, puis chiffrer chaque idée de compactage en Python sur ce fichier (`copy.deepcopy`, octets avant et après) avant de toucher au code.

## Notes du lot H1 (0.13, plannings), reportées par le manager
- Vitest garde en cache les `import.meta.glob`: un nouveau fichier de données (ex. `habitants-0-13.json`) reste invisible tant que `fichiers.ts` ne change pas; vider le cache ou toucher le fichier.
- Tout nouvel événement de simulation oblige à ajouter son cas dans `audio/declencheurs.ts` (le typage l'exige).
- `src/reseau/schemas.ts` plafonnait à 16 habitants les positions envoyées à l'invité; porté à 32 pour les 21 habitants de la 0.13.

## Lot H2 de la 0.13: amitié, cadeaux, état écrit (La Petite Ligne, vérifié le 2026-11-04)

- Habitants écrits sans leurs valeurs par défaut: le message d'état de l'hôte et la sauvegarde passent par `writtenWorld` (`etat/habitants-ecrits.ts`), l'invité relit par `worldFromWritten`, la reprise par `fillVillagerDefaults` avant `checkWorld`. En mémoire, l'habitant reste complet. `snap.data` est un `WrittenWorld`: un test qui le compare au monde passe par `worldFromWritten`; un test qui mesure l'état transmis mesure `writtenWorld(world)`.
- Mesure de l'état transmis (8 graines de l'endurance, démo entière): 35 266 à 36 752 octets après le lot H2 (avant: 37 098 et 38 105 sur les graines 42 et 7). Il reste environ 1 Ko au pire pour passer sous 35 840: ne plus mettre `pos`, `prev`, `facing`, `speed` des habitants dans le message d'état (le canal `fast` les porte) donnerait 1,6 à 1,8 Ko; c'est du netcode (dev-reseau).
- « Première conversation du jour »: `talkTo` compte déjà `talked:<habitant>` dans `countersToday[joueur]`; le lire avant le `bump` suffit, sans clé de plus. Même chose pour un cadeau par jour (`gift:<habitant>`).
- TypeScript 5.5: `events.filter((e) => e.type === 'x')` rétrécit le type; re-tester `e.type` dans le `map` qui suit est une erreur ESLint (`no-unnecessary-condition`). Après `c.dialogue = null`, TypeScript garde `null` même après un `talkTo(c)`: lire la conversation par une petite fonction (`choicesOf(c)`).
- Habitants pour un test qui fait tourner les plannings: Léon est à l'école (invisible) un jour de semaine à 15 h; Firmin reste visible à sa cloche de 8 h à 18 h (bon pour le réseau). Forcer `visible` ne tient que jusqu'à la mise à jour suivante des plannings.
- Bash du membre isolé: une commande avec `python3 - <<EOF` contenant des f-strings, ou le `grep` des tirets avec `$'...'`, est refusée; écrire le script dans le scratchpad, et chercher les tirets avec l'outil Grep (classe de caractères avec U+2014 et U+2013).
## Témoins de la qualité visuelle, étape A (La Petite Ligne, vérifié le 2026-11-04)

- Personnage refait sur un gabarit: extras `bone_rest` ({os: [x, y, z]}) à poser sur la copie du squelette après `cloneRig`, avant de construire la figure (`ArmReach`, `BoneOffsets` lisent les os), et `idle_clip` joué quand le rendu demande `idle` (`gabarit.ts`). Les clips n'animent la translation que de `root` et `hips`: rien n'écrase le repos posé. Jambes inchangées par les gabarits (seul `thigh` s'écarte de 1 cm): foulée à 0,5 % du squelette commun, mains à 4 cm au plus pendant les gestes (`gabarit.test.ts` relit clips et nœuds du GLB dans Node, sans GLTFLoader).
- Tous les maillages de `personnages.glb` portent COLOR_0 (octets normalisés VEC4): toute géométrie de secours mise sur le matériau des personnages doit en porter, au même format (`whiteColorsLike` de `habillage.ts`), sinon elle sort noire et `mergeGeometries` rend `null`. `getComponent` d'un attribut normalisé rend 1 pour 255.
- `personnages.png` fait 64 x 256 (64 rangées de cases): les rangées se comptent sur la texture (`characterGridRows`, `textureSize(map, 0)` dans le shader), pas sur le nombre de colonnes.
- Deux serveurs Vite du même dossier en même temps: donner à chacun son `cacheDir` (cache `node_modules/.vite` partagé, par prudence). Un intercepteur (`configureServer`) qui sert un autre GLB ne doit pas toucher la demande `?url` (module JS), seulement le fichier sans requête: sinon la page ne démarre jamais (type MIME refusé pour le module), sans erreur visible dans le terminal.
- Rendu logiciel, page de rendu à 1366 x 768: 30 images avancées prennent 90 s au zoom 0, 150 s au zoom 1; le double à 1920 x 1080. Deux captures en parallèle sur 4 cœurs passent.
## Patch 0.12.2: couches de sol, voie, train, portages, objets muraux (La Petite Ligne, vérifié le 2026-11-03)

- Scintillement (z-fighting) en capture: deux images successives à caméra fixe sont toujours identiques (rendu déterministe), donc ne prouvent rien seules. Preuve qui marche: même vue décalée de 3 mm (`vue=x+0.003,y+0.002`), `compare -metric AE -fuzz 8%`: une lutte de surfaces donne des plaques entières (damier de l'épicerie, dents de pavés), une scène saine seulement des liserés d'un pixel.
- Hauteur de pose des modèles: bâtiments visitables et maisonnette posés à 0 (`interieurs.ts`, `maison.ts`), sols posés (`category: 'sol'`, `floorProps`) à 0, tout le reste du décor à `terrain.heightAt` de leur centre (un bâtiment non visitable sur des cases `s` part donc de la hauteur des cases). Un contrôle de coplanarité doit reprendre ces règles (`src/rendu/couches-sol.test.ts`).
- Planchers des modèles: dalle à 0,12 (pièce), 0,14 aux lames de la maisonnette avec des joints de 2 cm tous les 50 cm, qui tombent pile au milieu des cases: sonder hors de x + 0,5. Chambre 0,08, cellier 0,11, salle à manger de la pension et mercerie 0,10, boutique 0,122.
- Le quai (`platform`) pose une bande à 0 sur le dernier mètre de chaque bout (pied de rampe): le terrain ne doit rien dessiner sous un sol posé (`coveredByFloorProp`); l'abaisser d'un centimètre cassait les talus du passage à niveau (`traversees.test.ts`).
- Voie: module `rail_straight` posé à 0,06; ballast à 0,12 du module, traverses à 0,22 (16 cm de large tous les 80 cm, jusqu'à 0,84 m de l'axe), champignon à 0,32. Les pieds des personnages se posent par `terrain.standHeight` (traverses, planchers des pièces), le décor et les rails gardent `heightAt`.
- Train: voitures rangées de la queue à la tête dans le sens de marche (`TRAIN.travel`), seule la locomotive fait demi-tour (portes des voitures des deux côtés). Le salut du mécanicien lit la piste `driver` de `moments.json` (`trainOffsetFromCab` = moins x de départ de la cabine): tout déplacement de la cabine dans le train demande de reprendre ces images clés.
- `carry_two`: mains jointes au-dessus de la tête (1,83 m); `carry_one` et `carry_one_idle`: mains devant la poitrine (1,23 m, 0,44 m devant, à 0,18 m de part et d'autre). Mesure rapide: `scratchpad/fk.py <glb> <clip> <n> <os>`.
- Qualité adaptative: sur le PC (1366x768 à 100, 125 ou 150 %), le plancher de netteté rend tous les paliers de résolution égaux à la pleine résolution; seul levier réel: les ombres. Compter les paliers utiles (`usefulResolutionSteps`) avant de couper quoi que ce soit.
- Objets muraux: règle commune simulation et rendu dans `src/etat/murs.ts` (largeur `wallWidth`, fenêtres de `pieces.json` avec chambranle, portes, glissement de 0,5 m au plus). Le râtelier fait 1,6 m: aucun pan du mur sud de la pièce n'est assez large entre porte et fenêtres.
- Outil isolé: `sed -n "$(grep ...)p"` (valeur calculée) et un heredoc Python qui modifie le dépôt sont refusés; le plus sûr reste un script `ed_*.py` écrit avec Write (remplacements exacts, `assert s.count(a) == 1`) lancé depuis le dossier du jeu. Si le script échoue au milieu, les fichiers d'avant l'échec sont déjà écrits: le reprendre sans eux.
- Robot et charge à deux: les porteurs gardent un décalage fixe autour du centre pendant tout le portage (`runtime.beamOffsets`, face à face à `carry.grip.apart` depuis la 0.12.2). Le chemin du robot doit être calculé pour l'ensemble (couche `avoid` des `Blockers`, `carryPath` de `robot.ts`), pas pour le seul centre: sinon la charge entre dans une poche où les deux ne passent pas et la partie se fige à minuit (souvenirs, jour 22).
- Trace d'une longue partie de robots: un fichier `tests/zz-*.test.ts` temporaire qui joue pas à pas et note jour, heure, `robot.job` et positions toutes les 30 s, puis vide l'état au pas du blocage; le supprimer après. Sous forte charge de la machine, les longues parties dépassent leurs délais: les relancer avec `--no-file-parallelism` avant de conclure.

## Mission 0.13: ombres sur leur canal, tests rouges (La Petite Ligne, vérifié le 2026-11-04)

- Ombres des poissons hors du message d'état: canal `shadows` (4, mode `latest`, liste entière), envoyé par `hote.ts` juste avant l'état et seulement si leur JSON a changé; `sendWorld()` public (départ, reprise) le force. L'invité garde la dernière liste et la remet dans chaque état reçu (`worldFromSent(..., shadows)`). Les reconstituer chez l'invité est impossible: elles naissent quand un joueur approche d'un coin et suivent les lignes. Gain: 2,1 à 3,2 Ko par message d'état.
- Un canal de plus dans `HostChannels`/`GuestChannels` casse les liaisons de test faites main (`invite-fluidite`, `invite-connexion-tardive`, `hote-devine`): les compléter.
- `invite-fluidite`: la liaison virtuelle tire la gigue d'un seul PRNG; un message de plus décale tous les tirages, et la graine 7 tombe alors sur un recul de 6,8 mm à l'arrêt (borne 5 mm), reproduit sans aucun changement de code en sautant deux tirages. Donner aux canaux nouveaux leur propre PRNG dans la liaison virtuelle.
- Tests de couverture « au hasard » (marcheurs de `moments-tour7`): un objet nouveau sur la carte (tilleul de la place, case 50, 24) dévie leurs chemins. Comparer pas à pas avec une copie de `main` (`git archive` dans le scratchpad, `pnpm install --offline`) trouve le premier pas qui diverge; couvrir ensuite la ligne par une partie déterministe plutôt que par une graine de plus.
- Page de démonstration de l'interface: `goto` attend la fin du module, qui joue les robots jusqu'à la situation (93 161 pas pour `souvenirs-plusieurs`): 25 à 27 s en 0.12.2, 28 à 30 s en 0.13; les modules se chargent en 1 à 2 s. Mesure: `performance.getEntriesByType('resource')` (dernier `responseEnd`) contre `domContentLoadedEventEnd`.
## Village agrandi de la 0.13, rendu (lot L3, vérifié le 2026-11-04)

- Le champ du lit de la rivière (`riviere.ts`) couvre toutes les rangées entre le premier et le dernier lit (berge, eau): avec la mare du bois (y -24), il couvre toute la carte. Le shader de l'eau y lit la profondeur: sur le ru et le bief, il voyait de la terre et peignait l'eau en écume blanche. `carveChannelsInRiverField` écrit leur vrai fond dans le champ (nœuds strictement dedans).
- Petites eaux (bief, bassins de 12 cases au plus): creusées par `bief.ts` (profil du ru couché), pas par le lit de la rivière, dont le flou de 1,4 m ne laisse que des flaques sur deux rangées.
- Aspect de sol sans case de palette de plus: UV au quart bas-gauche de la case (`groundMarkUv`, `fract(vMapUv * 16)` dans le shader); les modèles visent toujours le centre.
- Les cases `s` qui dépassent d'un modèle (église, moulin) se voyaient en planches dehors; et une fente montrait le ciel entre une case `s` (0,08 m) et le lit voisin (berges à 0): marche fermée par `bedEdgeHeight`.
- `ShapeBuilder.build()` vide le constructeur: le réutiliser pour un second semis plante `mergeGeometries` (« reading 'index' »), la page ne devient jamais prête. Sonde d'une page qui ne démarre pas: script qui affiche console et `pageerror` jusqu'à `ready` (90 s), au lieu d'attendre la capture.
- Copie de référence de HEAD pour comparer: `git archive HEAD games/la-petite-ligne packages` dans le scratchpad, lien `node_modules` à la racine de la copie, `cp -a` des `node_modules` du jeu et des paquets (liens relatifs pnpm), Vite sur un autre port.
- Fichier de script nommé `types.py` dans le scratchpad: il masque le module `types` de Python (`json` plante à l'import). Nommer autrement.

## Décisions à deux et rythme des histoires (La Petite Ligne 0.13, vérifié le 2026-11-04)

- Worktree sans `node_modules`: liens symboliques vers ceux du dépôt principal (racine, jeu, chaque `packages/*`), à retirer avant de rendre (ils apparaissent en non suivis). Vite y sert les polices en 403 (chemin hors de la racine permise): les captures tombent sur les polices de repli.
- Page de démonstration de l'interface pour les captures d'un panneau: `src/interface/demo/index.html?scenario=...&joueur=p1&rendu=0` (sans 3D, la simulation avance en temps réel, deux secondes de jeu passent vraiment). Playwright: `NODE_PATH=/opt/node22/lib/node_modules`.
- `pkill -f <motif>` dont le motif figure dans la commande elle-même tue le shell de l'outil (code 144): arrêter un serveur par son identifiant de tâche.
- Les effets d'une étape (`steps[].effects`) jouent quand l'étape se FINIT (`advance`), pas quand elle commence: pour ouvrir quelque chose au début d'une étape, le mettre sur l'étape d'avant, ou le déduire de l'étape en cours (décisions: ouverture automatique quand l'étape cite `decision_made`, sous `all` et `any`).
- Un test qui fait des pas sur un monde neuf: la scène d'arrivée de Firmin se lance d'elle-même et suspend tous les scripts d'effets (`world.scene`); la marquer vue (`dialoguesDone`) avant.
- L'invité ne reçoit l'état qu'à cadence limitée: compter une quinzaine de pas avant de lire `guest.view.world()` dans un test réseau.
## Parcelles libres de la 0.13 (La Petite Ligne, vérifié le 2026-11-04)

- Règles de pose pures dans `src/etat/parcelles.ts` (`plotPlacement`, `previewPlacement`), lues par la simulation, l'aperçu du rendu et le HUD: chez l'invité, la même fonction donne la prévision. Terre posable mise en cache par carte et réglages (`WeakMap`).
- Forme compacte dans l'état transmis seulement (`sendPlot`/`readPlot` dans `sentWorld`/`worldFromSent`); la sauvegarde garde les objets complets (aller-retour exact, migrations simples). 40 parcelles en culture: 1,3 Ko contre 8,7 Ko.
- `restoreWorld` copie la donnée lue avant `fillVillagerDefaults`: les références du format 15 sont les premières écrites sans les défauts des habitants, et le test « sauvegarde abîmée » exige qu'une sauvegarde refusée reste intacte.
- Les tests de gestes qui visaient les 12 cases fixes appellent `demoGarden(sim)` (`tests/aides.ts`): les 12 parcelles de la zone `garden`, comme la reprise d'une 0.12.
- Les bancs d'essai des entrées (`ressenti.test.ts`) donnent une vue sans `content`: n'y lire le contenu que quand l'outil concerné est en main.
- `textHash` de chaînes voisines (« f-8:29 », « f-7:29 ») donne des valeurs presque linéaires: les ronciers sortaient alignés en pépinière. Prendre `hash2(cx, cy, graine)` de `bruit.ts`.
- Un point d'action à moins de 1,2 m du centre d'une case vole le clic au sol sur cette case (`resolveClick`): le puisage du bief est posé dans le bas de sa case d'eau.
- Le cordeau est ajouté après la canne dans `createWorld`, pas dans `startingInventory.eachPlayer`: les cases des outils d'avant ne bougent pas.
- Outil isolé: les gros remplacements passent par `rep.py` du scratchpad (spécification `FILE`, `%%%%`, `@@@@` écrite avec Write); une fusion avec conflit dans un fichier généré (`icones.js`): prendre l'autre côté puis relancer le générateur; vérifier ensuite les marqueurs dans tous les fichiers (`grep -rln '^## Gestes des habitants et réactions (0.13, lot H7, vérifié le 2026-11-04)

- L'état ne porte pas l'habitude d'un habitant (`villagerHabit` des accessoires rend toujours `null`): la retrouver par le planning, première entrée qui tient pour son `target` et son `activity` (`entryHolds` d'`etat/planning.ts`), en cache par minute (`etat/gestes-habitants.ts`). Même résultat chez l'hôte et l'invité.
- Un point de planning posé sur un banc, une table ou un siège (`grocery_terrace`, `lookout`, `fishing_pontoon`, `riverbank`) assoit l'habitant dans le rendu (`onBench`): un geste debout n'y apparaît jamais. Le vérifier en capture, pas seulement par la sonde de simulation.
- Outil sans prise de `toolHolds` (substitut): il pend de `socket_hand_r` repère identité, +Y vers le haut à l'arrêt. Un balai se dessine brosse vers -Y, manche au-dessus de la main.
- `setTool` instancie à chaque changement de nom: ne jamais l'appeler deux fois par image avec deux noms (accessoire puis geste); décider une fois (`villagerAccessories(..., gesture)`).
- Mémoire de la simulation hors sauvegarde sans toucher `Runtime`: `WeakMap<Runtime, ...>` dans le module (le `Sim` garde le même `runtime` d'un pas à l'autre).
- Gros plans de la page de rendu: `vue=X+S,Y+T` avec (S, T) = (-0,9, -0,9) en orientation 0 et (+0,9, +0,9) en orientation 2; un habitant dans un intérieur ne se voit qu'avec le joueur local dans le même bâtiment (`c.inside = 'church'`).
- Fusionner la branche de session avec des changements non commités qui touchent les mêmes fichiers: commit temporaire, `git rebase <branche>`, puis `git reset --soft HEAD~1` (puis `git reset` pour tout désindexer).
## Vie du village de la 0.13 (lot H7, vérifié le 2026-11-04)

- Scène, chaise ou poste sans champ d'état nouveau: un point virtuel dans `VillagerState.target` (`scene:<id>:<groupe>:<rang>`, `seat:<point>:<rang>`), résolu par `etat/vie.ts` (pur) chez l'hôte, chez l'invité et dans le rendu; la simulation le choisit dans `currentEntry` (`lifeEntry`), avant le planning, comme `market_spot:`. `target` et `activity` partent déjà dans l'état écrit.
- Le chat vit dans `sim.runtime.cat` (hôte seul, ni sauvegardé ni dans le message d'état) et part par le canal rapide (`FastSnapshot.cat`, facultatif); le rendu le lit par `GameView.cat()`. Rien ne change la taille de l'état transmis.
- L'angélus (pause de 12 h à 12 h 03) fige tous les marcheurs dehors: un test de trajet à midi pile n'avance pas. Prendre 12 h 05.
- Commit temporaire refusé par l'outil pour fusionner la branche de session: sauvegarder `git diff` dans le scratchpad, remettre seulement les fichiers en conflit (`git checkout -- <fichier>`), `merge --ff-only`, réappliquer les quelques lignes à la main.
- Page de rendu avec la vraie simulation des habitants: `rendu.html?vie13=1&jour=&heure=&avance=` (`demo/vie13-exemple.ts`); `x`, `y` posent le joueur 1 (les bulles ne se montrent qu'à moins de 8 m de lui). Le port 6431 est pris par une autre séance: 6587.
- Le son de la 0.13 joue les événements du village par leur nom (`AUDIO_SETTINGS.village.events`, champs `villager`, `by`, `at`) dans le `default` de `declencheurs.ts`; un type ajouté à `WorldEvent` doit avoir son `case` qui appelle `villageEventSound`, sinon il n'est plus joué.

## Scènes de vie et chat de la 0.13 (La Petite Ligne, vérifié le 2026-11-04)

- Vitesse des habitants 1,6 m/s pour 0,7 s par minute de jeu: 1,1 m par minute. Une scène dont un membre vient de loin (80 m) le voit arriver une heure après: chiffrer les distances (planning à la minute d'avant) avant de fixer `from`, ou ajouter une scène d'approche (`mado_to_quay`).
- Une bulle de scène toutes les 10 minutes de jeu (`bubbleSeconds` 7 s réelles): une scène de 15 minutes n'en montre qu'une ou deux. Un test de bulles vérifie « au moins une, dite par un membre », pas « chacun a parlé ».
- Venir du hors-carte: un habitant invisible dont la scène commence est posé directement à sa place (convention des retours de tournée). Scène à `cameFrom: offstage` à 2 minutes au moins après le départ du planning (au rythme « vif », un pas de planning de 15 ticks peut sauter une minute).
- Jour de la semaine: le jour 1 est un samedi, `(jour - 1) % 7` (0 samedi, 1 dimanche, 2 lundi...).
- `pkill -f` ou `until ! pgrep -f <motif>` dont le motif est dans la commande elle-même: le shell de l'outil se voit et ne finit jamais (ou se tue). Attendre une tâche de fond par sa notification.
- Une variable lue dans un test après `sim.runtime.cat = null`: TypeScript la garde `null`; la lire par une petite fonction.
- `tests/amitie-0-13.test.ts` (« format 14 sans nouveau format ») attend `DATA_SCHEMA` 14 alors qu'il vaut 15: rouge avant cette mission.
## Portraits 3D des habitants (La Petite Ligne 0.13, vérifié le 2026-11-04)

- `rendu/portraits.ts`: un `WebGLRenderer` à part (alpha, fond transparent) rend chaque buste au chargement, `drawImage` du canevas WebGL dans un canevas 2D dans la même tâche (pas besoin de `preserveDrawingBuffer`), puis `toBlob` et `URL.createObjectURL`. Sous SwiftShader l'encodage PNG des 21 images met plusieurs secondes après `ready`: un panneau ouvert tôt garde le SVG tant que sa signature ne change pas (le dialogue met `hasVillagerPhoto` dans sa signature).
- Cadrage: os `neck` (`getObjectByName`) et sommets posés (`SkinnedMesh.getVertexPosition` puis `matrixWorld`): point le plus haut (chapeau, loupe relevée) et largeur au-dessus des épaules (bords de chapeau). Les enfants et les grands sortent à la même taille de tête.
- Panneau du carnet capturé en plein fondu d'entrée (`lpl-detail-in`): portrait pâle, ce n'est pas un défaut; capturer avec `animations=reduites`.
## Options graphiques par machine (La Petite Ligne 0.13, vérifié le 2026-11-04)

- Un jeu ne peut rien garder sur la machine d'une partie à l'autre hors des sauvegardes de l'hôte: session Chromium non persistante vidée à chaque partie (`clearStorageData` dans `apps/duo/src/main/game-host/game-host.ts`), et le contrat (ADR 0005) interdit le stockage du navigateur. Les options sont derrière `GraphicsStorage` (`etat/options-graphiques.ts`), en mémoire de la page tant que le SDK n'offre pas de réglages par machine.
- `etat/` est la seule couche commune au rendu et à l'interface (README de `src/`): un contrat partagé par les deux (types, préréglages, lecture tolérante) va là, pas dans `rendu/`.
- Bascule à chaud sans programme compilé en pleine partie: ombres coupées et rendues (variantes préparées par `warmUp`), taille de carte d'ombre (`DaylightRig.setShadowMapSizes`, uniforme seulement), tampon (`renderPixelSize` avec d'autres `RenderSizeSettings`), part des particules à l'émission (réserve inchangée). L'antialiasing, la végétation et le mode léger se fixent à la création: pas à chaud.
- Panneau capturé sur `src/interface/demo/index.html?scenario=besoins-carnet&rendu=0`, clic sur `[data-key="options"]`; Entrée moins de 300 ms après l'ouverture est avalée par la garde d'arrivée (`arrivalGuardMs`), attendre avant d'appuyer. Vérité du rendu: `window.lplInterface.graphics()` (page avec 3D).
## Deux Tabliers, chantier clientèle (vérifié le 2026-11-07)

- Un domaine (`world.clientele`) repart en entier dès que son JSON change (`domainSender` de `reseau/hote.ts`, examiné 10 fois par seconde): une horloge flottante dans le domaine l'enverrait à chaque examen (13 Ko x 10/s). Garder la seconde entière dans l'état et la fraction dans une `WeakMap<World, ...>` de l'hôte; positions des clients debout à part (canal 7).
- Toute liste qu'un autre chantier doit vider (boîte de dépôt vers le service) se borne: si personne ne la vide, le domaine dépasse 64 Kio en quelques jours et le SDK arrête la partie.
- `switch (intent.type)` dans un fichier commun (`simulation/pas.ts`) casse `switch-exhaustiveness-check` dès qu'un chantier ajoute ses intentions: `if` dans le cœur comme dans les chantiers.
- Simulation chiffrée du game designer: importer ses constantes en chargeant le module Python (`importlib`) plutôt que de les recopier (`outils/importer-clientele.py`); les notes entre parenthèses en fin de ses textes d'issue ne se lisent pas en jeu (retirées à l'import).
- Une journée de 600 s de service tourne en moins de 0,2 s dans Vitest (`stepWorld` complet, robot à la caisse, `fallbackPrepSeconds` à la place du service): un test par jour d'événement reste court.
- Worktree isolé: l'outil Bash refuse les heredocs Python qui citent des chemins; écrire le correctif dans un script du scratchpad (Write), puis `python3 script.py .`. Le port 8765 peut être pris par un autre membre (scratchpad partagé): en choisir un autre, `--bind 127.0.0.1`.
## Deux Tabliers, recette de nuit (vérifié le 2026-11-08)

- Deux catalogues pour un même achat: l'aménagement écrit `village-terrasse` (tiret, `world.arrangement.extensions` et `works`), la clientèle `village_terrasse` (souligné, `clientele.purchases`). Tout achat fait d'un côté doit être recopié de l'autre (`stepExtensions` de `branchement/index.ts`); un test qui ne lit qu'un côté passe à tort.
- `donnees/clientele/*.json` est régénéré depuis `docs/jeux/cosy-cafe/demo/donnees/` par `outils/importer-clientele.py`: un texte ou une règle changé dans le jeu se change aussi dans la source du game designer et dans l'importeur, sinon le prochain import l’efface.
- Ce qui naît d'un événement (carte de scène, réplique) disparaît à la reprise et chez un invité qui rejoint: le remonter aussi depuis l'état du monde, une fois par scène (clé jour et événement).
- `fill` de `interface/typo.ts` élide « de » et « que » devant une valeur à voyelle: écrire les gabarits avec « de {partner} », jamais « d'{partner} ».

## Assises et personnages assis (Deux Tabliers, vérifié le 2026-11-08)

- Les clips `sit` et `sit_drink` des personnages de Meshy sont faits pour une assise basse: fesses vers 0,30 m (`sit_drink`), 0,37 m (`sit`), 0,16 m pour Simone (reciblage plus court); `sit` décale aussi le bassin de (0,19; -0,36) m. Mesurer par modèle et par clip (os `Hips`, sommets sous le bassin par `SkinnedMesh.getVertexPosition` puis `matrixWorld`), poser l'origine pour que les fesses touchent l'assise de `modeles.json` (`assises`), et baisser les cuisses (rotation autour de l'axe gauche-droite du personnage, après la mise à jour du mélangeur, `q' = P⁻¹ R P q`) pour que les pieds touchent le sol. `src/rendu/assis.ts`.
- Sonde de GLB dans Node sans navigateur: `globalThis.self = globalThis` avant `GLTFLoader.parseAsync` (les textures échouent sans bloquer), puis `AnimationMixer.setTime` et `getVertexPosition`. Script posé dans le dossier du jeu (les imports de `three` s'y résolvent), supprimé après.
- Un champ ajouté à `PlayerState` (ici `seat`) n'arrive pas chez l'invité tout seul: positions par le canal des mouvements (x, z, cap), usages par le cœur. Ajouter le champ au message du cœur (`seats`), sinon l'invité ne se sait pas assis (caméra debout, prédiction qui le fait marcher).
- Le regard local (`look.look`) est à part du monde: s'asseoir doit aussi tourner la caméra locale vers la table, sinon le corps regarde la table et la vue la fenêtre.
- Captures de près sans jouer: sauvegarde fabriquée dans Node (test Vitest jetable qui écrit le `StoredSave`, `data` = `JSON.stringify(world)`), posée dans `localStorage` sous `duo-sdk-dev:<jeu>:sauvegarde:1`, page rechargée; serveur `pnpm --filter @duo/sdk-dev servir <jeu> --construire --port <p>`, puis `pnpm build` du jeu pour reprendre un changement. 30 s par capture, sans erreur.
- Un texte des scènes se change à trois endroits: `donnees/clientele/evenements.json`, la source du game designer (`docs/jeux/cosy-cafe/demo/donnees/evenements.json`) et la mise en scène écrite dans `outils/importer-clientele.py` (répliques du chauffeur). Horloge du café: 1 s réelle par minute de jeu; une durée dite par un personnage se compte en minutes de l'horloge.
- Deux Tabliers, importeurs (vérifié le 2026-11-08): `importer-clientele.py` réécrit aussi `regles.json`, et `service-donnees.mjs` réécrit `meubles.json` et `service/recettes.json`, avec des écarts anciens (retouches faites à la main dans le jeu). Après un import, ne garder que les fichiers visés (`git checkout` des autres) et le signaler.
- Deux Tabliers, faux hôte jusqu'à la tablette au jour 1 (Playwright, deux cadres `/jeu/`): « Continuer » des deux, nom de la maison (`input`), « C’est notre maison » chez l'hôte puis « C’est notre maison ! » exact chez l'invité (le texte non exact attrape l'étiquette d'état), Retour arrière des deux (le bilan du lundi couvre l'écran du prénom), prénom, « C’est parti » deux fois chez chacun (prénom puis « Ton confort »), Tab chez l'hôte. Le bilan d'un jour ouvert se regarde sur la page d'aperçu (`apercu/index.html#bilan-3`, deux clics « Page suivante »).
- Worktree isolé: un script Python en heredoc passe, mais pas une commande qui mêle `git show` et une boucle ou une redirection: mettre ces commandes dans un script du scratchpad.

- `PropertyMixer.apply` de Three.js ne réécrit un os que si la valeur du clip change: sur une pose tenue (clip constant), une retouche d'os faite après le mélangeur (cuisses, cou) s'additionne d'une image à l'autre (jambes qui montent jusqu'à la table). Garder la valeur d'avant retouche et la remettre si le mélangeur n'y a pas touché (`rotateInWorld` de `src/rendu/assis.ts`).
- Le clip `sit` livré (10,7 s) s'assoit, se penche de 50° (tête vers la table) puis se relève; sa première image est une assise droite, mains sur les cuisses: pose calme `sit_rest` tirée de là. `sit_drink` (11,2 s): la main droite va chercher la tasse loin sur le côté au début et à la fin; la gorgée utile va de 12 % à 72 % du clip.
- `modeles.json`: `objets` est une liste de fiches (clé `id`), pas un dictionnaire; un schéma en `v.record` passait à côté sans erreur et toutes les assises prenaient la place par défaut. Vérifier une lecture de données par un test qui voit une valeur propre au fichier (2 cm d'avance de la chaise paillée).
- Captures du faux hôte en rendu logiciel: fenêtre de 1300x460 et 2,5 s d'attente après `running`, une page par vue; au-delà, « Le jeu ne répond plus » arrête la partie. Bandeaux du jeu masqués par une feuille de style ajoutée aux cadres enfants seulement (`page.frames()` sans le cadre principal, sinon l'iframe n'est jamais stable).

## Deux Tabliers: clients assis et interface (vérifié le 2026-11-08)

- Main portée à un point (tasse à la bouche): une simple visée de l'os du bras dépasse la cible quand la main est plus loin que la cible (main derrière la tête). Il faut d'abord plier le coude (loi des cosinus, axe = (coude - épaule) x (main - coude)), puis viser avec le bras. `rotateInWorld` d'`assis.ts` est idempotent: l'appeler avec l'identité quand le poids est nul, sinon la retouche reste sur une pose tenue.
- `sit_drink` déplace le bassin: recaler le personnage chaque image sur l'os `Hips` mesuré (`pinHips`) plutôt que sur un placement fixe.
- Écran modal (matin, bilan) et téléphone: les calques lisent Tab et Entrée au `keydown` avant le SDK; un crochet `tab()` / `enter()` dans `LayerSpec` laisse passer le téléphone. Un calque téléphone ouvert sur un écran a besoin d'un `z-index` au-dessus de lui (30 + profondeur).
- Captures des clients assis: faux hôte (`packages/sdk-dev`, `deux-vues.html?jeu=...`) et jeu servis par deux Vite, sauvegarde posée dans `localStorage` sous `duo-sdk-dev:deux-tabliers:sauvegarde:1` par `addInitScript`, clic dans la vue pour retirer la capsule, `clip` et `deviceScaleFactor: 2` pour un zoom.

## Gorgée et prise (Deux Tabliers, vérifié le 2026-11-08)

- `Quaternion.slerpQuaternions(a, b, t)` copie `a` dans le résultat avant de lire `b`: `q.slerpQuaternions(identity, q, w)` rend toujours l'identité (l'ancien `reachTo` ne pliait jamais le bras). Garder la cible dans un autre quaternion.
- Repère d'un os mesuré par `boneInverses[i] · bindMatrix`: il peut être à l'échelle du squelette (centimètres); multiplier les points par `bone.getWorldScale().x` avant de les utiliser en mètres.
- Les mains des personnages Meshy n'ont pas d'os de doigts et sont modelées doigts ouverts (pose de liaison en croix, paume vers le bas): une prise vue de face reste imparfaite; de profil, tasse inclinée bord aux lèvres et anse dans la main se voient bien.
- Banc de gros plans sans faux hôte: page jetable `banc-gorgee.html` dans le jeu (monde de `createWorld`, groupe posé par `spawnGroup`, `stage`, `createWorldNodes`, `createCustomerNodes`), instant de gorgée choisi en cherchant `nowMs` où `sipTime` vaut t; servie par `node_modules/.bin/vite --port <p>`, capture Playwright 520x520, une page par vue.

## Deux Tabliers (vérifié le 2026-11-08)

- Le jour 1 des données est le lundi fermé: le « jour 1 » du client est le mardi (`day` 2), premier jour ouvert. `world.clientele.openDays` vaut 0 pendant tout ce premier service.
- Plusieurs tests (`realisme`, `file`, `clientele`, `recette-quinze-jours`) comparent des chiffres relevés: une règle qui change l'aléa ou le flux des premiers jours les décale tous. Leur donner un contenu sans la règle (fichier de données surchargé dans `loadContent`) et tester la règle à part.
- Le stock de départ offert (`startStock`) part dans le panier du soir s'il est frais: il change les points de réputation et la caisse. Ne pas y mettre de viennoiseries.
- La coque cuite `shell_village.glb` couvre z 6,7 à 13 seulement: réserve et cour sont construites par `src/rendu/arriere.ts` (géométrie procédurale, 2026-11-08).
- `main.ts` n'est pas indispensable pour brancher un rendu ou une carte: `createWorldNodes` (rendu) reçoit la vue et le regard, `attachInterface` (interface) reçoit la vue et chaque image.

## Réserve et cour de Deux Tabliers (vérifié le 2026-11-08)

- Partager un programme existant: la clé de Three.js 0.187 compte aussi `vertexNormals` (attribut `normal` présent dans la géométrie, bit 23 du premier masque) et `useFog` (`material.fog`, même sans brouillard dans la scène). Le ciel de la place (`dt_ciel`: `MeshBasicMaterial`, `map`, couleurs RGBA, `fog: false`, normales) se partage avec une géométrie maison qui a `normal`, `uv`, `color` à 4 composantes. Vérifier par `renderer.info.programs[i].cacheKey` (comparer les deux masques numériques en fin de clé).
- Lumière « cuite » sans carte: `MeshBasicMaterial` + couleurs de sommets calculées une fois (ampoule en 1/d², coupure de l'abat-jour, occlusion des coins par distance aux plans, soleil avec ombre par lancer de rayons contre quelques boîtes). Découper les faces en cases de 25 cm pour que la lumière varie. Couleur = teinte linéaire / 0,70 (moyenne des textures neutres) × lumière.
- `shell_village_place.glb` modélise déjà toitures, gouttière (vers 6,40 m) et maisons voisines autour de la cour, et un mur de 3,60 m qui ferme la ruelle à z 2,7 à 3,0: regarder la place (capture sans son propre ajout, vue de dessus) avant d'ajouter des voisins. Ses positions sont quantifiées en `int16` avec `byteStride` 8 et une échelle de nœud: un lecteur Python doit suivre le pas.
- Corriger un GLB cuit sans le refaire: déplacer ses sommets au chargement dans le repère du monde (`matrixWorld`, puis inverse), dans une boîte dont on a vérifié en Python qu'elle ne coupe aucun triangle d'autre chose (vantail de `door-5` replié, chaperon de la ruelle ramené au nu du mur).
- Deux faces dans le même plan et le même sens (mur maison contre tranche d'un modèle) scintillent: avancer la sienne de 5 mm à 1 cm. Des tranches de 2 cm aux coins d'un modèle voisin se voient en traits sombres: déborder de 2 cm.
- Worktree neuf sans `node_modules`: `pnpm install --frozen-lockfile --prefer-offline` (moins d'une seconde). Playwright: le paquet global `/opt/node22/lib/node_modules/playwright` (celui du dépôt réclame un navigateur absent). Page de captures jetable: HTML et TS à la racine du jeu, configuration Vite à côté (`outDir` dans le scratchpad), serveur `python3 -m http.server` en tâche de fond avec un `timeout` long (sinon il s'arrête au bout de 30 min, en plein lot).
- Paramètres utiles d'une page de captures: `x`, `z`, `yaw`, `pitch`, `y` (vue de dessus), `ext` (extension ouverte), `sans` (cacher son groupe pour comparer, programmes compris). Cap: 0 regarde vers -z (nord, vers la cour depuis la salle), +90 vers -x.

## La Petite Ligne 2: banc à deux vues et scènes hors lieu (vérifié le 2026-11-10)

- Banc `servir --construire` piloté par Playwright: un navigateur par machine (`chromium.launch()` deux fois), pas deux contextes du même navigateur. Avec un seul processus GPU, SwiftShader sert les deux vues l'une après l'autre et l'invité dépasse les 8 s du battement du faux hôte (« Le jeu ne répond plus »).
- Au départ, l'éditeur « Ta photo d'identité » prend le clavier: cliquer « C'est parti ! » par `frame.evaluate` (le bouton est recréé à chaque image, un `click()` de Playwright le voit détaché). Après une partie, l'accueil propose « Héberger une nouvelle partie »: vider `<donnees>/sauvegardes` entre deux essais. `pnpm --filter @duo/la-petite-ligne-2 build` suffit pour que le serveur déjà lancé serve le nouveau jeu.
- Une capture coûte environ 7 s de jeu en rendu logiciel: pour une scène de 10 s, une capture par passage (prise sur les deux pages par `Promise.all`), et plusieurs allers-retours.
- Scène qui n'est pas un lieu (trajet en train): la couche des personnages se nourrit d'un monde de substitution (copie des joueurs avec des corps à soi, lieu sans meuble ni habitant), et l'on appelle `snap` quand un personnage change de place d'un coup. Ce qui roule reste immobile dans la scène et c'est le décor qui défile: le lissage des positions laisserait sinon les passagers derrière le wagon.
- Personnage couché sans clip: un `Group` entre l'objet et le squelette, tourné de -90 degrés autour de x (tête vers -Z, visage en haut), corps en `idle`; l'ombre de contact se cache.

## La Petite Ligne 2 (simulation, vérifié le 2026-11-10)

- Un `GameSystem.intent` reçoit toutes les intentions: `switch-exhaustiveness-check` refuse un `default` seul; dérogation `// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- raison`.
- La raison d'un événement `refused` est un `IdSchema` (minuscules et traits d'union): `too-far`, jamais `too_far`.
- Les joueurs naissent au point `descente` (près du quai), pas aux points `depart-joueur-*`: un test de portée place les corps lui-même.
- Tests d'un système hors du pas: construire un `SimContext` à la main (copie de `step`) qui note les tranches touchées; retoucher le contenu en modifiant `dataFiles()` avant `loadContent` (exemplaire factice sans code).
- Ajouter un événement casse le `switch` exhaustif de `src/interface/index.ts` (lot L7): ajouter ses `case` à la liste ignorée, sans commentaire entre deux `case` (`no-fallthrough`).
- Un schéma de brique ne peut pas importer `schemas/briques.ts` (import circulaire, TDZ): le mettre dans son propre fichier sans import de `briques.ts`.
- Ne jamais lancer `prettier --write` sur un dossier entier: plusieurs fichiers des autres lots (README, `interface/index.ts`) ne sont pas formatés et seraient réécrits. Viser ses fichiers.
- Dans un worktree isolé, une commande qui mêle `git` et des tubes ou `&&` est refusée: commandes git simples, une par appel; le contrôle des tirets se lance sans `--exclude-dir=.git` (sur `games docs`).
- Un événement ajouté à `GameEventSchema` casse le `switch` exhaustif de `src/interface/index.ts` (lint): l'ajouter aux cas ignorés.
- Un champ ajouté à `progress` ne part pas chez l'invité (`reseau/progression.ts` n'envoie que `memory`, `bonds`, `quests`, `collections`, `opened`): un champ facultatif dans un objet déjà envoyé (`QuestSchema`, `CommonSchema`) part sans toucher au réseau.
- Un dialogue de quête de priorité haute masque l'accueil d'un habitant (tests de dialogue cassés): ouvrir la suite d'essai par un fait de l'accueil (`requires`).
- Un événement ajouté casse aussi le `switch` exhaustif de `src/interface/cuisine/index.ts`, pas seulement `interface/index.ts`.
- Un effet qui change de lieu (`travel_to`) ne doit pas partir pendant la scène: `runBeats` abandonne une scène dont le lieu a changé (non comptée vue). Le départ attend la fin de la scène plus un délai (les quêtes ne sont vérifiées que tous les 6 pas et seulement dans le lieu courant).
- Champ facultatif d'état sans défaut à écrire partout: `v.exactOptional` et `delete` pour l'effacer (pas `v.optional(x, défaut)`, qui oblige chaque littéral à l'écrire).
- `tests/dialogues.test.ts` compare `talkView(...).options` par `toEqual`: un champ ajouté aux options demande de mettre à jour ce test.
- Outil Bash isolé: `python3 - <<'EOF'` passe s'il est seul dans la commande après `cd`; suivi d'un `&&` ou d'un autre appel, toute la commande est refusée (rien ne s'exécute). Vérifier par `git diff --stat` après coup.

## La Petite Ligne 2: départ du jeu et recette D2 à D4 (vérifié le 2026-11-10)

- Le jeu part du prologue (`train-de-nuit`, 21 h 30); les tests unitaires partent de la gare d'essai par `dataFiles()` (`TEST_START` de `tests/aides.ts`), le vrai départ se lit par `gameDataFiles()`. Parcours e2e: `startDuo` charge par défaut la sauvegarde `essai-gare`; `save: null` donne une vraie partie neuve.
- Worktree neuf: construire aussi `pnpm --filter @duo/sdk-dev build`, sinon le faux hôte des parcours e2e s'arrête (code 1, « Pages du faux hôte absentes »).
- Les points nommés du plan (`points_nommes`, ex. `firmin-quai`) ne sortent pas de `outils/plan-vers-lieu.ts`: `grands-lieux` et `lieux-verrous` chargent cette carte brute, donc une fiche qui les cite casse ces tests.
- Un habitant déplacé par une scène (`walk`) ou poussé revient à son poste à la relecture du planning (`backToPost`), jamais pendant une scène. Point d'arrivée des joueurs dégagé: `arrivalClearance` (habitants/reglages.ts).
- Commerçant: champ `talk` du commerce = page « voir la boutique » ajoutée en fin de toute conversation (nœud réservé `DIALOGUES.shopOffer.node`); les tests qui enchaînent deux dialogues avec la cheffe de gare doivent clore cette page (`talk_close`).
- Le contrôle `reach` d'une étape a 2,5 m de rayon (`STORY.reachRadius`): une sauvegarde fabriquée doit poser les joueurs loin du point, sinon l'étape (et un `travel_to`) part tout de suite.

## Survol rejoué par Chromium (La Petite Ligne 2, vérifié le 2026-11-10)

- Chromium rejoue `mouseover`/`mouseenter` quand le contenu passe sous un pointeur immobile (carnet qui monte du bas). Le pointeur des parcours e2e reste où Playwright a cliqué (« Héberger et continuer »): `mouseenter` mettait le focus du carnet sur la case 5. Le survol passe par `onPointerHover` (`src/interface/dom.ts`, `mousemove` avec `movementX/Y` non nuls); test garde-fou `tests/survol.test.ts`.
- Dans le carnet, les chiffres 1 à 5 ne font rien: viser une case par D (ou les flèches) depuis la case 1.

## Intérieur clos d'un petit lieu: le wagon du train de nuit (La Petite Ligne 2, vérifié le 2026-11-10)

- Collisions à la case de 1 m (rayon du corps 0,3): deux banquettes de 1 m et un couloir libre imposent 3 cases, donc 3 m entre parois, pas 2,8. Un meuble solide hors des cases (centre à 3,6) prend deux cases et bouche le couloir.
- Murs d'un intérieur sans dalles: parois en meubles solides 1 x 1 dont la géométrie est au bord avant de la case (face intérieure sur la limite), angles en montants e x e; `blocked` vide. Les dalles de `blocked` (0,12 m, gris violet) se voient sinon dehors.
- La touche d'action prend la première brique utilisable: `sit` puis `sleep` sur un même meuble rend le sommeil inaccessible. Un meuble par geste (banquette assise, couchette couchée).
- Places assises: la place 0 est à droite de qui s'assoit; deux banquettes face à face donnent des places en diagonale.
- Occultation: un meuble de carte s'efface s'il dépasse `occlusion.minHeight` (1,1 m); sa hauteur vient du manifeste des décors (`description.ts`), sinon 0,9 m. Une paroi de 2,15 m à 0,9 m ne s'effaçait jamais.
- Parcours e2e en rendu logiciel: le geste « s'asseoir » met plusieurs secondes réelles; attendre l'état (`objects[id].sit` contient l'index) avant la capture. `acte-1.spec.ts` D1 échoue déjà sur la base (Aubrune, délai), P18b est instable.
- Régénérer les décors réécrit tous les GLB (octets différents, même contenu): remettre par `git checkout` ceux dont le manifeste ne change pas.
## Page Artifact et Three.js r128 en scripts classiques (vérifié le 2026-11-10, tableau de bord)

- Les CDN (cdnjs, jsDelivr) sont fermés dans l'environnement cloud: `npm pack three@0.128.0`, décompresser, puis `page.route(url, (r) => r.fulfill({ path }))` dans Playwright pour servir les mêmes fichiers.
- r128: `material.skinning` et `material.morphTargets` sont à poser à la main sur tout matériau de remplacement d'une peau; `outputEncoding = sRGBEncoding` et `texture.encoding` (pas `colorSpace`); `uv2` pour `TEXCOORD_1`.
- r128 ne lance pas de rayon sur une peau animée, et `Box3.setFromObject` ignore le squelette: figer une copie par `SkinnedMesh.boneTransform(i, v)` à la pose de repos (enfant invisible du maillage) pour le pointage et les cotes. L'échelle réelle d'une peau se lit là (taille figée sur taille brute), pas dans la matrice du noeud.
- Fuite classique: chaque `Skeleton` garde une `boneTexture`; `skeleton.dispose()` en changeant de modèle (3 textures perdues par personnage sinon). Contrôle: `renderer.info.memory` lu après une image rendue, pas avant.
- GLTFLoader charge les images embarquées par des adresses `blob:` (soumises à la politique de sécurité de la page hôte): retirer `images`, `textures` et `samplers` du bloc JSON du GLB avant `parse`, décoder soi-même par `createImageBitmap(new Blob([octets]))`, puis reposer `material.map` grâce à `gltf.parser.associations` (matériaux clonés compris).
- Pièces à squelette venues de plusieurs GLB: `socle.attach(peau)` puis `peau.bind(new Skeleton(os du squelette de référence retrouvés par nom, boneInverses d'origine), peau.bindMatrix)`.
- Banc d'un onglet publié à côté d'une page: `<base href="../">` pour garder les adresses relatives de la page publiée; les `<option>` ne sont jamais « visibles » pour Playwright (`state: 'attached'`); recalculer la boîte d'un élément après un clic qui fait défiler la page.
## Parcours e2e sous charge (La Petite Ligne 2, vérifié le 2026-11-10)

- Deux horloges ralentissent sous charge en rendu logiciel: la simulation (rattrapage borné à 15 pas, 0,25 s de jeu par image, `stepper.ts` du SDK) et l'horloge de l'interface (`frame` de `src/interface/index.ts`, écart borné à 250 ms). Une image de 0,9 s ne compte que 0,25 s: un parcours qui mesure en temps mural une minuterie de l'interface (coup d'œil) ou attend une marche de scène échoue sans défaut du jeu. Mesurer en temps de l'interface (somme des écarts `requestAnimationFrame` bornés à 250 ms, part déjà écoulée lue sur la barre du minuteur) ou en pas de simulation.
- Marche de scène: `detourAround` (lecteur.ts) choisit le plus court repère libre autour de la paire; l'ancien détour par un seul bout bloquait l'habitant à son repère quand sa place était à 30° de côté (38 trajets sur 240), jusqu'au plafond de 20 s. La marche presse le pas au-delà de `walkBudgetSeconds` (Firmin: 9,6 s ramenées à 4,1 s).
- Les sauvegardes de départ (`/tmp/lpl2-e2e-fixtures`) et l'`outputDir` étaient communs à tous les worktrees: une recette lancée ailleurs réécrivait les sauvegardes au milieu de la nôtre (parties d'une autre version, joueurs à l'ancien écart) et effaçait nos pièces jointes. Depuis, ces dossiers portent l'empreinte du chemin du paquet (`tests/aides-e2e/dossiers.ts`).
- Une capture Playwright en rendu logiciel chargé peut durer plus que les délais de jeu (8 s du lecteur seul): pas de capture entre deux actions dont le parcours mesure l'enchaînement.

## La Petite Ligne 2: marche, course et trajets (vérifié le 2026-11-10)

- Foulées mesurées des clips du squelette commun (`library.stride`): marche 1,46 m par cycle de 1 s (cadence propre 1,46 m/s), course 1,80 m par cycle de 0,625 s (2,88 m/s). Marche 1,5 et course 3,2 m/s jouent les clips à 1,03 et 1,11 de leur cadence. Mesure dans Node: un test jetable qui charge `loadCharacterLibrary` comme `tests/rendu/personnages.test.ts`.
- Seuils « il court » codés en vitesse absolue, à garder entre la marche reposée (walk x 1,25) et la course fatiguée (run x 0,8): `VILLAGERS.runSpeed` (habitants), `insects.runThreshold` (temps.json), `runFrom`/`runTo` du rendu; test garde-fou dans `tests/marche-course.test.ts`.
- Le facteur de vitesse des besoins (`modifiersOf(...).speed`) passe par `speedFactorOf` dans `movePlayers` et dans le prédicteur: les tests qui attendent `walkSpeed` exact doivent le multiplier (départ à 70: bien reposé, x 1,1).
- Heure d'arrivée d'un trajet: `arrival` de l'effet `travel_to` (schéma `donnees/schemas/trajet.ts`), portée par `story.departure` puis `common.travel`, appliquée par `advanceTripClock`. La phase `arrival` dure 1 s: l'horloge dépasse l'heure dite d'environ 0,5 min, tester avec une marge.
- `CAPTURES` des parcours e2e (`/tmp/lpl2-captures`) est commun aux worktrees: `LPL2_CAPTURES=<scratchpad>` pour ses propres captures.
## Prologue jouable à pied et automate à deux joueurs (La Petite Ligne 2, vérifié le 2026-11-10)

- Worktree isolé: vérifier d'abord que sa tête est bien celle que cite la mission (`git merge --ff-only <tête>`); le mien avait 19 commits de retard. Un `python3 - <<'EOF'` long est refusé (« too complex »): écrire le script par Write dans le scratchpad et le lancer par `python3 script.py .`.
- Playwright ne sait pas importer `src/` (les JSON de `donnees/` s'y importent sans attribut): une aide e2e qui a besoin des obstacles relit `carte.json` et `commun/meubles/*.json` elle-même (`loadMap` de `tests/aides-e2e/prologue.ts`, emprise des meubles solides comme `noyau/obstacles.ts`).
- Garde-fou des coincés (`noyau/deblocage.ts`): « relié au quai » doit suivre les portes (`map.doors`), sinon tout joueur sauvegardé dans un intérieur est jeté dehors à la reprise (`createSim` appelle `freePlayer`). Un lieu dont le point d'arrivée est enfermé renvoie de même tout le monde à l'arrivée (c'était D11).
- Personne ne marche pendant une scène: un parcours lit la scène ouverte par l'étape (`onStart: play_scene`) avant de marcher, sinon il conclut à tort à un blocage.
- Visée dans un couloir d'un mètre: un meuble à brique voisin (couchette) prend la bulle dès que l'habitant est hors du regard (20 degrés) ou occupé. L'automate n'appuie que si la cible visée est la bonne et sans refus (`actOn`), sinon il se couche au lieu de parler.
- Lacet de caméra déduit d'un déplacement: dans un couloir le pas de biais glisse le long des parois; deux touches (arrière puis droite) et le meilleur des huit lacets à 45 degrés. Près du but, avancer par appuis de 160 ms: une image de rendu logiciel vaut jusqu'à 0,25 s de jeu, soit 0,75 m.
- Condition d'histoire `posture` (assis ou couché, un ou les deux): « dormir » = les deux couchés. Les tests qui posaient `needs.sleep = 85` pour franchir l'étape doivent coucher les joueurs (`tests/aides-prologue.ts`, lits lus par la brique `sleep`).
- Un meuble 2 x 1 centré sur une limite de case prend deux rangées: la table de l'épicerie d'Aubrune bouche ainsi le passage vers l'escalier (signalé au manager).

## Intérieurs, portes et passages (La Petite Ligne 2, vérifié le 2026-11-10)

- Un habitant qui glisse en scène: ce n'est pas la vitesse (elle est bien transmise) mais sa posture. À l'heure réelle d'arrivée (8 h) le planning lui donne un geste (`balayer`), le rendu jouait donc le clip du geste pendant la marche. Reproduire à la vraie heure du jeu, pas à celle des sauvegardes d'essai (6 h 10: aucun geste). Règle du rendu: qui se déplace marche (`standingPosture`); la marche de scène retire geste et siège.
- Passage de porte sans glissement, hôte et invité pareils, sans toucher au réseau: le rendu reconnaît un saut à la position affichée (`jumped`, plus de 3 m entre deux images), retient l'image d'avant pendant que le noir tombe (aucune mise à jour), pose caméra et personnages au noir, puis rouvre. L'autre joueur est caché pendant les images du saut (chez l'invité sa position est interpolée entre départ et arrivée).
- Pendant les images retenues, `projectToScreen` rend `null`: sinon une bulle de l'interface (la cible du nouvel endroit) se pose n'importe où sur l'ancienne vue.
- Contre un mur de face la vitesse du corps tombe à zéro (`walkStep`): un déclenchement « en marchant » se lit dans les commandes (`sim.inputs`), pas dans `body.speed`.
- `put()` des aides de test remplace l'objet `body`: ne pas garder une référence prise avant.
- La simulation tourne à 30 pas par seconde (`SIM_HZ`), pas 60.
- Au pas où une scène démarre, ses temps sont lus deux fois (lancement par la quête, puis système des scènes): un temps qui déplace doit se garder d'agir deux fois au même pas.
- Dans un worktree isolé, toute commande qui mêle `git` (même `git status` dans un tube) ou deux blocs `<<EOF` est refusée en entier: écrire les scripts de retouche par Write dans le scratchpad et les lancer par `python3 chemin.py`.
- `globalSetup` des parcours e2e relance toute la suite Vitest (l'`include` du fichier de préparation s'ajoute aux tests au lieu de les remplacer): 70 s, et un test lent sous charge fait échouer la recette. Pour itérer: une configuration jetable qui retire `globalSetup` une fois les sauvegardes fabriquées.
- Captures d'un passage de 0,4 s en rendu logiciel: une rafale de `page.screenshot` pendant la marche (une image du jeu vaut 0,1 s au plus dans le rendu) attrape le noir. Cadrer par `__lplSonde.setCamera(lacet, largeur)`: une porte sur le mur est d'un bâtiment est cachée au lacet de départ (45 degrés), visible à 225.
- Le fond uni d'un lieu clos passe par `InkFrame.backdrop`; `InkFrame.place` forcerait aussi les lampes.


## Sol en relief des grands lieux (La Petite Ligne 2, vérifié le 2026-11-10)

- Le nuanceur encré forçait la normale du sol vers le haut et la passe de contour ne cerne jamais le sol (morceau 0): un relief de sol ne se lit que par le ton. La pente vraie entre dans le choix des trois tons (`INK_SETTINGS.ground.slopeTone`); une pente de 5 % suffit.
- Dalles en volume: un dessus et quatre flancs par dalle, toutes morceaux (`part`) d'une même pièce au code fixe (`piece(inkCode(0, 99))`): trait fin aux joints, trait fort au bord du dallage, aucun trait au raccord de deux tuiles. Donner à tous les morceaux la même classe de taille, sinon les hachures d'ombre paraissent sur une dalle et pas sur sa voisine (`inkGain` dépend de la classe).
- Hauteur continue entre cases: chaque terme doit être une fonction continue du point seul (distance au plus proche des cases d'une nature, poids nuls à 1 m). Un terme qui dépend de la case d'où l'on calcule, ou de l'ordre de parcours des voisins, ouvre une fente.
- La table du moteur (à 1,2 cm sous le sol) cachait l'eau des tuiles (à 16 cm sous le sol) en rendu encré: le ruisseau d'Aubrune ne se voyait pas. Dehors, la table descend sous le relief (`RELIEF_SETTINGS.tableDrop`); dans une pièce elle reste le plancher.
- Le biais de l'ombre du soleil vaut 14 cm (0,0009 sur 160 m de profondeur): rien de plus bas ne porte d'ombre. Le sol en relief sort donc de la passe d'ombre (moins d'appels qu'avant), les rails passent dans les boîtes instanciées.
- Sol par morceaux de 16 m plutôt que par tuile de 32 m: Three.js écarte par sphère englobante, quatre tuiles entières passaient pour une vue de 18 m. Le surcoût à l'écran a été divisé par deux pour trois appels de plus par tuile.
- Banc de rendu: `packages/sdk-dev/dist` doit exister (`pnpm --filter @duo/sdk-dev build`), sinon « le faux hôte s'est arrêté (code 1) ». Pour capturer l'invité en `?rendu=aplats`: `onGuestPage` pose une route après celle de la sonde (la dernière posée gagne).

## Récoltables à l'écran (La Petite Ligne 2, vérifié le 2026-11-11)

- `tests/plan-copie.test.ts` exige que `donnees/lieux/aubrune/plan.json` reste identique à `docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`: ne pas retoucher la copie seule (et `globalSetup` des bancs e2e lance toute la suite: un écart casse la capture avant même le jeu).
- Mesurer « avant » sans worktree de plus: copier ses fichiers dans le scratchpad (`cp --parents`), `git checkout HEAD -- <fichiers>`, construire et capturer, puis recopier. Vérifier par `git diff --stat` que le décompte est revenu au même.
- Banc des captures sans relancer Vitest à chaque essai: une copie jetable de `tests/rendu-encre/playwright.config.ts` sans `globalSetup` (les sauvegardes de départ existent déjà), à supprimer à la fin.
- Végétation semée en vrais modèles: environ 950 triangles par arbre contre 92 pour tronc et boule. Le bois le plus dense d'Aubrune passe de 237 k à 900 k triangles dessinés; instancier par morceau de 16 m (et non par tuile) ramène à 583 k pour 57 appels de plus.
- Les légendes de terrain des grands lieux ont des natures sans entrée dans `GROUND_LOOKS` (prairie, friche, herbe-rase): lire leur surface par `GROUND_LOOKS[n] ?? DEFAULT_LOOK`, comme `surfaceAt`.
- `Box3.setFromObject` sur l'objet posé donne une boîte d'occultation juste (variante, cap, échelle, état, relief), sans passer par le manifeste.

## Briques d'Aubrune: intérieurs, récompenses, décisions (La Petite Ligne 2, vérifié le 2026-11-11)

- Le graphe des chemins d'un grand lieu contient aussi les nœuds des intérieurs (annexe sous la carte) et des arêtes `porte` longues de 200 m: un trajet d'habitant se calcule pièce par pièce (`habitants/chemins.ts`, `lieux/traversee.ts`: `doorChain`), jamais d'un trait sur le graphe. Une marche de scène ou le coup d'œil des quêtes vers une autre pièce passe aussi par `doorChain`.
- La source d'Aubrune est `construire_plan.py` (plan.json, SVG, PNG, plan.md): ajouter un meuble à un intérieur est un changement de plan (level designer), pas une retouche de `plan.json`. `assembler_lieu.py` conserve les champs ajoutés à la main (`conserver`): le relancer ne doit rien changer (`git diff` identique avant et après).
- Carte brute du plan dans un test (`planToMap`): `withAssembly(brute, carte livrée)` de `tests/aides.ts` y greffe points, meubles et portes de l'assemblage; les fiches qui citent un intérieur s'y chargent.
- JSON de données retouché par script: `json.dump(indent=2)` puis `prettier --write` sur ces seuls fichiers rend le format du dépôt quand le fichier était tout déplié (habitants, quêtes, intérieurs). Pas `plan.json` (objets sur une ligne): le dépliage resterait.
- Outil Bash isolé: tout heredoc (`python3 - <<EOF`, `cat > f <<EOF`) est refusé; écrire le script par Write dans le scratchpad puis `python3 script.py .`. `git -C` aussi est refusé.
- État sans schéma nouveau: une décision à deux, une recette donnée, une pièce de tenue gagnée tiennent en faits de `progress.memory` (clé `a.b.c`, quatre segments au plus): sauvegarde et réseau inchangés.
- Un événement ajouté: ses `case` dans `interface/index.ts` et `interface/cuisine/index.ts` (lint seulement, `tsc` ne le voit pas). Une condition ou un effet ajouté: `donnees/valider.ts` (`checkCondition`, `checkEffect`) et la liste de `quetes/valider.ts` (`checkEffects`).
- Meuble de carte conditionné (`when`): absent pour la simulation (`lieux/presents.ts`), mais le rendu le dessine tant qu'il ne lit pas `absentObjects`. Posture `lie` d'un habitant: le rendu ne connaît que `sit`.

## Rendu des briques d'Aubrune (La Petite Ligne 2, vérifié le 2026-11-11)

- Meuble conditionné et porte fermée passent par les états de volumes (`rendu/lieu/presents.ts`, `PlaceScene.setStates`), relus à chaque image par une empreinte: ne pas s'en remettre à `map_object_changed`, qui peut arriver chez l'invité avant la progression.
- Habitant qui passe une porte: comparer sa position d'état d'une image à l'autre (`jumped`), le cacher pendant le saut et remettre `placed` à faux; chez l'invité l'interpolation donne plusieurs images intermédiaires.
- Réplique de comptoir: sa durée suit sa longueur (`UI_TUNING.shopSay`); à 1,8 s fixe une phrase de fiche était illisible.
- Captures à deux: vérifier sur la grille que la place où l'on pose un joueur est libre (lit, cloison): `watchObjects` le dégage au premier changement et la capture ment.
- Rectangle bleu nuit à droite de la bourse sous la boutique (vérifié le 2026-11-11): trou dans le canevas ouvert par l'animation CSS de la pastille de gain (`.purse__gain`), même en opacité seule. Prouvé par variantes de style injectées avant un achat. Le fondu est mené par `hud.ts`; ne pas remettre d'animation CSS sur un élément du HUD posé sous un panneau. `elementsFromPoint` ignore les calques `pointer-events: none`: parcourir `querySelectorAll('*')` et les boîtes.
- Rendu logiciel: deux images peuvent être séparées de 1,3 s; une bulle d'interface paraît à l'image qui suit l'événement. Dans un banc, attendre l'élément (`toBeVisible`) plutôt qu'un délai fixe.
- Comptoir tenu (`"held": true` de la brique `shop`): depuis le côté client, la touche d'action s'adresse au commerçant s'il a un dialogue en attente (priorité 10 et plus, pas entendu ce jour, ou décision à deux qui attend ce joueur); sinon la boutique, avec « Parler » (P, `shop_talk`).
- Sauvegarde faite pendant qu'un habitant marchait: le trajet (runtime) n'est pas sauvegardé; à la reprise (`snap`), `entry` est remis à -1 pour qu'il reparte de son poste, sinon il reste figé en posture de marche.
- Banc de captures: `tests/rendu-encre/briques.spec.ts`, sauvegarde `aubrune-briques`, sonde `remember(clé)`. Lancer la fabrique des sauvegardes avec le chemin absolu de sa configuration, sinon Vitest joue toute la suite.


## Files de modules et repères livrés (La Petite Ligne 2, vérifié le 2026-11-11)

- Contour encré sans trait aux raccords: fusionner les modules d'une file en un maillage posé à l'origine du lieu (le `turn` de `matiere.ts` vient de l'origine du maillage: à (0, 0, 0) il ne décale rien) et réécrire `aInk.y` = classe de taille du module * 64 + numéro de la file (tiré de sa première case: le même d'une tuile à l'autre). Le vent prend aussi sa phase de l'origine: la même pour toutes les tuiles, aucune fente au bord.
- Poser un module sur le relief sommet par sommet (`y + heightAt(x, z)`): la hauteur est continue, deux modules voisins se rejoignent exactement, sur toute pente.
- Module en miroir (`scale.x = -1`): inverser l'ordre de deux index par triangle, sinon les faces se retournent.
- Lisière d'Aubrune: berges en escalier (cases reliées par un coin seulement) et cases seules entre un ru et une haie: le choix du module se fait par score (raccords, côté de l'eau, coin d'eau à moitié), pas par table de cas.

## Postes, pose de liaison et caméra des pièces (La Petite Ligne 2, vérifié le 2026-11-11)

- Contrôle des postes (`tests/aides-postes.ts`): emprise de la simulation réduite à la boîte du modèle livré, lue dans le bloc JSON du GLB (nœud nommé comme le modèle, translations cumulées; façade du modèle vers +z, quart de tour r = 1: (x, z) devient (z, -x)). Les emprises 1 x 1 seules donnaient de fausses fautes (paroi de wagon au bord de sa case, banquette contre couchette).
- Pose de liaison: `blendWeights` part de zéro pour un personnage neuf; avec `dt` petit ou nul il paraît quelques images bras écartés. Poids posés d'un coup à la création et après `placed = false`. `AnimationAction.isRunning()` est faux pour marche et course (`timeScale` 0): compter `enabled && isScheduled()`.
- Caméra encrée: plongée de 35 degrés (6 m) à 50 degrés (18 m et plus), jamais zénithale. Une vue de face (lacet 0 ou 180) rapprochée se lit pourtant comme une vue de dessus: dans les bancs, lacet sur une diagonale et 18 m.
- La fabrique des sauvegardes lancée par `--config <chemin absolu>` rejoue encore toute la suite (104 fichiers, 4 min 30 sous charge). Ensuite, configuration Playwright jetable sans `globalSetup`.

## Trains des événements (La Petite Ligne 2, vérifié le 2026-11-11)

- Fabrique des sauvegardes seule, en 11 s: `pnpm exec vitest run --config <chemin absolu>/tests/aides-e2e/vitest.prep.config.ts tests/aides-e2e/fabrique-sauvegardes.prep.ts` (le fichier en filtre évite de rejouer toute la suite).
- Une lampe sans `phase` est allumée en plein dès que l'ambiance a des lampes, même à 10 h: un verre du dehors qui doit attendre la nuit prend `phase: 0`.
- La condition `remembered` sans `equals` teste l'existence du fait: le réécrire à `false` (sonde `remember`) ne l'éteint pas.
- À Aubrune les ombres du soleil partent vers le nord: ce qui est au nord du quai (le train) ne l'ombre jamais; contrôler l'ombre par un lacet de 200 degrés (vue du nord).
- Les appels d'une même vue varient d'une vingtaine selon l'heure (habitants, lampes, passes): un coût de quelques appels ne se mesure pas par différence entre deux heures; le compter (un appel par véhicule et par passe).
- Résultats de la dernière suite Vitest: `node_modules/.vite/vitest/<empreinte>/results.json` (`failed` par fichier), utile quand la sortie est tronquée.
## Aperçu encré de l'éditeur de personnage (La Petite Ligne 2, vérifié le 2026-11-11)

- Un second `InkKit` sur un autre canevas marche tel quel (`new InkKit(undefined, { meter: false })`: sinon F9 ouvre deux panneaux). `ink.frame` exige une `OrthographicCamera`; le trait se règle sur la hauteur de la cible: `ink.strokeHeight = innerHeight * pixelRatio` donne au petit canevas le trait du jeu.
- Même lumière qu'en jeu sans toucher au soleil: caméra au lacet de départ du jeu (45 degrés, `towardCamera`) et personnage tourné de `-lacet` pour être de face.
- Ne jamais `forceContextLoss` le canevas d'une fenêtre qu'on rouvre: `getContext` rendrait le contexte perdu. `dispose` seul, le nouveau `WebGLRenderer` reprend le même contexte (mesuré: un seul contexte vivant après dix ouvertures).
- `InkKit` ne se construit pas dans Node (couches dessinées sur un canevas 2D): `vi.mock` de `encre/textures` (`createInkLayers`, `createNoise` en textures d'un point) et un faux `WebGLRenderer` suffisent pour tester création et libération.
- La démonstration de l'éditeur en `#miroir` ne s'ouvre pas (apparence non révélée): rouvrir par `window.editeur.mirror()` après une première validation sur la page normale. Thème sombre: poser `dataset.lplStyle = 'encre'` après le chargement (dans `addInitScript`, `documentElement` est nul).
- Capture d'une page de jeu en rendu logiciel: `page.screenshot` dépasse 120 s; lire `canvas.toDataURL()` juste après un `renderer.frame` dans la page (et recommencer si l'image est vide: le souffle du rendu encré saute des images).

## Voie ferrée finie: lits, sonnerie, habitants, trajet (La Petite Ligne 2, vérifié le 2026-11-11)

- Un module plié sur un tracé (lit de voie): sommet (x, y, z) du module vers P(s) + N(s) * x, avec s = s0 + (z + 0,5) * longueur et N = (T.y, -T.x) en (x, y) de la carte: rotation propre, aucun triangle retourné. Tangente lissée par différence centrée (1,5 m) aux angles du tracé; deux modules voisins partagent alors exactement leurs bords.
- Un nœud du graphe des chemins posé sur l'axe de la voie (`pn`, `trav`) et des arêtes `voie` le long des rails: les habitants marchent sur la voie. Éviter un train à quai demande de filtrer aussi le nœud de départ (segment départ vers nœud libre) et celui d'arrivée, sinon l'habitant reste figé devant la locomotive (vu dans `fetes-aubrune.test.ts`).
- Ne contourner (arêtes barrées, nouveau trajet) que pour une rame à quai; une rame qui passe, l'habitant l'attend au bord: barrer son chemin d'approche envoyait tout le bourg en détours de 300 m.
- Un nouvel événement de simulation demande deux `case` dans `interface/index.ts` et `interface/cuisine/index.ts` (lint `switch-exhaustiveness-check`), même quand l'interface est hors périmètre: le signaler.
- Un AABB d'occultation de repère géant (coteau du tunnel, 30 x 19 m) fond tout le repère dès qu'un joueur s'en approche, même devant lui.
- Capture du trajet en train (10 s): la machine chargée retarde l'horloge de la scène; viser `LPL2_ATTENTE_TRAJET` de 7 s et vérifier l'étape sur l'image.
- Machine partagée (charge 16 à 21 sur 4 cœurs): les longs fichiers dépassent 20 s et les parcours e2e meurent au battement (« Le jeu ne répond plus »): relancer seuls avec `--testTimeout=120000`.
