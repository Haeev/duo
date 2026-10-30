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
