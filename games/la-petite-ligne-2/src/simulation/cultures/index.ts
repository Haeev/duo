/** Système « cultures »: à chaque changement de jour ou de météo, le potager du lieu pousse. */
import type { GameSystem } from '../noyau/systemes';
import { growFields } from './pousse';

export const cropSystem: GameSystem = { id: 'cultures', step: growFields };
