# Dialogues (lot L3)

Un dialogue est un graphe (`src/donnees/schemas/dialogue.ts`). L'état ne porte que le nœud courant de chaque joueur (`player.talk`): chacun parle de son côté. Le défilement lettre par lettre, « tout afficher » et la résolution des accords sont locaux (lot L7); le babil part de l'événement `talk_page` (lot L9).

- `conversation.ts`: choix du dialogue (priorité, `when`, `once`), traversée des aiguillages et des effets, `talkNext`, `talkChoose`, `endTalk`, et `talkView` (ce que la fenêtre affiche).
- Hygiène: une option à effet d'échange échoue en hygiène basse ou nulle (`refused`, raison `too-dirty`) et se retente une fois lavé; `talkView` la marque d'avance (`fails: 'hygiene'`). Les remarques d'hygiène s'écrivent en données (`need_at_least` sous `not`).
- `amitie.ts`: points par habitant, première conversation du jour, cœurs retenus en faits `amitie.<habitant>.coeur-<n>` (variantes par `remembered`).
- `accords.ts`: balises `[[féminin|masculin]]` (joueur qui lit) et `[[duo:féminin|masculin]]` (les deux); `valider.ts` les contrôle.
