# Commande de la semaine et courrier (cahier 4.1)

Chaque semaine, le train du samedi emporte une commande de 3 à 5 lignes tirées dans ce que le duo sait produire, payée à la livraison ligne par ligne; ce qui manque est reporté à la semaine suivante, sans pénalité ni minuterie. Il apporte aussi le courrier. Tout tient dans les données du lieu:

| Fichier                               | Rôle                                                                                                                                                                                                                         | Gabarit                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `lieux/<lieu>/commande.json`          | le guichet: événement du calendrier pendant lequel on livre, habitant qui reçoit, nombre de lignes, où va l'argent (`chest` ou `deliverer`), rangements où puiser après le sac (la consigne), lettres par passage, répliques | `guichet-de-commande.jsonc` |
| `lieux/<lieu>/commandes/<table>.json` | une table de lignes par métier: objet, quantité tirée entre deux bornes, prix d'une unité, conditions (saison, fait d'histoire)                                                                                              | `commande.jsonc`            |
| `lieux/<lieu>/lettres/<id>.json`      | une lettre: expéditeur, rang, conditions, paragraphes, signature, pièce jointe facultative (effets des dialogues)                                                                                                            | `lettre.jsonc`              |

Schémas: `src/donnees/schemas/commande.ts`; contrôles entre fichiers: `valider.ts`.

## Le moteur

| Fichier       | Rôle                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`    | le système (chez l'hôte): retient les objets que le duo a eus en main (`objets.obtenu.<objet>`, à chaque `item_gained`); tire la commande suivante dès que la livraison attendue change (le train est reparti), reports compris; fait arriver le courrier à chaque passage; intentions `order_deliver` (une ligne, du sac puis des rangements du guichet) et `mail_take` |
| `tirage.ts`   | tirage pur: graine de la partie, lieu, jour de livraison. Une table après l'autre (la commande mêle les métiers), jamais deux lignes du même objet                                                                                                                                                                                                                       |
| `lecture.ts`  | lecture pure, la même chez l'hôte et l'invité: commande en cours, lettres, guichet ouvert, joueur à portée, page « Livrer la commande » de la conversation                                                                                                                                                                                                               |
| `reglages.ts` | clés des faits, portée (3 m), jours regardés en avant                                                                                                                                                                                                                                                                                                                    |

État: uniquement des faits de la mémoire (`commande.<lieu>.pour`, `commande-ligne.<lieu>.<ligne>`, `commande-livre.<lieu>.<ligne>`, `courrier.<lieu>.<lettre>`...). Ni le format de sauvegarde ni les tranches du réseau ne changent; l'invité, qui n'a pas la graine, lit la commande tirée par l'hôte. Une partie d'avant la commande compte comme « su » ce qui a été vendu au comptoir ou se tient en main.

La livraison passe par l'habitant qui reçoit: à la fin de chaque conversation avec lui, pendant l'événement et s'il y a quelque chose à faire, une page propose `talk.open` (nœud réservé `DIALOGUES.orderOffer`, comme la boutique d'un commerçant); le choix envoie `order_opened` et l'interface ouvre l'écran de livraison (`src/interface/commande/`). Le carnet montre la commande à l'avance (onglet Quêtes, en tête).

## Ajouter (aucun code)

1. Un guichet: `pnpm nouveau guichet-de-commande commande <lieu>`; nomme l'événement (le train), qui reçoit, la consigne.
2. Une table: `pnpm nouveau commande <table> <lieu>`; une ligne par objet, prix en centimes.
3. Prix d'Aubrune: 1,25 fois le meilleur rachat au comptoir, sous le prix de tout commerce qui le vend, et sous le coût d'achat des ingrédients d'un plat dont tous s'achètent.
4. Une lettre: `pnpm nouveau lettre <id> <lieu>`; `when` dit quand elle part, `attach` ce qu'elle contient.
5. `pnpm exec vitest run tests/commande-du-samedi.test.ts`: tirage, trois semaines, courrier, reprise, gabarits, et garde-fous des prix d'Aubrune.
