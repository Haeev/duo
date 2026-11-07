/**
 * Sons par identifiant: `assets/son/**\/<id>.ogg` (le nom du fichier sans extension), connus à la
 * construction. Un identifiant sans fichier ne joue rien et ne bloque jamais (un seul
 * avertissement par identifiant). Les événements de la simulation se traduisent en sons par
 * `donnees/sons.json` (`{ "events": { "<type d'événement>": "<id du son>" } }`), tenu par le
 * sound designer. Bus de mixage et réveil du contexte: module audio du SDK.
 */
import { v, type Audio, type Logger } from '@duo/sdk';
import type { DataFiles } from '../donnees/charger';
import type { GameEvent } from '../simulation/evenements';

const SOUND_URLS = import.meta.glob<string>('../../assets/son/**/*.ogg', {
  query: '?url',
  import: 'default',
  eager: true,
});

const SoundsFileSchema = v.strictObject({ events: v.record(v.string(), v.string()) });

export function soundIndex(
  urls: Readonly<Record<string, string>> = SOUND_URLS,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [path, url] of Object.entries(urls)) {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.ogg$/, '');
    index.set(name, url);
  }
  return index;
}

export interface Sounds {
  play(id: string, options?: { volume?: number; bus?: 'effects' | 'interface' }): void;
  /** Son d'un événement de la simulation, s'il en a un. */
  onEvent(event: GameEvent): void;
}

export function createSounds(audio: Audio, log: Logger, files: DataFiles): Sounds {
  const index = soundIndex();
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const warned = new Set<string>();
  const parsed = v.safeParse(SoundsFileSchema, files['sons.json'] ?? { events: {} });
  const byEvent: Readonly<Record<string, string>> = parsed.success ? parsed.output.events : {};
  if (!parsed.success) log.warn('donnees/sons.json invalide: aucun son d’événement');

  const load = (id: string): Promise<AudioBuffer | null> | null => {
    const url = index.get(id);
    if (url === undefined) {
      if (!warned.has(id)) {
        warned.add(id);
        log.warn('son absent', { id });
      }
      return null;
    }
    let p = buffers.get(id);
    if (p === undefined) {
      p = audio.load(url).then(
        (b) => b,
        (error: unknown) => {
          log.warn('son illisible', { id, error: String(error) });
          return null;
        },
      );
      buffers.set(id, p);
    }
    return p;
  };

  const play = (
    id: string,
    options: { volume?: number; bus?: 'effects' | 'interface' } = {},
  ): void => {
    void load(id)?.then((buffer) => {
      if (buffer !== null)
        audio.play(buffer, { bus: options.bus ?? 'effects', volume: options.volume ?? 1 });
    });
  };

  return {
    play,
    onEvent(event) {
      const id = byEvent[event.type];
      if (id !== undefined) play(id);
    },
  };
}
