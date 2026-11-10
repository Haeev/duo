# Rendu 3D (lot L4)

Three.js. Il lit l'état par `GameView` (`src/session.ts`) et n'écrit jamais dedans. `lieu/`: tout ce qui appartient au lieu courant, chargé à l'arrivée et libéré au départ par un `ResourceTracker` (ADR 0018). `personnages/`: lot L6. Un meuble sans modèle livré s'affiche en forme simple à la taille de ses données.

## Brancher et essayer

- `createRenderer(options)` (`index.ts`) rend le moteur, ou `null` sans WebGL2 (le canevas reste libre pour le repli). `frame(dt)` à chaque image, `pushCameraInput` pour la caméra, `moveToWorld(droite, haut)` pour le déplacement relatif à l'écran.
- Réglages: `reglages.ts`. Logique pure et testée: `camera.ts`, `occultation.ts`, `cible.ts`, `lieu/description.ts`.
- Personnages: l'interface `CharacterLayer` (`bonshommes.ts`); le lot L6 donne sa couche par `RenderOptions.characters`.
- Page de démonstration du rendu seul: `pnpm dev`, puis `http://localhost:5173/src/rendu/demo/index.html` (touches et paramètres en tête de `demo/main.ts`).
