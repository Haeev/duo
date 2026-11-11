/**
 * Contrôles de cohérence entre fichiers (les schémas contrôlent chaque fichier seul): toute
 * référence existe, tout graphe de dialogue est parcourable, aucun geste courant ne dépasse la
 * durée permise. Renvoie la liste des problèmes, vide si tout va bien.
 */
import { terrainProblem } from './carte';
import type { Content, PlaceContent } from './charger';
import type { ShopDef } from './schemas/commerce';
import { objectsById, poseHeight } from './poses';
import { shopProblems } from '../simulation/commerces/validation';
import { NEED_IDS } from './schemas/communs';
import type { DialogueDef } from './schemas/dialogue';
import { GROUP_MAX_SPAN, PLACE_BRICK_OBJECTS_MAX, type MapObject } from './schemas/lieu';
import type { PropDef } from './schemas/meuble';
import type { Look } from './schemas/personnage';
import { validateHarvestContent } from './schemas/recolte';
import { validateFarmContent } from '../simulation/elevage/valider';
import type { Condition, Effect } from './schemas/regles';
import { BOND_KEY_PREFIX_LENGTH } from '../etat/progression';
import { validateDialogueTexts } from '../simulation/dialogues/valider';
import { validateVillagerLives } from '../simulation/habitants/valider';
import { isFactKey, playerFactKey } from '../simulation/regles/memoire';
import { WARDROBE } from '../simulation/regles/recompenses';
import { decisionOptions } from '../simulation/quetes/decisions';
import { validateStory } from '../simulation/quetes/valider';
import { checkRecipes } from '../simulation/cuisine/valider';
import { validateHousings } from '../simulation/logement/valider';
import { validatePassages } from '../simulation/lieux/valider';
import { checkPlans } from '../simulation/fabrication/valider';
import { validateOrders } from '../simulation/commandes/valider';

/** Décision à deux citée par une condition ou un effet: déclarée par une étape, option connue. */
function checkDecision(
  content: Content,
  decision: string,
  option: string | undefined,
  at: string,
  problems: string[],
): void {
  const options = decisionOptions(content, decision);
  if (options === null)
    problems.push(`${at}: décision inconnue « ${decision} » (aucune étape ne la déclare)`);
  else if (option !== undefined && !options.includes(option))
    problems.push(`${at}: la décision « ${decision} » n'a pas d'option « ${option} »`);
}

/** Un fait attaché à un joueur (`of`) reçoit `.j0` ou `.j1`: la clé complète doit rester valide. */
function checkOwnedKey(key: string, of: string | undefined, at: string, problems: string[]): void {
  if (of !== undefined && !isFactKey(playerFactKey(key, 0)))
    problems.push(
      `${at}: clé « ${key} » trop longue pour un fait par joueur (trois segments au plus)`,
    );
}

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
    case 'decision_is':
      checkDecision(content, c.decision, c.option, at, problems);
      return;
    case 'event_is':
      for (const id of c.events)
        if (!Object.values(content.time.events).some((list) => list.some((e) => e.id === id)))
          problems.push(`${at}: événement inconnu « ${id} »`);
      return;
    case 'remembered':
    case 'fact_at_least':
      checkOwnedKey(c.key, c.of, at, problems);
      return;
    case 'days_since':
      checkOwnedKey(c.key, c.of, at, problems);
      if (c.atLeast === undefined && c.atMost === undefined)
        problems.push(`${at}: days_since sans borne (atLeast ou atMost)`);
      else if (c.atLeast !== undefined && c.atMost !== undefined && c.atLeast > c.atMost)
        problems.push(`${at}: days_since impossible, atLeast au-delà de atMost`);
      return;
    case 'need_at_least':
    case 'money_at_least':
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
    case 'change_bond':
      if (!Object.values(content.places).some((p) => p.villagers.some((v) => v.id === e.villager)))
        problems.push(`${at}: habitant inconnu « ${e.villager} »`);
      return;
    case 'open_shop':
      return;
    case 'give_recipe': {
      const recipe = content.recipes[e.recipe];
      if (recipe === undefined) problems.push(`${at}: recette inconnue « ${e.recipe} »`);
      else if (recipe.known === 'start')
        problems.push(`${at}: la recette « ${e.recipe} » est connue dès le début`);
      return;
    }
    case 'give_plan': {
      const plan = content.plans[e.plan];
      if (plan === undefined) problems.push(`${at}: plan inconnu « ${e.plan} »`);
      else if (plan.source === 'start')
        problems.push(`${at}: le plan « ${e.plan} » est connu dès le début`);
      return;
    }
    case 'give_entry':
      if (!(e.entry in content.book.entries))
        problems.push(`${at}: entrée de collection inconnue « ${e.entry} »`);
      return;
    case 'give_piece': {
      const piece = content.pieces[e.piece];
      if (piece === undefined) problems.push(`${at}: pièce de tenue inconnue « ${e.piece} »`);
      else if (!piece.tags.includes(WARDROBE.lockedTag))
        problems.push(
          `${at}: la pièce « ${e.piece} » n'est pas à gagner (étiquette « ${WARDROBE.lockedTag} »)`,
        );
      return;
    }
    case 'choose':
      checkDecision(content, e.decision, e.option, at, problems);
      return;
    case 'remember':
    case 'bump':
      checkOwnedKey(e.key, e.of, at, problems);
      return;
    case 'give_money':
    case 'take_money':
    case 'change_need':
    case 'reveal_look':
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
        return [node.next];
      case 'effects':
        return [node.next, node.otherwise ?? null];
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
  for (const c of shop.when ?? []) checkCondition(content, c, `${at}, when`, problems);
  for (const line of [...shop.sells, ...shop.buys])
    if (line.unlock !== undefined) checkCondition(content, line.unlock, `${at}, unlock`, problems);
}

/** Ressource propre à un point (`resource` d'un objet de la carte): même geste, même reste. */
function checkOwnResource(
  content: Content,
  id: string,
  prop: PropDef,
  where: string,
  problems: string[],
): void {
  const own = content.resources[id];
  if (own === undefined) {
    problems.push(`${where}: ressource inconnue « ${id} »`);
    return;
  }
  const brick = prop.bricks.find((b) => b.brick === 'harvest');
  if (brick === undefined) {
    problems.push(`${where}: \`resource\` sans brique \`harvest\` sur le meuble`);
    return;
  }
  const base = content.resources[brick.resource];
  if (base !== undefined && (base.kind !== own.kind || base.after !== own.after))
    problems.push(
      `${where}: « ${id} » doit avoir le geste et le reste de « ${base.id} » (${base.kind}, ${base.after})`,
    );
}

/**
 * Objets posés sur un meuble (`on`): porteur de la même carte, doté d'un plateau (`top`), sous le
 * centre de l'objet, sans boucle ni chaîne trop longue; l'objet posé est du décor (ni brique, ni solide).
 */
function checkPoses(content: Content, place: PlaceContent, problems: string[]): void {
  const byId = objectsById(place.map.objects);
  for (const o of place.map.objects) {
    if (o.on === undefined) continue;
    const where = `lieu ${place.def.id}, objet ${o.id}`;
    const prop = content.props[o.type];
    if (prop !== undefined && (prop.bricks.length > 0 || prop.solid))
      problems.push(`${where}: un objet posé sur un meuble est du décor (ni brique, ni solide)`);
    if (typeof o.on === 'number') continue;
    const carrier = byId.get(o.on);
    if (carrier === undefined) {
      problems.push(`${where}: porteur inconnu « ${o.on} » (champ \`on\`)`);
      continue;
    }
    const top = content.props[carrier.type]?.top;
    if (top === undefined)
      problems.push(
        `${where}: « ${o.on} » n'a pas de plateau (\`top\` absent de la fiche « ${carrier.type} »)`,
      );
    else if (poseHeight(content.props, byId, o) === null)
      problems.push(`${where}: chaîne de porteurs trop longue ou en boucle`);
    const f = footprint(content, carrier);
    if (f !== null && (o.x < f.x || o.x > f.x + f.w || o.y < f.y || o.y > f.y + f.h))
      problems.push(`${where}: son centre n'est pas sur l'emprise de « ${o.on} » (il flotterait)`);
  }
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
    for (const c of o.when ?? []) checkCondition(content, c, `${where}, when`, problems);
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
    if (o.resource !== undefined) checkOwnResource(content, o.resource, prop, where, problems);
  }
  checkGroups(content, place, problems);
  checkPoses(content, place, problems);
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
    for (const c of door.opens ?? []) checkCondition(content, c, where, problems);
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

/** Événements cités (`event_is`) dans ces conditions, à toute profondeur. */
function citedEvents(conditions: readonly Condition[]): string[] {
  return conditions.flatMap((c): string[] => {
    if (c.type === 'all' || c.type === 'any') return citedEvents(c.conditions);
    if (c.type === 'not') return citedEvents([c.condition]);
    return c.type === 'event_is' ? c.events : [];
  });
}

/**
 * Conditions des événements du calendrier: références connues, et aucun événement qui dépende de
 * lui-même par `event_is` (la veillée qui s'efface un jour de fête, oui; la fête qui attend la
 * veillée qui attend la fête, non). Décisions rejouables: événements connus du lieu.
 */
function checkEvents(content: Content, problems: string[]): void {
  for (const [placeId, list] of Object.entries(content.time.events)) {
    const cites = new Map(list.map((e) => [e.id, citedEvents(e.conditions)]));
    for (const event of list) {
      const at = `lieux/${placeId}/evenements/${event.id}.json`;
      for (const c of event.conditions) checkCondition(content, c, at, problems);
      const seen = new Set<string>();
      const queue = [...(cites.get(event.id) ?? [])];
      while (queue.length > 0) {
        const id = queue.pop() ?? '';
        if (id === event.id) {
          problems.push(`${at}: conditions en boucle, l'événement dépend de lui-même (event_is)`);
          break;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(...(cites.get(id) ?? []));
      }
    }
  }
  for (const place of Object.values(content.places)) {
    const events = new Set((content.time.events[place.def.id] ?? []).map((e) => e.id));
    for (const line of Object.values(place.quests))
      for (const chapter of line.chapters)
        for (const step of chapter.steps)
          for (const id of step.decision?.reopens ?? [])
            if (!events.has(id))
              problems.push(
                `lieu ${place.def.id}, quête ${line.id}, étape ${step.id}: décision rouverte par un événement inconnu du lieu « ${id} »`,
              );
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
  problems.push(...checkPlans(content));
  // Coins de pêche: chaque poisson de la table est une prise connue avec son bloc `fish`.
  for (const place of Object.values(content.places))
    for (const spot of place.def.fishing ?? [])
      for (const row of spot.table)
        if (content.catches[row.catch]?.fish === undefined)
          problems.push(
            `lieu ${place.def.id}, coin de pêche ${spot.id}: « ${row.catch} » n'est pas une prise avec un bloc fish`,
          );
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
    for (const bait of entry.baits ?? [])
      if (!(bait.item in content.items)) problems.push(`${at}: appât inconnu « ${bait.item} »`);
    const unique = entry.unique;
    if (unique === undefined) continue;
    if (entry.fish === undefined)
      problems.push(`${at}: une prise unique est un poisson (bloc fish)`);
    if (unique.bait !== null && !(unique.bait in content.items))
      problems.push(`${at}: appât inconnu « ${unique.bait} »`);
    for (const c of unique.when) checkCondition(content, c, `${at}, unique.when`, problems);
    const spots = entry.places.flatMap((p) => content.places[p]?.def.fishing ?? []);
    // Un lieu sans aucun coin (carte brute d'un plan, en essai) ne la porte pas, sans faute.
    if (spots.length > 0 && !spots.some((s) => s.id === unique.spot))
      problems.push(`${at}: coin de pêche « ${unique.spot} » absent de ses lieux`);
    // Elle n'est tirée dans aucune table: son ombre vient de sa fiche seule.
    if (spots.some((s) => s.table.some((row) => row.catch === entry.id)))
      problems.push(`${at}: une prise unique ne va dans aucune table de coin de pêche`);
  }
  for (const place of Object.values(content.places)) checkPlace(content, place, problems);
  checkEvents(content, problems);
  // Accords de genre des répliques (cahier 1.5): balise complète, aucun accord au joueur hors balise.
  problems.push(...validateDialogueTexts(content));
  problems.push(...validateHarvestContent(content));
  problems.push(...validateFarmContent(content));
  problems.push(...validateVillagerLives(content, checkCondition));
  // Suites de quêtes et scènes: références, et aucune suite qui puisse se bloquer.
  problems.push(...validateStory(content, { condition: checkCondition, effect: checkEffect }));
  problems.push(...validateHousings(content));
  problems.push(...validateOrders(content, { condition: checkCondition, effect: checkEffect }));
  problems.push(...validatePassages(content));
  return problems;
}
