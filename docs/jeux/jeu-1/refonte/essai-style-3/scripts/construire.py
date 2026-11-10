"""Reconstruit tout l'essai 3 depuis les fiches: corps conformés, coiffures, atlas, traits, GLB.

Usage: python3 construire.py [--corps <dossier des rigs Meshy>]   (sans --corps: corps déjà conformés gardés)
  <dossier>/<gabarit>/marche.glb : sortie brute du rig Meshy (non versionnée), seulement pour reconformer.
Ajouter une tenue, une coiffure ou un personnage ne demande qu'une fiche dans gabarits/ et cette commande.
"""
import pathlib
import subprocess
import sys
import tomllib

ICI = pathlib.Path(__file__).resolve().parent
ESSAI = ICI.parent
TRAVAIL = ESSAI / ".travail"  # fichiers .blend intermédiaires (ignorés: régénérables)
# Corps communs: gabarit -> agrandissement des mains et pieds (le costaud vient d'un dessin déjà exagéré).
CORPS = {"femme": 0.15, "homme": 0.15, "costaud": 0.0}


def run(*args):
    out = subprocess.run(["duo-python", *map(str, args)], capture_output=True, text=True)
    lines = [ln for ln in out.stdout.splitlines() if ln.split(" ")[0] in ("CONFORME", "COIFFURE", "ATLAS", "TRAITS", "EXPORT")]
    print("\n".join(lines) or out.stdout[-800:] + out.stderr[-1500:], flush=True)
    if out.returncode:
        sys.exit(out.returncode)


def main():
    TRAVAIL.mkdir(exist_ok=True)
    (ESSAI / "atlas").mkdir(exist_ok=True)
    if "--corps" in sys.argv:
        src = pathlib.Path(sys.argv[sys.argv.index("--corps") + 1])
        for g in CORPS:
            run(ICI / "conformer_corps.py", src / g / "marche.glb", TRAVAIL / f"{g}.blend", ESSAI / "modeles" / f"{g}.npz",
                2300, CORPS[g])
    for g in CORPS:
        for coif in sorted((ESSAI / "gabarits" / "coiffures").glob("*.toml")):
            run(ICI / "coiffure.py", TRAVAIL / f"{g}.blend", coif, ESSAI / "modeles" / f"{g}-{coif.stem}.glb",
                ESSAI / "modeles" / f"{g}-{coif.stem}.npz")
    premiers = {}
    for perso in sorted((ESSAI / "gabarits" / "personnages").glob("*.toml")):
        fiche = tomllib.load(open(perso, "rb"))
        run(ICI / "peindre.py", "atlas", perso, ESSAI / "atlas" / f"{perso.stem}.png")
        premiers.setdefault(fiche["corps"]["gabarit"], perso.stem)
    run(ICI / "peindre.py", "traits", ESSAI / "atlas" / "traits.png")
    for g, perso in premiers.items():
        run(ICI / "exporter_corps.py", TRAVAIL / f"{g}.blend", ESSAI / "atlas" / f"{perso}.png", ESSAI / "modeles" / f"{g}.glb")


if __name__ == "__main__":
    main()
