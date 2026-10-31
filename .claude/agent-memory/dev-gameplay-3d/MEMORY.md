# Carnet de dev-gameplay-3d

Apprentissages durables (conventions, pièges, astuces vérifiées). Pas d'avancement ici.

## Interface HTML sur une scène Three.js (La Petite Ligne)

Apprentissages vérifiés le 2026-10-31 en codant `games/la-petite-ligne/src/interface/`.

- Le SDK Duo écoute `keydown` sur `window` en capture et appelle `preventDefault()` pour toute touche liée à une action du manifeste (Espace, Entrée, Tab, flèches, Z Q S D...), sauf si la cible est un champ de saisie. Conséquence: un bouton focalisé ne s'active plus tout seul avec Entrée ou Espace. L'interface doit appeler `click()` elle-même, et naviguer au clavier sans compter sur Tab natif.
- Le SDK écoute aussi `pointerdown` sur `window` (phase de bouillonnement): arrêter la propagation sur la racine de l'interface évite qu'un clic sur le HUD devienne un clic dans la scène (`move_to` sous la barre d'outils).
- Une touche traitée par l'interface (focus dedans) arrive quand même à `handleKey` au pas suivant, par `wasPressed` du SDK: marquer la touche « déjà traitée » quelques centaines de ms et l'ignorer dans `handleKey`.
- Tant qu'une couche (écran, dialogue, panneau) est ouverte, garder le focus dedans: sinon les touches vont à `body`, puis au personnage.
- L'outil d'écriture de fichiers transforme les échappements Unicode d'un fichier (espace insécable U+00A0, tirets U+2013 et U+2014 écrits avec barre oblique inverse et u) en vrais caractères: ESLint refuse les espaces insécables (`no-irregular-whitespace`) et `pnpm verifier` refuse les tirets longs. Réécrire ces lignes par un petit script Python qui remet les échappements.
- `ui-maquettes/composants.css`: `.lpl-stamina__fill` est un `span` en ligne, sans largeur: corrigé par `display: block` dans `interface.css`.
- Arbre de travail partagé: le serveur de Vite recharge la page à chaque modification des autres membres. Les captures Playwright doivent détecter `framenavigated` et recommencer; pour le vrai jeu en deux vues, servir une construction figée (`vite build --outDir` dans le scratchpad, puis `vite preview`).
- Rendu logiciel de l'environnement cloud: deux vues 3D dans le faux hôte affament les minuteries (trous de 1 à 7 s), et le faux hôte coupe la partie (« Le jeu ne répond plus »). Vérifier l'interface sur la page de démonstration (`rendu=0` pour les mesures), et le vrai jeu seulement sur ses premiers écrans.
- Mesure: un rafraîchissement complet de l'interface coûte environ 0,8 ms (Chromium sans tête); limité à 11 par seconde, le reste des images ne compare qu'une chaîne (l'heure).
