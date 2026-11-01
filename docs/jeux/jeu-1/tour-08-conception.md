# La Petite Ligne, tour 8: la suite après le jour 15 (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | conception, à produire au tour 8 |
| Version du document | 1 |
| Date | 2026-11-01 |
| Rédaction | game-designer (gauntlet, tour 8) |
| Point de départ | branche `claude/stoic-lamport-lueey2` à `a19d78e` (égale à `main`) |
| Sources | `gauntlet/revues/tour-07-game-designer.md` (priorités 1 et 2, tableau « ce qui avance sans les décisions »); `plan-100-heures.md` (arcs, R1 à R16, J1, lots L1 à L9, D1 à D9); `cahier-des-charges.md` (TE-02, FE-02 à FE-10, EC-05 à EC-11, HA-07, CN-04 à CN-06); `games/la-petite-ligne/ETAT.md`; `donnees/` (reglages, quetes, habitants, envies, moments, objets, cultures, courrier, cartes); `tour-07-conception.md` |
| Simulation | `simulations/tour8_suite.py` (bibliothèque standard, 65 s; `--rapide`: 8 s). Les tables 3.1, 4.2 et 5.2 sont relues par le script (partie 0): un écart entre ce document et le script fait échouer le contrôle |
| Décisions du client en attente | D1 à D9 du plan, questions 1 (la valse) et 2 (le train qui ralentit) du tour 7: rien de ce document ne les tranche; ce qui en dépend est un réglage (section 7) |

## En bref

**Pitch.** La démo s'arrête au jour 15, la Halte non: le temps, la saison, la lisière et la commande du samedi changent désormais d'eux-mêmes, et vous pouvez y vivre six semaines, jusqu'au premier matin d'automne.

**Fantasme.** « On se lève, on regarde le ciel, on lit la lettre de la coopérative, et on se partage la semaine: toi la rivière et les poules, moi le potager et la lisière. » Rien n'est écrit d'avance: la pluie arrose pour vous, les girolles sortent le lendemain, la souche que vous avez coupée la semaine dernière a déjà un rejet, et la commande de samedi ne ressemble pas à la précédente.

Ce que livre ce tour, sans aucune décision du client:

| # | Livraison | En une phrase | Section |
|---|---|---|---|
| 1 | Écran d'étape et « Rester à la Halte » | la sauvegarde du jour 15 continue; la partie va jusqu'au jour 43 à 16 h, puis un écran d'étape honnête l'arrête | 1 |
| 2 | Saisons | printemps jusqu'au jour 21, été du 22 au 42, automne au 43: palette, lumière, horaires des habitants, cueillette, poissons, envies et répliques changent | 2 |
| 3 | Météo tirée | soleil, nuages, pluie, et la brume du matin, tirés par la graine; trois jours de pluie au plus, jamais une semaine sans soleil | 3 |
| 4 | Commande du samedi générée | à partir du samedi 22, composée par la coopérative selon ce que vous savez produire, jamais deux fois la même, un peu plus grande à chaque réussite, jamais plus grande après un échec | 4 |
| 5 | Repousse et renouvellement | souches qui rejettent, sapins replantés, cueillette chaque matin, poissons de saison, envies et répliques d'été écrites | 5 |
| 6 | Robot longue vie et son rapport | 84 jours sur 4 graines en moins de 10 minutes, invariants qui font échouer, objectifs mesurés et listés | 6 |

Chiffres clés (simulation, section annexe A): météo à moins d'un point des fréquences visées après garde-fous; 0 commande identique à la précédente sur 27 000 commandes simulées; commandes complètes à 99,7 % pour un duo médian, 82,5 % pour un duo tranquille (97,4 % avec la commande « petite »); au jour 42, au moins 7 arbres abattables pour un duo médian; redites des répliques à moins de 28 jours: 0,5 % même pour un joueur qui parle à chaque habitant chaque jour (41,5 % sans les répliques nouvelles); 99,3 % des journées 16 à 43 avec au moins une première fois (estimation, le robot la mesurera).

## 0. Ce qui avance sans les décisions, et comment

| Chantier | Dépend de | Traitement dans ce tour |
|---|---|---|
| Écran d'étape, « Rester à la Halte » | D4 | marche dans les deux réponses: on prolonge la sauvegarde en cours de cette version; D4 ne change que la façon dont les jalons suivants s'ajoutent (section 7.2) |
| Rythme après le jour 23 | D1 | réglage `clock.schedule`; valeur livrée 0,35 s partout, parce que la carte reste compacte (section 7.1) |
| Saisons, météo, commande, repousse, cueillette, robot | rien | livrés |
| Contenu daté de J1 (fête du jour 16, inauguration du 23) | D6, D7 | pas livré; ce tour montre que ces dates ne tiendront plus et propose un ancrage par conditions (section 1.5) |
| Valse, bal, salut du mécanicien | D7, questions 1 et 2 du tour 7 | réglages posés, contenu non livré (section 7.4) |
| Ordre de l'année, maison, fin, livraisons | D2, D3, D8, D9 | rien à faire avant J2 |

## 1. Continuer après le jour 15

### 1.1 Les étapes

Une **étape** est un rendez-vous écrit dans les réglages où le jeu s'arrête sur un écran récapitulatif, puis propose de continuer. La démo en devient la première.

| Étape | Jour et heure | Après | Continuer | Écran |
|---|---|---|---|---|
| `demo` | samedi 15, 16 h | paiement de la commande 2, scènes de Firmin et de Basile, lettre `coop_recap_2` (inchangés) | oui | « Deux semaines à la Halte d'Aubrune » |
| `summer_end` | samedi 43, 16 h | paiement de la commande du jour 43, scène de Firmin (`firmin_stage_summer`) | seulement si `clock.lastDay` est après le jour 43 (une version future) | « Six semaines à la Halte d'Aubrune » |

Règles:

1. L'effet `end_demo` devient `end_stage` avec un paramètre `stage`; `end_demo` reste accepté et vaut `end_stage` de l'étape `demo`.
2. `end_stage` ne fait rien avant le jour et l'heure de son étape (garde-fou actuel de `finishDemo`, généralisé), ni si l'étape a déjà été franchie (`world.stages.passed` contient son identifiant).
3. Le bouton « Rester à la Halte » existe si et seulement si une journée jouable suit l'étape dans cette version (`clock.lastDay` est plus tard que l'heure de l'étape). Au jour 43, il est absent: l'écran le dit en clair (texte `stage.summer_end.next`).
4. `clock.lastDay` passe à `{ "day": 43, "end": "16:00" }`. C'est la seule limite de la partie; rien d'autre ne s'arrête au jour 15.

### 1.2 L'écran d'étape

Même gabarit que l'écran de fin actuel (`EndScreen`, `src/interface/ecrans.ts`): ticket « Samedi {day}, 16 h 00 · le train est reparti », trois compteurs (journées vécues, lignes des commandes remplies, meubles posés), les deux cartes des joueurs, un texte, les actions. Ce qui change:

- **Deux actions au lieu d'une**: « Rester à la Halte » (bouton principal, focus par défaut) et « Finir la séance ». Le libellé actuel « Continuer » de cet écran voulait dire « aller à l'écran de fin de Duo »: il disparaît, pour ne pas confondre avec « continuer à jouer ».
- **On décide à deux.** Chaque joueur choisit sur sa machine; sa carte affiche « Veut rester » ou « Veut finir » chez les deux. Tant que les deux choix diffèrent ou qu'un seul a choisi, rien ne se passe et l'on peut changer son choix (les deux sont dans la même pièce: ils en parlent). Quand les deux ont choisi la même action, elle s'applique.
- **Rester**: la phase repasse à `day` au jour 15, à l'heure où l'écran s'est ouvert (16 h et quelques minutes, après les scènes), horloge relancée, personnages là où les scènes les ont laissés (au pied de la cloche). Notification chez les deux: « La Halte continue. Prochain train: samedi {day}, 10 h. » (`stage_continue`). L'étape entre dans `world.stages.passed`; la sauvegarde automatique suivante l'enregistre.
- **Finir la séance**: comme aujourd'hui (événement `session_finish`, écran de fin de Duo, la séance entre dans l'historique). La sauvegarde garde la phase `ended` et l'étape non franchie: au prochain lancement, le même écran revient, avec « Rester à la Halte ».
- **Les compteurs** additionnent toutes les commandes payées (`world.orderHistory` et le total gardé, section 8.3), pas seulement les deux de la démo.
- **Faits marquants de la séance** (SV-07): « Deux semaines à la Halte » au passage de l'étape `demo`, « Six semaines à la Halte » à `summer_end` (`addHighlight`).

Cas limites:

| Cas | Règle |
|---|---|
| Un joueur se déconnecte sur l'écran | pause de la plateforme, comme ailleurs; à son retour, l'écran est là, les choix déjà faits sont gardés |
| Échap | pause de la plateforme; l'écran d'étape ne se ferme jamais par Échap |
| Le joueur absent depuis 3 minutes | sans effet: l'horloge est déjà arrêtée (`stoppedBy: 'ended'`) |
| Sauvegarde du jour 15 déjà finie (celle du client) | au chargement, phase `ended`, étape `demo` non franchie: l'écran d'étape s'affiche avec « Rester à la Halte » (migration, section 1.6) |
| Sauvegarde du jour 43 chargée par une version où `lastDay` va plus loin | « Rester à la Halte » apparaît; la partie reprend au départ du train du jour 43 |
| Les deux choisissent « Rester » à quelques millisecondes | l'hôte applique le premier accord reçu; le second choix ne fait rien (phase déjà `day`) |

Textes (`textes.json`, bloc `stages`; `textes-interface.json` pour les libellés d'action):

| Clé | Texte |
|---|---|
| `stages.demo.title` | Deux semaines à la Halte d'Aubrune |
| `stages.demo.subtitle` | La démo s'arrête ici. La Halte, elle, continue. |
| `stages.demo.text` | Restez pour l'été: désormais, le temps, la lisière et la commande du samedi changent d'eux-mêmes. |
| `stages.summer_end.title` | Six semaines à la Halte d'Aubrune |
| `stages.summer_end.subtitle` | Du premier train au premier matin d'automne. |
| `stages.summer_end.text` | L'automne arrive à la Halte, et la suite de votre histoire est en préparation. Votre partie s'arrête au départ de ce train: rien n'est perdu, elle reprendra ici. |
| `stages.summer_end.next` | « Rester à la Halte » reviendra avec la prochaine mise à jour du jeu. |
| `end.stay` | Rester à la Halte |
| `end.finish` | Finir la séance |
| `end.chipStay` | Veut rester |
| `end.chipFinish` | Veut finir |
| `end.after` | « Rester à la Halte » reprend la partie ce samedi à 16 h, chez les deux. « Finir la séance » la garde telle quelle: elle vous proposera de rester la prochaine fois. |
| `messages.stage_continue` | La Halte continue. Prochain train: samedi {day}, 10 h. |

### 1.3 Ce que voit le duo, du jour 15 au jour 16

| Quand | Ce qui arrive | Retour |
|---|---|---|
| Jour 15, 16 h | le train part, la commande 2 est payée, scènes de la démo, lettre `coop_recap_2`, écran d'étape | inchangé |
| Après « Rester » | la place du quai, l'horloge repart; la commande du samedi 22 est déjà tirée (section 4) | notification `stage_continue`; la caisse du quai affiche la nouvelle commande dès le lendemain matin, comme après chaque train |
| Jour 15, 18 h | lettre « La commande du samedi 22 » (section 4.8) | son et pastille du courrier, comme la lettre `coop_order_2` |
| Jour 15, soir | soirée ordinaire; au souper, la prévision du lendemain est la première tirée: soleil (jour 16 imposé, section 3.2) | poste à galène et petit-déjeuner comme aujourd'hui |
| Jour 16, 6 h | petit-déjeuner: soleil, envie tirée dans la réserve d'après la démo (section 5.4), lettre de Basile `basile_regrow` | écran du matin |
| Jour 16, lisière | les souches des arbres abattus au plus tard le jour 12 portent un rejet (chêne) ou un jeune sapin (sapin) de 30 % de la taille adulte; les autres restent des souches (section 5.1). Les coins de cueillette se garnissent: ail des ours au pied des chênes, pissenlits au soleil (section 5.2) | astuce `forage_hint` la première fois qu'un joueur passe à moins de 6 m d'une cueillette; astuce `sapling_hint` la première fois qu'il vise un jeune arbre |
| Jour 16, habitants | les quatre ont une réplique du lendemain (section 5.5), Basile parle des rejets, Firmin dit pourquoi la voie des Vergers attend | bulles ordinaires |
| Jour 16, moments | tirage ordinaire (le jour 16 n'est plus un jour de fête: `moments.festivalDays` vide, section 5.6) | |
| Jour 17 | première météo tirée sans contrainte | |

Lettre `basile_regrow` (jour 16, 6 h, de Basile): « Passez voir la lisière: les souches de chêne repartent, et je replanterai les sapins. Le bois ne manquera pas. B. »

### 1.4 La limite provisoire: le samedi 43 à 16 h

**Pourquoi le 43 et pas le 42.** Toute la démo finit sur un départ de train, commande payée: c'est la forme qu'un duo comprend. Arrêter le vendredi 42 laisserait une commande en cours (tirée le 36 pour le 43) que personne ne verrait partir; ne pas la tirer serait une règle inventée pour la production. Le samedi 43 ouvre l'automne: on en voit le premier matin (palette d'automne, noisettes, truites qui reviennent), le train repart, la commande est payée, l'écran d'étape dit la vérité.

**Ce qui est riche jusqu'au jour 43, et ce qui ne l'est pas** (à dire au client tel quel):

| Riche (nouveau chaque jour ou chaque semaine) | Pas encore là |
|---|---|
| la météo et la brume, la saison et sa lumière, la commande de chaque samedi, la cueillette de saison, les arbres qui repoussent, 70 répliques et 18 envies nouvelles, les six moments possibles en été | aucune quête nouvelle ni scène d'histoire après le jour 15; pas de nouveau lieu; peu d'usages pour l'argent (le catalogue garde ses objets); pas de fête; pas d'annonces au tableau; Lucie n'arrive pas |

Mesures attendues (robot, section 6): au moins une première fois par journée et par joueur dans 95 % des journées 16 à 43 (estimation 99,3 %), trois par semaine dans toutes les semaines.

Scène de l'étape `summer_end` (`firmin_stage_summer`, jouée au départ du train du 43, après `pay_order` et `gather_players` au point `quay_bell`, avant `end_stage`):

- Firmin: « Six trains depuis votre arrivée. L'été est passé sans qu'on le voie partir. »
- Firmin: « Sur la Côte, les feuilles commencent à roussir. À la halte, ça veut dire qu'on rentre du bois et qu'on attend la suite. »

### 1.5 Conséquence pour J1 (à transmettre au manager)

Avec « Rester à la Halte », la partie du client peut dépasser le jour 16 (fête des semailles du plan) et le jour 23 (inauguration du quai) avant que J1 existe. Si J1 garde ces dates, une partie qui les a passées ne verra jamais la fête de l'année 1.

Règle proposée pour tout contenu futur: **aucun contenu de jalon n'est daté en jour absolu au-delà du jour 15**. Il démarre par conditions: saison, jour de la semaine, et un `notBefore` relatif au premier jour joué avec la version qui l'apporte (`world.content.firstDayWith[<jalon>]`). Pour J1:

- Lucie arrive le premier dimanche joué avec J1; le chantier de la marquise s'ouvre le lendemain; l'inauguration a lieu le dimanche qui suit le chantier fini (avec ou sans le garde-fou de D6, section 7.3).
- La fête d'ouverture de J1 prend la saison où elle tombe: fête des semailles au printemps, la même cérémonie habillée en fête de la mi-été en été (même décor, rubans d'une autre couleur, autre musique). La fête des semailles de l'année 1 est alors perdue pour une partie qui l'a dépassée; elle revient au printemps de l'année 2 (jour 100).

C'est une question pour le client (section 13, question 1), avec une recommandation: jouer maintenant.

### 1.6 Non-régression et migration

- **Jours 1 à 15 identiques** pour une même graine (même test que M-11, étendu): aucun système nouveau ne consomme le générateur de la partie (`sim.rng`). La météo, la brume, la cueillette et la commande tirent par `unitDraw(seed, clé, jour)` (`src/etat/tirage.ts`, même formule que le script). Tout système nouveau est inerte avant le jour 16 (`fromDay` de chaque bloc, section 8.1). Seule différence admise au jour 15: les champs nouveaux de l'état, à leur valeur initiale, et la commande tirée à 16 h.
- **Sauvegardes**: format 4 (`DATA_SCHEMA`). Migration du format 3: `world.stages = { passed: [], choice: { p1: null, p2: null } }`; `weatherLog` reconstruit depuis `weatherByDay`; `morningMist: false`; arbres déjà abattus (le jour de l'abattage n'était pas gardé): `felledDay` = le plus petit du jour de la sauvegarde et du jour 10, pour que leurs rejets soient là au jour 16 comme dans une partie neuve (section 5.1); `forage` vide; commande générée: si `orderIndex` a dépassé les commandes écrites et qu'aucune commande générée n'existe, elle est tirée à la migration pour le prochain samedi (déterministe par la graine); `orderTotals` calculé depuis `orderHistory`.
- **Lettres**: une lettre ne part qu'une fois par identifiant (`sendLetter`, `src/simulation/courrier.ts`). Les lettres hebdomadaires portent un identifiant d'instance (`coop_order_generated@22`, `coop_recap_generated@22`), et `world.letters` ne garde que les 12 plus récentes lues (les non lues restent toutes): sinon la sauvegarde grossirait de deux lettres par semaine.
- **Libellé de la sauvegarde** dans Duo: inchangé (« samedi, jour 22, 14 h 20 »). Avancement (`progressOf`): mesuré jusqu'à `clock.lastDay` (une partie au jour 15 affiche environ 33 %), à signaler au dev plateforme.

## 2. Saisons

### 2.1 Calendrier

Une seule source: `reglages.calendar` (`seasonDays` 21, `seasonsPerYear` 4); `memories.seasonDays` et `memories.seasonsPerYear` sont retirés et lus dans `calendar` (le validateur refuse les deux à la fois). Le jour 1 ouvre le printemps de l'année 1; chaque saison commence un samedi (TE-02).

| Saison | Jours (année 1) | Premier jour | Dans cette livraison |
|---|---|---|---|
| Printemps | 1 à 21 | samedi 1 | jours 16 à 21 après la démo |
| Été | 22 à 42 | samedi 22 (jour du train) | entier |
| Automne | 43 à 63 | samedi 43 | le matin du 43 jusqu'à 16 h |
| Hiver | 64 à 84 | samedi 64 | robot longue vie seulement |

Les trains passent tous les samedis (`train.days` [1, 8, 15] plus `train.repeatEveryDays` 7); le catalogue ferme chaque vendredi à minuit et livre le samedi à 10 h (`economy.catalogue.repeatWeekly`), après les deux fenêtres écrites.

### 2.2 Ce qui change, saison par saison

| Aspect | Printemps | Été | Automne (jour 43) | Hiver (robot) |
|---|---|---|---|---|
| Palette (texture, déjà livrée) | `palette.png` | `palette-ete.png` | `palette-automne.png` | `palette-hiver.png` |
| Fin du jour (clé de lumière de 20 h 30 aujourd'hui) | 20 h 30 | 21 h 30 | 19 h 30 | 18 h 00 |
| Lever (clé de 5 h 30 aujourd'hui) | 5 h 30 | 5 h 00 | 6 h 30 | 7 h 15 |
| Potager | radis, laitue, carotte | les mêmes | les mêmes | repos: on ne sème pas |
| Cueillette (5.2) | pissenlit, ail des ours | mûre, girolle | noisette, girolle | rien |
| Poissons (5.3), poids goujon, chevesne, truite | 6, 3, 2 | 6, 4, 1 | 5, 3, 3 | 6, 2, 0 |
| Météo (3.1) | 45 / 25 / 30 | 60 / 22 / 18 | 35 / 30 / 35 | 30 / 45 / 25 |
| Habitants (2.4) | horaires de la démo | dehors plus tard le soir | horaires de la démo | horaires de la démo |
| Envies, répliques | de la démo, plus 2 de fin de printemps par habitant | 10 envies et 8 répliques d'été par habitant | réserve générale | réserve générale |
| Moments possibles (conditions actuelles) | 8 | 6 | 4 | 2 |
| Ambiance sonore | de la démo | grillons le soir, martinets le jour | vent dans les feuilles, corneilles | sans objet ici |

La palette change à 6 h du premier jour de la saison, pendant l'écran du petit-déjeuner: personne ne la voit basculer. La lumière suit la saison par une déformation du temps (section 2.5), sans nouvelle courbe.

### 2.3 Cultures

- Radis, laitue et carotte se sèment au printemps, en été et en automne (`seasons` de `cultures.json`); l'hiver, le potager se repose. Écart avec le cahier (radis, laitue et carotte de printemps seulement): les cultures d'été et d'automne n'existent pas encore; sans cet écart, le potager s'arrêterait au jour 22.
- **Une culture semée en saison finit sa pousse**, même si la saison change entre-temps (`crops.finishOutOfSeason`: vrai). Écart avec FE-03 (« hors saison, une culture ne pousse plus »): avec des pousses de 2 à 4 jours, la règle du cahier punirait un semis du vendredi par trois semaines d'attente, sans rien apprendre au duo.
- Semer hors saison (hiver): refusé, message `sow_out_of_season` « Le potager se repose: on sèmera au printemps. », la graine reste dans le sac.

### 2.4 Habitants: horaires d'été

Entrées ajoutées en tête des emplois du temps de `habitants.json`, avec `season_is: ["summer"]` (les habitants rejoignent leur point en marchant, comme à chaque changement d'entrée):

| Habitant | Été | Point | Activité | Pourquoi là |
|---|---|---|---|---|
| Firmin | 18 h à 20 h | `quay_bench` | `stand` (il prend le frais) | Jeanne quitte le banc à midi; c'est le banc de son quai, face à la voie |
| Odette | 20 h à 21 h | `grocery_terrace` | `stand` | la tonnelle du souper de bienvenue, devant chez elle |
| Basile | 18 h à 19 h 30 | `sawmill_yard` | `stand` (visible, au lieu de `home`) | sa cour, devant la scierie qui refroidit |
| Jeanne | 18 h à 21 h | `village_square` | `play` (au lieu de 18 h à 20 h) | « dehors jusqu'à neuf heures » |

Jours de pluie, dès le jour 16 et en toute saison: l'entrée de Jeanne du jour 12 (`quay_bench` de 8 h à 18 h) vaut pour tout jour de pluie (`weather_is: rain` avec `day_at_least: 16`, en plus du `day_is: [12]` actuel).

Jours du train (samedis): les entrées écrites `day_is: [8, 15]` deviennent `any: [day_is [8, 15], all: [day_at_least 22, weekday_is [saturday]]]` (Firmin, Odette, Basile, Jeanne). Même changement pour l'envie `see_train`. Les jours 1 à 15 ne changent pas.

### 2.5 Lumière

Le rendu garde ses courbes de la journée (`reglages-ambiance.ts`, clés en minutes) et lit l'heure à travers une déformation par saison: le temps de jeu `m` devient `f(m)`, linéaire par morceaux entre les ancres `0 → 0`, `lever → 330`, `780 → 780`, `fin du jour → 1230`, `1440 → 1440`. Valeurs de la table 2.2 (en minutes: printemps 330 et 1230, été 300 et 1290, automne 390 et 1170, hiver 435 et 1080). Au printemps, `f` est l'identité: les jours 1 à 21 gardent exactement leur lumière. En hiver, le soleil monte moins haut (`sunElevationScale` 0,7; printemps 1, été 1,1, automne 0,85), les ombres s'allongent. Lampadaires et fenêtres suivent la courbe déformée: ils s'allument plus tard l'été.

### 2.6 Le premier jour d'une saison

Le petit-déjeuner du premier jour d'une saison (jours 22, 43, 64) montre une carte de saison sous la météo, chez les deux, avec trois lignes; un court motif musical (`season-turn`) la souligne. Textes (`textes.json`, `seasonCards`):

| Saison | Titre | Lignes |
|---|---|---|
| Été | Premier jour de l'été | Les journées sont longues: il fait clair jusqu'à 21 h 30. / À la lisière: des mûres au roncier, des girolles après la pluie. / Le soir, les gens du bourg restent dehors un peu plus tard. |
| Automne | Premier jour de l'automne | Le soir tombe plus tôt, vers 19 h 30. / À la lisière: des noisettes, et toujours des girolles après la pluie. / À la rivière, les truites reviennent en nombre. |
| Hiver | Premier jour de l'hiver | Le potager se repose jusqu'au printemps. / La nuit tombe tôt, vers 18 h. / Plus de truites, mais les goujons mordent toujours. |
| Printemps (année 2) | Premier jour du printemps | Le potager se réveille: radis, laitues et carottes. / À la lisière: pissenlits et ail des ours. / Les jours rallongent de nouveau. |

Le HUD affiche la saison sous la date (« Été · jour 3 », clé nouvelle `ui.hud.season`, sans toucher `ui.hud.day`, qui sert au libellé de la sauvegarde).

## 3. Météo tirée

### 3.1 Table

Fréquences visées (FE-09, orage compté en pluie et neige en nuages tant que leur rendu n'existe pas), part des matins de brume sans pluie la veille, et table de tirage (les garde-fous retirent de la pluie et ajoutent du soleil; la table de tirage, calée par la simulation, redonne les fréquences visées à un point près).

| Saison | Soleil | Nuages | Pluie | Brume | Tirage |
|---|---|---|---|---|---|
| Printemps | 45 % | 25 % | 30 % | 8 % | 41 / 23 / 36 |
| Été | 60 % | 22 % | 18 % | 4 % | 59 / 21 / 20 |
| Automne | 35 % | 30 % | 35 % | 25 % | 27 / 28 / 45 |
| Hiver | 30 % | 45 % | 25 % | 15 % | 19 / 49 / 32 |

### 3.2 Règle de tirage

Pour chaque jour `d` à partir du jour 16, au début du jour `d - 1` (la prévision du souper, comme aujourd'hui `weatherTomorrow`):

1. Jour imposé (`weather.forced`): sa météo. Livré: le jour 16 au soleil (le lendemain de la démo; c'est aussi ce qui garde l'état du jour 15 identique, puisque la prévision du jour 15 vaut déjà « soleil »). Les jours de fête futurs s'y ajouteront.
2. Sinon, tirage avec mémoire: probabilité d'un temps `t` = `(1 - 0,35) x tirage[saison][t] / 100 + 0,35 x [t = météo de la veille]`; avec `u = unitDraw(seed, "weather", d)`, on cumule ces probabilités dans l'ordre soleil, nuages, pluie et l'on prend le premier temps dont le cumul dépasse `u` (la pluie si aucun, à cause des arrondis). Ce calcul, en nombres à virgule de 64 bits dans cet ordre, est celui du script: c'est ce qui permet d'épingler la graine du robot (T8-12).
3. Garde-fous, dans cet ordre: après 3 jours de pluie d'affilée, la pluie devient nuages; après 6 jours sans soleil, le jour devient soleil. Les jours écrits de la démo comptent dans ces suites.
4. La saison est celle du jour `d` (le samedi 22 tire dans la table d'été).
5. La météo tirée ne change jamais ensuite: la prévision du soir est la météo du lendemain (FE-09).

L'état garde les 7 derniers jours (`world.weatherLog`); `weather_was` lit la veille dans ce journal au lieu de `weatherByDay`. `weatherByDay` reste la météo écrite des jours 1 à 15; le validateur n'exige plus une valeur par jour jusqu'à `lastDay`, seulement jusqu'au jour 15 (`weather.fromDay - 1`).

### 3.3 La brume du matin

Ce n'est pas un quatrième temps (les conditions `weather_is` et les textes restent à trois valeurs), c'est un drapeau du matin, `world.morningMist`, tiré en même temps que la météo, à partir du jour 16:

- un jour sans pluie qui suit un jour de pluie: brume (`mist.afterRain` 1,0); c'est le matin où le moment de la brume (tour 7) peut sortir, ce qui rend la brume visible cohérente avec lui;
- un autre jour sans pluie: brume avec la chance de la table 3.1 (`unitDraw(seed, "mist", d)`);
- un jour de pluie: jamais.

Elle se lève à 9 h et a disparu à 10 h 30 (`mist.fadeFrom`, `mist.until`).

### 3.4 Effets

| Temps | Visible | Dans le jeu |
|---|---|---|
| Soleil | ombres franches (actuel), papillons du pré (actuel) | le potager demande l'arrosoir; martin-pêcheur et vers luisants possibles (conditions actuelles) |
| Nuages | lumière diffuse (actuel) | les répliques de temps gris |
| Pluie | pluie et sol mouillé (actuel) | arrose tout le potager dehors (actuel); les touches viennent plus vite (attente des poissons x 0,8); le lendemain, les girolles sont trois fois plus probables (5.2); Jeanne s'abrite sur le banc du quai; le lendemain sans pluie, brume |
| Brume du matin | nappe basse sur l'Aubrune et le pré (`mist` des courbes d'ambiance porté à 0,6 jusqu'à 9 h, puis 0 à 10 h 30); ambiance sonore feutrée (`mist-morning`) | touches plus rapides tant qu'elle dure (x 0,75, au lieu de x 0,8 s'il a plu); au petit-déjeuner: « Soleil, brume au lever » (`textes.weather.mistMorning` « brume au lever », ajouté après le temps); l'envie `misty_morning` (5.4) |

### 3.5 Cas limites

- Absence de l'autre (PA-04), veillée, menus: sans effet sur la météo, tirée par jour.
- Une sauvegarde reprise au milieu d'un jour garde la météo et la prévision du jour (dans l'état).
- La brume et le moment de la brume: le moment garde ses propres conditions (`weather_was: rain`, saisons, matin); la brume ambiante est toujours là ces matins-là. Une brume sans pluie la veille n'appelle pas le moment.
- Les textes datés de la démo qui annoncent la pluie (`odette_daily_rain_tomorrow`, jours 3 et 11) restent; à partir du jour 16, une réplique nouvelle d'Odette lit la prévision (`weather_tomorrow_is`, section 5.5).

### 3.6 Résultats (simulation, partie 2, 20 000 graines, jours 16 à 372)

| Saison | Soleil | Nuages | Pluie | Matins de brume | Jours où la brume (moment) est possible |
|---|---|---|---|---|---|
| Printemps | 46,0 % | 24,8 % | 29,2 % | 19,8 % | 15,4 % |
| Été | 60,2 % | 21,9 % | 17,9 % | 13,9 % | 11,1 % |
| Automne | 34,8 % | 30,0 % | 35,2 % | 29,3 % | 17,5 % |
| Hiver | 29,9 % | 44,7 % | 25,4 % | 23,7 % | 0 % (pas de moment l'hiver) |

Plus longue suite de pluie: 3 jours; semaines sans soleil: 0 sur un million; jours corrigés par un garde-fou: 6,2 % (3,75 % de soleil attendu, 2,2 % de pluie trop longue, 0,28 % de jours imposés). Jours 16 à 43: 5,6 jours de pluie en moyenne; deux graines voisines (1 et 2) diffèrent 17 jours sur 28.

Graine du robot (20261030), jours 16 à 43, épinglée par le critère T8-12: 16 soleil, 17 soleil, 18 pluie, 19 pluie, 20 soleil et brume, 21 à 23 soleil, 24 nuages, 25 à 30 soleil, 31 nuages, 32 à 34 soleil, 35 à 37 pluie, 38 nuages et brume, 39 nuages, 40 et 41 soleil, 42 nuages, 43 soleil.

## 4. Commande du samedi générée

### 4.1 Principe

À partir de la commande 3 (samedi 22), la coopérative compose chaque commande au départ du train précédent, à 16 h. Les commandes 1 et 2 restent écrites (la démo ne change pas). La commande est un **travail d'une semaine partagé**: elle demande une part de ce que le duo peut produire, répartie entre plusieurs familles de produits, pour qu'on se dise « toi la rivière, moi le potager ». Elle grandit à chaque commande complète, ne grandit pas après un échec, et rapetisse après deux échecs de suite: personne n'est jamais distancé.

### 4.2 Produits commandables

Le coût par unité est la part d'une ressource (4.3) qu'une unité consomme. « Obtenu quand »: le produit n'entre dans une commande que si le duo l'a déjà produit une fois (EC-07), d'après ces compteurs.

| Produit | `id` | Famille | Ressource | Coût par unité | Minimum | Prix | Saisons | Obtenu quand |
|---|---|---|---|---|---|---|---|---|
| Radis | `radish` | potager | potager | 1 case-jour | 6 | 7 | P, E, A | `harvested:radish` |
| Laitue | `lettuce` | potager | potager | 4 cases-jours | 2 | 32 | P, E, A | `harvested:lettuce` |
| Carotte | `carrot` | potager | potager | 1,67 case-jour | 6 | 16 | P, E, A | `harvested:carrot` |
| Œuf | `egg` | basse-cour | œufs | 1 œuf | 4 | 8 | toutes | `picked:egg` |
| Omelette | `omelette` | cuisine | œufs | 1,5 œuf | 2 | 20 | toutes | `crafted:cook_omelette` |
| Radis à la croque-au-sel | `crunchy_radishes` | cuisine | potager | 1,5 case-jour | 4 | 16 | P, E, A | `crafted:cook_crunchy_radishes` |
| Soupe de légumes | `vegetable_soup` | cuisine | potager | 4,67 cases-jours | 2 | 60 | P, E, A | `crafted:cook_vegetable_soup` |
| Goujon | `gudgeon` | rivière | rivière | 1/12 | 4 | 2 | toutes | `caught:gudgeon` |
| Chevesne | `chub` | rivière | rivière | 1/6 | 2 | 4 | toutes | `caught:chub` |
| Truite | `trout` | rivière | rivière | 1/3 | 2 | 8 | P, E, A | `caught:trout` |
| Planche | `plank` | bois | bois | 1/32 | 6 | 6 | toutes | `crafted:saw_plank` |
| Pissenlit | `dandelion` | lisière | cueillette | 1 | 6 | 4 | P | `picked:dandelion` |
| Ail des ours | `wild_garlic` | lisière | cueillette | 1 | 3 | 8 | P | `picked:wild_garlic` |
| Girolle | `chanterelle` | lisière | cueillette | 1 | 3 | 12 | E, A | `picked:chanterelle` |
| Mûre | `blackberry` | lisière | cueillette | 1 | 8 | 3 | E | `picked:blackberry` |
| Noisette | `hazelnut` | lisière | cueillette | 1 | 8 | 3 | A | `picked:hazelnut` |

Le prix est celui de l'objet (`sellPrice`); la croque-au-sel et la soupe n'ont pas de prix de vente dans la démo: le prix ci-dessus vaut pour la commande seulement (`order.generated.products[].price`), pour ne pas changer ce qu'Odette achète pendant la démo. Un produit qui s'achète tel quel n'est jamais commandé.

« En saison »: au moins 4 des 6 jours de production (lendemain du tirage au vendredi) sont dans ses saisons. Les planches demandent en plus au moins 2 arbres abattables au moment du tirage.

### 4.3 Ressources d'une semaine

| Ressource | Capacité d'une semaine (6 jours) | D'où vient le chiffre |
|---|---|---|
| Potager | 54 cases-jours | 12 cases x 6 jours x 75 % d'occupation; une culture occupe sa case pendant sa pousse plus le jour de la récolte (radis 3 jours pour 3 radis, d'où 1 case-jour par radis) |
| Œufs | 16,2 œufs | 3 poules nourries x 6 jours x 90 % |
| Rivière | 1 « semaine de pêche » | 12 goujons, ou 6 chevesnes, ou 3 truites (poids de tirage et attente de 3 à 15 s) |
| Bois | 1 « semaine de bois » | 4 arbres, 32 planches; une ligne de planches ne dépasse jamais 60 % de 8 planches par arbre abattable au tirage |
| Cueillette | ce que la lisière donne en 6 jours (table 5.2, simulation partie 5) | une ligne ne dépasse jamais 60 % de l'attendu; sa part vaut la moitié de sa fraction de l'attendu (cueillir est rapide) |

La **part** d'une ligne est sa quantité x son coût / la capacité de sa ressource; le **budget** de la commande est la somme des parts, en « semaines de travail ». Repère: la commande 2 de la démo (15 carottes, 4 laitues, 8 œufs, 4 omelettes, 2 truites) demande 2,29 semaines de travail, et les robots la remplissent sur 10 graines sur 10.

### 4.4 Composition

Au départ du train (`pay_order` de la commande précédente), avec `unitDraw(seed, "order:<n>:<ligne>", jour du train)`:

1. **Nombre de lignes**: 4 pour les commandes 3 et 4, 5 pour les commandes 5 à 8, 6 à partir de la commande 9; jamais moins de 3 (EC-06 sans confiance affichée).
2. **Candidats**: produits obtenus (4.2), en saison, hors produits achetables.
3. **Rien de la commande précédente**, sauf si les candidats manquent: alors un produit au plus, et autant qu'il faut pour atteindre 3 lignes (cas de l'hiver, hors de cette livraison).
4. **Familles**: 2 lignes au plus par famille; au moins 3 familles tant que c'est possible.
5. **Pas deux lignes qui puisent dans le même produit de base**: un plat et son ingrédient (omelette et œuf, croque-au-sel et radis, soupe et radis, carotte ou laitue), ni deux plats du même légume (soupe et croque-au-sel). Sans cette règle, une commande demandait 26 radis et 14 croque-au-sel: une semaine de radis.
6. **Tirage pondéré**, ligne par ligne: poids 1; x 3 si la famille manquait à la commande précédente; x 2 si le produit n'a jamais été commandé; x 0,5 s'il était dans la commande d'avant-hier.
7. **Jamais deux fois la même**: assuré par la règle 3; la simulation n'en trouve aucune sur 27 000 commandes, et 78 % des commandes ne reprennent aucun produit de la précédente.

### 4.5 Quantités

- Chaque ligne reçoit la même part du budget (`budget x taille / lignes`), plafonnée par sa ressource: la somme des parts d'une ressource ne dépasse jamais 0,85 (le reste de la semaine sert aux envies, aux repas, aux moments); une ligne plafonnée garde au moins 60 % de sa part si la ressource le permet.
- Quantité = part x capacité / coût, arrondie, jamais sous le minimum de la table 4.2.
- **Garde-fou de faisabilité** (L3): une ligne dont le minimum dépasse la capacité restante est remplacée par le candidat suivant; s'il n'y en a pas, la commande a une ligne de moins (jamais moins de 3).

### 4.6 Progression et rattrapage

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Budget de la commande 3 | 1,9 | semaines de travail | 1,5 à 2,3 | un peu sous la commande 2 (2,29): la première commande générée rassure |
| Hausse après une commande complète | +0,15 | | 0,05 à 0,25 | +8 % par semaine, sensible sans être une course |
| Budget maximal | 3,1 | | 2,5 à 3,6 | 60 à 97 % du temps de travail d'un duo médian; à resimuler si D1 passe à 0,8 s (section 7.1) |
| Après une commande incomplète | +0 | | | on ne grandit pas sur un échec |
| Après deux commandes incomplètes de suite | -0,25 | | | rattrapage sans humiliation: aucun texte n'en parle |
| Plancher | 1,52 | | | 80 % du départ |
| Taille de la commande (réglage du duo, EC-05) | petite x 0,7, normale x 1, grande x 1,3 | | | duo tranquille: 82,5 % de commandes complètes en normale, 97,4 % en petite |

Le réglage « taille de la commande » est dans les réglages dès ce tour (`order.generated.size`, « normale »); son choix dans le carnet, par proposition chez l'autre (EC-11), est P1.

### 4.7 Paiement

Au départ du train, comme aujourd'hui (EC-08), avec une règle de plus pour les commandes générées: **une ligne remplie rapporte le plus grand de** son prix x quantité x 1,5 **et** sa part x 380 sous. La prime de commande complète (+25 %) et le paiement des lignes incomplètes au prix de base ne changent pas. Raison: le goujon vaut 2 sous; sans prime à l'effort, une ligne de poissons rapporterait 12 sous pour une demi-semaine de pêche, et la commande paierait du simple au quadruple selon son tirage. Avec elle, la commande complète du samedi 22 rapporte 1 139 sous en médiane (742 à 1 389), celle du 43 1 377, soit un peu plus que la commande 2 (990): on sent la progression.

### 4.8 Lettres

**Lettre de commande** `coop_order_generated` (de la coopérative, à 18 h le jour du train; pour la commande 3, à 18 h le jour 15 ou tout de suite après « Rester » s'il est plus tard). Titre: « La commande du samedi {day} ». Texte: « {greeting} La coopérative passe commande pour samedi {day}, à déposer dans la caisse du quai avant 16 h: {order}. {tip} »

`{greeting}`, tirée par `unitDraw(seed, "greeting", jour)` parmi celles de la saison, jamais la même que la semaine précédente:

| Saison | Salutations |
|---|---|
| toutes | « Le train de ce samedi est bien arrivé en ville. » / « Bonjour à la Halte d'Aubrune ! » / « Les étals de la ville se vident vite, et c'est un peu grâce à vous. » / « Le chef de train dit que votre caisse est la mieux rangée de la ligne. » / « La ville a goûté vos produits: elle en redemande. » / « Une nouvelle semaine commence à la coopérative. » |
| printemps | « Bon printemps à la Halte ! » |
| été | « Bel été à la Halte ! » / « Les journées sont longues, et nos listes aussi. » |
| automne | « Bel automne à la Halte ! » |

`{tip}`: le conseil du produit de la commande qui demande le plus d'avance (`leadDays`, à égalité la première ligne). Chaque conseil est vrai dans le jeu:

| Produit | `leadDays` | Conseil |
|---|---|---|
| carotte | 5 | Les carottes demandent quatre jours de pousse: ne tardez pas trop. |
| soupe de légumes | 5 | Pour deux soupes: deux carottes, deux radis et une laitue. |
| laitue | 4 | Les laitues poussent en trois jours: semez-les tôt dans la semaine. |
| radis | 3 | Les radis poussent en deux jours: rien ne presse, mais rien ne traîne. |
| croque-au-sel | 3 | Trois radis font deux portions de croque-au-sel. |
| ail des ours, girolle, mûre, noisette, pissenlit | 2 | L'ail des ours pousse à l'ombre, au pied des chênes de la lisière. / Les girolles sortent au lendemain des pluies, sous les arbres de la lisière. / Les mûres mûrissent au roncier de la lisière: attention aux griffes. / Les noisettes tombent sous les noisetiers, au bord du bois. / Les pissenlits poussent au bord du bois, du côté du soleil. |
| œuf | 1 | Pensez à remplir la mangeoire: une poule nourrie pond chaque jour. |
| omelette | 1 | Trois œufs font deux omelettes, au réchaud de la maisonnette. |
| goujon, chevesne, truite | 1 | Les goujons mordent au gué à toute heure. / Le chevesne est plus rare que le goujon: prévoyez quelques lancers. / Par temps de pluie, ça mord plus vite, dit Firmin. |
| planche | 1 | Basile prête son établi: un rondin fait quatre planches. |

**Lettre de récapitulatif** `coop_recap_generated` (au départ du train). Titre: « La commande du samedi {day} est partie ». Le nombre de lignes s'écrit par `{linesDoneText}` (`textes.orderFormat.linesDone`: « aucune ligne », « une ligne », « {n} lignes »), pour ne jamais écrire « 1 lignes ». Variantes, tirées sans répéter celle de la semaine précédente:

| Commande | Textes |
|---|---|
| complète | « La coopérative a reçu {linesDoneText} sur {linesTotal}: {amount} sous. Tout y était. Merci ! » / « Commande complète: {amount} sous. Le chef de train a sifflé deux fois, c'est bon signe. » / « Rien ne manquait: {amount} sous pour {linesTotal} lignes. La ville vous dit merci. » / « Tout est arrivé en bon état: {amount} sous. À samedi ! » / « Les cuisines de la ville ont tout pris: {amount} sous. Merci ! » |
| incomplète | « La coopérative a reçu {linesDoneText} sur {linesTotal}: {amount} sous. Le reste viendra une autre fois, rien ne presse. » / « {amount} sous pour {linesDoneText} sur {linesTotal}. Le train repart quand même le cœur léger. » / « Merci pour ce qui était là: {amount} sous. La semaine prochaine sera la bonne. » / « {amount} sous pour {linesDoneText} sur {linesTotal}. La coopérative garde confiance. » |

### 4.9 La quête de la semaine

Une quête `weekly_order` (principale, titre « La commande du samedi {day} », objectif « Déposer dans la caisse du quai: {order} », une ligne à cocher par produit) remplace `third_order` du plan. Champ nouveau `repeat: "each_train"`: à l'échéance (samedi, 16 h), elle joue `pay_order`, `send_letter coop_recap_generated`, puis, si une étape tombe à cette heure, la scène et `end_stage`; elle redémarre aussitôt pour le train suivant avec la commande nouvellement tirée (étapes et compteurs remis à zéro, `day` du train suivant). Le carnet et le HUD la lisent comme `second_order` aujourd'hui (`orderQuest` prend la quête dont l'échéance tombe au jour du train de la commande en cours). Elle démarre à la fin de `second_order` (effet `start_quest` ajouté à `onDeadline`).

Répliques liées: `firmin_crate_full` (bornée à la commande 2, section 5.5) a sa jumelle `firmin_crate_full_week` (condition `order_complete` sans `day`: la commande en cours; `day_at_least` 16), même texte.

### 4.10 Cas limites

| Cas | Règle |
|---|---|
| Moins de 3 candidats (jamais avant le jour 64) | la commande reprend des produits de la précédente; si elle n'a même pas 3 lignes possibles, elle en a autant que de candidats, au moins une (l'œuf l'est toujours) |
| Un produit cesse d'être de saison pendant la semaine | impossible par la règle « 4 jours sur 6 »; les produits déjà récoltés se gardent et se livrent |
| Plus d'arbres abattables au tirage | pas de ligne de planches cette semaine |
| La caisse reçoit plus que demandé | le surplus est payé au prix de base (actuel) |
| Le duo n'a rien déposé | lettre « aucune ligne sur {linesTotal} », budget inchangé la première fois |
| Deux joueurs déposent en même temps | règles actuelles de la caisse (SI-01) |

### 4.11 Résultats (simulation, partie 3, 3 000 graines, commandes 3 à 11)

| Duo | Commandes complètes | Lignes remplies | Identiques à la précédente | Sans produit de la précédente |
|---|---|---|---|---|
| médian (temps 3,2 ± 0,4) | 99,7 % | 99,9 % | 0 | 78 % |
| tranquille (2,3 ± 0,4) | 82,5 % | 96,0 % | 0 | 78 % |
| tranquille, commande petite | 97,4 % | 99,4 % | 0 | 78 % |
| médian, commande grande | 96,3 % | 99,2 % | 0 | 78 % |

Valeur d'une commande complète (médiane, duo médian): 1 139 sous le samedi 22, 1 233 le 29, 1 154 le 36, 1 377 le 43; 4 lignes puis 5. Le modèle de duo est calé sur la commande 2 de la démo: seuls les robots (critère T8-16) diront le vrai taux; si le duo médian dépasse 95 % de commandes complètes aussi chez les robots, monter la hausse à +0,2.

Exemple lisible (graine 20261030, duo qui réussit tout, sans pissenlits pendant la démo): samedi 22, 3 chevesnes, 26 radis, 15 planches, 4 goujons (971 sous); samedi 29, 8 soupes, 11 œufs, 2 truites (1 549); samedi 36, 11 mûres, 6 laitues, 13 carottes, 10 croque-au-sel, 6 girolles (1 290); samedi 43, 5 omelettes, 3 chevesnes, 15 planches, 25 radis, 5 goujons (1 178).

Hiver (robot seulement): 3,2 lignes en moyenne, dont 1,2 reprises de la commande précédente. C'est la limite honnête du catalogue actuel: l'hiver demande des produits neufs (bûches, cynorhodons, poireaux, conserves), hors de ce tour.

## 5. Repousse et renouvellement

### 5.1 Arbres (règle 8 du plan, L8)

| État | Durée | Visible | Hache |
|---|---|---|---|
| Arbre adulte | jusqu'à l'abattage | modèle actuel | 3 coups, 2 rondins (actuel) |
| Souche | 4 jours | `tree_stump` (déjà livré) | refus: « Rien à couper ici: dans quelques jours, un jeune arbre poussera à la place. » (`stump_hint`) |
| Rejet (chêne) ou jeune sapin (sapin) | 6 jours | le modèle de l'arbre à l'échelle 0,3 le premier jour, puis +0,1 par jour jusqu'à 0,8; P1: modèles `oak_sapling` et `fir_sapling` | refus, petit tremblement, son mat: « Trop jeune pour la hache. Laisse-le grandir. » (`tree_too_young`) |
| Arbre adulte | 10 jours après l'abattage | modèle actuel, échelle 1 | de nouveau 3 coups |

- Le chêne rejette de sa souche (réel: le taillis); le sapin ne rejette pas, Basile le replante (sa lettre du jour 16 et sa réplique le disent).
- Rien ne repousse avant le jour 16 (`trees.regrowFromDay`). Au jour 16, une souche de la démo compte au plus 6 jours d'avance (`trees.catchUpDays`): un arbre abattu le jour 3 est un rejet le 16 et adulte le 20, un arbre abattu le 12 est un rejet le 16 et adulte le 22. Sans ce rattrapage, un duo qui a abattu 8 arbres n'en aurait que 4 jusqu'au jour 26.
- Collision: inchangée (case de l'arbre) dès le rejet; la souche garde la sienne.
- Simulation (partie 4): premier arbre repoussé abattable au jour 20 en médiane; duo médian au moins 3 arbres abattables chaque matin dès le jour 22 et au moins 7 au jour 42; un duo qui abat tout ce qui est debout chaque jour reste au plus 5 jours sans arbre.
- La réplique de Basile « Il reste quelques arbres à la lisière. Après, il faudra attendre qu'ils repoussent. Trente ans, à peu près. » est bornée au jour 15; la suite lui répond (5.5).

### 5.2 Cueillette (CN-06, sans nouveau modèle lourd)

Les cinq coins `forage_edge_01` à `_05` de la carte, au bord du bois de la Côte, deviennent des coins de cueillette permanents à partir du jour 16. Deux sortes de coins, pour que chaque cueillette pousse là où elle pousserait:

| Coin | Points | Pourquoi là | Cueillettes |
|---|---|---|---|
| Sous-bois | `forage_edge_01` (19,5 ; 9,5), `_02` (25,5 ; 9,5) | à l'ombre des chênes `tree_edge_01`, `_03` et `_05` (x 16,5 à 24,5) | ail des ours, girolle, noisette |
| Lisière au soleil | `forage_edge_03` (30,5), `_04` (35,5), `_05` (38,5), tous à y 9,5 | bord du bois tourné vers le quai, en plein sud | pissenlit, mûre; girolle aussi en `_05`, au pied du chêne `tree_edge_11` |

Décor ajouté par le level designer: un roncier à chacun des points 03, 04 et 05 (posé contre la lisière, au nord du point, sans gêner le chemin qui longe le bois), et un noisetier (variante `bush_hazel` d'un buisson existant) au nord de chacun des points 01 et 02 (deux en tout). Les mûres sont un petit bouquet de fruits posé sur le roncier; cueillies, elles disparaissent, le roncier reste.

| Cueillette | `id` | Saisons | Poids | Quantité | Coins | Prix | Modèle |
|---|---|---|---|---|---|---|---|
| Pissenlit | `dandelion` | P | 6 | 2 à 3 | lisière | 4 | `dandelion` (existe) |
| Ail des ours | `wild_garlic` | P | 3 | 1 à 2 | sous-bois | 8 | `wild_garlic`, touffe de larges feuilles, 0,3 m |
| Mûre | `blackberry` | E | 6 | 2 à 3 | lisière | 3 | `blackberry`, grappe de fruits noirs sur le roncier, 0,25 m |
| Girolle | `chanterelle` | E, A | 3 | 1 à 2 | sous-bois, `_05` | 12 | `chanterelle`, bouquet de trois ou quatre girolles, 0,25 m |
| Noisette | `hazelnut` | A | 6 | 2 à 3 | sous-bois | 3 | `hazelnut`, petit tas au sol sous le noisetier du coin, 0,25 m |

Règles (chaque matin à 6 h, à partir du jour 16):

1. Un coin vide qui a au moins une cueillette de saison se garnit avec la chance 0,6 (`unitDraw(seed, "forage:<point>", jour)`).
2. La cueillette est tirée parmi celles de saison du coin, au prorata des poids (rareté CN-04: 6 commune, 3 peu commune), poids x 4 pour une cueillette que le duo n'a jamais cueillie (coup de pouce CN-04), girolle x 3 le lendemain d'une pluie (`unitDraw(seed, "forage-item:<point>", jour)`); la quantité par `unitDraw(seed, "forage-count:<point>", jour)`.
3. Une cueillette non ramassée reste jusqu'à ce qu'on la ramasse ou que sa saison finisse (elle disparaît alors pendant la nuit, sans message).
4. Un coin où un objet est déjà posé (par exemple les pissenlits de la quête d'Odette) ne se garnit pas.
5. Ramasser: Agir près du coin, comme un objet au sol (« Déjà pris » compris, SI-01); le compteur `picked:<item>` existe déjà (`bump`).

Simulation (partie 5): par semaine, au printemps 24 pissenlits et 9 ail des ours, en été 21 mûres et 12 girolles, en automne 9 noisettes et 9 girolles, rien en hiver. Le duo médian cueille l'ail des ours et les pissenlits dès le jour 16 (90 % avant le 18), les mûres et les girolles le 22 (90 % avant le 24).

### 5.3 Poissons

`feel.fishWeightsBySeason` (goujon, chevesne, truite): printemps 6, 3, 2 (actuel, la démo ne change pas), été 6, 4, 1 (l'eau chaude envoie la truite au fond), automne 5, 3, 3, hiver 6, 2, 0 (pas de truite l'hiver, comme au cahier). Attente avant la touche, multipliée par 0,8 un jour de pluie et par 0,75 pendant la brume, à partir du jour 16 (`weather.biteWaitFactor`, `weather.mist.biteWaitFactor`). Les poissons ne s'épuisent jamais.

### 5.4 Envies (R6, HA-07)

Réserve après la démo:

- Les 31 envies personnelles de la démo restent. Trois se retirent d'elles-mêmes par leurs conditions (`meet_jeanne`, `help_odette`, `chop_wood`). Corrections: `real_bed` ne sort plus une fois le lit double posé (`not placed double_bed since game_start` ajouté, sinon elle se réalise toute seule chaque soir); `see_train` passe aux samedis (2.4).
- 14 envies personnelles nouvelles (4 de toute saison dès le jour 16, 10 d'été), 4 envies à deux d'été.
- **Envie à deux un jour sur trois** à partir du jour 16 (jours 16, 19, 22...: `(jour - 16) mod 3 = 0`), tirée parmi les envies à deux possibles, jamais la même en 14 jours; `sharedSchedule` reste la règle des jours 1 à 15.
- Coup de pouce x 4 pour une envie personnelle jamais reçue par ce joueur; jamais la même en 7 jours pour un joueur (actuel).
- Condition nouvelle `picked` (`item` facultatif, comptage, `who`, `since`), sur le compteur `picked:<item>`; condition nouvelle `morning_mist`.

| `id` | Sorte | Disponible | Texte | Réalisée quand |
|---|---|---|---|---|
| `fill_pockets` | personnelle | dès le jour 16 | Remplir ses poches à la lisière. | `picked`, 3, `actor` |
| `rain_walk` | personnelle | pluie | Marcher sous la pluie jusqu'au gué. | `stayed_at river_ford` 5 s |
| `misty_morning` | personnelle | `morning_mist` | Voir la brume sur l'Aubrune avant 10 h. | `stayed_at riverbank` 10 s et `time_is` 6 h à 10 h |
| `visit_saplings` | personnelle | dès le jour 16, un arbre abattu depuis le début | Aller voir où en est la lisière. | `stayed_at forage_edge_02` 5 s |
| `summer_square` | personnelle | été | Passer la soirée sur la place, à la fraîche. | `stayed_at village_square` 10 s et `time_is` 19 h à 21 h |
| `pick_blackberries` | personnelle | été | Cueillir des mûres. | `picked blackberry`, 1 |
| `find_chanterelles` | personnelle | été | Trouver des girolles au pied des chênes. | `picked chanterelle`, 1 |
| `summer_trout` | personnelle | été | Pêcher une truite malgré la chaleur. | `caught trout`, 1 |
| `shade_nap` | personnelle | été | Faire une pause sur le banc de la berge, aux heures chaudes. | `stayed_at riverbank` 10 s, `seated`, et `time_is` 12 h à 15 h |
| `cool_feet` | personnelle | été | Se rafraîchir les pieds au gué. | `stayed_at river_ford` 8 s |
| `night_out` | personnelle | été | Rester dehors après 21 h, du côté du pré. | `stayed_at meadow_glow` 10 s et `time_is` 21 h à 23 h 30 |
| `summer_lettuce` | personnelle | été | Récolter une belle laitue d'été. | `harvested lettuce`, `fine` |
| `listen_jeanne_evening` | personnelle | été | Écouter Jeanne raconter sa journée, le soir. | `talked_to jeanne` et `time_is` 18 h à 21 h |
| `firmin_fresh_air` | personnelle | été | Prendre le frais avec Firmin, sur le quai. | `talked_to firmin` et `time_is` 18 h à 20 h |
| `square_together` | à deux | été | Prendre le frais ensemble sur la place, après 19 h. | `stayed_at village_square` 10 s, `both`, `time_is` 19 h à 21 h |
| `blackberries_together` | à deux | été | Cueillir des mûres à deux. | `picked blackberry`, `both` |
| `ford_together` | à deux | été | Se tremper les pieds au gué, à deux. | `stayed_at river_ford` 8 s, `both` |
| `wait_for_night` | à deux | été | Attendre la nuit au pré de l'est, ensemble. | `stayed_at meadow_glow` 10 s, `both`, `time_is` 21 h à 23 h 30 |

Chaque lieu est à sa place: le banc de la berge (`riverbank`) fait face à l'eau, la place a son puits et ses bancs, le pré de l'est est celui des vers luisants, le gué est la seule eau basse. Simulation (partie 7): jamais une envie deux fois en 7 jours; au moins 15 envies possibles chaque matin; envies jamais vécues: 86 % au printemps (jours 16 à 21), 76 % en été; 10 envies à deux entre les jours 16 et 43, sans redite forcée. Sans envies d'automne ni d'hiver écrites, la part d'envies neuves tombe à 23 % en automne et 2 % en hiver (robot à 84 jours): c'est attendu et ce sera listé.

### 5.5 Répliques du quotidien (R2, R4)

**Règle nouvelle des répliques datées.** Une réplique quotidienne de priorité 5 ou plus (pluie, jour du train) n'est dite en priorité que si ce joueur ne l'a pas entendue depuis 28 jours (`dialogues.datedRepeatDays`); sinon elle rejoint la réserve ordinaire, tirée « la moins récente » (R4, déjà joué). Sans cette règle, la pluie tirée ferait répéter la même phrase à chaque jour de pluie.

**Bornes** (répliques de la démo qui mentiraient après le jour 15):

| Réplique | Condition ajoutée | Pourquoi |
|---|---|---|
| `firmin_daily_week2`, `odette_daily_week2`, `basile_daily_week2` | `not day_at_least 16` | « deuxième commande », « cadres de la ville », « trente ans » |
| `firmin_crate_full` | `not day_at_least 16` | elle lit la commande du jour 15; sa jumelle `firmin_crate_full_week` la remplace (4.9) |
| `firmin_mid_week2`, `odette_mid_week2`, `jeanne_mid_week2` | `weekday_is [tuesday, wednesday, thursday]` dès le jour 16 | « Plus que quelques jours avant le train » ne vaut qu'en milieu de semaine |
| `firmin_daily_rain` | `season_is [spring, summer, autumn]` | « Vos radis vous remercient »: pas de radis l'hiver |
| `jeanne_summer` | `season_is [spring, summer]` | « L'école est fermée pour l'été » |

**Ajouts**: par habitant, 5 répliques générales (dès le jour 16), 2 de fin de printemps (jours 16 à 21), 8 d'été, 1 de pluie (priorité 5, règle des répliques datées), et une réplique du lendemain de la démo (`day_is [16]`, priorité 6, une fois par joueur). Toutes en priorité 1 sauf mention. Les adultes vouvoient le duo, Jeanne tutoie (comme dans la démo). Aucun accord au genre d'un joueur.

Firmin:

| `id` | Condition | Texte |
|---|---|---|
| `firmin_day16` | jour 16, priorité 6 | La coopérative cherche des traverses pour la voie des Vergers. Tant qu'elle n'en a pas, la Halte a de quoi vous occuper. Et moi aussi. |
| `firmin_g1` | dès le jour 16 | Chaque samedi, je compte les voyageurs. Pour l'instant, c'est surtout la caisse qui voyage. Elle a l'air contente. |
| `firmin_g2` | dès le jour 16 | Mon oncle Émile notait le temps qu'il faisait dans un cahier. J'ai repris l'habitude. Aujourd'hui: ça ira. |
| `firmin_g3` | dès le jour 16 | Par vent d'ouest, le sifflet du train porte jusqu'aux Vergers. Un jour, le train y montera pour de bon. |
| `firmin_g4` | dès le jour 16 | Vous avez remarqué ? Les gens du bourg passent plus souvent sur le quai, depuis que vous êtes là. Moi, je fais semblant de ne pas les voir. |
| `firmin_g5` | dès le jour 16 | Une halte, ce n'est pas grand-chose: un quai, une cloche, un banc. Mais c'est là qu'on arrive, et là qu'on repart. |
| `firmin_ls1` | jours 16 à 21 | Le printemps tire à sa fin. Odette sort déjà ses chapeaux de paille. Elle en a trois, et un pour moi qu'elle ne me donne jamais. |
| `firmin_ls2` | jours 16 à 21 | Samedi, ce sera l'été. Le train sera le même, mais je mettrai la casquette légère. |
| `firmin_su1` | été | L'été, les rails chauffent tant qu'on les entend craquer l'après-midi. Ils s'étirent, comme moi. |
| `firmin_su2` | été | Trop chaud pour la veste. Ne le dites pas à la coopérative: un chef de halte ne transpire pas, il veille. |
| `firmin_su3` | été | Le soir, je prends le frais sur le banc du quai. Si vous passez, il y a de la place pour deux. Pour trois, on se serre. |
| `firmin_su4` | été | En été, Émile laissait la porte de la halte ouverte toute la nuit. Pour que la nuit entre, disait-il. Elle n'est jamais repartie. |
| `firmin_su5` | été | Les jours sont si longs que je compte les traverses deux fois. Il en manque toujours une. C'est rassurant. |
| `firmin_su6` | été | Après une pluie d'été, la voie fume comme une locomotive. C'est le seul train qui passe en semaine. |
| `firmin_su7` | été | Jeanne m'a demandé si le train prenait des vacances. J'ai dit que non. Elle m'a regardé comme si j'étais à plaindre. |
| `firmin_su8` | été | Les mûres de la lisière, c'est le dessert des chefs de halte. Enfin, du chef de halte: il n'y en a qu'un. |
| `firmin_rain2` | pluie, priorité 5 | Encore de la pluie. Le quai brille comme un parquet ciré. N'y courez pas. |
| `firmin_crate_full_week` | `order_complete` (en cours), dès le jour 16 | La caisse est pleine ! Je l'ai soupesée. Doucement: elle appartient à la coopérative. |

Odette:

| `id` | Condition | Texte |
|---|---|---|
| `odette_day16` | jour 16, priorité 6 | Un dimanche sans train, ça repose. Je l'ai dit à ma caisse: elle ne m'a pas crue. |
| `odette_rain_tomorrow` | `weather_tomorrow_is rain`, dès le jour 16, priorité 6 | Mon genou annonce la pluie pour demain. Il n'a jamais tort, il a seulement mauvais caractère. |
| `odette_g1` | dès le jour 16 | Je pèse tout deux fois: une fois pour la balance, une fois pour moi. Les deux ne sont jamais d'accord. |
| `odette_g2` | dès le jour 16 | Mes clients les plus fidèles, ce sont les moineaux: ils viennent tous les matins pour les miettes. |
| `odette_g3` | dès le jour 16 | Vous avez de la terre sous les ongles. Ici, c'est une politesse. |
| `odette_g4` | dès le jour 16 | Firmin dit que je parle trop. Je dis qu'il écoute trop peu. Et nous avons raison, lui et moi: c'est ce qui nous tient. |
| `odette_g5` | dès le jour 16 | Quand la vitrine est pleine, je suis contente. Quand elle est vide, je suis riche. Je ne sais jamais quoi souhaiter. |
| `odette_ls1` | jours 16 à 21 | Les radis de fin de printemps piquent plus que les autres. Comme les fins de phrases de Basile. |
| `odette_ls2` | jours 16 à 21 | J'ai sorti les bocaux d'été. Ils sont vides, mais ça donne le moral. |
| `odette_su1` | été | La chaleur fait fondre le beurre et la patience. Il me reste un peu des deux, profitez-en. |
| `odette_su2` | été | Le soir, je m'assois sous la tonnelle. On y voit passer tout le bourg, c'est-à-dire trois personnes et vous. |
| `odette_su3` | été | Des mûres de la lisière ? Mangez-les sur place, c'est la règle. Celles qui arrivent à la maison sont déjà un souvenir. |
| `odette_su4` | été | Les girolles, il faut les nettoyer au pinceau. Ma mère me le disait, et je ne l'ai jamais fait. |
| `odette_su5` | été | Laitue d'été, laitue pressée: elle monte vite. Cueillez-la avant qu'elle se prenne pour un arbre. |
| `odette_su6` | été | En été, je reste dehors jusqu'à neuf heures. Personne ne passe, mais j'aime l'idée qu'on pourrait. |
| `odette_su7` | été | Jeanne a les genoux écorchés et des histoires plein les poches. C'est l'été, quoi. |
| `odette_su8` | été | À la ville, ils vendent de la glace dans la rue. Ici, on a le puits: son eau vous fait claquer des dents en plein été. |
| `odette_rain2` | pluie, priorité 5 | Encore la pluie. Le comptoir sent le parapluie mouillé: c'est mon parfum de la semaine. |

Basile:

| `id` | Condition | Texte |
|---|---|---|
| `basile_day16` | dès le jour 16, priorité 6, une fois par joueur | Venez voir la lisière: les souches de chêne font des rejets. Les sapins, je les replanterai. J'avais dit trente ans ? Ici, la terre est pressée. |
| `basile_g1` | dès le jour 16 | Une planche droite, c'est une planche qu'on a écoutée. |
| `basile_g2` | dès le jour 16 | Je ne dis pas souvent merci. Je le pense en rabotant. |
| `basile_g3` | dès le jour 16 | Le bois se souvient de tout: la pluie, le vent, et qui l'a coupé. Coupez gentiment. |
| `basile_g4` | dès le jour 16 | Mon établi a quarante ans. Il a plus de rides que moi, et moins de plaintes. |
| `basile_g5` | dès le jour 16 | Quand vous sciez, ne regardez pas la lame. Regardez le trait. Le reste suit. |
| `basile_ls1` | jours 16 à 21 | Fin de printemps: la sève monte. Le bois coupé maintenant pleure un peu. Ça passe. |
| `basile_ls2` | jours 16 à 21 | Odette veut une étagère pour l'été. Elle veut toujours une étagère. Je crois qu'elle aime me voir arriver avec. |
| `basile_su1` | été | La chaleur fait travailler le bois. Une porte qui ferme en hiver frotte en été. Ne lui en voulez pas. |
| `basile_su2` | été | Je scie le matin, avant le grand soleil. L'après-midi, c'est la scie qui me regarde. |
| `basile_su3` | été | Les rejets de chêne poussent comme de la mauvaise herbe, l'été. C'est la meilleure herbe que je connaisse. |
| `basile_su4` | été | Le soir, je m'assois dans ma cour et j'écoute la scierie refroidir. Elle craque, comme un vieux. |
| `basile_su5` | été | Un sapin replanté, c'est une promesse à quelqu'un qu'on ne connaît pas encore. Vous, peut-être. |
| `basile_su6` | été | Les mûres, ça griffe. Comme tout ce qui vaut la peine. |
| `basile_su7` | été | Jeanne m'a montré un galet en forme de rabot. J'ai dit que c'était un galet. Elle ne me parle plus. Depuis une heure. |
| `basile_su8` | été | Été sec, bois léger. Été mouillé, bois lourd. Moi, je suis lourd toute l'année. |
| `basile_rain2` | pluie, priorité 5 | La pluie sur le toit de la scierie, c'est le seul bruit que je préfère à celui de la scie. |

Jeanne:

| `id` | Condition | Texte |
|---|---|---|
| `jeanne_day16` | jour 16, priorité 6 | C'est dimanche ! Le dimanche, je fais tout pareil, mais plus lentement. C'est la règle. |
| `jeanne_g1` | dès le jour 16 | Tu sais siffler avec deux doigts ? Moi non plus. Firmin dit que ça s'apprend en regardant les trains. |
| `jeanne_g2` | dès le jour 16 | J'ai demandé à la Duchesse si elle s'ennuyait. Elle a pondu. Je crois que c'est non. |
| `jeanne_g3` | dès le jour 16 | Quand je serai grande, je serai cheffe de gare. Ou cheffe des poules. Je n'ai pas encore décidé. |
| `jeanne_g4` | dès le jour 16 | Ma tante Lucie m'écrit des cartes. Quand elle n'a plus de timbres, elle en dessine. |
| `jeanne_g5` | dès le jour 16 | Le puits a mangé un de mes galets. Je lui ai dit son prénom, pour qu'il le garde bien. |
| `jeanne_ls1` | jours 16 à 21 | Plus que quelques jours d'école... Non, attends, l'école est déjà fermée. Alors plus que quelques jours de printemps. |
| `jeanne_ls2` | jours 16 à 21 | Les pissenlits font des boules. Si tu souffles dessus, tu fais un vœu. J'en ai fait quarante. Rien ne s'est passé. Pour l'instant. |
| `jeanne_su1` | été | C'est l'été pour de vrai ! Je reste dehors jusqu'à neuf heures. C'est écrit dans un règlement que j'ai écrit. |
| `jeanne_su2` | été | J'ai trouvé un ver luisant. Il ne luisait pas. Peut-être qu'il était timide. |
| `jeanne_su3` | été | Les mûres, je les mange avant qu'elles soient mûres. Après, il n'y en a plus. |
| `jeanne_su4` | été | Il fait si chaud que les poules marchent à l'ombre. La Duchesse, elle, fait marcher l'ombre. |
| `jeanne_su5` | été | Le soir, je compte les étoiles par la fenêtre. Je m'arrête à cent, sinon je m'endors au milieu. |
| `jeanne_su6` | été | Les galets de la rivière sont chauds l'après-midi. Je les mets dans mes poches. Ma tante dit que je ressemble à un rocher. |
| `jeanne_su7` | été | Les vacances, c'est quand les jours n'ont plus de nom. Aujourd'hui, c'est... un jour bleu. |
| `jeanne_su8` | été | Firmin dit qu'en été, les trains ont soif. Je lui ai proposé de l'eau du puits. Il a ri, mais il n'a pas dit non. |
| `jeanne_rain2` | pluie, priorité 5 | Il pleut encore ! Je compte les flaques du quai. Il y en a sept, plus une qui ne compte pas parce que c'est la mienne. |

Chaque texte a été confronté au monde: pas de chat ni de mois dans le jeu (retirés), le niveau de l'eau ne change pas (aucune réplique ne le dit), Odette est dehors jusqu'à 21 h en été (2.4), Firmin est sur le banc du quai le soir (2.4), le roncier et les girolles sont à la lisière (5.2). Aucune ne dévoile un moment ni ne double une confidence.

Simulation (partie 6, 400 graines, redites à moins de 28 jours, R2 sous 2 %):

| Réserve | Profil médian (parle à un habitant 55 % des jours) | Profil assidu (chaque habitant chaque jour) |
|---|---|---|
| démo seule, bornée | 7,3 % | 41,5 % |
| avec les ajouts, jours 16 à 43 | 0,0 % | 0,5 % |
| avec les ajouts, jusqu'au jour 84 sans automne ni hiver écrits | 0,2 % | 42,3 % |
| avec en plus 8 répliques d'automne et 8 d'hiver par habitant | 0,0 % | 0,6 % |

### 5.6 Moments

Aucun moment nouveau dans ce tour. Les règles du tour 7 pour le long cours s'appliquent telles quelles (fenêtre de 10 jours et chance réduite dès le jour 24, coup de pouce aux jamais vus). Deux réglages changent:

- `moments.festivalDays`: `[]` (au lieu de `[16, 23]`, valeur par défaut de `defauts.ts`) tant qu'aucune fête n'existe: sinon les jours 16 et 23 n'auraient aucun moment sans raison. Chaque fête future y ajoutera son jour.
- `noAmbientOnTrainDays` suit les trains généralisés (tous les samedis).

## 6. Le robot longue vie et son rapport

### 6.1 Ce qu'il joue

- **Durée et graines**: 84 jours (une année), graines 20261030, 1, 2 et 3, profil médian; en plus, une graine en profil assidu (R2) et une graine en profil glouton (arbres). Les réglages livrés, sauf `clock.lastDay` porté au jour 84 (seule prolongation, écrite dans le test); l'étape `summer_end` est franchie par « Rester » des deux robots.
- **Temps**: moins de 10 minutes en intégration continue, hors de la boucle rapide (`npm run test:longue-vie`). Mesure du 2026-11-01: les robots de la démo vivent 41 jours en 32 s par graine (0,79 s par journée). Estimation prudente avec la routine d'après le jour 15: 1,6 s par journée, soit 9 minutes pour 4 graines à la suite, 2,2 minutes sur 4 fils (une graine par fichier de test, `pool: threads`). Mesurer et écrire la durée dans le rapport.
- **Routine d'après le jour 15** (aujourd'hui les robots restent oisifs: bourse figée à 1 428 sous et aucun arbre abattu du jour 16 au jour 42, mesuré): chaque matin, lire la commande en cours et répartir les lignes entre les deux robots par ressource (l'un potager et cuisine, l'autre basse-cour, rivière, bois, lisière, et l'inverse une semaine sur deux); semer ce que demandent les lignes du potager assez tôt pour la récolte; nourrir les poules; cuisiner les plats demandés; pêcher jusqu'au compte de chaque poisson demandé; abattre seulement des arbres adultes et scier; passer à la lisière deux jours sur trois et tout cueillir; déposer dans la caisse au fil de la semaine; réaliser son envie quand elle est faisable; manger, se coucher.
- **Conversations**: profil médian, chaque robot parle à chaque habitant visible avec une chance de 0,55 par jour, à une heure tirée; profil assidu, à chaque habitant visible une fois par jour.
- **Sauvegarde et reprise à chaque aube**: instantané, relecture, empreinte égale (`hash`), puis la partie continue sur l'état relu.

### 6.2 Ce qu'il mesure exactement

| # | Mesure | Définition |
|---|---|---|
| L-01 | Avancement | jour atteint, temps réel par journée, journées bloquées (aucune aube en 2 heures de simulation) |
| L-02 | Reprise | aubes où l'empreinte de l'état relu diffère de celle de l'état sauvegardé |
| L-03 | Taille | octets de `JSON.stringify(world)` à chaque aube, et par clé de premier niveau; `memoriesBytes` |
| L-04 | Météo | temps de chaque jour, brume, suites de pluie, jours sans soleil, jours imposés |
| L-05 | Commandes | lignes, parts, budget, produits repris de la précédente, familles, montant, complète ou non |
| L-06 | Arbres | à chaque aube, nombre d'arbres adultes, de rejets, de souches |
| L-07 | Cueillette | coins garnis à l'aube, unités cueillies par jour et par cueillette |
| L-08 | Répliques | chaque réplique quotidienne dite: joueur, habitant, identifiant, jour; redite si ce joueur l'a entendue moins de 28 jours avant (R2) |
| L-09 | Envies | envie de chaque joueur chaque jour, réalisée ou non, jamais reçue avant ou non, envie à deux du jour |
| L-10 | Moments | moment du jour, vu ensemble ou non; écart entre deux passages d'un même moment, par saison (M-22) |
| L-11 | Premières fois (6.3) | par joueur et par jour |
| L-12 | Soins quotidiens (R12) | secondes passées à arroser et à nourrir les poules, rapportées aux secondes passées dehors en journée |

### 6.3 Ce qui compte comme une première fois (R1)

Pour un joueur, une journée est neuve s'il y vit au moins un de ces événements: entendre une réplique (quotidienne, de quête, de scène) jamais entendue; recevoir une envie jamais reçue; ramasser une cueillette jamais ramassée par le duo; voir ensemble un moment jamais vu; le premier matin de brume, le premier jour de pluie d'une saison, le premier jour d'une saison; lire une lettre de commande qui contient un produit jamais commandé; voir le premier rejet; abattre le premier arbre repoussé; démarrer une quête. La simulation (partie 8, estimation à partir des réserves) donne 99,3 % des journées 16 à 43 avec au moins une première fois (98,3 % sans les répliques nouvelles); les jours les plus pauvres sont les derniers de l'été (39 à 42).

### 6.4 Rapport et seuils

Le test écrit `test-results/longue-vie.json` (toutes les mesures) et `test-results/longue-vie.md` (tableau lisible, une ligne par seuil, avec la valeur, le seuil et « tenu » ou « non tenu »). Deux sortes de seuils:

**Invariants** (le test échoue):

| # | Invariant |
|---|---|
| I-01 | jour 84 atteint sur les 4 graines, aucune journée bloquée |
| I-02 | empreinte identique après chaque reprise (L-02 à 0) |
| I-03 | jamais plus de 3 jours de pluie d'affilée, jamais 7 jours sans soleil, jour 16 au soleil |
| I-04 | aucune commande identique à la précédente; au moins 3 lignes; 2 lignes au plus par famille; aucune ligne qui puise dans le même produit de base qu'une autre; aucun produit hors saison ni jamais obtenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux tous les trois jours à partir du jour 16 |
| I-06 | `world.memories` sous 1 536 octets (S-14); état sous 48 000 octets à chaque aube, et pas plus de 4 096 octets de plus au jour 84 qu'au jour 43 (aujourd'hui environ 35 000 octets au jour 42); sinon, le rapport nomme les clés qui grossissent |
| I-07 | jours 1 à 15 identiques à une partie sans les systèmes nouveaux (même graine) |
| I-08 | aucun texte affiché ne contient `{` (variables toutes remplies) |

**Objectifs** (mesurés, listés, ne font pas échouer au tour 8; le premier rapport sert de référence aux tours suivants):

| # | Objectif | Seuil | Période |
|---|---|---|---|
| O-01 | Journées neuves (R1) | au moins 95 % par joueur; au moins 3 par semaine pour toutes les semaines | 16 à 43, puis 16 à 84 à part |
| O-02 | Redites des répliques (R2) | sous 2 % par habitant, profil médian et profil assidu | 16 à 43 (attendu non tenu après le jour 43 en profil assidu) |
| O-03 | Envies (R6) | au moins 30 % d'envies jamais reçues par saison; au moins 12 envies possibles chaque matin | par saison |
| O-04 | Commandes | au moins 80 % de commandes complètes en profil médian | 22 à 84 |
| O-05 | Arbres | au moins 6 abattables le jour 42; jamais 0 en profil médian à partir du jour 16 | |
| O-06 | Moments (M-22) | écart médian entre deux passages d'un même moment d'au moins 19 jours au printemps et en été; jamais moins de 10 jours après le jour 24 | |
| O-07 | Moments par saison | au moins 2 moments différents vus par saison | |
| O-08 | Soins quotidiens (R12) | au plus 30 % du temps dehors | |
| O-09 | Météo | fréquences par saison à 8 points près de la table 3.1 (4 graines: indicatif) | |
| O-10 | Durée | moins de 10 minutes | |

## 7. Ce qui dépend des décisions du client

### 7.1 D1, le rythme de la journée après le jour 23

Réglage: `clock.schedule`, liste de `{ fromDay, secondsPerGameMinute }`, appliquée à l'aube du jour donné (jamais au milieu d'une journée); `clock.secondsPerGameMinute` devient la valeur du jour 1.

| Réponse à D1 | Valeur |
|---|---|
| garder 0,35 s | `[{ "fromDay": 1, "secondsPerGameMinute": 0.35 }]` (**livré**) |
| 0,8 s au jour 24 (recommandation du plan) | `[{ "fromDay": 1, "secondsPerGameMinute": 0.35 }, { "fromDay": 24, "secondsPerGameMinute": 0.8 }]` |
| 0,6 s au jour 24 | même forme, 0,6 |

Recommandation pour cette livraison: 0,35 s partout. La raison du passage à 0,8 s (la Halte entière, cinq métiers, J2) n'existe pas encore: sur la carte compacte, une journée de 16 minutes serait à moitié vide. La recommandation de D1 pour J2 ne change pas. Ce qui en dépend: la commande générée (le temps du duo par journée double à 0,8 s, pas la capacité du potager ni des poules; à resimuler avant J2), les fenêtres des moments (en heures de jeu: rien à changer). Le robot joue une graine à 0,8 s dès le jour 24 pour vérifier que rien ne casse (critère T8-26).

### 7.2 D4, la partie de la démo continue-t-elle ?

Réglage: `continuation.mode`, `"same_save"` (**livré**, recommandé) ou `"new_game_per_stage"`.

- Dans cette livraison, les deux valeurs se comportent pareil: « Rester à la Halte » prolonge la sauvegarde en cours, puisque c'est la même version du jeu.
- La valeur ne sert qu'à la version suivante: avec `"same_save"`, une sauvegarde arrêtée à l'étape `summer_end` reprend au départ du train du jour 43 (migration, comme 1.6); avec `"new_game_per_stage"`, elle reste jouable jusqu'à sa limite et l'écran d'étape propose en plus « Commencer une nouvelle partie » pour le jalon suivant.

### 7.3 D6, le garde-fou de l'inauguration (J1)

Rien à coder dans ce tour: aucun chantier collectif n'est livré. Réglage réservé pour le lot L6, `chantier.guard`: `{ "mode": "village_finishes", "event": "inauguration", "weekday": "sunday", "minDaysAfterOpen": 8 }` (**recommandé** pour J1: le village finit la marquise la veille, l'inauguration a lieu le dimanche qui suit au moins 8 jours de chantier) ou `{ "mode": "wait_for_duo" }` (règle du cahier: l'inauguration attend le dimanche qui suit le chantier fini). Dans les deux cas, la date est relative (section 1.5), jamais « jour 23 ».

### 7.4 D7 et les questions de la valse et du train

| Sujet | Réglage | Valeurs | Livré | Recommandation |
|---|---|---|---|---|
| D7, tendresse entre les personnages | `tenderness` | `"none"`, `"accomplices"`, `"gentle"` | `"gentle"` | complices et tendres en douceur (plan, D7) |
| Question 1 du tour 7, la valse d'Odette et la danse du bal | condition nouvelle `tenderness_at_least` dans `availableWhen` de `odette_waltz` et des danses futures (`"gentle"`) | | contenu non livré | oui |
| Question 2 du tour 7, le train qui ralentit pour le salut | `train.saluteSlowRoll` | `true` (départ de 20 s les jours du salut), `false` (départ ordinaire de 6 s, le salut reste jouable) | `true` | oui, un samedi sur deux au plus |

Si le client répond autrement, on change une valeur, sans code. Aucun texte de ce tour ne dépend de D7.

## 8. Données et configuration typée

### 8.1 `reglages.json` (ajouts et changements)

```json
{
  "calendar": { "seasonDays": 21, "seasonsPerYear": 4 },
  "clock": {
    "secondsPerGameMinute": 0.35,
    "schedule": [{ "fromDay": 1, "secondsPerGameMinute": 0.35 }],
    "lastDay": { "day": 43, "end": "16:00" }
  },
  "stages": [
    { "id": "demo", "day": 15, "time": "16:00", "texts": "demo" },
    { "id": "summer_end", "day": 43, "time": "16:00", "texts": "summer_end" }
  ],
  "continuation": { "mode": "same_save" },
  "tenderness": "gentle",
  "train": { "days": [1, 8, 15], "repeatEveryDays": 7, "arrival": "10:00", "departure": "16:00", "saluteSlowRoll": true },
  "economy": {
    "catalogue": {
      "windows": ["les deux fenêtres actuelles"],
      "repeatWeekly": { "deadlineWeekday": "friday", "deadlineTime": "24:00", "deliveryTime": "10:00" }
    }
  },
  "weather": {
    "fromDay": 16,
    "draw": { "spring": [41, 23, 36], "summer": [59, 21, 20], "autumn": [27, 28, 45], "winter": [19, 49, 32] },
    "target": { "spring": [45, 25, 30], "summer": [60, 22, 18], "autumn": [35, 30, 35], "winter": [30, 45, 25] },
    "persistence": 0.35,
    "maxRainStreak": 3,
    "maxDaysWithoutSun": 6,
    "forced": [{ "day": 16, "weather": "sunny" }],
    "logDays": 7,
    "biteWaitFactor": { "sunny": 1.0, "cloudy": 1.0, "rain": 0.8 },
    "mist": { "afterRain": 1.0, "base": { "spring": 0.08, "summer": 0.04, "autumn": 0.25, "winter": 0.15 }, "fadeFrom": "09:00", "until": "10:30", "biteWaitFactor": 0.75 }
  },
  "order": {
    "trains": ["les deux commandes écrites, inchangées"],
    "generated": {
      "fromOrder": 3,
      "linesByOrder": [{ "from": 3, "lines": 4 }, { "from": 5, "lines": 5 }, { "from": 9, "lines": 6 }],
      "minLines": 3,
      "maxPerFamily": 2,
      "minFamilies": 3,
      "maxRepeatFromPrevious": 1,
      "weights": { "absentFamily": 3, "neverOrdered": 2, "twoOrdersAgo": 0.5 },
      "budget": { "start": 1.9, "stepOnComplete": 0.15, "max": 3.1, "afterMiss": 0, "afterTwoMisses": -0.25, "floor": 1.52 },
      "size": { "current": "normale", "factors": { "petite": 0.7, "normale": 1.0, "grande": 1.3 } },
      "resources": { "garden": 54, "eggs": 16.2, "river": 1, "wood": 1, "resourceCap": 0.85, "minLineShare": 0.6, "forageCap": 0.6, "forageShare": 0.5, "woodPlanksPerTree": 8, "woodCap": 0.6, "woodMinTrees": 2 },
      "paymentPerWorkWeek": 380,
      "noSharedBase": { "omelette": ["egg"], "crunchy_radishes": ["radish"], "vegetable_soup": ["radish", "carrot", "lettuce"] },
      "products": [
        { "item": "radish", "family": "potager", "resource": "garden", "cost": 1.0, "min": 6, "seasons": ["spring", "summer", "autumn"], "obtained": "harvested:radish", "leadDays": 3 },
        { "item": "vegetable_soup", "family": "cuisine", "resource": "garden", "cost": 4.67, "min": 2, "price": 60, "seasons": ["spring", "summer", "autumn"], "obtained": "crafted:cook_vegetable_soup", "leadDays": 5 },
        { "item": "...", "note": "une entrée par ligne de la table 4.2" }
      ]
    }
  },
  "trees": { "count": 12, "zone": "forest_edge", "chopsPerTree": 3, "logsPerTree": 2, "regrow": true, "regrowFromDay": 16, "catchUpDays": 6, "stumpDays": 4, "saplingDays": 6, "saplingScale": { "first": 0.3, "perDay": 0.1, "max": 0.8 } },
  "forage": {
    "fromDay": 16,
    "spawnChance": 0.6,
    "unseenFactor": 4,
    "rainBoost": { "item": "chanterelle", "factor": 3 },
    "points": [
      { "point": "forage_edge_01", "items": ["wild_garlic", "chanterelle", "hazelnut"] },
      { "point": "forage_edge_02", "items": ["wild_garlic", "chanterelle", "hazelnut"] },
      { "point": "forage_edge_03", "items": ["dandelion", "blackberry"] },
      { "point": "forage_edge_04", "items": ["dandelion", "blackberry"] },
      { "point": "forage_edge_05", "items": ["dandelion", "blackberry", "chanterelle"] }
    ],
    "items": [
      { "item": "dandelion", "seasons": ["spring"], "weight": 6, "count": [2, 3] },
      { "item": "wild_garlic", "seasons": ["spring"], "weight": 3, "count": [1, 2] },
      { "item": "blackberry", "seasons": ["summer"], "weight": 6, "count": [2, 3] },
      { "item": "chanterelle", "seasons": ["summer", "autumn"], "weight": 3, "count": [1, 2] },
      { "item": "hazelnut", "seasons": ["autumn"], "weight": 6, "count": [2, 3] }
    ]
  },
  "envies": { "personalPerDay": 1, "noRepeatForSamePlayer": true, "noRepeatWindowDays": 7, "unseenFactor": 4, "sharedFromDay": 16, "sharedEveryDays": 3, "sharedNoRepeatDays": 14 },
  "dialogues": { "datedRepeatDays": 28 },
  "moments": { "festivalDays": [] },
  "crops": { "finishOutOfSeason": true },
  "feel": {
    "fishWeights": { "gudgeon": 6, "chub": 3, "trout": 2 },
    "fishWeightsBySeason": { "spring": { "gudgeon": 6, "chub": 3, "trout": 2 }, "summer": { "gudgeon": 6, "chub": 4, "trout": 1 }, "autumn": { "gudgeon": 5, "chub": 3, "trout": 3 }, "winter": { "gudgeon": 6, "chub": 2, "trout": 0 } }
  }
}
```

Les lignes `"..."` désignent le contenu à recopier des tables; le JSON livré est complet. `memories` perd `seasonDays` et `seasonsPerYear` (lus dans `calendar`).

### 8.2 Types (`src/donnees/types.ts`, extraits)

```ts
export type StageId = 'demo' | 'summer_end';
export interface StageDef { id: StageId; day: number; time: string; texts: StageId }
export interface ClockStep { fromDay: number; secondsPerGameMinute: number }
export type WeatherOdds = readonly [sunny: number, cloudy: number, rain: number];
export interface WeatherSettings {
  fromDay: number;
  draw: Record<Season, WeatherOdds>;
  target: Record<Season, WeatherOdds>;
  persistence: number;
  maxRainStreak: number;
  maxDaysWithoutSun: number;
  forced: readonly { day: number; weather: Weather }[];
  logDays: number;
  biteWaitFactor: Record<Weather, number>;
  mist: { afterRain: number; base: Record<Season, number>; fadeFrom: string; until: string; biteWaitFactor: number };
}
export type OrderFamily = 'potager' | 'basse-cour' | 'cuisine' | 'rivière' | 'bois' | 'lisière';
export type OrderResource = 'garden' | 'eggs' | 'river' | 'wood' | 'forage';
export interface OrderProduct {
  item: ItemId; family: OrderFamily; resource: OrderResource; cost: number; min: number;
  price: number | null; seasons: readonly Season[]; obtained: string; leadDays: number;
}
export interface ForagePoint { point: string; items: readonly ItemId[] }
export interface ForageItem { item: ItemId; seasons: readonly Season[]; weight: number; count: readonly [number, number] }
export type ContinuationMode = 'same_save' | 'new_game_per_stage';
export type Tenderness = 'none' | 'accomplices' | 'gentle';
```

Chaque bloc est validé à la lecture (`src/donnees/contenu.ts`, comme les autres): sommes des tables de tirage égales à 100, saisons connues, objets et points existants, `min` positif, `fromDay` après le dernier jour écrit.

### 8.3 État du monde (format 4)

| Champ | Type | Borné par |
|---|---|---|
| `stages` | `{ passed: StageId[]; choice: Record<CharacterId, 'stay' \| 'finish' \| null> }` | nombre d'étapes |
| `weatherLog` | `{ day: number; weather: Weather; mist: boolean }[]` | `logDays` (7) |
| `morningMist` | `boolean` | |
| `trees[].felledDay` | `number \| null` | 12 arbres |
| `forage` | `Record<pointId, { item: ItemId; count: number } \| null>` | 5 coins |
| `order` | `{ generated: { train: number; lines: { item: ItemId; count: number; share: number }[] } \| null; budget: number; misses: number; recent: ItemId[][] }` | `recent`: 2 commandes |
| `orderHistory` | résultats payés | les 8 derniers, plus `orderTotals { orders, linesDone, linesTotal, amount }` |
| `envies.sharedRecent` | `{ id: EnvieId; day: number }[]` | 14 jours |
| `letters` | lettres | les 12 dernières lues, plus les non lues |
| `content.firstDayWith` | `Record<string, number>` (section 1.5) | nombre de jalons |

### 8.4 Conditions, effets et autres données

- Conditions nouvelles: `morning_mist`, `weather_tomorrow_is` (`weather`), `picked` (`item` facultatif, comptage, `who`, `since`), `tenderness_at_least` (`level`). Changées: `weather_was` (lit `weatherLog`), `season_is` (lit `calendar`), `order_complete` sans `day` permis dans les données (commande en cours).
- Effets: `end_stage` (`stage`); `end_demo` = `end_stage demo`.
- Quête: champ `repeat: "each_train"`, titre et objectif à variables `{day}` et `{order}` (section 4.9).
- Lettres: `delivery.instance: "train"` pour les lettres hebdomadaires (identifiant d'instance), variantes tirées sans répéter la précédente (`variantsNoRepeat: true`).
- `objets.json`: `wild_garlic` (ail des ours, `forage`, 8 sous, `wild_garlic`), `chanterelle` (girolle, 12), `blackberry` (mûre, pluriel « mûres », 3), `hazelnut` (noisette, 3); chacun avec `plural`, `indefinite`, et un substitut dans `src/rendu/substituts.ts` (sinon `rendu.test.ts` échoue).
- `cultures.json`: `seasons` de radis, laitue et carotte à `["spring", "summer", "autumn"]`.
- `textes.json`: blocs `stages`, `seasonCards`, `orderFormat.linesDone`, `weather.mistMorning`; messages `stage_continue`, `sow_out_of_season`, `tree_too_young`, `stump_hint`, `forage_hint`, `sapling_hint`; `ui.hud.season` (« {season} · jour {day} »).
- `astuces.json`: `forage_hint` (« Quelque chose se cueille à la lisière: approche-toi, puis {act} ou un clic pour le ramasser. », à moins de 6 m d'une cueillette, une fois par joueur) et `sapling_hint` (« Ce jeune arbre repousse: dans quelques jours, la hache pourra de nouveau servir. », en visant un jeune arbre, une fois par joueur).
- `courrier.json`: `basile_regrow`, `coop_order_generated`, `coop_recap_generated` (4.8).
- `habitants.json`: 70 répliques nouvelles (5.5: 64 du quotidien, 4 du lendemain de la démo, la prévision d'Odette, la caisse pleine de Firmin), 9 bornes, horaires d'été (2.4).
- `envies.json`: 18 envies (5.4), `real_bed` et `see_train` corrigées.
- `cartes/halte.json`: trois ronciers (points 03 à 05) et deux noisetiers (un au nord de 01, un au nord de 02), sans toucher aux points.

## 9. Actions et retours

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Choisir « Rester à la Halte » ou « Finir la séance » | sa carte passe à « Veut rester » ou « Veut finir » chez les deux; à l'accord, l'écran se ferme et la notification `stage_continue` s'affiche | `ui-confirm`, puis le thème de la Halte qui revient |
| Lire la lettre de commande | lettre ouverte, commande listée; le carnet montre « La commande du samedi {day} » | `letter-open` (actuel) |
| Déposer un produit demandé | ligne cochée dans la caisse et au carnet (actuel) | `crate-drop` (actuel) |
| Cueillir | la cueillette disparaît (le roncier reste), « +2 mûres » | un son par sorte: `pick-herb` (ail, pissenlit), `pick-mushroom`, `pick-berries` (avec froissement du roncier), `pick-nuts` |
| Viser une souche, un rejet avec la hache | refus `stump_hint` ou `tree_too_young`, le rejet tremble un peu | `axe-thud-soft` (coup mat, sans écho) |
| Semer en hiver | refus `sow_out_of_season`, la graine reste | `ui-refuse` (actuel) |
| Voir la brume | nappe sur l'eau et le pré, petit-déjeuner « brume au lever » | `mist-morning`, ambiance feutrée qui s'efface vers 10 h 30 |
| Premier jour de saison | carte de saison au petit-déjeuner, palette nouvelle | `season-turn` (motif de 3 s) |
| Départ du train du 43 | scène de Firmin, écran d'étape « Six semaines » | sifflet (actuel), musique de fin |

## 10. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| T8-01 | Nouvelle partie: au jour 15, après le départ du train et les scènes, l'écran d'étape s'ouvre chez les deux avec « Rester à la Halte » et « Finir la séance »; quand les deux choisissent « Rester », la phase redevient `day` au jour 15, horloge en marche, sans fin de séance | test à deux joueurs, et Chromium |
| T8-02 | La sauvegarde de référence du jour 15 finie (format 3, `tests/donnees/sauvegardes`) se charge sur l'écran d'étape; « Rester » chez les deux la reprend; la lettre « La commande du samedi 22 » arrive, à 18 h ou aussitôt s'il est plus tard | test de migration |
| T8-03 | Tant que les deux choix diffèrent, rien ne se passe et l'on peut changer son choix; les deux « Finir » ferment la séance; au chargement suivant, l'écran revient avec « Rester » | test unitaire |
| T8-04 | Même graine: états des jours 1 à 14 identiques, jour 15 identique hors champs nouveaux et commande tirée (M-11 étendu) | test |
| T8-05 | Au jour 43 à 16 h: commande payée, scène `firmin_stage_summer`, écran « Six semaines » sans « Rester », texte `stages.summer_end.next` affiché; avec `lastDay` porté au jour 50 dans le test, « Rester » apparaît et la partie va au jour 44 | test |
| T8-06 | Robots, réglages livrés (non prolongés), 8 graines: jour 43 atteint, reprise de la sauvegarde à chaque aube à l'identique, aucun blocage | robot |
| T8-07 | `season_of` suit la table 2.1; la palette est celle de la saison dès 6 h du premier jour; captures du même lieu au jour 21 (19 h) et au jour 22 (8 h), regardées de près | test et captures |
| T8-08 | En été, à 21 h, la lumière du rendu vaut celle du printemps vers 20 h (déformation de 2.5: 20 h 03); au printemps, `f` est l'identité (jours 1 à 21 inchangés) | test du rendu (`lumiere.test.ts`) |
| T8-09 | En été à 20 h 30, Jeanne est sur la place et Odette sous la tonnelle; au printemps à la même heure, Jeanne est rentrée; un samedi d'été, les quatre attendent le train comme les jours 8 et 15 | test |
| T8-10 | Semer en hiver est refusé avec `sow_out_of_season`; une carotte semée au jour 41 mûrit au jour 45 | test (lastDay prolongé) |
| T8-11 | Sur 1 000 graines, jours 16 à 372: fréquences par saison à 2 points de la table 3.1; aucune suite de 4 jours de pluie; aucune suite de 7 jours sans soleil; jour 16 au soleil; deux graines diffèrent | test unitaire |
| T8-12 | Graine 20261030: météo des jours 16 à 43 égale à la liste de 3.6 (même `unitDraw` que le script) | test unitaire |
| T8-13 | `weather_was` lit la météo tirée; brume chaque matin sans pluie qui suit une pluie, jamais un jour de pluie; prévision du soir égale à la météo du lendemain | test unitaire |
| T8-14 | Sur 1 000 graines, commandes 3 à 11: aucune identique à la précédente; au moins 3 lignes; au plus 2 par famille; aucune paire qui partage un produit de base; seulement des produits obtenus et de saison; quantités au moins égales au minimum; parts d'une ressource au plus 0,85 | test unitaire |
| T8-15 | Une ligne remplie est payée au moins sa part x 380 sous; prime de commande complète +25 %; le montant de la lettre de récapitulatif égale le paiement; « une ligne », jamais « 1 lignes » | test unitaire |
| T8-16 | Robots médians, 8 graines: au moins 80 % des commandes 3 à 6 complètes | robot |
| T8-17 | Rattrapage: après une commande incomplète, le budget suivant n'augmente pas; après deux de suite, il baisse de 0,25, jamais sous 1,52 | test unitaire |
| T8-18 | Lettre de commande: `{order}` rempli, conseil du produit au `leadDays` le plus grand, salutation différente de la semaine précédente | test unitaire |
| T8-19 | Arbre: souche 4 jours, rejet 6 jours (échelle 0,3 puis +0,1 par jour), adulte ensuite; la hache sur une souche ou un rejet ne frappe pas et dit pourquoi; rien ne repousse avant le jour 16; rattrapage du jour 16 | test unitaire |
| T8-20 | Robots médians, 8 graines: au moins 6 arbres abattables le jour 42, jamais 0 à partir du jour 16 | robot |
| T8-21 | Cueillette: aucun coin garni avant le jour 16; chaque matin, un coin vide se garnit avec une chance de 0,6 (1 000 graines: 0,58 à 0,62); seulement des cueillettes de saison du coin; disparues au changement de saison; girolles plus fréquentes le lendemain d'une pluie | test unitaire |
| T8-22 | Poids des poissons par saison; jamais de truite en hiver; attente x 0,8 sous la pluie et x 0,75 pendant la brume, à partir du jour 16 | test unitaire |
| T8-23 | Les répliques bornées (5.5) ne sont jamais dites après le jour 15 (ou hors de leurs jours); une réplique de pluie n'est pas redite en priorité à moins de 28 jours | test unitaire |
| T8-24 | Robot assidu, jours 16 à 43: redites à moins de 28 jours sous 2 % pour chaque habitant | robot longue vie |
| T8-25 | Envies: jamais deux fois la même en 7 jours; envie à deux les jours 16, 19, 22..., la même chez les deux, jamais la même en 14 jours; `real_bed` ne sort plus une fois le lit double posé | test unitaire et robot |
| T8-26 | Robot longue vie: 84 jours sur 4 graines en moins de 10 minutes, `longue-vie.json` et `longue-vie.md` écrits, invariants I-01 à I-08 tenus, objectifs O-01 à O-10 listés avec leur valeur; une graine à 0,8 s dès le jour 24 va au jour 84 sans blocage | robot longue vie |
| T8-27 | Textes nouveaux: validateur sans avertissement d'écriture neutre, aucun tiret cadratin ni demi-cadratin, aucune variable non remplie | validateur |
| T8-28 | Écran d'étape et carte de saison lisibles à 100 et 150 % (1366 x 768) chez les deux, au clavier et à la souris; aucun texte coupé | captures Chromium |
| T8-29 | Chaque action de la section 9 a son retour visuel et sonore | test et écoute chez le client |
| T8-30 | Chez le client: le duo choisit de rester après le jour 15, et dit que la Halte « change toute seule » (météo, lisière, commande) | observation |

## 11. Travail par métier

| Métier | Travail |
|---|---|
| Dev gameplay | étapes et `end_stage`, choix à deux, reprise; migration au format 4 (1.6); `calendar`; `clock.schedule`; trains et catalogue hebdomadaires; météo tirée, `weatherLog`, brume, `weather_was`, `weather_tomorrow_is`, `morning_mist`; commande générée (4.2 à 4.7), quête `weekly_order` avec `repeat`, lettres d'instance et bornées; repousse des arbres et refus de la hache; cueillette; poids des poissons par saison et attente selon le temps; envies à deux tirées, condition `picked`, coup de pouce; règle des répliques datées; `tenderness_at_least`, réglages D1, D4, D7; robots: routine d'après le jour 15, profils médian, assidu et glouton; données (5.4, 5.5, 8.4) passées au validateur |
| Dev rendu et technical artist | palettes de saison (remplacer `material.map`, `assets/modeles/README.md`); déformation de l'heure par saison et `sunElevationScale` (2.5); brume du matin (champ `mist` des courbes, nappe sur l'eau et le pré, levée de 9 h à 10 h 30); arbres: souche, rejet à l'échelle croissante, tremblement du refus; cueillettes posées aux coins (mûres à la hauteur du roncier); substituts des quatre objets nouveaux |
| Dev interface | écran d'étape (deux actions, choix de l'autre, textes de 1.2, focus, Retour arrière ne ferme rien, Échap à la plateforme); carte de saison au petit-déjeuner; « brume au lever »; saison sous la date (`ui.hud.season`); quête de la semaine au carnet et au HUD; lettres à variantes; compteurs de l'écran d'étape sur toutes les commandes; P1: réglage « taille de la commande » par proposition (EC-11) |
| Sound-designer | `season-turn` (motif de 3 s, 4 couleurs de saison), `mist-morning` (ambiance feutrée, gouttes, merle lointain), ambiances d'été (grillons du soir, martinets du jour) et d'automne (vent dans les feuilles, corneilles), `pick-herb`, `pick-mushroom`, `pick-berries`, `pick-nuts`, `axe-thud-soft`; P1: variation d'été du thème de la Halte |
| Artiste 3D | `wild_garlic`, `chanterelle`, `blackberry` (grappe), `hazelnut` (tas), `bramble` (roncier de 1,2 x 0,8 m, 0,7 m de haut, sans fruits), `bush_hazel` (variante de `bush`); P1: `oak_sapling`, `fir_sapling`; chaque objet lisible à 0,25 m au moins (leçon du martin-pêcheur), budgets de triangles de `assets/modeles/README.md`, vérifié de près (rien qui flotte ni traverse le sol) |
| Level designer (avec l'artiste 3D) | trois ronciers aux points 03 à 05 et un noisetier au nord de 01 et de 02, sans gêner le passage de la lisière au passage à niveau; contrôle de la ligne de vue des cinq coins (outil `moments_tour7_geometrie.py`) |
| QA | critères T8-01 à T8-30; robot longue vie et son rapport (6.4); sauvegarde de référence du jour 15 au format 3 et du jour 43 au format 4; captures de l'écran d'étape et des saisons |
| Game designer (fait dans ce document) | textes (1.2, 1.4, 2.6, 4.8, 5.4, 5.5, 8.4), tables, simulation; relecture des textes en jeu après production |

## 12. Hors périmètre

- Contenu de J1: Lucie, la fête des semailles, la marquise et l'inauguration, l'arbre de mai, l'appareil photo, les fraisiers, Basile qui vend des planches (section 1.5 pour leurs dates).
- Petites annonces (L4), carnet de la vallée (L5), chantier collectif et geste « lever » (L6), cadre des fêtes (L7), souvenirs à variables (R5).
- Cultures nouvelles (été, automne, hiver), orage, neige, aléas (FE-10), confiance affichée et rayons du catalogue (EC-09), métiers, nouvelle carte.
- Contenu d'automne et d'hiver au-delà du jour 43 (répliques, envies, cueillettes d'hiver, Jeanne à l'école): le robot à 84 jours en montre le manque, c'est voulu.
- Usages nouveaux de l'argent: la bourse grossira sans grand usage jusqu'à J1 (signalé, section 1.4).
- Étoiles de l'Aubrune, valse, salut du mécanicien, lignes d'observation M-26 et M-27 (priorité 3 de la revue du tour 7, chantier séparé).

## 13. Questions ouvertes

1. **Pour le client: jouer maintenant jusqu'au jour 43, ou attendre J1 ?** En jouant maintenant, la fête des semailles de l'année 1 ne pourra plus avoir lieu au jour 16; J1 s'ancrera sur le premier dimanche joué avec lui (1.5), et la fête reviendra au printemps de l'année 2. Recommandation: jouer maintenant; six semaines de vie au bourg valent plus qu'une date, et la fête de J1 garde tout son contenu.
2. **Pour l'architecte: format 4 et bornes de l'état** (1.6, 8.3): lettres bornées, `orderHistory` borné avec totaux, `weatherLog` sur 7 jours, et le remplacement de `world.moments.history` proposé au tour 7 (question 4). Recommandation: tout borner dans ce tour, puisque le robot longue vie va en mesurer la taille.
3. **Pour le dev plateforme: l'avancement d'une sauvegarde** (`progressOf`) mesuré jusqu'à `lastDay` fait passer une partie du jour 15 de 100 % à environ 33 %. Recommandation: garder cette mesure, plus honnête, et l'afficher en jours dans la bibliothèque si la plateforme le permet.
4. **Pour le manager: le seuil de la commande** (4.6). Si les robots médians remplissent plus de 95 % des commandes, monter la hausse à +0,2 au tour suivant. Recommandation: livrer les valeurs de ce document, ajuster sur le premier rapport.

## 14. Relecture après production (revue du tour 8)

### 14.1 Textes corrigés en situation

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `ui.questKinds.main` | Deux semaines à la Halte | À la Halte | titre de groupe du carnet, lu pendant toute la partie: il mentait dès le jour 16 |
| `saturday_order`, objectif | avant samedi 16 h | avant samedi 8 à 16 h | même forme que les commandes 2 et suivantes, qui donnent le jour |
| `forage_hint` | approche-toi et fais Agir | approche-toi, puis {act} ou un clic pour le ramasser | « Agir » n'est le nom d'aucune touche; les autres astuces disent la touche réelle par `{act}` |
| `sapling_hint` | Un rejet: dans quelques jours, ce sera de nouveau un arbre. | Ce jeune arbre repousse: dans quelques jours, la hache pourra de nouveau servir. | l'astuce vise aussi le jeune sapin replanté, qui n'est pas un rejet |
| `messages.stump_hint` | Rien à couper: la souche repartira. | Rien à couper ici: dans quelques jours, un jeune arbre poussera à la place. | la souche de sapin ne repart pas (Basile replante); vrai pour les deux essences |
| `orderGreetings.all` | Merci pour le train de samedi ! | Le train de ce samedi est bien arrivé en ville. | la lettre est datée du samedi même: « de samedi » s'y lisait comme le samedi suivant |
| `orderGreetings.summer`, `seasonCards.summer` | Les jours rallongent | Les journées sont longues | l'été du jeu commence au plus long des jours; « rallongent » ne vaut qu'au printemps |
| `seasonCards.autumn` | les truites reviennent | les truites reviennent en nombre | l'été garde un peu de truite (poids 1): elles ne revenaient pas de nulle part |
| `orderTips.hazelnut` | sous le noisetier | sous les noisetiers | deux noisetiers posés (14.2) |
| `stages.summer_end.text` | et sa suite est en préparation | et la suite de votre histoire est en préparation | « sa » renvoyait à l'automne |
| `visit_saplings` (envie) | Aller voir pousser les rejets de la lisière. | Aller voir où en est la lisière. | l'envie reste tirable quand tout a repoussé, et le sapin n'a pas de rejet |
| `title.ticket` (`textes-interface.json`) | Démo · Deux semaines à la Halte d'Aubrune | Six semaines à la Halte d'Aubrune | l'écran titre annonçait une partie de deux semaines |
| `endScreen` (interface de secours seulement) | Fin de la démo / Deux semaines… / La suite… arrive bientôt. | Le train est reparti / Une étape à la Halte d'Aubrune. / Votre partie s'arrête ici. Rien n'est perdu: elle reprendra à cet endroit. | vrai aux deux étapes; `stats` inchangés (historique de Duo) |

Relu sans changement: écran d'étape des jours 15 et 43 (captures `interface-etape-*`), cartes de saison, lettres de commande et de récapitulatif, 18 envies, 70 répliques et 9 bornes, `tree_too_young`, conseils des commandes. Chaque lieu cité par une réplique existe sur la carte (tonnelle d'Odette, banc du quai, cour de la scierie); les répliques datées du jour 16 sont bornées à ce jour, sauf celle de Basile, sans date dans le texte.

### 14.2 Écarts des devs, validés

| Écart | Verdict | Raison |
|---|---|---|
| Tirage ligne par ligne par `unitDraw` au lieu de `random.Random` du script | validé | c'est ce que disait 4.4; la commande d'une graine devient épinglable dans un test. Les statistiques de 4.11 restent valables à la variance près, pas graine par graine |
| Candidat écarté si son minimum ne tient plus | validé | même règle que 4.5 (garde-fou de faisabilité), appliquée avant le tirage plutôt qu'après: aucun effet visible |
| Trois premières lignes de trois familles différentes | validé | réalise « au moins 3 familles tant que c'est possible » (4.4, règle 4) sans retirage; mesuré: 3 à 4 familles par commande, 0 problème I-04 |
| Deux noisetiers au lieu d'un | validé | une noisette tombe au pied d'un noisetier: un par coin de sous-bois, au nord du point, est la seule pose juste (`cueillette-noisettes.png`) |
| T8-16 vérifié graine par graine (au moins 3 sur 4 par graine médiane) | validé | plus exigeant que 80 % en moyenne, et un duo vit une seule graine |
| O-06: écart médian de 11 jours au printemps et de 16,5 en été, pour 19 | accepté pour ce tour, à reprendre | printemps: 9 écarts seulement, à cheval sur la démo, où la fenêtre longue (dès le jour 24) ne s'applique pas encore; non jugeable avant le printemps de l'année 2. Été: la réserve n'a que 6 moments, dont 3 à conditions étroites (brume, vers luisants, chevrette); le héron, le renard et le martin-pêcheur reviennent donc plus souvent. Baisser la chance retirerait des moments; le remède est du contenu (deux moments d'été, priorité 3 du tour 9) et, en réglage, `longFromDay` à 16 |

### 14.3 Défaut d'équilibrage trouvé à la relecture

**La truite d'été coûte deux fois ce que la commande croit.** Le coût d'une truite (1/3 de semaine de pêche, 4.2) est calculé avec le poids de printemps (2 sur 11); l'été, le poids passe à 1 sur 11 (5.3): deux truites demandent deux fois plus de lancers que la part payée et prévue. Correctif proposé (données et code du générateur): un coût par saison (`costBySeason`, truite: été 0,667), ou un poids d'été de 1,5. Recommandation: le coût par saison, qui garde « la truite se cache l'été ».

## Annexe A: résultats de la simulation

`python3 docs/jeux/jeu-1/simulations/tour8_suite.py` (65 s). Résultats repris dans les sections 3.6, 4.11, 5.1, 5.2, 5.4, 5.5 et 6.3. Repères:

| Partie | Résultat |
|---|---|
| 0 | contrôle croisé des tables 3.1, 4.2 et 5.2 avec le script: aucun écart |
| 1 | calendrier: jour 22 samedi, premier jour de l'été et jour du train; jour 43 samedi, premier jour de l'automne; jour 64 hiver |
| 2 | météo: table 3.6 |
| 3 | commandes: table 4.11; hiver 3,2 lignes dont 1,2 reprises |
| 4 | arbres: duo médian au moins 3 abattables dès le jour 22, 7 au jour 42, 5,4 % des matins sous 6; duo glouton au plus 5 jours sans arbre |
| 5 | cueillette par semaine: printemps 24 pissenlits et 9 ail des ours; été 21 mûres et 12 girolles; automne 9 noisettes et 9 girolles |
| 6 | répliques: table 5.5 |
| 7 | envies: 86 % neuves au printemps, 76 % en été; au moins 15 possibles chaque matin |
| 8 | premières fois: 99,3 % des journées 16 à 43 (98,3 % sans les répliques nouvelles) |
| 9 | robot: 9 min pour 4 graines à la suite (hypothèse 1,6 s par journée), 2,2 min sur 4 fils; mesuré à vide 0,79 s par journée |

## Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-11-01 | 1 | Première rédaction: étapes et « Rester à la Halte », limite au jour 43, saisons, météo tirée et brume, commande générée, repousse, cueillette, envies et répliques d'été, robot longue vie, réglages de D1, D4, D6 et D7, simulation `tour8_suite.py` | manager (gauntlet, tour 8) |
| 2026-11-01 | 2 | Relecture après production (section 14): 13 textes corrigés, écarts des devs validés, défaut de la truite d'été | manager (revue du tour 8) |
