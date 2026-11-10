# Dialogues (lot L3)

Un dialogue est un graphe (`src/donnees/schemas/dialogue.ts`). L'état ne porte que le nœud courant de chaque joueur (`player.talk`): chacun parle de son côté. Le défilement lettre par lettre et « tout afficher » sont locaux (lot L7); `talkView` rend le texte déjà accordé au genre des joueurs (`player.gender`); le babil part de l'événement `talk_page` (lot L9).

- L'ouverture passe par l'action `talk` du registre des briques (`briques/parler.ts`), qui appelle `startTalk`.
- `conversation.ts`: choix du dialogue (priorité, `when`, `once`), traversée des aiguillages et des effets, `talkNext`, `talkChoose`, `endTalk`, et `talkView` (ce que la fenêtre affiche).
- Hygiène: une option à effet d'échange échoue en hygiène basse ou nulle (`refused`, raison `too-dirty`) et se retente une fois lavé; `talkView` la marque d'avance (`fails: 'hygiene'`). Les remarques d'hygiène s'écrivent en données (`need_at_least` sous `not`).
- `amitie.ts`: points par habitant et par joueur (`progress.bonds`, clé `bondKey`), première conversation du jour, cœurs retenus en faits; variantes par la condition `bond_at_least`.
- `accords.ts`: balises `[[féminin|masculin]]` (joueur qui lit) et `[[duo:féminin|masculin]]` (les deux); `valider.ts` les contrôle au chargement (branché dans `donnees/valider.ts`).
