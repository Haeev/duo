'use strict';
// Contrôles chiffrés de l'identité B, lus dans jetons.json et joueurs.json (les fichiers livrés, pas la source):
//   1. contrastes WCAG des textes (4,5:1) et des composants (3:1) sur chaque fond où ils se posent;
//   2. les six couleurs de joueur deux à deux: CIEDE2000 en vision normale (20 au moins) et après simulation
//      de la protanopie, de la deutéranopie et de la tritanopie (10 au moins), seuils de CA-PF-109;
//   3. recouvrement des silhouettes des six symboles (IoU à 48 px): garde-fou contre deux symboles trop
//      proches (au-delà de 0,75); la lisibilité elle-même se juge sur la planche (16 px, niveaux de gris).
// Écrit controles/mesures.json (relu par les planches) et imprime les tableaux Markdown de la documentation.
// Sort en erreur si un seuil n'est pas tenu.
// Usage: node outils/controler.cjs  (ou npm run controler)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const c = require('./couleur.cjs');

const ROOT = path.join(__dirname, '..');
const { tokens } = JSON.parse(fs.readFileSync(path.join(ROOT, 'jetons.json'), 'utf8'));
const { players } = JSON.parse(fs.readFileSync(path.join(ROOT, 'joueurs.json'), 'utf8'));
const C = tokens.color;
const fr = (n, d = 1) => n.toFixed(d).replace('.', ',');
const BGS = ['bg', 'surface', 'surface-raised'];

let failures = 0;
const results = { contrasts: [], players: {}, silhouettes: {} };

// ---------- 1. contrastes ----------
const checks = [];
const add = (fgName, fg, bgName, bg, kind) => checks.push({ fgName, fg, bgName, bg, kind });
for (const b of BGS) {
  add('text', C.text, b, C[b], 'texte');
  add('text-muted', C['text-muted'], b, C[b], 'texte');
  add('accent', C.accent, b, C[b], 'texte');
  add('success', C.success, b, C[b], 'texte');
  add('error', C.error, b, C[b], 'texte');
  add('text-disabled', C['text-disabled'], b, C[b], 'inactif');
}
for (const a of ['accent', 'accent-hover', 'accent-pressed']) add('on-accent', C['on-accent'], a, C[a], 'texte');
for (const p of players) add('player-on', tokens.player.on, `player-${p.id}`, p.color, 'texte');
for (const b of BGS) {
  add('outline', C.outline, b, C[b], 'composant');
  add('focus', C.focus, b, C[b], 'composant');
  add('accent', C.accent, b, C[b], 'composant');
  for (const p of players) add(`player-${p.id}`, p.color, b, C[b], 'composant');
  add('line', C.line, b, C[b], 'décor');
}
// voile sur un jeu figé: pire cas (pixel blanc, pixel noir); les panneaux posés dessus sont opaques
for (const [name, game] of [['jeu blanc', '#FFFFFF'], ['jeu noir', '#000000']]) {
  const dimmed = c.over(C.scrim, game);
  add('surface (panneau)', C.surface, `voile sur ${name} ${dimmed}`, dimmed, 'information');
}

const THRESHOLD = { texte: 4.5, composant: 3, inactif: null, décor: null, information: null };
console.log('### Contrastes\n');
console.log('| Premier plan | Fond | Rapport | Seuil | Résultat |');
console.log('|---|---|---|---|---|');
for (const k of checks) {
  const ratio = c.contrast(k.fg, k.bg);
  const t = THRESHOLD[k.kind];
  let verdict;
  if (t === null) verdict = k.kind === 'inactif' ? 'exempté (élément inactif)' : k.kind === 'décor' ? 'décor, jamais seul porteur d\'information' : 'mesure';
  else if (ratio >= t) verdict = 'AA';
  else {
    verdict = 'ÉCHEC';
    failures++;
  }
  results.contrasts.push({ ...k, ratio: Number(ratio.toFixed(2)), threshold: t, verdict });
  console.log(`| ${k.fgName} \`${k.fg}\` | ${k.bgName}${k.bgName.startsWith('voile') ? '' : ` \`${k.bg}\``} | ${fr(ratio, 2)}:1 | ${t ? fr(t) + ':1 (' + k.kind + ')' : 'aucun'} | ${verdict} |`);
}

// ---------- 2. couleurs des joueurs deux à deux ----------
const VISIONS = ['normale', 'protanopie', 'deuteranopie', 'tritanopie'];
const MIN = { normale: 20, protanopie: 10, deuteranopie: 10, tritanopie: 10 };
console.log('\n### Couleurs des joueurs\n');
console.log('| Profil | Couleur | L* | Gris (ImageMagick) | Protanopie | Deutéranopie | Tritanopie | Sur la nuit | Sur surface haute |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const p of players) {
  console.log(`| ${p.label} | \`${p.color}\` | ${fr(c.lightness(p.color))} | ${fr(c.grayIm(p.color), 0)} % | \`${c.simulate(p.color, 'protanopie')}\` | \`${c.simulate(p.color, 'deuteranopie')}\` | \`${c.simulate(p.color, 'tritanopie')}\` | ${fr(c.contrast(p.color, C.bg), 2)}:1 | ${fr(c.contrast(p.color, C['surface-raised']), 2)}:1 |`);
}
const pairs = [];
for (let i = 0; i < players.length; i++) {
  for (let j = i + 1; j < players.length; j++) {
    const a = players[i];
    const b = players[j];
    const row = { a: a.id, b: b.id };
    for (const v of VISIONS) row[v] = c.deltaE00(c.simulate(a.color, v), c.simulate(b.color, v));
    row.gris = c.deltaE00(c.simulate(a.color, 'gris'), c.simulate(b.color, 'gris'));
    row.ecartL = Math.abs(c.lightness(a.color) - c.lightness(b.color));
    pairs.push(row);
  }
}
console.log('\n| Paire | Normale | Protanopie | Deutéranopie | Tritanopie | Écart de clarté L* |');
console.log('|---|---|---|---|---|---|');
const label = (id) => players.find((p) => p.id === id).label;
for (const r of pairs) {
  const cells = VISIONS.map((v) => {
    const ok = r[v] >= MIN[v];
    if (!ok) failures++;
    return `${fr(r[v])}${ok ? '' : ' (ÉCHEC)'}`;
  });
  console.log(`| ${label(r.a)} / ${label(r.b)} | ${cells.join(' | ')} | ${fr(r.ecartL)} |`);
}
const worst = {};
for (const v of [...VISIONS, 'gris']) {
  const w = pairs.reduce((m, r) => (r[v] < m[v] ? r : m), pairs[0]);
  worst[v] = { value: Number(w[v].toFixed(1)), pair: [w.a, w.b], threshold: MIN[v] || null };
}
console.log('\n| Vision | Pire paire | ΔE2000 | Seuil (CA-PF-109) | Marge |');
console.log('|---|---|---|---|---|');
for (const v of VISIONS) {
  const w = worst[v];
  console.log(`| ${v} | ${label(w.pair[0])} / ${label(w.pair[1])} | ${fr(w.value)} | ${w.threshold} | ${fr((w.value / w.threshold - 1) * 100, 0)} % |`);
}
console.log(`\nNiveaux de gris (vision achromate, information): pire paire ${label(worst.gris.pair[0])} / ${label(worst.gris.pair[1])}, ΔE2000 ${fr(worst.gris.value)}: les symboles portent la distinction.`);
results.players = { list: players.map((p) => ({ id: p.id, label: p.label, color: p.color, L: Number(c.lightness(p.color).toFixed(1)), sims: Object.fromEntries([...VISIONS, 'gris'].map((v) => [v, c.simulate(p.color, v)])) })), pairs: pairs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Number(v.toFixed(1)) : v]))), worst, thresholds: MIN };

// voisinages avec les couleurs de l'interface (information: ces couleurs ne jouent pas le même rôle)
console.log('\n| Couleur de joueur | ΔE2000 avec l\'accent | avec le succès | avec l\'erreur |');
console.log('|---|---|---|---|');
for (const p of players) console.log(`| ${p.label} | ${fr(c.deltaE00(p.color, C.accent))} | ${fr(c.deltaE00(p.color, C.success))} | ${fr(c.deltaE00(p.color, C.error))} |`);
console.log(`\nSuccès / erreur: ΔE2000 ${fr(c.deltaE00(C.success, C.error))} en vision normale, ${fr(c.deltaE00(c.simulate(C.success, 'deuteranopie'), c.simulate(C.error, 'deuteranopie')))} en deutéranopie: l'icône distingue les deux états.`);

// ---------- 3. silhouettes des symboles ----------
const SIZE = 48;
const masks = {};
for (const p of players) {
  const png = execFileSync('rsvg-convert', ['-w', String(SIZE), '-h', String(SIZE), '-b', 'white', path.join(ROOT, `symboles/${p.id}.svg`)]);
  const gray = execFileSync('convert', ['png:-', '-colorspace', 'Gray', '-depth', '8', 'gray:-'], { input: png });
  masks[p.id] = Array.from(gray, (v) => v < 128);
}
console.log(`\n### Silhouettes (recouvrement IoU à ${SIZE} px, 1 = identiques)\n`);
console.log(`| | ${players.map((p) => p.symbolName).join(' | ')} |`);
console.log(`|---|${players.map(() => '---').join('|')}|`);
let maxIoU = 0;
for (const a of players) {
  const cells = players.map((b) => {
    if (a.id === b.id) return '';
    let inter = 0;
    let union = 0;
    for (let i = 0; i < masks[a.id].length; i++) {
      if (masks[a.id][i] && masks[b.id][i]) inter++;
      if (masks[a.id][i] || masks[b.id][i]) union++;
    }
    const iou = inter / union;
    results.silhouettes[`${a.id}/${b.id}`] = Number(iou.toFixed(2));
    maxIoU = Math.max(maxIoU, iou);
    return fr(iou, 2);
  });
  console.log(`| ${a.symbolName} | ${cells.join(' | ')} |`);
}
console.log(`\nRecouvrement le plus fort: ${fr(maxIoU, 2)}.`);
if (maxIoU > 0.75) {
  failures++;
  console.log('ÉCHEC: deux silhouettes se recouvrent à plus de 75 %.');
}

fs.mkdirSync(path.join(ROOT, 'controles'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'controles/mesures.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures ? failures + ' échec(s)' : 'Tous les seuils sont tenus'}.`);
if (failures) process.exit(1);
