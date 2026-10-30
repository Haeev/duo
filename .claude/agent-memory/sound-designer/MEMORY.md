# Carnet du sound designer

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Repères de la plateforme (identité « Étoile double », `docs/plateforme/identite-sonore.md`)

- Ta voix: célesta de verre; la voix de l'autre: harpe de verre, panoramique +0,35 (toi -0,1). Interface en pentatonique de ré majeur, musique en ré lydien. Les jeux gardent leur propre palette.
- Paliers mesurés en sonie momentanée maximale (ebur128): discret -28 LUFS (focus), réponse -18 à -19, annonce -15 à -17; boucle du salon -21 LUFS intégrés; musiques des jeux -16 LUFS intégrés.
- Fichiers OGG nommés par l'identifiant anglais du code (`confirm-1.ogg`), copies M4A numérotées avec un nom français (`02-valider-1.m4a`); `sons.json` est généré, jamais écrit à la main.
- Tout se régénère par `duo-python design/son/plateforme/sources/generer.py`; la bibliothèque d'instruments (`synthese.py`) est réutilisable pour les jeux.

## Pièges vérifiés (2026-10-30)

- ffmpeg 6.1.1, `showspectrumpic`: les options `start`/`stop` (zoom) sont fausses: un sinus de 1 kHz y montre une raie fantôme vers 3 kHz et un plancher à -60 dB. Utiliser `fscale=log` sans zoom; calibrer avec un sinus avant de lire un spectrogramme.
- ffmpeg `ebur128`: avec `framelog=verbose`, les lignes par trame (M, S) passent au niveau verbeux et disparaissent du journal par défaut. Laisser `framelog` par défaut pour les analyser; ajouter `apad=pad_dur=1` pour que les sons courts soient mesurés jusqu'au bout.
- Boucle en Ogg Vorbis: sans amorce, Chromium (`decodeAudioData` dans un contexte à 44,1 kHz) décode un échantillon de moins, et le bruit de codage marque le raccord (centile 99,99 des sauts). Avec 1 s d'amorce de chaque côté (fin de la boucle avant, début après) et `loopStart`/`loopEnd` à 1 s et 1 s + durée, le décodage après le raccord est identique à la lecture continue (écart nul). Vérifié par `design/son/plateforme/sources/verifier-chromium.cjs`.
- Traitements à état sur une boucle (réverbération, filtres): les appliquer sur deux copies bout à bout et garder la seconde; replier la queue du rendu sur le début; toute modulation lente doit avoir une période qui divise la durée de la boucle.
- Deux sons tenus qui convergent vers la même hauteur finissent avec une phase relative fixe: tirée au hasard, elle peut les annuler en partie. Calculer la phase de départ (`phase_accordee` dans `synthese.py`) pour qu'ils finissent en phase.
- pedalboard `Reverb` rend un tampon de la longueur d'entrée: ajouter du silence avant, puis couper la queue sous un seuil.
- Une nappe sous des cloches domine vite le spectre et la sonie (et fait baisser les cloches à la normalisation): la garder 6 dB sous ce qui semble juste sur le papier.
- Sorties identiques à l'octet d'une génération à l'autre: graines fixes, et pour ffmpeg `-map_metadata -1 -fflags +bitexact -flags:a +bitexact`.
- `sys.dont_write_bytecode = True` en tête des scripts évite les `__pycache__` dans les dossiers versionnés (aucune entrée dans `.gitignore`).
- AAC natif de ffmpeg à 64 kbit/s: énergie de chaque octave à 1 dB de la source jusqu'à 12 kHz sur des sons de verre et une nappe; suffisant pour les copies d'écoute.
- Playwright pour vérifier un décodage: servir les fichiers par `page.route`, puis `new OfflineAudioContext(2, 1, frequence).decodeAudioData(...)` dans `page.evaluate`.
