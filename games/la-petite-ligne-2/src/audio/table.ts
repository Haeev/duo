/**
 * Tables sonores: lecture, validation et contrôle des références croisées. Ajouter un son =
 * une entrée de `donnees/sons.json` (plus, s'il répond à un événement, une ligne de
 * `donnees/evenements.json`) et un fichier sous `assets/commun/son/`.
 */
import * as v from 'valibot';
import ambienceRaw from './donnees/ambiances.json';
import eventsRaw from './donnees/evenements.json';
import soundsRaw from './donnees/sons.json';
import tuningRaw from './donnees/reglages.json';
import voicesRaw from './donnees/voix.json';
import {
  AmbienceTableSchema,
  EventTableSchema,
  SoundTableSchema,
  TuningSchema,
  VoiceTableSchema,
  type AmbienceTable,
  type EventTable,
  type SoundTable,
  type Tuning,
  type VoiceTable,
} from './schemas';

export interface AudioTables {
  readonly sounds: SoundTable;
  readonly events: EventTable;
  readonly voices: VoiceTable;
  readonly ambience: AmbienceTable;
  readonly tuning: Tuning;
}

function parse<T extends v.GenericSchema>(
  schema: T,
  name: string,
  raw: unknown,
  problems: string[],
): v.InferOutput<T> | null {
  const result = v.safeParse(schema, raw);
  if (result.success) return result.output;
  for (const issue of result.issues) {
    const path = (issue.path ?? []).map((item) => String(item.key)).join('.');
    problems.push(`${name}: ${path === '' ? '(racine)' : path}: ${issue.message}`);
  }
  return null;
}

/** Valide les cinq tables et leurs références croisées; lève une erreur qui liste toutes les fautes. */
export function parseTables(raw: {
  readonly sounds: unknown;
  readonly events: unknown;
  readonly voices: unknown;
  readonly ambience: unknown;
  readonly tuning: unknown;
}): AudioTables {
  const problems: string[] = [];
  const sounds = parse(SoundTableSchema, 'sons.json', raw.sounds, problems);
  const events = parse(EventTableSchema, 'evenements.json', raw.events, problems);
  const voices = parse(VoiceTableSchema, 'voix.json', raw.voices, problems);
  const ambience = parse(AmbienceTableSchema, 'ambiances.json', raw.ambience, problems);
  const tuning = parse(TuningSchema, 'reglages.json', raw.tuning, problems);
  if (sounds !== null && events !== null) {
    const known = (id: string, where: string): void => {
      if (!(id in sounds)) problems.push(`${where}: son inconnu « ${id} »`);
    };
    events.rules.forEach((rule, index) => {
      known(rule.sound, `evenements.json: rules.${String(index)}`);
    });
    for (const [cue, id] of Object.entries(events.cues)) known(id, `evenements.json: cues.${cue}`);
    known(events.aim, 'evenements.json: aim');
    if (tuning !== null) {
      for (const [surface, id] of Object.entries(tuning.steps.surfaces))
        known(id, `reglages.json: steps.surfaces.${surface}`);
      if (!(tuning.steps.default in tuning.steps.surfaces))
        problems.push('reglages.json: steps.default: surface inconnue');
      tuning.held.forEach((held, index) => {
        held.steps.forEach((step, at) => {
          known(step.sound, `reglages.json: held.${String(index)}.steps.${String(at)}`);
          if (step.sound in sounds && sounds[step.sound]?.loop === undefined)
            problems.push(
              `reglages.json: held.${String(index)}.steps.${String(at)}: « ${step.sound} » n'a pas de boucle (loop)`,
            );
          const before = held.steps[at - 1];
          if (before !== undefined && before.from >= step.from)
            problems.push(`reglages.json: held.${String(index)}.steps: seuils non croissants`);
        });
      });
    }
  }
  if (voices !== null) {
    if (!(voices.fallback in voices.voices)) problems.push('voix.json: fallback: voix inconnue');
    for (const [id, voice] of Object.entries(voices.voices)) {
      const timbre = voices.timbres[voice.timbre];
      if (timbre === undefined) {
        problems.push(`voix.json: voices.${id}.timbre: timbre inconnu « ${voice.timbre} »`);
        continue;
      }
      // Au-delà d'une octave de décalage, la lecture accélérée ou ralentie sonne faux.
      const len = voice.scale.length;
      const last = voice.span - 1;
      const top =
        voice.tonicMidi + (voice.scale[last % len] ?? 0) + 12 * Math.floor(last / len) + 1;
      const accent = voice.tonicMidi + (voice.scale[Math.floor(len / 2)] ?? 0) + 5;
      if (
        Math.abs(voice.tonicMidi - timbre.rootMidi) > 12 ||
        Math.max(top, accent) - timbre.rootMidi > 14
      ) {
        problems.push(
          `voix.json: voices.${id}: trop loin de la note du timbre « ${voice.timbre} »`,
        );
      }
    }
  }
  if (
    problems.length > 0 ||
    sounds === null ||
    events === null ||
    voices === null ||
    ambience === null ||
    tuning === null
  ) {
    throw new Error(`Tables sonores invalides:\n${problems.join('\n')}`);
  }
  return { sounds, events, voices, ambience, tuning };
}

/** Tables du jeu, lues une fois. */
export function loadTables(): AudioTables {
  return parseTables({
    sounds: soundsRaw,
    events: eventsRaw,
    voices: voicesRaw,
    ambience: ambienceRaw,
    tuning: tuningRaw,
  });
}
