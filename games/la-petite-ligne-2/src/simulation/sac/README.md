# Sac, barre et argent (lot L3)

`cases.ts`: désignation d'une case. La barre est toujours là (`toolbarSlots`), le sac vient ensuite (`sacs.json`); piles limitées par objet (`stack`); un outil amélioré porte son usure (`wear`).

- `inventaire.ts`: fonctions pures sur les cases (ajouter, retirer, compter, déplacer, place restante).
- `actions.ts`: `giveItem` / `giveStack` (ce qui ne rentre pas tombe au sol: `pockets_full`), `dropStack`, `equipBag`.
- `outils.ts`: usure (`wearTool`, à appeler par les briques à outil), état (`base`, `sharp`, `blunt`), durée d'un coup, réparation.
- `argent.ts`: centimes entiers, `formatEuros` (seule mise en forme des montants), bourse, coffre commun.
- `briques.ts`: briques `store` et `repair` pour le registre.
- `index.ts`: intentions `move_stack`, `drop`, `pick_up`, `give_stack`, `chest_deposit`, `chest_withdraw`, `store_put`, `store_take`; chaque refus part en `refused` avec sa raison.
