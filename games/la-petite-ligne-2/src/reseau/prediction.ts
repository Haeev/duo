/**
 * Prédiction locale chez l'invité (ADR 0007 et 0020): son déplacement et le début de ses gestes
 * répondent au pas même de l'appui; l'hôte confirme ou corrige.
 *
 * La simulation (lot L2) fournit `Predictor`: des fonctions pures qui ne lisent que l'état connu
 * de l'invité, et que l'hôte appelle aussi dans son pas (mêmes résultats des deux côtés).
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { Body } from '../etat/joueur';
import type { ReadonlyWorld } from '../etat/monde';
import type { Intent, StepInput } from '../simulation/noyau/entrees';
import { SIM_DT } from '../simulation/noyau/constantes';
import type { NetSettings } from './reglages';

/** Début de geste prédit: ce que l'invité joue tout de suite (animation, son, rebond de la cible). */
export interface PredictedGesture {
  readonly clip: string;
  readonly target: string | null;
  /** Durée du geste, en pas (d'après les données). */
  readonly ticks: number;
  readonly long: boolean;
}

/** Contrat que la simulation (lot L2) fournit au réseau. */
export interface Predictor {
  /** Le joueur marche librement: ni geste en cours, ni dialogue, ni voyage, ni assis. */
  canWalk(world: ReadonlyWorld, player: PlayerIndex): boolean;
  /**
   * Un pas de déplacement sous une commande: écrit `body` (position, cap, vitesse du pas).
   * Même fonction que le pas de l'hôte, collisions comprises, sans aléa.
   */
  walk(world: ReadonlyWorld, player: PlayerIndex, body: Body, input: StepInput): void;
  /** Le geste que l'hôte lancera pour cette intention, `null` si aucun (pas de cible, refus sûr). */
  gesture(world: ReadonlyWorld, player: PlayerIndex, intent: Intent): PredictedGesture | null;
}

/** Sans simulation branchée: rien ne se prédit, l'invité suit l'hôte (comportement du socle). */
export const NO_PREDICTION: Predictor = {
  canWalk: () => false,
  walk: () => undefined,
  gesture: () => null,
};

/** Fabrique d'un `Predictor` à partir du contenu (ce que L2 exporte). */
export type PredictorFactory = (content: Content) => Predictor;

export interface Vec {
  x: number;
  y: number;
}

/**
 * Déplacement prédit et sa réconciliation. Règles reprises de la 0.13: on rejoue les commandes
 * non accusées depuis la position de l'hôte; avant et après se décalent du même écart (l'image ne
 * saute pas), la correction se résorbe ensuite en douceur, jamais plus vite que 30 % de la vitesse
 * en marche, d'où ni à-coup ni recul visible.
 */
export interface WalkPrediction {
  /** Un pas local. `world`: l'état connu (avec le geste prédit). Renvoie vrai si la prédiction est active. */
  step(world: ReadonlyWorld, input: StepInput): boolean;
  /** Instantané de l'hôte: position du joueur local à l'accusé `ack`. */
  reconcile(world: ReadonlyWorld, authority: Body, ack: number): void;
  /** Position à afficher: entre les deux derniers pas (`alpha`), plus la correction. */
  render(dtSeconds: number, alpha: number, out: Body): boolean;
  active(): boolean;
  /** Changement de lieu, reprise: plus de prédiction jusqu'au prochain départ. */
  reset(): void;
  /** Commandes envoyées et pas encore accusées (mesures). */
  pending(): number;
}

export function createWalkPrediction(
  predictor: Predictor,
  local: () => PlayerIndex | null,
  settings: NetSettings['prediction'],
  deadzone: number,
): WalkPrediction {
  /** Commandes non accusées, et si la prédiction les a marchées (l'hôte fait de même). */
  const frames: { input: StepInput; walked: boolean }[] = [];
  let body: Body | null = null;
  const prev: Vec = { x: 0, y: 0 };
  const correction: Vec = { x: 0, y: 0 };
  let stepSpeed = 0;
  /** Plus grande vitesse de pas vue: borne de la résorption en marche. */
  let walkSpeed = 0;

  function moving(input: StepInput): boolean {
    return Math.hypot(input.moveX, input.moveY) >= deadzone;
  }

  return {
    step(world, input) {
      const me = local();
      // Geste, dialogue, voyage: le pas ne marche pas, mais la prédiction garde sa place (un arrêt
      // brutal la ramènerait sur la position de l'hôte, en retard d'un aller-retour: recul visible).
      const walks = me !== null && predictor.canWalk(world, me) && (body !== null || moving(input));
      frames.push({ input, walked: walks });
      if (!walks) {
        if (body !== null) {
          prev.x = body.x;
          prev.y = body.y;
          stepSpeed = 0;
        }
        return body !== null;
      }
      if (body === null) {
        // On part de la dernière position connue de l'hôte: aucun reste d'une correction passée.
        const from = world.players[me].body;
        body = { x: from.x, y: from.y, facing: from.facing, speed: 0 };
        correction.x = 0;
        correction.y = 0;
      }
      prev.x = body.x;
      prev.y = body.y;
      predictor.walk(world, me, body, input);
      stepSpeed = Math.hypot(body.x - prev.x, body.y - prev.y) / SIM_DT;
      walkSpeed = Math.max(walkSpeed, stepSpeed);
      return true;
    },
    reconcile(world, authority, ack) {
      while ((frames[0]?.input.seq ?? Number.POSITIVE_INFINITY) <= ack) frames.shift();
      const me = local();
      if (body === null || me === null) return;
      const next: Body = { ...authority };
      for (const frame of frames) if (frame.walked) predictor.walk(world, me, next, frame.input);
      const shiftX = next.x - body.x;
      const shiftY = next.y - body.y;
      prev.x += shiftX;
      prev.y += shiftY;
      correction.x -= shiftX;
      correction.y -= shiftY;
      if (Math.hypot(correction.x, correction.y) > settings.snapDistance) {
        correction.x = 0;
        correction.y = 0;
      }
      body.x = next.x;
      body.y = next.y;
      // Plus aucun pas en attente: le cap de l'hôte fait foi (il tourne le personnage sans marcher).
      body.facing = frames.some((f) => f.walked && moving(f.input))
        ? next.facing
        : authority.facing;
    },
    render(dtSeconds, alpha, out) {
      if (body === null) return false;
      const length = Math.hypot(correction.x, correction.y);
      if (length > 0) {
        let absorbed = length * (1 - Math.exp(-settings.correctionDecay * dtSeconds));
        if (stepSpeed > 0)
          absorbed = Math.min(absorbed, settings.correctionWalkShare * walkSpeed * dtSeconds);
        const keep = 1 - absorbed / length;
        correction.x *= keep;
        correction.y *= keep;
      }
      const t = Math.max(0, Math.min(1, alpha));
      out.x = prev.x + (body.x - prev.x) * t + correction.x;
      out.y = prev.y + (body.y - prev.y) * t + correction.y;
      out.facing = body.facing;
      // Vitesse du pas, pas de l'image: à 60 images pour 30 pas, elle vaudrait 0 une image sur deux.
      out.speed = stepSpeed;
      return true;
    },
    active() {
      return body !== null;
    },
    reset() {
      frames.length = 0;
      body = null;
      correction.x = 0;
      correction.y = 0;
      stepSpeed = 0;
    },
    pending() {
      return frames.length;
    },
  };
}
