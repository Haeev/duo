/**
 * Les personnages vus par le moteur (`CharacterLayer`), et leur version provisoire en attendant le
 * lot L6: un bonhomme par joueur et par habitant, à la bonne taille (1,70 m), orienté (un nez
 * dit où il regarde), avec son ombre de contact. Le lot L6 fournit sa propre couche par
 * `RenderOptions.characters`: le moteur ne connaît que cette interface.
 */
import {
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  BoxGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Body } from '../etat/joueur';
import type { DeepReadonly, ReadonlyWorld } from '../etat/monde';
import type { PlaceState } from '../etat/lieu';
import { approach } from './camera';
import type { Aimable } from './cible';
import type { InkKit } from './encre/index';
import { Fadable } from './fondu';
import { RENDER_SETTINGS } from './reglages';

/** Ce que le moteur donne à une couche de personnages à chaque image. */
export interface CharacterFrame {
  readonly dt: number;
  readonly world: ReadonlyWorld;
  /** État du lieu courant (habitants). */
  readonly place: DeepReadonly<PlaceState>;
  /** Lacet affiché de la caméra (radians), pour ce qui doit lui faire face. */
  readonly cameraYaw: number;
}

/**
 * Couche des personnages. Elle ajoute ses objets à `root` (donné à la création), suit l'état à
 * chaque image et rend ce que le moteur lui demande: où sont les pieds affichés d'un joueur (la
 * caméra et l'occultation les suivent, pas l'état brut) et l'objet d'un habitant visé.
 */
export interface CharacterLayer {
  /** Arrivée dans un lieu: les personnages se posent d'un coup, sans glisser depuis l'ancien. */
  reset(): void;
  update(frame: CharacterFrame): void;
  /** Le joueur a été replacé (événement `unstuck`): pas de glissé, il se pose d'un coup. */
  snap(index: 0 | 1): void;
  /** Pieds affichés du joueur, sur la carte (x est, y sud); `null` avant la première image. */
  playerPosition(index: 0 | 1): { readonly x: number; readonly y: number } | null;
  /** Habitant visé par la touche d'action (identifiant de l'état), pour le faire réagir. */
  aimable(id: string): Aimable | null;
  dispose(): void;
}

export interface CharacterLayerDeps {
  readonly root: Object3D;
  /** Couleurs des deux joueurs (profils Duo), dans l'ordre des personnages 0 et 1. */
  readonly playerColors: readonly [string, string];
  /** Rendu encré (ADR 0023): les personnages prennent ses matériaux; absent: ancien rendu. */
  readonly ink?: InkKit | null;
}

export type CharacterLayerFactory = (deps: CharacterLayerDeps) => CharacterLayer;

type FigureSettings = typeof RENDER_SETTINGS.figure;

function paint(geometry: BufferGeometry, color: Color): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Corps, tête et nez en un seul maillage, pieds à l'origine, regard vers +Z. */
function figureGeometry(s: FigureSettings): BufferGeometry {
  const white = new Color('#ffffff');
  const headCenter = s.height - s.headRadius;
  const bodyTop = headCenter - s.headRadius * 0.6;
  const body = new CapsuleGeometry(s.bodyRadius, bodyTop - s.bodyRadius * 2, 6, 16).translate(
    0,
    bodyTop / 2,
    0,
  );
  const head = new SphereGeometry(s.headRadius, 18, 12).translate(0, headCenter, 0);
  const nose = new BoxGeometry(s.noseSize, s.noseSize, s.noseSize).translate(
    0,
    headCenter,
    s.headRadius,
  );
  const parts = [paint(body, white), paint(head, white), paint(nose, new Color(s.noseColor))];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

interface Figure extends Aimable {
  readonly object: Group;
  readonly material: Material;
  readonly fadable: Fadable;
  placed: boolean;
  x: number;
  y: number;
  facing: number;
}

class StandInCharacters implements CharacterLayer {
  private readonly geometry: BufferGeometry;
  private readonly blobGeometry: BufferGeometry;
  private readonly blobMaterial: Material;
  private readonly players: [Figure, Figure];
  private readonly villagers = new Map<string, Figure>();
  private readonly glowColor = new Color(RENDER_SETTINGS.target.rimColor);

  constructor(
    private readonly deps: CharacterLayerDeps,
    private readonly settings: FigureSettings = RENDER_SETTINGS.figure,
  ) {
    this.geometry = figureGeometry(settings);
    this.blobGeometry = new CircleGeometry(RENDER_SETTINGS.shadows.contactRadius, 20).rotateX(
      -Math.PI / 2,
    );
    this.blobMaterial =
      deps.ink?.contact ??
      new MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: RENDER_SETTINGS.shadows.contactOpacity,
        depthWrite: false,
      });
    this.players = [this.create(deps.playerColors[0]), this.create(deps.playerColors[1])];
  }

  private create(color: string): Figure {
    const ink = this.deps.ink ?? null;
    let material: Material;
    if (ink === null)
      material = new MeshStandardMaterial({ color, vertexColors: true, roughness: 0.85 });
    else {
      const inked = ink.characterMaterials();
      inked.head.dispose();
      inked.body.color.set(color);
      material = inked.body;
    }
    const object = new Group();
    const mesh = new Mesh(this.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Ombre de contact: une pastille sombre juste au-dessus du sol, sous les pieds.
    const blob = new Mesh(this.blobGeometry, this.blobMaterial);
    blob.position.y = 0.015;
    blob.renderOrder = 1;
    object.add(mesh);
    const fadable = new Fadable(mesh, this.glowColor);
    object.add(blob);
    this.deps.root.add(object);
    return {
      object,
      material,
      fadable,
      placed: false,
      x: 0,
      y: 0,
      facing: 0,
      setGlow: (glow) => {
        fadable.apply(1, glow);
      },
    };
  }

  private remove(figure: Figure): void {
    figure.fadable.dispose();
    figure.object.removeFromParent();
    figure.material.dispose();
  }

  private follow(figure: Figure, body: DeepReadonly<Body>, dt: number): void {
    if (!figure.placed) {
      figure.x = body.x;
      figure.y = body.y;
      figure.facing = body.facing;
      figure.placed = true;
    } else {
      const k = approach(dt, this.settings.smoothHalfLife);
      figure.x += (body.x - figure.x) * k;
      figure.y += (body.y - figure.y) * k;
      // Par le plus court chemin: un demi-tour ne fait pas un tour entier.
      const turn = Math.atan2(
        Math.sin(body.facing - figure.facing),
        Math.cos(body.facing - figure.facing),
      );
      figure.facing += turn * approach(dt, this.settings.turnHalfLife);
    }
    figure.object.position.set(figure.x, 0, figure.y);
    // Cap de l'état: 0 vers l'est, PI/2 vers le sud. Le bonhomme regarde vers +Z au repos.
    figure.object.rotation.y = Math.PI / 2 - figure.facing;
  }

  reset(): void {
    for (const figure of this.players) figure.placed = false;
    for (const figure of this.villagers.values()) this.remove(figure);
    this.villagers.clear();
  }

  snap(index: 0 | 1): void {
    this.players[index].placed = false;
  }

  update(frame: CharacterFrame): void {
    this.follow(this.players[0], frame.world.players[0].body, frame.dt);
    this.follow(this.players[1], frame.world.players[1].body, frame.dt);
    for (const id in frame.place.villagers) {
      const state = frame.place.villagers[id];
      if (state === undefined) continue;
      let figure = this.villagers.get(id);
      if (figure === undefined) {
        figure = this.create(this.settings.villagerColor);
        this.villagers.set(id, figure);
      }
      this.follow(figure, state.body, frame.dt);
    }
    if (this.villagers.size > 0) {
      for (const [id, figure] of this.villagers) {
        if (id in frame.place.villagers) continue;
        this.remove(figure);
        this.villagers.delete(id);
      }
    }
  }

  playerPosition(index: 0 | 1): { readonly x: number; readonly y: number } | null {
    const figure = this.players[index];
    return figure.placed ? figure : null;
  }

  aimable(id: string): Aimable | null {
    return this.villagers.get(id) ?? null;
  }

  dispose(): void {
    for (const figure of this.players) this.remove(figure);
    for (const figure of this.villagers.values()) this.remove(figure);
    this.villagers.clear();
    this.geometry.dispose();
    this.blobGeometry.dispose();
    // L'ombre de contact encrée appartient au rendu encré, qui la libère.
    if ((this.deps.ink ?? null) === null) this.blobMaterial.dispose();
  }
}

/** Couche provisoire: remplacée par celle du lot L6 quand elle est prête. */
export const createStandInCharacters: CharacterLayerFactory = (deps) => new StandInCharacters(deps);
