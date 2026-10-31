/**
 * Point d'entrée du rendu 3D (contrat `CreateRenderer` de `etat/vue.ts`).
 */
import type { CreateRenderer, Renderer, RendererOptions } from '../etat/vue';
import { RenderEngine } from './moteur';

export const createRenderer: CreateRenderer = (options: RendererOptions): Renderer =>
  new RenderEngine(options);

export { RenderEngine } from './moteur';
export { RENDER_SETTINGS } from './reglages';
