/**
 * Vite pour les captures de planche: la configuration du paquet, sans rechargement à chaud ni
 * surveillance des fichiers. Une reconstruction des GLB pendant une capture ne recharge plus la page
 * (elle a tout chargé au départ); chaque planche lance son propre serveur, donc lit l'état du moment.
 */
import { mergeConfig } from 'vite';
import base from '../../../vite.config.ts';

export default mergeConfig(base, { server: { hmr: false, watch: null } });
