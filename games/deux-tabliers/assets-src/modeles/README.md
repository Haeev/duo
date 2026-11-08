# Deux Tabliers: sources des modèles 3D (démo v0.1)

Modèles du café d'Ormeval en rendu semi-réaliste (variante B de l'essai de style, choisie par le client le 2026-11-07). Les GLB sont dans `../../assets/modeles/`, avec leur fiche commune `modeles.json` (dimensions, triangles, assises, dessus, douilles, matériaux, écarts au catalogue).

## Ce qu'il y a

| Famille | Script | Sorties |
|---|---|---|
| Coque d'Ormeval, pièce du fond, rue, lumière cuite | `coque.py` (reprend `lib/scene_coque.py`, copie adaptée de l'essai) | `shell_village.glb`, `shell_village_ext_fond.glb`, `textures/shell_village_lightmap.png`, textures des murs et sols |
| Meubles et décorations du catalogue (`catalogue.json` de la démo) | `meubles.py` | un GLB par identifiant du catalogue |
| Postes, équipements, vaisselle, nourriture, cartons, terrasse (store), objets uniques et d'événements | `objets.py` | un GLB par identifiant |
| Personnages Meshy (15) | `personnages/conformer.py` (appelle `docs/production/essais-meshy/scripts/conformite_personnage.py`) | `char_*.glb`, fiches `personnages/<id>.meshy.json` et rapports |
| Mises en place par défaut et contrôle des assises | `dispositions.py` | `assets/modeles/dispositions/*.json` |
| Fiche commune | `modeles_json.py` | `assets/modeles/modeles.json` |

Bibliothèque: `lib/commun.py` (atlas des meubles, matériaux, UV, occlusion cuite, export GLB à textures externes), `lib/catalogue.py` (construction d'un lot, export, fiches), `lib/geo.py` et `lib/textures.py` (repris de l'essai).

## Conventions

- Repère des plans: x vers l'est, y vers le sud, z en haut; dans le GLB, x = x, Y en haut, z = y du plan. Avant des modèles vers +Z glTF (le sud du plan): côté où l'on s'assoit, où l'on travaille, ou face vue. Une chaise tournée de `rotation_deg` regarde (sin r, 0, cos r).
- Pivots: au sol, centre de l'emprise; objets muraux au dos, au milieu du bas; suspensions au point d'accroche du plafond; coques en coordonnées du plan (aucune transformation).
- Un matériau partagé pour tous les meubles et objets: `dt_meubles` (atlas 2048 de 4 x 4 tuiles: palette de la bible et quinze matières teintées générées par script; carte rugosité et métal au même plan), occlusion cuite dans les couleurs de sommets. Les GLB référencent l'atlas en fichier externe (`textures/`), un seul exemplaire sur le disque. Toute case de palette utilisée doit être dans `CASES_FIXES` (l'atlas est partagé par plusieurs scripts; une case inconnue arrête la construction).
- Vaisselle et nourriture à 120 %; budgets de triangles C8 de `docs/jeux/cosy-cafe/technique.md`.

## Régénérer

```
duo-python games/deux-tabliers/assets-src/modeles/coque.py            # 3 min environ (cuisson 2048 px, 64 échantillons)
duo-python games/deux-tabliers/assets-src/modeles/meubles.py          # 10 s
duo-python games/deux-tabliers/assets-src/modeles/objets.py           # 10 s (lancer après meubles.py: il importe ses fonctions)
python3 games/deux-tabliers/assets-src/modeles/personnages/conformer.py   # 15 x 20 s; sorties brutes de Meshy requises (hors dépôt)
duo-python games/deux-tabliers/assets-src/modeles/personnages/doigts.py    # 4 min; os des doigts et poses de main, après conformer.py
python3 games/deux-tabliers/assets-src/modeles/dispositions.py        # contrôle des assises, code 1 en cas d'erreur
python3 games/deux-tabliers/assets-src/modeles/modeles_json.py
```

Contrôles: `verifier/valider.cjs` (gltf-validator, images externes comprises), `verifier/inspecter_glb.py`, `verifier/mains.py` (clips intacts, prises sans traversée, gros plans des mains), `verifier/planche.py` (planche Cycles avec mannequin de 1,80 m), `verifier/vue/` (visionneuse Three.js 0.187 et `capturer.mjs` sous Chromium: coque cuite, dispositions, personnages, vue de dessus).

Les sorties brutes de Meshy (références, modèles, rigs) ne sont pas versionnées; leurs tâches, crédits et réglages sont dans les fiches `personnages/*.meshy.json`. Les liens de Meshy expirent trois jours après la génération (le 2026-11-10).
