/**
 * Étiquettes des poules (quête « Les noms des poules », conception du tour 6, section 2.2): le nom
 * d'une poule flotte au-dessus d'elle, seulement sur l'écran du joueur qui le connaît
 * (`henNameVisible` de `etat/secrets.ts`, lu avec le joueur local). L'autre ne voit aucune
 * étiquette avant d'avoir trouvé le bon nom.
 *
 * Une étiquette est un petit panneau tourné vers la caméra, texte peint sur un canevas. Matériau de
 * base transparent à texture: le même programme que les fantômes de construction.
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Camera,
} from 'three';
import { henNameVisible } from '../etat/secrets';
import type { FrameContext } from './contexte';
import { interpolate } from './contexte';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

/** Hauteur du bas de l'étiquette au-dessus des pattes (m): juste au-dessus de la crête. */
const LIFT = 0.62;
/** Hauteur du texte à l'écran (m du monde): plus petit que les noms d'habitants. */
const TEXT_HEIGHT = 0.2;
const CANVAS_HEIGHT = 64;
const FONT_PX = 40;
const PADDING_PX = 18;
const FONT = `700 ${String(FONT_PX)}px "Nunito Sans Variable", "Nunito Sans", system-ui, sans-serif`;
const INK = '#2e2a24';
const PAPER = 'rgba(250, 244, 228, 0.92)';
const RADIUS_PX = 22;

interface Label {
  mesh: Mesh;
  material: MeshBasicMaterial;
  texture: CanvasTexture;
  text: string;
}

export class HenLabels {
  readonly group = new Group();
  private readonly labels = new Map<string, Label>();
  private readonly geometry: PlaneGeometry;
  private readonly point = { x: 0, y: 0 };
  private readonly seen = new Set<string>();

  constructor(
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly camera: Camera,
  ) {
    this.group.name = 'etiquettes des poules';
    // Panneau d'une unité de haut, origine au milieu du bas: on l'étire à la largeur du texte.
    this.geometry = resources.track(new PlaneGeometry(1, 1).translate(0, 0.5, 0));
  }

  private paint(label: Label, text: string): void {
    const canvas = label.texture.image;
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.font = FONT;
    const width = Math.ceil(context.measureText(text).width) + PADDING_PX * 2;
    canvas.width = width;
    canvas.height = CANVAS_HEIGHT;
    context.font = FONT;
    context.clearRect(0, 0, width, CANVAS_HEIGHT);
    context.fillStyle = PAPER;
    context.beginPath();
    context.roundRect(1, 1, width - 2, CANVAS_HEIGHT - 2, RADIUS_PX);
    context.fill();
    context.fillStyle = INK;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, CANVAS_HEIGHT / 2 + 2);
    label.texture.needsUpdate = true;
    label.mesh.scale.set((TEXT_HEIGHT * width) / CANVAS_HEIGHT, TEXT_HEIGHT, 1);
    label.text = text;
  }

  private create(): Label {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = CANVAS_HEIGHT;
    const texture = this.resources.track(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const material = this.resources.trackMaterial(
      new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    const mesh = new Mesh(this.geometry, material);
    mesh.name = 'etiquette';
    mesh.renderOrder = 4;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    return { mesh, material, texture, text: '' };
  }

  update(context: FrameContext): void {
    const world = context.world;
    const seen = this.seen;
    seen.clear();
    for (const hen of world.hens) {
      // Le secret ne s'affiche que chez qui le connaît (S-02).
      if (!henNameVisible(world, hen, context.local)) continue;
      seen.add(hen.id);
      let label = this.labels.get(hen.id);
      if (label === undefined) {
        label = this.create();
        this.labels.set(hen.id, label);
      }
      if (label.text !== hen.name) this.paint(label, hen.name);
      const at = interpolate(hen.prev, hen.pos, context.alpha, this.point);
      label.mesh.visible = true;
      label.mesh.position.set(at.x, this.terrain.heightAt(at.x, at.y) + LIFT, at.y);
      label.mesh.quaternion.copy(this.camera.quaternion);
    }
    // 0.12: le coq, les poussines et les chèvres, nommés par les joueurs (connus des deux).
    const b = world.breeding;
    const named: {
      id: string;
      name: string;
      prev: { x: number; y: number };
      pos: { x: number; y: number };
      lift: number;
    }[] = [];
    if (b.rooster !== null) named.push({ ...b.rooster, lift: LIFT + 0.12 });
    for (const c of b.chicks) named.push({ ...c, lift: 0.22 });
    // Rentrée à la chevrerie, la chèvre n'a pas d'étiquette (elle attend à la porte ou dort dedans).
    for (const g of b.goats) if (!g.home) named.push({ ...g, lift: 1.05 });
    for (const a of named) {
      if (a.name === '') continue;
      seen.add(a.id);
      let label = this.labels.get(a.id);
      if (label === undefined) {
        label = this.create();
        this.labels.set(a.id, label);
      }
      if (label.text !== a.name) this.paint(label, a.name);
      const at = interpolate(a.prev, a.pos, context.alpha, this.point);
      label.mesh.visible = true;
      label.mesh.position.set(at.x, this.terrain.heightAt(at.x, at.y) + a.lift, at.y);
      label.mesh.quaternion.copy(this.camera.quaternion);
    }
    for (const [id, label] of this.labels) {
      if (!seen.has(id)) label.mesh.visible = false;
    }
  }

  /** Textes affichés (essais: l'écran de l'autre ne montre aucun nom avant le bon). */
  shownTexts(): string[] {
    return [...this.labels.values()].filter((l) => l.mesh.visible).map((l) => l.text);
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
