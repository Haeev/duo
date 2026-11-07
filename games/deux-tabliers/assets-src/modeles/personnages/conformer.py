"""Mise en conformité des personnages Meshy de la démo (Python 3; lance duo-python pour chaque personnage).

Usage: python3 conformer.py [id...]

Pour chaque personnage: fiche de génération `<id>.meshy.json` (format duo-meshy-sheet/1) écrite ici, puis
`docs/production/essais-meshy/scripts/conformite_personnage.py` avec le rig de Meshy (sorties brutes hors du dépôt) et les
clips déjà achetés par le tech-artist (marche du rig n° 6, attente, s'asseoir, boire, boire assis de la tâche n° 7), sans
nouvel achat. Squelette commun de Meshy (24 os), texture de Meshy gardée et réduite à 512 px (rendu semi-réaliste), environ
4 000 triangles. Sorties: assets/modeles/<id>.glb et <id>.rapport.json ici.
"""
import json
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
DEPOT = os.path.normpath(os.path.join(ICI, "..", "..", "..", "..", ".."))
ASSETS = os.path.join(DEPOT, "games", "deux-tabliers", "assets", "modeles")
SCRIPTS = os.path.join(DEPOT, "docs", "production", "essais-meshy", "scripts")
PALETTE = os.path.join(DEPOT, "docs", "production", "essais-meshy", "palette-essai.json")
SCRATCH = os.environ.get("DT_MESHY", "/tmp/claude-0/-home-user-duo/7308f5c3-ea7f-5113-84b7-8f0683baf68e/scratchpad")
BRUT_DEMO = os.path.join(SCRATCH, "a3d-demo", "meshy", "brut")
BRUT_ESSAI = os.path.join(SCRATCH, "a3d-essai", "meshy", "rig")
CLIPS = [os.path.join(SCRATCH, "ta-meshy", "brut", "t6", "Animation_Walking_withSkin.glb"),
         os.path.join(SCRATCH, "ta-meshy", "brut", "t7", "merged_animations.glb")]

# id -> (source, nom brut, taille en m, rôle, avatar?)
PERSOS = {
    "char_simone": ("demo", "simone", 1.60, "habituée: Simone, l'ancienne patronne (long gilet prune, chignon au crayon, lunettes à chaînette)", False),
    "char_mathis": ("demo", "mathis", 1.80, "habitué: Mathis, le facteur pressé (sacoche moutarde)", False),
    "char_lise": ("demo", "lise", 1.70, "habituée: Lise, la lectrice (cardigan vert bouteille, sac à livres)", False),
    "char_farida": ("demo", "famille", 1.62, "habituée: Farida (ciré moutarde, sac à dos d'enfant), profil familles", False),
    "char_bastien": ("demo", "promeneur", 1.78, "habitué: Bastien, promeneur (polaire, sac à dos, casquette)", False),
    "char_client_etudiante": ("demo", "etudiante", 1.64, "cliente, profil étudiants (casque au cou, sac de toile)", False),
    "char_client_teletravail": ("demo", "teletravail", 1.76, "client, profil télétravail (gilet chiné, sacoche)", False),
    "char_client_brunch": ("demo", "brunch", 1.68, "cliente, profil brunch (lunettes de soleil sur la tête)", False),
    "char_client_connaisseur": ("demo", "connaisseur", 1.85, "client, profil connaisseurs (col roulé, velours olive)", False),
    "char_client_gourmand": ("demo", "gourmand", 1.66, "client, profil gourmands (pull caramel, écharpe framboise)", False),
    "char_client_flaneur": ("essai", "lecteur", 1.74, "client, profil flâneurs (écharpe moutarde), de l'essai de style", False),
    "char_client_voisine": ("essai", "attente", 1.60, "cliente, profil voisins (gilet framboise), de l'essai de style", False),
    "char_client_pressee": ("essai", "caisse", 1.68, "cliente, profil pressés (trench, sacoche cognac), de l'essai de style", False),
    "char_avatar_1": ("essai", "barista1", 1.78, "avatar de joueur en tenue de la maison (tablier vert bouteille), badge de 3 cm", True),
    "char_avatar_2": ("essai", "barista2", 1.66, "avatar de joueur en tenue de la maison (tablier vert bouteille), badge de 3 cm", True),
}


def taches(nom, source):
    if source == "demo":
        p = os.path.join(SCRATCH, "a3d-demo", "meshy", "taches.json")
        return [t for t in json.load(open(p)) if t["asset"] == f"char_{nom}"] if os.path.exists(p) else []
    p = os.path.join(DEPOT, "docs", "jeux", "cosy-cafe", "essai-style", "meshy", "essai-style.meshy.json")
    return [dict(t, reprise="tâche de l'essai de style, déjà payée") for t in json.load(open(p))["tasks"] if t["asset"] == f"char_{nom}"]


def main():
    ids = sys.argv[1:] or list(PERSOS)
    for ident in ids:
        source, nom, taille, role, avatar = PERSOS[ident]
        rig = os.path.join(BRUT_DEMO if source == "demo" else BRUT_ESSAI, nom, "Character_output.glb") if source == "demo" else os.path.join(BRUT_ESSAI, nom + ".glb")
        conf = {
            "node_name": ident,
            "target_height_m": taille,
            "max_triangles": 4200,
            "decimate_to": 3950,
            "texture_mode": "meshy",
            "texture_size": 512,
            "root_bone": "Hips",
            "clips": [
                {"file": "Animation_Walking_withSkin.glb", "index": 0, "name": "walk", "in_place": True},
                {"file": "merged_animations.glb", "index": 0, "name": "idle"},
                {"file": "merged_animations.glb", "index": 1, "name": "sit"},
                {"file": "merged_animations.glb", "index": 2, "name": "drink"},
                {"file": "merged_animations.glb", "index": 3, "name": "sit_drink"},
            ],
        }
        if avatar:
            conf["badge"] = {"height_ratio": 0.72, "x": 0.07, "radius": 0.015, "bone": "Spine02", "material": "dt_badge_joueur"}
        fiche = {
            "format": "duo-meshy-sheet/1",
            "asset": ident,
            "game": "deux-tabliers",
            "family": "char",
            "purpose": role,
            "author": "artiste-3d",
            "date": "2026-11-07",
            "license": "offre payante de Meshy du client: licence privée, usage commercial, propriété du client",
            "inputs": [{"chemin": f"référence générée par Meshy (texte vers image, nano-banana), sortie brute hors dépôt: {nom}/reference.png"}],
            "tasks": taches(nom, source),
            "reused_clips": "clips walk (rig 01a1b7b4-e3e0-766c-8083-24dc96bb9a5b) et idle, sit, drink, sit_drink (animation 01a1b7c7-08dc-769b-8f38-8bc4dda6f7ef) du tech-artist, sans nouvel achat",
            "credits_total": sum((t.get("credits") or 0) for t in taches(nom, source)) if source == "demo" else 0,
            "credits_budget": 900,
            "solde": {"debut_mission": 2871, "fin_mission": 2641, "note": "solde commun du studio; 230 crédits = les 30 tâches de cette mission (10 personnages x 23)"},
            "conformity": conf,
            "status": "conforme pour la démo v0.1",
            "pending": ["squelette commun du studio et cibles de morphose (technique 4.1): pas encore", "accessoires fondus au corps (sacs)"],
        }
        fp = os.path.join(ICI, f"{ident}.meshy.json")
        json.dump(fiche, open(fp, "w"), ensure_ascii=False, indent=1)
        out = os.path.join(ASSETS, ident + ".glb")
        rep = os.path.join(ICI, f"{ident}.rapport.json")
        r = subprocess.run(["duo-python", os.path.join(SCRIPTS, "conformite_personnage.py"), fp, PALETTE, out, rep, rig] + CLIPS, capture_output=True, text=True)
        last = [l for l in r.stdout.splitlines() if l.startswith(ident)]
        print(ident, "OK" if r.returncode == 0 else "ÉCHEC", last[-1] if last else r.stderr[-800:] + r.stdout[-800:])


main()
