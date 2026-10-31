// Le faux hôte dans Chromium, avec le jeu d'essai games/_essais/echo.
import { expect, test, type Page } from '@playwright/test';

test("deux vues locales: un message passe de l'invité à l'hôte et revient", async ({ page }) => {
  await page.goto('/deux-vues.html?latence=40&gigue=10');
  const views = page.locator('.vue');
  await expect(views).toHaveCount(2);
  await expect(views.nth(0)).toHaveAttribute('data-statut', 'running', { timeout: 15_000 });
  await expect(views.nth(1)).toHaveAttribute('data-statut', 'running');

  const host = page.frameLocator('.vue >> nth=0 >> iframe');
  const guest = page.frameLocator('.vue >> nth=1 >> iframe');
  await expect(host.locator('#role')).toHaveText('Hôte');
  await expect(guest.locator('#role')).toHaveText('Invité');
  await expect(guest.locator('#joueurs')).toHaveText('Sacha avec Alex');

  await guest.locator('#envoyer').click();
  await expect(host.locator('#recu')).toHaveText('Reçu de Sacha: 1');
  await expect(guest.locator('#reponse')).toHaveText('Réponse de Alex: 2');

  // Échap chez l'invité met les deux en pause; « Reprendre » relance les deux.
  await guest.locator('body').press('Escape');
  await expect(views.nth(0)).toHaveAttribute('data-statut', 'paused');
  await expect(views.nth(1)).toHaveAttribute('data-statut', 'paused');
  await views.nth(0).getByRole('button', { name: 'Reprendre' }).click();
  await expect(views.nth(1)).toHaveAttribute('data-statut', 'running');
});

async function chooseProfile(page: Page, name: string, color: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Ton pseudo').fill(name);
  await page.getByLabel(color).check();
}

test('réseau local: deux navigateurs, l’un héberge, l’autre rejoint', async ({ browser }) => {
  const mac = await browser.newContext();
  const pc = await browser.newContext();
  const hostPage = await mac.newPage();
  const guestPage = await pc.newPage();

  await chooseProfile(hostPage, 'Loïc', 'Astre aqua');
  await hostPage.getByRole('button', { name: 'Héberger', exact: true }).click();
  await expect(hostPage.locator('.vue')).toHaveAttribute('data-statut', 'waiting-peer');

  await chooseProfile(guestPage, 'Zoé', 'Comète jade');
  await guestPage.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(hostPage.locator('.vue')).toHaveAttribute('data-statut', 'running', {
    timeout: 15_000,
  });
  await expect(guestPage.locator('.vue')).toHaveAttribute('data-statut', 'running');
  const host = hostPage.frameLocator('iframe');
  const guest = guestPage.frameLocator('iframe');
  await expect(guest.locator('#joueurs')).toHaveText('Zoé avec Loïc');
  await guest.locator('#envoyer').click();
  await expect(host.locator('#recu')).toHaveText('Reçu de Zoé: 1');
  await expect(guest.locator('#reponse')).toHaveText('Réponse de Loïc: 2');

  // Quitter depuis la pause: l'invité demande, l'hôte arrête les deux et inscrit l'historique.
  await guest.locator('body').press('Escape');
  await expect(guestPage.locator('.vue')).toHaveAttribute('data-statut', 'paused');
  await guestPage.getByRole('button', { name: 'Quitter la partie' }).click();
  await expect(hostPage.locator('.vue')).toHaveAttribute('data-statut', 'stopped', {
    timeout: 10_000,
  });
  await expect(guestPage.locator('.vue')).toHaveAttribute('data-statut', 'stopped');

  await mac.close();
  await pc.close();
});
