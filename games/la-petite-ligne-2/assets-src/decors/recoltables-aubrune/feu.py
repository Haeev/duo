"""Feux de bois encrés: foyer (bûches croisées, braises, flammes), commun à tout ce qui brûle.

Trois matériaux, trois rôles, pour que le rendu les traite à part:
- `bois`: les bûches (écorce, bouts de bois frais ou charbonneux), immobiles;
- `braise`: les braises et le lit de braise sous les bûches, qui rougeoient (nature `flame`: elles
  luisent la nuit);
- `flamme`: les langues de flamme, chacune une pièce à part (morceau d'un seul tenant), de taille
  inégale: le nuanceur du jeu les anime (`docs`: un autre membre s'en charge, rien n'est animé ici).

Raisons d'être tenues ici:
- les bûches se croisent par paires et reposent les unes sur les autres (rien ne flotte), leurs
  bouts dépassent du lit de braise: c'est ce qui dit « feu de bois » de haut comme de côté;
- chaque langue part du lit de braise (elle y est enfoncée de 1 cm) et monte en se tordant; la
  plus haute au milieu, les autres plus courtes autour, jamais au-dessus de `plafond` (le cul
  d'une marmite, la voûte d'un four);
- un feu éteint (`vif = False`) garde ses bûches noircies sur un lit de cendre, sans braise ni
  flamme.
"""

from __future__ import annotations

import math

from formes import Atelier, at, entre, penche, ton


def langue(s: Atelier, pied, hauteur, rayon, couleur, graine, pans=4, vers=(0.0, 0.0)):
    """Une langue de flamme: un fuseau à pans qui monte en ondulant et finit en pointe.

    `pied`: centre de la base (enfoncée dans la braise); `vers`: dérive de la pointe (x, z)."""
    x, y, z = pied
    dx, dz = vers
    a = penche(graine, 1.0)
    pts = [
        (x, y, z, rayon * 0.8),
        (x + math.cos(a) * rayon * 0.25, y + hauteur * 0.3, z + math.sin(a) * rayon * 0.25, rayon),
        (x - math.cos(a) * rayon * 0.3 + dx * 0.4, y + hauteur * 0.62, z - math.sin(a) * rayon * 0.3 + dz * 0.4, rayon * 0.55),
        (x + dx, y + hauteur, z + dz, rayon * 0.04),
    ]
    # Normales lissées autour de l'axe: une langue claire et ronde, pas des facettes sombres.
    s.tube(pts, pans, "flamme", couleur, bouts=(True, False), tors=0.35, rond=True)


def buche(s: Atelier, a, b, r, ecorce, bout, pans=6):
    """Une bûche de a à b (rayon r), bouts fermés en `bout` (bois frais, ou charbon d'un feu)."""
    s.tube([(*a, r), (*b, r * 0.92)], pans, "bois", ecorce, bouts=(True, True), coupe=bout)


def foyer(s: Atelier, ctx, x, y, z, rayon, graine, vif=True, plafond=None, langues=5, cap=0.0, buches=4, cendre=True):
    """Feu de bois posé en (x, y, z): lit de cendre et de braise, bûches croisées, langues.

    `rayon`: demi-longueur d'une bûche (m); `plafond`: hauteur que les flammes ne passent pas;
    `cap`: orientation des bûches (radians). Rend la hauteur du lit de braise."""
    ecorce = ctx.tons("ecorce_chene")
    braise = ctx.tons("braise")
    rb = max(0.022, rayon * 0.15)
    bout = ctx.un("braise", 2) if vif else ctx.un("noir")
    if not vif:
        ecorce = [ton(c, 0.45, ctx.un("noir"), 0.4) for c in ecorce]
    # Lit de cendre: un galet très plat, gris, plus large que les bûches.
    if cendre:
        s.galet(rayon * 1.05, 0.035, rayon * 0.95, at(x, y, z, cap + 0.4), "pierre", ctx.un("cendre"), graine, points=11, pose=0.5, dessus=ctx.un("cendre", 1))
    lit = y + 0.016
    # Bûches: une paire posée sur la cendre, l'autre croisée par-dessus (elle repose sur la première).
    paires = [(cap, lit + rb * 0.8), (cap + math.pi / 2, lit + rb * 2.55)]
    for k in range(min(buches, 4)):
        angle, hy = paires[k // 2]
        cote = (-1 if k % 2 == 0 else 1) * rayon * 0.36
        ux, uz = math.cos(angle), math.sin(angle)
        nx, nz = -uz, ux
        cx, cz = x + nx * cote + penche(graine + k, 0.02), z + nz * cote + penche(graine + k * 3, 0.02)
        demi = rayon * entre(0.9, 1.05, graine + k * 1.3)
        buche(s, (cx - ux * demi, hy, cz - uz * demi), (cx + ux * demi, hy + penche(graine + k * 5, 0.01), cz + uz * demi), rb * entre(0.9, 1.1, graine + k), ecorce[k % len(ecorce)], bout)
    if not vif:
        return lit
    # Braises: le coeur rougeoyant entre les bûches (un galet aplati) et des morceaux autour.
    s.galet(rayon * 0.62, 0.05, rayon * 0.58, at(x, lit - 0.01, z, cap + 1.1), "braise", braise[0], graine + 7, points=10, pose=0.45, dessus=braise[1])
    for k in range(6):
        a = graine * 2.3 + k / 6 * math.tau
        d = rayon * entre(0.45, 0.85, graine + k * 2.9)
        rr = rayon * entre(0.1, 0.16, graine + k * 1.7)
        # Posés sur la cendre (ou la sole), un peu enfoncés.
        s.octa(rr, rr * 0.6, rr, at(x + math.cos(a) * d, y + rr * 0.45, z + math.sin(a) * d, a), "braise", braise[(k + 1) % len(braise)])

    # Langues: la plus haute au milieu, entre les bûches; les autres lèchent le dessus des bûches
    # (leur pied est enfoncé dans le bois), plus courtes; aucune ne passe à travers une bûche.
    haut_max = rayon * 1.25
    if plafond is not None:
        haut_max = min(haut_max, plafond - lit - 0.02)
    places = [(0.0, 0.0, lit - 0.005, 1.0, 0.15)]
    for k, (paire, t_long, part) in enumerate(((1, -0.12, 0.72), (1, 0.18, 0.6), (0, 0.66, 0.46), (0, -0.7, 0.4))):
        angle, hy = paires[paire]
        cote = (-1 if k % 2 == 0 else 1) * rayon * 0.36
        ux, uz = math.cos(angle), math.sin(angle)
        nx, nz = -uz, ux
        places.append((nx * cote + ux * rayon * t_long, nz * cote + uz * rayon * t_long, hy + rb * 0.75, part, 0.12))
    for k, (dx, dz, py, part, rr) in enumerate(places[:langues]):
        h = haut_max * (1.0 if k == 0 else part * entre(0.9, 1.1, graine + k * 1.9))
        if plafond is not None:
            h = min(h, plafond - 0.02 - py)

        couleur = ctx.un("flamme_coeur") if k == 0 else ctx.tons("flamme")[k % 3]
        vers = (penche(graine + k * 7, h * 0.18), penche(graine + k * 11, h * 0.18))
        langue(s, (x + dx, py, z + dz), h, rayon * rr, couleur, graine + k * 13, vers=vers)
    return lit


def flamme_de_bougie(s: Atelier, ctx, x, y, z, hauteur, graine):
    """Flamme d'une mèche: une langue seule, jaune au coeur, et le bout de mèche en braise."""
    s.octa(0.006, 0.008, 0.006, at(x, y + 0.004, z), "braise", ctx.un("braise", 2))
    langue(s, (x, y + 0.002, z), hauteur, hauteur * 0.32, ctx.un("flamme_coeur"), graine, pans=5)


