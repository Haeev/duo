/**
 * S-02 côté rendu de l'interface: le texte du DOM chez l'autre ne contient jamais le secret,
 * carnet ouvert et conversation d'appel comprise (page de démonstration dans Chromium, sans
 * rendu 3D, simulation arrêtée sur la situation). Les chaînes interdites sont tirées de la même
 * situation rejouée dans Node (même graine, mêmes robots). Ignoré sans Chromium.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium } from '@playwright/test';
import { type ViteDevServer, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { henColor, secretCards } from '../../etat/secrets';
import type { CharacterId } from '../../etat/types';
import { setupScenario } from '../demo/scenarios';
import { apply, newSim } from './aides';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const executable = [process.env.DUO_CHROMIUM, '/opt/pw-browsers/chromium', chromium.executablePath()].find(
  (path): path is string => path !== undefined && path !== '' && existsSync(path),
);
const SETUP_MS = 90_000;
const PAGE_MS = 240_000;

const plain = (s: string): string =>
  s
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** Ce que l'autre ne doit jamais lire dans cette situation: les fiches de l'informé, et chaque nom de poule pas encore trouvé avec sa couleur. */
function forbidden(scenario: string, informed: CharacterId): string[] {
  const sim = newSim();
  apply(sim, 'p1', { type: 'title_ready', ready: true });
  apply(sim, 'p2', { type: 'title_ready', ready: true });
  setupScenario(sim, scenario, 'p1')?.();
  const out = secretCards(sim.world, sim.content, informed)
    .filter((card) => !sim.world.secrets.entries.some((e) => e.quest === card.quest && e.shared))
    .flatMap((card) => card.lines.map(plain));
  for (const hen of sim.world.hens) if (hen.namedBy === null) out.push(plain(`${hen.name}, c'est ${henColor(sim.content, hen.variant)}`));
  return out;
}

describe.skipIf(executable === undefined)("l'écran de l'autre ne montre jamais le secret (S-02, Chromium)", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base = '';

  beforeAll(async () => {
    server = await createServer({ root, logLevel: 'silent', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
    await server.listen();
    base = server.resolvedUrls?.local[0] ?? '';
    browser = await chromium.launch(executable === undefined ? {} : { executablePath: executable });
  }, SETUP_MS);

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  async function textOf(scenario: string, me: CharacterId): Promise<string> {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    // Le premier chargement dépasse les 30 s par défaut de Playwright (Vite compile tout le jeu à la demande).
    await page.goto(`${base}src/interface/demo/index.html?scenario=${scenario}&joueur=${me}&autre=fige&rendu=0&temps=arrete`, { timeout: PAGE_MS });
    await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: PAGE_MS });
    await page.waitForTimeout(600);
    // Tout le texte de l'interface, éléments cachés compris, et les libellés lus par les lecteurs d'écran.
    const text = await page.evaluate(() => {
      const ui = document.getElementById('interface');
      const labels = [...(ui?.querySelectorAll('[aria-label]') ?? [])].map((n) => n.getAttribute('aria-label') ?? '');
      return `${ui?.textContent ?? ''} ${labels.join(' ')}`;
    });
    await page.close();
    return plain(text);
  }

  // [situation, informé, l'autre, le carnet est ouvert (le secret se lit chez l'informé: témoin)]
  for (const [scenario, informed, other, notebook] of [
    ['poules-carnet', 'p1', 'p2', true],
    ['poules-appel', 'p1', 'p2', false],
    ['lucie-carnet', 'p2', 'p1', true],
  ] as const) {
    it(
      `${scenario}: rien chez ${other}${notebook ? `, le secret bien là chez ${informed}` : ''}`,
      async () => {
        const secrets = forbidden(scenario, informed);
        expect(secrets.length).toBeGreaterThan(0);
        const doer = await textOf(scenario, other);
        for (const s of secrets) expect(doer, `« ${s} » chez ${other}`).not.toContain(s);
        if (!notebook) return;
        const witness = await textOf(scenario, informed);
        expect(secrets.some((s) => witness.includes(s))).toBe(true);
      },
      PAGE_MS * 2,
    );
  }
});
