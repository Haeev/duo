// Chef d'orchestre du processus principal: tient l'état publié à la vue
// plateforme, traite ses intentions, suit la liaison et pilote l'hébergement du
// jeu. Les règles du salon vivent dans la liaison (l'hôte fait autorité); ici,
// on projette et on réconcilie.
import type { Rectangle } from 'electron';
import type { IntentArgs, IntentChannel, IntentResult } from '../shared/ipc';
import type {
  AppState,
  EndView,
  GameSummary,
  InvitationView,
  MatchView,
  NoticeView,
  PeerView,
  Profile,
  SalonView,
  SaveSummary,
  Toast,
  ToastKind,
} from '../shared/state';
import type { LocalSaves } from './data/local-saves';
import { publicSettings, type MachineStore, type SettingsFile } from './data/store';
import type { GameEntry } from './games/catalog';
import {
  BRIDGE_VERSION,
  type GameSettings,
  type LoadedSave,
  type PlayerInfo,
  type Role,
} from './game-host/bridge';
import type {
  GameFailure,
  GameHost,
  GameHostEvents,
  SaveWriteRequest,
} from './game-host/game-host';
import type { Journal } from './journal';
import type { LiaisonEvent, Liaison, PeerInfo, SessionsView } from './liaison/liaison';
import {
  EMPTY_SESSION,
  type HostSession,
  type MatchEnd,
  type SalonGame,
} from './liaison/session-machine';
import type { SaveStatus } from '@duo/protocol';
import { PLAYER_APPEARANCES } from '../shared/players';
import type { AppWindow, PlatformLayer } from './window';

const TOAST_MS = 6000;
const HINT_MS = 4000;
const PLATFORM_MAX_SAVE_BYTES = 33_554_432;

export interface PlatformDeps {
  readonly journal: Journal;
  readonly store: MachineStore;
  readonly saves: LocalSaves;
  readonly liaison: Liaison;
  readonly machineId: string;
  readonly appVersion: string;
  readonly platform: AppState['platform'];
  readonly profile: Profile | null;
  readonly settings: SettingsFile;
  readonly games: readonly GameEntry[];
  /** Quitter Duo après confirmation (M-15). */
  readonly requestQuit: () => void;
}

interface RunningMatch {
  readonly matchId: string;
  readonly role: Role;
  readonly game: GameEntry;
  readonly loadingSince: number;
  selfLoading: number;
  started: boolean;
  paused: boolean;
  hintUntil: number | null;
  peerBack: boolean;
  savedDuringStop: boolean;
}

type Active = { readonly role: Role; readonly session: HostSession } | null;

export class Platform {
  private profile: Profile | null;
  private settings: SettingsFile;
  private games = new Map<string, GameEntry>();
  private saveSummaries = new Map<string, SaveSummary>();
  private peer: PeerInfo | null = null;
  private lastPeerProfile: Profile | null = null;
  private sessions: SessionsView = { own: EMPTY_SESSION, peer: null };
  private linkUp = true;
  private linkLostSince: number | null = null;
  private running: RunningMatch | null = null;
  /** Partie en cours d'arrêt: sa sauvegarde de sortie est encore acceptée (ADR 0004, 2 s). */
  private stopping: RunningMatch | null = null;
  private readonly handledMatches = new Set<string>();
  private readonly handledEnds = new Set<string>();
  private pendingStop: { matchId: string; reason: 'crash' | 'load-failed' } | null = null;
  private end: EndView | null = null;
  private notice: NoticeView | null = null;
  private toasts: Toast[] = [];
  private toastId = 0;
  private quitConfirm = false;
  private closeConfirmed = false;
  private quitting = false;
  private lastLayer: PlatformLayer['kind'] | null = null;
  private liaisonStarted = false;
  private window: AppWindow | null = null;
  private gameHost: GameHost | null = null;
  private publishQueued = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: PlatformDeps) {
    this.profile = deps.profile;
    this.settings = deps.settings;
    for (const game of deps.games) this.games.set(game.manifest.id, game);
    deps.liaison.subscribe((event) => {
      this.onLiaison(event);
    });
  }

  /** Événements du jeu, branchés sur l'hébergement par `index.ts`. */
  readonly gameEvents: GameHostEvents = {
    loading: (progress) => {
      if (this.running === null) return;
      this.running.selfLoading = progress;
      this.publish();
    },
    ready: () => {
      if (this.running === null) return;
      this.running.selfLoading = 1;
      this.deps.journal.write('info', 'platform', 'game-ready', {
        game: this.running.game.manifest.id,
      });
      this.deps.liaison.reportLoaded();
      this.publish();
    },
    failure: (failure) => {
      this.onGameFailure(failure);
    },
    escape: () => {
      if (this.running?.started === true && !this.running.paused) this.deps.liaison.requestPause();
    },
    toggleFullscreen: () => {
      this.window?.toggleFullscreen();
    },
    net: (channel, mode, data) => {
      this.deps.liaison.sendGame({ channel, mode, data });
    },
    saveWrite: (request) => this.onSaveWrite(request),
    matchEnd: (message) => {
      const running = this.running;
      if (running?.role !== 'host') return;
      const outcome = message.outcome;
      this.deps.liaison.stopMatch('end', {
        outcome:
          outcome.kind === 'win'
            ? outcome.winner === this.deps.machineId
              ? 'win-host'
              : 'win-guest'
            : outcome.kind,
        stats: message.stats,
      });
    },
    sessionEnd: (message) => {
      this.deps.journal.write('info', 'platform', 'session-end', { finished: message.finished });
      // Le jeu termine la séance de lui-même (fin de la démo): fin pour les deux machines.
      if (message.finished && this.running?.role === 'host') {
        this.deps.liaison.stopMatch('end', { outcome: null, stats: message.stats });
      }
    },
  };

  attachWindow(window: AppWindow): void {
    this.window = window;
    this.applyLayer();
  }

  detachWindow(): void {
    this.window = null;
  }

  attachGameHost(host: GameHost): void {
    this.gameHost = host;
  }

  get liaisonReady(): boolean {
    return this.settings.networkAccepted && this.profile !== null;
  }

  /** Démarre la liaison si l'accord réseau est donné (CA-PF-079) et le profil créé. */
  async startLiaisonIfAllowed(): Promise<void> {
    if (this.liaisonStarted || !this.liaisonReady || this.profile === null) return;
    this.liaisonStarted = true;
    await this.deps.liaison.start({
      machineId: this.deps.machineId,
      appVersion: this.deps.appVersion,
      profile: this.profile,
    });
    this.deps.journal.write('info', 'platform', 'liaison-started');
  }

  /** Vrai si la fermeture de la fenêtre doit d'abord être confirmée (M-15). */
  interceptClose(): boolean {
    if (this.closeConfirmed || this.quitting || this.running === null) return false;
    this.quitConfirm = true;
    if (this.running.started && !this.running.paused) this.deps.liaison.requestPause();
    this.publish();
    return true;
  }

  /** Arrêt propre: sauvegarde de sortie chez l'hôte, avis à l'autre machine. */
  async shutdown(): Promise<void> {
    if (this.quitting) return;
    this.quitting = true;
    const running = this.running;
    if (running !== null && this.gameHost !== null) {
      await this.gameHost.stop('quit', running.role === 'host');
    }
    await this.deps.liaison.stop();
    await this.deps.journal.flush();
  }

  get isQuitting(): boolean {
    return this.quitting;
  }

  snapshot(): AppState {
    return {
      appVersion: this.deps.appVersion,
      platform: this.deps.platform,
      profile: this.profile,
      setup: { networkAccepted: this.settings.networkAccepted, done: this.settings.setupDone },
      settings: publicSettings(this.settings),
      peer: this.peerView(),
      games: [...this.games.values()]
        .filter((game) => game.compatible)
        .map((game) => this.summary(game)),
      salon: this.salonView(),
      invitation: this.invitationView(),
      match: this.matchView(),
      end: this.end,
      notice: this.notice,
      toasts: this.toasts,
      quitConfirm: this.quitConfirm,
    };
  }

  async handleIntent<C extends IntentChannel>(
    channel: C,
    arg: IntentArgs[C],
  ): Promise<IntentResult> {
    const result = await this.dispatch(channel, arg);
    this.publish();
    return result;
  }

  private async dispatch<C extends IntentChannel>(
    channel: C,
    rawArg: IntentArgs[C],
  ): Promise<IntentResult> {
    const { liaison } = this.deps;
    // Le type de l'argument suit le canal; le `switch` le précise pour chaque cas.
    const arg = rawArg;
    switch (channel) {
      case 'profile:save': {
        const profile = arg as IntentArgs['profile:save'];
        await this.deps.store.saveProfile(profile);
        this.profile = profile;
        liaison.setProfile(profile);
        return { ok: true };
      }
      case 'setup:network-accept':
        await this.updateSettings({ networkAccepted: true });
        await this.startLiaisonIfAllowed();
        return { ok: true };
      case 'setup:complete':
        await this.updateSettings({ setupDone: true });
        return { ok: true };
      case 'settings:update': {
        const update = arg as IntentArgs['settings:update'];
        await this.updateSettings({
          ...(update.reducedMotion === undefined ? {} : { reducedMotion: update.reducedMotion }),
          ...(update.uiScale === undefined ? {} : { uiScale: update.uiScale }),
        });
        return { ok: true };
      }
      case 'salon:open':
        return this.openSalon((arg as IntentArgs['salon:open']).gameId);
      case 'salon:close':
        liaison.closeSalon();
        return { ok: true };
      case 'salon:save-choice': {
        const gameId = this.sessions.own.salon?.game.id;
        const save = gameId === undefined ? null : (this.saveSummaries.get(gameId) ?? null);
        const choice = (arg as IntentArgs['salon:save-choice']).choice;
        liaison.selectSave(save === null ? 'new' : choice, save);
        return { ok: true };
      }
      case 'salon:join':
        liaison.joinSalon();
        return { ok: true };
      case 'salon:leave':
        liaison.leaveSalon();
        return { ok: true };
      case 'salon:ready':
        liaison.setReady((arg as IntentArgs['salon:ready']).ready);
        return { ok: true };
      case 'match:pause':
        liaison.requestPause();
        return { ok: true };
      case 'match:resume':
        liaison.requestResume();
        return { ok: true };
      case 'match:stop':
        liaison.stopMatch('stopped');
        return { ok: true };
      case 'end:dismiss':
        this.end = null;
        return { ok: true };
      case 'notice:dismiss':
        this.notice = null;
        return { ok: true };
      case 'app:quit-confirm':
        this.quitConfirm = false;
        this.closeConfirmed = true;
        this.deps.requestQuit();
        return { ok: true };
      case 'app:quit-cancel':
        this.quitConfirm = false;
        return { ok: true };
      case 'window:toggle-fullscreen':
        this.window?.toggleFullscreen();
        return { ok: true };
    }
  }

  onFullscreenChange(fullscreen: boolean): void {
    if (this.settings.fullscreen !== fullscreen) void this.updateSettings({ fullscreen });
  }

  onResize(bounds: Rectangle): void {
    this.gameHost?.setBounds(bounds);
  }

  publish(): void {
    if (this.publishQueued) return;
    this.publishQueued = true;
    queueMicrotask(() => {
      this.publishQueued = false;
      try {
        this.window?.publish(this.snapshot());
        this.applyLayer();
      } catch (error) {
        this.deps.journal.write('error', 'platform', 'publish-failed', {
          message: error instanceof Error ? (error.stack ?? error.message) : String(error),
        });
      }
    });
  }

  async refreshSaveSummaries(): Promise<void> {
    for (const game of this.games.values()) {
      if (game.manifest.saves === null) continue;
      const summary = await this.deps.saves.summary(game.manifest.id);
      if (summary === null) this.saveSummaries.delete(game.manifest.id);
      else this.saveSummaries.set(game.manifest.id, summary);
    }
  }

  // Projections ---------------------------------------------------------------

  private summary(game: GameEntry): GameSummary {
    const { manifest } = game;
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      mode: manifest.mode,
      play: manifest.play,
      durationMinutes: manifest.durationMinutes,
      description: manifest.description,
      thumbnailUrl: `duo-game://${manifest.id}/${manifest.thumbnail}`,
      actions: manifest.actions.map((action) => ({
        id: action.id,
        label: action.label,
        keys: action.keys,
        mouse: action.mouse ?? [],
      })),
      saves:
        manifest.saves === null
          ? null
          : { help: manifest.saves.help ?? null, onExit: manifest.saves.moments.includes('exit') },
      lastSave: this.saveSummaries.get(manifest.id) ?? null,
    };
  }

  private peerView(): PeerView {
    if (this.peer !== null) return { status: 'present', profile: this.peer.profile };
    if (this.lastPeerProfile !== null) return { status: 'absent', profile: this.lastPeerProfile };
    return { status: 'unknown' };
  }

  private active(): Active {
    const { own, peer } = this.sessions;
    if (own.salon !== null || own.match !== null) return { role: 'host', session: own };
    if (peer?.salon?.guestJoined === true) return { role: 'guest', session: peer };
    return null;
  }

  private salonView(): SalonView | null {
    const active = this.active();
    const salon = active?.session.salon ?? null;
    if (active === null || salon === null) return null;
    const game = this.games.get(salon.game.id);
    if (game === undefined) return null;
    const self = active.role;
    const other: Role = self === 'host' ? 'guest' : 'host';
    const joined = self === 'guest' || salon.guestJoined;
    return {
      role: self,
      game: this.summary(game),
      saveChoice: salon.game.saveChoice,
      save: salon.game.save,
      selfReady: salon.ready[self],
      peerReady: salon.ready[other],
      peerSeat: !joined ? 'waiting' : this.linkUp && this.peer !== null ? 'joined' : 'lost',
      countdownEndsAt: salon.countdownEndsAt,
    };
  }

  private invitationView(): InvitationView | null {
    const salon = this.sessions.peer?.salon ?? null;
    if (salon === null || salon.guestJoined || this.peer === null) return null;
    const game = this.games.get(salon.game.id);
    if (game === undefined) return null;
    return { from: this.peer.profile, game: this.summary(game), save: salon.game.save };
  }

  private matchView(): MatchView | null {
    const running = this.running;
    const active = this.active();
    const match = active?.session.match ?? null;
    if (running === null || active === null || match?.matchId !== running.matchId) return null;
    const self = active.role;
    const other: Role = self === 'host' ? 'guest' : 'host';
    return {
      role: self,
      game: this.summary(running.game),
      phase: !this.linkUp ? 'link-lost' : match.phase,
      selfLoading: running.selfLoading,
      peerLoading: match.loaded[other] ? 1 : null,
      loadingSince: running.loadingSince,
      pausedBy: { self: match.pausedBy[self], peer: match.pausedBy[other] },
      resumeReady: { self: match.resumeReady[self], peer: match.resumeReady[other] },
      resumeEndsAt: match.resumeEndsAt,
      linkLostSince: this.linkLostSince,
      peerBack: running.peerBack,
      hintUntil: running.hintUntil,
    };
  }

  // Liaison ------------------------------------------------------------------

  private onLiaison(event: LiaisonEvent): void {
    switch (event.type) {
      case 'peer':
        this.peer = event.peer;
        if (event.peer !== null) this.lastPeerProfile = event.peer.profile;
        break;
      case 'link':
        this.linkUp = event.up;
        this.linkLostSince = event.up ? null : Date.now();
        if (event.up) {
          if (this.running !== null) this.running.peerBack = true;
          else if (this.salonView() !== null) this.toast('back');
          if (this.pendingStop !== null) this.deps.liaison.stopMatch(this.pendingStop.reason);
        }
        this.reconcileMatch();
        break;
      case 'sessions':
        this.deps.journal.write('debug', 'platform', 'sessions', {
          own: `${event.sessions.own.rev}:${event.sessions.own.match?.phase ?? (event.sessions.own.salon === null ? 'aucun' : 'salon')}`,
          peer:
            event.sessions.peer === null
              ? 'aucun'
              : `${event.sessions.peer.rev}:${event.sessions.peer.match?.phase ?? (event.sessions.peer.salon === null ? 'aucun' : 'salon')}`,
        });
        this.announceSalonChanges(this.sessions, event.sessions);
        this.sessions = event.sessions;
        this.reconcileMatch();
        break;
      case 'game':
        if (this.running !== null) {
          this.gameHost?.send({
            type: 'net',
            channel: event.message.channel,
            data: event.message.data,
          });
        }
        break;
    }
    this.publish();
  }

  private peerName(): string {
    return this.peer?.profile.pseudo ?? this.lastPeerProfile?.pseudo ?? '';
  }

  private announceSalonChanges(before: SessionsView, after: SessionsView): void {
    const ownBefore = before.own.salon;
    const ownAfter = after.own.salon;
    if (
      ownBefore !== null &&
      ownAfter !== null &&
      after.own.match === null &&
      before.own.match === null
    ) {
      if (!ownBefore.guestJoined && ownAfter.guestJoined) this.toast('joined');
      if (
        ownBefore.guestJoined &&
        !ownAfter.guestJoined &&
        after.own.lastEnd === before.own.lastEnd
      ) {
        this.toast('left-salon');
      }
      if (
        ownBefore.countdownEndsAt !== null &&
        ownAfter.countdownEndsAt === null &&
        ownBefore.ready.guest &&
        !ownAfter.ready.guest &&
        ownAfter.guestJoined
      ) {
        this.toast('asked-wait');
      }
    }
    const peerBefore = before.peer?.salon ?? null;
    const peerAfter = after.peer?.salon ?? null;
    const peerMatchActive = before.peer?.match !== null && before.peer?.match !== undefined;
    if (peerBefore !== null && peerAfter === null && !peerMatchActive && this.peer !== null) {
      this.toast('closed-salon');
    }
    if (peerBefore !== null && peerAfter?.guestJoined === true) {
      if (peerBefore.game.saveChoice !== peerAfter.game.saveChoice) {
        this.toast('other-save');
      }
      if (
        peerBefore.countdownEndsAt !== null &&
        peerAfter.countdownEndsAt === null &&
        peerBefore.ready.host &&
        !peerAfter.ready.host &&
        after.peer?.match === null
      ) {
        this.toast('asked-wait');
      }
    }
  }

  /** Aligne la vue jeu sur la partie décidée par l'hôte. */
  private reconcileMatch(): void {
    const active = this.active();
    const match = active?.session.match ?? null;
    const running = this.running;

    if (running !== null && match?.matchId !== running.matchId) {
      const lastEnd = active?.session.lastEnd ?? null;
      this.finishRunning(running, lastEnd?.matchId === running.matchId ? lastEnd : null);
    }

    if (
      active !== null &&
      match !== null &&
      this.running === null &&
      match.phase === 'loading' &&
      !this.handledMatches.has(match.matchId)
    ) {
      this.launch(active.role, match.matchId, match.seed, match.game);
    }

    const current = this.running;
    if (current === null || match?.matchId !== current.matchId || this.gameHost === null) return;
    if (match.phase !== 'loading' && !current.started) {
      current.started = true;
      current.hintUntil = Date.now() + HINT_MS;
      // Heure de session: Date.now() de cette machine (écart d'horloge 0 dans `init`).
      // La liaison de dev-reseau fournira l'heure commune et l'écart réel (ADR 0007, point 4).
      this.gameHost.send({ type: 'start', atSessionMs: Date.now() });
      this.deps.journal.write('info', 'platform', 'match-start', {
        game: current.game.manifest.id,
      });
      this.armHintTimer();
      this.armAutosave(current);
    }
    if (current.started) {
      const shouldPause = match.phase !== 'playing' || !this.linkUp;
      if (shouldPause !== current.paused) {
        current.paused = shouldPause;
        if (shouldPause) {
          const by = match.pausedBy.host ? 'host' : match.pausedBy.guest ? 'guest' : null;
          this.gameHost.send({
            type: 'pause',
            reason: this.linkUp ? 'request' : 'disconnect',
            by: by === null || !this.linkUp ? null : this.playerId(by, current.role),
          });
          // Sauvegarde automatique à chaque pause, si le jeu la déclare (ADR 0005, saveRequest).
          if (current.role === 'host' && this.declares(current.game, 'auto')) {
            this.gameHost.send({ type: 'saveRequest', moment: 'auto' });
          }
        } else {
          this.gameHost.send({ type: 'resume' });
          current.peerBack = false;
        }
        this.deps.journal.write('info', 'platform', shouldPause ? 'match-paused' : 'match-resumed');
      }
    }
  }

  /** Identifiant de membre du joueur assis à `seat` (prototype: l'identifiant de sa machine). */
  private playerId(seat: Role, selfRole: Role): string {
    return seat === selfRole ? this.deps.machineId : (this.peer?.machineId ?? 'autre-ordinateur');
  }

  private declares(game: GameEntry, moment: 'auto' | 'exit' | 'level-end' | 'manual'): boolean {
    return game.manifest.saves?.moments.includes(moment) === true;
  }

  /** Sauvegarde automatique à la période du manifeste, chez l'hôte, pendant le jeu. */
  private armAutosave(running: RunningMatch): void {
    if (this.autosaveTimer !== null) clearInterval(this.autosaveTimer);
    this.autosaveTimer = null;
    const seconds = running.game.manifest.saves?.autosaveSeconds;
    if (running.role !== 'host' || seconds === undefined || !this.declares(running.game, 'auto'))
      return;
    this.autosaveTimer = setInterval(() => {
      if (this.running === running && !running.paused) {
        this.gameHost?.send({ type: 'saveRequest', moment: 'auto' });
      }
    }, seconds * 1000);
  }

  private launch(role: Role, matchId: string, seed: number, salonGame: SalonGame): void {
    const game = this.games.get(salonGame.id);
    const window = this.window;
    const profile = this.profile;
    if (game === undefined || window === null || this.gameHost === null || profile === null) {
      this.deps.liaison.stopMatch('load-failed');
      return;
    }
    this.handledMatches.add(matchId);
    this.end = null;
    this.notice = null;
    this.running = {
      matchId,
      role,
      game,
      loadingSince: Date.now(),
      selfLoading: 0,
      started: false,
      paused: false,
      hintUntil: null,
      peerBack: false,
      savedDuringStop: false,
    };
    const peerProfile: Profile = this.peer?.profile ??
      this.lastPeerProfile ?? { pseudo: '?', color: 'crescent' };
    const other: Role = role === 'host' ? 'guest' : 'host';
    const self: PlayerInfo = {
      id: this.playerId(role, role),
      role,
      name: profile.pseudo,
      color: profile.color,
      colorHex: PLAYER_APPEARANCES[profile.color].color,
      local: true,
    };
    const peer: PlayerInfo = {
      id: this.playerId(other, role),
      role: other,
      name: peerProfile.pseudo,
      color: peerProfile.color,
      colorHex: PLAYER_APPEARANCES[peerProfile.color].color,
      local: false,
    };
    const saveSlot = game.manifest.saves === null ? null : 1;
    void this.loadSave(role, game, salonGame).then((save) => {
      if (this.running?.matchId !== matchId || this.gameHost === null) return;
      this.gameHost.launch(
        game.manifest.id,
        `duo-game://${game.manifest.id}/${game.manifest.entry}`,
        {
          type: 'init',
          bridge: BRIDGE_VERSION,
          matchId,
          role,
          localPlayerId: self.id,
          players: role === 'host' ? [self, peer] : [peer, self],
          seed,
          game: { id: game.manifest.id, version: game.manifest.version },
          settings: this.gameSettings(),
          saveSlot: role === 'host' ? saveSlot : null,
          save,
          clockOffsetMs: 0,
        },
        window.contentBounds(),
      );
    });
  }

  private async loadSave(
    role: Role,
    game: GameEntry,
    salonGame: SalonGame,
  ): Promise<LoadedSave | null> {
    if (role !== 'host' || game.manifest.saves === null || salonGame.saveChoice !== 'continue')
      return null;
    const stored = await this.deps.saves.read(game.manifest.id);
    if (stored === null || stored.dataSchema < 1) return null;
    const data = new ArrayBuffer(stored.data.byteLength);
    new Uint8Array(data).set(stored.data);
    return {
      slot: 1,
      label: stored.summary.label.slice(0, 40),
      ...(stored.progress === null ? {} : { progress: stored.progress }),
      dataSchema: stored.dataSchema,
      gameVersion: stored.gameVersion,
      data,
    };
  }

  /** Réglages de cette machine remis au jeu (pas encore d'écran de réglages: valeurs par défaut). */
  private gameSettings(): GameSettings {
    return {
      volumes: { master: 1, music: 1, effects: 1, interface: 1 },
      uiScale: this.settings.uiScale,
      reducedMotion: this.settings.reducedMotion ?? false,
      bindings: {},
    };
  }

  /** Écran de fin vu de cette machine: « Tu as gagné ! » ou « Sacha a gagné » (UX 4.3). */
  private endView(running: RunningMatch, end: MatchEnd): EndView {
    const outcome = end.summary?.outcome ?? null;
    let view: EndView['outcome'] = null;
    let winner: string | null = null;
    switch (outcome) {
      case 'win-host':
      case 'win-guest': {
        const winnerSeat: Role = outcome === 'win-host' ? 'host' : 'guest';
        view = winnerSeat === running.role ? 'won' : 'lost';
        winner = view === 'lost' ? this.peerName() : null;
        break;
      }
      case 'draw':
      case 'success':
      case 'failure':
        view = outcome;
        break;
      case null:
        break;
    }
    return {
      game: this.summary(running.game),
      kind: running.game.manifest.play === 'session' ? 'session' : 'match',
      durationMs: end.durationMs,
      saved: false,
      outcome: view,
      winner,
      stats: end.summary?.stats ?? [],
    };
  }

  private finishRunning(running: RunningMatch, end: MatchEnd | null): void {
    this.running = null;
    this.pendingStop = null;
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    const host = this.gameHost;
    const gameName = running.game.manifest.name;
    const isSession = running.game.manifest.play === 'session';
    const selfSeat = running.role;

    if (end !== null && !this.handledEnds.has(end.matchId)) {
      this.handledEnds.add(end.matchId);
      const byPeer = end.by !== null && end.by !== selfSeat;
      switch (end.reason) {
        case 'stopped':
          if (byPeer) this.toast('stopped-match');
          // Une séance se termine normalement par « Retour au salon »; une partie arrêtée n'a pas d'écran de fin (UX 4.1).
          if (isSession) this.end = this.endView(running, end);
          break;
        case 'end':
          this.end = this.endView(running, end);
          break;
        case 'crash':
          this.notice = {
            kind: 'game-crashed',
            gameName,
            where: byPeer ? 'peer' : 'self',
            hadSave: this.saveSummaries.has(running.game.manifest.id),
          };
          break;
        case 'load-failed':
          this.notice = { kind: 'load-failed', gameName, where: byPeer ? 'peer' : 'self' };
          break;
        case 'guest-gone':
          this.toast('quit-duo');
          break;
      }
    } else if (end === null) {
      // L'hôte a quitté Duo ou s'est relancé: la partie n'existe plus.
      this.toast('quit-duo');
    }

    this.deps.journal.write('info', 'platform', 'match-finished', {
      game: running.game.manifest.id,
      reason: end?.reason ?? 'vanished',
    });
    if (host === null) return;
    const saveOnStop =
      running.role === 'host' && running.game.manifest.saves !== null && end?.reason !== 'crash';
    const reason =
      end?.reason === 'crash' ? 'peer-crash' : end?.reason === 'end' ? 'end' : 'stopped';
    this.stopping = running;
    void host.stop(reason, saveOnStop).then(() => {
      if (this.stopping === running) this.stopping = null;
      if (this.end !== null && running.savedDuringStop) this.end = { ...this.end, saved: true };
      void this.refreshSaveSummaries().then(() => {
        // Retour au salon après une séance: l'hôte propose de continuer la sauvegarde écrite.
        const salon = this.sessions.own.salon;
        const save = salon === null ? undefined : this.saveSummaries.get(salon.game.id);
        if (running.role === 'host' && salon !== null && save !== undefined) {
          this.deps.liaison.selectSave('continue', save);
        }
        this.publish();
      });
    });
  }

  private onGameFailure(failure: GameFailure): void {
    const running = this.running;
    if (running === null) return;
    const reason = running.started ? 'crash' : 'load-failed';
    this.handledEnds.add(running.matchId);
    this.pendingStop = { matchId: running.matchId, reason };
    this.notice =
      reason === 'crash'
        ? {
            kind: 'game-crashed',
            gameName: running.game.manifest.name,
            where: 'self',
            hadSave: this.saveSummaries.has(running.game.manifest.id),
          }
        : { kind: 'load-failed', gameName: running.game.manifest.name, where: 'self' };
    this.deps.journal.write('error', 'platform', 'game-stopped-by-failure', {
      reason: failure.reason,
    });
    this.running = null;
    this.gameHost?.destroy();
    this.deps.liaison.stopMatch(reason);
    this.publish();
  }

  private async onSaveWrite(request: SaveWriteRequest): Promise<SaveStatus> {
    const running = this.running ?? this.stopping;
    const saves = running?.game.manifest.saves ?? null;
    if (running?.role !== 'host') return 'refused';
    if (!saves?.moments.includes(request.moment)) return 'moment-not-declared';
    if (request.data.byteLength > Math.min(saves.maxBytes, PLATFORM_MAX_SAVE_BYTES))
      return 'too-large';
    const game = running.game;
    try {
      await this.deps.saves.write(game.manifest.id, {
        label: request.label,
        progress: request.progress,
        dataSchema: request.dataSchema,
        gameVersion: game.manifest.version,
        data: request.data,
      });
      running.savedDuringStop = true;
      this.saveSummaries.set(game.manifest.id, { label: request.label, writtenAt: Date.now() });
      this.deps.journal.write('info', 'platform', 'save-written', {
        game: game.manifest.id,
        bytes: request.data.byteLength,
        moment: request.moment,
      });
      return 'ok';
    } catch (error) {
      this.deps.journal.write('error', 'platform', 'save-failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return 'write-error';
    }
  }

  private openSalon(gameId: string): IntentResult {
    const game = this.games.get(gameId);
    if (!game?.compatible) return { ok: false, error: 'jeu indisponible' };
    const save = game.manifest.saves === null ? null : (this.saveSummaries.get(gameId) ?? null);
    this.end = null;
    this.deps.liaison.openSalon({
      id: gameId,
      version: game.manifest.version,
      saveChoice: save === null ? 'new' : 'continue',
      save,
    });
    this.deps.journal.write('info', 'platform', 'salon-opened', { game: gameId });
    return { ok: true };
  }

  private async updateSettings(update: Partial<SettingsFile>): Promise<void> {
    this.settings = { ...this.settings, ...update };
    await this.deps.store.saveSettings(this.settings);
  }

  private toast(kind: ToastKind): void {
    const name = this.peerName();
    if (name === '') return;
    this.toastId += 1;
    const id = this.toastId;
    const toast: Toast = { id, kind, name };
    this.toasts = [...this.toasts, toast].slice(-3);
    setTimeout(() => {
      this.toasts = this.toasts.filter((item) => item.id !== id);
      this.publish();
    }, TOAST_MS);
  }

  private armHintTimer(): void {
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      if (this.running !== null) this.running.hintUntil = null;
      this.publish();
    }, HINT_MS + 50);
  }

  /** Vue plateforme: pleine, bandeau d'indication ou masquée, selon la partie. */
  private applyLayer(): void {
    const window = this.window;
    if (!window?.alive) return;
    const running = this.running;
    let layer: PlatformLayer;
    if (running === null || this.end !== null || this.notice !== null || this.quitConfirm) {
      layer = { kind: 'full', focus: true };
    } else if (!running.started || running.paused) {
      layer = { kind: 'full', focus: true };
    } else if (running.hintUntil !== null && Date.now() < running.hintUntil) {
      layer = { kind: 'hint' };
    } else {
      layer = { kind: 'hidden' };
    }
    window.setLayer(layer);
    if (layer.kind !== this.lastLayer) {
      this.deps.journal.write('debug', 'platform', 'layer', { layer: layer.kind });
    }
    if (layer.kind !== 'full' && this.lastLayer === 'full') this.gameHost?.focus();
    this.lastLayer = layer.kind;
  }
}
