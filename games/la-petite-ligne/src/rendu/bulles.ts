/**
 * Bulles des habitants (0.13, lot H7, sections 7.2 et 7.3 de `v0-13-habitants.md`): les répliques
 * des scènes entre habitants (`sceneBubbles` de `etat/vie.ts`, lues dans l'état: les mêmes chez
 * l'hôte et chez l'invité) et les remarques faites à un joueur (événement `villager_remark`,
 * montrées chez ce joueur seulement). Une bulle se lit à moins de `bubbleRange` m, du même côté
 * d'un mur.
 *
 * Même procédé que les étiquettes des poules (`etiquettes.ts`): un panneau tourné vers la caméra,
 * texte peint sur un canevas, matériau de base transparent (le programme des fantômes).
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
import type { Content } from '../donnees/types';
import { lifePlace, sceneBubbles, type SceneBubble } from '../etat/vie';
import type { WorldEvent } from '../etat/types';
import type { FrameContext } from './contexte';
import { interpolate } from './contexte';
import type { EventfulPart } from './monde';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

/** Hauteur du bas de la bulle au-dessus des pieds (m): juste au-dessus du chapeau, assis plus bas. */
const LIFT_STANDING = 2.05;
const LIFT_SEATED = 1.6;
/** Hauteur d'une ligne à l'écran (m du monde). */
const LINE_HEIGHT = 0.17;
const LINE_PX = 46;
const FONT_PX = 34;
const PADDING_PX = 20;
const MAX_LINE_CHARS = 30;
const FONT = `600 ${String(FONT_PX)}px "Nunito Sans Variable", "Nunito Sans", system-ui, sans-serif`;
const INK = '#2e2a24';
const PAPER = 'rgba(255, 251, 240, 0.94)';
const RADIUS_PX = 22;
/** Durée d'une remarque faite à un joueur (s). */
const REMARK_SECONDS = 3.5;

interface Bubble {
  mesh: Mesh;
  texture: CanvasTexture;
  text: string;
}

/** Coupe un texte en lignes de `MAX_LINE_CHARS` caractères au plus, aux espaces. */
export function wrapBubble(text: string, max = MAX_LINE_CHARS): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export class VillagerBubbles implements EventfulPart {
  readonly group = new Group();
  private readonly bubbles = new Map<string, Bubble>();
  private readonly geometry: PlaneGeometry;
  private readonly point = { x: 0, y: 0 };
  private readonly shown = new Map<string, string>();
  private readonly scenes: SceneBubble[] = [];
  /** Remarques en cours: habitant, texte, fin (temps du rendu). */
  private readonly remarks = new Map<string, { text: string; until: number }>();

  constructor(
    private readonly content: Content,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly camera: Camera,
  ) {
    this.group.name = 'bulles des habitants';
    this.geometry = resources.track(new PlaneGeometry(1, 1).translate(0, 0.5, 0));
  }

  private paint(bubble: Bubble, text: string): void {
    const canvas = bubble.texture.image;
    const context = canvas.getContext('2d');
    if (context === null) return;
    const lines = wrapBubble(text);
    context.font = FONT;
    const textWidth = Math.max(...lines.map((l) => context.measureText(l).width));
    const width = Math.ceil(textWidth) + PADDING_PX * 2;
    const height = lines.length * LINE_PX + PADDING_PX;
    canvas.width = width;
    canvas.height = height;
    context.font = FONT;
    context.clearRect(0, 0, width, height);
    context.fillStyle = PAPER;
    context.beginPath();
    context.roundRect(1, 1, width - 2, height - 2, RADIUS_PX);
    context.fill();
    context.fillStyle = INK;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    lines.forEach((l, i) => {
      context.fillText(l, width / 2, PADDING_PX / 2 + LINE_PX * (i + 0.5) + 2);
    });
    bubble.texture.needsUpdate = true;
    const scale = LINE_HEIGHT / LINE_PX;
    bubble.mesh.scale.set(width * scale, height * scale, 1);
    bubble.text = text;
  }

  private create(): Bubble {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const texture = this.resources.track(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const material = this.resources.trackMaterial(
      // Toujours lisible: une bulle passe devant un auvent ou un toit (comme une étiquette d'interface).
      new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }),
    );
    const mesh = new Mesh(this.geometry, material);
    mesh.name = 'bulle';
    mesh.renderOrder = 5;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    return { mesh, texture, text: '' };
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (event.type !== 'villager_remark' || event.to !== context.local) return;
    this.remarks.set(event.villager, { text: event.text, until: context.time + REMARK_SECONDS });
  }

  update(context: FrameContext): void {
    const world = context.world;
    const shown = this.shown;
    shown.clear();
    for (const b of sceneBubbles(this.content, world, this.scenes)) shown.set(b.by, b.text);
    // Une remarque faite à ce joueur passe devant la scène.
    for (const [who, r] of this.remarks) {
      if (r.until <= context.time) this.remarks.delete(who);
      else shown.set(who, r.text);
    }
    const me = world.characters.find((c) => c.id === context.local);
    const range = this.content.village.bubbleRange;
    for (const [who, text] of shown) {
      const v = world.villagers.find((x) => x.id === who);
      if (v === undefined || me === undefined || !v.visible || v.inside !== me.inside) {
        shown.delete(who);
        continue;
      }
      if (Math.hypot(v.pos.x - me.pos.x, v.pos.y - me.pos.y) > range) {
        shown.delete(who);
        continue;
      }
      let bubble = this.bubbles.get(who);
      if (bubble === undefined) {
        bubble = this.create();
        this.bubbles.set(who, bubble);
      }
      if (bubble.text !== text) this.paint(bubble, text);
      const at = interpolate(v.prev, v.pos, context.alpha, this.point);
      const seated = lifePlace(this.content, v.target)?.seated === true && v.speed === 0;
      bubble.mesh.visible = true;
      bubble.mesh.position.set(at.x, this.terrain.heightAt(at.x, at.y) + (seated ? LIFT_SEATED : LIFT_STANDING), at.y);
      bubble.mesh.quaternion.copy(this.camera.quaternion);
    }
    for (const [who, bubble] of this.bubbles) {
      if (!shown.has(who)) bubble.mesh.visible = false;
    }
  }

  /** Textes affichés (essais et captures). */
  shownTexts(): string[] {
    return [...this.bubbles.values()].filter((b) => b.mesh.visible).map((b) => b.text);
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
