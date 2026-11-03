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
