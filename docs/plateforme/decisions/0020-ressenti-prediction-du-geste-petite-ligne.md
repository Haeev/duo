# ADR 0020: Ressenti: prédiction du geste chez l'invité, mini-jeux locaux, gestes bornés

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | dev-reseau (lot L1), dev-gameplay-3d (lots L2 à L4), ux-ui-designer, sound-designer, qa-testeur |
| Jeu | `games/la-petite-ligne-2`; plan: `docs/jeux/jeu-1/refonte/technique.md`; cahier: `docs/jeux/jeu-1/refonte/cahier-des-charges.md` |
| Liens | ADR 0007 (prédiction côté client, confiance entre les deux machines), 0019; `docs/jeux/jeu-1/refonte/references-de-ressenti.md` section 3 |

## Contexte

Règles de ressenti de la refonte, prises comme exigences: une action répond à l'œil et à l'oreille en moins d'un dixième de seconde; la cible est montrée avant d'agir, jamais de zone d'action sans objet; aucune action courante ne bloque plus d'une seconde et demie; la caméra suit avec un léger retard; murs et toits s'effacent sans à-coup.

Chez l'hôte, une entrée lue au pas (33 ms au plus à 30 pas par seconde) paraît à l'image suivante: 50 à 66 ms. Chez l'invité, sans prédiction, le geste fait un aller et retour: 3 à 4 pas, soit 100 à 130 ms sur le réseau local, et jusqu'à 200 ms de plus si l'effet attend une tranche d'état cadencée. La 0.13 prédit déjà le déplacement de l'invité, pas ses gestes.

## Options

| | A. Tout attendre de l'hôte | B. Prédire le début du geste (animation, son, réaction de la cible), l'hôte confirme | C. Simuler tout le jeu chez l'invité et réconcilier |
|---|---|---|---|
| Délai chez l'invité | 100 à 330 ms | 50 à 66 ms | 50 à 66 ms |
| Risque | exigence non tenue | un geste commencé puis refusé (rare) | états divergents, retours en arrière visibles |
| Coût | nul | la visée doit être calculable chez l'invité | toute la simulation à rendre rejouable |

## Décision

1. **Option B.** L'invité calcule sa cible avec la même fonction pure que l'hôte, à partir de l'état qu'il connaît; à l'appui, il joue tout de suite l'animation, le son et la réaction de l'objet, et envoie l'intention. L'hôte répond par `gesture_started` (que l'invité ignore pour son propre personnage, déjà joué) ou par `refused` (l'invité coupe le geste et joue le refus). Les conséquences (objet gagné, jauge, quête) ne viennent que de l'hôte.
2. **La tranche `players` et les événements partent au pas même** du changement, sans cadence (ADR 0019).
3. **Menus et dialogues locaux**: ouvrir, naviguer, faire défiler le texte lettre par lettre, « tout afficher » ne passent pas par le réseau; seuls les choix partent.
4. **Mini-jeux joués sur la machine du joueur** (pêche, cuisine), à partir d'une graine donnée par l'hôte; le résultat part en intention, l'hôte en borne les valeurs. Le partenaire voit l'animation par les événements. La confiance entre les deux machines est admise (ADR 0007, point 7).
5. **Durées dans les données, bornées par le validateur**: un geste courant (brique `gather`, `repair`, ramasser, manger) dure 1,5 s au plus (`gestures.maxSeconds`); les gestes longs (toilette, sieste, repas, cuisine) sont des briques interruptibles par une direction.
6. **Cible**: toute interaction passe par une brique d'un meuble visible ou par un habitant; le format des cartes ne permet pas de poser une zone d'action seule (retours R05, R11, R17, R21 du 4 novembre).
7. **Sons du monde**: nés d'un événement de l'hôte ou de l'état, jamais d'une entrée locale (retours R03, R18, R19); les sons du geste prédit font exception pour le joueur qui agit.
8. **Caméra**: orthographique conservée (décision du client), rotation et zoom continus, suivi à demi-vie courte, coupes de murs en fondu avec hystérésis; comparaison en images avec une perspective au jalon 1. Détail au lot L4.

## Conséquences

- La visée (`aim`) doit rester une fonction pure de l'état transmis: elle ne lit rien que l'invité ignore.
- Un refus après prédiction se voit (geste coupé): cas à couvrir par le banc à deux (cible prise par l'autre joueur au même pas).
- Le banc de gigue de l'ancien jeu (80 ms de délai, 20 ms de gigue) est repris par le lot L1 et étendu: délai entre l'appui et le début du geste chez l'invité, sous 100 ms.

## À vérifier

- Délai ressenti sur les vraies machines, PC en invité (liste « à tester chez le client » du jalon 1).
- Plancher de 30 images par seconde sur le PC (décision du client): à 30 images, une image dure 33 ms et le total reste sous 100 ms.
