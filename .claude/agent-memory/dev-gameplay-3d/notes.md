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
- Outil Bash isolé (2026-11-08): `python3 - <<'EOF'` et `cat > fichier <<'EOF'` sont refusés aussi; une boucle `for f in $(git diff ...)` également. Écrire le script avec Write dans le scratchpad et le lancer par `bash script.sh <racine>`.
- Preuve « rien ne change sans le nouveau levier » (Deux Tabliers, remises): `git worktree add --detach <scratchpad>/base HEAD` avant de committer, `pnpm install --prefer-offline` (moins d'une seconde), puis la même recette (`RECETTE_JOURNAL=1 ... vitest run tests/recette-quinze-jours.test.ts | grep '^{'`) des deux côtés et `cmp`. Retirer ensuite par `git worktree remove --force`.
- Deux Tabliers: `outils/importer-clientele.py` régénère tous les fichiers de `donnees/clientele/`; `regles.json` a des clés écrites à la main que le script ne connaît pas: le restaurer par `git checkout` après l'avoir relancé.
- Deux Tabliers, aperçu de l'interface (`src/interface/apercu/`): on peut y brancher les vrais lecteurs sur une vraie maison (`loadContent(DATA_FILES)` marche dans le navigateur), plus fiable qu'un modèle écrit à la main. Le bilan est long: défiler les conteneurs (`scrollTop = scrollHeight`) avant la capture.
- valibot `v.optional(x, défaut)`: le type de sortie rend le champ obligatoire; tout littéral `Report` ou `Group` doit l'écrire (le typecheck le dit).

## Deux Tabliers, mains à doigts (vérifié le 2026-11-08)

- Poses des doigts (`relaxed`, `grip_handle`, `grip_glass`, clips sur les seuls os des doigts) jouées dans le même mélangeur que le corps, toujours toutes les trois, en pause, poids complémentaires (`createClipBlend().grip`): les os ne se recouvrent pas, aucune pose de liaison ne revient.
- Prises de l'artiste (`doigts.prises`): main = récipient · prise⁻¹, poignet = récipient − main · position. Les prises varient beaucoup d'un personnage à l'autre (poignet au-dessus, à côté ou devant l'anse): orienter le récipient par la direction du poignet (`wristDirection`), pas par l'anse. Poignet tourné vers soi: il descend quand la tasse s'incline vers la bouche, la main reste sous l'œil.
- Banc de captures de la gorgée: page Vite temporaire qui monte `createCustomerNodes` sur un faux `GameView` (monde de `createWorld`, groupe `spawnGroup` passé à `seated`, `servedAt` posé), et cherche l'instant où `sipTime` vaut le temps voulu. Viser `headfront` plus 4 cm devant pour la vue de profil: centrée sur la tête, la main sort du cadre.
- Lint: une variable `let` relue après un `await` est jugée « toujours fausse » (`no-unnecessary-condition`, rétrécissement d'avant l'attente): la relire par une petite fonction.

## Pages de démonstration (vérifié le 2026-11-10)

- Construire une page de démonstration hors du serveur partagé: `npx vite build <dossier-de-la-page> --base ./ --emptyOutDir --outDir <scratchpad>/<sous-dossier>/site` depuis le paquet. Une config Vite posée dans le scratchpad ne trouve pas `vite` (ERR_MODULE_NOT_FOUND).
- Le scratchpad est partagé: un autre membre a réécrit mon `donnees.py` entre deux appels. Toujours un sous-dossier à soi, et ne jamais relancer un script du scratchpad sans le relire.
- `prettier --write` sur un fichier commun pas encore formaté (ex. `src/interface/index.ts`) réécrit les lignes des autres: n'y appliquer que des modifications à la main.
- la-petite-ligne-2: les tests des autres lots posent des objets et des joueurs vers (30, 30), (10, 20), (20, 16) de la gare d'essai: tout ajout bloquant sur cette carte (eau, mur) doit éviter ces cases (étang de pêche mis en 3..11 x 32..37). `tests/gabarits.test.ts` crée la prise `gardon`: ne pas prendre cet identifiant dans les données.
- Mini-jeu local validé par l'hôte: rejouer un journal compact des touches (lettre + nombre de pas) à pas fixe, avec la graine donnée par l'hôte; le hasard du robot pêcheur doit avoir sa propre graine pour ne pas décaler celui du combat.

## Grands lieux par tuiles (vérifié le 2026-11-10, Three.js 0.187)

- Effacer une partie d'un maillage fusionné sans le refaire: maillage principal à tableau de matériaux `[m]` et groupes d'index (tout sauf la partie), plus une copie transparente qui partage la géométrie et règle `setDrawRange` dans `onBeforeRender`/`onAfterRender` (et `onBeforeShadow`/`onAfterShadow`). Un maillage à tableau de matériaux sans groupe ne dessine rien: toujours au moins un groupe. Même méthode pour le sol lointain (groupes = tuiles non construites).
- Houppier instancié à effacer: matrice d'échelle nulle sur l'instance, copie `Mesh` transparente. Donner aux géométries unité un attribut `color` blanc et un matériau `vertexColors`: la copie prend alors un clone du matériau du sol (même programme que les autres fondus).
- `InstancedMesh.dispose()` libère les tampons d'instances (pas la géométrie partagée): l'appeler au déchargement d'une tuile.
- `renderer.info.memory.geometries` ne compte que ce qui a été dessiné au moins une fois: pour un contrôle de fuite, comparer deux états obtenus par le même chemin (l'hystérésis rend l'anneau dépendant du trajet), pas un départ frais et un retour.
- Page de démonstration qui importe un outil Node (`outils/plan-vers-lieu.ts`): config Vite à soi dans le dossier de la page (`resolve.alias` de `node:fs` et `node:url` vers un module vide, `define: { 'process.argv': '[]' }`), lancée par `pnpm exec vite --config <page>/vite.config.ts` depuis le paquet. Un `prettier --write` pendant une capture recharge la page (HMR) et casse `page.evaluate`.
- Boucle `for` d'un parcours en largeur sur un tableau qui grandit: `for (const i of queue)` suit la longueur (règle `prefer-for-of`).

## La Petite Ligne 2: budget du dehors et banc d'ensemble (vérifié le 2026-11-11)

- Banc `tests/rendu-encre/ensemble.spec.ts`: `LPL2_VUES=a,b` ne joue que ces vues (15 s par vue), `LPL2_PASSES=1` ouvre l'outil de mesure (F9) et relève appels et triangles par passe (`__lplMesure.passes()`: ombre du soleil, lampe, scène, contour). Toujours mesurer par passe avant de choisir un levier: au quai, sans un arbre, l'image coûte déjà 258 000 triangles (121 000 d'ombre, 136 000 de scène).
- La passe d'ombre du soleil couvre le disque vu plus 6 m: un maillage instancié qui touche ce disque est dessiné en entier. Ombres portées par des jumeaux allégés jamais dessinés (`userData[SHADOW_ONLY]`, même forme « instancié et coloré » donc aucun programme de plus), rangés par gros morceaux (16 m); maillages dessinés par petits morceaux (8 m).
- Une version allégée garde la silhouette si elle garde le NOMBRE de festons (leur angle dépend du compte dans `touffe`): on ne réduit que les pans et les rangs. États `far` et `shade` du manifeste, réglés par `[allege.*]` de `recoltables.toml`.
- L'icosaèdre de Three.js n'a pas de sommet au pôle: seules 2 faces sur 20 sont sous y = -0,5; retirer « le dessous » d'un caillou ne rapporte rien.
- Natures d'Aubrune absentes de `GROUND_LOOKS` (sous-bois, prairie, potager, place...): elles prennent l'herbe par défaut; les arbres semés ne poussent que sur `hors-jeu` et `pre`.
- Heredoc Python refusé dès qu'il est long ou suivi d'une autre commande: scripts de retouche par Write dans le scratchpad (paires ancien/nouveau avec `assert count == 1`), lancés par `python3 script.py .`.

## La Petite Ligne 2: photo du prologue et parcours à deux (vérifié le 2026-11-11)

- Parcours Playwright dans un arbre neuf: `pnpm --filter @duo/sdk-dev build` d'abord, sinon « le faux hôte s'est arrêté (code 1) » (pages de la coque absentes). Le `globalSetup` relance toute la suite Vitest (35 s) à chaque lancement: un test rapide cassé empêche tout parcours. Le faux hôte sert `dist` en direct: ne pas relancer `vite build` pendant qu'un parcours tourne.
- Captures en 1366 x 768 dans un parcours: `page.setViewportSize`, attendre 6 s (rendu logiciel), capturer, puis revenir à la petite taille pour marcher (`windowSize`).
- Apparence: `look === null` veut dire « jamais composé », pas « caché ». Caché ou révélé se lit par `lookRevealed` (fait `joueurs.apparence.j<n>`); `createWorld` révèle d'office si le lieu de départ n'a aucun `reveal_look` (lieux d'essai, démonstrations, bancs).
- Une silhouette d'une seule teinte: repeindre l'attribut `color` des géométries assemblées (corps, tête, ensemble), même matériau donc aucun programme de plus; la clé de géométrie partagée doit porter la teinte.
- Quêtes: la condition `talked` avec `node` n'est vue que si la réplique reste affichée plus d'un pas (dans un test: `wait` entre deux `talk_next`).
- Trace d'essai: `JSON.stringify` d'un tableau où l'on a poussé `player.talk` montre l'état final partout (même objet muté); copier le champ lu.
- Ajouter un effet aux données: schéma (`regles.ts`), `effets.ts`, `donnees/valider.ts` et `quetes/valider.ts` (deux `switch` exhaustifs).

## La Petite Ligne 2: agenda et données (vérifié le 2026-11-11)

- Un état « du jour » se lit, ne s'écrit pas: condition `event_is` (`on`, `begun`, `today`, `tomorrow`). `begun` repose sur le fait moteur `agenda.<lieu>.<événement>` = jour du début, car les conditions d'un événement, évaluées sur l'état présent, changent dans la soirée (la première veillée vécue efface son propre événement).
- `remember` n'efface rien: `forget` (`regles/memoire.ts`); le réseau transmet les clés retirées de la mémoire (`drop` de `reseau/progression.ts`).
- L'interface ignore `outlook_ready` et ne lit pas `common.outlook` (état juste, rien d'affiché au 2026-11-11).
- Sonde dans un test long: script Python de remplacement sur le fichier de test, lancement filtré (`-t`), puis `git checkout` du fichier. Une commande qui enchaîne `mkdir` puis `cp` hors du scratchpad échoue en bloc: créer les dossiers à part.

