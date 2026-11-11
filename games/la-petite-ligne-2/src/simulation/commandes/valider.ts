/**
 * Contrôles du guichet de commande, de ses tables et de ses lettres entre fichiers: événement,
 * habitant, rangements, objets connus, lignes uniques dans le lieu, conditions et effets valides.
 */
import type { Content } from '../../donnees/charger';
import type { Condition, Effect } from '../../donnees/schemas/regles';

export interface OrderCheckers {
  condition(content: Content, c: Condition, at: string, problems: string[]): void;
  effect(content: Content, e: Effect, at: string, problems: string[]): void;
}

export function validateOrders(content: Content, check: OrderCheckers): string[] {
  const problems: string[] = [];
  for (const place of Object.values(content.places)) {
    const orders = place.orders;
    if (orders === null) continue;
    const base = `lieux/${place.def.id}`;
    const { desk } = orders;
    const at = `${base}/commande.json`;
    if (!(content.time.events[place.def.id] ?? []).some((e) => e.id === desk.event))
      problems.push(`${at}: événement inconnu du lieu « ${desk.event} »`);
    if (!place.villagers.some((v) => v.id === desk.receiver))
      problems.push(`${at}: habitant inconnu du lieu « ${desk.receiver} »`);
    for (const id of desk.stores) {
      const object = place.map.objects.find((o) => o.id === id);
      const prop = content.props[object?.type ?? ''];
      if (!(prop?.bricks.some((b) => b.brick === 'store') ?? false))
        problems.push(`${at}: « ${id} » n'est pas un rangement (brique store) de la carte`);
    }
    for (const c of desk.when) check.condition(content, c, `${at}, when`, problems);
    if (orders.tables.length === 0) problems.push(`${at}: aucune table dans commandes/`);
    const seen = new Set<string>();
    for (const table of orders.tables) {
      const where = `${base}/commandes/${table.id}.json`;
      for (const line of table.lines) {
        const lineAt = `${where}, ligne ${line.id}`;
        if (seen.has(line.id)) problems.push(`${lineAt}: identifiant déjà pris dans le lieu`);
        seen.add(line.id);
        const item = content.items[line.item];
        if (item === undefined) problems.push(`${lineAt}: objet inconnu « ${line.item} »`);
        else if (item.family === 'tool' || item.family === 'bag')
          problems.push(`${lineAt}: un outil ou un sac ne se commande pas`);
        for (const c of line.when) check.condition(content, c, `${lineAt}, when`, problems);
      }
    }
    for (const letter of Object.values(orders.letters)) {
      const where = `${base}/lettres/${letter.id}.json`;
      for (const c of letter.when) check.condition(content, c, `${where}, when`, problems);
      for (const e of letter.attach) check.effect(content, e, `${where}, attach`, problems);
      if (letter.enclosed !== undefined && letter.attach.length === 0)
        problems.push(
          `${where}: « enclosed » sans « attach »: l'enveloppe annonce ce qu'elle n'a pas`,
        );
    }
  }
  return problems;
}
