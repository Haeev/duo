# Deux Tabliers: état du code

Démo branchée du 2026-11-08 (version 0.1.0, format du monde 2): les quatre chantiers (service, clientèle, aménagement, interface) jouent ensemble, du « On ouvre ? » au bilan, sur les quinze jours de la démo.

## Comment ça se joue

- Jour 1 (lundi, fermé): l'annonce, « Notre maison » (l'un écrit le nom, l'autre clique « C'est notre maison »), son prénom, puis le bilan du jour de repos et « À demain ».
- Chaque matin: l'écran du matin (météo, livraison, événement); « Commencer la journée » retourne la pancarte; quand les deux l'ont fait (ou que l'autre accepte « On ouvre ? » avec Entrée), le service commence. L'horloge est arrêtée avant.
- Service: un client arrive en tête de file; maintenir E sur la caisse prend sa commande (il paie, le ticket monte au rail). E sur le rail prend le ticket. On prépare (moulin maintenu, tasse de la pile, sous le groupe, E lance puis arrête l'extraction; buse maintenue, relâchée dans la zone; vitrine, plan, bouilloire), on pose sur le passe: le client prend son plateau et s'assoit, puis repart en laissant sa vaisselle sale sur la table (E pour la prendre, plonge maintenue pour laver).
- Le soir: le bilan (4 pages), « À demain » à deux. Le lundi suivant: brocante, travaux, aménagement (B). Jour 15: « Partir pour Mérelles ? », puis l'écran de fin; on peut rester jusqu'au jour 28.
- Touches (position des touches, AZERTY): ZQSD marcher, Maj vite, souris regarder, E ou clic gauche agir (maintenir pour les postes), R ou clic droit reposer, Tab tablette (ardoise, commandes, catalogue, bilans), B aménager (café fermé), A tourner le meuble, Retour arrière fermer, Entrée valider ou reprendre la souris, Échap pause de Duo.

## Branchement (`src/branchement/`)

- `index.ts`: le chantier `branchement`, entre la clientèle et l'aménagement dans `CHANTIERS`. Autorités: carte et prix de `donnees/clientele/carte.json` (prix de l'ardoise recopié dans chaque article), gestes de `donnees/service/recettes.json`; mêmes recettes et ingrédients aux identifiants près (`pain_chocolat` contre `pain-chocolat`, `serviceId`), vérifié par `tests/journee.test.ts`. Le stock de la clientèle fait foi pendant les jours ouverts; café fermé, le service garde le sien (on s'exerce sans rien vendre). Caisse en centimes dans la clientèle; l'aménagement y puise par `connectArrangementEconomy`.
- `interface.ts`: lecteurs `InterfaceSources` et table `IntentFor`; répliques et scènes nées des événements.
- Le panneau provisoire de l'aménagement (`amenagement/client/panneau.ts`, Tab en mode B) reste: la tablette montre aussi le catalogue (`catalogView` et équipements), l'achat passe par la même intention.

## Rendu et son

- Coque cuite `shell_village.glb` et ses extensions (carte de lumière en `lightMap`, `lightmap_scale` × π, × 0,42 pour la rue), matériaux de la coque en `MeshBasicMaterial`; la coque en blocs ne sert plus que si le GLB manque. Environnement des métaux: `RoomEnvironment` calculé une fois.
- Meubles, objets, personnages: correspondances dans `src/rendu/correspondances.ts` et `clientele/rendu3d.ts` (`char_*`). Avatars animés (marche, attente), badge à la couleur du joueur.
- Sons: `assets/son/sons.json` (fichiers tirés, bus, volume), boucles de la buse selon la température, nappe de rumeur selon le nombre de clients, ambiance de la place, radio du village à deux stations pendant le service.

## Preuves

- `pnpm --filter deux-tabliers test`: 15 tests en quelques secondes, dont `journee.test.ts` (une journée accélérée à deux joueurs: commande à la caisse, ticket, geste « Parfait », service, encaissement, bilan, lendemain).
- Faux hôte (`deux-vues.html`): parcours à deux par l'interface jusqu'au service, geste au moulin et à la machine, tablette, bilan (captures du 2026-11-08).

## Limites connues et suites

- Sons non placés dans l'espace; pas de pas, ni de rumeur par table, ni d'événements de la place tirés au hasard.
- Les revêtements achetés teignent la peinture de la salle; papiers peints et sols ne changent pas encore la texture de la coque cuite.
- Les avatars ne s'assoient pas et ne portent rien visiblement; les clients au comptoir boivent sans tasse posée devant eux.
- Le bilan ne nomme pas encore les habitués venus ni ce qui a plu ou manqué (pages vides proprement).
- Lot JavaScript de 1,37 Mo (364 Ko compressé): Three.js entier, à découper plus tard.
- Prise d'objet non prédite chez l'invité (un aller-retour), comme au squelette.
