# Deux Tabliers: état du code

Démo branchée du 2026-11-08 (version 0.1.0, format du monde 2): les quatre chantiers (service, clientèle, aménagement, interface) jouent ensemble, du « On ouvre ? » au bilan, sur les quinze jours de la démo.

## Comment ça se joue

- Jour 1 (lundi, fermé): l'annonce, « Notre maison » (l'un écrit le nom, l'autre clique « C'est notre maison »), son prénom, puis le bilan du jour de repos et « À demain ».
- Chaque matin: l'écran du matin (météo, livraison, événement); « Commencer la journée » retourne la pancarte; quand les deux l'ont fait (ou que l'autre accepte « On ouvre ? » avec Entrée), le service commence. L'horloge est arrêtée avant.
- Service: un client arrive en tête de file (rangs à 0,6 m le long du mur est, cinq personnes au plus); maintenir E sur la caisse prend sa commande (il paie, le ticket monte au rail). Personne ne bloque la file: pas servi au bout de 20 s à la caisse avec du monde derrière, le client s'écarte au zinc (un habitué le dit), puis revient juste derrière la tête 30 s plus tard (`queue` de `regles.json`). E sur le rail prend le ticket. On prépare (moulin maintenu, tasse de la pile, sous le groupe, E lance puis arrête l'extraction; buse maintenue, relâchée dans la zone; vitrine, plan, bouilloire), on pose sur le passe: le client prend son plateau et s'assoit, puis repart en laissant sa vaisselle sale sur la table (E pour la prendre, plonge maintenue pour laver).
- Le soir: le bilan (4 pages; « Ce qu'on retient »: visites des habitués servis, ce qui a plu aux clients ravis, ce qui a manqué aux déçus et aux groupes pas entrés ou repartis, comptés dans `today` du domaine clientèle), « À demain » à deux. Le lundi suivant: brocante, travaux, aménagement (B). Jour 15: « Partir pour Mérelles ? », puis l'écran de fin; on peut rester jusqu'au jour 28.
- Touches (position des touches, AZERTY): ZQSD marcher, Maj vite, souris regarder, E ou clic gauche agir (maintenir pour les postes), R ou clic droit reposer, G faire signe (geste de l'événement du jour: le chauffeur du car, la réparation à deux, la surprise des mariés; sinon quelques mots au client le plus proche, qui compte pour les habitués), Tab tablette (ardoise, commandes, catalogue, bilans), B aménager (café fermé), A tourner le meuble, Retour arrière fermer, Entrée valider, reprendre la souris ou passer une réplique (une réplique simple passe aussi seule une fois lue; E, Espace et le clic agissent toujours dans le café), Échap pause de Duo.

## Branchement (`src/branchement/`)

- `index.ts`: le chantier `branchement`, entre la clientèle et l'aménagement dans `CHANTIERS`. Autorités: carte et prix de `donnees/clientele/carte.json` (prix de l'ardoise recopié dans chaque article), gestes de `donnees/service/recettes.json`; mêmes recettes et ingrédients aux identifiants près (`pain_chocolat` contre `pain-chocolat`, `serviceId`), vérifié par `tests/journee.test.ts`. Le stock de la clientèle fait foi pendant les jours ouverts; café fermé, le service garde le sien (on s'exerce sans rien vendre). Caisse en centimes dans la clientèle; l'aménagement y puise par `connectArrangementEconomy`.
- `interface.ts`: lecteurs `InterfaceSources` et table `IntentFor`; répliques et scènes nées des événements.
- Le panneau provisoire de l'aménagement (`amenagement/client/panneau.ts`, Tab en mode B) reste: la tablette montre aussi le catalogue (`catalogView` et équipements), l'achat passe par la même intention.

## Rendu et son

- Coque cuite `shell_village.glb` et ses extensions (carte de lumière en `lightMap`, `lightmap_scale` × π, × 0,42 pour la rue), matériaux de la coque en `MeshBasicMaterial`; la coque en blocs ne sert plus que si le GLB manque. Environnement des métaux: `RoomEnvironment` calculé une fois.
- Meubles, objets, personnages: correspondances dans `src/rendu/correspondances.ts` et `clientele/rendu3d.ts` (`char_*`). Allure des clients de passage tirée par la simulation parmi les modèles de leur profil, sans répétition proche (`looks`, `lookWindow` de `regles.json`). Avatars animés (marche, attente), badge à la couleur du joueur. Clips mélangés par `rendu/melange.ts` (somme des poids à 1: jamais la pose de liaison).
- Programmes WebGL (budget 12): verre à deux faces en une passe, badge sur le programme des personnages, substituts des clients cachés tant qu'aucun modèle ne manque. Relevé du 2026-11-08 au premier écran: 4 chez l'hôte, 7 chez l'invité.
- Sons: `assets/son/sons.json` (fichiers tirés, bus, volume), boucles de la buse selon la température, nappe de rumeur selon le nombre de clients, ambiance de la place, radio du village à deux stations pendant le service.

## Preuves

- `pnpm --filter deux-tabliers test`: 20 tests en une douzaine de secondes, dont `file.test.ts` (file qui ne bloque pas, écarts, allures, bilan), `melange.test.ts` (clips) et `journee.test.ts` (une journée accélérée à deux joueurs: commande à la caisse, ticket, geste « Parfait », service, encaissement, bilan, lendemain).
- Faux hôte (`deux-vues.html`): parcours à deux par l'interface jusqu'au service, geste au moulin et à la machine, tablette, bilan (captures du 2026-11-08).

## Limites connues et suites

- Sons non placés dans l'espace; pas de pas, ni de rumeur par table, ni d'événements de la place tirés au hasard.
- Les revêtements achetés teignent la peinture de la salle; papiers peints et sols ne changent pas encore la texture de la coque cuite.
- Les avatars ne s'assoient pas et ne portent rien visiblement; les clients au comptoir boivent sans tasse posée devant eux.
- Lot JavaScript de 1,37 Mo (364 Ko compressé): Three.js entier, à découper plus tard.
- Prise d'objet non prédite chez l'invité (un aller-retour), comme au squelette.
