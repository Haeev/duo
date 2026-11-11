# Temps du monde (météo, saisons, calendrier)

Données: `donnees/commun/temps.json` (calendrier, tranches météo, réglages des insectes et de la photo), `lieux/<lieu>/climat.json` (facultatif), `lieux/<lieu>/evenements/<id>.json`. Schémas: `src/donnees/schemas/temps.ts`.

| Fichier         | Rôle                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendrier.ts` | `calendarOf(content, jour)`: année, saison (14 jours), jour de la saison, jour de la semaine; `inHours`; `occursOn` (date ou règle d'un événement); `eventDayKey` (fait du début d'un événement)                                                                                   |
| `meteo.ts`      | météo par lieu, pure (graine, lieu, jour, tranche): `weatherAt`, `morningWeather` (annonce de la veille), `wateredOn` (rattrapage des cultures d'un lieu quitté), `ambienceOf` (rendu, son)                                                                                        |
| `agenda.ts`     | événements du calendrier: `eventsOn`, `activeEvents`, `eventShops`, `closedByEvent` (commerces fermés par `closes`), `announcedFor`                                                                                                                                                |
| `index.ts`      | le système: `common.weather` et `common.outlook` à jour, événements `weather_changed`, `rain_watered`, `outlook_ready`, `calendar_started`, `calendar_ended`; faits des événements écrits au nom du duo, jour du début `agenda.<lieu>.<événement>`, décisions rejouables rouvertes |

Une seule horloge pour tous les lieux; chaque lieu a son climat (poids des météos par saison, chance de changement dans la journée, ambiance). L'invité n'a pas la graine: il lit `common.weather` (maintenant) et `common.outlook` (demain), le reste se calcule des données.

Conditions des données: `weather_is`, `season_is`, `weekday_is`, `event_is` (`regles/conditions.ts`).

## Lire un événement dans les données (`event_is`)

`{ "type": "event_is", "events": ["<id>", ...], "when": "begun" }`, l'un des événements du lieu courant:

- `on`: en cours, dans ses heures;
- `begun`: commencé aujourd'hui, jusqu'à l'aube suivante (heures passées comprises: le passage de 5 h 12 après la fête); il tient même si les conditions de l'événement changent dans la soirée (fait `agenda.<lieu>.<événement>` = jour du début, écrit par le système, sauvegardé et transmis);
- `today`: a lieu aujourd'hui (commencé ou à venir);
- `tomorrow`: a lieu demain (ce qu'annonce la veille).

Plannings d'habitants (qui vient à la fête), répliques, déclencheurs de scène (la scène d'ouverture) et suites lisent l'événement ainsi: aucun fait à écrire au début ni à effacer le lendemain. Les conditions d'un événement peuvent citer un autre événement (la veillée s'efface un jour de fête), jamais en boucle: le chargement le refuse. Les faits d'`activates.facts` restent pour un état qui doit durer au-delà de la journée; le contrôle des suites les connaît.

## Fermer les commerces

`"closes": { "shops": "all" }` (ou une liste) dans la fiche: du début de l'événement à l'aube suivante, ni achat ni vente, comptoir et porte compris (`isTrading`, `isShopOpen`). Le commerçant dit sa réplique `lines.closed` de la fiche du commerce à la place de l'offre de boutique, s'il l'a.

## Brancher

- Rendu et son: `common.weather`, `ambienceOf(content, lieu, jour)`, `calendarOf(content, jour).season`; événement `weather_changed`; une fête: `evaluate(..., { type: "event_is", ... })`.
- Interface: `common.outlook` (météo et événements de demain, tranche commune: les deux joueurs l'ont), `outlook_ready` à l'aube; `calendarOf` pour l'horloge.
- Cultures: `rain_watered` (au plus une fois par jour et par reprise: compter un jour arrosé une seule fois), `wateredOn` pour l'absence.
- Commerces: `eventShops(look)`, `closedByEvent(look, commerce)`.

## Ajouter

Un événement: `pnpm nouveau evenement <id> <lieu>`. Un climat: copier `defaultClimate` de `temps.json` dans `lieux/<lieu>/climat.json`. Aucun changement de code. Test court: `tests/agenda-evenements.test.ts`.
