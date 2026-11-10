"""Essai de style 4: corps communs d'après une image de concept (Meshy), un par gabarit.

Usage: python3 meshy_corps.py <dossier de travail hors dépôt> concept|modele|rig|telecharger [gabarit...]
- concept: image de concept par texte (nano-banana, 3 crédits), à regarder avant d'aller plus loin;
- modele: image vers 3D en topologie intelligente, sans texture (meshy-t2.5, 5 crédits);
- rig: squelette et marche (5 crédits);
- telecharger: range le rig avec sa marche dans <dossier>/rigs/<gabarit>/marche.glb.
Les identifiants des tâches sont tenus dans <dossier>/corps.json; un gabarit suffixé (`femme-b`) relance
une variante sans perdre la première. Appels par docs/production/essais-meshy/scripts/meshy-mcp.mjs.
Les consignes ne nomment aucune oeuvre, aucune marque, aucun personnage existant.
"""
import json
import pathlib
import subprocess
import sys

DEPOT = pathlib.Path(__file__).resolve().parents[6]
CLIENT = DEPOT / "docs/production/essais-meshy/scripts/meshy-mcp.mjs"

COMMUN = (
    "full body front view of a single character, stylized comic book video game character design, angular chiseled "
    "planar shapes like a carved wooden figurine, exaggerated characterful silhouette, gentle and funny, not heroic, "
    "not a warrior, {tetes}, completely bald smooth head with no hair and no hat, clearly visible neck, "
    "wearing a plain tight grey long-sleeve top with a simple round neckline and plain tight grey trousers flush to "
    "the body with no folds, simple chunky shoes, open hands with fingers together, hands only slightly larger than "
    "natural, A-pose with straight arms 40 degrees away from the body, legs slightly apart, symmetrical, "
    "neutral light grey background, flat even lighting, no cast shadow, no text"
)
SEPT = "about seven heads tall"
CORPS = {
    "femme": {"hauteur": 1.66, "tetes": SEPT, "qui": "lanky adult village woman in her thirties, long neck, narrow "
              "sloping shoulders, wide hips, long thin arms, pointed chin, long sharp nose, slightly knock-kneed, big feet"},
    "homme": {"hauteur": 1.78, "tetes": SEPT, "qui": "tall thin gangly adult man in his forties, long narrow face, "
              "big nose, big ears, small pot belly, slightly stooped, thin legs, long arms, bony knees"},
    "costaud": {"hauteur": 1.76, "tetes": SEPT, "qui": "sturdy barrel-chested adult village man, broad angular "
                "shoulders, short thick neck, big square jaw, small eyes, broken nose, short sturdy legs, medium-sized hands"},
    "agee": {"hauteur": 1.55, "tetes": "about six and a half heads tall", "qui": "small elderly grandmother, rounded "
             "hunched back, head pushed forward, plump pear-shaped body, thin legs, hooked nose, pointed chin, kind face"},
    "enfant": {"hauteur": 1.30, "tetes": "about five and a half heads tall", "qui": "skinny child about nine years "
               "old, big head, round cheeks, big ears, snub nose, thin limbs, knobbly knees, slightly large feet"},
}
# Variantes « b »: les premiers concepts de la femme et de l'homme étaient en fil de fer (8,5 têtes),
# l'enfant avait une tête de 3 têtes et demie. Membres plus épais, tête chiffrée.
FORT = ("low-poly faceted look with hard flat planes, sturdy limbs with real thickness, thick calves and forearms, "
        "the head is large: exactly one seventh of the total height, ")
VARIANTES = {
    "femme-b": "adult village woman in her thirties, long neck, narrow sloping shoulders, wide hips and strong thighs, "
               "pointed chin, long sharp nose, big feet, " + FORT,
    "homme-b": "tall adult man in his forties, long narrow face, big nose, big ears, small pot belly, slightly stooped, "
               "bony knees, long arms, " + FORT,
    "enfant-b": "child about nine years old, round cheeks, big ears, snub nose, knobbly knees, slightly large feet, "
                "low-poly faceted look with hard flat planes, sturdy limbs with real thickness, the head is only a "
                "little larger than natural: one fifth of the total height, ",
}


def consigne(nom: str) -> str:
    if nom in VARIANTES:
        return VARIANTES[nom] + COMMUN.format(tetes=CORPS[nom.split("-")[0]]["tetes"])
    c = CORPS[nom.split("-")[0]]
    return c["qui"] + ", " + COMMUN.format(tetes=c["tetes"])


def appel(dossier: pathlib.Path, outil: str, args: dict) -> dict:
    out = subprocess.run(["node", str(CLIENT), str(dossier), outil, json.dumps(args), str(dossier / "journal.jsonl")],
                         cwd=DEPOT, capture_output=True, text=True, timeout=400).stdout
    i = out.find("--- structuredContent ---")
    try:
        return json.loads(out[i + 25:]) if i >= 0 else {"brut": out[-1500:]}
    except json.JSONDecodeError:
        return {"brut": out[-1500:]}


def attendre(dossier: pathlib.Path, tache: str, genre: str) -> dict:
    r: dict = {}
    for _ in range(8):
        r = appel(dossier, "meshy_get_task_status", {"task_id": tache, "task_type": genre, "wait": True})
        print(tache, genre, r.get("status"), r.get("consumed_credits"), flush=True)
        if r.get("status") in ("SUCCEEDED", "FAILED", "CANCELED"):
            break
    return r


def main() -> None:
    dossier = pathlib.Path(sys.argv[1]).resolve()
    etape = sys.argv[2]
    noms = sys.argv[3:] or list(CORPS)
    registre = dossier / "corps.json"
    taches = json.loads(registre.read_text()) if registre.exists() else {}
    for nom in noms:
        t = taches.setdefault(nom, {})
        if etape == "concept" and not t.get("concept"):
            r = appel(dossier, "meshy_text_to_image", {"ai_model": "nano-banana", "prompt": consigne(nom),
                                                       "aspect_ratio": "3:4", "response_format": "json"})
            print(nom, "concept", json.dumps(r)[:300], flush=True)
            t["concept"] = r.get("task_id")
        elif etape == "modele" and not t.get("modele"):
            r = appel(dossier, "meshy_image_to_3d", {
                "input_task_id": t["concept"], "ai_model": "meshy-t2.5", "model_type": "smart-topology",
                "target_polycount": 3600, "pose_mode": "a-pose", "should_texture": False, "target_formats": ["glb"]})
            print(nom, "modele", json.dumps(r)[:300], flush=True)
            t["modele"] = r.get("task_id")
        elif etape == "rig" and not t.get("rig"):
            attendre(dossier, t["modele"], "image-to-3d")
            r = appel(dossier, "meshy_rig", {"input_task_id": t["modele"],
                                             "height_meters": CORPS[nom.split("-")[0]]["hauteur"]})
            print(nom, "rig", json.dumps(r)[:300], flush=True)
            t["rig"] = r.get("task_id")
        registre.write_text(json.dumps(taches, indent=1))
    if etape == "telecharger":
        # Le rig avec sa marche: <dossier>/rigs/<gabarit>/marche.glb, l'entrée de `construire.py --corps`.
        for nom in noms:
            r = json.loads((dossier / f"{nom}-rig.json").read_text())
            cible = dossier / "rigs" / nom.split("-")[0]
            cible.mkdir(parents=True, exist_ok=True)
            out = subprocess.run(["curl", "-sS", "-L", "-o", str(cible / "marche.glb"), "-w", "%{http_code} %{size_download}",
                                  r["result"]["basic_animations"]["walking_glb_url"]], capture_output=True, text=True)
            print(nom, out.stdout, out.stderr[:200], flush=True)
    if etape in ("concept", "modele", "rig"):
        genre = {"concept": "text-to-image", "modele": "image-to-3d", "rig": "rigging"}[etape]
        for nom in noms:
            r = attendre(dossier, taches[nom][etape], genre)
            (dossier / f"{nom}-{etape}.json").write_text(json.dumps(r, indent=1))
            d = appel(dossier, "meshy_download_model", {"task_id": taches[nom][etape], "format": "glb"})
            (dossier / f"{nom}-{etape}-fichiers.json").write_text(json.dumps(d, indent=1))
            print(nom, etape, "fichiers", json.dumps(d)[:400], flush=True)


if __name__ == "__main__":
    main()
