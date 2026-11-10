# Carnet de ux-ui-designer

Apprentissages durables (conventions, pièges, astuces vérifiées). Pas d'avancement ici.

## Conventions de rédaction de l'interface

- Rédaction neutre: le genre des joueurs n'est pas connu (le PC est celui de la compagne du client). Participes avec « avoir » (« Sacha a rejoint »), jamais avec « être » (« Sacha est prête »). « Sacha est là », « Connexion perdue avec Sacha », « Sacha est de retour », « sur les deux ordinateurs » au lieu de « tous les deux ». Lexique complet: `docs/plateforme/ux/parcours.md`, section 0.2.
- État de départ d'un joueur: bouton « C'est parti ! » et puces « C'est parti » / « Pas encore » (neutres). La puce reprend toujours le libellé du bouton (« Veut rejouer », « Veut continuer »).
- Élision devant un pseudo ou un nom de jeu variable: « d'Inès », ou placer le nom après un deux-points.
- Docs: style maison sans espace avant « : » dans la prose; textes d'interface avec espaces insécables. `design/maquettes/plateforme-wireframes/typographier.py` applique la typographie aux HTML (idempotent, saute script et style).

## Tailles d'écran à tester (points logiques)

- 1280x720: écran 1080p réglé à 150 % dans Windows, fréquent sur les portables. Cible « sans défilement ».
- 1366x689 et 1280x640: fenêtres agrandies avec barre des tâches de Windows 11 (48 px) et barre de titre. Défilement vertical permis, action principale visible.
- 1093x615: 1366x768 avec l'interface à 125 %. Jamais de défilement horizontal.
- Test d'effort: police forcée en DejaVu Sans (environ 10 % plus large que Segoe UI) et pseudos de 16 caractères (« Maximilien-Louis »). Script: `verifier-mise-en-page.js`.

## Pièges vérifiés (Chromium et Playwright)

- `system-ui` donne Inter dans l'environnement cloud: plus étroit que DejaVu, proche de SF Pro et Segoe UI.
- Ne jamais nommer un état d'écran (ancre `#etat`) comme un `id` de la page: la navigation vers l'ancre retire le focus posé au chargement.
- Un focus posé par script au chargement est bien `:focus-visible` dans Chromium.
- `page.goto` vers la même adresse avec la même ancre ne recharge pas: passer par `about:blank`.
- En JavaScript, `\s` attrape aussi U+00A0 et U+202F: pour comparer des textes typographiés, normaliser seulement `[ \t\r\n]`.
- Un pseudo-élément décoratif en `inset` négatif gonfle `scrollWidth` et fausse les détecteurs de débordement: utiliser `outline` et `outline-offset`.
- Un élément positionné plus loin dans le DOM passe devant un badge absolu: donner un `z-index` au badge.
- `dialog.showModal()` respecte `autofocus` à l'intérieur; Tab peut sortir de la fenêtre en headless, d'où un piège à focus explicite dans `commun.js`.
- Les vignettes provisoires (« Vignette ») polluent le nom des cartes lu par les lecteurs d'écran: `aria-hidden="true"`.

## Boîte à outils des wireframes

- `design/maquettes/plateforme-wireframes/commun.css` et `commun.js`: états par ancre (`data-si`), focus par défaut (`data-focus`, priorité numérique), Échap (`data-retour` ou `Duo.surEchap`), anti-double-appui de 300 ms, grille à flèches, onglets, compte à rebours, piège à focus des fenêtres.
- `capturer.js` (captures et planche), `verifier-mise-en-page.js` (débordements et contrastes WCAG), `verifier-clavier.js` (clavier seul, comptage des actions). Les trois se lancent depuis la racine du dépôt avec `node`.

## Interface en jeu (couche HTML sur une scène 3D)

- Modèle clavier en jeu validé pour La Petite Ligne: Échap = pause de Duo, ne ferme aucun menu du jeu; un menu se ferme par sa touche ou Retour arrière (et clic hors du menu); une carte qui demande une réponse (proposition) ne prend jamais le focus, car Espace agit dans le monde: Entrée l'amène dessus. Exemple complet: `games/la-petite-ligne/ui-maquettes/README.md`.
- Régions du HUD ancrées aux coins (position absolue), jamais une grille à trois rangées: avec la taille d'interface à 150 % sur 1366x768, la grille repoussait la barre d'outils hors de l'écran.
- Les media queries en `rem` ignorent la taille de police de la racine: la taille d'interface ne se détecte pas ainsi; utiliser `min()` et `clamp()` avec `vw` ou `vh`.
- Tout composant à fond papier fixe sa propre couleur de texte: posé dans un en-tête sombre, il héritait du texte clair (contraste 1:1, trouvé par le vérificateur).
- Couleurs de profil Duo sur fond clair: l'aqua n'a que 1,3:1 sur le papier; le jeton du joueur garde un anneau d'encre, qui porte le contraste.
- Palette d'un jeu: celle du décor de l'artiste 3D (`games/<jeu>/assets-src/modeles/palette.py`) existe souvent avant la bible artistique.

## Pièges vérifiés (suite)

- Le `package.json` racine est en `"type": "module"`: un script Node qui fait `require('playwright')` doit être en `.cjs` (playwright est installé hors du dépôt, dans `/opt/node-tools`, introuvable par `import`).
- Prettier contrôle `games/**` (pas `design/` ni `docs/`): passer `node_modules/.bin/prettier --write` sur ses fichiers, et faire produire par les générateurs un fichier déjà au format (chaîne entre apostrophes, retour à la ligne après `=`). Un `.svg` cité explicitement fait échouer `--check`; un dossier entier, non.
- `outils/verifier-depot.mjs` contrôle aussi le code des maquettes sous `games/` (aucun `console.log`, marqueur de tâche avec `(#n)`).
- L'attribut `hidden` perd contre le `display` d'un composant: règle `[hidden] { display: none !important }`. Les éléments SVG n'ont pas de propriété `hidden`: `toggleAttribute('hidden', …)`.
- `<use href="sprite.svg#id">` externe est refusé par Chromium en `file://`: injecter le sprite dans la page par un script.
- Détecter un débordement de texte par les rectangles des nœuds de texte (`Range`), pas par `scrollWidth`, gonflé par les badges en position absolue.
- `focus()` sur un champ prérempli met le curseur au début: `setSelectionRange(fin, fin)`.
- `hashchange` est asynchrone: attendre un instant avant de lire l'état dans Playwright.
- Après `typographier.py`, une recherche exacte de « ! » ou « ? » échoue (espace fine U+202F devant): chercher par expression régulière.
- Fraunces et Nunito Sans (fontsource 5.3.0): ni espace fine insécable ni chiffres tabulaires (horloge à largeur fixe, mise à jour toutes les 10 minutes de jeu).

## Relecture d'une interface en jeu (gauntlet)

- Page de démonstration de La Petite Ligne (`src/interface/demo/index.html`, Vite du jeu): `rendu=0` donne une capture en 3 s au lieu de 35 s avec la scène 3D (fond uni); `autre=fige` fige l'autre joueur pour les parcours au clavier. Le scénario `creation` ouvre l'écran titre (Entrée pour passer à la création) et `courrier` l'onglet Quêtes.
- Un détecteur de débordement par rapport à la fenêtre ne voit pas les collisions entre régions du HUD (barre d'aménagement sur le portrait et les boutons de caméra): tester aussi l'intersection des rectangles des régions ancrées, à 100, 125, 150 % et à 1280x720 avec `deviceScaleFactor: 1.5`.
- Plus d'une douzaine de contextes à la suite dans le même navigateur Playwright a fini en « Target page, context or browser has been closed »: découper les balayages en lots.
- Audit sonore d'une interface: comparer chaque interaction de l'interface du jeu aux sons 01 à 04 de `docs/plateforme/identite-sonore.md` (focus, validation, retour, erreur), et vérifier qu'un refus ne joue pas le son d'une bonne nouvelle (`say()` crée une notification `message`).

## Interface imagée de La Petite Ligne (0.12.2)

- Composants communs: `src/interface/vitrine.ts` (`Vitrine`: grille paginée et détail, focus = sélection, Entrée ou second clic agit; `pastille`, `gauge`, `need`, `iconRow`, `flyCoin`) et `vitrine.css`. Règles: `docs/jeux/jeu-1/interface-imagee-0-12-2.md`. Les cartes plus riches (recettes, bêtes) prennent la page à la vitrine puis remplacent les vignettes de sa grille.
- Pages et onglets partagent A et E: la vitrine tourne d'abord ses pages (`turn()` faux au bout), puis le panneau passe à l'onglet voisin. Mettre la page dans la signature de `renderBody`, et `data-autofocus` sur la vignette choisie: c'est `renderBody` qui remet le focus après le changement de page.
- Une étiquette au survol en position absolue sous une vignette ne fait pas défiler si elle reste dans le rembourrage du corps (1 rem); vérifié par le capteur `ui-maquettes/outils/capturer-0-12-2.cjs`, qui ignore les textes à `opacity: 0` et à points de suspension.
- Scénarios de démonstration qui partent de la référence d'été du format 13 (poules, poissons au carnet): `src/interface/demo/scenarios-0-12-2.ts`; `rendu=leger` pour l'aperçu 3D du personnage (salon, mercerie), 4 s d'attente de plus.
- Garde de l'arbre isolé: une commande `cd ... && python3 - <<EOF` est refusée; écrire le script dans le bloc-notes avec Write, puis `python3 chemin`.
- `@typescript-eslint/no-unnecessary-condition` ne suit pas une variable booléenne modifiée dans une fermeture: utiliser un objet (`{ taken: false }`).
- Chromium aligne aussi les blocs (`justify-items` en flux normal): une vignette `.lpl-tile` passée en `display: block` garde le `place-items: center` hérité et rétrécit son contenu au centre. Remettre `place-items: normal` (cartes de quêtes).
- Grille `auto auto 1fr` avec des lignes en `overflow: hidden` et points de suspension: les rangées `auto` tombent à 0 face au `1fr` et les textes se chevauchent. Utiliser `max-content`.
- Le port 5231 peut être pris par le Vite d'un autre arbre (autre code servi!): lancer le sien sur un autre port et le passer en `[base]` au capteur.
- Le capteur réécrit toutes les captures « après » quand on ne filtre pas: restaurer celles des autres écrans (`git checkout -- <fichiers>`, arguments littéraux: la garde refuse `xargs git`).
- `souvenirs-ecran.test.ts` (scénario `souvenirs-plusieurs`) attend que E passe d'onglet en onglet depuis les Quêtes: un onglet ne doit pas avoir de pages dans ce cas. D'où, aux quêtes, « en cours » et « terminées » séparées.
- `secret-ecran.test.ts` veut lire la fiche du secret chez l'informé à l'ouverture du carnet: au détail d'une vitrine, la quête au secret « mine » doit être choisie d'emblée.
- Sac et rangement: Vitrine ne gère ni case vide ni glisser-déposer; le sac garde ses cases à lui avec les classes `.lpl-tile`, le rangement assemble trois `Vitrine` sans détail (`noDetail`) et un détail commun mis à jour sur `focusin`.

## Carnet des voisins (0.13)

- Un `<span class="lpl-portrait">` posé hors d'un conteneur flex ou grid reste en ligne: sa largeur ne s'applique pas et le SVG prend 100 % du bloc parent (portrait de 300 px). Mettre le parent en `display: flex`.
- Les six habitants de la démo n'ont pas encore d'habitudes dans les données (lot H4): leur frise est toute en « ? » et leur compte « 0/0 ». Les scénarios de démonstration `voisins-*` partent de la référence d'été du format 13 et posent `lucie_back` (sinon Lucie est hors du bourg toute la journée).
- Les états des habitants de la 0.13 n'existent qu'après un pas de simulation (`ensureVillagers`) quand on part d'une sauvegarde du format 13: faire un `step` avant de poser `met`.
- La garde de l'arbre isolé refuse `grep ... --exclude-dir=.git` et `git show ... | ...`: utiliser l'outil Grep pour le contrôle des tirets, et écrire dans un fichier avant de comparer.
- Les fichiers du jeu existants ne sont pas au format Prettier (lignes longues): ne passer `prettier --write` que sur les fichiers neufs.
- `UI_SETTINGS` est `as const`: une boucle `m < v.dayTo` déclenche `no-unnecessary-condition`; typer une locale `const end: number`.
- Hauteur à 125 % sur 1366x768: `min(4rem, 9.6vh)` pour la taille des vignettes garde 100 % intact et fait tenir la page.

## Vue subjective (Cosy Café, 2026-11)

- Pointeur verrouillé: Chromium avale le premier Échap (gestionnaire d'accès exclusif d'Electron avant `before-input-event`); parade du SDK: déverrouillage involontaire, fenêtre active, partie `running` = `pauseRequest`. Après un Échap, re-verrouiller exige un geste (clic ou touche) et Chromium refuse 1,25 s; sans geste seulement si la page a rendu le pointeur elle-même (`exitPointerLock`). D'où la capsule « Clique pour reprendre la souris », premier clic consommé (`docs/jeux/cosy-cafe/technique.md`, 2.2).
- La caméra ne bouge jamais sans le joueur (C22): une interface posée s'ouvre en surimpression 2D, jamais par un cadrage; une aide à viser choisit la cible, ne tourne pas la vue.
- Bas de l'écran réservé aux mains et au plan de travail: HUD en haut (horloge et tickets à gauche, alertes au centre, l'autre à droite), seul « En main » au coin bas droit, au-dessus de l'indicateur de sauvegarde de Duo. Taille du HUD plafonnée: `font-size: min(1rem, 100vh / 30)`, tailles en `em`; tient de 911x512 (1366x768 à 150 % Windows) à 1920x1080 à 150 %.
- Repères des sons sur un anneau autour du point de visée (9 em sur les côtés, 10 em derrière), icône seule nommée pour les lecteurs d'écran: évite les chevauchements avec les coins. Le vérificateur doit comparer aussi les éléments du centre entre eux.
- Seuil des lettres écrites dans le monde fixé à 18 px à 1366x768 au champ de vision par défaut (2,7 cm à 1 m, 6,8 cm à 2,5 m), plancher 14 px; le reste se lit dans une carte du HUD ou une interface.
- Avant d'inventer des noms ou des prix d'exemple, lire la simulation du game designer (`docs/jeux/<jeu>/simulations/*.py`): noms, horaires, prix conseillés, jour de fermeture. Vérifier la cohérence du calendrier (une saison commence un lundi: « mardi 9 », pas « mardi 12 »).

## Maquettes en HTML (pièges vérifiés, suite)

- L'événement `close` d'un `<dialog>` ne remonte pas: l'écouter en capture. Bloquer `cancel` pour qu'Échap ne ferme pas une fenêtre du jeu; la pause simulée de Duo est elle-même un `<dialog>` modal (sinon inerte sous un autre modal).
- `focus({ preventScroll: true })` laisse le focus par défaut hors de la vue dans un conteneur qui défile: enchaîner `scrollIntoView({ block: 'nearest' })`. Barre d'action collante (`position: sticky; bottom: 0`) avec `box-shadow` de la couleur du fond pour masquer ce qui passe dessous.
- Piège de largeur minimale: une grille à colonne implicite grandit jusqu'au contenu le plus large (`grid-template-columns: minmax(0, 1fr)`), et `minmax(7rem, 1fr)` plus des boutons déborde à 150 %: `minmax(0, 1fr)` et laisser le nom passer à la ligne.
- Remplacer un texte dans un HTML déjà typographié: remettre d'abord U+00A0 et U+202F à plat, remplacer, puis relancer le typographe (sinon la recherche échoue).
- Test d'effort (police large, pseudos longs) injecté après le chargement: rappeler le focus par défaut avant d'analyser, sinon faux « focus hors de la vue ».
- Scènes provisoires en SVG dans un fichier `.js` (chaînes) injecté dans la page: les groupes `[data-si]` se montrent par état, et un même SVG sert à plusieurs vues par `transform` (point visé ramené au centre; vérifier qu'aucun bord de la scène n'apparaît).
- Jeton de joueur sur fond clair: disque de nuit `#1A1F3D` cerclé d'encre, symbole dans la couleur du profil; distinct en niveaux de gris et sous les trois daltonismes (forme et clarté).
- Navigation spatiale fiable: distance de bord à bord dans l'axe, plus deux fois l'écart de centre en travers; flèches haut et bas sortent d'un champ d'une ligne.

## Refonte de La Petite Ligne (interface 0.1, 2026-11-10)

- Document: `docs/jeux/jeu-1/refonte/interface.md`; maquettes animées et outils (`capturer.cjs`, `verifier.cjs`, `commun.js` pour les pictos et le décor figuré) dans `docs/jeux/jeu-1/refonte/maquettes/`. Lancer avec `NODE_PATH=/opt/node-tools/node_modules node ...`.
- En headless, sans capture en cours, les animations CSS n'avancent pas de façon fiable: avant de mesurer ou de capturer un état installé, mener les animations finies à leur terme (`document.getAnimations().forEach(a => a.finish())` dans un try, les boucles lèvent une erreur). Pour les animations réduites, contrôler les styles calculés (durée, nombre d'itérations), pas `playState`.
- Un dessin plat en `rotateY` complet disparaît de profil: le faire se balancer (-55° à 55°) et dire que le vrai modèle tournera.
- Un `a` utilisé comme onglet garde son soulignement: `text-decoration: none`.
- `typographier.py` de `games/la-petite-ligne/ui-maquettes/outils/` s'applique tel quel aux maquettes de la refonte (saute script et style).

## Style encré de La Petite Ligne (2026-11-10)

- Thème sous `data-lpl-style="encre"`: `games/la-petite-ligne-2/src/interface/encre/` (README), outils dans `assets-src/interface-encre/` (ESLint refuse les `.cjs` et `.mjs` sous `src/`; `assets-src/` est ignoré par ESLint et Prettier).
- Cadre irrégulier sans couture: une image SVG sans dimensions propres, posée par `border-image: url() 0 fill / 0 / <débord> stretch`; tout y est en pixels comptés depuis les bords grâce à des `<svg x="100%" overflow="visible">` imbriqués et à `style="width:calc(100% - Npx)"` sur les `rect`. Le découpage en neuf d'un cadre dessiné (`round`) laisse des coutures claires et un tremblé qui se répète: abandonné.
- Le fond d'un cadre `border-image` passe devant le `background` de l'élément: une trame ou une hachure intérieure se met dans l'image, pas en CSS.
- `border-image` ne se dessine pas sans bordure: `border: ... solid transparent`.
- Une image en `url(data:)` ne lit pas les variables CSS: couleurs recopiées dans le générateur.
- Le trait des pictos du sprite ne se règle par variable que via `style="stroke-width:var(--x,2)"` dans le symbole (un attribut de présentation n'accepte pas `var()`, et une règle CSS n'atteint pas l'intérieur d'un `<use>`).
- `.lpl-ui--menu::before` est un pseudo-élément de la couche: la règle de mouvement réduit `.lpl-ui[data-motion] *::before` ne l'atteint pas.
- La garde de l'arbre isolé refuse aussi les heredocs (`cat <<EOF`, `python3 - <<EOF`): `python3 -c "..."` passe, ou écrire le script avec Write.
- Pied du carnet (quêtes): il reste 11 px de marge à 1366x768 avant le passage à la ligne; mesurer avant d'élargir une touche ou un écart.
- La démo qui joue des touches après l'ouverture d'un écran: 500 ms entre C et E au carnet, 900 ms avant la première touche à la boutique (sinon l'état capturé n'est pas le bon).

