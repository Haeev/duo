# Gauntlet, tour 5: revue adverse du directeur artistique (G6 visuel, G8, G9, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-10-31 |
| Version revue | branche `claude/stoic-lamport-lueey2`, `bc723aa` (budget du dev rendu); `2c15f5b`, arrivé pendant la revue, ne touche que des textes |
| Référence | `main` (`3b6d94c`, fin du tour 4), servie à côté au même cadrage; revues précédentes `tour-04-da.md`, `audit-modeles.md`, `audit-coherence-carte.md` |
| Verdict G6 (visuel) | **oui, mieux qu'avant**, sans régression de lumière ni de lisibilité |
| Verdict G8 | **un défaut grave à corriger avant le report**: le petit toit de la cloche traverse la marquise du quai; un défaut moyen à côté (banc collé au poteau de la marquise) |
| Verdict G9 | cohérence nettement meilleure; le passage à niveau garde une marche de 30 cm en travers de la route |
| Platelage | **planches dans le sens des rails**, en lames étroites, avec ornières; détail plus bas |
| Notes proposées | **pilier 2: 7/10** (inchangé); **pilier 3: 7,5/10** (7 avant) |

## Méthode

- Deux serveurs Vite côte à côte: la branche (port 5231, `bash /tmp/dg3d-budget/serveur.sh`) et `main` dans une copie à part (`/tmp/main-ref`, port 5232). Page `rendu.html?vie=0`, 1366 x 768, rendu normal, mêmes paramètres des deux côtés.
- Plans: place à 19 h (zoom 1 et 2, `x=38.5&y=30.5`), place à 8 h 15, passage à niveau à 10 h (zoom 1, puis zoom 0 orientation 1), quai à 10 h (orientation 1), maisonnette à 19 h (orientation 3) et à 10 h (zoom 0), gué à 10 h. En plus sur la branche seule: la cloche sous deux angles opposés (orientations 0 et 2, zoom 0) et la traversée de service.
- Gros plans recadrés à 200 à 400 % sur chaque élément changé; niveaux de gris (moyenne et écart, image entière et rectangle central de la place, comme aux tours précédents).
- Planches du dev rendu relues: `captures/tour-05/budget/` (zooms, écarts, roues du train, poules, passage à niveau).
- Aucune erreur de console relevée par Playwright sur les 20 captures.

## Mesures

| Plan | `main` (appels, triangles) | Branche | Gris `main` (moyenne, écart; zone de la place) | Gris branche |
|---|---|---|---|---|
| Place, 19 h, zoom 1 | 86, 202 008 | **66, 147 190** | 79, 18,4; 65, 11,8 | 78, 18,5; 64, 11,2 |
| Place, 19 h, zoom 2 | 108, 211 706 | 110, 182 232 | | |
| Place, 8 h 15 | 67, 192 916 | 55, 142 066 | 112, 22,2; 100, 16,2 | 112, 22,2; 100, 16,1 |
| Quai, 10 h | 71, 191 834 | 70, 157 650 | 103, 37,0 | 103, 36,8 |
| Maisonnette, 19 h | 135, 209 566 | 131, 153 732 | | |
| Passage à niveau, zoom 0 | 78, 154 672 | 75, 116 590 | | |

La structure des valeurs ne bouge pas: le budget a été gagné sans perte de contraste. Le gain de triangles est net partout; les appels restent proches du plafond à la maisonnette le soir (131 sur 150), à surveiller.

## G6: visuel « mieux qu'avant » ? Oui

Planche pour le client: `captures/tour-05/place-avant-apres.png` (place à 19 h, `main` à gauche, branche à droite, repères numérotés).

Ce qui est mieux, preuve à l'appui:

1. **Le bourg entier passe au low poly arrondi**, avec les mêmes couleurs: arbres en boules facettées, buissons gonflés, toits fléchis à rives épaisses (halte, maisons), lambrequin festonné de la marquise et du store. Le style est homogène d'un bout à l'autre de la carte, ce qui n'était pas le cas sur `main` (arbres en pics, buissons en cailloux).
2. **Les défauts de construction de l'audit sont corrigés là où je les ai vérifiés en jeu**: vigne qui grimpe le long des poteaux de la tonnelle, toit du puits sur faîtage et chevrons, ponton avec poteaux et escalier vers l'eau, panneau AUBRUNE lettré.
3. **Cohérence du lieu**: banc et cloche sur le quai, banc tourné vers la voie, Jeanne assise sur le banc (sur `main` elle se tient debout dessus, dos à la voie); barrières qui barrent la route; rails sur la voie de garage; fenêtre de la maisonnette côté voie; chemins aux coins arrondis et bouts de chemin arrondis.
4. **Gué**: une vraie rangée de pierres plates irrégulières au lieu de la chaussée pavée de `main`. C'est plus juste, mais pas fini (voir défauts).
5. **Le travail de budget ne coûte rien à l'œil**: la carte des écarts du dev rendu ne montre que l'eau, le vent et les chiffres; les ombres sont toutes là. Les roues du train sans ombre ne se remarquent pas, même à 19 h où les ombres sont longues (les roues touchent les rails, le contact reste lisible). Garder l'ombre des poules était le bon choix: sans elle, elles flottent.

Aucune régression visible par rapport à `main`. Le seul élément moins bon est nouveau: la cloche déplacée sur le quai traverse la marquise (G8 ci-dessous). Il ne fait pas tomber le « oui », car le quai entier reste plus juste qu'avant, mais il doit être corrigé avant le report.

## G8: détails de construction sur ce qui a changé (liste 8.10)

| Élément changé | Points 8.10 | Constat | Gravité | Correction |
|---|---|---|---|---|
| Cloche du quai (déplacée en y 18) | 2 rien ne traverse | Son petit toit rouge passe à travers le bord de la marquise: vu de la vue de jeu, il coupe le lambrequin; vu de l'orientation opposée, il **ressort au-dessus de la tôle** (bloc rouge sur le toit gris). Captures de la branche `head-quai` et `head-cloche-o2` | **grave** (lieu clé, énigme de l'ombre, visible au zoom de jeu) | Sous une marquise, la cloche n'a pas besoin de toit: variante du modèle sans toit, potence plus basse que la sous-face de la marquise. Ne pas la déplacer, l'énigme en dépend (test `lumiere.test.ts` à relancer de toute façon, le toit portait une partie de l'ombre). artiste-3d, 20 min |
| Banc du quai (déplacé, tourné) | 2, 10 | Le bout de l'assise touche le pied d'un poteau de la marquise, au point qu'on les croit l'un dans l'autre (orientation 0, zoom 0) | moyen | Décaler le banc de 0,3 à 0,4 m vers l'ouest, ou le poteau; relancer le test de l'ombre (17 h à 17 h 45). level-designer |
| Platelage du passage à niveau (remonté à 0,30 m) | 1, 2 | Plus aucune traverse ne perce les planches, et les rails se voient enfin de bout en bout: c'est mieux que la caisse de 40 cm de `main` | corrigé | |
| Même platelage | 3, 6, 10 | Le dessus est à 0,30 m et la route à 0: une **marche de 30 cm** se dresse en travers du chemin des charrettes, face verticale bien visible des deux côtés (`head-pn-zoom`). Le champignon du rail dépasse de 7 cm au-dessus des planches | moyen | Voir la décision plus bas: dessus à 1 ou 2 cm sous le champignon, rampe de terre de 1 à 1,5 m sur la route de chaque côté |
| Roues et bielles du train sans ombre | 1 | Rien ne paraît flotter, roues sur les rails | aucun | |
| Plancher de la maisonnette sans ombre | 1 | Rien de visible, ni le jour ni le soir (`head-maison`, `head-maisonz0`) | aucun | |
| Décor découpé en morceaux de 12 m | 8 | Aucune couture, aucun trou ni papillotement aux limites des morceaux, aux deux zooms | aucun | |
| Panneau AUBRUNE | 9 | Lettré, mais à 1366 x 768 le R se lit comme un E, et le poteau gauche passe devant le A | léger | Lettres un peu plus grasses (trait de 2 texels au moins), poteaux aux bouts du panneau, derrière lui |
| Ponton | 1, 8 | Escalier et poteaux corrects; une plaque grise translucide semble posée sur l'eau sous le ponton (`head-place19z2`, gros plan) | léger, à confirmer | Vérifier s'il s'agit de la case de berge ou d'une face en trop |

## G9: cohérence du monde

Au bon endroit, dans le bon sens, à la bonne taille, et pourquoi:

- **Barrières**: lisses en travers de la route, poteau à droite de qui arrive. Juste. La lisse sud tombe au ras du platelage, à moins d'un mètre du rail: acceptable pour une demi-barrière de hameau.
- **Banc et cloche**: sur le quai, banc face à la voie, là où l'on attend le train. Juste, sauf les deux contacts de G8.
- **Voie de garage**: elle a ses rails; la draisine a de quoi rouler. Juste.
- **Maisonnette**: fenêtre côté voie, le garde-barrière voit enfin la ligne. Le **socle reste plus large que la maison d'environ un mètre** (dalle orange qui dépasse sur deux côtés): défaut de l'audit de cohérence, toujours ouvert.
- **Chemins**: coins arrondis, le sentier du jardin rejoint le passage à niveau. Juste.
- **Passage à niveau**: la marche de 30 cm contredit son rôle (route des charrettes de grumes). C'est le seul point G9 nouveau qui ne tient pas.
- **Place**: toujours un aplat gris uni de 18 x 11 m pour un hameau de quatre habitants; ni pavés en appareillage ni terre battue. Ouvert depuis le tour 4.
- **Rivière**: les berges restent des quais droits à angle droit (la face est maintenant brune au lieu de grise), et le gué montre des pierres posées sur un fond gris sec, avec quelques cases plus sombres au carré: on ne voit pas l'eau passer entre les pierres (bible, 8.7).

## Décision sur le platelage du passage à niveau

**Les planches vont dans le sens des rails**, pas en travers.

Pourquoi:

1. **Elles reposent sur les traverses.** Les traverses sont posées en travers de la voie, tous les 60 cm environ. Une planche en long franchit plusieurs traverses et s'y cloue: la structure tient. Une planche en travers tomberait entre deux traverses, portée par rien, ou sur une seule.
2. **Les ornières l'imposent.** Le boudin des roues passe le long de la face intérieure de chaque rail: on laisse là une fente de 6 à 8 cm, parallèle au rail. Des lames en long la dessinent naturellement; des lames en travers devraient être entaillées une à une.
3. **Lecture**: les lignes des planches prolongent celles des rails, la voie se lit d'un trait à travers la route, et la route se lit par les barrières et la rampe. Le damier actuel (une couleur par case d'un mètre) fait au contraire trois carrés de bois qui ne disent ni planche ni route.

Spécification pour le dev rendu (ou l'artiste 3D si l'on en fait un modèle):

- Lames de 20 à 25 cm de large, dans l'axe des rails, sur toute la largeur de la route (3 m) et non au gabarit des cases.
- Trois zones: entre les rails, et une bande de 40 à 50 cm à l'extérieur de chaque rail. Ornière sombre (case `wood_dark` ou plus sombre) de 6 à 8 cm le long de la face intérieure de chaque rail.
- Deux tons de bois de la palette, alternés **par lame** (pas par case), écart de gris de 8 niveaux au plus, comme les pavés; une lame sur six ou sept un peu plus claire suffit à casser la régularité.
- Dessus à 1 ou 2 cm sous le champignon du rail (vers 0,35 m), pas 7 cm en dessous.
- Côté route, une **rampe de terre** de 1 à 1,5 m de chaque côté, qui monte de 0 à la hauteur du platelage; les bouts des lames chanfreinés (1,5 à 2 cm, un segment). Plus de face verticale en travers du chemin.
- La traversée de service (x 50) suit la même règle, sur sa largeur d'un mètre.
- Budget: une quarantaine de boîtes fusionnées dans le morceau de décor du passage, quelques centaines de triangles, aucun matériau nouveau.

## Notes proposées

### Pilier 2, vie du monde et animation: 7/10 (inchangé)

Ce qui progresse: les personnages s'assoient sur les bancs au lieu de s'y tenir debout, Jeanne attend le train face à la voie; le personnage près de la cloche lève le bras vers elle (vu sur une image fixe, geste non suivi dans le temps). Ce qui manque toujours, et qu'un joueur remarque en quelques minutes: **aucune petite faune** hors des poules (ni oiseaux, ni papillons, ni lucioles; les oies du jour ne sont que du texte), et l'eau du gué ne coule pas entre les pierres. Rien dans ce tour ne justifie un demi-point de plus: je ne le donne pas.

### Pilier 3, direction artistique: 7,5/10 (7 avant)

Le low poly arrondi appliqué à tout le bourg, la correction de la plupart des défauts de construction de l'audit, les chemins courbes et un quai cohérent font un gain réel et homogène, sans perte de lisibilité (gris inchangés). Ce qui empêche le 8: la place reste un aplat gris nu au centre de l'écran, les berges restent un canal à angles droits, le gué ne montre pas son eau, le platelage fait une marche, et un défaut de traversée visible (la cloche) est entré avec ce tour. Le 8 est à portée si la place et les berges sont traitées au prochain tour.

## Défauts restants, par gravité

| Gravité | Défaut | Qui | Effort |
|---|---|---|---|
| Grave | Toit de la cloche à travers la marquise, visible au-dessus de la tôle | artiste-3d (variante sans toit), puis test de l'ombre | 20 min |
| Moyen | Platelage: marche de 30 cm, damier par case, planches en travers (spécification ci-dessus) | dev rendu | 60 à 90 min |
| Moyen | Place: aplat uni; pavés en appareillage devant l'épicerie et autour du puits, terre battue ailleurs (bible 8.7, audit de cohérence) | tech-artist, dev rendu, level-designer | 120 min |
| Moyen | Berges en quais droits à angle droit; gué sans eau entre les pierres, cases sombres au carré sur le gué et damier sur la bande de berge | dev rendu, tech-artist | 120 à 180 min |
| Moyen | Banc du quai collé au poteau de la marquise | level-designer | 15 min et test de l'ombre |
| Moyen | Socle de la maisonnette plus large que la maison d'un mètre | artiste-3d | 20 min |
| Moyen | Petite faune absente (pilier 2) | artiste-3d, tech-artist, dev rendu | 240 min |
| Léger | Panneau AUBRUNE: R lu comme un E, poteau devant le A | artiste-3d | 15 min |
| Léger | Plaque grise translucide sous le ponton, à confirmer | dev rendu | 10 min |
| Léger | Appels de dessin à 131 sur 150 à la maisonnette le soir: marge mince | dev rendu | à surveiller |

## Non vérifié

- Daltonisme: aucune des captures ne montre les deux joueurs côte à côte (page de rendu seule, un joueur); les tenues n'ont pas changé depuis la revue de l'arrondi des personnages.
- Lisses levées (train absent) et passage à niveau de nuit.
- Fluidité réelle sur le PC de référence: les chiffres d'appels et de triangles sont ceux de SwiftShader, à confirmer chez le client.

## Captures

- Planche pour le client: `docs/jeux/jeu-1/gauntlet/captures/tour-05/place-avant-apres.png`.
- Preuves des défauts G8: `docs/jeux/jeu-1/gauntlet/captures/tour-05/da-cloche-marquise.png` (vue de jeu et vue opposée) et `da-platelage-marche.png` (gros plan du passage à niveau).
- Captures de travail de cette revue (non versionnées, dans `/tmp/da-t5/cap/`): `main-*` et `head-*` pour `place19`, `place19z2`, `matin`, `passage`, `passage0`, `quai`, `maison`, `maisonz0`, `gue`; `head-cloche-o0`, `head-cloche-o2`, `head-service`.

## Contrôle après correctifs

| Champ | Valeur |
|---|---|
| Version contrôlée | `f0ec1b2`, puis `404fbe5` arrivé pendant le contrôle (Firmin en x 27,5 ; y 18,5, Jeanne posée à sa place du banc dans la simulation). Les captures de l'ombre à 17 h 30, du bout ouest, des bancs et de la draisine sont faites sur `404fbe5`; celles des lisses et du platelage sur `f0ec1b2` (fichiers non touchés depuis) |
| Verdict G6 (visuel) | **oui**: mieux qu'avant, aucune régression |
| Verdict G8 | **oui**: plus rien ne traverse sur les éléments corrigés, en jeu; restent des défauts légers |
| Verdict G9 | **oui**: chaque élément du passage à niveau et du bout ouest du quai est à sa place et dans le bon sens; une réserve de lisibilité sur l'ombre de la cloche (moyen, non bloquant) |
| Bloquant pour `main` | **aucun** |

### Méthode

- Page `rendu.html?vie=0&stats=0`, 1366 x 768, rendu logiciel. Pour les lisses, capture après 12 s de page: au bout de 1,5 s (ta méthode, et mon premier essai) le bras est encore en mouvement, parti levé (`GATE_OPEN`, demi-vie 0,35 s, image lente en rendu logiciel).
- Géométrie mesurée dans la scène elle-même (boîtes englobantes des bras `level_crossing_gate_arm`, poteaux de la marquise lus dans `bourg.glb`), direction du soleil lue dans `DaylightRig` aux heures de l'énigme, puis positions projetées à l'écran par la caméra du moteur et marquées sur les captures.
- La page de rendu ne place pas les habitants selon l'heure: Firmin reste à `quay_bell`, Jeanne au point `quay_bench` (vie=0) ou se promène sur la place (vie=1, et la caméra suit alors le joueur 1 près de la maisonnette, loin du banc). À 17 h 30, Jeanne est en vrai à la berge: j'ai donc gardé vie=0 et masqué son maillage pour les captures de l'ombre.
- Tests relancés sur `404fbe5`: `npx vitest run tests/bancs-recette.test.ts src/rendu/lumiere.test.ts src/rendu/voie.test.ts`, 3 fichiers, 28 tests réussis.

### 1. Lisses du passage à niveau: au bon endroit, dans le bon sens

**Infirmé**: aucune lisse n'est dans l'axe de la voie. Celle que tu vois sur ta capture (x 19, y 10, zoom 0, 11 h, train arrivant, vue 0) est la lisse sud, **parallèle aux rails, ce qui est juste**: une barrière barre la route en travers, donc dans le sens des rails, et à côté de la voie, jamais dessus.

Mesures dans la scène (x et y de la carte, hauteur en m):

| État | Lisse nord (poteau 16,5 ; 11,5) | Lisse sud (poteau 20,5 ; 15,5) |
|---|---|---|
| Train arrivant, bras posé | x 16,07 à 20,5, y 11,4 à 11,6, hauteur 0,8 à 1,2 | x 16,5 à 20,93, y 15,4 à 15,6, hauteur 0,8 à 1,2 |
| Train à quai ou parti | verticale, hauteur 0,6 à 5,0 | verticale, hauteur 0,6 à 5,0 |

- La route va du nord au sud en x 17 à 20; la voie va d'ouest en est en y 12 à 15. Chaque lisse couvre toute la largeur de la route (3 m), hors de la voie: au nord à 0,4 m du ballast, au sud à 0,5 m.
- Poteau à droite de qui arrive (à l'ouest pour qui descend du nord, à l'est pour qui monte du sud), contrepoids de 0,4 m de l'autre côté du pivot, hors de la route. Juste.
- Pourquoi l'illusion: en vue 0, la lisse sud, à 1 m de haut et à 0,5 m du ballast, se projette à l'écran par-dessus le ballast et semble suivre la voie. En vue 1, les deux lisses baissées se lisent sans ambiguïté en travers de la route, de part et d'autre de la voie.
- Levées (train à quai, train parti): verticales en vues 1, 2 et 3, rien ne traverse. Le bras se baisse et se relève en douceur (test `voie.test.ts`).

Planche: `captures/tour-05/controle-lisses.png` (1: ta vue, bras posé; 2: vue 1, les deux bras baissés; 3: vue 1, levés, train parti; 4: vue 2, levés, train à quai).

### 2. Ombre de la cloche sur le banc, et banc contre le poteau

Géométrie (soleil de `DaylightRig`, cloche centrée en x 30,05, hauteur 2,1 m; banc de x 32,05 à 33,95, y 18,27 à 18,83):

| Heure | Hauteur du soleil | Ombre du centre de la cloche, à hauteur d'assise |
|---|---|---|
| 17 h 00 | 37,9° | x 32,18: bout ouest de l'assise |
| 17 h 22 | 27,5° | x 33,24: milieu de l'assise |
| 17 h 30 | 24,0° | x 33,78: bout est de l'assise |
| 17 h 45 | 19,0° | x 34,86 à l'assise, donc sur le dossier (vers x 33,7 à 0,85 m) |

Le fait géométrique est juste et le test le garantit. **La lecture à l'écran, elle, ne tient pas**:

- au zoom 0, la tache de la cloche sur l'assise fait 2 à 4 pixels de large (à 17 h, assise à l'ombre 91, 49, 2 contre 142, 79, 11 au soleil: le contraste suffit, c'est la taille qui manque), et elle se confond avec l'ombre propre du banc et celles des poteaux de la marquise;
- au zoom 1, le zoom par défaut, on ne la voit pas du tout;
- à 17 h 45, la lumière baisse et la tache disparaît;
- Firmin en x 27,5: son ombre file vers l'est le long de y 18,5 et s'arrête vers x 31,4 à 17 h 30, avant le banc. Elle ne se mêle plus à celle de la cloche sur le banc; elle rejoint seulement celle du poteau sur les dalles, ce qui ne gêne pas.

Ce qui sauve l'énigme: l'anneau qui pulse avec ses étincelles à `bell_shadow_spot` (`effets.ts`, par soleil, pendant la fenêtre) montre où bêcher. Le jeu reste donc jouable; l'ombre, elle, reste une indication que le joueur ne peut pas vérifier de ses yeux. Gravité: **moyen, non bloquant** (c'est déjà mieux que `main`, où l'ombre se perdait sous la marquise).

**Banc et poteau**: crédibles, je garde le banc de 1,9 m. Poteaux de la marquise en x 31,5 et 34,5, y 17,9 (rayon du pied 0,13 m); le banc est entre eux, 0,42 m de jeu à chaque bout et 0,24 m en retrait de la ligne des poteaux, sous le bord du toit, face à la voie: on s'y assoit à l'abri et on voit le train entre deux poteaux. En vue 0, le poteau ouest semble sortir du bout du banc, mais c'est la projection: 0,4 m d'écart réel, et les autres vues le montrent. Un banc de 1,5 m n'apporterait presque rien à l'écran, et deux joueurs assis y tiendraient serrés.

Planche: `captures/tour-05/controle-ombre-cloche.png` (17 h, 17 h 22, 17 h 30, 17 h 45 au zoom 0, cercle à la position calculée; 17 h 30 au zoom 1).

### 3. Bout ouest du quai (G9): chaque élément et pourquoi

| Élément | Où | Pourquoi c'est juste |
|---|---|---|
| Rampe d'accès ouest | x 21, côté passage à niveau | On arrive au quai par la route du passage à niveau (trajet de Basile en x 18,5 puis 21,5): l'accès est là où l'on vient |
| Lampadaire ouest | 22,5 ; 18,5, au coin du quai | Il éclaire la rampe et l'entrée du quai le soir, sur le chemin de la maisonnette |
| Firmin | 27,5 ; 18,5 | Entre l'accès et sa cloche, il accueille qui arrive et garde la cloche à portée de main (2 m) |
| Cloche | 29,5 ; 18,5, hors de la marquise | Une cloche de quai se sonne à découvert pour qu'on l'entende le long de la voie; le bout de l'abri est sa place naturelle. Elle ne touche plus la marquise (bras jusqu'à x 30,25, toit à partir de x 30,95) |
| Banc | 33 ; 18,5, sous le bord du toit, face à la voie | Abrité et tourné vers le train, 3,5 m à l'est de la cloche pour l'énigme |
| Caisse | 35,5 ; 18,5, sous la marquise | À l'abri, au milieu du quai, près de la porte de la voiture |
| Tableau | 41,5 ; 18,5, sous la marquise | Lu à l'abri, à côté de la caisse et de la commande |
| Massifs | 37 et 38 ; 20,5, puis 22,5 et 23,5 ; 20,5 | Dans la bande d'herbe entre les deux allées qui montent de la place: ils encadrent les allées sans les couper; à l'ouest, ils tiennent le pied du lampadaire |

Rien à déplacer. Planche: `captures/tour-05/controle-bout-ouest.png`.

### 4. Platelage, draisine garée, deux joueurs assis

- **Platelage**: conforme à la spécification sur l'essentiel. Lames en long, deux tons alternés par lame, dessus 1,5 cm sous le champignon, rampes de terre de 1,25 m des deux côtés, plus de marche. Deux écarts légers (tableau ci-dessous): les ornières se lisent comme des bandes gris clair d'environ 20 cm au lieu d'une fente sombre de 7 cm, et les flancs des rampes sont des triangles verticaux qui pointent comme des lames sur le ballast (même chose au bout ouest du quai et à la traversée de service).
- **Draisine garée**: sur les rails de la voie, à l'est de x 50, les roues sur les rails, dans l'axe. Juste. Planche: `captures/tour-05/controle-platelage-draisine.png`.
- **Deux joueurs assis** (`scene=banc-quai`): côte à côte, tournés vers la voie, à hauteur d'assise, les pieds au sol, sans se chevaucher; en vue 3, on les voit à travers la marquise grâce au tramage. Gris, deutéranopie et protanopie: les deux se distinguent par la coiffure (sombre ou claire) et la veste (bleue contre olive, qui deviennent bleue contre beige). Planches: `captures/tour-05/controle-assis.png`, `controle-assis-gris-daltonisme.png`.
- **Page de rendu seulement**: le matin, Jeanne y est posée au centre du banc (point `quay_bench`) et se dessine debout à travers le dossier (`controle-jeanne-page-rendu.png`, 9 h et 11 h). Dans le jeu, la simulation la pose à sa place de repos et elle s'assoit (`404fbe5`, test B-T5-07 réussi). Mais cette page sert à toutes les captures de revue: à corriger pour qu'elle cesse de tromper les relecteurs. Dans `scene=banc-quai`, Jeanne est placée par rapport au point `quay_bell` déplacé: elle tombe maintenant au bord sud du quai (29,1 ; 19,1).

### Défauts restants, par gravité

| Gravité | Bloquant pour `main` | Défaut | Correction recommandée | Propriétaire |
|---|---|---|---|---|
| Moyen | non | Ombre de la cloche sur le banc illisible au zoom 1, 2 à 4 px au zoom 0 | Cloche plus grosse: 0,55 m de large au lieu de 0,40, bras de potence allongé d'au plus 0,1 m (bout du bras sous x 30,9 pour rester hors de la marquise). Relancer `lumiere.test.ts`. Critère: tache d'au moins 10 px de large sur l'assise au zoom 1 à 17 h 22 (1366 x 768) | artiste-3d |
| Léger | non | Flancs des rampes en triangles verticaux (passage à niveau, traversée de service, bout ouest du quai) | Flancs en talus: pente d'environ 1 pour 1 vers l'extérieur, ton `bank`, au lieu d'une face verticale | dev (rendu) |
| Léger | non | Ornières en bandes gris clair d'environ 20 cm | Fente de 7 cm (`flangeway`) au ton `shadow`, sans bande de ballast visible entre la lame et le rail; vérifier que `grooveTone` s'applique au fond | dev (rendu) |
| Léger | non | Page de rendu: Jeanne debout à travers le dossier le matin; dans `banc-quai`, posée au bord du quai | Dans `etat-exemple.ts`, placer les habitants comme `placeVillagers` (place de repos par `villagerRestSpot`); dans `banc-quai`, un point fixe sur le quai (30,5 ; 17,5) | dev (rendu) |
| Léger | non | Lisse sud baissée à 0,5 m du ballast: en vue 0, elle se projette sur la voie | Aucune correction de modèle. Facultatif: écarter les deux barrières de 0,5 m de la voie (y 11 et y 16) si la route le permet | level-designer |

### Non vérifié

- Le jeu complet (interface et simulation) aux heures de l'énigme: la page de rendu ne place pas les habitants selon l'heure. Jeanne assise le matin n'est vérifiée que par le test de recette, pas par une capture du vrai jeu.
- La lisse baissée pendant que le train franchit le passage avec un joueur dessus (sujet de simulation, hors de cette revue).
- Le rendu sur le PC de référence: toutes les captures viennent de SwiftShader.
