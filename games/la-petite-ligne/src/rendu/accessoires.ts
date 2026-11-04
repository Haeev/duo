/**
 * Accessoires des habitants de la 0.13 (lot H6, `docs/jeux/jeu-1/v0-13-habitants.md` section 2.3):
 * ce que chacun porte, et quand. Les règles sont des réglages (`RENDER_SETTINGS.characters.villagerProps`):
 * l'état d'un habitant (marche, activité de l'emploi du temps, habitude du lot H1 quand l'état la
 * porte) dit lequel se montre. Rien n'est tiré au hasard: mêmes accessoires chez l'hôte et chez
 * l'invité.
 *
 * - `hand`: pend sous `socket_hand_r` (cartable, pot à lait) ou se porte à l'épaule hors geste
 *   (hache, prise de `prise.ts`);
 * - `chest`: tenu devant la poitrine entre les deux mains (accordéon, clips `carry_one`);
 * - `bike`: vélo poussé à la main, à la gauche de l'habitant (clips `push_bike`), roues qui tournent;
 * - `worn`: pièce fusionnée au corps (la loupe d'Ambroise), comme l'écharpe de Firmin.
 *
 * Les vélos et l'objet tenu devant soi sont posés par `VillagerCarry`, après l'animation.
 */
import {
  Box3,
  DataTexture,
  Mesh,
  NoColorSpace,
  RGBAFormat,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { DeepReadonly, VillagerState } from '../etat/types';
import type { ModelLibrary } from './modeles';
import type { ResourceTracker } from './ressources';

export type PropMount = 'hand' | 'chest' | 'bike' | 'worn';

/** Dans `activities`: toute activité, arrêté. */
export const ANY_ACTIVITY = '*';

export interface VillagerPropRule {
  /** Nœud de l'artiste (`personnages.glb`). */
  model: string;
  mount: PropMount;
  /** Montré en marchant. */
  walking: boolean;
  /** Montré arrêté dans l'une de ces activités d'emploi du temps (`'*'`: toutes). */
  activities: readonly string[];
  /**
   * Habitudes (champ `habit` du lot H1) où il le porte; vide: toutes. En marchant, l'habitude
   * visée ou celle qu'il vient de quitter (le vélo de la tournée, à l'aller comme au retour).
   */
  habits: readonly string[];
  /** Montré tant que l'état ne dit pas encore l'habitude (avant le lot H1). */
  untracked: boolean;
  /** Clip joué arrêté avec l'accessoire à la place de celui de l'activité, ou `null`. */
  stillClip: string | null;
}

/** Ce que le rendu sait d'un habitant à cette image, pour choisir ses accessoires. */
export interface PropSituation {
  moving: boolean;
  activity: string;
  /** Habitude en cours, `null` si l'état ne la porte pas. */
  habit: string | null;
  /** Habitude d'avant la marche en cours (dernière vue à l'arrêt ou hors de vue), ou `null`. */
  left: string | null;
  /** En conversation: il garde ce qu'il avait (arrêté par un joueur en chemin). */
  talking: boolean;
}

/**
 * Habitude en cours d'un habitant: le champ `habit` que le lot H1 ajoute à l'état, `null` tant
 * qu'il n'existe pas (lecture par `in`, sans changer le type de l'état ici).
 */
export function villagerHabit(villager: DeepReadonly<VillagerState>): string | null {
  if ('habit' in villager) {
    const habit: unknown = villager.habit;
    return typeof habit === 'string' ? habit : null;
  }
  return null;
}

/** La règle s'applique-t-elle à cette situation ? */
export function ruleApplies(rule: VillagerPropRule, situation: PropSituation): boolean {
  const base = situation.moving
    ? rule.walking
    : rule.activities.includes(ANY_ACTIVITY) || rule.activities.includes(situation.activity);
  if (!base) return false;
  if (rule.habits.length === 0) return true;
  if (situation.habit === null) return rule.untracked;
  return (
    rule.habits.includes(situation.habit) ||
    (situation.moving && situation.left !== null && rule.habits.includes(situation.left))
  );
}

/**
 * Accessoire montré parmi `rules` (la première règle qui s'applique), en ne regardant que les
 * règles de pièces portées (`worn`) ou que les autres. En conversation, il garde l'accessoire
 * de l'image d'avant (`previous`), pour que rien ne disparaisse quand un joueur l'arrête.
 */
export function chooseProp(
  rules: readonly VillagerPropRule[],
  situation: PropSituation,
  worn: boolean,
  previous: VillagerPropRule | null,
): VillagerPropRule | null {
  if (situation.talking && previous !== null) return previous;
  for (const rule of rules) {
    if ((rule.mount === 'worn') === worn && ruleApplies(rule, situation)) return rule;
  }
  return null;
}

/**
 * Angle (rad) dont tournent les roues d'un vélo poussé quand le pousseur, tourné de `yaw` (son
 * avant: +Z local, `rotation.y = yaw`), se déplace de (dx, dz) dans le monde: la distance
 * parcourue vers l'avant divisée par le rayon (positif en avançant, autour du X local des roues).
 */
export function wheelTurn(dx: number, dz: number, yaw: number, radius: number): number {
  if (!(radius > 0)) return 0;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / radius;
}

/**
 * Échelle d'un habitant: celle des données (`habitants.json`, champ `scale`), sinon l'échelle de
 * pose de l'artiste (extra `scale` du nœud, pour un habitant pas encore transcrit), sinon 1.
 */
export function villagerScale(
  dataScale: number | undefined,
  extras: Readonly<Record<string, unknown>>,
): number {
  if (dataScale !== undefined && dataScale > 0) return dataScale;
  const scale = extras.scale;
  return typeof scale === 'number' && scale > 0 ? scale : 1;
}

/** Réglages des vélos poussés (fiche de l'artiste: roues enfants, rayon, clips). */
export interface BikeSettings {
  /** Rayon des roues si le modèle n'a pas d'extra `wheel_radius` (m). */
  wheelRadius: number;
  /** Suffixes des nœuds des roues sous le vélo. */
  wheels: readonly string[];
  walkClip: string;
  idleClip: string;
}

/** Matériau à remplacer dans un accessoire, et son remplaçant. */
export interface MaterialSwap {
  palette: Material;
  held: Material;
}

const BYTE = 255;

function pixelTexture(r: number, g: number, b: number, resources: ResourceTracker): DataTexture {
  const texture = new DataTexture(new Uint8Array([r, g, b, BYTE]), 1, 1, RGBAFormat);
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return resources.track(texture);
}

/**
 * Matériau des accessoires des habitants (vélos, cartable, pot à lait, hache, accordéon): pièces
 * fixes peintes dans la texture des personnages. Avec le matériau des personnages, un maillage
 * sans squelette compilerait un programme de plus (13 pour un budget de 12, mesuré le
 * 2026-11-03). Copie du matériau des outils tenus (`held`, même programme que la palette), avec
 * la texture des personnages, leur rugosité et leur métal en texture d'un pixel, et une lueur de
 * nuit noire (aucune case ne s'allume).
 */
export function accessoryMaterial(
  held: MeshStandardMaterial,
  characters: MeshStandardMaterial,
  resources: ResourceTracker,
): MeshStandardMaterial {
  const material = resources.track(held.clone());
  material.name = 'accessoires des habitants';
  // Même compilation et même clé que les outils tenus: le programme est partagé.
  material.onBeforeCompile = (shader, renderer): void => {
    held.onBeforeCompile(shader, renderer);
  };
  material.customProgramCacheKey = (): string => held.customProgramCacheKey();
  material.map = characters.map;
  // Rugosité dans le vert, métal dans le bleu (convention de glTF, comme la palette).
  const roughMetal = pixelTexture(
    0,
    Math.round(characters.roughness * BYTE),
    Math.round(characters.metalness * BYTE),
    resources,
  );
  material.roughnessMap = roughMetal;
  material.metalnessMap = roughMetal;
  material.roughness = 1;
  material.metalness = 1;
  material.emissiveMap = pixelTexture(0, 0, 0, resources);
  return material;
}

/** Remplace le matériau `swap.palette` par `swap.held` dans un accessoire (copie propre, modèle partagé intact). */
export function swapMaterial(root: Object3D, swap: MaterialSwap | null): void {
  if (swap === null) return;
  root.traverse((object) => {
    if (object instanceof Mesh && object.material === swap.palette) object.material = swap.held;
  });
}

const tmpLeft = new Vector3();
const tmpRight = new Vector3();

/**
 * Vélo poussé et objet tenu devant soi d'un habitant: enfants de sa racine (mêmes position,
 * orientation et échelle que lui, comme le veut la fiche de l'artiste). Les roues tournent
 * selon le chemin réellement dessiné, la prise suit les deux mains après l'animation.
 */
export class VillagerCarry {
  private bike: Object3D | null = null;
  private bikeModel = '';
  private readonly wheels: Object3D[] = [];
  private radius: number;
  private angle = 0;
  private readonly last = new Vector3();
  private hasLast = false;
  private chest: Object3D | null = null;
  private chestModel = '';
  private chestReach = 0;
  private chestDrop = 0;

  constructor(
    private readonly root: Object3D,
    private readonly library: ModelLibrary,
    private readonly settings: BikeSettings,
    private readonly swap: MaterialSwap | null = null,
  ) {
    this.radius = settings.wheelRadius;
  }

  /** Vélo poussé (`model`) ou aucun (`null`). */
  setBike(model: string | null): void {
    const name = model ?? '';
    if (name === this.bikeModel) return;
    this.bike?.removeFromParent();
    this.bike = null;
    this.wheels.length = 0;
    this.bikeModel = name;
    this.hasLast = false;
    if (model === null) return;
    const bike = this.library.instantiate(model);
    swapMaterial(bike, this.swap);
    bike.traverse((object) => {
      object.castShadow = true;
      object.receiveShadow = true;
    });
    for (const suffix of this.settings.wheels) {
      const wheel = bike.getObjectByName(`${model}${suffix}`);
      if (wheel !== undefined) this.wheels.push(wheel);
    }
    const radius = this.library.extras(model).wheel_radius;
    this.radius = typeof radius === 'number' && radius > 0 ? radius : this.settings.wheelRadius;
    this.root.add(bike);
    this.bike = bike;
  }

  /**
   * Objet tenu devant la poitrine (`model`) ou aucun. `reach` (m): poussé d'autant devant les mains,
   * en long (charge portée à deux, S09: son milieu entre les deux porteurs).
   */
  setChest(model: string | null, reach = 0): void {
    const name = model ?? '';
    if (name === this.chestModel && reach === this.chestReach) return;
    this.chest?.removeFromParent();
    this.chestReach = reach;
    this.chestDrop = 0;
    this.chest = model === null ? null : this.library.instantiate(model);
    if (this.chest !== null) {
      // Une charge portée à deux vient du décor (palette), pas de `personnages.png`: pas d'échange de
      // matériau. Sa longueur (son X) va d'un porteur à l'autre.
      if (reach === 0) swapMaterial(this.chest, this.swap);
      else {
        this.chest.rotation.y = Math.PI / 2;
        // Tenue par les côtés: les mains à mi-hauteur de la charge (son origine est à sa base).
        this.chestDrop = new Box3().setFromObject(this.chest).getSize(tmpRight).y / 2;
      }
      this.chest.traverse((object) => {
        object.castShadow = true;
      });
      this.root.add(this.chest);
    }
    this.chestModel = name;
  }

  /**
   * Après la pose de l'image (position, orientation, mélangeur): roues tournées du chemin
   * parcouru depuis l'image d'avant (un saut plus long que `teleport` ne compte pas), objet
   * tenu au milieu des deux mains (`hands` écrit leurs positions dans le monde, faux sans accroche).
   */
  update(teleport: number, hands: (left: Vector3, right: Vector3) => boolean): void {
    const at = this.root.position;
    if (this.bike !== null) {
      if (this.hasLast) {
        const dx = at.x - this.last.x;
        const dz = at.z - this.last.z;
        if (Math.hypot(dx, dz) <= teleport) {
          this.angle += wheelTurn(dx, dz, this.root.rotation.y, this.radius * this.root.scale.x);
          // Angle ramené dans un tour: aucune perte de précision au bout d'une longue partie.
          this.angle %= 2 * Math.PI;
        }
      }
      for (const wheel of this.wheels) wheel.rotation.x = this.angle;
    }
    this.last.copy(at);
    this.hasLast = true;
    if (this.chest !== null && hands(tmpLeft, tmpRight)) {
      tmpLeft.add(tmpRight).multiplyScalar(0.5);
      this.root.worldToLocal(tmpLeft);
      const ahead = Math.hypot(tmpLeft.x, tmpLeft.z);
      if (this.chestReach !== 0 && ahead > 1e-6) {
        tmpLeft.x += (tmpLeft.x / ahead) * this.chestReach;
        tmpLeft.z += (tmpLeft.z / ahead) * this.chestReach;
      }
      tmpLeft.y -= this.chestDrop;
      this.chest.position.copy(tmpLeft);
    }
  }

  /** Accessoire visible (vélo ou objet tenu), pour le diagnostic. */
  shown(): { bike: string | null; chest: string | null } {
    return {
      bike: this.bikeModel === '' ? null : this.bikeModel,
      chest: this.chestModel === '' ? null : this.chestModel,
    };
  }

  dispose(): void {
    this.setBike(null);
    this.setChest(null);
  }
}
