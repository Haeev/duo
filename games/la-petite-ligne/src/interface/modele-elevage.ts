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
import { countIn } from './format';

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
      colors: colors.map((id) => ({ id, label: labels[`color_${id}`] ?? id, have: have.has(id) })),
    },
  };
}
