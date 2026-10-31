/**
 * Lecture et contrôle du contenu du game designer (`donnees/*.json`).
 * Toute erreur arrête le chargement avec un message qui cite le fichier et le
 * champ (README des données, section 6). Les heures deviennent des minutes et
 * les conditions qui comptent deviennent des conditions `counter`.
 */
import type { CropStage, Quality, Weather } from '../etat/types';
import { DEFAULT_FEEL, DEFAULT_RANGES } from './defauts';
import { ContentError, Reader } from './lecteur';
import type {
  AnimalDef,
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
  OrderDef,
  CatalogueWindow,
  LetterDef,
  QualityDef,
  QuestDef,
  QuestStepDef,
  RecipeDef,
  ScheduleEntry,
  Settings,
  Since,
  Texts,
  VillagerDef,
  Who,
} from './types';

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
}

const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain'];
const QUALITIES: readonly Quality[] = ['ordinary', 'fine'];
const STAGES: readonly CropStage[] = ['seed', 'sprout', 'young', 'ripe'];
const WEEKDAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const WHO: readonly Who[] = ['either', 'actor', 'both'];
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
];
const DISHES: readonly DishKind[] = ['bread', 'simple', 'stew'];
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
      return { type, weather: r.at('weather').oneOf(WEATHERS) };
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
    case 'stayed_at': {
      const who = r.opt('who');
      return {
        type,
        point: r.at('point').string(),
        seconds: r.at('seconds').number(),
        who: who === null ? 'either' : who.oneOf(WHO),
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
    case 'witnessed':
      return counter(r, `witnessed:${r.at('event').string()}`, since);
    case 'nights_passed':
      return counter(r, 'nights', since);
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
    case 'give_item':
      return {
        type,
        item: r.at('item').string(),
        count: optNumber(r, 'count', 1),
        to: r.at('to').oneOf(['each', 'actor', 'cellar'] as const),
      };
    case 'take_item':
      return {
        type,
        item: r.at('item').string(),
        count: optNumber(r, 'count', 1),
        from: r.at('from').oneOf(['actor', 'either', 'cellar'] as const),
      };
    case 'give_money':
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
      };
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
    case 'end_demo':
      return { type };
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
      shop: shop === null || shop.isNull() ? null : shop.oneOf(['grocery', 'catalogue'] as const),
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
      dining: optBoolean(it, 'dining', false),
      seat: optBoolean(it, 'seat', false),
      light: optBoolean(it, 'light', false),
      carriedByTwo: optBoolean(it, 'carriedByTwo', false),
    };
  }
  return items;
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
  const all = r.at('lines').items();
  all.forEach((line, index) => {
    if (line.has('choices')) {
      if (index !== all.length - 1) line.fail('un bloc de choix ne peut venir qu’en dernier');
      choices = line
        .at('choices')
        .items()
        .map((c) => ({ id: c.at('id').string(), text: c.at('text').string(), reply: parseLines(c.at('reply')) }));
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
  };
}

function parseVillagers(r: Reader): { villagers: VillagerDef[]; dialogues: Record<string, DialogueDef> } {
  const dialogues: Record<string, DialogueDef> = {};
  const villagers = r
    .at('villagers')
    .items()
    .map((v): VillagerDef => {
      const id = v.at('id').string();
      const schedule = v
        .at('schedule')
        .items()
        .map(
          (s): ScheduleEntry => ({
            when: conditions(s.opt('when'), 'game_start'),
            from: s.at('from').time(),
            to: s.at('to').time(),
            point: s.at('point').string(),
            activity: s.at('activity').string(),
          }),
        );
      const own = v
        .at('dialogues')
        .items()
        .map((d) => {
          const dialogue = parseDialogue(d, id);
          if (dialogue.id in dialogues) d.at('id').fail(`dialogue en double « ${dialogue.id} »`);
          dialogues[dialogue.id] = dialogue;
          return dialogue;
        });
      return {
        id,
        firstName: v.at('firstName').string(),
        lastName: v.at('lastName').string(),
        label: v.at('label').string(),
        role: v.at('role').string(),
        model: v.at('model').string(),
        scale: v.at('scale').number(),
        soundMotif: v.at('soundMotif').string(),
        schedule,
        dialogues: own,
      };
    });
  return { villagers, dialogues };
}

function parseStep(r: Reader): QuestStepDef {
  const resolve = r.opt('resolve');
  const deadline = r.opt('deadline');
  return {
    id: r.at('id').string(),
    objective: r.at('objective').string(),
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
        start: {
          when: conditions(start.opt('when'), 'game_start'),
          byEffect: optBoolean(start, 'byEffect', false),
          effects: effects(start.opt('effects')),
        },
        steps: q.at('steps').items().map(parseStep),
        completionEffects: effects(q.opt('completionEffects')),
        completionText: q.at('completionText').string(),
      };
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
    letters[id] = {
      id,
      from: l.at('from').string(),
      title: l.at('title').string(),
      delivery: delivery.has('byEffect')
        ? null
        : { day: delivery.at('day').integer(1), time: delivery.at('time').time() },
      text,
      variants: parsedVariants,
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
  const feel: FeelSettings = { ...DEFAULT_FEEL, actionSeconds: { ...DEFAULT_FEEL.actionSeconds }, fishWeights: { ...DEFAULT_FEEL.fishWeights } };
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
  const numeric: (keyof Omit<FeelSettings, 'actionSeconds' | 'fishWeights'>)[] = [
    'trainSlideSeconds',
    'pointRadius',
    'beamGrabRange',
    'beamDropRadius',
    'villagerSpeed',
    'henSpeed',
    'alreadyTakenSeconds',
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

function parseFishing(r: Reader | null): Settings['fishing'] {
  if (r === null) return null;
  const wait = r.at('biteWaitSeconds').numberList();
  const min = wait[0];
  const max = wait[1];
  if (wait.length !== 2 || min === undefined || max === undefined || min > max) return r.at('biteWaitSeconds').fail('[min, max] attendu');
  return {
    castRange: r.at('castRange').number(),
    biteWaitSeconds: [min, max],
    hookWindowSeconds: r.at('hookWindowSeconds').number(),
    flag: r.at('flag').string(),
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
  const lastDay = clock.at('lastDay');
  if (weatherByDay.length < lastDay.at('day').integer(1)) {
    r.at('weatherByDay').fail('une météo par jour de la démo attendue');
  }
  const trainDays = r.at('train').at('days').numberList();
  return {
    profile: r.at('profile').string(),
    clock: {
      secondsPerGameMinute: clock.at('secondsPerGameMinute').number(),
      dayStart: clock.at('dayStart').time(),
      dayEnd: clock.at('dayEnd').time(),
      veilleeFrom: clock.at('veilleeFrom').time(),
      firstDay: { day: clock.at('firstDay').at('day').integer(1), start: clock.at('firstDay').at('start').time() },
      lastDay: { day: lastDay.at('day').integer(1), end: lastDay.at('end').time() },
      stopWhenBothInMenu: clock.at('stopWhenBothInMenu').boolean(),
    },
    train: {
      days: trainDays,
      arrival: r.at('train').at('arrival').time(),
      departure: r.at('train').at('departure').time(),
    },
    weatherByDay,
    spawn: { point: r.at('spawn').at('point').string() },
    economy: {
      startPurse: economy.at('startPurse').integer(0),
      bigPurchaseThreshold: economy.at('bigPurchaseThreshold').integer(0),
      grocer: {
        buyRate: grocer.at('buyRate').number(),
        dailyCap: grocer.at('dailyCap').integer(0),
        buysAfterFlag: grocer.at('buysAfterFlag').string(),
      },
      catalogue: { windows: catalogueWindows(catalogue, dayTime) },
    },
    order: {
      trains: trainOrders(order, trainDays),
      extraItemsRate: order.at('extraItemsRate').number(),
    },
    trees: { chopsPerTree: r.at('trees').at('chopsPerTree').integer(1), logsPerTree: r.at('trees').at('logsPerTree').integer(1) },
    hens: {
      eggsPerHenPerDay: r.at('hens').at('eggsPerHenPerDay').integer(0),
      feedRequired: r.at('hens').at('feedRequired').boolean(),
    },
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
    },
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
    building: { twoPlayersSpeedMultiplier: r.at('building').at('twoPlayersSpeedMultiplier').number() },
    hints: { durationSeconds: r.at('hints').at('durationSeconds').number() },
    absence: { minutes: r.at('absence').at('minutes').number() },
    fishing: parseFishing(r.opt('fishing')),
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
        case 'give_money':
        case 'set_flag':
        case 'set_need':
        case 'gather_players':
        case 'set_world_state':
        case 'pay_order':
        case 'end_demo':
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
  const { villagers, dialogues } = parseVillagers(habitants);
  const { letters, senders } = parseLetters(courrier);
  const envieData = parseEnvies(envies);
  const content: Content = {
    settings: parseSettings(reglages),
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
  };
  checkReferences(content);
  return content;
}
