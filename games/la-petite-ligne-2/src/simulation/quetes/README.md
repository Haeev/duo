# Quêtes (suites, actes, étapes)

Une suite (`donnees/lieux/<lieu>/quetes/<id>.json`, schéma `src/donnees/schemas/quete.ts`, gabarit `donnees/_gabarits/quete.jsonc`) a des actes joués l'un après l'autre; dans un acte, une étape s'ouvre quand ses étapes `after` sont franchies (absent: la précédente; `[]`: en parallèle). La progression est commune: une étape franchie par l'un l'est pour les deux. Une étape `together` attend que les deux joueurs soient réunis; les autres se font seul.

- `moteur.ts`: ouverture (`requires` ou effet `open_quest`), étapes ouvertes, passage d'une étape (effets `onStart` à l'ouverture, `onDone` au passage, objets `deliver` remis), fin de suite, suivi (`quest_track`). État: `progress.quests[<suite>]` (`passed`: étapes franchies; `chapter`, `step`: la ligne affichée).
- `conditions.ts`: conditions des règles communes (`regles/conditions.ts`, réutilisé) plus celles de l'histoire: `deliver` (on parle à l'habitant en tenant les objets), `reach` (point de la carte, un ou les deux), `talked` (dialogue affiché, au nœud donné), `together`, `posture` (assis ou couché sur un meuble du lieu, un ou les deux), `scene_seen`, `quest_step`.
- `effets.ts`: effets communs (`regles/effets.ts`, réutilisé) plus `unlock_zone`, `villager_arrives`, `open_quest`, `play_scene`, `travel_to`.
- `travel_to` (lieu, `ending` facultatif): départ des deux en train une fois la scène en cours finie (`voyage/`). Vers un lieu absent du jeu, l'écran de fin de chapitre `ending` (`id` unique dans le lieu, `title`, `lines`) s'affiche: état `common.story.ending`, lecture `chapterEndView`, intention `chapter_end_close` (chacun ferme le sien). Le validateur exige `ending` quand le lieu n'existe pas.
- `saga` (facultatif) d'une suite: `{ id, title, act }`, les suites d'une même histoire au carnet (`journal`: champ `saga`). Le validateur veut un même titre et un acte par suite.
- `faits.ts`: zones ouvertes (`isZoneOpen`), habitants arrivés (`hasArrived`), scènes vues; ce sont des faits de la mémoire (`zones.<lieu>.<zone>`, `habitants.<lieu>.<habitant>`, `scenes.<lieu>.<scène>`). Le déplacement, le rendu et la présence des habitants lisent ces fonctions.
- `lecture.ts` (interface): `journal` (carnet), `stepText` (notification « Étape franchie »), `seenScenes` (scènes à relire), `glanceTarget` (coup d'œil de 3 s: point ou habitant visé par la suite suivie du joueur).
- `valider.ts`: branché dans `donnees/valider.ts`; refuse toute suite qui peut se bloquer (voir l'en-tête du fichier).
- `reglages.ts`: rayons, délais, vitesses (à migrer dans `reglages.json`).

Événements: `quest_opened`, `quest_step_done` (`by`: le joueur au nom de qui elle passe), `quest_done`, `chapter_ended`. Intentions: `quest_track`, `chapter_end_close`. Le système n'évalue que les suites du lieu où l'on joue, tous les `checkEveryTicks` pas.
