# Feuille de route

Tenue par le manager. Dernière mise à jour: 2026-10-30.

## Phase 0: constitution du studio (terminée)

- Équipe de 15 membres dans `.claude/agents/`, manuel du studio dans `CLAUDE.md`.
- Modèle de cahier des charges: `docs/modeles/cahier-des-charges.md`.

## Phase 1: cadrage de la plateforme (prochaine)

Objectif: tout décider et documenter avant de coder la plateforme.

- Cahier des charges de la plateforme, écrit avec le client: parcours, fonctions de la v1, contraintes des deux machines.
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

- Machines: Mac à puce Apple ou Intel; PC sous Windows 10 ou 11, processeur x64 ou ARM.
- Avis sur l'équipe et sur l'orientation technique (Electron, TypeScript, Three.js, Phaser ou PixiJS).
- Facultatif: activer SpriteCook et autoriser les domaines d'assets libres dans les réglages réseau de l'environnement cloud.
- Les idées de jeux, le moment venu.
