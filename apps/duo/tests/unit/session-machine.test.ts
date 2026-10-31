import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS,
  EMPTY_SESSION,
  fromWire,
  nextDeadline,
  reduceSession,
  toWire,
  type HostSession,
  type SessionInput,
} from '../../src/main/liaison/session-machine';

const tools = { newMatchId: () => 'partie-1', newSeed: () => 42 };
const game = { id: 'essai-pont', version: '1.0.0', saveChoice: 'new' as const, save: null };

function run(inputs: readonly [SessionInput, number][], start: HostSession = EMPTY_SESSION): HostSession {
  return inputs.reduce((state, [input, now]) => reduceSession(state, input, now, tools), start);
}

describe('salon (F03)', () => {
  it('démarre le décompte quand c’est dit des deux côtés; rejoindre vaut « C’est parti »', () => {
    const state = run([
      [{ type: 'open', game }, 0],
      [{ type: 'join' }, 100],
      [{ type: 'ready', seat: 'host', ready: true }, 200],
    ]);
    expect(state.salon?.ready).toEqual({ host: true, guest: true });
    expect(state.salon?.countdownEndsAt).toBe(200 + COUNTDOWN_MS);
    expect(nextDeadline(state)).toBe(200 + COUNTDOWN_MS);
  });

  it('« Pas encore » annule le décompte pour les deux', () => {
    const state = run([
      [{ type: 'open', game }, 0],
      [{ type: 'join' }, 0],
      [{ type: 'ready', seat: 'host', ready: true }, 0],
      [{ type: 'ready', seat: 'guest', ready: false }, 1000],
    ]);
    expect(state.salon?.countdownEndsAt).toBeNull();
  });

  it('un nouveau choix de sauvegarde remet les deux à « Pas encore »', () => {
    const state = run([
      [{ type: 'open', game }, 0],
      [{ type: 'join' }, 0],
      [{ type: 'select-save', saveChoice: 'continue', save: { label: 'Jour 2', writtenAt: 5 } }, 10],
    ]);
    expect(state.salon?.ready).toEqual({ host: false, guest: false });
    expect(state.salon?.game.save?.label).toBe('Jour 2');
  });

  it('le décompte écoulé lance le chargement, une seule fois', () => {
    const state = run([
      [{ type: 'open', game }, 0],
      [{ type: 'join' }, 0],
      [{ type: 'ready', seat: 'host', ready: true }, 0],
      [{ type: 'tick' }, COUNTDOWN_MS - 1],
      [{ type: 'tick' }, COUNTDOWN_MS],
      [{ type: 'tick' }, COUNTDOWN_MS + 10],
    ]);
    expect(state.match).toMatchObject({ matchId: 'partie-1', seed: 42, phase: 'loading' });
    expect(state.salon?.ready).toEqual({ host: false, guest: false });
  });
});

describe('partie (F05, F06)', () => {
  const loaded = run([
    [{ type: 'open', game }, 0],
    [{ type: 'join' }, 0],
    [{ type: 'ready', seat: 'host', ready: true }, 0],
    [{ type: 'tick' }, COUNTDOWN_MS],
    [{ type: 'loaded', seat: 'guest' }, 4000],
    [{ type: 'loaded', seat: 'host' }, 5000],
  ]);

  it('passe en jeu quand les deux jeux sont prêts', () => {
    expect(loaded.match?.phase).toBe('playing');
    expect(loaded.match?.playingSince).toBe(5000);
  });

  it('pause par l’un, reprise quand les deux l’ont demandée, après 3 s', () => {
    const paused = run([[{ type: 'pause', seat: 'guest' }, 6000]], loaded);
    expect(paused.match).toMatchObject({ phase: 'paused', pausedBy: { host: false, guest: true } });
    const both = run([
      [{ type: 'pause', seat: 'host' }, 6100],
      [{ type: 'resume', seat: 'host' }, 7000],
    ], paused);
    expect(both.match).toMatchObject({ phase: 'paused', pausedBy: { host: true, guest: true }, resumeReady: { host: true, guest: false } });
    const resuming = run([[{ type: 'resume', seat: 'guest' }, 8000]], both);
    expect(resuming.match).toMatchObject({ phase: 'resuming', resumeEndsAt: 8000 + COUNTDOWN_MS });
    const playing = run([[{ type: 'tick' }, 8000 + COUNTDOWN_MS]], resuming);
    expect(playing.match).toMatchObject({ phase: 'playing', pausedBy: { host: false, guest: false } });
  });

  it('Échap pendant la reprise revient à la pause', () => {
    const state = run([
      [{ type: 'pause', seat: 'host' }, 6000],
      [{ type: 'resume', seat: 'host' }, 6100],
      [{ type: 'resume', seat: 'guest' }, 6200],
      [{ type: 'pause', seat: 'guest' }, 7000],
    ], loaded);
    expect(state.match?.phase).toBe('paused');
    expect(state.match?.resumeEndsAt).toBeNull();
  });

  it('une coupure met en pause, la reprise attend les deux après le retour', () => {
    const lost = run([[{ type: 'link', up: false }, 6000]], loaded);
    expect(lost.match).toMatchObject({ phase: 'paused', linkLost: true });
    expect(run([[{ type: 'resume', seat: 'host' }, 6500]], lost).match?.resumeReady.host).toBe(false);
    const back = run([[{ type: 'link', up: true }, 9000]], lost);
    expect(back.match).toMatchObject({ phase: 'paused', linkLost: false });
  });

  it('compte le temps joué hors pauses et inscrit la fin', () => {
    const stopped = run([
      [{ type: 'pause', seat: 'host' }, 65_000],
      [{ type: 'stop', seat: 'host', reason: 'stopped' }, 400_000],
    ], loaded);
    expect(stopped.match).toBeNull();
    expect(stopped.lastEnd).toMatchObject({ reason: 'stopped', by: 'host', durationMs: 60_000 });
    expect(stopped.salon?.guestJoined).toBe(true);
  });

  it('un invité qui disparaît termine la partie et libère sa place', () => {
    const gone = run([[{ type: 'guest-gone' }, 7000]], loaded);
    expect(gone.match).toBeNull();
    expect(gone.lastEnd?.reason).toBe('guest-gone');
    expect(gone.salon?.guestJoined).toBe(false);
  });
});

describe('transport des heures', () => {
  it('convertit les heures de l’hôte en durées restantes, puis à l’horloge de l’autre', () => {
    const state = run([
      [{ type: 'open', game }, 0],
      [{ type: 'join' }, 0],
      [{ type: 'ready', seat: 'host', ready: true }, 1_000_000],
    ]);
    const wire = toWire(state, 1_000_500);
    expect(wire.salon?.countdownEndsAt).toBe(2500);
    expect(fromWire(wire, 50).salon?.countdownEndsAt).toBe(2550);
  });

  it('renvoie le même état quand rien ne change', () => {
    const state = run([[{ type: 'open', game }, 0]]);
    expect(reduceSession(state, { type: 'ready', seat: 'guest', ready: true }, 1, tools)).toBe(state);
  });
});
