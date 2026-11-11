/**
 * Description d'un lieu pour le rendu: ce que le moteur dessine, tiré des données du lieu
 * (`PlaceContent`) et de son état (`PlaceState`), sans rien nommer. Chaque élément posé devient un
 * « volume »: une emprise, une hauteur, un modèle demandé, et ce qu'il sait faire à l'écran
 * (cacher un personnage, réagir à la visée). Logique pure: testable sans WebGL.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { DeepReadonly } from '../../etat/monde';
import type { PlaceState } from '../../etat/lieu';
import type { FloorDef } from '../../donnees/schemas/lieu';
import { DOORS, doorSills, type Sill } from '../../donnees/seuils';
import type { OccluderBox } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { DECOR_MANIFEST } from './decors-manifeste';
import { clearOf, type Footprint } from './emprises';
import { tallFootprints } from './files';
import { groundModelOf } from './recoltes';
import { HARVEST_LOOK } from './reglages-recoltes';
import { roomStyle } from './reglages-pieces';
import { TILE_SETTINGS } from './reglages-tuiles';
import { groundField } from './terrain-rendu';

/**
 * Forme simple d'un volume sans modèle. Les trois dernières sont celles d'une porte (`formes.ts`):
 * `door` encadrement et vantail, `mat` paillasson, `hatch` porte au sol (escalier, trappe).
 */
export type StandInShape = 'box' | 'ball' | 'post' | 'slab' | 'door' | 'mat' | 'hatch';

export interface SceneVolume {
  /** Identifiant d'instance: celui de la carte, d'un meuble posé (`pose-<n>`), ou fabriqué. */
  readonly id: string;
  /** Nœud du modèle 3D demandé, `null`: jamais de modèle (zone, objet au sol). */
  readonly model: string | null;
  /** Centre de l'emprise sur la carte (m, x est, y sud). */
  readonly x: number;
  readonly y: number;
  /** Emprise à la rotation 0 (façade au sud), en mètres. */
  readonly w: number;
  readonly h: number;
  /** Quarts de tour: 0 façade au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  readonly rotation: 0 | 1 | 2 | 3;
  /** Hauteur du bas du volume au-dessus du sol (un toit, un houppier), et hauteur du volume (m). */
  readonly base: number;
  readonly height: number;
  readonly shape: StandInShape;
  /** Couleur imposée de la forme simple; absente: teinte tirée de l'identifiant du modèle. */
  readonly color?: string;
  /**
   * Porte d'une pièce: hauteur où elle se coupe avec son mur quand il est devant la caméra (la
   * coupe du style de la pièce). Absente: la porte reste entière.
   */
  readonly cutHeight?: number;
  /** Peut cacher un personnage: il s'efface quand il est entre la caméra et le joueur. */
  readonly occludes: boolean;
  /** Peut être la cible de la touche d'action (son identifiant est celui de `PlayerState.aim`). */
  readonly aimable: boolean;
  /**
   * Point de la carte où se lit la hauteur du sol (relief); absent: le centre. Les cases d'un
   * potager se posent ainsi à la hauteur du potager, pas chacune à la sienne.
   */
  readonly foot?: { readonly x: number; readonly y: number };
  /** Forme provisoire commune à tous les volumes qui la demandent (`bundle`: ballot d'un objet au sol). */
  readonly standIn?: 'bundle';
  /** Échelle du modèle (un objet ramassé posé au sol); absente: 1. */
  readonly scale?: number;
  /**
   * Volume dynamique sans visée ni effacement, posé en instance avec ceux du même modèle (un
   * appel de dessin par modèle: les cases et les plants d'un potager).
   */
  readonly batch?: boolean;
}

export interface PlaceDescription {
  readonly id: string;
  /** Taille de la carte en cases de 1 m. */
  readonly width: number;
  readonly height: number;
  readonly volumes: readonly SceneVolume[];
  /** Sol déclaré par la carte (`sol.ts`); absent: la plaque d'essai. */
  readonly floor?: FloorDef;
}

type StandInSettings = typeof RENDER_SETTINGS.standIn;

/** Emprise au sol d'un volume une fois tourné (m). */
export function footprint(volume: Pick<SceneVolume, 'w' | 'h' | 'rotation'>): {
  w: number;
  h: number;
} {
  return volume.rotation % 2 === 0 ? { w: volume.w, h: volume.h } : { w: volume.h, h: volume.w };
}

/** Boîte du volume dans le repère Three.js (X est, Y haut, Z sud). */
export function boxOf(volume: SceneVolume): OccluderBox {
  const size = footprint(volume);
  const share = volume.shape === 'ball' ? RENDER_SETTINGS.occlusion.ballShare : 1;
  const w = (size.w * share) / 2;
  const h = (size.h * share) / 2;
  const middle = volume.base + volume.height / 2;
  const up = (volume.height * share) / 2;
  return {
    id: volume.id,
    min: { x: volume.x - w, y: middle - up, z: volume.y - h },
    max: { x: volume.x + w, y: middle + up, z: volume.y + h },
  };
}

type DoorLook = typeof TILE_SETTINGS.interior;

/**
 * Volumes de l'objet visible d'une porte, posés sur son seuil (`donnees/seuils.ts`) et tournés
 * vers la pièce où l'on arrive. Dans une pièce: l'encadrement et son vantail (la cible), plus un
 * paillasson qui marque le seuil au sol même quand la porte s'efface devant la caméra. Dehors: le
 * paillasson seul (le bâtiment porte déjà sa porte). Au sol: le cadre de l'escalier.
 */
export function doorVolumes(
  id: string,
  sill: Sill,
  indoor: boolean,
  look: DoorLook = TILE_SETTINGS.interior,
  /** Hauteur de coupe des murs de la pièce (son style); absente: porte jamais coupée. */
  cutHeight?: number,
): SceneVolume[] {
  const rotation = sill.ny > 0.5 ? 0 : sill.nx > 0.5 ? 1 : sill.ny < -0.5 ? 2 : 3;
  const plain = { model: null, rotation, base: 0 } as const;
  if (sill.kind === 'floor')
    return [
      {
        ...plain,
        id,
        x: sill.x,
        y: sill.y,
        w: look.hatch.size,
        h: look.hatch.size,
        height: look.hatch.height,
        shape: 'hatch',
        occludes: false,
        aimable: true,
      },
    ];
  const width = sill.halfWidth * 2;
  const out = look.mat.gap + look.mat.depth / 2;
  const mat: SceneVolume = {
    ...plain,
    id: indoor ? `${id}-tapis` : id,
    x: sill.x + sill.nx * out,
    y: sill.y + sill.ny * out,
    w: width * 0.9,
    h: look.mat.depth,
    height: look.mat.height,
    shape: 'mat',
    occludes: false,
    aimable: !indoor,
  };
  if (!indoor) return [mat];
  const back = look.door.depth / 2;
  return [
    {
      ...plain,
      id,
      x: sill.x - sill.nx * back,
      y: sill.y - sill.ny * back,
      w: width + look.doorJamb * 2,
      h: look.door.depth,
      height: look.door.height,
      shape: 'door',
      ...(cutHeight === undefined ? {} : { cutHeight }),
      occludes: true,
      aimable: true,
    },
    mat,
  ];
}

/**
 * Volumes fixes d'un lieu: ses zones bloquées et les meubles de sa carte. `extras`: volumes
 * ajoutés par l'appelant (page de démonstration, futur format des murs et des toits).
 */
export function describePlace(
  content: Content,
  place: PlaceContent,
  extras: readonly SceneVolume[] = [],
  settings: StandInSettings = RENDER_SETTINGS.standIn,
  /** Faux pour un grand lieu: haies, berges et murs montrent déjà ses zones pleines. */
  slabs = true,
): PlaceDescription {
  const volumes: SceneVolume[] = [];
  // Objets visibles des portes: dessinés sur leur seuil, en porte, tant qu'aucun modèle n'est livré.
  const sills = doorSills(place.map, DOORS.width);
  const doorOf = new Map<string, Sill>();
  for (const [id, door] of Object.entries(place.map.doors ?? {})) {
    const sill = sills[id];
    if (door.object !== undefined && sill !== undefined) doorOf.set(door.object, sill);
  }
  const roomAt = (x: number, y: number): (typeof place.interiors)[number] | undefined =>
    place.interiors.find(
      (r) => x >= r.at.x && y >= r.at.y && x < r.at.x + r.width && y < r.at.y + r.height,
    );
  (slabs ? place.map.blocked : []).forEach((rect, index) => {
    volumes.push({
      id: `zone-${String(index)}`,
      model: null,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      w: rect.w,
      h: rect.h,
      rotation: 0,
      base: 0,
      height: settings.blockedHeight,
      shape: 'slab',
      occludes: false,
      aimable: false,
    });
  });
  for (const object of place.map.objects) {
    const prop = content.props[object.type];
    // Les données sont contrôlées au chargement: un type inconnu n'arrive pas jusqu'ici.
    if (prop === undefined) continue;
    const sill = doorOf.get(object.id);
    if (sill !== undefined && DECOR_MANIFEST.models[prop.model] === undefined) {
      const room = roomAt(sill.x + sill.nx * 0.3, sill.y + sill.ny * 0.3);
      const cut = room === undefined ? undefined : roomStyle(room.style).cut;
      volumes.push(...doorVolumes(object.id, sill, room !== undefined, undefined, cut));
      continue;
    }
    volumes.push({
      id: object.id,
      model: prop.model,
      x: object.x,
      y: object.y,
      w: prop.size.w,
      h: prop.size.h,
      rotation: object.rotation,
      base: 0,
      // Hauteur du modèle livré quand il y en a un: une paroi de 2,15 m doit s'effacer devant
      // le joueur qu'elle cache, pas seulement sur 0,9 m.
      height: DECOR_MANIFEST.models[prop.model]?.size.h ?? settings.propHeight,
      shape: 'box',
      occludes: true,
      aimable: true,
    });
  }
  volumes.push(...extras);
  const { width, height, floor } = place.map;
  return { id: place.def.id, width, height, volumes, ...(floor === undefined ? {} : { floor }) };
}

/**
 * Emprises des meubles sous lesquels un objet au sol disparaîtrait: ceux de la carte et ceux que
 * les joueurs ont posés, s'ils sont plus hauts que `ground.hideHeight` (un potager, un tapis ne
 * cachent rien). L'emprise est celle du modèle livré quand elle est plus étroite que les cases.
 */
export function hidingFootprints(
  content: Content,
  place: PlaceContent | undefined,
  state: DeepReadonly<PlaceState>,
  settings: StandInSettings = RENDER_SETTINGS.standIn,
): Footprint[] {
  const out: Footprint[] = [];
  const add = (type: string, x: number, y: number, rotation: number): void => {
    const prop = content.props[type];
    if (prop === undefined) return;
    const model = DECOR_MANIFEST.models[prop.model]?.size;
    if ((model?.h ?? settings.propHeight) < HARVEST_LOOK.ground.hideHeight) return;
    const w = Math.min(prop.size.w, model?.w ?? prop.size.w);
    const h = Math.min(prop.size.h, model?.d ?? prop.size.h);
    const size = footprint({ w, h, rotation: (rotation % 4) as 0 | 1 | 2 | 3 });
    out.push({ x0: x - size.w / 2, z0: y - size.h / 2, x1: x + size.w / 2, z1: y + size.h / 2 });
  };
  for (const object of place?.map.objects ?? [])
    add(object.type, object.x, object.y, object.rotation);
  for (const placed of state.placed) add(placed.type, placed.x, placed.y, placed.rotation);
  // Haies, talus et repères livrés d'un grand lieu: on n'y laisse rien disparaître non plus.
  const map = place?.map;
  if (map !== undefined)
    out.push(...tallFootprints(map, () => groundField(map), HARVEST_LOOK.ground.hideHeight));
  return out;
}

/**
 * Volumes qui changent en cours de partie: meubles posés par les joueurs et objets au sol.
 * `place`: le lieu, pour sortir un objet au sol de l'emprise d'un meuble (sous un banc, on ne le
 * verrait plus); la place de l'état ne change pas, seule celle de l'affichage glisse au bord.
 */
export function describeDynamic(
  content: Content,
  state: DeepReadonly<PlaceState>,
  settings: StandInSettings = RENDER_SETTINGS.standIn,
  place?: PlaceContent,
): SceneVolume[] {
  const volumes: SceneVolume[] = [];
  const hiding = state.ground.length === 0 ? [] : hidingFootprints(content, place, state, settings);
  for (const placed of state.placed) {
    const prop = content.props[placed.type];
    if (prop === undefined) continue;
    volumes.push({
      id: placed.id,
      model: prop.model,
      x: placed.x,
      y: placed.y,
      w: prop.size.w,
      h: prop.size.h,
      rotation: placed.rotation,
      base: 0,
      height: settings.propHeight,
      shape: 'box',
      occludes: true,
      aimable: true,
    });
  }
  const bundle = HARVEST_LOOK.ground.bundle;
  for (const item of state.ground) {
    // Le modèle de ce qu'on a ramassé (une pierre, des branches), sinon un ballot: jamais un cube.
    const model = groundModelOf(content, item.stack.item);
    const size = model === null ? undefined : DECOR_MANIFEST.models[model]?.size;
    const k = HARVEST_LOOK.ground.modelScale;
    const w = size === undefined ? bundle.w : size.w * k;
    const h = size === undefined ? bundle.d : size.d * k;
    const shown = clearOf(item.x, item.y, Math.max(w, h) / 2, HARVEST_LOOK.ground.clearGap, hiding);
    volumes.push({
      id: `sol-${String(item.id)}`,
      model,
      x: shown.x,
      y: shown.z,
      w,
      h,
      rotation: 0,
      base: 0,
      height: size === undefined ? bundle.h : size.h * k,
      shape: 'box',
      color: settings.itemColor,
      occludes: false,
      aimable: false,
      ...(model === null ? { standIn: 'bundle' as const } : { scale: k }),
    });
  }
  return volumes;
}

/**
 * Empreinte de ce qui change dans l'état d'un lieu, sans allocation: le moteur ne refait les
 * volumes dynamiques que quand elle change (l'hôte modifie l'état en place, on ne peut pas
 * comparer des références).
 */
export function dynamicSignature(state: DeepReadonly<PlaceState>): number {
  let sum = state.nextPlacedId * 31 + state.nextGroundId * 17 + state.placed.length * 7;
  sum += state.ground.length * 3;
  for (const placed of state.placed) sum += placed.x * 1.3 + placed.y * 2.7 + placed.rotation;
  for (const item of state.ground) sum += item.x * 1.1 + item.y * 2.3 + item.stack.count;
  return sum;
}
