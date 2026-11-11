# Écriture jouable: les six suites secondaires d'Aubrune

Auteur: game-designer, 2026-11-11. Suite de `ecriture-actes-2-3.md`. Source: cahier des charges, section 6.4, et `carte-aubrune/plan.md` (les lieux sont nommés par leurs identifiants de `plan.json`). Tout est en fiches de données, aucune ligne de moteur; contrôle: `tests/suites-secondaires-aubrune.test.ts`.

## En bref

- Six suites (`kind: side`), 66 étapes, 376 répliques (240 de dialogue, 136 de scène), 43 réponses au choix, 83 dialogues, 17 scènes dont 14 à deux rôles (12 avec des gestes à faire ensemble). Environ 6 heures de jeu en plus de l'histoire principale.
- Chacune s'ouvre à une étape précise de l'histoire principale et ne lui demande rien: aucune étape principale ne cite une suite, et leurs dialogues passent toujours après ceux de l'histoire (priorité sous 60).
- Chaque suite a au moins une scène où les deux écrans ne montrent pas la même chose et où il faut se parler, et des étapes en parallèle à se partager.
- Règle de ton tenue: tout mystère a son explication raisonnable, dite par un habitant.

| Suite | Fichier | S'ouvre quand | Étapes | Répliques | Durée visée |
|---|---|---|---|---|---|
| La Baronne | `la-baronne` | l'acte 2 est fini (Colette est au café, les cannes sont en main) | 7 | 45 | 40 min |
| Les lettres en retard | `les-lettres-en-retard` | acte 3, étape `registre` (Firmin a avoué la cave) | 15 | 98 | 1 h |
| La guerre de la soupe | `la-guerre-de-la-soupe` | acte 3, étape `repas` (le pot-au-feu cuisiné au café) | 13 | 64 | 1 h 15 |
| Le fantôme du moulin | `le-fantome-du-moulin` | acte 3, étape `registre-plein` (la brioche dessinée par Barnabé) | 11 | 56 | 1 h 05 |
| La robe et la cloche | `la-robe-et-la-cloche` | acte 3, étape `marthe-sonne` (la grande cloche sonne juste) | 10 | 63 | 55 min |
| La fanfare de la halte | `la-fanfare-de-la-halte` | acte 3, étape `matin` (la première Veillée) | 10 | 50 | 1 h |

Conventions: chaque étape écrit `aubrune.<suite>.<étape>` (« ouvert », puis « fait »). Dialogues d'étape en priorité 55; demande d'objets en 52 et son merci (`<dialogue>-merci`, joué dès qu'on tient les objets) en 57: une demande en attente ne cache jamais l'étape d'une autre suite chez le même habitant. Cadeau par joueur en 58, une fois par joueur. Souvenirs en 30.

## 1. La Baronne (Achille, Colette, Jeanne)

Trois générations de boulangers ont raté la même perche. Achille dort toujours avant la touche. On apprend son heure par Jeanne, son appât par Colette, et on la sort à deux: elle porte à la lèvre l'alliance de la grand-mère d'Achille.

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| legende | fournil (`gr4`) | dialogue `achille-baronne` | |
| heure, appat (en parallèle) | `pl` ou `pn-s`; café (`gr6`) | dialogues `jeanne-baronne`, `colette-baronne` | une personne par témoin |
| goujons | `ponton`, puis Achille | remettre 2 goujons | pêche |
| affut | fosse du bief (`i2`), **à deux**, de 19 h à 21 h | scène `la-baronne-mord` | scène à gestes |
| decision | Achille | dialogue `achille-decision`: relâcher, offrir au café, ou « on en parle d'abord » | décision |
| epilogue | café | dialogue `colette-epilogue` (une fin par décision) | |

- **Ce que fait chaque joueur**: à la canne, on sent où elle tire sans rien voir et l'on tient la touche 3 s; à l'épuisette, on voit l'ombre sans rien sentir et l'on plonge au bon moment. Il faut se dire « à gauche », « maintenant ».
- **Récompense**: une canne fine par joueur (`achille-canne-fine`), amitié d'Achille (+50), de Colette et de Jeanne; fait `aubrune.baronne.sort` (`relachee` ou `friture`: la photo ou l'arête au mur du café).
- **Explication raisonnable** (Colette): c'est la petite-fille de la perche de 1934, et l'anneau traînait au fond.

## 2. Les lettres en retard (Lucie, Firmin, Basile, Marthe)

Un sac postal dort à la consigne de la halte depuis la nuit de la fermeture: six plis écrits par le bourg, jamais partis. On les rend à qui les a écrits. Le sixième est adressé « aux deux nouveaux gardes de la halte ».

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| consigne | Lucie (`pl`, `gr5`) | dialogue `lucie-consigne` | |
| franc | `fouille-talus` ou `fouille-ballast`, puis Firmin | remettre 1 vieille pièce (le « franc de garde ») | fouilles |
| sac | devant la porte de la halte (`gr2`), **à deux** | scène `le-sac-postal` (Firmin a roulé le casier sur le seuil) | scène à gestes |
| basile, puis odette | atelier, épicerie | dialogues `basile-lettre`, `odette-lettre` | une demande en mariage de quatre pages, jamais reçue |
| marthe, interets, recu | parvis, `gr8`, ronces de la tranchée | dialogue, 4 mûres remises à Honorine, dialogue | cueillette; la dette de 4,20 € |
| colette, oeufs | café, poulailler | dialogue, 2 œufs remis | poules; la recette d'une mère |
| firmin | quai | dialogue `firmin-mutation` | |
| achille | fournil | dialogue `achille-noel` | |
| sixieme, mains-propres | Lucie, **à deux** | dialogue, puis scène `la-sixieme-lettre` | |
| remise | remise de la draisine (`n2`), **à deux** | scène `la-draisine` | scène à gestes |

- **Ce que fait chaque joueur**: au casier, l'un lit les expéditeurs; au registre, l'autre lit les destinataires: on recolle les deux colonnes à voix haute, puis on tire le sac ensemble. Les cinq lettres se distribuent en parallèle (cinq fils à se partager). À la fin, l'un tient la clé, l'autre le mot « Merci d'avance. É. L. », et l'on pompe la draisine à quatre bras.
- **Récompense**: 12 € par joueur, le cahier de recettes de Colette (`livre-de-cuisine`: tarte aux pommes, pommes sautées), une part de tarte par joueur, amitié de Lucie, Firmin, Basile, Marthe; faits `aubrune.draisine.cle` et `aubrune.draisine.sortie`.
- **Explication raisonnable** (Lucie): Émile attendait des remplaçants en 1987 et a écrit d'avance.

## 3. La guerre de la soupe (Odette, Colette, Honorine)

Odette, vexée par le pot-au-feu cuisiné au café, défie Colette. Chaque joueur devient les bras d'une marmite. La nuit, quelqu'un sale les deux soupes: c'est Honorine, qui veut voir les deux cuisinières refaire la soupe de leurs mères, à quatre mains.

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| vexee, defi | épicerie, café | dialogues `odette-vexee`, `colette-defi` | |
| radis, truite (en parallèle) | potager; coin de pêche de l'aval | 4 radis à Odette; 1 truite à Colette | potager, pêche: une marmite par joueur |
| nuit | maison | une nuit de sommeil | |
| sel-odette, sel-colette | épicerie, café | deux dialogues | |
| guet | tonnelle d'Odette (`pl-o`) et terrasse du café (`gr6`), dès 22 h 30 | scène `la-main-dans-le-sel` | guet de nuit, à 60 m l'un de l'autre |
| aveu | `gr8` | dialogue `honorine-sel` | le cahier des mères |
| legumes | ferme (`fc`) | dialogue `margot-legumes` (un panier par joueur) | trajet |
| soupe-colette, soupe-odette | cuisinière de la maison, puis café et épicerie | une soupe de légumes à chacune | cuisine |
| concours | place (`pl`), **à deux**, de 11 h à 15 h | scène `la-soupe-a-quatre-mains` | scène à gestes |

- **Ce que fait chaque joueur**: la nuit, celui du café voit l'ombre saler sans voir son visage et doit prévenir l'autre, qui la démasque sous la tonnelle. Au concours, chaque joueur reçoit la confidence d'une cuisinière sur la soupe de l'autre, et l'on verse les deux louches en même temps.
- **Récompense**: 2 soupes de légumes et 8 € par joueur, amitié d'Odette, de Colette (+40) et d'Honorine; fait `aubrune.decor.concours-de-soupe`.

## 4. Le fantôme du moulin (Berthe, Barnabé, Léon, Jeanne)

Onze kilos de farine disparus, des pas blancs dans la cour, un géant pâle juré par les enfants. Deux nuits de guet: c'est Barnabé, qui pétrit des brioches en cachette parce qu'« un bûcheron, ça ne fait pas de la brioche ». Il entre chez Achille par la porte de devant.

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| farine | cour du moulin (`mc`) | dialogue `berthe-fantome` | |
| leon, jeanne (en parallèle) | `fs3` ou `pl`; `pl` ou `pn-s` | deux dialogues | une personne par témoin |
| mures | ronces, puis Léon | 4 mûres remises (le tarif des témoins) | cueillette |
| premier-guet | cour du moulin (`mc`), **à deux**, de 23 h à 2 h | scène `le-geant-pale` | guet de nuit, gestes |
| piste | du portail à la forge (`gr6`) | y arriver; scène `les-pas-blancs` | trajet de 218 m |
| mado | forge | dialogue `mado-pas-blancs` | |
| second-guet | `mc`, puis le portillon de la berge (`me`), **à deux** | scène `la-main-dans-la-pate` | guet de nuit, gestes |
| parrain | fournil | dialogue `achille-apprenti` | |
| tablier | `gr3` (Barnabé y fait les cent pas) | dialogue `barnabe-tablier`; scène `la-tete-haute` | |
| brioche | moulin | dialogue `berthe-brioche` | |

- **Ce que fait chaque joueur**: première nuit, l'un surveille la porte, l'autre la cour, et l'on retient son souffle ensemble; seconde nuit, l'un pousse la porte pendant que l'autre barre le portillon de la berge.
- **Récompense**: 2 farines et un pain par joueur, amitié de Berthe (+60) et de Barnabé; Barnabé pétrit au fournil de 5 h à 8 h (fait `aubrune.fantome.apprenti`).
- **Explication raisonnable** (Berthe): « La nuit, tout le monde a l'air d'un drap. »

## 5. La robe et la cloche (Marthe, Honorine, Mado; Jeanne et Léon)

La petite cloche fêlée sonne seule certaines nuits. Les deux sœurs, brouillées depuis quarante ans pour une robe de noces, s'accusent. Ce sont Jeanne et Léon qui tirent une ficelle pour les faire sortir en même temps; la robe dort dans le clocher, cachée par leur mère « jusqu'au jour où vous viendrez la chercher ensemble ».

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| felee, honorine, version | parvis (`pv`), `gr8`, parvis | trois dialogues | |
| guet | parvis, **à deux**, de 22 h à 1 h | scène `la-felee-sonne` | guet de nuit |
| clocher | parvis (`pv`), **à deux** | scène `la-robe-dans-le-clocher` (la montée est racontée) | gestes |
| jeanne | Jeanne | dialogue `jeanne-ficelle` | |
| mot-marthe, mot-honorine (en parallèle) | parvis, `gr8` | deux dialogues | une sœur par joueur |
| bois | lisière ou coupe, puis forge | 4 bûches remises à Mado | hache |
| coulee | forge (`gr6`), **à deux**, en journée | scène `la-coulee` | scène à gestes |

- **Ce que fait chaque joueur**: au guet, l'un regarde le clocher (deux petites ombres), l'autre la rue (deux chandelles): on compare. Au clocher, on lève le coffre à deux. À la coulée, celui du soufflet voit la couleur du bronze et dit « maintenant », celui de la louche verse sans rien voir.
- **Récompense**: une coquille fossile par joueur (Jeanne paie son pari), amitié de Marthe et d'Honorine (+50), de Mado, de Jeanne et de Léon; faits `aubrune.cloche.refondue` et `aubrune.robe.ensemble`.

## 6. La fanfare de la halte (Armand, Solange, Barnabé)

Un train qui arrive mérite une fanfare. On retrouve trois instruments (un bugle au grenier, une grosse caisse devenue bac à charbon, un trombone au fond du bief), on répète, et le jour du concert le chef a disparu: il a le trac, il dirige les grenouilles du lavoir. Il dirigera de dos, face au train.

| Étape | Lieu | Ce qui la franchit | Activité |
|---|---|---|---|
| idee | école (`gr5`) | dialogue `armand-fanfare` | |
| bugle | Barnabé | dialogue `barnabe-bugle` | |
| caisse | grève (`bg`), puis forge | 3 pierres remises à Mado | ramassage |
| trombone | fosse du bief (`i2`), **à deux**, de jour | scène `le-trombone-du-bief` | scène à gestes |
| boutons | fouilles, puis mercerie | 2 vieilles pièces remises à Solange | fouilles |
| repetition | devant l'école, **à deux**, de 8 h à 17 h | scène `la-repetition-de-la-fanfare` | gestes en mesure |
| nuit | maison | une nuit de sommeil | |
| trac | mercerie | dialogue `solange-chef-disparu` | |
| lavoir | `lv` | y arriver; scène `le-chef-des-grenouilles` | |
| concert | quai, **à deux**, en journée | scène `le-concert-du-quai` | gestes en mesure |

- **Ce que fait chaque joueur**: triangle et cymbales. À la répétition, un seul des deux voit la baguette et compte tout haut pour l'autre; au concert, c'est l'inverse. Les deux appuis doivent tomber ensemble, à une demi-seconde près.
- **Récompense**: 10 € par joueur (la quête dans la casquette de Firmin), amitié d'Armand (+50), de Solange et de Barnabé; fait `aubrune.fanfare.fondee`.

## 7. Ce que les suites changent chez les habitants

Lignes de planning ajoutées (conditionnées par un fait d'étape, en tête de fiche): Achille à la fosse le soir de l'affût; Honorine sur la place la nuit du sel, puis au bord de la place (`gr1`) pour le concours; Colette sur la place pour le concours; Barnabé au portillon de la berge les nuits de guet, devant le fournil le jour du tablier, à l'école pour la répétition, près du quai pour le concert, et au fournil de 5 h à 8 h une fois apprenti; Armand au lavoir le jour du trac, sur le quai pour le concert; Solange près du quai pour le concert.

Faits à lire par le rendu, le son et le level design: `aubrune.draisine.sortie`, `aubrune.baronne.sort`, `aubrune.decor.concours-de-soupe`, `aubrune.fantome.apprenti`, `aubrune.fanfare.fondee`, `aubrune.cloche.refondue`.

## 8. Ce que le moteur ne permet pas encore (le texte l'attend)

1. **Décision à deux**: pas de vote des deux joueurs. La décision de la Baronne est un choix de dialogue pris par un seul joueur (avec une option « on en parle d'abord »).
2. **La draisine**: aucun véhicule. La suite s'arrête à la scène où on la sort; la course et le raccourci (poste, halte, tunnel) attendent une brique « véhicule sur rail à deux ».
3. **Récompenses du cahier sans effet pour les donner**: recette (friture, brioche, les six soupes), plan (pétrin, vraie cuisine), entrée de collection (cartes postales, musiques), pièce de tenue (tenues anciennes), instrument jouable, fête (automne, été). Remplacées par de l'argent, des objets existants et de l'amitié.
4. **Objets d'histoire sans modèle**: plis, clé, alliance, instruments, robe, brioche sont des faits. À créer si l'on veut les tenir: une brioche, une friture, la Baronne (prise unique de la fosse).
5. **Pêche scénarisée**: la Baronne ne passe pas par le mini-jeu de pêche (pas de prise unique conditionnée ni d'appât); sa touche est une scène à gestes.
6. **Points d'intérieur et postes du plan dans l'histoire**: `tests/grands-lieux.test.ts` et `tests/lieux-verrous.test.ts` chargent les quêtes sur la carte brute du plan, sans intérieurs ni postes ajoutés à l'assemblage. Une fiche qui cite `halte-p-guichet`, `clocher-vue`, `guet-moulin`, `peche-fosse`, `siege-tonnelle` ou `mado-enclume` les fait échouer. Les suites ne citent donc que des nœuds du plan: le sac postal s'ouvre sur le seuil de la halte, la montée au clocher est racontée depuis le parvis (comme la trappe de l'acte 3). Quand ces deux essais chargeront la carte assemblée, six `reach` suffisent à rentrer les scènes dans leurs pièces. De même, aucun planning ne mène un habitant dans un intérieur: la nuit, Odette, Marthe et Berthe sont debout à leur poste pendant que le texte les dit couchées.
7. **Rassemblement**: au concours et au concert, seuls les habitants de la suite viennent (même manque que pour la Veillée).
8. **« Le lendemain »**: les étapes `nuit` passent par la jauge de sommeil (même fragilité que l'histoire principale).

## 9. Ce que la carte doit porter

| Besoin | Où | Pour |
|---|---|---|
| pommiers (aucun arbre fruitier à Aubrune) | verger (`pommes-verger`) | la tarte du cahier de Colette |
| carottes, poireaux, pommes de terre à cultiver ou à acheter | ferme (`legumes-ferme`), cour de Margot | la soupe (aujourd'hui: Margot donne un panier, autant de fois qu'il faut) |
| une draisine dans sa remise | `n2` | la fin des lettres |
| la Fêlée et un coffre de sacristie dans la chambre des cloches; un casier de consigne cadenassé | `eglise-clocher`, `halte` | la robe, les lettres |
| deux marmites, sous la tonnelle et à la terrasse du café | `pl-o`, `gr6` | le guet du sel |

## 10. Choix laissés au client (par le manager)

1. **Les lettres ne sont jamais parties** (le cahier ne tranchait pas): ce sont les habitants qui ont écrit, la nuit de la fermeture, et on leur rend leur propre lettre. Recommandation: garder, chaque lettre devient une scène avec quelqu'un qu'on connaît.
2. **La demande en mariage est de Basile à Odette**, et elle finit sur « dimanche, tourte pour deux ». Recommandation: garder; c'est le moment le plus tendre des six suites.
3. **La Baronne a deux fins** (relâchée ou en friture), même récompense. Recommandation: garder les deux, sans bonne réponse.
4. **La robe a été cachée par la mère des deux sœurs**, et Honorine se remariait en 1977 (ajouts au cahier). Recommandation: garder, cela innocente les deux sœurs d'un coup.
5. **La fanfare se joue sans Martial Roques**, qui n'arrive qu'après la fin. Recommandation: lui écrire une réplique d'arrivée où il réclame la grosse caisse.
6. **Les ouvertures sont étalées** (une à la fin de l'acte 2, cinq au fil de l'acte 3) pour qu'on n'en reçoive jamais six d'un coup. Recommandation: garder.

## 11. Contrôles

`tests/suites-secondaires-aubrune.test.ts` (6 s, 9 essais): pages à 150 caractères au plus et sans tiret long, un repère par étape; chaque suite attend son étape de l'histoire et ses dialogues passent après ceux de l'histoire; les six suites jouées de bout en bout par la simulation (dialogues, objets remis, scènes à deux rôles avec leurs gestes, guets de nuit à l'heure, plannings, récompenses, cadeaux aux deux joueurs), et les deux fins de la Baronne. La règle d'accès (`tests/points-de-quete.test.ts`) couvre les points cités (seuil de la halte, remise, cour du moulin, portillon de la berge, parvis, lavoir).
