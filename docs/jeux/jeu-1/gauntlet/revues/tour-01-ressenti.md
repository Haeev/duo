# Gauntlet, tour 1: pilier 1, ressenti des commandes

| Champ | Valeur |
|---|---|
| Relecteur | dev-gameplay-2d (regard neuf: n'a écrit ni la simulation, ni le réseau, ni le rendu du jeu) |
| Date | 2026-10-31, de 08 h 57 à 09 h 40 UTC |
| Version relue | arbre de travail à `b2431e8`, sans aucune modification du code ni des données du jeu |
| Méthode | lecture de `src/entrees/commandes.ts`, `src/simulation/` (`deplacement.ts`, `grille.ts`, `intentions.ts`, `agir.ts`, `construction.ts`, `pas.ts`), `src/reseau/invite.ts`, `src/session.ts`, `src/rendu/personnages.ts`, `src/rendu/reglages.ts`, `src/audio/declencheurs.ts`, du SDK (`packages/sdk/src/input.ts`, `input-state.ts`) et des durées des clips de `assets/modeles/personnages.glb`; mesures par tests Vitest jetables hors du dépôt (`/tmp/lpl-feel/*.test.ts`: vraie carte, vrai contenu, graine 5; hôte et invité reliés par `startLocalDuo`, rendu simulé à 60 images par seconde); captures Chromium de la page `src/interface/demo/index.html?scenario=hud&autre=fige` servie par Vite sur le port 5302 |

## 1. Note: 4,5 sur 10

Les fondations sont bonnes: chez l'hôte, un appui produit l'événement, le son et les particules dans le pas même où il est lu (17 à 50 ms), le déplacement est interpolé, le corps tourne en douceur, on glisse le long des murs droits, le clic mène et agit, l'invité prédit sa marche. On n'est donc pas dans le provisoire.

La note reste sous 5 parce que trois défauts se voient ou s'entendent dès la première minute, sans chercher:

1. **Chaque geste d'outil tourne en boucle après la fin**: bêcher, semer, arroser, récolter, couper, ramasser. Le personnage continue de bêcher dans le vide tant que le joueur ne bouge pas (capture à 13 s du clic). Le geste part aussi d'un point quelconque du clip, deux à trois fois plus long que l'action: le coup ne tombe pas avec le son et la terre.
2. **Chez l'invité, son propre personnage avance par saccades** (11,7 cm une image sur deux à 60 images par seconde) **et ses propres pas sont muets** (0 pas entendu en 2 s, contre 8 chez l'hôte). C'est la moitié des joueurs, toute la partie.
3. **Des appuis perdus**: Espace ou un clic proche pendant un geste ne font rien, sans mémoire; une tape de pavé tactile agit devant soi au lieu d'y aller.

Repères: 5 = fonctionne mais nu; 8 = un joueur ne remarque aucun manque. Les trois points ci-dessus sont remarqués par tout joueur; une fois corrigés avec les deux suivants, le pilier peut viser 8 (gains estimés en section 4).

## 2. Mesures

| Mesure | Résultat | Verdict |
|---|---|---|
| Hôte: appui sur Espace vers événement, action et particules | même pas que la lecture de l'appui (`tilled` et `action.kind = 'till'` au pas de l'intention); attente du pas 0 à 33 ms, plus une image: 17 à 50 ms | au niveau |
| Invité: Espace vers événement reçu et action visible | 2 pas (67 ms) sans latence réseau, plus l'aller-retour du LAN | limite, acceptable sur un bon réseau |
| Invité: clic au sol vers premier mouvement affiché | 5 pas (167 ms) sans latence réseau, précédé d'un sursaut de 3 cm et retour (trace par pas: `0.00, 0.03, 0.00, 0.00, 0.11, 0.23, ...` m) | trop lent |
| Accélération et arrêt (clavier) | 3,50 m/s dès le premier pas appuyé, 0 dès le premier pas relâché | brut |
| Demi-tour | orientation à 180° et recul de 0,117 m dès le premier pas; modèle tourné avec une demi-vie de 0,06 s (90 % en 0,2 s) | correct, sans inertie |
| Glisse le long d'un mur droit | 2,47 m/s à 45° (71 % de 3,5), 3,45 m/s à 10° | au niveau |
| Coin d'un obstacle (bloc isolé, arbre) | bloqué net dès 5 cm de chevauchement du corps sur le coin (essais à 0,05, 0,1, 0,2 et 0,28 m) | manque |
| Passage d'une case (porte) | passe à 0 et 0,15 m de décalage, bloqué à 0,25 et 0,35 m | manque |
| Espace pendant un geste (1 pas avant la fin) | perdu, aucun événement dans les 40 pas suivants | manque |
| Clic à portée pendant un geste | perdu (un clic hors de portée, lui, est gardé et joué à l'arrivée) | manque |
| Espace tenu, houe en main, en longeant la rangée d'herbe du potager (4,7 m en 3 s, arrêts face aux cases) | 0 case bêchée de plus | nu |
| Espace sans rien devant | aucun événement, aucune animation, aucun son, aucune notification | touche morte |
| Action après un geste | `action.kind` reste `till` 40 pas après la fin; `hoe` joué en boucle (`LoopRepeat`) | défaut visible |
| Durées clip et geste | houe 1,0 s pour 0,5 s; semis 1,0 pour 0,35; arrosage 1,33 pour 0,45; récolte 1,2 pour 0,35 (et ramassage 0,3); hache 1,07 pour 0,6; fondu 0,22 s | désaccordés |
| Invité: déplacement affiché par image à 60 i/s | `0.000 0.117 0.000 0.117 ...`; vitesse `3.50 0.00 3.50 0.00 ...` | saccadé |
| Pas entendus en 2 s à 60 i/s | hôte 8; invité (son propre personnage) 0 | muet |
| Invité à l'arrêt | clip `walk` à vitesse nulle pendant 80 pas (2,7 s) dans un moment calme; l'hôte vu par l'invité: 84 pas | marche sur place |
| Tape de pavé tactile (appui et relâchement entre deux pas) | `act` envoyé au lieu de `move_to` | clic incohérent |

Capture: `docs/jeux/jeu-1/gauntlet/captures/tour-01-ressenti-houe-en-boucle.png` (quatre vues agrandies du personnage aux pas 350, 490, 623 et 756 après un clic « aller bêcher »: case bêchée, personnage immobile, houe en bas, à mi-course, au-dessus de la tête, en bas). Aucune erreur dans la console de la page.

## 3. Ce qui est déjà au niveau

- **Réponse chez l'hôte**: événement, son (`soundsForEvent`) et effet (`rendu/effets.ts`, `rendu/potager.ts`: terre, eau, saut au sac, hache) dans le pas de l'appui. Les appuis clavier sont mémorisés par le SDK jusqu'au pas suivant (`input-state.ts`, `pressed` vidé à `endStep`): aucune frappe courte n'est perdue.
- **Déplacement de l'hôte**: interpolation `prev` vers `pos` avec `alpha`, sol lissé, rotation lissée (`turnHalfLife` 0,06 s), vitesse de l'animation de marche calée sur la vitesse réelle (`walkScale`), donc ralentie quand on glisse contre un mur.
- **Z Q S D selon la caméra**, normalisé en diagonale, qui suit la rotation animée de la caméra; caméra qui suit avec anticipation (`lookAhead`).
- **Glisse le long des murs droits** (axe par axe, sans allocation, même code chez l'hôte et dans la prédiction).
- **Clic pour marcher et agir**: A* à 8 voisins sans couper les coins, chemin tendu (`simplifyPath`), point bloqué remplacé par la case libre la plus proche, action à l'arrivée, son de clic et repère de destination, « Déjà pris » au clic comme à la touche.
- **Case visée lisible** (cadre au sol, capture) et priorités de visée réfléchies (potager avant chantier, chantier seulement dans le regard).
- **Prédiction chez l'invité** avec rejeu des commandes non confirmées et correction amortie; les gestes de l'invité reviennent en 2 pas.

## 4. Les cinq défauts les plus sensibles, par impact

### 4.1 Les gestes tournent en boucle et ne tombent pas avec le son (tous les joueurs, chaque geste)

- **Constat**: après un geste d'outil, la simulation laisse `action.kind` sur le geste (seuls la marche, le marteau et quelques cas repassent à `idle`); le rendu joue `CLIP_FOR_ACTION[kind]` en boucle (`LoopRepeat`). Le personnage continue de bêcher, semer ou arroser dans le vide jusqu'à son prochain pas. En plus, le clip démarre à `phase * duration` (décalage propre au personnage, pensé pour les boucles de marche), avec un fondu de 0,22 s, et dure deux à trois fois le geste: le coup de houe tombe n'importe quand, pas avec la terre et le son émis au pas de l'appui. Deux gestes de suite du même type ne relancent pas le clip (même nom, pas de jeton).
- **Preuve**: test jetable, `action.kind = till` 40 pas après la fin d'un geste de 15 pas; capture `tour-01-ressenti-houe-en-boucle.png` (houe en boucle 13 s après); durées lues dans le GLB (tableau de la section 2); code: `src/rendu/personnages.ts`, `play()` (`action.time = ... this.phase * clip.duration`) et `update()` (`CLIP_FOR_ACTION[kind]`, `timeScale: 1`).
- **Correction**:
  1. `src/simulation/pas.ts` (fin du pas) ou `deplacement.ts` (`updateInside`): tout personnage dont le geste est fini (`action.duration > 0 && tick >= since + duration`) repasse à `idle`. Même effet chez l'invité, qui reçoit l'état. Relancer les robots et les tests d'empreinte.
  2. `src/rendu/personnages.ts`: pour une action à durée (`character.action.duration > 0`), demander `{ once: true, fromStart: true, token: character.action.since, timeScale: clip.duration / (action.duration / SIM_HZ), fade: 0.06 }`. Le geste part de sa première pose, finit avec l'action, et se relance à chaque nouveau geste.
  3. Accorder le coup et l'effet: une petite table `gestureImpact` dans `src/rendu/reglages.ts` (instant du contact dans chaque clip, à faire confirmer par l'artiste 3D), et démarrer le clip à `impact - 0,08 s` pour que le contact tombe moins de 100 ms après l'appui, au moment du son et des particules. Le ramassage (0,3 s) emprunte le clip de récolte de 1,2 s: un clip court est à demander à l'artiste 3D.
- **Effort**: 75 minutes, tests compris.
- **Gain attendu**: +1.

### 4.2 Invité: son propre personnage saccadé à 60 images par seconde, et ses pas muets

- **Constat**: la position prédite n'avance qu'au pas (30 par seconde) et `render()` l'affiche telle quelle, avec `prev = pos` et `alpha() = 1` chez l'invité (`session.ts`). Sur un écran à 60 Hz, le personnage saute de 11,7 cm une image sur deux, devant une caméra qui, elle, suit en douceur: saccade visible en permanence. La vitesse affichée est recalculée par image (`moved / dtSeconds`) et vaut 3,5 puis 0 en alternance; or `StateWatcher` remet la phase des pas à `firstStepPhase` (0,6) dès qu'une image passe sous le seuil, donc la phase n'atteint jamais 1: l'invité n'entend jamais ses propres pas.
- **Preuve**: rendu simulé à 60 images par seconde, déplacement affiché `0.000 0.117 0.000 0.117 ...`, vitesse `3.50 0.00 3.50 0.00 ...`; `StateWatcher` alimenté avec ce motif: 0 pas en 2 s, contre 8 avec une vitesse régulière.
- **Correction**: `src/reseau/invite.ts`: garder `predictedPrev`, copié au début de `step()` avant `walkStep`; décaler `predictedPrev` du même écart que `predicted` lors du rejeu d'un instantané; dans `render(nowMs, alpha)`, afficher `predictedPrev + (predicted - predictedPrev) * alpha + correction`, avec `alpha` transmis par `session.beforeFrame(loopAlpha)`; vitesse prise sur le pas (`|predicted - predictedPrev| / SIM_DT`), plus par image. Filet de sécurité dans `src/audio/declencheurs.ts`: ne remettre la phase des pas à zéro qu'après 0,1 s sous le seuil. Test: à 60 images par seconde, écarts réguliers à 10 % près et 8 pas en 2 s chez l'invité.
- **Effort**: 60 minutes.
- **Gain attendu**: +1.

### 4.3 Appuis perdus: pas de mémoire pendant un geste, tape de pavé tactile mal lue

- **Constat**: une intention `act`, ou `move_to` à portée, reçue pendant un geste est jetée (`canAct` faux, `intentions.ts`). Les gestes durent 0,3 à 0,8 s, le double à endurance nulle: enchaîner bêcher puis semer demande d'attendre la fin exacte, sinon la touche est morte. Espace tenu ne répète rien. Côté souris, `commandes.ts` lit le front du bouton sur `pointer.left` au moment du pas; une tape de pavé tactile (appui et relâchement dans les 33 ms d'un pas) n'y est plus, mais l'action `act` du manifeste, liée aussi au clic gauche, est mémorisée: le jeu envoie `act` (agir devant soi) au lieu de `move_to` (aller là). L'hypothèse d'un portable pour le PC rend ce cas plausible.
- **Preuve**: tests jetables: Espace 1 pas avant la fin du geste, aucun événement dans les 40 pas suivants; clic à portée au pas 4 du geste, aucun événement; Espace tenu en longeant la rangée, 0 case de plus; `createControls` avec une fausse entrée: clic tenu au pas, `move_to`; tape entre deux pas, `act`.
- **Correction**:
  1. `src/simulation/intentions.ts` et `pas.ts`: si `act` ou `move_to` (avec `act`) arrive pendant un geste, le garder dans `runtime.bufferedAct[id]` (`{ intent, tick }`, jamais sauvegardé ni transmis) et le jouer au premier pas où `canAct` redevient vrai, s'il a moins de `feel.inputBufferSeconds` (0,3 s, nouvelle clé de `src/donnees/defauts.ts`, réglable par le game designer). Le dernier appui remplace le précédent.
  2. `duo-game.json` et `src/entrees/commandes.ts`: une action `click` liée au seul clic gauche (retirer `left` de `act`), et `leftPressed = input.wasPressed('click')`, mémorisée par le SDK. Mettre à jour `tests/manifeste.test.ts` si besoin.
  3. Proposer au game designer la répétition à touche tenue pour les outils (`feel.repeatHeldTool`), en respectant `holdForTool` de `construction.ts`.
- **Effort**: 60 minutes (20 pour le clic, 40 pour la mémoire et ses tests).
- **Gain attendu**: +0,5.

### 4.4 Invité: les personnages marchent sur place après l'arrêt

- **Constat**: chez l'invité, `action.kind` vient de l'état complet, envoyé seulement quand `revision` change (au plus tous les 6 pas) ou tous les 90 pas. Passer de la marche à l'arrêt ne change pas `revision`. Quand la vitesse tombe à zéro, le rendu prend `CLIP_FOR_ACTION['walk']` à `timeScale: 1`: le personnage marche sur place jusqu'au prochain état complet. Cela touche son propre personnage et celui de l'hôte, sur l'écran de l'invité.
- **Preuve**: tests jetables: clip `walk` à vitesse nulle pendant 80 pas (2,7 s) après le relâchement de l'invité; l'hôte vu par l'invité: vitesse nulle au pas 3, encore `walk` jusqu'au pas 84. Dans une partie animée (habitants, poules, notifications), l'état complet repart plus tôt: entre 0,2 s et 3 s selon le moment.
- **Correction**: `src/rendu/personnages.ts`, `update()`: décider de la marche par la seule vitesse (`kind === 'walk' && !moving` donne `idle`), comme pour les habitants. Ne pas forcer `runtime.changed` à chaque arrêt: la revue du pilier 8 signale déjà le poids de l'état complet.
- **Effort**: 15 minutes.
- **Gain attendu**: +0,5.

### 4.5 Accroché aux coins: aucune correction de coin

- **Constat**: `moveBody` (`src/simulation/grille.ts`) glisse axe par axe, mais quand on pousse droit contre un obstacle que le corps (rayon 0,3 m) chevauche de quelques centimètres, rien ne le décale: arrêt net. Les arbres sont des cases bloquées isolées, la porte et les passages font une case: c'est fréquent au verger, au potager et aux portes. La poutre portée à deux s'arrête net dès qu'un porteur touche, sans glisser (`updateBeam`, test « tout ou rien »).
- **Preuve**: grille de test: bloc isolé, bloqué dès 5 cm de chevauchement; passage d'une case, bloqué dès 0,25 m de décalage; diagonale droit sur un coin convexe, arrêt en (6,17; 6,25).
- **Correction**: dans `moveBody`, quand le déplacement sur un axe est refusé et que l'entrée est surtout sur cet axe, essayer des décalages perpendiculaires de 0,05 à 0,35 m; si un côté libère le passage, glisser de ce côté d'au plus la longueur du pas. Même fonction chez l'hôte et dans la prédiction, donc aucun écart. Pour la poutre, essayer x puis y quand le déplacement complet ne passe pas. Test: le bloc isolé passe jusqu'à 0,2 m de chevauchement, la porte jusqu'à 0,3 m de décalage.
- **Effort**: 45 minutes.
- **Gain attendu**: +0,5.

Total visé après ces cinq corrections: 4,5 + 3,5 = 8, à confirmer par une nouvelle mesure.

## 5. Autres constats, pour passer de 8 au niveau des références

- **Démarrage et arrêt secs**: vitesse pleine au premier pas, nulle au premier relâchement; le fondu de 0,22 s entre `idle` et `walk` fait glisser les pieds au départ et à l'arrêt. Proposition: `feel.walkAccelSeconds` (0,08) et `feel.walkDecelSeconds` (0,06) dans `walkStep`, avec la vitesse dans l'état (et dans la prédiction), fondu marche et attente à 0,1 s, légère inclinaison dans les virages. 60 minutes, +0,5.
- **Clic de l'invité sans retour immédiat**: le trajet n'est pas prédit (167 ms avant le premier mouvement sans latence réseau, sursaut de 3 cm); le son de clic et le repère dépendent de `destination` dans l'état complet (67 à 270 ms). Proposition: son et repère joués localement au clic (`commandes.ts` ou la vue de l'invité), puis prédiction du trajet avec `findPath`, déterministe et partagé. 45 minutes, +0,25.
- **Espace dans le vide**: rien du tout. Proposition: un petit geste local (regard, haussement d'épaules ou outil levé) et un son doux, sans passer par la simulation. 30 minutes, +0,25.

## 6. Non vérifié, à tester chez le client

- Fluidité réelle à 60 images par seconde et saccade de l'invité sur les vraies machines (le rendu logiciel d'ici est trop lent pour la voir en Chromium; elle est prouvée par le calcul des positions affichées).
- Latence réelle du LAN (Wi-Fi) ajoutée aux 67 ms des gestes de l'invité.
- Fréquence des tapes de pavé tactile sur le PC (si la souris est une vraie souris, le défaut 4.3, point 2, reste rare).

## 7. Reproduire

Scripts hors du dépôt: `/tmp/lpl-feel/mesures.test.ts` (hôte, collisions, invité), `pas-son.test.ts` (pas entendus), `clic.test.ts` (appuis pendant un geste), `marteau.test.ts` (Espace tenu), `tape.test.ts` (tape de pavé tactile), `houe.cjs` (captures Chromium). Lancement: `cd /tmp/lpl-feel && /home/user/duo/games/la-petite-ligne/node_modules/.bin/vitest run --root /tmp/lpl-feel` (dossier `node_modules` relié à celui du jeu); sorties dans `/tmp/lpl-feel/sortie*.txt`.
