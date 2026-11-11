/**
 * Contrôle des suites de quêtes et des scènes au chargement (technique 3.3): toute référence
 * existe, et aucune suite ne peut se bloquer. Une étape bloque si elle ne s'ouvre jamais (`after`
 * inconnu ou en boucle), si une condition est impossible (objet, habitant, point, dialogue ou scène
 * inconnus; plage d'heure vide; fait qu'aucune donnée n'écrit; deux valeurs exigées pour un même
 * fait; scène que rien ne lance; étape attendue qui vient après), ou si un objet à remettre n'a
 * personne à qui parler.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type {
  QuestLineDef,
  QuestStepDef,
  StepCondition,
  StepEffect,
} from '../../donnees/schemas/quete';
import type { Condition, Effect, FactValue } from '../../donnees/schemas/regles';
import type { SceneDef } from '../../donnees/schemas/scene';
import { firstBuyKey, shopFacts, soldKey } from '../commerces/faits';
import { checkAgreementTags } from '../dialogues/accords';
import { housingFacts } from '../logement/faits';
import { playerFactKey } from '../regles/memoire';
import { isStoryCondition } from './conditions';
import { decisionKey, previousDecisionKey } from './decisions';
import { OBJECTIVE_TOKENS } from './lecture';
import { prerequisites } from './moteur';

/** Les contrôles de référence des conditions et effets communs (`donnees/valider.ts`). */
export interface BaseCheckers {
  condition(content: Content, c: Condition, at: string, problems: string[]): void;
  effect(content: Content, e: Effect, at: string, problems: string[]): void;
}

interface Env {
  readonly content: Content;
  readonly place: PlaceContent;
  readonly base: BaseCheckers;
  /** Valeurs des faits que le jeu peut écrire, par clé (`collectFacts`). */
  readonly facts: ReadonlyMap<string, FactValues>;
  /** Familles de faits contrôlées (`checkedHeads`). */
  readonly heads: ReadonlySet<string>;
  /** Scènes lancées par un effet `play_scene` du lieu. */
  readonly played: ReadonlySet<string>;
  /** Écrans de fin de chapitre du lieu déjà vus, et où. */
  readonly endings: Map<string, string>;
  readonly problems: string[];
}

/** Ce que l'étape attend d'une autre étape de sa propre suite: elle doit venir avant. */
interface StepScope {
  readonly quest: QuestLineDef;
  /** Étapes forcément franchies avant celle-ci. */
  readonly before: ReadonlySet<string>;
}

/** Parcourt toutes les données à la recherche d'un motif (effets `remember`, `play_scene`). */
function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) for (const v of value) walk(v, visit);
  else if (typeof value === 'object' && value !== null) {
    const node = value as Record<string, unknown>;
    visit(node);
    for (const v of Object.values(node)) walk(v, visit);
  }
}

/** Valeurs possibles d'un fait; `null`: un compteur, toute valeur numérique. */
type FactValues = ReadonlySet<FactValue> | null;

/**
 * Faits que le jeu peut écrire: effets `remember` et `bump` des données (avec `of: "actor"`, la clé
 * de chacun des deux joueurs), et faits du moteur qui se déduisent des données: sortie d'une
 * prise unique, faits écrits par les événements du calendrier, pièces et confort des logements, décisions à deux déclarées par
 * les étapes (et le souvenir de la précédente si elle se rouvre), achats et ventes des commerces.
 */
function collectFacts(content: Content): Map<string, FactValues> {
  const facts = new Map<string, FactValues>();
  const add = (key: string, values: FactValues): void => {
    const known = facts.get(key);
    if (known === null || values === null) facts.set(key, null);
    else facts.set(key, new Set([...(known ?? []), ...values]));
  };
  walk([content.items, content.props, content.places], (node) => {
    if ((node.type !== 'remember' && node.type !== 'bump') || typeof node.key !== 'string') return;
    const value = node.value;
    let values: FactValues;
    if (node.type === 'bump') values = null;
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      values = new Set([value]);
    else return;
    const key = node.key;
    if (node.of === 'actor') for (const p of [0, 1] as const) add(playerFactKey(key, p), values);
    else add(key, values);
  });
  // Faits écrits par la pêche à la sortie d'une prise unique (`unique.fact`).
  for (const def of Object.values(content.catches))
    if (def.unique !== undefined) add(def.unique.fact, new Set([true]));
  // Faits écrits par le calendrier au début de chaque événement (`activates.facts`).
  for (const list of Object.values(content.time.events))
    for (const event of list)
      for (const fact of event.activates.facts) add(fact.key, new Set([fact.value]));
  for (const place of Object.values(content.places)) {
    for (const def of Object.values(place.housings))
      for (const [key, values] of housingFacts(place.def.id, def)) add(key, values);
    for (const shop of Object.values(place.shops))
      for (const [key, values] of shopFacts(content, shop)) add(key, values);
    for (const line of Object.values(place.quests))
      for (const chapter of line.chapters)
        for (const step of chapter.steps) {
          if (step.decision === undefined) continue;
          const options = new Set<FactValue>(step.decision.options);
          add(decisionKey(step.decision.id), options);
          for (const p of [0, 1] as const) add(decisionKey(step.decision.id, p), options);
          if (step.decision.reopens !== undefined)
            add(previousDecisionKey(step.decision.id), options);
        }
  }
  return facts;
}

/**
 * Familles de faits contrôlées: celles d'un lieu (`<lieu>.sujet`) et celles que le moteur écrit
 * d'après les données (décisions, commerces). Les autres (habitants, dialogues, souvenirs) ne
 * se contrôlent pas ici.
 */
function checkedHeads(content: Content): Set<string> {
  const heads = new Set(Object.keys(content.places));
  heads.add(decisionKey('x').split('.')[0] ?? '');
  heads.add(firstBuyKey('x').split('.')[0] ?? '');
  heads.add(soldKey('x', 'y').split('.')[0] ?? '');
  return heads;
}

function collectPlayed(place: PlaceContent): Set<string> {
  const played = new Set<string>();
  walk([place.quests, place.scenes], (node) => {
    if (node.type === 'play_scene' && typeof node.scene === 'string') played.add(node.scene);
  });
  return played;
}

function hasVillager(place: PlaceContent, id: string): boolean {
  return place.villagers.some((v) => v.id === id);
}

/** Faits d'un lieu (`<lieu>.sujet`): seule une donnée les écrit, il en faut une. */
function checkFact(env: Env, c: Condition, at: string): void {
  if (c.type === 'all' || c.type === 'any') {
    for (const inner of c.conditions) checkFact(env, inner, at);
    return;
  }
  if (c.type === 'time_is' && c.from === c.to)
    env.problems.push(`${at}: condition impossible, plage d'heure vide (${String(c.from)})`);
  if (c.type !== 'remembered' && c.type !== 'days_since' && c.type !== 'fact_at_least') return;
  const head = c.key.split('.')[0] ?? '';
  if (!env.heads.has(head)) return;
  const key = c.of === undefined ? c.key : playerFactKey(c.key, 0);
  const values = env.facts.get(key);
  if (values === undefined) {
    env.problems.push(`${at}: condition impossible, aucune donnée n'écrit le fait « ${key} »`);
    return;
  }
  if (values === null) return;
  if (c.type === 'remembered' && c.equals !== undefined && !values.has(c.equals))
    env.problems.push(
      `${at}: condition impossible, le fait « ${key} » ne vaut jamais ${JSON.stringify(c.equals)}`,
    );
  if (c.type === 'fact_at_least' && ![...values].some((x) => typeof x === 'number'))
    env.problems.push(`${at}: condition impossible, le fait « ${key} » n'est jamais un nombre`);
}

function checkCondition(env: Env, c: StepCondition, at: string, scope: StepScope | null): void {
  const { place, problems } = env;
  if (!isStoryCondition(c)) {
    env.base.condition(env.content, c, at, problems);
    checkFact(env, c, at);
    return;
  }
  switch (c.type) {
    case 'deliver':
      if (!(c.item in env.content.items)) problems.push(`${at}: objet inconnu « ${c.item} »`);
      if (!hasVillager(place, c.villager))
        problems.push(`${at}: habitant inconnu « ${c.villager} »`);
      else if (!place.dialogues.some((d) => d.villager === c.villager))
        problems.push(
          `${at}: objet à remettre à « ${c.villager} », qui n'a aucun dialogue pour l'ouvrir`,
        );
      return;
    case 'reach':
      if (!(c.point in place.map.points)) problems.push(`${at}: point inconnu « ${c.point} »`);
      return;
    case 'talked': {
      const dialogue = place.dialogues.find((d) => d.id === c.dialogue);
      if (dialogue === undefined) problems.push(`${at}: dialogue inconnu « ${c.dialogue} »`);
      else if (c.node !== undefined && !(c.node in dialogue.nodes))
        problems.push(`${at}: nœud « ${c.node} » absent du dialogue « ${c.dialogue} »`);
      return;
    }
    case 'together':
      return;
    case 'posture': {
      // Sans meuble qui porte la brique dans le lieu, personne ne peut prendre la posture.
      const offered = place.map.objects.some(
        (o) => env.content.props[o.type]?.bricks.some((b) => b.brick === c.posture) === true,
      );
      if (!offered)
        problems.push(
          `${at}: condition impossible, aucun meuble du lieu n'a la brique « ${c.posture} »`,
        );
      return;
    }
    case 'scene_seen': {
      const scene = place.scenes[c.scene];
      if (scene === undefined) problems.push(`${at}: scène inconnue « ${c.scene} »`);
      else if (scene.trigger === null && !env.played.has(c.scene))
        problems.push(`${at}: condition impossible, rien ne lance la scène « ${c.scene} »`);
      return;
    }
    case 'quest_step': {
      const line = Object.values(env.content.places)
        .map((p) => p.quests[c.quest])
        .find((q) => q !== undefined);
      if (line === undefined) {
        problems.push(`${at}: suite inconnue « ${c.quest} »`);
        return;
      }
      if (
        c.step !== undefined &&
        !line.chapters.some((ch) => ch.steps.some((s) => s.id === c.step))
      )
        problems.push(`${at}: étape « ${c.step} » absente de la suite « ${c.quest} »`);
      if (scope !== null && line.id === scope.quest.id) {
        if (c.step === undefined || !scope.before.has(c.step))
          problems.push(`${at}: blocage, l'étape attend « ${c.step ?? c.quest} » qui vient après`);
      }
      return;
    }
  }
}

/** Deux valeurs exigées pour un même fait dans une seule liste « toutes vraies ». */
function checkContradictions(env: Env, conditions: readonly StepCondition[], at: string): void {
  const wanted = new Map<string, FactValue>();
  for (const c of conditions) {
    if (c.type !== 'remembered' || c.equals === undefined) continue;
    const id = c.of === undefined ? c.key : `${c.key} (${c.of})`;
    const other = wanted.get(id);
    if (other !== undefined && other !== c.equals)
      env.problems.push(`${at}: condition impossible, « ${id} » exigé à deux valeurs`);
    wanted.set(id, c.equals);
  }
}

function checkConditions(
  env: Env,
  conditions: readonly StepCondition[],
  at: string,
  scope: StepScope | null,
): void {
  for (const c of conditions) checkCondition(env, c, at, scope);
  checkContradictions(env, conditions, at);
}

function checkEffects(env: Env, effects: readonly StepEffect[], at: string): void {
  const { place, problems } = env;
  for (const e of effects) {
    switch (e.type) {
      case 'unlock_zone':
        break;
      case 'villager_arrives':
        if (!hasVillager(place, e.villager))
          problems.push(`${at}: habitant inconnu « ${e.villager} »`);
        break;
      case 'open_quest':
        if (!(e.quest in place.quests)) problems.push(`${at}: suite inconnue « ${e.quest} »`);
        break;
      case 'play_scene':
        if (!(e.scene in place.scenes)) problems.push(`${at}: scène inconnue « ${e.scene} »`);
        break;
      case 'travel_to':
        if (e.place === place.def.id) problems.push(`${at}: départ vers le lieu même`);
        if (!(e.place in env.content.places) && e.ending === undefined)
          problems.push(
            `${at}: lieu « ${e.place} » absent du jeu et pas d'écran de fin (\`ending\`)`,
          );
        if (e.ending !== undefined) {
          for (const problem of e.ending.lines.flatMap((line) => checkAgreementTags(line)))
            problems.push(`${at}: ${problem}`);
          const first = env.endings.get(e.ending.id);
          if (first !== undefined && first !== at)
            problems.push(`${at}: écran de fin « ${e.ending.id} » déjà décrit à ${first}`);
          env.endings.set(e.ending.id, at);
        }
        break;
      case 'remember':
      case 'bump':
      case 'give_item':
      case 'take_item':
      case 'give_money':
      case 'take_money':
      case 'change_bond':
      case 'change_need':
      case 'give_bag':
      case 'open_shop':
      case 'give_recipe':
      case 'give_plan':
      case 'give_entry':
      case 'give_piece':
      case 'choose':
      case 'reveal_look':
      case 'tune_instrument':
      case 'adopt_animal':
        env.base.effect(env.content, e, at, problems);
    }
  }
}

/** Un dialogue du lieu offre-t-il de choisir cette option (effet `choose`) ? */
function offersChoice(place: PlaceContent, decision: string, option: string): boolean {
  const chooses = (effects: readonly Effect[]): boolean =>
    effects.some((e) => e.type === 'choose' && e.decision === decision && e.option === option);
  return place.dialogues.some((d) =>
    Object.values(d.nodes).some(
      (node) =>
        (node.kind === 'choice' && node.options.some((o) => chooses(o.effects))) ||
        (node.kind === 'effects' && chooses(node.effects)),
    ),
  );
}

/** Étape à décision à deux: identifiant unique, options distinctes et offertes, accord attendu. */
function checkDecisionStep(env: Env, step: QuestStepDef, where: string): void {
  const { place, problems } = env;
  const decision = step.decision;
  if (decision === undefined) return;
  let declared = 0;
  for (const other of Object.values(env.content.places))
    for (const line of Object.values(other.quests))
      for (const chapter of line.chapters)
        for (const s of chapter.steps) if (s.decision?.id === decision.id) declared += 1;
  if (declared > 1)
    problems.push(`${where}: décision « ${decision.id} » déclarée par plusieurs étapes`);
  if (new Set(decision.options).size !== decision.options.length)
    problems.push(`${where}: décision « ${decision.id} », option en double`);
  for (const option of decision.options)
    if (!offersChoice(place, decision.id, option))
      problems.push(
        `${where}: décision « ${decision.id} », aucun dialogue du lieu n'offre l'option « ${option} » (effet \`choose\`)`,
      );
  if (
    !step.done.some(
      (c) => c.type === 'decision_is' && c.decision === decision.id && c.state === 'agreed',
    )
  )
    problems.push(
      `${where}: l'étape déclare la décision « ${decision.id} » sans attendre l'accord (\`decision_is\`, \`agreed\`)`,
    );
}

function checkQuest(env: Env, line: QuestLineDef): void {
  const { place, problems } = env;
  const at = `lieu ${place.def.id}, quête ${line.id}`;
  if (line.giver !== null && !hasVillager(place, line.giver))
    problems.push(`${at}: habitant inconnu « ${line.giver} »`);
  checkConditions(env, line.requires, at, null);
  const seen = new Set<string>();
  const earlier = new Set<string>();
  for (const chapter of line.chapters) {
    const ids = chapter.steps.map((s) => s.id);
    // Ouverture simulée: une étape jamais ouverte est une étape sans issue.
    const opened = new Set<string>();
    const before = new Map<string, Set<string>>();
    for (let changed = true; changed;) {
      changed = false;
      chapter.steps.forEach((step, i) => {
        if (opened.has(step.id)) return;
        const needs = prerequisites(chapter, i);
        if (!needs.every((id) => opened.has(id))) return;
        const set = new Set(earlier);
        for (const id of needs) for (const b of [id, ...(before.get(id) ?? [])]) set.add(b);
        before.set(step.id, set);
        opened.add(step.id);
        changed = true;
      });
    }
    chapter.steps.forEach((step) => {
      const where = `${at}, étape ${step.id}`;
      if (seen.has(step.id)) problems.push(`${where}: identifiant en double`);
      seen.add(step.id);
      for (const id of step.after ?? []) {
        if (id === step.id) problems.push(`${where}: \`after\` se cite elle-même`);
        else if (!ids.includes(id))
          problems.push(`${where}: \`after\` cite « ${id} », absente de l'acte ${chapter.id}`);
      }
      if (!opened.has(step.id))
        problems.push(`${where}: étape sans issue, elle ne s'ouvre jamais (\`after\` en boucle)`);
      if (step.target !== null) {
        if ('point' in step.target && !(step.target.point in place.map.points))
          problems.push(`${where}: point inconnu « ${step.target.point} »`);
        if ('villager' in step.target && !hasVillager(place, step.target.villager))
          problems.push(`${where}: habitant inconnu « ${step.target.villager} »`);
      }
      checkConditions(env, step.done, where, {
        quest: line,
        before: before.get(step.id) ?? earlier,
      });
      checkEffects(env, [...step.onStart, ...step.onDone], where);
      if (step.decision !== undefined) checkDecisionStep(env, step, where);
      for (const problem of checkAgreementTags(step.objective))
        problems.push(`${where}: ${problem}`);
      for (const token of step.objective.match(/\{[^}]*\}/g) ?? [])
        if (!(token in OBJECTIVE_TOKENS))
          problems.push(`${where}: mot à remplacer inconnu « ${token} » dans l'objectif`);
    });
    for (const id of ids) earlier.add(id);
  }
}

function checkScene(env: Env, scene: SceneDef): void {
  const { place, problems } = env;
  const at = `lieu ${place.def.id}, scène ${scene.id}`;
  const roles = scene.roles !== null;
  const actor = (who: string, where: string): void => {
    if (who === 'narrator') return;
    if (who === 'a' || who === 'b') {
      if (!roles) problems.push(`${where}: rôle « ${who} » dans une scène sans \`roles\``);
      return;
    }
    if (!hasVillager(place, who)) problems.push(`${where}: habitant inconnu « ${who} »`);
  };
  if (scene.trigger !== null) checkConditions(env, scene.trigger.when, `${at}, déclencheur`, null);
  scene.beats.forEach((beat, i) => {
    const where = `${at}, temps ${String(i)}`;
    switch (beat.do) {
      case 'say':
        actor(beat.who, where);
        if (beat.to !== 'both' && !roles)
          problems.push(`${where}: réplique pour « ${beat.to} » dans une scène sans \`roles\``);
        for (const problem of checkAgreementTags(beat.text)) problems.push(`${where}: ${problem}`);
        return;
      case 'emote':
        actor(beat.who, where);
        return;
      case 'walk':
        actor(beat.who, where);
        if (!(beat.to in place.map.points)) problems.push(`${where}: point inconnu « ${beat.to} »`);
        return;
      case 'camera':
        if ('point' in beat.focus && !(beat.focus.point in place.map.points))
          problems.push(`${where}: point inconnu « ${beat.focus.point} »`);
        if ('villager' in beat.focus && !hasVillager(place, beat.focus.villager))
          problems.push(`${where}: habitant inconnu « ${beat.focus.villager} »`);
        return;
      case 'await':
        for (const part of beat.parts) {
          if (part.role !== 'any' && !roles)
            problems.push(`${where}: rôle « ${part.role} » dans une scène sans \`roles\``);
          checkConditions(env, part.done, where, null);
          const gesture = part.gesture;
          if (gesture === undefined) {
            if (part.done.length === 0) problems.push(`${where}: partie sans condition ni geste`);
            continue;
          }
          if (part.role === 'any') problems.push(`${where}: un geste se confie à un rôle (a ou b)`);
          if (gesture.type === 'stand' && !(gesture.point in place.map.points))
            problems.push(`${where}: point inconnu « ${gesture.point} »`);
        }
        if (beat.together !== undefined && !beat.parts.some((p) => p.gesture !== undefined))
          problems.push(`${where}: \`together\` sans geste`);
        return;
      case 'effects':
        checkEffects(env, beat.effects, where);
        return;
      case 'fade':
      case 'wait':
        return;
    }
  });
}

/** Les suites d'une même histoire (`saga`) ont le même titre et chacune son numéro d'acte. */
function checkSagas(content: Content, problems: string[]): void {
  const sagas = new Map<string, { title: string; acts: Map<number, string> }>();
  for (const place of Object.values(content.places))
    for (const line of Object.values(place.quests)) {
      const saga = line.saga;
      if (saga === undefined) continue;
      const at = `lieu ${place.def.id}, quête ${line.id}`;
      const known = sagas.get(saga.id) ?? { title: saga.title, acts: new Map<number, string>() };
      sagas.set(saga.id, known);
      if (known.title !== saga.title)
        problems.push(`${at}: histoire « ${saga.id} » déjà titrée « ${known.title} »`);
      const other = known.acts.get(saga.act);
      if (other !== undefined)
        problems.push(`${at}: acte ${String(saga.act)} de « ${saga.id} » déjà tenu par ${other}`);
      known.acts.set(saga.act, line.id);
    }
}

export function validateStory(content: Content, base: BaseCheckers): string[] {
  const problems: string[] = [];
  const facts = collectFacts(content);
  const heads = checkedHeads(content);
  const owner = new Map<string, string>();
  for (const place of Object.values(content.places)) {
    const env: Env = {
      content,
      place,
      base,
      facts,
      heads,
      played: collectPlayed(place),
      endings: new Map(),
      problems,
    };
    for (const line of Object.values(place.quests)) {
      const first = owner.get(line.id);
      if (first !== undefined)
        problems.push(`lieu ${place.def.id}, quête ${line.id}: identifiant déjà pris à ${first}`);
      owner.set(line.id, place.def.id);
      checkQuest(env, line);
    }
    for (const scene of Object.values(place.scenes)) checkScene(env, scene);
  }
  checkSagas(content, problems);
  return problems;
}
