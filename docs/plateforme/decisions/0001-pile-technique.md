# ADR 0001: Pile technique et versions figées

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | ingenieur-build |
| Fonctions du cahier | toutes; section 6 (contraintes techniques) |
| Liens | ADR 0002 (outillage), 0012 (interface), 0014 (moteur 2D, différé) |

## Contexte

Le client a validé l'orientation technique (CLAUDE.md, 2026-10-30): Electron, TypeScript strict, Vite, Three.js, PixiJS ou Phaser. Le cahier 1.0 (section 6) demande que les versions soient figées par ADR. Trois faits pèsent sur le choix:

- Electron publie une majeure toutes les 8 semaines et ne maintient que les trois dernières, soit environ 6 mois chacune. Electron 45.0.0 est sortie le 2026-10-21.
- Plusieurs briques sont très récentes (Vite 8, Vitest 5, TypeScript 7, Preact 11, Phaser 4) et mal connues des agents: une API devinée de mémoire a de bonnes chances d'être fausse.
- Les deux machines doivent exécuter exactement le même code: les jeux en lockstep exigent même le même moteur JavaScript des deux côtés (ADR 0006).

Versions relevées avec `npm view` le 2026-10-30 (deux relevés, le matin pour `architecture.md` 0.1 et à la rédaction de cet ADR: identiques).

## Options

### Version d'Electron

| Option | Pour | Contre |
|---|---|---|
| Electron 45.2.0 (dernière stable) | fenêtre de maintenance la plus longue (jusqu'à la sortie d'Electron 48, vers avril 2027); essayée sous `xvfb-run` le 2026-10-30 (vues, protocoles, plantage, battement de cœur); Chromium 156, Node 24.22.1 | majeure sortie il y a 9 jours |
| Electron 44 (majeure précédente) | quelques semaines de correctifs de plus | maintenance arrêtée plus tôt (sortie d'Electron 47); aucun essai fait |

### TypeScript

| Option | Pour | Contre |
|---|---|---|
| TypeScript 6.0.3 | pris en charge par typescript-eslint 8.72.1 (`typescript >=4.8.4 <6.1.0`, vérifié) | ce n'est plus la dernière majeure |
| TypeScript 7.0.2 | compilateur natif, bien plus rapide | refusé par typescript-eslint: plus de lint typé, donc plus de contrôle de `any`, des promesses flottantes ni des assertions non nulles |

### Validation des données externes à l'exécution

| Option | Pour | Contre |
|---|---|---|
| Valibot 1.5.0 | aucune génération de code (compatible avec la CSP stricte des vues), de l'ordre du kilo-octet par schéma, types TypeScript déduits des schémas; `object()` retire les champs inconnus (vérifié dans ses `.d.ts`), ce qui sert la compatibilité entre versions (ADR 0006) | moins répandu que Zod |
| Zod 4.6.7 | très répandu | sonde `new Function` pour accélérer ses analyses, ce qui produit un rapport de violation sous CSP stricte sauf réglage `jitless`; 90 Ko gzip en API classique (4 Ko en `zod/mini`, API différente) |
| Validateurs écrits à la main | aucune dépendance | longs, sujets aux oublis, types à tenir à jour séparément |

### Node de l'outillage

| Option | Pour | Contre |
|---|---|---|
| Node 22 (LTS, maintenu jusqu'en avril 2027) | préinstallé dans l'environnement cloud; accepté par Vite 8 et Vitest 5 | différent du Node 24 embarqué par Electron 45 |
| Node 24 | même majeure que le Node d'Electron | à installer partout; aucun besoin connu d'une API propre à Node 24 |

## Décision

1. **Electron 45.2.0**, **TypeScript 6.0.3**, **Valibot 1.5.0** pour toute donnée externe (réseau, fichiers, IPC, pont des jeux, manifestes), **Node 22** pour l'outillage et les tests, avec `@types/node` en 22: le code du processus principal n'emploie que des API présentes dans Node 22 et 24, ce que les tests sous Node 22 vérifient d'office.
2. Versions figées (version exacte dans `package.json`, sans `^` ni `~`, et fichier de verrouillage versionné):

| Brique | Version | Licence | Rôle |
|---|---|---|---|
| electron | 45.2.0 | MIT | application |
| electron-vite | 6.0.0 | MIT | construction du principal, des preloads et de l'interface |
| electron-builder | 26.18.0 | MIT | installateurs (ADR 0011) |
| vite | 8.3.5 | MIT | construction des jeux et des paquets web |
| vitest | 5.0.5 | MIT | tests unitaires et d'intégration (Node 22.12 ou plus) |
| playwright et @playwright/test | 1.64.1 | Apache-2.0 | tests de bout en bout, pilote d'Electron |
| typescript | 6.0.3 | Apache-2.0 | |
| eslint et typescript-eslint | 10.14.0 et 8.72.1 | MIT | lint typé |
| prettier | 3.9.10 | MIT | formatage |
| pnpm | 12.16.1 | MIT | gestionnaire de paquets (ADR 0002) |
| valibot | 1.5.0 | MIT | validation |
| ws | 8.22.0 | MIT | WebSocket des processus principaux (ADR 0007) |
| preact et @preact/signals | 11.1.0 et 2.11.4 | MIT | interface du lanceur (ADR 0012) |
| yauzl et yazl | 3.4.0 et 3.3.1 | MIT | lecture et écriture des paquets de jeux (ADR 0010) |
| three | 0.187.0 | MIT | jeux 3D |
| pixi.js | 8.22.0 | MIT | jeux 2D (ADR 0014, différé au premier jeu 2D) |
| @types/node | 22.20.x | MIT | types de Node alignés sur l'outillage |

3. **Politique de montée de version**:
   - Electron: montée vers la dernière stable environ tous les 6 mois, groupée avec une version planifiée de Duo (chaque version de Duo coûte une alerte Gatekeeper sous macOS, ADR 0011), après tests de bout en bout sur Linux, macOS et Windows. Hors calendrier seulement pour une faille qui touche notre usage (contenu local et signé, vues en bac à sable).
   - Autres dépendances: revue trimestrielle par architecte-technique et ingenieur-build, une branche par montée, tests complets. Pas de robot de mise à jour automatique.
   - TypeScript 7: dès que typescript-eslint le prend en charge.
   - Les moteurs de rendu sont figés **par jeu** (catalogues pnpm, ADR 0002): un jeu publié garde la version avec laquelle il a été testé.
4. **Règle d'équipe**: avant d'employer une API, la lire dans la version installée (`node_modules/**/*.d.ts`, documentation officielle au tag de la version; pour Electron, `raw.githubusercontent.com/electron/electron/v45.2.0/docs/`).
5. Toute nouvelle dépendance livrée passe par une revue d'architecte-technique: licence permissive (MIT, BSD, ISC, Apache-2.0), maintenance active, poids mesuré, version figée, entrée dans `CREDITS.md` si elle est embarquée.

## Conséquences

- Deux applications Duo dont les versions d'Electron diffèrent ne peuvent pas jouer ensemble à un jeu en lockstep (ADR 0006); elles jouent ensemble à tous les autres.
- Le lint typé reste disponible; la vitesse du compilateur natif attendra.
- Electron 45 exige macOS 13 et Windows 10 au moins: compatible avec les deux machines (à confirmer par le relevé Q4).
- Les montées d'Electron sont planifiées environ deux fois par an; chaque montée est un petit chantier (tests sur trois systèmes, relecture des notes de rupture, nouvelle version de Duo).

### À vérifier

- Comportement de Valibot sous la CSP des vues: aucun rapport de violation attendu (pas de génération de code), à constater dans le test de fumée du lot L2.
- Node 24 pour l'outillage à la fin de vie de Node 22 (avril 2027).
