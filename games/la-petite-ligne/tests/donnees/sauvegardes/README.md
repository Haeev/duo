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
