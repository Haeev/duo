# La Petite Ligne: architecture du code

Démo d'une heure (`docs/jeux/jeu-1/demo.md`). Ce fichier dit qui possède quoi et comment les données circulent. Les types qui font contrat sont dans `src/etat/`.

## Modules

| Dossier | Contenu | Propriétaire | Peut importer |
|---|---|---|---|
| `etat/` | contrats: `types.ts` (état du monde, tailles du sac et de la barre), `actions.ts` (intentions), `carte.ts` (carte statique), `vue.ts` (`GameView`, contrats du rendu, de l'interface et du son) | dev gameplay (simulation) | rien d'autre que `etat/` et `donnees/types.ts` |
| `donnees/` | lecture et contrôle des JSON de `../donnees/` (contenu, réglages, carte), types du contenu | dev gameplay | `etat/` |
| `simulation/` | toute la logique, TypeScript pur, pas fixe, sans DOM ni horloge ni `Math.random`; testée dans Node | dev gameplay | `etat/`, `donnees/` |
| `reseau/` | hôte qui fait autorité, invité qui envoie ses intentions, prédiction du déplacement de l'invité, schémas des messages | dev gameplay | `etat/`, `donnees/`, `simulation/`, `plateforme/` |
| `sauvegarde/` | sérialisation, contrôle et migration de l'état sauvegardé | dev gameplay | `etat/`, `donnees/`, `simulation/` |
| `plateforme/` | interface de secours (tant que `interface/` n'est pas livrée) | dev gameplay | `etat/`, `donnees/` |
| `entrees/` | clavier et souris vers `ControlFrame` et `Intent` (Z Q S D tournés selon la caméra, clic au sol, molette) | dev gameplay | `etat/` |
| `rendu/` | rendu Three.js: scène, modèles, animations, caméra, effets, son spatial éventuel | dev rendu 3D | `etat/`, `donnees/types.ts`, `three` |
| `interface/` | HUD, menus, dialogues, carnet, astuces, écrans (création, petit-déjeuner, nuit, fin) | dev interface | `etat/`, `donnees/types.ts` |
| `audio/` | sons et musiques, branchés sur les événements et l'état | dev audio | `etat/`, `donnees/types.ts`, `@duo/sdk` (module `audio`) |
| `session.ts` | une séance sur cette machine (hôte ou invité) derrière une `GameView`; sauvegardes et historique chez l'hôte; sans DOM, testée dans Node | dev gameplay | tout sauf `rendu/`, `interface/`, `audio/` |
| `main.ts` | point d'entrée: `connect` du SDK, contenu et carte, séance, rendu, interface, audio, boucle | dev gameplay | tout |

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

## Événements (son, effets)

Un seul flux, le même chez l'hôte et chez l'invité: `view.onEvent((event) => ...)`, avec `event` du type `WorldEvent` (`etat/types.ts`, fin du fichier). L'hôte les produit à chaque pas; l'invité les reçoit par le réseau (canal fiable), dans l'ordre. Quelques repères pour le son:

| Son | Événement ou lecture de l'état |
|---|---|
| pas selon le sol | pas d'événement: `characters[i].speed > 0` et `map.ground[cy * map.width + cx]` sous `characters[i].pos` |
| bêcher, semer, arroser, arrosoir vide, remplir | `tilled`, `sowed`, `watered`, `can_empty`, `refilled` |
| récolte, qualité « belle », déjà pris | `harvested` (`quality`), `already_taken` (case récoltée ou objet ramassé par l'autre à l'instant, à la touche comme au clic) |
| hache, arbre qui tombe, bêche de l'énigme | `chop` (`felled`), `dig` (`found`) |
| marteau, élément fini, construction finie | `build_progress` (début du travail; le marteau dure tant que `action.kind === 'hammer'`), `element_built`, `construction_done` |
| poutre | `beam_lifted`, `beam_dropped`, `beam_placed` |
| meuble posé, repris | `furniture_placed`, `furniture_taken` |
| scie, cuisine, repas | `crafted`, `cooked`, `ate` (et `action.kind` `saw`, `cook`, `eat`) |
| monnaie, caisse, proposition | `bought`, `sold`, `money`, `deposited`, `order_paid`, `proposal`, `proposal_resolved` |
| courrier, quêtes, envies | `letter`, `quest_started`, `quest_step`, `quest_done`, `envie_done` |
| train | `train_whistle`, `train_arriving`, `train_departing` (et `train.phase`, `train.progress`) |
| porte, coucher, nuit, matin, minuit | `door`, `went_to_bed`, `got_up`, `night`, `morning`, `midnight`, `veillee_started` |
| poules | `hens_arrived`, `eggs_laid`, `fed_hens` |
| habitants, scènes | `talk` (`villager`: motif de l'habitant), `scene_started`, `scene_ended` |
| fin | `demo_ended`, puis `session_finish` (les deux ont choisi « Continuer », ou « Finir la séance ») |
| repère (carillon chez les deux) | `pin` (`by`, `pos`); l'épingle est dans `characters[i].pin` |
| absence | `absence` (`who`, `absent`); `characters[i].absent`, `clock.stoppedBy === 'absence'` |
| pêche | `cast` (lancer, « plouf »), `bite` (touche, « ploc »), `caught` (`item`), `escaped`; la ligne est dans `characters[i].fishing` |

Musique et ambiance se lisent dans l'état: `clock.minutes`, `clock.veillee`, `phase`, `weather`, `characters[local].inHouse`.

## Contrats des modules d'affichage

- `src/rendu/index.ts` exporte `createRenderer: CreateRenderer` (`etat/vue.ts`): `load`, `frame`, `cameraYaw`, `camera`, `pick`, `stats`, `dispose`.
- `src/interface/index.ts` exporte `createInterface: CreateInterface`: `frame`, `handleKey`, `capturesMovement`, `dispose`. Tant qu'il n'existe pas, `main.ts` monte l'interface de secours (`plateforme/interface-secours.ts`).
- `src/audio/index.ts` exporte `createAudio: CreateAudio` (`etat/vue.ts`): il reçoit la `GameView` (état et événements) et le module `audio` du SDK; `frame`, `dispose`. Branché par `main.ts` dès que le fichier existe.
- `main.ts` appelle `frame` à chaque image, dans cet ordre: rendu, interface, audio.

## Simulation

- `simulation/monde.ts`: `createWorld(content, map, seed, players)`; `simulation/pas.ts`: `step(sim, { controls, intents })`, un pas de `1 / SIM_HZ` s (30 par seconde).
- Systèmes, un fichier chacun: `horloge`, `deplacement` (et la poutre à deux), `grille` (collisions, A*), `potager` (et la hache, l'eau, la bêche libre), `sac`, `economie`, `construction`, `amenagement`, `habitants`, `dialogues` (et scènes à deux), `quetes`, `conditions`, `effets`, `courrier`, `astuces`, `envies`, `poules`, `besoins`, `train`, `fin`; `agir` (case visée, verbe, clic), `intentions` (application des intentions).
- Identifiants du contenu cités par le code: `simulation/ids.ts`.
- Hasard: générateur à graine du SDK (`@duo/sdk/sim`), état dans `world.rng`.
- Empreinte: `simulation/empreinte.ts`, `hash(world)`.
- Robot: `simulation/robot.ts`, joue à deux (tests de fumée, d'endurance, partie complète).

## Données

Lues dans `../donnees/*.json` (game designer) et `../donnees/cartes/` (level designer), contrôlées au chargement par `donnees/contenu.ts` et `donnees/carte.ts`. Les heures `"19:00"` deviennent des minutes. Une valeur de ressenti absente de `reglages.json` prend sa valeur par défaut de `donnees/defauts.ts` (clé `feel`).

## Lancer

- Deux vues locales (développement): `pnpm --filter @duo/la-petite-ligne dev` et `pnpm --filter @duo/sdk-dev dev`, puis `http://localhost:5180/deux-vues.html?jeu=http://localhost:5173/`. Ajouter `?robot=1` à l'adresse du jeu pour qu'un robot joue (développement seulement).
- Deux ordinateurs du réseau local (sans Duo): `pnpm --filter @duo/sdk-dev servir la-petite-ligne --construire` sur le Mac, puis l'adresse affichée sur chaque machine; l'un héberge, l'autre rejoint.
- `pnpm --filter @duo/la-petite-ligne test`: contenu, carte, simulation, robots (première journée et démo complète), sauvegarde, réseau à deux (`startLocalDuo`).
