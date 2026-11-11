# Personnages (lot L6)

ADR 0021. Assemblage d'un personnage à partir de son `Look`: pièces du catalogue fusionnées en un seul maillage skinné sur le squelette commun de 24 os (un appel de dessin par personnage et par passe), couleurs des zones en couleurs de sommets, clips partagés.

## Silhouette avant la photo

Tant que l'apparence d'un joueur n'est pas révélée (`lookRevealed`, `src/simulation/regles/apparence.ts`), la couche assemble pour lui `silhouetteLook` (`apparence.ts`): la même forme pour les deux joueurs (tête nue, volume d'une tenue, ni cheveux ni coiffe), dont tous les sommets sont peints d'une seule teinte sombre (`CHARACTER_SETTINGS.silhouette`). Même matériau et même programme que les autres personnages: une géométrie partagée de plus, rien d'autre. Dès que le fait est retenu, `ensure` refait le personnage avec son vrai look (composé, ou par défaut s'il n'a rien validé).
