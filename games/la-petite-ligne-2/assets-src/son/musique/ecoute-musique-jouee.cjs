/**
 * Enregistrement d'écoute de la musique jouée: un air joué par un robot parfait, puis par un
 * robot maladroit, puis un duo. Le son est rendu hors ligne dans Chromium par le vrai moteur du
 * jeu (`src/audio/musique/scene.ts`, page `src/interface/musique/demo/index.html?ecoute=1`):
 * ce qu'on entend ici est ce que le jeu fait sonner, sans la carte son.
 *
 * Usage (Vite du jeu lancé, par exemple `pnpm exec vite --port 5417`):
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/son/musique/ecoute-musique-jouee.cjs \
 *     http://localhost:5417 [air]
 * Écrit `assets-src/son/ecoute/musique-jouee.m4a` et `musique-jouee.txt` (ce qu'on entend, et quand).
 */
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const [base, air = 'air-marche-de-la-halte'] = process.argv.slice(2);
if (base === undefined) {
  process.stderr.write('Usage: ecoute-musique-jouee.cjs <adresse de Vite> [air]\n');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'ecoute');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${base}/src/interface/musique/demo/index.html?ecoute=1&air=${air}`);
  await page.waitForSelector('body[data-ready="oui"]', { timeout: 180000 });
  const listening = await page.evaluate(() => window.__ecoute);
  await browser.close();
  if (errors.length > 0 || listening === undefined)
    throw new Error(`rendu impossible: ${errors.join(' | ')}`);
  const wav = path.join(mkdtempSync(path.join(os.tmpdir(), 'musique-jouee-')), 'rendu.wav');
  writeFileSync(wav, Buffer.from(listening.wav, 'base64'));
  // Niveaux mesurés sur le rendu brut, avant tout réglage: c'est l'équilibre du jeu.
  const stats = String(
    spawnSync(
      'ffmpeg',
      ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
      { encoding: 'utf8' },
    ).stderr,
  );
  const loudness = /I:\s+(-?[\d.]+) LUFS/.exec(stats.slice(stats.lastIndexOf('Summary')))?.[1];
  const peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(stats.slice(stats.lastIndexOf('Summary')))?.[1];
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    wav,
    '-c:a',
    'aac',
    '-b:a',
    '112k',
    path.join(OUT, 'musique-jouee.m4a'),
  ]);
  const text = [
    listening.text,
    '',
    `Rendu hors ligne par le moteur du jeu (accompagnement: tige « fond », tige « air » en guide très bas; notes des joueurs: timbres synthétisés).`,
    `Durée ${listening.seconds.toFixed(1)} s, sonie ${loudness ?? '?'} LUFS, crête ${peak ?? '?'} dBFS, sans retouche de niveau.`,
    '',
  ].join('\n');
  writeFileSync(path.join(OUT, 'musique-jouee.txt'), text);
  process.stdout.write(text);
})().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
