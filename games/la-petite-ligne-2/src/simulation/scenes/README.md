# Scènes

Une scène (`donnees/lieux/<lieu>/scenes/<id>.json`, schéma `src/donnees/schemas/scene.ts`, gabarit `donnees/_gabarits/scene.jsonc`) est une suite de temps (`beats`): `say` (réplique, émotion, onomatopée, pour les deux ou un rôle), `walk`, `emote`, `camera` (suggestion), `fade`, `wait`, `await` (action attendue, une partie par rôle), `effects`.

- Lancement: effet `play_scene` d'une étape, ou déclencheur de monde (`trigger`: heure `at` avec un retard permis, conditions `when`, `once` ou `daily`). Une scène `together` attend que les deux soient réunis; une scène lancée pendant une autre attend en file (4 au plus).
- `lecteur.ts` (hôte): l'état tient dans `common.story.scene` (temps en cours, rôle `a`, lectures, parties faites, caméra, fondu); il part chez l'invité et se sauvegarde, d'où la reprise exacte après une reconnexion. Rien n'est figé: une réplique passe quand chaque joueur concerné l'a lue, ou `soloReadSeconds` après qu'un seul l'a lue, et jamais après `maxLineSeconds`. Changer de lieu abandonne la scène sans la compter vue.
- Scène à deux asymétrique: `roles` nomme les deux rôles; `a` revient au joueur qui la lance, `b` à l'autre; `say.to` et `await.parts[].role` les visent.
- `lecture.ts` (interface et rendu, sur les deux machines): `sceneView` donne la réplique accordée, si elle s'adresse au joueur, ses consignes, la caméra suggérée et le fondu.

Événements: `scene_started`, `scene_beat` (chaque temps, même instantané), `scene_ended` (`completed`). Intention: `scene_next`.
