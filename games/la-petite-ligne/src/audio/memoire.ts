/**
 * Sons décodés et budget de mémoire (plafond de 128 Mo pour ce jeu, décision
 * du manager). Les boucles doivent être décodées pour sonner sans clic
 * (son.md 6); une musique décodée pèse de 17 à 39 Mo: on décode à la demande,
 * on garde les sons fréquents, on libère les moins récemment servis quand la
 * place manque. Un son en cours de lecture est « tenu » et n'est jamais libéré.
 *
 * Logique sans Web Audio: le chargeur est injecté (testé dans Node).
 */

/** Ce que le cache lit d'un tampon décodé (`AudioBuffer` le fournit). */
export interface DecodedBuffer {
  readonly length: number;
  readonly numberOfChannels: number;
}

interface Entry<B> {
  file: string;
  /** Octets comptés: estimation pendant le décodage, mesure ensuite. */
  bytes: number;
  buffer: B | null;
  pending: Promise<B | null> | null;
  pins: number;
  lastUsed: number;
  /** Gardé toute la partie (effets, interface, motifs). */
  resident: boolean;
}

export interface BufferCacheOptions<B> {
  capBytes: number;
  bytesPerSample: number;
  /** Taille décodée prévue d'un fichier (octets), avant décodage. */
  estimate(file: string): number;
  load(file: string): Promise<B>;
  now(): number;
  warn(message: string, data: Record<string, unknown>): void;
}

export interface CacheStats {
  usedBytes: number;
  peakBytes: number;
  files: number;
  pending: number;
  refused: number;
}

export class BufferCache<B extends DecodedBuffer> {
  private readonly entries = new Map<string, Entry<B>>();
  private readonly failed = new Set<string>();
  private usedBytes = 0;
  private peakBytes = 0;
  private refused = 0;
  private disposed = false;

  constructor(private readonly options: BufferCacheOptions<B>) {}

  /** Tampon prêt, ou `null` (pas encore décodé, libéré, en échec). */
  get(file: string): B | null {
    const entry = this.entries.get(file);
    if (entry === undefined || entry.buffer === null) return null;
    entry.lastUsed = this.options.now();
    return entry.buffer;
  }

  /** Décodé ou en cours de décodage. */
  has(file: string): boolean {
    return this.entries.has(file);
  }

  /** Décode le fichier s'il ne l'est pas; `null` si la place manque ou si le décodage échoue. */
  request(file: string, resident = false): Promise<B | null> {
    const existing = this.entries.get(file);
    if (existing !== undefined) {
      existing.lastUsed = this.options.now();
      if (resident) existing.resident = true;
      if (existing.buffer !== null) return Promise.resolve(existing.buffer);
      if (existing.pending !== null) return existing.pending;
    }
    if (this.disposed || this.failed.has(file)) return Promise.resolve(null);
    const estimate = Math.max(0, this.options.estimate(file));
    if (!this.makeRoom(estimate)) {
      this.refused += 1;
      this.options.warn('son non décodé: plafond de mémoire atteint', {
        file,
        neededMB: round(estimate),
        usedMB: round(this.usedBytes),
      });
      return Promise.resolve(null);
    }
    const entry: Entry<B> = {
      file,
      bytes: estimate,
      buffer: null,
      pending: null,
      pins: 0,
      lastUsed: this.options.now(),
      resident,
    };
    this.entries.set(file, entry);
    this.account(estimate);
    entry.pending = this.options.load(file).then(
      (buffer) => {
        entry.pending = null;
        if (this.disposed || this.entries.get(file) !== entry) return null;
        const bytes = buffer.length * buffer.numberOfChannels * this.options.bytesPerSample;
        this.account(bytes - entry.bytes);
        entry.bytes = bytes;
        entry.buffer = buffer;
        return buffer;
      },
      (error: unknown) => {
        entry.pending = null;
        if (this.entries.get(file) === entry) {
          this.entries.delete(file);
          this.account(-entry.bytes);
        }
        this.failed.add(file);
        this.options.warn('son illisible', { file, message: error instanceof Error ? error.message : String(error) });
        return null;
      },
    );
    return entry.pending;
  }

  /** Le décodage de `file` tiendrait-il, en libérant tout ce qui peut l'être ? */
  canFit(file: string): boolean {
    if (this.entries.has(file)) return true;
    const estimate = this.options.estimate(file);
    let freeable = 0;
    for (const e of this.entries.values()) if (this.evictable(e)) freeable += e.bytes;
    return this.usedBytes - freeable + estimate <= this.options.capBytes;
  }

  /** Tenir un son pendant sa lecture (jamais libéré tant qu'il est tenu). */
  pin(file: string): void {
    const entry = this.entries.get(file);
    if (entry === undefined) return;
    entry.pins += 1;
    entry.lastUsed = this.options.now();
  }

  unpin(file: string): void {
    const entry = this.entries.get(file);
    if (entry === undefined) return;
    entry.pins = Math.max(0, entry.pins - 1);
    entry.lastUsed = this.options.now();
  }

  /** Libère un son qui n'est plus utile (s'il n'est pas tenu ni permanent). */
  release(file: string): void {
    const entry = this.entries.get(file);
    if (entry === undefined || !this.evictable(entry)) return;
    this.entries.delete(file);
    this.account(-entry.bytes);
  }

  stats(): CacheStats {
    let pending = 0;
    for (const e of this.entries.values()) if (e.pending !== null) pending += 1;
    return { usedBytes: this.usedBytes, peakBytes: this.peakBytes, files: this.entries.size, pending, refused: this.refused };
  }

  dispose(): void {
    this.disposed = true;
    this.entries.clear();
    this.usedBytes = 0;
  }

  private evictable(entry: Entry<B>): boolean {
    return !entry.resident && entry.pins === 0 && entry.buffer !== null;
  }

  /** Libère les sons les moins récemment servis jusqu'à faire la place demandée. */
  private makeRoom(bytes: number): boolean {
    const cap = this.options.capBytes;
    if (this.usedBytes + bytes <= cap) return true;
    if (!this.canFitBytes(bytes)) return false;
    const candidates = [...this.entries.values()].filter((e) => this.evictable(e)).sort((a, b) => a.lastUsed - b.lastUsed);
    for (const entry of candidates) {
      if (this.usedBytes + bytes <= cap) break;
      this.entries.delete(entry.file);
      this.account(-entry.bytes);
    }
    return this.usedBytes + bytes <= cap;
  }

  private canFitBytes(bytes: number): boolean {
    let freeable = 0;
    for (const e of this.entries.values()) if (this.evictable(e)) freeable += e.bytes;
    return this.usedBytes - freeable + bytes <= this.options.capBytes;
  }

  private account(delta: number): void {
    this.usedBytes += delta;
    this.peakBytes = Math.max(this.peakBytes, this.usedBytes);
  }
}

const MB = 1024 * 1024;

function round(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

/** Taille décodée d'un son: durée x fréquence du contexte x voies x 4 octets. */
export function decodedBytes(seconds: number, sampleRate: number, channels: number, bytesPerSample: number): number {
  return Math.ceil(seconds * sampleRate) * channels * bytesPerSample;
}
