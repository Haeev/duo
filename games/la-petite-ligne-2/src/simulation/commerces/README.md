# Commerces (cahier 4.6, R34)

On ne vend qu'aux commerçants: chacun ne rachète que ce qui touche à son métier, à **son** prix (l'œuf à 0,60 € chez l'épicière, à 1,00 € chez le boulanger). Chaque joueur paie de sa bourse; le coffre commun paie les achats du foyer. Données: `donnees/lieux/<lieu>/commerces/<id>.json` (gabarit commenté `donnees/_gabarits/commerce.jsonc`, schéma `src/donnees/schemas/commerce.ts`). Le moteur ne nomme aucun commerce.

## Fichiers

- `prix.ts`: lecture pure (hôte, invité, interface): ouverture, prix de base (objet, coefficient de famille, famille), besoin du jour (tiré de la graine et du jour, payé `dailyNeedFactor` fois), bonus d'amitié (`friendship`), modificateur `sellPrice` des besoins (repas `better_prices`), stock et réassort, plafond du jour, mémoire des prix.
- `index.ts`: système `commerces`: intentions `shop_buy` (avec `chest` pour le coffre commun), `shop_sell` et `shop_talk` (« Parler » de l'écran de boutique), `openShop` (brique et effet de dialogue), `rememberPrice`.
- `brique.ts`: brique `shop` (comptoir), inscrite dans `briques/registre.ts`; comptoir tenu (`counterKeeper`).
- `validation.ts`: contrôles appelés par `donnees/valider.ts` (objets connus, coefficient sans prix de famille, besoin du jour impossible, identifiant en double dans le jeu).
- `reglages.ts`: besoin du jour (x1,5), pas des prix (0,10 €), portée (2,5 m), quantité maximale.

## Ouvrir une boutique

- La touche d'action sur un meuble comptoir dont la brique est `{ "brick": "shop", "shop": "<id>" }`.
- Ou le commerçant: le champ `talk` du commerce ajoute « voir » à la fin de chacun de ses dialogues (`simulation/dialogues/commerce.ts`); un dialogue peut aussi porter l'effet `{ "type": "open_shop", "shop": "<id>" }` (fermé: l'option a un `when` `time_is`, et l'habitant le dit en dialogue).
- Événement `shop_opened`; l'interface montre `interface/boutique/`.

## Comptoir tenu (`"held": true` de la brique `shop`)

Le commerçant se tient derrière son comptoir, hors de portée de la touche d'action depuis le côté client. Sur un comptoir tenu, la touche s'adresse à lui (`counterKeeper`), s'il est debout à moins de `keeperReach` (1,5 m) de l'emprise du comptoir:

1. Il a une réplique d'HISTOIRE en attente pour ce joueur (`counterDialogue` de `dialogues/histoire.ts`): la bulle dit « Parler », cette réplique se joue (elle, et non la plus prioritaire), une fois, puis le comptoir vend.
2. Sinon la boutique s'ouvre (« Acheter »), au premier appui; l'écran de boutique garde « Parler » (touche P, intention `shop_talk`), qui ouvre la conversation ordinaire (la plus prioritaire d'abord) et referme la boutique chez ce joueur.

Seule l'histoire passe avant la boutique. Un commerçant a toujours quelque chose à dire (souvenirs, confidences, cadeaux, dons de plans, fêtes, première visite): si tout cela passait d'abord, on n'achèterait plus sans épuiser ses répliques. Ce reste se dit par « Parler » de la boutique, ou en face de lui hors du comptoir. Est de l'histoire, sans rien déclarer dans le dialogue (tout se lit dans les suites du lieu):

- le dialogue qu'une étape OUVERTE d'une suite en cours attend (`talked` de son `done`), ou qu'elle a ouvert (un `remember` de son `onStart` écrit le fait que le `when` du dialogue lit avec `equals`: la convention `"ouvert"` des suites d'Aubrune); l'étape franchie, il redevient une réplique ordinaire;
- la remise d'objets qu'une étape ouverte attend chez ce commerçant (`deliver`), quand ce joueur tient les objets;
- une décision à deux qui attend la réponse de ce joueur (elle repasse même déjà entendue);
- par exception, la réplique qui soulage sans rien demander un besoin à 0 du joueur (la soupe offerte à qui a faim et pas un sou: cahier 4.4, jamais de blocage sans issue).

Une fois: un dialogue `once` s'épuise; un dialogue à volonté ne repasse pas le jour où ce joueur l'a entendu (fait daté `entendu.<lieu>.<dialogue>.j<joueur>`). Un dialogue à volonté plus prioritaire que l'histoire (la remarque d'hygiène) la masque comme en face: la boutique s'ouvre.

La première écoute du jour d'une réplique d'histoire ou de quête n'est pas suivie de l'offre de la boutique (`shopOffered`), ni une réplique dite par-dessus le comptoir. Réentendue le même jour en parlant au commerçant en face (à portée de la touche d'action), elle débouche sur l'offre comme une conversation ordinaire: le fait « entendu » compte les écoutes du jour, sans champ nouveau dans l'état. Valable pour tout commerce: ajouter `"held": true` à la brique du comptoir. Test court: `tests/comptoir-tenu.test.ts`, `tests/decision-rappel.test.ts`. Test court: `tests/comptoir-tenu.test.ts` (trois dialogues en attente: un seul appui avant la boutique), `tests/decision-rappel.test.ts`.

## Paiement (`payment` d'un article)

`purse` (défaut): la bourse seule. `purse-or-chest`: au choix, le coffre commun d'abord puis la bourse (meubles). `household`: le coffre commun d'abord, complété par la bourse (pièces de la maison).

## Refus (`refused`, `target` = identifiant du commerce)

`gone`, `too-far`, `shop-closed`, `not-sold`, `locked` (article pas encore débloqué), `out-of-stock`, `pockets-full`, `not-enough-money`, `chest-not-allowed`, `not-wanted` (pas dans son métier), `not-enough-items`, `shop-cap-reached` (plafond d'achat du jour), `purse-full`, `already-owned` (pièce de tenue déjà à lui). Textes: `interface/boutique/textes.ts`.

## Vendre une tenue (brique `pieces`)

Une pièce de tenue s'achète comme un article, mais n'entre ni dans les poches ni dans un stock: elle va dans la garde-robe de l'acheteur seul (cahier 2.1, « chacun ses tenues »), qui la porte ensuite au miroir (brique `mirror`) ou par le carnet (onglet Tenues, « Changer de tenue »). Intention `shop_buy_piece` (`shop`, `piece`), de la bourse seule; événement `shop_piece_bought`, plus l'annonce `reward_given` (`kind: piece`, `by`: l'acheteur). Garde-robe: faits `garde-robe.piece.<id>.j<n>` (`regles/recompenses.ts`, `hasPiece`), sauvegarde et réseau inchangés. L'écran montre nom, description, emplacement et la vignette 3D de l'éditeur (à défaut un picto par emplacement); une pièce déjà à lui dit « À toi » et ne se rachète pas.

Recette d'ajout:

1. Vérifie que la pièce est au catalogue (`donnees/commun/personnages/catalogue.json`) avec l'étiquette `a-gagner` (sinon elle est déjà à tous: le chargement refuse).
2. Dans la fiche du commerce, ajoute à `pieces`: `{ "piece": "<id>", "price": <centimes> }` (modèle commenté: `donnees/_gabarits/commerce.jsonc`).
3. Facultatif: `"unlock": <condition>` pour ne la montrer qu'après un fait d'histoire ou une amitié.
4. `pnpm exec vitest run tests/tenues-boutique.test.ts`: l'échoppe factice du test prouve la brique; le chargement refuse une pièce inconnue, en double ou sans `a-gagner`.

Rien à toucher au moteur ni à l'interface. Une pièce de récompense (quête, cadeau d'un habitant) passe par l'effet `{ "type": "give_piece", "piece": "<id>" }` (`"to": "duo"` pour chacun des deux).

## Faits retenus (`faits.ts`)

Chaque achat et chaque vente écrivent dans la mémoire des faits, lue par les dialogues et les quêtes (clés: `SHOP_TUNING.facts`): `commerces.<commerce>.premier-achat.j<n>` et `premiere-vente.j<n>` (l'objet, daté du premier jour), `ventes.<commerce>.<objet>` (total vendu par le duo) et `.j<n>` (par joueur). Le validateur des quêtes les connaît (`shopFacts`): une faute de commerce ou d'objet est refusée au chargement. Test court: `tests/faits-briques.test.ts`.

## État

- `place.shops[<id>]` (tranche « lieu »): `day`, `spent` (rachats du jour), `sold[<objet>] = [début de période de réassort, vendus]`. Créé à la première écriture, remis au jour sans pas dédié.
- `progress.prices[<objet>][<commerce>] = centimes` (tranche « progression », par différences): prix de base vu à l'ouverture (objets que le joueur a sur lui) et à chaque vente. Commun au duo. 60 objets x 20 commerces au quart tiennent sous 10 Ko (`tests/commerces.test.ts`).

## Ajouter un commerce

`pnpm nouveau commerce <id> <lieu>`, remplir d'après le gabarit, poser un comptoir sur la carte ou ajouter l'effet `open_shop` au dialogue du commerçant. Aucun changement de moteur (test « commerce factice »).

## Répliques et commerce conditionnés (recette)

1. Répliques de comptoir: champ `lines` de la fiche (`bought`, `sold`, `noMoney`), plus `refusal` (ce qu'il ne rachète pas). L'écran de boutique les dit à l'achat, à la vente et aux refus `not-enough-money` et `not-wanted` (`shopSays`, `shopSaysRefusal`); sans réplique, son texte commun.
2. Rachat conditionné: `"unlock": <condition>` sur une ligne de `buys` (comme sur `sells`); faux, il n'en veut pas (`not-wanted`).
3. Commerce conditionné: `"when": [conditions]` sur la fiche; faux, il est fermé partout (comptoir, dialogue, achats, ventes: `shop-closed`).
   3 bis. Fermé un jour de fête: `"closes": { "shops": "all" }` (ou une liste) dans la fiche de l'événement, du début de la fête à l'aube suivante (`closedByEvent` de `monde/agenda.ts`). Le commerçant le dit en fin de conversation, à la place de l'offre, avec sa réplique `lines.closed` (« Fermé pour la fête »); sans elle, rien de plus. Test court: `tests/agenda-evenements.test.ts`.
4. En dialogue, « assez d'argent ? »: condition `{ "type": "money_at_least", "amount": <centimes> }` sur une option ou un nœud `branch`.
5. Rien à toucher au moteur. Test court: `tests/repliques-boutique.test.ts` (échoppe factice).
