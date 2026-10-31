# Son de La Petite Ligne (`src/audio/`)

Branche les sons du sound designer (`assets/son/`, `sons.json`, `docs/jeux/jeu-1/son.md`) sur l'état et les événements du jeu. Point d'entrée: `createAudio` de `index.ts` (contrat `CreateAudio` de `etat/vue.ts`), appelé par `main.ts`.

## Fichiers

| Fichier | Rôle | Web Audio |
|---|---|---|
| `index.ts` | point d'entrée: lit `sons.json`, crée le cerveau et le moteur, pause de la plateforme, diagnostic `stats()` (et `window.lplAudio` en développement) | oui |
| `catalogue.ts` | contrôle de `sons.json` (Valibot) et conversion: sons, musiques, boucles, séquences, règles des ambiances | non |
| `reglages.ts` | réglages typés hors de `sons.json`: cadence des pas et du marteau, délais, poules, train, zones, mémoire (128 Mo) | non |
| `cerveau.ts` | à chaque image, décide ce qui sonne: sons ponctuels, boucles, musique, ambiances, séquences | non |
| `declencheurs.ts` | événements de la simulation vers les sons; ce qui se lit dans l'état (pas selon le sol, marteau, scie, réchaud, poutre, menus, outil, clic, notifications, commande, poules) | non |
| `musique.ts` | musique selon le moment, repos après une boucle, passage matin et après-midi à la même position | non |
| `ambiances.ts` | ambiances par heure, pluie, intérieur; sources de la rivière | non |
| `train.ts` | horloge des séquences d'arrivée et de départ, calée sur la simulation; position de la locomotive | non |
| `sequences.ts` | lecture des pas de `plan.sequences` | non |
| `voix.ts` | file des voix: 24 au plus, priorités 4 puis 3 coupées d'abord, jamais 1; `minIntervalMs`, `maxVoices` | non |
| `memoire.ts` | sons décodés sous plafond, libération des moins récemment servis, sons tenus pendant leur lecture | non |
| `variantes.ts` | tirage sans répétition immédiate, hauteur et niveau, aléa à graine | non |
| `espace.ts` | gain de distance (modèle de `sons.json`, plancher `minGainDb`), oreille | non |
| `moteur.ts` | graphe Web Audio sur les bus du SDK, limiteurs, atténuation de la musique, voix, boucles, pistes, ambiances, passe-bas de l'intérieur | oui |
| `banc/` | banc de développement: le vrai moteur dans un `OfflineAudioContext`, piloté par la simulation et le robot | oui |

## Régler

- Niveaux, variations, priorités, boucles, séquences: dans les sources du sound designer (`assets-src/son/generer.py`), jamais à la main dans `sons.json`.
- Le reste: `reglages.ts` (une valeur par ligne, commentée).

## Vérifier

- `pnpm --filter @duo/la-petite-ligne test`: tests de la logique (`*.test.ts` de ce dossier), dont `cerveau.test.ts` qui fait jouer toute la démo au robot et contrôle le plan de lecture.
- Banc: lancer Vite (`pnpm --filter @duo/la-petite-ligne dev`), ouvrir `/src/audio/banc/index.html`, puis dans la console `await lplAudioBanc.run('arrivee', false)` (scénarios: `arrivee`, `depart`, `matin`, `nuit`, `pluie`, `interieur`, `boucle`). Le résultat donne les sons joués, les niveaux de chaque bus par 50 ms, la mémoire et le temps de calcul par image.
- En jeu (développement): `window.lplAudio.stats()` dans la vue du jeu.
