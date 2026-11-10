# Scènes

Une scène (`donnees/lieux/<lieu>/scenes/<id>.json`, schéma `src/donnees/schemas/scene.ts`, gabarit `donnees/_gabarits/scene.jsonc`) est une suite de temps (`beats`): `say` (réplique, émotion, onomatopée, pour les deux ou un rôle), `walk`, `emote`, `camera` (suggestion), `fade`, `wait`, `await` (action attendue, une partie par rôle), `effects`.

- Lancement: effet `play_scene` d'une étape, ou déclencheur de monde (`trigger`: heure `at` avec un retard permis, conditions `when`, `once` ou `daily`). Une scène `together` attend que les deux soient réunis; une scène lancée pendant une autre attend en file (4 au plus).
- `lecteur.ts` (hôte): l'état tient dans `common.story.scene` (temps en cours, rôle `a`, lectures, parties faites, caméra, fondu); il part chez l'invité et se sauvegarde, d'où la reprise exacte après une reconnexion. Rien n'est figé: une réplique passe quand chaque joueur concerné l'a lue, ou `soloReadSeconds` après la lecture du premier (`readAt`: l'autre a toujours ce délai pour finir), et jamais après `maxLineSeconds`. Changer de lieu abandonne la scène sans la compter vue.
- `walk`: l'habitant s'arrête en face des joueurs s'il les rejoint (`stageSpot`), les contourne sans les traverser (`detourAround`), et presse le pas quand sa marche dépasserait `walkBudgetSeconds` (`SCENE_STAGING`, `reglages.ts`): personne n'attend longtemps une réplique. Test: `tests/arrivee.test.ts`.
- Scène à deux asymétrique: `roles` nomme les deux rôles; `a` revient au joueur qui la lance, `b` à l'autre; `say.to` et `await.parts[].role` les visent.
- `lecture.ts` (interface et rendu, sur les deux machines): `sceneView` donne la réplique accordée, si elle s'adresse au joueur, ses consignes, la caméra suggérée et le fondu.

- Gestes (scène à deux rôles): une partie d'`await` peut porter `gesture` (`hold`: tenir la touche d'action `seconds`; `press`: l'appuyer; `stand`: rester `seconds` au point), lu chez l'hôte sur `act` des commandes et la position. `together` (s) sur l'attente: les gestes doivent réussir en même temps, à ce délai près; sinon chacun est acquis une fois réussi. L'avancement est dans `common.story.scene.gestures` (part chez l'invité); `sceneView` donne `hints[].gesture` (`progress` de 0 à 1, `down`) et `together`.
- Recette: dans la scène (copiée de `donnees/_gabarits/scene.jsonc`), une partie par rôle avec `gesture` et `done: []`, plus `together` si c'est à faire ensemble. Test: `tests/manques-histoire.test.ts`.

Événements: `scene_started`, `scene_beat` (chaque temps, même instantané), `scene_gesture` (`start`, `stop`, `expired`, `done`, `lost`, par partie et par joueur), `scene_ended` (`completed`). Intention: `scene_next`.
