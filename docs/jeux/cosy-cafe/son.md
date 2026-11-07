# Cosy Café: direction sonore

| Champ | Valeur |
|---|---|
| Jeu | `cosy-cafe` (titre de travail « Cosy Café ») |
| Statut | proposition du sound designer, à consolider comme section 8 du cahier des charges |
| Version | 0.1 |
| Date | 2026-11-07 |
| Rédaction | sound-designer |
| S'appuie sur | `docs/jeux/cosy-cafe/cadrage.md` (2026-11-07), identité sonore de Duo (`docs/plateforme/identite-sonore.md`), budgets de `docs/plateforme/architecture.md` (section 14), manière de La Petite Ligne (`docs/jeux/jeu-1/son.md`) |
| Fichiers prévus | sons: `games/cosy-cafe/assets/son/` et `sons.json` (généré, jamais écrit à la main); sources: `games/cosy-cafe/assets-src/son/`; écoute pour le client: `design/son/cosy-cafe/` |

> Ce document fixe ce que l'on entend dans Cosy Café, pourquoi, à quel niveau, et ce que cela coûte en mémoire et en poids. Aucun fichier audio n'est produit à ce stade. Les sections sont numérotées 8.1 à 8.12 pour entrer telles quelles dans le cahier des charges. Ce qui dépend des règles, des lieux ou de la technique, écrits en parallèle, est signalé dans le texte et regroupé en 8.11.

## 8.1 Intention et piliers

Cosy Café sonne comme un petit café où l'on aimerait travailler: la porcelaine qui tinte, le bois du comptoir, le laiton de la machine, la vapeur, la clochette de la porte, la rumeur de la salle et la radio sur l'étagère. On fait ses gestes à l'oreille. Même au coup de feu, rien ne crie: les sons se pressent sans s'agresser, et l'on peut toujours se parler par-dessus.

1. **Le geste s'entend.** Chaque geste a un début, un déroulé qui renseigne et une fin franche: le moulin s'allège quand la dose est faite, l'extraction s'amincit quand elle blondit, le pichet chante quand le lait est à la bonne température. Le son du geste est l'information: on n'ajoute pas de bip, la pompe qui se tait suffit.
2. **Douillet, même au coup de feu.** Matières chaudes (porcelaine, bois, laiton, papier, tissu), attaques arrondies, aigus adoucis de 3 dB au-dessus de 6 kHz, aucun bip, aucune alarme, aucun crissement. Au plus fort du service, on plafonne la densité (rumeur, voix simultanées, section 8.7) au lieu de pousser le niveau.
3. **La salle vit sans couvrir.** La rumeur suit le nombre de clients, vient des tables occupées et reste sous les gestes. Aucune voix: ni mots, ni charabia; les clients s'expriment par leurs objets et par quelques notes.
4. **La musique est dans le café.** Elle sort d'un appareil qu'on voit, qu'on choisit et qu'on règle: la radio du village, puis le tourne-disque, la platine et ses enceintes, la sonorisation de Paris, et des musiciens pour la fête finale. Elle grandit avec la maison.
5. **Un son n'est jamais secret.** Les deux ordinateurs sont dans la même pièce: ce que joue l'un, l'autre joueur l'entend aussi. Rien de privé, rien qui compare les deux joueurs, et les deux machines jouent la même chose au même instant (section 8.6).
6. **On se parle par-dessus.** La parole est l'outil principal du jeu (cadrage, section 5). Les couches continues (musique, rumeur, ambiance) restent ensemble sous -26 LUFS en court terme au coup de feu, réglages par défaut: deux personnes se parlent à voix normale sans forcer.

**Ce qu'on s'interdit**: voix et charabia; bips, alarmes, sirènes, sonneries électroniques; crissements (craie, chaise, freins, lait qui hurle); claquements secs à pleine force (porte, bac à marc, rideau de fer); sons d'échec ou de reproche; basses lourdes; sifflements tenus au-dessus de 2 kHz; musique de tension ou de compte à rebours.

**Avec Duo.** La plateforme parle en verre (célesta et harpe de verre, ré lydien). Le jeu parle en porcelaine, bois, laiton et papier: on les distingue sans qu'ils se heurtent. Le jeu ne double aucun son de la plateforme (pause, reprise, connexion, fin de séance), et Échap n'a aucun son dans le jeu.

## 8.2 Palette, tonalité, voix des deux joueurs

### 8.2.1 Matières

| Matière | Où on l'entend | Fabrication |
|---|---|---|
| Porcelaine et faïence | tasses, soucoupes, assiettes, théière; ton repère | partiels inharmoniques d'une coque mince, contact bref; plus mat pour la faïence |
| Bois | comptoir, tables, chaises, meubles, « tok » de l'interface; le repère de l'autre | lame et caisse de résonance, fondamentale de 150 à 400 Hz (audible sur un portable) |
| Laiton et cuivre | machine, porte-filtre, clochettes, sonnette, tiroir-caisse | partiels de cloche accordés, aigus adoucis |
| Vapeur, eau, lait | buse, extraction, versements, plonge, pluie | bruit filtré, résonances qui suivent un état (température, remplissage) |
| Papier et craie | tickets, ardoise, livre d'or, carnet, catalogue | bruit bref et grain, jamais de crissement aigu |
| Tissu et cuir | tabliers, manteaux, banquettes, rideaux | bruit doux, sous 4 kHz |

### 8.2.2 Tonalité et motif

- Tout ce qui tinte (clochettes, minuteries, airs, motifs des habitués, réactions des clients, repères) est en **do pentatonique** (do, ré, mi, sol, la). Les morceaux sont écrits dans les tonalités voisines: do, fa et sol majeur, la, ré et mi mineur, et leurs modes (ré dorien, fa lydien, sol mixolydien). Le do pentatonique appartient à toutes ces gammes: un tintement tombe juste sur n'importe quel morceau, sauf un bref instant sur la dominante d'un morceau mineur (sol dièse, do dièse ou fa dièse).
- **Le motif de la maison**, « Notre maison »: sol, la, do (on ouvre la porte), ré, do (on se pose). Il ouvre le thème du titre, l'air d'ouverture du service, la nouvelle adresse et la fin de la fête. Ses trois premières notes sont celles du motif de l'ancienne patronne, au vieux piano: la maison continue son histoire (proposition).
- Le souffle de la vapeur et les machines ne sont pas des notes (bruits filtrés): ils ne détonnent jamais.

### 8.2.3 Registre

- Signaux et airs: fondamentale entre 400 Hz et 1,6 kHz, plus de 60 % de l'énergie au-dessus de 300 Hz (mesuré à la production), pour les haut-parleurs d'un portable.
- Rien de tenu au-dessus de 2 kHz; aucune énergie utile sous 80 Hz, sauf le tonnerre lointain.

### 8.2.4 Ta voix et celle de l'autre

- Tes gestes viennent de tes mains, devant toi. Ceux de l'autre viennent de sa position (`PannerNode`), 3 dB plus bas et un cran de priorité en dessous: on les entend sans les confondre.
- Les sons qui disent « qui »: ton repère sonne en porcelaine (une tasse frappée, sol puis do), celui de l'autre au bois (un bol de bois, les mêmes notes une octave plus bas). Les gestes à deux (porter, se passer un objet, un projet réalisé) font sonner les deux timbres ensemble.

## 8.3 Ambiances

### 8.3.1 Construction

Pour tenir la mémoire et ne jamais faire entendre une boucle reconnaissable sur une soirée, chaque ambiance est assemblée en direct:

- une **nappe** courte et lisse par adresse (12 s, mono), sans événement marquant;
- des **événements** tirés au hasard (oiseaux, passants, véhicules, cloches), une dizaine de fichiers brefs par adresse, joués à leur place dans la rue, sans répétition immédiate, 3 à 15 s entre deux selon le moment;
- la **pièce** (souffle de la salle vide, 6 s) et les **machines au repos** (chaudière, réfrigérateur, pendule, four), chacune à sa place;
- la **météo** et les **jours à part** (pluie, hiver, marché, fête), décodés seulement quand ils arrivent.

Chaque machine démarre ses boucles d'ambiance à une position tirée au hasard: les deux ordinateurs ne jouent pas le même bruit au même instant, ce qui évite l'effet de filtre en peigne dans la pièce (section 8.6). Dehors, la nappe mono est jouée deux fois, à gauche et à droite, décalée de la moitié de sa durée: de la largeur pour le prix d'un mono.

Chaque événement vient d'où il serait: la fontaine au milieu de la place, le tramway sur sa ligne, le clocher dans la direction de l'église, le train régional du côté de la gare. Les positions se prennent sur les plans du level designer.

### 8.3.2 Les cinq adresses

| Adresse | Dehors: nappe, puis événements | Dedans | Porte fermée | Terrasse |
|---|---|---|---|---|
| `village`, place du village | la fontaine de la place, les platanes, la campagne au loin; moineaux, merle, hirondelles l'été, rouge-gorge l'hiver, tracteur et mobylette au loin, porte de la boulangerie d'en face, boules sur la place les soirs d'été, chien au loin, le clocher à midi | 30 à 40 m², plafond bas, poutres et tomettes: pièce sèche et chaude (réverbération 0,4 s); vieux réfrigérateur, pendule, poêle à bois l'hiver | -10 dB, passe-bas 1,2 kHz (vieille porte de bois) | deux tables et un banc: toute la place, le café par la porte |
| `bourg`, grand-rue près de la halle et de la gare | rue commerçante, pas sur le trottoir, voitures lentes au loin; pigeons, martinets l'été, voiture qui passe, camionnette, sonnette de vélo, le train régional au loin (deux tons), portes de la halle, clocher à midi | 60 à 80 m², parquet, le four: 0,6 s | -12 dB, 1 kHz | sur la grand-rue |
| `ville`, ancien atelier d'une ville universitaire | rumeur de ville, tramway au loin; tramway (cloche et roulement), vélos, planche à roulettes, bus qui s'agenouille, groupe d'étudiants qui passe, cloche de l'université à midi, balayeuse le matin | 120 à 150 m², deux salles, briques et grandes verrières d'atelier: 0,9 s, bien plus sec une fois meublé | -14 dB, 900 Hz (porte d'atelier lourde) | devant l'atelier |
| `paris-quartier`, café d'angle | rue dense mais feutrée, pas, roulement de la ville; scooter au loin, bus, valise à roulettes sur les pavés, pigeons qui s'envolent, rideau de fer d'une boutique le matin, eau du caniveau le matin, cloches le dimanche, un accordéoniste au coin (rare) | 80 à 100 m², zinc, miroirs, carrelage: vif, 0,7 s | -10 dB, 1,2 kHz (grandes vitrines sur deux rues) | grande terrasse sur le trottoir: la rue au premier plan |
| `paris-maison`, maison sous verrière, deux niveaux | le boulevard au loin, la cour plantée; voitures du boulevard, bus, sonnette de vélo, moineaux sous la verrière, fontaine de la cour, la verrière qui craque doucement au soleil, cloches lointaines le dimanche | 250 à 350 m² sur deux niveaux, verrière: 1,2 s, adoucie par les plantes; l'autre niveau s'entend par l'escalier | -16 dB, 800 Hz (porte lourde et sas) | dans la cour |

### 8.3.3 Les moments

Horaires supposés, à caler sur ceux du game designer: service de 8 h à 19 h, midi de 11 h à 14 h.

| Moment | Dehors | Dedans |
|---|---|---|
| Préparation (horloge arrêtée) | la rue s'éveille: nappe à -4 dB, événements rares, livraisons des voisins | la machine chauffe (`espresso-warmup`), réfrigérateur, pendule; ni rumeur ni clients; la musique si on l'allume |
| Matin (8 h à 11 h) | oiseaux plus nombreux, rideaux de fer qui se lèvent (Paris), balayeuse (ville) | les pressés au comptoir: rumeur courte et dispersée, tasses, monnaie |
| Midi (11 h à 14 h) | plus de passages, cloche de midi | le coup de feu: rumeur au plus haut, plafonnée (8.3.6) |
| Après-midi (14 h à 17 h) | rue calme; sortie d'école à 16 h 30 les jours d'école | flâneurs, familles, goûter |
| Soir (17 h à la fermeture) | merle, martinets et grillons l'été (village, bourg); l'hiver, nuit tombée: plus d'oiseaux, passants rares | la rumeur se tasse, la pendule s'entend de nouveau |
| Fermeture (horloge arrêtée) | la rue du soir, presque vide | chaises retournées, balai, lave-vaisselle, pendule; plus de rumeur; la musique du café s'efface quand le bilan s'ouvre |
| Pluie | pluie sur la rue, gouttière, voitures sur le mouillé (ville, Paris), terrasse vide | pluie sur les vitrines; à l'entrée, parapluies secoués et paillasson; à la maison, la pluie sur la verrière, le son le plus douillet du jeu |
| Orage d'été | tonnerre lointain et sourd, jamais de claquement; averse | comme la pluie |
| Hiver | rue plus feutrée, rouge-gorge, corneilles au loin, pelle à neige du voisin le matin (village) | poêle à bois (village, bourg) ou radiateurs qui tiquent (ville, Paris); un souffle froid à chaque entrée; manteaux |
| Neige | tout s'assourdit: nappe -4 dB et passe-bas 3 kHz, événements deux fois plus rares, pas feutrés sur la terrasse | comme l'hiver |
| Été | porte ouverte (proposition), martinets, terrasse pleine | glaçons, blender, ventilateur de plafond s'il y en a un |
| Jour de marché (bourg, ville, Paris) | à l'aube on monte les étals; puis rumeur du marché sans mots, balance, sacs en papier, cageots, auvent, pelle dans la glace pilée; l'orgue de Barbarie au coin (musique placée, 8.4.6) | plus de monde le matin, paniers posés au sol |
| Sortie d'école | cloche à main au loin, enfants qui passent (pas qui courent, trottinettes, ballon, rumeur claire sans mots) | des familles entrent, une poussette |
| Brunch du week-end | la rue du dimanche, cloches (village, Paris) | couverts, on trinque, plus de monde à table |
| Jour de fermeture | la rue du jour; la pancarte reste sur « Fermé »; à la brocante, si elle est un lieu, la rumeur sans mots du plein air et les objets qu'on manipule (bois, porcelaine, cuivre) | café vide: pendule, réfrigérateur, vos pas; la musique si on l'allume; les travaux |
| Fête | fanions au vent, fanfare qui passe (si le game designer garde une fête locale), applaudissements | la fête de la maison (8.4.6) |

### 8.3.4 Porte ouverte, porte fermée, terrasse

- **Dedans**, le dehors (nappe et événements) sort des ouvertures: la porte d'entrée et chaque vitrine sont des sources placées. Vitrine: passe-bas 1,2 kHz, -14 dB. Porte fermée: valeur de l'adresse (tableau 8.3.2). Porte ouverte: ni filtre ni atténuation; le filtre s'ouvre en 0,25 s et se referme 0,4 s après le loquet.
- **Chaque client qui entre** tient la porte ouverte environ 1,5 s: la clochette, la rue et, l'hiver, un souffle froid entrent avec lui. Ce bref éclat de rue dit « quelqu'un entre » sans qu'on regarde.
- **L'été**, la porte reste ouverte si le game designer le retient: la rue est alors présente en permanence par la porte.
- **Dehors** (terrasse, trottoir), la nappe joue sans filtre, non placée et doublée à gauche et à droite; les événements restent placés dans la rue. Le café s'entend par la porte et les vitrines: passe-bas 2 kHz, -8 dB (porte ouverte: -3 dB). Les signaux (clochette, four, sonnette du comptoir) gardent leur plancher: on les entend de la terrasse.
- **D'un espace à l'autre** du café (salle, cuisine ou laboratoire, réserve, seconde salle, étage), un son passe par la porte qui les relie: passe-bas 1,5 kHz, -8 dB porte ouverte, -14 dB porte fermée. Aucun son ne traverse un mur sans passer par une ouverture.

### 8.3.5 Acoustique et décoration

- Chaque adresse a une réverbération de salle vide (tableau 8.3.2). Ce qui absorbe (tapis, rideaux, banquettes, coussins, plantes, étagères garnies) la raccourcit jusqu'à 35 % et baisse la rumeur jusqu'à 3 dB; les surfaces dures (carrelage nu, miroirs, zinc, briques) la gardent vive. Un café meublé avec soin sonne plus chaud et plus calme: le son récompense la décoration sans règle de plus. Proposition au game designer, s'il le souhaite: un critère « acoustique » dans le confort.
- Une seule réverbération pour l'intérieur (`ConvolverNode`), réponse impulsionnelle calculée au chargement (bruit filtré à décroissance exponentielle, graine fixe): aucun fichier. Elle suit la décoration à l'ouverture suivante, ou en fondu de 1 s si la décoration change pendant le service.
- Part envoyée à la réverbération: gestes 20 %, clients 30 %, signaux 25 %, appareil de musique 25 %; un son lointain y envoie davantage (le direct baisse avec la distance, pas la réverbération).

### 8.3.6 La rumeur de la salle

- **Sans mots.** Un souffle de salle filtré entre 150 Hz et 1,5 kHz, modulé au rythme de la parole (3 à 6 Hz) par phrases de 1 à 3 s, en alternance entre deux « interlocuteurs » de couleurs différentes, avec les tasses et les cuillères de la table. Aucune voyelle, aucune consonne, aucune hauteur de voix: l'impression d'une conversation à quelques mètres, pas une conversation. C'est le principe déjà livré pour la terrasse du café de La Petite Ligne (`cafe-terrace`).
- **Elle vient des tables.** Chaque table où sont assis au moins deux clients joue une boucle de conversation (`murmur-table`, quatre variantes, départ tiré, vitesse ±5 %), placée à la table; les six tables les plus proches sont jouées une à une. Un client seul ne converse pas: on n'entend que ses objets (journal, ordinateur, tasse). Au-delà des six tables, une nappe de salle (`murmur-room`) représente tout le monde.
- **Elle suit le nombre de clients.** Par table: 2 clients -3 dB, 3 ou 4 clients 0 dB, 5 et plus +2 dB. Nappe de salle: muette sous 10 clients, puis +3 dB à chaque doublement, plafonnée à 40 clients (-33 LUFS intégrés).
- **Elle ne couvre jamais les gestes.** Toute la rumeur ensemble reste sous -28 LUFS en sonie momentanée, réglages par défaut. Elle s'efface de 3 dB pendant tes sons de priorité 1 et 2 (attaque 60 ms, retour 700 ms). Son spectre tombe au-dessus de 1,5 kHz (12 dB par octave), quand les tintements, la vapeur et les clochettes vivent entre 2 et 6 kHz.
- **Elle a une humeur.** Plus vive au brunch et chez les étudiants (modulation plus rapide), plus feutrée le matin et chez les télétravailleurs; elle retient son souffle quand le guide goûte (-8 dB en 2 s).
- Dehors, la terrasse reprend les mêmes boucles, filtre plus ouvert et sans réverbération de salle.

### 8.3.7 Fichiers des ambiances

Les colonnes sont celles des tableaux de la section 8.5 (conventions en 8.5.0).

Dossier: `adresses/<adresse>/` (décodé avec l'adresse du jour).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Nappe du dehors | `ext-village`, `ext-bourg`, `ext-ville`, `ext-paris-quartier`, `ext-paris-maison` | boucle 12 s par adresse | -34 int. (dehors) | 4 | départ tiré | ambiance |
| Événements du dehors (tableau 8.3.2) | `ext-<adresse>-<événement>` | 10 × 2 s par adresse | -30 à -38 | 4 | sans répétition, ±4 %, 3 à 15 s entre deux | placés dans la rue |
| La pièce: souffle de la salle vide | `room-<adresse>` | boucle 6 s par adresse | -48 int. | 4 | départ tiré | non placé |
| Pendule: le tic-tac | `clock-tick-<adresse>` | boucle 2 s par adresse | -44 int. | 4 | | placé, réf. 1 m, coupé à 6 m |
| Pendule: midi et la dernière heure du service (quatre notes, aucun carillon connu) | `clock-chime-<adresse>` | 1 × 3 s par adresse, 32 kHz | -23 | 2 | hauteur fixe | signal |

Dossier: `base/salle/` (toujours décodé).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Rumeur d'une table: conversation sans mots, avec ses tasses | `murmur-table` | 4 × boucle 6 s | -36 int. | 4 | départ tiré, ±5 % | placé à la table, réf. 1,5 m, coupé à 14 m |
| Nappe de salle (au-delà des six tables les plus proches) | `murmur-room` | boucle 10 s | -33 int. au plus fort | 4 | jouée deux fois, à gauche et à droite, décalée de 5 s | non placé |

Dossier: `moments/pluie/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Pluie dans la rue | `rain-street` | boucle 8 s | -32 int. (dehors) | 4 | départ tiré | ambiance |
| Pluie sur les vitrines, du dedans | `rain-glass` | boucle 8 s | -37 int. | 4 | départ tiré | placé aux vitrines |
| Pluie sur la verrière (maison, verrières de l'atelier) | `rain-roof` | boucle 8 s | -35 int. | 4 | départ tiré | non placé, au-dessus |
| Gouttière | `gutter-loop` | boucle 4 s | -40 int. | 4 | | placé à la descente |
| Premières gouttes sur la vitrine | `rain-start` | 1 × 2,5 s | -31 | 3 | | placé aux vitrines |
| Gouttes isolées, fin d'averse | `drops` | 3 × 0,4 s | -35 | 4 | ±6 % | placé |
| Voiture sur le mouillé (ville, Paris) | `wet-car` | 2 × 2,5 s | -33 | 4 | ±4 % | placé dans la rue |

Dossier: `moments/orage/` (les jours d'orage d'été, avec la pluie).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Tonnerre lointain, sourd, jamais de claquement | `thunder-far` | 2 × 5 s | -30 | 3 | ±3 % | non placé |

Dossier: `moments/hiver/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Un souffle froid à chaque entrée | `door-draft` | 2 × 1,2 s | -34 | 4 | ±4 % | placé à la porte |
| Radiateurs qui tiquent (ville, Paris) | `radiator-tick` | 3 × 0,25 s | -38 | 4 | ±5 %, 8 à 30 s entre deux | placé aux radiateurs |
| Pas dans la neige (terrasse, dehors) | `step-snow` | 4 × 0,3 s | -31 | 4 | ±6 % | placé aux pieds |
| Pelle à neige du voisin, le matin (village) | `snow-shovel` | 1 × 2,5 s | -33 | 4 | | placé dans la rue |
| Rafale contre la vitrine (automne, hiver) | `wind-gust` | 2 × 2,5 s | -34 | 4 | ±4 % | placé aux vitrines |

Dossier: `moments/ete/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Grillons du soir (village, bourg) | `crickets` | boucle 8 s | -38 int. | 4 | départ tiré | ambiance |

Dossiers: `moments/marche/`, `moments/ecole/`, `moments/fete/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| À l'aube, on monte les étals | `market-setup` | 1 × 5 s | -31 | 4 | | placé dehors |
| Rumeur du marché, sans mots | `market-bed` | boucle 12 s | -34 int. | 4 | départ tiré | ambiance |
| Balance, sac en papier, cageot, auvent, pelle dans la glace pilée | `market-<objet>` | 6 × 1 s | -30 à -34 | 4 | sans répétition, ±4 % | placés au marché |
| Un panier posé au sol dans le café | `basket-set` | 2 × 0,4 s | -27 | 3 | ±4 % | client |
| Cloche à main de l'école, au loin | `school-bell` | 1 × 2 s | -31 | 3 | | placé au loin |
| Enfants qui passent (pas qui courent, trottinettes, ballon, rumeur claire sans mots) | `children-pass` | 2 × 5 s | -30 | 3 | ±3 % | placé dans la rue, en mouvement |
| Fanions et guirlandes au vent | `bunting-loop` | boucle 4 s | -38 int. | 4 | | ambiance |
| Applaudissements (petit groupe, salle entière) | `applause` | 2 × 3 s | -24 | 2 | ±2 % | non placé |
| Bouchon de cidre ou de crémant | `cork-pop` | 2 × 0,4 s, 32 kHz | -23 | 2 | ±4 % | geste |
| On trinque à plusieurs | `glasses-clink` | 2 × 0,7 s, 32 kHz | -25 | 3 | ±3 % | client |

Dossier: `postes/decor/` (décodé si l'objet est dans le café).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Poêle à bois (village et bourg l'hiver; objet de décor campagne ou nordique ailleurs) | `stove-loop` | boucle 6 s | -38 int. | 4 | départ tiré | placé, réf. 1 m, coupé à 10 m |
| Une bûche claque | `stove-pop` | 3 × 0,3 s | -30 | 4 | ±5 %, 10 à 40 s entre deux | placé au poêle |
| Porte du poêle, bûche ajoutée | `stove-door` | 1 × 0,8 s | -27 | 3 | ±3 % | geste |
| Ventilateur de plafond (décor rétro ou bistrot) | `ceiling-fan-loop` | boucle 3 s | -42 int. | 4 | | placé, réf. 1,5 m, coupé à 8 m |
| Fontaine d'intérieur (décor jardin) | `fountain-loop` | boucle 4 s | -40 int. | 4 | départ tiré | placé, réf. 1 m, coupé à 8 m |
| Carillon à vent de la terrasse (décor jardin), accordé en do pentatonique | `wind-chime` | 3 × 2 s, 32 kHz | -32 | 4 | hauteur fixe, 6 à 20 s entre deux | placé |

## 8.4 Musique

### 8.4.1 La musique sort d'un appareil

- Pendant la journée, aucune musique ne vient « d'en haut »: elle sort d'un appareil du café, à sa place (`PannerNode`), avec le son de cet appareil. On l'allume, on l'éteint, on choisit ce qu'elle joue, on règle son volume (trois crans). Elle passe par le bus Musique: le curseur Musique de Duo la règle et la coupe, chez chacun.
- Elle compte dans l'ambiance (cadrage, 4.6) et dans les goûts des profils (8.4.3). Le game designer en fixe les règles; ce document fournit les listes, leurs couleurs et une proposition d'affinités.
- Une musique hors du monde ne joue que sur les écrans (titre, bilan du soir) et pour les moments rares (airs), section 8.4.6.

### 8.4.2 Les appareils, d'adresse en adresse

| Adresse | Appareil (proposition) | Ce qu'on choisit | Son de l'appareil | Gestes |
|---|---|---|---|---|
| `village` | le poste de radio de l'ancienne patronne, sur l'étagère derrière le comptoir | deux stations, une douce et une entraînante, qui mêlent les six listes (8.4.4) | mono, 180 Hz à 5 kHz, bosse de 3 dB à 1,2 kHz, compression 3:1, souffle entre deux morceaux | allumer, éteindre, changer de station, volume |
| `bourg` | un tourne-disque valise, puis un électrophone en meuble | un disque par liste (six disques): face A posée, face B allante | valise: mono, 90 Hz à 8 kHz; électrophone: stéréo étroite (0,6 m), 60 Hz à 11 kHz; craquements du vinyle, sillon de sortie | poser le disque et le bras, retourner, ranger |
| `ville` | une platine et deux paires d'enceintes, une par salle | une liste par salle (proposition: une salle calme, une salle animée), ou les deux mêlées | stéréo, 45 Hz à 15 kHz, craquements très discrets | boutons, volume |
| `paris-quartier` | une sonorisation de salle (enceintes au plafond et en terrasse) | toutes les listes, programmées par moment de la journée sur la tablette | stéréo, pleine bande, répartie dans chaque espace (non placée) | tablette |
| `paris-maison` | la même, par espace, plus des musiciens à l'estrade pour la fête | comme au quartier, plus la fête (8.4.6) | comme au quartier; les musiciens sont placés à l'estrade | tablette |

- L'appareil s'acquiert comme un meuble (catalogue, brocante), et la maison garde ses disques d'une adresse à l'autre: on n'achète pas deux fois la même musique (proposition au game designer).
- Le son de l'appareil est un traitement en direct (filtres, compression, passage en mono): chaque morceau n'existe qu'une fois, dans sa meilleure qualité.
- Volume de l'appareil: bas -6 dB, moyen (par défaut), fort +4 dB. Au volume moyen, à 3 m de l'appareil, la musique arrive vers -29 LUFS intégrés: un fond, sous les gestes et sous vos voix.

### 8.4.3 Les six listes

Une liste par style de décoration du cadrage (4.5).

| Liste (style) | Genre | Instruments (banque FluidR3_GM) | Ce qui la distingue | Aimée par (proposition) | Va bien |
|---|---|---|---|---|---|
| « Les Prés » (`campagne`) | bal folk acoustique: valses lentes, mazurkas, scottishs, bourrées | violon (Fiddle), mandoline, guitare folk (Steel String Guitar), flûte à bec, contrebasse, tambourin | danses qui tournent, cordes pincées et frottées, aucun clavier ni accordéon | flâneurs, familles, promeneurs | matin, après-midi, terrasse |
| « Le Zinc » (`bistrot`) | valse musette et swing à la pompe | accordéon (Italian Accordion), clarinette, guitare en pompe, contrebasse | l'accordéon et la guitare qui pompe; la plus mineure des listes | pressés, flâneurs, gourmands, touristes (promeneurs en ville) | midi, coup de feu |
| « Bois clair » (`nordique`) | piano feutré et musique de chambre lente | piano joué doucement, violoncelle, harmonium (Reed Organ), contrebasse à l'archet, guitare nylon, glockenspiel discret | lente, aérée, sans batterie: la plus calme | télétravailleurs, étudiants, connaisseurs, flâneurs | matin, pluie, fermeture |
| « Serre » (`jardin`) | bossa nova et samba douce | guitare nylon, flûte, vibraphone, contrebasse, shaker et bord de caisse (batterie Brush) | le balancement brésilien, lumineux | familles, gourmands, bruncheurs | après-midi, brunch, été |
| « Établi » (`atelier`) | jazz feutré et hip-hop instrumental lent, aux balais | piano électrique (Rhodes EP), guitare jazz, contrebasse, balais (batterie Brush), souffle de bande | tempo lent et régulier, accords de neuvième: on y travaille | étudiants, télétravailleurs, connaisseurs | après-midi, jours studieux |
| « Juke-box » (`retro`) | cha-cha, twist et slow des années cinquante et soixante | orgue (DrawbarOrgan), saxophone ténor, guitare claire à trémolo, contrebasse, batterie (Jazz), piano | la plus enjouée: orgue et saxophone | pressés, familles, gourmands, bruncheurs | midi, week-end |

- Chaque liste plaît à trois ou quatre profils, et les profils changent avec l'heure: un duo attentif change de disque dans la journée. C'est le meilleur remède contre la lassitude, et une raison de jeu de le faire.
- Une liste qui suit le style de la décoration ajoute à la cohérence de l'ambiance; le silence est un choix (une radio éteinte ne pénalise pas, et les télétravailleurs l'apprécient): propositions au game designer.
- Genres et instruments sont des styles, jamais des imitations: aucun air, aucun arrangement, aucun artiste reconnaissable.
- Toutes les banques citées ont été vérifiées dans `FluidR3_GM.sf2` (en-têtes des préréglages): Fiddle (0:110), Mandolin (16:25), Italian Accordion (8:21), Reed Organ (0:20), Rhodes EP (0:4), DrawbarOrgan (0:16), batteries Brush (128:40) et Jazz (128:32).

### 8.4.4 Les 24 morceaux de la version 1

Quatre morceaux par liste: deux posés, deux allants. La station douce de la radio joue les douze morceaux posés, l'entraînante les douze allants; un disque met les posés en face A et les allants en face B.

| Liste | N° | Titre de travail | Énergie | Mesure, tempo | Tonalité | Durée | En tête |
|---|---|---|---|---|---|---|---|
| `campagne` | 1 | « Rosée » | posé | 3/4, noire à 126 (valse lente) | sol majeur | 2 min 40 | violon, guitare folk |
| `campagne` | 2 | « Chemin creux » | posé | 3/4, noire à 120 (mazurka) | ré dorien | 2 min 30 | flûte à bec, mandoline |
| `campagne` | 3 | « Le pré d'en bas » | allant | 4/4, noire à 112 (scottish) | sol majeur | 2 min 20 | violon et flûte à l'unisson, tambourin |
| `campagne` | 4 | « Les foins » | allant | 3/8, noire pointée à 104 (bourrée) | do majeur | 2 min 20 | violon, mandoline, contrebasse |
| `bistrot` | 1 | « Petit noir » | posé | 3/4, noire à 150 (valse musette lente) | la mineur | 2 min 45 | accordéon, guitare en pompe |
| `bistrot` | 2 | « Pluie sur le zinc » | posé | 4/4, noire à 84 (swing lent) | ré mineur | 2 min 40 | clarinette, guitare, contrebasse |
| `bistrot` | 3 | « Comptoir » | allant | 3/4, noire à 192 (valse musette vive) | mi mineur, puis sol majeur | 2 min 20 | accordéon, clarinette |
| `bistrot` | 4 | « Le garçon pressé » | allant | 4/4, noire à 168 (swing à la pompe) | la mineur | 2 min 20 | guitare soliste, accordéon |
| `nordique` | 1 | « Premier café » | posé | 3/4, noire à 72 | fa lydien | 2 min 50 | piano, violoncelle |
| `nordique` | 2 | « Givre » | posé | 4/4, noire à 66 | ré dorien | 2 min 50 | piano, harmonium, contrebasse à l'archet |
| `nordique` | 3 | « Lumière basse » | allant | 6/8, noire pointée à 64 | la mineur | 2 min 30 | guitare nylon arpégée, piano, glockenspiel |
| `nordique` | 4 | « Brindilles » | allant | 4/4, noire à 104 | do majeur | 2 min 30 | piano, pizzicati, guitare nylon |
| `jardin` | 1 | « Monstera » | posé | 4/4, noire à 112 (bossa lente) | fa majeur | 2 min 40 | guitare nylon, flûte |
| `jardin` | 2 | « Arrosoir » | posé | 4/4, noire à 120 (bossa) | ré mineur | 2 min 40 | vibraphone, guitare nylon |
| `jardin` | 3 | « Véranda » | allant | 2/4, noire à 132 (samba douce) | do majeur | 2 min 20 | flûte, piano, shaker |
| `jardin` | 4 | « Pamplemousse » | allant | 4/4, noire à 138 (bossa vive) | sol mixolydien | 2 min 20 | flûte et vibraphone en tierces |
| `atelier` | 1 | « Copeaux » | posé | 4/4, noire à 76, doubles croches balancées | ré dorien | 2 min 30 | piano électrique, contrebasse, balais |
| `atelier` | 2 | « Sciure » | posé | 4/4, noire à 70 | la mineur | 2 min 40 | guitare jazz, piano électrique |
| `atelier` | 3 | « Établi » | allant | 4/4, noire à 88 | mi mineur | 2 min 30 | piano électrique, guitare jazz, balais |
| `atelier` | 4 | « Rabot » | allant | 4/4, noire à 92 | do majeur | 2 min 30 | guitare jazz en octaves, piano électrique |
| `retro` | 1 | « Milk-shake » | allant | 4/4, noire à 120 (cha-cha) | do majeur | 2 min 20 | orgue, saxophone ténor |
| `retro` | 2 | « Banquette » | posé | 12/8, noire pointée à 60 (slow) | sol majeur | 2 min 40 | saxophone ténor, guitare à trémolo |
| `retro` | 3 | « Néon » | allant | 4/4, noire à 144 (twist) | do majeur | 2 min 10 | guitare claire, orgue, batterie |
| `retro` | 4 | « Formica » | posé | 4/4, noire à 92 (ballade) | fa majeur | 2 min 30 | piano, orgue, guitare |

- Durée totale: 60 min 25 s, soit environ 10 min par liste. Fichiers `musique/listes/<liste>-<n°>.opus`.
- Plus tard, si le client le souhaite: un second volume de deux morceaux par liste (12 morceaux, environ 30 min, 9 Mo), dans une mise à jour.

### 8.4.5 Lecture

- **Des morceaux finis, pas de boucle.** Chaque morceau a une introduction et une vraie fin (la réverbération s'éteint): aucun raccord à cacher. Entre deux morceaux, 2 à 4 s: le souffle de la radio, le sillon du disque.
- **Ordre.** Station de radio: tirage sans répétition, un morceau ne revient pas avant que la moitié de la station soit passée. Disque: l'ordre de la face (deux morceaux, environ 5 min), puis le sillon de sortie (quatre tours), le bras se relève, et le silence jusqu'à ce qu'on retourne le disque: un repos naturel de la musique, et une information (« le disque est fini »). Platine et sonorisation: lecture au hasard parmi les listes choisies, même règle que la radio.
- **En flux.** Les morceaux sont lus en flux par un élément média branché sur Web Audio, comme `playMusic` du SDK, jamais décodés en entier: environ 1 Mo de mémoire par flux. Vérifié ici dans Chromium (Playwright), sur un Ogg Opus stéréo à 48 kbit/s: lecture en flux par `createMediaElementSource`; décodage à la longueur exacte à 48 et à 44,1 kHz (576 000 et 529 200 échantillons pour 12 s); vitesse de lecture suivie (1,01 demandé, 1,0096 mesuré; 0,99 demandé, 0,9908 mesuré, sur 6 s).
- **Synchronisés sur les deux machines.** Les deux ordinateurs jouent la même radio dans la même pièce: un décalage de plus de quelques dizaines de millisecondes s'entendrait comme un écho, puis comme un canon. L'hôte choisit le morceau et son instant de départ sur l'horloge commune de la liaison; chaque machine démarre à cet instant, compare toutes les 2 s sa position à la position attendue et corrige l'écart par la vitesse de lecture (±1 % au plus, hauteur préservée par `preservesPitch`), jamais par un saut. Écart visé: 20 ms, 30 ms au plus (au-delà, l'oreille sépare les deux haut-parleurs et entend un écho sur les attaques), latence de sortie de chaque machine comprise (`outputLatency`). Le SDK actuel ne programme ni le départ ni la position d'un flux (`playMusic` part tout de suite, sans position): à prévoir avec l'architecte (8.11). À vérifier sur les deux vraies machines (8.10).
- **Changer de musique** (station, disque, liste) est un événement de la simulation: les deux machines changent au même instant, avec le même son d'appareil.
- **Fondus.** Allumer: la musique monte en 1 s (le poste chauffe). Éteindre: coupure après le déclic (c'est un appareil). Fermeture: la musique du café s'efface en 4 s quand le bilan s'ouvre.
- **Pause de Duo**: règle de la plateforme (musique baissée de 10 dB sous un passe-bas à 1,2 kHz); l'appareil continue, en phase sur les deux machines.

### 8.4.6 Musiques d'écrans et de moments

| Moment | Titre de travail | Écriture | Durée | Lecture |
|---|---|---|---|---|
| Écran titre, choix de l'adresse, personnalisation de la maison | « Notre maison » | valse lente à 3/4, noire à 120, fa majeur: piano droit, guitare nylon, contrebasse, accordéon discret, balais; le motif de la maison | 2 min 00 | flux; fin réelle, reprise après 8 s de silence (aucun raccord) |
| Bilan du soir | « La caisse est faite » | 4/4, noire à 66, fa majeur: piano, violoncelle, guitare nylon; le motif ralenti | 1 min 30 | flux, une fois par soir, puis l'ambiance du soir (pendule, rue) |
| Déménagement | « Les cartons » | 2/4, noire à 104, do majeur: clarinette, pizzicati, glockenspiel, piano | 45 s | flux, sur la séquence du départ |
| La fête de la maison, fin de la grande maison parisienne | « Tous nos habitués » | bal (valse puis java): accordéon, guitare, contrebasse, piano, clarinette, balais; chaque habitué présent est cité par son motif, quatre mesures chacun; fin sur « Notre maison » en entier | 3 min 30 | flux, placé à l'estrade des musiciens |
| Jour de marché | « La place », orgue de Barbarie | valse, do majeur: Calliope Lead, Reed Organ, glockenspiel | 1 min 00 | flux, placé au coin du marché, repris après 20 à 40 s |
| Fête locale (si le game designer en garde une par adresse) | « La clique », fanfare | marche à 2/4, sol majeur: trompette, trombone, tuba, caisse claire | 45 s | flux, placé, la fanfare passe dans la rue |
| Airs: ouverture et fermeture du service, nouvelle adresse, première ouverture, guide, saisons | | brefs, en do pentatonique (8.5.18 et 8.5.19) | 2 à 10 s | décodés à la demande |

Niveau de lecture des écrans: le fichier est à -16 LUFS intégrés et joué 5 dB plus bas, soit le niveau du salon de Duo (-21 LUFS): on passe de l'un à l'autre sans saut.

### 8.4.7 Fabrication

- Partitions décrites en données, écrites en MIDI par le code (mido), un fichier par morceau versionné dans `assets-src/son/midi/`.
- Contrôle d'écriture bloquant avant le rendu: aucune seconde mineure, septième majeure ni triton tenus plus de 0,75 temps entre deux pistes hors des notes de l'accord (outil de La Petite Ligne).
- Rendu par FluidSynth avec la banque FluidR3_GM, piste par piste, réverbération et chorus internes coupés, sortie flottante; mélange par la mesure de sonie relative de chaque piste; correction d'aigus de la banque (sombre au-dessus de 3 kHz); réverbération par convolution; pedalboard pour l'égalisation, une compression douce et le limiteur.
- Normalisation à -16 LUFS intégrés, crête vraie sous -1 dBTP (filtre `ebur128` de ffmpeg sur le fichier décodé), puis Opus stéréo à 40 kbit/s en débit variable contraint (`-c:a libopus -b:a 40k -vbr constrained`, métadonnées retirées, encodage reproductible). Morceaux finis: la queue de réverbération reste à la fin, rien à replier.
- Pourquoi 40 kbit/s, mesuré ici sur un extrait de 38 s rendu par FluidR3 (piano, guitare nylon, contrebasse, flûte, balais): l'énergie de chaque octave, de 125 Hz à 12 kHz, reste à 0,12 dB au plus de la source, et le débit réel est de 37,7 kbit/s. En débit variable libre, le même réglage dépassait sa consigne d'environ 18 % (48 kbit/s demandés, 56,8 obtenus): d'où le débit contraint, qui rend le poids prévisible. La mesure par octave ne voit pas tous les défauts de codage: deux morceaux sont à comparer à l'oreille chez le client (8.10); s'il entend une différence sur la sonorisation de Paris, on passe à 48 kbit/s (environ 4 Mo de plus).
- La banque FluidR3_GM (licence MIT) figure déjà dans `CREDITS.md` pour La Petite Ligne; une ligne pour les fichiers de Cosy Café s'y ajoute dès la première musique livrée. Aucune autre ressource externe n'est prévue: tous les effets et ambiances sont synthétisés par le studio.

## 8.5 Événements sonores

### 8.5.0 Conventions

- **Niveau**: sonie momentanée maximale visée, en LUFS, mesurée par `ebur128` sur le fichier décodé; sonie intégrée (« int. ») pour une boucle.
- **Prio.** (priorité): 1 critique (information hors de la vue, moment partagé: jamais coupé, plancher de niveau); 2 important (tes gestes, signaux des machines, tickets, réactions marquantes); 3 courant (gestes de l'autre et des employés, objets des clients proches); 4 discret (pas, tics, machines au repos).
- **Variations**: « ±4 % » porte sur la hauteur et la durée (`playbackRate`), « ±1 dB » sur le niveau; « hauteur fixe » désigne un son accordé, jamais transposé. Variante et hauteur se tirent à partir de l'identifiant de l'événement de la simulation: les deux machines jouent exactement le même son (8.6.2), et la même variante ne revient pas deux fois de suite. Les sons d'interface, propres à chaque machine, tirent au hasard.
- **Fichiers**: nombre de variantes × durée (queue comprise), mono sauf « st. » (stéréo). Décodés à 24 kHz, ou à 32 kHz quand le tableau l'indique: les sons clairs (porcelaine, verre, laiton, monnaie), l'interface, les airs et les motifs. Une boucle porte en plus 0,25 s d'amorce de chaque côté. Le pourquoi est en 8.8.
- **Dossier**: chaque tableau dit où vont ses fichiers, donc quand ils sont décodés (8.8.1).
- **Écoute**:

| Écoute | Réglage |
|---|---|
| geste | placé à l'objet ou aux mains; distance de référence 1 m, coupé au-delà de 12 m; vers un autre espace, passe par la porte (8.3.4) |
| client | placé au client; réf. 1,5 m; pas lancé au-delà de 10 m ni dans un autre espace (la rumeur le représente) |
| signal | placé; réf. 3 m; plancher -7 dB: on l'entend dans toute l'adresse, réserve et terrasse comprises |
| ambiance | aux ouvertures et dans la rue (8.3.4) |
| non placé | stéréo, au centre: interface, airs, tablette |

Les sons de l'autre joueur et des employés sont les mêmes fichiers, placés à leur position, 3 dB plus bas et un cran de priorité en dessous.

### 8.5.1 Moulin, porte-filtre, extraction

Dossier: `postes/espresso/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Le moulin démarre | `grinder-start` | 2 × 0,4 s | -24 | 2 | ±3 %, ±1 dB | geste |
| Le moulin moud (tant qu'on maintient) | `grinder-loop` | boucle 1,5 s | -25 int. | 2 | ±2 % au départ | geste |
| La dose est faite: les grains ne craquent plus, le moteur s'allège (fondu de 0,3 s); aussi un moulin vide | `grinder-empty-loop` | boucle 1,5 s | -27 int. | 2 | ±2 % | geste |
| Le moulin s'arrête | `grinder-stop` | 2 × 0,6 s | -25 | 2 | ±3 %, ±1 dB | geste |
| Le levier du doseur (moulin du village) | `doser-clack` | 3 × 0,25 s | -24 | 2 | ±4 %, ±1 dB | geste |
| Tasser la mouture | `tamp` | 3 × 0,35 s | -25 | 2 | ±3 %, ±1 dB | geste |
| Fixer le porte-filtre | `portafilter-lock` | 2 × 0,5 s | -23 | 2 | ±3 %, ±1 dB | geste |
| Retirer le porte-filtre | `portafilter-unlock` | 2 × 0,4 s | -24 | 2 | ±3 %, ±1 dB | geste |
| Taper le marc dans le bac (sur la barre caoutchoutée: mat, jamais un claquement) | `knock-box` | 3 × 0,4 s | -22 | 2 | ±4 %, ±1 dB | geste |
| La pompe démarre | `pump-start` | 1 × 0,4 s | -25 | 2 | ±2 % | geste |
| L'extraction coule: le ruban | `extraction-loop` | boucle 2 s | -27 int. | 2 | | geste |
| L'extraction blondit: le filet s'amincit et crachote (fondu selon le temps d'extraction) | `extraction-thin-loop` | boucle 2 s | -28 int. | 2 | | geste |
| La pompe se tait, la vanne souffle (c'est aussi la fin d'une machine automatique) | `extraction-stop` | 2 × 0,8 s | -23 | 2 | ±2 %, ±1 dB | signal |
| Eau chaude de la machine (allongé, thé) | `hot-water-loop` | boucle 1,5 s | -28 int. | 3 | | geste |
| La machine au repos: souffle de la chaudière, déclic du pressostat de temps en temps | `espresso-idle-loop` | boucle 4 s | -42 int. | 4 | départ tiré | placé, réf. 1 m, coupé à 8 m |
| La machine chauffe le matin: remplissage, souffle, déclics | `espresso-warmup` | 1 × 6 s | -30 | 3 | | geste |
| Le café filtre goutte (café de spécialité, ville et Paris) | `filter-drip-loop` | boucle 2 s | -36 int. | 3 | | geste |

### 8.5.2 Lait et vapeur

Dossier: `postes/lait/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Purger la buse, avant et après | `steam-purge` | 2 × 0,8 s | -25 | 2 | ±3 %, ±1 dB | geste |
| Aérer: la buse affleure, « papier qu'on déchire » | `steam-aerate-loop` | boucle 2 s | -27 int. | 2 | vitesse selon la température (tableau suivant) | geste |
| Texturer: le roulement | `steam-roll-loop` | boucle 2 s | -28 int. | 2 | idem | geste |
| La cible: le pichet chante (sifflement de souffle sous 1,6 kHz, pas une note) | `steam-sing-loop` | boucle 2 s | -31 int. | 2 | idem | geste |
| Trop chaud: le souffle s'amincit, petits bouillons | `steam-hot-loop` | boucle 2 s | -29 int. | 2 | idem | geste |
| La buse automatique s'arrête d'elle-même à la température | `steam-auto-stop` | 1 × 0,5 s | -25 | 2 | ±2 % | signal |
| Poser le pichet | `pitcher-set` | 2 × 0,3 s, 32 kHz | -26 | 2 | ±4 %, ±1 dB | geste |
| Taper et faire tourner le pichet | `pitcher-tap` | 2 × 0,5 s | -27 | 3 | ±4 % | geste |
| Verser le lait de la bouteille dans le pichet | `milk-pour` | 1 × 1,2 s | -28 | 3 | ±3 % | geste |

La température se lit à l'oreille. Seuils supposés, à caler sur ceux du game designer:

| Température du lait | Ce qu'on entend | Mélange des boucles | Vitesse de lecture |
|---|---|---|---|
| 4 à 35 °C | l'aération: le papier qu'on déchire, par bouffées | aération de 100 à 50 %, roulement de 0 à 50 % | 1,00 à 1,05 |
| 35 à 58 °C | le roulement, plus grave et régulier | roulement 100 % | 1,05 à 1,12 |
| 58 à 65 °C (la cible) | le pichet chante, doucement | roulement 60 %, chant de 0 à 100 % | 1,12 à 1,16 |
| 65 à 72 °C | trop chaud: le chant s'efface, le souffle s'amincit, de petits bouillons | chant de 100 à 0 %, trop chaud de 0 à 100 % | 1,16 à 1,22 |
| 72 °C | la buse se coupe d'elle-même (proposition): `steam-auto-stop` | | |

Fondus à puissance constante, mis à jour à chaque image; aucune note ne détonne, ce sont des souffles. Avec l'aide (gestes simplifiés), le même déroulé joue en 3 s et s'arrête à la cible.

### 8.5.3 Service: tasses, versements, plateaux, salle

Dossier: `base/service/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Verser un liquide clair (eau, thé, café filtre) | `pour-thin-loop` | boucle 1,5 s | -30 int. | 2 | résonance qui monte avec le remplissage (tasse de 700 Hz à 1,8 kHz, verre de 500 Hz à 1,4 kHz) | geste |
| Verser un liquide épais (lait moussé, jus, chocolat) | `pour-thick-loop` | boucle 1,5 s | -30 int. | 2 | idem | geste |
| Dernières gouttes | `pour-end` | 2 × 0,4 s | -30 | 3 | ±5 %, ±1 dB | geste |
| Tasse posée sur sa soucoupe | `cup-saucer` | 4 × 0,35 s, 32 kHz | -24 | 2 | ±4 %, ±1 dB | geste |
| Tasse posée sur le comptoir ou une table | `cup-set` | 3 × 0,3 s, 32 kHz | -25 | 2 | ±4 %, ±1 dB | geste |
| Prendre une tasse | `cup-pick` | 2 × 0,2 s, 32 kHz | -31 | 4 | ±5 % | geste |
| Empiler les tasses sur la machine | `cups-stack` | 2 × 0,35 s, 32 kHz | -26 | 3 | ±4 % | geste |
| Verre posé | `glass-set` | 3 × 0,3 s, 32 kHz | -25 | 2 | ±4 %, ±1 dB | geste |
| Assiette posée (une part, une viennoiserie) | `plate-set` | 2 × 0,35 s, 32 kHz | -25 | 2 | ±4 %, ±1 dB | geste |
| Remuer à la cuillère | `spoon-stir` | 2 × 1 s, 32 kHz | -29 | 3 | ±5 % | geste |
| Cuillère posée sur la soucoupe | `spoon-set` | 2 × 0,3 s, 32 kHz | -28 | 3 | ±5 % | geste |
| Un sucre tombe dans la tasse | `sugar-drop` | 1 × 0,3 s | -33 | 4 | ±6 % | geste |
| Glaçons à la pelle dans le verre | `ice-scoop` | 2 × 0,6 s, 32 kHz | -26 | 2 | ±4 % | geste |
| Verser sur la glace (elle craque) | `ice-pour` | 2 × 1 s, 32 kHz | -27 | 2 | ±3 % | geste |
| Couverts sur l'assiette (brunch, gourmands) | `cutlery` | 3 × 0,5 s, 32 kHz | -29 | 3 | ±5 %, ±1 dB | client |
| Deux tasses ou deux verres trinquent | `toast-clink` | 2 × 0,5 s, 32 kHz | -26 | 3 | ±3 % | client |
| Plateau posé, chargé | `tray-set` | 3 × 0,5 s | -24 | 2 | ±4 %, ±1 dB | geste |
| Plateau soulevé | `tray-pick` | 2 × 0,4 s | -27 | 3 | ±4 % | geste |
| Débarrasser une table (la vaisselle sur le plateau) | `clear-table` | 3 × 0,7 s | -25 | 2 | ±4 %, ±1 dB | geste |
| Essuyer une table | `wipe` | 2 × 0,7 s | -29 | 3 | ±5 % | geste |
| Balayer (fermeture) | `broom` | 2 × 1 s | -30 | 3 | ±5 % | geste |
| Retourner les chaises sur les tables (fermeture) | `chairs-up` | 2 × 0,5 s | -26 | 3 | ±4 % | geste |
| Prendre la commande sur le carnet | `order-pad` | 2 × 0,5 s | -28 | 3 | ±5 % | geste |
| Poser un objet en bois | `place-wood` | 3 × 0,25 s | -29 | 3 | ±6 %, ±1 dB | geste |
| Poser un objet en métal | `place-metal` | 2 × 0,25 s | -29 | 3 | ±6 %, ±1 dB | geste |
| Poser un objet en papier ou en tissu | `place-paper` | 2 × 0,25 s | -31 | 3 | ±6 %, ±1 dB | geste |

### 8.5.4 Thé, eau chaude, jus, blender

Dossiers: `postes/the/` (thés et eau chaude), `postes/froid/` (jus, blender).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| La bouilloire chauffe | `kettle-loop` | boucle 2 s | -33 int. | 3 | | geste |
| L'eau est chaude: le déclic | `kettle-click` | 2 × 0,3 s | -25 | 2 | ±3 % | signal |
| Ouvrir une boîte à thé | `tea-tin` | 1 × 0,5 s | -27 | 3 | ±4 % | geste |
| Feuilles dans la théière | `tea-leaves` | 1 × 0,5 s | -31 | 3 | ±5 % | geste |
| Couvercle de la théière | `teapot-lid` | 2 × 0,3 s, 32 kHz | -27 | 3 | ±4 % | geste |
| Le thé a infusé, si le game designer garde une attente (le sablier, une petite clochette sur sol) | `tea-ready` | 1 × 0,8 s, 32 kHz | -24 | 2 | hauteur fixe | signal |
| Couper un agrume | `citrus-cut` | 2 × 0,35 s | -27 | 3 | ±5 % | geste |
| Le presse-agrumes tourne | `juicer-loop` | boucle 2 s | -29 int. | 2 | | geste |
| Le blender tourne: un vrombissement feutré, jamais strident (passe-bas à 4 kHz, aucun sifflement) | `blender-loop` | boucle 2 s | -28 int. | 2 | | geste |
| Le blender broie la glace, au départ | `blender-ice` | 1 × 1,5 s | -26 | 2 | ±3 % | geste |
| Le blender ralentit et s'arrête | `blender-stop` | 1 × 0,7 s | -27 | 2 | ±3 % | geste |
| Fouet dans un bol (chocolat chaud, pâtisserie) | `whisk` | 2 × 0,7 s | -29 | 3 | ±5 % | geste |

### 8.5.5 Four, pâtisserie, vitrine

Dossiers: `postes/four/` (à partir du bourg), `postes/patisserie/` (plan de travail, vitrine).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Ouvrir le four | `oven-open` | 2 × 0,7 s | -25 | 2 | ±3 %, ±1 dB | geste |
| Fermer le four | `oven-close` | 2 × 0,6 s | -24 | 2 | ±3 %, ±1 dB | geste |
| Enfourner une plaque | `oven-tray-in` | 2 × 0,6 s | -25 | 2 | ±4 % | geste |
| Défourner | `oven-tray-out` | 2 × 0,6 s | -25 | 2 | ±4 % | geste |
| Le four tourne (ventilation douce) | `oven-fan-loop` | boucle 2 s | -40 int. | 4 | | placé, réf. 1 m, coupé à 8 m |
| Remonter la minuterie mécanique | `timer-wind` | 1 × 0,8 s | -27 | 2 | ±3 % | geste |
| Le tic-tac de la minuterie | `timer-tick-loop` | boucle 1 s | -42 int. | 4 | | placé, réf. 0,5 m, coupé à 4 m |
| La fournée est prête: la sonnerie de la minuterie, adoucie (do, mi) | `oven-ready` | 1 × 1,6 s, 32 kHz | -19 | 1 | hauteur fixe | signal |
| Rappel, si personne ne défourne (une fois, plus doux) | `oven-reminder` | 1 × 1 s, 32 kHz | -23 | 2 | hauteur fixe | signal |
| Le pain chante en refroidissant (la croûte craquelle) | `bread-sing` | 1 × 3 s | -35 | 4 | | placé, réf. 0,8 m, coupé à 5 m |
| Pétrir | `dough-knead` | 2 × 0,8 s | -29 | 3 | ±5 % | geste |
| Rouleau à pâtisserie | `rolling-pin` | 1 × 1 s | -30 | 3 | ±4 % | geste |
| Couteau sur la planche | `knife-board` | 3 × 0,25 s | -27 | 3 | ±6 %, ±1 dB | geste |
| Batteur électrique (laboratoire) | `mixer-loop` | boucle 2 s | -30 int. | 3 | | geste |
| Fariner | `flour` | 1 × 0,4 s | -34 | 4 | ±6 % | geste |
| Couper une part de gâteau | `cake-cut` | 1 × 0,7 s | -28 | 3 | ±4 % | geste |
| Pince à pâtisserie | `tongs` | 2 × 0,2 s, 32 kHz | -28 | 3 | ±6 % | geste |
| Sac en papier, à emporter | `paper-bag` | 2 × 0,6 s | -27 | 3 | ±5 % | geste |
| Ouvrir la vitrine | `vitrine-open` | 1 × 0,5 s, 32 kHz | -27 | 3 | ±3 % | geste |
| Fermer la vitrine | `vitrine-close` | 1 × 0,4 s, 32 kHz | -26 | 3 | ±3 % | geste |

### 8.5.6 Plonge et lave-vaisselle

Dossiers: `postes/plonge/`, `postes/lave-vaisselle/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Ouvrir le robinet | `tap-on` | 1 × 0,3 s | -28 | 3 | ±4 % | geste |
| L'eau coule | `tap-loop` | boucle 2 s | -31 int. | 3 | | geste |
| Fermer le robinet | `tap-off` | 1 × 0,3 s | -28 | 3 | ±4 % | geste |
| Laver à la main (éponge, tasses dans l'eau) | `dish-wash` | 2 × 0,8 s | -29 | 3 | ±5 % | geste |
| Une tasse sur l'égouttoir | `dish-rack` | 3 × 0,3 s, 32 kHz | -27 | 3 | ±5 %, ±1 dB | geste |
| Ouvrir le lave-vaisselle | `dishwasher-open` | 1 × 0,7 s | -25 | 2 | ±3 % | geste |
| Fermer le lave-vaisselle: le cycle démarre | `dishwasher-close` | 1 × 0,8 s | -24 | 2 | ±3 % | geste |
| Glisser le panier | `dishwasher-rack` | 1 × 0,7 s | -26 | 3 | ±4 % | geste |
| Le cycle tourne (eau brassée) | `dishwasher-loop` | boucle 3 s | -39 int. | 4 | | placé, réf. 1 m, coupé à 8 m |
| Le cycle est fini: vidange, déclic | `dishwasher-done` | 1 × 1,3 s | -24 | 2 | | signal |
| La vapeur sort à l'ouverture après le cycle | `dishwasher-steam` | 1 × 1 s | -29 | 3 | ±3 % | geste |

### 8.5.7 Torréfaction (grande maison parisienne)

Dossier: `postes/torrefaction/`. Le premier crack est le repère du torréfacteur: un geste à l'oreille de fin de jeu.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Verser le café vert dans la trémie | `roaster-load` | 1 × 2 s | -26 | 2 | ±3 % | geste |
| Le tambour tourne, le brûleur souffle | `roaster-drum-loop` | boucle 3 s | -31 int. | 3 | | geste |
| Le premier crack: les grains éclatent comme du maïs qui saute | `roaster-crack` | 3 × 1,5 s | -27 | 2 | ±4 % | signal |
| Vider le tambour dans le bac de refroidissement | `roaster-drop` | 1 × 2,5 s | -23 | 2 | ±2 % | geste |
| Les bras brassent les grains qui refroidissent | `roaster-cool-loop` | boucle 3 s | -32 int. | 3 | | geste |

### 8.5.8 Caisse et pourboire

Dossier: `base/caisse/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Ouvrir le tiroir-caisse (bois, petite sonnette) | `till-open` | 2 × 0,7 s, 32 kHz | -23 | 2 | hauteur fixe, ±1 dB | geste |
| Fermer le tiroir | `till-close` | 1 × 0,4 s | -25 | 2 | ±3 % | geste |
| Pièces rendues ou reçues | `coins-hand` | 3 × 0,4 s, 32 kHz | -25 | 2 | ±4 %, ±1 dB | geste |
| Pièces rangées dans le tiroir | `coins-drawer` | 2 × 0,5 s, 32 kHz | -25 | 2 | ±4 % | geste |
| Un billet | `banknote` | 1 × 0,4 s | -30 | 3 | ±5 % | geste |
| Paiement par carte (terminal, à partir de la ville): un tapotement et une note douce (sol), aucun bip | `card-pay` | 1 × 0,6 s, 32 kHz | -24 | 2 | hauteur fixe | geste |
| Un client laisse un pourboire sur la soucoupe en partant | `tip-saucer` | 2 × 0,4 s, 32 kHz | -27 | 3 | ±4 % | client |
| Le pourboire tombe dans le bocal, qui sonne de plus en plus plein (trois états) | `tip-jar-1`, `tip-jar-2`, `tip-jar-3` | 2 × 0,7 s chacun, 32 kHz | -23 | 2 | ±3 %, ±1 dB | geste |
| Un gros pourboire (habitué ravi, commande parfaite) | `tip-big` | 1 × 1,2 s, 32 kHz | -22 | 2 | ±2 % | geste |

### 8.5.9 Porte, clochette, entrées

Dossier: `adresses/<adresse>/` (la porte et la clochette de l'adresse du jour).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Ouvrir la porte d'entrée (bois au village, vitrée au bourg et à Paris, d'atelier à la ville) | `door-open-<adresse>` | 2 × 0,7 s par adresse | -24 | 3 | ±3 %, ±1 dB | placé, réf. 2 m, coupé à 15 m |
| Fermer la porte d'entrée | `door-close-<adresse>` | 2 × 0,6 s par adresse | -24 | 3 | ±3 %, ±1 dB | placé, réf. 2 m, coupé à 15 m |
| La clochette de la porte: clochette de laiton sur ressort (village, mi), deux grelots (bourg, do et mi), carillon de trois tubes (ville, sol, la, do), cloche de laiton (quartier, la), carillon à deux tons (maison, mi puis do) | `door-bell-<adresse>` | 3 × 1,5 s par adresse, 32 kHz | -20 | 1 | hauteur fixe; relancée si un second client entre | signal |
| Porte battante de la cuisine, porte de la réserve | `door-inner-<adresse>` | 2 × 0,5 s par adresse | -28 | 3 | ±4 % | geste |

Dossier: `base/entree/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| S'essuyer les pieds sur le paillasson (pluie, neige) | `doormat` | 2 × 0,8 s | -30 | 4 | ±5 % | client |
| Secouer le parapluie et le fermer | `umbrella` | 2 × 1 s | -28 | 3 | ±4 % | client |
| Accrocher son manteau | `coat-hang` | 2 × 0,6 s | -30 | 4 | ±5 % | client |
| Le manteau qu'on enlève | `coat-rustle` | 2 × 0,5 s | -33 | 4 | ±5 % | client |
| La sonnette du comptoir: un client attend et personne n'est à la caisse (une fois par client, proposition) | `counter-bell` | 1 × 1 s, 32 kHz | -21 | 1 | hauteur fixe (la) | signal |

### 8.5.10 Livraison, réserve, froid

Les fournisseurs ont un visage (cadrage, 4.7): chacun a son bruit à lui.

Dossier: `matin/` (décodé à l'arrivée du matin, libéré à l'ouverture).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| On frappe à la porte: la livraison est là (préparation) | `delivery-knock` | 2 × 0,7 s | -21 | 1 | ±3 % | signal |
| La laitière: le casier de bouteilles | `milk-crate` | 1 × 1 s, 32 kHz | -24 | 2 | ±3 % | geste |
| Le boulanger: le panier d'osier, le papier | `bread-basket` | 1 × 0,9 s | -26 | 2 | ±3 % | geste |
| Le torréfacteur: le sac de jute, les grains qui glissent | `coffee-sack` | 1 × 1,1 s | -24 | 2 | ±3 % | geste |
| Le grossiste (Paris): le diable qui roule, les colis posés | `hand-truck` | 1 × 1,4 s | -24 | 2 | ±3 % | geste |
| La livraison en vélo cargo (Paris): sonnette, béquille, chaîne | `cargo-bike` | 1 × 1,6 s, 32 kHz | -22 | 2 | | placé dehors |
| Une camionnette s'arrête au loin, sa portière | `van-stop` | 1 × 2,5 s | -30 | 3 | | placé dans la rue |

Dossier: `base/reserve/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Un carton posé | `carton-set` | 3 × 0,4 s | -25 | 2 | ±5 %, ±1 dB | geste |
| Ouvrir un carton (les rabats, aucun ruban arraché) | `carton-open` | 2 × 0,5 s | -28 | 3 | ±5 % | geste |
| Une caisse en bois posée | `crate-set` | 2 × 0,4 s | -25 | 2 | ±4 % | geste |
| Ranger sur une étagère | `shelf-place` | 3 × 0,25 s | -28 | 3 | ±6 %, ±1 dB | geste |
| Un bocal posé (grains, sucre, thé) | `jar-set` | 2 × 0,3 s, 32 kHz | -27 | 3 | ±5 % | geste |
| Ouvrir le réfrigérateur (le joint, les bouteilles qui tintent) | `fridge-open` | 2 × 0,7 s, 32 kHz | -26 | 3 | ±3 % | geste |
| Fermer le réfrigérateur | `fridge-close` | 1 × 0,4 s | -25 | 3 | ±3 % | geste |
| Le réfrigérateur ronronne | `fridge-hum-loop` | boucle 3 s | -44 int. | 4 | départ tiré | placé, réf. 1 m, coupé à 6 m |
| La porte de la chambre froide (Paris) | `cold-room-door` | 1 × 0,9 s | -24 | 3 | ±3 % | geste |

### 8.5.11 Écrire: ardoise, tickets, tablette, livre d'or, carnets

Dossier: `base/ecrit/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| La craie: un caractère, pendant qu'on écrit la carte | `chalk-tick` | 4 × 0,08 s | -33 | 4 | ±6 %, ±1 dB; relancé, 35 ms au moins entre deux | geste |
| La craie: une ligne validée (un trait) | `chalk-stroke` | 3 × 0,35 s | -28 | 3 | ±5 % | geste |
| Effacer l'ardoise | `chalk-erase` | 2 × 0,7 s | -29 | 3 | ±5 % | geste |
| Sortir l'ardoise sur le trottoir | `slate-street-set` | 1 × 0,6 s | -25 | 2 | ±3 % | geste |
| Un nouveau ticket sur le rail: la pince, un petit tintement (la) | `ticket-new` | 2 × 0,5 s, 32 kHz | -23 | 2 | hauteur fixe, ±1 dB | signal |
| Prendre un ticket (il prend ta couleur) | `ticket-take` | 2 × 0,25 s | -27 | 3 | ±4 % | geste |
| Ticket terminé, piqué sur la pique | `ticket-done` | 2 × 0,25 s | -26 | 3 | ±4 % | geste |
| Ouvrir le livre d'or | `guestbook-open` | 1 × 0,8 s | -26 | 3 | ±2 % | geste |
| Tourner une page du livre d'or | `guestbook-page` | 3 × 0,4 s | -28 | 3 | ±5 % | geste |
| Un client écrit dans le livre d'or (le stylo sur le papier) | `guestbook-write` | 2 × 1,2 s | -32 | 4 | ±4 % | client |
| Tablette: réveil (deux notes feutrées, sol puis do) | `tablet-wake` | 1 × 0,5 s st., 32 kHz | -26 | 3 | | non placé |
| Tablette: toucher | `tablet-tap` | 3 × 0,06 s, 32 kHz | -33 | 4 | ±5 %; 40 ms au moins entre deux | non placé |
| Tablette: glisser | `tablet-swipe` | 2 × 0,25 s | -33 | 4 | ±5 % | non placé |
| Tablette: mise en veille | `tablet-sleep` | 1 × 0,35 s st., 32 kHz | -29 | 4 | | non placé |
| « Nos projets »: écrire un rêve | `project-write` | 1 × 1 s | -27 | 3 | ±4 % | non placé |
| Bon de commande aux fournisseurs: écrire, détacher la feuille | `order-form` | 2 × 0,7 s | -28 | 3 | ±5 % | non placé |
| Catalogue: tourner une page | `catalogue-page` | 2 × 0,35 s | -29 | 4 | ±5 % | non placé |
| Catalogue: commander (une signature, un « tok ») | `catalogue-buy` | 1 × 0,6 s st., 32 kHz | -23 | 2 | | non placé |

### 8.5.12 Aménager et porter à deux

Dossier: `base/amenagement/` (décodé en préparation, à la fermeture, le jour de fermeture, et dès qu'on ouvre le catalogue ou le placement pendant le service).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Soulever un meuble | `furniture-pick` | 2 × 0,4 s | -26 | 3 | ±4 % | geste |
| Poser un meuble en bois | `furniture-place-wood` | 3 × 0,5 s | -23 | 2 | ±4 %, ±1 dB | geste |
| Poser un meuble en métal | `furniture-place-metal` | 2 × 0,5 s | -24 | 2 | ±4 %, ±1 dB | geste |
| Poser un meuble garni (banquette, fauteuil) | `furniture-place-soft` | 2 × 0,5 s | -26 | 2 | ±4 %, ±1 dB | geste |
| Tourner un meuble | `furniture-rotate` | 2 × 0,25 s | -29 | 3 | ±6 % | geste |
| Pose impossible: un double « toc » feutré, sans mélodie | `furniture-refuse` | 2 × 0,35 s, 32 kHz | -25 | 2 | ±2 % | non placé |
| Ranger un meuble en réserve | `furniture-store` | 1 × 0,5 s | -27 | 3 | ±3 % | geste |
| Poser une plante (terre cuite, feuilles) | `plant-place` | 2 × 0,5 s | -25 | 3 | ±4 % | geste |
| Accrocher un cadre ou un miroir | `frame-hang` | 2 × 0,7 s | -24 | 3 | ±4 % | geste |
| Allumer une lampe (l'interrupteur, aucun bourdonnement) | `lamp-on` | 2 × 0,25 s | -27 | 3 | ±5 % | geste |
| Dérouler un tapis | `rug-lay` | 1 × 0,7 s | -27 | 3 | ±4 % | geste |
| Peindre au rouleau | `paint-roll` | 2 × 1 s | -28 | 3 | ±4 % | geste |
| Poser du papier peint (le papier, la brosse) | `wallpaper` | 1 × 1 s | -28 | 3 | ±4 % | geste |
| Poser un sol (lames, carreaux) | `floor-lay` | 2 × 0,8 s | -25 | 3 | ±4 % | geste |
| Tirer un rideau | `curtain` | 2 × 0,7 s | -28 | 3 | ±4 % | geste |

Dossier: `base/joueurs/` (le port à deux sert aussi aux grosses livraisons).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Saisir un bout d'un meuble lourd | `carry-grab` | 2 × 0,4 s | -25 | 2 | ±3 % | geste |
| Le meuble attend l'autre: deux petits coups sur le bois, toutes les 4 s | `carry-wait` | 2 × 0,4 s | -26 | 2 | ±3 % | signal |
| Soulever à deux: le bois craque, vos deux timbres ensemble | `carry-lift` | 1 × 0,8 s, 32 kHz | -22 | 2 | | geste |
| Porter à deux: le meuble craque au rythme des pas | `carry-creak` | 3 × 0,3 s | -29 | 3 | ±5 % | geste |
| Poser à deux | (`furniture-place-*`, +2 dB) | | | | | |

### 8.5.13 Les joueurs

Dossier: `base/joueurs/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Pas sur le bois (tes pas -35; ceux de l'autre, des clients et des employés -29 à 2 m) | `step-wood` | 4 × 0,25 s | -35 | 4 | ±6 %, ±1,5 dB | placé aux pieds, réf. 1,5 m, coupé à 12 m |
| Pas sur les carreaux et les tomettes | `step-tile` | 4 × 0,25 s | -35 | 4 | ±6 %, ±1,5 dB | idem |
| Pas sur la pierre et les pavés (dehors) | `step-stone` | 4 × 0,25 s | -35 | 4 | ±6 %, ±1,5 dB | idem |
| Pas sur un tapis | `step-rug` | 3 × 0,25 s | -37 | 4 | ±6 %, ±1,5 dB | idem |
| Prendre en main un objet léger | `pick-generic` | 2 × 0,15 s, 32 kHz | -31 | 4 | ±6 % | geste |
| Se passer un objet de la main à la main: un frôlement, vos deux timbres | `hand-off` | 1 × 0,5 s, 32 kHz | -25 | 2 | | geste |
| Faire signe: ton repère, la tasse frappée (sol, do) | `ping-self` | 1 × 0,9 s, 32 kHz | -19 | 1 | hauteur fixe | placé au repère, réf. 4 m, plancher -5 dB |
| Le repère de l'autre: le bol de bois, une octave plus bas | `ping-peer` | 1 × 0,9 s, 32 kHz | -19 | 1 | hauteur fixe | placé au repère, réf. 4 m, plancher -5 dB |
| Nouer son tablier (début de journée, employés compris) | `apron-tie` | 1 × 0,6 s | -30 | 4 | ±5 % | geste |

### 8.5.14 Les clients

Dossier: `base/clients/`. Ni mots ni charabia: un client parle avec ses objets et, quand il est content, par quelques notes de kalimba, l'instrument des clients. Un client déçu ne fait aucun son: il part plus tôt, laisse moins de pourboire, et le dit dans le livre d'or. Rien ne sonne comme un reproche.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Un client s'assoit: la chaise glisse, brève, sans crissement | `chair-pull` | 4 × 0,4 s | -28 | 3 | ±5 %, ±1 dB | client |
| Un client se lève | `chair-push` | 3 × 0,4 s | -28 | 3 | ±5 %, ±1 dB | client |
| La carte se referme: la table est prête à commander (service à table, dès le bourg) | `menu-close` | 2 × 0,35 s | -24 | 2 | ±3 % | signal |
| Le client attend: ses doigts tapotent le comptoir ou la table (une fois par client, passé le seuil d'attente) | `fingers-tap` | 2 × 1 s | -27 | 2 | ±3 % | client |
| Content: deux notes de kalimba qui montent (un client content sur deux, 4 s au moins entre deux dans la salle) | `react-content` | 3 × 0,7 s, 32 kHz | -29 | 3 | hauteur fixe (do-mi, ré-sol, mi-la) | client |
| Ravi (sa commande fétiche, ou tout parfait): trois notes et un éclat | `react-delight` | 2 × 1,2 s, 32 kHz | -24 | 2 | hauteur fixe | client |
| Pressés: le trousseau de clés | `keys-jingle` | 1 × 0,6 s, 32 kHz | -31 | 4 | ±4 % | client |
| Pressés: la monnaie posée pile sur le comptoir | `coins-counter` | 1 × 0,5 s, 32 kHz | -28 | 3 | ±4 % | client |
| Flâneurs: le journal qu'on déplie | `newspaper` | 2 × 0,7 s | -32 | 4 | ±4 % | client |
| Flâneurs: une page de livre | `book-page` | 2 × 0,35 s | -34 | 4 | ±5 % | client |
| Familles: la poussette à l'entrée | `stroller` | 1 × 1,2 s | -30 | 4 | ±3 % | client |
| Familles: un jouet en bois | `wooden-toy` | 1 × 0,5 s | -31 | 4 | ±5 % | client |
| Familles: les crayons de couleur | `crayons` | 1 × 0,8 s | -33 | 4 | ±5 % | client |
| Gourmands: le papier de la pâtisserie | `pastry-paper` | 1 × 0,5 s | -32 | 4 | ±5 % | client |
| Promeneurs: le sac à dos posé | `backpack-drop` | 1 × 0,5 s | -29 | 4 | ±4 % | client |
| Promeneurs: les bâtons de marche (campagne) | `hiking-poles` | 1 × 0,4 s | -31 | 4 | ±5 % | client |
| Promeneurs: les cales des cyclistes sur le carrelage (campagne) | `bike-cleats` | 2 × 0,25 s | -31 | 4 | ±6 % | client |
| Promeneurs: la valise à roulettes (touristes, dehors sur les pavés) | `suitcase-roll` | 1 × 2 s | -30 | 4 | ±4 % | client |
| Promeneurs: le plan qu'on déplie (touristes) | `map-unfold` | 1 × 0,8 s | -32 | 4 | ±4 % | client |
| Étudiants: la pile de livres | `book-stack` | 1 × 0,5 s | -29 | 4 | ±4 % | client |
| Étudiants et connaisseurs: le crayon qui écrit | `pencil-write` | 1 × 0,9 s | -34 | 4 | ±5 % | client |
| Télétravailleurs: l'ordinateur qu'on ouvre | `laptop-open` | 1 × 0,4 s | -32 | 4 | ±3 % | client |
| Télétravailleurs: le clavier, très doux | `laptop-typing` | 2 × 1,5 s | -36 | 4 | ±4 % | client |
| Bruncheurs: le pot de confiture | `jam-jar` | 1 × 0,4 s, 32 kHz | -31 | 4 | ±5 % | client |

Les bruncheurs ont aussi `cutlery` et `toast-clink`, les connaisseurs `pencil-write` et la tasse tournée lentement (`cup-saucer`). Une signature au plus par client et par visite, trois à la fois dans la salle: on devine qui est là sans regarder, et un profil ne se réduit jamais à un cliché sonore.

### 8.5.15 Les habitués

Chaque habitué a un motif de 2 à 3 s joué quand il entre, une fois par visite: on sait qu'il est là sans le voir. Ses notes sont en do pentatonique; son instrument n'appartient qu'à lui, dans la famille de son adresse d'origine: un habitué du village venu à Paris se reconnaît à son hautbois.

Dossier: `adresses/<adresse>/habitues/` (les motifs des habitués attendus dans la journée).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Un habitué entre: son motif | `regular-<habitué>` | 1 × 2,5 s par habitué, 32 kHz | -22 | 2 | hauteur fixe; une fois par visite | placé à l'habitué, réf. 3 m, plancher -8 dB |
| Son objet à lui (la médaille du chien, la canne, la sonnette du vélo...) | `regular-<habitué>-object` | 1 × 0,8 s par habitué | -28 | 3 | ±3 % | client |

Dossier: `airs/` (8.8.1).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Son histoire avance (une page, un petit air) | `regular-story` | 1 × 1,8 s st., 32 kHz | -23 | 2 | | non placé |

| Adresse d'origine | Famille d'instruments des motifs |
|---|---|
| `village` | bois et anches: hautbois, basson, clarinette, flûte à bec, harmonica; le vieux piano (Honky Tonk) pour l'ancienne patronne |
| `bourg` | cordes et cuivres doux: violoncelle, alto, cor, trombone, mandoline |
| `ville` | guitares et claviers: guitare jazz, piano électrique, vibraphone, ukulélé, xylophone |
| `paris-quartier` | violon, saxophone alto, trompette bouchée, bandonéon, clavecin |
| `paris-maison` | harpe, piano, glockenspiel, boîte à musique, cor anglais |

Les motifs baissent la musique de 3 dB pendant qu'ils jouent. Supposé: cinq habitués par adresse, 25 motifs; au plus huit sont décodés à la fois, ceux que la simulation attend dans la journée. Le jour de la fête finale, les motifs ne jouent pas à l'entrée: l'orchestre les cite (8.4.6).

### 8.5.16 Les employés

Leurs gestes sont les tiens, à leur place, priorité 3 et 3 dB plus bas (mêmes fichiers). Un employé arrive par la porte, accroche son manteau (`coat-hang`) et noue son tablier (`apron-tie`).

Dossier: `base/employes/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Un employé surmené le dit sans mots: le plateau posé lentement, deux notes graves qui descendent (marimba) | `staff-tired` | 1 × 1,3 s, 32 kHz | -25 | 2 | hauteur fixe; 90 s au moins par employé | placé à l'employé |

Dossier: `airs/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Il a appris la recette qu'on lui a montrée | `staff-learned` | 1 × 1,6 s st., 32 kHz | -22 | 2 | | non placé |
| Il progresse | `staff-progress` | 1 × 2 s st., 32 kHz | -21 | 2 | | non placé |
| Une embauche (une signature, un petit air) | `staff-hired` | 1 × 2 s st., 32 kHz | -21 | 2 | | non placé |
| Le résultat du jour d'un café confié (tablette) | `branch-report` | 1 × 1,2 s st., 32 kHz | -25 | 3 | | non placé |

### 8.5.17 Les appareils de musique

Dossier: `postes/musique/` (les sons de l'appareil présent).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Allumer la radio: le clic, le poste chauffe, la musique monte en 1 s | `radio-on` | 1 × 1 s | -26 | 2 | | placé à l'appareil, réf. 1,5 m |
| Éteindre la radio | `radio-off` | 1 × 0,3 s | -27 | 2 | | idem |
| Changer de station: un court souffle d'accord | `radio-tune` | 2 × 0,7 s | -28 | 2 | ±3 % | idem |
| Tourner le bouton du volume (crans) | `radio-knob` | 2 × 0,12 s | -32 | 3 | ±4 % | idem |
| Le souffle de la radio entre deux morceaux | `radio-hiss-loop` | boucle 3 s | -48 int. | 4 | | idem |
| Poser le disque, poser le bras | `needle-drop` | 1 × 0,9 s | -27 | 2 | ±2 % | idem |
| Les craquements du vinyle pendant la lecture | `vinyl-crackle-loop` | boucle 4 s | -44 int. | 4 | départ tiré | idem |
| Fin de face: le sillon de sortie, un tour par 1,8 s (33 tours), joué quatre fois | `vinyl-runout-loop` | boucle 1,8 s | -36 int. | 3 | | idem |
| Puis le bras se relève | `tonearm-return` | 1 × 0,8 s | -30 | 3 | | idem |
| Retourner ou changer le disque (la pochette, le disque) | `record-flip` | 1 × 1,3 s | -27 | 2 | ±2 % | idem |
| Platine: bouton, relais | `hifi-button` | 2 × 0,25 s | -29 | 3 | ±3 % | idem |

### 8.5.18 La journée et la maison

Dossier: `matin/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Arriver le matin: la clé dans la serrure | `key-unlock` | 1 × 0,9 s | -24 | 2 | ±3 % | placé à la porte |
| Allumer la salle | `lights-on` | 1 × 0,5 s | -24 | 2 | | placé à l'interrupteur |
| Lever le rideau de fer (Paris, adouci) | `shutter-up` | 1 × 2,5 s | -27 | 3 | | placé à la vitrine |

Dossier: `base/journee/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Retourner la pancarte: le carton tourne sur sa ficelle | `sign-flip` | 2 × 0,45 s | -24 | 1 | ±3 % | placé à la porte |
| Proposition d'un gros achat ou d'un déménagement (chez l'autre) | `proposal` | 1 × 1,2 s st., 32 kHz | -19 | 1 | | non placé |
| Accord des deux: le tampon « D'accord » | `proposal-accept` | 1 × 0,9 s st., 32 kHz | -20 | 2 | | non placé |
| Proposition refusée: la carte se replie | `proposal-decline` | 1 × 0,5 s st., 32 kHz | -25 | 2 | | non placé |

Dossier: `soir/` (décodé quand la pancarte passe sur « Fermé », libéré au matin).

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Compter la caisse du jour | `cash-count` | 1 × 2 s | -24 | 3 | | non placé |
| Le bilan s'ouvre (le tiroir-caisse, la feuille) | `summary-open` | 1 × 0,8 s st., 32 kHz | -23 | 2 | | non placé |

Dossier: `airs/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Le service commence: le motif de la maison | `service-open` | 1 × 2,5 s st., 32 kHz | -19 | 1 | | non placé |
| Le service se termine: le motif qui se pose | `service-close` | 1 × 2,5 s st., 32 kHz | -20 | 1 | | non placé |
| Une nouvelle recette | `recipe-learned` | 1 × 2 s st., 32 kHz | -20 | 2 | | non placé |
| Un projet réalisé (« Nos projets »): un coup de crayon, puis vos deux timbres ensemble | `project-done` | 1 × 2,5 s st., 32 kHz | -19 | 2 | | non placé |
| Réputation: une tasse de plus (des tasses frappées en gamme, une note par tasse) | `reputation-1` à `reputation-5` | 5 × 2,5 s st., 32 kHz | -19 | 2 | | non placé |
| La renommée de la maison grandit | `renown-up` | 1 × 3 s st., 32 kHz | -18 | 2 | | non placé |
| Un mot neuf dans le livre d'or | `guestbook-new` | 1 × 1,6 s st., 32 kHz | -23 | 2 | | non placé |
| Les invendus partent (association, habitués) | `unsold-given` | 1 × 2 s st., 32 kHz | -22 | 2 | | non placé |
| Les travaux d'agrandissement (écran de transition: marteau, scie, rouleau, un « tok » final) | `works-montage` | 1 × 3 s st., 32 kHz | -21 | 2 | | non placé |
| Une nouvelle adresse s'ouvre à la maison | `address-unlocked` | 1 × 6 s st., 32 kHz | -17 | 1 | | non placé |
| Tournant de saison (au bilan du dernier soir) | `season-spring`, `season-summer`, `season-autumn`, `season-winter` | 1 × 3 s st. chacun, 32 kHz | -21 | 2 | | non placé |

### 8.5.19 Les moments rares

Dossier: `airs/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| L'ancienne patronne confie les clés (ouverture du jeu): le trousseau, puis son motif au vieux piano | `keys-handover` | 1 × 4 s st., 32 kHz | -20 | 1 | | non placé |
| Premier jour dans une adresse: la première ouverture | `first-opening` | 1 × 4 s st., 32 kHz | -18 | 1 | | non placé |
| Le guide entre: son motif, mystérieux et bienveillant (basson, pizzicati, la mineur) | `guide-arrive` | 1 × 4 s st., 32 kHz | -20 | 1 | | non placé |
| Le guide goûte: la salle retient son souffle (rumeur -8 dB, musique -6 dB en 2 s); on n'entend que sa cuillère et sa tasse | (`spoon-stir`, `cup-saucer`) | | | | | |
| Le verdict du guide | `guide-verdict` | 1 × 10 s st., 32 kHz | -16 | 1 | | non placé |

Dossier: `moments/demenagement/`.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Déménagement: le ruban sur les cartons, doux | `move-tape` | 1 × 0,7 s | -28 | 3 | ±4 % | geste |
| Déménagement: la camionnette part, la portière | `van-door` | 1 × 2 s | -26 | 3 | | placé dehors |

### 8.5.20 L'interface du jeu

Dossier: `base/interface/`. Famille « papier, crayon et porcelaine », distincte du verre de Duo.

| Événement | Son | Fichiers | Niveau | Prio. | Variations | Écoute |
|---|---|---|---|---|---|---|
| Le focus se déplace au clavier: un tic de crayon | `ui-focus` | 3 × 0,08 s, 32 kHz | -31 | 4 | ±3 %, ±1,5 dB; 45 ms au moins entre deux | non placé |
| Valider: un « tok » de porcelaine | `ui-confirm` | 3 × 0,3 s st., 32 kHz | -23 | 3 | ±2 %, ±1 dB | non placé |
| Revenir, fermer: une feuille qui glisse, un « tok » plus mat | `ui-back` | 2 × 0,3 s st., 32 kHz | -24 | 3 | ±2 % | non placé |
| Changer d'onglet: un coin de page | `ui-tab` | 2 × 0,2 s st., 32 kHz | -26 | 3 | ±5 % | non placé |
| Ouvrir un panneau: un carnet qu'on ouvre | `ui-panel-open` | 2 × 0,4 s st., 32 kHz | -25 | 3 | ±3 % | non placé |
| Fermer un panneau | `ui-panel-close` | 2 × 0,35 s st., 32 kHz | -26 | 3 | ±3 % | non placé |
| Refus doux (action impossible): un double « toc » feutré, à la même hauteur | `ui-refusal` | 2 × 0,35 s st., 32 kHz | -24 | 2 | ±2 % | non placé |
| Notification: deux notes de porcelaine (mi, sol) | `ui-notify` | 2 × 0,7 s st., 32 kHz | -21 | 2 | hauteur fixe | non placé |
| Curseur d'un réglage | `ui-slider` | 1 × 0,06 s, 32 kHz | -32 | 4 | ±3 %; 40 ms au moins entre deux | non placé |

### 8.5.21 Silences voulus

Pas de son pour: le survol à la souris, la caméra qui tourne, le focus placé par le programme, la saisie au clavier hors de l'ardoise, Échap (réservé à la pause de Duo), un geste réussi « bien » (seul le geste sonne), un geste fait avec l'aide (il sonne comme le même geste sans aide), un client déçu, une baisse de réputation, une journée calme. Accueillir un client n'a pas de son: les joueurs se parlent.

## 8.6 Le son comme information, et la même pièce

### 8.6.1 Ce qu'on entend sans le voir

En vue subjective, chacun ne voit que ce qu'il regarde (cadrage, section 5). Le son dit ce qui se passe derrière soi, et d'où.

| Ce qui se passe hors de ta vue | Ce que tu entends | D'où | Prio. |
|---|---|---|---|
| Un client entre | la clochette, et la rue qui entre avec lui | la porte, derrière toi | 1 |
| La livraison du matin est là | on frappe à la porte | la porte | 1 |
| La fournée est prête | la sonnerie de la minuterie (puis un rappel) | le four | 1 |
| Personne n'est à la caisse et un client attend | ses doigts tapotent, puis la sonnette du comptoir, une fois | le comptoir | 2 puis 1 |
| L'autre fait signe | son repère, au bois | l'endroit montré | 1 |
| Une table est prête à commander | la carte se referme | la table | 2 |
| Un nouveau ticket arrive | la pince et le petit tintement | le rail | 2 |
| La machine automatique a fini | la pompe se tait, la vanne souffle | la machine | 2 |
| Le lait est à la bonne température | le pichet chante | la buse | 2 |
| La dose est moulue, ou le moulin est vide | les grains ne craquent plus, le moteur s'allège | le moulin | 2 |
| L'eau est chaude | le déclic de la bouilloire | la bouilloire | 2 |
| Le lave-vaisselle a fini | la vidange, le déclic | le lave-vaisselle | 2 |
| L'autre attend pour porter un meuble à deux | deux petits coups sur le bois | le meuble | 2 |
| Un habitué arrive | son motif | la porte, puis lui | 2 |
| Un employé est surmené | le plateau posé lentement, deux notes graves | l'employé | 2 |
| Midi, puis la dernière heure du service | la pendule | la pendule | 2 |
| Le disque est fini | le sillon de sortie, le bras qui se relève, puis le silence | l'appareil | 3 |
| Il commence à pleuvoir | les premières gouttes sur la vitrine | les vitrines | 3 |
| Quelqu'un écrit dans le livre d'or | un stylo sur le papier | le comptoir | 4 |

### 8.6.2 Un son n'est jamais secret

Les deux ordinateurs sont dans la même pièce, chacun avec ses haut-parleurs ou un casque. Conséquences:

1. **Rien de privé, rien de comparatif.** L'aide propre à chaque joueur (gestes simplifiés) sonne exactement comme le même geste réussi: aucun son ne dit qu'un geste a été aidé. La qualité ne sonne pas au geste; elle s'entend chez le client (sa réaction, son pourboire), qui ne dit pas qui a préparé (proposition à confirmer par le game designer).
2. **Le même son au même instant.** Tout son né d'un événement de la simulation (geste, client, porte, machine) est joué par les deux machines avec la même variante et la même hauteur, tirées de l'identifiant de l'événement. Dans la pièce, on entend une seule clochette un peu plus large, et non deux clochettes différentes.
3. **La musique est synchronisée** (8.4.5). Recours, si un écho reste audible chez le client: un réglage « La musique sur un seul ordinateur » (celui de l'hôte), l'autre ne jouant que les effets.
4. **Les ambiances sont décorrélées** (8.3.1): chaque machine démarre ses boucles à une position tirée au hasard, pour que deux bruits identiques ne créent pas d'effet de peigne.
5. **L'interface reste discrète**: tes menus ne sonnent que chez toi, aux paliers « réponse » et « discret » (8.7.2). Les propositions de gros achat sonnent chez celui qui doit répondre.
6. **Les deux machines s'additionnent** (jusqu'à +3 dB quand elles jouent la même scène): les niveaux de ce document valent pour une machine; le confort à deux se règle chez le client (8.10).

## 8.7 Mixage

### 8.7.1 Bus

```text
source -> variation -> panoramique 3D -> bus Effets | Ambiance | Interface | Musique
       -> bus Général -> limiteur -> sortie
gestes, signaux, clients -> compression douce du bus Effets
appareil de musique -> traitement de l'appareil -> panoramique 3D -> bus Musique
envois de réverbération (Effets, Ambiance, Musique) -> réverbération de la salle -> bus Général
```

| Bus | Identifiant | Volume par défaut | Contenu |
|---|---|---|---|
| Musique | `music` | 0,8 | appareils du café, musiciens de la fête, orgue de Barbarie, fanfare, musiques d'écrans |
| Effets | `effects` | 1,0 | gestes, postes, clients, portes, signaux, livraisons, employés |
| Interface | `interface` | 0,9 | menus, notifications, tablette, airs, motifs des habitués (placés) |
| Ambiance | `ambience` | 0,9 | dehors, pièce, météo, rumeur, décor qui sonne, machines au repos |

Le SDK n'a aujourd'hui que trois bus (`music`, `effects`, `interface`): l'ambiance passe par un sous-bus des effets tant qu'un quatrième curseur n'existe pas (question déjà posée par La Petite Ligne, S2). Les quatre volumes et les réglages de mixage sont dans le bloc `mix` de `sons.json`.

### 8.7.2 Niveaux de départ

| Palier | Sons | Niveau |
|---|---|---|
| Discret | pas, tics de craie et de tablette, focus, signatures des clients, machines au repos | -29 à -37 LUFS (momentanée maximale) |
| Gestes | moulin, tassage, tasses, versements, four, plonge, meubles | -22 à -30 |
| Signaux | clochette -20, four -19, sonnette du comptoir -21, livraison -21, ticket -23, fin des machines -23 à -25 | -19 à -25 |
| Airs | ouverture et fermeture du service, réputation, projets, nouvelle adresse, verdict du guide | -16 à -23 |
| Interface | valider, revenir, panneaux (palier « réponse » adapté au jeu) | -23 à -26 |
| Rumeur | une table -36 int.; la nappe de salle -33 int. au plus fort; tout ensemble sous -28 en momentanée | |
| Ambiances | dehors -34 int. sur la terrasse (environ -46 dedans, porte fermée); pièce -48 int. | |
| Musique | fichiers à -16 LUFS intégrés, crête sous -1 dBTP; entendue vers -29 int. à 3 m de l'appareil au volume moyen; écrans joués à -21 | |
| Ensemble | au coup de feu, couches continues (musique entendue, rumeur, ambiance) sous -26 LUFS en court terme; les gestes passent 3 à 6 dB au-dessus | |

Mesure: `ffmpeg -i fichier -af apad=pad_dur=1,ebur128=peak=true -f null -` sur chaque fichier décodé; l'ensemble se mesure au banc audio (rendu hors ligne d'un coup de feu joué par le robot), au point d'écoute derrière le comptoir.

### 8.7.3 Dynamique

- **Compression douce du bus Effets**: seuil -24 dB, rapport 2:1, genou 10 dB, attaque 15 ms (les attaques passent), relâche 250 ms. Elle lie les gestes au coup de feu sans écraser.
- **La rumeur s'efface sous tes gestes**: -3 dB pendant tes sons de priorité 1 et 2 (attaque 60 ms, retour 700 ms).
- **La musique s'efface sous les airs**: -3 dB sous les notifications et les motifs d'habitués, -4 dB sous l'ouverture et la fermeture du service et les projets, -6 dB sous la réputation, les propositions et le guide, -8 dB sous une nouvelle adresse; attaque 80 ms, retour 900 ms (`duckMusicDb` de chaque son). Les gestes n'atténuent pas la musique: une vraie radio ne baisse pas quand on tasse le café.
- **Limiteur du bus Général**: seuil -3 dB, genou 0, rapport 20, attaque 3 ms, relâche 250 ms, comme la plateforme. Avec ces niveaux, il ne travaille que si plusieurs signaux tombent ensemble au coup de feu.

### 8.7.4 Voix simultanées

| Famille | Voix au plus | Règle |
|---|---|---|
| Tout le jeu | 48 (24 boucles, 24 sons ponctuels), plus 4 flux de musique | au-delà, on coupe le plus ancien des sons de priorité 4, puis 3; jamais un son de priorité 1 |
| Pas (joueurs, clients, employés) | 6 | les plus proches |
| Chaises | 2 | |
| Signatures des clients | 3 | une par client et par visite |
| Réactions des clients | 2 | 4 s au moins entre deux `react-content` dans toute la salle |
| Tasses, soucoupes, verres, assiettes | 4 | |
| Rumeur des tables | 6 boucles | les tables les plus proches, plus la nappe de salle |
| Machines au repos (chaudière, réfrigérateur, four, lave-vaisselle, pendule, minuterie, craquements du vinyle) | 4 boucles | les plus proches |
| Craie, tablette, focus | 1 chacun | relancé: le nouveau coupe l'ancien en 15 ms |
| Clochette de la porte | 1 | relancée si un second client entre pendant qu'elle sonne |

- Un son de priorité 4 ne démarre pas pendant les 200 premières millisecondes d'un son de priorité 1 (règle de la plateforme).
- Intervalle minimal par son contre les doublons (`minIntervalMs`): 60 ms pour les gestes, 250 ms pour les signaux, 4 s pour `react-content`, 90 s pour `staff-tired`.
- Charge visée sur le PC de référence: rendu audio sous 30 % du temps de chaque bloc de 128 échantillons, mesuré au banc dès le prototype.

### 8.7.5 Spatialisation

- `PannerNode` en `equalpower` (léger), modèle de distance `inverse`, facteur 1; distances de référence et coupures par son (tableaux de 8.5).
- L'oreille est à la tête du joueur, orientée selon le regard à l'horizontale (le lacet seul): regarder la machine ou le sol ne fait pas basculer la stéréo.
- Espaces et portes: règle de 8.3.4. Les deux niveaux de la maison s'entendent par l'escalier, comme par une porte ouverte.
- Option « casque » (proposition, à mesurer sur le PC): `HRTF` pour les sons placés de priorité 1 et 2, six à la fois au plus; tout le reste en `equalpower`.

### 8.7.6 Haut-parleurs et casque

- **Haut-parleurs de portable** (le PC peut en être un): presque mono, peu de graves. Rien d'important sous 300 Hz; les sons se distinguent par le timbre et la hauteur, la position n'est qu'un plus. Chaque fichier stéréo est vérifié en mono (somme des deux voies) contre les annulations de phase.
- **Casque**: la position s'entend; l'option « casque » la précise. Le limiteur protège des cumuls.
- **Même pièce**: 8.6.2.

## 8.8 Mémoire et poids

Les chiffres de cette section sont calculés à partir des tableaux de ce document (nombre de fichiers, durées, mono ou stéréo, fréquence de décodage, amorces des boucles comprises). Un tampon décodé coûte 4 octets par échantillon: 96 Ko par seconde en mono à 24 kHz, 128 Ko à 32 kHz, le double en stéréo. Le poids est estimé d'après des encodages d'essai faits ici (Vorbis qualité 3 en mono, qualité 4 en stéréo, mesurés à 48 kHz: une estimation large) et le débit nominal des musiques (Opus 40 kbit/s, au-dessus du débit contraint mesuré).

### 8.8.1 Audio décodé (plafond de l'architecture: 64 Mo)

Trois choix font tenir le plafond. Sans eux, les sons de ces tableaux décodés à 48 kHz et gardés en permanence prendraient 137 Mo, et un seul morceau de 2 min 40 décodé en entier en prendrait 61 (La Petite Ligne monte à 94 Mo un samedi: sa question S1).

1. **Les musiques sont lues en flux** (8.4.5): aucun morceau n'est décodé en entier, environ 1 Mo par flux. C'est possible parce qu'un morceau diégétique a une vraie fin: il n'y a pas de raccord de boucle à protéger.
2. **On décode à 24 kHz**, et à 32 kHz les sons clairs (porcelaine, verre, laiton, monnaie, interface, airs, motifs), au lieu de 48 kHz: deux fois moins de mémoire, un tiers de moins pour les sons clairs. Le jeu adoucit déjà les aigus, et un portable rend peu au-dessus de 11 kHz. Vérifié ici dans Chromium (Playwright): un fichier décodé par un `OfflineAudioContext` à 24 kHz donne un tampon à 24 kHz (48 000 échantillons pour 2 s) qui se joue juste dans un contexte à 48 kHz comme à 44,1 kHz (un sinus de 1 000 Hz reste à 1 000 Hz, sa durée reste 2,0 s). Le SDK décode aujourd'hui dans son contexte principal (`load`): il lui faut une option de fréquence de décodage (8.11).
3. **On décode par groupes**, seulement ce qui peut sonner:

| Groupe | Dossiers | Décodé | Libéré | Mémoire |
|---|---|---|---|---|
| Toujours | `base/` (sauf l'aménagement) | au début de la journée | à la fin de la séance | 17,8 Mo |
| Aménagement | `base/amenagement/` | en préparation, à la fermeture, le jour de fermeture, ou quand on ouvre le catalogue | à l'ouverture du service, ou catalogue refermé | 1,5 Mo |
| Postes | `postes/<poste>/` | le matin, pour les postes, l'appareil de musique et les objets de décor présents | à la fin de la journée | 13,8 Mo au plus (adresse tout équipée) |
| Adresse | `adresses/<adresse>/` | le matin, pour l'adresse du jour | au changement d'adresse | 5,3 Mo |
| Habitués | `adresses/<adresse>/habitues/` | le matin, les motifs des habitués attendus (huit au plus) | à leur départ | 3,2 Mo au plus |
| Matin | `matin/` | à l'arrivée du matin | à l'ouverture | 1,4 Mo |
| Soir | `soir/` | quand la pancarte passe sur « Fermé » | au matin | 0,4 Mo |
| Moments | `moments/<moment>/` | dès que la journée les annonce (météo du jour, marché, école, fête, déménagement) | une fois passés | 0,3 à 3,7 Mo chacun |
| Airs | `airs/` | à l'avance quand l'événement est prévisible (ouverture, fermeture, bilan, guide), sinon à la demande | après avoir joué | 3 Mo au plus |
| Musique | `musique/` | jamais en entier (flux) | | 4 Mo au plus (quatre flux) |
| Réverbération | calculée | au chargement de l'adresse | | 1,2 Mo |

Les moments les plus chargés, en supposant l'adresse la plus équipée (tous les postes, tous les objets de décor qui sonnent):

| Moment | Audio décodé |
|---|---|
| Préparation: matin, aménagement, pluie, hiver, étals du marché | 55,4 Mo |
| Service d'hiver, pire cas: catalogue ouvert, pluie, hiver, marché, sortie d'école, deux airs | 58,1 Mo |
| Service d'été, pire cas: catalogue ouvert, pluie et orage, été, marché, sortie d'école, deux airs | 58,7 Mo |
| Fermeture: soir, aménagement, pluie, hiver, airs | 55,0 Mo |
| Fête finale: fête, pluie et orage, aménagement, verdict du guide | 55,7 Mo |

- Le pire cas tient sous 64 Mo avec 5 Mo de marge. Le moteur tient en plus son propre plafond de 60 Mo: s'il l'atteint, il libère d'abord les moments et les objets de décor les plus lointains, puis renonce à un air plutôt qu'à un geste.
- Un son ponctuel qui n'est pas décodé à temps est perdu (constat de La Petite Ligne): tout groupe se décode avant le moment où il peut sonner. Seuls les airs peuvent se décoder à la demande, et ils jouent dès qu'ils sont prêts (moins de 100 ms de retard, acceptable pour un air, jamais pour un geste).

### 8.8.2 Poids dans le paquet (50 Mo conseillés pour tout le jeu, 100 Mo au plus)

| Partie | Fichiers | Poids |
|---|---|---|
| Sons (Ogg Vorbis à 24 et 32 kHz) | 644 fichiers pour 433 sons | 8,6 Mo (estimation large) |
| Les 24 morceaux des six listes (Ogg Opus, 40 kbit/s) | 24 | 18,1 Mo |
| Musiques d'écrans et de moments (titre, bilan, déménagement, fête, orgue de Barbarie, fanfare) | 6 | 2,9 Mo |
| `sons.json` | 1 | moins de 0,2 Mo |
| **Total** | 675 | **environ 30 Mo** |

- 30 Mo de son, c'est le plafond accordé à La Petite Ligne (sa question S6). Plafond proposé pour le contrôle de Cosy Café: 32 Mo.
- Dans les 50 Mo conseillés, il reste 20 Mo pour tout le reste du jeu (modèles, textures, code). Si l'architecte prévoit davantage, le paquet dépasse le conseil mais reste loin des 100 Mo. Leviers, dans l'ordre: musiques à 32 kbit/s (environ 4 Mo de moins), puis un morceau de moins par liste (environ 0,75 Mo chacun). Le second volume de musique (8.4.4) ne viendrait que par une mise à jour, après accord.
- Les copies d'écoute (M4A) et la planche d'écoute vont dans `design/son/cosy-cafe/`, hors du paquet.

## 8.9 Plan de production

### 8.9.1 Chaîne

- **Effets et ambiances**: synthèse par numpy et scipy (`duo-python`), en reprenant les bibliothèques de La Petite Ligne (`dsp.py`, `instruments.py`, `controler.py`, `verifier-chromium.cjs`); proposition à l'architecte: les déplacer dans un dossier commun aux jeux (`outils/son/`) plutôt que de les copier. Timbres nouveaux à construire et à mesurer d'abord: porcelaine, laiton accordé, vapeur paramétrée, rumeur sans mots, kalimba des clients.
- **Musiques**: mido, FluidSynth et FluidR3_GM, pedalboard, `ebur128`, Opus (8.4.7).
- **Encodage**: sons en Ogg Vorbis à leur fréquence de décodage, 24 ou 32 kHz (mono qualité 3, stéréo qualité 4, boucles avec 0,25 s d'amorce de chaque côté); musiques en Opus 40 kbit/s, débit contraint; copies d'écoute M4A (AAC) pour le Mac du client dans `design/son/cosy-cafe/`, et une planche d'écoute `ecoute.m4a`.
- **Licences**: tous les effets et ambiances sont synthétisés par le studio (les sites de sons libres sont refusés par le réseau de l'environnement, et rien n'en est attendu); seuls les échantillons de FluidR3_GM (MIT) entrent dans les musiques, inscrits dans `CREDITS.md`. FluidSynth, ffmpeg et pedalboard restent des outils de production, hors du paquet: ce qu'ils produisent appartient au studio (`CLAUDE.md`, « Ressources et licences »).
- **Reproductible**: graines fixes, ffmpeg avec `-map_metadata -1 -fflags +bitexact -flags:a +bitexact`; deux générations successives donnent les mêmes fichiers à l'octet. `sons.json` est généré par `generer.py`, jamais écrit à la main.

### 8.9.2 Par jalon

| Jalon | Ce que le son apporte |
|---|---|
| Prototype | les sons qui portent le jeu, provisoires mais justes: moulin, extraction, vapeur selon la température, tasse et soucoupe, porte et clochette du village, ticket, caisse, minuterie du four, pas, repères, rumeur (une table et la nappe), ambiance du village, la radio avec deux morceaux (un par station). On y valide le geste à l'oreille, la radio synchronisée sur les deux machines et la charge audio sur le PC (banc) |
| Alpha | tous les sons de ce document en première version; un morceau par liste et le thème du titre; groupes de décodage en place et mémoire mesurée |
| Bêta | sons définitifs, les 24 morceaux et les musiques d'écrans, mixage réglé, planche d'écoute pour le client |
| 1.0 | niveaux, mémoire et charge mesurés sur les deux machines; corrections après l'écoute du client |

### 8.9.3 Contrôles par la mesure

Je ne peux pas écouter: chaque son se prouve par la mesure, avant que le client juge à l'oreille.

- Sonie et crête vraie de chaque fichier décodé (`ebur128`), aucun échantillon écrêté, silence de tête des sons ponctuels sous 3 ms; résultats dans `assets-src/son/controles/mesures.csv`.
- Spectrogramme et forme d'onde de chaque famille (`showspectrumpic` en échelle log, sans zoom, calibré sur un sinus; `showwavespic`), examinés.
- Part de l'énergie au-dessus de 300 Hz pour les signaux (plus de 60 %), centroïde spectral et durée utile pour prouver que les sons qu'on pourrait confondre se distinguent (les cinq clochettes, le ticket, la sonnette, la minuterie, la tablette, la notification).
- La vapeur: rendu hors ligne de toute la montée de 4 à 72 °C par le moteur; le centroïde doit monter sans retour en arrière, et chaque phase se voir au spectrogramme.
- Boucles: longueur exacte et raccord (sauts et seconde différence comparés au reste du fichier); décodage dans Chromium à leur fréquence (24 ou 32 kHz), puis vraie lecture en boucle dans des contextes à 48 et à 44,1 kHz (Playwright). L'amorce de 0,25 s de chaque côté, plus courte que celle de La Petite Ligne, n'est pas encore vérifiée: si le raccord échoue, on revient à 0,5 s (environ 1 Mo de plus au pire cas).
- Musiques: contrôle des frottements (bloquant), sonie et crête de chaque morceau, débit réel sous la consigne, énergie de chaque octave à 0,2 dB au plus de la source jusqu'à 12 kHz, lecture en flux dans Chromium.
- Mémoire par groupe de décodage et poids total recalculés à chaque génération (le contrôle échoue au-delà des plafonds de 8.8).
- Rumeur: niveau de la rumeur pleine contre celui des gestes au banc (la rumeur reste 4 dB au moins sous le geste le plus discret de priorité 2).

### 8.9.4 Démo d'Ormeval (Deux Tabliers), livrée le 2026-11-08

- **Où**: le jeu s'appelle désormais Deux Tabliers; les chemins `games/cosy-cafe/` de ce document deviennent `games/deux-tabliers/`. Sons et musiques dans `games/deux-tabliers/assets/son/`, définitions dans `sons.json` (généré), sources dans `games/deux-tabliers/assets-src/son/` (`generer.py` régénère tout, `controler.py` mesure), copies d'écoute dans `design/son/deux-tabliers/`.
- **Contenu**: les postes du café d'Ormeval (moulin, porte-filtre, extraction, vapeur selon la température, bouilloire, vitrine, plonge et lave-vaisselle, radio), le service, la caisse et les pourboires, la porte et sa clochette, la livraison et la réserve, les meubles et le port à deux, l'ardoise, les tickets, la tablette, le livre d'or, les pas, les repères, l'interface, la rumeur, la place du Tilleul (matin, fin d'après-midi, événements), la pluie, la pendule, les airs du service, une fanfare légère, un client spécial, la clochette du marché; quatre morceaux de la radio (« Les Prés » n° 1 et 3, « Le Zinc » n° 1 et 4), le thème du titre en version courte (1 min) et le jingle du bilan (16 s).
- **Écarts à ce document**: `furniture-slide` (glisser un meuble sur les tomettes) ajouté; la nappe de salle en trois densités (`murmur-room-calm`, `-busy`, `-rush`) au lieu d'une seule; le clocher en un coup (`ext-village-church-bell`) répété douze fois à midi au lieu d'un fichier long; `market-bell` alors qu'Ormeval n'a pas de marché (cahier, TE-09); musiques en Ogg Opus avec l'extension `.ogg` (même conteneur que les sons, lu par Chromium), pas `.opus`.
- **Décodage**: les fichiers sont encodés à leur fréquence de décodage (24 ou 32 kHz, champ `decodeSampleRate`). Tant que le SDK décode dans son contexte principal (48 kHz), chaque son coûte deux fois plus de mémoire que prévu: le contrôle donne les deux chiffres.

## 8.10 À écouter en priorité chez le client

1. **La buse vapeur** de bout en bout: entend-on le bon moment sans regarder ?
2. **La rumeur au coup de feu**: le café paraît-il vivant sans aucune voix, et peut-on se parler par-dessus sans forcer ?
3. **La radio sur les deux ordinateurs**: aucun écho entre les deux haut-parleurs; son niveau par rapport aux gestes et à vos voix.
4. **La clochette de la porte et la minuterie du four** entendues depuis la réserve et la terrasse, sans faire sursauter.
5. **Les gestes entendus des centaines de fois**: tasse et soucoupe, bac à marc, tassage, craie, nouveau ticket.
6. **Les six listes**: distinctes, agréables, en accord avec la décoration; lassitude sur une soirée entière.
7. **Le PC**: ses haut-parleurs (les signaux s'entendent, rien n'est strident: blender, vapeur, clochettes) et l'absence de craquement audio au coup de feu.
8. **Casque et haut-parleurs** mêlés dans la même pièce: le doublement des sons communs reste-t-il discret ?
9. **Deux morceaux en Opus 40 kbit/s** comparés aux mêmes en 64 kbit/s (planche d'écoute): une différence s'entend-elle, surtout sur de bons haut-parleurs ?

## 8.11 Points à aligner et questions

### 8.11.1 Hypothèses de ce document, par membre

| Avec | Point | Hypothèse ou proposition de ce document |
|---|---|---|
| game-designer | horaires du service | 8 h à 19 h, midi de 11 h à 14 h |
| game-designer | lait et extraction | cible du lait de 58 à 65 °C, trop chaud au-delà, coupure à 72 °C; l'extraction blondit après une fenêtre idéale qui reste à fixer |
| game-designer | infusion du thé | `tea-ready` seulement si l'infusion est une attente |
| game-designer | musique et profils | affinités du tableau 8.4.3; une liste accordée au style ajoute à la cohérence; le silence ne pénalise pas |
| game-designer | appareils | la radio au village, puis tourne-disque, platine, sonorisation, achetés comme des meubles; deux stations à la radio; la maison garde ses disques |
| game-designer | qualité et déception | aucun son de qualité au geste, aucun son pour un client déçu (8.6.2) |
| game-designer | attente à la caisse | tapotement passé un seuil, puis la sonnette du comptoir une fois par client |
| game-designer | été | porte ouverte pendant le service |
| game-designer | fêtes | la fête finale; une fête locale par adresse seulement si elle est retenue (fanfare facultative) |
| game-designer | habitués | cinq par adresse (25 motifs), au plus huit attendus par jour |
| level-designer | plans | positions de la porte, des vitrines, de l'appareil de musique, de la pendule, du poêle, des tables; espaces et portes intérieures; dans la rue, la fontaine, la ligne de tramway, la halle, la gare, l'église, pour placer les événements |
| level-designer | pendule | un élément fixe de chaque adresse (elle sonne midi et la dernière heure) |
| ux-ui-designer | saisie et réglages | un tic de craie par caractère sur l'ardoise; réglages proposés: curseur Ambiance, option « casque », « La musique sur un seul ordinateur » |
| directeur-artistique | objets qui sonnent | chaque son a un objet visible qui lui correspond: clochette sur ressort au village, deux grelots au bourg, carillon de tubes à la ville, cloche de laiton au quartier, carillon à deux tons à la maison; la radio, le tourne-disque, la platine; le tiroir-caisse en bois, le terminal; la pendule de chaque adresse |
| architecte-technique | SDK audio | quatrième bus `ambience`; flux de musique placés et filtrés, départ programmé sur l'horloge commune, correction par la vitesse; décodage à 24 et 32 kHz (option de `load`); groupes de décodage, airs décodés puis joués, plafond de 60 Mo tenu par le moteur (64 Mo au budget); variantes tirées de l'identifiant d'événement; un `ConvolverNode`; limiteur du bus Général (absent du SDK aujourd'hui); banc de charge sur le PC; part du son dans le paquet (30 Mo, 20 Mo pour le reste dans les 50 conseillés); module audio partagé, à partir du moteur de La Petite Ligne |
| dev-reseau | horloge commune | précision de 10 ms entre les deux machines, pour la musique synchronisée |

### 8.11.2 Questions pour le client

| # | Question | Recommandation |
|---|---|---|
| S1 | Combien de musique en version 1 ? Proposé: 24 morceaux (une heure) en six listes, plus six musiques d'écrans et de moments, pour environ 21 Mo (30 Mo de son en tout, comme le plafond de La Petite Ligne). | 24 morceaux; un second volume (12 morceaux, environ 9 Mo) dans une mise à jour si les listes lassent. |
| S2 | Aucune voix dans le jeu: une rumeur de salle sans mots, des clients qui s'expriment par leurs objets et quelques notes, comme dans La Petite Ligne. | Oui; la rumeur se juge à l'écoute dès le prototype, et on la retouche si elle ne sonne pas assez « café ». |

## 8.12 Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-11-07 | 0.1 | Première version: intention et piliers, palette et tonalité, ambiances des cinq adresses et des moments, rumeur, musique diégétique (appareils, six listes, 24 morceaux, écrans), événements sonores, information et même pièce, mixage, mémoire et poids, plan de production | sound-designer |
| 2026-11-08 | 0.2 | Production de la démo d'Ormeval (Deux Tabliers): section 8.9.4 | sound-designer |
