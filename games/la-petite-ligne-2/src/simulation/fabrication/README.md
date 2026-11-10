# Fabrication et atelier (cahier 4.5 et 4.7)

Plans: `donnees/commun/plans/` (gabarit `donnees/_gabarits/plan.jsonc`, `pnpm nouveau plan <id>`, schéma `src/donnees/schemas/plan.ts`). Postes: un meuble qui déclare la brique `craft` avec son `station` (`workbench`, `forge`, `loom`, `grindstone`) et ses `services` (`make`, `upgrade`, `repair`, `sharpen`), qui sont les onglets de l'écran (`interface/atelier/`).

- `briques.ts`: brique `craft` (registre): ouvre l'atelier (`workshop_opened`), apprend les plans papier qu'on a sur soi (`plan_learned`), rend l'outil commandé s'il est prêt.
- `index.ts`: le système. `craft_start` (plan connu, matériaux présents, poste libre ou déjà à soi), `craft_strike` (un coup, le sien ou celui de l'autre joueur: à deux, les points s'additionnent), `craft_cancel` (rien n'est perdu), `craft_tool` (`upgrade`, `repair`, `sharpen` sur une case de la barre). Matériaux pris à la fin: poches d'abord, puis coffres à `chestReach` du poste (ceux de la maison). L'objet va dans les poches (ce qui ne rentre pas tombe au sol). L'ouvrage en cours vit hors de l'état, comme la cuisine.
- `plans.ts`: lecture pure (connu, fabrications faites, poste, matériaux, prix de réparation, amélioration, commande).
- `reglages.ts`: portée, coffres, coup à mains nues, pas du prix de réparation, meule.
- `valider.ts`: contrôles croisés (objets, poste existant, famille `furniture`, amélioration déclarée par l'outil).

## Règles

- Coup: `tool.work.power` du marteau en main (émoussé: `bluntPower`), 4 à mains nues; un coup par geste au plus. Le marteau s'use d'un cran par fabrication.
- Amélioration: plan `upgrade` du poste; outil obtenu, prix et matériaux dans `tool.work.upgrade` de l'outil (source unique). `delay: "next-day"`: l'outil reste chez l'artisan, rendu à l'ouverture de l'atelier à partir du lendemain (mémoire `fabrication.commande.j<n>` = `outil@jour`; une commande à la fois).
- Réparation payée: `tool.work.repair` au prorata de l'usure, arrondi au-dessus à 10 centimes; ses matériaux en entier.
- Meule: un tour par seconde rend 12,5 % de l'usure, jusqu'à la moitié; gratuit; hache et bêche seulement.
- Mémoire: `fabrication.plan.<id>` = fabrications faites (0: connu, jamais fait); un habitant ou une quête apprend un plan par l'effet `remember` sur cette clé.

Refus (`refused`): `too-far`, `not-here`, `unknown-plan`, `missing-materials`, `not-enough-money`, `busy`, `no-work`, `no-tool-in-hand`, `cannot-upgrade`, `cannot-repair`, `already-sharp`, `cannot-sharpen`, `sharp-enough`, `order-pending`. Événements: `workshop_opened`, `craft_started`, `craft_hit` (`progress`), `craft_cancelled`, `crafted` (`first`: à fêter, `together`), `plan_learned`, `tool_ordered`, `tool_mended`, `tool_sharpened`, plus `tool_upgraded` et `tool_repaired` du lot outils.

Test: `tests/fabrication.test.ts`. Démonstration: `/src/interface/atelier/demo/index.html#fabriquer` (aussi `#couleur`, `#manque`, `#inconnu`, `#travail`, `#fete`, `#ameliorer`, `#demain`, `#reparer`, `#affuter`).
