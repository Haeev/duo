// Compatibilité des deux jeux et messages refusés (ADR 0006, MA2 de la revue du 2026-11-11).
import { startLocalDuo, type LocalDuo } from '@duo/sdk-dev';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { CHANNEL } from '../src/reseau/canaux';
import {
  COMPAT_TEXTS,
  compareVersions,
  createCompatCheck,
  localHello,
  MESSAGE_SCHEMAS,
  schemaFingerprint,
  type CompatHello,
} from '../src/reseau/compatibilite';
import { createSession, type Session, type SessionAlert } from '../src/session';
import { idleInput } from '../src/simulation/noyau/entrees';
import { gameContent } from './aides';

const content = gameContent();
const HELLO = localHello(manifest.id, manifest.version);

async function pair(): Promise<LocalDuo<GameAction>> {
  const duo = await startLocalDuo<GameAction>({
    manifest,
    conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
    seed: 3,
  });
  await duo.start();
  return duo;
}

async function play(sessions: readonly Session[], steps: number): Promise<void> {
  for (let i = 1; i <= steps; i++) {
    for (const session of sessions) session.step(idleInput(i));
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

function alertsOf(session: Session): SessionAlert[] {
  const seen: SessionAlert[] = [];
  session.onAlert((alert) => seen.push(alert));
  return seen;
}

describe('empreinte des schémas', () => {
  it('est stable, et change avec une valeur admise de plus', () => {
    expect(schemaFingerprint(MESSAGE_SCHEMAS)).toBe(schemaFingerprint(MESSAGE_SCHEMAS));
    const a = v.object({ type: v.picklist(['talk', 'buy']) });
    const b = v.object({ type: v.picklist(['talk', 'buy', 'shop_talk']) });
    expect(schemaFingerprint([a])).not.toBe(schemaFingerprint([b]));
    expect(compareVersions('0.21.0', '0.22.0')).toBeLessThan(0);
    expect(compareVersions('0.10.0', '0.9.3')).toBeGreaterThan(0);
  });
});

describe('vérification à la jonction', () => {
  it('empreintes égales: la partie se joue, aucune alerte', async () => {
    const duo = await pair();
    try {
      const host = createSession({ duo: duo.hostGame, content });
      const guest = createSession({ duo: duo.guestGame, content });
      const alerts = [...alertsOf(host), ...alertsOf(guest)];
      await play([host, guest], 30);
      expect(host.blocked()).toBe(false);
      expect(guest.blocked()).toBe(false);
      expect(guest.ready()).toBe(true);
      expect(alerts).toEqual([]);
      expect(duo.logs.filter((entry) => entry.level !== 'info')).toEqual([]);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });

  it('même numéro, fabrications différentes: message aux deux, partie non démarrée', async () => {
    const duo = await pair();
    try {
      const host = createSession({ duo: duo.hostGame, content });
      const other: CompatHello = { ...HELLO, build: 'autre-fabrication' };
      const guest = createSession({ duo: duo.guestGame, content, hello: other });
      const hostAlerts = alertsOf(host);
      const guestAlerts = alertsOf(guest);
      // Attente bornée de la réponse (un aller-retour), sous la charge de la suite complète.
      for (let i = 0; i < 60 && !(host.blocked() && guest.blocked()); i++)
        await play([host, guest], 1);
      expect(host.blocked()).toBe(true);
      expect(guest.blocked()).toBe(true);
      // L'hôte a pu jouer le temps d'un aller-retour avant la réponse; ensuite, plus rien.
      const frozenTick = host.hostSim()?.world.tick ?? -1;
      await play([host, guest], 20);
      expect(host.hostSim()?.world.tick).toBe(frozenTick);
      expect(guest.ready()).toBe(false);
      expect(await host.saveNow()).toBe('refused');
      expect(guestAlerts).toEqual([
        { kind: 'incompatible', text: COMPAT_TEXTS.different.replaceAll('{nom}', 'Alex') },
      ]);
      expect(hostAlerts.map((alert) => alert.kind)).toEqual(['incompatible']);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });

  it('invité en retard: il est nommé comme la machine à mettre à jour', async () => {
    const duo = await pair();
    try {
      const host = createSession({ duo: duo.hostGame, content });
      const guest = createSession({
        duo: duo.guestGame,
        content,
        hello: { ...HELLO, version: '0.1.0' },
      });
      const hostAlerts = alertsOf(host);
      const guestAlerts = alertsOf(guest);
      for (let i = 0; i < 60 && !(host.blocked() && guest.blocked()); i++)
        await play([host, guest], 1);
      expect(guestAlerts.map((alert) => alert.text)).toEqual([
        COMPAT_TEXTS.selfOlder.replaceAll('{nom}', 'Alex'),
      ]);
      expect(hostAlerts.map((alert) => alert.text)).toEqual([
        COMPAT_TEXTS.peerOlder.replaceAll('{nom}', 'Sacha'),
      ]);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });

  it('hôte d’avant la vérification (aucune carte): l’invité s’arrête et le dit', async () => {
    const duo = await pair();
    try {
      const guest = createSession({ duo: duo.guestGame, content, compatWaitSteps: 5 });
      const alerts = alertsOf(guest);
      await play([guest], 4);
      expect(guest.blocked()).toBe(false);
      await play([guest], 1);
      expect(guest.blocked()).toBe(true);
      expect(alerts.map((alert) => alert.text)).toEqual([
        COMPAT_TEXTS.peerOlder.replaceAll('{nom}', 'Alex'),
      ]);
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});

describe('messages refusés', () => {
  it('sont comptés, journalisés et signalés une seule fois au joueur', async () => {
    const duo = await pair();
    try {
      // Un hôte d'une autre fabrication, même carte: ses tranches ne passent plus le schéma.
      const check = createCompatCheck(duo.hostGame.net, HELLO);
      const common = duo.hostGame.net.channel(CHANNEL.common, {
        mode: 'latest',
        schema: v.unknown(),
      });
      const guest = createSession({ duo: duo.guestGame, content });
      const alerts = alertsOf(guest);
      for (let i = 0; i < 3; i++) {
        common.send({ tick: i, common: { nouveau: true } });
        await play([guest], 3);
      }
      expect(check.verdict().kind).toBe('ok');
      expect(alerts).toEqual([
        { kind: 'rejected', text: COMPAT_TEXTS.rejected.replaceAll('{nom}', 'Alex') },
      ]);
      const warned = duo.logs.filter((entry) => entry.message.includes('refusé par son schéma'));
      expect(warned).toHaveLength(1);
      check.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
