/**
 * Carnet de séance (SDK 1.1, macOS seulement): ce que La Petite Ligne joint à chaque note du
 * client. La légende de chaque image dit le jour, l'heure du jeu et la position du joueur;
 * l'instantané garde l'essentiel de l'état pour retrouver la situation sans la sauvegarde.
 */
import type { NotebookSource } from '@duo/sdk';
import type { GameView } from '../etat/vue';

function hour(minutes: number): string {
  const whole = Math.floor(minutes);
  return `${String(Math.floor(whole / 60) % 24)} h ${String(whole % 60).padStart(2, '0')}`;
}

function coord(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function createNotebookSource(view: GameView, container: HTMLElement): NotebookSource {
  const self = (): ReturnType<GameView['world']>['characters'][number] | null =>
    view.world().characters.find((c) => c.id === view.localCharacter()) ?? null;
  return {
    canvas: () => container.querySelector('canvas'),
    caption: () => {
      const world = view.world();
      const me = self();
      const place =
        me === null
          ? ''
          : `, ${me.inside === null ? 'dehors' : `dans ${me.inside}`}, x ${coord(me.pos.x)} y ${coord(me.pos.y)}`;
      return `Jour ${String(world.clock.day)}, ${hour(world.clock.minutes)} (${world.phase})${place}`;
    },
    snapshot: () => {
      const world = view.world();
      const characters = world.characters.map((c) => ({
        id: c.id,
        nom: c.name,
        local: c.id === view.localCharacter(),
        position: c.pos,
        orientation: c.facing,
        dedans: c.inside,
        action: c.action,
        statut: c.status,
        menu: c.menu,
        dialogue: c.dialogue,
        caseChoisie: c.selected,
        sac: c.bag,
      }));
      return {
        role: view.role,
        tick: world.tick,
        revision: world.revision,
        phase: world.phase,
        horloge: world.clock,
        meteo: world.weather,
        scene: world.scene,
        personnages: characters,
      };
    },
  };
}
