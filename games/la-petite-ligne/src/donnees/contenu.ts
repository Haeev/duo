/**
 * Lecture et contrôle du contenu du game designer (`donnees/*.json`).
 * Toute erreur arrête le chargement avec un message qui cite le fichier et le
 * champ (README des données, section 6). Les heures deviennent des minutes et
 * les conditions qui comptent deviennent des conditions `counter`.
 */
import type { CropStage, Quality, Weather } from '../etat/types';
import type { TasteLevel } from '../etat/types-voisins';

import {
  DEFAULT_BENCHES,
  DEFAULT_DIALOGUES,
  DEFAULT_TIDY,
  DEFAULT_ENVIES,
  DEFAULT_CARRY_GRIP,
  DEFAULT_FEEL,
  DEFAULT_MEMORIES,
  DEFAULT_MOMENTS,
  DEFAULT_RANGES,
  DEFAULT_SECRETS,
  DEFAULT_TREES,
  DEFAULT_WEATHER,
} from './defauts';
import { ContentError, Reader } from './lecteur';
import { agreeMoney } from './monnaie';
import { parseMarket } from './marche';
import { checkDecisionVillagers, NO_DECISIONS, parseDecisions } from './decisions';
import { parseMailRound } from './plis';
import {
  EMPTY_HOME,
  parseAppearance,
  parseBakery,
  parseGrocer,
  parseHome,
  parseRoomsSettings,
  parseSalon,
  parseSoftNeeds,
  parseStorageSettings,
} from './maison';
import { townFrom } from './bourg';
import { parseFishDef, parseFishingRules } from './poissons';
import { EMPTY_CLOTHES, parseClothes, parseWardrobeSettings } from './vetements';
import {
  checkHabits,
  checkTastes,
  checkVillageReferences,
  habitExists,
  parseBondSettings,
  parseHabits,
  parseHabitSettings,
  parseTastes,
  parseVillageCalendar,
  resolveSelf,
  revealDialogues,
  signsOf,
} from './voisins';
import type {
  AnimalDef,
  ClockPace,
  Condition,
  ConstructionDef,
  Content,
  CropDef,
  DialogueChoiceDef,
  DialogueDef,
  DialogueLineDef,
  DishKind,
  Effect,
  EnvieDef,
  FeelSettings,
  HintDef,
  HintTrigger,
  ItemCategory,
  ItemDef,
  AnnonceDef,
  AnnonceKind,
  AnnonceReward,
  CatalogueDef,
  GoatSettings,
  HappinessSettings,
  HenCareSettings,
  ImprovementDef,
  ImprovementQueue,
  ToolKind,
  ToolStats,
  OrderDef,
  CatalogueWindow,
  LetterDef,
  MomentChoreography,
  MomentDef,
  MomentFreeze,
  MomentKeyframe,
  MomentWatch,
  QualityDef,
  QuestSecretDef,
  QuestDef,
  QuestStepDef,
  RecipeDef,
  OrderFamily,
  OrderResource,
  Season,
  ScheduleEntry,
  Settings,
  Since,
  StageId,
  Tenderness,
  WeatherOdds,
  Texts,
  VillagerDef,
  Who,
} from './types';

/** Largeur d'un objet mural sans `wallWidth` (m): un cadre (R17). */
const DEFAULT_WALL_WIDTH = 0.6;

/** Les neuf fichiers, tels qu'importés (JSON brut). */
export interface RawContentFiles {
  objets: unknown;
  cultures: unknown;
  habitants: unknown;
  quetes: unknown;
  courrier: unknown;
  astuces: unknown;
  envies: unknown;
  textes: unknown;
  reglages: unknown;
  /** Moments rares (tour 6); absent: aucun moment (le reste de la partie ne change pas, M-11). */
  moments?: unknown;
  /** Tour 9: gabarits d'annonces, chantiers, catalogue de la semaine; absents: rien de tout cela. */
  annonces?: unknown;
  chantiers?: unknown;
  catalogue?: unknown;
  /** Tour 10: pièces à bâtir et fenêtres (`pieces.json`); absent: ni pièce ni fenêtre. */
  pieces?: unknown;
  /** 0.12: le marché du dimanche (`marche.json`); absent: pas de marché. */
  marche?: unknown;
  /** 0.12: vêtements de la garde-robe (`vetements.json`); absent: aucun vêtement (essais seulement). */
  vetements?: unknown;
  /** 0.13: habitants nouveaux et compléments, fusionnés par identifiant (`habitants-0-13.json`); absent: rien. */
  habitants013?: unknown;
  /** 0.13: jours particuliers et classe (`calendrier.json`); absent: aucun. */
  calendrier?: unknown;
  /** 0.13: décisions à deux (`decisions.json`); absent: aucune. */
  decisions?: unknown;
}

const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain'];
const QUALITIES: readonly Quality[] = ['ordinary', 'fine'];
const STAGES: readonly CropStage[] = ['seed', 'sprout', 'young', 'ripe'];
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const WEEKDAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const WHO: readonly Who[] = ['either', 'actor', 'both', 'informed', 'doer'];
const CHARACTERS = ['p1', 'p2'] as const;
const SINCE: readonly Since[] = ['step_start', 'day_start', 'game_start'];
const CATEGORIES: readonly ItemCategory[] = [
  'seed',
  'crop',
  'forage',
  'animal_product',
  'material',
  'carried',
  'tool',
  'food',
  'quest',
  'fish',
  'decoration',
  'furniture',
  'animal_order',
  'gift',
];
const DISHES: readonly DishKind[] = ['bread', 'simple', 'stew'];
const STAGE_IDS: readonly StageId[] = ['demo', 'summer_end', 'autumn_end'];
const TOOL_KINDS: readonly ToolKind[] = ['hoe', 'watering_can', 'axe', 'fishing_rod'];
const ANNONCE_KINDS: readonly AnnonceKind[] = ['help', 'together'];
const QUEUES: readonly ImprovementQueue[] = ['bourg', 'maisonnette', 'elevage'];
const TENDERNESS: readonly Tenderness[] = ['none', 'accomplices', 'gentle'];
const FAMILIES: readonly OrderFamily[] = ['potager', 'basse-cour', 'cuisine', 'rivière', 'bois', 'lisière'];
const RESOURCES: readonly OrderResource[] = ['garden', 'eggs', 'river', 'wood', 'forage'];
const TIERS = ['P0', 'P1'] as const;

function root(file: string, value: unknown): Reader {
  const reader = new Reader(file, '', value);
  reader.at('version').integer(1, 1);
  return reader;
}

function optString(r: Reader, key: string): string | null {
  const child = r.opt(key);
  return child === null || child.isNull() ? null : child.string();
}

/** Texte facultatif, non vide s'il est donné. */
function optText(r: Reader, key: string): string | null {
  const value = optString(r, key);
  if (value !== null && value.trim() === '') r.at(key).fail('texte non vide attendu');
  return value;
}

/**
 * Les commandes des trains (`order.trains`), chacune avec ses lignes; prime de
 * ligne et bonus pris à la commande, sinon au niveau de `order`. L'ancien
 * format (`order.lines`, une commande) vaut une commande au dernier train.
 */
function trainOrders(order: Reader, trainDays: number[]): OrderDef[] {
  const premium = order.opt('linePremium');
  const bonus = order.opt('fullBonus');
  const read = (o: Reader, day: number): OrderDef => {
    // Absente ici comme dans « order »: `at` signale le champ manquant.
    const p = o.opt('linePremium') ?? premium ?? o.at('linePremium');
    const b = o.opt('fullBonus') ?? bonus ?? o.at('fullBonus');
    return { day, lines: stackList(o.at('lines')), linePremium: p.number(), fullBonus: b.number() };
  };
  if (!order.has('trains')) return [read(order, trainDays[trainDays.length - 1] ?? 1)];
  let previous = 0;
  return order.at('trains').items().map((o) => {
    const day = o.at('day').integer(1);
    if (!trainDays.includes(day)) o.at('day').fail(`aucun train le jour ${day} (train.days)`);
    if (day <= previous) o.at('day').fail('commandes attendues dans l\'ordre des jours');
    previous = day;
    return read(o, day);
  });
}

function stackList(r: Reader): { item: string; count: number }[] {
  return r.items().map((s) => ({ item: s.at('item').string(), count: s.at('count').integer(1) }));
}

function handcarSize(r: Reader): [number, number] {
  const size = r.numberList();
  const [length, width] = size;
  if (size.length !== 2 || length === undefined || width === undefined || length <= 0 || width <= 0) {
    r.fail('deux longueurs positives attendues (le long de la voie, en travers)');
  }
  return [length, width];
}

function parseCarry(r: Reader | null): Settings['carry'] {
  const handcar = r?.opt('handcar') ?? null;
  const parcel = r?.opt('parcel') ?? null;
  const path: [number, number][] =
    handcar === null
      ? []
      : handcar
          .at('path')
          .items()
          .map((w) => {
            const xy = w.numberList();
            if (xy.length !== 2) w.fail('deux nombres attendus (dx, dy)');
            return [xy[0] ?? 0, xy[1] ?? 0];
          });
  if (handcar !== null && path.length === 0) handcar.at('path').fail('au moins un point de passage');
  const lengths: Record<string, number> = {};
  const lengthsReader = r?.opt('lengths') ?? null;
  const grip = r?.opt('grip') ?? null;
  if (lengthsReader !== null) {
    for (const [item, value] of lengthsReader.entries()) {
      const m = value.number();
      if (m < 0) value.fail('longueur positive attendue');
      lengths[item] = m;
    }
  }
  return {
    handcar:
      handcar === null
        ? null
        : {
            item: handcar.at('item').string(),
            from: handcar.at('from').string(),
            path,
            toOffset: path[path.length - 1] ?? [0, 0],
            size: handcarSize(handcar.at('size')),
            quest: handcar.at('quest').string(),
            step: handcar.at('step').string(),
            flag: handcar.at('flag').string(),
          },
    parcel: parcel === null ? null : { item: parcel.at('item').string(), from: parcel.at('from').string(), to: parcel.at('to').string() },
    lengths,
    grip:
      grip === null
        ? { ...DEFAULT_CARRY_GRIP }
        : {
            side: optNumber(grip, 'side', DEFAULT_CARRY_GRIP.side),
            fromEnd: optNumber(grip, 'fromEnd', DEFAULT_CARRY_GRIP.fromEnd),
            reach: optNumber(grip, 'reach', DEFAULT_CARRY_GRIP.reach),
            apart: optNumber(grip, 'apart', DEFAULT_CARRY_GRIP.apart),
          },
    quests: (r?.opt('quests')?.items() ?? []).map((q) => ({
      item: q.at('item').string(),
      from: q.at('from').string(),
      to: q.at('to').string(),
      quest: q.at('quest').string(),
      step: q.at('step').string(),
      when: conditions(q.opt('when'), 'step_start'),
      flag: q.at('flag').string(),
      placedText: optString(q, 'placedText'),
    })),
  };
}

/** Fenêtres du catalogue (`windows`), ou l'ancienne fenêtre unique. */
function catalogueWindows(catalogue: Reader, dayTime: (x: Reader) => { day: number; time: number }): CatalogueWindow[] {
  const list = catalogue.has('windows') ? catalogue.at('windows').items() : [catalogue];
  return list.map((w) => ({ orderDeadline: dayTime(w.at('orderDeadline')), delivery: dayTime(w.at('delivery')) }));
}

function optNumber(r: Reader, key: string, fallback: number): number {
  const child = r.opt(key);
  return child === null || child.isNull() ? fallback : child.number();
}

function optBoolean(r: Reader, key: string, fallback: boolean): boolean {
  const child = r.opt(key);
  return child === null ? fallback : child.boolean();
}

function tier(r: Reader): 'P0' | 'P1' {
  const child = r.opt('tier');
  return child === null ? 'P0' : child.oneOf(TIERS);
}

// ---------------------------------------------------------------------------
// Conditions et effets

function counter(r: Reader, key: string, since: Since, who: Who = 'either'): Condition {
  const sinceReader = r.opt('since');
  const whoReader = r.opt('who');
  return {
    type: 'counter',
    key,
    count: optNumber(r, 'count', 1),
    since: sinceReader === null ? since : sinceReader.oneOf(SINCE),
    who: whoReader === null ? who : whoReader.oneOf(WHO),
  };
}

function suffix(r: Reader, key: string): string {
  const value = optString(r, key);
  return value === null ? '' : `:${value}`;
}

export function parseCondition(r: Reader, since: Since): Condition {
  const type = r.at('type').string();
  const label = optString(r, 'label');
  const condition = parseConditionBody(r, type, since);
  return label === null ? condition : { ...condition, label };
}

function parseConditionBody(r: Reader, type: string, since: Since): Condition {
  switch (type) {
    case 'all':
    case 'any':
      return { type, conditions: r.at('conditions').items().map((c) => parseCondition(c, since)) };
    case 'not':
      return { type, condition: parseCondition(r.at('condition'), since) };
    case 'day_is':
      return { type, days: r.at('days').numberList() };
    case 'day_at_least':
      return { type, day: r.at('day').integer(1) };
    case 'weekday_is':
      return {
        type,
        weekdays: r
          .at('weekdays')
          .items()
          .map((w) => WEEKDAYS.indexOf(w.oneOf(WEEKDAYS))),
      };
    case 'time_is':
      return { type, from: r.at('from').time(), to: r.at('to').time() };
    case 'weather_is':
    case 'weather_was':
    case 'weather_tomorrow_is':
      return { type, weather: r.at('weather').oneOf(WEATHERS) };
    case 'morning_mist':
    case 'school_day':
      return { type };
    case 'special_day':
      return { type, id: r.at('id').string() };
    case 'season_day_is':
      return { type, days: r.at('days').items().map((d) => d.integer(1)) };
    case 'birthday_of':
      return { type, villager: r.at('villager').string() };
    case 'decision_made':
      return { type, decision: r.at('decision').string(), option: optString(r, 'option') };
    case 'habit_known':
      return { type, villager: r.at('villager').string(), habit: r.at('habit').string() };
    case 'bond_at_least':
      return { type, villager: r.at('villager').string(), level: r.at('level').integer(0, 5) };
    case 'tenderness_at_least':
      return { type, level: r.at('level').oneOf(TENDERNESS) };
    case 'stage_due':
      return { type, stage: r.at('stage').oneOf(STAGE_IDS) };
    case 'season_is':
      return {
        type,
        seasons: r.at('seasons').items().map((s) => s.oneOf(SEASONS)),
        fromSeasonDay: r.has('fromSeasonDay') ? r.at('fromSeasonDay').integer(1) : 1,
      };
    case 'flag':
      return { type, flag: r.at('flag').string() };
    case 'quest_active':
    case 'quest_done':
      return { type, quest: r.at('quest').string() };
    case 'step_active':
    case 'quest_step_done':
      return { type, quest: r.at('quest').string(), step: r.at('step').string() };
    case 'dialogue_done':
      return { type, dialogue: r.at('dialogue').string() };
    case 'item_owned':
      return { type, item: r.at('item').string(), count: optNumber(r, 'count', 1) };
    case 'item_in_bag': {
      const who = r.opt('who');
      return {
        type,
        item: r.at('item').string(),
        count: optNumber(r, 'count', 1),
        who: who === null ? 'either' : who.oneOf(WHO),
      };
    }
    case 'built':
      return { type, construction: r.at('construction').string() };
    case 'recipe_known':
      return { type, recipe: r.at('recipe').string() };
    case 'order_complete': {
      const day = r.opt('day');
      return { type, day: day === null ? null : day.integer(1) };
    }
    case 'used_tool_at':
      return {
        type,
        tool: r.at('tool').string(),
        point: r.at('point').string(),
        radius: r.at('radius').number(),
      };
    case 'variant': {
      const of = r.at('of').integer(2, 99);
      return { type, group: r.at('group').string(), value: r.at('value').integer(0, of - 1), of };
    }
    case 'looked_at': {
      const who = r.opt('who');
      return {
        type,
        point: r.at('point').string(),
        distance: r.at('distance').number(),
        minDistance: optNumber(r, 'minDistance', 0),
        still: optBoolean(r, 'still', false),
        who: who === null ? 'either' : who.oneOf(WHO),
      };
    }
    case 'secret_role':
      return { type, quest: r.at('quest').string(), role: r.at('role').oneOf(['informed', 'doer'] as const) };
    case 'hens_named': {
      const who = r.opt('who');
      return { type, count: optNumber(r, 'count', 1), who: who === null ? 'either' : who.oneOf(WHO) };
    }
    case 'choice_made': {
      const dialogue = r.at('dialogue').string();
      const choice = optString(r, 'choice');
      const correct = r.opt('correct');
      if (correct !== null && !correct.boolean()) r.at('correct').fail('seul « true » est permis (un choix juste)');
      const key = choice !== null ? `choice:${dialogue}:${choice}` : correct !== null ? `choice:${dialogue}:correct` : `choice:${dialogue}`;
      const cond = counter(r, key, since);
      return cond.type === 'counter' ? { type, key, count: cond.count, since: cond.since, who: cond.who } : cond;
    }
    case 'moment_seen':
      return counter(r, `moment_seen:${r.at('moment').string()}`, since);
    case 'stayed_at': {
      const who = r.opt('who');
      return {
        type,
        point: r.at('point').string(),
        seconds: r.at('seconds').number(),
        who: who === null ? 'either' : who.oneOf(WHO),
        seated: optBoolean(r, 'seated', false),
      };
    }
    // Conditions qui comptent: une clé de compteur.
    case 'sowed':
      return counter(r, `sowed${suffix(r, 'crop')}`, since);
    case 'watered':
      return counter(r, 'watered', since);
    case 'harvested': {
      const quality = r.opt('quality');
      const q = quality === null ? '' : `:q:${quality.oneOf(QUALITIES)}`;
      return counter(r, `harvested${suffix(r, 'item')}${q}`, since);
    }
    case 'chopped':
      return counter(r, 'chopped', since);
    case 'crafted':
      return counter(r, `crafted${suffix(r, 'recipe')}`, since);
    case 'given':
      return counter(r, `given:${r.at('villager').string()}${suffix(r, 'item')}`, since);
    case 'talked_to':
      return counter(r, `talked:${r.at('villager').string()}`, since);
    // 0.13 (lot H2, section 5.6): un cadeau offert (accepté), ou de ce goût (`deteste`: rendu).
    case 'gift_given': {
      const villager = r.at('villager').string();
      const taste = r.opt('taste');
      return counter(r, taste === null ? `gift:${villager}` : `gift:${villager}:${tasteLevelOf(taste)}`, since);
    }
    case 'placed':
      return counter(r, `placed${suffix(r, 'item')}`, since);
    case 'ate':
      return counter(r, `ate${suffix(r, 'item')}`, since);
    case 'ate_together':
      return counter(r, `ate_together${suffix(r, 'atFurniture')}`, since);
    case 'went_to_bed':
      return counter(r, `bed${suffix(r, 'item')}`, since);
    case 'caught':
      return counter(r, `caught${suffix(r, 'item')}`, since);
    // Pêche 0.12 (section 8.4): rare ou plus, au coin qui frémit, record battu, rendu à l'eau, guet pour l'autre.
    case 'caught_rare':
      return counter(r, 'caught_rare', since);
    case 'caught_hot_spot':
      return counter(r, 'caught_hot_spot', since);
    case 'fish_record':
      return counter(r, 'fish_record', since);
    case 'released_fish':
      return counter(r, 'released', since);
    case 'watched_for_other':
      return counter(r, 'watched_for_other', since);
    // Tour 8: cueillettes ramassées (`picked:<objet>`; sans objet, toutes les cueillettes).
    case 'picked':
      return counter(r, `picked${suffix(r, 'item')}`, since);
    case 'witnessed':
      return counter(r, `witnessed:${r.at('event').string()}`, since);
    // Tour 9: une scène à deux d'annonce jouée (`scene:<dialogue>`).
    case 'scene_played':
      return counter(r, `scene:${r.at('dialogue').string()}`, since);
    case 'annonce_active':
      return { type, gabarit: optString(r, 'gabarit'), step: optString(r, 'step') };
    case 'improvement_built':
      return { type, id: r.at('id').string() };
    case 'bought':
      return { type, item: r.at('item').string() };
    // Tour 10 (lot L4): sieste commencée, repas pris ensemble, pièce bâtie, rideaux ouverts.
    case 'napped':
      return counter(r, 'napped', since);
    case 'needs_ate_together':
      return counter(r, 'needs_ate_together', since);
    case 'room_built':
      return counter(r, `room_built${suffix(r, 'room')}`, since);
    case 'curtains_opened':
      return counter(r, 'curtains_opened', since);
    // Tour 10: passages au fauteuil de Solange (`salon_chair`, « Garder ma coiffure » compris), ou coupes qui changent quelque chose.
    case 'haircut':
      return counter(r, r.opt('changed')?.boolean() === true ? 'haircut_changed' : 'salon_chair', since);
    case 'inside': {
      const who = r.opt('who');
      return { type, building: r.at('building').string(), who: who === null ? 'either' : who.oneOf(WHO) };
    }
    case 'nights_passed':
      return counter(r, 'nights', since);
    // 0.12 (lot L-quêtes): compteur nommé, pour un système qui compte sans condition à lui (README, section 3.1).
    case 'counter':
      return counter(r, r.at('key').string(), since);
    // 0.12: compteurs tenus par la basse-cour, la chèvre, le marché et les plis (README, section 3.1).
    case 'animal_released':
      return counter(r, `animal_released:${r.at('animal').string()}`, since);
    case 'animal_named':
      return counter(r, `animal_named:${r.at('animal').string()}`, since);
    case 'brood_started':
      return counter(r, 'brood_started', since);
    case 'brood_hatched':
      return counter(r, 'brood_hatched', since);
    case 'milked':
      return counter(r, 'milked', since);
    case 'goat_grazed_spots':
      return counter(r, 'goat_grazed_spot', since);
    case 'delivered':
      return counter(r, 'mail_delivered', since);
    case 'stall_stocked':
      return counter(r, 'stall_kind', since);
    case 'given_to_stall':
      return counter(r, `stall_given${suffix(r, 'item')}`, since);
    case 'market_served':
      return counter(r, optBoolean(r, 'together', false) ? 'market_served_together' : 'market_served', since);
    case 'money_at_least':
      return { type, amount: r.at('amount').integer(0) };
    default:
      return r.at('type').fail(`type de condition inconnu « ${type} »`);
  }
}

function conditions(r: Reader | null, since: Since): Condition[] {
  return r === null ? [] : r.items().map((c) => parseCondition(c, since));
}

export function parseEffect(r: Reader): Effect {
  const type = r.at('type').string();
  switch (type) {
    case 'reveal_habit':
      return { type, villager: r.at('villager').string(), habit: r.at('habit').string() };
    case 'add_bond':
      return { type, villager: r.at('villager').string(), amount: r.at('amount').integer(0) };
    case 'reveal_taste':
      return { type, villager: r.at('villager').string(), item: r.at('item').string() };
    case 'open_decision':
      return { type, decision: r.at('decision').string() };
    case 'give_item':
      return {
        type,
        item: r.at('item').string(),
        count: optNumber(r, 'count', 1),
        to: r.at('to').oneOf(['each', 'actor', 'cellar', 'informed', 'doer'] as const),
      };
    case 'take_item':
      return {
        type,
        item: r.at('item').string(),
        count: optNumber(r, 'count', 1),
        from: r.at('from').oneOf(['actor', 'either', 'cellar'] as const),
      };
    case 'give_money':
    case 'take_money':
      return { type, amount: r.at('amount').integer(0) };
    case 'set_flag':
      return { type, flag: r.at('flag').string() };
    case 'start_quest':
      return { type, quest: r.at('quest').string() };
    case 'send_letter':
      return { type, letter: r.at('letter').string() };
    case 'unlock_recipe':
      return { type, recipe: r.at('recipe').string() };
    case 'spawn_object':
      return { type, item: r.at('item').string(), point: r.at('point').string() };
    case 'spawn_animals':
      return {
        type,
        animal: r.at('animal').string(),
        count: r.at('count').integer(1),
        names: r.at('names').stringList(),
        point: r.at('point').string(),
        shuffleVariantsBy: optString(r, 'shuffleVariantsBy'),
      };
    case 'reveal_secret':
      return { type, quest: r.at('quest').string() };
    case 'set_need':
      return {
        type,
        need: r.at('need').oneOf(['belly', 'sleep', 'heart'] as const),
        value: r.at('value').number(),
        who: r.at('who').oneOf(['both', 'actor'] as const),
      };
    case 'play_dialogue':
      return { type, dialogue: r.at('dialogue').string() };
    case 'gather_players':
      return { type, point: r.at('point').string() };
    case 'show_text':
      return { type, text: r.at('text').string() };
    case 'set_world_state':
      return { type, key: r.at('key').string(), value: r.at('value').string() };
    case 'pay_order':
      return { type };
    case 'end_demo':
      return { type: 'end_stage', stage: 'demo' };
    case 'end_stage':
      return { type, stage: r.at('stage').oneOf(STAGE_IDS) };
    case 'if':
      return {
        type,
        condition: parseCondition(r.at('condition'), 'game_start'),
        then: effects(r.opt('then')),
        else: effects(r.opt('else')),
      };
    default:
      return r.at('type').fail(`type d'effet inconnu « ${type} »`);
  }
}

function effects(r: Reader | null): Effect[] {
  return r === null ? [] : r.items().map(parseEffect);
}

// ---------------------------------------------------------------------------
// Fichiers

function parseItems(r: Reader): Record<string, ItemDef> {
  const items: Record<string, ItemDef> = {};
  for (const it of r.at('items').items()) {
    const id = it.at('id').string();
    if (id in items) it.at('id').fail(`identifiant en double « ${id} »`);
    const footprint = it.opt('footprint');
    const bed = it.opt('bed');
    const dish = it.opt('dish');
    const buy = it.opt('buyPrice');
    const sell = it.opt('sellPrice');
    const shop = it.opt('shop');
    items[id] = {
      id,
      name: it.at('name').string(),
      plural: it.at('plural').string(),
      indefinite: optText(it, 'indefinite'),
      availableFromDay: it.has('availableFromDay') ? it.at('availableFromDay').integer(1) : null,
      category: it.at('category').oneOf(CATEGORIES),
      stack: it.at('stack').integer(1, 999),
      buyPrice: buy === null || buy.isNull() ? null : buy.integer(0),
      sellPrice: sell === null || sell.isNull() ? null : sell.integer(0),
      shop: shop === null || shop.isNull() ? null : shop.oneOf(['grocery', 'catalogue', 'haberdashery'] as const),
      model: it.at('model').string(),
      tier: tier(it),
      plants: optString(it, 'plants'),
      capacity: it.has('capacity') ? it.at('capacity').integer(1) : null,
      dish: dish === null ? null : dish.oneOf(DISHES),
      readText: optString(it, 'readText'),
      footprint:
        footprint === null
          ? null
          : { w: footprint.at('w').integer(1, 8), d: footprint.at('d').integer(1, 8) },
      comfort: optNumber(it, 'comfort', 0),
      beauty: optNumber(it, 'beauty', 0),
      bed:
        bed === null
          ? null
          : { sleep: bed.at('sleep').number(), sleepers: bed.at('sleepers').integer(1, 2) },
      station: optString(it, 'station'),
      storage: optString(it, 'storage'),
      floor: optBoolean(it, 'floor', false),
      wall: optBoolean(it, 'wall', false),
      wallWidth: optNumber(it, 'wallWidth', DEFAULT_WALL_WIDTH),
      blocksWall: optBoolean(it, 'blocksWall', false),
      backToWall: optBoolean(it, 'backToWall', false),
      dining: optBoolean(it, 'dining', false),
      seat: optBoolean(it, 'seat', false),
      seatSlots: it.has('seatSlots') ? it.at('seatSlots').items().map((x) => x.number()) : [0],
      small: optBoolean(it, 'small', false),
      surface: it.has('surface') ? it.at('surface').items().map((x) => ({ x: x.at('x').number(), z: x.at('z').number() })) : [],
      light: optBoolean(it, 'light', false),
      carriedByTwo: optBoolean(it, 'carriedByTwo', false),
      tool: parseTool(it, id),
      fish: it.has('fish') ? parseFishDef(it.at('fish')) : null,
    };
  }
  return items;
}

/**
 * Outil (tour 9, section 2.4): `toolKind` écrit, sinon celui de l'outil de départ du même nom
 * (`hoe`, `watering_can`, `axe`, `fishing_rod`); `null` pour un objet qui n'est pas un outil.
 */
function parseTool(it: Reader, id: string): ToolStats | null {
  const written = it.opt('toolKind');
  const kind = written === null ? (TOOL_KINDS as readonly string[]).includes(id) ? (id as ToolKind) : null : written.oneOf(TOOL_KINDS);
  if (kind === null) {
    for (const key of ['chops', 'biteWaitFactor', 'hookWindowSeconds']) if (it.has(key)) it.at(key).fail('valeur d\'outil sans « toolKind »');
    return null;
  }
  const opt = (key: string): number | null => (it.has(key) ? positive(it.at(key)) : null);
  return {
    toolKind: kind,
    chops: it.has('chops') ? it.at('chops').integer(1, 9) : null,
    biteWaitFactor: opt('biteWaitFactor'),
    hookWindowSeconds: opt('hookWindowSeconds'),
  };
}

function stacks(r: Reader): { item: string; count: number }[] {
  return r.items().map((s) => ({ item: s.at('item').string(), count: s.at('count').integer(1) }));
}

function parseRecipes(r: Reader): Record<string, RecipeDef> {
  const recipes: Record<string, RecipeDef> = {};
  for (const it of r.at('recipes').items()) {
    const id = it.at('id').string();
    const output = it.at('output');
    recipes[id] = {
      id,
      name: it.at('name').string(),
      station: it.at('station').oneOf(['workbench', 'stove'] as const),
      inputs: stacks(it.at('inputs')),
      output: { item: output.at('item').string(), count: output.at('count').integer(1) },
      seconds: it.at('seconds').number(),
      requiresUnlock: it.at('requiresUnlock').boolean(),
    };
  }
  return recipes;
}

function parseConstructions(r: Reader): ConstructionDef[] {
  return r
    .at('constructions')
    .items()
    .map((it) => {
      const carry = it.opt('carry');
      const requires = it.opt('requires');
      return {
        id: it.at('id').string(),
        name: it.at('name').string(),
        point: it.at('point').string(),
        kind: it.at('kind').oneOf(['carry', 'guided'] as const),
        requires: requires === null ? [] : requires.stringList(),
        carry:
          carry === null ? null : { item: carry.at('item').string(), from: carry.at('from').string() },
        elements: it
          .at('elements')
          .items()
          .map((e) => ({
            id: e.at('id').string(),
            inputs: stacks(e.at('inputs')),
            seconds: e.at('seconds').number(),
          })),
      };
    });
}

function parseAnimals(r: Reader): Record<string, AnimalDef> {
  const animals: Record<string, AnimalDef> = {};
  for (const it of r.at('animals').items()) {
    const id = it.at('id').string();
    const produces = it.at('produces');
    animals[id] = {
      id,
      name: it.at('name').string(),
      variants: it.at('variants').stringList(),
      produces: { item: produces.at('item').string(), count: produces.at('count').integer(1) },
    };
  }
  return animals;
}

function parseCrops(r: Reader): { crops: Record<string, CropDef>; qualities: Record<Quality, QualityDef> } {
  const crops: Record<string, CropDef> = {};
  for (const it of r.at('crops').items()) {
    const id = it.at('id').string();
    const growthDays = it.at('growthDays').integer(1, 30);
    const stages = it
      .at('stagesByDay')
      .items()
      .map((s) => s.oneOf(STAGES));
    if (stages.length !== growthDays + 1 || stages[growthDays] !== 'ripe') {
      it.at('stagesByDay').fail('growthDays + 1 stades attendus, le dernier « ripe »');
    }
    crops[id] = {
      id,
      name: it.at('name').string(),
      seed: it.at('seed').string(),
      harvest: it.at('harvest').string(),
      growthDays,
      yieldPerCell: it.at('yieldPerCell').integer(1),
      stagesByDay: stages,
      seasons: cropSeasons(it.at('seasons')),
    };
  }
  const qualities = {} as Record<Quality, QualityDef>;
  for (const q of r.at('qualities').items()) {
    const id = q.at('id').oneOf(QUALITIES);
    qualities[id] = { id, name: q.at('name').string(), priceMultiplier: q.at('priceMultiplier').number() };
  }
  for (const q of QUALITIES) {
    if (!(q in qualities)) r.at('qualities').fail(`qualité « ${q} » absente`);
  }
  return { crops, qualities };
}

function parseLines(r: Reader): DialogueLineDef[] {
  return r.items().map((l) => ({ speaker: l.at('speaker').string(), text: l.at('text').string() }));
}

function parseDialogue(r: Reader, villager: string): DialogueDef {
  const lines: DialogueLineDef[] = [];
  let choices: DialogueChoiceDef[] = [];
  let agreement: DialogueDef['agreement'];
  const all = r.at('lines').items();
  all.forEach((line, index) => {
    if (line.has('choices')) {
      if (index !== all.length - 1) line.fail('un bloc de choix ne peut venir qu’en dernier');
      const same = line.opt('same');
      const different = line.opt('different');
      if (same !== null || different !== null) {
        agreement = { same: same === null ? [] : parseLines(same), different: different === null ? [] : parseLines(different) };
      }
      choices = line
        .at('choices')
        .items()
        .map((c) => {
          const correct = c.opt('correct');
          const wrong = c.opt('replyWrong');
          return {
            id: c.at('id').string(),
            text: c.at('text').string(),
            reply: parseLines(c.at('reply')),
            correct: correct === null ? null : parseCondition(correct, 'game_start'),
            replyWrong: wrong === null ? [] : parseLines(wrong),
            effects: effects(c.opt('effects')),
            effectsWrong: effects(c.opt('effectsWrong')),
          };
        });
    } else {
      lines.push({ speaker: line.at('speaker').string(), text: line.at('text').string() });
    }
  });
  const once = r.opt('once');
  return {
    id: r.at('id').string(),
    villager,
    kind: r.at('kind').oneOf(['scene', 'meeting', 'quest', 'daily', 'hint', 'ending'] as const),
    shared: optBoolean(r, 'shared', false),
    point: optString(r, 'point'),
    once: once === null ? null : once.oneOf(['duo', 'player'] as const),
    priority: optNumber(r, 'priority', 0),
    tier: tier(r),
    when: conditions(r.opt('when'), 'game_start'),
    lines,
    choices,
    effects: effects(r.opt('effects')),
    ...(agreement === undefined ? {} : { agreement }),
  };
}

/** Champ d'un habitant: obligatoire pour un habitant nouveau, sinon celui d'avant s'il manque. */
function villagerField<T>(v: Reader, base: VillagerDef | null, key: string, read: (r: Reader) => T, keep: (b: VillagerDef) => T): T {
  if (base === null) return read(v.at(key));
  const r = v.opt(key);
  return r === null ? keep(base) : read(r);
}

function parseBirthday(r: Reader): VillagerDef['birthday'] {
  return { season: r.at('season').oneOf(SEASONS), day: r.at('day').integer(1) };
}

function parseScheduleEntry(s: Reader): ScheduleEntry {
  return {
    when: conditions(s.opt('when'), 'game_start'),
    from: s.at('from').time(),
    to: s.at('to').time(),
    point: s.at('point').string(),
    activity: s.at('activity').string(),
    habit: optString(s, 'habit'),
  };
}

/**
 * Un habitant de `habitants.json`, ou d'`habitants-0-13.json` (0.13, README 2.12): s'il complète
 * un habitant déjà lu (`base`), chaque champ donné remplace le sien, et ses dialogues s'ajoutent.
 */
function parseVillager(v: Reader, base: VillagerDef | null, dialogues: Record<string, DialogueDef>, habitsRequired: boolean): VillagerDef {
  const id = v.at('id').string();
  const own = (v.opt('dialogues')?.items() ?? (base === null ? v.at('dialogues').items() : [])).map((d) => {
    const dialogue = parseDialogue(d, id);
    if (dialogue.id in dialogues) d.at('id').fail(`dialogue en double « ${dialogue.id} »`);
    dialogues[dialogue.id] = dialogue;
    return dialogue;
  });
  const villager: VillagerDef = {
    id,
    firstName: villagerField(v, base, 'firstName', (r) => r.string(), (b) => b.firstName),
    lastName: villagerField(v, base, 'lastName', (r) => r.string(), (b) => b.lastName),
    label: villagerField(v, base, 'label', (r) => r.string(), (b) => b.label),
    role: villagerField(v, base, 'role', (r) => r.string(), (b) => b.role),
    model: villagerField(v, base, 'model', (r) => r.string(), (b) => b.model),
    scale: villagerField(v, base, 'scale', (r) => r.number(), (b) => b.scale),
    soundMotif: villagerField(v, base, 'soundMotif', (r) => r.string(), (b) => b.soundMotif),
    schedule: villagerField(v, base, 'schedule', (r) => r.items().map(parseScheduleEntry), (b) => b.schedule),
    dialogues: [...(base?.dialogues ?? []), ...own],
    habits: base !== null ? villagerField(v, base, 'habits', parseHabits, (b) => b.habits) : parseHabits(habitsRequired ? v.at('habits') : v.opt('habits')),
    birthday: base !== null ? villagerField(v, base, 'birthday', parseBirthday, (b) => b.birthday) : v.opt('birthday') === null ? null : parseBirthday(v.at('birthday')),
    tastes: base !== null ? villagerField(v, base, 'tastes', parseTastes, (b) => b.tastes) : parseTastes(v.opt('tastes')),
    age: v.opt('age')?.string() ?? base?.age ?? null,
    homeLabel: v.opt('homeLabel')?.string() ?? base?.homeLabel ?? null,
  };
  resolveSelf(villager.schedule.flatMap((e) => e.when), id);
  for (const d of own) resolveSelf(d.when, id);
  return villager;
}

function parseVillagers(r: Reader, extra: Reader | null): { villagers: VillagerDef[]; dialogues: Record<string, DialogueDef> } {
  const dialogues: Record<string, DialogueDef> = {};
  const villagers = r
    .at('villagers')
    .items()
    .map((v) => parseVillager(v, null, dialogues, false));
  for (const v of extra?.at('villagers').items() ?? []) {
    const id = v.at('id').string();
    const at = villagers.findIndex((x) => x.id === id);
    const base = villagers[at];
    if (base === undefined) villagers.push(parseVillager(v, null, dialogues, true));
    else villagers[at] = parseVillager(v, base, dialogues, true);
  }
  const seen = new Set<string>();
  for (const v of villagers) {
    if (seen.has(v.id)) throw new ContentError(`habitants: habitant en double « ${v.id} »`);
    seen.add(v.id);
  }
  revealDialogues(villagers, dialogues);
  checkHabits(villagers);
  return { villagers, dialogues };
}

function parseStep(r: Reader): QuestStepDef {
  const resolve = r.opt('resolve');
  const deadline = r.opt('deadline');
  const byRole = r.opt('objectiveByRole');
  return {
    id: r.at('id').string(),
    objective: r.at('objective').string(),
    objectiveByRole: byRole === null ? null : { informed: byRole.at('informed').string(), doer: byRole.at('doer').string() },
    conditions: conditions(r.opt('conditions'), 'step_start'),
    effects: effects(r.opt('effects')),
    resolve: resolve === null ? 'on_conditions' : resolve.oneOf(['at_deadline'] as const),
    deadline:
      deadline === null ? null : { day: deadline.at('day').integer(1), time: deadline.at('time').time() },
    onDeadline: effects(r.opt('onDeadline')),
    failText: optString(r, 'failText'),
  };
}

function parseQuests(r: Reader): QuestDef[] {
  return r
    .at('quests')
    .items()
    .map((q): QuestDef => {
      const start = q.at('start');
      return {
        id: q.at('id').string(),
        kind: q.at('kind').oneOf(['main', 'side'] as const),
        tier: tier(q),
        title: q.at('title').string(),
        giver: q.at('giver').string(),
        story: parseStory(q.opt('story')),
        start: {
          when: conditions(start.opt('when'), 'game_start'),
          byEffect: optBoolean(start, 'byEffect', false),
          effects: effects(start.opt('effects')),
        },
        steps: q.at('steps').items().map(parseStep),
        completionEffects: effects(q.opt('completionEffects')),
        completionText: q.at('completionText').string(),
        secret: parseSecret(q.opt('secret')),
        repeat: q.has('repeat') ? q.at('repeat').oneOf(['each_train'] as const) : null,
        expire: parseExpire(q.opt('expire')),
      };
    });
}

/** 0.13 (section 5.5): l'étape de l'histoire d'un habitant que porte la quête. */
function parseStory(r: Reader | null): QuestDef['story'] {
  if (r === null) return null;
  return { villager: r.at('villager').string(), step: r.at('step').integer(1) };
}

/** Goût des conditions `gift_given` (`adore`, `aime`, `neutre`, `deteste`, section 5.6). */
function tasteLevelOf(r: Reader): TasteLevel {
  const french = { adore: 'loves', aime: 'likes', neutre: 'neutral', deteste: 'dislikes' } as const;
  return french[r.oneOf(['adore', 'aime', 'neutre', 'deteste'] as const)];
}

/** 0.12: retrait sans reproche d'une quête au premier jour de la semaine et à l'heure donnés après son démarrage. */
function parseExpire(r: Reader | null): QuestDef['expire'] {
  if (r === null) return null;
  return { weekday: WEEKDAYS.indexOf(r.at('weekday').oneOf(WEEKDAYS)), time: r.at('time').time(), text: r.at('text').string() };
}

function parseSecret(r: Reader | null): QuestSecretDef | null {
  if (r === null) return null;
  const of = r.at('of').integer(1, 99);
  const card = r.at('card');
  const raw = card.at('lines').items();
  const nested = raw.length > 0 && raw.every((l) => Array.isArray(l.value));
  const lines: string[] | string[][] = nested ? raw.map((l) => l.stringList()) : raw.map((l) => l.string());
  if (nested && lines.length !== of) card.at('lines').fail(`une liste de lignes par variante attendue (${of})`);
  const reveal = r.opt('revealOn');
  return {
    id: r.at('id').string(),
    informed: r.at('informed').oneOf(['turn', ...CHARACTERS] as const),
    variantGroup: r.at('variantGroup').string(),
    of,
    card: { title: card.at('title').string(), lines },
    revealOn: reveal === null ? null : parseCondition(reveal, 'game_start'),
    nudge: optString(r, 'nudge'),
    vignette: optString(r, 'vignette'),
  };
}

// ---------------------------------------------------------------------------
// Moments rares (`moments.json`)

function pair(r: Reader): [number, number] {
  const list = r.numberList();
  const [a, b] = list;
  if (list.length !== 2 || a === undefined || b === undefined) return r.fail('deux nombres attendus');
  return [a, b];
}

function keyframe(r: Reader): MomentKeyframe {
  const [t, x, y, z, clip, heading, ...rest] = r.items();
  if (t === undefined || x === undefined || y === undefined || z === undefined || clip === undefined || rest.length > 0) {
    return r.fail('image clé [t, x, y, z, clip] ou [t, x, y, z, clip, cap] attendue');
  }
  const frame: MomentKeyframe = [t.number(), x.isNull() ? null : x.number(), y.isNull() ? null : y.number(), z.number(), clip.isNull() ? null : clip.string()];
  if (heading !== undefined) frame.push(heading.number());
  return frame;
}

function timedSounds(r: Reader | null): [number, string][] {
  if (r === null || r.isNull()) return [];
  return r.items().map((s): [number, string] => {
    const [t, id] = s.items();
    if (t === undefined || id === undefined) return s.fail('[t, son] attendu');
    return [t.number(), id.string()];
  });
}

function choreography(r: Reader | null): MomentChoreography | null {
  if (r === null || r.isNull()) return null;
  const keyframes: Record<string, MomentKeyframe[]> = {};
  for (const [actor, list] of r.at('keyframes').entries()) {
    const frames = list.items().map(keyframe);
    frames.forEach((f, i) => {
      const before = frames[i - 1];
      if (before !== undefined && f[0] < before[0]) list.fail("images clés attendues dans l'ordre du temps");
    });
    keyframes[actor] = frames;
  }
  const formation = r.opt('formation');
  const grade = r.opt('lightGrade');
  return {
    seconds: r.at('seconds').number(),
    keyframes,
    fadeLastSeconds: optNumber(r, 'fadeLastSeconds', 0),
    sounds: timedSounds(r.opt('sounds')),
    lookers: r.opt('lookers')?.stringList() ?? [],
    pauseWhenReleased: optBoolean(r, 'pauseWhenReleased', false),
    pauseBefore: optNumber(r, 'pauseBefore', 0),
    formation:
      formation === null || formation.isNull()
        ? null
        : {
            fromSeconds: formation.at('fromSeconds').number(),
            toSeconds: formation.at('toSeconds').number(),
            spacing: formation.at('spacing').number(),
            armAngleDeg: formation.at('armAngleDeg').number(),
          },
    lightGrade:
      grade === null || grade.isNull()
        ? null
        : {
            color: grade.at('color').string(),
            force: grade.at('force').number(),
            inSeconds: grade.at('inSeconds').number(),
            outSeconds: grade.at('outSeconds').number(),
          },
  };
}

function freeze(r: Reader | null): MomentFreeze | null {
  if (r === null || r.isNull()) return null;
  const every = pair(r.at('everySeconds'));
  if (every[0] <= 0 || every[1] < every[0]) r.at('everySeconds').fail('intervalle [min, max] positif attendu');
  return {
    actor: r.at('actor').string(),
    everySeconds: every,
    lookSeconds: r.at('lookSeconds').number(),
    lookClip: r.at('lookClip').string(),
    firstAfterSeconds: optNumber(r, 'firstAfterSeconds', every[0]),
    startleBack: r.at('startleBack').number(),
    startleToward: pair(r.at('startleToward')),
    startleClip: r.at('startleClip').string(),
    startleSeconds: optNumber(r, 'startleSeconds', 0.5),
    resumeAfterSeconds: r.at('resumeAfterSeconds').number(),
    walkSpeed: optNumber(r, 'walkSpeed', 0.8),
    walkClip: optString(r, 'walkClip') ?? 'walk',
    sounds: timedSounds(r.opt('sounds')),
    startleText: optString(r, 'startleText'),
  };
}

function watch(r: Reader): MomentWatch {
  const bench = r.opt('bench');
  const hold = r.opt('hold');
  const opposite = r.opt('opposite');
  // `"facing": "partner"`: se faire face; `true`: regarder la cible.
  // Lu par `oneOf`: toute autre chaîne que « partner » est refusée.
  const facingPartner = r.has('facing') && typeof r.at('facing').value === 'string' && r.at('facing').oneOf(['partner'] as const).length > 0;
  const w: MomentWatch = {
    radius: r.at('radius').number(),
    minRadius: optNumber(r, 'minRadius', 0),
    holdSeconds: r.at('holdSeconds').number(),
    still: optBoolean(r, 'still', false),
    facing: facingPartner ? false : optBoolean(r, 'facing', false),
    facingPartner,
    opposite:
      opposite === null || opposite.isNull()
        ? null
        : { axis: opposite.at('axis').oneOf(['x', 'y'] as const), at: opposite.at('at').number(), gap: opposite.at('gap').number() },
    freeze: freeze(r.opt('freeze')),
    seated: optBoolean(r, 'seated', false),
    bench: bench === null || bench.isNull() ? null : bench.string(),
    hold: hold === null || hold.isNull() ? null : hold.stringList(),
    target: optString(r, 'target') ?? 'anchor',
    closeTogether: r.has('closeTogether') && !r.at('closeTogether').isNull() ? positive(r.at('closeTogether')) : null,
    syncPress: parseSyncPress(r.opt('syncPress')),
    arm: parseArm(r.opt('arm')),
  };
  if (w.minRadius > w.radius) r.at('minRadius').fail('minRadius au plus égal à radius');
  if (w.seated && w.bench === null) r.at('bench').fail('banc attendu quand « seated » est vrai');
  return w;
}

/** Allumages à deux (tour 9, les lanternes): deux places, un écart permis. */
function parseSyncPress(r: Reader | null): MomentWatch['syncPress'] {
  if (r === null || r.isNull()) return null;
  const places = r.at('places').stringList();
  if (places.length !== 2 || places[0] === places[1]) r.at('places').fail('deux places différentes attendues');
  return { places, gapSeconds: positive(r.at('gapSeconds')) };
}

/** Armement (tour 9, le salut du mécanicien): descente des lisses, heure de l'apogée, cases fermées. */
function parseArm(r: Reader | null): MomentWatch['arm'] {
  if (r === null || r.isNull()) return null;
  const cells = r.at('cells');
  const toward = pair(r.at('pushToward'));
  return {
    seconds: positive(r.at('seconds')),
    climaxAt: r.at('climaxAt').time(),
    liftAt: positive(r.at('liftAt')),
    cells: { x: cells.at('x').integer(0), y: cells.at('y').integer(0), w: cells.at('w').integer(1), h: cells.at('h').integer(1) },
    pushToward: toward,
  };
}

function span(r: Reader): { from: number; to: number } {
  const from = r.at('from').time();
  const to = r.at('to').time();
  if (to <= from) r.at('to').fail('« to » après « from » attendu');
  return { from, to };
}

function parseActor(a: Reader): MomentDef['actors'][number] {
  const shy = a.opt('shy');
  const extra = a.opt('idleExtra');
  const offsets = a.opt('offsets');
  const count = a.has('count') ? a.at('count').integer(1) : 1;
  const list = offsets === null || offsets.isNull() ? [] : offsets.items().map(pair);
  if (count > 1 && list.length !== count) a.at('offsets').fail(`un décalage par membre du groupe attendu (${count})`);
  return {
    id: a.at('id').string(),
    model: a.at('model').string(),
    count,
    at: a.at('at').string(),
    offsets: list,
    facing: optNumber(a, 'facing', 0),
    idle: a.at('idle').string(),
    idleExtra:
      extra === null || extra.isNull()
        ? null
        : {
            clip: extra.at('clip').string(),
            everySeconds: pair(extra.at('everySeconds')),
            segment: extra.has('segment') && !extra.at('segment').isNull() ? pair(extra.at('segment')) : null,
            sounds: timedSounds(extra.opt('sounds')),
          },
    z: optNumber(a, 'z', 0),
    arrive: choreography(a.opt('arrive')),
    collisionRadius: optNumber(a, 'collisionRadius', 0),
    roam: optNumber(a, 'roam', 0),
    shy:
      shy === null || shy.isNull()
        ? null
        : {
            distance: shy.at('distance').number(),
            clip: shy.at('clip').string(),
            stepTo: shy.has('stepTo') && !shy.at('stepTo').isNull() ? pair(shy.at('stepTo')) : null,
            stepClip: optString(shy, 'stepClip'),
            returnAfterSeconds: shy.at('returnAfterSeconds').number(),
            hideAway: optBoolean(shy, 'hideAway', false),
            sounds: timedSounds(shy.opt('sounds')),
          },
    villager: optString(a, 'villager'),
    keepFacing: optBoolean(a, 'keepFacing', false),
  };
}

function parseMoment(m: Reader): MomentDef {
  const mode = m.at('mode').oneOf(['quest', 'ambient', 'both'] as const);
  const quest = optString(m, 'quest');
  if (mode !== 'ambient' && quest === null) m.at('quest').fail('quête attendue pour un moment « quest » ou « both »');
  const present = span(m.at('present'));
  const window = span(m.at('window'));
  if (window.from < present.from || window.to > present.to) m.at('window').fail('fenêtre incluse dans « present » attendue');
  const questWatch = m.opt('questWatch');
  const after = m.opt('after');
  const texts = m.at('texts');
  const reward = m.at('reward');
  const max = m.opt('maxPerSeason');
  const climax = choreography(m.at('climax'));
  if (climax === null) return m.at('climax').fail('apogée attendue');
  const actors = m.at('actors').items().map(parseActor);
  const def: MomentDef = {
    id: m.at('id').string(),
    tier: tier(m),
    name: m.at('name').string(),
    mode,
    quest,
    questStep: optString(m, 'questStep'),
    anchor: m.at('anchor').string(),
    weight: m.at('weight').integer(0),
    maxPerSeason: max === null || max.isNull() ? null : max.integer(1),
    cooldownDays: m.has('cooldownDays') && !m.at('cooldownDays').isNull() ? m.at('cooldownDays').integer(1) : null,
    longCooldownDays: m.has('longCooldownDays') && !m.at('longCooldownDays').isNull() ? m.at('longCooldownDays').integer(1) : null,
    trainDays: m.has('trainDays') ? m.at('trainDays').oneOf(['never', 'only'] as const) : 'never',
    availableWhen: conditions(m.opt('availableWhen'), 'game_start'),
    present,
    window,
    watch: watch(m.at('watch')),
    questWatch: questWatch === null || questWatch.isNull() ? null : watch(questWatch),
    actors,
    climax,
    after:
      after === null || after.isNull()
        ? null
        : {
            actors: Object.fromEntries(
              (after.opt('actors')?.entries() ?? []).map(([k, v]) => [k, { at: optString(v, 'at'), idle: optString(v, 'idle') }]),
            ),
          },
    leave: choreography(m.opt('leave')),
    sounds: {
      idle: (m.opt('sounds')?.opt('idle')?.items() ?? []).map((s) => ({
        id: s.at('id').string(),
        everySeconds: pair(s.at('everySeconds')),
        range: s.at('range').number(),
      })),
    },
    texts: {
      hint: optString(texts, 'hint'),
      climax: texts.at('climax').string(),
      memory: texts.at('memory').string(),
      rumor: optString(texts, 'rumor'),
      vignette: optString(texts, 'vignette'),
      missed: optString(texts, 'missed'),
    },
    vignette: optString(m, 'vignette'),
    hintFrom: optString(m, 'hintFrom'),
    reward: { heart: optNumber(reward, 'heart', 0), money: optNumber(reward, 'money', 0) },
    effects: effects(m.opt('effects')),
    render: m.has('render') && m.at('render').isObject() ? (m.at('render').value as Record<string, unknown>) : {},
  };
  for (const w of [def.watch, def.questWatch]) {
    if (w !== null && w.target !== 'anchor' && !actors.some((a) => a.id === w.target)) {
      m.at('watch').fail(`cible « ${w.target} »: ni « anchor » ni un acteur du moment`);
    }
    const frozen = w === null ? null : w.freeze;
    if (frozen !== null && !actors.some((a) => a.id === frozen.actor)) m.at('watch').fail(`« freeze »: acteur inconnu « ${frozen.actor} »`);
  }
  return def;
}

function parseMoments(r: Reader): MomentDef[] {
  const seen = new Set<string>();
  return r
    .at('moments')
    .items()
    .map((m) => {
      const def = parseMoment(m);
      if (seen.has(def.id)) m.at('id').fail(`moment en double « ${def.id} »`);
      seen.add(def.id);
      return def;
    });
}

function parseLetters(r: Reader): { letters: Record<string, LetterDef>; senders: Record<string, string> } {
  const letters: Record<string, LetterDef> = {};
  for (const l of r.at('letters').items()) {
    const id = l.at('id').string();
    const delivery = l.at('delivery');
    const variants = l.opt('variants');
    const parsedVariants =
      variants === null
        ? []
        : variants.items().map((v) => ({ when: conditions(v.opt('when'), 'game_start'), text: v.at('text').string() }));
    const text = optString(l, 'text') ?? parsedVariants.at(-1)?.text ?? l.at('text').string();
    const instance = delivery.opt('instance');
    if (id.includes('@')) l.at('id').fail('« @ » est réservé aux lettres hebdomadaires');
    letters[id] = {
      id,
      from: l.at('from').string(),
      title: l.at('title').string(),
      delivery:
        delivery.has('byEffect') || instance !== null ? null : { day: delivery.at('day').integer(1), time: delivery.at('time').time() },
      instance:
        instance === null
          ? null
          : { kind: instance.oneOf(['train'] as const), time: delivery.has('byEffect') ? null : delivery.at('time').time() },
      text,
      variants: parsedVariants,
      variantsNoRepeat: optBoolean(l, 'variantsNoRepeat', false),
    };

  }
  const senders: Record<string, string> = {};
  for (const s of r.at('senders').items()) {
    senders[s.at('id').string()] = s.at('label').string();
  }
  return { letters, senders };
}

function parseTrigger(r: Reader): HintTrigger {
  const on = r.at('on').string();
  switch (on) {
    case 'spawned':
    case 'near_interactable':
    case 'tool_used':
    case 'near_construction':
    case 'sowed':
    case 'crop_ripe_in_view':
    case 'veillee_started':
    case 'holding_furniture':
    case 'big_purchase_attempt':
    case 'letter_received':
    case 'near_forage':
    case 'aim_sapling':
    case 'near_board_annonce':
    case 'fishing_hot_spot':
    case 'fishing_watch':
      return { on };
    case 'near_point':
      return { on, point: r.at('point').string() };
    case 'quest_started':
      return { on, quest: r.at('quest').string() };
    case 'tool_empty':
      return { on, item: r.at('item').string() };
    case 'time_reached':
      return { on, time: r.at('time').time() };
    case 'aim_cell': {
      const tool = optString(r, 'tool');
      const holding = optString(r, 'holding');
      const trigger: HintTrigger = { on, cellState: r.at('cellState').oneOf(['grass', 'tilled'] as const) };
      if (tool !== null) trigger.tool = tool;
      if (holding !== null) trigger.holding = holding;
      return trigger;
    }
    default:
      return r.at('on').fail(`déclencheur inconnu « ${on} »`);
  }
}

function parseHints(r: Reader): HintDef[] {
  return r
    .at('hints')
    .items()
    .map((h) => ({ id: h.at('id').string(), text: h.at('text').string(), trigger: parseTrigger(h.at('trigger')), tier: tier(h) }));
}

function parseEnvies(r: Reader): { envies: EnvieDef[]; schedule: { day: number; envie: string }[] } {
  const envies = r
    .at('envies')
    .items()
    .map(
      (e): EnvieDef => ({
        id: e.at('id').string(),
        kind: e.at('kind').oneOf(['personal', 'shared'] as const),
        text: e.at('text').string(),
        availableWhen: conditions(e.opt('availableWhen'), 'day_start'),
        fulfilledWhen: conditions(e.opt('fulfilledWhen'), 'day_start'),
      }),
    );
  const scheduleReader = r.opt('sharedSchedule');
  const schedule =
    scheduleReader === null
      ? []
      : scheduleReader.items().map((s) => ({ day: s.at('day').integer(1), envie: s.at('envie').string() }));
  return { envies, schedule };
}

function parseTexts(r: Reader): Texts {
  const messages: Record<string, string> = {};
  for (const [key, value] of r.at('messages').entries()) {
    messages[key] = value.string();
  }
  const weather: Record<string, string> = {};
  for (const [key, value] of r.at('weather').entries()) {
    weather[key] = value.string();
  }
  const format = r.at('orderFormat');
  return {
    form: r
      .at('form')
      .items()
      .map((f) => ({ level: f.at('level').string(), name: f.at('name').string(), text: f.at('text').string() })),
    messages,
    orderFormat: {
      line: format.at('line').string(),
      separator: format.at('separator').string(),
      lastSeparator: format.at('lastSeparator').string(),
    },
    weekdays: r.at('weekdays').stringList(),
    weather,
    raw: r.value as Record<string, unknown>,
  };
}

function parseFeel(r: Reader | null): FeelSettings {
  const feel: FeelSettings = {
    ...DEFAULT_FEEL,
    actionSeconds: { ...DEFAULT_FEEL.actionSeconds },
    fishWeights: { ...DEFAULT_FEEL.fishWeights },
    fishWeightsBySeason: {},
    steppingStoneVillagers: [...DEFAULT_FEEL.steppingStoneVillagers],
  };
  if (r === null) return feel;
  const actions = r.opt('actionSeconds');
  if (actions !== null) {
    for (const [key, value] of actions.entries()) feel.actionSeconds[key] = value.number();
  }
  const fish = r.opt('fishWeights');
  if (fish !== null) {
    feel.fishWeights = {};
    for (const [key, value] of fish.entries()) feel.fishWeights[key] = value.number();
  }
  const bySeasonReader = r.opt('fishWeightsBySeason');
  if (bySeasonReader !== null) {
    feel.fishWeightsBySeason = {};
    for (const [season, weights] of bySeasonReader.entries()) {
      const key = SEASONS.find((x) => x === season);
      if (key === undefined) bySeasonReader.at(season).fail(`saison inconnue « ${season} »`);
      const table: Record<string, number> = {};
      for (const [item, value] of weights.entries()) table[item] = value.number();
      if (key !== undefined) feel.fishWeightsBySeason[key] = table;
    }
  }
  const stones = r.opt('steppingStoneVillagers');
  if (stones !== null) feel.steppingStoneVillagers = stones.stringList();
  const numeric: (keyof Omit<FeelSettings, 'actionSeconds' | 'fishWeights' | 'fishWeightsBySeason' | 'steppingStoneVillagers'>)[] = [
    'trainSlideSeconds',
    'pointRadius',
    'beamGrabRange',
    'beamDropRadius',
    'villagerSpeed',
    'henSpeed',
    'alreadyTakenSeconds',
    'dailyStoryPriority',
    'inputBufferSeconds',
    'heldRepeatSeconds',
    'notificationsKept',
    'trainWarningMinutes',
    'pinSeconds',
  ];
  for (const key of numeric) {
    feel[key] = optNumber(r, key, feel[key]);
  }
  return feel;
}

/** Bancs (`reglages.benches`): chaque clé absente garde sa valeur de `defauts.ts`. */
function parseBenches(r: Reader | null): Settings['benches'] {
  const d = DEFAULT_BENCHES;
  if (r === null) return { ...d, slots: [...d.slots] };
  const slotsReader = r.opt('slots');
  const slots = slotsReader === null ? [...d.slots] : slotsReader.numberList();
  // Une place par bit dans le masque des places prises (`etat/bancs.ts`).
  if (slots.length < 1 || slots.length > 8) return r.at('slots').fail('de 1 à 8 places attendues');
  return {
    slots,
    seatForward: optNumber(r, 'seatForward', d.seatForward),
    standForward: optNumber(r, 'standForward', d.standForward),
    sitRange: optNumber(r, 'sitRange', d.sitRange),
    villagerReach: optNumber(r, 'villagerReach', d.villagerReach),
  };
}

/** Moments rares (`reglages.moments`): chaque clé absente garde sa valeur de `defauts.ts`. */
function parseMomentSettings(r: Reader | null): Settings['moments'] {
  const d = DEFAULT_MOMENTS;
  if (r === null) return { ...d, tiers: [...d.tiers], festivalDays: [...d.festivalDays] };
  const first = r.opt('firstHint');
  const tiers = r.opt('tiers');
  const chance = optNumber(r, 'dailyChance', d.dailyChance);
  if (chance < 0 || chance > 1) r.at('dailyChance').fail('probabilité de 0 à 1 attendue');
  return {
    dailyChance: chance,
    maxPerDay: r.has('maxPerDay') ? r.at('maxPerDay').integer(0, 1) : d.maxPerDay,
    cooldownDays: r.has('cooldownDays') ? r.at('cooldownDays').integer(1) : d.cooldownDays,
    firstAmbientDay: r.has('firstAmbientDay') ? r.at('firstAmbientDay').integer(1) : d.firstAmbientDay,
    noAmbientOnTrainDays: optBoolean(r, 'noAmbientOnTrainDays', d.noAmbientOnTrainDays),
    stillSpeed: optNumber(r, 'stillSpeed', d.stillSpeed),
    noticeRadius: optNumber(r, 'noticeRadius', d.noticeRadius),
    heartBonus: optNumber(r, 'heartBonus', d.heartBonus),
    musicDuckDb: optNumber(r, 'musicDuckDb', d.musicDuckDb),
    musicDuckInSeconds: optNumber(r, 'musicDuckInSeconds', d.musicDuckInSeconds),
    musicDuckOutSeconds: optNumber(r, 'musicDuckOutSeconds', d.musicDuckOutSeconds),
    firstHint: first === null ? d.firstHint : first.oneOf(CHARACTERS),
    maxSyncGapSeconds: optNumber(r, 'maxSyncGapSeconds', d.maxSyncGapSeconds),
    holdRange: optNumber(r, 'holdRange', d.holdRange),
    tiers: tiers === null ? [...d.tiers] : tiers.items().map((t) => t.oneOf(TIERS)),
    noAmbientOnFestivalDays: optBoolean(r, 'noAmbientOnFestivalDays', d.noAmbientOnFestivalDays),
    festivalDays: r.has('festivalDays') ? r.at('festivalDays').numberList() : [...d.festivalDays],
    cooldownDaysLong: r.has('cooldownDaysLong') ? r.at('cooldownDaysLong').integer(1) : d.cooldownDaysLong,
    longFromDay: r.has('longFromDay') ? r.at('longFromDay').integer(1) : d.longFromDay,
    seasonPoolFull: r.has('seasonPoolFull') ? r.at('seasonPoolFull').integer(1) : d.seasonPoolFull,
    unseenWeightFactor: optNumber(r, 'unseenWeightFactor', d.unseenWeightFactor),
  };
}

/** Souvenirs (`reglages.memories`, tour 7): chaque clé absente garde sa valeur de `defauts.ts`. */
function parseMemorySettings(r: Reader | null, calendar: Settings['calendar']): Settings['memories'] {
  // Le calendrier des souvenirs est celui de `reglages.calendar` (une seule source, tour 8).
  const d = DEFAULT_MEMORIES;
  return { seasonDays: calendar.seasonDays, seasonsPerYear: calendar.seasonsPerYear, maxBytes: r?.has('maxBytes') === true ? r.at('maxBytes').integer(1) : d.maxBytes };
}


/** Informations propres (`reglages.secrets`): chaque clé absente garde sa valeur de `defauts.ts`. */
function parseSecretSettings(r: Reader | null): Settings['secrets'] {
  const d = DEFAULT_SECRETS;
  if (r === null) return { ...d };
  const first = r.opt('firstInformed');
  return {
    firstInformed: first === null ? d.firstInformed : first.oneOf(CHARACTERS),
    nudgeAfterErrors: r.has('nudgeAfterErrors') ? r.at('nudgeAfterErrors').integer(1) : d.nudgeAfterErrors,
    firstTryHeart: optNumber(r, 'firstTryHeart', d.firstTryHeart),
    henChoiceRange: optNumber(r, 'henChoiceRange', d.henChoiceRange),
    henChoiceKeepOpen: optNumber(r, 'henChoiceKeepOpen', d.henChoiceKeepOpen),
    hideFromGuestSnapshot: optBoolean(r, 'hideFromGuestSnapshot', d.hideFromGuestSnapshot),
    knownHensFlag: optString(r, 'knownHensFlag') ?? d.knownHensFlag,
  };
}

/** Arbres (tour 8, section 5.1): sans `regrow`, une souche reste une souche (la démo). */
function parseTrees(r: Reader): Settings['trees'] {
  const d = DEFAULT_TREES;
  const scale = r.opt('saplingScale');
  const trees: Settings['trees'] = {
    chopsPerTree: r.at('chopsPerTree').integer(1),
    logsPerTree: r.at('logsPerTree').integer(1),
    regrow: optBoolean(r, 'regrow', false),
    regrowFromDay: r.has('regrowFromDay') ? r.at('regrowFromDay').integer(1) : d.regrowFromDay,
    catchUpDays: r.has('catchUpDays') ? r.at('catchUpDays').integer(0) : d.catchUpDays,
    stumpDays: r.has('stumpDays') ? r.at('stumpDays').integer(0) : d.stumpDays,
    saplingDays: r.has('saplingDays') ? r.at('saplingDays').integer(0) : d.saplingDays,
    saplingScale:
      scale === null
        ? { ...d.saplingScale }
        : { first: probability(scale.at('first')), perDay: scale.at('perDay').number(), max: probability(scale.at('max')) },
  };
  if (trees.saplingScale.max < trees.saplingScale.first) r.at('saplingScale').fail('« max » au moins égal à « first »');
  return trees;
}

/** Envies (HA-07, tour 8 section 5.4): chaque clé absente garde sa valeur de `defauts.ts`. */
function parseEnvieSettings(r: Reader | null): Settings['envies'] {
  const d = DEFAULT_ENVIES;
  if (r === null) return { ...d };
  const from = r.opt('sharedFromDay');
  return {
    noRepeatWindowDays: r.has('noRepeatWindowDays') ? r.at('noRepeatWindowDays').integer(1) : d.noRepeatWindowDays,
    unseenFactor: optNumber(r, 'unseenFactor', d.unseenFactor),
    sharedFromDay: from === null || from.isNull() ? d.sharedFromDay : from.integer(1),
    sharedEveryDays: r.has('sharedEveryDays') ? r.at('sharedEveryDays').integer(1) : d.sharedEveryDays,
    sharedNoRepeatDays: r.has('sharedNoRepeatDays') ? r.at('sharedNoRepeatDays').integer(0) : d.sharedNoRepeatDays,
  };
}

/** Répliques du quotidien (tour 8, section 5.5). */
function parseDialogueSettings(r: Reader | null): Settings['dialogues'] {
  const d = DEFAULT_DIALOGUES;
  if (r === null) return { ...d };
  return {
    datedRepeatDays: r.has('datedRepeatDays') ? r.at('datedRepeatDays').integer(0) : d.datedRepeatDays,
    datedRepeatFromDay: r.has('datedRepeatFromDay') ? r.at('datedRepeatFromDay').integer(1) : d.datedRepeatFromDay,
  };
}

/** Rangement de la nuit (QA8-02). */
function parseTidySettings(r: Reader | null): Settings['tidy'] {
  const from = r?.opt('fromDay') ?? null;
  return { fromDay: from === null || from.isNull() ? DEFAULT_TIDY.fromDay : from.integer(1) };
}

function parseFishing(r: Reader | null): Settings['fishing'] {
  if (r === null) return null;
  const wait = r.at('biteWaitSeconds').numberList();
  const min = wait[0];
  const max = wait[1];
  if (wait.length !== 2 || min === undefined || max === undefined || min > max) return r.at('biteWaitSeconds').fail('[min, max] attendu');
  return {
    castRange: r.at('castRange').number(),
    castDistance: r.has('castDistance') ? r.at('castDistance').number() : null,
    castShoreMargin: r.has('castShoreMargin') ? r.at('castShoreMargin').number() : 0.5,
    biteWaitSeconds: [min, max],
    hookWindowSeconds: r.at('hookWindowSeconds').number(),
    flag: r.at('flag').string(),
    rules: parseFishingRules(r),
  };
}

/** Saisons des semis: au moins une, sans doublon. */
function cropSeasons(r: Reader): Season[] {
  const seasons = seasonList(r);
  if (seasons.length === 0 || new Set(seasons).size !== seasons.length) return r.fail('au moins une saison, sans doublon');
  return seasons;
}

/** Liste de saisons (`["spring", "summer"]`). */
function seasonList(r: Reader): Season[] {
  return r.items().map((s) => s.oneOf(SEASONS));
}

/** Une valeur par saison (`{ "spring": ..., ... }`), toutes présentes. */
function bySeason<T>(r: Reader, read: (x: Reader) => T): Record<Season, T> {
  return { spring: read(r.at('spring')), summer: read(r.at('summer')), autumn: read(r.at('autumn')), winter: read(r.at('winter')) };
}

function odds(r: Reader, sumTo100: boolean): WeatherOdds {
  const list = r.numberList();
  const [sunny, cloudy, rain] = list;
  if (list.length !== 3 || sunny === undefined || cloudy === undefined || rain === undefined) return r.fail('[soleil, nuages, pluie] attendu');
  if (list.some((x) => x < 0)) return r.fail('valeurs positives attendues');
  if (sumTo100 && Math.abs(sunny + cloudy + rain - 100) > 1e-9) return r.fail('somme de 100 attendue');
  return [sunny, cloudy, rain];
}

function positive(r: Reader): number {
  const x = r.number();
  if (x <= 0) r.fail('valeur positive attendue');
  return x;
}

function probability(r: Reader): number {
  const p = r.number();
  if (p < 0 || p > 1) r.fail('probabilité de 0 à 1 attendue');
  return p;
}

/**
 * Calendrier (`reglages.calendar`, tour 8): seule source des saisons. Les anciennes clés
 * `memories.seasonDays` et `memories.seasonsPerYear` restent lues si `calendar` manque, jamais
 * les deux à la fois.
 */
function parseCalendar(r: Reader): Settings['calendar'] {
  const calendar = r.opt('calendar');
  const memories = r.opt('memories');
  const old = memories !== null && (memories.has('seasonDays') || memories.has('seasonsPerYear'));
  if (calendar !== null && old) return r.at('memories').fail('saisons à lire dans « calendar » seulement (retirer seasonDays et seasonsPerYear)');
  const from = calendar ?? memories;
  const d = DEFAULT_MEMORIES;
  return {
    seasonDays: from?.has('seasonDays') === true ? from.at('seasonDays').integer(1) : d.seasonDays,
    seasonsPerYear: from?.has('seasonsPerYear') === true ? from.at('seasonsPerYear').integer(1) : d.seasonsPerYear,
  };
}

/** Rythme de la journée (`clock.pace`, R14); absent: normal, sans facteur. */
function parsePace(clock: Reader): Pick<Settings['clock'], 'pace' | 'paces'> {
  const r = clock.opt('paces');
  const paces: Record<ClockPace, number> = { vif: 1, normal: 1, paisible: 1 };
  if (r !== null) {
    for (const id of CLOCK_PACES) {
      const factor = r.at(id).number();
      if (factor <= 0) r.at(id).fail('facteur positif attendu');
      paces[id] = factor;
    }
  }
  const pace = clock.opt('pace')?.oneOf(CLOCK_PACES) ?? 'normal';
  return { pace, paces };
}

const CLOCK_PACES = ['vif', 'normal', 'paisible'] as const;

/** Rythme par jour (`clock.schedule`, D1); absent: le rythme du jour 1 partout. */
function parseSchedule(clock: Reader, base: number): Settings['clock']['schedule'] {
  const r = clock.opt('schedule');
  if (r === null) return [{ fromDay: 1, secondsPerGameMinute: base }];
  let previous = 0;
  const steps = r.items().map((s) => {
    const fromDay = s.at('fromDay').integer(1);
    if (fromDay <= previous) s.at('fromDay').fail('pas attendus dans l\'ordre des jours');
    previous = fromDay;
    const spm = s.at('secondsPerGameMinute').number();
    if (spm <= 0) s.at('secondsPerGameMinute').fail('valeur positive attendue');
    return { fromDay, secondsPerGameMinute: spm };
  });
  const first = steps[0];
  if (first?.fromDay !== 1) return r.fail('le premier pas commence au jour 1');
  if (first.secondsPerGameMinute !== base) return r.at('0').fail('le premier pas vaut clock.secondsPerGameMinute');
  return steps;
}

function parseStages(r: Reader | null, lastDay: { day: number; end: number }): Settings['stages'] {
  // Sans étapes écrites: une seule, la fin de la démo, à la limite de la partie.
  if (r === null) return [{ id: 'demo', day: lastDay.day, time: lastDay.end, texts: 'demo' }];
  let previous = 0;
  const stages = r.items().map((s) => {
    const day = s.at('day').integer(1);
    if (day <= previous) s.at('day').fail('étapes attendues dans l\'ordre des jours');
    previous = day;
    return { id: s.at('id').oneOf(STAGE_IDS), day, time: s.at('time').time(), texts: s.at('texts').oneOf(STAGE_IDS) };
  });
  if (new Set(stages.map((s) => s.id)).size !== stages.length) r.fail('étape en double');
  const last = stages[stages.length - 1];
  if (last !== undefined && (last.day > lastDay.day || (last.day === lastDay.day && last.time > lastDay.end))) {
    r.fail('la dernière étape tombe après clock.lastDay');
  }
  return stages;
}

function parseWeather(r: Reader | null, written: number): Settings['weather'] {
  const d = DEFAULT_WEATHER;
  if (r === null) return { ...d, fromDay: Math.max(d.fromDay, written + 1) };
  const fromDay = r.has('fromDay') ? r.at('fromDay').integer(1) : d.fromDay;
  if (fromDay > written + 1) r.at('fromDay').fail(`weatherByDay s'arrête au jour ${written}: jours ${written + 1} à ${fromDay - 1} sans météo`);
  const mist = r.opt('mist');
  const bite = r.opt('biteWaitFactor');
  const forced = r.opt('forced');
  return {
    fromDay,
    draw: r.has('draw') ? bySeason(r.at('draw'), (x) => odds(x, true)) : d.draw,
    target: r.has('target') ? bySeason(r.at('target'), (x) => odds(x, true)) : d.target,
    persistence: r.has('persistence') ? probability(r.at('persistence')) : d.persistence,
    maxRainStreak: r.has('maxRainStreak') ? r.at('maxRainStreak').integer(1) : d.maxRainStreak,
    maxDaysWithoutSun: r.has('maxDaysWithoutSun') ? r.at('maxDaysWithoutSun').integer(1) : d.maxDaysWithoutSun,
    forced:
      forced === null
        ? d.forced
        : forced.items().map((f) => {
            const day = f.at('day').integer(1);
            if (day < fromDay) f.at('day').fail('jour écrit dans weatherByDay');
            return { day, weather: f.at('weather').oneOf(WEATHERS) };
          }),
    logDays: r.has('logDays') ? r.at('logDays').integer(7, 60) : d.logDays,
    biteWaitFactor:
      bite === null ? d.biteWaitFactor : { sunny: bite.at('sunny').number(), cloudy: bite.at('cloudy').number(), rain: bite.at('rain').number() },
    mist:
      mist === null
        ? d.mist
        : {
            afterRain: probability(mist.at('afterRain')),
            base: bySeason(mist.at('base'), probability),
            fadeFrom: mist.at('fadeFrom').time(),
            until: mist.at('until').time(),
            biteWaitFactor: mist.at('biteWaitFactor').number(),
          },
  };
}

/** Fenêtre hebdomadaire du catalogue après les fenêtres écrites (`catalogue.repeatWeekly`). */
function parseRepeatWeekly(catalogue: Reader): Settings['economy']['catalogue']['repeatWeekly'] {
  const r = catalogue.opt('repeatWeekly');
  if (r === null) return null;
  return {
    deadlineWeekday: WEEKDAYS.indexOf(r.at('deadlineWeekday').oneOf(WEEKDAYS)),
    deadlineTime: r.at('deadlineTime').time(),
    deliveryTime: r.at('deliveryTime').time(),
  };
}

function parseGenerated(r: Reader | null, written: number): Settings['order']['generated'] {
  if (r === null) return null;
  const fromOrder = r.at('fromOrder').integer(1);
  if (fromOrder !== written + 1) r.at('fromOrder').fail(`la commande ${written + 1} suit les commandes écrites`);
  const budget = r.at('budget');
  const res = r.at('resources');
  const weights = r.at('weights');
  const size = r.at('size');
  const factors: Record<string, number> = {};
  for (const [key, value] of size.at('factors').entries()) factors[key] = value.number();
  const current = size.at('current').string();
  if (!(current in factors)) size.at('current').fail(`taille inconnue « ${current} »`);
  const noShared: Record<string, string[]> = {};
  for (const [key, value] of r.at('noSharedBase').entries()) noShared[key] = value.stringList();
  let previousFrom = 0;
  const linesByOrder = r
    .at('linesByOrder')
    .items()
    .map((x) => {
      const from = x.at('from').integer(fromOrder);
      if (from <= previousFrom) x.at('from').fail('paliers attendus dans l\'ordre');
      previousFrom = from;
      return { from, lines: x.at('lines').integer(1, 12) };
    });
  if (linesByOrder[0]?.from !== fromOrder) r.at('linesByOrder').fail(`le premier palier commence à la commande ${fromOrder}`);
  const products = r
    .at('products')
    .items()
    .map((p) => {
      const price = p.opt('price');
      return {
        item: p.at('item').string(),
        family: p.at('family').oneOf(FAMILIES),
        resource: p.at('resource').oneOf(RESOURCES),
        cost: positive(p.at('cost')),
        min: p.at('min').integer(1),
        price: price === null || price.isNull() ? null : price.integer(0),
        seasons: seasonList(p.at('seasons')),
        obtained: p.at('obtained').string(),
        leadDays: p.at('leadDays').integer(0),
      };
    });
  if (new Set(products.map((p) => p.item)).size !== products.length) r.at('products').fail('produit en double');
  const minLines = r.at('minLines').integer(1);
  const numbers = (key: string, min: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of r.opt(key)?.entries() ?? []) out[k] = v.integer(min);
    return out;
  };
  const extra = r.opt('extraLineMinShare');
  const reference = r.opt('fishCostReferenceSeason');
  return {
    fromOrder,
    linesByOrder,
    minLines,
    maxPerFamily: r.at('maxPerFamily').integer(1),
    minFamilies: r.at('minFamilies').integer(1),
    maxRepeatFromPrevious: r.at('maxRepeatFromPrevious').integer(0),
    weights: { absentFamily: weights.at('absentFamily').number(), neverOrdered: weights.at('neverOrdered').number(), twoOrdersAgo: weights.at('twoOrdersAgo').number() },
    budget: {
      start: budget.at('start').number(),
      stepOnComplete: budget.at('stepOnComplete').number(),
      max: budget.at('max').number(),
      afterMiss: budget.at('afterMiss').number(),
      afterTwoMisses: budget.at('afterTwoMisses').number(),
      floor: budget.at('floor').number(),
    },
    size: { current, factors },
    resources: {
      garden: res.at('garden').number(),
      eggs: res.at('eggs').number(),
      river: res.at('river').number(),
      wood: res.at('wood').number(),
      resourceCap: probability(res.at('resourceCap')),
      minLineShare: probability(res.at('minLineShare')),
      forageCap: probability(res.at('forageCap')),
      forageShare: res.at('forageShare').number(),
      woodPlanksPerTree: res.at('woodPlanksPerTree').number(),
      woodCap: probability(res.at('woodCap')),
      woodMinTrees: res.at('woodMinTrees').integer(0),
    },
    paymentPerWorkWeek: r.at('paymentPerWorkWeek').number(),
    noSharedBase: noShared,
    products,
    fishCostFromWeights: optBoolean(r, 'fishCostFromWeights', false),
    fishCostReferenceSeason: reference === null ? 'spring' : reference.oneOf(SEASONS),
    riverUnitCost: r.has('riverUnitCost') ? positive(r.at('riverUnitCost')) : null,
    fishShareBySeason: Object.fromEntries(
      (r.opt('fishShareBySeason')?.entries() ?? []).map(([season, table]) => [
        (SEASONS as readonly string[]).includes(season) ? season : r.at('fishShareBySeason').fail(`saison inconnue « ${season} »`),
        Object.fromEntries(table.entries().map(([item, share]) => [item, probability(share)])),
      ]),
    ),
    roundTo: numbers('roundTo', 1),
    lineMax: numbers('lineMax', 1),
    extraLineMinShare: extra === null || extra.isNull() ? null : probability(extra),
    maxLines: r.has('maxLines') ? r.at('maxLines').integer(minLines, 12) : 6,
    eggsPerHenPerWeek: res.has('eggsPerHenPerWeek') ? positive(res.at('eggsPerHenPerWeek')) : null,
  };
}

function parseForage(r: Reader | null): Settings['forage'] {
  if (r === null) return null;
  const boost = r.opt('rainBoost');
  const items = r
    .at('items')
    .items()
    .map((i) => {
      const count = i.at('count').numberList();
      const [lo, hi] = count;
      if (count.length !== 2 || lo === undefined || hi === undefined || lo < 1 || hi < lo) return i.at('count').fail('[min, max] attendu');
      const days = i.opt('days');
      let window: readonly [number, number] | null = null;
      if (days !== null && !days.isNull()) {
        const [a, b] = days.numberList();
        if (a === undefined || b === undefined || a < 1 || b < a) return days.fail('[premier, dernier] jour de saison attendu');
        window = [a, b];
      }
      return { item: i.at('item').string(), seasons: seasonList(i.at('seasons')), days: window, weight: i.at('weight').number(), count: [lo, hi] as const };
    });
  const known = new Set(items.map((i) => i.item));
  const points = r
    .at('points')
    .items()
    .map((p) => {
      const list = p.at('items').stringList();
      for (const it of list) if (!known.has(it)) p.at('items').fail(`cueillette inconnue « ${it} » (forage.items)`);
      return { point: p.at('point').string(), items: list };
    });
  return {
    fromDay: r.at('fromDay').integer(1),
    spawnChance: probability(r.at('spawnChance')),
    unseenFactor: r.at('unseenFactor').number(),
    // Un objet (tour 8) ou une liste (tour 9): le validateur accepte encore les deux formes.
    rainBoost:
      boost === null || boost.isNull()
        ? []
        : (boost.isObject() ? [boost] : boost.items()).map((b) => ({ item: b.at('item').string(), factor: b.at('factor').number() })),
    points,
    items,
  };
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = Object.fromEntries(WEEKDAYS.map((w, i) => [w, i]));

/** Tableau des annonces (tour 9, section 6.1). */
function parseBoard(r: Reader | null): Settings['board'] {
  if (r === null || r.isNull()) return null;
  const weights = r.at('weights');
  const reward = r.at('reward');
  const kind = (k: AnnonceKind): AnnonceReward => {
    const x = reward.at(k);
    return {
      factor: positive(x.at('factor')),
      add: x.at('add').number(),
      min: x.at('min').integer(0),
      max: x.at('max').integer(0),
      round: x.at('round').integer(1),
      heart: optNumber(x, 'heart', 0),
    };
  };
  return {
    fromDay: r.at('fromDay').integer(1),
    post: r
      .at('post')
      .items()
      .map((p) => ({ weekday: WEEKDAY_INDEX[p.at('weekday').oneOf(WEEKDAYS)] ?? 0, kind: p.at('kind').oneOf(ANNONCE_KINDS) })),
    postTime: r.at('postTime').time(),
    deadlineDays: r.at('deadlineDays').integer(1, 6),
    deadlineTime: r.at('deadlineTime').time(),
    noRepeatDays: r.at('noRepeatDays').integer(0),
    weights: { neverPosted: positive(weights.at('neverPosted')), sameGiver: positive(weights.at('sameGiver')) },
    reward: { help: kind('help'), together: kind('together') },
    keepDone: r.at('keepDone').integer(0),
  };
}

function parseHappiness(r: Reader): HappinessSettings {
  return {
    start: r.at('start').number(),
    drift: r.at('drift').number(),
    floor: r.at('floor').number(),
    max: r.at('max').number(),
    happy: r.at('happy').number(),
    calm: r.at('calm').number(),
  };
}

/** Soins de la basse-cour (0.12, section 4.2). */
function parseHenCare(r: Reader | null): HenCareSettings | null {
  if (r === null || r.isNull()) return null;
  const h = r.at('happiness');
  const grain = r.at('grain');
  const brood = r.at('brood');
  return {
    happiness: {
      ...parseHappiness(h),
      migration: h.at('migration').number(),
      fed: h.at('fed').number(),
      straw: h.at('straw').number(),
      strawDays: h.at('strawDays').integer(0),
      pet: h.at('pet').number(),
      callByName: h.at('callByName').number(),
      everyOtherBelow: h.at('everyOtherBelow').number(),
      fineFrom: h.at('fineFrom').number(),
      broodFrom: h.at('broodFrom').number(),
    },
    maxExtended: r.at('maxExtended').integer(1),
    extensionImprovement: r.at('extensionImprovement').string(),
    grain: {
      item: grain.at('item').string(),
      rations: grain.at('rations').integer(1),
      perHen: grain.at('perHen').integer(1),
      fromDay: grain.at('fromDay').integer(1),
      forageSeasons: grain.at('forageSeasons').items().map((s) => s.oneOf(SEASONS)),
      hopper: grain.at('hopper').string(),
    },
    petRange: r.at('petRange').number(),
    straw: { item: r.at('straw').at('item').string(), seconds: r.at('straw').at('seconds').number() },
    brood: {
      eggs: brood.at('eggs').integer(1),
      nights: brood.at('nights').integer(1),
      hatchChance: brood.at('hatchChance').number(),
      roosterlingChance: brood.at('roosterlingChance').number(),
      seasons: brood.at('seasons').items().map((s) => s.oneOf(SEASONS)),
      lastSeasonDay: brood.at('lastSeasonDay').integer(1),
      growNights: brood.at('growNights').integer(1),
      colorMother: brood.at('colorMother').number(),
      colorGolden: brood.at('colorGolden').number(),
    },
    colors: r.at('colors').stringList(),
    goldenColor: r.at('goldenColor').string(),
    roosterVariant: r.at('roosterVariant').string(),
    roosterNames: r.at('roosterNames').stringList(),
    chickNames: r.at('chickNames').stringList(),
  };
}

/** La chèvre (0.12, section 4.3). */
function parseGoats(r: Reader | null): GoatSettings | null {
  if (r === null || r.isNull()) return null;
  const h = r.at('happiness');
  return {
    happiness: {
      ...parseHappiness(h),
      freshGraze: h.at('freshGraze').number(),
      freshDays: h.at('freshDays').integer(1),
      water: h.at('water').number(),
      brush: h.at('brush').number(),
      heldMilking: h.at('heldMilking').number(),
      milkNoneBelow: h.at('milkNoneBelow').number(),
      milkTwoFrom: h.at('milkTwoFrom').number(),
    },
    max: r.at('max').integer(1),
    shedImprovement: r.at('shedImprovement').string(),
    milkItem: r.at('milkItem').string(),
    milkFrom: r.at('milkFrom').time(),
    milkUntil: r.at('milkUntil').time(),
    milkSeconds: r.at('milkSeconds').number(),
    heldMilkSeconds: r.at('heldMilkSeconds').number(),
    ropeLength: r.at('ropeLength').number(),
    followDistance: r.at('followDistance').number(),
    followSpeedFactor: r.at('followSpeedFactor').number(),
    homeAt: r.at('homeAt').time(),
    outAt: r.at('outAt').time(),
    speed: r.at('speed').number(),
    pailItem: r.at('pailItem').string(),
    spots: r.at('spots').stringList(),
    railClearance: r.at('railClearance').number(),
    names: r.at('names').stringList(),
    extraItem: r.at('extraItem').string(),
  };
}

/** Chantiers (tour 9, section 6.1). */
function parseImprovementSettings(r: Reader | null): Settings['improvements'] {
  if (r === null || r.isNull()) return null;
  const queues = r.at('queues');
  return {
    queues: {
      bourg: { opensFromDay: queues.at('bourg').at('opensFromDay').integer(1) },
      maisonnette: { opensFromDay: queues.at('maisonnette').at('opensFromDay').integer(1) },
      // 0.12: la file des bêtes (chevrerie, poulailler agrandi); absente: jamais ouverte.
      elevage: { opensFromDay: queues.has('elevage') ? queues.at('elevage').at('opensFromDay').integer(1) : Number.MAX_SAFE_INTEGER },
    },
    steps: r.at('steps').numberList(),
    plankDiscount: r.at('plankDiscount').integer(0),
    plankDiscountMax: r.at('plankDiscountMax').integer(0),
  };
}

function numberRecord(r: Reader, min: number): Record<string, number> {
  return Object.fromEntries(r.entries().map(([k, x]) => [k, x.integer(min)]));
}

/** Comptoir d'Odette (0.12, section 2.2). */
function parseGrocerPricing(grocer: Reader): Settings['economy']['grocer'] {
  const supply = grocer.at('supply');
  const ardoise = grocer.at('ardoise');
  const words = grocer.at('words');
  const seasonFactor: Settings['economy']['grocer']['seasonFactor'] = {};
  for (const [item, r] of grocer.at('seasonFactor').entries()) {
    const f = r.items().map((x) => x.number());
    if (f.length !== 4) r.fail('quatre facteurs attendus (printemps, été, automne, hiver)');
    seasonFactor[item] = [f[0] ?? 1, f[1] ?? 1, f[2] ?? 1, f[3] ?? 1];
  }
  return {
    buyRate: grocer.at('buyRate').number(),
    dailyCap: grocer.at('dailyCap').integer(0),
    buysAfterFlag: grocer.at('buysAfterFlag').string(),
    pricesFromDay: grocer.at('pricesFromDay').integer(1),
    supply: {
      floor: supply.at('floor').number(),
      slope: supply.at('slope').number(),
      dawnDecay: supply.at('dawnDecay').number(),
      saturation: numberRecord(supply.at('saturation'), 1),
      categorySaturation: numberRecord(supply.at('categorySaturation'), 1),
      defaultSaturation: supply.at('defaultSaturation').integer(1),
    },
    seasonFactor,
    ardoise: { factor: ardoise.at('factor').number(), max: ardoise.at('max').integer(0), time: ardoise.at('time').time() },
    words: { plentyAtMost: words.at('plentyAtMost').number(), wantedFrom: words.at('wantedFrom').number() },
  };
}

function parseSettings(r: Reader): Settings {
  const clock = r.at('clock');
  const economy = r.at('economy');
  const grocer = economy.at('grocer');
  const catalogue = economy.at('catalogue');
  const order = r.at('order');
  const endurance = r.at('endurance');
  const needs = r.at('needs');
  const belly = needs.at('belly');
  const heart = needs.at('heart');
  const weights = needs.at('formWeights');
  const ranges = r.at('ranges');
  const movement = r.at('movement');
  const costs: Record<string, number> = {};
  for (const [key, value] of endurance.at('costs').entries()) costs[key] = value.number();
  const snacks: Record<string, number> = {};
  for (const [key, value] of r.at('snacks').entries()) snacks[key] = value.number();
  const dayTime = (x: Reader): { day: number; time: number } => ({ day: x.at('day').integer(1), time: x.at('time').time() });
  const weatherByDay = r
    .at('weatherByDay')
    .items()
    .map((w) => w.oneOf(WEATHERS));
  const lastDayReader = clock.at('lastDay');
  const lastDay = { day: lastDayReader.at('day').integer(1), end: lastDayReader.at('end').time() };
  const weather = parseWeather(r.opt('weather'), weatherByDay.length);
  // Une météo écrite par jour jusqu'au premier jour tiré (et jusqu'à la limite si rien n'est tiré).
  if (weatherByDay.length < Math.min(lastDay.day, weather.fromDay - 1)) {
    r.at('weatherByDay').fail('une météo par jour de la démo attendue');
  }
  const trainDays = r.at('train').at('days').numberList();
  const train = r.at('train');
  const base = clock.at('secondsPerGameMinute').number();
  const trains = trainOrders(order, trainDays);
  const tenderness = r.opt('tenderness');
  const continuation = r.opt('continuation');
  return {
    profile: r.at('profile').string(),
    habits: parseHabitSettings(r.opt('habits')),
    bonds: parseBondSettings(r.opt('bonds')),
    calendar: parseCalendar(r),
    clock: {
      secondsPerGameMinute: base,
      schedule: parseSchedule(clock, base),
      ...parsePace(clock),
      dayStart: clock.at('dayStart').time(),
      dayEnd: clock.at('dayEnd').time(),
      veilleeFrom: clock.at('veilleeFrom').time(),
      firstDay: { day: clock.at('firstDay').at('day').integer(1), start: clock.at('firstDay').at('start').time() },
      lastDay,
      stopWhenBothInMenu: clock.at('stopWhenBothInMenu').boolean(),
    },
    train: {
      days: trainDays,
      repeatEveryDays: train.has('repeatEveryDays') ? train.at('repeatEveryDays').integer(0) : 0,
      arrival: train.at('arrival').time(),
      departure: train.at('departure').time(),
      saluteSlowRoll: optBoolean(train, 'saluteSlowRoll', true),
    },
    weatherByDay,
    weather,
    stages: parseStages(r.opt('stages'), lastDay),
    continuation: { mode: continuation === null ? 'same_save' : continuation.at('mode').oneOf(['same_save', 'new_game_per_stage'] as const) },
    tenderness: tenderness === null ? 'gentle' : tenderness.oneOf(TENDERNESS),
    spawn: { point: r.at('spawn').at('point').string() },
    mailRound: parseMailRound(r.opt('mailRound')),
    economy: {
      startPurse: economy.at('startPurse').integer(0),
      currency: {
        singular: economy.at('currency').at('singular').string(),
        plural: economy.at('currency').at('plural').string(),
        icon: economy.at('currency').at('icon').string(),
      },
      bigPurchaseThreshold: economy.at('bigPurchaseThreshold').integer(0),
      grocer: parseGrocerPricing(grocer),
      catalogue: { windows: catalogueWindows(catalogue, dayTime), repeatWeekly: parseRepeatWeekly(catalogue) },
    },
    order: {
      trains,
      extraItemsRate: order.at('extraItemsRate').number(),
      generated: parseGenerated(order.opt('generated'), trains.length),
    },
    trees: parseTrees(r.at('trees')),
    forage: parseForage(r.opt('forage')),
    hens: {
      eggsPerHenPerDay: r.at('hens').at('eggsPerHenPerDay').integer(0),
      feedRequired: r.at('hens').at('feedRequired').boolean(),
      max: r.at('hens').has('max') ? r.at('hens').at('max').integer(1) : 5,
      care: parseHenCare(r.at('hens').opt('care')),
    },
    goats: parseGoats(r.opt('goats')),
    board: parseBoard(r.opt('board')),
    improvements: parseImprovementSettings(r.opt('improvements')),
    endurance: {
      base: endurance.at('base').number(),
      perFormPoint: endurance.at('perFormPoint').number(),
      costMultiplier: endurance.at('costMultiplier').number(),
      atZeroDurationMultiplier: endurance.at('atZeroDurationMultiplier').number(),
      costs,
    },
    snacks,
    needs: {
      belly: {
        none: belly.at('none').number(),
        bread: belly.at('bread').number(),
        simple: belly.at('simple').number(),
        stew: belly.at('stew').number(),
        stewPlusDish: belly.at('stewPlusDish').number(),
      },
      sleep: { midnightPenalty: needs.at('sleep').at('midnightPenalty').number() },
      heart: {
        base: heart.at('base').number(),
        envie: heart.at('envie').number(),
        sharedEnvie: heart.at('sharedEnvie').number(),
        ateTogether: heart.at('ateTogether').number(),
        gestureTogether: heart.at('gestureTogether').number(),
        max: heart.at('max').number(),
      },
      formWeights: { belly: weights.at('belly').number(), sleep: weights.at('sleep').number(), heart: weights.at('heart').number() },
      formLevels: needs
        .at('formLevels')
        .items()
        .map((l) => ({ level: l.at('level').string(), below: l.at('below').number() })),
      soft: parseSoftNeeds(needs),
    },
    rooms: parseRoomsSettings(r.opt('rooms')),
    storage: parseStorageSettings(r.opt('storage')),
    bakery: parseBakery(r.opt('bakery')),
    salon: parseSalon(r.opt('salon')),
    grocer: parseGrocer(r.opt('grocer')),
    appearance: parseAppearance(r.opt('appearance')),
    movement: {
      walkSpeed: movement.at('walkSpeed').number(),
      carrySpeedTogether: movement.at('carrySpeedTogether').number(),
      carrySpeedOneMoving: movement.at('carrySpeedOneMoving').number(),
    },
    ranges: {
      action: ranges.at('action').number(),
      talk: ranges.at('talk').number(),
      gesture: ranges.at('gesture').number(),
      together: ranges.at('together').number(),
      witness: ranges.at('witness').number(),
      eatTogether: optNumber(ranges, 'eatTogether', DEFAULT_RANGES.eatTogether),
      stayAt: optNumber(ranges, 'stayAt', DEFAULT_RANGES.stayAt),
    },
    building: {
      twoPlayersSpeedMultiplier: r.at('building').at('twoPlayersSpeedMultiplier').number(),
      twoPlayersRecipes: r.at('building').opt('twoPlayersRecipes')?.stringList() ?? [],
    },
    hints: { durationSeconds: r.at('hints').at('durationSeconds').number() },
    absence: { minutes: r.at('absence').at('minutes').number() },
    carry: parseCarry(r.opt('carry')),
    envies: parseEnvieSettings(r.opt('envies')),
    dialogues: parseDialogueSettings(r.opt('dialogues')),
    tidy: parseTidySettings(r.opt('tidy')),
    fishing: parseFishing(r.opt('fishing')),
    benches: parseBenches(r.opt('benches')),
    town: townFrom(parseBakery(r.opt('bakery')), parseSalon(r.opt('salon')), parseGrocer(r.opt('grocer')), parseAppearance(r.opt('appearance'))),
    moments: parseMomentSettings(r.opt('moments')),
    secrets: parseSecretSettings(r.opt('secrets')),
    memories: parseMemorySettings(r.opt('memories'), parseCalendar(r)),
    feel: parseFeel(r.opt('feel')),
  };
}

// ---------------------------------------------------------------------------
// Contrôle des renvois

function checkReferences(content: Content): void {
  const fail = (message: string): never => {
    throw new ContentError(message);
  };
  const item = (id: string, where: string): void => {
    if (!(id in content.items)) fail(`${where}: objet inconnu « ${id} »`);
  };
  for (const recipe of Object.values(content.recipes)) {
    recipe.inputs.forEach((s) => {
      item(s.item, `objets.json: recette ${recipe.id}`);
    });
    item(recipe.output.item, `objets.json: recette ${recipe.id}`);
  }
  for (const crop of Object.values(content.crops)) {
    item(crop.seed, `cultures.json: ${crop.id}`);
    item(crop.harvest, `cultures.json: ${crop.id}`);
  }
  content.settings.order.trains.forEach((o, i) => {
    for (const line of o.lines) item(line.item, `reglages.json: order.trains[${i}].lines`);
  });
  checkWeeklyReferences(content, fail, item);
  checkTour9References(content, fail, item);
  const questIds = new Set(content.quests.map((q) => q.id));
  const walkEffects = (list: Effect[], where: string): void => {
    for (const e of list) {
      switch (e.type) {
        case 'give_item':
        case 'take_item':
        case 'spawn_object':
          item(e.item, where);
          break;
        case 'send_letter':
          if (!(e.letter in content.letters)) fail(`${where}: lettre inconnue « ${e.letter} »`);
          break;
        case 'start_quest':
          if (!questIds.has(e.quest)) fail(`${where}: quête inconnue « ${e.quest} »`);
          break;
        case 'play_dialogue':
          if (!(e.dialogue in content.dialogues)) fail(`${where}: dialogue inconnu « ${e.dialogue} »`);
          break;
        case 'unlock_recipe':
          if (!(e.recipe in content.recipes)) fail(`${where}: recette inconnue « ${e.recipe} »`);
          break;
        case 'show_text':
          if (!(e.text in content.texts.messages)) fail(`${where}: message inconnu « ${e.text} »`);
          break;
        case 'if':
          walkEffects(e.then, where);
          walkEffects(e.else, where);
          break;
        case 'spawn_animals':
          if (!(e.animal in content.animals)) fail(`${where}: bête inconnue « ${e.animal} »`);
          break;
        case 'reveal_secret':
          if ((content.quests.find((q) => q.id === e.quest)?.secret ?? null) === null) fail(`${where}: quête sans secret « ${e.quest} »`);
          break;
        case 'reveal_habit':
          if (!habitExists(content.villagers, e)) fail(`${where}: habitude inconnue « ${e.villager}.${e.habit} »`);
          break;
        case 'add_bond':
          if (!content.villagers.some((v) => v.id === e.villager)) fail(`${where}: habitant inconnu « ${e.villager} »`);
          break;
        case 'reveal_taste':
          if (!content.villagers.some((v) => v.id === e.villager)) fail(`${where}: habitant inconnu « ${e.villager} »`);
          if (!(e.item in content.items)) fail(`${where}: objet inconnu « ${e.item} »`);
          break;
        case 'give_money':
        case 'take_money':
        case 'set_flag':
        case 'set_need':
        case 'gather_players':
        case 'set_world_state':
        case 'pay_order':
        case 'end_stage':
          break;
      }
    }
  };
  for (const quest of content.quests) {
    walkEffects(quest.start.effects, `quetes.json: ${quest.id}`);
    walkEffects(quest.completionEffects, `quetes.json: ${quest.id}`);
    for (const step of quest.steps) {
      walkEffects(step.effects, `quetes.json: ${quest.id}.${step.id}`);
      walkEffects(step.onDeadline, `quetes.json: ${quest.id}.${step.id}`);
    }
  }
  for (const dialogue of Object.values(content.dialogues)) {
    walkEffects(dialogue.effects, `habitants.json: ${dialogue.id}`);
    for (const choice of dialogue.choices) {
      walkEffects(choice.effects, `habitants.json: ${dialogue.id}.${choice.id}`);
      walkEffects(choice.effectsWrong, `habitants.json: ${dialogue.id}.${choice.id}`);
    }
  }
  for (const load of content.settings.carry.quests) {
    const where = `reglages.json: carry.quests (${load.item})`;
    item(load.item, where);
    const steps = content.quests.find((q) => q.id === load.quest)?.steps ?? null;
    if (steps === null) fail(`${where}: quête inconnue « ${load.quest} »`);
    else if (!steps.some((s) => s.id === load.step)) fail(`${where}: étape inconnue « ${load.step} »`);
    if (load.placedText !== null && !(load.placedText in content.texts.messages)) fail(`${where}: message inconnu « ${load.placedText} »`);
  }
  for (const quest of content.quests) {
    const expire = quest.expire?.text ?? null;
    if (expire !== null && !(expire in content.texts.messages)) fail(`quetes.json: ${quest.id}: message inconnu « ${expire} »`);
    const nudge = quest.secret?.nudge ?? null;
    if (nudge !== null && !(nudge in content.texts.messages)) fail(`quetes.json: ${quest.id}: message inconnu « ${nudge} »`);
  }
  for (const m of content.moments) {
    const where = `moments.json: ${m.id}`;
    if (m.quest !== null && !questIds.has(m.quest)) fail(`${where}: quête inconnue « ${m.quest} »`);
    const steps = content.quests.find((q) => q.id === m.quest)?.steps ?? [];
    if (m.questStep !== null && !steps.some((s) => s.id === m.questStep)) fail(`${where}: étape inconnue « ${m.questStep} »`);
    for (const key of [m.texts.hint, m.texts.climax, m.texts.memory, m.texts.rumor, m.texts.vignette, m.texts.missed]) {
      if (key !== null && !(key in content.texts.messages)) fail(`${where}: message inconnu « ${key} »`);
    }
    if (m.hintFrom !== null && !content.villagers.some((v) => v.id === m.hintFrom)) fail(`${where}: habitant inconnu « ${m.hintFrom} »`);
    walkEffects(m.effects, where);
  }
}

// ---------------------------------------------------------------------------
// Tour 9: annonces, chantiers, catalogue de la semaine

function lineList(r: Reader): { item: string; count: number }[] {
  return r.items().map((l) => ({ item: l.at('item').string(), count: l.at('count').integer(1) }));
}

function parseAnnonces(r: Reader): AnnonceDef[] {
  if (r.at('version').integer() !== 1) r.at('version').fail('« version » doit valoir 1');
  const out = r
    .at('annonces')
    .items()
    .map((a) => {
      const days = a.opt('seasonDays');
      let seasonDays: readonly [number, number] | null = null;
      if (days !== null && !days.isNull()) {
        const [x, y] = days.numberList();
        if (x === undefined || y === undefined || x < 1 || y < x) return days.fail('[premier, dernier] jour de saison attendu');
        seasonDays = [x, y];
      }
      const variants = a.opt('variants');
      const lines = a.opt('lines');
      if ((variants === null) === (lines === null)) a.fail('« lines » ou « variants » attendu (un des deux)');
      const list = variants === null ? [lineList(lines ?? a)] : variants.items().map(lineList);
      const scene = optString(a, 'scene');
      if (scene === null && list.some((v) => v.length === 0)) a.fail('une annonce sans demande finit par une scène');
      return {
        id: a.at('id').string(),
        kind: a.at('kind').oneOf(ANNONCE_KINDS),
        giver: a.at('giver').string(),
        seasons: cropSeasons(a.at('seasons')),
        seasonDays,
        variants: list,
        scene,
        unique: optString(a, 'unique'),
        uniqueScene: optString(a, 'uniqueScene'),
      };
    });
  if (new Set(out.map((a) => a.id)).size !== out.length) r.at('annonces').fail('gabarit en double');
  return out;
}

function parseImprovements(r: Reader): ImprovementDef[] {
  if (r.at('version').integer() !== 1) r.at('version').fail('« version » doit valoir 1');
  const out = r
    .at('improvements')
    .items()
    .map((x) => {
      const id = x.at('id').string();
      return {
        id,
        queue: x.at('queue').oneOf(QUEUES),
        order: x.at('order').integer(1),
        price: x.at('price').integer(1),
        model: x.at('model').string(),
        cells: x.at('cells').items().map((c) => ({ cx: c.at('cx').integer(0), cy: c.at('cy').integer(0) })),
        rotation: x.at('rotation').integer(0, 359),
        flag: optString(x, 'flag') ?? `${id}_built`,
        payAt: x.at('payAt').oneOf(['board', 'basile'] as const),
      };
    });
  if (new Set(out.map((x) => x.id)).size !== out.length) r.at('improvements').fail('chantier en double');
  for (const q of QUEUES) {
    const orders = out.filter((x) => x.queue === q).map((x) => x.order);
    if (new Set(orders).size !== orders.length) r.at('improvements').fail(`deux chantiers au même rang dans la file « ${q} »`);
  }
  return out;
}

function parseCatalogue(r: Reader): CatalogueDef {
  if (r.at('version').integer() !== 1) r.at('version').fail('« version » doit valoir 1');
  const copies: Record<string, number> = {};
  for (const [k, v] of r.at('copies').entries()) copies[k] = v.integer(1, 9);
  const seasonal: Record<string, Season> = {};
  for (const [k, v] of r.at('seasonal').entries()) seasonal[k] = v.oneOf(SEASONS);
  const hens: CatalogueDef['hens'] = {};
  for (const [k, v] of r.opt('hens')?.entries() ?? []) hens[k] = { name: v.at('name').string(), variant: v.at('variant').string(), naming: v.at('naming').string() };
  return {
    pages: r
      .at('pages')
      .items()
      .map((p) => ({ season: p.at('season').oneOf(SEASONS), week: p.at('week').integer(1, 3), items: p.at('items').stringList() })),
    gifts: r
      .at('gifts')
      .items()
      .map((g) => {
        const villager = g.at('villager').string();
        return { item: g.at('item').string(), villager, wish: g.at('wish').string(), thanks: g.at('thanks').string(), quest: optString(g, 'quest') ?? `gift_${villager}` };
      }),
    copies,
    seasonal,
    hens,
  };
}

/** Un texte de `textes.json` sous `section.<id>.<key>` (annonces, chantiers), ou `null`. */
export function rawText(texts: Texts, section: string, id: string, key: string): string | null {
  const block = texts.raw[section];
  const entry = typeof block === 'object' && block !== null ? (block as Record<string, unknown>)[id] : undefined;
  const value = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : null;
}

/** Remplace les `{clé}` connues (les autres restent, pour l'interface). */
function fill(text: string, vars: Record<string, string>): string {
  return agreeMoney(text.replace(/\{(\w+)\}/g, (all, key: string) => vars[key] ?? all));
}

/** Identifiant de la quête d'une annonce (une par variante quand il y en a plusieurs). */
export function annonceQuestId(def: Pick<AnnonceDef, 'id' | 'variants'>, variant: number): string {
  return def.variants.length > 1 ? `annonce_${def.id}_${String(variant + 1)}` : `annonce_${def.id}`;
}

/**
 * Les quêtes des annonces et des cadeaux (tour 9), écrites ici plutôt que dans `quetes.json`: une
 * par gabarit et par variante, groupe « Annonces » du carnet (`kind: side`). Étapes: les dons à
 * l'habitant (conditions `given` depuis le début de l'étape), puis la scène à deux s'il y en a une.
 */
function annonceQuests(content: Content): QuestDef[] {
  const out: QuestDef[] = [];
  const name = (item: string, count: number): string => {
    const def = content.items[item];
    return `${String(count)} ${count > 1 ? (def?.plural ?? item) : (def?.name ?? item)}`;
  };
  const step = (id: string, objective: string, conds: Condition[]): QuestDef['steps'][number] => ({
    id,
    objective,
    objectiveByRole: null,
    conditions: conds,
    effects: [],
    resolve: 'on_conditions',
    deadline: null,
    onDeadline: [],
    failText: null,
  });
  const quest = (id: string, title: string, giver: string, steps: QuestDef['steps']): QuestDef => ({
    id,
    kind: 'side',
    tier: 'P0',
    title,
    giver,
    story: null,
    start: { when: [], byEffect: true, effects: [] },
    steps,
    completionEffects: [],
    completionText: '',
    secret: null,
    repeat: null,
    expire: null,
  });
  for (const a of content.annonces) {
    const title = rawText(content.texts, 'annonces', a.id, 'title') ?? a.id;
    const text = rawText(content.texts, 'annonces', a.id, 'text') ?? title;
    a.variants.forEach((lines, v) => {
      const steps: QuestDef['steps'] = [];
      const first = lines[0];
      const objective = first === undefined ? text : fill(text, { count: String(first.count), item: first.count > 1 ? (content.items[first.item]?.plural ?? first.item) : (content.items[first.item]?.name ?? first.item) });
      if (lines.length > 0) {
        steps.push(
          step(
            'give',
            objective,
            lines.map((l) => ({ type: 'counter', key: `given:${a.giver}:${l.item}`, count: l.count, since: 'step_start', who: 'either', label: name(l.item, l.count) })),
          ),
        );
      }
      if (a.scene !== null) steps.push(step('scene', objective, [{ type: 'counter', key: `scene:${a.scene}`, count: 1, since: 'step_start', who: 'either' }]));
      out.push(quest(annonceQuestId(a, v), title, a.giver, steps));
    });
  }
  const gifts = content.catalogue?.gifts ?? [];
  const giftTitle = rawText(content.texts, 'catalogue', 'gift', 'title') ?? 'Un cadeau pour {villager}';
  const giftObjective = rawText(content.texts, 'catalogue', 'gift', 'objective') ?? '{item}';
  for (const g of gifts) {
    const villager = content.villagers.find((v) => v.id === g.villager)?.label ?? g.villager;
    const item = content.items[g.item];
    const article = item?.indefinite ?? item?.name ?? g.item;
    const vars = { villager, item: article };
    out.push(
      quest(g.quest, fill(giftTitle, vars), g.villager, [
        step('give', fill(giftObjective, vars), [{ type: 'counter', key: `given:${g.villager}:${g.item}`, count: 1, since: 'game_start', who: 'either', label: item?.name ?? g.item }]),
      ]),
    );
  }
  return out;
}

/** Renvois du tour 9: annonces, chantiers, catalogue. */
function checkTour9References(content: Content, fail: (message: string) => never, item: (id: string, where: string) => void): void {
  const villager = (id: string, where: string): void => {
    if (!content.villagers.some((v) => v.id === id)) fail(`${where}: habitant inconnu « ${id} »`);
  };
  for (const a of content.annonces) {
    const where = `annonces.json: ${a.id}`;
    villager(a.giver, where);
    for (const lines of a.variants) for (const l of lines) item(l.item, where);
    if (a.unique !== null) item(a.unique, where);
    for (const scene of [a.scene, a.uniqueScene]) {
      if (scene === null) continue;
      const d = content.dialogues[scene];
      if (d === undefined) fail(`${where}: scène inconnue « ${scene} »`);
      else if (!d.shared || d.kind !== 'scene') fail(`${where}: « ${scene} » n'est pas une scène à deux`);
    }
    for (const key of ['title', 'text', 'thanks']) {
      if (a.scene !== null && key === 'thanks') continue;
      if (rawText(content.texts, 'annonces', a.id, key) === null) fail(`textes.json: annonces.${a.id}.${key} manquant`);
    }
    if (a.seasonDays !== null && a.seasonDays[1] > content.settings.calendar.seasonDays) fail(`${where}: « seasonDays » au-delà de la saison`);
  }
  for (const x of content.improvements) {
    if (rawText(content.texts, 'chantiers', x.id, 'name') === null) fail(`textes.json: chantiers.${x.id}.name manquant`);
  }
  const cat = content.catalogue;
  if (cat === null) return;
  const where = 'catalogue.json';
  const listed = new Set<string>();
  for (const p of cat.pages) {
    for (const id of p.items) {
      item(id, where);
      const def = content.items[id];
      if (def !== undefined && (def.shop !== 'catalogue' || def.buyPrice === null)) fail(`${where}: « ${id} » n'est pas en vente au catalogue (shop, buyPrice)`);
      if (listed.has(id)) fail(`${where}: « ${id} » sur deux pages`);
      listed.add(id);
    }
  }
  for (const g of cat.gifts) {
    item(g.item, where);
    villager(g.villager, where);
    if (!(g.wish in content.dialogues)) fail(`${where}: souhait inconnu « ${g.wish} »`);
    if (!(g.thanks in content.texts.messages)) fail(`${where}: remerciement inconnu « ${g.thanks} »`);
    if (content.items[g.item]?.category !== 'gift') fail(`${where}: « ${g.item} » doit être de catégorie « gift »`);
  }
  for (const id of [...Object.keys(cat.copies), ...Object.keys(cat.seasonal)]) item(id, where);
  for (const [id, hen] of Object.entries(cat.hens)) {
    item(id, where);
    if (content.items[id]?.category !== 'animal_order') fail(`${where}: « ${id} » doit être de catégorie « animal_order »`);
    if (!(hen.naming in content.texts.messages)) fail(`${where}: réplique inconnue « ${hen.naming} »`);
  }
}

/** Renvois du tour 8: produits de la commande générée, cueillettes, étapes, quêtes de la semaine. */
function checkWeeklyReferences(content: Content, fail: (message: string) => never, item: (id: string, where: string) => void): void {
  const s = content.settings;
  const g = s.order.generated;
  const forage = new Set((s.forage?.items ?? []).map((i) => i.item));
  if (g !== null) {
    const products = new Set(g.products.map((p) => p.item));
    for (const p of g.products) {
      // Les cueillettes de la lisière sont décrites par `forage.items` (leurs objets viennent avec la cueillette).
      if (p.resource === 'forage') {
        if (!forage.has(p.item)) fail(`reglages.json: order.generated.products: cueillette inconnue « ${p.item} » (forage.items)`);
      } else {
        item(p.item, 'reglages.json: order.generated.products');
      }
      if (!/^[a-z_]+:[a-z_]+$/.test(p.obtained)) fail(`reglages.json: order.generated.products: « obtained » attendu en « compteur:objet » (${p.item})`);
    }
    for (const [dish, bases] of Object.entries(g.noSharedBase)) {
      for (const id of [dish, ...bases]) if (!products.has(id)) fail(`reglages.json: order.generated.noSharedBase: produit inconnu « ${id} »`);
    }
  }
  const stages = content.texts.raw.stages;
  for (const stage of s.stages) {
    const block = typeof stages === 'object' && stages !== null ? (stages as Record<string, unknown>)[stage.texts] : undefined;
    const title = typeof block === 'object' && block !== null ? (block as Record<string, unknown>).title : undefined;
    if (typeof title !== 'string') fail(`textes.json: stages.${stage.texts}.title manquant (étape ${stage.id})`);
  }
  for (const quest of content.quests) {
    for (const step of quest.steps) {
      if (step.resolve === 'at_deadline' && step.deadline === null && quest.repeat === null) {
        fail(`quetes.json: ${quest.id}.${step.id}: échéance attendue (ou « repeat »)`);
      }
    }
  }
  for (const letter of Object.values(content.letters)) {
    if (letter.instance !== null && g === null) fail(`courrier.json: ${letter.id}: lettre hebdomadaire sans commande générée (order.generated)`);
  }
}

/** Lit, contrôle et normalise les neuf fichiers de contenu. */
export function loadContent(files: RawContentFiles): Content {
  const objets = root('objets.json', files.objets);
  const cultures = root('cultures.json', files.cultures);
  const habitants = root('habitants.json', files.habitants);
  const quetes = root('quetes.json', files.quetes);
  const courrier = root('courrier.json', files.courrier);
  const astuces = root('astuces.json', files.astuces);
  const envies = root('envies.json', files.envies);
  const textes = root('textes.json', files.textes);
  const reglages = root('reglages.json', files.reglages);

  const start = objets.at('startingInventory');
  const { crops, qualities } = parseCrops(cultures);
  const { villagers, dialogues } = parseVillagers(habitants, files.habitants013 === undefined ? null : root('habitants-0-13.json', files.habitants013));
  const settings = parseSettings(reglages);
  const { letters, senders } = parseLetters(courrier);
  const envieData = parseEnvies(envies);
  const content: Content = {
    settings,
    items: parseItems(objets),
    recipes: parseRecipes(objets),
    constructions: parseConstructions(objets),
    startingInventory: {
      cellar: stacks(start.at('cellar')),
      eachPlayer: stacks(start.at('eachPlayer')),
      houseFurniture: stacks(start.at('houseFurniture')),
    },
    animals: parseAnimals(objets),
    crops,
    qualities,
    villagers,
    dialogues,
    quests: parseQuests(quetes),
    letters,
    senders,
    hints: parseHints(astuces),
    envies: envieData.envies,
    sharedEnvieSchedule: envieData.schedule,
    texts: parseTexts(textes),
    moments: files.moments === undefined ? [] : parseMoments(root('moments.json', files.moments)),
    annonces: files.annonces === undefined ? [] : parseAnnonces(root('annonces.json', files.annonces)),
    improvements: files.chantiers === undefined ? [] : parseImprovements(root('chantiers.json', files.chantiers)),
    catalogue: files.catalogue === undefined ? null : parseCatalogue(root('catalogue.json', files.catalogue)),
    home: files.pieces === undefined ? EMPTY_HOME : parseHome(root('pieces.json', files.pieces)),
    market: files.marche === undefined ? null : parseMarket(root('marche.json', files.marche)),
    clothes:
      files.vetements === undefined
        ? EMPTY_CLOTHES
        : parseClothes(files.vetements, parseWardrobeSettings(reglages.opt('wardrobe'))),
    villageCalendar: parseVillageCalendar(files.calendrier === undefined ? null : root('calendrier.json', files.calendrier), settings, villagers),
    signs: signsOf(villagers),
    decisions: files.decisions === undefined ? NO_DECISIONS : parseDecisions(root('decisions.json', files.decisions), parseEffect),
  };
  content.quests.push(...annonceQuests(content));
  if (new Set(content.quests.map((q) => q.id)).size !== content.quests.length) throw new ContentError('quête en double (annonces, cadeaux et quetes.json)');
  checkReferences(content);
  checkVillageReferences(content);
  checkDecisionVillagers(content.decisions, content.villagers);
  checkTastes(content);
  checkMarket(content);
  // Pêche 0.12 (section 8.1): un seul coefficient met tous les prix de poissons à l'échelle de la monnaie.
  const scale = content.settings.fishing?.rules.priceScale ?? 1;
  if (scale !== 1) {
    for (const def of Object.values(content.items)) {
      if (def.fish !== null && def.sellPrice !== null) def.sellPrice = Math.max(1, Math.round(def.sellPrice * scale));
    }
  }
  return content;
}

/** Le marché ne cite que des habitants et des objets vendables du contenu. */
function checkMarket(content: Content): void {
  const m = content.market;
  if (m === null) return;
  for (const b of m.buyers) {
    if (!content.villagers.some((v) => v.id === b.villager)) throw new ContentError(`marche.json: habitant inconnu « ${b.villager} »`);
    for (const item of [...b.wants, b.likes]) {
      if (typeof content.items[item]?.sellPrice !== 'number') throw new ContentError(`marche.json: « ${item} » n'est pas un objet vendable`);
    }
  }
}
