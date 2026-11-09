"""Convertit le catalogue de la démo au format du jeu (chantier aménagement).

    python3 games/deux-tabliers/outils/convertir-catalogue.py

Lit `docs/jeux/cosy-cafe/demo/donnees/catalogue.json`, `postes-equipements.json` (paliers,
extensions) et `reglages-economie.json` (ambiance, brocante), écrit
`games/deux-tabliers/donnees/catalogue.json` (format décrit dans `donnees/SCHEMA.md`).
Identifiants: les `snake_case` de la démo deviennent des traits d'union (convention du jeu);
le nom du modèle garde l'identifiant d'origine (fichiers de l'artiste 3D).
Puis: `npx prettier --write games/deux-tabliers/donnees/catalogue.json`.
"""

import json
from pathlib import Path

JEU = Path(__file__).resolve().parent.parent
DEMO = JEU.parent.parent / "docs" / "jeux" / "cosy-cafe" / "demo" / "donnees"

# Couleur du substitut quand le modèle manque: par style, éclaircie pour les petits objets.
COULEUR_STYLE = {
    "campagne": "#b08458",
    "jardin": "#7f9f6a",
    "nordique": "#d8cfc0",
    "retro": "#d08a3c",
    "bistrot": "#6b3a2e",
    "atelier": "#5d6266",
    "neutre": "#c9b99a",
}
# Teintes des revêtements (peintures, papiers peints, sols), lues par le rendu.
COULEUR_REVETEMENT = {
    "peinture_lin": "#e6d9bf",
    "peinture_vert_eau": "#b7d1c2",
    "peinture_lie_de_vin": "#7a3b45",
    "peinture_chaux": "#f1eee6",
    "papier_fleurs_champs": "#eadfc4",
    "papier_feuillage": "#a2b99c",
    "papier_rayures_creme": "#efe2c4",
    "sol_tomettes": "#b4613d",
    "sol_carreaux_ciment": "#c8c2b2",
    "sol_damier": "#d9d5cd",
}


def ident(s):
    return s.replace("_", "-")


def unlock(u):
    if "tier" in u:
        return {"kind": "tier", "tier": u["tier"]}
    if u.get("source") == "brocante":
        return {"kind": "brocante"}
    return {"kind": u["source"], "ref": ident(u["ref"]).replace(":", "-")}


def item(it):
    size = it.get("size")
    out = {
        "id": ident(it["id"]),
        "label": it["name"][:60],
        "model": it["id"],
        "category": it["category"],
        "style": it["style"],
        "price": it["price"],
        "charm": it["charm"],
        "size": None if size is None else [size["w"], size["d"], size["h"]],
        "placement": it["placement"],
        "rotationStep": it["rotationStep"],
        "heavy": bool(it.get("heavy", False)),
        "unlock": unlock(it["unlock"]),
        "text": it["text"],
        "color": COULEUR_REVETEMENT.get(it["id"], COULEUR_STYLE[it["style"]]),
    }
    if "seats" in it:
        out["seats"] = it["seats"]
    if "renovationPrice" in it:
        out["renovationPrice"] = it["renovationPrice"]
    if "priceUnit" in it:
        out["priceUnit"] = it["priceUnit"]
    if it.get("charmUnit") == "m2":
        out["charmPerM2"] = True
    if it.get("unique"):
        out["unique"] = True
    if it.get("id", "").startswith("brocante_"):
        out["label"] = it["name"][:60]
    return out


def main():
    cat = json.loads((DEMO / "catalogue.json").read_text(encoding="utf-8"))
    eq = json.loads((DEMO / "postes-equipements.json").read_text(encoding="utf-8"))
    eco = json.loads((DEMO / "reglages-economie.json").read_text(encoding="utf-8"))
    amb = eco["ambiance"]
    out = {
        "source": "docs/jeux/cosy-cafe/demo/donnees (demo-0.1), converti par outils/convertir-catalogue.py",
        "styles": cat["styles"],
        "tiers": [
            {"id": t["id"], "label": t["name"], "cups": t["cups"], "orDay": t["orDay"]}
            for t in eq["tiers"]
        ],
        "brocante": {
            "piecesPerMonday": eco["brocante"]["piecesPerMonday"],
            "discount": eco["brocante"]["discount"],
            "charmFactor": eco["brocante"]["charmFactor"],
        },
        "ambiance": {
            "decorMax": amb["decorMax"],
            "charmPerM2ForMax": amb["charmPerM2ForMax"],
            "coherenceMax": amb["coherenceMax"],
            "comfortFactor": amb["comfortFactor"],
            "comfortMax": amb["comfortMax"],
            "lightPerM2": amb["lightPerM2"],
            "lightMax": amb["lightMax"],
            "musicMatching": amb["music"]["matching"],
            "musicOther": amb["music"]["other"],
            "cleanlinessMax": amb["cleanlinessMax"],
            "wornCharmFactor": amb["wornCharmFactor"],
            "words": [
                {"from": 0, "label": "Un peu vide"},
                {"from": 30, "label": "Sympathique"},
                {"from": 50, "label": "Chaleureuse"},
                {"from": 70, "label": "Charmante"},
                {"from": 85, "label": "Exceptionnelle"},
            ],
        },
        "extensions": [
            {
                "id": ident(x["id"]),
                "label": x["name"][:60],
                "price": x["price"],
                "tier": x["tier"],
                "nights": x["nightsOfWork"],
                "publicSurfaceM2": eco["ambiance"]["publicSurfaceM2"][x["id"]],
                "text": x["text"],
            }
            for x in eq["extensions"]
        ],
        "items": [item(it) for it in cat["items"]],
    }
    path = JEU / "donnees" / "catalogue.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.relative_to(JEU)}: {len(out['items'])} objets, {len(out['extensions'])} extensions")


if __name__ == "__main__":
    main()
