# La Petite Ligne (refonte)

Nouveau paquet de jeu (`la-petite-ligne-2`, version 0.20.0), socle du lot L0. Il vit à côté de `games/la-petite-ligne` (0.13, gelé et publiable) jusqu'à l'Alpha de la refonte. Plan d'ensemble: `docs/jeux/jeu-1/refonte/technique.md`. Décisions: ADR 0017 (nouveau paquet), 0018 (lieux), 0019 (état en tranches), 0020 (ressenti), 0021 (personnages).

## Commandes

```sh
pnpm --filter @duo/la-petite-ligne-2 typecheck
pnpm --filter @duo/la-petite-ligne-2 lint
pnpm --filter @duo/la-petite-ligne-2 test          # suite rapide: un test de plus de 20 s échoue
pnpm --filter @duo/la-petite-ligne-2 test:longues  # à la demande seulement (tests/longues/)
pnpm --filter @duo/la-petite-ligne-2 nouveau meuble chaise   # crée un contenu depuis son gabarit
pnpm --filter @duo/sdk-dev servir la-petite-ligne-2 --construire   # puis http://localhost:8080/deux-vues.html
```

## Règles du paquet

1. **Ajouter du contenu ne touche jamais au moteur.** Un contenu est un fichier de `donnees/`, copié d'un gabarit (`donnees/_gabarits/`, recettes dans `donnees/README.md`). Ce que fait un meuble tient dans ses briques (`src/donnees/schemas/briques.ts`). Si un contenu demande une ligne de moteur, c'est le moteur qu'on corrige.
2. **Le moteur ne nomme aucun contenu**: ni habitant, ni lieu, ni objet dans `src/`.
3. **Les schémas Valibot sont la source unique** des types et des validateurs (`src/donnees/schemas/`, `src/etat/`).
4. **Un lot possède ses dossiers** (tableau ci-dessous) et n'édite pas ceux des autres. Les fichiers communs (`src/etat/`, `src/donnees/schemas/`, `src/reseau/canaux.ts`, `src/simulation/noyau/systemes.ts`) appartiennent à L0: un besoin de changement se demande au manager.
5. **Un système touche à une tranche lente, il appelle `touch`** (`SimContext`), sinon l'invité ne la reçoit pas.
6. **Un test court par nouveauté** (moins de 5 s, au plus 60 s de jeu simulées).

## Qui possède quoi

| Dossier | Lot | Contenu |
|---|---|---|
| `src/etat/`, `src/donnees/` | L0 | état par tranche, schémas, chargement, validateurs |
| `src/reseau/` | L1 | canaux, hôte, invité, prédiction |
| `src/simulation/noyau/`, `voyage/`, `briques/` | L2 | pas, déplacement, visée, horloge, train, registre des briques |
| `src/simulation/besoins/`, `sac/`, `dialogues/`, `regles/` | L3 | jauges, barre et sac, dialogues, conditions et effets |
| `src/rendu/` sauf `personnages/` | L4 | moteur 3D, caméra libre, lieu |
| `assets/commun/personnages/`, `donnees/commun/personnages/` | L5 | pièces et catalogue |
| `src/rendu/personnages/` | L6 | assemblage des personnages |
| `src/interface/` | L7 | fenêtre de dialogue, heure et argent, jauges, barre et sac |
| `donnees/` (hors personnages) | L8 | objets, meubles, lieux d'essai, habitants, dialogues |
| `src/audio/`, `assets/**/son/` | L9 | babil, gestes, ambiances |
| `tests/` | chaque lot pour ses tests, qa-testeur pour `tests/e2e/` | |

`src/session.ts`, `src/main.ts`, `src/actions.ts` et `src/entrees/` appartiennent à L2. `src/plateforme/ecran-socle.ts` est provisoire: il disparaît quand L4 et L7 sont branchés.

## Ce que le socle fait déjà

- Charge et contrôle toutes les données; une faute nomme son fichier et son champ.
- Crée une partie, la sauvegarde, la relit; avance l'horloge (une heure de jeu en 125 s).
- Envoie l'état de l'hôte à l'invité en quatre tranches et un canal rapide, sous budget de taille.
- Affiche un plan 2D du lieu chez les deux joueurs (banc à deux vues du SDK).

Rien d'autre: pas de déplacement, pas de geste, pas de rendu 3D. Chaque lot branche son système dans l'`index.ts` de son dossier, déjà relié.

## Reprise de l'ancien paquet

Seuls les fichiers classés « garder » ou « adapter » par l'audit (`technique.md`, section 1.2) se reprennent, en copie relue (règles 2 et 3), par le lot qui possède le dossier d'arrivée. Le socle n'en a repris aucun: ses contrats sont neufs.

| Lot | À reprendre de `games/la-petite-ligne/src/` |
|---|---|
| L1 | `reseau/hote.ts` (file des commandes, rattrapage), `reseau/invite.ts` (interpolation, prédiction) |
| L2 | `simulation/grille.ts`, `deplacement.ts`, `agir.ts` (visée), `horloge.ts`, `deblocage.ts`, `entrees/commandes.ts` |
| L3 | `simulation/sac.ts`, `conditions.ts`, `effets.ts`, `dialogues.ts` (choix à deux) |
| L4 | `rendu/moteur.ts`, `ressources.ts`, `lots.ts`, `instances.ts`, `materiaux.ts`, `lumiere.ts`, `ombre-tri.ts`, `qualite.ts`, `options-graphiques.ts`, `coupe-murs.ts`, `interieurs.ts` |
| L6 | `rendu/habillage.ts` (`mergeOutfit`), `gabarit.ts`, `foulee.ts`, `prise.ts` |
| L7 | `interface/dom.ts`, `composant.ts`, `focus.ts`, `typographie.ts`, `sons.ts`, `options.ts` |
| L9 | `audio/moteur.ts`, `espace.ts`, `voix.ts`, `musique.ts`, `memoire.ts` |
