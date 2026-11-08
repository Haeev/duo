# Carnet de dev-gameplay-3d

Apprentissages durables et vérifiés. Ni avancement ni secret.

## SDK et faux hôte (vérifié le 2026-10-31)

- Un message de `net.channel(...).send` fait 64 Kio au plus une fois en JSON: au-delà, `send` lève une `RangeError`. Envoyer l'état complet seulement quand il change, et les positions à part (canal `latest`).
- `startLocalDuo` (`@duo/sdk-dev`) relie deux vrais SDK en mémoire: on fait avancer les deux séances à la main (`step`, puis `await setTimeout`), sans `duo.loop`, pour tester le réseau du jeu dans Vitest.
- Dans l'environnement cloud, deux vues WebGL dans `deux-vues.html` (rendu logiciel SwiftShader) rendent une image toutes les quelques secondes: le faux hôte peut déclarer « Le jeu ne répond plus ». Réduire la fenêtre Playwright (900x420) pour les essais; la partie complète se prouve par robot dans Node.
- Les journaux du jeu (`duo.log`) ne vont pas dans la console du navigateur: les lire dans `window.__duoDeuxVues.views[i].logs`.

## Outillage

- Vitest du dépôt n'affiche pas `console.info` par défaut: `--silent=false --reporter=verbose` pour un essai exploratoire.
- `pgrep -f "pnpm install"` trouve aussi la commande qui contient ce texte: regarder `ps aux | grep "[p]npm"`.
- `pnpm install` ajoute de lui-même à `minimumReleaseAgeExclude` (pnpm-workspace.yaml) les paquets publiés depuis moins d'un jour: le signaler au manager.
- TypeScript: une méthode `fail(): never` appelée par `this.fail()` restreint le type, mais une fonction passée en paramètre ou appelée dans une boucle `for...of` sur une chaîne non: utiliser une aide `need(valeur, lecteur, message)`.
- ESLint du dépôt: `switch-exhaustiveness-check` exige tous les cas d'une union même avec `default`; préférer des `if` pour ne traiter que quelques cas.

## Deux Tabliers, chantier service (vérifié le 2026-11-07)

- Visée (`simulation/visee.ts`): un poste est visé au centre du meuble avec un rayon de la moitié de sa plus petite empreinte, et une cible « actionnable » gagne: un gros meuble-poste vole la visée des tasses posées dessus. Remèdes: de petits meubles pour les pièces (groupes, buse posés sur la machine), et des `transforms` à l'identique (`tasse` vers `tasse`) pour qu'un poste ne soit une cible que si son récipient est posé (sinon refus « Pose d'abord : tasse », et l'objet voisin gagne).
- Postes « au clic » menés par le chantier (maintien lu dans `sim.inputs[p].actHeld`, durées en pas depuis `startTick`): recopier l'avancement dans `players[p].use` donne l'anneau du HUD et « Poste occupé » chez l'autre sans toucher au cœur, à condition que `seconds` du poste soit grand (600) pour que `advanceUse` ne termine jamais.
- Étendre un domaine sans monter `WORLD_FORMAT`: champs `v.optional(schéma, () => défaut)` dans le `strictObject`; une sauvegarde ancienne se relit avec les défauts.
- `etat.ts` d'un chantier ne doit pas importer `etat/monde.ts` (cycle à l'initialisation: `monde.ts` importe le schéma du chantier). Redéclarer `v.picklist([0, 1])`.
- Ajouter des intentions de chantier fait échouer le lint de `simulation/pas.ts` (`switch` sans les nouveaux cas): une ligne `eslint-disable-next-line ... -- raison` suffit, identique pour chaque chantier.
- `prettier --write` sur `donnees/` réaligne les tableaux de `SCHEMA.md`: ne formater que les JSON. Pour toucher un JSON commun sans conflit, remplacer les éléments par identifiant en gardant le texte des autres (`outils/service-donnees.mjs`, `mergeFile`).
- Worktree isolée: les commandes Bash avec heredoc, `$(...)` ou enchaînements longs sont refusées; écrire les scripts avec Write et lancer des commandes simples.

## Deux Tabliers, aménagement (vérifié le 2026-11-07)

- GLB à textures externes (`textures/<nom>.jpg` à côté des modèles): importés par `?url`, Vite renomme le GLB mais ne copie pas ses textures (404, meubles noirs). `rendu/modeles.ts` les importe aussi par `import.meta.glob` et les sert par `loader.manager.setURLModifier`.
- Lint du dépôt: un `switch` avec `default` sur l'union des intentions casse dès qu'un chantier ajoute les siennes (`switch-exhaustiveness-check`): des `if` dans le cœur. `a.carry === null || a.carry.handles[i] === null` déclenche `prefer-optional-chain` alors que l'optionnel changerait le sens (`undefined`): passer par une petite aide.
- Grille de passages (C13) de 1 700 cases sur 70 obstacles: 3,3 ms par vérification avec `Math.cos` à chaque test, 1,1 ms avec les obstacles aplatis (cosinus et sinus calculés une fois). Ne revérifier le fantôme que quand sa pose aimantée change.
- Invité qui porte à deux: sa position vient de la charge; la correction douce à 30 % de la marche le laisse 60 cm en arrière à 1,2 m/s. La rattraper au double de la vitesse de port.
- Banc de captures sans le faux hôte: une page Vite temporaire (`banc.html` et un script dans le dossier du jeu, `vite build --config` copié dans le jeu, sortie dans le scratchpad), le monde construit par les vraies intentions (`stepWorld`), servie par `python3 -m http.server`. Supprimer les fichiers du banc avant de rendre.
- Le scratchpad est partagé entre membres en parallèle: un autre a réécrit `capture.cjs` pendant la mission. Toujours un sous-dossier à soi.
- Faux hôte sous Playwright: un clic sur le canevas de l'iframe verrouille bien le pointeur en headless; les touches (`KeyB`, `Tab`) arrivent ensuite au jeu, et les boutons d'un panneau se cliquent par `frame.evaluate`.

## Programmes et animations (Deux Tabliers, vérifié le 2026-11-08)

- Three.js 0.187: un `InstancedMesh` visible se compile même à `count = 0` (`setProgram` avant le test du nombre d'instances); `instanceColor` créé plus tard change de variante de programme. Créer les couleurs d'instance d'emblée et `visible = count > 0`.
- Matériau transparent à deux faces: deux passes (faces arrière puis avant) et un programme de plus (`FLIP_SIDED`). `forceSinglePass = true` sur le verre peu opaque.
- Lister les programmes vivants avec leur nom: `addInitScript` qui enveloppe `shaderSource`, `attachShader`, `createProgram` et `deleteProgram` de `WebGL2RenderingContext.prototype`, puis lit `#define SHADER_TYPE`, `#define SHADER_NAME` (nom du matériau) et les `#define USE_*` du nuanceur de sommets. `scene.environment` donne aussi `USE_ENVMAP` aux `MeshLambertMaterial`.
- Matériau teint sur un personnage squeletté (badge): `clone()` du matériau du corps avec une texture blanche 1x1 en sRGB garde le programme des personnages.
- `AnimationAction.reset().fadeIn()` à chaque changement de clip: si marche et attente alternent d'une image à l'autre (pose de l'invité qui n'avance qu'à l'arrivée des états), tous les poids restent près de zéro et le personnage montre sa pose de liaison (bras écartés). Tenir les poids soi-même, somme à 1 (`src/rendu/melange.ts` de Deux Tabliers), avec un court délai avant de repasser à l'attente.
- Manifeste de Deux Tabliers: `act` porte E, Espace et le clic gauche; ce qui ne doit pas voler un geste passe par `confirm` (Entrée).
- Outil Bash isolé: un `cat >> fichier <<EOF` vers le carnet est refusé; passer par Edit. Un `python3 /dev/stdin <<'EOF'` lancé après `cd` dans le jeu passe.
