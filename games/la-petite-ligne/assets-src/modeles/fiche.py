"""Tables de la fiche des modèles (nœuds, emprises, triangles, poids), lues dans stats/*.json.

Lancer: python3 fiche.py > tables.md (recopier dans assets/modeles/README.md); écrit aussi assets/modeles/index.json
"""
import json
import os

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "..", "assets", "modeles")


def ko(n):
    return f"{n / 1024:.0f} Ko"


def index():
    """Écrit assets/modeles/index.json: nœud racine -> fichier, emprise, triangles."""
    out = {}
    for f in ("personnages", "ferme", "bourg", "train", "maison", "faune", "poissons", "elevage", "marche", "foret013", "village013"):
        st = json.load(open(os.path.join(ICI, "stats", f + ".json"), encoding="utf-8"))
        if f == "personnages":
            for k, v in st["meshes"].items():
                out[k] = {"file": "personnages.glb", "tris": v}
            out["rig"] = {"file": "personnages.glb", "animations": [a["name"] for a in st["animations"]]}
            continue
        for k, v in st["nodes"].items():
            e = {"file": f + ".glb", "tris": v["tris"]}
            if "footprint" in v:
                e["footprint"] = v["footprint"]
            for kk in ("alias_of", "states", "variants"):
                if kk in v:
                    e[kk] = v[kk]
            if isinstance(st.get("animations"), dict) and k in st["animations"]:
                e["animations"] = [a["name"] for a in st["animations"][k]]
            out[k] = e
    with open(os.path.join(SORTIE, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def main():
    for f in ("personnages", "ferme", "bourg", "train", "maison", "faune", "poissons", "elevage", "marche", "foret013", "village013"):
        st = json.load(open(os.path.join(ICI, "stats", f + ".json"), encoding="utf-8"))
        taille = os.path.getsize(os.path.join(SORTIE, f + ".glb"))
        print(f"\n### `{f}.glb` ({ko(taille)})\n")
        if f == "personnages":
            print("| Nœud | Triangles |\n|---|---|")
            for k, v in st["meshes"].items():
                print(f"| `{k}` | {v} |")
            print("\n| Animation | Durée (s) | Boucle |\n|---|---|---|")
            for a in st["animations"]:
                print(f"| `{a['name']}` | {a['seconds']} | {'oui' if a['loop'] else 'non (jouer une fois)'} |")
            continue
        print("| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |\n|---|---|---|---|")
        for k, v in st["nodes"].items():
            fp = v.get("footprint")
            fp = f"{fp[0]} x {fp[1]}" if fp else ""
            extra = {kk: vv for kk, vv in v.items() if kk not in ("footprint", "tris")}
            ex = ", ".join(f"{kk}: {json.dumps(vv, ensure_ascii=False)}" for kk, vv in extra.items())
            print(f"| `{k}` | {fp} | {v['tris']} | {ex} |")
        if isinstance(st.get("animations"), dict):
            col = "Nœud" if f == "village013" else "Bête"
            print(f"\n| {col} | Animation | Durée (s) | Boucle |\n|---|---|---|---|")
            for beast, clips in st["animations"].items():
                for a in clips:
                    print(f"| `{beast}` | `{a['name']}` | {a['seconds']} | {'oui' if a['loop'] else 'non (jouer une fois)'} |")
        elif st.get("animations"):
            print("\nAnimations: " + ", ".join(f"`{a}`" for a in st["animations"]))


if __name__ == "__main__":
    index()
    main()
