// Aides des tests Playwright: deux navigateurs reliés par `servir` (hôte et invité), et une sonde
// qui lit l'état faisant autorité dans les messages que l'hôte envoie à l'invité (canaux 1 à 3).
// La sonde n'ajoute aucun crochet au jeu: elle écoute la WebSocket de la page de l'invité.
import { expect, type Browser, type BrowserContext, type FrameLocator, type Page } from '@playwright/test';
import type { WorldEvent, WorldState } from '../../src/etat/types';

/** Rendu léger (`?rendu=leger`): le Chromium du cloud dessine en logiciel. */
export const HOME = '/?rendu=leger';

export interface Fast {
  readonly tick: number;
  readonly minutes: number;
  readonly characters: readonly { id: string; x: number; y: number; f: number; s: number }[];
}

export interface Probe {
  /** Dernier état complet reçu (canal 1), ou null. */
  world(): WorldState | null;
  /** Dernier instantané rapide (canal 2), ou null. */
  fast(): Fast | null;
  /** Événements reçus (canal 3), dans l'ordre. */
  readonly events: WorldEvent[];
  /** Taille du plus gros état complet reçu, en octets. */
  maxWorldBytes(): number;
  /** Attend que `predicate` soit vrai sur l'état complet. */
  until(label: string, predicate: (w: WorldState) => boolean, timeoutMs?: number): Promise<WorldState>;
}

interface NetFrame {
  t: string;
  channel?: number;
  data?: string;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function probeGuest(page: Page): Probe {
  let world: WorldState | null = null;
  let fast: Fast | null = null;
  let maxBytes = 0;
  const events: WorldEvent[] = [];
  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') return;
      const msg = parse(frame.payload) as NetFrame | null;
      if (msg?.t !== 'net' || typeof msg.data !== 'string') return;
      const data = parse(msg.data) as Record<string, unknown> | null;
      if (data === null) return;
      if (msg.channel === 1 && typeof data.world === 'object') {
        world = data.world as WorldState;
        maxBytes = Math.max(maxBytes, msg.data.length);
      } else if (msg.channel === 2) {
        fast = data as unknown as Fast;
      } else if (msg.channel === 3) {
        const list = Array.isArray(data) ? data : Array.isArray(data.events) ? data.events : [data];
        for (const e of list) events.push(e as WorldEvent);
      }
    });
  });
  return {
    world: () => world,
    fast: () => fast,
    events,
    maxWorldBytes: () => maxBytes,
    async until(label, predicate, timeoutMs = 60_000) {
      const start = Date.now();
      for (;;) {
        const w = world;
        if (w !== null && predicate(w)) return w;
        if (Date.now() - start > timeoutMs) {
          const brief = w === null ? 'aucun état reçu' : `phase ${w.phase}, jour ${w.clock.day}, ${w.clock.minutes} min`;
          throw new Error(`Délai dépassé: ${label} (${brief})`);
        }
        await page.waitForTimeout(250);
      }
    },
  };
}

export interface Duo {
  readonly mac: BrowserContext;
  readonly pc: BrowserContext;
  readonly host: Page;
  readonly guest: Page;
  /** Jeu chez l'hôte et chez l'invité (iframe de la page du faux hôte). */
  readonly hostGame: FrameLocator;
  readonly guestGame: FrameLocator;
  readonly probe: Probe;
  readonly errors: string[];
  close(): Promise<void>;
}

async function profile(page: Page, name: string): Promise<void> {
  await page.goto(HOME);
  await page.getByLabel('Ton pseudo').fill(name);
}

/** L'un héberge (le Mac), l'autre rejoint (le PC); renvoie quand les deux jeux tournent. */
export async function startDuo(
  browser: Browser,
  opts: { hostName?: string; guestName?: string; hostButton?: string } = {},
): Promise<Duo> {
  const mac = await browser.newContext();
  const pc = await browser.newContext();
  // Tâches longues du fil principal, dans chaque cadre (le jeu est dans une iframe): le chien de
  // garde de la plateforme arrête la partie après 5 s sans battement de cœur (ADR 0004).
  for (const ctx of [mac, pc]) await ctx.addInitScript(LONG_TASKS_SCRIPT);
  const host = await mac.newPage();
  const guest = await pc.newPage();
  const errors: string[] = [];
  for (const [who, page] of [['hôte', host], ['invité', guest]] as const) {
    page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    page.on('response', (r) => {
      // Le navigateur demande de lui-même une icône que ni le faux hôte ni le jeu ne fournissent.
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${who} HTTP ${r.status()}: ${r.url()}`);
    });
    page.on('console', (m) => {
      // Les ressources en échec sont relevées avec leur adresse par l'écouteur `response`.
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`${who} console: ${m.text()}`);
    });
  }
  const probe = probeGuest(guest);
  await profile(host, opts.hostName ?? 'Loïc');
  await host.getByRole('button', { name: opts.hostButton ?? 'Héberger', exact: true }).click();
  await profile(guest, opts.guestName ?? 'Zoé');
  await guest.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(host.locator('.vue')).toHaveAttribute('data-statut', 'running', { timeout: 60_000 });
  await expect(guest.locator('.vue')).toHaveAttribute('data-statut', 'running', { timeout: 60_000 });
  // Le chien de garde de la plateforme peut arrêter la partie (« Le jeu ne répond plus »): le dire.
  for (const page of [host, guest]) {
    void page
      .locator('.vue[data-statut="stopped"], .vue[data-statut="error"]')
      .waitFor({ timeout: 0 })
      .then(() => errors.push(`partie arrêtée: ${page === host ? 'hôte' : 'invité'}`))
      .catch(() => undefined);
  }
  return {
    mac,
    pc,
    host,
    guest,
    hostGame: host.frameLocator('iframe'),
    guestGame: guest.frameLocator('iframe'),
    probe,
    errors,
    async close() {
      await mac.close();
      await pc.close();
    },
  };
}

const LONG_TASKS_SCRIPT = `
  window.__lplLongTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lplLongTasks.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
`;

/** Tâches longues relevées dans le jeu d'une page: [début, durée] en ms. */
export async function longTasks(page: Page): Promise<[number, number][]> {
  const frame = page.frames().find((f) => f.url().includes('/jeu/'));
  if (frame === undefined) return [];
  return frame.evaluate(() => (window as unknown as { __lplLongTasks?: [number, number][] }).__lplLongTasks ?? []);
}

/** Personnage d'un joueur dans l'état (p1 = hôte, p2 = invité, sauf reprise). */
export function characterOf(w: WorldState, name: string): WorldState['characters'][number] {
  const c = w.characters.find((k) => k.name === name);
  if (c === undefined) throw new Error(`Personnage introuvable: ${name}`);
  return c;
}

/**
 * Codes physiques (`KeyboardEvent.code`) des déplacements, lus par le jeu: sur un clavier AZERTY,
 * KeyW est la touche Z et KeyA la touche Q. `screen`: angle de la direction par rapport à Z,
 * dans le sens des orientations du jeu (D = Z + PI/2). La direction dans le monde vaut
 * `yaw + screen`, où `yaw` est l'orientation de la caméra (`-3 PI/4` au départ).
 */
const KEY_DIRECTIONS: readonly { codes: readonly string[]; screen: number }[] = [
  { codes: ['KeyW'], screen: 0 },
  { codes: ['KeyW', 'KeyD'], screen: Math.PI / 4 },
  { codes: ['KeyD'], screen: Math.PI / 2 },
  { codes: ['KeyS', 'KeyD'], screen: (3 * Math.PI) / 4 },
  { codes: ['KeyS'], screen: Math.PI },
  { codes: ['KeyS', 'KeyA'], screen: (-3 * Math.PI) / 4 },
  { codes: ['KeyA'], screen: -Math.PI / 2 },
  { codes: ['KeyW', 'KeyA'], screen: -Math.PI / 4 },
];

/** Orientation de la caméra au départ (`cameraYaw()` du rendu, ETAT.md). */
export const START_YAW = (-3 * Math.PI) / 4;

function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** Position d'un personnage lue dans l'instantané rapide de l'hôte (fait autorité). */
export function positionOf(probe: Probe, id: string): { x: number; y: number } | null {
  const c = probe.fast()?.characters.find((k) => k.id === id);
  return c === undefined ? null : { x: c.x, y: c.y };
}

/**
 * Position une fois le personnage arrêté: l'hôte dessine lui aussi en rendu logiciel, ses
 * instantanés arrivent avec une à deux secondes de retard sur les touches.
 */
export async function settledPosition(page: Page, probe: Probe, id: string): Promise<{ x: number; y: number } | null> {
  let last = positionOf(probe, id);
  let calm = 0;
  for (let i = 0; i < 20 && calm < 2; i++) {
    await page.waitForTimeout(300);
    const now = positionOf(probe, id);
    const moved = now === null || last === null ? 1 : Math.hypot(now.x - last.x, now.y - last.y);
    calm = moved < 0.02 ? calm + 1 : 0;
    last = now;
  }
  return last;
}

/** Maintient des touches (codes physiques) pendant `ms`. */
export async function holdKeys(page: Page, codes: readonly string[], ms: number): Promise<void> {
  for (const code of codes) await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  for (const code of codes) await page.keyboard.up(code);
}

function keysToward(yaw: number, angle: number): readonly string[] {
  let best = KEY_DIRECTIONS[0];
  for (const d of KEY_DIRECTIONS) {
    if (best === undefined || angleGap(yaw + d.screen, angle) < angleGap(yaw + best.screen, angle)) best = d;
  }
  return best?.codes ?? [];
}

/** Touches qui mènent vers l'ouest (x décroissant) pour une orientation de caméra donnée. */
export function westKeys(yaw: number): readonly string[] {
  return keysToward(yaw, Math.PI);
}

/** Touches qui mènent vers l'est (x croissant). */
export function eastKeys(yaw: number): readonly string[] {
  return keysToward(yaw, 0);
}

export interface Walker {
  /** Orientation de la caméra estimée d'après les déplacements observés. */
  yaw: number;
  /** Durée d'appui courante, adaptée au pas observé (une image peut durer une seconde). */
  holdMs: number;
}

export function newWalker(): Walker {
  return { yaw: START_YAW, holdMs: 600 };
}

/**
 * Marche au clavier de point de passage en point de passage. Le pilote ne suppose pas
 * l'orientation de la caméra: il la réestime à chaque pas d'après le déplacement observé
 * chez l'hôte (une caméra tournée ne le perd pas). La durée d'appui s'adapte: plus longue si
 * rien ne bouge (en rendu logiciel, une touche brève peut passer entre deux images), plus
 * courte si le pas dépasse le but. `tolerance`: rayon d'arrivée de chaque point de passage.
 */
export async function walkAlong(
  page: Page,
  probe: Probe,
  id: string,
  waypoints: readonly { x: number; y: number; tolerance?: number }[],
  tolerance = 0.6,
  timeoutMs = 240_000,
  walker: Walker = newWalker(),
): Promise<{ x: number; y: number }> {
  const start = Date.now();
  let stuck = 0;
  for (const target of waypoints) {
    const radius = target.tolerance ?? tolerance;
    for (;;) {
      const pos = positionOf(probe, id);
      if (pos === null) throw new Error('aucune position reçue');
      const ex = target.x - pos.x;
      const ey = target.y - pos.y;
      const dist = Math.hypot(ex, ey);
      if (dist <= radius) break;
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Marche trop longue vers (${target.x}, ${target.y}): arrêté en (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}), caméra estimée ${walker.yaw.toFixed(2)} rad, appui ${walker.holdMs} ms`,
        );
      }
      const wanted = Math.atan2(ey, ex);
      // Bloqué contre un obstacle: un pas de côté, à angle droit.
      const aim = stuck >= 3 ? wanted + (stuck % 2 === 0 ? Math.PI / 2 : -Math.PI / 2) : wanted;
      let best = KEY_DIRECTIONS[0];
      for (const d of KEY_DIRECTIONS) {
        if (best === undefined || angleGap(walker.yaw + d.screen, aim) < angleGap(walker.yaw + best.screen, aim)) best = d;
      }
      if (best === undefined) break;
      await holdKeys(page, best.codes, walker.holdMs);
      const after = await settledPosition(page, probe, id);
      if (after === null) continue;
      const dx = after.x - pos.x;
      const dy = after.y - pos.y;
      const step = Math.hypot(dx, dy);
      if (step < 0.15) {
        stuck++;
        walker.holdMs = Math.min(2000, Math.round(walker.holdMs * 1.5));
        continue;
      }
      stuck = 0;
      if (step > dist * 1.2) walker.holdMs = Math.max(200, Math.round(walker.holdMs * 0.6));
      // Réestimation de la caméra, amortie (un glissement le long d'un mur fausse un peu la mesure).
      const observed = Math.atan2(dy, dx) - best.screen;
      walker.yaw = Math.atan2(
        Math.sin(walker.yaw) + Math.sin(observed),
        Math.cos(walker.yaw) + Math.cos(observed),
      );
    }
  }
  const end = positionOf(probe, id);
  if (end === null) throw new Error('aucune position reçue');
  return end;
}
