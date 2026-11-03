// Garde-robe et boutique de vêtements (0.12, `docs/jeux/jeu-1/garde-robe-0-12.md`): achat refusé ou
// accepté au comptoir de Solange, stock identique chez les deux joueurs, migration de l'ancien
// `appearance.outfit`, la salopette qui masque le haut, se changer au bon endroit seulement.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../src/etat/actions';
import { clothesStock, mondayOf, starterWear, visiblePieces } from '../src/etat/garde-robe';
import type { CharacterId, WorldEvent, WorldState } from '../src/etat/types';
import { decodeSave, restoreWorld } from '../src/sauvegarde/sauvegarde';
import { TOWN } from '../src/simulation/bourg';
import { type Sim, character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { placeVillagers } from '../src/simulation/habitants';
import { step } from '../src/simulation/pas';
import { CLOTHES, stockToday } from '../src/simulation/vetements';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const H = 60;
/** Mardi 25 (le jour 1 est un samedi): la mercerie ouvre de 9 h à 12 h. */
const TUESDAY = 25;

function reference(file: string): { dataSchema: number; data: unknown } {
  const url = new URL(`./donnees/sauvegardes/${file}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as { dataSchema: number; data: unknown };
}

/** Le monde de l'été (sauvegarde de format 8 du mardi 25), Solange à son comptoir, les deux joueurs dans la mercerie. */
function atMercerie(minutes = 10 * H): Sim {
  const { content, map } = contentAndMap();
  const raw = reference('format-8-ete-jour-25.json');
  const sim = restoreWorld(content, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = TUESDAY;
  w.clock.minutes = minutes;
  w.scene = null;
  w.scripts = [];
  w.moments.today = null;
  for (const flag of [TOWN.achilleHere, TOWN.solangeHere, TOWN.letterSent, TOWN.salonOpen]) if (!w.flags.includes(flag)) w.flags.push(flag);
  placeVillagers(sim);
  for (const c of w.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.notifications = [];
    const at = sim.map.points[CLOTHES.counter];
    if (at === undefined) throw new Error('point du comptoir absent');
    placeCharacter(sim, c, { x: at.x + (c.id === 'p1' ? 0 : 0.4), y: at.y });
  }
  step(sim, { controls: {}, intents: [] });
  return sim;
}

function send(sim: Sim, by: CharacterId, intent: Intent): WorldEvent[] {
  sim.events = [];
  step(sim, { controls: {}, intents: [{ by, intent }] });
  return [...sim.events];
}

function said(sim: Sim, id: CharacterId, key: string): boolean {
  return character(sim, id).notifications.some((n) => n.key === key);
}

describe('boutique de vêtements de la mercerie', () => {
  it('refuse sans assez dans la bourse, accepte ensuite, puis refuse ce qui est déjà dans la garde-robe', () => {
    const sim = atMercerie();
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'menu', menu: 'clothes_shop' });
    expect(c.menu).toBe('clothes_shop');
    const item = stockToday(sim).find((id) => !c.wardrobe.includes(id));
    if (item === undefined) throw new Error('rien à acheter');
    const price = sim.content.clothes.byId[item]?.prix ?? 0;
    expect(price).toBeGreaterThan(0);

    sim.world.purse = price - 1;
    send(sim, 'p1', { type: 'clothes_buy', item });
    expect(said(sim, 'p1', 'not_enough_money')).toBe(true);
    expect(c.wardrobe).not.toContain(item);
    expect(sim.world.purse).toBe(price - 1);

    sim.world.purse = price + 5;
    const events = send(sim, 'p1', { type: 'clothes_buy', item });
    expect(c.wardrobe).toContain(item);
    expect(sim.world.purse).toBe(5);
    expect(events).toContainEqual({ type: 'bought', by: 'p1', item, count: 1, price });
    // Achat personnel: l'autre n'a rien reçu ni rien eu à accepter.
    expect(character(sim, 'p2').wardrobe).not.toContain(item);
    expect(sim.world.proposals).toEqual([]);

    send(sim, 'p1', { type: 'clothes_buy', item });
    expect(said(sim, 'p1', 'clothes_owned')).toBe(true);
    expect(sim.world.purse).toBe(5);

    // Dans la cabine: le porter tout de suite.
    const slot = sim.content.clothes.byId[item]?.slot ?? 'top';
    send(sim, 'p1', { type: 'wear', slot, item });
    expect(c.appearance.wear[slot]).toBe(item);
  });

  it('refuse hors du stock de la semaine et quand Solange n’est pas au comptoir', () => {
    const sim = atMercerie();
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'menu', menu: 'clothes_shop' });
    const absent = sim.content.clothes.list.find((d) => !stockToday(sim).includes(d.id) && !c.wardrobe.includes(d.id));
    if (absent !== undefined) {
      sim.world.purse = 1000;
      send(sim, 'p1', { type: 'clothes_buy', item: absent.id });
      expect(said(sim, 'p1', 'clothes_not_in_stock')).toBe(true);
      expect(c.wardrobe).not.toContain(absent.id);
    }
    const closed = atMercerie(13 * H);
    send(closed, 'p1', { type: 'menu', menu: 'clothes_shop' });
    expect(character(closed, 'p1').menu).toBeNull();
    expect(said(closed, 'p1', 'clothes_shop_closed')).toBe(true);
  });

  it('a le même stock chez l’hôte et chez l’invité (graine et jour), renouvelé le lundi', () => {
    const sim = atMercerie();
    const { content } = contentAndMap();
    // L'invité reçoit l'état en JSON: le stock ne dépend que de ce qu'il y lit.
    const guest = JSON.parse(JSON.stringify(sim.world)) as WorldState;
    const host = stockToday(sim);
    expect(clothesStock(content.clothes, content.settings, guest.seed, guest.clock.day)).toEqual(host);
    // Toute la semaine du lundi au dimanche, le même; la semaine d'après, un autre tirage.
    const monday = mondayOf(TUESDAY);
    for (let d = monday; d < monday + 7; d++) {
      const plain = clothesStock(content.clothes, content.settings, guest.seed, d).filter((id) => content.clothes.byId[id]?.saison === null);
      expect(plain).toEqual(host.filter((id) => content.clothes.byId[id]?.saison === null));
    }
    const w = content.clothes.settings.weeklyPieces;
    const weeks = Array.from({ length: 6 }, (_, k) => clothesStock(content.clothes, content.settings, guest.seed, monday + 7 * k).join(','));
    for (const week of weeks) expect(week.split(',').length).toBeLessThanOrEqual(w.max + 3 * content.clothes.settings.permanentPerSlot);
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it('ne laisse se changer qu’au coffre de la maison ou en cabine, et jamais sans haut, bas ni chaussures', () => {
    const sim = atMercerie();
    const c = character(sim, 'p1');
    const before = { ...c.appearance.wear };
    // Dans la mercerie, sans le menu de la boutique: pas de cabine.
    send(sim, 'p1', { type: 'wear', slot: 'top', item: c.wardrobe[0] ?? '' });
    expect(said(sim, 'p1', 'clothes_change_where')).toBe(true);
    send(sim, 'p1', { type: 'menu', menu: 'clothes_shop' });
    send(sim, 'p1', { type: 'wear', slot: 'top', item: null });
    expect(said(sim, 'p1', 'clothes_slot_required')).toBe(true);
    const other = sim.content.clothes.list.find((d) => d.slot === 'top' && !c.wardrobe.includes(d.id));
    if (other !== undefined) {
      send(sim, 'p1', { type: 'wear', slot: 'top', item: other.id });
      expect(said(sim, 'p1', 'clothes_not_owned')).toBe(true);
    }
    expect(c.appearance.wear).toEqual(before);
  });
});

describe('ce que l’on voit d’une tenue', () => {
  it('la salopette masque le haut; le chapeau et le par-dessus se voient', () => {
    const { content } = contentAndMap();
    const clothes = content.clothes;
    const overalls = clothes.list.find((d) => d.slot === 'bottom' && d.couvre.includes('top'));
    const top = clothes.list.find((d) => d.slot === 'top');
    const shoes = clothes.list.find((d) => d.slot === 'shoes');
    const hat = clothes.list.find((d) => d.slot === 'hat');
    if (overalls === undefined || top === undefined || shoes === undefined || hat === undefined) throw new Error('vêtements manquants');
    const shown = visiblePieces(clothes, { top: top.id, bottom: overalls.id, shoes: shoes.id, outer: null, hat: hat.id }).map((d) => d.id);
    expect(shown).not.toContain(top.id);
    expect(shown).toEqual(expect.arrayContaining([overalls.id, shoes.id, hat.id]));
  });
});

describe('migration de la sauvegarde (format 10 vers 11)', () => {
  it('remplace `outfit` par la tenue de départ du même rang, portée et rangée dans la garde-robe', () => {
    const { content, map } = contentAndMap();
    const raw = reference('format-10-fin-semaine-1.json');
    const old = (raw.data as { characters: { appearance: { outfit: number } }[] }).characters.map((c) => c.appearance.outfit);
    expect(raw.dataSchema).toBe(10);
    const sim = restoreWorld(content, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
    sim.world.characters.forEach((c, i) => {
      const wear = starterWear(content.clothes, old[i] ?? 0);
      expect(c.appearance.wear).toEqual(wear);
      expect(new Set(c.wardrobe)).toEqual(new Set([wear.top, wear.bottom, wear.shoes]));
      expect('outfit' in c.appearance).toBe(false);
    });
  });
});
