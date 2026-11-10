# Écriture jouable: actes 2 et 3 d'Aubrune, « La minute d'écart » et « Ceux qui partent »

Auteur: game-designer, 2026-11-10. Suite de `ecriture-acte-1.md`. Source: cahier des charges 0.2, sections 6.1 à 6.4, et `carte-aubrune/plan.md` (les lieux sont nommés par leurs identifiants de `plan.json`). Tout est en fiches de données, aucune ligne de moteur; contrôle: `tests/actes-2-3-aubrune.test.ts`.

## En bref

- Deux suites principales qui s'enchaînent après « Le train de 5 h 12 » (acte 1): `la-minute-d-ecart` (31 étapes, 3 h visées) et `ceux-qui-partent` (38 étapes, 4 h visées).
- 481 répliques nouvelles (354 de dialogue, 127 de scène), 64 réponses au choix, 20 scènes dont 8 à deux rôles, 14 secrets d'amitié, 10 habitants qui arrivent par le train.
- Le fil rouge tient en trois lettres d'Émile Lacombe: l'embauche (acte 1), « Il reste la cave. » (fin de l'acte 2), « Merci pour la lanterne. Bureau 512: frappez fort. » (fin de l'acte 3, crochet vers Hautefonte).
- Règle de ton tenue: avant 5 h 12 de la dernière nuit, chaque indice reçoit son explication raisonnable, dite par un habitant.

## 1. Où sont les fiches

Dossier `games/la-petite-ligne-2/donnees/lieux/aubrune/`:

| Dossier | Ajouts |
|---|---|
| `quetes/` | `la-minute-d-ecart.json` (acte 2, 3 chapitres), `ceux-qui-partent.json` (acte 3, 5 chapitres) |
| `dialogues/` | 108 dialogues: 50 d'histoire et de cadeaux, 21 souvenirs, 14 secrets, 5 présentations, 9 bonjours en tournante et 9 remarques d'hygiène pour les arrivants |
| `scenes/` | 20 scènes |
| `habitants/` | 10 fiches nouvelles; une ligne de planning ajoutée à `achille.json`, `ambroise.json` et `jeanne.json` (seules retouches de l'acte 1) |

Conventions gardées de l'acte 1: chaque étape écrit `aubrune.acte2.<étape>` ou `aubrune.acte3.<étape>` (« ouvert », puis « fait »); dialogues d'histoire en priorité 60 tant que l'étape est ouverte; souvenirs en priorité 30, une fois par joueur; secrets en priorité 40. Nouveauté: un dialogue qui donne un objet à chaque joueur (canne, appareil photo, sacs, farine) est en priorité 65 et reste disponible pour l'autre joueur après le passage de l'étape.

## 2. Acte 2: « La minute d'écart » (3 h, zones « v » puis « r »)

Durées: temps de jeu visé pour un duo médian, récoltes comprises. « Seul »: l'étape se fait sans l'autre.

### Chapitre 1, « Le règlement » (18 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque, apprend | Durée |
|---|---|---|---|---|
| occupation | `quai` (Firmin) | dialogue `firmin-occupation` | le but: faire revenir le train de Rosalie | 3 min |
| cuisine | `lis` puis `hd` (Basile) | remettre 6 bûches à Basile | scène `le-reglement-retrouve`: la cuisine, le réchaud, le règlement qui calait le buffet | 12 min |
| article-7 | `quai` | dialogue `firmin-reglement` | les quatre conditions; verrou V2, zone « v » | 3 min |

### Chapitre 2, « Quatre conditions » (2 h 10, trois fils menés en parallèle)

Fil de la voie (départ `pn`, aller par le fer, retour par l'eau):

| Étape | Lieu du plan | Ce qui la franchit | Débloque, apprend | Durée |
|---|---|---|---|---|
| tranchee | `tw2` | y arriver | mûres de la tranchée | 6 min |
| wagon | `tw3` | y arriver | scène `le-wagon-oublie`: la cabane de Jeanne, 41 bâtons à la craie sous « 5 h 12 »; on bute sur les frênes | 3 min |
| frenes | `gr6` (Mado) | dialogue `mado-hache` | la meule, l'usure | 3 min |
| hache-forgee | grèves (`bg`), `gr6` | remettre 3 pierres et 2 bûches à Mado | hache forgée (l'autre joueur fait reforger la sienne de la même façon) | 12 min |
| degager | `tw3` | y revenir avec la hache forgée | verrou V2b; 4 bûches de frêne | 8 min |
| semaphore | `po` | y arriver | scène `le-semaphore-manchot`: le bras est dans les orties | 3 min |
| bras | `gr6` | remettre 4 bûches de frêne à Mado | le bras redressé | 4 min |
| leviers | `po` et `pg0`, **à deux** | scène `les-leviers` (un rôle dans la cabine, un au pied du signal) | signal ouvert; verrou V11 (portillon), retour par la vanne | 8 min |

Fil de la pendule (d'un bout à l'autre de la Grand-Route):

| Étape | Lieu du plan | Ce qui la franchit | Débloque, apprend | Durée |
|---|---|---|---|---|
| pendule | `quai-e` | dialogue `firmin-pendule` | la pendule arrêtée sur 5 h 12, la montre que Firmin « garde » | 3 min |
| version-ambroise | `gr7` | dialogue `ambroise-minute` | sa version: « voleur de minute » | 4 min |
| version-firmin | `quai` | dialogue `firmin-minute` | sa version: la pendule avançait | 3 min |
| odette-sait | `pl-o` | dialogue `odette-minute` | « ils ont raison l'un comme l'autre »; le prix d'Honorine | 3 min |
| oeuf | `hd` (réchaud), `gr8` | montrer un œuf au plat à Honorine | cuisine au réchaud. **Rebondissement**: elle n'y touche pas et l'envoie à sa sœur | 10 min |
| marthe-oeuf | `pv` | remettre l'œuf à Marthe | amorce de « La robe et la cloche » | 4 min |
| confidence | `gr8` | dialogue `honorine-confidence` | **le secret de la minute**: l'ordre de la Compagnie, Émile parti à pied | 5 min |
| aveu-ambroise, aveu-firmin | `gr7`, `quai` | deux dialogues, dans l'ordre qu'on veut (un joueur chacun, si l'on veut) | les deux acceptent, « sans se regarder » | 7 min |

Fil de la rivière et de la commande:

| Étape | Lieu du plan | Ce qui la franchit | Débloque, apprend | Durée |
|---|---|---|---|---|
| lecon | `gr4` (fournil) | dialogue `achille-lecon` | une canne par joueur; verrou V1, zone « r » | 4 min |
| saule | `bw2` | y arriver | Achille quitte le fournil pour la fosse | 3 min |
| fosse | `i2` | remettre 2 goujons à Achille | la pêche; amorce de « La Baronne » | 10 min |
| commande-jardin | `jd`, `quai` | remettre 6 radis et 4 œufs à Firmin | potager, poules | 12 min |
| commande-riviere | `i2` ou `ponton`, `quai` | remettre 3 goujons | | 8 min |
| commande-bois | `lis`, `quai` | remettre 5 bûches | | 6 min |

### Chapitre 3, « Le premier train » (24 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| telegraphe | `quai` | dialogue `firmin-telegraphe` | « Demain. 10 h 04. » | 3 min |
| veille-du-train | `hd` | une nuit de sommeil | | 6 min |
| le-train | `quai-e`, **à deux**, de 8 h à 13 h | scène `la-pendule-repart` | la pendule repart, poignée de main sans regard, le train entre en gare; Rosalie, Lucie, Colette, Armand descendent | 8 min |
| rosalie | `quai` | dialogue `rosalie-lettre` | 24 € de paie, un sac de toile par joueur. **Rebondissement**: une lettre d'É. Lacombe, postée à Hautefonte avant-hier: « Il reste la cave. » | 4 min |
| farce | `quai` | dialogue `firmin-farce` | Firmin empoche la deuxième lettre; café et école ouverts | 3 min |

## 3. Acte 3: « Ceux qui partent » (4 h, zones « c », « t », « m », « f »)

### Chapitre 1, « Il reste la cave » (34 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| chambre | `hd` (Basile) | dialogue `basile-chambre` | verrous V5 et V6, zone « c » | 3 min |
| coupe | `c2`, puis `hd` | remettre 8 bûches à Basile | la Côte à explorer | 18 min |
| trappe | `hd`, **à deux** | scène `la-trappe` (pied-de-biche, lampe) | chambre et cave; le registre de nuit, la lanterne sans verre. **Rebondissement**: six semaines écrites d'une autre main | 8 min |
| registre | `quai` | dialogue `firmin-registre` | secret de Firmin: c'est lui qui a tenu le registre; Émile est son oncle | 5 min |

### Chapitre 2, « La lueur » (27 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| lucie | `pl` ou `gr5` | dialogue `lucie-veille` | un appareil photo par joueur | 4 min |
| pose-longue | `pn-s`, 5 h 12 | scène `la-pose-longue` (déclencheur, chronomètre) | nuit jouable | 12 min |
| developpement | `pl` | dialogue `lucie-photo`, puis scène `des-fenetres` | « Des fenêtres », dit Jeanne; « des gouttes », dit Lucie | 5 min |
| tirage | `quai` | dialogue `firmin-photo` | Firmin rend les lettres; la clé de la grille (V8), zone « t »; le chapitre « Halte de nuit » du règlement | 6 min |

### Chapitre 3, « Vingt âmes » (1 h 37, deux fils en parallèle)

Le registre de la halte:

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| compte | `quai` | dialogue `firmin-compte` | 15 âmes sur 20 | 4 min |
| nuit-du-train | `hd` | une nuit de sommeil | | 5 min |
| train-des-cinq | `quai`, **à deux**, de 8 h à 13 h | scène `le-train-des-cinq` | Paulin, Margot, Léon, Berthe, Barnabé; verrou V4, zone « m » | 6 min |
| gue | `gu-n` (Paulin y attend) | remettre 6 pierres plates | verrous V3 et V9, zone « f », la ferme | 12 min |
| moulin | `mc`, puis `v1` (la vanne) | ouvrir la vanne | la roue tourne | 8 min |
| farine | `mc` | dialogue `berthe-farine` | 2 farines par joueur | 3 min |
| leon | `bg` ou `fs3` | dialogue `leon-heure` | **rebondissement**: il ne sait pas lire l'heure | 4 min |
| pari | `pl` ou `pn-s` (Jeanne) | dialogue `jeanne-pari`, scène `midi-moins-dix` | Léon signe: « il est midi moins dix » | 5 min |
| registre-plein | `quai` | dialogue `firmin-vingt` | vingt âmes; amorce du « fantôme » du moulin (la brioche de Barnabé) | 3 min |

La coutume:

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| lumignon | `pv` | dialogue `marthe-lumignon` | la coutume; la clé de la porte haute (V7) | 4 min |
| dalle | `ci` | y arriver | scène `la-dalle-des-lacombe`: la place d'Émile est restée nue | 6 min |
| marthe-manque | `pv` | dialogue `marthe-manque` | Firmin fleurit la dalle le jeudi | 3 min |
| honorine-prix | `gr8` | dialogue `honorine-anes` | son prix: « les deux ânes » à la même table | 4 min |
| repas | `fc` (légumes), `pl-o` (bœuf), cuisine de `hd`, `gr6` | remettre un pot-au-feu à Colette | **premier repas spécial**, cuisiné à deux; scène `dos-a-dos` | 25 min |
| le-train-d-honorine | `gr8` | dialogue `honorine-train` | elle a vu l'autorail crème, à sept ans | 5 min |

### Chapitre 4, « La halte de nuit » (55 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| jeanne | `pl` ou `pn-s` | dialogue `jeanne-cachette` | | 4 min |
| grille | `pnh`, `te1` | y arriver | Jeanne file au tunnel par son trou | 5 min |
| guerite | `te2` | y arriver | scène `la-guerite`: « Saluer en sortant. » | 4 min |
| tunnel | `portail`, `tu1` | y arriver | | 4 min |
| cachette | `tu3`, **à deux** | scène `la-cachette-d-emile` (boîte, lampe) | le verre, le mot d'Émile, le rail qui brille; verrou V10 | 8 min |
| belvedere | `bv` | y arriver | scène `vu-d-en-haut`; retour par `k2`, `cn`, `ci` | 5 min |
| sertir | `gr6` | dialogue `mado-sertir` | la lanterne prête | 6 min |
| heure-juste | `gr7` | dialogue `ambroise-cloche` | la cloche retarde de quatre minutes depuis 1962 | 4 min |
| marthe-sonne | `pv` | dialogue `marthe-heure` | Marthe sonnera juste, et posera le lumignon | 4 min |
| saindoux | `pl-o` | dialogue `odette-saindoux` | de quoi graisser la barrière | 3 min |
| repetition | `pn-s` et `quai`, **à deux** | scène `la-repetition` | les deux gestes de la nuit: « Voie gardée ! », « Lanterne haute ! » | 8 min |

### Chapitre 5, « 5 h 12 » (30 min)

| Étape | Lieu du plan | Ce qui la franchit | Débloque | Durée |
|---|---|---|---|---|
| veillee | `pn-s` et `quai`, **à deux**, 5 h 12 | scène `l-autorail-creme` | l'autorail, le Contrôleur, les cartes de ligne, l'ordre de mission (Hautefonte, bureau 512) | 12 min |
| matin | `quai` | dialogue `firmin-apres`, scène `la-veillee-du-premier-train` | Firmin remonte la montre d'Émile; première Veillée | 8 min |
| troisieme-lettre | `pl` ou `gr5` | dialogue `lucie-lettre` | troisième lettre: « Bureau 512: frappez fort. » | 4 min |
| depart | `quai`, **à deux**, 5 h 12 | scène `en-voiture` | départ pour Hautefonte, quand on veut | 6 min |

Après la Veillée, Solange donne un sac à dos (10 cases) à chaque joueur (`solange-sac-a-dos`).

## 4. Les secrets

Un secret est une confidence d'amitié: dite une fois à chaque joueur, elle écrit le fait `aubrune.secret.<habitant>` (pour un futur onglet du carnet). Les deux secrets qui portent l'histoire passent par un service rendu, pas par un compteur (`references-de-ressenti.md`, section 2): l'œuf au plat et le pot-au-feu.

| Habitant | Condition | Ce qu'on apprend |
|---|---|---|
| Honorine | service: l'œuf porté à Marthe (acte 2) | la minute: l'ordre de la Compagnie, Émile parti à pied sur la voie |
| Honorine | service: le repas dos à dos (acte 3) | l'autorail crème vu à sept ans; sa marraine « partie depuis l'hiver » |
| Firmin | histoire (acte 3) | il a tenu le registre six semaines; Émile est son oncle |
| Firmin | 1 cœur | il annonce encore l'horaire de 1987, tout bas, le soir |
| Odette | 1 cœur | Émile lui avait réservé deux couverts « pour les nouveaux gardes », en 1987 |
| Basile | 1 cœur | il parle à ses planches, avec des virgules |
| Achille | 1 cœur | la brioche « pour ceux qui partent » sur sa fenêtre, disparue chaque matin (« un merle très régulier ») |
| Solange | 1 cœur | elle a quitté le théâtre par trac |
| Mado | 1 cœur | elle écrit à Barnabé sur des fers à cheval |
| Ambroise | 1 cœur | la clé de la pendule n'a jamais quitté sa poche |
| Honorine | 1 cœur, puis 2 cœurs après la confidence | pourquoi elle ment; le salut d'Émile vers la maison vide |
| Marthe | 1 cœur | un coup de cloche en moins pour l'anniversaire de sa sœur |
| Jeanne | 1 cœur | son carnet: une seule nuit à 5 h 13, celle où Ambroise avait la grippe |
| Lucie, Colette, Armand | 1 cœur | les cartes postales photographiées; le café qui est de la chicorée; la leçon faite au squelette |

Explications raisonnables données par les habitants: le vent et le lever du jour (Firmin), des gouttes sur l'objectif (Lucie), l'humidité et « les tunnels respirent » (Armand, rapporté par Jeanne), la fièvre d'une enfant de sept ans (Marthe), un camion de laitier (Odette), un rêve à deux (Basile), la levure (Achille).

## 5. Les dix arrivants

| Habitant | Arrive | Poste (plan) | Voix | Écrit |
|---|---|---|---|---|
| Rosalie Vasseur | au premier train, repart après la lettre | `quai` | `bouncy` | 3 bonjours, hygiène, la lettre |
| Lucie Arnaud | acte 2 | `pl` le matin, `gr5` | `bright` | 6 bonjours, 4 heures, hygiène, arrivée, secret, histoire |
| Colette Lafon | acte 2 | `gr6` (café) | `soft` | idem |
| Armand Castagné | acte 2 | `gr5` (école), `lv` le soir | `shy` | idem |
| Paulin, Margot, Léon Delmas | acte 3 | `gu-n` et `bg` tant que le gué manque, puis `fe1`, `fc`, `fs3` | `grumpy`, `soft`, `high` | 4 bonjours, hygiène, histoire ou arrivée |
| Berthe Lavergne | acte 3 | `mc` | `medium` | 4 bonjours, hygiène, histoire |
| Barnabé Tixier | acte 3 | `c2` le jour, `gr6` | `low` | 4 bonjours, hygiène, arrivée |
| Le Contrôleur (`anatole`) | les nuits de 5 h 12 de l'histoire | `quai` | `shy` | une réplique, les scènes |

Les cinq de l'acte 3 n'ont pas encore de répliques par heure ni de souvenirs: à écrire avec leurs suites secondaires.

## 6. Ce qui change à Aubrune (faits à lire par le rendu et le level design)

Le dénouement doit se voir. Chaque changement est un fait, posé au moment dit:

| Fait | Posé quand | Ce qu'on doit voir |
|---|---|---|
| `aubrune.maison.cuisine`, `.rechaud`, `.chambre`, `.cave` | actes 2 et 3 | les pièces de la maison; un réchaud utilisable dans la cuisine |
| `aubrune.halte.signal` | scène des leviers | le bras du sémaphore incliné |
| `aubrune.halte.pendule` | premier train | la pendule du quai à l'heure du jeu (elle montrait 5 h 12) |
| `aubrune.decor.cafe-ouvert`, `.ecole-ouverte` | fin de l'acte 2 | volets ouverts, terrasse, cour |
| `aubrune.decor.gue-refait`, `.moulin-tourne` | acte 3 | les trois dalles; la roue qui tourne (et s'entend) |
| `aubrune.cloche.juste` | acte 3 | la cloche sonne à l'heure de la pendule |
| `aubrune.lanterne.allumee` | 5 h 12 | la lanterne du garde allumée chaque nuit à la barrière, avec le lumignon |
| `aubrune.decor.horaire-5h12`, `.veillee`, `.montre-remontee` | matin du dénouement | la ligne à la craie au tableau des horaires, les lampions du quai |
| `aubrune.train.en-gare`, `aubrune.autorail.en-gare` | scènes de train | le train de Rosalie à quai; l'autorail crème à quai |

## 7. Ce que la carte doit porter (attaches pour le level design et les lots d'activités)

Le test joue l'histoire en donnant aux joueurs ce qu'ils auraient récolté; en jeu, il faut:

| Besoin | Où (plan) | Pour quelle étape |
|---|---|---|
| chênes qui repoussent ou coupe | `lis`, puis `c2` (ressource « bois ») | cuisine, commande, coupe |
| pierres plates à ramasser | `bg` (grève), `i4` | hache forgée, gué |
| réchaud dans la cuisine, puis cuisinière et plan de travail | maison | œuf au plat, pot-au-feu |
| coins de pêche (champ `fishing` de `lieu.json`) | `i2`, `ponton` | fosse, commande |
| ponte des poules | `jd` | commande |
| légumes de la ferme (carotte, poireau, pomme de terre) et bœuf chez Odette | `fc`, `pl-o` | repas |
| trois frênes à abattre à la hache forgée | `tw3` à `tw4` (V2b) | `degager` (aujourd'hui: y revenir avec la hache) |
| vanne à ouvrir (meuble à brique) | `vn` | `moulin` (aujourd'hui: y arriver) |

## 8. Ce que le moteur ne permet pas encore (le texte l'attend)

1. **Mini-jeux des scènes à deux** (leviers, pose longue, barrière et lanterne): les rôles reçoivent chacun leur moitié de l'information et doivent se parler, mais aucun geste n'est demandé (pas de choix ni de saisie dans une scène).
2. **Voyage par un effet**: la scène `en-voiture` finit au noir puis revient à Aubrune, faute de Hautefonte et d'un effet `travel_to`.
3. **Objets d'histoire** sans place dans le sac (règlement, bras du signal, registre, verre, lanterne, cartes de ligne, lettres): ce sont des faits. Les cartes de ligne devront devenir un vrai titre de transport.
4. **Amitié gagnée par un service**: aucun effet ne donne de points d'amitié; les services ouvrent donc les confidences par des faits.
5. **Réveil à 5 h 12** et « le lendemain »: comme à l'acte 1, les nuits passent par la jauge de sommeil; les trains arrivent « le lendemain matin » par une étape de sommeil.
6. **Paiement dans un dialogue** (pas d'effet qui retire de l'argent): Mado se paie en matériaux.
7. **Rassemblement d'habitants**: la Veillée ne réunit que Firmin, Odette et Jeanne (les autres sont trop loin pour une marche de scène); il faut un événement « veillée » qui amène les vingt sur le quai.
8. **Carnet des secrets**: les faits `aubrune.secret.*` attendent un onglet.

## 9. Défauts vus en jouant l'histoire par la simulation

1. **Un habitant dont le planning change pendant qu'on lui parle ne part pas**: il prend l'activité nouvelle sur place (`habitants/index.ts`: en conversation, le trajet est tenu pour fini). J'ai contourné: Achille part quand le joueur atteint le saule, Jeanne quand il atteint la grille. Paulin reste au gué jusqu'au soir après avoir reçu ses pierres (acceptable). À corriger dans le moteur.
2. **Verrous contournables sur la carte** (mesuré avec `zoneViews`): V2 ouvert seul donne 97 % de la zone « v » et 76 % de « r » (V2b et V11 ne barrent rien); V5 et V6 ouverts donnent 99 % de la zone « t » sans V8. L'ordre de l'histoire tient par les étapes, mais les obstacles ne ferment pas ce qu'ils annoncent: les talus de la tranchée et les bords du tunnel ne sont pas des murs.
3. Les suites principales sont trois fiches (`kind: main`): le carnet affichera trois suites, pas une suite en trois actes.

## 10. Choix laissés au client (par le manager)

1. **« Vingt âmes » au lieu de « douze foyers »**. Le cahier parle de douze foyers atteints à l'acte 3; or le bourg en compte déjà treize à la fin de l'acte 2. « Vingt âmes » tombe juste (10 au bourg, vous deux, 3 puis 5 arrivants) et rejoint les 20 habitants annoncés. Recommandation: garder vingt.
2. **Le premier train arrive « le lendemain », pas « le samedi »**. Attendre un vrai samedi peut coûter jusqu'à six journées de jeu sans histoire. Recommandation: train d'essai le lendemain de la dernière condition; le train régulier du samedi commence ensuite.
3. **La confidence d'Honorine s'obtient par un service** (l'œuf, puis le repas), et non par 2 puis 4 cœurs comme l'écrivait le cahier: l'histoire ne se bloque jamais sur un compteur. Les cœurs ouvrent les secrets facultatifs. Recommandation: garder.
4. **Firmin connaissait la cave** et a tenu le registre six semaines après le départ de son oncle. C'est un ajout au cahier, qui explique pourquoi il vous occupe ailleurs. Recommandation: garder, c'est le moment le plus tendre du personnage.
5. **La dalle des Lacombe au cimetière** (acte 3): une scène de trois pages, sans aucun mort montré, où il « manque un nom ». Recommandation: garder; à retirer si le client la trouve trop grave, l'histoire tient sans elle.
6. **Le départ se fait quand on veut** après la Veillée (quai, à deux, 5 h 12): on peut finir les suites secondaires avant. Recommandation: oui, et le train ramène à Aubrune à volonté ensuite.
7. **Un sac de toile à l'acte 2, le sac à dos à la fin de l'acte 3**, offerts (Rosalie, Solange). Recommandation: oui, le sac marque chaque fin d'acte.

## 11. Contrôles

`tests/actes-2-3-aubrune.test.ts` (3 s): toutes les pages d'Aubrune à 150 caractères au plus et sans tiret long; chaque étape a son repère; l'acte 2 puis l'acte 3 joués de bout en bout par la simulation (dialogues, remises d'objets, scènes à rôles, déclencheurs de 5 h 12, arrivées et départs par le train, cadeaux aux deux joueurs, zones ouvertes, souvenirs). Le validateur (suites sans blocage, références, plannings, accords) passe au chargement.
