# Lieu courant (lot L4)

Tout ce qui appartient au lieu affiché: `description.ts` traduit les données et l'état du lieu en volumes (logique pure), `formes.ts` fabrique les formes provisoires quand le modèle manque, `lieu.ts` construit la scène du lieu et la libère en entier au départ (un `ResourceTracker` par lieu, ADR 0018). Les modèles livrés arrivent par `ModelSource` (`lieu.ts`): le moteur ne connaît aucun nom de modèle.

## Grands lieux par tuiles (ADR 0022)

Une carte qui a un `terrain` (produite par `outils/plan-vers-lieu.ts`) est rendue par tuiles de 32 m; les meubles et objets posés passent toujours par `lieu.ts`.

| Fichier              | Rôle                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tuiles.ts`          | anneau autour du joueur local (`TileRing`): chargement à rayon de vue + 8 m, déchargement au-delà de + 32 m (logique pure)                                                                        |
| `terrain-rendu.ts`   | nature dessinée de chaque case, `surfaceAt(field, x, y)` pour le son des pas, décor semé par tuile, rails, volumes des bâtiments (logique pure, déterministe)                                     |
| `reglages-tuiles.ts` | couleurs par nature, densités, hauteurs, budgets (technique 3.10)                                                                                                                                 |
| `geometrie.ts`       | géométries fusionnées à couleurs de sommets; `FadingMesh`: un maillage fusionné dont une partie (un bâtiment) s'efface sans rien recréer                                                          |
| `tuile.ts`           | une tuile: sol (berges et rails compris), eau, boîtes, troncs, boules instanciés, murs, vitres, toits: 8 appels au plus                                                                           |
| `grand-lieu.ts`      | `TiledPlace`: anneau, construction étalée (4 ms par image, sauf tuile déjà vue), sol lointain simplifié, repères, occultation des murs, toits et houppiers, lueur des fenêtres la nuit, compteurs |

Le moteur expose `surfaceAt(x, y)` (`null` hors grand lieu), `stats().tiles` (compteurs par tuile et au total) et `setOverview(largeur)` (vue haute de contrôle).

Déductions provisoires, faute d'information dans la carte (à remplacer quand la carte la portera): les parcelles `champ` deviennent labour (1 000 cases et plus), pré, ou cour de terre battue (300 et moins); les rails suivent les arêtes `voie` et `interieur` du graphe; un repère est un grand arbre s'il est loin de tout aménagement, sinon une tour.

Page de démonstration: `pnpm exec vite --config src/rendu/lieu/demo/vite.config.ts`, puis `http://localhost:5174/src/rendu/lieu/demo/index.html` (Aubrune fabriquée dans la page depuis `plan.json`; touches et paramètres en tête de `demo/main.ts`; `window.tuiles.traverse(n)` pour le contrôle de fuite).
