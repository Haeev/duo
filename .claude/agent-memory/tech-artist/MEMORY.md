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

## Environnement cloud et captures

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
