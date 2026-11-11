/**
 * Onglets du carnet autres que le Sac. `createCarnetTabs` assemble les six onglets sur des
 * sources de lecture étroites (`lectures.ts`); le carnet (`../carnet.ts`) n'en sait rien d'autre
 * que « rends cet onglet, passe-lui cette touche ».
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { DEFAULT_GRAPHICS_OPTIONS, type GraphicsOptions } from '../../rendu/options';
import { createCollectionsTab } from './collections';
import { createMapTab } from './carte';
import { dummySources } from './fictif';
import { createVillagersTab, type SharedTabState } from './habitants';
import {
  DEFAULT_UI_SETTINGS,
  worldSources,
  type CarnetSources,
  type SettingsPort,
  type WorldSourcesExtras,
} from './lectures';
import type { Tab, TabDeps, TabHint, TabId, TabPages } from './onglet';
import { createSettingsTab, memorySettings } from './options';
import { createQuestsTab, memoryFollow, type FollowStore } from './quetes';
import { createOutfitsTab } from './tenues';
import { decisionReminderTexts } from '../rappel-decision';

export type { CarnetSources, SettingsPort, UiSettings } from './lectures';
export type { FollowStore } from './quetes';
export type { TabId } from './onglet';

export interface CarnetTabsOptions {
  readonly content: Content;
  readonly keyLabel: (code: string) => string;
  /** Redessine le carnet. */
  readonly invalidate: () => void;
  /** Passe à un autre onglet. */
  readonly goto: (tab: TabId) => void;
  /** Sources de lecture; par défaut l'état réel (`worldSources`), les manques en vide. */
  readonly sources?: CarnetSources;
  readonly sourcesExtras?: WorldSourcesExtras;
  /** Réglages de la machine; par défaut en mémoire. */
  readonly settings?: SettingsPort;
  /** Ouvre l'éditeur de personnage (autre lot). */
  readonly openEditor?: () => void;
  readonly follow?: FollowStore;
}

export interface CarnetTabs {
  render(tab: TabId, world: ReadonlyWorld, local: PlayerIndex): TabPages;
  signature(tab: TabId, world: ReadonlyWorld, local: PlayerIndex): string;
  key(tab: TabId, code: string, shift: boolean, world: ReadonlyWorld, local: PlayerIndex): boolean;
  hints(tab: TabId): readonly TabHint[];
  closed(world: ReadonlyWorld, local: PlayerIndex): void;
  /** Suite suivie par ce joueur (lue par le coup d'œil). */
  readonly follow: FollowStore;
  readonly settings: SettingsPort;
}

export function createCarnetTabs(options: CarnetTabsOptions): CarnetTabs {
  const sources = options.sources ?? worldSources(options.content, options.sourcesExtras);
  const follow = options.follow ?? memoryFollow();
  const shared: SharedTabState = { mapFocus: null };
  let graphics: GraphicsOptions = DEFAULT_GRAPHICS_OPTIONS;
  const settings =
    options.settings ??
    memorySettings(
      {
        get: () => graphics,
        set(next) {
          graphics = next;
        },
      },
      DEFAULT_UI_SETTINGS,
    );
  const deps: TabDeps = {
    invalidate: options.invalidate,
    goto: options.goto,
    keyLabel: options.keyLabel,
  };

  const tabs: Readonly<Record<TabId, Tab>> = {
    quests: createQuestsTab(
      deps,
      (w, l) => sources.quests(w, l),
      follow,
      (w, l) => decisionReminderTexts(w, options.content, l),
    ),
    villagers: createVillagersTab(deps, (w, l) => sources.villagers(w, l), shared),
    collections: createCollectionsTab(
      deps,
      (w, l) => sources.collections(w, l),
      (i, w) => w.players[i].name,
    ),
    map: createMapTab(deps, {
      read: (w, l) => sources.map(w, l),
      follow,
      shared,
      targetOf: (w, l, followed) =>
        followed === null
          ? null
          : (sources.quests(w, l).find((q) => q.id === followed)?.target ?? null),
    }),
    outfits: createOutfitsTab(deps, options.openEditor ?? (() => undefined)),
    settings: createSettingsTab(deps, settings),
  };

  return {
    render: (tab, w, l) => tabs[tab].render(w, l),
    signature: (tab, w, l) => tabs[tab].signature(w, l),
    key: (tab, code, shift, w, l) => tabs[tab].key(code, shift, w, l),
    hints: (tab) => tabs[tab].hints(),
    closed(w, l) {
      for (const tab of Object.values(tabs)) tab.closed(w, l);
    },
    follow,
    settings,
  };
}

export { dummySources };
