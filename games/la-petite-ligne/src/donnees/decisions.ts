/**
 * Décisions à deux (0.13, conception `v0-13-habitants.md`, section 5.2; `decisions.json`): un
 * habitant pose une question, chaque joueur choisit une option, et la décision se prend quand les
 * deux ont choisi la même. Chaque option réussit et rapporte autant: seules la suite et les
 * habitudes changent (HA-08 bis).
 */
import { ContentError, type Reader } from './lecteur';
import type { Effect } from './types';

export interface DecisionOptionDef {
  id: string;
  /** Le choix, en quelques mots (« Tout de suite. »). */
  label: string;
  /** Ce que ce choix change, en une ligne. */
  change: string;
  /** Le dessin de l'option (symbole de `ui-maquettes/icones.svg`). */
  icon: string;
  /** Les habitants que ce choix touche, en portraits à côté du dessin. */
  villagers: string[];
  /** Effets appliqués quand la décision est prise avec cette option (drapeaux surtout). */
  effects: Effect[];
}

export interface DecisionDef {
  id: string;
  /** L'habitant qui pose la question (son portrait en tête du panneau). */
  villager: string;
  question: string;
  /** Deux ou trois options. */
  options: DecisionOptionDef[];
}

export interface DecisionsContent {
  /** Délai entre l'accord et la décision prise (le tampon tombe), en secondes. */
  agreeSeconds: number;
  list: DecisionDef[];
}

export const NO_DECISIONS: DecisionsContent = { agreeSeconds: 2, list: [] };

/** Lit `decisions.json` (`parseEffect`: le lecteur d'effets du contenu, passé pour éviter un cycle d'import). */
export function parseDecisions(r: Reader, parseEffect: (e: Reader) => Effect): DecisionsContent {
  const agree = r.opt('agreeSeconds');
  const list = r
    .at('decisions')
    .items()
    .map((d): DecisionDef => {
      const options = d.at('options').items();
      if (options.length < 2 || options.length > 3) d.at('options').fail('deux ou trois options attendues');
      return {
        id: d.at('id').string(),
        villager: d.at('villager').string(),
        question: d.at('question').string(),
        options: options.map((o) => ({
          id: o.at('id').string(),
          label: o.at('label').string(),
          change: o.at('change').string(),
          icon: o.at('icon').string(),
          villagers: o.opt('villagers')?.stringList() ?? [],
          effects: o.opt('effects')?.items().map(parseEffect) ?? [],
        })),
      };
    });
  const ids = new Set<string>();
  for (const d of list) {
    if (ids.has(d.id)) throw new ContentError(`decisions.json: décision en double « ${d.id} »`);
    ids.add(d.id);
    if (new Set(d.options.map((o) => o.id)).size !== d.options.length) {
      throw new ContentError(`decisions.json: option en double dans « ${d.id} »`);
    }
  }
  return { agreeSeconds: agree === null ? NO_DECISIONS.agreeSeconds : agree.number(), list };
}

/** Les habitants cités par les décisions existent (appelé une fois les habitants lus). */
export function checkDecisionVillagers(decisions: DecisionsContent, villagers: readonly { id: string }[]): void {
  const known = new Set(villagers.map((v) => v.id));
  for (const d of decisions.list) {
    for (const id of [d.villager, ...d.options.flatMap((o) => o.villagers)]) {
      if (!known.has(id)) throw new ContentError(`decisions.json: habitant inconnu « ${id} » (${d.id})`);
    }
  }
}

export function decisionDef(decisions: DecisionsContent, id: string): DecisionDef | undefined {
  return decisions.list.find((d) => d.id === id);
}
