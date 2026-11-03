"""Palettes de La Petite Ligne (démo, printemps à la Halte d'Aubrune).

Une seule texture palette pour tout le décor (cases de 4 px, 16 x 16 cases),
avec ses deux compagnes de même disposition: rugosité et métal (vert et bleu),
et lueur de nuit (émission). Les personnages ont leur propre texture: une
rangée de 16 cases par personnage, mêmes rôles de case pour tous.

Source unique des couleurs: la bible artistique de la démo les reprend.
"""

CELL = 4          # pixels par case
GRID = 16         # cases par côté (texture de 64 x 64)
CHAR_GRID_H = 32  # rangées de la texture des personnages (64 x 128 depuis la 0.13: 21 habitants)

# nom: (hex, rugosité, métal, lueur de nuit en hex ou None)
# Ordre = ordre des cases (de gauche à droite, de haut en bas).
WORLD = [
    # Végétation
    ("grass", "#93B45E", 0.95, 0.0, None),
    ("grass_light", "#AEC874", 0.95, 0.0, None),
    ("grass_dark", "#6F9148", 0.95, 0.0, None),
    ("grass_dry", "#C9BE78", 0.95, 0.0, None),
    ("moss", "#809B4F", 0.95, 0.0, None),
    ("leaf_oak", "#6C9944", 0.9, 0.0, None),
    ("leaf_oak_light", "#8DB556", 0.9, 0.0, None),
    ("leaf_fir", "#3F6C4D", 0.9, 0.0, None),
    ("leaf_fir_light", "#52845B", 0.9, 0.0, None),
    ("leaf_birch", "#A6C35E", 0.9, 0.0, None),
    ("leaf_birch_light", "#C4D877", 0.9, 0.0, None),
    ("leaf_bush", "#5E8B45", 0.9, 0.0, None),
    ("leaf_hazel", "#7EA24C", 0.9, 0.0, None),
    ("leaf_crop", "#6FAA47", 0.8, 0.0, None),
    ("leaf_crop_light", "#A3CF63", 0.8, 0.0, None),
    ("leaf_carrot", "#5E9A3E", 0.8, 0.0, None),
    # Terres et sols
    ("soil", "#A9835B", 0.95, 0.0, None),
    ("soil_tilled", "#7C5A3C", 0.95, 0.0, None),
    ("soil_tilled_light", "#957150", 0.95, 0.0, None),
    ("soil_wet", "#4E3A2A", 0.32, 0.0, None),
    ("soil_wet_light", "#614835", 0.32, 0.0, None),
    ("soil_tired", "#958B7D", 0.95, 0.0, None),
    ("path", "#CFB489", 0.95, 0.0, None),
    ("path_dark", "#B69B73", 0.95, 0.0, None),
    ("sand", "#DCCAA2", 0.95, 0.0, None),
    ("ballast", "#9D968B", 0.95, 0.0, None),
    ("ballast_dark", "#7F786E", 0.95, 0.0, None),
    ("bank", "#8C7558", 0.9, 0.0, None),
    ("cobble", "#ABA498", 0.9, 0.0, None),
    ("cobble_dark", "#8E877C", 0.9, 0.0, None),
    ("straw", "#E2C47C", 0.95, 0.0, None),
    ("straw_dark", "#C5A45F", 0.95, 0.0, None),
    # Pierres, toits, enduits
    ("stone", "#C0B4A1", 0.9, 0.0, None),
    ("stone_light", "#DAD0BE", 0.9, 0.0, None),
    ("stone_dark", "#9B907F", 0.9, 0.0, None),
    ("rock", "#A09C92", 0.9, 0.0, None),
    ("rock_light", "#BEB9AD", 0.9, 0.0, None),
    ("rock_dark", "#7F7B73", 0.9, 0.0, None),
    ("lauze", "#737B86", 0.8, 0.0, None),
    ("lauze_light", "#8B939C", 0.8, 0.0, None),
    ("lauze_dark", "#5D646F", 0.8, 0.0, None),
    ("tile", "#B86B4F", 0.8, 0.0, None),
    ("tile_dark", "#985541", 0.8, 0.0, None),
    ("brick", "#A95F49", 0.9, 0.0, None),
    ("plaster_cream", "#EBDCBF", 0.95, 0.0, None),
    ("plaster_ochre", "#DEBA80", 0.95, 0.0, None),
    ("plaster_rose", "#DEAF9D", 0.95, 0.0, None),
    ("plaster_shade", "#CDBB9C", 0.95, 0.0, None),
    # Bois
    ("wood_new", "#D3A66D", 0.85, 0.0, None),
    ("wood", "#A97749", 0.85, 0.0, None),
    ("wood_dark", "#765130", 0.85, 0.0, None),
    ("wood_old", "#908879", 0.9, 0.0, None),
    ("wood_old_dark", "#6F685E", 0.9, 0.0, None),
    ("bark", "#6E5743", 0.95, 0.0, None),
    ("bark_dark", "#554230", 0.95, 0.0, None),
    ("birch_bark", "#EAE4D7", 0.9, 0.0, None),
    ("birch_mark", "#4C4641", 0.9, 0.0, None),
    ("log_end", "#E3C18A", 0.9, 0.0, None),
    ("log_ring", "#C89D64", 0.9, 0.0, None),
    ("paint_red", "#9B4C3B", 0.7, 0.0, None),
    ("paint_green", "#7F9C79", 0.7, 0.0, None),
    ("paint_blue", "#7090A5", 0.7, 0.0, None),
    ("paint_cream", "#E8DDC4", 0.7, 0.0, None),
    ("paint_yellow", "#D9B65B", 0.7, 0.0, None),
    # Eau, verre, métaux, lueurs
    ("water", "#6CAAB9", 0.08, 0.0, None),
    ("water_deep", "#4C899A", 0.08, 0.0, None),
    ("water_foam", "#D4ECEB", 0.3, 0.0, None),
    ("glass", "#5F7D8C", 0.12, 0.0, "#FFC874"),
    ("glass_lamp", "#F2E4B6", 0.2, 0.0, "#FFC264"),
    ("flame", "#FFD27A", 0.5, 0.0, "#FFB347"),
    ("iron", "#44484E", 0.5, 0.6, None),
    ("iron_light", "#6C7179", 0.45, 0.6, None),
    ("rust", "#8F5C40", 0.8, 0.2, None),
    ("rail_steel", "#8C8E91", 0.3, 0.8, None),
    ("brass", "#C8A150", 0.35, 0.8, None),
    ("black", "#2C2E31", 0.6, 0.1, None),
    ("white_paint", "#F0ECE3", 0.6, 0.0, None),
    ("rope", "#CAB58B", 0.95, 0.0, None),
    ("leather", "#8A5A3A", 0.7, 0.0, None),
    ("shadow", "#3A3530", 0.95, 0.0, None),
    # Train, tissus, objets
    ("loco_green", "#3F6453", 0.45, 0.1, None),
    ("loco_green_light", "#507B65", 0.45, 0.1, None),
    ("loco_red", "#A4463B", 0.5, 0.0, None),
    ("coach_brown", "#7B4636", 0.5, 0.0, None),
    ("coach_cream", "#E7D8B6", 0.5, 0.0, None),
    ("van_wood", "#8B6F56", 0.7, 0.0, None),
    ("awning_red", "#C65B4B", 0.9, 0.0, None),
    ("awning_cream", "#F1E5C9", 0.9, 0.0, None),
    ("fabric_blue", "#6B87B1", 0.95, 0.0, None),
    ("fabric_red", "#BA554C", 0.95, 0.0, None),
    ("fabric_yellow", "#E2B95B", 0.95, 0.0, None),
    ("fabric_green", "#80A172", 0.95, 0.0, None),
    ("fabric_cream", "#F0E4CA", 0.95, 0.0, None),
    ("fabric_rose", "#DA9BA4", 0.95, 0.0, None),
    ("paper", "#F3EBD4", 0.9, 0.0, None),
    ("paper_dark", "#D9CCAB", 0.9, 0.0, None),
    # Nourriture, bêtes
    ("bread", "#D59B56", 0.8, 0.0, None),
    ("bread_crust", "#B1773A", 0.8, 0.0, None),
    ("soup", "#D49248", 0.3, 0.0, None),
    ("ceramic", "#EEE7DA", 0.35, 0.0, None),
    ("ceramic_blue", "#5D7FB0", 0.35, 0.0, None),
    ("egg", "#F3E7D0", 0.6, 0.0, None),
    ("chicken_white", "#F2EDE1", 0.95, 0.0, None),
    ("chicken_russet", "#B5693C", 0.95, 0.0, None),
    ("chicken_black", "#3D3B3B", 0.95, 0.0, None),
    ("comb_red", "#D3423C", 0.8, 0.0, None),
    ("beak", "#E9B13F", 0.7, 0.0, None),
    ("grain", "#E0C56F", 0.9, 0.0, None),
    ("burlap", "#C1A577", 0.95, 0.0, None),
    ("burlap_dark", "#9E8459", 0.95, 0.0, None),
    ("tin", "#9AA3A8", 0.4, 0.7, None),
    ("tin_paint", "#5E86A1", 0.5, 0.3, None),
    # Fleurs et cultures
    ("flower_red", "#D9584F", 0.9, 0.0, None),
    ("flower_yellow", "#F2C74E", 0.9, 0.0, None),
    ("flower_white", "#F6F2E7", 0.9, 0.0, None),
    ("flower_blue", "#7191D9", 0.9, 0.0, None),
    ("flower_pink", "#E89CB6", 0.9, 0.0, None),
    ("flower_violet", "#A685D0", 0.9, 0.0, None),
    ("flower_center", "#E9AA3C", 0.9, 0.0, None),
    ("radish", "#D44B5D", 0.6, 0.0, None),
    ("radish_tip", "#F2DCDF", 0.6, 0.0, None),
    ("carrot", "#E98A3B", 0.7, 0.0, None),
    ("lettuce", "#98C95D", 0.75, 0.0, None),
    ("lettuce_light", "#C6E17F", 0.75, 0.0, None),
    ("potato", "#CAA76E", 0.9, 0.0, None),
    ("strawberry", "#D93F3F", 0.5, 0.0, None),
    ("seed", "#D9C69B", 0.9, 0.0, None),
    ("sprout", "#A7D569", 0.8, 0.0, None),
    # Ajouts (toujours en fin de liste: les cases existantes ne bougent pas)
    ("fish_back", "#6E807B", 0.35, 0.1, None),
    ("fish_silver", "#BAC4C7", 0.3, 0.3, None),
    ("fish_belly", "#EAE6D7", 0.4, 0.1, None),
    ("fish_olive", "#7E8553", 0.4, 0.1, None),
    ("trout_spot", "#C3473D", 0.5, 0.0, None),
    ("jay_blue", "#4F80CA", 0.7, 0.0, None),
    ("jay_stripe", "#1F2B45", 0.7, 0.0, None),
    ("feather_brown", "#B0927A", 0.9, 0.0, None),
    ("sepia", "#B59C79", 0.8, 0.0, None),
    ("sepia_dark", "#6F5B45", 0.8, 0.0, None),
    ("lamp_shade", "#F3E9CF", 0.6, 0.0, "#FFD89A"),
    ("radio_dial", "#E9DDB8", 0.4, 0.0, "#FFCF7A"),
    ("ember", "#C9572F", 0.8, 0.0, "#FF7A2E"),
    ("mattress", "#E4DCC8", 0.95, 0.0, None),
    ("mattress_stripe", "#8FA5BF", 0.95, 0.0, None),
    ("ivy", "#4E7A3F", 0.9, 0.0, None),
    # Faune des moments rares (tour 6): héron cendré, oie cendrée, mésange bleue, renard roux, nichoir
    ("heron_grey", "#7F888E", 0.9, 0.0, None),
    ("heron_grey_dark", "#5F676D", 0.9, 0.0, None),
    ("feather_white", "#EEECE4", 0.9, 0.0, None),
    ("heron_leg", "#B3A26E", 0.8, 0.0, None),
    ("goose_grey", "#8F887C", 0.9, 0.0, None),
    ("goose_grey_dark", "#625B52", 0.9, 0.0, None),
    ("goose_belly", "#D0C8B9", 0.9, 0.0, None),
    ("goose_bill", "#E68A3A", 0.6, 0.0, None),
    ("goose_leg", "#E3A08E", 0.7, 0.0, None),
    ("tit_blue", "#3D7CC6", 0.8, 0.0, None),
    ("tit_yellow", "#EFCB45", 0.85, 0.0, None),
    ("tit_green", "#93A25C", 0.85, 0.0, None),
    ("fox_red", "#C7652F", 0.9, 0.0, None),
    ("fox_red_dark", "#9C4A24", 0.9, 0.0, None),
    ("fox_white", "#F0E7D8", 0.9, 0.0, None),
    ("fox_black", "#2E2521", 0.9, 0.0, None),
    ("tar", "#3C3835", 0.7, 0.0, None),
    # Tour 7: raie du dos du martin-pêcheur (aucune case turquoise vive avant lui)
    ("kingfisher_teal", "#2BB5C8", 0.6, 0.0, None),
    # Tour 8: mûre mûre (noir violacé, luisant); aucune case assez sombre et brillante avant elle
    ("blackberry", "#2E2136", 0.35, 0.0, None),
    # Tour 8: vigne de la tonnelle, caduque (le lierre « ivy » reste vert l'hiver, à juste titre): vert tendre au
    # printemps, vert franc l'été, or et rouge à l'automne, feuilles sèches l'hiver
    ("vine_leaf", "#5E8B45", 0.9, 0.0, None),
    ("vine_leaf_dark", "#4C7638", 0.9, 0.0, None),
    # Tour 9: outils de la Halte (arrosoir de cuivre, canne en bambou refendu, hache de la forge)
    ("copper", "#B8693A", 0.35, 0.6, None),
    ("copper_light", "#DE9A62", 0.3, 0.6, None),
    ("bamboo", "#D9C27E", 0.6, 0.0, None),
    ("bamboo_node", "#9E8343", 0.7, 0.0, None),
    ("steel_forged", "#3B4652", 0.45, 0.5, None),
    # Tour 9: cueillette d'automne et lisibilité (cèpe, sureau, litière sous le noisetier, noisettes)
    ("cep_cap", "#6E3F22", 0.7, 0.0, None),
    ("cep_stem", "#EDE2C2", 0.85, 0.0, None),
    ("elder_stem", "#B0303F", 0.7, 0.0, None),
    ("leaf_litter", "#D9A04A", 0.95, 0.0, None),
    ("hazel_husk", "#D2DC92", 0.85, 0.0, None),
    ("hazel_shell", "#52301A", 0.5, 0.0, None),
    # Tour 9: dame blanche (dos chamois de l'effraie)
    ("owl_buff", "#D8AE72", 0.9, 0.0, None),
]

# Variantes de saison: seules les cases citées changent (même disposition).
SEASONS = {
    "ete": {
        "grass": "#9AAF55", "grass_light": "#B9C26B", "grass_dark": "#738D43",
        "grass_dry": "#D3C273", "leaf_oak": "#5E8C3D", "leaf_oak_light": "#7AA34B",
        "leaf_birch": "#94B455", "leaf_birch_light": "#B1C86A",
        "vine_leaf": "#577F3E", "vine_leaf_dark": "#466B33",
    },
    "automne": {
        "grass": "#A6A55C", "grass_light": "#BDB46B", "grass_dark": "#7D8447",
        "grass_dry": "#D1B56E", "moss": "#8E8F4B",
        "leaf_oak": "#C27F3B", "leaf_oak_light": "#D69A47",
        "leaf_birch": "#E2B84E", "leaf_birch_light": "#EECB63",
        "leaf_bush": "#9C7A3E", "leaf_hazel": "#C8A048",
        "vine_leaf": "#B8862F", "vine_leaf_dark": "#8E4A2E",
    },
    "hiver": {
        "grass": "#C9CEC4", "grass_light": "#E2E5DE", "grass_dark": "#A4AC9F",
        "grass_dry": "#C8BFA4", "moss": "#9EA597",
        "leaf_oak": "#8D7A62", "leaf_oak_light": "#A39079",
        "leaf_birch": "#B5A88F", "leaf_birch_light": "#C9BFA9",
        "leaf_bush": "#7D8A72", "leaf_hazel": "#9A8C72",
        "leaf_fir": "#486B57", "leaf_fir_light": "#C9D4D0",
        "vine_leaf": "#6E5A48", "vine_leaf_dark": "#5E4B3C",
    },
}

# Personnages: rôles des 16 cases d'une rangée (texture 64 x 64, une rangée de 4 px par personnage).
CHAR_SLOTS = [
    "skin", "skin_shade", "hair", "hair_dark", "eye", "mouth", "top", "top_trim",
    "bottom", "shoes", "scarf", "scarf_mark", "extra_a", "extra_b", "metal", "cheek",
]

# Rangée 0 et 1: les deux joueurs (couleurs par défaut, réécrites par le jeu).
CHAR_ROWS = {
    "player_a": {
        "skin": "#E8BE9A", "skin_shade": "#D29D7B", "hair": "#6B4A33", "hair_dark": "#4A3324",
        "eye": "#2A2522", "mouth": "#8E4A43", "top": "#5C7FA6", "top_trim": "#EDE6D3",
        "bottom": "#4A5D78", "shoes": "#5A4636", "scarf": "#5CE1E6", "scarf_mark": "#0E1126",
        "extra_a": "#8C6A48", "extra_b": "#C9B48A", "metal": "#C8A150", "cheek": "#E99A8E",
    },
    "player_b": {
        "skin": "#B9825C", "skin_shade": "#9C6646", "hair": "#2E2622", "hair_dark": "#1E1916",
        "eye": "#2A2522", "mouth": "#7A3D37", "top": "#B5663F", "top_trim": "#EDE6D3",
        "bottom": "#6B5541", "shoes": "#4A3A2E", "scarf": "#8D6CFF", "scarf_mark": "#0E1126",
        "extra_a": "#8C6A48", "extra_b": "#C9B48A", "metal": "#C8A150", "cheek": "#D9857A",
    },
    "firmin": {
        "skin": "#E3B48F", "skin_shade": "#C99273", "hair": "#B9B4AC", "hair_dark": "#8F8A83",
        "eye": "#2A2522", "mouth": "#8A4A42", "top": "#2F3F5C", "top_trim": "#3E5070",
        "bottom": "#4D5258", "shoes": "#2E2A27", "scarf": "#E9E3D3", "scarf_mark": "#B33A33",
        "extra_a": "#28344C", "extra_b": "#B33A33", "metal": "#D2AA55", "cheek": "#E39484",
    },
    "odette": {
        "skin": "#F0C7A6", "skin_shade": "#D9A585", "hair": "#8D7F78", "hair_dark": "#6A5E58",
        "eye": "#2A2522", "mouth": "#A34A4E", "top": "#9C4F67", "top_trim": "#F2EBDD",
        "bottom": "#7E3F55", "shoes": "#4A3A33", "scarf": "#E7B04E", "scarf_mark": "#9C4F67",
        "extra_a": "#F4EEE2", "extra_b": "#D7C7B0", "metal": "#C8A150", "cheek": "#EE8F8C",
    },
    "basile": {
        "skin": "#D7A27C", "skin_shade": "#BC8463", "hair": "#E4E0D8", "hair_dark": "#B8B3AA",
        "eye": "#2A2522", "mouth": "#7E443C", "top": "#A8B6A0", "top_trim": "#7E8C77",
        "bottom": "#5B4A3B", "shoes": "#3B302A", "scarf": "#C2563F", "scarf_mark": "#7E3426",
        "extra_a": "#8E5B37", "extra_b": "#6E4428", "metal": "#9AA0A6", "cheek": "#D98E7C",
    },
    "jeanne": {
        "skin": "#F1C8A3", "skin_shade": "#DBA684", "hair": "#B5652F", "hair_dark": "#8A4A22",
        "eye": "#2A2522", "mouth": "#A34A4E", "top": "#F2D46B", "top_trim": "#FFFFFF",
        "bottom": "#557FB0", "shoes": "#B53F3A", "scarf": "#D9584F", "scarf_mark": "#F2EDE1",
        "extra_a": "#D9584F", "extra_b": "#3E6F9E", "metal": "#C8A150", "cheek": "#F08C86",
    },
    "lucie": {
        "skin": "#C68E68", "skin_shade": "#A9714F", "hair": "#3B2A22", "hair_dark": "#261B16",
        "eye": "#2A2522", "mouth": "#8C4540", "top": "#4E6F8F", "top_trim": "#E0C25A",
        "bottom": "#3E4A5C", "shoes": "#3A2F29", "scarf": "#E0C25A", "scarf_mark": "#4E6F8F",
        "extra_a": "#8C5A35", "extra_b": "#3D5874", "metal": "#C8A150", "cheek": "#D9857A",
    },
    # Tour 9: équipage du train (salut du mécanicien), bustes à la fenêtre de la cabine
    "driver": {
        "skin": "#E0AE88", "skin_shade": "#C48E6C", "hair": "#8C8379", "hair_dark": "#6A625A",
        "eye": "#2A2522", "mouth": "#87463F", "top": "#3E5A86", "top_trim": "#5573A0",
        "bottom": "#2F3E57", "shoes": "#2E2A27", "scarf": "#C2453B", "scarf_mark": "#F0E6D2",
        "extra_a": "#2F3E57", "extra_b": "#33415A", "metal": "#B9A15E", "cheek": "#DE8C7C",
    },
    "stoker": {
        "skin": "#C99572", "skin_shade": "#A97858", "hair": "#3A2E26", "hair_dark": "#261E19",
        "eye": "#2A2522", "mouth": "#7A3F38", "top": "#5B5246", "top_trim": "#6F665A",
        "bottom": "#3C362F", "shoes": "#2E2A27", "scarf": "#EDE6D6", "scarf_mark": "#5B5246",
        "extra_a": "#3C362F", "extra_b": "#4A443D", "metal": "#8F8A82", "cheek": "#8E7A6A",
    },
}
# Tour 10: Achille Pradel (boulanger: chemise blanche, tablier fariné, calot de mitron) et Solange Mérigot
# (coiffeuse et mercière: blouse sauge à poches, jupe prune, ciseaux à la ceinture, lunettes au cou)
CHAR_ROWS["achille"] = {
    "skin": "#E6B892", "skin_shade": "#CB9874", "hair": "#4E3A2C", "hair_dark": "#35271E",
    "eye": "#2A2522", "mouth": "#86453E", "top": "#EEE8DC", "top_trim": "#D9D1C2",
    "bottom": "#55606E", "shoes": "#3B302A", "scarf": "#B5483C", "scarf_mark": "#EEE8DC",
    "extra_a": "#F2EEE4", "extra_b": "#E2DACB", "metal": "#C8A150", "cheek": "#E3907E",
}
CHAR_ROWS["solange"] = {
    "skin": "#EDC3A0", "skin_shade": "#D4A080", "hair": "#9A4A2C", "hair_dark": "#6E331E",
    "eye": "#2A2522", "mouth": "#A3434A", "top": "#7FA595", "top_trim": "#F1EAD9",
    "bottom": "#5B3F5A", "shoes": "#3A2E2A", "scarf": "#E7C05A", "scarf_mark": "#5B3F5A",
    "extra_a": "#B33E3A", "extra_b": "#2E2A28", "metal": "#B9BEC2", "cheek": "#E99289",
}
# 0.13 (docs/jeux/jeu-1/v0-13-habitants.md, section 2.3): les quatorze nouveaux habitants, puis deux rangées
# d'accessoires (vélos; cartable, pot à lait, hache, accordéon). Les cases `scarf` et `scarf_mark` ne servent
# à aucun foulard chez les habitants (bible: aucune couleur vive au cou): elles portent deux couleurs de plus.
def _row(skin, shade, hair, hair_dark, mouth, top, trim, bottom, shoes, c1, c2, a, b, metal, cheek, eye="#2A2522"):
    return dict(zip(CHAR_SLOTS, (skin, shade, hair, hair_dark, eye, mouth, top, trim, bottom, shoes, c1, c2, a, b,
                                 metal, cheek)))


CHAR_ROWS.update({
    # veste de velours noisette, chemise blanche, noeud papillon bleu nuit; scarf: revers et coudières, scarf_mark: craie
    "armand": _row("#E6BC98", "#CC9C7A", "#4A3326", "#31221A", "#8A4640", "#7A5A3F", "#F1ECE2", "#6E7178", "#3A2F29",
                   "#5F4531", "#F4F1EA", "#8A5A35", "#2E3A5C", "#A8A8A2", "#E3948A"),
    # blouse écrue, farine, gilet vert bouteille, jupe brune, sabots; scarf: avant-bras farinés
    "berthe": _row("#E2B08A", "#C79270", "#A8A39C", "#827D76", "#8C4842", "#E7D8B6", "#F6F1E6", "#6B4E37", "#9C7650",
                   "#EBD6C2", "#D9CCAB", "#3F5A45", "#5B4636", "#8F949A", "#E08878"),
    # soutane noire, col blanc, pinces à vélo de laiton, chapeau rond
    "martial": _row("#DDAA85", "#C08E6A", "#A9A6A0", "#7E7B76", "#86453E", "#35373C", "#F2EFE8", "#2B2C31", "#24221F",
                    "#4A4C52", "#5C5E64", "#2A2B2F", "#43454B", "#C8A150", "#E08A7C"),
    # robe gris perle, tablier bleu ardoise, chapeau de paille noir à ruban; scarf: gants de toile
    "marthe": _row("#EBC2A2", "#D1A383", "#CFCAC2", "#A39E96", "#8E4A48", "#B9B4AC", "#D8D3CA", "#ADA8A0", "#2E2A27",
                   "#A89A78", "#4A4E58", "#4A5A6A", "#2C2B2B", "#6F6B66", "#E4A091"),
    # pèlerine crème, robe à petites fleurs bleu passé, chignon blanc, canne de buis
    "honorine": _row("#EEC9AE", "#D6AC90", "#F0ECE4", "#CBC5BB", "#9A5055", "#F1E5C9", "#DDCDAA", "#8796BF",
                     "#3B302A", "#F4F0E6", "#E8C76A", "#C9A766", "#A2724A", "#A8A8A2", "#EBA19A"),
    # veste vert sapin à écusson, velours brun, guêtres de cuir, chapeau de garde
    "ines": _row("#B9825C", "#9C6646", "#231C19", "#120E0C", "#7A3D37", "#3F5A45", "#556F59", "#6B4E37", "#4A3A2E",
                 "#C9B48A", "#A77A45", "#7A5333", "#5E5A45", "#8F949A", "#C27A66"),
    # chemise à carreaux rouge-brun, gilet de cuir, bonnet brun, joues de charbon; scarf_mark: gris de la barbe
    "barnabe": _row("#D49F7A", "#B5805E", "#2B2522", "#1A1614", "#7E3F38", "#A4463B", "#6E2C26", "#3C3A36", "#2E2A27",
                    "#5A4030", "#77716B", "#6B4A33", "#563A27", "#8F949A", "#9A8E86"),
    # chemise écrue, tablier de cuir noirci, pantalon de toile, lunettes de forge
    "mado": _row("#E0AA84", "#C48C66", "#8E4A2A", "#66331C", "#8C4540", "#E4DAC6", "#CFC3AB", "#6A6150", "#3A2F29",
                 "#2C2E31", "#5B4A3B", "#4A3A30", "#6E5640", "#8C9096", "#E48A78"),
    # chemise grise rayée, velours brun à bretelles, bottes, chapeau de paille cabossé
    "paulin": _row("#D8A27A", "#BB845E", "#5A4636", "#3C2E23", "#80423A", "#A3A8AB", "#737A80", "#6B4E37", "#3A332C",
                   "#D8BE7A", "#B89D5C", "#4A3A2E", "#5C3F2A", "#9AA0A6", "#DE8A76"),
    # robe vert pomme passé à carreaux, tablier bleu-gris, sabots, crayon dans le chignon
    "margot": _row("#EDC09C", "#D4A07D", "#5A3B28", "#3E281B", "#A04A4C", "#8BA37B", "#A9BE9B", "#7C946D", "#9C7650",
                   "#D9B65B", "#3A3530", "#6E7F8E", "#F1EDE4", "#A9B0B4", "#E57B70"),
    # chemise blanche, culottes de velours, bretelles, casquette rouge passé; scarf: pansement, scarf_mark: chaussettes
    "leon": _row("#EFC5A2", "#D8A584", "#2B2522", "#17120F", "#A34A4E", "#F0ECE3", "#D9D3C6", "#6B4E37", "#5A4030",
                 "#E8DCC4", "#9C9890", "#6B4A33", "#A65A4E", "#B5BABD", "#F08C86"),
    # blouse grise d'atelier, gilet noir, manchettes de lustrine, chaîne de montre de laiton
    "ambroise": _row("#E7BE9E", "#CDA080", "#EDEAE4", "#C3BEB6", "#8A4A45", "#8D8F94", "#7B7D82", "#3E3F44",
                     "#242220", "#2E2D30", "#1F1E21", "#3A3B40", "#9DB2BE", "#C8A150", "#E39A8C"),
    # veste de toile kaki à poches, pantalon fuselé, bottes de caoutchouc, sacoche, stéthoscope
    "nour": _row("#B9825C", "#9C6646", "#231C19", "#120E0C", "#7A3D37", "#8C8556", "#A39B6B", "#4A4E57", "#3E5240",
                 "#6F7378", "#B9BEC2", "#7A4B2C", "#5A3720", "#C8A150", "#C27A66"),
    # robe brique foncé, tablier noir court, torchon rayé sur l'épaule, boucles d'oreilles de laiton
    "colette": _row("#E8B993", "#CD9A75", "#221C1A", "#120F0E", "#9A3F42", "#8E3F35", "#7A352D", "#8E3F35", "#2E2A27",
                    "#EDE6D6", "#5A7FA6", "#2E2B2A", "#3C3936", "#C8A150", "#E68A80"),
    # vélos (Lucie, l'abbé, Nour): cadre noir, vert loco, pneus, chrome, cuir, laiton, osier, sacoches, poste
    "bicycles": _row("#2C2E31", "#3F6453", "#232120", "#45423E", "#6B4A33", "#C8A150", "#8C6B3E", "#B08A55",
                     "#7A4B2C", "#E0C25A", "#4E6F8F", "#F0ECE3", "#A4463B", "#8F949A", "#5B5E63", eye="#B9BEC2"),
    # accessoires: cuir du cartable, bois, fer-blanc, acier, accordéon
    "props": _row("#8A5A35", "#6B4428", "#A97749", "#765130", "#A9B0B4", "#C9CFD2", "#5E6468", "#8F949A", "#9C2F2A",
                  "#F0ECE3", "#2C2E31", "#C8A150", "#E7D8B6", "#C8A150", "#3A3B40", eye="#2C2E31"),
})
NEW_VILLAGERS = ["armand", "berthe", "martial", "marthe", "honorine", "ines", "barnabe", "mado", "paulin", "margot",
                 "leon", "ambroise", "nour", "colette"]
CHAR_ROW_ORDER = ["player_a", "player_b", "firmin", "odette", "basile", "jeanne", "lucie", "driver", "stoker",
                  "achille", "solange"] + NEW_VILLAGERS + ["bicycles", "props"]

# Choix proposés à la création du personnage (démo: quatre tenues).
PLAYER_PRESETS = {
    "outfits": {
        "bleu_de_travail": {"top": "#5C7FA6", "top_trim": "#EDE6D3", "bottom": "#4A5D78", "shoes": "#5A4636"},
        "rouille": {"top": "#B5663F", "top_trim": "#EDE6D3", "bottom": "#6B5541", "shoes": "#4A3A2E"},
        "sauge": {"top": "#8BA37B", "top_trim": "#F1EBDB", "bottom": "#5E6A55", "shoes": "#4F3F31"},
        "moutarde": {"top": "#D4A746", "top_trim": "#F3ECDA", "bottom": "#6E5B48", "shoes": "#4A3A2E"},
    },
    "skins": ["#F2CDB0", "#E8BE9A", "#D29E78", "#B9825C", "#8E5C3E", "#6A4430"],
    "hairs": ["#2E2622", "#4F3626", "#6B4A33", "#A0663A", "#C9A267", "#B8B2AA"],
    # Tour 10 (conception 2.2): huit couleurs de cheveux, `hairColor` 0 à 7, (cheveux, cheveux sombres); valeurs
    # proposées par l'artiste 3D, à arrêter par le directeur artistique (lisibles sur les quatre saisons et la nuit)
    "hair_colors": [
        {"id": "black", "hair": "#2B2522", "hair_dark": "#1A1614"},
        {"id": "brown", "hair": "#4F3626", "hair_dark": "#36251A"},
        {"id": "chestnut", "hair": "#7A5236", "hair_dark": "#563823"},
        {"id": "auburn", "hair": "#8E3F28", "hair_dark": "#652B1B"},
        {"id": "red", "hair": "#C2622E", "hair_dark": "#93461E"},
        {"id": "straw_blond", "hair": "#D8B46A", "hair_dark": "#B08A48"},
        {"id": "grey", "hair": "#9A958E", "hair_dark": "#75706A"},
        {"id": "white", "hair": "#E8E4DC", "hair_dark": "#C4BEB4"},
    ],
    # Couleurs de profil Duo (design/identite/b/joueurs.json): foulard, et symbole en « on ».
    "scarves": {
        "orb": "#5CE1E6", "crescent": "#8D6CFF", "star": "#D4F27A",
        "sun": "#FC663F", "planet": "#E787B1", "comet": "#22B07D",
    },
    "scarf_mark": "#0E1126",
}


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def world_index():
    names = [w[0] for w in WORLD]
    assert len(names) == len(set(names)), "noms de cases en double"
    assert len(names) <= GRID * GRID
    return {n: i for i, n in enumerate(names)}
