# La Petite Ligne: état du code (démo)

Point d'avancement du dev gameplay, du plus récent au plus ancien.

## Demandes du rendu

Tenue par le dev rendu 3D (`src/rendu/`). Chaque point dit ce que le rendu fait en attendant.

1. Fait: convention de `cameraYaw()` (haut de l'écran posé au sol, convention de `facing`; première orientation `yaw = -3 PI/4`), adoptée par `src/entrees/`.
2. Fait: `MapProp.height` et `MapProp.category` (le rendu prend d'abord la hauteur de marche `walk_height` du modèle de l'artiste, sinon `height` pour la catégorie `sol`).
3. Fait: `map.trees` = les 12 arbres à couper; les autres arbres restent dans `map.props`.
4. Fait: rotation des meubles selon la convention de la carte.
5. Facultatif, toujours ouvert: cases d'« herbe haute » (`,`) pour des touffes plus denses. En attendant: bruit déterministe.

Modèles (artiste 3D, 2026-10-31): dans `personnages.glb`, sur le squelette commun, les animations sur place `fish_cast` (lancer, 1 s, une fois), `fish_wait` (attente canne tenue, boucle de 3 s), `fish_strike` (ferrer et mouliner, 1,6 s, une fois) et `sit_ground` (assis par terre, boucle de 3 s) sont disponibles, à brancher à la place de `chop`, `water` et `sit` sur la caisse. Les trois clips de pêche partent et finissent sur la même pose d'attente. La canne `fishing_rod` (`socket_hand_r`) est corrigée: le scion part bien de la main, et son bout tombe là où l'attend `ROD_TIP` (0, 1,34, 1,49), avec un nœud vide `fishing_rod_tip` à cet endroit. La ligne et le bouchon intégrés au modèle sont retirés (le rendu dessine les siens), et un bouchon `fishing_float` est disponible dans `ferme.glb`. Détails: `assets/modeles/README.md`.
Branché par le rendu (2026-10-31): `fish_cast` une fois sur `cast`, `fish_wait` en boucle tant que `fishing` existe (attente et touche), `fish_strike` une fois sur `caught` ou `escaped`, enchaînés par des fondus de 0,1 s depuis la même pose; `sit_ground` pour `action.kind === 'sit'` hors d'une chaise (dont l'absence), posé sur le dessus d'une paillasse ou d'un lit (`sleep_height`) s'il y en a un sous le personnage, et `sit` sur un meuble qui a `seat_height` (chaise). La ligne part du nœud `fishing_rod_tip`, lu à chaque image; le bouchon est `fishing_float`. La caisse sous l'absent est retirée.

### Réponses du rendu aux demandes du dev gameplay

1. Fait: `quality: 'light'` est honoré par `src/rendu/` (`RENDER_SETTINGS.light`): rapport de pixels 0,5 et 640x360 pixels physiques au plus, `shadowMap.enabled = false` et soleil sans ombre, antialiasing coupé, particules et pluie au quart, touffes, fleurs, galets et forêt du pourtour au quart, indicateur de performances masqué, résolution dynamique arrêtée. Mesuré dans la page de démonstration (`rendu.html?rendu=leger`): 63 appels de dessin, 68 000 triangles, 6 programmes. **À faire côté `main.ts`: retirer le palliatif CSS (canevas à la moitié agrandi)**, sinon la résolution est divisée deux fois.
2. Fait: repère (`characters[i].pin`): épingle à la couleur et au symbole du profil Duo de celui qui l'a plantée (astre, croissant, étoile, soleil, planète, comète), visible des deux joueurs et à travers les murs, qui tombe en rebondissant, onde au sol répétée, fondu sur la fin de sa durée (`src/rendu/signes.ts`).
3. Fait: pêche (`characters[i].fishing`, événements `cast`, `bite`, `caught`, `escaped`): animations `fish_cast`, `fish_wait`, `fish_strike` de l'artiste, ligne du bout de la canne au bouchon `fishing_float`, bouchon qui flotte puis plonge à la touche avec des ronds dans l'eau, poisson qui sort de l'eau et saute au sac, bouchon qui remonte et s'efface s'il s'échappe (`src/rendu/peche.ts`, `personnages.ts`).
4. Fait: absence (`characters[i].absent`): le personnage s'assoit par terre (`sit_ground`) et une auréole douce à sa couleur respire au sol; aucun symbole au-dessus de la tête (`src/rendu/signes.ts`).
5. Corrigé (signalé par le son): au départ, le train partait d'un saut de 70 m puis revenait. `trainOffset` (`src/rendu/voie.ts`) suit maintenant `progress` de 1 à 0 au départ, sans saut, et le train arrive et repart par l'ouest (`RENDER_SETTINGS.train.sideDirection = -1`, comme `departureDirection` du son); test `voie.test.ts` (position monotone à l'arrivée et au départ).

### Ce que le rendu offre en plus du contrat `Renderer`

- `RenderEngine` (exporté par `src/rendu/index.ts`): `setReducedMotion(bool)` (réglage qui change en cours de partie), `detailedStats()` (appels, triangles, programmes, géométries, textures, images par seconde), `programList()`, `resolutionScale()`.
- `pick()` renvoie la cible la plus proche (personnage, habitant, meuble, objet au sol, arbre debout) avant le sol; le sol tient compte de la hauteur du terrain (quai, berges) et vaut `null` hors de la carte.
- Indicateur de performances en haut à gauche en mode développement (`import.meta.env.DEV`), rouge au-delà des budgets (150 appels, 250 000 triangles, 12 programmes); résolution dynamique qui descend par paliers jusqu'à 0,75 si les images dépassent 20 ms en moyenne.
- Trous de visibilité: ce qui cache un des deux joueurs (bâtiment, arbre, auvent) s'efface en trame autour de lui; la maisonnette coupe toit et murs côté caméra quand le personnage local y est (`inHouse`).
- Page de démonstration du rendu seul: `rendu.html` (paramètres en tête de `src/rendu/demo/main.ts`), essai d'endurance `rendu.html?cycles=12`.

### Points d'accroche pour le technical artist

`src/rendu/lumiere.ts` est à lui désormais; le dev rendu ne le modifie plus.

- Extensions: `src/rendu/extensions.ts`. Inscrire une fonction dans `RENDER_EXTENSIONS`; elle reçoit `RenderHooks` une fois la scène construite et renvoie une partie (`update(context)` à chaque image après celles du rendu, `dispose()` à la sortie) ou `null`. `context` (`contexte.ts`): état du monde, `alpha`, `dt`, temps, personnage local, orientation de la caméra, `night`, réduction des animations.
- `RenderHooks`: `renderer`, `scene`, `camera`, `map`, `materials` (`palette` = `lpl_palette`, partagé par tout le décor, le terrain et les objets; `water`; `ghost`; `paletteColor(case)`), `characterMaterial` (`lpl_characters` des habitants; chaque joueur en a une copie à sa texture), `library` (`node(nom)`, `extras(nom)`), `terrain` et `water` (surface de la rivière, un seul maillage), `daylight` (l'instance de `DaylightRig`), `smokeEmitter()` (nœud `locomotive_smoke`), `trainState()` (visible, en mouvement), `resources` (suivi pour la libération).
- Ce que le moteur appelle à chaque image, à garder ou à changer avec le dev rendu: `daylight.update(minutes, météo, point suivi, rayon de vue, distance de la caméra)`, puis `materials.setNight(daylight.night)` (émission de `lpl_palette` = `night x RENDER_SETTINGS.nightGlow`, 1,6 aujourd'hui; le README des modèles conseille 1 la nuit) et `materials.setTime(t)` (eau).
- Le panache actuel du train (particules `smoke` de `effets.ts`, au nœud `locomotive_smoke`) s'arrête en mettant `effects.smokePuffsPerSecond` à 0 dans `reglages.ts` (à demander au dev rendu) si `panache.ts` le remplace.
- Programmes de shader: 10 sur 12 aujourd'hui (`lpl_palette` normal, instancié et animé, `lpl_characters`, `lpl_water`, fantômes, et 4 variantes d'ombre). Un nouveau matériau en ajoute au moins un: à surveiller avec `programList()`. `lpl_palette` porte déjà un `onBeforeCompile` (trous de visibilité autour des joueurs, `materiaux.ts`): l'enchaîner plutôt que le remplacer.

## Demandes du dev gameplay au rendu

1. Mode de rendu léger, pour que qa-testeur joue des séquences dans le Chromium du cloud (rendu logiciel). `main.ts` passe désormais `quality: 'light'` dans `RendererOptions` (nouveau champ facultatif `quality?: RenderQuality` de `etat/vue.ts`) quand l'adresse du jeu ou celle du faux hôte porte `?rendu=leger` (exemple: `deux-vues.html?rendu=leger`). Demandé au rendu en mode `light`: résolution interne basse (par exemple rapport de pixels 0,5, au plus 640x360 pixels physiques), ombres coupées (`shadowMap.enabled = false`, pas de lumière qui projette), antialiasing coupé, particules et effets réduits au minimum, végétation clairsemée, indicateur de performances masqué. Fait par le rendu (640x360 au plus, ombres et antialiasing coupés, végétation et particules au quart); le palliatif CSS de `main.ts` est retiré.
2. Repère (P1, GE-07): `characters[i].pin` (`pos`, `since`, `until` en ticks), visible chez les deux tant qu'il existe: épingle à la couleur du joueur (`appearance.scarf`) et onde au sol. Événement `pin`.
3. Pêche (P1): `characters[i].fishing` (`phase` `waiting` puis `bite`, `bobber` = position du bouchon). Pas de nouvel `ActionKind` (il aurait cassé `Record<ActionKind, string>` du rendu): pose de pêche à déduire de `fishing !== null`, bouchon qui plonge en `bite`. Événements `cast`, `bite`, `caught`, `escaped`. La canne (`fishing_rod`) est dans le sac de chacun dès le début.
4. Absence (P1): `characters[i].absent`; la simulation met alors `action.kind` à `sit`.


## Demandes de l'interface

Tenue par le dev interface (`src/interface/`). Les demandes 1 à 7 sont faites par le dev gameplay (merci); l'adaptateur provisoire est retiré, l'interface lit les champs directement.

8. `src/entrees/commandes.ts`, A et E (`camera-left`, `camera-right`): appeler d'abord `ui.handleKey('KeyQ')` ou `ui.handleKey('KeyE')`, et ne tourner la caméra que si la réponse est `false`. Dans le carnet et au comptoir d'Odette, A et E changent d'onglet et la caméra ne doit pas tourner (README des maquettes, section 4). En attendant: les onglets changent ET la caméra tourne.
9. `src/main.ts`: donner les commandes de caméra aux boutons du HUD. Soit `createInterfaceWith({ ...options, camera: (c) => renderer.camera(c) })` (exporté par `src/interface/index.ts`), soit un champ facultatif `camera?: (command) => void` dans `InterfaceOptions` (`etat/vue.ts`), que l'interface lit déjà. En attendant: le bouton simule la touche (KeyboardEvent sur `document.body`, vu par l'écouteur du SDK).
10. À savoir pour `commandes.ts` (rien à faire): l'interface arrête la propagation de `pointerdown` sur ses propres éléments, donc un clic sur la barre d'outils, un panneau ou un écran plein cadre n'arrive pas à l'écouteur du SDK (pas de `move_to` sous le HUD). Les touches traitées par l'interface quand le focus y est (activation, flèches, Tab, Retour arrière, Entrée) sont quand même vues par le SDK (écoute en capture): `handleKey` ignore une touche déjà traitée dans les 400 ms, donc `main.ts` peut continuer à transmettre Tab, Retour arrière et Entrée comme aujourd'hui.
11. Fait côté interface (les quatre textes `placement_*` sont dans `textes.json`): la barre d'aménagement montre la raison donnée par la simulation dans `PlacementPreview.blocked` (texte tout fait, ou clé `placement_*` traduite par `textes.json`); sans texte, le message général de l'interface (`build.blocked`). Vérifié en capture: « Il y a déjà un meuble à cet endroit. ». Remarque pour la simulation: `blocked` n'est recalculé que si la case, la rotation ou `valid` changent; si la raison change sans que `valid` change, l'ancienne reste affichée.
12. Fait côté interface: la carte de proposition prend `indefinite` de l'objet (`objets.json`) dès que le contenu le porte, lu à l'exécution, puis l'article de `textes-interface.json` (`proposal.indefinite`), puis le nom seul. Reste côté données et simulation: le champ dans le schéma du contenu et le message de la simulation (`big_purchase_proposal`, notification non affichée par l'interface, la carte la remplace).

## Interface

Point d'avancement du dev interface (`src/interface/`), du plus récent au plus ancien.

### 2026-10-31, recette LPL-R04 et LPL-R05, demandes 11 et 12

- LPL-R04: `hud.stopped.both_busy` devient « Menus ouverts des deux côtés · l'horloge attend »; relecture de `textes-interface.json`: « Chacun crée son personnage » devient « Vous créez vos personnages en même temps, sur les deux ordinateurs. », « Chacun choisit sa réplique » devient « Choisis ta réplique. », « ce que l'un range, l'autre peut le prendre » devient « ce qui y est rangé sert à vous deux. », les noms accessibles « Les deux joueurs » et « Choix des deux joueurs » deviennent « Vous deux » et « Vos deux choix ».
- LPL-R05: `typographie.ts` pose maintenant l'espace avant « : » (insécable) et « ; ? ! » (fine insécable) dans tous les textes affichés, données comprises, même sans espace dans le texte; jamais dans une heure (12:30) ni une adresse (https://). Tests dans `tests/typographie.test.ts`; capture de la création: « profil Duo : astre aqua » et « samedi prochain à 16 h : 12 radis » s'écrivent pareil.
- Jauge d'endurance corrigée à la source (`ui-maquettes/composants.css`, `.lpl-stamina__fill` en bloc); le correctif d'`interface.css` est retiré. La planche et les captures des maquettes ne sont pas régénérées (elles montrent encore la jauge vide).

### 2026-10-31, nuit: interface en jeu de la démo

- Point d'entrée: `src/interface/index.ts` exporte `createInterface` (contrat `CreateInterface`), déjà choisi par `pickInterface()` de `main.ts`, et `createInterfaceWith` (même chose avec `camera`).
- Monté: écran titre (prêts à deux par `title_ready`), création (prénom, 3 coiffures, 4 tenues, foulard du profil; lettre de la coopérative en attendant l'autre; « Le train entre en gare… »), petit-déjeuner (forme, envies, courrier, œufs), HUD (horloge avec jour, heure, météo et arrêts: scène, veillée, minuit, menus des deux, absence; bourse avec somme réservée et gain; notifications, 3 au plus, 6 s; l'autre joueur avec portrait, activité en mots, pause, sommeil; prochain objectif avec lignes de la commande ou liste à cocher; soi avec portrait à 5 expressions, forme, endurance discrète; astuce avec touches réelles; barre de 10 cases avec eau de l'arrosoir, qualité, case nouvelle ou inutilisable; boutons caméra et carnet), dialogues (répliques, choix, Retour arrière au revoir), scène à deux (choix de l'autre visible, attente, réponses), lecture de la carte d'Émile (ouverte d'elle-même quand elle arrive dans le sac), carnet (Quêtes, Courrier avec non-lus, Sac avec détail, Manger, Lire, Prendre en main, déplacer au clavier ou par glisser-déposer), caisse et commande du samedi (déposer, reprendre, complète, expédiée), catalogue (commandé, trop cher, accord de l'autre, fermé, livré, retirer), comptoir d'Odette (acheter, acheter 4, proposer, vendre 1 ou tout, plafond du jour), établi, réchaud (cuisiner, manger ensemble), coffre de la maison, proposition de gros achat (reçue, envoyée, acceptée tamponnée, refusée repliée), aménagement (meuble en main, orientation, refus avec la raison, touches), écran de nuit (Continuer, Finir la séance, choix de l'autre, désaccord), fin de séance, écran de fin de la démo (3 chiffres, Continuer à deux par `end_ready`).
- Styles: `ui-maquettes/jeton.css` et `composants.css` importés tels quels, `icones.svg` inséré une fois; compléments dans `src/interface/interface.css` (dont un correctif: `.lpl-stamina__fill` est un `span` sans largeur dans `composants.css`, la jauge d'endurance restait vide, aussi dans les maquettes).
- Textes: `donnees/textes.json` d'abord (`ui`, `nightScreen`, `endScreen`, `form`, `messages`, `weather`, `weekdays`), libellés des maquettes en complément dans `src/interface/textes-interface.json`; tous contrôlés au montage (Valibot), typographie française appliquée à l'affichage.
- Page de démonstration (outil, pas le jeu): `src/interface/demo/index.html?scenario=jour` (vraie simulation, vrai rendu, robot pour l'autre; scénarios dans `demo/scenarios.ts`).
- Tests: `src/interface/tests/` (Vitest, 65 tests depuis la recette): typographie, formats, focus et navigation, textes, modèles du HUD et des panneaux, notifications, portraits.
- Vérifié: `pnpm --filter @duo/la-petite-ligne lint` et `typecheck`, `pnpm verifier`, tous les tests du jeu (200); captures Playwright de tous les écrans sur la page de démonstration (scène 3D derrière), parcours au clavier (titre, création, carnet, sac, scène à deux, proposition, nuit); vrai jeu (`main.ts`) dans les deux vues du faux hôte: écran titre chez l'hôte et l'invité, « Commencer la semaine » synchronisé, passage à la création chez les deux. Au-delà, le rendu logiciel de l'environnement cloud affame les deux vues (« Le jeu ne répond plus » du faux hôte, aussi sans action de l'interface).
- Coût: un rafraîchissement complet de l'interface ≈ 0,8 ms (Chromium sans tête), au plus 11 par seconde; les autres images comparent seulement l'heure affichée. Dix démontages et remontages: même nombre de nœuds DOM, un seul sprite.

## 2026-10-31, étape 4: mode léger, interface, son, P1

- Mode de rendu léger: `?rendu=leger` (adresse du jeu ou du faux hôte) passe `quality: 'light'` au rendu (demande au rendu ci-dessus); en attendant, canevas à moitié de taille agrandi en CSS.
- Interface: `main.ts` monte `createInterface` de `src/interface/` (vérifié: écran titre affiché dans les deux vues). Demandes 3 à 6 faites (écran titre et écran de fin synchronisés, raison d'un refus de pose, clé des notifications).
- Son: `main.ts` monte `createAudio` de `src/audio/index.ts`, avec ses options en plus (`lifecycle` pour la pause, `cameraYaw` pour les oreilles, `log`); un son qui ne se charge pas n'empêche jamais de jouer.
- Pêche: notification `fish_escaped` quand le poisson s'échappe; textes de refus de pose (`placement_*`) affichés par `PlacementPreview.blocked`. Événements nouveaux pour le son: `pin`, `absence`, `cast`, `bite`, `caught`, `escaped` (tableau de `src/README.md`).
- Quêtes corrigées par le game designer: robots relancés, démo finie, clé trouvée au plus tôt le jour 3.
- Vérifié dans Chromium (faux hôte, `deux-vues.html?rendu=leger`): canevas de 316x217 par vue au lieu du double, interface prête en 5 s au lieu de 20, 3 à 4 images par seconde par vue en rendu logiciel; écran titre synchronisé (« C'est parti » de l'un visible chez l'autre, création ouverte chez les deux quand les deux sont prêts).
- P1 faits: repère (G ou clic molette, 15 s, une épingle par joueur), absence (3 minutes sans entrée en journée: l'horloge attend, le personnage s'assoit, « L'horloge attend Camille. » chez l'autre), pêche (canne dans le sac de chacun, lancer à 6 m sur l'eau, touche après 3 à 15 s, 1,5 s pour ferrer; poissons tirés selon `feel.fishWeights`, 6, 3 et 1 par défaut; pari de Jeanne jouable). La plume de geai (décoration) se pose comme un meuble.

## Demandes de l'audio

Tenue par le dev audio (`src/audio/`). Chaque point dit ce que le son fait en attendant.

1. Fait par le dev gameplay (merci): `main.ts` passe `lifecycle: duo`, `cameraYaw` et `log` à `createAudio`. Vérifié dans les deux vues du faux hôte: Échap met le son des deux machines en pause (musique à -12 dB, effets coupés). Reste à ajouter ces trois champs facultatifs à `AudioOptions` de `etat/vue.ts` (aujourd'hui ils passent parce que `createAudio` est typé par `CreateAudio` après un `import.meta.glob`; le type `AudioExtras` de `src/audio/index.ts` les décrit).
2. Rendu (à transmettre au dev rendu): au départ du train, `voie.ts` calcule `offset = -slideDistance * easeIn(progress)` alors que `progress` va de 1 à 0 pendant `departing`: le train saute 70 m à l'ouest au premier pas du départ puis revient vers le quai. Il faudrait `-slideDistance * easeIn(1 - progress)` (repartir vers l'ouest, comme le dit la carte: `exit_line_west`) ou `+slideDistance * easeIn(1 - progress)` (continuer vers l'est). Le son place la locomotive selon `departureDirection` de `src/audio/reglages.ts` (-1, vers l'ouest): à aligner avec le choix du rendu.
3. Sound designer (par le manager): la pêche (P1) n'a pas de sons à elle (son.md 8). En attendant, substituts: lancer `water`, touche `pickup` au bouchon, prise `harvest` et `quality-fine`, poisson échappé `water-empty`. La note du vent dans `sons.json` (« plus fort près de la lisière, x 50 à 64, y 36 à 48 ») reprend les coordonnées de l'ancienne carte: le son utilise la zone `forest_edge` de la carte du level designer.
4. Architecte (par le manager): le SDK n'a pas de limiteur sur le bus principal ni de quatrième bus « Ambiance » (son.md 3.1, S2). En attendant: un limiteur sur les effets (ambiance comprise) et un sur l'interface, avant les bus du SDK; l'ambiance est un sous-bus des effets (réglée par le volume « Effets »).
5. Rien d'autre à demander à la simulation: chaque événement utile existe (dont `pin`, `absence`, `cast`, `bite`, `caught`, `escaped`, arrivés pendant la nuit). Ce qui se lit dans l'état (pas selon le sol, marteau, scie, réchaud, poutre portée, menus, outil, clic au sol, notifications, lignes de la commande, poules) est dérivé d'une image à l'autre (`src/audio/declencheurs.ts`). Un nouvel événement dans `WorldEvent` fait échouer `pnpm lint` dans `declencheurs.ts` (switch exhaustif, voulu): ajouter son `case`, même muet.

## Audio

Point d'avancement du dev audio (`src/audio/`), du plus récent au plus ancien. Mode d'emploi: `src/audio/README.md`.

### 2026-10-31: sons de la pêche (sound-designer)

- Livrés dans `assets/son/effets/` et déclarés dans `sons.json` (détail: `docs/jeux/jeu-1/son.md`, section 4): `fishing-cast` (au pêcheur, 2 variantes), `fishing-splash` (au bouchon, 0,55 s après le lancer, 2 variantes), `fishing-bite` (au bouchon, 3 variantes, priorité 2), `fishing-catch` (au bouchon, éclaboussure et frétillement, 2 variantes), `fishing-escape` (au bouchon).
- À brancher dans `src/audio/declencheurs.ts` à la place des substituts: `cast` -> `fishing-cast` puis `fishing-splash` à `event.at`; `bite` -> `fishing-bite`; `caught` -> `fishing-catch` (remplace `harvest` et `quality-fine`); `escaped` -> `fishing-escape`. Les sons au bouchon ont une distance de référence de 6 m (`spatial.refDistance` dans `sons.json`).
- Note du vent corrigée dans `sons.json`: il suit la zone `forest_edge` de `donnees/cartes/halte.json` (point 3 des demandes de l'audio).
- À mettre à jour par le dev audio: `src/audio/catalogue.test.ts` attend 71 sons, `sons.json` en déclare maintenant 76 (vérifié: ce test échoue sur ce seul compte, les 64 autres tests de `src/audio` passent avec le nouveau fichier).
- Contrôlé: sonie et crêtes par `ebur128` (aucune crête au-dessus de -1,5 dBTP), décodage dans Chromium des 131 fichiers. Pour information, `design/son/la-petite-ligne/en-jeu/depart.m4a` (enregistrement du banc) a une crête vraie de -0,5 dBTP.

### 2026-10-31, nuit: tout le son de la démo

- `createAudio` (`src/audio/index.ts`): `load` décode les sons permanents (effets, interface, motifs, 23 Mo); musiques, ambiances et train se décodent à la demande sous le plafond de 128 Mo (libération des moins récemment servis, jamais d'un son en lecture). Boucles par `AudioBufferSourceNode` avec `loopStart` et `loopEnd`. Bus du SDK: musique, effets (ambiance en sous-bus, passe-bas de l'intérieur), interface.
- Musique par moment: écran titre, petit-déjeuner (après le coq et l'air du réveil, à 3,5 s), thème du matin jusqu'à 13 h puis de l'après-midi (passage à la même position, ou pendant un repos), repos de 40 à 80 s après une boucle, samedi près du quai et sur la place quand le train est à quai, veillée, nuit (2,5 s après le coucher), fanfare et air de fin une fois. Musique atténuée sous le sifflet, les motifs, les airs du carnet, la proposition d'achat.
- Ambiances par heure (oiseaux, grillons, bourg selon la distance à la place, vent selon la lisière, rivière en cinq sources placées dont le gué), pluie du jour 4 dehors ou sur le toit, passe-bas et -10 dB dans la maisonnette; pour chaque joueur selon son personnage.
- Effets: tous les événements de la simulation, placés quand `sons.json` le dit (le sien et celui de l'autre, à -3 dB), variantes sans répétition, hauteur et niveau tirés par un aléa à graine, 24 voix au plus par priorités; pas selon le sol et au rythme de l'animation; motif de l'habitant à l'ouverture d'un dialogue; repère (`ping-self`, `ping-peer`).
- Train: séquences d'arrivée et de départ calées sur la simulation (le jet de vapeur tombe au pas où le train s'arrête, le départ au pas où il s'ébranle à 16 h), sifflet lointain hors de 40 m du quai, locomotive au ralenti à quai, approche et départ recalés si l'horloge s'arrête.
- Pause de la plateforme: musique à -12 dB, effets et interface coupés, séquences figées.
- Vérifié: 64 tests Vitest (dont toute la démo jouée par le robot); banc Chromium (`src/audio/banc/`): raccord de boucle exact, séquences du train, réveil, coucher, pluie, intérieur et pause mesurés, mémoire au plus 112 Mo, 0,06 ms de calcul par image en moyenne; vrai jeu dans les deux vues du faux hôte, sans erreur.

## Écarts et questions signalés (dev gameplay)

- Réglé par le game designer (commit `0c7d610`): « Premières pousses » compte les semis et arrosages depuis le début de la partie; l'énigme d'Émile demande le jour 3 au moins. Robots relancés: démo finie, commande complète, clé trouvée au plus tôt le jour 3.
- Repas pris ensemble: le code ne demande pas « le même plat » (README des données): les deux mangent le soir à moins de `ranges.eatTogether`; le souper partagé (Cœur +5, `ate_together:table`) demande en plus une table à côté, comme dans `demo.md`.
- Réglages absents de `reglages.json`, avec une valeur par défaut dans `src/donnees/defauts.ts` (une clé `feel` dans `reglages.json` les remplace): durées des gestes, glissement du train (6 s), vitesse des habitants (1,6 m/s) et des poules, fenêtre de « Déjà pris » (1,5 s), `ranges.eatTogether` et `ranges.stayAt` (3 m).
- Pas faits (P1 de `demo.md`): regard du métier, coin à soi. Pas d'écran « Qui joue qui ? »: un identifiant inconnu prend le personnage libre.
- Fait (game designer): pêche confirmée, la canne est donnée à chacun au début; poids des poissons 6, 3, 2, fixés par `reglages.json` (`feel.fishWeights`), qui remplace le 6, 3, 1 de `src/donnees/defauts.ts`; texte `fish_escaped` (« Il s'est échappé. ») dans `textes.json`. Textes de refus de pose `placement_outside`, `placement_wall`, `placement_overlap`, `placement_occupied` dans `textes.json`.
- Absence: la nuance « à endurance nulle, seules les actions gratuites restent possibles » (PA-04) n'est pas appliquée.
- `public/vignette.png` est une vignette provisoire (dégradé et titre): à remplacer par le directeur artistique.

## 2026-10-31, étape 3: réseau, SDK, sauvegardes, point d'entrée

- SDK branché: `src/main.ts` (`connect`, boucle à 30 pas par seconde, entrées par les actions du manifeste), `duo-game.json` (validé par `parseManifest`, `play: session`, 26 actions, sauvegarde `auto` toutes les 5 minutes, `exit` et `manual`), `index.html`, `vite.config.ts` (`base: './'`). L'ancien relais par Vite est retiré.
- Réseau (`src/reseau/`): l'hôte fait autorité; l'invité envoie commandes et intentions (canal 0, fiable), reçoit l'état complet quand il change (canal 1, au plus 5 par seconde), les positions à chaque pas (canal 2) et les événements (canal 3, fiable); interpolation des autres (133 ms de retard) et prédiction de son propre déplacement, corrigée en douceur. Tous les messages ont un schéma Valibot (`schemas.ts`).
- Séance (`src/session.ts`): hôte ou invité derrière la même `GameView`; sauvegarde à l'aube et aux étapes de quête (`manual`), toutes les 5 minutes et en quittant (SDK); fin de séance par `results.endSession` (fin de la démo, ou « Finir la séance » des deux à l'écran de nuit) avec les trois chiffres de l'écran de fin.
- Sauvegarde (`src/sauvegarde/`): état complet en JSON, contrôlé à la relecture, personnages liés à l'identifiant stable du joueur (reprise quelle que soit la machine qui héberge; un identifiant inconnu prend le personnage libre), scène en cours reprise à son début.
- Entrées (`src/entrees/commandes.ts`): Z Q S D tournés selon `cameraYaw()`, clic gauche (aller et agir, via `renderer.pick`), Espace, X ou clic droit, molette (outil, ou meuble en main), T (tourner le meuble), A et E, R et F (caméra), 1 à 0 (barre de 10 cases), Tab, Retour arrière et Entrée passés à l'interface.
- Interface de secours (`src/plateforme/interface-secours.ts`), utilisée seulement si `src/interface/index.ts` n'exporte pas `createInterface`.
- Son: `main.ts` monte `src/audio/index.ts` (`createAudio`, contrat `CreateAudio` de `etat/vue.ts`) dès qu'il existe. Flux d'événements décrit dans `src/README.md`, section « Événements ».
- Vérifié: démo servie par `pnpm --filter @duo/sdk-dev servir la-petite-ligne`, deux vues locales dans Chromium, création des personnages et scène d'arrivée jouée en même temps sur les deux écrans (captures examinées). Le rendu logiciel de l'environnement cloud est trop lent pour une partie complète dans le navigateur: la partie complète est prouvée par les robots (Node).

## Réponses du rendu aux demandes de l'interface (8 et 9)

8. Fait (`src/entrees/commandes.ts`): pour A et E (`camera-left`, `camera-right`), `ui.handleKey('KeyQ')` ou `ui.handleKey('KeyE')` d'abord; la caméra ne tourne que si la réponse est `false`. Test: `src/rendu/orientation.test.ts` (A et E tournent la caméra, sauf quand l'interface les prend).
9. Fait: champ facultatif `camera?: (command: CameraCommand) => void` dans `InterfaceOptions` (`src/etat/vue.ts`, type `CameraCommand` partagé avec `Renderer.camera`), rempli par `src/main.ts` (`camera: (command) => r.camera(command)`). **À faire côté interface: retirer le palliatif qui simule la touche** (`src/interface/interface.ts`, méthode `camera`, branche de secours), qui ne sert plus.
- Défaut signalé par la QA (S puis Q vers le nord au 4e passage): la correspondance entre Z Q S D et `cameraYaw()` est juste dans les quatre orientations (test `orientation.test.ts`: Z en haut de l'écran, S en bas, Q à gauche, D à droite; S et Q mènent au sud au départ). La cause est donc une rotation parasite de la caméra pendant la séquence. Deux pistes: A ou E pendant un panneau (corrigé par la demande 8), ou Espace qui active un bouton de caméra du HUD resté sous le focus après un clic sur le HUD (à vérifier par l'interface et la QA).

## Réponses du dev gameplay aux demandes de l'interface

1. Fait: `TOOLBAR_SLOTS = 10` et `BAG_SLOTS = 24`, exportés par `src/etat/types.ts`; `selected` va de 0 à 9; manifeste: touches 1 à 0.
2. Noté (polices dans le paquet).
3. Fait (lu dans `adaptateur.ts`): synchronisation de l'écran titre. `Character.titleReady` et l'intention `{ type: 'title_ready', ready }`. Pas de phase `title` dans la simulation (le monde neuf reste en `creation`, l'écran titre est tenu par l'interface): `titleSync().inTitlePhase` reste faux. `titleReady` repasse à faux à chaque reprise de partie (sauvegarde relue), pour repasser l'écran titre à deux.
4. Fait: « Continuer » de l'écran de fin. `Character.endReady` et `{ type: 'end_ready', ready }` (acceptée en phase `ended`). Changement de comportement: la séance ne se clôt plus d'elle-même à la fin de la démo; elle se clôt (`results.endSession`) quand les deux ont choisi « Continuer », comme pour « Finir la séance » à l'écran de nuit. La sauvegarde, elle, est écrite dès la fin de la démo.
5. Fait: `PlacementPreview.blocked`, texte prêt à afficher, pris dans `textes.json` sous les clés `placement_outside` (hors de la pièce), `placement_wall` (doit toucher un mur), `placement_overlap` (un autre meuble est là), `placement_occupied` (quelqu'un se tient là). Ces quatre textes n'existent pas encore: `blocked` vaut `null` tant que le game designer ne les a pas ajoutés (demande à lui transmettre).
6. Fait: `GameNotification.key`, clé du message de `textes.json` (`already_taken`, `quest_started`, `letter_received`...), identifiant de l'astuce pour une astuce, `quest_done` pour le texte de fin d'une quête, `null` pour un texte composé (matériaux manquants).
7. À venir avec l'absence (P1): `ClockStop` `absence` existe déjà dans le type.

## 2026-10-31, étape 2: simulation jouable de bout en bout

- `src/simulation/`: horloge (journée, veillée, nuit, petit-déjeuner, minuit), déplacements et collisions, potager, bois, poules, poutre à deux, construction guidée, aménagement, économie (bourse, épicerie, catalogue, gros achats à deux, caisse et commande), habitants et emplois du temps, dialogues et scènes à deux, quêtes, envies, courrier, astuces, fin de la démo. Tout est piloté par `donnees/*.json`.
- Carte: `donnees/cartes/halte.json` lue par `src/donnees/carte-niveau.ts` (contrôlée à l'exécution); la carte de secours ne sert plus qu'en cas de fichier illisible.
- Robot: `src/simulation/robot.ts` joue toute la démo à deux sur la vraie carte: commande 4 lignes sur 4 (540 sous), clé de la remise trouvée, 0,04 ms par pas.

## Réponses du dev gameplay aux demandes du rendu

1. `cameraYaw()`: convention adoptée telle quelle par `src/entrees/` (Z vers `(cos yaw, sin yaw)`, D vers `(cos(yaw + PI/2), sin(yaw + PI/2))`).
2. Fait: `MapProp.height` (mètres, 0 si inconnue) et `MapProp.category` (`decor` si inconnue), lus dans `types` de la carte. Attention: `src/rendu/demo/carte-demo.ts` doit ajouter ces deux champs (erreur de typage tant que ce n'est pas fait), ou lire la vraie carte avec `loadMap(MAP_FILES)` de `src/donnees/carte.ts`.
3. Confirmé: `map.trees` ne contient que les 12 arbres `coupable` de la lisière; les autres arbres sont dans `map.props`.
4. Confirmé: rotation des meubles et des objets selon la convention de la carte (0 face au sud, 1 à l'est, 2 au nord, 3 à l'ouest); commentaire de `types.ts` corrigé.
5. Pas encore fait (facultatif).

## 2026-10-30, étape 1: contrats publiés

- `src/README.md`: modules, propriétaires, flux des données, contrats du rendu et de l'interface.
- `src/etat/types.ts` (état du monde), `src/etat/actions.ts` (intentions), `src/etat/carte.ts` (carte statique), `src/etat/vue.ts` (`GameView`, `createRenderer`, `createInterface`), `src/donnees/types.ts` (contenu).
- En attente: `packages/sdk` (pas encore là: adaptateur local dans `src/plateforme/`), `donnees/cartes/` (carte de secours d'après `demo.md` en attendant).
