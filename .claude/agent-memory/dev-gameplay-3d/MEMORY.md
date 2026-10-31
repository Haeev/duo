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
- Coupe d'une maison: retrouver l'orientation de chaque mur par le centre de sa boîte (plus sûr que les noms), cacher toit et murs dont la normale regarde la caméra.

## Environnement et outils

- Le dossier temporaire est partagé entre les membres: travailler dans un sous-dossier à soi (un autre membre a écrasé un `capture.cjs`).
- Le serveur de Vite recharge la page quand d'autres membres modifient le dépôt: pour des captures stables, construire la page dans un dossier temporaire (`vite build --config` avec `rollupOptions.input`) et la servir avec `python3 -m http.server`.
- Captures WebGL2: `chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })`; attendre un drapeau posé par la page (`window.x.ready`) plutôt qu'un délai.
- Essai de fuite: créer et libérer le rendu dix fois de suite dans la page, comparer `renderer.info.memory` à chaque tour et le tas (`--enable-precise-memory-info`), compter les canevas restants.

## Son Web Audio (vérifié le 2026-10-31, La Petite Ligne)

- Séparer « cerveau » (décisions pures, testées dans Node avec le robot de la simulation sur toute la démo) et « moteur » Web Audio: le cerveau produit des commandes, le moteur les applique sur les bus du SDK (`audio.bus(name)`, `audio.context`).
- Vérifier le moteur dans Chromium sans écouter: `OfflineAudioContext` à 6 voies (un bus du SDK par paire de voies, `ChannelSplitter` vers `ChannelMerger`), piloté pas à pas par `ctx.suspend(t).then(... ctx.resume())` planifiés d'avance; attendre la fin des décodages avant `resume` (le décodage prend du temps réel, le rendu hors ligne non). Mesurer les niveaux RMS par 50 ms et comparer les échantillons au fichier (raccord de boucle exact à 1e-8).
- `OfflineAudioContext.state` vaut `suspended` pendant un `suspend(t)`: un test « le contexte joue-t-il ? » doit être injectable.
- `durationMs` d'une boucle dans `sons.json` donne la longueur de la boucle, pas du fichier (fichier = `loop.end + loop.start`, amorces comprises): compter la mémoire décodée sur le fichier.
- Distance calculée soi-même (modèle de `sons.json`, plancher `minGainDb`) et `PannerNode` en `equalpower`, `linear`, `rolloffFactor` 0: panoramique seul, peu coûteux; oreille posée derrière le personnage pour un panoramique plus doux.
- Ne pas réécrire le gain d'une voix en fondu de sortie (`setTargetAtTime` annule la rampe): drapeau `stopping`.
- Vitest: `beforeAll` a un délai de 10 s par défaut, indépendant de `testTimeout`; une démo entière jouée par le robot le dépasse quand les fichiers tournent en parallèle: passer le délai en second argument.
- Le SDK ignore `pause` tant que son état n'est pas `running` (chargement, départ synchronisé): un test de pause attend `data-statut="running"` des deux vues.
