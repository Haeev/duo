// Portraits des personnages qui parlent: chaque habitant de chaque lieu a son portrait dessiné
// (aucun substitut « provisoire »), avec les cinq calques d'expression, et chaque expression que
// demandent les répliques (dialogues et scènes) existe dans le portrait de celui qui la dit.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasDrawnPortrait,
  moodOfEmote,
  portraitMarkup,
  PORTRAIT_MOODS,
} from '../src/interface/portrait';
import { gameDataFiles } from './aides';

const PKG = path.join(import.meta.dirname, '..');
const files = gameDataFiles();

/** Identifiant de portrait de celui qui parle: les joueurs partagent le portrait `joueur`. */
const portraitOf = (speaker: string): string | null => {
  if (speaker === 'narrator') return null;
  if (speaker === 'player' || speaker === 'a' || speaker === 'b') return 'joueur';
  return speaker;
};

/** Chaque réplique des données: qui parle et avec quelle émotion, où qu'elle soit rangée. */
function lines(): { file: string; speaker: string; emote: string | null }[] {
  const out: { file: string; speaker: string; emote: string | null }[] = [];
  const walk = (file: string, node: unknown): void => {
    if (Array.isArray(node)) {
      for (const n of node) walk(file, n);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const o = node as Record<string, unknown>;
    const emote = typeof o.emote === 'string' ? o.emote : null;
    if (o.kind === 'line' && typeof o.speaker === 'string')
      out.push({ file, speaker: o.speaker, emote });
    if (o.do === 'say' && typeof o.who === 'string')
      out.push({ file, speaker: o.who, emote });
    for (const v of Object.values(o)) walk(file, v);
  };
  for (const [file, data] of Object.entries(files))
    if (/\/(dialogues|scenes)\//.test(file)) walk(file, data);
  return out;
}

const villagers = Object.keys(files)
  .filter((f) => /^lieux\/[^/]+\/habitants\/[^/]+\.json$/.test(f))
  .map((f) => (files[f] as { id: string }).id);

describe('portraits des habitants', () => {
  it('chaque habitant de chaque lieu a son portrait dessiné, en cinq expressions', () => {
    expect(villagers).toContain('controleur');
    expect(villagers).toContain('martial');
    for (const id of villagers) {
      expect(hasDrawnPortrait(id), `${id}: portrait provisoire`).toBe(true);
      const svg = portraitMarkup(id);
      for (const mood of PORTRAIT_MOODS)
        expect(svg, `${id}: expression ${mood}`).toContain(`class="expr expr--${mood}"`);
      expect(svg.match(/class="bouche"/g)?.length, `${id}: une bouche par calque`).toBe(
        PORTRAIT_MOODS.length,
      );
    }
  });

  it('chaque réplique trouve le portrait de celui qui parle, dans l’expression demandée', () => {
    const all = lines();
    expect(all.length).toBeGreaterThan(1000);
    const missing = new Set<string>();
    for (const line of all) {
      const id = portraitOf(line.speaker);
      if (id === null) continue;
      const mood = moodOfEmote(line.emote);
      if (!hasDrawnPortrait(id)) missing.add(`${line.file}: ${id} sans portrait`);
      else if (!portraitMarkup(id).includes(`class="expr expr--${mood}"`))
        missing.add(`${line.file}: ${id} sans l'expression ${mood}`);
    }
    expect([...missing]).toEqual([]);
  });

  it('chaque fiche de portrait composé a sa source générée et son portrait encré', () => {
    const fiches = JSON.parse(
      readFileSync(
        path.join(PKG, 'assets-src', 'interface-encre', 'portraits', 'fiches.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    for (const id of Object.keys(fiches).filter((k) => !k.startsWith('_'))) {
      const src = path.join(PKG, 'assets-src', 'interface-encre', 'portraits', `${id}.svg`);
      expect(readFileSync(src, 'utf8'), id).toContain('Généré par generer-portraits.mjs');
      expect(
        existsSync(path.join(PKG, 'assets', 'commun', 'interface', 'portraits', `${id}.svg`)),
        id,
      ).toBe(true);
    }
  });

  it('traduit l’émotion d’une réplique en expression', () => {
    expect(moodOfEmote('joy')).toBe('content');
    expect(moodOfEmote('surprise')).toBe('surpris');
    expect(moodOfEmote('anger')).toBe('fache');
    expect(moodOfEmote('sad')).toBe('soucieux');
    expect(moodOfEmote('question')).toBe('neutre');
    expect(moodOfEmote(null)).toBe('neutre');
  });
});
