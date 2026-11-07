"""Définition commune d'un son de Deux Tabliers: ce qui sert à le fabriquer et ce qu'en lira le
moteur (sons.json). Identifiants en anglais (code), descriptions en français. Conventions de
docs/jeux/cosy-cafe/son.md, section 8.5.0.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

# Écoute dans le monde (PannerNode, modèle « inverse », distances en mètres). Au-delà de
# cullBeyondM, le son n'est pas lancé; minGainDb est un plancher (signaux, repères).
SPATIAL = {
    # Placé à l'objet ou aux mains; vers un autre espace, passe par la porte (son.md, 8.3.4).
    "geste": {"distanceModel": "inverse", "refDistance": 1.0, "rolloffFactor": 1.0, "maxDistance": 12.0,
              "cullBeyondM": 12.0},
    "client": {"distanceModel": "inverse", "refDistance": 1.5, "rolloffFactor": 1.0, "maxDistance": 10.0,
               "cullBeyondM": 10.0},
    # On l'entend dans toute l'adresse, réserve et terrasse comprises.
    "signal": {"distanceModel": "inverse", "refDistance": 3.0, "rolloffFactor": 1.0, "maxDistance": 40.0,
               "cullBeyondM": 100000.0, "minGainDb": -7.0},
    "porte": {"distanceModel": "inverse", "refDistance": 2.0, "rolloffFactor": 1.0, "maxDistance": 15.0,
              "cullBeyondM": 15.0},
    "machine": {"distanceModel": "inverse", "refDistance": 1.0, "rolloffFactor": 1.0, "maxDistance": 8.0,
                "cullBeyondM": 8.0},
    "pendule": {"distanceModel": "inverse", "refDistance": 1.0, "rolloffFactor": 1.0, "maxDistance": 6.0,
                "cullBeyondM": 6.0},
    "pas": {"distanceModel": "inverse", "refDistance": 1.5, "rolloffFactor": 1.0, "maxDistance": 12.0,
            "cullBeyondM": 12.0},
    "table": {"distanceModel": "inverse", "refDistance": 1.5, "rolloffFactor": 1.0, "maxDistance": 14.0,
              "cullBeyondM": 14.0},
    "repere": {"distanceModel": "inverse", "refDistance": 4.0, "rolloffFactor": 0.8, "maxDistance": 60.0,
               "cullBeyondM": 100000.0, "minGainDb": -5.0},
    # Dehors: aux ouvertures (porte, vitrines) quand on est dedans, dans la rue sur la terrasse.
    "rue": {"distanceModel": "inverse", "refDistance": 6.0, "rolloffFactor": 0.8, "maxDistance": 80.0,
            "cullBeyondM": 100000.0},
    "vitrine": {"distanceModel": "inverse", "refDistance": 2.0, "rolloffFactor": 1.0, "maxDistance": 20.0,
                "cullBeyondM": 20.0},
}

# Fréquence de décodage prévue (son.md, 8.5.0): 24 kHz, 32 kHz pour les sons clairs.
SR_SOMBRE, SR_CLAIR = 24000, 32000


@dataclass
class Son:
    id: str
    evenement: str
    dossier: str  # sous-dossier de assets/son: aussi le groupe de décodage (son.md, 8.8.1)
    bus: str  # effects | ambience | interface | music
    fabrique: Callable[[int, np.random.Generator], np.ndarray]
    variantes: int = 1
    sonie: float = -25.0  # momentanée maximale visée (LUFS), intégrée pour une boucle
    priorite: int = 3  # 1 critique ... 4 discret (son.md, 8.5.0)
    hauteur: float = 0.03  # variation de hauteur et de durée (playbackRate), en fraction
    gain_var_db: float = 0.0
    spatial: str | None = "geste"
    canaux: int = 1
    duck_db: float = 0.0  # atténuation de la musique pendant le son
    intervalle_min_ms: int = 60
    voix_max: int = 4
    boucle: bool = False
    passe_haut: float = 60.0
    sr: int = SR_SOMBRE
    note: str = ""
    queue_reverbe: tuple[float, float] | None = None  # (rt60, humide) d'une petite pièce, au rendu
    duree_max: float = 0.0
    extra: dict = field(default_factory=dict)

    def fichiers(self) -> list[str]:
        if self.variantes == 1:
            return [f"{self.dossier}/{self.id}.ogg"]
        return [f"{self.dossier}/{self.id}-{k + 1}.ogg" for k in range(self.variantes)]
