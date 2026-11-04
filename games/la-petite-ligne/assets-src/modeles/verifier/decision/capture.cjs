// Captures de la planche de décision (vrai moteur, rendu.html). Usage:
//   node capture.cjs <dossier> <fichier JSON des prises>
// Une prise: { name, base, width, height, q: {...}, steps, dt, frames: [n...] (suite d'images) }
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const out = process.argv[2];
  const shots = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const shot of shots) {
    const first = path.join(out, shot.frames ? `${shot.name}-000.png` : `${shot.name}.png`);
    if (fs.existsSync(first) && !process.env.FORCE) continue;
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1 });
    const problems = [];
    page.on('pageerror', (error) => problems.push(`erreur: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        const text = message.text();
        if (!text.includes('KHR_parallel_shader_compile')) problems.push(`${message.type()}: ${text}`);
      }
    });
    const q = new URLSearchParams({ manuel: '1', stats: '0', vie: '0', meteo: 'sunny', ...shot.q });
    const t0 = Date.now();
    await page.goto(new URL(`rendu.html?${q.toString()}`, shot.base).href);
    await page.waitForFunction(() => window.lplRendu !== undefined && window.lplRendu.ready, null, { timeout: 900000 });
    const grab = async (steps, dt) =>
      page.evaluate(
        ({ steps, dt }) => {
          for (let i = 0; i < steps; i += 1) window.lplRendu.advance(dt);
          return document.querySelector('canvas').toDataURL('image/png');
        },
        { steps, dt },
      );
    const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    if (shot.frames) {
      let url = await grab(shot.steps, shot.dt);
      for (let i = 0; i < shot.frames; i += 1) {
        save(path.join(out, `${shot.name}-${String(i).padStart(3, '0')}.png`), url);
        url = await grab(shot.every ?? 1, shot.dt);
      }
    } else {
      save(path.join(out, `${shot.name}.png`), await grab(shot.steps, shot.dt));
    }
    const info = await page.evaluate(() => ({ stats: window.lplRendu.stats(), missing: window.lplRendu.missing() }));
    await page.close();
    process.stdout.write(
      `${shot.name} ${Math.round((Date.now() - t0) / 1000)} s calls=${info.stats.calls ?? '?'} tri=${info.stats.triangles ?? '?'} programs=${info.stats.programs ?? '?'}${problems.length ? ` PROBLEMES: ${problems.join(' | ')}` : ''}\n`,
    );
  }
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
