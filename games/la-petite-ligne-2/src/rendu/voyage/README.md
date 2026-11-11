# Scène du trajet (rendu)

Pendant la phase `travel`, le moteur (`../moteur.ts`) cache le lieu d'arrivée, qui se construit derrière, et dessine à sa place un diorama en formes simples: le train entre en gare, les deux personnages marchent jusqu'à la portière et se retrouvent à leur fenêtre, le train roule (le décor défile), il arrive au quai d'en face et ils descendent. Fondu au noir à l'entrée et à la sortie.

- `sequence.ts`: logique pure (testée dans `tests/rendu/trajet.test.ts`). Tout se déduit de `tripSeconds` (simulation, `voyage/index.ts`): l'hôte et l'invité voient la même image au même pas.
- `scene.ts`: géométrie fusionnée (décor, train, fumée) sur le matériau des formes provisoires; construite à l'entrée dans le train, libérée à l'arrivée.
- `reglages.ts`: découpage de la scène, mesures, couleurs. La durée vient de `travel.minSeconds` (`donnees/commun/reglages.json`, 12 s au plus); les deux joueurs peuvent passer la scène avec la touche d'action.
- Les personnages sont ceux du jeu (`CharacterLayer`), nourris d'un monde de substitution où leurs corps suivent la scène.
- Le train est l'autorail livré (`train.model` des réglages, manifeste des décors), au rendu encré, vitres allumées la nuit par sa lampe (`light` du manifeste, accordée par `INK_SETTINGS.lamps.vehicle`); sans le modèle, une caisse provisoire à ses mesures. Les personnages montent par sa porte arrière (`doorX`) et se tiennent dans la salle: la caisse se fond devant eux (`Occlusion`, comme dehors). Le diorama est calé sur ses mesures: quai au niveau du plancher, rails 0,26 m au-dessus de son pied.
