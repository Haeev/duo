// Les chantiers branchés dans la simulation, dans l'ordre de leurs pas.
import { amenagementChantier } from '../amenagement';
import { clienteleChantier } from '../clientele';
import { serviceChantier } from '../service';
import type { Chantier, StationHandler } from './systemes';

export const CHANTIERS: readonly Chantier[] = [
  serviceChantier,
  clienteleChantier,
  amenagementChantier,
];

export function stationHandler(station: string): StationHandler | undefined {
  for (const c of CHANTIERS) {
    const handler = c.stations?.[station];
    if (handler !== undefined) return handler;
  }
  return undefined;
}
