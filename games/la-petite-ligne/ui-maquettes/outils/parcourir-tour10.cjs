'use strict';
/*
  Parcours au clavier et à la souris de l'interface du tour 10 (lot L6) sur la page de
  démonstration, la simulation en marche: rideaux (clic sur l'invite, puis Entrée), chantier
  d'une pièce (clic sur l'invite, dépôt au clavier), carnet (Tab, A vers « Besoins », flèches,
  Entrée sur « Besoins en sourdine »), rangement (flèches, Entrée pour choisir puis prendre,
  clic sur « Tout déposer »), sieste (« Lire le carnet » sans menu du jeu, « Se lever »), établi
  (« Proposer à Sacha » pour le cellier), création (couleur et barbe à la souris).
  Chaque étape vérifie l'effet dans l'état de la simulation (`window.lplInterface.world()`).

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé:
    node games/la-petite-ligne/ui-maquettes/outils/parcourir-tour10.cjs [http://127.0.0.1:5197/]
*/
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:5197/';

async function open(browser, scenario, joueur = 'p1') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  await page.goto(
    `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&autre=fige&rendu=0`,
    { timeout: 600_000 },
  );
  await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: 600_000 });
  await page.waitForTimeout(600);
  return { page, erreurs };
}

const world = (page, fn) => page.evaluate(fn);
const focusKey = (page) =>
  page.evaluate(
    () => document.activeElement?.getAttribute('data-key') ?? document.activeElement?.tagName ?? '',
  );

async function until(page, fn, label) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(100);
  }
  throw new Error(`attendu: ${label}`);
}

(async () => {
  const browser = await chromium.launch();
  const lignes = [];
  const ok = (t) => lignes.push(`ok  ${t}`);
  const toutes = [];

  // 1. Rideaux: la souris sur l'invite, puis Entrée.
  {
    const { page, erreurs } = await open(browser, 'rideaux');
    await page.locator('.lpl-invite').click();
    await until(
      page,
      () =>
        window.lplInterface.world().furniture.find((f) => f.id === 'f-rideaux')?.closed === true,
      'rideaux fermés au clic',
    );
    ok('rideaux: clic sur « Fermer les rideaux », rideaux fermés');
    await until(
      page,
      () => document.querySelector('.lpl-invite')?.textContent?.includes('Ouvrir') === true,
      'invite « Ouvrir »',
    );
    await page.keyboard.press('Enter');
    await until(
      page,
      () =>
        window.lplInterface.world().furniture.find((f) => f.id === 'f-rideaux')?.closed !== true,
      'rideaux ouverts à Entrée',
    );
    ok('rideaux: Entrée sur « Ouvrir les rideaux », rideaux ouverts');
    toutes.push(...erreurs);
    await page.close();
  }

  // 2. Chantier: clic sur l'invite, dépôt au clavier, Retour arrière ferme.
  {
    const { page, erreurs } = await open(browser, 'chantier');
    await page.locator('.lpl-invite').click();
    await page.locator('.lpl-room__elements').waitFor();
    // Anti-double-appui à l'arrivée d'un panneau (300 ms).
    await page.waitForTimeout(500);
    ok('chantier: clic sur l’invite, le panneau du chantier s’ouvre');
    const before = await world(
      page,
      () =>
        window.lplInterface.world().rooms.room_cellar.crate.find((s) => s.item === 'plank')
          ?.count ?? 0,
    );
    const key = await focusKey(page);
    if (key !== 'deposit:plank') throw new Error(`focus du chantier: ${key}`);
    await page.keyboard.press('Enter');
    await until(
      page,
      () =>
        (window.lplInterface.world().rooms.room_cellar.crate.find((s) => s.item === 'plank')
          ?.count ?? 0) > 5,
      'planches déposées',
    );
    const after = await world(
      page,
      () =>
        window.lplInterface.world().rooms.room_cellar.crate.find((s) => s.item === 'plank')
          ?.count ?? 0,
    );
    ok(`chantier: Entrée sur « Déposer », planches à la caisse ${before} puis ${after}`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    ok(`chantier: flèches, focus sur ${await focusKey(page)}`);
    await page.keyboard.press('Backspace');
    await until(page, () => document.querySelector('.lpl-panel') === null, 'panneau fermé');
    ok('chantier: Retour arrière ferme le panneau');
    toutes.push(...erreurs);
    await page.close();
  }

  // 3. Carnet: Tab, A jusqu'à « Besoins », flèches jusqu'à la case à cocher, Entrée.
  {
    const { page, erreurs } = await open(browser, 'besoins-hud');
    await page.keyboard.press('Tab');
    await page.locator('.lpl-notebook').waitFor();
    await page.waitForTimeout(500);
    for (let i = 0; i < 5 && (await page.locator('.lpl-needs-page').count()) === 0; i++) {
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(250);
    }
    await page.locator('.lpl-needs-page').waitFor();
    ok('carnet: Tab ouvre, A mène à la page des besoins');
    for (let i = 0; i < 8 && (await focusKey(page)) !== 'mute-needs'; i++)
      await page.keyboard.press('ArrowDown');
    if ((await focusKey(page)) !== 'mute-needs')
      throw new Error('case « Besoins en sourdine » hors d’atteinte');
    await page.keyboard.press('Enter');
    await until(
      page,
      () => document.querySelector('[data-key="mute-needs"]')?.checked === true,
      'sourdine cochée',
    );
    ok('carnet: flèches jusqu’à « Besoins en sourdine », Entrée la coche');
    await page.locator('[data-key="mute-needs"]').click();
    await until(
      page,
      () => document.querySelector('[data-key="mute-needs"]')?.checked === false,
      'sourdine décochée au clic',
    );
    ok('carnet: clic la décoche');
    await page.keyboard.press('Tab');
    await until(page, () => document.querySelector('.lpl-notebook') === null, 'carnet fermé');
    ok('carnet: Tab le ferme');
    toutes.push(...erreurs);
    await page.close();
  }

  // 4. Rangement: flèches, Entrée choisit puis prend; clic sur « Tout déposer: récoltes ».
  {
    const { page, erreurs } = await open(browser, 'rangement');
    await page.locator('.lpl-storage').waitFor();
    await page.waitForTimeout(500);
    ok(`rangement: focus à l’ouverture ${await focusKey(page)}`);
    await page.keyboard.press('ArrowRight');
    const key = await focusKey(page);
    await page.keyboard.press('Enter');
    await until(
      page,
      () => document.activeElement?.getAttribute('aria-pressed') === 'true',
      'case choisie',
    );
    await page.keyboard.press('Enter');
    if ((await focusKey(page)) !== 'take-cell')
      throw new Error(`focus après Entrée: ${await focusKey(page)}`);
    const before = await world(page, () =>
      window.lplInterface.world().cellar.reduce((n, s) => n + s.count, 0),
    );
    await page.keyboard.press('Enter');
    await until(
      page,
      () => window.lplInterface.world().cellar.reduce((n, s) => n + s.count, 0) < 145,
      'case prise',
    );
    const after = await world(page, () =>
      window.lplInterface.world().cellar.reduce((n, s) => n + s.count, 0),
    );
    ok(
      `rangement: → sur ${key}, Entrée la choisit, Entrée « Prendre la case », Entrée prend (${before} puis ${after} objets rangés)`,
    );
    const radish = () =>
      window.lplInterface.world().cellar.find((s) => s.item === 'radish')?.count ?? 0;
    const r0 = await world(page, radish);
    await page.locator('[data-key="family:crop"]').click();
    await until(
      page,
      () =>
        (window.lplInterface.world().cellar.find((s) => s.item === 'radish')?.count ?? 0) > 0 &&
        window.lplInterface
          .world()
          .characters[0].bag.every((s) => s === null || s.item !== 'radish'),
      'récoltes déposées',
    );
    ok(
      `rangement: clic « Tout déposer : récoltes » (radis rangés ${r0} puis ${await world(page, radish)})`,
    );
    await page.locator('[data-key="sort"]').click();
    ok('rangement: clic « Ranger »');
    toutes.push(...erreurs);
    await page.close();
  }

  // 5. Sieste: le carnet s'ouvre sans menu du jeu (on dort), « Se lever » réveille.
  {
    const { page, erreurs } = await open(browser, 'sieste');
    await page.locator('[data-key="nap-notebook"]').click();
    await page.locator('.lpl-notebook').waitFor();
    await page.waitForTimeout(2000);
    if ((await page.locator('.lpl-notebook').count()) === 0)
      throw new Error('le carnet s’est refermé pendant la sieste');
    const status = await world(page, () => window.lplInterface.world().characters[0].status);
    ok(`sieste: « Lire le carnet » l’ouvre et il reste ouvert (statut ${status})`);
    await page.keyboard.press('Backspace');
    await until(page, () => document.querySelector('.lpl-notebook') === null, 'carnet fermé');
    await page.locator('[data-key="nap-get-up"]').click();
    await until(
      page,
      () => window.lplInterface.world().characters[0].status === 'active',
      'réveillé',
    );
    ok('sieste: Retour arrière ferme le carnet, « Se lever » réveille');
    toutes.push(...erreurs);
    await page.close();
  }

  // 6. Établi: « Proposer à Sacha: 450 sous » pour le cellier.
  {
    const { page, erreurs } = await open(browser, 'etabli-pieces');
    await page.locator('[data-key="order:room_cellar"]').click();
    await until(
      page,
      () => window.lplInterface.world().proposals.some((p) => p.purchase.item === 'room_cellar'),
      'proposition du cellier',
    );
    await until(
      page,
      () => document.querySelector('.lpl-room-order[data-state="waiting"]') !== null,
      'en attente',
    );
    ok('établi: clic « Proposer à Sacha », la proposition part, la ligne attend l’accord');
    toutes.push(...erreurs);
    await page.close();
  }

  // 7. Création: couleur et barbe à la souris, prénom au clavier.
  {
    const { page, erreurs } = await open(browser, 'creation-coiffure');
    await page.locator('label.lpl-option', { hasText: 'Roux' }).click();
    await page.locator('label.lpl-option', { hasText: 'Moustache' }).click();
    await page.locator('label.lpl-option', { hasText: 'Tresse' }).first().click();
    await page.locator('.lpl-field__input').fill('Camille');
    await page.keyboard.press('Enter');
    await until(
      page,
      () => window.lplInterface.log.intents.includes('create_character'),
      'création envoyée',
    );
    const look = await world(page, () => window.lplInterface.world().characters[0].appearance);
    ok(
      `création: Roux, Moustache, Tresse, Entrée (apparence dans l’état: coupe ${look.hair}, couleur ${look.hairColor}, barbe ${look.beard})`,
    );
    toutes.push(...erreurs);
    await page.close();
  }

  await browser.close();
  process.stdout.write(
    `${lignes.join('\n')}\n${toutes.length === 0 ? 'Aucune erreur en console.' : toutes.join('\n')}\n`,
  );
  process.exitCode = toutes.length === 0 ? 0 : 1;
})().catch((e) => {
  process.stdout.write(`ÉCHEC: ${e.message}\n`);
  process.exitCode = 1;
});
