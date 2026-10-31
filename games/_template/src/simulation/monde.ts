// Simulation pure: ni DOM, ni horloge, ni Math.random. Testée dans Node.
import { hashState } from '@duo/sdk/sim';
import { REGLAGES } from './reglages';

export interface Astre {
  x: number;
  y: number;
}

export interface Monde {
  tick: number;
  hote: Astre;
  invite: Astre;
}

/** Ce qu'un joueur tient pendant un pas (sous-ensemble d'un InputFrame du SDK). */
export interface Commandes {
  readonly down: readonly string[];
}

export const AUCUNE_COMMANDE: Commandes = { down: [] };

export function creerMonde(): Monde {
  return {
    tick: 0,
    hote: { x: REGLAGES.largeur * 0.33, y: REGLAGES.hauteur / 2 },
    invite: { x: REGLAGES.largeur * 0.66, y: REGLAGES.hauteur / 2 },
  };
}

function deplacer(astre: Astre, commandes: Commandes, dt: number): void {
  const dx = (commandes.down.includes('right') ? 1 : 0) - (commandes.down.includes('left') ? 1 : 0);
  const dy = (commandes.down.includes('down') ? 1 : 0) - (commandes.down.includes('up') ? 1 : 0);
  const norme = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  astre.x = Math.min(REGLAGES.largeur, Math.max(0, astre.x + dx * norme * REGLAGES.vitesse * dt));
  astre.y = Math.min(REGLAGES.hauteur, Math.max(0, astre.y + dy * norme * REGLAGES.vitesse * dt));
}

/** Un pas de simulation, chez l'hôte. */
export function avancer(monde: Monde, hote: Commandes, invite: Commandes, dt: number): void {
  deplacer(monde.hote, hote, dt);
  deplacer(monde.invite, invite, dt);
  monde.tick++;
}

export function empreinte(monde: Monde): string {
  return hashState(monde);
}
