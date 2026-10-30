# Carnet d'architecte-technique

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Sources et environnement cloud (vérifié le 2026-10-30)

- Refusés par la politique réseau: electronjs.org, support.microsoft.com, hackaday.com. La documentation d'Electron se lit sur `https://raw.githubusercontent.com/electron/electron/v<version>/docs/...` (prendre le tag de la version installée). developer.apple.com répond (notes techniques en `.md`).
- `gh api` est limité au dépôt de la session: pour une autre bibliothèque, lire son paquet npm (schéma de configuration, `.d.ts`, code).
- Electron dans l'environnement cloud: on y tourne en root, donc `--no-sandbox` obligatoire; WebGL2 en rendu logiciel seulement avec `--enable-unsafe-swiftshader`; capture de tout l'écran Xvfb avec `import -window root` (ImageMagick).
- Playwright préinstallé globalement: `NODE_PATH=$(npm root -g) node script.js` pour `require('playwright')` depuis un dossier temporaire.
- Valider un schéma Mermaid: le rendre avec le paquet `mermaid` dans Chromium (Playwright), puis examiner la capture.

## Electron 45

- Depuis Electron 42, plus de `postinstall`: le binaire se télécharge au premier lancement ou par `npx install-electron --no`.
- Depuis 45, un preload en bac à sable n'a plus `Buffer`, `events`, `timers` ni `url`.
- L'événement `unresponsive` ne se déclenche pas pour une page bloquée sans entrée utilisateur en attente: détecter un blocage par battement de cœur.
- Une iframe d'un autre schéma personnalisé tourne dans un processus séparé; une `WebContentsView` transparente se superpose bien à une autre (essai sous Linux).
- macOS: l'exécutable principal d'Electron est un petit lanceur dont l'UUID est fixe pour une version donnée, donc partagé par toutes les applications bâties dessus; TN3179 indique que cela perturbe l'autorisation Réseau local.
- macOS: les notifications natives exigent une application signée depuis Electron 42.
- `node:sqlite` est disponible dans le Node d'Electron 45 (Node 24.22).

## Outillage

- typescript-eslint 8.72 exige `typescript <6.1.0`: rester sur TypeScript 6.0.x tant que TypeScript 7 n'est pas pris en charge.
- Zod 4 sonde `new Function` (rapport de violation sous CSP stricte) sauf configuration `jitless`; Valibot ne génère pas de code.
- electron-builder 26: sans `mac.identity`, aucune signature (pas de repli ad hoc); `"-"` pour l'ad hoc, avec `hardenedRuntime: false`.
- electron-updater: sous macOS il passe par Squirrel.Mac (signature Developer ID exigée); sous Windows un NSIS non signé est accepté tant que `publisherName` est absent.
