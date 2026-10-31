"""Applique la typographie française aux textes visibles des wireframes HTML.

Traite seulement le texte hors balises et les attributs lus par l'utilisateur
(aria-label, placeholder, title, alt), jamais le contenu de <script> ni de <style>.
Idempotent: relancer le script ne change plus rien.

Repris de design/maquettes/plateforme-wireframes/typographier.py, avec « sous » comme unité.

Usage: python3 games/la-petite-ligne/ui-maquettes/outils/typographier.py fichier.html [...]
"""
import re
import sys

NBSP = " "   # espace insécable
NNBSP = " "  # espace fine insécable


def typographier(texte: str) -> str:
    t = texte
    # Apostrophe typographique entre deux lettres (C'est, l'autre, aujourd'hui).
    t = re.sub(r"(?<=[A-Za-zÀ-ÿŒœ])'(?=[A-Za-zÀ-ÿŒœ])", "’", t)
    # Guillemets français: espace insécable à l'intérieur.
    t = re.sub(r"«[   ]*", "«" + NBSP, t)
    t = re.sub(r"[   ]*»", NBSP + "»", t)
    # Deux-points: espace insécable avant, si une espace le précède déjà.
    t = re.sub(r"[  ]+:", NBSP + ":", t)
    # Point-virgule, point d'exclamation, point d'interrogation: espace fine insécable.
    t = re.sub(r"[  ]+([;!?])", NNBSP + r"\1", t)
    # Pourcentage: espace fine insécable.
    t = re.sub(r"(\d)[  ]+%", r"\1" + NNBSP + "%", t)
    # Unités et heures: 21 h 40, 3 min, 12 s, 12 Mo.
    t = re.sub(r"(\d) (h|min|s|Mo|Go|sous)(?![\w])", r"\1" + NBSP + r"\2", t)
    # Un nombre ne se sépare pas de l'objet compté (3 œufs, 12 radis).
    t = re.sub(r"(\d) (radis|laitues?|œufs?|planches?|clous?|carottes?|lignes?|jours?|places|arrosages|rondins?)(?![\w])", r"\1" + NBSP + r"\2", t)
    t = re.sub(r"(\d h) (\d)", r"\1" + NBSP + r"\2", t)
    # Wi-Fi ne se coupe jamais en fin de ligne: trait d'union insécable (U+2011).
    t = t.replace("Wi-Fi", "Wi\u2011Fi")
    return t


ATTRIBUTS = re.compile(r'\b(aria-label|placeholder|title|alt|aria-description)="([^"]*)"')


def traiter(source: str) -> str:
    sortie = []
    i = 0
    # Découpe en balises et textes; saute <script> et <style> entiers.
    motif = re.compile(r"<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->|<[^>]+>", re.S)
    for m in motif.finditer(source):
        sortie.append(typographier(source[i:m.start()]))
        bloc = m.group(0)
        if bloc.startswith("<script") or bloc.startswith("<style") or bloc.startswith("<!--"):
            sortie.append(bloc)
        else:
            sortie.append(ATTRIBUTS.sub(lambda a: f'{a.group(1)}="{typographier(a.group(2))}"', bloc))
        i = m.end()
    sortie.append(typographier(source[i:]))
    return "".join(sortie)


if __name__ == "__main__":
    for chemin in sys.argv[1:]:
        with open(chemin, encoding="utf-8") as f:
            avant = f.read()
        apres = traiter(avant)
        if apres != avant:
            with open(chemin, "w", encoding="utf-8") as f:
                f.write(apres)
            print("typographié :", chemin)
        else:
            print("inchangé    :", chemin)
