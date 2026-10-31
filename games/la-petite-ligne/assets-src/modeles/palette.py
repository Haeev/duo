"""Palettes de La Petite Ligne (démo, printemps à la Halte d'Aubrune).

Une seule texture palette pour tout le décor (cases de 4 px, 16 x 16 cases),
avec ses deux compagnes de même disposition: rugosité et métal (vert et bleu),
et lueur de nuit (émission). Les personnages ont leur propre texture: une
rangée de 16 cases par personnage, mêmes rôles de case pour tous.

Source unique des couleurs: la bible artistique de la démo les reprend.
"""

CELL = 4          # pixels par case
GRID = 16         # cases par côté (texture de 64 x 64)

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
]

# Variantes de saison: seules les cases citées changent (même disposition).
SEASONS = {
    "ete": {
        "grass": "#9AAF55", "grass_light": "#B9C26B", "grass_dark": "#738D43",
        "grass_dry": "#D3C273", "leaf_oak": "#5E8C3D", "leaf_oak_light": "#7AA34B",
        "leaf_birch": "#94B455", "leaf_birch_light": "#B1C86A",
    },
    "automne": {
        "grass": "#A6A55C", "grass_light": "#BDB46B", "grass_dark": "#7D8447",
        "grass_dry": "#D1B56E", "moss": "#8E8F4B",
        "leaf_oak": "#C27F3B", "leaf_oak_light": "#D69A47",
        "leaf_birch": "#E2B84E", "leaf_birch_light": "#EECB63",
        "leaf_bush": "#9C7A3E", "leaf_hazel": "#C8A048",
    },
    "hiver": {
        "grass": "#C9CEC4", "grass_light": "#E2E5DE", "grass_dark": "#A4AC9F",
        "grass_dry": "#C8BFA4", "moss": "#9EA597",
        "leaf_oak": "#8D7A62", "leaf_oak_light": "#A39079",
        "leaf_birch": "#B5A88F", "leaf_birch_light": "#C9BFA9",
        "leaf_bush": "#7D8A72", "leaf_hazel": "#9A8C72",
        "leaf_fir": "#486B57", "leaf_fir_light": "#C9D4D0",
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
}
CHAR_ROW_ORDER = ["player_a", "player_b", "firmin", "odette", "basile", "jeanne", "lucie"]

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
