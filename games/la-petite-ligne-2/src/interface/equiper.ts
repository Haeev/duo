/**
 * Équiper un sac (objet de famille `bag`): modèle de vue pur. La simulation accepte tout sac et
 * renvoie ce qui ne tient plus au sol (`equip_bag`); l'interface, elle, prévient avant d'envoyer
 * un sac qui ne ferait que réduire la place, et le dit en clair plutôt que d'agir en silence.
 */
import type { Content } from '../donnees/charger';
import { fill, TEXTS } from './textes';

export type EquipModel =
  | { readonly kind: 'none' }
  | { readonly kind: 'ready'; readonly bag: string; readonly name: string; readonly slots: number }
  | { readonly kind: 'refused'; readonly why: 'same' | 'smaller'; readonly text: string };

/** Ce que le bouton « Équiper » fait pour l'objet de la case choisie, selon le sac déjà porté. */
export function equipModel(
  content: Content,
  itemId: string,
  currentBagId: string | null,
): EquipModel {
  const bagId = content.items[itemId]?.bag;
  if (bagId === undefined) return { kind: 'none' };
  const def = content.bags.bags.find((b) => b.id === bagId);
  if (def === undefined) return { kind: 'none' };
  if (currentBagId === def.id)
    return { kind: 'refused', why: 'same', text: TEXTS.notebook.equipSame };
  const current = content.bags.bags.find((b) => b.id === currentBagId);
  if (current !== undefined && def.slots <= current.slots)
    return {
      kind: 'refused',
      why: 'smaller',
      text: fill(TEXTS.notebook.equipSmaller, { n: current.slots, m: def.slots }),
    };
  return { kind: 'ready', bag: def.id, name: def.name, slots: def.slots };
}

/** Message de succès après `bag_changed`. */
export function equippedText(content: Content, bagId: string): string {
  const def = content.bags.bags.find((b) => b.id === bagId);
  if (def === undefined) return TEXTS.notebook.equipDoneUnknown;
  return fill(TEXTS.notebook.equipDone, { sac: def.name, n: def.slots });
}
