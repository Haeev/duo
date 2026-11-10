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
