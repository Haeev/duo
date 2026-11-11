# Rendu encré (ADR 0023)

Le style « bande dessinée encrée » du jeu. `index.ts` (`InkKit`) est ce que le moteur branche; rien ici ne lit les options graphiques (un seul niveau de rendu).

| Fichier                                  | Rôle                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `reglages.ts`                            | tout ce qui se règle: style par défaut, caméra, trait, ombres, sol, conversion, budgets   |
| `ambiances.json`, `ambiances.ts`         | ambiances en données (heures, dedans, météo), schéma et interpolation                     |
| `couches.ts`, `textures.ts`              | couches de traits (dessinées au démarrage), natures de face, codes de pièce et de morceau |
| `matiere.ts`                             | matériau partagé (`InkMaterial`), lumière encrée, contact, aplat, profondeur              |
| `contour.ts`                             | cible à deux sorties et passe de contour hiérarchisée, teinte, vignette, mise à l'échelle |
| `echelle.ts`                             | résolution interne adaptative (paliers, hystérésis), logique pure                         |
| `mesure.ts`, `panneau-mesure.ts`         | outil de mesure: journal des images, relevé en texte, panneau, chronomètres               |
| `ombres.ts`                              | cartes d'ombre du soleil et de la lampe, mise en route étalée des programmes              |
| `conversion.ts`                          | pose `aInk` sur une géométrie ou un modèle livré, sans rien nommer                        |
| `sol.ts`, `lumieres.ts`, `particules.ts` | carte du sol d'un lieu et ses limites adoucies, lampes et fenêtres, particules de l'air   |

Revenir à l'ancien rendu: `?rendu=aplats` dans l'adresse du jeu, ou `RenderOptions.style`.

## Occultation: la découpe autour des joueurs

Un bâtiment livré, un repère ou un houppier qui cache un joueur (le local, et l'autre s'il est à l'écran) ne s'efface pas: il reste plein, ombre portée comprise, et s'ouvre seulement en ellipse autour de chaque joueur, bordée d'une trame de traits obliques. Un bâtiment ouvert est coupé à hauteur d'appui: la tranche des murs en encre pleine, son sol et ses faces intérieures en tons sombres de l'ambiance, jamais l'herbe sous son emprise. Le tout dans le nuanceur des volumes (`cutSight`, un `discard` ou une teinte), commandé par `userData.inkCut` de l'objet: ni passe, ni transparence, ni copie, ni programme de plus. Décision et calculs de référence: `../occultation.ts` (`cutZone`, `cutInterior`); réglages: `RENDER_SETTINGS.occlusion.cut` et `holdSeconds`. L'ancien rendu garde son fondu.

## Ajouter une ambiance (aucun code)

1. Dans `donnees/lieux/<lieu>/climat.json`, la saison porte un identifiant `ambience` (par exemple `aubrune-automne`).
2. Dans `ambiances.json`, ajoute une fiche de ce nom sous `sheets`. Elle hérite de `defaut` (ou de `extends`).
3. N'écris que ce qui change, par heure repère (`aube`, `midi`, `apres-midi`, `crepuscule`, `nuit`), sous `dehors`, `dedans` (lieu clos sans façade: wagon) et `piece` (pièce à fenêtres d'un bâtiment: elle part du dedans; `"sun": null` y rend le soleil à l'heure, `sunShadow` à 1 le fait entrer par les seules fenêtres). Couleurs en `#rrggbb` ou en trois nombres.
4. Note l'intention dans `pourquoi`.
5. `pnpm exec vitest run tests/rendu/encre.test.ts` contrôle le fichier (un exemplaire factice y est ajouté par le test).

Un lieu clos (wagon) donne en plus la teinte de ses lampes et du dehors dans son `lieu.json` (`ambience`).

## Ajouter un objet ou une lampe (aucun code)

- Un modèle livré dans `assets/commun/decors/` passe seul au matériau encré: ses morceaux d'un seul tenant deviennent des morceaux de contour, leur couche de traits vient de leur teinte (`INK_SETTINGS.models.rules`).
- Une famille de modèles qui éclaire s'inscrit dans `INK_SETTINGS.lampFamilies` (hauteur du foyer, rayon de la flaque, ombre ou non).

## Outil de mesure (dans le jeu)

- Ouvrir ou fermer: `F9` (sur un Mac portable: `fn` + `F9`), ou `Ctrl` + `Maj` + `M`, ou `?mesure=1` dans l'adresse. Fermé, il ne mesure rien.
- Il affiche: images par seconde (moyenne et premier centile), temps par image, temps du jeu sur le processeur, échelle interne et tailles des tampons, appels et triangles de chaque passe (ombre du soleil, ombre de la lampe, scène, contour), temps de chaque passe sur le processeur graphique quand `EXT_disjoint_timer_query_webgl2` existe, programmes.
- « Copier le relevé » met dans le presse-papiers un texte à coller au studio (il reste affiché et sélectionné si la copie est refusée). Il ajoute la machine (processeur graphique, navigateur, écran, gamme de couleurs, plage dynamique), l'espace de couleur du canevas et la mire de couleurs: cinq tons connus passés par la chaîne du jeu et relus dans le canevas (écart de 0 ou 1 sur 255: le jeu sort bien les valeurs sRGB prévues).
- « Remettre à zéro » relance la mesure; « Échelle » passe d'adaptative à chaque palier figé (100, 85, 75, 70 %) pour mesurer chacun.
- Aucune donnée personnelle: ni nom, ni chemin, ni adresse, ni contenu de la partie (seulement l'heure du jeu et l'ambiance).

## Résolution interne adaptative

La scène et le contour se calculent à une échelle interne (`INK_SETTINGS.resolution`: paliers 100, 85, 75, 70 %), puis l'image finie est mise à l'échelle du canevas (bicubique bornée, cinq lectures). Elle descend d'un palier quand la moyenne des images dépasse 30 images par seconde de budget, remonte quand le palier du dessus tiendrait avec de la marge, et une remontée ratée double l'attente de la suivante. Figer: `mode: 'fixed'` et `fixedScale`, ou `?echelle=1` (de 0,5 à 1, ou `auto`). En rendu logiciel (tests, banc) elle reste à 100 %.

Ce n'est pas un second niveau de rendu: mêmes passes, mêmes effets. Les seuils de détail, les rangs du trait, le pas des hachures des personnages et la taille des particules se comptent en points du canevas, pas de la cible interne: l'image garde la même composition à tous les paliers, seule sa finesse varie.

## Captures et mesures dans le vrai jeu

`pnpm exec vite build`, puis `pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts` (banc à deux vues, hors de la suite rapide). `LPL2_CAPTURES` choisit le dossier; `mesures.json` y relève appels, triangles, programmes et textures de chaque vue, et le contrôle de fuite compare les compteurs après un aller et retour en train.

`mesure.spec.ts` (ajouter `mesure` à la commande) ouvre l'outil de mesure par sa touche et relève les compteurs de chaque passe au quai (jour, nuit), dans le wagon, à chaque échelle interne et sur un écran dense; il écrit `mesure.json` et `releve.txt`.
