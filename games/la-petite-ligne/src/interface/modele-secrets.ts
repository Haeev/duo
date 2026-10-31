/**
 * Informations propres (R16) vues de l'interface: la fiche du carnet selon le rôle, et le choix
 * « Appeler » d'une poule. Fonctions pures (aucun DOM), testées dans Node. Règle commune: rien
 * ici ne lit le contenu d'un secret ailleurs que dans `secretCards` de `etat/secrets.ts`, qui ne
 * le donne qu'à qui peut le lire (S-02).
 */
import { type SecretCard, henColor, henUnknown, secretOf } from '../etat/secrets';
import type { ReadonlyWorld } from '../etat/types';
import { UI_SETTINGS } from './config';
import { type UiContext, characterOf, nameOf } from './contexte';
import { capitalize } from './format';

// ---------------------------------------------------------------------------
// Fiche du carnet

/**
 * `mine`: l'informé lit le secret (« Rien que pour toi »), avec le coup de coude s'il a été
 * donné; `shared`: le secret est chez les deux (fin de la quête); `ask`: l'autre sait qu'une
 * fiche existe chez son partenaire, sans rien en lire.
 */
export type SecretView =
  | { kind: 'mine'; chip: string; title: string; lines: string[]; help: string; nudge: string | null }
  | { kind: 'shared'; chip: string; title: string; lines: string[] }
  | { kind: 'ask'; chip: string; title: string; text: string };

/**
 * La fiche de cette quête pour ce joueur, ou `null`. `cards`: `secretCards(world, content, me)`,
 * les seules fiches lisibles par ce joueur. L'autre ne reçoit sa fiche « Demande-lui » qu'une
 * fois l'informé au courant (`revealed`), et plus rien une fois la quête finie.
 */
export function secretViewOf(world: ReadonlyWorld, ctx: UiContext, quest: string, done: boolean, cards: readonly SecretCard[]): SecretView | null {
  const entry = secretOf(world, quest);
  if (entry === null) return null;
  const s = ctx.texts.extra.secrets;
  const partner = { partner: nameOf(world, ctx.partner) };
  const card = cards.find((k) => k.quest === quest) ?? null;
  if (card !== null && entry.shared) return { kind: 'shared', chip: ctx.t(s.sharedChip), title: ctx.t(card.title), lines: card.lines.map((l) => ctx.t(l)) };
  if (card !== null && entry.informed === ctx.me) {
    return {
      kind: 'mine',
      chip: ctx.t(ctx.texts.game.ui.secretCard),
      title: ctx.t(card.title),
      lines: card.lines.map((l) => ctx.t(l)),
      help: done ? '' : ctx.t(s.mineHelp, partner),
      nudge: entry.nudged && !done ? ctx.t(s.nudge, partner) : null,
    };
  }
  if (entry.doer === ctx.me && entry.revealed && !entry.shared && !done) {
    return { kind: 'ask', chip: ctx.t(s.askChip, partner), title: ctx.t(s.askTitle, partner), text: ctx.t(s.askText, partner) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Appeler une poule

export interface HenCallChoice {
  /** Identifiant du choix de la simulation (`name:<i>` ou `leave`). */
  id: string;
  text: string;
  /** « Laisser »: hors de la liste des noms. */
  leave: boolean;
  /** Nom déjà donné à une autre poule (connu des deux): sa couleur, et le choix est grisé. */
  found: string | null;
}

export interface HenCallModel {
  hen: string;
  /** Variante de la poule appelée (`hen_white`...), pour la couleur de l'icône. */
  variant: string;
  title: string;
  /** « La poule rousse »: ce que voit celui qui ne connaît pas encore son nom. */
  label: string;
  question: string;
  choices: HenCallChoice[];
  help: string;
}

const NAME_CHOICE = /^name:(\d+)$/;

/** Le choix « Comment s'appelle... ? » ouvert chez ce joueur, ou `null`. */
export function henCallModel(world: ReadonlyWorld, ctx: UiContext): HenCallModel | null {
  const me = characterOf(world, ctx.me);
  const dlg = me?.dialogue ?? null;
  if (dlg?.dialogue !== UI_SETTINGS.henCallDialogue) return null;
  const hen = world.hens.find((h) => h.id === dlg.villager);
  if (hen === undefined) return null;
  const s = ctx.texts.extra.secrets;
  const choices = dlg.choices.map((c): HenCallChoice => {
    const index = NAME_CHOICE.exec(c.id)?.[1];
    const named = index === undefined ? undefined : world.hens[Number(index)];
    const found = named !== undefined && named.namedBy !== null ? ctx.t(s.henFound, { color: henColor(ctx.content, named.variant) }) : null;
    return { id: c.id, text: ctx.t(c.text), leave: index === undefined, found };
  });
  return {
    hen: hen.id,
    variant: hen.variant,
    title: ctx.t(s.henCallTitle),
    label: ctx.t(capitalize(henUnknown(ctx.content, hen.variant))),
    question: ctx.t(dlg.lines[dlg.lines.length - 1]?.text ?? ''),
    choices,
    help: ctx.t(s.henCallHelp, { partner: nameOf(world, ctx.partner) }),
  };
}

/** Réplique amusée de la poule à un mauvais nom: varie d'une erreur à l'autre (par notification), sans hasard. */
export function henWrongAside(ctx: UiContext, notificationId: number): string {
  const list = ctx.texts.extra.secrets.henWrongAsides;
  return ctx.t(list[Math.abs(notificationId) % list.length] ?? '');
}
