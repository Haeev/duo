/**
 * La basse-cour vue par l'interface (0.12, conception section 4): la fiche de la bête visée (nom,
 * humeur en un mot, « pas encore nourrie aujourd'hui »), et le panneau « La basse-cour » (bêtes,
 * grain, litière, couvée, noms à choisir, collection des six couleurs). Testés dans Node.
 */
import type { HappinessSettings } from '../donnees/types';
import { coopCapacity, findAnimal, moodOf, spotShorn } from '../etat/elevage';
import { henLabel } from '../etat/secrets';
import type { ReadonlyWorld } from '../etat/types';
import { type UiContext, characterOf, nameOf } from './contexte';
import { capitalize, countIn } from './format';

export type MoodKind = 'happy' | 'calm' | 'low';

export interface AnimalLine {
  id: string;
  name: string;
  /** « Ravie », « Tranquille »... vide pour le coq et les poussines. */
  mood: string;
  moodKind: MoodKind | null;
  /** Précisions: « pas encore nourrie aujourd'hui », « au nid », « suit Bichette ». */
  notes: string[];
}

export interface NamingModel {
  animal: string;
  mine: boolean;
  /** « Choisis un nom pour la poussine. » ou « Sacha choisit un nom pour la poussine. » */
  text: string;
  options: string[];
}

export interface FarmModel {
  naming: NamingModel | null;
  hens: AnimalLine[];
  chicks: AnimalLine[];
  rooster: AnimalLine | null;
  goats: AnimalLine[];
  capacity: string;
  grain: string;
  litter: string;
  litterFresh: boolean;
  brood: {
    running: string | null;
    help: string;
    options: { hen: string; label: string; enabled: boolean }[];
  };
  collection: { title: string; colors: { id: string; label: string; have: boolean }[] };
}

function moodWord(ctx: UiContext, kind: MoodKind, goat: boolean): string {
  const f = ctx.texts.extra.farm;
  if (goat) return kind === 'happy' ? f.goatHappy : kind === 'calm' ? f.goatCalm : f.goatLow;
  return kind === 'happy' ? f.moodHappy : kind === 'calm' ? f.moodCalm : f.moodLow;
}

function mood(
  ctx: UiContext,
  value: number,
  s: HappinessSettings,
  goat: boolean,
): { mood: string; moodKind: MoodKind } {
  const kind = moodOf(value, s);
  return { mood: moodWord(ctx, kind, goat), moodKind: kind };
}

/** Une ligne pour une bête, telle que ce joueur la connaît. */
export function animalLine(world: ReadonlyWorld, ctx: UiContext, id: string): AnimalLine | null {
  const ref = findAnimal(world, id);
  const f = ctx.texts.extra.farm;
  const care = ctx.content.settings.hens.care;
  const goats = ctx.content.settings.goats;
  if (ref === null) return null;
  if (ref.kind === 'hen') {
    const hen = ref.animal;
    const notes: string[] = [];
    if (world.breeding.brood?.hen === hen.id) notes.push(f.brooding);
    if (world.hens.length > 0) notes.push(world.feederFilled ? f.fed : f.notFed);
    const m =
      care === null
        ? { mood: '', moodKind: null }
        : mood(ctx, hen.happiness, care.happiness, false);
    return { id, name: henLabel(world, ctx.content, hen, ctx.me), ...m, notes };
  }
  if (ref.kind === 'chick') {
    const chick = world.breeding.chicks.find((c) => c.id === id);
    const mother = world.hens.find((h) => h.id === chick?.mother);
    const notes =
      chick?.roosterling === true
        ? [f.roosterling]
        : mother === undefined
          ? []
          : [ctx.t(f.chickOf, { mother: henLabel(world, ctx.content, mother, ctx.me) })];
    return {
      id,
      name: ref.animal.name === '' ? f.unnamed : ref.animal.name,
      mood: '',
      moodKind: null,
      notes,
    };
  }
  if (ref.kind === 'rooster')
    return {
      id,
      name: ref.animal.name === '' ? f.unnamed : ref.animal.name,
      mood: '',
      moodKind: null,
      notes: [],
    };
  const goat = ref.animal;
  const notes: string[] = [];
  const day = world.clock.day;
  if (goat.led !== null) notes.push(ctx.t(f.goatLed, { name: nameOf(world, goat.led) }));
  else if (goat.home && world.clock.minutes >= (goats?.homeAt ?? 1200)) notes.push(f.goatHome);
  if (goats !== null && goat.milkedDay !== day && world.clock.minutes < goats.milkUntil)
    notes.push(f.goatToMilk);
  if (goat.milkedDay === day) notes.push(f.goatMilked);
  notes.push(goat.wateredDay === day ? f.goatWatered : f.goatThirsty);
  if (
    goats !== null &&
    !goat.home &&
    goat.led === null &&
    goat.freshToday !== true &&
    spotShorn(world.breeding.grazed, goat.stake, day - 1, goats.happiness.freshDays)
  )
    notes.push(f.goatShorn);
  const m =
    goats === null
      ? { mood: '', moodKind: null }
      : mood(ctx, goat.happiness, goats.happiness, true);
  return { id, name: goat.name === '' ? f.unnamed : goat.name, ...m, notes };
}

/** La fiche de la bête visée (clavier ou souris), ou `null`. */
export function animalCardModel(world: ReadonlyWorld, ctx: UiContext): AnimalLine | null {
  const id = characterOf(world, ctx.me)?.aim?.animal;
  return id === undefined ? null : animalLine(world, ctx, id);
}

function namingModel(world: ReadonlyWorld, ctx: UiContext): NamingModel | null {
  const request = world.breeding.naming[0];
  if (request === undefined) return null;
  const f = ctx.texts.extra.farm;
  const what =
    request.kind === 'chick'
      ? f.whatChick
      : request.kind === 'rooster'
        ? f.whatRooster
        : f.whatGoat;
  const mine = request.by === ctx.me;
  return {
    animal: request.animal,
    mine,
    text: mine
      ? ctx.t(f.namingMine, { what })
      : ctx.t(f.namingPartner, { partner: nameOf(world, request.by), what }),
    options: [...request.options],
  };
}

export function farmModel(world: ReadonlyWorld, ctx: UiContext): FarmModel {
  const f = ctx.texts.extra.farm;
  const care = ctx.content.settings.hens.care;
  const b = world.breeding;
  const line = (id: string): AnimalLine | null => animalLine(world, ctx, id);
  const present = (x: AnimalLine | null): x is AnimalLine => x !== null;
  const day = world.clock.day;
  const grainFree = care === null || day < care.grain.fromDay;
  const litterFresh =
    care !== null && b.strawDay !== null && day - b.strawDay <= care.happiness.strawDays;
  const me = characterOf(world, ctx.me);
  const eggs = me === null ? 0 : countIn(me.bag, 'egg');
  const capacity = coopCapacity(ctx.content, world);
  const headcount = world.hens.length + b.chicks.length;
  let running: string | null = null;
  if (b.brood !== null && care !== null) {
    const hen = world.hens.find((h) => h.id === b.brood?.hen);
    const left = Math.max(1, b.brood.startDay + care.brood.nights - day);
    running = ctx.t(f.broodRunning, {
      name: hen === undefined ? '' : henLabel(world, ctx.content, hen, ctx.me),
      nights: left,
    });
  }
  const options =
    care === null || b.brood !== null || b.rooster === null
      ? []
      : world.hens
          .filter((h) => h.happiness >= care.happiness.broodFrom)
          .map((h) => ({
            hen: h.id,
            label: ctx.t(f.broodButton, { name: henLabel(world, ctx.content, h, ctx.me) }),
            enabled: eggs >= care.brood.eggs && headcount + care.brood.eggs <= capacity,
          }));
  const help =
    b.brood !== null
      ? ''
      : b.rooster === null
        ? f.broodNoRooster
        : options.length === 0
          ? f.broodNobody
          : f.broodHelp;
  const colors = care?.colors ?? [];
  const have = new Set([
    ...world.hens.map((h) => h.variant),
    ...b.chicks.filter((c) => c.roosterling !== true).map((c) => c.variant),
  ]);
  const labels: Readonly<Record<string, string | undefined>> = {
    hen_white: f.color_hen_white,
    hen_red: f.color_hen_red,
    hen_black: f.color_hen_black,
    hen_golden: f.color_hen_golden,
    hen_ash: f.color_hen_ash,
    hen_cuckoo: f.color_hen_cuckoo,
  };
  return {
    naming: namingModel(world, ctx),
    hens: world.hens.map((h) => line(h.id)).filter(present),
    chicks: b.chicks.map((c) => line(c.id)).filter(present),
    rooster: b.rooster === null ? null : line(b.rooster.id),
    goats: b.goats.map((g) => line(g.id)).filter(present),
    capacity: ctx.t(f.capacity, { count: headcount, max: capacity }),
    grain: grainFree
      ? f.grainFree
      : b.grainRations > 0
        ? ctx.t(f.grain, { rations: b.grainRations })
        : f.grainEmpty,
    litter: litterFresh ? f.litterFresh : f.litterOld,
    litterFresh,
    brood: { running, help, options },
    collection: {
      title: ctx.t(f.collection, {
        count: colors.filter((c) => have.has(c)).length,
        total: colors.length,
      }),
      colors: colors.map((id) => ({ id, label: capitalize(labels[id] ?? f.collectionMissing), have: have.has(id) })),
    },
  };
}

// ---------------------------------------------------------------------------
// Patch 0.12.2: la basse-cour en icônes et en jauges (portraits, cœur, grain, litière, couvée)

export interface HenCardModel {
  id: string;
  kind: 'hen' | 'chick' | 'rooster' | 'goat';
  name: string;
  /** Robe (`hen_white`...), `rooster_golden` pour le coq, `goat` pour une chèvre. */
  robe: string;
  /** Bonheur de 0 à 1 (`null`: pas de jauge, coq et poussines). */
  heart: number | null;
  mood: string;
  moodKind: MoodKind | null;
  /** Nourrie aujourd'hui (poules), `null` pour les autres bêtes. */
  fed: boolean | null;
  brooding: boolean;
  /** Peut être mise à couver maintenant (`enabled`), ou visible et grisée; `null`: pas assez ravie, ou sans coq. */
  brood: { enabled: boolean; label: string } | null;
  /** Poussine: la poule qu'elle suit. Chèvre: qui la mène. */
  follows: string | null;
  /** Chèvre: traite (vrai), à traire (faux), `null` hors des heures de traite. */
  milked: boolean | null;
  watered: boolean | null;
  home: boolean;
  shorn: boolean;
  /** Précisions en mots (nom accessible de la carte). */
  notes: string[];
}

export interface FarmBoardModel {
  naming: NamingModel | null;
  animals: HenCardModel[];
  hens: number;
  places: { used: number; max: number; label: string };
  /**
   * Le grain de la mangeoire: rations, jours de réserve (rations divisées par la ration du jour de
   * toutes les poules), sacs dans le sac du joueur, et la mangeoire à trémie (catalogue).
   */
  grain: { free: boolean; rations: number; perSack: number; days: number; sacks: number; hopper: boolean; label: string } | null;
  litter: { fresh: boolean; daysLeft: number; days: number; label: string } | null;
  fed: boolean | null;
  brood: {
    running: { hen: string; nightsLeft: number; nights: number; label: string } | null;
    /** Les conditions de la couvée, remplies ou barrées. */
    needs: { key: 'rooster' | 'eggs' | 'happy' | 'place'; have: number; need: number; label: string }[];
    help: string;
  };
  collection: { count: number; total: number; label: string; robes: { id: string; name: string; have: boolean }[] };
}

function emptyCard(id: string, kind: HenCardModel['kind'], name: string, robe: string): HenCardModel {
  return { id, kind, name, robe, heart: null, mood: '', moodKind: null, fed: null, brooding: false, brood: null, follows: null, milked: null, watered: null, home: false, shorn: false, notes: [] };
}

/** La basse-cour en cartes et en jauges, pour le joueur `ctx.me`. */
export function farmBoard(world: ReadonlyWorld, ctx: UiContext): FarmBoardModel {
  const f = ctx.texts.extra.farm;
  const v = ctx.texts.extra.vitrine;
  const care = ctx.content.settings.hens.care;
  const goatsSettings = ctx.content.settings.goats;
  const old = farmModel(world, ctx);
  const b = world.breeding;
  const day = world.clock.day;
  const me = characterOf(world, ctx.me);
  const eggs = me === null ? 0 : countIn(me.bag, 'egg');
  const capacity = coopCapacity(ctx.content, world);
  const headcount = world.hens.length + b.chicks.length;
  const ratio = (value: number, max: number): number => Math.max(0, Math.min(1, value / Math.max(1, max)));
  const henCards = world.hens.map((h): HenCardModel => {
    const line = animalLine(world, ctx, h.id);
    const option = old.brood.options.find((o) => o.hen === h.id);
    return {
      ...emptyCard(h.id, 'hen', line?.name ?? h.name, h.variant),
      heart: care === null ? null : ratio(h.happiness, care.happiness.max),
      mood: line?.mood ?? '',
      moodKind: line?.moodKind ?? null,
      fed: world.feederFilled,
      brooding: b.brood?.hen === h.id,
      brood: option === undefined ? null : { enabled: option.enabled, label: option.label },
      notes: line?.notes ?? [],
    };
  });
  const chickCards = b.chicks.map((c): HenCardModel => {
    const line = animalLine(world, ctx, c.id);
    const mother = world.hens.find((h) => h.id === c.mother);
    return {
      ...emptyCard(c.id, 'chick', line?.name ?? c.name, c.variant),
      follows: mother === undefined ? null : henLabel(world, ctx.content, mother, ctx.me),
      notes: line?.notes ?? [],
    };
  });
  const rooster = b.rooster;
  const roosterCards = rooster === null ? [] : [emptyCard(rooster.id, 'rooster', rooster.name === '' ? f.unnamed : rooster.name, rooster.variant)];
  const goatCards = b.goats.map((g): HenCardModel => {
    const line = animalLine(world, ctx, g.id);
    const notes = line?.notes ?? [];
    const milkOpen = goatsSettings !== null && world.clock.minutes < goatsSettings.milkUntil;
    return {
      ...emptyCard(g.id, 'goat', line?.name ?? g.name, 'goat'),
      heart: goatsSettings === null ? null : ratio(g.happiness, goatsSettings.happiness.max),
      mood: line?.mood ?? '',
      moodKind: line?.moodKind ?? null,
      follows: g.led === null ? null : nameOf(world, g.led),
      milked: g.milkedDay === day ? true : milkOpen ? false : null,
      watered: g.wateredDay === day,
      home: g.led === null && g.home && world.clock.minutes >= (goatsSettings?.homeAt ?? 1200),
      shorn: notes.includes(f.goatShorn),
      notes,
    };
  });
  let running: FarmBoardModel['brood']['running'] = null;
  if (b.brood !== null && care !== null) {
    const hen = world.hens.find((h) => h.id === b.brood?.hen);
    const left = Math.max(1, b.brood.startDay + care.brood.nights - day);
    running = { hen: hen === undefined ? '' : henLabel(world, ctx.content, hen, ctx.me), nightsLeft: left, nights: care.brood.nights, label: old.brood.running ?? '' };
  }
  const happyFrom = care?.happiness.broodFrom ?? 70;
  const needEggs = care?.brood.eggs ?? 3;
  const needs: FarmBoardModel['brood']['needs'] =
    care === null || b.brood !== null
      ? []
      : [
          { key: 'rooster', have: b.rooster === null ? 0 : 1, need: 1, label: ctx.t(v.broodRooster) },
          { key: 'eggs', have: eggs, need: needEggs, label: ctx.t(v.broodEggs, { have: Math.min(eggs, needEggs), need: needEggs }) },
          { key: 'happy', have: world.hens.some((h) => h.happiness >= happyFrom) ? 1 : 0, need: 1, label: ctx.t(v.broodHappy) },
          { key: 'place', have: headcount + needEggs <= capacity ? 1 : 0, need: 1, label: ctx.t(v.broodPlace) },
        ];
  const grainFree = care === null || day < care.grain.fromDay;
  const reserveDays = Math.floor(b.grainRations / Math.max(1, world.hens.length * (care?.grain.perHen ?? 1)));
  const strawDays = care?.happiness.strawDays ?? 3;
  const sinceStraw = b.strawDay === null ? null : day - b.strawDay;
  const collected = old.collection.colors.filter((c) => c.have).length;
  const total = old.collection.colors.length;
  return {
    naming: old.naming,
    animals: [...henCards, ...chickCards, ...roosterCards, ...goatCards],
    hens: world.hens.length,
    places: { used: headcount, max: capacity, label: old.capacity },
    grain:
      world.hens.length === 0
        ? null
        : {
            free: grainFree,
            rations: b.grainRations,
            perSack: care?.grain.rations ?? 30,
            days: reserveDays,
            sacks: me === null ? 0 : countIn(me.bag, care?.grain.item ?? 'grain_sack'),
            hopper: care !== null && (world.catalogueBought[care.grain.hopper] ?? 0) > 0,
            label: grainFree ? ctx.t(v.grainFreeLabel) : ctx.t(v.grainLabel, { rations: b.grainRations, days: reserveDays, hens: world.hens.length }),
          },
    litter:
      world.hens.length === 0
        ? null
        : { fresh: old.litterFresh, daysLeft: sinceStraw === null ? 0 : Math.max(0, strawDays + 1 - sinceStraw), days: strawDays + 1, label: old.litter },
    fed: world.hens.length === 0 ? null : world.feederFilled,
    brood: { running, needs, help: old.brood.help },
    collection: {
      count: collected,
      total,
      label: ctx.t(v.collection, { count: collected, total }),
      robes: old.collection.colors.map((c) => ({ id: c.id, name: c.label, have: c.have })),
    },
  };
}
