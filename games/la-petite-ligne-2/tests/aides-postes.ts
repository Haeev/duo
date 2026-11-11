// Contrôle des postes (habitants, sièges, lits), lu par `postes-habitants.test.ts`. La boîte du
// corps se mesure contre ce que le joueur voit: l'emprise d'un meuble solide réduite à la boîte
// de son modèle livré (lue dans le GLB: une paroi de wagon n'occupe que le bord de sa case, un
// comptoir n'a pas toute la profondeur de son emprise), et les cases de mur de la carte
// (intérieurs fusionnés). Chaque faute est une phrase qui dit qui, où et quoi.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { MapObject } from '../src/donnees/schemas/lieu';
import type { Spot } from '../src/donnees/schemas/vie-habitant';
import { DECOR_MANIFEST, variantOf } from '../src/rendu/lieu/decors-manifeste';
import { goalOf, placesOf } from '../src/simulation/habitants/planning';
import { VILLAGERS } from '../src/simulation/habitants/reglages';
import { footprintOf } from '../src/simulation/noyau/obstacles';

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Tolérance: deux emprises qui se touchent bord à bord ne se coupent pas. */
const EPS = 1e-6;
/** Demi-largeur d'épaules (m) d'un corps assis ou couché: il tient sur sa place, pas plus. */
const SEATED_RADIUS = 0.22;
/** Distance (m) devant une place assise où il faut de la place (les genoux, le regard). */
const SEAT_AHEAD = 0.6;

const DECORS = fileURLToPath(new URL('../assets/commun/decors/', import.meta.url));

interface GltfNode {
  readonly name?: string;
  readonly mesh?: number;
  readonly children?: readonly number[];
  readonly translation?: readonly number[];
}
interface Gltf {
  readonly nodes: readonly GltfNode[];
  readonly meshes: readonly { primitives: readonly { attributes: { POSITION: number } }[] }[];
  readonly accessors: readonly { min?: readonly number[]; max?: readonly number[] }[];
}

const gltfs = new Map<string, Gltf>();
const boxes = new Map<string, Rect | null>();

/** Bloc JSON d'un GLB (en-tête de 12 octets, puis le premier bloc). */
function readGltf(file: string): Gltf {
  let gltf = gltfs.get(file);
  if (gltf === undefined) {
    const data = readFileSync(DECORS + file);
    const length = data.readUInt32LE(12);
    gltf = JSON.parse(data.subarray(20, 20 + length).toString('utf8')) as Gltf;
    gltfs.set(file, gltf);
  }
  return gltf;
}

/** Boîte au sol d'un modèle livré dans son repère (x à droite, z vers sa façade), `null` sans modèle. */
function modelBox(model: string): Rect | null {
  if (boxes.has(model)) return boxes.get(model) ?? null;
  const entry = DECOR_MANIFEST.models[model];
  let box: Rect | null = null;
  if (entry !== undefined) {
    const gltf = readGltf(entry.file);
    const root = gltf.nodes.findIndex((n) => n.name === model);
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    // Les nœuds du modèle sont posés à l'origine (translation seule): on cumule les décalages.
    const visit = (index: number, dx: number, dz: number, top: boolean): void => {
      const node = gltf.nodes[index];
      if (node === undefined) return;
      const tx = top ? 0 : (node.translation?.[0] ?? 0);
      const tz = top ? 0 : (node.translation?.[2] ?? 0);
      if (node.mesh !== undefined)
        for (const prim of gltf.meshes[node.mesh]?.primitives ?? []) {
          const acc = gltf.accessors[prim.attributes.POSITION];
          if (acc?.min === undefined || acc.max === undefined) continue;
          x0 = Math.min(x0, (acc.min[0] ?? 0) + dx + tx);
          x1 = Math.max(x1, (acc.max[0] ?? 0) + dx + tx);
          z0 = Math.min(z0, (acc.min[2] ?? 0) + dz + tz);
          z1 = Math.max(z1, (acc.max[2] ?? 0) + dz + tz);
        }
      for (const child of node.children ?? []) visit(child, dx + tx, dz + tz, false);
    };
    if (root >= 0) visit(root, 0, 0, true);
    if (Number.isFinite(x0)) box = { x0, y0: z0, x1, y1: z1 };
  }
  boxes.set(model, box);
  return box;
}

/** Un point du repère du modèle tourné de `rotation` quarts (façade au sud, puis est, nord, ouest). */
function turn(x: number, z: number, rotation: number): [number, number] {
  switch (rotation) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
}

function bodyBox(x: number, y: number, radius: number): Rect {
  return { x0: x - radius, y0: y - radius, x1: x + radius, y1: y + radius };
}

/** Emprise de la simulation, réduite à la boîte du modèle livré quand il y en a un. */
function objectRect(content: Content, object: MapObject): Rect | null {
  const def = content.props[object.type];
  if (def === undefined) return null;
  const size = footprintOf(def, object.rotation);
  const sim = {
    x0: object.x - size.w / 2,
    y0: object.y - size.h / 2,
    x1: object.x + size.w / 2,
    y1: object.y + size.h / 2,
  };
  const model = modelBox(variantOf(def.model, object.id));
  if (model === null) return sim;
  const [ax, ay] = turn(model.x0, model.y0, object.rotation);
  const [bx, by] = turn(model.x1, model.y1, object.rotation);
  const shown = {
    x0: object.x + Math.min(ax, bx),
    y0: object.y + Math.min(ay, by),
    x1: object.x + Math.max(ax, bx),
    y1: object.y + Math.max(ay, by),
  };
  // Le feuillage d'un arbre déborde de son emprise: seul compte ce qui est dans les deux.
  return {
    x0: Math.max(sim.x0, shown.x0),
    y0: Math.max(sim.y0, shown.y0),
    x1: Math.min(sim.x1, shown.x1),
    y1: Math.min(sim.y1, shown.y1),
  };
}

interface Checker {
  /** Meubles solides et cases de mur que la boîte coupe (identifiants, ou `mur (x, y)`). */
  hits(box: Rect, except: ReadonlySet<string>): string[];
  /** Le nom de la pièce qui contient ce point, `dehors` sinon. */
  where(x: number, y: number): string;
}

function checker(content: Content, place: PlaceContent): Checker {
  const { width, height } = place.map;
  const wall = new Uint8Array(width * height);
  for (const r of place.map.blocked)
    for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
      for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
        wall[cy * width + cx] = 1;
  const solids: { id: string; rect: Rect }[] = [];
  for (const object of place.map.objects) {
    const def = content.props[object.type];
    const rect = objectRect(content, object);
    // Une porte (brique `open`) se franchit: ce n'est pas un meuble où l'on se cogne.
    if (def === undefined || rect === null || !def.solid) continue;
    if (def.bricks.some((b) => b.brick === 'open')) continue;
    solids.push({ id: object.id, rect });
  }
  return {
    hits(box, except) {
      const out: string[] = [];
      for (const s of solids) if (!except.has(s.id) && overlaps(box, s.rect)) out.push(s.id);
      for (let cy = Math.floor(box.y0 + EPS); cy <= Math.floor(box.y1 - EPS); cy++)
        for (let cx = Math.floor(box.x0 + EPS); cx <= Math.floor(box.x1 - EPS); cx++) {
          const outside = cx < 0 || cy < 0 || cx >= width || cy >= height;
          if (outside || wall[cy * width + cx] === 1) out.push(`mur (${cx}, ${cy})`);
        }
      return out;
    },
    where(x, y) {
      for (const room of place.interiors)
        if (
          x >= room.at.x &&
          y >= room.at.y &&
          x <= room.at.x + room.width &&
          y <= room.at.y + room.height
        )
          return room.id;
      return 'dehors';
    },
  };
}

const round = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Les fautes de tous les lieux, triées; vide quand tout le monde tient à sa place. */
export function postFaults(content: Content): string[] {
  const faults: string[] = [];
  const r = VILLAGERS.radius;
  for (const [placeId, place] of Object.entries(content.places)) {
    const check = checker(content, place);
    const at = (x: number, y: number): string => `${check.where(x, y)} (${round(x)}, ${round(y)})`;
    const none = new Set<string>();

    // 1. Postes de planning, point « chez lui », et point où se tient un habitant sans planning.
    for (const villager of place.villagers) {
      const spots: { label: string; spot: Spot }[] = [
        { label: 'debout', spot: { point: villager.stands } },
      ];
      const life = villager.life;
      if (life !== undefined) {
        for (const e of life.schedule) spots.push({ label: e.activity, spot: e.at });
        spots.push({ label: 'chez-lui', spot: { point: life.home } });
      }
      for (const { label, spot } of spots) {
        // Un siège ou un lit se contrôle plus bas, place par place.
        if ('seat' in spot || 'bed' in spot) continue;
        const goal = goalOf(content, place, spot, () => false);
        const who = `${placeId}/${villager.id} ${label}`;
        if (goal === null) {
          faults.push(`${who}: poste introuvable`);
          continue;
        }
        const hits = check.hits(bodyBox(goal.x, goal.y, r), none);
        if (hits.length > 0) faults.push(`${who} à ${at(goal.x, goal.y)} coupe ${hits.join(', ')}`);
        // Derrière un comptoir: ses clients doivent pouvoir se tenir devant, côté salle.
        if ('object' in spot && spot.side === 'behind') {
          const client = goalOf(
            content,
            place,
            { object: spot.object, side: 'front' },
            () => false,
          );
          const blocked = client === null ? [] : check.hits(bodyBox(client.x, client.y, r), none);
          if (client !== null && blocked.length > 0)
            faults.push(
              `${who}: devant ${spot.object}, le client à ${at(client.x, client.y)} coupe ${blocked.join(', ')}`,
            );
        }
      }
    }

    // 2. Chaque meuble où l'on s'assoit ou se couche, puis chacune de ses places.
    for (const object of place.map.objects) {
      const def = content.props[object.type];
      if (def === undefined) continue;
      const own = new Set([object.id]);
      // Assis à une table: les jambes passent dessous, les meubles du même ensemble ne comptent pas.
      if (object.group !== undefined)
        for (const o of place.map.objects) if (o.group === object.group) own.add(o.id);
      for (const pose of ['sit', 'lie'] as const) {
        const places = placesOf(def, pose);
        if (places === 0) continue;
        const where = `${placeId}/${object.id}`;
        const rect = objectRect(content, object);
        if (rect !== null && def.solid) {
          const hits = check.hits(rect, own);
          if (hits.length > 0)
            faults.push(
              `${where} (${def.id}) à ${at(object.x, object.y)} coupe ${hits.join(', ')}`,
            );
        }
        for (let index = 0; index < places; index++) {
          const spot: Spot = pose === 'sit' ? { seat: object.id } : { bed: object.id };
          const seat = goalOf(content, place, spot, (_o, i) => i < index)?.seat;
          if (seat === null || seat === undefined) {
            faults.push(`${where} place ${String(index)}: introuvable`);
            continue;
          }
          const name = `${where} place ${String(index)} (${pose === 'sit' ? 'assis' : 'couché'})`;
          const hits = check.hits(bodyBox(seat.x, seat.y, SEATED_RADIUS), own);
          if (hits.length > 0)
            faults.push(`${name} à ${at(seat.x, seat.y)} coupe ${hits.join(', ')}`);
          if (pose === 'sit') {
            const ax = seat.x + Math.cos(seat.facing) * SEAT_AHEAD;
            const ay = seat.y + Math.sin(seat.facing) * SEAT_AHEAD;
            const ahead = check
              .hits(bodyBox(ax, ay, 0.05), none)
              .filter((h) => h.startsWith('mur'));
            if (ahead.length > 0) faults.push(`${name}: face au mur (${ahead.join(', ')})`);
          }
        }
      }
    }
  }
  return [...new Set(faults)].sort();
}
