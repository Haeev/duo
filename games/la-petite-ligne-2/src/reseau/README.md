# Réseau (lot L1)

ADR 0007, 0019 et 0020. L'hôte fait autorité; l'invité affiche les autres derrière un coussin de gigue et prédit son propre déplacement et le début de ses gestes.

| Fichier | Rôle |
|---|---|
| `canaux.ts` (L0) | canaux, schémas des messages, budgets de taille |
| `tranches.ts` | de l'état aux messages |
| `hote.ts` | pas, envois par tranche (« joueurs » au pas même, « lieu » tous les 6 pas, progression tous les 15), bascule de lieu, reprise |
| `file-commandes.ts` | file des commandes de l'invité chez l'hôte: coussin, rattrapage, commande devinée (2 au plus) |
| `progression.ts` | progression par différences et par morceaux, sur le canal fiable 8 (proposé à L0) |
| `invite.ts` | état reçu (`world()`), état à afficher (`render(now, alpha)`), geste prédit, bascule, reprise |
| `interpolation.ts` | coussin de gigue (95e centile du retard observé, 2 à 10 pas) et interpolation |
| `prediction.ts` | contrat `Predictor` que fournit la simulation, prédiction du déplacement et réconciliation |
| `reglages.ts` | valeurs du réseau |

## Ce que la simulation (L2) branche

- `Predictor` (`prediction.ts`): `canWalk`, `walk`, `gesture`, fonctions pures qui ne lisent que l'état connu de l'invité. L'hôte appelle les mêmes dans son pas. Passé à `createGuest(content, net, member, { predictor })`.
- `session.ts`: `host.resume()` et `guest.resume()` sur l'événement `resume` de la plateforme; le rendu de l'invité lit `guest.render(now, alpha)` (même horloge que l'option `now`), pas `world()`.
- Voyage: `onPlaceSwitch` des deux côtés au pas du changement de `common.place`; la machine charge le lieu puis envoie l'intention `place_loaded`.

Un message hors budget n'est jamais envoyé ni fatal: il est journalisé (avertissement au-delà de 75 % du budget).

Tests: `tests/reseau-gigue.test.ts` (banc de gigue, geste prédit), `tests/reseau-envois.test.ts` (tailles au pire, progression, bascule, reprise). Aides: `tests/aides-reseau.ts` (lien virtuel, prédicteur et pas factices).
