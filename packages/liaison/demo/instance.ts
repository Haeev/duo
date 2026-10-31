/**
 * Une instance de démonstration de la liaison, sans Electron. Elle se comporte
 * comme le processus principal de Duo: découverte, liaison, salon, partie.
 *
 * Exemples (deux terminaux, ou `node demo/deux-instances.ts`):
 *   node demo/instance.ts --pseudo=Camille --role=hote --duo-port=39520 --duo-peer=127.0.0.1:39530 --duo-allow-loopback
 *   node demo/instance.ts --pseudo=Sacha --role=invite --duo-port=39530 --duo-peer=127.0.0.1:39520 --duo-allow-loopback
 * Sur deux vraies machines du même réseau: `--role=hote` sur l'une, `--role=invite`
 * sur l'autre, sans autre option (diffusion sur le port 39420).
 */
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { createLiaison, parseNetworkCommandLine } from '../src/index.ts';
import type { Liaison } from '../src/index.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const found = args.find((argument) => argument.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};

const pseudo = option('pseudo', os.hostname().slice(0, 16));
const role = option('role', 'hote') === 'invite' ? 'invite' : 'hote';
const durationMs = Number(option('duree', '4000'));
const network = parseNetworkCommandLine(args);
// Origine commune aux deux processus (heure du système), pour comparer les horodatages.
const origin = Number(option('t0', String(Date.now())));

function say(text: string): void {
  const seconds = ((performance.timeOrigin + performance.now() - origin) / 1000).toFixed(3).padStart(7, ' ');
  process.stdout.write(`${seconds} s [${pseudo}] ${text}\n`);
}

const liaison: Liaison = createLiaison({
  identity: {
    machine: option('machine', randomUUID()),
    appVersion: '0.1.0',
    computer: os.hostname(),
  },
  profile: { pseudo, color: role === 'hote' ? 'rond' : 'carre' },
  games: [{ id: 'la-petite-ligne', version: '0.1.0' }],
  ...network,
  ...(network.allowLoopback ? { listenHost: '127.0.0.1' } : {}),
});

let inputsReceived = 0;
let snapshotsReceived = 0;
let lastSnapshot = 0;
let stopTraffic: (() => void) | null = null;
let finished = false;

async function finish(code: number): Promise<void> {
  if (finished) return;
  finished = true;
  stopTraffic?.();
  await liaison.stop();
  say(code === 0 ? 'arrêt propre' : 'arrêt sur erreur');
  process.exit(code);
}

liaison.on('partner', (state) => {
  if (state.kind === 'present') {
    say(`${state.partner.pseudo} est là (liaison ${state.link}, Duo ${state.partner.appVersion})`);
    if (role === 'hote' && liaison.session().lobby === null) {
      liaison.lobby.open({ id: 'la-petite-ligne', version: '0.1.0', save: null });
      say('salon ouvert: La Petite Ligne');
    }
  } else {
    say("l'autre est parti");
    if (role === 'invite') void finish(0);
  }
});

liaison.on('incompatible', (info) => {
  say(`Duo incompatible en face (protocole ${String(info.protocol)}), à mettre à jour: ${info.update}`);
});

let lastPhase = '';
let endedMatch = '';
liaison.on('session', (view) => {
  if (role === 'invite' && view.invitation !== null && view.role === null && !view.joining) {
    say(`invitation reçue (${view.invitation.game.id}): je rejoins`);
    liaison.lobby.join();
  }
  const lobby = view.lobby;
  // Clé de l'état utile au script: on n'agit qu'aux changements.
  const phase =
    lobby === null
      ? 'aucun'
      : `${lobby.phase}:${lobby.match?.phase ?? '-'}:${String(lobby.guestJoined)}:${String(lobby.ready.host)}`;
  if (phase === lastPhase) return;
  lastPhase = phase;
  if (lobby === null) return;
  if (role === 'hote' && lobby.phase === 'open' && lobby.guestJoined && !lobby.ready.host && lobby.lastResult === null) {
    say("l'invitée a rejoint: je suis prête");
    liaison.lobby.setReady(true);
  }
  if (lobby.phase === 'countdown' && view.localTimes.countdownEndsAt !== null) {
    say(`décompte: départ du chargement dans ${String(Math.round(view.localTimes.countdownEndsAt - liaison.now()))} ms`);
  }
  const match = lobby.match;
  if (match?.phase === 'loading') {
    say(`chargement du jeu (graine ${String(match.seed)})`);
    setTimeout(() => {
      liaison.match.reportLoaded();
    }, 200);
  }
  if (match?.phase === 'starting' && view.localTimes.startsAt !== null) {
    const delay = Math.max(0, view.localTimes.startsAt - liaison.now());
    say(`départ commun dans ${String(Math.round(delay))} ms`);
    setTimeout(startPlaying, delay);
  }
  if (lobby.phase === 'open' && lobby.lastResult !== null && lobby.lastResult.match !== endedMatch) {
    endedMatch = lobby.lastResult.match;
    say(`fin de partie: ${JSON.stringify(lobby.lastResult.result)}`);
    if (role === 'hote') setTimeout(() => void finish(0), 300);
  }
});

liaison.on('game', ({ channel, payload }) => {
  if (channel === 1) inputsReceived += 1;
  if (channel === 0 && typeof payload === 'object' && payload !== null && 'tick' in payload) {
    snapshotsReceived += 1;
    lastSnapshot = Number(payload.tick);
  }
});

function startPlaying(): void {
  say(role === 'hote' ? 'partie lancée: instantanés à 30 par seconde' : 'partie lancée: entrées à 60 par seconde');
  let count = 0;
  const timer = setInterval(
    () => {
      count += 1;
      if (role === 'hote') liaison.match.send(0, { tick: count, positions: [[count % 64, 12]] }, 'latest');
      else liaison.match.send(1, { n: count, keys: ['KeyW'] }, 'reliable');
    },
    role === 'hote' ? 33 : 16,
  );
  stopTraffic = () => {
    clearInterval(timer);
  };
  if (role === 'hote') {
    setTimeout(() => {
      stopTraffic?.();
      const quality = liaison.quality();
      say(
        `reçu ${String(inputsReceived)} entrées; aller-retour ${quality?.rttMs?.toFixed(2) ?? '?'} ms, ` +
          `écart d'horloge ${quality?.clockOffsetMs.toFixed(2) ?? '?'} ms`,
      );
      liaison.match.end({ entreesRecues: inputsReceived, train: 'parti à l’heure' });
    }, durationMs);
  } else {
    setTimeout(() => {
      say(`reçu ${String(snapshotsReceived)} instantanés, dernier n° ${String(lastSnapshot)}`);
    }, durationMs);
  }
}

process.on('SIGINT', () => void finish(0));
process.on('SIGTERM', () => void finish(0));

const report = await liaison.start();
say(
  `à l'écoute: TCP ${String(report.tcpPort)}, UDP ${String(report.udpPort)}` +
    (report.problems.length > 0 ? `; problèmes: ${report.problems.join(', ')}` : ''),
);
setTimeout(() => {
  say('délai dépassé');
  void finish(1);
}, 30_000).unref();
