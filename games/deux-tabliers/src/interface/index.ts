/**
 * Interface de Deux Tabliers (chantier d): HUD, téléphone, ardoise, bilan, écrans de choix,
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
import type { Person, PhoneApp, ThreadId, UiContext } from './contexte';
import { answersLayer, createDialogueOverlay, dialogueReadMs } from './dialogue';
import { demoEndLayer, firstTimeLayer, morningLayer, nightLayer, proposalLayer } from './ecrans';
import { createHud, type Hud, type HudState } from './hud';
import type { AlertView, InterfaceModel } from './modele';
import { createSettingsStore, TEXT_SCALE, type SettingsStore } from './reglages';
import { PHONE_LAYER, phoneLayer, threadName, type PhoneBanner } from './telephone';
import { addMessage, createPhoneState, resetForNight, type PhoneState } from './telephone-etat';
import { T } from './textes';
import { euros, fill } from './typo';
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
  /** Son d'interface de `assets/son/sons.json` (sortie du téléphone, notification). */
  sound?(id: string): void;
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
  openPhone(app?: PhoneApp, thread?: ThreadId): void;
  readonly phone: PhoneState;
  openSlate(): void;
  /** Relit le modèle tout de suite (après une action locale). */
  refresh(): void;
  dispose(): void;
}

/** Tranches du modèle qui redessinent chaque calque (le reste ne le touche pas). */
function sliceFor(id: string, m: InterfaceModel): unknown {
  switch (id) {
    case PHONE_LAYER:
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
        m.discounts,
        m.marketing,
        m.evening === null,
        m.partner.place,
      ];
    case 'ardoise':
      return m.slate;
    case 'bilan':
      return [m.evening, m.house, phoneProposals(m)];
    case 'proposition':
      return [m.proposals, m.house];
    case 'nuit':
      return m.night;
    case 'matin':
      return [m.morning, phoneProposals(m)];
    case 'premiere-fois':
      return m.houseSetup;
    case 'fin-demo':
      return m.demoEnd;
    default:
      return null;
  }
}

/** Achats et actions proposés par l'autre: ils se répondent dans le téléphone (Messages). */
function phoneProposals(m: InterfaceModel): readonly string[] {
  return m.proposals
    .filter((p) => p.from !== m.local && (p.kind === 'purchase' || p.kind === 'move'))
    .map((p) => p.id);
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
  const phone = createPhoneState();
  /** Tab pendant un geste: le téléphone sort juste après (ux-telephone 2.1). */
  let phoneWaiting = false;
  let closedSinceStep = false;
  let seenProposals = new Set<string>();
  let lastHint: string | null = null;
  let nightReset = false;
  const sound = (id: string): void => {
    options.sound?.(id);
  };

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
    phone,
    openPhone: (app, thread) => {
      if (app !== undefined) phone.stack = app === 'home' ? [] : [{ app, thread }];
      if (app !== undefined && app !== 'home') phone.lastApp = app;
      if (layers.isOpen(PHONE_LAYER)) {
        phoneSpec?.changed();
        return;
      }
      phoneSpec = phoneLayer(ctx, notices, layers.any());
      const announceClose = phoneSpec.onClose?.bind(phoneSpec);
      phoneSpec.onClose = () => {
        announceClose?.();
        // Le Tab qui vient de ranger le téléphone arrive aussi au pas suivant: il ne le ressort pas.
        closedSinceStep = true;
      };
      layers.open(phoneSpec);
      hud.setPhoneOpen(true);
      sound('tablet-wake');
    },
    openSlate: () => {
      layers.open(slateLayer(ctx));
    },
    flash: (text) => {
      hud.flash(text);
    },
    openProposal: (id) => {
      layers.close('proposition');
      layers.open(proposalLayer(ctx, id));
    },
    openEvening: () => {
      layers.open(eveningLayer(ctx));
    },
  };

  let phoneSpec: ReturnType<typeof phoneLayer> | null = null;

  /**
   * Notifications du téléphone (ux-telephone 5): une seule file; téléphone sorti, une bannière
   * à la fois (5 s, 1 s d'écart, le survol arrête le délai); rangé, une alerte du HUD avec une
   * vibration douce. Aucune ne prend le focus; toutes restent dans Messages.
   */
  const queue: PhoneBanner[] = [];
  let banner: PhoneBanner | null = null;
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  let bannerHeld = false;
  const refreshPhone = (): void => {
    if (layers.isOpen(PHONE_LAYER)) layers.refresh(PHONE_LAYER);
  };
  const clearBanner = (): void => {
    if (bannerTimer !== null) clearTimeout(bannerTimer);
    bannerTimer = null;
    banner = null;
  };
  const pump = (): void => {
    if (banner !== null || !layers.isOpen(PHONE_LAYER)) return;
    const next = queue.shift();
    if (next === undefined) return;
    banner = next;
    refreshPhone();
    const expire = (): void => {
      if (bannerHeld) {
        bannerTimer = setTimeout(expire, 500);
        return;
      }
      clearBanner();
      refreshPhone();
      bannerTimer = setTimeout(pump, 1000);
    };
    bannerTimer = setTimeout(expire, 5000);
  };
  const notices = {
    banner: () => banner,
    holdBanner: (held: boolean) => {
      bannerHeld = held;
    },
    dismissBanner: () => {
      clearBanner();
      bannerTimer = setTimeout(pump, 1000);
    },
  };
  const notify = (b: PhoneBanner, hudText: string, icon: AlertView['icon']): void => {
    if (layers.isOpen(PHONE_LAYER)) {
      queue.push(b);
      pump();
      return;
    }
    hud.alert(
      { id: `tel-${String(phone.nextId)}`, icon, text: fill(T.notif.hudAlert, { text: hudText }) },
      { buzz: true, ms: 4000 },
    );
    sound('ui-notify');
  };

  /** Ce que le téléphone retient du modèle: propositions, astuces, prix préparés, nuit. */
  const watchPhone = (): void => {
    const day = model.clock?.day ?? 0;
    const minutes = model.clock?.minutes ?? 0;
    const theirs = model.proposals.filter(
      (p) => p.from !== model.local && (p.kind === 'purchase' || p.kind === 'move'),
    );
    const ids = new Set(theirs.map((p) => p.id));
    for (const p of theirs) {
      if (seenProposals.has(p.id)) continue;
      if (layers.isOpen(PHONE_LAYER)) {
        queue.push({
          title: fill(T.notif.proposal, { player: options.partner.name }),
          text: `${p.item ?? ''}, ${euros(p.amountCents ?? 0, true)}`,
          app: 'messages',
          thread: 'partner',
        });
        pump();
      } else sound('ui-notify');
    }
    seenProposals = ids;
    // Astuce de Simone: un badge sur Messages, rien d'autre (ux-telephone 5).
    if (model.hint !== null && model.hint !== lastHint)
      addMessage(phone, 'simone', model.hint, day, minutes);
    lastHint = model.hint;
    // H1: les prix préparés pendant le service s'écrivent sur l'ardoise dès la fermeture.
    const slate = model.slate;
    if (slate !== null && !slate.readOnly && phone.pending.size > 0) {
      for (const [recipe, line] of phone.pending) {
        if (line.priceCents !== undefined)
          options.send({ type: 'slate-price', recipe, priceCents: line.priceCents });
        if (line.star !== undefined) options.send({ type: 'slate-star', recipe, star: line.star });
      }
      phone.pending.clear();
    }
    if (model.night !== null && !nightReset) {
      nightReset = true;
      resetForNight(phone);
    }
    if (model.night === null) nightReset = false;
    const open = layers.isOpen(PHONE_LAYER);
    hud.setPhoneOpen(open);
    // Téléphone rangé: les bannières en attente restent dans Messages.
    if (!open && (banner !== null || queue.length > 0)) {
      clearBanner();
      queue.length = 0;
    }
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
    watchPhone();
    for (const id of [
      PHONE_LAYER,
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
  /**
   * RV-06: dans une fenêtre réduite, le téléphone garde une largeur lisible et peut couvrir les
   * colonnes du HUD; celles qu'il couvre se cachent tant qu'il est sorti, et l'aide des touches
   * se range si elle n'a pas la place à côté de lui. Mesuré quatre fois par seconde au plus.
   */
  const covered = new Set<HTMLElement>();
  let fitAt = -Infinity;
  const fitPhone = (now: number): void => {
    const tel = options.root.querySelector<HTMLElement>('.dt-tel:not(.out)');
    if (tel === null) {
      for (const el of covered) el.classList.remove('dt-sous-tel');
      covered.clear();
      return;
    }
    if (now - fitAt < 250) return;
    fitAt = now;
    const t = tel.getBoundingClientRect();
    const hit = (r: DOMRect): boolean =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > t.left &&
      r.left < t.right &&
      r.bottom > t.top &&
      r.top < t.bottom;
    const columns = hudLayer.querySelectorAll<HTMLElement>('.dt-tl, .dt-tr, .dt-br');
    for (const el of columns) {
      if (covered.has(el) || !hit(el.getBoundingClientRect())) continue;
      el.classList.add('dt-sous-tel');
      covered.add(el);
    }
    const help = tel.querySelector<HTMLElement>('.dt-tel-aide');
    if (help === null || tel.classList.contains('dt-sans-aide')) return;
    const a = help.getBoundingClientRect();
    const crowded =
      a.left < 0 ||
      [...hudLayer.querySelectorAll<HTMLElement>('.dt-tl, .dt-tr, .dt-br, .dt-bubble')].some(
        (el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.right > a.left &&
            r.left < a.right &&
            r.bottom > a.top &&
            r.top < a.bottom
          );
        },
      );
    if (crowded) tel.classList.add('dt-sans-aide');
  };
  let lastBearing: number | null = null;
  /** Réplique simple affichée et depuis quand (elle passe seule une fois lue). */
  let shown: { id: string; at: number } | null = null;

  return {
    hud,
    settings,
    layers,
    step(keys) {
      if (layers.any()) {
        // Les Tab lus par les calques (sortir, ranger) ne reviennent pas après leur fermeture.
        closedSinceStep = false;
        phoneWaiting = false;
        return { swallowAct: true, swallowConfirm: true };
      }
      const swallowAct = false;
      let swallowConfirm = false;
      if (keys.tablet && !closedSinceStep) phoneWaiting = true;
      closedSinceStep = false;
      if (phoneWaiting && model.gauge === null) {
        phoneWaiting = false;
        ctx.openPhone();
        return { swallowAct: true, swallowConfirm: true };
      }
      // E (et Espace, et le clic) agit toujours dans le café: une réplique avance par Entrée, ou
      // seule après le temps de la lire (`dialogueReadMs`).
      const d = model.dialogue;
      if (keys.confirm) {
        const scene = model.scene;
        // Une seule invite sur Entrée: la proposition du téléphone passe avant « On ouvre ? ».
        const received =
          model.proposals.find(
            (p) => p.from !== model.local && (p.kind === 'purchase' || p.kind === 'move'),
          ) ?? model.proposals.find((p) => p.from !== model.local);
        if (scene?.outcome !== null && scene !== null) {
          options.send({ type: 'scene-dismiss', id: scene.id });
          swallowConfirm = true;
        } else if (received !== undefined) {
          // Un achat ou une action de l'autre: le téléphone sort sur Messages, focus « D'accord ».
          if (received.kind === 'purchase' || received.kind === 'move')
            ctx.openPhone('messages', 'partner');
          else ctx.openProposal(received.id);
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
      fitPhone(now);
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
      // Livraisons et habitués arrivent par le téléphone (ux-telephone 5); le reste au HUD.
      const thread: ThreadId | null =
        a.icon === 'delivery' || a.icon === 'order'
          ? 'suppliers'
          : a.icon === 'regular'
            ? 'regulars'
            : null;
      if (thread === null) {
        hud.alert(a);
        return;
      }
      addMessage(phone, thread, a.text, model.clock?.day ?? 0, model.clock?.minutes ?? 0);
      // « Livraison de Lucas · Le dépannage ... »: le titre de la bannière avant le point médian.
      const cut = a.text.indexOf(' · ');
      const title = cut > 0 ? a.text.slice(0, cut) : threadName(ctx, thread);
      const text = cut > 0 ? a.text.slice(cut + 3) : a.text;
      notify({ title, text, app: 'messages', thread }, a.text, a.icon);
      refreshPhone();
    },
    quality(word) {
      hud.quality(word);
    },
    flash(text) {
      hud.flash(text);
    },
    panelOpen: () => layers.any(),
    openPhone: (app, thread) => {
      ctx.openPhone(app, thread);
    },
    phone,
    openSlate: () => {
      ctx.openSlate();
    },
    refresh() {
      read(performance.now(), lastBearing, true);
    },
    dispose() {
      clearBanner();
      unsubscribe();
      layers.dispose();
      overlay.dispose();
      hud.dispose();
      removeStyle();
    },
  };
}
