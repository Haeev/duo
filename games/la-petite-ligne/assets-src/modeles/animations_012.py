"""Animations plus vivantes de la 0.12 (demande du client: des gestes qui correspondent à ce que font les
personnages, lisibles à la caméra isométrique, transitions fondues).

Appelé par personnages.py après les clips d'avant: remplace les clips existants (mêmes noms, mêmes durées,
mêmes instants de contact que `gestureImpact` de `src/rendu/reglages.ts`: houe 0,53 s, hache 0,62 s,
récolte 0,34 s, semis 0,4 s, marteau 0,27 s) et en ajoute de nouveaux (`NEW_CLIPS`).

Conventions des poses (repère des os, degrés): x plie vers l'avant (buste) ou lève vers l'avant (bras,
cuisse), y tord autour de l'os, z écarte sur le côté (bras gauche positif vers l'extérieur); `hips_loc`
(0, y, 0) monte ou descend le bassin. Les clés sont lissées par Blender (courbes de Bézier): l'anticipation
et le retour sont des clés à part, rapprochées autour du contact.
"""

ARMS = {"upper_arm_l": (2, 0, 5), "upper_arm_r": (2, 0, -5), "forearm_l": (12, 0, 0), "forearm_r": (12, 0, 0)}

# Clips créés à ce tour (nom: (boucle, durée en s, contact en s ou None, usage))
NEW_CLIPS = {
    "drink": (True, 1.6, 0.8, "boire: tasse ou gourde portée à la bouche (objet sous socket_hand_r)"),
    "carry_one": (True, 0.533, None, "marcher en portant seul un objet devant la poitrine, mêmes pas que walk"),
    "carry_one_idle": (True, 3.0, None, "à l'arrêt avec l'objet porté seul"),
    "cook": (True, 1.6, 0.4, "cuisiner: la main droite remue la casserole, la gauche tient la queue"),
    "pickup": (False, 1.0, 0.43, "ramasser au sol: se baisser, prendre, remonter l'objet à la poitrine"),
    "feed": (True, 1.2, 0.4, "nourrir les poules: grain jeté bas, en arc, depuis un sac à la hanche"),
    "sit_down": (False, 0.6, None, "s'asseoir: de debout à la pose de sit (enchaîner sur sit)"),
    "stand_up": (False, 0.6, None, "se lever: de la pose de sit à debout (enchaîner sur idle)"),
}


def merge(*ps):
    out = {}
    for p in ps:
        out.update(p)
    return out


def mirror(pose):
    out = {}
    for k, v in pose.items():
        k2 = k[:-2] + "_r" if k.endswith("_l") else k[:-2] + "_l" if k.endswith("_r") else k
        out[k2] = v if k == "hips_loc" else (v[0], -v[1], -v[2])
    return out


def walk_cycle(swing=30, bob=0.032, arm=30, frames=16, arms=None, lean=5):
    """Marche en 8 clés: contact, amorti (le plus bas), passage, poussée (le plus haut), puis l'autre pied.
    Balancier des bras opposé aux jambes avec l'avant-bras en retard, bassin qui tourne et penche, buste et
    tête qui compensent (le regard reste droit), petit rebond deux fois par cycle."""
    c = {"thigh_l": (swing, 0, 0), "shin_l": (-5, 0, 0), "foot_l": (10, 0, 0),
         "thigh_r": (-swing * 0.75, 0, 0), "shin_r": (-20, 0, 0), "foot_r": (-16, 0, 0),
         "upper_arm_l": (-arm, 0, 6), "upper_arm_r": (arm, 0, -6), "forearm_l": (10, 0, 0), "forearm_r": (30, 0, 0),
         "hips": (0, 7, -2), "spine": (lean, -3, 0), "chest": (2, -5, 1), "head": (-3, 4, -1),
         "hips_loc": (0, -bob * 0.2, 0)}
    d = {"thigh_l": (swing * 0.8, 0, 0), "shin_l": (-18, 0, 0), "foot_l": (2, 0, 0),
         "thigh_r": (-swing * 0.6, 0, 0), "shin_r": (-38, 0, 0), "foot_r": (-28, 0, 0),
         "upper_arm_l": (-arm * 1.06, 0, 6), "upper_arm_r": (arm * 1.06, 0, -6), "forearm_l": (12, 0, 0),
         "forearm_r": (34, 0, 0), "hips": (0, 5, -3), "spine": (lean + 1, -2, 0), "chest": (3, -4, 1),
         "head": (0, 3, -1), "hips_loc": (0, -bob, 0)}
    p = {"thigh_l": (4, 0, 0), "shin_l": (-6, 0, 0), "foot_l": (0, 0, 0),
         "thigh_r": (16, 0, 0), "shin_r": (-72, 0, 0), "foot_r": (8, 0, 0),
         "upper_arm_l": (-6, 0, 6), "upper_arm_r": (8, 0, -6), "forearm_l": (16, 0, 0), "forearm_r": (20, 0, 0),
         "hips": (0, 0, -2), "spine": (lean, 0, 0), "chest": (1, 0, 0), "head": (-2, 0, 0),
         "hips_loc": (0, bob * 0.5, 0)}
    u = {"thigh_l": (-12, 0, 0), "shin_l": (-6, 0, 0), "foot_l": (-10, 0, 0),
         "thigh_r": (swing * 0.93, 0, 0), "shin_r": (-34, 0, 0), "foot_r": (6, 0, 0),
         "upper_arm_l": (arm * 0.55, 0, 6), "upper_arm_r": (-arm * 0.55, 0, -6), "forearm_l": (14, 0, 0),
         "forearm_r": (20, 0, 0), "hips": (0, -4, 0), "spine": (lean - 1, 2, 0), "chest": (0, 3, 0),
         "head": (-4, -2, 0), "hips_loc": (0, bob, 0)}
    keys = [c, d, p, u]
    if arms:
        keys = [merge(k, arms) for k in keys]
    q = frames // 8
    out = {}
    for i, k in enumerate(keys):
        out[i * q] = k
        m = mirror(k)
        if arms:
            m = merge(m, arms)
        out[(i + 4) * q] = m
    out[frames] = keys[0]
    return out


def idle():
    """Attente de 6 s: respiration (poitrine et épaules, toutes les 2 s), appui qui passe sur une jambe, regard
    à gauche puis à droite, la main droite qui se lève un instant (on rajuste sa manche) et revient."""
    base = merge(ARMS, {"chest": (0, 0, 0), "head": (0, 0, 0)})

    def breath(p, k):
        q = dict(p)
        c = q.get("chest", (0, 0, 0))
        q["chest"] = (c[0] - 2.5 * k, c[1], c[2])
        q["spine"] = (-0.6 * k, 0, 0)
        ul, ur = q.get("upper_arm_l", (0, 0, 0)), q.get("upper_arm_r", (0, 0, 0))
        q["upper_arm_l"] = (ul[0], ul[1], ul[2] + 1.5 * k)
        q["upper_arm_r"] = (ur[0], ur[1], ur[2] - 1.5 * k)
        q["hips_loc"] = (0, 0.004 * k, 0)
        return q
    shift = {"hips": (0, 0, 1.8), "thigh_l": (0, 0, -1.8), "thigh_r": (3, 0, -1.8), "shin_r": (-7, 0, 0),
             "foot_r": (4, 0, 0)}
    look_l = {"head": (0, 14, 0), "neck": (0, 4, 0)}
    look_r = {"head": (2, -10, 2), "neck": (0, -3, 0)}
    hand = {"upper_arm_r": (14, 0, -10), "forearm_r": (48, 0, 0), "hand_r": (-12, 0, 0), "upper_arm_l": (14, 0, 2),
            "forearm_l": (40, 0, 0), "head": (8, -6, 0)}
    return {0: breath(base, 0), 30: breath(base, 1), 45: breath(merge(base, shift), 0.5),
            60: breath(merge(base, shift), 0), 75: breath(merge(base, shift, look_l), 0.5),
            90: breath(merge(base, shift, look_l), 1), 105: breath(merge(base, hand), 0.4),
            114: breath(merge(base, hand, {"hand_r": (-4, 0, 6)}), 0.1), 125: breath(merge(base, look_r), 0),
            150: breath(merge(base, look_r), 1), 165: breath(base, 0.4), 180: breath(base, 0)}


def anims_012(A, SIT_LEGS):
    """Remplace et complète le dictionnaire de clips A (nom: (boucle, {image: pose}))."""
    A["idle"] = (True, idle())
    A["walk"] = (True, walk_cycle())
    carry_two_arms = {"upper_arm_l": (168, 0, 12), "upper_arm_r": (168, 0, -12), "forearm_l": (18, 0, 0),
                      "forearm_r": (18, 0, 0), "hand_l": (20, 0, 0), "hand_r": (20, 0, 0), "head": (-4, 0, 0)}
    A["carry_two"] = (True, walk_cycle(swing=22, bob=0.022, frames=24, arms=carry_two_arms, lean=0))

    # Houe: on la lève derrière la tête (dos cambré), courte suspension, coup au sol à 0,53 s, recul, on tire
    # la terre vers soi, retour.
    hold = {"upper_arm_r": (38, 0, 4), "forearm_r": (38, 0, 0), "upper_arm_l": (44, 0, -14), "forearm_l": (40, 0, 0),
            "hand_r": (-20, 0, 0), "hand_l": (-20, 0, 0), "spine": (6, 0, 0), "thigh_l": (8, 0, 0),
            "thigh_r": (-4, 0, 0)}
    antic = merge(hold, {"upper_arm_r": (24, 0, 4), "forearm_r": (30, 0, 0), "upper_arm_l": (30, 0, -14),
                         "spine": (10, 0, 0), "thigh_l": (14, 0, 0), "shin_l": (-12, 0, 0), "shin_r": (-8, 0, 0),
                         "hips_loc": (0, -0.018, 0), "head": (6, 0, 0)})
    raised = {"upper_arm_r": (158, 0, 4), "forearm_r": (24, 0, 0), "upper_arm_l": (152, 0, -12),
              "forearm_l": (28, 0, 0), "spine": (-9, 0, 0), "chest": (-7, 0, 0), "head": (-6, 0, 0),
              "hand_r": (-30, 0, 0), "hand_l": (-30, 0, 0), "thigh_l": (8, 0, 0), "hips_loc": (0, 0.008, 0)}
    hang = merge(raised, {"upper_arm_r": (164, 0, 4), "upper_arm_l": (158, 0, -12), "spine": (-11, 0, 0)})
    strike = {"upper_arm_r": (62, 0, 4), "forearm_r": (8, 0, 0), "upper_arm_l": (66, 0, -12),
              "forearm_l": (12, 0, 0), "spine": (24, 0, 0), "chest": (8, 0, 0), "head": (6, 0, 0),
              "hips_loc": (0, -0.05, 0), "thigh_l": (18, 0, 0), "thigh_r": (14, 0, 0), "shin_l": (-30, 0, 0),
              "shin_r": (-26, 0, 0), "foot_l": (12, 0, 0), "foot_r": (12, 0, 0), "hand_r": (-10, 0, 0),
              "hand_l": (-10, 0, 0)}
    # recul: le manche rebondit (bras un peu relevés), le corps finit d'amortir sans descendre plus bas
    recoil = merge(strike, {"spine": (21, 0, 0), "chest": (6, 0, 0), "hips_loc": (0, -0.042, 0), "head": (9, 0, 0)})
    drag = merge(strike, {"upper_arm_r": (48, 0, 4), "forearm_r": (26, 0, 0), "upper_arm_l": (52, 0, -12),
                          "forearm_l": (30, 0, 0), "spine": (19, 0, 0), "hips_loc": (0, -0.035, 0)})
    A["hoe"] = (True, {0: hold, 5: antic, 11: raised, 13: hang, 16: strike, 18: recoil, 23: drag, 30: hold})

    # Semis (contact 0,4 s): la main plonge dans le sac, puis jette en arc, accompagne, revient.
    bag = {"upper_arm_l": (22, 0, -6), "forearm_l": (78, 0, 0), "hand_l": (10, 0, 0)}
    sow_a = merge(bag, {"spine": (14, 0, 0), "chest": (6, 0, 0), "head": (12, 0, 0), "upper_arm_r": (18, 0, -8),
                        "forearm_r": (30, 0, 0)})
    dip = merge(sow_a, {"upper_arm_r": (12, 0, 6), "forearm_r": (70, 0, 0), "hand_r": (-20, 0, 0),
                        "head": (18, 6, 0), "chest": (8, 6, 0)})
    throw = merge(bag, {"spine": (18, -6, 0), "chest": (8, -8, 0), "head": (14, -6, 0),
                        "upper_arm_r": (62, 0, -26), "forearm_r": (12, 0, 0), "hand_r": (35, 0, 0),
                        "hips_loc": (0, -0.015, 0), "thigh_l": (10, 0, 0)})
    follow = merge(throw, {"upper_arm_r": (72, 0, -34), "forearm_r": (6, 0, 0), "hand_r": (8, 0, 0),
                           "chest": (8, -12, 0)})
    A["sow"] = (True, {0: sow_a, 6: dip, 12: throw, 16: follow, 22: merge(sow_a, {"upper_arm_r": (30, 0, -10)}),
                       30: sow_a})

    # Arrosoir: on l'incline, on balaie la rangée de gauche à droite en suivant des yeux, on le relève.
    can = {"upper_arm_r": (40, 0, -6), "forearm_r": (14, 0, 0), "spine": (10, 0, 0), "head": (16, 0, 0),
           "upper_arm_l": (8, 0, 6), "forearm_l": (16, 0, 0), "thigh_l": (8, 0, 0), "shin_l": (-6, 0, 0)}
    A["water"] = (True, {0: merge(can, {"hand_r": (0, 0, 0)}),
                         8: merge(can, {"hand_r": (-50, 0, 0), "upper_arm_r": (46, 0, -6), "hips_loc": (0, -0.01, 0)}),
                         16: merge(can, {"hand_r": (-54, 0, 0), "upper_arm_r": (44, 0, -14), "chest": (0, -7, 0),
                                         "head": (18, -8, 0), "hips_loc": (0, -0.012, 0)}),
                         26: merge(can, {"hand_r": (-52, 0, 0), "upper_arm_r": (48, 0, 2), "chest": (0, 7, 0),
                                         "head": (18, 8, 0), "hips_loc": (0, -0.012, 0)}),
                         33: merge(can, {"hand_r": (-30, 0, 0), "upper_arm_r": (44, 0, -6)}),
                         40: merge(can, {"hand_r": (0, 0, 0)})})

    # Récolte (contact 0,34 s): on se baisse en pliant les genoux, on saisit, on tire en deux temps, on montre la
    # récolte devant soi, on se relève.
    stand = merge(ARMS, {})
    bend = {"spine": (16, 0, 0), "chest": (6, 0, 0), "head": (14, 0, 0), "hips_loc": (0, -0.06, 0.01),
            "thigh_l": (22, 0, 6), "thigh_r": (22, 0, -6), "shin_l": (-32, 0, 0), "shin_r": (-32, 0, 0),
            "foot_l": (10, 0, 0), "foot_r": (10, 0, 0), "upper_arm_l": (30, 0, -4), "upper_arm_r": (30, 0, 4),
            "forearm_l": (20, 0, 0), "forearm_r": (20, 0, 0)}
    crouch = {"spine": (34, 0, 0), "chest": (14, 0, 0), "head": (10, 0, 0), "hips_loc": (0, -0.16, 0.02),
              "thigh_l": (58, 0, 6), "thigh_r": (58, 0, -6), "shin_l": (-88, 0, 0), "shin_r": (-88, 0, 0),
              "foot_l": (30, 0, 0), "foot_r": (30, 0, 0), "upper_arm_l": (58, 0, -6), "upper_arm_r": (58, 0, 6),
              "forearm_l": (26, 0, 0), "forearm_r": (26, 0, 0)}
    grasp = merge(crouch, {"forearm_l": (36, 0, 0), "forearm_r": (36, 0, 0), "upper_arm_l": (60, 0, -10),
                           "upper_arm_r": (60, 0, 10)})
    tug = merge(crouch, {"spine": (30, 0, 0), "hips_loc": (0, -0.14, 0.02), "upper_arm_l": (50, 0, -8),
                         "upper_arm_r": (50, 0, 8), "forearm_l": (52, 0, 0), "forearm_r": (52, 0, 0),
                         "head": (6, 0, 0)})
    pull = merge(crouch, {"spine": (20, 0, 0), "hips_loc": (0, -0.1, 0.02), "thigh_l": (40, 0, 6),
                          "thigh_r": (40, 0, -6), "shin_l": (-62, 0, 0), "shin_r": (-62, 0, 0),
                          "foot_l": (22, 0, 0), "foot_r": (22, 0, 0), "upper_arm_l": (52, 0, -8),
                          "upper_arm_r": (52, 0, 8), "forearm_l": (70, 0, 0), "forearm_r": (70, 0, 0)})
    show = merge(stand, {"upper_arm_l": (40, 0, -8), "upper_arm_r": (40, 0, 8), "forearm_l": (95, 0, 0),
                         "forearm_r": (95, 0, 0), "head": (8, 0, 0), "chest": (-5, 0, 0), "hips_loc": (0, 0.006, 0)})
    A["harvest"] = (True, {0: stand, 4: bend, 9: crouch, 12: grasp, 16: tug, 21: pull, 27: show,
                           32: merge(show, {"forearm_l": (60, 0, 0), "forearm_r": (60, 0, 0)}), 36: stand})

    # Hache (contact 0,62 s, entre les images 17 et 23 où la pose de frappe ne bouge pas): on recule les
    # hanches en tournant, levée haute, frappe, secousse de l'impact, retour.
    ax_hold = {"upper_arm_r": (30, 0, 8), "forearm_r": (30, 0, 0), "upper_arm_l": (36, 0, -16),
               "forearm_l": (36, 0, 0), "hand_r": (-30, 0, 0), "hand_l": (-30, 0, 0), "thigh_l": (8, 0, 0)}
    ax_antic = merge(ax_hold, {"chest": (0, 10, 0), "spine": (4, 4, 0), "upper_arm_r": (22, 0, 8),
                               "upper_arm_l": (28, 0, -16), "hips_loc": (0, -0.02, 0), "shin_l": (-10, 0, 0),
                               "shin_r": (-8, 0, 0)})
    ax_up = {"upper_arm_r": (134, -20, -30), "forearm_r": (40, 0, 0), "upper_arm_l": (124, 0, -40),
             "forearm_l": (60, 0, 0), "chest": (-8, -30, 0), "spine": (0, -14, 0), "head": (0, 22, 0),
             "hand_r": (-40, 0, 0), "hand_l": (-40, 0, 0), "thigh_l": (8, 0, 0), "thigh_r": (-6, 0, 0),
             "hips_loc": (0, 0.006, 0)}
    ax_hang = merge(ax_up, {"upper_arm_r": (140, -20, -30), "upper_arm_l": (130, 0, -40)})
    ax_hit = {"upper_arm_r": (82, 0, 18), "forearm_r": (6, 0, 0), "upper_arm_l": (84, 0, -22),
              "forearm_l": (10, 0, 0), "chest": (6, 18, 0), "spine": (10, 8, 0), "head": (0, -10, 0),
              "hand_r": (0, 0, 0), "hand_l": (0, 0, 0), "thigh_l": (14, 0, 0), "shin_l": (-14, 0, 0),
              "hips_loc": (0, -0.03, 0)}
    shake = merge(ax_hit, {"upper_arm_r": (85, 0, 18), "upper_arm_l": (87, 0, -22), "chest": (8, 20, 0),
                           "hips_loc": (0, -0.034, 0)})
    A["chop"] = (True, {0: ax_hold, 5: ax_antic, 12: ax_up, 14: ax_hang, 17: ax_hit, 19: shake, 23: ax_hit,
                        28: merge(ax_hold, {"spine": (6, 0, 0)}), 32: ax_hold})

    # Scie à l'établi: le buste pousse avec la lame, la main gauche tient la planche.
    saw_base = {"spine": (22, 0, 0), "chest": (6, 4, 0), "head": (14, 0, 0), "upper_arm_l": (46, 0, -18),
                "forearm_l": (48, 0, 0), "hand_l": (-20, 0, 0), "thigh_l": (12, 0, 0), "shin_l": (-8, 0, 0),
                "thigh_r": (-8, 0, 0)}
    back = merge(saw_base, {"upper_arm_r": (22, 0, -6), "forearm_r": (78, 0, 0), "hand_r": (-50, 0, 0),
                            "spine": (20, 0, 0)})
    push = merge(saw_base, {"upper_arm_r": (60, 0, -6), "forearm_r": (24, 0, 0), "hand_r": (-20, 0, 0),
                            "chest": (9, -5, 0), "spine": (26, 0, 0), "hips_loc": (0, -0.012, 0)})
    A["saw"] = (True, {0: back, 8: push, 10: merge(push, {"upper_arm_r": (58, 0, -6)}), 18: back})

    # Marteau (contact 0,27 s): on arme plus haut, on frappe, rebond, on réarme.
    ham_base = {"spine": (18, 0, 0), "head": (16, 0, 0), "upper_arm_l": (38, 0, -14), "forearm_l": (46, 0, 0),
                "hand_l": (-10, 0, 0)}
    up_ = merge(ham_base, {"upper_arm_r": (70, 0, -4), "forearm_r": (100, 0, 0), "hand_r": (-30, 0, 0)})
    top = merge(ham_base, {"upper_arm_r": (78, 0, -4), "forearm_r": (112, 0, 0), "hand_r": (-38, 0, 0),
                           "chest": (-3, 0, 0)})
    hit = merge(ham_base, {"upper_arm_r": (44, 0, -4), "forearm_r": (26, 0, 0), "hand_r": (10, 0, 0),
                           "spine": (21, 0, 0)})
    reb = merge(ham_base, {"upper_arm_r": (48, 0, -4), "forearm_r": (36, 0, 0), "hand_r": (2, 0, 0)})
    A["hammer"] = (True, {0: up_, 4: top, 8: hit, 10: reb, 12: merge(hit, {"spine": (19, 0, 0)}), 20: up_})

    # Parler: mains qui expliquent (paumes ouvertes, l'une puis l'autre), haussement d'épaules, hochements.
    t0 = merge(ARMS, {"upper_arm_r": (18, 0, -10), "forearm_r": (62, 0, 0), "hand_r": (10, 0, 0)})
    t1 = merge(ARMS, {"upper_arm_r": (26, 0, -18), "forearm_r": (84, 24, 0), "hand_r": (-14, 0, 0),
                      "upper_arm_l": (16, 0, 10), "forearm_l": (50, 0, 0), "head": (-4, 6, -3), "chest": (0, 5, 0)})
    t2 = merge(ARMS, {"upper_arm_r": (24, 0, -22), "forearm_r": (76, 30, 0), "upper_arm_l": (24, 0, 22),
                      "forearm_l": (76, -30, 0), "chest": (-3, 0, 0), "head": (3, 0, 5), "hips_loc": (0, 0.006, 0)})
    t3 = merge(ARMS, {"upper_arm_r": (14, 0, -8), "forearm_r": (54, 0, 0), "head": (8, -2, 2),
                      "upper_arm_l": (22, 0, 14), "forearm_l": (72, -22, 0), "chest": (0, -5, 0)})
    A["talk"] = (True, {0: t0, 12: t1, 24: t2, 32: merge(t2, {"head": (-2, 0, 3)}), 44: t3,
                        52: merge(t3, {"head": (2, -4, 0)}), 60: t0})

    # Donner (une fois): on rapproche l'objet de soi, on le tend en se penchant et en avançant un pied.
    give_in = merge(ARMS, {"upper_arm_l": (30, 0, -8), "upper_arm_r": (30, 0, 8), "forearm_l": (72, 0, 0),
                           "forearm_r": (72, 0, 0), "spine": (-3, 0, 0), "head": (2, 0, 0)})
    give = merge(ARMS, {"upper_arm_l": (68, 0, -8), "upper_arm_r": (68, 0, 8), "forearm_l": (18, 0, 0),
                        "forearm_r": (18, 0, 0), "hand_l": (-24, 0, 0), "hand_r": (-24, 0, 0),
                        "spine": (10, 0, 0), "head": (8, 0, 0), "thigh_l": (10, 0, 0), "shin_l": (-6, 0, 0)})
    A["give"] = (False, {0: ARMS, 6: give_in, 14: give, 22: give, 32: ARMS})

    # Assis: respiration, regard qui se pose ailleurs, mains qui changent de place sur les cuisses.
    sit = merge(SIT_LEGS, {"upper_arm_l": (22, 0, 0), "upper_arm_r": (22, 0, 0), "forearm_l": (42, 0, 0),
                           "forearm_r": (42, 0, 0), "hand_l": (10, 0, 0), "hand_r": (10, 0, 0)})
    A["sit"] = (True, {0: sit, 20: merge(sit, {"chest": (-2.5, 0, 0), "hips_loc": (0, -0.356, 0)}),
                       40: merge(sit, {"head": (-2, 10, 0), "neck": (0, 3, 0)}),
                       60: merge(sit, {"chest": (-2.5, 0, 0), "head": (2, 6, 0), "forearm_r": (50, 0, 0),
                                       "hips_loc": (0, -0.356, 0)}), 80: sit})
    stand_ = merge(ARMS, {})
    lean_fwd = merge(SIT_LEGS, {"spine": (30, 0, 0), "chest": (8, 0, 0), "head": (-8, 0, 0),
                                "upper_arm_l": (36, 0, -4), "upper_arm_r": (36, 0, 4), "forearm_l": (30, 0, 0),
                                "forearm_r": (30, 0, 0), "hips_loc": (0, -0.33, 0.0)})
    half = {"spine": (26, 0, 0), "chest": (6, 0, 0), "head": (-6, 0, 0), "hips_loc": (0, -0.19, 0.0),
            "thigh_l": (52, 0, 2), "thigh_r": (52, 0, -2), "shin_l": (-56, 0, 0), "shin_r": (-56, 0, 0),
            "foot_l": (4, 0, 0), "foot_r": (4, 0, 0), "upper_arm_l": (30, 0, -4), "upper_arm_r": (30, 0, 4),
            "forearm_l": (24, 0, 0), "forearm_r": (24, 0, 0)}
    A["sit_down"] = (False, {0: stand_, 6: half, 12: lean_fwd, 18: sit})
    A["stand_up"] = (False, {0: sit, 6: lean_fwd, 12: half, 18: stand_})

    eat_a = {"upper_arm_r": (40, 0, -12), "forearm_r": (96, 0, 0), "hand_r": (-10, 0, 0), "upper_arm_l": (34, 0, 6),
             "forearm_l": (64, 0, 0), "head": (6, 0, 0)}
    eat_b = merge(eat_a, {"upper_arm_r": (52, 0, -18), "forearm_r": (132, 0, 0), "head": (-3, 0, 0)})
    chew = merge(eat_a, {"head": (2, 0, 0), "upper_arm_r": (44, 0, -14), "forearm_r": (110, 0, 0)})
    A["eat"] = (True, {0: merge(ARMS, eat_a), 10: merge(ARMS, eat_b), 15: merge(ARMS, eat_b, {"head": (-5, 0, 0)}),
                       22: merge(ARMS, chew), 28: merge(ARMS, chew, {"head": (4, 0, 0)}), 34: merge(ARMS, eat_a)})
    A["sit_eat"] = (True, {0: merge(SIT_LEGS, eat_a), 10: merge(SIT_LEGS, eat_b),
                           15: merge(SIT_LEGS, eat_b, {"head": (-5, 0, 0)}), 22: merge(SIT_LEGS, chew),
                           28: merge(SIT_LEGS, chew, {"head": (4, 0, 0)}), 34: merge(SIT_LEGS, eat_a)})

    w0 = merge(ARMS, {"upper_arm_r": (12, 0, -150), "forearm_r": (0, 0, -24), "hand_r": (0, 0, -12),
                      "head": (0, 0, 5), "chest": (0, 0, 4), "hips": (0, 0, -2)})
    w1 = merge(w0, {"forearm_r": (0, 0, 24), "hand_r": (0, 0, 12), "chest": (0, 0, 6), "head": (0, 0, 7)})
    A["wave"] = (True, {0: w0, 8: w1, 16: w0, 24: w1, 32: w0})

    pet = merge(crouch, {"upper_arm_r": (62, 0, 4), "forearm_r": (20, 0, 0), "upper_arm_l": (30, 0, 4),
                         "forearm_l": (60, 0, 0), "head": (16, 6, 0)})
    A["pet"] = (True, {0: pet, 8: merge(pet, {"upper_arm_r": (54, 0, 0), "hand_r": (24, 0, 0)}),
                       16: merge(pet, {"upper_arm_r": (66, 0, 6), "hand_r": (-6, 0, 0), "head": (16, 2, 0)}),
                       24: pet})

    # Nouveaux clips -------------------------------------------------------------------------------
    cup0 = merge(ARMS, {"upper_arm_r": (30, 0, -12), "forearm_r": (92, 0, 0), "hand_r": (0, 0, 0)})
    cup1 = merge(ARMS, {"upper_arm_r": (50, 0, -16), "forearm_r": (132, 0, 0), "hand_r": (-24, 0, 0),
                        "head": (-12, 0, 0), "chest": (-3, 0, 0)})
    A["drink"] = (True, {0: cup0, 14: cup1, 24: merge(cup1, {"head": (-18, 0, 0), "hand_r": (-34, 0, 0)}),
                         34: merge(cup1, {"head": (-6, 0, 0)}), 48: cup0})
    box = {"upper_arm_l": (40, 0, -10), "upper_arm_r": (40, 0, 10), "forearm_l": (66, 0, 0),
           "forearm_r": (66, 0, 0), "hand_l": (-10, 0, -8), "hand_r": (-10, 0, 8), "chest": (-4, 0, 0)}
    A["carry_one"] = (True, walk_cycle(swing=24, bob=0.026, arms=box, lean=1))
    A["carry_one_idle"] = (True, {0: merge(ARMS, box), 45: merge(ARMS, box, {"chest": (-6, 0, 0),
                                                                              "hips_loc": (0, 0.004, 0)}),
                                  90: merge(ARMS, box)})
    pot = {"upper_arm_l": (30, 0, -4), "forearm_l": (64, 0, 0), "hand_l": (-10, 0, 0), "spine": (10, 0, 0),
           "head": (18, 0, 0)}
    A["cook"] = (True, {0: merge(pot, {"upper_arm_r": (36, 0, -14), "forearm_r": (62, 10, 0)}),
                        12: merge(pot, {"upper_arm_r": (42, 0, -6), "forearm_r": (56, 0, 0), "chest": (0, 3, 0)}),
                        24: merge(pot, {"upper_arm_r": (36, 0, 2), "forearm_r": (62, -10, 0)}),
                        36: merge(pot, {"upper_arm_r": (30, 0, -6), "forearm_r": (68, 0, 0), "chest": (0, -3, 0)}),
                        48: merge(pot, {"upper_arm_r": (36, 0, -14), "forearm_r": (62, 10, 0)})})
    reach = merge(crouch, {"spine": (42, 0, 0), "hips_loc": (0, -0.14, 0.02), "thigh_l": (50, 0, 6),
                           "thigh_r": (50, 0, -6), "shin_l": (-76, 0, 0), "shin_r": (-76, 0, 0),
                           "upper_arm_l": (68, 0, -6), "upper_arm_r": (68, 0, 6), "forearm_l": (14, 0, 0),
                           "forearm_r": (14, 0, 0), "head": (14, 0, 0)})
    A["pickup"] = (False, {0: stand, 7: bend, 13: reach, 17: merge(reach, {"forearm_l": (30, 0, 0),
                                                                          "forearm_r": (30, 0, 0)}),
                           24: show, 30: merge(show, {"forearm_l": (80, 0, 0), "forearm_r": (80, 0, 0)})})
    hip_bag = {"upper_arm_l": (10, 0, 4), "forearm_l": (50, 0, 0), "hand_l": (10, 0, 0)}
    f_a = merge(hip_bag, {"spine": (12, 0, 0), "head": (20, 0, 0), "upper_arm_r": (8, 0, 4), "forearm_r": (60, 0, 0),
                          "hand_r": (-20, 0, 0)})
    f_b = merge(hip_bag, {"spine": (20, -8, 0), "chest": (6, -8, 0), "head": (24, -8, 0),
                          "upper_arm_r": (44, 0, -30), "forearm_r": (8, 0, 0), "hand_r": (30, 0, 0),
                          "hips_loc": (0, -0.02, 0), "thigh_l": (10, 0, 0), "shin_l": (-8, 0, 0)})
    A["feed"] = (True, {0: f_a, 12: f_b, 16: merge(f_b, {"upper_arm_r": (50, 0, -40), "hand_r": (10, 0, 0)}),
                        26: merge(f_a, {"upper_arm_r": (14, 0, -6)}), 36: f_a})
    return A
