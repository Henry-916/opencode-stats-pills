import type { ModelInfo, ModelRef, TokenUsageInfo } from '@opencode/client';
import { finite } from './metrics.js';

/** USD per million tokens; buckets are disjoint in OpenCode V2. */
export type Price = { input: number; output: number; cacheRead?: number };
export type Prices = Record<string, Record<string, Price>>;
export type Charge = { model: ModelRef; tokens?: TokenUsageInfo; cost?: number };

export function parsePrices(value: unknown): Prices {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('StatsPills prices must be a provider/model map');
  for (const models of Object.values(value)) {
    if (!models || typeof models !== 'object' || Array.isArray(models)) throw new Error('StatsPills prices must be a provider/model map');
    for (const price of Object.values(models)) {
      if (!price || typeof price !== 'object' || Array.isArray(price)) throw new Error('Invalid StatsPills model price');
      const p = price as Record<string, unknown>;
      if (!finite(p.input) || !finite(p.output) || Object.entries(p).some(([key, rate]) => !['input', 'output', 'cacheRead'].includes(key) || !finite(rate))) {
        throw new Error('StatsPills prices require input/output and non-negative finite rates');
      }
    }
  }
  return value as Prices;
}

export function tokenCost(t: TokenUsageInfo | undefined, p: Price): number | undefined {
  if (!t) return undefined;
  const buckets: [number, number | undefined][] = [[t.input, p.input], [t.output, p.output], [t.reasoning, p.output], [t.cache.read, p.cacheRead], [t.cache.write, p.input]];
  let sum = 0;
  for (const [count, rate] of buckets) {
    if (!finite(count) || (count > 0 && !finite(rate))) return undefined;
    sum += count === 0 ? 0 : count * rate! / 1e6;
  }
  return finite(sum) ? sum : undefined;
}

export function chargeCost(c: Charge, prices: Prices, models: readonly ModelInfo[]): number | undefined {
  const custom = prices[c.model.providerID]?.[c.model.id];
  if (custom) return tokenCost(c.tokens, custom);
  // A positive host charge is usable; zero alone cannot prove a model is free.
  if (finite(c.cost) && c.cost > 0) return c.cost;
  const model = models.find(m => m.providerID === c.model.providerID && m.id === c.model.id);
  const knownFree = model?.cost.length && model.cost.every(p => p.input === 0 && p.output === 0 && p.cache.read === 0 && p.cache.write === 0);
  return knownFree && c.cost === 0 ? 0 : undefined;
}

export function sessionCost(charges: readonly Charge[], prices: Prices, models: readonly ModelInfo[]): number | undefined {
  let sum = 0;
  for (const c of charges) {
    const cost = chargeCost(c, prices, models);
    if (cost === undefined) return undefined;
    sum += cost;
  }
  return finite(sum) ? sum : undefined;
}

export function money(value?: number): string {
  if (!finite(value)) return '$ —';
  if (value > 0 && value < 0.0001) return '$ <0.0001';
  return `$ ${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`;
}

/** Completed requests since the latest user message, within this session. */
export function latestTurnCost(
  messages: readonly { id: string; type: string; time: { created: number } }[],
  charges: ReadonlyMap<string, Charge>, prices: Prices, models: readonly ModelInfo[]
): number | undefined {
  const start = messages.filter(m => m.type === 'user').reduce((latest, m) => Math.max(latest, m.time.created), -Infinity);
  if (!Number.isFinite(start)) return undefined;
  const requests = messages.filter(m => m.type !== 'user' && m.time.created >= start && charges.has(m.id)).map(m => charges.get(m.id)!);
  return requests.length ? sessionCost(requests, prices, models) : undefined;
}
