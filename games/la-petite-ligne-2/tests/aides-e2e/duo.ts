// Aides des parcours de recette à deux (Playwright): deux contextes reliés par `servir` (hôte et
// invité, comme le Mac et le PC), la sonde du jeu (`?sonde=1`, `src/plateforme/sonde-essai.ts`)
// et les captures aux moments clés.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Browser, type BrowserContext, type Frame, type Page } from '@playwright/test';

/** Dossier des captures (`LPL2_CAPTURES` pour le changer). */
export const CAPTURES = process.env.LPL2_CAPTURES ?? join(tmpdir(), 'lpl2-captures');

export type Need = 'hunger' | 'sleep' | 'hygiene';

/** Ce que la sonde rend du monde: seuls les champs lus par les parcours sont typés. */
export interface ProbeWorld {
  readonly tick: number;
  readonly minutes: number;
  readonly common: {
    readonly phase: string;
    readonly place: string;
    readonly day: number;
    readonly chest: number;
    readonly travel: { readonly to: string } | null;
  };
  readonly players: readonly ProbePlayer[];
  readonly places: Readonly<
    Record<string, { readonly ground?: readonly { readonly item: string }[] } | undefined>
  >;
}

export interface ProbePlayer {
  readonly member: string;
  readonly name: string;
  readonly money: number;
  readonly body: { readonly x: number; readonly y: number; readonly facing: number };
  readonly needs: Readonly<Record<Need, number>>;
  readonly tiers: Readonly<Record<Need, string>>;
  readonly toolbar: readonly ({ readonly item: string; readonly count: number } | null)[];
  readonly bag: { readonly id: string } | null;
  readonly gesture: { readonly clip: string; readonly target: string | null } | null;
  readonly talk: { readonly villager: string; readonly node: string } | null;
  readonly aim: string | null;
}

/** Une machine: sa page de faux hôte et le cadre du jeu. */
export interface Side {
  readonly who: 'hôte' | 'invité';
  readonly page: Page;
  game(): Frame;
  world(): Promise<ProbeWorld | null>;
  local(): Promise<number>;
  aim(player: number): Promise<{ target?: string; verb?: string } | null>;
  /** Appuie une touche (code physique) dans le jeu de cette machine. */
  press(code: string, holdMs?: number): Promise<void>;
  shot(name: string): Promise<string>;
}

export interface Duo {
  readonly host: Side;
  readonly guest: Side;
  readonly contexts: readonly [BrowserContext, BrowserContext];
  readonly errors: string[];
  /** Hôte seulement: place un joueur (index du monde). */
  teleport(player: number, x: number, y: number, facing?: number): Promise<void>;
  setNeed(player: number, need: Need, value: number): Promise<void>;
  setMinutes(minutes: number): Promise<void>;
  /** Attend une condition sur le monde vu par `side`, en relisant toutes les 250 ms. */
  until(
    side: Side,
    label: string,
    predicate: (w: ProbeWorld) => boolean,
    timeoutMs?: number,
  ): Promise<ProbeWorld>;
  close(): Promise<void>;
}

interface WindowWithProbe {
  __lplSonde?: {
    world(): unknown;
    local(): number | null;
    aim(player: number): unknown;
    teleport(p: number, x: number, y: number, f?: number): boolean;
    setNeed(p: number, n: Need, v: number): boolean;
    setMinutes(m: number): boolean;
  };
}

function gameFrame(page: Page): Frame {
  const frame = page.frames().find((f) => f.url().includes('/jeu/'));
  if (frame === undefined) throw new Error('cadre du jeu absent');
  return frame;
}

function side(page: Page, who: 'hôte' | 'invité', slug: string): Side {
  mkdirSync(CAPTURES, { recursive: true });
  return {
    who,
    page,
    game: () => gameFrame(page),
    async world() {
      return (await gameFrame(page).evaluate(
        () => (window as unknown as WindowWithProbe).__lplSonde?.world() ?? null,
      )) as ProbeWorld | null;
    },
    async local() {
      return (
        (await gameFrame(page).evaluate(
          () => (window as unknown as WindowWithProbe).__lplSonde?.local() ?? null,
        )) ?? -1
      );
    },
    async aim(player) {
      const aim: unknown = await gameFrame(page).evaluate(
        (p) => (window as unknown as WindowWithProbe).__lplSonde?.aim(p) ?? null,
        player,
      );
      return aim as { target?: string; verb?: string } | null;
    },
    async press(code, holdMs = 120) {
      // Le clavier de la page va au cadre qui a le focus: on le donne au jeu de cette machine.
      await gameFrame(page).evaluate(() => {
        window.focus();
        document.body.focus();
      });
      const key = KEY_OF[code] ?? code;
      await page.keyboard.down(key);
      await page.waitForTimeout(holdMs);
      await page.keyboard.up(key);
    },
    async shot(name) {
      const path = join(CAPTURES, `${slug}-${name}.png`);
      await page.screenshot({ path });
      return path;
    },
  };
}

/**
 * Touches Playwright pour les codes physiques: Playwright tape par `key` en QWERTY US, ce qui
 * donne le bon `KeyboardEvent.code` (KeyW est la touche Z d'un AZERTY).
 */
const KEY_OF: Readonly<Record<string, string>> = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  KeyQ: 'q',
  KeyE: 'e',
  KeyC: 'c',
  KeyG: 'g',
  KeyX: 'x',
  Space: ' ',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Digit1: '1',
  Digit2: '2',
};

/** L'un héberge, l'autre rejoint; renvoie quand les deux jeux tournent et que la sonde répond. */
export async function startDuo(
  browser: Browser,
  slug: string,
  onGuestPage?: (page: Page) => void,
): Promise<Duo> {
  const contexts = [await browser.newContext(), await browser.newContext()] as const;
  // Le faux hôte ouvre `/jeu/` sans paramètre: une redirection y ajoute la sonde.
  for (const ctx of contexts)
    await ctx.route(
      (url) => url.pathname === '/jeu/' && url.search === '',
      (route) => route.fulfill({ status: 302, headers: { location: '/jeu/?sonde=1' } }),
    );
  const pages = [await contexts[0].newPage(), await contexts[1].newPage()] as const;
  const errors: string[] = [];
  pages.forEach((page, i) => {
    const who = i === 0 ? 'hôte' : 'invité';
    page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
        errors.push(`${who} console: ${m.text()}`);
    });
  });
  const [hostPage, guestPage] = pages;
  onGuestPage?.(guestPage);
  await hostPage.goto('/');
  await hostPage.getByLabel('Ton pseudo').fill('Loïc');
  // Chaque parcours part d'une partie neuve, même si un parcours précédent a enregistré la sienne.
  await hostPage.getByRole('button', { name: /^Héberger( une nouvelle partie)?$/ }).click();
  await guestPage.goto('/');
  await guestPage.getByLabel('Ton pseudo').fill('Zoé');
  await guestPage.getByRole('button', { name: 'Rejoindre' }).click();
  for (const page of pages)
    await expect(page.locator('.vue')).toHaveAttribute('data-statut', 'running', {
      timeout: 60_000,
    });
  const host = side(hostPage, 'hôte', slug);
  const guest = side(guestPage, 'invité', slug);
  /** Appelle une méthode de réglage de la sonde chez l'hôte (seule machine qui fait autorité). */
  const hostProbe = async (
    method: 'teleport' | 'setNeed' | 'setMinutes',
    args: readonly unknown[],
  ): Promise<void> => {
    const ok = await host.game().evaluate(
      ([m, a]) => {
        const probe = (window as unknown as WindowWithProbe).__lplSonde as
          Record<string, (...x: unknown[]) => boolean> | undefined;
        return probe?.[m]?.(...a) ?? false;
      },
      [method, args] as const,
    );
    if (!ok) throw new Error(`sonde de l’hôte: ${method} refusé`);
  };
  const duo: Duo = {
    host,
    guest,
    contexts,
    errors,
    teleport: (player, x, y, facing) => hostProbe('teleport', [player, x, y, facing]),
    setNeed: (player, need, value) => hostProbe('setNeed', [player, need, value]),
    setMinutes: (minutes) => hostProbe('setMinutes', [minutes]),
    async until(who, label, predicate, timeoutMs = 20_000) {
      const start = Date.now();
      for (;;) {
        const last = await who.world();
        if (last !== null && predicate(last)) return last;
        if (Date.now() - start > timeoutMs)
          throw new Error(
            `Délai dépassé (${who.who}): ${label}; phase ${last?.common.phase ?? '?'}, lieu ${last?.common.place ?? '?'}`,
          );
        await who.page.waitForTimeout(250);
      }
    },
    async close() {
      for (const ctx of contexts) await ctx.close();
    },
  };
  // La sonde se charge par un import différé: attendre qu'elle réponde des deux côtés.
  await duo.until(host, 'sonde de l’hôte', () => true);
  await duo.until(guest, 'sonde de l’invité', () => true);
  return duo;
}

/** Distance d'un joueur à un point. */
export function distance(p: ProbePlayer, x: number, y: number): number {
  return Math.hypot(p.body.x - x, p.body.y - y);
}
