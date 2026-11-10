# Style « encré » (thème de l'interface)

Une couche de thème posée sur l'interface existante. Depuis le retour du client du 2026-11-10 (« plus sombre, moins encré »): panneaux presque noirs à liseré fin, texte clair et chaud, un accent bouton d'or, titres en Grandstander; le trait vivant reste aux vignettes, pictos et portraits (`assets-src/interface-encre/README.md`). Les noms des variables n'ont pas changé: `--paper*` sont les fonds sombres, `--ink` le texte clair, `--on-accent` le texte des fonds clairs. Règles et variables: `docs/jeux/jeu-1/refonte/interface.md`, section 15.

## Activer

Le thème ne s'applique que sous un élément marqué `data-lpl-style="encre"`: la racine donnée à `createInterface` (`root.dataset.lplStyle = 'encre'`) ou `<html>`. Sans la marque, l'interface garde son habillage d'avant. Les deux feuilles sont importées par `../index.ts`.

## Fichiers

- `encre.css`: variables (couleurs, durées, trait des pictos), puis l'habillage des composants du HUD, du dialogue, du carnet et de la boutique. Aucune structure ni position d'écran n'y est décidée.
- `cadres.css`: les cadres `--cadre-<taille>-<fond>[-ombre]` et leurs débords `--bi-<taille>[-ombre|-focus|-focus-ombre]`. Fichier généré, ne pas le retoucher.
- `demo/`: page de démonstration (`/src/interface/encre/demo/index.html?ecran=hud|dialogue|dialogue-choix|carnet|boutique|boutique-refus|planche&fond=exterieur-jour|exterieur-nuit|interieur-jour`, plus `style=ancien`, `mouvement=reduit`, `cible=x,y`). Le fond est la capture `docs/jeux/jeu-1/refonte/captures/encre-<fond>.png` si elle existe, sinon un fond provisoire (`demo/fond.ts`).
- Outils, dans `assets-src/interface-encre/`: `generer-cadres.mjs` (cadres), `capturer.cjs` (captures), `verifier.cjs` (contrastes, clavier, durées, débordements).

## Donner un cadre encré à un composant

1. Choisir la taille par l'épaisseur du trait: `petit` (vignettes, boutons, pastilles), `moyen` (bulles, cartouches), `grand` (panneaux).
2. Dans `encre.css`, ajouter son sélecteur à la famille voulue (papier, creux, tirets, accent, focus), ou écrire:
   `background: none; border-color: transparent; border-radius: 0; box-shadow: none; border-image: var(--cadre-petit-papier) var(--bi-petit);`
3. Le composant doit avoir une bordure (même transparente), sinon `border-image` ne se dessine pas.
4. Un fond qui manque (autre couleur, autre taille): une ligne dans `FRAMES` de `generer-cadres.mjs`, puis `node assets-src/interface-encre/generer-cadres.mjs` et `prettier --write src/interface/encre/cadres.css`.
5. Vérifier: `NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/verifier.cjs http://localhost:<port>` (Vite du jeu lancé), puis les captures.

## À savoir

- Le cadre déborde de la boîte (4 à 6 px, 9 à 15 px du côté de l'ombre) sans changer sa taille: prévoir la place autour, et ne pas compter sur `overflow: hidden` du parent.
- Le fond du cadre est dans l'image: ses couleurs sont recopiées dans `generer-cadres.mjs` (`FILLS`). Changer une couleur du papier se fait aux deux endroits.
- Les états de souris se forcent par les classes `survol` et `enfonce` (planche des composants).
