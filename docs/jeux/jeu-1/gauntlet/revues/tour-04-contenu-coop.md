# Tour 4: revue adverse des piliers 6 (contenu et rythme) et 7 (coopération)

| Champ | Valeur |
|---|---|
| Relecteur | level-designer (auteur de la carte, pas du contenu ni des règles) |
| Date | 2026-10-31 |
| Version lue | arbre principal à `c2c4cb4` (draisine poussée et gros colis portés à deux, quatre buts d'après-midi, rendez-vous du jour 14 prolongé, `high_five` au rendu) |
| Épreuve | G6, revue adverse: « mieux qu'avant », preuve à l'appui |
| Référence | `revues/tour-03-contenu-coop.md` (6,5 et 6,5) |

## Verdict

**Mieux qu'avant sur les deux piliers, nettement sur le pilier 7.** Le défaut le plus sensible du tour 1 (D2, un seul geste à deux) est traité: la draisine se pousse vraiment à deux pour tous les duos, et les gros objets du catalogue se portent à deux du quai à la maison. Les après-midi des jours 10, 11 et 13 ont maintenant un but. Restent sous 8: le jour 6, qui n'est pas prouvé; des buts encore surtout d'apport; une seule information propre à chacun; aucun aléa.

| Pilier | Tour 1 | Tour 3 | Tour 4 |
|---|---|---|---|
| 6. Contenu et rythme | 5 | 6,5 | **7** |
| 7. Coopération | 6 | 6,5 | **7,5** |

## Méthode

Script du tour 3 adapté (`/tmp/lpl6/mesure6.test.ts`, jetable, lancé par `npx vitest run --root games/la-petite-ligne --dir /tmp/lpl6`). Il relève en plus les ports à deux (`beam_lifted`, `beam_placed`, avec ce qui est porté), les départs de quêtes avec l'heure et les achats. Robots sur toute la démo, graine 20261030 avec l'énigme et graine 7 sans: 68,4 minutes de jeu chacune, fin atteinte. Le joueur bavard virtuel est celui du tour 3.

## Mesures

| Mesure | Tour 3 | Tour 4 | Preuve |
|---|---|---|---|
| Ports à deux, graine 20261030 | 1 (poutre, jour 1) | **3**: poutre (jour 1), draisine (jour 10), poste à galène du quai à la maison (jour 15) | événements `beam_lifted` avec `beam.purpose` et `beam.contents` |
| Ports à deux, graine 7 (sans l'énigme) | 1 | **3**: poutre (1), draisine (13, par le second chemin), poste à galène (15) | idem |
| Ports à deux garantis pour tout duo | 1 | **2** (poutre, draisine); les colis lourds dépendent d'un achat facultatif (poste à galène 120 sous, poêle à bois 90 sous) | `objets.json`, `carriedByTwo` |
| Longueur des ports | poutre seule | draisine environ 7 m (`toOffset` [-6, 4]), colis du quai à la porte de la maison | `reglages.json`, `carry` |
| Buts d'après-midi | aucun | jours 6, 10, 11, 13, ouverts d'eux-mêmes à 12 h (pas besoin de parler) | `quest_started` à 12 h, deux graines |
| Buts d'après-midi finis par les robots | | jours 10, 11 et 13: oui, deux graines; **jour 6 (pissenlits): jamais** | `quest_done` |
| Dernier événement utile de la journée, jours 10, 11, 13 | 7 h à 9 h | **12 h à 13 h** (jusqu'à 19 h pour un robot au jour 13, graine 7) | relevé par jour |
| Dernier événement utile, jour 6 | 6 h | **6 h** (inchangé, faute de pissenlits ramassés par les robots) | idem |
| Rendez-vous de Firmin | jour 14 seulement, 15 h à 18 h | annoncé la veille, ouvert jusqu'au départ du jour 15; joué par les robots le jour 15, deux graines | `firmin_eve_scene` |
| Redites, trois conversations par jour | 49 à 51 % | 48 à 49 % | relevé 9 h, 13 h, 17 h |
| Redites, une conversation par jour | 7 à 9 % | 19 à 21 % mesurés, **5 % une fois corrigé l'artefact** ci-dessous | relevé 13 h |
| Matins sans envie (jours 2 à 15) | aucun | aucun | relevé des envies |
| Bourse finale, deux graines | 1 432 et 1 432 | 1 392 et 1 392 | toujours aucun aléa |

Artefact de mesure: `odette_dandelions_ask` est une réplique « une fois pour le duo »; les robots ne vont jamais l'écouter, et mon joueur virtuel ne marque pas les répliques uniques comme dites. Il l'entend donc dix jours de suite. Un vrai joueur ne l'entend qu'une fois. Hors cet artefact, les redites restent au niveau du tour 3.

## Pilier 6: 7 / 10

### Ce qui progresse

- **Les après-midi creux du tour 3 ont un but**: aux jours 10, 11 et 13, les robots travaillent maintenant jusqu'à 12 h à 13 h au lieu de s'arrêter à 7 h à 9 h. Les buts arrivent d'eux-mêmes au carnet à midi, ce qui donne une relance au milieu de la journée.
- **Des formes nouvelles**: le carnet perdu de Jeanne (chercher au bord de l'eau) et le chevesne de Firmin (un poisson précis) changent de « apporter ce qu'on a déjà ». L'écriture garde ses voix (le fil des chaussettes d'Odette, chez Firmin et chez Basile).
- **Le rendez-vous de Firmin ne se perd plus** et il est annoncé la veille.

### Ce qui retient la note sous 8

- **Le jour 6 n'est pas prouvé**: aucun robot ne ramasse les pissenlits (deux graines), donc le seul nouveau but du jour 6 n'a jamais été fini en simulation. Il faut le faire jouer par le robot pour savoir s'il se termine, et en combien de temps.
- **Les buts restent surtout des apports**: trois sur quatre (pissenlits, colis, chevesne) consistent à apporter un objet à un habitant. Sur la démo, 11 quêtes sur 21 sont des apports (12 avec le carnet de Jeanne, qu'on rend aussi en main propre).
- **Les après-midi se vident encore vers 13 h**: le but d'après-midi comble environ une heure de jeu, pas l'après-midi entière (13 h à 19 h: 6 h de jeu, environ 2,1 minutes réelles sans rien d'exigé), juste au-dessus du seuil de 2 minutes du barème.
- **Toujours aucun aléa**: deux graines, même bourse, même partie.
- La structure à 100 heures n'a pas changé (risques du tour 1).

## Pilier 7: 7,5 / 10

### Ce qui progresse

- **Des gestes à deux qui reviennent**: au moins un par semaine pour tous les duos (poutre en semaine 1, draisine en semaine 2), et jusqu'à deux de plus pour qui achète au catalogue (poste à galène, poêle à bois). La draisine, sommet de la semaine 2, se fait enfin ensemble, et avec le second chemin vers la remise, elle est jouée par les deux graines.
- **Les gros colis donnent du sens au catalogue choisi à deux**: on décide l'achat ensemble, puis on le porte ensemble.
- **La tape dans la main** (`high_five`, rendu): quand les deux sont proches et à l'arrêt après une réussite partagée, la récompense se voit. Je ne l'ai pas vue à l'écran (vérifiée seulement dans le code de `src/rendu/personnages.ts`).

### Ce qui retient la note sous 8

- **Seuls deux ports sont garantis en quinze jours**, et ils se ressemblent (même mécanique, porter et avancer). Il manque un geste d'une autre nature, comme pomper la draisine en rythme (GE-04 du cahier).
- **Une seule information propre à chacun**, l'envie secrète. Le regard du métier n'est toujours pas codé.
- **Les colis d'Odette séparent les joueurs**: « À deux, chacun son chemin, ça va plus vite. » C'est voulu et agréable, mais le seul nouveau but conçu pour deux pousse à se séparer.
- La tape dans la main n'est qu'au rendu: rien ne la compte (pas de Cœur, pas de trace dans l'historique).

## Les trois priorités

1. **Faire jouer le jour 6 au robot** (pilier 6): apprendre au robot à ramasser les pissenlits et à finir `odette_dandelions`, puis mesurer l'après-midi du jour 6. S'il reste des pissenlits introuvables depuis la caméra par défaut, je reprends leurs points (`forage_edge_*`). qa-testeur ou dev-gameplay-3d 30 min, level-designer 15 min. Gain attendu: preuve du jour 6, +0,5 si l'après-midi est rempli.
2. **Une information que seul l'un voit** (pilier 7, +0,5): le regard du métier (P1 de `demo.md`, les cases qui ont soif chez le seul jardinier), ou plus simple pour la démo: le carnet de Jeanne visible d'un seul joueur, qui guide l'autre. dev-gameplay-3d et ux-ui-designer 60 à 90 min, game-designer 15 min.
3. **Un but d'après-midi qui ne soit pas un apport, et un peu d'aléa** (pilier 6, +0,5): par exemple le but du jour 6 ou du jour 11 tiré dans une réserve de deux ou trois variantes selon la graine (la recette montre toujours une partie identique pour toutes les graines). game-designer 45 min, dev-gameplay-3d 20 min.

## Vers 100 heures

Pas de changement depuis le tour 1. La généralisation du port (`world.beam` pour la poutre, la draisine, les colis) est un bon socle: un nouveau geste à deux devient surtout une affaire de données. Il faudra des gestes de natures différentes (rythme, synchronisation, guidage) pour que le temps passé à deux ne devienne pas une routine sur 361 journées.

## Non vérifié

- La tape dans la main, la draisine qui roule et le colis porté à l'écran: pas de capture faite à ce tour (code et événements seulement).
- Le jour 6 joué jusqu'au bout (voir priorité 1).
- Le rythme ressenti par un vrai duo: les robots ne flânent pas.
