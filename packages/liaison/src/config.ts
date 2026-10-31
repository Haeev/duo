/**
 * Valeurs chiffrées du réseau de Duo (`docs/plateforme/reseau.md`, ADR 0007 et 0008).
 * Aucune autre valeur de cadence ou de seuil n'est écrite dans la logique: les tests
 * et le banc les remplacent par `createConfig({ ... })`.
 */
export interface NetworkConfig {
  /** Enveloppe figée de l'ADR 0006: ne change jamais. */
  readonly app: 'duo';
  readonly envelope: 1;
  /** Protocole de la liaison: entier, incrémenté seulement pour une incompatibilité. */
  readonly protocol: number;

  /** Port UDP et TCP de base; replis TCP sur les ports suivants. */
  readonly basePort: number;
  readonly tcpFallbacks: number;

  readonly datagramMaxBytes: number;
  readonly beaconIntervalMs: number;
  readonly beaconJitterMs: number;
  /** Requêtes après le démarrage ou un changement d'interface. */
  readonly querySchedule: readonly number[];
  /** Requêtes répétées tant que le partenaire n'est pas relié. */
  readonly queryRepeatMs: number;
  readonly queryReplyMaxDelayMs: number;
  /** Une machine vue seulement par ses balises disparaît après ce silence. */
  readonly sightingExpiryMs: number;
  readonly byeRepeat: number;
  readonly byeSpacingMs: number;
  readonly interfacesRefreshMs: number;
  readonly interfacesRefreshUnlinkedMs: number;
  readonly datagramsPerSecondPerSource: number;
  readonly datagramsPerSecondTotal: number;

  /** Appel d'une machine vue: une tentative par adresse, décalées. */
  readonly dialStaggerMs: number;
  readonly dialTimeoutMs: number;
  /** Connexion par adresse saisie: les ports essayés ensemble, ce délai au plus. */
  readonly manualDialTimeoutMs: number;
  /** Écart minimal entre deux appels spontanés vers la même machine. */
  readonly dialCooldownMs: number;
  readonly helloTimeoutMs: number;
  readonly handshakeTimeoutMs: number;

  readonly heartbeatIdleMs: number;
  readonly heartbeatActiveMs: number;
  /** Silence qui déclenche la reconnexion anticipée (régime actif). */
  readonly earlyReconnectMs: number;
  readonly lostIdleMs: number;
  readonly lostActiveMs: number;
  readonly silenceCheckMs: number;
  /** Relance: rapide pendant `redialFastDurationMs`, puis lente, sans fin. */
  readonly redialFastMs: number;
  readonly redialFastDurationMs: number;
  readonly redialSlowMs: number;
  /** Le côté appelé ne rappelle qu'après ce délai (l'appelant connaît le chemin qui marche). */
  readonly calleeRedialDelayMs: number;
  readonly retainedProbeMs: number;
  /** Adresse mise de côté après une preuve fausse. */
  readonly badProofQuarantineMs: number;

  /** Tampon de réémission des messages fiables non acquittés. */
  readonly retransmitBufferBytes: number;
  readonly maxFrameBytes: number;
  readonly maxGameMessageBytes: number;
  readonly gameChannels: number;
  readonly gameMessagesPerSecond: number;
  readonly gameBytesPerSecond: number;
  readonly controlMessagesPerSecond: number;
  readonly invalidMessagesPerMinute: number;

  readonly maxUnauthenticatedConnections: number;
  readonly connectionsPerSecondPerAddress: number;
  readonly httpHeadersTimeoutMs: number;

  /** Échantillons de battements gardés pour l'écart d'horloge et l'aller-retour. */
  readonly clockSamples: number;
  readonly qualityWindowMs: number;
  readonly unstableAfterMs: number;
  readonly unstableJitterMs: number;

  readonly countdownMs: number;
  readonly lateCancelMaxMarginMs: number;
  readonly lateCancelBaseMarginMs: number;
  readonly startDelayMinMs: number;
  readonly startDelayExtraMs: number;
  readonly resumeCountdownMs: number;

  readonly paths: {
    readonly link: string;
    readonly transfer: string;
    readonly probe: string;
  };
  readonly subprotocol: string;
}

export const DEFAULT_CONFIG: NetworkConfig = {
  app: 'duo',
  envelope: 1,
  protocol: 1,

  basePort: 39420,
  tcpFallbacks: 2,

  datagramMaxBytes: 1200,
  beaconIntervalMs: 1000,
  beaconJitterMs: 100,
  querySchedule: [0, 250, 750, 1500],
  queryRepeatMs: 5000,
  queryReplyMaxDelayMs: 50,
  sightingExpiryMs: 5000,
  byeRepeat: 3,
  byeSpacingMs: 50,
  interfacesRefreshMs: 2000,
  interfacesRefreshUnlinkedMs: 1000,
  datagramsPerSecondPerSource: 20,
  datagramsPerSecondTotal: 200,

  dialStaggerMs: 250,
  dialTimeoutMs: 1000,
  manualDialTimeoutMs: 5000,
  dialCooldownMs: 1000,
  helloTimeoutMs: 3000,
  handshakeTimeoutMs: 5000,

  heartbeatIdleMs: 2000,
  heartbeatActiveMs: 500,
  earlyReconnectMs: 1000,
  lostIdleMs: 6000,
  lostActiveMs: 2000,
  silenceCheckMs: 50,
  redialFastMs: 250,
  redialFastDurationMs: 10_000,
  redialSlowMs: 1000,
  calleeRedialDelayMs: 5000,
  retainedProbeMs: 5000,
  badProofQuarantineMs: 60_000,

  retransmitBufferBytes: 4 * 1024 * 1024,
  maxFrameBytes: 128 * 1024,
  maxGameMessageBytes: 64 * 1024,
  gameChannels: 16,
  gameMessagesPerSecond: 120,
  gameBytesPerSecond: 512 * 1024,
  controlMessagesPerSecond: 200,
  invalidMessagesPerMinute: 10,

  maxUnauthenticatedConnections: 4,
  connectionsPerSecondPerAddress: 5,
  httpHeadersTimeoutMs: 3000,

  clockSamples: 16,
  qualityWindowMs: 10_000,
  unstableAfterMs: 250,
  unstableJitterMs: 30,

  countdownMs: 3000,
  lateCancelMaxMarginMs: 250,
  lateCancelBaseMarginMs: 50,
  startDelayMinMs: 300,
  startDelayExtraMs: 100,
  resumeCountdownMs: 3000,

  paths: {
    link: '/duo/liaison',
    transfer: '/duo/transfert',
    probe: '/duo/sonde',
  },
  subprotocol: 'duo',
};

/** Configuration complète à partir des valeurs par défaut et de quelques remplacements. */
export function createConfig(overrides: Partial<NetworkConfig> = {}): NetworkConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
