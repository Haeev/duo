# ADR 0017: Refonte de La Petite Ligne dans un nouveau paquet, contenu par gabarits

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | ingenieur-build (catalogue, CI), dev-gameplay-3d, game-designer, level-designer, qa-testeur |
| Jeu | `games/la-petite-ligne-2`; plan: `docs/jeux/jeu-1/refonte/technique.md`; cahier: `docs/jeux/jeu-1/refonte/cahier-des-charges.md` |
| Liens | ADR 0005 (contrat des jeux, identifiant stable), 0009 (sauvegardes), 0010 (distribution), 0013 (tests) |

Rangé avec les ADR de la plateforme, comme l'ADR 0016: il n'existe pas de dossier de décisions par jeu.

## Contexte

Le client refond La Petite Ligne (réponses du 2026-11-10): plusieurs lieux reliés par le train, narration guidée, caméra libre, personnages modulaires, besoins, page blanche pour le contenu, sauvegardes abandonnées. L'audit de la 0.13 (`technique.md`, section 1) compte 99 407 lignes de TypeScript hors tests dans 300 fichiers: 16 % à garder, 37 % à adapter, 28 % à réécrire, 19 % à supprimer; 161 fichiers de tests, presque tous liés à l'ancien contenu; des prénoms d'habitants dans 25 fichiers de la simulation. Trois fichiers tiennent tout (`etat/types.ts`, `simulation/pas.ts`, `donnees/contenu.ts`): on ne peut pas retirer l'ancien contenu sans tout casser d'un coup.

Décisions du client du même jour: deux jeux dans Duo pendant la refonte, puis retrait de l'ancien; parties d'essai remises à zéro à chaque étape tant que le jeu n'est pas complet; et une règle de studio: ajouter un contenu (une chaise, un habitant, une quête, un lieu) ne doit jamais demander de repartir de zéro ni de toucher au moteur.

## Options

### Où refondre

| | A. Dans `games/la-petite-ligne` | B. Nouveau paquet |
|---|---|---|
| Pendant la refonte | paquet rouge des semaines; plus de correctif possible de la 0.13 | vert dès le premier jour; l'ancien reste publiable |
| Chez le client | la refonte remplace la 0.13 dès le premier jalon | deux tuiles, l'ancienne retirée quand la nouvelle a plus à offrir |
| Anciennes sauvegardes | présentes, à écarter proprement (une sauvegarde refusée coupait toute écriture) | absentes: nouvel identifiant |
| Risque | restes de l'ancien contenu dans le moteur | copie de code pendant la coexistence |

### Où vit le contenu

| | 1. Fichiers par domaine (ancien jeu: `quetes.json`, `habitants.json`) et lecture écrite à la main | 2. Un fichier par contenu, schéma par type, gabarit à copier |
|---|---|---|
| Ajouter une chaise | éditer un gros fichier, parfois le moteur (gestes de décor de la 0.13) | un fichier de 15 lignes copié du gabarit |
| Travail à plusieurs | conflits dans les mêmes fichiers | un fichier par auteur et par contenu |
| Validation | 2 889 lignes de lecture à la main et un validateur Python en double | schémas Valibot, source unique des types et des contrôles |

## Décision

1. **Nouveau paquet** `games/la-petite-ligne-2`: identifiant `la-petite-ligne-2`, nom affiché « La Petite Ligne (refonte) », version 0.20.0. `games/la-petite-ligne` reste intact, gelé (correctifs bloquants seulement) et publiable.
2. **Reprise module par module**: seuls les fichiers classés « garder » ou « adapter » par l'audit sont repris, en copie relue par le lot qui possède le dossier d'arrivée (tableau du `README.md` du paquet). Cette copie déroge à la règle « jamais copié d'un jeu à l'autre » pour la durée de la coexistence; **l'ancien dossier est supprimé à l'Alpha de la refonte** et le jeu retiré du catalogue.
3. **Sauvegardes**: `dataSchema` repart à 1. Jusqu'à l'Alpha, une sauvegarde d'un autre format n'est pas migrée: la partie repart de zéro, c'est journalisé, et l'écriture continue. À partir de l'Alpha: toute évolution du format est migrée, avec une sauvegarde de référence par format. Budget interne: 512 Ko (limite du manifeste: 1 Mio).
4. **Contenu par gabarits**: un contenu est un fichier de `donnees/` dont le nom est l'identifiant. Chaque type (objet, meuble, pièce de personnage, habitant, recette, prise, commerce, dialogue, quête, lieu) a son schéma (`src/donnees/schemas/`), son gabarit commenté (`donnees/_gabarits/`), sa recette (`donnees/README.md`), sa commande (`pnpm nouveau <type> <id> [lieu]`) et son test d'exemplaire factice (`tests/gabarits.test.ts`). Un lieu est un dossier autonome.
5. **Briques de comportement**: ce que fait un meuble est déclaré dans ses données par des briques nommées (`sit`, `sleep`, `store`, `gather`, `relieve`, `shop`, `cook`, `open`, `repair`). Le moteur ne connaît aucun meuble: il lit les briques de la cible et appelle leur comportement (`src/simulation/briques/registre.ts`). Un comportement qui manque est une brique nouvelle, jamais un cas particulier.
6. **Le moteur ne nomme aucun contenu**; les schémas Valibot sont la source unique des types et des validateurs; les valeurs de gameplay vivent dans `donnees/commun/reglages.json` et `besoins.json`.
7. **Tests**: `pnpm test` (rapide, un test de plus de 20 s échoue) et `pnpm test:longues` (à la demande) séparés dès le départ.

## Conséquences

- Ajouter une chaise: un fichier de données (`donnees/commun/meubles/chaise.json`), plus son modèle; une ligne dans une carte pour la poser. Aucune ligne de moteur. Prouvé par `tests/gabarits.test.ts`.
- Dix lots peuvent travailler de front: chacun possède ses dossiers, et ajoute ses intentions et ses événements dans ses propres tableaux.
- Deux paquets à tenir verts dans la CI pendant la coexistence; la suite rapide de l'ancien dure 16 min 18 s (mesure du 2026-11-10): ses 8 tests de plus de 100 s sont à passer dans ses tests longs.
- Historique et score cumulé du nouveau jeu repartent de zéro.

## À vérifier

- Retrait d'un jeu du catalogue et sort de ses fichiers chez le client: l'ADR 0010 ne le décrit pas (ingenieur-build).
- Poids du paquet quand trois lieux et 150 pièces de personnage y seront (budget: 150 Mo, 25 Mo par lieu).
