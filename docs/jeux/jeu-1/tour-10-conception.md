# La Petite Ligne, tour 10: un bourg plus grand, des besoins doux, une maison qui grandit (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | conception, à produire au tour 10 |
| Version du document | 1 |
| Date | 2026-11-01 |
| Rédaction | game-designer, sur brief du manager (retours de la soirée de jeu du 1er novembre) |
| Point de départ | branche `claude/stoic-lamport-lueey2` à `77c2f3c` (tour 9 livré) |
| Sources | `retours/2026-11-01/retours.md` (R15 à R19, R23 à R25, D1, D3); `plan-100-heures.md` (arcs, R1 à R16, D1 à D9); `tour-09-conception.md` (chantiers, catalogue, cadeaux, file de la maisonnette); `cahier-des-charges.md` (PE-03 à PE-08, MA-01 à MA-08, 6.1, 6.3, 6.7); `carte-halte.md`; `games/la-petite-ligne/ETAT.md`; `donnees/` (reglages, objets, habitants, quetes, courrier); `assets/modeles/README.md` et `assets-src/modeles/bourg.py` (fenêtres de la maisonnette) |
| Simulation | `simulations/tour10_maison.py` (bibliothèque standard, 60 s; `--rapide`: 9 s). Il réutilise `tour9_automne.py` (commande générée, annonces, catalogue et chantiers du tour 9). Les tables 3.3, 4.2 et 5.2 sont relues par le script (partie 0): un écart entre ce document et le script fait échouer le contrôle |
| Hors de ce document | R01 à R14 et R20 à R22 (bloquants, gestes, ressenti, incohérences de la carte): traités ailleurs. La durée de la journée (D1, R14): un autre membre la double et ajoute un réglage; la section 0 dit ce que ce document en suppose |

## En bref

**Pitch.** La Halte s'ouvre sur la rue Haute, où l'on achète le pain chaud d'Achille et où Solange vous coupe les cheveux; à la maison, on a faim, on fait la sieste, on se retrouve, et l'on bâtit à deux un cellier puis une chambre.

**Fantasme.** « Il est 6 h, je fonce au fournil avant que le pain refroidisse; toi, tu ranges le cellier qu'on a fini hier. À midi, on déjeune sur le banc du gué: j'avais un petit creux, toi aussi. Cet après-midi, chez Solange, tu m'as proposé la queue de cheval. Ce soir, rideaux tirés dans la chambre neuve. »

| # | Livraison | En une phrase | Section |
|---|---|---|---|
| 1 | La rue Haute (étape 1 du monde plus grand) | la carte passe de 64 à 100 m de large: le ru de la Côte et ses trois ponts, la rue Haute, le fournil, la mercerie-coiffure, la maison où loge Jeanne, l'école; quatre étapes suivantes chiffrées | 1.1 à 1.3 |
| 2 | Deux habitants | Achille Pradel, boulanger qui cuit la nuit et pêche le lundi; Solange Mérigot, coiffeuse et mercière, ancienne coiffeuse de théâtre, qui garde Jeanne; fiches, emplois du temps, histoires en cinq étapes, 50 répliques | 1.4, 1.5 |
| 3 | Deux intérieurs visitables | l'épicerie-pension d'Odette (boutique, petite table du poêle, chocolat chaud) et la mercerie-coiffure (fauteuil, miroir, banc d'attente, tissus); règle commune des intérieurs | 1.6 |
| 4 | Coiffures | 12 coupes nouvelles pour l'artiste 3D (15 en tout), 8 couleurs; à la création, au salon (y compris en cours de partie), et l'autre peut proposer une coupe depuis le banc | 2 |
| 5 | Besoins doux | trois besoins visibles en petites icônes (Ventre, Repos, Cœur), qui ne donnent que des bonus; repas de midi et souper, sieste, retrouvailles, sommeil de la chambre | 3 |
| 6 | La maison qui grandit (D3) | deux pièces à bâtir à deux, dans l'ordre que choisit le duo: le cellier (appentis ouest), puis la chambre (aile nord); Basile fournit la charpente | 4 |
| 7 | Le rangement à cases | 20 cases au coffre, puis grand coffre (32), étagères (6) et étagères hautes du cellier (12); outils au râtelier; rien ne se perd | 5 |
| 8 | Fenêtres et rideaux | les rideaux ne se posent plus qu'aux fenêtres (cinq dans la maisonnette, deux dans la chambre); on les ouvre et on les ferme | 6 |

Chiffres clés (annexe A): un duo médian qui donne la priorité à la maison finit le cellier au jour 25 et la chambre au jour 53 (toutes les parties avant le jour 64), et achète 90 % de tout ce qui est en vente avant le jour 64; un duo tranquille finit la chambre dans 86 % des parties. Un duo qui finance d'abord le bourg n'a pas la chambre avant le jour 64: le choix est réel. Une journée bien nourrie (pain chaud, déjeuner à deux, souper complet) garde le Ventre plein 98 % du jour et donne une forme de 70 à 83; une journée sans repas ne descend jamais sous les valeurs de nuit actuelles (Ventre 30 au coucher). Le coffre seul déborde dès l'été (21 sortes à ranger pour 20 cases): le grand coffre ou le cellier deviennent un vrai but, jamais une impasse.

## 0. La journée doublée (D1) et ce que ce document en suppose

Le client a tranché D1 le 2026-11-01: des journées plus longues. Un autre membre double la durée de la journée (0,35 s par minute de jeu devient 0,7 s) et ajoute un réglage de rythme. Ce document ne touche pas à l'horloge; il est écrit pour tenir à toute vitesse entre 0,5 et 1,0 s par minute de jeu.

| Point | Règle de ce document | Effet de la journée doublée (0,7 s) |
|---|---|---|
| Horaires (fournil, salon, habitants) | en heures de jeu | le pain chaud (6 h à 9 h) dure 2,1 min réelles au lieu de 1,05: on a le temps d'y monter (24 s de marche) |
| Besoins | baisses et gains par heure de jeu, jamais par seconde | aucun réglage à changer; la sieste dure au plus 42 s réelles, et elle file quatre fois plus vite si les deux la font |
| Distances | la rue Haute est à 24 à 27 s de la maisonnette (partie 5) | 34 à 39 minutes de jeu: un détour d'une demi-heure, juste pour une course qui ne se fait pas tous les jours |
| Économie | revenus par semaine de jeu inchangés (le potager, les poules, les arbres et la cueillette ne poussent pas plus vite), testés aussi à revenus x 1,25 (on pêche et on scie davantage dans une journée plus longue) | à x 1,25, la chambre arrive au jour 46 au lieu de 53; aucun réglage de prix ne casse (annexe A) |
| Heures de jeu | | les jours 1 à 64 passent de 10,5 h à 16,1 h; 100 h font 397 journées au lieu de 372 (plan, section 2) |
| À remesurer après la livraison de D1 | la paie des commandes et la bourse des robots (tour 9, 2.1) ont été mesurées à 0,35 s: refaire la mesure à la nouvelle vitesse avant tout réglage de prix | |

## 1. Un monde plus grand (R23, R24, R25)

### 1.1 Le constat

- La carte fait 64 x 48 m: depuis la maisonnette, tout est à moins de 16 s. C'était voulu pour une démo à horloge rapide; avec des journées deux fois plus longues, la marche ne mange plus la journée, et le duo a fait le tour en une soirée.
- Quatre habitants (Firmin, Odette, Basile, Jeanne). Lucie, la factrice, est en tournée et n'écrit que des cartes.
- Aucun intérieur hors de la maisonnette: on achète chez Odette à travers son comptoir sur la place.
- Jeanne part chaque soir « hors de la carte » par la promenade de l'est, et l'école est dite « au haut du bourg » (tour 9, 3.3) sans exister: le monde promet déjà un quartier qu'on ne voit pas. On le bâtit.

### 1.2 Les étapes

Chaque étape s'appuie sur ce qui existe et ajoute un lieu où l'on va vraiment, des habitants qui y vivent et au moins un intérieur. La première tient dans ce tour.

| Étape | Quand | Lieux | Habitants | Intérieurs | Ce qu'on y fait | Pourquoi le chemin y mène |
|---|---|---|---|---|---|---|
| **1. La rue Haute** | tour 10 (ce document) | le ru de la Côte et ses trois ponts, la rue Haute, le fournil, la mercerie-coiffure, la maison de Lucie (où loge Jeanne), l'école-mairie (façade et cour) | Achille Pradel, Solange Mérigot | épicerie-pension d'Odette, mercerie-coiffure | pain chaud et brioche, coupes et couleurs, rideaux de couleur, chocolat chaud, deux histoires qui commencent | la rue qui longe la halte continue vers l'est: c'est la route des hameaux, et l'école est au bout |
| 2. Les intérieurs du bourg | tour suivant ou celui d'après | la cour de l'école, la salle d'attente de la halte | Armand Castagné, instituteur et secrétaire de mairie | la halte (salle d'attente, guichet, bureau de Firmin et sa pendule), le fournil, l'école (salle de classe, archives de la mairie) | la pendule de Firmin (étape 2 de son histoire), le four d'Achille à réparer à deux, les archives où dort un plan de la ligne d'Émile | ce sont les bâtiments qu'on longe tous les jours: on y entre enfin |
| 3. L'amont de l'Aubrune | après l'hiver de l'année 1 | le chemin du moulin (rive nord, vers l'ouest depuis le gué), le moulin de la Vanne, son bief et sa vanne | Berthe Lavergne, meunière | le moulin, la scierie de Basile | lever la vanne à deux (geste nouveau), moudre: Achille cuit avec la farine de la vallée; pêche de l'amont | la farine d'Achille vient par le train; le moulin à l'arrêt est la raison du détour |
| 4. Le bois de la Côte | été de l'année 2 | le chemin forestier derrière la scierie, la clairière, la cabane d'observation de Jeanne, le belvédère | le garde forestier (visiteur régulier) | la cabane | oiseaux (jumelles), cueillette de sous-bois, coupe raisonnée | Basile y tire ses grumes; Jeanne y cherche son martin-pêcheur |
| 5. La voie des Vergers | arc A3 du plan | la voie, puis le hameau | les cinq habitants des Vergers (cahier 6.3) | chèvrerie, gare des Vergers | arc A3 du plan, inchangé | la ligne |

Le monde passe de 64 x 48 m à 100 x 48 m à l'étape 1 (+ 56 %), puis gagne une zone à chaque étape (étapes 3 et 4 à l'ouest et au nord, l'étape 5 par la draisine). Habitants de la Halte: 4 aujourd'hui, 6 à l'étape 1, 7 à l'étape 2 (8 avec Lucie quand J1 sera tranché), 9 avec Berthe.

### 1.3 La rue Haute (étape 1)

Places indicatives, à caler par le level designer (`construire_carte_halte.py`, `valider_carte.py`). La carte s'étend vers l'est de x 64 à x 99; le bord infranchissable de l'est passe de x 62-63 à x 98-99.

| Lieu | Où (indicatif) | Pourquoi là |
|---|---|---|
| Le ru de la Côte | x 63 à 64, du bois (y 2) à l'Aubrune (y 37); 1 à 1,5 m de large, eau vive peu profonde | il descend du coteau (la Côte, au nord) vers l'Aubrune; il borne naturellement le bourg ancien et la rue Haute. Il coule vers le sud, puis se jette dans l'Aubrune qui coule vers l'est |
| Le ponceau de la voie | sous la voie (y 12 à 14), voûte de pierre | la voie existait avant la rue Haute: elle passe le ru sur une voûte, sans rien changer à la voie |
| Le pont de la rue | dans le prolongement des pavés de la rue de la halte (y 21 et 22), pont de pierre à parapets bas | la rue pavée qui longe la halte (y 21 et 22) ne s'arrêtait au bord de la carte que parce que la carte s'arrêtait: elle continue vers les hameaux |
| La passerelle de la promenade | la promenade de la berge (y 34 et 35), planches sur deux poutres, garde-corps d'un côté | la promenade de Jeanne existe déjà jusqu'au bord est: elle traverse le ru à pied, sans charrette, donc une passerelle légère |
| La rue Haute | pavés x 76 et 77, de la promenade (y 34) au portail de l'école (y 20), croisant la rue de la halte en y 21 et 22 | elle monte de la rivière vers le pied du coteau, d'où son nom: le haut du bourg est au pied de la Côte |
| Le fournil d'Achille | x 65 à 71, y 15 à 20, entre la rue et la voie; porte et guichet au sud, sur la rue (68, 20); cheminée de four à l'arrière | le plus près possible de la halte et du quai: les sacs de farine arrivent par le train du samedi et se portent jusqu'à l'arrière du fournil sans traverser le bourg; le four et sa fumée à l'arrière, côté voie, loin des maisons |
| La mercerie-coiffure de Solange | x 68 à 74, y 24 à 30, à l'angle des deux rues; vitrine et porte à l'est, sur la rue Haute (74, 27); un niveau | à l'angle, c'est la boutique qu'on voit en arrivant de la halte; une vitrine sur la rue montante, là où l'on passe |
| La maison de Lucie | x 79 à 84, y 25 à 30, en face de la mercerie; porte à l'ouest (79, 27); un seul niveau, jardinet à l'est | Jeanne y loge pendant la tournée de sa tante; Solange la garde de l'autre côté de la rue: deux portes face à face, et la petite traverse seule |
| L'école-mairie | x 74 à 84, y 15 à 19, au bout nord de la rue Haute; portail dans l'axe de la rue (77, 19); cour murée côté voie, un tilleul dans la cour | c'est « le haut » de la rue; la cour est derrière un mur, on entend les enfants des hameaux à la récréation sans les voir (ils arrivent par la route de l'est) |
| La route des hameaux | prolonge la rue de la halte vers l'est (y 21 et 22) jusqu'au bord; sortie `village_exit` déplacée en (97,5 ; 21,5) | là où partent les habitants qui sortent de la carte, et d'où arrivent les élèves |
| Le reste | prés en pente douce vers la rivière (x 85 à 97, y 24 à 36), un verger de trois pommiers derrière la maison de Lucie, deux bancs (rue Haute devant la mercerie, berge à l'est de la passerelle) | rien de fixe au sud-est: on garde la place des étapes suivantes et la vue sur la rivière |

Règles de placement à vérifier par le level designer:

- **Caméra.** Ce qui est haut au nord et à l'ouest de ce qui compte (règle de la carte de la démo). Le fournil est contre la voie, au nord de la rue; la mercerie et la maison de Lucie, au sud de la rue de la halte, restent à un niveau, faîtage à 5 m au plus, pour ne pas cacher la rue en orientation 0. Lignes de vue par `moments_tour7_geometrie.py`: la porte de chaque lieu visible au zoom 1 dans au moins trois orientations sur quatre.
- **Chemins.** Chaque chemin relie deux lieux où l'on va: la rue Haute relie la promenade, la rue de la halte et l'école; aucune impasse. La route des hameaux sort de la carte: c'est la seule.
- **Passages.** Le pont de la rue fait 3 m de large (deux personnages et une charrette); la passerelle 1,6 m (on y croise un habitant). Le ru se franchit aussi au gué de pierres plates en (63 ; 30) que Jeanne prend en sautant: les joueurs aussi peuvent le prendre (raccourci vers la mercerie).
- **Budgets.** Le rendu tient les budgets du PC de référence avec la carte entière (G4); s'il faut couper, la rue Haute se dessine en mode léger au-delà de 40 m du joueur (question technique pour l'architecte, section 11).

Schéma indicatif (nord en haut, x de 60 à 99, y de 10 à 37):

```text
     6         7         8         9
     0123456789012345678901234567890123456789
 10  :::rr:::::::::::::::::::::::::::::::::XX
 12  ===VV===================================
 14  ===VV===================================
 15  H..rrFFFFFFF..EEEEEEEEEEE.............XX
 17  H..rrFFFFFFF..E         E.............XX
 19  H..rrFFFFFFF..EEEDEEEEEEE.............XX
 20  H..rrFFFDFFF....++....................XX
 21  +++PP+++++++++++++++++++++++++++++++++++
 22  +++PP+++++++++++++++++++++++++++++++++++
 24  ...rr...MMMMMMM.++....................XX
 27  ...rr...MMMMMMD.++.D    L.p.p.........XX
 30  ...gg...MMMMMMM.++.LLLLLL..p..........XX
 32  ...rr...........++....................XX
 34  :::YY:::::::::::++::::::::::::::::::::XX
 35  :::YY:::::::::::::::::::::::::::::::::XX
 37  bbbrrbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
```

`r` ru, `V` ponceau, `P` pont de la rue, `Y` passerelle, `F` fournil (porte `D`), `M` mercerie-coiffure, `L` maison de Lucie, `E` école-mairie et sa cour, `p` pommiers, `H` halte (existante), `+` pavés, `:` chemin, `b` berge.

### 1.4 Deux habitants

**Achille Pradel, boulanger.** Lent, ensommeillé, poète de la pâte. Il cuit la nuit dans le four de son grand-père, vend le pain chaud au guichet le matin, descend la panière chez Odette, dort l'après-midi et pêche au gué le soir. Le lundi, le fournil est fermé: il pêche toute la matinée au ponton. Il adore la truite grillée et le cidre; il aime les noisettes, les œufs et le miel.

**Solange Mérigot, coiffeuse et mercière.** Vive, observatrice, mots d'esprit, une pointe de mélancolie. Elle a coiffé pendant vingt ans au théâtre de la ville, perruques comprises, puis elle est revenue au pays tenir la mercerie de sa mère. Elle garde Jeanne pendant la longue tournée de Lucie, son amie d'enfance: deux tresses le matin, la sortie de la place le soir. Elle adore les fleurs de saison et les rubans; elle aime le thé, les plumes de geai et le miel.

Emplois du temps (heures de jeu; `habitants.json`, règles habituelles, premières entrées prioritaires):

| Habitant | Quand | Où, quoi |
|---|---|---|
| Achille | mardi à dimanche, 6 h à 9 h | guichet du fournil (`bakery_window`), il vend |
| Achille | mardi à dimanche, 9 h à 9 h 30 | descend la panière: du fournil à la porte d'Odette (`grocery_door`), par la rue de la halte et la place |
| Achille | mardi à dimanche, 9 h 30 à 12 h | dans le fournil, il pétrit pour le lendemain; on lui parle au guichet (`bakery_window`) |
| Achille | 12 h à 13 h | banc de la rue Haute (`upper_street_bench`), il déjeune |
| Achille | 13 h à 17 h | il dort (`absent` dans le fournil, volets fermés) |
| Achille | 17 h 30 à 19 h, sans pluie | il pêche au gué (`fishing_ford_north`) |
| Achille | 17 h 30 à 19 h, pluie | sous l'auvent du fournil (`bakery_window`) |
| Achille | 19 h à 6 h | chez lui (`absent`); fenêtre du fournil allumée de 3 h à 6 h |
| Achille | lundi, 8 h à 12 h | il pêche au ponton (`fishing_pontoon`); pluie: chez lui |
| Achille | lundi, 12 h à 14 h | tonnelle d'Odette (`grocery_terrace`) |
| Achille | samedi, 10 h à 11 h | au quai (`train_stop`): il reçoit les sacs de farine du train |
| Solange | mardi à samedi, 9 h à 12 h et 14 h à 18 h | au salon (`salon_counter`, ou au fauteuil quand un joueur s'y assoit) |
| Solange | mardi à samedi, 12 h à 14 h | chez elle, derrière la boutique (`absent`) |
| Solange | samedi, 10 h à 10 h 45 | au quai: les colis de tissu arrivent par le train (le salon ouvre à 10 h 45 ce jour-là) |
| Solange | tous les jours, 18 h à 18 h 30 | elle descend chercher Jeanne sur la place (`village_square`), puis remonte avec elle |
| Solange | dimanche, 10 h à 12 h | promenade de la berge avec Jeanne (`riverbank`) |
| Solange | dimanche, 14 h à 16 h | chez Odette, pour sa mise en plis (dans l'épicerie, `grocery_table`) |
| Solange | lundi, 10 h à 16 h | elle coud à la fenêtre de la mercerie (`salon_window`, visible de la rue) |
| Solange | 19 h à 9 h | chez elle (`absent`) |

**Jeanne** change de fin de journée: au lieu de sortir par `village_exit`, elle rentre avec Solange à la maison de Lucie (`lucie_house_door`) à 18 h 30. Les jours d'école d'automne, elle monte à l'école (`school_gate`) à 8 h 15 et y entre (`absent`); elle redescend à 16 h 30 sur la place. La règle du tour 9 (3.3) ne change pas autrement.

Histoires en cinq étapes (HA-02; seule l'étape 1 est produite à ce tour, les autres fixent la suite):

| Étape | Achille | Solange |
|---|---|---|
| 1 (tour 10) | La panière: la roue de sa carriole a lâché, on descend le pain à deux chez Odette (`achille_basket`) | La première coupe: elle se présente en coupant les cheveux du duo (`solange_first_cut`) |
| 2 | La fêlure du four: briques réfractaires par le train, réparer la voûte à deux (l'un tient le cintre, l'autre maçonne) | Le fauteuil qui penche: Basile et le duo le remettent d'aplomb; elle raconte le théâtre |
| 3 (scène à deux) | La fournée de nuit: un caillou à la fenêtre à 4 h, on pétrit à deux pour la fête | Les perruques: elle ouvre la malle du théâtre; chacun choisit une perruque pour l'autre |
| 4 | La farine de la vallée: le moulin de la Vanne remis en route (étape 3 du monde) | La robe de Jeanne pour la fête, cousue avec vos tissus |
| 5 (scène à deux) | L'apprenti: Jeanne veut apprendre; il lui confie le levain | Le rideau de scène de la Veillée des contes, à l'école, cousu à trois |

### 1.5 Ce qu'ils changent au quotidien

| Avec | Ce qui change | Valeur |
|---|---|---|
| Achille | on achète du pain: au guichet, pain 5 sous, toute la matinée (sauf quand il est sorti: la panière de 9 h à 9 h 30, la farine du train le samedi de 10 h à 11 h); de 6 h à 9 h il sort du four (pain chaud, Ventre +20 au lieu de +15); le dimanche, brioche (12 sous, Ventre +25) | 4 pains et 2 brioches au plus par joueur et par jour (`bakery.dailyCapPerPlayer`); le pain chaud devient du pain ordinaire à 12 h |
| Achille | il passe chaque matin de la rue Haute à la place avec sa panière: on le croise | 9 h à 9 h 30 |
| Solange | coupes et couleurs au salon (section 2), rideaux de six couleurs à la mercerie (section 6) | 15, 10 et 30 sous |
| Solange | Jeanne a une famille de quartier: elle part le soir avec quelqu'un | 18 h 30 |
| Les deux | deux souhaits de cadeaux au rayon « Pour offrir » (règle du tour 9, 2.7) | table ci-dessous |

| Habitant | Souhait, à partir de | Article (`id`) | Prix | Ce qui change ensuite |
|---|---|---|---|---|
| Achille | jour 10 et la panière faite | sablier (`hourglass`) | 40 | le sablier sur le rebord du guichet; sa réplique « La pâte n'attend plus » |
| Solange | jour 12 et la première coupe faite | peigne de corne (`horn_comb`) | 50 | le peigne sur la tablette du miroir (P1: dans ses cheveux) |

### 1.6 Les intérieurs

**Règle commune.**

| Règle | Valeur | Raison |
|---|---|---|
| Entrer | on passe la porte en marchant (comme la maisonnette); la porte s'ouvre devant le personnage | aucun écran de chargement, l'autre joueur voit où l'on va |
| Ce qu'on voit | chez le joueur qui est dedans, le toit, l'étage et les deux murs côté caméra s'effacent (règle de la maisonnette, `cut_walls`); chez l'autre, le bâtiment reste entier | chacun voit ce qui le concerne; recommandation de technique: l'intérieur est sur la carte, à sa place, pas une scène à part (question pour l'architecte, section 11) |
| Heures | chaque intérieur a ses heures; hors des heures, la porte est fermée et le dit (texte ci-dessous); un joueur dedans à la fermeture peut rester, l'habitant le dit et le comptoir ferme | jamais coincé dedans ni chassé |
| Porter à deux | on ne passe pas une porte en portant à deux (« On ne passe pas la porte à deux avec ça. ») | une porte fait 0,9 m |
| Météo | dedans, ni pluie ni vent; les sons du dehors étouffés (filtre de l'audio) | on vient s'y abriter |
| Minuit, absence, pause | règles habituelles (TE-08, PA-04) | rien de neuf |

**L'épicerie-pension d'Odette** (bâtiment existant, 8 x 10, façade à l'est). Ouverte de 7 h à 19 h, tous les jours.

| Pièce | Ce qu'il y a | Ce qu'on y fait |
|---|---|---|
| La boutique (moitié sud, x 24 à 29, y 27 à 31) | le comptoir intérieur (le même que le guichet sur la place, vu de dedans), rayonnages, bocaux, sacs de graines, panière à pain d'Achille, poêle de fonte, une petite table et deux chaises près du poêle (`grocery_table`) | acheter et vendre (panneau actuel, depuis dedans comme depuis la place); s'asseoir à la petite table; chocolat chaud (ci-dessous); manger ensemble à la table (compte comme « manger ensemble ») |
| La salle à manger de la pension (moitié nord, y 24 à 26) | tables sous des draps, porte entrouverte | regarder (« Examiner »): « La salle à manger dort sous ses draps depuis que les voyageurs ne s'arrêtent plus. Un jour, peut-être... » (étape 3 de l'histoire d'Odette, plus tard) |
| L'escalier | vers les chambres de la pension | « Les chambres de la pension sont pour les voyageurs. » |

Chocolat chaud: les jours de pluie, et tout l'automne et l'hiver, de 7 h à 18 h, une tasse par joueur et par jour, 5 sous, bu à la petite table (Ventre +15; Cœur +5 de plus si l'autre en boit un à la table dans la même demi-heure de jeu). Odette le propose dans la conversation: « Un chocolat chaud ? Cinq sous, et la chaise est à côté du poêle. »

**La mercerie-coiffure de Solange** (nouvelle, intérieur 5 x 5). Ouverte du mardi au samedi, de 9 h à 12 h et de 14 h à 18 h (le samedi, dès 10 h 45).

| Coin | Ce qu'il y a | Ce qu'on y fait |
|---|---|---|
| Le fauteuil et le miroir (`salon_chair`) | un fauteuil de coiffure à pied, un grand miroir, une tablette (peigne, ciseaux, flacons) | changer de coiffure et de couleur (section 2); un seul joueur à la fois |
| Le banc d'attente (`salon_bench`) | un banc à deux places, des journaux | s'asseoir (Repos, section 3); proposer une coupe à l'autre pendant qu'il est au fauteuil |
| Le comptoir de mercerie (`salon_counter`) | rouleaux de tissu, rubans, bobines, la vitrine | acheter des rideaux de couleur (section 6); parler à Solange |

Textes des portes fermées (`textes.messages`): `door_closed_grocery` « Odette a fermé. Elle rouvre à 7 h. »; `door_closed_salon` « Le salon est fermé. Solange ouvre du mardi au samedi, de 9 h à 12 h et de 14 h à 18 h. »; `bakery_closed` « Le guichet est fermé. Pain chaud du mardi au dimanche, de 6 h à 9 h; du pain jusqu'à midi. »; `bakery_asleep` « Volets clos: Achille dort. Il pêche au gué vers 17 h 30. »; `bakery_away` « Achille est sorti: la panière chez Odette à 9 h, la farine du train le samedi à 10 h. Il revient vite. »; `closing_inside` « Odette range: le comptoir est fermé, mais prends ton temps. »; `no_door_carry` « On ne passe pas la porte à deux avec ça. »

**Ordre des intérieurs suivants** (étape 2, puis 3): la halte (on y attend le train à l'abri, le guichet, le bureau de Firmin et sa pendule arrêtée), le fournil (le four, le pétrin, la fournée de nuit), l'école (salle de classe, archives: un plan de la ligne annoté par Émile; la Veillée des contes en hiver), la scierie de Basile (atelier, commandes à l'abri), le moulin. Les maisons des habitants ne se visitent que sur invitation, dans une scène de leur histoire.

### 1.7 Quêtes nouvelles

| Id | Type | Titre | Départ | Étapes | Récompense | Forme (R13) |
|---|---|---|---|---|---|---|
| `achille_basket` | secondaire | La panière d'Achille | jour 4 (mardi), 6 h; dans une partie plus avancée, première aube jouée avec cette version qui n'est pas un lundi | 1. monter au fournil avant 11 h; 2. porter la panière à deux jusqu'à la porte d'Odette | 2 pains chauds par joueur; le guichet du fournil vend (drapeau `bakery_open`); le lendemain, notification `achille_cart` | porter à deux |
| `solange_first_cut` | secondaire | Une coupe chez Solange | lettre `solange_note`, au plus tôt le jour 5 et le lendemain de la panière, un jour d'ouverture du salon | 1. entrer chez Solange; 2. chacun passe au fauteuil (la première coupe est offerte; « Garder ma coiffure » compte); 3. scène à deux devant le miroir | le salon et la mercerie ouvrent (drapeau `salon_open`); Cœur +10 chacun | se coordonner à deux, choisir |
| `gift_achille` | coup de main | Un cadeau pour Achille | sablier acheté (règle du tour 9, 2.7) | offrir le sablier | remerciement, sablier au guichet | apporter |
| `gift_solange` | coup de main | Un cadeau pour Solange | peigne acheté | offrir le peigne | remerciement, peigne sur la tablette | apporter |
| `rooms_cellar`, `rooms_bedroom` | principale | Un cellier pour la maisonnette; Une chambre côté bois | commande à Basile (section 4) | 4.3 | la pièce | bâtir à deux |

Cas limites: si personne ne monte au fournil avant 11 h, Achille descend seul (« Bon. Je l'ai descendue seul, à petits pas. Demain, si vous passez, je ne dirai pas non. ») et la quête reste ouverte les jours suivants, jamais le lundi; un seul joueur au fournil ne peut pas porter la panière seul (règle du porter à deux, sans échec). La lettre de Solange n'arrive jamais un dimanche ni un lundi (salon fermé): elle attend le mardi. La scène du miroir attend que les deux soient passés au fauteuil et soient au salon.

Une nouveauté par journée (R1): jour 4 la panière, jour 5 la lettre de Solange, jour 10 et après le souhait d'Achille, jour 12 et après celui de Solange, jour 23 les plans de Basile (section 4). Dans une partie reprise plus loin, les mêmes départs s'échelonnent d'un jour chacun à partir de la première aube jouée avec cette version.

### 1.8 Textes

**Achille, `achille_basket`.**

- Notification de l'aube (`achille_late`): « Pas d'odeur de pain sur la place ce matin. Odette guette la rue Haute. »
- Objectif 1: « Monter au fournil, rue Haute, avant 11 h. »
- Achille: « Ah, vous voilà. La roue de ma carriole a lâché dans la nuit, et la panière pèse plus lourd que moi. Vous m'aidez à la descendre chez Odette ? À deux, ça se porte. »
- Objectif 2: « Porter la panière à deux jusqu'à la porte d'Odette. »
- Odette: « Enfin ! Le bourg allait déjeuner de biscottes. Merci à vous deux. »
- Achille: « Tenez, deux pains chauds chacun. Et désormais, montez les chercher au fournil: de 6 h à 9 h, ils sortent du four. »
- Notification du lendemain (`achille_cart`): « Basile a remis une roue à la carriole d'Achille. »

**Solange, `solange_first_cut`.**

- Lettre `solange_note`, titre « Un mot de la mercerie »: « Passez au salon, rue Haute, à l'angle. La première coupe est pour moi: c'est comme ça qu'on se présente, chez nous. Jeanne m'a tout dit de vous, je veux vérifier. Solange Mérigot (qui garde Jeanne pendant la tournée de Lucie). »
- Solange, à l'entrée: « Asseyez-vous chacun votre tour. Le banc est fait pour attendre, et pour donner son avis. »
- Scène à deux du miroir: « Maintenant, regardez-vous. Non, pas dans le miroir: l'un l'autre. » Choix de chacun: « Ça te va bien. » / « Je te reconnais à peine. » / « Tu me plais toujours autant. » Réponse si les deux choisissent la même: « Vous dites pareil. Ça, c'est un bon signe. » Sinon: « Deux avis, deux sourires. Je prends les deux. » Fin: « Revenez quand vous voulez. Les cheveux repoussent, les idées aussi. »

**Souhaits et remerciements.** Achille (réplique de souhait, priorité 3, une fois par joueur): « Je m'endors sur la pâte, l'après-midi. Il me faudrait un sablier, un vrai, qui sonne presque. » Remerciement: « Un sablier ! Je le retournerai à chaque fournée, et je penserai à vous à chaque grain. » Solange: « Mon peigne de corne s'est cassé en deux. Le théâtre me l'avait offert. Il en existe encore, paraît-il, au catalogue. » Remerciement: « Oh. Il est plus beau que l'ancien. Ne le répétez pas au théâtre. » Objets: sablier « Une heure de sable fin. Pour qui s'endort sur sa pâte. »; peigne « Un peigne de corne blonde, aux dents fines. Il ne casse pas les cheveux. »

**Répliques du quotidien d'Achille (25, priorité 1, tirage « la moins récente »).** Toute saison: « Je me lève à trois heures. À cette heure-là, la Halte appartient au four et aux chouettes. » / « La pâte, ça ne se presse pas. Moi non plus, d'ailleurs. » / « Le lundi, je ne cuis pas: je pêche. Le goujon ne demande pas de levain. » / « Si vous sentez le pain chaud depuis le quai, c'est que le vent vient de l'est. » / « Odette dit que je dors debout. C'est faux: je dors assis, sur le sac de farine. » / « Une miche bien cuite chante quand on tape dessous. Écoutez... Vous entendez ? » / « Mon grand-père a bâti ce four. Il tient encore, à quelques fissures près. Comme moi. » / « La farine arrive par le train du samedi. Le reste de la semaine, je compte les sacs. » / « Un bon pain, c'est de la farine, de l'eau, du sel et du temps. Le temps, c'est le plus cher. » / « Après midi, ne frappez pas au fournil: je dors. Le soir, je suis au gué, avec ma canne. » Printemps: « Au printemps, la pâte lève plus vite. Tout le monde se réveille, même elle. » / « Les pissenlits du talus, je les mange avec un croûton. Ne le dites pas à Odette, elle me les vendrait. » / « Les jours rallongent: je fais ma fournée à la lanterne et je la sors au soleil. » / « Au printemps, je fais un pain aux herbes. L'ail des ours, ça réveille. » Été: « L'été, le fournil est un four lui-même. Je travaille en tricot de corps et je ne regrette rien. » / « Il fait si chaud que la pâte lève toute seule. Je n'ai plus qu'à la regarder. » / « Les soirs d'été, le gué est plein de truites qui se moquent de moi. » / « En été, je cuis plus tôt encore, pour finir avant que le soleil cogne. » Automne: « Les noisettes de la Côte, dans une miche, c'est un pain de fête. Vous en avez, des noisettes ? » / « L'automne, c'est la saison du pain de seigle. Il dure une semaine, comme les bonnes nouvelles. » / « Le matin, la brume sent le levain. Ou c'est moi. » / « Jeanne passe au guichet avant l'école. Elle prend un quignon et elle file. » Pluie: « Il pleut ? Tant mieux. Le four garde sa chaleur, et moi j'ai une excuse pour rester près de lui. » / « La pluie ramollit les croûtes. Mangez vite, ou mangez à l'abri. » / « Les jours de pluie, je ne pêche pas: je regarde la rivière par la fenêtre et je compte les ronds. »

**Répliques du quotidien de Solange (25).** Toute saison: « On connaît les gens à leurs cheveux. Les vôtres disent: grand air et travail du matin. » / « Jeanne loge chez sa tante, mais c'est moi qui lui fais ses nattes. Lucie ne sait faire que les nœuds de colis. » / « Au théâtre de la ville, j'ai coiffé des reines, des sorcières et un cheval. Ici, c'est plus calme. » / « Une coupe, c'est un petit voyage. On s'assoit, on ferme les yeux, et on revient un peu quelqu'un d'autre. » / « Le lundi, je couds. Le dimanche, je promène Jeanne. Le reste du temps, je coupe. » / « Mes ciseaux viennent de la ville. Mes peignes aussi. Moi, je viens d'à côté. » / « Les rideaux de la mercerie sont teints dans la vallée. Le bleu, c'est de la guède; le jaune, je ne dis pas. » / « Odette vient le dimanche pour sa mise en plis. Elle parle tant que je coupe en mesure. » / « Sur le banc, on a le droit de donner son avis. Le dernier mot reste au fauteuil. » / « Un miroir ne ment pas, mais il ne dit pas tout. Pour le reste, il y a les amis. » Printemps: « Au printemps, tout le monde veut du court. Puis l'été arrive, et tout le monde regrette. » / « J'ai mis des rubans verts en vitrine. Le printemps aime qu'on le remarque. » / « Jeanne veut une coupe "comme un oiseau". Je cherche encore lequel. » / « Le vent du printemps décoiffe tout le monde. C'est bon pour mes affaires. » Été: « L'été, je laisse la porte ouverte. Les mouches entrent, les nouvelles aussi. » / « Avec cette chaleur, une nuque dégagée, c'est un cadeau qu'on se fait. » / « Le soir, je m'assois sur le pas de la porte et je regarde la rue Haute s'endormir. » / « Les chapeaux de paille me font de la concurrence. Je ne leur en veux pas. » Automne: « L'automne, c'est la saison des couleurs. Les arbres en changent, pourquoi pas vous ? » / « Jeanne a repris l'école. Le matin, je lui fais deux tresses serrées: elles tiennent jusqu'à la récréation. » / « Les feuilles mortes se glissent sous la porte. Je les garde dans un vase. C'est gratuit, c'est beau. » / « J'ai reçu du velours par le train. Pour des rideaux d'hiver, il n'y a pas mieux. » Pluie: « La pluie, c'est l'ennemie des mises en plis. Et la meilleure amie des parapluies. » / « Entrez vous sécher. Le fauteuil est libre, et la théière est chaude. » / « Quand il pleut, la rue Haute devient un ruisseau. Le ru de la Côte n'aime pas être seul. »

Réserve: 10 générales, 4 par saison, 3 de pluie par habitant. Un habitant arrivé au jour 4 est entendu environ 10 fois par saison par un joueur assidu (une conversation tous les deux jours): avec le tirage « la moins récente », 14 phrases possibles par saison suffisent à ne rien redire à moins de 28 jours sur les jours 4 à 64. Les réserves complètes de R3 (8 par niveau de lien, 10 par saison) s'écrivent avec les étapes 2 et 3 de leurs histoires.

**Trois répliques de plus pour Jeanne** (toute saison sauf la troisième, automne): « Solange me fait des tresses si serrées que je pense plus vite. » / « Le soir, Solange vient me chercher sur la place. Elle dit que l'heure, c'est l'heure. » / « Chez Achille, le pain sort du four quand je pars à l'école. Je prends le quignon du bout. »

**Envies nouvelles (8, dont 3 à deux et 3 qui touchent l'autre, R16).**

| `id` | Sorte | Texte | Réalisée quand |
|---|---|---|---|
| `warm_bread_run` | personnelle | Prendre un pain chaud au fournil avant 9 h. | `bought` `warm_bread` avant 9 h |
| `new_haircut` | personnelle | Changer de tête chez Solange. | coupe ou couleur changée au salon |
| `propose_cut` | personnelle (touche l'autre) | Proposer une coupe à {partner}. | proposition envoyée depuis le banc |
| `bread_for_partner` | personnelle (touche l'autre) | Offrir un pain chaud à {partner}. | `gave` `warm_bread` à l'autre |
| `nap_after_lunch` | personnelle | Faire une petite sieste après le déjeuner. | sieste commencée entre 12 h et 16 h |
| `chocolate_together` | à deux | Boire un chocolat chaud chez Odette, ensemble. | les deux en boivent à la petite table dans la même demi-heure |
| `lunch_on_bench` | à deux | Déjeuner ensemble sur un banc. | les deux mangent assis sur le même banc entre 11 h 30 et 14 h |
| `curtains_morning` | personnelle (touche l'autre) | Ouvrir les rideaux pendant que {partner} dort encore. | rideaux ouverts pendant que l'autre est au lit, au matin |

## 2. Coiffures (R16)

### 2.1 La liste pour l'artiste 3D

Toutes les coupes sont pour tous les personnages (aucun choix de genre, cahier PE-01). Nom affiché sans genre. Pièces du squelette commun (`player_hair_<id>` dans `personnages.glb`), même matériau que le reste du personnage, couleur portée par le matériau (section 2.2). Style de la bible: low poly arrondi, lobes facettés.

| `id` du maillage | Nom affiché | Description | Où on la choisit | Triangles au plus |
|---|---|---|---|---|
| `player_hair_short` | Court | existante | création, salon | 316 (existant) |
| `player_hair_bob` | Carré | existante | création, salon | 352 (existant) |
| `player_hair_bun` | Chignon | existante | création, salon | 380 (existant) |
| `player_hair_crop` | Ras | presque au crâne, un centimètre de volume, ligne de nuque nette | création, salon | 220 |
| `player_hair_curls` | Boucles courtes | petites boucles en boules facettées sur le dessus et les côtés, nuque dégagée | création, salon | 420 |
| `player_hair_ponytail` | Queue de cheval | cheveux tirés en arrière, queue attachée haut qui tombe à la nuque, au-dessus du foulard | création, salon | 380 |
| `player_hair_braid` | Tresse | une tresse dans le dos, jusqu'aux omoplates, en cinq lobes, ruban au bout | création, salon | 420 |
| `player_hair_pigtails` | Deux tresses | deux tresses courtes de part et d'autre, qui tombent devant les épaules | création, salon | 440 |
| `player_hair_wavy` | Mi-long ondulé | aux épaules, ondulé, raie sur le côté | création, salon | 420 |
| `player_hair_long` | Long lâché | jusqu'au milieu du dos, trois pans de mèches | création, salon | 440 |
| `player_hair_fringe` | Frange droite | frange droite sur les sourcils, nuque courte | création, salon | 360 |
| `player_hair_quiff` | Houppe | côtés courts, houppe relevée sur le devant | création, salon | 340 |
| `player_hair_cloud` | Nuage de boucles | grosse masse ronde de boucles, un tiers plus large que la tête | salon (coupe de Solange) | 500 |
| `player_hair_crown` | Tresse couronne | une tresse qui fait le tour de la tête, au-dessus des oreilles | salon (coupe de Solange) | 460 |
| `player_hair_bob_long` | Carré plongeant | carré plus long devant que derrière, pointes au menton | salon (coupe de Solange) | 380 |

Contraintes à vérifier de près, pour chaque coupe:

- Rien ne traverse le foulard agrandi, le col de la tenue, ni le dos quand on porte la poutre à l'épaule (porter à deux), la panière, ou un outil (houe, hache, canne au lancer).
- Poses à contrôler: repos, marche, porter, couper, pêcher (`fish_cast`, `fish_wait`, `fish_strike`), assis (chaise, banc, `sit_ground`), couché (lit: les cheveux ne passent pas dans l'oreiller ni sous le matelas), assis au fauteuil du salon.
- Portrait: la coupe se lit dans le cadre du portrait du HUD (cinq expressions) à 1366 x 768 et à 150 %; une coupe longue ne déborde pas du cadre.
- Les coupes longues sont rigides, liées à l'os de la tête (et du cou pour la tresse et la queue de cheval); un balancement secondaire est P1.
- Budget: un joueur complet passe de 2 006 à 2 190 triangles au plus (Nuage de boucles); à vérifier contre le budget du PC de référence avec deux joueurs et six habitants à l'écran.

### 2.2 Les couleurs

Huit couleurs, choisies à la création et au salon (`hairColor`, 0 à 7): noir, brun, châtain, auburn, roux, blond paille, gris, blanc. Valeurs exactes: directeur artistique, dans la palette de la bible, lisibles sur les quatre palettes de saison et la nuit.

### 2.3 Où et comment on choisit

| Lieu | Ce qu'on choisit | Prix | Règle |
|---|---|---|---|
| Création du personnage | 12 coupes (les trois existantes et les neuf nouvelles), 8 couleurs | | aperçu actuel de la création |
| Salon de Solange (en cours de partie) | 15 coupes et 8 couleurs | coupe 15 sous, couleur 10, les deux 20; la première visite est offerte (`solange_first_cut`) | on s'assoit au fauteuil; panneau du salon (aperçu de son personnage en gros plan, tourner avec A et E); valider paie et applique; « Garder ma coiffure » ne coûte rien |
| Le banc d'attente | une proposition pour l'autre | | qui attend sur le banc pendant que l'autre est au fauteuil peut proposer une coupe et une couleur; elle s'affiche dans l'aperçu de l'autre (« {partner} te propose: {cut} »), qui l'essaie ou non; l'autre décide toujours |
| Miroir mural à la maison (P1) | se recoiffer parmi les coupes et couleurs déjà portées | gratuit | pour changer d'avis sans monter au salon |

Coupe remarquée: la première fois que l'autre joueur passe à moins de 4 m après un changement (hors menus), son écran affiche « {name} a changé de coiffure. », son personnage a une petite réaction (tête penchée), et les deux gagnent Cœur +10 (une fois par changement). Le changement se voit tout de suite chez les deux: rien n'est caché, c'est le moment de se regarder qui compte.

Répliques de Solange à la fin d'une coupe (tirage « la moins récente »): « Voilà. Le miroir est d'accord avec moi. » / « Tournez la tête. Encore. C'est parfait. » / « Ça vous change, et ça vous ressemble. » / « Je n'ai coupé que le nécessaire. Le reste, c'est vous. »

Textes de l'interface (`ui.salon`): « Le fauteuil de Solange », « Coupe », « Couleur », « Garder ma coiffure », « Coupe: {price} sous », « Couleur: {price} sous », « Les deux: {price} sous », « Première coupe offerte », « Proposer à {partner} », « {partner} te propose: {cut} », « Essayer », « Non merci ». Notification `hair_noticed`: « {name} a changé de coiffure. »

Plus tard (R1 et R9): une coupe de saison inventée par Solange à chaque saison (quatre par année, une nouveauté à la première saison qui suit sa scène 3), et les barbes et moustaches si le client les veut (question 2).

## 3. Besoins doux (R15)

### 3.1 Le principe

Le jeu a déjà trois besoins cachés (Ventre, Sommeil, Cœur, PE-03), calculés la nuit pour donner la forme du matin. Le client ne les a pas sentis: ils ne bougent pas pendant la journée et ne se voient pas. La version douce les rend vivants et visibles, sans jamais punir:

- **Trois petites icônes à côté du portrait**: Ventre (un bol), Repos (une bougie: c'est l'endurance actuelle, renommée à l'écran), Cœur (un cœur). Trois états chacune, pas de chiffre. La carte de l'autre joueur montre les mêmes icônes en petit: on voit quand l'autre a faim.
- **Un besoin satisfait donne un bonus; un besoin bas ne retire rien.** Le seul effet d'un besoin bas est l'absence de bonus, une expression du portrait et une ligne discrète, une fois. La règle actuelle de l'endurance à zéro (« tout prend deux fois plus de temps », PE-06) reste la seule contrainte, et l'on récupère maintenant en s'asseyant.
- **La forme du matin garde sa formule** (PE-04): 0,35 Ventre + 0,35 Sommeil + 0,30 Cœur, mesurés au coucher. Les valeurs de nuit restent celles d'aujourd'hui ou mieux: une journée sans repas donne Ventre 30 au coucher, comme la règle « aucun souper » actuelle.

### 3.2 Ce que ça apporte au jeu à deux

| Moment | Ce qui se passe à deux |
|---|---|
| Midi | un petit creux chez les deux vers 12 h: on se donne rendez-vous pour déjeuner sur un banc (envie `lunch_on_bench`), au lieu de travailler chacun dans son coin jusqu'au soir |
| Les en-cas | on voit l'icône de l'autre: « Tu as faim ? Je t'ai gardé une omelette. » Donner à manger existe déjà (PE-11); c'est maintenant un geste qui compte |
| Le souper | le souper tient la nuit (il compte double): c'est le repas qu'on prépare ensemble à la veillée, avec un bonus de plus s'il est pris ensemble |
| Le partage des tâches | se séparer n'est jamais puni; se retrouver après trois heures loin l'un de l'autre donne Cœur +5 aux deux: on peut partir chacun de son côté, et l'on a une raison de revenir |
| La sieste | à deux, l'horloge file quatre fois plus vite: une pause choisie à deux, jamais subie |
| La nuit | rideaux tirés, chambre neuve, s'endormir à la même heure: le Sommeil et le Cœur montent, la forme du lendemain aussi |
| Niveaux différents | les bonus aident surtout le joueur qui fatigue le plus vite (Ventre plein: endurance x 0,8); deux aides personnelles, invisibles pour l'autre (3.7) |

### 3.3 Le Ventre

| Règle | Valeur | Raison |
|---|---|---|
| Au réveil | 65 | le café et la tartine sont pris au petit-déjeuner; personne ne commence la journée le ventre vide |
| Baisse | 4 par heure de jeu, seulement quand l'horloge tourne et que le personnage est éveillé (rien la nuit, à la veillée, pendant une scène ou une absence) | 65 au réveil, 41 à midi, 13 à 19 h sans rien manger: le petit creux arrive vers 16 h |
| Manger | gain du tableau ci-dessous, Ventre plafonné à 100; on peut toujours manger (une envie peut le demander), au-delà de 100 le gain est perdu: « Plus faim, mais c'était bon. » | jamais de refus qui bloquerait une envie ou une quête |
| Manger ensemble | +10 de plus chacun quand les deux mangent à moins de 3 m l'un de l'autre et à moins de 10 minutes de jeu d'écart | la règle « manger ensemble » de la démo, généralisée |
| Le souper | ce qui est mangé à partir de 18 h compte double (le bonus « ensemble » ne double pas) | « le déjeuner tient la journée, le souper tient la nuit »: une règle qu'on comprend en une soirée |
| Ventre plein | 60 et plus: les actions coûtent 20 % d'endurance de moins | le bonus qu'on sent dans les bras |
| Petit creux | moins de 25: portrait « ventre », ligne `belly_low` une fois par passage sous le seuil, gargouillis discret (une fois par heure de jeu au plus) | un signal, aucune pénalité |
| Au coucher | le Ventre du moment, au moins 30, entre dans la forme | la valeur « aucun souper » actuelle reste le plancher |
| En-cas et endurance | inchangé (`snacks`: pain +10, plat simple +20, mijoté +35 d'endurance) | les deux effets se cumulent: manger, c'est reprendre des forces et caler son ventre |

| Ce qu'on mange | `id` | Ventre | Où on l'obtient |
|---|---|---|---|
| Pain | `bread` | 15 | fournil, 5 sous; cadeaux de la démo |
| Pain chaud | `warm_bread` | 20 | fournil, 6 h à 9 h, 5 sous; devient `bread` à 12 h |
| Radis à la croque-au-sel | `crunchy_radishes` | 20 | réchaud |
| Omelette | `omelette` | 30 | réchaud |
| Soupe de légumes | `vegetable_soup` | 35 | réchaud |
| Gelée de sureau | `elder_jelly` | 20 | annonce de Jeanne (tour 9) |
| Brioche du dimanche | `brioche` | 25 | fournil, le dimanche, 12 sous |
| Chocolat chaud | `hot_chocolate` | 15 | épicerie, bu à la petite table, 5 sous |

Journées types (partie 2, Cœur 60):

| Journée | Ventre au coucher | Part du jour en « Ventre plein » | Part du jour en « Petit creux » | Forme (paillasse, lit, lit et matelas) |
|---|---|---|---|---|
| On oublie de manger | 30 | 10 % | 23 % | 46, 53, 58 |
| Souper simple (une omelette) | 73 | 10 % | 23 % | 61, 68, 73 |
| Souper à deux (une soupe) | 93 | 10 % | 23 % | 68, 75, 80 |
| Déjeuner (pain) et souper à deux | 100 | 10 % | 0 % | 70, 78, 83 |
| Journée soignée (pain chaud, omelette à deux à midi, soupe et omelette à deux le soir) | 100 | 98 % | 0 % | 70, 78, 83 |

Lecture: le souper fait la nuit (et la forme), le déjeuner fait l'après-midi (Ventre plein et petit creux). Comparé à la règle actuelle (plat simple 60, mijoté 80), un souper simple donne un peu plus (73): personne n'y perd.

### 3.4 Le Repos (l'endurance, enfin visible)

| Règle | Valeur | Raison |
|---|---|---|
| Au réveil | l'endurance du jour (80 + 0,4 x forme, PE-05), inchangée | |
| S'asseoir | +1 d'endurance par minute de jeu assis (chaise, banc, fauteuil, caisse, l'herbe avec `sit_ground`), x 1,5 sur un siège de confort 3 ou plus (fauteuil d'osier); jamais au-dessus de l'endurance du réveil | les bancs et le fauteuil servent enfin; dix minutes de jeu (7 s) rendent 10 points, de quoi bêcher dix cases (coût 1 par case) |
| La sieste | au lit entre 12 h et 16 h, une fois par jour: +1,5 par minute de jeu, 60 minutes au plus; le Ventre baisse de moitié pendant la sieste | une pause à soi qui se choisit |
| Pendant la sieste | chez qui dort, l'écran montre une rêverie (le portrait endormi, la lumière de la pièce) et laisse le carnet ouvert: courrier, quêtes, souvenirs, sac; « Se lever » à tout moment (Agir) | aucun temps mort: on lit son courrier pendant que le personnage dort |
| Sieste à deux | les deux en sieste en même temps (chacun dans son lit ou le lit double): l'horloge va 4 fois plus vite jusqu'au réveil du premier; Cœur +5 chacun une fois par jour | une pause décidée ensemble ne coûte que quelques secondes |
| États | « Pleine énergie » (75 % de l'endurance du réveil et plus), « Ça va », « Besoin de souffler » (moins de 25 %), « Plus d'énergie » (0, règle actuelle) | |

Un lit occupé l'après-midi n'est jamais un coucher pour la nuit (TE-07): de 12 h à 16 h, Agir sur le lit propose « Faire la sieste »; hors de cette plage, « Se coucher » comme aujourd'hui.

### 3.5 Le Cœur (et l'envie de compagnie)

| Règle | Valeur | Raison |
|---|---|---|
| Au réveil | 40 + confort de la maison (0 à 20, MA-07) | la règle de nuit actuelle (PE-03), rendue vivante: les gains arrivent dans la journée au lieu d'être comptés la nuit |
| Gains de la journée | ceux de PE-03, au moment où ils arrivent: envie +15, envie à deux +25, geste à deux +10 (une fois par jour), souper partagé +5, conversation +5 (15 au plus), cadeau reçu de l'autre +10; et désormais: à moins de 8 m de l'autre +2 par heure de jeu (12 au plus par jour), retrouvailles +5, coupe remarquée +10, chocolat à deux +5, sieste à deux +5 | une journée à deux ordinaire passe le seuil du « Cœur léger » vers le milieu de l'après-midi |
| Retrouvailles | après au moins 3 heures de jeu de suite à plus de 30 m l'un de l'autre, se retrouver à moins de 3 m: +5 aux deux, une petite salutation (main levée), 2 fois par jour au plus | se séparer pour travailler n'est jamais puni, se retrouver est fêté |
| Envie de compagnie | après 3 heures de jeu loin de l'autre, le portrait prend l'air pensif et l'icône du Cœur s'allume chez l'autre; une fois par jour, la ligne `heart_missing` | un signe doux, jamais un reproche |
| Cœur léger | 70 et plus: marche 10 % plus rapide (pas pendant un porter à deux) | « le pas léger »: un bonus qu'on voit et qu'on sent |
| Au coucher | le Cœur du moment, plafonné à 100, entre dans la forme | |
| Le Cœur ne baisse jamais | aucun gain ne se reprend | jamais punitif |

### 3.6 Le Sommeil

| Règle | Valeur |
|---|---|
| Valeur du lit | inchangée (paillasse 50, lit 70, lit et matelas 85, avec édredon 100) |
| Dormir dans la chambre (section 4) | +5 |
| Rideaux fermés dans la pièce où l'on dort (au moins une fenêtre à rideaux, toutes fermées) | +5 |
| S'endormir ensemble (les deux couchés à moins de 10 minutes de jeu d'écart) | Cœur +5 à chacun, écran de nuit « Vous avez éteint la lampe en même temps. » |
| Retour de minuit | inchangé (Sommeil -30) |
| Plafond | 100 |

### 3.7 Aides personnelles et cas limites

Deux aides de plus dans le carnet (PE-08), invisibles pour l'autre: **Besoins en sourdine** (aucune ligne ni son de besoin; les icônes restent) et **Ventre patient** (le Ventre baisse deux fois moins vite).

| Cas | Règle |
|---|---|
| Un joueur absent (PA-04) | horloge arrêtée: rien ne baisse, aucune retrouvaille ne se compte |
| Scène, veillée, menus des deux | horloge arrêtée: rien ne baisse |
| Manger pendant une scène | impossible (règle actuelle) |
| Retrouvailles quand l'un dort | ne compte pas; elles comptent au réveil si la distance est sous 3 m |
| Retrouvailles en se croisant sans s'arrêter | comptent: passer à moins de 3 m suffit |
| Un joueur dans un intérieur, l'autre dehors | les distances se mesurent sur la carte, comme dehors (les intérieurs sont à leur place) |
| Sieste et fin de la plage | à 16 h, le personnage se réveille seul |
| Sieste à deux et événement daté (train, scène, moment) | le réveil est forcé 10 minutes de jeu avant l'heure d'une scène ou du train, avec la ligne `nap_wakeup` |
| Sauvegarde | Ventre, Cœur, minutes loin de l'autre, retrouvailles et sieste du jour, par personnage |

### 3.8 Textes

`textes.needs`:

| Clé | Texte |
|---|---|
| `belly.full` | Ventre plein |
| `belly.ok` | Ça va |
| `belly.low` | Petit creux |
| `rest.high` | Pleine énergie |
| `rest.ok` | Ça va |
| `rest.low` | Besoin de souffler |
| `rest.empty` | Plus d'énergie |
| `heart.light` | Cœur léger |
| `heart.ok` | Ça va |
| `heart.missing` | Envie de compagnie |
| `messages.belly_low` | Un petit creux. Un en-cas, ou on attend le souper ? |
| `messages.belly_full` | Ventre plein: tout fatigue moins. |
| `messages.belly_capped` | Plus faim, mais c'était bon. |
| `messages.rest_low` | Besoin de souffler: un banc, une chaise, ou même l'herbe. |
| `messages.heart_light` | Cœur léger: tu marches d'un bon pas. |
| `messages.heart_missing` | {partner} te manque un peu. Un détour pour se retrouver ? |
| `messages.reunion` | Retrouvailles ! |
| `messages.nap_start` | Une petite sieste... Le carnet reste ouvert si tu veux lire. |
| `messages.nap_end` | La sieste a fait du bien. |
| `messages.nap_together` | Sieste à deux: le temps file en douceur. |
| `messages.nap_wakeup` | Debout: on vous attend bientôt. |
| `hints.supper_hint` | Le déjeuner tient la journée, le souper tient la nuit. |
| `hints.sit_hint` | Assis, on reprend des forces: {act} près d'un banc. |
| `nightScreen.together` | Vous avez éteint la lampe en même temps. |

Phrases du petit-déjeuner (s'ajoutent au texte de forme, une au plus, la plus utile): « Le souper d'hier soir tient encore au corps. » / « Pas de souper hier: ce soir, on se rattrape ? » / « Les rideaux tirés ont gardé la nuit noire. » / « Tu as dormi dans la chambre neuve: ça se sent. »

## 4. La maison qui grandit (R18, D3)

### 4.1 Le principe

Le client veut des améliorations de maison (D3, 2026-11-01). Ce tour suit la recommandation du plan: des pièces ajoutées d'abord, à des places fixes qui ont une raison, et le plan libre à deux plus tard (jalon J3). On les obtient des trois façons demandées:

- **Achat**: Basile vend le plan et la charpente (les bois longs, les tuiles), payés en sous à son établi.
- **Fabrication**: le duo apporte les planches et les clous (scier à l'établi, acheter des clous chez Odette).
- **Chantier à deux**: le duo bâtit les éléments sur place (maintenir Agir, deux fois plus vite à deux) et porte la panne faîtière à deux; Basile et Firmin posent les tuiles dans la nuit.

Les deux plans s'ouvrent ensemble, au jour 23 (lettre `basile_rooms`, le lendemain de `basile_works` du tour 9); le duo choisit par lequel commencer: c'est une vraie conversation. Une seule pièce en chantier à la fois.

### 4.2 Les deux pièces

| Pièce | `id` | Où | Prix | Planches | Clous | Éléments | Travail à un (s) | Geste à deux | Ce que ça change |
|---|---|---|---|---|---|---|---|---|---|
| Le cellier | `room_cellar` | appentis contre le pignon ouest: emprise x 2 à 4, y 21 à 26; intérieur x 3 et 4, y 22 à 25 (2 x 4); la fenêtre ouest de la pièce devient la porte du cellier; un fenestron au nord | 450 | 16 | 8 | 6 | 48 | aucun | deux places d'étagère haute (12 cases chacune, section 5); le coffre peut y aller; la pièce principale gagne la place de ce qu'on y range |
| La chambre | `room_bedroom` | aile nord: emprise x 5 à 11, y 16 à 21 (le mur nord actuel devient le mur commun); intérieur x 6 à 10, y 17 à 20 (5 x 4); la fenêtre du fond devient la porte de la chambre; deux fenêtres: au nord (vers la voie et la lisière) et à l'est (vers le sentier du jardin) | 1 200 | 30 | 12 | 12 | 96 | porter la panne faîtière (5 m) de `beam_pickup` au faîte | Sommeil +5 quand on y dort; place pour le lit double, une commode et un fauteuil; la pièce principale devient la salle commune |

Pourquoi ces places:

- **Le cellier à l'ouest**: c'est le pignon aveugle du côté opposé au chemin et au passage à niveau; un appentis bas (faîtage à 2,6 m, toit à un pan) n'y cache rien en orientation 0; dans une maison de garde-barrière, la remise à provisions est contre le pignon, côté jardin. Le cellier prend la bande d'herbe du pignon jusqu'au bord de la carte: on contourne la maison par le nord ou par le sud, qui restent libres.
- **La chambre au nord**: la réserve du plan de la maison (`house_plan_reserved`, x 2 à 15, y 15 à 26) est là pour que la maison grandisse vers la voie sans jamais cacher le potager, au sud; l'aile reste à 1 m de la voie (rangée y 15 libre), hors du sentier du jardin (x 13) et du banc du pignon (x 12, tour 9). Une chambre côté voie, pour un garde-barrière, c'est entendre le train du samedi en se réveillant.
- **Les portes percées à la place des fenêtres**: la maçonnerie est déjà ouverte; on ne perce pas un mur plein (cohérence: la fenêtre devient porte, son appui disparaît, le linteau reste).

Fenêtres de la maisonnette avant et après (section 6): pièce principale 5 (deux au sud, une au nord, une à l'ouest, une à l'est); après le cellier, 4 (l'ouest devient porte); après la chambre, 3 dans la pièce et 2 dans la chambre.

### 4.3 Le chantier d'une pièce

1. **Commander.** À l'établi de Basile, panneau « Agrandir la maisonnette »: le plan choisi, son prix, ses matériaux. Payer passe par l'accord de l'autre (100 sous ou plus, EC-04). Refus: « Un chantier à la fois: finissez d'abord {room}. »
2. **La nuit.** Basile prépare la charpente. Au matin, le site paraît: fantômes des éléments, un panneau et une caisse du chantier devant le pignon (cellier) ou au nord (chambre), et pour la chambre la panne faîtière posée à `beam_pickup` (14,5 ; 18,5), là où la poutre du jour 1 attendait déjà. Notification `room_site_ready`.
3. **Apporter.** N'importe qui dépose planches et clous dans la caisse; ce qui est déposé reste à la caisse (rien ne se perd).
4. **Bâtir.** Chaque élément se bâtit en maintenant Agir (format des constructions guidées de la démo: `elements`, `inputs`, `seconds`; `twoPlayersSpeedMultiplier` 2), avec la barre de progression (R10, traitée ailleurs). Ordre libre; les éléments qui portent (poteaux, sablières) avant ceux qu'ils portent: un élément dont le support n'est pas bâti montre « Il faut d'abord {element}. »
5. **Le geste à deux (chambre).** Porter la panne faîtière à deux (geste existant, sans échec) jusqu'à son repère au faîte, puis bâtir le dernier élément.
6. **La nuit suivante.** Basile et Firmin posent les tuiles et percent la porte. Au matin: la pièce est à vous (`room_built`), deux répliques d'habitants, la pièce reconnue (« Le cellier », « La chambre »).

| Élément du cellier (6) | Entrées | Secondes à un | | Élément de la chambre (12) | Entrées | Secondes à un |
|---|---|---|---|---|---|---|
| deux poteaux d'angle | 2 planches, 1 clou chacun | 6 chacun | | quatre poteaux | 2 planches, 1 clou chacun | 6 chacun |
| sablière | 3 planches, 2 clous | 8 | | deux sablières | 3 planches, 1 clou chacune | 8 chacune |
| deux pans de mur | 3 planches, 1 clou chacun | 8 chacun | | quatre pans de mur | 3 planches, 1 clou chacun | 8 chacun |
| toit à un pan | 3 planches, 2 clous | 12 | | la ferme et la panne (après le porter) | 4 planches, 2 clous | 12 |
| | | | | le plancher | 6 planches, 2 clous | 12 |
| **Total** | 16 planches, 8 clous | 48 | | **Total** | 30 planches, 12 clous | 96 |

Cas limites:

- **Meuble sur le seuil**: à la nuit où la porte est percée, un meuble posé sur la case devant la nouvelle porte est déplacé sur la case libre la plus proche de la même pièce, sinon rangé (section 5); ligne du matin « Basile a poussé {item} pour passer. »
- **Objets au sol sur le site**: déplacés devant la porte de la maison au matin du site.
- **Coin à soi** (MA-06): un coin qui chevauchait le seuil reste à son propriétaire, mais la case du seuil ne compte plus dedans.
- **Un seul joueur**: tout se fait seul sauf le porter de la panne; le chantier attend, sans délai.
- **Partie arrêtée en plein chantier**: tout est sauvegardé (éléments bâtis, caisse, panne).
- **Le banc du pignon et l'auvent** (tour 9) restent à leur place: le banc est en x 12, hors de l'aile nord; l'auvent est au sud.

### 4.4 Rythme et coûts

| Valeur | Initiale | Unité | Plage | Raison |
|---|---|---|---|---|
| Ouverture des deux plans | jour 23 | jour | 16 à 29 | lendemain de `basile_works` (une nouveauté par jour); après la démo, quand la bourse dépasse 1 000 sous |
| Prix du cellier | 450 | sous | 350 à 600 | une demi-semaine de commande: on peut l'avoir vite, il soulage le rangement |
| Prix de la chambre | 1 200 | sous | 1 000 à 1 500 | un peu plus d'une semaine de commande: le grand but d'épargne de l'automne |
| Planches, clous | 16 et 8; 30 et 12 | | | une journée et demie de lisière et d'établi pour la chambre; achetées chez Basile, 8 sous la planche (L8) |
| Travail | 48 s et 96 s à un, moitié à deux | secondes réelles | | une à deux minutes à deux: un vrai chantier sans corvée |
| Une pièce à la fois | 1 | | | un but à la fois, et une décision à deux sur l'ordre |

Résultats (partie 3, 2 000 graines, jours 16 à 64, revenus du tour 9):

| Duo | Cellier fini (jour médian) | Chambre finie (jour médian; parties avant le 64) | Part de tout ce qui est en vente achetée au jour 64 (médiane, au plus bas) | Semaines avec un but d'épargne |
|---|---|---|---|---|
| médian, la maison d'abord | 25 | 53; 100 % | 90 %, 86 % | 62 % |
| médian, la maison après le bourg | 39 | jamais avant le 64 | 93 %, 86 % | 87 % |
| tranquille, la maison d'abord | 25 | 53; 86 % | 86 %, 55 % | 69 % |
| glouton, la maison d'abord | 25 | 41; 100 % | 100 % | 50 % |
| médian, revenus x 1,25 (journées plus longues) | 25 | 46; 100 % | 97 %, 90 % | 50 % |

Lecture: un duo qui veut sa chambre l'a avant l'hiver; un duo qui préfère d'abord les bancs, les jardinières et le réverbère du bourg ne l'a qu'après le jour 64. C'est assumé: l'argent sert à choisir. Le prix de la chambre peut bouger de 20 % sans changer ce résultat (jours 46 et 53).

### 4.5 Textes

| Clé | Texte |
|---|---|
| Lettre `basile_rooms`, titre | Deux plans sur l'établi |
| Lettre `basile_rooms`, texte | Votre maisonnette est petite pour deux, ça se voit depuis la voie. J'ai tiré deux plans: un cellier contre le pignon ouest, une chambre derrière, côté bois. Choisissez par lequel commencer. Je fournis la charpente, vous apportez les planches et les bras. B. |
| `ui.basile.rooms` | Agrandir la maisonnette |
| `ui.basile.room` | {room}: {price} sous, {planks} planches, {nails} clous |
| `ui.basile.roomOrder` | Commander la charpente |
| `ui.basile.roomBusy` | Un chantier à la fois: finissez d'abord {room}. |
| `ui.room.title` | Chantier: {room} |
| `ui.room.bring` | Apporter: {planks} planches et {nails} clous |
| `ui.room.progress` | {done} éléments sur {total} |
| `ui.room.support` | Il faut d'abord {element}. |
| `ui.room.beam` | Porter la panne faîtière à deux |
| `messages.room_site_ready` | Basile a préparé la charpente: le chantier de {room} vous attend. |
| `messages.room_built` | Basile et Firmin ont posé les tuiles cette nuit: {room} est à vous. |
| `messages.room_moved_item` | Basile a poussé {item} pour passer. |
| `rooms.cellar` | le cellier |
| `rooms.bedroom` | la chambre |
| `rooms.cellar_named` | Le cellier: du frais, de la place, et deux étagères qui n'attendent que vous. |
| `rooms.bedroom_named` | La chambre: on y dormira mieux, rideaux tirés. |

Répliques (priorité 3, une fois par joueur, le jour où la pièce est bâtie et les deux suivants): Basile « Elle est droite. Je l'ai vérifiée au fil à plomb. Deux fois. » / Firmin « Votre maison s'allonge. Émile disait qu'une maison qui grandit, c'est une maison qui reste. » / Odette « Une chambre ! Vous allez enfin dormir ailleurs qu'à côté du réchaud. » / Jeanne « Le cellier, c'est comme une cachette, mais pour les pommes de terre. » / Solange « Une chambre neuve demande des rideaux neufs. Je dis ça, je ne dis rien. »

### 4.6 Ce qui vient ensuite (arc A2 et jalon J3 du plan)

| Étape | Contenu | Quand |
|---|---|---|
| Le grenier aménagé | une échelle de meunier depuis la salle commune, deux alcôves (un coin à soi chacun) sous le toit | hiver de l'année 1 |
| La cuisine | un fourneau à la place du réchaud (recettes mijotées et desserts, MA-05), une table de cuisine | avec l'étape 2 du monde (le four d'Achille) |
| L'atelier | un établi à la maison (meubles sans aller à la scierie) | printemps de l'année 2 |
| Le plan libre à deux | MA-01 à MA-04 sur toute la réserve de 14 x 12 | jalon J3 du plan |

## 5. Le rangement à cases (R19)

### 5.1 Le principe

Le coffre de la maisonnette n'a pas de limite aujourd'hui. Il devient le premier meuble d'un **rangement de la maison**: chaque meuble de rangement posé dans la maison ajoute ses cases à un seul rangement commun. On ouvre le rangement depuis n'importe lequel de ces meubles. Une case tient une pile de 99 d'un même objet et d'une même qualité (comme le sac, PE-10).

### 5.2 Les meubles et leurs cases

| Meuble de rangement | `id` | Cases | Comment on l'obtient | Où il se pose | Emprise |
|---|---|---|---|---|---|
| Coffre de la maisonnette | `chest` | 20 | au départ (existant) | dans la maison | 1 x 1 |
| Étagère | `shelf` | 6 | établi, 6 planches (existant) | dans la maison, dos au mur | 2 x 1 |
| Grand coffre de chêne | `oak_chest` | 32 | commandé à Basile, 250 sous, livré le lendemain matin à la place du coffre (Basile reprend l'ancien pour la scierie) | dans la maison | 1 x 1, haut comme une commode |
| Étagère haute du cellier | `cellar_rack` | 12 | établi, 8 planches et 4 clous, 12 s | seulement aux deux places du cellier | 1 x 2, du sol au plafond |

Capacité selon l'équipement: coffre 20; grand coffre 32; grand coffre et une étagère 38; grand coffre et cellier avec deux étagères hautes 56; tout (deux étagères en plus) 68.

Remplissage (partie 4: sortes d'objets qu'un duo médian garde à la maison, moins 4 sortes gardées dans les sacs):

| Saison | Sortes à ranger | Coffre seul | Grand coffre | Grand coffre et cellier |
|---|---|---|---|---|
| printemps | 17 | 85 % | 53 % | 30 % |
| été | 21 | 105 % | 66 % | 38 % |
| automne | 24 | 120 % | 75 % | 43 % |

Lecture: le coffre seul suffit à la démo et déborde à l'été: c'est le moment où le grand coffre (250 sous, abordable dès la deuxième commande) ou le cellier deviennent désirables. Avec le cellier, la place ne manque plus de l'année 1; les années suivantes (690 objets à 100 h) demanderont d'autres meubles de rangement (buffet, commode, grenier).

### 5.3 Règles

| Règle | Valeur | Raison |
|---|---|---|
| Déposer | dans une pile existante d'abord, sinon dans une case libre; aucune case libre: refus doux `storage_full` et son du couvercle qui bute | rien ne disparaît |
| Tout déposer | boutons par famille (récoltes, poissons, cueillette, plats, matériaux): remplissent les piles existantes puis les cases libres, s'arrêtent quand c'est plein | le retour du soir en un geste |
| Ranger | trie par famille puis par nom | |
| Les outils | ne prennent pas de case: ils vont au **râtelier** près de la porte (12 crochets, plus qu'il n'existe d'outils en double); l'ancien outil remplacé (tour 9) y va | un outil n'est jamais bloqué par un coffre plein |
| Arrivée automatique quand c'est plein | ce qui devait entrer au rangement (livraison, objet rapporté) est posé au pied du coffre (objet au sol dans la maison, jamais perdu), avec la ligne `storage_ground` | PE-10 |
| Retirer un meuble de rangement | permis seulement si le reste du rangement peut tout contenir; sinon refus `storage_remove_refused` | jamais de débordement provoqué |
| Partie qui déborde déjà (sauvegarde d'avant ce tour) | tout est gardé; le panneau affiche « Ça déborde »; on peut reprendre, pas déposer, jusqu'à repasser sous la capacité | aucune perte à la migration |
| Les deux en même temps | chacun ouvre le rangement; l'hôte applique les dépôts dans l'ordre reçu; un dépôt refusé faute de place est rendu au sac | |
| Grand coffre et contenu | le contenu passe de l'ancien coffre au grand coffre pendant la nuit | |

### 5.4 Textes

| Clé | Texte |
|---|---|
| `ui.storage.title` | Rangement de la maison |
| `ui.storage.count` | {used} cases sur {total} |
| `ui.storage.sort` | Ranger |
| `ui.storage.depositFamily` | Tout déposer: {family} |
| `ui.storage.rack` | Le râtelier |
| `messages.storage_full` | Plus de place. Range, ou fabrique une étagère ? |
| `messages.storage_overflow` | Ça déborde: {used} sur {total}. Reprends quelque chose avant d'en remettre. |
| `messages.storage_remove_refused` | Vide d'abord de quoi tenir dans le reste du rangement. |
| `messages.storage_ground` | Déposé au pied du coffre: plus de place dedans. |
| `messages.tool_upgrade_hint` (remplace le texte du tour 9) | {item}: même geste qu'avant, en mieux. L'ancien t'attend au râtelier. |
| `objets.oak_chest.description` | En chêne, haut comme une commode. Basile reprend l'ancien pour la scierie. |
| `objets.cellar_rack.description` | Du sol au plafond, pour les bocaux et les sacs. Ne tient que dans le cellier. |
| `ui.basile.oakChest` | Grand coffre de chêne: 250 sous |

## 6. Fenêtres et rideaux (R17)

### 6.1 La règle

Les rideaux (`curtains`, catalogue, et les rideaux de couleur de la mercerie) se posent **seulement à une fenêtre**, sans emprise au sol (la correction de R02, traitée ailleurs, va dans le même sens). En main, en mode aménagement, les fenêtres libres de la pièce s'éclairent; viser une fenêtre et valider y accroche les rideaux, centrés sur la fenêtre. Ailleurs: refus « Les rideaux vont à une fenêtre. ».

Les fenêtres sont celles du modèle (`assets-src/modeles/bourg.py`, `gatekeeper_house`): deux au sud, une au nord, une à l'ouest, une à l'est. L'artiste les exporte en nœuds vides `window_<n>` (centre, largeur, côté), comme `sleep_spots` pour les lits: le jeu lit les fenêtres dans le modèle, jamais dans une liste écrite à la main. La fenêtre est est centrée sur la limite de deux cases: c'est la fenêtre qui compte, pas la case.

| Fenêtre | Pièce | Rideaux possibles | Après les agrandissements |
|---|---|---|---|
| sud, à l'est de la porte | pièce principale | oui | inchangée |
| sud, à l'ouest de la porte (jardinière) | pièce principale | oui | inchangée |
| nord | pièce principale | oui | devient la porte de la chambre |
| ouest | pièce principale | oui | devient la porte du cellier |
| est (côté voie, le garde-barrière surveille les trains) | pièce principale | oui | inchangée |
| fenestron nord | cellier | non: « Ce fenestron n'a pas besoin de rideaux: le cellier aime le noir. » | |
| nord, vers la voie et la lisière | chambre | oui | |
| est, vers le sentier du jardin | chambre | oui | |

Rideaux posés à une fenêtre qui devient porte: ils sont rangés la nuit du chantier (rangement, sinon au pied du coffre), ligne « Basile a décroché vos rideaux pour percer la porte. ». Migration: des rideaux posés sur un mur sans fenêtre (sauvegarde d'avant ce tour) passent à la fenêtre libre la plus proche de la même pièce, sinon au rangement: « Les rideaux ont trouvé leur fenêtre. »

### 6.2 Ouvrir, fermer

| Action | Effet |
|---|---|
| Agir sur des rideaux (de dedans) | les ouvre ou les ferme; animation `curtain_pull`, son `curtain-draw` |
| Rideaux fermés au coucher dans la pièce où l'on dort | Sommeil +5 (3.6) |
| Premiers rideaux ouverts du matin, pour chaque joueur | Cœur +2, une fois par jour: « Les rideaux s'ouvrent sur le matin. » |
| Vu du dehors, la nuit | rideaux fermés: lumière tamisée de leur couleur; ouverts: la fenêtre éclairée habituelle |
| Le jour, rideaux fermés | pièce plus sombre (P1, rendu) |

### 6.3 Les rideaux de la mercerie

| Article | `id` | Prix | Couleur |
|---|---|---|---|
| Rideaux (catalogue, existants) | `curtains` | 30 | écru |
| Rideaux bleu guède | `curtains_blue` | 30 | bleu |
| Rideaux garance | `curtains_red` | 30 | rouge |
| Rideaux bouton d'or | `curtains_yellow` | 30 | jaune |
| Rideaux vert sauge | `curtains_green` | 30 | vert |
| Rideaux vichy | `curtains_gingham` | 30 | carreaux rouges et blancs |

Un seul modèle à deux états (`curtains_open`, `curtains_closed`) et une tringle, couleur par variante de matériau; largeur ajustée à la fenêtre (0,7 à 0,75 m de jour, 0,8 à 0,9 m de haut). Confort 1, beauté 2 (inchangés).

## 7. Données et configuration

### 7.1 `reglages.json` (ajouts)

| Clé | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| `needs.belly.morning` | 65 | points | 50 à 75 | 3.3 |
| `needs.belly.decayPerHour` | 4 | points par heure de jeu | 3 à 6 | petit creux vers 16 h sans déjeuner |
| `needs.belly.supperFromHour`, `supperFactor` | 18, 2 | heure, facteur | 17 à 19; 1,5 à 2 | le souper tient la nuit |
| `needs.belly.together` | 10 | points | 5 à 15 | manger ensemble |
| `needs.belly.fullAt`, `lowBelow`, `nightFloor` | 60, 25, 30 | points | | 3.3 |
| `needs.belly.fullCostMultiplier` | 0,8 | facteur | 0,7 à 0,9 | bonus du Ventre plein |
| `needs.rest.sitPerMinute`, `comfortSeatFactor`, `comfortSeatMin` | 1, 1,5, 3 | points par minute de jeu, facteur, confort | 0,5 à 1,5 | 3.4 |
| `needs.rest.nap` | `{ "from": "12:00", "to": "16:00", "perMinute": 1.5, "maxMinutes": 60, "bellyDecayFactor": 0.5, "togetherClockFactor": 4, "togetherHeart": 5, "wakeBeforeEventMinutes": 10 }` | | `togetherClockFactor` 2 à 6 | 3.4 |
| `needs.rest.levels` | pleine énergie 0,75, besoin de souffler 0,25 | part de l'endurance du réveil | | 3.4 |
| `needs.heart.nearPartner` | `{ "radius": 8, "perHour": 2, "maxPerDay": 12 }` | m, points | | 3.5 |
| `needs.heart.reunion` | `{ "apartRadius": 30, "apartMinutes": 180, "meetRadius": 3, "gain": 5, "maxPerDay": 2 }` | m, minutes de jeu, points | `apartMinutes` 120 à 240 | 3.5 |
| `needs.heart.lightAt`, `lightWalkFactor` | 70, 1,1 | points, facteur | 1,05 à 1,15 | 3.5 |
| `needs.heart.hairNoticed`, `hairNoticedRadius`, `chocolateTogether`, `curtainsMorning` | 10, 4, 5, 2 | points, m | | 2.3, 1.6, 6.2 |
| `needs.sleep.bedroomBonus`, `curtainsClosedBonus`, `togetherHeart`, `togetherMinutes` | 5, 5, 5, 10 | points, minutes de jeu | | 3.6 |
| `needs.belly.foods` | table 3.3 (`bread` 15 ... `hot_chocolate` 15) | points | | remplace `needs.belly` par sorte de plat |
| `bakery` | `{ "warmFrom": "06:00", "warmTo": "09:00", "breadUntil": "12:00", "closedWeekdays": ["monday"], "breadPrice": 5, "briochePrice": 12, "briocheWeekdays": ["sunday"], "dailyCapPerPlayer": { "bread": 4, "brioche": 2 }, "warmBecomesBreadAt": "12:00" }` | | | 1.5 |
| `salon` | `{ "open": [["09:00", "12:00"], ["14:00", "18:00"]], "weekdays": ["tuesday", "wednesday", "thursday", "friday", "saturday"], "saturdayFrom": "10:45", "cutPrice": 15, "colorPrice": 10, "bothPrice": 20 }` | | prix 10 à 25 | jamais cher: l'apparence ne se paie pas cher |
| `grocer.hours`, `grocer.chocolate` | `["07:00", "19:00"]`; `{ "price": 5, "belly": 15, "until": "18:00", "seasons": ["autumn", "winter"], "rainAnySeason": true, "perPlayerPerDay": 1 }` | | | 1.6 |
| `rooms` | `{ "opensFromDay": 23, "letter": "basile_rooms", "oneAtATime": true }`; définitions dans `donnees/pieces.json` (table 4.2 et éléments 4.3) | | | 4 |
| `storage` | `{ "chest": 20, "shelf": 6, "oak_chest": 32, "cellar_rack": 12, "rackHooks": 12, "oakChestPrice": 250 }` | cases | coffre 16 à 24 | 5 |
| `appearance` | `{ "hairStyles": 15, "creationHairStyles": 12, "hairColors": 8 }` | | | 2 |

### 7.2 État et données (pour l'architecte et le dev)

- Personnage: `needs { belly, heart, apartMinutes, reunionsToday, nappedToday, napStart, curtainsMorningDone, missingShown }` (l'endurance reste où elle est); `appearance.hairColor` (0 à 7), `appearance.hair` de 0 à 14 (les trois actuels gardent 0 à 2); `hairChangedDay` et `hairNoticedBy` pour la coupe remarquée.
- Monde: `rooms[<id>] { ordered, crate, elementsBuilt, beamPlaced, builtDay }`; meubles de rangement et leur contenu (le coffre actuel `cellar` devient le contenu du rangement, réparti à l'affichage seulement); `rack` (outils); rideaux posés: `window` (identifiant du nœud) et `closed`.
- Carte: la région est (x 64 à 99), les bâtiments et leurs intérieurs (`interior`, `door_cell`, `cut_walls`, heures), les points de 1.4 et 1.6, les sites des pièces.
- Conditions nouvelles: `inside { building }`, `ate_together`, `napped`, `hair_changed`, `curtains_opened`, `bought { item, before }`, `room_built { room }`. Effets nouveaux: aucun hors de ceux du tour 9 (`give_item`, `set_flag`, `send_letter`, notifications).
- Format de sauvegarde 7, migration du format 6 testée (rangement qui déborde, rideaux hors fenêtre, coiffure 0 à 2, aucun besoin: valeurs du réveil).

## 8. Actions et retours

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Passer une porte d'intérieur | porte qui s'ouvre, murs et toit qui s'effacent chez soi | `door-open` (actuel), ambiance de la pièce (`room-tone-shop`, `room-tone-salon`), dehors étouffé |
| Porte fermée | porte qui ne bouge pas, ligne des heures | `door-locked` (loquet, 0,3 s) |
| Acheter un pain chaud | le pain fume dans la main, « +1 pain chaud » | `bakery-bell` (clochette du guichet), `bread-crack` (croûte qui chante) |
| Porter la panière à deux | la panière entre les deux, la barre de porter | sons du porter (actuels), osier qui craque |
| S'asseoir au fauteuil du salon | gros plan, aperçu de la coupe | `salon-bell` à l'entrée, `chair-creak` |
| Valider une coupe | la coupe change, Solange recule d'un pas | `scissors-snip` (3 variantes), `hair-reveal` (petit accord) |
| Proposer une coupe depuis le banc | la proposition s'affiche chez l'autre | `ui-confirm` (actuel) |
| Coupe remarquée | tête penchée, « {name} a changé de coiffure. » | `hair-noticed` (deux notes montantes) |
| Manger | animation `eat` (actuelle), icône du Ventre qui se remplit | sons actuels; `eat-together` (tintement de deux cuillères) quand c'est ensemble |
| Petit creux | portrait « ventre », icône pâlie | `belly-rumble` (2 variantes, discret, chez soi seulement) |
| Boire un chocolat | tasse aux mains (`drink_cup`) | `cup-sip` |
| S'asseoir pour souffler | icône du Repos qui remonte | `sit` (actuel) |
| Sieste | personnage allongé, rêverie, carnet ouvert | `yawn-soft` (épicène), horloge qui file à deux (`nap-tick`) |
| Retrouvailles | main levée chez les deux, « Retrouvailles ! » | `reunion-chime` (deux notes qui se rejoignent) |
| Cœur léger | icône du Cœur pleine, pas plus vif | aucun (le bonus se voit) |
| Commander une pièce | plan tamponné à l'établi | `purchase-accept` (actuel) |
| Site du chantier au matin | fantômes, panneau, caisse | `chantier-built` (actuel, variante courte) |
| Bâtir un élément | barre de progression, élément qui se dresse | marteau (actuel) |
| Porter la panne faîtière | panne à l'épaule des deux, repère au faîte | `beam-ridge` (poutre posée, bois sur bois) |
| Pièce bâtie | notification du matin, nom de la pièce à la craie | `room-built` (coups de marteau lointains puis accord) |
| Rangement plein | case grise, refus | `chest-full` (couvercle qui bute) |
| Accrocher un outil au râtelier | l'outil au crochet | `rack-hang` (bois et fer) |
| Accrocher des rideaux | les fenêtres libres s'éclairent; rideaux posés | `curtain-hang` |
| Ouvrir, fermer les rideaux | animation `curtain_pull`, lumière de la pièce | `curtain-draw` (2 variantes) |
| Récréation de l'école | aucun (cour murée) | `school-recess` (cour d'école lointaine, 10 h 30 et 15 h, jours d'école) |
| Le ru de la Côte | eau vive | `stream-ru` (boucle spatialisée), `footbridge-steps` sur la passerelle |

## 9. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| T10-01 | La carte fait 100 x 48 m; `valider_carte.py` sans erreur; depuis `house_door`, chaque porte de la rue Haute est atteignable, et aucun point de la démo ne devient inatteignable | validateur de carte |
| T10-02 | Le ru se franchit par le pont de la rue, la passerelle et le gué de pierres, et nulle part ailleurs; la voie passe sur le ponceau sans changement des cases de la voie | validateur, capture de près des trois passages |
| T10-03 | La porte de chaque lieu nouveau est visible au zoom 1 dans au moins trois orientations sur quatre; la mercerie et la maison de Lucie ne cachent pas la rue de la halte en orientation 0 | `moments_tour7_geometrie.py`, captures |
| T10-04 | Budgets du PC de référence tenus avec la carte entière, deux joueurs et six habitants à l'écran (rue Haute vue depuis le pont) | G4 |
| T10-05 | Achille et Solange suivent leurs emplois du temps (table 1.4) un mardi, un samedi, un dimanche et un lundi, sous la pluie et sans; Jeanne rentre avec Solange à 18 h 30 et ne sort plus par `village_exit` | test d'emploi du temps |
| T10-06 | `achille_basket` démarre au jour 4 à 6 h (jamais un lundi), se finit seulement en portant la panière à deux jusqu'à `grocery_door`; sans personne avant 11 h, Achille descend seul et la quête reste ouverte; une sauvegarde du jour 30 la démarre à la première aube qui n'est pas un lundi | test et migration |
| T10-07 | Le guichet vend le pain chaud de 6 h à 9 h et le pain jusqu'à 12 h, du mardi au dimanche, jamais pendant les sorties d'Achille (`bakery_away`), 4 au plus par joueur et par jour; à 12 h, tout pain chaud devient du pain, sacs et rangement compris; la brioche seulement le dimanche | test unitaire |
| T10-08 | `solange_first_cut`: la lettre n'arrive jamais un dimanche ni un lundi; la première coupe est gratuite pour chacun; la scène du miroir ne part qu'avec les deux au salon après leur passage au fauteuil | test à deux joueurs |
| T10-09 | Salon: 15 coupes et 8 couleurs; 15, 10 et 20 sous; « Garder ma coiffure » gratuit; une proposition depuis le banc s'affiche seulement chez la personne au fauteuil, qui accepte ou non | test d'interface |
| T10-10 | Coupe remarquée: une fois par changement, à moins de 4 m, hors menus; Cœur +10 aux deux | test unitaire |
| T10-11 | Chaque coupe nouvelle, sur les 8 poses de 2.1 et au portrait: rien ne traverse foulard, col, poutre portée, oreiller; budget sous la table 2.1 | captures de près, planche de l'artiste, jugement du directeur artistique |
| T10-12 | Intérieurs: chez le joueur dedans, murs et toit coupés; chez l'autre dehors, bâtiment entier; hors des heures, porte fermée avec sa ligne; un joueur dedans à la fermeture n'est jamais déplacé; impossible d'entrer en portant à deux | test à deux contextes, captures |
| T10-13 | Ventre: 65 au réveil, -4 par heure de jeu horloge tournante seulement, plafond 100, souper x 2 dès 18 h, +10 ensemble; au coucher, au moins 30; les cinq journées types de 3.3 donnent les valeurs de l'annexe A (Ventre au coucher, à 1 près) | test unitaire, script |
| T10-14 | Aucun besoin bas ne retire quoi que ce soit: les coûts, vitesses, gains et quêtes sont identiques avec un Ventre à 0 et à 59, un Cœur à 0 et à 69; seuls les bonus (endurance x 0,8, marche x 1,1) changent | test unitaire |
| T10-15 | Repos: +1 par minute de jeu assis (x 1,5 sur le fauteuil d'osier), jamais au-dessus de l'endurance du réveil; sieste seulement de 12 h à 16 h, 60 minutes au plus, une fois par jour; à deux, horloge x 4 jusqu'au premier réveil; réveil forcé 10 minutes avant le train ou une scène | test unitaire et test à deux joueurs |
| T10-16 | Cœur: retrouvailles après 180 minutes de jeu à plus de 30 m, à moins de 3 m, 2 par jour au plus, jamais pendant une absence ni avec un dormeur; le Cœur ne baisse jamais | test unitaire |
| T10-17 | Sommeil: chambre +5, rideaux fermés +5, plafond 100; « Vous avez éteint la lampe en même temps. » quand les deux se couchent à moins de 10 minutes de jeu | test unitaire |
| T10-18 | La forme du matin garde la formule PE-04; robots de la démo (8 graines): forme médiane au moins égale à celle d'avant ce tour | robots |
| T10-19 | Icônes des besoins: trois états lisibles à 1366 x 768, 100 et 150 %, chez soi et en petit sur la carte de l'autre; « Besoins en sourdine » coupe lignes et sons, garde les icônes; « Ventre patient » divise la baisse par deux, invisible chez l'autre | captures et test d'interface |
| T10-20 | Pièces: les deux plans s'ouvrent au jour 23 (lettre `basile_rooms`); une seule pièce à la fois; payer passe par l'accord de l'autre; le site paraît le matin suivant; chaque élément demande son support; la chambre exige le porter de la panne; la pièce paraît le matin d'après le dernier élément | test et robots |
| T10-21 | À la pièce bâtie: la fenêtre devient porte, rideaux et meubles du seuil déplacés selon 4.3 et 6.1, sans rien perdre; le banc du pignon et l'auvent restent en place; `valider_carte.py` sans erreur avec les deux pièces bâties | test, validateur, captures de près des pignons ouest et nord |
| T10-22 | Captures de près du cellier et de la chambre bâtis, dedans et dehors, quatre orientations: rien qui flotte, traverse ou dépasse; toits raccordés à la maisonnette; portes là où étaient les fenêtres | captures `captures/tour-10/piece-*.png` |
| T10-23 | Robots médians (8 graines, jours 16 à 64, la maison d'abord): cellier fini, chambre finie avant le jour 64 dans au moins 7 graines sur 8 | robot longue vie |
| T10-24 | Rangement: capacité = somme des meubles posés (20, 6, 32, 12); refus quand c'est plein; outils au râtelier sans case; arrivée automatique au pied du coffre si plein; retirer un meuble refusé s'il fait déborder; une sauvegarde de format 6 au coffre de 30 piles se charge sans perte et affiche « Ça déborde » | test unitaire et migration |
| T10-25 | Rideaux: posables seulement à une fenêtre libre du modèle, sans case au sol; le fenestron du cellier refuse; Agir ouvre et ferme; rideaux hors fenêtre d'une sauvegarde de format 6 replacés selon 6.1 | test unitaire, migration, captures |
| T10-26 | Répliques: joueur assidu, jours 4 à 64, aucune redite à moins de 28 jours chez Achille et Solange; envies nouvelles réalisables et jamais deux fois en 7 jours | robot longue vie |
| T10-27 | Une nouveauté par journée: les départs de 1.7 tombent sur des jours différents, y compris dans une partie reprise au jour 30 | robot, sauvegarde de référence du tour 9 |
| T10-28 | Textes nouveaux: validateur sans avertissement d'écriture neutre; aucun tiret cadratin ni demi-cadratin; aucune variable non remplie | validateur |
| T10-29 | Chaque action de la section 8 a son retour visuel et sonore | test et écoute chez le client |
| T10-30 | Chez le client: le duo dit que « le bourg est plus grand », déjeune au moins une fois ensemble pour un petit creux, choisit à deux l'ordre des pièces, et l'un propose une coupe à l'autre | observation |

## 10. Travail par rôle

| Rôle | Travail |
|---|---|
| Dev gameplay 3D (simulation et rendu) | carte élargie et intérieurs à leur place (coupe des murs par bâtiment pour le joueur local, portes, heures, sons étouffés); Achille et Solange (emplois du temps, quêtes `achille_basket` et `solange_first_cut`, souhaits et cadeaux du tour 9); Jeanne qui rentre avec Solange; fournil (pain chaud qui devient pain, brioche, plafonds), chocolat chaud; besoins (Ventre, Repos assis et sieste, horloge x 4 à deux, Cœur au fil du jour, retrouvailles, bonus, Sommeil de la chambre et des rideaux, forme inchangée); coiffures (15, 8 couleurs, salon, proposition depuis le banc, coupe remarquée); pièces (commande à Basile, site, caisse, éléments à supports, porter de la panne, nuit, seuil, fenêtre devenue porte); rangement (capacité par meubles, grand coffre, étagères hautes, râtelier, débordement, retrait refusé); rideaux aux fenêtres (nœuds `window_<n>`, ouvrir et fermer, lumière de nuit); format 7 et migration; robots (manger à midi et le soir, s'asseoir, la maison d'abord, rangement); données passées au validateur |
| Dev gameplay 2D (interface) | trois icônes des besoins à côté du portrait et en petit sur la carte de l'autre; panneau du salon (aperçu, coupes, couleurs, prix, proposition reçue et envoyée); panneau du rangement (cases, familles, Ranger, râtelier, débordement); établi de Basile: « Agrandir la maisonnette » et grand coffre; panneau du chantier de pièce; rêverie de la sieste avec le carnet ouvert; guichet du fournil; deux aides du carnet; lignes du petit-déjeuner; textes des sections 1.8, 2.3, 3.8, 4.5, 5.4 |
| Artiste 3D | Achille et Solange (squelette commun, `build_npc_round`; Achille: tablier fariné, calot de mitron; Solange: blouse à poches, ciseaux à la ceinture, lunettes au cou); fournil (cheminée de four, guichet, auvent), mercerie-coiffure (vitrine, enseigne peinte, porte d'angle), maison de Lucie (basse, volets, jardinet), école-mairie (façade, cour murée, tilleul, portail), ponceau, pont de la rue, passerelle, gué de pierres; intérieurs de l'épicerie (comptoir intérieur, rayonnages, bocaux, panière, poêle, petite table et deux chaises, salle à manger sous draps, escalier) et du salon (fauteuil de coiffure, miroir, tablette, banc d'attente, comptoir de mercerie, rouleaux de tissu); cellier et chambre (états fantôme et bâti, éléments de 4.3, toits raccordés, portes à la place des fenêtres, fenestron), panne faîtière; nœuds `window_<n>` de la maisonnette et des pièces; rideaux à deux états en six couleurs, tringle; grand coffre de chêne, étagère haute du cellier, râtelier; 12 coupes de 2.1 et les couleurs par matériau; panière (porter à deux), pain chaud, brioche, sablier, peigne de corne, tasse; animations `haircut_sit`, `cut_hair` (Solange), `knead` (Achille, P1), `drink_cup`, `curtain_pull`, sieste (reprend le coucher); chaque objet vu de près |
| Level designer | région est (x 64 à 99) dans `construire_carte_halte.py`: ru, trois passages et le gué de pierres, rue Haute, bâtiments, emprises et intérieurs, bancs; points `bakery_window`, `bakery_door`, `upper_street_bench`, `salon_door`, `salon_chair`, `salon_bench`, `salon_counter`, `salon_window`, `lucie_house_door`, `school_gate`, `grocery_table`, `grocery_inside_counter`, `village_exit` déplacé; sites `room_cellar_site` et `room_bedroom_site` dans la réserve; trajets d'Achille (panière) et de Solange; vérifications de 1.3 (caméra, chemins, passages, lignes de vue) avec `valider_carte.py` et `moments_tour7_geometrie.py`; mise à jour de `carte-halte.md` |
| Sound-designer | `door-locked`, `bakery-bell`, `bread-crack`, `salon-bell`, `chair-creak`, `scissors-snip` (3), `hair-reveal`, `hair-noticed`, `eat-together`, `belly-rumble` (2), `cup-sip`, `yawn-soft`, `nap-tick`, `reunion-chime`, `beam-ridge`, `room-built`, `chest-full`, `rack-hang`, `curtain-hang`, `curtain-draw` (2), `school-recess`, `stream-ru`, `footbridge-steps`, ambiances `room-tone-shop` et `room-tone-salon`, filtre du dehors entendu de dedans; motifs `motif_achille` (basson lent, pas de valse ensommeillée) et `motif_solange` (clarinette vive, pizzicati comme des ciseaux) |
| Directeur artistique | palette des couleurs de cheveux et des rideaux; revue des coupes de près et au portrait; façades de la rue Haute dans la bible (matériaux du bourg); revue des intérieurs et des deux pièces |
| Designer UX | maquettes des icônes de besoins (états, daltonisme, 150 %), du salon et de la proposition, du rangement, du chantier de pièce, de la rêverie; parcours au clavier |
| Architecte | intérieurs sur la carte ou en scène à part (section 11), coût de rendu de la carte élargie, format 7 |
| QA | critères T10-01 à T10-30; sauvegardes de référence de format 6 (coffre qui déborde, rideaux hors fenêtre); robot longue vie étendu (repas, sieste, pièces, rangement) |
| Game designer (fait dans ce document) | règles, valeurs, textes, simulation `tour10_maison.py`; relecture en situation après production; réserves complètes de répliques d'Achille et Solange avec leurs étapes 2 et 3 |

## 11. Hors périmètre

- Les étapes 2 à 5 du monde (1.2): intérieurs de la halte, du fournil, de l'école, de la scierie, Armand, le moulin et Berthe, le bois de la Côte.
- Lucie et tout le contenu de J1 (D6, D7 en attente): Solange dit seulement que Lucie est en tournée.
- Étapes 2 à 5 des histoires d'Achille et de Solange; les réserves complètes R3 de leurs répliques.
- Grenier, cuisine, atelier, plan libre (4.6); meubles de rangement au-delà de la table 5.2.
- Miroir mural (P1), balancement des cheveux (P1), coupes de saison, barbes et moustaches (question 2).
- Hygiène, loisirs ou autres besoins: trois suffisent, et l'envie du jour joue déjà le rôle du loisir.
- L'horloge et son réglage (D1, autre membre); R01 à R14 et R20 à R22.

Question technique pour l'architecte (par le manager, pas pour le client): les intérieurs sur la carte, à leur place, avec coupe des murs pour le joueur qui est dedans (recommandé: même règle que la maisonnette, aucun chargement, distances vraies pour les retrouvailles), ou des scènes à part (plus de liberté de taille, mais un chargement et deux mondes à synchroniser). Et le coût de rendu de la carte élargie sur le PC de référence (T10-04).

## 12. Questions pour le client

1. **Les besoins se montrent en trois petites icônes à trois états, ou en jauges chiffrées ?** Les jauges chiffrées font plus « simulation de vie »; les icônes laissent l'écran calme et ne donnent pas envie d'optimiser chaque point. Recommandation: les icônes, avec la possibilité d'afficher les chiffres dans le carnet si vous le souhaitez.
2. **Barbes et moustaches au choix, pour tous les personnages ?** Le jeu ne demande pas de genre; une barbe se choisirait comme une coupe, pour qui veut. Recommandation: oui, trois au salon (barbe courte, barbe fournie, moustache), au tour suivant.
3. **Après la rue Haute, d'abord plus d'intérieurs, ou d'abord plus de dehors ?** Plus d'intérieurs: la halte, le fournil et l'école (l'histoire de Firmin et le mystère d'Émile avancent). Plus de dehors: le moulin de l'amont et son geste à deux (la vanne). Recommandation: les intérieurs d'abord (étape 2), parce qu'ils font avancer des histoires déjà commencées et qu'ils servent tous les jours; le moulin suit après l'hiver.

## Annexe A: résultats de la simulation

`python3 -I docs/jeux/jeu-1/simulations/tour10_maison.py` (60 s, 2 000 graines; `--rapide`: 300 graines, 9 s). Repères:

| Partie | Résultat |
|---|---|
| 0 | contrôle croisé des tables 3.3, 4.2 et 5.2 avec le script: aucun écart |
| 1 | journée réelle: 9,8 min à 0,35 s, 12,1 à 0,5, 15,1 à 0,7, 18,1 à 0,9, 19,6 à 1,0; jours 1 à 64: 10,5 h à 0,35 s, 16,1 h à 0,7 s; 100 h: 397 journées à 0,7 s (4,7 années de jeu); les arcs du plan à 0,7 s font 93,6 h, A8 passe de 76 à 102 journées pour 100,2 h; pain chaud 2,1 min réelles, sieste 42 s au plus |
| 2 | table 3.3 (journées types) |
| 3 | table 4.4; sans priorité à la maison, la chambre n'est finie avant le jour 64 dans aucune partie (médian) |
| 4 | table 5.2 (remplissage) |
| 5 | depuis `house_door`: comptoir d'Odette 8 s (repère de la carte: 8,3 s), fournil 24 s, mercerie 24 s, maison de Lucie 25 s, école 27 s (34 à 39 minutes de jeu à 0,7 s) |

Hypothèses du script: revenus de la commande, des annonces et des ventes du tour 9 (`tour9_automne.py`, calés sur les robots à 0,35 s); petites dépenses de la rue Haute 40 sous par semaine (pain, chocolat, coupes) et quatre rideaux de couleur; planches des pièces en partie fournies par le duo (10 pour le médian), le reste acheté 8 sous; un chantier de pièce bâti deux jours après sa commande; grand coffre acheté au jour 16 s'il ne l'a pas été avant.

## Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-11-01 | 1 | Première rédaction: rue Haute et quatre étapes suivantes, Achille et Solange, intérieurs de l'épicerie et du salon, 15 coupes et 8 couleurs, besoins doux (Ventre, Repos, Cœur, Sommeil), cellier et chambre bâtis à deux, rangement à cases et râtelier, rideaux aux fenêtres; simulation `tour10_maison.py` | manager (retours du client, soirée du 1er novembre) |
