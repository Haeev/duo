# Sauvegardes de référence

De vraies sauvegardes de chaque format publié (`WorldSnapshot`: libellé, avancement, `dataSchema`, état), rechargées et jouées jusqu'au lendemain par `tests/sauvegardes-reference.test.ts` à chaque `pnpm test`. Ce test échoue s'il manque une référence pour l'un des formats, du format 1 au format en cours (`DATA_SCHEMA`).

Règles:

- On ne modifie ni ne régénère jamais une référence: elle garde la forme exacte de ce qu'une version publiée a écrit.
- Quand le format change, on ajoute des références du nouveau format (générateur ci-dessous, une fois la migration écrite) et on garde les anciennes.
- Les joueurs sont fictifs (`membre-a` Camille, `membre-b` Sacha): aucune donnée personnelle.

| Fichier | Format | Moment | Graine | Fabriquée par |
|---|---|---|---|---|
| `format-1-milieu-semaine-1.json` | 1 | mardi, jour 4, midi | 7 | version d'une semaine (`1e38cea`) |
| `format-1-fin-de-la-demo.json` | 1 | démo finie, jour 8 à 16 h | 42 | version d'une semaine (`1e38cea`) |
| `format-2-fin-semaine-1.json` | 2 | jour 8 à 16 h, commande 1 payée, train parti | 42 | `generer.ts` (`d64237e`) |
| `format-2-milieu-semaine-2.json` | 2 | mardi, jour 11, midi | 7 | `generer.ts` (`d64237e`) |
| `format-3-fin-semaine-1.json` | 3 | jour 8 à 16 h, commande 1 payée; moments rares et secrets (tour 6) | 42 | `generer.ts` (tour 6) |
| `format-3-milieu-semaine-2.json` | 3 | mardi, jour 11, midi; « Le mot de Lucie » fini, les oies à venir | 7 | `generer.ts` (tour 6) |
| `format-4-fin-semaine-1.json` | 4 | jour 8 à 16 h, commande 1 payée; souvenirs: renard, oies, noms des poules (tour 7) | 42 | `generer.ts` (tour 7) |
| `format-4-milieu-semaine-2.json` | 4 | mardi, jour 11, midi; souvenirs: héron, renard, vers luisants, poules, mot de Lucie | 7 | `generer.ts` (tour 7) |
| `format-4-fin-de-la-demo.json` | 4 | démo finie, jour 15 à 16 h, écran de fin (la sauvegarde du client au tour 8) | 42 | `generer.ts` du format 4 (`12459fd`, avant le tour 8) |
| `format-5-fin-semaine-1.json` | 5 | jour 8 à 16 h, commande 1 payée (tour 8) | 42 | `generer.ts` (tour 8) |
| `format-5-milieu-semaine-2.json` | 5 | mardi, jour 11, midi (tour 8) | 7 | `generer.ts` (tour 8) |
| `format-5-fin-de-la-demo.json` | 5 | jour 15 à 16 h, écran d'étape « Deux semaines », commande 3 tirée pour le samedi 22 | 42 | `generer.ts` (tour 8) |
| `format-5-ete-jour-25.json` | 5 | restés à la Halte, mardi 25 à midi, été, commande générée du samedi 29 en cours | 7 | `generer.ts` (tour 8) |
| `format-5-fin-ete-jour-43.json` | 5 | écran d'étape du samedi 43, « Six semaines », sans « Rester » dans cette version (T9-17) | 7 | `generer.ts` du format 5 (avant le tour 9) |
| `format-6-fin-semaine-1.json` | 6 | jour 8 à 16 h, commande 1 payée (tour 9) | 42 | `generer.ts` (tour 9) |
| `format-6-milieu-semaine-2.json` | 6 | mardi, jour 11, midi (tour 9) | 7 | `generer.ts` (tour 9) |
| `format-6-fin-de-la-demo.json` | 6 | jour 15 à 16 h, écran d'étape « Deux semaines » (tour 9) | 42 | `generer.ts` (tour 9) |
| `format-6-ete-jour-25.json` | 6 | mardi 25 à midi, tableau des annonces, achats et chantiers du robot (tour 9) | 7 | `generer.ts` (tour 9) |
| `format-6-automne-jour-62.json` | 6 | jeudi 62 à midi, automne, commande du samedi 64 en cours (T9-16) | 7 | `generer.ts` (tour 9) |
| `format-7-fin-semaine-1.json` | 7 | jour 8 à 16 h, commande 1 payée (tour 10) | 42 | `generer.ts` (tour 10) |
| `format-7-milieu-semaine-2.json` | 7 | mardi, jour 11, midi (tour 10) | 7 | `generer.ts` (tour 10) |
| `format-7-fin-de-la-demo.json` | 7 | jour 15 à 16 h, écran d'étape « Deux semaines » (tour 10) | 42 | `generer.ts` (tour 10) |
| `format-7-ete-jour-25.json` | 7 | mardi 25 à midi (tour 10) | 7 | `generer.ts` (tour 10) |
| `format-7-automne-jour-62.json` | 7 | jeudi 62 à midi, automne (tour 10) | 7 | `generer.ts` (tour 10) |
| `format-8-fin-semaine-1.json` | 8 | jour 8 à 16 h, commande 1 payée (tour 11) | 42 | `generer.ts` (tour 11) |
| `format-8-milieu-semaine-2.json` | 8 | mardi, jour 11, midi (tour 11) | 7 | `generer.ts` (tour 11) |
| `format-8-fin-de-la-demo.json` | 8 | jour 15 à 16 h, écran d'étape « Deux semaines » (tour 11) | 42 | `generer.ts` (tour 11) |
| `format-8-ete-jour-25.json` | 8 | mardi 25 à midi (tour 11) | 7 | `generer.ts` (tour 11) |
| `format-8-automne-jour-62.json` | 8 | jeudi 62 à midi, automne, lettres sans texte rendu (tour 11) | 7 | `generer.ts` (tour 11) |
| `format-9-fin-semaine-1.json` | 9 | jour 8 à 16 h, commande 1 payée; `decor` vide (0.11.2) | 42 | `generer.ts` (0.11.2) |
| `format-9-milieu-semaine-2.json` | 9 | mardi, jour 11, midi (0.11.2) | 7 | `generer.ts` (0.11.2) |
| `format-9-fin-de-la-demo.json` | 9 | jour 15 à 16 h, écran d'étape « Deux semaines » (0.11.2) | 42 | `generer.ts` (0.11.2) |
| `format-9-ete-jour-25.json` | 9 | mardi 25 à midi (0.11.2) | 7 | `generer.ts` (0.11.2) |
| `format-9-automne-jour-62.json` | 9 | jeudi 62 à midi, automne (0.11.2) | 7 | `generer.ts` (0.11.2) |
| `format-10-fin-semaine-1.json` | 10 | jour 8 à 16 h, commande 1 payée; carnet des poissons (pêche 0.12) | 42 | `generer.ts` (0.12) |
| `format-10-milieu-semaine-2.json` | 10 | mardi, jour 11, midi (pêche 0.12) | 7 | `generer.ts` (0.12) |
| `format-10-fin-de-la-demo.json` | 10 | jour 15 à 16 h, écran d'étape « Deux semaines » (pêche 0.12) | 42 | `generer.ts` (0.12) |
| `format-10-ete-jour-25.json` | 10 | mardi 25 à midi, coin qui frémit et grands du jour (pêche 0.12) | 7 | `generer.ts` (0.12) |
| `format-11-fin-semaine-1.json` | 11 | jour 8 à 16 h, commande 1 payée; garde-robe (0.12) | 42 | `generer.ts` (0.12) |
| `format-11-milieu-semaine-2.json` | 11 | mardi, jour 11, midi (0.12) | 7 | `generer.ts` (0.12) |
| `format-11-fin-de-la-demo.json` | 11 | jour 15 à 16 h, écran d'étape « Deux semaines » (0.12) | 42 | `generer.ts` (0.12) |
| `format-11-ete-jour-25.json` | 11 | mardi 25 à midi (0.12) | 7 | `generer.ts` (0.12) |
| `format-11-automne-jour-62.json` | 11 | jeudi 62 à midi, automne, garde-robe (`wear`, `wardrobe`) (0.12) | 7 | `generer.ts` (0.12) |
| `format-12-fin-semaine-1.json` | 12 | jour 8 à 16 h, commande 1 payée; élevage (bonheur des poules, `breeding`) et champs de l'économie (0.12) | 42 | `generer.ts` (0.12) |
| `format-12-milieu-semaine-2.json` | 12 | mardi, jour 11, midi (0.12) | 7 | `generer.ts` (0.12) |
| `format-12-fin-de-la-demo.json` | 12 | jour 15 à 16 h, écran d'étape « Deux semaines » (0.12) | 42 | `generer.ts` (0.12) |
| `format-12-ete-jour-25.json` | 12 | mardi 25 à midi (0.12; sans référence du jeudi 62, la plus longue à fabriquer) | 7 | `generer.ts` (0.12) |
| `format-13-fin-semaine-1.json` | 13 | jour 8 à 16 h, commande 1 payée; plus de valeurs par défaut écrites (plis, quêtes, notifications, séjours, chantiers) (0.12.1) | 42 | `generer.ts` (0.12.1) |
| `format-13-milieu-semaine-2.json` | 13 | mardi, jour 11, midi (0.12.1) | 7 | `generer.ts` (0.12.1) |
| `format-13-fin-de-la-demo.json` | 13 | jour 15 à 16 h, écran d'étape « Deux semaines » (0.12.1) | 42 | `generer.ts` (0.12.1) |
| `format-13-ete-jour-25.json` | 13 | mardi 25 à midi (0.12.1; sans référence du jeudi 62, comme le format 12) | 7 | `generer.ts` (0.12.1) |
| `format-14-fin-semaine-1.json` | 14 | jour 8 à 16 h, commande 1 payée; 21 habitants, carnet des habitudes et champs de l'amitié (0.13, lot H1) | 42 | `generer.ts` (0.13, lot H1) |
| `format-14-milieu-semaine-2.json` | 14 | mardi, jour 11, midi (0.13, lot H1) | 7 | `generer.ts` (0.13, lot H1) |
| `format-14-fin-de-la-demo.json` | 14 | jour 15 à 16 h, écran d'étape « Deux semaines » (0.13, lot H1) | 42 | `generer.ts` (0.13, lot H1) |
| `format-14-ete-jour-25.json` | 14 | mardi 25 à midi (0.13, lot H1; sans référence du jeudi 62, comme les formats 12 et 13) | 7 | `generer.ts` (0.13, lot H1) |

## Format en cours

```sh
pnpm exec vitest run --config tests/donnees/sauvegardes/generer.config.ts
```

Lancé depuis `games/la-petite-ligne`. Il fabrique les références de `generer.ts` qui manquent et ne réécrit jamais un fichier existant.

## Format 1 (fait le 2026-10-31)

Le code de la version d'une semaine (`1e38cea`, dernier commit publié au format 1, avec son propre SDK) extrait par `git archive 1e38cea games/la-petite-ligne packages/sdk` dans un dossier temporaire, relié aux dépendances installées, puis ce test lancé dans ce dossier avec son Vitest:

```ts
it('fabrique les sauvegardes du format 1', () => {
  expect(DATA_SCHEMA).toBe(1);
  const middle = newSim(7);
  play(middle, createRobot(), (s) => s.world.clock.day === 4 && s.world.clock.minutes >= 12 * 60, MAX_TICKS);
  writeFileSync(`${OUT}format-1-milieu-semaine-1.json`, `${JSON.stringify(snapshotOf(middle), null, 2)}\n`);
  const end = newSim(42);
  play(end, createRobot(), (s) => s.world.phase === 'ended', MAX_TICKS);
  writeFileSync(`${OUT}format-1-fin-de-la-demo.json`, `${JSON.stringify(snapshotOf(end), null, 2)}\n`);
});
```
