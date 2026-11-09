# Essais de mesure de la section technique de Cosy Café

| Champ | Valeur |
|---|---|
| Date | 2026-11-07 |
| Rédacteur | architecte-technique |
| Document servi | `docs/jeux/cosy-cafe/technique.md` (sections 4 et 5) |
| Machine | machine cloud du studio: Intel Xeon (famille 6, modèle 207) à 2,1 GHz sous KVM, 4 cœurs, Node 22.23.4, charge moyenne de 0,1 pendant les mesures |

Deux essais très courts, sans code de jeu ni rendu: ils ne tranchent que ce qu'aucune mesure de La Petite Ligne ne fixait. Aucun des deux ne dessine quoi que ce soit: ni WebGL ni SwiftShader n'interviennent. Rappel valable pour tout essai graphique du studio: SwiftShader (rendu logiciel de l'environnement cloud) ne représente pas l'Intel UHD 620 du PC; seules les mesures sur le vrai PC (banc de mesure, section 10 de `technique.md`) disent ce que coûte le dessin.

## 1. Animation de la foule par squelettes: `foule-animation-cpu.mjs`

**Question**: combien coûte au processeur, à chaque image, l'animation par squelettes de N personnages dans Three.js 0.187?

**Méthode**: le vrai modèle des personnages de La Petite Ligne (`games/la-petite-ligne/assets/modeles/personnages.glb`: squelette de 18 os, clips de 20 pistes; personnage `villager_odette`, 2 434 triangles, 5 cibles de morphose), lu par le `GLTFLoader` de Three.js 0.187 dans Node, images et textures retirées. N clones (`SkeletonUtils.clone`), un `AnimationMixer` chacun, huit clips de café en alternance (`walk`, `idle`, `sit`, `sit_eat`, `drink`, `talk`, `give`, `carry_one`), un quart des personnages avec deux clips mêlés (transition permanente, le pire cas). Chaque image: `mixer.update` de tous, `scene.updateMatrixWorld()`, puis `skeleton.update()` de chacun, comme le fait `WebGLRenderer` avant de dessiner un `SkinnedMesh`. 1 200 images par série, 240 d'échauffement, 5 séries; temps processeur par `process.cpuUsage()`, ramasse-miettes suivi par `PerformanceObserver`.

**Lancer** (dépendances dans un dossier temporaire, rien dans le dépôt):

```text
npm install --prefix <dossier> three@0.187.0
node docs/jeux/cosy-cafe/essais/foule-animation-cpu.mjs <dossier> games/la-petite-ligne/assets/modeles/personnages.glb docs/jeux/cosy-cafe/essais/foule-animation-cpu.resultats.json
```

**Résultats** (deux lancements à 10 minutes d'écart, médiane des 5 séries; détail dans `foule-animation-cpu.resultats.json`, second lancement):

| Personnages animés | Premier lancement (ms par image) | Second lancement (ms par image) | Par personnage |
|---|---|---|---|
| 10 | 0,059 | 0,060 | 6 µs |
| 20 | 0,121 | 0,119 | 6 µs |
| 40 | 0,374 | 0,343 | 9 µs |
| 60 | 0,662 | 0,573 | 10 à 11 µs |
| 80 | 0,844 | 0,884 | 11 µs |
| 120 | 1,557 | 1,592 | 13 µs |

Ramasse-miettes pendant la meilleure série: de 0 à 14 ms cumulés sur ses 1 200 images (petites collectes), soit au plus 0,012 ms par image en moyenne. L'animation de Three.js alloue peu, mais pas rien: une petite collecte d'environ 1 ms peut tomber sur une image.

**Lecture**:

- Le coût par personnage croît avec le nombre (de 6 à 13 µs), probablement parce qu'au-delà de 40 les données ne tiennent plus dans les caches du processeur (explication non vérifiée).
- Extrapolation au PC de référence, non mesurée: un cœur d'i3 de 2018 en charge (portable, deux cœurs partagés avec le processus graphique de Chromium) est estimé 2 à 3 fois plus lent que ce cœur de serveur récent. 40 personnages coûteraient alors 0,7 à 1,1 ms par image, 80 personnages 1,7 à 2,7 ms, 120 personnages 3,1 à 4,8 ms, sur les 8 ms du fil principal (`architecture.md`, section 14.2).
- Ce que l'essai ne mesure pas, et qui s'ajoute sur le PC: l'envoi de chaque personnage au GPU (un appel de dessin et le téléversement de la texture de ses os, `boneTexture.needsUpdate` à chaque image dans `Skeleton.update` de Three.js 0.187), estimé de 30 à 50 µs par personnage avec ANGLE et Direct3D 11, à mesurer au banc; les retouches procédurales des os (regard, main qui tient une tasse); un squelette plus riche que 18 os (doigts), dont le coût croît à peu près avec le nombre de pistes.
- Conclusion pour la section 4 de `technique.md`: l'animation seule ne limite pas la foule à 40; c'est la somme animation plus appels de dessin (environ 2 à 3 ms pour 40 personnages sur le PC, estimation) qui fixe le plafond.

## 2. Taille des messages de l'hôte: `instantanes-taille.mjs`

**Question**: quelle taille ont les messages de l'hôte vers l'invité, adresse par adresse, avec des centaines d'objets, et combien coûte leur lecture chez l'invité (JSON puis schéma Valibot, comme le SDK à l'arrivée de chaque message)?

**Méthode**: un calcul. Des messages types sont fabriqués avec les effectifs supposés de la pointe d'un service (tableau `ADDRESSES` du script, hypothèses à recaler sur les plans du level designer et les simulations du game designer), puis comptés en octets UTF-8. Deux formes pour les déplacements: objets JSON à flottants complets (forme de La Petite Ligne) et tableaux compacts en centimètres et en degrés entiers (forme proposée). La lecture (`JSON.parse` puis `safeParse` d'un schéma strict de Valibot 1.5.0) est mesurée en temps processeur, meilleure de 5 séries de 400.

**Lancer**:

```text
npm install --prefix <dossier> valibot@1.5.0
node docs/jeux/cosy-cafe/essais/instantanes-taille.mjs <dossier> docs/jeux/cosy-cafe/essais/instantanes-taille.resultats.json
```

**Effectifs supposés**: village 24 personnages présents, 90 objets mobiles, 60 meubles posés; bourg 46, 160, 120; ville 70, 240, 180; paris-quartier 74, 240, 170; paris-maison 120, 420, 320.

**Résultats** (octets, identiques d'un lancement à l'autre; lecture en microsecondes sur la machine cloud, second lancement, à 10 % près du premier; détail dans `instantanes-taille.resultats.json`):

| Adresse | Déplacements, objets à flottants | Déplacements, tableaux compacts | Domaine des objets | Domaine des meubles | Domaine du service | Lecture (compacts / objets / meubles / service) |
|---|---|---|---|---|---|---|
| village | 2 559 | 640 | 1 848 | 1 418 | 990 | 10 / 32 / 21 / 17 |
| bourg | 4 851 | 1 138 | 3 338 | 2 822 | 1 779 | 16 / 56 / 40 / 29 |
| ville | 7 361 | 1 683 | 5 049 | 4 286 | 2 622 | 23 / 78 / 59 / 41 |
| paris-quartier | 7 777 | 1 776 | 5 048 | 4 043 | 2 839 | 23 / 77 / 56 / 44 |
| paris-maison | 12 585 | 2 869 | 8 877 | 7 720 | 4 236 | 37 / 142 / 108 / 66 |

**Lecture**:

- La forme compacte divise la taille des déplacements par 4,4. Avec tous les personnages présents, elle tient à paris-maison sous 3 Ko; sans les clients assis (leur place donne leur position, section 5.3 de `technique.md`), environ 1,1 Ko pour 45 personnages debout.
- Le plus gros message de domaine (objets de paris-maison, 8,9 Ko) reste à 3,7 fois sous l'alerte de 32 Kio que La Petite Ligne s'est donnée (moitié du plafond de 64 Kio d'un message, au-delà duquel le SDK lève une `RangeError` qui arrête la partie).
- La lecture la plus chère (0,14 ms ici, 0,3 à 0,45 ms estimées sur le PC) n'arrive qu'aux changements, au plus quelques fois par seconde: négligeable devant les 8 ms d'une image.
