/**
 * Petit lecteur de JSON contrôlé: chaque accès vérifie le type et, en cas
 * d'erreur, cite le fichier et le chemin du champ (« quetes.json:
 * quests[3].steps[0].conditions[1].type: valeur inconnue »).
 */

export class ContentError extends Error {
  override readonly name = 'ContentError';
}

export class Reader {
  constructor(
    readonly file: string,
    readonly path: string,
    readonly value: unknown,
  ) {}

  fail(message: string): never {
    const where = this.path === '' ? this.file : `${this.file}: ${this.path}`;
    throw new ContentError(`${where}: ${message}`);
  }

  private child(key: string | number, value: unknown): Reader {
    const path =
      typeof key === 'number' ? `${this.path}[${key}]` : this.path === '' ? key : `${this.path}.${key}`;
    return new Reader(this.file, path, value);
  }

  isObject(): boolean {
    return typeof this.value === 'object' && this.value !== null && !Array.isArray(this.value);
  }

  private record(): Record<string, unknown> {
    if (!this.isObject()) {
      this.fail('objet attendu');
    }
    return this.value as Record<string, unknown>;
  }

  has(key: string): boolean {
    return this.isObject() && (this.value as Record<string, unknown>)[key] !== undefined;
  }

  /** Champ obligatoire. */
  at(key: string): Reader {
    const record = this.record();
    if (!(key in record) || record[key] === undefined) {
      this.child(key, undefined).fail('champ obligatoire absent');
    }
    return this.child(key, record[key]);
  }

  /** Champ facultatif: `null` s'il est absent. */
  opt(key: string): Reader | null {
    const record = this.record();
    const value = record[key];
    return value === undefined ? null : this.child(key, value);
  }

  keys(): string[] {
    return Object.keys(this.record());
  }

  items(): Reader[] {
    if (!Array.isArray(this.value)) {
      this.fail('liste attendue');
    }
    return (this.value as unknown[]).map((item, index) => this.child(index, item));
  }

  entries(): [string, Reader][] {
    const record = this.record();
    return Object.keys(record).map((key) => [key, this.child(key, record[key])]);
  }

  string(): string {
    if (typeof this.value !== 'string') {
      this.fail('texte attendu');
    }
    return this.value as string;
  }

  number(): number {
    if (typeof this.value !== 'number' || !Number.isFinite(this.value)) {
      this.fail('nombre attendu');
    }
    return this.value as number;
  }

  integer(min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
    const value = this.number();
    if (!Number.isInteger(value) || value < min || value > max) {
      this.fail(`entier de ${min} à ${max} attendu`);
    }
    return value;
  }

  boolean(): boolean {
    if (typeof this.value !== 'boolean') {
      this.fail('booléen attendu');
    }
    return this.value as boolean;
  }

  isNull(): boolean {
    return this.value === null;
  }

  oneOf<T extends string>(allowed: readonly T[]): T {
    const value = this.string();
    if (!(allowed as readonly string[]).includes(value)) {
      this.fail(`valeur inconnue « ${value} » (attendu: ${allowed.join(', ')})`);
    }
    return value as T;
  }

  /** Heure de jeu `"HH:MM"` (jusqu'à `"24:00"`), en minutes depuis minuit. */
  time(): number {
    const text = this.string();
    const match = /^(\d{2}):(\d{2})$/.exec(text);
    const hours = match ? Number(match[1]) : Number.NaN;
    const minutes = match ? Number(match[2]) : Number.NaN;
    if (!match || hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) {
      this.fail(`heure « HH:MM » attendue, reçu « ${text} »`);
    }
    return hours * 60 + minutes;
  }

  stringList(): string[] {
    return this.items().map((item) => item.string());
  }

  numberList(): number[] {
    return this.items().map((item) => item.number());
  }
}
