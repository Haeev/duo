# Garde-robe et boutique de vêtements (0.12.0)

Demande du client (2026-11-03): retirer les foulards des joueurs; des vêtements avec du volume; plusieurs types (pantalon, t-shirt, veste, pull, etc.) avec plusieurs variantes chacun; de meilleures coiffures; une boutique avec son habitant pour acheter des vêtements, avec à gauche du menu d'achat un aperçu de son personnage portant le vêtement avant de l'acheter. Esprit des jeux de vie paisible du genre, en version originale.

Ce document est le contrat commun entre l'artiste 3D, la simulation, le rendu et l'interface. Toute évolution passe par le manager.

## 1. Emplacements

| Emplacement | Clé | Obligatoire | Exemples de styles |
|---|---|---|---|
| Haut | `top` | oui | t-shirt, chemise, pull, débardeur, marinière, polo |
| Par-dessus | `outer` | non | veste de travail, gilet tricoté, ciré, veste en velours, cape de pluie |
| Bas | `bottom` | oui | pantalon de toile, short, salopette (couvre aussi le haut), jupe, pantacourt |
| Chaussures | `shoes` | oui | bottines, bottes de pluie, sabots, espadrilles, baskets de toile |
| Tête | `hat` | non | casquette, chapeau de paille, bonnet, béret |

Les foulards des joueurs sont retirés. La couleur et le symbole du profil Duo restent visibles autrement (petit badge brodé sur le haut, ou liseré), au choix de l'artiste, sans foulard.

## 2. Données: `donnees/vetements.json`

Chaque vêtement: `id` (`<style>_<variante>`, par exemple `pull_moutarde`), `slot`, `style`, `nom` (au féminin ou masculin correct, ex. « Pull moutarde »), `modele` (nom du nœud du maillage dans le GLB des personnages, partagé par toutes les variantes d'un style), `couleurs` (`{ principale, secondaire, motif? }`, en hexadécimal), `prix` (nombre, dans la nouvelle monnaie), `saison` (facultatif: en vente seulement cette saison), `couvre` (facultatif: emplacements masqués, par exemple la salopette couvre `top`).

Au moins 5 styles par emplacement obligatoire et 3 pour les facultatifs, chacun en 3 à 5 variantes: environ 70 vêtements.

## 3. État

- `Character.appearance.wear: { top: string; bottom: string; shoes: string; outer: string | null; hat: string | null }` (identifiants de `vetements.json`).
- `Character.wardrobe: string[]`: vêtements possédés (ceux de départ compris).
- L'ancien `appearance.outfit` (index de tenue) est migré vers une tenue de départ équivalente; le champ disparaît.
- Changer de tenue: à l'armoire ou au coffre de la maison, et dans la cabine de la boutique; intention `wear { slot, item | null }`.
- Acheter: intention `clothes_buy { item }`, refusée si la bourse ne suffit pas ou si le vêtement est déjà possédé. Pas d'accord à deux pour un vêtement (achat personnel).

## 4. Boutique

- Lieu: la mercerie de Solange devient aussi la boutique de vêtements (« Mercerie et confection »): une penderie et un portant dans le salon existant. Solange vend; ses horaires restent ceux du salon.
- Stock: une sélection renouvelée chaque lundi (8 à 12 pièces tirées par la graine, dont une ou deux de saison), plus le fonds permanent. Les deux joueurs voient le même stock.
- Menu d'achat: à gauche, l'aperçu en 3D de son propre personnage qui porte le vêtement survolé (tourner avec A et E ou à la souris); à droite, les rayons par emplacement, le prix, « Acheter », « Essayer » (l'aperçu seulement), « Déjà dans ta garde-robe ».

## 5. Rendu

- Les maillages de vêtements sont des nœuds du GLB des personnages, nommés `wear_<slot>_<style>`, avec des emplacements de couleur (`principale`, `secondaire`) teintés au rendu comme les tenues actuelles; mêmes os que le corps (skinning).
- Coiffures: les 15 coupes reprises (volume, mèches, bonne pose sur la tête et sous les chapeaux: variante aplatie quand un chapeau est porté).
- Aperçu 3D de la boutique: une petite scène séparée (fond uni, lumière douce, personnage seul) rendue dans le panneau, sans toucher au budget de la scène principale plus qu'un appel de dessin par pièce.

### 5.1 Précisions du rendu et de la simulation (dev gameplay 3D, 2026-11-03)

Couleurs des pièces (convention de l'artiste, `WEAR_SLOTS` de `assets-src/modeles/garde_robe.py`): les pièces `wear_<slot>_<style>` lisent la rangée 1 de `personnages.png`, que le rendu réécrit dans la copie de texture de chaque joueur: colonnes 0 à 2 haut (`principale`, `secondaire`, `motif`), 3 à 5 bas, 6 et 7 chaussures (sans motif), 8 à 10 par-dessus, 11 à 13 chapeau, 14 `wear_metal` (#C8A150) et 15 `wear_under` (#E4DCCB) fixes; un motif absent prend la secondaire. L'écusson du profil (`player_badge_<symbole>`, ou `player_badge_<symbole>_outer` quand un par-dessus est porté) garde les cases `scarf` et `scarf_mark` de la rangée 0, à la couleur du profil Duo. Tout est fusionné avec `player_base` (un matériau, un appel de dessin par joueur).

Coiffure sous un chapeau: le rendu prend le nœud `player_hair_<coupe>_hat` de l'artiste, sinon il aplatit la coupe sous le bas du chapeau. Couché, le chapeau est ôté.

Substituts quand un nœud manque (aucun avec le modèle actuel): si le haut, le bas ou les chaussures n'ont pas leur nœud, l'ancienne tenue d'un tenant (`player_outfit_work`, ou `player_outfit_overalls` pour un bas qui couvre le haut) teinte aux couleurs des vêtements portés; un chapeau manquant devient un chapeau rond, un par-dessus manquant un gilet sans manches tiré du torse de l'ancienne tenue.

État et intentions: `appearance.wear`, `wardrobe` (format de sauvegarde 11, après la pêche au 10), `wear { slot, item }` et `clothes_buy { item }`; menus `clothes_shop` (place du client devant le comptoir, point `salon_clothes`, aux heures du salon quand Solange est là) et `wardrobe` (au coffre de la maison). Se changer: au coffre (menu `wardrobe` ou à portée) ou dans la boutique (menu `clothes_shop`). Le stock du jour se lit par `clothesStock(content.clothes, content.settings, world.seed, world.clock.day)` (`src/etat/garde-robe.ts`), le même chez les deux sans rien dans l'état. Réglages `wardrobe` de `reglages.json` (facultatifs): `weeklyPieces`, `seasonalPieces`, `permanentPerSlot` (fonds permanent: les pièces hors saison les moins chères de chaque emplacement obligatoire) et `starters` (tenues de départ: couleurs visées, le vêtement le plus proche est pris, ce qui marche quels que soient les identifiants de `vetements.json`).

### 5.2 API de l'aperçu 3D (pour le panneau de la boutique)

Types dans `src/etat/vue.ts`; l'interface la reçoit par `InterfaceOptions.outfitPreview` (branchée par `main.ts` sur `Renderer.createOutfitPreview`).

```ts
const preview = options.outfitPreview?.({ width: 260, height: 360, background: '#f3ebd4' }) ?? null;
if (preview !== null) {
  panel.append(preview.canvas);
  preview.show({ character: me.id, appearance: { ...me.appearance, wear: { ...me.appearance.wear, top: 'pull_moutarde' } } });
  preview.rotate(-0.15);           // A et E, glisser de la souris (radians)
  preview.setAngle(0);             // de face
  preview.resize(300, 420);        // points CSS
  preview.dispose();               // à la fermeture du panneau
}
```

`null` sans rendu 3D (mode secours) ou avant le chargement: le panneau garde alors le portrait 2D. L'aperçu a son propre petit contexte WebGL et ne dessine qu'à la demande (nouvelle tenue, rotation, taille): rien ne coûte tant que rien ne bouge. Un seul aperçu à la fois.
