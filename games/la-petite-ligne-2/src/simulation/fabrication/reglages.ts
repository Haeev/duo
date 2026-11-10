/**
 * Réglages de la fabrication et de l'atelier (cahier 4.5 et 4.7), réglables par le game designer.
 * Ce qui varie d'un contenu à l'autre vit dans les plans (`donnees/commun/plans/`) et les outils.
 */
import type { TOOL_KINDS } from '../../donnees/schemas/briques';

type ToolKind = (typeof TOOL_KINDS)[number];

export interface CraftingTuning {
  /** Mémoire d'un plan: `<préfixe><plan>` = fabrications faites (0: connu, jamais fait). */
  readonly memoryPrefix: string;
  /** Commande « prête demain » d'un joueur: `<préfixe>j0` = `outil@jour` (vide: aucune). */
  readonly orderPrefix: string;
  /** Portée d'un poste au-delà de son emprise (m). */
  readonly reach: number;
  /** Les coffres à cette distance du poste (m) prêtent leurs matériaux: ceux de la maison. */
  readonly chestReach: number;
  /** Points d'un coup sans marteau en main, et sa durée (s). Le marteau donne `tool.work.power`. */
  readonly barehandPower: number;
  readonly barehandSeconds: number;
  /** Réparation payée: le prix de `tool.work.repair` au prorata de l'usure, arrondi au-dessus à ce pas. */
  readonly repairStep: number;
  /** Meule: part de l'usure rendue par tour, plafond de l'affûtage gratuit, durée d'un tour (s). */
  readonly sharpen: {
    readonly perTurn: number;
    readonly cap: number;
    readonly seconds: number;
    readonly kinds: readonly ToolKind[];
  };
}

export const CRAFTING: CraftingTuning = {
  memoryPrefix: 'fabrication.plan.',
  orderPrefix: 'fabrication.commande.',
  reach: 1.4,
  chestReach: 8,
  barehandPower: 4,
  barehandSeconds: 1,
  repairStep: 10,
  sharpen: { perTurn: 0.125, cap: 0.5, seconds: 1, kinds: ['axe', 'spade'] },
};
