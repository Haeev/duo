// P17 carnet ouvert sur l'onglet des quêtes: l'histoire d'Aubrune est une seule carte dont les
// actes se suivent (acte fini replié, acte en cours déplié). Départ: acte 1 fini, acte 2 commencé.
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';

test('carnet: l’histoire d’Aubrune regroupée par actes', async ({ browser }) => {
  const duo = await startDuo(browser, 'p17-carnet-histoire', { save: 'aubrune-acte2' });
  const { host, guest } = duo;
  await host.page.waitForTimeout(1500);
  await host.press('KeyC');
  const book = host.game().locator('.lpl-ui .carnet');
  await expect(book).toBeVisible();
  // Règle (interface.md, 5.3): C ouvre sur le dernier onglet vu, le Sac la première fois; E, même
  // tapé aussitôt (garde d'ouverture), passe à l'onglet Quêtes. Aucune attente entre les deux.
  const selected = book.locator('.signet[aria-selected="true"]');
  await expect(selected).toHaveAttribute('aria-label', 'Sac');
  await host.press('KeyE');
  await expect(selected).toHaveAttribute('aria-label', 'Quêtes');
  const saga = book.locator('.saga');
  await expect(saga, 'une seule carte pour toute l’histoire').toHaveCount(1);
  await expect(saga.locator('.quete__titre').first()).toHaveText('Aubrune');
  const acts = saga.locator('.acte');
  await expect(acts).toHaveCount(2);
  await expect(acts.nth(0)).toContainText('Acte 1');
  await expect(acts.nth(0)).toHaveClass(/acte--done/);
  await expect(acts.nth(1)).toContainText('Acte 2');
  await expect(acts.nth(1)).toHaveClass(/acte--ouvert/);
  await expect(acts.nth(1).locator('.acte__etape')).not.toBeEmpty();
  await host.page.waitForTimeout(500);
  await host.shot('1-quetes-actes');
  // Refermé puis rouvert, le carnet revient sur l'onglet Quêtes, le dernier vu.
  await host.press('KeyC');
  await expect(book).toBeHidden();
  await host.press('KeyC');
  await expect(selected).toHaveAttribute('aria-label', 'Quêtes');
  await expect(book.locator('.saga')).toHaveCount(1);
  // Le carnet de l'invité est le sien: il l'ouvre aussi, sur la même histoire.
  await guest.press('KeyC');
  await expect(guest.game().locator('.lpl-ui .carnet')).toBeVisible();
  await guest.press('KeyE');
  await expect(
    guest.game().locator('.lpl-ui .carnet .signet[aria-selected="true"]'),
  ).toHaveAttribute('aria-label', 'Quêtes');
  await expect(guest.game().locator('.lpl-ui .carnet .saga .acte')).toHaveCount(2);
  await guest.shot('1-quetes-actes');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
