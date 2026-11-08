/**
 * Branchement de l'interface dans `main.ts`, en quelques lignes (à poser par le manager):
 *
 *   const ui = attachInterface({ duo, view, look, canvas, camera: stage.camera, sources: {}, intents: {} });
 *   // step: const keys = ui.step(); ... if (!keys.swallowAct) { act/drop comme avant }
 *   //       intents.push(...ui.drainIntents());
 *   //       ne plus appeler panels.toggle ni panels.close() (les calques lisent Tab et Retour arrière),
 *   //       et ne reprendre la souris sur Entrée que si !keys.swallowConfirm.
 *   // render: ui.frame(hudState, currentAim?.target ?? null) à la place de hud.update(hudState) et panels.update()
 *   // view.onEvent: ui.onEvent(event) (remplace hud.flash pour les refus)
 *   // look.setPanelOpen est appelé par l'interface; `look.panelOpen()` reste la référence pour le regard.
 *   // duo.on('stop'): ui.dispose()
 *
 * `sources` et `intents` se remplissent au fil des chantiers (adaptateur.ts).
 */
import type { DuoContext } from '@duo/sdk';
import type { PerspectiveCamera } from 'three';
import type { GameAction } from '../actions';
import type { LookControl } from '../entrees/regard';
import type { PlayerIndex } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import type { Intent, Target } from '../simulation/entrees';
import type { GameEvent } from '../simulation/evenements';
import {
  planZones,
  readInterfaceModel,
  toIntent,
  type InterfaceSources,
  type IntentFor,
} from './adaptateur';
import { guideOf } from '../branchement/guide';
import { createGuideCard } from './guide-carte';
import type { HudState } from './hud';
import { createInterface, type GameInterface, type StepResult } from './index';
import { horizontalFov } from './reglages';

export interface AttachOptions {
  readonly duo: DuoContext<GameAction>;
  readonly view: GameView;
  readonly look: LookControl;
  readonly canvas: HTMLCanvasElement;
  readonly camera: PerspectiveCamera;
  readonly sources?: InterfaceSources;
  readonly intents?: IntentFor;
  /** Son d'interface (sortie du téléphone, notification), par identifiant de `sons.json`. */
  readonly sound?: (id: string) => void;
}

export interface AttachedInterface {
  readonly ui: GameInterface;
  /** Touches de l'interface pour ce pas (Tab, Entrée, Agir pour une réplique). */
  step(): StepResult;
  /** Intentions nées dans l'interface depuis le dernier pas. */
  drainIntents(): Intent[];
  frame(centre: HudState, target: Target | null): void;
  onEvent(event: GameEvent): void;
  dispose(): void;
}

/** Direction de l'autre vue de dessus (0 devant, 90 à droite), `null` s'il est dans le champ. */
export function partnerBearing(view: GameView, yawDeg: number, hFovDeg: number): number | null {
  const other: PlayerIndex = view.local === 0 ? 1 : 0;
  const me = view.pose(view.local);
  const them = view.pose(other);
  const dx = them.x - me.x;
  const dz = them.z - me.z;
  if (Math.hypot(dx, dz) < 0.01) return null;
  // Cap 0: vers -z, 90: vers -x (rotation.y de Three.js).
  const towards = (Math.atan2(-dx, -dz) * 180) / Math.PI;
  const bearing = ((((yawDeg - towards) % 360) + 540) % 360) - 180;
  return Math.abs(bearing) < hFovDeg / 2 - 5 ? null : bearing;
}

export function attachInterface(options: AttachOptions): AttachedInterface {
  const { duo, view, look, canvas, camera } = options;
  const sources = options.sources ?? {};
  const table = options.intents ?? {};
  const zones = planZones(view.content);
  const pending: Intent[] = [];
  let target: Target | null = null;
  const aspect = (): number => canvas.clientWidth / Math.max(1, canvas.clientHeight);

  const ui = createInterface({
    root: document.body,
    me: { name: duo.localPlayer.name, color: duo.localPlayer.color },
    partner: { name: duo.remotePlayer.name, color: duo.remotePlayer.color },
    hostName: duo.host.name,
    ui: () => duo.ui,
    readModel: () => readInterfaceModel(view, { sources, zones, target }),
    send: (action) => {
      const intent = toIntent(action, table);
      if (intent !== null) pending.push(intent);
      else duo.log.info("action de l'interface sans intention", { type: action.type });
    },
    onCursor: (open) => {
      look.setPanelOpen(open);
    },
    aspect,
    actLabel: () => duo.input.actionLabel('act'),
    sound: (id) => {
      options.sound?.(id);
    },
  });

  const guideCard = createGuideCard(document.body);
  /** Guide du premier service, puis aide de la recette du ticket qu'on tient (astuces activées). */
  const paintGuide = (): void => {
    const w = view.world();
    if (!ui.settings.get().tips) {
      guideCard.update(null, false);
      return;
    }
    const first = guideOf(view.content, w, view.local);
    if (first !== null) {
      guideCard.update(first, true);
      return;
    }
    const mine = w.service.tickets.some((t) => t.taker === view.local && t.status === 'open');
    guideCard.update(mine ? guideOf(view.content, w, view.local, true) : null, false);
  };

  const applyView = (): void => {
    const settings = ui.settings.get();
    look.setSensitivity(settings.sensitivity, settings.invertY);
    const fov = settings.fovDeg;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };
  applyView();
  const offSettings = ui.settings.onChange(applyView);
  const offDuo = duo.on('settings', () => {
    ui.settings.set('textSize', ui.settings.get().textSize);
  });

  return {
    ui,
    step() {
      return ui.step({
        tablet: duo.input.wasPressed('tablet'),
        confirm: duo.input.wasPressed('confirm'),
        act: duo.input.wasPressed('act'),
        locked: look.locked(),
      });
    },
    drainIntents() {
      return pending.splice(0, pending.length);
    },
    frame(centre, aimTarget) {
      target = aimTarget;
      const hFov = horizontalFov(camera.fov, aspect());
      ui.frame(performance.now(), centre, partnerBearing(view, look.look.yawDeg, hFov));
      paintGuide();
    },
    onEvent(event) {
      if (event.type === 'refused' && event.player === view.local) ui.flash(event.reason);
      const alert = sources.alert?.(event, view.local) ?? null;
      if (alert !== null) ui.alert(alert);
      const word = sources.quality?.(event, view.local) ?? null;
      if (word !== null) ui.quality(word);
    },
    dispose() {
      offSettings();
      offDuo();
      guideCard.dispose();
      ui.dispose();
    },
  };
}
