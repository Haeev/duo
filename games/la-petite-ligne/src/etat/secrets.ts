/**
 * Informations propres à un seul joueur (R16), vues par un joueur donné: fiche secrète,
 * objectif selon le rôle, nom des poules. Pur (sans Three.js ni DOM): la simulation, l'interface
 * et le rendu lisent les mêmes règles, et l'écran de l'autre ne montre jamais le secret (S-02).
 */
import type { Content, QuestDef } from '../donnees/types';
import type { CharacterId, DeepReadonly, Hen, ReadonlyWorld, SecretEntry } from './types';

type Vars = Record<string, string | number>;

/** La quête des noms des poules (`quetes.json`): ses étiquettes ne se montrent qu'à l'informé. */
export const HEN_NAMES_QUEST = 'hen_names';

/** Remplace `{nom}`; un nom absent reste tel quel (jetons de touches remplacés par l'interface). */
function fill(template: string, vars: Vars): string {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

function rawBlock(content: Content, key: string): Record<string, unknown> {
  const raw = content.texts.raw[key];
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

function rawText(block: Record<string, unknown>, key: string, fallback: string): string {
  const value = block[key];
  return typeof value === 'string' ? value : fallback;
}

/** « la blanche » (`textes.henColors`) pour une variante de poule. */
export function henColor(content: Content, variant: string): string {
  return rawText(rawBlock(content, 'henColors'), variant, variant);
}

/** « la poule blanche » (`textes.henUnknown`): ce que lit celui qui ne connaît pas encore son nom. */
export function henUnknown(content: Content, variant: string): string {
  return rawText(rawBlock(content, 'henUnknown'), variant, variant);
}

/** `{henColor1}`, `{henColor2}`, `{henColor3}`: couleur de la première, deuxième, troisième poule (ordre des noms). */
export function henVars(world: ReadonlyWorld, content: Content): Vars {
  const vars: Vars = {};
  world.hens.forEach((hen, i) => {
    vars[`henColor${String(i + 1)}`] = henColor(content, hen.variant);
  });
  return vars;
}

export function secretOf(world: ReadonlyWorld, quest: string): DeepReadonly<SecretEntry> | null {
  return world.secrets.entries.find((e) => e.quest === quest) ?? null;
}

/** Rôle de ce joueur dans la quête, ou `null` (quête sans secret). */
export function roleIn(world: ReadonlyWorld, quest: string, viewer: CharacterId): 'informed' | 'doer' | null {
  const entry = secretOf(world, quest);
  if (entry === null) return null;
  return entry.informed === viewer ? 'informed' : entry.doer === viewer ? 'doer' : null;
}

function partnerName(world: ReadonlyWorld, viewer: CharacterId): string {
  return world.characters.find((c) => c.id !== viewer)?.name ?? '';
}

/** La ligne du secret pour sa variante (`{secret}`), ou la première ligne. */
function secretLine(def: QuestDef, variant: number): string {
  const lines = def.secret?.card.lines ?? [];
  const first = lines[variant] ?? lines[0];
  if (Array.isArray(first)) return first.join(' ');
  return typeof first === 'string' ? first : '';
}

/** Variables d'un texte vu par ce joueur: `{partner}`, les couleurs des poules, et `{secret}` s'il est l'informé. */
export function secretVars(world: ReadonlyWorld, content: Content, quest: QuestDef, viewer: CharacterId): Vars {
  const vars: Vars = { ...henVars(world, content), partner: partnerName(world, viewer) };
  const entry = secretOf(world, quest.id);
  if (entry !== null && entry.informed === viewer) vars.secret = secretLine(quest, entry.variant);
  return vars;
}

export interface SecretCard {
  quest: string;
  title: string;
  lines: string[];
}

/**
 * Fiches secrètes que ce joueur peut lire: celles dont il est l'informé, une fois révélées
 * (`revealOn`), et toutes celles que `reveal_secret` a rendues visibles des deux.
 */
export function secretCards(world: ReadonlyWorld, content: Content, viewer: CharacterId): SecretCard[] {
  const out: SecretCard[] = [];
  for (const entry of world.secrets.entries) {
    const visible = entry.shared || (entry.informed === viewer && entry.revealed);
    const def = content.quests.find((q) => q.id === entry.quest);
    if (!visible || def === undefined || def.secret === null) continue;
    const vars = secretVars(world, content, def, entry.informed);
    const raw = def.secret.card.lines;
    const chosen = raw.length > 0 && Array.isArray(raw[0]) ? ((raw as string[][])[entry.variant] ?? []) : (raw as string[]);
    out.push({ quest: entry.quest, title: fill(def.secret.card.title, vars), lines: chosen.map((l) => fill(l, vars)) });
  }
  return out;
}

/** Objectif de l'étape vu par ce joueur: le texte de son rôle s'il y en a un, sinon `objective`. */
export function objectiveTemplate(world: ReadonlyWorld, content: Content, quest: string, step: number, viewer: CharacterId): string {
  const def = content.quests.find((q) => q.id === quest);
  const s = def?.steps[step];
  if (def === undefined || s === undefined) return def?.completionText ?? '';
  const role = roleIn(world, quest, viewer);
  if (role === null || s.objectiveByRole === null) return s.objective;
  return s.objectiveByRole[role];
}

/** Objectif vu par ce joueur, variables du secret remplacées (les autres jetons restent). */
export function objectiveFor(world: ReadonlyWorld, content: Content, quest: string, step: number, viewer: CharacterId): string {
  const def = content.quests.find((q) => q.id === quest);
  if (def === undefined) return '';
  return fill(objectiveTemplate(world, content, quest, step, viewer), secretVars(world, content, def, viewer));
}

/** Ce joueur voit-il le nom de cette poule au-dessus d'elle ? (le connaît, ou l'informé de la quête des noms) */
export function henNameVisible(world: ReadonlyWorld, hen: DeepReadonly<Hen>, viewer: CharacterId, namesQuest = HEN_NAMES_QUEST): boolean {
  if (hen.nameKnownBy.includes(viewer)) return true;
  const entry = secretOf(world, namesQuest);
  return entry !== null && entry.informed === viewer && entry.revealed;
}

/** Étiquette d'une poule pour ce joueur: son nom s'il le voit, sinon « la poule blanche ». */
export function henLabel(world: ReadonlyWorld, content: Content, hen: DeepReadonly<Hen>, viewer: CharacterId, namesQuest = HEN_NAMES_QUEST): string {
  return henNameVisible(world, hen, viewer, namesQuest) ? hen.name : henUnknown(content, hen.variant);
}
