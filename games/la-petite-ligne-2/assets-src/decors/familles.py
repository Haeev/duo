"""Familles paramétriques des décors. Une fonction par famille: `famille(m, p, c)`.

`m`: le Modele en construction (formes.py); `p`: les paramètres de l'entrée du gabarit (valeurs
par défaut ici); `c(slot)`: (couleur du nuancier, zone) d'un emplacement (`bois`, `peinture`,
`tissu`, `metal`, ou un nom du nuancier en couleur fixe). Chaque fonction pose ses pièces et rend
ses accroches: `assise` (hauteur du dessus, bord avant depuis le centre), `plateau` (hauteur),
`couchage`, `porte` (pour les maisons, voir maison.py). Avant du modèle vers -Y (sud du jeu).
"""
import math


def _pieds(m, c, demi_x, demi_y, haut, rayon, slot="bois", evase=0.0):
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cylindre(rayon, haut, (sx * demi_x, sy * demi_y, 0), *c(slot), pans=10,
                       rayon_haut=rayon * 0.85, arrondi=0.008, rot=(sy * evase, -sx * evase, 0))


# ---------------------------------------------------------------- mobilier de base
def chaise(m, p, c):
    h = p.get("assise", 0.45)
    w, d, ep = p.get("largeur", 0.44), p.get("profondeur", 0.42), 0.05
    dos = p.get("dossier", 0.92)
    _pieds(m, c, w / 2 - 0.04, d / 2 - 0.04, h - ep, 0.022)
    m.boite((w, d, ep), (0, 0, h - ep), *c("tissu" if p.get("assise_tissu") else "bois"), arrondi=0.02)
    # Montants du dossier: prolongent les pieds arrière, un peu renversés.
    for sx in (-1, 1):
        m.boite((0.045, 0.045, dos - h + 0.02), (sx * (w / 2 - 0.04), d / 2 - 0.04, h - 0.02), *c("bois"),
                arrondi=0.015, rot=(-6, 0, 0))
    style = p.get("style", "barreaux")
    if style == "plein":
        m.boite((w - 0.08, 0.035, 0.26), (0, d / 2 - 0.02, dos - 0.32), *c("peinture"), arrondi=0.015, rot=(-6, 0, 0))
    else:
        for k in range(p.get("barreaux", 2)):
            z = dos - 0.08 - k * 0.15
            m.boite((w - 0.08, 0.03, 0.06), (0, d / 2 - 0.04 + (z - h) * 0.105, z), *c("peinture"), arrondi=0.012, rot=(-6, 0, 0))
    return {"assise": {"hauteur": h, "avant": d / 2}}


def tabouret(m, p, c):
    h, r = p.get("assise", 0.45), p.get("rayon", 0.17)
    for k in range(3):
        a = math.radians(90 + k * 120)
        m.cylindre(0.022, h - 0.04, (math.cos(a) * r * 0.65, math.sin(a) * r * 0.65, 0.003), *c("bois"), pans=8,
                   rayon_haut=0.018, rot=(-math.sin(a) * 6, math.cos(a) * 6, 0))
    m.cylindre(r, 0.045, (0, 0, h - 0.045), *c("peinture"), pans=20, arrondi=0.018)
    return {"assise": {"hauteur": h, "avant": r}}


def banc(m, p, c):
    L, h, d = p.get("longueur", 1.6), p.get("assise", 0.45), p.get("profondeur", 0.42)
    pied = p.get("pieds", "bois")
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.14)
        if pied == "fonte":
            # Flasque de fonte: un pied en arc, un accoudoir rond.
            m.boite((0.05, d, 0.06), (x, 0, h - 0.10), *c("metal"), arrondi=0.02)
            for sy in (-1, 1):
                m.boite((0.05, 0.06, h - 0.08), (x, sy * (d / 2 - 0.05), 0), *c("metal"), arrondi=0.02)
            if p.get("dossier", True):
                m.boite((0.05, 0.05, 0.46), (x, d / 2 - 0.03, h - 0.04), *c("metal"), arrondi=0.02, rot=(-10, 0, 0))
                m.boite((0.05, d - 0.06, 0.05), (x, -0.02, h + 0.18), *c("metal"), arrondi=0.022)
                m.cylindre(0.03, 0.02, (x, -d / 2 + 0.02, h + 0.205), *c("metal"), pans=10, arrondi=0.008)
        else:
            m.boite((0.07, d - 0.06, h - 0.05), (x, 0, 0), *c("bois"), arrondi=0.02)
    lattes = p.get("lattes", 3)
    pas = (d - 0.02) / lattes
    for k in range(lattes):
        y = -d / 2 + 0.01 + pas * (k + 0.5)
        m.boite((L, pas - 0.012, 0.045), (0, y, h - 0.045), *c("bois" if pied == "fonte" else "peinture"), arrondi=0.016)
    if p.get("dossier", True):
        for k in range(2):
            z = h + 0.14 + k * 0.17
            m.boite((L - 0.04, 0.035, 0.11), (0, d / 2 - 0.03 + (z - h) * 0.176, z), *c("bois" if pied == "fonte" else "peinture"),
                    arrondi=0.016, rot=(-10, 0, 0))
        if pied != "fonte":
            for sx in (-1, 1):
                m.boite((0.06, 0.05, 0.50), (sx * (L / 2 - 0.14), d / 2 - 0.03, h - 0.05), *c("bois"), arrondi=0.018, rot=(-10, 0, 0))
    return {"assise": {"hauteur": h, "avant": d / 2}}


def table(m, p, c):
    h = p.get("plateau", 0.75)
    ep = 0.05
    if p.get("ronde", False):
        r = p.get("rayon", 0.45)
        m.cylindre(r, ep, (0, 0, h - ep), *c("bois"), pans=28, arrondi=0.02)
        m.cylindre(0.05, h - ep - 0.06, (0, 0, 0.05), *c("peinture"), pans=12)
        m.cylindre(0.24, 0.06, (0, 0, 0), *c("peinture"), pans=20, rayon_haut=0.16, arrondi=0.02)
        return {"plateau": {"hauteur": h}}
    w, d = p.get("largeur", 1.2), p.get("profondeur", 0.75)
    m.boite((w, d, ep), (0, 0, h - ep), *c("bois"), arrondi=0.022)
    m.boite((w - 0.16, d - 0.16, 0.09), (0, 0, h - ep - 0.09), *c("peinture"), arrondi=0.015)
    _pieds(m, c, w / 2 - 0.09, d / 2 - 0.09, h - ep, 0.032, slot="peinture")
    return {"plateau": {"hauteur": h}}


def lit(m, p, c):
    w, L = p.get("largeur", 0.95), p.get("longueur", 2.0)
    haut = p.get("couchage", 0.50)
    # Cadre de bois, tête au nord (+Y): on se couche en regardant le sud.
    m.boite((w, L - 0.06, 0.16), (0, 0, 0.14), *c("bois"), arrondi=0.03)
    _pieds(m, c, w / 2 - 0.05, L / 2 - 0.08, 0.14, 0.035)
    m.boite((w + 0.06, 0.07, 0.95), (0, L / 2 - 0.035, 0), *c("bois"), arrondi=0.03)
    m.boite((w + 0.06, 0.07, 0.62), (0, -L / 2 + 0.035, 0), *c("bois"), arrondi=0.03)
    m.boite((w - 0.04, L - 0.18, haut - 0.30), (0, 0.0, 0.30), *("craie", "fixe"), arrondi=0.06, seg=3)
    # Couverture sur les deux tiers bas, un peu plus large que le matelas.
    m.boite((w + 0.02, (L - 0.18) * 0.66, 0.05), (0, -(L - 0.18) * 0.17 - 0.01, haut - 0.035), *c("tissu"), arrondi=0.025, seg=3)
    n = 2 if w > 1.2 else 1
    for k in range(n):
        x = (k - (n - 1) / 2) * (w / n)
        m.boite((w / n - 0.12, 0.34, 0.12), (x, L / 2 - 0.30, haut - 0.03), *("craie", "fixe"), arrondi=0.05, seg=3)
    return {"couchage": {"hauteur": haut, "places": n}}


def armoire(m, p, c):
    w, d, h = p.get("largeur", 1.0), p.get("profondeur", 0.55), p.get("hauteur", 1.95)
    m.boite((w - 0.04, d - 0.04, 0.10), (0, 0, 0), *c("bois"), arrondi=0.02)
    m.boite((w, d, h - 0.18), (0, 0, 0.10), *c("peinture"), arrondi=0.03)
    m.boite((w + 0.06, d + 0.05, 0.08), (0, 0.0, h - 0.08), *c("bois"), arrondi=0.03)
    portes = p.get("portes", 2)
    pw = (w - 0.10) / portes
    for k in range(portes):
        x = -w / 2 + 0.05 + pw * (k + 0.5)
        m.boite((pw - 0.04, 0.03, h - 0.38), (x, -d / 2, 0.20), *c("peinture"), arrondi=0.015)
        m.boule(0.022, (x + (0.5 - k) * (pw - 0.12) * (1 if portes > 1 else 0), -d / 2 - 0.03, 1.05), *c("metal"), pans=8, anneaux=6)
    return {}


def coffre(m, p, c):
    w, d, h = p.get("largeur", 0.8), p.get("profondeur", 0.45), p.get("hauteur", 0.42)
    m.boite((w, d, h), (0, 0, 0), *c("bois"), arrondi=0.025)
    # Couvercle bombé: demi-cylindre couché le long de X.
    m.cylindre(d / 2 + 0.01, w + 0.02, (-(w + 0.02) / 2, 0, h - 0.0), *c("peinture"), pans=16, arrondi=0.02, rot=(0, 90, 0))
    for sx in (-1, 1):
        m.boite((0.05, d + 0.02, h + 0.02), (sx * (w / 2 - 0.12), 0, 0), *c("metal"), arrondi=0.01)
    m.boite((0.08, 0.03, 0.10), (0, -d / 2 - 0.01, h - 0.11), *c("metal"), arrondi=0.01)
    return {}


def etagere(m, p, c):
    w, d, h = p.get("largeur", 0.9), p.get("profondeur", 0.32), p.get("hauteur", 1.6)
    n = p.get("niveaux", 4)
    for sx in (-1, 1):
        m.boite((0.035, d, h), (sx * (w / 2 - 0.0175), 0, 0), *c("bois"), arrondi=0.012)
    m.boite((w - 0.07, 0.02, h - 0.05), (0, d / 2 - 0.01, 0.03), *c("peinture"), arrondi=0.005)
    for k in range(n):
        z = 0.05 + k * (h - 0.08) / (n - 1)
        m.boite((w - 0.07, d - 0.02, 0.03), (0, -0.01, z), *c("bois"), arrondi=0.01)
    # Quelques pots: une étagère vide n'a pas de raison d'être là.
    for k, (x, ni, r, hh, col) in enumerate(((-0.25, 1, 0.06, 0.14, "terre_cuite"), (0.05, 1, 0.05, 0.18, "creme"),
                                               (0.22, 2, 0.07, 0.12, "sauge"), (-0.15, 2, 0.045, 0.2, "bleu"))):
        if ni < n:
            z = 0.05 + ni * (h - 0.08) / (n - 1) + 0.03
            m.cylindre(r, hh, (x * w / 0.9, -0.02, z), col, "fixe", pans=12, arrondi=0.015, rayon_haut=r * 0.85)
    return {"plateau": {"hauteur": round(0.05 + (h - 0.08) / (n - 1) + 0.03, 3)}}


def rechaud(m, p, c):
    w, d, h = p.get("largeur", 0.8), p.get("profondeur", 0.6), p.get("hauteur", 0.85)
    _pieds(m, c, w / 2 - 0.06, d / 2 - 0.06, 0.12, 0.03, slot="metal")
    m.boite((w, d, h - 0.17), (0, 0, 0.12), *c("peinture"), arrondi=0.04)
    m.boite((w + 0.04, d + 0.04, 0.05), (0, 0, h - 0.05), *c("metal"), arrondi=0.02)
    for x in (-0.18, 0.15):
        m.cylindre(0.11, 0.02, (x * w / 0.8, -0.03, h), *c("metal"), pans=16, arrondi=0.006)
    m.boite((w * 0.5, 0.03, 0.32), (-w * 0.12, -d / 2 - 0.01, 0.25), *c("metal"), arrondi=0.02, rot=(0, 0, 0))
    m.boite((0.16, 0.035, 0.03), (-w * 0.12, -d / 2 - 0.04, 0.53), *c("bois"), arrondi=0.012)
    m.boite((w * 0.25, 0.03, 0.18), (w * 0.3, -d / 2 - 0.01, 0.40), *c("metal"), arrondi=0.015)
    # Tuyau de fumée: monte à 2,2 m (il irait au conduit du mur).
    m.cylindre(0.065, 2.2 - h, (w / 2 - 0.12, d / 2 - 0.12, h), *c("metal"), pans=12)
    return {"plateau": {"hauteur": h}}


def evier(m, p, c):
    w, d, h = p.get("largeur", 1.0), p.get("profondeur", 0.55), p.get("plateau", 0.85)
    m.boite((w, d - 0.03, h - 0.12), (0, 0.015, 0), *c("bois"), arrondi=0.025)
    for x in (-w / 4, w / 4):
        m.boite((w / 2 - 0.06, 0.025, h - 0.30), (x, -d / 2 + 0.005, 0.12), *c("peinture"), arrondi=0.012)
    # Pierre d'évier creusée: fond et quatre rebords (le creux se voit d'en haut).
    m.boite((w, d, 0.05), (0, 0, h - 0.12), "pierre", "fixe", arrondi=0.02)
    for sy in (-1, 1):
        m.boite((w, 0.07, 0.12), (0, sy * (d / 2 - 0.035), h - 0.12), "pierre", "fixe", arrondi=0.025)
    for sx in (-1, 1):
        m.boite((0.07, d - 0.14, 0.12), (sx * (w / 2 - 0.035), 0, h - 0.12), "pierre", "fixe", arrondi=0.025)
    m.cylindre(0.02, 0.32, (0, d / 2 - 0.05, h), *c("metal"), pans=8)
    m.cylindre(0.018, 0.18, (0, d / 2 - 0.05, h + 0.31), *c("metal"), pans=8, rot=(90, 0, 0))
    return {"plateau": {"hauteur": h}}


def pompe(m, p, c):
    # Pompe à bras sur sa margelle, auge devant (le seau se pose sous le bec, au sud).
    m.boite((0.80, 0.80, 0.18), (0, 0.05, 0), "pierre", "fixe", arrondi=0.05)
    m.boite((0.62, 0.30, 0.10), (0, -0.20, 0.18), "pierre", "fixe", arrondi=0.03)
    # Eau de l'auge: ovale pris dans l'auge (0,62 x 0,30), affleurant le dessus.
    m.cylindre(0.27, 0.012, (0, -0.20, 0.272), "eau", "fixe", pans=16, echelle=(1, 0.42, 1))
    m.cylindre(0.10, 0.95, (0, 0.18, 0.18), *c("metal"), pans=14, rayon_haut=0.085, arrondi=0.02)
    m.cylindre(0.12, 0.10, (0, 0.18, 0.18), *c("metal"), pans=14, arrondi=0.03)
    m.boule(0.11, (0, 0.18, 1.18), *c("metal"), echelle=(1, 1, 0.8))
    m.cylindre(0.035, 0.30, (0, 0.10, 0.90), *c("metal"), pans=10, rot=(80, 0, 0))
    m.cylindre(0.03, 0.12, (0, -0.19, 0.95), *c("metal"), pans=10, rot=(0, 0, 0), rayon_haut=0.02)
    # Bras de pompe court: la pompe tient dans sa case de 1 m.
    m.cylindre(0.025, 0.38, (0, 0.20, 1.18), *c("metal"), pans=8, rot=(-70, 0, 0))
    m.boule(0.04, (0, 0.557, 1.31), *c("bois"), pans=10, anneaux=6)
    return {"plateau": {"hauteur": 0.28}}


def baignoire(m, p, c):
    w, d, h = p.get("longueur", 1.5), p.get("largeur", 0.72), p.get("hauteur", 0.58)
    ep = 0.07
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.boule(0.05, (sx * (w / 2 - 0.12), sy * (d / 2 - 0.12), 0.05), *c("metal"), pans=8, anneaux=6)
    m.boite((w, d, ep), (0, 0, 0.08), *c("peinture"), arrondi=0.03)
    for sy in (-1, 1):
        m.boite((w, ep, h - 0.08), (0, sy * (d / 2 - ep / 2), 0.08), *c("peinture"), arrondi=0.03)
    for sx in (-1, 1):
        m.boite((ep, d - 2 * ep + 0.02, h - 0.08), (sx * (w / 2 - ep / 2), 0, 0.08), *c("peinture"), arrondi=0.03)
    m.boite((w - 2 * ep, d - 2 * ep, 0.01), (0, 0, 0.15), "craie", "fixe", arrondi=0.0)
    return {}


def lampe(m, p, c):
    h = p.get("hauteur", 1.55)
    m.cylindre(0.16, 0.04, (0, 0, 0), *c("metal"), pans=16, arrondi=0.015)
    m.cylindre(0.018, h - 0.30, (0, 0, 0.04), *c("metal"), pans=8)
    m.boule(0.06, (0, 0, h - 0.22), "ambre", "fixe", pans=10, anneaux=6)
    m.cylindre(0.22, 0.26, (0, 0, h - 0.30), *c("tissu"), pans=16, rayon_haut=0.13, arrondi=0.012)
    return {}


def tapis(m, p, c):
    w, d = p.get("largeur", 1.6), p.get("profondeur", 1.0)
    m.cylindre(0.5, 0.012, (0, 0, 0), *c("tissu"), pans=24, echelle=(w, d, 1))
    m.cylindre(0.5, 0.016, (0, 0, 0), *c("peinture"), pans=24, echelle=(w * 0.78, d * 0.70, 1))
    return {}


# ---------------------------------------------------------------- mobilier de lieu
def reverbere(m, p, c):
    h = p.get("hauteur", 3.2)
    m.cylindre(0.16, 0.30, (0, 0, 0), *c("metal"), pans=12, rayon_haut=0.11, arrondi=0.03)
    m.cylindre(0.055, h - 0.75, (0, 0, 0.30), *c("metal"), pans=10, rayon_haut=0.045)
    m.cylindre(0.08, 0.06, (0, 0, h - 0.48), *c("metal"), pans=10, arrondi=0.02)
    # Lanterne: socle, verre ambré, chapeau.
    m.cylindre(0.10, 0.05, (0, 0, h - 0.45), *c("metal"), pans=8, rayon_haut=0.13)
    m.cylindre(0.13, 0.30, (0, 0, h - 0.40), "ambre", "fixe", pans=8, rayon_haut=0.16)
    m.cylindre(0.20, 0.14, (0, 0, h - 0.10), *c("metal"), pans=8, rayon_haut=0.03, arrondi=0.02)
    m.boule(0.035, (0, 0, h + 0.06), *c("metal"), pans=8, anneaux=6)
    return {}


def poteau_quai(m, p, c):
    h = p.get("hauteur", 2.6)
    m.cylindre(0.12, 0.12, (0, 0, 0), *c("metal"), pans=12, rayon_haut=0.08, arrondi=0.03)
    m.cylindre(0.05, h, (0, 0, 0.1), *c("metal"), pans=10)
    m.boule(0.07, (0, 0, h + 0.1), *c("metal"), pans=10, anneaux=6)
    # Pancarte tournée vers le sud (on la lit depuis le quai), fixée par une console.
    w = p.get("pancarte", 1.1)
    m.boite((w, 0.05, 0.36), (0, -0.06, h - 0.62), *c("peinture"), arrondi=0.03)
    m.boite((w - 0.12, 0.02, 0.24), (0, -0.095, h - 0.56), "creme", "fixe", arrondi=0.01)
    m.boite((0.14, 0.06, 0.04), (0, -0.03, h - 0.24), *c("metal"), arrondi=0.015)
    return {}


def barriere(m, p, c):
    L = p.get("longueur", 2.0)
    h = p.get("hauteur", 1.0)
    for sx in (-1, 1):
        m.boite((0.10, 0.10, h + 0.08), (sx * (L / 2 - 0.05), 0, 0), *c("bois"), arrondi=0.025)
        m.boule(0.06, (sx * (L / 2 - 0.05), 0, h + 0.08), *c("bois"), pans=8, anneaux=6, echelle=(1, 1, 0.6))
    for z in (h * 0.38, h * 0.82):
        m.boite((L - 0.06, 0.05, 0.10), (0, -0.07, z), *c("peinture"), arrondi=0.02)
    return {}


def panneau(m, p, c):
    h = p.get("hauteur", 2.2)
    m.boite((0.09, 0.09, h), (0, 0, 0), *c("bois"), arrondi=0.02)
    m.boule(0.06, (0, 0, h), *c("bois"), pans=8, anneaux=6, echelle=(1, 1, 0.6))
    for k, (dx, a) in enumerate(((0.38, 0), (-0.38, 0), (0.30, 0))):
        z = h - 0.30 - k * 0.32
        x = dx
        m.boite((0.68, 0.04, 0.20), (x, 0.0, z), *c("peinture"), arrondi=0.03, rot=(0, 0, 90 * k if k == 2 else 0))
        # Pointe de flèche: un bout arrondi côté direction.
        m.boule(0.10, (x + (0.34 if dx > 0 else -0.34) * (0 if k == 2 else 1), (0.34 if k == 2 else 0), z + 0.10), *c("peinture"),
                pans=8, anneaux=6, echelle=(0.9, 0.2 if k != 2 else 0.9, 1) if k != 2 else (0.2, 0.9, 1))
    return {}


def boite_aux_lettres(m, p, c):
    m.boite((0.08, 0.08, 1.0), (0, 0.08, 0), *c("bois"), arrondi=0.02)
    m.boite((0.30, 0.42, 0.22), (0, 0.0, 1.0), *c("peinture"), arrondi=0.03)
    m.cylindre(0.15, 0.42, (0, 0.21, 1.22), *c("peinture"), pans=14, rot=(90, 0, 0), arrondi=0.02)
    m.boite((0.16, 0.02, 0.03), (0, -0.215, 1.16), *c("metal"), arrondi=0.008)
    m.boite((0.02, 0.05, 0.16), (0.16, 0.08, 1.12), "coquelicot", "fixe", arrondi=0.008)
    return {}


def tonneau(m, p, c):
    h, r = p.get("hauteur", 0.85), p.get("rayon", 0.30)
    n = 4
    for k in range(n):
        z0 = k * h / n
        t0 = abs((k / n) - 0.5) * 2
        t1 = abs(((k + 1) / n) - 0.5) * 2
        m.cylindre(r * (1 - 0.13 * t0 ** 2), h / n, (0, 0, z0), *c("bois"), pans=16, rayon_haut=r * (1 - 0.13 * t1 ** 2))
    for z in (0.10, h - 0.14, 0.33, h - 0.37):
        t = abs(z / h - 0.5) * 2
        m.cylindre(r * (1 - 0.13 * t ** 2) + 0.012, 0.04, (0, 0, z), *c("metal"), pans=16)
    m.cylindre(r * 0.86, 0.02, (0, 0, h - 0.01), *c("bois"), pans=16)
    return {"plateau": {"hauteur": h}}


def caisse(m, p, c):
    s = p.get("cote", 0.6)
    m.boite((s - 0.04, s - 0.04, s - 0.04), (0, 0, 0.02), *c("bois"), arrondi=0.015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.boite((0.07, 0.07, s), (sx * (s / 2 - 0.035), sy * (s / 2 - 0.035), 0), *c("peinture"), arrondi=0.02)
    for z in (0.0, s - 0.07):
        for sy in (-1, 1):
            m.boite((s - 0.08, 0.05, 0.07), (0, sy * (s / 2 - 0.02), z), *c("peinture"), arrondi=0.018)
    return {"plateau": {"hauteur": s}}


def puits(m, p, c):
    r = p.get("rayon", 0.75)
    m.cylindre(r, 0.75, (0, 0, 0), "pierre", "fixe", pans=20, arrondi=0.05)
    m.cylindre(r + 0.05, 0.10, (0, 0, 0.72), "pierre_claire", "fixe", pans=20, arrondi=0.04)
    m.cylindre(r - 0.16, 0.02, (0, 0, 0.80), "eau_sombre", "fixe", pans=20)
    for sx in (-1, 1):
        m.boite((0.12, 0.12, 1.55), (sx * (r - 0.05), 0, 0.82), *c("bois"), arrondi=0.03)
    m.cylindre(0.06, 2 * r + 0.1, (-(r + 0.05), 0, 1.65), *c("bois"), pans=10, rot=(0, 90, 0))
    m.cylindre(0.016, 0.25, (r + 0.05, 0, 1.71), *c("metal"), pans=6, rot=(0, 90, 0))
    m.cylindre(0.016, 0.20, (r + 0.29, 0, 1.71), *c("metal"), pans=6, rot=(0, 0, 0))
    # Petit toit à deux pans sur les montants.
    o = r + 0.30
    for sy in (-1, 1):
        pts = []
        for x in (-o, o):
            for (y, z) in ((0, 2.55), (sy * (r + 0.15), 2.15)):
                pts += [(x, y, z), (x, y, z + 0.07)]
        m.enveloppe(pts, *c("peinture"), arrondi=0.02)
    m.cylindre(0.10, 0.18, (0, 0, 1.35), *c("bois"), pans=10, arrondi=0.02)
    return {}


def buches(m, p, c):
    L = p.get("longueur", 0.9)
    k = 0
    for rang, n in enumerate((4, 3, 2)):
        for i in range(n):
            y = (i - (n - 1) / 2) * 0.22
            z = 0.11 + rang * 0.19
            m.cylindre(0.105 - 0.01 * (k % 3), L - 0.04 * (k % 2), (-(L / 2), y, z), *c("bois"), pans=10, rot=(0, 90, 0), arrondi=0.015)
            m.cylindre(0.08 - 0.01 * (k % 3), 0.01, (L / 2 - 0.04 * (k % 2), y, z), "bois_clair", "fixe", pans=10, rot=(0, 90, 0))
            k += 1
    return {}


# ---------------------------------------------------------------- végétation
def arbre(m, p, c):
    forme = p.get("forme", "rond")
    h = p.get("hauteur", 5.0)
    tronc = p.get("tronc", 1.8)
    m.cylindre(0.18 * h / 5, tronc + 0.3, (0, 0, 0), "ecorce", "fixe", pans=10, rayon_haut=0.11 * h / 5)
    m.cylindre(0.26 * h / 5, 0.25, (0, 0, 0), "ecorce", "fixe", pans=10, rayon_haut=0.17 * h / 5, arrondi=0.04)
    fe, cl = p.get("feuillage", "feuillage"), p.get("feuillage_clair", "feuillage_clair")
    if forme == "conique":
        etages = 4
        for k in range(etages):
            z = tronc * 0.55 + k * (h - tronc * 0.55) / (etages + 0.3)
            r = (h / 5) * 1.25 * (1 - k / (etages + 0.6))
            hh = (h - tronc * 0.55) / etages * 1.35
            m.cylindre(r, hh, (0, 0, z), fe, "fixe", pans=14, rayon_haut=r * 0.25, arrondi=min(0.25, r * 0.3), seg=3)
        return {"collision": {"rayon": 0.25 * h / 5}}
    rr = (h - tronc) / 2
    boules = [(0, 0, tronc + rr, rr * 1.0), (rr * 0.65, 0.2, tronc + rr * 0.8, rr * 0.68),
              (-rr * 0.6, -0.25, tronc + rr * 0.85, rr * 0.7), (0.1, rr * 0.6, tronc + rr * 1.0, rr * 0.66),
              (-0.15, -rr * 0.55, tronc + rr * 1.1, rr * 0.62)]
    for x, y, z, r in boules:
        m.boule(r, (x, y, z), fe, "fixe", pans=14, anneaux=9, haut=cl, echelle=(1, 1, 0.9))
    for x, y, z in p.get("fruits", []):
        # Posées sur la surface de la grande boule (rayon rr, aplatie à 0,9), à moitié enfoncées.
        n = math.sqrt(x * x + y * y + z * z) or 1.0
        m.boule(0.08, (x / n * rr * 1.0, y / n * rr * 1.0, tronc + rr + z / n * rr * 0.9), p.get("fruit", "pomme"), "fixe",
                pans=8, anneaux=6)
    return {"collision": {"rayon": 0.25 * h / 5}}


def buisson(m, p, c):
    r = p.get("rayon", 0.55)
    fe, cl = p.get("feuillage", "feuillage"), p.get("feuillage_clair", "feuillage_clair")
    for x, y, z, k in ((0, 0, 0.75, 1.0), (0.55, 0.1, 0.6, 0.72), (-0.5, -0.1, 0.62, 0.75), (0.05, -0.45, 0.6, 0.7)):
        # Centre assez haut pour que le dessous de la boule (aplatie à 0,85) touche le sol sans s'y enfoncer.
        m.boule(r * k, (x * r, y * r, max(z * r, r * k * 0.85 + 0.002)), fe, "fixe", pans=12, anneaux=8, haut=cl, echelle=(1, 1, 0.85))
    for k, (x, y, z) in enumerate(p.get("fleurs", [])):
        m.boule(0.05, (x * r, y * r, z * r), p.get("fleur", "coquelicot"), "fixe", pans=8, anneaux=5)
    return {}


def touffe(m, p, c):
    n = p.get("brins", 9)
    h = p.get("hauteur", 0.35)
    for k in range(n):
        a = k * 2.399
        d = 0.05 + 0.07 * ((k * 7) % 5) / 4
        m.cylindre(0.035, h * (0.7 + 0.3 * ((k * 3) % 4) / 3), (math.cos(a) * d, math.sin(a) * d, 0.012), p.get("couleur", "herbe"), "fixe",
                   pans=5, rayon_haut=0.004, rot=(math.sin(a) * 18, -math.cos(a) * 18, 0))
    return {}


def fleurs(m, p, c):
    n = p.get("tiges", 5)
    for k in range(n):
        a = k * 2.399
        d = 0.04 + 0.12 * ((k * 5) % 7) / 6
        hh = 0.28 + 0.12 * ((k * 3) % 4) / 3
        x, y = math.cos(a) * d, math.sin(a) * d
        m.cylindre(0.012, hh, (x, y, 0), "tige", "fixe", pans=5)
        m.boule(0.045, (x, y, hh + 0.02), p.get("teintes", ["coquelicot"])[k % len(p.get("teintes", ["coquelicot"]))], "fixe",
                pans=8, anneaux=5, echelle=(1, 1, 0.6))
        m.boule(0.016, (x, y, hh + 0.045), "moutarde", "fixe", pans=6, anneaux=4)
    for k in range(3):
        a = k * 2.1
        m.boule(0.08, (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.04), "feuillage", "fixe", pans=8, anneaux=5, echelle=(1.4, 0.7, 0.45),
                rot=(0, 0, math.degrees(a)))
    return {}


def souche(m, p, c):
    r = p.get("rayon", 0.32)
    m.cylindre(r, 0.38, (0, 0, 0), "ecorce", "fixe", pans=12, rayon_haut=r * 0.86, arrondi=0.03)
    m.cylindre(r * 0.82, 0.02, (0, 0, 0.38), "bois_clair", "fixe", pans=12)
    for k in range(4):
        a = math.radians(30 + k * 90)
        m.boule(0.11, (math.cos(a) * r * 0.95, math.sin(a) * r * 0.95, 0.068), "ecorce", "fixe", pans=8, anneaux=6,
                echelle=(1.8, 0.8, 0.6), rot=(0, 0, math.degrees(a)))
    return {"plateau": {"hauteur": 0.40}}


FAMILLES = {
    "chaise": chaise, "tabouret": tabouret, "banc": banc, "table": table, "lit": lit, "armoire": armoire,
    "coffre": coffre, "etagere": etagere, "rechaud": rechaud, "evier": evier, "pompe": pompe,
    "baignoire": baignoire, "lampe": lampe, "tapis": tapis, "reverbere": reverbere, "poteau-quai": poteau_quai,
    "barriere": barriere, "panneau": panneau, "boite-aux-lettres": boite_aux_lettres, "tonneau": tonneau,
    "caisse": caisse, "puits": puits, "buches": buches, "arbre": arbre, "buisson": buisson, "touffe": touffe,
    "fleurs": fleurs, "souche": souche,
}
