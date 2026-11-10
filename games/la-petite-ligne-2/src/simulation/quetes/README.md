# Quêtes (suites, actes, étapes)

Une suite (`donnees/lieux/<lieu>/quetes/<id>.json`, schéma `src/donnees/schemas/quete.ts`, gabarit `donnees/_gabarits/quete.jsonc`) a des actes joués l'un après l'autre; dans un acte, une étape s'ouvre quand ses étapes `after` sont franchies (absent: la précédente; `[]`: en parallèle). La progression est commune: une étape franchie par l'un l'est pour les deux. Une étape `together` attend que les deux joueurs soient réunis; les autres se font seul.

- `moteur.ts`: ouverture (`requires` ou effet `open_quest`), étapes ouvertes, passage d'une étape (effets `onStart` à l'ouverture, `onDone` au passage, objets `deliver` remis), fin de suite, suivi (`quest_track`). État: `progress.quests[<suite>]` (`passed`: étapes franchies; `chapter`, `step`: la ligne affichée).
- `conditions.ts`: conditions des règles communes (`regles/conditions.ts`, réutilisé) plus celles de l'histoire: `deliver` (on parle à l'habitant en tenant les objets), `reach` (point de la carte, un ou les deux), `talked` (dialogue affiché, au nœud donné), `together`, `scene_seen`, `quest_step`.
- `effets.ts`: effets communs (`regles/effets.ts`, réutilisé) plus `unlock_zone`, `villager_arrives`, `open_quest`, `play_scene`.
- `faits.ts`: zones ouvertes (`isZoneOpen`), habitants arrivés (`hasArrived`), scènes vues; ce sont des faits de la mémoire (`zones.<lieu>.<zone>`, `habitants.<lieu>.<habitant>`, `scenes.<lieu>.<scène>`). Le déplacement, le rendu et la présence des habitants lisent ces fonctions.
- `lecture.ts` (interface): `journal` (carnet), `stepText` (notification « Étape franchie »), `seenScenes` (scènes à relire), `glanceTarget` (coup d'œil de 3 s: point ou habitant visé par la suite suivie du joueur).
- `valider.ts`: branché dans `donnees/valider.ts`; refuse toute suite qui peut se bloquer (voir l'en-tête du fichier).
- `reglages.ts`: rayons, délais, vitesses (à migrer dans `reglages.json`).

Événements: `quest_opened`, `quest_step_done` (`by`: le joueur au nom de qui elle passe), `quest_done`. Intention: `quest_track`. Le système n'évalue que les suites du lieu où l'on joue, tous les `checkEveryTicks` pas.
