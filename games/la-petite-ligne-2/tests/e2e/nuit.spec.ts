// N1 la nuit à Aubrune: à 21 h, les fenêtres du bourg s'allument et les réverbères posent leur
// flaque de lumière; un habitant rentre se coucher. La sonde d'essai n'expose pas l'éclairage
// (fenêtres allumées, flaques des réverbères): ces deux points se jugent sur les captures de
// l'hôte et de l'invité, prises sur la place. Le coucher se lit dans l'état (`life.pose`).
// Sauvegarde « aubrune-recette »; l'heure est avancée à 20 h 55 (mise en place).
import { expect, test } from '@playwright/test';
import { startDuo, type ProbeWorld } from '../aides-e2e/duo';
import { placeAt, probeCall, settle, shot, uiText } from '../aides-e2e/contenu';
import { Journal, seats } from '../aides-e2e/prologue';

test.use({ viewport: { width: 320, height: 180 } });

interface Lives {
  readonly places: Readonly<
    Record<
      string,
      | {
          readonly villagers?: Readonly<
            Record<
              string,
              {
                readonly body: { readonly x: number; readonly y: number };
                readonly life?: { readonly pose: string };
              }
            >
          >;
        }
      | undefined
    >
  >;
}

function sleepers(w: ProbeWorld): string[] {
  const all = (w as unknown as Lives).places.aubrune?.villagers ?? {};
  return Object.entries(all)
    .filter(([, v]) => v.life?.pose === 'lie')
    .map(([id]) => id);
}

test('N1 nuit: fenêtres et réverbères à 21 h, un habitant au lit', async ({ browser }) => {
  test.setTimeout(600_000);
  const journal = new Journal('n1-releves.txt');
  const duo = await startDuo(browser, 'n1-nuit', { save: 'aubrune-recette' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune', 22);
  await duo.setMinutes(20 * 60 + 55);
  const before = await duo.until(host, 'monde lu', () => true);
  expect(sleepers(before), 'personne au lit avant 21 h').toEqual([]);

  // 21 h sur la place: les deux regardent le bourg (fenêtres de l'épicerie, réverbères).
  await placeAt(duo, journal, h.index, { x: 202.5, y: 114.5 }, 'place', Math.PI / 2);
  await placeAt(duo, journal, g.index, { x: 205.5, y: 114.5 }, 'place', Math.PI / 2);
  await duo.until(host, '21 h', (w) => w.minutes % 1440 >= 21 * 60, 120_000);
  await duo.until(guest, '21 h chez l’invité', (w) => w.minutes % 1440 >= 21 * 60, 60_000);
  await host.page.waitForTimeout(3000);
  journal.log(`horloge de l'invité: ${await uiText(guest, '.lpl-ui .hud-clock')}`);
  await shot(host, '1-place-21h-hote');
  await shot(guest, '1-place-21h-invite');
  // De près: la façade est de l'épicerie (fenêtres) et le réverbère `reverbere-route-1` (195,5; 111).
  await placeAt(duo, journal, h.index, { x: 199.5, y: 115.5 }, 'devant l’épicerie', Math.PI);
  // Lacet de 225 degrés: le mur est de l'épicerie vu de face (comme `interieurs.spec.ts`).
  await probeCall(host, 'setCamera', 225, 12);
  await host.page.waitForTimeout(3000);
  await shot(host, '1-epicerie-et-reverbere-21h');
  await probeCall(host, 'setCamera', 0, 22);

  // Un habitant rentre se coucher (le bench des briques attend jusqu'à trois minutes).
  const night = await duo.until(host, 'un habitant couché', (w) => sleepers(w).length > 0, 300_000);
  const who = sleepers(night)[0] ?? '';
  const bed = (night as unknown as Lives).places.aubrune?.villagers?.[who]?.body;
  journal.log(`couché(s): ${sleepers(night).join(', ')} à ${String(night.minutes % 1440)} min`);
  await duo.until(guest, 'le coucher vu par l’invité', (w) => sleepers(w).includes(who), 30_000);
  if (bed !== undefined) {
    // Mise en place près du lit, pour la capture (chambre à l'étage d'une maison).
    await placeAt(duo, journal, h.index, { x: bed.x + 1.9, y: bed.y + 0.6 }, 'chambre', Math.PI);
    await host.page.waitForTimeout(3000);
    await shot(host, `2-${who}-au-lit`);
  }
  expect(duo.errors).toEqual([]);
  await duo.close();
});
