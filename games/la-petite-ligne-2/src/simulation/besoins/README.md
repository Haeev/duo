# Besoins (lot L3)

Trois jauges par joueur (`player.needs`, canal rapide) et leur palier (`player.tiers`, tranche « joueurs », événement `need_tier` au changement). Paliers, pertes et bonus: `donnees/commun/besoins.json`; le reste (nuit, repas à deux, geste salissant): `regles/reglages.ts`.

- `jauges.ts`: palier avec marge (`hysteresis`), perte par pas, `modifiersOf` (vitesse, gestes d'outil, mini-jeux, amitié, chance, bonus de repas; bonus plafonnés par `maxBonus`), `onlyReliefFor` (faim ou sommeil à 0: la touche d'action ne sert plus qu'à ça).
- `soins.ts`: `relieveNeed`, `wakeUp` (nuit au lit), `soil` (geste salissant).
- `repas.ts`: repas spécial à deux assis au même meuble ou au même groupe de meubles (`group` de la carte), bonus tenu tant que la faim reste au-dessus de 50.
- `briques.ts`: brique `relieve` pour le registre; le gain vient pas à pas pendant le geste long (`gesture.long`, `gesture.clip` = `clip` de la brique, `gesture.target` = instance).
- `index.ts`: perte au fil du temps (effort: course ou geste en cours), repos assis ou couché, intention `eat`.
- `endurance.ts`: jauge d'endurance (`player.stamina`, canal rapide, 1 = pleine) et son état lent (`player.staminaMods`: essoufflement, renforts, tranche « joueurs »). La course la vide, la recharge dépend de la posture (marche, arrêt, assis, couché); vide, on marche jusqu'au seuil `recoverAt`. Réveil: pleine. Réglages: section `stamina` de `besoins.json`.

## Recette: un plat qui donne de l'endurance

1. Ouvre `donnees/commun/objets/<plat>.json` (ou crée-le: `pnpm nouveau objet <plat>`).
2. Dans `food`, ajoute `"stamina"` avec au moins un champ (exemples commentés: `_gabarits/objet.jsonc`):
   - `"refill": 0.25`: un quart de jauge rendu tout de suite;
   - `"capacity": { "extra": 0.25, "seconds": 240 }`: jauge plus longue d'un quart, 4 minutes réelles;
   - `"recovery": { "factor": 1.5, "seconds": 240 }`: recharge 1,5 fois plus rapide, 4 minutes.
3. Repères: cru ou froid, un petit `refill` (pomme 0,15, pain 0,25); plat chaud, 0,5 et un renfort; grand plat, 1 et deux renforts (pot-au-feu). Le prix ne change pas.
4. `pnpm exec vitest run tests/endurance.test.ts`: le validateur nomme toute faute; la jauge du HUD montre le renfort sans autre changement.
