/**
 * Réglages des habitants, typés et réunis pour le game designer. Ils migreront dans
 * `donnees/commun/reglages.json` quand le lot L0 aura ajouté la section, sans changer le système.
 */

export interface VillagerSettings {
  /** Marche humaine (m/s): plus lente que celle des joueurs, qui vont à l'allure d'un jeu. */
  readonly walkSpeed: number;
  /** Rayon du corps (m) pour la grille et l'évitement. */
  readonly radius: number;
  /** Distance (m) où l'habitant ralentit et s'écarte devant quelqu'un. */
  readonly avoidRadius: number;
  /** Écart de côté (m/s) quand quelqu'un est devant lui. */
  readonly sidestep: number;
  /** Attente (s) devant quelqu'un qui ne bouge pas, avant de passer quand même. */
  readonly maxWaitSeconds: number;
  /** Écart (m) entre le corps et la façade d'un meuble où il travaille. */
  readonly objectGap: number;
  /** Au-delà de cette distance (m) des deux joueurs, il vit à basse fréquence. */
  readonly nearRadius: number;
  /** Basse fréquence: un pas de vie tous les `farEveryTicks` pas de simulation. */
  readonly farEveryTicks: number;
  /** Relecture du planning (pas). */
  readonly planEveryTicks: number;
  /** Il se tourne vers un joueur à moins de cette distance (m). */
  readonly noticeRadius: number;
  /** Vitesse à laquelle il se tourne (rad/s). */
  readonly turnSpeed: number;
  /** Premier bonjour du jour, à moins de cette distance (m). */
  readonly greetRadius: number;
  /** Réaction à un acte, à moins de cette distance (m), au plus une fois par `reactCooldown` secondes. */
  readonly reactRadius: number;
  readonly reactCooldown: number;
  /** Durée d'une onomatopée (s). */
  readonly emoteSeconds: number;
  /** Un joueur court au-delà de cette vitesse (m/s). */
  readonly runSpeed: number;
  /** États d'hygiène qui lui font faire la grimace. */
  readonly dirtyTiers: readonly string[];
  /** Portée (m) pour offrir un cadeau. */
  readonly giftReach: number;
  /** Points d'amitié d'un cadeau (cahier 4.9) et onomatopée selon ses goûts. */
  readonly gift: Readonly<
    Record<'loved' | 'liked' | 'neutral' | 'disliked', { points: number; emote: string }>
  >;
  /** Priorité de dialogue à partir de laquelle la bulle « a quelque chose pour toi » s'affiche. */
  readonly bubblePriority: number;
  /** Où attend un habitant absent: hors de la carte, jamais visable. */
  readonly offstage: { readonly x: number; readonly y: number };
  /** Heure (minutes) où le validateur exige qu'il soit chez lui. */
  readonly homeCheckMinute: number;
  /**
   * Point d'arrivée des joueurs dégagé (défaut D3): aucun poste à moins de ce rayon (m) du point
   * où descendent les joueurs; un poste trop proche est repoussé sur ce cercle.
   */
  readonly arrivalClearance: number;
  /** Places essayées sur ce cercle (la première libre l'emporte). */
  readonly arrivalClearanceSteps: number;
  /** Plus loin que ceci (m) de son poste, sans trajet (mené par une scène, poussé), il y retourne. */
  readonly returnDistance: number;
  /**
   * Arrêté au bord de la voie par un train (à quai, qui arrive ou qui repart): au bout de ce
   * temps (s), il cherche un autre chemin (un autre passage); sinon il attend que la voie se libère.
   */
  readonly trainRetrySeconds: number;
}

export const VILLAGERS: VillagerSettings = {
  walkSpeed: 1.4,
  radius: 0.3,
  avoidRadius: 0.9,
  sidestep: 0.8,
  maxWaitSeconds: 1.5,
  objectGap: 0.1,
  nearRadius: 28,
  farEveryTicks: 15,
  planEveryTicks: 30,
  noticeRadius: 3,
  turnSpeed: 6,
  greetRadius: 2.5,
  reactRadius: 4,
  reactCooldown: 20,
  emoteSeconds: 2,
  runSpeed: 2.2,
  dirtyTiers: ['blocked', 'low'],
  giftReach: 1.8,
  gift: {
    loved: { points: 30, emote: 'heart' },
    liked: { points: 15, emote: 'joy' },
    neutral: { points: 0, emote: 'smile' },
    disliked: { points: 0, emote: 'frown' },
  },
  bubblePriority: 10,
  offstage: { x: -50, y: -50 },
  homeCheckMinute: 180,
  arrivalClearance: 2.2,
  arrivalClearanceSteps: 12,
  returnDistance: 0.5,
  trainRetrySeconds: 4,
};
