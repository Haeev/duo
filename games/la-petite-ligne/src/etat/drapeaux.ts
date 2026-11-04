/**
 * Ce que les drapeaux de quête changent dans le monde, en lecture seule et sans simulation: la
 * simulation (qui réserve les places, bloque les cases) et le rendu (qui dessine) calculent ainsi
 * la même chose à partir de `world.flags`, chez l'hôte comme chez l'invité.
 */
import type { FlagEffects } from '../donnees/effets-drapeaux';
import type { SeatProp } from './bancs';

/** Catégorie des chaises que rend utilisables un drapeau (ni la carte, ni un chantier, ni la maison). */
export const FLAG_SEAT_CATEGORY = 'flag_seat';

/** Chantiers de la carte levés par un drapeau (le banc d'Hortense), dans l'ordre des réglages. */
export function flaggedWorks(effects: FlagEffects, flags: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of effects.works) if (flags.includes(w.flag) && !out.includes(w.improvement)) out.push(w.improvement);
  return out;
}

const seatCache = new WeakMap<FlagEffects, Map<string, readonly SeatProp[]>>();
const NO_SEATS: readonly SeatProp[] = [];

/** Les chaises utilisables (une place chacune), mêmes objets d'une image à l'autre tant que les drapeaux ne changent pas. */
export function flagSeats(effects: FlagEffects, flags: readonly string[]): readonly SeatProp[] {
  if (effects.chairs.length === 0) return NO_SEATS;
  const active = effects.chairs.filter((c) => flags.includes(c.flag));
  if (active.length === 0) return NO_SEATS;
  const key = active.map((c) => c.flag).join(',');
  let cache = seatCache.get(effects);
  if (cache === undefined) {
    cache = new Map();
    seatCache.set(effects, cache);
  }
  let list = cache.get(key);
  if (list === undefined) {
    list = active.flatMap((c) =>
      c.seats.map(
        (s): SeatProp => ({
          id: s.id,
          model: 'chair',
          pos: { x: s.x, y: s.y },
          rotation: s.rotation,
          rect: null,
          height: 0,
          category: FLAG_SEAT_CATEGORY,
          slots: [0],
        }),
      ),
    );
    cache.set(key, list);
  }
  return list;
}

/** Ce chantier est-il bâti par un drapeau (sans passer par le tableau du quai) ? */
export function isBuiltByFlag(effects: FlagEffects, flags: readonly string[], id: string): boolean {
  return effects.works.some((w) => w.improvement === id && flags.includes(w.flag));
}
