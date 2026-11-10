# Potager (cahier 4.7, R30)

Rien ne meurt. Une plante pousse d'un point par jour sec, de deux par jour arrosé ou de pluie (`outils/reglages.ts`); la part de jours arrosés choisit la qualité de la récolte. Hors saison, elle attend.

- `potager.ts`: brique `field`. Chaque mètre carré de l'emprise du meuble (`commun/meubles/terre-cultivable.json`) peut devenir une parcelle, où l'on veut, jusqu'à la limite de `plots` (6, puis 12 et 24 quand les faits d'amélioration sont retenus). La case visée est juste devant le personnage (`aimedCell`); la bêche améliorée traite 3 cases en ligne, l'arrosoir 3, 9 ou 18. Lecture pour le rendu: `fieldView` (état `bare`, `growing`, `ripe`, stade, `thirsty`), `cellCenter`, `aimedCell`.
- `pousse.ts`: au changement de jour ou de météo, toutes les terres du lieu avancent (les jours passés ailleurs se rattrapent, comptés secs).
- `index.ts`: le système, après les autres.

Ajouter une culture: `pnpm nouveau culture <id>` (recette dans `donnees/README.md`).
