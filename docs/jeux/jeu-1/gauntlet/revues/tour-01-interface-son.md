# Gauntlet, tour 1: pilier 5 (interface et lisibilité) et pilier 4 (son et musique, sous l'angle des retours)

| Champ | Valeur |
|---|---|
| Relecteur | ux-ui-designer (auteur des maquettes `games/la-petite-ligne/ui-maquettes/`, pas du code de l'interface ni du son) |
| Date | 2026-10-31, de 08 h 57 à 09 h 45 UTC |
| Version relue | arbre de travail à `b2431e8`, sans aucune modification du code, des données ni des maquettes |
| Méthode | page de démonstration `src/interface/demo/index.html` servie par Vite (port 5303), Playwright dans Chromium: 30 scénarios à 1366x768 avec la taille d'interface à 150 % (sans scène 3D, `rendu=0`, pour aller vite), une sélection à 100 % et 125 % avec la scène 3D, 1280x720 à l'échelle 1,5 (écran 1080p réglé à 150 % dans Windows); détecteur de débordement (rectangles des nœuds de texte, défilement horizontal); parcours au clavier scripté (HUD, carnet, sac, dialogue, proposition, titre, création, caisse, catalogue, comptoir, nuit, fin); chronologie des notifications et astuces pendant 45 s de jeu. Son: lecture de `sons.json` (76 sons), `src/audio/declencheurs.ts`, `assets-src/son/controles/mesures.csv` (141 fichiers mesurés), `docs/jeux/jeu-1/son.md`, `docs/plateforme/identite-sonore.md`. Scripts hors du dépôt (`/tmp/lpl-ux/`) |
| Limites | aucune écoute possible ici; les captures à 150 % sans scène 3D montrent un fond uni à la place du décor |

## Notes

| Pilier | Note | En une phrase |
|---|---|---|
| 5. Interface et lisibilité | **6,5 sur 10** | Complète, lisible, entièrement jouable au clavier et chaleureuse dans ses textes; elle perd des points sur les collisions de mise en page dès 125 % et sur des transitions presque absentes. |
| 4. Son et musique (retours) | **7 sur 10, sur dossier** | Couverture du monde et ambiances en couches d'un niveau rare pour une démo; l'interface du jeu est muette, un refus sonne comme une bonne nouvelle, et rien n'a encore été entendu. |

## Pilier 5. Interface et lisibilité: 6,5

### Justification

À 1366x768 et à 100 %, un joueur trouve une interface propre, lisible et complète: on ne voit pas de manque fonctionnel. Trois choses retiennent la note sous 8, chacune visible par un joueur:

1. **La mise en page casse dès que la taille grandit**: en aménagement, la barre recouvre le portrait et les boutons de caméra à 125 %, 150 % et sur un écran 1080p réglé à 150 % dans Windows (1280x720 en points logiques); à 150 %, l'en-tête du comptoir déborde du panneau, la carte de proposition masque l'objectif, et les panneaux ne montrent que deux lignes.
2. **Le plaisir des transitions manque**: cinq animations en tout dans `composants.css` (fondu d'ouverture de panneau, glissé des notifications, saut de la case nouvelle, tampon, « +50 » de la bourse). Les écrans plein cadre arrivent sans transition, rien ne se referme en mouvement, le texte des habitants s'affiche d'un bloc et leur portrait garde la même expression. Les références font de chaque geste d'interface un petit plaisir; ici, l'interface est juste.
3. **Quelques frictions au clavier** (création, comptoir) qui ne bloquent pas, mais qui se sentent.

### Déjà au niveau

- **Tout au clavier, tout à la souris**, vérifié par script: Tab ouvre le carnet avec le focus sur la quête en cours, E change d'onglet (Quêtes, Courrier, Sac), les flèches parcourent le sac, Retour arrière ferme et rend la main au jeu; la proposition d'achat ne vole pas le focus, Entrée l'amène sur « D'accord », Tab passe à « Pas maintenant »; le dialogue s'ouvre avec le focus sur la première réplique; la caisse et le catalogue bouclent au Tab et se ferment par Retour arrière. Les boutons du HUD ne gardent pas le focus après un clic.
- **Focus toujours visible**: anneau de 3 px bleu d'encre sur chaque élément atteint (`:focus-visible` vrai partout dans le parcours).
- **Libellés selon le clavier réel**: toutes les touches affichées passent par `keyLabel` du SDK (`navigator.keyboard.getLayoutMap()`), chiffres de la barre compris; les astuces utilisent des variables (`{act}`, `{move}`, `{notebook}`).
- **HUD à 150 % sans débordement** (capture `ux-01`): régions ancrées aux coins, la barre d'outils reste entière, aucun défilement horizontal dans les 30 scénarios.
- **Apprentissage par l'action**: 21 astuces déclenchées par le contexte (approcher la caisse, tenir un meuble, première lettre), une à la fois; chronologie mesurée sur la première journée: une astuce toutes les 6 s environ, jamais deux ensemble.
- **Notifications sobres**: trois au plus, 6 s, doublons fusionnés (`dedupeToasts`); aucune rafale observée en 45 s de jeu.
- **Textes**: tutoiement, rédaction neutre, typographie française appliquée à l'affichage (espaces insécables, guillemets « »), voix chaleureuse (« Ça va. La paillasse pique un peu. », « Sacha a commencé sa journée : l'horloge tourne. »). Le bandeau à motif de chaque habitant (vichy d'Odette, rayures de Firmin) donne du caractère au dialogue (capture `ux-08`).
- **Cohérence avec les maquettes**: composants et jetons importés tels quels, mêmes états, mêmes textes; écarts listés plus bas.

### Les 5 défauts les plus visibles, par impact

| # | Constat | Preuve | Correction proposée | Membre | Effort | Gain |
|---|---|---|---|---|---|---|
| I1 | **Aménagement: la barre recouvre le portrait et les boutons du HUD.** À 125 %, elle cache le prénom; à 150 %, le jeton du joueur passe par-dessus « Retour arrière » et les boutons de caméra masquent « ou clic droit reprendre »; même à 100 %, sur un écran 1080p réglé à 150 % dans Windows, elle mord sur la jauge d'endurance. La maquette efface le bas du HUD pendant l'aménagement; le jeu le laisse affiché. | `ux-02-amenagement-1366x768-taille150.png`, `ux-03-amenagement-1280x720-echelle150.png`; maquette: `ui-maquettes/captures/amenagement-1366x768-150.png`; le détecteur ne voit rien car tout reste dans la fenêtre | `hud.ts`: poser `data-state="build"` sur `.lpl-hud` tant qu'un meuble est en main; `interface.css`: masquer `.lpl-hud__bottom-left`, `.lpl-hud__bottom-right` et la barre d'outils dans cet état, comme pour `dialogue` et `panel`. Ne pas afficher l'astuce `hint_furniture` quand la barre montre déjà les mêmes touches. Critère: captures à 100, 125 et 150 % et à 1280x720, aucun recouvrement | dev de l'interface (`src/interface/`) | 30 min | +0,5 |
| I2 | **Transitions et micro-animations trop rares.** Titre, création, petit-déjeuner, nuit et fin apparaissent d'un coup; panneaux, dialogues et proposition disparaissent sans mouvement; la réplique d'un habitant s'affiche d'un bloc, son portrait reste sur l'expression « good »; une ligne d'objectif cochée, une quête finie, un objet reçu n'ont pas de geste à eux (seule la case nouvelle saute). | `composants.css`: 5 `@keyframes` (`lpl-slide-in`, `lpl-rise`, `lpl-pop`, `lpl-stamp`, `lpl-panel-in`), aucune sur `.lpl-screen`; `dialogue.ts`, ligne 140: `portraitSvg(colors, 'good', …)` | Spécification de six gestes par ux-ui-designer avec directeur-artistique, puis intégration: (1) passage entre écrans plein cadre, la feuille glisse de 12 px et se fond, 320 ms; (2) panneau qui s'ouvre de 96 % à 100 % et se referme en 160 ms; (3) réplique révélée mot à mot, Espace l'affiche en entier; (4) expression du portrait par réplique (champ facultatif dans les dialogues, repli sur « good »); (5) ligne d'objectif qui se coche avec un petit tampon; (6) objet qui vole de la scène vers sa case. `transform` et `opacity` seulement, coupés par la réduction des animations | ux-ui-designer (spécification), directeur-artistique (validation), dev de l'interface, game-designer pour les expressions | 45 + 240 min | +1 |
| I3 | **Panneaux à 150 %: débordements et place perdue.** L'en-tête du comptoir pousse « Fermer » hors du panneau; les panneaux commencent sous une bande de 200 px, donc la caisse montre 2 lignes sur 4, le comptoir 2 articles, le coffre 3; la carte de proposition masque le titre de l'objectif; les cartes de nuit et de fin sont coupées en haut, et « Continuer » est à moitié visible en bas de la fin. | `ux-04-comptoir-1366x768-taille150.png`, `ux-06-caisse-1366x768-taille150.png`, `ux-05-proposition-1366x768-taille150.png`, `ux-07-fin-1366x768-taille150.png` | En-tête de panneau en `flex-wrap: wrap`, onglets sur une deuxième ligne quand la place manque, « Fermer » réduit à sa touche; quand un panneau est ouvert, il peut monter jusqu'à l'horloge (la carte de l'autre et l'objectif sont déjà masqués ou masquables); masquer l'objectif pendant une proposition; marges verticales des écrans plein cadre en `clamp()` avec `vh`. Critère: à 1366x768 et 150 %, aucun bouton hors de son panneau, 4 lignes de caisse visibles, action principale entière à l'écran | dev de l'interface | 60 min | +0,5 |
| I4 | **Frictions au clavier.** Création: chaque coiffure et chaque tenue est un arrêt de Tab, 9 appuis pour atteindre « C'est parti ! » (les maquettes prévoient un arrêt par groupe et les flèches dedans). Comptoir: Tab va et vient entre « Acheter 1 » et « Acheter 4 » du premier article, sans jamais atteindre « Vendre » ni « Fermer » (il faut les flèches, A et E, Retour arrière, que le pied de panneau indique); chaque ligne porte un bouton vert, alors que la règle est une seule action principale verte par écran. | script `clavier.cjs`: suite des focus au Tab sur `creation` et `comptoir`; `ux-04` | Un seul arrêt de Tab par groupe (focus mobile, flèches dans le groupe) pour les choix de la création; au comptoir, Tab passe d'une ligne à la suivante puis à « Fermer », et seul l'article sous le focus montre son bouton en vert | dev de l'interface | 45 min | +0,3 |
| I5 | **Astuces: quelques tournures à la souris seule et un début un peu bavard.** « Un clic sur l'herbe pour bêcher. » et « La molette change d'outil. » oublient le clavier (Espace, touches 1 à 0), alors que les deux sont à égalité; la première journée enchaîne trois astuces en 12 s, chacune avec le son `notify`. | `donnees/astuces.json` (`hint_till`, `hint_toolbar`); chronologie: astuces à 4,4 s, 10,3 s et 16,1 s sur `premier-jour` | Réécrire avec `{act}` et « 1 à 0 »; au moins 10 s entre deux astuces; pas de son `notify` pour une astuce (ou un son plus discret que celui d'une lettre) | game-designer (textes), dev gameplay (délai), dev audio (son) | 30 min | +0,2 |

Autres remarques, de moindre impact: la page de démonstration ouvre l'écran titre pour le scénario `creation` et l'onglet Quêtes pour `courrier` (outil, pas le jeu); le petit-déjeuner flotte sur la scène du dehors, sans décor de la maisonnette; le rappel des touches de l'aménagement dit « T » pour tourner, la maquette proposait « W » (décision à confirmer dans le README des maquettes, section 5).

## Pilier 4. Son et musique, sous l'angle des retours: 7 sur dossier

### Justification

La note est donnée sans écoute: elle juge la couverture, la variété et les niveaux tels que les fichiers et le code les décrivent. Le travail est d'un soin rare: événements du monde presque tous sonorisés, pas selon le sol au rythme de l'animation, sons de l'autre placés et plus bas, priorités, atténuation de la musique, repos de la musique contre la lassitude, ambiances en couches qui suivent l'heure, le lieu et la météo, séquences du train calées sur la simulation. Ce qui la retient sous 8:

1. **L'interface du jeu est muette**: ni validation, ni retour, ni changement d'onglet, ni déplacement du focus, alors que la plateforme Duo a ces quatre sons (`identite-sonore.md`, lignes 01 à 04). Le joueur passe d'un salon qui répond à chaque geste à un jeu dont les menus se taisent.
2. **Un refus sonne comme une bonne nouvelle**: « Déjà pris par Sacha », « Ton sac est plein », « Il manque 40 sous » jouent le même carillon qu'une lettre.
3. **La répétition sur une heure** (un seul motif par habitant, deux thèmes de jour pour quinze journées) et un **mixage d'ensemble jamais mesuré** en situation.

### Audit de couverture

| Famille | Couvert | Manque |
|---|---|---|
| Événements de la simulation (`WorldEvent`, 62 sortes) | 44 ont un son direct; 9 des 18 muets sont couverts autrement (train par les séquences, veillée et nuit par la musique, lettre par la notification, lever par l'air du réveil, cuisine par `crafted`, construction par `element_built`) | sans retour propre: `already_taken`, `bag_full` (seulement le carillon `notify`), `absence` (l'autre fait une pause ou revient), `scene_ended`, `midnight`; `quest_step` et `quest_done` ont le même son, la fin d'une quête mériterait plus |
| Lu dans l'état (`StateWatcher`) | pas selon 4 sols, marteau, scie et réchaud en boucle, poutre portée à deux, rotation d'un meuble, outil changé, clic au sol, ouverture du carnet et du coffre, tampon de la commande, poules | ouverture de la caisse, du catalogue, de l'établi, du réchaud, du comptoir hors dialogue; fermeture d'un panneau; refus de pose d'un meuble |
| Interface du jeu (`src/interface/`) | aucun son déclenché par l'interface elle-même (vérifié: aucun appel audio dans `src/interface/`) | boutons « Commencer la semaine », « C'est parti ! », « Commencer ma journée », « Continuer », « Finir la séance »; répliques et « Suite »; onglets (le « tourner une page » de `son.md` 4.3 n'est joué qu'à l'ouverture); focus au clavier; bouton désactivé (« Rien à déposer ») |

### Variété

- 76 sons, 131 fichiers. Sons fréquents à 2 à 4 variantes, tirage sans répétition, hauteur de 2 à 8 % et niveau de 0,5 à 1,5 dB tirés à chaque lecture: pas (4 sols x 4), bêche, semis, récolte, hache, marteau, ramassage, monnaie, poules.
- À une seule variante malgré une fréquence élevée: `order-stamp` (chaque ligne de commande), `water-fill`, `chest-open`, `chest-close`, `furniture-rotate` (compensé par 8 % de hauteur), `talk-*` (un motif par habitant, rejoué à chaque conversation, 4 s au moins entre deux).
- Musique: 9 morceaux, dont 2 thèmes de jour de 96 s (matin, après-midi) pour environ 70 minutes de jeu dehors sur quinze journées, avec 40 à 80 s de repos après chaque boucle; même musique le jour de pluie.

### Niveaux (mesures des fichiers)

| Famille | Sonie intégrée | Crête vraie max | Remarque |
|---|---|---|---|
| Musiques | -18,1 LUFS (fanfare -17,0) | -3,2 dBTP | lues à -4 dB: environ -22 LUFS dans le jeu |
| Effets | -35,4 à -21,7 | -1,7 | |
| Interface | -28,9 à -20,4 | -1,7 | |
| Motifs des habitants | -22,2 à -20,1 | -8,1 | |
| Train | -33,4 à -18,5 | -1,9 | |
| Ambiances | -35,2 à -29,3 | -10,6 | |

Aucune crête au-dessus de -1,5 dBTP, limiteurs posés: rien n'écrête. Mais seule la sonie de chaque fichier est mesurée: la somme réelle en jeu (musique, cinq sources de rivière, vent, oiseaux, bourg, effets) ne l'est pas. Les sons de la plateforme sont entre -16 et -19 LUFS, la musique du jeu vers -22: le passage du salon au jeu risque une baisse de niveau sensible.

### Déjà au niveau

- Couverture du monde: chaque geste de la boucle de jeu (bêcher, semer, arroser, récolter, couper, scier, clouer, poser, pêcher, porter à deux, manger, ouvrir une porte) a son son, placé dans l'espace, le sien distinct de celui de l'autre.
- Ambiances en couches: oiseaux selon l'heure, grillons, bourg selon la distance à la place, vent selon la lisière, rivière en cinq sources, pluie dehors ou sur le toit, passe-bas et -10 dB dans la maisonnette.
- Musique liée au moment (titre, petit-déjeuner, matin, après-midi, samedi, veillée, nuit, fanfare, fin), repos contre la lassitude, atténuation sous les sons importants.
- Le train comme battement de cœur: séquences d'arrivée et de départ calées au pas de simulation, sifflet proche ou lointain.
- Discipline: tonalité commune des tintements (sol majeur), boucles sans clic vérifiées, régénération à l'octet près.

### Les 5 défauts les plus visibles (audibles), par impact

| # | Constat | Preuve | Correction proposée | Membre | Effort | Gain |
|---|---|---|---|---|---|---|
| S1 | **Menus du jeu muets.** Valider, revenir, changer d'onglet, avancer une réplique, ouvrir la caisse ou le catalogue, déplacer le focus: aucun son, alors que la plateforme en a un pour chacun. | `src/interface/`: aucun appel audio; `declencheurs.ts`, lignes 422 à 431: seuls le carnet, la lettre et le coffre sonnent à l'ouverture; `identite-sonore.md`, lignes 01 à 04 | Famille « papier et bois » propre au jeu (pour rester distincte du verre de Duo): `ui-focus` (3 variantes, vers -30 LUFS), `ui-confirm` (3), `ui-back` (2), `ui-page` (3, onglets et répliques), `ui-open` et `ui-close` (panneaux). Côté code: option facultative `sound?: (kind) => void` dans `InterfaceOptions`, appelée par la navigation et les panneaux, branchée par `main.ts` sur le bus interface de `createAudio`. Critère: chaque bouton et chaque onglet du parcours au clavier produit un son, 45 ms au moins entre deux sons de focus | sound-designer (sons), dev de l'interface et dev audio (branchement) | 60 + 60 min | +0,7 |
| S2 | **Les refus sonnent comme les bonnes nouvelles.** « Déjà pris par Sacha », « Ton sac est plein », « Il manque 40 sous », matériaux manquants: même carillon `notify` qu'une lettre ou une quête; poser un meuble sur une case refusée ou appuyer sur un bouton désactivé: silence. | `simulation/contexte.ts`: `say()` crée une notification de sorte `message`; `declencheurs.ts`: `message` dans `NOTIFY_KINDS`, `already_taken` et `bag_full` muets; l'interface, elle, affiche ces notifications en variante `error` | Son `ui-refuse` doux (deux coups de bois qui descendent, 2 variantes, vers -24 LUFS, 600 ms au moins entre deux), joué pour une notification d'erreur, un refus de pose, un bouton désactivé; `notify` réservé aux bonnes nouvelles | sound-designer, dev audio, dev de l'interface | 20 + 25 min | +0,4 |
| S3 | **Un seul motif par habitant, rejoué à chaque conversation**, et des répliques muettes. Sur une heure, le motif d'Odette revient des dizaines de fois à l'identique; une réplique qui s'affiche ne fait aucun bruit, là où les références donnent une « voix » à chaque ligne. | `sons.json`: `talk-odette`, `talk-firmin`, `talk-basile`, `talk-jeanne` à 1 fichier; `son.md`, section 5 | Trois versions par habitant: le motif complet à la première conversation du jour, deux signatures d'une seconde ensuite; à chaque « Suite », deux ou trois notes de l'instrument de l'habitant (une voix sans paroles, conforme au cahier, 6.12) | sound-designer, dev audio | 120 + 20 min | +0,5 |
| S4 | **Peu de musique pour une longue séance.** Deux thèmes de jour de 96 s couvrent environ 70 minutes dehors: chacun revient une quinzaine de fois malgré les repos; le jour de pluie garde la même musique; pas de couleur de fin de journée. | `sons.json`, `plan.musicByMoment`; `son.md`, section 2 | Sous la pluie, repos plus longs ou un arrangement clairsemé (guitare et pluie); une variation du motif de la Halte pour certains jours (instrument soliste différent); une couleur de fin d'après-midi (17 h à 19 h). À arbitrer avec le game designer selon le rythme de la démo | sound-designer | 180 min | +0,5 |
| S5 | **Mixage d'ensemble non mesuré.** Les fichiers sont mesurés un par un; la sortie du jeu, jamais. Musique vers -22 LUFS en jeu contre -16 à -19 LUFS pour les sons de la plateforme: baisse probable en entrant dans le jeu, et la somme des couches d'ambiance n'est pas vérifiée. | `mesures.csv` (fichiers seuls); `sons.json`: musiques à `volumeDb` -4; `identite-sonore.md` | Dans le banc (`src/audio/banc/`), enregistrer la sortie principale 60 s dans trois moments (matin sur la place, samedi avec le train, veillée), mesurer sonie intégrée et maximum à court terme (`ebur128`); viser -18 LUFS à 2 dB près, court terme sous -12, et l'écart avec le salon de Duo sous 3 dB | dev audio, sound-designer | 60 min | +0,3, et une note enfin fondée sur une mesure |

### À juger à l'oreille chez le client

- La musique de jour supporte-t-elle une heure (thème du matin, thème de l'après-midi, repos)? Agace-t-elle à la dixième boucle?
- Le carillon `notify` à chaque astuce et chaque refus: discret ou insistant?
- Les pas et les outils à la centième écoute (bêche, arrosoir, tampon de la commande, rotation d'un meuble à une seule variante).
- Le niveau relatif musique, ambiances et effets sur les haut-parleurs du portable et du Mac; l'écart de niveau entre le salon de Duo et le jeu.
- Le motif de chaque habitant: charmant ou lassant au bout de dix conversations?
- La spatialisation des sons de l'autre (on l'entend sans le confondre avec soi?) et le passage dedans, dehors de la maisonnette.
- Le sifflet du train: assez présent partout dans la vallée sans faire sursauter?

## Pistes prioritaires pour le tour suivant

1. I1 (aménagement à 125 et 150 %): 30 minutes, défaut le plus visible, déjà dessiné dans la maquette.
2. S1 et S2 (sons de l'interface et du refus): une famille de sons et un seul point de branchement; c'est ce qui sépare le plus le jeu de la plateforme et des références.
3. I2 (transitions et micro-animations): le plus gros gain de plaisir pour le pilier 5, à spécifier avant de coder.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-01/`:

| Fichier | Ce qu'elle montre |
|---|---|
| `ux-01-hud-1366x768-taille150.png` | HUD à 150 % avec la scène: tout tient (au niveau) |
| `ux-02-amenagement-1366x768-taille150.png` | I1: barre d'aménagement sur le portrait et sous les boutons de caméra |
| `ux-03-amenagement-1280x720-echelle150.png` | I1: même collision à 100 % sur un écran 1080p réglé à 150 % dans Windows |
| `ux-04-comptoir-1366x768-taille150.png` | I3 et I4: « Fermer » hors du panneau, deux articles visibles, boutons verts sur chaque ligne |
| `ux-05-proposition-1366x768-taille150.png` | I3: la carte de proposition masque le titre de l'objectif |
| `ux-06-caisse-1366x768-taille150.png` | I3: deux lignes de commande sur quatre visibles |
| `ux-07-fin-1366x768-taille150.png` | I3: écran de fin coupé, « Continuer » à moitié visible |
| `ux-08-dialogue-1366x768.png` | dialogue à 100 % avec la scène: au niveau (bandeau de l'habitant, focus, touches) |
