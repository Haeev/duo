/**
 * Contrôles de cohérence entre fichiers (les schémas contrôlent chaque fichier seul): toute
 * référence existe, tout graphe de dialogue est parcourable, aucun geste courant ne dépasse la
 * durée permise. Renvoie la liste des problèmes, vide si tout va bien.
 */
import type { Content, PlaceContent } from './charger';
import { NEED_IDS } from './schemas/communs';
import type { DialogueDef } from './schemas/dialogue';
import type { Condition, Effect } from './schemas/regles';

function checkCondition(content: Content, c: Condition, at: string, problems: string[]): void {
  switch (c.type) {
    case 'all':
    case 'any':
      for (const inner of c.conditions) checkCondition(content, inner, at, problems);
      return;
    case 'not':
      checkCondition(content, c.condition, at, problems);
      return;
    case 'item_in_bag':
      if (!(c.item in content.items)) problems.push(`${at}: objet inconnu « ${c.item} »`);
      return;
    case 'place_is':
      if (!(c.place in content.places)) problems.push(`${at}: lieu inconnu « ${c.place} »`);
      return;
    case 'remembered':
    case 'need_at_least':
    case 'time_is':
      return;
  }
}

function checkEffect(content: Content, e: Effect, at: string, problems: string[]): void {
  switch (e.type) {
    case 'give_item':
    case 'take_item':
      if (!(e.item in content.items)) problems.push(`${at}: objet inconnu « ${e.item} »`);
      return;
    case 'give_bag':
      if (!content.bags.bags.some((b) => b.id === e.bag)) problems.push(`${at}: sac inconnu « ${e.bag} »`);
      return;
    case 'remember':
    case 'give_money':
    case 'change_need':
      return;
  }
}

function checkDialogue(content: Content, place: PlaceContent, d: DialogueDef, problems: string[]): void {
  const at = `lieu ${place.def.id}, dialogue ${d.id}`;
  const speakers = new Set(['player', ...place.villagers.map((v) => v.id)]);
  if (!place.villagers.some((v) => v.id === d.villager)) problems.push(`${at}: habitant inconnu « ${d.villager} »`);
  for (const c of d.when) checkCondition(content, c, at, problems);
  if (!(d.start in d.nodes)) {
    problems.push(`${at}: nœud de départ « ${d.start} » absent`);
    return;
  }
  const { maxChars, maxOptions } = content.settings.dialogue;
  const nextOf = (id: string): (string | null)[] => {
    const node = d.nodes[id];
    if (node === undefined) return [];
    switch (node.kind) {
      case 'line':
      case 'effects':
        return [node.next];
      case 'choice':
        return node.options.map((o) => o.next);
      case 'branch':
        return [...node.cases.map((c) => c.next), node.otherwise];
    }
  };
  for (const [id, node] of Object.entries(d.nodes)) {
    const where = `${at}, nœud ${id}`;
    for (const next of nextOf(id)) {
      if (next !== null && !(next in d.nodes)) problems.push(`${where}: suite « ${next} » absente`);
    }
    switch (node.kind) {
      case 'line':
        if (!speakers.has(node.speaker)) problems.push(`${where}: locuteur inconnu « ${node.speaker} »`);
        if (node.text.length > maxChars) problems.push(`${where}: réplique de ${node.text.length} caractères (${maxChars} au plus, trois lignes)`);
        break;
      case 'choice': {
        if (node.options.length > maxOptions) problems.push(`${where}: ${node.options.length} options (${maxOptions} au plus)`);
        // Un choix dont toutes les options sont sous condition peut laisser le joueur sans issue.
        if (node.options.every((o) => o.when.length > 0)) problems.push(`${where}: aucune option sans condition`);
        for (const o of node.options) {
          for (const c of o.when) checkCondition(content, c, where, problems);
          for (const e of o.effects) checkEffect(content, e, where, problems);
        }
        break;
      }
      case 'branch':
        for (const c of node.cases) for (const w of c.when) checkCondition(content, w, where, problems);
        break;
      case 'effects':
        for (const e of node.effects) checkEffect(content, e, where, problems);
        break;
    }
  }
  // Tout nœud est atteignable depuis le départ, et aucun parcours ne tourne sans fin.
  const seen = new Set<string>();
  const stack = [d.start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    for (const next of nextOf(id)) if (next !== null && next in d.nodes) stack.push(next);
  }
  for (const id of Object.keys(d.nodes)) if (!seen.has(id)) problems.push(`${at}: nœud « ${id} » jamais atteint`);
  const state = new Map<string, 'open' | 'done'>();
  const loops = (id: string): boolean => {
    const s = state.get(id);
    if (s === 'done') return false;
    if (s === 'open') return true;
    state.set(id, 'open');
    for (const next of nextOf(id)) if (next !== null && next in d.nodes && loops(next)) return true;
    state.set(id, 'done');
    return false;
  };
  if (loops(d.start)) problems.push(`${at}: le graphe boucle (un dialogue doit toujours finir)`);
}

function checkPlace(content: Content, place: PlaceContent, problems: string[]): void {
  const { def, map } = place;
  const at = `lieu ${def.id}`;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= map.width && y <= map.height;
  const blockedAt = (x: number, y: number): boolean =>
    map.blocked.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ||
    map.objects.some((o) => o.blocks !== null && x >= o.blocks.x && x < o.blocks.x + o.blocks.w && y >= o.blocks.y && y < o.blocks.y + o.blocks.h);
  for (const key of ['arrival', 'platform'] as const) {
    if (!(def.station[key] in map.points)) problems.push(`${at}: point de gare « ${def.station[key]} » absent de la carte`);
  }
  for (const [id, p] of Object.entries(map.points)) {
    if (!inside(p.x, p.y)) problems.push(`${at}: point « ${id} » hors de la carte`);
    else if (blockedAt(p.x, p.y)) problems.push(`${at}: point « ${id} » dans une zone bloquée`);
  }
  for (const link of def.links) {
    const other = content.places[link];
    if (other === undefined) problems.push(`${at}: lieu relié inconnu « ${link} »`);
    else if (!other.def.links.includes(def.id)) problems.push(`${at}: le lien vers « ${link} » n'est pas écrit dans l'autre sens`);
  }
  const objectIds = new Set<string>();
  for (const o of map.objects) {
    const where = `${at}, objet ${o.id}`;
    if (objectIds.has(o.id)) problems.push(`${where}: identifiant en double`);
    objectIds.add(o.id);
    if (!inside(o.x, o.y)) problems.push(`${where}: hors de la carte`);
    if (o.use === null) continue;
    if (!o.use.long && o.use.seconds > content.settings.gestures.maxSeconds) {
      problems.push(`${where}: geste de ${o.use.seconds} s (au plus ${content.settings.gestures.maxSeconds} s, ou \`long: true\`)`);
    }
    for (const c of o.use.when) checkCondition(content, c, where, problems);
    for (const e of o.use.effects) checkEffect(content, e, where, problems);
  }
  const villagerIds = new Set<string>();
  for (const villager of place.villagers) {
    if (villagerIds.has(villager.id)) problems.push(`${at}: habitant « ${villager.id} » en double`);
    villagerIds.add(villager.id);
    if (!(villager.stands in map.points)) problems.push(`${at}, habitant ${villager.id}: point « ${villager.stands} » absent de la carte`);
  }
  const dialogueIds = new Set<string>();
  for (const d of place.dialogues) {
    if (dialogueIds.has(d.id)) problems.push(`${at}: dialogue « ${d.id} » en double`);
    dialogueIds.add(d.id);
    checkDialogue(content, place, d, problems);
  }
}

export function validateContent(content: Content): string[] {
  const problems: string[] = [];
  const { settings, needs, bags } = content;
  if (!(settings.start.place in content.places)) problems.push(`commun/reglages.json: lieu de départ inconnu « ${settings.start.place} »`);
  if (settings.movement.runSpeed < settings.movement.walkSpeed) problems.push('commun/reglages.json: la course est plus lente que la marche');
  for (const id of NEED_IDS) {
    const need = needs.needs.find((n) => n.id === id);
    if (need === undefined) {
      problems.push(`commun/besoins.json: besoin « ${id} » absent`);
      continue;
    }
    if (need.tiers[0]?.from !== 0) problems.push(`commun/besoins.json, ${id}: le premier palier doit commencer à 0`);
    for (let i = 1; i < need.tiers.length; i++) {
      const before = need.tiers[i - 1];
      const tier = need.tiers[i];
      if (before !== undefined && tier !== undefined && tier.from <= before.from) problems.push(`commun/besoins.json, ${id}: paliers à ranger par seuil croissant`);
    }
  }
  for (let i = 1; i < bags.bags.length; i++) {
    const before = bags.bags[i - 1];
    const bag = bags.bags[i];
    if (before !== undefined && bag !== undefined && bag.slots <= before.slots) problems.push(`commun/sacs.json: sacs à ranger du plus petit au plus grand (« ${bag.id} »)`);
  }
  for (const item of Object.values(content.items)) {
    if (item.tool !== null && item.stack !== 1) problems.push(`commun/objets.json, ${item.id}: un outil ne s'empile pas`);
    if ((item.family === 'tool') !== (item.tool !== null)) problems.push(`commun/objets.json, ${item.id}: famille « tool » et champ \`tool\` vont ensemble`);
  }
  for (const place of Object.values(content.places)) checkPlace(content, place, problems);
  return problems;
}
