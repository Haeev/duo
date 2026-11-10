# Outils

`nouveau.ts`: crée un contenu depuis son gabarit (`pnpm nouveau <type> <id> [lieu]`). Lancé par Node tel quel (types effacés): pas d'import d'un autre fichier TypeScript, pas de syntaxe non effaçable.

`plan-vers-lieu.ts`: du plan vu du dessus du level designer (`plan.json`) à la carte d'un grand lieu (ADR 0022): `node outils/plan-vers-lieu.ts <plan.json> donnees/lieux/<lieu>/carte.json [--lieu <id>] [--annexe <m>]`. Il écrit les collisions, le terrain, les zones, les verrous, le graphe des chemins, les repères, les points d'intérêt et les bâtiments, puis affiche son relevé: fuites vers une zone fermée, nœuds coupés, nœuds sur une case pleine. La carte produite ne se retouche pas à la main: on corrige le plan et on relance. Testé par `tests/grands-lieux.test.ts` sur le plan d'Aubrune.
