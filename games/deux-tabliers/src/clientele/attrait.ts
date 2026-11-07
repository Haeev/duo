/**
 * Attrait de l'ardoise et flux de clients (cahier AT-01 à AT-07), fonctions pures reproduites de
 * `simulations/cosy_cafe.py` (`points_carte`, `facteur_*`, `passants_heure`, `choisir_carte`,
 * `commande_groupe`, `tirer_meteo`, `poisson`), avec les valeurs de `donnees/clientele/`.
 */
import type { RandomSource } from '@duo/sdk';
import type { ClienteleContent, Profile, Recipe } from './donnees';

export interface Attraction {
  readonly slate: readonly (readonly [string, number])[];
  /** Pas de prix: chaque pas vaut ce `step` (0,1) du prix conseillé. */
  readonly ambiance: number;
  readonly style: string;
  readonly coherence: number;
  readonly equipment: readonly string[];
  readonly cups: number;
  readonly satYesterday: number;
  readonly affluence: number;
}

export function familiesOf(
  cc: ClienteleContent,
  slate: readonly (readonly [string, number])[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id] of slate) {
    const r = cc.recipes.get(id);
    if (r !== undefined) out.set(r.family, (out.get(r.family) ?? 0) + 1);
  }
  return out;
}

export function slatePoints(
  cc: ClienteleContent,
  p: Profile,
  families: ReadonlyMap<string, number>,
): number {
  const sp = cc.rules.slatePoints;
  let pts = 0;
  const main = families.get(p.mainCraving) ?? 0;
  if (main > 0) {
    pts += sp.main;
    if (main >= sp.varietyCount) pts += sp.variety;
  }
  for (const s of p.secondaryCravings) if ((families.get(s) ?? 0) > 0) pts += sp.secondary;
  return pts;
}

export function slateFactor(cc: ClienteleContent, points: number): number {
  const f = cc.rules.slateFactors;
  return f[Math.min(points, f.length - 1)] ?? 0;
}

/** Indice de prix: prix moyen des lignes qui attirent le profil, rapporté au prix conseillé. */
export function priceIndex(cc: ClienteleContent, p: Profile, slate: Attraction['slate']): number {
  const step = cc.economy.priceSteps.step;
  let sum = 0;
  let n = 0;
  for (const [id, s] of slate) {
    const r = cc.recipes.get(id);
    if (r === undefined) continue;
    if (r.family !== p.mainCraving && !p.secondaryCravings.includes(r.family)) continue;
    sum += 1 + s * step;
    n++;
  }
  return n === 0 ? 1 : sum / n;
}

export function priceFactor(cc: ClienteleContent, p: Profile, index: number): number {
  const [lo, hi] = cc.rules.priceBounds;
  return Math.max(lo, Math.min(hi, 1 - p.priceSensitivity * (index - 1)));
}

export function placeFactor(cc: ClienteleContent, p: Profile, a: Attraction): number {
  const r = cc.rules.place;
  let f = r.base + (r.ambiance * a.ambiance) / 100;
  if (p.styles.includes(a.style)) {
    if (a.coherence >= 0.75) f += r.style75;
    else if (a.coherence >= 0.5) f += r.style50;
  }
  const n = p.wantedEquipment.filter((e) => a.equipment.includes(e)).length;
  return f + r.equipment * Math.min(n, r.equipmentMax);
}

export function cupsFactor(cc: ClienteleContent, cups: number): number {
  const t = Math.max(1, Math.min(5, Math.floor(cups * 2) / 2));
  let best = 1;
  for (const [c, f] of cc.rules.cupFactors) if (Math.abs(c - t) < 1e-9) best = f;
  return best;
}

export function moodFactor(cc: ClienteleContent, satYesterday: number): number {
  const m = cc.rules.mood;
  return 1 + Math.max(-m.bound, Math.min(m.bound, (satYesterday - m.pivot) * m.slope));
}

export function attraction(cc: ClienteleContent, p: Profile, a: Attraction): number {
  const fam = familiesOf(cc, a.slate);
  return (
    slateFactor(cc, slatePoints(cc, p, fam)) *
    priceFactor(cc, p, priceIndex(cc, p, a.slate)) *
    placeFactor(cc, p, a) *
    cupsFactor(cc, a.cups) *
    moodFactor(cc, a.satYesterday) *
    a.affluence
  );
}

/**
 * Passants intéressés d'un profil, par heure d'ouverture (`weekdayIndex`: 1 mardi ... 6 dimanche).
 * Les heures sont celles de `journees.json` (8 h à 18 h au village).
 */
export function passersPerHour(
  cc: ClienteleContent,
  p: Profile,
  weekdayIndex: number,
  weather: string,
  extra: number,
): number[] {
  const open = cc.days.open / 60;
  const close = cc.days.close / 60;
  const hours: [number, number][] = [];
  for (let h = open; h < close - 1e-9; h += 1) hours.push([h, Math.min(1, close - h)]);
  if (p.groupsPerDay <= 0) return hours.map(() => 0);
  const weights = new Map(p.hourWeights.map(([h, w]) => [h, w]));
  const w = hours.map(([h, d]) => (weights.get(Math.floor(h)) ?? 0) * d);
  const total = w.reduce((s, x) => s + x, 0);
  if (total <= 0) return w.map(() => 0);
  const day = p.dayFactors[weekdayIndex - 1] ?? 1;
  const met = p.weatherFactors[weather] ?? 1;
  return w.map((x) => ((p.groupsPerDay * x) / total) * day * met * p.seasonFactor * extra);
}

export function poisson(random: RandomSource, lam: number): number {
  if (lam <= 0) return 0;
  if (lam > 30) {
    // Approximation normale (Box-Muller), comme `rng.gauss` de la simulation.
    const u = Math.max(1e-12, random.next());
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random.next());
    return Math.max(0, Math.round(lam + g * Math.sqrt(lam)));
  }
  const l = Math.exp(-lam);
  let k = 0;
  let prod = 1;
  for (;;) {
    prod *= random.next();
    if (prod <= l) return k;
    k++;
  }
}

export function drawGroupSize(random: RandomSource, p: Profile): number {
  const u = random.next();
  let acc = 0;
  for (const [size, share] of p.groupSizes) {
    acc += share;
    if (u < acc) return size;
  }
  return p.groupSizes[p.groupSizes.length - 1]?.[0] ?? 1;
}

function chooseFamily(
  cc: ClienteleContent,
  random: RandomSource,
  p: Profile,
  available: ReadonlyMap<string, readonly Recipe[]>,
  among: readonly string[],
): string | null {
  const w = cc.rules.cravingWeights;
  const choices: [string, number][] = [];
  for (const f of among) {
    if ((available.get(f)?.length ?? 0) === 0) continue;
    if (f === p.mainCraving) choices.push([f, w.main]);
    else if (p.secondaryCravings.includes(f)) choices.push([f, w.secondary]);
  }
  if (choices.length === 0) return null;
  let u = random.next() * choices.reduce((s, [, x]) => s + x, 0);
  for (const [f, x] of choices) {
    u -= x;
    if (u <= 0) return f;
  }
  return choices[choices.length - 1]?.[0] ?? null;
}

/** Commande d'un groupe (règle CO-02): une boisson par personne, parfois de quoi manger. */
export function groupOrder(
  cc: ClienteleContent,
  random: RandomSource,
  p: Profile,
  size: number,
  available: readonly Recipe[],
): string[] {
  const byFamily = new Map<string, Recipe[]>();
  for (const r of available) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }
  const items: string[] = [];
  for (let i = 0; i < size; i++) {
    let f = chooseFamily(cc, random, p, byFamily, cc.rules.drinks);
    if (f === null) {
      const others = cc.rules.drinks.filter((x) => (byFamily.get(x)?.length ?? 0) > 0);
      f = others.length > 0 ? random.pick(others) : null;
    }
    if (f !== null) {
      const list = byFamily.get(f);
      if (list !== undefined && list.length > 0) items.push(random.pick(list).id);
    }
    if (random.next() < p.eatsShare) {
      const g = chooseFamily(cc, random, p, byFamily, cc.rules.foods);
      const list = g === null ? undefined : byFamily.get(g);
      if (list !== undefined && list.length > 0) items.push(random.pick(list).id);
    }
  }
  return items;
}

/** Ardoise proposée par la tablette (AT-02): ajout glouton de la recette qui attire le plus. */
export function proposeSlate(cc: ClienteleContent, possible: readonly string[]): string[] {
  const base = (slate: readonly string[]): number => {
    const fam = familiesOf(
      cc,
      slate.map((id) => [id, 0] as const),
    );
    let s = 0;
    for (const p of cc.profileList) s += p.groupsPerDay * slateFactor(cc, slatePoints(cc, p, fam));
    return s;
  };
  const left = [...possible];
  const slate: string[] = [];
  let v0 = base(slate);
  while (slate.length < cc.rules.slateLines && left.length > 0) {
    let best: string | null = null;
    let bestV = -1;
    for (const id of left) {
      const price = cc.recipes.get(id)?.basePrice ?? 0;
      const val = base([...slate, id]) - v0 + price * 0.01;
      if (val > bestV) {
        bestV = val;
        best = id;
      }
    }
    if (best === null) break;
    slate.push(best);
    left.splice(left.indexOf(best), 1);
    v0 = base(slate);
  }
  return slate;
}

export function drawWeather(cc: ClienteleContent, random: RandomSource): string {
  const u = random.next();
  let acc = 0;
  for (const m of cc.rules.weather.kinds) {
    acc += cc.rules.weather.chances[m] ?? 0;
    if (u < acc) return m;
  }
  return 'couvert';
}
