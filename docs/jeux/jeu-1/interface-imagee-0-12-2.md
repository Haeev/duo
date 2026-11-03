# La Petite Ligne: interface imagée (patch 0.12.2)

| Champ | Valeur |
|---|---|
| Statut | appliqué dans le jeu (comptoir, mercerie, catalogue, réchaud, établi, basse-cour, carnet des poissons, fauteuil de Solange) |
| Rédaction | ux-ui-designer, 2026-11-03 |
| Origine | retours du 3 novembre: R03, R08, R10, R12, et le fauteuil de Solange |
| Code | `src/interface/vitrine.ts` et `vitrine.css` (composants), `modele-vitrine.ts` (modèles), `icones.ts` (icônes, lot de l'artiste 2D) |
| Captures | `docs/jeux/jeu-1/gauntlet/captures/0-12-2-interface/avant/` et `apres/` |

Le client: « Le jeu doit être léger en texte et jouer plus sur des icônes, des images, des animations. » Ces règles valent pour tout panneau nouveau ou refait.

## 1. Les règles

1. **Une icône et un nombre plutôt qu'une phrase.** « 3 radis pour 2 radis à la croque-au-sel » devient l'icône du radis « 3/3 », puis le plat « ×2 ». Un prix est une pastille dorée avec la pièce; une réserve est une jauge et « 9 j ».
2. **Le nom de l'objet seulement à la sélection.** La grille ne montre que des dessins et des pastilles. Le nom apparaît en grand dans le panneau de détail de la vignette choisie, et en étiquette au survol de la souris. Le lecteur d'écran lit toujours le nom complet (`aria-label` de chaque vignette).
3. **Une ligne de texte au plus.** Sous le nom, une seule phrase courte (usage d'un objet, première phrase de la description d'un poisson, indice d'un poisson pas encore pris). Tout le reste passe en pastilles.
4. **Les manques en icônes, jamais en « Il manque : ... ».** Ce qui manque est grisé, en pointillé et barré d'un trait, avec un compteur « possédés / requis » (« 0/2 »). L'argent qui manque: la pièce barrée « 18/120 ». La couleur n'est jamais seule: trait, pointillé et compteur disent la même chose.
5. **Pas de défilement à 1366x768 pour une page normale.** Au-delà, des pages: A et E (lettres lues par position, AZERTY), comme les onglets, avec des points de page et deux flèches cliquables. A et E tournent d'abord les pages de l'onglet, puis passent à l'onglet voisin: le pied dit « pages » pour les deux.
6. **Clavier et souris complets.** Le focus est la sélection. Flèches ou Z Q S D: vignette voisine, et vers la droite le détail et ses boutons. Entrée sur la vignette choisie: l'action principale (acheter 1, commander, vendre 1, cuisiner). À la souris, un premier clic choisit, un clic sur la vignette déjà choisie agit; les boutons du détail agissent au premier clic. Retour arrière ferme, Échap reste à la pause de Duo.
7. **De petites animations, toutes coupées par la réduction des animations** (réglage de Duo, sinon `prefers-reduced-motion`): rebond de la vignette choisie et du grand dessin du détail, pièce qui vole de la bourse à la vignette à l'achat (et l'inverse à la vente), jauges qui se remplissent à l'ouverture. Seulement `transform` et `opacity`, aucun flou ni filtre (PC de référence).

## 2. Les composants

| Composant | Classe | Rôle |
|---|---|---|
| Vitrine | `.lpl-vitrine` (`Vitrine` dans `vitrine.ts`) | grille de vignettes paginée et panneau de détail; garde page et sélection d'un rendu à l'autre |
| Vignette | `.lpl-tile` | dessin, pastille en haut à droite (prix, quantité), marque en haut à gauche (coche, colis, sablier, cadenas, jeton de l'autre pour un gros achat), état `missing`, `wait`, `locked`, `done` |
| Pastille | `.lpl-pastille` (`--price`, `--count`, `--ok`, `--missing`, `--wait`, `--info`) | une icône et un nombre; `data-crossed` barre l'icône |
| Jauge | `.lpl-gauge` (`--heart`, `--food`, `--fresh`) | `role="meter"`; basse: hachures en plus de la longueur |
| Compteur | `.lpl-need-count` | icône et « possédés / requis », barré s'il en manque |
| Rangée d'icônes | `.lpl-icon-row` | saisons, moments: l'inactive en pointillé et barrée |
| Carte de recette | `.lpl-recipe` | le plat en grand et « ×2 », les ingrédients en compteurs, un seul bouton |
| Carte de bête | `.lpl-farm__card` | portrait selon la robe, nom, jauge du cœur, pastilles (nourrie, au nid, traite, eau), bouton « Couver » s'il y a lieu |

## 3. Écran par écran

- **Comptoir d'Odette, mercerie de Solange**: 5 colonnes, 20 vignettes par page. Détail: prix, pastilles d'usage (pousse « 2 j », récolte « ×3 », beauté, confort, endurance, ce qu'on en fabrique), « dans ton sac », puis Acheter 1, Acheter 4, ou Proposer à l'autre (jeton de son profil). Vendre: budget du jour d'Odette, taux, ardoise en pastilles; Vendre 1, Tout vendre.
- **Catalogue du quai**: 6 colonnes, 24 par page; le rayon en surtitre du détail; commandés et seuil des gros achats en pastilles.
- **Réchaud, établi**: 4 cartes par rangée, 8 par page; la rangée « Manger » en vignettes (quantité, endurance rendue, deux jetons quand on mange ensemble). À l'établi, les commandes de Basile passent dans un onglet à elles; les plans à venir sont une carte au cadenas « +3 ».
- **Basse-cour**: l'état en tuiles (places en pictos « 4/5 », grain en jauge avec les jours de réserve, nourries ou pas aujourd'hui, mangeoire à trémie installée ou au catalogue, litière en jauge, couvée en nuits ou ses quatre conditions barrées); une carte par bête; la collection des six robes en portraits nommés, gris et « ? » pour celles à trouver.
- **Carnet, Poissons**: 7 colonnes; liseré de rareté (couleur, épaisseur, double trait et écailles ◆), silhouette grise à la taille de l'ombre pour ceux pas encore pris. Détail: grand dessin, nom, une phrase, saisons, moments (matin, midi, soir, nuit), coins sur une petite carte de la rivière, prix, record (avec le jeton de qui l'a fait), nombre de prises.
- **Fauteuil de Solange**: l'aperçu 3D du vrai personnage à gauche (A et E ou glisser pour tourner), les 15 coupes et les 4 barbes en mini-portraits, les 8 couleurs en pastilles, le prix en pastille et un seul bouton Valider (ou Proposer depuis le banc). En mode secours, un petit portrait.

## 4. Ce qui reste en mots, et pourquoi

Le nom à choisir pour une bête (trois prénoms à lire), les avis d'une ligne (boutique fermée, catalogue parti), la proposition reçue au fauteuil. Les commandes de Basile (chantiers, abris, pièces) gardent leur forme dans leur onglet: hors du périmètre de ce patch.
