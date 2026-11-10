/** Textes de la sauvegarde et de la reprise (français, impersonnels: ils s'adressent aux deux joueurs). */
export const SAVE_TEXTS = {
  /** Fiche du salon (40 caractères au plus): `{place}`, `{day}`, `{hours}`, `{minutes}`, `{players}`. */
  label: '{place}, jour {day}, {hours} h {minutes}',
  labelWithPlayers: '{place}, jour {day}, {hours} h {minutes} ({players})',
  labelWithoutPlace: 'Jour {day}, {hours} h {minutes}',
  playersJoin: ' et ',
  refused: {
    olderStage:
      'Cette partie d’essai date d’une étape précédente du jeu et ne peut plus être reprise. Une partie neuve commence.',
    newer:
      'Cette sauvegarde vient d’une version plus récente du jeu. Mets le jeu à jour pour la reprendre. Une partie neuve commence.',
    damaged: 'Cette sauvegarde est abîmée et ne peut pas être lue. Une partie neuve commence.',
    otherDuo: 'Cette sauvegarde appartient à un autre duo. Une partie neuve commence.',
    unknownPlace:
      'Cette sauvegarde se déroule dans un lieu que le jeu ne connaît plus. Une partie neuve commence.',
  },
  replacedGuest:
    '{name} prend la place de {previous}. Le personnage est à recréer, le reste est repris.',
} as const;

export function fillText(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}
