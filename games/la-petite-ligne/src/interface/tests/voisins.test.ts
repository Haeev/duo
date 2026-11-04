// Onglet Voisins du carnet (0.13, lot H3; `docs/jeux/jeu-1/v0-13-habitants.md`, sections 4 et 6):
// les modèles purs de la grille, de la fiche, de la frise, du bourg et des cartes de notification.
// Le carnet ne montre jamais ce que le duo ignore (lieu d'une habitude inconnue), chaque lieu des
// plannings a son picto, chaque habitant son portrait et son métier en picto, aucun identifiant brut.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { habitKnown } from '../../etat/planning';
import { likelyWhereabouts } from '../../etat/voisins';
import type { Sim } from '../../simulation/contexte';
import { message } from '../../simulation/contexte';
import {
  NEIGHBOUR_ACTIVITY_ICONS,
  NEIGHBOUR_JOB_ICONS,
  NEIGHBOUR_PLACE_ICONS,
  NEIGHBOUR_POINT_PLACES,
} from '../config';
import {
  habitToast,
  neighbourBoard,
  neighbourPage,
  placeOf,
  timelineOf,
  townModel,
} from '../modele-voisins';
import { villagerColors } from '../portrait';
import { newSim, uiContext } from './aides';

const sprite = readFileSync(
  fileURLToPath(new URL('../../../ui-maquettes/icones.svg', import.meta.url)),
  'utf8',
);
const symbols = new Set([...sprite.matchAll(/<symbol id="([a-z0-9-]+)"/g)].map((m) => m[1]));

/** Un milieu de partie: tous rencontrés sauf trois, la moitié des habitudes au carnet, quelques goûts. */
function middle(): Sim {
  const sim = newSim();
  const w = sim.world;
  w.phase = 'day';
  w.flags.push('lucie_back');
  sim.content.villagers.forEach((def, i) => {
    const state = w.villagers.find((v) => v.id === def.id);
    if (state !== undefined) state.met = !['ambroise', 'leon', 'paulin'].includes(def.id);
    w.habits.known[def.id] = def.habits.filter((_, j) => (i + j) % 2 === 0).map((h) => h.id);
    w.bonds[def.id] = (i * 97) % 1001;
    const love = def.tastes.loves[0];
    if (love !== undefined && i % 2 === 0) w.tastesKnown[def.id] = { [love]: 'loves' };
  });
  return sim;
}

const RAW = /\b[a-z]+_[a-z_]+\b/;
const UNFILLED = /\{[a-zA-Z]+\}/;
// Tirets interdits (demi-cadratin, cadratin), écrits par leur code: le dépôt n'en contient aucun.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe('onglet Voisins: la grille des portraits', () => {
  it('montre les 21 habitants, en silhouette « Une personne inconnue » avant la rencontre', () => {
    const sim = middle();
    const ctx = uiContext();
    const board = neighbourBoard(sim.world, ctx);
    expect(board.cards).toHaveLength(21);
    expect(board.met).toBe(18);
    const ambroise = board.cards.find((c) => c.id === 'ambroise');
    expect(ambroise?.met).toBe(false);
    expect(ambroise?.name).toBe('Une personne inconnue');
    for (const c of board.cards) {
      expect(c.label).not.toMatch(RAW);
      expect(c.label).not.toMatch(UNFILLED);
      expect(c.label).not.toMatch(DASHES);
      expect(c.bond.quarters).toBeGreaterThanOrEqual(0);
      expect(c.bond.quarters).toBeLessThanOrEqual(4);
    }
    expect(board.town.total).toBeGreaterThan(150);
  });

  it('« maintenant » ne dit jamais un lieu qui n’est pas au carnet (100 instants tirés)', () => {
    const sim = middle();
    const ctx = uiContext();
    const w = sim.world;
    let checked = 0;
    for (let k = 0; k < 100; k++) {
      w.clock.day = 1 + ((k * 7) % 84);
      w.clock.minutes = 360 + ((k * 131) % 1080);
      w.weather = k % 5 === 0 ? 'rain' : 'sunny';
      for (const card of neighbourBoard(w, ctx).cards) {
        const where = likelyWhereabouts(ctx.content, w, card.id);
        if (where.kind === 'unknown') {
          expect(card.now.place).toBeNull();
          continue;
        }
        expect(habitKnown(w, card.id, where.habit.id)).toBe(true);
        expect(card.now.place).toEqual(placeOf(ctx, where.point, where.activity));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('avant toute découverte, aucun lieu à l’écran (pastilles « ? », frise en pointillé, bourg vide)', () => {
    const sim = newSim();
    const ctx = uiContext();
    sim.world.phase = 'day';
    sim.world.clock.minutes = 14 * 60;
    for (const v of sim.world.villagers) v.met = true;
    for (const id of Object.keys(sim.world.habits.known)) sim.world.habits.known[id] = [];
    const board = neighbourBoard(sim.world, ctx);
    expect(board.cards.every((c) => c.now.place === null)).toBe(true);
    for (const def of ctx.content.villagers) {
      const segments = timelineOf(ctx, sim.world, def, sim.world.clock.day, 'sunny', 'aujourd’hui');
      expect(segments.every((s) => !s.known && s.place === null)).toBe(true);
    }
    const town = townModel(sim.world, ctx);
    expect(town.spots.every((s) => s.villagers.length === 0)).toBe(true);
    expect(town.elsewhere).toEqual([]);
  });
});

describe('onglet Voisins: la fiche et la frise', () => {
  it('la frise couvre la journée de 6 h à minuit sans trou; une case connue a son lieu, une inconnue n’en a pas', () => {
    const sim = middle();
    const ctx = uiContext();
    for (const def of ctx.content.villagers) {
      const segments = timelineOf(ctx, sim.world, def, 25, 'sunny', 'mardi');
      expect(segments[0]?.from).toBe(360);
      expect(segments[segments.length - 1]?.to).toBe(1440);
      segments.forEach((s, i) => {
        if (i > 0) expect(s.from).toBe(segments[i - 1]?.to);
        expect(s.known).toBe(s.place !== null);
        expect(s.label).not.toMatch(RAW);
        expect(s.label).not.toMatch(UNFILLED);
      });
    }
  });

  it('toutes les habitudes connues: plus aucune case inconnue pour les habitants de la 0.13', () => {
    const sim = middle();
    const ctx = uiContext();
    for (const def of ctx.content.villagers)
      sim.world.habits.known[def.id] = def.habits.map((h) => h.id);
    for (const def of ctx.content.villagers.filter((v) => v.habits.length > 0)) {
      for (const day of [22, 23, 24, 25, 26, 27, 28]) {
        const segments = timelineOf(ctx, sim.world, def, day, 'sunny', 'jour');
        expect(
          segments.filter((s) => !s.known),
          `${def.id} jour ${String(day)}`,
        ).toEqual([]);
      }
    }
  });

  it('la fiche: métier, logis, anniversaire connu ou « ? », goûts découverts et cases « ? », « n sur N »', () => {
    const sim = middle();
    const ctx = uiContext();
    const w = sim.world;
    const berthe = ctx.content.villagers.find((v) => v.id === 'berthe');
    if (berthe === undefined) throw new Error('Berthe absente');
    w.habits.known.berthe = berthe.habits.filter((h) => h.kind !== 'birthday').map((h) => h.id);
    w.tastesKnown.berthe = {
      [berthe.tastes.loves[0] ?? '']: 'loves',
      [berthe.tastes.dislikes[0]?.item ?? '']: 'dislikes',
    };
    const page = neighbourPage(w, ctx, 'berthe', { offset: 0, weather: null });
    expect(page?.name).toBe('Berthe');
    expect(page?.jobIcon).toBe('place-mill');
    expect(page?.home).toBe('à l’étage du moulin de la Vanne'.replace('’', "'"));
    expect(page?.birthday?.known).toBe(false);
    const loves = page?.tastes.find((g) => g.taste === 'loves');
    expect(loves?.slots.filter((s) => s.item !== null)).toHaveLength(1);
    expect(loves?.slots).toHaveLength(berthe.tastes.loves.length);
    const likes = page?.tastes.find((g) => g.taste === 'likes');
    expect(likes?.slots.every((s) => s.item === null)).toBe(true);
    expect(page?.count.known).toBe(w.habits.known.berthe.length);
    // L'anniversaire au carnet: la date paraît.
    w.habits.known.berthe = berthe.habits.map((h) => h.id);
    const known = neighbourPage(w, ctx, 'berthe', { offset: 0, weather: null });
    expect(known?.birthday).toMatchObject({ known: true, season: 'winter', day: 7 });
    expect(known?.allKnown).toBe(true);
    // Avant la rencontre: ni métier ni logis ni goûts.
    const unmet = neighbourPage(w, ctx, 'ambroise', { offset: 0, weather: null });
    expect(unmet?.met).toBe(false);
    expect(unmet?.jobIcon).toBeNull();
    expect(unmet?.home).toBeNull();
    expect(unmet?.tastes).toEqual([]);
  });

  it('le sélecteur de jour paraît quand la journée change dans la semaine, et la frise suit le jour choisi', () => {
    const sim = middle();
    const ctx = uiContext();
    const w = sim.world;
    const lucie = ctx.content.villagers.find((v) => v.id === 'lucie');
    if (lucie === undefined) throw new Error('Lucie absente');
    w.habits.known.lucie = lucie.habits.map((h) => h.id);
    const today = neighbourPage(w, ctx, 'lucie', { offset: 0, weather: null });
    expect(today?.days).toHaveLength(7);
    expect(today?.days?.[0]?.today).toBe(true);
    expect(today?.nowMinute).toBe(w.clock.minutes);
    const later = neighbourPage(w, ctx, 'lucie', { offset: 5, weather: null });
    expect(later?.offset).toBe(5);
    expect(later?.nowMinute).toBeNull();
    expect(JSON.stringify(later?.timeline)).not.toBe(JSON.stringify(today?.timeline));
    // Sa variante de pluie est au carnet: la bascule du temps paraît, et la pluie change la frise.
    expect(today?.rainToggle).toBe(true);
    const rain = neighbourPage(w, ctx, 'lucie', { offset: 0, weather: 'rain' });
    expect(rain?.weather).toBe('rain');
  });
});

describe('onglet Voisins: lieux, portraits, pictos', () => {
  it('chaque point des plannings a son lieu, chaque lieu, métier et activité son symbole du sprite', () => {
    const ctx = uiContext();
    const points = new Set(ctx.content.villagers.flatMap((v) => v.schedule.map((e) => e.point)));
    const missing = [...points].filter(
      (p) => NEIGHBOUR_POINT_PLACES[p] === undefined && !p.startsWith('grave_'),
    );
    expect(missing).toEqual([]);
    const cited = [
      ...Object.values(NEIGHBOUR_PLACE_ICONS),
      ...Object.values(NEIGHBOUR_JOB_ICONS),
      ...Object.values(NEIGHBOUR_ACTIVITY_ICONS),
      'taste-love',
      'taste-like',
      'taste-dislike',
      'birthday-cake',
      'ui-pencil',
      'ui-neighbours',
    ];
    expect(cited.filter((id) => !symbols.has(id))).toEqual([]);
    for (const place of Object.keys(NEIGHBOUR_PLACE_ICONS))
      expect(ctx.texts.extra.neighbours.places).toHaveProperty(place);
  });

  it('chaque habitant a son portrait, son métier en picto et son logis', () => {
    const ctx = uiContext();
    expect(ctx.content.villagers).toHaveLength(21);
    for (const def of ctx.content.villagers) {
      expect(villagerColors(def.id), def.id).not.toBeNull();
      expect(NEIGHBOUR_JOB_ICONS[def.id], def.id).toBeDefined();
      expect(def.homeLabel, def.id).not.toBeNull();
      expect(def.age, def.id).not.toBeNull();
    }
  });

  it('le bourg place chaque lieu dans le cadre et y range les voisins « sans doute » là', () => {
    const sim = middle();
    const ctx = uiContext();
    sim.world.clock.minutes = 14 * 60 + 10;
    const town = townModel(sim.world, ctx);
    expect(town.spots.length).toBeGreaterThan(15);
    for (const s of town.spots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
    const placed = [
      ...town.spots.flatMap((s) => s.villagers),
      ...town.elsewhere.flatMap((e) => e.villagers),
    ].map((v) => v.id);
    const expected = neighbourBoard(sim.world, ctx)
      .cards.filter((c) => c.met && c.now.place !== null)
      .map((c) => c.id);
    expect(placed.sort()).toEqual(expected.sort());
  });
});

describe('onglet Voisins: cartes de notification', () => {
  it('une habitude notée devient une carte: prénom, ligne du carnet, source, lieu en picto', () => {
    const sim = middle();
    const ctx = uiContext();
    const berthe = ctx.content.villagers.find((v) => v.id === 'berthe');
    const habit = berthe?.habits.find((h) => h.kind === 'routine');
    if (habit === undefined) throw new Error('habitude de Berthe');
    const text = message(sim, 'habit_found', {
      name: 'Berthe',
      habit: habit.label,
      player: 'Sacha',
    });
    const card = habitToast({ key: 'habit_found', text }, ctx);
    expect(card).toMatchObject({
      villager: 'berthe',
      name: 'Berthe',
      text: habit.label,
      kind: 'habit',
      mark: 'ui-pencil',
    });
    expect(card?.source).toMatch(/Sacha/);
    expect(card?.placeIcon).not.toBeNull();
    const heard = habitToast(
      {
        key: 'habit_heard',
        text: message(sim, 'habit_heard', {
          name: 'Berthe',
          habit: habit.label,
          speaker: 'Honorine',
        }),
      },
      ctx,
    );
    expect(heard?.source).toMatch(/Honorine/);
  });

  it('un goût découvert et une lanterne de plus ont leur carte; les autres messages gardent la leur', () => {
    const sim = middle();
    const ctx = uiContext();
    const colette = ctx.content.villagers.find((v) => v.id === 'colette');
    const love = colette?.tastes.loves[0] ?? '';
    const itemText = message(sim, 'taste_found_loves', {
      name: 'Colette',
      item: `une ${ctx.content.items[love]?.name ?? love}`,
    });
    const taste = habitToast({ key: 'taste_found_loves', text: itemText }, ctx);
    expect(taste).toMatchObject({ villager: 'colette', kind: 'taste', mark: 'taste-love' });
    expect(taste?.placeIcon).not.toBeNull();
    const bond = habitToast(
      {
        key: 'bond_level_up',
        text: message(sim, 'bond_level_up', { name: 'Mado', level: message(sim, 'bond_level_2') }),
      },
      ctx,
    );
    expect(bond).toMatchObject({ villager: 'mado', kind: 'bond', level: 2 });
    expect(habitToast({ key: 'bag_full', text: message(sim, 'bag_full') }, ctx)).toBeNull();
  });
});
