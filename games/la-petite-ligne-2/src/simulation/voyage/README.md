# Voyage en train (lot L2)

ADR 0018. Phases de `common.phase`: `day`, `boarding` (les deux sur le quai, chacun valide), `travel` (wagon, chaque machine charge le lieu et envoie `place_loaded`), `arrival`. Le lieu quitté garde `leftOn`; le lieu d'arrivée est créé à la première visite (`createPlaceState`). Réglages: `travel` de `reglages.json`.
