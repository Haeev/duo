# Feuille de route

Tenue par le manager. Dernière mise à jour: 2026-10-31.

## Phase 0: constitution du studio (terminée)

- Équipe de 15 membres dans `.claude/agents/`, validée par le client le 2026-10-30. Manuel du studio dans `CLAUDE.md`.
- Orientation technique validée par le client le 2026-10-30 (Electron, TypeScript, Three.js, Phaser ou PixiJS).
- Machines: Mac à puce M1 (macOS arm64) et PC Windows 11 (x64), supposé Intel Core i3 de 2018 à graphique intégré. Clavier AZERTY et souris, pas de manette, jeux à deux uniquement, dans la même pièce.
- Modèle de cahier des charges: `docs/modeles/cahier-des-charges.md`.
- Boîte à outils de production testée de bout en bout (Blender, FluidSynth, pedalboard, rsvg-convert): `outils/installer-outils.sh`.
- Branche de référence `main` créée.

## Phase 1: cadrage de la plateforme (terminée)

- Cahier des charges de la plateforme v1.0, validé par le client le 2026-10-30 (`docs/plateforme/cahier-des-charges.md`). Identité visuelle retenue: piste B « Étoile double ».
- Parcours et wireframes (`docs/plateforme/ux/parcours.md`), identité visuelle et sonore (`docs/plateforme/identite-visuelle.md`, `identite-sonore.md`), architecture (`docs/plateforme/architecture.md`), critères d'acceptation (`docs/plateforme/criteres-acceptation.md`).
- Décisions techniques ADR 0001 à 0013 et 0015, acceptées (`docs/plateforme/decisions/`). L'ADR 0004 est amendé le 2026-10-31 (seuils du chien de garde).

## Nuit du 2026-10-30 au 2026-10-31: objectif du client

Le client veut au réveil une **démo d'environ une heure de La Petite Ligne**, jouable à deux, comme preuve de concept; l'objectif long terme des 100 heures reste. Il confirme que le premier jeu est la simulation de vie paisible en coopération (2026-10-30, 23 h 30).

- Jeu: La Petite Ligne, démo au bourg de La Halte d'Aubrune, première semaine jusqu'au premier train du samedi. Périmètre: `docs/jeux/jeu-1/demo.md` (game-designer). Code dans `games/la-petite-ligne/`.
- Plateforme: prototype Duo (lots L1 à L5, L7, L10 réduit) pour faire tourner la démo à deux en réseau local; installateurs macOS et Windows fabriqués par GitHub Actions et publiés en préversion. Repli si le PC refuse Duo (Smart App Control): l'hôte sert le jeu à un navigateur.
- Ordre: L1 (socle) puis, en parallèle, L2 et L3 (application et SDK, architecte), jeu (dev-gameplay-3d), L5 (réseau, dev-reseau); puis L4 et L10 (dev-plateforme), L7 (ingenieur-build), lumière et effets (tech-artist), interface du jeu (ux-ui-designer), recette (qa-testeur). Modèles, sons et carte du bourg ont démarré.
- Deux Astres (puzzle coopératif) est mis en pause: ses règles restent dans `docs/jeux/deux-astres/regles.md` pour un futur petit jeu.

État au matin du 2026-10-31:

- Fait: prototype de Duo (lanceur, profils, salon, découverte sur le réseau local, liaison authentifiée, cycle de vie d'un jeu, chien de garde, sauvegardes, historique), installateurs macOS et Windows fabriqués et testés par GitHub Actions, faux hôte de secours (`servir`).
- Fait: démo de La Petite Ligne jouable à deux de bout en bout (8 journées, 4 habitants, trame principale et quêtes secondaires, potager, construction et aménagement, pêche, commande du samedi), avec rendu 3D, interface complète, musiques et sons. Vérifié par les robots de test (démo finie sur 8 graines), par deux instances de Duo jusqu'à la scène d'arrivée, et par une partie entière jouée par les robots dans deux navigateurs (37 minutes, sans erreur, sans arrêt, sans écart entre les deux écrans).
- Ajouté le matin du 2026-10-31, à la demande du client (2 h de plus): une deuxième semaine (jours 9 à 15, commande du deuxième samedi, draisine, deuxième énigme d'Émile, quatre quêtes de coup de main; `docs/jeux/jeu-1/semaine-2.md`), le coin à soi dans la maisonnette (touche C), la tenue déjà portée signalée à la création. Démo d'environ deux heures, jouable en deux séances. Les robots jouent les deux semaines et toutes les quêtes.
- Recette: `docs/jeux/jeu-1/recette/2026-10-31-demo.md`. Guide de test pour le client: `docs/guides/tester-la-demo.md`.
- Reste à vérifier sur les vraies machines: installation, pare-feu, fluidité sur le PC, son, durée réelle de la démo.

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
- Fait: cahier des charges complet en brouillon (`docs/jeux/jeu-1/cahier-des-charges.md`, version 0.1), périmètre de la démo (`demo.md`), bible artistique, direction sonore, carte du bourg. La démo de la nuit du 2026-10-31 sert de prototype: le plaisir de jeu se valide dessus.
- Ensuite: retours du client sur la démo, puis validation du cahier des charges complet (objectif de 100 heures) avant l'alpha.

## En attente du client

- Publier la préversion v0.1.0 de Duo (page publique de téléchargement avec les installateurs). Recommandation: oui. En attendant, les installateurs se téléchargent depuis la page du workflow « Systèmes » de `main` (compte GitHub connecté).
- Relevé des machines (Q4) avant le prototype, dont l'état de Smart App Control sur le PC (hypothèse retenue en attendant: i3 de 2018).
- Basculer la branche par défaut du dépôt sur `main` dans les réglages GitHub.
- Facultatif: coller `outils/installer-outils.sh` dans le « Setup script » de l'environnement cloud, pour que les outils soient prêts au démarrage de chaque session.
- Facultatif: autoriser le connecteur SpriteCook dans les réglages claude.ai (sprites générés par IA, consomme des crédits SpriteCook).
