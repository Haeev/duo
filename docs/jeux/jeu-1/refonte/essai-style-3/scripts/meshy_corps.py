"""Essai de style 3: corps communs générés par Meshy (aperçu en topologie intelligente, affinage texturé, rig).

Usage: python3 meshy_corps.py <dossier de travail hors dépôt> apercu|suite [femme|homme...]
- apercu: lance les aperçus (5 crédits chacun) et écrit leurs identifiants dans <dossier>/corps.json;
- suite: attend chaque aperçu, l'affine avec la consigne de texture (10), le rigge (5) et télécharge tout.
Toutes les tâches passent par docs/production/essais-meshy/scripts/meshy-mcp.mjs (journal JSONL).
"""
import json
import pathlib
import subprocess
import sys

DEPOT = pathlib.Path(__file__).resolve().parents[6]
CLIENT = DEPOT / "docs/production/essais-meshy/scripts/meshy-mcp.mjs"

# Consigne commune: corps nu de tout vêtement modelé, pour que les tenues soient de simples textures.
COMMUN = (
    "base body mesh for an early-2000s 3D life simulation game, realistic natural proportions slightly softened, "
    "about seven heads tall, average build, wearing only tight plain light grey sports underwear painted on the skin "
    "(no folds, no volume), smooth bald head like a mannequin, small ears, simple smooth flat shoes, "
    "hands relaxed with fingers together, A-pose, standing straight, symmetrical, plain background"
)
CORPS = {
    "femme": {"prompt": "adult woman in her thirties, " + COMMUN, "hauteur": 1.68},
    "homme": {"prompt": "ordinary adult man in his forties, not muscular, soft untrained body, slight belly, narrow shoulders, " + COMMUN, "hauteur": 1.76},
}
# Changement de direction du client (2026-11-10): style « bande dessinée encrée », corps stylisés.
# Ni affinage ni texture de Meshy: tout se peint par script; le rig se fait sur l'aperçu sans texture.
BD = (
    "stylized comic book video game character base body, graphic exaggerated proportions, slightly large head, "
    "large hands and feet, long legs, angular planar shapes with crisp edges, simple chunky readable forms, "
    "smooth bald head like a mannequin with no hair, simple nose, plain tight clothing flush to the body with no folds "
    "and no accessories, simple boots, mitten-like hands with fingers together, A-pose, standing straight, symmetrical"
)
CORPS["femme-bd"] = {"prompt": "adult woman, " + BD, "hauteur": 1.66, "stylise": True}
CORPS["homme-bd"] = {"prompt": "adult man with a sturdy build, broad chest, slight belly, " + BD, "hauteur": 1.76, "stylise": True}
# Premier essai d'homme stylisé: culturiste (refusé sur l'aperçu). Consigne plus douce:
CORPS["homme-bd2"] = {"prompt": "gentle ordinary adult man, not muscular at all, soft rounded belly, sloping shoulders, thin arms, "
                      + BD, "hauteur": 1.76, "stylise": True}
TEXTURE = (
    "natural light skin, hand-painted texture like an early-2000s life simulation game, soft painted face with "
    "calm neutral expression, eyes open looking forward, eyebrows, closed lips, light grey plain underwear, "
    "grey flat shoes, bald smooth scalp, no hair, no text, no logo"
)


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
        if etape == "apercu":
            r = appel(dossier, "meshy_text_to_3d", {
                "prompt": CORPS[nom]["prompt"], "ai_model": "meshy-t2.5", "model_type": "smart-topology",
                "target_polycount": 4000 if CORPS[nom].get("stylise") else 4800, "pose_mode": "a-pose", "target_formats": ["glb"]})
            print(nom, "apercu", json.dumps(r)[:300], flush=True)
            t["apercu"] = r.get("task_id")
        elif etape == "suite":
            attendre(dossier, t["apercu"], "text-to-3d")
            if CORPS[nom].get("stylise"):
                t["affinage"] = t["apercu"]
            if not t.get("affinage"):
                r = appel(dossier, "meshy_text_to_3d_refine", {
                    "preview_task_id": t["apercu"], "enable_pbr": False, "texture_prompt": TEXTURE,
                    "target_formats": ["glb"]})
                print(nom, "affinage", json.dumps(r)[:300], flush=True)
                t["affinage"] = r.get("task_id")
                registre.write_text(json.dumps(taches, indent=1))
            r = attendre(dossier, t["affinage"], "text-to-3d")
            (dossier / f"{nom}-affinage.json").write_text(json.dumps(r, indent=1))
            d = appel(dossier, "meshy_download_model", {"task_id": t["affinage"], "format": "glb"})
            print(nom, "telechargement", json.dumps(d)[:500], flush=True)
            if not t.get("rig"):
                r = appel(dossier, "meshy_rig", {"input_task_id": t["affinage"], "height_meters": CORPS[nom]["hauteur"]})
                print(nom, "rig", json.dumps(r)[:300], flush=True)
                t["rig"] = r.get("task_id")
                registre.write_text(json.dumps(taches, indent=1))
            r = attendre(dossier, t["rig"], "rigging")
            (dossier / f"{nom}-rig.json").write_text(json.dumps(r, indent=1))
        registre.write_text(json.dumps(taches, indent=1))


if __name__ == "__main__":
    main()
