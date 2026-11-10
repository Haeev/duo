# Tableau de bord: onglets « Carte » et « Modèles 3D »

Deux sections à verser dans `README.md` du tableau de bord (écrites à part parce que ce fichier n'existait pas dans cette branche de travail). Les deux onglets suivent le contrat des onglets de ce README: `window.TDB.registerTab`, `ctx.notes`, `ctx.ui`.

## Carte

Le plan d'un lieu vu du dessus, à annoter: épingle numérotée, trait à main levée, flèche, mesure en mètres, note globale. Zoom à la molette et au pincement, déplacement, échelle en mètres, choix de la vue, calques, nom et raison d'être des bâtiments au survol ou au clic.

| Fichier | Rôle |
|---|---|
| `carte.js` | l'onglet (script classique, aucun autre script) |
| `cartes/index.json` | liste des vues: `id`, `lieu`, `titre`, `fichier`, `largeur` et `hauteur` en mètres, `image` (pixels), `cadre` (rectangle du plan dans l'image, pixels), `vue` (fenêtre du plan, mètres), `calques` |
| `cartes/<lieu>/*.svg` | les images du level designer, copiées telles quelles (seule la police reçoit des polices de repli) |
| `cartes/<lieu>/lieu.json` | extrait de `plan.json`: lieux nommés avec leur raison d'être, tronçons de chemins, zones |
| `outils/publier-cartes.mjs`, `outils/cartes-sources.json` | régénère `cartes/` à partir des plans du dépôt |

Ce qui est stocké (`ctx.notes.add`), avec `cible: { type: 'carte', id: <lieu> }`: toutes les vues d'un même lieu partagent leurs remarques.

- Épingle: `{ sorte: 'point', x, y, metres: [x, y], vue, pres }`. `x` et `y` vont de 0 à 1 sur le plan ENTIER du lieu (384 x 208 m pour Aubrune), origine au coin nord-ouest, quelle que soit la vue affichée. `metres` est la même position en mètres dans le repère de `plan.json`; `vue` est l'identifiant de la vue où la remarque a été posée; `pres` le bâtiment ou le repère à moins de 15 m.
- Trait et flèche: `{ sorte: 'trait', points: [[x, y], …], metres: [[x, y], …], fleche: true | false, vue, pres }`. Une flèche a deux points, du départ vers la pointe.
- Note globale: `{ sorte: 'globale', vue }`.
- La mesure ne stocke rien, sauf si le client clique « En faire une remarque » (elle devient un trait dont le texte commence par la distance).

Clavier, plan focalisé: flèches pour déplacer, `+` et `-` pour zoomer, `0` pour tout voir, Entrée pour agir au centre (mire), Échap pour annuler. « Aller à… » mène à un bâtiment sans souris. Un tracé à main levée demande un pointeur: au clavier, la flèche le remplace.

Recette, ajouter une vue ou un lieu (le plan doit être au format `plan-de-lieu`, images SVG avec un `<svg viewBox>` emboîté en mètres, comme `docs/jeux/jeu-1/refonte/carte-aubrune/`):

1. Ouvrir `outils/cartes-sources.json`.
2. Pour une vue de plus: ajouter `{ "fichier": "x.svg", "titre": "…" }` dans `cartes` du lieu.
3. Pour un lieu de plus: copier le bloc d'Aubrune, changer `id`, `nom`, `dossier`, la liste des vues (la première sert de vue d'ensemble).
4. `node outils/tableau-de-bord/outils/publier-cartes.mjs` (réécrit tout `cartes/`).
5. `node outils/tableau-de-bord/outils/essai-inventaire.mjs` (cadres cohérents), puis publier `cartes/` avec la page.

Après une retouche du plan par le level designer: relancer le point 4 et republier. Les remarques restent justes tant que la taille du lieu ne change pas (elles sont en fraction du plan, et en mètres dans `metres`).

## Modèles 3D

Visionneuse des modèles du jeu: liste par famille avec recherche, vue 3D (tourner, zoomer, déplacer), grille métrique, silhouette de 1,70 m, rendu neutre ou « aplats et contour », clips d'animation, triangles et cotes mesurés sur le modèle affiché. Annotation: épingle 3D posée d'un clic sur le modèle, note globale, liste des remarques, recadrage sur une épingle.

| Fichier | Rôle |
|---|---|
| `modeles.js` | l'onglet. Charge Three.js r128, `GLTFLoader` et `OrbitControls` depuis cdnjs et jsDelivr à la première ouverture seulement |
| `modeles/index.json` | liste des modèles: `id`, `nom`, `famille`, `fichier`, `noeud`, `pieces`, `textures`, `poids`, `partage`, `triangles`, `clips`, `cotes` (mètres), `source` (chemin dans le dépôt); plus `familles`, `lots`, `ecartes` |
| `modeles/<lot>/*` | les GLB et atlas, copiés tels quels |
| `outils/inventaire-modeles.mjs`, `outils/modeles-sources.json`, `outils/noms-modeles.json` | régénère `modeles/` à partir des dossiers d'assets |
| `outils/essai-inventaire.mjs` | essai court des deux gabarits (un GLB factice apparaît dans l'index) |

Un fichier GLB du jeu regroupe plusieurs modèles: l'index a une entrée par modèle (`fichier` et `noeud`), pas par fichier. Trois modes d'inventaire, choisis par lot dans `modeles-sources.json`:

- `racines`: un modèle par noeud racine de chaque GLB du dossier (décors, objets);
- `pieces`: un modèle par maillage, montré sur le mannequin du lot (figurine du jeu: corps, têtes, coiffures, tenues);
- `essai-encre`: personnages assemblés (corps, coiffure sur l'os `Head`, col sur l'os `Spine`, atlas peint et atlas des traits du visage), lus dans `atlas/index.json` de l'essai de style.

Ce qui est stocké, avec `cible: { type: 'modele', id: <id du modèle> }`:

- Épingle: `{ sorte: 'point3d', position: [x, y, z], normale: [x, y, z] }`, en mètres, dans le repère du fichier glTF (Y vers le haut, soit Z vers le haut dans Blender: `(x, -z, y)`), le noeud du modèle ramené à l'origine. Les épingles se posent sur la pose de repos: l'animation s'arrête pendant le pointage.
- Note globale: `{ sorte: 'globale' }`.

Limites connues, voulues:

- « Aplats et contour » est une approximation (trois tons francs et coque d'encre retournée): il donne l'allure du style encré, pas le nuanceur du jeu (ni hachures, ni relief des atlas, ni liseré). Les arêtes vives peuvent laisser de petits jours dans le contour.
- Le visage des personnages d'essai montre l'expression neutre de l'atlas des traits.
- La figurine du jeu s'affiche avec ses couleurs de sommets, sans les teintes de peau et de tenue que le jeu applique.
- Les images des GLB sont décodées par la page elle-même (sans adresse `blob:`), pour ne pas dépendre de la politique de sécurité de la page publiée.
- La mémoire WebGL est rendue à chaque changement de modèle, et le contexte est fermé quand l'onglet est caché.

Recette, ajouter un modèle:

1. Déposer le GLB (ou le réexporter) dans un dossier déjà inventorié: `games/la-petite-ligne-2/assets/commun/decors/`, `objets/` ou `personnages/`.
2. Facultatif: son nom français dans `outils/noms-modeles.json` (sinon le nom de la fiche du jeu qui cite ce modèle, sinon l'identifiant mis en forme).
3. `node outils/tableau-de-bord/outils/inventaire-modeles.mjs` (réécrit tout `modeles/`, affiche le poids et les modèles écartés).
4. Publier `modeles/` avec la page.

Ajouter un dossier entier: un bloc de plus dans `lots` de `modeles-sources.json` (`id`, `titre`, `mode`, `famille`, `dossier`). Budget tenu par le script (`budget` du même fichier): 40 Mo au total, 4 Mo par fichier, 150 fichiers; ce qui dépasse est listé dans `ecartes` de l'index au lieu d'être publié.

## Essai local des deux onglets

- `essai/banc-onglets.html`: socle minimal conforme au contrat (remarques en mémoire, `?theme=clair`, `?graines=0` pour une base vide).
- `node outils/tableau-de-bord/essai/capturer-onglets.cjs <dossier de sortie> [dossier du paquet three@0.128.0]`: joue les deux onglets sous Chromium en 1366x768 et 400x800 (souris, clavier, doigt, pincement), charge tous les modèles de l'index, compare triangles et cotes mesurés à l'index, contrôle la mémoire WebGL, et échoue à la moindre erreur de console. Le second argument sert là où les CDN sont fermés: `npm pack three@0.128.0`, puis décompresser.

## À publier

`carte.js`, `modeles.js`, `cartes/` et `modeles/`. Le dossier `outils/`, le dossier `essai/` et ce fichier ne se publient pas.
