/**
 * Réglages communs à tous les véhicules de voie (`index.ts`). Ce qui distingue un véhicule (voie,
 * places, vitesse, effort, arrêts) est dans sa fiche (`lieux/<lieu>/vehicules/<id>.json`).
 */
export const RAIL_VEHICLES = {
  /** Vitesse sous laquelle le véhicule est à l'arrêt (m/s). */
  rest: 0.02,
  /** À moins de cela d'une butée (m), il y est: il s'arrête et son sens s'inverse. */
  atEnd: 0.05,
  /** Pas d'échantillonnage de la voie pour y chercher les cases fermées (m). */
  scanStep: 0.5,
  /** Marge gardée entre un tampon et une case fermée (butée, verrou d'histoire) (m). */
  clearance: 0.5,
  /**
   * Emprise bloquante à l'arrêt: le gabarit rogné d'une demi-case de chaque côté, pour ne prendre
   * que les cases qu'il couvre à moitié au moins (sur une voie à y = 97,5: la seule rangée 97, et
   * non trois rangées pour 1,7 m de large).
   */
  cellShrink: 0.5,
  /** Pas d'échantillonnage de l'emprise (m). */
  sample: 0.25,
  /** Rentrer le véhicule: arrêté à moins de cela de son point de pose (m). */
  launchReach: 3,
  /** Où l'on pose qui descend: au-delà du gabarit et du rayon du corps (m). */
  exitGap: 0.25,
  /** Part du dernier coup dans la justesse affichée du rythme. */
  rhythmBlend: 0.5,
  /** Position arrondie à ce pas (m) dans l'empreinte des obstacles. */
  quantum: 0.25,
  /**
   * Passant sur la voie (habitant, joueur à pied): regardé jusqu'à `lookahead` devant le tampon
   * (plus que l'arrêt depuis la vitesse de pointe au freinage `endBrake` de la fiche: 12,8 m pour
   * la draisine), compté à `side` près du gabarit; le véhicule s'arrête à `gap` de lui, puis
   * repart quand la voie est libre sur `resume`, en reprenant sa vitesse à `accel` (m/s²).
   */
  yield: { lookahead: 18, side: 0.1, gap: 1.2, resume: 2, accel: 1.2 },
} as const;

export type RailVehicleSettings = typeof RAIL_VEHICLES;
