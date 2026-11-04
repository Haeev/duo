/**
 * Aperçu du cordeau (0.13, parcelles libres, section 5.1): la parcelle fantôme sous le pointeur ou
 * devant le personnage, et les cases d'un rectangle tracé. Vert plein (ficelle claire et piquets)
 * là où la parcelle se posera, rouge hachuré et barré d'une croix là où elle est refusée (la couleur
 * n'est jamais seule), contour en pointillé barré pour les cases en trop. En reprise: les
 * parcelles vides du rectangle barrées, celles qui portent une culture clignotent (elles restent).
 *
 * Les règles sont celles de la simulation (`etat/parcelles.ts`): chez l'invité, c'est une prévision.
 * Trois maillages fusionnés (un par teinte, même programme que les fantômes des meubles), refaits
 * seulement quand l'aperçu change; un refus de l'hôte fait trembler le fantôme rouge.
 */
import { type BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameMap } from '../etat/carte';
import { gardenCellAtIn, previewPlacement } from '../etat/parcelles';
import type { Cell, WorldEvent } from '../etat/types';
import type { PlotPreview } from '../etat/vue';
import type { Content } from '../donnees/types';
import type { FrameContext } from './contexte';
import { bakeGeometry } from './decor';
import { ShapeBuilder } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const SETTINGS = RENDER_SETTINGS.plotPreview;
const PARCEL_MODEL = 'garden_cell_grass';

type Tint = 'ok' | 'refused' | 'extra';
const TINTS: readonly Tint[] = ['ok', 'refused', 'extra'];

/** Ficelle tendue entre quatre piquets (vert), hachures et croix (rouge), pointillé barré (en trop). */
function overlay(kind: Tint): BufferGeometry {
  const b = new ShapeBuilder();
  const h = SETTINGS.inset / 2;
  const t = SETTINGS.line;
  const y = SETTINGS.lift;
  if (kind === 'ok') {
    for (const [x, z, w, d] of [
      [0, -h, h * 2, t],
      [0, h, h * 2, t],
      [-h, 0, t, h * 2],
      [h, 0, t, h * 2],
    ] as const) {
      b.box([w, t, d], [x, y + SETTINGS.stakeHeight * 0.8, z], 'white_paint');
    }
    for (const [x, z] of [
      [-h, -h],
      [h, -h],
      [-h, h],
      [h, h],
    ] as const) {
      b.box([t * 2, SETTINGS.stakeHeight, t * 2], [x, y, z], 'wood', { base: true });
    }
    return b.build();
  }
  if (kind === 'refused') {
    // Contour hachuré: trois traits en biais, puis la croix d'un coin à l'autre.
    const diagonal = h * 2 * Math.SQRT2;
    // Traits sombres (bois foncé teinté de rouge) au-dessus de la parcelle fantôme: ils se lisent sur elle.
    const top = y + SETTINGS.markLift;
    for (const offset of [-0.5, 0, 0.5]) {
      const length = diagonal * (1 - Math.abs(offset)) * 0.9;
      b.box([length, t, t * 1.4], [offset * h, top, -offset * h], 'wood_dark', { rotation: [0, 45, 0] });
    }
    b.box([diagonal * 0.95, t * 2, t * 2.4], [0, top + 0.01, 0], 'wood_dark', { rotation: [0, -45, 0] });
    b.box([diagonal * 0.95, t * 2, t * 2.4], [0, top + 0.01, 0], 'wood_dark', { rotation: [0, 45, 0] });
    return b.build();
  }
  // En trop: contour en pointillé (quatre tirets par côté) et un trait qui le barre.
  const dashes = 4;
  const dash = (h * 2) / (dashes * 2);
  for (let i = 0; i < dashes; i++) {
    const at = -h + dash / 2 + i * dash * 2;
    b.box([dash, t, t], [at, y, -h], 'white_paint');
    b.box([dash, t, t], [at, y, h], 'white_paint');
    b.box([t, t, dash], [-h, y, at], 'white_paint');
    b.box([t, t, dash], [h, y, at], 'white_paint');
  }
  b.box([h * 2 * Math.SQRT2 * 0.9, t, t], [0, y, 0], 'white_paint', { rotation: [0, 45, 0] });
  return b.build();
}

export class PlotPreviewPart implements EventfulPart {
  readonly group = new Group();
  private preview: PlotPreview | null = null;
  private readonly meshes: Record<Tint, Mesh>;
  private readonly materials: Record<Tint, MeshBasicMaterial>;
  private readonly body: BufferGeometry | null;
  private readonly overlays: Record<Tint, BufferGeometry>;
  private signature = '';
  private shakeUntil = Number.NEGATIVE_INFINITY;
  private readonly matrix = new Matrix4();
  private readonly cells: Cell[] = [];

  constructor(
    private readonly content: Content,
    private readonly map: GameMap,
    library: ModelLibrary,
    shared: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
  ) {
    this.group.name = 'apercu des parcelles';
    const parts = library.parts(PARCEL_MODEL).map((part) => bakeGeometry(part.geometry, part.matrix));
    const merged = parts.length === 0 ? null : parts.length === 1 ? (parts[0] ?? null) : mergeGeometries(parts, false);
    for (const part of parts) if (part !== merged) part.dispose();
    this.body = merged === null ? null : resources.track(merged);
    this.overlays = { ok: resources.track(overlay('ok')), refused: resources.track(overlay('refused')), extra: resources.track(overlay('extra')) };
    const make = (tint: Tint): MeshBasicMaterial =>
      resources.track(
        new MeshBasicMaterial({
          name: `lpl_plot_preview_${tint}`,
          map: shared.paletteTexture,
          color: SETTINGS.colors[tint],
          transparent: true,
          opacity: SETTINGS.opacity,
          depthWrite: false,
        }),
      );
    this.materials = { ok: make('ok'), refused: make('refused'), extra: make('extra') };
    const mesh = (tint: Tint): Mesh => {
      const m = new Mesh(undefined, this.materials[tint]);
      m.name = `apercu ${tint}`;
      m.visible = false;
      m.renderOrder = 2;
      m.frustumCulled = false;
      m.castShadow = false;
      this.group.add(m);
      return m;
    };
    this.meshes = { ok: mesh('ok'), refused: mesh('refused'), extra: mesh('extra') };
  }

  set(preview: PlotPreview | null): void {
    this.preview = preview;
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (event.type === 'plot_refused' && event.by === context.local && !context.reducedMotion) {
      this.shakeUntil = context.time + SETTINGS.shakeSeconds;
    }
  }

  /** L'état de chaque case de l'aperçu, et sa signature (on ne refait les maillages que si elle change). */
  private states(context: FrameContext): { tints: Tint[]; signature: string } {
    const preview = this.preview;
    if (preview === null || preview.cells.length === 0) return { tints: [], signature: '' };
    const world = context.world;
    let tints: Tint[];
    if (preview.mode === 'place') {
      tints = previewPlacement(this.content, this.map, world, preview.cells).map((s) => (s.kind === 'ok' ? 'ok' : s.kind === 'refused' ? 'refused' : 'extra'));
    } else {
      // Reprise: une parcelle vide part (barrée), une culture reste (elle clignote); hors parcelle, rien.
      tints = preview.cells.map((cell) => {
        const g = gardenCellAtIn(world, cell);
        return g === null ? 'extra' : g.crop === null && g.kind !== 'rented' ? 'refused' : 'ok';
      });
    }
    let signature = preview.mode;
    preview.cells.forEach((cell, i) => {
      signature += `|${String(cell.cx)},${String(cell.cy)}:${tints[i] ?? ''}`;
    });
    return { tints, signature };
  }

  private rebuild(tints: readonly Tint[], removing: boolean): void {
    const preview = this.preview;
    for (const tint of TINTS) {
      const mesh = this.meshes[tint];
      const pieces: BufferGeometry[] = [];
      preview?.cells.forEach((cell, i) => {
        if (tints[i] !== tint) return;
        // En reprise, les cases sans parcelle ne montrent rien.
        if (removing && tint === 'extra') return;
        const x = cell.cx + 0.5;
        const y = cell.cy + 0.5;
        this.matrix.makeTranslation(x, this.terrain.heightAt(x, y), y);
        const withBody = tint !== 'extra' && this.body !== null && !(removing && tint === 'ok');
        if (withBody) pieces.push(this.body.clone().applyMatrix4(this.matrix));
        const mark = removing ? (tint === 'refused' ? this.overlays.refused : this.overlays.extra) : this.overlays[tint];
        pieces.push(mark.clone().applyMatrix4(this.matrix));
      });
      const old = mesh.geometry;
      if (pieces.length === 0) {
        mesh.visible = false;
      } else {
        const merged = pieces.length === 1 ? (pieces[0] ?? null) : mergeGeometries(pieces, false);
        for (const piece of pieces) if (piece !== merged) piece.dispose();
        if (merged !== null) {
          merged.computeBoundingSphere();
          mesh.geometry = this.resources.track(merged);
          mesh.visible = true;
        }
      }
      if (old !== mesh.geometry) this.release(old);
    }
  }

  private release(geometry: BufferGeometry): void {
    if (geometry === this.body || TINTS.some((tint) => this.overlays[tint] === geometry)) return;
    this.resources.release(geometry);
  }

  update(context: FrameContext): void {
    const { tints, signature } = this.states(context);
    if (signature !== this.signature) {
      this.signature = signature;
      this.cells.length = 0;
      this.rebuild(tints, this.preview?.mode === 'remove');
    }
    if (signature === '') return;
    const pulse = context.reducedMotion ? 0 : Math.sin(context.time * Math.PI * 2 * SETTINGS.pulseHz) * SETTINGS.pulse;
    this.materials.ok.opacity = SETTINGS.opacity + pulse;
    // En reprise, la culture qui reste clignote; les cases en trop d'un tracé de pose restent pâles.
    this.materials.extra.opacity = this.preview?.mode === 'remove' ? SETTINGS.opacity * (0.6 + Math.abs(pulse) * 4) : SETTINGS.extraOpacity;
    this.materials.refused.opacity = SETTINGS.opacity;
    const shaking = context.time < this.shakeUntil;
    const dx = shaking ? Math.sin(context.time * SETTINGS.shakeSpeed) * SETTINGS.shakeAmplitude : 0;
    this.meshes.refused.position.set(dx, 0, 0);
  }

  dispose(): void {
    for (const tint of TINTS) this.release(this.meshes[tint].geometry);
    this.group.removeFromParent();
  }
}
