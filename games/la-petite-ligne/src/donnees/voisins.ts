/**
 * Lecture des habitudes, du calendrier du bourg et des écriteaux (0.13, lot H1; README des
 * données, section 2.12). Les répliques révélatrices des données deviennent des répliques du
 * quotidien de qui les dit, et les lignes d'écriteaux des écriteaux.
 */
import { ContentError, type Reader } from './lecteur';
import { SEASONS, weekdayOf } from './calendrier';
import type { Condition, Content, DialogueDef, Season, Settings, VillagerDef } from './types';
import {
  HABIT_KINDS,
  type BondSettings,
  type HabitDef,
  type HabitRef,
  type HabitReveal,
  type HabitSettings,
  type SignDef,
  type SpecialDayDef,
  type VillageCalendar,
} from './types-voisins';

const WEEKDAYS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;
const ID = /^[a-z][a-z0-9_]*$/;

function id(r: Reader): string {
  const value = r.string();
  if (!ID.test(value)) r.fail(`identifiant « snake_case » attendu, reçu « ${value} »`);
  return value;
}

function weekdays(r: Reader): number[] {
  return r.items().map((w) => WEEKDAYS.indexOf(w.oneOf(WEEKDAYS)));
}

/** `habits[]` d'un habitant (vide si le champ manque). */
export function parseHabits(r: Reader | null): HabitDef[] {
  if (r === null) return [];
  const seen = new Set<string>();
  return r.items().map((h): HabitDef => {
    const reveals = h.opt('reveals');
    const announce = h.opt('announce');
    const habitId = id(h.at('id'));
    if (seen.has(habitId)) h.fail(`habitude en double « ${habitId} »`);
    seen.add(habitId);
    return {
      id: habitId,
      kind: h.at('kind').oneOf(HABIT_KINDS),
      label: h.at('label').string(),
      reveals: reveals === null ? [] : reveals.items().map(parseReveal),
      announce: announce === null ? null : announce.string(),
    };
  });
}

function parseReveal(r: Reader): HabitReveal {
  const text = r.at('text').string();
  const by = r.opt('by');
  const sign = r.opt('sign');
  if ((by === null) === (sign === null))
    r.fail('« by » (réplique) ou « sign » (écriteau) attendu, pas les deux');
  if (by !== null) return { kind: 'line', by: id(by), text };
  if (sign === null) return r.fail('« sign » attendu');
  return { kind: 'sign', sign: id(sign), text };
}

/** `self` dans le planning ou les dialogues d'un habitant: cet habitant (`birthday_of`). */
export function resolveSelf(conditions: Condition[], villager: string): void {
  for (const c of conditions) {
    if (c.type === 'birthday_of' && c.villager === 'self') c.villager = villager;
    else if (c.type === 'all' || c.type === 'any') resolveSelf(c.conditions, villager);
    else if (c.type === 'not') resolveSelf([c.condition], villager);
  }
}

const EMPTY_CALENDAR: VillageCalendar = {
  school: { weekdays: [], holidaySeasons: [] },
  specialDays: [],
  birthdays: {},
};

function birthdaysOnly(villagers: readonly VillagerDef[]): VillageCalendar['birthdays'] {
  const out: VillageCalendar['birthdays'] = {};
  for (const v of villagers) if (v.birthday !== null) out[v.id] = { ...v.birthday };
  return out;
}

/**
 * `calendrier.json` (absent: aucun jour particulier, aucune classe), et les anniversaires écrits
 * dans les habitants, contrôlés avec ses jours particuliers.
 */
export function parseVillageCalendar(
  r: Reader | null,
  settings: Pick<Settings, 'calendar'>,
  villagers: readonly VillagerDef[],
): VillageCalendar {
  if (r === null)
    return { ...structuredClone(EMPTY_CALENDAR), birthdays: birthdaysOnly(villagers) };
  const seasonDays = settings.calendar.seasonDays;
  const school = r.at('school');
  const specialDays = r
    .at('specialDays')
    .items()
    .map((d): SpecialDayDef => {
      const days: Partial<Record<Season, number[]>> = {};
      const byDay = d.opt('seasonDays');
      if (byDay !== null) {
        for (const [season, list] of byDay.entries()) {
          if (!SEASONS.includes(season as Season)) list.fail(`saison inconnue « ${season} »`);
          days[season as Season] = list.items().map((x) => x.integer(1, seasonDays));
        }
      }
      const week = d.opt('weekdays');
      const from = d.opt('from');
      const to = d.opt('to');
      const tier = d.opt('tier');
      const def: SpecialDayDef = {
        id: id(d.at('id')),
        name: d.at('name').string(),
        weekdays: week === null ? [] : weekdays(week),
        seasonDays: days,
        from: from === null ? null : from.time(),
        to: to === null ? null : to.time(),
        noSchool: d.opt('noSchool')?.boolean() ?? false,
        noBirthday: d.opt('noBirthday')?.boolean() ?? false,
        tier: tier === null ? 'P0' : tier.oneOf(['P0', 'P1'] as const),
      };
      if (def.weekdays.length === 0 && Object.keys(days).length === 0)
        d.fail('« weekdays » ou « seasonDays » attendu');
      return def;
    });
  const ids = new Set<string>();
  for (const d of specialDays) {
    if (ids.has(d.id))
      throw new ContentError(`calendrier.json: jour particulier en double « ${d.id} »`);
    ids.add(d.id);
  }
  // Les anniversaires sont écrits dans chaque habitant (`birthday`): une seule source.
  const birthdays: VillageCalendar['birthdays'] = {};
  const taken = new Map<string, string>();
  for (const v of villagers) {
    const b = v.birthday;
    if (b === null) continue;
    const where = `habitants: ${v.id}.birthday`;
    if (b.day > seasonDays)
      throw new ContentError(`${where}: jour de saison de 1 à ${String(seasonDays)} attendu`);
    const key = `${b.season}:${String(b.day)}`;
    const other = taken.get(key);
    if (other !== undefined)
      throw new ContentError(`${where}: le même jour que celui de « ${other} »`);
    taken.set(key, v.id);
    // Le jour de cette date la première année (une saison de 21 jours commence toujours un samedi).
    if (weekdayOf(SEASONS.indexOf(b.season) * seasonDays + b.day) === 0)
      throw new ContentError(`${where}: un samedi (jour du train)`);
    const busy = specialDays.find(
      (d) => d.noBirthday && (d.seasonDays[b.season] ?? []).includes(b.day),
    );
    if (busy !== undefined) throw new ContentError(`${where}: un jour particulier « ${busy.id} »`);
    birthdays[v.id] = { season: b.season, day: b.day };
  }
  return {
    school: {
      weekdays: weekdays(school.at('weekdays')),
      holidaySeasons: school
        .at('holidaySeasons')
        .items()
        .map((s) => s.oneOf(SEASONS)),
    },
    specialDays,
    birthdays,
  };
}

/**
 * Les répliques révélatrices (`reveals[]` à `by`) deviennent des répliques du quotidien de qui les
 * dit; le même texte du même habitant pour plusieurs habitudes n'en fait qu'une.
 */
export function revealDialogues(
  villagers: VillagerDef[],
  dialogues: Record<string, DialogueDef>,
): void {
  const byText = new Map<string, DialogueDef>();
  for (const v of villagers) {
    for (const h of v.habits) {
      h.reveals.forEach((r, i) => {
        if (r.kind !== 'line') return;
        const speaker = villagers.find((x) => x.id === r.by);
        if (speaker === undefined)
          throw new ContentError(
            `habitants: ${v.id}.habits.${h.id}.reveals[${String(i)}]: habitant inconnu « ${r.by} »`,
          );
        const ref: HabitRef = { villager: v.id, habit: h.id };
        const key = `${r.by}\n${r.text}`;
        const same = byText.get(key);
        if (same !== undefined) {
          same.reveals?.push(ref);
          return;
        }
        const dialogueId = `habit_${v.id}_${h.id}_${String(i)}`;
        if (dialogueId in dialogues)
          throw new ContentError(
            `habitants: dialogue en double « ${dialogueId} » (identifiant réservé aux répliques révélatrices)`,
          );
        const def: DialogueDef = {
          id: dialogueId,
          villager: r.by,
          kind: 'daily',
          shared: false,
          point: null,
          once: null,
          priority: 0,
          tier: 'P0',
          when: [],
          lines: [{ speaker: r.by, text: r.text }],
          choices: [],
          effects: [],
          reveals: [ref],
        };
        byText.set(key, def);
        dialogues[dialogueId] = def;
        speaker.dialogues.push(def);
      });
    }
  }
}

/** Les écriteaux cités par les habitudes, leurs lignes dans l'ordre des données. */
export function signsOf(villagers: readonly VillagerDef[]): Record<string, SignDef> {
  const signs: Record<string, SignDef> = {};
  for (const v of villagers) {
    for (const h of v.habits) {
      for (const r of h.reveals) {
        if (r.kind !== 'sign') continue;
        const sign = (signs[r.sign] ??= { id: r.sign, lines: [] });
        const line = sign.lines.find((l) => l.text === r.text);
        const ref = { villager: v.id, habit: h.id };
        if (line === undefined) sign.lines.push({ text: r.text, habits: [ref] });
        else line.habits.push(ref);
      }
    }
  }
  return signs;
}

/** Chaque entrée renvoie à une habitude de son habitant, chaque habitude a une entrée (sauf le marché). */
export function checkHabits(villagers: readonly VillagerDef[]): void {
  for (const v of villagers) {
    const ids = new Set(v.habits.map((h) => h.id));
    v.schedule.forEach((e, i) => {
      if (e.habit !== null && !ids.has(e.habit))
        throw new ContentError(
          `habitants: ${v.id}.schedule[${String(i)}]: habitude inconnue « ${e.habit} »`,
        );
    });
    for (const h of v.habits) {
      if (h.kind !== 'market' && !v.schedule.some((e) => e.habit === h.id))
        throw new ContentError(`habitants: ${v.id}.habits.${h.id}: aucune entrée du planning`);
    }
  }
}

/** Les conditions nouvelles citent des jours particuliers, des habitants et des habitudes qui existent. */
export function checkVillageReferences(content: Content): void {
  const days = new Set(content.villageCalendar.specialDays.map((d) => d.id));
  const visit = (list: readonly Condition[], where: string): void => {
    for (const c of list) {
      if (c.type === 'all' || c.type === 'any') visit(c.conditions, where);
      else if (c.type === 'not') visit([c.condition], where);
      else if (c.type === 'special_day' && !days.has(c.id))
        throw new ContentError(`${where}: jour particulier inconnu « ${c.id} » (calendrier.json)`);
      else if (c.type === 'birthday_of' && !content.villagers.some((v) => v.id === c.villager))
        throw new ContentError(`${where}: habitant inconnu « ${c.villager} »`);
      else if (c.type === 'habit_known' && !habitExists(content.villagers, c))
        throw new ContentError(`${where}: habitude inconnue « ${c.villager}.${c.habit} »`);
    }
  };
  for (const v of content.villagers)
    v.schedule.forEach((e, i) => {
      visit(e.when, `habitants: ${v.id}.schedule[${String(i)}]`);
    });
  for (const d of Object.values(content.dialogues)) {
    visit(d.when, `habitants: ${d.id}`);
    for (const ch of d.choices)
      if (ch.correct !== null) visit([ch.correct], `habitants: ${d.id}.${ch.id}`);
  }
  for (const q of content.quests) {
    visit(q.start.when, `quetes.json: ${q.id}`);
    for (const s of q.steps) visit(s.conditions, `quetes.json: ${q.id}.${s.id}`);
  }
  for (const e of content.envies)
    visit([...e.availableWhen, ...e.fulfilledWhen], `envies.json: ${e.id}`);
  const known = content.settings.habits.knownInEarlierSaves;
  for (const [villager, habits] of Object.entries(known)) {
    // Les habitudes de départ d'une partie reprise peuvent attendre leurs données (lot H4): seul l'habitant compte.
    if (!content.villagers.some((v) => v.id === villager) && habits.length > 0)
      throw new ContentError(
        `reglages.json: habits.knownInEarlierSaves: habitant inconnu « ${villager} »`,
      );
  }
}

/** `habit_known` et `reveal_habit` désignent une habitude existante. */
export function habitExists(villagers: readonly VillagerDef[], ref: HabitRef): boolean {
  return villagers.some((v) => v.id === ref.villager && v.habits.some((h) => h.id === ref.habit));
}

export const DEFAULT_HABIT_SETTINGS: HabitSettings = {
  seeDistance: 10,
  nightSeeDistance: 6,
  nightFrom: 21 * 60,
  watchSeconds: 2,
  arrivedDistance: 2,
  doorDistance: 10,
  signRange: 2,
  gossipAfterDays: 10,
  logKept: 30,
  announce: { distance: 5, minutes: 10, bondAtLeast: 250 },
  windowPoints: [],
  knownInEarlierSaves: {},
};

export const DEFAULT_BOND_SETTINGS: BondSettings = {
  earlierSaveStartPerQuest: 60,
  earlierSaveStartMax: 250,
};

/** `reglages.json`: `habits` et `bonds` (absents: les valeurs de la conception). */
export function parseHabitSettings(r: Reader | null): HabitSettings {
  const d = DEFAULT_HABIT_SETTINGS;
  if (r === null) return structuredClone(d);
  const num = (key: string, fallback: number): number => r.opt(key)?.number() ?? fallback;
  const announce = r.opt('announce');
  const known: Record<string, string[]> = {};
  for (const [villager, list] of r.opt('knownInEarlierSaves')?.entries() ?? [])
    known[villager] = list.stringList();
  const gossip = r.opt('gossipAfterDays');
  return {
    seeDistance: num('seeDistance', d.seeDistance),
    nightSeeDistance: num('nightSeeDistance', d.nightSeeDistance),
    nightFrom: r.opt('nightFrom')?.time() ?? d.nightFrom,
    watchSeconds: num('watchSeconds', d.watchSeconds),
    arrivedDistance: num('arrivedDistance', d.arrivedDistance),
    doorDistance: num('doorDistance', d.doorDistance),
    signRange: num('signRange', d.signRange),
    // Plage de la conception (4.8): de 7 à 21 jours.
    gossipAfterDays: gossip === null ? d.gossipAfterDays : gossip.integer(7, 21),
    logKept: r.opt('logKept')?.integer(1, 200) ?? d.logKept,
    announce: {
      distance: announce?.opt('distance')?.number() ?? d.announce.distance,
      minutes: announce?.opt('minutes')?.number() ?? d.announce.minutes,
      bondAtLeast: announce?.opt('bondAtLeast')?.number() ?? d.announce.bondAtLeast,
    },
    windowPoints: r.opt('windowPoints')?.stringList() ?? [],
    knownInEarlierSaves: known,
  };
}

export function parseBondSettings(r: Reader | null): BondSettings {
  const d = DEFAULT_BOND_SETTINGS;
  return {
    earlierSaveStartPerQuest:
      r?.opt('earlierSaveStartPerQuest')?.integer(0) ?? d.earlierSaveStartPerQuest,
    earlierSaveStartMax: r?.opt('earlierSaveStartMax')?.integer(0) ?? d.earlierSaveStartMax,
  };
}
