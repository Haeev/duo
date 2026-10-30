# Cahier des charges: <Nom du jeu>

| Champ | Valeur |
|---|---|
| Identifiant | `<id-du-jeu>` (minuscules, chiffres, traits d'union) |
| Statut | brouillon, en revue, validé par le client le AAAA-MM-JJ, en production, livré |
| Version du document | 0.1 |
| Dernière mise à jour | AAAA-MM-JJ |

> Mode d'emploi: copier ce modèle dans `docs/jeux/<id-du-jeu>/cahier-des-charges.md`. Chaque section indique ses responsables. Le manager consolide, le client valide. Une fois validé, ce document est le contrat: toute modification passe par le manager et s'inscrit dans l'historique (section 15).

## 1. Résumé (game-designer)

- **Pitch**: une phrase.
- **Fantasme du joueur**: ce qu'on ressent en jouant.
- **Genre**:
- **Vue**: 2D, 3D, isométrique (en 2D ou en 3D).
- **Mode à deux**: coopération, affrontement, asymétrique, coopétition.
- **Durée d'une partie**:
- **Piliers** (trois au plus):

## 2. Expérience à deux (game-designer)

- Rôle de chaque joueur et interactions entre eux.
- Ce que montre chaque écran (information partagée ou asymétrique).
- Communication: ce que les joueurs ont intérêt à se dire.
- Équilibrage entre joueurs de niveaux différents.

## 3. Boucles de jeu (game-designer)

- Boucle de 30 secondes:
- Boucle d'une partie:
- Progression entre les parties (facultatif):

## 4. Règles (game-designer)

- Entités et états.
- Conditions de victoire et de défaite, égalités.
- Cas limites: actions simultanées, pause, déconnexion puis reconnexion d'un joueur.
- Métriques de gameplay (vitesses, sauts, portées, tailles).
- Tables d'équilibrage: valeur, unité, plage, raison du choix.

## 5. Contrôles (game-designer, ux-ui-designer)

| Action | Touche (clavier AZERTY) | Souris |
|---|---|---|
| | | |

- Reconfiguration des touches: oui ou non.

## 6. Contenu (game-designer, level-designer)

- Modes, niveaux, cartes, arènes: liste, intention de chacun, difficulté de 1 à 5.

## 7. Direction artistique (directeur-artistique)

- Piliers visuels, palette (hexadécimal et rôle de chaque couleur), formes, lumière, caméra, interface, effets.
- Couleurs et signes distinctifs des deux joueurs, lisibles par les daltoniens.
- Liste des assets avec leurs specs (dimensions, palette, budget de polygones, textures, nommage).

## 8. Direction sonore (sound-designer)

- Ambiance, musiques (moments, intensités), liste des événements sonores avec leur priorité.

## 9. Interface et HUD (ux-ui-designer)

- Écrans du jeu (titre, salon, partie, pause, fin), HUD, états d'attente et de déconnexion.

## 10. Technique (architecte-technique, dev-reseau, tech-artist)

- Moteur et rendu (Three.js, Phaser ou PixiJS).
- Simulation (pas de temps, déterminisme) et modèle réseau (autorité de l'hôte, lockstep, prédiction).
- Budgets de performance: images par seconde, appels de dessin, mémoire, poids des assets.
- Risques techniques et parades.

## 11. Périmètre (game-designer, manager)

- **Version 1** (indispensable):
- **Plus tard** (bonus):
- **Hors périmètre**:

## 12. Critères d'acceptation (qa-testeur)

Numérotés, chacun vérifiable par un test ou une observation.

- CA-01: étant donné ..., quand ..., alors ...

## 13. Jalons (manager)

| Jalon | Contenu attendu | Date visée | Validé le |
|---|---|---|---|
| Prototype | jouable à deux en réseau, formes simples | | |
| Alpha | toutes les fonctions et tout le contenu | | |
| Bêta | assets définitifs, son, finitions | | |
| 1.0 | recette réussie sur les deux machines | | |

## 14. Questions ouvertes et décisions

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|

## 15. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
