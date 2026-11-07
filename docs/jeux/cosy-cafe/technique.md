# Cosy Café: technique, budgets et contraintes pour le design

| Champ | Valeur |
|---|---|
| Statut | proposition de l'architecte, à consolider par le manager; deviendra la section 10 du cahier des charges |
| Version | 0.1 |
| Date | 2026-11-07 |
| Rédacteur | architecte-technique |
| À relire par | dev-reseau (section 5), dev-gameplay-3d et tech-artist (sections 2 à 4), dev-plateforme (section 2.2, ADR de la vue subjective), level-designer et game-designer (section 11), ux-ui-designer (sections 2.2 à 2.5), qa-testeur (section 10) |
| Sources | `docs/jeux/cosy-cafe/cadrage.md`; `docs/plateforme/architecture.md` (sections 6, 7, 8, 14, 16); ADR 0001, 0004, 0005, 0007, 0009, 0010, 0016; `docs/plateforme/reseau.md`; `games/la-petite-ligne/ETAT.md` et le code du jeu; carnets de dev-gameplay-3d, tech-artist et dev-reseau; essais de `docs/jeux/cosy-cafe/essais/` |

## En bref

1. **Moteur**: Three.js 0.187 en WebGL2, caméra en perspective à hauteur d'yeux, champ de vision vertical de 60° par défaut (91,5° en horizontal à 1366x768), réglable de 50 à 75°. Rendu toujours au pixel physique du PC: à 1366x768, aucun levier de résolution n'existe (leçon R07 de La Petite Ligne).
2. **Échap et pointeur verrouillé** (vérifié dans le code d'Electron 45.2.0 et de Chromium 156): tant que le pointeur est verrouillé, Chromium avale le premier Échap pour rendre le pointeur, et la plateforme ne voit pas la touche. Parade dans le SDK, sans toucher au pont: un déverrouillage involontaire, fenêtre active, envoie la demande de pause que la plateforme honore déjà (`pauseRequest`).
3. **Rendu des adresses**: coque (murs, sols, plafonds) à lumière cuite; meubles et objets posés par les joueurs groupés dans des `BatchedMesh` (quelques appels de dessin quel que soit le nombre de modèles différents, élimination objet par objet); quatre lumières réelles au plus, en nombre fixe; **aucune ombre calculée en direct**, ombres de contact cuites et ombres rondes sous les personnages. Même image sur le Mac et le PC (leçon R13).
4. **Pire vue de chaque adresse**: 225 000 triangles et 135 appels de dessin visés (250 000 et 150 au plus), 10 programmes de shader prévus (12 au plus).
5. **Foule**: squelettes Three.js classiques, un appel de dessin par personnage. Le plafond provisoire du cadrage est **confirmé: 40 personnages animés visibles à la fois** (joueurs, employés, clients, passants compris), 48 lors d'une pointe passagère; **120 présents** au plus dans une adresse (paris-maison). Mesuré: 0,34 à 0,37 ms par image pour animer 40 personnages sur la machine cloud, soit 0,7 à 1,1 ms estimées sur le PC; avec les appels de dessin, 2 à 3 ms estimées, sur 8 ms par image.
6. **Réseau**: l'hôte fait autorité (ADR 0007), simulation à 60 Hz. L'invité tourne la tête sans aucune latence (regard local à chaque image) et prédit les pas de son avatar; aucune collision entre un joueur et un autre personnage, pour que la prédiction ne se trompe jamais. Déplacements compacts à 20 par seconde, état en domaines envoyés quand ils changent: 81 Ko/s pendant un service chargé à paris-maison, 96 Ko/s au pire, sous les 100 Ko/s du budget.
7. **Objets**: aucun moteur physique; chaque objet est tenu, posé sur un emplacement déclaré par son meuble, ou rangé. Premier arrivé chez l'hôte l'emporte, l'autre voit « Déjà pris ». Les gestes de précision (extraction, mousse de lait) sont jugés sur la machine du joueur qui les fait.
8. **Sauvegarde**: 100 à 400 Ko estimés en fin de progression; enregistrée à la fin de chaque journée, toutes les 2 minutes et à chaque pause; **reprise en plein service possible**.
9. **Deux cafés à la fois**: faisable par les machines, coûteux par les règles et les tests. Recommandation: les deux joueurs toujours dans le même café en version 1.
10. **Banc de mesure chez le client dès le prototype**: aucune mesure de dessin faite ici ne vaut pour l'Intel UHD 620 (le rendu logiciel SwiftShader de l'environnement cloud ne le représente pas).

La liste des plafonds pour le game designer et le level designer est en section 11; les ADR à écrire avant le prototype en section 12.

## 1. D'où viennent les chiffres

### 1.1 Le PC de référence

Hypothèse prudente validée par le client (`architecture.md`, section 14.1): Intel Core i3 de 8e génération (2 cœurs, 4 fils), Intel UHD 620, 4 à 8 Go, écran 1366x768 ou 1920x1080 à 100, 125 ou 150 %. Le relevé des machines (`docs/guides/releve-machines.md`, Q4) n'a pas encore été rempli. Deux faits observés chez le client avec La Petite Ligne:

- **R07** (soirée du 2026-11-01): « Sur la version Windows, tout est flou »: un tampon de rendu sous le pixel physique se voit tout de suite sur cet écran. La Petite Ligne rend depuis au pixel physique (plancher de netteté `min(dpr, 1,5)`), ce qui supprime tout levier de résolution à 100, 125 et 150 %.
- **R13** (2026-11-03): « Sur Windows, il n'y a pas d'ombres, contrairement au Mac »: la qualité adaptative de La Petite Ligne a coupé seule les ombres du PC, ce qu'elle ne faisait qu'après 8 s sous 55 images par seconde environ. Signe probable que ses vues chargées (de l'ordre de 200 000 à 225 000 triangles et 130 appels, ombres comprises, ADR 0016) y passaient par moments sous ce seuil: c'est la cause retenue par le correctif du 2026-11-03, non mesurée faute de relevé du PC. Et le client remarque une différence de rendu entre les deux machines.

### 1.2 Nature de chaque chiffre

Chaque plafond porte sa source:

- **mesuré (LPL)**: relevé sur La Petite Ligne (même moteur, même plateforme), dans `ETAT.md`, l'ADR 0016 ou les carnets;
- **essai**: mesuré pour ce document (`docs/jeux/cosy-cafe/essais/README.md`), sur la machine cloud, sans rendu;
- **calcul**: déduit de chiffres connus;
- **estimation**: non mesurée, à confirmer au banc de mesure (section 10).

Aucun temps de dessin n'a été mesuré: le rendu logiciel SwiftShader de l'environnement cloud ne représente pas l'Intel UHD 620, ni en vitesse ni en goulets.

## 2. Moteur et rendu en vue subjective

### 2.1 Pile

- Three.js 0.187.0 (ADR 0001), WebGL2, rendu direct dans le canevas, `PerspectiveCamera`. Aucune nouvelle dépendance de rendu n'est demandée; `BatchedMesh` (section 3.3) fait partie de Three.js (API lue dans `src/objects/BatchedMesh.js` de la version 0.187.0: `addGeometry`, `addInstance`, `setMatrixAt`, `setColorAt`, `setVisibleAt`, `deleteInstance`, `perObjectFrustumCulled` vrai par défaut, `WEBGL_multi_draw` quand il existe).
- Simulation en TypeScript pur dans `src/simulation/`, sans DOM ni horloge, testable dans Node (ADR 0005); le rendu lit l'état et interpole.
- Manifeste: `view: "3d"`, `engine: "three"`, `mode: "coop"`, `play: "session"`, `network: "host-authority"` (section 8.1).
- La CSP des jeux admet WebAssembly (`'wasm-unsafe-eval'`, `apps/duo/src/main/protocols.ts`), mais aucun module WebAssembly n'est prévu: pas de moteur physique (section 5.5), pas de compression de maillages.

### 2.2 Verrouillage du pointeur et Échap

**Faits vérifiés le 2026-11-07** dans le code source, aux versions embarquées par Duo:

- La plateforme autorise le verrouillage du pointeur dans la session des jeux (`apps/duo/src/main/security.ts`: `fullscreen` et `pointerLock` seuls permis). Le SDK l'offre (`input.lockPointer()`, `input.unlockPointer()`, `pointer.locked`, `pointer.movementX` et `movementY`, `packages/sdk/src/input.ts`).
- Electron 45.2.0, `WebContents::PreHandleKeyboardEvent` (`shell/browser/api/electron_api_web_contents.cc`): le gestionnaire d'accès exclusif de Chromium voit chaque touche **avant** l'événement `before-input-event`, et s'il la traite, l'événement n'est pas émis.
- Chromium 156.0.8078.49 (version du fichier `DEPS` d'Electron 45.2.0), `PointerLockController::HandleUserPressedEscape` (`chrome/browser/ui/exclusive_access/pointer_lock_controller.cc`): pointeur verrouillé, Échap le déverrouille et compte comme traitée.
- **Conséquence**: pendant que le jeu tient le pointeur, le premier Échap rend la souris mais n'atteint ni la plateforme (qui intercepte Échap par `before-input-event` sur l'appui, `apps/duo/src/main/game-host/game-host.ts`) ni la page. Pas de pause: c'est contraire à la règle « Échap, c'est la pause de Duo » (ADR 0004, point 3).
- Re-verrouiller (`PointerLockController::RequestToLockPointer`): si le dernier déverrouillage ne vient pas de la page elle-même (Échap, perte du focus), Chromium exige un geste du joueur (clic ou touche); après un Échap, il refuse en plus toute demande pendant 1,25 s (`kEffectiveUserEscapeDuration`). Si c'est le jeu qui a rendu le pointeur (`exitPointerLock`), il peut le reprendre sans geste.
- Electron n'affiche aucune bulle « Appuie sur Échap pour afficher le curseur » (`UpdateExclusiveAccessBubble` vide dans `electron_api_web_contents.h`).
- La plateforme traite déjà le message `pauseRequest` du jeu comme un Échap, « par sûreté » (`game-host.ts`), alors que l'ADR 0005 le dit réservé au faux hôte.

**Parade** (petit changement du SDK, aucun changement du pont):

1. Le SDK distingue le déverrouillage qu'il a demandé (`unlockPointer`) du déverrouillage involontaire. Involontaire, partie en cours (`running`), page visible et document qui a encore le focus: c'est Échap, le SDK envoie `pauseRequest`. Involontaire avec perte du focus (Alt+Tab, Cmd+Tab, touche Windows, notification): aucune pause, comme le veut l'ADR 0004 (point 4); le jeu affiche « Clique pour reprendre la main ».
2. Pendant une pause de Duo, la vue plateforme prend le focus (ADR 0004), ce qui doit rendre le pointeur (la perte du focus le libère; à vérifier dans Electron, M4): le SDK ne doit alors rien envoyer (sinon un second `pauseRequest` pourrait valoir « reprendre »). Règle: jamais de `pauseRequest` hors de l'état `running`.
3. Au retour en jeu, le pointeur est libre: le premier clic (ou la première touche) le reprend et **n'agit pas** dans le jeu (un clic de reprise qui servirait une tasse serait une faute).
4. Panneaux du jeu qui demandent le curseur (tablette, ardoise, catalogue): le jeu rend le pointeur à l'ouverture et le reprend à la fermeture, sans geste. Ces panneaux se ferment par leur propre touche ou un clic, **jamais par Échap**, qui reste la pause de Duo.
5. À vérifier sur les deux systèmes (mesure M4, section 10): l'ordre des événements `blur` et `pointerlockchange` lors d'un Alt+Tab, d'un Cmd+Tab et d'un geste de Mission Control; la règle se décide après une image d'attente, quand `document.hasFocus()` est fixé.

**Regard à la souris**:

- Le regard (cap et inclinaison) s'applique à **chaque image**, sur la machine du joueur, sans attendre la simulation ni le réseau: c'est ce qui rend une vue subjective confortable.
- `pointer.movementX` du SDK compte le déplacement depuis le dernier **pas** de simulation et se remet à zéro à chaque pas: la caméra a besoin d'un cumul **par image** (écouteur `pointermove` du rendu, ou accumulateur par image ajouté au SDK, à trancher dans l'ADR de la vue subjective).
- Le SDK documente `movementX` en pixels CSS; à vérifier (M5) sous Windows à 125 et 150 % et sur l'écran Retina du Mac, pour qu'une même sensibilité donne le même ressenti sur les deux machines. Option à essayer: `requestPointerLock({ unadjustedMovement: true })`, qui ignore l'accélération de la souris de Windows.
- **Réglages par joueur à garder d'une séance à l'autre** (sensibilité, inversion de l'axe vertical, champ de vision): un jeu ne peut rien garder sur la machine (session Chromium non persistante, ADR 0004, constaté par La Petite Ligne pour ses options graphiques). Deux voies, à trancher par ADR (section 12): un petit stockage de préférences par jeu et par machine dans le SDK, ou ces réglages dans la sauvegarde, par membre du duo, en attendant.

**Touches réservées par Duo**: Échap (pause), F11 sous Windows (plein écran), Ctrl+N (carnet de séance). Le manifeste lit les touches par position (`KeyboardEvent.code`: `KeyW` est le Z d'un clavier AZERTY), 32 actions au plus, deux entrées de souris au plus par action (`left`, `middle`, `right`, `wheel-up`, `wheel-down`).

### 2.3 Champ de vision

Three.js règle l'angle **vertical**; l'horizontal suit la forme de l'écran.

| Vertical | Horizontal à 1366x768 et 1920x1080 | Horizontal en 16:10 (MacBook) |
|---|---|---|
| 50° | 79,3° | 73,5° |
| 55° | 85,6° | 79,6° |
| **60° (défaut proposé)** | **91,5°** | **85,5°** |
| 65° | 97,1° | 91,1° |
| 70° | 102,5° | 96,5° |
| 75° | 107,5° | 101,7° |

- Défaut à 60° vertical: l'horizontal habituel des jeux sur ordinateur (90° environ). Réglage de 50 à 75° pour le confort (section 9, mal des transports). Le Mac en 16:10 voit un peu moins large à angle vertical égal: sans importance pour un jeu en coopération.
- Plans de coupe: 0,05 m (un objet tenu près des yeux ne se coupe pas) à 80 m (rue vue par la vitrine).
- Hauteur des yeux de 1,65 m (valeur des plans du level designer, à caler sur les avatars du directeur artistique). Un plan de travail à 1,05 m vu à 0,6 m, ou à 0,95 m vu à 0,7 m, est à 45° sous l'horizontale: hors du cadre si l'on regarde droit devant (la moitié du champ vertical fait 30°). Le joueur baisse le regard pour travailler: c'est normal en vue subjective, et le HUD ne doit pas couvrir le bas de l'écran où se trouvent les mains et le plan de travail.
- L'objet tenu est dessiné devant la caméra dans la scène; le corps de l'avatar garde un rayon de 0,3 m au moins contre les murs et les meubles pour que l'objet tenu n'y entre pas.

### 2.4 Résolution et mise à l'échelle de Windows

| Écran du PC | Pixels du tampon 3D | Fenêtre en pixels CSS (HUD) |
|---|---|---|
| 1366x768 à 100 % | 1366x768 (1,05 million) | 1366x768 |
| 1366x768 à 125 % | 1366x768 | 1093x614 |
| 1366x768 à 150 % | 1366x768 | 911x512 |
| 1920x1080 à 125 % | 1920x1080 (2,07 millions) | 1536x864 |
| 1920x1080 à 150 % | 1920x1080 | 1280x720 |

(Pixels CSS: hors barre des tâches et barre de titre, qui en retirent encore une quarantaine en fenêtre.)

- Règle reprise de La Petite Ligne: le tampon 3D suit la taille physique exacte (`ResizeObserver` en `device-pixel-content-box`, qui se redéclenche quand la mise à l'échelle change), jamais sous le pixel physique sur le PC. Conséquence: **aucun levier de résolution sur le PC**, et un écran 1920x1080 coûte deux fois plus de pixels qu'un 1366x768, sans parade automatique. Le budget de la section 3 doit tenir au pixel physique; le banc dira lequel des deux écrans a le PC. Dernier recours, réglage manuel « Image plus douce » à 0,85 du pixel physique, seulement sur un écran 1920x1080.
- Sur le Mac, le rapport de pixels reste plafonné à 2 (`architecture.md`, section 14.2).
- Le HUD est en pixels CSS et suit la taille d'interface de Duo (100, 125, 150 %): à 1366x768 et 150 %, il doit tenir dans 911x512 pixels CSS (ux-ui-designer).

**Texte écrit dans le monde** (ardoise, tickets du rail, enseigne): à 60° vertical, un mètre à la distance d fait 665/d pixels de haut sur un écran de 768 pixels (935/d sur 1080).

| Distance de lecture | 1 cm de lettre, à 1366x768 | Hauteur de lettre pour 14 pixels, à 1366x768 | À 1920x1080 |
|---|---|---|---|
| 0,6 m (ticket en main) | 11,1 px | 1,3 cm | 0,9 cm |
| 1 m (rail des tickets) | 6,7 px | 2,1 cm | 1,5 cm |
| 2,5 m (ardoise du comptoir) | 2,7 px | 5,3 cm | 3,7 cm |
| 4 m (ardoise vue de la salle) | 1,7 px | 8,4 cm | 6,0 cm |

Le seuil de lisibilité (14 pixels ici, en exemple) appartient à ux-ui-designer et au directeur artistique. Le livre d'or, écrit petit et lu de près, s'ouvre en surimpression 2D plutôt qu'en lecture dans la scène.

### 2.5 Même image sur les deux machines

Le Mac pourrait dessiner davantage (ombres, effets). Le retour R13 montre que le client remarque et regrette une différence entre les deux écrans. Règle: **le Mac et le PC montrent la même image**; seuls diffèrent la netteté (rapport de pixels du Mac) et, si le banc l'impose, des réglages manuels de dernier recours. Aucune qualité adaptative qui retirerait en silence une partie du rendu.

## 3. Budgets de rendu

### 3.1 Budget du PC et cible de ce jeu

Le budget de la plateforme (`architecture.md`, section 14.2) s'applique: sur 60 s par scénario, moyenne d'au moins 58 images par seconde, 99 % des intervalles à 20 ms ou moins, aucun au-delà de 34 ms après les 5 premières secondes; fil principal du jeu à 8 ms au plus par image; 150 appels de dessin et 250 000 triangles au plus par image, toutes passes comprises; 12 programmes au plus, compilés au chargement; une directionnelle, une hémisphérique, 4 ponctuelles sans ombre au plus.

Cible de ce jeu, avec une marge comme La Petite Ligne (ADR 0016: 205 000 triangles et 135 appels pour ses vues sans habitants): **225 000 triangles et 135 appels dans la pire vue de chaque adresse**, personnages compris. La marge (25 000 triangles, 15 appels) absorbe les effets passagers et l'imprécision des estimations.

Repère mesuré (LPL, carnet du tech-artist): sa vue de la messe, ombres comprises, montait à 319 000 triangles et 174 appels avant contour, au-delà du budget; les personnages (jusqu'à une vingtaine dans le cadre selon le level designer) y pesaient 60 000 triangles, et autant dans la passe d'ombre. Une salle de café pleine montre plus de monde encore: d'où les choix des sections 3.3 à 3.5 et 4.

### 3.2 Répartition de la pire vue

| Poste | Triangles | Appels | Comment |
|---|---|---|---|
| Coque de la salle (murs, sols, plafonds, escaliers, cadres des fenêtres) | 30 000 | 12 | fusionnée par pièce et par matériau, lumière cuite (section 3.4) |
| Dehors vu par les vitrines (rue, place, façades d'en face, ciel) | 15 000 | 10 | décor de fond simplifié, fusionné |
| Meubles et décorations posés | 70 000 | 4 | `BatchedMesh` (section 3.3) |
| Objets mobiles (vaisselle, viennoiseries, cartons) | 15 000 | 4 | `BatchedMesh` |
| Personnages (40 au plus) | 90 000 | 42 | un appel par personnage, ombres rondes en un appel, mains de l'avatar en un appel (section 4) |
| Effets (vapeur, flaques de lumière, lueurs) | 3 000 | 8 | particules et décalques instanciés |
| Textes dans le monde, aide de pose, objet visé | 2 000 | 10 | ardoise, rail des tickets, fantôme du meuble |
| **Total visé** | **225 000** | **90** | marge d'appels: 45 sous la cible, 60 sous le plafond |

La marge d'appels est volontairement large: si `BatchedMesh` déçoit au banc (risque R10), le repli par instanciation d'un `InstancedMesh` par modèle coûterait de l'ordre de 40 appels de plus et tiendrait encore sous 135.

### 3.3 Meubles posés par les joueurs

Le joueur choisit librement ses meubles: une salle peut montrer cinquante modèles différents. Trois façons de les dessiner:

| Option | Appels de dessin | Triangles dessinés | Déplacer un meuble | Pour | Contre |
|---|---|---|---|---|---|
| A. Un `InstancedMesh` par modèle | un par modèle visible (de 30 à 60 dans une grande salle) | tous les exemplaires d'un modèle dès qu'un seul est dans le cadre (élimination d'un seul tenant) | une matrice | éprouvé, simple | le nombre d'appels dépend du goût des joueurs, sans plafond possible |
| B. Fusion par pièce, refaite à chaque changement | un ou deux par pièce | toute la pièce dès qu'elle est dans le cadre | refusion de la pièce (quelques ms) | le moins d'appels | à-coup à chaque pose, aucune élimination fine |
| C. **`BatchedMesh` par matériau** (Three.js 0.187) | un ou deux en tout, multi-draw | seulement les meubles dans le cadre (élimination objet par objet, `perObjectFrustumCulled`) | une matrice (`setMatrixAt`) | appels indépendants du nombre de modèles et de meubles; teinte par exemplaire (`setColorAt`) | plus jeune dans Three.js; sous Direct3D 11, ANGLE émule le multi-draw (coût à mesurer, M3) |

**Proposition: option C**, avec l'option A prête en repli (mêmes données, même programme à une variante près), comparées au banc dès le prototype (M3). Conditions:

- tous les modèles groupés partagent un matériau (palette, comme La Petite Ligne) et les mêmes attributs (position, normale, coordonnées de texture, couleur de sommet);
- un `BatchedMesh` pour les meubles (rarement modifié), un pour les objets mobiles (matrices des objets tenus mises à jour à chaque image), même matériau, donc même programme;
- l'occlusion de chaque modèle est cuite dans ses couleurs de sommets, avec une ombre de contact sous ses pieds (section 3.5).

Triangles par modèle, à fixer avec le directeur artistique (repères mesurés sur `maison.glb` de La Petite Ligne, vu de loin en isométrie: chaise 404, étagère 656, lit double 708, cadre 116, vase 786); en vue subjective, les meubles se voient de près, d'où un peu plus de détail:

| Catégorie | Triangles au plus | Catégorie | Triangles au plus |
|---|---|---|---|
| chaise, tabouret | 600 | machine à espresso (objet vedette) | 4 000 |
| table, guéridon | 600 | four, réfrigérateur, lave-vaisselle | 2 000 |
| fauteuil, banquette | 1 200 | étagère, vitrine | 1 000 |
| module de comptoir | 1 500 | plante | 1 200 |
| luminaire | 600 | cadre, ardoise murale, tapis | 150 |
| tasse, verre, assiette, viennoiserie | 250 | carton de livraison | 100 |

Moyenne visée sur une salle: 470 triangles par meuble ou décoration, soit 150 meubles visibles pour 70 000 triangles.

### 3.4 Lumière

- **Coque cuite**: la lumière des murs, sols et plafonds est calculée d'avance (Blender, Cycles), sans les meubles puisqu'ils bougent; deux ou trois états (matin, après-midi, soir) mêlés selon l'heure par un réglage du même programme. Support au choix du tech-artist: couleurs de sommets (aucune texture) ou cartes de lumière, 48 Mo de mémoire graphique au plus par adresse (deux cartes de 2048 avec leurs mipmaps).
- **Occlusion cuite sur les meubles**: dans les couleurs de sommets de chaque modèle, plus une ombre de contact (section 3.5): un meuble posé n'importe où reste posé, jamais flottant.
- **Lumières dynamiques en nombre fixe**: une hémisphérique (ciel et sol), une directionnelle sans ombre (soleil par les vitrines), quatre ponctuelles **toujours présentes**. Le nombre de lumières ponctuelles entre dans la clé des programmes de Three.js 0.187 (`numPointLights` dans `WebGLPrograms.js`; vérifié par La Petite Ligne: en ajouter ou en retirer une recompile tous les matériaux éclairés, une lampe d'intensité nulle compte encore). Les quatre lampes sont attribuées à chaque image aux luminaires allumés qui comptent le plus pour la caméra locale (proches et dans le cadre), avec un fondu d'une demi-seconde quand une lampe change de luminaire.
- **Luminaires posés**: en nombre libre. Chacun montre son abat-jour lumineux et sa flaque de lumière cuite au sol ou sur la table (décalque instancié, 64 visibles au plus); quatre seulement éclairent vraiment à la fois. La lumière que compte l'ambiance (cadrage, section 4.6) se calcule dans la simulation à partir des luminaires posés, jamais à partir du rendu.
- Les plafonniers fixes de la coque sont cuits dans l'état du soir.

### 3.5 Ombres

**Aucune carte d'ombre** en version 1, sur les deux machines. Raisons:

- une passe d'ombre redessine chaque objet qui projette: avec 40 personnages, c'est 40 appels et 90 000 triangles de plus (calcul), hors budget;
- chaque matériau d'ombre est un programme de plus (variantes simple, groupée, squelettée avec morphose): le budget de 12 ne tiendrait plus;
- le PC de La Petite Ligne a perdu ses ombres en jeu (R13), et le client a vu la différence avec le Mac.

À la place: ombres de la coque cuites (y compris les taches de soleil des vitrines, dans les états du jour), ombre de contact intégrée à chaque modèle de meuble et d'objet, ombre ronde sous chaque personnage (décalque instancié, un appel pour tous). À rouvrir seulement si le banc montre une marge nette sur le PC, et alors sur les deux machines.

### 3.6 Programmes de shader

| # | Programme | Sert à |
|---|---|---|
| 1 | coque cuite | murs, sols, plafonds, escaliers, cadres des fenêtres |
| 2 | meubles et objets groupés | `BatchedMesh`, palette, teinte par exemplaire (fantôme de pose et objet visé par un réglage de couleur, sans programme de plus) |
| 3 | personnages | `SkinnedMesh`, palette des personnages, cibles de morphose en nombre fixe pour tous |
| 4 | dehors | façades, rue, ciel (peut se confondre avec le n° 1 si le matériau est le même) |
| 5 | verre et liquides | transparents: vitrines, verres, carafes |
| 6 | particules | vapeur, miettes, éclats (programme instancié, sur le modèle de celui de La Petite Ligne) |
| 7 | décalques | flaques de lumière, ombres de contact et ombres rondes |
| 8 | textes dans le monde | ardoise, tickets, enseigne (toile 2D en texture) |

Huit à dix programmes, tous compilés pendant le chargement (`compileAsync`). Pièges connus (LPL): chaque variante compte (transparence, instanciation, groupe, squelette, nombre de cibles de morphose, présence d'une texture); un maillage fixe posé sur le matériau des personnages compile un programme de plus; un même matériau sur un `Mesh` et un `BatchedMesh` donne deux programmes.

### 3.7 Budgets par adresse

Places d'après le cadrage (section 4.10); présents et visibles d'après le calcul de la section 4.3; meubles et objets d'après la surface (un meuble pour 1,5 à 2 m², décorations en plus). Ce sont des plafonds pour le design et des cibles de mesure pour le banc.

| Adresse | Surface | Places assises (cadrage) | Personnages présents, au plus | Personnages visibles, au plus | Meubles et décorations posés, au plus | Objets mobiles, au plus | Pire vue visée (triangles, appels) |
|---|---|---|---|---|---|---|---|
| `village` | 30 à 40 m² | 8 à 12, plus un banc et deux tables dehors | 24 | 24 | 60 | 100 | 150 000, 80 |
| `bourg` | 60 à 80 m² | 20 à 28, terrasse | 48 | 40 | 120 | 180 | 210 000, 110 |
| `ville` | 120 à 150 m² | 35 à 45, terrasse | 72 | 40 | 200 | 260 | 225 000, 135 |
| `paris-quartier` | 80 à 100 m² | 30 à 36, grande terrasse | 80 | 40 | 180 | 260 | 225 000, 135 |
| `paris-maison` | 250 à 350 m², deux niveaux | 60 à 80, terrasse | 120 | 40 | 350 | 450 | 225 000, 135 |

Pour toutes: 150 meubles et décorations visibles au plus dans une même vue, 150 objets mobiles visibles, 10 programmes, 4 lumières ponctuelles, aucune carte d'ombre.

### 3.8 Mémoire, chargement et poids

| Poste | Budget | Source |
|---|---|---|
| Mémoire de textures | 128 Mo visés par adresse chargée (256 au plus): lumière de la coque 48, palettes et personnages 32, textes et interface 16, marge | calcul, plafond de `architecture.md` |
| Tas JavaScript du jeu | 200 Mo au plus | `architecture.md` |
| Audio décodé | 64 Mo au plus (sound-designer) | `architecture.md` |
| Chargement d'une adresse sur le PC | 5 s au plus, compilation des shaders comprise; 15 Mo de fichiers au plus par adresse (coque, dehors, cartes de lumière) | budget de la plateforme; temps de compilation par Direct3D à mesurer (M8) |
| Changement d'adresse en cours de séance | au début d'une journée seulement (cadrage, section 4.11), derrière un écran de chargement; la coque précédente est libérée (géométries, textures, matériaux) | cadrage |
| Paquet du jeu | 40 Mo au prototype, 80 Mo à la 1.0 (100 Mo par défaut, 200 Mo extraits au plus): musiques 25, sons 10, coques et dehors des cinq adresses 20, catalogue de meubles 10, personnages 10, interface et polices 3, code 2 | ADR 0010; La Petite Ligne: 52 Mo d'assets (30 de modèles, 22 de sons) |

Le paquet se télécharge en entier à chaque version (pas de mise à jour différentielle en version 1, ADR 0010), donc à chaque mise à jour du soir: un paquet léger compte pour le confort du client.

## 4. Foule

### 4.1 Technique d'animation

| Option | Coût par personnage | Ce qu'elle permet | Ce qu'elle coûte au studio |
|---|---|---|---|
| A. **Squelettes** (`SkinnedMesh`, `AnimationMixer`), corps et vêtements fusionnés en un maillage (méthode de La Petite Ligne) | un appel de dessin, un envoi de la texture des os à chaque image, l'animation sur le processeur | fondus entre clips, regard vers le joueur, main posée sur une tasse, visage par cibles de morphose, tenues variées par couleurs | rien de nouveau: code, outils et pièges connus (carnet de dev-gameplay-3d) |
| B. Animation cuite dans une texture et instanciée (une texture de positions par clip, un `InstancedMesh` par silhouette) | presque rien: un appel pour tous ceux d'une même silhouette, aucun calcul d'os | des foules de centaines au loin | pas de fondu fin ni de regard ni de main posée; outil de cuisson et programme sur mesure à écrire, tester et maintenir |

**Proposition: option A** pour tous les personnages, avec trois niveaux de détail du même squelette:

| Distance à la caméra | Triangles au plus | Animation |
|---|---|---|
| moins de 4 m (au comptoir, à la table que l'on sert) | 5 000 | complète, à chaque image |
| 4 à 10 m | 2 500 | complète |
| plus de 10 m | 1 200 | une image sur deux |

Moyenne visée: 2 250 triangles par personnage visible (repère mesuré dans `personnages.glb` de La Petite Ligne: 2 086 à 4 838 triangles par habitant, 2 434 en médiane sur 21, squelette de 18 os). Tous les niveaux et tous les personnages gardent le même nombre de cibles de morphose (cibles nulles où il n'y en a pas): sinon un programme de plus. Un personnage hors du cadre n'est pas animé; son clip est recalé sur l'état de la simulation quand il revient dans le cadre (méthode de La Petite Ligne: le temps du clip se déduit du moment où l'action a commencé).

L'option B reste en réserve pour une foule lointaine (terrasses parisiennes vues de la salle, passants): à décider avant la production de `paris-quartier`, sur les plans du level designer, par un ADR. Elle ne change ni la simulation ni le réseau, seulement le dessin des personnages lointains.

### 4.2 Coût

| Élément | Machine cloud | PC de référence | Source |
|---|---|---|---|
| Animation de 40 personnages (mélange, matrices, os) | 0,34 à 0,37 ms par image | 0,7 à 1,1 ms | essai (deux lancements), puis estimation (cœur d'i3 de 2 à 3 fois plus lent) |
| Animation de 80 personnages | 0,84 à 0,88 ms | 1,7 à 2,7 ms | essai, puis estimation |
| Animation de 120 personnages | 1,56 à 1,59 ms | 3,1 à 4,8 ms | essai, puis estimation |
| Appel de dessin et texture des os, par personnage | non mesurable ici | 30 à 50 µs | estimation (ANGLE et Direct3D 11), à mesurer (M2) |
| **40 personnages, tout compris** | | **2 à 3 ms par image** | estimation |
| Triangles de 40 personnages | | 90 000 | calcul (section 4.1) |
| Appels de 40 personnages | | 42 (40, ombres rondes, mains) | calcul |

Sur les 8 ms du fil principal par image, 40 personnages en prennent environ le tiers. Le reste du rendu (une cinquantaine d'appels), la simulation chez l'hôte (section 5.1) et le HUD se partagent les deux autres tiers. 80 personnages coûteraient de 4 à 7 ms (estimation): hors budget avec l'option A.

### 4.3 Plafonds

- **Visibles à la fois: 40** (confirmation du plafond provisoire du cadrage), joueurs, employés, clients, passants de la rue et clients de la terrasse vus par la vitrine compris. Une pointe passagère jusqu'à 48 (un groupe qui entre) reste dans la marge de la section 3.1.
- **Présents dans une adresse: 120** au plus (paris-maison à la pointe: 80 à 100 places occupées à 85 %, la file, une dizaine d'employés, les deux joueurs). Ce plafond vient de la simulation et du réseau (section 5), pas du dessin: un personnage hors du cadre ne coûte rien au rendu.
- **Compte dans le champ**: le validateur du level designer (`docs/jeux/cosy-cafe/plans/valider_plans.py`, règle 7) compte déjà, depuis chaque point de vue déclaré d'un plan et dans toutes les directions, les personnages au pire dans un champ de 100° (places visibles occupées, file pleine, figurants des espaces vus, l'autre joueur), sous un plafond de 40: c'est le contrôle retenu. Repère pour dessiner: une trentaine de places visibles d'un même point laisse la place à la file, aux employés et à l'autre joueur. Au 2026-11-07, les deux plans du village donnent 21 personnages au pire.

### 4.4 Ce que cela impose aux plans

- Une grande salle se découpe en espaces qui ne se voient pas tous ensemble (cadrage, section 4.10): arrière-salle, deuxième niveau, comptoir central qui coupe la vue, claustras, piliers.
- Terrasses et vitrines: une grande vitrine sur une terrasse pleine additionne les deux salles. Parades de plan: voilage à mi-hauteur (le brise-bise des cafés parisiens), allège haute, terrasse en retour d'angle, ou terrasse décalée par rapport à la salle.
- Passants de la rue: ils comptent dans les 40; quelques-uns suffisent à faire vivre la rue.
- Suggestion pour le validateur du level designer: ajouter aux points de vue déclarés une grille de points jouables (un tous les mètres), qui trouverait une vue oubliée (le coin d'une terrasse, le haut d'un escalier).

## 5. Simulation et réseau

### 5.1 Modèle

- **L'hôte fait autorité** (ADR 0007, `host-authority`): sa vue jeu simule tout (clients, employés, objets, postes, horloge, économie) à pas fixe; l'invité envoie ses entrées et ses intentions, jamais d'état.
- **Pas de 60 Hz** (défaut du SDK et de l'ADR 0005): les pas de l'avatar se calculent à la fréquence où on les voit. Les décisions des clients et des employés tournent à 10 Hz, réparties sur les pas (chacun réfléchit un pas sur six); leurs déplacements avancent à chaque pas.
- **Budget**: 2 ms au plus par pas sur le PC hôte, sérialisation comprise (`architecture.md`); banc de simulation sous Vitest à 1 ms dans la CI, avec la pire adresse (120 personnages) jouée par le robot. Non mesuré: aucun code n'existe. Estimation: décisions, déplacements et évitements de 120 personnages sur une grille de voisinage, quelques dixièmes de milliseconde par pas.
- Le pas de 30 Hz de La Petite Ligne ne convient pas ici: en vue subjective, chaque pas de l'avatar se voit à l'écran (interpolé, il arriverait un pas plus tard).
- Simulation pure, empreinte `hash(state)`, générateur à graine du SDK, robot facultatif pour les tests (ADR 0005, 0013); longues parties de robots hors de `pnpm test` (règle du 2026-11-04).

### 5.2 L'avatar de chaque joueur

- **Regard**: local, à chaque image, sans latence (section 2.2). Cap et inclinaison partent avec les entrées de chaque pas (arrondis à 0,5°): l'hôte oriente l'avatar et sa tête, que l'autre joueur voit tourner.
- **Pas de l'invité prédits**: l'invité calcule son propre avatar avec la même fonction que l'hôte; à chaque instantané, il repart de la position reçue et rejoue ses entrées que l'hôte n'a pas encore prises en compte (`ack`). Règles reprises de La Petite Ligne (`games/la-petite-ligne/src/reseau/`, carnet de dev-reseau): une entrée en retard est devinée par l'hôte et compte pour le numéro suivant; toute entrée écartée sans être jouée doit être sans effet; une correction se résorbe au plus à 30 % de la vitesse de marche, jamais d'un coup.
- **Aucune collision entre un joueur et un autre personnage**: les clients et les employés s'écartent des joueurs (ils ralentissent, s'arrêtent ou contournent), et deux joueurs se frôlent sans se bloquer. Les seuls obstacles d'un joueur sont la coque et les meubles, connus des deux machines: la prédiction ne se trompe alors que si un meuble a bougé dans le dernier aller-retour, ce qui est rare. En vue subjective, toute correction déplace la caméra elle-même: c'est la règle qui protège du mal des transports.
- **Collisions des joueurs en deux dimensions par niveau** (murs et empreintes des meubles), avec des escaliers en rampes entre deux niveaux: pas de géométrie 3D dans la simulation.
- **Pas de l'hôte**: interpolés entre les deux derniers pas (60 Hz: au plus 17 ms de retard), comme chez l'invité.

### 5.3 Ce qui part sur le réseau

L'état de l'hôte se découpe en domaines, chacun envoyé en entier quand il change. Un client assis n'a plus de position dans les déplacements: sa place la donne.

| Canal | Sens | Mode | Contenu | Fréquence | Taille au pire (paris-maison) |
|---|---|---|---|---|---|
| entrées | invité vers hôte | `reliable` | numéro de pas, touches tenues, appuis, cap et inclinaison du regard; deux pas par message | 30 messages par seconde | environ 120 octets |
| intentions | invité vers hôte | `reliable` | prendre, poser, donner, utiliser un poste, résultat d'un geste, poser un meuble, écrire la carte; chaque intention porte l'objet visé, choisi par la machine qui vise | à l'action | moins de 200 octets |
| déplacements | hôte vers invité | `latest` | `ack`, deux joueurs (position, regard, animation, objet tenu), personnages debout (numéro, x et z en cm, cap en degrés, animation, objet tenu) | 20 par seconde (un pas sur trois) | 1,1 Ko pour 45 personnages debout; 2,9 Ko si tous les 120 l'étaient |
| objets | hôte vers invité | `latest` | chaque objet mobile: type, support, emplacement, état, remplissage, qualité | à chaque changement, 4 par seconde au plus | 8,9 Ko (420 objets) |
| service | hôte vers invité | `latest` | état logique des clients (profil, étape, place, patience, satisfaction), tickets du rail | à chaque changement, 4 par seconde au plus | 4,2 Ko |
| meubles | hôte vers invité | `latest` | meubles posés: modèle, position, niveau, rotation, teinte | à chaque changement, 2 par seconde au plus | 7,7 Ko (320 meubles) |
| maison | hôte vers invité | `latest` | caisse, stock, carte et prix, réputation, horloge, employés | à chaque changement, 2 par seconde au plus | quelques Ko |
| événements | hôte vers invité | `reliable` | sons, effets, « Déjà pris », mots du livre d'or, faire signe | au fil du jeu | quelques centaines d'octets |

Tailles: calcul de l'essai `instantanes-taille.mjs` (formes compactes en tableaux, entiers en centimètres et en degrés), sauf la maison et les événements (estimation). Au départ, à chaque reprise et pour un invité relancé, l'hôte envoie tous les domaines (`reseau.md`, section 14.5).

### 5.4 Débit et limites

| Grandeur | Valeur au pire (paris-maison, service chargé) | Limite | Source de la limite |
|---|---|---|---|
| Débit de l'hôte vers l'invité | 22 Ko/s (déplacements) + 36 (objets) + 17 (service) + 4 (maison) + 2 (événements) = **81 Ko/s**; 96 Ko/s si les meubles changent aussi sans cesse (deux envois par seconde) | 100 Ko/s visés | `architecture.md`, section 14.2 |
| Débit de l'invité vers l'hôte | moins de 5 Ko/s | 512 Kio/s par sens | ADR 0007 |
| Messages par seconde, hôte vers invité | 20 + 4 + 4 + 2 + événements: moins de 50 | 120 | ADR 0007 |
| Plus gros message | 8,9 Ko (objets) | alerte à 32 Kio dans un test, plafond de 64 Kio au-delà duquel le SDK lève une `RangeError` qui arrête la partie | carnet de l'architecte, La Petite Ligne |
| Lecture d'un message chez l'invité (JSON puis schéma) | 0,14 ms au pire mesurée ici, 0,3 à 0,45 ms estimées sur le PC | quelques fois par seconde, sur 8 ms par image | essai |
| Retard d'affichage des autres personnages chez l'invité | deux intervalles (100 ms à 20 par seconde) plus la gigue: 110 à 150 ms en Wi-Fi | de 50 à 250 ms | ADR 0007 |

Si une adresse dépassait l'alerte de 32 Kio (paris-maison avec beaucoup plus d'objets que prévu), le domaine des objets se découpe par niveau ou par pièce. Un test de la CI mesure chaque domaine à la pire adresse jouée par le robot, comme l'endurance de La Petite Ligne.

### 5.5 Objets: sans physique

- **Aucun moteur physique**: un objet est **tenu** (dans la main d'un joueur ou d'un personnage, sur un plateau tenu), **posé** sur un emplacement déclaré par un meuble (table, comptoir, étagère, égouttoir, plateau, réfrigérateur), ou **rangé** (dans une pile, un carton, la réserve, où il n'est plus qu'un compte). Rien ne tombe, ne roule ni ne se lance. Raisons: les deux machines voient exactement la même chose sans envoyer de positions d'objets; rien ne flotte, ne traverse ni ne se coince (règle de cohérence du monde); aucune dépendance de plus.
- **Poser**: le joueur vise une surface; la position se calcule par la fonction pure de pose (empreinte de l'objet contre les objets déjà posés sur cette surface, grille de 5 cm), la même chez l'hôte et pour l'aperçu chez chacun. La visée se fait contre les volumes d'interaction déclarés dans les données (boîtes), pas contre les maillages.
- **Prendre le même objet à deux**: premier arrivé chez l'hôte, dans l'ordre des pas. L'invité affiche aussitôt l'objet dans sa main (prédiction); s'il a perdu, l'objet revient en 0,2 s et il lit « Déjà pris par … » (règle de La Petite Ligne, `simultane.ts`). Pas de compensation de latence: en coopération, peu importe qui a la tasse, il faut seulement qu'elle n'existe qu'une fois. Les piles (tasses propres, assiettes) donnent un exemplaire à chacun et ne se disputent jamais; seul un objet unique (cette assiette sur cette table) peut l'être.
- **De la main à la main**: le joueur qui tient un objet vise l'autre à 1,5 m au plus et donne. L'hôte vérifie que la main de l'autre est libre et fait passer l'objet d'un coup (main pleine: « Camille a déjà les mains prises »). Chez le donneur, la main se vide aussitôt (prédiction); chez le receveur, l'objet arrive avec la confirmation (un aller-retour). Poser sur le passe-plat reste l'autre façon de passer un objet.
- **Plateaux et piles**: un contenant a des emplacements déclarés (un plateau de quatre tasses, une pile de douze assiettes): aucune géométrie libre.

### 5.6 Gestes de précision

Les gestes à la main (arrêter l'extraction au bon moment, mousser le lait à la bonne température, dessiner sur le lait) se jugent **sur la machine du joueur qui les fait**, à la cadence de ses images, avec sa propre aide (gestes simplifiés, cadrage section 4.4). L'hôte réserve le poste au joueur, reçoit le résultat (durées, qualité), le borne aux valeurs possibles et l'applique; l'autre joueur voit le geste par les événements. Jugés chez l'hôte, ces gestes seraient injustes pour l'invité, décalé de 50 à 150 ms. Les actions à maintien (moudre en tenant le clic) restent chez l'hôte: seule leur durée compte, et elle traverse le réseau sans erreur.

### 5.7 Port à deux

- Les deux porteurs tiennent chacun un bout d'une charge rigide (meuble lourd, grosse livraison). L'hôte calcule la charge et les deux porteurs d'après les deux joueurs; pendant le port, **la position de l'invité n'est pas prédite** (elle dépend de l'autre), mais son regard reste local et sans latence. À 1,2 m/s au plus, le retard d'un aller-retour sur les pas se sent peu; le regard immédiat garde le confort.
- Sans échec possible (cadrage): la charge ne heurte ni client ni employé (ils s'écartent); elle s'arrête contre un mur ou un meuble sans rien abîmer; demi-tour sur place impossible, la charge pivote autour de son centre.
- Passages: 1,2 m au moins sur les trajets des gros meubles et des livraisons (portes comprises), porteurs l'un derrière l'autre dans les passages étroits (leçon de La Petite Ligne: une charge à deux qui ne passe pas fige la partie).

### 5.8 Cheminement des clients et pose des meubles

- **Grille de navigation par niveau**, cases de 25 cm, construite depuis les murs de la coque et les empreintes des meubles posés (rasterisation prudente), escaliers en liens entre niveaux. paris-maison: 175 m² environ par niveau, soit moins de 3 000 cases (5 600 pour une salle de 350 m² d'un seul tenant).
- **Règles de pose** (fonction pure partagée par la simulation, l'aperçu et l'hôte, comme `plotPlacement` de La Petite Ligne): un meuble ne se pose pas s'il coupe l'accès à une place, à un poste, à la porte, à la caisse, aux toilettes ou à la réserve; largeurs prises dans `reglages.json` et, par défaut, les normes des plans du level designer (0,9 m jusqu'à chaque place, 1,2 m pour l'allée principale, 1,2 m pour les portes de livraison et les escaliers publics); le minimum technique est 0,6 m (avec des cases de 25 cm, un passage plus étroit n'existe pas pour un client). Vérification par remplissage de la grille depuis l'entrée: moins d'1 ms (calcul pour 5 600 cases au plus).
- **Meuble déplacé pendant un service**: refusé s'il est occupé (client assis, objet d'un client dessus); sinon, la grille se met à jour sur les seules cases touchées et les clients dont le chemin les traverse recalculent leur trajet, deux recalculs par pas au plus.
- **A\***: repère mesuré (LPL, ADR 0016): 1 156 nœuds au plus et 1 ms de processeur au plus par appel dans Node, sur une carte de 100 x 48 cases. Ici, borne de 4 000 nœuds par recherche. Les clients ne cherchent un chemin qu'aux changements d'étape (entrer, faire la queue, s'asseoir, aller aux toilettes, sortir): quelques recherches par seconde au plus.
- **Évitement entre clients**: écartement doux par grille de voisinage; deux clients bloqués face à face plus de 2 s passent l'un à travers l'autre en douceur (un jeu douillet n'a pas d'embouteillage sans fin). Les clients cèdent toujours le passage aux joueurs (section 5.2).
- **Files**: la file d'attente suit une ligne déclarée par le plan (devant la caisse), de six places au plus; au-delà, les clients attendent dehors ou renoncent (règle du game designer).

### 5.9 Code commun

La prédiction de l'invité, la commande devinée par l'hôte et le banc de gigue déterministe de La Petite Ligne (`createVirtualLink` de `tests/invite-fluidite.test.ts`) servent ici aussi. Règle du studio: pas de copie d'un jeu à l'autre. Leur part générique passe dans le SDK (l'aide `createHostAuthority` prévue par `reseau.md`, section 12.6) et dans `@duo/sdk-dev`, sous la main de dev-reseau, avant le prototype; La Petite Ligne garde son code tant qu'elle n'a pas besoin d'en changer.

## 6. Sauvegarde, historique et progression

### 6.1 Contenu et taille

Estimation (aucun code n'existe), en JSON sans texte rendu (identifiant de gabarit et variables, leçon de La Petite Ligne):

| Contenu | Taille estimée |
|---|---|
| Maison: nom, emblème, couleurs, argent, renommée, « Nos projets », calendrier, météo, graine et état du générateur | 5 Ko |
| Adresse active: meubles posés (350 au plus), objets mobiles (450), stock (80 produits), carte et prix, réputation, propreté | 50 Ko |
| Service en cours, si l'enregistrement tombe pendant le service: clients, tickets, postes, tâches des employés | 25 Ko |
| Autres adresses (succursales): meubles posés, équipe, réglages, résultats des 28 derniers jours et cumuls par saison | 60 Ko |
| Recettes connues, fiches | 2 Ko |
| Habitués (une trentaine): étape de leur histoire, relations | 10 Ko |
| Livre d'or: 300 mots gardés (les plus récents et les favoris) | 25 Ko |
| Employés (une trentaine): caractère, forces, humeur, postes, progrès | 12 Ko |
| Statistiques de la maison | 5 Ko |
| **Total en fin de progression** | **environ 200 Ko; 100 à 400 Ko selon la verbosité du format** |

- `maxBytes` du manifeste: 4 Mio (dix fois l'estimation haute), loin du plafond de 32 Mio de la plateforme (ADR 0009).
- Une sauvegarde de 400 Ko se sérialise en 2 à 3 ms sur la machine cloud (calcul d'après l'essai de l'ADR 0009: 46 ms pour 8 Mo), 5 à 7 ms estimées sur le PC: un léger à-coup toutes les 2 minutes chez l'hôte, sous la limite de 34 ms par image. Copie vers l'autre machine compressée (rapport de 8,7 mesuré, ADR 0009): une cinquantaine de Ko.
- Sur le disque: la tête, les trois versions précédentes et au plus cinq copies de secours (ADR 0009), soit quelques Mo par emplacement.

### 6.2 Moments et reprise

- Manifeste: `moments: ["level-end", "auto", "exit"]`, `autosaveSeconds: 120`. Le jeu écrit en `level-end` à la fin de chaque journée (après le bilan de la fermeture); la plateforme demande `auto` toutes les 2 minutes et à chaque pause, et `exit` en quittant. Sans changement depuis la dernière écriture, rien n'est écrit (ADR 0009).
- **Reprise en plein service: possible**. La simulation est sérialisable de toute façon: la plateforme exige l'état complet de la partie pour un invité relancé (`reseau.md`, sections 10.4 et 14.5), et l'enregistrement automatique y ajoute les seules données propres à l'hôte (minuteurs, générateur, cibles des clients; les chemins se recalculent). Après un arrêt normal (Retour au salon, Quitter Duo), rien n'est perdu; après un arrêt brutal de l'hôte, au plus 2 minutes (F06).
- **Migrations**: les données durables (maison, meubles, stock, habitués, employés) se migrent comme dans La Petite Ligne (`dataSchema`, migrations testées en CI sur des sauvegardes de référence de chaque format). Les données d'un service en cours ne se migrent pas: une sauvegarde faite en plein service par une version plus ancienne reprend en fin de journée, le reste du service étant calculé d'un coup par la règle des succursales (section 7.1). Aucune migration compliquée pour des clients qui attendaient leur café.

### 6.3 Historique et progression commune (F07 à F09)

- `play: "session"`: chaque séance s'inscrit à l'historique avec sa durée hors pauses (F08); Retour au salon et Quitter Duo closent une séance normale (`sessionEnd` avec `finished: false`), un plantage l'inscrit « interrompue » (ADR 0009).
- **Progression** (F09, jeu en coopération: dernière progression déclarée): une fraction de 0 à 1 (champ `progress` du pont), proposée ainsi: (rang de l'adresse principale - 1 + part remplie de ses objectifs) / 5; elle reste à 1 dans le jeu libre après la maison parisienne. Formule à confirmer par le game designer.
- **Trois statistiques au plus** par séance (proposition, au game designer): journées tenues, clients servis, mots au livre d'or.
- **Libellé de la sauvegarde** (40 caractères au plus): « Jour 34 · Le bourg ».
- **Trois emplacements** de sauvegarde (une maison par emplacement); une sauvegarde appartient au duo et se reprend quelle que soit la machine qui héberge (F07).

### 6.4 Identifiant du jeu

`id` est stable pour toujours: c'est la clé des sauvegardes et de l'historique (ADR 0005). Il doit être fixé **avant le premier prototype publié**. Si le titre change ensuite, seul `name` le suit; `cosy-cafe` peut rester l'identifiant même si le titre retenu est autre (le joueur ne le voit jamais).

## 7. Succursales et deux cafés

### 7.1 Calcul quotidien des succursales

- Une fonction pure par succursale et par jour: (flux de l'adresse selon le jour, la saison et la météo; carte et prix; équipe et ses forces; état du lieu; réputation) vers (recette, charges, variation de réputation, un mot éventuel pour le livre d'or, un fait du jour). Aléa tiré par `deriveSeed(graine, étiquette)` du SDK, l'étiquette nommant la succursale et le jour: le même résultat quelle que soit la machine qui héberge.
- Mêmes tables que le flux de clients du café joué (profils, attraits), sans clients individuels: le game designer en fixe la formule dans sa simulation, le code la reprend telle quelle.
- Coût: quelques microsecondes par succursale et par jour (calcul). Calculé à la fermeture de chaque journée, affiché sur la tablette de la maison. Données gardées: les 28 derniers jours de chaque succursale et des cumuls par saison.
- Retourner jouer une journée dans une ancienne adresse: elle se charge au début de la journée (section 3.8), avec ses meubles tels qu'on les a laissés.

### 7.2 Deux joueurs dans deux cafés au même moment

| Poste | Même café (cadrage) | Deux cafés en même temps |
|---|---|---|
| Simulation chez l'hôte | une adresse | deux adresses: environ deux fois le coût, près de 200 personnages (72 en ville et 120 à paris-maison); estimation 1 à 2 ms par pas sur le PC, contre 2 ms de budget |
| Rendu | chacun dessine son café | inchangé: chacun ne dessine que le sien |
| Réseau | domaines d'une adresse | inchangé pour l'invité (domaines de son café seulement) |
| Mémoire | une adresse | quelques Mo de données de plus chez l'hôte |
| Règles | une horloge, une journée | deux horloges ou une journée qui attend le plus lent; préparation d'un côté pendant que l'autre sert; livraisons, stock et caisse communs partagés entre deux services |
| Tests | un service | deux services croisés, à éprouver à deux en réseau |
| Jeu | le coup de feu à deux (pilier 1), la parole entre les deux postes | chacun seul dans son café: le pilier 1 s'éteint pendant ces journées |

**Recommandation**: les deux joueurs toujours dans le même café en version 1. Les machines le permettraient (la simulation doublée tient sous 2 ms par pas, estimation), mais deux cafés à la fois coûtent un lot de développement de plus et doublent les tests de service, pour un mode qui retire le cœur du jeu. Si le client le demande après la bêta, en jouant, un ADR le rouvrira; chaque entité porte déjà son adresse (nécessaire pour les succursales), rien n'est à défaire.

## 8. Manifeste, données et contenu

### 8.1 Manifeste proposé

```json
{
  "schema": 1,
  "id": "cosy-cafe",
  "name": "Cosy Café",
  "version": "0.1.0",
  "sdk": "1.1",
  "view": "3d",
  "engine": "three",
  "mode": "coop",
  "play": "session",
  "durationMinutes": [10, 45],
  "network": "host-authority",
  "entry": "index.html",
  "thumbnail": "vignette.webp",
  "description": "Texte du game designer, 200 caractères au plus.",
  "whatsNew": "Premier prototype.",
  "actions": [
    { "id": "forward", "label": "Avancer", "keys": ["KeyW", "ArrowUp"] },
    { "id": "back", "label": "Reculer", "keys": ["KeyS", "ArrowDown"] },
    { "id": "left", "label": "Aller à gauche", "keys": ["KeyA", "ArrowLeft"] },
    { "id": "right", "label": "Aller à droite", "keys": ["KeyD", "ArrowRight"] },
    { "id": "use", "label": "Prendre, poser, utiliser", "keys": ["KeyE"], "mouse": ["left"] }
  ],
  "saves": {
    "slots": 3,
    "maxBytes": 4194304,
    "moments": ["level-end", "auto", "exit"],
    "autosaveSeconds": 120,
    "help": "Le jeu enregistre à la fin de chaque journée, toutes les deux minutes et en quittant."
  },
  "credits": "credits.json"
}
```

- Titre, description et liste complète des actions: game-designer et ux-ui-designer (les cinq actions ci-dessus ne sont qu'un exemple de forme). Champs vérifiés contre le schéma de `packages/protocol/src/manifest.ts` (souris en tableau, deux entrées au plus).
- `sdk` est écrit par le script d'empaquetage: `1.1` aujourd'hui, `1.2` si le pont gagne les préférences par machine (section 12).

### 8.2 Valeurs de gameplay et données

Aucune valeur de gameplay dans le code (règle du studio). Fichiers JSON de `donnees/`, chacun lu par un schéma Valibot au chargement et contrôlé en CI (méthode de La Petite Ligne: schémas décrits dans `donnees/README.md`, validateur Python pour les simulations du game designer, qui lisent les mêmes fichiers):

| Fichier | Contenu | Auteur |
|---|---|---|
| `reglages.json` | rythme de la journée, vitesses, portées, délais, aides des gestes | game-designer |
| `profils.json`, `habitues.json` | profils de clients, habitués et leurs histoires | game-designer |
| `recettes.json`, `produits.json`, `fournisseurs.json` | recettes, matières, prix d'achat, livraisons | game-designer |
| `meubles.json` | catalogue: modèle, prix, style, confort, ambiance, et la géométrie utile à la simulation (empreinte, hauteur, places et leur cap, surfaces et leurs emplacements, points d'usage, accroche murale, luminaire, port à un ou à deux) | game-designer, artiste-3d (géométrie relue sur le modèle par un test) |
| `adresses/<id>.json` | plan: niveaux, murs, portes, vitrines, escaliers, zones (salle, terrasse, réserve, cuisine), entrée des clients, ligne de la file, points de vue du validateur | level-designer |
| `employes.json`, `textes.json` | employés possibles, tous les textes | game-designer |

Les extras des modèles (comme `seat_height` et `top_height` de La Petite Ligne) donnent les hauteurs réelles; un test relit chaque GLB dans Node et compare ses dimensions aux données (méthode de La Petite Ligne).

### 8.3 Ajouter du contenu sans réinstaller Duo

- Chaque ajout (meubles, recettes, adresse, saison) est une nouvelle version du paquet `.duogame`, signée et publiée sur GitHub Releases, téléchargée par Duo ou copiée par le réseau local depuis l'autre machine (ADR 0010); Duo lui-même ne change pas. C'est le rythme de la mise à jour du soir.
- Un identifiant de contenu (meuble, recette, profil, habitué) n'est jamais réattribué ni retiré tant qu'une sauvegarde peut le citer: on le retire du catalogue en vente, pas des données. Toute évolution du format a sa migration et sa sauvegarde de référence.
- Un nouveau meuble coûte: un modèle (GLB avec ses extras), une entrée de `meubles.json`, et rien dans le code.

## 9. Risques et parades

| # | Risque | Probabilité | Impact | Parade | Responsable |
|---|---|---|---|---|---|
| R1 | PC plus faible que l'hypothèse, ou écran 1920x1080 (deux fois plus de pixels, aucun levier de résolution) | moyenne | fort | marge du budget (section 3.1), aucune ombre calculée, banc chez le client au prototype (M1), leviers sans recompilation (distances des niveaux de détail, densité des effets, cadence d'animation au loin), « Image plus douce » en dernier recours | tech-artist, dev-gameplay-3d |
| R2 | Échap avalée par Chromium pendant le verrouillage: pas de pause | certaine sans parade (vérifiée dans le code) | moyen | déverrouillage involontaire changé en `pauseRequest` par le SDK, test dans Electron puis sur les deux systèmes (M4) | dev-plateforme |
| R3 | Mal des transports | moyenne | fort (on arrête de jouer quand on a la nausée) | regard local sans latence; 60 images par seconde tenues; champ de vision réglable (50 à 75°); aucun balancement de tête par défaut ni secousse; la caméra ne bouge jamais sans le joueur (pas de cadrage imposé à un poste, un fondu plutôt qu'un travelling); accélération courte (0,15 s au plus); point central fixe; corrections de prédiction résorbées en douceur; « Réduire les animations » respecté | ux-ui-designer, dev-gameplay-3d, dev-reseau |
| R4 | Objets qui tombent, traversent, se coincent, ou diffèrent entre les deux machines | forte avec un moteur physique | fort | aucun moteur physique, emplacements et surfaces déclarés, pose calculée par une fonction pure (section 5.5) | dev-gameplay-3d, artiste-3d |
| R5 | Clients coincés, embouteillages, accès coupé par un meuble | moyenne | moyen | règles de pose et largeurs de passage, recalcul local, priorité aux joueurs, traversée douce après 2 s, validateur des plans (section 5.8) | dev-gameplay-3d, level-designer |
| R6 | Corrections de prédiction visibles (la caméra saute) | moyenne | fort | aucune collision joueur contre personnage, mêmes obstacles des deux côtés, résorption à 30 % de la vitesse de marche, port à deux sans prédiction de position, banc de gigue (section 5.2) | dev-reseau |
| R7 | Message de plus de 64 Kio: `RangeError`, la partie s'arrête | faible | bloquant | domaines séparés, alerte à 32 Kio en CI, découpe par niveau si besoin (section 5.4) | dev-reseau |
| R8 | Plus de 12 programmes, ou compilation pendant la partie (à-coups sur le PC) | moyenne | moyen | inventaire de la section 3.6, `compileAsync` au chargement, lumières en nombre fixe, même nombre de cibles de morphose, aucune ombre | tech-artist |
| R9 | Plus de 40 personnages dans le champ (terrasse vue de la salle, passants, mezzanine) | moyenne | moyen | compte de la règle 7 du validateur des plans (40 au plus dans le champ, C3), voilages, espaces qui ne se voient pas; foule lointaine (option B) à décider avant `paris-quartier` | level-designer, architecte-technique |
| R10 | `BatchedMesh` décevant sous Direct3D 11 (multi-draw émulé par ANGLE) | faible | moyen | instanciation par modèle prête en repli, comparaison au banc (M3) | dev-gameplay-3d |
| R11 | Sensibilité, inversion et champ de vision perdus d'une séance à l'autre | certaine sans changement | moyen | préférences par machine dans le SDK, ou dans la sauvegarde par membre en attendant (ADR à écrire) | dev-plateforme |
| R12 | Sauvegarde en plein service illisible après une évolution | moyenne | moyen | service en cours non migré, fini par le calcul des succursales; sauvegardes de référence par format (section 6.2) | dev-gameplay-3d |
| R13 | Gestes de précision injustes pour l'invité | forte s'ils sont jugés chez l'hôte | moyen | jugés chez le joueur qui les fait (section 5.6) | dev-gameplay-3d |
| R14 | Textes du monde illisibles à 1366x768 | moyenne | moyen | tailles de lettre de la section 2.4, livre d'or en surimpression | ux-ui-designer, directeur-artistique |
| R15 | Paquet lourd, téléchargé en entier à chaque mise à jour du soir | moyenne | faible | budget de 80 Mo (section 3.8) | ingenieur-build, sound-designer |
| R16 | Chargement d'une adresse au-delà de 5 s sur le PC (compilation des shaders par Direct3D) | moyenne | moyen | peu de programmes, fichiers par adresse plafonnés, mesure M8; le chien de garde tolère 30 s au chargement (ADR 0004) | tech-artist, dev-gameplay-3d |
| R17 | Première vue subjective du studio: collisions, escaliers, objet tenu près des yeux | moyenne | moyen | collisions en 2D par niveau, rampes, rayon de 0,3 m de l'avatar, prototype de déplacement dès le premier lot | dev-gameplay-3d |

## 10. Mesures à faire tôt

Aucun banc de mesure n'existe encore dans le dépôt (lot L8 de la plateforme: aucun fichier le 2026-11-07), et la plateforme ignore pour l'instant les messages `perf` du jeu (`game-host.ts`): l'affichage des performances prévu par l'ADR 0013 n'existe pas encore. Ce jeu apporte donc son banc dès le prototype, **jouable dans la version publiée** (le client le lance sur le PC, comme une partie), qui écrit ses relevés par le module `log` du SDK dans le journal de Duo (`<userData>/logs/`): ils remontent par le rapport de diagnostic (F14, ADR 0015), ou par le fichier du journal en attendant.

| # | Mesure | Où | Critère |
|---|---|---|---|
| M1 | Images par seconde dans trois scènes de 60 s: village plein (24 personnages), pire vue de la section 3.7 (40 personnages, 150 meubles, 150 objets, quatre lumières), et la même à la taille physique de l'écran du PC | PC, puis Mac | critère de la plateforme (section 3.1); relevés: temps d'image, appels, triangles, programmes, `getGPUInfo` |
| M2 | Coût par personnage: la pire vue avec 0, 20, 40 et 60 personnages | PC | 40 personnages en 3 ms au plus par image (animation et dessin) |
| M3 | `BatchedMesh` contre instanciation par modèle, même scène | PC | choix du rendu des meubles |
| M4 | Échap et verrouillage: Échap met en pause en un appui; Alt+Tab, Cmd+Tab, touche Windows et Mission Control ne mettent pas en pause; la reprise par un clic n'agit pas; panneau du jeu ouvert et refermé sans clic; carnet de séance | Electron sous `xvfb-run` ici, puis les deux machines | règle de la section 2.2 |
| M5 | Souris: unité de `movementX` à 100, 125, 150 % sous Windows et sur l'écran Retina; même ressenti à même réglage; effet de `unadjustedMovement` | les deux machines | sensibilité commune réglable |
| M6 | Pas de simulation à 60 Hz avec 120 personnages et le robot | Vitest en CI, puis journal du PC hôte | 1 ms en CI, 2 ms sur le PC |
| M7 | Réseau en vraie séance: corrections de prédiction de l'invité (histogramme), débit par canal, à-coups des déplacements | journal des deux machines | recul à l'arrêt de 5 mm au plus (borne du banc de La Petite Ligne); correction résorbée sans saut (moins d'1 cm par image en plus du pas); débit sous 100 Ko/s |
| M8 | Chargement d'une adresse: lecture des fichiers, textures, compilation des shaders | PC | 5 s au plus |

M1, M2, M4 et M5 conditionnent le prototype: si M1 échoue sur le PC, les plafonds de la section 11 se recalent avant l'alpha, pas après.

## 11. Contraintes pour le design

Plafonds que le game designer et le level designer respectent. Chacun porte sa raison; ce qui n'est pas mesuré est dit.

| # | Contrainte | Valeur | Raison et source |
|---|---|---|---|
| C1 | Personnages animés visibles à la fois (joueurs, employés, clients, passants, terrasse vue par la vitrine) | **40**, 48 en pointe passagère | coût de 40 personnages: 2 à 3 ms par image et 42 appels sur le PC (essai, puis estimation); budget de 8 ms et 150 appels |
| C2 | Personnages présents dans une adresse | 24 (village), 48 (bourg), 72 (ville), 80 (paris-quartier), **120** (paris-maison) | simulation et réseau (sections 5.1 et 5.4); estimation à mesurer (M6) |
| C3 | Personnages au pire dans le champ (100°) depuis chaque point de vue, comptés par la règle 7 du validateur du level designer | **40**; repère: une trentaine de places visibles d'un même point | C1; validateur `plans/valider_plans.py` (21 au pire pour les deux plans du village au 2026-11-07) |
| C4 | File d'attente | 6 places au plus, sur une ligne déclarée du plan | C1 et cheminement |
| C5 | Employés présents dans une adresse | 12 au plus | compris dans C2; visibles, ils comptent dans C1 et C3 (figurants des espaces de travail) |
| C6 | Meubles et décorations posés par adresse | 60 (village), 120 (bourg), 200 (ville), 180 (paris-quartier), 350 (paris-maison); 150 visibles au plus dans une même vue | 70 000 triangles de meubles dans la pire vue à 470 en moyenne (calcul); taille du domaine des meubles (essai) |
| C7 | Objets mobiles (vaisselle, viennoiseries, cartons) existant à la fois dans une adresse | 100, 180, 260, 260, 450; une pile ou un carton compte pour un objet | taille du domaine des objets, 8,9 Ko au pire (essai); 15 000 triangles visibles |
| C8 | Variété du catalogue de meubles | libre; triangles par catégorie de la section 3.3 | `BatchedMesh`: les appels ne dépendent pas du nombre de modèles (à confirmer, M3) |
| C9 | Lumières | luminaires posés en nombre libre; **4 éclairent vraiment à la fois**; 64 flaques de lumière visibles | nombre de lampes dans la clé des programmes (mesuré, LPL); budget de 4 ponctuelles |
| C10 | Ombres | aucune ombre calculée en direct: ombres cuites de la coque, ombres de contact des meubles et objets, ombres rondes des personnages | budget d'appels et de programmes; même image sur les deux machines (R13) |
| C11 | Reflets | aucun reflet calculé: un miroir du catalogue montre un reflet peint | budget de la plateforme (« ni réflexions ») |
| C12 | Objets | aucune physique: tenus, posés sur un emplacement déclaré, ou rangés; rien ne se lance ni ne tombe | section 5.5 |
| C13 | Passages | normes des plans du level designer (0,9 m jusqu'à chaque place, 1,2 m pour l'allée principale, les portes de livraison et les escaliers publics), aussi pour les meubles posés par les joueurs; 1,2 m sur les trajets des gros meubles et des livraisons portées à deux; jamais moins de 0,6 m, minimum technique | grille de 25 cm, croisements, port à deux (section 5.8) |
| C14 | Port à deux | 1,2 m/s au plus; pas de demi-tour sur place | section 5.7 |
| C15 | Joueurs et personnages | les clients et les employés ne bloquent jamais un joueur; deux joueurs ne se bloquent pas | prédiction de l'invité sans erreur (section 5.2) |
| C16 | Gestes de précision | jugés sur la machine du joueur qui les fait | équité de l'invité (section 5.6) |
| C17 | Niveaux | deux au plus par adresse (paris-maison), reliés par des escaliers; une mezzanine ouverte additionne ses places visibles à celles d'en bas (C3) | grille par niveau, C1 |
| C18 | Dehors jouable | la terrasse et le trottoir devant le café; au-delà, un décor de fond (15 000 triangles, 10 appels) | budget de la pire vue (section 3.2) |
| C19 | Échap | jamais une commande du jeu: c'est la pause de Duo; les panneaux du jeu se ferment par leur propre touche ou un clic | ADR 0004, 0005; section 2.2 |
| C20 | Panneaux du jeu | ouverts par une touche ou un clic, ils rendent le curseur; refermés, le regard reprend sans clic | section 2.2 |
| C21 | Textes écrits dans le monde | taille des lettres selon la distance de lecture (section 2.4): environ 2 cm à 1 m et 5 cm à 2,5 m pour 14 pixels à 1366x768 | calcul |
| C22 | Caméra | jamais déplacée sans le joueur: pas de cadrage imposé à un poste, pas de cinématique en vue subjective; fondu enchaîné pour un changement de lieu | mal des transports (R3) |
| C23 | Journée et adresse | on choisit l'adresse au début d'une journée (chargement de 5 s au plus); enregistrement toutes les 2 minutes; reprise en plein service possible | sections 3.8 et 6.2 |
| C24 | Deux cafés à la fois | non en version 1: les deux joueurs dans le même café | section 7.2 |
| C25 | Succursales | résultat calculé une fois par jour, sans clients individuels | section 7.1 |
| C26 | Poids | paquet de 40 Mo au prototype, 80 Mo à la 1.0, dont 25 Mo de musiques | section 3.8 |

## 12. ADR à écrire avant le prototype

Numéros à attribuer par le manager (0017 est le premier libre; 0014 reste réservé au moteur 2D). Aucun n'est écrit ici.

1. **Vue subjective dans Duo: verrouillage du pointeur, Échap et préférences par machine** (plateforme et SDK; architecte-technique avec dev-plateforme). Déverrouillage involontaire changé en `pauseRequest` (amende les ADR 0004, point 3, et 0005, qui dit `pauseRequest` réservé au faux hôte); reprise par un clic qui n'agit pas; cumul du regard par image; unité de `movementX`; stockage de préférences par jeu et par machine (pont 1.2) ou sensibilité et inversion dans les réglages de Duo (F10, alors avec l'accord du client).
2. **Cosy Café: simulation et réseau** (dev-reseau avec architecte-technique et dev-gameplay-3d). Pas de 60 Hz, prédiction de l'avatar sans collision entre personnages, domaines et formes compactes, fréquences et plafonds, arbitrage des objets, don de la main à la main, gestes jugés chez le joueur, port à deux sans prédiction de position, objets sans physique, grille de navigation et règles de pose, aide commune `createHostAuthority` dans le SDK.
3. **Cosy Café: rendu des adresses et de la foule** (architecte-technique avec tech-artist et dev-gameplay-3d). Coque cuite, `BatchedMesh` ou instanciation par modèle (après M3), lumières en nombre fixe, aucune carte d'ombre, inventaire des programmes, squelettes et niveaux de détail, plafonds C1 à C3, et la condition d'ouverture de la foule lointaine.
4. **Cosy Café: sauvegarde, progression et succursales** (architecte-technique avec game-designer). Contenu, moments, reprise en plein service, service en cours non migré, formule de progression, calcul quotidien des succursales, un seul café à la fois.

## 13. Ce qui n'a pas été vérifié

- Tout coût de dessin: aucune mesure sur l'Intel UHD 620; SwiftShader ne le représente pas (M1 à M3, M8).
- Le facteur de 2 à 3 entre la machine cloud et un cœur d'i3 de 2018: estimation fondée sur l'écart de génération et de fréquence, non mesurée.
- Le coût de la simulation: aucun code n'existe; estimation à confirmer par le banc de simulation (M6).
- Le comportement réel d'Échap, d'Alt+Tab et de Cmd+Tab avec le pointeur verrouillé sous Windows et macOS: lu dans le code source, pas encore essayé (M4).
- L'unité de `movementX` selon la mise à l'échelle (M5).
- Les effectifs des adresses (places, présents, meubles, objets): hypothèses de ce document, à recaler sur les plans du level designer et les simulations du game designer, qui écrivent en parallèle.
- `BatchedMesh` sous ANGLE et Direct3D 11 (M3).

## 14. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-11-07 | 0.1 | Première proposition: vue subjective, budgets par adresse, foule, réseau, sauvegarde, succursales, risques, mesures, contraintes pour le design, ADR à écrire; deux essais (`essais/`) | architecte-technique |
