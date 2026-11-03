// Les chaînes de production (0.12.2, `docs/jeux/jeu-1/economie-chaines-0-12-2.md`): chaque étape
// rapporte au moins la marge minimale au prix de base d'Odette, pour que les recettes à venir
// respectent la règle. Même contrôle que `docs/jeux/jeu-1/simulations/economie_chaines.py`.
import { describe, expect, it } from 'vitest';
import reglages from '../donnees/reglages.json';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Content, RecipeDef } from '../src/donnees/types';
import type { Quality } from '../src/etat/types';

/** La règle (`reglages.economy.chains`): lue par ce test et par le script, pas par la partie. */
interface ChainRule {
  minMargin: number;
  extraSourceMargin: number;
  minuteValue: number;
  handlingSeconds: number;
  usageCategories: string[];
  paybackDays: { min: number; max: number };
}

function readNumber(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new Error(`reglages.economy.chains.${key}: nombre attendu`);
  return v;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readRule(raw: unknown): ChainRule {
  const economy = isRecord(raw) ? raw.economy : undefined;
  const chains = isRecord(economy) ? economy.chains : undefined;
  if (!isRecord(chains)) throw new Error('reglages.economy.chains manquant');
  const usage = chains.usageCategories;
  const payback = chains.paybackDays;
  if (!Array.isArray(usage) || !usage.every((c): c is string => typeof c === 'string'))
    throw new Error('usageCategories: liste de catégories attendue');
  if (!isRecord(payback)) throw new Error('paybackDays: objet attendu');
  return {
    minMargin: readNumber(chains, 'minMargin'),
    extraSourceMargin: readNumber(chains, 'extraSourceMargin'),
    minuteValue: readNumber(chains, 'minuteValue'),
    handlingSeconds: readNumber(chains, 'handlingSeconds'),
    usageCategories: usage,
    paybackDays: { min: readNumber(payback, 'min'), max: readNumber(payback, 'max') },
  };
}

const content: Content = loadContent(CONTENT_FILES);
const rule = readRule(reglages);

/** Prix de base d'Odette d'une unité (sans saison, offre ni ardoise), `null` si elle ne l'achète pas. */
function odette(item: string, quality: Quality = 'ordinary'): number | null {
  const def = content.items[item];
  if (def === undefined) throw new Error(`objet inconnu ${item}`);
  if (def.sellPrice === null) return null;
  return (
    def.sellPrice *
    content.qualities[quality].priceMultiplier *
    content.settings.economy.grocer.buyRate
  );
}

function bought(item: string): number | null {
  const def = content.items[item];
  if (def === undefined || def.shop === null) return null;
  return def.buyPrice;
}

/** Acheté: son prix d'achat; récolté ou produit: son prix d'Odette; sans prix (rondin): rien que son temps. */
function inputValue(item: string): number {
  return bought(item) ?? odette(item) ?? 0;
}

function animalOf(item: string): string | null {
  return Object.values(content.animals).find((a) => a.produces.item === item)?.id ?? null;
}

/** La filière d'un intrant: un achat, une bête, ou la catégorie de l'objet (culture, cueillette...). */
function sourceOf(item: string): string {
  if (bought(item) !== null) return 'achat';
  const animal = animalOf(item);
  if (animal !== null) return `bête:${animal}`;
  return content.items[item]?.category ?? item;
}

function required(recipe: RecipeDef): { inputs: number; needed: number } {
  const inputs = recipe.inputs.reduce((sum, i) => sum + i.count * inputValue(i.item), 0);
  const sources = new Set(recipe.inputs.map((i) => sourceOf(i.item))).size;
  const margin = rule.minMargin + rule.extraSourceMargin * (sources - 1);
  const minutes =
    (recipe.seconds + rule.handlingSeconds) / content.settings.clock.secondsPerGameMinute;
  return { inputs, needed: inputs * (1 + margin) + rule.minuteValue * minutes };
}

const forSale = Object.values(content.recipes).filter(
  (r) => !rule.usageCategories.includes(content.items[r.output.item]?.category ?? ''),
);

describe('chaînes de production (0.12.2)', () => {
  it('la règle est lue et vraisemblable', () => {
    expect(rule.minMargin).toBeGreaterThanOrEqual(0.25);
    expect(rule.paybackDays.min).toBeLessThan(rule.paybackDays.max);
    expect(forSale.length).toBeGreaterThanOrEqual(10);
  });

  it('tout produit transformé a un prix de vente (sauf les meubles, faits pour la maison)', () => {
    const missing = forSale
      .filter((r) => content.items[r.output.item]?.sellPrice === null)
      .map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it.each(forSale.map((r) => [r.id, r] as const))(
    '%s rapporte au moins la marge minimale au prix de base d’Odette',
    (_id, recipe) => {
      const unit = odette(recipe.output.item) ?? 0;
      const { inputs, needed } = required(recipe);
      const value = unit * recipe.output.count;
      expect(
        value,
        `intrants ${inputs.toFixed(1)}, produit ${value.toFixed(1)}, exigé ${needed.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(needed - 1e-9);
    },
  );

  it('chaque culture couvre sa graine avec la marge minimale', () => {
    for (const crop of Object.values(content.crops)) {
      const seed = inputValue(crop.seed);
      const harvest = crop.yieldPerCell * (odette(crop.harvest) ?? 0);
      expect(harvest, crop.id).toBeGreaterThanOrEqual(seed * (1 + rule.minMargin));
    }
  });

  it('un œuf couvre d’abord son grain, avec la marge minimale', () => {
    const care = content.settings.hens.care;
    if (care === null) throw new Error('reglages.hens.care manquant');
    const ration = (inputValue(care.grain.item) / care.grain.rations) * care.grain.perHen;
    const egg = content.settings.hens.eggsPerHenPerDay * (odette('egg') ?? 0);
    expect(ration).toBeGreaterThan(0);
    expect(egg).toBeGreaterThanOrEqual(ration * (1 + rule.minMargin));
  });

  it('une bête du catalogue, bien soignée, se rembourse en une à deux saisons', () => {
    const care = content.settings.hens.care;
    const goats = content.settings.goats;
    if (care === null || goats === null || content.catalogue === null)
      throw new Error('élevage manquant');
    const ration = (inputValue(care.grain.item) / care.grain.rations) * care.grain.perHen;
    // Poule ravie: un bel œuf par jour (section 4.2); chèvre gaie: deux bidons par jour (section 4.3).
    const henDay = content.settings.hens.eggsPerHenPerDay * (odette('egg', 'fine') ?? 0) - ration;
    const goatDay = 2 * (odette(goats.milkItem) ?? 0);
    const animals: [string, number][] = [
      ...Object.keys(content.catalogue.hens).map((item): [string, number] => [item, henDay]),
      [goats.extraItem, goatDay],
    ];
    for (const [item, perDay] of animals) {
      const price = content.items[item]?.buyPrice ?? 0;
      const days = price / perDay;
      expect(days, item).toBeGreaterThanOrEqual(rule.paybackDays.min);
      expect(days, item).toBeLessThanOrEqual(rule.paybackDays.max);
    }
  });
});
