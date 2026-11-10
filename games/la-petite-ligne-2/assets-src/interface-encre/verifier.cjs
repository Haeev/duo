/**
 * Contrôles du style encré sur la page de démonstration: contrastes de la palette, clavier seul
 * (dialogue, carnet, boutique), durée des animations (200 ms au plus, 1 ms en mouvement réduit),
 * rien hors de l'écran à 1366x768 et 1280x720.
 *
 * Usage (Vite du jeu lancé):
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/verifier.cjs http://localhost:5391
 */
const { chromium } = require('playwright');

const base = process.argv[2];
if (base === undefined) {
  process.stderr.write('Usage: verifier.cjs <adresse de Vite>\n');
  process.exit(1);
}
const url = (query) => `${base}/src/interface/encre/demo/index.html?${query}`;
const failures = [];
const lines = [];
const check = (ok, label) => {
  lines.push(`${ok ? 'ok   ' : 'ÉCHEC'} ${label}`);
  if (!ok) failures.push(label);
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Paires texte sur fond réellement employées par `encre.css` (noms des variables). Thème sombre:
 * `--ink` est le texte clair, `--on-accent` le texte sombre des fonds clairs (accent, plein).
 */
const PAIRS = [
  ['--ink', '--paper-raised'],
  ['--ink', '--paper'],
  ['--ink', '--paper-sunken'],
  ['--on-accent', '--accent'],
  ['--ink', '--soft-green'],
  ['--ink', '--soft-sky'],
  ['--ink', '--soft-ochre'],
  ['--ink-muted', '--paper-raised'],
  ['--ink-muted', '--paper'],
  ['--ink-muted', '--paper-sunken'],
  ['--stamp', '--paper-raised'],
  ['--stamp', '--paper'],
  ['--stamp', '--paper-sunken'],
  ['--ink', '--night'],
  ['--on-accent', '--ink'],
];

async function open(page, query) {
  await page.goto('about:blank');
  await page.goto(url(query));
  await page.waitForSelector('body[data-ready="oui"]', { timeout: 15000 });
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  // 1. Contrastes.
  await open(page, 'ecran=planche');
  const colors = await page.evaluate(
    (names) => {
      const style = getComputedStyle(document.querySelector('.lpl-ui'));
      return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]));
    },
    [...new Set(PAIRS.flat())],
  );
  for (const [fg, bg] of PAIRS) {
    const ratio = contrast(colors[fg], colors[bg]);
    check(ratio >= 4.5, `contraste ${fg} sur ${bg}: ${ratio.toFixed(1)}`);
  }

  // 2. Clavier seul.
  const text = (selector) =>
    page.evaluate((s) => document.querySelector(s)?.textContent ?? null, selector);
  await open(page, 'ecran=dialogue-choix');
  const first = await text('.choice.focus');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  const second = await text('.choice.focus');
  check(
    first !== null && second !== null && first !== second,
    'dialogue: les flèches changent de réponse',
  );

  await open(page, 'ecran=carnet');
  const tab = await text('.signet[aria-selected="true"]');
  const quest = await text('.quete.focus .quete__titre');
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(150);
  const questAfter = await text('.quete.focus .quete__titre');
  check(tab === 'Quêtes', `carnet: ouvert sur l'onglet des quêtes (${tab})`);
  check(
    quest !== null && questAfter !== null && quest !== questAfter,
    'carnet: S choisit la quête suivante',
  );
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const tabAfter = await text('.signet[aria-selected="true"]');
  check(tabAfter !== null && tabAfter !== tab, `carnet: E passe à l'onglet suivant (${tabAfter})`);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(400);
  check((await page.locator('.carnet').count()) === 0, 'carnet: Retour ferme');

  await open(page, 'ecran=boutique');
  const shopTab = await text('.shop-bigtab[aria-selected="true"]');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  const shopTabAfter = await text('.shop-bigtab[aria-selected="true"]');
  check(shopTab !== shopTabAfter, `boutique: E passe de « ${shopTab} » à « ${shopTabAfter} »`);
  const item = await text('.shop-nametag');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  check(item !== (await text('.shop-nametag')), 'boutique: la flèche change de vignette');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(400);
  check((await page.locator('.shop').count()) === 0, 'boutique: Retour sort');

  // 3. Animations: 200 ms au plus pour ce qui ne boucle pas; 1 ms en mouvement réduit.
  const durations = (query) =>
    (async () => {
      await page.goto('about:blank');
      await page.goto(url(query));
      const seen = new Map();
      for (let i = 0; i < 14; i += 1) {
        const batch = await page.evaluate(() =>
          document.getAnimations().map((a) => {
            const timing = a.effect.getComputedTiming();
            return [
              `${a.animationName ?? a.transitionProperty ?? '?'}`,
              Number(timing.duration),
              timing.iterations,
            ];
          }),
        );
        for (const [name, duration, iterations] of batch) seen.set(name, [duration, iterations]);
        await page.waitForTimeout(120);
      }
      return seen;
    })();
  for (const screen of ['hud', 'dialogue-choix', 'carnet', 'boutique-refus']) {
    const seen = await durations(`ecran=${screen}`);
    // Hors contrôle: la transition du soleil du cadran (une seconde par pas d'horloge), qui
    // montre l'heure qui passe et non un mouvement d'interface.
    const slow = [...seen].filter(
      ([name, [d, n]]) => name !== 'transform' && Number.isFinite(n) && d > 200,
    );
    check(
      slow.length === 0,
      `${screen}: animations finies en 200 ms au plus (${[...seen].map(([n, [d]]) => `${n} ${d}`).join(', ')})${slow.length > 0 ? ` trop longues: ${slow.map(([n]) => n).join(', ')}` : ''}`,
    );
    const reduced = await durations(`ecran=${screen}&mouvement=reduit`);
    const moving = [...reduced].filter(([, [d, n]]) => d > 1 || !Number.isFinite(n));
    check(
      moving.length === 0,
      `${screen}: mouvement réduit (${moving.map(([n]) => n).join(', ')})`,
    );
  }

  // 4. Rien hors de l'écran, aux deux tailles.
  for (const [w, h] of [
    [1366, 768],
    [1280, 720],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const screen of ['hud', 'dialogue-choix', 'carnet', 'boutique-refus']) {
      await open(page, `ecran=${screen}`);
      const out = await page.evaluate(() => {
        const names = [
          '.hud-clock',
          '.needs',
          '.toolbar',
          '.prompt',
          '.dlg',
          '.choices',
          '.book',
          '.signets',
          '.shop',
        ];
        return names.filter((name) => {
          const node = document.querySelector(name);
          if (node === null || node.hidden) return false;
          const r = node.getBoundingClientRect();
          if (r.width === 0) return false;
          return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
        });
      });
      check(out.length === 0, `${screen} à ${w}x${h}: tout tient à l'écran ${out.join(' ')}`);
    }
  }

  await browser.close();
  process.stdout.write(`${lines.join('\n')}\n`);
  if (failures.length > 0) process.exit(1);
})();
