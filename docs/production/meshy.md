# Meshy: fiche de référence du studio

| Champ | Valeur |
|---|---|
| Statut | proposition du tech-artist, à valider par le manager; s'aligne sur la bible de Cosy Café (sections 13.2 et 13.3) et en signale deux désaccords (section 16) |
| Version | 0.2 |
| Date | 2026-11-07 |
| Rédacteur | tech-artist |
| À relire par | directeur-artistique (sections 8 à 10 et 16), artiste-3d (sections 9, 10 et 15), artiste-2d (section 2.4), architecte-technique (sections 1, 4 et 13), manager (sections 1.2, 11, 13 et 16) |
| Outil | Meshy (génération 3D par IA), fourni par le client: clé d'API de l'offre payante, serveur MCP officiel `@meshy-ai/meshy-mcp-server` 0.6.9 (licence MIT) déclaré dans `.mcp.json` |
| Essai | `docs/production/essais-meshy/` (section 14): 7 tâches réelles, 62 crédits; machine et client téléchargés, conformés, animés, mesurés dans Three.js; modèles à chemins stables (section 15.2) |

Sources, citées entre crochets dans tout le document:

- **[P]** le paquet npm `@meshy-ai/meshy-mcp-server@0.6.9`, lu sans être exécuté depuis son dossier: `README.md`, `dist/instructions.js`, `dist/model-guide.js`, `dist/constants.js`, `dist/schemas/*.js`, `dist/tools/*.js`, `dist/utils/*.js`, `docs/maintenance.md`;
- **[L]** la liste des outils servie par ce serveur (`tools/list`, 28 outils, schémas complets);
- **[C]** le `CHANGELOG.md` du dépôt `meshy-dev/meshy-mcp-server` (raw.githubusercontent.com, lu le 2026-11-07);
- **[E]** l'essai du 2026-11-07: tâches réelles sur le compte du client (section 14);
- **[D]** les doublures de l'essai: fichiers fabriqués ici pour éprouver nos scripts avant l'ouverture du réseau (section 14.6), pas des sorties de Meshy;
- **[M]** la documentation de Meshy (`docs.meshy.ai`, versions Markdown des pages, lues le 2026-11-07 après l'ouverture de l'hôte): tarifs, limites de débit, conservation, rig, animation, licence (page de tarifs de l'application web);
- **[W]** une recherche web: résumés de pages du centre d'aide (`help.meshy.ai`), non relues directement.

## En bref

1. **Ce que c'est**: un service en ligne qui fait un modèle 3D à partir d'un texte ou d'une ou plusieurs images, le texture, le rigge, l'anime (bibliothèque de 678 actions, mouvement d'après un texte), le convertit et fait aussi des images 2D. 28 outils [L], dont 5 pour l'impression 3D et 1 pour des produits physiques, qui ne nous servent pas.
2. **Pour nos jeux, l'outil clé est la topologie intelligente** (`model_type: "smart-topology"`, modèles `meshy-t2` et `meshy-t2.5`): un maillage en triangles, en pièces séparées, fait directement au nombre de faces demandé, de 100 à 30 000, pour 5 crédits [P]. Tous les plafonds de la technique (C8: 100 triangles pour un carton, 4 000 pour la machine, 5 000 pour un personnage) tiennent dedans.
3. **Les textures de Meshy ne vont pas dans le jeu**: une texture de 2048 px par modèle casserait le groupement des meubles (un matériau commun, `BatchedMesh`) et la mémoire (22 Mo par modèle avec ses mipmaps, pour 128 Mo par adresse). Notre script lit la texture, donne à chaque face une case de la palette de la bible, puis la jette (règle 2 de la bible, 13.3).
4. **Chaîne retenue**: référence du directeur artistique, image vers 3D en topologie intelligente (15 crédits) ou aperçu de texte vers 3D (5 crédits), choix sur captures, mise en conformité par script Blender (échelle, repère, palette, budget, occlusion), contrôles automatiques, revue visuelle, intégration (section 9).
5. **Par famille** (bible, 13.2): Meshy pour les meubles organiques, plantes, décoration, nourriture, l'esquisse des machines, les coiffures et accessoires des personnages; Blender scripté pour les coques, comptoirs, tables, vaisselle, corps et squelette des personnages, mains, clips (section 10).
6. **Essai**: 62 crédits sur 100 (7 tâches); machine à expresso et client par texte puis par les images de référence du directeur artistique, deux rigs, quatre animations. Machine retenue: la route image (deux groupes, cuivre), conformée à **1 358 triangles, 135 Ko**; client conformé à **3 960 triangles, 24 os, 5 clips, 624 Ko**; validateur et contrôle automatique sans faute. Défauts réels notés pour l'artiste 3D (section 14).
7. **Réseau**: `assets.meshy.ai` (tous les fichiers produits) et `docs.meshy.ai` ont été ouverts par le client le 2026-11-07; sans le premier, Meshy ne sert à rien ici.
8. **Vérifié par l'essai**: crédits exacts; durées de 7 à 85 s; triangles à 2 % de la demande sauf quand la référence est simple (60 %); `auto_size` inutilisable comme cote; maillages ouverts; **deux rigs de Meshy ont le même squelette de 24 os**, donc les clips achetés se partagent entre personnages de Meshy (section 4.2).
9. **Scripts du studio éprouvés sur les vraies sorties**: mise en conformité d'un accessoire (pièces retirées, trous bouchés, palette, cote, occlusion) et d'un personnage (fusion des clips de plusieurs fichiers, taille, palette), contrôle automatique, captures en vue subjective et sous quatre angles en gris.
10. **Crédits**: environ 3 600 pour la version 1 de Cosy Café, marge de 30 % comprise, soit 1,2 mois de crédits (3 058 par mois); les crédits mensuels expirent chaque mois, il vaut mieux produire régulièrement (section 13).
11. **Licence**: offres payantes (Pro à Enterprise): licence privée, usage commercial complet, « You own the output » [M]; une clé d'API exige au moins l'offre Pro [P].
12. **Deux désaccords avec la bible** (section 16): choisir la couleur par pièce plutôt que face par face (mesuré: 14,5 % de la surface en taches sinon), et ne pas versionner les sorties brutes (consigne du manager).

## 1. Accès dans le studio

### 1.1 Trois façons d'appeler Meshy

| Voie | Pour qui | Comment | Remarque |
|---|---|---|---|
| Outils `mcp__meshy__*` | session principale (manager) | chargés au démarrage d'une session par `.mcp.json` | les fiches des membres interdisent tous les outils MCP (`disallowedTools: ... mcp__*`): un membre ne les voit pas |
| Script client du serveur MCP | membres (artiste-3d, tech-artist, directeur-artistique) | `node docs/production/essais-meshy/scripts/meshy-mcp.mjs <dossier hors dépôt> <outil> '<arguments JSON>' <journal.jsonl>` | même serveur, mêmes contrôles avant envoi (le serveur refuse les combinaisons impossibles sans rien facturer), un journal de chaque appel pour la fiche de génération; vérifié [E] |
| API REST | dépannage | `https://api.meshy.ai/openapi/...`, en-tête `Authorization: Bearer proxy-injected` | pas de contrôle avant envoi: à éviter pour créer des tâches |

Le serveur écrit ses téléchargements dans `meshy_output/` sous son dossier courant (ignoré par git) [P]. Il charge aussi un fichier `.env` de ce dossier s'il en trouve un (bibliothèque `dotenv`, message `injected env (0) from .env` au démarrage) [E]: jamais de `.env` dans le dossier de travail.

### 1.2 Clé et réseau

La clé du client est un secret réseau de l'environnement cloud: le proxy remplace l'en-tête `Authorization` des requêtes vers `api.meshy.ai`. On donne `MESHY_API_KEY=proxy-injected` au serveur; on ne cherche, n'affiche ni n'écrit jamais la clé.

| Hôte | Sert à | État le 2026-11-07 [E] |
|---|---|---|
| `api.meshy.ai` | toutes les commandes (créer, suivre, lister, solde) | ouvert, clé injectée |
| `assets.meshy.ai` | **tous les fichiers produits**: modèles, textures, vignettes, rigs, animations (liens signés) | refusé jusqu'au 2026-11-07 au soir, **ouvert** depuis par le client |
| `cdn.meshy.ai` | aperçus animés (GIF) de la bibliothèque d'actions | refusé |
| `docs.meshy.ai` | documentation (pages en Markdown: ajouter `.md` à l'adresse) | ouvert depuis le 2026-11-07 au soir (par `curl`; l'outil WebFetch ne passe pas par le proxy) |
| `help.meshy.ai` | centre d'aide | refusé |
| `raw.githubusercontent.com`, `registry.npmjs.org` | dépôt et paquet du serveur | ouverts |

### 1.3 Comportements vérifiés ou documentés

- Une tâche de création rend un identifiant; on attend avec `meshy_get_task_status` (5 min au plus par appel, la tâche continue au-delà), puis on télécharge [P].
- Le serveur ne renvoie jamais une création après une erreur réseau ou un 5xx (pas de double facturation): en cas de doute, chercher la tâche avec `meshy_list_tasks` avant de recréer [P][C].
- Une tâche échouée est remboursée; une tâche en attente peut être supprimée et remboursée; une tâche en cours ne s'arrête pas; supprimer une tâche finie efface ses fichiers, sans remboursement, sur confirmation [P].
- Les tâches créées par l'API n'apparaissent pas dans l'application web de Meshy [P].
- `meshy_list_usage` (crédits par tâche) est réservé aux équipes Studio et Enterprise: 403 sur le compte du client [E]. Le suivi se fait par le solde avant et après, et le champ `consumed_credits` de chaque tâche, exact dans l'essai [E].
- Le compte contient trois tâches antérieures à l'essai (un personnage « blocky », créées le 2026-11-03), faites hors du studio: ne pas y toucher.

## 2. Inventaire des 28 outils

Crédits d'après [P] (prix de l'API au 2026-10-12, page `docs.meshy.ai/en/api/pricing` citée par le paquet); durées mesurées [E] ou annoncées par le serveur [P].

### 2.1 Génération 3D

| Outil | Ce qu'il fait | Paramètres qui comptent pour nous | Crédits | Durée |
|---|---|---|---|---|
| `meshy_text_to_3d` | aperçu **sans texture** d'après un texte (800 caractères au plus) | `ai_model` et `model_type` (section 3), `target_polycount`, `topology` (triangles seuls en topologie intelligente), `pose_mode`, `auto_size` et `origin_at`, `target_formats` | 5 (`meshy-t2`, `meshy-t2.5`, `meshy-6-lite`), 20 (`meshy-7.1`, `meshy-6`); +5 en géométrie Ultra | 25 et 41 s mesurées en `meshy-t2.5` [E] |
| `meshy_text_to_3d_refine` | texture un aperçu réussi, dans son maillage; garde le modèle de l'aperçu | `texture_prompt` ou `texture_image_url`, `enable_pbr`, `texture_resolution` | 10 (15 en 8K) | 2 à 3 min annoncées |
| `meshy_image_to_3d` | modèle **texturé en une tâche** d'après une image (fichier local encodé par le serveur, adresse publique, ou image d'une tâche d'images) | `texture_model`: `meshy-n1` (couleur de base 2K d'après l'image), `meshy-7` (PBR, jusqu'à 8K), `meshy-6-lite`; `should_texture: false` pour un maillage nu; `pose_mode` | maillage 5 (t2, t2.5, 6-lite) ou 20 (7.1, 6), plus 10 pour la texture (15 en 8K) | 29 s (machine) et 85 s (client) [E] |
| `meshy_multi_image_to_3d` | modèle d'après 1 à 4 vues du même objet; **pas de topologie intelligente** | `texture_image_urls` (vues qui pilotent la texture), `should_remesh` et `target_polycount` pour le budget | comme l'image seule, sans t2 | 2 à 3 min annoncées |

### 2.2 Retouches, rig et animation

| Outil | Ce qu'il fait | Paramètres | Crédits | Durée |
|---|---|---|---|---|
| `meshy_remesh` | refait le maillage: nombre de faces (100 à 300 000) ou quadrilatères | `target_polycount`, `topology`, `decimation_mode` | 5 | 1 à 2 min |
| `meshy_retexture` | nouvelle texture sur un modèle existant (tâche ou fichier) | une seule entrée de style: `text_style_prompt`, `image_style_url` ou `multiview_image_urls` (1 à 4 vues du même objet); `ai_model` `meshy-7`, `meshy-6`, `meshy-6-lite` ou `meshy-n1`; `enable_original_uv` | 10 (15 en 8K) | 2 à 3 min |
| `meshy_rig` | squelette humanoïde automatique, plus **marche et course offertes** (fichiers à part) | `input_task_id` ou `model_url` (GLB tourné vers +Z, 300 000 faces au plus), `height_meters` (1,7 par défaut) | 5 | 6,5 et 7,2 s [E] |
| `meshy_animate` | applique une action de la bibliothèque, **jusqu'à 10 actions dans un seul fichier** (un clip par action), ou un mouvement généré | `action_id`, `action_ids`, `motion_task_id`; `post_process`: `change_fps` (24, 25, 30, 60), `fbx2usdz`, `extract_armature` (squelette seul) | 3 par action | 15,5 s pour 4 actions [E] |
| `meshy_text_to_motion` | clip de mouvement d'après un texte (400 caractères, 2 à 10 s par pas de 0,5 s), pour un bipède riggé; gardé 3 jours | `mode`: `prime` (FBX) ou `swift` (BVH) | 10 ou 3, plus 3 pour l'appliquer (l'animation se paie 3 par action [M]) | 10 à 30 s |
| `meshy_list_animations` | cherche dans la bibliothèque d'actions | `search`, `category`, `sub_category` | 0 | immédiat |

Bibliothèque relevée le 2026-11-07 [E]: **678 actions** en 5 catégories (marche et course 176, mouvements du corps 158, vie quotidienne 157, combat 154, danse 33), dont 90 variantes « sur place » (clé finissant par `_inplace`). Utiles pour un café: `0` Idle, `11`, `12`, `243` à `254`, `599` (autres attentes debout); `32` et `33` assis sur une chaise (idle); `57` debout vers assis, `52` et `53` assis vers debout, `60` marcher puis s'asseoir; `342` boire debout, `343` boire assis; `56` discuter debout; `307` répondre assis; `28`, `290` saluer de la main; `34` « Checkout Gesture » (sens à voir sur l'aperçu); `41` révérence; `47` écouter; `308` à `314` parler; `317` hausser les épaules; `285` à `289` ouvrir une porte; `268` s'assoupir assis; `613` marche tranquille sur place; `692` marche sur place; `676` marcher en lisant son téléphone, sur place; `611` porter une charge lourde, sur place; `43` et `635` marcher avec un sac à main. **Absents**: verser, servir, essuyer, manger, lire un journal, taper sur un ordinateur, tendre un objet: texte vers mouvement ou Blender.

### 2.3 Conversion

| Outil | Ce qu'il fait | Crédits | Durée |
|---|---|---|---|
| `meshy_convert` | autres formats: GLB, FBX, OBJ, USDZ, BLEND, STL, 3MF | 1 | 10 à 30 s |
| `meshy_resize` | taille réelle: hauteur, plus grand côté, ou estimée par l'IA; origine en bas ou au centre | 1 | 10 à 30 s |
| `meshy_uv_unwrap` | dépliage UV propre, GLB de 40 000 faces au plus, matériau gris | 5 | 2 min environ |

### 2.4 Images 2D

| Outil | Ce qu'il fait | Paramètres | Crédits |
|---|---|---|---|
| `meshy_text_to_image` | image d'après un texte (30 s environ): concept à valider avant la 3D, ou vues de face, de côté et de dos | `ai_model` (`nano-banana` 3, `nano-banana-2` 6, `nano-banana-2-lite` 3, `nano-banana-2-1` 4, `nano-banana-pro` 9, modèles GPT Image 9), `generate_multi_view`, `pose_mode`, `aspect_ratio`, `remove_background` (fond transparent) | 3 à 9 |
| `meshy_image_to_image` | retouche ou changement de style d'après 1 à 5 images | mêmes modèles, `input_task_id` | 3 à 12 |

Pour l'artiste 2D: ce sont des générateurs d'images généralistes (modèles d'autres éditeurs servis par Meshy). Ils peuvent servir de concepts pour la 3D; pour les sprites, icônes et planches 2D, la chaîne du studio reste celle de l'artiste 2D.

### 2.5 Tâches et compte (gratuits)

`meshy_get_task_status` (attente ou lecture unique), `meshy_list_tasks` (5 types par défaut: passer `task_types` pour les rigs, animations, mouvements, retouches), `meshy_cancel_task`, `meshy_download_model` (un seul format par appel; textures à part; pour un rig ou une animation, rend seulement les adresses), `meshy_list_models`, `meshy_check_balance` (solde, part mensuelle et date de remise à zéro, part permanente), `meshy_list_usage` (refusé chez nous) [P][E].

### 2.6 Ce qui ne nous sert pas

- **Impression 3D** (`meshy_send_to_slicer` et `meshy_analyze_printability` gratuits; `meshy_repair_printability`, `meshy_process_multicolor`, `meshy_auto_split` à 10 crédits): préparer un modèle pour une imprimante.
- **Relief** (bas-relief imprimable, 20 crédits): dans la documentation [M], pas dans le serveur 0.6.9.
- **Creative Lab** (`meshy_creative_lab`): neuf produits physiques à partir d'une photo (figurine, porte-clés, magnet, lampe...), 36 crédits en général. Exclu par les règles de crédits (section 11).

## 3. Modèles et paramètres

### 3.1 Modèles de géométrie

| `ai_model` | Où | Maillage | Avec texture 2K ou 4K | Pour nous |
|---|---|---|---|---|
| `meshy-t2.5` (topologie intelligente) | texte (aperçu), image seule | 5 | 15 | **premier choix**: détails plus nets pour les assets de jeu, 100 à 30 000 faces (15 000 par défaut) |
| `meshy-t2` (topologie intelligente) | texte (aperçu), image seule | 5 | 15 | 100 à 15 000 faces (4 000 par défaut); plus rapide; Meshy le conseille pour « beaucoup d'objets de décor » |
| `meshy-6-lite` | partout | 5 | 15 (2K seulement) | brouillons à bas prix, et l'image à plusieurs vues au plus juste prix |
| `meshy-7.1` (`latest`) | partout | 20 | 30 (+5 en 8K, +5 en géométrie Ultra) | modèle détaillé de rendu: trop lourd pour nous, et à ne jamais ramener à notre budget par remaillage (Meshy le déconseille aussi) |
| `meshy-6` | partout | 20 | 30 | son modèle de texture retire l'éclairage peint (`remove_lighting`), comme `meshy-7.1` en image à plusieurs vues |

Retirés: `meshy-5` (2026-10-10), Meshy T1 et `model_type: "lowpoly"` (2026-10-30) [C]. `latest` désigne Meshy 7.1 en génération, mais Meshy 7 en retexture [P]: toujours écrire un modèle explicite dans la fiche.

### 3.2 Topologie intelligente

- Maillage fait **directement** au nombre de faces demandé (`target_polycount`), **en triangles**, **en pièces séparées** (corps, poignées, buse...), sans passe de remaillage; `should_remesh`, `decimation_mode` et `geometry_resolution` sont sans effet ou refusés avec elle [P].
- Disponible en texte vers 3D (aperçu) et en image seule vers 3D; **pas** en image à plusieurs vues [P].
- Le serveur refuse un plafond hors bornes avant tout envoi (aucun crédit pris) [P].
- Le nombre réel de faces n'est pas rendu dans l'état de la tâche: mesuré sur les fichiers, de 3 945 à 5 099 pour 4 000 et 5 000 demandés, mais 2 399 pour 4 000 sur une référence simple (section 4.1) [E].

### 3.3 Textures

- `texture_model` choisi à part de la géométrie, au même prix: `meshy-n1` fait une couleur de base 2K **d'après l'image d'entrée** (ni texte de texture, ni PBR, ni 4K), `meshy-7` fait du PBR jusqu'en 8K, `meshy-6-lite` du 2K [P]. Constaté: une tâche d'image en `meshy-n1` rend `texture_0.png`, couleur de base seule [E].
- `enable_pbr` ajoute métal, rugosité et normales (4K au plus, pas d'émission) [P]. **Nous n'en voulons pas** (bible, 6: aucune carte de normales, aucun matériau réaliste).
- `remove_lighting` retire reflets et ombres peints de la couleur de base: modèle de texture Meshy 6 (image seule, affinage, retexture), et aussi `meshy-7.1` en image à plusieurs vues; jamais avec `meshy-n1` ni `meshy-6-lite` [P]. Intéressant pour le choix des couleurs de palette, mais hors topologie intelligente: à essayer seulement si l'éclairage peint gêne malgré le vote par pièce.
- Retexture: une seule entrée de style par appel; avec un modèle de Meshy, ses UV sont gardés par défaut [P].
- Pour nos jeux, la texture ne sert qu'à choisir les couleurs de palette (section 9, étape 5): **2K par défaut, jamais 4K ni 8K, jamais de PBR**.

### 3.4 Pose, symétrie, taille, formats

- `pose_mode`: `t-pose` ou `a-pose`; la pose en T est conseillée pour le rig [P].
- `symmetry_mode`: **sans effet depuis le 2026-05-11** (changement de l'API) [P]. La symétrie se rétablit dans Blender (`symmetrize` de notre script).
- `auto_size` estime par l'IA la hauteur réelle et `origin_at` pose l'origine en bas ou au centre [P]; `meshy_resize` fait de même pour 1 crédit. Une estimation: les cotes du catalogue s'appliquent dans Blender (section 9, étape 5).
- Formats: tous sauf 3MF par défaut; demander seulement `["glb"]` (plus rapide) [P].

### 3.5 Choix conseillés par Meshy

Guide officiel « choisir par projet » repris par le serveur [P]: personnage de jeu à rigger et animer: `meshy-t2.5` avec `target_polycount` et texture `meshy-n1`; nombreux objets de décor: `meshy-t2` et `meshy-n1`; objet vedette de rendu: `meshy-7.1` et `meshy-7`; objet réel d'après 2 à 4 photos: image à plusieurs vues `meshy-7.1`; brouillons à bas prix: `meshy-6-lite`. Les instructions du serveur ajoutent: un asset de jeu ou un budget de faces, c'est la topologie intelligente, jamais `meshy-7.1` remaillé [P][C].

## 4. Ce que contiennent les fichiers

Relevé sur les fichiers téléchargés le 2026-11-07 [E] (`docs/production/essais-meshy/modeles/` et rapports).

### 4.1 Modèles

| Tâche | Triangles demandés et obtenus | Matériaux, textures | Taille estimée (`auto_size`) | Remarques |
|---|---|---|---|---|
| 1. Machine, texte (`meshy-t2.5`) | 4 000, **3 945** | aucun matériau, aucune texture | 0,25 x 0,32 x 0,27 m (vraie: 0,76 m de large) | machine **à un seul groupe** alors que la consigne en demandait deux; formes arrondies propres; 24 pièces |
| 2. Client, texte | 5 000, **5 099** | aucun | 1,30 m de haut | pose en T correcte |
| 4. Machine, image (`meshy-n1`) | 4 000, **2 399** | un matériau, couleur de base PNG 2048 x 2048 (1,0 Mo) | 1,18 x 0,90 x 1,07 m | très fidèle à la référence (deux groupes, cuivre, trois tasses fondues sur le dessus), donc aussi plate qu'elle; la texture n'a peint que la face vue: **dos et côté droit gris** |
| 5. Client, image | 4 000, **3 960** | un matériau, PNG 2048 x 2048 (1,8 Mo) | 1,70 m | pose en T obtenue à partir d'une image bras le long du corps; sac et gobelet fondus au corps |

- Un seul nœud, un seul maillage d'un seul primitif (`geometry_0`), attributs POSITION et NORMAL (plus TEXCOORD_0 si texturé). Poids: 0,29 à 0,39 Mo sans texture, 1,1 à 2,0 Mo avec.
- **Maillages ouverts**: 29 à 317 arêtes de bord par modèle (trous). Avec notre matériau à une face, on voyait l'intérieur d'un porte-filtre: le script bouche maintenant les petits trous (317 arêtes de bord ramenées à 111 sur la machine).
- **Pièces**: « pièces séparées » ne veut pas dire « une pièce par matière »: le corps, le plateau et l'égouttoir de la machine sortent en un seul îlot (42 % cuivre, 38 % inox, 19 % acier sombre à l'aire); coloré face par face pour cette pièce.
- `auto_size` est inutilisable comme cote: 3 fois trop petit (texte), 1,5 fois trop grand (image). La cote de la fiche fait foi.
- Le nombre de faces suit la demande à 2 % près en texte et en image de personnage, mais l'image de la machine n'en a pris que 60 %: Meshy ne remplit pas le budget quand la référence est simple.

### 4.2 Rigs et animations

| Fichier | Contenu |
|---|---|
| `Character_output.glb` | personnage à peau, **24 os**, un clip d'une image (`Armature|clip0|baselayer`, pose de repos), mêmes triangles que le modèle; le rig du modèle texturé ajoute l'attribut TANGENT |
| `Animation_Walking_withSkin.glb` | personnage et clip `Armature|walking_man|baselayer`: 1,067 s, 30 images par seconde, **sur place** (les hanches reviennent au point de départ) |
| `..._armature.glb` | squelette, un petit maillage de 288 triangles figurant les os, et le clip: 80 à 90 Ko |
| `merged_animations.glb` (animation, 4 actions) | personnage, texture et un clip par action, **nommés d'après la bibliothèque**: `Idle` 4 s, `Chair_Sit_Idle_M` 10,7 s, `Stand_and_Drink` 8,9 s, `Sit_and_Drink` 11,2 s; 30 images par seconde; 2,5 Mo |

- Os (même liste pour les deux rigs): `Hips`, `Spine02`, `Spine01`, `Spine`, `neck`, `Head`, `head_end`, `headfront`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `RightShoulder`, `RightArm`, `RightForeArm`, `RightHand`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase`, `RightUpLeg`, `RightLeg`, `RightFoot`, `RightToeBase`. **Aucun doigt.** Nœud `Armature` à l'échelle 0,01 (héritage du FBX, en centimètres).
- Chaque clip porte translation, rotation et échelle pour 22 os (les deux bouts de tête n'en ont pas); seule la translation des hanches bouge (5 à 6,5 cm de balancement dans la marche), les autres translations sont les longueurs de repos du personnage source.
- Les deux rigs ont **le même squelette** (noms et hiérarchie), mais des longueurs d'os différentes (jusqu'au double pour l'épaule): un clip se partage d'un personnage à l'autre **à condition de ne pas rejouer les translations des os autres que les hanches**. Dans Blender c'est automatique (l'import met chaque pose relativement au repos: `conformite_personnage.py` fusionne ainsi des clips de fichiers différents); dans Three.js, un clip brut d'un autre personnage lui imposerait ses proportions. Rapport: `modeles/comparaison-squelettes-rigs-3-6.json`.
- Meshy compte 22 pistes animées sur 24 os, pour 30 images par seconde: 72 canaux par clip; un clip de 11 s pèse plusieurs centaines de Ko non compressé (le GLB conformé du client, 5 clips, fait 624 Ko).

## 5. Limites

| Limite | Valeur | Source |
|---|---|---|
| Texte de génération | 800 caractères (texte vers 3D, texture, retexture); 400 pour un mouvement | [P] |
| Images d'entrée | JPG, PNG, WEBP; 20 Mo par fichier local (encodé par le serveur); 1 à 4 vues, 1 à 5 références d'image | [P] |
| Modèle envoyé (retouches, rig) | 400 Mo par adresse, 100 Mo en données incluses | [P][C] |
| Rig | humanoïde bipède, tourné vers +Z; 380 000 triangles au plus par `input_task_id` (le serveur s'arrête à 300 000); la documentation écarte les maillages sans texture, mais le rig d'un aperçu sans texture a marché | [P][M][E] |
| Dépliage UV | GLB de 40 000 faces au plus | [P] |
| Débit | Pro: 20 requêtes par seconde, 10 tâches en attente ou en cours; Premium 30 tâches, Ultra 100, Studio 60; au-delà, 429 (`Rate limit exceeded` avec `Retry-After`, ou `NoMorePendingTasks` sans) | [M] |
| Conservation | 3 jours au plus, puis effacement (illimitée en Enterprise); une tâche de texte vers 3D n'a pas d'`expires_at` mais disparaît aussi au bout de 3 jours | [M], vérifié par `expires_at` [E] |
| Modération | paramètre `moderation` (défaut faux); le serveur envoie `false` | [P][W] |
| Prompt négatif | absent des outils du serveur 0.6.9: les exclusions s'écrivent dans la consigne (« no text, no logo ») | [P][L] |
| Mouvements générés | gardés 3 jours, appliqués à un bipède riggé | [P] |
| Suivi des crédits par tâche | réservé aux offres Studio et Enterprise | [P][E] |

## 6. Ce qui reste hors ligne

Meshy est un outil de production, comme Blender: il sert pendant la fabrication et jamais au jeu. Les GLB mis en conformité sont versionnés et embarqués; Duo et ses jeux n'appellent jamais Meshy (règle « hors ligne » de `CLAUDE.md`).

## 7. Licence

- **Offres payantes** (Pro, Premium, Ultra, Studio, Enterprise): licence « Private », « Yes, full commercial use », « You own the output »; offre gratuite: CC BY 4.0, usage commercial avec mention, « You own the output » [M: tableau de licence de `docs.meshy.ai/en/webapp/pricing`, et sa FAQ: « All paid plans include commercial-use rights »].
- Les droits suivent l'offre **au moment de la génération**: un modèle fait sous une offre payante garde ses droits après un passage à l'offre gratuite [W].
- Une clé d'API exige au moins l'offre Pro [P]: tout ce que le studio génère par l'API l'est sous une offre payante, donc privé et propriété du client. Le refus du suivi d'usage (réservé à Studio et Enterprise) indique une offre Pro, Premium ou Ultra [E].
- Réserve: le centre d'aide précise que la propriété vaut si les entrées ne violent pas les droits d'autrui [W]. Nos entrées sont des textes et des images du studio: aucune marque, aucun logo, aucun objet réel reconnaissable (bible, 12; règle de création originale de `CLAUDE.md`). Les conditions d'utilisation elles-mêmes (`www.meshy.ai/terms-of-use`) n'ont pas été lues.
- Règles du studio: c'est une « génération par IA avec les outils fournis par le client », source admise (`CLAUDE.md`). Ce n'est pas une ressource externe: pas de ligne obligatoire dans `CREDITS.md`; la provenance est dans la fiche de chaque asset (section 12).

## 8. Ce que Meshy fait bien et mal pour nos jeux

« Attendu » = d'après la documentation et l'usage courant; « vérifié » = mesuré sur les sorties réelles de l'essai.

| Sujet | Bien | Mal ou risqué | Notre parade | État |
|---|---|---|---|---|
| Style low poly douillet | formes arrondies et propres par texte (machine de la tâche 1); la référence du directeur artistique pilote fidèlement forme et couleurs (tâches 4 et 5) | la fidélité vaut aussi pour les défauts: une référence plate donne un modèle plat (plateau sans épaisseur, porte-filtres en boîtes); texte: hors sujet possible (un groupe au lieu de deux); maillages ouverts | référence riche, de trois quarts et de dos; consigne de la bible; reprise dans Blender pour les machines; trous bouchés par le script | vérifié [E] |
| Budgets du PC | topologie intelligente au nombre de faces voulu, en triangles, toutes nos catégories dans ses bornes | une texture par modèle: 22 Mo de mémoire en 2K avec mipmaps, un matériau par modèle (un appel de dessin chacun, adieu le groupement) | texture jetée, palette commune (un matériau, 64 x 64 px, 22 Ko avec mipmaps), occlusion en couleurs de sommets | budget de faces documenté [P]; palette vérifiée sur doublure [D] |
| Cohérence d'une série | une même image de style ou les mêmes références donnent un air de famille; la palette uniformise les couleurs | chaque génération dérive (proportions, densité); `auto_size` donne des tailles fausses (x 0,3 à x 1,5) | cote de la fiche, palette, revue sur une planche de la série | tailles vérifiées [E]; dérive attendue |
| Personnages | rig en 7 s, marche et course offertes et sur place, 678 actions, même squelette de 24 os pour tous les rigs | maillage d'un seul tenant (gobelet et sac fondus: la main boit à vide), manteau long déformé assis, aucune cible de morphose, pas de doigts, squelette différent de celui du studio | méthode de la bible: corps, squelette commun, cibles de morphose et clips dans Blender; Meshy pour coiffures et accessoires | vérifié [E] |
| Animation | bibliothèque riche pour marcher, s'asseoir, boire, saluer; variantes sur place | aucun geste de barista (verser, servir, essuyer); style de capture de mouvement réaliste, à juger contre l'animation douce de la bible | clips de Meshy pour explorer et servir de référence; clips livrés dans Blender (bible, 13.2) | bibliothèque relevée [E] |
| Précision des dimensions | `auto_size` donne un ordre de grandeur | estimation par l'IA, proportions parfois fausses (profondeur, hauteur d'assise) | cote réelle de la fiche (catalogue `meubles.json`) appliquée par script; contrôle automatique à 2 % près | script vérifié [D] |
| Réseau du studio | API, fichiers et documentation ouverts | fichiers effacés après 3 jours | télécharger dans la journée | vérifié [E] |

## 9. La chaîne de fabrication du studio avec Meshy

| # | Étape | Rôle | Entrées | Sorties | Contrôle avant l'étape suivante |
|---|---|---|---|---|---|
| 0 | Brief | manager | liste d'assets, **budget de crédits** | brief de mission | solde relevé |
| 1 | Référence et consigne | directeur-artistique | bible, palette, cotes du catalogue | image de référence (fond uni, trois quarts, un objet), consigne et exclusions, cases de palette permises, cote réelle | la référence respecte la palette et la structure des valeurs |
| 2 | Génération, aperçu le moins cher d'abord | artiste-3d | référence ou consigne | image vers 3D en `meshy-t2.5` ou `meshy-t2` avec `meshy-n1` (15 crédits), ou aperçu de texte vers 3D (5 crédits) puis affinage (10); jamais 4K, 8K, PBR ni géométrie Ultra sans raison écrite | téléchargement **dans la journée** (liens de 72 h) |
| 3 | Choix | artiste-3d, puis directeur-artistique | sorties brutes | planche de quatre angles en gris (`capture.mjs`, `orbit`), une ou deux variantes au plus par asset | silhouette lisible, pièces utiles séparées |
| 4 | Finition chez Meshy (personnages seulement) | artiste-3d | modèle choisi | rig (5), actions de la bibliothèque (3 chacune, un seul fichier de 10 au plus), mouvement d'après un texte pour explorer | regarder le rig avant de payer les clips |
| 5 | Mise en conformité dans Blender | artiste-3d, avec les scripts du tech-artist | sortie brute, fiche | GLB du studio: décimation si besoin, faces retournées réorientées, couleurs de palette, avant vers +Z, échelle réelle, origine au centre de l'emprise au sol, dessous retiré, symétrie et chanfrein sur demande, normales lissées sous un angle, occlusion en couleurs de sommets, nom de la bible (`station_`, `furn_`, `deco_`, `food_`, `char_`); pour les machines: pièces utiles au jeu séparées et douilles (`socket_<nom>`) posées à la main | rapport: budget, pièces mêlées, pièces de moins de 1 cm, pièces qui flottent |
| 6 | Contrôles automatiques | tech-artist (CI) | GLB et fiche | `verifier_asset.py`: triangles, matériau commun, texture de palette seule, attributs, cote réelle, pivot, noms, clips, fiche complète; validateur glTF sans erreur | tout à OK |
| 7 | Revue visuelle | directeur-artistique | captures | vue subjective à 1366 x 768 avec le repère de 1,80 m, quatre angles en couleur et en gris, liste « détails de construction » | refus si un point manque (règle 6 de la bible) |
| 8 | Intégration | dev-gameplay-3d | GLB, douilles, extras | asset dans le catalogue (`meubles.json`), `BatchedMesh` | mesure de la pire vue (`renderer.info`) |

Consigne de départ de la bible (13.3), pour la route texte et les textures `meshy-7`: « stylized low poly, rounded chamfered edges, flat matte colors, no texture detail, cozy French café, simple readable shapes ». Le serveur 0.6.9 n'a pas de prompt négatif: les exclusions (« no photorealism, no PBR, no wood grain, no scratches, no dirt, no text, no logo ») s'écrivent en fin de consigne. Sur la route image avec la texture `meshy-n1`, aucun texte n'est accepté: l'image de référence fait tout, d'où son soin (fond uni, trois quarts, un objet, couleurs de la palette, rien de posé dessus qui ne fasse partie de l'objet).

## 10. Par famille d'assets de Cosy Café

Méthode de la bible (13.2), avec la part de Meshy et ce qu'il faut surveiller. Plafonds: C8 de `technique.md` et 13.4 de la bible.

| Famille | Méthode | Ce que fait Meshy | Plafond | À surveiller |
|---|---|---|---|---|
| Coques des adresses, décor de fond | Blender scripté (plans, cuisson) | rien | 30 000 et 15 000 par vue | cotes exactes des plans: Meshy ne les tient pas |
| Comptoirs, étagères, tables, bancs, cadres, tapis, miroirs | Blender scripté | rien (au plus une forme de référence) | 150 à 1 500 | formes droites et dimensions du catalogue |
| Postes et machines (machines à 1, 2 et 3 groupes, moulins, fours, torréfacteur, caisses...) | mixte | l'esquisse (silhouette, volumes, pièces) | 4 000 (machine, torréfacteur), 2 000, 600 | pièces utiles au jeu séparées et nommées (porte-filtre, buse, levier), douilles posées dans Blender; tasses fondues dans la machine à retirer |
| Meubles organiques (fauteuil de rotin, banquette capitonnée, chaise cintrée, chaise coque, poêle) | Meshy puis conformité | tout le modèle | 600 à 2 000 | assise à 0,45 m et dessus de table à 0,75 m (cotes), une variante par style, chanfreins |
| Plantes, vases, objets de décoration | Meshy puis conformité | tout le modèle | 1 200 (plante), 250 à 600 (objet) | feuilles fines (moins de 1 cm: signalées), lisibilité en gris |
| Vaisselle et contenants | Blender scripté (révolution, 120 %) | rien | 250 | 12 pans, niveaux de liquide |
| Nourriture (viennoiseries, gâteaux, fruits) | Meshy puis conformité; Blender pour les formes simples | viennoiseries, gâteaux, fruits | 250 | taille à 120 %, couleur par face (croûte et mie sur une même pièce: `per_face_parts`) |
| Livraisons, extérieur | Blender surtout | sacs de grains, jardinières garnies au besoin | 100 à 1 200 | |
| Personnages | mixte | coiffures, chapeaux, sacs et accessoires, soudés au corps du studio | 4 000 à 5 000 de près | squelette et cibles de morphose communs (technique 4.1): un personnage entier de Meshy (essai) n'y entre pas tel quel |
| Clips | Blender sur le squelette commun | explorer (bibliothèque, texte vers mouvement) | | style d'animation de la bible |
| Mains, effets, interfaces | Blender, SVG, code | rien | | |
| Avatars des joueurs | Blender (signes permanents de la bible, 7.1) | coiffures au besoin | 5 000 | bandeau, X des bretelles et écusson exacts |

## 11. Règles d'usage des crédits

1. **Budget dans chaque brief**: le manager fixe un plafond de crédits par mission; le membre ne le dépasse jamais et s'arrête avant s'il ne peut pas finir.
2. **Solde relevé au début et à la fin** de chaque mission (`meshy_check_balance`), écrit dans le compte rendu.
3. **Chaque tâche notée**: identifiant, outil, paramètres, crédits (`consumed_credits`), dates, dans la fiche de l'asset et dans le journal du script client.
4. **L'aperçu avant l'affinage**: on regarde ce qu'on a payé avant de payer l'étape suivante (texture, rig, clips). Une seule exception: quand la référence du directeur artistique a déjà été validée, l'image vers 3D texturée vaut aperçu.
5. **Ni 8K, ni géométrie Ultra ou 4K, ni PBR** sans raison écrite dans la fiche (nos textures sont jetées). Jamais d'impression 3D ni de Creative Lab.
6. **Deux variantes au plus par asset** avant de revoir la consigne ou la référence avec le directeur artistique.
7. **Télécharger dans la journée**: un lien expire au bout de 72 h; une tâche non téléchargée est perdue.
8. **Ne jamais recréer une tâche après une erreur réseau** sans l'avoir cherchée (`meshy_list_tasks`).
9. **Rythme**: les crédits mensuels expirent chaque mois (remise à zéro le 7, à 19 h 21 UTC, d'après le solde): produire régulièrement plutôt que tout à la fin.

## 12. Ce qui se versionne: la fiche de génération

À côté de chaque asset final, un fichier `<asset>.meshy.json` (format `duo-meshy-sheet/1`, exemples dans `docs/production/essais-meshy/`):

| Champ | Contenu |
|---|---|
| `asset`, `game`, `family`, `purpose` | nom de la bible, jeu, famille, raison d'être |
| `inputs` | images d'entrée versionnées (chemin, empreinte SHA-256, auteur) |
| `tasks[]` | par tâche: étape, outil, point d'entrée, `task_id`, `parent_task_id`, paramètres exacts, graine, crédits, dates, durée, expiration des fichiers, fichiers rendus, téléchargé ou non |
| `credits_total`, `credits_budget` | somme des crédits (contrôlée par `verifier_asset.py`) et budget du brief |
| `license`, `author`, `date`, `client` | offre et propriété, auteur, date, version du serveur |
| `conformity` | réglages de la mise en conformité: nom du nœud, rotation de l'avant, cote réelle, plafond de triangles, cases permises et forcées, réglages de forme et d'occlusion, clips |
| `status`, `next_steps`, `pending` | état et suites (rien d'implicite) |

Emplacement proposé pour Cosy Café: `games/cosy-cafe/assets-src/modeles/meshy/<asset>.meshy.json` et ses images d'entrée, le GLB final dans `games/cosy-cafe/assets/modeles/`. **Les sorties brutes ne se versionnent pas** (consigne du manager; désaccord avec la bible, section 16). La sortie mise en conformité suffit pour reprendre l'asset: Blender l'ouvre, et `conformite_accessoire.py` l'accepte en entrée (sa texture de palette redonne exactement ses cases).

Palette: les cases ne bougent jamais (un modèle pointe une case par ses coordonnées de texture). `exporter-palette.mjs` garde la place de chaque couleur, ajoute les nouvelles en fin de liste et marque les retirées; l'essai l'a montré utile le jour même (le voile des vitres, ajouté au milieu de la liste de la bible, aurait décalé 31 cases sur 61).

## 13. Estimation des crédits pour la version 1 de Cosy Café

Hypothèses: liste de la bible (13.4) et sa méthode par famille (13.2); prix de la section 2; une génération ratée sur deux à reprendre. Effectifs à recaler sur le catalogue du game designer.

| Famille | Assets par Meshy | Route | Crédits par asset | Total |
|---|---|---|---|---|
| Postes et machines (esquisses) | 12 | image vers 3D `meshy-t2.5` + `meshy-n1`, reprise Blender | 25 | 300 |
| Meubles organiques | 25 | image vers 3D | 22 | 550 |
| Plantes et décoration | 24 | image ou texte | 20 | 480 |
| Nourriture | 24 | image vers 3D, petites formes | 15 | 360 |
| Extérieur et livraisons | 5 | texte ou image | 20 | 100 |
| Coiffures, chapeaux, sacs et accessoires des personnages | 37 | image vers 3D | 20 | 740 |
| Images de concept quand le directeur artistique n'a pas dessiné la référence | 60 | `nano-banana` | 3 | 180 |
| Exploration du mouvement (un rig de test, 10 mouvements « swift » appliqués) | 1 | rig, texte vers mouvement, animation | 65 | 65 |
| **Sous-total** | 188 | | | **2 775** |
| Marge de 30 % (reprises, variantes, essais ratés non remboursés) | | | | 830 |
| **Total** | | | | **3 605** |

- **Comparé aux crédits du client**: 3 058 par mois, soit 1,2 mois de crédits pour toute la version 1, à étaler de l'alpha (assets provisoires: aperçus à 5 crédits) à la bêta (assets définitifs). Il restait 3 008 crédits mensuels après l'essai, jusqu'au 2026-12-07.
- **Si l'on faisait les personnages entiers par Meshy** (contraire à la bible): 20 crédits par personnage riggé, plus 3 par clip et par squelette; pour 60 clients, habitués, employés et fournisseurs: 1 200, plus 2 160 de clips si chaque rig a son propre squelette (12 clips à 3 crédits par personnage), ou 36 en tout, puisque les rigs de Meshy partagent le même squelette (vérifié, section 14.5).
- **Variante économe**: aperçus sans texture (5 crédits) et couleurs posées à la main par pièce (`palette_overrides`), sans affinage: environ 2 000 crédits au total, marge comprise. Plus de temps d'artiste par asset.

## 14. Essai du 2026-11-07

### 14.1 Solde et tâches

- **Avant**: 3 063 crédits (3 058 mensuels jusqu'au 2026-12-07 19:21:47 UTC, 5 permanents). **Après**: 2 986 (2 981 mensuels, 5 permanents). **Dépensé par l'essai: 62 crédits** (plafond 100), relevés tâche par tâche. Les 15 autres crédits de l'écart viennent de trois aperçus de texte vers 3D lancés à 20 h 48 UTC par un autre membre (chaise paillée, plante, croissant): le solde est commun à tout le studio, d'où le compte tâche par tâche.

| # | Tâche | Outil et réglages | Crédits | Durée | Fichiers jusqu'au (UTC) |
|---|---|---|---|---|---|
| 1 | `01a1b79c-afc3-7589-b419-f472bb49b307` machine à expresso, texte | `meshy_text_to_3d`, `meshy-t2.5`, topologie intelligente, 4 000 faces, `auto_size` | 5 | 24,9 s | 2026-11-10 20:04 |
| 2 | `01a1b79d-f767-750f-a2bc-46f8a0899654` client flâneur, texte | `meshy_text_to_3d`, `meshy-t2.5`, 5 000 faces, pose en T | 5 | 40,9 s | 2026-11-10 20:06 |
| 3 | `01a1b79e-ca78-70c9-80ef-3726b55f0dd0` rig du client n° 2 | `meshy_rig`, 1,7 m, sur l'aperçu sans texture | 5 | 6,5 s | 2026-11-10 20:06 |
| 4 | `01a1b7b3-5172-7405-b35e-33b10ff359a6` machine à expresso, image | `meshy_image_to_3d`, référence `machine-expresso.png`, `meshy-t2.5`, 4 000 faces, texture `meshy-n1` | 15 | 29,2 s | 2026-11-10 20:29 |
| 5 | `01a1b7b3-6ffd-75f1-8d72-7594465c4592` client pressé, image | `meshy_image_to_3d`, référence `client-presse-face.png`, `meshy-t2.5`, 4 000 faces, `meshy-n1`, pose en T | 15 | 84,9 s | 2026-11-10 20:30 |
| 6 | `01a1b7b4-e3e0-766c-8083-24dc96bb9a5b` rig du client n° 5 | `meshy_rig`, 1,7 m | 5 | 7,2 s | 2026-11-10 20:30 |
| 7 | `01a1b7c7-08dc-769b-8f38-8bc4dda6f7ef` animations du rig n° 6 | `meshy_animate`, `action_ids` [0, 33, 342, 343] | 12 | 15,5 s | 2026-11-10 20:50 |

Fiches: `essais-meshy/machine-espresso-village.meshy.json` (tâches 1 et 4), `client-01.meshy.json` (2 et 3), `client-presse.meshy.json` (5, 6 et 7).

### 14.2 Déroulé

1. Tâches 1 à 6 lancées le soir même; téléchargement refusé (`assets.meshy.ai` fermé par le proxy, 403 au CONNECT), étape arrêtée sans contournement. Hôte ouvert par le client dans la soirée; tout a été téléchargé à 20 h 47 UTC, avant expiration.
2. Comparaison des deux machines, mise en conformité, captures; comparaison des squelettes des rigs 3 et 6; animations sur le rig 6 (tâche 7), puis personnage conformé et captures.

### 14.3 Machine à expresso: choix et résultat

- **Retenue: la route image** (tâche 4): c'est la machine de la bible (deux groupes, cuivre, égouttoir), et la texture `meshy-n1`, peinte dans la palette du directeur artistique, se convertit seule en cases de palette. La route texte (tâche 1) donne un plus beau modèle, arrondi et lisible, mais une machine domestique à un seul groupe, presque aussi haute que large: hors sujet (capture `captures/espresso-texte-quatre-angles.png`, modèle gardé en `modeles/station_espresso_texte_essai.glb`).
- Mise en conformité (`modeles/station_espresso_2g.glb`, rapport à côté): 2 399 triangles bruts, 3 tasses du dessus retirées (1 108 triangles, ce seront des objets de jeu), 23 faces du dessous retirées, petits trous bouchés, 175 faces retournées réorientées: **1 358 triangles** (plafond 4 000), 0,76 x 0,52 x 0,69 m, 5 cases de palette (cuivre, inox, acier sombre, encre, porcelaine), occlusion cuite, **134,6 Ko**, texture de palette 64 x 64 (21,8 Ko avec mipmaps). Contrôle automatique 8 sur 8, validateur 0 erreur.
- Three.js 0.187, 1366 x 768, vue de travail (yeux à 1,65 m, comptoir à 0,90 m): 1 418 triangles et 6 appels pour toute l'image, dont 1 appel et 1 358 triangles pour la machine; vue d'ensemble avec le repère de 1,80 m: 1 942 triangles, 23 appels (le reste: sol, mur, comptoir et repère de la capture); 2 programmes.
- **Défauts vus sur les captures, à reprendre dans Blender** (c'est la méthode « mixte » de la bible pour les postes): plateau du dessus fait de pans sans épaisseur avec un triangle sombre; dos et côté droit gris (la texture ne connaît que la vue de face); porte-filtres en boîtes; aucune buse ni cadran (absents de la référence). Leçon: Meshy reproduit fidèlement la référence, y compris sa pauvreté; une référence plus riche (et une vue de dos en image à plusieurs vues) vaut mieux qu'un essai de plus.

### 14.4 Client pressé: rig, clips et résultat

- `modeles/char_essai_presse.glb`: **3 960 triangles** (plafond 4 000), 24 os, 1 appel de dessin, 1,70 m, 9 cases de palette (peau, cheveux, marine, anthracite, cognac, kraft), clips `walk` 1,03 s, `idle` 4 s, `sit` 10,7 s, `drink` 8,8 s, `sit_drink` 11,2 s, **624 Ko**. Contrôle automatique 8 sur 8, validateur 0 erreur. Image dans Three.js: 4 552 triangles, 22 appels, 2 programmes.
- Les clips de deux fichiers (marche du rig, actions de l'animation) se fusionnent sans perte; la marche est déjà sur place.
- **Défauts vus sur les captures** (`captures/presse-*.png`): le gobelet et le sac, fondus au corps, ne suivent pas la main (dans `drink`, la main monte vide à la bouche); le manteau long se déforme en tente en position assise; `Idle` (action 0) se retourne et piétine: pour un client qui attend, essayer les attentes 11, 12 et 243 à 254. Ces trois défauts confirment la méthode de la bible: corps et squelette du studio, accessoires à part.

### 14.5 Squelette commun

**Vérifié**: les rigs 3 (personnage de texte, sans texture) et 6 (personnage d'image) ont les mêmes 24 os, mêmes noms, même hiérarchie; les longueurs diffèrent selon le corps. Les clips achetés pour un personnage se rejouent sur un autre (section 4.2), donc 3 crédits par action une fois pour tous les personnages de Meshy, pas par personnage. Ce squelette n'est pas celui du studio (pas de doigts, noms différents de La Petite Ligne): pour l'utiliser sur le squelette commun de la bible, il faudra un transfert de clips dans Blender (correspondance des 24 os).

### 14.6 Chaîne du studio éprouvée d'abord sur doublures [D]

Avant l'ouverture de l'hôte, les scripts ont été éprouvés sur des doublures (fausses sorties, `essais-meshy/doublure/`): machine de 1 472 triangles, personnage tiré de La Petite Ligne avec marche ramenée sur place (0,656 m d'avance, 0 après). Les vraies sorties ont demandé trois ajouts: bouchage des petits trous, retrait de pièces (`remove_parts`), couleur face par face d'une pièce mêlée.

## 15. Reprise et scripts

### 15.1 Scripts de l'essai (`docs/production/essais-meshy/scripts/`)

| Script | Rôle | Commande |
|---|---|---|
| `meshy-mcp.mjs` | client du serveur MCP: un appel d'outil, journal JSONL | `node meshy-mcp.mjs <dossier hors dépôt> <outil> '<JSON>' <journal.jsonl>`; `list-tools <sortie.json>` |
| `exporter-palette.mjs` | palette de l'essai tirée de `palette.cjs`, cases fixes | `node exporter-palette.mjs docs/jeux/cosy-cafe/bible/source/palette.cjs palette-essai.json` |
| `meshy_commun.py` | couleurs, CIEDE2000 (vérifié sur 6 paires de référence de Sharma et al., 2005), palette, pièces, choix des cases | importé par les deux suivants |
| `conformite_accessoire.py` | mise en conformité d'un accessoire | `duo-python conformite_accessoire.py <fiche> <brut.glb> <palette> <sortie.glb> <rapport.json>` |
| `conformite_personnage.py` | personnage riggé: clips fusionnés et renommés, marche sur place, taille, palette | `duo-python conformite_personnage.py <fiche> <palette> <sortie.glb> <rapport.json> <Character_output.glb> <animations.glb>...` |
| `comparer_squelettes.py` | deux squelettes égaux ou non, clips rejouables | `python3 comparer_squelettes.py <A.glb> <B.glb> [rapport.json]` |
| `verifier_asset.py` | contrôle automatique (CI, sans Blender) | `python3 verifier_asset.py <asset.glb> <fiche.json>` |
| `capture.mjs` | vue subjective ou quatre angles (couleur et gris), mesures `renderer.info` | `node capture.mjs <three@0.187.0> <config.json> <sortie.png> <mesures.json>` |
| `doublure_meshy.py`, `doublure_personnage.py` | doublures pour éprouver les scripts sans crédits | `duo-python doublure_meshy.py <sortie.glb>`; `duo-python doublure_personnage.py games/la-petite-ligne/assets/modeles/personnages.glb <dossier>` |

Prérequis: `duo-python` (Blender 5.2), Node 22, Playwright préinstallé, `three@0.187.0` et `gltf-validator` installés dans un dossier temporaire (`npm install --prefix <dossier> three@0.187.0 gltf-validator`).

### 15.2 Modèles conformés, chemins stables

| Fichier | Contenu |
|---|---|
| `docs/production/essais-meshy/modeles/station_espresso_2g.glb` | machine du village, route image, conformée (palette de l'essai, occlusion), avec son rapport |
| `docs/production/essais-meshy/modeles/station_espresso_texte_essai.glb` | variante de la route texte, couleur unique, pour comparaison |
| `docs/production/essais-meshy/modeles/char_essai_presse.glb` | client pressé, 24 os, clips `walk`, `idle`, `sit`, `drink`, `sit_drink` |
| `docs/production/essais-meshy/captures/` | vues subjectives, quatre angles en couleur et en gris, mesures `renderer.info` |

Ces modèles utilisent la palette de l'essai (`palette-essai.json`, 66 cases), pas encore la palette du jeu; leur texture de palette est embarquée dans chaque GLB. Les sorties brutes restent hors du dépôt.

## 16. Désaccords et questions

### 16.1 Avec la bible (13.1 et 13.3)

1. **Règle 2, « une couleur par face, la case la plus proche (CIEDE2000) »**: d'accord sur CIEDE2000 (c'est la mesure du script, vérifiée sur six paires de référence) et sur une seule couleur par face. Mais choisie **face par face**, la case suit l'éclairage peint dans la texture de Meshy: sur la doublure, 14,5 % de la surface prend une autre couleur que celle de sa pièce, et les groupes de la machine sortent zébrés inox et acier sombre (`capture-espresso-par-face.png`). Proposition: la case gagnante à l'aire de chaque pièce par défaut, face par face (avec lissage entre voisines) pour les pièces vraiment multicolores (croissant, personnage d'un seul tenant), et le facteur de clarté de CIEDE2000 à 2 (`kL`, prévu par la formule), pour qu'une face à l'ombre ne passe pas à la case voisine plus sombre.
2. **13.1, « dossier Meshy (consigne, images d'entrée, date, réglages, sortie brute) »**: le brief du manager dit que les sorties brutes ne se versionnent pas. Je recommande le brief: une sortie brute pèse plusieurs mégaoctets (texture 2K en PNG), 150 assets dépasseraient vite 300 Mo dans un dépôt public téléchargé à chaque clone; la fiche garde la provenance (tâches, graine, images d'entrée) et l'asset conformé se reprend sans la sortie brute (section 12). Si le directeur artistique tient à la garder, solution de repli: une copie réduite (géométrie et texture ramenée à 256 px, de 100 à 300 Ko).
3. **13.2, personnages**: pas de désaccord. Le personnage entier de Meshy (essai) ne s'accorde pas avec le squelette commun et les cibles de morphose de la technique (4.1). À juger au téléchargement: si les clips de la bibliothèque, transférés sur le squelette commun, valent comme référence pour la foule lointaine.

### 16.2 Pour le manager

- Réseau: fait (hôtes ouverts le 2026-11-07). Le solde est commun à tout le studio: chaque membre compte ses tâches dans son compte rendu, pas seulement l'écart du solde.
- Les membres n'ont pas les outils `mcp__meshy__*` (leurs fiches interdisent tout outil MCP): le script `meshy-mcp.mjs` les remplace et garde un journal; je recommande de garder cette interdiction.

## 17. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-11-07 | 0.1 | Inventaire, chaîne, familles, règles de crédits, fiche de génération, estimation, essai (50 crédits, téléchargement bloqué), scripts éprouvés sur doublures, alignement sur la bible | tech-artist |
| 2026-11-07 | 0.2 | Hôtes ouverts: sorties réelles téléchargées et mesurées (section 4), squelette commun vérifié, animations, machine et client conformés et capturés (section 14), documentation de Meshy lue (débit, conservation, rig, licence), chemins stables des modèles (15.2) | tech-artist |
| 2026-11-10 | 0.2 | Renvoi: essai « personnage modulaire » (`essais-meshy/personnage-modulaire/README.md`, 71 crédits): pièces séparées sur le squelette de 24 os, proportions imposées par le squelette, vêtements générés seuls par texte non livrables | tech-artist |
