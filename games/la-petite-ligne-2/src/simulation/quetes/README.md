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

## Décision à deux (recette)

1. L'étape la déclare: `"decision": { "id": "<décision>", "options": ["<a>", "<b>"] }`, et l'attend: `"done": [{ "type": "decision_is", "decision": "<décision>", "state": "agreed" }]`.
2. Un dialogue du lieu offre chaque option: `"effects": [{ "type": "choose", "decision": "<décision>", "option": "<a>" }]`.
3. Après le choix, un nœud `branch` sur `decision_is`: `agreed` (avec `option`: la suite), `split` (le texte invite à se mettre d'accord), sinon une réplique d'attente.
4. La décision n'est prise que si les deux choix concordent; avant, chacun peut changer d'avis; prise, elle ne bouge plus (`decisions.ts`).
5. État: trois faits de la mémoire (`decisions.<id>.j0`, `.j1`, `decisions.<id>`), donc sauvegardés et transmis sans rien ajouter. Événement `decision_changed` (`waiting`, `split`, `agreed`), annoncé par l'interface.
6. Le chargement refuse une décision sans accord attendu, une option qu'aucun dialogue n'offre, un `choose` vers une décision inconnue.
7. Exemple livré: `la-baronne.json` et `achille-decision.json`. Test court: `tests/decision-a-deux.test.ts`.

Événement `reward_given`: récompenses qui ne sont pas des objets (`regles/recompenses.ts`).
