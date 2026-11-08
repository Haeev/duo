/**
 * Interface de Deux Tabliers (chantier d): HUD, tablette, ardoise, bilan, écrans de choix,
 * répliques et scènes, en DOM par-dessus la vue 3D. Point d'entrée unique pour `main.ts`.
 *
 * Branchement (à faire par le manager dans `main.ts`, à la place de `createHud` et
 * `createPanels`):
 *
 *   const ui = createInterface({
 *     root: document.body,
 *     me: { name: duo.localPlayer.name, color: duo.localPlayer.color },
 *     partner: { name: duo.remotePlayer.name, color: duo.remotePlayer.color },
 *     hostName: duo.host.name,
 *     ui: () => duo.ui,
 *     readModel: () => readInterfaceModel(view, { sources, zones, target: currentAim?.target ?? null }),
 *     send: (action) => { const i = toIntent(action, INTENT_FOR); if (i !== null) pending.push(i); },
 *     onCursor: (open) => { look.setPanelOpen(open); },
 *     aspect: () => canvas.clientWidth / Math.max(1, canvas.clientHeight),
 *     actLabel: () => duo.input.actionLabel('act'),
 *   });
 *   // dans step: avant les intentions du monde
 *   const keys = ui.step({ tablet: duo.input.wasPressed('tablet'), confirm: duo.input.wasPressed('confirm'),
 *     act: duo.input.wasPressed('act'), locked: look.locked() });
 *   // ne plus appeler panels.toggle / panels.close: Retour arrière et Tab sont lus par les calques.
 *   // si keys.swallowAct: pas d'intention « act » ce pas; si keys.swallowConfirm: ne pas reprendre la souris.
 *   // dans render: ui.frame(performance.now(), hudState, partnerBearing) (hudState: l'objet passé à hud.update)
 *   // view.onEvent: ui.onEvent(event) (refus, alertes, qualité)
 *   // ui.settings.onChange: champ de vision (stage.camera.fov), sensibilité et inversion (regard)
 *   // duo.on('stop'): ui.dispose()
 */
import type { UiAction } from './actions';
import { eveningLayer } from './bilan';
import { slateLayer } from './ardoise';
import { createLayers, type Layers } from './calques';
import type { Person, TabletSection, UiContext } from './contexte';
import { answersLayer, createDialogueOverlay, dialogueReadMs } from './dialogue';
import { demoEndLayer, firstTimeLayer, morningLayer, nightLayer, proposalLayer } from './ecrans';
import { createHud, type Hud, type HudState } from './hud';
import type { AlertView, InterfaceModel } from './modele';
import { createSettingsStore, TEXT_SCALE, type SettingsStore } from './reglages';
import { tabletLayer } from './tablette';
import { applyScale, installStyle } from './theme';

export type { UiAction } from './actions';
export type { InterfaceModel } from './modele';
export {
  readInterfaceModel,
  toIntent,
  planZones,
  type InterfaceSources,
  type IntentFor,
} from './adaptateur';

export interface InterfaceOptions {
  readonly root: HTMLElement;
  readonly me: Person;
  readonly partner: Person;
  readonly hostName: string;
  /** Réglages d'interface de Duo (taille, animations réduites), relus à chaque changement. */
  ui(): { readonly scale: number; readonly reducedMotion: boolean };
  readModel(): InterfaceModel;
  send(action: UiAction): void;
  onCursor(open: boolean): void;
  aspect(): number;
  /** Libellé de la touche « Agir » selon le clavier réel. */
  actLabel(): string;
  /** Lecture du modèle, en millisecondes (100 par défaut: dix fois par seconde). */
  readonly modelEveryMs?: number;
}

export interface StepKeys {
  readonly tablet: boolean;
  readonly confirm: boolean;
  readonly act: boolean;
  /** Le pointeur est verrouillé (le joueur joue). */
  readonly locked: boolean;
}

export interface StepResult {
  /** Cet appui d'« Agir » a servi à l'interface (réplique): pas d'intention ce pas. */
  readonly swallowAct: boolean;
  /** Cet Entrée a servi à l'interface (proposition, fin de scène): ne pas reprendre la souris. */
  readonly swallowConfirm: boolean;
}

export interface GameInterface {
  readonly hud: Hud;
  readonly settings: SettingsStore;
  readonly layers: Layers;
  step(keys: StepKeys): StepResult;
  frame(nowMs: number, centre: HudState, partnerBearing: number | null): void;
  /** Alerte douce et mot de qualité, déjà tirés des événements par les lecteurs des chantiers. */
  alert(alert: AlertView): void;
  quality(word: string): void;
  /** Refus d'une action, chez ce joueur. */
  flash(text: string): void;
  panelOpen(): boolean;
  openTablet(section?: TabletSection): void;
  openSlate(): void;
  /** Relit le modèle tout de suite (après une action locale). */
  refresh(): void;
  dispose(): void;
}

/** Tranches du modèle qui redessinent chaque calque (le reste ne le touche pas). */
function sliceFor(id: string, m: InterfaceModel): unknown {
  switch (id) {
    case 'tablette':
      return [
        m.house,
        m.clock?.minutes,
        m.clock?.phase,
        m.orders,
        m.catalogue,
        m.slate,
        m.projects,
        m.proposals,
        m.duoSettings,
      ];
    case 'ardoise':
      return m.slate;
    case 'bilan':
      return [m.evening, m.house];
    case 'proposition':
      return [m.proposals, m.house];
    case 'nuit':
      return m.night;
    case 'matin':
      return m.morning;
    case 'premiere-fois':
      return m.houseSetup;
    case 'fin-demo':
      return m.demoEnd;
    default:
      return null;
  }
}

export function createInterface(options: InterfaceOptions): GameInterface {
  const removeStyle = installStyle();
  const settings = createSettingsStore();
  const hud = createHud(options.root);
  const hudLayer = options.root.querySelector<HTMLElement>('.dt-hud') ?? options.root;
  const overlay = createDialogueOverlay(hudLayer);
  const every = options.modelEveryMs ?? 100;

  const layers = createLayers(options.root, {
    onCursor: (open) => {
      options.onCursor(open);
    },
    reducedMotion: () => options.ui().reducedMotion,
  });

  let model = options.readModel();
  let lastRead = -Infinity;
  const slices = new Map<string, string>();
  let firstTimeDone = false;
  let morningDay = -1;
  let eveningDay = -1;
  let demoEndShown = false;
  let answeredDialogue = '';
  // Images par seconde: moyenne sur une demi-seconde.
  let fpsFrames = 0;
  let fpsSince = -1;
  let fpsValue: number | null = null;

  const applySettings = (): void => {
    const s = settings.get();
    const duo = options.ui();
    applyScale(duo.scale * TEXT_SCALE[s.textSize], duo.reducedMotion, s.handwriting === 'readable');
    hud.setSettings(s);
    if (!s.showFps) hud.setFps(null);
  };

  const ctx: UiContext = {
    model: () => model,
    send: (action) => {
      options.send(action);
    },
    me: options.me,
    partner: options.partner,
    hostName: options.hostName,
    settings,
    layers,
    aspect: () => options.aspect(),
    openTablet: (section) => {
      layers.close('tablette');
      layers.open(tabletLayer(ctx, section));
    },
    openSlate: () => {
      layers.open(slateLayer(ctx));
    },
    openProposal: (id) => {
      layers.close('proposition');
      layers.open(proposalLayer(ctx, id));
    },
    openEvening: () => {
      layers.open(eveningLayer(ctx));
    },
  };

  const people = (bearing: number | null): Parameters<Hud['setModel']>[1] => ({
    partnerName: options.partner.name,
    partnerColor: options.partner.color,
    partnerBearing: bearing,
  });

  /** Écrans qui s'ouvrent d'eux-mêmes selon le moment de la journée. */
  const autoScreens = (): void => {
    const day = model.clock?.day ?? 0;
    if (!firstTimeDone && model.houseSetup !== null && !layers.isOpen('premiere-fois')) {
      firstTimeDone = true;
      layers.open(firstTimeLayer(ctx, () => undefined));
    }
    if (model.morning !== null && model.clock?.phase === 'morning' && morningDay !== day) {
      morningDay = day;
      layers.open(morningLayer(ctx, () => undefined));
    }
    if (model.evening !== null && model.clock?.phase === 'evening' && eveningDay !== day) {
      eveningDay = day;
      layers.open(eveningLayer(ctx));
    }
    // Le lendemain s'est levé: le bilan de la veille se range.
    if (model.evening === null && layers.isOpen('bilan')) layers.close('bilan');
    if (model.night !== null && !layers.isOpen('nuit')) layers.open(nightLayer(ctx));
    if (model.night === null && layers.isOpen('nuit')) layers.close('nuit');
    if (model.demoEnd !== null && !demoEndShown) {
      demoEndShown = true;
      layers.open(demoEndLayer(ctx));
    }
    const d = model.dialogue;
    if (d !== null && d.answers.length > 0 && answeredDialogue !== d.id) {
      answeredDialogue = d.id;
      layers.open(answersLayer(ctx, d));
    }
  };

  const read = (now: number, bearing: number | null, force: boolean): void => {
    if (!force && now - lastRead < every) return;
    lastRead = now;
    model = options.readModel();
    hud.setModel(model, people(bearing));
    overlay.update(model.dialogue, model.scene, options.actLabel());
    for (const id of [
      'tablette',
      'ardoise',
      'bilan',
      'proposition',
      'nuit',
      'matin',
      'premiere-fois',
      'fin-demo',
    ]) {
      if (!layers.isOpen(id)) {
        slices.delete(id);
        continue;
      }
      const key = JSON.stringify(sliceFor(id, model));
      if (slices.get(id) !== key) {
        if (slices.has(id)) layers.refresh(id);
        slices.set(id, key);
      }
    }
    autoScreens();
  };

  const unsubscribe = settings.onChange(() => {
    applySettings();
  });
  applySettings();
  let lastBearing: number | null = null;
  /** Réplique simple affichée et depuis quand (elle passe seule une fois lue). */
  let shown: { id: string; at: number } | null = null;

  return {
    hud,
    settings,
    layers,
    step(keys) {
      if (layers.any()) return { swallowAct: true, swallowConfirm: true };
      const swallowAct = false;
      let swallowConfirm = false;
      if (keys.tablet) ctx.openTablet();
      // E (et Espace, et le clic) agit toujours dans le café: une réplique avance par Entrée, ou
      // seule après le temps de la lire (`dialogueReadMs`).
      const d = model.dialogue;
      if (keys.confirm) {
        const scene = model.scene;
        const received = model.proposals.find((p) => p.from !== model.local);
        if (scene?.outcome !== null && scene !== null) {
          options.send({ type: 'scene-dismiss', id: scene.id });
          swallowConfirm = true;
        } else if (received !== undefined) {
          ctx.openProposal(received.id);
          swallowConfirm = true;
        } else if (keys.locked && d !== null && d.answers.length === 0) {
          options.send({ type: 'dialogue-next', id: d.id });
          read(performance.now(), lastBearing, true);
          swallowConfirm = true;
        } else if (
          keys.locked &&
          model.morning !== null &&
          !model.proposals.some((p) => p.kind === 'open' && p.from === model.local)
        ) {
          // Préparation: Entrée rouvre l'écran du matin, d'où l'on retourne la pancarte.
          layers.open(morningLayer(ctx, () => undefined));
          swallowConfirm = true;
        }
      }
      return { swallowAct, swallowConfirm };
    },
    frame(now, centre, bearing) {
      lastBearing = bearing;
      read(now, bearing, false);
      const d = model.dialogue;
      if (d === null || d.answers.length > 0) shown = null;
      else if (shown?.id !== d.id) shown = { id: d.id, at: now };
      else if (now - shown.at >= dialogueReadMs(d.text)) {
        options.send({ type: 'dialogue-next', id: d.id });
        shown = null;
        read(now, bearing, true);
      }
      hud.update(centre);
      if (settings.get().showFps) {
        if (fpsSince < 0) fpsSince = now;
        fpsFrames++;
        if (now - fpsSince >= 500) {
          fpsValue = (fpsFrames * 1000) / (now - fpsSince);
          fpsFrames = 0;
          fpsSince = now;
        }
        hud.setFps(fpsValue ?? 0);
      } else {
        fpsSince = -1;
        fpsFrames = 0;
      }
    },
    alert(a) {
      hud.alert(a);
    },
    quality(word) {
      hud.quality(word);
    },
    flash(text) {
      hud.flash(text);
    },
    panelOpen: () => layers.any(),
    openTablet: (section) => {
      ctx.openTablet(section);
    },
    openSlate: () => {
      ctx.openSlate();
    },
    refresh() {
      read(performance.now(), lastBearing, true);
    },
    dispose() {
      unsubscribe();
      layers.dispose();
      overlay.dispose();
      hud.dispose();
      removeStyle();
    },
  };
}
