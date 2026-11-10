/** Onglets du carnet: modèles de vue purs et lecture de l'état, sans DOM. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  baseSvg,
  inPolygon,
  mapModel,
  nearestPlace,
  overlaySvg,
} from '../src/interface/carnet/carte';
import { collectionsModel, moveEntry } from '../src/interface/carnet/collections';
import {
  dummySources,
  fakeCollections,
  fakeQuests,
  fakeVillagers,
} from '../src/interface/carnet/fictif';
import {
  heartRow,
  moveVillager,
  padTastes,
  villagersModel,
} from '../src/interface/carnet/habitants';
import { DEFAULT_UI_SETTINGS, halvesOf, worldSources } from '../src/interface/carnet/lectures';
import { adjustSetting, memorySettings, settingsModel } from '../src/interface/carnet/options';
import { parsePlan } from '../src/interface/carnet/plan';
import {
  defaultQuest,
  moveQuest,
  orderQuests,
  questsModel,
  toggleFollow,
  turnQuestPage,
} from '../src/interface/carnet/quetes';
import { CARNET_TEXTS } from '../src/interface/carnet/textes';
import { outfitsModel } from '../src/interface/carnet/tenues';
import { DEFAULT_GRAPHICS_OPTIONS } from '../src/rendu/options';
import { bondKey } from '../src/etat/progression';
import { createWorld } from '../src/simulation/noyau/monde';
import { gameContent, MEMBERS, SEED } from './aides';

const PLAN_PATH = fileURLToPath(
  new URL('../../../docs/jeux/jeu-1/refonte/carte-aubrune/plan.json', import.meta.url),
);
const plan = parsePlan(JSON.parse(readFileSync(PLAN_PATH, 'utf8')) as unknown);

describe('carnet: quêtes', () => {
  const lines = fakeQuests();

  it('la principale d’abord, puis les suites en cours, puis les finies', () => {
    const ids = orderQuests(lines).map((l) => l.id);
    // Les actes d'une même histoire se suivent, du premier au dernier.
    expect(ids.slice(0, 2)).toEqual(['histoire-1', 'histoire']);
    expect(ids.at(-1)).toBe('vieux');
  });

  it('aucune suite: l’état vide demande de parler aux habitants', () => {
    const m = questsModel([], null, null);
    expect(m.empty).toBe(true);
    expect(m.detail).toBeNull();
    expect(CARNET_TEXTS.quests.none).toBe('Va parler aux habitants');
  });

  it('une seule suite suivie: suivre une autre remplace, suivre la même lâche, une finie ne se suit pas', () => {
    expect(toggleFollow(lines, null, 'couture')).toBe('couture');
    expect(toggleFollow(lines, 'couture', 'pain')).toBe('pain');
    expect(toggleFollow(lines, 'pain', 'pain')).toBeNull();
    expect(toggleFollow(lines, 'pain', 'vieux')).toBe('pain');
    const m = questsModel(lines, 'pain', 'pain');
    expect([m.main, ...m.others].filter((c) => c?.followed === true)).toHaveLength(1);
    expect(m.detail?.followed).toBe(true);
  });

  it('la suite suivie est le choix initial; le détail donne l’étape en une phrase', () => {
    expect(defaultQuest(lines, 'pain')).toBe('pain');
    expect(defaultQuest(lines, 'vieux')).toBe('histoire');
    const m = questsModel(lines, null, 'veille');
    expect(m.detail?.together).toBe(true);
    expect(m.detail?.step).toContain('l’autre joueur');
    expect(questsModel(lines, null, 'vieux').detail?.finished).toBe(true);
  });

  it('1 carte principale et 4 secondaires par page, A et E tournent les pages', () => {
    const first = questsModel(lines, null, 'histoire');
    expect(first.others).toHaveLength(4);
    expect(first.pageCount).toBe(2);
    const next = turnQuestPage(lines, 'histoire', 1);
    expect(next).not.toBeNull();
    const second = questsModel(lines, null, next);
    expect(second.page).toBe(1);
    expect(second.others).toHaveLength(2);
    expect(turnQuestPage(lines, next, 1)).toBeNull();
    expect(turnQuestPage(lines, 'histoire', -1)).toBeNull();
  });

  it('haut et bas bornent la sélection', () => {
    expect(moveQuest(lines, 'histoire-1', -1)).toBe('histoire-1');
    expect(moveQuest(lines, 'histoire-1', 1)).toBe('histoire');
    expect(moveQuest(lines, 'histoire', 1)).toBe(orderQuests(lines)[2]?.id);
  });
});

describe('carnet: habitants', () => {
  it('cœurs par moitiés, 5 cœurs', () => {
    expect(heartRow(0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
    expect(heartRow(7)).toEqual(['full', 'full', 'full', 'half', 'empty']);
    expect(heartRow(10)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(halvesOf(100)).toBe(2);
    expect(halvesOf(260)).toBe(5);
    expect(halvesOf(9999)).toBe(10);
  });

  it('un habitant non rencontré reste une silhouette sans nom ni détail', () => {
    const list = fakeVillagers(plan);
    const m = villagersModel(list, new Map(), 'h9');
    const unmet = m.cells.find((c) => c.id === 'h9');
    expect(unmet?.name).toBeNull();
    expect(m.detail?.name).toBeNull();
    expect(m.detail?.likes.every((t) => t.item === null)).toBe(true);
    expect(m.metCount).toBe(7);
  });

  it('goûts: trois cases, les « ? » complètent', () => {
    const padded = padTastes([{ item: 'pomme', name: 'Pomme' }]);
    expect(padded).toHaveLength(3);
    expect(padded.filter((t) => t.item === null)).toHaveLength(2);
  });

  it('cœur gagné depuis la dernière fermeture', () => {
    const list = fakeVillagers(plan);
    const seen = new Map(list.map((v) => [v.id, v.halves[0]] as const));
    seen.set('h0', 4);
    const cell = villagersModel(list, seen, null).cells.find((c) => c.id === 'h0');
    expect(cell?.gained).toBe(3);
  });

  it('grille de 5 colonnes', () => {
    const list = fakeVillagers(plan);
    expect(moveVillager(list, 'h0', 'down')).toBe('h5');
    expect(moveVillager(list, 'h0', 'left')).toBe('h0');
    expect(moveVillager(list, 'h4', 'right')).toBe('h4');
  });

  it('lit l’état réel: habitants du lieu, rencontrés, cœurs par joueur', () => {
    const content = gameContent();
    const world = createWorld(content, SEED, MEMBERS);
    const place = world.places[world.common.place];
    const first = place === undefined ? undefined : Object.keys(place.villagers)[0];
    expect(first).toBeDefined();
    if (place === undefined || first === undefined) return;
    const sources = worldSources(content);
    const before = sources.villagers(world, 0).find((v) => v.id === first);
    expect(before?.met).toBe(false);
    expect(before?.halves).toEqual([0, 0]);
    const slot = place.villagers[first];
    if (slot !== undefined) slot.met = [true, false];
    world.progress.bonds[bondKey(first, 0)] = 150;
    world.progress.bonds[bondKey(first, 1)] = 50;
    const after = sources.villagers(world, 0).find((v) => v.id === first);
    expect(after?.met).toBe(true);
    expect(after?.halves).toEqual([3, 1]);
    // Vu par l'autre joueur: il ne l'a pas rencontré, les cœurs s'inversent.
    const other = sources.villagers(world, 1).find((v) => v.id === first);
    expect(other?.met).toBe(false);
    expect(other?.halves).toEqual([1, 3]);
  });
});

describe('carnet: collections', () => {
  it('huit familles avec compteurs, silhouettes pour les cases vides', () => {
    const m = collectionsModel(fakeCollections(), 0, 0);
    expect(m.families).toHaveLength(8);
    expect(m.families[0]?.counter).toBe('7/16');
    expect(m.cells.filter((c) => c.name === null)).toHaveLength(9);
    expect(m.cells.filter((c) => c.found)).toHaveLength(7);
  });

  it('une famille complète est marquée', () => {
    const m = collectionsModel(fakeCollections(), 7, 0);
    expect(m.families[7]?.complete).toBe(true);
    expect(m.families[7]?.counter).toBe('8/8');
    expect(m.detail?.canListen).toBe(true);
  });

  it('la fiche ne montre que les conditions découvertes', () => {
    const m = collectionsModel(fakeCollections(), 0, 7);
    expect(m.detail?.found).toBe(false);
    expect(m.detail?.name).toBeNull();
    expect(m.detail?.rarity).toBe('');
    const clues = m.detail?.clues ?? [];
    expect(clues.map((c) => c.known)).toEqual([false, false, false, false]);
    const found = collectionsModel(fakeCollections(), 0, 0).detail;
    expect(found?.clues[0]?.value).toBe('Matin, Soir');
    expect(found?.clues[2]?.value).toBe('Printemps, Été');
    expect(found?.firstBy).toEqual({ kind: 'player', index: 0 });
  });

  it('grille de 6 colonnes', () => {
    expect(moveEntry(16, 0, 'down')).toBe(6);
    expect(moveEntry(16, 5, 'right')).toBe(5);
  });

  it('sans entrée dans les données, une famille garde le catalogue d’essai', () => {
    // L'album (`collectionBook`) fait foi pour les familles qui ont des entrées (poissons: voir
    // `carnet-collections-moteur.test.ts`); `progress.collections` n'est plus lu.
    const content = gameContent();
    const world = createWorld(content, SEED, MEMBERS);
    const sources = worldSources(content, { catalogue: fakeCollections() });
    const recipes = sources.collections(world, 0).find((c) => c.family === 'recipes');
    const fake = fakeCollections().find((c) => c.family === 'recipes');
    expect(recipes?.entries.map((e) => e.id)).toEqual(fake?.entries.map((e) => e.id));
  });
});

describe('carnet: carte', () => {
  it('le plan d’Aubrune se lit avec son schéma', () => {
    expect(plan).not.toBeNull();
    expect(plan?.zones).toHaveProperty('B');
    expect(parsePlan({ format: 'autre' })).toBeNull();
  });

  const world = createWorld(gameContent(), SEED, MEMBERS);
  world.players[0].body.x = 140;
  world.players[0].body.y = 104;
  const read = plan === null ? null : dummySources(plan, ['C', 'T']).map(world, 0);

  it('le dessin sort des données: un polygone par zone, zones fermées hachurées avec cadenas', () => {
    if (read === null || plan === null) throw new Error('plan absent');
    const open = baseSvg(plan, []);
    const shut = baseSvg(plan, ['C']);
    expect(open.match(/<polygon /g)?.length).toBeGreaterThanOrEqual(Object.keys(plan.zones).length);
    expect(open).not.toContain('stroke-dasharray="2 1.5"');
    expect(shut).toContain('url(#lpl-gris)');
    expect(shut).toContain('La Côte');
    expect(open).not.toContain('<image');
  });

  it('zones fermées: les lieux qui y sont le sont aussi; les occupants sont rangés par lieu', () => {
    if (read === null) throw new Error('plan absent');
    const model = mapModel(read);
    expect(model.places.length).toBe(plan?.points_cles.length);
    expect(model.places.some((p) => p.closed)).toBe(true);
    expect(model.places.some((p) => p.occupants.length > 0)).toBe(true);
    const total = model.places.reduce((n, p) => n + p.occupants.length, 0);
    expect(total).toBeLessThanOrEqual(read.villagers.length);
  });

  it('le curseur saute de lieu en lieu dans la direction demandée', () => {
    if (read === null) throw new Error('plan absent');
    const model = mapModel(read);
    const quai = model.places.find((p) => p.id === 'quai');
    expect(quai).toBeDefined();
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      const to = nearestPlace(model.places, 'quai', dir);
      const target = model.places.find((p) => p.id === to);
      if (to === 'quai' || quai === undefined || target === undefined) continue;
      if (dir === 'left') expect(target.x).toBeLessThan(quai.x);
      if (dir === 'right') expect(target.x).toBeGreaterThan(quai.x);
      if (dir === 'up') expect(target.y).toBeLessThan(quai.y);
      if (dir === 'down') expect(target.y).toBeGreaterThan(quai.y);
    }
    expect(nearestPlace(model.places, null, 'left')).toBe(model.places[0]?.id);
  });

  it('les deux joueurs, les habitants connus et la cible suivie sont dessinés', () => {
    if (read === null) throw new Error('plan absent');
    const model = mapModel(read);
    const svg = overlaySvg(read, model, 'quai', { x: 150, y: 110 });
    expect(svg.match(/class="jeton-carte"/g)).toHaveLength(2);
    expect(svg.match(/class="portrait-carte"/g)).toHaveLength(read.villagers.length);
    expect(svg).toContain('cible-carte');
    expect(overlaySvg(read, model, 'quai', null)).not.toContain('cible-carte');
  });

  it('point dans un polygone', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    expect(inPolygon(5, 5, square)).toBe(true);
    expect(inPolygon(15, 5, square)).toBe(false);
  });

  it('sans plan, la source rend null (la carte dit « pas de plan »)', () => {
    expect(worldSources(gameContent()).map(world, 0)).toBeNull();
  });
});

describe('carnet: tenues et réglages', () => {
  it('tenues: le modèle dit si le personnage est créé', () => {
    const world = createWorld(gameContent(), SEED, MEMBERS);
    expect(outfitsModel(world, 0).created).toBe(false);
    expect(outfitsModel(world, 0).name).toBe(world.players[0].name);
  });

  it('volume borné par pas de 10, bascules, taille et qualité en cycle', () => {
    let state = { ui: DEFAULT_UI_SETTINGS, gfx: DEFAULT_GRAPHICS_OPTIONS };
    state = adjustSetting(state, 'volume', 1);
    expect(state.ui.volume).toBe(90);
    for (let i = 0; i < 5; i += 1) state = adjustSetting(state, 'volume', 1);
    expect(state.ui.volume).toBe(100);
    for (let i = 0; i < 12; i += 1) state = adjustSetting(state, 'volume', -1);
    expect(state.ui.volume).toBe(0);
    expect(adjustSetting(state, 'needs', 1).ui.needsAlways).toBe(true);
    expect(adjustSetting(state, 'motion', 1).ui.reducedMotion).toBe(true);
    expect(adjustSetting(state, 'scale', 1).ui.scale).toBe('large');
    expect(adjustSetting(state, 'scale', -1).ui.scale).toBe('xlarge');
    expect(adjustSetting(state, 'graphics', 1).gfx.preset).toBe('high');
    expect(adjustSetting(state, 'graphics', -1).gfx.preset).toBe('low');
  });

  it('la qualité graphique passe par graphics() et setGraphics() du rendu, tout de suite', () => {
    let gfx = DEFAULT_GRAPHICS_OPTIONS;
    const seen: string[] = [];
    const port = memorySettings(
      {
        get: () => gfx,
        set: (o) => {
          gfx = o;
          seen.push(o.preset);
        },
      },
      DEFAULT_UI_SETTINGS,
    );
    const next = adjustSetting({ ui: port.ui(), gfx: port.graphics() }, 'graphics', 1);
    port.setGraphics(next.gfx);
    expect(seen).toEqual(['high']);
    expect(settingsModel({ ui: port.ui(), gfx: port.graphics() })[1]?.value).toBe('Haute');
  });
});

/** Tiret cadratin et demi-cadratin, écrits par leur code pour ne pas les mettre dans le fichier. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe('carnet: textes', () => {
  const walk = (value: unknown, out: string[]): string[] => {
    if (typeof value === 'string') out.push(value);
    else if (typeof value === 'object' && value !== null)
      for (const v of Object.values(value)) walk(v, out);
    return out;
  };
  it('aucun tiret cadratin ni demi-cadratin', () => {
    for (const text of walk(CARNET_TEXTS, [])) expect(text).not.toMatch(DASHES);
  });
  it('les noms au survol (familles, états) tiennent en 4 mots', () => {
    for (const name of Object.values(CARNET_TEXTS.collections.families))
      expect(name.split(/\s+/).length).toBeLessThanOrEqual(4);
    for (const name of Object.values(CARNET_TEXTS.settings.presets))
      expect(name.split(/\s+/).length).toBeLessThanOrEqual(4);
  });
});
