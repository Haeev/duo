# La Petite Ligne, refonte: interface

| Champ | Valeur |
|---|---|
| Version | 0.1 (proposition, à valider par le client) |
| Rédaction | ux-ui-designer, 2026-11-10 |
| Source qui fait foi | `reponses-client-2026-11-10.md` (réponses 16 à 23, 31, 32, 34, 37 à 39, 47, 51, 52, 60 à 69) |
| Règles de ressenti | `references-de-ressenti.md`, section 3: reprises ici (correspondance en section 9.1) |
| Retours pris en compte | `../retours/2026-11-04/retours.md` (R05, R09, R10, R11, R12, R17, R20, R21) |
| Maquettes | `maquettes/` (cinq écrans, HTML et CSS animés), captures dans `maquettes/captures/` |
| Remplace | `../interface-imagee-0-12-2.md` et `games/la-petite-ligne/ui-maquettes/` pour le nouveau jeu (les règles 1 à 7 de l'interface imagée restent valables) |

La demande du client: une interface « intuitive, animée (avec de la 3D) », presque sans texte, comprise au premier regard. Ce document dit ce qu'on voit, quand, et comment on le pilote. Les règles du jeu (seuils des besoins, tailles des sacs, prix) appartiennent au cahier des charges: quand une valeur manque encore, elle figure en hypothèse à la section 12.

## 1. Principes

1. **L'écran appartient au monde.** En permanence: l'heure et la bourse, rien d'autre. Tout le reste arrive quand il sert et repart seul. Avant d'ajouter un élément au HUD, on cherche à le dire dans le décor (l'outil est dans la main du personnage, la faim se voit à sa démarche).
2. **Une image, un nombre, un geste.** Une vignette montre l'objet, une pastille montre le nombre, une touche fait l'action. Le nom (4 mots au plus) n'apparaît qu'au survol ou à la sélection, dans les menus seulement. Les phrases sont réservées aux habitants: c'est là que le jeu raconte.
3. **Une seule touche, et le monde répond.** Espace fait l'action que montre la bulle. Chaque appui a une réponse visible et sonore en moins de 100 ms (rebond, particules, petit son). Une action ne s'attache qu'à un objet visible: plus aucune zone vide qui réagit (R05, R11, R17, R21).
4. **Un seul endroit pour tout retrouver.** Le carnet réunit sac, quêtes, habitants, collections, carte, tenues et réglages. Les menus de métier (boutique, basse-cour, cuisine) ont tous la même charpente: des vignettes à gauche, le détail à droite, les mêmes touches.
5. **Rien n'est dit par la seule couleur, ni par la seule animation.** Chaque état a une forme (hachures, pointillé, cadenas, coche) et reste complet avec les animations réduites. Tout se fait au clavier, sauf le mode déco.

## 2. Carte des écrans et parcours

```text
Duo (salon) -> Titre du jeu -> [première partie] Éditeur de personnage (chacun le sien)
                            -> Arrivée en train (jouable) -> EN JEU
EN JEU (HUD)
 |- Espace sur un habitant ......... Dialogue (bandeau) -> choix -> [Donner: mini-sac] -> EN JEU
 |- Espace sur un commerçant ....... Dialogue court -> Boutique (Acheter | Vendre) -> EN JEU
 |- Espace sur le poulailler ....... Basse-cour (vue 3D) -> EN JEU
 |- Espace sur le réchaud, la cuisine  Cuisine: choix de la recette -> mini-jeu -> plat -> EN JEU
 |- Espace sur le plan de la maison  Mode déco (vu du dessus, souris) -> EN JEU
 |- Espace sur un miroir, une armoire  Éditeur de personnage (coiffure, tenue) -> EN JEU
 |- C .............................. Carnet: Sac | Quêtes | Habitants | Collections | Carte | Tenues | Réglages
 |- G .............................. Coup d'œil (3 s): direction de la quête suivie, besoins, autre joueur
 |- Échap .......................... Pause de Duo (modèle de la plateforme)
 '- La nuit tombe .................. Bilan de la journée (les deux joueurs) -> jour suivant
```

Parcours de référence, à vérifier en test avec une personne qui découvre le jeu:

| Parcours | Étapes | Appuis au plus |
|---|---|---|
| Parler à un habitant qui a quelque chose pour nous | voir la bulle au-dessus de sa tête, s'approcher, Espace, lire, choisir | 4 |
| Vendre trois œufs au meilleur prix | Espace sur le commerçant, onglet Vendre (E), choisir l'œuf, monter à 3 (D D), Entrée | 6 |
| Savoir où aller | G | 1 |
| Nourrir les poules et ramasser les œufs | Espace sur le poulailler, Espace (remplir), D, Espace (ramasser), Retour arrière | 5 |
| Manger quand on a faim | Tab (ou 1 à 5) pour prendre le plat en main, Espace | 2 |
| Voir où est un habitant | C, puis E jusqu'au signet Carte (le carnet rouvre sur le dernier onglet vu) | 1 à 5 |

## 3. Le HUD

Maquette: `maquettes/hud.html`.

### 3.1 Ce qui reste à l'écran

| Élément | Place | Contenu |
|---|---|---|
| Horloge | haut gauche | cadran rond où le soleil puis la lune suivent un arc, heure en chiffres, pictos du jour et de la météo. Nuit: le cartouche passe au bleu nuit. À partir de 15 h, un petit lit apparaît dans le cadran: on peut dormir. |
| Bourse | sous l'horloge, accolée | la pièce et le nombre, sans le nom de la monnaie (le jeu change de lieu, la pièce reste). Le nombre roule quand il change, la pièce saute. |

C'est tout. Ni portrait, ni objectif, ni boutons de caméra, ni barre d'outils permanente.

### 3.2 Ce qui apparaît quand il sert

| Élément | Apparaît | Disparaît | Place |
|---|---|---|---|
| Bulle d'action | un objet ou un habitant est visé (le plus proche dans l'axe du regard, à portée) | on s'éloigne, ou l'action n'est plus possible | au-dessus de l'objet, suit l'objet |
| Barre d'outils | changement d'outil (Tab, Maj+Tab, 1 à 5), objet ramassé ou perdu, coup d'œil (G), carnet | 3 s après le dernier changement | bas centre |
| Besoins | voir 3.3 | voir 3.3 | à droite de l'horloge |
| Flèche de quête | G | après 3 s | au sol, devant le personnage, pointée vers l'objectif (cahier, 4.10); si l'objectif est à l'écran, un losange se pose dessus |
| Repère de l'autre joueur | G | après 3 s | bord de l'écran, jeton à sa couleur et à sa forme |
| Bulle « j'ai quelque chose » | un habitant a une étape de quête, une demande ou un cadeau pour ce joueur | après lui avoir parlé | au-dessus de l'habitant, visible de loin (taille constante à l'écran, réduite au-delà de 30 m) |
| Onomatopée | émotion d'un habitant ou d'un joueur (« !! », « ?? », « ... », « Zzz », « ♪ », cœur, « Pouah ») | 1,5 s | au-dessus de la tête, dans le monde |
| Gain | objet ramassé, argent reçu, cœur d'amitié gagné | 1,2 s | part de l'objet et vole vers la barre d'outils, la bourse ou l'habitant |
| Prise nouvelle | première prise d'une espèce ou d'un trésor (poisson, insecte, fossile): le personnage la brandit face à la caméra, jingle, et un petit bandeau bas avec l'objet en 3D qui tourne, son nom et une ligne; le signet Collections reçoit son point. Une prise déjà connue: seulement le gain qui vole, sans arrêt | Espace, ou 3 s | bas centre |
| Avis | événement rare qui ne vient pas d'un geste du joueur (l'autre joueur demande le train, sac plein, connexion) | 4 s, ou à la réponse | haut droite, un seul à la fois, une icône et 6 mots au plus |

Bulle d'action: une capsule de papier avec la touche (« Espace », libellé lu sur le clavier réel), le picto de l'action et un seul verbe (« Arroser », « Parler », « Ramasser », « Ouvrir »). L'objet visé rebondit une fois (échelle 1 à 1,08 en 200 ms) puis garde un liseré clair et une brillance qui passe toutes les 2 s. Une seule cible à la fois. Si l'action est impossible, la bulle montre ce qui manque en image (arrosoir vide: l'arrosoir barré et une goutte; sac plein: le sac hachuré) et Espace joue un petit « non » de la tête, sans texte.

Barre d'outils: 5 cases, pour les outils comme pour les objets (cahier, 4.5). La case en main est agrandie et sortie de la rangée. Usure d'un outil: un petit arc sous l'icône, plein quand il est neuf, hachuré et rouge tampon quand il est usé. Quantité d'une pile: pastille « 3 ». Repliée, la barre ne laisse rien à l'écran: l'outil se voit dans la main du personnage. Un réglage « barre d'outils toujours visible » existe (question 1).

### 3.3 Les trois besoins

Proposition: trois médaillons ronds (faim: bol, sommeil: lune, hygiène: goutte), chacun entouré d'un anneau qui se vide. Règle de ressenti et cahier (4.4): **ils n'apparaissent que quand un besoin change de palier**, et restent affichés sous 20; le reste du temps, c'est le personnage qui parle. Seul le médaillon concerné apparaît, pas les trois.

| Zone (hypothèse du cahier) | Médaillon | Personnage (dans le monde, vu aussi par l'autre joueur) |
|---|---|---|
| 50 à 100 %: bonus | caché. À l'entrée dans la zone: le médaillon apparaît 4 s avec une étoile | pas vif, petite étoile à l'entrée |
| 20 à 50 %: normal | caché. À la sortie du bonus: apparaît 4 s, l'étoile tombe | rien |
| 1 à 20 %: ralenti | **reste affiché** tant que le besoin est sous 20 (cahier, 4.4: un malus qui dure doit rester expliqué): anneau hachuré, bord en pointillé, battement lent | faim: main sur le ventre, gargouillis; sommeil: bâillements, « Zzz »; hygiène: petit nuage et mouches |
| 0 % | reste affiché, plus grand, picto barré; la bulle d'action ne propose plus que manger (ou dormir) | marche traînante |

Ils apparaissent aussi (à la demande, ce ne sont pas des changements subis): pendant qu'on mange, dort ou se lave (l'anneau se remplit sous les yeux), au coup d'œil (G), et toujours dans l'en-tête du carnet. Hygiène basse: l'habitant affiche « Pouah » avant de parler, et le choix de dialogue qui échouerait porte le picto de la goutte barrée (on sait pourquoi avant de choisir). Chaque joueur ne voit que ses propres médaillons; l'état de l'autre se lit sur son personnage.

### 3.4 Comportement à 1366x768

Marge du HUD: 12 px. Horloge et bourse: 196 x 96 px. Médaillons: 44 px. Barre d'outils: cases de 52 px, 5 cases = 306 px. Bulle d'action: 36 px de haut, jamais sous le bandeau de dialogue ni hors de l'écran (elle glisse le long du bord). Régions ancrées aux coins, jamais en grille (piège connu à 150 %). À 1280x720 et à 125 % puis 150 % de taille d'interface, aucune région ne se chevauche: à contrôler par intersection des rectangles.

## 4. Les touches

Les touches sont lues par position (`KeyboardEvent.code`), les libellés affichés selon le clavier réel. Tout se fait au clavier sauf le mode déco. La souris reste un complément partout (clic sur une vignette, un onglet, un choix).

| Touche (AZERTY) | Code | En jeu | Dans un menu |
|---|---|---|---|
| Z Q S D | KeyW, KeyA, KeyS, KeyD | se déplacer (clavier seulement, réponse 16) | vignette voisine |
| Maj | ShiftLeft | courir (hypothèse) | |
| Espace | Space | **l'action de la bulle**; avec un plat en main et sans cible: manger | activer; dialogue: finir la phrase puis suite; sac: prendre puis poser une pile |
| A, E | KeyQ, KeyE | tourner la caméra, en continu, sur 360° | onglet précédent, suivant (pages d'abord s'il y en a) |
| Flèches gauche, droite | ArrowLeft, ArrowRight | tourner la caméra | vignette voisine |
| Flèches haut, bas | ArrowUp, ArrowDown | zoomer, dézoomer | vignette voisine, choix de dialogue |
| Molette | | zoomer (réponse 17) | pages |
| Clic droit maintenu et glissé | | tourner la caméra | |
| Tab, Maj+Tab | Tab | case suivante, précédente de la barre d'outils | élément suivant, précédent |
| 1 à 5 | Digit1 à Digit5 | prendre en main la case de la barre d'outils (sans Maj) | boutique: quantité directe |
| X | KeyX | ranger l'outil (mains libres) | tourner l'objet 3D du détail (avec W, code KeyZ) |
| G | KeyG | coup d'œil 3 s: flèche de la quête, besoins, autre joueur | |
| C | KeyC | ouvrir le carnet à son dernier onglet | fermer le carnet |
| B | KeyB | mode déco, dans le logement | sortir du mode déco |
| Entrée | Enter | | action principale de la sélection (acheter, vendre, manger, suivre la quête) |
| Retour arrière | Backspace | | fermer, revenir |
| Échap | Escape | pause de Duo | pause de Duo (ne ferme aucun menu du jeu: modèle gardé) |

Règles: aucune touche de la rangée des chiffres n'est obligatoire (Tab fait le tour de la barre); les touches sont reconfigurables (cahier, section 5); anti-double-appui de 300 ms à l'ouverture d'un écran; une touche maintenue ne valide jamais deux fois; le focus revient à l'endroit d'où l'on vient. La molette quitte le choix d'outil (usage actuel) pour le zoom: à dire dans l'arrivée en train.

Exception du mode déco (réponse 52): saisir, glisser et poser se font à la souris. Le clavier y garde: W et X ou molette pour tourner le meuble, Retour arrière pour sortir, A et E pour changer de rayon du stock.

## 5. Fiches des écrans

Chaque fiche: but, contenu, états, animations et 3D, commun ou propre, accessibilité, 1366x768.

### 5.1 HUD en jeu

Voir section 3. États: jour, nuit, besoin bas, besoin à zéro, cible visée, cible impossible, coup d'œil, attente de l'autre (train), autre joueur déconnecté (modèle de Duo: bandeau « Connexion perdue avec Sacha », le monde se fige). Propre à chaque joueur: tout le HUD. Commun: les onomatopées, les bulles des habitants (chacun voit celles qui le concernent), l'état visible des personnages.

### 5.2 Dialogue

Maquette: `maquettes/dialogue.html`.

- **But**: lire une histoire confortablement, répondre sans hésiter. Réponses 37, 38, 63: une vraie fenêtre, en bas, avec portrait, lettre par lettre, babil.
- **Contenu**: bandeau de papier en bas (1040 px de large au plus, 168 px de haut). À gauche, le portrait en buste de l'habitant, en 3D, qui déborde du bandeau vers le haut; sous lui, une plaque avec son nom et ses cœurs d'amitié. Le texte: 3 lignes au plus de 60 caractères, taille 18 px (comme aujourd'hui). En bas à droite, la touche Espace et un triangle qui rebondit quand la phrase est finie. Les choix (2 à 4) s'empilent au-dessus du bandeau, à droite: une icône quand le choix est une action (donner, acheter, accepter la quête), 6 mots au plus.
- **États**: phrase en cours d'écriture; phrase finie (attente); choix; choix qui échouera (goutte barrée: hygiène); « Donner » ouvert (les cases du sac en rangée au-dessus du bandeau, Espace donne); réaction (cœur gagné qui vole vers la plaque, ou « ... » déçu); scène à deux (les deux portraits de joueurs en petit à droite du bandeau, jeton de celui qui choisit); l'autre joueur n'est pas encore là pour une scène à deux (« Attends Sacha » avec son jeton et sa distance en pas).
- **Animations et 3D**: le bandeau monte en 320 ms, le portrait arrive 80 ms après avec un léger rebond. Le texte s'écrit à 40 caractères par seconde (trois vitesses aux réglages), pause de 150 ms après « . », « ! », « ? ». Babil: une syllabe sonore toutes les 3 lettres, hauteur propre à chaque habitant. Le portrait bouge la bouche pendant l'écriture et change d'expression par balise du texte (joie, surprise, contrarié, pensif). Espace pendant l'écriture: toute la phrase d'un coup. La caméra du monde se rapproche et cadre l'habitant au-dessus du bandeau. Les mots clés d'une quête (lieu, objet, personne) sont en gras et en couleur d'encre bleue, jamais par la seule couleur.
- **Commun ou propre**: une conversation ordinaire est propre au joueur qui parle; l'autre voit « ... » au-dessus des deux têtes et peut continuer sa vie. Une scène d'histoire à deux s'affiche chez les deux: chacun avance le texte à son rythme (la phrase suivante attend que les deux aient appuyé, jetons cochés), et celui qui a lancé la scène choisit les réponses (question 5).
- **Accessibilité**: texte encre sur papier (12,7:1). Vitesse du texte réglable, dont « instantané ». Babil réglable et coupable. Animations réduites: phrase affichée d'un coup, portrait fixe sur l'expression. Le choix au focus porte un double anneau et un chevron, pas seulement une couleur.
- **1366x768**: le bandeau fait 1040 x 168 px, marge basse de 16 px; le portrait fait 190 x 230 px; 4 choix de 44 px tiennent au-dessus (bandeau et choix: 380 px au plus, la moitié haute de l'écran reste au monde). À 150 %, le bandeau prend toute la largeur et le portrait se réduit à 140 px.

### 5.3 Carnet (coque commune)

Maquette: `maquettes/carnet-sac.html`.

- **But**: un seul objet à ouvrir pour tout retrouver (réponse 61).
- **Contenu**: un carnet ouvert à plat, deux pages (1064 x 608 px, plus les signets). Sept onglets en signets de tissu sur la tranche droite, en images seulement; le signet ouvert sort davantage et montre son nom. Ordre: Sac, Quêtes, Habitants, Collections, Carte, Tenues, Réglages. En haut de la page de gauche: le jeton du joueur, son prénom et ses trois besoins (toujours visibles ici). L'heure et la bourse ne sont pas répétées: le HUD reste visible au-dessus du carnet. En pied: les touches utiles en pictos (A, E onglets; Retour arrière fermer).
- **États**: fermé; en ouverture; ouvert sur un onglet; onglet avec nouveauté (pastille ronde rouge tampon avec un point, pas de nombre); changement de page.
- **Animations et 3D**: le carnet monte du bas, la couverture pivote sur la reliure (perspective CSS, 600 ms au total), les signets sortent l'un après l'autre (40 ms d'écart). Changer d'onglet: une page tourne (320 ms). Fermer: 200 ms, plus court que l'ouverture. Le personnage, dans le monde, sort son carnet: l'autre joueur voit qu'on est occupé. Le monde continue (jeu à deux, pas de pause), assombri derrière.
- **Commun ou propre**: propre à chaque joueur. Quêtes, habitants rencontrés, carte et collections sont communs dans leur contenu; sac, tenues, cœurs d'amitié et réglages sont propres.
- **Accessibilité**: `role="tablist"`, nom accessible sur chaque signet, étiquette au survol et au focus. Animations réduites: fondu de 120 ms, aucune rotation.
- **1366x768**: 1064 x 608 px, à 108 px du haut: l'horloge et la bourse restent entières au-dessus à gauche; les signets dépassent de 56 px à droite (96 px pour le signet ouvert). À 150 %: le carnet occupe tout l'écran et la page de droite (détail) passe sous la grille en un bandeau de 120 px.

#### Onglet Sac

- **But**: voir ce qu'on porte, ranger, utiliser. Réponses 20, 62, 65.
- **Contenu**: page de gauche: la barre d'outils (rangée sur bois), puis le sac: 4, 6, 10, 15 ou 20 cases selon le sac possédé. Chaque case: l'objet en image, sa pile en pastille « 2/3 » (possédés sur maximum de la pile; pleine: pastille pleine et petit trait). Page de droite: l'objet choisi en 3D qui tourne sur un socle, son nom (4 mots au plus), une ligne au plus, des pastilles (qui l'achète, avec le portrait du commerçant et son prix une fois découvert; l'effet d'un plat sur les besoins), puis un seul bouton d'action (Manger, Prendre en main, Lire) et « Poser ».
- **États**: **aucun sac** (début du jeu): la barre d'outils seule, et dessous la silhouette en pointillé d'un sac avec un cadenas et le portrait de qui en vend; sac de 4 à 20 cases (les cases que le sac n'a pas ne sont pas dessinées: on ne montre pas un manque permanent); case vide; pile pleine; sac plein (bord du sac hachuré); objet nouveau (point rouge tampon); déplacement en cours (la pile suit le focus, légèrement levée).
- **Animations et 3D**: au survol ou au focus d'une case, la vignette se soulève (4 px) et l'objet tourne; le grand objet du détail tourne lentement en continu (un tour en 8 s), W et X le tournent à la main. Un objet qui arrive dans le sac tombe dans sa case avec un rebond.
- **Propre** à chaque joueur.
- **Accessibilité**: nom complet lu par le lecteur d'écran sur chaque case; pile lue « 2 sur 3 »; animations réduites: l'objet ne tourne que sur W et X.
- **1366x768**: cases de 84 px, 5 colonnes; 20 cases = 4 rangées (372 px) sous la barre d'outils (72 px): pas de défilement.

#### Onglet Quêtes

- **But**: suivre l'histoire du lieu sans liste de corvées (réponses 27, 68, 70).
- **Contenu**: page de gauche: l'histoire principale du lieu en haut (une grande carte illustrée, avec ses chapitres en perles: faites, en cours, à venir), puis les histoires secondaires en cartes (portrait de l'habitant, titre, perles), puis « demandes du jour » en une rangée de petits portraits. Page de droite: l'étape en cours en une ou deux phrases (ici le texte est permis: c'est de la narration), les objets demandés en compteurs « 1/4 », le lieu en vignette de la carte, la récompense en pastilles, et le bouton « Suivre » (une seule quête suivie; c'est elle que montre F).
- **États**: aucune quête (« Va parler aux habitants », avec la bulle des habitants dessinée); quête suivie (ruban); étape qui demande d'être deux (deux jetons); terminée (tampon).
- **Animations**: une étape validée se tamponne (200 ms, petit choc sonore), la perle se remplit.
- **Commun** aux deux joueurs pour l'avancement; la quête suivie est propre à chacun.
- **1366x768**: 1 carte principale et 4 secondaires par page; A et E tournent les pages.

#### Onglet Habitants

- **But**: se souvenir de qui est qui et voir l'amitié monter (réponse 39).
- **Contenu**: page de gauche: grille de portraits (5 colonnes), sous chacun ses cœurs (5 cœurs, remplis par moitié; cœur plein: forme pleine, vide: contour). Page de droite: l'habitant en buste 3D, son nom, son métier en picto, ses cœurs en grand, ce qu'il aime et n'aime pas (vignettes découvertes en lui offrant, « ? » sinon), ce qu'il rachète et à quel prix (une fois vu), et « ce qu'il se rappelle » de nous: 3 souvenirs au plus en vignettes (réponse 41). Bouton « Voir sur la carte ».
- **États**: pas encore rencontré (silhouette en pointillé, sans nom); rencontré; a quelque chose pour nous (la même bulle que dans le monde, en coin du portrait).
- **Commun**: la liste des habitants rencontrés. **Propre**: les cœurs (chacun son amitié; le jeton de l'autre joueur montre son niveau en petit).
- **Animations**: un cœur gagné depuis la dernière ouverture se remplit à l'ouverture, avec un battement.

#### Onglet Collections

- **But**: l'envie de compléter (réponses 55, 56: dans le carnet seulement).
- **Contenu**: huit familles en signets internes à images (poissons, insectes, fossiles et trésors, fleurs, tenues, recettes, cartes postales et photos, musiques), chacune avec son compteur « 12/30 ». Grille de 6 colonnes; non trouvé: silhouette grise en pointillé; trouvé: l'image, liseré de rareté (épaisseur et motif, pas seulement couleur). Détail: l'objet en 3D qui tourne, nom, quand et où le trouver en pictos (saisons, moments, météo, lieu), le jeton de qui l'a trouvé en premier. Musiques: un bouton écouter.
- **Commun** aux deux joueurs.
- **Animations**: une page de collection complète reçoit un tampon doré.

#### Onglet Carte

- **But**: remplacer le plan incompris (R12) par une vraie carte dessinée (réponse 66).
- **Contenu**: les deux pages ne font qu'une image: carte illustrée du lieu, avec rues, rivière, voie ferrée, bâtiments dessinés reconnaissables (une boulangerie a son enseigne en image). Dessus: les portraits ronds des habitants rencontrés là où ils sont, le jeton des deux joueurs (forme et couleur), le losange de la quête suivie, les bulles « j'ai quelque chose ». Un curseur (Z Q S D) saute de lieu en lieu; le lieu choisi affiche son nom et les portraits de qui s'y trouve. En coin: la ligne de train et les autres lieux visités, en gares.
- **États**: lieu jamais visité (dessin au crayon, sans couleur); habitant inconnu (non affiché); intérieur (l'habitant est montré sur son bâtiment); nuit (habitants chez eux, petite lune).
- **Animations**: les portraits glissent quand les habitants se déplacent (mise à jour toutes les 2 s); le jeton du joueur bat doucement.
- **Commun** pour le contenu; le curseur est propre.
- **Accessibilité**: liste des lieux navigable au clavier, chaque lieu lu avec ses occupants.
- **1366x768**: la carte tient entière (1030 x 550 px utiles), sans défilement ni zoom pour Aubrune; un lieu plus grand ajoute un zoom à deux crans (flèches haut et bas).

#### Onglet Tenues

- **Contenu**: le personnage en pied, en 3D, à gauche (A et E changent d'onglet, donc W et X le tournent); à droite, sept rayons en pictos (hauts, bas, robes et salopettes, chaussures, chapeaux, lunettes, sacs et accessoires), les pièces possédées en vignettes, la couleur en pastilles. Entrée met la pièce; l'aperçu change tout de suite.
- **États**: pièce portée (coche), pièce nouvelle (point), rayon vide (cintre en pointillé et portrait de qui en vend).
- **Propre** à chaque joueur; l'autre voit le changement dans le monde à la fermeture du carnet.

#### Onglet Réglages

Peu d'images possibles: c'est le seul onglet en texte. Volume (musique, sons, babil), vitesse du texte, barre d'outils toujours visible, besoins toujours visibles, secousses d'écran, puis un renvoi vers les réglages de Duo (taille de l'interface, animations réduites, plein écran), qui restent à la plateforme. Chaque réglage montre son effet tout de suite (la phrase d'exemple se réécrit à la nouvelle vitesse).

### 5.4 Boutique

Maquette: `maquettes/boutique.html` (états `#acheter` et `#vendre`).

- **But**: acheter et vendre sans se tromper, et comprendre d'un regard que chaque commerçant a ses goûts et ses prix (réponses 34, 64).
- **Contenu**: à gauche, le commerçant en buste 3D derrière son comptoir, son nom et son métier en picto; il réagit. Deux grands onglets à images: **Acheter** (une étagère) et **Vendre** (ton sac et une flèche vers le comptoir). Au centre, la grille de vignettes avec le prix en pastille. À droite, le détail: l'objet en 3D qui tourne, son nom, son usage en pastilles, la quantité (Q moins, D plus), le total, un seul bouton. La bourse du HUD reste visible au-dessus du panneau: c'est vers elle que volent les pièces.
  - Acheter: ce que tu ne peux pas payer a sa pastille de prix barrée d'un trait et la pièce en pointillé.
  - Vendre: seul ton sac est montré. Ce que ce commerçant rachète est en tête, avec **son** prix. Ce qu'il ne rachète pas est rangé à la fin, grisé, en pointillé, avec le picto « main qui refuse »; au focus, le détail montre le portrait de qui le rachète, si on le sait déjà.
  - Mémoire des prix: au détail d'un objet à vendre, les portraits des commerçants à qui on l'a déjà vendu, avec leur prix; le meilleur porte une petite couronne. On apprend ainsi que le boulanger paie mieux les œufs que l'épicière, sans une phrase.
- **États**: acheter; vendre; rien à vendre ici (sac en pointillé, le commerçant hausse les épaules); bourse insuffisante; sac plein (achat impossible: la case « sac » hachurée); achat fait (pièces qui volent de la bourse au commerçant, l'objet saute dans le sac); vente faite (l'inverse); gros achat payé par le coffre commun (pastille du coffre avec les deux jetons, et demande d'accord envoyée à l'autre: « Sacha veut payer 400 avec le coffre », D'accord ou Pas maintenant); boutique fermée (dit par l'habitant en dialogue, pas par ce menu).
- **Animations et 3D**: le buste du commerçant hoche la tête à l'achat, fait « non » à un refus; onomatopée « ♪ » pour une belle vente. Les pièces volent une par une (5 au plus, 400 ms). L'objet du détail tourne.
- **Propre** à chaque joueur (chacun sa bourse, réponse 10); deux joueurs peuvent être dans la même boutique en même temps, chacun dans son menu. Le stock limité d'un article se met à jour chez les deux.
- **Accessibilité**: prix lus « 2 pièces l'unité »; l'article refusé est annoncé « Odette n'en veut pas »; aucun état porté par la seule couleur (trait, pointillé, picto).
- **1366x768**: panneau de 1180 x 608 px à 108 px du haut; commerçant 248 px, grille de 6 colonnes de 84 px (18 articles par page, pages à la molette ou aux flèches de page), détail 328 px.

### 5.5 Basse-cour

Maquette: `maquettes/basse-cour.html`.

- **But**: comprendre en trois secondes: mes poules, leur nourriture, leurs œufs (réponse 31, R20). Une seule nourriture, un seul geste par chose.
- **Contenu**: la caméra du jeu vient se placer devant le poulailler, vu en coupe comme une maison de poupée (c'est la scène 3D du jeu, pas une image). Trois zones, toujours dans le même ordre, de gauche à droite: **la mangeoire** (un seul grain; un anneau et « 3 j »: ce qu'il reste en jours), **les poules** (elles se promènent; chacune a son nom et son cœur au focus), **le nid** (les œufs pondus, comptés « 4 »). Sous la scène, une rangée de petites cartes: une par poule (portrait, cœur, picto « a pondu » ou « couve ») et les places libres en pointillé.
- **Gestes**: Q et D passent d'une zone à l'autre (ou d'une poule à l'autre), Espace fait le geste que dit la bulle: **Remplir** (prend le grain du sac; autant que possible d'un coup), **Caresser** (un cœur monte), **Ramasser** (tous les œufs d'un coup, ils volent vers le sac). Retour arrière: sortir.
- **Vu du dehors**: l'état de la mangeoire se lit d'un coup d'œil sans ouvrir le menu. La mangeoire du monde montre son niveau de grain (modèle à trois états: pleine, basse, vide), les poules portent « ?? » quand elle est vide, et la bulle d'action du poulailler montre un œuf et son nombre quand il y a des œufs à ramasser.
- **Autonomie**: une mangeoire pleine nourrit plusieurs jours; les œufs s'accumulent au nid jusqu'à un plafond. On peut oublier la basse-cour deux jours sans rien perdre (hypothèse à fixer par le game designer).
- **États**: mangeoire pleine, basse (anneau hachuré, les poules regardent la mangeoire), vide (« ?? » au-dessus des poules, pas d'œuf); pas de grain dans le sac (bulle: le sac de grain barré et le portrait de qui en vend); nid vide; nid plein (les œufs débordent, « !! »); sac plein (on ramasse ce qui tient, le reste reste au nid); poulailler vide (places en pointillé et portrait de qui vend des poules); l'autre joueur est aussi là (son personnage est visible dans la scène, les gestes sont partagés tout de suite).
- **Animations et 3D**: entrée par un mouvement de caméra de 600 ms, le toit se soulève. Les poules picorent quand on remplit, s'ébrouent quand on caresse. Les œufs sautent un par un vers le sac (5 au plus, puis un compteur).
- **Commun**: la basse-cour appartient aux deux; tout y est partagé et synchronisé. Propre: le focus.
- **Accessibilité**: les trois zones sont trois boutons nommés (« Mangeoire: 3 jours de grain », « Nid: 4 œufs »); animations réduites: coupe franche au lieu du mouvement de caméra.
- **1366x768**: la scène prend tout l'écran; bulles de zone de 44 px; rangée de cartes de 88 px en bas (8 poules visibles, pages au-delà).

### 5.6 Cuisine (mini-jeu)

- **But**: cuisiner est un petit plaisir de 15 à 30 secondes (réponse 32); le réchaud ne fait que les recettes de base, la vraie cuisine fait les autres et les grands repas à deux (réponse 26).
- **Contenu**: 1) le livre de recettes: cartes en images (le plat, les ingrédients en compteurs « 2/2 », l'effet sur les besoins), recettes inconnues en silhouette; 2) le mini-jeu, cadré sur le plan de travail en 3D: 2 à 4 étapes selon la recette, chacune un geste lisible avec la seule touche Espace et Q, D (couper: appuyer en rythme; cuire: relâcher dans la zone; remuer: alterner Q et D). Une frise d'étapes en pictos en haut, une jauge unique au centre; 3) le plat: il apparaît en 3D, une à trois étoiles (forme pleine ou contour).
- **États**: ingrédient manquant (grisé, pointillé, compteur barré); recette trop grande pour le réchaud (picto de la cuisine); étape réussie, moyenne, ratée (jamais d'échec total: le plat est moins bon, réponse du ton « tendre »); grand repas à deux (les deux joueurs ont chacun leur étape, côte à côte); l'autre n'est pas là pour un grand repas.
- **Animations et 3D**: ingrédients qui sautent dans la poêle, vapeur, particules; secousse légère au coup de couteau (réglable).
- **Propre** pour une recette simple; **commun** pour un grand repas.
- **Accessibilité**: réglage « cuisine tranquille »: fenêtres de temps doublées; aucun geste ne demande de marteler une touche plus de 3 fois par seconde.
- **1366x768**: frise 56 px en haut, jauge 480 x 40 px au centre bas, le reste à la scène.

### 5.7 Mode déco

- **But**: meubler vite et avec plaisir (réponse 52).
- **Contenu**: la caméra monte au-dessus de la pièce (vue du dessus, murs abaissés). À gauche, le stock de meubles en vignettes par rayon (séries assorties: la série en liseré). On saisit un meuble à la souris, on le glisse, il s'aimante à la grille, on le pose. Molette ou W et X: tourner. Clic droit: le ranger au stock. Une pastille montre les couleurs de la série. En bas, trois boutons: annuler le dernier geste, tout valider, sortir.
- **États**: meuble en main; place valide (ombre pleine); place impossible (ombre hachurée rouge tampon et le meuble tremble); meuble tenu par l'autre joueur (liseré et jeton à sa couleur, non saisissable); dehors, autour de la maison (réponse 53): même mode, limite du terrain en pointillé.
- **Animations**: le meuble se soulève à la saisie, se pose avec un rebond et une petite poussière.
- **Commun**: les deux joueurs peuvent décorer en même temps; chacun voit le curseur de l'autre (son jeton).
- **Accessibilité**: seul écran qui exige la souris (décision du client). Le cahier doit le dire dans les limites connues. Cibles de 44 px au moins.
- **1366x768**: stock de 232 px à gauche, repliable (touche C), la pièce occupe le reste.

### 5.8 Éditeur de personnage

- **But**: se créer en deux minutes un personnage qu'on aime (réponse 47), puis y revenir au miroir ou chez le coiffeur.
- **Contenu**: le personnage en pied, en 3D, au centre gauche, sur un quai de gare; il réagit (sourit, tourne sur lui-même à un changement de tenue). À droite, six rayons en signets à images: visage, yeux, cheveux, peau, corpulence (âge: enfant, adulte, âgé; 2 à 3 corpulences), tenue. Chaque rayon: une grille de pièces du catalogue en vignettes (rendu 3D de la pièce), et dessous les couleurs en pastilles. En bas: le prénom (seul champ de texte), « Au hasard » (un dé) et « C'est parti ! ».
- **États**: première création (chacun sur sa machine, en même temps; en coin, le portrait de l'autre et sa puce « C'est parti » ou « Pas encore »); attente de l'autre; retouche en jeu (seuls les rayons que le lieu permet); prénom vide ou refusé (message sous le champ: « Écris un prénom pour continuer. »).
- **Animations et 3D**: la pièce choisie apparaît avec un petit « pop »; W et X tournent le personnage, il tourne seul d'un quart de tour quand on change de rayon (les cheveux se voient de trois quarts).
- **Propre** à chaque joueur; le résultat est commun.
- **Accessibilité**: chaque pièce a un nom lu; les couleurs de peau et de cheveux sont nommées; aucune pièce n'est réservée à un genre.
- **1366x768**: personnage 420 x 600 px, rayons 6 colonnes de 84 px (18 pièces par page: une quinzaine par catégorie tient en une page).

### 5.9 Moments communs

| Moment | Ce qu'on voit | Commun ou propre |
|---|---|---|
| La nuit tombe (réponse 4) | l'horloge passe au bleu; à l'heure limite, fondu commun, puis le bilan de la journée en images (gains, cœurs, trouvailles de chacun), Espace des deux pour continuer | commun |
| Dormir plus tôt (dès 15 h) | Espace sur le lit: « Dormir » demande l'accord de l'autre (carte en haut à droite chez lui: D'accord, Pas maintenant) | commun |
| Prendre le train (réponse 9) | sur le quai, la bulle montre deux jetons; le second joueur voit l'avis « Camille t'attend au train » et sa flèche; départ quand les deux sont à bord | commun |
| Coffre commun (réponse 10) | menu à deux colonnes: ta bourse, le coffre; Q et D déplacent par 10, Entrée valide | propre, solde commun |
| Connexion perdue | modèle de Duo: bandeau, monde figé, « On t'attend, Sacha », retour automatique | commun |

## 6. Règles d'animation

| Jeton | Durée | Usage |
|---|---|---|
| `--lpl-duration-fast` | 120 ms | réponse à un appui (enfoncement, focus) |
| `--lpl-duration-base` | 200 ms | apparition d'une bulle, d'un médaillon, rebond d'un objet visé |
| `--lpl-duration-slow` | 320 ms | bandeau de dialogue, page qui tourne, panneau |
| `--lpl-duration-scene` (nouveau) | 600 ms | ouverture du carnet, mouvement de caméra vers un menu de métier |
| `--lpl-duration-hint` (nouveau) | 3 s | coup d'œil (G), barre d'outils avant repli |

| Courbe | Valeur | Usage |
|---|---|---|
| `--lpl-ease` (existante) | `cubic-bezier(0.2, 0.7, 0.3, 1)` | entrées et déplacements |
| `--lpl-ease-bounce` (nouvelle) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | rebonds: objet visé, vignette, gain |
| `--lpl-ease-out` (nouvelle) | `cubic-bezier(0.4, 0, 1, 1)` | sorties, toujours plus courtes que l'entrée (les deux tiers) |

Règles:

1. Une animation répond à un geste ou annonce un changement; rien ne bouge en boucle à l'écran en dehors de l'objet visé, de l'objet 3D du détail et du triangle « suite ».
2. La réponse à un appui commence en moins de 100 ms; aucun menu ne bloque les touches pendant son ouverture.
3. Seulement `transform` et `opacity` côté HTML; ni flou ni filtre (PC de référence).
4. Secousse d'écran (réponse 22): 4 px au plus, 150 ms, réservée aux gros coups (hache, pioche, grosse prise), réglable et coupée par les animations réduites.
5. Particules: 12 au plus par geste, 600 ms.
6. Aucune animation d'interface ne retient le joueur plus d'une seconde et demie: ouverture du carnet 600 ms, entrée en basse-cour 600 ms, vol des gains sans blocage des touches. La fête d'une prise nouvelle se passe d'un appui.
7. **Animations réduites** (réglage de Duo, sinon celui de l'ordinateur): fondus de 120 ms à la place des glissements et des rotations; pas de rebond, pas de secousse, pas de vol de pièces (le nombre change); texte affiché phrase par phrase; les objets 3D ne tournent que sur W et X; la brillance de l'objet visé devient un liseré fixe.

## 7. Composants communs

| Composant | Rôle | États |
|---|---|---|
| Vignette (`tile`) | case carrée de 84 px: image de l'objet, pastille en haut à droite, marque en haut à gauche | repos, survol, focus (double anneau), choisie, vide, manquante (pointillé, barrée), refusée, nouvelle, verrouillée |
| Pastille (`pastille`) | une icône et un nombre: prix, pile, compteur | normale, pleine, insuffisante (barrée), dorée |
| Fenêtre 3D (`viewport3d`) | emplacement d'un objet ou d'un buste rendu par le jeu | tourne, à l'arrêt, en chargement (silhouette), secours (image fixe) |
| Étiquette de nom (`nametag`) | nom de 4 mots au plus, au survol et au focus, dans les menus seulement | une seule visible à la fois (corrige R09: elle suit le focus ou la souris, le dernier qui a bougé) |
| Médaillon de besoin (`need`) | picto et anneau | caché, bonus (étoile), normal, bas (hachures, pointillé, battement), zéro |
| Bulle d'action (`prompt`) | touche, picto, verbe | possible, impossible (ce qui manque en image) |
| Bulle d'habitant (`npc-bubble`) | « j'ai quelque chose »: histoire (plume), demande (main), cadeau (paquet) | loin (réduite), proche |
| Onomatopée (`emote`) | signes stylisés dans le monde | « !! », « ?? », « ... », « Zzz », « ♪ », cœur, « Pouah » |
| Bandeau de dialogue (`dialogue`) | portrait, plaque du nom, texte, choix | voir 5.2 |
| Signet (`tab`) | onglet à image | fermé, ouvert (nom visible), nouveauté |
| Touche (`key`) | capuchon de touche, libellé selon le clavier réel | |
| Jeton de joueur (`token`) | couleur du profil Duo et forme (rond pour l'hôte, losange pour l'invité), anneau d'encre | soi, l'autre, occupé, absent |
| Cœurs (`hearts`) | 5 cœurs, par moitiés | vide (contour), moitié, plein, gagné (battement) |
| Avis (`notice`) | une icône, 6 mots au plus, un seul à la fois | information, demande de l'autre (deux boutons), erreur avec ce qu'il faut faire |
| Bouton (`button`) | une action par panneau en bouton principal | repos, survol, focus, enfoncé, désactivé (jamais seul: dit pourquoi en image) |

Jetons de couleur, de police et d'espacement: ceux de `games/la-petite-ligne/ui-maquettes/jeton.css` (papier, encre, bois, laiton, vert locomotive, rouge tampon, bleu nuit), repris tels quels dans `maquettes/refonte.css` en attendant la bible artistique de la refonte. Taille des textes inchangée (réponse 67): base 16 px, répliques 18 px, compteurs 13 px.

## 8. Ce que l'interface demande au rendu 3D

À arbitrer par architecte-technique et tech-artist; voici le besoin.

| Besoin | Quantité | Budget proposé |
|---|---|---|
| Vignettes d'objets (sac, boutique, collections, catalogue de pièces) | jusqu'à 30 à l'écran | **images fixes**, pas de 3D vivante: rendues une fois depuis le modèle (à la fabrication du jeu, en planche WebP; 128 px, et 256 px pour les écrans à facteur 2), même angle trois quarts pour toutes |
| Objet qui tourne (survol d'une case, détail) | **1 seul à la fois** | l'objet survolé remplace sa vignette par le modèle vivant; le détail montre le même objet. Modèle d'interface: 3 000 triangles au plus, une texture de 512 px, un éclairage fixe à trois lampes sans ombre portée. 30 images par seconde suffisent |
| Buste d'habitant (dialogue, boutique, habitants) | 1 à la fois | le vrai personnage, cadré épaules et tête, 4 expressions au moins (neutre, joie, surprise, contrarié) et la bouche qui babille (2 poses) |
| Personnage en pied (éditeur, tenues) | 1 à la fois | le vrai personnage; changement de pièce en moins de 200 ms (pièces du rayon ouvert préchargées) |
| Scène de menu (basse-cour, cuisine, déco) | la scène du jeu elle-même | une caméra de menu par lieu, mouvement de 600 ms |
| Total vivant en même temps dans un menu | **2 fenêtres 3D au plus** (un objet et un buste, en boutique) | |

Conséquences:

- Quand le carnet ou la boutique couvre l'écran, le monde derrière n'a pas besoin d'être rendu à pleine cadence: une image du monde rafraîchie une fois par seconde, assombrie, libère le processeur graphique du PC pour l'objet qui tourne. Le jeu, lui, continue (l'autre joueur joue).
- Les fenêtres 3D sont des rectangles dont le HTML donne la place et la taille; le rendu doit pouvoir y dessiner, avec un fond transparent et un masque arrondi posé par le HTML.
- Dans le monde: liseré et brillance de l'objet visé (un seul objet à la fois), rebond d'échelle, bulles et onomatopées en panneaux toujours face à la caméra, à taille constante à l'écran, jamais cachés par le décor proche (réponse 37: « les bulles ne sont jamais visibles » aujourd'hui).
- Secours: si une fenêtre 3D ne peut pas s'afficher, la vignette fixe la remplace; aucun menu ne dépend de la 3D pour être compris.
- Réponse 73 (la beauté avant la fluidité) vaut pour le monde; dans les menus, la réponse aux touches reste sous 100 ms.

## 9. Ce qui change par rapport à l'interface actuelle

| Aujourd'hui | Refonte | Pourquoi |
|---|---|---|
| portrait, endurance, objectif, autre joueur, boutons de caméra et barre d'outils en permanence | heure et bourse | réponse 60 |
| contour blanc de la cible, zones sans objet | l'objet rebondit et brille, bulle avec le verbe; aucune zone sans objet | réponse 21, R05, R11, R17, R21 |
| objectif affiché en permanence | touche G, 3 secondes | réponse 68 |
| carnet à 7 onglets, caisse, catalogue, garde-robe à part | un carnet, sept signets en images | réponse 61 |
| plan « Le bourg » abstrait | carte dessinée sur deux pages, habitants en portraits | réponse 66, R12 |
| basse-cour en tuiles d'état, foin et grain | la scène 3D, trois zones, une nourriture, trois gestes | réponse 31, R20 |
| bulles au-dessus des têtes | bandeau en bas avec portrait | réponses 37, 63 |
| A et E par quarts de tour, molette pour l'outil | A et E en continu, molette pour le zoom, Tab pour l'outil | réponse 17 |
| étal du marché, vente à Odette | vente chez chaque commerçant selon son métier, mémoire des prix | réponse 34 |

### 9.1 Correspondance avec les règles de ressenti

| Règle (`references-de-ressenti.md`, section 3) | Où dans ce document |
|---|---|
| Réponse en moins d'un dixième de seconde, l'objet touché bouge | principe 3, section 6 (règle 2) |
| Cible toujours montrée avant d'agir, une seule, jamais de zone sans objet | 3.2 (bulle d'action), principe 3 |
| Prise nouvelle fêtée, prise connue rapide | 3.2 (prise nouvelle) |
| Caméra proche, rotation libre, zoom à la molette | section 4 |
| Dialogue: bandeau, portrait, lettre par lettre, babil, une touche pour tout afficher puis continuer, trois lignes au plus par page | 5.2 |
| Émotion lisible au-dessus de la tête | 3.2 (onomatopée), section 7 |
| Aucune action courante ne bloque plus d'une seconde et demie | section 6 (règle 7) |
| L'heure et l'argent; les besoins seulement quand ils changent d'état | 3.1, 3.3 (et affichage maintenu sous 20, comme le cahier, 4.4) |
| État de la mangeoire visible d'un coup d'œil | 5.5 (« Vu du dehors » et anneau « 3 j ») |

## 10. Accessibilité, résumé

- Contrastes: encre sur papier 12,7:1; encre atténuée 6,8:1; texte clair sur bois 9,1:1; sur nuit 8,9:1 (valeurs des jetons existants). Les éléments posés sur le monde (bulles, médaillons) ont toujours leur fond de papier et un bord d'encre: jamais de texte directement sur la scène.
- Deux joueurs: couleur du profil Duo et forme (rond, losange), avec anneau d'encre.
- États doublés par une forme: hachures (bas, plein), pointillé (manque, inconnu), trait (insuffisant), cadenas, coche, tampon.
- Taille de l'interface de Duo (100, 125, 150 %) respectée: tout est en `rem`.
- Réglages propres au jeu: vitesse du texte, babil, secousses, barre d'outils et besoins toujours visibles, cuisine tranquille.

## 11. Questions pour le client

| N° | Question | Recommandation |
|---|---|---|
| 1 | La barre d'outils se replie-t-elle toute seule (elle revient dès qu'on change d'outil ou qu'on ramasse quelque chose), ou reste-t-elle toujours affichée ? | Elle se replie: c'est ton choix « presque rien à l'écran », et l'outil se voit dans la main. Un réglage permet de la garder affichée. |
| 2 | Les trois besoins: affichés quand l'un d'eux change de palier et tant qu'il est sous 20 (sinon c'est le personnage qui montre sa faim, sa fatigue, sa saleté; G les rappelle), ou toujours affichés en petit ? | Aux changements de palier et sous 20, avec un réglage « toujours visibles ». |
| 3 | La touche G montre pendant 3 secondes la direction de la quête. Peut-elle montrer en même temps tes besoins et où est l'autre joueur ? | Oui: une seule touche « où j'en suis » à retenir. |
| 4 | La bulle d'action: la touche, une image et un verbe (« Arroser »), ou la touche et l'image seulement ? | Avec le verbe: un seul mot, et plus aucun doute sur ce que fait Espace. |
| 5 | Scènes d'histoire à deux: les deux voient le même bandeau, et qui choisit les réponses ? | Celui qui a lancé la scène choisit, l'autre voit son choix; la phrase suivante attend l'appui des deux. |
| 6 | Le nom de la nouvelle monnaie doit-il s'afficher ? | Non: une pièce dessinée et un nombre suffisent partout, quel que soit le lieu. Le nom ne sert qu'aux dialogues. |
| 7 | En boutique, le carnet retient-il le prix que chaque commerçant t'a déjà payé pour un objet (portraits et prix au moment de vendre) ? | Oui: on découvre soi-même qui paie le mieux, et on ne l'oublie pas d'une séance à l'autre. |
| 8 | Sur la carte, voit-on tous les habitants ou seulement ceux déjà rencontrés ? | Seulement ceux rencontrés: les autres restent une surprise. |
| 9 | Changer de tenue: partout depuis le carnet, ou seulement devant une armoire ou un miroir ? | Partout depuis le carnet pour les tenues possédées; coiffure et visage chez le coiffeur ou au miroir. |
| 10 | Mode déco: les deux peuvent-ils décorer en même temps ? | Oui, chacun voit le curseur de l'autre; un meuble tenu par l'un ne peut pas être pris par l'autre. |
| 11 | Le mode déco ne se joue qu'à la souris (ta demande). Le reste du jeu reste-t-il entièrement jouable au clavier seul ? | Oui: c'est la seule exception. |

## 12. Hypothèses à confirmer par le cahier des charges

- Seuils des besoins: 0 %, 1 à 20 %, 20 à 50 %, 50 à 100 % (bonus), d'après la réponse 23.
- Barre d'outils de 5 cases (cahier, 4.5). Sacs de 4, 6, 10, 15, 20 cases. Piles: poisson 3, bûche 5, planche 10 (réponse 20).
- Courir avec Maj. Une action par cible; « Donner » passe par un choix du dialogue.
- Basse-cour: une seule nourriture, mangeoire pour plusieurs jours, nid qui garde les œufs.
- Monnaie: nom à choisir par le game designer; l'interface n'en dépend pas.
- Le monde ne se met jamais en pause dans un menu (jeu à deux); seule la pause de Duo fige la partie pour les deux.
- Polices et palette actuelles gardées jusqu'à la bible artistique de la refonte (directeur-artistique).

### 12.1 Écarts avec le cahier des charges (brouillon 0.1 du game designer)

Les deux documents ont été écrits le même jour. Ce document reprend du cahier: les touches (C carnet, G repère, Tab et 1 à 5 pour la barre, X mains libres, B mode déco, Maj courir), les 5 cases de la barre, les paliers des besoins et leur affichage sous 20, la flèche de quête au sol, la basse-cour à deux gestes (trémie de 20 rations, pondoir de 12: l'anneau montre les rations, « 3 jours » = rations divisées par le nombre de poules). Restent quatre écarts à trancher:

| Sujet | Cahier | Ce document | Recommandation |
|---|---|---|---|
| Barre d'outils | toujours à l'écran (section 5) | se replie après 3 s, réglage pour la garder | la replier (réponse 60: « presque rien »); question 1 au client |
| Voir ses besoins | Alt maintenue | G (coup d'œil), avec la quête et l'autre joueur | éviter Alt: sous Windows, Alt + Espace (la touche d'action) ouvre le menu système de la fenêtre, et Alt seule peut prendre le focus d'un menu. Une seule touche à retenir: G |
| Zoom | molette seulement | molette, et flèches haut et bas | garder un zoom au clavier: tout doit se faire sans souris hors mode déco |
| Onglets du carnet | histoire, sac, collections, voisins, carte | sac, quêtes, habitants, collections, carte, tenues, réglages (liste du client) | la liste du client; l'onglet des quêtes peut s'appeler « Histoire » |

## 13. Les maquettes

Dans `maquettes/`: pages HTML et CSS autonomes (aucun réseau), `refonte.css` (jetons et composants), `commun.js` (pictos, décor figuré, états par ancre), `capturer.cjs` (captures à 1366x768), `verifier.cjs` (touches, débordements, contrastes). Les polices sont celles du dépôt (`games/la-petite-ligne/ui-maquettes/polices/`, OFL), avec repli sur les polices du système.

| Page | États (ancres) | Ce qui bouge | Ce qu'on peut essayer |
|---|---|---|---|
| `hud.html` | `#jeu`, `#coup-d-oeil` | soleil du cadran, cible qui rebondit, bulle d'habitant, onomatopée, gain, médaillon qui bat | G: coup d'œil de 3 s |
| `dialogue.html` | `#parle`, `#choix` | bandeau qui monte, portrait, texte lettre par lettre, bouche, triangle « suite », choix | Espace: tout afficher, puis les choix |
| `carnet-sac.html` | `#sac`, `#sans-sac` | carnet qui s'ouvre, signets, objet du détail, survol des cases (nom et objet qui bouge) | survol à la souris |
| `boutique.html` | `#acheter`, `#vendre` | panneau, objet du détail, pièces qui volent vers la bourse (vendre) | A et E: acheter, vendre |
| `basse-cour.html` | `#normal`, `#vide` | caméra d'entrée, poules qui picorent, cœur, « ?? » | |

Tout ce qui tient lieu de 3D est marqué « 3D figurée » ou « Maquette: décor et objets 3D figurés »: décor, personnages, bustes et objets sont des dessins plats du studio. Un dessin plat ne peut pas faire un tour complet: il se balance; le vrai modèle tournera. `?reduit` avant l'ancre montre la version aux animations réduites.

Limites de ces maquettes: ce sont des images de référence pour valider la direction, pas des prototypes. Seules les touches du tableau répondent; la navigation complète au clavier (flèches dans les grilles, focus) n'y est pas câblée et reste à tester sur la démonstration du jeu.

## 14. Passation

Pour le dev du jeu, quand le client aura validé: les maquettes donnent les mesures et les textes exacts des cinq écrans clés; `maquettes/refonte.css` porte les jetons nouveaux (durées, courbes) et les composants de la section 7. À faire ensuite par ux-ui-designer: maquettes de l'éditeur de personnage, de la carte, de la cuisine et du mode déco; contrôle à 1280x720, 1920x1080, facteur 2, tailles 125 et 150 %; script de parcours au clavier.

## 15. Style encré (2026-11-10)

Habillage voulu par le client: une bande dessinée encrée, tendre et drôle. Papier chaud, encre presque noire, couleurs douces, un seul accent vif (bouton d'or). Il remplace l'habillage « bois et laiton » des sections 3 à 7 sans toucher aux écrans, aux touches ni aux parcours. Code: `games/la-petite-ligne-2/src/interface/encre/` (README pour ajouter un composant).

### Règles

- **Cases**: tout ce qui porte du texte est une case tracée à la plume: trait épais qui s'affine vers un coin, traits qui dépassent aux angles, bords un peu de travers, aucun coin arrondi. Trois tailles de trait: petit (3 px: vignettes, boutons, pastilles), moyen (3,6 px: bulles, cartouches, réponses), grand (4,6 px: bandeau de dialogue, carnet, boutique).
- **Ombres**: des hachures en bas à droite, jamais de flou ni de dégradé. Les touches ont une ombre pleine de 2 px, pour ne pas les confondre avec des boutons.
- **Aplats**: deux ou trois tons par case; l'ombre intérieure est une hachure (pli du carnet, coin des panneaux) ou une trame de points (vitrines).
- **Couleur = sens**: accent pour ce qui est choisi, tenu, ou l'action principale; papier creux pour ce qui ne l'est pas; tirets pour le vide, l'indisponible et le refusé; rouge de tampon pour la raison d'un refus, toujours écrite.
- **Focus**: fond d'accent et second trait de plume autour de la case. Il se lit en niveaux de gris (double trait), pas seulement par la teinte.
- **De travers**: cartouches, onglets, réponses et cases de la barre penchent de 0,5 à 2,5 degrés, en alternance. Le survol penche l'élément, l'appui l'enfonce vers son ombre.
- **Peu à l'écran**: l'heure, le jour, le temps qu'il fait et l'argent dans un seul cartouche; besoins, barre d'objets et bulle d'action seulement quand ils servent (inchangé, section 3).
- **Animations** (remplacent les durées de la section 6 sous ce thème): 200 ms au plus, par crans (`steps`), sans rebond. Apparition « posée à la main » (fondu et un degré et demi de rotation), tremblement d'encre de 160 ms à la prise de focus, trait qui se dessine sous le titre d'une fiche (180 ms). Seuls transform, rotate et opacity bougent. Restent en boucle: la bouche qui parle, le triangle « suite », le médaillon d'un besoin bas. Tout tombe à 1 ms avec le mouvement réduit.
- **Textes**: titres en Fraunces grasse (850), courant en Nunito Sans (650 à 800). Contraste du texte courant: 4,8 pour 1 au moins (tableau ci-dessous).

### Variables (`encre.css`, sur `.lpl-ui`)

| Variable | Valeur | Emploi | Contraste de l'encre dessus |
|---|---|---|---|
| `--paper-raised` | `#fdf6e3` | cases, bulles | 16,1 |
| `--paper` | `#f6ecd2` | pages du carnet | 14,7 |
| `--paper-sunken` | `#ead9b4` | creux, vide, onglets au repos | 12,4 |
| `--ink` | `#1d1a17` | traits, texte | |
| `--ink-muted` | `#54483a` | texte secondaire (6,4 sur le creux, 8,2 sur le papier) | |
| `--accent` | `#ffc83d` | choisi, tenu, action principale, étape suivante | 11,2 |
| `--stamp` | `#a8321f` | refus et sa raison (4,8 sur le creux, 6,2 sur le papier) | |
| `--primary` | `#2f6b4f` | jauge d'un besoin qui va bien | |
| `--soft-green`, `--soft-sky`, `--soft-ochre`, `--soft-rose` | `#a9c58f`, `#b9d6de`, `#dba565`, `#efb3a2` | couverture du carnet, vitrines, comptoir; le rose est en réserve | 9,1 / 11,3 / 7,9 |
| `--night` | `#2b3a5c` | cartouche de l'heure la nuit (texte papier: 10,5) | |
| `--d-fast`, `--d-base`, `--d-slow`, `--d-scene` | 100, 140, 180, 200 ms | durées | |
| `--lpl-ic-stroke`, `--lpl-ic-cap`, `--lpl-ic-join` | 2,5, `square`, `bevel` | trait des pictos | |
| `--cadre-<taille>-<fond>[-ombre]`, `--bi-<taille>[-ombre]` | générées | cadres encrés (`cadres.css`) | |

### Étapes d'une quête

Faites: pastilles d'encre pleine. La suivante: plus grande, en accent, avec une ombre, et sa phrase passée au surligneur dans la fiche. À venir: cercles en tirets.

### Images de référence

`captures/ui-encre-hud.png`, `ui-encre-dialogue.png` (et `-dialogue-suite`), `ui-encre-carnet.png`, `ui-encre-boutique.png` (et `-boutique-achat`), `ui-encre-planche.png`: la vraie interface du jeu à 1366x768, refaites par `assets-src/interface-encre/capturer.cjs`. Tant que les captures du moteur (`captures/encre-*.png`) manquent, le fond est provisoire et marqué comme tel.

### Reste à faire pour ce style

Vignettes d'objets et portraits définitifs (aujourd'hui des substituts générés), pictos redessinés à la plume, écrans non encore habillés (cuisine, pêche, déco, éditeur, basse-cour, atelier: ils héritent déjà des couleurs), et le choix d'une police de titrage plus « lettrage de BD ».
