/**
 * Tirage de la commande d'une semaine: pur, de la graine de la partie, du lieu et du jour de
 * livraison. L'hôte seul tire (l'invité n'a pas la graine) et écrit le résultat en faits; l'invité
 * lit ces faits (`lecture.ts`): les deux voient la même commande.
 */
import type { OrderContent } from '../../donnees/charger';
import type { OrderLineDef } from '../../donnees/schemas/commande';
import { placeKey, unitHash } from '../monde/meteo';
import { ORDERS } from './reglages';

const S = ORDERS.salts;

export interface DrawnLine {
  readonly id: string;
  readonly item: string;
  readonly asked: number;
}

function pick(roll: number, n: number): number {
  return Math.min(n - 1, Math.floor(roll * n));
}

/**
 * Les lignes nouvelles de la commande due le jour `due`. `eligible`: les lignes que le duo sait
 * produire (objet déjà obtenu, conditions vraies); `carried`: le nombre de lignes reportées de la
 * semaine passée, qui comptent dans la taille de la commande. Une table à la fois, chaque table
 * une fois avant qu'une autre ne revienne: la commande mêle les métiers. Jamais deux lignes du même
 * objet, ni une ligne déjà reportée (`taken`).
 */
export function drawOrder(
  orders: OrderContent,
  seed: number,
  place: string,
  due: number,
  eligible: (line: OrderLineDef) => boolean,
  carried: number,
  taken: ReadonlySet<string>,
): DrawnLine[] {
  const where = placeKey(place);
  const { min, max } = orders.desk.lines;
  const size = min + pick(unitHash(seed, where, due, 0, S.size), max - min + 1);
  const wanted = Math.max(0, size - carried);
  // Les tables qui ont une ligne possible, dans un ordre propre à la semaine.
  const items = new Set<string>();
  for (const table of orders.tables)
    for (const line of table.lines) if (taken.has(line.id)) items.add(line.item);
  const pools = orders.tables
    .map((table, t) => ({
      key: unitHash(seed, where, due, t, S.table),
      lines: table.lines.filter((line) => !taken.has(line.id) && eligible(line)),
    }))
    .filter((pool) => pool.lines.length > 0)
    .sort((a, b) => a.key - b.key);
  const out: DrawnLine[] = [];
  let round = 0;
  while (out.length < wanted && pools.some((p) => p.lines.length > 0)) {
    for (const pool of pools) {
      if (out.length >= wanted) break;
      const choices = pool.lines.filter((line) => !items.has(line.item));
      if (choices.length === 0) {
        pool.lines = [];
        continue;
      }
      const roll = unitHash(seed, where, due, out.length + 31 * round, S.line);
      const line = choices[pick(roll, choices.length)];
      if (line === undefined) continue;
      pool.lines = pool.lines.filter((l) => l !== line);
      items.add(line.item);
      const span = line.count.max - line.count.min + 1;
      const asked = line.count.min + pick(unitHash(seed, where, due, out.length, S.count), span);
      out.push({ id: line.id, item: line.item, asked });
    }
    round++;
  }
  return out;
}
