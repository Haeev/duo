# Carnet d'architecte-technique

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Sources et environnement cloud (vérifié le 2026-10-30)

- Refusés par la politique réseau: electronjs.org, support.microsoft.com, hackaday.com. La documentation d'Electron se lit sur `https://raw.githubusercontent.com/electron/electron/v<version>/docs/...` (prendre le tag de la version installée); son code source au même tag (`shell/browser/api/*.cc`) tranche ce que la documentation ne dit pas. developer.apple.com répond (notes techniques en `.md`).
- `gh api` est limité au dépôt de la session: pour une autre bibliothèque, lire son paquet npm (`npm pack <paquet>@<version>`, puis schéma de configuration, `.d.ts`, README) ou ses fichiers sur raw.githubusercontent.com.
- Electron dans l'environnement cloud: on y tourne en root, donc `--no-sandbox` obligatoire; WebGL2 en rendu logiciel seulement avec `--enable-unsafe-swiftshader`; capture de tout l'écran Xvfb avec `import -window root` (ImageMagick).
- Playwright préinstallé globalement: `NODE_PATH=$(npm root -g) node script.js` pour `require('playwright')` depuis un dossier temporaire.
- Valider un schéma Mermaid: extraire les blocs du `.md`, les rendre avec `mermaid.render()` (paquet `mermaid` chargé par `addScriptTag`) dans Chromium par Playwright, capturer chaque SVG, examiner les captures.
- Mesurer un poids gzip: esbuild installé dans un dossier temporaire, `NODE_PATH=<deps>/node_modules esbuild entree.js --bundle --minify --format=esm --define:process.env.NODE_ENV='"production"'`, puis `gzip -9 -c | wc -c` (esbuild n'a pas d'option `--node-paths`).
- Les autres membres peuvent écrire dans le même arbre pendant ma mission (`docs/plateforme/decisions/` par exemple): relancer `ls` et `git status` avant de rendre, et relire leurs fichiers qui me citent.

## Electron 45

- Depuis Electron 42, plus de `postinstall`: le binaire se télécharge au premier lancement ou par `npx install-electron --no`.
- Depuis 45, un preload en bac à sable n'a plus `Buffer`, `events`, `timers` ni `url`.
- L'événement `unresponsive` ne se déclenche pas pour une page bloquée sans entrée utilisateur en attente: détecter un blocage par battement de cœur.
- Une iframe d'un autre schéma personnalisé tourne dans un processus séparé; une `WebContentsView` transparente se superpose bien à une autre (essai sous Linux).
- Le verrou d'instance unique (`requestSingleInstanceLock`) est pris dans `userData` (`chrome::DIR_USER_DATA` dans `electron_api_app.cc`): appeler `app.setPath('userData', ...)` avant, et deux instances aux dossiers distincts coexistent.
- `before-input-event` sur un `webContents` est émis avant les événements clavier de la page; `preventDefault()` les supprime (pour réserver Échap).
- `powerSaveBlocker`: `prevent-display-sleep` garde écran et système éveillés et l'emporte sur `prevent-app-suspension`, qui laisse l'écran s'éteindre.
- macOS: l'exécutable principal d'Electron est un petit lanceur dont l'UUID est fixe pour une version donnée, donc partagé par toutes les applications bâties dessus; TN3179 indique que cela perturbe l'autorisation Réseau local.
- macOS: les notifications natives exigent une application signée depuis Electron 42.
- `node:sqlite` est disponible dans le Node d'Electron 45 (Node 24.22).
- Les fusibles d'une application publiée ferment les options d'inspection: Playwright pilote l'application non empaquetée, l'application empaquetée se teste par son journal (convention de l'ADR 0011).

## Outillage

- typescript-eslint 8.72 exige `typescript <6.1.0`: rester sur TypeScript 6.0.x tant que TypeScript 7 n'est pas pris en charge.
- Zod 4 sonde `new Function` (rapport de violation sous CSP stricte) sauf configuration `jitless`; Valibot ne génère pas de code.
- Valibot 1.5: `object()` retire les champs inconnus, `looseObject()` les garde, `strictObject()` les refuse (aide dans ses `.d.ts`).
- electron-builder 26: sans `mac.identity`, aucune signature (pas de repli ad hoc); `"-"` pour l'ad hoc, avec `hardenedRuntime: false`. NSIS: `deleteAppDataOnUninstall` vaut `false` par défaut (schéma de app-builder-lib 26.18.0).
- electron-updater: sous macOS il passe par Squirrel.Mac (signature Developer ID exigée); sous Windows un NSIS non signé est accepté tant que `publisherName` est absent.
- Preact 11.0.0 est sorti le 2026-09-30: modules ES seulement, TypeScript 5.1 au moins, `useRef` exige une valeur initiale, `defaultProps` et suffixe `px` passés dans `preact/compat`. Guide: `raw.githubusercontent.com/preactjs/preact-www/master/content/en/guide/v11/upgrade-guide.md`. Poids mesurés: Preact 11.1 avec hooks et signaux 8,4 Ko gzip, React 19.3 avec ReactDOM 68,9 Ko.
- yauzl 3.4 applique `validateFileName` à chaque entrée (refuse chemins absolus, `..`, barres obliques inverses) tant que `decodeStrings` est vrai.
- Node: Ed25519 natif (`crypto.sign(null, ...)`, `crypto.verify(null, ...)`); gzip niveau 1 d'un JSON de 8 Mo en 34 ms (rapport 8,7) par l'API asynchrone, sans bloquer la boucle d'événements.
- Polices de l'identité « Étoile double »: `@fontsource-variable/jost` et `@fontsource-variable/dm-sans` 5.3.0, OFL-1.1.

## SDK et faux hôte (lot L3, vérifié le 2026-10-31)

- Node 22.22 efface les types sans option: un script Node en TypeScript se lance tel quel (`node src/serveur/servir.ts`) si ses imports relatifs portent `.ts` (`allowImportingTsExtensions`, `erasableSyntaxOnly`) et s'il n'importe à l'exécution aucun paquet du monorepo écrit en imports sans extension (les `import type` sont effacés, donc permis). Node refuse d'effacer les types sous `node_modules`.
- Environnement cloud: `@playwright/test` 1.64.1 attend Chromium 1248, seul 1243 est installé (`/opt/pw-browsers/chromium`): `launchOptions.executablePath` dans `playwright.config.ts` (fait dans `packages/sdk-dev`).
- `pkill -f motif` tue aussi le shell de la commande si le motif apparaît dans sa ligne (code 144): garder le PID du processus lancé, ou vérifier avec `ss -ltnp`.
- Sur une adresse `http://192.168...` (contexte non sécurisé), ni `crypto.randomUUID` ni `navigator.keyboard` n'existent: `crypto.getRandomValues` reste disponible; libellés des touches en AZERTY par défaut.
- Vite 8: `build.rolldownOptions` remplace `rollupOptions` (dépréciée).
- typescript-eslint: `JSON.stringify` est typé `string`; pour tester `undefined` sans `no-unnecessary-condition`, passer par une fonction typée `string | undefined`. Étaler un objet à accesseurs (`{ ...base }`) fige leurs valeurs: `Object.assign(base, ...)` les garde.
- Valibot: un schéma `v.array` sort un tableau mutable; ajouter `v.readonly()` pour accepter des `readonly T[]` du code appelant.

## Mesures et revues de jeux (vérifié le 2026-10-31, gauntlet de La Petite Ligne)

- Temps d'un pas de simulation sur la machine cloud partagée: `performance.now()` donne des pics de plusieurs centaines de ms, non reproductibles (charge moyenne de 25 quand d'autres agents tournent); mesurer le temps processeur avec `process.cpuUsage()` et écarter le ramasse-miettes par `PerformanceObserver` sur `entryTypes: ['gc']` (`node:perf_hooks`).
- Lancer un test Vitest de mesure sans toucher au dépôt: fichier et config dans `/tmp` (`test.include` en chemin absolu, `test.root` = dossier du jeu), imports du jeu par `await import('/chemin/absolu/fichier.ts')`, puis `npx vitest run --config /tmp/.../vitest.config.mjs` depuis le dossier du jeu.
- Playwright: écrire chaque résultat au fil de l'eau; un seul `console.log` final se perd si la page ou le navigateur tombe en fin de script. Sous SwiftShader et machine chargée, une scène de `rendu.html` demande environ 1,5 min.
- SDK: `NetChannel.send` lève une `RangeError` au-delà de 64 Kio et la boucle (`loop.ts`, `stepper.ts`) n'attrape rien: l'exception devient `fatal` et arrête la partie des deux côtés. Un jeu qui réplique son état complet doit surveiller sa taille.
- Three.js 0.187 gère la perte du contexte WebGL (`preventDefault` dans `onContextLost`, réinitialisation dans `onContextRestore`); essai possible par `renderer.forceContextLoss()`.

## Notes du tour 2 du gauntlet (2026-10-31)

- Three.js 0.187 garde les programmes par matériau: couper les ombres à chaud en compile de nouveaux (11, 16 puis 20 programmes mesurés).
- Durée d'image moyenne: temps cumulé divisé par le nombre d'images, pas une moyenne pondérée par le temps (elle surévalue les images en retard).
- Vitest 5 n'a pas d'option `--include`: configuration à part avec `defineConfig` (`mergeConfig` concatène les `include`).
- Prettier lit sa configuration selon l'emplacement du fichier: une copie dans `/tmp` est jugée avec les réglages par défaut.
- Dans une copie isolée (worktree), `git -C` et `NODE_PATH=... node` peuvent être refusés; Playwright se charge alors par `require('/opt/node22/lib/node_modules/playwright')`.

## Prototypes de mesure sans toucher au dépôt (vérifié le 2026-11-01, tour 10)

- Une copie isolée (worktree) peut partir d'un commit ancien: comparer `git log -1` à la branche de la session et avancer par `git merge --ff-only <branche>` avant de lire les documents du brief. Ses dépendances: `pnpm install --frozen-lockfile --offline` à la racine de la copie (2 s, magasin partagé).
- Modifier une donnée du jeu seulement pour une mesure: greffon Vite `enforce: 'pre'` dont `transform(code, id)` réécrit le JSON servi (`donnees/cartes/halte.json` pour élargir la carte), dans une config Vite placée dans `/tmp` (`root` = dossier du jeu). Un `vitest.config.mjs` dans `/tmp` doit être un objet nu (`import 'vitest/config'` ne se résout pas hors du dépôt).
- `page.screenshot` dépasse 200 s sous SwiftShader quand la machine est chargée (charge 30): lire la toile par `canvas.toDataURL()` dans un `requestAnimationFrame` (rappel inscrit après celui du moteur, donc même image) et écrire le PNG depuis Node.
- `nohup ... &` dans une commande Bash: les serveurs survivent mais leur journal est écrasé si on relance; vérifier le mode d'un serveur par `/proc/<pid>/environ`.
- Le garde de la copie isolée refuse toute commande où apparaît `--exclude-dir=.git` ou une variable en position d'argument: le contrôle des tirets passe par l'outil Grep (classe de caractères des deux tirets interdits, U+2014 et U+2013), qui saute les dossiers cachés: compléter par `grep -rnI` nommant `.claude` et `docs` explicitement.
- La Petite Ligne: `triangleSplit().meshes` nomme les morceaux du décor par une empreinte qui change avec la carte; comparer par groupe (`parent/` avant la barre), pas par nom.
- Three.js 0.187: le nombre de lumières ponctuelles entre dans la clé des programmes; une lampe d'intensité nulle compte encore, la retirer ou en ajouter une recompile les matériaux éclairés.
