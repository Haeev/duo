/**
 * Tour 10 (lot L4): réglages des besoins doux, des pièces, du rangement, du bourg (fournil, salon,
 * épicerie, apparence) et lecture de `pieces.json`. Séparé de `contenu.ts` pour que chaque lot ait
 * ses fichiers; `contenu.ts` n'appelle que les fonctions `parse*` d'ici.
 */
import type { Reader } from './lecteur';

const WEEKDAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
type SeasonId = (typeof SEASONS)[number];
const SIDES = ['north', 'east', 'south', 'west'] as const;
export type WindowSide = (typeof SIDES)[number];

// ---------------------------------------------------------------------------
// Besoins doux (conception, sections 3.3 à 3.6 et 7.1)

export interface SoftNeedsSettings {
  belly: {
    morning: number;
    decayPerHour: number;
    /** En minutes depuis minuit. */
    supperFrom: number;
    supperFactor: number;
    together: number;
    togetherMinutes: number;
    fullAt: number;
    lowBelow: number;
    nightFloor: number;
    fullCostMultiplier: number;
    rumbleEveryMinutes: number;
    /** Gain par objet mangé (`bread` 15...). */
    foods: Record<string, number>;
    /** Gain d'un plat absent de `foods`, selon sa sorte. */
    byDish: Record<'bread' | 'simple' | 'stew', number>;
  };
  rest: {
    sitPerMinute: number;
    comfortSeatFactor: number;
    comfortSeatMin: number;
    nap: {
      from: number;
      to: number;
      perMinute: number;
      maxMinutes: number;
      bellyDecayFactor: number;
      togetherClockFactor: number;
      togetherHeart: number;
      wakeBeforeEventMinutes: number;
    };
    levels: { high: number; low: number };
  };
  sleep: { bedroomBonus: number; curtainsClosedBonus: number; togetherHeart: number; togetherMinutes: number };
  heart: {
    comfortDivisor: number;
    comfortMax: number;
    nearPartner: { radius: number; perHour: number; maxPerDay: number };
    reunion: { apartRadius: number; apartMinutes: number; meetRadius: number; gain: number; maxPerDay: number };
    lightAt: number;
    lightWalkFactor: number;
    hairNoticed: number;
    hairNoticedRadius: number;
    chocolateTogether: number;
    curtainsMorning: number;
  };
}

function numberRecord(r: Reader): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of r.entries()) out[k] = v.number();
  return out;
}

/** Lit les ajouts du tour 10 sous `needs.belly`, `needs.rest`, `needs.sleep` et `needs.heart`. */
export function parseSoftNeeds(needs: Reader): SoftNeedsSettings {
  const belly = needs.at('belly');
  const rest = needs.at('rest');
  const nap = rest.at('nap');
  const sleep = needs.at('sleep');
  const heart = needs.at('heart');
  const near = heart.at('nearPartner');
  const reunion = heart.at('reunion');
  const byDish = belly.at('byDish');
  return {
    belly: {
      morning: belly.at('morning').number(),
      decayPerHour: belly.at('decayPerHour').number(),
      supperFrom: belly.at('supperFromHour').integer(0, 24) * 60,
      supperFactor: belly.at('supperFactor').number(),
      together: belly.at('together').number(),
      togetherMinutes: belly.at('togetherMinutes').number(),
      fullAt: belly.at('fullAt').number(),
      lowBelow: belly.at('lowBelow').number(),
      nightFloor: belly.at('nightFloor').number(),
      fullCostMultiplier: belly.at('fullCostMultiplier').number(),
      rumbleEveryMinutes: belly.at('rumbleEveryMinutes').number(),
      foods: numberRecord(belly.at('foods')),
      byDish: { bread: byDish.at('bread').number(), simple: byDish.at('simple').number(), stew: byDish.at('stew').number() },
    },
    rest: {
      sitPerMinute: rest.at('sitPerMinute').number(),
      comfortSeatFactor: rest.at('comfortSeatFactor').number(),
      comfortSeatMin: rest.at('comfortSeatMin').number(),
      nap: {
        from: nap.at('from').time(),
        to: nap.at('to').time(),
        perMinute: nap.at('perMinute').number(),
        maxMinutes: nap.at('maxMinutes').number(),
        bellyDecayFactor: nap.at('bellyDecayFactor').number(),
        togetherClockFactor: nap.at('togetherClockFactor').number(),
        togetherHeart: nap.at('togetherHeart').number(),
        wakeBeforeEventMinutes: nap.at('wakeBeforeEventMinutes').number(),
      },
      levels: { high: rest.at('levels').at('high').number(), low: rest.at('levels').at('low').number() },
    },
    sleep: {
      bedroomBonus: sleep.at('bedroomBonus').number(),
      curtainsClosedBonus: sleep.at('curtainsClosedBonus').number(),
      togetherHeart: sleep.at('togetherHeart').number(),
      togetherMinutes: sleep.at('togetherMinutes').number(),
    },
    heart: {
      comfortDivisor: heart.at('comfortDivisor').number(),
      comfortMax: heart.at('comfortMax').number(),
      nearPartner: { radius: near.at('radius').number(), perHour: near.at('perHour').number(), maxPerDay: near.at('maxPerDay').number() },
      reunion: {
        apartRadius: reunion.at('apartRadius').number(),
        apartMinutes: reunion.at('apartMinutes').number(),
        meetRadius: reunion.at('meetRadius').number(),
        gain: reunion.at('gain').number(),
        maxPerDay: reunion.at('maxPerDay').integer(0),
      },
      lightAt: heart.at('lightAt').number(),
      lightWalkFactor: heart.at('lightWalkFactor').number(),
      hairNoticed: heart.at('hairNoticed').number(),
      hairNoticedRadius: heart.at('hairNoticedRadius').number(),
      chocolateTogether: heart.at('chocolateTogether').number(),
      curtainsMorning: heart.at('curtainsMorning').number(),
    },
  };
}

// ---------------------------------------------------------------------------
// Pièces, rangement (sections 4 et 5)

export interface RoomsSettings {
  opensFromDay: number;
  /** Lettre qui ouvre les plans (`courrier.json`); tant qu'elle existe et n'est pas arrivée, rien n'est ouvert. */
  letter: string | null;
  oneAtATime: boolean;
}

export function parseRoomsSettings(r: Reader | null): RoomsSettings | null {
  if (r === null || r.isNull()) return null;
  const letter = r.opt('letter');
  return {
    opensFromDay: r.at('opensFromDay').integer(1),
    letter: letter === null || letter.isNull() ? null : letter.string(),
    oneAtATime: r.at('oneAtATime').boolean(),
  };
}

export interface StorageSettings {
  /** Cases par meuble de rangement (`chest` 20, `shelf` 6, `oak_chest` 32, `cellar_rack` 12). */
  cells: Record<string, number>;
  rackHooks: number;
  stackSize: number;
  oakChestPrice: number;
}

const STORAGE_KEYS = new Set(['rackHooks', 'stackSize', 'oakChestPrice']);

export function parseStorageSettings(r: Reader | null): StorageSettings | null {
  if (r === null || r.isNull()) return null;
  const cells: Record<string, number> = {};
  for (const [k, v] of r.entries()) if (!STORAGE_KEYS.has(k)) cells[k] = v.integer(0);
  return {
    cells,
    rackHooks: r.at('rackHooks').integer(0),
    stackSize: r.at('stackSize').integer(1),
    oakChestPrice: r.at('oakChestPrice').integer(0),
  };
}

// ---------------------------------------------------------------------------
// Le bourg (section 1.5 et 1.6): lus ici parce que `reglages.json` est au lot L4; règles au lot L3.

export interface BakerySettings {
  warmFrom: number;
  warmTo: number;
  breadUntil: number;
  closedWeekdays: Weekday[];
  breadPrice: number;
  briochePrice: number;
  briocheWeekdays: Weekday[];
  dailyCapPerPlayer: Record<string, number>;
  warmBecomesBreadAt: number;
}

export interface SalonSettings {
  /** Plages d'ouverture `[début, fin]` en minutes. */
  open: [number, number][];
  weekdays: Weekday[];
  saturdayFrom: number;
  cutPrice: number;
  colorPrice: number;
  bothPrice: number;
}

export interface GrocerSettings {
  hours: [number, number];
  chocolate: {
    price: number;
    belly: number;
    until: number;
    seasons: SeasonId[];
    rainAnySeason: boolean;
    perPlayerPerDay: number;
  };
}

export interface AppearanceSettings {
  hairStyles: number;
  creationHairStyles: number;
  hairColors: number;
}

function timeRange(r: Reader): [number, number] {
  const items = r.items();
  const a = items[0];
  const b = items[1];
  if (items.length !== 2 || a === undefined || b === undefined) return r.fail('["HH:MM", "HH:MM"] attendu');
  const from = a.time();
  const to = b.time();
  if (to <= from) return r.fail('la fin vient avant le début');
  return [from, to];
}

export function parseBakery(r: Reader | null): BakerySettings | null {
  if (r === null || r.isNull()) return null;
  return {
    warmFrom: r.at('warmFrom').time(),
    warmTo: r.at('warmTo').time(),
    breadUntil: r.at('breadUntil').time(),
    closedWeekdays: r.at('closedWeekdays').items().map((d) => d.oneOf(WEEKDAYS)),
    breadPrice: r.at('breadPrice').integer(0),
    briochePrice: r.at('briochePrice').integer(0),
    briocheWeekdays: r.at('briocheWeekdays').items().map((d) => d.oneOf(WEEKDAYS)),
    dailyCapPerPlayer: numberRecord(r.at('dailyCapPerPlayer')),
    warmBecomesBreadAt: r.at('warmBecomesBreadAt').time(),
  };
}

export function parseSalon(r: Reader | null): SalonSettings | null {
  if (r === null || r.isNull()) return null;
  return {
    open: r.at('open').items().map(timeRange),
    weekdays: r.at('weekdays').items().map((d) => d.oneOf(WEEKDAYS)),
    saturdayFrom: r.at('saturdayFrom').time(),
    cutPrice: r.at('cutPrice').integer(0),
    colorPrice: r.at('colorPrice').integer(0),
    bothPrice: r.at('bothPrice').integer(0),
  };
}

export function parseGrocer(r: Reader | null): GrocerSettings | null {
  if (r === null || r.isNull()) return null;
  const c = r.at('chocolate');
  return {
    hours: timeRange(r.at('hours')),
    chocolate: {
      price: c.at('price').integer(0),
      belly: c.at('belly').number(),
      until: c.at('until').time(),
      seasons: c.at('seasons').items().map((s) => s.oneOf(SEASONS)),
      rainAnySeason: c.at('rainAnySeason').boolean(),
      perPlayerPerDay: c.at('perPlayerPerDay').integer(0),
    },
  };
}

export function parseAppearance(r: Reader | null): AppearanceSettings | null {
  if (r === null || r.isNull()) return null;
  return {
    hairStyles: r.at('hairStyles').integer(1),
    creationHairStyles: r.at('creationHairStyles').integer(1),
    hairColors: r.at('hairColors').integer(1),
  };
}

// ---------------------------------------------------------------------------
// `pieces.json`: les pièces à bâtir et les fenêtres de la maisonnette

export interface RoomElementDef {
  id: string;
  inputs: { item: string; count: number }[];
  seconds: number;
  /** Éléments à bâtir avant (ce qui porte avant ce qui est porté). */
  requires: string[];
  /** Ne se bâtit qu'une fois la panne faîtière portée à deux jusqu'au faîte. */
  needsBeam: boolean;
}

export interface RoomDef {
  id: string;
  /** Pièce de la carte (`interieurs[].pieces[].id`) qui devient jouable une fois bâtie. */
  mapRoom: string;
  price: number;
  elements: RoomElementDef[];
  /** Panne faîtière à porter à deux: point de départ (`beam_pickup`), objet porté; `null`: aucun porter. */
  beam: { from: string; item: string } | null;
  /** La fenêtre de la pièce d'où l'on entre qui devient la porte. */
  doorWindow: string;
}

/** Une fenêtre de la maisonnette, nœud `window_<n>` du modèle (même nom), en coordonnées de la carte. */
export interface WindowDef {
  id: string;
  /** Pièce de la carte où l'on est quand on la regarde (`house_main`, `house_cellar`, `house_bedroom`). */
  room: string;
  side: WindowSide;
  x: number;
  y: number;
  width: number;
  /** Des rideaux peuvent y pendre (faux pour le fenestron du cellier). */
  curtains: boolean;
}

export interface HomeContent {
  rooms: RoomDef[];
  windows: WindowDef[];
}

export const EMPTY_HOME: HomeContent = { rooms: [], windows: [] };

function stacks(r: Reader): { item: string; count: number }[] {
  return r.items().map((s) => ({ item: s.at('item').string(), count: s.at('count').integer(1) }));
}

export function parseHome(r: Reader): HomeContent {
  const rooms = r
    .at('rooms')
    .items()
    .map((room): RoomDef => {
      const beam = room.opt('beam');
      const elements = room
        .at('elements')
        .items()
        .map(
          (e): RoomElementDef => ({
            id: e.at('id').string(),
            inputs: stacks(e.at('inputs')),
            seconds: e.at('seconds').number(),
            requires: e.opt('requires')?.stringList() ?? [],
            needsBeam: e.opt('needsBeam')?.boolean() ?? false,
          }),
        );
      const ids = new Set(elements.map((e) => e.id));
      if (ids.size !== elements.length) room.at('elements').fail('élément en double');
      for (const e of elements) {
        for (const req of e.requires) if (!ids.has(req)) room.at('elements').fail(`« ${e.id} » demande « ${req} », inconnu`);
      }
      return {
        id: room.at('id').string(),
        mapRoom: room.at('mapRoom').string(),
        price: room.at('price').integer(0),
        elements,
        beam: beam === null || beam.isNull() ? null : { from: beam.at('from').string(), item: beam.at('item').string() },
        doorWindow: room.at('doorWindow').string(),
      };
    });
  const windows = r
    .at('windows')
    .items()
    .map(
      (w): WindowDef => ({
        id: w.at('id').string(),
        room: w.at('room').string(),
        side: w.at('side').oneOf(SIDES),
        x: w.at('x').number(),
        y: w.at('y').number(),
        width: w.at('width').number(),
        curtains: w.at('curtains').boolean(),
      }),
    );
  if (new Set(windows.map((w) => w.id)).size !== windows.length) r.at('windows').fail('fenêtre en double');
  for (const room of rooms) {
    if (!windows.some((w) => w.id === room.doorWindow)) r.at('rooms').fail(`${room.id}: fenêtre « ${room.doorWindow} » inconnue`);
  }
  return { rooms, windows };
}
