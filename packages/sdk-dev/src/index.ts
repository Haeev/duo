// Faux hôte des jeux Duo (ADR 0005, point 7). Pages et serveur: voir README.md.
// Ce module sert aux tests des jeux, dans Node: deux instances du SDK reliées en mémoire.
export { startLocalDuo, type LocalDuo, type LocalDuoOptions } from './coeur/duo-local';
export {
  createLocalLinkPair,
  type LinkConditions,
  type LocalLinkPair,
  type PeerLink,
} from './coeur/lien';
export {
  createFakePlatform,
  DEFAULT_SETTINGS,
  type FakePlatform,
  type FakePlatformOptions,
  type PlatformStatus,
} from './coeur/plateforme';
export {
  createMemoryStore,
  type HistoryEntry,
  type SaveStore,
  type StoredSave,
} from './coeur/stockage';
