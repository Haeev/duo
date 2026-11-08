# Deux Tabliers, démo v0.2: une gestion de café réaliste

| Champ | Valeur |
|---|---|
| Statut | proposition du game designer, à relire par le manager, puis à faire valider par le client |
| Base | démo v0.1 publiée (`games/deux-tabliers`), `demo-v0-1.md`, recette de la nuit `recette/2026-11-08-nuit.md` |
| Simulation | `docs/jeux/cosy-cafe/demo/simulations/demo_v0_2.py` (4 parties par duo et par ordre d'achat, 5 s) |
| Demande du client | « l'aspect commande, stock, etc., bref très réaliste aussi », en restant amusant et jouable à deux |

## 1. En une phrase

Ce que tu commandes, tu le paies quand le carton arrive; ce que tu n'as pas vendu à temps se perd; chaque fournisseur passe ses jours à lui: la commande du soir devient une vraie décision à deux, comme dans un vrai café de village, sans jamais bloquer le service.

Ce qu'on doit ressentir: « on tient notre affaire ». Le soir, on regarde la réserve, on se dit « Armelle ne repasse que jeudi, on prend deux caisses de lait ? », et le bilan dit enfin d'où vient l'argent et où il part.

## 2. Ce qui sonne faux aujourd'hui (audit du code de la v0.1)

Constats vérifiés dans le code et les données:

1. **La marchandise est gratuite.** `deliver` (`src/clientele/economie.ts`) ajoute les cartons au stock sans rien débiter. Le coût des matières est débité à la vente (`clients.ts`, `cash += amount - materials`). La tablette affiche pourtant un prix et un total de commande (`tablette.ts`, `T.tablet.orders.total`) que personne ne paie: commander dix cartons de trop ne coûte rien.
2. **Rien ne se périme**, sauf ce qui a `shelfDays` 1 au plus, vidé chaque soir (`journee.ts`, `evening`). `shelfDays` 7 du lait, 4 de la menthe: lus nulle part. Pas de lots, pas de dates, pas de premier entré premier sorti.
3. **Le panier du soir est une machine à réputation.** Les invendus du boulanger sont donnés contre 1 point chacun, 20 par jour au plus, et ils n'ont rien coûté: commander trop de croissants rapporte jusqu'à 240 points gratuits sur la démo (la première demi-tasse en demande 150).
4. **Tous les fournisseurs passent tous les matins**, sans port, sans minimum, même le lundi si une commande attend. Rien à prévoir.
5. **Conditionnements muets**: « Lait entier: 6000 ml », « Thé noir en vrac (une dose): 50 ». Le joueur ne voit ni caisse de six bouteilles, ni boîte de thé.
6. **Durées de conservation peu crédibles**: beurre et œufs à 14 jours (plutôt 30 et 28), pain de campagne et tarte à 1 jour (2 en vrai), lait d'avoine à 10 jours (une brique fermée tient des mois).
7. **Le bilan ne se lit pas.** Il montre Recette, Pourboires, Achats du jour et Résultat; le résultat retire aussi les matières, le loyer et les charges, qui ne sont affichés nulle part (`bilan.ts`). « 153 + 12 - 0 = 115 » laisse perplexe.
8. **Charges opaques**: 8 € par jour ouvert, sans détail.
9. **Pas de stock au départ**: Simone laisse 300 € « pour le premier lait », mais pas un grain dans la réserve.
10. **Le dépannage ne couvre que l'épicerie**: plus de lait à 10 h et le café crème reste grisé jusqu'au soir.
11. **Coût de revient et marge** connus des données (`costMaterials`) mais invisibles à l'écran « Carte et prix ».

Ce qui est déjà juste et qu'on garde: commande habituelle proposée par la tablette (jamais bloquant), cartons lourds à porter à deux, rupture grisée sur l'ardoise, pourboires (5 à 10 %, une fois sur deux), dépannage à +30 % livré dans l'heure, loyer de village (520 € par mois), plonge et inspection.

## 3. Comparaison avec un vrai petit café de village

| Sujet | Dans la v0.1 | Dans un vrai café | Proposition | Coût en plaisir | Priorité |
|---|---|---|---|---|---|
| Paiement des fournisseurs | gratuit, matières débitées à la vente | facture à la livraison (boulanger, laitière) ou en fin de mois | payé à la livraison, au carton | gain: commander devient un choix; aucune manipulation en plus | **P0-1** |
| Stock de départ | vide | on reprend la réserve du café | la réserve de Simone, offerte | gain: premier soir moins serré | **P0-1** |
| Jours de livraison | tous les jours | chaque fournisseur a sa tournée | jours par fournisseur, commande calculée jusqu'au prochain passage | gain fort: la décision à deux du soir, surtout avant le week-end et la fête | **P0-2** |
| Port et franco | aucun | port sous un minimum, offert au-delà | port et franco pour Joseph et Armelle | léger: une ligne « encore 6,40 € pour le port offert » | **P0-2** |
| Conditionnement réel | unités brutes | sac d'1 kg, caisse de 6 L, boîte de 12 œufs | noms et colonnes au conditionnement | nul: c'est de l'affichage | **P0-2** |
| Dépannage | épicerie seule | l'épicière du village dépanne de tout | Mireille dépanne de tout, +30 % | gain: aucune recette grisée toute une journée sans recours | **P0-2** |
| Dates de péremption | aucune | DLC sur le frais, DDM sur le sec | lots datés, DLC réalistes, perte du périmé | moyen: sans geste à faire, seulement une info et une perte modérée (5 à 7 % du livré) | **P0-3** |
| Premier entré premier sorti | sans objet | rotation à la main | automatique | nul | **P0-3** |
| Invendus du jour | donnés contre de la réputation, gratuits | donnés ou jetés, payés | panier du soir payé, plafonné à 6 points | retire un abus, garde le geste chaleureux | **P0-3** |
| Inventaire du soir | rien | on compte la réserve | « La réserve ce soir »: quantités et dates, automatique | gain: on voit quoi commander | **P0-3** |
| Coût de revient et marge | invisibles | le patron les connaît par cœur | affichés à « Carte et prix » | gain: le réglage des prix a du sens | **P0-4** |
| Bilan lisible | lignes manquantes | compte du jour | toutes les lignes, résultat qui se recompte | gain | **P0-4** |
| Charges réalistes | 8 € opaques | électricité, eau, assurance, banque, droits de la radio | détail chiffré, 9 € par jour ouvert | nul | **P0-4** |
| TVA | absente | petit café sous le seuil de la franchise en base: pas de TVA facturée | on garde sans TVA, et on le dit au bilan | nul | **P0-4** (texte) |
| Cotisations sociales | absentes | micro-entreprise: un pourcentage des recettes | 12,3 % des recettes, compensé par des prix 2026 | à équilibrer par simulation avant de le faire | P1 |
| Capacité du frigo | illimitée | armoire de 400 L, vitrine | capacité en caisses de lait, le réfrigérateur vitré l'agrandit | moyen: une contrainte de plus à la commande | P1 |
| Fermeture à deux | propreté fixe (8) | purge des groupes, bac à marc, sol, plonge | trois gestes courts du soir qui montent la propreté du lendemain | gain si court et à deux; jamais de pénalité sous 6 | P1 |
| Fond de caisse | « réserve » de deux jours de charges | fond de caisse en monnaie, intouchable | renommer la réserve « Fond de caisse », même valeur | nul | P1 |
| Rupture à l'ardoise | ligne grisée | « Plus de tarte, désolé ! » à la craie | mot à la craie, Simone propose le dépannage | gain | P1 |
| Partage de la commande | les deux sur la même liste | souvent l'un fait le frais, l'autre l'épicerie | carnet partagé: chaque joueur signe ses fournisseurs | gain de communication | P1 |
| Mouture | aucune | se règle selon l'humidité | pluie: extraction plus rapide, un cran de moulin à deux | intéressant mais demande des gestes nouveaux | P2 |
| Lait ouvert | sans objet | 3 jours après ouverture | une bouteille entamée à finir | trop fin pour la démo | P2 |
| Relevé des températures | aucun | relevé du frigo le matin (hygiène) | une coche du matin liée à l'inspection | faible | P2 |
| Espèces et carte | une seule caisse | monnaie et terminal | rendre la monnaie en un geste | risque de corvée | P2 |
| Promotions fournisseur | aucune | sac de 5 kg moins cher | prix dégressif au volume chez Joseph | décision de trésorerie | P2 |

**Hors périmètre**, explicitement: déclarations et comptabilité (URSSAF, TVA réelle, bilan annuel), licence de débit de boissons, alcool, salariés, banque et emprunt, vols et casse aléatoires (punitifs sans décision).

## 4. Les P0 (ce matin, 2 h de développement au plus)

Estimation: P0-1 25 min, P0-2 35 min, P0-3 40 min, P0-4 20 min. Ordre conseillé: P0-1, P0-4 (affichage du bilan), P0-2, P0-3. Chacun se livre seul: P0-1 et P0-4 suffisent à rendre l'argent juste si le temps manque.

Les fichiers du service (`donnees/service/ingredients.json`) doublent ceux de la clientèle aux identifiants près (`lait_entier` et `lait-entier`): toute valeur changée ci-dessous dans `clientele/fournisseurs.json` se change aussi au service (le test de branchement compare les deux). `donnees/SCHEMA.md` se met à jour avec chaque clé nouvelle.

### P0-1 La marchandise se paie à la livraison

**Règles.**
- À la livraison du matin (et à l'arrivée d'un dépannage), la caisse est débitée de: somme des cartons x `cartonUnits` x `unitCost`, plus le port (P0-2). En centimes, arrondi par ligne.
- À la vente, plus aucun débit de matières: `cash += amount`. `today.materials` reste calculé (coût des ventes), pour l'affichage de la marge seulement.
- Dépannage: débit du carton entier à `1 + emergencySurcharge` (aujourd'hui seul le supplément de 30 % est débité, la marchandise est gratuite).
- La commande envoyée (ou, à défaut, la commande habituelle) est **réservée** dans la caisse: `availableCents` retire aussi son total. Un achat du soir ne peut donc pas manger l'argent du lait de demain. L'affichage « dont {amount} réservés » existant le montre déjà.
- Si la caisse ne suffit pas au matin (cas rare: commande envoyée puis gros achat refusé, ou dépannages), la livraison a lieu quand même et le manque passe en « à régler » par le mécanisme existant (EC-06). Jamais de livraison refusée.
- **La réserve de Simone**: à la création de la partie, ces lots sont en réserve, gratuits, datés du jour 2:

| Ingrédient (`fournisseurs.json`) | Cartons offerts | Valeur | Raison |
|---|---|---|---|
| `grains_maison` | 2 | 40,00 € | deux sacs pour la première semaine |
| `cacao` | 1 | 12,00 € | boîte entamée |
| `the_noir` | 1 | 9,00 € | une boîte |
| `sucre` | 1 | 4,00 € | |
| `confiture` | 1 | 4,00 € | pot de Simone |
| `accompagnement` | 1 | 12,00 € | sucres et carrés de chocolat |
| `beurre` | 1 | 4,00 € | |

Total 85 € (la simulation offre ce qui se garde au moins 8 jours dans la première commande, soit 90 € en médiane: écart négligeable). Le frais (lait, viennoiseries, pain, tartes) reste à commander le jour 1: le tutoriel de la première commande garde son sens.

**Données.**
- `clientele/economie.json`: nouvelle clé `startStock`: `[["grains_maison", 2], ["cacao", 1], ["the_noir", 1], ["sucre", 1], ["confiture", 1], ["accompagnement", 1], ["beurre", 1]]`.
- `clientele/fournisseurs.json`, `ordering.emergencySurcharge`: 0,3, inchangé, mais il s'applique maintenant au prix entier (prix payé = 1,3 fois le carton).

**Textes.**

| Clé | Avant | Après |
|---|---|---|
| `tablet.orders.intro` | « Livrées demain à 7 h, à la porte de service. « Habituelle » : d'après vos trois dernières journées et l'ardoise prévue. » | « Chaque fournisseur passe ses jours à lui, vers 7 h. Tu paies à la livraison. « Habituelle » : de quoi tenir jusqu'à son prochain passage, d'après vos trois dernières journées et les fêtes annoncées. » |
| `tablet.orders.total` | « Total : {amount} » | « À payer à la livraison : {amount} » |
| `tablet.orders.emergency` | « Dépannage chez Mireille : livré dans l'heure, +30 % » | « Dépannage par Mireille : livré dans l'heure, payé 30 % plus cher » |
| nouveau `tablet.orders.reserved` | | « Mis de côté pour cette commande : {amount} » |
| nouveau `prologue` (réplique de Simone, après la visite de la réserve) | | « Je vous laisse la réserve : du café, du thé, du sucre. Le frais, c'est à vous de le commander. » |

### P0-2 Fournisseurs: jours de passage, port, conditionnements

**Règles.**
- La commande du soir vaut pour le **prochain jour ouvert** (dimanche soir et lundi: pour le mardi). Seuls les fournisseurs qui passent ce jour-là livrent; les autres lignes sont en lecture seule, avec le jour de leur prochain passage.
- Le lundi, personne ne livre (aujourd'hui, une commande passée le dimanche soir arrive le lundi). La commande reste en attente jusqu'au mardi.
- **Port**: si le total d'un fournisseur est sous son franco, son port s'ajoute à la livraison. Le tableau affiche, par fournisseur, ce qui manque pour le franco.
- **Commande habituelle** (`suggestedOrder`), par ingrédient dont le fournisseur passe au jour N:
  - couverture = les jours ouverts de N jusqu'à la veille du prochain passage de ce fournisseur, limités à la conservation (un lot livré le jour N sert jusqu'au jour N + `shelfDays` - 1);
  - besoin = somme, sur ces jours, de la consommation moyenne d'un jour ouvert (trois derniers jours, sinon 14 portions par recette de l'ardoise, comme aujourd'hui) multipliée par l'affluence annoncée du jour (`challenge.affluence` 1,6 le jour de la fête), puis par `margin` (1,2), ou par `freshMargin` (1,1) si `shelfDays` vaut 2 au plus;
  - cartons = arrondi au-dessus de (besoin - stock encore bon au dernier jour couvert) / `cartonUnits`.
- **Dépannage**: possible pour tout ingrédient, pendant le service, par Mireille (`emergency: true` pour les cinq fournisseurs: changement de données seulement), livré en 60 minutes de jeu, prix x 1,3, sans port.

**Données: `clientele/fournisseurs.json`, `suppliers[]`** (clés nouvelles `days`, `franco`, `shipping`; weekdays au format de `journees.json`):

| `id` | `days` | `franco` (€) | `shipping` (€) | `emergency` | Raison |
|---|---|---|---|---|---|
| `lucas` | tue, wed, thu, fri, sat, sun | 0 | 0 | true | boulanger de la place, il traverse la ruelle chaque matin; fermé le lundi comme le café |
| `armelle` | tue, thu, sat | 15 | 3 | true | tournée de laitière trois fois par semaine; le samedi couvre la fête du dimanche |
| `joseph` | tue, fri | 30 | 5 | true | le torréfacteur de la vallée fait sa tournée deux fois par semaine; le port pousse à regrouper café et thé |
| `mireille` | tue, wed, thu, fri, sat, sun | 0 | 0 | true | épicerie à deux pas |
| `simone_jardin` | tue, wed, thu, fri, sat, sun | 0 | 0 | true | Simone passe tous les matins |

`ordering`: nouvelle clé `freshMargin`: 1,1 (`margin` reste 1,2). Plage conseillée: `margin` 1,1 à 1,4, `freshMargin` 1,0 à 1,2 (la simulation montre que monter les marges ne retire presque pas de ruptures: elles viennent surtout des recettes nouvelles sans historique).

**Données: noms au conditionnement** (`ingredients[].name`, et une clé nouvelle `pack`, libellé court du carton pour la colonne):

| `id` | `name` (nouveau) | `pack` | `cartonUnits` | Prix du carton |
|---|---|---|---|---|
| `grains_maison` | Grains, mélange de la vallée | sac d'1 kg | 1000 | 20,00 € |
| `lait_entier` | Lait entier de la ferme | caisse de 6 bouteilles d'1 L | 6000 | 7,80 € |
| `lait_avoine` | Lait d'avoine | 3 briques d'1 L | 3000 | 8,40 € |
| `beurre` | Beurre doux | 2 plaquettes de 250 g | 500 | 4,00 € |
| `oeufs` | Œufs de la ferme | boîte de 12 | 12 | 3,00 € |
| `cacao` | Chocolat en poudre | boîte d'1 kg | 1000 | 12,00 € |
| `the_noir` | Thé noir en vrac | boîte de 50 doses | 50 | 9,00 € |
| `the_vert` | Thé vert en vrac | boîte de 50 doses | 50 | 11,00 € |
| `plantes_simone` | Plantes du jardin de Simone | 20 bouquets | 20 | 2,00 € |
| `menthe` | Menthe du jardin | botte de 20 brins | 20 | 1,00 € |
| `oranges` | Oranges à presser | cagette de 30 | 30 | 9,00 € |
| `citrons` | Citrons | filet de 20 | 20 | 5,00 € |
| `sucre` | Sucre en poudre | 2 paquets d'1 kg | 2000 | 4,00 € |
| `farine` | Farine de blé | sac de 5 kg | 5000 | 6,00 € |
| `confiture` | Confiture d'abricot | 2 pots de 500 g | 1000 | 4,00 € |
| `limonade_bouteille` | Limonade de la vallée | casier de 12 bouteilles | 12 | 13,20 € |
| `accompagnement` | Sucres et carrés de chocolat pour le café | carton de 200 | 200 | 12,00 € |
| `pain_campagne` | Pain de campagne | 1 pain d'1 kg (20 tranches) | 20 | 2,40 € |
| `croissant_boulanger` | Croissants du boulanger | par 10 | 10 | 7,00 € |
| `pain_chocolat_boulanger` | Pains au chocolat du boulanger | par 10 | 10 | 7,50 € |
| `tarte_boulanger` | Tarte aux fruits du boulanger | tarte de 8 parts | 8 | 12,80 € |

Les prix unitaires (`unitCost`) ne changent pas: ils sont déjà dans les prix de gros d'un petit café en 2026 (café de torréfacteur à 20 € le kilo, lait de ferme à 1,30 € le litre, croissant à 0,70 € au café).

**Textes.**

| Clé | Texte |
|---|---|
| `tablet.orders.title` | « Commandes pour {weekday} » (le prochain jour ouvert: « Commandes pour mardi ») |
| `tablet.orders.cols` | `['Produit', 'Conditionnement', 'En réserve', 'Habituelle', 'Quantité', 'Prix']` |
| nouveau `tablet.orders.supplier` | « {name} · passe {days} » (exemple: « Armelle, la laitière · passe mardi, jeudi et samedi ») |
| nouveau `tablet.orders.notTomorrow` | « Ne passe pas {weekday}. Prochain passage : {next}. » |
| nouveau `tablet.orders.franco` | « Port : {shipping}. Encore {amount} pour le port offert. » |
| nouveau `tablet.orders.francoOk` | « Port offert. » |
| nouveau `tablet.orders.monday` | « Le lundi, personne ne livre : cette commande arrive mardi. » |
| `tablet.orders.sent` | « Commande envoyée : livrée {weekday} vers 7 h. Tu peux la modifier jusqu'à la fermeture à clé. » |
| `evening.orderSent` | « Livraison {weekday} vers 7 h : la commande est passée. » |
| nouvelle astuce de Simone, soir du jour 12 (vendredi) | « Armelle passe demain, et c'est la fête dimanche. Prenez large en lait. » |

### P0-3 Lots datés, pertes, inventaire du soir

**Règles.**
- Chaque livraison crée un lot par ingrédient: `[quantité, dernier jour]`, dernier jour = jour de livraison + `shelfDays` - 1. Un dépannage crée un lot daté de la même façon.
- La vente consomme les lots du plus ancien au plus récent (premier entré premier sorti, automatique). Un ticket rendu au stock (`purgeOrphanTickets`) remet sa quantité dans le lot le plus ancien encore bon.
- `stock[ing]` reste la somme des lots (le service et l'ardoise continuent de le lire); il se recalcule à chaque changement de lots.
- **Le soir** (`evening`): les pièces du boulanger (`supplier` `lucas`, `unit` `piece`) dont le lot finit ce soir partent au panier du soir, comme aujourd'hui, mais elles ont été payées. 1 point de réputation par pièce, **6 au plus** par soir (au lieu de 20).
- **Chaque matin** (`dawn`, avant la livraison, lundi compris): les autres lots dont le dernier jour est passé sont jetés. Leur valeur (quantité x `unitCost`) s'inscrit en « Perdu » au bilan du jour. Aucune autre pénalité: ni réputation, ni humeur.
- `takeUnsoldFresh` (`src/service/api.ts`) suit la même règle (lots qui finissent ce soir), plus `shelfDays` 1 au plus.
- **Sauvegardes v0.1**: à la reprise, un stock sans lots devient un lot par ingrédient, dernier jour = jour courant + `shelfDays` - 1.
- **Inventaire du soir**: la tablette (section Commandes) affiche par ingrédient la quantité en réserve et la date du lot le plus proche; un lot qui finit demain est signalé. Rien à compter à la main.

**Données: `clientele/fournisseurs.json`, `ingredients[].shelfDays`** (les autres valeurs ne changent pas):

| `id` | Avant | Après | Raison |
|---|---|---|---|
| `lait_entier` | 7 | 7 | lait de ferme pasteurisé |
| `lait_avoine` | 10 | 30 | brique fermée; 30 suffit à ne jamais la perdre dans la démo |
| `beurre` | 14 | 30 | DLC courante d'un beurre |
| `oeufs` | 14 | 28 | date de consommation recommandée |
| `cacao` | 60 | 180 | produit sec |
| `the_noir`, `the_vert` | 90 | 365 | produit sec |
| `oranges` | 10 | 14 | |
| `citrons` | 14 | 21 | |
| `pain_campagne` | 1 | 2 | un pain de campagne se garde deux jours, grillé le second |
| `tarte_boulanger` | 1 | 2 | deux jours en vitrine réfrigérée |
| `croissant_boulanger`, `pain_chocolat_boulanger` | 1 | 1 | viennoiserie du jour |
| `menthe` | 4 | 4 | |
| `plantes_simone` | 7 | 7 | |

`ordering.basketMaxPerDay`: 20 devient 6 (plage 3 à 10: deux ou trois voisins qui passent prendre le panier).

**Textes.**

| Clé | Texte |
|---|---|
| nouveau `tablet.orders.stockDate` | « bon jusqu'à {weekday} » |
| nouveau `tablet.orders.useFirst` | « À finir demain » |
| nouveau `tablet.orders.inventory` | « La réserve ce soir » |
| nouveau `evening.lost` | « Perdu (dates passées) » |
| nouveau `evening.lostHelp` | « {items} : passé la date ce matin. Commande un peu moins, ou mets-le en avant sur l'ardoise. » |
| nouveau `evening.basket` | « Panier du soir » (valeur des invendus donnés) |
| nouveau `evening.basketHelp` | « {n} invendus du boulanger, donnés aux voisins. » |
| nouvelle astuce de Simone, la première fois qu'un lot est jeté | « Le lait ne se garde pas : la tablette te dit ce qui est à finir. » |

### P0-4 Coût de revient, marge, bilan qui se recompte, charges détaillées

**Règles.**
- « Carte et prix »: pour chaque recette, le coût de revient (`costMaterials`) et la marge au prix du jour (prix de la ligne - revient), en euros et en pourcentage du prix.
- Bilan du soir, page des chiffres, dans cet ordre, et le résultat est exactement la somme des lignes:

| Ligne | Calcul | Signe |
|---|---|---|
| Recette | `today.revenue` | + |
| Pourboires | `today.tips` | + |
| Événement | `today.euros` (si non nul) | + |
| Marchandise reçue | cartons livrés ce matin | - |
| Port | ports du matin | - |
| Dépannages | dépannages du jour | - |
| Loyer | `rentCents` | - |
| Charges | somme du détail ci-dessous | - |
| **Résultat du jour** | | = |
| Achats du jour | catalogue et équipements | à part, sous le résultat |
| Caisse ce soir | | |

En dessous, en petit: « Coût des ventes : {amount} · Perdu : {lost} · Panier du soir : {basket} », puis la mention de TVA.
- `result` du rapport (`journee.ts`): `revenue + tips + euros - goods - shipping - emergency - rent - charges`. Champs nouveaux de `today` et du rapport: `goods`, `shipping`, `emergency`, `lost`, `basketValue` (centimes, 0 par défaut pour relire les sauvegardes).
- Le lundi: Loyer, Perdu (le cas échéant), résultat.

**Données: `clientele/economie.json`**, `chargesPerOpenDay` (nombre) remplacé par `charges` (liste); `reserveCents` utilise la somme:

| `id` | `name` | `perOpenDay` (€) | Raison |
|---|---|---|---|
| `electricite` | Électricité (machine, frigo, lumière) | 4,60 | environ 17 kWh par jour ouvert (machine à deux groupes, armoire froide, vitrine), tarif professionnel |
| `eau` | Eau | 1,10 | environ 250 L par jour (machine, plonge) |
| `assurance` | Assurance du café | 1,80 | multirisque d'environ 550 € par an |
| `banque` | Banque et terminal de carte | 1,00 | abonnement et commissions d'un petit commerce |
| `radio` | Droits de la radio (Sacem) | 0,50 | un café qui passe de la musique paie des droits |

Total 9,00 € par jour ouvert (contre 8 €). Ordres de grandeur d'un petit café en 2026, arrondis (hypothèse, sans relevé réel).

**Textes.**

| Clé | Texte |
|---|---|
| `tablet.menu.cols` | `['Recette', 'Prix', 'Revient', 'Marge', 'Vedette']` |
| nouveau `tablet.menu.margin` | « {amount} ({pct} %) » |
| nouveau `tablet.menu.help` | « Le revient, c'est ce que coûtent les ingrédients d'une portion. Le reste paie le loyer, les charges et vos projets. » |
| nouveau `evening.goods` | « Marchandise reçue » |
| nouveau `evening.shipping` | « Port » |
| nouveau `evening.emergency` | « Dépannages » |
| nouveau `evening.rent` | « Loyer » |
| nouveau `evening.charges` | « Charges » (au survol ou dépliées: une ligne par charge, `name` et montant) |
| nouveau `evening.costOfSales` | « Coût des ventes : {amount} » |
| nouveau `evening.vat` | « Sans TVA : le café reste sous le seuil de la franchise. » |

## 5. Effet sur l'économie (simulation)

Commande: `python3 -I -B docs/jeux/cosy-cafe/demo/simulations/demo_v0_2.py` (5 secondes, 4 parties par duo et par ordre d'achat, graines 1000 à 1003). Le script reprend la démo v0.1 client par client (`demo_v0_1.py`, `cosy_cafe.py`) et remplace seulement le coût des matières par le modèle P0: lots datés, jours de passage, franco, réserve de Simone, panier payé, charges à 9 €. Le robot suit toujours la commande habituelle et appelle le dépannage dès qu'il manque un ingrédient (hypothèse prudente: dans le jeu, une rupture peut aussi se laisser grisée).

Synthèse (médianes de 4 parties):

| Duo | Ordre d'achat | Gagné en 12 jours v0.1 | v0.2 | Caisse au jour 15 v0.1 | v0.2 | Terrasse pour la fête v0.2 | Trois tasses avant la fête v0.1 | v0.2 |
|---|---|---|---|---|---|---|---|---|
| Duo tranquille | équilibre | 1 854 € | 1 745 € | 119 € | 291 € | 4 sur 4 | 2 sur 4 | 3 sur 4 |
| Duo tranquille | décor d'abord | 1 835 € | 1 718 € | 309 € | 193 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo tranquille | terrasse puis coin du feu | 1 894 € | 1 744 € | 154 € | 163 € | 4 sur 4 | 2 sur 4 | 2 sur 4 |
| Duo tranquille | machines d'abord | 1 873 € | 1 738 € | 171 € | 112 € | 4 sur 4 | 1 sur 4 | 1 sur 4 |
| Duo médian | équilibre | 2 208 € | 2 058 € | 472 € | 323 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo médian | décor d'abord | 2 145 € | 2 039 € | 318 € | 514 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo médian | terrasse puis coin du feu | 2 084 € | 2 035 € | 278 € | 257 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo médian | machines d'abord | 2 159 € | 2 039 € | 220 € | 111 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo rapide | équilibre | 2 417 € | 2 225 € | 378 € | 489 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo rapide | décor d'abord | 2 288 € | 2 170 € | 162 € | 63 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo rapide | terrasse puis coin du feu | 2 351 € | 2 160 € | 91 € | 273 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |
| Duo rapide | machines d'abord | 2 297 € | 2 096 € | 134 € | 158 € | 4 sur 4 | 4 sur 4 | 4 sur 4 |

Le stock, ordre « équilibre », sur les 12 jours ouverts (médianes):

| Duo | Coût des ventes (ce que la v0.1 débitait) | Marchandise livrée et payée | Port | Dépannages | Ruptures rattrapées | Périmé jeté | Panier du soir | Pertes sur le livré |
|---|---|---|---|---|---|---|---|---|
| Duo tranquille | 479 € | 516 € | 12 € | 66 € | 4 | 18 € | 7 € | 5 % |
| Duo médian | 562 € | 562 € | 8 € | 91 € | 8 | 24 € | 15 € | 7 % |
| Duo rapide | 598 € | 600 € | 13 € | 75 € | 8 | 17 € | 10 € | 5 % |

Lecture:
- **La démo reste gagnable.** Le gain sur 12 jours baisse de 50 à 190 € selon le duo et l'ordre d'achat (2 à 8 %); 48 parties sur 48 ouvrent la terrasse pour la fête; les trois tasses avant la fête ne reculent nulle part (une partie de plus chez le duo tranquille en « équilibre », dans le bruit de 4 parties). La pièce du fond reste un vrai choix (4 sur 4 en « terrasse puis coin du feu » chez les duos médian et rapide). Aucune caisse médiane ne finit sous la réserve (la plus basse: 63 €).
- **Les pertes sont réalistes et modérées**: 5 à 7 % de la marchandise livrée, l'ordre de grandeur d'un café qui gère bien son frais. Elles ne viennent pas d'erreurs du joueur: un duo qui retouche la commande fait mieux que le robot.
- **Le coût vient surtout des dépannages** (66 à 91 €): les ruptures touchent les recettes nouvelles (jus d'orange, citronnade, tartes), dont la commande habituelle n'a pas encore d'historique. C'est là que la décision à deux paie: « on vient d'acheter le presse-agrumes, prends une cagette ».
- **La réserve de Simone** (85 €) évite que le premier mardi soit vide de caisse: sans elle, la première commande coûtait 144 € et le duo médian n'achetait presque rien le premier soir.
- **Durée**: le service ne change pas. La commande du soir demande un peu plus de réflexion, estimée à 30 s à 1 min par soir, soit 6 à 12 min sur la démo: **4,1 à 4,2 h** pour le duo médian au lieu de 4,0 h (estimation, non simulée: le robot ne mesure pas le temps de la tablette).

Ce que la simulation ne couvre pas: la mise de côté de la commande de demain dans la caisse (le robot achète comme en v0.1, avec la seule réserve), la réputation du panier du soir (absente de la simulation v0.1 aussi), la vraie demande d'un duo qui ajuste ses commandes (meilleure que le robot), le coût de la rupture laissée grisée (vente perdue au lieu du dépannage), les euros des événements (Godillots, café d'honneur), déjà nets de matières dans la v0.1.

## 6. Les P1 (après le jeu de ce soir)

1. **Cotisations sociales et prix 2026.** 12,3 % des recettes prélevés chaque soir (taux de la micro-entreprise pour la vente de marchandises et la restauration, à vérifier au moment de l'écrire), compensés par des prix conseillés relevés d'environ 12 % (espresso 1,60 €, crème 2,70 €, chocolat 3,10 €, croissant 1,40 €). Effet net sur la caisse proche de zéro, mais à simuler avant: la sensibilité au prix des clients est relative au prix de base, il faut le vérifier dans `regles.json` (`priceBounds`, `priceSlope`).
2. **Capacité du froid.** L'armoire tient 6 caisses de lait (ou leur équivalent en beurre, œufs, limonade); la commande refuse au-delà avec « Le frigo est plein : 6 caisses au plus. » Le réfrigérateur vitré ajoute 4 places. Décision: gros lait pour la fête ou limonade ?
3. **Fermeture à deux.** Trois gestes du soir, 10 à 20 s chacun, faits par l'un ou l'autre: « Purger et brosser les groupes », « Vider le bac à marc », « Passer la serpillière ». Propreté du lendemain (ambiance) 10 si les trois sont faits, 8 par défaut, jamais sous 6. L'inspection du jour 11 regarde les groupes.
4. **Fond de caisse.** La réserve devient « Fond de caisse et loyer » (même valeur), avec la phrase « On ne touche pas à la monnaie du matin. »
5. **Rupture à la craie.** Une recette épuisée s'écrit barrée sur l'ardoise avec « Plus de {item} aujourd'hui, désolé ! »; Simone propose le dépannage une fois par journée.
6. **Carnet de commandes à deux.** Chaque joueur peut « prendre » des fournisseurs (son prénom s'affiche sur la ligne); la commande part quand les deux ont signé leurs lignes ou ont dit « Ça me va ». Le verrou par ligne existe déjà.

## 7. Les P2 (plus tard)

- Mouture à régler selon le temps (pluie: un cran plus fin), geste à deux au moulin.
- Bouteille de lait entamée à finir en 3 jours.
- Relevé des températures du frigo le matin, une coche, lié à l'inspection.
- Espèces et carte, rendre la monnaie en un geste rapide (à tester: risque de corvée).
- Prix dégressif chez Joseph (sac de 5 kg à -10 %), décision de trésorerie.
- Invendus vendus à moitié prix en fin d'après-midi (« panier anti-gaspi ») au lieu d'être donnés.

## 8. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| Id | Critère | Vérification |
|---|---|---|
| R2-01 | La caisse baisse à la livraison du montant exact affiché la veille sous « À payer à la livraison », port compris | test: commande connue, caisse avant et après `dawn` |
| R2-02 | Une vente n'enlève plus de matières à la caisse: caisse + prix exact | test sur `takeOrderAt` |
| R2-03 | Le résultat du bilan est égal à la somme de ses lignes, chaque soir des quinze jours | `recette-quinze-jours.test.ts` |
| R2-04 | Le lundi, aucune livraison; la commande du dimanche arrive le mardi | test des jours 7 à 9 |
| R2-05 | Armelle ne livre que mardi, jeudi et samedi; Joseph que mardi et vendredi; les lignes d'un fournisseur qui ne passe pas sont en lecture seule avec son prochain passage | test et capture de la tablette |
| R2-06 | Sous le franco, le port s'ajoute une fois par fournisseur; au-dessus, « Port offert. » | test |
| R2-07 | Un lot de lait livré le jour 2 sert jusqu'au jour 8 et disparaît au matin du jour 9, sa valeur en « Perdu » | test |
| R2-08 | La vente prend le lot le plus ancien | test à deux lots |
| R2-09 | Le panier du soir rapporte 6 points au plus | test avec 20 croissants restants |
| R2-10 | Au jour 2, la réserve de Simone est en stock et n'a rien coûté | test |
| R2-11 | Une partie v0.1 sauvegardée se reprend, stock intact, lots créés | test de reprise |
| R2-12 | « Carte et prix » montre revient et marge de chaque recette, marge = prix de la ligne - `costMaterials` | test et capture |
| R2-13 | Démo jouée par les robots: la caisse ne passe jamais sous zéro au soir, aucune exception sur quinze jours | `recette-quinze-jours.test.ts` |

## 9. Questions pour le client

1. **TVA**: on reste sans TVA, comme un vrai petit café sous le seuil de la franchise, et on l'écrit au bilan ? Recommandation: oui; la TVA réelle n'apporte aucune décision de jeu.
2. **Cotisations sociales** (P1): les ajouter avec des prix relevés pour que la caisse ne change presque pas ? Recommandation: oui, mais après une simulation dédiée, pas ce matin.
3. **Pertes**: le périmé ne coûte que sa valeur, sans réputation ni humeur. Tu veux plus dur ? Recommandation: non; 5 à 7 % de pertes se sentent déjà au bilan sans gâcher la soirée.
4. **Fermeture à deux** (P1): trois gestes courts du soir pour la propreté ? Recommandation: oui, s'ils restent sous une minute à deux et jamais punitifs.
