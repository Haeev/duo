# Temps du monde (météo, saisons, calendrier)

Données: `donnees/commun/temps.json` (calendrier, tranches météo, réglages des insectes et de la photo), `lieux/<lieu>/climat.json` (facultatif), `lieux/<lieu>/evenements/<id>.json`. Schémas: `src/donnees/schemas/temps.ts`.

| Fichier         | Rôle                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendrier.ts` | `calendarOf(content, jour)`: année, saison (14 jours), jour de la saison, jour de la semaine; `inHours`                                                                                                 |
| `meteo.ts`      | météo par lieu, pure (graine, lieu, jour, tranche): `weatherAt`, `morningWeather` (annonce de la veille), `wateredOn` (rattrapage des cultures d'un lieu quitté), `ambienceOf` (rendu, son)             |
| `agenda.ts`     | événements du calendrier: `eventsOn`, `activeEvents`, `eventVillagers`, `eventShops`, `announcedFor`                                                                                                    |
| `index.ts`      | le système: `common.weather` et `common.outlook` à jour, événements `weather_changed`, `rain_watered`, `outlook_ready`, `calendar_started`, `calendar_ended`; faits des événements écrits au nom du duo |

Une seule horloge pour tous les lieux; chaque lieu a son climat (poids des météos par saison, chance de changement dans la journée, ambiance). L'invité n'a pas la graine: il lit `common.weather` (maintenant) et `common.outlook` (demain), le reste se calcule des données.

Conditions des données: `weather_is`, `season_is`, `weekday_is` (`regles/conditions.ts`).

## Brancher

- Rendu et son: `common.weather`, `ambienceOf(content, lieu, jour)`, `calendarOf(content, jour).season`; événement `weather_changed`.
- Interface: `common.outlook` (météo et événements de demain), `outlook_ready` à l'aube; `calendarOf` pour l'horloge.
- Cultures: `rain_watered` (au plus une fois par jour et par reprise: compter un jour arrosé une seule fois), `wateredOn` pour l'absence.
- Habitants et commerces: `eventVillagers(look)` et `eventShops(look)`; scène: `activates.scene` de `activeEvents(look)`.

## Ajouter

Un événement: `pnpm nouveau evenement <id> <lieu>`. Un climat: copier `defaultClimate` de `temps.json` dans `lieux/<lieu>/climat.json`. Aucun changement de code.

## Trains (`trains.ts`, réglages dans `reglages-trains.ts`)

Un événement peut amener un train (champ `train`): il arrive en freinant pour s'arrêter à `hours.from`, reste à quai jusqu'à `hours.to`, puis repart en accélérant, le long d'une voie de la carte (`rails`), courbes comprises. Sa pose ne dépend que de l'heure, du jour et des conditions de l'événement: rien n'est sauvegardé ni transmis, l'hôte et l'invité le voient au même endroit, aussi après un chargement ou une nuit sautée. Tant qu'il est là, son emprise barre la voie (`noyau/obstacles.ts`); un joueur surpris dessus est posé sur la case libre la plus proche (événement `unstuck`, sans dommage). Le rendu: `rendu/lieu/trains.ts`.

Ajouter un train (aucun code):

1. `pnpm nouveau evenement <id> <lieu>`, ou un événement existant: heures d'arrêt (`from`) et de départ (`to`).
2. Décommente le bloc `train` du gabarit (`donnees/_gabarits/evenement.jsonc`); `pourquoi`: d'où il vient et pourquoi il s'arrête là.
3. `consist`: les véhicules de la tête à la queue, par modèle du manifeste des décors, avec leurs tampons (`front`, `back`, mesures du README des récoltables).
4. `track`, `comesFrom`, `leavesTo`: la voie (`rails` de la carte) et ses bouts.
5. `stop`: le point de la carte au droit duquel s'arrête le centre du véhicule `vehicle` (portes face au quai), `shift` pour l'ajuster.
6. `arrival`, `departure`: minutes et mètres du freinage et du démarrage (8 et 100: environ 40 km/h à l'entrée).
7. Vérifie que la rame tient entre les passages à niveau, puis `pnpm exec vitest run tests/trains.test.ts tests/rendu/trains.test.ts` (un train factice y est ajouté par les données).
8. Regarde-le: `pnpm exec vite build`, puis `LPL2_VUES=trains pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts ensemble`.
