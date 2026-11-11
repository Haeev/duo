# Réseau (lot L1)

ADR 0007, 0019 et 0020. L'hôte fait autorité; l'invité affiche les autres derrière un coussin de gigue et prédit son propre déplacement et le début de ses gestes.

| Fichier             | Rôle                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `canaux.ts` (L0)    | canaux, schémas des messages, budgets de taille                                                                                      |
| `tranches.ts`       | de l'état aux messages                                                                                                               |
| `hote.ts`           | pas, envois par tranche (« joueurs » au pas même, « lieu » tous les 6 pas, progression tous les 15), bascule de lieu, reprise        |
| `par-cles.ts`       | état envoyé par différences et par morceaux, une clé par entité, sans rien connaître du contenu (M3)                                 |
| `etat-lieu.ts`      | l'état lent du lieu par `par-cles.ts`, sur le canal fiable 5 (morceaux de 16 Kio au plus)                                            |
| `file-commandes.ts` | file des commandes de l'invité chez l'hôte: coussin, rattrapage, commande devinée (2 au plus)                                        |
| `progression.ts`    | progression par différences et par morceaux, sur le canal fiable 8 (proposé à L0)                                                    |
| `invite.ts`         | état reçu (`world()`), état à afficher (`render(now, alpha)`), geste prédit, bascule, reprise                                        |
| `interpolation.ts`  | coussin de gigue (95e centile du retard observé, 2 à 10 pas) et interpolation                                                        |
| `prediction.ts`     | contrat `Predictor` que fournit la simulation, prédiction du déplacement et réconciliation                                           |
| `reglages.ts`       | valeurs du réseau                                                                                                                    |
| `compatibilite.ts`  | carte d'identité échangée sur le canal 9 (version, protocole, empreinte des schémas et de la fabrication); un écart arrête la partie |
| `garde.ts`          | validation des messages reçus par le jeu: chaque refus est compté, journalisé (le premier par canal) et signalé une fois au joueur   |

Compatibilité (ADR 0006, MA2 de la revue du 2026-11-11): le schéma de la carte et le canal 9 ne changent jamais. Pour un changement incompatible que les schémas ne voient pas (sens d'un champ, ordre des habitants du canal rapide), incrémenter `NET_PROTOCOL`. Un pair muet au bout de `COMPAT_WAIT_STEPS` pas (3 s) a un jeu d'avant la vérification: il est désigné comme le plus ancien. L'hôte peut jouer un aller-retour de pas avant la réponse, puis s'arrête; l'invité ne se déclare pas prêt.

## Ce que la simulation (L2) branche

- `Predictor` (`prediction.ts`): `canWalk`, `walk`, `gesture`, fonctions pures qui ne lisent que l'état connu de l'invité. L'hôte appelle les mêmes dans son pas. Passé à `createGuest(content, net, member, { predictor })`.
- `session.ts`: `host.resume()` et `guest.resume()` sur l'événement `resume` de la plateforme; le rendu de l'invité lit `guest.render(now, alpha)` (même horloge que l'option `now`), pas `world()`.
- Voyage: `onPlaceSwitch` des deux côtés au pas du changement de `common.place`; la machine charge le lieu puis envoie l'intention `place_loaded`.

## État lent du lieu: par différences et par morceaux (mission M3)

L'état lent du lieu courant (`PlaceSlow`: meubles, sol, meubles posés, habitants, commerces...) ne part plus en tranche entière sur le canal 6, désormais libre: au pire d'Aubrune il pèse 68 Ko. Il part sur le canal 5, fiable, en révisions:

- **Complète** (`base: -1`) au départ, à la reprise de la liaison, au changement de lieu, quand une liste a changé d'ordre, quand la différence pèse plus de la moitié de l'état, et au filet de sécurité (`NET_SETTINGS.place.fullEveryTicks`, 30 s).
- **Différence** sinon, au plus tous les 6 pas et seulement si `revisions.place` a changé: seules les entités modifiées, ajoutées ou retirées partent.
- Chaque révision est découpée en morceaux d'environ 12 Ko (16 Kio au plus): aucun message ne déborde, quel que soit le lieu.
- Chez l'invité, l'état n'est publié qu'une fois la révision entière reçue et validée par `PlaceSlowSchema`; un morceau en double ou une révision déjà appliquée est sans effet (idempotent), une différence orpheline attend la prochaine complète.

Mesures (`tests/etat-lieu.test.ts`): 7 morceaux de 12,2 Ko au plus pour l'état au pire d'Aubrune; une minute chargée (deux cueillettes, une vente, un objet au sol et 8 habitants qui changent chaque seconde, réassort des 400 meubles à la 30e seconde) coûte 5,3 Ko/s sur le canal 5. Pas de filtrage par distance pour l'état lent: le gain serait faible et il créerait des écarts à l'approche.

### Ajouter de l'état par lieu à un nouveau système (règle des gabarits, côté réseau)

Rien à coder dans le réseau. Le système:

1. déclare son champ dans `placeSlow` de `src/etat/lieu.ts`, en `v.exactOptional(...)` (les sauvegardes et les lieux existants restent valides);
2. l'écrit dans l'état du lieu et appelle `touch` (ou `revisions.place += 1`) quand il change.

`slowOfPlace` emporte tous les champs du lieu (seule la position des habitants en est retirée: elle part sur le canal rapide), et `par-cles.ts` choisit la façon de transmettre selon la forme de la valeur:

| Forme du champ                                    | Transmis                                                     |
| ------------------------------------------------- | ------------------------------------------------------------ |
| dictionnaire `Record<id, ...>` (cultures, ruches) | une entrée par clé modifiée                                  |
| tableau d'objets qui ont tous un `id`             | une entrée par `id` modifié, ordre gardé (nouveaux à la fin) |
| tout le reste (nombre, texte, tableau sans `id`)  | la valeur entière quand elle change                          |

Préférer un dictionnaire par identifiant à un grand tableau sans `id`: il part entité par entité. Une seule entité doit rester petite (un coffre plein fait 1,2 Ko). Le test « système factice » de `tests/etat-lieu.test.ts` ajoute un dictionnaire, une liste et une valeur sans une ligne de réseau.

## Débit

Une minute chargée au pire (`tests/etat-lieu.test.ts`, 80 ms, 20 ms de gigue, 2 % de pertes): 11,5 Ko/s en tout sur le lieu d'essai, dont 6 sur le canal rapide et 5,3 sur l'état du lieu. Avec les 32 habitants d'un grand lieu en marche, le canal rapide seul monte à 30,6 Ko/s (habitants au centième: cm, centièmes de radian), 36 Ko/s en tout, soit 0,3 Mbit/s, moins de 2 % d'un Wi-Fi lent. Le levier suivant, s'il faut descendre sous 30 Ko/s, est le canal rapide (habitants loin des deux joueurs envoyés moins souvent, ce qui touche `FastSchema`), pas l'état lent.

Un message hors budget n'est jamais envoyé ni fatal: il est journalisé (avertissement au-delà de 75 % du budget).

Tests: `tests/reseau-gigue.test.ts` (banc de gigue, geste prédit), `tests/reseau-envois.test.ts` (tailles au pire, progression, bascule, reprise), `tests/etat-lieu.test.ts` (état du lieu par morceaux, système factice, débit). Aides: `tests/aides-reseau.ts` (lien virtuel, prédicteur et pas factices).
