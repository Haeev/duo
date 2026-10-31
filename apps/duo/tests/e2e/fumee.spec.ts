// Test de fumée (lot L2): l'application démarre, le premier lancement mène à
// l'accueil, les réglages de sécurité des vues sont ceux de l'ADR 0003.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SCREENSHOTS, closeDuo, launchDuo, tempDataDir } from './duo';

function localDay(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test('Duo démarre, le premier lancement mène à l’accueil', async () => {
  const dataDir = await tempDataDir('fumée');
  const duo = await launchDuo({ dataDir, liaisonPort: 41230 });
  try {
    const { platform } = duo;
    await expect(platform.getByTestId('ecran-bienvenue')).toBeVisible();
    await expect(platform.getByRole('heading', { name: 'Bienvenue dans Duo' })).toBeVisible();
    await platform.screenshot({ path: path.join(SCREENSHOTS, 'fumee-bienvenue.png') });

    // Entrée sur le bouton qui a le focus par défaut (UX 1.2), après la garde de 300 ms.
    await platform.waitForTimeout(350);
    await platform.keyboard.press('Enter');
    await expect(platform.getByTestId('ecran-profil')).toBeVisible();
    const pseudo = platform.getByTestId('profil-pseudo');
    await expect(pseudo).toBeFocused();
    await pseudo.fill('Hélène');
    await platform.screenshot({ path: path.join(SCREENSHOTS, 'fumee-profil.png') });
    await platform.getByTestId('profil-continuer').click();

    await expect(platform.getByTestId('ecran-reseau')).toBeVisible();
    await platform.getByTestId('reseau-continuer').click();
    await expect(platform.getByTestId('ecran-recherche')).toBeVisible();
    await platform.getByTestId('recherche-terminer-sans').click();

    await expect(platform.getByTestId('ecran-accueil')).toBeVisible();
    await expect(platform.getByTestId('accueil-heberger')).toBeFocused();
    await platform.screenshot({ path: path.join(SCREENSHOTS, 'fumee-accueil.png') });

    // Profil et réglages écrits en sûreté dans le dossier de données (nom accentué).
    const profile = JSON.parse(await readFile(path.join(dataDir, 'profile.json'), 'utf8')) as {
      pseudo: string;
    };
    expect(profile.pseudo).toBe('Hélène');
    const settings = JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8')) as {
      setupDone: boolean;
      networkAccepted: boolean;
    };
    expect(settings).toMatchObject({ setupDone: true, networkAccepted: true });

    // Ni Node ni Electron dans la page; le protocole duo:// sert la CSP stricte de l'ADR 0003.
    // (Le code évalué par Playwright échappe à la CSP: on lit l'en-tête servi.)
    const exposure = await platform.evaluate(async () => {
      const response = await fetch(window.location.href);
      return {
        require: typeof (window as { require?: unknown }).require,
        process: typeof (window as { process?: unknown }).process,
        duo: Object.keys((window as { duo?: object }).duo ?? {}).sort(),
        csp: response.headers.get('content-security-policy') ?? '',
      };
    });
    expect(exposure).toMatchObject({
      require: 'undefined',
      process: 'undefined',
      duo: ['getState', 'invoke', 'onState'],
    });
    expect(exposure.csp).toContain("default-src 'self'");
    expect(exposure.csp).toContain("script-src 'self';");
    expect(exposure.csp).not.toContain('unsafe');

    const journal = await readFile(
      path.join(dataDir, 'logs', `duo-${localDay()}.jsonl`),
      'utf8',
    ).catch(() => '');
    expect(journal).toContain('"launcher-ready"');
  } finally {
    await closeDuo(duo);
  }
});
