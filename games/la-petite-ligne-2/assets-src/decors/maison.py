"""Maison paramétrique: murs (avec ouvertures) et toit en deux nœuds séparés, pour le fondu.

Paramètres (gabarits.toml, famille `maison`): `largeur` (X, est-ouest), `profondeur` (Y), `etages`
(niveaux pleins), `hauteur_etage`, `toit` (`deux-pans`, `croupe`, `appentis`), `pente` (degrés),
`debord`, `portes` (liste de {facade, position de 0 à 1 depuis la gauche vue de dehors}),
`fenetres` ({facade: nombre par niveau}), `devanture` ({facade, largeur, enseigne}), `cheminee`,
`volets`. Couleurs: `murs`, `toit`, `menuiseries`, `volets`, `soubassement`.

Une façade se nomme par son orientation: sud = avant (-Y Blender, +Z glTF), nord, est (+X), ouest.
Le faîtage d'un toit à deux pans suit la plus grande dimension.
"""
import math

PORTE_H = 2.05     # passage libre: une figurine de 1,80 m passe avec son chapeau
PORTE_L = 1.0
FENETRE = (0.8, 1.05)
ALLEGE = 0.95
SAILLIE = 0.006    # panneaux toujours devant le mur (carnet: jamais en retrait dans une boîte pleine)


def _repere(facade, w, d):
    """Origine du mur vu de dehors (bord gauche, au sol), axe « droite », normale sortante, longueur."""
    if facade == "sud":
        return (-w / 2, -d / 2), (1, 0), (0, -1), w
    if facade == "nord":
        return (w / 2, d / 2), (-1, 0), (0, 1), w
    if facade == "est":
        return (w / 2, -d / 2), (0, 1), (1, 0), d
    if facade == "ouest":
        return (-w / 2, d / 2), (0, -1), (-1, 0), d
    raise SystemExit(f"façade inconnue: {facade}")


def _panneau(m, facade, w, d, u, z, lw, lh, ep, avance, couleur, zone="peinture", arrondi=0.02):
    """Boîte posée contre une façade: `u` le long du mur depuis la gauche, `z` le bas, `avance` hors du mur."""
    (ox, oy), (rx, ry), (nx, ny), _ = _repere(facade, w, d)
    cx = ox + rx * u + nx * (avance + ep / 2 - 0.0)
    cy = oy + ry * u + ny * (avance + ep / 2 - 0.0)
    taille = (lw, ep, lh) if rx != 0 else (ep, lw, lh)
    return m.boite(taille, (cx, cy, z), couleur, zone, arrondi=arrondi)


def maison(m_murs, m_toit, p, c):
    w, d = p["largeur"], p["profondeur"]
    n = p.get("etages", 1)
    he = p.get("hauteur_etage", 2.8)
    egout = n * he
    toit = p.get("toit", "deux-pans")
    pente = math.radians(p.get("pente", 40))
    o = p.get("debord", 0.4)
    ep_t = 0.18
    murs, men, vol = c("murs"), c("menuiseries"), c("volets")
    sb = c("soubassement")

    # --------------------------------------------------------- murs
    le_long_x = w >= d
    if toit == "deux-pans":
        demi = (d if le_long_x else w) / 2
        faite = egout + demi * math.tan(pente)
        if le_long_x:
            profil = [(-d / 2, 0), (d / 2, 0), (d / 2, egout), (0, faite - 0.01), (-d / 2, egout)]
            m_murs.prisme(profil, w, *murs, axe="x", arrondi=0.06)
        else:
            profil = [(-w / 2, 0), (w / 2, 0), (w / 2, egout), (0, faite - 0.01), (-w / 2, egout)]
            m_murs.prisme(profil, d, *murs, axe="y", arrondi=0.06)
    elif toit == "appentis":
        haut = egout + d * math.tan(pente)
        m_murs.prisme([(-d / 2, 0), (d / 2, 0), (d / 2, haut - 0.01), (-d / 2, egout)], w, *murs, axe="x", arrondi=0.06)
        faite = haut
    else:
        m_murs.boite((w, d, egout), (0, 0, 0), *murs, arrondi=0.06)
        faite = egout + min(w, d) / 2 * math.tan(pente)
    # Soubassement de pierre: arêtes du dessus arrondies, rien ne repose dessus en porte-à-faux.
    m_murs.boite((w + 0.06, d + 0.06, 0.45), (0, 0, 0), *sb, arrondi=0.04)
    if n > 1:
        for k in range(1, n):
            m_murs.boite((w + 0.05, d + 0.05, 0.10), (0, 0, k * he - 0.05), *sb, arrondi=0.035)

    # --------------------------------------------------------- portes
    portes_out = []
    occupe = {}
    for porte in p.get("portes", []):
        f = porte["facade"]
        _, (rx, ry), (nx, ny), L = _repere(f, w, d)
        u = porte.get("position", 0.5) * L
        occupe.setdefault(f, []).append(u)
        _panneau(m_murs, f, w, d, u, 0.0, PORTE_L + 0.20, PORTE_H + 0.12, 0.06, SAILLIE, *men, arrondi=0.03)
        _panneau(m_murs, f, w, d, u, 0.12, PORTE_L, PORTE_H - 0.12, 0.05, SAILLIE + 0.03, *c("porte"), arrondi=0.02)
        (ox, oy), _, _, _ = _repere(f, w, d)
        # Marche de pierre devant le seuil (le sol du jeu est à 0: marche de 12 cm).
        _panneau(m_murs, f, w, d, u, 0.0, PORTE_L + 0.4, 0.12, 0.40, 0.0, *sb, arrondi=0.03)
        poignee = (u + (PORTE_L / 2 - 0.12))
        _panneau(m_murs, f, w, d, poignee, 1.0, 0.05, 0.05, 0.05, SAILLIE + 0.07, *c("metal"), arrondi=0.02)
        px, py = ox + rx * u + nx * 0.5, oy + ry * u + ny * 0.5
        portes_out.append({"facade": f, "x": round(px, 3), "y": round(py, 3), "largeur": PORTE_L,
                           "hauteur": round(PORTE_H, 3), "cap": [nx, ny]})

    # --------------------------------------------------------- devanture
    dv = p.get("devanture")
    if dv:
        f = dv["facade"]
        _, _, _, L = _repere(f, w, d)
        lw = dv.get("largeur", L * 0.6)
        u = dv.get("position", 0.5) * L
        occupe.setdefault(f, []).append(u)
        _panneau(m_murs, f, w, d, u, 0.0, lw + 0.3, 2.75, 0.08, SAILLIE, *men, arrondi=0.03)
        _panneau(m_murs, f, w, d, u, 0.12, lw, 0.62, 0.06, SAILLIE + 0.04, *men, arrondi=0.02)
        vitre_l = (lw - PORTE_L - 0.15) / 2
        for s in (-1, 1):
            _panneau(m_murs, f, w, d, u + s * (PORTE_L / 2 + 0.075 + vitre_l / 2), 0.8, vitre_l, 1.45, 0.03, SAILLIE + 0.06, *c("vitre"), arrondi=0.01)
        _panneau(m_murs, f, w, d, u, 0.12, PORTE_L, PORTE_H - 0.12, 0.05, SAILLIE + 0.06, *c("porte"), arrondi=0.02)
        _panneau(m_murs, f, w, d, u, 0.0, lw + 0.4, 0.12, 0.40, 0.0, *sb, arrondi=0.03)
        _panneau(m_murs, f, w, d, u, 2.30, lw + 0.1, 0.42, 0.06, SAILLIE + 0.08, *c("enseigne"), arrondi=0.03)
        # Store (auvent) incliné au-dessus de la vitrine.
        (ox, oy), (rx, ry), (nx, ny), _ = _repere(f, w, d)
        pts = []
        for s in (-1, 1):
            # Haut du store sous l'enseigne, bas à 1,97 m: on passe dessous.
            for (a, z) in ((0.05, 2.27), (0.95, 1.97)):
                bx = ox + rx * (u + s * (lw / 2 + 0.05)) + nx * a
                by = oy + ry * (u + s * (lw / 2 + 0.05)) + ny * a
                pts += [(bx, by, z), (bx, by, z + 0.06)]
        m_murs.enveloppe(pts, *c("store"), arrondi=0.025)
        (ox, oy), _, _, _ = _repere(f, w, d)
        px, py = ox + rx * u + nx * 0.5, oy + ry * u + ny * 0.5
        portes_out.append({"facade": f, "x": round(px, 3), "y": round(py, 3), "largeur": PORTE_L,
                           "hauteur": round(PORTE_H, 3), "cap": [nx, ny]})

    # --------------------------------------------------------- fenêtres
    for f, nombre in p.get("fenetres", {}).items():
        _, _, _, L = _repere(f, w, d)
        for niveau in range(n):
            slots = [L * (k + 0.5) / nombre for k in range(nombre)]
            if niveau == 0:
                # Au rez-de-chaussée, une fenêtre ne prend pas la place d'une porte ou d'une vitrine.
                libres = [u for u in slots if all(abs(u - q) > 1.4 for q in occupe.get(f, []))]
                if dv and dv["facade"] == f:
                    libres = [u for u in libres if abs(u - dv.get("position", 0.5) * L) > dv.get("largeur", L * 0.6) / 2 + 0.7]
                slots = libres
            for u in slots:
                z = niveau * he + ALLEGE
                fw, fh = FENETRE
                _panneau(m_murs, f, w, d, u, z - 0.06, fw + 0.16, fh + 0.16, 0.05, SAILLIE, *men, arrondi=0.025)
                _panneau(m_murs, f, w, d, u, z, fw, fh, 0.03, SAILLIE + 0.035, *c("vitre"), arrondi=0.012)
                _panneau(m_murs, f, w, d, u, z + fh / 2 - 0.03, fw, 0.05, 0.03, SAILLIE + 0.055, *men, arrondi=0.012)
                _panneau(m_murs, f, w, d, u, z - 0.12, fw + 0.28, 0.07, 0.14, SAILLIE, *sb, arrondi=0.025)
                if p.get("volets", True):
                    for s in (-1, 1):
                        _panneau(m_murs, f, w, d, u + s * (fw / 2 + 0.08 + fw / 4), z - 0.04, fw / 2 - 0.02, fh + 0.08, 0.04,
                                 SAILLIE, *vol, arrondi=0.02)

    # --------------------------------------------------------- toit
    if toit == "deux-pans":
        demi = (d if le_long_x else w) / 2
        long_ = (w if le_long_x else d) + 2 * o * 0.6
        ux, uz = math.cos(pente), -math.sin(pente)
        for s in (-1, 1):
            # Dessous du pan: du faîtage (0, faite) à l'égout (demi, egout), prolongé du débord.
            R = (0.0, faite)
            E = (demi + o, egout - o * math.tan(pente))
            nrm = (math.sin(pente), math.cos(pente))
            pts = []
            for a in (-long_ / 2, long_ / 2):
                for (y, z) in (R, E, (R[0] + nrm[0] * ep_t, R[1] + nrm[1] * ep_t), (E[0] + nrm[0] * ep_t, E[1] + nrm[1] * ep_t)):
                    yy = s * y
                    pts.append((a, yy, z) if le_long_x else (yy, a, z))
            m_toit.enveloppe(pts, *c("toit"), arrondi=0.05)
        # Faîtière ronde qui ferme le V entre les deux pans.
        if le_long_x:
            m_toit.cylindre(0.13, long_ + 0.04, (-(long_ + 0.04) / 2, 0, faite + ep_t * 0.75), *c("toit"), pans=10, rot=(0, 90, 0), arrondi=0.03)
        else:
            m_toit.cylindre(0.13, long_ + 0.04, (0, (long_ + 0.04) / 2, faite + ep_t * 0.75), *c("toit"), pans=10, rot=(90, 0, 0), arrondi=0.03)
        _ = (ux, uz)
    elif toit == "appentis":
        pts = []
        for x in (-(w / 2 + o * 0.6), w / 2 + o * 0.6):
            for (y, z) in ((-(d / 2 + o), egout - o * math.tan(pente)), (d / 2 + 0.15, faite + 0.15 * math.tan(pente))):
                pts += [(x, y, z), (x, y, z + ep_t)]
        m_toit.enveloppe(pts, *c("toit"), arrondi=0.05)
    else:
        # Croupe: enveloppe convexe d'un bord épais et d'un faîtage court.
        hw, hd = w / 2 + o, d / 2 + o
        zb = egout - o * math.tan(pente)
        r = abs(w - d) / 2
        faite_pts = [(-r, 0), (r, 0)] if w >= d else [(0, -r), (0, r)]
        pts = [(sx * hw, sy * hd, zb) for sx in (-1, 1) for sy in (-1, 1)]
        pts += [(sx * hw, sy * hd, zb + ep_t) for sx in (-1, 1) for sy in (-1, 1)]
        pts += [(x, y, faite + ep_t) for x, y in faite_pts]
        m_toit.enveloppe(pts, *c("toit"), arrondi=0.06)
    if p.get("cheminee", True) and toit != "appentis":
        # Souche près du faîtage: elle sort du toit de 1 m au plus, pas en pilier à l'égout.
        if toit == "croupe":
            cx, cy = ((abs(w - d) / 4, 0.5) if w >= d else (0.5, abs(w - d) / 4))
        else:
            cx = (w / 2 - 0.9) if le_long_x else 0.35
            cy = 0.35 if le_long_x else (d / 2 - 0.9)
        # Le pied de la souche descend sous le pan (enfoncé), elle dépasse le faîtage de 40 cm.
        m_toit.boite((0.55, 0.55, faite + 0.4 - (egout + 0.3)), (cx, cy, egout + 0.3), *c("soubassement"), arrondi=0.04)
        m_toit.boite((0.65, 0.65, 0.1), (cx, cy, faite + 0.4), *c("soubassement"), arrondi=0.03)

    return {"portes": portes_out, "egout": round(egout, 3), "faite": round(faite + ep_t, 3),
            "collision": {"boite": [w, d, round(egout, 3)]}}
