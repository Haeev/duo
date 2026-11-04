/**
 * Modèles de l'onglet Voisins du carnet (0.13, lot H3; conception `v0-13-habitants.md`, sections
 * 4 et 6; règles de l'interface imagée `interface-imagee-0-12-2.md`): la grille des 21 portraits,
 * la fiche d'un habitant (métier, logis, anniversaire, goûts, frise de sa journée, « n sur N »),
 * la carte du bourg et les cartes de notification des découvertes. Fonctions pures sur l'état,
 * testées dans Node. Elles ne lisent jamais la vraie position d'un habitant ni ce que le duo
 * ignore: une habitude inconnue garde son créneau en pointillé, sans lieu.
 */
import { dayOfSeason, seasonOfDay } from '../donnees/calendrier';
import type { VillagerDef } from '../donnees/types';
import { entryHolds, momentOf, type PlanningMoment } from '../etat/planning';
import type { ReadonlyWorld, Weather } from '../etat/types';
import {
  birthdayView,
  bondView,
  habitCount,
  habitViews,
  likelyWhereabouts,
  tastesView,
  townHabitCount,
  type BondView,
} from '../etat/voisins';
import {
  NEIGHBOUR_ACTIVITY_ICONS,
  NEIGHBOUR_JOB_ICONS,
  NEIGHBOUR_PLACE_ICONS,
  NEIGHBOUR_POINT_PLACES,
  type NeighbourPlace,
  UI_SETTINGS,
} from './config';
import type { UiContext } from './contexte';
import { capitalize, hourLabel, itemName, weekdayOf } from './format';
import { itemIcon } from './modele';
import { FISH_MOMENTS } from './modele-vitrine';
import { messageKeyOf } from './notifications';

// ---------------------------------------------------------------------------
// Lieux

export interface PlaceModel {
  place: NeighbourPlace;
  icon: string;
  /** « à la halte » (avec sa préposition). */
  name: string;
}

/** Le lieu d'un point de planning et d'une activité: « à la maison » et « hors du bourg » viennent de l'activité. */
export function placeOf(ctx: UiContext, point: string, activity: string): PlaceModel {
  const place: NeighbourPlace =
    activity === 'home'
      ? 'home'
      : activity === 'absent'
        ? 'away'
        : (NEIGHBOUR_POINT_PLACES[point] ?? (point.startsWith('grave_') ? 'cemetery' : 'village'));
  return {
    place,
    icon: NEIGHBOUR_PLACE_ICONS[place],
    name: ctx.texts.extra.neighbours.places[place],
  };
}

function villagerOf(ctx: UiContext, id: string): VillagerDef | undefined {
  return ctx.content.villagers.find((v) => v.id === id);
}

function metOf(world: ReadonlyWorld, id: string): boolean {
  return world.villagers.find((v) => v.id === id)?.met === true;
}

// ---------------------------------------------------------------------------
// Grille des portraits

export interface NowModel {
  /** `null`: le carnet ne sait pas où le trouver à cette heure-ci. */
  place: PlaceModel | null;
  /** Nom accessible complet (« Maintenant (14 h 10) : sans doute à la forge »). */
  label: string;
}

export interface NeighbourCardModel {
  id: string;
  met: boolean;
  /** Prénom, ou « Une personne inconnue » avant la rencontre. */
  name: string;
  bond: BondView;
  now: NowModel;
  count: { known: number; total: number };
  /** Toutes ses habitudes sont au carnet (tampon « Réglé comme une horloge »). */
  allKnown: boolean;
  birthdayToday: boolean;
  /** Nom accessible de la vignette. */
  label: string;
}

export interface NeighbourBoardModel {
  cards: NeighbourCardModel[];
  town: { known: number; total: number };
  met: number;
  /** L'habitant choisi d'emblée: le premier rencontré dont une habitude est au carnet, sinon le premier. */
  focus: string | null;
}

function nowOf(ctx: UiContext, world: ReadonlyWorld, def: VillagerDef, met: boolean): NowModel {
  const n = ctx.texts.extra.neighbours;
  const where = likelyWhereabouts(ctx.content, world, def.id);
  const time = hourLabel(Math.floor(world.clock.minutes / 10) * 10, ctx.texts.game.ui.hud.time);
  if (where.kind === 'unknown') {
    return {
      place: null,
      label: ctx.t(n.nowUnknown, { name: met ? def.label : n.unknownPerson.toLowerCase() }),
    };
  }
  const place = placeOf(ctx, where.point, where.activity);
  return { place, label: ctx.t(n.nowLabel, { time, place: place.name }) };
}

function bondLabel(ctx: UiContext, bond: BondView): string {
  const n = ctx.texts.extra.neighbours;
  const level = ctx.texts.messages[bond.levelKey] ?? '';
  return bond.next === null
    ? ctx.t(n.bondFullLabel, { level })
    : ctx.t(n.bondLabel, { level, lit: bond.level, quarters: bond.quarters });
}

export function neighbourBoard(world: ReadonlyWorld, ctx: UiContext): NeighbourBoardModel {
  const n = ctx.texts.extra.neighbours;
  const cards = ctx.content.villagers.map((def): NeighbourCardModel => {
    const met = metOf(world, def.id);
    const bond = bondView(ctx.content, world, def.id);
    const count = habitCount(ctx.content, world, def.id);
    const now = nowOf(ctx, world, def, met);
    const birthday = birthdayView(ctx.content, world, def.id);
    const birthdayToday =
      met &&
      birthday.kind === 'known' &&
      ctx.content.villageCalendar.birthdays[def.id] !== undefined &&
      isToday(ctx, world, birthday.season, birthday.day);
    const name = met ? def.label : n.unknownPerson;
    const allKnown = count.total > 0 && count.known === count.total;
    const parts = [
      name,
      met ? bondLabel(ctx, bond) : ctx.t(n.unmetLine),
      now.label,
      ctx.t(n.countLabel, count),
    ];
    if (allKnown) parts.push(n.allKnown);
    if (birthdayToday) parts.push(ctx.t(n.birthdayToday));
    return {
      id: def.id,
      met,
      name,
      bond,
      now,
      count,
      allKnown,
      birthdayToday,
      label: parts.join(', '),
    };
  });
  const focus =
    cards.find((c) => c.met && c.count.known > 0)?.id ??
    cards.find((c) => c.met)?.id ??
    cards[0]?.id ??
    null;
  return {
    cards,
    town: townHabitCount(ctx.content, world),
    met: cards.filter((c) => c.met).length,
    focus,
  };
}

function isToday(ctx: UiContext, world: ReadonlyWorld, season: string, day: number): boolean {
  const s = ctx.content.settings;
  return seasonOfDay(s, world.clock.day) === season && dayOfSeason(s, world.clock.day) === day;
}

// ---------------------------------------------------------------------------
// Fiche d'un habitant

export interface TasteSlotModel {
  /** `null`: goût pas encore découvert (« ? »). */
  item: string | null;
  icon: string | null;
  name: string;
}

export interface TasteGroupModel {
  taste: 'loves' | 'likes' | 'dislikes';
  icon: string;
  title: string;
  slots: TasteSlotModel[];
  /** Nom accessible du groupe (« Adore : la confiture de mûres, un goût encore à découvrir »). */
  label: string;
}

export interface TimelineSegmentModel {
  from: number;
  to: number;
  known: boolean;
  /** Lieu de l'habitude connue (picto), `null` si inconnue. */
  place: PlaceModel | null;
  /** Picto d'activité en coin (travail, jeu, réception), ou `null`. */
  activityIcon: string | null;
  /** Nom accessible et bulle au survol. */
  label: string;
}

export interface DayChipModel {
  /** Décalage depuis aujourd'hui (0 à 6). */
  offset: number;
  day: number;
  short: string;
  label: string;
  today: boolean;
}

export interface NeighbourPageModel {
  id: string;
  met: boolean;
  name: string;
  /** « meunière du moulin de la Vanne, 58 ans », vide avant la rencontre. */
  line: string;
  jobIcon: string | null;
  jobLabel: string;
  home: string | null;
  homeLabel: string;
  birthday: {
    known: boolean;
    season: string | null;
    day: number | null;
    label: string;
    today: boolean;
  } | null;
  bond: BondView;
  bondLabel: string;
  tastes: TasteGroupModel[];
  /** Sélecteur de jour, seulement si sa journée change d'un jour à l'autre de la semaine qui vient. */
  days: DayChipModel[] | null;
  /** Bascule beau temps et pluie, seulement s'il a une habitude de pluie au carnet (ou déjà vue tomber). */
  rainToggle: boolean;
  /** Jour et temps de la frise. */
  offset: number;
  weather: 'sunny' | 'rain';
  timeline: TimelineSegmentModel[];
  timelineLabel: string;
  /** Minute de « maintenant » sur la frise du jour, `null` un autre jour ou un autre temps. */
  nowMinute: number | null;
  count: { known: number; total: number };
  countLabel: string;
  allKnown: boolean;
  now: NowModel;
}

function tasteGroups(ctx: UiContext, world: ReadonlyWorld, def: VillagerDef): TasteGroupModel[] {
  const n = ctx.texts.extra.neighbours;
  const known = tastesView(world, def.id);
  const totals = {
    loves: def.tastes.loves.length,
    likes: def.tastes.likes.length,
    dislikes: def.tastes.dislikes.length,
  };
  const groups = [
    { taste: 'loves', icon: 'taste-love', title: n.loves, items: known.loves },
    { taste: 'likes', icon: 'taste-like', title: n.likes, items: known.likes },
    { taste: 'dislikes', icon: 'taste-dislike', title: n.dislikes, items: known.dislikes },
  ] as const;
  return groups.map((g) => {
    const slots: TasteSlotModel[] = g.items.map((item) => ({
      item,
      icon: itemIcon(ctx, item),
      name: capitalize(itemName(ctx.content.items[item], 1, item)),
    }));
    for (let i = slots.length; i < totals[g.taste]; i++)
      slots.push({ item: null, icon: null, name: n.tasteUnknown });
    const list = slots
      .map((s) => (s.item === null ? n.tasteUnknown : s.name.toLowerCase()))
      .join(', ');
    return {
      taste: g.taste,
      icon: g.icon,
      title: g.title,
      slots,
      label: ctx.t(n.tasteListLabel, { taste: g.title, list }),
    };
  });
}

/** Sa journée de 6 h à minuit ce jour-là, par ce temps, en cases: une case par habitude (connue ou non). */
export function timelineOf(
  ctx: UiContext,
  world: ReadonlyWorld,
  def: VillagerDef,
  day: number,
  weather: Weather,
  dayName: string,
): TimelineSegmentModel[] {
  const n = ctx.texts.extra.neighbours;
  const v = UI_SETTINGS.vitrine;
  const met = metOf(world, def.id);
  const known = new Set(world.habits.known[def.id] ?? []);
  const labels = new Map(def.habits.map((h) => [h.id, h.label]));
  const raw: {
    from: number;
    to: number;
    key: string;
    habit: string | null;
    point: string;
    activity: string;
  }[] = [];
  const end: number = v.dayTo;
  for (let m: number = v.dayFrom; m < end; m += v.dayStep) {
    const at: PlanningMoment = { day, minutes: m, weather };
    const entry = def.schedule.find((e) => entryHolds(ctx.content, world, e, at));
    const habit = entry?.habit ?? null;
    const isKnown = habit !== null && known.has(habit);
    // Une habitude inconnue ne dit ni son lieu ni ses variantes: seule sa durée se voit.
    const key =
      isKnown && entry !== undefined
        ? `${habit}|${entry.point}|${entry.activity}`
        : `?|${habit ?? ''}`;
    const last = raw[raw.length - 1];
    if (last?.key === key) last.to = m + v.dayStep;
    else
      raw.push({
        from: m,
        to: m + v.dayStep,
        key,
        habit: isKnown ? habit : null,
        point: entry?.point ?? '',
        activity: entry?.activity ?? '',
      });
  }
  const time = (m: number): string => hourLabel(m, ctx.texts.game.ui.hud.time);
  return raw.map((r) => {
    if (r.habit === null) {
      const label = met
        ? ctx.t(n.segmentUnknown, {
            name: def.label,
            day: dayName,
            from: time(r.from),
            to: time(r.to),
          })
        : ctx.t(n.segmentNobody, { from: time(r.from), to: time(r.to) });
      return { from: r.from, to: r.to, known: false, place: null, activityIcon: null, label };
    }
    const place = placeOf(ctx, r.point, r.activity);
    return {
      from: r.from,
      to: r.to,
      known: true,
      place,
      activityIcon: NEIGHBOUR_ACTIVITY_ICONS[r.activity] ?? null,
      label: ctx.t(n.segmentKnown, {
        from: time(r.from),
        to: time(r.to),
        place: place.name,
        habit: labels.get(r.habit) ?? '',
      }),
    };
  });
}

function signature(segments: readonly TimelineSegmentModel[]): string {
  return segments
    .map((s) => `${String(s.from)}-${String(s.to)}:${s.known ? (s.place?.place ?? '') : '?'}`)
    .join(';');
}

/** Moments de la frise (matin, midi, soir, nuit), bornés à la journée de la frise. */
export function timelineMoments(): {
  id: (typeof FISH_MOMENTS)[number]['id'];
  from: number;
  to: number;
}[] {
  const v = UI_SETTINGS.vitrine;
  return FISH_MOMENTS.map((m) => ({
    id: m.id,
    from: Math.max(m.from, v.dayFrom),
    to: Math.min(m.to, v.dayTo),
  })).filter((m) => m.to > m.from);
}

export function neighbourPage(
  world: ReadonlyWorld,
  ctx: UiContext,
  villager: string,
  choice: { offset: number; weather: 'sunny' | 'rain' | null },
): NeighbourPageModel | null {
  const def = villagerOf(ctx, villager);
  if (def === undefined) return null;
  const n = ctx.texts.extra.neighbours;
  const met = metOf(world, def.id);
  const today = world.clock.day;
  const views = habitViews(ctx.content, world, def.id);
  const rainToggle = views.some((h) => h.def.kind === 'rain' && h.shown);
  const todayWeather: 'sunny' | 'rain' = world.weather === 'rain' ? 'rain' : 'sunny';
  const offset = Math.max(0, Math.min(6, choice.offset));
  const weather: 'sunny' | 'rain' = rainToggle
    ? (choice.weather ?? (offset === 0 ? todayWeather : 'sunny'))
    : offset === 0
      ? todayWeather
      : 'sunny';
  const dayName = (d: number): string => weekdayOf(d, ctx.texts.weekdays);
  const chips: DayChipModel[] = Array.from({ length: 7 }, (_, i) => {
    const d = today + i;
    const name = dayName(d);
    return {
      offset: i,
      day: d,
      short: capitalize(name.slice(0, 3)),
      label: ctx.t(i === 0 ? n.todayLabel : n.dayLabel, { weekday: capitalize(name) }),
      today: i === 0,
    };
  });
  // Le sélecteur de jour ne paraît que si la journée change dans la semaine (classe, marché, messe...).
  const week = chips.map((c) =>
    signature(timelineOf(ctx, world, def, c.day, weather, dayName(c.day))),
  );
  const varies = new Set(week).size > 1;
  const day = today + (varies ? offset : 0);
  const effectiveOffset = varies ? offset : 0;
  const timeline = timelineOf(
    ctx,
    world,
    def,
    day,
    weather,
    effectiveOffset === 0 ? n.timelineToday : dayName(day),
  );
  const bond = bondView(ctx.content, world, def.id);
  const count = habitCount(ctx.content, world, def.id);
  const b = birthdayView(ctx.content, world, def.id);
  const birthday =
    !met || b.kind === 'none'
      ? null
      : b.kind === 'known'
        ? {
            known: true,
            season: b.season,
            day: b.day,
            label: ctx.t(n.birthdayLabel, { day: b.day, season: n.birthdaySeasons[b.season] }),
            today: isToday(ctx, world, b.season, b.day),
          }
        : { known: false, season: null, day: null, label: ctx.t(n.birthdayUnknown), today: false };
  const line = met
    ? [def.role, def.age].filter((x): x is string => x !== null && x !== '').join(', ')
    : ctx.t(n.unmetLine);
  const showNow = effectiveOffset === 0 && weather === todayWeather;
  return {
    id: def.id,
    met,
    name: met ? def.label : n.unknownPerson,
    line: capitalize(line),
    jobIcon: met ? (NEIGHBOUR_JOB_ICONS[def.id] ?? null) : null,
    jobLabel: met ? ctx.t(n.jobLabel, { role: def.role }) : '',
    home: met ? def.homeLabel : null,
    homeLabel: met && def.homeLabel !== null ? ctx.t(n.homeLabel, { home: def.homeLabel }) : '',
    birthday,
    bond,
    bondLabel: bondLabel(ctx, bond),
    tastes: met ? tasteGroups(ctx, world, def) : [],
    days: varies ? chips : null,
    rainToggle,
    offset: effectiveOffset,
    weather,
    timeline,
    timelineLabel: ctx.t(n.timelineLabel, {
      day: effectiveOffset === 0 ? n.timelineToday : capitalize(dayName(day)),
    }),
    nowMinute: showNow ? world.clock.minutes : null,
    count,
    countLabel: ctx.t(n.countLabel, count),
    allKnown: count.total > 0 && count.known === count.total,
    now: nowOf(ctx, world, def, met),
  };
}

// ---------------------------------------------------------------------------
// Le bourg

export interface TownSpotModel {
  place: PlaceModel;
  /** Position sur la carte schématique, de 0 à 1 (gauche, haut). */
  x: number;
  y: number;
  /** Habitants qu'on y trouve sans doute maintenant. */
  villagers: { id: string; name: string }[];
  label: string;
}

export interface TownModel {
  spots: TownSpotModel[];
  /** Ceux qu'on sait chez eux ou hors du bourg (sans place sur la carte). */
  elsewhere: { place: PlaceModel; villagers: { id: string; name: string }[] }[];
}

/**
 * La carte schématique du bourg (« probablement ici » à l'heure courante): chaque lieu à la position
 * moyenne de ses points sur la carte du jeu, les habitants rencontrés au lieu de leur habitude
 * connue qui tient maintenant (`likelyWhereabouts`).
 */
export function townModel(world: ReadonlyWorld, ctx: UiContext): TownModel {
  const n = ctx.texts.extra.neighbours;
  const sums = new Map<NeighbourPlace, { x: number; y: number; count: number }>();
  for (const [point, place] of Object.entries(NEIGHBOUR_POINT_PLACES)) {
    const p = ctx.map.points[point];
    if (p === undefined || place === 'away' || place === 'house') continue;
    const s = sums.get(place) ?? { x: 0, y: 0, count: 0 };
    sums.set(place, { x: s.x + p.x, y: s.y + p.y, count: s.count + 1 });
  }
  const centres = [...sums.entries()].map(([place, s]) => ({
    place,
    x: s.x / s.count,
    y: s.y / s.count,
  }));
  const xs = centres.map((c) => c.x);
  const ys = centres.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const people = new Map<NeighbourPlace, { id: string; name: string }[]>();
  for (const def of ctx.content.villagers) {
    if (!metOf(world, def.id)) continue;
    const where = likelyWhereabouts(ctx.content, world, def.id, momentOf(world));
    if (where.kind === 'unknown') continue;
    const place = placeOf(ctx, where.point, where.activity).place;
    people.set(place, [...(people.get(place) ?? []), { id: def.id, name: def.label }]);
  }
  const spots = centres.map((c): TownSpotModel => {
    const place: PlaceModel = {
      place: c.place,
      icon: NEIGHBOUR_PLACE_ICONS[c.place],
      name: n.places[c.place],
    };
    const villagers = people.get(c.place) ?? [];
    const label =
      villagers.length === 0
        ? capitalize(place.name)
        : ctx.t(n.townHere, { names: villagers.map((v) => v.name).join(', '), place: place.name });
    return {
      place,
      x: maxX === minX ? 0.5 : (c.x - minX) / (maxX - minX),
      y: maxY === minY ? 0.5 : (c.y - minY) / (maxY - minY),
      villagers,
      label,
    };
  });
  const elsewhere = (['home', 'house', 'away', 'village'] as const)
    .map((place) => ({
      place: { place, icon: NEIGHBOUR_PLACE_ICONS[place], name: n.places[place] },
      villagers: people.get(place) ?? [],
    }))
    .filter((e) => e.villagers.length > 0);
  return { spots, elsewhere };
}

// ---------------------------------------------------------------------------
// Notifications des découvertes

export interface HabitToastModel {
  villager: string;
  /** Prénom (ou « une personne inconnue »). */
  name: string;
  /** La ligne du carnet (« Le mardi, elle monte la farine... »), ou le niveau d'amitié atteint. */
  text: string;
  /** D'où vient la découverte (« vu par Camille »), vide sinon. */
  source: string;
  /** Picto à droite: le lieu de l'habitude, l'objet du goût; `null` sans lieu connu. */
  placeIcon: string | null;
  kind: 'habit' | 'all' | 'bond' | 'taste';
  /** Picto devant le prénom: le crayon du carnet, le cœur d'un lien, la marque du goût. */
  mark: string;
  /** Lanternes allumées (passage de niveau). */
  level: number | null;
}

const TASTE_KEYS: Readonly<
  Record<string, { taste: 'loves' | 'likes' | 'dislikes'; mark: string }>
> = {
  taste_found_loves: { taste: 'loves', mark: 'taste-love' },
  taste_found_likes: { taste: 'likes', mark: 'taste-like' },
  taste_found_dislikes: { taste: 'dislikes', mark: 'taste-dislike' },
};

type ToastSourceKey =
  'toastSeen' | 'toastTogether' | 'toastHeard' | 'toastHeardOther' | 'toastRead' | 'toastReadOther';

const HABIT_KEYS: Readonly<Record<string, ToastSourceKey | null>> = {
  habit_found: 'toastSeen',
  habit_found_together: 'toastTogether',
  habit_heard: 'toastHeard',
  habit_heard_other: 'toastHeardOther',
  habit_read: 'toastRead',
  habit_read_other: 'toastReadOther',
  habit_noted: null,
};

/** Les valeurs des `{variables}` d'un texte composé à partir de son gabarit, ou `null`. */
function varsOf(template: string, text: string): Record<string, string> | null {
  const names: string[] = [];
  const source = template
    .split(/(\{[a-zA-Z]+\})/)
    .map((part) => {
      const m = /^\{([a-zA-Z]+)\}$/.exec(part);
      if (m?.[1] !== undefined) {
        names.push(m[1]);
        return '(.+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  const match = new RegExp(`^${source}$`, 'su').exec(text);
  if (match === null) return null;
  return Object.fromEntries(names.map((name, i) => [name, match[i + 1] ?? '']));
}

/**
 * Une notification d'habitude notée, d'habitudes toutes connues ou de lanterne allumée, en carte
 * courte avec le portrait (`null` pour les autres notifications). Les textes viennent de la
 * simulation (`textes.json`); la carte en sépare le prénom, la ligne du carnet et la source.
 */
export function habitToast(
  n: Readonly<{ key: string | null; text: string }>,
  ctx: UiContext,
): HabitToastModel | null {
  const messages = ctx.texts.messages;
  const key = n.key ?? messageKeyOf(n.text, messages);
  if (key === null) return null;
  const template = messages[key];
  if (template === undefined) return null;
  const vars = varsOf(template, n.text);
  if (vars === null) return null;
  const name = vars.name ?? '';
  const def = ctx.content.villagers.find((v) => v.label === name);
  const t = ctx.texts.extra.neighbours;
  if (key === 'habits_all') {
    return def === undefined
      ? null
      : {
          villager: def.id,
          name,
          text: t.allKnown,
          source: '',
          placeIcon: null,
          kind: 'all',
          mark: 'ui-pencil',
          level: null,
        };
  }
  if (key === 'bond_level_up' || key === 'bond_level_up_family') {
    if (def === undefined) return null;
    const level = Object.entries(messages).find(
      ([k, v]) => /^bond_level_\d$/.test(k) && v === vars.level,
    )?.[0];
    return {
      villager: def.id,
      name,
      text: vars.level ?? '',
      source: '',
      placeIcon: null,
      kind: 'bond',
      mark: 'ui-heart',
      level: level === undefined ? null : Number(level.slice(-1)),
    };
  }
  const taste = TASTE_KEYS[key];
  if (taste !== undefined) {
    if (def === undefined) return null;
    // L'objet: parmi ses goûts de ce genre, celui dont le nom est dans le texte (« une girolle »).
    const said = (vars.item ?? '').toLowerCase();
    const pool =
      taste.taste === 'dislikes' ? def.tastes.dislikes.map((d) => d.item) : def.tastes[taste.taste];
    const item = pool.find((id) =>
      said.includes(itemName(ctx.content.items[id], 1, id).toLowerCase()),
    );
    return {
      villager: def.id,
      name,
      text: ctx.t(t.tasteListLabel, { taste: t[taste.taste], list: vars.item ?? '' }),
      source: '',
      placeIcon: item === undefined ? null : itemIcon(ctx, item),
      kind: 'taste',
      mark: taste.mark,
      level: null,
    };
  }
  if (!(key in HABIT_KEYS)) return null;
  const sourceKey = HABIT_KEYS[key] ?? null;
  const source =
    sourceKey === null
      ? ''
      : ctx.t(t[sourceKey], { player: vars.player ?? '', speaker: vars.speaker ?? '' });
  const habit = def?.habits.find((h) => h.label === vars.habit);
  const entry = habit === undefined ? undefined : def?.schedule.find((e) => e.habit === habit.id);
  return {
    villager: def?.id ?? '',
    name: def === undefined ? capitalize(name) : name,
    text: vars.habit ?? n.text,
    source,
    placeIcon: entry === undefined ? null : placeOf(ctx, entry.point, entry.activity).icon,
    kind: 'habit',
    mark: 'ui-pencil',
    level: null,
  };
}
