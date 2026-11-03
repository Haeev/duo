// Données propres à cette machine (ADR 0009, points 1 et 2): identifiant,
// profil, réglages. Chaque fichier porte un champ `schema` et passe par son
// schéma Valibot à la lecture.
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import * as v from 'valibot';
import { PLAYER_COLORS } from '../../shared/players';
import { checkPseudo } from '../../shared/pseudo';
import type { Profile, Settings } from '../../shared/state';
import { readJsonSafe, writeJsonSafe } from './safe-write';

export const DATA_FORMAT = 1;

const FormatSchema = v.object({ schema: v.literal(1), format: v.number() });

const MachineSchema = v.object({
  schema: v.literal(1),
  machineId: v.pipe(v.string(), v.uuid()),
});

export const PseudoSchema = v.pipe(
  v.string(),
  v.check((value) => checkPseudo(value).ok, 'pseudo refusé'),
  v.transform((value) => value.normalize('NFC').trim()),
);

export const ProfileSchema = v.object({
  pseudo: PseudoSchema,
  color: v.picklist(PLAYER_COLORS),
});

const ProfileFileSchema = v.object({ schema: v.literal(1), ...ProfileSchema.entries });

export const SettingsSchema = v.object({
  reducedMotion: v.nullable(v.boolean()),
  uiScale: v.picklist([1, 1.25, 1.5]),
});

const SettingsFileSchema = v.object({
  schema: v.literal(1),
  ...SettingsSchema.entries,
  networkAccepted: v.boolean(),
  setupDone: v.boolean(),
  fullscreen: v.boolean(),
  /** Version de chaque jeu à la dernière ouverture de son salon (pastille « Nouveau »). */
  seenGameVersions: v.optional(
    v.record(v.pipe(v.string(), v.maxLength(64)), v.pipe(v.string(), v.maxLength(32))),
    {},
  ),
});

export type SettingsFile = v.InferOutput<typeof SettingsFileSchema>;

export const DEFAULT_SETTINGS: SettingsFile = {
  schema: 1,
  reducedMotion: null,
  uiScale: 1,
  networkAccepted: false,
  setupDone: false,
  fullscreen: false,
  seenGameVersions: {},
};

export interface MachineData {
  readonly machineId: string;
  readonly profile: Profile | null;
  readonly settings: SettingsFile;
  /** Fichiers abîmés mis à part pendant la lecture (M-20, journalisé). */
  readonly recovered: readonly string[];
}

export interface DataProblem {
  readonly kind: 'format-too-new';
  readonly format: number;
}

export class MachineStore {
  constructor(private readonly dir: string) {}

  private file(name: string): string {
    return path.join(this.dir, name);
  }

  /** Lit tout au démarrage; crée ce qui manque. */
  async load(): Promise<MachineData | DataProblem> {
    const recovered: string[] = [];
    const format = await readJsonSafe(this.file('format.json'), FormatSchema);
    if (format.status === 'ok' && format.value.format > DATA_FORMAT) {
      return { kind: 'format-too-new', format: format.value.format };
    }
    if (format.status !== 'ok') {
      await writeJsonSafe(this.file('format.json'), { schema: 1, format: DATA_FORMAT });
    }

    const machine = await readJsonSafe(this.file('machine.json'), MachineSchema);
    let machineId: string;
    if (machine.status === 'ok') {
      machineId = machine.value.machineId;
    } else {
      if (machine.status === 'invalid' && machine.quarantined !== null) {
        recovered.push(machine.quarantined);
      }
      machineId = randomUUID();
      await writeJsonSafe(this.file('machine.json'), { schema: 1, machineId });
    }

    const profileRead = await readJsonSafe(this.file('profile.json'), ProfileFileSchema);
    let profile: Profile | null = null;
    if (profileRead.status === 'ok') {
      profile = { pseudo: profileRead.value.pseudo, color: profileRead.value.color };
    } else if (profileRead.status === 'invalid' && profileRead.quarantined !== null) {
      recovered.push(profileRead.quarantined);
    }

    const settingsRead = await readJsonSafe(this.file('settings.json'), SettingsFileSchema);
    let settings = DEFAULT_SETTINGS;
    if (settingsRead.status === 'ok') {
      settings = settingsRead.value;
    } else if (settingsRead.status === 'invalid' && settingsRead.quarantined !== null) {
      recovered.push(settingsRead.quarantined);
    }

    return { machineId, profile, settings, recovered };
  }

  async saveProfile(profile: Profile): Promise<void> {
    await writeJsonSafe(this.file('profile.json'), { schema: 1, ...profile });
  }

  async saveSettings(settings: SettingsFile): Promise<void> {
    await writeJsonSafe(this.file('settings.json'), settings);
  }
}

export function publicSettings(settings: SettingsFile): Settings {
  return { reducedMotion: settings.reducedMotion, uiScale: settings.uiScale };
}
