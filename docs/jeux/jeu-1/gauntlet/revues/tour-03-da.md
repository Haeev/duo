# Gauntlet, tour 3: revue adverse du directeur artistique (épreuve G6, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-10-31, de 11 h 16 à 11 h 25 UTC |
| Arbre relu | `/home/user/duo`, branche `claude/stoic-lamport-lueey2`, commit `d8a5dad` |
| Référence | `tour-02-da.md`: pilier 2 à 6/10, pilier 3 à 6/10 |
| Verdict G6 | **pilier 3: mieux qu'avant (oui)**; **pilier 2: légèrement mieux (oui, avec une réserve sur la forme des fumées)**; aucune régression |
| Notes | **pilier 2: 6/10** (inchangé); **pilier 3: 6,5/10** (6 avant) |

## Méthode

- Serveur Vite redémarré sur le port 5301 (arbre actuel), rendu normal, 1366 x 768, `timeout` sur chaque capture.
- Mêmes adresses et cadrages qu'aux tours 1 et 2: place à 8 h 15, 18 h 30 et 22 h 30, quai à 10 h, intérieur à 19 h 45, pluie à 11 h. En plus: place à 19 h 15, intérieur à 19 h 45 et à 21 h toit réparé (`repare=1`, le foyer ne s'allume qu'une fois le toit réparé), abords de l'épicerie à 19 h 15 (trois images).
- Niveaux de gris (moyenne et écart type sur 0 à 255; pièce mesurée sur le même rectangle qu'au tour 1), comparaison pixel à pixel avec les captures du tour 2 (`compare -metric AE -fuzz 4%`).

## Mesures

| Plan | Tour 2 | Tour 3 |
|---|---|---|
| Place, 18 h 30 (moyenne, écart) | 80, 19 | 82, **22** |
| Place, 19 h 15 | non mesuré | 73, 23 |
| Pièce, 19 h 45, toit non réparé | 44, 15 | 44, 15 (foyer éteint, attendu) |
| Pièce, 19 h 45, toit réparé | non mesuré | **90, 39** |
| Pièce, 21 h, toit réparé | 62, 35 (mesure du technical artist) | **93, 54** |
| Place, 8 h 15 | 109, 25 | 109, 25 |
| Place, 22 h 30 | 53, 37 | 53, 37 |
| Quai, 10 h | 118, 30 | 118, 31 |
| Pluie, 11 h | 87, 19 | 87, 20 |

Budgets relevés: 67 à 113 appels de dessin, au plus 207 000 triangles, 10 à 11 programmes, comme avant.

## Ce qui a changé, preuves

- **Le soir est nettement mieux.** À 18 h 30, la lumière chaude du soleil et les ombres froides se séparent enfin. Les toits d'ardoise redeviennent bleus, l'herbe verte, le toit du puits rouge, et la place n'est plus un aplat orange-brun (`da-01-soir-avant-apres-gris.png`, tour 2 à gauche, tour 3 à droite, niveaux de gris en dessous). L'écart passe de 19 à 22. La cible de 25 n'est pas atteinte, mais le gain se voit à l'œil. Petite réserve: les pavés prennent une teinte mauve un peu sale dans les ombres. On peut la garder pour l'instant, à revoir avec le nouveau sol.
- **Le foyer réussit pleinement.** Dès 19 h 45, toit réparé, la pièce devient le point chaud de l'image (moyenne 44 à 90, écart 15 à 39). Murs crème éclairés, plancher doré, personnage lisible (`da-02-interieur-1945-sans-et-avec-foyer.png`, sans foyer à gauche, avec à droite). C'est le chez-soi douillet qu'il fallait. Je retire ce point de mon défaut n° 3 du tour 1.
- **Fumées: visibles, mais la forme ne marche pas encore.** Au-dessus de l'épicerie, la bouffée à facettes apparaît comme un hexagone gris pâle opaque posé sur le conduit, de la taille de la cheminée. À cette échelle, on lit un bloc de pierre ou un chapeau de cheminée, pas de la fumée (`da-03-fumee-hexagone.png`, à gauche le plan de jeu, à droite le détail agrandi deux fois). La vapeur ronde du train et ces hexagones forment aussi deux langages différents pour le même phénomène. Correction: naître petite (30 % de la taille finale) et transparente, s'élargir et s'éclaircir en montant, finir à 0,75 seulement au milieu de sa vie; décaler la naissance de 15 cm au-dessus de la bouche; trois ou quatre bouffées plus petites à la file plutôt qu'une grosse; même forme pour la vapeur du train. tech-artist, 45 min.
- **Aucune régression.** Matin, nuit, quai et intérieur non réparé ne changent pas (1 400 à 5 500 pixels sur 1 049 000, dus à l'eau, aux nuages et au vent). Sous la pluie, les écarts viennent des gouttes. Énigme de la cloche non touchée, d'après `ETAT.md`. Je ne l'ai pas recapturée.

## Pilier 2: vie du monde et animation, 6/10 (inchangé)

Les fumées sont désormais visibles, ce qui répond au manque du tour 2, mais leur forme actuelle se lit comme un objet, pas comme du mouvement. Le gain est donc nul pour l'instant. Restent ouverts: la petite faune, les attentes variées, la réaction des habitants aux joueurs, les gestes empruntés (cuisiner joue toujours « scier »).

## Pilier 3: direction artistique, 6,5/10 (6 avant)

Le défaut n° 3 du tour 1 (soir et intérieur sans relief) est corrigé pour l'intérieur et en bonne partie pour le soir. La lumière était déjà un point fort, elle tient maintenant toute la journée. La note reste plafonnée par le sol en damier et en escalier, la rivière en canal, les premiers plans qui bouchent la vue et la marquise nue. Sans le sol, on ne passera pas 7.

## Priorités pour le tour 4

Le sol et la petite faune sont déjà prévus. Ils restent les deux premiers chantiers en impact. Trois autres à mener en parallèle ou juste après:

1. **La rivière et le gué** (pilier 3): berges irrégulières à deux niveaux de pierres, gué en pierres plates espacées sous la lame d'eau, roseaux et nénuphars, liseré d'écume au pied des berges. À faire dans la foulée du sol, car c'est la même logique de bord coupé. level-designer, dev rendu, artiste-3d, tech-artist; environ 240 min, +0,5 à +1.
2. **Des attentes variées et des habitants qui réagissent** (pilier 2): deux ou trois attentes par gabarit après 5 à 8 s d'immobilité, gestes propres à chaque habitant (montre de Firmin, comptoir d'Odette, jambes de Jeanne), tête tournée vers le joueur proche, salut au premier croisement. Brancher aussi les clips déjà livrés `sit_eat`, `give` et `pet`. artiste-3d, dev rendu; environ 300 min, +1.
3. **La forme des fumées et de la vapeur** (pilier 2): bouffées qui naissent petites et transparentes, une seule forme pour les cheminées et le train (voir plus haut). tech-artist; 45 min, +0,3. Le soir peut gagner les 3 points d'écart qui manquent (vers 25) en même temps, en assombrissant un peu les ombres portées plutôt que toute la scène.

## À tester chez le client

- Le foyer et le soir sur l'écran du PC de référence: chaleur de la pièce sans surexposition, lisibilité de la place à 18 h 30.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-03/`:

- `da-01-soir-avant-apres-gris.png`: la place à 18 h 30, tour 2 à gauche, tour 3 à droite, en couleur puis en niveaux de gris.
- `da-02-interieur-1945-sans-et-avec-foyer.png`: l'intérieur à 19 h 45, toit non réparé (sans foyer) à gauche, toit réparé (foyer allumé) à droite.
- `da-03-fumee-hexagone.png`: la cheminée de l'épicerie à 19 h 45, plan de jeu à gauche, détail agrandi deux fois à droite.
