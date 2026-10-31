/**
 * Relais de secours par le serveur de développement de Vite: deux navigateurs
 * (sur la même machine ou deux machines du réseau local) échangent les
 * messages du jeu par la connexion de Vite. Sert au chemin de secours sans
 * l'application Duo; jamais livré dans le paquet du jeu.
 */
import type { Plugin } from 'vite';

export const RELAY_EVENT = 'lpl:relais';

export function relaisVite(): Plugin {
  return {
    name: 'la-petite-ligne-relais',
    apply: 'serve',
    configureServer(server) {
      server.ws.on(RELAY_EVENT, (data: unknown, client) => {
        for (const other of server.ws.clients) {
          if (other.socket !== client.socket) other.send(RELAY_EVENT, data as Record<string, unknown>);
        }
      });
    },
  };
}
