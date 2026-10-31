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
