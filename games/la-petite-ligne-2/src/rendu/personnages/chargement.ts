/**
 * Chargement des GLB du catalogue, une fois pour toute la partie. Les adresses viennent de Vite
 * (tout fichier posé dans `assets/commun/personnages/` est servi): un fichier d'emplacement neuf
 * se charge sans code dès que le catalogue le nomme.
 */
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Catalogue, Morphologies } from '../../donnees/schemas/personnage';
import { CharacterLibrary } from './assemblage';

const URLS = import.meta.glob<string>('../../../assets/commun/personnages/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Adresse servie d'un fichier du catalogue (`body.glb`), `null` s'il n'est pas livré. */
export function assetUrl(file: string): string | null {
  for (const [path, url] of Object.entries(URLS)) if (path.endsWith(`/${file}`)) return url;
  return null;
}

/** Charge chaque fichier nommé par le catalogue et rend la bibliothèque partagée. */
export async function loadCharacterLibrary(
  catalogue: Catalogue,
  morphologies: Morphologies,
  load: (file: string) => Promise<GLTF> = loadFromAssets,
): Promise<CharacterLibrary> {
  const names = [...new Set(catalogue.pieces.map((piece) => piece.file))];
  const loaded = await Promise.all(names.map(async (name) => [name, await load(name)] as const));
  return new CharacterLibrary(catalogue, morphologies, new Map(loaded));
}

const loader = new GLTFLoader();

async function loadFromAssets(file: string): Promise<GLTF> {
  const url = assetUrl(file);
  if (url === null) throw new Error(`personnages: ${file} absent des assets`);
  return loader.loadAsync(url);
}
