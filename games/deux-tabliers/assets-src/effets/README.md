# Deux Tabliers: sources des effets du café fermé (démo v0.3)

Textures des effets de l'installation (`docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`, sections 3.4 et 5.6, assets A2 et A6), générées par script, sans photographie ni IA. Le rendu est dans `src/rendu/cafe-ferme.ts`.

| Script | Sortie (`assets/modeles/textures/`) | Contenu |
|---|---|---|
| `blanc_meudon.py` | `blanc_meudon.png`, 2048 x 1024, RGBA, 1,9 Mo | badigeon des quatre vitres: à gauche vu de la place, à droite vu de la salle (à contre-jour); alpha = ordre d'effacement à l'éponge (0 = verre nu: l'inscription « À LOUER / s'adresser au-dessus » de la vitrine ouest) |
| `feuilles_mortes.py` | `feuilles_mortes.png`, 512 x 256, RGBA, 100 Ko | huit feuilles de tilleul (l'arbre de la place) en découpe, une par case de 128 px |

## Régénérer

```
duo-python games/deux-tabliers/assets-src/effets/blanc_meudon.py      # 20 s
duo-python games/deux-tabliers/assets-src/effets/feuilles_mortes.py   # 2 s
```

Graines fixes: les fichiers se régénèrent à l'identique. Puis `pnpm --filter deux-tabliers test -- cafe-ferme` (tailles des atlas, cases sans chevauchement, vitres du plan).

## À garder en phase

- Les cases de l'atlas du badigeon (`VITRES` du script) et `PANE_CELLS` de `cafe-ferme.ts`: mêmes identifiants du plan, mêmes rectangles de pixels. Les cotes du verre, elles, sont relues dans `shell_village_glass` au chargement.
- Le seuil de découpe vaut 0,5 (programme du feuillage de la place, `dt_feuillage`): le script code l'ordre d'effacement de 0,03 à 0,99 et laisse 0 pour le verre nu.
- Les couleurs sont celles affichées (matériau sans lumière, pas de tonalité): les changer se juge sur capture, de la place et de la salle.

## Pourquoi ces choix

- L'inscription se lit de la place, donc à l'envers de la salle: Simone l'a écrite pour les passants.
- Elle est au milieu de la vitrine ouest, entre les petits bois, à hauteur de main (capitales de 24 cm, ligne de base à 1,36 m; seconde ligne à 1,17 m).
- Les traits du doigt ont dans l'atlas la couleur de ce qu'on voit au travers: de loin, quand les mipmaps mélangent l'alpha, l'inscription se lit encore.
- L'éponge efface par rangées de 30 cm, de haut en bas, en arcs, dans un sens puis dans l'autre: le geste de quelqu'un qui lave une vitrine.
- Les feuilles sont des feuilles de tilleul: elles viennent de l'arbre de la place, entrées sous le rideau de la porte; il n'y en a que près de la porte.
