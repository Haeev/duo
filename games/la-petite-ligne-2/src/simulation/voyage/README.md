# Voyage en train (lot L2)

ADR 0018. Phases de `common.phase`: `day`, `boarding` (les deux sur le quai, chacun valide « Monter »), `travel` (scène du trajet; chaque machine charge le lieu et envoie `place_loaded`), `arrival`. Le lieu quitté garde `leftOn`; le lieu d'arrivée est créé à la première visite (`createPlaceState`). Réglages: `travel` de `reglages.json`.

- La scène du trajet dure `travel.minSeconds` (12 s au plus, contrôlé par le schéma). Pendant `travel`, la touche d'action vote pour la passer (`travel.skip`): les deux voix et les deux lieux chargés, on arrive tout de suite.
- `tripSeconds(look)` donne le temps écoulé dans la scène, depuis l'état seul: l'hôte et l'invité dessinent la même chose au même pas (`src/rendu/voyage/`).
