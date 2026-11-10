# Essai du rendu « bande dessinée encrée »

Tech-artist, 2026-11-10. Page d'essai: `games/la-petite-ligne-2/src/rendu/demo-encre/` (`pnpm dev`, puis `/src/rendu/demo-encre/index.html`; touches et paramètres en tête de `main.ts`). Captures: `captures/encre-*.png`, toutes sorties du vrai rendu Three.js à 1366 x 768, sans retouche. Outils: `captures/outils-encre/`. Rien n'est branché au jeu.

## Les trois règles du client, appliquées partout

1. **Éviter le plat absolu.** Aucune surface n'est un plan lisse avec un dessin dessus. Le relief vient de la géométrie d'abord, du nuanceur ensuite. Contrôle de chaque capture: « où est le plat absolu ? ».
2. **La lisibilité passe avant la quantité d'encre.** Le trait est hiérarchisé selon la taille à l'écran; les aplats de couleur font le travail de lecture, le noir cerne et pose l'ombre.
3. **Volume ou texture.** Tout ce qui borde, ponctue ou dépasse du sol est un vrai petit volume; la texture du sol ne garde que le dessin à plat.

## Ce que montre la scène

- Dehors: le coin de la halte d'Aubrune tiré du plan (origine au point 146; 94): voie, quai de 30 x 4 m dallé pierre à pierre, traversée de service en planches, barrière côté pré, maison de Firmin (7 x 6 m, étage, porte de 2,05 m), halte, pendule arrêtée sur 5 h 12, réverbère entre le banc et la caisse, chemin de terre bordé de pierres. Un joueur et trois habitants (assis, en train de parler, en marche).
- Dedans: la pièce de la même maison, murs effacés côté caméra (leur pied reste), plancher en lames posées une à une, lambris, pan de bois, poêle, buffet, lit, table, chaises, tapis, lampe, étagère, rideaux.
- Ambiances: dehors jour, jour « dense », crépuscule, nuit; dedans jour, jour « dense », nuit. Les variantes denses (même heure, valeurs plus basses, noirs pleins, vignette marquée) sont là pour que le client tranche sur image.
- Écarts au plan, voulus: la halte a une seconde porte à l'ouest, de plain-pied sur le quai; le banc du chef de halte est contre sa façade (le banc du quai reste à sa place, face à la voie).

## Choix faits, sur preuve

| Question | Retenu | Pourquoi (capture) |
|---|---|---|
| Contour | Post-traitement sur numéros d'objet et de morceau, normales et profondeur, hiérarchisé | `encre-contours-compares.png`: la coque inversée ne cerne que la silhouette, d'un trait maigre, sans arêtes ni joints, et s'ouvre sur les planches fines; le post-traitement donne silhouettes, arêtes et joints en une passe, et le trait peint des textures ajoute le détail de près |
| Trait irrégulier | Épaisseur de 55 à 145 % et tremblé d'un demi-trait, tirés d'un bruit ancré au monde | le trait ne grouille pas quand la caméra bouge; tremblé réduit sur les petits objets, où il doublait les lignes |
| Ombrage | 3 tons francs (clair, demi-teinte, ombre) multipliés à l'aplat; l'ombre est une couleur de l'ambiance | les trois faces d'un volume ont trois valeurs; prune le soir, bleu la nuit |
| Ombre portée | Aplat net teinté avec hachures lâches | `encre-ombres-comparees.png`: l'aplat seul est propre mais lisse; les hachures seules ne posent plus les objets au sol; les deux ensemble donnent l'ombre encrée des références |
| Sol | Carte des matières floue seuillée par un bruit, bord cerné, deux couches de touffes à deux échelles et deux angles, plages claires qui suivent le soleil | aucune grille ni répétition lisible à 32 m de large |
| Ambiance | Teinte, saturation, contraste et vignette dans la passe d'encrage; flaques de lampe à deux anneaux nets dans les nuanceurs | `encre-exterieur-jeu-nuit.png`, `encre-interieur-nuit.png` |
| Couleur | Tout en valeurs d'écran, sans éclairage physique | un ton du nuancier 0.2 ressort tel qu'écrit; la pièce porte le ton clair, la texture le ton de base, la lumière l'ombre |

Avis contraire à la bible 0.2 (section 4.1), à arbitrer: elle écarte le post-traitement pour son coût. Mesuré ici, il ajoute une passe plein écran de 22 lectures de texture par pixel et une seconde sortie de rendu (pas de second rendu de la scène), contre 30 % de triangles et 6 appels de plus pour la coque sur cette vue. Il est identique sur les deux machines (même Chromium, WebGL2). Seule une mesure sur l'UHD 620 tranchera; la version économe est prête (quatre directions au lieu de huit, ou coque pour les seuls personnages).

## Hiérarchie du trait (lisibilité)

- Chaque objet et chaque morceau reçoit, à la fabrication, une classe de taille mesurée sur sa boîte (2,5 m et plus, 1 m, 40 cm, moins): rien à déclarer.
- Cinq rangs de trait: silhouette d'objet (rang = classe de l'objet de devant), puis traits intérieurs (un rang sous le plus petit des deux morceaux). Un rang est tracé quand ce qu'il cerne dépasse 12 à 28 points à l'écran (`rankWeights`): à 32 m de large une fenêtre est un cadre et une couleur; au zoom de jeu on voit ses petits bois; de près, les veines.
- Seuls les deux premiers rangs sont épais. Le trait peint des textures d'objet s'efface sous 45 à 85 points par mètre. Hachures, noirs pleins et pied encré: sur les grands objets seulement, jamais sur un personnage.
- Personnages: un seul contour, aucun trait intérieur avant le plan rapproché, ombre relevée vers la demi-teinte, liseré clair côté soleil, tache de contact au sol.
- Contrôle `outils-encre/taux_noir.py` (part de pixels sous 0,22 de luminance par bloc de 64): façade en vue large 24 % avant, 20 % après; blocs au-dessus d'un tiers: 6 sur 252 en vue large de jour, 14 au zoom de jeu (voie et ombres des arbres). Limite: la mesure confond l'encre et les aplats sombres (traverses, vitres); au zoom de jeu elle ne bouge pas (23 %) alors que l'image est nettement plus lisible (`encre-lisibilite-avant-apres.png`).

## Nuanceurs et ombres

Trois nuanceurs maison (`matiere.ts`, `contours.ts`), aucun matériau standard, plus une passe de profondeur pour l'ombre.

- **Volumes** (`OBJECT_*`): aplat de la pièce, second ton et trait lus dans la couche de texture, relief (la pente lue en B et A penche la normale avant le choix du ton: un joint tombe dans l'ombre, une arête prend le clair), lumière encrée, lueur des vitres et des flammes. Variante `ATLAS` pour les personnages (couleur lue dans leur atlas), variante `HULL` pour la coque comparée, instanciation pour le semis.
- **Sol** (`GROUND_*`): matières par carte seuillée, bord cerné, touffes, cailloux et ballast en relief, même lumière.
- **Ombre de contact** (`CONTACT_*`): taches anguleuses multipliées au ton d'ombre de l'ambiance, sous les pieds et les meubles.
- **Lumière encrée** (`LIGHTING`): ombre du soleil lue en 5 points filtrés puis seuillée (bord net, sans escalier ni acné sur les captures; il ondule parce que le point lu se décale de 5 à 7 cm selon un bruit), flaques de lampe, hachures à 45 degrés projetées sur le monde (elles ne nagent pas), serrées quand la face se détourne, noirs pleins par plaques, pied des murs noirci et hachuré.
- **Encrage** (`contours.ts`): trait hiérarchisé, teinte, saturation, contraste, vignette.

Réglages par lieu et par ambiance, en données (`ambiances.ts`, type `Ambiance`): direction du soleil, trois tons, encre, hachures (propre, portée), noirs pleins, relief, pied encré, lampes, lueur des vitres, vignette, teinte, saturation, contraste, tons du sol, relevé et liseré des personnages. Réglages du trait: `SETTINGS` (`main.ts`) et `rankWeights`.

Ce qu'un nouvel objet doit fournir pour en profiter sans code: sa géométrie avec normales à plat, une couleur par morceau (ton clair du nuancier), une couche de trait par morceau (bois, planche seule, pierre seule, enduit, tuile, feuillage, écorce, uni) avec des UV en mètres (4 m par carreau), et son pied à y = 0. Numéros, classes de taille, contour, ombre, hachures et relief en découlent.

Non fait: l'ombre portée par les lampes (les flaques éclairent sans découper l'ombre des objets), version économe à étudier: une seule carte d'ombre de 512 pour la lampe la plus proche du joueur.

## Volume ou texture, et gabarit de dispersion

- Volume: pierres de bordure, cailloux, touffes hautes, fleurs, racines, dalles, lames, tuiles, moellons du soubassement, chaînes d'angle, linteaux, chevrons, faîtières, gouttière. Texture: touffes rases, veines, fissures, éclats, taches du second ton.
- `semis.ts`: un petit décor = une forme dans `SHAPES` et une ligne dans `RULES` (forme, nature de sol parmi herbe, terre, bord, ballast, densité par mètre carré, échelle, plaques). Semis déterministe, hors des emprises données par la scène; un appel de dessin instancié par forme. Sur cette vue: 7 formes, 12 appels (7 à l'image, 5 à l'ombre: les cailloux n'en projettent pas), triangles compris dans le total des mesures.
- Preuve en lumière rasante: `encre-chemin-rasant.png`, `encre-relief-mur.png`.

## Mesures

| Vue | Appels | Triangles (toutes passes) | Programmes |
|---|---|---|---|
| Dehors, post-traitement (retenu) | 27 | 140 360 | 8 |
| Dehors, coque inversée | 33 | 182 916 | 10 |
| Dedans | 21 | 22 966 | 8 |

- Budget de la bible: 350 000 triangles, 200 appels, 4 programmes. Triangles et appels tenus; programmes dépassés (8: volumes, sol, contact, encrage, profondeur, leurs variantes instanciées et un par personnage, à ramener à un seul par un tableau d'atlas).
- Textures: 13 couches de 512 en RGBA (18 Mo avec mipmaps; 9 Mo en deux textures R et RG), carte d'ombre de 2 048 (16 Mo), cibles de rendu 12 Mo.
- Temps par image sous Chromium logiciel, machine chargée (charge 10 à 17): 0,45 à 3 s, trop bruité pour classer les réglages; dans une même série, sans contour 0,45 s, coque 0,7 s, post-traitement 1,1 à 1,3 s. Ces chiffres ne disent rien du GPU.
- Estimation UHD 620 (non mesurée): 1,05 million de pixels, passe principale à 9 lectures de texture, encrage à 22, ombre en profondeur seule; ordre de grandeur attendu 8 à 14 ms, donc au-dessus de 30 images par seconde. À mesurer sur le PC.

## Ce qui reste loin des références

1. Les personnages viennent de l'essai 3 (corps riggés, figés dans une pose pour cette page): mains du costaud énormes, visages trop petits pour être lus au zoom de jeu, pas de skinning dans le nuanceur. Les personnages sculptés (`personnages=sculptes`) sont pires: cubiques.
2. Les arbres restent des polyèdres: il leur faut des masses de feuillage modelées à la main (Blender) avec un contour découpé.
3. Les références sont peintes: dégradés de lumière, brume, particules, flaques qui découpent les ombres. Ici la lumière est franche partout; il manque l'ombre des lampes, une brume légère et les effets.
4. Le sol reste un plan: son modelé n'est que dans les tons. Un vrai relief demande le terrain du jeu.
5. Le trait reste un trait de machine: épaisseur variable mais pas de pleins et déliés selon la courbure, pas d'accroche aux angles.
6. De jour clair, l'image est propre mais plus sage que les références; les variantes denses, le crépuscule et la nuit s'en approchent davantage.

## Ce que le style impose aux gabarits

- **Objet**: morceaux séparés et épais (chants, pieds, ferrures en volume), un ton clair par morceau, une couche de trait, pas de texture de couleur; de guingois de 1 à 3 degrés; pas de détail de moins de 5 cm en volume.
- **Sol**: une carte des matières à 8 points par mètre tirée du plan, des tons par ambiance, une ligne de semis par petit décor.
- **Bâtiment**: une fiche (`BuildingSpec`: emprise, hauteurs, couleurs, ouvertures); le relief (soubassement, chaînes, encadrements, toit en rangs) est fabriqué par le gabarit.
- **Personnage**: un atlas de couleur en aplats clairs (l'ombre vient de la lumière, pas de la peinture), peu de trait intérieur (il ne se voit que de près), valeurs séparées entre tête, haut et bas, une silhouette lisible à 60 points.
- **Ambiance**: une fiche `Ambiance` par lieu et par heure.
