# Basse-cour (cahier 4.7, réponse 31, R20)

Autonome et sans punition. Une seule nourriture par espèce; la mangeoire nourrit toute seule pendant plusieurs jours; sans nourriture, les bêtes ne meurent pas et ne partent pas: elles donnent un jour sur deux pendant `hunger.fewer` jours, puis plus rien, et le disent (« ?? », médaillon de la carte).

- Données: espèces dans `donnees/commun/especes/` (`pnpm nouveau espece <id>`); un abri est un meuble à brique `shelter` (`pnpm nouveau abri <id>`): espèce, places (montent avec un fait, comme `field`), mangeoire en rations, pondoirs et plafond du nid, enclos du jour, bêtes de départ. Schémas: `src/donnees/schemas/elevage.ts`.
- `abri.ts`: brique `shelter` (la touche d'action ouvre l'écran: événement `shelter_opened`), gestes `fill` (sac puis coffres du lieu, autant que possible), `collect` (tout le nid; ce qui ne tient pas tombe aux pieds), `pet` (un par jour et par joueur), `buy`, `rename`, `adoptAnimal` (bête de plus, nom tiré), `adoptStoryAnimal` (effet `adopt_animal`: bête nommée offerte par l'histoire, abri de n'importe quel lieu ouvert, sans doublon de nom), lecture `shelterView` (mangeoire: rations, jours, niveau `full`, `low`, `empty`, part remplie; nid: nombre, œufs par pondoir, plein; bêtes: nom, robe, cœurs, humeur, onomatopée, « a pondu »).
- `journee.ts`: chaque matin, d'un coup; les jours passés ailleurs ou entre deux séances se rattrapent au retour (60 au plus), sans simulation continue.
- `promenade.ts`: `animalSpots(look, id, minutes?)`, positions pures du jour et de l'heure (enclos le jour, perchoir la nuit), identiques sur les deux machines sans rien transmettre.
- `index.ts`: le système (`step`: les matins; intentions `shelter_fill`, `shelter_collect`, `animal_pet`, `animal_buy`, `animal_rename`, refus en `refused`). `valider.ts`: contrôles croisés. `reglages.ts`: seuils communs.

Écran: `src/interface/basse-cour/` (démonstration `/src/interface/basse-cour/demo/index.html#normal`, `#vide`, `#plein`). Test: `tests/elevage.test.ts`.

## Une bête offerte par l'histoire (recette)

1. L'abri est un meuble de la carte du lieu (brique `shelter` de l'espèce), avec un identifiant unique dans le jeu.
2. Dans l'option de dialogue ou l'étape de quête qui la donne: `{ "type": "adopt_animal", "species": "poule", "name": "Pimprenelle", "shelter": "poulailler-jardin", "robe": "blanche" }` (`robe` facultative, sinon tirée).
3. Le validateur vérifie l'espèce, la robe et que l'abri loge cette espèce. Rien d'autre à écrire.
4. Abri plein: refus `shelter-full`, l'effet ne donne rien. Exemple: `lieux/aubrune/dialogues/odette-poules.json`; test: `tests/adoption.test.ts`.
