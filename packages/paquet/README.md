# @duo/paquet

Paquets de jeux `.duogame` (ADR 0010): création, vérification, extraction, catalogue. Node seul, sans Electron. Les sources TypeScript (imports en `.ts`, syntaxe effaçable) tournent telles quelles sous Node 22 (outil de la CI) et sont regroupées par electron-vite dans le processus principal de Duo. Dépendances: yazl et yauzl (MIT), valibot (MIT).

## Paquet `<id>-<version>.duogame`

Archive zip reproductible (yazl, date DOS figée au 2000-01-01, droits `0644`, ordre des entrées par point de code). Elle contient, toutes à la racine ou sous elle:

| Entrée | Contenu |
|---|---|
| `duo-files.json` | `{ "schema": 1, "id", "version", "files": [{ "path", "size", "sha256" }] }`: chaque fichier du paquet, manifeste compris, empreinte SHA-256 en hexadécimal minuscule |
| `duo-files.sig` | `{ "schema": 1, "keyId", "signature" }`: signature Ed25519 (base64, 64 octets) des octets exacts de `duo-files.json` |
| `duo-game.json` | manifeste du jeu (ADR 0005) |
| le reste | site construit du jeu (`dist/`), sans les cartes des sources `*.map` |

Vérification (`verifyPackage`), identique pour un téléchargement, une copie par le réseau local et un import: archive au plus 204 Mo, noms d'entrée valides pour yauzl (`strictFileNames`) et écrivables sous macOS et Windows (`isSafePackagePath`: ni `..`, ni `\`, ni nom réservé de Windows, ni doublon à la casse près), signature par une clé de confiance, liste valide, aucune entrée de trop ni manquante, taille totale extraite au plus 200 Mo, manifeste valide et cohérent avec la liste signée (identifiant, version, page d'entrée), puis empreinte de chaque fichier. Avec `extractTo`, chaque fichier est écrit pendant son contrôle; le dossier n'est utilisable que si le résultat est `ok`.

## Outil de la CI

```sh
DUO_CLE_PAQUETS="<PEM PKCS8 Ed25519>" DUO_CLE_PAQUETS_ID=duo-2026 \
  node outils/paquet-jeu.mjs games/<id> --sortie <dossier>
```

Le dossier donné est le paquet du jeu: manifeste `duo-game.json` dans `dist/` s'il y est, sinon à la racine du paquet; site construit dans `dist/`. Un dossier sans `dist/` est pris comme site lui-même. Sortie standard, une ligne JSON:

```json
{"id":"la-petite-ligne","version":"0.2.0","fichier":"/chemin/absolu/la-petite-ligne-0.2.0.duogame","taille":12345678,"sha256":"<64 hex>","manifeste":{"nom":"La Petite Ligne","description":"...","mode":"coop","duree":[30,75],"sdk":"1.0"}}
```

Erreur: message en français sur la sortie d'erreur, code de sortie 1. Clé de test: `cle-test/` (voir son README).

## Catalogue, schéma 1

Lu par Duo à `https://github.com/Haeev/duo/releases/download/catalogue/catalogue.json` (release au tag fixe `catalogue`, `--latest=false`). Pour chaque jeu, la dernière version publiée. Les champs de `manifeste` et `taille`, `sha256` reprennent la ligne JSON de l'outil; `url` est l'adresse directe du paquet dans la release `jeu-<id>-v<version>`.

```json
{
  "schema": 1,
  "jeux": [
    {
      "id": "la-petite-ligne",
      "version": "0.2.0",
      "manifeste": {
        "nom": "La Petite Ligne",
        "description": "Six semaines à deux à la Halte d'Aubrune...",
        "mode": "coop",
        "duree": [30, 75],
        "sdk": "1.0"
      },
      "taille": 12345678,
      "url": "https://github.com/Haeev/duo/releases/download/jeu-la-petite-ligne-v0.2.0/la-petite-ligne-0.2.0.duogame",
      "sha256": "<64 caractères hexadécimaux minuscules>"
    }
  ]
}
```

| Champ | Règle |
|---|---|
| `schema` | entier; autre que 1: catalogue écarté en entier (ADR 0006) |
| `jeux` | tableau, 1000 entrées au plus |
| `id` | `^[a-z][a-z0-9-]{1,31}$` |
| `version` | `MAJEUR.MINEUR.CORRECTIF` |
| `manifeste.nom` | 1 à 40 caractères |
| `manifeste.description` | 1 à 200 caractères |
| `manifeste.mode` | `coop` ou `versus` |
| `manifeste.duree` | `[min, max]` en minutes, entiers de 1 à 600, `min <= max` |
| `manifeste.sdk` | version du pont `majeure.mineure` |
| `taille` | octets de l'archive, entier positif |
| `url` | adresse `https://` (une version de test admet aussi `http://127.0.0.1`) |
| `sha256` | empreinte de l'archive, 64 caractères hexadécimaux minuscules |

Un texte qui n'est pas du JSON, ou une enveloppe invalide, écarte le catalogue entier. Une entrée invalide est ignorée sans écarter les autres; les champs inconnus sont ignorés (ajouts compatibles). Pour un même `id`, la version la plus récente l'emporte. Le catalogue n'est pas signé: Duo contrôle la taille et l'empreinte de l'archive, puis la signature du paquet, et vérifie que l'identifiant et la version du paquet sont ceux de l'entrée.
