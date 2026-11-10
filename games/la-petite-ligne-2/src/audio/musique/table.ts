/**
 * Table de musique: lecture, validation et références croisées (un morceau, un rythme, une tranche
 * ou un jingle nommé qui n'existe pas: l'erreur nomme le champ). Ajouter un morceau ou une règle =
 * des lignes de `donnees/musique.json` et les fichiers sous `assets/commun/son/musique/`.
 */
import * as v from 'valibot';
import raw from './donnees/musique.json';
import { MusicTableSchema, type MusicTable, type When } from './schemas';

/** Valide une table et ses références croisées; lève une erreur qui liste toutes les fautes. */
export function parseMusicTable(data: unknown): MusicTable {
  const result = v.safeParse(MusicTableSchema, data);
  if (!result.success) {
    const lines = result.issues.map((issue) => {
      const path = (issue.path ?? []).map((item) => String(item.key)).join('.');
      return `musique.json: ${path === '' ? '(racine)' : path}: ${issue.message}`;
    });
    throw new Error(`Table de musique invalide:\n${lines.join('\n')}`);
  }
  const table = result.output;
  const problems: string[] = [];
  const roles = new Set(Object.values(table.tracks).flatMap((t) => Object.keys(t.stems)));
  const checkWhen = (when: When, where: string): void => {
    for (const band of when.bands ?? [])
      if (!(band in table.bands)) problems.push(`${where}: tranche inconnue « ${band} »`);
  };
  table.rules.forEach((rule, i) => {
    const where = `rules.${String(i)} (${rule.id})`;
    if (rule.play !== null && !(rule.play in table.tracks))
      problems.push(`${where}: morceau inconnu « ${rule.play} »`);
    if (!(rule.pacing in table.pacings))
      problems.push(`${where}: rythme inconnu « ${rule.pacing} »`);
    checkWhen(rule.when, where);
  });
  table.modifiers.forEach((modifier, i) => {
    const where = `modifiers.${String(i)} (${modifier.id})`;
    checkWhen(modifier.when, where);
    for (const stem of Object.keys(modifier.stemsDb))
      if (!roles.has(stem)) problems.push(`${where}: tige inconnue « ${stem} »`);
  });
  table.jingleRules.forEach((rule, i) => {
    if (!(rule.jingle in table.jingles))
      problems.push(`jingleRules.${String(i)}: jingle inconnu « ${rule.jingle} »`);
  });
  for (const [place, jingle] of Object.entries(table.arrivals))
    if (!(jingle in table.jingles))
      problems.push(`arrivals.${place}: jingle inconnu « ${jingle} »`);
  if (problems.length > 0) throw new Error(`Table de musique invalide:\n${problems.join('\n')}`);
  return table;
}

/** Table du jeu, lue une fois. */
export function loadMusicTable(): MusicTable {
  return parseMusicTable(raw);
}
