/**
 * Livraison des articles du catalogue de la semaine (tour 9, sections 2.4, 2.5 et 2.7): un outil
 * arrive dans le sac de celui qui l'a commandé (l'ancien va au coffre), une poule devant le
 * poulailler (Jeanne la nomme une demi-heure plus tard), un cadeau dans le sac de l'acheteur avec
 * sa quête « Un cadeau pour ... ». Le reste va au cellier, comme avant.
 */
import type { Character, CharacterId, Hen } from '../etat/types';
import { type Sim, character, emit, message, newId, notify, notifyKey, point } from './contexte';
import { POINT } from './ids';
import { addStack, countInBag, giveToCharacter, takeFromBag } from './sac';
import { startQuest } from './quetes';
import { crossed } from './train';
import { catalogueWindow } from '../donnees/commandes';
import { dayOfSeason, seasonOfDay } from '../donnees/calendrier';
import { lastGiverThisStep, villagerSays } from './annonces';

/** Minutes entre l'arrivée d'une poule et la venue de Jeanne (section 2.5: 10 h puis 10 h 30). */
export const HEN_NAMING_DELAY = 30;

/** Verbe de l'outil tenu ou de cet objet (`toolKind`), ou `null`. */
export function toolKindOf(sim: Pick<Sim, 'content'>, item: string | null | undefined): string | null {
  if (item === null || item === undefined) return null;
  return sim.content.items[item]?.tool?.toolKind ?? null;
}

/** Un outil amélioré: dans le sac de l'acheteur; l'outil du même verbe qu'il portait va au coffre. */
function deliverTool(sim: Sim, c: Character, item: string): void {
  const kind = toolKindOf(sim, item);
  let previous: string | null = null;
  for (const stack of c.bag) {
    if (stack === null || stack.item === item || toolKindOf(sim, stack.item) !== kind) continue;
    previous = stack.item;
    break;
  }
  if (previous !== null) {
    const slot = c.bag.findIndex((s) => s?.item === previous);
    const taken = takeFromBag(c, previous, countInBag(c, previous));
    for (const s of taken) addStack(sim.world.cellar, s.item, s.quality, s.count);
    giveToCharacter(sim, c, item, 'ordinary', 1);
    // L'outil neuf prend la case de l'ancien dans la barre d'outils, si elle est libre.
    const now = c.bag.findIndex((s) => s?.item === item);
    if (slot >= 0 && now >= 0 && now !== slot && c.bag[slot] === null) {
      c.bag[slot] = c.bag[now] ?? null;
      c.bag[now] = null;
    }
  } else {
    giveToCharacter(sim, c, item, 'ordinary', 1);
  }
  if (item in sim.content.items && kind === 'watering_can') c.water = Math.min(c.water, capacityOf(sim, item));
  emit(sim, { type: 'tool_upgraded', by: c.id, item, previous });
  const def = sim.content.items[item];
  notifyKey(sim, c.id, 'hint', 'tool_upgrade_hint', { item: def?.name ?? item });
}

/** Contenance de l'arrosoir `item` (sinon celle du premier arrosoir des objets). */
export function capacityOf(sim: Pick<Sim, 'content'>, item: string | null): number {
  const own = item === null ? null : (sim.content.items[item]?.capacity ?? null);
  if (own !== null) return own;
  return Object.values(sim.content.items).find((i) => i.capacity !== null)?.capacity ?? 0;
}

/** Une poule commandée: elle arrive devant le poulailler, pas encore nommée. */
function deliverHen(sim: Sim, item: string, by: CharacterId | null): void {
  const def = sim.content.catalogue?.hens[item];
  const s = sim.content.settings.hens;
  if (def === undefined || sim.world.hens.length >= s.max) {
    addStack(sim.world.cellar, item, 'ordinary', 1);
    return;
  }
  const at = point(sim, POINT.chickenCoop);
  const pos = { x: at.x + 0.6, y: at.y + 0.9 };
  const hen: Hen = {
    id: newId(sim, 'h'),
    name: def.name,
    variant: def.variant,
    pos,
    prev: { ...pos },
    facing: 0,
    wander: { ...pos },
    nameKnownBy: [],
    namedBy: by,
    arrivedDay: sim.world.clock.day,
  };
  sim.world.hens.push(hen);
  sim.runtime.changed = true;
  emit(sim, { type: 'hen_delivered', hen: hen.id, item, by });
}

/** Un cadeau: dans le sac de l'acheteur, et la quête « Un cadeau pour ... » démarre. */
function deliverGift(sim: Sim, c: Character, item: string): void {
  giveToCharacter(sim, c, item, 'ordinary', 1);
  const gift = sim.content.catalogue?.gifts.find((g) => g.item === item);
  if (gift !== undefined) startQuest(sim, gift.quest);
}

/**
 * Un colis du catalogue arrivé par le train: rangé selon sa sorte. Renvoie faux pour un article
 * d'avant le tour 9 (le cellier ou le portage à deux s'en chargent).
 */
export function deliverWeeklyItem(sim: Sim, item: string, by: CharacterId | null): boolean {
  const def = sim.content.items[item];
  if (def === undefined) return false;
  const buyer = character(sim, by ?? 'p1');
  if (def.category === 'tool' && def.tool !== null) {
    deliverTool(sim, buyer, item);
    return true;
  }
  if (def.category === 'animal_order') {
    deliverHen(sim, item, by);
    return true;
  }
  if (def.category === 'gift') {
    deliverGift(sim, buyer, item);
    return true;
  }
  return false;
}

/**
 * À l'heure de la livraison du samedi, la page de la semaine paraît (événement pour l'interface);
 * une demi-heure après, Jeanne vient nommer les poules arrivées du jour.
 */
export function catalogueClock(sim: Sim, before: number, after: number): void {
  const { world } = sim;
  const delivery = catalogueWindow(sim.content.settings, world.clock.day).delivery;
  if (world.clock.day !== delivery.day) return;
  const cat = sim.content.catalogue;
  if (cat !== null && crossed(before, after, delivery.time)) {
    const season = seasonOfDay(sim.content.settings, world.clock.day);
    const week = Math.floor((dayOfSeason(sim.content.settings, world.clock.day) - 1) / 7) + 1;
    const page = cat.pages.find((p) => p.season === season && p.week === week);
    if (page !== undefined) emit(sim, { type: 'catalogue_page', season, week, items: [...page.items] });
  }
  if (!crossed(before, after, delivery.time + HEN_NAMING_DELAY)) return;
  for (const hen of world.hens) {
    if (hen.arrivedDay !== world.clock.day || hen.nameKnownBy.length > 0) continue;
    nameHen(sim, hen);
  }
}

/**
 * Chaque pas: un cadeau remis (sa quête finie) est noté avec son jour; l'habitant remercie celui qui
 * l'a offert, dans la conversation (section 2.7).
 */
export function updateGifts(sim: Sim): void {
  const cat = sim.content.catalogue;
  if (cat === null) return;
  const { world } = sim;
  for (const g of cat.gifts) {
    if (g.villager in world.giftsGiven) continue;
    if (!world.quests.some((q) => q.id === g.quest && q.status === 'done')) continue;
    world.giftsGiven[g.villager] = world.clock.day;
    const by = lastGiverThisStep(sim, g.villager);
    villagerSays(sim, by, g.villager, message(sim, g.thanks));
    if (by !== null) emit(sim, { type: 'gift_given', by, villager: g.villager, item: g.item });
    sim.runtime.changed = true;
  }
}

/** Jeanne nomme la poule: son nom se voit chez les deux, sa réplique va à celui qui l'a commandée. */
export function nameHen(sim: Sim, hen: Hen): void {
  hen.nameKnownBy = ['p1', 'p2'];
  sim.runtime.changed = true;
  const entry = Object.values(sim.content.catalogue?.hens ?? {}).find((h) => h.name === hen.name);
  const to = hen.namedBy ?? 'both';
  const jeanne = sim.content.villagers.find((v) => v.id === 'jeanne')?.label ?? 'Jeanne';
  if (entry !== undefined) notify(sim, to, 'message', message(sim, 'villager_says', { villager: jeanne, text: message(sim, entry.naming) }), { key: entry.naming });
  emit(sim, { type: 'hen_named', hen: hen.id, name: hen.name, by: hen.namedBy });
}
