// Décode les fichiers OGG dans Chromium (decodeAudioData, comme le fera Electron) et vérifie:
// longueur, silence en tête, crête, et le raccord de la boucle du salon à 48 kHz et à 44,1 kHz
// (fréquence d'un AudioContext créé sans option sur une sortie réglée à 44,1 kHz).
//   node design/son/plateforme/sources/verifier-chromium.cjs
// Playwright est préinstallé dans l'environnement (require résolu par NODE_PATH).
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '..');
const sons = JSON.parse(fs.readFileSync(path.join(RACINE, 'sons.json'), 'utf8'));

async function main() {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.route('http://duo.local/**', (route) => {
    const relatif = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if (relatif === '') {
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>sons</title>' });
      return;
    }
    route.fulfill({ status: 200, contentType: 'audio/ogg', body: fs.readFileSync(path.join(RACINE, relatif)) });
  });
  await page.goto('http://duo.local/');

  const fichiers = [];
  for (const def of Object.values(sons.sounds)) fichiers.push(...def.files);
  const boucle = sons.music.lounge;

  const resultat = await page.evaluate(async ({ fichiers, boucle }) => {
    async function decoder(url, frequence) {
      const donnees = await (await fetch(url)).arrayBuffer();
      const ctx = new OfflineAudioContext(2, 1, frequence);
      return ctx.decodeAudioData(donnees);
    }
    function crete(buf) {
      let max = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
      }
      return max;
    }
    function tete(buf) {
      const d = buf.getChannelData(0);
      const e = buf.getChannelData(1);
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 1e-4 || Math.abs(e[i]) > 1e-4) return (1000 * i) / buf.sampleRate;
      return NaN;
    }
    function raccord(buf, debut, fin) {
      // debut et fin en échantillons à la fréquence du tampon; compare fin-1 -> debut aux sauts internes.
      let pire = 0;
      let pireD2 = 0;
      let continuation = 0; // écart entre ce qui suit le raccord et ce qui suivrait sans boucler (amorce)
      const sauts = [];
      const d2s = [];
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        pire = Math.max(pire, Math.abs(d[debut] - d[fin - 1]));
        pireD2 = Math.max(pireD2, Math.abs(d[debut] - 2 * d[fin - 1] + d[fin - 2]), Math.abs(d[debut + 1] - 2 * d[debut] + d[fin - 1]));
        for (let k = 0; k < 4096 && fin + k < d.length; k++) continuation = Math.max(continuation, Math.abs(d[fin + k] - d[debut + k]));
        if (c === 0) {
          for (let i = debut + 2; i < fin; i++) {
            sauts.push(Math.abs(d[i] - d[i - 1]));
            d2s.push(Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]));
          }
        }
      }
      sauts.sort((a, b) => a - b);
      d2s.sort((a, b) => a - b);
      const rang = (tab, v) => { let lo = 0, hi = tab.length; while (lo < hi) { const m = (lo + hi) >> 1; if (tab[m] < v) lo = m + 1; else hi = m; } return (100 * lo) / tab.length; };
      return {
        saut: pire, sautCentile: rang(sauts, pire), sautP999: sauts[Math.floor(0.999 * sauts.length)],
        d2: pireD2, d2Centile: rang(d2s, pireD2), d2P999: d2s[Math.floor(0.999 * d2s.length)], continuation,
      };
    }
    const sortie = { sons: [], boucle: {} };
    for (const f of fichiers) {
      const buf = await decoder('http://duo.local/' + f, 48000);
      sortie.sons.push({ f, longueur: buf.length, duree: buf.duration, tete: tete(buf), crete: crete(buf), canaux: buf.numberOfChannels });
    }
    for (const frequence of [48000, 44100]) {
      const buf = await decoder('http://duo.local/' + boucle.file, frequence);
      const echelle = frequence / boucle.loop.sampleRate;
      const debut = Math.round(boucle.loop.startSample * echelle);
      const fin = Math.round(boucle.loop.endSample * echelle);
      sortie.boucle[frequence] = { longueur: buf.length, debut, fin, ...raccord(buf, debut, fin) };
    }
    return sortie;
  }, { fichiers, boucle });

  await navigateur.close();
  let echecs = 0;
  for (const s of resultat.sons) {
    const ok = s.canaux === 2 && s.tete < 5 && s.crete < 0.89; // tête: attaques douces de quelques ms
    if (!ok) echecs++;
    process.stdout.write(`${ok ? 'ok   ' : 'ÉCHEC'} ${s.f.padEnd(28)} ${String(s.longueur).padStart(7)} éch. ${s.duree.toFixed(3)} s, tête ${s.tete.toFixed(2)} ms, crête ${(20 * Math.log10(s.crete)).toFixed(1)} dBFS\n`);
  }
  for (const [frequence, r] of Object.entries(resultat.boucle)) {
    const attendu = Math.round((boucle.loop.endSample - boucle.loop.startSample) * Number(frequence) / boucle.loop.sampleRate);
    const ok = r.fin - r.debut === attendu && r.longueur >= r.fin && r.sautCentile < 99 && r.d2Centile < 99;
    if (!ok) echecs++;
    process.stdout.write(`${ok ? 'ok   ' : 'ÉCHEC'} boucle à ${frequence} Hz: ${r.longueur} échantillons décodés, boucle ${r.debut} à ${r.fin}; ` +
      `saut au raccord ${r.saut.toFixed(5)} (centile ${r.sautCentile.toFixed(2)}, p99,9 ${r.sautP999.toFixed(5)}), ` +
      `seconde différence ${r.d2.toFixed(5)} (centile ${r.d2Centile.toFixed(2)}, p99,9 ${r.d2P999.toFixed(5)}), ` +
      `écart à la continuation ${r.continuation.toFixed(5)}\n`);
  }
  process.stdout.write(echecs ? `${echecs} échec(s)\n` : 'Décodage Chromium: tout est conforme.\n');
  process.exitCode = echecs ? 1 : 0;
}

main().catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exitCode = 1; });
