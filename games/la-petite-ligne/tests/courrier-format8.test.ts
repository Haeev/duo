// Format 8 (tour 11): les lettres ne gardent plus leur texte rendu, seulement la variante et les
// variables; le texte se reconstitue depuis les données. Migration depuis les références du
// format 7, mêmes mots dans le carnet qu'avant, et taille de l'état le plus lourd mesuré.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { letterFrom, letterFromRendered, letterText, letterTitle, type RenderedLetter } from '../src/etat/courrier';
import { dialogueDone } from '../src/etat/dialogues-faits';
import { letterModels } from '../src/interface/modele';
import { uiContext } from '../src/interface/tests/aides';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { DATA_SCHEMA } from '../src/simulation/constantes';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const FOLDER = new URL('./donnees/sauvegardes/', import.meta.url);
const FORMAT_7 = readdirSync(FOLDER).filter((f) => f.startsWith('format-7-') && f.endsWith('.json')).sort();

interface Snapshot {
  dataSchema: number;
  data: { letters: RenderedLetter[] } & Record<string, unknown>;
}

function read(file: string): Snapshot {
  return JSON.parse(readFileSync(fileURLToPath(new URL(file, FOLDER)), 'utf8')) as Snapshot;
}

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

describe('courrier du format 8', () => {
  it('le format en cours est le 8', () => {
    expect(DATA_SCHEMA).toBeGreaterThanOrEqual(8);
    expect(FORMAT_7.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of FORMAT_7) {
    it(`${file}: migrée, chaque lettre redonne exactement son titre, son expéditeur et son texte, et le carnet affiche les mêmes mots`, () => {
      const { content, map } = contentAndMap();
      const ref = read(file);
      expect(ref.dataSchema).toBe(7);
      const old = ref.data.letters;
      expect(old.length).toBeGreaterThan(0);
      const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
      const now = sim.world.letters;
      expect(now.map((l) => [l.id, l.day, l.read])).toEqual(old.map((l) => [l.id, l.day, l.read]));
      for (const [i, l] of now.entries()) {
        const before = old[i];
        if (before === undefined) throw new Error('lettre absente');
        // Toutes retrouvées depuis les données: aucune ne garde son texte d'origine.
        expect(l.legacy, l.id).toBeUndefined();
        expect(letterTitle(content, l), l.id).toBe(before.title);
        expect(letterFrom(content, l), l.id).toBe(before.from);
        expect(letterText(content, l), l.id).toBe(before.text);
      }
      // Ce que le carnet affiche (onglet Courrier), comparé au rendu des textes d'avant.
      const ctx = uiContext();
      const shown = letterModels(sim.world, ctx);
      const oldWorld = { ...sim.world, letters: old.map((l) => ({ id: l.id, day: l.day, read: l.read, legacy: { title: l.title, from: l.from, text: l.text } })) };
      expect(shown).toEqual(letterModels(oldWorld, ctx));
      // Le courrier pèse bien moins dans l'état sauvegardé.
      expect(bytes(snapshotOf(sim).data.letters)).toBeLessThan(bytes(old) / 2);
      // Dialogues finis: même réponse pour chaque entrée d'avant, sans les `<id>` seuls redits.
      const doneBefore = ref.data.dialoguesDone as string[];
      for (const d of doneBefore) expect(dialogueDone(sim.world.dialoguesDone, d), d).toBe(true);
      expect(sim.world.dialoguesDone.every((d) => doneBefore.includes(d))).toBe(true);
      // Quêtes finies sans valeurs de départ; les quêtes en cours gardent les leurs.
      const questsBefore = ref.data.quests as { id: string; status: string; baselines: Record<string, number> }[];
      for (const q of sim.world.quests) {
        const before = questsBefore.find((x) => x.id === q.id);
        expect(q.baselines, q.id).toEqual(q.status === 'done' ? {} : before?.baselines);
      }
    });
  }

  it('taille: la plus lourde des références (jour 62, automne) perd au moins 6 Ko', () => {
    const { content, map } = contentAndMap();
    const ref = read('format-7-automne-jour-62.json');
    const before = bytes(ref.data);
    const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
    const after = bytes(snapshotOf(sim).data);
    // Mesuré: 49 748 octets au format 7, 43 303 au format 8. Le pire du robot assidu (jour 71, borne
    // I-06 de 52 000) est mesuré par le robot longue vie (`pnpm test:longue-vie`).
    expect(before).toBe(49_748);
    expect(before - after).toBeGreaterThan(6000);
    expect(after).toBeLessThan(44_000);
  });

  it('une lettre que les données ne redonnent plus garde son texte d’origine', () => {
    const { content } = contentAndMap();
    const old: RenderedLetter = { id: 'basile_workbench', day: 3, title: 'Un mot de Basile', from: 'Basile', text: 'Un texte réécrit depuis.', read: ['p1'] };
    const letter = letterFromRendered(content, old);
    expect(letter.legacy).toEqual({ title: old.title, from: old.from, text: old.text });
    expect(letterText(content, letter)).toBe(old.text);
    const gone = letterFromRendered(content, { ...old, id: 'lettre_retiree' });
    expect(letterTitle(content, gone)).toBe(old.title);
  });
});
