/**
 * Préférences de l'interface propres à ce joueur, invisibles pour l'autre (aides personnelles du
 * carnet, PE-08). Gardées pour la séance: l'interface n'écrit rien sur le disque, la plateforme ne
 * lui offre pas encore de réglages par joueur.
 */

let mutedNeeds = false;

/** « Besoins en sourdine » (tour 10, section 3.7): aucune ligne sur les besoins; les icônes restent. */
export function needsMuted(): boolean {
  return mutedNeeds;
}

export function setNeedsMuted(value: boolean): void {
  mutedNeeds = value;
}
