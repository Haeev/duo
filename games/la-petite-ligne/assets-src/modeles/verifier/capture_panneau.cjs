// 0.12.2 (retour R07): le panneau de quai vu par la caméra du jeu (rendu.html, vrai moteur, vraie carte),
// zoom 1 et 2, orientation par défaut (caméra au sud-est: face sud du panneau) et orientation 2 (caméra au
// nord-ouest, côté voie: la face des voyageurs).
// Usage, serveur de développement du jeu lancé (pnpm --filter @duo/la-petite-ligne dev):
//   node games/la-petite-ligne/assets-src/modeles/verifier/capture_panneau.cjs <dossier de sortie> [adresse]
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// joueur 1 à 2,5 m du panneau (sous 1,7 m, ce qui le masque s'efface en tramage)
const SHOTS = [
  { name: 'panneau-zoom1', q: { x: '44', y: '21', zoom: '1', orientation: '0' } },
  { name: 'panneau-zoom2', q: { x: '44.5', y: '21', zoom: '2', orientation: '0' } },
  { name: 'panneau-cote-voie-zoom2', q: { x: '47.5', y: '16', zoom: '2', orientation: '2' } },
];

async function main() {
  const out = process.argv[2];
  const base = process.argv[3] ?? 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const shot of SHOTS) {
    // déjà capturée (SwiftShader est lent: on peut relancer après une coupure)
    if (fs.existsSync(path.join(out, `${shot.name}.png`))) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const q = new URLSearchParams({ heure: '10:00', meteo: 'sunny', vie: '0', stats: '0', ...shot.q });
    await page.goto(new URL(`rendu.html?${q.toString()}`, base).href);
    await page.waitForFunction(
      () => window.lplRendu !== undefined && window.lplRendu.ready && window.lplRendu.frames > 8,
      null,
      { timeout: 900000 },
    );
    await page.waitForTimeout(2000);
    const file = path.join(out, `${shot.name}.png`);
    await page.screenshot({ path: file, timeout: 900000 });
    await page.close();
    if (errors.length > 0) throw new Error(`erreurs dans la page: ${errors.join(' | ')}`);
    process.stdout.write(`${file}\n`);
  }
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
