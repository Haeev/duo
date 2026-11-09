/**
 * Pont vers l'économie (chantier b, clientèle): l'aménagement ne tient ni la caisse ni les paliers.
 * La clientèle branche son pont une fois, au chargement de son module:
 *
 *   import { connectArrangementEconomy } from '../amenagement';
 *   connectArrangementEconomy({ available, spend, tierOpen, serviceOpen, ... });
 *
 * Sans pont branché (démo de cette nuit), le pont par défaut ouvre les paliers à leur jour
 * (`orDay`, comptés sur `world.clientele.day`), ne compte pas l'argent et tient le café fermé.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { SimContext } from '../simulation/systemes';
import type { CatalogItem } from './donnees';

export interface ArrangementEconomy {
  /** Ce qu'on peut dépenser maintenant (caisse moins la réserve de charges, EC et démo 6.1). */
  available(world: World, content: Content): number;
  /** Débite un achat déjà permis par `available` (`what`: article ou extension, pour le bilan). */
  spend(sim: SimContext, amount: number, what: string, player: PlayerIndex): void;
  /** Le palier est ouvert (réputation ou jour, le premier des deux, démo D-04). */
  tierOpen(world: World, content: Content, tier: string): boolean;
  /** Le café est ouvert au public: pas d'aménagement (ux 6.1). */
  serviceOpen(world: World): boolean;
  /** L'achat demande l'accord de l'autre (DE-10, EC-05). */
  needsAgreement(world: World, content: Content, amount: number): boolean;
  /** Remise du moment sur un article, de 0 à 1 (marché aux fleurs: plantes à -20 %). */
  discount?(world: World, item: CatalogItem): number;
  /** Un client occupe ce meuble (assis, objet à lui dessus): il ne bouge pas (DE-01). */
  occupied?(world: World, furniture: string): boolean;
}

export const DEFAULT_ECONOMY: ArrangementEconomy = {
  available: () => Number.POSITIVE_INFINITY,
  spend: () => undefined,
  tierOpen: (world, content, tier) => {
    const t = content.arrangement.tiers.find((x) => x.id === tier);
    return t !== undefined && world.clientele.day >= t.orDay;
  },
  serviceOpen: () => false,
  needsAgreement: (_world, content, amount) => amount >= content.arrangement.rules.bigPurchase,
};

let bridge: ArrangementEconomy = DEFAULT_ECONOMY;

/** Branche l'économie de la clientèle (une fois, sur les deux machines). */
export function connectArrangementEconomy(next: ArrangementEconomy): void {
  bridge = next;
}

export function economy(): ArrangementEconomy {
  return bridge;
}
