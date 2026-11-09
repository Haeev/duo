# Deux Tabliers, démo v0.2: remises et marketing

| Champ | Valeur |
|---|---|
| Statut | proposition du game designer, à relire par le manager, puis à faire valider par le client |
| Base | démo v0.1 publiée (`games/deux-tabliers`), `realisme-v0-2.md` (marchandise payée à la livraison, lots datés, bilan détaillé), en cours d'implémentation |
| Simulation | `docs/jeux/cosy-cafe/demo/simulations/remises_marketing_v0_2.py` (8 parties par duo et par stratégie, moins d'une seconde); elle lit les deux tables JSON de la section 7 dans ce document |
| Demande du client | « pouvoir gérer les remises aussi, le marketing (à différentes échelles avec des coûts et des impacts différents), etc. » |
| À implémenter | juste après la v0.2 réaliste: P0 en 1 h 30 environ, P1 ensuite |

## 1. En une phrase

Vous décidez à deux quand baisser vos prix, pour qui, et comment faire parler du café (une affiche chez le boulanger, des prospectus au marché, un encart dans L'Écho de l'Arvelle), et le bilan du soir vous dit combien de clients chaque idée a fait venir.

Ce qu'on doit ressentir: « on a eu une idée, et ça a marché ». Le mardi soir, on regarde la semaine: « Les après-midi sont creux, on fait une heure douce ? », « L'Écho boucle ce soir, on prend un encart pour jeudi ? ». Le jeudi, une cliente écrit « Vu dans L'Écho ! » au livre d'or, et le bilan dit « 7 clients venus grâce à l'encart ».

## 2. Principes de design

1. **Un vrai choix, jamais une obligation.** Sans aucune remise ni action, la démo reste celle de la v0.2: terrasse pour la fête, trois tasses vers le jour 12 (vérifié par la simulation, section 8). Chaque levier rapporte selon le moment et la cible; mal placé, il coûte un peu.
2. **Le levier qui marche est celui qui remplit un creux.** Le café est presque plein le week-end et le jour de la fête (38 % de groupes renvoyés le dimanche 14): y faire venir plus de monde ne sert à rien. En semaine et l'après-midi, il reste de la place: c'est là que remises et publicité paient. La tablette le dit (« Jour de fête : la salle sera pleine, une remise ne fera pas venir plus de monde. »).
3. **Rien de punitif.** Une remise qui s'arrête ne fâche personne; une action qui ne rapporte pas ne coûte que son prix; aucune perte de réputation, aucune « habitude » des clients à punir. Les seuls freins sont des plafonds et des rendements décroissants, affichés.
4. **Une seule remise par ligne, la meilleure pour le client**, jamais sous le prix de revient (`floorAtCost`). Pas de cumul à calculer de tête.
5. **Tout se voit.** L'ardoise montre les remises en cours, le ticket montre le prix barré, le bilan montre ce que les remises ont coûté et ce que chaque action a rapporté.
6. **À deux.** Les réglages se font dans la tablette, partagée (le verrou par ligne existe); une action de plus de 30 € est proposée à l'autre joueur comme un achat important (« Camille propose un encart dans L'Écho : 45 €. Ça te va ? »), une remise nouvelle aussi. Les gestes P1 (ardoise de trottoir, dégustation sur la place) demandent qu'un joueur s'absente du comptoir: on en parle.

## 3. Les remises

Toutes les remises se règlent dans un onglet nouveau de la tablette, **« Remises »**, à côté de « Carte et prix ». Elles prennent effet à l'ouverture suivante (pas au milieu d'un service), et se modifient chaque soir.

### 3.1 L'heure douce (happy hour) · P0

- **Quoi**: un créneau où les boissons (familles de `rules.drinks`) sont moins chères. Les mets ne changent pas.
- **Réglage**: heure de début (8 h à 16 h, par heure), durée (1, 2 ou 3 h, jamais après la fermeture à 18 h), taux (10, 20 ou 30 %), jours (cases mardi à dimanche). Par défaut: 15 h à 17 h, 20 %, mardi à vendredi. Une seule heure douce.
- **Effet sur l'attrait**: pendant le créneau, l'indice de prix (`priceIndex`) de chaque profil se calcule sur les seules lignes remisées (ce que l'ardoise annonce: « boissons -20 % »), soit `1 - taux`; le facteur de prix du jeu (`priceFactor`, borné par `priceBounds` 0,4 à 1,25) fait le reste. Les profils sensibles au prix réagissent le plus: à -20 %, les voisins (sensibilité 1,3) gagnent +25 % de passants dans le créneau (plafond du jeu), les pressés (1,2) +24 %, les flâneurs (0,8) +16 %, les gourmands (0,7) +14 %. La satisfaction, elle, garde l'indice habituel sur toute la commande. Dans `generateArrivals`, l'attrait se calcule deux fois par profil (normal et heure douce) et chaque heure prend le sien; une heure à moitié couverte prend la moyenne pondérée.
- **Effet sur la marge**: tous les groupes du créneau paient moins, même ceux qui seraient venus sans remise. À -20 % sur des boissons qui gardent 83 à 93 % de leur prix, il faut environ +25 % de clients pour que la caisse s'y retrouve. La simulation (section 8) donne: l'après-midi de semaine paie un peu (+15 € sur la démo), tous les jours ne rapporte plus rien (le week-end est plein), -30 % coûte.
- **Effet sur la fidélité et la réputation**: la satisfaction gagne la moitié du terme de prix habituel (`satisfactionWeight` 0,5): une remise fait plaisir, mais moins qu'un prix juste toute la journée. Effet sur la renommée: faible et positif.
- **Ardoise**: une ligne en tête, à la craie: « Heure douce 15 h-17 h : boissons -20 % » (trait d'union permis). Pendant le créneau, la ligne est soulignée et les prix des boissons s'affichent barrés avec le prix remisé.
- **Ticket**: « Café crème 2,40 € » barré, « 1,90 € (heure douce) ». Arrondi au dixième d'euro inférieur, jamais sous le revient arrondi au dixième supérieur.
- **Cas limites**: un groupe arrivé dans le créneau paie le prix du créneau, même s'il commande à la caisse après la fin (la règle se lit à l'heure d'arrivée, `arrivedAt`, pour éviter qu'un client rate la remise parce que la file est longue). Une recommande au-delà du créneau paie le prix normal. Le jour de la fête, l'heure douce s'applique si la case du dimanche est cochée; la tablette prévient la veille.

### 3.2 La carte de fidélité · P0

- **Quoi**: une carte à tampons pour les cafés (familles `black_coffee` et `milk_coffee`). Huit cafés payés, le neuvième est offert.
- **Réglage**: l'achat « Cartes de fidélité » au catalogue (15 €, 200 cartes, palier t0), puis un interrupteur « Carte de fidélité » dans l'onglet Remises. Rien d'autre à régler.
- **Qui l'a**: les gens d'ici, qui reviennent (`loyaltyCard.profiles`: voisins, pressés, télétravailleurs, connaisseurs) et les six habitués. La part des groupes de ces profils qui ont une carte monte de 10 % le premier jour à 60 % (plus 10 points par jour ouvert). Les autres profils (de passage) n'en prennent pas.
- **Tampons**: pour un groupe ordinaire, le jeu ne suit pas chaque personne; il tire si la carte du groupe est pleine: chance 1 sur 9 par visite d'un porteur. Pour un habitué, la carte est vraie: son nombre de tampons est gardé dans l'état (`regularStamps`), visible dans le carnet des clients (« Simone : 6 tampons sur 8 »).
- **Café offert**: le café le moins cher de la commande est offert, il s'affiche à 0 € sur le ticket (« Neuvième café offert »). La caisse ne l'encaisse pas, la marchandise est quand même consommée.
- **Effet sur l'attrait**: les profils concernés gagnent jusqu'à +10 % d'attrait (`attractionBonusMax`), au prorata de la part de porteurs (les gens d'ici choisissent le café où leur carte se remplit). **Effet sur la satisfaction**: +6 pour le groupe dont la carte est pleine (« C'était mon café offert, merci ! » au livre d'or, une chance sur deux).
- **Coût**: environ un café sur neuf pour les porteurs, soit 3 à 4 % de la recette de ces profils.
- **Ardoise**: une petite ligne « Carte de fidélité : le 9e café offert ». **Ticket**: « Tampons : 4 sur 8 » pour un habitué, « Carte tamponnée » pour un groupe ordinaire.
- **Cas limites**: couper la carte n'efface rien: les tampons des habitués restent et repartent si on la rallume. Une carte pleine et une heure douce le même jour: le café offert reste offert (0 €), les autres lignes prennent l'heure douce.

### 3.3 Le tarif réduit d'un profil · P0

- **Quoi**: une remise sur toute la commande d'un profil, sur présentation de quelque chose de crédible au village.
- **Réglage**: le tarif, le taux, les jours (cases mardi à dimanche, par défaut mardi à vendredi).
- **Tarifs proposés**:
  - **Tarif randonneur** (`promeneurs`): « Sur présentation de ta carte des sentiers de l'Arvelle ». Taux 10, 15 ou 20 %. Les promeneurs viennent surtout le samedi et le dimanche (`dayFactors` 1,5 et 1,8), quand le café est déjà plein: c'est le piège du tarif, qu'il faut sentir.
  - **Tarif étudiant** (`etudiants`): prévu dans les données, mais il n'y a pas d'étudiants à Ormeval (`groupsPerDay` 0). La ligne s'affiche grisée: « Pas d'étudiants au village : le car du lycée ne s'arrête qu'à Mérelles. » Elle servira à la ville. C'est voulu: le joueur comprend que le village a sa clientèle.
- **Effet sur l'attrait**: indice de prix du profil = 1 - taux, donc facteur de prix du jeu (promeneurs, sensibilité 1,0: +10 % de passants à -10 %, +20 % à -20 %). **Marge**: le taux sur tout le ticket du profil. **Satisfaction**: moitié du terme de prix, comme l'heure douce.
- **Ardoise**: « Tarif randonneur : -10 % ». **Ticket**: « Tarif randonneur -10 % : -0,62 € ».
- **Cas limites**: un groupe de promeneurs pendant l'heure douce: chaque ligne prend la meilleure des deux remises, jamais les deux. Un habitué promeneur (Bastien) y a droit aussi.

### 3.4 L'offre du jour · P0

- **Quoi**: une recette mise en avant sur l'ardoise, moins chère toute la journée. Elle sert surtout à écouler un lot qui finit demain (lien avec les lots datés de la v0.2).
- **Réglage**: dans l'onglet Remises, « Offre du jour »: une recette de l'ardoise et un taux (20, 30 ou 50 %). Une seule par jour; elle s'efface chaque soir (on la choisit à nouveau).
- **Suggestion de la tablette**: quand l'inventaire du soir signale un lot « À finir demain » et que ce qui reste dépasse les ventes habituelles d'une journée de cette recette (moyenne des trois derniers jours), la tablette propose: « Il reste 6 parts de tarte à finir demain, tu en vends 3 d'habitude. En offre du jour ? ». Un clic remplit la ligne. Sinon, elle se tait.
- **Effet sur les ventes**: la recette pèse plus dans le choix des clients: la famille de la recette compte 1 de plus dans `chooseFamily` (une envie secondaire passe de 1 à 2), et la recette compte double dans le tirage au sein de sa famille (`pickWeight` 2). L'indice de prix suit la remise. Avec le premier entré premier sorti, ce sont les vieilles parts qui partent.
- **Marge**: toutes les ventes de la recette ce jour-là sont remisées, même celles qui auraient eu lieu. La simulation (section 8.3) montre que l'offre paie quand le reste dépasse nettement les ventes habituelles, et coûte quand le lot serait parti de toute façon: c'est pour cela que la tablette ne la suggère qu'au-delà.
- **Effet sur la réputation**: aucun en plus (la satisfaction suit le terme de prix pondéré, comme les autres remises).
- **Ardoise**: une ligne encadrée en tête: « Offre du jour : tarte aux fruits 2,20 € au lieu de 3,20 € ». **Ticket**: « Tarte aux fruits (offre du jour) 2,20 € ».
- **Cas limites**: si la recette est en rupture, la ligne reste barrée comme les autres ruptures et l'offre ne s'applique plus; rien d'autre ne change. Le plancher au revient s'applique (un croissant à -50 % reste à 0,70 €; la tablette affiche « Prix plancher : le revient. »).

### 3.5 Les formules · P1

- **Le petit-déjeuner**: un café (noir ou crème) et une viennoiserie ou une tartine, de 8 h à 11 h, 10 % de moins sur la paire.
- **Le goûter**: un chocolat chaud ou un jus et une crêpe ou une part de tarte, de 15 h à 18 h, 10 % de moins sur la paire.
- **Effet**: un groupe qui commande une boisson de la formule dans son créneau mange plus souvent (`eatsShare` x 1,5, plafonné à 0,9), et la paire est facturée au prix de la formule. Les profils qui ont les deux familles dans leurs envies gagnent +4 % d'attrait dans le créneau (familles pour le goûter, pressés et voisins pour le petit-déjeuner).
- **Marge**: la viennoiserie du boulanger rapporte peu (0,50 €), la remise de 10 % sur la paire en mange une partie; la formule paie par les mets vendus en plus. À simuler client par client avant d'écrire les valeurs finales (le modèle au jour de la section 8 ne suit pas la composition des commandes).
- **Ardoise**: « Petit-déjeuner : café et croissant 2,40 € ». **Ticket**: les deux lignes, puis « Formule petit-déjeuner : -0,26 € ».
- Pourquoi en P1: la commande d'un groupe (`groupOrder`) doit apprendre à former des paires; c'est le changement le plus délicat du lot.

## 4. Le marketing

Un onglet nouveau de la tablette, **« Faire connaître »**: la liste des actions, chacune avec son coût, sa durée, sa cible et son état (« En cours jusqu'à samedi », « Prochain bouclage : mardi soir »). On lance une action le soir; elle se paie tout de suite (débit de la caisse, ligne « Publicité » au bilan).

### 4.1 Modèle commun (P0)

- **Effet**: chaque action donne à chaque profil un supplément d'affluence `peak x poids du profil x 0,5^(t / halfLifeDays)`, `t` jours après son premier effet, pendant `durationDays` jours (lundis compris: l'effet décroît même café fermé).
- **Plafond et rendements décroissants**: les suppléments d'un profil s'additionnent en `E`, puis le facteur appliqué vaut `1 + maxBoost x (1 - exp(-E / maxBoost))`, avec `maxBoost` 0,35. Une action seule perd peu (+14 % donne +11,5 %); trois actions à la fois sur la même cible en perdent beaucoup (+50 % donne +27 %). On ne peut pas acheter une salle pleine.
- **Lassitude**: relancer la même action moins de 7 jours après la fin de la précédente ne donne que 60 % de l'effet (`repeatFactor`). Une action en cours ne se relance pas (bouton grisé « Déjà en cours »).
- **Branchement**: le facteur multiplie `dayAffluence(ctx, profile)` (`scenes.ts`), comme le marché aux fleurs et l'article du carnet vert. Les habitués ne sont pas concernés: ils viennent de toute façon.
- **Compteur au bilan**: pour chaque groupe servi d'un profil dont le facteur vaut `F > 1`, la part `(F - 1) / F` est attribuée aux actions en cours, au prorata de leur supplément. Le bilan l'arrondit à l'unité: « Venus grâce à l'affiche chez Lucas : environ 3 clients ». Le bilan de la semaine (lundi) cumule par action et donne le coût par client venu.
- **Livre d'or**: un groupe servi « venu grâce à » une action (tirage avec la part ci-dessus) écrit une fois sur quatre (`guestbookChance`) la phrase de l'action, si sa satisfaction atteint 70; une seule phrase par action et par jour. Exemple: « Vu dans L'Écho ! Et le crème est à la hauteur. »
- **État** (`ClienteleState`): `campaigns: { id, launchedDay, firstDay }[]` et `today.fromCampaigns: Record<string, number>` (fractionnaire, arrondi à l'affichage), `today.marketing` (centimes); 0 et listes vides par défaut pour relire les sauvegardes.

### 4.2 Les actions, de la plus petite à la plus grande

| Action | Priorité | Coût | Délai | Durée, demi-vie | Supplément au pic | Cible (poids) | Raison |
|---|---|---|---|---|---|---|---|
| Le bouche-à-oreille | P0 (affichage) | gratuit | toujours | toujours | ce que donnent les tasses | tous | c'est la réputation qui existe déjà; on la rend visible au lieu d'en inventer une autre |
| Une affiche chez Lucas, le boulanger | P0 | 8 € | lendemain | 7 jours, 5 jours | +8 % | voisins 1, pressés 1, flâneurs 0,5, familles 0,5 | tout le village prend son pain chez Lucas, sur la place: les gens d'ici la voient tous les matins |
| Une affiche au panneau de la mairie-école | P0 | 8 € | lendemain | 10 jours, 6 jours | +7 % | familles 1, voisins 0,6, promeneurs 0,6 | les parents passent devant à 8 h 30 et 16 h 30; les randonneurs lisent le panneau pour les sentiers |
| Des prospectus au marché du samedi | P0 | 20 € | le samedi qui suit | 4 jours, 1,5 jour | +20 % | flâneurs 1, familles 1, promeneurs 0,8, gourmands 0,6 | Mireille les glisse dans les cabas à son étal du petit marché; fort et bref, surtout le samedi et le dimanche, quand le café est souvent déjà plein |
| Un encart dans L'Écho de l'Arvelle | P0 | 45 € | le jeudi qui suit (bouclage le mardi soir) | 10 jours, 4 jours | +14 % | flâneurs 1, gourmands 1, promeneurs 1, connaisseurs 1, familles 0,8, voisins 0,5, télétravailleurs 0,5 | l'hebdomadaire de la vallée (déjà dans le jeu: l'article du carnet vert); il touche ceux qui ne passent pas sur la place; l'article gratuit du carnet vert fait +8 à +15 %, un encart payé ne doit pas faire mieux |
| L'ardoise de trottoir soignée | P1 | 35 € une fois (le chevalet), puis la craie | le jour même | 1 jour | +6 %, +9 % si elle annonce une remise en cours | pressés 1, flâneurs 1, promeneurs 1, familles 0,5 | on l'écrit le matin; la pluie la délave (effet moitié), sauf sous le store de la terrasse |
| La dégustation sur la place | P1 | les matières (20 petits cafés, environ 4 €) | tout de suite | 2 heures de jeu à +25 %, puis 3 jours à +5 % | +25 % | pressés 1, flâneurs 1, promeneurs 1, familles 1 | un joueur sort avec le plateau pendant que l'autre tient le comptoir; une fois par jour au plus |
| Le partenariat avec les Godillots | P1 | 30 € (le café sur la carte des sentiers du club) | samedi suivant | jusqu'à la fin de la démo, sans décroissance, samedi et dimanche | +12 % | promeneurs 1 | débloqué par la scène des Godillots (jour 7); demande le tarif randonneur actif |
| Le goûter de l'école | P1 | 10 chocolats offerts à la classe chaque mercredi (environ 4,40 €) | mercredi suivant | tant qu'on l'offre | +10 % le mercredi, +5 % les autres jours | familles 1 | débloqué après la scène de Jules (jour 10); s'arrête si un mercredi est sauté, sans autre suite |
| Une page sur « La Vitrine de l'Arvelle » | P1 | 10 € par semaine | lendemain | tant qu'on paie | +6 % x (ambiance / 60), entre 0,6 et 1,3 | promeneurs 1, connaisseurs 1, flâneurs 0,7, gourmands 0,7 | le site des commerces de la vallée (fictif); une jolie salle se photographie bien: le décor sert aussi la publicité |
| Un mot sur « Le Babillard d'Ormeval » | P1 | gratuit, une fois par jour | lendemain | 2 jours, 1 jour | +3 % | voisins 1, familles 1 | la page d'entraide du village (fictive); petit, gratuit, pour les annonces (« Crêpes ce mercredi ») |

Hypothèse du monde à valider par level-designer et directeur-artistique: Ormeval a **un petit marché le samedi matin** sur la place du Tilleul (trois étals: Mireille, un primeur, un fromager); le marché aux fleurs du jour 6 en est l'édition de printemps. En P0, le marché n'a pas à se voir (Mireille distribue les prospectus); en P1, trois étals le samedi matin sur la place, côté église, hors des places de pique-nique et du passage vers le café.

### 4.3 Le bouche-à-oreille (P0, affichage seulement)

Il ne change aucun chiffre: c'est la part des clients due aux tasses au-delà de 1,5 (`1 - cupsFactor(1,5) / cupsFactor(tasses)`, soit 22 % à trois tasses). Dans « Faire connaître », première ligne, toujours active: « Le bouche-à-oreille · gratuit · Tes clients contents en parlent : chaque demi-tasse de réputation fait venir du monde. » Au bilan: « Venus par le bouche-à-oreille : environ 8 clients ». Le joueur comprend que bien servir est la première publicité.

## 5. Interface et textes

### 5.1 Onglet « Remises » (tablette)

| Clé (`textes.json`, `tablet.discounts.*`) | Texte |
|---|---|
| `title` | « Remises » |
| `intro` | « Une remise fait venir du monde quand il reste de la place. Elle prend effet à la prochaine ouverture. » |
| `happyHour` | « Heure douce » |
| `happyHourHelp` | « Les boissons moins chères sur un créneau. Les mets ne changent pas. » |
| `happyHourLine` | « De {start} à {end}, boissons -{pct} % » |
| `days` | « Jours » |
| `loyalty` | « Carte de fidélité » |
| `loyaltyHelp` | « Huit cafés tamponnés, le neuvième offert. Les gens d'ici la gardent dans leur portefeuille. » |
| `loyaltyNeedCards` | « Achète d'abord les cartes au catalogue (15 €). » |
| `profileRate` | « Tarif réduit » |
| `hikers` | « Tarif randonneur, sur présentation de ta carte des sentiers » |
| `studentsAbsent` | « Pas d'étudiants au village : le car du lycée ne s'arrête qu'à Mérelles. » |
| `dailyOffer` | « Offre du jour » |
| `dailyOfferHelp` | « Une recette mise en avant toute la journée. Idéal pour finir un lot. » |
| `dailyOfferSuggest` | « Il reste {n} {item} à finir demain, tu en vends {usual} d'habitude. En offre du jour ? » |
| `floor` | « Prix plancher : le revient. » |
| `fullDay` | « {weekday} : la salle sera sans doute pleine, une remise ne fera pas venir plus de monde. » |
| `costYesterday` | « Hier, les remises t'ont coûté {amount}. » |
| `proposeTitle` | « {name} propose une remise » |
| `proposeBody` | « {line}. Ça te va ? » |

### 5.2 Onglet « Faire connaître » (tablette)

| Clé (`tablet.marketing.*`) | Texte |
|---|---|
| `title` | « Faire connaître » |
| `intro` | « Une action se paie ce soir. Son effet monte, puis s'estompe. Trop d'actions à la fois se marchent dessus. » |
| `cols` | `['Action', 'Coût', 'Effet', 'Pour qui', 'État']` |
| `word` | « Le bouche-à-oreille » |
| `wordHelp` | « Tes clients contents en parlent : chaque demi-tasse de réputation fait venir du monde. » |
| `running` | « En cours jusqu'à {weekday} » |
| `fading` | « S'estompe » |
| `already` | « Déjà en cours » |
| `tired` | « Relancée trop tôt : effet réduit » |
| `deadline` | « Bouclage ce soir : paraît jeudi. » |
| `nextIssue` | « Paraît jeudi {date} (bouclage mardi soir). » |
| `market` | « Mireille les distribue samedi matin au marché. » |
| `launch` | « Lancer » |
| `launched` | « C'est lancé : {name}. » |
| `saturation` | « Beaucoup d'actions vers les mêmes clients : chacune rapporte moins. » |
| `bigProposal` | « {player} propose : {name}, {amount}. Ça te va ? » |

Noms et effets affichés (`marketing.json`, champs `name` et `blurb`):

| `id` | `name` | `blurb` |
|---|---|---|
| `affiche_boulangerie` | « Une affiche chez Lucas, le boulanger » | « Les gens du village la voient en prenant leur pain. » |
| `affiche_mairie` | « Une affiche au panneau de la mairie-école » | « Les parents à la sortie de l'école, les randonneurs qui cherchent un sentier. » |
| `prospectus_marche` | « Des prospectus au marché du samedi » | « Mireille les glisse dans les cabas. Fort, mais bref. » |
| `encart_echo` | « Un encart dans L'Écho de l'Arvelle » | « Toute la vallée le lit le jeudi. » |
| `ardoise_trottoir` (P1) | « L'ardoise de trottoir » | « Écrite chaque matin. La pluie l'efface, sauf sous le store. » |
| `degustation` (P1) | « Une dégustation sur la place » | « Un plateau de petits cafés, pendant que l'autre tient le comptoir. » |
| `partenariat_godillots` (P1) | « Sur la carte des sentiers des Godillots » | « Le club recommande ta maison pour la pause des randonnées. » |
| `gouter_ecole` (P1) | « Le goûter de l'école » | « Dix chocolats pour la classe, chaque mercredi. » |
| `vitrine_arvelle` (P1) | « Une page sur La Vitrine de l'Arvelle » | « Le site des commerces de la vallée. Une jolie salle fait une jolie photo. » |
| `babillard` (P1) | « Un mot sur le Babillard d'Ormeval » | « La page d'entraide du village. Gratuit, une fois par jour. » |

### 5.3 Livre d'or (`guestbook.campaign.*`)

| Action | Phrases (une tirée au hasard) |
|---|---|
| `affiche_boulangerie` | « J'ai vu votre affiche chez Lucas en prenant ma baguette. Bonne idée ! » · « L'affiche disait vrai : le crème est bon. » |
| `affiche_mairie` | « Vu l'affiche à la sortie de l'école. Les enfants ont adoré le chocolat. » · « Le panneau de la mairie m'a donné l'idée, je reviendrai. » |
| `prospectus_marche` | « Le prospectus était dans mon cabas, entre les poireaux. » · « Merci Mireille pour le prospectus, et merci à vous pour la tarte. » |
| `encart_echo` | « Vu dans L'Écho ! Et le crème est à la hauteur. » · « On est venus de l'autre bout de la vallée, grâce à L'Écho. » |
| `heure_douce` (remise) | « L'heure douce, c'est le meilleur moment de l'après-midi. » |
| `fidelite` (remise) | « C'était mon café offert, merci ! » |
| `tarif_randonneur` (remise) | « Un café juste avant la montée, et à prix de randonneur. » |

Relecture d'écriture neutre: aucune phrase n'accorde au genre des joueurs; « On est venus » parle d'un groupe de clients, pas des joueurs (à remplacer par « On a traversé la vallée, grâce à L'Écho. » si le validateur des textes le signale).

### 5.4 Ardoise, ticket, bilan

| Clé | Texte |
|---|---|
| `slate.happyHour` | « Heure douce {start}-{end} : boissons -{pct} % » |
| `slate.happyHourNow` | « C'est l'heure douce ! » (soulignée pendant le créneau) |
| `slate.loyalty` | « Carte de fidélité : le 9e café offert » |
| `slate.hikers` | « Tarif randonneur : -{pct} % » |
| `slate.dailyOffer` | « Offre du jour : {item} {price} au lieu de {base} » |
| `ticket.discount` | « {name} : -{amount} » (nom de la remise: « heure douce », « offre du jour », « tarif randonneur ») |
| `ticket.freeCoffee` | « Neuvième café offert » |
| `ticket.stamps` | « Tampons : {n} sur 8 » |
| `evening.discounts` | « Remises consenties » (ligne pour mémoire, sous la Recette: la recette est déjà nette des remises) |
| `evening.discountsHelp` | « {amount} de moins sur {n} commandes : heure douce {a}, offre du jour {b}, tarif randonneur {c}, cafés offerts {d}. » |
| `evening.marketing` | « Publicité » (ligne débitée, entre Charges et Résultat du jour) |
| `evening.fromCampaign` | « Venus grâce à {name} : environ {n} clients » |
| `evening.fromWord` | « Venus par le bouche-à-oreille : environ {n} clients » |
| `week.marketing` | « Cette semaine, {name} a coûté {amount} et fait venir environ {n} clients ({per} par client). » |

Bilan du soir de la v0.2 (`realisme-v0-2.md`, P0-4), avec deux lignes de plus: « Publicité » (débitée le soir du lancement, signe -) avant le Résultat du jour, et « Remises consenties » pour mémoire (la Recette est encaissée remisée: `today.revenue` reste ce qui est réellement payé; `today.discounts` garde l'écart avec le prix affiché). Le résultat reste exactement la somme des lignes signées.

Astuces de Simone (une fois chacune): soir du jour 3 « Les après-midi sont calmes en semaine. Une heure douce, peut-être ? »; soir du jour 9 (mardi) « L'Écho boucle ce soir. Un encart paraîtrait jeudi, avant la fête. »; premier lot « À finir demain » « Une offre du jour, et la tarte ne finit pas à la poubelle. »

## 6. Priorités et estimation

**P0 (1 h 30 environ)**, dans cet ordre, chaque lot se livre seul:

1. Données et validation (`remises.json`, `marketing.json`, `donnees.ts`, `SCHEMA.md`): 15 min.
2. Prix payé d'une ligne (`linePrice` reçoit le groupe et l'heure): heure douce, tarif de profil, offre du jour, plancher au revient, meilleure remise; `today.discounts`; ticket: 25 min.
3. Attrait: indice de prix remisé par créneau dans `generateArrivals`, poids de l'offre du jour dans `chooseFamily` et le tirage: 15 min.
4. Carte de fidélité (achat, part de porteurs, tirage de la carte pleine, tampons des habitués): 15 min.
5. Marketing: état des campagnes, facteur plafonné dans `dayAffluence`, compteur, ligne « Publicité », phrases du livre d'or, bouche-à-oreille affiché; quatre actions P0: 20 min.
6. Tablette (deux onglets), ardoise, bilan: le reste, en réutilisant les composants de « Carte et prix » et « Commandes ».

**P1**: formules (avec simulation client par client), ardoise de trottoir, dégustation, partenariats (Godillots, école), Vitrine de l'Arvelle, Babillard, petit marché visible le samedi.

**Hors périmètre**: soldes et promotions des fournisseurs, prix dynamiques automatiques, coupons à collectionner, marques réelles ou plateformes existantes, avis négatifs en ligne, concurrence d'un autre café (punitive sans décision dans une démo de 15 jours).

## 7. Données

Deux fichiers nouveaux dans `games/deux-tabliers/donnees/clientele/`. Les blocs ci-dessous sont lus tels quels par la simulation: les recopier à l'identique (les champs `name`, `blurb` et les textes viennent des tables de la section 5). Identifiants en `snake_case`, clés en `camelCase`, `tier` P0 ou P1. Achat nouveau dans `economie.json`, `purchases`: `{"id": "cartes_fidelite", "name": "Cartes de fidélité (200)", "price": 15, "tier": "t0", "effects": ["remise:fidelite"]}`; en P1, `{"id": "ardoise_trottoir", "name": "Ardoise de trottoir sur chevalet", "price": 35, "tier": "t0", "effects": ["equip:ardoise_trottoir"]}`.

`remises.json`:

<!-- donnees:remises -->
```json
{
  "floorAtCost": true,
  "satisfactionWeight": 0.5,
  "happyHour": {
    "tier": "P0",
    "starts": [8, 9, 10, 11, 12, 13, 14, 15, 16],
    "lengths": [1, 2, 3],
    "rates": [0.1, 0.2, 0.3],
    "default": { "start": 15, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri"] },
    "families": ["black_coffee", "milk_coffee", "tea", "chocolate", "cold_drink", "specialty"]
  },
  "dailyOffer": {
    "tier": "P0",
    "rates": [0.2, 0.3, 0.5],
    "default": 0.3,
    "familyWeightBonus": 1,
    "pickWeight": 2,
    "maxRecipes": 1,
    "suggestWhenLeftOverUsual": 1.0
  },
  "profileRates": [
    { "id": "randonneurs", "tier": "P0", "profile": "promeneurs", "rates": [0.1, 0.15, 0.2], "default": 0.1, "defaultDays": ["tue", "wed", "thu", "fri"] },
    { "id": "etudiants", "tier": "P0", "profile": "etudiants", "rates": [0.1, 0.15, 0.2], "default": 0.15, "defaultDays": ["tue", "wed", "thu", "fri"] }
  ],
  "loyaltyCard": {
    "tier": "P0",
    "price": 15,
    "purchase": "cartes_fidelite",
    "stamps": 8,
    "families": ["black_coffee", "milk_coffee"],
    "profiles": ["voisins", "presses", "teletravail", "connaisseurs"],
    "holderShareStart": 0.1,
    "holderSharePerDay": 0.1,
    "holderShareMax": 0.6,
    "attractionBonusMax": 0.1,
    "freeSatisfaction": 6,
    "guestbookChance": 0.5
  },
  "formulas": [
    { "id": "petit_dejeuner", "tier": "P1", "drinks": ["black_coffee", "milk_coffee"], "foods": ["pastry_bread"], "hours": [8, 11], "rate": 0.1, "eatsShareFactor": 1.5, "eatsShareMax": 0.9, "attractionBonus": 0.04 },
    { "id": "gouter", "tier": "P1", "drinks": ["chocolate", "cold_drink"], "foods": ["cake"], "hours": [15, 18], "rate": 0.1, "eatsShareFactor": 1.5, "eatsShareMax": 0.9, "attractionBonus": 0.04 }
  ]
}
```

`marketing.json` (le bouche-à-oreille n'y est pas: il n'a aucune valeur propre):

<!-- donnees:marketing -->
```json
{
  "maxBoost": 0.35,
  "repeatFactor": 0.6,
  "repeatCooldownDays": 7,
  "guestbookChance": 0.25,
  "guestbookMinSatisfaction": 70,
  "bigProposalEuros": 30,
  "actions": [
    { "id": "affiche_boulangerie", "tier": "P0", "cost": 8, "delayDays": 1, "durationDays": 7, "peak": 0.08, "halfLifeDays": 5,
      "profiles": { "voisins": 1, "presses": 1, "flaneurs": 0.5, "familles": 0.5 } },
    { "id": "affiche_mairie", "tier": "P0", "cost": 8, "delayDays": 1, "durationDays": 10, "peak": 0.07, "halfLifeDays": 6,
      "profiles": { "familles": 1, "voisins": 0.6, "promeneurs": 0.6 } },
    { "id": "prospectus_marche", "tier": "P0", "cost": 20, "delayDays": 1, "launchWeekdays": ["fri"], "durationDays": 4, "peak": 0.2, "halfLifeDays": 1.5,
      "profiles": { "flaneurs": 1, "familles": 1, "promeneurs": 0.8, "gourmands": 0.6 } },
    { "id": "encart_echo", "tier": "P0", "cost": 45, "publishWeekday": "thu", "deadlineWeekday": "tue", "durationDays": 10, "peak": 0.14, "halfLifeDays": 4,
      "profiles": { "flaneurs": 1, "gourmands": 1, "promeneurs": 1, "connaisseurs": 1, "familles": 0.8, "voisins": 0.5, "teletravail": 0.5 } },
    { "id": "ardoise_trottoir", "tier": "P1", "cost": 0, "requires": "ardoise_trottoir", "delayDays": 0, "durationDays": 1, "peak": 0.06, "halfLifeDays": 1,
      "withDiscount": 1.5, "rain": 0.5, "rainUnderAwning": 1.0,
      "profiles": { "presses": 1, "flaneurs": 1, "promeneurs": 1, "familles": 0.5 } },
    { "id": "degustation", "tier": "P1", "cost": 4, "costIsMaterials": true, "delayDays": 0, "burstGameMinutes": 120, "burst": 0.25, "durationDays": 3, "peak": 0.05, "halfLifeDays": 3,
      "profiles": { "presses": 1, "flaneurs": 1, "promeneurs": 1, "familles": 1 } },
    { "id": "partenariat_godillots", "tier": "P1", "cost": 30, "unlockEvent": "les_godillots", "requiresDiscount": "randonneurs", "delayDays": 1, "durationDays": 99, "peak": 0.12, "halfLifeDays": 999, "weekdays": ["sat", "sun"],
      "profiles": { "promeneurs": 1 } },
    { "id": "gouter_ecole", "tier": "P1", "cost": 4.4, "costIsMaterials": true, "unlockEvent": "jules_a_perdu_sa_mamie", "everyWeekday": "wed", "durationDays": 7, "peak": 0.05, "halfLifeDays": 999, "weekdayPeak": { "wed": 0.1 },
      "profiles": { "familles": 1 } },
    { "id": "vitrine_arvelle", "tier": "P1", "cost": 10, "perWeek": true, "delayDays": 1, "durationDays": 7, "peak": 0.06, "halfLifeDays": 999, "ambianceDivisor": 60, "ambianceBounds": [0.6, 1.3],
      "profiles": { "promeneurs": 1, "connaisseurs": 1, "flaneurs": 0.7, "gourmands": 0.7 } },
    { "id": "babillard", "tier": "P1", "cost": 0, "delayDays": 1, "durationDays": 2, "peak": 0.03, "halfLifeDays": 1,
      "profiles": { "voisins": 1, "familles": 1 } }
  ]
}
```

Plages conseillées pour l'équilibrage:

| Clé | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| `satisfactionWeight` | 0,5 | facteur | 0 à 1 | une remise plaît moins qu'un prix juste; à 1, les remises achèteraient deux fois plus de réputation |
| `happyHour.rates` | 10, 20, 30 | % | 5 à 40 | au-delà de 30 %, les boissons tombent près du revient des laits |
| `loyaltyCard.stamps` | 8 | tampons | 6 à 10 | le neuvième offert est l'usage le plus courant d'un petit café; 11 % de remise sur le café |
| `loyaltyCard.attractionBonusMax` | 10 | % | 5 à 15 | à 6 %, la carte coûtait 18 € pour 7 groupes de plus: trop peu pour se sentir; à 10 %, elle reste un levier de réputation (-12 € pour +10 groupes et +45 points) |
| `dailyOffer.pickWeight` | 2 | facteur | 1,5 à 3 | une ligne mise en avant sur l'ardoise se vend environ deux fois plus |
| `maxBoost` | 35 | % | 25 à 50 | un village ne double pas sa clientèle par la publicité |
| `repeatFactor` | 0,6 | facteur | 0,4 à 0,8 | relancer trop tôt lasse, sans punir |
| `encart_echo.peak` | 14 | % | 10 à 18 | sous l'article gratuit du carnet vert (+15 %) |
| `prospectus_marche.peak` | 20 | % | 15 à 30 | fort et bref: demi-vie d'un jour et demi |

## 8. Simulation

Commande: `python3 -I -B docs/jeux/cosy-cafe/demo/simulations/remises_marketing_v0_2.py` (moins d'une seconde, 8 parties par duo et par stratégie, graines 2000 à 2007).

Modèle (au jour, pas client par client, voir l'en-tête du script): la partie de référence est la partie médiane du duo médian (`demo-v0-1.md`, 6.4) avec les coûts de la v0.2; la demande du jour se répartit entre les profils du jeu; la salle a une capacité douce (42 groupes par jour avant la terrasse, 46 après, ajustée sur les jours 10 à 14: elle retrouve les 38 % de renvoyés de la fête); remises et actions multiplient la demande d'un profil avec les facteurs du jeu (`priceFactor`, `priceBounds`, `cupFactors`) et les tables de la section 7; un groupe de plus rapporte le ticket moyen du jour moins ses matières; la remise coûte sur tous les groupes concernés; la terrasse s'achète le premier soir, dès le jour 9, où la caisse dépasse 450 € plus la réserve. Les duos tranquille et rapide ont 12 % de capacité en moins et 8 % en plus (hypothèse).

### 8.1 Duo médian, toutes les stratégies (médianes de 8 parties)

Groupes en plus: sur les 12 jours ouverts, par rapport à la partie sans rien (environ 350 groupes servis). Gain net: marge des groupes en plus, moins les remises consenties à tous les groupes concernés, moins le coût des actions. Renommée: points en plus au soir du jour 14 (la référence finit à 1 425).

| Stratégie | Coût des actions | Remises consenties | Groupes en plus | Gain net sur la démo | Renommée en plus | Terrasse achetée le soir | Trois tasses au soir 13 | Renvoyés à la fête |
|---|---|---|---|---|---|---|---|---|
| Rien (référence) | 0 € | 0 € | +0,0 | +0 € | +0 | 11 | 8 sur 8 | 38 % |
| Heure douce 15 h à 17 h, -20 %, mardi à vendredi | 0 € | 61 € | +12,3 | +15 € | +65 | 11 | 8 sur 8 | 38 % |
| Heure douce 15 h à 17 h, -20 %, tous les jours | 0 € | 105 € | +16,0 | +0 € | +93 | 11 | 8 sur 8 | 41 % |
| Heure douce 8 h à 10 h, -20 %, mardi à vendredi (heure de pointe) | 0 € | 35 € | +13,5 | +13 € | +73 | 11 | 8 sur 8 | 38 % |
| Heure douce 15 h à 17 h, -30 %, mardi à vendredi | 0 € | 93 € | +14,3 | -3 € | +80 | 11 | 8 sur 8 | 38 % |
| Carte de fidélité dès le jour 2 | 15 € | 18 € | +10,5 | -12 € | +45 | 11 | 8 sur 8 | 39 % |
| Tarif randonneur -10 %, mardi à vendredi | 0 € | 23 € | +1,8 | -9 € | +11 | 11 | 8 sur 8 | 38 % |
| Tarif randonneur -20 %, mardi à vendredi | 0 € | 51 € | +4,7 | -18 € | +23 | 11 | 8 sur 8 | 38 % |
| Tarif randonneur -10 %, tous les jours | 0 € | 50 € | +4,3 | -20 € | +22 | 11 | 8 sur 8 | 39 % |
| Affiche chez Lucas, soirs 2 et 9 | 16 € | 0 € | +7,1 | +12 € | +22 | 11 | 8 sur 8 | 38 % |
| Affiche à la mairie-école, soir 2 | 8 € | 0 € | +3,0 | +14 € | +10 | 11 | 8 sur 8 | 38 % |
| Prospectus au marché, soir 5 (samedi 6) | 20 € | 0 € | +5,2 | +21 € | +15 | 11 | 8 sur 8 | 38 % |
| Prospectus au marché, soir 12 (samedi 13) | 20 € | 0 € | +2,2 | +2 € | +8 | 11 | 8 sur 8 | 41 % |
| Encart dans L'Écho, soir 2 (paraît jeudi 4) | 45 € | 0 € | +10,6 | +25 € | +38 | 11 | 8 sur 8 | 38 % |
| Encart dans L'Écho, soir 9 (paraît jeudi 11) | 45 € | 0 € | +5,3 | -8 € | +20 | 11 | 8 sur 8 | 41 % |
| Tout, tout le temps | 169 € | 175 € | +52,4 | -44 € | +242 | 11 | 8 sur 8 | 46 % |
| Panachage réfléchi | 88 € | 83 € | +38,0 | +37 € | +165 | 11 | 8 sur 8 | 39 % |

### 8.2 Duos tranquille et rapide (extrait)

| Duo | Stratégie | Coût des actions | Remises consenties | Groupes en plus | Gain net sur la démo | Renommée en plus | Terrasse achetée le soir | Trois tasses au soir 13 | Renvoyés à la fête |
|---|---|---|---|---|---|---|---|---|---|
| Duo tranquille | Rien (référence) | 0 € | 0 € | +0,0 | +0 € | +0 | 11 | 8 sur 8 | 38 % |
| Duo tranquille | Heure douce 15 h à 17 h, -20 %, mardi à vendredi | 0 € | 61 € | +10,5 | +5 € | +58 | 11 | 8 sur 8 | 38 % |
| Duo tranquille | Carte de fidélité dès le jour 2 | 15 € | 18 € | +8,5 | -23 € | +37 | 11 | 8 sur 8 | 39 % |
| Duo tranquille | Encart dans L'Écho, soir 2 (paraît jeudi 4) | 45 € | 0 € | +8,9 | +15 € | +32 | 11 | 8 sur 8 | 38 % |
| Duo tranquille | Encart dans L'Écho, soir 9 (paraît jeudi 11) | 45 € | 0 € | +3,8 | -17 € | +14 | 11 | 8 sur 8 | 41 % |
| Duo tranquille | Tout, tout le temps | 169 € | 166 € | +31,1 | -150 € | +151 | 14 | 8 sur 8 | 51 % |
| Duo tranquille | Panachage réfléchi | 88 € | 81 € | +31,1 | +1 € | +138 | 11 | 8 sur 8 | 39 % |
| Duo rapide | Rien (référence) | 0 € | 0 € | +0,0 | +0 € | +0 | 11 | 8 sur 8 | 38 % |
| Duo rapide | Heure douce 15 h à 17 h, -20 %, mardi à vendredi | 0 € | 62 € | +13,3 | +19 € | +68 | 11 | 8 sur 8 | 38 % |
| Duo rapide | Carte de fidélité dès le jour 2 | 15 € | 18 € | +12,5 | -2 € | +53 | 11 | 8 sur 8 | 39 % |
| Duo rapide | Encart dans L'Écho, soir 2 (paraît jeudi 4) | 45 € | 0 € | +11,4 | +29 € | +41 | 11 | 8 sur 8 | 38 % |
| Duo rapide | Encart dans L'Écho, soir 9 (paraît jeudi 11) | 45 € | 0 € | +6,0 | -5 € | +23 | 11 | 8 sur 8 | 41 % |
| Duo rapide | Tout, tout le temps | 169 € | 177 € | +58,7 | -11 € | +266 | 11 | 8 sur 8 | 46 % |
| Duo rapide | Panachage réfléchi | 88 € | 84 € | +41,7 | +56 € | +178 | 11 | 8 sur 8 | 39 % |

### 8.3 Le compteur du bilan, action par action (duo médian, graine 2000, action seule)

| Action (soir de lancement) | Coût | Clients venus (compteur du bilan) | Coût par client venu | Marge rapportée |
|---|---|---|---|---|
| affiche_boulangerie (soir 2) | 8 € | 4,5 | 1,78 € | 16 € |
| affiche_boulangerie (soir 9) | 8 € | 5,4 | 1,49 € | 11 € |
| affiche_mairie (soir 2) | 8 € | 3,4 | 2,33 € | 22 € |
| prospectus_marche (soir 5) | 20 € | 4,8 | 4,15 € | 35 € |
| prospectus_marche (soir 12) | 20 € | 5,7 | 3,51 € | 22 € |
| encart_echo (soir 2) | 45 € | 11,3 | 3,98 € | 63 € |
| encart_echo (soir 9) | 45 € | 9,6 | 4,71 € | 37 € |

### 8.4 L'offre du jour sur une tarte de 8 parts (3,20 €, revient 1,60 €; 4 000 tirages par ligne)

| Parts à finir demain | Ventes habituelles de tarte ce jour-là | Sans offre: recette des vieilles parts, perte | Offre -30 %: recette, perte | Écart de caisse avec l'offre |
|---|---|---|---|---|
| 2 | 3,0 | 5,58 €, 0,41 € | 4,46 €, 0,01 € | -1,12 € |
| 4 | 3,0 | 8,55 €, 2,13 € | 8,74 €, 0,16 € | +0,19 € |
| 6 | 3,0 | 9,41 €, 4,89 € | 12,26 €, 0,84 € | +2,85 € |
| 6 | 1,5 | 4,83 €, 7,18 € | 7,83 €, 4,01 € | +3,00 € |
| 8 | 1,5 | 4,76 €, 10,42 € | 7,99 €, 7,10 € | +3,23 € |


### 8.5 Lecture

- **Rien n'est obligatoire.** Sans aucun levier, la démo est celle de la v0.2: terrasse achetée le soir 11, trois tasses au soir 13 dans 8 parties sur 8 pour les trois duos. Les meilleurs leviers rapportent 15 à 25 € sur la démo (environ 1 % des gains): ils se sentent au bilan du jour (« environ 4 clients ») sans changer la progression.
- **Le moment compte.** L'encart dans L'Écho rapporte quand il paraît un jeudi creux (soir 2: +25 €) et coûte quand il paraît juste avant la fête (soir 9: -8 €), parce que le dimanche 14 est déjà plein (41 % de renvoyés au lieu de 38 %: les clients en plus restent à la porte). Même chose pour les prospectus: samedi 6 +21 €, samedi 13 +2 €.
- **La cible compte.** L'heure douce l'après-midi de semaine paie (+15 €, +12 groupes, +65 points); tous les jours, elle ne rapporte plus rien (week-end plein); à -30 %, elle coûte. Le tarif randonneur coûte toujours un peu au village (-9 à -20 €): les promeneurs viennent le week-end, quand il n'y a plus de place; c'est un geste d'accueil, et le partenariat des Godillots (P1) lui donnera sa raison d'être.
- **Réputation ou caisse.** La carte de fidélité coûte environ 12 € au duo médian mais rapporte 10 groupes et 45 points de renommée: c'est un levier de réputation, assumé. Les remises en général achètent des clients et de la renommée; la publicité bien placée achète de la marge.
- **Le plafond tient.** « Tout, tout le temps » fait venir 52 groupes de plus, mais coûte 44 € au duo médian et 150 € au duo tranquille, dont la terrasse n'arrive alors que le soir 14, trop tard pour la fête. Ce n'est pas une punition (on a dépensé 340 €), mais Simone prévient (astuce du soir: « Gardez de quoi faire la terrasse. » quand les actions et remises de la semaine dépassent 100 €). Le panachage réfléchi (heure douce de semaine, carte, affiche à la mairie, encart du jeudi 4, prospectus du samedi 6) fait mieux que tout faire: +37 € et +165 points.
- **L'offre du jour** paie quand le reste dépasse les ventes habituelles (6 parts pour 3 vendues d'habitude: +2,85 €, et 4 € de perte évitée), et coûte quand le lot serait parti de toute façon (2 parts: -1,12 €). D'où la règle de suggestion de la tablette.
- **Durée**: le service ne change pas (mêmes horaires, même cadence). Les deux onglets ajoutent environ 30 s à 1 min certains soirs: 5 à 10 min sur la démo, soit 4,2 à 4,3 h pour le duo médian (estimation, non simulée).

Ce que le modèle ne couvre pas: la capacité heure par heure (une heure douce à 8 h, en pleine pointe des pressés, ressort ici à +13 €; dans le jeu, la file d'attente du matin la rendra moins bonne: à vérifier dans la simulation client par client avant de régler les valeurs finales), la météo (la pluie vide la terrasse et réduit les promeneurs), les formules (P1), les actions P1, un duo qui adapte ses commandes à ses remises.

## 9. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| Id | Critère | Vérification |
|---|---|---|
| RM-01 | Sans aucune remise ni action, l'économie est identique à la v0.2 (caisse et bilan au centime sur 15 jours, mêmes graines) | `recette-quinze-jours.test.ts`, comparaison avec la v0.2 |
| RM-02 | Heure douce 15 h-17 h à -20 %: une boisson commandée par un groupe arrivé à 15 h 30 est payée 80 % du prix de la ligne, arrondie au dixième inférieur; à 17 h 10, au prix plein; un mets n'est jamais remisé | test sur `linePrice` et `takeOrder` |
| RM-03 | Un prix remisé n'est jamais sous le revient de la recette (croissant à -50 %: 0,70 €) | test |
| RM-04 | Deux remises possibles sur une ligne: seule la plus forte s'applique | test (promeneur pendant l'heure douce) |
| RM-05 | Pendant l'heure douce, l'attrait calculé des pressés à -20 % vaut celui hors créneau multiplié par `priceFactor` à l'indice remisé (borné par `priceBounds`) | test sur `attraction` |
| RM-06 | Carte de fidélité: un habitué qui a 8 tampons ne paie pas son café suivant, le ticket affiche « Neuvième café offert », ses tampons repartent à 0; la marchandise est consommée | test |
| RM-07 | Carte de fidélité impossible à activer sans l'achat « Cartes de fidélité » | test et capture de l'onglet |
| RM-08 | Offre du jour: la recette choisie se vend plus souvent (tirage x 2, poids de famille + 1) et à son prix remisé; elle s'efface le soir | test sur `groupOrder` avec graine fixe, 1 000 tirages |
| RM-09 | La tablette suggère l'offre du jour seulement quand un lot finit demain et que son reste dépasse les ventes habituelles de la recette | test à deux cas |
| RM-10 | Une action lancée le soir est débitée le soir même (ligne « Publicité »), le résultat du bilan reste la somme de ses lignes | `recette-quinze-jours.test.ts` |
| RM-11 | L'encart commandé un mardi soir agit dès le jeudi; commandé un mercredi soir, le jeudi de la semaine suivante | test des jours 2, 3, 9 |
| RM-12 | Facteur de marketing d'un profil = `1 + 0,35 x (1 - exp(-E / 0,35))`, jamais au-delà de 1,35, quel que soit le nombre d'actions | test avec toutes les actions P0 en même temps |
| RM-13 | Relancer une action moins de 7 jours après sa fin donne 60 % de l'effet; une action en cours ne se relance pas | test et capture |
| RM-14 | Le compteur « Venus grâce à » du bilan égale, arrondie, la somme des parts `(F - 1) / F` des groupes servis, répartie entre actions | test |
| RM-15 | Un jour avec une action en cours, au moins un mot du livre d'or de l'action peut paraître (graine fixe), jamais deux fois la même action le même jour | test |
| RM-16 | Les habitués ne sont pas comptés dans les clients venus grâce à une action | test |
| RM-17 | L'ardoise montre chaque remise active; pendant l'heure douce, les prix des boissons sont barrés avec le prix remisé | capture de l'ardoise à 15 h 30 |
| RM-18 | Le ticket montre le nom et le montant de chaque remise | capture d'un ticket |
| RM-19 | Une partie v0.2 sauvegardée se reprend sans remise ni campagne, sans erreur | test de reprise |
| RM-20 | Démo jouée par les robots avec toutes les actions P0 et les remises par défaut: caisse jamais négative au soir, aucune exception, terrasse achetable avant la fête | `recette-quinze-jours.test.ts` (variante) |
| RM-21 | Aucun texte nouveau ne contient de tiret cadratin ni demi-cadratin, ni de nom de marque ou de plateforme réelle | contrôle typographique et relecture |

## 10. Questions pour le client

1. **Le petit marché du samedi à Ormeval**: on l'ajoute au village (trois étals, le samedi matin), pour que les prospectus aient un lieu ? Recommandation: oui, invisible en P0 (Mireille distribue), visible en P1.
2. **Remises le jour de la fête**: on laisse le choix (avec un avertissement la veille) ou on les suspend d'office ? Recommandation: laisser le choix, c'est une leçon qui se comprend au bilan, sans gâcher la fête.
3. **Formules** (petit-déjeuner, goûter): en P1, après une simulation client par client ? Recommandation: oui; elles touchent la façon dont les clients composent leur commande, c'est le point délicat.
4. **Durée de la démo**: les deux onglets ajoutent environ 30 s à 1 min de réflexion certains soirs, soit 5 à 10 min sur la démo (4,2 à 4,3 h pour le duo médian). Ça te va ? Recommandation: oui; le service ne s'allonge pas.
