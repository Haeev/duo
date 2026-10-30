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

- Cahier des charges de la plateforme, écrit avec le client: `docs/plateforme/cahier-des-charges.md` (version 0.1 en cours de complément par l'équipe).
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

## En attente du client

- Valider le cahier des charges de la plateforme et choisir une piste d'identité visuelle.
- Dire si le dépôt reste public (recommandé) ou passe en privé.
- Relever la configuration réelle du PC dès que possible (hypothèse retenue en attendant: i3 de 2018).
- Basculer la branche par défaut du dépôt sur `main` dans les réglages GitHub.
- L'idée du premier jeu, qui aura besoin de sauvegardes.
- Facultatif: coller `outils/installer-outils.sh` dans le « Setup script » de l'environnement cloud, pour que les outils soient prêts au démarrage de chaque session.
- Facultatif: autoriser le connecteur SpriteCook dans les réglages claude.ai (sprites générés par IA, consomme des crédits SpriteCook).
- Les idées de jeux, le moment venu.
