/**
 * L'amitié côté simulation (0.13, lot H2; conception `v0-13-habitants.md`, section 6): un lien par
 * habitant, commun au duo, qui ne baisse jamais. Gains de la section 6.2: parler (une fois par
 * joueur et par jour), offrir selon ses goûts, souhaiter et fêter son anniversaire, finir ses
 * quêtes et ses annonces, connaître toutes ses habitudes; vente « Doux » au marché (`marche.ts`).
 */
import { annonceQuestId } from '../donnees/contenu';
import type { Content, Effect, QuestDef } from '../donnees/types';
import { bondLevel, bondOf, tasteOf } from '../etat/amitie';
import { isBirthday } from '../etat/planning';
import type { Character, CharacterId, DialogueChoiceView } from '../etat/types';
import type { TasteLevel } from '../etat/types-voisins';
import { birthdayKnown, habitCount } from '../etat/voisins';
import { villagerSays } from './annonces';
import { SCHEDULE_PERIOD_TICKS, SIM_DT } from './constantes';
import { type Sim, bump, distance, emit, itemWithArticle, message, notifyKey } from './contexte';
import { countInBag, takeFromBag } from './sac';
import { canObserve, currentHabit, revealHabit } from './voisins';

/** Choix « Bon anniversaire ! » ajouté à la conversation le jour de son anniversaire (6.2). */
export const BIRTHDAY_CHOICE = 'birthday_wish';

function villagerLabel(sim: Sim, villager: string): string {
  return sim.content.villagers.find((v) => v.id === villager)?.label ?? villager;
}

function isVillager(sim: Sim, villager: string): boolean {
  return sim.content.villagers.some((v) => v.id === villager);
}

/**
 * Ajoute au lien d'un habitant (jamais négatif, plafonné à `bonds.max`): la lanterne frémit chez
 * les deux (`bond_gain`); au passage d'un niveau, une lanterne s'allume et les deux le lisent.
 */
export function addBond(sim: Sim, villager: string, amount: number, by: CharacterId | null): void {
  if (!(amount > 0) || !isVillager(sim, villager)) return;
  const s = sim.content.settings.bonds;
  const before = bondOf(sim.world, villager);
  const after = Math.min(s.max, before + Math.round(amount));
  if (after <= before) return;
  sim.world.bonds[villager] = after;
  sim.runtime.changed = true;
  emit(sim, { type: 'bond_gain', villager, amount: after - before, bond: after, by });
  const from = bondLevel(s, before);
  const to = bondLevel(s, after);
  if (to <= from) return;
  const vars = { name: villagerLabel(sim, villager), level: message(sim, `bond_level_${String(to)}`) };
  notifyKey(sim, 'both', 'message', to === s.levels.length - 1 ? 'bond_level_up_family' : 'bond_level_up', vars);
  emit(sim, { type: 'bond_level', villager, level: to });
}

/**
 * Écrit un goût au carnet commun (une seule fois par objet): « Adore », « Aime », « N'aime pas »
 * chez les deux; un objet qui lui est égal se garde aussi, sans notification (le carnet ne le
 * montre pas). Rend `false` s'il y était déjà.
 */
export function revealTaste(sim: Sim, villager: string, item: string, by: CharacterId | null): boolean {
  if (!isVillager(sim, villager) || !(item in sim.content.items)) return false;
  const known = (sim.world.tastesKnown[villager] ??= {});
  if (item in known) return false;
  const taste = tasteOf(sim.content, villager, item);
  known[item] = taste;
  sim.runtime.changed = true;
  if (taste !== 'neutral')
    notifyKey(sim, 'both', 'message', `taste_found_${taste}`, {
      name: villagerLabel(sim, villager),
      item: itemWithArticle(sim, item, 1),
    });
  emit(sim, { type: 'taste_found', villager, item, taste, by });
  return true;
}

/** Ce qui ne s'offre pas: une sorte exclue (`bonds.giftExcluded`) ou un objet inconnu. */
function giftable(sim: Sim, item: string): boolean {
  const def = sim.content.items[item];
  return def !== undefined && !sim.content.settings.bonds.giftExcluded.includes(def.category);
}

/** Cadeaux du jour, par joueur (`countersToday`, remis à zéro à l'aube; la clé sert aussi à `gift_given`). */
function giftedToday(sim: Sim, c: Character, villager: string): boolean {
  return (sim.world.countersToday[c.id][`gift:${villager}`] ?? 0) > 0;
}

function giftReply(sim: Sim, villager: string, item: string, taste: TasteLevel): string {
  if (taste === 'dislikes') {
    const own = sim.content.villagers.find((v) => v.id === villager)?.tastes.dislikes.find((d) => d.item === item)?.reply;
    if (own !== undefined) return own;
  }
  return message(sim, `gift_reply_${taste}`);
}

/**
 * Offrir un objet du sac (intention `gift`, portée vérifiée par l'appelant). Un par habitant, par
 * joueur et par jour; le jour de son anniversaire, le gain est multiplié (`birthdayGiftFactor`) et
 * il le dit (son anniversaire s'écrit au carnet). Un objet qu'il n'aime pas: il le rend avec sa
 * réplique, rien n'est perdu, et le cadeau du jour reste à faire.
 */
export function offerGift(sim: Sim, c: Character, villager: string, item: string): void {
  if (!isVillager(sim, villager) || !giftable(sim, item) || countInBag(c, item) < 1) return;
  const s = sim.content.settings.bonds;
  const taste = tasteOf(sim.content, villager, item);
  const birthday = isBirthday(sim.content, villager, sim.world.clock.day);
  const v = sim.world.villagers.find((x) => x.id === villager);
  if (v !== undefined) v.met = true;
  if (taste === 'dislikes') {
    bump(sim, `gift:${villager}:dislikes`, c.id);
    villagerSays(sim, c.id, villager, giftReply(sim, villager, item, taste));
    revealTaste(sim, villager, item, c.id);
    emit(sim, { type: 'gift_offered', by: c.id, villager, item, taste, gain: 0, returned: true, birthday });
    return;
  }
  if (giftedToday(sim, c, villager)) {
    notifyKey(sim, c.id, 'message', 'gift_already_today', { name: villagerLabel(sim, villager) });
    return;
  }
  takeFromBag(c, item, 1);
  bump(sim, `gift:${villager}`, c.id);
  bump(sim, `gift:${villager}:${taste}`, c.id);
  const gain = s.gains.gift[taste] * (birthday ? s.gains.birthdayGiftFactor : 1);
  const reply = giftReply(sim, villager, item, taste);
  villagerSays(sim, c.id, villager, birthday ? `${reply} ${message(sim, 'gift_birthday')}` : reply);
  revealTaste(sim, villager, item, c.id);
  if (birthday) revealBirthday(sim, villager, c.id);
  addBond(sim, villager, gain, c.id);
  emit(sim, { type: 'gift_offered', by: c.id, villager, item, taste, gain, returned: false, birthday });
}

/** Il dit que c'est son anniversaire: ses habitudes d'anniversaire s'écrivent au carnet (`heard`). */
function revealBirthday(sim: Sim, villager: string, by: CharacterId): void {
  const def = sim.content.villagers.find((v) => v.id === villager);
  for (const h of def?.habits ?? [])
    if (h.kind === 'birthday') revealHabit(sim, { villager, habit: h.id }, 'heard', by, villager);
}

/** Première conversation du jour de ce joueur avec cet habitant (à appeler avant de compter `talked:`). */
export function talkBond(sim: Sim, c: Character, villager: string): void {
  if ((sim.world.countersToday[c.id][`talked:${villager}`] ?? 0) > 0) return;
  addBond(sim, villager, sim.content.settings.bonds.gains.talk, c.id);
}

/** Le choix « Bon anniversaire ! », le jour de son anniversaire connu au carnet, une fois par joueur. */
export function birthdayChoice(sim: Sim, c: Character, villager: string): DialogueChoiceView | null {
  if (!isBirthday(sim.content, villager, sim.world.clock.day)) return null;
  if (!birthdayKnown(sim.content, sim.world, villager)) return null;
  if ((sim.world.countersToday[c.id][`birthday_wish:${villager}`] ?? 0) > 0) return null;
  return { id: BIRTHDAY_CHOICE, text: message(sim, 'birthday_wish') };
}

/** « Bon anniversaire ! »: sa réplique de remerciement, et le gain (une fois par joueur, ce jour-là). */
export function wishBirthday(sim: Sim, c: Character, villager: string): { said: string; reply: string } | null {
  if (birthdayChoice(sim, c, villager) === null) return null;
  // Une clé du jour seulement: l'anniversaire ne revient qu'une fois par an.
  sim.world.countersToday[c.id][`birthday_wish:${villager}`] = 1;
  addBond(sim, villager, sim.content.settings.bonds.gains.birthdayWish, c.id);
  emit(sim, { type: 'birthday_wished', by: c.id, villager });
  return { said: message(sim, 'birthday_wish'), reply: message(sim, 'birthday_thanks') };
}

const annonceQuests = new WeakMap<Content, Set<string>>();

/** Les quêtes des annonces du tableau (elles ont leur propre gain, `gains.annonce`). */
function annonceQuestIds(content: Content): Set<string> {
  let ids = annonceQuests.get(content);
  if (ids === undefined) {
    ids = new Set(content.annonces.flatMap((a) => a.variants.map((_, i) => annonceQuestId(a, i))));
    annonceQuests.set(content, ids);
  }
  return ids;
}

function hasAddBond(effects: readonly Effect[], villager: string): boolean {
  return effects.some((e) =>
    e.type === 'add_bond' ? e.villager === villager : e.type === 'if' ? hasAddBond(e.then, villager) || hasAddBond(e.else, villager) : false,
  );
}

/**
 * Une quête finie (`quetes.ts`): une étape d'histoire s'inscrit dans `storyDone`; le lien de son
 * habitant grandit (`gains.story` pour une étape d'histoire, `gains.quest` pour une autre quête
 * dont il est le donneur), sauf si la quête le règle elle-même (`add_bond` pour lui dans ses
 * effets). Ni les annonces (gain à part), ni les quêtes qui reviennent chaque semaine.
 */
export function questBond(sim: Sim, quest: QuestDef, actor: CharacterId | null): void {
  const story = quest.story;
  if (story !== null && isVillager(sim, story.villager)) {
    const done = (sim.world.storyDone[story.villager] ??= []);
    if (!done.includes(quest.id)) done.push(quest.id);
    sim.runtime.changed = true;
  }
  const villager = story?.villager ?? quest.giver;
  if (quest.repeat !== null || annonceQuestIds(sim.content).has(quest.id)) return;
  if (hasAddBond(quest.completionEffects, villager)) return;
  const g = sim.content.settings.bonds.gains;
  addBond(sim, villager, story !== null ? g.story : g.quest, actor);
}

/** Toutes ses habitudes connues (section 4.6): une fois (drapeau `bond_all_habits:<habitant>`). */
export function allHabitsBond(sim: Sim, villager: string): void {
  const flag = `bond_all_habits:${villager}`;
  if (sim.world.flags.includes(flag)) return;
  const count = habitCount(sim.content, sim.world, villager);
  if (count.total === 0 || count.known < count.total) return;
  sim.world.flags.push(flag);
  addBond(sim, villager, sim.content.settings.bonds.gains.allHabits, null);
}

/**
 * Être là à son anniversaire (section 6.2): pendant son habitude d'anniversaire, un joueur à moins
 * de `birthdayPresence.distance`, `birthdayPresence.seconds` en tout; une fois ce jour-là, pour le
 * duo. Appelé au rythme des plannings.
 */
export function watchBirthdays(sim: Sim): void {
  const { world } = sim;
  const rule = sim.content.settings.bonds.birthdayPresence;
  const watch = sim.runtime.birthdayWatch;
  const period = SCHEDULE_PERIOD_TICKS * SIM_DT;
  for (const def of sim.content.villagers) {
    const habit = currentHabit(sim, def.id);
    const key = `birthday_here:${def.id}`;
    const kind = def.habits.find((h) => h.id === habit)?.kind;
    const v = world.villagers.find((x) => x.id === def.id);
    if (kind !== 'birthday' || v === undefined || (world.countersToday.duo[key] ?? 0) > 0) {
      watch.delete(def.id);
      continue;
    }
    const here = world.characters.filter((c) => canObserve(sim, c) && distance(c.pos, v.pos) <= rule.distance);
    if (here.length === 0) continue;
    const seconds = (watch.get(def.id) ?? 0) + period;
    watch.set(def.id, seconds);
    if (seconds < rule.seconds - 1e-9) continue;
    watch.delete(def.id);
    world.countersToday.duo[key] = 1;
    addBond(sim, def.id, sim.content.settings.bonds.gains.birthdayPresence, here.length === 1 ? (here[0]?.id ?? null) : null);
    for (const c of here) notifyKey(sim, c.id, 'message', 'birthday_attended', { name: def.label });
    emit(sim, { type: 'birthday_attended', villager: def.id });
  }
}

