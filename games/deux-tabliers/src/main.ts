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
import { wireInterface } from './branchement/interface';
import { attachInterface } from './interface/branchement';
import { createHud } from './interface/hud';
import { createPanels } from './interface/panneaux';
import { serviceStationPrompt } from './service';
import { createArrangementClient } from './amenagement/client/mode';
import { createLiveShell } from './amenagement/client/coque-vivante';
import { createBakedShell } from './rendu/coque-glb';
import { AVATAR_MODEL } from './rendu/correspondances';
import { createModelLibrary } from './rendu/modeles';
import { createWorldNodes } from './rendu/monde3d';
import { createStage } from './rendu/scene';
import { createSession } from './session';
import type { Intent, StepInput } from './simulation/entrees';
import { planLabel } from './simulation/interactions';
import { aim, type Aim } from './simulation/visee';
import { eyeHeightOf } from './simulation/assise';
import { placeAnchor } from './etat/assises';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #scene absent');
// HUD de secours: seulement pour dire une erreur de chargement, avant l'interface.
const bootHud = createHud(document.body);

const duo = await connect<GameAction>({ manifest });
const content = (() => {
  try {
    return loadContent(DATA_FILES);
  } catch (error) {
    const text = error instanceof ContentError ? error.issues.join('\n') : String(error);
    duo.log.error('données invalides', { text });
    bootHud.fail(`Le café ne peut pas ouvrir: données invalides.\n\n${text}`);
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
const baked = createBakedShell(stage.scene, stage.renderer, models, view);
const nodes = createWorldNodes(stage.scene, models, [duo.host.colorHex, duo.guest.colorHex]);
const customers = createCustomerNodes(stage.scene);
const sounds = createSounds(duo.audio, duo.log, DATA_FILES, content);
const startPose = view.world().players[view.local];
const look = createLookControl(canvas, duo.input, {
  degPerPixel: content.settings.mouse.degPerPixel,
  pitchLimitDeg: content.settings.player.pitchLimitDeg,
  start: { yawDeg: startPose.yawDeg, pitchDeg: startPose.pitchDeg },
  active: () => duo.state === 'running',
});
bootHud.dispose();
const wired = wireInterface(view);
const ui = attachInterface({
  duo,
  view,
  look,
  canvas,
  camera: stage.camera,
  sources: wired.sources,
  intents: wired.intents,
  sound: (id) => {
    sounds.play(id);
  },
});
// Le panneau provisoire de l'aménagement (Tab en mode aménagement, B pour y entrer) garde son
// propre calque: la boutique du téléphone passe par `catalogView` pour le reste.
const panels = createPanels(document.body, view, (open) => {
  look.setPanelOpen(open);
});
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
    ui.ui.flash(text);
  },
  closePanel: () => {
    panels.close();
  },
});
panels.register(arrange.panel);

view.onEvent((event) => {
  wired.onEvent(event);
  ui.onEvent(event);
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

// La coque et les avatars se chargent pendant l'écran de chargement (délai de 30 s), pas en
// pleine partie: le lecteur de GLB occupe le fil principal par à-coups.
duo.reportLoading(0.6);
await Promise.all([models.gltf('shell_village'), ...AVATAR_MODEL.map((name) => models.gltf(name))]);
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
    y: eyeHeightOf(content, view.world(), view.local),
    z: pose.z,
    yawDeg: look.look.yawDeg,
    pitchDeg: look.look.pitchDeg,
  });
};

/** Assise du joueur local à l'image d'avant, et regard posé sur la table en s'asseyant. */
let lastSeat: string | null = null;

duo.loop.start({
  step: ({ dt }) => {
    seq++;
    const playing = look.locked() && !look.panelOpen();
    const intents: Intent[] = [];
    const resumeClick = look.consumeResumeClick();
    const arranging = arrange.active();
    const keys = arranging ? { swallowAct: false, swallowConfirm: false } : ui.step();
    if (
      duo.input.wasPressed('confirm') &&
      !keys.swallowConfirm &&
      !look.locked() &&
      !look.panelOpen()
    )
      look.grab();
    if (arranging && duo.input.wasPressed('tablet')) panels.toggle(arrange.panel.id);
    if (panels.current() !== null && duo.input.wasPressed('close')) panels.close();
    intents.push(...ui.drainIntents());
    intents.push(...arrange.step(playing && !resumeClick));
    if (playing && !resumeClick && !arranging && !keys.swallowAct) {
      const target = currentAim?.target;
      if (duo.input.wasPressed('act') && target !== undefined)
        intents.push({ type: 'act', target });
      if (duo.input.wasPressed('drop') && target !== undefined)
        intents.push({ type: 'drop', target });
      if (duo.input.wasPressed('wave')) {
        const intent = wired.wave();
        if (intent !== null) intents.push(intent);
      }
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
    // Assis à l'instant: le regard se tourne vers la table, comme le corps (sens de l'assise).
    const seatId = view.world().players[view.local].seat ?? null;
    if (seatId !== lastSeat) {
      lastSeat = seatId;
      const a = seatId === null ? null : placeAnchor(content, view.world().furniture, seatId);
      if (a !== null) {
        look.look.yawDeg = a.yawDeg;
        look.look.pitchDeg = content.settings.seating.seatedPitchDeg;
      }
    }
    stage.camera.position.set(pose.x, eyeHeightOf(content, view.world(), view.local), pose.z);
    stage.camera.rotation.set(
      (look.look.pitchDeg * Math.PI) / 180,
      (look.look.yawDeg * Math.PI) / 180,
      0,
    );
    nodes.update(view, look.look);
    customers.update(view, now(), dt);
    shell.update();
    baked.update();
    shell.setBaseVisible(baked.failed());
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
    const target = currentAim?.target;
    const servicePrompt =
      target?.kind === 'station'
        ? serviceStationPrompt(content, view.world(), target.furniture)
        : null;
    ui.frame(
      {
        aiming: arrange.active() || (currentAim !== null && currentAim.plan.kind !== 'refuse'),
        prompt:
          arrangePrompt ??
          (currentAim === null
            ? null
            : {
                key: duo.input.actionLabel('act'),
                text:
                  currentAim.plan.kind === 'refuse'
                    ? planLabel(content, view.world(), currentAim.plan)
                    : (servicePrompt ?? planLabel(content, view.world(), currentAim.plan)),
                refused: currentAim.plan.kind === 'refuse',
              }),
        hold: use === null || seconds <= 0 ? null : Math.min(1, use.elapsed / seconds),
        capsule: duo.state === 'running' && !look.locked() && !look.panelOpen(),
      },
      currentAim?.target ?? null,
    );
    panels.update();
    sounds.listen(pose.x, pose.z, look.look.yawDeg);
    sounds.update(view.world(), view.local);
    stage.render();
  },
});

duo.on('stop', () => {
  look.dispose();
  sounds.dispose();
  arrange.dispose();
  panels.dispose();
  nodes.dispose();
  customers.dispose();
  models.dispose();
  shell.dispose();
  baked.dispose();
  stage.dispose();
  ui.dispose();
  session.dispose();
  duo.dispose();
});
