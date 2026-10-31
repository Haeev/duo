# La Petite Ligne: architecture du code

Démo d'une heure (`docs/jeux/jeu-1/demo.md`). Ce fichier dit qui possède quoi et comment les données circulent. Les types qui font contrat sont dans `src/etat/`.

## Modules

| Dossier | Contenu | Propriétaire | Peut importer |
|---|---|---|---|
| `etat/` | contrats: `types.ts` (état du monde), `actions.ts` (intentions), `carte.ts` (carte statique), `vue.ts` (`GameView`, contrats du rendu et de l'interface), `lecture.ts` (aides de lecture) | dev gameplay (simulation) | rien d'autre que `etat/` et `donnees/types.ts` |
| `donnees/` | lecture et contrôle des JSON de `../donnees/` (contenu, réglages, carte), types du contenu | dev gameplay | `etat/` |
| `simulation/` | toute la logique, TypeScript pur, pas fixe, sans DOM ni horloge ni `Math.random`; testée dans Node | dev gameplay | `etat/`, `donnees/` |
| `reseau/` | hôte qui fait autorité, invité qui envoie ses intentions, prédiction du déplacement de l'invité, schémas des messages | dev gameplay | `etat/`, `donnees/`, `simulation/`, `plateforme/` |
| `sauvegarde/` | sérialisation, contrôle et migration de l'état sauvegardé | dev gameplay | `etat/`, `donnees/`, `simulation/` |
| `plateforme/` | adaptateur vers le SDK Duo (session, boucle, réseau, sauvegardes, résultats, entrées), et faux hôte de secours | dev gameplay | tout sauf `rendu/` et `interface/` |
| `entrees/` | clavier et souris vers `ControlFrame` et `Intent` (Z Q S D tournés selon la caméra, clic au sol, molette) | dev gameplay | `etat/` |
| `rendu/` | rendu Three.js: scène, modèles, animations, caméra, effets, son spatial éventuel | dev rendu 3D | `etat/`, `donnees/types.ts`, `three` |
| `interface/` | HUD, menus, dialogues, carnet, astuces, écrans (création, petit-déjeuner, nuit, fin) | dev interface | `etat/`, `donnees/types.ts` |
| `main.ts` | point d'entrée: lit le contenu, crée la session, la simulation ou l'invité, le rendu, l'interface, la boucle | dev gameplay | tout |

Règle d'or: **le rendu et l'interface lisent l'état, ils ne le modifient jamais**. Toute volonté d'un joueur devient une `Intent` envoyée par `view.send(...)`.

## Flux des données

```text
            clavier, souris (entrees/)          interface (menus, dialogues)
                      |                                   |
                ControlFrame + Intent  <--- view.send(intent) (rendu: clic au sol via pick)
                      |
   HÔTE               v                               INVITÉ
   simulation.step(world, entrées des deux)         envoie ControlFrame + Intent (canal fiable)
        |  30 pas par seconde                       reçoit l'état (canal "dernier") et les
        |                                           événements (fiable), interpole les autres,
        +--> instantanés rapides (20/s): positions  prédit son propre déplacement et
        +--> état complet quand `revision` change   réconcilie avec l'hôte
        +--> événements du pas (sons, effets)
        |
   GameView.world() / alpha() / onEvent()  ---->  rendu.frame(), interface.frame()  (requestAnimationFrame)
```

- L'hôte fait autorité et simule tout le monde: horloge, cultures, habitants, poules, train, quêtes.
- L'invité n'envoie que des intentions; il ne simule que le déplacement de son propre personnage (prédiction), corrigé par l'hôte.
- Les sauvegardes, l'historique et les résultats ne partent que de l'hôte, par le SDK.

## Lire l'état (rendu, interface)

`GameView` (`etat/vue.ts`):

- `world()`: l'état à afficher (`ReadonlyWorld`). Relire à chaque image, ne rien garder.
- `alpha()`: interpolation. Position affichée d'un mobile = `prev + (pos - prev) * alpha`. Concerne `characters`, `villagers`, `hens`, `beam`, et `train.progress` (avec `train.prevProgress`).
- `onEvent(f)`: événements ponctuels (`WorldEvent` de `types.ts`): bêche, récolte, coup de hache, élément construit, train, porte, etc. C'est là que se branchent les sons et les effets de particules.
- `localCharacter()`: le personnage de cette machine (caméra, HUD, astuces, notifications).
- `content`, `map`: contenu du game designer et carte statique, identiques chez les deux.

Repères (`types.ts`, en tête): 1 case = 1 m; x vers l'est, y vers le sud; Three.js: `(x, hauteur, y)`; `facing` en radians, 0 vers l'est, PI/2 vers le sud.

Ce que le rendu trouve dans l'état:

| Besoin | Où |
|---|---|
| Personnages, apparence, animation | `characters[i].pos/prev/facing/speed/action.kind/action.since/appearance` |
| Case visée, aperçu d'un meuble | `characters[i].aim`, `characters[i].placement` |
| Destination d'un clic | `characters[i].destination` |
| Outil en main | `characters[i].bag[characters[i].selected]` |
| Potager | `garden[i].cell/soil/wet/crop.stage/crop.crop/crop.ripe` |
| Arbres | `trees[i].pos/kind/hits/felled/lastHitTick` |
| Poutre | `beam` (`null` une fois posée) |
| Toit, porte, poulailler | `constructions[i].status` et `elements[j].progress/done` |
| Maison réparée | construction `house_roof` et `house_door` à `done` |
| Meubles | `furniture[i].item/cell/rotation` (empreinte dans `content.items[item].footprint`) |
| Objets au sol | `groundItems` (boîte en fer, œufs, piles tombées) |
| Habitants | `villagers[i].pos/prev/facing/speed/visible/activity/talkingWith` |
| Poules | `hens` |
| Train | `train.phase/progress/prevProgress` |
| Heure, jour, météo, lumière | `clock.day/minutes`, `weather` |
| Ombre de la cloche (énigme) | `clock.minutes` entre 17 h et 17 h 30 et `weather === 'sunny'` |
| Remise ouverte | `worldStates.handcar_shed === 'open'` |

## Agir (interface, rendu)

- Le rendu traduit un clic en `PickResult` (`renderer.pick`); `main.ts` en fait une intention `move_to` (aller là et agir).
- L'interface envoie les intentions de menu (`menu`, `buy`, `sell`, `craft`, `eat`, `crate_deposit`, `dialogue_next`, `dialogue_choice`, `start_day`, `night_choice`, `create_character`...). Ouvrir un menu: `send({ type: 'menu', menu: 'shop' })`; le fermer: `menu: null`. L'horloge s'arrête quand les deux joueurs sont dans un menu, un dialogue ou une scène.
- Un refus (fonds, portée, sac plein) arrive comme notification dans `characters[i].notifications`, avec le texte de `textes.json`.

## Contrats des modules d'affichage

- `src/rendu/index.ts` exporte `createRenderer: CreateRenderer` (`etat/vue.ts`): `load`, `frame`, `cameraYaw`, `camera`, `pick`, `stats`, `dispose`.
- `src/interface/index.ts` exporte `createInterface: CreateInterface`: `frame`, `handleKey`, `capturesMovement`, `dispose`.
- `main.ts` appelle `frame` des deux à chaque image, dans cet ordre: rendu, puis interface.

## Simulation

- `simulation/monde.ts`: `createWorld(content, map, seed, players)`; `simulation/pas.ts`: `step(sim, inputs, intents)`, un pas de `1 / SIM_HZ` s (30 par seconde).
- Systèmes, un fichier chacun: `horloge`, `deplacement`, `potager`, `sac`, `economie`, `construction`, `amenagement`, `habitants`, `dialogues`, `quetes` (conditions et effets lus dans les données), `courrier`, `astuces`, `poules`, `besoins`, `train`, `fin`.
- Hasard: `simulation/hasard.ts` (générateur à graine, état dans `world.rng`).
- Empreinte: `simulation/empreinte.ts`, `hash(world)`.
- Robot: `simulation/robot.ts`, joue à deux (tests de fumée, d'endurance, partie complète).

## Données

Lues dans `../donnees/*.json` (game designer) et `../donnees/cartes/` (level designer), contrôlées au chargement par `donnees/contenu.ts` et `donnees/carte.ts`. Les heures `"19:00"` deviennent des minutes. Une valeur de ressenti absente de `reglages.json` prend sa valeur par défaut de `donnees/defauts.ts` (clé `feel`).

## Lancer

- `pnpm --filter @duo/la-petite-ligne dev`: Vite; ouvrir `/?vue=double` pour deux vues dans la même page, ou deux onglets `/?role=host` et `/?role=guest` (relais par `BroadcastChannel`), ou deux machines avec `/?role=host&relais=vite` et `/?role=guest&relais=vite` (relais par le serveur de Vite).
- `pnpm --filter @duo/la-petite-ligne test`: simulation, robots, réseau, sauvegarde.
