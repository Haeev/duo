# Cadrage: Cosy Café (titre de travail)

| Champ | Valeur |
|---|---|
| Identifiant | `cosy-cafe` (provisoire: suivra le titre retenu) |
| Statut | cadrage du manager, base commune de l'équipe pour écrire le cahier des charges |
| Date | 2026-11-07 |
| Suite | `docs/jeux/cosy-cafe/cahier-des-charges.md`, qui remplace ce cadrage une fois validé par le client |

## 1. La demande du client (2026-11-07)

Le client ouvre une conversation dédiée au deuxième jeu de Duo, « Cosy café ». Sa demande, reformulée sans nommer les jeux qu'il cite:

- un jeu en vue à la première personne, à deux, pour ouvrir un café, dans l'esprit des simulateurs de commerce en vue subjective (il cite une boutique de cartes à collectionner et une concession automobile);
- on commence dans une petite cellule commerciale de village;
- on achète meubles, décoration et produits;
- on sert des clients qui arrivent selon ce qu'on propose à la carte;
- on améliore, on gagne de l'argent, on passe à des cellules de plus en plus grandes, jusqu'à en avoir dans une grande métropole comme Paris, avec des employés.

Il attend le déroulé du jeu (gameplay, progression, style graphique) sous forme d'un cahier des charges précis. Pas de code à ce stade.

## 2. Le jeu en une phrase

- **Pitch** (proposition): à deux, ouvrez un petit café de village, faites-en l'endroit où l'on aime s'arrêter, puis faites grandir votre maison d'adresse en adresse jusqu'à Paris.
- **Fantasme**: « C'est notre café: on a choisi chaque meuble et chaque ligne de la carte, on connaît nos habitués par leur prénom, et on l'a fait grandir ensemble jusqu'à Paris. »

## 3. Ce qui est acquis

| Sujet | Décision de cadrage | Source |
|---|---|---|
| Genre | simulation de commerce: un café avec salon de thé et petite restauration sucrée et salée | client |
| Vue | 3D, à la première personne. « FPS » veut dire ici vue subjective: ni tir ni combat | client |
| Mode | coopération à deux, chacun sur sa machine, dans le même café; pot commun (caisse, stock, maison); aucun rôle imposé | client, manuel du studio |
| Ton | douillet: pas de faillite, pas de partie perdue, aucune perte définitive; le pire est une journée calme | titre du client, manuel du studio |
| Progression | d'une petite cellule de village à des adresses de plus en plus grandes, jusqu'à Paris, avec des employés et plusieurs cafés à la fin | client |
| Séances | 10 à 45 minutes; on s'arrête quand on veut sans rien perdre | manuel du studio |
| Machines | Mac M1 et PC de référence (Core i3 de 2018, Intel UHD 620, écran 1366x768 possible): budgets de `docs/plateforme/architecture.md`, section 14 | manuel du studio |
| Entrées | clavier AZERTY (touches lues par `KeyboardEvent.code`) et souris, pas de manette; Échap réservé à la pause de Duo | manuel du studio |
| Règles communes | hors ligne, français, tutoiement, aucun tiret cadratin ni demi-cadratin, création originale, cohérence du monde et sens du détail | `CLAUDE.md` |

## 4. Ossature proposée

Ces propositions donnent à l'équipe un vocabulaire et une ossature communs. Chaque chiffre est un ordre de grandeur: le game designer les fixe par simulation, le level designer les confronte aux plans, l'architecte aux budgets. Les identifiants entre crochets servent dans tous les documents. Un membre qui veut changer l'ossature le dit dans son compte rendu, avec la raison; il ne la change pas seul.

### 4.1 Piliers

1. **Le coup de feu à deux**: servir ensemble, se répartir les postes à la voix, sentir le service s'huiler de jour en jour.
2. **Notre carte, notre style, nos clients**: ce qu'on met à la carte, les meubles, la décoration et la musique décident de qui pousse la porte.
3. **Du comptoir de village à la maison parisienne**: chaque adresse est plus grande, plus vivante, plus exigeante; les précédentes restent dans la maison.

### 4.2 Une journée en trois temps

| Temps | Horloge | Ce qu'on y fait | Durée réelle visée |
|---|---|---|---|
| Préparation | arrêtée | ranger la livraison du matin, fournées et gâteaux, mise en place, carte du jour sur l'ardoise, décoration, achats | à votre rythme, 2 à 6 min |
| Service | tourne dès qu'on retourne la pancarte « Ouvert » | accueillir, prendre les commandes, préparer, servir, encaisser, débarrasser, laver, réassortir | 10 à 14 min |
| Fermeture | arrêtée | dernier rangement, caisse et bilan du jour, livre d'or, commandes aux fournisseurs, achats et travaux, « Nos projets » | à votre rythme, 2 à 5 min |

- Semaine de sept jours avec un jour de fermeture (travaux, brocante, visite des autres cafés), des jours de marché, la sortie d'école, le brunch du week-end. Saisons et météo changent les envies: boissons chaudes l'hiver, terrasse et boissons glacées l'été.
- Ordre de grandeur: une journée de 15 à 20 minutes; une séance de 40 minutes en fait deux.

### 4.3 La carte décide de la clientèle

- La carte du jour s'écrit sur l'ardoise: on choisit, parmi les recettes qu'on sait faire, celles qu'on propose et leur prix. Une ardoise de trottoir la montre à la rue: c'est elle qui fait entrer les clients.
- Chaque client appartient à un **profil**, attiré par certaines recettes, une fourchette de prix, un type de place, une ambiance, des heures, une météo. Le flux d'une heure dépend du quartier de l'adresse, de l'heure, du jour, de la météo, de la réputation et de l'attrait de ce qu'on propose pour chaque profil.
- Profils de départ: les pressés [`presses`], les flâneurs [`flaneurs`], les familles [`familles`], les gourmands [`gourmands`], les promeneurs (randonneurs et cyclistes à la campagne, touristes en ville) [`promeneurs`], les étudiants [`etudiants`], les télétravailleurs [`teletravail`], les bruncheurs du week-end [`brunch`], les amateurs de café de spécialité [`connaisseurs`]. Liste à affiner par le game designer. Un profil se définit par ce qu'il cherche, jamais par un stéréotype.
- Les **habitués** sont des personnages nommés: ils appartiennent à un profil, reviennent à leurs heures, ont une commande fétiche, une petite histoire qui avance de visite en visite, et des mots dans le livre d'or.

### 4.4 Postes et gestes

- Postes: comptoir et caisse, moulin et machine à espresso, buse vapeur, eau chaude et thés, four, plan de travail, vitrine, presse-agrumes et blender, plonge (évier, lave-vaisselle), réserve et réfrigérateurs, salle et terrasse.
- Une main, un objet; un plateau en porte plusieurs. Verbes: prendre, poser, utiliser un poste (clic ou maintien), verser, servir, encaisser, débarrasser, nettoyer, ranger, porter à deux, placer un meuble, écrire la carte, faire signe à l'autre.
- Les gestes se font à la main au début (moudre, tasser, lancer et arrêter l'extraction, mousser le lait à la bonne température, enfourner et défourner), avec une qualité qui récompense la précision sans jamais punir. Ils s'automatisent avec les machines achetées, puis avec les employés. Les gestes de savoir-faire (dessin sur le lait, pâtisserie maison) restent à la main pour qui les aime.
- Aide propre à chaque joueur, invisible pour l'autre: gestes simplifiés (un clic par geste, qualité « bien » assurée).

### 4.5 Ce qu'on achète

- Catalogue en familles: fonctionnel (comptoir, caisse, machines, vitrines, réfrigérateurs, étagères, plonge), assises, tables, luminaires, décoration (plantes, cadres, miroirs, tapis, objets), revêtements (peintures, papiers peints, sols), extérieur (terrasse, store, jardinières, enseigne, ardoise de trottoir).
- Styles de décoration, qui pèsent dans l'ambiance et dans les goûts des profils: campagne [`campagne`], bistrot [`bistrot`], nordique [`nordique`], jardin [`jardin`], atelier [`atelier`], rétro [`retro`]. Un ensemble cohérent vaut mieux qu'un entassement.
- Produits: matières premières (grains, lait, thés, chocolat, farine, beurre, fruits de saison) et produits finis achetés (au village, les viennoiseries du boulanger, tant qu'on n'a pas de four).
- Recettes: apprises au fil de la progression (fiches achetées, offertes par un habitué, découvertes de saison).

### 4.6 Ambiance, satisfaction, réputation

- **Ambiance** d'un lieu: décoration et cohérence du style, confort des places, propreté, lumière, musique, fréquentation (ni vide ni bondé).
- **Satisfaction** d'un client: attente, justesse de la commande, qualité, prix ressenti, place trouvée, ambiance. Elle décide du pourboire, d'un mot éventuel dans le livre d'or et de l'envie de revenir.
- **Réputation** de chaque café (de une à cinq tasses, par exemple) et **renommée** de la maison: elles attirent du monde et ouvrent les adresses suivantes.

### 4.7 Stock et fournisseurs

- On commande à la fermeture, on reçoit le lendemain matin, livré par des fournisseurs qui ont un visage (au village: une laitière, le boulanger, un petit torréfacteur; à Paris: un grossiste, un torréfacteur, une livraison en vélo cargo).
- Les cartons se rangent à la main au début (réserve, réfrigérateur); un commis le fera plus tard.
- Rien ne se perd: les invendus du jour partent à une association ou aux habitués, contre un peu de réputation.

### 4.8 Habitués et livre d'or

- Un livre d'or sur le comptoir: les clients y laissent des mots écrits à la main, qui disent aussi ce qui leur a plu ou manqué (« Pas trouvé de place pour m'asseoir, dommage »). C'est le principal retour du jeu, avant tout tableau de chiffres.
- Quatre à six habitués par adresse; certains suivent la maison et passent à Paris.

### 4.9 Employés

- Au départ pour le bourg, le café du village est confié à quelqu'un du village (proposition: l'ancienne patronne, qui reprend du service). Le vrai système d'employés arrive à la troisième adresse; un coup de main les jours de marché peut venir plus tôt.
- Rôles: service en salle, barista, commis, pâtisserie, plonge, gérance d'un café.
- Chaque employé a un nom, un caractère, des points forts, une humeur et un salaire; on lui confie des postes et des horaires; il progresse; on lui montre une recette pour qu'il la sache.
- Gérer sans dureté: ni licenciement brutal ni grève; un employé surmené ralentit et le dit.

### 4.10 Les adresses

| Ordre | Identifiant | Lieu (proposition) | Surface | Places assises (ordre de grandeur) | Nouveautés |
|---|---|---|---|---|---|
| 1 | `village` | cellule sur la place d'un village | 30 à 40 m² | 8 à 12, plus un banc et deux tables dehors | le service à deux, la carte, les gestes, la décoration, les habitués |
| 2 | `bourg` | boutique sur la grand-rue d'un bourg, près de la halle et de la gare | 60 à 80 m² | 20 à 28, terrasse | four et fournées, service à table, terrasse, jour de marché, gros meubles portés à deux |
| 3 | `ville` | ancien atelier dans une ville universitaire | 120 à 150 m² | 35 à 45, terrasse | deux salles, employés, brunch, café de spécialité, le café du village devient une succursale |
| 4 | `paris-quartier` | café d'angle dans un quartier de Paris (rues et commerces inventés) | 80 à 100 m² | 30 à 36, grande terrasse sur le trottoir | loyer et prix parisiens, flux très dense, touristes, équipe complète, gestion de plusieurs cafés |
| 5 | `paris-maison` | grande maison sous une verrière ou sur un boulevard, sur deux niveaux | 250 à 350 m² | 60 à 80, terrasse | torréfaction (notre mélange), laboratoire de pâtisserie, la reconnaissance d'un guide, la maison au complet |

- Avant de déménager, chaque adresse s'agrandit un peu (arrière-salle, terrasse, cuisine): on part quand on a vraiment rempli l'adresse.
- Durée visée pour un duo médian, à simuler: environ 35 heures du village à la grande maison parisienne, puis un jeu libre sans fin. Repère: une journée d'environ 18 minutes et quatre saisons de 28 jours font environ une année de jeu pour 35 heures.
- Plafond provisoire, à confirmer par l'architecte: environ 40 personnages animés visibles à la fois (clients, employés, joueurs). Un grand café se découpe en espaces qui ne se voient pas tous ensemble.

### 4.11 Plusieurs cafés

- Quand on quitte une adresse, son café reste ouvert, confié à une personne formée sur place. Il rapporte chaque jour un résultat calculé simplement (carte, prix, équipe, état, réputation), qu'on règle depuis la tablette de la maison.
- On peut y retourner jouer une journée quand on veut: on choisit l'adresse au début de la journée.
- Les deux joueurs sont toujours dans le même café (recommandation de cadrage, à confirmer par l'architecte puis par le client).

### 4.12 Notre maison

- Au début, le duo nomme sa maison et choisit son emblème et ses couleurs: enseigne, tasses, tabliers, livre d'or. Chacun personnalise son avatar (tablier à la couleur du joueur dans Duo par défaut).
- « Nos projets »: un carnet commun des rêves du duo, qui sert de liste d'objectifs (« Une vraie terrasse », « Notre propre mélange », « Ouvrir à Paris »).

### 4.13 Fil conducteur

- Point de départ: une annonce, « Café de la place cherche repreneurs ». L'ancienne patronne, partie à la retraite, vous confie les clés, devient votre première habituée et vous guide les premiers jours.
- Chaque adresse a son petit arc (la personne qui vous accueille, ses habitués, un défi local). La grande maison parisienne se conclut par la visite d'un guide inventé et par une fête qui réunit des habitués de toutes les adresses.

## 5. Expérience à deux: intentions

- La vue subjective crée l'asymétrie: chacun ne voit que ce qu'il regarde. « Trois personnes attendent à la caisse », « Il n'y a plus de tasses propres »: la parole devient l'outil principal.
- Les tickets de commande sont partagés sur un rail au-dessus du comptoir; un ticket pris prend la couleur de celui qui le prépare.
- On se passe un objet de la main à la main; on porte à deux les meubles lourds et les grosses livraisons, sans échec possible.
- Les gros achats et les déménagements demandent l'accord des deux.
- Deux niveaux différents: des postes calmes (caisse, salle, décoration) et des postes techniques (machine, four), des aides propres à chaque joueur, et rien qui compare les deux joueurs.
- Aucun temps mort: une journée calme laisse le temps de décorer, de faire une fournée, de parler avec un habitué.

## 6. Originalité

- On garde du genre: la vue subjective, les gestes concrets, acheter, aménager, servir, agrandir.
- On écarte les signes des jeux cités et des jeux de café existants: pas d'ordinateur de commande qui fait tomber des cartons sur le trottoir, pas de caisse où l'on scanne des articles, pas de rendu de monnaie en mini-jeu central, aucune interface ni aucun enchaînement reconnaissables.
- Notre identité: l'ardoise qui fait la clientèle, des fournisseurs qui ont un visage, le livre d'or, les habitués, un style cohérent qui compte, le couple au centre, le chemin du village à Paris.
- Le créneau est encombré (recherche web du 2026-11-07): un simulateur de café douillet sorti sur Steam en janvier 2026 sous le nom « Tailside: Cozy Cafe Sim », plusieurs simulateurs de café en vue subjective, dont un en coopération, et plusieurs petits jeux nommés « Cozy Cafe » (itch.io, Roblox). Chaque document s'en distingue par ses règles, son univers et sa présentation.

## 7. Qui écrit quoi

| Livrable | Membre | Chemin |
|---|---|---|
| Cahier des charges: sections 1 à 6, 11, 13 et 14, proposition de la section 12 | game-designer | `docs/jeux/cosy-cafe/cahier-des-charges.md` |
| Simulation de l'économie, du flux de clients et de la progression | game-designer | `docs/jeux/cosy-cafe/simulations/` |
| Les cinq adresses: lieux, plans, éléments fixes, circulation, extensions, quartiers | level-designer | `docs/jeux/cosy-cafe/adresses.md`, `docs/jeux/cosy-cafe/plans/` |
| Bible artistique (section 7) | directeur-artistique | `docs/jeux/cosy-cafe/bible-artistique.md`, `docs/jeux/cosy-cafe/bible/` |
| Direction sonore (section 8) | sound-designer | `docs/jeux/cosy-cafe/son.md` |
| Parcours, écrans, HUD, contrôles (sections 5 et 9) | ux-ui-designer | `docs/jeux/cosy-cafe/ux.md`, `design/maquettes/cosy-cafe/` |
| Technique, budgets et contraintes pour le design (section 10) | architecte-technique | `docs/jeux/cosy-cafe/technique.md` |
| Critères d'acceptation testables (section 12) | qa-testeur | deuxième temps, sur le cahier consolidé |
| Consolidation, résumés des sections 7 à 10, questions au client | manager | `docs/jeux/cosy-cafe/cahier-des-charges.md` |

Chacun n'écrit que dans ses fichiers. Une incohérence avec le travail d'un autre membre se signale dans le compte rendu: le manager tranche.

## 8. Questions déjà repérées pour le client

À reprendre, avec une recommandation chacune, dans la section 14 du cahier:

- le titre: « Cosy Café » est très utilisé (section 6);
- la durée de la progression principale (environ 35 heures proposées);
- Paris réel avec des rues et des commerces inventés, ou une métropole inventée;
- les deux joueurs toujours dans le même café, ou libres d'être dans deux cafés différents;
- les anciens cafés gardés en succursales, ou revendus.
