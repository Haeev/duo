# La Petite Ligne: interface en jeu de la démo (maquettes v0.1)

| Champ | Valeur |
|---|---|
| Statut | maquettes haute fidélité, à relire par le manager et par directeur-artistique |
| Rédaction | ux-ui-designer, 2026-10-31 |
| Références | `docs/jeux/jeu-1/demo.md` (périmètre et textes de la démo), `docs/jeux/jeu-1/cahier-des-charges.md` (sections 2, 4.2, 4.3, 5, 9), `docs/plateforme/ux/parcours.md` (conventions communes) |
| Palette | celle du décor de l'artiste 3D: `games/la-petite-ligne/assets-src/modeles/palette.py` (la bible artistique de la démo n'existait pas encore) |
| Planche | `planche.png` (16 écrans en 1366x768) |

L'interface est une couche HTML et CSS posée sur la scène Three.js, dans la fenêtre du jeu. Ce dossier en donne la référence: deux feuilles de style à importer telles quelles, une page autonome par écran avec ses états, les comportements au clavier et à la souris, et les textes exacts. Les pages s'ouvrent dans Chromium sans réseau ni installation.

## 1. Contenu du dossier

| Fichier | Rôle | Pour le jeu |
|---|---|---|
| `jeton.css` | jetons: couleurs, polices, tailles, espacements, rayons, ombres sans flou, durées, couches | à importer |
| `composants.css` | composants et leurs états, préfixe `lpl-` | à importer |
| `icones.svg` | sprite de 74 symboles (objets, meubles, météo, interface, symboles des six profils Duo) | à importer avec `?raw` et à insérer une fois dans le DOM |
| `titre.html`, `creation.html`, `petit-dejeuner.html`, `hud.html`, `dialogue.html`, `carnet.html`, `caisse.html`, `catalogue.html`, `achat.html`, `amenagement.html`, `nuit.html`, `fin.html` | une page par écran; l'état se choisit par l'ancre (`hud.html#veillee`) | référence |
| `support/` | ce qui ne sert qu'aux maquettes: comportements de référence (`maquette.js`), portraits provisoires (`portraits.js`), injecteur du sprite (`icones.js`, généré), polices locales (`polices.css`), scènes provisoires (`scene-*.svg`, générées) | non |
| `polices/` | copies des fichiers woff2 des deux polices et leurs licences OFL | non: le jeu prend les paquets npm |
| `outils/` | `capturer.cjs` (captures et planche), `verifier.cjs` (mise en page, contrastes, clavier), `generer-icones.mjs`, `generer-scenes.mjs`, `typographier.py`, `icones-source.svg` | non |
| `captures/` | 88 captures PNG (voir section 9) | non |

Ajouter `?taille=125` ou `?taille=150` à l'adresse d'une page simule la taille de l'interface; `?animations=reduites` coupe les animations.

## 2. Intégration

### 2.1 Polices (OFL, depuis npm)

Ajouter au paquet du jeu, en version exacte: `@fontsource-variable/fraunces` 5.3.0 et `@fontsource-variable/nunito-sans` 5.3.0. Dans le point d'entrée, avant les feuilles de style:

```ts
import '@fontsource-variable/fraunces/soft.css'; // titres, noms, chiffres (axes graisse et douceur)
import '@fontsource-variable/nunito-sans/wght.css'; // textes de l'interface
import './ui/jeton.css';
import './ui/composants.css';
import spriteIcones from './ui/icones.svg?raw';
```

Les sous-ensembles latin et latin-ext couvrent tous les pseudos valides (accents, Œ, Ç). Aucune des deux polices n'a l'espace fine insécable (U+202F): Chromium la prend dans la police suivante de la pile, sans effet visible. Ni l'une ni l'autre n'a de chiffres tabulaires: voir l'horloge (section 3). Les deux polices doivent être inscrites dans `CREDITS.md` (lignes proposées dans le compte rendu de la mission).

### 2.2 Ce que le code fournit

| Donnée | Où la poser | Source |
|---|---|---|
| taille de l'interface (1, 1,25 ou 1,5) | `document.documentElement.style.setProperty('--lpl-ui-scale', String(ui.scale))` | SDK, module `ui` (ADR 0005); tout est en `rem` |
| réduction des animations | `document.documentElement.dataset.motion = 'reduced'` (ou `'full'` pour ignorer le réglage de l'ordinateur) | SDK, module `ui` |
| couleurs des deux joueurs | `--lpl-player-self` et `--lpl-player-other` sur `:root` | `init`, profils Duo (`design/identite/b/joueurs.json`) |
| symbole de chaque joueur | `<use href="#player-orb">` (identifiants `player-orb`, `player-crescent`, `player-star`, `player-sun`, `player-planet`, `player-comet`) | `init`, symbole du profil |
| libellés des touches | texte des `.lpl-key` | SDK, module `input` (`navigator.keyboard.getLayoutMap()`); pour `Digit1` à `Digit0`, afficher le chiffre (sur AZERTY la touche porte « & » sans Maj) |
| textes | un fichier de textes du jeu, typographie déjà appliquée (section 8) | |

### 2.3 Structure du DOM

```html
<canvas id="scene"></canvas>                 <!-- Three.js, dessous -->
<div class="lpl-ui">                         <!-- couche fixe, laisse passer la souris hors des éléments posés -->
  <div class="lpl-hud" data-state="">        <!-- data-state="dialogue" efface le bas du HUD -->
    <div class="lpl-hud__top-left">     horloge, bourse, puis <ul class="lpl-toasts" aria-live="polite"> </div>
    <div class="lpl-hud__top-right">    l'autre joueur, prochain objectif </div>
    <div class="lpl-hud__bottom-left">  soi: portrait, prénom, forme, endurance </div>
    <div class="lpl-hud__bottom">       astuce, outil en main, barre d'outils </div>
    <div class="lpl-hud__bottom-right"> caméra et carnet à la souris </div>
  </div>
  <section class="lpl-proposal">…</section>  <!-- proposition de gros achat, au besoin -->
  <section class="lpl-panel">…</section>     <!-- carnet, caisse, catalogue: un seul à la fois -->
  <section class="lpl-dialogue">…</section>  <!-- conversation -->
  <main class="lpl-screen">…</main>          <!-- écrans plein cadre: titre, création, nuit, fin -->
</div>
```

Les régions du HUD sont ancrées aux coins: une région haute qui grandit (notifications, objectif) ne pousse jamais la barre d'outils. La région bas gauche est limitée à la place laissée par la barre d'outils, dont les cases rétrécissent seulement quand la fenêtre est trop étroite (150 % sur 1366 px). Les panneaux commencent sous l'horloge (`--lpl-hud-top-band`). Les notifications passent devant les panneaux.

### 2.4 Coût sur le PC de référence

- Aucun flou, aucun `filter`, aucun `backdrop-filter`, aucune ombre floue: ombres décalées sans flou (`--lpl-shadow-*`).
- Animations de `transform` et `opacity` seulement, de 120 à 320 ms, toutes à 0 avec la réduction des animations.
- Le HUD ne se redessine que sur un événement (heure qui change, objet reçu, notification), jamais à chaque image. L'heure change toutes les 10 minutes de jeu (3,5 s réelles en démo).
- Motifs en dégradés répétés seulement sur des éléments fixes (bandeau d'un habitant, hachures de l'endurance basse).

## 3. Composants et états

Les états passent par les attributs ARIA quand ils existent, sinon par `data-state`. Couleur jamais seule: chaque état a une icône, un mot ou un motif.

| Composant | Classe | États | Remarques |
|---|---|---|---|
| Bouton | `.lpl-button`, `--primary`, `--quiet`, `--large`, `--wide`, `--on-dark` | survol, appui, focus, `aria-pressed="true"` (choix fait: coche), `disabled` ou `aria-disabled="true"` (bordure pointillée, encre pâle) | une seule action principale verte par écran; un bouton désactivé reste focalisable quand il dit pourquoi (« Rien à déposer ») |
| Touche | `.lpl-key`, groupe `.lpl-keys` | | libellé selon le clavier réel |
| Puce d'état | `.lpl-chip`, `--ready` (coche), `--waiting` (sablier, fond ocre), `--alert`, `--night` | | libellés de la plateforme: « Pas encore », « C'est parti », « Veut continuer » |
| Jeton de joueur | `.lpl-token`, `data-player="self"` ou `"other"`, `--small`, `--large` | | symbole du profil dans sa couleur, cerclé d'encre (les couleurs Duo claires n'ont que 1,3:1 sur le papier: c'est l'anneau d'encre qui porte le contraste); toujours avec le prénom écrit |
| Carte de joueur | `.lpl-player-card` | puce de l'état | toi à gauche, l'autre à droite |
| Portrait | `.lpl-portrait`, `--small`, `--large` | expression: `low`, `ok`, `good`, `great`, `radiant` | nom de la forme en texte à côté ou en `aria-label`; aucune jauge des besoins (PE-03) |
| Horloge | `.lpl-clock` | `data-state="stopped"` (scène), `"evening"` (veillée, fond nuit), `"waiting"` (absence de l'autre); `data-train="soon"` | jour, météo en mot et en icône, heure; pas de live region |
| Bourse | `.lpl-purse` | `.lpl-purse__note` (« dont 120 réservés »), `.lpl-purse__delta` (« +50 ») | commune aux deux |
| Soi | `.lpl-self`, `.lpl-stamina` | `data-level="low"` (hachures et « Fatigue »), `"empty"` (« Plus d'énergie »); `--lpl-value` | endurance discrète: un trait fin, plus visible quand elle baisse; `role="meter"` |
| Barre d'outils | `.lpl-toolbar`, `.lpl-slot` | `aria-selected="true"` (relevée, cadre laiton), `.lpl-slot--empty`, `data-state="unusable"` (barrée), `data-state="new"`; `.lpl-slot__count`, `__quality` (étoile « belle »), `__gauge` (eau), `__key` | les 10 premières places du sac de 24 |
| L'autre joueur | `.lpl-partner` | `data-state="away"` (fond ocre), `"asleep"` | portrait, prénom, activité en mots |
| Prochain objectif | `.lpl-objective` | lignes `data-state="done"` | |
| Notification | `.lpl-toast`, `--error`, `--event` | `data-state="leaving"` | 6 s (`--lpl-duration-toast`), trois au plus, la plus récente en bas, ne prend jamais le focus |
| Astuce | `.lpl-tip` | | une à la fois, 6 s, en bas au centre |
| Panneau | `.lpl-panel`, `--narrow`, `__header`, `__body` (défile), `__footer` | | le jeu continue derrière (PA-02) |
| Onglets | `.lpl-tabs`, `.lpl-tab` | `aria-selected`, `.lpl-tab__badge` | |
| Sac | `.lpl-bag`, `.lpl-inventory` (`--toolbar`), `.lpl-item-detail` | case choisie `aria-checked="true"`; vide (`.lpl-empty`), plein (notification) | |
| Quête, lettre | `.lpl-quest` (`data-state="current"`, `"done"`), `.lpl-letter`, `.lpl-letter-item` (`aria-current`, `data-state="unread"`) | | |
| Tampon | `.lpl-stamp`, `--green`, `--large` | | « Livré », « Commandé », « D'accord », « Commande complète » |
| Commande | `.lpl-order`, `__line` (`data-state="done"`: case cochée), `__summary` | | |
| Catalogue | `.lpl-catalog`, `.lpl-product` | `aria-pressed="true"` (commandé), `aria-disabled="true"` (raison écrite), `data-state="waiting"` (gros achat en attente) | |
| Proposition | `.lpl-proposal` | `data-state="folding"` (refus ou retrait) | reçue, envoyée, acceptée, refusée |
| Dialogue | `.lpl-dialogue`, `data-speaker` (`firmin`, `odette`, `basile`, `jeanne`, `letter`), `.lpl-choices`, `.lpl-choice` | `aria-pressed="true"` (ma réplique), `aria-disabled`, `.lpl-choice__partner` (choix de l'autre) | bandeau à motif propre à chaque habitant |
| Aménagement | `.lpl-build-bar` | puce « Peut se poser ici » ou raison du refus | couleurs du fantôme dans la scène: `--lpl-ghost-*` |
| Écran plein cadre | `.lpl-screen` (`--night`, `--scene`), `.lpl-sheet`, `.lpl-title`, `.lpl-counters` | | |
| Formulaire | `.lpl-field` (`aria-invalid="true"` affiche l'erreur), `.lpl-choice-group`, `.lpl-option` (radio natif) | | |

Focus: double anneau, bleu d'encre décalé (8:1 sur le papier) et halo clair collé à l'élément (6,5:1 sur le bois, 8,9:1 sur la nuit), sans flou, seulement au clavier (`:focus-visible`).

## 4. Clavier et souris

Échap est réservé à la pause de Duo dans tout le jeu: il ne ferme aucun menu du jeu. Un menu du jeu se ferme par sa propre touche, par Retour arrière ou par un clic hors du menu (cahier, section 5.1). Aucune touche de la rangée des chiffres n'est obligatoire.

| Contexte | Clavier | Souris |
|---|---|---|
| Partout | Échap: pause de Duo; le panneau ouvert reste dessous | |
| HUD | molette ou 1 à 0: outil; A et E: caméra; Tab: carnet | clic sur une case, sur les flèches de caméra, sur l'icône du carnet |
| Panneaux du jeu (carnet, caisse, catalogue) | flèches ou Z Q S D: élément voisin (navigation spatiale); Entrée ou Espace: activer; Retour arrière: fermer; Tab et Maj+Tab bouclent dans le panneau | clic; clic hors du panneau: fermer |
| Carnet | Tab ou Retour arrière: fermer; A et E: onglet précédent, suivant (la caméra ne tourne pas pendant le carnet) | clic sur un onglet |
| Sac | Espace sur une case: la prendre, flèches, Espace: la poser (déplacer); Entrée: action principale de l'objet (« Manger ») | glisser-déposer |
| Dialogue | flèches haut et bas: répliques; Entrée ou Espace: choisir; Espace: suite; Retour arrière: « Au revoir » dans une conversation simple, sans effet dans une scène à deux | clic |
| Proposition reçue | elle ne prend pas le focus (Espace sert à agir dans le monde); Entrée amène le focus sur « D'accord », Tab passe à « Pas maintenant » | clic sur un bouton de la carte |
| Aménagement | molette ou W: tourner d'un quart de tour; Z Q S D ou clic: déplacer; Espace ou clic: poser; X ou clic droit: reprendre; Retour arrière: ranger au sac | |
| Écrans plein cadre | Tab et Maj+Tab, flèches dans un groupe, Entrée | clic |

Règles: focus par défaut sur l'action la plus probable (section 6); anti-double-appui de 300 ms à l'arrivée d'un écran, et jamais d'activation par la répétition automatique d'une touche maintenue; le focus revient à l'élément qui a ouvert un panneau; dans un champ de texte, Retour arrière efface (le champ prérempli place le curseur à la fin).

## 5. Points qui demandent une décision (game-designer, manager)

1. **Tourner un meuble au clavier**: le cahier (5.1) ne donne que la molette. Proposition: W (`KeyZ`, libre dans la démo, sous la main gauche), un quart de tour par appui.
2. **Barre d'outils**: proposée comme les 10 premières places du sac de 24 (le sac montre 10 + 14).
3. **Carnet**: A et E changent d'onglet tant qu'il est ouvert (sinon ils tournent la caméra), car Tab le ferme.
4. **Nouveaux textes** marqués « proposé » en section 8: ils ne sont pas dans `demo.md`.
5. **Noms des coiffures** (« Courte », « En bataille », « Nouée ») à accorder avec les trois coiffures modélisées par artiste-3d.
6. Écrans non maquettés mais nécessaires à la démo: comptoir d'Odette (acheter, vendre), établi, réchaud. Ils reprennent `.lpl-panel` et `.lpl-catalog` ou `.lpl-order` sans nouveau composant.

## 6. Écrans, états et focus par défaut

| Page | États (ancre) | Focus par défaut |
|---|---|---|
| `titre.html` | `accueil`, `attente`, `reprise` (sauvegarde, P1) | Commencer la semaine; Pas encore; Reprendre |
| `creation.html` | `edition`, `erreur`, `fini` (lettre de la coopérative en attendant l'autre), `prets` | champ Prénom; Modifier mon personnage |
| `petit-dejeuner.html` | `matin`, `petite-forme`, `parti` | Commencer ma journée |
| `hud.html` | `jour`, `vide` (premier jour, mains vides), `pluie` (et endurance basse), `veillee`, `attente` (l'horloge attend l'autre), `fatigue` (plus d'énergie), `train`, `notifications` | le jeu |
| `dialogue.html` | `scene`, `choix-autre`, `attente`, `reponses`, `odette`, `basile`, `carte` | première réplique; Suite |
| `carnet.html` | `sac`, `sac-plein`, `sac-vide`, `quetes`, `courrier` | case choisie; quête en cours; dernière lettre |
| `caisse.html` | `caisse`, `caisse-vide`, `complete`, `tableau`, `parti` | premier « Déposer »; sinon première ligne |
| `catalogue.html` | `catalogue`, `attente`, `trop-cher`, `ferme`, `livre` | premier article commandable |
| `achat.html` | `recue`, `envoyee`, `acceptee`, `refusee`, `manque` | le jeu (Entrée pour répondre) |
| `amenagement.html` | `pose`, `bloque`, `deja-pris` | le jeu |
| `nuit.html` | `choix`, `attente`, `desaccord`, `fin` | Continuer |
| `fin.html` | `complete`, `partielle`, `attente` | Continuer |

Comportements propres:

- **Scène à deux** (HA-08): chacun choisit sur son écran et voit le choix de l'autre (jeton et « Choix de Sacha »); même réplique: dite une fois; sinon les deux, l'une après l'autre, puis l'habitant répond aux deux. L'horloge est arrêtée et le dit.
- **Écran de nuit** (PA-08): « Continuer » et « Finir la séance » sont des choix qu'on peut changer tant que l'autre n'a pas choisi; la séance finit quand les deux ont choisi « Finir la séance », le jour suivant commence quand les deux ont choisi « Continuer ». En désaccord, l'écran le dit et invite à en parler.
- **Gros achat** (EC-04, à partir de 100 sous): la somme est réservée et la bourse l'affiche; la carte reste jusqu'à la réponse, au retrait ou à la nuit; refuser ne coûte rien.
- **Écran de fin**: chacun choisit « Continuer », puis l'écran de fin de Duo prend le relais.

## 7. Contrôles faits

- `node games/la-petite-ligne/ui-maquettes/outils/verifier.cjs`: 55 états x 4 affichages (1920x1080, 1366x768 à 100, 125 et 150 %) = 220 pages sans débordement ni texte posé sur la scène sans fond; contraste du texte le plus faible 5,02:1 (AA: 4,5:1); 12 scénarios au clavier seul réussis.
- `node games/la-petite-ligne/ui-maquettes/outils/capturer.cjs`: 55 états en 1366x768, 13 écrans principaux en 1920x1080, 9 écrans en 1366x768 à 125 et 150 %, 2 écrans au facteur 2; `planche.png`.
- Limites connues: à 150 % sur 1366x768, le détail de l'objet du sac et le bas de la création passent sous le pli et défilent (l'action principale reste visible); la bourse peut passer sous un panneau à 150 %, d'où la bourse répétée dans l'en-tête du catalogue.

## 8. Textes exacts par écran

Écrits ici avec des espaces ordinaires; les pages HTML portent les espaces insécables (`outils/typographier.py`). « Camille » (toi) et « Sacha » (l'autre) sont des exemples. Source: `demo.md` sauf mention « proposé ».

### Écran titre

- Démo · Une semaine à la Halte d'Aubrune (proposé)
- La Petite Ligne
- La ligne rouvre. Faites revivre la halte, et le train ira plus loin. (cahier, 6.12)
- Camille (toi) · Sacha · puces: Pas encore · C'est parti
- Boutons: Commencer la semaine · Pas encore · Reprendre : jeudi 6, 6 h · Recommencer la semaine (proposé)
- Aide: La semaine commence quand vous avez choisi « Commencer la semaine » sur les deux ordinateurs. · En attente de Sacha… · Votre semaine est enregistrée au petit-déjeuner du jeudi 6. · Échap : pause et réglages de Duo (proposé)

### Création des personnages (proposé, sauf la lettre)

- Samedi 1, 9 h 50 · le train approche d'Aubrune
- Qui descend du train ?
- Prénom · Ton pseudo Duo, à changer si tu veux. 16 caractères au plus. · Erreur: Il faut un prénom, même court.
- Coiffure: Courte · En bataille · Nouée
- Tenue: Bleu de travail · Rouille · Sauge · Moutarde (noms de `palette.py`)
- Ton foulard porte la couleur et le symbole de ton profil Duo : astre aqua.
- C'est parti ! · Modifier mon personnage · En attente de Sacha… · Le train entre en gare…
- Sacha · Choisit sa tenue… · C'est parti · Chacun crée son personnage sur son ordinateur, en même temps.
- Une lettre t'attend, puis le courrier du jour 1 de la coopérative (demo, 3.4)

### Petit-déjeuner

- Mercredi 5 · 6 h 00 · Soleil
- Niveau de forme et phrase du réveil (demo, 3.5): En forme, « Bien dormi, bien mangé : en forme. »; Petite forme, « La nuit a été courte et le ventre crie. Un bon souper, ce soir ? »
- Ton envie du jour : récolter quelque chose de beau. · Rien que pour toi · Sacha ne la voit pas. Demande-lui la sienne ! (proposé)
- Envie à deux : souper à la même table. · Chez les deux · À réaliser ensemble aujourd'hui. (proposé)
- Courrier : rien de neuf ce matin. · Les poules ont pondu : 3 œufs dans la mangeoire. (proposé)
- Commencer ma journée · Sacha prend son petit-déjeuner… · Sacha a commencé sa journée : l'horloge tourne. · L'horloge reste à 6 h jusqu'à ce que l'un de vous commence sa journée. (proposé)

### HUD

- Horloge: Mercredi 5 · Soleil · 9 h 20 · Veillée · l'horloge est arrêtée · Scène à deux · l'horloge est arrêtée · L'horloge attend Sacha. (demo) · Départ du train à 16 h (proposé)
- Bourse: 214 sous · dont 120 réservés · +50
- Soi: Camille · En forme (les cinq niveaux: Petite forme, Ça va, En forme, Pleine forme, Forme rayonnante) · Fatigue · Plus d'énergie
- Outil en main: Arrosoir · 7 arrosages sur 10 · Main libre (proposé)
- L'autre (proposé): Coupe du bois à la lisière · Sur le quai · Regarde le catalogue · Cuisine au réchaud · Fait une pause depuis 3 min · Dépose des œufs dans la caisse · Bêche au potager · Au comptoir d'Odette · Place une chaise · Dans la scène, sur le quai
- Objectif: Prochain objectif · titres et objectifs du carnet (demo, 3.3) · Radis 6 sur 12 · Laitues 0 sur 3 · Œufs 3 sur 6 · Planches 4 sur 10
- Notifications (demo, 3.5): Déjà pris par Sacha. · Il manque 40 sous. · Le train de samedi est en gare ! · Le train part dans une heure. · Plus d'énergie : tout prend deux fois plus de temps. Un en-cas ?
- Notifications (proposé): Bichette, Cocotte et la Duchesse ont pondu : 3 œufs. · Odette t'a acheté 9 radis : +50 sous. · Il pleut : tout le potager a bu pour aujourd'hui. · Sacha déplace ce meuble. · Proposition refusée : rien n'a été dépensé.
- Astuces: celles de `demo.md` (3.1), par exemple A1, A8, A12, A16
- Raccourcis: A · E · Tab; noms accessibles: Tourner la caméra à gauche (A) · Tourner la caméra à droite (E) · Ouvrir le carnet (Tab)

### Dialogue

- Noms et rôles: Firmin Lacombe, chef de halte bénévole · Odette Ferrand, épicière · Basile Cornu, menuisier retraité · Jeanne Ribot · La carte de la boîte en fer
- Répliques et choix: ceux de `demo.md` (3.2), par exemple « On s'y met tout de suite ! » et « Vingt ans, vraiment ? »
- Scène à deux (proposé): Scène à deux · Choix de Sacha · Chacun choisit sa réplique. Sacha verra la tienne. · Sacha a choisi. À toi. · Sacha choisit sa réplique… · Firmin répond à Camille, puis à Sacha. · Sacha : « Vingt ans, vraiment ? »
- Comptoir d'Odette (proposé): Acheter des graines et des clous · Vendre des récoltes · Au revoir
- Suite · Espace · Retour arrière au revoir

### Carnet

- Carnet · Quêtes · Courrier · Sac · Fermer · Tab
- Sac (proposé): Barre d'outils · molette ou 1 à 0 · Sac · 14 places · Pain, 1 · En-cas · cadeau d'Odette · Manger un en-cas rend de l'endurance, sans compter pour le souper. · Manger : +10 d'endurance · Déplacer · Belle : arrosée chaque jour de sa pousse · Vaut 1,5 fois le prix : 10 sous pièce à la coopérative.
- Sac plein (proposé): Ton sac est plein : ce que tu ramasses tombe à tes pieds. Vends, dépose dans la caisse ou range dans le coffre.
- Sac vide (proposé): Ton sac est vide. Ce que tu récoltes, achètes ou fabriques arrive ici.
- Quêtes: Une semaine à la Halte · Pour les gens du bourg (proposé) · titres et objectifs de `demo.md` (3.3) · 2 lignes sur 4 · 3 sur 4 · Faite · Ce soir, 19 h · Avec Jeanne
- Courrier: lettres de `demo.md` (3.4) · nouveau
- Pied (proposé): A E pages · flèches ou Z Q S D choisir · Retour arrière fermer · Le jeu continue pendant que tu lis.

### Caisse et tableau de la commande

- Caisse de la coopérative · Tableau de la halte · Commande · Commande du samedi 8, départ du train à 16 h
- 2 lignes sur 4 · Le train part dans 2 jours. Complète, la commande rapporte 540 sous. (proposé)
- 0 ligne sur 4 · Dépose ici les produits de la commande. Ils partent samedi à 16 h. (astuce A15)
- 4 lignes sur 4 · Commande complète · 540 sous au départ du train, à 16 h.
- Le train est parti · Expédiée · « La coopérative a reçu 4 lignes sur 4 : 540 sous. Merci ! Les radis d'Aubrune ont fait sensation à la ville. » (demo, 3.4)
- Lignes: Radis, Laitues, Œufs, Planches · 11 dans ton sac · Aucune dans ton sac · Il en manque 3 · Livrés · 12 sur 12 · Livré · Déposer 3 œufs · Rien à déposer (proposé)
- Voir le catalogue · Reprendre un produit · On peut reprendre un produit jusqu'au départ. · Les lignes se cochent quand vous déposez à la caisse. (proposé)

### Catalogue

- Catalogue de la coopérative · Commande avant vendredi minuit, livraison par le train de samedi, 10 h (proposé)
- Déjà commandé : lampe à pétrole, 40 sous · À partir de 100 sous, l'achat attend l'accord de l'autre. (A16)
- Articles (demo, 1.5): Lampe à pétrole, 40 sous, Lumière chaude · beauté · Tapis, 60 sous, Confort · Rideaux, 30 sous, Beauté · « font fureur à la ville » · Poste à galène, 120 sous, Il annoncera le temps du lendemain
- États (proposé): Commandé · arrive samedi · Entrée pour commander · Demande l'accord de Sacha · 120 sous réservés · En attente de l'accord de Sacha… · Retirer ma proposition · Il manque 35 sous. · fermé · Livré · Dans le coffre
- Le catalogue est fermé. · Ce que vous avez commandé arrive à 10 h par le train. · 2 colis dans le coffre de la maison · Prends un colis dans le coffre pour poser le meuble. · Sacha voit ce que tu commandes. (proposé)

### Proposition d'un gros achat

- Proposition de Sacha · Sacha propose d'acheter un matelas pour 120 sous. D'accord ? (demo, 3.5)
- La somme est réservée en attendant ta réponse. Sans réponse, la proposition s'annule à la nuit. (proposé)
- D'accord · Pas maintenant · tampon D'accord · Le matelas est dans le sac de Sacha. 120 sous dépensés. (proposé)
- Ta proposition · Tu proposes d'acheter un poste à galène pour 120 sous. · En attente de l'accord de Sacha… · Retirer ma proposition (proposé)
- Chez celui qui a proposé, après un refus: Camille préfère attendre : rien n'a été dépensé. (proposé, non maquetté)
- Astuce: Entrée pour répondre, ou un clic sur la proposition. Tu peux continuer à jouer. (proposé)

### Aménagement

- Table · En main · Peut se poser ici · Ça ne passe pas : la porte doit rester libre. · Sacha la tient : attends qu'elle soit posée. · Vers le nord (proposé)
- Molette ou W tourner · Z Q S D ou clic déplacer · Espace ou clic poser · X ou clic droit reprendre · Retour arrière ranger au sac (A14, complété)

### Écran de nuit (proposé)

- Fin du mardi 4 · Bonne nuit · À la prochaine séance
- Demain, mercredi 5 : le souper chez Odette · Chez elle, à 19 h, tous les deux. Pensez aux 3 radis et aux 2 laitues.
- La commande du samedi : 2 lignes sur 4 · Le train part samedi à 16 h, dans 4 jours.
- Puces: Pas encore · Veut continuer · Veut finir la séance
- Vous continuez quand vous avez choisi « Continuer » sur les deux ordinateurs. Tu peux changer d'avis tant que Sacha n'a pas choisi.
- En attente du choix de Sacha…
- Sacha veut finir la séance. La séance finit quand vous avez choisi « Finir la séance » sur les deux ordinateurs. Parlez-en, puis choisissez.
- La séance est finie. Le monde vous attend tel quel : mercredi 5, 6 h, au petit-déjeuner. · Progression enregistrée. Retour au salon de Duo…
- Continuer · Finir la séance

### Fin de la démo

- Samedi 8, 16 h · le train est reparti (proposé)
- Fin de la démo. · Une semaine à la Halte d'Aubrune. · La suite de la ligne arrive bientôt. (demo, 3.5)
- 8 journées vécues · 4 sur 4 lignes de la commande remplies · 9 meubles posés
- Continuer · Pas encore · En attente de Sacha… · Ensuite : l'écran de fin de Duo, et la séance dans votre historique. (proposé)

## 9. Régénérer

Depuis la racine du dépôt (Node 22, Playwright et Chromium de l'environnement):

```sh
node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs   # icones.svg et support/icones.js
node games/la-petite-ligne/ui-maquettes/outils/generer-scenes.mjs   # support/scene-*.svg
python3 games/la-petite-ligne/ui-maquettes/outils/typographier.py games/la-petite-ligne/ui-maquettes/*.html
node_modules/.bin/prettier --write games/la-petite-ligne/ui-maquettes
node games/la-petite-ligne/ui-maquettes/outils/verifier.cjs          # mise en page, contrastes, clavier
node games/la-petite-ligne/ui-maquettes/outils/capturer.cjs          # captures/ et planche.png
```

Noms des captures: `<écran>-<état>-<largeur>x<hauteur>[-<taille>][@2x].png`.
