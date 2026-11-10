# Outils

`nouveau.ts`: crée un contenu depuis son gabarit (`pnpm nouveau <type> <id> [lieu]`). Lancé par Node tel quel (types effacés): pas d'import d'un autre fichier TypeScript, pas de syntaxe non effaçable.

`verifier-carnet.ts`: banc du carnet en petite fenêtre (`pnpm verifier-carnet`): lance Vite et Chromium (celui du système ou `DUO_CHROMIUM`), ouvre la démonstration de l'interface à 1366x768 et 1280x720 et vérifie que le livre et les signets tiennent à l'écran, que les contenus longs défilent (molette, touches, focus) et que « Équiper » répond. Affiche les échecs et sort en code 1.

`plan-vers-lieu.ts`: du plan vu du dessus du level designer (`plan.json`) à la carte d'un grand lieu (ADR 0022): `node outils/plan-vers-lieu.ts <plan.json> donnees/lieux/<lieu>/carte.json [--lieu <id>] [--annexe <m>]`. Il écrit les collisions, le terrain, les zones, les verrous, le graphe des chemins, les repères, les points d'intérêt et les bâtiments, puis affiche son relevé: fuites vers une zone fermée, nœuds coupés, nœuds sur une case pleine. La carte produite ne se retouche pas à la main: on corrige le plan et on relance. Testé par `tests/grands-lieux.test.ts` sur le plan d'Aubrune.
