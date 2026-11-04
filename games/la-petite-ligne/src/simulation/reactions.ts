/**
 * Réactions des habitants aux joueurs (0.13, lot H7, seconde moitié; `v0-13-habitants.md`, section
 * 7.3; textes et distances dans `gestes-0-13.json`). L'hôte décide; chaque réaction est un
 * événement `villager_remark` (bulle au-dessus de l'habitant chez le joueur visé), rien de plus
 * dans l'état transmis.
 *
 * Priorité (7.3; l'annonce d'une habitude est faite à part, `announceHabits`): prise rare, tenue,
 * coupe, ce que tu tiens, météo, la nuit, anniversaire, les deux ensemble, cadeau fait à un proche,
 * salut. Au plus `maxPerVillagerPerPlayerPerDay` réactions par habitant, par joueur et par jour,
 * jamais en conversation, dans un menu ou pendant une scène; une seule par joueur et par mise à jour
 * des plannings (deux habitants ne parlent pas en même temps au même joueur).
 *
 * Mémoire hors sauvegarde (`runtime`, comme les regards de 4.3): après une reprise, une réaction du
 * jour peut revenir une fois, et les tenues déjà portées comptent comme vues.
 */
import type { ReactionSettings, TextsByVillager } from '../donnees/gestes-0-13';
import { bondLevel, bondOf, tasteOf } from '../etat/amitie';
import { habitKnown, isBirthday } from '../etat/planning';
import type { Character, CharacterId, VillagerState } from '../etat/types';
import { SCHEDULE_PERIOD_TICKS } from './constantes';
import { type Runtime, type Sim, distance, emit, format, itemWithArticle } from './contexte';
import { revealTaste } from './amitie';
import { canObserve, revealHabit } from './voisins';

const HIDDEN = new Set(['home', 'absent']);
/** Points virtuels des scènes (première moitié du lot H7): pas de réaction pendant une scène. */
const SCENE_PREFIX = 'scene:';
const DAYS_PER_WEEK = 7;

interface RecentCatch {
  by: CharacterId;
  item: string;
  day: number;
  minutes: number;
  key: number;
}

interface RecentGift {
  by: CharacterId;
  villager: string;
  item: string;
  day: number;
  key: number;
}

interface Memory {
  day: number;
  /** Réactions du jour par `joueur:habitant`. */
  counts: Map<string, number>;
  /** Réactions déjà dites aujourd'hui (`sorte:joueur:habitant`). */
  done: Set<string>;
  /** Pour toujours (dans la séance): prises, cadeaux, coupes, ensemble de la semaine déjà commentés. */
  said: Set<string>;
  /** Tenues vues par chaque habitant sur chaque joueur (`habitant:joueur`). */
  outfits: Map<string, Set<string>>;
  /** Compliments de tenue du jour par joueur. */
  compliments: Map<CharacterId, number>;
  /** Rang du prochain texte de chaque réserve (`sorte:habitant`): « la moins récente ». */
  next: Map<string, number>;
  catches: RecentCatch[];
  gifts: RecentGift[];
  serial: number;
}

const memories = new WeakMap<Runtime, Memory>();

function memoryOf(sim: Sim): Memory {
  let m = memories.get(sim.runtime);
  if (m === undefined) {
    m = {
      day: sim.world.clock.day,
      counts: new Map(),
      done: new Set(),
      said: new Set(),
      outfits: new Map(),
      compliments: new Map(),
      next: new Map(),
      catches: [],
      gifts: [],
      serial: 0,
    };
    memories.set(sim.runtime, m);
  }
  if (m.day !== sim.world.clock.day) {
    m.day = sim.world.clock.day;
    m.counts.clear();
    m.done.clear();
    m.compliments.clear();
  }
  return m;
}

/** Première lettre en capitale (un texte qui commence par « {item} »: « Une perche ! »). */
function capitalized(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

function pick(m: Memory, kind: string, villager: string, texts: readonly string[], own?: TextsByVillager): string | null {
  const list = own?.[villager] ?? texts;
  if (list.length === 0) return null;
  const key = `${kind}:${villager}`;
  const n = m.next.get(key) ?? 0;
  m.next.set(key, n + 1);
  return list[n % list.length] ?? null;
}

/** Ce que les événements du pas apprennent: prises rares, cadeaux faits. */
function noteEvents(sim: Sim, s: ReactionSettings, m: Memory): void {
  for (const e of sim.events) {
    if (e.type === 'caught' && e.released !== true && e.rarity !== undefined && s.catch.rarities.includes(e.rarity)) {
      m.serial += 1;
      m.catches.push({ by: e.by, item: e.item, day: sim.world.clock.day, minutes: sim.world.clock.minutes, key: m.serial });
    } else if (e.type === 'gift_offered' && !e.returned && e.taste !== 'dislikes' && s.giftOther.tastes.includes(e.taste)) {
      m.serial += 1;
      m.gifts.push({ by: e.by, villager: e.villager, item: e.item, day: sim.world.clock.day, key: m.serial });
    }
  }
  // Rien à oublier la plupart du temps: aucune allocation à chaque pas.
  const { day, minutes } = sim.world.clock;
  if (m.catches.length > 0) m.catches = m.catches.filter((c) => c.day === day && minutes - c.minutes <= s.catch.minutes);
  if (m.gifts.length > 0) m.gifts = m.gifts.filter((g) => day - g.day <= s.giftOther.days);
}

function wornPieces(c: Character): string[] {
  const w = c.appearance.wear;
  const out = [w.top, w.bottom, w.shoes];
  if (w.outer !== null) out.push(w.outer);
  if (w.hat !== null) out.push(w.hat);
  return out;
}

function areClose(s: ReactionSettings, a: string, b: string): boolean {
  return s.giftOther.close.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function villagerLabel(sim: Sim, id: string): string {
  return sim.content.villagers.find((v) => v.id === id)?.label ?? id;
}

/** Une réaction possible, ou `null`; `apply` fait ses effets (carnet, mémoire) quand elle est dite. */
interface Reaction {
  kind: string;
  text: string;
  apply: () => void;
}

function chooseReaction(sim: Sim, s: ReactionSettings, m: Memory, c: Character, v: VillagerState, d: number): Reaction | null {
  const { world, content } = sim;
  const level = bondLevel(content.settings.bonds, bondOf(world, v.id));
  const dayKey = (kind: string): string => `${kind}:${c.id}:${v.id}`;
  const fresh = (kind: string): boolean => !m.done.has(dayKey(kind));

  // Prise rare de ce joueur, sur le coup ou dans l'heure, près de lui.
  if (d <= s.catch.distance) {
    for (const k of m.catches) {
      const key = `catch:${String(k.key)}:${v.id}`;
      if (k.by !== c.id || m.said.has(key)) continue;
      const text = pick(m, 'catch', v.id, s.catch.texts, s.catch.byVillager);
      if (text === null) break;
      return {
        kind: 'catch',
        text: capitalized(format(text, { item: itemWithArticle(sim, k.item, 1) })),
        apply: () => m.said.add(key),
      };
    }
  }

  // Tenue neuve: une pièce que cet habitant n'a jamais vue sur ce joueur.
  const seenKey = `${v.id}:${c.id}`;
  const pieces = wornPieces(c);
  let seen = m.outfits.get(seenKey);
  if (seen === undefined) {
    // Première fois qu'il le voit dans la séance: ce qu'il porte compte comme vu.
    seen = new Set(pieces);
    m.outfits.set(seenKey, seen);
  }
  const unseen = pieces.filter((p) => !seen.has(p));
  if (unseen.length > 0 && d <= s.outfit.distance) {
    const outfitSet = seen;
    if (level >= s.outfit.fromLevel && (m.compliments.get(c.id) ?? 0) < s.outfit.maxPerPlayerPerDay) {
      const text = pick(m, 'outfit', v.id, s.outfit.texts, s.outfit.byVillager);
      if (text !== null)
        return {
          kind: 'outfit',
          text,
          apply: () => {
            for (const p of unseen) outfitSet.add(p);
            m.compliments.set(c.id, (m.compliments.get(c.id) ?? 0) + 1);
          },
        };
    }
    // Sans compliment (lien trop faible, plafond atteint), la pièce est vue quand même.
    for (const p of unseen) seen.add(p);
  }

  // Coupe faite aujourd'hui au salon.
  const hairKey = `hair:${String(c.hairChangedDay)}:${c.id}:${v.id}`;
  if (c.hairChangedDay === world.clock.day && d <= s.haircut.distance && level >= s.haircut.fromLevel && !m.said.has(hairKey)) {
    const text = pick(m, 'haircut', v.id, s.haircut.texts, s.haircut.byVillager);
    if (text !== null) return { kind: 'haircut', text, apply: () => m.said.add(hairKey) };
  }

  // Ce que tu tiens en main: un objet qu'il adore, pas encore au carnet.
  const held = c.bag[c.selected]?.item ?? null;
  if (held !== null && d <= s.held.distance && tasteOf(content, v.id, held) === 'loves' && !(held in (world.tastesKnown[v.id] ?? {}))) {
    const text = pick(m, 'held', v.id, s.held.texts);
    if (text !== null)
      return {
        kind: 'held',
        text: capitalized(format(text, { item: itemWithArticle(sim, held, 1) })),
        apply: () => {
          revealTaste(sim, v.id, held, c.id);
        },
      };
  }

  // Sous la pluie, au passage.
  if (world.weather === 'rain' && d <= s.weather.distance && fresh('weather')) {
    const text = pick(m, 'weather', v.id, s.weather.rain);
    if (text !== null) return { kind: 'weather', text, apply: () => undefined };
  }

  // La nuit, dehors.
  if (world.clock.minutes >= s.nightFrom && v.inside === null && d <= s.night.distance && fresh('night')) {
    const text = pick(m, 'night', v.id, s.night.texts);
    if (text !== null) return { kind: 'night', text, apply: () => undefined };
  }

  // Son anniversaire: il le dit, et ses habitudes d'anniversaire s'écrivent au carnet.
  if (isBirthday(content, v.id, world.clock.day) && d <= s.birthday.distance && fresh('birthday')) {
    const text = pick(m, 'birthday', v.id, s.birthday.texts);
    if (text !== null)
      return {
        kind: 'birthday',
        text,
        apply: () => {
          const def = content.villagers.find((x) => x.id === v.id);
          for (const h of def?.habits ?? [])
            if (h.kind === 'birthday' && !habitKnown(world, v.id, h.id)) revealHabit(sim, { villager: v.id, habit: h.id }, 'heard', c.id, v.id);
        },
      };
  }

  // Les deux ensemble, une fois par semaine.
  const other = world.characters.find((x) => x.id !== c.id);
  const weekKey = `together:${String(Math.floor((world.clock.day - 1) / DAYS_PER_WEEK))}:${v.id}`;
  if (
    other !== undefined &&
    canObserve(sim, other) &&
    !m.said.has(weekKey) &&
    d <= s.together.distance &&
    distance(other.pos, v.pos) <= s.together.distance &&
    distance(other.pos, c.pos) <= s.together.playersDistance
  ) {
    const text = pick(m, 'together', v.id, s.together.texts);
    if (text !== null) return { kind: 'together', text, apply: () => m.said.add(weekKey) };
  }

  // Un cadeau fait par ce joueur à l'un de ses proches.
  if (d <= s.giftOther.distance) {
    for (const g of m.gifts) {
      const key = `gift:${String(g.key)}:${v.id}`;
      if (g.by !== c.id || g.villager === v.id || m.said.has(key) || !areClose(s, g.villager, v.id)) continue;
      const text = pick(m, 'gift', v.id, s.giftOther.texts);
      if (text === null) break;
      return {
        kind: 'gift',
        text: format(text, { item: itemWithArticle(sim, g.item, 1), name: villagerLabel(sim, g.villager) }),
        apply: () => m.said.add(key),
      };
    }
  }

  // Le salut, selon l'amitié: un signe de loin à partir du voisinage, sinon au passage.
  const g = s.greet;
  const greetRange = level >= g.waveFromLevel ? g.waveDistance : g.distance;
  if (d <= greetRange && fresh('greet')) {
    const evening = world.clock.minutes >= s.eveningFrom;
    const endearment = content.villageLife.endearments[v.id];
    const [list, kind] =
      level >= g.endearmentFromLevel && endearment !== undefined
        ? [evening ? g.dearEvening : g.dear, 'greet_dear']
        : level >= g.nameFromLevel
          ? [evening ? g.namedEvening : g.named, 'greet_named']
          : [evening ? g.strangerEvening : g.stranger, 'greet'];
    const text = pick(m, kind, v.id, list);
    if (text !== null)
      return { kind: 'greet', text: format(text, { player: c.name, endearment: endearment ?? '' }), apply: () => undefined };
  }
  return null;
}

/** À chaque pas: noter prises et cadeaux; à chaque mise à jour des plannings, faire parler qui doit. */
export function updateReactions(sim: Sim): void {
  const s = sim.content.villageLife.reactions;
  if (s === null) return;
  const m = memoryOf(sim);
  noteEvents(sim, s, m);
  if (sim.world.tick % SCHEDULE_PERIOD_TICKS !== 0 || sim.world.phase !== 'day') return;
  for (const c of sim.world.characters) {
    if (!canObserve(sim, c) || c.dialogue !== null || c.menu !== null) continue;
    const near: { v: VillagerState; d: number }[] = [];
    for (const v of sim.world.villagers) {
      if (!v.visible || HIDDEN.has(v.activity) || v.talkingWith.length > 0 || v.target.startsWith(SCENE_PREFIX)) continue;
      if (v.inside !== c.inside) continue;
      const d = distance(c.pos, v.pos);
      if (d > s.greet.waveDistance || (m.counts.get(`${c.id}:${v.id}`) ?? 0) >= s.maxPerVillagerPerPlayerPerDay) continue;
      near.push({ v, d });
    }
    // Le plus proche d'abord; égalité: l'ordre des habitants (même choix à chaque partie).
    near.sort((a, b) => a.d - b.d);
    for (const { v, d } of near) {
      const reaction = chooseReaction(sim, s, m, c, v, d);
      if (reaction === null) continue;
      reaction.apply();
      m.done.add(`${reaction.kind}:${c.id}:${v.id}`);
      const countKey = `${c.id}:${v.id}`;
      m.counts.set(countKey, (m.counts.get(countKey) ?? 0) + 1);
      emit(sim, { type: 'villager_remark', villager: v.id, to: c.id, text: reaction.text });
      break;
    }
  }
}
