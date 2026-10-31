# Données de la démo de La Petite Ligne

Ces fichiers contiennent tout le contenu et tous les réglages de la démo d'une heure (`docs/jeux/jeu-1/demo.md`). Le code les charge tels quels: aucun texte affiché ni aucune valeur de jeu ne doit être écrit en dur dans le code (règle de CLAUDE.md). Le dossier `cartes/` appartient au level designer.

Validation, à lancer après chaque modification et en CI:

```sh
python3 games/la-petite-ligne/outils/valider_donnees.py
```

Code de sortie 0 si aucune erreur. Tant que `cartes/` est vide, le validateur avertit et liste les points de carte que les données attendent.

## 1. Conventions

- JSON en UTF-8, un objet racine avec `"version": 1`. La version augmente à chaque changement incompatible de schéma.
- Identifiants (`id` et toute référence): anglais, `snake_case` (`^[a-z][a-z0-9_]*$`), uniques dans leur famille. Les identifiants de dialogue sont uniques pour tout le jeu.
- Clés des champs en `camelCase`, comme le manifeste `duo-game.json`.
- Heures de jeu en texte `"HH:MM"`, de `"00:00"` à `"24:00"`. Jours de la démo: entiers de 1 à 8 (le jour 1 est un samedi). Jours de la semaine: `saturday` à `friday`.
- Textes affichés: en français, tutoiement de chaque joueur, « vous » quand on parle aux deux, rédaction neutre (jamais d'accord au genre d'un joueur: « Personne n'était descendu ici depuis vingt ans », « Venez à deux », « de nouvelles têtes »), aucun tiret cadratin ni demi-cadratin. Le validateur refuse les tirets longs et avertit des tournures genrées les plus courantes (à relire, il ne les voit pas toutes).
- `tier`: `"P0"` (indispensable à la démo) ou `"P1"` (si le temps le permet). Un élément P1 peut rester absent du jeu sans rien casser: les données qui en dépendent sont aussi en P1, ou gardées par un drapeau (`fishing_enabled`).
- Modèles 3D: le champ `model` donne le nom du fichier attendu de l'artiste (`radish` correspond à `radish.glb`). Les stades des cultures s'appellent `<culture>_stage_<stade>`, les habitants `villager_<id>`.

### Espaces réservés dans les textes

Le code remplace `{nom}` dans les textes. Seuls ceux-ci existent (le validateur refuse les autres):

| Nom | Remplacé par |
|---|---|
| `{partner}` | prénom de l'autre joueur |
| `{order}` | liste des lignes de la commande (`reglages.order.lines`, mise en forme par `textes.orderFormat`), par exemple « 12 radis, 3 laitues, 6 œufs, 10 planches » |
| `{startPurse}`, `{bigPurchase}` | `reglages.economy.startPurse`, `reglages.economy.bigPurchaseThreshold` |
| `{linesDone}`, `{linesTotal}`, `{amount}` | lignes remplies, lignes de la commande, somme payée au départ du train |
| `{item}`, `{count}`, `{price}`, `{missing}` | nom d'objet (singulier ou pluriel selon `count`), quantité, prix, somme ou objets manquants |
| `{recipe}`, `{envie}`, `{quest}`, `{title}`, `{construction}` | nom d'une recette, texte d'une envie, titre d'une quête, titre d'une lettre, nom d'une construction |
| `{weekday}`, `{day}`, `{hours}`, `{minutes}`, `{days}`, `{furniture}` | jour de la semaine (`textes.weekdays`), numéro du jour, heure, journées vécues, meubles posés |
| `{move}`, `{act}`, `{examine}`, `{notebook}` | libellés réels des touches des actions Se déplacer, Agir, Examiner, Carnet, selon le clavier du joueur |

## 2. Fichiers

| Fichier | Contenu |
|---|---|
| `objets.json` | objets, recettes (cuisine et établi), constructions guidées, inventaire de départ, bêtes |
| `cultures.json` | règles de pousse, qualités, états des cases, les trois cultures |
| `habitants.json` | les quatre habitants: identité, emploi du temps, dialogues |
| `quetes.json` | la trame (cinq quêtes) et les cinq quêtes secondaires |
| `courrier.json` | les lettres et leurs expéditeurs |
| `astuces.json` | le tutoriel doux, avec ses déclencheurs |
| `envies.json` | les envies du jour, personnelles et à deux |
| `textes.json` | forme du matin, messages, interface du jeu, écran de nuit, écran de fin |
| `reglages.json` | toutes les valeurs de réglage de la démo |

### 2.1 `objets.json`

`items[]`:

| Champ | Type | Valeurs |
|---|---|---|
| `id` | identifiant | |
| `name`, `plural` | texte | nom au singulier et au pluriel, sans article (« laitue », « laitues ») |
| `indefinite` | texte | le nom au singulier avec son article indéfini (« une laitue », « un œuf », « des rideaux »), pour les phrases du type « Sacha propose d'acheter un matelas »; le validateur demande « un », « une » ou « des » suivi exactement de `name` |
| `category` | texte | `seed`, `crop`, `forage`, `animal_product`, `material`, `carried`, `tool`, `food`, `quest`, `fish`, `decoration`, `furniture` |
| `stack` | entier ≥ 1 | taille d'une pile dans le sac (1 pour les outils et les meubles) |
| `buyPrice` | entier ou `null` | prix d'achat en boutique, en sous; `null` si l'objet ne s'achète pas |
| `sellPrice` | entier ou `null` | prix de base, qualité ordinaire; `null` si l'objet ne se vend pas. Odette paie `buyRate` fois ce prix, la caisse du train ce prix exact |
| `shop` | `"grocery"`, `"catalogue"` ou `null` | où l'acheter; le catalogue livre au train du jour 8 |
| `model` | texte | modèle 3D |
| `tier` | `"P0"` ou `"P1"` | |
| `plants` | identifiant de culture | graines seulement |
| `qualities` | liste | récoltes: `["ordinary", "fine"]` |
| `dish` | `"bread"`, `"simple"`, `"stew"` | plats: fixe le Ventre du souper et l'endurance rendue (`reglages.needs.belly`, `reglages.snacks`) |
| `capacity` | entier | arrosoir: coups avant de le remplir |
| `carriedByTwo` | booléen | se porte à deux (la poutre) |
| `readText` | clé de `textes.messages` | objet qu'on peut lire (la carte d'Émile) |
| `footprint` | `{ "w", "d" }` en cases | meubles et décorations |
| `comfort`, `beauty` | entiers de 0 à 5 | meubles et décorations |
| `bed` | `{ "sleep", "sleepers" }` | lits: Sommeil donné, nombre de dormeurs |
| `dining`, `seat`, `light`, `floor`, `wall` | booléens | table (souper partagé), siège, lumière, se pose au sol sous les autres meubles, se pose au mur |
| `storage` | `"cellar"` | le coffre ouvre le cellier commun |
| `station` | `"stove"` | le réchaud est un poste de cuisine |

`recipes[]`: `id`, `name`, `station` (`workbench` pour l'établi de Basile, `stove` pour le réchaud), `inputs` (liste de `{ item, count }`), `output` (`{ item, count }`), `seconds` (durée de l'action maintenue), `requiresUnlock` (booléen: la recette doit être débloquée par l'effet `unlock_recipe`).

`constructions[]`: `id`, `name`, `point` (où elle se trouve), `kind`:

- `carry`: un objet à porter à deux (`carry.item`) depuis un point (`carry.from`) jusqu'au point de la construction; elle est « construite » quand l'objet y est posé;
- `guided`: des éléments fantômes déjà placés (`elements[]`: `id`, `inputs`, `seconds`), bâtis en maintenant l'action; les matériaux viennent du sac de celui qui travaille, puis du cellier; deux joueurs sur le même élément vont `reglages.building.twoPlayersSpeedMultiplier` fois plus vite. `requires` liste les constructions à achever avant.

`startingInventory`: `cellar` (le coffre), `eachPlayer` (le sac de chaque joueur), `houseFurniture` (meubles déjà posés dans la maisonnette; leur placement initial est dans la carte).

`animals[]`: `id`, `name`, `plural`, `model`, `variants` (modèles par bête), `produces` (`{ item, count, per: "day", requires: "fed" }`: chaque matin, une bête nourrie la veille produit).

### 2.2 `cultures.json`

- `qualities[]`: `id` (`ordinary`, `fine`), `name` affiché, `priceMultiplier`.
- `cellStates[]`: états d'une case du potager (`grass`, `tilled`, `tilled_wet`) et leur modèle.
- `crops[]`: `id`, `name`, `seed` et `harvest` (objets), `growthDays`, `yieldPerCell` (unités récoltées par case), `regrows` (faux dans la démo), `needsWaterDaily`, `seasons`, `stagesByDay` (stade affiché selon le nombre de jours de pousse déjà acquis: l'entrée 0 au semis, la dernière, toujours `ripe`, à `growthDays`), `models` (modèle de chaque stade), `tier`.
- Règles (`rules`, pour mémoire): chaque matin à 6 h, une culture arrosée la veille (arrosoir ou pluie, `reglages.weatherByDay`) gagne un jour; sinon elle attend sans dépérir. Arrosée chaque jour de sa pousse, elle donne la qualité `fine` (« belle »). Récoltée, la case redevient `tilled`. Arrachée avant d'être mûre, elle rend son sachet de graines.

### 2.3 `habitants.json`

`villagers[]`:

| Champ | Type | Valeurs |
|---|---|---|
| `id`, `firstName`, `lastName`, `label` | | `label` est le nom affiché au-dessus des répliques |
| `role` | texte | pour mémoire |
| `model`, `scale`, `soundMotif` | | `scale` 0,75 pour Jeanne; `soundMotif` est le petit motif instrumental joué à l'ouverture d'une conversation (P1) |
| `schedule[]` | liste ordonnée | `{ when?, from, to, point, activity }` |
| `dialogues[]` | liste | voir ci-dessous |

**Emploi du temps**: à chaque instant, l'habitant suit la première entrée dont l'heure est dans `[from, to[` et dont toutes les conditions `when` sont vraies. Il marche d'un point à l'autre quand l'entrée change. Activités: `home` (chez lui, invisible, on ne peut pas lui parler), `absent` (hors du jeu), `stand`, `serve` (au comptoir: ouvre la boutique), `work`, `play`, `host` (reçoit à table), `wait_train`. Le point `offstage` est hors de la carte.

**Dialogues**:

| Champ | Type | Valeurs |
|---|---|---|
| `id` | identifiant unique dans tout le jeu | |
| `kind` | texte | `meeting` (première rencontre), `daily` (quotidien), `quest`, `hint` (indice), `scene` (scène, souvent à deux), `ending` (fin de la démo) |
| `when` | conditions | toutes vraies pour que le dialogue soit proposé |
| `priority` | entier | le plus grand l'emporte |
| `once` | `"player"` ou `"duo"` | joué une seule fois par joueur, ou une seule fois pour le duo; absent: répétable |
| `shared` | booléen | scène à deux: elle ne se lance que quand les deux joueurs sont près de `point` (portée `reglages.ranges.talk`), se joue sur les deux écrans et arrête l'horloge |
| `point` | point de carte | lieu d'une scène à deux |
| `lines` | liste | répliques `{ speaker, text }` (`speaker`: un habitant ou `narrator`), ou un bloc de choix `{ choices: [{ id, text, reply: [répliques] }] }` |
| `effects` | effets | appliqués à la fin du dialogue; `actor` y désigne le joueur qui parle |
| `tier` | | facultatif, P1 pour les dialogues de la pêche |

**Choisir ce que dit un habitant** quand un joueur lui parle (action Agir):

1. parmi les dialogues `meeting`, `quest`, `hint` et `scene` non partagés, non encore joués s'ils sont `once`, et dont `when` est vrai: le plus prioritaire;
2. sinon, un dialogue `daily` dont `when` est vrai: le plus prioritaire, et à priorité égale un tirage avec la graine du monde, en évitant la réplique que ce joueur a entendue la dernière fois.

Les dialogues `scene` partagés et `ending` ne se déclenchent pas par l'action Agir: une scène partagée se lance d'elle-même quand ses conditions sont vraies et que les deux joueurs sont à son point; une fin se lance par l'effet `play_dialogue`, sans regarder son `when` (laissé vide: c'est la quête qui choisit, par l'effet `if`).

**Choix dans une scène à deux** (règle HA-08 du cahier): chacun choisit sur son écran et voit le choix de l'autre. Si les deux choisissent le même, sa réponse est jouée une fois; sinon les deux réponses sont jouées l'une après l'autre. Un choix ne change jamais la suite d'une quête.

**Donner un objet**: quand une étape de quête active contient une condition `given` vers cet habitant et que le joueur a l'objet dans son sac, le dialogue propose en plus le choix « Donner {count} {item} » (`textes.ui.give`). Le donner retire l'objet du sac et compte pour la condition.

### 2.4 `quetes.json`

`quests[]`:

| Champ | Type | Valeurs |
|---|---|---|
| `id`, `title` | | `title` affiché au carnet |
| `kind` | `"main"` ou `"side"` | trame ou coup de main (`textes.ui.questKinds`) |
| `tier`, `giver` | | `giver`: l'habitant qui la donne |
| `start` | objet | `{ when: [conditions] }` (la quête démarre dès que tout est vrai), ou `{ byEffect: true }` (elle démarre par l'effet `start_quest`); `effects` facultatifs, appliqués au démarrage |
| `steps[]` | liste ordonnée | une étape à la fois, dans l'ordre |
| `completionEffects` | effets | à la fin de la dernière étape |
| `completionText` | texte | affiché au carnet et en notification |

Étape: `id`, `objective` (texte du carnet), `conditions` (toutes vraies: l'étape est finie; une condition peut porter un `label` affiché en liste à cocher), `effects` (à la fin de l'étape), et facultativement:

- `failText`: clé de `textes.messages`, affichée quand la condition d'événement de l'étape survient sans que les autres soient vraies (bêcher au bon endroit, mais pas à la bonne heure);
- `resolve: "at_deadline"` avec `deadline` (`{ day, time }`) et `onDeadline` (effets): l'étape se clôt à l'échéance, quoi qu'il arrive; ses conditions servent seulement à savoir si elle est remplie. C'est la commande du samedi.

Les conditions d'une étape sont évaluées à chaque changement d'état et à chaque événement. Une condition d'événement (`used_tool_at`) est vraie à l'instant de l'événement, et les autres conditions de la liste sont vérifiées à ce même instant.

### 2.5 `courrier.json`

`letters[]`: `id`, `from` (identifiant de `senders`), `title`, `delivery` (`{ day, time }`, ou `{ byEffect: true }` pour l'effet `send_letter`), et `text`, ou bien `variants` (`[{ when, text }]`: la première dont `when` est vrai; la dernière est sans condition). Une lettre arrive au tableau de la halte et dans l'onglet Courrier du carnet, chez les deux joueurs. `senders[]`: `id`, `label` affiché.

### 2.6 `astuces.json`

`hints[]`: `id`, `text`, `trigger`, `tier`. Une astuce s'affiche en bas de l'écran pendant `reglages.hints.durationSeconds`, une seule à la fois, une fois par joueur (`oncePerPlayer`), quand son déclencheur survient chez ce joueur. Elle ne bloque jamais rien.

| `trigger.on` | Paramètres | Survient quand le joueur... |
|---|---|---|
| `spawned` | | apparaît au début de la démo |
| `near_interactable` | | arrive pour la première fois à portée d'un objet ou d'une personne avec qui interagir |
| `tool_used` | | se sert pour la première fois d'un outil |
| `near_point` | `point` | arrive à portée d'action du point |
| `near_construction` | | arrive près d'un élément fantôme |
| `quest_started` | `quest` | voit démarrer la quête |
| `aim_cell` | `cellState`, `tool` ou `holding` | vise une case du potager dans cet état, avec cet outil ou un objet de cette catégorie en main |
| `sowed` | | sème pour la première fois |
| `tool_empty` | `item` | vide l'outil (l'arrosoir) |
| `crop_ripe_in_view` | | a une culture mûre à l'écran |
| `time_reached` | `time` | est dehors quand l'horloge atteint cette heure |
| `veillee_started` | | commence une veillée |
| `holding_furniture` | | tient un meuble à poser |
| `big_purchase_attempt` | | lance un achat d'au moins `bigPurchaseThreshold` sous |
| `letter_received` | | reçoit du courrier |

### 2.7 `envies.json`

`envies[]`: `id`, `kind` (`personal` ou `shared`), `text`, `availableWhen` (conditions pour que l'envie puisse être tirée ce matin-là), `fulfilledWhen` (conditions qui la réalisent; les conditions qui comptent partent du début de la journée). Chaque matin, chaque joueur tire une envie personnelle disponible, jamais deux fois la même pour lui (`reglages.envies`). `sharedSchedule[]`: le jour et l'envie à deux de ce jour, la même chez les deux. Réalisée, une envie donne Cœur +`reglages.needs.heart.envie` (+`sharedEnvie` à chacun pour une envie à deux) et le message `envie_done`. Non réalisée: rien.

### 2.8 `textes.json`

- `form[]`: les cinq niveaux de forme (`level`, `name`, `text` du réveil), dans l'ordre de `reglages.needs.formLevels`.
- `messages`: clé, texte. Les clés sont utilisées par le code (`already_taken`, `not_enough_money`, les refus de pose d'un meuble `placement_outside`, `placement_wall`, `placement_overlap`, `placement_occupied`, le poisson manqué `fish_escaped`...) et par les données (`show_text`, `failText`, `readText`).
- `orderFormat`: mise en forme de `{order}`: `line` pour chaque ligne, `separator` entre les lignes, `lastSeparator` avant la dernière.
- `ui`: libellés de l'interface propre au jeu (carnet, HUD, comptoir, catalogue, caisse, établi, réchaud, propositions, petit-déjeuner, création des personnages).
- `weekdays` (du samedi au vendredi, index = (jour - 1) modulo 7), `weather`, `nightScreen`, `endScreen`.

### 2.9 `reglages.json`

| Bloc | Contenu |
|---|---|
| `clock` | `secondsPerGameMinute` (0,35 s), début et fin de journée, début possible de la veillée, heure de départ du jour 1 (10 h), fin de la démo (jour 8, 16 h), jour de la semaine du jour 1, horloge arrêtée quand les deux sont dans un menu |
| `train` | jours, arrivée, départ |
| `weatherByDay` | huit valeurs, `sunny`, `cloudy` ou `rain`, du jour 1 au jour 8 |
| `spawn` | point d'apparition des deux joueurs |
| `economy` | bourse de départ, monnaie, seuil des gros achats (accord de l'autre), Odette (taux, plafond par jour, drapeau qui l'autorise à acheter), catalogue (date limite, livraison) |
| `order` | lignes de la commande, prime par ligne remplie, prime de commande complète; `crateAcceptsAnyItem` (la caisse prend aussi le reste, payé `extraItemsRate` fois le prix de base au départ du train) |
| `garden`, `quality`, `trees`, `hens` | potager (12 cases, zone de carte), qualité, arbres (nombre, zone, coups de hache, rondins), poules |
| `endurance` | `base + perFormPoint x forme`; coûts par action, multipliés par `costMultiplier`; à 0, les actions durent `atZeroDurationMultiplier` fois plus longtemps (jamais de blocage) |
| `snacks`, `needs` | endurance rendue par un en-cas; Ventre selon le souper, Sommeil (celui du lit, pénalité de minuit), Cœur, poids de la forme, seuils des niveaux de forme (`below`: le niveau vaut tant que la forme est inférieure à ce nombre) |
| `envies`, `movement`, `ranges`, `building`, `hints` | une envie par joueur et par jour; vitesses en m/s; portées en mètres; vitesse à deux; astuces |
| `absence`, `autosave`, `fishing` | P1: horloge arrêtée en cas d'absence, sauvegarde, pêche (le drapeau `fishing_enabled` est posé quand la pêche est activée) |
| `feel` | réglages fins dont le code a une valeur par défaut (`src/donnees/defauts.ts`); ceux écrits ici la remplacent. `fishWeights`: poids du tirage de chaque poisson (goujon 6, chevesne 3, truite 2) |

Paiement de la commande au départ du train (effet `pay_order`): chaque ligne remplie rapporte `count x sellPrice x linePremium`; si toutes les lignes sont remplies, le total gagne `fullBonus` en plus; les produits d'une ligne incomplète et tout le reste de la caisse sont payés `extraItemsRate x sellPrice`. Avec les valeurs actuelles, une commande complète rapporte 540 sous.

## 3. Conditions

Une condition est un objet `{ "type": ..., paramètres }`. Une liste de conditions est vraie quand toutes le sont. `label` (texte) est accepté partout: il sert de ligne à cocher au carnet.

Paramètres communs des conditions qui comptent:

- `count`: nombre minimal (1 par défaut);
- `who`: `"either"` (l'un ou l'autre, valeur par défaut; les deux cumulés pour un comptage), `"both"` (chacun des deux), `"actor"` (le joueur concerné: celui qui parle, agit ou a l'envie);
- `since`: à partir de quand on compte: `"step_start"` (par défaut dans une quête: le démarrage de l'étape), `"day_start"` (par défaut dans une envie: le début de la journée), `"game_start"`.

| `type` | Paramètres | Vraie quand |
|---|---|---|
| `all`, `any` | `conditions` | toutes, ou au moins une, des conditions sont vraies |
| `not` | `condition` | la condition est fausse |
| `day_is` | `days` (liste) | le jour en cours est dans la liste |
| `day_at_least` | `day` | le jour en cours est au moins celui-là |
| `weekday_is` | `weekdays` (liste) | le jour de la semaine est dans la liste |
| `time_is` | `from`, `to` | l'heure est dans `[from, to[` |
| `weather_is` | `weather` | la météo du jour est celle-là |
| `flag` | `flag` | le drapeau est posé |
| `quest_active`, `quest_done` | `quest` | la quête a démarré et n'est pas finie, ou elle est finie |
| `step_active`, `quest_step_done` | `quest`, `step` | l'étape est l'étape en cours, ou elle est finie |
| `dialogue_done` | `dialogue` | le dialogue a été joué jusqu'au bout (par au moins un joueur) |
| `talked_to` | `villager`, comptage | les joueurs ont parlé à l'habitant |
| `given` | `villager`, `item` facultatif, comptage | les joueurs ont donné cet objet (ou n'importe lequel) à l'habitant |
| `item_owned` | `item`, `count` | le duo possède l'objet: sacs des deux et cellier |
| `item_in_bag` | `item`, `count`, `who` | l'objet est dans le sac |
| `sowed` | `crop` facultatif, comptage | cases semées |
| `watered` | comptage | cases arrosées à l'arrosoir |
| `harvested` | `item`, `quality` facultatifs, comptage | unités récoltées |
| `chopped` | comptage | arbres abattus |
| `crafted` | `recipe`, comptage | recettes réalisées (établi ou réchaud) |
| `built` | `construction` | la construction est achevée |
| `placed` | `item` facultatif, comptage | meubles posés ou déplacés dans la maison |
| `ate` | `item`, comptage | plats mangés |
| `ate_together` | `atFurniture` facultatif | les deux ont mangé le même plat à moins de `ranges.eatTogether` l'un de l'autre, à ce meuble s'il est précisé |
| `went_to_bed` | `item` facultatif, `who` | le joueur s'est couché, dans ce lit s'il est précisé |
| `caught` | `item`, comptage | poissons pêchés (P1) |
| `used_tool_at` | `tool`, `point`, `radius` (m) | événement: le joueur se sert de l'outil à moins de `radius` du point |
| `stayed_at` | `point`, `seconds`, `who` | le joueur (ou chacun des deux, ensemble) est resté à moins de `ranges.stayAt` du point pendant ce temps d'affilée |
| `witnessed` | `event` (`train_arrival`, `train_departure`), `who` | le joueur était à moins de `ranges.witness` du train à ce moment-là |
| `nights_passed` | `count` | nuits passées depuis le démarrage de l'étape |
| `recipe_known` | `recipe` | la recette est débloquée |
| `order_complete` | | toutes les lignes de la commande sont dans la caisse; après le départ du train (`pay_order`), garde la réponse du moment du départ |

## 4. Effets

| `type` | Paramètres | Effet |
|---|---|---|
| `give_item` | `item`, `count`, `to` | donne l'objet: `actor` (le joueur concerné), `each` (un exemplaire à chacun), `cellar` (le cellier commun) |
| `take_item` | `item`, `count`, `from` | retire l'objet: `actor`, `either` (d'abord le sac de celui qui agit, puis l'autre), `cellar` |
| `give_money` | `amount` | ajoute à la bourse commune |
| `set_flag` | `flag` | pose un drapeau (un drapeau ne s'enlève pas) |
| `start_quest` | `quest` | démarre une quête `byEffect` |
| `send_letter` | `letter` | envoie une lettre `byEffect` |
| `unlock_recipe` | `recipe` | débloque une recette (ou un plan de meuble) chez les deux |
| `spawn_object` | `item`, `point` | fait apparaître l'objet au sol, à ce point |
| `spawn_animals` | `animal`, `count`, `point`, `names` | fait apparaître des bêtes, avec leurs noms |
| `set_need` | `need` (`belly`, `sleep`, `heart`), `value`, `who` | fixe un besoin pour la prochaine nuit |
| `play_dialogue` | `dialogue` | lance un dialogue; les effets suivants attendent sa fin |
| `gather_players` | `point` | ramène les deux joueurs à ce point, derrière un fondu |
| `show_text` | `text` | affiche un message de `textes.messages` chez les deux joueurs |
| `set_world_state` | `key`, `value` | change l'état d'un lieu: `handcar_shed` passe de `closed` à `open` (la remise s'ouvre sur la draisine) |
| `pay_order` | | paie la commande et vide la caisse (section 2.9) |
| `end_demo` | | affiche l'écran de fin (`textes.endScreen`) et clôt la séance |
| `if` | `condition`, `then`, `else` | applique `then` si la condition est vraie, sinon `else` |

Les effets d'une liste s'appliquent dans l'ordre, sur la machine hôte qui fait autorité; leurs résultats sont envoyés aux deux joueurs.

## 5. Points de carte attendus

Les données renvoient à ces points et zones nommés. Le level designer les crée dans `cartes/` avec exactement ces identifiants, sous une clé `points` (liste d'objets avec `id`, ou objet indexé par identifiant) ou `zones`. Le validateur les cherche dans tous les fichiers JSON de `cartes/`.

| Identifiant | Nature | Rôle |
|---|---|---|
| `train_stop` | point | porte de la voiture, apparition des joueurs, attente du train |
| `quay_bell` | point | la cloche du quai, Firmin, scène de fin |
| `quay_bench` | point | le banc près de la cloche, Jeanne le matin |
| `bell_shadow_spot` | point | au pied du banc, là où l'ombre de la cloche le touche à 17 h: on y bêche pour l'énigme |
| `coop_crate` | point | la caisse de la coopérative |
| `house_door` | point | porte de la maisonnette (toit et porte à construire) |
| `house_beam_spot` | point | où poser la poutre portée à deux |
| `house_attic` | point | le grenier, où apparaît la boîte en fer |
| `beam_pickup` | point | la poutre et Basile au jour 1 |
| `garden` | zone | les 12 cases du potager |
| `chicken_coop` | point | le poulailler et ses poules |
| `village_square` | point | la place, Jeanne le soir |
| `grocery_counter` | point | le comptoir d'Odette (la boutique) |
| `grocery_door` | point | la porte d'Odette, quand elle est chez elle |
| `grocery_terrace` | point | la tonnelle du souper de bienvenue |
| `firmin_house` | point | la maison de Firmin |
| `sawmill_workbench` | point | l'établi de Basile |
| `sawmill_yard` | point | la cour de la scierie, quand Basile est chez lui |
| `forest_edge` | zone | la lisière et ses 12 arbres |
| `riverbank` | point | la berge, Jeanne l'après-midi, les envies de la rivière |
| `river_ford` | point | le gué: pêche (P1) et astuce de la pêche |

Points aussi nécessaires au code, sans renvoi dans ces données: `well` (puits, remplir l'arrosoir), `water_barrel` (tonneau de la maisonnette), `notice_board` (tableau: commande, catalogue, courrier), `handcar_shed` (remise de la draisine), `house_interior` (zone: la pièce, pour la veillée et l'aménagement).

## 6. Ce que le code doit savoir

- Charger les neuf fichiers au démarrage, les valider (schéma Valibot côté TypeScript, aligné sur ce document) et refuser de démarrer sur une erreur, avec un message qui cite le fichier et le champ.
- L'hôte fait autorité: il évalue conditions et effets et envoie les résultats; l'invité n'affiche que ce qu'il reçoit (ADR 0007).
- Tirages (envies, répliques du quotidien à égalité): générateur à graine du SDK, jamais `Math.random`.
- Tout texte affiché vient de ces fichiers; les noms de touches viennent des réglages de Duo.
- Ce qui n'est pas ici reprend les règles du cahier des charges (`docs/jeux/jeu-1/cahier-des-charges.md`), et la démo les réduit (`docs/jeux/jeu-1/demo.md`, section 2).
