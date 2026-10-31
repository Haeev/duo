import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bridgeCodec } from '../../src/main/game-host/bridge';
import { Watchdog } from '../../src/main/game-host/watchdog';
import { createSanitizer } from '../../src/main/journal';

describe('battement de cœur (ADR 0004, point 6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('déclare figé un jeu silencieux 10 s au chargement', () => {
    const expired = vi.fn();
    const watchdog = new Watchdog(expired);
    watchdog.start();
    vi.advanceTimersByTime(9_000);
    watchdog.heartbeat();
    vi.advanceTimersByTime(9_999);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledWith('hung');
  });

  it('passe à 5 s en partie, et signale une seule fois', () => {
    const expired = vi.fn();
    const watchdog = new Watchdog(expired);
    watchdog.start();
    watchdog.ready();
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(30_000);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith('hung');
  });

  it('échoue le chargement sans ready en 30 s, même avec des battements', () => {
    const expired = vi.fn();
    const watchdog = new Watchdog(expired);
    watchdog.start();
    for (let second = 0; second < 30; second += 1) {
      vi.advanceTimersByTime(1000);
      watchdog.heartbeat();
    }
    expect(expired).toHaveBeenCalledWith('load-timeout');
  });

  it('ne dit plus rien une fois arrêté', () => {
    const expired = vi.fn();
    const watchdog = new Watchdog(expired);
    watchdog.start();
    watchdog.stop();
    vi.advanceTimersByTime(60_000);
    expect(expired).not.toHaveBeenCalled();
  });
});

describe('pont 1.0, côté plateforme (messages de @duo/protocol)', () => {
  it('valide les messages du jeu et jette les autres', () => {
    expect(bridgeCodec.decode({ type: 'hello', bridge: '1.0', sdk: '1.0.0' })).toEqual({
      type: 'hello',
      bridge: '1.0',
      sdk: '1.0.0',
    });
    expect(bridgeCodec.decode({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(bridgeCodec.decode({ type: 'loading', progress: 0.4 })).toEqual({
      type: 'loading',
      progress: 0.4,
    });
    expect(bridgeCodec.decode({ type: 'loading', progress: 2 })).toBeNull();
    expect(
      bridgeCodec.decode({ type: 'net', channel: 16, mode: 'reliable', data: '{}' }),
    ).toBeNull();
    expect(
      bridgeCodec.decode({ type: 'net', channel: 2, mode: 'latest', data: { pas: 'du texte' } }),
    ).toBeNull();
    expect(bridgeCodec.decode({ type: 'ready', champ: 'en trop' })).toBeNull();
    expect(bridgeCodec.decode({ type: 'inconnu' })).toBeNull();
    expect(bridgeCodec.decode('texte')).toBeNull();
  });

  it('accepte une sauvegarde en ArrayBuffer avec son numéro de demande', () => {
    const bytes = new TextEncoder().encode('{"a":1}');
    const decoded = bridgeCodec.decode({
      type: 'saveWrite',
      requestId: 3,
      moment: 'exit',
      label: 'Jour 2',
      dataSchema: 1,
      data: bytes.buffer,
    });
    expect(decoded).toMatchObject({ type: 'saveWrite', requestId: 3, moment: 'exit' });
  });

  it('lit la fin d’une séance voulue par le jeu', () => {
    expect(
      bridgeCodec.decode({
        type: 'sessionEnd',
        stats: [{ label: 'Journées vécues', value: '8' }],
        finished: true,
      }),
    ).toMatchObject({ type: 'sessionEnd', finished: true });
  });

  it('accepte un jeu de même majeure du pont', () => {
    expect(bridgeCodec.accepts('1.0')).toBe(true);
    expect(bridgeCodec.accepts('1.7')).toBe(true);
    expect(bridgeCodec.accepts('2.0')).toBe(false);
    expect(bridgeCodec.accepts('n’importe quoi')).toBe(false);
  });
});

describe('nettoyage du journal (ADR 0015)', () => {
  const sanitize = createSanitizer({
    homeDir: 'C:\\Users\\Hélène Dupont',
    hostName: 'PC-SACHA',
    userName: 'helene',
  });

  it('retire dossier personnel, nom de l’ordinateur, compte, adresses matérielles et IPv6', () => {
    const line = JSON.stringify({
      path: 'C:\\Users\\Hélène Dupont\\AppData\\Roaming\\Duo',
      text: 'PC-SACHA de helene, carte 3c:22:fb:01:02:03, fe80::1c2b:3a4d',
      at: '2026-10-31T21:40:05.123Z',
    });
    const clean = sanitize(line);
    expect(clean).not.toMatch(/Hélène|PC-SACHA|helene|3c:22|fe80/);
    expect(clean).toContain('~\\\\AppData');
    expect(clean).toContain('21:40:05');
  });
});
