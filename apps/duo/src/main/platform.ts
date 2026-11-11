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
  GameToastKind,
  HistoryItemView,
  InvitationView,
  MatchView,
  NoticeView,
  PeerView,
  Profile,
  ReleaseNote,
  SalonNews,
  SalonView,
  SaveSummary,
  Toast,
  ToastKind,
} from '../shared/state';
import type { HistoryEntry, LocalHistory } from './data/local-history';
import type { LocalSaves } from './data/local-saves';
import { publicSettings, type MachineStore, type SettingsFile } from './data/store';
import type { GameEntry } from './games/catalog';
import type { InstallOutcome } from './games/installer';
import { readReleaseNotes } from './games/release-notes';
import type { UpdatesSnapshot } from './games/updater';
import { launchGate } from '../shared/updates';
import { compareVersions } from '@duo/paquet';

type InstallSuccess = Extract<InstallOutcome, { ok: true }>;
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
  type EndSummary,
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
/** Parties ou séances montrées dans le salon (« Dernières séances »). */
const HISTORY_SHOWN = 3;

export interface PlatformDeps {
  readonly journal: Journal;
  readonly store: MachineStore;
  readonly saves: LocalSaves;
  readonly history: LocalHistory;
  readonly liaison: Liaison;
  readonly machineId: string;
  readonly appVersion: string;
  readonly platform: AppState['platform'];
  readonly profile: Profile | null;
  readonly settings: SettingsFile;
  readonly games: readonly GameEntry[];
  /** Boîte de dialogue du système puis installation (`null`: rien choisi). */
  readonly installFromFile: () => Promise<InstallOutcome | null>;
  /**
   * Téléchargements des jeux permis (pas de partie) ou non. Depuis 0.3.1 le salon
   * les laisse continuer, pour y afficher la progression.
   */
  readonly onIdleChange: (idle: boolean) => void;
  /** Recherche des mises à jour; `null` sans catalogue (versions de test). */
  readonly updates: UpdateControls | null;
  /** Quitter Duo après confirmation (M-15). */
  readonly requestQuit: () => void;
}

export interface UpdateControls {
  /** Contrôle rapide si le dernier date de plus de quelques minutes. */
  checkIfStale(): void;
  retry(): void;
  playAnyway(gameId: string): void;
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
  private lastIdle = true;
  private updates: UpdatesSnapshot = { check: { kind: 'never' }, games: new Map() };
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  /** Pastille « Nouveau » figée à l'entrée dans le salon, jusqu'à sa fermeture. */
  private salonNews: { gameId: string; version: string; isNew: boolean } | null = null;
  /** Notes de version par `id@version`; `null`: pas de notes; `loading`: lecture en cours. */
  private readonly releaseNotes = new Map<string, readonly ReleaseNote[] | null | 'loading'>();
  /** Dernières entrées de l'historique par jeu; absent: à lire. */
  private readonly historyCache = new Map<string, readonly HistoryItemView[]>();
  private readonly historyLoading = new Set<string>();
  /** Entrées écrites pendant cette exécution, par partie: le résumé du jeu peut les compléter. */
  private readonly recorded = new Map<string, { entry: HistoryEntry; summarized: boolean }>();
  /** Partie dont l'écran de fin est affiché, pour y reporter un résumé arrivé après coup. */
  private endMatchId: string | null = null;

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
        progress: message.progress,
      });
    },
    sessionEnd: (message) => {
      this.deps.journal.write('info', 'platform', 'session-end', {
        finished: message.finished,
        stats: message.stats.length,
      });
      const summary: EndSummary = {
        outcome: null,
        stats: message.stats,
        progress: message.progress,
      };
      // Le jeu termine la séance de lui-même (fin de la démo): fin pour les deux machines.
      if (message.finished && this.running?.role === 'host') {
        this.deps.liaison.stopMatch('end', summary);
        return;
      }
      // Réponse à l'arrêt (« Retour au salon », coupure): le résumé complète la fin déjà
      // décidée, ici et chez l'autre (historique, écran de fin).
      const target = this.running ?? this.stopping;
      if (!message.finished && target?.role === 'host') {
        this.deps.liaison.reportSummary(target.matchId, summary);
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
      fullscreen: this.settings.fullscreen,
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
      updateCheck: this.updates.check,
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
        this.deps.updates?.checkIfStale();
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
      case 'salon:join': {
        this.deps.updates?.checkIfStale();
        const gameId = this.sessions.peer?.salon?.game.id;
        if (gameId !== undefined && this.blockedByUpdate(gameId)) {
          return { ok: false, error: 'mise à jour du jeu en cours' };
        }
        liaison.joinSalon();
        return { ok: true };
      }
      case 'salon:leave':
        liaison.leaveSalon();
        return { ok: true };
      case 'salon:ready': {
        const ready = (arg as IntentArgs['salon:ready']).ready;
        // Même règle que l'interface: pas de lancement pendant une mise à jour ou entre deux versions.
        const salon = this.salonView();
        if (
          ready &&
          salon !== null &&
          (this.blockedByUpdate(salon.game.id) || salon.versionGap !== null)
        ) {
          return { ok: false, error: 'mise à jour du jeu en cours ou versions différentes' };
        }
        liaison.setReady(ready);
        return { ok: true };
      }
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
      case 'window:set-fullscreen':
        this.window?.setFullscreen((arg as IntentArgs['window:set-fullscreen']).fullscreen);
        return { ok: true };
      case 'library:install-file':
        return this.installFromFile();
      case 'library:opened':
        this.deps.updates?.checkIfStale();
        return { ok: true };
      case 'update:retry':
        this.deps.updates?.retry();
        return { ok: true };
      case 'update:play-anyway':
        this.deps.updates?.playAnyway((arg as IntentArgs['update:play-anyway']).gameId);
        return { ok: true };
    }
  }

  // Jeux installés (ADR 0010) ----------------------------------------------------

  /** Au repos: ni salon (le sien ou celui de l'autre), ni invitation, ni partie. */
  isIdle(): boolean {
    return (
      this.running === null &&
      this.stopping === null &&
      this.active() === null &&
      this.invitationView() === null
    );
  }

  /** Pas de partie en cours ni en arrêt: les mises à jour peuvent se télécharger et s'installer. */
  canUpdate(): boolean {
    return this.running === null && this.stopping === null;
  }

  /** État des mises à jour publié par la recherche. */
  setUpdates(snapshot: UpdatesSnapshot): void {
    this.updates = snapshot;
    this.publish();
  }

  private blockedByUpdate(gameId: string): boolean {
    return launchGate(this.updates.games.get(gameId) ?? null, this.updates.check).kind !== 'open';
  }

  /** Version que Duo fait tourner pour ce jeu, `null` s'il est absent. */
  gameVersion(id: string): string | null {
    return this.games.get(id)?.manifest.version ?? null;
  }

  /** Catalogue relu après une installation: jamais pendant une partie. */
  async setGames(games: readonly GameEntry[]): Promise<void> {
    this.games = new Map(games.map((game) => [game.manifest.id, game]));
    await this.refreshSaveSummaries();
    // Salon de l'hôte encore vide: il annonce tout de suite la nouvelle version.
    const salon = this.sessions.own.salon;
    const installed = salon === null ? undefined : this.games.get(salon.game.id);
    if (
      salon !== null &&
      installed !== undefined &&
      !salon.guestJoined &&
      this.sessions.own.match === null &&
      installed.manifest.version !== salon.game.version
    ) {
      this.deps.liaison.openSalon({ ...salon.game, version: installed.manifest.version });
    }
    this.publish();
  }

  /** Notification d'un jeu téléchargé et installé. */
  announceInstalled(outcome: InstallSuccess): void {
    this.gameToast(
      outcome.previous === null ? 'game-installed' : 'game-updated',
      outcome.name,
      outcome.version,
    );
  }

  private async installFromFile(): Promise<IntentResult> {
    if (!this.isIdle()) {
      this.gameToast('install-busy', '', '');
      return { ok: true };
    }
    const outcome = await this.deps.installFromFile();
    if (outcome === null) return { ok: true };
    if (outcome.ok) {
      this.announceInstalled(outcome);
      return { ok: true };
    }
    switch (outcome.reason) {
      case 'invalid':
        this.gameToast('install-invalid', '', '');
        break;
      case 'not-newer':
        this.gameToast('install-not-newer', outcome.name, outcome.version);
        break;
      case 'unsupported':
        this.gameToast('install-unsupported', outcome.name, '');
        break;
      case 'io':
        this.gameToast('install-failed', '', '');
        break;
    }
    return { ok: true };
  }

  private gameToast(kind: GameToastKind, game: string, version: string): void {
    this.toastId += 1;
    const id = this.toastId;
    this.toasts = [...this.toasts, { id, kind, game, version }].slice(-3);
    setTimeout(() => {
      this.toasts = this.toasts.filter((item) => item.id !== id);
      this.publish();
    }, TOAST_MS);
    this.publish();
  }

  onFullscreenChange(fullscreen: boolean): void {
    if (this.settings.fullscreen === fullscreen) return;
    void this.updateSettings({ fullscreen }).catch((error: unknown) => {
      this.logSettingsError(error);
    });
    this.publish();
  }

  private logSettingsError(error: unknown): void {
    this.deps.journal.write('warn', 'platform', 'settings-save-failed', {
      message: error instanceof Error ? error.message : String(error),
    });
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
        const idle = this.canUpdate();
        if (idle !== this.lastIdle) {
          this.lastIdle = idle;
          this.deps.onIdleChange(idle);
        }
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
      update: this.updates.games.get(manifest.id) ?? null,
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
    // Plus de salon ni de partie: la prochaine ouverture recalcule la pastille.
    if (active === null) this.salonNews = null;
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
      news: this.newsFor(game),
      history: this.historyFor(game.manifest.id),
      saveChoice: salon.game.saveChoice,
      save: salon.game.save,
      selfReady: salon.ready[self],
      peerReady: salon.ready[other],
      peerSeat: !joined ? 'waiting' : this.linkUp && this.peer !== null ? 'joined' : 'lost',
      countdownEndsAt: salon.countdownEndsAt,
      versionGap: this.versionGap(self, salon.game.version, game.manifest.version),
    };
  }

  /** Le protocole porte déjà la version de l'hôte; l'invité compare avec la sienne. */
  private versionGap(
    self: Role,
    hostVersion: string,
    selfVersion: string,
  ): SalonView['versionGap'] {
    if (hostVersion === selfVersion) return null;
    const kind =
      self === 'host'
        ? 'host-stale'
        : compareVersions(selfVersion, hostVersion) < 0
          ? 'self-older'
          : 'host-older';
    return { kind, hostVersion, selfVersion };
  }

  private newsFor(game: GameEntry): SalonNews {
    const { id, version } = game.manifest;
    if (this.salonNews?.gameId !== id || this.salonNews.version !== version) {
      const seen = this.settings.seenGameVersions[id];
      this.salonNews = { gameId: id, version, isNew: seen !== version };
      if (seen !== version) {
        void this.updateSettings({
          seenGameVersions: { ...this.settings.seenGameVersions, [id]: version },
        }).catch((error: unknown) => {
          this.logSettingsError(error);
        });
      }
      this.loadReleaseNotes(game);
    }
    const notes = this.releaseNotes.get(`${id}@${version}`);
    return {
      version,
      whatsNew: game.manifest.whatsNew.trim(),
      notes: notes === undefined || notes === 'loading' ? null : notes,
      isNew: this.salonNews.isNew,
    };
  }

  private loadReleaseNotes(game: GameEntry): void {
    const key = `${game.manifest.id}@${game.manifest.version}`;
    if (this.releaseNotes.has(key)) return;
    this.releaseNotes.set(key, 'loading');
    void readReleaseNotes(game.root).then((read) => {
      this.releaseNotes.set(key, read.status === 'ok' ? read.notes : null);
      if (read.status === 'invalid') {
        this.deps.journal.write('warn', 'platform', 'release-notes-invalid', {
          game: game.manifest.id,
          reason: read.reason,
        });
      }
      this.publish();
    });
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
        this.absorbSummaries();
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
      case 'quality':
        // Qualité du lien et heure de session pour le jeu (`duo.net.quality()`, `sessionTimeMs()`).
        if (this.running !== null) this.gameHost?.send({ type: 'link', ...event.quality });
        return;
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
      // Départ tout de suite, en heure de session: celle de l'hôte, par l'écart que mesure
      // la liaison (ADR 0007, point 4), sur la même base que le SDK de la page.
      this.gameHost.send({
        type: 'start',
        atSessionMs:
          performance.timeOrigin + performance.now() + this.deps.liaison.sessionOffsetMs(),
      });
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
    // Version de test seulement (ADR 0013): paramètres ajoutés à l'adresse du jeu, par
    // exemple le rendu léger de La Petite Ligne dans le Chromium logiciel du cloud.
    const testQuery = DUO_TEST ? (process.env.DUO_TEST_GAME_QUERY ?? '') : '';
    const entryUrl = `duo-game://${game.manifest.id}/${game.manifest.entry}`;
    void this.loadSave(role, game, salonGame).then((save) => {
      if (this.running?.matchId !== matchId || this.gameHost === null) return;
      this.gameHost.launch(
        game.manifest.id,
        testQuery === '' ? entryUrl : `${entryUrl}?${testQuery}`,
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
          // Heure de session = horloge de la page + cet écart (0 chez l'hôte); tenu à jour
          // ensuite par les messages `link`.
          clockOffsetMs: this.deps.liaison.sessionOffsetMs(),
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

  private showEnd(running: RunningMatch, end: MatchEnd): void {
    this.end = this.endView(running, end);
    this.endMatchId = end.matchId;
  }

  // Historique (prototype, ADR 0009 point 8) -----------------------------------

  /** Dernières entrées d'un jeu pour le salon; lues une fois, puis tenues à jour. */
  private historyFor(gameId: string): readonly HistoryItemView[] {
    const known = this.historyCache.get(gameId);
    if (known === undefined) this.loadHistory(gameId);
    return known ?? [];
  }

  private loadHistory(gameId: string): void {
    if (this.historyLoading.has(gameId)) return;
    this.historyLoading.add(gameId);
    void this.deps.history
      .recent(gameId, HISTORY_SHOWN)
      .then(
        (entries) => {
          this.historyCache.set(
            gameId,
            entries.map((entry) => historyItem(entry)),
          );
        },
        (error: unknown) => {
          this.historyCache.set(gameId, []);
          this.deps.journal.write('warn', 'platform', 'history-read-failed', {
            game: gameId,
            error: String(error),
          });
        },
      )
      .finally(() => {
        this.historyLoading.delete(gameId);
        this.publish();
      });
  }

  /**
   * Inscrit la partie qui vient de finir, sur chaque machine (pas de réplication avant le lot
   * L9). Un échec du chargement n'est pas une partie: rien n'est inscrit (ADR 0009, point 8).
   */
  private recordHistory(running: RunningMatch, end: MatchEnd): void {
    if (end.reason === 'load-failed') return;
    const manifest = running.game.manifest;
    const entry: HistoryEntry = {
      schema: 1,
      matchId: end.matchId,
      gameId: manifest.id,
      gameVersion: manifest.version,
      play: manifest.play,
      role: running.role,
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, end.durationMs),
      reason: end.reason,
      outcome: end.summary?.outcome ?? null,
      progress: end.summary?.progress ?? null,
      stats: [...(end.summary?.stats ?? [])],
    };
    this.recorded.set(end.matchId, { entry, summarized: end.summary !== null });
    // Quelques parties suffisent: un résumé arrive dans les secondes qui suivent la fin.
    for (const key of [...this.recorded.keys()].slice(0, -8)) this.recorded.delete(key);
    this.writeHistory(entry);
  }

  /** Résumé du jeu arrivé après la fin (séance arrêtée par la plateforme): il complète l'entrée. */
  private absorbSummaries(): void {
    for (const lastEnd of [this.sessions.own.lastEnd, this.sessions.peer?.lastEnd ?? null]) {
      const summary = lastEnd?.summary ?? null;
      if (lastEnd === null || summary === null) continue;
      const known = this.recorded.get(lastEnd.matchId);
      if (known === undefined || known.summarized) continue;
      const entry: HistoryEntry = {
        ...known.entry,
        outcome: summary.outcome,
        progress: summary.progress ?? known.entry.progress,
        stats: [...summary.stats],
      };
      this.recorded.set(lastEnd.matchId, { entry, summarized: true });
      this.writeHistory(entry);
      if (this.endMatchId === lastEnd.matchId && this.end !== null) {
        this.end = { ...this.end, stats: summary.stats };
      }
    }
  }

  private writeHistory(entry: HistoryEntry): void {
    void this.deps.history.record(entry).then(
      () => {
        this.loadHistory(entry.gameId);
      },
      (error: unknown) => {
        this.deps.journal.write('error', 'platform', 'history-write-failed', {
          game: entry.gameId,
          error: String(error),
        });
      },
    );
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
      this.recordHistory(running, end);
      const byPeer = end.by !== null && end.by !== selfSeat;
      switch (end.reason) {
        case 'stopped':
          if (byPeer) this.toast('stopped-match');
          // Une séance se termine normalement par « Retour au salon »; une partie arrêtée n'a pas d'écran de fin (UX 4.1).
          if (isSession) this.showEnd(running, end);
          break;
        case 'end':
          this.showEnd(running, end);
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
    // Séance arrêtée par la plateforme: le jeu de l'hôte répond par son résumé (`sessionEnd`).
    const awaitEnd = running.role === 'host' && isSession && end !== null && end.reason !== 'end';
    void host.stop(reason, saveOnStop, awaitEnd).then(() => {
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

/** Une entrée de l'historique vue de cette machine (issue relative à sa place). */
export function historyItem(entry: HistoryEntry): HistoryItemView {
  let result: HistoryItemView['result'];
  if (entry.reason === 'crash' || entry.reason === 'guest-gone') result = 'interrupted';
  else if (entry.reason === 'stopped')
    result = entry.play === 'session' ? 'session' : 'interrupted';
  else {
    switch (entry.outcome) {
      case 'win-host':
      case 'win-guest':
        result = (entry.outcome === 'win-host') === (entry.role === 'host') ? 'won' : 'lost';
        break;
      case 'draw':
      case 'success':
      case 'failure':
        result = entry.outcome;
        break;
      case null:
        result = 'session';
        break;
    }
  }
  return {
    matchId: entry.matchId,
    endedAt: Date.parse(entry.endedAt),
    durationMs: entry.durationMs,
    result,
    progress: entry.progress,
    stats: entry.stats,
  };
}
