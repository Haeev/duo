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

## Retouches de la Halte (vérifié le 2026-11-02)

- Le rendu tire la variante d'un `bush` ou d'un `rock` du hachage de l'identifiant (`MODEL_VARIANTS`, `textHash` de `src/rendu/modeles.ts`): `bush_11` est un noisetier, `rock_02` un `rock_small`. Pour changer le dessin d'un objet sans toucher au code, échanger sa place avec un objet du même type dont l'identifiant donne la bonne variante. `MODEL_BY_PROP` force un modèle par identifiant (`bush_41` sureau): un retrait d'objet plus haut dans la liste le fait glisser ailleurs.
- Places et cases de l'artiste dans un bâtiment (`interior_spots`, `interior_blocked`, repère glTF x, z): carte x = cx + gx cos a + gz sin a, y = cy - gx sin a + gz cos a (a = rotation x PI/2, centre de l'emprise). Lire les extras et les sommets du GLB avec un petit script Node (en-tête GLB, morceau JSON), et faire une vue de dessus orthographique dans Chromium (Three.js de `node_modules`, serveur `python3 -m http.server`) pour voir le mobilier.
- Des tests de robots qui marchent au hasard (`moments-tour7.test.ts`, la chevrette) dépendent des cases bloquées autour de leur point de départ: un buisson posé au bord du pré les a fait échouer. Après un déplacement de décor, relancer ces tests seuls, puis toute la suite; ne jamais réécrire `halte.json` pendant que la suite tourne (elle lit le fichier au fil des tests).
- `src/rendu/gue.test.ts` fige le bout nord de la route du gué en y 36 (une rangée au-dessus de la berge, gué en eau dès y 38): ne pas raccourcir ni élargir la route là.
- Machine partagée (charge 20 et plus sur 4 cœurs): la suite complète dure plus de 25 minutes; la lancer en tâche de fond sans `timeout` court, et ne pas tuer `vitest` par nom (d'autres membres en font tourner).

## Concevoir un agrandissement (0.13, vérifié sur maquette le 2026-11-03)

- Grandir vers le nord ou l'ouest décale toutes les coordonnées (environ 270 littéraux dans `src/` et `tests/`, positions des sauvegardes, `moments.json`): proposer une origine de grille (`taille.origine`, coordonnées négatives) plutôt qu'un décalage, et le faire trancher par l'architecte avant tout générateur.
- Une maquette Python (bibliothèque standard) qui pose `halte.json` dans la grille élargie, dessine les régions en rectangles, ellipses et sentiers, puis calcule Dijkstra, A* (nœuds), lignes de vue et triangles par vue, tranche en une seconde; garder ses sorties comme preuves du document (`docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py`).
- Forêt sous la caméra isométrique: clairières allongées sur la diagonale nord-ouest et sud-est, cônes de 10 m sans houppier vers le sud-est et le nord-ouest de chaque lieu; un grand arbre repère au bord latéral (nord-est) d'une clairière, jamais au bout de la diagonale. La forêt du pourtour cache, depuis les orientations du nord, ce qui est à moins de 8 m du bord nord.
- Cour d'un atelier: à l'est du bâtiment (au sud-est d'un volume, on est vu), et son point au bord de la route; une cour à l'ouest ou un point au milieu d'une cour entre deux ateliers est caché depuis la caméra par défaut. Même raison pour une ferme tournée au midi (cour au sud-est du logis et de la grange) et pour un cimetière à l'est du chevet plutôt qu'au nord de la nef.
- Rue nord-sud: maisons côté ouest, côté est bas (vigne, jardin, haie); une rue à l'est d'un volume reste vue, à l'ouest elle est cachée.
- Estimer le coût d'une vue: objets dans le cadre (deux fois pour l'ombre) plus une base déduite d'une vue mesurée (place: 201 830 moins ses objets, environ 123 600); la méthode surestime (la rue Haute actuelle sort au-dessus de sa cible): s'en servir pour comparer des vues, pas comme mesure.
- Le garde-fou refuse aussi les `python3 - <<EOF` et les commandes enchaînées par `cd ... && python3 ...` avec un heredoc: faire les retouches de script avec l'outil Edit, ou un script dans le dossier de travail temporaire lancé avec `python3 -I`.

## Carte à origine de grille (0.13, lot L1, vérifié le 2026-11-03)

- Le jeu ne lit pas `taille.origine`: une trentaine de fichiers du rendu, de la simulation et de l'audio indexent `cy * map.width + cx` et bornent à 0 (lot L0). La lecture refuse une origine non nulle (carte de secours, `tests/carte-origine.test.ts`); la carte agrandie s'écrit dans `donnees/cartes-0-13/` (pas chargée par le jeu) avec `construire_carte_halte.py --0.13`; sans option, le constructeur rend la carte du tour 10 à l'octet près.
- Outils Python: `Grille` et `Rangee` de `valider_carte.py` indexent en coordonnées de la carte et lèvent `IndexError` hors grille (une liste Python lirait silencieusement l'autre bout pour un indice négatif). Chercher les `range(larg)`, `range(haut)` et `0 <= x` oubliés: ils ignorent en silence les régions négatives.
- Mesurer et capturer avant L0: copier le jeu dans un dossier temporaire (src, donnees, assets, public, html, configs, lien vers node_modules), y poser la carte translatée de (-origine) par un script qui décale toutes les clés `x`, `y`, `cx`, `cy`, `par`, `cases`, `colonnes`, `de_y`, `a_y`; supprimer le dossier ensuite.
- Le contrôle de caméra de la forêt: une boîte par houppier, rangées en carrés de 2 m (`IndexBoites`), sinon le décompte des cases cachées prend des minutes. La forêt du pourtour (`camera.foret_pourtour`) cache tout à moins de 8 m des bords nord, ouest et est: lieux importants hors de cette bande, ou vus du sud-est et du sud-ouest seulement.
- Arbre hôte d'une cueillette (châtaignier): le coin à 3 m au sud du tronc, hors du houppier, sinon le houppier le cache de la caméra par défaut; l'hôte ne doit tomber dans le cône d'aucun autre lieu (poser les arbres hôtes en dernier). Cônes sud-est, nord-ouest et sud-ouest pour tous les lieux du bois videraient la forêt: les coins de cueillette n'ont que sud-est et sud-ouest.
- A* du jeu (`findPath`, heuristique euclidienne, abandon à 4 000 nœuds): sur 164 x 78 m, les trajets vers un lieu clos dont l'entrée est de l'autre côté (cimetière, forge, rive du bief) épuisent le plafond. Une seconde entrée (grille ouest du cimetière, porte de la forge sur la route, planches sur le canal) divise les nœuds par 1,5 à 2. `valider_carte.py --plannings <json>` teste toutes les paires de points de chaque planning.

## Cosy Café: plans des adresses (vérifié le 2026-11-07)

- Chaîne: `docs/jeux/cosy-cafe/plans/construire_plans.py` compose en code, écrit `plans.json` (un élément par ligne, lisible en diff), dessine les SVG depuis ce JSON, puis `rsvg-convert` et `convert -strip -colors 256 PNG8:` (trois fois plus léger; sans `-strip`, ImageMagick date le PNG et deux passes diffèrent). `valider_plans.py` lit le JSON; `eprouver_validateur.py` casse une copie du village de huit façons. Plafonds de l'architecte: `docs/jeux/cosy-cafe/technique.md`, section 11 (C1 à C18), recopiés dans `NORMS`.
- Raster de 5 cm avec centres des cases sur les cotes: une porte de 0,90 m laisse passer pile un gabarit de 0,90 m. Distance analytique aux formes (rectangles, cercles, polygones) plutôt qu'une transformée: une seconde par plan.
- Piège vu: « strictement dedans » écrit `dist <= -1e-9` n'est jamais vrai (un point intérieur est à distance 0): le contrôle de fuite derrière le comptoir et celui de la file derrière le comptoir étaient muets. Seul le banc des plans cassés l'a montré: le relancer après toute retouche du validateur.
- Règle de la caisse qui tient partout: client, file et porte dans un seul champ de 100 degrés (plus petit arc qui les contient). Recette: porte au bout de la façade, file le long d'un mur ou du devant du comptoir, caisse au bout du comptoir côté porte, passe au-delà. Une file qui traverse la salle coupe l'allée de 1,20 m: garder 1,20 m entre sa queue et le mur.
- Foule: brise-bise et allège pleine cachent les assis, pas les gens debout (deux masques d'opacité); vitrine garnie opaque; porte pleine opaque (portes vitrées alignées = enfilade jusqu'à la rue); figurants d'un espace au prorata de sa surface vue. La grille d'un point par mètre trouve des vues qu'on oublie (angle d'un trottoir, coin d'une halle).
- Terrasses: deux rangs vus depuis l'angle du trottoir dépassent 40 personnages; un rang à l'angle, deux derrière des vitrines garnies. Meubles portés à deux (1,20 m): calculer sur la coque seule, pas sur la salle meublée.
- Identifiants de places recommencent à chaque niveau: préfixer le niveau dans les messages, sinon on cherche la mauvaise place.
- Retouches: scripts de remplacement écrits dans le dossier temporaire et lancés avec `python3 -I` (les heredocs Python en ligne se mélangent); le dossier temporaire est partagé avec d'autres membres.

## Clôtures et gros plans (vérifié le 2026-11-03)

- Le segment `fence` (`fence_wood`) ne porte qu'un poteau, à son x local -0,5: ouest en rotation 0, sud en 1, est en 2, nord en 3. Une file de n segments a n poteaux: le constructeur ajoute le dernier en accroche `fence_post` (sans emprise, `poteaux_de_cloture` dans `valider_carte.py`). Deux files posées au milieu des cases (y + 0,5, x + 0,5) ne se rejoignent jamais en angle: fermer le coin par un buisson ou un autre élément, jamais par un trou.
- Page `rendu.html`: `zoom=2` éloigne (zoom arrière) et `zoom=0` rapproche; pour un vrai gros plan, `largeur=<m>` (2 à 36). La caméra suit Camille, posée en `x, y` sans collision: la décaler de l'objet regardé, sinon elle se tient dedans.

## Plan vu du dessus avant la 3D (Aubrune, refonte, vérifié le 2026-11-10)

- Chaîne: `docs/jeux/jeu-1/refonte/carte-aubrune/construire_plan.py` (zones en polygones, eaux et rails en polylignes, graphe de chemins noeuds et arêtes, bâtiments avec porte et noeud d'accès, verrous posés sur des arêtes, quêtes en listes de noeuds) écrit `plan.json`, les SVG, les PNG et injecte les tableaux dans `plan.md` entre des marques `<!-- genere:nom:debut -->`. `controler_plan.py` relit le JSON et le tableau du document; `--eprouver` casse une copie de douze façons.
- Le graphe suffit pour un plan: Dijkstra par acte (arêtes verrouillées retirées) donne à la fois les distances, l'acte d'ouverture de chaque noeud (ni avant ni après celui de sa zone) et la densité d'intérêt (distance de réseau au point le plus proche, échantillonnée tous les 5 m).
- Piège vu au banc d'épreuve: un croisement « franc » de segments ne voit pas un chemin dont un noeud est posé pile sur l'eau ou sur la voie (pont, passage à niveau): ajouter un contrôle par noeud (noeud dans l'eau ou sur la voie sans ouvrage).
- Lisibilité: sur un plan dense, numéroter bâtiments et points d'intérêt et mettre les noms dans un panneau à droite; les étiquettes directes se chevauchent dès 20 éléments. Échelle et nord dans le bandeau du titre, jamais sur la carte.
- Mesurer avant d'écrire: mes longueurs estimées de tête étaient fausses d'un facteur 2 (ligne morte annoncée 160 m, mesurée 93 m). Un sentier linéaire sur une carte de 320 m fait vite moins de 100 m: vérifier la longueur des sentiers de quête dès le premier tracé.

## Plan version 2 vers le lieu (Aubrune, vérifié le 2026-11-10)

- `outils/plan-vers-lieu.ts` exige `version: 1` (littéral): garder `version: 1` et noter la révision du contenu à part (`revision: 2`). Il ne lit ni portes, ni meubles, ni intérieurs: `assembler_lieu.py` (dans le dossier du plan) les ajoute après lui; relancer toujours les deux étapes.
- Un verrou posé à l'intérieur d'une zone (deux nœuds de la même zone) devient un carré de 7 m au centre du verrou: il ne tient que dans un couloir plus étroit, entouré de hors-jeu (un trou dans les zones est plein pour l'outil). Le relevé de fuites de l'outil ne le voit pas: prouver chaque verrou par remplissage sur la grille, avec les verrous des actes suivants et les raccourcis fermés.
- Deux zones du même acte qui se touchent n'ont pas de lisière: le belvédère touchait le tunnel, la Côte touchait la courbe, et V8, V10 se contournaient. Séparer par une bande hors jeu (talus, rocher).
- Le chargeur refuse un point sur une case pleine (banc, lit, eau): poser le point sur la case libre la plus proche (le siège devant le banc, le pêcheur sur la berge). `comptoir-buvette` exige son commerce: ne pas l'employer comme simple comptoir.
- Ajouter un troisième lieu (`aubrune`) casse `tests/donnees.test.ts` et `tests/aides-sauvegarde.ts`, qui supposent deux lieux d'essai, le premier par ordre alphabétique étant le départ.
- Garde-fou: les commandes git qui lisent une autre branche passent seules (`git show <branche>:<chemin>`), sans redirection ni enchaînement; les longs scripts de retouche vont dans un fichier du dossier temporaire, à mon nom (`ld-v2/`), car ce dossier est partagé (un `os.py` d'un autre membre y traîne: toujours `python3 -I`).

## Raccorder un plan à l'histoire écrite (Aubrune version 3, vérifié le 2026-11-10)

- Avant de croire une mesure rapportée par un autre membre, la rejouer sur la carte de SA branche (`git show <commit>:.../carte.json`): les « verrous contournables » de l'auteur venaient d'une carte version 1 restée dans sa branche.
- Un verrou testé seul (les autres de son acte ouverts) ne suffit pas: rejouer chaque état que les fiches permettent (`requires`, chapitres, `after`, effets `remember ...verrou.*` et `unlock_zone` des étapes et des scènes qu'elles jouent), et comparer nœud par nœud grille et graphe. C'est ce qui a montré un nœud (`k1`) posé dans le carré d'un verrou voisin, et un second carré de V4 posé par l'outil sur un autre chemin (une arête verrouillée qui traverse une troisième zone reçoit un carré à chaque passage d'acte).
- Le jeu ouvre une zone quand on en rejoint la moitié des cases (`PLACES.zoneOpenShare`): un verrou interne (V2b) doit laisser plus de la moitié de la zone avant lui si l'histoire ouvre la zone au verrou d'entrée. Un couloir de verrou interne de 7 m pile est mesuré 7,25 par le contrôle: viser 6,5 m.
- Le rendu des grands lieux et sa page de démonstration lisent la sortie de `plan-vers-lieu.ts`, pas `carte.json`: ce qu'on veut voir rendu passe par l'outil (natures de parcelles, `rails`, `kind` des repères), l'assembleur ne doit pas l'écraser.
- `pnpm format:verifier` passe sur `donnees/`: l'assembleur lance prettier sur les fichiers du lieu qu'il écrit.
- Meubles contre un mur sud: rotation 2 (façade au nord, vers la pièce). La porte intérieure se place au droit de la porte du plan: x local = x porte - x emprise - 0,5.
- Images: dessiner tous les tracés, puis les étiquettes de verrou, puis les pastilles (écartées avec un trait si elles gênent), sinon le tracé suivant recouvre les numéros.

## Règle d'accès des intérieurs (Aubrune, vérifié le 2026-11-10)

- Un meuble se pose sur ses cases: centre demi-entier pour une taille impaire, entier pour une taille paire (chaise en (7; 1) = 4 cases bloquées, table 2 x 1 en y 7 = deux rangées). Les deux signalements (épicerie, maison du garde) venaient de là; `controler_plan.py` refuse maintenant un meuble « à cheval » dans un intérieur. Dehors, 49 objets le sont encore (signalé, pas corrigé).
- Le `regard` d'un escalier fixe la case d'arrivée (1 m devant): un escalier dans un coin qui regarde le mur fait arriver hors de la salle, dans le vide de l'annexe (moulin). Vérifier l'arrivée de chaque porte, pas seulement que la porte se touche.
- La case d'une porte ne se traverse pas (y entrer, c'est la passer): un point de quête posé sur le seuil (`po`) s'atteint par les voisines; une porte au milieu d'un mur sud coupe la rangée en deux poches.
- « Attendu dans cet état » = le nœud du graphe le plus proche (même salle, ou dehors) est atteint par le graphe: aucune fausse alerte derrière les verrous. Python (`controler_acces`) et TS (`unreachableStoryElements`) donnent la même liste: les comparer sur les fichiers d'avant (`git archive` dans le dossier temporaire, puis un test vitest jetable `--dir`).
- 2 m pour deux joueurs: blocs 2 x 2 libres, pas diagonal permis (1,41 m entre deux coins). Le seuil d'arrivée d'une porte de façade n'est jamais dans un bloc s'il touche un meuble: laisser libres les deux cases de part et d'autre de l'arrivée.
- Le rendu des intérieurs ne dessine pas les cloisons (`blocked` des intérieurs), seulement le mur d'entourage: une cloison est un mur invisible en jeu (vu sur captures, 2026-11-10).
- Un point d'intérieur vit dans le fichier de sa pièce, pas dans `carte.json`: le chargeur les fusionne (`src/donnees/carte.ts`), un script qui ne lit que la carte doit aussi lire `interieurs/*.json`.
- Captures en jeu d'un intérieur: spec Playwright temporaire dans `tests/e2e/` (sauvegarde `aubrune`, `duo.teleport`, `host.shot`, `LPL2_CAPTURES=<dossier>`), après `npx vite build` et `pnpm --filter @duo/sdk-dev build`; la supprimer ensuite.

## Habiller une pièce (Aubrune, vérifié le 2026-11-11)

- La Petite Ligne 2: caméra par défaut au sud-ouest (`defaultYawDeg: 45`, `towardCamera` x < 0, z > 0): murs nord et est debout, sud et ouest coupés. Objet mural (`deco.layer: wall`, dos à z = -0,5 dans le modèle): mur nord en rotation 0, mur est en rotation 3.
- Aucun « posé sur » pour les objets de la carte (`base: 0` dans `describePlace`): les objets `top` tomberaient au sol. Le logement des joueurs (`simulation/logement/pose.ts`) sait, lui, poser sur une surface.
- Tout objet de 1,3 m et plus (`tallObject`) collé à un mur masque la fenêtre de son pan (emprise de la case + 0,08): elle glisse ou disparaît. Le balai (1,4 m) compte. Relevé jetable des fenêtres: vitest `--dir` qui appelle `describePlace`, `doorSills`, `roomFacades` (avec `new PlaceBuildings(undefined, () => new Promise(() => undefined))`) et `roomPlan`; comparer avant et après.
- Un comptoir d'une case a son client sur la case devant lui (`postes-habitants`): rien de solide là. Toute case pleine dans une rangée de cuisine de 1 m peut enfermer la cuisinière: relancer `controler_plan.py` (règle d'accès) après chaque objet solide.
- Un identifiant d'objet qui finit par `-tapis` passe pour le paillasson d'une porte (`tests/rendu/chargement.test.ts` compte les volumes): nommer un tapis posé `<pièce>-tapis-de-sol`.
- Dehors, seuls les types de `donnees/commun/meubles` se posent; ne pas détourner un type récoltable (`caillou`, `branches`, `tas-de-bois` à brique `gather`). Types de décor sans récolte depuis le 2026-11-11: `rocher(-moussu)`, `gros-rocher(-moussu)`, `buisson` (modèle sans baies), `herbes-hautes`, `tonneau`, `caisse`, `banc-de-ferme`, `tas-de-buches`, `puits`, `abreuvoir-de-pierre`, `baquet`, `cloture`.

## Ce que le rendu lit vraiment (Aubrune, vérifié le 2026-11-11)

- Sol: une nature absente de `GROUND_LOOKS` (`reglages-tuiles.ts`) est peinte en herbe sans bruit (`DEFAULT_LOOK`); le décor ne sème d'arbres que sur `herbe`, `hors-jeu` et `pre` (`tileDecor`). Toute nature inventée par le plan (`sous-bois`, `place`...) est donc un sol d'herbe nu: vérifier la liste avant d'en créer une, préférer un nom déjà connu quand c'est le même sol.
- Repère: sa nature (`kind`) doit avoir une entrée de `LANDMARK_LOOKS` (`reglages-files.ts`, données), sinon il devient arbre ou tour. Les repères ne bloquent aucune case.
- Assises: un banc à `seats: 2` partage sa largeur; chaque joueur prend la première place libre, et deux bancs face à face numérotent en miroir: deux joueurs seuls sur leurs bancs se retrouvent en diagonale (0,5 m). Les données n'y peuvent rien sans meuble à cheval.
- Le garde-fou de la copie isolée refuse les heredocs et les `git` enchaînés: scripts écrits avec Write dans le dossier temporaire, lancés avec `python3 -I`; remplacements de texte comptés (nombre attendu par motif) pour ne rien toucher par accident.

## Décor de fête conditionné (`when`, Aubrune version 7, vérifié le 2026-11-11)

- `when` passe par la chaîne: `fete(...)` dans `construire_plan.py` le met sur l'objet du plan, `assembler_lieu.py` l'écrit (le plan l'emporte; un `when` ajouté à la main dans un intérieur reste conservé). `event_is` en `begun` = du début de la fête à l'aube suivante; `time_is` (minutes, plage qui peut passer minuit) découpe jour et nuit.
- `tests/meubles-conditionnes.test.ts` comparait la liste exacte des absents d'Aubrune: tout décor conditionné l'allonge (filtrer `fete-`). `tests/aides-postes.ts` et la règle d'accès comptent les solides conditionnés comme toujours posés: le pire cas, tous décors à la fois.
- Quai d'Aubrune: rangées 99 à 102 (rect du plan), la rangée 103 est une rue qui le longe; bord = 99 et 100. Au passage à niveau, le sol des cases sur les rails est `route`: tester la distance aux `rails` de la carte, pas seulement la nature `voie`.
- Lampes: `MAX_LAMPS` = 6 (`src/rendu/encre/matiere.ts`, pas `eclairage.ts`), les plus proches du point visé à 26 m; la lumière d'un modèle est dans `assets/commun/decors/decors.json` (`light`), pas dans la fiche du meuble.
- Coût: relire la présence de 66 meubles conditionnés = 40 µs par appel (machine chargée), à chaque pas; `fetes-aubrune.test.ts` dépasse déjà ses 20 s sous charge sans le décor.

## Poser sur un meuble (champ `on`, Aubrune version 6, vérifié le 2026-11-11)

- Le validateur du jeu ne contrôle que la case du porteur; le modèle est plus petit (table 1,40 x 0,80 sur deux cases) et pas toujours centré sur son origine (comptoirs: z de -0,43 à +0,25, le zinc déborde côté client). Lire les bornes dans le GLB: `accessors[POSITION].min/max` transformés par les nœuds (sans lire les sommets).
- Les comptoirs livrés portent déjà leur décor (balance, cafetière, miches, coupons): relever les triangles au-dessus de `top` en vue de dessus (grille de 5 cm, triangles échantillonnés, pas seulement les sommets) et poser sur le reste. L'étagère murale et le vaisselier sont pleins ou trop profonds de 0,1 m: rien dessus.
- Fenêtres: le rendu passe `base + height` au relevé des murs (`moteur.ts`, obstacles de `TiledPlace`) avec l'emprise de la fiche (1 x 1 autour du centre): un objet posé de 1,3 m et plus (pendule ou bouquet sur un comptoir) à 0,75 m d'un mur décale la fenêtre.
- `tabouret-de-ferme` a la brique `sit`: rien dessus. Une `caisse` (plateau 0,60 m) fait un chevet honnête.
- Les tests qui déplacent un meuble pour casser l'accès (`tests/points-de-quete.test.ts`) doivent déplacer aussi ce qui est posé dessus, sinon le validateur refuse le lieu avant la casse.
- Le contrôle « à cheval » de `controler_plan.py` et la grille ASCII des intérieurs doivent ignorer les objets posés (ils ne prennent pas de case).
- Mesure d'une vue `ensemble-*` (lacet 0, largeur W): le sol couvre W x 0,97 W autour du centre; lacet 45: axes (x + y)/racine 2 à l'écran, (x - y)/racine 2 en profondeur. Compter la circulation (route, rue, chemin) comme pleine: on n'y pose rien.

## Trouvailles à ramasser (Aubrune version 8, vérifié le 2026-11-11)

- Une sorte de rive = une ressource + un meuble du même identifiant (brique `harvest`): `collections-aubrune.test.ts` ne compte le butin que des ressources dont un objet de la carte a le type égal à l'identifiant (un `resource` porté par l'objet n'y est pas vu).
- Une ligne de butin rare dont la plage d'heures dépasse celle de la ligne commune devient certaine hors de cette plage (une seule ligne ouverte): mêmes heures pour la commune et la rare.
- La météo se recalcule à chaque pas (`weatherAt`, `simulation/monde`): dans un test de simulation, forcer le climat du lieu par `contentWith` (poids d'un seul temps), pas `world.common.weather`. Le butin ne lit que le temps du moment (« il a plu hier » n'existe pas).
- Les objets n'ont pas de champ de description (seules les pièces de tenue): écrire les phrases dans le document, pas dans la fiche.
- La grève du gué: rangée 129 terre (pierres plates), eau dès 130; « au bord de l'eau » se prouve par une case d'eau voisine, pas par le sol `galets` (`controler_trouvailles.py`).
- L'assembleur réordonne `interieurs/epicerie-rdc.json` à chaque passage (déjà le cas avant moi): `git checkout` du fichier après la chaîne si rien d'autre n'y change.
- Dans `python3 -I -c "..."`, un texte entre accents graves est exécuté par le shell: écrire ces textes avec Edit ou dans un script.

## Poses de la version 9 (Aubrune, vérifié le 2026-11-11)

- L'assembleur conserve les champs ajoutés à la main sur un objet du plan, mais efface un OBJET entier ajouté à la main dans un intérieur (ardoises du chantier dans `maison-rdc.json`): après chaque passe, `git status` sur `interieurs/`, et verser au plan (avec `when`) tout objet d'un autre lot. Un `pourquoi` d'intérieur reste un champ manuel: le retoucher à la main si l'objet bouge.
- Des modèles retirés du manifeste restent cités par des fiches (`tonneau` barrel, `caisse` crate, `banc-de-ferme`, `tas-de-buches`, `puits`, `abreuvoir-de-pierre`): `controler_plan.py` mesure leur forme provisoire sur l'emprise de la fiche (`taille_de`). Le `modele` d'un objet typé du plan est recopié de sa fiche (`_MODELES`).
- Le passage de 2 m des intérieurs se juge par combinaison des faits cités par les meubles conditionnés (`gabarit_par_etat`), pas avec tous posés à la fois.
- Une porte de halte ou de café sur la Grand-Route: la façade est sur la route, rien ne s'y pose; regarder de l'autre côté de la route (herbe rase du café) ou sur le quai.
