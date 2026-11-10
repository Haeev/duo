# Rendu encré (ADR 0023)

Le style « bande dessinée encrée » du jeu. `index.ts` (`InkKit`) est ce que le moteur branche; rien ici ne lit les options graphiques (un seul niveau de rendu).

| Fichier                                  | Rôle                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `reglages.ts`                            | tout ce qui se règle: style par défaut, caméra, trait, ombres, sol, conversion, budgets   |
| `ambiances.json`, `ambiances.ts`         | ambiances en données (heures, dedans, météo), schéma et interpolation                     |
| `couches.ts`, `textures.ts`              | couches de traits (dessinées au démarrage), natures de face, codes de pièce et de morceau |
| `matiere.ts`                             | matériau partagé (`InkMaterial`), lumière encrée, contact, aplat, profondeur              |
| `contour.ts`                             | cible à deux sorties et passe de contour hiérarchisée, teinte, vignette                   |
| `ombres.ts`                              | cartes d'ombre du soleil et de la lampe, mise en route étalée des programmes              |
| `conversion.ts`                          | pose `aInk` sur une géométrie ou un modèle livré, sans rien nommer                        |
| `sol.ts`, `lumieres.ts`, `particules.ts` | carte du sol d'un lieu, lampes et fenêtres, particules de l'air                           |

Revenir à l'ancien rendu: `?rendu=aplats` dans l'adresse du jeu, ou `RenderOptions.style`.

## Ajouter une ambiance (aucun code)

1. Dans `donnees/lieux/<lieu>/climat.json`, la saison porte un identifiant `ambience` (par exemple `aubrune-automne`).
2. Dans `ambiances.json`, ajoute une fiche de ce nom sous `sheets`. Elle hérite de `defaut` (ou de `extends`).
3. N'écris que ce qui change, par heure repère (`aube`, `midi`, `apres-midi`, `crepuscule`, `nuit`), sous `dehors` et `dedans`. Couleurs en `#rrggbb` ou en trois nombres.
4. Note l'intention dans `pourquoi`.
5. `pnpm exec vitest run tests/rendu/encre.test.ts` contrôle le fichier (un exemplaire factice y est ajouté par le test).

Un lieu clos (wagon) donne en plus la teinte de ses lampes et du dehors dans son `lieu.json` (`ambience`).

## Ajouter un objet ou une lampe (aucun code)

- Un modèle livré dans `assets/commun/decors/` passe seul au matériau encré: ses morceaux d'un seul tenant deviennent des morceaux de contour, leur couche de traits vient de leur teinte (`INK_SETTINGS.models.rules`).
- Une famille de modèles qui éclaire s'inscrit dans `INK_SETTINGS.lampFamilies` (hauteur du foyer, rayon de la flaque, ombre ou non).

## Captures et mesures dans le vrai jeu

`pnpm exec vite build`, puis `pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts` (banc à deux vues, hors de la suite rapide). `LPL2_CAPTURES` choisit le dossier; `mesures.json` y relève appels, triangles, programmes et textures de chaque vue, et le contrôle de fuite compare les compteurs après un aller et retour en train.
