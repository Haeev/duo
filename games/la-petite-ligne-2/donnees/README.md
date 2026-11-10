# Données du jeu

Tout le contenu est ici, en JSON validé par schéma (`src/donnees/schemas/`). **Un contenu = un fichier dont le nom est l'identifiant.** Ajouter un fichier suffit: rien à inscrire ailleurs, aucune ligne de moteur. `pnpm test` dit ce qui cloche, avec le fichier et le champ.

```text
commun/        reglages.json, besoins.json, sacs.json
               objets/<id>.json   meubles/<id>.json   recettes/<id>.json   prises/<id>.json
               personnages/catalogue.json (écrit par le générateur de pièces, lot L5)
lieux/<lieu>/  lieu.json, carte.json
               habitants/<id>.json   dialogues/<id>.json   commerces/<id>.json   quetes/<id>.json
               interieurs/<id>.json (pièces posées sur la grille du lieu, sous le dehors)
_gabarits/     un gabarit commenté par type de contenu (jamais chargés par le jeu)
```

## Recette commune

1. `pnpm nouveau <type> <id> [lieu]` copie le gabarit, sans ses commentaires, au bon endroit.
2. Ouvre le gabarit (`_gabarits/<type>.jsonc`) à côté: chaque champ y est expliqué. Remplis le fichier créé.
3. `pnpm test`: le validateur nomme toute faute (référence inconnue, texte trop long, geste trop lent).

## Recettes par type

| Type | Commande | Ensuite |
|---|---|---|
| Objet | `pnpm nouveau objet poire` | famille, pile, `food` s'il se mange. Il est connu du sac, des commerces et des effets. |
| Meuble | `pnpm nouveau meuble chaise` | taille, briques. Pour le voir: une ligne dans `objects` de la carte d'un lieu, ou `placeable: true` pour le mode déco. Modèle: nœud `model` à livrer par l'artiste; en attendant, une forme simple. |
| Pièce de personnage | générateur du lot L5 (écrit `catalogue.json` et le GLB) | `pnpm nouveau piece-de-personnage <id>` ajoute une entrée d'essai à la main. |
| Habitant | `pnpm nouveau habitant facteur aubrune` | nom, caractère, point de la carte où il se tient, apparence. |
| Dialogue | `pnpm nouveau dialogue bonjour-facteur aubrune` | `villager`, conditions, nœuds. 150 caractères par réplique, 3 options au plus, toujours une fin. |
| Recette | `pnpm nouveau recette compote` | poste, ingrédients, résultat (des objets existants). |
| Prise | `pnpm nouveau prise gardon` | l'objet obtenu, les lieux, heures, météos, saisons, rareté. |
| Commerce | `pnpm nouveau commerce epicerie aubrune` | tenancier, horaires, ventes, rachats. Pour l'ouvrir: un meuble comptoir avec la brique `shop` sur la carte. |
| Quête | `pnpm nouveau quete le-train-de-5h12 aubrune` | chapitres, étapes, conditions de fin, effets. |
| Lieu | `pnpm nouveau lieu hautefonte` | carte, gare; relier au rail: `links` ici et dans le lieu voisin. Puis ses habitants, dialogues, commerces, quêtes dans son dossier. |
| Grand lieu | `pnpm nouveau lieu hautefonte`, puis `node outils/plan-vers-lieu.ts <plan.json> donnees/lieux/hautefonte/carte.json` | le plan vu du dessus du level designer est la source de `carte.json` (ADR 0022): ne pas retoucher la carte produite, corriger le plan et relancer. Les meubles s'ajoutent dans `objects` (400 meubles à briques au plus par lieu). |
| Intérieur | `pnpm nouveau interieur salle-du-cafe aubrune` | taille, `at` dans l'annexe sous le dehors (`outdoor` de la carte), murs, points, meubles, portes; la porte du dehors s'écrit dans `doors` de `carte.json` et les deux portes se nomment l'une l'autre. |

## Briques (ce qu'un meuble sait faire)

`sit` s'asseoir, `sleep` dormir, `store` ranger, `gather` ramasser ou cueillir, `relieve` soulager un besoin, `shop` vendre et acheter, `cook` cuisiner ou fabriquer, `open` ouvrir, `repair` réparer. Paramètres: `_gabarits/meuble.jsonc`. Une chaise est un meuble avec `sit`; un coffre, un meuble avec `store`; un banc-coffre, les deux.

Il manque un comportement ? C'est une **brique nouvelle** à demander (schéma, état, comportement: trois fichiers du moteur, une fois), pas un cas particulier à glisser dans un contenu.

## Conventions

- Identifiants: minuscules, chiffres, traits d'union. Textes en français, tutoiement.
- Prix en euros entiers. Heures en minutes depuis minuit (6 h = 360). Carte en cases de 1 m, x vers l'est, y vers le sud.
- Valeurs de gameplay: `commun/reglages.json` et `commun/besoins.json`, jamais dans le code.
