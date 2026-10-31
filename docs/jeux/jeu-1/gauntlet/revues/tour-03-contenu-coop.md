# Tour 3: revue adverse des piliers 6 (contenu et rythme) et 7 (coopération)

| Champ | Valeur |
|---|---|
| Relecteur | level-designer (auteur de la carte, pas du contenu ni des règles) |
| Date | 2026-10-31 |
| Version lue | arbre principal à `d8a5dad` (D1 à D5 de la revue du tour 1 intégrés, sauf D2) |
| Épreuve | G6, revue adverse: « mieux qu'avant », preuve à l'appui |
| Référence | `revues/tour-01-contenu-coop.md` (notes de départ: 5 et 6) |

## Verdict

**Mieux qu'avant sur les deux piliers, nettement sur le pilier 6.** Les redites de répliques sont divisées par six, la réserve d'envies ne s'épuise plus, la fin de la semaine 2 a du contenu et la trame de la draisine est jouée par tous les duos. Le pilier 7 progresse moins: le défaut principal (un seul geste à deux) n'a pas été traité.

| Pilier | Tour 1 | Tour 3 | Écart |
|---|---|---|---|
| 6. Contenu et rythme | 5 | **6,5** | +1,5 |
| 7. Coopération | 6 | **6,5** | +0,5 |

## Méthode

Même méthode qu'au tour 1, adaptée à la nouvelle règle de choix des répliques: script jetable `/tmp/lpl4/mesure4.test.ts` (non versionné), lancé par `npx vitest run --root games/la-petite-ligne --dir /tmp/lpl4`; robots sur toute la démo, graine 20261030 avec l'énigme et graine 7 sans (68 minutes de jeu chacune, fin atteinte). Pour les répliques, un joueur « bavard » virtuel appelle le vrai `pickDialogue` avec sa propre mémoire `heard` (substituée le temps de l'appel, puis rendue) et un tirage figé: la partie des robots n'est pas modifiée. Une sonde à part (`/tmp/lpl5/t.test.ts`) vérifie que les nouvelles scènes des jours 12 à 14 se déclenchent.

## Mesures avant et après

| Mesure | Tour 1 | Tour 3 | Preuve |
|---|---|---|---|
| Répliques du quotidien dans les données | 25 | 81 | `habitants.json` |
| Redites, une conversation par habitant et par jour (58 conversations) | 55 % (26 répliques différentes) | **9 %** (53) et 7 % (54) selon la graine | relevé à 13 h |
| Redites, trois conversations par jour (170) | 80 % (34 différentes) | **51 %** (84) et 49 % (86) | relevé à 9 h, 13 h, 17 h |
| Même réplique deux fois le même jour | fréquent (Odette, 3 fois par jour) | **0 sur 170** | idem |
| Écart moyen entre deux redites | 1 jour | **4,9 jours** (au plus près: 1 jour) | idem |
| Réplique de Firmin du jour 15 (`firmin_day15`) | jamais dite | **dite** | relevé du jour 15 |
| Plus grande redite à une conversation par jour | `odette_daily_bed` 9 fois | 2 fois (répliques de pluie, jours 4 et 12) | idem |
| Envies personnelles et à deux | 16 et 5 | 31 et 6 (8 jours d'envie à deux) | `envies.json` |
| Matins sans envie | jour 15 (graine 7) | **aucun** du jour 2 au jour 15, deux graines | relevé des envies |
| Dernière quête de la semaine 2 finie (hors commande) | jour 11 (trois au jour 9) | jour 12, ouvertures étalées du 9 au 13 | événements `quest_done` |
| Contenu daté des jours 11 à 14 | aucun (hors le rappel du catalogue du 13) | lettre du jour 11, histoire de Jeanne sous la marquise (12, pluie), marché d'Odette sur la place (13), scène à deux de Firmin au quai (14, 15 h à 18 h), 4 répliques datées par jour | données, sonde `/tmp/lpl5` (scènes de Jeanne et d'Odette entendues) |
| Draisine sans la clé (graine 7) | jamais | **scène de la draisine au jour 13**, fin `basile_end2_handcar` dite | événements `scene_started` |
| Gestes à deux | 1 (poutre, jour 1) | **1** (inchangé) | `deplacement.ts`, seul passage à `gesture` |
| Robot qui tourne à la porte | 3 200 événements `door` | 72 | relevé `door` |

## Pilier 6: 6,5 / 10

### Ce qui est maintenant au niveau

- **Les habitants ne radotent plus** à un rythme normal de conversation: une redite sur dix ou moins, jamais la même phrase deux fois dans la journée, et les nouvelles répliques réagissent à l'état du monde (`odette_soup`, `basile_omelette_after`, `firmin_flowers_after`, `odette_radishes_sold`) et au moment de la journée (`firmin_evening`, `basile_morning`). C'est le progrès le plus visible pour un joueur.
- **La fin de la semaine 2 vit**: chaque jour du 11 au 14 apporte quelque chose de daté, et le jour 14 culmine sur un rendez-vous au quai.
- **La trame tient pour tous**: le second chemin vers la remise donne la draisine aux duos qui ont manqué l'ombre de la cloche (jour 13 chez le robot sans l'énigme).

### Ce qui retient la note sous 8

- **Le joueur bavard entend encore une réplique sur deux** à trois conversations par jour. Le quotidien de chaque habitant tient en une vingtaine de répliques pour quinze jours: suffisant pour une démo, pas pour le jeu.
- **Les journées ont toujours un creux après la tournée du matin**: chez les robots, le dernier événement utile tombe entre 6 h et 9 h les jours 6, 10, 11 et 13 (deux graines), soit 10 à 13 h de jeu, 3,5 à 4,5 minutes réelles, sans rien d'exigé jusqu'à la veillée. Les nouveaux événements sont surtout des conversations: ils remplissent la minute, pas l'après-midi. Un duo humain y pêchera ou meublera, mais sans but nouveau. Limite connue: les robots ne flânent pas.
- **Toujours aucun aléa**: les deux graines finissent avec la même bourse (1 432 sous); la partie est la même pour tous.
- **Rien n'a changé dans la structure à 100 heures** (voir plus bas): les trois risques du tour 1 restent entiers.

## Pilier 7: 6,5 / 10

### Ce qui progresse

- **Un rendez-vous à deux de plus**, daté: la scène de Firmin au quai au jour 14 (scène partagée au point `quay_bell`).
- **Plus d'envies à deux** (8 jours sur 14 au lieu de 6, avec « Se retrouver sur le banc du quai »), et une envie personnelle qui demande l'autre (« Partager un repas à deux »).
- **La scène de la draisine pour tous les duos**, grâce au second chemin (D4).

### Ce qui ne bouge pas

- **Un seul geste exige les deux joueurs en quinze jours** (la poutre, le jour 1). La draisine se « pousse à deux » toujours en dialogue. C'est le défaut le plus sensible du pilier.
- **Une seule information propre à chacun**: l'envie secrète. Le regard du métier n'est toujours pas codé.
- **Le nouveau rendez-vous du jour 14 a une fenêtre** (15 h à 18 h, ce jour-là seulement): un duo qui ne s'y trouve pas le perd, contre la règle du cahier (2.5: « sans fenêtre horaire qui se perdrait »). Les robots ne l'ont pas joué (ils ne vont pas au quai à cette heure), donc personne ne l'a vu se déclencher en vrai.
- Mesure de proximité inexploitable à ce tour: depuis la correction du robot de la porte, les deux robots attendent au même endroit les jours creux (90 à 100 % du temps à moins de 6 m les jours 10, 12 et 14), sans rien faire ensemble. Je ne m'en sers pas pour noter.

## Les trois priorités

1. **D2, gestes à deux** (pilier 7, +1 attendu): pousser la draisine à deux avec la mécanique de la poutre, et un second porté (colis du poste à galène ou du poêle, livré au train). dev-gameplay-3d 90 à 120 min, game-designer 20 min, level-designer 20 min (points et parcours).
2. **Un but d'après-midi dans les jours creux** (pilier 6, +0,5 à +1): les jours 6, 10, 11 et 13, une petite demande à faire dans la journée, qui oblige à sortir du potager (un objet à retrouver sur la carte, un poisson précis, une livraison à deux endroits à la fois, qui se fait mieux à deux). game-designer 45 min, level-designer 15 min (points).
3. **Le rendez-vous du jour 14 sans fenêtre perdue** (pilier 7, +0,5 avec le regard du métier): garder la scène de Firmin ouverte jusqu'au jour 15 au matin, ou l'annoncer la veille par une réplique; puis coder le regard du métier (P1 de `demo.md`), deuxième information à se transmettre. game-designer 10 min; dev-gameplay-3d et ux-ui-designer 60 à 90 min.

## Vers 100 heures

Inchangé depuis le tour 1: les trois risques restent (voix des habitants qui s'use, semaine identique et quêtes d'apport, réserves finies sans aléa). Seul progrès pour le premier: la règle « la moins récemment entendue » est le bon socle. Il manque encore, pour tenir 361 journées, des répliques qui citent ce que l'autre joueur a fait (HA-03) et des habitants qui parlent entre eux.

## Non vérifié

- Le rythme ressenti par un vrai duo: les robots ne bavardent pas et ne flânent pas. Le joueur bavard du relevé est virtuel.
- La scène de Firmin du jour 14 en cours de partie (ses conditions sont vraies le jour 14 à 16 h, d'après la sonde; les robots ne sont pas au point).
