# Recette automatisée à deux joueurs, jalon 1 (socle) de `la-petite-ligne-2`

Date: 2026-11-10. Auteur: qa-testeur (mission L11). Code mesuré: `claude/stoic-lamport-lueey2` au commit `5e820b0` puis après la fusion des données d'essai (lits, coffre, armoire, étals, Odilon, Prune, sauvegarde), arbre de travail de la mission.

## 1. Comment lancer

```sh
pnpm --filter @duo/sdk-dev build                     # pages du faux hôte, une fois
pnpm --filter @duo/la-petite-ligne-2 test:e2e        # construit le jeu puis lance Playwright
```

- Hors de la suite rapide: `vitest.config.ts` exclut `tests/e2e/`. Durée de la recette entière: 8 à 10 minutes en rendu logiciel (un démarrage à deux coûte 15 à 25 s par parcours).
- Deux contextes Chromium (hôte « Loïc » et invité « Zoé ») reliés par `servir` sur le port 8794, comme le Mac et le PC. Captures dans `$LPL2_CAPTURES` (par défaut `<tmp>/lpl2-captures/`), mesures dans `mesures.txt` du même dossier.
- **Sonde d'essai** (`src/plateforme/sonde-essai.ts`): chargée seulement si l'adresse du jeu porte `?sonde=1`; le test l'y met par une redirection de `/jeu/`. Elle lit le monde, le joueur local, la cible, la phase, le lieu construit et les statistiques du rendu; chez l'hôte seulement, elle place un joueur, règle une jauge, l'heure ou la bourse. Les parcours ne marchent jamais de longues distances.
- Aides: `tests/aides-e2e/duo.ts` (`startDuo`, `press` par code physique, `until`, `shot`).

## 2. Plan de test tracé depuis le cahier (section 12, critères du socle)

| Critère | Parcours | Fichier | Couverture |
|---|---|---|---|
| CA-01 un seul au marchepied, le train ne part pas | P04 | `voyage.spec.ts` | complète (aller et retour) |
| CA-02 voyage aller et retour sans perte | P04 | `voyage.spec.ts` | partielle: sacs, bourses, barre, coffre commun; pas outils, tenues, carnet, cœurs |
| CA-05 coucher à deux après 15 h, réveil à 6 h | P12 | `dormir.spec.ts` | partielle: 16 h, un seul couché puis les deux; « avant 15 h » non joué |
| CA-08 palier sous 20 affiché | P05 | `besoins.spec.ts` | partielle: palier bas et sa pastille; étoile du palier bonus et réglage « toujours visibles » non joués |
| CA-09 faim, manger | P13 | `bloques.spec.ts` | à écrire (voir 4) |
| CA-14 aucun déplacement sans clavier, menus qui prennent le clavier | P03, P08 | `dialogue.spec.ts`, `interface.spec.ts` | partielle: Z maintenu sans effet pendant dialogue et carnet |
| CA-15 cible et verbe avant l'appui | P02 | `dialogue.spec.ts`, `dormir.spec.ts`, `besoins.spec.ts` | partielle: habitante, lit, pompe; pas le balayage de toute la carte |
| CA-17 barre de 5, sac absent au départ | P01, P14 | `dialogue.spec.ts`, `bloques.spec.ts` | partielle: barre de 5 et « Pas encore de sac » vus; ramasser et ranger à écrire |
| CA-20 coffre commun depuis la gare | P09 | `interface.spec.ts` | partielle: verser et retirer depuis le carnet à la gare |
| CA-26 dialogue dans le bandeau bas, portrait | P01 | `dialogue.spec.ts` | partielle: bandeau, portrait, nom, choix; lettre par lettre et babil non mesurés |
| CA-33 coup d'œil 3 s puis plus rien | P07 | `interface.spec.ts` | complète (durée lue dans la page, bornée entre 2 et 4,5 s) |
| CA-34 quitter et reprendre | (aucun) | | non fait, faute de temps (voir 6) |
| CA-35 déconnexion: horloge figée, reprise au retour | P11 | `reseau.spec.ts` | partielle: horloge figée constatée; reprise impossible dans le banc |
| Socle J1: poussée entre joueurs | P10 | `interface.spec.ts` | complète (écart au moins 0,55 m pour deux rayons de 0,3 m) |
| Socle J1: donner un objet | P15 | `bloques.spec.ts` | à écrire |
| Socle J1: se laver | P06 | `besoins.spec.ts` | complète (geste, jauge au-dessus de 40, palier quitté) |

## 3. Résultats (dernier passage de chaque parcours)

| Parcours | Résultat | Captures regardées (`recette-jalon-1/`) | Remarque |
|---|---|---|---|
| P01 dialogue complet avec la cheffe de gare, choix, besace reçue chez les deux | réussi | `p01-dialogue-3-choix.jpg`, `p01-dialogue-4-fin.jpg` | bandeau, portrait provisoire, nom, deux choix |
| P02 bulle accrochée à l'habitante (`prompt--anchored`) | réussi | `p01-dialogue-1-bulle.jpg` | « Espace Parler » au-dessus de la tête; la cible s'éclaircit (réaction) |
| P03 immobile pendant le dialogue | réussi | | écart 0 m après 1,5 s de Z |
| P04 voyage aller et retour regardé à l'écran | réussi, avec défaut B1 | `p04-voyage-aller-1-un-seul-monte.jpg`, `p04-voyage-aller-2-wagon.jpg`, `p04-voyage-aller-3-arrivee.jpg`, `p04-voyage-retour-3-arrivee.jpg` | « On attend Zoé » quand un seul est monté; horloge +2 h au trajet |
| P05 palier « bas » de l'hygiène chez l'invité | réussi | `p05-besoins-1-hygiene-basse.jpg` | pastille rayée en haut à gauche |
| P06 se laver à la pompe | réussi | `p05-besoins-3-toilette.jpg`, `p05-besoins-4-apres-toilette.jpg` | |
| P07 coup d'œil fermé seul | réussi | `p07-interface-1-coup-d-oeil.jpg`, `p07-interface-2-apres-coup-d-oeil.jpg` | jauges, barre, repère « Loïc, à 2 m », minuteur |
| P08 immobile pendant le carnet | réussi, avec défaut B3 | `p07-interface-3-carnet.jpg` | |
| P09 coffre commun depuis la gare | réussi | `p07-interface-4-coffre.jpg` | 20,00 € puis 19,00 € et coffre 1,00 €, vu par l'invité |
| P10 poussée entre joueurs | réussi | `p07-interface-5-poussee.jpg` | |
| P11 reconnexion de l'invité | constat (voir B4) | `p11-reconnexion-1-hote-apres-coupure.jpg` | horloge figée (604,06 puis 604,06 min); partie arrêtée des deux côtés |
| P12 dormir à deux, lendemain | réussi, avec défaut B2 | `p12-dormir-2-un-seul-couche.jpg`, `p12-dormir-3-lendemain.jpg` | « On attend Zoé »; jour 2 à 6 h 01 |
| P13 manger, P14 ramasser et ranger, P15 donner | à écrire (`test.fixme`) | | voir 4 |

Stabilité: un premier passage complet a vu deux échecs d'infrastructure non reproduits (clic « Héberger » expiré au démarrage, puis serveur du banc injoignable pour les parcours suivants). Les délais d'attente ont été relevés (palier reçu chez l'invité: 15 s; cible: 20 s) après des échecs dus à la lenteur du rendu logiciel: le diagnostic a montré que l'invité reçoit bien le palier et la position en 1 à 2 s.

## 4. Bloqué par les données ou le moteur

- Avant la seconde fusion: lits, coffre et objets manquaient (P12 à P15 marqués « bloqué par les données »).
- Après la fusion: dormir (P12) joué. Les étals et marmites portent la brique `gather`, mais **`gather` n'est pas inscrite au registre** (`src/simulation/briques/registre.ts`, commentaire « Restent à inscrire: `gather` et `open` »): ils ne sont pas des cibles. Le seul objet obtenable est la soupe offerte par Prune à la halte (dialogue `potager`), qui demande le voyage aller: P13 à P15 sont écrits en `test.fixme` et restent à jouer par ce chemin.

## 5. Bugs

### B1: pendant le trajet, aucun train: le lieu d'arrivée est déjà affiché avec « Descendre »

- Gravité: majeur (ressenti du voyage, CA-01 et `technique.md`, paragraphe « Voyage »: « scène du train, 20 à 40 s, qui couvre le chargement »).
- Étapes: `test:e2e`, parcours P04, ou à la main: les deux sur le quai de la gare d'essai, Entrée chez l'un puis chez l'autre.
- Attendu: une scène de train (ou un fondu) pendant la phase `travel`, puis la descente sur le quai d'arrivée.
- Obtenu: dès le départ, l'écran montre la halte, les deux personnages debout, et la bulle « Entrée Descendre » pendant toute la phase `travel` (20 à 47 s ici); rien ne bouge jusqu'à l'arrivée.
- Preuve: `recette-jalon-1/p04-voyage-aller-2-wagon.jpg` (phase `travel` confirmée par la sonde au moment de la capture).
- Fichiers probables: `src/rendu/moteur.ts` (`frame` construit `common.place` dès qu'il change), `src/interface/` (bulle `unboard` affichée hors de la phase `boarding`).

### B2: couché dans le lit double, le personnage est assis bien droit

- Gravité: mineur.
- Étapes: P12, ou à la main: après 15 h, Espace face au lit double de la gare.
- Attendu: personnage allongé dans le lit.
- Obtenu: buste droit qui dépasse du lit, chez le joueur couché et au réveil (les deux assis côte à côte à 6 h 01).
- Preuve: `recette-jalon-1/p12-dormir-2-un-seul-couche.jpg`, `p12-dormir-3-lendemain.jpg`.
- Fichiers probables: `src/rendu/personnages/` (pose du geste de sommeil) ou `src/simulation/briques/postures.ts`.

### B3: le carnet déborde de l'écran en 960 x 540

- Gravité: mineur à 960 x 540 (plus petit que le PC de référence); à revoir en 1366 x 768, non vérifié.
- Étapes: P08, ou à la main: fenêtre de 960 x 540, touche C.
- Attendu: le livre tient dans la fenêtre.
- Obtenu: page de gauche coupée (titre, première case, onglets invisibles), bas de la page de droite coupé (ligne « Coffre commun »), horloge posée sur le livre.
- Preuve: `recette-jalon-1/p07-interface-3-carnet.jpg`, `p07-interface-4-coffre.jpg`.
- Fichier probable: `src/interface/interface.css` (`.carnet`, `.book`).

### B4: reconnexion de l'invité impossible dans le banc

- Gravité: à classer par le manager (limite connue du faux hôte, pas forcément du jeu).
- Étapes: P11: partie en cours, l'invité recharge sa page.
- Obtenu: chez l'hôte, « La partie s'est arrêtée. L'autre ordinateur s'est déconnecté » (statut `error`); l'horloge est figée (bon point pour CA-35), mais aucune reprise en cours de partie.
- Attendu (CA-35): reprise au retour. À vérifier dans Duo; dans le banc, la reprise passe par la dernière sauvegarde.
- Preuve: `recette-jalon-1/p11-reconnexion-1-hote-apres-coupure.jpg`.

## 6. Mesures (rendu logiciel, machine partagée: valeurs indicatives)

| Mesure | Valeur | Repère |
|---|---|---|
| Messages reçus par l'invité pendant une minute (les deux marchent par à-coups) | 313 399 octets, 792 trames, 5,2 Ko/s; canal 2 (rapide) 294 034, canal 4 8 846, canal 6 4 576, canal 1 652, canal 8 568 | aucune alerte de taille; budget 32 Kio par message (ADR 0019) non dépassé |
| Chargement d'un lieu (second appui sur Entrée jusqu'à l'arrivée vue par les deux) | aller 47,4 s, retour 28,3 s | minimum de trajet 20 s; budget 8 s de chargement sur le PC: à mesurer chez le client |
| Appels de dessin au point de départ (hôte, 960 x 540, ombres) | 35 appels, 48 326 triangles, 9 programmes, 22 géométries, 12 textures | budget 200 appels |
| Durée d'une image en rendu logiciel | 686 ms | sans valeur pour le PC |

Non fait: le parcours « sauvegarder, recharger, retrouver l'état » (CA-34) demandé en cours de mission, faute de temps.

## 7. À tester chez le client

- Le voyage: un train ou un fondu pendant le trajet (B1), et la durée du chargement sur le PC (moins de 8 s).
- Le carnet en plein écran sur le PC (1366 x 768 possible): rien de coupé (B3).
- Couper le Wi-Fi de l'invité en pleine partie dans Duo: l'horloge s'arrête chez l'hôte, puis la partie reprend au retour.
- Images par seconde au point de départ sur le PC (35 appels de dessin ici).
