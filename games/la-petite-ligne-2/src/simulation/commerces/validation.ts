/**
 * Contrôles d'un commerce que le schéma ne peut pas faire seul (appelés par `donnees/valider.ts`):
 * objets et pièces de tenue connus, coefficient sans prix de famille, besoin du jour impossible, identifiant en double
 * (la mémoire des prix range les commerces par identifiant, tous lieux confondus).
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import { WARDROBE } from '../regles/recompenses';
import { basePrice } from './prix';

export function shopProblems(content: Content, shop: ShopDef): string[] {
  const problems: string[] = [];
  const known = (item: string): boolean => item in content.items;
  for (const line of shop.sells)
    if (!known(line.item)) problems.push(`objet vendu inconnu « ${line.item} »`);
  const pieces = new Set<string>();
  for (const line of shop.pieces ?? []) {
    const piece = content.pieces[line.piece];
    if (piece === undefined) problems.push(`pièce de tenue vendue inconnue « ${line.piece} »`);
    else if (!piece.tags.includes(WARDROBE.lockedTag))
      problems.push(
        `pièce « ${line.piece} » en vente sans l'étiquette « ${WARDROBE.lockedTag} » (déjà à tous)`,
      );
    if (pieces.has(line.piece)) problems.push(`pièce vendue en double: ${line.piece}`);
    pieces.add(line.piece);
  }
  const seen = new Set<string>();
  for (const line of shop.buys) {
    const key = 'item' in line ? line.item : `famille ${line.family}`;
    if (seen.has(key)) problems.push(`rachat en double: ${key}`);
    seen.add(key);
    if (!('item' in line)) continue;
    if (!known(line.item)) problems.push(`objet racheté inconnu « ${line.item} »`);
    else if ('factor' in line && basePrice(content, shop, line.item) === null)
      problems.push(`coefficient sans prix pour la famille de « ${line.item} »`);
  }
  for (const item of shop.dailyNeeds ?? []) {
    if (!known(item)) problems.push(`besoin du jour inconnu « ${item} »`);
    else if (basePrice(content, shop, item) === null)
      problems.push(`besoin du jour « ${item} » que le commerce ne rachète pas`);
  }
  let owners = 0;
  for (const place of Object.values(content.places)) if (shop.id in place.shops) owners += 1;
  if (owners > 1)
    problems.push(`identifiant « ${shop.id} » déjà pris par un commerce d'un autre lieu`);
  return problems;
}
