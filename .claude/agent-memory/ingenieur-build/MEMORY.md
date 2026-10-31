# Carnet d'ingenieur-build

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Sources depuis l'environnement cloud (vérifié le 2026-10-30)

- Refusés par la politique réseau: support.microsoft.com, learn.microsoft.com, support.apple.com, docs.github.com. Accessibles: raw.githubusercontent.com (sources de la documentation GitHub dans `github/docs`, README de `actions/runner-images`, docs d'Electron au tag de la version), developer.apple.com (notes techniques en ajoutant `.md` à l'adresse), npm, fichiers de release GitHub.
- Les libellés français de Windows 11 et de macOS ne se vérifient pas d'ici: les signaler comme non vérifiés.
- Pour lire un paquet sans l'exécuter: `npm install --ignore-scripts` dans le dossier jetable, puis lire `scheme.json` et `out/` (electron-builder) ou `out/` (electron-updater).

## electron-builder 26.18 et Electron 45

- `mac.identity: "-"` pour l'ad hoc (sans identité: aucune signature); `hardenedRuntime` vaut `true` par défaut et casse le lancement en ad hoc sans l'entitlement `disable-library-validation`: mettre `false`.
- Ordre: `afterPack`, puis fusibles, puis signature. Un crochet `afterPack` peut modifier l'exécutable avant signature.
- NSIS en un clic par utilisateur: dossier `%LOCALAPPDATA%\Programs\<name nettoyé>` (`@duo/app` donnerait `@duoapp`), chemin relu dans `HKCU`; GUID dérivé de `appId`. Par machine: `RequestExecutionLevel admin`.
- NSIS sous Linux exige Wine (le désinstallateur est produit en exécutant l'installateur): fabriquer sur `windows-latest`. Une cible `dir` Linux se fabrique en une vingtaine de secondes dans l'environnement cloud (Electron téléchargé depuis GitHub).
- electron-builder embarque `@electron/fuses` 1.8 (8 fusibles); Electron 45 en a 9 (`wasmTrapHandlers` en plus). `@electron/fuses` 2.1.3 les connaît tous (ESM, Node 22.12 ou plus).
- Lire les fusibles: chercher la sentinelle `dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX`, puis un octet de version, un octet de longueur et autant de caractères `0`, `1` ou `r`. Sous macOS, le câblage est dans le binaire du cadre Electron.
- Fusible `nodeCliInspect` coupé: Playwright `_electron` ne peut plus piloter l'application (il passe `--inspect=0` et attend « Debugger listening »). Tester l'application non empaquetée, et l'empaquetée par un test de lancement sans Playwright.
- `latest.yml` et `latest-mac.yml` sont écrits dès qu'une configuration `publish` existe, même avec `--publish never`.
- L'exécutable principal d'Electron arm64 a le même UUID pour toutes les applications d'une version (45.2.0: `4c4c446b-5555-3144-a1a1-136b14fc37ac`); la commande `LC_UUID` se réécrit en quelques lignes de Node (Mach-O mince, `0xfeedfacf`, commande `0x1b`). `llvm-dwarfdump --uuid` (présent dans l'environnement cloud) la relit, même sortie que `dwarfdump` d'Apple.
- La découverte automatique ne cherche que `electron-builder.{yml,yaml,json,json5,toml,js,cjs,ts}`: un `electron-builder.config.mjs` exige `--config`. Le `.mjs` est chargé par `require()` (Node 22.12 et plus), puis `import()` d'une URL `file://`: chemins Windows sans souci. Dans un `.mjs`, `afterPack` peut être la fonction importée.
- Sous Linux, `--mac dir --arm64` et `--win dir --x64` se fabriquent (sans signature, sans dmg ni NSIS): crochet `afterPack`, fusibles, `Info.plist`, ressources de l'exécutable et `ELECTRONASAR` s'y vérifient. Archives d'Electron téléchargées depuis GitHub, empreintes conformes aux SHASUMS256 officiels.
- NSIS: sans `installerLanguages`, ou avec `multiLanguageInstaller: false`, l'installateur est en anglais; `installerLanguages: ['fr_FR']` le met en français seul. `/S` n'ouvre pas l'application (seul `--force-run` le fait).
- Sans `author` dans le package.json, `CompanyName` de l'exécutable Windows reste « GitHub, Inc. » (celui d'Electron): `extraMetadata.author.name` dans la configuration le remplace.
- `extraResources` sont copiés en parallèle (`Promise.all`): ne jamais écrire deux fois le même fichier (exclure du dossier ce qu'une autre entrée copie). Une source absente ne fait qu'un avertissement: contrôler soi-même.
- `electronLanguages: ['fr', 'en']` garde `fr`, `en-US`, `en-GB` (et `fr.lproj`, `en.lproj` sous macOS). Electron fixe déjà `NSRequiresAquaSystemAppearance` à `false`.
- `publish: null` dans la configuration: aucun `latest.yml` ni `app-update.yml`; garder `--publish never` contre la publication implicite sur tag ou en CI.

## electron-updater 6.8

- Fournisseur GitHub: lit `github.com/<propriétaire>/<dépôt>/releases/latest` en JSON (pas l'API), puis `latest.yml` sous ce tag. Dépend donc de la marque « Latest ».
- `NsisUpdater` ne vérifie aucune signature si `publisherName` est absent de `app-update.yml`. `MacUpdater` passe par Squirrel.Mac (signature exigée).
- Ancienne carte de blocs: adresse du nouveau fichier avec le numéro de version remplacé; des noms de fichiers sans version marchent car le tag en porte une.

## GitHub

- Une release devient « Latest » automatiquement (date et version) sauf `gh release create --latest=false`. `releases/latest/download/<fichier>` donne un lien direct stable.
- Releases immuables: plus aucun fichier modifiable après publication (les brouillons restent modifiables).
- `macos-latest` = macOS 26 arm64; `windows-latest` = Windows Server 2025 x64, pas Windows 11 (langue non documentée dans le README de l'image); `windows-11-arm` est arm64. Runners standard gratuits pour un dépôt public.

## pnpm 12 et corepack (vérifié le 2026-10-30)

- pnpm 12 est un binaire natif (Rust): le paquet npm `pnpm` porte `bin/pnpm.mjs` et récupère le binaire `@pnpm/exe.<os>-<arch>` au premier lancement.
- corepack 0.34.x (Node 22.22.0 de l'environnement cloud) cherche `bin/pnpm.cjs`: `MODULE_NOT_FOUND` avec pnpm 12. corepack 0.36.0 (livré avec Node 22.23.4) sait le lancer: d'où `.nvmrc` à 22.23.4 et `corepack enable` en CI. Dans l'environnement cloud, ne pas activer corepack: le pnpm 10.28 global lit `packageManager` et bascule seul sur 12.16.1.
- pnpm 11 et plus: réglages dans `pnpm-workspace.yaml` (`.npmrc` ne sert plus qu'à l'authentification et au registre); `allowBuilds` remplace `onlyBuiltDependencies`; pnpm 12 refuse une clé inconnue (`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`).
- Délai de publication par défaut d'un jour: une version plus jeune est admise, et pnpm l'inscrit tout seul dans `minimumReleaseAgeExclude` de `pnpm-workspace.yaml`.
- `catalog:` fonctionne aussi dans `peerDependencies`. `pnpm --recursive` n'inclut pas la racine: la racine peut orchestrer sans boucle.
- `strictDepBuilds` vaut `true`: un script d'installation non tranché dans `allowBuilds` fait échouer `pnpm install` (`ERR_PNPM_IGNORED_BUILDS`). electron-builder 26 amène `electron-winstaller` (Squirrel): `allowBuilds: { electron-winstaller: false }`. Electron 45 n'a plus de script d'installation (binaire téléchargé à la demande). Une entrée pour un paquet absent du graphe est acceptée.
- `pnpm --filter <paquet>... run build` construit le paquet et ses dépendances dans l'ordre, en sautant ceux sans script.

## Outillage du dépôt

- Outil d'écriture de fichiers: un échappement Unicode (barre oblique inverse, `u`, puis les quatre chiffres hexadécimaux) écrit dans le contenu devient le caractère réel. Pour les tirets interdits, écrire `String.fromCharCode(0x2014)`; `\0` et `\\` restent intacts. Relancer le grep de CLAUDE.md après chaque écriture.
- TypeScript écarte `x.js` du programme quand `x.d.ts` est à côté: lint typé en échec (« not found by the project service »). Ranger les déclarations dans `types/`.
- `explicit-module-boundary-types` ne lit pas le JSDoc: la couper pour les fichiers JavaScript vérifiés par `checkJs`.
- ESLint 10 cherche la configuration depuis le dossier de chaque fichier: un `eslint.config.js` par paquet.
- Vitest 5: `vite` est une dépendance pair obligatoire; `vitest run` sans aucun fichier de test sort en code 1.
- Actions (relevé sur raw.githubusercontent.com): `actions/checkout@v7`, `actions/setup-node@v7` (cache pnpm seulement si pnpm est déjà installé), `actions/cache@v6`, `pnpm/action-setup@v6`; toutes en `node24`. actionlint 1.7.12 et shellcheck 0.11.0 se téléchargent depuis leurs releases GitHub (empreintes publiées).
- Simuler la CI: Node de `.nvmrc` depuis nodejs.org (SHASUMS256), `corepack enable` dans son dossier, copie propre du dépôt, `pnpm install --frozen-lockfile`.
- `actions/upload-artifact@v7` (option `archive: false` pour un fichier seul) et `actions/download-artifact@v8` (`pattern`, `merge-multiple`). actionlint connaît leurs entrées et passe les scripts bash à shellcheck avec `-shellcheck <binaire>`.
- Expressions GitHub: sur un push, `inputs.x` vaut `null`, et `null != false` est faux (les deux deviennent 0). Écrire `github.event_name != 'workflow_dispatch' || inputs.x`.
- Logique bash d'un workflow: l'extraire du YAML (PyYAML est installé) et la jouer avec un faux `gh` qui journalise ses arguments.
- typescript-eslint strict sur du JavaScript vérifié: un `import()` dynamique est `any`, le typer `unknown` puis valider; une variable `let` affectée dans un rappel reste vue `null` (la ranger dans un objet).
- Copie isolée (worktree): elle peut partir d'un vieux commit; avancer d'abord sa branche (`git merge --ff-only`) sur la pointe de la branche de session. Le garde-fou de l'isolation refuse les commandes trop composées ou qui citent `.git`: les découper, écrire les scripts avec l'outil d'écriture.
