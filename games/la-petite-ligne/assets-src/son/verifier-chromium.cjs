// Vérifie les sons de La Petite Ligne dans Chromium, le moteur d'Electron:
// - chaque OGG se décode (decodeAudioData) avec la bonne longueur, sans silence en tête;
// - chaque boucle, décodée à 48 kHz puis à 44,1 kHz (contexte réglé sur l'une ou l'autre
//   fréquence), a des points de boucle qui tombent sur des échantillons entiers;
// - la lecture réelle en boucle (AudioBufferSourceNode, loop, loopStart, loopEnd, dans un
//   OfflineAudioContext) passe le raccord sans saut: on compare le passage fin -> début aux
//   écarts entre échantillons voisins dans tout le rendu.
//   node games/la-petite-ligne/assets-src/son/verifier-chromium.cjs
// Playwright est préinstallé dans l'environnement (require résolu par NODE_PATH).
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SORTIE = path.resolve(__dirname, '..', '..', 'assets', 'son');
const sons = JSON.parse(fs.readFileSync(path.join(SORTIE, 'sons.json'), 'utf8'));

async function main() {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.route('http://duo.local/**', (route) => {
    const relatif = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if (relatif === '') {
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>sons</title>' });
      return;
    }
    route.fulfill({ status: 200, contentType: 'audio/ogg', body: fs.readFileSync(path.join(SORTIE, relatif)) });
  });
  await page.goto('http://duo.local/');

  const fichiers = [];
  const boucles = [];
  for (const [id, d] of Object.entries(sons.sounds)) {
    for (const f of d.files) {
      fichiers.push({ f, duree: null });
      if (d.loop) boucles.push({ id, f, loop: d.loop });
    }
  }
  for (const [id, d] of Object.entries(sons.music)) {
    fichiers.push({ f: d.file });
    if (d.loop) boucles.push({ id, f: d.file, loop: d.loop });
  }

  const resultat = await page.evaluate(async ({ fichiers, boucles }) => {
    async function decoder(url, frequence) {
      const donnees = await (await fetch(url)).arrayBuffer();
      const ctx = new OfflineAudioContext(2, 1, frequence);
      return ctx.decodeAudioData(donnees);
    }
    function tete(buf) {
      for (let i = 0; i < buf.length; i++) {
        for (let c = 0; c < buf.numberOfChannels; c++) if (Math.abs(buf.getChannelData(c)[i]) > 1e-4) return (1000 * i) / buf.sampleRate;
      }
      return NaN;
    }
    function crete(buf) {
      let m = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
      return m;
    }
    // Écarts entre échantillons voisins: le raccord est comparé à leur distribution.
    function centile(d, i0, i1, indice) {
      const sauts = [];
      for (let i = i0 + 1; i < i1; i++) sauts.push(Math.abs(d[i] - d[i - 1]));
      sauts.sort((a, b) => a - b);
      const v = Math.abs(d[indice] - d[indice - 1]);
      let lo = 0, hi = sauts.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sauts[m] < v) lo = m + 1; else hi = m; }
      return { v, centile: (100 * lo) / sauts.length };
    }
    const sortie = { sons: [], boucles: [] };
    for (const { f } of fichiers) {
      const buf = await decoder('http://duo.local/' + f, 48000);
      sortie.sons.push({ f, longueur: buf.length, tete: tete(buf), crete: crete(buf), canaux: buf.numberOfChannels });
    }
    for (const b of boucles) {
      for (const frequence of [48000, 44100]) {
        const buf = await decoder('http://duo.local/' + b.f, frequence);
        const debutS = b.loop.startSeconds;
        const finS = b.loop.endSeconds;
        const longueurBoucle = (finS - debutS) * frequence;
        // Lecture réelle: on démarre 1 s avant la fin de la boucle et on rend 2 s.
        const avant = Math.min(1.0, (finS - debutS) / 3);
        const rendu = new OfflineAudioContext(buf.numberOfChannels, Math.round(2 * avant * frequence), frequence);
        const src = rendu.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = debutS;
        src.loopEnd = finS;
        src.connect(rendu.destination);
        src.start(0, finS - avant);
        const sortieRendu = await rendu.startRendering();
        const indice = Math.round(avant * frequence);
        let pire = { v: 0, centile: 0 };
        for (let c = 0; c < sortieRendu.numberOfChannels; c++) {
          const r = centile(sortieRendu.getChannelData(c), 1, sortieRendu.length, indice);
          if (r.centile > pire.centile) pire = r;
        }
        sortie.boucles.push({ id: b.id, frequence, longueurBoucle, entier: Math.abs(longueurBoucle - Math.round(longueurBoucle)) < 1e-6,
          suffisant: buf.length >= Math.round(finS * frequence), saut: pire.v, centile: pire.centile });
      }
    }
    return sortie;
  }, { fichiers, boucles });

  await navigateur.close();
  let echecs = 0;
  for (const s of resultat.sons) {
    const ok = s.tete < 3 && s.crete < 0.95;
    if (!ok) echecs++;
    if (!ok) process.stdout.write(`ÉCHEC ${s.f}: tête ${s.tete.toFixed(2)} ms, crête ${s.crete.toFixed(3)}\n`);
  }
  process.stdout.write(`${resultat.sons.length} fichiers décodés par Chromium (decodeAudioData)\n`);
  for (const b of resultat.boucles) {
    const ok = b.entier && b.suffisant && b.centile < 99.5;
    if (!ok) echecs++;
    process.stdout.write(`${ok ? 'ok   ' : 'ÉCHEC'} ${b.id.padEnd(18)} ${b.frequence} Hz: boucle de ${b.longueurBoucle.toFixed(1)} échantillons, ` +
      `lecture en boucle: saut au raccord ${b.saut.toFixed(5)} (centile ${b.centile.toFixed(1)} des écarts voisins)\n`);
  }
  process.stdout.write(echecs ? `${echecs} échec(s)\n` : 'Décodage et lecture en boucle dans Chromium: tout est conforme.\n');
  process.exitCode = echecs ? 1 : 0;
}

main().catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exitCode = 1; });
