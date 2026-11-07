"""Applique la typographie française aux textes visibles des maquettes de Cosy Café.

Reprend les règles de design/maquettes/plateforme-wireframes/typographier.py, sans le trait
d'union insécable (absent des polices de Duo, voir l'identité visuelle, section 5.3), avec en plus
les montants en euros, les températures, les milliers et le signe plus devant un nombre.
Traite seulement le texte hors balises et les attributs lus par l'utilisateur (aria-label,
placeholder, title, alt), jamais <script>, <style> ni les commentaires. Idempotent.

Usage: python3 design/maquettes/cosy-cafe/outils/typographier.py design/maquettes/cosy-cafe/*.html
"""
import re
import sys

NBSP = " "  # espace insécable
NNBSP = " "  # espace fine insécable
ESPACES = "[   ]"


def typographier(texte: str) -> str:
    t = texte
    # Apostrophe typographique entre deux lettres (c'est, l'ardoise, aujourd'hui).
    t = re.sub(r"(?<=[A-Za-zÀ-ÿŒœ])'(?=[A-Za-zÀ-ÿŒœ])", "’", t)
    # Guillemets français: espace insécable à l'intérieur.
    t = re.sub("«" + ESPACES + "*", "«" + NBSP, t)
    t = re.sub(ESPACES + "*»", NBSP + "»", t)
    # Deux-points: espace insécable avant, si une espace le précède déjà.
    t = re.sub("[  ]+:", NBSP + ":", t)
    # Point-virgule, point d'exclamation, point d'interrogation: espace fine insécable.
    t = re.sub("[  ]+([;!?])", NNBSP + r"\1", t)
    # Milliers: 1 482, 2 400 (espace fine insécable).
    t = re.sub(r"(?<![\d,])(\d{1,3})[  ](\d{3})(?![\d])", r"\1" + NNBSP + r"\2", t)
    # Pourcentage: espace fine insécable.
    t = re.sub(r"(\d)" + ESPACES + "+%", r"\1" + NNBSP + "%", t)
    # Monnaie, températures, unités et heures: 4,40 €, 58 °C, 90°, 3 L, 2 min, 21 h 40.
    t = re.sub(r"(\d)[  ]+(€|°C)", r"\1" + NBSP + r"\2", t)
    t = re.sub(r"(\d) (h|min|s|kg|g|L|cm|m|km|Mo|Go)(?![\w])", r"\1" + NBSP + r"\2", t)
    t = re.sub(r"(\d" + NBSP + r"h) (\d)", r"\1" + NBSP + r"\2", t)
    # Signe plus devant un nombre: jamais seul en fin de ligne.
    t = re.sub(r"\+ (?=\d)", "+" + NBSP, t)
    return t


ATTRIBUTS = re.compile(r'\b(aria-label|placeholder|title|alt)="([^"]*)"')


def traiter(source: str) -> str:
    sortie = []
    i = 0
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
