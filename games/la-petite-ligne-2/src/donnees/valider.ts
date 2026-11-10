/**
 * Contrôles de cohérence entre fichiers (les schémas contrôlent chaque fichier seul): toute
 * référence existe, tout graphe de dialogue est parcourable, aucun geste courant ne dépasse la
 * durée permise. Renvoie la liste des problèmes, vide si tout va bien.
 */
import type { Content, PlaceContent } from './charger';
import type { ShopDef } from './schemas/commerce';
import { shopProblems } from '../simulation/commerces/validation';
import { NEED_IDS } from './schemas/communs';
import type { DialogueDef } from './schemas/dialogue';
import type { MapObject } from './schemas/lieu';
import type { PropDef } from './schemas/meuble';
import type { Look } from './schemas/personnage';
import type { QuestLineDef } from './schemas/quete';
import type { Condition, Effect } from './schemas/regles';
import { BOND_KEY_PREFIX_LENGTH } from '../etat/progression';
import { validateDialogueTexts } from '../simulation/dialogues/valider';

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
    case 'bond_at_least':
      if (!Object.values(content.places).some((p) => p.villagers.some((v) => v.id === c.villager)))
        problems.push(`${at}: habitant inconnu « ${c.villager} »`);
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
      if (!content.bags.bags.some((b) => b.id === e.bag))
        problems.push(`${at}: sac inconnu « ${e.bag} »`);
      return;
    case 'open_shop':
      return;
    case 'remember':
    case 'give_money':
    case 'change_need':
      return;
  }
}

function checkDialogue(
  content: Content,
  place: PlaceContent,
  d: DialogueDef,
  problems: string[],
): void {
  const at = `lieu ${place.def.id}, dialogue ${d.id}`;
  const speakers = new Set(['player', ...place.villagers.map((v) => v.id)]);
  if (!place.villagers.some((v) => v.id === d.villager))
    problems.push(`${at}: habitant inconnu « ${d.villager} »`);
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
        if (!speakers.has(node.speaker))
          problems.push(`${where}: locuteur inconnu « ${node.speaker} »`);
        if (node.text.length > maxChars)
          problems.push(
            `${where}: réplique de ${node.text.length} caractères (${maxChars} au plus, trois lignes)`,
          );
        break;
      case 'choice': {
        if (node.options.length > maxOptions)
          problems.push(`${where}: ${node.options.length} options (${maxOptions} au plus)`);
        // Un choix dont toutes les options sont sous condition peut laisser le joueur sans issue.
        if (node.options.every((o) => o.when.length > 0))
          problems.push(`${where}: aucune option sans condition`);
        for (const o of node.options) {
          for (const c of o.when) checkCondition(content, c, where, problems);
          for (const e of o.effects) checkEffect(content, e, where, problems);
        }
        break;
      }
      case 'branch':
        for (const c of node.cases)
          for (const w of c.when) checkCondition(content, w, where, problems);
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
  for (const id of Object.keys(d.nodes))
    if (!seen.has(id)) problems.push(`${at}: nœud « ${id} » jamais atteint`);
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

/** Emprise au sol d'un meuble posé, en mètres (la rotation d'un quart de tour échange largeur et profondeur). */
function footprint(
  content: Content,
  object: MapObject,
): { x: number; y: number; w: number; h: number; solid: boolean } | null {
  const prop = content.props[object.type];
  if (prop === undefined) return null;
  const turned = object.rotation % 2 === 1;
  const w = turned ? prop.size.h : prop.size.w;
  const h = turned ? prop.size.w : prop.size.h;
  return { x: object.x - w / 2, y: object.y - h / 2, w, h, solid: prop.solid };
}

function checkBricks(content: Content, prop: PropDef, problems: string[]): void {
  const at = `commun/meubles/${prop.id}.json`;
  const seen = new Set<string>();
  for (const brick of prop.bricks) {
    if (seen.has(brick.brick)) problems.push(`${at}: brique « ${brick.brick} » en double`);
    seen.add(brick.brick);
    if (brick.brick === 'gather') {
      if (!(brick.gives.item in content.items))
        problems.push(`${at}: objet inconnu « ${brick.gives.item} »`);
      if (brick.seconds > content.settings.gestures.maxSeconds)
        problems.push(
          `${at}: geste de ${brick.seconds} s (${content.settings.gestures.maxSeconds} s au plus)`,
        );
    }
    if (brick.brick === 'relieve' && brick.amount > brick.cap)
      problems.push(`${at}: \`amount\` dépasse \`cap\``);
  }
}

function checkQuest(
  content: Content,
  place: PlaceContent,
  quest: QuestLineDef,
  problems: string[],
): void {
  const at = `lieu ${place.def.id}, quête ${quest.id}`;
  const villagers = new Set(place.villagers.map((v) => v.id));
  if (quest.giver !== null && !villagers.has(quest.giver))
    problems.push(`${at}: habitant inconnu « ${quest.giver} »`);
  for (const c of quest.requires) checkCondition(content, c, at, problems);
  const steps = new Set<string>();
  for (const chapter of quest.chapters) {
    for (const step of chapter.steps) {
      const where = `${at}, étape ${step.id}`;
      if (steps.has(step.id)) problems.push(`${where}: identifiant en double`);
      steps.add(step.id);
      if (
        step.target !== null &&
        'point' in step.target &&
        !(step.target.point in place.map.points)
      )
        problems.push(`${where}: point inconnu « ${step.target.point} »`);
      if (step.target !== null && 'villager' in step.target && !villagers.has(step.target.villager))
        problems.push(`${where}: habitant inconnu « ${step.target.villager} »`);
      for (const c of step.done) checkCondition(content, c, where, problems);
      for (const e of [...step.onStart, ...step.onDone]) checkEffect(content, e, where, problems);
    }
  }
}

function checkShop(content: Content, place: PlaceContent, shop: ShopDef, problems: string[]): void {
  const at = `lieu ${place.def.id}, commerce ${shop.id}`;
  if (!place.villagers.some((v) => v.id === shop.keeper))
    problems.push(`${at}: habitant inconnu « ${shop.keeper} »`);
  for (const problem of shopProblems(content, shop)) problems.push(`${at}: ${problem}`);
}

function checkPlace(content: Content, place: PlaceContent, problems: string[]): void {
  const { def, map } = place;
  const at = `lieu ${def.id}`;
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x <= map.width && y <= map.height;
  const solids = map.objects.map((o) => footprint(content, o)).filter((f) => f?.solid === true);
  const blockedAt = (x: number, y: number): boolean =>
    map.blocked.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ||
    solids.some((f) => f !== null && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
  for (const key of ['arrival', 'platform'] as const) {
    if (!(def.station[key] in map.points))
      problems.push(`${at}: point de gare « ${def.station[key]} » absent de la carte`);
  }
  for (const [id, p] of Object.entries(map.points)) {
    if (!inside(p.x, p.y)) problems.push(`${at}: point « ${id} » hors de la carte`);
    else if (blockedAt(p.x, p.y)) problems.push(`${at}: point « ${id} » dans une zone bloquée`);
  }
  for (const link of def.links) {
    const other = content.places[link];
    if (other === undefined) problems.push(`${at}: lieu relié inconnu « ${link} »`);
    else if (!other.def.links.includes(def.id))
      problems.push(`${at}: le lien vers « ${link} » n'est pas écrit dans l'autre sens`);
  }
  const objectIds = new Set<string>();
  for (const o of map.objects) {
    const where = `${at}, objet ${o.id}`;
    if (objectIds.has(o.id)) problems.push(`${where}: identifiant en double`);
    if (o.id.startsWith('pose-'))
      problems.push(`${where}: le préfixe « pose- » est réservé aux meubles posés par les joueurs`);
    objectIds.add(o.id);
    const prop = content.props[o.type];
    if (prop === undefined) {
      problems.push(`${where}: meuble inconnu « ${o.type} »`);
      continue;
    }
    const f = footprint(content, o);
    if (f !== null && (!inside(f.x, f.y) || !inside(f.x + f.w, f.y + f.h)))
      problems.push(`${where}: hors de la carte`);
    for (const brick of prop.bricks) {
      if (brick.brick === 'shop' && !(brick.shop in place.shops))
        problems.push(`${where}: commerce inconnu « ${brick.shop} » dans ce lieu`);
    }
  }
  for (const villager of place.villagers) {
    // La clé d'amitié par joueur (`bondKey`) préfixe l'identifiant: il doit y tenir.
    if (villager.id.length + BOND_KEY_PREFIX_LENGTH > 40)
      problems.push(
        `${at}, habitant ${villager.id}: identifiant trop long (${String(40 - BOND_KEY_PREFIX_LENGTH)} caractères au plus)`,
      );
    if (!(villager.stands in map.points))
      problems.push(
        `${at}, habitant ${villager.id}: point « ${villager.stands} » absent de la carte`,
      );
    if (villager.look !== null)
      checkLook(content, villager.look, `${at}, habitant ${villager.id}`, problems);
  }
  for (const d of place.dialogues) checkDialogue(content, place, d, problems);
  for (const shop of Object.values(place.shops)) checkShop(content, place, shop, problems);
  for (const quest of Object.values(place.quests)) checkQuest(content, place, quest, problems);
}

function checkLook(content: Content, look: Look, at: string, problems: string[]): void {
  if (!content.catalogue.shapes.some((shape) => shape.id === look.shape))
    problems.push(`${at}: morphologie inconnue « ${look.shape} »`);
  const slots = new Set<string>();
  for (const worn of look.pieces) {
    const piece = content.pieces[worn.id];
    if (piece === undefined) problems.push(`${at}: pièce inconnue « ${worn.id} »`);
    else if (piece.slot !== worn.slot)
      problems.push(`${at}: la pièce « ${worn.id} » va à l'emplacement « ${piece.slot} »`);
    if (slots.has(worn.slot)) problems.push(`${at}: deux pièces à l'emplacement « ${worn.slot} »`);
    slots.add(worn.slot);
  }
}

export function validateContent(content: Content): string[] {
  const problems: string[] = [];
  const { settings, needs, bags } = content;
  const { catalogue, morphologies } = content;
  const personnages = 'commun/personnages';
  for (const shape of catalogue.shapes) {
    const morphs = morphologies.shapes[shape.id]?.morphs;
    if (morphs === undefined)
      problems.push(
        `${personnages}/morphologies.json: morphologie « ${shape.id} » du catalogue absente`,
      );
    // Chaque morphologie a une silhouette, femme ou homme: c'est elle que règle le genre du joueur.
    else if (morphs.includes('f') === morphs.includes('m'))
      problems.push(
        `${personnages}/morphologies.json, ${shape.id}: une silhouette et une seule (f ou m)`,
      );
  }
  for (const id of Object.keys(morphologies.shapes)) {
    if (!catalogue.shapes.some((shape) => shape.id === id))
      problems.push(`${personnages}/morphologies.json: morphologie « ${id} » absente du catalogue`);
  }
  for (const piece of catalogue.pieces) {
    for (const region of piece.covers) {
      if (!morphologies.regions.includes(region))
        problems.push(`${personnages}/catalogue.json, ${piece.id}: région inconnue « ${region} »`);
    }
    const colors = morphologies.defaults[piece.id];
    // Sans couleurs par défaut, une pièce prend la première couleur de chaque zone.
    if (colors !== undefined && colors.length !== piece.zones.length)
      problems.push(
        `${personnages}/morphologies.json, ${piece.id}: ${colors.length} couleurs par défaut pour ${piece.zones.length} zones`,
      );
  }
  for (const gender of ['f', 'm'] as const) {
    const id = settings.start.shapes[gender];
    const morphs = morphologies.shapes[id]?.morphs;
    if (morphs === undefined)
      problems.push(`commun/reglages.json: silhouette de départ inconnue « ${id} »`);
    else if (!morphs.includes(gender))
      problems.push(`commun/reglages.json: « ${id} » n'est pas une silhouette « ${gender} »`);
  }
  if (!(settings.start.place in content.places))
    problems.push(`commun/reglages.json: lieu de départ inconnu « ${settings.start.place} »`);
  if (settings.movement.runSpeed < settings.movement.walkSpeed)
    problems.push('commun/reglages.json: la course est plus lente que la marche');
  for (const id of NEED_IDS) {
    const need = needs.needs.find((n) => n.id === id);
    if (need === undefined) {
      problems.push(`commun/besoins.json: besoin « ${id} » absent`);
      continue;
    }
    if (need.tiers[0]?.from !== 0)
      problems.push(`commun/besoins.json, ${id}: le premier palier doit commencer à 0`);
    for (let i = 1; i < need.tiers.length; i++) {
      const before = need.tiers[i - 1];
      const tier = need.tiers[i];
      if (before !== undefined && tier !== undefined && tier.from <= before.from)
        problems.push(`commun/besoins.json, ${id}: paliers à ranger par seuil croissant`);
    }
  }
  for (let i = 1; i < bags.bags.length; i++) {
    const before = bags.bags[i - 1];
    const bag = bags.bags[i];
    if (before !== undefined && bag !== undefined && bag.slots <= before.slots)
      problems.push(`commun/sacs.json: sacs à ranger du plus petit au plus grand (« ${bag.id} »)`);
  }
  for (const item of Object.values(content.items)) {
    const at = `commun/objets/${item.id}.json`;
    if (item.tool !== null && item.stack !== 1) problems.push(`${at}: un outil ne s'empile pas`);
    if ((item.family === 'tool') !== (item.tool !== null))
      problems.push(`${at}: famille « tool » et champ \`tool\` vont ensemble`);
  }
  for (const prop of Object.values(content.props)) checkBricks(content, prop, problems);
  for (const recipe of Object.values(content.recipes)) {
    for (const portion of [...recipe.inputs, recipe.output]) {
      if (!(portion.item in content.items))
        problems.push(`commun/recettes/${recipe.id}.json: objet inconnu « ${portion.item} »`);
    }
  }
  for (const entry of Object.values(content.catches)) {
    const at = `commun/prises/${entry.id}.json`;
    if (!(entry.item in content.items)) problems.push(`${at}: objet inconnu « ${entry.item} »`);
    for (const place of entry.places)
      if (!(place in content.places)) problems.push(`${at}: lieu inconnu « ${place} »`);
  }
  for (const place of Object.values(content.places)) checkPlace(content, place, problems);
  // Accords de genre des répliques (cahier 1.5): balise complète, aucun accord au joueur hors balise.
  problems.push(...validateDialogueTexts(content));
  return problems;
}
