'use strict';
/*
  Vérifications du téléphone en jeu sur la page d'aperçu (modèle: la maquette, outils/verifier.cjs).
  node games/deux-tabliers/outils/telephone/verifier.cjs
  1. Parcours au clavier seul: Entrée sur la proposition, Retour arrière jusqu'à ranger, Tab, flèches,
     Entrée et Espace, A et E en boucle, Origine, Échap qui ne range pas, clic à côté. Puis, sur
     l'écran du matin et le bilan (RV-03): alerte de la proposition au premier plan, Entrée qui
     l'ouvre par-dessus, Retour arrière qui rend l'écran, Tab qui sort et range le téléphone.
  2. Débordements (textes hors de l'écran du téléphone), textes sous 14 px, contrastes WCAG,
     capsules du HUD sous le téléphone, à 1366x768, 1920x1080, 1366x768 à 150 % et 1280x720, puis
     en fenêtre réduite (RV-06): 1152x648, 1024x600 (100 et 150 %) et 640x510.
*/
const { chromium } = require('playwright');
const { demarrer } = require('./serveur.cjs');

let echecs = 0;
const ok = (c, m) => {
  if (!c) echecs += 1;
  process.stdout.write(`${c ? 'ok   ' : 'ÉCHEC'} ${m}\n`);
};

async function etat(page) {
  return page.evaluate(() => {
    const tel = document.querySelector('.dt-tel:not(.out)');
    const a = document.activeElement;
    const corps = tel ? tel.querySelector('.dt-corps') : null;
    const r = a ? a.getBoundingClientRect() : null;
    const c = corps ? corps.getBoundingClientRect() : null;
    const dansTel = !!tel && !!a && tel.contains(a);
    const visible =
      dansTel &&
      (!!a.closest('.dt-tel-nav, .dt-banniere, .dt-collant, .dt-confirmer') ||
        (r !== null && c !== null && r.top >= c.top - 1 && r.bottom <= c.bottom + 1));
    const titre = tel ? tel.querySelector('.dt-appli-tete h2') : null;
    return {
      sorti: !!tel,
      ecran: tel ? (titre ? titre.textContent : 'Accueil') : null,
      cle: a
        ? a.getAttribute('data-key') ||
          a.getAttribute('aria-label') ||
          (a.textContent || '').trim().slice(0, 40)
        : null,
      dansTel,
      visible,
      anneau: a ? getComputedStyle(a).outlineStyle : '',
      place: document.body.dataset.sent || '',
    };
  });
}
const pause = (p) => p.waitForTimeout(120);

(async () => {
  const { url, fermer } = await demarrer();
  const nav = await chromium.launch();
  try {
    // 1. Clavier
    {
      const page = await (
        await nav.newContext({ viewport: { width: 1366, height: 768 } })
      ).newPage();
      await page.goto(`${url}?animations=reduites#telephone-range`);
      await page.waitForSelector('body[data-ready="1"]');
      let f = await etat(page);
      ok(!f.sorti, 'téléphone rangé au départ, proposition reçue');
      const alerte = await page.evaluate(() => {
        const el = document.querySelector('.dt-hud .dt-phone-alert');
        return el ? el.textContent : null;
      });
      ok(
        alerte !== null && alerte.startsWith('Téléphone'),
        `alerte du HUD au centre : « ${String(alerte)} »`,
      );
      await page.keyboard.press('Enter');
      await pause(page);
      f = await etat(page);
      ok(
        f.sorti && f.ecran === 'Sacha' && /accord/.test(f.cle || ''),
        `Entrée ouvre Messages, fil de Sacha, focus sur « D'accord » (${f.ecran}, ${f.cle})`,
      );
      ok(f.anneau === 'solid', 'anneau de focus visible');
      await page.keyboard.press('Backspace');
      await pause(page);
      f = await etat(page);
      ok(f.sorti && f.ecran === 'Accueil', `Retour arrière revient à l'accueil (${f.ecran})`);
      await page.keyboard.press('Backspace');
      await pause(page);
      f = await etat(page);
      ok(!f.sorti, "Retour arrière à l'accueil range le téléphone");
      await page.keyboard.press('Tab');
      await page.waitForTimeout(350);
      f = await etat(page);
      ok(
        f.sorti && f.cle === 'todo-achat:1' && f.visible,
        `Tab ressort le téléphone, focus sur la première tâche (${f.cle})`,
      );
      await page.keyboard.press('Shift+Tab');
      f = await etat(page);
      ok(f.sorti, 'Maj+Tab ne range pas le téléphone');
      await page.keyboard.press('ArrowDown');
      f = await etat(page);
      ok(f.cle === 'todo-order', `flèche bas : tâche de la commande (${f.cle})`);
      await page.keyboard.press('Enter');
      await pause(page);
      f = await etat(page);
      ok(
        /^Commandes/.test(f.ecran || '') && /^Commander pour/.test(f.cle || '') && f.visible,
        `Entrée ouvre Commandes, focus « Commander pour ... » visible (${f.ecran}, ${f.cle})`,
      );
      await page.keyboard.press('KeyE');
      await pause(page);
      f = await etat(page);
      ok(f.ecran === 'Réserve', `E passe à l'appli suivante (${f.ecran})`);
      await page.keyboard.press('KeyQ');
      await page.keyboard.press('KeyQ');
      await pause(page);
      f = await etat(page);
      ok(f.ecran === 'Accueil', `A deux fois revient à l'accueil (${f.ecran})`);
      await page.keyboard.press('KeyQ');
      await pause(page);
      f = await etat(page);
      ok(f.ecran === 'Réglages', `A depuis l'accueil boucle sur Réglages (${f.ecran})`);
      await page.keyboard.press('Home');
      await pause(page);
      f = await etat(page);
      ok(f.ecran === 'Accueil', `Origine ramène à l'accueil (${f.ecran})`);
      // Grille: descendre jusqu'à Remises aux flèches (ZQSD compris).
      const chemin = [];
      for (let i = 0; i < 12; i += 1) {
        f = await etat(page);
        if (f.cle === 'app-discounts') break;
        const ligne2 = ['app-marketing', 'app-reports', 'app-projects'].includes(f.cle);
        const k = ligne2 ? 'KeyA' : 'KeyS';
        chemin.push(k);
        await page.keyboard.press(k);
      }
      f = await etat(page);
      ok(
        f.cle === 'app-discounts' && f.visible,
        `flèches et Z Q S D jusqu'à Remises : ${chemin.join(', ')} (${f.cle})`,
      );
      await page.keyboard.press('Space');
      await pause(page);
      f = await etat(page);
      ok(
        f.ecran === 'Remises' && f.cle === 'Heure douce',
        `Espace ouvre Remises, focus sur l'heure douce (${f.cle})`,
      );
      const avant = await page.evaluate(() => document.body.dataset.sent || '');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
      const apres = await page.evaluate(() => document.body.dataset.sent || '');
      ok(
        apres.length > avant.length && apres.endsWith('discounts-set'),
        "Entrée sur l'interrupteur envoie le réglage des remises",
      );
      let toujours = true;
      const vus = new Set();
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press('ArrowDown');
        const g = await etat(page);
        vus.add(g.cle);
        if (!g.visible || !g.dansTel) toujours = false;
      }
      ok(
        toujours,
        `20 flèches bas dans Remises : focus toujours visible et dans le téléphone (${String(vus.size)} éléments)`,
      );
      await page.keyboard.press('Escape');
      f = await etat(page);
      ok(f.sorti, 'Échap ne range pas le téléphone');
      await page.mouse.wheel(0, 0);
      await page.mouse.click(120, 420);
      await pause(page);
      f = await etat(page);
      ok(!f.sorti, 'clic à côté range le téléphone');
      const place = await page.evaluate(() => document.body.dataset.sent);
      ok(/ui-place/.test(place || ''), "chaque écran annonce sa place à l'autre (ui-place)");
    }
    // RV-03: écran du matin et bilan; la proposition de l'autre reste lisible et se répond.
    for (const ecran of ['matin', 'bilan']) {
      const page = await (
        await nav.newContext({ viewport: { width: 1366, height: 768 } })
      ).newPage();
      await page.goto(`${url}?animations=reduites#${ecran}-proposition`);
      await page.waitForSelector('body[data-ready="1"]');
      await page.waitForTimeout(400);
      const dessus = () =>
        page.evaluate(() => {
          const visible = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!top && el.contains(top);
          };
          const ouvre = [...document.querySelectorAll('.dt-hud .dt-proposal')].map(
            (c) => c.textContent,
          );
          return {
            alerte: visible('.dt-screen-proposal'),
            texte: (document.querySelector('.dt-screen-proposal') || {}).textContent || '',
            ecranOuvert: !!document.querySelector('.dt-screen, .dt-backdrop'),
            telDessus: visible('.dt-tel:not(.out) .dt-tel-ecran'),
            ouvre,
          };
        });
      let d = await dessus();
      ok(
        d.alerte && /Sacha propose/.test(d.texte),
        `${ecran} : alerte de la proposition au premier plan (« ${d.texte.slice(0, 70)} »)`,
      );
      if (ecran === 'matin')
        ok(
          d.ouvre.length > 0 && d.ouvre.every((t) => !/Entrée/.test(t)),
          `matin : « On ouvre ? » ne réclame pas Entrée en même temps (${d.ouvre.join(' / ').slice(0, 80)})`,
        );
      await page.keyboard.press('Enter');
      await pause(page);
      let f = await etat(page);
      d = await dessus();
      ok(
        f.sorti && f.ecran === 'Sacha' && /accord/.test(f.cle || '') && d.telDessus,
        `${ecran} : Entrée sort le téléphone par-dessus, Messages, focus « D'accord » (${f.ecran}, ${f.cle})`,
      );
      await page.keyboard.press('Backspace');
      await pause(page);
      f = await etat(page);
      d = await dessus();
      ok(
        !f.sorti && d.ecranOuvert && d.alerte,
        `${ecran} : Retour arrière range le téléphone et rend l'écran du dessous`,
      );
      await page.keyboard.press('Tab');
      await page.waitForTimeout(350);
      f = await etat(page);
      d = await dessus();
      ok(f.sorti && d.telDessus, `${ecran} : Tab sort le téléphone par-dessus l'écran`);
      await page.keyboard.press('Tab');
      await pause(page);
      f = await etat(page);
      d = await dessus();
      ok(!f.sorti && d.ecranOuvert, `${ecran} : Tab le range, l'écran reste`);
    }
    // Notification: bannière dans le téléphone, qui ne prend pas le focus.
    {
      const page = await (
        await nav.newContext({ viewport: { width: 1366, height: 768 } })
      ).newPage();
      await page.goto(`${url}?animations=reduites#telephone-notif`);
      await page.waitForSelector('body[data-ready="1"]');
      await page.waitForTimeout(150);
      const b = await page.evaluate(() => {
        const el = document.querySelector('.dt-banniere');
        return { texte: el ? el.textContent : null, focus: document.activeElement === el };
      });
      ok(
        b.texte !== null && !b.focus,
        `bannière affichée sans prendre le focus : « ${String(b.texte)} »`,
      );
    }
    // 2. Débordements, tailles, contrastes, HUD sous le téléphone
    const cas = [
      { w: 1366, h: 768, q: '' },
      { w: 1920, h: 1080, q: '' },
      { w: 1366, h: 768, q: '&taille=150' },
      { w: 1280, h: 720, q: '' },
      // RV-06: fenêtre réduite, jusqu'à 1024x600 (et la vue d'environ 630x510 du faux hôte).
      { w: 1152, h: 648, q: '' },
      { w: 1024, h: 600, q: '' },
      { w: 1024, h: 600, q: '&taille=150' },
      { w: 640, h: 510, q: '' },
    ];
    for (const c of cas) {
      const page = await (
        await nav.newContext({ viewport: { width: c.w, height: c.h } })
      ).newPage();
      for (const e of [
        'accueil',
        'commandes',
        'reserve',
        'catalogue',
        'carte',
        'remises',
        'faire-connaitre',
        'bilans',
        'projets',
        'reglages',
        'messages',
        'notif',
      ]) {
        await page.goto('about:blank');
        await page.goto(`${url}?animations=reduites${c.q}#telephone-${e}`);
        await page.waitForSelector('body[data-ready="1"]');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const telEl = document.querySelector('.dt-tel');
          const ecran = document.querySelector('.dt-tel-ecran').getBoundingClientRect();
          const tel = telEl.getBoundingClientRect();
          const hud = [...document.querySelectorAll('.dt-hud .dt-card')]
            .filter((x) => x.getClientRects().length > 0 && !x.closest('[hidden]'))
            .map((x) => x.getBoundingClientRect());
          const deb = [];
          const contr = [];
          let petits = 0;
          const lum = (s) => {
            const m = s.match(/[\d.]+/g).map(Number);
            const f = (v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
          };
          const fond = (el) => {
            for (let n = el; n; n = n.parentElement) {
              const b = getComputedStyle(n).backgroundColor;
              const m = b.match(/[\d.]+/g);
              if (m && (m.length === 3 || Number(m[3]) === 1)) return b;
            }
            return 'rgb(43,33,28)';
          };
          const w = document.createTreeWalker(
            document.querySelector('.dt-tel-ecran'),
            NodeFilter.SHOW_TEXT,
          );
          let n;
          while ((n = w.nextNode())) {
            if (!n.textContent.trim()) continue;
            const el = n.parentElement;
            if (el.closest('[hidden]') || el.closest('.dt-sr') || el.closest('.dt-puces')) continue;
            const rg = document.createRange();
            rg.selectNodeContents(n);
            for (const q of rg.getClientRects()) {
              if (q.width === 0) continue;
              if (q.left < ecran.left - 0.5 || q.right > ecran.right + 0.5)
                deb.push(n.textContent.trim().slice(0, 30));
            }
            const cs = getComputedStyle(el);
            if (parseFloat(cs.fontSize) < 13.9) {
              petits += 1;
              deb.push(`petit: ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
            }
            const a = lum(cs.color);
            const b = lum(fond(el));
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            const grand =
              parseFloat(cs.fontSize) >= 24 ||
              (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
            if (!el.closest('button:disabled') && ratio < (grand ? 3 : 4.5))
              contr.push(`${n.textContent.trim().slice(0, 25)} ${ratio.toFixed(2)}`);
          }
          // Puces qui défilent à l'horizontale: seule leur rangée doit tenir dans l'écran.
          for (const row of document.querySelectorAll('.dt-tel .dt-puces')) {
            const q = row.getBoundingClientRect();
            if (q.left < ecran.left - 0.5 || q.right > ecran.right + 0.5)
              deb.push('rangée de puces');
          }
          const chevauche = hud.filter(
            (x) =>
              !(
                x.right <= tel.left ||
                x.left >= tel.right ||
                x.bottom <= tel.top ||
                x.top >= tel.bottom
              ),
          ).length;
          return {
            deb,
            contr,
            chevauche,
            petits,
            telW: Math.round(tel.width),
            telH: Math.round(tel.height),
            dansFenetre:
              tel.top >= 0 && tel.bottom <= innerHeight && tel.left >= 0 && tel.right <= innerWidth,
            police: getComputedStyle(telEl).fontSize,
          };
        });
        if (r.deb.length) process.stdout.write(`      ${r.deb.slice(0, 6).join(' | ')}\n`);
        ok(
          r.deb.length === 0 &&
            r.contr.length === 0 &&
            r.chevauche === 0 &&
            r.petits === 0 &&
            r.dansFenetre,
          `${String(c.w)}x${String(c.h)}${c.q} ${e} : téléphone ${String(r.telW)}x${String(r.telH)}, police ${r.police}, débordements ${String(r.deb.length)}, contrastes faibles ${String(r.contr.length)}${r.contr.length ? ` (${r.contr.slice(0, 3).join(' · ')})` : ''}, HUD sous le téléphone ${String(r.chevauche)}, textes < 14 px ${String(r.petits)}`,
        );
      }
    }
  } finally {
    await nav.close();
    await fermer();
  }
  process.stdout.write(echecs === 0 ? 'Tout est bon.\n' : `${String(echecs)} échec(s).\n`);
  process.exitCode = echecs === 0 ? 0 : 1;
})().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});
