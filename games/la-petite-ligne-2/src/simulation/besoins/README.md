# Besoins (lot L3)

Trois jauges par joueur (`player.needs`, canal rapide) et leur palier (`player.tiers`, tranche « joueurs », événement `need_tier` au changement). Paliers, pertes et bonus: `donnees/commun/besoins.json`; le reste (nuit, repas à deux, geste salissant): `regles/reglages.ts`.

- `jauges.ts`: palier avec marge (`hysteresis`), perte par pas, `modifiersOf` (vitesse, gestes d'outil, mini-jeux, amitié, chance, bonus de repas; bonus plafonnés par `maxBonus`), `onlyReliefFor` (faim ou sommeil à 0: la touche d'action ne sert plus qu'à ça).
- `soins.ts`: `relieveNeed`, `wakeUp` (nuit au lit), `soil` (geste salissant).
- `repas.ts`: repas spécial à deux assis au même meuble ou au même groupe de meubles (`group` de la carte), bonus tenu tant que la faim reste au-dessus de 50.
- `briques.ts`: brique `relieve` pour le registre; le gain vient pas à pas pendant le geste long (`gesture.long`, `gesture.clip` = `clip` de la brique, `gesture.target` = instance).
- `index.ts`: perte au fil du temps (effort: course ou geste en cours), repos assis ou couché, intention `eat`.
