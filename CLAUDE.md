# Duo: manuel du studio

Lu par la session principale (le manager) et par chaque membre de l'équipe (sous-agents). Il fixe le projet, l'organisation et les règles communes. Les décisions techniques validées (ADR dans `docs/plateforme/decisions/`) priment sur les orientations ci-dessous.

## Le projet

- **Duo** est une application de bureau pour jouer à deux en réseau local: le Mac du client (propriétaire du dépôt), à puce Apple M1, et le PC Windows 11 de sa compagne. L'un héberge la partie, l'autre la rejoint. Cibles: macOS arm64 et Windows x64.
- **Machine de référence pour les performances**: le PC, de configuration inconnue. Hypothèse prudente validée par le client: Intel Core i3 de 2018 avec graphique intégré (Intel UHD 620), écran de portable possible (1366x768), mémoire inconnue.
- **Joueurs**: toujours deux, dans la même pièce, chacun sur sa machine; pas de mode solo. Clavier AZERTY et souris, pas de manette.
- **Mémoire des parties**: sauvegardes, historique et score cumulé, demandés dès le premier jeu.
- Elle accueille des jeux originaux créés par le studio, en 2D, 3D ou isométrique, ajoutés un par un.
- Chaque jeu naît d'un cahier des charges (modèle: `docs/modeles/cahier-des-charges.md`) validé par le client avant toute production.
- Avancement et décisions en attente: `docs/feuille-de-route.md`.

## Orientation technique (validée par le client le 2026-10-30, à formaliser par ADR en phase 1)

- Application Electron: le même Chromium sur macOS et Windows, donc un rendu et un comportement identiques chez les deux joueurs, et testables ici avec le Chromium préinstallé.
- TypeScript strict et Vite, en monorepo: l'application, un SDK commun aux jeux, un paquet par jeu.
- 3D avec Three.js, 2D avec Phaser ou PixiJS, isométrique en 2D ou en 3D selon le jeu.
- Réseau local: la machine hôte fait tourner le serveur de partie dans le processus Node d'Electron; l'hôte est découvert automatiquement sur le LAN, la saisie d'IP reste un recours.
- Installateurs macOS et Windows fabriqués par GitHub Actions. Ajouter un jeu ne doit pas imposer de réinstaller l'application.

## Organisation

- Le client ne parle qu'au manager. Les membres rendent compte au manager, jamais au client, et ne délèguent pas: les outils de délégation et de contact avec le client sont retirés de leurs fiches, c'est voulu.
- Le manager traduit les demandes en tâches, briefe les membres, vérifie leurs livrables, intègre, committe, pousse et rend compte au client.
- Messages au client: en français, courts, sans jargon inutile. Ce qui est fait, ce qu'il faut tester, les décisions à prendre (chacune avec une recommandation).

### L'équipe (`.claude/agents/`)

| Membre | Rôle | Le solliciter pour |
|---|---|---|
| `game-designer` | Game designer | cahier des charges, règles, équilibrage, écriture |
| `level-designer` | Level designer | niveaux, cartes, arènes, courbe de difficulté |
| `ux-ui-designer` | Designer UX/UI | parcours, écrans, menus, HUD, accessibilité |
| `architecte-technique` | Architecte, lead dev | choix structurants, ADR, découpage technique, revue de code |
| `dev-plateforme` | Dev application Electron | lanceur, bibliothèque, cycle de vie des jeux, intégration macOS et Windows |
| `dev-reseau` | Ingénieur réseau | découverte LAN, salon, synchronisation, netcode, pare-feu |
| `dev-gameplay-3d` | Dev gameplay 3D | jeux 3D et isométriques en 3D (Three.js) |
| `dev-gameplay-2d` | Dev gameplay 2D | jeux 2D et isométriques en sprites |
| `ingenieur-build` | Build et release | outillage, CI, installateurs, versions, mises à jour |
| `directeur-artistique` | Directeur artistique | identité visuelle, bibles artistiques, revue visuelle |
| `artiste-2d` | Artiste 2D | sprites, pixel art, tilesets, icônes, illustrations |
| `artiste-3d` | Artiste 3D | modèles, matériaux, animations (glTF) |
| `tech-artist` | Technical artist | shaders, effets, éclairage, pipeline et budgets d'assets |
| `sound-designer` | Sound designer et compositeur | effets sonores, musiques, mixage |
| `qa-testeur` | Testeur QA | plans de test, tests automatisés, recette, rapports de bugs |

Un même rôle peut tourner en plusieurs exemplaires en parallèle (deux devs gameplay sur deux chantiers, par exemple).

### Règles de délégation (manager)

- Brief complet, car le membre ne connaît que ce brief, ce fichier et son carnet: objectif, fichiers à lire, livrables attendus avec leurs chemins, critères d'acceptation, contraintes, hors périmètre.
- Tâches indépendantes lancées en parallèle. Code modifié en parallèle: `isolation: "worktree"` pour chaque membre, puis intégration par le manager.
- Ce qui tient en quelques commandes, le manager le fait lui-même.
- Aucun livrable transmis au client sans vérification par le manager (fichiers relus, tests relancés).
- Carnets: chaque membre a une mémoire persistante dans `.claude/agent-memory/<membre>/`, versionnée avec le dépôt. On y note les apprentissages durables (pièges, conventions, astuces vérifiées), jamais l'avancement ni de secret.
- Les membres tournent sur le modèle de la session (aucun champ `model` dans les fiches). Pour réduire les coûts, on pourra affecter un modèle plus léger à certains rôles.
- Les fiches évoluent: quand un manque apparaît (outil, convention, piège), le manager met la fiche à jour.

## Processus de production

1. **Cadrage**: le manager échange avec le client jusqu'à pouvoir résumer le jeu en une phrase.
2. **Cahier des charges**: game-designer (règles, contenu, avec level-designer si besoin), directeur-artistique (direction artistique), sound-designer (direction sonore), ux-ui-designer (interface), architecte-technique et dev-reseau (technique), qa-testeur (critères d'acceptation testables). Le manager consolide.
3. **Validation**: le client valide, le cahier devient le contrat. Tout changement passe par le manager et s'inscrit dans l'historique du cahier.
4. **Production par jalons**, chacun présenté au client:
   - Prototype: jouable à deux en réseau, formes simples, sans art final. On valide le plaisir de jeu.
   - Alpha: toutes les fonctions et tout le contenu, assets provisoires.
   - Bêta: assets définitifs, son, finitions, aucun bug bloquant.
   - 1.0: recette réussie sur les deux machines, jeu publié dans Duo.
5. **Contrôles avant livraison**: revue de code (architecte-technique), revue visuelle (directeur-artistique), recette avec preuves (qa-testeur).
6. **Retours**: après chaque session de jeu du client, le manager transforme les retours en tâches.

La plateforme suit le même processus. Son cahier des charges est le premier, écrit en phase 1.

## Règles communes

### Langue et typographie

- Français pour la documentation, l'interface, les textes des jeux, les commits, les comptes rendus et les messages au client. Anglais pour les identifiants du code.
- **Interdits absolus, partout** (documents, interface, textes des jeux, commentaires, commits, messages): le tiret cadratin (U+2014) et le tiret demi-cadratin (U+2013). Les remplacer par deux-points, parenthèses, virgule ou une nouvelle phrase. Le trait d'union (-) reste permis.
- Contrôle mécanique avant chaque rendu, qui ne doit rien afficher:
  `grep -rnI -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' --exclude-dir=.git --exclude-dir=node_modules .`

### Création originale

Jeux originaux uniquement. S'inspirer d'un genre ou d'une mécanique est normal; reproduire un jeu existant (nom, univers, personnages, niveaux, identité visuelle ou sonore, combinaison de règles reconnaissable) est exclu, même renommé. Si une demande ressemble à un jeu existant, on en garde le genre et l'intention, et on propose une version originale.

### Ressources et licences

- Sources admises: créations du studio (code, SVG, scripts de génération, modèles Blender scriptés, synthèse sonore), génération par IA avec les outils fournis par le client, ressources externes sous CC0 ou CC-BY, polices sous OFL, code tiers sous licence permissive (MIT, BSD, ISC, Apache-2.0). GPL et licences non commerciales exclues.
- Toute ressource externe est inscrite dans `CREDITS.md` (fichier, auteur, source, licence).
- Les sources des assets générés (scripts, SVG, données) sont versionnées à côté des fichiers produits, pour pouvoir les régénérer et les retoucher.
- Ces règles visent ce qui est livré dans Duo. Les outils de production (Blender, FluidSynth, ffmpeg, pedalboard) peuvent être sous GPL ou LGPL: ce qu'ils produisent appartient au studio. Exception: les échantillons d'une banque de sons se retrouvent dans les musiques rendues, donc la banque utilisée (FluidR3_GM, licence MIT) est inscrite dans `CREDITS.md` dès la première musique livrée.

### Technique

- Hors ligne: Duo et ses jeux fonctionnent sans Internet, avec le seul réseau local. Seule la récupération des nouveaux jeux et des mises à jour peut passer par Internet, sans jamais être indispensable pour jouer. Pas de CDN; polices (paquets `@fontsource` sur npm), bibliothèques et assets embarqués.
- macOS et Windows à égalité: chemins construits avec `path` (espaces et accents dans les noms d'utilisateur), casse des noms de fichiers, fins de ligne, claviers AZERTY (touches lues par `KeyboardEvent.code`, libellés affichés selon la disposition réelle), écrans Retina et mise à l'échelle de Windows.
- TypeScript strict: pas de `any` sans justification en commentaire, pas d'assertion non nulle (`!`) gratuite, données externes (réseau, fichiers, réglages) validées à l'exécution, types de retour explicites sur les fonctions exportées, unions discriminées plutôt que plusieurs booléens.
- Valeurs de gameplay dans des fichiers de configuration typés, jamais en dur dans la logique.
- Aucun reste de débogage (`console.log`, `debugger`), aucun TODO sans référence. Commentaires rares, en français, qui expliquent le pourquoi.
- Aucun secret dans le dépôt.

### Git

- `main` est la branche de référence: les nouvelles sessions partent de là. Chaque session travaille sur sa propre branche, et le travail validé est reporté sur `main`.
- Accord du client (2026-10-30): le manager reporte lui-même le travail vérifié sur `main` à la fin de chaque étape.
- Le dépôt est public: tout ce qui y est versionné est visible par tous. Aucune donnée personnelle, aucun secret.
- Les membres ne committent pas et ne poussent pas: le manager relit, committe et pousse sur la branche de la session.
- Commits conventionnels en français, à l'impératif, en minuscules: `feat(reseau): ajoute la découverte des hôtes sur le LAN`.

### Preuve avant affirmation

- Une tâche n'est terminée qu'avec une preuve: sortie des tests, commande exécutée, capture d'écran examinée. Ce qui n'a pas pu être vérifié est dit, avec la raison.
- Ce qui ne se vérifie que sur les vraies machines (installation, pare-feu, son, performances) va dans la liste « À tester chez le client » du compte rendu.

### Environnement cloud (vérifié le 2026-10-30)

- Préinstallés: Node 22 et npm, Python 3.13, ffmpeg (encodeurs Vorbis, Opus et AAC), ImageMagick (sans lecture des SVG), xvfb-run, Chromium et Playwright (`require('playwright')`, `chromium.launch()` sans option). WebGL2 fonctionne en rendu logiciel (SwiftShader), WebGPU non.
- Boîte à outils du studio: `bash outils/installer-outils.sh` (moins de 2 minutes, relançable sans risque, inutile si le script est déjà dans le « Setup script » de l'environnement). Elle fournit:
  - `duo-python`: Python avec Blender 5.2 (`bpy`), mido, Pillow, scipy et pedalboard;
  - `fluidsynth` et la banque General MIDI `/usr/share/sounds/sf2/FluidR3_GM.sf2`;
  - `rsvg-convert` pour passer les SVG en PNG.
- Chaînes testées de bout en bout:
  - 3D: modélisation par script dans Blender, export GLB, rendu Cycles sur CPU (960x540 en 9 s), puis le même GLB chargé dans Three.js 0.187 sous Chromium, animation comprise.
  - Son: composition MIDI (mido), rendu FluidSynth, mastering (pedalboard), normalisation à -16 LUFS et encodage OGG avec ffmpeg; effets synthétisés avec numpy.
- Réseau: npm, PyPI, les dépôts apt d'Ubuntu, raw.githubusercontent.com et les fichiers de release GitHub (dont le binaire Electron) sont accessibles. Les sites d'assets libres (kenney.nl, polyhaven.com, quaternius.com, opengameart.org) sont refusés par la politique réseau. SpriteCook devrait passer par son connecteur claude.ai une fois que le client l'aura autorisé, car le trafic des connecteurs ne dépend pas de cette politique (non vérifié).
- Les machines cibles (macOS, Windows) ne sont pas accessibles d'ici.

### Compte rendu au manager (fin de chaque mission)

```text
Statut: terminé | partiel | bloqué
Fait: ...
Fichiers: créés, modifiés
Preuves: commandes lancées et résultats, captures examinées
Non vérifié: ... (et pourquoi)
Hypothèses: ...
À tester chez le client: ...
Questions pour le client: ... (chacune avec une recommandation)
Suite proposée: ...
```
