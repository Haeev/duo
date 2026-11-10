# Recette automatisée à deux joueurs, jalon 1 (socle) de `la-petite-ligne-2`

Date: 2026-11-10. Auteur: qa-testeur. Code mesuré: branche `claude/stoic-lamport-lueey2` au commit `f7d4d7d`, arbre de travail de la mission (tests seuls modifiés). Deuxième passage de la recette (le premier est de la mission L11).

## 1. Comment lancer

```sh
pnpm --filter @duo/sdk-dev build                     # pages du faux hôte, une fois
pnpm --filter @duo/la-petite-ligne-2 test:e2e        # construit le jeu, fabrique les sauvegardes, lance Playwright
```

Toujours avec `--trace off` en plus (`pnpm test:e2e --trace off`) dans l'environnement cloud.

- Hors de la suite rapide: `vitest.config.ts` exclut `tests/e2e/`. Durée de la recette entière: environ 10 minutes en rendu logiciel (un démarrage à deux coûte 15 à 25 s par parcours).
- **Un faux hôte par parcours** (`tests/aides-e2e/serveur.ts`): port libre, dossier de données neuf (`--donnees`, option qui existait déjà: aucun ajout à `packages/sdk-dev`), supprimé à la fin. Deux contextes Chromium (hôte « Loïc », invité « Zoé », 960 x 540) reliés à ce faux hôte, comme le Mac et le PC.
- **Sauvegardes de départ** (`tests/aides-e2e/fabrique-sauvegardes.prep.ts`, lancé par `globalSetup`): `aubrune` (6 h 10, avant la scène d'accueil), `aubrune-apres-scene` (scène lue, étape « lettre » en cours), `aubrune-acte2` (acte 1 fini, acte 2 commencé par le moteur). Le départ réglé du jeu (`reglages.json`) est la gare d'essai: Aubrune ne s'atteint que par une sauvegarde. Elles sont fabriquées par Vitest (le contenu passe par `import.meta.glob`), copiées dans l'emplacement 1 du dossier de données du parcours, et reprises par « Héberger et continuer » avec des profils fixes (`membre-a`, `membre-b`).
- **Sonde d'essai** (`src/plateforme/sonde-essai.ts`): chargée seulement si l'adresse du jeu porte `?sonde=1` (redirection 302 posée par le parcours). Lit le monde, la cible (`aim`), la phase; chez l'hôte seulement, place un joueur, règle une jauge, l'heure ou la bourse.
- Captures de la recette dans `$LPL2_CAPTURES` (par défaut `<tmp>/lpl2-captures/`), mesures dans `mesures.txt`. Captures des défauts versionnées dans `captures/recette-*.png`.

### Diagnostic de l'intégrateur: confirmé

Les échecs en série n'étaient pas ceux du jeu. Avec une sauvegarde dans le dossier de données (laissée par le parcours précédent), l'accueil du faux hôte propose « Héberger et continuer » et « Héberger une nouvelle partie »; ce second bouton ouvre un `confirm()` que Playwright refuse d'office, donc l'hôte ne démarre jamais et reste sur « En attente de l'autre joueur » (constaté: le clic reste suspendu sur le `confirm()` quand un écouteur de boîte de dialogue est posé; code: `packages/sdk-dev/src/coque/accueil.ts`, lignes 195 à 210). Remède: un dossier de données et un port par parcours. Après isolation, les parcours qui étaient rouges (interface, réseau, voyage) passent sans autre changement du jeu. Seules les adresses des poteaux de quai des parcours de voyage étaient périmées (voir 3).

## 2. Plan de test tracé depuis le cahier (section 12, critères du socle)

| Critère | Parcours | Fichier | Couverture |
|---|---|---|---|
| CA-01 un seul au marchepied, le train ne part pas; vote pour passer le trajet | P04, P16 | `voyage.spec.ts`, `voyage-vote.spec.ts` | complète (aller, retour, un seul vote puis deux votes, arrivée) |
| CA-02 voyage aller et retour sans perte | P04 | `voyage.spec.ts` | partielle: sacs, bourses, barre, coffre commun; pas outils, tenues, carnet, cœurs |
| CA-05 coucher à deux après 15 h, réveil à 6 h | P12 | `dormir.spec.ts` | partielle: 16 h, un seul couché puis les deux; « avant 15 h » non joué |
| CA-08 palier sous 20 affiché | P05 | `besoins.spec.ts` | partielle: palier bas et sa pastille; étoile du palier bonus et réglage « toujours visibles » non joués |
| CA-09 faim, manger | P13 | `bloques.spec.ts` | complète sur un cas: pomme cueillie, mangée, faim remontée vue par l'invité |
| CA-14 aucun déplacement sans clavier, menus qui prennent le clavier | P03, P08 | `dialogue.spec.ts`, `interface.spec.ts` | partielle: Z maintenu sans effet pendant dialogue et carnet |
| CA-15 cible et verbe avant l'appui | P02 | `dialogue.spec.ts`, `dormir.spec.ts`, `besoins.spec.ts`, `acte-1.spec.ts` | partielle: habitante, lit, pompe, Firmin; pas le balayage de toute la carte |
| CA-17 barre de 5, sac absent au départ, poser et ramasser | P01, P14 | `dialogue.spec.ts`, `bloques.spec.ts` | partielle: barre de 5, « Pas encore de sac », poser au sol puis ramasser; ranger au coffre non joué |
| CA-20 coffre commun depuis la gare | P09 | `interface.spec.ts` | partielle: verser et retirer depuis le carnet à la gare |
| CA-26 dialogue dans le bandeau bas, portrait | P01 | `dialogue.spec.ts` | partielle: bandeau, portrait, nom, choix; lettre par lettre et babil non mesurés |
| CA-33 coup d'œil 3 s puis plus rien | P07 | `interface.spec.ts` | complète (durée lue dans la page, bornée entre 2 et 4,5 s) |
| CA-34 quitter et reprendre | (aucun) | | non fait; les sauvegardes de départ sont reprises sans erreur par les parcours P17, P18a et P18b, ce qui prouve la reprise d'une sauvegarde fabriquée, pas le cycle quitter et reprendre |
| CA-35 déconnexion: horloge figée, reprise au retour | P11 | `reseau.spec.ts` | partielle: horloge figée constatée; reprise impossible dans le banc |
| Socle J1: poussée entre joueurs | P10 | `interface.spec.ts` | complète (écart au moins 0,55 m pour deux rayons de 0,3 m) |
| Socle J1: donner un objet | P15 | `bloques.spec.ts` | complète sur un cas (pomme donnée, retirée du donneur, vue chez l'autre) |
| Socle J1: se laver | P06 | `besoins.spec.ts` | complète (geste, jauge au-dessus de 40, palier quitté) |
| Carnet: quêtes, histoire regroupée par actes | P17 | `carnet-histoire.spec.ts` | complète sur Aubrune (une carte, acte 1 fait replié, acte 2 déplié, chez les deux joueurs) |
| Acte 1 d'Aubrune: arrivée, premier habitant, première étape | P18a, P18b | `acte-1.spec.ts` | partielle: partie posée à Aubrune par sauvegarde (voir 5, D4); scène lancée chez les deux, lettre à Firmin, étape franchie, avancée vue par l'invité |

## 3. Résultats

Dernier passage complet de `pnpm --filter @duo/la-petite-ligne-2 test:e2e --trace off` (machine partagée, charge élevée): **17 réussis en 14,5 min**, aucun rouge, aucun ignoré. Les durées ci-dessous sont celles de ce passage ou, à défaut, du précédent (plus rapide).

| Parcours | Résultat | Durée (démarrage compris) | Remarque |
|---|---|---|---|
| P01 dialogue complet avec la cheffe de gare, choix, besace chez les deux | vert | 53 s | |
| P02 bulle accrochée à l'habitante | vert | (dans P01) | |
| P03 immobile pendant le dialogue | vert | (dans P01) | |
| P04 voyage aller et retour regardé à l'écran | vert | 50 s | aller 12,5 s, retour 5,1 s (vote). Il était rouge: les points d'attente du parcours étaient hors du quai (rayon 3 m) et face au mauvais côté du poteau, « Monter » barré (« Va sur le quai »); corrigé dans `BOARDING` (`aides-e2e/duo.ts`), aucune cause côté jeu. **B1 (pas de train pendant le trajet) est corrigé**: le wagon et la locomotive s'affichent, bulle « Passer le trajet » |
| P05 palier « bas » de l'hygiène chez l'invité | vert | 38 s | |
| P06 se laver à la pompe | vert | (dans P05) | |
| P07 coup d'œil fermé seul | vert | 46 s | |
| P08 immobile pendant le carnet | vert | (dans P07) | défaut B3 toujours là |
| P09 coffre commun depuis la gare | vert | (dans P07) | |
| P10 poussée entre joueurs | vert | (dans P07) | |
| P11 reconnexion de l'invité | vert (constat) | 19 s | horloge figée; partie arrêtée des deux côtés (B4) |
| M1 une minute de jeu: octets reçus par l'invité, appels de dessin | vert | 1,3 min | mesures en 6 |
| P12 dormir à deux, lendemain | vert | 31 s | **B2 (personnage assis dans le lit) est corrigé**: il est allongé |
| P13 cueillir une pomme et la manger | vert (était ignoré) | 23 s | blocage disparu: `gather` est inscrite au registre, le pommier de la gare donne des pommes |
| P14 poser une pomme au sol puis la ramasser | vert (était ignoré) | 41 s | ranger au coffre non joué |
| P15 donner une pomme à l'autre joueur | vert (était ignoré) | 34 s | |
| P16 trajet en train: vote des deux joueurs, arrivée à la halte | vert (nouveau) | 44 s | un seul vote ne passe pas le trajet (bulle « On attend Zoé »), le second oui; arrivée chez les deux, 12 h 05 (+2 h) |
| P17 carnet: l'histoire d'Aubrune regroupée par actes | vert (nouveau) | 31 s | partie `aubrune-acte2` |
| P18a acte 1: les deux sur le quai, la scène d'accueil démarre | vert (nouveau) | 28 s | |
| P18b acte 1: la lettre à Firmin fait avancer l'étape | vert (nouveau) | 60 s, dont environ 25 s de démarrage | étapes `quai` puis `lettre` |
| D1 les répliques de la scène s'affichent | « échec attendu » (défaut connu), affiché ✘ par Playwright et compté réussi | 52 s | `test.fail`: devient rouge à la correction, il faudra alors retirer `test.fail` |
| D2 boutique et cheffe de gare | vert = défaut constaté | 66 s | à retourner à la correction |
| D3 relevé des habitants autour des joueurs | vert (relevé) | 66 s | mesures dans `mesures.txt` |

Aucun parcours rouge, aucun ignoré. Les trois parcours « ignorés » (P13 à P15) sont joués.

Stabilité: avant ce passage final, un passage complet avait déjà donné 12 réussis et 3 ignorés (P13 à P15 n'étaient pas encore réécrits); P13 à P15 ont ensuite passé du premier coup, puis les 17 d'affilée. Les échecs de la mission étaient tous des erreurs de test: bulle prise par un autre objet (le poteau de quai à côté de Firmin), second joueur hors du cône de visée, touche envoyée avant que la position de l'invité ne soit arrivée (1 à 2 s de retard), `==` interdit par eslint.

## 4. Les défauts signalés: confirmés ou infirmés

- **D2 confirmé** (la boutique ne s'ouvre plus en parlant à la cheffe de gare): voir 5.
- **D3 confirmé en partie** (habitant collé au joueur sur le quai): voir 5.

## 5. Défauts du jeu assemblé

### D1: les répliques des scènes ne s'affichent nulle part (bloquant pour l'histoire)

- Gravité: **bloquant** pour le jalon histoire (la scène d'accueil de l'acte 1 se joue sans un mot lisible; vaut pour toutes les scènes).
- Étapes: démarrer sur une partie à Aubrune (test: `acte-1.spec.ts`, D1) ou lancer n'importe quelle scène à `say`. Regarder l'écran 25 s.
- Attendu: la réplique de Firmin (« Ho ! Ho là ! Personne n'est descendu ici depuis trente ans ! ») dans le bandeau bas, avec son portrait; Espace passe à la suivante pour chaque joueur (`scene_next`).
- Obtenu: rien. Aucun texte, aucun bandeau. La scène avance toute seule toutes les 10 s (plafond des réglages) jusqu'à sa fin (une minute environ pour six temps). Espace n'a aucun effet.
- Cause constatée: `src/interface/histoire/scene.ts` dit « Ne dessine pas les répliques (`say`) des scènes » et aucun autre fichier de `src/interface` ne lit `sceneView` pour elles; l'intention `scene_next` n'est envoyée par aucune entrée (recherche dans `src/`: seulement le schéma et la simulation).
- Preuve: `captures/recette-d1-scene-sans-texte.png` (scène au 4e temps, personne ne parle à l'écran); test D1 (`test.fail`).
- Piste: un bandeau de réplique de scène (portrait et nom, comme le dialogue), alimenté par `sceneView`, et Espace relié à `scene_next`.

### D2: la boutique ne s'ouvre plus en parlant à la cheffe de gare (majeur)

- Gravité: **majeur** (contournement par le comptoir; mais tout commerçant qui donne aussi une quête perd son accueil).
- Étapes: gare d'essai, partie neuve. 1) Parler à la cheffe de gare au guichet, répondre « Oui » (elle donne la besace: la quête « sonnerie » démarre). 2) Lui reparler.
- Attendu: « Alors, cette besace ? » puis le choix « Je regarde ta buvette » qui ouvre la boutique (dialogue `accueil`, nœud `buvette`).
- Obtenu: « Cette nuit, j'ai entendu sonner au passage à niveau » (dialogue `sonnerie-debut`, priorité 10, déclenché par la mémoire `essai-gare.sonnerie = parler`), qui passe avant l'accueil (priorité 0). Aucune entrée vers la buvette. En visant le comptoir (23; 15) et Espace, la boutique s'ouvre normalement.
- Preuve: `captures/recette-d2-sonnerie-avant-accueil.png`, `captures/recette-d2-boutique-par-le-comptoir.png`; test D2 (constat; ne couvre pas le retour de l'accueil après la fin de l'étape).
- Piste: ajouter une option « Je regarde ta buvette » aux dialogues de quête de la cheffe, ou un choix de départ commun, ou faire passer le dialogue de quête après l'accueil tant que l'étape n'est pas due.

### D3: Firmin reste collé au point d'arrivée sur le quai d'Aubrune (mineur)

- Gravité: **mineur**. Infirmé en partie: l'habitant ne suit pas le joueur (marche de 3 m, l'écart grandit de 0,80 à 2,79 m), mais il se tient à 0,80 m du point d'arrivée et entre les deux joueurs, ce qui donne l'impression de collage et masque la cible (bulle « Parler » sur lui).
- Étapes: partie `aubrune-apres-scene` (ou fin de la scène d'accueil), ne pas bouger 10 s, relever la distance à Firmin.
- Attendu: l'habitant s'arrête à quelques mètres des joueurs.
- Obtenu: Firmin (point « quai » 204; 102,5) face aux joueurs posés à 203,2; 102,5: 0,80 m, immobile, bras tendu vers le joueur. Les habitants ne se repoussent pas des joueurs. Autour du point 204; 102,5 il y a aussi le poteau de quai (205,5; 102,5): un joueur qui parle à Firmin reçoit « Monter » s'il se place du côté du poteau.
- Preuve: `captures/recette-d3-firmin-colle-au-quai.png`; relevé dans `mesures.txt` (test D3).
- Piste: arrêter Firmin à 2 m du point d'arrivée (point de marche distinct du point de départ), ou écarter les joueurs.

### D4: le jeu ne démarre pas à Aubrune et le prologue n'a pas de porte (majeur pour l'intégration)

- Gravité: **majeur** (limite d'intégration, pas un bogue de code).
- Constat: `reglages.json` démarre à `essai-gare`; la gare d'essai ne mène qu'à `essai-halte`; Aubrune n'est desservie que depuis `train-de-nuit`, qui n'est branché à rien (« branchement prévu », test `acte-1-aubrune.test.ts`). `train-de-nuit` n'a aucun poteau de quai (brique `travel`): la descente vers Aubrune ne se joue qu'avec l'intention `board` dans le test de simulation. Le parcours P18 part donc d'une sauvegarde posée à Aubrune.
- Piste: brancher le départ sur `train-de-nuit` et y poser un poteau (ou une scène qui embarque), puis rejouer P18 depuis le départ.

### B3: le carnet déborde de l'écran en 960 x 540 (mineur, inchangé)

- Étapes: fenêtre de 960 x 540, touche C (onglets Sac et Quêtes).
- Obtenu: le haut du livre (titre, onglets) et le bas de la page de droite (« Coffre commun ») sont coupés; les onglets ne se devinent que par les touches Q et E.
- Preuve: `recette-jalon-1/p07-interface-3-carnet.jpg`, `captures/recette-p17-carnet-actes.png` (haut du livre coupé). À voir en 1366 x 768 sur le PC.
- Fichier probable: `src/interface/interface.css` (`.carnet`, `.book`).

### B4: reconnexion de l'invité impossible dans le banc (à classer par le manager)

- Limite connue du faux hôte: l'invité qui recharge arrête la partie des deux côtés (statut `error`), l'horloge est figée (CA-35, bon point), pas de reprise en cours de partie. À vérifier dans Duo (recette chez le client).
- Preuve: `recette-jalon-1/p11-reconnexion-1-hote-apres-coupure.jpg`.

### Corrigés depuis le premier passage

- B1 (aucun train pendant le trajet): corrigé, `captures/recette-p16-train-en-route.png` et `captures/recette-p16-vote-un-seul.png`. Les parcours P04 et P16 en sont le test de non-régression (phase `travel`, capture du wagon à chaque passage).
- B2 (assis dans le lit): corrigé, personnage allongé (`p12-dormir-2-un-seul-couche`, nouveau passage).

## 6. Mesures (rendu logiciel, machine partagée: valeurs indicatives)

| Mesure | Valeur | Repère |
|---|---|---|
| Messages reçus par l'invité pendant une minute (les deux marchent par à-coups) | 453 515 octets, 1 207 trames, 7,6 Ko/s; canal 2 (rapide) 436 588, canal 4 4 327, canal 1 1 513, canal 5 3 337, canal 8 995 | aucune alerte de taille; budget 32 Kio par message (ADR 0019) non dépassé. Plus qu'au premier passage (5,2 Ko/s): à surveiller, le canal rapide porte les habitants |
| Trajet voté à deux (second appui jusqu'à l'arrivée vue par les deux) | aller 12,5 s, retour 5,1 s | budget de chargement de 8 s sur le PC: à mesurer chez le client |
| Appels de dessin au point de départ (hôte, 960 x 540, ombres) | 40 appels, 58 902 triangles, 8 programmes, 25 géométries, 12 textures | budget 200 appels |
| Durée d'une image en rendu logiciel | 373 ms | sans valeur pour le PC |

## 7. Preuves

Sortie du dernier passage complet (`pnpm test:e2e --trace off`):

```text
Running 17 tests using 1 worker
  ✓   1 acte-1.spec.ts:14 P18a acte 1: les deux arrivent sur le quai, la scène d'accueil démarre (29.2s)
  ✓   2 acte-1.spec.ts:38 P18b acte 1: la lettre à Firmin fait avancer la première étape (1.0m)
  ✘   3 acte-1.spec.ts:85 D1 les répliques de la scène d'accueil s'affichent (défaut connu) (51.8s)   [échec attendu]
  ✓   4 besoins.spec.ts:9 palier de besoin chez l'invité puis toilette à la pompe (50.8s)
  ✓   5 bloques.spec.ts:28 P13 cueillir une pomme et la manger (CA-09) (36.0s)
  ✓   6 bloques.spec.ts:63 P15 donner une pomme à l'autre joueur (33.6s)
  ✓   7 bloques.spec.ts:100 P14 poser une pomme au sol puis la ramasser (CA-17) (33.4s)
  ✓   8 carnet-histoire.spec.ts:6 carnet: l'histoire d'Aubrune regroupée par actes (45.7s)
  ✓   9 defauts.spec.ts:37 D2 la boutique de la gare s'ouvre par la cheffe de gare, pas seulement par le comptoir (1.2m)
  ✓  10 defauts.spec.ts:65 D3 relevé: les habitants d'Aubrune autour des joueurs sur le quai (1.1m)
  ✓  11 dialogue.spec.ts:9 dialogue complet, bulle accrochée, joueur immobile (1.2m)
  ✓  12 dormir.spec.ts:8 dormir à deux: réveil le lendemain à l'aube (53.3s)
  ✓  13 interface.spec.ts:6 coup d'œil, carnet immobile, coffre commun, poussée (39.5s)
  ✓  14 reseau.spec.ts:8 une minute de jeu: octets reçus par l'invité et appels de dessin (1.2m)
  ✓  15 reseau.spec.ts:57 reconnexion de l'invité en pleine partie (18.7s)
  ✓  16 voyage-vote.spec.ts:6 trajet en train: vote des deux joueurs puis arrivée à la halte (44.5s)
  ✓  17 voyage.spec.ts:87 voyage aller et retour à deux (55.0s)
  17 passed (14.5m)
```

- `tsc --noEmit`, `eslint` (tests, aides, config Playwright) et `prettier --check`: sans erreur. `pnpm test` du paquet: 62 fichiers, 474 tests, verts.
- Contrôle des tirets longs sur les fichiers de la mission: rien.

## 8. À tester chez le client

- Le voyage: le chargement du lieu d'arrivée en moins de 8 s sur le PC, et la scène du train à l'écran.
- La scène d'accueil à Aubrune: des mots à lire dans un bandeau et une touche pour passer (D1: pour l'instant, rien).
- Parler à la cheffe de gare après sa quête: la boutique doit s'ouvrir (D2).
- Le carnet en plein écran sur le PC (1366 x 768 possible): rien de coupé, onglets visibles (B3).
- Couper le Wi-Fi de l'invité en pleine partie dans Duo: l'horloge s'arrête chez l'hôte, puis la partie reprend au retour (B4).
- Images par seconde au point de départ sur le PC (40 appels de dessin ici) et au quai d'Aubrune avec ses habitants.
- Le son: aucune vérification possible ici.
