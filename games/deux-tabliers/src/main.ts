/**
 * Point d'entrée dans le navigateur: SDK, données, séance (hôte ou invité), rendu Three.js,
 * regard et pointeur, HUD et panneaux, sons. Toute la logique de jeu vit hors d'ici
 * (simulation, reseau, chantiers): ce fichier ne fait que brancher.
 */
import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import type { GameAction } from './actions';
import { createSounds } from './audio/sons';
import { createCustomerNodes } from './clientele/rendu3d';
import { ContentError, loadContent } from './donnees/charger';
import { DATA_FILES } from './donnees/fichiers';
import { createLookControl } from './entrees/regard';
import { createHud } from './interface/hud';
import { createPanels, TABLET_PLACEHOLDER } from './interface/panneaux';
import { createArrangementClient } from './amenagement/client/mode';
import { createLiveShell } from './amenagement/client/coque-vivante';
import { createModelLibrary } from './rendu/modeles';
import { createWorldNodes } from './rendu/monde3d';
import { createStage } from './rendu/scene';
import { createSession } from './session';
import type { Intent, StepInput } from './simulation/entrees';
import { planLabel } from './simulation/interactions';
import { aim, type Aim } from './simulation/visee';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #scene absent');
const hud = createHud(document.body);

const duo = await connect<GameAction>({ manifest });
const content = (() => {
  try {
    return loadContent(DATA_FILES);
  } catch (error) {
    const text = error instanceof ContentError ? error.issues.join('\n') : String(error);
    duo.log.error('données invalides', { text });
    hud.fail(`Le café ne peut pas ouvrir: données invalides.\n\n${text}`);
    throw error;
  }
})();
duo.reportLoading(0.3);

const t0 = performance.now();
const now = (): number => performance.now() - t0;
const session = createSession({ duo, content, now });
const view = session.view;
const stage = createStage(canvas, content.settings);
// Coque du plan en vigueur (extensions ouvertes, revêtements), chantier aménagement.
const shell = createLiveShell(stage.scene, content, view);
const models = createModelLibrary((message, data) => {
  duo.log.warn(message, data);
});
const nodes = createWorldNodes(stage.scene, models, [duo.host.colorHex, duo.guest.colorHex]);
const customers = createCustomerNodes(stage.scene);
const sounds = createSounds(duo.audio, duo.log, DATA_FILES);
const startPose = view.world().players[view.local];
const look = createLookControl(canvas, duo.input, {
  degPerPixel: content.settings.mouse.degPerPixel,
  pitchLimitDeg: content.settings.player.pitchLimitDeg,
  start: { yawDeg: startPose.yawDeg, pitchDeg: startPose.pitchDeg },
  active: () => duo.state === 'running',
});
const panels = createPanels(document.body, view, (open) => {
  look.setPanelOpen(open);
});
panels.register(TABLET_PLACEHOLDER);
const arrange = createArrangementClient({
  input: duo.input,
  content,
  view,
  scene: stage.scene,
  models,
  colors: [duo.host.colorHex, duo.guest.colorHex],
  eye: () => {
    const pose = view.pose(view.local);
    return {
      x: pose.x,
      y: content.settings.player.eyeHeight,
      z: pose.z,
      yawDeg: look.look.yawDeg,
      pitchDeg: look.look.pitchDeg,
    };
  },
  flash: (text) => {
    hud.flash(text);
  },
  closePanel: () => {
    panels.close();
  },
});
panels.register(arrange.panel);

view.onEvent((event) => {
  if (event.type === 'refused') {
    if (event.player !== view.local) return;
    hud.flash(event.reason);
  }
  sounds.onEvent(event);
});

duo.notebook.attach({
  canvas: () => canvas,
  caption: () => {
    const p = view.pose(view.local);
    return `${content.plan.title}, x ${p.x.toFixed(1)} z ${p.z.toFixed(1)}`;
  },
  snapshot: () => session.hostWorld(),
});

duo.reportLoading(1);
await duo.ready();
duo.input.attach(canvas);

duo.on('pause', () => {
  // Le jeu rend lui-même le pointeur: au retour, il le reprend sans geste (ux 2.3, étape 5).
  look.release();
});
duo.on('resume', () => {
  look.grab();
});

let seq = 0;
let currentAim: Aim | null = null;
const axis = (plus: GameAction, minus: GameAction): -1 | 0 | 1 => {
  const v = (duo.input.isDown(plus) ? 1 : 0) - (duo.input.isDown(minus) ? 1 : 0);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
};

/** Visée depuis le regard local et la pose affichée: ce que le joueur voit, il le vise. */
const localAim = (): Aim | null => {
  const pose = view.pose(view.local);
  return aim(content, view.world(), view.local, {
    x: pose.x,
    y: content.settings.player.eyeHeight,
    z: pose.z,
    yawDeg: look.look.yawDeg,
    pitchDeg: look.look.pitchDeg,
  });
};

duo.loop.start({
  step: ({ dt }) => {
    seq++;
    const playing = look.locked() && !look.panelOpen();
    const intents: Intent[] = [];
    const resumeClick = look.consumeResumeClick();
    if (duo.input.wasPressed('confirm') && !look.locked() && !look.panelOpen()) look.grab();
    if (duo.input.wasPressed('tablet'))
      panels.toggle(arrange.active() ? arrange.panel.id : 'tablette');
    if (duo.input.wasPressed('close')) panels.close();
    intents.push(...arrange.step(playing && !resumeClick));
    if (playing && !resumeClick && !arrange.active()) {
      const target = currentAim?.target;
      if (duo.input.wasPressed('act') && target !== undefined)
        intents.push({ type: 'act', target });
      if (duo.input.wasPressed('drop') && target !== undefined)
        intents.push({ type: 'drop', target });
    }
    const input: StepInput = {
      seq,
      moveX: look.panelOpen() ? 0 : axis('right', 'left'),
      moveZ: look.panelOpen() ? 0 : axis('forward', 'back'),
      fast: duo.input.isDown('fast'),
      yawDeg: Math.round(look.look.yawDeg * 2) / 2,
      pitchDeg: Math.round(look.look.pitchDeg * 2) / 2,
      actHeld: playing && duo.input.isDown('act'),
    };
    session.step(input, intents, dt);
  },
  render: ({ alpha, dt }) => {
    session.beforeFrame(alpha, dt);
    const pose = view.pose(view.local);
    stage.camera.position.set(pose.x, content.settings.player.eyeHeight, pose.z);
    stage.camera.rotation.set(
      (look.look.pitchDeg * Math.PI) / 180,
      (look.look.yawDeg * Math.PI) / 180,
      0,
    );
    nodes.update(view, look.look);
    customers.update(view, now(), dt);
    shell.update();
    arrange.render();
    currentAim = session.ready() && !arrange.active() ? localAim() : null;
    const use = view.world().players[view.local].use;
    const station =
      use === null
        ? undefined
        : content.furniture.get(
            view.world().furniture.find((f) => f.id === use.furniture)?.type ?? '',
          )?.station;
    const seconds =
      station === undefined || station === null ? 0 : (content.stations.get(station)?.seconds ?? 0);
    const arrangePrompt = arrange.prompt();
    hud.update({
      aiming: arrange.active() || (currentAim !== null && currentAim.plan.kind !== 'refuse'),
      prompt:
        arrangePrompt ??
        (currentAim === null
          ? null
          : {
              key: duo.input.actionLabel('act'),
              text: planLabel(content, view.world(), currentAim.plan),
              refused: currentAim.plan.kind === 'refuse',
            }),
      hold: use === null || seconds <= 0 ? null : Math.min(1, use.elapsed / seconds),
      capsule: duo.state === 'running' && !look.locked() && !look.panelOpen(),
    });
    panels.update();
    stage.render();
  },
});

duo.on('stop', () => {
  look.dispose();
  arrange.dispose();
  panels.dispose();
  nodes.dispose();
  customers.dispose();
  models.dispose();
  shell.dispose();
  stage.dispose();
  hud.dispose();
  session.dispose();
  duo.dispose();
});
