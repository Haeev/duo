# Gauntlet, tour 6: revue adverse du directeur artistique (G6 visuel, G8, G9, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-10-31 |
| Version revue | branche `claude/stoic-lamport-lueey2`, `9669b93` (arbre principal servi par `/tmp/dg3d-budget/serveur.sh`, port 5231) |
| Référence | revue du tour 5 (`tour-05-directeur-artistique.md`), planches du tour 6 (`captures/tour-06/`) |
| Verdict G6 (visuel) | **oui, mieux qu'avant**: le bourg a enfin sa faune, et quatre moments sur six se lisent au zoom de jeu |
| Verdict G8 | **non**: la mésange a un bandeau et des ailes en planches qui dépassent (20 min de reprise); deux défauts légers à côté |
| Verdict G9 | **non**: l'échelle de Basile ne se lit pas en vue par défaut (mise en scène contraire à la règle de caméra de la carte), le nichoir à 1,84 m s'atteint sans échelle, le héron se pose derrière les arbres |
| Bloquant pour `main` | échelle de Basile (G9), mésange (G8), libellé « Parle avec h145 » (texte provisoire à l'écran) |
| Notes proposées | **pilier 2: 7,5/10** (7 avant); **pilier 3: 7,5/10** (inchangé) |

## Méthode

- Page `rendu.html?vie=0&manuel=1&moment=<id>&t=<s>` (1366 x 768, rendu normal), `phase=attente|apres`, zooms 0, 1 et 2, orientations 0 à 3. Sans `vie=0`, la promenade de la démo déplace le joueur 1 et la caméra quitte le moment: piège noté pour les prochaines captures.
- Essais de mise en scène de l'échelle dans une **copie jetable** de l'arbre (`/tmp/da-t6/proto`, serveur à part sur le port 5241): carte, `moments.json` et places de spectateurs de la page de démo modifiés là seulement. Rien n'est modifié dans le dépôt.
- Projection de la caméra par défaut (regard vers le nord-ouest, élévation 35,26°): deux points sont sur la même colonne de l'écran quand leur `x - y` est égal; l'écart horizontal à l'écran vaut `Δ(x - y) / √2` mètres. Calcul fait sur les points de `halte.json`.
- Relu: planches `faune-*`, `moment-*`, `interface-*`, `retouches-*`, `banc-quai-*`; niveaux de gris (`-colorspace Gray`), deutéranopie et protanopie (matrices de Machado 2009) sur les gros plans des moments; L* CIELAB des cases nouvelles de `palette.py` contre leurs fonds.
- Aucune erreur de console relevée par Playwright sur les 14 captures faites.

## Point 1: l'échelle de Basile se lit-elle ? Non

Planches: `captures/tour-06/da-echelle-lecture.png` (gros plans x2) et `da-echelle-plein-ecran.png` (plein écran).

Constat, au zoom 1 en orientation 0 (celle de tout début de partie):

- Les deux places sont `ladder_hold_east` (52,36 ; 6,42) et `ladder_hold_west` (51,58 ; 5,64): `x - y` vaut 45,94 pour les deux. **Les deux joueurs sont exactement sur la même colonne de l'écran**, l'un caché derrière l'autre. Basile en haut de l'échelle (51,93 ; 6,07) est à 45,86: même colonne, juste au-dessus. D'où le « tas » vu sur la planche.
- L'échelle penche vers le nord-est, perpendiculairement au regard: on la voit **de profil**, un trait oblique sans barreaux. Le nichoir, le pivot de 25° et les coups de marteau tiennent dans 5 à 10 pixels, collés au bord du toit de la remise.
- Ce n'est pas la remise qui cache tout (au zoom 0, rien n'est derrière elle); c'est l'alignement. La remise aggrave: tout ce qui est au sud-est du chêne à moins de 3 m tombe derrière son toit de 4,5 m. La carte le dit elle-même (`camera.regle`: « lieux importants au sud-est de ce qui est haut »): ici, le lieu important est au nord-ouest d'un bâtiment haut.
- La preuve que la mise en scène est la cause: au même instant en orientation 1 (caméra perpendiculaire à l'échelle), tout se lit, échelle de face, Basile de dos entre les deux joueurs (gros plan 2 de la planche).

Ce que j'ai essayé (copie jetable):

| Essai | Résultat |
|---|---|
| Échelle contre la face ouest, places nord et sud (fiche d'origine) | Mieux, mais Basile en haut et le joueur du nord restent sur la même colonne (écart 0,13 m): deux corps l'un sur l'autre. Et la branche ouest du chêne passe dans l'échelle (`faune-echelle-ouest.png`). Rejeté |
| Caméra recadrée pendant l'apogée | Un recentrage ne sépare pas des corps alignés dans l'axe du regard; tourner la caméra du joueur sans qu'il le demande lui retourne aussi ses touches Z Q S D. Rejeté |
| **Chêne déplacé de 2 m vers l'ouest, en (50,5 ; 5,5), échelle contre la face sud-est** | **Se lit en vue par défaut**: échelle de face, barreaux visibles, Basile de dos qui grimpe, un joueur de chaque côté (écart à l'écran de 1,16 m), rien derrière la remise (gros plan 4 et plein écran) |

### Correction retenue (bloquante pour `main`)

Propriétaire: **level-designer** (`outils/construire_carte_halte.py`, rien à la main), puis **dev gameplay** (images clés de `moments.json`, places de la page de démo `MOMENT_SPOTS`), contrôle par le directeur artistique.

1. `tree_oak_01` en (50,5 ; 5,5), `rect` (50 ; 5). Pourquoi: c'est le seul moyen de dégager la face sud-est du tronc (celle que voit la caméra par défaut) de la remise; le chêne reste « le grand chêne près de la remise », isolé dans la bande d'herbe entre la maison de Firmin et la remise. À vérifier par le level designer: le houppier ne doit pas entrer dans le toit de la maison de Firmin (mur est à x 48, 2,5 m du tronc; sur mes captures le houppier passe au-dessus du pignon sans le toucher, mais je ne l'ai pas mesuré). Si contact, 50,7 au plus: au-delà de 50,8, le joueur du nord-est repasse derrière la remise. Déplacer aussi `roe_deer_graze` (P1, il tomberait sous le tronc).
2. Échelle contre la face sud-est, penchée vers le nord-ouest: `ladder_foot` (51,23 ; 6,23), cap 315; tête contre l'écorce vers (50,68 ; 5,68).
3. Places de part et d'autre du pied, mains au montant: nord-est (51,64 ; 5,82), cap 225; sud-ouest (50,82 ; 6,64), cap 45. Basile derrière le pied, `nest_oak_basile` (51,58 ; 6,58), cap 315; montée de 0,053 m en x et en y par barreau vers le tronc.
4. Nichoir **sur la face est** (à la droite de Basile, comme le veut `reach_up`, main droite), `regarde` est; chicot repris en conséquence (sur la face sud, sous le houppier). Pourquoi l'est: de la caméra par défaut on le voit de trois quarts, son pivot de 25° se lit; son trou donne sur l'herbe entre le chêne et la remise, à l'écart du chemin.
5. **Hauteur du nichoir: centre de la caisse à 2,25 m** (clou vers 2,43 m), contre 1,84 m aujourd'hui. Pourquoi: Basile mesure 1,74 m et atteint 2,15 m bras levé; à 1,84 m il redresse le nichoir sans échelle, et toute l'histoire (« tenez bon, là en bas ») sonne faux. À 2,25 m, ses mains en haut des trois barreaux (pieds à 0,84 m) arrivent à hauteur d'épaule: le geste et le marteau sont naturels, la chorégraphie de 8,2 s ne change pas. Chicot relevé d'autant (2,60 m). Si le houppier cache alors le nichoir au zoom 1, le **dev rendu** étend le tramage qui existe déjà devant le joueur 1 au houppier de `tree_oak_01` pendant l'attente, l'apogée et l'après des moments `ladder` et `tits`.

Critère d'acceptation (capture d'orientation 0, zoom 1, t = 0,1 s, 2,85 s et 7,7 s): les trois personnages séparés à l'écran (aucune silhouette sur une autre au-delà d'un bras), l'échelle vue de face avec ses barreaux, le nichoir entier visible et son pivot lisible, aucun personnage recoupé par la remise, aucun houppier dans un toit. Planche à refaire par le dev gameplay; je la relis.

## Point 2: le héron

Planche: `da-heron.png`.

- **Taille**: 0,95 m, la moitié d'un joueur, comme sur la planche d'échelle (`faune-echelle.png`). C'est juste et je ne l'agrandis pas: il paraît petit parce qu'il se fond, pas parce qu'il est petit.
- **Il se fond**: dos `heron_grey` #9BA2A6 à L* 66, galets `rock` L* 64, eau `water` L* 66; au zoom 2, en attente, il a la taille et la valeur d'un galet. Ce qui le fait lire, c'est le cou blanc (L* 93) et le bandeau noir, visibles surtout en alerte (gris et daltonismes: `da-gris-daltonisme.png`, ligne 2).
- **Pattes « dans 10 cm d'eau »**: le gué est rendu sec (pierres posées sur un fond sable et gris, sans lame d'eau). La lame d'eau autour de ses pattes, prévue pour le tech-artist (conception, section 1.7), n'est pas livrée. C'est à la fois un défaut de cohérence et la meilleure aide à la lecture: un anneau clair (`water_foam`, L* 92) qui s'ouvre à chaque pas et à chaque coup de bec.
- **Posé derrière les arbres**: `heron_rest_far` (29,5 ; 42,3) est sur la grève sud; la caméra regarde vers le nord-ouest, donc les arbres de la rive sud sont entre elle et lui. Même règle de caméra enfreinte que pour l'échelle.

Corrections (non bloquantes, à faire avant la bêta):

| Correction | Pourquoi | Qui |
|---|---|---|
| `heron_rest_far` vers (31,5 ; 38,5), sur la langue de sable de la rive nord (cases `b`, x 27 à 34, y 38); images clés 4,4 s (29,3 ; 38,9 ; 1,0) et 5,2 s (31,5 ; 38,5 ; 0) | Toujours en aval (vers l'est), sur une grève, à 3,9 m du banc de la berge (héron habitué aux gens); seule de l'eau entre lui et la caméra, visible au zoom 1 depuis la berge nord. Le départ vers le sud-est reste valable | level-designer (point), dev gameplay (`moments.json`) |
| Lame d'eau sur le gué et anneaux aux pattes du héron | Cohérence (on doit voir l'eau passer entre les pierres, bible 8.7) et lisibilité | tech-artist |
| Ailes repliées au corps dans `heron_idle` et `heron_rest` | Repliées, elles forment deux plaques qui débordent du dos en caisson (`faune-4angles-heron.png`, vues 1 et 4) | artiste-3d |

## Point 3: lisibilité des bêtes au zoom 1 et 2, de jour et de nuit

| Bête | Zoom 1 | Zoom 2 | Gris et daltonismes | Avis |
|---|---|---|---|---|
| Renard (soir) | se lit: orange sur vert, il bouge, il saute | une tache orange de quelques pixels, encore trouvable | **disparaît**: `fox_red` L* 54 contre l'herbe du soir; en deutéranopie et protanopie, olive sur olive (`da-gris-daltonisme.png`, ligne 1). Seuls le bout de queue et le plastron blancs restent | lisible par la teinte et le mouvement seulement; à reprendre (léger) |
| Oies | posées et à l'envol, très lisibles (neuf formes, gerbes); en vol au-dessus de la place, ce sont surtout **les ombres** qui se lisent | la volée se lit par ses ombres | `goose_grey` L* 57 égale le pavé sombre (L* 57): le dos se perd au-dessus de la place | acceptable: le V et les ombres portent la lecture |
| Mésanges (x 1,5) | 6 à 8 pixels: un point bleu et jaune qui va et vient; le moment se lit surtout par le son | invisibles | | exception x 1,5 juste; plus grande, elle dépasserait le nichoir (0,15 m de large). La mésange passe un trou de 28 mm à cette taille: accepté, l'entrée dure 0,3 s à 6 pixels |
| Héron | voir point 2 | | | |
| Vers luisants (nuit) | excellents: points vert-jaune avec leur petite flaque de lumière, le front qui s'allume se suit | l'amas reste lisible | très clairs en gris (L* 89 sur une nuit sombre) et sous les deux daltonismes | rien à reprendre; couleur #B8F05A validée |

Échelle juste à côté des personnages (`faune-echelle.png`): héron à mi-hauteur d'un joueur, renard au genou, oie couchée au mollet, nichoir de 25 cm: proportions crédibles. Échelle de 3 m: plus haute que nécessaire pour un nichoir à 2,25 m, mais une échelle de verger fait 3 m, et sa tête doit dépasser la prise des mains: je la garde.

Correction du renard (non bloquante, artiste-3d, 15 min): `fox_red` éclairci vers L* 60 (proche de #D4733A) et plastron et bout de queue blancs agrandis d'un tiers, pour un écart de valeur avec l'herbe du soir qui tienne sans la teinte.

## Point 4: l'interface des moments et des secrets

Cohérente avec l'identité: même carte crème à filet brun, mêmes titres à empattements, mêmes boutons et focus bleu, pastille sous l'horloge alignée sur elle. Le billet de la confidence (coin corné, filet plus sombre et ombre portée) et la fiche secrète (liseré rouge chez l'informé, cadre en pointillés chez l'autre) forment un langage clair: plein = tu sais, pointillé = l'autre sait. Icônes `hen`, `ui-eye`, `ui-whisper`: même trait, même grille que le reste du jeu, lisibles à 16 px. Bulle « Cot… cot ? » amusante et bien placée. À 1366 x 768 en 100 et 150 %, rien ne déborde dans les captures relues; à 150 %, la confidence tient sans défiler.

| Gravité | Défaut | Correction | Qui |
|---|---|---|---|
| **Bloquant** (texte provisoire à l'écran) | Pendant l'appel d'une poule, la carte du partenaire affiche « **Parle avec h145** » (identifiant de la poule), `interface-appel-poule-informe-100.png`, gros plan `da-interface-h145.png` | « Appelle une poule » (ou « Parle à la poule rousse », avec sa couleur, jamais son nom: c'est le secret) pour une conversation `hen_call` sans habitant; test qui interdit un identifiant brut dans ce libellé | dev interface |
| Léger | Même étiquette « Rien que pour toi » en deux styles: contour rouge (confidence, fiche secrète) et contour noir (envie du jour) | Un seul style, ou une autre étiquette pour l'envie du jour (« Ton envie »): le rouge reste au secret à transmettre | ux-ui-designer, dev interface |
| Léger | À 150 %, la boîte « Appeler une poule » couvre la poule appelée et coupe le titre du prochain objectif à mi-hauteur | Masquer le panneau d'objectif pendant une conversation, comme les autres panneaux; boîte un peu plus basse ou caméra décalée vers le haut | dev interface |
| À vérifier en jeu | « Sacha est déjà en place » sous l'horloge pendant que sa carte dit « En chemin » (`interface-moment-pose-100.png`): peut-être un reste du scénario figé | Statut du partenaire « Regarde le héron » (ou le nom du moment) quand il remplit sa part | dev interface |
| Léger | Carnet de l'informé: le titre « Coups de main » coupé sous les onglets au défilement | Marge haute de défilement égale à la hauteur d'un titre | dev interface |

## G6 visuel: « mieux qu'avant » ? Oui

1. **La faune existe**: héron, oies, renard, mésanges et vers luisants, chacun avec ses clips et une raison d'être là. Le manque cité au tour 5 (« aucune petite faune hors des poules ») est comblé dans les moments.
2. **Quatre moments se lisent au zoom de jeu**: l'envol des oies (avec leurs ombres en V sur la place), le renard qui mulote puis file le long de la voie, les vers luisants qui s'allument en front, l'envol du héron. Les deux autres (échelle, mésanges) se lisent mal ou de très près.
3. **Retouches réussies**: le trou blanc sous le flanc côté quai est bouché, les talus en terre ferment les traversées, les ornières se voient sans crier (`retouches-*`). Cloche de 0,55 m bien proportionnée sous sa potence (planche quatre angles; pas recapturée en jeu).
4. Aucune régression de lumière ni de lisibilité vue sur les plans relus.

L'échelle ne fait pas tomber le « oui »: elle n'existait pas avant (c'était du texte), elle ne casse rien, mais elle relève de G9 et doit être reprise avant le report.

## G8: détails de construction (liste 8.10)

| Modèle | Points | Constat | Gravité | Correction (artiste-3d) |
|---|---|---|---|---|
| `blue_tit` | 3, 9 | Le bandeau noir de l'œil est une **barre qui sort de la tête** des deux côtés; en `tit_perch`, les ailes sont **deux planches bleues** tendues hors du corps, et un bout d'aile ressort sur la poitrine (`faune-4angles-blue_tit.png`, quatre vues) | moyen (invisible au zoom de jeu, mais G8 se juge de près) | Bandeau peint sur la tête (faces de la case `black`), ailes repliées le long du corps en `tit_perch`, `tit_sing`; dépliées seulement en `tit_fly`. 20 min |
| `heron` | 4, 9 | Ailes repliées en plaques qui débordent du dos (voir point 2) | léger | Ailes contre le corps au repos. 20 min |
| `goose` | 3 | La queue relevée en `goose_swim` est un bloc posé sur l'arrière, qu'on croit détaché | léger | Queue courte, dans le prolongement du dos, pointe à peine relevée. 10 min |
| `ladder_wood`, `nest_box`, `oak_branch_stub`, `fox`, `moss_tuft`, `bell_post` | 1 à 9 | Rien ne flotte ni ne traverse; échelle coupée à plat au sol et contre le tronc, barreaux à 0,28 m; nichoir avec planche de dos et toit débordant; cloche dégagée du poteau | aucun | |
| `climb_ladder`, `hold_ladder` | 2 | De près (`faune-echelle-profil.png`), le joueur qui tient et Basile qui monte se frôlent; avec la nouvelle mise en scène (joueurs sur les côtés), le contact disparaît | à revoir sur la nouvelle planche | |
| Talus des traversées | 3 | Les talus finissent en pointes de terre effilées au coin du platelage (`retouches-talus-passage-a-niveau.png`, après pn-o1) | léger | Bout de talus arrondi (rayon de 0,3 m), dev rendu |

## G9: cohérence du monde

| Élément | Au bon endroit, dans le bon sens, à la bonne taille ? | Verdict |
|---|---|---|
| Échelle de Basile | Vue de profil, spectateurs alignés dans l'axe du regard, au nord-ouest d'un bâtiment de 4,5 m (contre la règle de caméra de la carte) | **non**, correction au point 1 |
| Nichoir à 1,84 m | À portée de main d'un homme de 1,74 m: l'échelle n'a plus de raison d'être | **non**, 2,25 m au point 1 |
| Héron au gué | Bon endroit (bord aval, eau basse), bon sens; mais « dans l'eau » sur un gué sec | à reprendre (lame d'eau) |
| Héron posé | Grève sud derrière les arbres de la rive | **non**, rive nord au point 2 |
| Oies | Eau calme devant le banc de la berge, cap nord-nord-est, passage au-dessus du puits et du quai | oui |
| Renard | Herbe non fauchée entre la voie et la maisonnette, arrivée et départ par le ballast | oui |
| Mésanges | Chicot et nichoir sur le chêne qu'on ne coupe pas; suivent le nichoir s'il bouge | oui, à replacer avec le chêne |
| Vers luisants | Pré d'herbes hautes à plus de 9 m des lampadaires | oui |
| Cloche élargie | Sous la marquise, dégagée du banc (énigme de l'ombre gardée selon le README) | oui |
| Talus, ornières, platelage d'un ton | La route monte au platelage, les ornières longent les rails | oui |

## Notes proposées

### Pilier 2, vie du monde et animation: 7,5/10 (7 avant)

Gain réel: le bourg a des bêtes qui vivent sans les joueurs, avec attentes (le héron pêche, les oies dérivent, le renard mulote), apogées chorégraphiées, sons placés, et une vraie nuit vivante (vers luisants, grillons). Ce qui empêche le 8: ces bêtes ne sont là qu'un jour sur trois environ et seulement pendant leur fenêtre; hors des moments, toujours ni oiseaux, ni papillons, ni insectes de jour; l'eau du gué ne coule pas; et l'un des deux moments de quête (l'échelle) ne se voit pas en vue par défaut. Une petite faune d'ambiance permanente (deux ou trois oiseaux qui se posent et s'envolent, papillons sur les fleurs) donnerait le 8.

### Pilier 3, direction artistique: 7,5/10 (inchangé)

La faune est du même style que le bourg (facettes, palette tenue, 17 cases ajoutées sans matériau ni texture neuve), l'interface des secrets est soignée et cohérente avec l'identité, les retouches ferment des défauts du tour 5. Mais le tour fait entrer des défauts visibles (échelle illisible, bête posée derrière les arbres, mésange et héron en planches de près, identifiant brut à l'écran), et les points qui bloquaient déjà le 8 restent ouverts: place en aplat gris, berges à angle droit, gué sans eau. Je ne monte pas la note.

## Défauts restants, par gravité

| Gravité | Défaut | Qui | Effort |
|---|---|---|---|
| **Bloquant** | Échelle de Basile: chêne en (50,5 ; 5,5), échelle face sud-est, places de côté, nichoir face est à 2,25 m (point 1), puis planche de contrôle | level-designer, dev gameplay (puis dev rendu pour le tramage du houppier si besoin) | 60 à 90 min |
| **Bloquant** | « Parle avec h145 » sur la carte du partenaire | dev interface | 15 min |
| **Bloquant** (G8) | Mésange: bandeau en barre, ailes en planches au repos | artiste-3d | 20 min |
| Moyen | Héron posé derrière les arbres de la rive sud: rive nord (point 2) | level-designer, dev gameplay | 20 min |
| Moyen | Gué sans lame d'eau, héron « dans l'eau » sur du sec (ouvert depuis le tour 5) | tech-artist | 60 min |
| Léger | Renard illisible sans la teinte (gris, daltonismes): roux éclairci, blancs agrandis | artiste-3d | 15 min |
| Léger | Ailes du héron en caisson; queue de l'oie en bloc | artiste-3d | 30 min |
| Léger | « Rien que pour toi » en deux styles; boîte d'appel qui couvre la poule et coupe l'objectif à 150 %; titre du carnet coupé au défilement; statut « En chemin » contre « déjà en place » à vérifier | ux-ui-designer, dev interface | 45 min |
| Léger | Talus en pointes au coin des platelages | dev rendu | 15 min |
| Ouvert (tour 5) | Place en aplat gris, berges à angle droit | tech-artist, dev rendu, level-designer | 240 min |
