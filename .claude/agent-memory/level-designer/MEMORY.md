# Carnet du level designer

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Caméra isométrique (vérifié sur la carte de la Halte, 2026-10-31)

- En isométrique vraie (élévation 35,264 degrés), un volume de hauteur H cache un point vu à la hauteur h jusqu'à H - h mètres derrière lui sur chaque axe: avec la caméra au sud-est, H - h vers le nord et autant vers l'ouest. Une épicerie de 8,5 m cache 7,5 m de terrain au nord-ouest pour un buste à 1 m, 8,3 m pour un objet posé au sol.
- Composer pour la caméra par défaut (sud-est chez La Petite Ligne, `yaw = -3 PI/4` du rendu): le haut au nord et à l'ouest, les lieux importants au sud-est de ce qui est haut, le premier plan (sud, est) bas. Des arbres dans l'anneau de décor est ou ouest cachent 8 à 9 m de carte depuis les orientations latérales: y mettre des haies basses.
- Voie au nord du quai: le train à l'arrêt ne cache jamais le quai depuis les caméras du sud. Un bâtiment voyageurs au sud du quai le cache; en ligne au bout du quai, il ne cache que ce bout, depuis une seule orientation.
- Arbres de lisière: houppier compris (3,4 m pour un chêne), une rangée d'arbres dont le houppier s'arrête au nord d'un point ne le cache jamais depuis le sud. Garder les arbres au moins deux cases au nord des points de cueillette.
- Exiger « vu depuis la caméra par défaut et depuis au moins une autre orientation » pour les lieux où l'on revient; les places d'apparition, vues une fois, n'ont besoin que de l'orientation par défaut. Ignorer poteaux et troncs de moins de 0,6 m dans le calcul: ils ne cachent pas tout un personnage.

## Méthode et outils

- Carte produite par un script de construction (composition en code), un validateur sans dépendance et un script d'aperçu; ne jamais retoucher le JSON à la main. Éprouver le validateur sur des cartes cassées exprès: deux de mes premiers cas de test étaient faux (le validateur avait raison), relire le cas avant d'accuser l'outil.
- Aperçus: SVG écrit en Python puis `rsvg-convert` (police DejaVu Sans présente); une vue isométrique en colonnes d'une case, triées par x + y, suffit à montrer ce qui masque quoi.
- Distances: Dijkstra sur la grille, huit directions sans couper les angles; c'est un peu plus long que la marche réelle (clic au sol lissé), donc prudent.
- Écrire les caractères interdits par leur code (`chr(0x2014)`) dans un script qui les cherche: écrits littéralement, ils font échouer le contrôle typographique du dépôt.
- Un point peut porter le même nom que l'objet qu'il désigne (`well`, `coop_crate`): garder deux espaces de noms dans le code, sinon la recherche par identifiant boucle.

## La Petite Ligne: contrats à respecter

- `games/la-petite-ligne/outils/valider_donnees.py` cherche les points et zones des données sous toute clé `points` ou `zones` des JSON de `donnees/cartes/`: ne pas employer ces noms de clé pour autre chose. Liste attendue: `donnees/README.md`, section 5 (`offstage` est hors carte).
- Contrat du code (`src/etat/carte.ts`): zones à un seul rectangle, potager en 12 cases ordonnées, `house` (pièce, case de la porte, retour de minuit), arbres `oak` ou `fir` seulement, `props` avec `model`, `pos`, `rotation`, `rect`. Les meubles de départ (`startingInventory.houseFurniture`) sont placés par la carte.
- `demo.md` fait foi pour le périmètre de la démo (potager de 12 cases, puits au lieu de fontaine); les réserves du jeu complet (maison 14x12, potager de 96 cases) se gardent en zones vides.
