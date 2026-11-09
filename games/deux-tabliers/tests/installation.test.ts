// Démo v0.3, le départ dans une cellule vide (`docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`):
// tests courts à graine fixe, par les vraies intentions (critères DV3-01 à DV3-14).
import { createRandom } from '@duo/sdk';
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { checkPlacement } from '../src/amenagement/regles';
import {
  INSTALLATION_URLS,
  installationSoundsDone,
  releaseInstallationBuffers,
} from '../src/audio/sons';
import { guideOf } from '../src/branchement/guide';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { PlayerIndex, World } from '../src/etat/monde';
import { WORLD_FORMAT } from '../src/etat/monde';
import { installGuideOf } from '../src/installation/guide';
import { installAim, openingCheck } from '../src/installation/regles';
import { createSession, restoreWorld } from '../src/session';
import type { Intent, StepInput } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld } from '../src/simulation/pas';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);
const ic = content.installation;
if (ic === null) throw new Error('installation absente des données');

interface Rig {
  readonly world: World;
  readonly events: GameEvent[];
  /** `n` pas; `held`: joueurs qui tiennent Agir; intentions au premier pas. */
  steps(n: number, held?: readonly PlayerIndex[], intents?: [PlayerIndex, Intent][]): void;
  seconds(s: number, held?: readonly PlayerIndex[], intents?: [PlayerIndex, Intent][]): void;
  at(player: PlayerIndex, x: number, z: number, yawDeg?: number): void;
  refusals(player: PlayerIndex): string[];
}

function rig(seed = 7): Rig {
  const world = createWorld(content, ['a', 'b'], 'cellule');
  const events: GameEvent[] = [];
  const random = createRandom(seed);
  const input = (actHeld: boolean, p: PlayerIndex): StepInput => ({
    seq: 0,
    moveX: 0,
    moveZ: 0,
    fast: false,
    yawDeg: world.players[p].yawDeg,
    pitchDeg: 0,
    actHeld,
  });
  const steps: Rig['steps'] = (n, held = [], intents = []) => {
    for (let k = 0; k < n; k++) {
      const queued = k === 0 ? intents.map(([player, intent]) => ({ player, intent })) : [];
      stepWorld(
        content,
        world,
        [input(held.includes(0), 0), input(held.includes(1), 1)],
        queued,
        DT,
        random,
        (e) => events.push(e),
      );
    }
  };
  return {
    world,
    events,
    steps,
    seconds: (s, held, intents) => {
      steps(Math.round(s / DT), held, intents);
    },
    at(player, x, z, yawDeg) {
      const p = world.players[player];
      p.x = x;
      p.z = z;
      if (yawDeg !== undefined) p.yawDeg = yawDeg;
    },
    refusals: (player) =>
      events.flatMap((e) => (e.type === 'refused' && e.player === player ? [e.reason] : [])),
  };
}

const act = (spot: string): Intent => ({ type: 'installation-act', spot });
const buy = (item: string): Intent => ({ type: 'clientele-buy', item });

/** Lève le rideau à deux, depuis la place. */
function liftShutter(r: Rig): void {
  r.at(0, 9.0, 14.3);
  r.at(1, 9.8, 14.3);
  r.seconds(
    2.2,
    [0, 1],
    [
      [0, act('shutter')],
      [1, act('shutter')],
    ],
  );
}

/** Achète, la proposition au-dessus de 150 € acceptée par l'autre. */
function purchase(r: Rig, item: string): void {
  r.steps(1, [], [[0, buy(item)]]);
  if (r.world.clientele.proposals.some((p) => p.item === item))
    r.steps(1, [], [[1, { type: 'clientele-answer', by: 0, accept: true }]]);
}

/** Ouvre le carton de cet achat (mode aménagement) et pose l'appareil à sa place. */
function unpackAndPlace(r: Rig, item: string): void {
  const i = r.world.installation;
  const entry = i?.cartons.find(([, p]) => p === item);
  if (entry === undefined) throw new Error(`pas de carton pour ${item}`);
  const carton = r.world.furniture.find((f) => f.id === entry[0]);
  if (carton === undefined) throw new Error('carton introuvable');
  r.at(0, carton.x, carton.z - 0.6);
  r.steps(1, [], [[0, { type: 'amenagement-prendre', furniture: carton.id }]]);
  const held = r.world.arrangement.held[0];
  if (held === null) throw new Error(`carton non ouvert: ${r.refusals(0).join(' / ')}`);
  const spot = ic?.cell.appliances.find((a) => a.type === held.piece.type);
  if (spot === undefined) throw new Error('place inconnue');
  r.at(0, 9.5, 9.9);
  r.steps(
    1,
    [],
    [
      [
        0,
        {
          type: 'amenagement-poser',
          at: { x: spot.x, z: spot.z, y: spot.y, rotDeg: spot.rotDeg, support: null },
        },
      ],
    ],
  );
}

describe('Démo v0.3, départ dans une cellule vide', () => {
  it('DV3-01: une nouvelle maison commence sur la place, rideaux baissés, 1 800 € et rien d’autre', () => {
    const r = rig();
    r.steps(1);
    const w = r.world;
    const i = w.installation;
    expect(i?.shutter).toBe('down');
    expect(i?.stage).toBe('setup');
    expect(w.players[0].z).toBeGreaterThan(14);
    expect(w.players[0].yawDeg).toBe(0);
    const rent = Math.round((content.clientele.economy.rentPerMonth / 28) * 100);
    expect(w.clientele.cash).toBe(180000 - rent);
    expect(w.clientele.stations).toEqual({});
    expect(Object.values(w.clientele.stock).reduce((a, b) => a + b, 0)).toBe(0);
    expect(w.service.clean).toEqual({ tasse: 0, verre: 0, assiette: 0 });
    for (const type of ['moulin', 'caisse', 'frigo-sous-plan', 'pile-tasses', 'bouilloire'])
      expect(w.furniture.some((f) => f.type === type)).toBe(false);
    expect(w.furniture.some((f) => f.type === 'groupe-espresso')).toBe(false);
    // Les tables de Simone sont là, chaises retournées, sous leur drap; aucune chaise posée.
    expect(w.furniture.filter((f) => f.type.startsWith('drap-table'))).toHaveLength(4);
    expect(w.furniture.some((f) => f.type === 'chaise')).toBe(false);
    // Le guide commence par le rideau, et l'on vise la poignée depuis la place.
    expect(installGuideOf(content, w, 0)?.steps[0]?.done).toBe(false);
    const aim = installAim(content, w, 0, { x: 9.0, y: 1.65, z: 14.3, yawDeg: 0, pitchDeg: -25 });
    expect(aim?.spot.id).toBe('shutter');
  });

  it('DV3-02: seul, le rideau retombe; à deux, 2 s de maintien commun le lèvent', () => {
    const r = rig();
    r.steps(1);
    r.at(0, 9.0, 14.3);
    r.seconds(3, [0], [[0, act('shutter')]]);
    expect(r.world.installation?.shutter).toBe('down');
    r.steps(1);
    expect(r.refusals(0)).toContain('Trop lourd : il faut être deux.');
    // Les maintiens se recouvrent: l'un commence, l'autre le rejoint une seconde plus tard.
    r.at(1, 9.8, 14.3);
    r.seconds(1, [0], [[0, act('shutter')]]);
    r.seconds(1.5, [0, 1], [[1, act('shutter')]]);
    expect(r.world.installation?.shutter).toBe('down');
    r.seconds(0.6, [0, 1]);
    expect(r.world.installation?.shutter).toBe('up');
    expect(r.world.furniture.some((f) => f.id === 'rideau-porte')).toBe(false);
  });

  it('DV3-03: les quatre paniers types coûtent ce que dit la conception', () => {
    const price = (ids: string[]): number =>
      ids.reduce((sum, id) => sum + (ic.purchases.get(id)?.price ?? NaN), 0);
    const base = [
      'moulin-simple',
      'terminal-caisse',
      'frigo-occasion',
      'bouilloire-simple',
      'cloche-viennoiseries',
    ];
    const catalog = (id: string): number =>
      content.clientele.economy.catalogue.find((c) => c.id === id)?.price ?? NaN;
    expect(
      price(['machine-vieille-dame', 'vaisselle-simone', 'lot-simone-a', 'lot-simone-b', ...base]),
    ).toBe(1030);
    const peinture = content.clientele.economy.catalogue.find((c) => c.id === 'peinture_lin');
    const simone =
      price([
        'machine-vieille-dame',
        'service-blanc',
        'lot-simone-a',
        'lot-simone-b',
        'lot-simone-c',
        'lot-simone-d',
        ...base,
      ]) +
      // Deux murs de peinture lin (prix par mur) et un bouquet.
      2 * (peinture?.price ?? NaN) +
      catalog('bouquet_champetre');
    expect(simone).toBe(1292);
    expect(
      price(['machine-revisee', 'vaisselle-simone', 'lot-simone-a', 'lot-simone-b', ...base]),
    ).toBe(1380);
  });

  it('DV3-04 et DV3-05: la vieille dame achetée par les deux au même instant, une seule machine', () => {
    const r = rig();
    r.steps(1);
    liftShutter(r);
    r.at(0, 9.5, 10.4);
    r.steps(1, [], [[0, act('sheet:drap-comptoir')]]);
    const before = r.world.clientele.cash;
    // 450 € dépasse le seuil: proposé à l'autre, qui accepte; l'autre propose la même au même pas.
    r.steps(
      1,
      [],
      [
        [0, buy('machine-vieille-dame')],
        [1, buy('machine-vieille-dame')],
      ],
    );
    r.steps(
      1,
      [],
      [
        [1, { type: 'clientele-answer', by: 0, accept: true }],
        [0, { type: 'clientele-answer', by: 1, accept: true }],
      ],
    );
    r.steps(2);
    const owned = r.world.clientele.purchases.filter(([id]) => id === 'machine-vieille-dame');
    expect(owned).toHaveLength(1);
    expect(before - r.world.clientele.cash).toBe(45000);
    expect(r.world.installation?.machine.model).toBe('machine-vieille-dame');
    r.steps(1, [], [[0, buy('machine-revisee')]]);
    expect(r.refusals(0)).toContain(ic.texts.prompts.oneMachine);
  });

  it('DV3-06 et DV3-07: Gaby livre 45 s après le premier achat, sur le trottoir; un carton rendu est remboursé', () => {
    const r = rig();
    r.steps(1);
    liftShutter(r);
    purchase(r, 'moulin-simple');
    r.seconds(25);
    purchase(r, 'terminal-caisse');
    r.seconds(18);
    expect(r.world.installation?.cartons).toHaveLength(0);
    r.seconds(3);
    const cartons = r.world.installation?.cartons ?? [];
    // Le second achat rejoint la tournée en route (plus de 15 s restantes).
    expect(cartons).toHaveLength(2);
    const [ax, az, aw, ad] = ic.cell.deliveryArea;
    for (const [id] of cartons) {
      const f = r.world.furniture.find((x) => x.id === id);
      expect(f !== undefined && f.x >= ax && f.x <= ax + aw && f.z >= az && f.z <= az + ad).toBe(
        true,
      );
    }
    expect(r.events.some((e) => e.type === 'installation-delivery')).toBe(true);
    const cash = r.world.clientele.cash;
    const moulin = cartons.find(([, p]) => p === 'moulin-simple')?.[0] ?? '';
    const f = r.world.furniture.find((x) => x.id === moulin);
    r.at(0, f?.x ?? 0, (f?.z ?? 0) - 0.8);
    r.seconds(1.2, [0], [[0, act(`return:${moulin}`)]]);
    expect(r.world.clientele.cash - cash).toBe(14000);
    expect(r.world.clientele.purchases.some(([id]) => id === 'moulin-simple')).toBe(false);
    expect(r.world.furniture.some((x) => x.id === moulin)).toBe(false);
  });

  it('DV3-08: chaque appareil ne se pose qu’à sa place, ailleurs refusé avec sa phrase', () => {
    const r = rig();
    r.steps(1);
    const cand = (type: string, x: number, z: number, y: number) =>
      checkPlacement(content, r.world, { type, x, z, y, rotDeg: 0, support: null }, new Set());
    const cases: [string, string][] = [
      ['moulin', 'grinder'],
      ['caisse', 'register'],
      ['frigo-sous-plan', 'fridge'],
      ['machine-espresso-revisee', 'machine'],
    ];
    for (const [type, reason] of cases) {
      const v = cand(type, 6, 10, 0);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe(ic.texts.spots[reason]);
      const spot = ic.cell.appliances.find((a) => a.type === type);
      if (spot === undefined) throw new Error(type);
      const ok = cand(type, spot.x + 0.2, spot.z, spot.y);
      expect(ok.ok).toBe(true);
    }
  });

  it('DV3-09: raccorder, 20 s de chauffe, puis le noisette d’essai consomme le cadeau de Simone', () => {
    const r = rig();
    r.steps(1);
    liftShutter(r);
    r.at(0, 9.5, 10.4);
    r.steps(1, [], [[0, act('sheet:drap-comptoir')]]);
    purchase(r, 'machine-vieille-dame');
    for (const item of ['moulin-simple', 'vaisselle-simone']) purchase(r, item);
    r.seconds(46);
    unpackAndPlace(r, 'moulin-simple');
    unpackAndPlace(r, 'vaisselle-simone');
    expect(r.world.furniture.some((f) => f.id === 'station-5' && f.type === 'moulin')).toBe(true);
    expect(r.world.service.clean.tasse).toBeGreaterThan(0);
    expect(r.world.furniture.some((f) => f.type === 'groupe-espresso')).toBe(false);
    r.at(0, 9.15, 10.0);
    r.seconds(2.2, [0], [[0, act('connect')]]);
    expect(r.world.installation?.machine.connected).toBe(true);
    r.seconds(18);
    expect(r.world.installation?.machine.ready).toBe(false);
    expect(r.world.furniture.some((f) => f.type === 'groupe-espresso')).toBe(false);
    r.seconds(2.5);
    expect(r.world.installation?.machine.ready).toBe(true);
    expect(r.world.furniture.filter((f) => f.type === 'groupe-espresso')).toHaveLength(2);
    expect(r.world.clientele.stations.espresso).toBe(1);
    expect(r.world.service.stock['grains-maison']).toBe(1000);
    // Le ticket de Simone: pas d'encaissement.
    const trial = r.world.service.tickets.find((t) => t.customer === 'essai-simone');
    expect(trial?.articles[0]?.recipe).toBe('noisette');
    expect(r.world.service.receipts).toHaveLength(0);
  });

  it('DV3-10 et DV3-11: la pancarte refuse sans caisse ni vaisselle ni ligne servable, prévient sinon', () => {
    const r = rig();
    r.steps(1);
    const check = openingCheck(content, r.world);
    expect(check.blocks.map((b) => b.key)).toEqual(['shutter', 'register', 'dishes', 'slate']);
    expect(check.warnings.map((w) => w.key)).toEqual(['seats', 'windows', 'dust']);
    // L'hôte refuse le vote « open » tant qu'il reste un blocage (le mardi matin).
    r.world.clientele.phase = 'prep';
    r.steps(1, [], [[0, { type: 'clientele-vote', topic: 'open', yes: true }]]);
    expect(r.refusals(0)).toContain(ic.texts.open.shutter);
    expect(r.world.clientele.phase).toBe('prep');
  });

  it('DV3-12: caisse à 50 €, le nécessaire passe « à régler » chez qui fait crédit', () => {
    const r = rig();
    r.steps(1);
    r.world.clientele.cash = 5000;
    purchase(r, 'moulin-simple');
    expect(r.world.clientele.purchases.some(([id]) => id === 'moulin-simple')).toBe(true);
    expect(r.world.clientele.debt).toBeGreaterThan(0);
    const msg = r.events.find((e) => e.type === 'installation-message' && e.from === 'Gaby');
    expect(msg?.type === 'installation-message' ? msg.text : '').toContain('Gaby vous fait crédit');
    // Un achat qui n'est pas nécessaire reste refusé (pas de crédit pour une bouilloire).
    r.steps(1, [], [[0, buy('bouilloire-simple')]]);
    expect(r.world.clientele.purchases.some(([id]) => id === 'bouilloire-simple')).toBe(false);
  });

  it('DV3-13: le guide se déduit du monde seul et reprend à la même étape après une sauvegarde', () => {
    const r = rig();
    r.steps(1);
    liftShutter(r);
    r.at(0, 9.5, 10.4);
    r.steps(1, [], [[0, act('sheet:drap-comptoir')]]);
    const g = installGuideOf(content, r.world, 0);
    expect(g?.steps.slice(0, 3).map((s) => s.done)).toEqual([true, false, true]);
    expect(g?.steps[g.current]?.label).toBe('Choisir une machine');
    expect(guideOf(content, r.world, 1)?.current).toBe(g?.current);
    const saved = JSON.parse(JSON.stringify(r.world)) as unknown;
    const back = restoreWorld(saved, WORLD_FORMAT, ['a', 'b']);
    expect(back).not.toBeNull();
    if (back === null) return;
    expect(installGuideOf(content, back, 0)).toEqual(g);
  });

  it('DV3-14: une sauvegarde v0.2 (format 3, café équipé) se reprend sans installation', () => {
    const w = createWorld(content, ['a', 'b']);
    const old = JSON.parse(JSON.stringify(w)) as Record<string, unknown>;
    delete old.installation;
    const back = restoreWorld(old, 3, ['a', 'b']);
    expect(back?.installation).toBeNull();
    expect(back === null ? null : openingCheck(content, back).blocks).toEqual([]);
    expect(back === null ? null : installGuideOf(content, back, 0)).toBeNull();
  });

  it('une installation complète par les vraies intentions, du rideau à la pancarte', () => {
    const r = rig(11);
    r.steps(1);
    liftShutter(r);
    r.at(0, 9.0, 12.0);
    r.steps(1, [], [[0, act('mail')]]);
    r.at(0, 9.5, 10.4);
    r.steps(1, [], [[0, act('sheet:drap-comptoir')]]);
    for (const [i, table] of [
      [1, 'table-1'],
      [2, 'table-2'],
    ] as const) {
      const t = r.world.furniture.find((f) => f.id === table);
      r.at(0, t?.x ?? 0, (t?.z ?? 0) - 1);
      r.steps(1, [], [[0, act(`sheet:drap-${String(i)}`)]]);
    }
    for (const item of [
      'machine-vieille-dame',
      'moulin-simple',
      'terminal-caisse',
      'vaisselle-simone',
      'bouilloire-simple',
      'cloche-viennoiseries',
      'lot-simone-a',
      'lot-simone-b',
    ])
      purchase(r, item);
    // Pendant que Gaby charge: un coup de balai.
    r.at(1, 5.95, 9.6);
    r.steps(1, [], [[1, act('tool:balai')]]);
    expect(r.world.installation?.tools[1]).toBe('balai');
    const dust = r.world.furniture.find((f) => f.id === 'poussiere-7');
    r.at(1, dust?.x ?? 0, (dust?.z ?? 0) + 0.8);
    r.seconds(2.2, [1], [[1, act('dust:poussiere-7')]]);
    expect(r.world.installation?.dust).not.toContain('poussiere-7');
    r.seconds(46);
    for (const item of [
      'moulin-simple',
      'terminal-caisse',
      'vaisselle-simone',
      'bouilloire-simple',
      'cloche-viennoiseries',
    ])
      unpackAndPlace(r, item);
    for (const lot of ['lot-simone-a', 'lot-simone-b']) {
      const table = ic.cell.lots.find((l) => l.id === lot)?.table;
      const t = r.world.furniture.find((f) => f.id === table);
      r.at(0, t?.x ?? 0, (t?.z ?? 0) - 1);
      r.seconds(0.8, [0], [[0, act(`chairs:${lot}`)]]);
    }
    expect(r.world.furniture.filter((f) => f.type === 'chaise')).toHaveLength(4);
    r.at(0, 9.15, 10.0);
    r.seconds(2.2, [0], [[0, act('connect')]]);
    r.seconds(21);
    expect(r.world.clientele.stations).toMatchObject({
      espresso: 1,
      vapeur: 1,
      bouilloire: 1,
      vitrine: 1,
    });
    r.steps(
      1,
      [],
      [
        [
          0,
          {
            type: 'clientele-slate',
            lines: [
              ['espresso', 0],
              ['allonge', 0],
              ['the_noir', 0],
              ['croissant', 0],
            ],
          },
        ],
      ],
    );
    expect(r.world.clientele.slate.map(([id]) => id)).toEqual([
      'espresso',
      'allonge',
      'the_noir',
      'croissant',
    ]);
    r.steps(
      1,
      [],
      [
        [
          0,
          {
            type: 'clientele-supply',
            cartons: [
              ['grains_maison', 1],
              ['the_noir', 1],
              ['accompagnement', 1],
              ['croissant_boulanger', 2],
            ],
          },
        ],
      ],
    );
    r.steps(1, [], [[0, { type: 'clientele-name', name: 'Le Tilleul' }]]);
    r.steps(1, [], [[1, { type: 'clientele-vote', topic: 'name', yes: true }]]);
    expect(r.world.clientele.houseName).toBe('Le Tilleul');
    const g = installGuideOf(content, r.world, 0);
    expect(g?.steps[g.current]?.label).toContain('À demain');
    r.steps(
      1,
      [],
      [
        [0, { type: 'clientele-vote', topic: 'next-day', yes: true }],
        [1, { type: 'clientele-vote', topic: 'next-day', yes: true }],
      ],
    );
    r.steps(2);
    // Le grand jour: rideaux baissés, les deux sur la place; la pancarte attend le rideau.
    expect(r.world.clientele.day).toBe(2);
    expect(r.world.installation?.stage).toBe('bigday');
    expect(r.world.installation?.shutter).toBe('down');
    expect(r.world.players[1].z).toBeGreaterThan(14);
    expect(openingCheck(content, r.world).blocks.map((b) => b.key)).toEqual(['shutter']);
    liftShutter(r);
    expect(openingCheck(content, r.world).blocks).toEqual([]);
    r.steps(
      1,
      [],
      [
        [0, { type: 'clientele-vote', topic: 'open', yes: true }],
        [1, { type: 'clientele-vote', topic: 'open', yes: true }],
      ],
    );
    r.steps(2);
    expect(r.world.clientele.phase).toBe('service');
    expect(r.world.installation?.stage).toBe('opened');
    // Plafond mémoire du son: les tampons du dossier installation/ partent à la première ouverture.
    expect(installationSoundsDone(r.world)).toBe(true);
  });

  it('son: les tampons de l’installation se libèrent à l’ouverture, les autres restent', () => {
    const r = rig();
    r.steps(1);
    expect(installationSoundsDone(r.world)).toBe(false);
    expect(INSTALLATION_URLS.size).toBeGreaterThanOrEqual(9);
    const buffers = new Map<string, unknown>([...INSTALLATION_URLS].map((u) => [u, {}]));
    buffers.set('/assets/autre.ogg', {});
    expect(releaseInstallationBuffers(buffers)).toBe(INSTALLATION_URLS.size);
    expect([...buffers.keys()]).toEqual(['/assets/autre.ogg']);
    expect(installationSoundsDone(createWorld(content, ['a', 'b']))).toBe(true);
  });
});

describe('Démo v0.3, rideau à deux en réseau (invité compris)', () => {
  it('l’hôte et l’invité lèvent le rideau ensemble, l’invité seul ne le lève pas', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const t0 = performance.now();
      const now = (): number => performance.now() - t0;
      const host = createSession({ duo: duo.hostGame, content, now, start: 'cellule' });
      const guest = createSession({ duo: duo.guestGame, content, now, start: 'cellule' });
      const world = host.hostWorld();
      if (world === null) throw new Error('hôte sans monde');
      let seq = 0;
      const input = (held: boolean): StepInput => ({
        seq,
        moveX: 0,
        moveZ: 0,
        fast: false,
        yawDeg: 0,
        pitchDeg: -20,
        actHeld: held,
      });
      const run = async (
        steps: number,
        hostHeld: boolean,
        guestHeld: boolean,
        first: { host?: Intent; guest?: Intent } = {},
      ): Promise<void> => {
        for (let k = 0; k < steps; k++) {
          seq++;
          host.step(input(hostHeld), k === 0 && first.host !== undefined ? [first.host] : [], DT);
          guest.step(
            input(guestHeld),
            k === 0 && first.guest !== undefined ? [first.guest] : [],
            DT,
          );
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      };
      await run(40, false, false);
      expect(guest.ready()).toBe(true);
      expect(guest.view.world().installation?.shutter).toBe('down');
      // L'invité seul: le rideau retombe.
      await run(150, false, true, { guest: act('shutter') });
      await run(20, false, false);
      expect(world.installation?.shutter).toBe('down');
      // À deux: l'invité commence, l'hôte le rejoint.
      await run(30, false, true, { guest: act('shutter') });
      await run(160, true, true, { host: act('shutter') });
      await run(20, false, false);
      expect(world.installation?.shutter).toBe('up');
      expect(guest.view.world().installation?.shutter).toBe('up');
      expect(guest.view.world().furniture.some((f) => f.id === 'rideau-porte')).toBe(false);
    } finally {
      duo.dispose();
    }
  });
});
