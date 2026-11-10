# Refonte de La Petite Ligne: audit technique et plan d'architecture

| | |
|---|---|
| Version | 0.1 (2026-11-10) |
| Auteur | architecte-technique |
| Statut | proposition, à valider par le manager puis à formaliser par ADR (section 7) |
| Sources | `reponses-client-2026-11-10.md` (fait foi), `references-de-ressenti.md` section 3 (exigences), `retours/2026-11-04/retours.md`, ADR 0005, 0007, 0009, 0010, 0013, 0016, `docs/production/meshy.md`, code de `games/la-petite-ligne` 0.13.0 |

Les règles de ressenti de `references-de-ressenti.md` (section 3) sont prises ici comme exigences techniques. Elles sont citées « RR » suivies du sujet (RR Réponse, RR Caméra, RR Attente...).

## En bref

1. **Le moteur est sain, le contenu est jetable.** Sur 99 407 lignes de TypeScript hors tests (300 fichiers), 16 % se gardent tels quels, 37 % s'adaptent, 28 % se réécrivent et 19 % disparaissent. Les 161 fichiers de tests (1 343 cas) tombent presque tous avec l'ancien contenu.
2. **Recommandation: un nouveau paquet de jeu**, monté module par module à partir des modules sains, toujours vert et toujours jouable, plutôt qu'une refonte en place qui laisserait le paquet cassé pendant des semaines. L'ancien paquet reste publiable tel quel jusqu'à l'Alpha de la refonte, puis il est supprimé.
3. **Le risque numéro un est réseau**: l'état part aujourd'hui en un seul message JSON (11 Ko au départ, 52 Ko au jour 25 d'une vraie partie) alors que le SDK arrête la partie des deux côtés au-delà de 64 Kio. La refonte découpe l'état en tranches, une par canal, chacune avec un budget testé.
4. **Deux joueurs, un seul lieu actif**: le train exige d'être ensemble, donc un seul lieu est simulé, chargé et transmis à la fois. C'est la simplification qui rend les lieux abordables.
5. **Caméra libre**: moins coûteuse que prévu. La coupe des murs travaille déjà sur un angle continu; rien ne lit le « quart de tour » de la caméra. Le vrai travail est ailleurs: occultation dehors, ombres stables en rotation, fondu des coupes.
6. **Personnages modulaires**: squelette du studio à 18 os conservé (49 clips existants), pièces de Meshy conformées dans Blender, fusion en un seul maillage par personnage à l'assemblage: un appel de dessin par personnage et par passe.
7. **Jalon 1 (socle jouable à deux)**: environ 125 heures d'agent, revue et recette comprises, 12 lots, dont 9 parallélisables sans conflit de fichiers après un lot de contrats de 6 heures.

## 1. Audit

### 1.1 Volumes mesurés (0.13.0, commit `334e5fb`)

| Ensemble | Fichiers | Lignes | Remarque |
|---|---|---|---|
| `src/` hors tests | 300 | 99 407 | rendu 34 277, simulation 20 397, interface 19 187, données (lecture) 8 986, état 7 543, audio 5 649, sauvegarde 1 176, réseau 936, entrées 373, plateforme 352, `main.ts` et `session.ts` 531 |
| Pages de démonstration | 19 | 5 033 | `src/rendu/demo`, `src/interface/demo`, `src/audio/banc` |
| Tests | 161 | environ 36 000 | 80 dans `tests/` (20 328 lignes), 46 à côté du code (rendu 32, audio 14), 35 dans `src/interface/tests`, plus `tests/ete`, `tests/longue-vie`, `tests/e2e`; 1 343 cas |
| Sauvegardes de référence | 61 | 3,5 Mo | `tests/donnees/sauvegardes/`, formats 1 à 15 |
| Données de contenu | 25 JSON | environ 16 000 | `donnees/`: 78 quêtes (3 454 lignes), 21 habitants (3 844), carte (2 124), vêtements, moments, vie |
| Modèles | 11 GLB | 31 Mo | `personnages.glb` 11,5 Mo (109 maillages, 95 432 triangles, 1 squelette de 18 os, 49 clips, 1 matériau), `bourg.glb` 6,8 Mo, `village013.glb` 5,4 Mo |
| Sources d'assets | | 38 Mo | `assets-src/` (scripts Blender et son) |
| Paquet construit | | 26 Mo | `dist/` |

Classement des 300 fichiers de `src/` (script jetable, hors dépôt):

| Sort | Fichiers | Lignes | Part |
|---|---|---|---|
| Garder tel quel | 86 | 15 511 | 16 % |
| Adapter, petit (moins de 20 % du fichier) | 37 | 9 864 | 10 % |
| Adapter, moyen (20 à 50 %) | 52 | 24 371 | 24 % |
| Adapter, gros (plus de 50 %, structure gardée) | 2 | 2 965 | 3 % |
| Réécrire | 57 | 28 174 | 28 % |
| Supprimer | 66 | 18 522 | 19 % |

### 1.2 Module par module

Chemins relatifs à `games/la-petite-ligne/src/`.

**Réseau (`reseau/`, 936 lignes)**

| Sort | Fichiers | Pourquoi |
|---|---|---|
| Garder | `hote.ts` (213) | file des commandes de l'invité, rattrapage après gigue, accusé `ack`: réglé sur banc, sans lien avec le contenu |
| Adapter, moyen | `invite.ts` (401) | prédiction du déplacement et interpolation à garder; à ajouter: vidage des instantanés au changement de lieu, prédiction du début de geste (RR Réponse) |
| Réécrire | `schemas.ts` (229), `etat-transmis.ts` (93) | 65 intentions de l'ancien contenu; état en un seul message, contrôlé par sa seule forme (`looksLikeWorld`) |

**Simulation (`simulation/`, 20 397 lignes)**

| Sort | Fichiers | Pourquoi |
|---|---|---|
| Garder (729) | `grille.ts`, `meteo.ts`, `deblocage.ts`, `simultane.ts`, `constantes.ts`, `empreinte.ts` | A*, collisions, tirage de la météo, sortie de blocage |
| Adapter, petit (1 716) | `contexte.ts`, `potager.ts`, `parcelles.ts`, `bancs.ts`, `interieurs.ts`, `effets.ts`, `rangement.ts` | carte par lieu au lieu d'une carte unique; potager déjà indulgent |
| Adapter, moyen (5 548) | `deplacement.ts`, `horloge.ts`, `conditions.ts`, `quetes.ts`, `sac.ts`, `habitants.ts`, `voisins.ts`, `vie.ts`, `amitie.ts`, `reactions.ts`, `agir.ts`, `amenagement.ts`, `pieces.ts`, `construction.ts`, `chantiers.ts` | moteurs génériques à garder (conditions et effets pilotés par les données, plannings, visée et action à une touche, pose de meubles, pièces de maison); vocabulaire et règles à changer |
| Réécrire (5 075) | `pas.ts`, `intentions.ts`, `monde.ts`, `dialogues.ts`, `besoins.ts`, `peche.ts`, `ombres.ts`, `poules.ts`, `economie.ts`, `epicerie.ts`, `train.ts`, `vetements.ts`, `salon.ts`, `catalogue.ts`, `ids.ts` | `pas.ts` importe 40 modules de contenu; dialogues linéaires; besoins « bonus seulement »; pêche et basse-cour à revoir; vente par commerçant; voyage |
| Supprimer (7 329) | `robot.ts` (1 943), `moments.ts`, `decor.ts`, `marche.ts`, `chevres.ts`, `bourg.ts`, `annonces.ts`, `courrier.ts`, `plis.ts`, `semaine.ts`, `secrets.ts`, `souvenirs.ts`, `envies.ts`, `decisions.ts`, `fin.ts`, `portages.ts`, `astuces.ts`, `lisiere.ts`, `drapeaux.ts`, `chat.ts` | commande du samedi et étapes de la démo, étal, micro-quêtes, gestes de décor (source de R05, R11, R17, R21), robot joueur de parties longues |

**État (`etat/`, 7 543 lignes)**: garder `murs.ts`, `tirage.ts`, `options-graphiques.ts`, `meteo.ts` (580); adapter `carte.ts`, `actions.ts`, `vue.ts`, `interieurs.ts`, `bancs.ts`, `parcelles.ts`, `maison.ts`, `planning.ts`, `voisins.ts`, `vie.ts`, `gestes-habitants.ts` et voisins (2 951); réécrire `types.ts` (1 700 lignes, plus de 100 champs à la racine de `WorldState`), `peche.ts`, `elevage.ts`, `garde-robe.ts`, `quete.ts`, `epicerie.ts`, `catalogue.ts` (2 509); supprimer les 11 fichiers d'état de l'ancien contenu (1 503).

**Lecture des données (`donnees/`, 8 986 lignes)**: garder `lecteur.ts`, `fichiers.ts`, `cartes-fichiers.ts`; adapter `carte.ts`, `carte-niveau.ts`, `carte-interieurs.ts`, `monnaie.ts` (le renommage de monnaie y existe déjà), `calendrier.ts`, `maison.ts`, `vie.ts`, `voisins.ts`; **réécrire `contenu.ts` (2 889 lignes de lecture écrite à la main) et `types.ts` (1 516)** en schémas Valibot, source unique des types et des validateurs; supprimer `carte-secours.ts`, `bourg.ts`, `effets-drapeaux.ts`, `marche.ts`, `decisions.ts`, `commandes.ts`, `plis.ts`.

**Rendu (`rendu/`, 34 277 lignes)**

| Sort | Fichiers | Pourquoi |
|---|---|---|
| Garder (48 fichiers, 10 119) | `ressources.ts`, `instances.ts`, `lots.ts`, `materiaux.ts`, `palette.ts`, `geometrie.ts`, `ombre-tri.ts`, `qualite.ts`, `options-graphiques.ts`, `perf.ts`, `ciel.ts`, `etoiles.ts`, `pluie.ts`, `particules.ts`, `eau.ts`, `occlusion.ts`, `coupe-murs.ts`, `decor.ts`, `vegetation.ts`, `surfaces.ts`, `champs.ts`, `brume.ts`, `lueurs.ts`, `vers-luisants.ts`, `riviere.ts`, `gue.ts`, `bief.ts`, `ru.ts`, `foulee.ts`, `portee.ts`, `attentes.ts`, `coucher.ts`... | socle du rendu: suivi et libération des ressources, lots instanciés par morceaux, qualité adaptative, panneau Options, ambiance |
| Adapter, petit (4 968) | `lumiere.ts`, `effets.ts`, `signes.ts`, `contexte.ts`, `faune-ambiance.ts`, `potager.ts`, `parcelles.ts`, `voie.ts`, `prise.ts`, `gabarit.ts`, `gestes.ts`, réglages d'ambiance | nuit jouable, ombres stables en rotation, émotions au-dessus des têtes |
| Adapter, moyen (6 826) | `moteur.ts` (1 363), `modeles.ts`, `interieurs.ts` (1 293), `reglages.ts`, `contour.ts`, `portraits.ts`, `apercu-tenue.ts`, `accessoires.ts`, `vie.ts`, `ambiance.ts` | chargement et déchargement d'un lieu, fondu des coupes, cible qui réagit, visionneuse 3D des menus |
| Adapter, gros (2 965) | `terrain.ts` (2 053), `maison.ts` (912) | terrain générique par lieu; maison à pièces, étage, mode déco |
| Réécrire (5 236) | `camera.ts`, `personnages.ts` (1 853), `habillage.ts`, `apparence.ts`, `peche.ts`, `peche-vue.ts`, `ombres-poissons.ts`, `elevage.ts`, `bulles.ts` | caméra libre; personnages modulaires; pêche et basse-cour refaites; bulles remplacées par la fenêtre de dialogue |
| Supprimer (4 163) | `moments.ts` (1 463), `substituts.ts` (1 408), `substituts-gestes.ts`, `gestes-decor.ts`, `marche.ts`, `chantiers.ts`, `chat.ts`, `portage-deux.ts`, `retouches.ts` | scènes et gestes de l'ancien contenu, formes de remplacement des modèles de l'ancien contenu (le mécanisme se réécrit en court) |

**Interface (`interface/`, 19 187 lignes)**: garder le socle DOM (`dom.ts`, `composant.ts`, `focus.ts`, `typographie.ts`, `icones.ts`, `sons.ts`, `options.ts`, `format.ts`, `panneau.ts`, `notifications.ts`, `refus.ts`: 14 fichiers, 1 468 lignes); adapter `interface.ts`, `hud.ts`, `config.ts`, `textes.ts`, `apercu.ts`, `portrait.ts`, `modele.ts` (4 876); réécrire les 17 écrans et leurs modèles (carnet, dialogue, panneaux, garde-robe, maison, voisins, quêtes, basse-cour, vitrine: 9 077); supprimer 14 fichiers (tableau, salon, décision, proposition, moments, souvenirs, étapes, secrets, marché: 3 766). La réponse 75 et les réponses 31 et 64 demandent « un gros effort » d'interface: c'est le module le plus refait.

**Audio (`audio/`, 5 649 lignes)**: garder le moteur, les bus, la spatialisation, la musique, les voix (babil), la mémoire (9 fichiers, 2 135); adapter `catalogue.ts`, `declencheurs.ts` (1 087), `cerveau.ts`, `reglages.ts` (musique par lieu, heure et météo; sons du monde déclenchés par les événements de l'hôte, voir 4); supprimer `village.ts`, `moments.ts`, `train.ts`.

**Le reste**: `sauvegarde/sauvegarde.ts` (1 016) se réécrit (15 migrations de formats abandonnés); `entrees/commandes.ts` s'adapte (molette, rotation continue, plus de clic pour marcher: réponse 16); `session.ts` et `main.ts` s'adaptent peu; `plateforme/` se garde.

### 1.3 Données, assets, tests

| Sort | Quoi | Chemins |
|---|---|---|
| Supprimer | tout le contenu écrit: quêtes, habitants, moments, envies, décisions, courrier, annonces, marché, gestes, vie, notes de version | `donnees/quetes.json`, `habitants.json`, `habitants-0-13.json`, `moments.json`, `envies.json`, `decisions.json`, `courrier.json`, `annonces.json`, `marche.json`, `gestes-0-13.json`, `gestes-joueurs.json`, `vie.json`, `astuces.json`, `cartes-tour-10/` |
| Garder comme matière | objets, cultures, pièces de maison, calendrier, réglages (à trier clé par clé par le game designer) | `donnees/objets.json`, `cultures.json`, `pieces.json`, `calendrier.json`, `reglages.json` |
| À décider (question 7.2, Q3) | la carte d'Aubrune et ses modèles | `donnees/cartes/halte.json`, `assets/modeles/bourg.glb`, `village013.glb`, `maison.glb`, `foret013.glb` |
| Garder | modèles de nature, ferme, faune, poissons, train; sons d'ambiance et d'effets; chaîne Blender et chaîne son | `assets/modeles/{ferme,faune,poissons,train,elevage}.glb`, `assets/son/`, `assets-src/` |
| Remplacer | personnages (rendu à facettes, pièces non modulaires) | `assets/modeles/personnages.glb`; les 49 clips et le squelette se gardent (3.4) |
| Supprimer | les 61 sauvegardes de référence, les robots longs, les tests de contenu | `tests/donnees/sauvegardes/`, `tests/ete`, `tests/longue-vie`, les 12 fichiers de `vitest.longues.ts`, `vitest.ete.config.ts`, `vitest.longue-vie.config.ts` |
| Supprimer | les deux validateurs Python de données (doublon des schémas) | `outils/valider_donnees.py`; `outils/valider_carte.py` reste tant que la carte est produite en Python |

Tests: sur 161 fichiers, environ 25 survivent presque tels quels (réseau: `reseau.test.ts`, `invite-fluidite.test.ts`, `invite-connexion-tardive.test.ts`, `hote-devine.test.ts`; rendu pur: `qualite`, `options-graphiques`, `ombre-tri`, `coupe-murs`, `lumiere`, `occlusion`, `lisse`, `palette`; audio: `moteur-bus`, `musique`, `espace`, `voix`, `variantes`, `memoire`; socle: `manifeste`, `clavier`, `regles`), environ 20 s'adaptent (sac, parcelles, pose murale, visée, déplacement, intérieurs), et environ 115 disparaissent avec leur objet.

### 1.4 Ce que l'audit apprend d'utile pour la suite

- **Séparation simulation et rendu tenue**: `session.ts` (269 lignes) fait tourner une partie sans DOM; la simulation n'importe ni Three.js ni le DOM. C'est ce qui rend la reprise module par module possible.
- **Couplage du moteur au contenu**: des prénoms d'habitants apparaissent dans 25 fichiers de `simulation/`, 17 d'`interface/`, 13 de `rendu/`; `ids.ts` nomme 15 points, 7 objets et 2 quêtes. Règle de la refonte: le moteur ne nomme aucun habitant, lieu ni objet; tout passe par les données.
- **Déjà là et à réemployer**: action à une touche (`act`, `updateAim` dans `agir.ts`), piles limitées par objet (`stack` de `objets.json`, `stackLimit` dans `sac.ts`), plannings d'habitants, amitié à cœurs, scène à deux où chacun choisit, portraits 3D rendus une fois (`portraits.ts`), aperçu 3D de tenue (`apercu-tenue.ts`), fusion de tenue en un maillage (`mergeOutfit` dans `habillage.ts`), proportions par os (`gabarit.ts`, `villagerScale`), panneau Options et qualité adaptative, lots instanciés éliminés par morceaux (ADR 0016).

## 2. Décision à recommander: en place ou nouveau paquet

### 2.1 Options

| | A. Refondre dans `games/la-petite-ligne` | B. Nouveau paquet, modules sains repris un par un |
|---|---|---|
| Départ | on retire 18 500 lignes, 115 tests et le contenu; tout casse d'un coup (`types.ts`, `pas.ts`, `contenu.ts` tiennent tout) | paquet vide issu de `games/_template`, vert dès le premier jour |
| Pendant | paquet rouge pendant des semaines; impossible de publier un correctif de la 0.13 | chaque module arrive avec son test court; l'ancien paquet reste publiable |
| Historique git | conservé | perdu pour les fichiers copiés (l'ancien dossier reste consultable jusqu'à sa suppression) |
| Risque | traîner des restes de l'ancien contenu (prénoms dans le moteur, champs morts de l'état) | copie de code: contraire à la règle « jamais copié d'un jeu à l'autre » tant que les deux dossiers coexistent |
| Lecture pour les membres | 100 000 lignes dont la moitié morte | seulement ce qui sert |

### 2.2 Recommandation

**Option B: un nouveau paquet**, avec trois garde-fous:

1. La copie est un déménagement: chaque fichier repris est listé dans un tableau de reprise (`docs/jeux/jeu-1/refonte/reprise.md`: fichier d'origine, sort, lot), et **l'ancien dossier est supprimé à l'Alpha de la refonte** (date à inscrire dans l'ADR). Entre-temps, il est gelé: aucun développement, correctifs bloquants seulement.
2. Les modules repris passent la grille de revue à l'entrée: plus aucun prénom ni identifiant de contenu dans le moteur, noms sans numéro de version (`gestes-0-13`, `village013`, `cartes-tour-10` disparaissent).
3. Rien ne sort vers un paquet partagé pour l'instant: Deux Tabliers n'a pas les mêmes besoins (vue subjective), et le principe « pas d'abstraction pour un seul cas » s'applique. À revoir quand un troisième jeu 3D en vue de dessus arrivera.

### 2.3 Identifiant du jeu et sauvegardes

L'ADR 0005 dit l'identifiant « stable pour toujours » et égal au nom du dossier; il est la clé des sauvegardes et de l'historique.

| | Même identifiant `la-petite-ligne` | Nouvel identifiant |
|---|---|---|
| Bibliothèque du client | une seule tuile, la refonte arrive comme une mise à jour et **remplace** la 0.13 dès le jalon 1 | deux tuiles pendant la refonte; l'ancienne est retirée à l'Alpha |
| Anciennes sauvegardes | présentes sur les deux machines; il faut un chemin « ancienne partie, on repart de zéro » | aucune: départ propre |
| Piège connu | aujourd'hui, une sauvegarde refusée met la séance en « aucune écriture » (`session.ts`): avec le même identifiant, les joueurs ne pourraient plus jamais enregistrer tant que ce chemin n'est pas refait | sans objet |
| Historique et score cumulé | continus | repartent de zéro (cohérent avec la réponse 7) |
| Dossier de travail | le nouveau dossier doit s'appeler `la-petite-ligne`: échange de dossiers le jour du jalon 1 | libre |

**Recommandation: nouvel identifiant** (proposition `petite-ligne`, nom affiché inchangé « La Petite Ligne »; le nom du jeu reste juste, la ligne relie les lieux). Raisons: la 0.13 reste jouable tant que la refonte n'a pas plus à offrir, les premiers jalons ne détruisent rien chez le client, et le piège de la sauvegarde refusée disparaît. C'est au client de trancher (Q1): cela touche sa bibliothèque.

Format de sauvegarde: `dataSchema` repart à 1. Jusqu'à l'Alpha, une sauvegarde peut être remise à zéro à chaque jalon (annoncé dans « Quoi de neuf »), avec un message clair en jeu et sans blocage de l'écriture. À partir de l'Alpha, toute évolution du format est migrée et couverte par **une** sauvegarde de référence par format (et non 61). Un emplacement, 1 Mio au plus (inchangé); budget interne 512 Ko, testé sur un état fabriqué « au pire ».

À vérifier avec ingenieur-build: retrait d'un jeu du catalogue et sort de ses fichiers chez le client (l'ADR 0010 ne le décrit pas).

## 3. Architecture cible

### 3.1 Arborescence du nouveau paquet

```text
games/<id>/
  donnees/
    commun/            objets, outils, recettes, besoins, sacs, temps, personnages/catalogue.json
    lieux/<lieu>/      lieu.json, carte.json, habitants.json, commerces.json,
                       quetes/*.json, dialogues/*.json, scenes/*.json, textes.json
  assets/
    commun/            personnages/*.glb, objets.glb, son/
    lieux/<lieu>/      decor.glb, son/
  src/
    donnees/schemas/   schémas Valibot: source unique des types et des validateurs
    etat/              état par domaine: commun, joueur, progression, lieu
    simulation/        noyau (pas, déplacement, visée) et un dossier par système
    reseau/            canaux, tranches, hôte, invité
    rendu/             moteur, camera, lieu/, personnages/, visionneuse/
    interface/         socle, dialogue, carnet, hud, menus
    audio/  entrees/  sauvegarde/  plateforme/
```

Règle de découpe: un système (besoins, sac, quêtes, dialogues, commerces, potager, pêche...) possède son fichier d'état, ses intentions, ses événements et son test court. Les intentions et les événements sont des unions assemblées dans un seul fichier à partir de tableaux par système (motif éprouvé sur Deux Tabliers: tableau `as const` étalé dans `v.variant`), ce qui évite que dix lots modifient le même fichier.

### 3.2 Lieux

**Principe: un seul lieu actif.** Le train exige les deux joueurs (réponse 9) et il n'y a pas de jeu en solo (réponse 15): la simulation, le rendu et le réseau ne traitent que le lieu où sont les joueurs. Les autres lieux sont des données dormantes dans l'état.

```ts
interface WorldState {
  schema: number; tick: number; seed: number; rng: [number, number, number, number];
  commun: CommonState;                    // horloge, météo, saison, phase, lieu courant, caisse commune
  joueurs: [PlayerState, PlayerState];    // apparence, besoins, sac, barre, argent, outils, dialogue en cours
  progression: ProgressState;             // quêtes, mémoire, amitiés, collections, recettes, lieux ouverts
  lieux: Record<LieuId, LieuState>;       // tous les lieux visités
}
interface LieuState {
  parti: { jour: number } | null;         // jour du départ, pour le rattrapage au retour
  habitants: Record<VillagerId, VillagerState>;
  objets: PlacedObject[]; sol: GroundItem[]; cultures: SentPlot[];
  maison: HouseState | null; commerces: Record<ShopId, ShopState>;
  drapeaux: string[];                     // faits propres au lieu (pont réparé, commerce relancé)
}
```

- **Données**: `lieu.json` déclare la carte, la gare (point d'arrivée et quai d'embarquement), les habitants, les commerces, les activités disponibles (réponse 28: selon le lieu), la musique et l'ambiance. La carte garde le format actuel de `GameMap` (grille de 1 m, objets, points, pièces), produit et contrôlé par les outils du level designer.
- **Intérieurs**: ADR 0016 conservé (intérieurs sur la carte, coupe des murs pour le joueur local). L'appartement de la métropole, à l'étage d'un immeuble, se pose à l'écart sur la même grille et se rejoint par une porte qui téléporte: une seule grille, une seule simulation, et le rendu n'en paie que la vue (ADR 0016: le coût suit la vue).
- **Voyage** (machine à états dans `commun.phase`): `jour` puis `embarquement` (les deux sur le quai, chacun confirme) puis `voyage` (scène du train, 20 à 40 s, qui couvre le chargement) puis `arrivee`. L'hôte fige le lieu quitté (`parti`), l'invité charge les données du lieu depuis son propre paquet (mêmes versions garanties par la poignée de main, ADR 0006) et envoie `lieu_pret`; l'hôte attend les deux, avec un message après 30 s. Au retour dans un lieu, un rattrapage simple et borné rejoue les jours écoulés (cultures, stocks des commerces), sans simuler les habitants.
- **Chargement et déchargement au rendu**: `Renderer.chargerLieu(id)` libère tout ce qui appartient au lieu par un `ResourceTracker` par lieu (classe existante) et garde le commun (personnages, matériaux, interface). Les données d'un lieu sont un morceau de code à part (`import()` dynamique), pour ne pas tout analyser au démarrage. Contrôle: après dix allers-retours, `renderer.info.memory` (géométries, textures) et le nombre de programmes reviennent à leur valeur de départ.
- **Ajout d'un lieu par mise à jour**: un lieu est un dossier de données et un dossier d'assets, livré par une mise à jour normale du jeu (ADR 0010, paquet complet). Budget: 25 Mo par lieu, 150 Mo pour le paquet; au-delà, il faudra des paquets par lieu (ADR à écrire le moment venu, pas avant).

### 3.3 Quêtes, dialogues, scènes, mémoire

Les moteurs actuels de conditions et d'effets (`conditions.ts`, `effets.ts`: 45 conditions, 23 effets, pilotés par les données) se gardent. On leur ajoute la portée par lieu, la mémoire et les besoins. Tous les fichiers sont validés par schéma Valibot au chargement et par un test de contenu.

```ts
// donnees/lieux/<lieu>/quetes/<suite>.json
interface QuestLine {
  id: string; lieu: LieuId;
  kind: 'principale' | 'secondaire' | 'demande';     // « demande »: les quelques petites demandes (réponse 40)
  title: string; giver: VillagerId | null;
  requires: Condition[];                              // ce qui l'ouvre
  chapters: {
    id: string; title: string;
    steps: {
      id: string; objective: string;
      target: { point: PointId } | { villager: VillagerId } | null;   // repère affiché 3 s à la demande (réponse 68)
      done: Condition[];                              // ce qui la franchit
      together: boolean;                              // exige les deux joueurs (réponse 9)
      onStart: Effect[]; onDone: Effect[];
    }[];
  }[];
}

// donnees/lieux/<lieu>/dialogues/<habitant>.json: un graphe, plus une liste de lignes
interface Dialogue {
  id: string; villager: VillagerId; priority: number;
  when: Condition[]; once: 'duo' | 'player' | null;
  shared: boolean;                                    // scène à deux: chacun voit le choix de l'autre
  start: NodeId; nodes: Record<NodeId, DialogueNode>;
}
type DialogueNode =
  | { kind: 'line'; speaker: string; text: string; emote: Emote | null; next: NodeId | null }
  | { kind: 'choice'; options: { id: string; text: string; when: Condition[]; effects: Effect[]; next: NodeId | null }[] }
  | { kind: 'branch'; cases: { when: Condition[]; next: NodeId }[]; otherwise: NodeId | null }
  | { kind: 'effects'; effects: Effect[]; next: NodeId | null };

// donnees/lieux/<lieu>/scenes/<scene>.json: une suite d'actions jouée par l'hôte
type SceneAction =
  | { do: 'gather'; point: PointId } | { do: 'walk'; who: ActorRef; to: PointId }
  | { do: 'face'; who: ActorRef; toward: ActorRef | PointId } | { do: 'anim'; who: ActorRef; clip: string }
  | { do: 'emote'; who: ActorRef; emote: Emote } | { do: 'camera'; focus: ActorRef | PointId; seconds: number }
  | { do: 'dialogue'; dialogue: string } | { do: 'wait'; seconds: number } | { do: 'effects'; effects: Effect[] };
```

- **Mémoire des actions** (réponse 41): `progression.memoire: Record<string, { v: string | number | boolean; par: 'p1' | 'p2' | 'duo'; jour: number }>`, écrite par l'effet `remember` et lue par la condition `remembered`. Elle remplace les trois magasins actuels (`flags`, `worldStates`, `heard`), qui pesaient 3,4 Ko à eux seuls dans une vraie partie.
- **Hygiène et dialogues** (réponse 23): condition `need_at_least` sur un dialogue ou une option; la remarque d'hygiène est une ligne par caractère d'habitant, insérée par le moteur, et non recopiée dans chaque dialogue.
- **Fenêtre lettre par lettre**: l'état ne porte que le nœud courant de chaque joueur; le défilement, le babil et « tout afficher » (RR Dialogue) sont locaux à chaque machine. Trois lignes par page: le validateur mesure chaque `text` avec la police et la largeur du bandeau.
- **Validateurs de contenu** (test rapide, sans simulation): tout `next` existe, tout nœud est atteignable, aucun cul-de-sac sans fin; chaque point, objet, habitant, quête cité existe dans le lieu; chaque étape a une condition franchissable (un effet d'une étape antérieure, ou une action de joueur, produit ce qu'elle attend); tout objet de quête est effectivement créé (l'effet `spawn_object` sur un point absent est une erreur de validation, cause probable de R16). Chaque suite principale a en plus une simulation courte qui la déroule en injectant les faits (pas de marche).

### 3.4 Personnages modulaires

**Squelette: celui du studio, 18 os, conservé.** Il porte déjà 49 clips écrits pour le jeu (275 Ko) et les proportions actuelles, que le client garde (réponse 45). Le squelette de Meshy (24 os, sans doigts, échelle 0,01) n'entre pas dans le jeu.

| | Squelette du studio (18 os) | Squelette de Meshy (24 os) |
|---|---|---|
| Clips | 49 déjà faits, sur mesure (outils, assise, pêche, portage) | bibliothèque de 678 actions, à 3 crédits l'action |
| Pièces de Meshy | à skinner dans Blender par transfert de poids depuis le corps de référence | skinnées par Meshy, mais un personnage entier à la fois, pas des pièces |
| Risque | qualité du transfert de poids sur les vêtements amples | longueurs d'os différentes d'un rig à l'autre (`meshy.md`, 4.2); tout refaire côté jeu |

**Point ouvert, à trancher dans l'ADR R6**: un essai mené en parallèle le 2026-11-10 (`docs/production/essais-meshy/personnage-modulaire/`, non relu ici en détail) prend au contraire le squelette de Meshy à 24 os comme squelette commun (`squelette-commun.json`). Les deux voies tiennent l'architecture ci-dessous (emplacements, morphologies, fusion, `Look`); elles diffèrent par le coût des animations. Critères de choix: qualité du skinning des pièces amples sur chaque squelette, coût de report des 49 clips existants vers 24 os contre coût d'achat et de retouche des clips de Meshy, fidélité aux proportions actuelles. La recommandation ci-dessus vaut tant que l'essai ne montre pas un skinning nettement meilleur avec le rig de Meshy.

**Chaîne de fabrication** (tech-artist et artiste-3d, scripts Blender existants à étendre): mannequin de référence du studio (adulte, corpulence moyenne) rendu en image; pièce générée par Meshy d'après cette image (topologie intelligente, budget de triangles demandé); mise en conformité par script (alignement sur le mannequin, lissage des normales pour le rendu « figurine », zones de couleur, transfert des poids, coupe de ce que la pièce cache); export dans le GLB de son emplacement; fiche de génération versionnée. Les clips de la bibliothèque de Meshy qui manqueraient se reportent sur les 18 os dans Blender (l'import met chaque pose relativement au repos).

**Emplacements**: `corps`, `tete` (visage en relief, réponse 51), `cheveux`, `haut`, `bas`, `robe` (occupe haut et bas), `chaussures`, `coiffe`, `lunettes`, `accessoire`. Les pièces rigides (lunettes, chapeau, sac) sont rattachées à un os et entrent dans la fusion avec un poids de 1 sur cet os.

**Morphologies** (réponse 48: enfant, adulte, âgé, 2 à 3 corpulences): une morphologie est une table d'échelles et de longueurs d'os appliquée au squelette commun; le corps et les vêtements suivent par le skinning. Les pièces ne sont donc fabriquées qu'une fois. Les clips ne rejouent que les rotations (et la translation des hanches, mise à l'échelle de la jambe). `gabarit.ts` fait déjà ce travail pour les habitants actuels. Limite à éprouver au jalon 1: l'enfant (tête proportionnellement plus grosse) peut demander des têtes et des cheveux à part.

```ts
// donnees/commun/personnages/catalogue.json
interface CharacterCatalogue {
  schema: 1; skeleton: 'duo-18';
  morphologies: { id: string; age: 'enfant' | 'adulte' | 'age'; build: 'mince' | 'moyen' | 'fort';
                  bones: Record<BoneName, { scale: [number, number, number]; length: number }> }[];
  skins: string[];                                    // teintes de peau (palette)
  pieces: {
    id: string; slot: Slot; file: string; node: string;       // GLB de l'emplacement et nœud
    covers: BodyRegion[];                             // régions du corps masquées (rien ne traverse)
    hair: 'libre' | 'aplati' | 'cache' | null;        // effet d'une coiffe sur les cheveux
    zones: { id: string; colors: string[] }[];        // 1 à 3 zones teintables et leurs couleurs permises
    for: 'tous' | 'joueurs' | 'habitants';            // pièces réservées (décision du client)
    ages: ('enfant' | 'adulte' | 'age')[]; tags: string[]; triangles: number;
  }[];
}
// Apparence d'un personnage: ce qui est sauvegardé et synchronisé (150 à 250 octets en JSON)
interface Look { m: string; skin: number; pieces: Partial<Record<Slot, [id: string, ...colors: number[]]>> }
```

**Assemblage à l'exécution: fusion, pas d'instances.** Un maillage skinné par pièce coûterait 8 à 10 appels de dessin par personnage et par passe, soit plus de 250 appels pour 14 personnages avec les ombres: hors budget. À chaque changement d'apparence, les pièces sont fusionnées en **une géométrie skinnée** (`mergeGeometries`, comme `mergeOutfit` aujourd'hui), les couleurs des zones sont écrites en couleurs de sommets, les régions couvertes du corps sont retirées. Résultat: un maillage, un matériau partagé par tous les personnages, **un appel de dessin par personnage et par passe**, un seul programme. La fusion (moins de 10 000 triangles) se fait hors de la boucle d'image; l'éditeur la refait à chaque choix, étalée sur une image.

- **Animations partagées**: les 49 clips sont chargés une fois; chaque personnage a son `AnimationMixer`. Repère mesuré sur Cosy Café: 6 à 13 µs par personnage et par image pour 18 os. `Skeleton.update` envoie une texture d'os par personnage et par image: sans gravité à 14 personnages.
- **Chargement**: un GLB par emplacement, en quantification (`KHR_mesh_quantization`, sans décodeur). Pas de Meshopt ni de Draco: leur décodeur WebAssembly demanderait d'assouplir la CSP. Les GLB d'un emplacement ne se chargent que si une pièce visible en vient; l'éditeur charge le reste à son ouverture.
- **Habitants composés** (décision du client): un habitant écrit a son `Look` dans les données du lieu; un habitant composé (figurant, nouvel arrivant) est tiré du catalogue par la graine, ses étiquettes (`tags` du lieu, âge) et une règle d'unicité (jamais deux fois la même tête avec les mêmes cheveux dans un lieu: réponse 50), puis son `Look` est écrit dans l'état du lieu une fois pour toutes.
- **Éditeur** (réponse 47): un écran d'interface qui modifie un `Look` local et l'affiche dans la visionneuse 3D (3.9); l'intention `set_look` part à la validation; l'hôte contrôle que chaque pièce existe et est permise.
- **Réseau**: le `Look` vit dans la tranche du joueur (3.7). Les habitants écrits ne passent pas par le réseau (chaque machine lit les mêmes données).

### 3.5 Caméra libre et ses conséquences

**Décision proposée**: caméra orthographique conservée, lacet continu sur 360 degrés, zoom continu à la molette (largeur de vue de 8 à 28 m, 14 m par défaut, contre 16, 24 et 36 aujourd'hui), inclinaison non libre (35 degrés, adoucie à 28 degrés au zoom le plus proche). Une caméra en perspective à faible champ fera l'objet d'un prototype de comparaison de 3 heures au jalon 1, montré au client par captures. Raison de garder l'orthographique: aucun horizon à dessiner, aucun niveau de détail, cadre d'ombre exact, budgets de l'ADR 0016 valables.

Commandes: A et E maintenues tournent en continu, clic droit glissé tourne aussi; la molette zoome (elle changeait d'outil: les outils passent aux chiffres et à deux touches). Le déplacement reste au clavier seul (réponse 16): l'action `click` « aller là et agir » disparaît, la souris sert à la caméra, aux menus et au mode déco. Retard léger du suivi (RR Déplacement): déjà là (`followHalfLife`, anticipation `lookAhead`); on ajoute une inertie courte sur la rotation.

Recensement de tout ce qui dépend des quatre angles:

| Sujet | État actuel | Travail |
|---|---|---|
| Rig de caméra | `rendu/camera.ts`: `orientation` entière, `QUARTER_TURN`, trois zooms | réécrire (279 lignes): lacet et zoom continus, mode déco (vue du dessus), mode scène (cadrage imposé) |
| Déplacement relatif à la caméra | `entrees/commandes.ts:207` lit `cameraYaw()` (orientation visée) | petit: lire le lacet affiché; rien ne change dans le réseau ni la simulation (les commandes partent en repère du monde) |
| Coupe des murs | `interieurs.ts:543, 835, 1240`, `maison.ts:212`: produit scalaire du mur avec `toCamera`, seuil `WALL_FACES_CAMERA` | déjà continu. À ajouter: hystérésis autour du seuil (sinon un mur clignote quand on tourne lentement) et **fondu d'opacité** au lieu d'un basculement (RR Caméra: « sans à-coup »); un programme de plus |
| Toits et étages | coupés quand le joueur local est dedans, sans lien avec l'angle | fondu aussi |
| Occultation dehors | aucune: à 36 m de large, le personnage est rarement caché | **nouveau, moyen**: caméra proche, donc un bâtiment ou un houppier entre la caméra et le joueur doit s'effacer (test de boîtes le long du rayon caméra vers joueur, sur les objets proches seulement) |
| Tri | profondeur standard, lots par morceaux | rien |
| Ombres | `lumiere.ts` cadre l'empreinte de la vue, `ombre-tri.ts` écarte les objets hors de l'enveloppe | petit: cadre d'ombre calé sur un cercle (`viewRadius()` existe) et sur la grille des texels, pour que l'ombre ne scintille pas pendant la rotation |
| Élimination hors cadre | par morceaux (ADR 0016) | rien; la vue plus étroite allège le décor |
| Sélection et visée | rayon de la caméra (`camera.ts` `ray`), cible choisie par la simulation (`updateAim`) | rien pour la visée au clavier; le contour blanc (`contour.ts`) devient « l'objet réagit, bulle d'action » (réponse 21) |
| Panneaux face caméra | `signes.ts:254` avec le lacet affiché | rien |
| Audio | `audio/index.ts:144` oriente l'écoute avec `cameraYaw()` | petit: lacet affiché |
| Pose de meubles | `simulation/amenagement.ts` (`quarterOf`): quarts de tour **du meuble**, pas de la caméra | rien; le mode déco garde les quarts de tour |
| Décor et modèles | contrôlés sous quatre angles (`assets-src/modeles/verifier/quatre_*.sh`, 10 scripts) | les modèles ont déjà quatre faces; le zoom proche demande un contrôle de près (normales, jointures) et des captures à angles libres |
| Champ mort | `FrameContext.quarter` (`contexte.ts:19`, écrit dans `moteur.ts:739`, lu nulle part) | supprimer |
| Tests et démos | `rendu/orientation.test.ts`, `tests/orientation-actions.test.ts`, paramètres d'orientation 0 à 3 de `rendu.html` | adapter à un angle en degrés |
| Bord de carte | `edgeMargin` borne le point suivi | vérifier qu'à 28 m de large et à tout angle on ne voit pas le vide (lisière plus large ou borne plus stricte) |

### 3.6 Besoins, temps, inventaire, commerce

- **Temps** (réponses 3 et 4): le jour (6 h à 22 h) dure 30 minutes réelles, la nuit (22 h à 6 h) 20 minutes, soit 1,875 s puis 2,5 s par minute de jeu: `horloge.ts` sait déjà faire varier ce rythme. La nuit est une phase jouée comme le jour; le lendemain arrive seul à 6 h, sans écran bloquant. Dormir saute au matin à partir de 15 h, **quand les deux sont couchés** (Q4). L'enregistrement automatique se cale sur l'aube et toutes les 5 minutes (inchangé).
- **Besoins** (réponses 23 à 26): trois jauges de 0 à 100 par joueur (faim, sommeil, hygiène), décrites par les données et traitées par un seul mécanisme:

```ts
interface NeedDef {
  id: 'faim' | 'sommeil' | 'hygiene';
  decayPerHour: number;                               // par heure de jeu, modulé par l'activité
  tiers: { from: number; state: 'vide' | 'bas' | 'neutre' | 'bonus';
           modifiers: Partial<Modifiers>; blocks: ActionKind[] }[];   // 0, 1 à 20, 21 à 50, 51 à 100
  hysteresis: number;                                 // le bonus tient jusqu'à repasser sous le seuil (réponse 25)
}
interface Modifiers { speed: number; toolPower: number; fishing: number; rareLuck: number; bond: number }
```

  Une fonction pure `modificateurs(joueur)` multiplie les effets des trois jauges et des repas spéciaux (effets à durée), puis borne le total (`maxBonus` des réglages: « pas dieu »). L'interface ne montre une jauge que quand son `state` change (RR Écran).
- **Sac** (réponse 20): `barre` (cases d'outils et d'objets, toujours là) et `sac` (capacité du sac possédé: 0, 4, 6, 10, 15, 20...), piles limitées par objet (`stack`, déjà en place). Une pile: `{ item, n, q? }`. Un outil ne s'empile pas et porte son usure: `{ item, usure }`.
- **Outils** (réponse 19): `OutilDef { base: boolean; durabilite: number; puissance: number; puissanceUsee: number; reparation: { poste: string; cout: Stack[]; argent: number } }`. Un outil de base ne s'use pas; un outil amélioré perd en puissance jusqu'à un plancher, jamais nul.
- **Argent** (réponse 10): `joueur.argent` chacun, `commun.caisse` pour les gros achats. La monnaie change de nom (réponse 13): une clé de texte, `donnees/monnaie.ts` sait déjà le faire.
- **Commerces** (réponses 34 et 64): `commerces.json` par lieu: tenancier, horaires, `vend: { item, prix, stockParJour }[]`, `rachete: { item | categorie, prix }[]`. Un commerçant ne rachète que ce qui est listé, à son prix.
- **Mini-jeux** (pêche, cuisine): joués **sur la machine du joueur**, à partir d'une graine donnée par l'hôte; le résultat part en intention et l'hôte en borne les valeurs. Le partenaire voit l'animation par les événements. C'est ce qui tient RR Réponse sans dépendre du réseau, et la confiance entre les deux machines est admise (ADR 0007, section 7).
- **Mode déco** (réponse 52): un mode de la caméra (vue du dessus, orthographique) et de l'entrée (glisser à la souris); les règles de pose de `amenagement.ts` et `etat/murs.ts` se gardent; chaque glisser envoie des intentions `deco_move` bornées à 10 par seconde, l'aperçu est local.

### 3.7 Réseau

Modèle inchangé: l'hôte fait autorité (ADR 0007), l'invité prédit son déplacement. Ce qui change est le transport de l'état.

**Constat mesuré**: l'état transmis pèse 11 117 octets au départ d'une partie (dont 3,5 Ko pour les deux personnages) et la sauvegarde de référence du jour 25 contient 52 201 octets d'état compact (personnages 11,3 Ko, compteurs 5,7 Ko, habitants 4,4 Ko). Le message part en entier à chaque changement, jusqu'à 5 fois par seconde, et `NetChannel.send` lève une erreur fatale au-delà de 64 Kio. La refonte ajoute des lieux, des collections, une mémoire des actions et des sacs plus grands: le message unique ne tient plus.

**Tranches d'état, une par canal** (mode `latest`: seule la dernière compte; un canal par tranche pour qu'une tranche n'en écrase pas une autre):

| Canal | Contenu | Mode | Quand | Budget |
|---|---|---|---|---|
| 0 `entrees` | commandes et intentions de l'invité | fiable | chaque pas | 2 Ko |
| 1 `commun` | phase, lieu courant, jour, météo, caisse | dernier | au changement | 1 Ko |
| 2 `rapide` | positions des 2 joueurs, des habitants et animaux du lieu (32 au plus), minutes, **jauges des besoins**, accusé | dernier | chaque pas (30 par seconde) | 3 Ko |
| 3 `evenements` | sons, effets, début et fin de geste, refus | fiable | au pas où ils naissent | 4 Ko |
| 4 `joueurs` | sac, barre, argent, apparence, outil en main, nœud de dialogue | dernier | **au pas du changement**, sans cadence | 4 Ko par joueur |
| 5 `progression` | quêtes, mémoire, amitiés, collections, recettes | dernier | au changement, 2 fois par seconde au plus | 24 Ko |
| 6 `lieu` | objets posés, sol, cultures, état discret des habitants, commerces, maison | dernier | au changement, 5 fois par seconde au plus | 24 Ko |
| 7 `activite` | ombres de poissons ou état d'un mini-jeu vu par le partenaire | dernier | pendant l'activité | 4 Ko |

- Chaque tranche a son compteur de révision; un système qui modifie l'état marque sa tranche. Les lieux dormants ne partent jamais.
- **Budget de taille**: 32 Kio au plus par message (la moitié de la limite du SDK), tenu par un test sur un état fabriqué « au pire » (sacs pleins, toutes les quêtes finies, 200 meubles, 40 parcelles). En plus, l'hôte journalise un avertissement au-delà de 75 % du budget, et un envoi qui déborderait est refusé proprement (journal, pas d'exception): plus jamais d'arrêt de partie pour une taille.
- **Validation chez l'invité**: un schéma Valibot par tranche (aujourd'hui, seule la forme générale est regardée).
- **Jauges sur le canal rapide**: elles bougent en continu; dans une tranche, elles provoqueraient un envoi de tout l'état à chaque minute de jeu.

**Exigences de ressenti (RR Réponse: moins de 0,1 s; RR Attente: 1,5 s au plus)**

| Cas | Chemin | Délai |
|---|---|---|
| Geste chez l'hôte | entrée lue au pas (33 ms au plus), image suivante (17 à 33 ms) | 50 à 66 ms |
| Geste chez l'invité, sans prédiction | pas local, aller, pas de l'hôte, retour, image: 3 à 4 pas | 100 à 130 ms sur le LAN, et jusqu'à 200 ms de plus si le retour attend la cadence de l'état |
| Geste chez l'invité, **avec prédiction** | l'invité lance lui-même l'animation, le son et la réaction de la cible au pas de l'appui | 50 à 66 ms |

Décisions qui en découlent:

1. **Prédiction locale du début de geste chez l'invité**: l'invité évalue la cible avec la même fonction pure que l'hôte (`updateAim`; la prédiction du déplacement fait déjà tourner `walkStep` chez lui, mais pas encore la visée: à vérifier par L1 que la visée ne lit que l'état connu de l'invité), joue tout de suite l'animation, le son et le rebond de l'objet, et envoie l'intention. L'hôte confirme par l'événement `geste_debut` (ignoré s'il est déjà joué) ou infirme par `geste_refuse` (l'invité coupe l'animation et joue le refus). Les conséquences (objet dans le sac, quête) n'arrivent que de l'hôte.
2. **La tranche `joueurs` part au pas même du changement** (le plafond de 5 envois par seconde ne s'applique qu'aux tranches lourdes).
3. **Menus et dialogues**: ouverture, navigation, défilement du texte sont locaux; seuls les choix partent.
4. **Durée des gestes dans les données**, bornée par le validateur à 1,5 s pour toute action courante (outil, ramasser, parler, ouvrir); les gestes plus longs (repas à deux, scènes) sont déclarés `long: true` et interruptibles.
5. Le banc de gigue existant (`invite-fluidite.test.ts`: 80 ms de délai, 20 ms de gigue) est repris et étendu à la prédiction du geste: délai mesuré entre l'appui et l'événement local, sous 100 ms.

### 3.8 Sauvegarde

L'état entier (tous les lieux) en JSON, validé par schéma à la lecture. Estimation: joueurs 8 Ko, progression 30 Ko, 15 à 25 Ko par lieu visité, soit environ 150 Ko à cinq lieux; budget interne 512 Ko, limite du manifeste 1 Mio. Les positions des habitants ne s'enregistrent pas (ils reprennent leur planning). Voir 2.3 pour les formats.

### 3.9 Objets 3D dans les menus

Une **visionneuse** unique: un second petit contexte WebGL (256 x 256, vivant seulement quand un menu est ouvert), qui montre l'objet survolé en rotation ou le personnage de l'éditeur. Les autres cases du sac affichent des **vignettes rendues une fois** au chargement dans ce même contexte (comme les portraits 3D actuels, `portraits.ts`), réunies dans une image. Jamais un contexte par case: Chromium en limite le nombre et l'UHD 620 partage sa mémoire. Menu ouvert, la scène principale passe à une image sur deux.

### 3.10 Performances

Machine de référence: Intel UHD 620, 1366 x 768. Réponse 73: la beauté d'abord. Cible: **30 images par seconde tenues sur le PC au préréglage Moyenne**, 60 sur le M1 au préréglage Haute. Repères connus: budget de l'ADR 0016 (225 000 triangles ombres comprises, 150 appels, 12 programmes); plafond relevé par la bible le 2026-11-03 après le retour « très fluide » du client (350 000 triangles, 200 appels).

Budgets par lieu, à la vue la plus chargée, passes principale et d'ombre comprises:

| Poste | Budget | Remarque |
|---|---|---|
| Triangles, total | 350 000 | |
| dont décor et terrain | 200 000 | la vue passe de 36 m à 28 m au plus large: moins de décor à l'écran, plus de détail permis de près |
| dont personnages | 120 000 | joueur 9 000 triangles au plus une fois assemblé, habitant 6 000; 2 joueurs et 12 habitants visibles au pire |
| dont effets, eau, interface 3D | 30 000 | |
| Appels de dessin | 200 | personnages 28 (un par personnage et par passe), décor 140, effets 32 |
| Programmes | 14 | 12 aujourd'hui, plus le fondu des coupes et les couleurs de sommets skinnées |
| Lumières ponctuelles | 4, en nombre constant | le nombre de lampes entre dans la clé des programmes: jamais d'ajout ni de retrait à chaud |
| Textures en mémoire vidéo | 96 Mo | lieu 48, personnages 16, ombres 16, interface et visionneuse 16 |
| Taille de carte | 128 x 128 m | A* mesuré à 1 ms sur 100 m (ADR 0016) |
| Chargement d'un lieu | 8 s sur le PC | couvert par la scène du train |
| Poids d'un lieu dans le paquet | 25 Mo | |
| État d'un lieu sur le réseau | 24 Ko | voir 3.7 |
| Pas de simulation | 2 ms de processeur au pire | 30 pas par seconde |

Niveaux de qualité: le panneau Options existant (Auto, Haute, Moyenne, Basse, Personnalisé; ombres, netteté, effets) se garde. Ajouts: un quatrième réglage « ombres des personnages » (Haute: tous; Moyenne: joueurs et habitants à moins de 12 m; Basse: pastille au sol) et la densité des semis. Le mode Auto change de consigne avec la réponse 73: il ne réduit plus la qualité que sous 24 images par seconde tenues 5 secondes (réglages `autoLight` de `qualite.ts`), et jamais la netteté avant les ombres.

Nuit jouable de 20 minutes: toutes les lampes du lieu brillent par matériau émissif et halo (coût nul en lumières), et les 4 lumières réelles vont aux lampes les plus proches. C'est aussi la correction de R08.

Mesure: `triangleSplit()` et `programsInUse()` existent; ajouter le compte des appels par passe et la mémoire des textures à la page `rendu.html`, avec une liste de vues imposées par lieu (comme T10-04).

## 4. Dette et bugs à solder au passage

Par priorité.

| N° | Sujet | Origine | Parade dans la refonte |
|---|---|---|---|
| 1 | Arrêt de la partie si un message dépasse 64 Kio; l'état unique atteint 52 Ko dans une vraie partie | audit, `packages/sdk/src/net.ts:122` | tranches, budget testé, refus propre (3.7) |
| 2 | Zones d'action sans objet visible, animation sans rapport (s'asseoir dans le vide) | R05, R11, R17, R21 | le module des gestes de décor disparaît; règle de validation: toute interaction est attachée à un objet de la carte, avec un clip et un libellé (RR Cible) |
| 3 | Son du monde joué chez un seul joueur, cloche trop faible, orgue muet | R03, R18, R19 | règle: un son du monde naît d'un événement de l'hôte ou de l'état, jamais d'une entrée locale; portée d'écoute par son dans les données; audit de `audio/declencheurs.ts` |
| 4 | Quêtes qui ne se valident pas, objet de quête introuvable | R07, R16 | validateur de contenu et simulation courte par suite (3.3) |
| 5 | Réverbères allumés seulement de près | R08 | émissif pour tous, lumières réelles en nombre constant (3.10) |
| 6 | Interface qui clignote (nom de recette, portrait) | R09, R13 | l'interface ne se remet à jour que sur la révision de la tranche qu'elle lit, plus sur chaque message d'état |
| 7 | Sauvegarde refusée: plus aucune écriture de la séance | audit, `session.ts` | écran « nouvelle partie » explicite; l'ancienne reste dans les copies de secours de la plateforme |
| 8 | État de l'hôte non validé chez l'invité | audit, `looksLikeWorld` | schéma par tranche |
| 9 | Deux lectures des données (2 889 lignes à la main et un validateur Python) | audit | schémas Valibot, source unique |
| 10 | Moteur qui nomme le contenu; noms à numéro de version | audit (1.4) | grille de reprise (2.2) |
| 11 | `personnages.glb` de 11,5 Mo non compressé | audit | quantification, un GLB par emplacement |
| 12 | Avertissement de Vite sur `vitest.config.ts` (import sans extension) | suite de tests | corrigé en créant les nouvelles configurations |

Ne survivent pas à la refonte, car leur objet disparaît: R02 (bougies), R06, R14, R15 (carte actuelle; à reporter au level designer si la carte d'Aubrune est reprise, Q3), R12 (plan des voisins, remplacé par la carte dessinée de la réponse 66), R20 (basse-cour, refaite: réponse 31). R04 et R10 sont devenus les réponses 68 et 65.

## 5. Jalons et lots

### 5.1 Jalons

| Jalon | Ce qu'on joue à deux | Technique nouvelle |
|---|---|---|
| **J1 Socle** | deux lieux de test en formes simples reliés par un train factice; caméra libre; action à une touche sur trois objets types; trois jauges avec leurs effets; barre et premier sac; un dialogue à choix dans la fenêtre lettre par lettre; un personnage modulaire affiché chez chacun | nouveau paquet, tranches réseau, lieux, caméra, assemblage des personnages, prédiction du geste |
| J2 Vivre | jour de 30 minutes et nuit jouable, dormir, outils qui s'usent et se réparent, commerces par commerçant, potager, mode déco, sac en 3D, habitants à planning avec cœurs, une première suite de quêtes de 5 étapes, éditeur de personnage | moteur de quêtes et de scènes, visionneuse, mode déco, catalogue de pièces élargi |
| J3 Aubrune (Alpha du premier lieu) | carte et art d'Aubrune, sa suite principale, pêche et cuisine en mini-jeux, basse-cour, collections au carnet, maison à restaurer, musique par heure et météo | mini-jeux locaux, maison à pièces et étage, migrations de sauvegarde obligatoires, suppression de l'ancien paquet |
| J4 Métropole | deuxième lieu réel, appartement, activités de ville, commerce en déclin | rattrapage des lieux dormants, intérieur déporté |
| J5 Village hanté | troisième lieu | effets d'ambiance, habitants fantômes |

### 5.2 Lots du jalon 1

| Lot | Rôle | Contenu | Dossiers possédés | Dépend de | Heures |
|---|---|---|---|---|---|
| L0 Contrats | architecte-technique | squelette du paquet, types d'état par tranche, unions d'intentions et d'événements extensibles, schémas des données du J1, ADR R1 à R4 | racine du paquet, `src/etat/`, `src/donnees/schemas/` | décisions Q1 et Q2 | 6 |
| L1 Réseau | dev-reseau | canaux et tranches, hôte et invité repris, attente du voyage, prédiction du geste, test de taille, banc de gigue | `src/reseau/` | L0 | 12 |
| L2 Simulation: noyau | dev-gameplay-3d (1) | pas, intentions, monde, déplacement, lieu courant et voyage, visée et action à une touche, horloge simple | `src/simulation/noyau/`, `src/simulation/voyage/` | L0 | 14 |
| L3 Simulation: systèmes | dev-gameplay-3d (2) | besoins, sac et barre, dialogues (graphe), conditions et effets repris | `src/simulation/{besoins,sac,dialogues,regles}/` | L0 | 12 |
| L4 Rendu: caméra et lieu | dev-gameplay-3d (3) | caméra libre, moteur repris, chargement et déchargement d'un lieu, fondu des coupes, occultation dehors, cible qui réagit | `src/rendu/` sauf `personnages/` | L0 | 16 |
| L5 Pièces de personnage | tech-artist, artiste-3d | mannequin, script de conformité des pièces, catalogue v0 (2 morphologies, 2 têtes, 3 coiffures, 2 pièces par emplacement), GLB par emplacement | `assets-src/personnages/`, `assets/commun/personnages/`, `donnees/commun/personnages/` | L0 (format); budget Meshy 300 crédits | 14 |
| L6 Assemblage | dev-gameplay-3d (4) ou tech-artist | fusion, morphologies, animations partagées, mesure des appels | `src/rendu/personnages/` | L0; démarre sur les pièces actuelles de `personnages.glb`, puis L5 | 10 |
| L7 Interface | ux-ui-designer puis dev-gameplay-2d | maquettes (4 h); socle repris, fenêtre de dialogue, heure et argent, jauges à changement d'état, barre et sac (12 h) | `src/interface/`, `ui-maquettes/` | L0; `interface.md` | 16 |
| L8 Données de test | game-designer, level-designer | deux cartes de test, objets, besoins, sacs, un habitant, un dialogue à choix | `donnees/` | L0 | 6 |
| L9 Son | sound-designer | babil, sons de geste et de refus, ambiance de train | `assets/commun/son/`, `src/audio/` (reprise) | L0 | 4 |
| L10 Build | ingenieur-build | paquet, CI, catalogue, identifiant | `.github/`, manifeste | Q1 | 3 |
| L11 Recette | qa-testeur | plan de test du J1, parcours Playwright à deux contextes, mesures de performances | `tests/e2e/` | tous | 6 |
| Revue | architecte-technique | revue de code des lots, intégration des contrats | | tous | 6 |

Total: environ 125 heures d'agent, dont 113 de production (hors revue et recette). Chemin critique: L0 (6 h), puis L2 et L4 (16 h), puis intégration et recette (12 h): le J1 tient en trois à quatre cycles du soir si L1 à L9 tournent de front.

**Parallélisme sans conflit**: après L0, les lots L1 à L9 possèdent chacun leurs dossiers. Les seuls fichiers communs sont ceux de L0; un lot y ajoute une intention ou un événement par son propre tableau, dans son dossier. `src/session.ts` et `src/main.ts` appartiennent à L2. Chaque lot travaille en copie isolée (`isolation: "worktree"`); le manager intègre dans l'ordre L0, L1, L2, L3, L4, L6, L7, puis les données et le son.

### 5.3 Risques

| Risque | Gravité | Parade |
|---|---|---|
| Le transfert de poids donne des vêtements qui se déchirent ou traversent le corps en mouvement | forte | L5 commence par une pièce ample (jupe) et une pièce ajustée, jugées sur les 49 clips avant de produire le catalogue; régions du corps masquées |
| La morphologie enfant ne tient pas par simple échelle d'os | moyenne | essai au J1; repli: têtes et cheveux propres à l'enfant, catalogue enfant réduit |
| Le PC réel est plus faible que l'hypothèse quand la caméra est proche et les personnages lisses | moyenne | mesures du J1 sur le PC du client (liste « à tester »); réglage « ombres des personnages » |
| Occultation dehors: effacement trop fréquent ou qui clignote | moyenne | hystérésis, fondu, seuils réglés sur les deux lieux de test avant Aubrune |
| Prédiction du geste chez l'invité contredite par l'hôte (cible prise par l'autre joueur) | faible | refus joué proprement; cas couvert par le banc à deux |
| Volume d'écriture (suites longues, plusieurs heures par lieu) sans outil de relecture | forte | validateurs dès le J2, une page de lecture des dialogues générée depuis les données |
| Taille du paquet avec trois lieux et 150 pièces | moyenne | budgets par lieu, quantification; ADR « paquets par lieu » seulement si 150 Mo sont dépassés |
| Deux jeux en production en même temps (Deux Tabliers) et publication du soir | moyenne | la refonte ne publie qu'aux jalons; l'ancien paquet est gelé |

## 6. Méthode de test

Conforme au point 8 du processus (tester en dernier et en petit).

1. **Un test court par nouveauté**: un fichier Vitest par système, qui simule au plus 60 secondes de jeu (1 800 pas) et dure moins de 5 secondes. Exemples du J1: la jauge de faim passe les seuils et change la vitesse; le sac refuse la onzième planche; le voyage attend les deux joueurs; un dialogue à choix arrive au bon nœud.
2. **Contrôles rapides**: types, lint, validateurs de données (schémas, graphes de dialogue, cibles de quête), tailles des tranches réseau et de la sauvegarde sur l'état « au pire ».
3. **Garde-temps**: dans la configuration rapide, `testTimeout` de 20 secondes. Un test qui dépasse échoue et part dans `test:longues`: la suite rapide ne peut pas grossir en silence.
4. **Robots**: plus de robot joueur généraliste (`robot.ts`, 1 943 lignes, supprimé). À la place, de petites aides de scénario (`aller à`, `agir sur`, `choisir`) et l'injection de faits pour dérouler une suite de quêtes sans marcher.
5. **Suite de fin de cycle (10 à 12 minutes pour tout le dépôt, une seule fois avant publication)**: types et lint de tout le monorepo, tests rapides de tous les paquets, construction du jeu publié, un parcours Playwright à deux contextes par jeu publié (J1: créer, parler, manger, prendre le train; environ 2 minutes en rendu logiciel). Budget du nouveau jeu dans cette suite: 4 minutes.
6. **Sorties de la suite rapide** (à lancer à la demande seulement): tout ce qui joue plus d'une journée de jeu; les bancs de mesure de performances; les captures de recette visuelle; les parcours Playwright complets. De l'ancien jeu, rien n'est repris parmi les 12 fichiers de `vitest.longues.ts`, `tests/ete` et `tests/longue-vie`: ils disparaissent avec le robot et les 61 sauvegardes de référence.
7. **Sur les vraies machines** (liste « à tester chez le client » de chaque jalon): fluidité au préréglage Moyenne sur le PC, délai ressenti des gestes chez l'invité, temps de chargement d'un lieu, son.

Mesure du 2026-11-10 sur l'ancien jeu (`vitest run` dans `games/la-petite-ligne`, machine cloud partagée, charge 3 à 4): **16 min 18 s** pour 149 fichiers et 1 247 cas (1 246 passés, 1 sauté, aucun échec), soit déjà plus que le budget de tout le dépôt. Les plus longs: `tests/sauvegarde.test.ts` 434 s, `tests/sauvegardes-reference.test.ts` 349 s, `src/interface/tests/secrets.test.ts` 311 s, `tests/bancs-recette.test.ts` 205 s, `tests/amitie-0-13.test.ts` 130 s, `tests/format-13.test.ts` 117 s, `src/interface/tests/identifiants.test.ts` 104 s, `tests/basile-echelle.test.ts` 101 s (durées par fichier, exécutés en parallèle). Si l'ancien paquet reste publiable pendant la refonte (option B), ces huit fichiers passent dans `vitest.longues.ts`: ils rejouent des sauvegardes et des parties, ce que la règle du 4 novembre réserve à la demande.

## 7. ADR à écrire et questions

### 7.1 ADR (numéros à attribuer à la suite de 0016)

| Titre | Décision proposée |
|---|---|
| R1. Refonte de La Petite Ligne dans un nouveau paquet | Nouveau paquet monté à partir des modules sains, tableau de reprise, ancien paquet gelé puis supprimé à l'Alpha. Identifiant selon Q1; `dataSchema` repart à 1; sauvegardes remises à zéro possibles jusqu'à l'Alpha, migrées ensuite. |
| R2. Lieux: un seul lieu actif | L'état porte tous les lieux, un seul est simulé, rendu et transmis. Voyage en quatre phases avec attente des deux machines. Intérieurs sur la carte (ADR 0016), intérieurs déportés sur la même grille quand il le faut. |
| R3. État en tranches sur le réseau | Une tranche par canal, révision par tranche, budget de 32 Kio testé, refus propre au-delà, schéma par tranche chez l'invité. Jauges et positions sur le canal rapide. Complète l'ADR 0007. |
| R4. Ressenti: prédiction du geste et mini-jeux locaux | L'invité joue le début du geste sans attendre l'hôte, qui confirme ou refuse. Mini-jeux joués localement, résultat borné par l'hôte. Toute action courante dure 1,5 s au plus. |
| R5. Caméra libre orthographique | Lacet et zoom continus, inclinaison liée au zoom, coupes en fondu avec hystérésis, occultation dehors, ombres calées. Perspective écartée sauf résultat contraire du prototype du J1. |
| R6. Personnages modulaires | Squelette du studio à 18 os, pièces de Meshy conformées dans Blender, morphologies par échelles d'os, fusion en un maillage par personnage, `Look` compact synchronisé, GLB quantifiés par emplacement. |
| R7. Données de contenu: schémas uniques, quêtes en suites, dialogues en graphes | Schémas Valibot comme source des types et des validateurs; formats de 3.3; mémoire des actions unique; le moteur ne nomme aucun contenu. |
| R8. Budgets de performances par lieu et niveaux de qualité | Tableau de 3.10; mode Auto qui privilégie la beauté; lumières en nombre constant; vues de mesure imposées par lieu. |
| R9. Objets 3D dans l'interface | Une visionneuse unique dans un second contexte, vignettes rendues une fois; jamais un contexte par case. |

### 7.2 Questions pour le client

| N° | Question | Recommandation |
|---|---|---|
| Q1 | Pendant la refonte, garde-t-on l'ancienne Petite Ligne jouable à côté de la nouvelle (deux tuiles), ou la nouvelle remplace-t-elle l'ancienne dès le premier jalon ? | Deux tuiles jusqu'à ce que la nouvelle ait plus à offrir, puis retrait de l'ancienne. Rien n'est perdu en route. |
| Q2 | La caméra reste-t-elle « à plat » (sans perspective), simplement plus proche et libre, ou veux-tu une vraie perspective ? | Rester à plat; on te montre les deux en images au premier jalon avant de figer. |
| Q3 | Aubrune: repart-on de la carte actuelle du bourg (corrigée et agrandie), ou d'une carte neuve ? | Repartir de la carte actuelle, retouchée: le bourg est connu, les modèles existent, seul le contenu repart de zéro. |
| Q4 | Dormir pour passer au lendemain: faut-il que vous soyez couchés tous les deux ? | Oui; celui qui se couche seul récupère son sommeil, mais le temps ne saute pas. |
| Q5 | Pendant les premiers jalons, acceptes-tu que la partie d'essai reparte de zéro à chaque nouvelle étape ? | Oui jusqu'à l'Alpha du premier lieu; ensuite, vos parties sont toujours conservées. |

### 7.3 Questions pour le manager

- Qui porte l'interface du jeu (L7) entre dev-gameplay-2d et un dev-gameplay-3d ? L'interface actuelle est en DOM sans bibliothèque; la reprise du socle est recommandée.
- Budget de crédits Meshy du J1 (proposé: 300) et du catalogue complet (environ 150 pièces: à chiffrer par tech-artist après l'essai du J1).
- Retrait d'un jeu du catalogue (2.3): à faire préciser par ingenieur-build.

## Historique

| Version | Date | Changement |
|---|---|---|
| 0.1 | 2026-11-10 | Première version: audit, recommandation, architecture cible, jalons, tests, ADR et questions. |
