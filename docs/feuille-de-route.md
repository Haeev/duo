# Feuille de route

Tenue par le manager. Dernière mise à jour: 2026-10-30.

## Phase 0: constitution du studio (terminée)

- Équipe de 15 membres dans `.claude/agents/`, validée par le client le 2026-10-30. Manuel du studio dans `CLAUDE.md`.
- Orientation technique validée par le client le 2026-10-30 (Electron, TypeScript, Three.js, Phaser ou PixiJS).
- Machines: Mac à puce M1 (macOS arm64) et PC Windows 11 (x64), supposé Intel Core i3 de 2018 à graphique intégré. Clavier AZERTY et souris, pas de manette, jeux à deux uniquement, dans la même pièce.
- Modèle de cahier des charges: `docs/modeles/cahier-des-charges.md`.
- Boîte à outils de production testée de bout en bout (Blender, FluidSynth, pedalboard, rsvg-convert): `outils/installer-outils.sh`.
- Branche de référence `main` créée.

## Phase 1: cadrage de la plateforme (en cours)

Objectif: tout décider et documenter avant de coder la plateforme.

- Fait: cahier des charges de la plateforme v1.0, validé par le client le 2026-10-30 (`docs/plateforme/cahier-des-charges.md`). Identité visuelle retenue: piste B « Étoile double ».
- Fait: parcours et wireframes (`docs/plateforme/ux/parcours.md`, `design/maquettes/plateforme-wireframes/`), trois pistes d'identité visuelle (`docs/plateforme/identite-visuelle-pistes.md`, `design/identite/`), architecture proposée (`docs/plateforme/architecture.md`), 132 critères d'acceptation (`docs/plateforme/criteres-acceptation.md`).
- En cours: ADR 0001 à 0013 (architecte-technique, dev-reseau pour 0007 et 0008, ingenieur-build pour 0011), identité visuelle détaillée de la piste B (directeur-artistique), identité sonore (sound-designer).
- Ensuite: maquettes haute fidélité (ux-ui-designer), critères d'acceptation de F14 (qa-testeur), puis phase 2 en commençant par le lot L1 (socle du dépôt).
- ADR de stack et d'architecture, contrat des jeux (architecte-technique).
- Modèle réseau, découverte LAN, pare-feu (dev-reseau).
- Distribution, mises à jour, signature des installateurs (ingenieur-build).
- Parcours et maquettes du lanceur (ux-ui-designer), identité visuelle de Duo (directeur-artistique), identité sonore (sound-designer).
- Socle du dépôt: monorepo, lint, typecheck, tests, CI avec contrôle typographique (ingenieur-build).

## Phase 2: plateforme v1 et jeu témoin

- Lanceur, profils, réglages; héberger et rejoindre en LAN; chargement et cycle de vie d'un jeu; installateurs macOS et Windows.
- Jeu témoin minimal à deux, pour éprouver toute la chaîne (réseau, entrées, son, rendu 2D et 3D).
- Recette sur le Mac et le PC du client.

## Phase 3 et suivantes: les jeux

Un jeu à la fois: cadrage, cahier des charges validé, prototype, alpha, bêta, 1.0.

### Premier jeu (cadrage en cours, en parallèle de la phase 1)

- Idée du client (2026-10-30): une simulation de vie en coopération qui mêle vie de village, ferme, construction de maison, besoins des personnages et métiers, avec progression, histoire principale et quêtes secondaires, pour une centaine d'heures de jeu sans ennui.
- On garde le genre et l'intention, avec un univers, des règles et un nom originaux (règle de création originale).
- Fait: trois pistes de concept dans `docs/jeux/jeu-1/pistes-concept.md` (A La Petite Ligne, recommandée; B Le Puits aux Étoiles; C Les Nuits de Brumecombe).
- Décisions du client (2026-10-30): piste A « La Petite Ligne », monde figé entre les séances, maison commune avec un coin à soi, défi léger sans combat. Vue: 3D low poly en isométrique, à confirmer par un essai de style mesuré.
- En cours: cahier des charges du jeu (game-designer), dans `docs/jeux/jeu-1/cahier-des-charges.md`. Ensuite: direction artistique et essai de style, direction sonore, interface, technique et critères d'acceptation du jeu.

## En attente du client

- Relevé des machines (Q4) avant le prototype, dont l'état de Smart App Control sur le PC (hypothèse retenue en attendant: i3 de 2018).
- Basculer la branche par défaut du dépôt sur `main` dans les réglages GitHub.
- Facultatif: coller `outils/installer-outils.sh` dans le « Setup script » de l'environnement cloud, pour que les outils soient prêts au démarrage de chaque session.
- Facultatif: autoriser le connecteur SpriteCook dans les réglages claude.ai (sprites générés par IA, consomme des crédits SpriteCook).
