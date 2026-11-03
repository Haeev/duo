// Tour 10 (lot L6), interface de la maison: icônes des besoins à trois états et leurs chiffres au
// carnet, « Besoins en sourdine », rangement à cases (capacité, débordement, râtelier, familles),
// commande des pièces à Basile et panneau du chantier (doubles de la simulation comparés à
// l'original), rideaux, sieste, nuit « endormis ensemble », lieu de l'autre par bâtiment. Chaque
// modèle est lu chez les deux joueurs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../../etat/actions';
import { HOUSE_BUILDING } from '../../etat/carte';
import { windowsNow } from '../../etat/maison';
import type { CharacterId } from '../../etat/types';
import { decodeSave, restoreWorld } from '../../sauvegarde/sauvegarde';
import type { Sim } from '../../simulation/contexte';
import { step } from '../../simulation/pas';
import { DEPOSIT_FAMILIES } from '../../simulation/rangement';
import {
  OAK_CHEST as SIM_OAK_CHEST,
  buildableElements,
  roomInProgress,
  roomStillNeeded,
  roomsOpen,
  siteReady,
} from '../../simulation/pieces';
import { buildingPlace, partnerModel } from '../modele';
import {
  NEED_MESSAGE_KEYS,
  OAK_CHEST,
  STORAGE_FAMILIES,
  audibleNotifications,
  basileRoomsModel,
  curtainsInvite,
  inviteModel,
  napModel,
  needIcons,
  needsPage,
  nightTogetherLine,
  roomBuildable,
  roomInProgressOf,
  roomNeeded,
  roomSiteModel,
  roomsOpenFor,
  siteReadyOf,
  sleepVerbText,
  storageModel,
} from '../modele-maison';
import { aimPromptModel, progressModel } from '../modele-progression';
import { NBSP, NNBSP } from '../typographie';
import { character, contentAndMap, uiContext } from './aides';

const plain = (s: string): string =>
  s.split(NBSP).join(' ').split(NNBSP).join(' ').split('’').join("'");
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];
const HOUR = 60;

function load(file: string): Sim {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../tests/donnees/sauvegardes/${file}`, import.meta.url)),
      'utf8',
    ),
  ) as {
    dataSchema: number;
    data: unknown;
  };
  const { content, map } = contentAndMap();
  return restoreWorld(content, map, decodeSave(structuredClone(raw.data)), raw.dataSchema, [
    { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
    { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
  ]);
}

/** L'été, mardi 25 à midi (format 7): coffre et étagère, ni pièce ni rideaux. */
const summer25 = (): Sim => load('format-7-ete-jour-25.json');

function send(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

function place(sim: Sim, id: CharacterId, x: number, y: number): void {
  const c = character(sim, id);
  c.pos = { x, y };
  c.prev = { x, y };
  c.destination = null;
}

describe('besoins doux: trois icônes à trois états, chez soi et chez l’autre', () => {
  it('le Ventre, le Repos et le Cœur suivent les seuils des réglages, chez les deux joueurs', () => {
    const sim = summer25();
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      const c = character(sim, me);
      c.needs.belly = 70;
      c.endurance = c.enduranceMax;
      c.needs.heart = 80;
      c.needs.apartMinutes = 0;
      let icons = needIcons(ctx, c);
      expect(icons.map((i) => i.icon)).toEqual([
        'need-belly-full',
        'need-rest-high',
        'need-heart-light',
      ]);
      expect(icons.map((i) => i.tone)).toEqual(['good', 'good', 'good']);
      expect(plain(icons[0]?.label ?? '')).toBe('Ventre : Ventre plein');
      c.needs.belly = 40;
      c.endurance = Math.round(c.enduranceMax / 2);
      c.needs.heart = 50;
      icons = needIcons(ctx, c);
      expect(icons.map((i) => i.level)).toEqual(['ok', 'ok', 'ok']);
      c.needs.belly = 10;
      c.endurance = Math.round(c.enduranceMax / 10);
      c.needs.apartMinutes = 200;
      icons = needIcons(ctx, c);
      expect(icons.map((i) => i.level)).toEqual(['low', 'low', 'missing']);
      expect(icons.map((i) => plain(i.state))).toEqual([
        'Petit creux',
        'Besoin de souffler',
        'Envie de compagnie',
      ]);
      c.endurance = 0;
      expect(needIcons(ctx, c)[1]?.icon).toBe('need-rest-empty');
      // L'autre voit les mêmes icônes, en petit: on lit le personnage de l'autre.
      const other = uiContext(me === 'p1' ? 'p2' : 'p1');
      expect(needIcons(other, c).map((i) => i.icon)).toEqual(needIcons(ctx, c).map((i) => i.icon));
    }
  });

  it('chaque icône existe dans le sprite (une forme par état)', () => {
    const sprite = readFileSync(
      fileURLToPath(new URL('../../../ui-maquettes/icones.svg', import.meta.url)),
      'utf8',
    );
    const ids = [
      'belly-full',
      'belly-ok',
      'belly-low',
      'rest-high',
      'rest-ok',
      'rest-low',
      'rest-empty',
      'heart-light',
      'heart-ok',
      'heart-missing',
    ];
    for (const id of ids) expect(sprite).toContain(`id="need-${id}"`);
  });

  it('les chiffres sont au carnet (Ventre, Repos sur l’endurance du réveil, Cœur, minutes loin de l’autre)', () => {
    const sim = summer25();
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      const c = character(sim, me);
      c.needs.belly = 62.4;
      c.needs.heart = 48;
      c.needs.apartMinutes = 40;
      c.endurance = 50;
      const page = needsPage(sim.world, ctx, false);
      expect(page).not.toBeNull();
      if (page === null) return;
      expect(page.rows.map((r) => plain(r.value))).toEqual([
        '62 sur 100',
        `50 sur ${String(Math.round(c.enduranceMax))}`,
        '48 sur 100',
      ]);
      const partner = character(sim, me === 'p1' ? 'p2' : 'p1').name;
      expect(plain(page.apart)).toBe(`Loin de ${partner} depuis 40 min de jeu`);
      expect(plain(page.rows[1]?.help ?? '')).toContain('entre 12 h et 16 h');
      c.needs.apartMinutes = 0;
      expect(plain(needsPage(sim.world, ctx, true)?.apart ?? '')).toBe(
        `${partner} n'est pas loin.`,
      );
    }
  });

  it('« Besoins en sourdine » coupe les lignes des besoins, garde le reste', () => {
    const list = [
      { id: 1, key: 'belly_low' },
      { id: 2, key: 'reunion' },
      { id: 3, key: null },
      { id: 4, key: 'heart_missing' },
      { id: 5, key: 'no_energy' },
    ];
    expect(audibleNotifications(list, false).map((n) => n.id)).toEqual([1, 2, 3, 4, 5]);
    expect(audibleNotifications(list, true).map((n) => n.id)).toEqual([2, 3, 5]);
    for (const key of NEED_MESSAGE_KEYS)
      expect(['belly', 'rest', 'heart'].some((p) => key.startsWith(p))).toBe(true);
  });
});

describe('rangement à cases et râtelier', () => {
  it('capacité des meubles posés, cases libres, râtelier, familles du sac', () => {
    const sim = summer25();
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      const m = storageModel(sim.world, ctx);
      // Coffre (20) et étagère (6) dans la maison.
      expect(m.total).toBe(26);
      expect(m.cells).toHaveLength(26);
      expect(m.cells.filter((c) => c.item !== null)).toHaveLength(m.used);
      expect(plain(m.count)).toBe(`${String(m.used)} cases sur 26`);
      expect(m.rack).toHaveLength(12);
      expect(m.overflow).toBe(false);
      const c = character(sim, me);
      c.bag[12] = { item: 'radish', quality: 'ordinary', count: 4 };
      c.bag[13] = { item: 'plank', quality: 'ordinary', count: 2 };
      const families = storageModel(sim.world, ctx).families;
      expect(families.map((f) => f.family)).toEqual(expect.arrayContaining(['crop', 'material']));
      expect(plain(families.find((f) => f.family === 'crop')?.label ?? '')).toBe(
        'Tout déposer : récoltes',
      );
    }
  });

  it('une sauvegarde qui déborde montre « Ça déborde » et les cases en trop', () => {
    const sim = summer25();
    const items = Object.keys(sim.content.items)
      .filter((id) => sim.content.items[id]?.category !== 'tool')
      .slice(0, 30);
    sim.world.cellar = items.map((item) => ({ item, quality: 'ordinary', count: 1 }));
    const m = storageModel(sim.world, uiContext('p2'));
    expect(m.overflow).toBe(true);
    expect(m.cells).toHaveLength(30);
    expect(m.cells.filter((c) => c.over)).toHaveLength(4);
    expect(plain(m.count)).toContain('Ça déborde : 30 sur 26');
  });

  it('les outils pendent au râtelier, sans prendre de case', () => {
    const sim = summer25();
    sim.world.rack = [
      { item: 'axe', quality: 'ordinary', count: 1 },
      { item: 'hoe', quality: 'ordinary', count: 2 },
    ];
    const m = storageModel(sim.world, uiContext('p1'));
    expect(m.rack.filter((h) => h.item !== null).map((h) => h.item)).toEqual(['axe', 'hoe', 'hoe']);
    expect(plain(m.rackCount)).toBe('3 crochets sur 12');
  });

  it('les familles de « Tout déposer » sont celles de la simulation', () => {
    expect([...STORAGE_FAMILIES]).toEqual([...DEPOSIT_FAMILIES]);
    expect(OAK_CHEST).toBe(SIM_OAK_CHEST);
  });
});

/** Le jour 25 à midi, la bourse garnie: p1 commande le cellier à l'établi de Basile. */
function orderCellar(sim: Sim): void {
  sim.world.purse = 2000;
  const bench = sim.map.points.sawmill_workbench;
  if (bench === undefined) throw new Error('établi');
  place(sim, 'p1', bench.x + 0.6, bench.y + 0.4);
  send(sim, 'p1', { type: 'menu', menu: 'workbench' });
  send(sim, 'p1', { type: 'improvement_pay', improvement: 'room_cellar', amount: null });
  // Au-delà de 100 aubrins, l'accord de l'autre.
  const proposal = sim.world.proposals.find((p) => p.purchase.item === 'room_cellar');
  if (proposal !== undefined)
    send(sim, 'p2', { type: 'proposal_answer', proposal: proposal.id, accept: true });
}

describe('pièces bâties à deux: commande à Basile et chantier', () => {
  it('les doubles de l’interface disent comme la simulation (ouverture, pièce en cours, site, reste, éléments)', () => {
    const sim = summer25();
    const ctx = uiContext('p1');
    const check = (): void => {
      expect(roomsOpenFor(sim.world, ctx)).toBe(roomsOpen(sim));
      expect(roomInProgressOf(sim.world, ctx)?.id ?? null).toBe(roomInProgress(sim)?.id ?? null);
      for (const def of sim.content.home.rooms) {
        expect(siteReadyOf(sim.world, def.id)).toBe(siteReady(sim, def.id));
        expect(roomNeeded(sim.world, ctx, def.id)).toEqual(
          roomStillNeeded(sim, def.id).map((s) => ({ item: s.item, count: s.count })),
        );
        expect(roomBuildable(sim.world, ctx, def.id)).toEqual(
          buildableElements(sim, def.id).map((e) => e.id),
        );
      }
    };
    check();
    orderCellar(sim);
    check();
    sim.world.clock.day += 1;
    check();
    const room = sim.world.rooms.room_cellar;
    if (room === undefined) throw new Error('cellier commandé');
    room.crate = [{ item: 'plank', quality: 'ordinary', count: 3 }];
    room.elementsBuilt = ['post_south', 'post_north'];
    check();
  });

  it('« Agrandir la maisonnette »: les deux plans, l’accord de l’autre, une pièce à la fois, le grand coffre', () => {
    const sim = summer25();
    for (const me of PLAYERS) {
      // Le grand coffre se commande dès que `objets.json` le décrit (lot L3); ici, ajouté au contenu.
      const base = uiContext(me);
      const chest = base.content.items.chest;
      if (chest === undefined) throw new Error('coffre');
      const ctx = {
        ...base,
        content: {
          ...base.content,
          items: {
            ...base.content.items,
            oak_chest: { ...chest, id: 'oak_chest', name: 'grand coffre de chêne' },
          },
        },
      };
      expect(basileRoomsModel(sim.world, base)?.oakChest ?? null).toEqual(
        base.content.items.oak_chest === undefined ? null : expect.anything(),
      );
      const m = basileRoomsModel(sim.world, ctx);
      expect(m).not.toBeNull();
      if (m === null) return;
      expect(m.rooms.map((r) => r.id)).toEqual(['room_cellar', 'room_bedroom']);
      expect(plain(m.rooms[0]?.line ?? '')).toBe('Le cellier : 450 aubrins, 16 planches, 8 clous');
      expect(plain(m.rooms[1]?.line ?? '')).toBe(
        'La chambre : 1200 aubrins, 30 planches, 12 clous',
      );
      // 323 aubrins: le cellier manque de 127 aubrins.
      expect(m.rooms[0]?.state).toBe('too_expensive');
      expect(m.oakChest?.state).toBe('orderable');
      expect(plain(m.oakChest?.text ?? '')).toContain('250 aubrins');
    }
    sim.world.purse = 2000;
    const before = basileRoomsModel(sim.world, uiContext('p1'));
    expect(before?.rooms[0]?.big).toBe(true);
    expect(plain(before?.rooms[0]?.text ?? '')).toBe('Proposer à Sacha : 450 aubrins');
    orderCellar(sim);
    for (const me of PLAYERS) {
      const m = basileRoomsModel(sim.world, uiContext(me));
      expect(m?.rooms[0]?.state).toBe('ordered');
      expect(m?.rooms[1]?.state).toBe('busy');
      expect(plain(m?.rooms[1]?.text ?? '')).toBe(
        'Un chantier à la fois : finissez d’abord le cellier.'.split('’').join("'"),
      );
    }
  });

  it('le panneau du chantier: supports, caisse, dépôts du sac, invite au site', () => {
    const sim = summer25();
    orderCellar(sim);
    // Le lendemain matin, le site paraît.
    sim.world.clock.day += 1;
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      const site = roomSiteModel(sim.world, ctx);
      expect(site).not.toBeNull();
      if (site === null) return;
      expect(plain(site.title)).toBe('Chantier : le cellier');
      expect(plain(site.progress)).toBe('0 éléments sur 6');
      expect(plain(site.bring)).toBe('Apporter : 16 planches et 8 clous');
      expect(plain(site.crate)).toBe('La caisse du chantier est vide.');
      expect(site.elements.filter((e) => e.state === 'ready').map((e) => e.id)).toEqual([
        'post_south',
        'post_north',
      ]);
      const roof = site.elements.find((e) => e.id === 'roof');
      expect(plain(roof?.text ?? '')).toBe('Il faut d’abord la sablière.'.split('’').join("'"));
      expect(site.beam).toBeNull();
    }
    const c = character(sim, 'p2');
    c.bag[14] = { item: 'plank', quality: 'ordinary', count: 5 };
    c.bag[15] = null;
    const ctx = uiContext('p2');
    const deposit = roomSiteModel(sim.world, ctx)?.deposits.find((d) => d.item === 'plank');
    expect(deposit?.count).toBe(5);
    expect(plain(deposit?.text ?? '')).toBe('Déposer 5 planches');
    // Au site: l'invite du chantier, puis le dépôt passe par la simulation.
    const room = sim.map.buildings[HOUSE_BUILDING]?.rooms.find(
      (r) => r.build?.room === 'room_cellar',
    );
    const at =
      room?.build === null || room === undefined ? undefined : sim.map.points[room.build.site];
    if (at === undefined) throw new Error('site du cellier');
    place(sim, 'p2', at.x, at.y);
    const invite = inviteModel(sim.world, ctx);
    expect(invite?.kind).toBe('room');
    expect(plain(invite?.text ?? '')).toBe('Chantier : le cellier · 0 éléments sur 6');
    send(sim, 'p2', { type: 'room_deposit', room: 'room_cellar', item: 'plank', count: 5 });
    const after = roomSiteModel(sim.world, ctx);
    expect(plain(after?.crate ?? '')).toBe('À la caisse : 5 planches');
    expect(after?.deposits.find((d) => d.item === 'plank')?.count).toBe(0);
  });

  it('la barre de progression du HUD suit l’élément bâti, chez les deux', () => {
    const sim = summer25();
    orderCellar(sim);
    sim.world.clock.day += 1;
    const room = sim.world.rooms.room_cellar as (typeof sim.world.rooms)[string] & {
      work?: unknown;
    };
    room.elementsBuilt = ['post_south', 'post_north'];
    room.work = { element: 'wall_plate', progress: 0.5, paid: true, workers: ['p1'] };
    const mine = progressModel(sim.world, uiContext('p1'));
    expect(mine?.kind).toBe('build');
    expect(mine?.ratio).toBeCloseTo(2.5 / 6, 5);
    expect(plain(mine?.label ?? '')).toBe('Le cellier');
    expect(plain(progressModel(sim.world, uiContext('p2'))?.label ?? '')).toBe(
      'Camille bâtit : Le cellier',
    );
    const site = roomSiteModel(sim.world, uiContext('p2'));
    expect(plain(site?.elements.find((e) => e.id === 'wall_plate')?.text ?? '')).toBe(
      'En cours : 50 %',
    );
  });
});

describe('rideaux, sieste, nuit', () => {
  /** Des rideaux accrochés à la fenêtre est de la pièce principale, et `me` devant. */
  function curtainsAtEast(sim: Sim, me: CharacterId): string {
    const ctx = uiContext(me);
    const win = windowsNow(ctx.content, ctx.map, sim.world.rooms).find((w) => w.id === 'window_5');
    if (win === undefined) throw new Error('fenêtre est');
    const id = 'f-rideaux';
    sim.world.furniture.push({
      id,
      item: 'curtains',
      cell: { cx: Math.round(win.x) - 1, cy: Math.floor(win.y) },
      rotation: 3,
      placedBy: me,
      window: win.id,
    });
    place(sim, me, win.x - 1.2, win.y + 0.4);
    // Les mains vides (un meuble en main mettrait la maison en aménagement).
    const c = character(sim, me);
    c.bag[9] = null;
    c.selected = 9;
    send(sim, me, { type: 'point_at', target: null });
    return id;
  }

  it('l’invite ouvre et ferme les rideaux à portée, chez soi seulement', () => {
    for (const me of PLAYERS) {
      const sim = summer25();
      const id = curtainsAtEast(sim, me);
      const c = character(sim, me);
      expect(c.inside).toBe(HOUSE_BUILDING);
      const ctx = uiContext(me);
      let invite = curtainsInvite(sim.world, ctx, c);
      expect(invite?.furniture).toBe(id);
      expect(plain(invite?.text ?? '')).toBe('Fermer les rideaux');
      expect(inviteModel(sim.world, ctx)?.kind).toBe('curtains');
      send(sim, me, { type: 'curtains', furniture: id });
      invite = curtainsInvite(sim.world, ctx, character(sim, me));
      expect(plain(invite?.text ?? '')).toBe('Ouvrir les rideaux');
      // Dehors: plus d'invite.
      const door = sim.map.points.house_door;
      if (door === undefined) throw new Error('porte');
      place(sim, me, door.x, door.y + 2);
      send(sim, me, { type: 'point_at', target: null });
      expect(curtainsInvite(sim.world, ctx, character(sim, me))).toBeNull();
    }
  });

  it('un refus lisible quand les rideaux ne vont pas là (textes des refus de pose)', () => {
    const ctx = uiContext('p1');
    expect(plain(ctx.texts.messages.placement_not_window ?? '')).toBe(
      'Les rideaux vont à une fenêtre.',
    );
    expect(ctx.texts.messages.placement_fenestron).toContain('fenestron');
  });

  it('l’après-midi, le lit propose la sieste; la rêverie chez qui dort, à deux le temps file', () => {
    const sim = summer25();
    const ctx = uiContext('p1');
    sim.world.clock.minutes = 13 * HOUR;
    expect(plain(sleepVerbText(sim.world, ctx))).toBe('Faire la sieste');
    sim.world.clock.minutes = 21 * HOUR;
    expect(plain(sleepVerbText(sim.world, ctx))).toBe('Dormir');
    const me = character(sim, 'p1');
    me.aim = { cell: { cx: 7, cy: 23 }, verb: 'sleep', blocked: null, source: 'pointer' };
    sim.world.clock.minutes = 13 * HOUR;
    expect(plain(aimPromptModel(sim.world, ctx)?.text ?? '')).toBe('Faire la sieste');
    expect(napModel(sim.world, ctx)).toBeNull();
    me.status = 'sleeping';
    me.needs.napStart = 25 * 1440 + 13 * HOUR;
    expect(plain(napModel(sim.world, ctx)?.title ?? '')).toBe('Une petite sieste');
    expect(napModel(sim.world, ctx)?.together).toBe(false);
    const other = character(sim, 'p2');
    other.status = 'sleeping';
    other.needs.napStart = me.needs.napStart;
    expect(napModel(sim.world, ctx)?.together).toBe(true);
    expect(plain(partnerModel(sim.world, uiContext('p2'), null)?.activity ?? '')).toBe(
      'Fait la sieste',
    );
  });

  it('« Vous avez éteint la lampe en même temps. » quand les deux se couchent ensemble', () => {
    const sim = summer25();
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) throw new Error('personnages');
    for (const c of [a, b]) {
      c.status = 'night';
      c.needs.napStart = null;
      c.action = { kind: 'sleep', since: sim.world.tick, duration: 0, target: null };
    }
    expect(plain(nightTogetherLine(sim.world, uiContext('p1')) ?? '')).toBe(
      'Vous avez éteint la lampe en même temps.',
    );
    b.action = { kind: 'sleep', since: sim.world.tick + 30 * 60 * 30, duration: 0, target: null };
    expect(nightTogetherLine(sim.world, uiContext('p2'))).toBeNull();
  });
});

describe('lieu de l’autre par bâtiment', () => {
  it('l’épicerie, le salon, la maisonnette et ses pièces bâties', () => {
    const sim = summer25();
    for (const me of PLAYERS) {
      const other = me === 'p1' ? 'p2' : 'p1';
      const ctx = uiContext(me);
      const c = character(sim, other);
      const at = (building: string): void => {
        const b = sim.map.buildings[building];
        const r = b?.rooms[0]?.rect;
        if (r === undefined) throw new Error(building);
        place(sim, other, r.x + r.w / 2, r.y + r.h / 2);
        c.inside = building;
      };
      at('grocery');
      expect(plain(buildingPlace(sim.world, ctx, c) ?? '')).toBe("Dans l'épicerie d'Odette");
      at('salon');
      expect(plain(buildingPlace(sim.world, ctx, c) ?? '')).toBe('Au salon de Solange');
      expect(plain(partnerModel(sim.world, ctx, null)?.activity ?? '')).toBe('Au salon de Solange');
      at('house');
      expect(plain(buildingPlace(sim.world, ctx, c) ?? '')).toBe('Dans la maisonnette');
      // Le cellier bâti: on dit la pièce.
      sim.world.rooms.room_cellar = {
        ordered: 20,
        crate: [],
        elementsBuilt: [],
        beamPlaced: false,
        builtDay: 22,
      };
      place(sim, other, 3.5, 23.5);
      expect(plain(buildingPlace(sim.world, ctx, c) ?? '')).toBe('Dans le cellier');
      delete sim.world.rooms.room_cellar;
      c.inside = null;
      expect(buildingPlace(sim.world, ctx, c)).toBeNull();
    }
  });
});
