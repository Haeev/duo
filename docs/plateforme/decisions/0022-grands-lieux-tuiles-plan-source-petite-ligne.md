# ADR 0022: Grands lieux de La Petite Ligne: une grille, des tuiles de rendu, le plan comme source

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | level-designer (plan, outil), dev-gameplay-3d (simulation, rendu), dev-reseau (tranche « lieu »), tech-artist (budgets par tuile), qa-testeur |
| Jeu | `games/la-petite-ligne-2`; plan: `docs/jeux/jeu-1/refonte/carte-aubrune/plan.md` (section 9) et `plan.json`; `docs/jeux/jeu-1/refonte/technique.md` (3.2, 3.10) |
| Liens | complète l'ADR 0018 (un seul lieu actif, budget de 128 x 128 m levé ici), 0019 (tranches), 0016 (intérieurs sur la carte) |

## Contexte

Le client veut des lieux plus grands pour l'exploration. Le plan d'Aubrune du level designer fait 320 x 208 m (66 560 cases, dont 56 571 jouables), avec 115 nœuds de chemins, 135 arêtes, 28 bâtiments, 66 points d'intérêt, 8 repères, 12 verrous d'histoire et une douzaine d'intérieurs: 4,1 fois le budget de 128 x 128 m de l'ADR 0018. Hautefonte et Combe-Veilleuse seront du même ordre. Le plan encourage les deux joueurs à se séparer (l'un à la ferme, l'autre au bois). La règle « le plan avant le volume » veut que la 3D découle du plan, jamais l'inverse. La machine de référence (UHD 620) ne change pas: le coût du rendu doit suivre la vue, pas la surface (constat de l'ADR 0016).

## Options

| | A. Une grille, rendu par tuiles | B. Quatre lieux coupés aux verrous | C. Sous-lieux chargés à la volée, chacun sa grille |
|---|---|---|---|
| Simulation | une grille de 320 x 256 (82 Ko), habitants routés sur le graphe du plan | inchangée (lieux de 128 m) | une simulation par sous-lieu, transferts d'habitants aux coutures |
| Deux joueurs éloignés | naturel: l'hôte simule tout, chacun charge ses tuiles | casse « un seul lieu actif » dès qu'ils se séparent, ou les oblige à passer ensemble | deux sous-lieux actifs: retour au problème de B |
| Ressenti | continu: on voit le pigeonnier depuis le ponton | fondu de 1 à 2 s à chaque couture; les vues lointaines deviennent du décor peint | idem B aux coutures |
| Réseau | l'état dépend du nombre d'objets, pas de la surface | inchangé | deux tranches de lieu |
| Code nouveau | tuiles au rendu, routage sur graphe, outil du plan | voyage local, coutures | tout ce qui précède, plus les transferts |

## Décision

**Option A.**

1. **Une seule grille logique par lieu**, de 1 m, jusqu'à 512 m de côté (`MAP_MAX_SIDE`). L'hôte simule tout le lieu; le réseau et la sauvegarde ne connaissent pas les tuiles.
2. **Tuiles de rendu de 32 m** (`TILE_SIZE`): chaque machine tient chargées les tuiles qui touchent le disque de 32 m autour de **son** joueur local (`tilesAround`: 9 au plus), avec une marge de déchargement. Aubrune: 10 x 8 tuiles, dont 10 x 6,5 pour le dehors.
3. **Intérieurs sur la même grille** (ADR 0016 prolongé): un intérieur est un fichier `lieux/<lieu>/interieurs/<id>.json` (`InteriorSchema`, 64 m de côté au plus) posé à `at`, dans une **annexe** sous le dehors (`outdoor`). Le chargement le fusionne à la carte et l'entoure d'un mur (`withInteriors`): le moteur ne voit qu'une grille. On y entre par une **paire de portes** (`doors`, chacune nomme l'autre): entrer dans la case d'une porte mène à l'autre. Aucun champ d'état nouveau: la position dit où l'on est.
4. **Le plan est la source.** `outils/plan-vers-lieu.ts` lit `plan.json` et écrit `carte.json`: collisions (`blocked`, rectangles fusionnés), terrain d'affichage en plages (`terrain`), zones et actes, verrous, graphe des chemins, repères, points d'intérêt, bâtiments, dehors et annexe. Ce fichier ne se retouche jamais à la main: on corrige le plan et on relance. Meubles et décor (`objects`) s'ajoutent ensuite par les gabarits; le blockout 3D se génère depuis la même carte.
5. **Verrous d'histoire sans état propre**: un verrou (`locks`) a ses rectangles, son obstacle visible (`object`) et ses conditions d'ouverture (`opens`, d'ordinaire le fait `<lieu>.verrou.<id>`). Fermé, il bloque; son état se déduit de la progression, il ne pèse rien sur le réseau ni dans la sauvegarde. L'outil pose une **lisière** (une case pleine, à habiller en haie, talus ou clôture) partout où deux actes se touchent, et place chaque verrou là où son chemin franchit cette limite, du côté fermé: on n'entre dans une zone fermée que par un verrou. Il le vérifie par remplissage depuis le quai (fuites, nœuds coupés, premier acte coupé).
6. **Habitants sur le graphe**: trajet long calculé sur le graphe du plan (arêtes à verrou fermé exclues), A* sur la grille seulement entre deux nœuds proches, dans une fenêtre de 64 m. Habitants à plus de 40 m des deux joueurs: simulés tous les 10 pas (3 fois par seconde), le long du graphe, sans A* ni collision. Budget du pas de l'hôte inchangé: 2 ms au pire.
7. **Réseau**: pas de tri par distance. Le canal rapide garde ses 32 mobiles (1 968 octets au pire, coordonnées d'Aubrune). La tranche « lieu » d'Aubrune au pire pèse **59 429 octets** (400 meubles à briques dont 10 coffres pleins, 200 meubles posés, 80 objets au sol, 32 habitants): elle déborde. L'état des meubles (`place.objects`, 38 912 octets au pire, borne `PLACE_OBJECTS_STATE_BYTES` de 64 Kio) part donc **par différences et par morceaux** sur le canal fiable 5, avec le mécanisme déjà éprouvé pour la progression; le reste de la tranche (20 506 octets) garde son canal 6 et son budget de 32 Kio. Plafond de contenu contrôlé au chargement: 400 meubles à briques par lieu (`PLACE_BRICK_OBJECTS_MAX`).
8. **Budgets de rendu par tuile** (`technique.md` 3.10): décor et terrain 50 000 triangles et 12 appels de dessin par passe pour une tuile; le budget de la vue (350 000 triangles, 200 appels) ne change pas, car la vue la plus large (28 m) couvre 4 tuiles au plus. Décor instancié par tuile; pas de niveau de détail sur le décor courant (caméra orthographique, rien n'est loin), un seul pour les repères, toujours affichés.

## Conséquences

- La carte d'Aubrune sort du plan en 0,2 s (47 Ko de JSON, 185 rectangles pleins, 3 063 plages de terrain), sans fuite vers une zone fermée; un test court le garde (`tests/grands-lieux.test.ts`). Le format des petits lieux écrits à la main ne change pas (champs nouveaux facultatifs).
- Les deux joueurs peuvent être aux deux bouts du lieu: chaque rendu suit son joueur; la simulation, le réseau et la sauvegarde sont ceux d'un seul lieu.
- Le code des lots change à trois endroits, décrits comme missions dans `technique.md` 3.2: rendu par tuiles (lot rendu), verrous, portes et habitants sur le graphe (lot simulation), meubles par morceaux (lot réseau). Plus la génération du blockout depuis la carte (level designer et tech-artist).
- Une lisière générée est un mur: le blockout doit l'habiller en obstacle lisible (haie, talus, clôture, berge), sinon c'est un mur invisible, interdit par le plan.
- Les verrous internes à une zone (V2b, les frênes de la tranchée) ne tiennent que si le plan dessine les talus qui empêchent de les contourner: à ajouter au plan (le remplissage ne le voit pas, la zone étant du même acte).

## À vérifier

- Temps de construction d'une tuile sur le PC de référence (cible: 4 ms par image, étalées) et mémoire des 9 tuiles chargées: à mesurer par le lot rendu sur la carte d'Aubrune.
- Coût réel du pas de l'hôte avec 32 habitants dont la moitié hors champ: banc du lot simulation.
- Le nœud `vn` (la vanne) tombe sur l'eau: à reprendre dans le plan par le level designer.
