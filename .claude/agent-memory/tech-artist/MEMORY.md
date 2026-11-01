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
- Pavés posés entiers: lire le masque au milieu du pavé (centre recalculé dans le shader), le bord de la zone suit les joints.
- Un lit de rivière en un seul maillage coûte tout son quadrillage à chaque image: le couper en tronçons de 12 m (élimination hors du cadre) a ramené le surcoût de 18 000 à 5 000 triangles pour deux ou trois appels de plus.
- Machine chargée (charge 18): un lot de dix captures prend plus de 10 min; lancer en arrière-plan.
