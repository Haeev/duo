# ADR 0013: Stratégie de test et CI

| Champ | Valeur |
|---|---|
| Statut | acceptée (manager, 2026-10-30) |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | qa-testeur, ingenieur-build, dev-reseau (banc réseau) |
| Fonctions du cahier | toutes; section 7 (critères d'acceptation) |
| Liens | `criteres-acceptation.md` (modes U, E, EL, P2, CI, D, M et section 6), ADR 0002 (scripts), 0003 (ligne de commande), 0005 (crochets du SDK), 0010 (clé de test), 0012 (identifiants de test), 0015 (journal) |

## Contexte

Les 132 critères d'acceptation (qa-testeur) se vérifient pour 120 d'entre eux automatiquement dans l'environnement cloud, à condition que l'architecture prévoie dès le prototype les sept prérequis de la section 6 des critères: deux instances sur une machine, identifiants de test, mode test, jeux d'essai, journal local, affichage des performances, banc réseau virtuel. Les machines du client ne sont pas accessibles: ce qui ne se mesure que chez lui (matériel, pare-feu, son, AZERTY réel) passe par une recette guidée et par le rapport pour le studio (ADR 0015).

Faits vérifiés le 2026-10-30: deux instances d'Electron pilotées par Playwright sous `xvfb-run`, chacune avec son dossier de données (qa-testeur, Electron 38; architecte-technique, Electron 45.2.0 et Playwright 1.63); le verrou d'instance unique d'Electron 45 est pris dans `userData` (code source), donc deux dossiers distincts donnent deux verrous; espaces de noms réseau, pont, coupures et pertes par nftables fonctionnent dans l'environnement cloud, pas netem (latence par un mandataire); Electron y exige `--no-sandbox` (exécution en root) et `--enable-unsafe-swiftshader` pour WebGL2.

## Options

### Crochets de test

| Option | Pour | Contre |
|---|---|---|
| Présents dans toutes les versions, activés par une variable d'environnement ou une option | on teste exactement le binaire publié | des crochets puissants (versions simulées, clé de test, copie bloquée) dans l'application du client; une erreur d'activation les ouvre |
| Compilés seulement dans une version de test (`DUO_TEST`), absents des versions publiées, plus un test de fumée du binaire publié | rien de dangereux chez le client | on teste un binaire voisin: il faut un contrôle que la seule différence est l'absence des crochets |

### Parcours à deux joueurs

| Option | Pour | Contre |
|---|---|---|
| Deux contextes Playwright sur l'interface ou sur un jeu dans le faux hôte (P2) | rapide, à chaque modification | ni Electron, ni vraie liaison réseau |
| Deux instances d'Electron sur la boucle locale (E) | l'application réelle | pas de diffusion UDP réelle, pas de coupure franche |
| Deux instances dans deux espaces de noms réseau reliés par un pont (EL) | découverte par vraie diffusion, coupures, pertes, absence d'Internet | plus lent; droits d'administration (root dans le cloud, `sudo` sur les runners Linux) |

## Décision

1. **Crochets compilés seulement dans les versions de test**: une constante de construction `DUO_TEST` (electron-vite et Vite pour le SDK) supprimée des versions publiées par élimination du code mort. Dans une version de test, le principal expose ses crochets à Playwright par `electronApp.evaluate()`, et le SDK répond aux demandes de test par le pont. La CI vérifie sur chaque binaire publié l'absence des marqueurs des crochets et de la clé publique de test.
2. **Trois niveaux pour les parcours à deux**: P2 à chaque modification, E et EL pour la recette automatique (la recette ne se fait jamais en P2 seul, conformément aux critères).
3. **Prérequis de testabilité de qa-testeur**, tous retenus:

| Prérequis | Décision |
|---|---|
| 1. Deux instances sur une machine | `--duo-data-dir` appliqué avant le verrou d'instance unique, ports imposés par la ligne de commande (ADR 0003, point 9; option des ports par dev-reseau) |
| 2. Identifiants de test | `data-testid` sur chaque élément interactif, `data-message="M-xx"` sur chaque message (ADR 0012) |
| 3. Mode test | dans les versions de test seulement: empreinte de l'état du jeu et rythme de sa simulation (par le pont, ADR 0005); retard ou blocage de la copie des sauvegardes; versions simulées de l'application, du protocole, du pont et des jeux; adresses du catalogue et du fichier de version de Duo; désactivation de ces recherches; clé de signature de test acceptée (ADR 0010); période de la sauvegarde automatique; compteurs de contextes WebGL et audio créés par le jeu et présence de son processus (`app.getAppMetrics()`); gains audio effectifs par catégorie; état du blocage de la mise en veille; appels à `app.dock.bounce()` et `flashFrame()` relevés; ramasse-miettes forcé (`--js-flags=--expose-gc`); robots du jeu témoin et des jeux d'essai |
| 4. Jeux d'essai | `games/_essais/`, jamais publiés, signés avec la clé de test à la construction: affrontement et coopération minimaux; 3 emplacements aux trois moments, sauvegarde automatique et plafond de taille; sauvegarde de 20 Mo; séances sans fin de partie; plantage sur commande selon les quatre modes de CA-PF-039, et échec du chargement; manifeste invalide; SDK trop récent; deux versions d'un même jeu, la plus récente avec un format de sauvegarde plus récent |
| 5. Journal local | journal horodaté des événements de session et des erreurs sur chaque machine, repris dans le rapport (ADR 0015) |
| 6. Affichage des performances | présent dans toutes les versions, activable dans Réglages > À propos (et par un raccourci que fixera ux-ui-designer, intercepté par le principal comme Échap): moyenne d'images par seconde, part des intervalles à 20 ms ou moins, plus long intervalle sur les 60 dernières secondes, mémoire de Duo; mesures du lanceur par sa propre vue, du jeu par le module `perf` du SDK |
| 7. Banc réseau virtuel | outillé par qa-testeur avec dev-reseau: espaces de noms reliés par un pont, passerelle piège qui compte les paquets vers l'extérieur, pertes par nftables, latence et gigue par Toxiproxy (MIT, outil de test non livré, version et empreinte figées); chaque pilote Playwright tourne dans l'espace de noms de son instance; variables de mandataire HTTP retirées de l'environnement des tests |

4. **Niveaux et outils**:

| Niveau | Outil | Cible |
|---|---|---|
| U | Vitest 5 sous Node 22 | simulations (graine fixe), schémas, compatibilité (toutes les combinaisons de CA-PF-107), fusion des données, machines à états du salon et de la pause, règles du pseudo, textes |
| Intégration réseau | Vitest, deux sessions dans un processus sur la boucle locale, latence, gigue et pertes injectées | protocole de la liaison, reconnexion, réplication |
| P2 | Playwright 1.64, deux contextes Chromium | lanceur avec faux pont (ADR 0012); jeux dans le faux hôte `@duo/sdk-dev`, avec robots |
| E | Playwright `_electron`, Electron 45 sous `xvfb-run`, une ou deux instances | application réelle sous Linux |
| EL | E dans le banc réseau virtuel | découverte, coupures, absence d'Internet, réseau dégradé (profil R1), endurance |
| CI | runners macOS et Windows de GitHub Actions | chemins, remplacement de fichiers, installateurs, compte au nom accentué (CA-PF-013, 053, 076, 077, 081, 082, 101, 102) |
| Mesure | banc de mesure (lot L8) sur le PC du client | images par seconde, mémoire, temps de chargement; le rendu logiciel du cloud ne mesure rien |

5. **Déclencheurs de la CI** (dépôt public: minutes gratuites sur les runners standard):
   - chaque push: `pnpm controler`, lint, typecheck, U, intégration réseau, P2, construction du gabarit et du jeu témoin, E rapide sous Linux;
   - demande de fusion vers `main` et push sur `main`: E et EL complets, sous-ensemble CI sur macOS et Windows;
   - chaque nuit sur `main`: endurance (CA-PF-117), dix plantages et dix lancements de suite (CA-PF-103, 104);
   - tag de version: installateurs (ADR 0011), puis test de lancement de l'application empaquetée, sans Playwright puisque les fusibles ferment les options d'inspection: lancée avec `--duo-data-dir` sur un dossier temporaire, elle doit écrire la ligne « lanceur prêt » dans son journal (ADR 0015); contrôle de l'absence des crochets et de la clé de test dans l'archive.
   - Les tests Playwright (E, EL, CI) tournent sur l'application non empaquetée (binaire d'Electron de `node_modules` et code compilé), sans fusibles (accord avec l'ADR 0011).
6. **Règles**: aucune reprise automatique d'un test qui échoue; un test instable est corrigé, ou mis en quarantaine avec un `TODO(#n)` qui renvoie à un ticket. Délais mesurés selon la règle 1.3 des critères (10 essais, le pire compte). Horloges simulées dans les tests unitaires; temps réel avec tolérance dans E et EL.
7. **Preuves**: rapports de test, traces et captures de Playwright, journaux des deux instances gardés en artefacts de la CI; rapport de recette `docs/plateforme/recette/AAAA-MM-JJ.md` par qa-testeur.
8. **Electron en CI**: sous Linux, `xvfb-run`; bac à sable de Chromium conservé sur les runners (seul l'environnement cloud, qui tourne en root, impose `--no-sandbox`); WebGL2 en rendu logiciel par `--enable-unsafe-swiftshader`, pour les images seulement.

## Conséquences

- Le code testé par Playwright et l'application publiée diffèrent par les crochets et par l'empaquetage (archive, fusibles); le test de lancement de l'application empaquetée et le contrôle des marqueurs ferment cet écart.
- La clé de test est versionnée: ce n'est pas un secret, une version publiée la refuse.
- La recette chez le client reste nécessaire pour le matériel, les pare-feu et le Wi-Fi réel: 13 points dans la liste des critères (section 8), aidés par le journal et le rapport.
- Chaque nouveau jeu hérite du gabarit: tests de sa simulation, de son manifeste, de ses migrations de sauvegarde, et un robot pour les tests à deux.

### À vérifier

- Bac à sable de Chromium sur `ubuntu-latest` (restriction AppArmor des espaces de noms utilisateur); repli à décider au lot L1.
- Espaces de noms réseau et nftables sur les runners Linux de GitHub Actions, avec `sudo` (le banc EL n'a été éprouvé que dans l'environnement cloud).
- Durée de la CI macOS et Windows à chaque fusion; si elle gêne, ce sous-ensemble passe la nuit.
