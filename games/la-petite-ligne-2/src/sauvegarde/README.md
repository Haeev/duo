# Sauvegarde et reprise (lot L0, étendu)

L'état complet (tous les lieux) en JSON, un seul emplacement, écrit par l'hôte avec l'API du SDK (`duo.saves`).

| Fichier          | Rôle                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `sauvegarde.ts`  | `snapshotOf` (instantané + fiche du salon), `restoreWorld` (relecture complète, ne lève jamais), `summaryOf`/`labelOf` |
| `format.ts`      | `STAGE_FLOOR`, table `MIGRATIONS`, `readSave` (version, migrations, schéma)                                            |
| `reprise.ts`     | `matchMembers`/`seatMembers` (règle de l'invité différent), `settleForResume` (remise d'aplomb)                        |
| `declencheur.ts` | écriture à l'aube et à chaque arrivée en train, sur demande; hors du pas, une à la fois                                |
| `textes.ts`      | textes français de la fiche du salon et des messages de reprise                                                        |
| `seance.ts`      | avancement de l'histoire (`storyProgress`), relevé et résumé d'une séance (`tallyOf`, `sessionSummary`)                |

## Quand ça s'écrit

- Aube (`day_started`) et arrivée en train (`train_arrived`): moment `auto`, lancé après le pas (jamais dedans).
- Toutes les 300 s (`autosaveSeconds`), à chaque pause et à la fermeture: le fournisseur `saves.provide` du SDK.
- Sur demande: `session.saveNow()` (moment `manual`, hôte seulement; chez l'invité: `refused`). Le bouton ou la touche est à brancher par l'interface (L7).
- Un échec d'écriture est journalisé, jamais fatal; la plateforme garde les copies de secours précédentes (ADR 0009).

## Fiche du salon

`label` (40 caractères): `Lieu, jour N, H h MM (Prénom et Prénom)`. Si c'est trop long, les prénoms sautent, puis le nom du lieu est coupé. `progress` (0 à 1, `seance.ts`): étapes franchies sur toutes les étapes des suites principales en actes (`kind: "main"` avec `saga`: aujourd'hui l'histoire d'Aubrune); la plateforme le reprend dans l'historique et le score cumulé. `sessionSummary` résume une séance en trois nombres (jours vécus, étapes de quête franchies, entrées de collection ajoutées) depuis le relevé `tallyOf` de son ouverture; `provideSessionSummary` le remet à Duo quand la plateforme arrête la séance (SDK, `results.provideSummary`).

## Reprise

L'hôte relit, remet d'aplomb (`settleForResume`: gestes, dialogues et cible oubliés; un voyage en cours se termine, heures comprises; un départ sur le marchepied s'annule), puis envoie l'état complet à l'invité (`host.sendAll`). Les positions des habitants sont enregistrées avec le lieu.

**Invité différent** (règle proposée, à valider par le client): les deux joueurs actuels figurent dans la sauvegarde (n'importe quel rôle): rien à faire. Un seul y figure: l'autre prend la place du personnage absent (position, sac, argent, besoins, quêtes, amitiés gardés; apparence et genre à refaire), et un message le dit. Aucun n'y figure: refus (autre duo), partie neuve.

## Format et migrations

- `DATA_SCHEMA` (`src/etat/monde.ts`) est la version courante. La monter oblige à: ajouter `MIGRATIONS[n]` (de `n` à `n + 1`, pure), ranger `tests/donnees/sauvegarde-v<n+1>.json`, et le test `sauvegarde.test.ts` vérifie les deux. Une référence n'est jamais régénérée.
- Version 2 (2026-11-11): l'apparence d'un joueur se révèle à la photo du prologue (fait `joueurs.apparence.j<n>`). `MIGRATIONS[1]` retient ce fait pour les deux joueurs d'une partie de la version 1 (elle avait commencé par l'éditeur: les personnages restent visibles). Test: `tests/photo-prologue.test.ts`.
- Pendant la refonte, `STAGE_FLOOR` est la plus ancienne version reprise. Plus ancienne: refus poli avec message, partie neuve, écriture qui continue (ADR 0017). À l'Alpha: `STAGE_FLOOR = 1`, migrations seules.
- Sauvegarde d'un format plus récent ou abîmée: même refus, message différent. Rien ne plante.

## Tailles et durées (mesurées, `pnpm test` affiche la ligne)

Départ: moins de 3 Ko. Partie vécue: environ 2,6 Ko. Au pire (sacs pleins, 200 meubles, 80 objets au sol et 20 habitants par lieu, 10 lieux): 234 Ko, soit 22 Ko par lieu au pire; budget 512 Ko, atteint vers 20 lieux visités au pire. Sérialisation 1,6 ms, relecture et contrôle 17 à 22 ms.
