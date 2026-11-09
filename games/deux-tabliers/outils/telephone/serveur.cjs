'use strict';
// Serveur Vite de la page d'aperçu, sur un port libre (les ports bas sont souvent pris).
const path = require('path');

async function demarrer() {
  const { createServer } = await import('vite');
  const racine = path.resolve(__dirname, '..', '..');
  const serveur = await createServer({
    root: racine,
    configFile: path.join(racine, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1', strictPort: false },
  });
  await serveur.listen();
  const adresse = serveur.httpServer.address();
  const port = typeof adresse === 'object' && adresse !== null ? adresse.port : 5173;
  return {
    url: `http://127.0.0.1:${String(port)}/src/interface/apercu/index.html`,
    fermer: () => serveur.close(),
  };
}

module.exports = { demarrer };
