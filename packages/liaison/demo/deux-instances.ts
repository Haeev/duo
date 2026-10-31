/**
 * Démonstration: deux instances de Duo (deux processus Node) sur la même machine,
 * sur la boucle locale, aux ports différents. Elles se trouvent, se relient,
 * ouvrent et rejoignent un salon, jouent quelques secondes et se quittent.
 *
 *   pnpm --filter @duo/liaison demo
 *
 * Sortie 0 si les deux instances ont fini proprement.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const here = import.meta.dirname;
const instance = path.join(here, 'instance.ts');
const portA = 39_520;
const portB = 39_530;
const origin = Date.now();

function launch(pseudo: string, role: string, port: number, peer: number, machine: string): Promise<number> {
  const child = spawn(
    process.execPath,
    [
      instance,
      `--pseudo=${pseudo}`,
      `--role=${role}`,
      `--machine=${machine}`,
      `--t0=${String(origin)}`,
      `--duo-port=${String(port)}`,
      `--duo-peer=127.0.0.1:${String(peer)}`,
      '--duo-allow-loopback',
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  return new Promise((resolve) => {
    child.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

process.stdout.write('Deux instances de Duo sur cette machine (ports 39520 et 39530, boucle locale)\n\n');
const codes = await Promise.all([
  launch('Camille', 'hote', portA, portB, 'aaaaaaaa-dddd-4000-8000-000000000001'),
  launch('Sacha', 'invite', portB, portA, 'bbbbbbbb-dddd-4000-8000-000000000002'),
]);
const ok = codes.every((code) => code === 0);
process.stdout.write(ok ? '\nDémonstration réussie.\n' : `\nÉchec (codes de sortie: ${codes.join(', ')}).\n`);
process.exit(ok ? 0 : 1);
