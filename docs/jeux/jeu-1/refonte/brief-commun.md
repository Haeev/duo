# Refonte de La Petite Ligne: brief commun à toutes les missions

À lire en premier par tout membre qui reçoit une mission sur `games/la-petite-ligne-2`. La mission elle-même ne donne que ce qui lui est propre.

## Le jeu en une phrase

Une vie tranquille à deux en réseau local (potager, pêche, collections, déco, voisins attachants) portée par une histoire guidée, tendre, drôle et très doucement mystérieuse, qui mène les deux joueurs en train de lieu en lieu: Aubrune (bourg d'apprentissage), puis Hautefonte (métropole), puis Combe-Veilleuse (village hanté).

## Documents de référence (`docs/jeux/jeu-1/refonte/`)

| Document | Contenu |
|---|---|
| `cahier-des-charges.md` | règles chiffrées, histoire, jalons, critères d'acceptation (fait foi) |
| `reponses-client-2026-11-10.md` | les réponses et décisions du client, mot pour mot |
| `technique.md` | architecture, lots, budgets |
| `interface.md` et `maquettes/` | écrans, touches, règles d'animation |
| `bible-artistique.md` et `planches/` | style « maquette de train miniature », figurines lisses, nuancier |
| `references-de-ressenti.md` | section 3: règles de ressenti à respecter |
| `carte-aubrune/` | plan vu du dessus d'Aubrune (`plan.md`, `plan.json`, images) |

Dans le paquet: `games/la-petite-ligne-2/README.md` (règles du paquet, qui possède quoi) et le README de chaque dossier. ADR 0017 à 0021 dans `docs/plateforme/decisions/`.

## Règles qui valent pour tous

1. **Départ**: ton worktree part de `main`. Lance `git fetch origin claude/stoic-lamport-lueey2 && git merge --ff-only origin/claude/stoic-lamport-lueey2`, puis `pnpm install --offline` si `node_modules` manque. Si une autre mission a livré entre-temps ce dont tu dépends, refais cette fusion.
2. **Tes dossiers**: tu ne modifies que les dossiers nommés dans ta mission, plus tes tests. Un besoin dans un fichier commun (`src/etat/`, `src/donnees/schemas/`, `src/reseau/canaux.ts`, `src/simulation/noyau/systemes.ts`, `src/simulation/briques/registre.ts`, `src/main.ts`, `src/session.ts`) se limite à l'ajout minimal (une ligne d'inscription, un champ facultatif, un fichier de schéma à toi) et se signale dans le compte rendu. Jamais de réécriture d'un fichier commun.
3. **Gabarits** (CLAUDE.md): tout contenu s'ajoute par une fiche copiée d'un gabarit (`donnees/_gabarits/`, commande `pnpm nouveau`), sans toucher au moteur. Un nouveau type de contenu arrive avec son schéma, son gabarit commenté, sa recette d'ajout dans le README, et un test « exemplaire factice ». Le moteur ne nomme aucun contenu (ni habitant, ni lieu, ni objet).
4. **Comportements par briques**: une action possible sur un objet est une brique déclarée dans sa fiche et inscrite au registre.
5. **Simulation autoritaire chez l'hôte**: l'invité envoie des intentions; tout état lent modifié appelle `touch`; les tailles transmises restent sous leur budget (test de taille).
6. **Valeurs de gameplay** dans la configuration typée et les données, jamais en dur. TypeScript strict. Argent en centimes entiers, affiché par `formatEuros`.
7. **Textes**: en français, tutoiement, dans les fichiers de textes ou de données; accords de genre par la balise `[[f|m]]`; aucun tiret cadratin ni demi-cadratin nulle part.
8. **Tests** (point 8 de CLAUDE.md): un test court par nouveauté (moins de 5 s), `tsc --noEmit`, `eslint`, `prettier --check` sur tes fichiers, puis `pnpm test` du paquet avant de rendre. Pas de suite globale du dépôt, pas de longue partie de robots.
9. **Preuve visuelle** quand la mission a un effet à l'écran: banc à deux vues (`pnpm --filter @duo/sdk-dev servir la-petite-ligne-2 --construire`, Playwright et Chromium préinstallés) ou page de démonstration, captures regardées avant de rendre. Dis lesquelles tu as regardées.
10. **Tu ne commites pas et tu ne pousses pas.** Aucun crédit Meshy sans budget écrit dans ta mission.
11. **Compte rendu**: 12 lignes au plus, au format de CLAUDE.md: statut, fait, fichiers, preuves, non vérifié, ce que les autres lots doivent savoir pour se brancher, défauts vus.
