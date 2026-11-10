# Commerces (cahier 4.6, R34)

On ne vend qu'aux commerçants: chacun ne rachète que ce qui touche à son métier, à **son** prix (l'œuf à 0,60 € chez l'épicière, à 1,00 € chez le boulanger). Chaque joueur paie de sa bourse; le coffre commun paie les achats du foyer. Données: `donnees/lieux/<lieu>/commerces/<id>.json` (gabarit commenté `donnees/_gabarits/commerce.jsonc`, schéma `src/donnees/schemas/commerce.ts`). Le moteur ne nomme aucun commerce.

## Fichiers

- `prix.ts`: lecture pure (hôte, invité, interface): ouverture, prix de base (objet, coefficient de famille, famille), besoin du jour (tiré de la graine et du jour, payé `dailyNeedFactor` fois), bonus d'amitié (`friendship`), modificateur `sellPrice` des besoins (repas `better_prices`), stock et réassort, plafond du jour, mémoire des prix.
- `index.ts`: système `commerces`: intentions `shop_buy` (avec `chest` pour le coffre commun) et `shop_sell`, `openShop` (brique et effet de dialogue), `rememberPrice`.
- `brique.ts`: brique `shop` (comptoir), inscrite dans `briques/registre.ts`.
- `validation.ts`: contrôles appelés par `donnees/valider.ts` (objets connus, coefficient sans prix de famille, besoin du jour impossible, identifiant en double dans le jeu).
- `reglages.ts`: besoin du jour (x1,5), pas des prix (0,10 €), portée (2,5 m), quantité maximale.

## Ouvrir une boutique

- La touche d'action sur un meuble comptoir dont la brique est `{ "brick": "shop", "shop": "<id>" }`.
- Ou le commerçant: une option de son dialogue avec l'effet `{ "type": "open_shop", "shop": "<id>" }` (fermé: l'option a un `when` `time_is`, et l'habitant le dit en dialogue).
- Événement `shop_opened`; l'interface montre `interface/boutique/`.

## Paiement (`payment` d'un article)

`purse` (défaut): la bourse seule. `purse-or-chest`: au choix, le coffre commun d'abord puis la bourse (meubles). `household`: le coffre commun d'abord, complété par la bourse (pièces de la maison).

## Refus (`refused`, `target` = identifiant du commerce)

`gone`, `too-far`, `shop-closed`, `not-sold`, `locked` (article pas encore débloqué), `out-of-stock`, `pockets-full`, `not-enough-money`, `chest-not-allowed`, `not-wanted` (pas dans son métier), `not-enough-items`, `shop-cap-reached` (plafond d'achat du jour), `purse-full`. Textes: `interface/boutique/textes.ts`.

## État

- `place.shops[<id>]` (tranche « lieu »): `day`, `spent` (rachats du jour), `sold[<objet>] = [début de période de réassort, vendus]`. Créé à la première écriture, remis au jour sans pas dédié.
- `progress.prices[<objet>][<commerce>] = centimes` (tranche « progression », par différences): prix de base vu à l'ouverture (objets que le joueur a sur lui) et à chaque vente. Commun au duo. 60 objets x 20 commerces au quart tiennent sous 10 Ko (`tests/commerces.test.ts`).

## Ajouter un commerce

`pnpm nouveau commerce <id> <lieu>`, remplir d'après le gabarit, poser un comptoir sur la carte ou ajouter l'effet `open_shop` au dialogue du commerçant. Aucun changement de moteur (test « commerce factice »).
