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
- L'exécutable principal d'Electron arm64 a le même UUID pour toutes les applications d'une version (45.2.0: `4c4c446b-5555-3144-a1a1-136b14fc37ac`); la commande `LC_UUID` se réécrit en quelques lignes de Node (Mach-O mince, `0xfeedfacf`, commande `0x1b`).

## electron-updater 6.8

- Fournisseur GitHub: lit `github.com/<propriétaire>/<dépôt>/releases/latest` en JSON (pas l'API), puis `latest.yml` sous ce tag. Dépend donc de la marque « Latest ».
- `NsisUpdater` ne vérifie aucune signature si `publisherName` est absent de `app-update.yml`. `MacUpdater` passe par Squirrel.Mac (signature exigée).
- Ancienne carte de blocs: adresse du nouveau fichier avec le numéro de version remplacé; des noms de fichiers sans version marchent car le tag en porte une.

## GitHub

- Une release devient « Latest » automatiquement (date et version) sauf `gh release create --latest=false`. `releases/latest/download/<fichier>` donne un lien direct stable.
- Releases immuables: plus aucun fichier modifiable après publication (les brouillons restent modifiables).
- `macos-latest` = macOS 26 arm64; `windows-latest` = Windows Server 2025 x64, pas Windows 11 (langue non documentée dans le README de l'image); `windows-11-arm` est arm64. Runners standard gratuits pour un dépôt public.
