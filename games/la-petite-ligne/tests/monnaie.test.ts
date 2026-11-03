// L'aubrin (0.12, lot L-monnaie, critères CA-M1 à CA-M5 de `v0-12-conception.md`): plus aucun
// « sou » monétaire affiché, les prépositions intactes, l'accord de 0 et 1, les sauvegardes du
// format 8 reprises avec la même bourse, et la lettre de Firmin une seule fois.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CURRENCY,
  agreeMoney,
  formatMoney,
  moneyUnit,
  oldCurrencyIn,
  renameOldCurrency,
} from '../src/donnees/monnaie';
import { decodeSave, restoreWorld } from '../src/sauvegarde/sauvegarde';
import { SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play } from './aides';

const GAME = fileURLToPath(new URL('..', import.meta.url));
const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const FOLDER = new URL('./donnees/sauvegardes/', import.meta.url);
/** Les anciennes notes de version gardent « sous »: c'est l'histoire (section 1.3). */
const HISTORY = new Set(['notes-de-version.json']);
const PREPOSITION =
  /\bsous (?:le|la|les|l'|l’|un|une|des|ce|cet|cette|son|sa|ses|leur|leurs|mon|ma|mes|nos|vos|votre|ton|ta|tes)\b/g;

/** Tous les textes d'un JSON, à plat. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const v of node) strings(v, out);
  else if (typeof node === 'object' && node !== null)
    for (const v of Object.values(node)) strings(v, out);
  return out;
}

function textFiles(): string[] {
  const data = path.join(GAME, 'donnees');
  const files = readdirSync(data)
    .filter((f) => f.endsWith('.json') && !HISTORY.has(f))
    .map((f) => path.join(data, f));
  return [...files, path.join(GAME, 'src', 'interface', 'textes-interface.json')];
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'tests' && name !== 'demo') sourceFiles(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function readSave(file: string): { dataSchema: number; data: unknown } {
  return JSON.parse(readFileSync(fileURLToPath(new URL(file, FOLDER)), 'utf8')) as {
    dataSchema: number;
    data: unknown;
  };
}

describe('L-monnaie: l’aubrin', () => {
  it('CA-M1: aucun texte des données ni chaîne du code ne dit encore « sou » au sens de la monnaie', () => {
    const found: string[] = [];
    for (const file of textFiles()) {
      for (const text of strings(JSON.parse(readFileSync(file, 'utf8')))) {
        if (oldCurrencyIn(text) || /[0-9}] sous?\b(?!-)/.test(text))
          found.push(`${path.basename(file)}: ${text.slice(0, 80)}`);
      }
    }
    for (const file of sourceFiles(path.join(GAME, 'src'))) {
      for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue;
        if (/['"`][^'"`]*[0-9}] sous?\b(?!-)/.test(code))
          found.push(`${path.relative(GAME, file)}:${String(i + 1)}`);
      }
    }
    expect(found).toEqual([]);
    expect(CURRENCY).toEqual({ singular: 'aubrin', plural: 'aubrins', icon: 'ui-coin-aubrin' });
    expect(contentAndMap().content.settings.economy.currency).toEqual(CURRENCY);
  });

  it('CA-M2: les « sous » prépositions restent (« sous la pluie », « sous le toit »...)', () => {
    let count = 0;
    for (const file of textFiles()) {
      for (const text of strings(JSON.parse(readFileSync(file, 'utf8'))))
        count += text.match(PREPOSITION)?.length ?? 0;
    }
    // Comptées avant le renommage: 15 (d'autres lots en ajoutent depuis): « sous la pluie », « sous les noisetiers », « sous votre toit »...
    expect(count).toBeGreaterThanOrEqual(15);
    expect(renameOldCurrency('Marcher sous la pluie jusqu’au gué.')).toBe(
      'Marcher sous la pluie jusqu’au gué.',
    );
    expect(renameOldCurrency('Basile a mangé chaud. 30 sous.')).toBe(
      'Basile a mangé chaud. 30 aubrins.',
    );
    expect(renameOldCurrency('Il manque 1 sous.')).toBe('Il manque 1 aubrin.');
  });

  it('CA-M3: formatMoney accorde 0 et 1 au singulier et groupe les milliers', () => {
    expect(formatMoney(0)).toBe('0 aubrin');
    expect(formatMoney(1)).toBe('1 aubrin');
    expect(formatMoney(2)).toBe('2 aubrins');
    expect(formatMoney(1200)).toBe('1 200 aubrins');
    expect(moneyUnit(10)).toBe('aubrins');
    // Les gabarits des données s'accordent au remplissage, sans toucher à 10, 21 ni 1 200.
    expect(agreeMoney('Il manque 1 aubrins.')).toBe('Il manque 1 aubrin.');
    expect(agreeMoney('10 aubrins, 21 aubrins, 1 201 aubrins, 0 aubrins')).toBe(
      '10 aubrins, 21 aubrins, 1 201 aubrins, 0 aubrin',
    );
  });

  it('CA-M4: une sauvegarde du format 8 se reprend avec la même bourse, ses notifications en aubrins', () => {
    const { content, map } = contentAndMap();
    const ref = readSave('format-8-milieu-semaine-2.json');
    const before = ref.data as { purse: number };
    const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [
      A,
      B,
    ]);
    expect(sim.world.purse).toBe(before.purse);
    const texts = sim.world.characters.flatMap((c) => c.notifications.map((n) => n.text));
    expect(texts).toContain('Basile a mangé chaud. 30 aubrins.');
    expect(texts.filter((t) => oldCurrencyIn(t))).toEqual([]);
  });

  it('CA-M5: la lettre de Firmin arrive une fois, aussi dans une partie reprise après son jour', () => {
    const { content, map } = contentAndMap();
    const ref = readSave('format-8-automne-jour-62.json');
    const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [
      A,
      B,
    ]);
    const count = (): number => sim.world.letters.filter((l) => l.id === 'firmin_aubrin').length;
    expect(count()).toBe(0);
    step(sim, { controls: {}, intents: [] });
    expect(count()).toBe(1);
    const day = sim.world.clock.day;
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) => s.world.clock.day > day && s.world.phase === 'day',
      SIM_HZ * 60 * 60,
    );
    expect(sim.world.clock.day).toBe(day + 1);
    expect(count()).toBe(1);
    // Partie neuve: pas avant le jour 16 (rien ne change dans la démo).
    const fresh = newSim();
    expect(fresh.world.letters.some((l) => l.id === 'firmin_aubrin')).toBe(false);
  });
});
