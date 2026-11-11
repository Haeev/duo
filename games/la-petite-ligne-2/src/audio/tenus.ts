/**
 * Sons réglés par le monde, logique pure (testée dans Node): l'allure d'un son tenu selon une
 * valeur (`HeldDef`: le roulement selon la vitesse), et les joints de rail que passe chaque essieu
 * d'un véhicule de voie (`JointTracker`). Le moteur (`moteur.ts`) ne fait que jouer ce qu'ils disent.
 */
import type { ReadonlyWorld } from '../etat/monde';
import type { HeldDef, JointsDef } from './schemas';

/** L'allure à jouer pour cette valeur: le son et sa vitesse de lecture; `null` sous le premier seuil. */
export function heldPick(def: HeldDef, value: number): { sound: string; rate: number } | null {
  let at = -1;
  for (let i = 0; i < def.steps.length; i++) if (value >= (def.steps[i]?.from ?? Infinity)) at = i;
  const step = def.steps[at];
  if (step === undefined) return null;
  const next = def.steps[at + 1]?.from ?? def.top;
  const share =
    next > step.from ? Math.min(1, Math.max(0, (value - step.from) / (next - step.from))) : 1;
  return { sound: step.sound, rate: def.rate[0] + (def.rate[1] - def.rate[0]) * share };
}

/** La plus grande vitesse des véhicules de voie sortis du lieu courant (m/s). */
function fastestVehicle(world: ReadonlyWorld): number {
  const vehicles = world.places[world.common.place]?.vehicles;
  let top = 0;
  for (const id in vehicles) {
    const state = vehicles[id];
    if (state?.out === true) top = Math.max(top, state.speed);
  }
  return top;
}

const SOURCES: Readonly<Record<HeldDef['source'], (world: ReadonlyWorld) => number>> = {
  'vehicle.speed': fastestVehicle,
};

/** Valeur du monde que lit un son tenu (`HeldDef.source`), dans le lieu courant. */
export function heldValue(world: ReadonlyWorld, source: HeldDef['source']): number {
  return SOURCES[source](world);
}

/** Un essieu vient de passer un joint. */
export interface JointHit {
  readonly type: string;
  readonly vehicle: string;
  readonly axle: number;
}

/**
 * Compte le chemin de chaque véhicule de voie sorti du lieu courant (sa vitesse fois le temps de
 * l'image: régulier chez l'invité aussi, qui reçoit l'état cinq fois par seconde) et dit quels
 * essieux passent un joint. Un véhicule rangé ou trop lent repart de zéro.
 */
export class JointTracker {
  private readonly walked = new Map<string, number>();

  constructor(private readonly def: JointsDef) {}

  /** Les joints passés pendant cette image (au plus un par essieu). */
  update(world: ReadonlyWorld, dt: number, out: JointHit[]): void {
    out.length = 0;
    const vehicles = world.places[world.common.place]?.vehicles;
    for (const id of this.walked.keys()) if (vehicles?.[id]?.out !== true) this.walked.delete(id);
    for (const id in vehicles) {
      const state = vehicles[id];
      if (state?.out !== true || state.speed < this.def.minSpeed) {
        this.walked.delete(id);
        continue;
      }
      const from = this.walked.get(id) ?? 0;
      const to = from + state.speed * dt;
      this.walked.set(id, to);
      const every = this.def.everyMeters;
      for (let axle = 0; axle < this.def.axles.length; axle++) {
        const offset = this.def.axles[axle] ?? 0;
        if (Math.floor((to - offset) / every) > Math.floor((from - offset) / every))
          out.push({ type: this.def.event, vehicle: id, axle });
      }
    }
  }

  reset(): void {
    this.walked.clear();
  }
}
