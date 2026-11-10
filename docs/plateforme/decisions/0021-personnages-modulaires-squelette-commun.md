# ADR 0021: Personnages modulaires de La Petite Ligne, squelette commun de 24 os

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | tech-artist et artiste-3d (lot L5), dev-gameplay-3d (lot L6), directeur-artistique, dev-reseau (apparence synchronisée) |
| Jeu | `games/la-petite-ligne-2`; essai: `docs/production/essais-meshy/personnage-modulaire/README.md` (sections 3 et 8); bible: `docs/jeux/jeu-1/refonte/bible-artistique.md` |
| Liens | ADR 0017 (gabarits), 0019 (apparence dans la tranche « joueurs ») |

## Contexte

Le client veut des personnages modulaires: un squelette commun, des pièces par emplacement assemblées à l'exécution, un éditeur, des habitants composés depuis le catalogue (réponses 47 à 51). Décision du client du 2026-11-10: corps, visages et vêtements sont fabriqués par les scripts du studio (essai 2, voie D), Meshy étant réservé aux chapeaux, sacs, accessoires et coiffures élaborées.

Deux squelettes existent:

- **18 os, celui de la 0.13** (`personnages.glb`: `root`, `hips`, `spine`, `chest`, `neck`, `head`, bras et jambes en trois os, sans épaule ni orteil), avec 49 clips écrits par script pour l'ancien jeu (275 Ko).
- **24 os, celui de l'essai** (`squelette-commun.json`: les os de tout rig de Meshy, trois os de colonne, épaules, orteils, pas de doigts), replacé sur les repères de la bible par la voie D; les clips `walk`, `run`, `idle`, `wave` s'y rejouent sans retouche, et le fichier `morphologies.json` du lot L5 déclare déjà `sit` et `carry` (non vérifiés ici).

Dans `technique.md` (version 0.1, avant l'essai 2), j'avais recommandé les 18 os pour garder les 49 clips. L'essai 2 change la donne: la chaîne retenue par le client produit ses pièces sur les 24 os.

## Options

| | A. Squelette de 18 os | B. Squelette de 24 os |
|---|---|---|
| Chaîne des pièces (voie D, retenue par le client) | à refaire sur 18 os: repères du script, poids, sections du corps; estimation 6 à 10 h, et les 10 pièces de l'essai à régénérer | en place: corps, 10 pièces, 2 corpulences, catalogue du lot L5 déjà livré dans le paquet |
| Déformation « figurine lisse » | pas d'os d'épaule ni d'orteil, deux os de colonne: plis plus durs aux épaules, là où l'essai voit déjà un défaut avec les épaules | épaules, orteils, trois os de colonne |
| Les 49 clips de la 0.13 | rejoués tels quels, mais écrits pour l'ancien corps (prises d'outils, assises): à recaler de toute façon sur le nouveau gabarit | à reporter: script de report dans Blender (correspondance des os, colonne répartie, épaules et orteils au repos), puis revue de chaque clip; estimation 8 à 12 h pour la trentaine de clips encore utiles (les autres servaient l'ancien contenu: draisine, manivelle, perche, vélo) |
| Clips nouveaux | à écrire par script, ou à reporter depuis Meshy vers 18 os | bibliothèque de Meshy jouable sans report (3 crédits l'action), ou écriture par script |
| Pièces rigides de Meshy (chapeaux, sacs) | liées à un os: indifférent | indifférent |
| Risque principal | refaire une chaîne qui marche | qualité du report des clips à contacts (outils, assise à deux) |

## Décision

**Option B: le squelette commun de 24 os, nommé `duo-24`.** Le coût se déplace des pièces (plus de 120 à produire, chaîne prête) vers les clips (une trentaine à reporter une fois).

1. **Un seul squelette pour tous les personnages**: joueurs et habitants, enfants, adultes et âgés. Une morphologie (`shapes` du catalogue) change les longueurs et les échelles d'os, pas la hiérarchie; corps et vêtements suivent par le skinning.
2. **Clips partagés**, dans un fichier à part du corps: rotations seules, plus la translation des hanches mise à l'échelle des jambes. Jamais la translation des autres os: elle imposerait les proportions du personnage d'origine (constat de `meshy.md`, 4.2).
3. **Report des clips de la 0.13**: par script, dans la chaîne du lot L5; un clip n'entre dans le jeu qu'après revue sur le nouveau corps (contacts des mains et des pieds). Ordre: gestes du jalon 1 (`pickup`, `reach-up`, `eat`, `talk`, `sit`, `wash`), puis outils, puis le reste. Les clips propres à l'ancien contenu ne sont pas reportés.
4. **Catalogue** (`donnees/commun/personnages/catalogue.json`, schéma `CatalogueSchema`): morphologies, teintes de peau, pièces (emplacement, fichier GLB et nœud, régions du corps masquées, effet sur les cheveux, zones teintables, étiquettes, triangles). Il sort du générateur du lot L5 avec les GLB (un par emplacement, quantifiés, sans décodeur WebAssembly pour ne pas assouplir la CSP).
5. **Apparence** (`Look`): morphologie, peau, une pièce par emplacement avec ses couleurs; 150 à 250 octets, dans la tranche « joueurs » et dans les données de chaque habitant écrit. Un habitant composé est tiré du catalogue une fois, puis son apparence est écrite dans l'état du lieu.
6. **Assemblage à l'exécution: fusion.** À chaque changement d'apparence, les pièces sont fusionnées en une géométrie skinnée, les régions couvertes du corps retirées, les couleurs des zones écrites en couleurs de sommets: **un maillage, un matériau partagé, un appel de dessin par personnage et par passe**. L'essai mesure 34 à 38 appels par personnage sans fusion: hors budget pour 14 personnages.
7. **Budgets**: 6 000 triangles par personnage assemblé (l'essai en compte 10 700 à 12 900 avec les parois intérieures des vêtements, à retirer), 120 000 triangles et 28 appels pour tous les personnages à l'écran, ombres comprises.

## Conséquences

- Les lots L5 et L6 partent du même contrat (`src/donnees/schemas/personnage.ts`), déjà suivi par le catalogue livré.
- Le rendu des personnages de la 0.13 (`personnages.ts`, `habillage.ts`) n'est pas repris; `mergeOutfit` sert de modèle à la fusion.
- Tant qu'un clip n'est pas reporté, le geste correspondant joue un clip de remplacement déclaré (`idle`): jamais de blocage du gameplay par l'animation.
- Les régions du corps sont listées par le générateur (`morphologies.json`); le schéma du jeu ne les fige pas.

## À vérifier

- Report des clips de 18 vers 24 os: non essayé; les estimations ci-dessus sont des ordres de grandeur. Un essai sur trois clips (`pickup`, `sit`, `fish_cast`) doit précéder le report en série.
- Morphologies enfant et âgé par échelles d'os (l'essai ne les a pas générées; le catalogue en déclare déjà une de chaque).
- Coût de la fusion à l'exécution et nombre d'appels réels, à mesurer par le lot L6 dans Three.js 0.187.
- Le catalogue livré distingue des morphologies `adult-f-*` et `adult-m-*`, alors que le client a décidé « aucun choix de genre, toutes les pièces vont à tous »: à accorder avec le directeur artistique (question de nommage ou de fond).
