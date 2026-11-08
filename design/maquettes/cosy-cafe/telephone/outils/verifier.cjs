'use strict';
/*
  Vérifications de la maquette du téléphone: node design/maquettes/cosy-cafe/telephone/outils/verifier.cjs
  1. Parcours au clavier seul (Tab, flèches, Entrée, Retour arrière, A et E), focus toujours visible et dans le téléphone.
  2. Débordements de texte (rectangles des nœuds de texte hors de l'écran du téléphone) à 1366x768, 1920x1080, 1366x768 à 150 %.
  3. Contrastes WCAG des textes visibles (couleur calculée sur le fond opaque le plus proche).
*/
const path = require('path');
const { chromium } = require('playwright');
const url = `file://${path.resolve(__dirname, '..', 'telephone.html')}`;
let echecs = 0;
const ok = (c, m) => { if (!c) echecs += 1; console.log(`${c ? 'ok  ' : 'ÉCHEC'} ${m}`); };

async function focusInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    const tel = document.querySelector('.tel');
    const sec = a && a.closest('[data-app]');
    const r = a ? a.getBoundingClientRect() : null;
    const ecran = document.querySelector('.corps').getBoundingClientRect();
    const dansTel = !!a && tel.contains(a);
    const visible = !!r && r.top >= ecran.top - 1 && r.bottom <= ecran.bottom + 1 || (a && a.closest('.nav, .banniere'));
    return { cle: a && a.dataset ? a.dataset.cle || a.textContent.trim().slice(0, 30) : null, app: window.Maquette.app(), sorti: window.Maquette.sorti(), dansTel, visible: !!visible, anneau: a ? getComputedStyle(a).outlineStyle : '', sec: sec && sec.dataset.app };
  });
}
const pause = (p) => p.waitForTimeout(340);

(async () => {
  const nav = await chromium.launch();
  // 1. Clavier
  {
    const page = await (await nav.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    await page.goto(`${url}?reduit#range`);
    await page.waitForTimeout(100);
    let f = await focusInfo(page);
    ok(!f.sorti, 'état « range » : téléphone rangé');
    await page.keyboard.press('Enter'); await pause(page);
    f = await focusInfo(page);
    ok(f.sorti && f.app === 'messages' && f.cle === 'd-accord', `Entrée sur la proposition reçue ouvre Messages, focus sur « D'accord » (${f.app}, ${f.cle})`);
    ok(f.anneau === 'solid', 'anneau de focus visible');
    await page.keyboard.press('Backspace'); await pause(page);
    f = await focusInfo(page);
    ok(f.sorti && f.app === 'accueil', `Retour arrière revient à l'accueil (${f.app})`);
    await page.keyboard.press('Backspace'); await pause(page);
    f = await focusInfo(page);
    ok(!f.sorti, 'Retour arrière à l\'accueil range le téléphone');
    await page.keyboard.press('Tab'); await pause(page);
    f = await focusInfo(page);
    ok(f.sorti && f.cle === 'a-repondre' && f.visible, `Tab ressort le téléphone, focus sur « Répondre » (${f.cle})`);
    // Atteindre Commandes à la seule flèche: bas, bas (tâche commande), Entrée
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause(page);
    f = await focusInfo(page);
    ok(f.app === 'commandes' && f.cle === 'commander' && f.visible, `flèche bas puis Entrée ouvre Commandes, focus sur « Commander pour mercredi » visible (${f.app}, ${f.cle})`);
    await page.keyboard.press('KeyE'); await pause(page);
    f = await focusInfo(page);
    ok(f.app === 'reserve', `E passe à l'appli suivante (${f.app})`);
    await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ'); await pause(page);
    f = await focusInfo(page);
    ok(f.app === 'accueil', `A deux fois revient à l'accueil (${f.app})`);
    // Grille des applis: descendre jusqu'à Remises par flèches
    const chemin = [];
    for (let i = 0; i < 8; i += 1) {
      f = await focusInfo(page);
      if (f.cle === 'app-remises') break;
      const ligne2 = ['app-remises', 'app-connaitre', 'app-bilans', 'app-projets'].includes(f.cle);
      const k = ligne2 ? 'ArrowLeft' : 'ArrowDown';
      chemin.push(k); await page.keyboard.press(k);
    }
    f = await focusInfo(page);
    ok(f.cle === 'app-remises' && f.visible, `flèches jusqu'à Remises : ${chemin.join(', ')} (${f.cle})`);
    await page.keyboard.press('Space'); await pause(page);
    f = await focusInfo(page);
    ok(f.app === 'remises' && f.cle === 'r-douce', `Espace ouvre Remises, focus sur l'heure douce (${f.cle})`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    const v = await page.evaluate(() => document.querySelector('[data-cle="r-douce"]').getAttribute('aria-checked'));
    ok(v === 'false', 'Entrée coupe l\'heure douce');
    // Parcourir toute l'appli aux flèches: le focus reste visible
    let toujoursVisible = true; let vus = new Set();
    for (let i = 0; i < 20; i += 1) { await page.keyboard.press('ArrowDown'); const g = await focusInfo(page); vus.add(g.cle); if (!g.visible || !g.dansTel) toujoursVisible = false; }
    ok(toujoursVisible, `20 flèches bas dans Remises : focus toujours visible et dans le téléphone (${vus.size} éléments)`);
    await page.keyboard.press('Escape');
    f = await focusInfo(page);
    ok(f.sorti, 'Échap ne range pas le téléphone (il appartient à la pause de Duo)');
    await page.mouse.click(120, 400); await pause(page);
    f = await focusInfo(page);
    ok(!f.sorti, 'clic à côté range le téléphone');
  }
  // 2 et 3. Débordements et contrastes
  const cas = [
    { w: 1366, h: 768, q: '' }, { w: 1920, h: 1080, q: '' }, { w: 1366, h: 768, q: '&taille=150' }, { w: 1280, h: 720, q: '' },
  ];
  for (const c of cas) {
    const page = await (await nav.newContext({ viewport: { width: c.w, height: c.h } })).newPage();
    for (const e of ['accueil', 'commandes', 'carte', 'remises', 'connaitre', 'messages', 'notif']) {
      await page.goto('about:blank');
      await page.goto(`${url}?reduit${c.q}#${e}`);
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const ecran = document.querySelector('.tel__ecran').getBoundingClientRect();
        const tel = document.querySelector('.tel').getBoundingClientRect();
        const hud = [...document.querySelectorAll('.hud .capsule, .aide')].filter((x) => !x.hidden && x.offsetParent !== null).map((x) => x.getBoundingClientRect());
        const deb = []; const contr = [];
        const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const fond = (el) => { for (let n = el; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; const m = b.match(/[\d.]+/g); if (m && (m.length === 3 || Number(m[3]) === 1)) return b; } return 'rgb(43,33,28)'; };
        const w = document.createTreeWalker(document.querySelector('.tel__ecran'), NodeFilter.SHOW_TEXT);
        let n; let petits = 0;
        while ((n = w.nextNode())) {
          if (!n.textContent.trim()) continue;
          const el = n.parentElement; if (el.closest('[hidden]') || el.closest('.sr')) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) {
            if (q.width === 0) continue;
            if (q.left < ecran.left - 0.5 || q.right > ecran.right + 0.5) deb.push(n.textContent.trim().slice(0, 30));
          }
          const cs = getComputedStyle(el);
          if (parseFloat(cs.fontSize) < 13.9) { petits += 1; deb.push('petit: ' + n.textContent.trim().slice(0, 20) + ' ' + cs.fontSize); }
          const a = lum(cs.color); const b = lum(fond(el));
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const grand = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
          if (!el.closest('button:disabled') && ratio < (grand ? 3 : 4.5)) contr.push(`${n.textContent.trim().slice(0, 25)} ${ratio.toFixed(2)}`);
        }
        const chevauche = hud.filter((h) => !(h.right <= tel.left || h.left >= tel.right || h.bottom <= tel.top || h.top >= tel.bottom)).length;
        const min = [...document.querySelectorAll('.corps p, .corps span, .corps b')].filter((x) => x.offsetParent).map((x) => parseFloat(getComputedStyle(x).fontSize));
        return { deb, contr, chevauche, petits, telH: Math.round(tel.height), telW: Math.round(tel.width), dansFenetre: tel.top >= 0 && tel.bottom <= innerHeight, police: getComputedStyle(document.querySelector('.tel')).fontSize };
      });
      if (r.deb.length) console.log('   ', r.deb.join(' | '));
      ok(r.deb.length === 0 && r.contr.length === 0 && r.chevauche === 0 && r.petits === 0 && r.dansFenetre,
        `${c.w}x${c.h}${c.q} ${e} : téléphone ${r.telW}x${r.telH}, police ${r.police}, débordements ${r.deb.length}, contrastes faibles ${r.contr.length}${r.contr.length ? ' (' + r.contr.slice(0, 3).join(' · ') + ')' : ''}, HUD sous le téléphone ${r.chevauche}, textes < 14 px ${r.petits}`);
    }
  }
  await nav.close();
  console.log(echecs === 0 ? 'Tout est bon.' : `${echecs} échec(s).`);
  process.exitCode = echecs === 0 ? 0 : 1;
})();
