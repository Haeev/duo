# Gauntlet, tour 2: pilier 1, ressenti des commandes (revue adverse, épreuve G6)

| Champ | Valeur |
|---|---|
| Relecteur | dev-gameplay-2d, auteur de la revue du tour 1 (`tour-01-ressenti.md`), sans part aux corrections |
| Date | 2026-10-31, de 10 h 25 à 10 h 45 UTC |
| Version relue | arbre principal à `4029680`, sans aucune modification du code ni des données du jeu |
| Méthode | mêmes tests jetables qu'au tour 1 (`/tmp/lpl-feel/`, adaptés: action `click` dans `tape.test.ts`), plus `memoire.test.ts` (fenêtre de l'appui mémorisé); lecture de `src/rendu/personnages.ts` (`gestureRequest`, `gestureOver`), `src/reseau/invite.ts`, `src/simulation/intentions.ts`, `grille.ts`; tests du dépôt `tests/ressenti.test.ts` et `tests/invite-fluidite.test.ts` (12 sur 12 verts); même capture Chromium qu'au tour 1 (page `src/interface/demo/index.html?scenario=hud&autre=fige`, Vite sur le port 5302) |

## 1. Verdict: mieux qu'avant. Note: 7 sur 10 (4,5 au tour 1)

Les cinq défauts du tour 1 sont corrigés et la correction se mesure. Le geste ne tourne plus en boucle: il se joue une fois, avec le coup calé sur l'appui. Chez l'invité, la marche est fluide et les pas s'entendent. Les appuis faits pendant un geste sont gardés, la tape de pavé tactile mène où l'on clique, et les coins ne bloquent plus.

La note s'arrête à 7, pas à 8. Un joueur attentif remarque encore trois choses: le démarrage et l'arrêt secs, le clic de l'invité qui part tard puis recule de quelques centimètres, et certains gestes trop accélérés. Repères inchangés: 5 = fonctionne mais nu; 8 = un joueur ne remarque aucun manque.

## 2. Remesure, avant et après

| Mesure | Tour 1 | Tour 2 | Verdict |
|---|---|---|---|
| Action après un geste de bêche (15 pas) | `till` 40 pas après, houe en boucle | `idle` dès le pas 15 (`sortie-marteau.txt`: `15: kind=idle`) | corrigé |
| Capture 12 à 25 s après un clic « aller bêcher » | houe en mouvement, personnage immobile | personnage au repos, debout, sur la case bêchée (`captures/tour-02/ressenti-houe-finie.png`, comparer à `captures/tour-01-ressenti-houe-en-boucle.png`); console sans erreur | corrigé |
| Contact du geste après l'appui | phase quelconque d'un clip 2 à 3 fois trop long | houe: départ à 0,44 s du clip, accéléré de 1,12, contact à 80 ms (`gestureImpactLead`), fin avec le geste | corrigé |
| Espace ou clic à portée pendant un geste | perdu | gardé jusqu'à 9 pas (0,3 s) avant la fin, joué au pas 16 (le premier libre); perdu à 10 pas ou plus | corrigé, fenêtre courte |
| Espace tenu en longeant la rangée d'herbe | 0 case de plus | 3 cases de plus en 3 m | corrigé |
| Tape de pavé tactile (appui et relâchement entre deux pas) | `act` | `move_to` | corrigé |
| Coin d'un bloc isolé, chevauchement de 0,05 à 0,28 m | bloqué net | passe dans les quatre cas | corrigé |
| Passage d'une case, décalage de 0 à 0,35 m | bloqué dès 0,25 m | passe dans les quatre cas | corrigé |
| Diagonale droit sur un coin convexe | arrêt en (6,17; 6,25) | contourne, (4,11; 5,56) après 1 s | corrigé |
| Invité, déplacement affiché par image à 60 i/s | `0 117 0 117 ...` mm | `58 58 58 ...` mm | corrigé |
| Invité, vitesse affichée par image | `3,5 0 3,5 0 ...` | 3,5 à chaque image (le motif qui donne 8 pas en 2 s chez l'hôte; 8 sur 8 dans `invite-fluidite.test.ts`) | corrigé |
| Invité à l'arrêt: clip joué | `walk` à vitesse nulle, 80 pas | l'état dit encore `walk` 80 pas, mais le rendu choisit `idle` dès que la vitesse tombe (`personnages.ts`, branche `kind === 'walk' \|\| gestureOver`) | corrigé (par lecture du code) |
| Espace sans cible, houe en main | rien | bêche libre (`dig`) | répond |
| Accélération et arrêt au clavier | 3,5 m/s au premier pas, 0 au premier relâchement | identique; fondus marche et attente passés de 0,22 à 0,1 s | inchangé, mieux habillé |
| Invité, clic au sol | premier vrai mouvement au pas 5, sursaut de 3 cm | mouvement dès le pas 3, mais recul de 5 cm au pas 6 (trace: `0,00 0,00 0,03 0,09 0,16 0,11 0,23 ...` m) | plus tôt, à-coup visible |
| Invité, Espace vers événement et geste visibles | 2 pas (67 ms) sans latence réseau | 3 pas (100 ms) sans latence réseau | un pas de plus |

## 3. Ce qui reste pour atteindre 8, par priorité

### 3.1 Clic de l'invité: départ tardif et recul

- **Constat**: le trajet au clic n'est pas prédit. Le personnage de l'invité part sur une prédiction partielle, puis se recale en arrière de 5 cm quand le trajet de l'hôte arrive. Le son du clic et le repère de destination dépendent de `destination` dans l'état complet, soit 67 à 270 ms plus tard. L'invité clique souvent: c'est le défaut restant le plus visible pour la moitié des joueurs.
- **Correction**: côté invité (`invite.ts`), prédire le suivi du trajet avec `findPath` et le même code de suivi que `moveCharacter` (déterministe, cartes et obstacles identiques), ou à défaut ne rien afficher avant l'hôte plutôt qu'un départ suivi d'un recul. Jouer le son et le repère au clic, en local (`commandes.ts` ou la vue de l'invité).
- **Effort**: 60 minutes. **Gain**: +0,5.

### 3.2 Démarrage et arrêt secs

- **Constat**: vitesse pleine au premier pas, nulle au premier relâchement, demi-tour sans inertie. Les fondus de 0,1 s masquent le glissement des pieds, mais le corps reste sans élan ni poids: c'est l'écart le plus net avec les références.
- **Correction**: `feel.walkAccelSeconds` (environ 0,08) et `feel.walkDecelSeconds` (environ 0,06) dans `walkStep`, avec la vitesse courante dans l'état et dans la prédiction de l'invité (le même code sert aux deux). Ajouter une légère inclinaison dans les virages et au départ dans `personnages.ts`.
- **Effort**: 60 minutes, robots et prédiction compris. **Gain**: +0,5.

### 3.3 Gestes trop accélérés et sans élan

- **Constat**: sans valeur dans `gestureImpact`, arrosage et remplissage partent du début et sont joués trois fois plus vite (clip de 1,33 s pour 0,45 s). Le ramassage emprunte la récolte à 3,9 fois sa vitesse (0,3 s). La houe démarre à 0,44 s de son clip, donc sans armer le coup: le geste est réactif mais haché.
- **Correction**:
  - ajouter les instants de contact de `water` (et du remplissage) dans `gestureImpact`;
  - demander à l'artiste 3D un clip court de ramassage;
  - côté game designer, allonger légèrement les gestes les plus courts dans `feel.actionSeconds` (semis 0,35 et ramassage 0,3 vers 0,45), pour que le coup arme sans dépasser 100 ms.
- **Non mesuré**: la vitesse perçue n'a pas été examinée image par image, car le rendu logiciel est trop lent. La mesure repose sur les durées des clips et le code.
- **Effort**: 30 minutes, plus le clip. **Gain**: +0,25.

### Plus petits

- Appui mémorisé limité à 0,3 s: un appui fait plus tôt pendant un geste reste perdu, et à endurance nulle les gestes doublent. On pourrait proportionner la fenêtre à la durée du geste, ou garder tout appui fait pendant le geste.
- Geste de l'invité visible au 3e pas (100 ms sans latence réseau, contre 67 ms au tour 1): le pas de plus vient sans doute du nouveau traitement des commandes manquantes de `hote.ts`, à vérifier par le dev réseau. Avec le Wi-Fi, on dépasse 100 ms.
- Espace mains vides sans rien devant: toujours aucun retour. Avec la houe en main, la bêche libre répond.

Total visé: 7 + 1,25 = environ 8,25, à remesurer.

## 4. Non vérifié, à tester chez le client

- Fluidité de l'invité à 60 images par seconde sur les vraies machines. Ici, elle est prouvée par les positions affichées calculées et par `invite-fluidite.test.ts`, pas à l'œil.
- Rendu `idle` de l'invité à l'arrêt: vérifié par la lecture du code et par la vitesse nulle mesurée, pas par une capture chez l'invité.
- Latence réelle du LAN ajoutée aux 100 ms des gestes de l'invité.

## 5. Reproduire

`cd /tmp/lpl-feel && /home/user/duo/games/la-petite-ligne/node_modules/.bin/vitest run --root /tmp/lpl-feel` (7 tests, plus `memoire.test.ts`); sorties dans `/tmp/lpl-feel/sortie*.txt`; capture par `node /tmp/lpl-feel/houe.cjs`, Vite servi sur le port 5302. Note: `pas-son.test.ts` rejoue le motif synthétique du tour 1 (toujours 0 pas). La preuve du tour 2 est la vitesse régulière mesurée chez l'invité et les 8 pas de `invite-fluidite.test.ts`.
