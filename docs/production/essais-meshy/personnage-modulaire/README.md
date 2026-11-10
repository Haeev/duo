# Essai « personnage modulaire avec Meshy » (La Petite Ligne, refonte)

| Champ | Valeur |
|---|---|
| Date | 2026-11-10 |
| Auteur | tech-artist |
| Statut | essai terminé, résultat partiel: l'assemblage est prouvé, la qualité des pièces ne l'est pas |
| Crédits | 71 sur 250 (solde 2 323 avant, 2 252 après; 14 tâches, toutes réussies) |
| Besoin | réponses 43 à 51 du client: catalogue de pièces générées par Meshy, assemblées sur un squelette commun, rendu lisse de figurine, proportions actuelles |

## 1. Verdict en cinq lignes

1. **Prouvé**: un squelette commun (les 24 os de Meshy), des pièces en fichiers séparés liées à ce squelette par les noms d'os dans Three.js, des clips partagés (marche, course, repos, salut), des zones du corps masquées sous les vêtements, 8 combinaisons assemblées et animées (6 à 10 appels de dessin, 6 000 à 10 000 triangles, pièces de 35 à 78 Ko).
2. **Prouvé**: on impose des proportions à n'importe quel personnage riggé par Meshy en passant par son squelette (une échelle par os, puis la pose devient le repos). Le corps de Meshy sort à 7,5 têtes, le script le ramène à 4,6. C'est la clé pour l'enfant, l'âgé et les corpulences.
3. **Infirmé**: la voie A telle que le brief la décrit (vêtement généré seul par texte, puis enveloppé et pesé par script) ne donne pas de pièces livrables. Meshy ne tient ni la pose (manches à 45 ou 75 degrés), ni « seul » (mannequin, buste, tête et socle livrés avec), ni le style (plis réalistes). Le script rattrape la pose et les traversées, pas la forme.
4. **Mitigé**: la voie B (personnage entier riggé puis découpé par zones) donne un ensemble cohérent tant que les pièces viennent du même donneur (combinaison e), mais les coupes sont dentelées et une pièce d'un donneur corpulent fait une cloche sur un autre bas.
5. **Recommandation**: voie C, mixte (section 5). Pièces rigides attachées à un os par Meshy tout de suite (têtes coiffées, chapeaux, lunettes, sacs); vêtements souples générés **portés par notre corps de base** d'après une image de référence, riggés, ramenés au squelette commun, coupés par plans. Cette dernière étape (image de référence) n'a pas été essayée: un second essai court est nécessaire avant d'engager le catalogue.

Aucune des 8 combinaisons n'est au niveau « figurine lisse et douce » demandé. Voir les planches avant de décider.

## 2. Ce qui a été généré (14 tâches, 71 crédits)

Toutes en `meshy-t2.5`, topologie intelligente, triangles, sans texture (couleur par pièce posée par le script). Consignes et paramètres exacts dans `fiches/*.meshy.json`.

| # | Tâche | Outil | Crédits | Sortie constatée |
|---|---|---|---|---|
| 1 | `01a1c4e4-5800-713e-9062-bd69a49fad04` corps | texte vers 3D, 6 000 faces, pose en T | 5 | pose en T correcte, mais mannequin anatomique réaliste de 7,5 têtes (« five heads tall, chunky » ignoré) |
| 2 | `01a1c4e4-84ce-7152-81b6-c3748535a02d` t-shirt | texte vers 3D, 2 500 | 5 | seul et creux, manches à 45 degrés, plis réalistes |
| 3 | `01a1c4e4-9aab-74bf-98cf-f4cf4ff181c6` veste | texte vers 3D, 3 000 | 5 | livrée sur un buste de mannequin (cou, bassin, moignons de mains), manches pendantes à 75 degrés |
| 4 | `01a1c4e4-a95e-70d3-a3f4-3b650c34fcfd` pantalon | texte vers 3D, 2 000 | 5 | seul, jambes droites et serrées (pas l'écartement du corps) |
| 5 | `01a1c4e4-b707-72dc-a287-6376eb148e07` jupe | texte vers 3D, 1 500 | 5 | une robe bustier sur un mannequin avec jambes et pieds |
| 6 | `01a1c4e4-c68c-72bf-8818-6898ae3d5030` baskets | texte vers 3D, 1 500 | 5 | paire correcte, semelles crantées détaillées |
| 7 | `01a1c4e4-d583-7108-93d6-9b8a7586758c` chapeau de paille | texte vers 3D, 1 000 | 5 | correct, creux |
| 8 | `01a1c4e4-e48f-72bc-807f-39fa3fdfaac1` cheveux, carré | texte vers 3D, 2 000 | 5 | une tête entière avec visage, sur un socle (« no head, no face » ignoré) |
| 9 | `01a1c4e4-f3eb-703a-a205-ce6b0538bba8` cheveux courts | texte vers 3D, 2 000 | 5 | une tête entière avec visage réaliste et cou |
| 10 | `01a1c4e5-017f-72da-919e-70823e7dddef` donneur femme | texte vers 3D, 6 000, pose en T | 5 | corps nu réaliste, ni pull ni jupe: écarté |
| 11 | `01a1c4e5-2ccc-722c-b305-1c73714ef31a` donneur homme | texte vers 3D, 6 000, pose en T | 5 | personnage trapu stylisé, gilet, short, bottes, barbe: le seul dans le style voulu |
| 12 | `01a1c4e7-6e4d-754d-884c-8c8d594ec9ad` rig du corps | `meshy_rig`, 1,72 m | 5 | 24 os, marche et course |
| 13 | `01a1c4e7-7fbd-721d-b08b-08afac24bf6c` rig du donneur homme | `meshy_rig`, 1,72 m | 5 | mêmes 24 os |
| 14 | `01a1c4e7-b9ab-72fb-a0bd-859926490d50` animations du corps | `meshy_animate`, actions 11 (Idle 1) et 28 (Big Wave Hello) | 6 | 2 clips |

Durées: 30 à 60 s par génération, 7 s par rig, 15 s pour les deux actions. Sorties brutes hors du dépôt (liens valables 3 jours, jusqu'au 2026-11-13).
Planche des sorties brutes: `captures/sorties-brutes-quatre-angles.png` (une ligne par tâche 2 à 11, dans l'ordre) et `captures/corps-brut-quatre-angles.png`.

## 3. Squelette commun

`squelette-commun.json` (os, parents, têtes et queues au repos) et `pieces/corps.glb`.

- Les 24 os du rig de Meshy, noms gardés: `Hips`, `Spine02`, `Spine01`, `Spine`, `neck`, `Head`, `head_end`, `headfront`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, idem `Right`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase`, idem `Right`. Aucun doigt.
- Pose de repos: en T, bras à l'horizontale, face vers +Z (glTF), 1 unité = 1 m, semelles à 0, taille 1,72 m. Échelle 0,01 du nœud Armature appliquée.
- Pourquoi ce squelette plutôt que le `rig` de 18 os du jeu: tout rig de Meshy a ces mêmes os (vérifié le 2026-11-07 et de nouveau ici sur deux rigs), donc une pièce tirée d'un personnage riggé par Meshy arrive déjà pesée, et la bibliothèque de 678 actions se joue sans transfert. Les 49 clips actuels du jeu devront en revanche être refaits ou transférés (non essayé).
- Proportions: échelles par os dans `fiches/corps_adulte.meshy.json` (`proportions`: largeur et longueur). Résultat 4,57 têtes (tête mesurée avec le haut du cou; cible « comme maintenant »: 5 têtes, tête de 34 cm). À régler avec le directeur artistique: ce sont des nombres dans une fiche.
- Clips: `walk` 1,03 s, `run` 0,63 s, `idle` 1,87 s, `wave` 5,33 s. L'amplitude des hanches est remise à l'échelle des jambes raccourcies.
- Zones du corps (une matière par zone, donc un maillage par zone dans Three.js): `tete`, `torse`, `bras`, `avant_bras`, `mains`, `bassin` (avec les cuisses), `jambes`, `pieds`. Chaque pièce déclare les zones qu'elle masque (extras glTF `masque`).

## 4. Les voies comparées

Planches: `captures/planche-voie-a.png` (combinaisons a à d) et `captures/planche-voie-b.png` (e à h). Chaque ligne: face au repos, profil au repos, marche de trois quarts, marche de profil. Corps nu: `captures/combinaison-corps.png`.

### Voie A: pièce générée seule, conformée et pesée par script (`scripts/conformer_piece.py`)

Ce que fait le script: coupe en hauteur (socle, buste), mise à l'échelle sur les articulations, corps mis **dans la pose du vêtement** (bras baissés de 45 ou 70 degrés), sommets tenus à une distance minimale de la peau, poids du corps transférés (face la plus proche, jamais ceux du côté opposé), lissés, puis retour à la pose en T par la peau inversée; jambes du pantalon recentrées tranche par tranche sur les os.

| Pièce | Résultat sur les captures |
|---|---|
| `bas_jupe` | la meilleure pièce souple: tient au repos et en marche, pas de genou qui traverse à ce pas; ourlet irrégulier; les jambes du mannequin restent dedans (triangles perdus) |
| `haut_tshirt` | torse correct, 584 sommets dans le corps avant, 0 après; ourlet déchiqueté; manches trop courtes pour masquer le bras, donc le bras musclé du corps reste visible; bosse au ventre |
| `bas_pantalon` | suit les jambes sans voile entre elles après recentrage (avant: une toile tendue d'une jambe à l'autre en marche); surface cabossée, entrejambe en boule |
| `haut_veste` | **échec**: manches en lambeaux, ventre en ballon (le bassin du mannequin fermait la veste), 7 sommets encore dans le corps |
| `chaussures_baskets` | **échec**: posées à l'os du pied mais mal orientées et étirées en hauteur; le pied du corps de Meshy pointe vers le bas au repos, la chaussure rigide hérite de cet angle |
| `chapeau_paille` | tient sur la tête nue du corps; s'enfonce dans les têtes coiffées (calotte plus étroite que la coiffure) |
| `tete_carre`, `tete_court` | **réussite**: tête et coiffure d'un seul tenant, rigides sur l'os `Head`, visage en relief; un jour au cou (la tête ne descend pas assez), styles de visage différents d'une génération à l'autre |

Traversées relevées: épaules (t-shirt: le bras sort de la manche, ce n'est pas une traversée mais un trou de masque); hanches (t-shirt dans le pantalon en combinaison c, taches bleues sur le rouge); genoux: aucune avec la jupe ni le pantalon à ce pas de marche. La course et le salut n'ont pas été regardés.

Cause de fond: Meshy génère chaque objet dans sa propre pose, à sa propre échelle et avec son propre niveau de détail. Le script peut déplacer une surface, il ne peut pas inventer une manche à la bonne place.

### Voie B: personnage entier riggé, découpé par zones (`scripts/decouper_donneur.py`)

Ce que fait le script: chaque os du donneur est posé sur l'os commun de même nom (position, orientation, longueur), le maillage est figé dans cette pose: il est à la pose de repos commune **avec ses propres poids** (aucun transfert). Les faces sont rangées par zone d'os dominante.

- Combinaison e (les quatre pièces du même donneur): personnage cohérent, pas de trou entre les pièces, marche correcte. C'est la meilleure des huit.
- Combinaisons f, g, h (pièces mêlées): le gilet du donneur corpulent fait une cloche au-dessus d'un bas étroit; le short, coupé à la taille par les poids, laisse une collerette; les coupes sont dentelées (frontière des poids, pas un plan).
- Un donneur sur deux a ignoré la consigne (tâche 10): 5 crédits perdus, comptés dans l'estimation.

### Mesures (Three.js 0.187, Chromium, 1600 x 620, `captures/mesures.json`)

| Combinaison | Pièces | Triangles | Appels de dessin | Poids des pièces (hors corps) |
|---|---|---|---|---|
| a | tête carré, t-shirt, jupe, baskets | 9 001 | 9 | 221 Ko |
| b | tête courte, veste, pantalon, baskets | 8 388 | 6 | 250 Ko |
| c | tête courte, t-shirt, pantalon, chapeau | 9 971 | 9 | 248 Ko |
| d | tête carré, veste, jupe, baskets, chapeau | 8 274 | 8 | 245 Ko |
| e | tête barbu, gilet, short, bottes | 5 983 | 6 | 179 Ko |
| f | tête carré, gilet, jupe, bottes | 6 053 | 6 | 186 Ko |
| g | tête barbu, t-shirt, short, baskets, chapeau | 9 807 | 10 | 251 Ko |
| h | tête courte, gilet, pantalon, bottes | 7 756 | 6 | 228 Ko |
| corps nu | | 6 187 | 9 | |

- Un personnage complet = ces pièces plus le corps (sa géométrie seule n'a pas été pesée à part des clips).
- Poids par pièce: 35 à 78 Ko (780 à 2 450 triangles). `corps.glb`: 988 Ko, dont l'essentiel pour les 4 clips (à sortir dans un fichier de clips partagé).
- Les appels comptent un maillage par zone visible du corps et un par pièce (2 programmes). En production: fusion des pièces d'un personnage à la composition (même squelette, matière de palette commune) pour 1 appel, comme le fait déjà le jeu.
- Le corps pèse trop: 6 187 triangles dont 957 pour deux mains à doigts. Demander 3 000 faces et des mains en moufles.

## 5. Chaîne recommandée (voie C)

1. **Corps de base, une fois**: un corps stylisé (référence dessinée par le directeur artistique, image vers 3D), riggé par Meshy, mis aux proportions par `corps_commun.py`. Il fixe le squelette commun. Enfant, âgé, corpulences: une table d'échelles par os et par gabarit (même mécanisme que `proportions`), appliquée au squelette partagé, donc à toutes les pièces d'un coup. Prouvé dans Blender; à l'exécution dans Three.js (échelle des os), non essayé.
2. **Pièces rigides** (têtes avec visage en relief, coiffures, chapeaux, lunettes, sacs, chaussures): génération seule, `conformer_piece.py` en mode `rigide` sur un os. Marche dès aujourd'hui pour têtes et chapeaux. Chaussures: imposer d'abord un pied à plat au repos sur le corps.
3. **Vêtements souples** (hauts, bas, robes, salopettes): ne pas les générer seuls. Générer **notre corps de base portant le vêtement**, en pose en T, d'après une image de référence (rendu du corps commun habillé par `meshy_image_to_image`, ou dessin), puis rig (5 crédits), `decouper_donneur.py`, coupe par plans (taille, poignets, chevilles) au lieu des poids. La pose, l'échelle et la corpulence sont alors celles du corps: c'est ce qui a manqué aux deux voies. **Non essayé**: c'est le second essai à faire (environ 60 crédits pour 3 vêtements).
4. **Corps masqué sous le vêtement**: garder le principe des zones, avec des zones plus fines (bras en deux, cuisse séparée du bassin) et une règle simple: une pièce ne masque que ce qu'elle couvre entièrement.
5. **Repli si l'étape 3 déçoit**: vêtements souples modélisés par script Blender sur le corps commun (comme les `wear_*` actuels), Meshy réservé aux pièces rigides. C'est le partage que recommandait déjà la fiche du studio (section 10, personnages).

### Règles à imposer aux consignes

- **Pose**: `pose_mode: "t-pose"` ne vaut que pour un personnage; un vêtement seul sort dans la pose que Meshy veut. Tout ce qui doit épouser le corps est généré porté.
- **Vue et référence**: image de face, fond uni, corps entier, pieds à plat et parallèles, bras à l'horizontale, jambes à l'écartement du corps commun. Le texte seul ne tient ni les proportions (« five heads tall » ignoré deux fois sur trois) ni les exclusions (« no head », « no body » ignorés quatre fois sur huit).
- **Style lisse**: « matte vinyl toy figurine, no wrinkles » n'a pas suffi (plis sur t-shirt, veste, pantalon). Passer le style par l'image de référence, garder 1 500 à 2 500 faces par pièce, lisser les normales à l'export (fait).
- **Couleur par pièce**: aucune texture demandée (5 crédits au lieu de 15); une matière par pièce, recolorable par le jeu. Deux couleurs sur une pièce (col, semelle) demanderont la palette à cases de la fiche du studio.
- **Une pièce par tâche**, nom de catégorie dans la fiche, budget de faces dans la demande (jamais de réduction après le transfert de poids).

### Limites et comment les traiter

| Limite | Traitement proposé |
|---|---|
| Enfants, âgés, corpulences | échelles par os sur le squelette commun (prouvé pour les proportions); âgé: tête et pièces rigides dédiées (cheveux, lunettes), dos voûté par la pose de repos du clip; corpulence forte: les vêtements suivent les os mais pas un ventre, prévoir une cible de morphose ou un corps « rond » avec ses propres hauts |
| Jupes longues, robes | poids en dégradé bassin vers cuisses (mode `jupe`, tient à la marche); longueur au-dessus du genou ou sous le genou seulement; course et position assise non essayées: attendre des traversées, prévoir une variante courte ou un os de jupe |
| Cheveux longs | rigides sur `Head` jusqu'aux épaules; au-delà ils traversent le dos quand la tête tourne: limiter la longueur ou peser le bas sur `Spine` |
| Chapeau sur coiffure | une variante « sous chapeau » par coiffure (le jeu le fait déjà avec `_hat`), ou calotte élargie par catégorie de coiffure |
| Visage et cheveux choisis à part (éditeur, réponse 47) | Meshy livre tête et cheveux fondus; les séparer demande une tête de base commune et des coiffures générées dessus puis coupées: non essayé |
| Expressions | aucune cible de morphose en sortie de Meshy: le client a choisi les onomatopées au-dessus de la tête (réponse 51), ce qui convient |
| Style d'une génération à l'autre | visages et niveaux de détail différents (têtes 8 et 9): une image de style commune et une revue par planche de série |

## 6. Coût et temps pour le catalogue (15 pièces x 8 catégories = 120 pièces)

Mesuré: 5 crédits et 30 à 60 s par génération sans texture, 5 crédits et 7 s par rig, 10 à 20 s de script par pièce. Dans cet essai, 6 générations sur 11 s'écartaient de la consigne, dont 2 inutilisables (veste, donneuse).

| Poste | Hypothèse | Crédits |
|---|---|---|
| Pièces rigides (têtes, coiffures, chaussures, chapeaux, lunettes, accessoires: 75 pièces) | 5 par génération, 1,6 génération par pièce retenue | 600 |
| Vêtements souples (hauts, bas, robes: 45 pièces) | image de référence 4 + image vers 3D sans texture 5 + rig 5, 1,6 essai par pièce | 1 010 |
| Corps et clips | corps 16, une vingtaine d'actions à 3 | 80 |
| Marge de 30 % | | 510 |
| **Total** | | **environ 2 200** |

Soit à peu près le solde actuel (2 252), ou les trois quarts d'un mois de crédits (3 058). Estimation, pas mesure, pour les vêtements souples.

Temps: la machine est négligeable (2 à 3 min par pièce, tout compris). Le temps réel est le réglage de la fiche et la revue sur capture: 10 à 20 min par pièce quand la génération est bonne, soit 20 à 40 h pour 120 pièces, hors reprises du directeur artistique. Estimation tirée de cet essai (12 pièces en 1 h 40, écriture des scripts comprise).

## 7. Reprendre l'essai

```text
bash construire.sh <dossier des sorties brutes> [corps] [pièce ...]     corps et pièces de la voie A
duo-python scripts/decouper_donneur.py fiches/donneur_homme.meshy.json pieces/corps.glb <bruts>/rig/homme_rig.glb pieces rapports
node banc/capturer.mjs games/la-petite-ligne/node_modules/three captures     planches et mesures
```

| Chemin | Contenu |
|---|---|
| `scripts/corps_commun.py` | corps, proportions par le squelette, zones, clips, `squelette-commun.json` |
| `scripts/conformer_piece.py` | voie A: coupe, mise en place, enveloppe, transfert et lissage des poids, modes `enveloppe`, `jupe`, `rigide` |
| `scripts/decouper_donneur.py` | voie B: donneur ramené au squelette commun, découpe par zones |
| `scripts/pm_commun.py` | zones, corps de référence posé, peau inversée, export |
| `fiches/*.meshy.json` | une fiche par asset généré: consigne, paramètres, tâches, crédits, réglages de conformité |
| `pieces/*.glb` | corps et 12 pièces conformées (1,7 Mo) |
| `rapports/*.json` | triangles, poids, sommets dans le corps avant et après |
| `banc/index.html`, `banc/catalogue.json` | banc d'essai: choix d'une pièce par catégorie, animation, flèches pour tourner; `?combo=a` à `h`, `?planche=1` |
| `banc/capturer.mjs` | sert le banc avec le Three.js du dépôt et capture une planche par combinaison (les deux planches réunies ont été montées avec Pillow) |

Les sorties brutes ne sont pas versionnées: sans elles, `construire.sh` ne peut pas refaire les pièces (les fichiers de Meshy s'effacent le 2026-11-13). Le banc et les captures se relancent sans elles.

Non fait: `verifier_asset.py` (les pièces de l'essai n'ont ni palette ni nom de la bible, il les refuserait toutes); validateur glTF; fusion en un appel de dessin; course et salut regardés sur capture.
