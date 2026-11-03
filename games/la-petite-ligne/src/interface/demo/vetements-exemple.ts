/**
 * Page de démonstration: vêtements d'exemple tant que `vetements.json` (simulation, contrat
 * `garde-robe-0-12.md`, section 2) n'est pas dans le contenu, et tenue des deux personnages s'ils
 * n'en ont pas. Inerte dès que le contenu a ses vêtements et l'état sa garde-robe.
 */
import type { Sim } from '../../simulation/contexte';

type Def = Record<string, unknown>;

const c = (principale: string, secondaire: string, motif?: string): Def =>
  motif === undefined ? { principale, secondaire } : { principale, secondaire, motif };

function def(
  id: string,
  slot: string,
  nom: string,
  prix: number,
  couleurs: Def,
  extra: Def = {},
): Def {
  const style = id.slice(0, id.lastIndexOf('_'));
  return { id, slot, style, nom, modele: `wear_${slot}_${style}`, couleurs, prix, ...extra };
}

export const DEMO_CLOTHES: readonly Def[] = [
  def('tshirt_rouille', 'top', 'T-shirt rouille', 9, c('#B5663F', '#EDE6D3'), { depart: true }),
  def('chemise_ecru', 'top', 'Chemise de lin écru', 18, c('#E6DCC4', '#8A6A43'), { depart: true }),
  def('polo_sauge', 'top', 'Polo sauge', 14, c('#8BA37B', '#F1EBDB'), { depart: true }),
  def('mariniere_marine', 'top', 'Marinière bleu marine', 24, c('#F2EBDD', '#2F3F5C', '#2F3F5C'), {
    depart: true,
  }),
  def('pull_moutarde', 'top', 'Pull moutarde', 32, c('#D4A746', '#F3ECDA')),
  def('debardeur_creme', 'top', 'Débardeur crème', 8, c('#F3ECDA', '#C9B79A')),
  def('veste_bleue', 'outer', 'Veste de travail bleue', 38, c('#3F5F8A', '#28344C')),
  def('gilet_prune', 'outer', 'Gilet tricoté prune', 28, c('#8C4A5E', '#EFE4D6')),
  def('cire_jaune', 'outer', 'Ciré jaune', 42, c('#E8C23A', '#2F3F5C'), { saison: 'autumn' }),
  def('veste_velours', 'outer', 'Veste en velours brune', 55, c('#765130', '#D3A66D')),
  def('pantalon_beige', 'bottom', 'Pantalon de toile beige', 16, c('#C9B79A', '#8A6A43'), {
    depart: true,
  }),
  def('pantalon_marine', 'bottom', 'Pantalon bleu marine', 16, c('#3B4A68', '#28344C'), {
    depart: true,
  }),
  def('short_bleu', 'bottom', 'Short bleu', 12, c('#5C7FA6', '#3E5070'), { depart: true }),
  def('salopette_denim', 'bottom', 'Salopette en denim', 46, c('#4A6A94', '#E8C77A'), {
    couvre: ['top'],
  }),
  def('jupe_rouille', 'bottom', 'Jupe rouille', 22, c('#A45A3A', '#7E3B2A')),
  def('pantacourt_kaki', 'bottom', 'Pantacourt kaki', 18, c('#7D7A4E', '#5C5A38'), {
    saison: 'summer',
  }),
  def('bottines_brunes', 'shoes', 'Bottines brunes', 20, c('#6B4A33', '#3B2A20'), { depart: true }),
  def('baskets_toile', 'shoes', 'Baskets de toile blanches', 14, c('#F2EEE6', '#B33A33'), {
    depart: true,
  }),
  def('sabots_bois', 'shoes', 'Sabots de bois', 12, c('#C99A62', '#8E5B37'), { depart: true }),
  def('bottes_vertes', 'shoes', 'Bottes de pluie vertes', 26, c('#3F6453', '#24392F')),
  def('espadrilles_rayees', 'shoes', 'Espadrilles rayées', 15, c('#E9E3D3', '#B33A33'), {
    saison: 'summer',
  }),
  def('casquette_bleue', 'hat', 'Casquette bleue', 12, c('#2F3F5C', '#B33A33')),
  def('chapeau_paille', 'hat', 'Chapeau de paille', 18, c('#E2C27E', '#7E3B2A'), {
    saison: 'summer',
  }),
  def('bonnet_rouge', 'hat', 'Bonnet rouge', 14, c('#A4463B', '#EFE4D6')),
  def('beret_noir', 'hat', 'Béret noir', 22, c('#2E2622', '#2E2622')),
];

const PERMANENT = DEMO_CLOTHES.filter((d) => d.depart === true).map((d) => String(d.id));
const WEEKLY = [
  'pull_moutarde',
  'veste_bleue',
  'gilet_prune',
  'salopette_denim',
  'jupe_rouille',
  'pantacourt_kaki',
  'bottes_vertes',
  'espadrilles_rayees',
  'casquette_bleue',
  'chapeau_paille',
  'beret_noir',
];

const STARTER: Readonly<Record<string, Def>> = {
  p1: {
    top: 'tshirt_rouille',
    bottom: 'pantalon_beige',
    shoes: 'bottines_brunes',
    outer: null,
    hat: null,
  },
  p2: {
    top: 'mariniere_marine',
    bottom: 'pantalon_marine',
    shoes: 'baskets_toile',
    outer: null,
    hat: null,
  },
};

/** Ajoute les vêtements d'exemple au contenu, s'il n'en a pas. */
export function withDemoClothes<T extends object>(content: T): T {
  if ('clothes' in content) return content;
  return Object.assign(content, { clothes: DEMO_CLOTHES });
}

/** Tenue, garde-robe et stock d'exemple, si l'état n'en a pas (après la création des personnages). */
export function dressDemo(sim: Sim, extra: Readonly<Record<string, readonly string[]>> = {}): void {
  const world: object = sim.world;
  if (!('clothesStock' in world))
    Object.assign(world, { clothesStock: { permanent: PERMANENT, weekly: WEEKLY } });
  for (const ch of sim.world.characters) {
    if (!ch.created) continue;
    const appearance: object = ch.appearance;
    if (!('wear' in appearance)) Object.assign(appearance, { wear: { ...STARTER[ch.id] } });
    const holder: object = ch;
    if (!('wardrobe' in holder)) {
      const start = Object.values(STARTER[ch.id] ?? {}).filter(
        (x): x is string => typeof x === 'string',
      );
      Object.assign(holder, { wardrobe: [...start, ...(extra[ch.id] ?? [])] });
    }
  }
}
