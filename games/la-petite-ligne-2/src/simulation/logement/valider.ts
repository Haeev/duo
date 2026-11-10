/** Contrôles des logements entre fichiers: objets, meubles et pièces référencés existent, pièces disjointes. */
import type { Content } from '../../donnees/charger';

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
  }
  return problems;
}
