/**
 * La commande en cours et la fenêtre du catalogue du moment, lues par la
 * simulation et par l'interface (une commande par train, une fenêtre par semaine).
 */
import { weekdayOf } from './calendrier';
import type { CatalogueWindow, OrderDef, Settings } from './types';

/** Ce que `currentOrder` lit du monde (le monde complet, ou un monde de test réduit à `orderIndex`). */
export interface OrderWorld {
  readonly orderIndex: number;
  readonly order?: {
    readonly generated: {
      readonly train: number;
      readonly lines: readonly { readonly item: string; readonly count: number }[];
    } | null;
  };
}

/**
 * La commande que la caisse prépare: la commande écrite d'index `orderIndex`, puis, une fois les
 * commandes écrites passées (`orderIndex` égal à leur nombre), la commande générée (tour 8).
 */
export function currentOrder(settings: Settings, world: OrderWorld): OrderDef {
  const list = settings.order.trains;
  const last = list[list.length - 1];
  if (last === undefined) throw new Error('reglages.json: aucune commande');
  const generated = world.order?.generated ?? null;
  if (world.orderIndex >= list.length && generated !== null) {
    return {
      day: generated.train,
      lines: generated.lines.map((l) => ({ item: l.item, count: l.count })),
      linePremium: last.linePremium,
      fullBonus: last.fullBonus,
    };
  }
  return list[Math.min(Math.max(0, world.orderIndex), list.length - 1)] ?? last;
}

/** La commande en cours est-elle générée (et non écrite) ? */
export function isGeneratedOrder(settings: Settings, world: OrderWorld): boolean {
  return (
    world.orderIndex >= settings.order.trains.length && (world.order?.generated ?? null) !== null
  );
}

/** En vente ce jour-là (`availableFromDay`). */
export function onSale(def: { readonly availableFromDay: number | null }, day: number): boolean {
  return def.availableFromDay === null || day >= def.availableFromDay;
}

/**
 * Fenêtre du catalogue de ce jour: la première dont la livraison n'est pas passée; après les
 * fenêtres écrites, une par semaine (`repeatWeekly`: commande jusqu'au vendredi à minuit,
 * livraison le samedi), sinon la dernière écrite.
 */
export function catalogueWindow(settings: Settings, day: number): CatalogueWindow {
  const list = settings.economy.catalogue.windows;
  const found = list.find((w) => w.delivery.day >= day);
  if (found !== undefined) return found;
  const weekly = settings.economy.catalogue.repeatWeekly;
  if (weekly !== null) {
    // Le jour de livraison suit l'échéance (minuit passé), le même jour sinon.
    const lag = weekly.deadlineTime >= 24 * 60 ? 1 : 0;
    const deliveryWeekday = (weekly.deadlineWeekday + lag) % 7;
    const delivery = day + ((deliveryWeekday - weekdayOf(day) + 7) % 7);
    return {
      orderDeadline: { day: delivery - lag, time: weekly.deadlineTime },
      delivery: { day: delivery, time: weekly.deliveryTime },
    };
  }
  const last = list[list.length - 1];
  if (last === undefined) throw new Error('reglages.json: aucune fenêtre de catalogue');
  return last;
}
