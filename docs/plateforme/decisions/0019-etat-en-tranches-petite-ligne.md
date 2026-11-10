# ADR 0019: État en tranches sur le réseau (La Petite Ligne)

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | dev-reseau (porteur du lot L1), dev-gameplay-3d, qa-testeur |
| Jeu | `games/la-petite-ligne-2`; plan: `docs/jeux/jeu-1/refonte/technique.md`; cahier: `docs/jeux/jeu-1/refonte/cahier-des-charges.md` |
| Liens | complète l'ADR 0007 (l'hôte fait autorité, canaux `reliable` et `latest`); ADR 0018, 0020 |

## Contexte

La 0.13 envoie son état en un seul message JSON, jusqu'à 5 fois par seconde, dès qu'un champ change. Mesures du 2026-11-10: 11 117 octets au départ d'une partie, 52 201 octets d'état dans la sauvegarde de référence du jour 25. Or `NetChannel.send` du SDK lève une erreur au-delà de 64 Kio, que la boucle n'attrape pas: la partie s'arrête des deux côtés. Chez l'invité, cet état n'est contrôlé que par sa forme générale. La refonte ajoute des lieux, des collections, une mémoire des actions, des sacs plus grands et trois jauges qui bougent en continu.

## Options

| | A. Message unique, compacté | B. Différentiel (envoi des seuls champs changés) | C. Tranches par domaine, une par canal |
|---|---|---|---|
| Taille | repousse la limite sans la lever | petite | bornée par tranche |
| Message perdu ou remplacé (mode `latest`) | sans effet | état faux tant qu'un état complet n'est pas renvoyé | sans effet: chaque tranche est entière |
| Complexité | faible | forte (chemins, ordre, rattrapage) | faible: une fonction par tranche |
| Reprise de liaison, arrivée tardive | un envoi | un envoi complet à prévoir à part | un envoi par tranche |

## Décision

**Option C.**

| Canal | Contenu | Mode | Envoi | Budget (octets) |
|---|---|---|---|---|
| 0 `guestInput` | commandes et intentions de l'invité | fiable | chaque pas | 2 048 |
| 1 `common` | phase, lieu courant, jour, météo, coffre, voyage | dernier | au pas du changement | 1 024 |
| 2 `fast` | lieu, positions des joueurs et des habitants du lieu, heure, jauges des besoins, accusé | dernier | chaque pas | 3 072 |
| 3 `events` | événements du pas | fiable | au pas où ils naissent | 4 096 |
| 4 `players` | sac, barre, argent, apparence, geste, dialogue, visée, paliers des besoins | dernier | au pas du changement | 8 192 |
| 5 | libre depuis l'intégration du lot L1 (la progression part sur le canal 8) | | | |
| 6 `place` | meubles posés, état des briques, objets au sol, état discret des habitants | dernier | au changement, tous les 6 pas au plus | 32 768 |
| 7 | réservé aux activités (pêche, mini-jeu vu par le partenaire) | dernier | pendant l'activité | 4 096 |
| 8 `progressPart` | progression (mémoire, amitiés, quêtes, collections, lieux ouverts) par différences et par morceaux | fiable | au changement, tous les 15 pas au plus | 16 384 par morceau |

1. Une tranche a un compteur de révision; un système qui l'écrit appelle `touch(tranche)`. Les champs qui bougent à chaque pas (`body`, `needs`, `minutes`) vivent sur le canal rapide et ne déclenchent aucun envoi de tranche.
2. **Aucun budget ne dépasse 32 Kio**, la moitié de la limite du SDK. Les bornes des schémas d'état (200 meubles posés, 80 objets au sol, 40 cases) sont accordées aux budgets, et `tests/tailles.test.ts` le tient sur un état fabriqué « au pire ». Relevé du socle: `players` 4 338, `progress` 29 331, `place` 24 323, `fast` 184 octets.
3. **Jamais d'arrêt pour une taille**: l'hôte mesure chaque message; hors budget, il ne l'envoie pas et le journalise.
4. **Validation chez l'invité**: un schéma Valibot par tranche, strict, champ par champ. Les mêmes schémas valident la sauvegarde.
5. Sans changement, chaque tranche repart tous les 150 pas (filet de sécurité). Au départ et à la reprise: `sendAll`.

6. **Progression par morceaux** (ajout du 2026-11-10, lot L1): la progression entière approchait son budget (29 Ko pour 32 Kio); elle part en révisions sur un canal fiable, complètes ou en différences, découpées en morceaux de 16 Kio au plus (`src/reseau/progression.ts`). La borne de 32 Kio reste celle de l'état (sauvegarde, test « au pire »).

## Conséquences

- L'état est structuré par tranche dès sa définition (`src/etat/`): un champ nouveau se range dans une tranche et entre dans le test de taille.
- Un oubli de `touch` laisse l'invité avec une tranche ancienne jusqu'au filet de 5 secondes: à couvrir par un test à deux par système.
- La tranche `progress` est la plus proche de son budget (29 Ko pour 300 faits retenus, 40 suites, 8 collections): c'est la première à surveiller quand le contenu grandit; parade prête: la couper en deux canaux (mémoire, collections).
- Le plafond de 16 canaux du SDK laisse 8 canaux libres.

## À vérifier

- Coût de la mesure de taille à chaque envoi (une sérialisation de plus): à mesurer par le lot L1, à remplacer par un contrôle périodique si elle pèse.
- Comportement réel sur le Wi-Fi du client avec 30 messages rapides par seconde.
- Manque du SDK noté sans le corriger: `NetChannel.send` devrait refuser un message trop gros sans lever d'exception fatale, ou exposer la taille mesurée.
