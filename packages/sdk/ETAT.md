# État du lot L3 (SDK et faux hôte)

Compte rendu intermédiaire de l'architecte, mis à jour à chaque étape.

## Étape 1: paquets créés (fait)

- `packages/protocol` (`@duo/protocol`), `packages/sdk` (`@duo/sdk`), `packages/sdk-dev` (`@duo/sdk-dev`) existent avec package.json, tsconfig, eslint, vitest; `pnpm install` lancé une fois à la racine.
- Un jeu peut déjà déclarer `"@duo/sdk": "workspace:*"` (dépendance) et `"@duo/sdk-dev": "workspace:*"` (développement).
- L'API publique n'est pas encore stable: attendre `packages/sdk/README.md`.
