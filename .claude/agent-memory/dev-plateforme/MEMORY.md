# Carnet de dev-plateforme

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Electron 45 (vérifié le 2026-10-31, Linux, xvfb)

- Le paquet `electron` 45 n'a plus de script d'installation: le binaire se télécharge au premier `require('electron')`, ou d'avance par `node node_modules/electron/install.js` (`path.txt` apparaît alors).
- Preload en bac à sable: un seul fichier CommonJS, sans module voisin. electron-vite 6: `preload.build.isolatedEntries: true`, `externalizeDeps: false`, `rolldownOptions.output: { format: 'cjs', entryFileNames: '[name].cjs' }`. Garder valibot hors des preloads (constantes recopiées).
- `MessagePortMain`: un `ArrayBuffer` mis dans la liste de transfert d'un `postMessage` de la page arrive au principal comme un objet vide `{}`; copié (sans transfert), il arrive intact. Parade en place: `preload-game` remet à la page le port d'un `MessageChannel` local et recopie chaque message vers le port du principal.
- `before-input-event` ne voit pas les touches simulées par Playwright (CDP), même vue focalisée. Pour éprouver Échap: `BaseWindow.focus()`, `webContents.focus()` de la vue jeu, puis `xdotool key Escape` (`apt-get install xdotool`).
- Sous Xvfb sans gestionnaire de fenêtres, aucune fenêtre n'a le focus au départ (`webContents.isFocused()` faux partout).
- Le correcteur orthographique télécharge ses dictionnaires (`redirector.gvt1.com`): `session.setSpellCheckerEnabled(false)` sur chaque session (hors ligne).
- `page.evaluate` de Playwright échappe à la CSP de la page: vérifier la CSP par l'en-tête servi (`fetch(location.href)`), pas par un `new Function` évalué.
- Fermer Duo pendant une partie demande confirmation (M-15): l'aide de test `closeDuo` confirme, puis tue le processus en dernier recours, sinon la suite se bloque.
- `View.setBackgroundColor` prend `#AARRGGBB` (`#00000000` transparent); index 0 de `addChildView` = sous les autres vues.
- Three.js `GLTFLoader` lit les textures intégrées aux `.glb` par `fetch(blob:...)`: la CSP des jeux doit admettre `blob:` en `connect-src`.

## Outillage

- Paquet partagé Node et principal: sources TypeScript avec imports en `.ts` et `erasableSyntaxOnly` (comme `@duo/liaison`, `@duo/paquet`). Un `.mjs` d'`outils/` l'importe par son nom de paquet: Node 22.22 retire les types sans avertissement, car le lien pnpm se résout hors de `node_modules` (vérifié le 2026-11-02). Le consommateur TypeScript ajoute `allowImportingTsExtensions`. `@duo/protocol` (imports sans extension) ne tourne pas sous Node seul.
- yazl écrit l'heure DOS avec les accesseurs locaux: une archive reproductible veut `new Date(2000, 0, 1)` (heure locale) et `forceDosTimestamp: true`. yazl refuse d'écrire `..`: pour un test, remplacer le nom dans les octets (même longueur).
- La CSP du lanceur interdit `fetch('duo-game://...')` depuis la page: vérifier une vignette par `naturalWidth`.
- Constantes de test (clé publique de test, variables `DUO_TEST_*`) écrites dans une branche `if (DUO_TEST)`: absentes de `out/main/index.js` en version publiée (seuls les commentaires JSDoc restent).
- Vite 8 (Oxc) sans greffon Preact: `oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } }` dans la config du rendu.
- Trois programmes TypeScript (Node, page, preload) plus un pour les tests Playwright: ESLint avec `parserOptions.project` (liste) et `projectService: false`, ajouté après `createEslintConfig`.
- Le Chromium préinstallé (`/opt/pw-browsers/chromium-*/chrome-linux64/chrome`) ne correspond pas toujours à la version attendue par `@playwright/test`: passer `executablePath` en repli.
- La garde des copies isolées refuse les commandes bash longues ou avec heredoc: écrire le script dans le dossier temporaire de la session, puis `python3 <script>`.

## Conventions de l'application

- État publié complet à chaque changement (micro-tâche), notifications par clé (`ToastKind`): tous les textes restent dans `renderer/textes.ts`, typographie posée par `fr`.
- Les touches de jeu simulées (Espace) passent par Playwright; Échap passe par `xdotool`.

## Pont et tests à deux Duo (vérifié le 2026-11-04)

- Le schéma `init` du SDK est strict: un champ ajouté à `init` (mineure du pont) ne part qu'aux jeux dont `hello` annonce cette mineure, sinon un jeu publié refuse `init`. Le principal connaît le pont du jeu avant d'envoyer `init`.
- Deux La Petite Ligne en rendu logiciel: une image par seconde environ, et une page peut se figer plus de 8 s (chien de garde, « hung »). Alléger: `rendu=leger`, petites fenêtres (`setMinimumSize` puis `setSize` dans `app.evaluate`, taille en argument), fenêtre de l'invité cachée (`BaseWindow.hide()`: plus de rendu, la simulation suit au minuteur).
- Une longue frappe Playwright touche par touche (`keyboard.type`, 60 caractères) dans la page de La Petite Ligne fige la page même dans une zone de saisie ordinaire, sans rien de nouveau: `keyboard.insertText` pour un texte long.
- Un message du jeu peut mettre plus d'une demi-seconde à atteindre le principal en rendu logiciel: avant une vraie touche qui dépend d'un état annoncé par le jeu, attendre la trace dans le journal (`logs/*.jsonl`).
- `xdotool key ctrl+n` passe par `before-input-event` comme Échap; `webContents.capturePage()` de la vue jeu inclut l'interface HTML du jeu, pas le canevas seul.

## Interfaces DOM des jeux (vérifié le 2026-11-08, Deux Tabliers)

- Le SDK lit le clavier en capture sur `window` et fait `preventDefault` sur toute touche liée à une action (Tab, Entrée, Espace, E, flèches...), sauf dans un champ de saisie: dans un panneau du jeu, ni Tab ni Entrée ni Espace n'agissent seuls. Le gestionnaire de panneaux fait tout lui-même (focus suivant, `click()` du bouton focalisé, navigation spatiale).
- L'attribut `hidden` perd contre une règle CSS `display: flex`: poser `[hidden] { display: none !important; }` dans la feuille du jeu.
- L'outil d'écriture de fichiers transforme les échappements d'espaces insécables (U+00A0) et fines (U+202F) écrits dans un source en caractères réels (ESLint: `no-irregular-whitespace`); les remettre en échappements par un script après coup.
- Un champ de texte focalisé par programme a son curseur au début: `setSelectionRange(fin, fin)` pour l'avoir à la fin.
- Panneau reconstruit à chaque changement du modèle: retrouver le focus par une clé (balise, nom, rang) et garder tel quel le champ en cours de saisie (`data-keep`), sinon la frappe se perd.
- Le faux hôte (`servir.ts`) sert `dist/` du jeu: reconstruire le jeu avant d'essayer; ports 8080 à 8100 souvent pris par d'autres sessions, prendre un port plus haut.

## Téléphone de Deux Tabliers (vérifié le 2026-11-08)

- Une touche lue à la fois par les calques (keydown) et par le SDK (`wasPressed`, vidé seulement à `endStep`): le Tab qui range le téléphone arrive aussi au pas suivant et le ressortirait. Parade: drapeau « rangé depuis le dernier pas » posé dans `onClose`, lu puis remis à zéro par `step`.
- Calque au-dessus du HUD mais fond sous le HUD: un enfant ne sort pas du contexte d'empilement de son parent `position: fixed`; le téléphone est ajouté à côté de son fond, pas dedans.
- `.x button:not(.a, .b)` pèse (0,2,1) et écrase `.puce[aria-pressed]`: mettre les remises à zéro des boutons sous `:where(...)`.
- Page d'aperçu sans SDK: Tab et Entrée relayés vers `ui.step` en capture, avec `stopImmediatePropagation` et un `setTimeout(0)` (le jeu lit ces touches au pas suivant), plus un `step` vide par image.
