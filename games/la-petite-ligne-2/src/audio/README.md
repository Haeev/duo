# Son (lot L9)

Un son du monde naît d'un événement de l'hôte ou de l'état, jamais d'une entrée locale: les deux joueurs l'entendent (retours R03, R18, R19 du 4 novembre). Le moteur ne nomme aucun son: il lit des tables de données et joue ce qu'elles décident.

## Ce qu'il y a ici

| Fichier                                                                                 | Rôle                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `donnees/sons.json`                                                                     | un son par entrée: fichiers (variantes), catégorie, volume (dB), variation de hauteur et de niveau, priorité, voix simultanées, délai minimal          |
| `donnees/evenements.json`                                                               | `rules`: événement de la simulation vers son (premier gabarit qui convient), `cues`: signaux de l'interface vers son, `aim`: son de la cible visée     |
| `donnees/voix.json`                                                                     | `timbres` (fichier et note enregistrée), `voices` (une voix: timbre, hauteur de base, gamme, étendue, débit, longueur des voyelles), ponctuation       |
| `donnees/ambiances.json`                                                                | couches de jour, de nuit et de voyage, heures de l'aube et du soir, durée du fondu                                                                     |
| `donnees/reglages.json`                                                                 | écoute placée (distances, panoramique, autre joueur), pas (foulée, surfaces), plafond de voix, volumes par défaut                                      |
| `schemas.ts`, `table.ts`                                                                | schémas Valibot et contrôle croisé (un son nommé qui n'existe pas, un timbre trop loin de sa note, un fichier absent: l'erreur nomme fichier et champ) |
| `regles.ts`, `babil.ts`, `pas.ts`, `ambiance.ts`, `espace.ts`, `reglages.ts`, `pool.ts` | logique pure, testée dans Node                                                                                                                         |
| `moteur.ts`, `index.ts`, `fichiers.ts`                                                  | Web Audio: graphe, lecture, boucles; `createGameAudio`                                                                                                 |

Fichiers sonores: `assets/commun/son/{effets,babil,ambiances}/`. Sources et script de génération: `assets-src/son/` (`generer.py`, `controler.py`, mesures dans `mesures.csv`).

La **musique** (airs par heure, météo et lieu, silences, jingles) a son propre dossier et sa propre table: `musique/README.md`.

## Ce que le joueur entend, et d'où ça vient

- **Gestes, objets, argent, besoins, train, réveil**: les événements de `GameView.onEvent`, par `evenements.json`. `audience: "own"` garde un retour privé pour son joueur; `"both"` joue chez les deux, et le geste de l'autre joueur est placé à sa position et 3 dB plus bas (`otherPlayerDb`).
- **Pas**: image par image, un pas toutes les `strideMeters` parcourues par chaque personnage, par `StepTracker`; la surface vient de `surfaceAt(x, y)` (option de `createGameAudio`), sinon `steps.default`.
- **Cible visée**: `view.aim(local)` change de cible, le son `aim` part tout de suite.
- **Babil**: `engine.onBabble` à brancher sur `onBabble` de l'interface; la voix vient du champ `voice` de la fiche de l'habitant, qui nomme une entrée de `voix.json`.
- **Ambiances**: jour et nuit fondus selon `world.minutes`, couche de trajet pendant la phase `travel`.
- **Interface sans événement** (ouvrir le carnet, choisir, fermer un rangement, poser): `engine.cue('carnet-ouvre')`, sons de `cues`.
- **Réglages du joueur**: `engine.setSettings({ master, effects, interface, babble, ambience, muted })`, enregistrés dans `localStorage`. Le volume de la plateforme s'applique par-dessus (bus du SDK: effets, interface).

## Recette: ajouter un son

1. Génère ou dépose `assets/commun/son/effets/<nom>.ogg` (OGG, mono, 48 kHz; effets calés à -16 LUFS momentanés, boucles à -16 LUFS intégrés, crête sous -1 dBFS). Pour en fabriquer un: ajoute une fonction dans `assets-src/son/generer.py`, puis `duo-python assets-src/son/generer.py --seulement <nom>` et `duo-python assets-src/son/controler.py`.
2. Ajoute une entrée à `donnees/sons.json` (copie d'une voisine).
3. S'il répond à un événement de la simulation, ajoute une ligne à `rules` de `donnees/evenements.json` (cas précis avant cas général); s'il répond à l'interface, une ligne à `cues`.
4. `pnpm test`: le test des tables dit ce qui cloche. Aucune ligne de moteur.

## Recette: ajouter une voix de personnage

1. Un timbre nouveau: rends-le dans `generer.py` (`TIMBRES`: programme General MIDI et note) et inscris-le dans `timbres` de `voix.json` avec sa note.
2. Une entrée dans `voices` (timbre, tonique, gamme, étendue, débit); garde la voix à moins d'une octave de la note du timbre.
3. Mets son identifiant dans le champ `voice` de la fiche de l'habitant. Le test de données vérifie que toute voix nommée existe.

## Test « exemplaire factice »

`tests/audio.test.ts` ajoute un son et une règle d'événement aux seules tables, sur un contexte audio factice, et vérifie que le moteur le joue sans changement de code.
