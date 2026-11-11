# Musique

La musique ne joue pas en continu et ne se choisit pas dans le code: une **table de données** (`donnees/musique.json`) dit quel morceau, quelles couches, quel silence. Le moteur (`regie.ts`) ne nomme aucun morceau.

## Ce qu'il y a ici

| Fichier | Rôle |
| --- | --- |
| `donnees/musique.json` | `bands` (tranches horaires), `tracks` (morceaux et leurs tiges), `jingles`, `pacings` (rythme des silences), `rules` (contexte vers morceau), `modifiers` (couches), `jingleRules` (événement vers jingle), `arrivals` (thème d'arrivée par lieu), `timing`, `defaults` |
| `schemas.ts`, `table.ts` | schémas Valibot et références croisées (un morceau, un rythme, une tranche ou un jingle inconnu: l'erreur nomme le champ) |
| `choix.ts` | logique pure: `choose(table, contexte)` rend le morceau et les couches, `jingleForEvent` le jingle d'un événement |
| `rythme.ts` | `Pacer`: plage de jeu, silence voulu, retour |
| `regie.ts`, `index.ts` | Web Audio: tiges synchrones, fondu enchaîné, passe-bas, recul sous les jingles; `createGameMusic` |
| `reglages.ts` | le volume de la musique, séparé de ceux de `../reglages.ts` (clé de stockage propre) |

Fichiers sonores: `assets/commun/son/musique/` (OGG Opus). Partitions, rendu et contrôles: `assets-src/son/musique/` (`aubrune.py`, `generer.py`, `controler.py`, `verifier_ecriture.py`, `midi/`).

## Comment ça choisit

1. À chaque tick (0,5 s), la régie lit le contexte: lieu (`common.place`), zone du joueur (option `zoneAt`), heure de jeu, météo, saison (calendrier), phase (voyage), scène en cours, événements du calendrier.
2. `rules`: la première règle dont tous les champs `when` conviennent donne le morceau (`play`) et son rythme (`pacing`). Une liste convient si elle contient la valeur; un champ absent convient toujours. Cas précis d'abord, général ensuite. `play: null`: silence voulu, l'ambiance seule.
3. `modifiers`: toutes les couches dont les conditions conviennent s'appliquent ensemble: écart de niveau par rôle de tige (`air: -6`), écart général, passe-bas (le plus bas gagne). Pluie: plus feutré; nuit: l'air recule. Un morceau n'a pas besoin d'une variante par météo.
4. `Pacer`: après une plage de jeu (tirée dans `playSeconds`), la musique se fond vers le silence pendant `quietSeconds`, puis revient. `steady` (rythme `null`): jamais de silence (scènes, voyage).
5. Arrivée dans un lieu (y compris au début de la partie): le thème court de `arrivals` part, la musique attend `arrivalHoldSeconds`.
6. Événements: `jingleRules` (prise nouvelle, étape de quête, réveil, repas partagé...). La musique recule de `duckDb` pendant le jingle. L'autre joueur l'entend si la règle est `both`, `otherPlayerDb` plus bas.

Chaque morceau = deux tiges mono qui bouclent ensemble (`fond`: basse, accompagnement, rythme; `air`: mélodie, contrechant, éclats). Fichier: amorce de `preroll` s, boucle, amorce; lecture avec `loopStart` et `loopEnd` (jamais `<audio loop>`, qui marque le raccord). Décodage à la demande à `decodeRate` (24 kHz: environ 96 Ko par seconde et par tige); au plus `residentTracks` morceaux gardés en plus de celui qui joue.

## Recette: ajouter un morceau

1. Écris-le dans `assets-src/son/musique/aubrune.py` (une fonction qui rend un `Morceau` et ses tiges), ajoute-le à `MORCEAUX`. Un air de la collection du carnet va dans `airs.py` (liste `AIRS`) et porte l'identifiant de sa fiche (`air-marche-de-la-halte`): le carnet le retrouve par ce nom. Reste dans les notes de sol majeur (le test d'écriture le vérifie), durée entière en secondes.
2. `duo-python -I assets-src/son/musique/verifier_ecriture.py` (aucune faute), `duo-python -I assets-src/son/musique/generer.py --seulement <id>`, puis `controler.py` (-16 LUFS, crêtes sous -1 dBFS, raccord).
3. Dans `musique.json`: une entrée `tracks` (`seconds`, une entrée par tige avec `file`, `pan`, `volumeDb`) et une règle `rules` qui le choisit.
4. `pnpm test`: la table dit ce qui cloche. Aucune ligne de moteur.

## Recette: ajouter une règle, une couche, un jingle, un lieu

- **Règle** (une ligne de `rules`): `{ "id": "bourg-hiver", "when": { "seasons": ["winter"], "bands": ["matin"] }, "play": "bourg-aube", "pacing": "normal" }`, placée avant les règles plus générales.
- **Couche** (une ligne de `modifiers`): `{ "id": "brume", "when": { "weathers": ["mist"] }, "stemsDb": { "air": -4 }, "lowpassHz": 4000 }`.
- **Jingle**: fichier rendu (fonction de `JINGLES` dans `aubrune.py`), entrée de `jingles` (`volumeDb`, `duckDb`, `seconds` mesurés), ligne de `jingleRules` (`on`, `where`, `audience`).
- **Lieu**: ses règles dans `rules` (`places`), un thème d'arrivée dans `arrivals`, son identifiant dans le contenu (ou dans `plannedPlaces` tant que ses données n'existent pas). Un lieu sans règle n'a pas de musique, seulement son ambiance.
- **Zone** (rivière, voie, Côte...): l'hôte fournit `zoneAt(x, y)`; une règle les nomme dans `zones`.
- **Tranches, rythmes**: `bands` et `pacings`.

## Test « exemplaire factice »

`tests/musique.test.ts` ajoute aux seules données un morceau, un jingle, une règle et une règle de jingle, sur un contexte audio factice, et vérifie que la régie les joue sans changement de code.

## Branchement dans `main.ts` (à faire par le propriétaire du fichier)

```ts
import { createGameMusic } from './audio/musique';

const music = createGameMusic({
  audio: duo.audio,
  view: session.view,
  random: duo.random('musique'),
  warn: duo.log.warn,
  // zoneAt: (x, y) => zoneOf(x, y), // quand la carte d'Aubrune nommera ses zones
});
// dans render: music.frame(frame.dt);
// dans duo.on('stop'): music.dispose();
// réglage joueur: music.setSettings({ music: 0.5 }) / { muted: true }
```
