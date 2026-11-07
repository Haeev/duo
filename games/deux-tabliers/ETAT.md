# Deux Tabliers: état du code

Squelette jouable du 2026-11-07 (version 0.1.0).

## Ce qui marche

- Chargement à deux par le SDK, manifeste valide (13 actions de `docs/jeux/cosy-cafe/ux.md`, section 9.1).
- Données JSON validées au chargement, avec contrôles croisés (meubles, postes, objets, départ) et la règle des assises face à leur table.
- Coque du café d'Ormeval aux cotes du plan `village-arrivee` (`docs/jeux/cosy-cafe/plans/plans.json`), en blocs: sols, plafonds, murs, cloisons, allèges et linteaux, éléments fixes, arbres. Meubles et postes du plan posés depuis `donnees/departs/village.json`.
- Vue subjective: yeux à 1,65 m, champ vertical 60°, ZQSD par position de touche, regard à la souris pointeur verrouillé, capsule « Clique pour reprendre la souris », clic de reprise sans effet, Entrée reprend aussi, collisions contre murs et meubles (rayon 0,3 m), aucun joueur ne bloque l'autre.
- Échap pointeur verrouillé: le SDK (`packages/sdk/src/input.ts`) prend un déverrouillage non demandé, page visible et active, partie en cours, pour Échap et envoie la demande de pause.
- Interaction: visée par rayon et aimant (3°), invite contextuelle, une main, plateau à 4 places, pile de tasses inépuisable, poser sur un emplacement déclaré, donner à l'autre (1,5 m), postes au clic (plonge) ou au maintien (machine, 1,5 s, anneau), arbitrage chez l'hôte (« Déjà pris »).
- Réseau: l'hôte fait autorité à 60 Hz, l'invité prédit ses pas et réconcilie en douceur (30 % de la vitesse de marche), interpole l'hôte (110 ms).
- Sauvegarde par `saves.provide` (monde complet, format 1), reprise validée par schéma, joueurs replacés par identifiant de membre; la séance s'inscrit à l'historique par le SDK.
- Sons par identifiant, sans blocage si un fichier manque; modèles GLB par nom, avec substitut.
- Tablette provisoire (Tab) pour montrer un panneau qui rend la souris.

## Preuves

- `pnpm --filter deux-tabliers test`: test de fumée (données, chargement à deux, déplacement prédit, prise, arbitrage simultané) en environ 1 s.
- Faux hôte (`deux-vues.html`) sous Chromium: coque et meubles visibles chez les deux, pointeur verrouillé, déplacement de l'invité.

## Limites connues et suites

- Prise d'objet non prédite chez l'invité: l'objet arrive dans sa main après un aller-retour (technique 5.5 demande l'affichage immédiat, avec retour en 0,2 s si perdu).
- Visée: pas d'occlusion par les murs (portée de 1,9 m); quelques petites allocations par image dans `aim` et `monde3d` (à reprendre au premier profilage).
- Collisions: un seul niveau, pas d'escaliers; les meubles posés sur le comptoir (y > 0) comptent encore comme obstacles au sol (sans effet: ils sont sur le comptoir).
- Rendu: un appel de dessin par meuble et par objet (passer en `BatchedMesh`, technique 3.3); pas de lumière cuite; pas de vitres.
- Les mouvements de souris de Playwright sous pointeur verrouillé, dans des iframes, arrivent en paires de sauts opposés: un test automatique du regard doit passer par le robot, pas par la souris.
- Réglages par joueur (sensibilité, champ de vision) non gardés d'une séance à l'autre (ADR à écrire, technique 2.2).
- Avertissement de taille du lot JavaScript (735 Ko, 193 Ko compressé): Three.js entier, à découper plus tard.
