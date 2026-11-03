"""Écrit `games/la-petite-ligne/donnees/vetements.json` (contrat `docs/jeux/jeu-1/garde-robe-0-12.md`, section 2).

Lancer: python3 vetements_donnees.py (sans Blender). Les styles et les nœuds suivent `garde_robe.STYLES`
(`modele` = `wear_<slot>_<style>`, partagé par toutes les variantes d'un style). Couleurs: `principale` et
`secondaire` (et `motif` quand il diffère de la secondaire), écrites par le rendu dans la rangée 1 de la texture
des personnages (`garde_robe.WEAR_SLOTS`).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "donnees", "vetements.json")

# slot, style, prix, saison, [(variante, nom, principale, secondaire, motif)]
CATALOGUE = [
    ("top", "tshirt", 70, None, [
        ("blanc", "T-shirt blanc", "#F1ECE2", "#D8D0C2", None),
        ("rose", "T-shirt rose poudré", "#E3A1B4", "#F4E6EC", None),
        ("sauge", "T-shirt vert sauge", "#8BA37B", "#EDE6D3", None),
        ("ocre", "T-shirt ocre", "#C98E3A", "#F1E4C8", None)]),
    ("top", "chemise", 120, None, [
        ("blanche", "Chemise blanche", "#EEE9DF", "#C9C1B2", None),
        ("bleu_travail", "Chemise bleu de travail", "#5C7FA6", "#EDE6D3", None),
        ("lin", "Chemise de lin", "#D8C9A8", "#8C6A48", None),
        ("rouille", "Chemise rouille", "#B5663F", "#EDE6D3", None)]),
    ("top", "pull", 150, None, [
        ("moutarde", "Pull moutarde", "#D4A746", "#B68A30", "#E9D08A"),
        ("rouille", "Pull rouille", "#B5663F", "#94502F", "#D9946C"),
        ("vert_bouteille", "Pull vert bouteille", "#2F5A45", "#244736", "#5C8A6F"),
        ("creme", "Pull crème", "#EDE3CC", "#D3C6A8", "#F7F0E0"),
        ("bleu_nuit", "Pull bleu nuit", "#2F3A5A", "#232B45", "#5A6C99")]),
    ("top", "debardeur", 60, "summer", [
        ("blanc", "Débardeur blanc", "#F1ECE2", "#C2563F", None),
        ("corail", "Débardeur corail", "#E8735E", "#F4E2D6", None),
        ("bleu_ciel", "Débardeur bleu ciel", "#8DB7D9", "#F1ECE2", None)]),
    ("top", "mariniere", 130, None, [
        ("marine", "Marinière bleu marine", "#F2EDE1", "#2F4A78", None),
        ("rouge", "Marinière rouge", "#F2EDE1", "#B33A33", None),
        ("vert_eau", "Marinière vert d'eau", "#F2EDE1", "#5E9C8F", None)]),
    ("bottom", "pantalon", 140, None, [
        ("bleu", "Pantalon de toile bleu", "#4A5D78", "#6B4A33", None),
        ("beige", "Pantalon de toile beige", "#C9B79A", "#6B4A33", None),
        ("kaki", "Pantalon de toile kaki", "#6E7253", "#4A3A2E", None),
        ("brun", "Pantalon de toile brun", "#6B5541", "#3E2F25", None)]),
    ("bottom", "short", 90, "summer", [
        ("marine", "Short bleu marine", "#3D4B52", "#2B3439", None),
        ("kaki", "Short kaki", "#7C7A55", "#4A3A2E", None),
        ("ecru", "Short écru", "#E2D7BF", "#8C6A48", None)]),
    ("bottom", "salopette", 220, None, [
        ("jean", "Salopette en jean", "#4E6A8E", "#F1EBDB", "#C8A150"),
        ("verte", "Salopette verte", "#5E6A55", "#F1EBDB", "#C8A150"),
        ("rouille", "Salopette rouille", "#A65A37", "#EFE6D2", "#C8A150"),
        ("moutarde", "Salopette moutarde", "#C99A3C", "#F3ECDA", "#8C6A48")]),
    ("bottom", "jupe", 130, None, [
        ("prune", "Jupe prune", "#6E3F5E", "#3E2338", None),
        ("brune", "Jupe brune", "#6B5541", "#3E2F25", None),
        ("vert_sapin", "Jupe vert sapin", "#2F5A45", "#1F3D2F", None),
        ("bleu_ardoise", "Jupe bleu ardoise", "#4F6475", "#2F3E4A", None)]),
    ("bottom", "pantacourt", 110, None, [
        ("beige", "Pantacourt beige", "#C9B79A", "#8C7A60", None),
        ("bleu", "Pantacourt bleu", "#5C7FA6", "#3E5A7A", None),
        ("olive", "Pantacourt olive", "#7C7F4A", "#55583A", None)]),
    ("shoes", "bottines", 160, None, [
        ("brunes", "Bottines brunes", "#5A4636", "#2E2622", None),
        ("noires", "Bottines noires", "#2E2A27", "#1A1715", None),
        ("fauves", "Bottines fauves", "#A8703F", "#4A3324", None)]),
    ("shoes", "bottes", 140, "autumn", [
        ("vertes", "Bottes de pluie vertes", "#2F6F5E", "#1E3D35", None),
        ("jaunes", "Bottes de pluie jaunes", "#E8B93A", "#3A3530", None),
        ("rouges", "Bottes de pluie rouges", "#B33A33", "#3A3530", None)]),
    ("shoes", "sabots", 80, None, [
        ("clairs", "Sabots de bois clair", "#C9A06A", "#8A6A44", None),
        ("bleus", "Sabots peints en bleu", "#4E6F9E", "#C9A06A", None),
        ("fonces", "Sabots de bois foncé", "#7A5A38", "#4A3524", None)]),
    ("shoes", "espadrilles", 90, "summer", [
        ("ecrues", "Espadrilles écrues", "#E6DCC6", "#B39A6A", None),
        ("marine", "Espadrilles bleu marine", "#2F3F5C", "#B39A6A", None),
        ("rouges", "Espadrilles rouges", "#B8463C", "#B39A6A", None)]),
    ("shoes", "baskets", 120, None, [
        ("blanches", "Baskets de toile blanches", "#E9E4D8", "#F7F4EC", None),
        ("rouges", "Baskets de toile rouges", "#C2453B", "#F4F0E6", None),
        ("bleues", "Baskets de toile bleues", "#4E6F9E", "#F4F0E6", None)]),
    ("outer", "veste", 320, None, [
        ("bleue", "Veste de travail bleue", "#3E5A86", "#2F4466", None),
        ("vert_bouteille", "Veste de travail vert bouteille", "#3F6F6A", "#2B4A47", None),
        ("brune", "Veste de travail brune", "#6E5136", "#4A3524", None),
        ("moutarde", "Veste de travail moutarde", "#C2933A", "#8C6A2A", None)]),
    ("outer", "gilet", 240, None, [
        ("moutarde", "Gilet tricoté moutarde", "#D4A746", "#8C6A48", None),
        ("ecru", "Gilet tricoté écru", "#E6DCC6", "#9C8A6A", None),
        ("prune", "Gilet tricoté prune", "#7A4A63", "#4E2E40", None),
        ("mousse", "Gilet tricoté vert mousse", "#6E7F4A", "#4A5733", None)]),
    ("outer", "cire", 380, "autumn", [
        ("jaune", "Ciré jaune", "#E8B93A", "#2F3A52", None),
        ("marine", "Ciré bleu marine", "#2F3F5C", "#E8B93A", None),
        ("rouge", "Ciré rouge", "#B33A33", "#F1ECE2", None)]),
    ("hat", "casquette", 80, None, [
        ("marine", "Casquette bleu marine", "#2F3F5C", "#C8A150", None),
        ("rouge", "Casquette rouge", "#B33A33", "#F1ECE2", None),
        ("kaki", "Casquette kaki", "#6E7253", "#4A3A2E", None)]),
    ("hat", "paille", 110, "summer", [
        ("naturel", "Chapeau de paille", "#E3C77E", "#8C6A48", None),
        ("ruban_bleu", "Chapeau de paille à ruban bleu", "#E3C77E", "#3E5A86", None),
        ("ruban_rouge", "Chapeau de paille à ruban rouge", "#E3C77E", "#B33A33", None)]),
    ("hat", "bonnet", 70, "winter", [
        ("rouge", "Bonnet rouge", "#A63A34", "#EDE6D3", None),
        ("gris", "Bonnet gris", "#8F8A84", "#E4DED2", None),
        ("moutarde", "Bonnet moutarde", "#C99A3C", "#F3ECDA", None),
        ("bleu", "Bonnet bleu", "#3E5A86", "#E4DED2", None)]),
]
COVERS = {("bottom", "salopette"): ["top"]}


def main():
    items = []
    for slot, style, price, season, variants in CATALOGUE:
        for i, (var, name, p, s, m) in enumerate(variants):
            colors = {"principale": p, "secondaire": s}
            if m:
                colors["motif"] = m
            it = {"id": f"{style}_{var}", "slot": slot, "style": style, "nom": name,
                  "modele": f"wear_{slot}_{style}", "couleurs": colors,
                  # variantes plus travaillées un peu plus chères (10 % par rang, arrondi à 5)
                  "prix": min(400, int(round(price * (1 + 0.1 * (i % 3)) / 5) * 5))}
            if season:
                it["saison"] = season
            if (slot, style) in COVERS:
                it["couvre"] = COVERS[(slot, style)]
            items.append(it)
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids))
    data = {"version": 1, "note": "Garde-robe de la 0.12 (docs/jeux/jeu-1/garde-robe-0-12.md). Généré par "
                     "games/la-petite-ligne/assets-src/modeles/vetements_donnees.py: modifier le script, pas ce fichier. Couleurs 'principale', 'secondaire', 'motif' (facultatif, sinon la secondaire): rangée 1 de personnages.png, colonnes <slot>_p, <slot>_s, <slot>_m (garde_robe.WEAR_SLOTS).",
            "vetements": items}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(len(items), "vêtements", OUT)


if __name__ == "__main__":
    main()
