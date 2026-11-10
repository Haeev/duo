# Carnet du technical artist

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Three.js 0.187 (vérifié le 2026-10-31)

- `Material.clone()` ne copie pas `onBeforeCompile` mais copie `userData`: marquer un matériau déjà patché dans un `WeakSet`, jamais dans `userData` (la copie hériterait du drapeau sans le patron).
- Enchaîner un `onBeforeCompile` existant: garder `previous = material.onBeforeCompile.bind(material)` et `previousKey = material.customProgramCacheKey.bind(material)`, appeler `previous(shader, renderer)` puis injecter, clé `${previousKey()}|...`. Injecter *après* un `#include` (on garde l'include): plusieurs patrons peuvent viser le même repère.
- Repères utiles du shader standard: `#include <normal_fragment_maps>` (normale prête, couleur et `roughnessFactor` encore modifiables avant l'éclairage), `#include <lights_fragment_end>` (`reflectedLight.directDiffuse`, `material.diffuseContribution`), `transformNormalByInverseViewMatrix(normal, viewMatrix)` pour la normale dans le monde.
- Lumières physiques: radiance diffuse = albédo x couleur x intensité / pi. Pour éclairer un sprite comme le décor: `sun.color * sun.intensity / PI` et `hemi.color * hemi.intensity / PI`.
- `ShaderMaterial` en GLSL 3: `flat varying int` accepté; `flat` est un mot réservé (ne pas nommer une variable `flat`). Comparer un `varying float` interpolé à `== 3.0` est fragile: passer un entier `flat`.
- Carrés de particules posés au sol (`(x, 0, y)`) ou étirés le long d'une vitesse qui remonte: ils montrent leur dos à la caméra et disparaissent. `side: DoubleSide` sur le matériau des particules.
- Particules par `InstancedBufferGeometry` + `Mesh` + `ShaderMaterial`: plusieurs matériaux au même source partagent un programme (un seul compté par `renderer.info.programs`); `frustumCulled = false`; cacher une instance en sortant `gl_Position` du volume (`vec4(0, 0, 2, 1)`).
- Lumière directionnelle: sa caméra d'ombre regarde la cible avec `up = (0, 1, 0)`; ses axes sont `right = normalize(cross(up, dir))` et `up' = cross(dir, right)`. Caler le centre du cadre sur des multiples du texel dans ce repère évite le scintillement.

- Rendu direct dans le canevas (pas de cible intermédiaire): le mélange alpha se fait en sRGB, après tone mapping. Une brume d'opacité a sur une eau de L* 26 plafonne vers L* 66 à a = 0,55 même blanche: viser la clarté d'un voile oblige à monter l'opacité (0,65 à 0,7 effectifs pour L* 70).
- Programme des particules (`particules.ts`, mode sprites): `aAccel.x` = carré couché à plat, `aAccel.y` = fondu du bas selon la hauteur au-dessus du sol lue dans `uField` (il faut le vrai champ du terrain, pas le champ factice 1 x 1 de `brume.ts`), `aSize.y` = second demi-axe. `uSelfLight` (couleur, part) donne une lumière propre aux bouffées. Tout cela sans programme de plus.
- Bouffées en grand nombre: une grille tremblée (tremblement 0,5 maille) donne un banc continu; un tirage au hasard laisse des trous et des amas. Moins de bouffées (mode léger): les agrandir, sinon la grille se voit en taches régulières.
- Forme `star` du programme des particules: scintillement `sin(vAge * 40)` sur la vie normalisée; sur une vie courte (0,3 s) elle clignote et peut tomber à 0,3 d'opacité à l'image près. Deux étoiles décalées de `PI / 40` de la vie s'ajoutent en un éclat stable.
- Traînée par particules: émettre au pas de distance (pas à l'image), naissance interpolée entre les deux positions; la forme `droplet` s'oriente le long d'une petite vitesse fortement freinée.

## Environnement cloud et captures

- Page de démonstration: `joue=1` fait avancer la chorégraphie d'un moment avec `advance(dt)` (sinon `t` reste figé et les effets déclenchés par un passage, gerbe, éclat, traînée, n'apparaissent jamais sur une capture). `phase=apres&t=60` donne le même cadre sans l'effet (référence des mesures).
- Agent isolé dans une copie: les commandes composées qui écrivent hors de la copie (`/tmp`) sont refusées; écrire les scripts avec l'outil d'écriture puis les lancer par une commande simple. Pour des captures « avant », `git diff > patch`, `git apply -R patch`, capturer, `git apply patch` (avec une copie des fichiers de côté).

- Serveur Vite de travail hors de l'arbre: config dans le dossier de travail, `root` vers le jeu, `server.hmr: false` (les autres membres écrivent: sinon rechargements en pleine capture). Ne pas mettre `watch: null`: Vite servirait alors des modules périmés.
- Une config Vite hors du dépôt ne trouve pas `vite`: exporter un objet simple au lieu de `defineConfig`.
- Un plugin Vite qui modifie un `.ts` source doit être `enforce: 'pre'` (sinon il reçoit le JavaScript déjà transformé, guillemets doubles).
- SwiftShader sous charge: une image peut prendre plusieurs secondes. Après une touche, attendre que `window.lplRendu.frames` ait avancé de 2 avant la capture, sinon la capture montre l'image d'avant. `page.screenshot` veut un `timeout` long (120 s).
- `pkill -f motif` ou `kill $(ps aux | grep motif)` tue aussi le shell qui porte ce motif dans sa ligne de commande: retrouver le PID par le port (`ss -ltnp | grep :5207`).
- Vitest sur un fichier de diagnostic hors du dépôt: config à part avec `root` vers le jeu et `test.include` en chemin absolu; imports en chemins absolus.

## La Petite Ligne

- Caméra isométrique orthographique à 35,26 degrés: le ciel n'est jamais visible, le fond non plus. La brume ne se voit qu'en haut de l'écran si elle commence tout près de la distance de la caméra (80 m + 4 m).
- Énigme de la cloche: la cloche pend au bout du bras, à l'est du poteau (x local 0,35 à 0,9; hauteur 1,9 à 2,3 m). Le test doit viser l'assise et le dossier du banc, pas sa boîte entière (l'ombre qui passe entre les pieds compterait).
- Le gué de la carte est du gravier (`g`), pas de l'eau: le reconnaître par l'eau à l'est et à l'ouest sur la rangée et pas d'eau dans la colonne.
- Les lueurs de nuit se trouvent dans les modèles: faces dont l'UV pointe une case lumineuse de la palette (`glass`, `glass_lamp`, `flame`, `ember`, `lamp_shade`, `radio_dial`).

## Passe « maquette » (tour 8, vérifié le 2026-11-01)

- Ombres teintées sans programme de plus: après `lights_fragment_end`, comparer `reflectedLight.directDiffuse` au soleil attendu `uSunRadiance * diffuseContribution / PI * max(dot(N, L), 0)`. Sans le facteur `dot(N, L)`, un sol éclairé par un soleil rasant passe pour « à l'ombre » et toute la scène bleuit.
- Étalonnage et vignettage injectés après `#include <tonemapping_fragment>` (sur `gl_FragColor`) dans les programmes existants: aucune cible intermédiaire ni passe plein écran. Saturation en « vibrance » (`mix(sat, 1, saturation actuelle)`): une saturation simple brûle les chemins orangés du soir.
- Teinte appliquée à une lumière: la ramener à une luminance de 1 (`unitLuminance` de `surfaces.ts`) pour changer la couleur sans changer la clarté.
- L'occlusion cuite (`occlusion.ts`) sert aussi en mode léger: sans ombres portées, elle seule pose encore les objets au sol.
- Port 5281 pris par une autre session: vérifier `ss -ltn` avant de lancer son serveur Vite.

## Sol, berges et gué (tour 8, vérifié le 2026-11-01)

- Rive courbe sans toucher à la grille: une surface d'eau plate et un lit en hauteur continue (`riviere.ts`); la ligne d'eau est là où le lit passe sous la surface. Distance signée floutée: une droite reste en place sous le flou, seuls les angles s'arrondissent. Un nœud qui touche une case sèche compte sec: la ligne d'eau reste dans les cases d'eau (berges marchables au sec).
- Profil de berge C1: `top + (level - top) u²` jusqu'à la ligne d'eau, puis `level + (deep - level)(1 - (1 - v)²)` avec `run = shore (deep - level) / (level - top)`: pas de replat au ras de l'eau (un replat fait une écume large et floue).
- Écume selon la vraie profondeur: quelques vaguelettes seulement sur une bande de 4 à 6 cm de profondeur; avec 9 bandes, on dessine des courbes de niveau. Un bruit de quelques centimètres sur un haut-fond proche du seuil trace des lignes fines: garder le fond hors de la bande d'écume.
- Courant à vitesse variable par pixel: jamais `uv - flow * t * vitesse(x)` (le motif se cisaille avec le temps); une couche à vitesse constante, mêlée par un masque.
- Motifs procéduraux au sol (pavés, galets): un seul tirage par maille (le motif reste dans sa maille, pas de voisins à lire); `fwidth` calculé hors des branches; fondu vers la teinte moyenne quand un pixel dépasse 5 à 10 cm.
- Pavés posés entiers: lire le masque au milieu du pavé (centre recalculé dans le shader), le bord de la zone suit les joints. Effet de bord: contour en marches et pavés isolés (revue du tour 8); voir plus bas le bord analytique.
- Un lit de rivière en un seul maillage coûte tout son quadrillage à chaque image: le couper en tronçons de 12 m (élimination hors du cadre) a ramené le surcoût de 18 000 à 5 000 triangles pour deux ou trois appels de plus.
- Machine chargée (charge 18): un lot de dix captures prend plus de 10 min; lancer en arrière-plan.

## Correctifs du tour 8 (vérifié le 2026-11-01)

- Une case froide (lauze) à l'ombre le soir reste bleue même sans `shadeTint`: c'est la lumière du ciel elle-même (19 h, bleu-violet) qui bleuit. Retirer la teinte seule: b* de -21 à -16. Il faut aussi neutraliser en partie la lumière du ciel reçue (vers sa luminance) et garder la clarté qu'aurait donnée la teinte entière (bleu sur bleu réfléchit plus: sans compensation, L* perd 1 à 2 points).
- `half` est un mot réservé en GLSL ES 3.0 (comme `flat`): ne pas nommer une variable ainsi.
- `hash2(i, g, graineA)` et `hash2(i, g, graineB)` au même `i` entier se suivent: un tirage filtré par l'un biaise l'autre (72 % de pierres « à fleur d'eau » au lieu de 35 %). Tirer le second sur la position (`hash2(x * 17.3, y * 11.1, graine)`).
- Bord de pavage propre: distance signée analytique dans le shader (anneau, bandes en gélules, demi-plan de la rue), union lisse `max + h² / 4k` pour des raccords arrondis, et une coordonnée le long du bord propre à la forme qui domine (angle pour l'anneau; `t`, puis `t ± demi-largeur x atan` autour des bouts d'une gélule: continu jusqu'à la pointe). Un masque binaire de 4 texels par mètre donne toujours des marches.
- Bruit `uAmbNoise` (128 px, octaves 8, 16, 32): sur une ligne, valeurs de 0,30 à 0,76, écart type 0,11. Pour une ondulation de ± A: `tanh((n - 0,5) x 7) x A`.
- Copie isolée: une commande qui contient le mot `git` sous une forme non vérifiable (`--exclude-dir=.git`, variable de boucle passée à `convert`), un préfixe `NODE_PATH=` ou un heredoc vers un fichier est refusée. Contrôle des tirets: `--exclude-dir=.g?t`; planches de captures par un petit script Pillow plutôt qu'une boucle shell; carnet modifié avec l'outil d'édition.
## Style lisse des personnages (étape A, vérifié le 2026-11-03)

- `personnages.glb`: sommets séparés par face (player_base: 2 338 sommets pour 663 points). Angles entre faces voisines: membres à 6 pans 60 degrés, têtes et torses 30 à 45, vraies arêtes 80 à 100: lissage à 65 degrés. Analyse rapide sans la scène: page `/package.json` du serveur Vite, puis `import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')` dans `page.evaluate` (2 s au lieu de minutes).
- Lisser par l'angle des coins, pas par la surface des triangles: un quadrilatère coupé en deux compte double au bout de sa diagonale et tord la normale (le test du prisme le montre).
- Rampe dans la lumière directe: déplier `ShaderChunk.lights_physical_pars_fragment` à la place de son `#include` et remplacer `vec3 irradiance = dotNL * directLight.color;` (une seule occurrence en 0.187). Le contrôle des ombres teintées (`lookSunWanted`) doit suivre la même rampe, sinon la demi-teinte passe pour une ombre portée.
- Coque de contour en `SkinnedMesh` enfant du corps: `bind(body.skeleton, body.bindMatrix)`, même `boundingSphere`, géométrie qui partage les attributs du corps (positions, UV, poids) plus `outlineNormal`: aucun tampon copié. Avec `side: BackSide`, `transformedNormal` est inversée (`FLIP_SIDED`): recalculer `normalMatrix * objectNormal`. Sans cibles de morphose sur la coque: un seul programme pour toutes.
- Liseré du style lisse: côté soleil seulement; un bord clair à l'ombre fait un halo blanc autour des mains.
- Page de rendu, captures en mode `manuel=1`: `page.screenshot` peut ne jamais rendre (5 min dépassées); lire le canevas par `toDataURL` dans le même `evaluate` que `advance`. `lplRendu.view(point, zoom)` et `lplRendu.inspect(largeur)` changent la vue sans recharger.
- Vue de la messe (zoom 2, 11 h): 319 000 triangles et 174 appels avant contour, dont 60 000 pour les personnages et autant dans l'ombre: le contour de tout le monde (+60 000) dépasserait 350 000, d'où le plafond en triangles de coque.

- `simplifyPath` (simulation) rend des points de passage espacés: pour vérifier qu'un trajet suit une ligne, l'échantillonner tous les 10 cm le long des segments.

## Meshy (vérifié le 2026-11-07, fiche `docs/production/meshy.md`)

- Les membres n'ont pas les outils `mcp__meshy__*` (fiche: `disallowedTools: mcp__*`): passer par `docs/production/essais-meshy/scripts/meshy-mcp.mjs` (serveur 0.6.9 par stdio, `MESHY_API_KEY=proxy-injected`, journal JSONL des appels). Dossier de travail hors du dépôt: le serveur y écrit `meshy_output/` et y charge un `.env` s'il en trouve un.
- Réseau: `api.meshy.ai` ouvert, clé injectée par le proxy; `assets.meshy.ai` (tous les fichiers produits), `cdn.meshy.ai`, `docs.meshy.ai`, `help.meshy.ai` refusés (403 au CONNECT). Vérifier l'hôte des fichiers sur une tâche existante (lecture gratuite) avant de dépenser des crédits.
- Fichiers effacés 72 h après la fin d'une tâche (`expires_at`). L'état d'une tâche en topologie intelligente ne donne ni faces ni dimensions: mesurer sur le fichier. Aperçu de texte vers 3D: jamais de texture. Image vers 3D avec `meshy-n1`: `texture_0.png`, couleur de base seule.
- Le rig accepte un aperçu sans texture (6,5 s, 5 crédits) et rend marche et course en GLB, FBX et squelette seul (`_armature.glb`). `meshy_list_usage` refusé (offre ni Studio ni Enterprise): suivre les crédits par le solde et `consumed_credits`.
- Couleur de palette tirée d'une texture générée: choisir face par face suit l'éclairage peint (groupes zébrés, 14,5 % de la surface de la doublure); vote à l'aire par pièce, CIEDE2000 avec `kL` = 2 (`meshy_commun.py`, vérifié sur six paires de Sharma 2005).
- Sorties réelles (vérifié le 2026-11-07 au soir): un nœud `geometry_0`, maillage ouvert (29 à 317 arêtes de bord: boucher les petits trous), `auto_size` faux (x 0,3 à x 1,5), faces à 2 % de la demande sauf référence simple (60 %). `meshy-n1` ne peint que la face vue (dos gris). Rigs: 24 os sans doigts (`Hips`, `Spine02`... `RightToeBase`), nœud `Armature` à l'échelle 0,01, mêmes noms et hiérarchie d'un personnage à l'autre, longueurs différentes: ne rejouer dans Three.js que la translation des hanches. Clips à 30 i/s, nommés comme la bibliothèque (`Idle`, `Chair_Sit_Idle_M`...), marche déjà sur place.
- `docs.meshy.ai` se lit par `curl` (WebFetch ne passe pas par le proxy); ajouter `.md` à l'adresse d'une page. Le solde est commun au studio: compter ses tâches, pas l'écart du solde.
- Palette à cases: la bible insère des couleurs au milieu de ses listes; garder les cases fixes (`exporter-palette.mjs`: ajout en fin, couleur retirée marquée), sinon tous les UV pointent la mauvaise case.

## Blender 5.2 et glTF (vérifié le 2026-11-07)

- bmesh: après `delete` ou `triangulate`, les `f.index` sont faux tant qu'on n'appelle pas `bm.faces.index_update()` (`ensure_lookup_table` ne suffit pas). Un dictionnaire indexé par `f.index` se corrompt sans bruit.
- `Image.pixels` d'une image 8 bits: valeurs telles qu'enregistrées (sRGB, de 0 à 1), rangées de bas en haut, cohérentes avec les UV de Blender (`data[int(v*h), int(u*w)]`).
- L'import glTF d'un personnage ajoute un objet `Icosphere` (forme des os) dans la scène: filtrer les maillages qui ont un modificateur Armature.
- Export glTF: `export_all_vertex_colors` vaut vrai par défaut et sort chaque attribut de couleur (COLOR_0, COLOR_1...): le mettre à faux et retirer les anciens attributs avant d'en cuire un.
- Faces retournées d'une sortie générée: `bmesh.ops.recalc_face_normals`, et compter les retournées par le signe du produit scalaire avant et après.
- Pièces qui flottent: `BVHTree.overlap` entre pièces (une pièce enfoncée dans une autre ne flotte pas), puis distance au plus proche; seuil de 2 mm.
- Capture Three.js d'un personnage: `renderer.info.memory.textures` compte aussi la texture des os et celle des cibles de morphose.

## Rendu encré (essai du 2026-11-10, `games/la-petite-ligne-2/src/rendu/demo-encre/`, note `docs/jeux/jeu-1/refonte/essai-encre.md`)

- `ShaderMaterial` avec `glslVersion: GLSL3`: Three.js ne déclare plus `gl_FragColor`; déclarer `layout(location = 0) out highp vec4` soi-même, et `location = 1` pour une cible à deux sorties (`WebGLRenderTarget` avec `count: 2`). `cast` est un mot réservé en GLSL ES 3.0 (comme `flat` et `half`).
- Mélange par multiplication dans une cible à deux sorties: écrire `vec4(1.0)` dans la seconde sortie la laisse intacte (ombres de contact sans trait de contour autour).
- Carte d'ombre maison: `DepthTexture` avec `compareFunction = LessEqualCompare` et filtre linéaire, lue en `sampler2DShadow`; seuiller la valeur filtrée donne un bord net sans escalier. Pour un bord tremblé, décaler le point lu de quelques centimètres selon un bruit, pas le seuil (le seuil ne bouge le bord que d'un texel et fait du grain).
- Contour par post-traitement: numéro d'objet et numéro de morceau sur un octet chacun (6 bits de numéro, 2 bits de classe de taille mesurée sur la boîte à la fabrication), normale en octaèdre sur deux canaux. Le trait appartient à l'objet de devant (comparer les profondeurs) et prend son rang; un rang n'est tracé qu'au-dessus de 12 à 28 points à l'écran. Sans cette hiérarchie, une façade devient un amas de traits à la vue large (retour du client).
- Bruits du trait et des hachures en coordonnées du monde (caméra orthographique: position = origine + droite x u + haut x v + avant x profondeur): rien ne nage quand la caméra bouge.
- Relief sans carte de normales à part: pente de la carte de hauteur dans les canaux B et A de la texture de trait, repère de la face tiré de `dFdx` et `dFdy` de la position et des UV; la normale penchée alimente la rampe à tons francs.
- Les objets fins (brins d'herbe, tiges) sont mangés par un contour de silhouette: leur donner une petite classe de taille, ou les élargir.
- Page de démonstration qui ne redessine qu'au changement: compter les images restantes (2 par changement), sinon une capture qui attend « deux images de plus » n'arrive jamais. Lire le canevas par `toDataURL` demande `preserveDrawingBuffer: true`.
- Temps par image sous SwiftShader: `gl.finish()` ne suffit pas, lire un pixel (`readPixels`) pour forcer la fin; machine chargée (charge 10 à 17), 0,5 à 3 s par image, inutilisable pour comparer deux réglages.
- Squelette dans un `ShaderMaterial` maison: inclure `skinning_pars_vertex`, `skinbase_vertex`, `skinnormal_vertex`, `skinning_vertex` avec des variables `transformed` et `objectNormal`; Three.js définit `USE_SKINNING` et lie la texture d'os tout seul. Le même matériau sert de `scene.overrideMaterial` pour la passe d'ombre (une variante de programme par nature d'objet: simple, instancié, à squelette).
- Fondre coiffure et accessoires dans le maillage à squelette (un appel par personnage): les ramener par l'inverse de (os au repos x inverse de liaison x `bindMatrix`), poids 1 sur cet os, puis `mesh.bind(skeleton, bindMatrix d'origine)` avec le même parent et la même pose que le maillage d'origine.
- `AnimationMixer` ne réécrit pas un os dont la valeur n'a pas changé (clip d'une seule pose): un geste posé à la main chaque image s'ajoute à lui-même et le personnage se tord. Garder la pose du clip avant de tourner l'os et la remettre au début de l'image suivante.
- Un `sampler2DShadow` déclaré mais dont la cible n'a jamais été rendue: « Mismatch between texture format and sampler type » à chaque appel. Vider la cible une fois à l'ouverture.
- Traits fins d'un atlas (visage) réduits quatre fois à l'écran: ils se diluent. Lire avec un biais de -1,5 et prendre le plus fort de 5 points voisins (un demi-point d'écran), sur le seul masque du visage.
- Vue de 50 degrés: les visages sont des dessus de tête; abaisser la plongée en zoomant (35 degrés au plus près) change tout. Un zoom serré avec plongée basse fait entrer dans le cadre les toits situés entre la caméra et le sujet: choisir le lacet de la vue proche en conséquence.
- Feuillage sans carte découpée: calotte dont le bord est une jupe de dents, normales qui rayonnent du coeur de la touffe (option `round` de `Sculpt`), grande touffe sourde plus petites touffes claires posées dessus, chacune son numéro de morceau: l'ombre et le trait dessinent des festons. Les triangles doivent être orientés un par un vers le dehors.
- Ombre de lampe: caméra en perspective qui regarde vers le bas (`up = (0, 0, -1)`), 120 à 150 degrés, plan proche sous la cage de la lampe; un calque à part pour ses seuls projeteurs (bâti, personnages).
- Recensement des triangles par maillage (`window.encre.census()`) avant d'ajouter du semis: une marguerite en boîtes coûtait 232 triangles, les gravillons 35 000 à eux seuls.
- Fichiers d'un autre membre nécessaires à une page: les reprendre de sa branche sans les indexer; `import.meta.glob` avec un chemin relatif hors du paquet marche en développement et rend un objet vide si le dossier manque (prévoir le repli).

## Personnage modulaire avec Meshy (essai du 2026-11-10, `docs/production/essais-meshy/personnage-modulaire/`)

- Texte seul: Meshy ignore « seul », « sans tête », « cinq têtes de haut » environ une fois sur deux (veste sur buste, jupe en robe sur mannequin, perruque livrée avec tête et socle, corps réaliste de 7,5 têtes). `pose_mode` ne vaut que pour un personnage: un vêtement seul sort manches à 45 ou 75 degrés.
- Imposer des proportions à un rig de Meshy: `inherit_scale = "NONE"` sur tous les os, échelle par os en pose, appliquer le modificateur Armature au maillage, `pose.armature_apply`, remettre `FULL` et le modificateur. Mettre à l'échelle les clés de translation des hanches selon la nouvelle hauteur du bassin.
- Ramener un personnage riggé par Meshy sur un autre squelette de Meshy: `pose_bone.matrix = repos_cible @ Diagonal(largeur, longueur_cible / longueur, largeur)` os par os, parents d'abord, `view_layer.update()` entre chaque; tête et bouts de tête en échelle uniforme (os très courts: rapport aberrant, tête aplatie en disque).
- Vêtement conformé dans une autre pose que le repos: poser le corps, transférer les poids, puis ramener chaque sommet par l'inverse de la somme pondérée des matrices de peau.
- Transfert de poids par face la plus proche: exclure les os du côté opposé, sinon une toile se tend entre les jambes du pantalon en marche. Recentrer d'abord chaque jambe sur l'axe des os.
- `import bmesh` avant `import bpy` échoue sous duo-python (module introuvable). Le rig de Meshy rend des sommets séparés par face: `remove_doubles` avant de lisser.
- Three.js: lier une pièce au squelette d'un autre fichier par `new Skeleton(os du corps retrouvés par nom, boneInverses de la pièce)` puis `bind(skeleton, bindMatrix)`; une matière par zone du corps donne un maillage par zone, que l'on cache sous un vêtement.
- Dossiers de `meshy_output/`: le suffixe ne porte que 8 caractères de l'identifiant, commun à des tâches lancées la même minute; lire le chemin rendu par `meshy_download_model`.
- Essai 2 (même jour): image vers 3D d'après une vue de face seule = corps en fil de fer, et `meshy-n1` laisse le dos noir (pas gris): une découpe par couleurs de texture devine le dos de travers. Compter les faces par couleur trompe (topologie intelligente: grandes faces sur les aplats): compter à l'aire.
- Le pied d'un rig de Meshy pointe vers le bas au repos: ramené sur un os de pied à plat, la chaussure se dresse. Redresser avant de figer.
- Vêtement sans traversée par construction: le volume du corps décalé (bas 8 mm, haut 19 mm, veste 38 mm), mêmes poids, Solidify de 8 mm, corps masqué dessous (`scripts/voie_d.py`, `figurine.py`). Replacer les os d'un rig sans casser ses clips: `eb.align_roll(ancien axe z)` après avoir posé tête et queue.
- Ombre portée d'un `SkinnedMesh` lisse: `bias` -0,0004, `normalBias` 0,012, `PCFSoftShadowMap`, pas d'acné sur les captures.

## Catalogue des personnages de la refonte (lot L5, 2026-11-10, `games/la-petite-ligne-2/assets-src/personnages/`)

- Tout sort de `gabarits.toml` par `construire.sh` (4 s). Ajouter une pièce = une entrée; ne jamais coder une pièce en dur.
- Le contrat est `src/donnees/schemas/personnage.ts` (squelette `duo-24`, identifiants à traits d'union, objets stricts), plus récent que `technique.md` 3.4 (qui dit encore 18 os): lire le schéma avant d'écrire un catalogue.
- Corpulences par cibles de morphose (même générateur relancé avec d'autres cotes: topologie identique), cuites à la fusion. Âges par translations de repos des os: des membres en gélules coaxiales coulissent l'un dans l'autre sans cisaillement; jamais d'échelle non uniforme sur un os animé.
- Expressions: reconstruire tout le visage par expression avec la même topologie, chaque version devient une clé de forme; une pièce cachée (arc d'œil fermé, joue) se range dans la tête plutôt que de disparaître.
- Blender 5.2: régler `scene.render.fps` avant d'importer un glTF animé (sinon 24 i/s et des durées fausses); `export_vertex_color="ACTIVE"` avec un attribut `FLOAT_COLOR` de coin sort COLOR_0; `tomllib` est disponible sous duo-python.
- Axe V: l'export glTF de Blender écrit `v' = 1 - v`. Le catalogue v1 écrit `1 - (section + 0,5) / 16` dans Blender (`section_v`) pour que le jeu lise `floor(v * 16)` directement.
- Une clé de forme bloque `modifier_apply` (Solidify, Decimate) et `join` mélange mal des objets avec et sans clés: construire sans clés, joindre, épaissir, puis ajouter les cibles (`add_stoop`).
- Une cible qui ne dépend que de la position (dos voûté `stoop_delta`) s'ajoute à toutes les pièces sans rien décoller, y compris tête, chapeau et lunettes.
- Barbes et lunettes « qui vont à toutes les têtes »: lancer des rayons sur le crâne de chaque tête du catalogue et garder la surface la plus avancée.
- Budget 6 000 triangles par personnage: la tête (visage complet) pèse 1 250, les boutons (n=8) 64 chacun; un bonnet Meshy se réduit par `DECIMATE` au champ `triangles`.
- Copie isolée: une commande qui contient `source` ou `git show` dans une boucle est refusée; passer par un script Python (subprocess) écrit avec l'outil d'écriture.
- Three.js: `SkeletonUtils.clone` par personnage, puis fusion manuelle (positions plus deltas de morphose, indices d'os refaits par nom); une vue de profil d'une rangée de personnages demande 14 m d'écart, sinon la caméra entre dans le voisin.

## Corps commun encré et tenues en textures (essai 3, 2026-11-10, `docs/jeux/jeu-1/refonte/essai-style-3/`)

- Meshy par texte ignore « bald » une fois sur deux (queue de cheval, mèche, barbe modelées) et tire vers le culturiste dès qu'on écrit « sturdy » ou « stylized »; une image de concept (`meshy_text_to_image` nano-banana, 3 crédits) puis image vers 3D `meshy-t2.5` sans texture (5) donne une silhouette taillée et caractérisée. Le rig marche sur un modèle sans texture (5).
- `bpy.ops.uv.smart_project` ou `unwrap` lancé dans la session de l'import glTF: des centaines de triangles sans aire en UV. Enregistrer, rouvrir le .blend, faire une première projection de tout le maillage, puis celle par région.
- Nommer un script `inspect.py` dans le dossier courant casse `import bpy` (module standard masqué): plantage glog sans message clair.
- Une pièce par membre: coutures aux frontières de pièces plus un chemin Dijkstra le long d'un côté caché (coût `longueur x (1 + 40 (1 - alignement)²)`), `unwrap(method="MINIMUM_STRETCH")`: 7 à 12 îlots, 0 triangle nul. Rangement maison en étagères par bande (recherche dichotomique de l'échelle).
- Peinture des tenues par position de repos du texel (rastérisation des UV en numpy): la même fiche habille tous les corps; coordonnées de membre `t` (épaule 0, poignet 1) et angle autour du membre pour coutures, plis et carreaux. Encolure: anneau autour de l'axe du cou, sinon le dessus des épaules reste nu.
- Occlusion Cycles bruitée: la lisser (gaussienne 2,5 px à 1 024) avant de seuiller des noirs pleins, sinon bords « en fourrure ».
- `np.maximum(ink, a & b * 0.8)`: `*` passe avant `&` (erreur de type); `& ~False` vaut `& -1` (indexation géante).
- Three.js, coque d'encre cuite: sommets doublés (`aOutline`), triangles retournés ajoutés dans le groupe du matériau, poussée après `#include <project_vertex>` le long de `(projectionMatrix * vec4(transformedNormal, 0)).xy`, en pixels x `gl_Position.w`. Aucun appel de plus. Un glTF à deux matériaux arrive en deux `SkinnedMesh` à matériau unique (pas de tableau).
- Rampe toon en éclairage physique: diffus = albédo x (ambiante + soleil x rampe) / pi; pour clair = albédo, intensités x pi. Rampe 4 texels `[0, 128, 255, 255]`, ambiante 0,2 et soleil 0,78: noir coloré, ombre, clair.

## Personnages encrés lisibles de haut (essai 4, 2026-11-10, `docs/jeux/jeu-1/refonte/essai-style-4/`)

- Concept par `meshy_text_to_image` (nano-banana): sans consigne chiffrée, la femme et l'homme sortent en fil de fer (8,5 têtes) et l'enfant avec une tête de 3,5 têtes. Écrire « the head is exactly one seventh of the total height », « sturdy limbs with real thickness », « low-poly faceted look with hard flat planes ». Un concept sur trois est à refaire (3 crédits).
- Rig Meshy: `meshy_download_model` ne rapporte pas la marche; la prendre par `curl` sur `result.basic_animations.walking_glb_url` (assets.meshy.ai ouvert dans l'environnement « duo »).
- Os du rig Meshy: `Spine02` est le BAS du dos (au-dessus des hanches), `Spine` la poitrine. Une bavette calée sur `Spine02` disparaît.
- Le GLB exporté par Blender est en mètres dans la géométrie (le noeud Armature porte le 0,01): une poussée de sommets se donne en mètres, pas en centimètres.
- Repères du visage: l'estimation d'après le nez se trompe sur le menton des visages longs; les relever sur une planche de réglage (Workbench, traits tracés par-dessus) et les mettre dans la fiche du corps. Cellule des traits non carrée: largeur d'après l'écart des yeux, hauteur d'après yeux-bouche.
- Un masque de vêtement « torse » (ni bras ni jambe) contient la tête: borner chaque couche par `region != 0` et une hauteur, sinon gilet et bretelles montent sur le visage.
- Hachures peintes dans l'occlusion autour du cou = col « en fourrure »; plus généralement, hachures peintes dans la texture = bruit de près et gribouillis de loin. Garder dans l'atlas aplats, plis et noirs pleins; hachurer dans le nuanceur.
- Hachures stables: coordonnées `gl_FragCoord.xy` moins la projection de l'origine de l'objet (varying `flat`; `instanceMatrix` pour les instances): elles suivent l'objet, pas constant à l'écran. Les fondre par les pixels par mètre (nul sous 80, plein à 150).
- Effacement des détails sans coût: `texture.mipmaps = [ImageBitmap...]`, `generateMipmaps = false`, tous les niveaux jusqu'à 1 px; niveau 1 à mi-détail, niveaux 2 et suivants en aplats (une couleur moyenne par couche). `createImageBitmap(blob, sx, sy, sw, sh, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })` découpe et redimensionne sans abîmer un alpha qui porte une hauteur (un canevas 2D prémultiplie). Biais de -1 sur l'échantillonnage pour garder le détail au zoom serré (170 px par mètre).
- Relief sans texture de plus: hauteur dans l'alpha de l'atlas (jamais 0), normale inclinée par `dFdx`/`dFdy` de la hauteur (facteur 0,036 pour 2 cm), sommets poussés par `textureLod(map, uv, 0.0)` dans le vertex shader (déclarer `uniform sampler2D map` côté sommets).
- MeshToonMaterial comme porteur: `#include <shadowmask_pars_fragment>` à ajouter après `shadowmap_pars_fragment` pour avoir `getShadowMask()`; remplacer la couleur finale avant `opaque_fragment`; `directionalLights[0].direction` est en repère caméra. Ombre nette et lisse: `PCFShadowMap` puis `smoothstep(0.4, 0.6, masque)`.
- Un maillage `colorWrite: false` avec `castShadow` porte une ombre sans se dessiner (feuillage hors champ). Le cadre de la carte d'ombre coupe ces ombres en ligne droite: l'élargir ou rapprocher la masse.
- Coque d'encre sur facettes franches: normales plates pour la lumière, attribut à part pour la poussée (position normalisée d'un caillou, rayon autour de l'axe d'un brin): pas de fente aux arêtes.
- Planche en 256 couleurs: les teintes d'accent virent (lilas en gris), bandes dans la vignette. Gagner la place ailleurs: GLB sans image embarquée, npz en float16, PNG réenregistré avec `optimize` (3,3 Mo vers 1,9 Mo).
- Copie isolée: les heredocs (`python3 - <<EOF`) sont refusés aussi; écrire le script dans le dossier de travail avec l'outil d'écriture.


## Rendu encré dans le moteur (portage du 2026-11-10, `games/la-petite-ligne-2/src/rendu/encre/`, ADR 0023)

- Cible à deux sorties: tout matériau qui s'y dessine doit écrire les deux (un matériau standard de Three.js laisse la seconde indéfinie). Fondu d'un volume: mélange alpha normal et seconde sortie à `vec4(0)` (chaque sortie se mélange avec son propre alpha: l'image du contour reste intacte).
- `ShaderMaterial.clone()` clone les uniformes (vecteurs, couleurs): la copie perd la lumière commune. Sous-classe avec `clone()` qui repart des mêmes objets d'uniformes et garde à part teinte, opacité, lueur; `Material.onBeforeRender()` (0.187) recopie `opacity`, `transparent`, `emissive` dans les uniformes, avec `uniformsNeedUpdate = true`.
- `renderer.info.autoReset = false` puis `info.reset()` en début d'image: les compteurs somment toutes les passes (ombres, scène, contour).
- Rendu logiciel (banc, e2e): compiler dix programmes dans la même image gèle le fil principal plus de 8 s et le faux hôte arrête la partie (« le jeu ne répond plus »). Faire entrer les familles de maillages une par image (calque 0 retiré aux autres), et sauter des images quand l'écart entre deux images dépasse 250 ms. `gl.finish()` posé pour mesurer suffit à provoquer la panne.
- Banc à deux vues en rendu logiciel: garder les deux pages petites (240 x 135) et n'agrandir à 1366 x 768 que la page capturée, le temps de la capture.
- Attribut absent d'une géométrie: le nuanceur lit (0, 0, 0, 1). S'en servir comme « automatique » (forme unité instanciée: classe de taille lue dans l'échelle de l'instance).
- Sol sans grille à partir d'une grille: texture d'un point par case en filtrage au plus proche, lue en un point décalé par un bruit; les sols posés par l'homme (drapeau dans l'alpha) se lisent sans décalage, leur bord reste droit.
- Copie isolée: `git merge --ff-only` refuse si mes fichiers modifiés sont touchés en face; `git diff --output=<fichier> -- <chemins>`, `git checkout -- <chemins>`, fusion, puis `git apply --3way` (une commande à la fois, sans variable ni `&&` avec git).
- Deux os en cinématique inverse dans le repère du monde: plier le genou autour de `cross(tibia, cuisse)` de l'écart d'angle intérieur, puis balancer la cuisse par `setFromUnitVectors`; garder la pose du clip avant et la rendre avant le mélangeur suivant (os non réécrits).
