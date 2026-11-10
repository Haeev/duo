# Essai de style 3: corps commun encré, tenues en textures

Essai du tech-artist (2026-11-10), style « bande dessinée encrée » de la bible 0.2. Rien n'est livré dans le jeu.
Planche: `comparaison.png`. Mesures et coûts: `mesures.json`. Tâches Meshy et crédits: `meshy/corps.meshy.json`.

## Chaîne

1. Corps commun (une fois par gabarit): Meshy, aperçu sans texture puis rig (24 os, `duo-24`).
2. `scripts/conformer_corps.py`: soudure, mains et pieds agrandis, 2 300 triangles, UV rangés dans les bandes
   de l'atlas (A tête et cheveux, B haut, C bas), seconde UV du visage, occlusion cuite, clips `marche` et `repos`.
3. `scripts/coiffure.py`: coque anguleuse posée par rayons sur le crâne de chaque corps, d'après une fiche.
4. `scripts/peindre.py`: atlas de 512 px d'un personnage (peau, tenue, cheveux) et atlas commun des traits.
5. `scripts/exporter_corps.py`, puis `scripts/scene.html` et `scripts/capturer.mjs` pour la planche.

Tout se reconstruit par `python3 scripts/construire.py` (70 s; `--corps <dossier des rigs>` pour reconformer).

## Ajouter du contenu

- Une tenue: copier `gabarits/tenues/carreaux-jean.toml`, changer `id`, cotes (relatives au corps) et couleurs
  (noms de `gabarits/nuancier-v02.json`), puis `python3 scripts/construire.py`.
- Un coloris: un bloc `[coloris]` dans la fiche du personnage (exemple: `gabarits/personnages/gaston.toml`).
- Une coiffure: copier `gabarits/coiffures/carre.toml`; elle est fabriquée pour chaque corps.
- Un personnage: copier `gabarits/personnages/maelle.toml` (corps, tenue, coiffure, peau, cheveux).
- Un corps: un rig Meshy dans `<dossier>/<gabarit>/marche.glb`, une ligne dans `CORPS` de `construire.py`.
