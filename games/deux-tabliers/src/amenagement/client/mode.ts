/**
 * Mode aménagement en vue subjective (navigateur, ux 6): B entre et sort (café fermé), E prend
 * le meuble visé ou pose la pièce tenue, A ou la molette la tourne, R la range en réserve (ou
 * lâche ton côté d'une charge), Retour arrière annule le déplacement. Le fantôme suit la visée,
 * aimanté à la grille et aux murs; il dit tout de suite s'il peut se poser, par sa forme (contour
 * plein ou pointillés) et par le texte de l'invite, jamais par la couleur seule. Tab ouvre la
 * boutique et la réserve. Toute action part en intention: l'hôte décide.
 */
import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  type Scene,
} from 'three';
import type { GameAction } from '../../actions';
import type { Content } from '../../donnees/charger';
import type { Input } from '@duo/sdk';
import type { PlacedFurniture } from '../../etat/monde';
import type { Panel } from '../../interface/panneaux';
import type { GameView } from '../../reseau/vue';
import type { ModelLibrary } from '../../rendu/modeles';
import type { Intent } from '../../simulation/entrees';
import type { Eye } from '../../simulation/visee';
import { styleNote } from '../ambiance';
import { arrangeAllowed } from '../index';
import type { Held } from '../etat';
import type { PlacementRequest } from '../intentions';
import { checkPlacement, itemOf, type Verdict } from '../regles';
import { takeRefusal } from '../systeme';
import { aimedFurniture, proposePlacement } from '../visee-pose';
import { createArrangementPanel } from './panneau';

export interface ArrangementPrompt {
  readonly key: string;
  readonly text: string;
  readonly refused: boolean;
}

export interface ArrangementClient {
  readonly panel: Panel;
  active(): boolean;
  /** Un pas de la boucle: touches du mode (si `playing`) et intentions du panneau. */
  step(playing: boolean): Intent[];
  /** Invite du HUD en mode aménagement. */
  prompt(): ArrangementPrompt | null;
  render(): void;
  dispose(): void;
}

export interface ArrangementClientOptions {
  readonly input: Input<GameAction>;
  readonly content: Content;
  readonly view: GameView;
  readonly scene: Scene;
  readonly models: ModelLibrary;
  /** Couleurs des deux joueurs (fantôme de l'autre). */
  readonly colors: readonly [string, string];
  readonly eye: () => Eye;
  readonly flash: (text: string) => void;
  readonly closePanel: () => void;
}

const SERVICE_REFUSAL = 'Le café est ouvert : on aménage avant l’ouverture ou après la fermeture.';

export function createArrangementClient(o: ArrangementClientOptions): ArrangementClient {
  const { input, content, view } = o;
  const queued: Intent[] = [];
  const send = (intent: Intent): void => {
    queued.push(intent);
  };
  const panel = createArrangementPanel(send, o.closePanel);
  let active = false;
  let rotDeg = 0;
  let heldType: string | null = null;
  let request: PlacementRequest | null = null;
  let verdict: Verdict | null = null;
  let verdictKey = '';
  let aimed: PlacedFurniture | null = null;
  let promptState: ArrangementPrompt | null = null;
  let ghostSentKey = '';
  let ghostTimer = 0;

  // Fantôme: le modèle de la pièce, et un contour plein (pose possible) ou en pointillés (refus).
  const root = new Group();
  root.name = 'amenagement';
  o.scene.add(root);
  const unit = new BoxGeometry(1, 1, 1);
  unit.translate(0, 0.5, 0);
  const edges = new EdgesGeometry(unit);
  const solid = new LineBasicMaterial({ color: '#fffaf0' });
  const dashed = new LineDashedMaterial({ color: '#fffaf0', dashSize: 0.06, gapSize: 0.05 });
  const aimMaterial = new LineBasicMaterial({ color: '#f2c14e' });
  const otherMaterials = o.colors.map((c) => new LineBasicMaterial({ color: c }));
  const outline = new LineSegments(edges, solid);
  const refusedOutline = new LineSegments(edges, dashed);
  const aimOutline = new LineSegments(edges, aimMaterial);
  const otherOutline = new LineSegments(edges, otherMaterials[view.local === 0 ? 1 : 0] ?? solid);
  // Distances le long des arêtes: une fois (boîte unité), les pointillés suivent l'échelle.
  refusedOutline.computeLineDistances();
  root.add(outline, refusedOutline, aimOutline, otherOutline);
  for (const l of [outline, refusedOutline, aimOutline, otherOutline]) l.visible = false;
  let ghostModel: Group | null = null;

  const setBox = (
    line: LineSegments,
    f: { x: number; z: number; y: number; rotDeg: number },
    type: string,
    pad = 0.02,
  ): boolean => {
    const t = content.furniture.get(type);
    if (t === undefined) return false;
    line.position.set(f.x, f.y - pad / 2, f.z);
    line.rotation.y = (f.rotDeg * Math.PI) / 180;
    line.scale.set(t.footprint[0] + pad, Math.max(0.03, t.height) + pad, t.footprint[1] + pad);
    return true;
  };

  const local = (): Held | null => view.world().arrangement.held[view.local];
  const carrying = (): boolean => {
    const c = view.world().arrangement.carry;
    return c !== null && c.handles[view.local] !== null;
  };

  const movable = (f: PlacedFurniture): boolean => {
    const t = content.furniture.get(f.type);
    return t !== undefined && !t.fixed && t.carry !== 'none';
  };

  const rotationStep = (type: string): number => {
    return itemOf(content, type)?.rotationStep ?? 90;
  };

  const exit = (): void => {
    active = false;
    aimed = null;
  };

  return {
    panel,
    active: () => active,
    step(playing) {
      const out = queued.splice(0, queued.length);
      if (playing && input.wasPressed('arrange')) {
        if (!active) {
          if (!arrangeAllowed(view.world())) o.flash(SERVICE_REFUSAL);
          else active = true;
        } else if (carrying()) o.flash('Posez d’abord la charge, ou lâche ton côté (R).');
        else {
          if (local() !== null) out.push({ type: 'amenagement-annuler' });
          exit();
        }
      }
      if (!active || !playing) return out;
      const held = local();
      if (input.wasPressed('act')) {
        if (carrying())
          out.push({
            type: 'amenagement-poser',
            at: { x: 0, z: 0, y: 0, rotDeg: 0, support: null },
          });
        else if (held !== null) {
          if (request !== null && verdict?.ok === true)
            out.push({ type: 'amenagement-poser', at: { ...request, rotDeg: verdict.rotDeg } });
          else if (verdict !== null && !verdict.ok) o.flash(verdict.reason);
          else o.flash('Vise le sol, un mur ou un meuble pour poser.');
        } else if (aimed !== null) out.push({ type: 'amenagement-prendre', furniture: aimed.id });
      }
      if (input.wasPressed('drop')) {
        if (carrying()) out.push({ type: 'amenagement-lacher' });
        else if (held !== null) out.push({ type: 'amenagement-ranger', furniture: null });
        else if (aimed !== null) out.push({ type: 'amenagement-ranger', furniture: aimed.id });
      }
      if (input.wasPressed('rotate')) {
        const dir: -1 | 1 = input.pointer.wheel < 0 ? -1 : 1;
        if (carrying()) out.push({ type: 'amenagement-tourner', dir });
        else if (held !== null) {
          const step = rotationStep(held.piece.type);
          if (step > 0) rotDeg = (((rotDeg + dir * step) % 360) + 360) % 360;
        }
      }
      if (input.wasPressed('close')) {
        if (held !== null) out.push({ type: 'amenagement-annuler' });
        else if (!carrying()) exit();
      }
      // Fantôme montré chez l'autre: cinq mises à jour par seconde au plus, seulement s'il bouge.
      ghostTimer++;
      if (ghostTimer >= 12) {
        ghostTimer = 0;
        const key =
          held === null || request === null
            ? ''
            : `${request.x}|${request.z}|${request.y}|${verdict?.ok === true ? verdict.rotDeg : rotDeg}|${String(verdict?.ok)}`;
        if (key !== ghostSentKey) {
          ghostSentKey = key;
          out.push({
            type: 'amenagement-fantome',
            at:
              held === null || request === null
                ? null
                : { ...request, rotDeg: verdict?.ok === true ? verdict.rotDeg : rotDeg },
            ok: verdict?.ok === true,
          });
        }
      }
      return out;
    },
    prompt: () => (active ? promptState : null),
    render() {
      const world = view.world();
      const held = local();
      const eye = o.eye();
      // Le fantôme de l'autre joueur, à sa couleur (DE-10).
      const other = world.arrangement.ghosts[view.local === 0 ? 1 : 0];
      otherOutline.visible = other !== null && setBox(otherOutline, other.pose, other.type, 0.04);
      if (!active) {
        outline.visible = false;
        refusedOutline.visible = false;
        aimOutline.visible = false;
        if (ghostModel !== null) ghostModel.visible = false;
        return;
      }
      const type = held?.piece.type ?? null;
      if (type !== heldType) {
        heldType = type;
        rotDeg = 0;
        if (ghostModel !== null) root.remove(ghostModel);
        ghostModel = null;
        const t = type === null ? undefined : content.furniture.get(type);
        if (t !== undefined) {
          ghostModel = o.models.instance(t.model, {
            width: t.footprint[0],
            depth: t.footprint[1],
            height: t.height,
            color: t.color,
          });
          root.add(ghostModel);
        }
      }
      if (held !== null && type !== null) {
        aimed = null;
        aimOutline.visible = false;
        request = proposePlacement(content, world, type, eye, rotDeg);
        const key =
          request === null
            ? ''
            : `${type}|${request.x}|${request.z}|${request.y}|${request.rotDeg}|${request.support ?? ''}|${world.furniture.length}`;
        if (key !== verdictKey) {
          verdictKey = key;
          verdict =
            request === null
              ? null
              : checkPlacement(content, world, { type, ...request }, new Set(), held.piece.id);
        }
        const ok = verdict?.ok === true;
        const pose =
          request === null
            ? null
            : { ...request, rotDeg: verdict?.ok === true ? verdict.rotDeg : request.rotDeg };
        outline.visible = pose !== null && ok && setBox(outline, pose, type);
        refusedOutline.visible = pose !== null && !ok && setBox(refusedOutline, pose, type);
        if (ghostModel !== null) {
          ghostModel.visible = pose !== null && ok;
          if (pose !== null) {
            ghostModel.position.set(pose.x, pose.y, pose.z);
            ghostModel.rotation.y = (pose.rotDeg * Math.PI) / 180;
          }
        }
        const label = content.furniture.get(type)?.label ?? type;
        const key2 = input.actionLabel('act');
        if (request === null)
          promptState = {
            key: key2,
            text: `En main : ${label}. Vise le sol, un mur ou un meuble.`,
            refused: true,
          };
        else if (verdict?.ok === true)
          promptState = {
            key: key2,
            text: `✓ Peut se poser ici. ${styleNote(content, world, type)}`,
            refused: false,
          };
        else if (verdict !== null)
          promptState = {
            key: key2,
            text: `× ${verdict.reason}${verdict.detail === '' ? '' : ` ${verdict.detail}`}`,
            refused: true,
          };
        return;
      }
      outline.visible = false;
      refusedOutline.visible = false;
      if (ghostModel !== null) ghostModel.visible = false;
      request = null;
      verdict = null;
      const carry = world.arrangement.carry;
      if (carrying() && carry !== null) {
        const both = carry.handles[0] !== null && carry.handles[1] !== null;
        promptState = both
          ? {
              key: input.actionLabel('act'),
              text: `Poser ensemble · ${input.actionLabel('rotate')} ou molette : tourner · ${input.actionLabel('drop')} : lâcher ton côté`,
              refused: false,
            }
          : {
              key: input.actionLabel('drop'),
              text: 'Tu tiens un côté. En attente de l’autre… (lâcher)',
              refused: false,
            };
        aimOutline.visible = false;
        return;
      }
      aimed = aimedFurniture(content, world, eye, movable);
      aimOutline.visible = aimed !== null && setBox(aimOutline, aimed, aimed.type, 0.05);
      if (aimed === null) {
        promptState = {
          key: input.actionLabel('arrange'),
          text: 'Aménager · Tab : boutique et réserve · terminer',
          refused: false,
        };
        return;
      }
      const t = content.furniture.get(aimed.type);
      const carton = world.arrangement.cartons.find((c) => c.furniture === aimed?.id);
      const inside =
        carton === undefined ? undefined : content.furniture.get(carton.piece.type)?.label;
      const waiting = carry !== null && carry.furniture === aimed.id;
      if (waiting) {
        promptState = {
          key: input.actionLabel('act'),
          text: 'Prendre l’autre côté',
          refused: false,
        };
        return;
      }
      const refusal = takeRefusal(content, world, view.local, aimed);
      const name =
        inside === undefined ? (t?.label ?? aimed.type) : `${t?.label ?? 'Carton'} (${inside})`;
      const heavy = t?.carry === 'two';
      promptState =
        refusal !== null
          ? { key: input.actionLabel('act'), text: refusal, refused: true }
          : {
              key: input.actionLabel('act'),
              text: heavy
                ? `Saisir un côté : ${name}. Trop lourd pour une seule personne : il faut être deux.`
                : carton !== undefined
                  ? `Déballer : ${name}`
                  : `Prendre : ${name} · ${input.actionLabel('drop')} : ranger en réserve`,
              refused: false,
            };
    },
    dispose() {
      o.scene.remove(root);
      unit.dispose();
      edges.dispose();
      solid.dispose();
      dashed.dispose();
      aimMaterial.dispose();
      for (const m of otherMaterials) m.dispose();
    },
  };
}
