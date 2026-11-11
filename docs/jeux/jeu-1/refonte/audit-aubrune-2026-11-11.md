# Audit d'Aubrune contre le contrat, au 11 novembre 2026

Auteur: game-designer. Base: tête de `claude/stoic-lamport-lueey2` (fusion `82a1c86`, « vignettes des objets d'intérieur »). Contrat: `cahier-des-charges.md` 0.3; décisions: `reponses-client-2026-11-10.md`. Chaque ligne a été vérifiée dans les données (`games/la-petite-ligne-2/donnees/`) ou le code (`games/la-petite-ligne-2/src/`), pas d'après les documents d'écriture seuls. Chemins relatifs à `games/la-petite-ligne-2/`.

## En bref

- **141 exigences relevées** (règles des sections 1.5 à 9, lignes des tableaux de contenu): **86 faites, 29 partielles, 26 absentes**. Huit des partielles sont des chantiers en cours chez d'autres membres (tenues, vêtements, draisine, pêche de la Baronne, décor des fêtes, trains à l'écran, fin des lettres en retard). Les 38 critères d'acceptation, comptés à part: 33 tenus ou sans objet, 4 partiels (CA-09, CA-17, CA-18, CA-23), 1 à observer chez le client (CA-30).
- Le squelette est là et solide: histoire complète (prologue, trois actes, 117 étapes), six suites secondaires, quatre fêtes et la veillée, 21 habitants écrits avec souvenirs et secrets, sept commerces, besoins et endurance, potager, basse-cour, cuisine en mini-jeu et repas à deux, pêche, insectes, fouilles, photo, collections au complet (94 entrées), maison jusqu'à l'étage, mode déco, sauvegarde et reprise.
- **Trois trous de boucle** comptent plus que tout le reste: (1) un meuble fabriqué ou acheté ne peut pas se poser (il finit dans le sac, sans lien vers l'inventaire de la maison), et aucun commerce ne vend de meuble; (2) la musique jouée (mini-jeu de rythme, instruments) n'existe pas, alors que le client l'a cochée; (3) la séance ne rend aucun résultat à Duo (ni `progress` ni statistiques), donc l'historique et le score cumulé de la plateforme restent vides.
- Ensuite: aide réglable absente, commande hebdomadaire du samedi absente, coquillages absents (cochés par le client), saisons et pluie invisibles à l'écran, plusieurs plans et agrandissements inatteignables (corrigés en partie 2 quand c'était des données).
- Dix lignes du cahier n'ont plus de sens après les décisions du client: proposées au retrait en section C.

Légende: **fait** (vérifié, avec le chemin), **partiel** (ce qui manque est dit), **absent**, **en cours** (chantier ouvert chez un autre membre, compté comme partiel).

## A. Exigence par exigence

### A.1 Structure, train et lieux (4.1, 6.3 « ce que la suite débloque »)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.1 | Train de nuit du prologue, arrivée au matin quoi qu'on fasse | fait | `donnees/lieux/train-de-nuit/` (quête `terminus`, trois scènes) |
| 4.1 | Voyager: les deux sur le quai, chacun valide « Monter » | fait | `src/simulation/voyage/`, `tests/voyage.test.ts` |
| 4.1 | Train du samedi à quai chaque samedi après l'acte 2 | fait | `evenements/train-du-samedi.json`, `depart-du-train-du-samedi.json` |
| 4.1 | Train du samedi: commande de la semaine (3 à 5 lignes, payée, sans pénalité), courrier, parfois un habitant | absent | seule la commande de l'acte 2 existe (étapes `commande-*` de `la-minute-d-ecart`); aucune commande hebdomadaire ni courrier dans `src/simulation/monde/` |
| 4.1 | Autorail de 5 h 12 chaque nuit après le premier départ | fait (données), en cours (écran) | `evenements/autorail-de-5h12.json`; rendu des trains fusionné le 11 (`src/rendu/lieu/trains.ts`), revue en cours |
| 4.1 | Quai de départ vers Hautefonte, cartes de ligne, ordre de mission | fait | scène `scenes/en-voiture.json`, étape `depart` de `ceux-qui-partent`; les cartes de ligne sont dites, pas un objet (suffisant tant que Hautefonte n'existe pas) |
| 4.1 | Lien vers Hautefonte dans la fiche du lieu | absent (attendu) | `lieu.json`: `"links": []`; normal tant que le lieu n'existe pas |
| 4.1 | Coffre commun: guichet de consigne dans chaque gare | partiel | le coffre se remplit et se vide depuis le carnet, partout (`src/interface/carnet.ts`, touches V et R); aucun guichet. Voir C.6 |
| 4.1 | Pendant l'absence: potager, pondoir, calendrier rattrapés | fait | `src/simulation/elevage/journee.ts` (60 jours), cultures rattrapées au retour |
| 6.3 | Débloque: café, école, moulin, ferme; 10 habitants de plus; sac à dos | fait | arrivées par les trains de l'histoire; `dialogues/solange-sac-a-dos.json` |

### A.2 Logement (4.2)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.2 | Maison du garde en ruine, première pièce par l'histoire | fait | `logements/maison-du-garde.json` (pièce `salle`) |
| 4.2 | Cuisine 150 €, chambre 300 €, troisième pièce 450 €, étage 800 €, payés au coffre | fait | même fichier (`cost` en centimes), devis de Basile (`basile-devis-*`) |
| 4.2 | Cave par l'histoire (trappe de la chambre) | fait | pièce `cave`, porte conditionnée dans `interieurs/maison-rdc.json` |
| 4.2 | Chaque pièce restaurée livre un indice | fait | champ `clue` de chaque pièce |
| 4.2, 4.4 | Salle d'eau 120 € (le baquet remplacé par une douche), savon parfumé | absent | aucune pièce, aucun meuble douche, aucun objet savon |
| 4.2 | Place: 40 % de sol libre, nécessaire logé (lits, table, deux chaises, cuisine, établi, deux coffres) | partiel | inventaire de départ: 2 coffres, 2 lits, 2 chaises, miroir, établi; pas de table à manger dans l'inventaire (elle est posée sur la carte). Mesure des 40 % non faite |
| 4.2 | Mode déco: B, vue du dessus, souris, quarts de tour, rangement, verrou à deux | fait | `src/simulation/logement/`, `src/interface/deco/`, `tests/logement.test.ts` |
| 4.2 | Meubles par séries assorties en plusieurs couleurs, fabriqués sur plans | partiel | une seule série (« campagne », 4 meubles en miel et sauge, `commun/plans/`); **le meuble fabriqué tombe dans le sac (`fabrication/index.ts`, `giveItem`) et aucun geste ne le fait passer dans l'inventaire de la maison**, qui est indexé par fiche de meuble (`logement/index.ts`, `deco_take`); les objets `etagere-miel` et autres n'ont pas de fiche de meuble |
| 4.2, 4.6 | Meubles à acheter (4 à 60 €) | absent | aucun commerce ne vend de meuble (Basile: planches et marteau); 45 fiches de meubles posables ont un modèle et une vignette mais aucun objet ni prix |
| 4.2 | Jardin décorable autour de la maison seulement (R53) | partiel | `garden` déclaré (20 x 8 m); rien à y poser tant que la boucle des meubles manque |
| 4.2 | Confort par pièces et meubles, bonus de sommeil | fait | `logement/README.md` (paliers de confort) |

### A.3 Temps, météo, saisons, calendrier (4.3)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.3 | 125 s par heure, jour de 30 min, nuit jouable de 20 min | fait | `commun/reglages.json` (`clock`) |
| 4.3 | Dormir à deux dès 15 h, sieste seul, nuit blanche | fait | `src/simulation/briques/dormir.ts` |
| 4.3 | Semaine de 7 jours, saison de 14 jours | fait | `reglages.json` (`seasonDays: 14`), `monde/calendrier.ts` |
| 4.3 | Météo tirée par saison (beau, couvert, pluie, brume, neige) | fait | `lieux/aubrune/climat.json` (plus l'orage, voir D.11) |
| 4.3 | Saisons et météo visibles à l'écran | partiel | la météo teinte l'image (`src/rendu/encre/ambiances.json`, section `weather`); aucune pluie ni neige qui tombe, aucun feuillage d'automne ni sol enneigé; les feuilles d'ambiance de saison nommées par `climat.json` (`aubrune-printemps`...) n'existent pas: une seule feuille `defaut` |
| 4.3 | Horloge qui continue dans les menus, figée en scène à deux | fait | `src/simulation/scenes/` |
| 4.3 | Rareté par heure, météo, saison; coup de pouce x4 | fait | `commun/carnet/*.json` (`rarity`), `commun/temps.json` (`newEntryBoost: 4`) |
| 4.7 | Événements: quatre fêtes par an, de 10 h à 22 h, annoncées | fait (décor en cours) | `evenements/` (quatre fêtes et la veillée du quai), quêtes de fête, annonce la veille (`src/interface/annonce.ts`); décor des fêtes en cours |

### A.4 Besoins (4.4)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.4 | Trois jauges, pertes, paliers, bonus plafonnés à 25 % | fait | `commun/besoins.json`, `tests/besoins.test.ts` |
| 4.4 | Affichage au changement de palier, sous 20, touche G, réglage « toujours visibles » | fait | `src/interface/hud.ts`, réglage `needs` de `carnet/options.ts` |
| 4.4 | Faim ou sommeil à 0: la touche d'action ne sert plus qu'à manger ou s'allonger | partiel | la vitesse tombe à 50 %, mais `onlyReliefFor` (`besoins/jauges.ts`) n'est appelé nulle part: aucun geste n'est refusé |
| 4.4 | Hygiène basse: remarque de chaque habitant, pas d'amitié, étape de dialogue qui échoue | fait | 21 dialogues `*-hygiene.json`, `dialogues/conversation.ts` (`failHygiene`) |
| 4.4 | Se débarbouiller (pompe), baquet | fait | meubles `pompe`, `baquet` |
| 4.4 | Repas spécial à deux: assis à la même table, faim à 100, bonus exclusif | fait | `besoins/repas.ts`, `cuisine/scene.ts` |
| 4.4 | Pot-au-feu du dimanche (Bonne étoile) | fait | recette `pot-au-feu-du-dimanche` (poste à deux, `second`), objet `pot-au-feu` (`extra_catch`) |
| 4.4 | Tourte de la halte (Mains sûres), cuisinée à deux | partiel | l'objet `tourte-du-quai` (`no_tool_wear`) existe sans recette; il se prend **gratuitement toutes les 12 heures** à l'étal de l'épicerie (`commun/meubles/etal-de-tourte.json`, posé dans `interieurs/epicerie-rdc.json`), ce qui rend le bonus permanent |
| 4.4 | Endurance (55 s de course, recharge, renforts des plats) | fait | `besoins.json` (`stamina`), `besoins/endurance.ts`, `tests/endurance.test.ts` |

### A.5 Sac, barre, piles, outils (4.5)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.5 | Barre de 5, pas de sac au départ, repli après 3 s | fait | `commun/sacs.json`, `src/interface/reglages.ts` (`toolbarFoldMs`) |
| 4.5 | Réglage « barre toujours visible » | absent | les réglages du carnet sont volume, graphismes, besoins, taille, mouvement réduit |
| 4.5 | Besace (acte 1), sac de toile, sac à dos | fait | `dialogues/solange-*`, `rosalie-lettre.json`, mercerie (sac de toile 35 €); voir C.5 pour les prix |
| 4.5 | Poches pleines: l'objet reste au sol et brille | fait | `src/simulation/sac/sol.ts`, texte « Poches pleines » |
| 4.5 | Piles maximales du tableau | fait | champ `stack` des objets (poisson 3, bûche 5, planche 10, œuf 6, graines 20, repas spécial 1) |
| 4.5 | Coffres de rangement de 20 cases | fait | meuble `coffre` (brique `store`) |
| 4.5 | Hache de base, forgée; usure, émoussé, réparation | fait | `objets/hache*.json`, `outils/forge.ts`; réparation payée 2 € à la forge (pas de meule gratuite, voir C.7) |
| 4.5 | Bêche de base et forgée | fait | `objets/beche*.json` |
| 4.5 | Arrosoir de base et de cuivre | partiel | les deux outils existent, mais le plan `arrosoir-cuivre` (`source: villager`) n'était donné par personne: amélioration impossible. **Corrigé en partie 2** |
| 4.5 | Canne de base et canne fine | fait | `canne` (leçon d'Achille), `canne-fine` (`achille-canne-fine`, fin de la Baronne) |
| 4.5 | Filet amélioré, usure, raccommodage à la ficelle | absent | `filet` seul, sans `work` ni usure |
| 4.5 | Marteau amélioré | absent | `marteau` sans amélioration (`upgrade: null`) ni modèle 3D |
| 4.5 | Appareil photo: poses, pellicule, amélioré | absent | photo illimitée, pas de pellicule (voir C.4) |
| 4.5 | Instrument (3 airs, désaccord, Armand) | absent | aucun objet instrument |
| 4.5 | Usure lue sur l'icône, jamais par un chiffre | fait | `toolWearRatio` (`sac/outils.ts`), barre d'outils |

### A.6 Économie et commerces (4.6)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.6 | Euro, multiples de 0,10 €, bourse par joueur, coffre commun | fait | `sac/argent.ts`, `commerces/reglages.ts` |
| 4.6 | Le coffre paie seul les achats du foyer | fait | paiement `household` et `purse-or-chest` (`commerces/README.md`) |
| 4.6 | Vente aux seuls commerçants de métier, refus en caractère | fait | sept fiches `commerces/*.json` (`buys`, `refusal`) |
| 4.6 | Besoin du jour (x1,5) | fait | `dailyNeeds`, `commerces/prix.ts`; l'ardoise devant la boutique n'est pas dessinée dans le monde (partielle à l'écran, notée en A.13) |
| 4.6 | Mémoire des prix par commerçant | fait | `progress.prices`, « Prix déjà vus » (`interface/boutique/`) |
| 4.6 | Boutique en images, deux onglets, « Tout vendre de cette sorte » | fait | `src/interface/boutique/` |
| 4.6 | Comptoir tenu, ce qu'ils ont à dire avant la boutique | fait | `commerces/brique.ts`, `tests/comptoir-tenu.test.ts` |
| 4.6 | Tableau des prix d'achat (œuf, radis, carotte, poissons, bûche, planche, plume, fleur, coquille, insectes, fossile, soupe) | partiel | prix relevés le 11 (`economie-aubrune.md` 8) et différents du tableau; plume, ferraille, coquille de rivière, girolle: objets absents; insectes: pas d'objets, donc invendables; Armand n'a pas de commerce (voir C.2) |
| 4.6 | Pain 1,20 €, plat du jour 3 €, graines 1 à 4 € | fait | fournil, café, épicerie, cour des Delmas |
| 4.6 | Vêtements 6 à 40 € | en cours | mission des tenues |
| 4.6 | Outil amélioré 30 € à la forge | fait | `tool.work.upgrade` (30 € et matériaux) |
| 4.11 | Faim à 0, sans un euro: Odette offre une soupe par jour | absent | `odette-boutique.json` répond « Pas un sou ? » et ne donne rien. **Corrigé en partie 2** |

### A.7 Activités (4.7)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.7 | Potager: rien ne meurt, 2 à 6 jours, arrosage double | fait | `commun/cultures/` (17), `src/simulation/cultures/`, `tests/recolte.test.ts` |
| 4.7 | Potager de 6, puis 12, puis 24 cases | partiel | paliers déclarés (`meubles/terre-cultivable.json`, faits `logement.potager.agrandi` et `.grand`) mais aucun fait écrit nulle part. **Corrigé en partie 2** |
| 4.7 | Pêche en trois temps, feintes, tension, épuisette à deux | fait (Baronne en cours) | `src/simulation/peche/`, `lieu.json` (`fishing`), `tests/peche.test.ts` |
| 4.7 | Insectes: approche lente, filet | fait | `commun/insectes/` (16), `collections/insectes.ts` |
| 4.7 | Fouilles: sol qui scintille, bêche | fait | ressources `fouille-*` et `point-de-fouille` |
| 4.7 | Fossile en plusieurs morceaux à assembler au carnet | absent | voir C.3 |
| 4.7 | Coquillages et rivière: ramassage au bord de l'eau selon l'heure et la pluie | absent | aucun objet coquillage, aucune ressource de berge; activité cochée par le client (R28) |
| 4.7 | Photo: sujets et points de vue, collés au carnet | fait | `collections/photo.ts`, `commun/photos/` (13) |
| 4.7 | Photo posée en cadre à la maison | absent | les cadres existent comme meubles (`cadre-paysage`...) sans lien avec les photos; voir C.4 |
| 4.7 | Musique: mini-jeu de rythme à quatre touches, duo à deux instruments | absent | rien dans `src/`; les airs du carnet (8) s'obtiennent par l'histoire et s'écoutent au carnet |
| 4.7 | Cuisine: réchaud une étape, vraie cuisine 2 à 4 étapes, trois réussites, jamais de plat perdu | fait | `commun/recettes/` (18), `src/simulation/cuisine/`, `tests/cuisine.test.ts` |
| 4.7 | Basse-cour: trémie de 20, pondoir, deux gestes, panneau, caresse et œuf roux | fait | `meubles/poulailler.json`, `especes/poule.json`, `src/interface/basse-cour/` |
| 4.7 | 4 poules, puis 6, puis 8 | partiel | paliers déclarés, faits jamais écrits. **Corrigé en partie 2** |
| 6.3 | Acte 1: Odette donne deux poules | partiel | `odette-poules.json` donne six œufs et retient `aubrune.poules.nombre`, mais aucune poule n'entre au poulailler: aucun effet de dialogue n'appelle `adoptAnimal` (`elevage/abri.ts`); il faut les acheter 8 € à l'écran du poulailler |
| 4.7 | Fabrication à l'établi sur plans | partiel | moteur fait (`src/simulation/fabrication/`); 10 plans dont 4 connus d'entrée; `etagere-campagne`, `coffre-a-linge-campagne`, `nichoir` sans source dans le jeu (**les deux premiers corrigés en partie 2**); voir aussi la boucle des meubles (A.2) |
| 4.7 | Petites activités: quilles au café | absent | |
| 4.7 | Petites activités: draisine à deux ou contre le chrono | en cours | mission draisine |
| 4.7 | Petites activités: ricochets, balles de foin | absent | voir C.8 |
| 2.1 | Gestes à deux: deux fois plus vite et 50 % de gain en plus (R12) | partiel | restauration 2,5 fois plus vite à deux (`logement/reglages.ts`); l'établi note `together` sans rien de plus; abattage, récolte: aucun effet à deux |

### A.8 Collections (4.8)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.8 | Poissons 16, insectes 16, fossiles et trésors 12, fleurs 12, recettes 18, cartes 12, musiques 8 | fait | `commun/carnet/` (94 entrées d'Aubrune, compte vérifié), `tests/collections-aubrune.test.ts` |
| 4.8 | Tenues: 15 pièces par catégorie au total du jeu | en cours | mission des tenues |
| 4.8 | Communes aux deux, prénom de qui a trouvé | fait | `collections/registre.ts` |
| 4.8 | Collection complète: un meuble trophée unique | partiel | l'événement `collection_completed` part (`registre.ts`), aucune récompense ni meuble trophée |

### A.9 Habitants, amitié, cadeaux (4.9, 6.2)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 6.2 | Distribution d'Aubrune (Firmin à Barnabé, Rosalie, le Contrôleur, Martial) | fait | `lieux/aubrune/habitants/` (21) |
| 6.2 | Nour Belkacem et Inès Garrigue, après l'histoire | absent | voir C.1 |
| 4.9 | Registre de langue, tic, babil par instrument, portrait | fait | champ `voice`, `src/audio/babil.ts`, `tests/portraits-habitants.test.ts` |
| 4.9 | Bandeau bas, lettre par lettre, trois lignes, Espace | fait | `src/interface/dialogue.ts` |
| 4.9 | Cinq cœurs de 100 points, jamais de perte | fait | `regles/reglages.ts` (`bonds`) |
| 4.9 | Première conversation 5, cadeau aimé 15, adoré 30, un par jour | fait | `habitants/reglages.ts`, goûts dans `life.gifts` |
| 4.9 | Partager un repas spécial avec un habitant: 40 points | absent | voir C.9 |
| 4.9 | Confidences à 2 et 4 cœurs, écrites au carnet | partiel | 30 secrets; 9 habitants à deux paliers, 12 à un seul; paliers à 1 et 2 cœurs (100 et 200 points), pas 2 et 4 (voir D.6) |
| 4.9 | Mémoire: 12 souvenirs par habitant, dont 4 sur l'autre joueur, dits une fois | fait | 340 dialogues `*-souvenir-*`, `tests/habitants-aubrune.test.ts` |
| 4.9 | Souvenir de la tenue portée | absent (attend les tenues) | `ecriture-habitants.md` 6, point 5 |
| 4.9 | Petites demandes: quelques-unes, une par jour au plus, bulle | partiel | le type `errand` existe (`schemas/quete.ts`), aucune demande écrite, aucune règle « une par jour » |
| 4.9 | Repeuplement: arrivées par le train après chaque acte | fait | scènes des trains de l'acte 2 et de l'acte 3 |
| 4.9 | Le bourg change (volets ouverts, vitrine rallumée, fumée) | absent | `carte.json` n'a aucun objet conditionné (`when`); seuls les intérieurs en ont |
| 4.9 | Bulle « j'ai quelque chose » sur un habitant (R69) | fait | `src/rendu/cible.ts`, `interface/annonce.ts` |

### A.10 Quêtes et suivi (4.10, 6.3, 6.4)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 6.3 | Prologue « Terminus » (éditeur à la photo, faim, sandwich) | fait | `train-de-nuit/`, `tests/photo-prologue.test.ts` |
| 6.3 | Acte 1 « Logement fourni » (19 étapes) | fait | `quetes/le-train-de-5h12.json`, `tests/acte-1-aubrune.test.ts` |
| 6.3 | Acte 2 « La minute d'écart » (31 étapes, scène asymétrique des leviers) | fait | `quetes/la-minute-d-ecart.json`, `tests/actes-2-3-aubrune.test.ts` |
| 6.3 | Acte 3 « Ceux qui partent » (38 étapes, pot-au-feu, dénouement à deux, départ) | fait | `quetes/ceux-qui-partent.json` |
| 6.4 | La Baronne | en cours | `quetes/la-baronne.json` écrite; pêche de la Baronne en cours |
| 6.4 | La guerre de la soupe | fait | `quetes/la-guerre-de-la-soupe.json` |
| 6.4 | Le fantôme du moulin | fait | `quetes/le-fantome-du-moulin.json` |
| 6.4 | La fanfare de la halte | partiel | quête écrite; « instruments des joueurs » absents (musique jouée) |
| 6.4 | Les lettres en retard | en cours | quête écrite; la draisine qu'elle débloque est en cours |
| 6.4 | La robe et la cloche | fait | `quetes/la-robe-et-la-cloche.json` (tenues anciennes: mission des tenues) |
| 4.10 | Page « Histoire » qui dit quoi faire, coup d'œil G avec flèche | fait | `interface/carnet/quetes.ts`, `interface/index.ts` (`glance`) |
| 4.10 | Étape franchie par l'un, ligne chez l'autre, scène relisible | fait | `tests/quetes.test.ts`, `interface/histoire/` |
| 4.10 | Décisions à deux | fait | `tests/decision-a-deux.test.ts` |
| 4.10 | Zones ouvertes acte par acte | fait | effets `unlock_zone` (v, r, m, c, t, f), `tests/lieux-verrous.test.ts` |
| 4.11 | Hygiène à 0: le carnet dit « Un brin de toilette d'abord » | absent | l'étape échoue au dialogue, le carnet ne le dit pas |

### A.11 Sauvegarde, historique, score (4.11, plateforme)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 4.11 | Un emplacement, relecture sûre, migrations | fait | `src/sauvegarde/`, `tests/sauvegarde.test.ts` |
| 4.11 | Moments: coucher, aube, étape de quête, voyage, sortie | partiel | aube, arrivée en train, toutes les 5 min, pause, sortie (`sauvegarde/declencheur.ts`, `duo-game.json`); ni coucher ni étape de quête |
| 4.11 | Résultat d'une séance (`progress`: jours vécus, étapes, entrées ajoutées) | absent | aucun appel à `endSession`, aucun `progress` ni `stats` dans l'instantané (`sauvegarde/README.md`: « pas de progress tant que le cahier ne définit pas »); l'historique et le score cumulé de Duo ne reçoivent rien |
| 4.11 | Joueurs rattachés à l'identifiant stable, invité différent | fait | `sauvegarde/reprise.ts` |
| 4.11 | Libellé de sauvegarde lisible | fait | `labelOf` (« Aubrune, jour N, H h MM ») |

### A.12 À deux, réseau, reconnexion (2, 4.11)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 2.1 | Liberté de déplacement, trois moments ensemble (train, nuit, repas spécial) | fait | `voyage/`, `briques/dormir.ts`, `besoins/repas.ts` |
| 2.2 | Ce que montre chaque écran (dialogue ordinaire chez un seul, scènes asymétriques) | fait | `scenes/` (`to: a | b`), `tests/scene-repliques.test.ts` |
| 4.11 | Même objet, même habitant, l'un dort et l'autre veille, 6 h pendant un geste | fait | `tests/deux-au-meme-point.test.ts`, `briques/dormir.ts` |
| 4.11 | Déconnexion: pause pour l'autre, reprise | fait | pause de la plateforme (`session.ts`, `duo.on('resume')`), `tests/reseau.test.ts` |
| 4.11 | Pas de mode solo | fait | manifeste `mode: coop` |
| 2.4 | Aide réglable par joueur, trois crans, jamais montrée à l'autre | absent | le mini-jeu de cuisine accepte `assist` (`cuisine/minijeu.ts`) mais personne ne le passe; rien dans la pêche ni le filet; aucun réglage |

### A.13 Contrôles, ressenti, interface, accessibilité (5, 9)

| Réf | Exigence | État | Où, ou ce qui manque |
|---|---|---|---|
| 5 | ZQSD par position, Maj, Espace, A et E, flèches, molette, Tab, X, C, G, B, Retour arrière | fait | `duo-game.json` (`actions`) |
| 5 | Reconfiguration des touches | partiel | par la plateforme (actions `rebindable`); les touches des mini-jeux (Q, S, D, F de la pêche) ne sont pas déclarées |
| 5 | Bulle d'action (touche et verbe), refus montré, une cible | fait | `src/rendu/cible.ts`, `tests/visee.test.ts` |
| 5 | Ressenti: son, mouvement, particules à chaque geste | fait | `src/audio/donnees/evenements.json`, `tests/audio-accroches.test.ts` |
| 5 | Vibration d'écran de 0,15 s sur les gros coups, réglable | absent | rien dans `src/rendu/` |
| 5 | Carnet: sept onglets dans l'ordre du client | fait | `src/interface/carnet.ts` (`TABS`) |
| 5 | Carte du carnet avec habitants rencontrés et l'autre joueur | fait | `interface/carnet/carte.ts` |
| 9 | Ardoise du besoin du jour devant chaque boutique | absent | lu seulement dans l'écran de boutique |
| 9 | Accessibilité: lisible à 1366 x 768, rien par la seule couleur | partiel | carnet en petite fenêtre (`carnet/options.ts`, taille de l'interface); pas de relevé complet à 1366 x 768 |
| 1.5 | Éditeur: femme ou homme, toutes pièces à tous, accords par balise | fait | `src/interface/editeur/`, balises `[[f|m]]` validées |
| 1.5 | Changer de genre et d'apparence chez Solange | absent | aucun dialogue ni écran chez Solange (attend la mission des tenues) |
| 3, 6.3 | Tutoriels: on apprend en faisant (prologue, actes) | fait | étapes guidées; astuce de course (`interface/astuce-course.ts`) |
| 8 | Musique selon l'heure, la météo, les fêtes; sons du monde entendus des deux | fait | `src/audio/musique/donnees/musique.json` (23 règles), `tests/musique.test.ts` |

### A.14 Critères d'acceptation (12)

| CA | État | Remarque |
|---|---|---|
| CA-01, CA-02 | fait / sans objet | voyage à deux testé; aller-retour impossible sans second lieu |
| CA-03 | fait | rattrapage de la basse-cour et des cultures |
| CA-04 à CA-07 | fait | horloge, sommeil, saisons, rareté |
| CA-08 | fait | médaillons et réglage |
| CA-09 | partiel | faim à 0 ne refuse pas l'arbre (A.4) |
| CA-10, CA-11 | fait | |
| CA-12 | fait | `seatedTogether` |
| CA-13 | fait | `docs/jeux/jeu-1/simulations/refonte_besoins_economie.py` (non relancé ici) |
| CA-14 à CA-16 | fait | sauf vibration d'écran (A.13) |
| CA-17 | partiel | réglage « barre toujours visible » absent |
| CA-18 | partiel | hache, bêche, arrosoir oui; filet, marteau non |
| CA-19 à CA-21 | fait | CA-20: coffre accessible partout (C.6) |
| CA-22 | fait | |
| CA-23 | partiel | pas d'appât, pas d'aide « Grand coup de pouce » |
| CA-24, CA-25 | fait | |
| CA-26 à CA-29 | fait | CA-28 sans objet tant qu'aucune petite demande n'existe |
| CA-30 | à observer | chez le client |
| CA-31 à CA-33 | fait | robots des actes (`tests/longues/`) |
| CA-34, CA-35 | fait | |
| CA-36 | fait | relecture: aucun fantôme à Aubrune |
| CA-37, CA-38 | fait | |

Compte: les 141 lignes des tableaux A.1 à A.13 donnent 86 faites, 29 partielles (dont 8 en cours, y compris les lignes « fait » dont une part est en cours) et 26 absentes; les 38 critères ci-dessus sont comptés à part.

## B. Ce qui manque pour dire « Aubrune est complet »

Classé du plus lourd pour le plaisir de jeu au plus léger. Taille: petit (une mission), moyen (deux ou trois), gros (plus).

| # | Quoi | Où | Critère de réussite | Rôle | Taille |
|---|---|---|---|---|---|
| 1 | **Boucle des meubles**: un meuble du sac se range dans l'inventaire de la maison (geste « Ranger à la maison » ou dépôt automatique en mode déco); chaque objet `furniture` déclare sa fiche de meuble; fiches de meubles des 8 variantes de la série campagne | `src/simulation/logement/`, `src/simulation/fabrication/`, `donnees/commun/objets/*-miel.json`, `*-sauge.json`, `commun/meubles/` | un tabouret fabriqué à l'établi apparaît dans la liste du mode déco et se pose; test court avec un meuble factice | dev-gameplay-3d, artiste-3d (8 modèles en deux teintes) | moyen |
| 2 | **Meubles à acheter**: Basile vend une série « campagne » complète et une série « gare » (4 à 60 €, payables au coffre), en deux couleurs; reprendre comme objets les 45 meubles posables qui ont modèle et vignette | `commerces/menuiserie-cornu.json`, `commun/objets/` | au moins 20 meubles obtenables, 3 séries, chacun posable; prix dans `economie-aubrune.md` | game-designer (catalogue, prix), dev-gameplay-3d (lien), artiste-3d | moyen |
| 3 | **Musique jouée**: mini-jeu de rythme Q, S, D, F, un instrument par joueur (offert à la fin de la fanfare), duo à deux, airs du carnet jouables | nouveau `src/simulation/musique/`, `src/interface/musique/`, objets instruments | un air se joue seul et à deux; la fanfare donne les instruments; l'aide élargit la fenêtre | game-designer (règles), dev-gameplay-3d, sound-designer, ux-ui-designer | gros |
| 4 | **Résultat de séance pour Duo**: `progress` (part de l'histoire d'Aubrune franchie) et trois statistiques (jours vécus, étapes franchies, entrées ajoutées pendant la séance) dans l'instantané de sauvegarde | `src/sauvegarde/sauvegarde.ts`, `session.ts` | après une séance, l'historique de Duo montre ces trois nombres; test court | dev-plateforme | petit |
| 5 | **Aide réglable par joueur** (Normal, Coup de pouce, Grand coup de pouce: fenêtres +0, +25, +50 %), dans Réglages, branchée à la pêche, la cuisine et le filet | `src/interface/carnet/options.ts`, `simulation/peche/`, `cuisine/`, `collections/insectes.ts` | CA-23 vérifié; l'autre joueur ne voit pas le réglage | dev-gameplay-3d, ux-ui-designer | petit |
| 6 | **Commande hebdomadaire du train du samedi** (3 à 5 lignes tirées dans ce que le duo sait produire, payée en euros, reportée sans pénalité) et courrier du samedi | `src/simulation/monde/trains.ts`, nouvelles données `lieux/aubrune/commandes/` | chaque samedi après l'acte 2, une commande au quai, payée à la livraison; test sur 3 semaines simulées | game-designer (gabarit et tables), dev-gameplay-3d | moyen |
| 7 | **Coquillages et rivière** (activité cochée par le client): 6 à 8 trouvailles de berge selon l'heure et la pluie, achetées par Solange et le café; plus plume et girolle pour compléter le tableau des prix | `commun/ressources/`, `commun/objets/`, carte (berges), `commerces/` | ramassage à la touche d'action sur la berge, conditions respectées, vente au bon commerçant | game-designer, level-designer (placement), artiste-3d, artiste-2d (vignettes) | moyen |
| 8 | **Saisons et météo à l'écran**: feuilles d'ambiance des quatre saisons d'Aubrune, feuillage d'automne, neige au sol, pluie et neige qui tombent | `src/rendu/encre/ambiances.json`, `particules.ts` | capture de chaque saison et de la pluie, notée par le manager | tech-artist | moyen |
| 9 | **Salle d'eau** (120 €, douche) et savon parfumé (1,50 €, Soigné à 1,3) | `logements/maison-du-garde.json`, `commun/meubles/`, `commerces/mercerie-merigot.json` | la douche remet l'hygiène à 100 en 3 s; le savon porte le bonus | game-designer, artiste-3d, dev-gameplay-3d (bonus du savon) | moyen |
| 10 | **Blocage à 0 et petits trous de règle**: brancher `onlyReliefFor` (faim et sommeil à 0), carnet « Un brin de toilette d'abord », effet de dialogue `adopt_animal` pour les deux poules d'Odette | `src/actions.ts` ou `briques/`, `interface/carnet/quetes.ts`, `regles/effets.ts`, `odette-poules.json` | CA-09; deux poules nommées Pimprenelle et Capucine au poulailler après l'acte 1 | dev-gameplay-3d | petit |
| 11 | **Tourte de la halte**: recette à deux (poste `counter`, second poste), retirer l'étal gratuit de l'épicerie ou le mettre en rayon à prix plein | `commun/recettes/`, `interieurs/epicerie-rdc.json`, `meubles/etal-de-tourte.json` | Mains sûres ne s'obtient qu'en cuisinant; aucune tourte gratuite | game-designer, level-designer | petit |
| 12 | **Trophées de collection**: un meuble trophée unique par collection complète d'Aubrune (8), livré à l'inventaire de la maison | `collections/registre.ts`, `commun/meubles/` | une collection complétée par un test donne son trophée | dev-gameplay-3d, artiste-3d | moyen (après le n° 1) |
| 13 | **Quilles au café** (petite activité, 2 à 6 €), avec la draisine en cours | `src/simulation/` (mini-jeu), carte du café | une partie de 30 à 60 s, seul ou à deux, rapporte selon le score | game-designer, dev-gameplay-3d | moyen |
| 14 | **Petites demandes**: 8 à 10 demandes courtes, une par jour au plus dans le lieu, bulle | `quetes/` (type `errand`), règle de tirage dans `simulation/quetes/` | CA-28 sur 14 jours simulés | game-designer, dev-gameplay-3d (règle d'une par jour) | moyen |
| 15 | **Le bourg change** au fil des actes: volets, vitrines, fumée des maisons rouvertes, conditionnés par les faits d'arrivée | `carte.json` (objets avec `when`), modèles | trois captures (début, après acte 2, après acte 3) | level-designer, artiste-3d | moyen |
| 16 | **Outils restants**: filet amélioré (1,5 m, usure 80, ficelle), marteau amélioré (4 coups), réparation de la canne fine (bobine) | `commun/objets/`, `commun/plans/`, forge et mercerie | CA-18 pour les cinq outils | game-designer, dev-gameplay-3d (portée du filet) | petit |
| 17 | **Gestes à deux** (R12): +50 % de butin quand les deux frappent le même arbre ou le même établi | `outils/ressources.ts`, `fabrication/index.ts` | test: deux joueurs sur un chêne donnent 1,5 fois plus de bûches | dev-gameplay-3d | petit |
| 18 | **Réglages manquants**: « barre d'outils toujours visible », vibration d'écran 0,15 s réglable | `carnet/options.ts`, `src/rendu/camera.ts` | CA-17; vibration sur l'arbre qui tombe et le gros poisson, coupée par « mouvement réduit » | ux-ui-designer, dev-gameplay-3d | petit |
| 19 | **Confidences**: second palier pour les 12 habitants qui n'en ont qu'un (déjà recommandé dans `ecriture-habitants.md` 7.5) | `dialogues/<habitant>-secret-*.json` | 21 habitants à deux paliers; `tests/habitants-aubrune.test.ts` | game-designer | moyen |
| 20 | **Plan du nichoir**: une source (fête ou suite) et un usage (meuble posable au jardin) | `commun/plans/nichoir.json`, `objets/nichoir.json` | le nichoir s'obtient et se pose | game-designer | petit (après le n° 1) |
| 21 | **Changer d'apparence et de genre chez Solange** | mercerie, éditeur | Q11 du cahier; libre et gratuit | ux-ui-designer, dev (avec la mission des tenues) | petit |

Chantiers ouverts à finir, non recomptés ici: tenues (collection, vêtements en vente, souvenir de tenue), draisine (fin des lettres en retard, course), pêche de la Baronne, décor des fêtes, trains à l'écran.

Estimation d'ensemble: 4 gros ou moyens qui portent le plaisir (1, 2, 3, 6), une dizaine de moyens, une dizaine de petits; environ 25 à 30 missions de membres, plus les chantiers en cours.

## C. Ce que je propose de retirer du contrat (à faire valider par le client)

| # | Ligne du cahier | Pourquoi elle n'a plus de sens | Recommandation |
|---|---|---|---|
| C.1 | Nour Belkacem et Inès Garrigue (6.2) | les fêtes et les collections sont écrites et jouables sans eux; Martial, Rosalie et le Contrôleur portent l'après-histoire; 21 habitants écrits dépassent les 20 promis | les retirer d'Aubrune; les garder en réserve pour un autre lieu |
| C.2 | Armand acheteur (colonne « école » de 4.6: plumes, coquilles, insectes, fossiles en double) | l'école n'est pas un commerce; les insectes ne sont pas des objets du sac (ils vont au carnet) | retirer la colonne; les coquilles et les plumes vont à Solange et au café, les insectes ne se vendent pas |
| C.3 | Fossile en plusieurs morceaux à assembler (4.7) | aucune entrée ne le demande, le carnet des trésors est complet à 12 | retirer pour Aubrune |
| C.4 | Pellicule, appareil amélioré et fin, photo posée en cadre (4.5, 4.7) | la photo marche sans pellicule; les cadres existent comme meubles décoratifs | retirer la pellicule et les rangs d'appareil; garder les cadres comme décor |
| C.5 | Sac de toile à 35 € et sac à dos à 90 € « après l'acte 2 » (4.5) | décision du client du 10 novembre: sac de toile offert en fin d'acte 2, sac à dos en fin d'acte 3 | acter les deux cadeaux; garder le sac de toile en vente (35 €) pour le second joueur pressé |
| C.6 | Guichet de consigne dans chaque gare (4.1, CA-20) | le coffre commun s'utilise depuis le carnet, partout, ce qui est plus simple | acter « depuis le carnet, partout » et réécrire CA-20 |
| C.7 | Meule gratuite chez Mado, quatre tours (4.5) | la réparation est payée 2 € à la forge, et la pierre à aiguiser se vend 1,50 € | acter le prix; supprimer la meule |
| C.8 | Ricochets et balles de foin (4.7, petites activités) | le client veut « quelques » activités secondaires; la draisine est en cours, les quilles suffisent | garder draisine et quilles, retirer ricochets et foin |
| C.9 | Partager un repas spécial avec un habitant: 40 points (4.9) | le repas spécial se mange à deux à la maison; inviter un habitant demande une scène nouvelle | retirer pour Aubrune |
| C.10 | Instrument qui se désaccorde, diapason, accordage chez Armand (4.5) | complique la musique avant qu'elle existe | garder la musique jouée (B.3), sans désaccord |

## D. Contradictions entre documents

1. **Direction artistique**: le cahier (1, 7, 4.12) parle de maquette de train miniature, de figurines lisses, d'adultes de 5 têtes et d'une vue de 28 m; le client a choisi le 10 novembre le style « encré », des personnages d'environ 7 têtes, une caméra à 50 degrés et un zoom de jeu de 18 m. La section 7 est à réécrire d'après `bible-artistique.md`.
2. **« Douze foyers »** (6.3, préparer la halte de nuit) contre « vingt âmes » (décision du client, données de `ceux-qui-partent`).
3. **Premier train « le samedi »** (6.3, acte 2) contre « le lendemain » (décision du client, étape `veille-du-train`).
4. **Départ pour Hautefonte**: le cahier enchaîne Veillée et départ dans la même nuit; le client a choisi « quand on veut après la Veillée » (étape `depart`).
5. **Sacs**: voir C.5. Le sac de toile est à la fois offert (`rosalie-lettre.json`) et vendu.
6. **Confidences**: 2 et 4 cœurs au cahier (4.9); 1 et 2 cœurs dans les données; celle d'Honorine après un service rendu (décision du client), pas à un nombre de cœurs.
7. **Tableau « Débloque » des suites secondaires** (6.4) contre les récompenses écrites: la Baronne donne la perche meunière (pas la friture), le fantôme du moulin le pain perdu (pas de brioche ni de plan du pétrin), la guerre de la soupe deux recettes (pas six) et plus la vraie cuisine (achetée depuis la décision q28), la fanfare de l'argent et des graines (pas d'instruments). Mettre le tableau à jour d'après `ecriture-suites-secondaires.md`.
8. **Nombre d'habitants**: le cahier en compte 20 en comptant Nour, Inès et Martial; `ecriture-habitants.md` dit « les 20 du cahier et Martial » (21, avec Rosalie et le Contrôleur, sans Nour ni Inès).
9. **Prix d'achat** (4.6) contre les rachats relevés le 11 (`economie-aubrune.md` 8): bûche 1,40 € chez Basile (0,60 au cahier), poissons multipliés par 2,4; Basile ne rachète pas de planches; l'épicerie ne rachète plus la pomme.
10. **Moments de sauvegarde**: coucher, aube, étape, voyage, sortie (4.11) contre aube, train, toutes les 5 minutes, pause, sortie (`sauvegarde/README.md`, `duo-game.json`).
11. **Météo**: le cahier en liste cinq; les données ajoutent l'orage (été, et compté comme pluie pour l'arrosage).
12. **Résultat de séance**: le cahier le définit (4.11), `sauvegarde/README.md` dit qu'il n'est pas défini.
13. **Étendue d'Aubrune**: 128 m sur 128 m par lieu chargé (4.12, `technique.md` 3.10) contre une carte de 384 x 256 m (plan version 2 validé par le client).
14. **Signe de l'odeur**: « pff » (bible) contre « Pouah » (interface), déjà relevé en 9, toujours ouvert.
15. **Choix de genre**: la liste des décisions du soir du 10 novembre dit encore « aucun choix de genre » avant la correction du même soir; le cahier (1.5) suit la correction. Ajouter une note en tête de la décision corrigée.
16. **Cuisine de la guerre de la soupe**: le cahier la donne comme plan débloqué par la suite (6.4), alors qu'elle s'achète 150 € dès le jour 5 (4.6, décision q28).

## E. Corrigé en données (partie 2)

Voir la section du même nom dans le compte rendu de mission; fichiers listés ci-dessous.

- Plan de l'arrosoir de cuivre donné par Mado après la hache forgée: `dialogues/mado-plan-arrosoir.json` (nouveau).
- Plan de l'étagère donné par Basile à la chambre finie: `dialogues/basile-fait-chambre.json`.
- Plan du coffre à linge donné par Basile à la troisième pièce finie: `dialogues/basile-fait-piece.json`, `commun/plans/coffre-a-linge-campagne.json` (`source: villager`, aucun commerce ne vend de plan).
- Potager de 12 cases et poulailler de 6 places à l'arrivée des Delmas: `dialogues/margot-potager.json` (nouveau).
- Potager de 24 cases et poulailler de 8 places après la Veillée: `dialogues/paulin-grand-potager.json` (nouveau).
- Soupe offerte par Odette, une fois par jour, à qui a faim à 0 et moins d'un euro: `dialogues/odette-soupe-offerte.json` (nouveau).
