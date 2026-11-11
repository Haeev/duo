/**
 * Table des timbres des instruments joués (`donnees/timbres.json`). Un timbre est une recette
 * de synthèse (harmoniques, enveloppe, vibrato, filtre): une note tient aussi longtemps qu'il
 * faut, à n'importe quelle hauteur, sans échantillon. Un instrument des données (`instrument.timbre`
 * d'un objet) nomme une entrée de cette table.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema } from '../../donnees/schemas/communs';
import timbres from './donnees/timbres.json';

const Ms = v.pipe(FiniteSchema, v.minValue(1), v.maxValue(2000));
const Db = v.pipe(FiniteSchema, v.minValue(-60), v.maxValue(6));

export const TimbreSchema = v.strictObject({
  /** Niveau de chaque harmonique, la fondamentale d'abord (1 = plein niveau). */
  harmonics: v.pipe(
    v.array(v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1))),
    v.minLength(1),
    v.maxLength(24),
  ),
  /** Enveloppe: attaque, retombée vers le niveau tenu, relâchement (ms). */
  attackMs: Ms,
  decayMs: Ms,
  sustain: v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(1)),
  releaseMs: Ms,
  /** Vibrato qui vient sur les notes tenues; absent: son droit. */
  vibrato: v.exactOptional(
    v.strictObject({
      hz: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(12)),
      cents: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(60)),
      delayMs: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(2000)),
    }),
  ),
  lowpassHz: v.pipe(FiniteSchema, v.minValue(300), v.maxValue(16000)),
  volumeDb: Db,
});
export type Timbre = v.InferOutput<typeof TimbreSchema>;

export const TimbreTableSchema = v.strictObject({
  /** Timbre joué quand un instrument en nomme un qui n'existe pas. */
  fallback: IdSchema,
  /** Décompte avant le premier temps: un petit bois, plus aigu sur le premier coup. */
  countIn: v.strictObject({
    hz: v.pipe(FiniteSchema, v.minValue(100), v.maxValue(6000)),
    accentHz: v.pipe(FiniteSchema, v.minValue(100), v.maxValue(6000)),
    ms: Ms,
    volumeDb: Db,
  }),
  timbres: v.record(IdSchema, TimbreSchema),
});
export type TimbreTable = v.InferOutput<typeof TimbreTableSchema>;

/** Lit une table; une faute nomme le champ. Le timbre de repli doit exister. */
export function parseTimbres(raw: unknown): TimbreTable {
  const table = v.parse(TimbreTableSchema, raw);
  if (table.timbres[table.fallback] === undefined)
    throw new Error(`timbres: le timbre de repli « ${table.fallback} » n'existe pas`);
  return table;
}

export function loadTimbres(): TimbreTable {
  return parseTimbres(timbres);
}
