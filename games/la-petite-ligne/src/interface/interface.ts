/**
 * Orchestrateur de l'interface: monte le HUD et la couche du moment (écran
 * plein cadre, dialogue ou panneau), relit l'état à chaque image sans
 * toucher au DOM tant que rien ne change, route le clavier et le focus.
 * L'interface lit l'état et envoie des intentions; elle ne modifie jamais
 * l'état.
 */
import { FarmPanel } from './basse-cour';
import '@fontsource-variable/fraunces/soft.css';
import '@fontsource-variable/nunito-sans/wght.css';
import '../../ui-maquettes/jeton.css';
import '../../ui-maquettes/composants.css';
import './interface.css';
import spriteIcones from '../../ui-maquettes/icones.svg?raw';
import type { Intent } from '../etat/actions';
import type { MenuKind, ReadonlyWorld, WorldEvent } from '../etat/types';
import type { CameraCommand, GameInterface, GameView, InterfaceOptions } from '../etat/vue';
import { NotebookPanel, startMemorySession } from './carnet';
import type { KeyInfo, Layer, PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { type ReadonlyCharacter, type UiContext, characterOf, createUiContext } from './contexte';
import { type BakeryPort, BakeryPanel, type SalonPort, SalonPanel } from './salon';
import { atSalonChair, bakeryBoughtToday, firstCutFree } from '../etat/interieurs';
import { DialogueBox, type DialogueSource } from './dialogue';
import { el, focusElement, focusables, isVisible, setStyleVar } from './dom';
import { BreakfastScreen, CreationScreen, EndScreen, NightScreen, SessionEndScreen, TitleScreen } from './ecrans';
import { directionOf, spatialNeighbour } from './focus';
import { profileSymbol, safeColor } from './format';
import { Hud } from './hud';
import { type ScreenKind, hudState, screenOf } from './modele';
import { CratePanel, ShopPanel, StationPanel } from './panneaux';
import { StallPanel } from './marche';
import { RoomPanel, StoragePanel } from './maison';
import { isNapping } from '../etat/maison';
import { BoardPanel } from './tableau';
import { ProposalCards } from './proposition';
import { SOUND_ATTR, UiSoundGate, type UiSoundId, buttonSound, layerSounds } from './sons';
import { loadUiTexts } from './textes';

const SPRITE_ID = 'lpl-icones';
const ACTIVATION = new Set(['Enter', 'NumpadEnter', 'Space']);
/** Touches de la caméra laissées au jeu pendant un dialogue ou un panneau (sauf le carnet, où A et E changent d'onglet). */
const CAMERA_KEYS = new Set(['KeyQ', 'KeyE', 'KeyR', 'KeyF']);

type LayerKind = 'screen' | 'dialogue' | 'panel';

interface Mounted {
  key: string;
  kind: LayerKind;
  layer: Layer;
}

class GameUi implements GameInterface, UiHost {
  readonly ctx: UiContext;
  private readonly view: GameView;
  private readonly root: HTMLDivElement;
  private readonly hud: Hud;
  private readonly proposals: ProposalCards;
  private readonly cameraCommand: ((command: CameraCommand) => void) | null;
  private readonly sounds: UiSoundGate;
  private readonly cleanups: (() => void)[] = [];
  private readonly insertedSprite: HTMLElement | null;
  private mounted: Mounted | null = null;
  private lastRevision = -1;
  private lastRefresh = Number.NEGATIVE_INFINITY;
  private dirty = true;
  private guardUntil = 0;
  private blockSpaceKeyup = false;
  private readonly keysDown = new Set<string>();
  /** Touches déjà traitées par l'écouteur de l'interface, que `handleKey` ignorera (code, instant). */
  private readonly claimed = new Map<string, number>();
  private pendingMenu: { menu: MenuKind | null; at: number; tab: PanelTab | undefined } | null = null;
  private panelTab: PanelTab | undefined;
  /**
   * Panneau local, sans menu du jeu (tour 10): le chantier d'une pièce, ou le carnet pendant la
   * sieste (la simulation ne prend pas de menu chez qui dort; le carnet reste ouvert quand même).
   */
  private local: 'room' | 'notebook' | null = null;
  private reading: string | null = null;
  private knownReadables: Set<string> | null = null;
  private titleDone: boolean;
  private sessionFinished = false;
  private creationHoldUntil = 0;
  private lastScreen: ScreenKind | null = null;
  private symbols: { self: string; other: string } = { self: 'orb', other: 'crescent' };

  constructor(options: InterfaceOptions) {
    this.view = options.view;
    this.cameraCommand = options.camera ?? null;
    this.sounds = new UiSoundGate(options.sound ?? null);
    const texts = loadUiTexts(options.view.content);
    this.ctx = createUiContext(options.view.content, options.view.map, texts, options.view.localCharacter(), (code) =>
      options.view.keyLabel(code),
    );
    const world = options.view.world();
    const me = characterOf(world, this.ctx.me);
    this.titleDone = !((world.phase === 'creation' && me?.created !== true) || world.phase === 'breakfast');
    startMemorySession(world, this.ctx.me);

    // Réglages de la plateforme et couleurs des deux joueurs (README des maquettes, 2.2).
    const html = document.documentElement;
    html.style.setProperty('--lpl-ui-scale', String(options.uiScale));
    html.dataset.motion = options.reducedMotion ? 'reduced' : 'full';
    this.applyPlayers(world);

    this.insertedSprite = document.getElementById(SPRITE_ID) === null ? this.insertSprite() : null;
    this.hud = new Hud(this);
    this.proposals = new ProposalCards(this);
    this.root = el('div', { class: 'lpl-ui' }, [this.hud.root, this.proposals.root]);
    options.overlay.append(this.root);

    this.listen(this.root, 'keydown', (e) => {
      this.onKeyDown(e);
    });
    // Un clic sur l'interface n'est pas un clic dans la scène (le SDK écoute la fenêtre).
    this.listen(this.root, 'pointerdown', (e) => {
      e.stopPropagation();
    });
    // Valider un bouton d'une couche (clic ou Entrée, qui passe par `click()`): son selon `data-sound`.
    this.listen(this.root, 'click', (e) => {
      this.onClickSound(e);
    }, true);
    this.listen(this.root, 'keyup', (e) => {
      if (e.code === 'Space' && this.blockSpaceKeyup) {
        e.preventDefault();
        this.blockSpaceKeyup = false;
      }
    });
    this.listen(window, 'keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    this.listen(window, 'blur', () => {
      this.keysDown.clear();
    });
    this.listen(
      document,
      'pointerdown',
      (e) => {
        this.onPointerDown(e);
      },
      true,
    );
    const off = options.view.onEvent((event) => {
      this.onEvent(event);
    });
    this.cleanups.push(off);
    // Premier dessin tout de suite: aucun HUD vide pendant le chargement de la plateforme.
    this.frame();
  }

  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Document | Window,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    capture = false,
  ): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, capture);
    this.cleanups.push(() => {
      target.removeEventListener(type, listener, capture);
    });
  }

  private insertSprite(): HTMLElement {
    const box = el('div', { id: SPRITE_ID, hidden: true, 'aria-hidden': 'true' });
    // Sprite du studio, empaqueté avec le jeu (aucune donnée externe).
    box.innerHTML = spriteIcones;
    document.body.prepend(box);
    return box;
  }

  private applyPlayers(world: ReadonlyWorld): void {
    const me = characterOf(world, this.ctx.me);
    const other = characterOf(world, this.ctx.partner);
    const html = document.documentElement;
    if (me !== null) {
      setStyleVar(html, '--lpl-player-self', safeColor(me.appearance.scarf));
      this.symbols.self = profileSymbol(me.appearance.scarf);
    }
    if (other !== null) {
      setStyleVar(html, '--lpl-player-other', safeColor(other.appearance.scarf));
      this.symbols.other = profileSymbol(other.appearance.scarf);
    }
  }

  // -------------------------------------------------------------------------
  // UiHost

  send(intent: Intent): void {
    this.view.send(intent);
    this.dirty = true;
  }

  toggleMenu(menu: MenuKind): void {
    const open = this.displayedMenu(this.view.world(), this.now()) === menu || (menu === 'notebook' && this.local === 'notebook');
    this.setMenu(open ? null : menu);
  }

  setMenu(menu: MenuKind | null, tab?: PanelTab): void {
    const me = characterOf(this.view.world(), this.ctx.me);
    if ((menu === 'notebook' || menu === 'letter') && me !== null && isNapping(me)) {
      this.local = 'notebook';
      this.panelTab = menu === 'letter' ? 'mail' : tab;
      this.dirty = true;
      return;
    }
    this.local = null;
    this.pendingMenu = { menu, at: this.now(), tab };
    this.panelTab = tab;
    this.view.send({ type: 'menu', menu });
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  openRoomPanel(): void {
    this.local = 'room';
    this.dirty = true;
  }

  camera(command: CameraCommand): void {
    // Sans commandes de caméra (`main.ts` ne les a pas données), rien: les boutons sont masqués.
    this.cameraCommand?.(command);
  }

  get hasCamera(): boolean {
    return this.cameraCommand !== null;
  }

  read(item: string): void {
    this.reading = item;
    this.dirty = true;
  }

  now(): number {
    return performance.now();
  }

  sound(id: UiSoundId): void {
    this.sounds.play(id, this.now());
  }

  private onClickSound(e: MouseEvent): void {
    const target = e.target instanceof Element ? e.target.closest('button') : null;
    // Seulement dans une couche: le HUD (outils, caméra, carnet) et la proposition ont leurs sons ailleurs.
    if (target === null || !this.mounted?.layer.root.contains(target)) return;
    const id = buttonSound({ disabled: target.disabled, ariaDisabled: target.getAttribute('aria-disabled'), sound: target.getAttribute(SOUND_ATTR) });
    if (id !== null) this.sound(id);
  }

  symbol(player: 'self' | 'other'): string {
    return this.symbols[player];
  }

  // -------------------------------------------------------------------------
  // Contrat GameInterface

  frame(): void {
    const world = this.view.world();
    const now = this.now();
    this.hud.updateClockOnly(world);
    this.hud.updateProgress(world);
    const revisionChanged = world.revision !== this.lastRevision;
    const since = now - this.lastRefresh;
    if (this.dirty || since >= UI_SETTINGS.refreshMaxMs || (revisionChanged && since >= UI_SETTINGS.refreshMinMs)) {
      this.lastRevision = world.revision;
      this.lastRefresh = now;
      this.dirty = false;
      this.refresh(world, now);
    }
  }

  handleKey(code: string): boolean {
    const claimedAt = this.claimed.get(code);
    if (claimedAt !== undefined) {
      this.claimed.delete(code);
      if (this.now() - claimedAt < UI_SETTINGS.claimMs) return true;
    }
    const repeat = this.keysDown.has(code);
    this.keysDown.add(code);
    const active = document.activeElement;
    const inside = active !== null && this.root.contains(active);
    return this.route(code, { shift: false, repeat, inside }, active);
  }

  capturesMovement(): boolean {
    return this.mounted !== null;
  }

  dispose(): void {
    for (const off of this.cleanups.splice(0)) off();
    this.mounted?.layer.dispose?.();
    this.mounted = null;
    this.root.remove();
    this.insertedSprite?.remove();
    const html = document.documentElement;
    for (const name of ['--lpl-ui-scale', '--lpl-player-self', '--lpl-player-other']) html.style.removeProperty(name);
    delete html.dataset.motion;
  }

  // -------------------------------------------------------------------------
  // Rafraîchissement

  private displayedMenu(world: ReadonlyWorld, now: number): MenuKind | null {
    const me = characterOf(world, this.ctx.me);
    const stateMenu = me?.menu ?? null;
    const pending = this.pendingMenu;
    if (pending !== null) {
      if (stateMenu === pending.menu || now - pending.at > UI_SETTINGS.pendingMenuMs) this.pendingMenu = null;
      else return pending.menu;
    }
    return stateMenu;
  }

  private refresh(world: ReadonlyWorld, now: number): void {
    const me = characterOf(world, this.ctx.me);
    if (me === null) return;
    this.applyPlayers(world);

    // L'écran titre est tenu par l'interface; la simulation partage qui est prêt (`titleReady`).
    if (world.characters.every((c) => c.titleReady)) this.titleDone = true;
    if (world.phase !== 'creation' && world.phase !== 'breakfast') this.titleDone = true;
    if (this.lastScreen === 'creation' && world.phase !== 'creation' && this.creationHoldUntil === 0) {
      this.creationHoldUntil = now + UI_SETTINGS.creationReadyHoldMs;
    }
    const creationHold = now < this.creationHoldUntil;
    const screen = screenOf(world, this.ctx.me, { titleDone: this.titleDone, sessionFinished: this.sessionFinished, creationHold });
    this.lastScreen = screen;
    if (this.creationHoldUntil !== 0 && !creationHold && screen !== 'creation') this.creationHoldUntil = -1;

    // Un objet à lire vient d'arriver dans le sac (la carte d'Émile): on le lit une fois.
    const readables = new Set<string>();
    for (const s of me.bag) if (s !== null && (this.ctx.content.items[s.item]?.readText ?? null) !== null) readables.add(s.item);
    if (this.knownReadables !== null) {
      for (const item of readables) if (!this.knownReadables.has(item) && screen === null && me.status === 'active') this.reading = item;
    }
    this.knownReadables = readables;

    // La couche du moment.
    let key: string | null = null;
    let kind: LayerKind = 'screen';
    let build: (() => Layer) | null = null;
    if (screen !== null) {
      key = `screen:${screen}`;
      build = () => {
        switch (screen) {
          case 'title':
            return new TitleScreen(this, world);
          case 'creation':
            return new CreationScreen(this, world);
          case 'breakfast':
            return new BreakfastScreen(this);
          case 'night':
            return new NightScreen(this);
          case 'session_end':
            return new SessionEndScreen(this);
          case 'ended':
            return new EndScreen(this);
        }
      };
    } else {
      const reading = this.reading;
      let source: DialogueSource | null = null;
      if (reading !== null) source = { kind: 'read', item: reading };
      else if (me.status === 'scene' && world.scene !== null) source = { kind: 'scene' };
      else if (me.dialogue !== null) source = { kind: 'dialogue' };
      if (source !== null) {
        const s = source;
        kind = 'dialogue';
        key = s.kind === 'read' ? `read:${s.item}` : `dialogue:${s.kind}`;
        build = () =>
          new DialogueBox(this, s, () => {
            this.reading = null;
            this.dirty = true;
          });
      } else {
        const menu = this.displayedMenu(world, now);
        const panel = menu === null ? null : this.panelFor(menu);
        if (panel !== null && menu !== null) {
          kind = 'panel';
          key = `panel:${menu}`;
          build = panel;
          this.local = null;
        } else if (this.local === 'notebook' && !isNapping(me)) {
          // Réveillé le carnet ouvert: il devient le menu du jeu, comme d'habitude.
          this.setMenu('notebook', this.panelTab);
        } else if (this.local !== null) {
          const local = this.local;
          const tab = this.panelTab;
          kind = 'panel';
          key = `local:${local}`;
          build = () => (local === 'room' ? new RoomPanel(this) : new NotebookPanel(this, tab));
        }
      }
    }
    this.mount(key, kind, build, now);
    if (this.mounted?.layer instanceof CreationScreen && creationHold) this.mounted.layer.setReady();

    // HUD et propositions, sous les écrans plein cadre.
    const fullScreen = this.mounted?.kind === 'screen';
    this.hud.root.toggleAttribute('hidden', fullScreen);
    this.proposals.root.toggleAttribute('hidden', fullScreen);
    this.hud.setLayer(hudState(this.mounted?.kind ?? null, me.placement !== null));
    if (!fullScreen) {
      this.hud.update(world);
      this.proposals.update(world);
    } else {
      this.hud.observeNotifications(world);
    }

    this.mounted?.layer.update(world);
    // Tant qu'une couche est ouverte, le focus y reste (élément disparu, clic sur un fond):
    // le clavier lui arrive sans passer par le personnage.
    const active = document.activeElement;
    if (this.mounted !== null && (active === null || active === document.body) && !this.proposals.contains(active)) {
      focusElement(this.mounted.layer.defaultFocus());
    }
  }

  private salonPort(): SalonPort {
    const me = (world: ReadonlyWorld): ReadonlyCharacter | null => characterOf(world, this.ctx.me);
    return {
      seat: (world) => {
        const c = me(world);
        return c !== null && atSalonChair(c) ? 'chair' : 'bench';
      },
      firstFree: (world) => firstCutFree(world, this.ctx.me),
      received: (world) => {
        const offer = me(world)?.hairOffer ?? null;
        return offer === null ? null : { hair: offer.hair, hairColor: offer.hairColor, beard: offer.beard };
      },
      apply: (look) => { this.send({ type: 'haircut', ...look }); },
      keep: () => {
        const look = me(this.view.world())?.appearance;
        if (look !== undefined) this.send({ type: 'haircut', hair: look.hair, hairColor: look.hairColor, beard: look.beard });
      },
      propose: (look) => { this.send({ type: 'hair_offer', ...look }); },
      answer: (accept) => { this.send({ type: 'hair_offer_answer', accept }); },
    };
  }

  private bakeryPort(): BakeryPort {
    return {
      bought: (world) => bakeryBoughtToday(world, this.ctx.me),
      buy: (item) => { this.send({ type: 'bakery_buy', item: item === 'brioche' ? 'brioche' : 'bread' }); },
    };
  }

  private panelFor(menu: MenuKind): (() => Layer) | null {
    const tab = this.panelTab;
    switch (menu) {
      case 'notebook':
        return () => new NotebookPanel(this, tab);
      case 'letter':
        return () => new NotebookPanel(this, 'mail');
      case 'shop':
        return () => new ShopPanel(this, tab);
      case 'catalogue':
        return () => new BoardPanel(this, tab);
      case 'crate':
        return () => new CratePanel(this);
      case 'workbench':
        return () => new StationPanel(this, 'workbench');
      case 'stove':
        return () => new StationPanel(this, 'stove');
      case 'chest':
        return () => new StoragePanel(this);
      case 'proposal':
        return null;
      // Tour 10: salon de Solange et guichet du fournil (ports vers les intentions du lot L3).
      case 'salon':
        return () => new SalonPanel(this, this.salonPort());
      case 'bakery':
        return () => new BakeryPanel(this, this.bakeryPort());
      case 'stall':
        return () => new StallPanel(this);
      // 0.12: boutique de vêtements et garde-robe (panneaux du lot de l'interface, en parallèle).
      case 'clothes_shop':
      case 'wardrobe':
        return null;
      // 0.12: la basse-cour (poulailler, chevrerie).
      case 'farm':
        return () => new FarmPanel(this);
    }
  }

  private mount(key: string | null, kind: LayerKind, build: (() => Layer) | null, now: number): void {
    if ((this.mounted?.key ?? null) === key) return;
    const previous = this.mounted;
    for (const id of layerSounds(previous, key === null || build === null ? null : { kind, key })) this.sound(id);
    const hadFocus = previous !== null && document.activeElement !== null && previous.layer.root.contains(document.activeElement);
    if (previous !== null) {
      previous.layer.dispose?.();
      previous.layer.root.remove();
      this.mounted = null;
    }
    if (key === null || build === null) {
      // Retour au jeu: le clavier revient au personnage.
      const active = document.activeElement;
      if (active instanceof HTMLElement && (hadFocus || this.root.contains(active))) active.blur();
      return;
    }
    const layer = build();
    this.mounted = { key, kind, layer };
    this.root.append(layer.root);
    layer.update(this.view.world());
    this.guardUntil = now + UI_SETTINGS.arrivalGuardMs;
    focusElement(layer.defaultFocus());
  }

  // -------------------------------------------------------------------------
  // Événements, souris

  private onEvent(event: WorldEvent): void {
    if (event.type === 'session_finish') this.sessionFinished = true;
    // Écran d'étape: deux « Finir » puis deux « Rester » (la plateforme n'a pas encore fermé) font reprendre la partie.
    if (event.type === 'stage_continue') this.sessionFinished = false;
    this.proposals.onEvent(event);
    this.dirty = true;
  }

  private onPointerDown(e: PointerEvent): void {
    const mounted = this.mounted;
    if (mounted?.kind !== 'panel') return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    // Clic sur la scène (hors de l'interface): le panneau se ferme (cahier, 5.1).
    if (!this.root.contains(target) || target === this.root) mounted.layer.close?.();
  }

  // -------------------------------------------------------------------------
  // Clavier

  private onKeyDown(e: KeyboardEvent): void {
    // Échap appartient à la pause de la plateforme.
    if (e.code === 'Escape') return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    const repeat = e.repeat || this.keysDown.has(e.code);
    this.keysDown.add(e.code);
    const inField = target instanceof HTMLInputElement && target.type === 'text';
    if (inField && e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Tab') {
      // Dans le champ du prénom, les lettres et Retour arrière écrivent: le personnage ne bouge pas.
      e.stopPropagation();
      return;
    }
    const handled = this.route(e.code, { shift: e.shiftKey, repeat, inside: true }, target);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      this.claimed.set(e.code, this.now());
      if (e.code === 'Space') this.blockSpaceKeyup = true;
    } else if (this.mounted !== null && !CAMERA_KEYS.has(e.code)) {
      // Une couche capte le clavier: rien n'atteint le personnage.
      e.stopPropagation();
    }
  }

  /** Route une touche. `inside`: le focus est dans l'interface. Vrai si la touche est consommée. */
  private route(code: string, info: KeyInfo, active: Element | null): boolean {
    if (code === 'Escape') return false;
    const now = this.now();
    const mounted = this.mounted;

    // Proposition reçue: elle ne prend le focus qu'avec Entrée.
    if (mounted === null || mounted.kind === 'panel') {
      if (info.inside && this.proposals.contains(active)) return this.proposals.key(code);
    }
    if (mounted === null) {
      // Un bouton du HUD ne garde jamais le clavier: la touche va au jeu (Espace fait agir, sans réactiver le bouton).
      if (active instanceof HTMLElement && this.hud.root.contains(active)) active.blur();
      return this.routeGame(code, info);
    }

    const layer = mounted.layer;
    const insideLayer = active !== null && layer.root.contains(active);
    const layerInfo: KeyInfo = { ...info, inside: insideLayer };

    // Anti-double-appui à l'arrivée, et jamais d'activation par répétition.
    if (ACTIVATION.has(code) && (info.repeat || now < this.guardUntil)) return true;

    if (layer.key?.(code, layerInfo) === true) return true;

    if (layer.closeKey !== undefined && code === layer.closeKey && !info.shift) {
      this.closeLayer(mounted.kind, layer);
      return true;
    }
    if (code === 'Backspace') {
      if (layer.closable) this.closeLayer(mounted.kind, layer);
      return true;
    }
    if (code === 'Tab') {
      this.trap(layer, info.shift, active);
      return true;
    }
    if (!insideLayer) {
      // Le focus est ailleurs (clic sur la scène): la première touche le ramène dans la couche.
      if (ACTIVATION.has(code) || directionOf(code, layer.letterNavigation) !== null) {
        focusElement(layer.defaultFocus());
        return true;
      }
      return !CAMERA_KEYS.has(code) && mounted.kind !== 'panel';
    }
    const direction = directionOf(code, layer.letterNavigation);
    if (direction !== null) {
      if (active instanceof HTMLInputElement && active.type === 'radio') return false;
      this.navigate(layer, mounted.kind, direction, active);
      return true;
    }
    if (ACTIVATION.has(code)) {
      // Le SDK empêche l'action par défaut des touches du jeu: on active nous-mêmes le bouton focalisé.
      if (active instanceof HTMLButtonElement) {
        active.click();
        return true;
      }
      if (active instanceof HTMLInputElement && active.type === 'checkbox') {
        // Une case à cocher (aides du carnet): le clic la bascule et prévient son écouteur.
        active.click();
        return true;
      }
      if (active instanceof HTMLInputElement && active.type === 'radio') {
        active.checked = true;
        active.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return active instanceof HTMLElement && active.tabIndex >= 0;
    }
    return false;
  }

  /** Touches quand aucune couche n'est ouverte (le jeu a le clavier). */
  private routeGame(code: string, info: KeyInfo): boolean {
    const world = this.view.world();
    const me = characterOf(world, this.ctx.me);
    if (me === null) return false;
    switch (code) {
      case 'Tab':
        if (me.status === 'active' || me.status === 'menu' || isNapping(me)) this.setMenu('notebook');
        return true;
      case 'Enter':
      case 'NumpadEnter':
        if (!info.repeat && this.proposals.hasReceived()) return this.proposals.focusDefault();
        // L'invite de la maison: rideaux, chantier de la pièce.
        if (!info.repeat && me.status === 'active') return this.hud.activateInvite();
        return false;
      case 'Backspace':
        if (me.placement !== null) {
          this.send({ type: 'cancel_placement' });
          return true;
        }
        return false;
      case 'KeyT':
        if (me.placement !== null) {
          if (!info.repeat) this.send({ type: 'rotate_furniture', delta: 1 });
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  /** Retour arrière: un panneau sonne en se démontant (`ui-panel-close`), le reste fait `ui-back`. */
  private closeLayer(kind: LayerKind, layer: Layer): void {
    if (kind !== 'panel') this.sound('ui-back');
    layer.close?.();
  }

  private trap(layer: Layer, backwards: boolean, active: Element | null): void {
    const list = focusables(layer.root);
    if (list.length === 0) return;
    const index = active instanceof HTMLElement ? list.indexOf(active) : -1;
    const next = backwards ? (index <= 0 ? list[list.length - 1] : list[index - 1]) : index < 0 || index === list.length - 1 ? list[0] : list[index + 1];
    if (next === undefined || next === active) return;
    next.focus();
    this.sound('ui-focus');
  }

  private navigate(layer: Layer, kind: LayerKind, direction: ReturnType<typeof directionOf>, active: Element | null): void {
    if (direction === null) return;
    // Panneaux: tout le panneau; écrans et dialogues: le groupe de l'élément focalisé.
    const scope = kind === 'panel' ? layer.root : (active?.closest('[data-nav]') ?? null);
    if (scope === null || !(active instanceof HTMLElement)) return;
    const items = [...scope.querySelectorAll<HTMLElement>('[data-nav-item]')].filter((e) => isVisible(e) && e !== active);
    const box = (e: Element): { x: number; y: number; w: number; h: number } => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const index = spatialNeighbour(box(active), items.map(box), direction);
    const next = items[index];
    if (next !== undefined) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
      this.sound('ui-focus');
    }
  }
}

/** Monte l'interface (contrat `CreateInterface` de `etat/vue.ts`). */
export function mountInterface(options: InterfaceOptions): GameInterface {
  return new GameUi(options);
}
