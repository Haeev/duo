# Deux Tabliers: état du code

Démo branchée du 2026-11-08 (version 0.1.0, format du monde 2): les quatre chantiers (service, clientèle, aménagement, interface) jouent ensemble, du « On ouvre ? » au bilan, sur les quinze jours de la démo.

## Comment ça se joue

- Jour 1 (lundi, fermé): l'annonce, « Notre maison » (l'un écrit le nom, l'autre clique « C'est notre maison »), son prénom, puis le bilan du jour de repos et « À demain ».
- Chaque matin: l'écran du matin (météo, livraison, événement); « Commencer la journée » retourne la pancarte; quand les deux l'ont fait (ou que l'autre accepte « On ouvre ? » avec Entrée), le service commence. L'horloge est arrêtée avant.
- Service: un client arrive en tête de file (rangs à 0,6 m le long du mur est, cinq personnes au plus); maintenir E sur la caisse prend sa commande (il paie, le ticket monte au rail). Personne ne bloque la file: pas servi au bout de 20 s à la caisse avec du monde derrière, le client s'écarte au zinc (un habitué le dit), puis revient juste derrière la tête 30 s plus tard (`queue` de `regles.json`). E sur le rail prend le ticket. On prépare (moulin maintenu, tasse de la pile, sous le groupe, E lance puis arrête l'extraction; buse maintenue, relâchée dans la zone; vitrine, plan, bouilloire), on pose sur le passe: le client prend son plateau et s'assoit, puis repart en laissant sa vaisselle sale sur la table (E pour la prendre, plonge maintenue pour laver).
- Le soir: le bilan (4 pages; « Ce qu'on retient »: visites des habitués servis, ce qui a plu aux clients ravis, ce qui a manqué aux déçus et aux groupes pas entrés ou repartis, comptés dans `today` du domaine clientèle), « À demain » à deux. Le lundi suivant: brocante, travaux, aménagement (B). Jour 15: « Partir pour Mérelles ? », puis l'écran de fin; on peut rester jusqu'au jour 28.
- Touches (position des touches, AZERTY): ZQSD marcher, Maj vite, souris regarder, E ou clic gauche agir (maintenir pour les postes), R ou clic droit reposer, G faire signe (geste de l'événement du jour: le chauffeur du car, la réparation à deux, la surprise des mariés; sinon quelques mots au client le plus proche, qui compte pour les habitués), Tab tablette (ardoise, commandes, catalogue, bilans), B aménager (café fermé), A tourner le meuble, Retour arrière fermer, Entrée valider, reprendre la souris ou passer une réplique (une réplique simple passe aussi seule une fois lue; E, Espace et le clic agissent toujours dans le café), Échap pause de Duo.

## Gestion du café (réalisme v0.2, `docs/jeux/cosy-cafe/demo/realisme-v0-2.md`)

- Argent: la marchandise se paie à la livraison du matin (cartons et port sous le franco), la vente rapporte son prix entier; la commande de la prochaine livraison est mise de côté dans la caisse (`availableCents`, « dont … réservés »). Dépannage par Mireille pour tout ingrédient, carton entier à +30 %. Réserve de Simone offerte au jour 1 (`startStock`). Charges détaillées (9 € par jour ouvert), pas de TVA (dit au bilan), pas de cotisations.
- Fournisseurs: jours de passage, franco et port (`fournisseurs.json`); la commande du soir vaut pour le prochain jour ouvert, personne ne livre le lundi; commande habituelle jusqu'au prochain passage, fête comprise (`suggestedOrder`).
- Stock: lots datés (`world.clientele.lots`), vendus du plus ancien au plus récent, périmé jeté le matin (« Perdu » au bilan), panier du soir payé et plafonné à 6 points; `stock` reste la somme des lots (`reconcileLots` à chaque pas: tickets rendus, sauvegardes v0.1).
- Écrans: « Commandes pour mardi » (passages, port, conditionnement, réserve du soir datée), « Carte et prix » (revient et marge), bilan ligne par ligne dont le résultat est la somme. Sauvegardes au format 3; le format 2 se relit sans perte.

## Remises et marketing (P0, `docs/jeux/cosy-cafe/demo/remises-marketing-v0-2.md`)

- Simulation pure: `src/clientele/remises.ts` (heure douce, carte de fidélité, tarif randonneur, offre du jour, actions P0 avec effet décroissant et plafond, lassitude, compteur « Venus grâce à », mots du livre d'or), branchée dans `clients.ts` (prix payé, satisfaction, compteur), `journee.ts` (attrait heure par heure, ouverture et soir, ligne « Publicité » du résultat) et `scenes.ts` (`dayAffluence`). Intentions `clientele-discounts` et `clientele-campaign`; une action de 30 € ou plus est proposée à l'autre (`proposals`, réponse `clientele-answer`).
- Lecteurs: `src/branchement/remises.ts` (`DiscountsView`, `MarketingView`, lignes de l'ardoise, du ticket et du bilan dans `modele.ts`). Rendu provisoire: deux sections de la tablette (`src/interface/tablette-remises.ts`, à porter dans le téléphone), remises en tête de l'ardoise et prix barrés pendant l'heure douce, lignes du ticket, « Publicité », « Remises consenties » et « Ce qui a fait venir du monde » au bilan. Commandes: « Dépannage par Mireille » sur une ligne en rupture pendant le service.
- Aperçu: `src/interface/apercu/index.html#tablette-remises`, `#tablette-faire-connaitre`, `#ardoise-remises`, `#ticket-remises`, `#bilan-remises`, `#tablette-commandes-rupture` (vrais lecteurs sur une vraie maison pour les quatre premiers).
- Pas encore: formules et actions P1, petit marché visible, bilan de la semaine par action (`week.marketing`), astuces de Simone sur les remises, avertissement de la veille quand une remise tombe le jour de la fête (seul l'onglet prévient).

## Branchement (`src/branchement/`)

- `index.ts`: le chantier `branchement`, entre la clientèle et l'aménagement dans `CHANTIERS`. Autorités: carte et prix de `donnees/clientele/carte.json` (prix de l'ardoise recopié dans chaque article), gestes de `donnees/service/recettes.json`; mêmes recettes et ingrédients aux identifiants près (`pain_chocolat` contre `pain-chocolat`, `serviceId`), vérifié par `tests/journee.test.ts`. Le stock de la clientèle fait foi pendant les jours ouverts; café fermé, le service garde le sien (on s'exerce sans rien vendre). Caisse en centimes dans la clientèle; l'aménagement y puise par `connectArrangementEconomy`.
- `interface.ts`: lecteurs `InterfaceSources` et table `IntentFor`; répliques et scènes nées des événements.
- Le panneau provisoire de l'aménagement (`amenagement/client/panneau.ts`, Tab en mode B) reste: la tablette montre aussi le catalogue (`catalogView` et équipements), l'achat passe par la même intention.

## Rendu et son

- Coque cuite `shell_village.glb` et ses extensions (carte de lumière en `lightMap`, `lightmap_scale` × π, × 0,42 pour la rue), matériaux de la coque en `MeshBasicMaterial`; la coque en blocs ne sert plus que si le GLB manque. Environnement des métaux: `RoomEnvironment` calculé une fois.
- Meubles, objets, personnages: correspondances dans `src/rendu/correspondances.ts` et `clientele/rendu3d.ts` (`char_*`). Allure des clients de passage tirée par la simulation parmi les modèles de leur profil, sans répétition proche (`looks`, `lookWindow` de `regles.json`). Avatars animés (marche, attente), badge à la couleur du joueur. Clips mélangés par `rendu/melange.ts` (somme des poids à 1: jamais la pose de liaison).
- Programmes WebGL (budget 12): verre à deux faces en une passe, badge sur le programme des personnages, substituts des clients cachés tant qu'aucun modèle ne manque. Relevé du 2026-11-08 au premier écran: 4 chez l'hôte, 7 chez l'invité.
- Sons: `assets/son/sons.json` (fichiers tirés, bus, volume), boucles de la buse selon la température, nappe de rumeur selon le nombre de clients, ambiance de la place, radio du village à deux stations pendant le service. Sons placés dans l'espace (`src/audio/espace.ts`, champ `spatial`): postes, caisse, porte et gestes de l'autre atténués avec la distance et placés à gauche ou à droite selon le regard; ambiances, radio et interface partout.
- Assises (`src/etat/assises.ts`, pur): point d'assise déclaré dans `modeles.json` (`assises`), tourné comme le meuble; banc et tabourets sans dossier tournés vers leur table. Une place par assise déclarée, dans la limite du catalogue (`seats.count`): banquette de trois, banc de ferme de deux; place nommée `meuble` (la plus proche de la table) puis `meuble#1`, `meuble#2`; la clientèle (`seatList`) compte des places. Clients: approche et départ par un point libre devant, à côté ou derrière l'assise, jamais à travers la table. Pose (`src/rendu/assis.ts`): fesses sur l'assise et bassin au-dessus du point d'assise, mesurés par modèle et par clip (`sit_rest`, `sit_drink`), cuisses baissées pour poser les pieds (dans une limite). Pose calme `sit_rest`: première image de `sit`, buste droit, mains sur les cuisses (le reste du clip se penche tête vers la table). Gestes (`src/clientele/gestes.ts`, pur): un client ne boit que sa boisson servie; tasse ou verre posé devant lui sur la table, dans sa main pendant la gorgée (milieu de `sit_drink`), puis reposé; sinon il attend et tourne la tête vers son voisin ou le comptoir (`reglages.json`, `seating`). Avatars: E sur une place libre (mains vides) pour s'asseoir, la place visée sur une banquette, un pas pour se relever; assise transmise à l'invité dans le canal du cœur (`seats`).
- Revêtements: papiers peints et sols du catalogue texturés sur la coque cuite (`variantes_coque` de `modeles.json`), peinture en teinte sur l'enduit.

## Preuves

- `pnpm --filter deux-tabliers test`: 63 tests en une douzaine de secondes, dont `remises.test.ts` (critères RM des remises et du marketing), `file.test.ts` (file qui ne bloque pas, écarts, allures, bilan), `melange.test.ts` (clips) et `journee.test.ts` (une journée accélérée à deux joueurs: commande à la caisse, ticket, geste « Parfait », service, encaissement, bilan, lendemain).
- Faux hôte (`deux-vues.html`): parcours à deux par l'interface jusqu'au service, geste au moulin et à la machine, tablette, bilan (captures du 2026-11-08).

## Limites connues et suites

- Pas de pas, ni de rumeur par table, ni d'événements de la place tirés au hasard.
- Les avatars ne portent rien visiblement; au zinc, la tasse reste dans la main du client (pas posée sur le comptoir).
- Banc de départ (`banc`, meuble de Simone hors catalogue): une place, faute de nombre de places au catalogue, alors que son modèle (`banc_ferme`) en déclare deux.
- Bout de banquette au-delà de la table: pendant la gorgée, les mains du clip passent devant, au-dessus du vide.
- Clients au pique-nique de la fontaine: assis au sol (hauteur du rebord non déclarée).
- Lot JavaScript de 1,37 Mo (364 Ko compressé): Three.js entier, à découper plus tard.
- Prise d'objet non prédite chez l'invité (un aller-retour), comme au squelette.
