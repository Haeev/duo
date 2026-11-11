/** Contrôles des logements entre fichiers: objets, meubles et pièces référencés existent, pièces disjointes. */
import type { Content, PlaceContent } from '../../donnees/charger';

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function validateHousings(content: Content): string[] {
  const problems: string[] = [];
  for (const place of Object.values(content.places)) {
    for (const def of Object.values(place.housings)) {
      const at = `lieux/${place.def.id}/logements/${def.id}.json`;
      const ids = new Set<string>();
      for (const room of def.rooms) {
        if (ids.has(room.id)) problems.push(`${at}: pièce « ${room.id} » en double`);
        ids.add(room.id);
      }
      def.rooms.forEach((room, i) => {
        const where = `${at}, pièce ${room.id}`;
        if (room.start !== 'restored' && room.stages.length === 0)
          problems.push(`${where}: une pièce à restaurer demande au moins une étape`);
        if (room.start === 'restored' && room.stages.length > 0)
          problems.push(`${where}: une pièce déjà restaurée n'a pas d'étape`);
        for (const need of room.requires)
          if (!ids.has(need) && !def.rooms.some((r) => r.id === need))
            problems.push(`${where}: pièce requise inconnue « ${need} »`);
        for (const stage of room.stages)
          for (const m of stage.materials)
            if (!(m.item in content.items)) problems.push(`${where}: objet inconnu « ${m.item} »`);
        const a = room.area;
        if (a.x + a.w > place.map.width || a.y + a.h > place.map.height)
          problems.push(`${where}: la pièce sort de la carte`);
        for (const other of def.rooms.slice(i + 1))
          if (other.floor === room.floor && overlap(room.area, other.area))
            problems.push(`${where}: chevauche la pièce « ${other.id} »`);
      });
      for (const [type] of Object.entries(def.stock)) {
        const prop = content.props[type];
        if (prop === undefined) problems.push(`${at}: meuble inconnu « ${type} »`);
        else if (!prop.placeable) problems.push(`${at}: meuble « ${type} » non posable`);
      }
    }
    problems.push(...siteProblems(content, place));
  }
  problems.push(...furnitureItemProblems(content));
  return problems;
}

const hasWorksite = (content: Content, type: string): boolean =>
  content.props[type]?.bricks.some((b) => b.brick === 'worksite') === true;

/** Chantiers: chaque `site` nomme un objet de la carte à brique `worksite`, et un seul par pièce. */
function siteProblems(content: Content, place: PlaceContent): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string>();
  for (const def of Object.values(place.housings)) {
    for (const room of def.rooms) {
      if (room.site === undefined) continue;
      const where = `lieux/${place.def.id}/logements/${def.id}.json, pièce ${room.id}`;
      const object = place.map.objects.find((o) => o.id === room.site);
      if (object === undefined)
        problems.push(`${where}: chantier « ${room.site} » absent de la carte du lieu`);
      else if (!hasWorksite(content, object.type))
        problems.push(
          `${where}: le meuble du chantier « ${room.site} » n'a pas la brique worksite`,
        );
      if (room.stages.length === 0)
        problems.push(`${where}: un chantier (\`site\`) sans étape ne sert à rien`);
      const other = owners.get(room.site);
      if (other !== undefined)
        problems.push(`${where}: le chantier « ${room.site} » sert déjà la pièce « ${other} »`);
      owners.set(room.site, room.id);
    }
  }
  for (const object of place.map.objects)
    if (hasWorksite(content, object.type) && !owners.has(object.id))
      problems.push(
        `lieux/${place.def.id}: le chantier « ${object.id} » n'est nommé par aucune pièce (\`site\`)`,
      );
  return problems;
}

/** Objets meubles: famille `furniture` et fiche posable vont ensemble. */
function furnitureItemProblems(content: Content): string[] {
  const problems: string[] = [];
  for (const item of Object.values(content.items)) {
    const at = `commun/objets/${item.id}.json`;
    if (item.family === 'furniture' && item.prop === undefined)
      problems.push(`${at}: un objet de famille furniture déclare sa fiche de meuble (\`prop\`)`);
    if (item.prop === undefined) continue;
    const prop = content.props[item.prop];
    if (item.family !== 'furniture') problems.push(`${at}: \`prop\` demande la famille furniture`);
    if (prop === undefined) problems.push(`${at}: fiche de meuble inconnue « ${item.prop} »`);
    else if (!prop.placeable) problems.push(`${at}: meuble « ${item.prop} » non posable`);
  }
  return problems;
}
