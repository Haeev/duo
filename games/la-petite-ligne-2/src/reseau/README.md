# Réseau (lot L1)

ADR 0007, 0019 et 0020. `canaux.ts` (L0): canaux, schémas des messages, budgets de taille. `tranches.ts`: de l'état aux messages. `hote.ts` et `invite.ts`: version du socle, sans coussin de gigue, interpolation ni prédiction.

À écrire par L1: file des commandes de l'invité (reprise de l'ancien `hote.ts`), interpolation et prédiction du déplacement, prédiction du début de geste, vidage au changement de lieu, banc de gigue. Un message hors budget n'est jamais envoyé ni fatal: il est journalisé.
