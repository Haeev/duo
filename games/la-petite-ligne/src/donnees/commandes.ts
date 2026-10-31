/**
 * La commande en cours et la fenêtre du catalogue du moment, lues par la
 * simulation et par l'interface (une commande par train, une fenêtre par semaine).
 */
import type { CatalogueWindow, OrderDef, Settings } from './types';

/** La commande que la caisse prépare (`orderIndex` du monde; la dernière au-delà). */
export function currentOrder(settings: Settings, world: { readonly orderIndex: number }): OrderDef {
  const list = settings.order.trains;
  const order = list[Math.min(Math.max(0, world.orderIndex), list.length - 1)];
  if (order === undefined) throw new Error('reglages.json: aucune commande');
  return order;
}

/** En vente ce jour-là (`availableFromDay`). */
export function onSale(def: { readonly availableFromDay: number | null }, day: number): boolean {
  return def.availableFromDay === null || day >= def.availableFromDay;
}

/** Fenêtre du catalogue de ce jour: la première dont la livraison n'est pas passée (la dernière ensuite). */
export function catalogueWindow(settings: Settings, day: number): CatalogueWindow {
  const list = settings.economy.catalogue.windows;
  const found = list.find((w) => w.delivery.day >= day) ?? list[list.length - 1];
  if (found === undefined) throw new Error('reglages.json: aucune fenêtre de catalogue');
  return found;
}
