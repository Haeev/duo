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
      if (r.status() >= 400) errors.push(`${who} HTTP ${r.status()}: ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`);
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
 * KeyW est la touche Z et KeyA la touche Q. Directions pour la caméra de départ
 * (`yaw = -3 PI/4`): Z vers le nord-ouest, D vers le nord-est, S vers le sud-est, Q vers le sud-ouest.
 */
const WORLD_DIRECTIONS: readonly { dx: number; dy: number; codes: readonly string[] }[] = [
  { dx: -1, dy: 0, codes: ['KeyW', 'KeyA'] },
  { dx: 1, dy: 0, codes: ['KeyS', 'KeyD'] },
  { dx: 0, dy: -1, codes: ['KeyW', 'KeyD'] },
  { dx: 0, dy: 1, codes: ['KeyS', 'KeyA'] },
];

/** Position d'un personnage lue dans l'instantané rapide de l'hôte (fait autorité). */
export function positionOf(probe: Probe, id: string): { x: number; y: number } | null {
  const c = probe.fast()?.characters.find((k) => k.id === id);
  return c === undefined ? null : { x: c.x, y: c.y };
}

/**
 * Marche au clavier d'un point de passage à l'autre, en ligne droite le long des axes
 * (caméra de départ, non tournée). Renvoie la position finale.
 */
export async function walkAlong(
  page: Page,
  probe: Probe,
  id: string,
  waypoints: readonly { x: number; y: number }[],
  tolerance = 0.4,
  timeoutMs = 120_000,
): Promise<{ x: number; y: number }> {
  const start = Date.now();
  for (const target of waypoints) {
    for (;;) {
      const pos = positionOf(probe, id);
      if (pos === null) throw new Error('aucune position reçue');
      const ex = target.x - pos.x;
      const ey = target.y - pos.y;
      if (Math.abs(ex) <= tolerance && Math.abs(ey) <= tolerance) break;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Marche trop longue vers (${target.x}, ${target.y}): bloqué en (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
      }
      const horizontal = Math.abs(ex) >= Math.abs(ey);
      const dir = WORLD_DIRECTIONS.find((d) => (horizontal ? d.dx === Math.sign(ex) : d.dy === Math.sign(ey)));
      if (dir === undefined) break;
      const remaining = horizontal ? Math.abs(ex) : Math.abs(ey);
      for (const code of dir.codes) await page.keyboard.down(code);
      await page.waitForTimeout(Math.min(400, 60 + remaining * 120));
      for (const code of dir.codes) await page.keyboard.up(code);
      await page.waitForTimeout(150);
    }
  }
  const end = positionOf(probe, id);
  if (end === null) throw new Error('aucune position reçue');
  return end;
}
