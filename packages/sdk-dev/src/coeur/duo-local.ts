// Deux instances du SDK reliées en mémoire, sans navigateur: pour tester un jeu à deux dans Vitest.
import { connect, type DuoContext } from '@duo/sdk';
import { parseManifest, type GameSettings, type PlayerColorId } from '@duo/protocol';
import { createLocalLinkPair, type LinkConditions } from './lien';
import { createFakePlatform, type FakePlatform, type PlatformLogEntry } from './plateforme';
import { createMemoryStore } from './stockage';

export interface LocalDuoOptions {
  /** Contenu de `duo-game.json`. */
  readonly manifest: unknown;
  readonly conditions?: Partial<LinkConditions>;
  readonly seed?: number;
  readonly settings?: GameSettings;
  readonly store?: ReturnType<typeof createMemoryStore>;
  readonly host?: { readonly name: string; readonly color: PlayerColorId };
  readonly guest?: { readonly name: string; readonly color: PlayerColorId };
}

export interface LocalDuo<TAction extends string = string> {
  readonly hostGame: DuoContext<TAction>;
  readonly guestGame: DuoContext<TAction>;
  readonly host: FakePlatform;
  readonly guest: FakePlatform;
  readonly store: ReturnType<typeof createMemoryStore>;
  readonly conditions: LinkConditions;
  readonly logs: PlatformLogEntry[];
  /** Les deux jeux se déclarent prêts et attendent le départ. */
  start(): Promise<void>;
  dispose(): void;
}

export async function startLocalDuo<TAction extends string = string>(
  options: LocalDuoOptions,
): Promise<LocalDuo<TAction>> {
  const parsed = parseManifest(options.manifest);
  if (!parsed.ok) throw new Error(`manifeste invalide: ${parsed.issues.join('; ')}`);
  const manifest = parsed.manifest;
  const pair = createLocalLinkPair(options.conditions);
  const store = options.store ?? createMemoryStore();
  const logs: PlatformLogEntry[] = [];
  const onLog = (entry: PlatformLogEntry): void => {
    logs.push(entry);
  };
  const host = createFakePlatform({
    role: 'host',
    manifest,
    profile: {
      id: 'membre-hote',
      name: options.host?.name ?? 'Alex',
      color: options.host?.color ?? 'orb',
    },
    link: pair.host,
    store,
    onLog,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.settings === undefined ? {} : { settings: options.settings }),
  });
  const guest = createFakePlatform({
    role: 'guest',
    manifest,
    profile: {
      id: 'membre-invite',
      name: options.guest?.name ?? 'Sacha',
      color: options.guest?.color ?? 'crescent',
    },
    link: pair.guest,
    onLog,
    ...(options.settings === undefined ? {} : { settings: options.settings }),
  });
  const a = new MessageChannel();
  const b = new MessageChannel();
  host.attachGame(a.port1);
  guest.attachGame(b.port1);
  const [hostGame, guestGame] = await Promise.all([
    connect<TAction>({ manifest: options.manifest, port: a.port2 }),
    connect<TAction>({ manifest: options.manifest, port: b.port2 }),
  ]);
  return {
    hostGame,
    guestGame,
    host,
    guest,
    store,
    conditions: pair.conditions,
    logs,
    async start() {
      await Promise.all([hostGame.ready(), guestGame.ready()]);
    },
    dispose() {
      hostGame.dispose();
      guestGame.dispose();
      host.dispose();
      guest.dispose();
      pair.host.close();
    },
  };
}
