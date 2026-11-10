"""Reconstruit tout l'essai 4 depuis les fiches: corps conformés, coiffures, atlas, traits, GLB.

Usage: python3 construire.py [--corps <dossier des rigs Meshy>] [--seulement atlas]
  <dossier>/<gabarit>/marche.glb : sortie brute du rig Meshy (non versionnée), seulement pour reconformer.
  Sans --corps, les corps conformés de `.travail/` sont gardés (il faut les avoir conformés une fois).
Ajouter une tenue, une coiffure, un personnage ou un corps ne demande qu'une fiche dans gabarits/ et cette
commande. Les atlas des croisements de la planche (3 tenues x 3 corps) vont dans `.travail/` (non versionnés).
"""
import json
import pathlib
import subprocess
import sys
import tomllib
from concurrent.futures import ThreadPoolExecutor

ICI = pathlib.Path(__file__).resolve().parent
ESSAI = ICI.parent
GAB = ESSAI / "gabarits"
TRAVAIL = ESSAI / ".travail"  # .blend intermédiaires, planches de repères, atlas des croisements (ignorés)
# Croisements de la planche: tenue x corps, avec la coiffure et les couleurs du personnage du corps.
CROIX_TENUES = ("carreaux-jean", "mariniere-short", "pull-toile")
CROIX_CORPS = ("femme", "costaud", "enfant")
ETIQUETTES = ("CONFORME", "REPERES", "COIFFURE", "COL", "ATLAS", "TRAITS", "EXPORT")


def run(*args):
    out = subprocess.run(["duo-python", *map(str, args)], capture_output=True, text=True)
    lines = [ln for ln in out.stdout.splitlines() if ln.split(" ")[0] in ETIQUETTES]
    texte = "\n".join(lines) or out.stdout[-800:] + out.stderr[-1500:]
    if out.returncode:
        raise SystemExit(texte + out.stderr[-1500:])
    return texte


def lot(taches):
    with ThreadPoolExecutor(5) as ex:
        for texte in ex.map(lambda t: run(*t), taches):
            print(texte, flush=True)


def main():
    TRAVAIL.mkdir(exist_ok=True)
    (ESSAI / "atlas").mkdir(exist_ok=True)
    corps = sorted(p.stem for p in (GAB / "corps").glob("*.toml"))
    persos = {p.stem: tomllib.load(open(p, "rb")) for p in sorted((GAB / "personnages").glob("*.toml"))}
    seul = sys.argv[sys.argv.index("--seulement") + 1] if "--seulement" in sys.argv else None
    if "--corps" in sys.argv:
        src = pathlib.Path(sys.argv[sys.argv.index("--corps") + 1])
        lot([(ICI / "conformer_corps.py", src / g / "marche.glb", TRAVAIL / f"{g}.blend", ESSAI / "modeles" / f"{g}.npz",
              GAB / "corps" / f"{g}.toml") for g in corps])
        lot([(ICI / "reperes.py", TRAVAIL / f"{g}.blend", ESSAI / "modeles" / f"{g}.npz", TRAVAIL / f"reperes-{g}.png")
             for g in corps])
    # Coiffures: une coque par couple (corps, coiffure) réellement porté.
    paires = sorted({(f["corps"]["gabarit"], f["coiffure"]) for f in persos.values() if f.get("coiffure")})
    if seul in (None, "coiffures"):
        lot([(ICI / "coiffure.py", TRAVAIL / f"{g}.blend", ESSAI / "modeles" / f"{g}.npz", GAB / "coiffures" / f"{c}.toml",
              ESSAI / "modeles" / f"{g}-{c}.glb", ESSAI / "modeles" / f"{g}-{c}.npz") for g, c in paires])
        lot([(ICI / "col.py", TRAVAIL / f"{g}.blend", ESSAI / "modeles" / f"{g}-col.glb") for g in corps])
    # Index lu par la scène: qui porte quoi (corps, coiffure, col en volume si la tenue a un col de chemise).
    tenues = {p.stem: tomllib.load(open(p, "rb")) for p in (GAB / "tenues").glob("*.toml")}
    index = {nom: {"corps": f["corps"]["gabarit"], "coiffure": f.get("coiffure"), "tenue": f["tenue"],
                   "col": tenues[f["tenue"]]["haut"].get("col") == "chemise"} for nom, f in persos.items()}
    index["_tenues"] = {t: {"col": f["haut"].get("col") == "chemise"} for t, f in tenues.items()}
    (ESSAI / "atlas" / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    # Atlas des personnages, puis des croisements (fiches fabriquées à la volée à partir du personnage du corps).
    taches = [(ICI / "peindre.py", "atlas", GAB / "personnages" / f"{nom}.toml", ESSAI / "atlas" / f"{nom}.png") for nom in persos]
    par_corps = {}
    for nom, f in persos.items():
        par_corps.setdefault(f["corps"]["gabarit"], (nom, f))
    (TRAVAIL / "croix").mkdir(exist_ok=True)
    for g in CROIX_CORPS:
        nom, f = par_corps[g]
        for t in CROIX_TENUES:
            fiche = TRAVAIL / "croix" / f"{g}-{t}.toml"
            fiche.write_text(f'id = "{g}-{t}"\ntenue = "{t}"\ncoiffure = "{f["coiffure"]}"\npeau = "{f["peau"]}"\n'
                             f'cheveux = "{f["cheveux"]}"\ngabarits = "{GAB}"\n[corps]\ngabarit = "{g}"\n'
                             f'donnees = "modeles/{g}.npz"\n')
            taches.append((ICI / "peindre.py", "atlas", fiche, TRAVAIL / "croix" / f"{g}-{t}.png"))
    taches.append((ICI / "peindre.py", "traits", ESSAI / "atlas" / "traits.png"))
    if seul in (None, "atlas"):
        lot(taches)
    if seul is None:
        lot([(ICI / "exporter_corps.py", TRAVAIL / f"{g}.blend", ESSAI / "atlas" / f"{par_corps[g][0]}.png",
              ESSAI / "modeles" / f"{g}.glb") for g in corps if g in par_corps])


if __name__ == "__main__":
    main()
