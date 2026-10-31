// @ts-check
// Fabrication des installateurs de Duo par electron-builder 26 (ADR 0011).
//
// electron-builder ne découvre pas seul un fichier `.config.mjs`: toujours le
// lancer depuis apps/duo avec `--config electron-builder.config.mjs` et
// `--publish never` (scripts dist:mac et dist:win). La publication se fait
// dans GitHub Actions (publication.yml), jamais par electron-builder.
//
// Identifiants figés depuis la première version installée chez le client
// (ADR 0011, section 3.1): `appId`, `productName`, le champ `name` du
// package.json (`duo`) et le nom des exécutables. En changer un casse la mise
// à jour par-dessus, le dossier des données ou la règle du pare-feu.

import path from 'node:path';
import afterPack from './scripts/after-pack.mjs';
import {
  bundledGameFolders,
  extraResourcesFor,
  resolveBundledGames,
} from './scripts/jeux-embarques.mjs';

const appDir = import.meta.dirname;
const repoRoot = path.resolve(appDir, '..', '..');
const icons = path.join(repoRoot, 'design', 'identite', 'b', 'icone-app');

/**
 * Jeux copiés dans l'application, relatifs à la racine du dépôt. Chaque jeu
 * doit être construit avant (`games/<jeu>/dist`, script build:app de la racine,
 * qui les cite aussi). `DUO_JEUX_EMBARQUES=dossier1,dossier2` remplace cette
 * liste le temps d'une fabrication.
 */
const BUNDLED_GAMES = ['games/la-petite-ligne'];

export const bundledGames = resolveBundledGames(
  repoRoot,
  bundledGameFolders(BUNDLED_GAMES, process.env),
);

/** Texte de la demande d'autorisation « Réseau local » de macOS (parcours UX, ADR 0008). */
const LOCAL_NETWORK_USAGE =
  "Duo cherche l'autre ordinateur de votre duo sur le réseau de la maison, pour lancer vos parties.";

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'io.github.haeev.duo',
  productName: 'Duo',
  copyright: 'Copyright © 2026 Studio Duo',
  // Éditeur affiché par Windows (CompanyName de Duo.exe): sans auteur, Duo.exe
  // garderait celui d'Electron, « GitHub, Inc. ».
  extraMetadata: { author: { name: 'Studio Duo' } },

  directories: {
    output: 'dist',
    // electron-builder y prendrait d'office entitlements, installer.nsh ou fond de dmg: rien n'y est attendu.
    buildResources: 'build',
  },

  // Code compilé par electron-vite seulement: ni sources, ni tests, ni cartes de sources.
  // Le principal embarque ses dépendances (externalizeDeps: false): aucun node_modules.
  files: ['out/main/**', 'out/preload/**', 'out/renderer/**', '!**/*.map'],
  asar: true,
  extraResources: extraResourcesFor(bundledGames),

  // Français et anglais seulement: le poids de l'installateur (budget de 150 Mo).
  electronLanguages: ['fr', 'en'],
  // Aucune dépendance native à recompiler.
  npmRebuild: false,

  // Aucun fichier de mise à jour (latest.yml, app-update.yml) tant que la
  // version 1 garde l'avis de nouvelle version (ADR 0011, section 3.6).
  publish: null,

  // Ordre d'electron-builder: afterPack, fusibles, puis signature (ADR 0011, V2).
  afterPack,

  // ADR 0011, section 3.5. Le neuvième fusible d'Electron 45 (wasmTrapHandlers)
  // est inconnu d'electron-builder 26.18 et garde sa valeur par défaut (actif).
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: false,
  },

  mac: {
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] },
    ],
    artifactName: 'Duo-macOS.${ext}',
    icon: path.join(icons, 'duo.icns'),
    category: 'public.app-category.games',
    minimumSystemVersion: '13.0',
    // Signature ad hoc, sans compte Apple Developer (ADR 0011, section 3.2).
    // Le runtime renforcé ne sert qu'à la notarisation et empêcherait le
    // lancement d'une application ad hoc.
    identity: '-',
    hardenedRuntime: false,
    notarize: false,
    extendInfo: {
      NSLocalNetworkUsageDescription: LOCAL_NETWORK_USAGE,
      // Découverte par diffusion UDP, sans Bonjour: pas de NSBonjourServices (ADR 0008).
      // App Nap espacerait les battements d'un Duo caché (ADR 0007): essai demandé par dev-reseau.
      NSAppSleepDisabled: true,
    },
  },
  dmg: {
    // Pas de carte de blocs: la future mise à jour macOS passera par le zip.
    writeUpdateInfo: false,
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: path.join(icons, 'duo.ico'),
  },
  nsis: {
    artifactName: 'Duo-Windows.${ext}',
    // En un clic et par utilisateur: aucun droit d'administrateur, dossier
    // %LOCALAPPDATA%\Programs\duo stable d'une version à l'autre (ADR 0011, 3.4).
    oneClick: true,
    perMachine: false,
    packElevateHelper: false,
    // Installateur en français seulement (sans cette liste, il retombe en anglais).
    installerLanguages: ['fr_FR'],
    language: '1036',
    shortcutName: 'Duo',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
  },

  // Linux: essais de la configuration dans l'environnement cloud seulement.
  linux: {
    target: [{ target: 'dir', arch: ['x64'] }],
    artifactName: 'Duo-Linux.${ext}',
    executableName: 'duo',
    icon: path.join(icons, 'duo-1024.png'),
    category: 'Game',
  },
};

export default config;
