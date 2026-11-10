/**
 * Interface du jeu (lot L7): HTML et CSS par-dessus le canevas 3D. Elle lit l'état par la vue
 * (`GameView`) et envoie des intentions; touches lues par position (`KeyboardEvent.code`),
 * libellés selon le clavier réel (`keyLabel`, du SDK).
 */
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { GameView } from '../session';
import { talkView } from '../simulation/dialogues/conversation';
import type { Intent } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import { formatEuros } from '../simulation/sac/argent';
import { createShopScreen } from './boutique/ecran';
import { shopRefusalText } from './boutique/textes';
import { createNotebook } from './carnet';
import { createDialogue, type BabbleInfo } from './dialogue';
import { createHud, type ProjectToScreen } from './hud';
import { promptModel } from './modeles';
import { spriteMarkup } from './pictos';
import { UI_TUNING } from './reglages';
import { fill, refusalText, TEXTS } from './textes';
import './interface.css';

export type { BabbleInfo } from './dialogue';
export type { ProjectToScreen } from './hud';

export interface InterfaceOptions {
  /** Élément qui reçoit l'interface (par-dessus le canevas). */
  readonly root: HTMLElement;
  readonly view: Pick<GameView, 'content' | 'world' | 'localIndex' | 'aim' | 'onEvent'>;
  readonly send: (intent: Intent) => void;
  /** Lacet affiché de la caméra (radians, convention de `entrees/commandes.ts`). */
  readonly cameraYaw: () => number;
  /** Projection monde vers écran (px CSS), fournie par le rendu; absente: bulle au-dessus de la barre. */
  readonly projectToScreen?: ProjectToScreen;
  /** Libellé d'une touche selon le clavier réel (`duo.input.keyLabel`). Défaut: AZERTY. */
  readonly keyLabel?: (code: string) => string;
  /** Animations réduites (`duo.ui.reducedMotion`); le réglage de l'ordinateur compte aussi. */
  readonly reducedMotion?: boolean;
  /** Babil: une syllabe à jouer (lot L9). */
  readonly onBabble?: (info: BabbleInfo) => void;
  /** Écoute du clavier (`window` par défaut). */
  readonly keyTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export interface GameInterface {
  /** Une image: `dt` en secondes depuis la précédente. */
  frame(dt: number): void;
  /**
   * Un écran de l'interface prend le clavier (dialogue, carnet, rangement): la boucle ne doit
   * alors envoyer ni déplacement ni touche d'action à la simulation.
   */
  capturing(): boolean;
  dispose(): void;
}

/** Libellés AZERTY quand le SDK n'en donne pas (page de démonstration, tests). */
const AZERTY: Readonly<Record<string, string>> = {
  Space: 'Espace',
  Enter: 'Entrée',
  Backspace: 'Retour',
  Tab: 'Tab',
  KeyQ: 'A',
  KeyW: 'Z',
  KeyA: 'Q',
  KeyZ: 'W',
  ShiftLeft: 'Maj',
};

export function azertyLabel(code: string): string {
  return AZERTY[code] ?? code.replace(/^Key|^Digit/, '');
}

export function createInterface(options: InterfaceOptions): GameInterface {
  const { root, view, send } = options;
  const keyLabel = options.keyLabel ?? azertyLabel;
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = (): boolean => options.reducedMotion === true || media?.matches === true;

  const layer = document.createElement('div');
  layer.className = 'lpl-ui';
  layer.dataset.motion = reduced() ? 'reduced' : 'full';
  layer.innerHTML = spriteMarkup();
  root.append(layer);

  let now = 0;
  const hud = createHud(layer, view.content, keyLabel, options.projectToScreen);
  const dialogue = createDialogue(
    layer,
    view.content,
    send,
    keyLabel,
    reduced,
    options.onBabble ?? (() => undefined),
    UI_TUNING.openGuardMs,
  );
  const notebook = createNotebook(layer, view.content, send, keyLabel, UI_TUNING.openGuardMs);
  const shop = createShopScreen(layer, view.content, send, keyLabel, UI_TUNING.openGuardMs, reduced);

  function local(): PlayerIndex | null {
    return view.localIndex();
  }

  function nameOf(player: PlayerIndex): string {
    return view.world()?.players[player].name ?? '';
  }

  function onEvent(event: GameEvent): void {
    const me = local();
    if (me === null) return;
    const other: PlayerIndex = me === 0 ? 1 : 0;
    shop.onEvent(event, me, now);
    switch (event.type) {
      case 'refused':
        if (event.player === me && !shop.isOpen()) hud.refusal(now, shopRefusalText(event.reason) ?? refusalText(event.reason));
        break;
      case 'pockets_full':
        if (event.player === me) hud.notice(now, 'sac', TEXTS.notices.pocketsFull);
        break;
      case 'money_changed':
        if (event.who === me) hud.money(now, `${event.delta > 0 ? '+' : ''}${formatEuros(event.delta)}`);
        else if (event.who === 'chest')
          hud.notice(now, 'coffre', fill(TEXTS.notices.chestIn, { montant: formatEuros(view.world()?.common.chest ?? 0) }));
        break;
      case 'train_waiting':
        if (!event.loaded[other]) hud.notice(now, 'train', fill(TEXTS.notices.otherLoading, { nom: nameOf(other) }));
        break;
      case 'train_boarded':
        if (event.player === other)
          hud.notice(now, 'train', fill(event.to === null ? TEXTS.notices.otherLeftTrain : TEXTS.notices.otherAtTrain, { nom: nameOf(other) }));
        break;
      case 'sleep_waiting':
        hud.notice(
          now,
          'lit',
          fill(event.player === me ? TEXTS.notices.youSleepWait : TEXTS.notices.otherSleeping, { nom: nameOf(other) }),
        );
        break;
      case 'item_given':
        if (event.to === me)
          hud.notice(now, 'sac', fill(TEXTS.notices.given, { nom: nameOf(event.from), objet: view.content.items[event.item]?.name ?? event.item }));
        break;
      case 'tool_blunt':
        if (event.player === me) hud.notice(now, 'info', TEXTS.notices.toolBlunt);
        break;
      case 'store_opened':
        if (event.player === me) notebook.openStore(event.target, now);
        break;
      // Les autres événements ne touchent pas l'interface: les changements de palier
      // (`need_tier`) se lisent dans l'état, le médaillon paraît; le babil part de l'écriture.
      case 'ate':
      case 'bag_changed':
      case 'brick_used':
      case 'shop_bought':
      case 'shop_opened':
      case 'shop_sold':
      case 'day_started':
      case 'gesture_done':
      case 'gesture_started':
      case 'item_gained':
      case 'meal_shared':
      case 'need_tier':
      case 'talk_ended':
      case 'talk_page':
      case 'talk_started':
      case 'tool_repaired':
      case 'train_arrived':
      case 'train_departed':
      case 'unstuck':
      case 'work_hit':
      case 'harvested':
      case 'plot_changed':
      case 'crop_reaped':
      case 'tool_upgraded':
      case 'villager_arrived':
      case 'villager_door':
      case 'lock_opened':
      case 'lock_closed':
      case 'door_passed':
      case 'villager_gift':
      case 'villager_greeted':
      case 'villager_left':
      case 'villager_reacted':
        break;
    }
  }
  const offEvents = view.onEvent(onEvent);

  const keyTarget = options.keyTarget ?? window;
  const onKey = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent)) return;
    if (raw.repeat && (raw.code === 'Space' || raw.code === 'Enter')) return;
    let used = false;
    if (dialogue.isOpen()) used = dialogue.key(raw.code, now);
    else if (shop.isOpen()) used = shop.key(raw.code, now);
    else if (notebook.isOpen()) used = notebook.key(raw.code, raw.shiftKey, now);
    else if (raw.code === 'KeyG' && !raw.repeat) {
      hud.glance(now);
      used = true;
    } else if (raw.code === 'KeyC' && !raw.repeat) {
      notebook.open(now);
      used = true;
    }
    if (used) raw.preventDefault();
  };
  keyTarget.addEventListener('keydown', onKey);

  return {
    frame(dt) {
      const dtMs = Math.max(0, Math.min(250, dt * 1000));
      now += dtMs;
      layer.dataset.motion = reduced() ? 'reduced' : 'full';
      const world = view.world();
      const me = local();
      layer.hidden = world === null || me === null;
      if (world === null || me === null) return;
      dialogue.sync(talkView(view.content, world, me), now);
      dialogue.frame(dtMs);
      notebook.frame(world, me);
      shop.frame(world, me, now);
      const shopOpen = shop.isOpen();
      const menu = notebook.isOpen() || dialogue.isOpen() || shopOpen;
      const prompt = menu
        ? null
        : promptModel(view.content, world, me, view.aim(me), { act: keyLabel('Space'), board: keyLabel('Enter') });
      hud.frame({ now, world, local: me, prompt, menu: notebook.isOpen() || shopOpen, yaw: options.cameraYaw() });
      layer.classList.toggle('lpl-ui--menu', notebook.isOpen() || shopOpen);
    },
    capturing() {
      return dialogue.isOpen() || notebook.isOpen() || shop.isOpen();
    },
    dispose() {
      offEvents();
      keyTarget.removeEventListener('keydown', onKey);
      hud.dispose();
      dialogue.dispose();
      notebook.dispose();
      shop.dispose();
      layer.remove();
    },
  };
}
