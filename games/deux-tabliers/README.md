# Deux Tabliers (`deux-tabliers`)

Tenir à deux un café en vue subjective (Three.js 0.187). L'hôte fait autorité, l'invité prédit ses pas. Cahier des charges et technique: `docs/jeux/cosy-cafe/` (titre de travail « Cosy Café »). État du code et suites: `ETAT.md`. Données: `donnees/SCHEMA.md`.

## Commandes

```bash
pnpm --filter deux-tabliers typecheck
pnpm --filter deux-tabliers lint
pnpm --filter deux-tabliers test          # test de fumée, quelques secondes
pnpm --filter deux-tabliers build
pnpm --filter @duo/sdk-dev build          # une fois: pages du faux hôte
node --experimental-strip-types packages/sdk-dev/src/serveur/servir.ts deux-tabliers --port 8080
# puis http://localhost:8080/deux-vues.html (les deux joueurs dans une page)
```

Paquet `.duogame`: comme La Petite Ligne, `node outils/paquet-jeu.mjs games/deux-tabliers --sortie <dossier>` (clé dans `DUO_CLE_PAQUETS`), ou le flux `jeux.yml` avec l'identifiant `deux-tabliers`.

## Règles du code

- La simulation (`src/simulation/`, `src/etat/`, et la partie simulation des chantiers) est du TypeScript pur: ni DOM, ni Three.js, ni horloge, ni `Math.random` (aléa: `sim.random`). Elle tourne dans Node pour les tests.
- Toute valeur de jeu vient de `donnees/` (schéma Valibot au chargement). Rien en dur.
- L'état partagé (`World`, `src/etat/monde.ts`) est décrit par des schémas Valibot: ils valident les sauvegardes et les messages du réseau. Il reste en JSON simple (pas de `Map`, pas de classes).
- L'hôte seul modifie le monde. L'invité envoie des entrées (chaque pas) et des intentions (chaque action), jamais d'état.
- Aucun objet ne flotte: un objet est tenu, posé sur un emplacement déclaré, ou sur un plateau (technique 5.5).
- Échap n'est jamais une touche du jeu (C19). Pour rendre la souris, toujours `duo.input.unlockPointer()` (jamais `document.exitPointerLock`, sinon le SDK croit à Échap et demande la pause).

## Carte des modules

| Dossier, fichier | Rôle | Propriétaire |
|---|---|---|
| `src/main.ts` | branchement dans le navigateur: SDK, données, séance, rendu, regard, HUD, son. Aucune règle | architecte (cœur) |
| `src/session.ts` | séance sans DOM: hôte ou invité derrière une même `GameView`, sauvegarde et reprise | cœur |
| `src/actions.ts` | actions du manifeste (union typée) | cœur |
| `src/donnees/` | schémas (`schemas.ts`), chargeur et contrôles croisés (`charger.ts`), fichiers embarqués (`fichiers.ts`) | cœur |
| `src/etat/monde.ts` | **état partagé typé**: joueurs, objets, meubles posés, et un domaine par chantier | cœur (chaque domaine: son chantier) |
| `src/simulation/geometrie.ts`, `collisions.ts`, `deplacement.ts` | collisions 2D sans physique (coque du plan + empreintes des meubles), pas de l'avatar (même fonction pour la prédiction) | cœur |
| `src/simulation/entrees.ts` | entrées par pas, cibles, intentions (union du cœur et des chantiers) | cœur |
| `src/simulation/interactions.ts` | cadre d'interaction pur: `planAct`, `planDrop`, `planLabel` (prendre, poser, plateau, pile, donner, utiliser un poste) | cœur |
| `src/simulation/visee.ts` | rayon des yeux et aimant de visée | cœur |
| `src/simulation/pas.ts` | pas de l'hôte: déplacements, intentions dans l'ordre d'arrivée (arbitrage), maintien des postes, systèmes des chantiers | cœur |
| `src/simulation/evenements.ts` | événements (union du cœur et des chantiers), vers le son et l'interface des deux machines | cœur |
| `src/simulation/systemes.ts`, `chantiers.ts` | **points d'extension**: `Chantier`, `GameSystem`, `StationHandler`, liste `CHANTIERS` déjà branchée | cœur |
| `src/reseau/` | canaux et schémas (`schemas.ts`), hôte (`hote.ts`), invité: prédiction, réconciliation, interpolation (`invite.ts`), `GameView` (`vue.ts`) | cœur, dev-reseau |
| `src/robots/robot.ts` | robot de test par tâches (marcher, agir, reposer, maintenir, attendre) | cœur, QA |
| `src/rendu/` | scène et caméra (`scene.ts`), coque en blocs aux cotes du plan (`coque.ts`), modèles GLB par nom avec substitut (`modeles.ts`), meubles, objets et avatars (`monde3d.ts`) | dev-gameplay-3d, tech-artist |
| `src/entrees/regard.ts` | regard à la souris, pointeur verrouillé, clic de reprise ignoré, panneaux qui rendent la souris | cœur |
| `src/audio/sons.ts` | sons par identifiant (`assets/son/**/<id>.ogg`), table événement vers son (`donnees/sons.json`) | sound-designer, cœur |
| `src/service/` | **chantier a**: postes et gestes, commandes, tickets, service, plonge | dev gameplay (a) |
| `src/clientele/` | **chantier b**: clients, attrait de l'ardoise, journée et semaine, économie, bilan, livre d'or, événements spéciaux | dev gameplay (b) |
| `src/amenagement/` | **chantier c**: catalogue, achat, placement libre avec contraintes, port à deux; règle des assises (`assises.ts`) | dev gameplay (c) |
| `src/interface/` | **chantier d**: HUD (`hud.ts`), panneaux (`panneaux.ts`): tablette, ardoise, bilan, écrans de début | dev interface (d) |
| `donnees/` | JSON validés: `reglages`, `objets`, `meubles`, `postes`, `sons`, `adresses/` (plan du level designer), `departs/` | game designer, level designer |
| `assets/modeles/`, `assets/son/`, `assets-src/` | GLB par nom, sons OGG par identifiant, sources | artistes, sound designer |
| `outils/importer-plan.py` | plan du level designer vers `adresses/` et `departs/` | level designer, cœur |
| `tests/fumee.test.ts` | test de fumée à deux (faux hôte en mémoire) | cœur, QA |

## Les quatre chantiers: où écrire, sans conflit

Chaque chantier de simulation (a, b, c) a le même gabarit, déjà branché; on n'édite que son dossier, `donnees/` (ses propres fichiers) et `donnees/SCHEMA.md` (sa section):

| Fichier du chantier | Point d'extension |
|---|---|
| `etat.ts` | son domaine de `World` (schéma Valibot et état initial). Sauvegardé et envoyé à l'invité quand il change (canal 3, 4 ou 5), sans autre code |
| `donnees.ts` | lecture de ses fichiers de `donnees/` (`readFile` et schéma), contenu exposé dans `content.service`, `content.clientele` ou `content.arrangement` |
| `intentions.ts` | ses intentions (`*_INTENTS`, types préfixés: `service-...`), validées par le réseau et reçues dans `system.intent` |
| `evenements.ts` | ses événements (`*_EVENTS`), envoyés à l'invité, reçus par `view.onEvent` (interface, son) |
| `index.ts` | son `Chantier`: `system.step(sim)` à chaque pas de l'hôte, `system.intent(sim, joueur, intention)`, `stations` (comportement des postes au-delà de `postes.json`: `refuse`, `complete`) |

Repères par chantier:

- **a. Service** (`src/service/`): les postes déclarés dans `postes.json` marchent déjà (clic ou maintien, transformation de l'objet posé sur l'emplacement du poste). Ajouter: recettes et ingrédients, gestes de précision jugés chez le joueur (intention `service-...` avec le résultat, bornée par l'hôte, technique 5.6), tickets et rail, service à table, plonge. Le pas de l'hôte appelle `system.step` après les intentions.
- **b. Clientèle** (`src/clientele/`): horloge de la journée et semaine dans le domaine `clientele` (déjà `day`), clients (positions envoyées compactes: ajouter un canal `latest` dédié au besoin, numéro 7 et plus), économie, bilan, livre d'or. Les clients ne bloquent jamais un joueur (C15): ne pas les ajouter aux collisions des joueurs.
- **c. Aménagement** (`src/amenagement/`): les meubles posés sont `world.furniture` (le cœur suit leurs empreintes pour les collisions et les redessine dès qu'un champ change). Ajouter: catalogue et achat (`price` de `meubles.json`), mode aménagement (action `arrange`, B), aperçu, contraintes de passage (grille de 25 cm, technique 5.8), port à deux. Règle du client: chaque pose d'assise passe par `orientSeat`, et `seatFacingIssues` doit être vide avant de valider.
- **d. Interface** (`src/interface/`): `createHud` (point de visée, invite, capsule, refus) et `createPanels` (registre de panneaux; Tab ouvre `tablette`, Retour arrière ferme). Un panneau ouvert rend la souris et la reprend à sa fermeture (C20). Lire l'état par `GameView` (`view.world()`, `view.onEvent`), jamais modifier le monde: une action du joueur part en intention. Les écrans propres à un chantier s'écrivent ici, à partir de son domaine.

Fichiers partagés que les chantiers ne modifient pas sans le dire au manager: `src/etat/monde.ts`, `src/simulation/*.ts`, `src/reseau/*.ts`, `src/session.ts`, `src/main.ts`, `donnees/reglages.json` (clés existantes), `duo-game.json`.

## Réseau (technique 5.3)

| Canal | Sens | Mode | Contenu |
|---|---|---|---|
| 0 | invité vers hôte | `reliable` | entrées de deux pas et intentions |
| 1 | hôte vers invité | `latest` | déplacements compacts, `ack`, 20 par seconde |
| 2 | hôte vers invité | `latest` | objets, meubles, usages des postes, quand ils changent (10 examens par seconde) |
| 3, 4, 5 | hôte vers invité | `latest` | domaines `service`, `clientele`, `arrangement`, quand ils changent |
| 6 | hôte vers invité | `reliable` | événements |

Tous les domaines repartent au moins toutes les deux secondes. Un message dépassant 64 Kio arrête la partie (SDK): surveiller la taille des domaines.

## Modèles et sons

- `assets/modeles/<nom>.glb`: `model` des données; mètres, origine au centre de l'empreinte au sol, `y` en haut. Avant déclaré dans `assets/modeles/modeles.json` (`{ "chaise": { "avant": "-z" } }`; `+z` par défaut): le jeu tourne le modèle pour que son avant suive l'avant du meuble posé. Fichier absent: bloc de substitution aux dimensions des données.
- `assets/son/**/<id>.ogg`: joué par identifiant (`sounds.play(id)`); sources dans `assets-src/son/`. Fichier absent: silence et un avertissement au journal.
