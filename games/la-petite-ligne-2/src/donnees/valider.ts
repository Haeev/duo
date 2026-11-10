/**
 * Contrôles de cohérence entre fichiers (les schémas contrôlent chaque fichier seul): toute
 * référence existe, tout graphe de dialogue est parcourable, aucun geste courant ne dépasse la
 * durée permise. Renvoie la liste des problèmes, vide si tout va bien.
 */
import { terrainProblem } from './carte';
import type { Content, PlaceContent } from './charger';
import type { ShopDef } from './schemas/commerce';
import { shopProblems } from '../simulation/commerces/validation';
import { NEED_IDS } from './schemas/communs';
import type { DialogueDef } from './schemas/dialogue';
import { GROUP_MAX_SPAN, PLACE_BRICK_OBJECTS_MAX, type MapObject } from './schemas/lieu';
import type { PropDef } from './schemas/meuble';
import type { Look } from './schemas/personnage';
import { validateHarvestContent } from './schemas/recolte';
import type { Condition, Effect } from './schemas/regles';
import { BOND_KEY_PREFIX_LENGTH } from '../etat/progression';
import { validateDialogueTexts } from '../simulation/dialogues/valider';
import { validateVillagerLives } from '../simulation/habitants/valider';
import { validateStory } from '../simulation/quetes/valider';
import { checkRecipes } from '../simulation/cuisine/valider';
import { validateHousings } from '../simulation/logement/valider';

export function checkCondition(
  content: Content,
  c: Condition,
  at: string,
  problems: string[],
): void {
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
    case 'weather_is':
    case 'season_is':
    case 'weekday_is':
      return;
  }
}

export function checkEffect(content: Content, e: Effect, at: string, problems: string[]): void {
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

function checkShop(content: Content, place: PlaceContent, shop: ShopDef, problems: string[]): void {
  const at = `lieu ${place.def.id}, commerce ${shop.id}`;
  if (!place.villagers.some((v) => v.id === shop.keeper))
    problems.push(`${at}: habitant inconnu « ${shop.keeper} »`);
  for (const problem of shopProblems(content, shop)) problems.push(`${at}: ${problem}`);
}

/** Ensembles de meubles (`group`): deux meubles au moins, un siège au moins, assez proches pour un repas. */
function checkGroups(content: Content, place: PlaceContent, problems: string[]): void {
  const groups = new Map<string, MapObject[]>();
  for (const o of place.map.objects) {
    if (o.group === undefined) continue;
    const list = groups.get(o.group);
    if (list === undefined) groups.set(o.group, [o]);
    else list.push(o);
  }
  for (const [name, members] of groups) {
    const where = `lieu ${place.def.id}, groupe « ${name} »`;
    if (members.length < 2) problems.push(`${where}: un groupe réunit deux meubles au moins`);
    if (!members.some((o) => content.props[o.type]?.bricks.some((b) => b.brick === 'sit')))
      problems.push(`${where}: aucun meuble à brique \`sit\``);
    for (const a of members)
      for (const b of members)
        if (Math.hypot(a.x - b.x, a.y - b.y) > GROUP_MAX_SPAN)
          problems.push(
            `${where}: « ${a.id} » et « ${b.id} » à plus de ${String(GROUP_MAX_SPAN)} m l'un de l'autre`,
          );
  }
}

/** Objets posés au sol par la carte: objet connu, pile permise, dans la carte, hors d'une zone bloquée. */
function checkGroundItems(
  content: Content,
  place: PlaceContent,
  blockedAt: (x: number, y: number) => boolean,
  inside: (x: number, y: number) => boolean,
  problems: string[],
): void {
  const ids = new Set<string>();
  for (const g of place.map.groundItems ?? []) {
    const where = `lieu ${place.def.id}, objet au sol ${g.id}`;
    if (ids.has(g.id)) problems.push(`${where}: identifiant en double`);
    ids.add(g.id);
    const item = content.items[g.item];
    if (item === undefined) problems.push(`${where}: objet inconnu « ${g.item} »`);
    else if (g.count > item.stack)
      problems.push(
        `${where}: ${String(g.count)} exemplaires pour une pile de ${String(item.stack)}`,
      );
    if (!inside(g.x, g.y)) problems.push(`${where}: hors de la carte`);
    else if (blockedAt(g.x, g.y)) problems.push(`${where}: dans une zone bloquée`);
  }
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
  checkGroups(content, place, problems);
  checkGroundItems(content, place, blockedAt, inside, problems);
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
  checkLargePlace(content, place, problems);
  for (const d of place.dialogues) checkDialogue(content, place, d, problems);
  for (const shop of Object.values(place.shops)) checkShop(content, place, shop, problems);
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Grands lieux (ADR 0022): terrain, intérieurs, portes, verrous, graphe des chemins. */
function checkLargePlace(content: Content, place: PlaceContent, problems: string[]): void {
  const { def, map } = place;
  const at = `lieu ${def.id}`;
  const whole: Box = { x: 0, y: 0, w: map.width, h: map.height };
  const within = (b: Box): boolean =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= map.width && b.y + b.h <= map.height;
  if (map.terrain !== undefined) {
    const problem = terrainProblem(map.terrain, map.width, map.height);
    if (problem !== null) problems.push(`${at}, terrain: ${problem}`);
  }
  const outdoor = map.outdoor ?? whole;
  if (!within(outdoor)) problems.push(`${at}: le dehors déborde de la carte`);
  const rooms: { id: string; box: Box }[] = [];
  for (const room of place.interiors) {
    // Le mur posé autour de l'intérieur compte dans son emprise.
    const box = { x: room.at.x - 1, y: room.at.y - 1, w: room.width + 2, h: room.height + 2 };
    const where = `${at}, intérieur ${room.id}`;
    if (!within(box)) problems.push(`${where}: hors de la carte (mur compris)`);
    if (overlaps(box, outdoor)) problems.push(`${where}: posé sur le dehors`);
    for (const other of rooms)
      if (overlaps(box, other.box)) problems.push(`${where}: chevauche l'intérieur ${other.id}`);
    rooms.push({ id: room.id, box });
  }
  const doors = map.doors ?? {};
  for (const [id, door] of Object.entries(doors)) {
    const where = `${at}, porte ${id}`;
    const target = doors[door.to];
    if (target === undefined) problems.push(`${where}: porte d'arrivée inconnue « ${door.to} »`);
    else if (target.to !== id) problems.push(`${where}: « ${door.to} » ne ramène pas ici`);
    if (!within({ x: door.x, y: door.y, w: 0, h: 0 })) problems.push(`${where}: hors de la carte`);
  }
  const objectIds = new Set(map.objects.map((o) => o.id));
  const withBricks = map.objects.filter((o) => (content.props[o.type]?.bricks.length ?? 0) > 0);
  if (withBricks.length > PLACE_BRICK_OBJECTS_MAX)
    problems.push(
      `${at}: ${String(withBricks.length)} meubles à briques, ${String(PLACE_BRICK_OBJECTS_MAX)} au plus (budget de la tranche « lieu »)`,
    );
  const locks = map.locks ?? {};
  for (const [id, lock] of Object.entries(locks)) {
    const where = `${at}, verrou ${id}`;
    if (!lock.rects.every(within)) problems.push(`${where}: hors de la carte`);
    if (lock.object !== null && !objectIds.has(lock.object))
      problems.push(`${where}: objet inconnu « ${lock.object} »`);
    for (const c of lock.opens) checkCondition(content, c, where, problems);
  }
  const nodes = map.graph?.nodes ?? {};
  for (const [id, node] of Object.entries(nodes))
    if (!within({ x: node.x, y: node.y, w: 0, h: 0 }))
      problems.push(`${at}, nœud ${id}: hors de la carte`);
  for (const edge of map.graph?.edges ?? []) {
    const where = `${at}, chemin ${edge.a}-${edge.b}`;
    for (const end of [edge.a, edge.b])
      if (!(end in nodes)) problems.push(`${where}: nœud inconnu « ${end} »`);
    if (edge.lock !== null && !(edge.lock in locks))
      problems.push(`${where}: verrou inconnu « ${edge.lock} »`);
  }
  for (const [id, poi] of Object.entries(map.interests ?? {}))
    if (!(poi.node in nodes)) problems.push(`${at}, intérêt ${id}: nœud inconnu « ${poi.node} »`);
  for (const [id, zone] of Object.entries(map.zones ?? {}))
    if (zone.polygon.some(([x, y]) => !within({ x, y, w: 0, h: 0 })))
      problems.push(`${at}, zone ${id}: polygone hors de la carte`);
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
    if ((item.family === 'bag') !== (item.bag !== undefined))
      problems.push(`${at}: famille « bag » et champ \`bag\` vont ensemble`);
    if (item.bag !== undefined) {
      if (!bags.bags.some((b) => b.id === item.bag))
        problems.push(`${at}: sac inconnu « ${item.bag} »`);
      if (item.stack !== 1) problems.push(`${at}: un sac ne s'empile pas`);
    }
  }
  for (const prop of Object.values(content.props)) checkBricks(content, prop, problems);
  problems.push(...checkRecipes(content));
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
  problems.push(...validateHarvestContent(content));
  problems.push(...validateVillagerLives(content, checkCondition));
  // Suites de quêtes et scènes: références, et aucune suite qui puisse se bloquer.
  problems.push(...validateStory(content, { condition: checkCondition, effect: checkEffect }));
  problems.push(...validateHousings(content));
  return problems;
}
