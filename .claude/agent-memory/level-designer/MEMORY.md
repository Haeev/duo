# Carnet du level designer

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Caméra isométrique (vérifié sur la carte de la Halte, 2026-10-31)

- En isométrique vraie (élévation 35,264 degrés), un volume de hauteur H cache un point vu à la hauteur h jusqu'à H - h mètres derrière lui sur chaque axe: avec la caméra au sud-est, H - h vers le nord et autant vers l'ouest. Une épicerie de 8,5 m cache 7,5 m de terrain au nord-ouest pour un buste à 1 m, 8,3 m pour un objet posé au sol.
- Composer pour la caméra par défaut (sud-est chez La Petite Ligne, `yaw = -3 PI/4` du rendu): le haut au nord et à l'ouest, les lieux importants au sud-est de ce qui est haut, le premier plan (sud, est) bas. Des arbres dans l'anneau de décor est ou ouest cachent 8 à 9 m de carte depuis les orientations latérales: y mettre des haies basses.
- Voie au nord du quai: le train à l'arrêt ne cache jamais le quai depuis les caméras du sud. Un bâtiment voyageurs au sud du quai le cache; en ligne au bout du quai, il ne cache que ce bout, depuis une seule orientation.
- Arbres de lisière: houppier compris (3,4 m pour un chêne), une rangée d'arbres dont le houppier s'arrête au nord d'un point ne le cache jamais depuis le sud. Garder les arbres au moins deux cases au nord des points de cueillette.
- Exiger « vu depuis la caméra par défaut et depuis au moins une autre orientation » pour les lieux où l'on revient; les places d'apparition, vues une fois, n'ont besoin que de l'orientation par défaut. Ignorer poteaux et troncs de moins de 0,6 m dans le calcul: ils ne cachent pas tout un personnage.

- La Petite Ligne: la forêt du pourtour n'est pas dans la carte, le rendu la sème (`src/rendu/vegetation.ts`, hors du bord jouable, arbres de 3 à 9,5 m, houppier jusqu'à 2,3 m de rayon). Tout lieu à moins de 10 m du bord sud ou est est caché depuis la caméra par défaut: vérifier ces lignes de vue en plus de la carte. Recul de lisière: `RENDER_SETTINGS.terrain.forestClearings`.
- Ligne de vue exacte dans Node: construire `Terrain` et `Vegetation` avec des matériaux factices (`MeshBasicMaterial`, `paletteColor` qui rend blanc) puis `Raycaster.intersectObjects` sur les maillages instanciés `foret*`, rayon vers la caméra (`-cos yaw, sin e, -sin yaw`, yaw = -3 PI/4 + k PI/2). Exemple: `src/rendu/foret-pourtour.test.ts`.
- Page `rendu.html` pour un moment: ajouter `vie=0`, sinon la promenade déplace Camille et la caméra ne montre pas le moment.

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

## Mesurer le contenu par les robots (vérifié le 2026-10-31)

- Un script jetable hors du dépôt se lance avec la configuration du jeu: `npx vitest run --root games/la-petite-ligne --dir /tmp/<dossier>` (chemins d'import absolus vers `tests/aides.ts` et `src/simulation/`). Une partie complète de 15 jours prend 20 à 45 s.
- `sim.events` est vidé au début de chaque `step`: le lire juste après. Les gestes et la poutre n'ont pas de champ `by`.
- Pour les répliques, reproduire la règle de `pickDialogue` (priorité stricte, puis tirage parmi les ex aequo) avec `evaluateAll` au lieu de l'appeler: elle consomme le générateur et changerait la partie.
- Les robots ne bavardent pas et ne posent que trois meubles: leurs temps creux disent ce que la structure exige, pas ce que ferait un duo humain. Deux robots immobiles au même endroit faussent toute mesure de proximité.

## Audit de cohérence d'une carte (G9, vérifié le 2026-10-31)

- Raconter d'abord la carte comme un habitant (d'où vient la route, où va le bois, où est l'eau, où s'arrêtent les charrettes), puis passer chaque élément: raison d'être, place, sens, taille. Classer par visibilité.
- Le rendu réel est indispensable: les rotations de la carte ne disent rien sans le modèle. Les lisses du passage à niveau en rotation 1 et 3 étaient parallèles à la route nord-sud; en 0 et 2, elles la barrent.
- Captures: `npx vite --port <libre> --strictPort` dans `games/la-petite-ligne`, puis Playwright sur `rendu.html?stats=0&rendu=leger&vie=0&x=..&y=..&zoom=0|2&orientation=0..3&heure=11`, attente de `window.lplRendu.ready` puis 2,5 s. La première page après le démarrage de Vite reste parfois sur « Chargement »: faire une capture de chauffe.
- Un changement « juste » peut casser une règle: tourner le banc du quai déplace son dossier et fait échouer le test d'ombre de l'énigme (`src/rendu/lumiere.test.ts`). Toujours relancer toute la suite du jeu, pas seulement `valider_carte.py`.
- Le constructeur reproduit le JSON à l'octet près: le relancer avant de modifier pour que le diff ne contienne que ses propres changements.

## Agrandir une carte existante (tour 10, vérifié le 2026-11-01)

- Les identifiants automatiques (`bush_41`, `tree_oak_01`) sont cités par les données et le code: changer une boucle de décor (bornes, cases sautées) les décale tous. Garder les boucles d'avant à l'identique et créer les ajouts après; comparer l'avant et l'après (terrain, grille, objets, points) par un script, à l'ouest de la zone ajoutée rien ne doit bouger sans raison.
- Tout ce qui était écrit contre l'ancien bord (haie à x 63, point « dans la haie du bord », sortie au bout d'un chemin) est à relire: le bord a déménagé, la raison d'être aussi.
- Un objet dont le modèle n'existe pas se dessine en caisse rayée (`substituts.ts`); un nom qui contient un mot-clé prend un substitut (`*house*` maison, `*shop*` épicerie, `*rail*` rails, `*stone*` rocher). Ponts et passages: codes de terrain plus une liste `ouvrages`, pas d'objet posé sur la voie ou sur un tablier.
- Un ru de deux cases d'eau (`water`) est dessiné par le rendu actuel en lit de sable avec un filet d'eau: le vérifier en jeu avant de croire qu'il se lit comme de l'eau.

## Caméra et portes (tour 10)

- En isométrique, une porte de façade ne se voit de face que depuis les deux orientations de son côté. « Vue dans trois orientations sur quatre » ne se tient qu'en excluant le bâtiment de la porte (le jeu le coupe ou le rend transparent): l'écrire, et dire de quel côté elle est vraiment vue. Deux portes face à face sur une rue nord-sud: l'une tourne le dos à la caméra par défaut.
- Avec la caméra à 35,264 degrés, le rayon monte de 1 m par mètre parcouru sur chaque axe: un volume de hauteur H cache un point à h jusqu'à H - h cases au sud-est. Un toit à deux pans se contrôle par échantillonnage le long du rayon (`toit` du type: égout et sens du faîtage); le volume plein jusqu'au faîte cache une rue entière qu'un vrai toit laisse voir.

## Environnement de travail

- Copie isolée (worktree): la copie peut partir d'un commit ancien; vérifier que la branche de session contient les documents cités, puis avance rapide (`git merge --ff-only`), sans commit.
- Le garde-fou refuse les commandes qui citent `.git` (même `--exclude-dir=.git`) ou les scripts Python en ligne trop longs: contrôle des tirets avec l'outil Grep, scripts dans `/tmp` lancés avec `python3 -I`.
- Port de Vite: un autre membre peut déjà servir son jeu sur le même port, et Playwright capture alors sa copie à lui sans erreur. Vérifier que le processus du port tourne dans sa propre copie (`readlink /proc/<pid>/cwd`).
