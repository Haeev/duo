// Domaine « installation » de l'état partagé (démo v0.3): le départ dans une cellule vide.
// `null` pour une maison déjà ouverte (départ équipé, sauvegardes v0.2: IN-15). Petit et envoyé à
// l'invité quand il change (canal 8): les durées se comptent en secondes entières (`sec`), les
// maintiens par pas de 0,1 s, pour que le domaine ne reparte pas à chaque image.
import { v } from '@duo/sdk';
// Pas d'import de etat/monde.ts: il importe ce fichier (cycle à l'initialisation).
const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const N = v.pipe(v.number(), v.minValue(0));

/** Un geste à maintien en cours sur un point de l'installation. */
const HoldSchema = v.strictObject({ spot: v.string(), elapsed: N });
export type InstallHold = v.InferOutput<typeof HoldSchema>;

export const InstallationStateSchema = v.strictObject({
  /**
   * `setup`: le lundi de l'installation; `bigday`: le premier jour ouvert, avant la pancarte;
   * `opened`: la pancarte est retournée une première fois (le guide du service prend le relais).
   */
  stage: v.picklist(['setup', 'bigday', 'opened']),
  /** Secondes réelles écoulées depuis l'arrivée (livraisons, chauffe); arrêtées en pause. */
  sec: Nat,
  shutter: v.picklist(['down', 'up']),
  /** Maintien commun du rideau (s, par pas de 0,1). */
  together: N,
  mail: v.boolean(),
  /** Draps encore posés, taches de poussière restantes, vitres encore blanchies. */
  sheets: v.array(v.string()),
  dust: v.array(v.string()),
  panes: v.array(v.string()),
  /** Outil tenu par chaque joueur (balai, éponge), ou rien. */
  tools: v.tuple([v.nullable(v.string()), v.nullable(v.string())]),
  /** Lots de Simone: à elle, à nous (chaises encore retournées), ou installés (chaises en bas). */
  lots: v.record(v.string(), v.picklist(['simone', 'ours', 'down'])),
  machine: v.strictObject({
    /** Achat de la machine choisie (`machine-vieille-dame`, `machine-revisee`), ou aucune. */
    model: v.nullable(v.string()),
    connected: v.boolean(),
    /** Seconde (`sec`) où la chauffe finit, `null` avant le raccord. */
    heatEnd: v.nullable(Nat),
    ready: v.boolean(),
    tested: v.boolean(),
  }),
  /** Achats en route avec Gaby: achat, seconde d'arrivée. */
  deliveries: v.array(v.tuple([v.string(), Nat])),
  /** Achats déjà pris en charge (livrés, en route ou en place). */
  handled: v.array(v.string()),
  /** Cartons de l'installation encore fermés: meuble posé (carton), achat. */
  cartons: v.array(v.tuple([v.string(), v.string()])),
  holds: v.tuple([v.nullable(HoldSchema), v.nullable(HoldSchema)]),
  /** Répliques de Simone déjà dites (une seule fois chacune). */
  said: v.array(v.string()),
  /** Dépenses de l'installation (centimes), pour la ligne du bilan du lundi. */
  spent: Nat,
  /** Dernier jour vu (nuit: cartons rentrés, rideaux baissés pour le grand jour). */
  lastDay: Nat,
  /** Seconde du dernier achat ou geste (réplique « le minimum » au bout de 40 s). */
  lastActSec: Nat,
});
export type InstallationState = v.InferOutput<typeof InstallationStateSchema>;

export function createInstallationState(
  sheets: readonly string[],
  dust: readonly string[],
  panes: readonly string[],
  lots: readonly string[],
): InstallationState {
  return {
    stage: 'setup',
    sec: 0,
    shutter: 'down',
    together: 0,
    mail: false,
    sheets: [...sheets],
    dust: [...dust],
    panes: [...panes],
    tools: [null, null],
    lots: Object.fromEntries(lots.map((id) => [id, 'simone' as const])),
    machine: { model: null, connected: false, heatEnd: null, ready: false, tested: false },
    deliveries: [],
    handled: [],
    cartons: [],
    holds: [null, null],
    said: [],
    spent: 0,
    lastDay: 0,
    lastActSec: 0,
  };
}
