"""Définition commune d'un son du jeu: ce qui sert à le fabriquer et ce qu'en lira le moteur
(sons.json). Les identifiants sont en anglais (code), les descriptions en français.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

# Écoute dans le monde (PannerNode, modèle « inverse », distances en mètres de la grille).
# gain = refDistance / (refDistance + rolloffFactor x (distance - refDistance)); au-delà de
# cullBeyondM, le son n'est pas joué du tout (économie de voix).
SPATIAL = {
    "pres": {"distanceModel": "inverse", "refDistance": 2.0, "rolloffFactor": 1.3, "maxDistance": 28.0,
             "cullBeyondM": 28.0},
    "moyen": {"distanceModel": "inverse", "refDistance": 3.0, "rolloffFactor": 1.0, "maxDistance": 45.0,
              "cullBeyondM": 45.0},
    "loin": {"distanceModel": "inverse", "refDistance": 8.0, "rolloffFactor": 0.7, "maxDistance": 120.0,
             "cullBeyondM": 160.0},
    # Le train et sa cloche s'entendent dans tout le bourg et au-delà: niveau plancher garanti.
    "vallee": {"distanceModel": "inverse", "refDistance": 15.0, "rolloffFactor": 0.5, "maxDistance": 400.0,
               "cullBeyondM": 100000.0, "minGainDb": -14.0},
    # Le bouchon est à 6 m du pêcheur: référence à 6 m, pour que la touche s'entende nettement.
    "bouchon": {"distanceModel": "inverse", "refDistance": 6.0, "rolloffFactor": 1.0, "maxDistance": 40.0,
                "cullBeyondM": 40.0},
    # Bêtes des moments rares: « audible à N m » (fiches du tour 6) = coupé au-delà de N m, où le
    # gain est déjà vers -17 dB: le son n'apparaît ni ne disparaît d'un coup au bord.
    "faune-12": {"distanceModel": "inverse", "refDistance": 2.0, "rolloffFactor": 1.3, "maxDistance": 12.0,
                 "cullBeyondM": 12.0},
    "faune-15": {"distanceModel": "inverse", "refDistance": 2.5, "rolloffFactor": 1.2, "maxDistance": 15.0,
                 "cullBeyondM": 15.0},
    "faune-20": {"distanceModel": "inverse", "refDistance": 3.0, "rolloffFactor": 1.2, "maxDistance": 20.0,
                 "cullBeyondM": 20.0},
    "faune-25": {"distanceModel": "inverse", "refDistance": 4.0, "rolloffFactor": 1.0, "maxDistance": 25.0,
                 "cullBeyondM": 25.0},
    # Le repère de l'autre: placé à l'épingle, jamais sous -10 dB, où qu'elle soit.
    "repere": {"distanceModel": "inverse", "refDistance": 6.0, "rolloffFactor": 0.6, "maxDistance": 80.0,
               "cullBeyondM": 100000.0, "minGainDb": -10.0},
}


@dataclass
class Son:
    id: str
    evenement: str
    dossier: str  # sous-dossier de assets/son
    bus: str  # music | effects | ui | ambience
    fabrique: Callable[[int, np.random.Generator], np.ndarray]
    variantes: int = 1
    sonie: float = -22.0  # sonie momentanée maximale visée (LUFS), intégrée pour une boucle
    priorite: int = 3  # 1 la plus haute (cahier, section 8)
    hauteur: float = 0.03  # variation de hauteur aléatoire, en fraction (0,03 = plus ou moins 3 %)
    gain_var_db: float = 1.0
    spatial: str | None = None  # clé de SPATIAL, ou None pour un son non placé
    canaux: int = 1
    duck_db: float = 0.0  # atténuation de la musique pendant le son
    intervalle_min_ms: int = 0
    voix_max: int = 4
    boucle: bool = False
    passe_haut: float = 50.0
    note: str = ""  # précision pour le document sonore et l'intégration
    graine: int = 0
    queue_reverbe: tuple[float, float] | None = None  # (rt60, humide) d'une petite pièce, appliquée au rendu
    duree_max: float = 0.0  # si non nul, la queue est raccourcie en fondu à cette durée (secondes)
    extra: dict = field(default_factory=dict)  # champs supplémentaires recopiés dans sons.json

    def fichiers(self) -> list[str]:
        if self.variantes == 1:
            return [f"{self.dossier}/{self.id}.ogg"]
        return [f"{self.dossier}/{self.id}-{k + 1}.ogg" for k in range(self.variantes)]
