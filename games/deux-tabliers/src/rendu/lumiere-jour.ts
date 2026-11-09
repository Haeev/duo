/**
 * Lumière du jour dans la scène (retour de séance du 2026-11-09), d'après `decor/lumiere.ts`:
 * - lumières de la scène (meubles, personnages): couleur et direction du soleil, ciel et ambiance;
 * - coque cuite: teinte de la place et du feuillage (`street_*`, `dt_feuillage`, couleur du
 *   matériau), du dôme du ciel (`dt_ciel`), force de la lumière cuite de la salle (`lightMapIntensity`);
 * - lampes du café (`dt_lampe`) éteintes le jour, allumées le soir; lanternes des réverbères de la
 *   place et de l'applique de la rue allumées par des verres lumineux posés sur les lanternes cuites.
 *
 * Aucun programme de plus: on ne change que des uniformes (couleurs, intensités), et les verres des
 * lanternes prennent le programme des lampes (`MeshBasicMaterial` couleur seule, comme `dt_lampe`).
 * Aucune ombre calculée. Les valeurs d'origine sont relevées une fois par matériau et par lumière:
 * on multiplie, jamais on n'accumule.
 *
 * Le café fermé (`cafe-ferme.ts`, option `externalLight`) assombrit la salle tant que les vitrines
 * sont blanches: ses facteurs (`roomLight`, `sceneLight`) multiplient ceux de l'heure.
 */
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Color,
  type Light,
  type Material,
  type Object3D,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDaylight, daylightAt, hexToLinear, type Daylight, type Rgb } from '../decor/lumiere';
import { DAYLIGHT } from '../decor/reglages';

/** Lanternes de la place cuite (`assets-src/modeles/lib/place.py`): centre du verre, côté du verre. */
const STREET_LANTERNS: readonly (readonly [number, number, number])[] = [
  // réverbères (x, z au sol -0,16; verre de 3,32 à 3,56 m au-dessus)
  [8.65, 3.44, 18.9],
  [-3.0, 3.44, 18.9],
  [11.2, 3.44, 25.1],
  [21.3, 3.44, 25.0],
  [-2.0, 3.44, 25.1],
  // applique du coin de la rue, sur la façade du café
  [11.2, 3.65, 13.55],
];
const LANTERN_GLASS = { side: 0.26, height: 0.26 } as const;

export interface DaylightFactors {
  /** Facteur de la lumière cuite de la salle (café fermé: vitrines blanches). */
  roomLight(): number;
  /** Facteur des lumières de la scène (meubles, personnages). */
  sceneLight(): number;
}

export interface DaylightRig {
  /** Chaque image: minute de jeu (480: 8 h) et temps qu'il fait. */
  update(minute: number, weather: string): void;
  /** La lumière calculée à la dernière image (pour le décor: passants, réverbères). */
  current(): Readonly<Daylight>;
  /** Le café fermé branche ses facteurs (ou `null` pour les retirer). */
  setFactors(factors: DaylightFactors | null): void;
  dispose(): void;
}

interface LightBase {
  readonly light: Light;
  readonly intensity: number;
  readonly color: Color;
  readonly ground: Color | null;
}

interface MaterialBase {
  readonly material: MeshBasicMaterial;
  readonly kind: 'outdoor' | 'sky' | 'interior' | 'lamp';
  readonly color: Color;
  readonly lightMapIntensity: number;
}

function kindOf(m: MeshBasicMaterial): MaterialBase['kind'] | null {
  if (m.name === 'dt_lampe') return 'lamp';
  if (m.name === 'dt_ciel') return 'sky';
  if (m.name.startsWith('street_') || m.name === 'dt_feuillage') return 'outdoor';
  if (m.lightMap !== null) return 'interior';
  return null;
}

export function createDaylightRig(scene: Scene): DaylightRig {
  const day = createDaylight();
  let factors: DaylightFactors | null = null;
  const lights: LightBase[] = [];
  let sun: { light: DirectionalLight; base: LightBase } | null = null;
  const materials: MaterialBase[] = [];
  const seen = new WeakSet<Material>();
  let scanIn = 0;

  const scan = (): void => {
    scene.traverse((o: Object3D) => {
      if (
        (o instanceof HemisphereLight ||
          o instanceof AmbientLight ||
          o instanceof DirectionalLight) &&
        !lights.some((l) => l.light === o)
      ) {
        const base: LightBase = {
          light: o,
          intensity: o.intensity,
          color: o.color.clone(),
          ground: o instanceof HemisphereLight ? o.groundColor.clone() : null,
        };
        lights.push(base);
        if (o instanceof DirectionalLight && sun === null) sun = { light: o, base };
      }
      const m = o instanceof Mesh ? (o.material as Material) : null;
      if (!(m instanceof MeshBasicMaterial) || seen.has(m) || m === glassMaterial) return;
      seen.add(m);
      const kind = kindOf(m);
      if (kind === null) return;
      materials.push({
        material: m,
        kind,
        color: m.color.clone(),
        lightMapIntensity: m.lightMapIntensity,
      });
    });
  };

  // Verres allumés des lanternes: un maillage fusionné (l'instanciation changerait le programme),
  // matériau des lampes (couleur seule).
  const merged = mergedLanterns();
  const glassMaterial = merged.material;
  merged.mesh.name = 'lanternes_allumees';
  merged.mesh.visible = false;
  scene.add(merged.mesh);

  const tmp: Rgb = [0, 0, 0];
  const lampOff: Rgb = hexToLinear(DAYLIGHT.lampOff, [0, 0, 0]);
  const lampOn: Rgb = hexToLinear(DAYLIGHT.lampOn, [0, 0, 0]);
  const streetOn: Rgb = hexToLinear(DAYLIGHT.streetLampOn, [0, 0, 0]);

  return {
    update(minute, weather) {
      if (scanIn <= 0) {
        scan();
        scanIn = 60;
      }
      scanIn--;
      daylightAt(minute, weather, day);
      const room = factors?.roomLight() ?? 1;
      const inside = factors?.sceneLight() ?? 1;
      for (const l of lights) {
        const o = l.light;
        if (o instanceof DirectionalLight) {
          o.intensity = l.intensity * day.sunIntensity * inside;
          o.color.setRGB(day.sun[0], day.sun[1], day.sun[2]);
        } else if (o instanceof HemisphereLight) {
          o.intensity = l.intensity * day.skyIntensity * inside;
          o.color.setRGB(day.sky[0], day.sky[1], day.sky[2]);
        } else o.intensity = l.intensity * day.ambientIntensity * inside;
      }
      if (sun !== null) {
        const d = day.sunDir;
        sun.light.position.set(d[0] * 20, d[1] * 20, d[2] * 20);
        sun.light.target.position.set(0, 0, 0);
      }
      for (const b of materials) {
        const m = b.material;
        if (b.kind === 'outdoor')
          m.color.setRGB(
            b.color.r * day.outdoor[0],
            b.color.g * day.outdoor[1],
            b.color.b * day.outdoor[2],
          );
        else if (b.kind === 'sky')
          m.color.setRGB(
            b.color.r * day.skyDome[0],
            b.color.g * day.skyDome[1],
            b.color.b * day.skyDome[2],
          );
        else if (b.kind === 'interior')
          m.lightMapIntensity = b.lightMapIntensity * day.interior * room;
        else {
          const k = day.lamps;
          const boost = 1 + (DAYLIGHT.lampOnBoost - 1) * k;
          for (let i = 0; i < 3; i++)
            tmp[i] = ((lampOff[i] ?? 0) + ((lampOn[i] ?? 0) - (lampOff[i] ?? 0)) * k) * boost;
          m.color.setRGB(tmp[0], tmp[1], tmp[2]);
        }
      }
      merged.mesh.visible = day.lamps > 0.02;
      const k = day.lamps * DAYLIGHT.streetLampBoost;
      glassMaterial.color.setRGB(streetOn[0] * k, streetOn[1] * k, streetOn[2] * k);
    },
    current: () => day,
    setFactors(f) {
      factors = f;
    },
    dispose() {
      for (const l of lights) {
        l.light.intensity = l.intensity;
        l.light.color.copy(l.color);
      }
      for (const b of materials) {
        b.material.color.copy(b.color);
        b.material.lightMapIntensity = b.lightMapIntensity;
      }
      scene.remove(merged.mesh);
      merged.dispose();
    },
  };
}

/** Verres des lanternes en un maillage (un appel de dessin), matériau couleur seule. */
function mergedLanterns(): { mesh: Mesh; material: MeshBasicMaterial; dispose(): void } {
  const parts: BoxGeometry[] = [];
  const m4 = new Matrix4();
  for (const [x, y, z] of STREET_LANTERNS) {
    const g = new BoxGeometry(LANTERN_GLASS.side, LANTERN_GLASS.height, LANTERN_GLASS.side);
    // Lanterne à quatre pans dont les faces suivent les axes (`lanterne` de place.py, phase 45°).
    m4.makeTranslation(x, y, z);
    g.applyMatrix4(m4);
    parts.push(g);
  }
  const geometry = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const material = new MeshBasicMaterial({ name: 'dt_lanterne_allumee', color: '#ffd79a' });
  const mesh = new Mesh(geometry, material);
  return {
    mesh,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
