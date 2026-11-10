# Entrées (lot L2)

Du clavier vers `StepInput` (déplacement tourné par la caméra, dans le repère du monde) et vers les intentions. Touches lues par position (`duo-game.json`), libellés par `duo.input.keyLabel`. Le déplacement est au clavier seul.

- `commandes.ts`: `createControls({ input, view, cameraYaw })`, à appeler une fois par pas. `cameraYaw()` est le lacet affiché de la caméra en radians, fourni par le rendu (L4): 0 quand le haut de l'écran regarde le nord de la carte (y décroissant), positif quand la vue tourne vers l'est (à PI/2, le haut de l'écran regarde l'est). `worldMove` fait la conversion, testée dans Node.
- Provisoire, jusqu'à l'interface (L7): Espace referme un dialogue ouvert; Entrée sur le quai monte dans le train ou en redescend.
- `repere-essai.ts`: repères dessinés sur le plan 2D du socle (cap, cible et verbe, quai, objets au sol, voyage). À supprimer avec `plateforme/ecran-socle.ts`.
