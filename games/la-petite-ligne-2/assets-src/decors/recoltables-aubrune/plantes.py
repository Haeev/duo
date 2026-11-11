"""Ports des cultures du potager, à côté de « rosette » et « tuteur » (`familles.py`).

Un port dessine UN plant posé en (x, z) sur le dessus d'un billon, au stade voulu:
- `fanes` (carotte): touffe de fanes fines et dressées, l'épaule orange sort de terre à maturité;
- `eventail` (poireau): feuilles plates en éventail dans un seul plan, fût blanc à maturité;
- `touffe` (pomme de terre): butte de feuillage, fleurs avant la maturité, fanes jaunies et
  tubercules à fleur de terre quand on peut arracher;
- `fleur` (les douze fleurs des collections): levée, feuillage, bouton coloré, puis la fleur
  ouverte, dont la `forme` fixe la silhouette vue de haut (étoile, marguerite, capitule...).

Lisibilité à 18 m de vue (76 points par mètre): une tête de fleur fait au moins 4 cm de rayon,
posée au sommet et un peu tournée vers le sud (+z), d'où regarde la caméra. Les teintes d'une
fleur sont celles de sa fiche des collections (`collections-aubrune-assets.md`).
"""

from __future__ import annotations

import math

from familles import SOL_PLANT
from formes import Atelier, at, entre, penche, tirage, ton


def _cotyledons(s: Atelier, ctx, x, z, graine, tons, y=SOL_PLANT, longueur=0.055):
    """La levée: deux cotylédons ronds à plat, comme au potager."""
    for k in range(2):
        a = graine + k * math.pi
        s.feuille((x, y + 0.012, z), (math.cos(a), 0.25, math.sin(a)), longueur, longueur * 0.9, "tige", tons[2 % len(tons)], envers=ton(tons[0], 0.75), cambre=0.2)


def _disque(s: Atelier, x, y, z, rayons, couleurs, envers, graine, incline=0.3, creux=0.0, cap=None, mat="fleur"):
    """Corolle plate vue de haut: un éventail de faces autour du coeur. `rayons`: un rayon par
    pointe (alterner long et court fait une étoile); `couleurs`: une par face (pensée bicolore).
    Inclinée de `incline` vers le sud (+z) pour se montrer à la caméra."""
    n = len(rayons)
    a0 = tirage(graine) * math.tau if cap is None else cap
    pts = [(0, -0.004, 0)] + [(math.cos(a0 + k / n * math.tau) * r, creux * (r / max(rayons)), math.sin(a0 + k / n * math.tau) * r) for k, r in enumerate(rayons)]
    faces = [(0, k + 1, (k + 1) % n + 1) for k in range(n)]
    s.morceau(pts, faces, mat, couleurs, at(x, y, z, 0, incline + penche(graine, 0.12), penche(graine + 1, 0.15)), coeur=(0, -1, 0), double=True, envers=envers)


def _coeur(s: Atelier, rx, ry, rz, matrice, mat, couleur):
    """Coeur de fleur: une pyramide à quatre pans (le dessous est dans la corolle)."""
    s.morceau([(rx, 0, 0), (0, 0, rz), (-rx, 0, 0), (0, 0, -rz), (0, ry, 0)], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], mat, couleur, matrice, coeur=(0, -ry, 0))


def _etoile(r, pointes, creux_rel):
    return [r if k % 2 == 0 else r * creux_rel for k in range(2 * pointes)]


# ====================================================================== légumes
def fanes(s: Atelier, ctx, entree, x, z, graine, stade, stades, soif):
    """Carotte: une touffe de fanes fines et dressées (plus haute et plus légère que la rosette du
    radis); à maturité, l'épaule orange affleure au pied."""
    tons = ctx.tons("feuille_soif" if soif else entree.get("feuille", "fanes"))
    y = SOL_PLANT
    if stade == 0:
        _cotyledons(s, ctx, x, z, graine, tons, longueur=0.045)
        return
    part = stade / stades
    H = entree["hauteur"] * (0.5 + 0.5 * part)
    n = 4 if part < 0.6 else 6
    # Fanes: un plumet de folioles qui s'ouvre en gerbe (des lames dressées, vues par la
    # tranche, sortaient noires); chaque fane porte deux folioles, la dentelle de la carotte.
    for k in range(n):
        a = graine + k / n * math.tau + penche(graine + k, 0.25)
        leve = (0.25 if soif else 1.1) * entre(0.85, 1.15, graine + k * 1.7)
        h = H * entre(0.8, 1.05, graine + k * 2.3)
        s.feuille((x, y, z), (math.cos(a), leve, math.sin(a)), h, h * 0.42, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.8), cambre=0.45 if soif else 0.32)
        b = a + 0.5
        s.feuille((x + math.cos(a) * h * 0.25, y + h * 0.3 * min(leve, 1.0), z + math.sin(a) * h * 0.25), (math.cos(b), leve * 0.8, math.sin(b)), h * 0.55, h * 0.3, "tige", tons[(k + 2) % len(tons)], envers=ton(tons[0], 0.8), cambre=0.3)
    if stade == stades:
        orange = ctx.tons(entree["fruit"])
        # L'épaule déborde au sud du pied des fanes: la caméra la voit sous le feuillage.
        s.tube([(x, y - 0.01, z + 0.03, 0.055), (x, y + 0.04, z + 0.03, 0.052), (x, y + 0.06, z + 0.03, 0.03)], 6, "fruit", orange[int(graine * 7) % len(orange)], bouts=(False, True), coupe=ton(orange[0], 0.85))


def eventail(s: Atelier, ctx, entree, x, z, graine, stade, stades, soif):
    """Poireau: des feuilles plates en éventail dans un seul plan (le poireau se reconnaît à ça
    de haut), bleu-vert; à maturité, un fût blanc buté de terre."""
    tons = ctx.tons("feuille_soif" if soif else entree.get("feuille", "poireau_feuille"))
    y = SOL_PLANT
    plan = graine * 2.3
    dx, dz = math.cos(plan), math.sin(plan)
    if stade == 0:
        for k in range(2):
            s.brin((x, y, z), (x + dx * 0.03 * (k * 2 - 1), y + 0.1, z + dz * 0.03 * (k * 2 - 1)), 0.016, "tige", tons[k], envers=ton(tons[0], 0.8))
        return
    part = stade / stades
    H = entree["hauteur"] * (0.45 + 0.55 * part)
    fut = H * 0.32 if stade == stades else H * 0.14
    rf = 0.022 + 0.014 * part
    blanc = ctx.tons(entree["fruit"])
    s.tube([(x, y - 0.01, z, rf * 1.1), (x, y + fut, z, rf)], 5, "fruit", blanc[0] if stade == stades else ton(tons[0], 1.05), bouts=(False, True), coupe=ctx.un(entree["fruit"], 1), rond=False)
    n = 3 if part < 0.6 else 5
    for k in range(n):
        # Les feuilles s'ouvrent de part et d'autre du fût et retombent en arc: leur dessus
        # bleu-vert se voit de haut (dressées, on ne voyait que leur tranche sombre).
        cote = (k - (n - 1) / 2) / max(1, (n - 1) / 2)
        a = cote * (1.35 if soif else 1.05) + penche(graine + k, 0.1)
        if abs(cote) < 0.01:
            a = 0.35 * (1 if k % 2 else -1)
        d = (math.sin(a) * dx, math.cos(a) * 0.9, math.sin(a) * dz)
        long = H * (1.0 - 0.12 * abs(cote)) * entre(0.88, 1.05, graine + k)
        s.feuille((x, y + fut * 0.85, z), d, long * (0.62 if soif else 0.6), 0.075, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.85), cambre=0.75 if soif else 0.55)


def touffe(s: Atelier, ctx, entree, x, z, graine, stade, stades, soif):
    """Pomme de terre: une butte de feuillage sombre; avant la maturité, des fleurs blanches au
    coeur jaune; à maturité, le feuillage jaunit et des tubercules affleurent au pied."""
    tons = ctx.tons("feuille_soif" if soif else entree.get("feuille", "feuille_patate"))
    y = SOL_PLANT
    if stade == 0:
        _cotyledons(s, ctx, x, z, graine, tons)
        s.galet(0.03, 0.02, 0.03, at(x + 0.04, y - 0.01, z, graine), "terre", ctx.un("terre_billon_dessus"), graine, points=6)
        return
    part = stade / stades
    mur = stade == stades
    if mur:
        tons = [ton(c, 1.0, ctx.un("paille"), 0.45) for c in tons]
    # Trois pieds par case (un par billon, 33 cm d'écart): la butte tient dans sa case.
    r = entree["hauteur"] * (0.26 + 0.2 * part)
    masses = 1 if part < 0.6 else 2
    hauts = []
    for i in range(masses):
        a = graine + i * 2.6
        ox, oz = (math.cos(a) * r * 0.32, math.sin(a) * r * 0.32) if masses > 1 else (0.0, 0.0)
        rr = r * (0.82 if i else 1.0) * (1.05 if soif else 1.0)
        s.calotte(x + ox, y - rr * (0.18 if not soif else 0.3), z + oz, rr, graine + i * 3.7, tons[i % len(tons)], segments=7, dome=0.8 if not soif else 0.45, dents=0.22 if not soif else 0.36, laches=0, rangs=2)
        hauts.append((x + ox, y + rr * (0.62 if not soif else 0.4), z + oz, rr))
    if stade == stades - 1 and stades > 1 and not soif:
        fleur, coeur = ctx.tons(entree.get("fleur", "fleur_patate")), ctx.un("bouton_or")
        for i in range(3):
            cx, cy, cz, rr = hauts[i % len(hauts)]
            b = graine + i * 2.1
            _disque(s, cx + math.cos(b) * rr * 0.4, cy, cz + math.sin(b) * rr * 0.4, _etoile(0.035, 5, 0.55), fleur[i % len(fleur)], ton(fleur[0], 0.8), graine + i, incline=0.2)
            s.octa(0.012, 0.014, 0.012, at(cx + math.cos(b) * rr * 0.4, cy + 0.008, cz + math.sin(b) * rr * 0.4), "fleur", coeur)
    if mur:
        patate = ctx.tons(entree["fruit"])
        # Tubercules sortis de la butte côté sud (+z): c'est là que la caméra les voit.
        for i in range(3):
            b = 0.6 + i * 0.95 + penche(graine + i, 0.2)
            d = r * entre(1.0, 1.15, graine + i)
            s.galet(0.055, 0.045, 0.047, at(x + math.cos(b) * d, y - 0.012, z + abs(math.sin(b)) * d * 0.55, b), "fruit", patate[i % len(patate)], graine + i * 5, points=8, pose=0.35)


# ====================================================================== fleurs
def _feuillage_fleur(s: Atelier, ctx, entree, x, z, graine, part, soif, tons):
    """Le pied d'une fleur: sa couronne de feuilles (la forme de feuille de sa fiche)."""
    y = SOL_PLANT
    sorte = entree.get("feuillage", "lance")
    H = entree["hauteur"]
    if sorte == "ronde":
        # Capucine: feuilles rondes à plat, sur de courts pétioles, qui couvrent le billon.
        n = 3 if part < 0.6 else 5
        for k in range(n):
            a = graine + k / n * math.tau + penche(graine + k, 0.3)
            d = entre(0.07, 0.16, graine + k * 1.3) * (0.6 + 0.4 * part)
            rr = entre(0.05, 0.07, graine + k * 2.9) * (0.7 + 0.3 * part)
            h = entre(0.05, 0.12, graine + k * 4.1) * (0.5 if soif else 1.0)
            _disque(s, x + math.cos(a) * d, y + h, z + math.sin(a) * d, [rr] * 6, tons[k % len(tons)], ton(tons[0], 0.75), graine + k * 3, incline=0.15 if not soif else 0.6, mat="tige")
        return
    if sorte == "larges":
        # Muguet: deux grandes feuilles ovales qui s'ouvrent autour de la hampe (dressées, on ne
        # voyait que leur tranche).
        for k in range(2):
            a = graine + k * math.pi + 0.4
            s.feuille((x, y, z), (math.cos(a), 1.1 if not soif else 0.35, math.sin(a)), H * (1.0 if part >= 0.6 else 0.65), 0.1, "tige", tons[k], envers=ton(tons[0], 0.8), cambre=0.35 if not soif else 0.6)
        return
    if sorte == "fines":
        # Bleuet, nigelle: un feuillage fin et gris-vert, en brins.
        n = 4 if part < 0.6 else 6
        for k in range(n):
            a = graine + k / n * math.tau
            e = (0.5 if soif else 0.28) * entre(0.7, 1.2, graine + k)
            h = H * 0.42 * entre(0.75, 1.05, graine + k * 2.3) * (0.6 + 0.4 * part) * (0.7 if soif else 1.0)
            s.brin((x, y, z), (x + math.cos(a) * e * h, y + h, z + math.sin(a) * e * h), 0.035, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.75))
        return
    if sorte == "buisson":
        # Rosier: un buisson de trois masses de feuillage sombre (une seule calotte se lisait
        # comme une grande feuille), la plus haute au nord.
        r = H * 0.3 * (0.55 + 0.45 * part)
        masses = ((0.0, 0.0, 0.0, 1.0), (-0.55, 0.15, 0.4, 0.85), (0.5, 0.35, -0.3, 0.8)) if part >= 0.6 else ((0.0, 0.0, 0.0, 1.0), (0.5, 0.1, 0.3, 0.75))
        for k, (ox, oy, oz, t) in enumerate(masses):
            rr = r * t * (1.05 if soif else 1.0)
            s.calotte(x + ox * r, y + H * 0.3 * part + oy * r, z + oz * r, rr, graine + k * 7, tons[k % len(tons)], segments=7, dome=0.9 if not soif else 0.55, dents=0.3 if not soif else 0.5, laches=0, rangs=2)
        return
    # Couronne de feuilles lancéolées au pied (souci, pensée, giroflée, marguerite, œillet...).
    n = 3 if part < 0.6 else 5
    long = min(0.16, H * 0.45) * (0.6 + 0.4 * part)
    for k in range(n):
        a = graine + k / n * math.tau + penche(graine + k, 0.2)
        leve = (0.2 if soif else 0.65) * entre(0.8, 1.2, graine + k * 2.1)
        s.feuille((x, y, z), (math.cos(a), leve, math.sin(a)), long * entre(0.85, 1.1, graine + k), long * 0.42, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.72), cambre=0.5 if soif else 0.3)


def _tete(s: Atelier, ctx, entree, x, y, z, graine, soif):
    """Une fleur ouverte, selon la `forme` de l'entrée."""
    forme = entree["forme"]
    r = entree["rayon"]
    corolle = ctx.tons(entree["corolle"])
    c0 = corolle[int(tirage(graine) * len(corolle)) % len(corolle)]
    if soif:
        c0 = ton(c0, 0.86, ctx.un("feuille_soif"), 0.25)
    envers = ton(c0, 0.78)
    coeur = ctx.un(entree["coeur"]) if "coeur" in entree else None
    if forme == "etoile":
        # Bleuet: une étoile dentelée, bleu vif, coeur sombre.
        _disque(s, x, y, z, _etoile(r, 7, 0.64), c0, envers, graine)
        _coeur(s, r * 0.26, r * 0.22, r * 0.26, at(x, y + 0.008, z), "fleur", coeur)
    elif forme == "marguerite":
        # Marguerite: des rayons blancs fins, le coeur jaune bombé.
        _disque(s, x, y, z, _etoile(r, 8, 0.62), c0, envers, graine, incline=0.25)
        _coeur(s, r * 0.34, r * 0.24, r * 0.34, at(x, y + 0.012, z + 0.004), "fleur", coeur)
    elif forme == "capitule":
        # Tournesol: le grand capitule brun en couronne de pétales jaunes, tourné vers le sud.
        _disque(s, x, y, z, _etoile(r, 11, 0.62), c0, envers, graine, incline=0.75)
        _disque(s, x, y + 0.004, z + 0.012, [r * 0.56] * 8, ctx.un(entree["coeur"]), ton(ctx.un(entree["coeur"]), 0.8), graine + 1, incline=0.75, creux=0.02)
    elif forme == "pompon":
        # Souci: deux rangs de pétales serrés, l'intérieur plus clair et plus haut.
        _disque(s, x, y, z, _etoile(r, 7, 0.72), c0, envers, graine, incline=0.25)
        _disque(s, x, y + 0.012, z, _etoile(r * 0.66, 5, 0.7), ctx.un(entree["corolle"], 1), envers, graine + 2, incline=0.25)
        _coeur(s, r * 0.22, r * 0.2, r * 0.22, at(x, y + 0.022, z), "fleur", coeur)
    elif forme == "pensee":
        # Pensée: deux pétales du haut violets, trois du bas jaunes, la petite figure sombre.
        bas = ctx.un(entree["corolle"], 1)
        _disque(s, x, y, z, [r, r * 1.05, r * 0.7, r * 0.95, r * 0.9], [c0, c0, bas, bas, bas], envers, graine, incline=0.5, cap=-math.pi / 2 - 0.6)
        _coeur(s, r * 0.3, r * 0.15, r * 0.3, at(x, y + 0.006, z + 0.004), "fleur", coeur)
    elif forme == "coupe":
        # Violette, coquelicot: une coupe à cinq pétales, le coeur clair.
        _disque(s, x, y, z, [r] * 5, c0, envers, graine, incline=0.35, creux=0.012)
        _coeur(s, r * 0.3, r * 0.22, r * 0.3, at(x, y + 0.01, z), "fleur", coeur)
    elif forme == "cornet":
        # Capucine: un cornet orange, profond, ouvert vers le ciel et le sud.
        _disque(s, x, y, z, [r] * 5, c0, envers, graine, incline=0.6, creux=0.045)
        _coeur(s, r * 0.22, r * 0.2, r * 0.22, at(x, y + 0.006, z), "fleur", coeur)
    elif forme == "collerette":
        # Nigelle: une étoile bleu ciel dans une collerette de fils verts.
        fil = ctx.tons("tige")
        for k in range(6):
            a = graine + k / 6 * math.tau
            s.brin((x + math.cos(a) * r * 0.5, y - 0.004, z + math.sin(a) * r * 0.5), (x + math.cos(a) * r * 1.35, y + 0.02, z + math.sin(a) * r * 1.35), 0.012, "tige", fil[k % len(fil)])
        _disque(s, x, y, z, _etoile(r, 5, 0.6), c0, envers, graine, incline=0.3)
        _coeur(s, r * 0.24, r * 0.3, r * 0.24, at(x, y + 0.012, z), "fleur", coeur)
    elif forme == "frange":
        # Œillet de poète: un bouquet plat de petites fleurs rouges posé sur une collerette
        # blanche qui dépasse entre elles (le liseré blanc qui le signe de loin).
        blanc = ctx.un(entree["coeur"])
        _disque(s, x, y - 0.006, z, [r * 1.08] * 6, blanc, ton(blanc, 0.8), graine + 9, incline=0.2)
        for k in range(5):
            a = graine + k / 5 * math.tau
            d = 0.0 if k == 0 else r * 0.56
            px, pz = x + math.cos(a) * d, z + math.sin(a) * d
            _disque(s, px, y + (0.008 if k == 0 else 0.0), pz, [r * 0.4] * 5, c0, blanc, graine + k, incline=0.2, creux=0.006)
    elif forme == "rose":
        # Rose ancienne très pleine, en coupe: trois rangs de pétales serrés.
        _disque(s, x, y, z, [r * entre(0.9, 1.05, graine + k) for k in range(6)], c0, envers, graine, incline=0.3, creux=0.03)
        _disque(s, x, y + 0.016, z, [r * 0.64] * 5, ton(c0, 0.9, ctx.un(entree["coeur"]), 0.35), envers, graine + 3, incline=0.3, creux=0.02)
        _coeur(s, r * 0.26, r * 0.22, r * 0.26, at(x, y + 0.03, z), "fleur", ctx.un(entree["coeur"]))
    else:
        raise SystemExit(f"{entree['id']}: forme de fleur inconnue « {forme} »")


def _hampe(s: Atelier, ctx, entree, x, z, graine, k, h, soif):
    """Une hampe du pied au sommet: rend le sommet (où poser la fleur)."""
    tige = ctx.tons("tige")
    a = graine * 1.9 + k * 2.4
    d = 0.0 if k == 0 else entre(0.03, entree.get("ecart", 0.1), graine + k * 3.7)
    bx, bz = x + math.cos(a) * d * 0.4, z + math.sin(a) * d * 0.4
    tx, tz = x + math.cos(a) * d, z + math.sin(a) * d
    if soif:
        # La tête penche: la hampe se courbe vers le dehors.
        tx, tz = x + math.cos(a) * (d + h * 0.3), z + math.sin(a) * (d + h * 0.3)
        h *= 0.78
    y = SOL_PLANT
    epais = entree.get("tige", 0.0065)
    s.tube([(bx, y, bz, epais), ((bx + tx) / 2, y + h * 0.55, (bz + tz) / 2, epais * 0.9), (tx, y + h, tz, epais * 0.8)], 3, "tige", tige[k % len(tige)], rond=True)
    return tx, y + h, tz


def fleur(s: Atelier, ctx, entree, x, z, graine, stade, stades, soif):
    """Une fleur au potager: levée, feuillage, bouton coloré, fleur ouverte."""
    tons = ctx.tons("feuille_soif" if soif else entree.get("feuille", "feuille_potager"))
    if stade == 0:
        _cotyledons(s, ctx, x, z, graine, tons)
        return
    part = stade / stades
    _feuillage_fleur(s, ctx, entree, x, z, graine, part, soif, tons)
    ouverte = stade == stades
    bouton = stade == stades - 1
    if not (ouverte or bouton):
        return
    H = entree["hauteur"] * (1.0 if ouverte else 0.75)
    forme = entree["forme"]
    corolle = ctx.tons(entree["corolle"])
    tetes = entree.get("fleurs", 2)
    if forme == "capitule":
        # Tournesol: une tige épaisse, de grandes feuilles le long, une seule tête.
        tige = ctx.tons("tige")
        y = SOL_PLANT
        hx, hz = x, z + 0.04
        hh = H if not soif else H * 0.85
        s.tube([(x, y, z, 0.025), (x, y + hh * 0.5, z + 0.015, 0.02), (hx, y + hh, hz, 0.016)], 4, "tige", tige[0], rond=True)
        for k in range(4):
            a = graine + k * 2.4
            yy = y + hh * (0.25 + 0.17 * k)
            s.feuille((x, yy, z), (math.cos(a), 0.35 if not soif else -0.3, math.sin(a)), 0.2 - 0.025 * k, 0.15 - 0.02 * k, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.72), cambre=0.35)
        if ouverte:
            _tete(s, ctx, entree, hx, y + hh, hz + 0.02, graine, soif)
        else:
            s.octa(0.07, 0.05, 0.07, at(hx, y + hh, hz), "fleur", ton(tons[0], 0.95, corolle[0], 0.3))
        return
    if forme == "clochettes":
        # Muguet: une hampe arquée, les clochettes blanches pendues dessous.
        tige = ctx.tons("tige")
        y = SOL_PLANT
        a = graine * 2.1
        dx, dz = math.cos(a), math.sin(a)
        pts = [(x, y, z), (x + dx * 0.02, y + H * 0.75, z + dz * 0.02), (x + dx * 0.07, y + H, z + dz * 0.07), (x + dx * 0.12, y + H * 0.9, z + dz * 0.12)]
        s.tube([(*p, 0.006) for p in pts], 3, "tige", tige[0], rond=True)
        blanc = corolle[0] if ouverte else ton(tons[0], 1.15)
        for k in range(5):
            t = 0.25 + k * 0.18
            px = x + dx * (0.02 + 0.1 * t)
            pz = z + dz * (0.02 + 0.1 * t)
            py = y + H * (0.8 + 0.18 * math.sin(t * math.pi)) - 0.03
            rr = entree["rayon"] * (1.0 - 0.1 * k) * (1.0 if ouverte else 0.7)
            s.octa(rr, rr * 1.1, rr, at(px, py, pz, k), "fleur", blanc)
        return
    if forme == "grappe":
        # Giroflée: une hampe droite, l'épi de petites fleurs serrées dans le haut.
        for k in range(tetes):
            tx, ty, tz = _hampe(s, ctx, entree, x, z, graine, k, H * entre(0.85, 1.05, graine + k), soif)
            for j in range(5):
                b = graine + k + j * 2.3
                py = ty - j * H * 0.07
                rr = entree["rayon"] * (1.0 - 0.08 * j) * (1.0 if ouverte else 0.6)
                c = corolle[(j + k) % len(corolle)] if ouverte else ton(tons[0], 0.95, corolle[0], 0.35)
                s.octa(rr, rr * 0.8, rr, at(tx + math.cos(b) * rr * 0.8, py, tz + math.sin(b) * rr * 0.8, b), "fleur", c)
        return
    buisson = entree.get("feuillage") == "buisson"
    for k in range(tetes):
        h = H * entre(0.82, 1.05, graine + k * 1.3)
        if buisson:
            # Rosier: les roses sont posées sur le dessus du buisson, au bout de courtes tiges.
            r = H * 0.3
            a = graine * 1.7 + k / tetes * math.tau
            d = r * (0.25 if k == 0 else 0.75)
            tx, tz = x + math.cos(a) * d, z + math.sin(a) * d + 0.05
            ty = SOL_PLANT + H * 0.3 + r * (0.95 - 0.35 * (d / r) ** 2) * (0.7 if soif else 1.0)
        else:
            tx, ty, tz = _hampe(s, ctx, entree, x, z, graine, k, h, soif)
        if ouverte:
            _tete(s, ctx, entree, tx, ty, tz, graine + k * 5.1, soif)
        else:
            # Le bouton montre déjà sa couleur entre les sépales verts.
            rr = entree["rayon"] * 0.42
            s.octa(rr, rr * 1.3, rr, at(tx, ty + rr * 0.6, tz, k), "fleur", ton(tons[0], 0.95, corolle[0], 0.55))


PORTS = {"fanes": fanes, "eventail": eventail, "touffe": touffe, "fleur": fleur}
