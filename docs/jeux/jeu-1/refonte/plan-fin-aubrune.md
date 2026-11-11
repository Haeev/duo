# Plan pour finir Aubrune à 100 %, du plus petit effort au plus gros (2026-11-11)

## Contexte

La 0.22.0 est en ligne depuis le 11 novembre à 19 h 14. En une heure de jeu, tu as trouvé ce que nos tests ne voyaient pas: une étape de l'histoire infranchissable (les ronces), un objectif qui envoie au mauvais endroit (la pension), des outils d'histoire perdus quand le sac est plein, presque aucune animation de geste, aucun outil en main, un mode déco à refaire. La cause commune: nos tests prouvent que les règles marchent, pas que la partie se joue (plusieurs donnent l'objet au joueur au lieu de le lui faire gagner).

Ce plan reprend tout ce qui sépare Aubrune du 100 % (tes retours de ce soir, ce qui reste de l'audit du cahier, les finitions), rangé par effort croissant pour plier les broutilles d'abord. Aubrune est aujourd'hui à 75 % environ (estimation).

## Règles de conduite pendant tout le plan

- Deux ou trois membres en parallèle au plus, briefs étroits, chacun dans son worktree; je relis, j'intègre, je committe.
- Chaque membre teste sa nouveauté par une simulation courte; la suite rapide et la recette à deux joueurs tournent une fois par lot, avant publication.
- Tout nouveau contenu passe par les gabarits en données (aucun cas particulier dans le moteur).
- Une publication par lot fini, au plus tard à 20 h pour celle du soir. Une correction de blocage se publie dès qu'elle est verte, sans attendre le soir.
- Le suivi (Artifact) est mis à jour à chaque lot fusionné: journal, pourcentages, questions.
- Rien sur Hautefonte ni Combe-Veilleuse avant ta relecture d'Aubrune.

## Lot 1: les broutilles (moins de 30 minutes chacune, environ 2 h en tout, puis 0.22.1)

Des données, des textes et de petites retouches. Deux missions en parallèle (dev gameplay, game-designer), plus ce que je fais moi-même.

| # | Quoi | Où | Réussi quand |
|---|---|---|---|
| 1.1 | **Ronces (bloquant)**: un vrai arrachage. Nouvelle ressource « ronces à arracher » (verbe « Arracher », `after: gone`, toute saison), posée devant la maison; l'étape `debroussailler` se valide quand les ronces ont disparu, plus sur des mûres | `donnees/commun/ressources/`, `donnees/lieux/aubrune/quetes/le-train-de-5h12.json`, `plan.json` par `construire_plan.py` | au jour 1, un joueur arrache les ronces et l'étape passe; le test ne donne plus rien par `giveItem` |
| 1.2 | **« Dors à la pension »**: texte (« à l'étage de l'épicerie, par l'escalier au fond de la cuisine »), repère sur l'escalier, coucher dit possible dès 15 h | même fichier de quête | le repère mène au lit |
| 1.3 | **Relevé de tous les objectifs qui désignent un lieu**: chaque `target.point` comparé au lieu réel de l'action | les 9 fichiers de `quetes/` | tableau des écarts, corrigés dans la foulée |
| 1.4 | **Outils de Basile**: un don d'objet d'histoire ne tombe jamais au sol. Sac plein: Basile le dit, garde les outils, le dialogue reste ouvert; ceux qui les ont perdus les reçoivent de nouveau | `src/simulation/sac/actions.ts` (`giveStack`), `regles/effets.ts`, `dialogues/basile-outils.json` | test court: sac plein, on vide, Basile redonne |
| 1.5 | **Assise à côté du tabouret**: position et hauteur d'assise par défaut au centre du meuble pour les sièges à une place | brique `sit`, `src/rendu/personnages/` | capture: assis sur le tabouret, la chaise, le banc |
| 1.6 | **Hygiène à 100 sans attendre la salle d'eau**: le baquet reçoit la brique `relieve` (toilette complète, plafond 100) et un baquet est posé dans la maison | `donnees/commun/meubles/baquet.json`, `logements/maison-du-garde.json` | l'hygiène remonte à 100 à la maison |
| 1.7 | **Nichoir**: une source (plan donné par un habitant) et un usage (posable au jardin) | `commun/plans/nichoir.json`, `objets/nichoir.json` | le nichoir s'obtient et se pose |
| 1.8 | **Petits textes**: signe de l'odeur (« pff » contre « Pouah »), ardoise du besoin du jour, libellés des touches des mini-jeux | `src/interface/textes.ts`, commerces | relu à l'écran |
| 1.9 | **Sauvegarde au coucher** (le cahier la demande) | `src/sauvegarde/` | une sauvegarde au moment de dormir |
| 1.10 | **Souvenir de tenue** et **changer d'apparence chez Solange** (le miroir de la cabine ouvre l'éditeur, gratuit) | mercerie, éditeur de personnage | les deux marchent à deux joueurs |
| 1.11 | **Cahier à jour**: les 16 contradictions de l'audit (section D) réécrites d'après tes décisions | `docs/jeux/jeu-1/refonte/cahier-des-charges.md` | plus aucune contradiction listée |
| 1.12 | Déjà corrigé, à publier: la décision à deux qui se validait en martelant Espace | commit 40b1cce | dans la 0.22.1 |

Publication: **0.22.1** dès que le lot est vert (suite rapide, recette à deux joueurs, copie sans documentation).

## Lot 2: le filet de sécurité (une demi-journée, lancé en même temps que le lot 1)

C'est la leçon de ce soir, et ce qui évite que tu retrouves un blocage à chaque séance.

- 2.1 **Un robot qui joue toute l'histoire d'Aubrune par de vrais gestes**, en simulation rapide et sans rendu: prologue, actes 1 à 3, Veillée, les suites secondaires. Interdit de se donner un objet: il cueille, achète, fabrique, parle. Il part du jour 1, au printemps. Livrable: la liste de chaque étape où il reste coincé, avec la cause (`tests/`, nouveau fichier, rangé dans `pnpm test:longues`).
- 2.2 **Relevé mécanique** des `giveItem` et `carry` dans les tests des actes: chacun est un trou possible, à remplacer par le vrai geste ou à justifier.
- 2.3 **Correction de chaque blocage trouvé** (mêmes règles que le lot 1), publiés avec la version suivante.
- 2.4 **L'invité qui revient en pleine activité** (reconnexion pendant une pêche, une cuisson, un chantier): reprise propre (dev réseau).

## Lot 3: les moyens (1 à 3 h chacun, environ deux jours de studio)

Dans cet ordre, les plus visibles d'abord.

| # | Quoi | Qui | Réussi quand |
|---|---|---|---|
| 3.1 | **Les huit gestes manquants** (ramasser, bêcher, se laver, secouer, cueillir au sol, couper, tendre le bras, tendre le bras en haut), ajoutés à `assets/commun/personnages/body.glb` par script Blender | artiste 3D | les 31 actions des données jouent leur geste; planche de contact relue |
| 3.2 | **L'outil en main**: un modèle par outil (hache, bêche, canne, épuisette, arrosoir, filet, marteau, instrument), accroché à l'os de la main droite quand il est choisi dans la barre; déclaré dans la fiche de l'objet (gabarit) | artiste 3D, dev gameplay 3D | capture de chaque outil tenu, en marche et en geste, chez les deux joueurs |
| 3.3 | **Salle d'eau** (pièce à 120 € par l'ardoise de chantier, douche à 100 en 3 s) et savon parfumé (1,50 €, bonus Soigné à 1,3) | game-designer, artiste 3D, dev gameplay 3D | la douche et le savon marchent; prix dans `economie-aubrune.md` |
| 3.4 | **Trophées de collection**: un meuble trophée par collection complète (8), livré à l'inventaire de la maison | dev gameplay 3D, artiste 3D | une collection finie par un test donne son trophée, posable |
| 3.5 | **Petites demandes**: 8 à 10 demandes courtes, une par jour au plus, en bulle | game-designer, dev gameplay 3D | 14 jours simulés, jamais deux le même jour |
| 3.6 | **Quilles au café** (partie de 30 à 60 s, seul ou à deux, 2 à 6 €) | game-designer, dev gameplay 3D | une partie jouée à deux en simulation et en parcours |
| 3.7 | **Course de draisine** et **rayon tournant** des commerces | dev gameplay 3D | test court de chacun |
| 3.8 | **Meubles en deux teintes vraiment différentes** (miel et sauge se confondent) | artiste 3D | planche des deux teintes côte à côte |
| 3.9 | **Modèles provisoires à remplacer**: poteaux indicateurs, boîtes aux lettres, panneau de commande, diapason, trouvailles de berge | artiste 3D | contrôle des volumes vert, captures relues |
| 3.10 | **Score cumulé dans Duo** et vignette rechargée après mise à jour (déjà codée): **Duo 0.4.1**, à réinstaller sur les deux machines | dev plateforme, build | essais Electron verts, release marquée « Latest » |

## Lot 4: les gros (une demi-journée ou plus chacun, environ trois jours)

| # | Quoi | Qui | Réussi quand |
|---|---|---|---|
| 4.1 | **Mode déco refait**: la vraie maison au rendu du jeu, caméra au-dessus, vrais meubles saisis et posés à la souris, fantôme pendant le déplacement, grille au sol seulement à ce moment. Maquette de l'écran montrée avant le code. L'ancien plan 2D est supprimé | UX/UI, dev gameplay 3D | captures notées 9 sur 10; parcours à deux joueurs (poser, tourner, ranger) |
| 4.2 | **Gestes des activités**: pêcher (lancer, ferrer, épuisette), cuisiner, pomper, arroser, scier, pomper la draisine, jouer d'un instrument | artiste 3D, dev gameplay 3D | chaque activité a son geste, relu en capture |
| 4.3 | **Saisons et météo à l'écran**: ambiances des quatre saisons, feuillage d'automne, neige au sol, pluie et neige qui tombent, dans le budget de pixels du PC | tech-artist | une capture par saison et par temps; coût mesuré avec l'outil F9 |
| 4.4 | **Le bourg qui change** au fil des actes: volets, vitrines, fumées des maisons rouvertes (objets avec condition, d'après le plan vu du dessus) | level-designer, artiste 3D | trois captures: début, après l'acte 2, après l'acte 3 |
| 4.5 | **Fluidité sur le PC**: le client la dit fluide sur la 0.22.0 (message du 11 novembre, 22 h 20). Reste à garder ce niveau: un relevé F9 de contrôle quand il veut, et chaque ajout de rendu (saisons, déco) mesuré avant fusion | tech-artist, seulement en cas de recul | aucune saccade signalée en séance; relevé au-dessus de 30 images par seconde si on le mesure |
| 4.6 | **Les 120 anciens modèles** de la liste `a_reprendre`, par familles, les plus vus d'abord | artiste 3D (deux exemplaires) | contrôle des volumes vert, liste vide ou justifiée |
| 4.7 | **Revue visuelle complète** par le directeur artistique (6,7 sur 10 ce matin), reprises jusqu'à 9 sur 10, toutes les captures montrées dans le suivi | directeur artistique, puis reprises | chaque écran et chaque lieu noté 9 ou plus, ou reprise planifiée |

## Lot 5: la clôture d'Aubrune (une journée)

- 5.1 Parcours à deux joueurs de toutes les nouveautés (musique, draisine, commande du samedi, pêche à deux, salle d'eau, quilles, déco) ajoutés à la recette.
- 5.2 Revue de code de l'architecte sur les lots 1 à 4, recette entière, poids du paquet.
- 5.3 Publication, check-list de séance pour vous deux, liste « à tester chez le client » (son, pare-feu, fluidité).
- 5.4 Ta séance de validation et ta relecture du chapitre. Tes retours redeviennent des tâches. Aubrune est à 100 % quand tu le dis.

## Ce que j'attends de toi (rien ne bloque le lot 1)

- Un relevé F9 du PC quand tu y penses, pour avoir le chiffre (plus urgent: tu dis la version PC fluide).
- La version affichée dans le salon de Duo pour La Petite Ligne (pour comprendre la vignette).
- Tes retours de séance au fil de l'eau: je les classe dans ces lots.

## Calendrier honnête

- Lot 1 et début du lot 2: environ 2 h après ton feu vert, 0.22.1 en ligne dans la foulée.
- Lots 2 et 3: les 12 et 13 novembre, une version chaque soir avant 21 h.
- Lot 4: du 13 au 15.
- Lot 5: le 16. Ces dates glissent si le robot du lot 2 trouve beaucoup de blocages.

## Vérification

- Par mission: `pnpm exec tsc --noEmit`, les tests ciblés (`pnpm exec vitest run <fichier>`), une capture examinée pour tout ce qui se voit.
- Par lot, une fois: `pnpm exec vitest run --maxWorkers=3` (suite rapide), puis `pnpm --filter @duo/sdk-dev build` et `LPL2_STRICT=1 pnpm test:e2e --trace off` (32 parcours à deux joueurs), contrôle des tirets, copie sans documentation (install, types, build, tests).
- Par publication: flux `jeux.yml` surveillé jusqu'au bout, puis catalogue public vérifié à la bonne version.
- Lot 2: le robot de l'histoire doit finir Aubrune sans aucun objet offert; c'est lui qui dit si un blocage subsiste.
