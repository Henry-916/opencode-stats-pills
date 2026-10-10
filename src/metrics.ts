import type { SessionMessageInfo, TokenUsageInfo } from '@opencode/client';

export type Reading = { id: string; start: number; first?: number; streamEnd?: number; end?: number; tokens?: TokenUsageInfo; batched?: boolean; toolMs: number };
export type Timing = { decodeMs: number; decodeTokens: number; modelMs: number; toolMs: number; ttftMs: number; ttftSteps: number; unmeasured: number };
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const output = (t: TokenUsageInfo) => t.output + t.reasoning;
export const input = (t: TokenUsageInfo) => t.input + t.cache.read + t.cache.write;
export const total = (t: TokenUsageInfo) => input(t) + output(t);
export function cachePercent(t?: TokenUsageInfo): string {
  if (!t || !finite(t.cache?.read) || !finite(t.cache?.write) || input(t) <= 0) return '—';
  const ratio = t.cache.read / input(t) * 100;
  if (ratio > 99.5 && ratio < 100) return '<100%';
  return `${Math.round(ratio)}%`;
}
export function compact(n?: number): string {
  if (!finite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
export function duration(ms?: number): string {
  return finite(ms) ? `${(ms / 1000).toFixed(1)}s` : '—';
}
export function fold(readings: Iterable<Reading>): Timing {
  const result: Timing = { decodeMs: 0, decodeTokens: 0, modelMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, unmeasured: 0 };
  for (const r of readings) {
    result.toolMs += r.toolMs;
    if (!finite(r.end) || !finite(r.streamEnd)) continue;
    result.modelMs += Math.max(0, r.streamEnd - r.start);
    if (!r.batched && finite(r.first) && r.first >= r.start && r.first <= r.streamEnd) {
      result.ttftMs += r.first - r.start;
      result.ttftSteps++;
      const span = r.streamEnd - r.first;
      // Batched short responses cannot yield a meaningful decode rate.
      // Keep their tokens and time out of the SAME aggregate denominator.
      if (span >= 100 && r.tokens) {
        result.decodeMs += span;
        result.decodeTokens += output(r.tokens);
      } else result.unmeasured++;
    } else result.unmeasured++;
  }
  return result;
}
export function speed(t: Timing): string {
  return t.decodeMs > 0 ? `${(t.decodeTokens / (t.decodeMs / 1000)).toFixed(1)} tok/s` : '— tok/s';
}
export function reading(message: SessionMessageInfo): Reading | undefined {
  if (message.type !== 'assistant') return undefined;
  const toolMs = message.content.reduce((sum, c) => {
    if (c.type !== 'tool') return sum;
    return sum + (finite(c.time.ran) && finite(c.time.completed) ? Math.max(0, c.time.completed - c.time.ran) : 0);
  }, 0);
  const reasoningParts=message.content.filter(c=>c.type==='reasoning');
  const batched=Boolean(message.tokens?.reasoning && reasoningParts.length && reasoningParts.every(c=>finite(c.time?.created)&&finite(c.time?.completed)) && reasoningParts.reduce((ms,c)=>ms+(c.time!.completed!-c.time!.created),0)<100);
  return { batched, id: message.id, start: message.time.created, first: firstContentTime(message), streamEnd: message.time.streamed, end: message.time.completed, tokens: message.tokens, toolMs };
}

// V2 streamed is END of the model stream, not its first token. completed may
// include tools. Persisted reasoning/tool starts can recover first output;
// text has no persisted time and is recovered from durable/live events.
function firstContentTime(message: Extract<SessionMessageInfo, {type:'assistant'}>): number | undefined {
  if(message.content[0]?.type==='text' && message.content[0].text.trim()) return undefined;
  const times=message.content.flatMap(c=>c.type==='reasoning' && finite(c.time?.created)?[c.time.created]:c.type==='tool' && finite(c.time.created)?[c.time.created]:[]);
  return times.length?Math.min(...times):undefined;
}
export function mergeReading(old: Reading | undefined, next: Reading): Reading {
  const times=[old?.first,next.first].filter(finite);
  return {...old,...next,first:times.length?Math.min(...times):undefined,streamEnd:next.streamEnd??old?.streamEnd,end:next.end??old?.end,tokens:next.tokens??old?.tokens};
}
