/**
 * Interface du jeu (lot L7): HTML et CSS par-dessus le canevas 3D. Elle lit l'état par la vue
 * (`GameView`) et envoie des intentions; touches lues par position (`KeyboardEvent.code`),
 * libellés selon le clavier réel (`keyLabel`, du SDK).
 */
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import type { GameView } from '../session';
import { talkView } from '../simulation/dialogues/conversation';
import type { Intent } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import { formatEuros } from '../simulation/sac/argent';
import { createShopScreen } from './boutique/ecran';
import { createWorkshopScreen } from './atelier/ecran';
import { shopRefusalText } from './boutique/textes';
import { createNotebook, type NotebookExtras } from './carnet';
import { UI_SCALE_FACTOR } from './carnet/lectures';
import { createKitchen } from './cuisine/index';
import { createCoopScreen } from './basse-cour/ecran';
import { createDecoMode, decoHousingFor } from './deco/deco';
import { createDialogue, type BabbleInfo } from './dialogue';
import { createDialogueScreens } from './ecrans-dialogue';
import type { UiSettings } from './carnet/lectures';
import { createCharacterEditor, type EditorPreviewFactory } from './editeur/editeur';
import { EDITOR_SETTINGS } from './editeur/reglages';
import { defaultPlayerLook } from '../rendu/personnages/apparence';
import { CHARACTER_SETTINGS } from '../rendu/personnages/reglages';
import { createChapterEnd } from './histoire/fin-chapitre';
import { createSceneOverlay } from './histoire/scene';
import { createSceneLine } from './histoire/replique';
import { createHud, type ProjectToScreen } from './hud';
import { createRunHint } from './astuce-course';
import { createDecisionBanner } from './rappel-decision';
import { fitScale, promptModel } from './modeles';
import { createFishingOverlay } from './peche/index';
import { spriteMarkup } from './pictos';
import { UI_TUNING } from './reglages';
import { fill, refusalText, TEXTS } from './textes';
import { passageSays } from '../simulation/lieux/index';
import { hydrateThumbnails, type ObjectViewer } from '../rendu/objets/index';
import { glanceTarget } from '../simulation/quetes/lecture';
import { lookRevealed } from '../simulation/regles/apparence';

import './interface.css';
import './carnet/carnet.css';
import './encre/cadres.css';
import './encre/encre.css';

/** Refus d'un passage fermé: la phrase `says` du verrou ou de la porte remplace le texte générique. */
const PASSAGE_REASONS: ReadonlySet<string> = new Set(['not-yet', 'door-locked', 'shop-closed']);

export type { BabbleInfo } from './dialogue';
export type { ProjectToScreen } from './hud';
export type { EditorPreview, EditorPreviewFactory } from './editeur/editeur';

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
  /** Branchements des onglets du carnet (sources de lecture, réglages, éditeur de personnage). */
  readonly notebook?: NotebookExtras;
  /** Babil: une syllabe à jouer (lot L9). */
  readonly onBabble?: (info: BabbleInfo) => void;
  /** Aperçu 3D de l'éditeur de personnage (`createCharacterPreview` du rendu). */
  readonly characterPreview?: EditorPreviewFactory;
  /** Couleurs des profils (hôte, invité): pièces de départ proches de sa couleur. */
  readonly playerColors?: readonly [string, string];
  /**
   * Au début de la séance, ouvre l'éditeur chez un joueur dont l'apparence est révélée mais jamais
   * composée (remplaçant d'une partie reprise). Avant la révélation, rien ne s'ouvre: l'éditeur
   * vient d'une réplique de dialogue (`opens`). Défaut: oui.
   */
  readonly editorAtStart?: boolean;
  /** Écoute du clavier (`window` par défaut). */
  readonly keyTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /**
   * Son d'interface sans événement de la simulation (`cues` de `audio/donnees/evenements.json`):
   * ouvrir et fermer le carnet, une marque de la cuisine, un plat posé.
   */
  readonly onCue?: (cue: string) => void;
  /**
   * Visionneuse des objets 3D (`rendu/objets`): les vignettes provisoires du sac, de la barre et
   * de la boutique sont remplacées par l'image rendue du modèle. Absente: vignettes provisoires.
   */
  readonly objectViewer?: ObjectViewer;
}

export interface GameInterface {
  /** Une image: `dt` en secondes depuis la précédente. */
  frame(dt: number): void;
  /** Avis en haut à droite (reprise de partie, partie enregistrée). */
  notice(text: string): void;
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
  PageUp: 'Page préc.',
  PageDown: 'Page suiv.',
};

export function azertyLabel(code: string): string {
  return AZERTY[code] ?? code.replace(/^Key|^Digit/, '');
}

export function createInterface(options: InterfaceOptions): GameInterface {
  const { root, view, send } = options;
  const keyLabel = options.keyLabel ?? azertyLabel;
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = (): boolean =>
    options.reducedMotion === true || media?.matches === true || settingsUi().reducedMotion;
  const settingsUi = (): UiSettings => notebook.tabs.settings.ui();

  const layer = document.createElement('div');
  layer.className = 'lpl-ui';
  layer.innerHTML = spriteMarkup();
  root.append(layer);
  // Vignettes 3D: chaque grille redessinée (sac, barre, boutique) est complétée dès qu'elle paraît.
  const viewer = options.objectViewer;
  const thumbs =
    viewer === undefined || typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          hydrateThumbnails(layer, viewer);
        });
  thumbs?.observe(layer, { childList: true, subtree: true });

  let now = 0;
  const hud = createHud(layer, view.content, keyLabel, options.projectToScreen);
  const decisionBanner = createDecisionBanner(layer, view.content);
  const runHint = createRunHint(
    view.content,
    typeof localStorage === 'undefined' ? null : localStorage,
  );
  // Répliques qui ouvrent un écran (`opens` des données): la table des écrans ouvrables.
  const dialogueScreens = createDialogueScreens(
    {
      'character-editor': {
        open: () => {
          const world = view.world();
          const me = view.localIndex();
          if (world === null || me === null) return false;
          editor.open('create', world, me);
          return true;
        },
        isOpen: () => editor.isOpen(),
      },
    },
    () => {
      const world = view.world();
      const me = view.localIndex();
      return world === null || me === null ? null : talkView(view.content, world, me);
    },
    send,
  );
  const dialogue = createDialogue(
    layer,
    view.content,
    (intent) => {
      dialogueScreens.send(intent);
    },
    keyLabel,
    reduced,
    options.onBabble ?? (() => undefined),
    UI_TUNING.openGuardMs,
    () => {
      const me = view.localIndex();
      return me === null ? '' : nameOf(me === 0 ? 1 : 0);
    },
  );
  const notebook = createNotebook(layer, view.content, send, keyLabel, UI_TUNING.openGuardMs, {
    // Suite suivie: l'état partagé fait foi, « Suivre » part en intention (le coup d'œil la lit).
    follow: {
      get: () => {
        const me = view.localIndex();
        return me === null ? null : (view.world()?.common.story?.tracked[me] ?? null);
      },
      set: (quest) => {
        send({ type: 'quest_track', quest });
      },
    },
    // Onglet Tenues: « Changer de tenue » ouvre l'éditeur comme le miroir.
    openEditor: () => {
      const world = view.world();
      const me = view.localIndex();
      // Pas de tenue à changer tant que le personnage n'a pas de visage (silhouette).
      if (world === null || me === null || !lookRevealed(world, me)) return;
      notebook.close();
      editor.open('mirror', world, me);
    },
    ...options.notebook,
  });
  const shop = createShopScreen(
    layer,
    view.content,
    send,
    keyLabel,
    UI_TUNING.openGuardMs,
    reduced,
  );
  const workshop = createWorkshopScreen(
    layer,
    view.content,
    send,
    keyLabel,
    UI_TUNING.openGuardMs,
    reduced,
  );
  layer.dataset.motion = reduced() ? 'reduced' : 'full';
  const playerColors = options.playerColors ?? EDITOR_SETTINGS.fallbackAccents;
  const editor = createCharacterEditor(layer, {
    data: view.content,
    send,
    keyLabel,
    reduced,
    ...(options.characterPreview === undefined ? {} : { preview: options.characterPreview }),
    starter: (player, gender) =>
      defaultPlayerLook(
        player,
        gender,
        view.content.settings.start.shapes,
        playerColors[player],
        view.content.catalogue,
      ),
    defaultGender: (player) => CHARACTER_SETTINGS.defaultGenders[player],
  });
  let editorShown = options.editorAtStart === false;
  // Mode déco (touche B dans le logement): plan dessiné par l'interface tant que le rendu n'a pas de vue du dessus.
  const deco = createDecoMode({
    layer,
    content: view.content,
    world: view.world,
    localIndex: view.localIndex,
    send,
    keyLabel,
  });

  function local(): PlayerIndex | null {
    return view.localIndex();
  }

  function nameOf(player: PlayerIndex): string {
    return view.world()?.players[player].name ?? '';
  }

  /** Repère du coup d'œil: l'étape ouverte de la suite suivie, dans le lieu où l'on joue. */
  function questMarker(
    world: ReadonlyWorld,
    me: PlayerIndex,
  ): { x: number; y: number; label: string } | null {
    const target = glanceTarget(world, view.content, me);
    return target === null
      ? null
      : { x: target.target.x, y: target.target.y, label: target.objective };
  }

  /** Texte d'un refus; devant un verrou ou une porte fermée, la phrase des données d'abord. */
  function refusalLine(reason: string, target: string | null): string {
    const world = view.world();
    if (target !== null && world !== null && PASSAGE_REASONS.has(reason)) {
      const says = passageSays({ content: view.content, world }, target);
      if (says !== null) return says;
    }
    return shopRefusalText(reason) ?? refusalText(reason);
  }

  function onEvent(event: GameEvent): void {
    kitchen.onEvent(event);
    coop.onEvent(event);
    chapterEnd.onEvent(event, now);
    const me = local();
    if (me === null) return;
    sceneOverlay.onEvent(event, me, now);
    const other: PlayerIndex = me === 0 ? 1 : 0;
    shop.onEvent(event, me, now);
    workshop.onEvent(event, me, now);
    const shownInNotebook = notebook.onEvent(event, me);
    switch (event.type) {
      case 'refused':
        if (event.player === me) dialogue.unlock();
        if (event.player === me && !shop.isOpen() && !workshop.isOpen() && !shownInNotebook)
          hud.refusal(now, refusalLine(event.reason, event.target));
        break;
      case 'pockets_full':
        if (event.player === me) hud.notice(now, 'sac', TEXTS.notices.pocketsFull);
        break;
      case 'money_changed':
        if (event.who === me)
          hud.money(now, `${event.delta > 0 ? '+' : ''}${formatEuros(event.delta)}`);
        else if (event.who === 'chest')
          hud.notice(
            now,
            'coffre',
            fill(TEXTS.notices.chestIn, { montant: formatEuros(view.world()?.common.chest ?? 0) }),
          );
        break;
      case 'train_waiting':
        if (!event.loaded[other])
          hud.notice(now, 'train', fill(TEXTS.notices.otherLoading, { nom: nameOf(other) }));
        break;
      case 'train_boarded':
        if (event.player === other)
          hud.notice(
            now,
            'train',
            fill(event.to === null ? TEXTS.notices.otherLeftTrain : TEXTS.notices.otherAtTrain, {
              nom: nameOf(other),
            }),
          );
        break;
      case 'sleep_waiting':
        hud.notice(
          now,
          'lit',
          fill(event.player === me ? TEXTS.notices.youSleepWait : TEXTS.notices.otherSleeping, {
            nom: nameOf(other),
          }),
        );
        break;
      case 'item_given':
        if (event.to === me)
          hud.notice(
            now,
            'sac',
            fill(TEXTS.notices.given, {
              nom: nameOf(event.from),
              objet: view.content.items[event.item]?.name ?? event.item,
            }),
          );
        break;
      case 'tool_blunt':
        if (event.player === me) hud.notice(now, 'info', TEXTS.notices.toolBlunt);
        break;
      case 'store_opened':
        if (event.player === me) notebook.openStore(event.target, now);
        break;
      case 'decision_changed':
        // Celui qui vient de choisir seul lit la suite dans son dialogue: l'annonce est pour l'autre.
        if (event.state !== 'waiting' || event.player === other)
          hud.notice(
            now,
            'info',
            fill(TEXTS.notices.decision[event.state], { nom: nameOf(other) }),
          );
        break;
      case 'reward_given': {
        const c = view.content;
        const name =
          event.kind === 'recipe'
            ? c.recipes[event.id]?.name
            : event.kind === 'plan'
              ? c.plans[event.id]?.name
              : c.pieces[event.id]?.name;
        hud.notice(now, 'info', fill(TEXTS.notices.reward[event.kind], { nom: name ?? event.id }));
        break;
      }
      case 'mirror_opened': {
        const world = view.world();
        if (event.player === me && world !== null && lookRevealed(world, me))
          editor.open('mirror', world, me);
        break;
      }
      // Les autres événements ne touchent pas l'interface: les changements de palier
      // (`need_tier`) se lisent dans l'état, le médaillon paraît; le babil part de l'écriture.
      // La pêche a son médaillon (`peche/`), qui lit ses événements lui-même.
      case 'fish_cast':
      case 'fish_caught':
      case 'fish_hooked':
      case 'fish_lost':
      case 'ate':
      case 'cook_cancelled':
      case 'cook_part_done':
      case 'cook_started':
      case 'cook_step_done':
      case 'dish_cooked':
      case 'kitchen_opened':
      case 'recipe_learned':
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
      case 'quest_done':
      case 'quest_opened':
      case 'quest_step_done':
      case 'scene_beat':
      case 'scene_ended':
      case 'scene_gesture':
      case 'scene_started':
      case 'chapter_ended':
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
      case 'calendar_ended':
      case 'clock_struck':
      case 'calendar_started':
      case 'collection_completed':
      case 'collection_found':
      case 'collection_record':
      case 'insect_fled':
      case 'net_swung':
      case 'outlook_ready':
      case 'photo_taken':
      case 'rain_watered':
      case 'weather_changed':
      case 'room_progress':
      case 'room_supplied':
      case 'deco_changed':
      case 'comfort_changed':
      case 'shelter_opened':
      case 'shelter_filled':
      case 'shelter_collected':
      case 'animal_petted':
      case 'animal_arrived':
      case 'workshop_opened':
      case 'craft_started':
      case 'craft_hit':
      case 'craft_cancelled':
      case 'crafted':
      case 'plan_learned':
      case 'tool_ordered':
      case 'tool_mended':
      case 'tool_sharpened':
      case 'map_object_changed':
        break;
    }
  }
  const keyTarget = options.keyTarget ?? window;
  const kitchen = createKitchen(layer, view, send, keyLabel, keyTarget, {
    onCue: (cue) => {
      if (cue.type === 'mark')
        options.onCue?.(
          cue.kind === 'season' || cue.kind === 'plate' ? 'choix' : `cuisine-${cue.kind}`,
        );
      else if (cue.type === 'dish') options.onCue?.('poser');
    },
  });
  const coop = createCoopScreen(layer, view, send, keyLabel, keyTarget, UI_TUNING.openGuardMs);
  // Fin de chapitre (écran plein) et consignes des scènes à deux (gestes, jauges).
  const chapterEnd = createChapterEnd(layer, view.content, send, keyLabel, () => {
    options.onCue?.('choix');
  });
  const sceneOverlay = createSceneOverlay({
    root: layer,
    content: view.content,
    keyLabel,
    keyTarget,
    busy: () =>
      editor.isOpen() ||
      deco.isOpen() ||
      dialogue.isOpen() ||
      shop.isOpen() ||
      workshop.isOpen() ||
      notebook.isOpen() ||
      kitchen.isOpen() ||
      coop.isOpen() ||
      chapterEnd.isOpen(),
    ...(options.projectToScreen === undefined ? {} : { projectToScreen: options.projectToScreen }),
  });
  // Répliques des scènes: le bandeau du dialogue, qui attend qu'aucun autre écran n'ait la main.
  const sceneLine = createSceneLine({
    root: layer,
    content: view.content,
    send,
    keyLabel,
    reduced,
    onBabble: options.onBabble ?? (() => undefined),
    openGuardMs: UI_TUNING.openGuardMs,
    busy: () =>
      editor.isOpen() ||
      deco.isOpen() ||
      dialogue.isOpen() ||
      shop.isOpen() ||
      workshop.isOpen() ||
      notebook.isOpen() ||
      kitchen.isOpen() ||
      coop.isOpen() ||
      chapterEnd.isOpen(),
  });
  const fishing = createFishingOverlay({
    ...{
      layer,
      content: view.content,
      world: view.world,
      local,
      aim: view.aim,
      send,
      keyLabel,
      keyTarget,
      onCue: (cue: string) => options.onCue?.(cue),
    },
    ...(options.projectToScreen === undefined ? {} : { projectToScreen: options.projectToScreen }),
  });
  const offEvents = view.onEvent((event) => {
    fishing.onEvent(event);
    onEvent(event);
  });

  const onKey = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent)) return;
    // La fin de chapitre passe devant tout: une touche pour continuer, le reste est avalé.
    if (chapterEnd.isOpen()) {
      if (!raw.repeat && chapterEnd.key(raw.code, now)) raw.preventDefault();
      return;
    }
    if (kitchen.isOpen() || coop.isOpen()) return;
    if (raw.repeat && (raw.code === 'Space' || raw.code === 'Enter')) return;
    let used = false;
    if (editor.isOpen()) used = editor.key(raw);
    else if (deco.isOpen()) used = deco.key(raw.code);
    else if (dialogue.isOpen()) used = dialogue.key(raw.code, now);
    else if (shop.isOpen()) used = shop.key(raw.code, now);
    else if (workshop.isOpen()) used = workshop.key(raw.code, now);
    else if (notebook.isOpen()) used = notebook.key(raw.code, raw.shiftKey, now);
    else if (sceneLine.key(raw.code, now)) used = true;
    else if (raw.code === 'KeyG' && !raw.repeat) {
      hud.glance(now);
      used = true;
    } else if (raw.code === 'KeyB' && !raw.repeat) {
      const home = decoHousingFor(view.content, view.world(), local());
      if (home !== null) deco.open(home);
      used = home !== null;
    } else if (raw.code === 'KeyC' && !raw.repeat) {
      notebook.open(now);
      used = true;
    }
    if (used) raw.preventDefault();
  };
  keyTarget.addEventListener('keydown', onKey);

  let notebookWasOpen = false;
  return {
    notice(text) {
      hud.notice(now, 'info', text);
    },
    frame(dt) {
      const dtMs = Math.max(0, Math.min(250, dt * 1000));
      now += dtMs;
      layer.dataset.motion = reduced() ? 'reduced' : 'full';
      layer.style.zoom = String(
        fitScale(
          UI_SCALE_FACTOR[settingsUi().scale],
          notebook.isOpen(),
          window.innerWidth,
          window.innerHeight,
        ),
      );
      const world = view.world();
      const me = local();
      layer.hidden = world === null || me === null;
      if (world === null || me === null) return;
      if (!editorShown) {
        editorShown = true;
        if (lookRevealed(world, me) && world.players[me].look === null)
          editor.open('create', world, me);
      }
      editor.frame(dt, world, me);
      dialogueScreens.frame();
      fishing.frame(dtMs / 1000);
      dialogue.sync(talkView(view.content, world, me), now);
      dialogue.frame(dtMs);
      notebook.frame(world, me);
      if (notebook.isOpen() !== notebookWasOpen) {
        notebookWasOpen = notebook.isOpen();
        options.onCue?.(notebookWasOpen ? 'carnet-ouvre' : 'carnet-ferme');
      }
      shop.frame(world, me, now);
      workshop.frame(world, me, now);
      kitchen.frame(dtMs);
      deco.frame();
      coop.frame(dtMs);
      chapterEnd.frame(world, me, now);
      sceneOverlay.frame(world, me, now);
      sceneLine.frame(world, me, now, dtMs);
      const shopOpen = shop.isOpen() || workshop.isOpen();
      const menu = notebook.isOpen() || dialogue.isOpen() || shopOpen;
      // Pendant une scène (hors attente) ou un geste de scène, la touche d'action sert à la
      // scène: pas de bulle d'action.
      const prompt =
        menu || sceneOverlay.active() || sceneLine.hidesPrompt()
          ? null
          : promptModel(view.content, world, me, view.aim(me), {
              act: keyLabel('Space'),
              board: keyLabel('Space'),
            });
      hud.frame({
        now,
        world,
        local: me,
        prompt,
        menu: notebook.isOpen() || shopOpen,
        yaw: options.cameraYaw(),
        needsAlways: settingsUi().needsAlways,
        questTarget: questMarker(world, me),
      });
      // Rappel durable d'une décision à deux: caché sous un menu, visible pendant le dialogue.
      decisionBanner.frame(world, me, notebook.isOpen() || shopOpen || editor.isOpen(), now);
      if (runHint.frame(dtMs / 1000, world, me, menu || sceneLine.inScene()))
        hud.notice(now, 'info', fill(TEXTS.notices.runHint, { touche: keyLabel('ShiftLeft') }));
      layer.classList.toggle('lpl-ui--menu', notebook.isOpen() || shopOpen);
      layer.classList.toggle('lpl-ui--scene', sceneLine.inScene());
    },
    capturing() {
      return (
        editor.isOpen() ||
        dialogue.isOpen() ||
        notebook.isOpen() ||
        shop.isOpen() ||
        workshop.isOpen() ||
        kitchen.isOpen() ||
        deco.isOpen() ||
        fishing.capturing() ||
        coop.isOpen() ||
        chapterEnd.isOpen() ||
        sceneLine.capturing()
      );
    },
    dispose() {
      thumbs?.disconnect();
      offEvents();
      fishing.dispose();
      keyTarget.removeEventListener('keydown', onKey);
      hud.dispose();
      decisionBanner.dispose();
      dialogue.dispose();
      notebook.dispose();
      shop.dispose();
      workshop.dispose();
      editor.dispose();
      kitchen.dispose();
      deco.dispose();
      coop.dispose();
      chapterEnd.dispose();
      sceneOverlay.dispose();
      sceneLine.dispose();
      layer.remove();
    },
  };
}
