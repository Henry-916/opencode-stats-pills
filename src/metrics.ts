import type { SessionMessageInfo, TokenUsageInfo } from '@opencode/client';

// first: earliest output of any kind (TTFT). textFirst/textLead: time and size
// of the first text batch. chars/toolFirst: the visible output behind
// tokens.output and when its first tool call began.
export type Reading = { id: string; start: number; first?: number; textFirst?: number; textLead?: number; chars?: number; toolFirst?: number; streamEnd?: number; end?: number; tokens?: TokenUsageInfo; observed?: boolean; toolMs: number };
export type Timing = { decodeMs: number; decodeTokens: number; modelMs: number; toolMs: number; ttftMs: number; ttftSteps: number; unmeasured: number };
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const output = (t: TokenUsageInfo) => t.output + t.reasoning;
export const input = (t: TokenUsageInfo) => t.input + t.cache.read + t.cache.write;
export const total = (t: TokenUsageInfo) => input(t) + output(t);
export function cachePercent(t?: TokenUsageInfo): string {
  if (!t || !finite(t.cache?.read) || !finite(t.cache?.write) || input(t) <= 0) return '—';
  const prompt = input(t), cached = t.cache.read;
  if (!Number.isSafeInteger(prompt) || !Number.isSafeInteger(cached) || cached > prompt) return '—';
  // Like DSH, increase precision only when rounding would hide a cache miss.
  const denominator = BigInt(prompt), numerator = BigInt(cached) * 100n;
  for (let places = 0, scale = 1n; places <= 16; places++, scale *= 10n) {
    const rounded = (numerator * scale * 2n + denominator) / (denominator * 2n);
    if (cached === prompt || rounded < 100n * scale) {
      const digits = rounded.toString().padStart(places + 1, '0');
      return `${places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits}%`;
    }
  }
  return '—';
}
export function compact(n?: number): string {
  if (!finite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
export function duration(ms?: number): string {
  if (!finite(ms)) return '—';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
export function fold(readings: Iterable<Reading>): Timing {
  const result: Timing = { decodeMs: 0, decodeTokens: 0, modelMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, unmeasured: 0 };
  for (const r of readings) {
    if (finite(r.toolMs)) result.toolMs += r.toolMs;
    if (!finite(r.end)) continue;
    if (!finite(r.start) || !finite(r.streamEnd) || r.streamEnd < r.start || r.end < r.streamEnd) {
      result.unmeasured++;
      continue;
    }
    result.modelMs += r.streamEnd - r.start;
    if (finite(r.first) && r.first >= r.start && r.first <= r.streamEnd) {
      result.ttftMs += r.first - r.start;
      result.ttftSteps++;
    }
    const share = streamedShare(r);
    if (share === undefined) { result.unmeasured++; continue; }
    result.decodeMs += r.streamEnd - r.textFirst!;
    result.decodeTokens += r.tokens!.output * share;
  }
  return result;
}
// Speed pairs tokens with the span they were generated in. Hidden reasoning
// and tool calls that arrive whole are produced before anything is observed,
// so only output streamed after the first text batch is counted, as a share
// of tokens.output by characters. Steps without such a span return undefined.
function streamedShare(r: Reading): number | undefined {
  if (!finite(r.textFirst) || !finite(r.streamEnd) || r.textFirst < r.start || r.textFirst >= r.streamEnd) return undefined;
  if (finite(r.toolFirst) && r.toolFirst < r.textFirst) return undefined;
  if (!r.tokens || !finite(r.tokens.output) || r.tokens.output <= 0 || !finite(r.chars) || r.chars <= 0) return undefined;
  return Math.max(0, 1 - (r.textLead ?? 0) / r.chars);
}
export function speed(t: Timing): string {
  return t.decodeMs > 0 && t.decodeTokens > 0 && finite(t.decodeMs) && finite(t.decodeTokens) ?`${(t.decodeTokens/(t.decodeMs/1000)).toFixed(1)} tok/s`:'— tok/s';
}
export function reading(message: SessionMessageInfo): Reading | undefined {
  if (message.type !== 'assistant') return undefined;
  const toolMs = message.content.reduce((sum, c) => {
    if (c.type !== 'tool') return sum;
    return sum + (finite(c.time.ran) && finite(c.time.completed) ? Math.max(0, c.time.completed - c.time.ran) : 0);
  }, 0);
  return { id: message.id, start: message.time.created, first: firstContentTime(message), ...outputShape(message), streamEnd: message.time.streamed, end: message.time.completed, tokens: message.tokens, toolMs };

}

// Text and tool calls are what tokens.output pays for. A content-free
// placeholder reports nothing, so it cannot erase an earlier measurement.
function outputShape(message: Extract<SessionMessageInfo, {type:'assistant'}>): Pick<Reading, 'chars' | 'toolFirst'> {
  let chars = 0;
  const tools: number[] = [];
  for (const c of message.content) {
    if (c.type === 'text') chars += c.text?.length ?? 0;
    if (c.type !== 'tool') continue;
    const input = c.state?.input;
    chars += (c.name?.length ?? 0) + (typeof input === 'string' ? input : JSON.stringify(input ?? {})).length;
    if (finite(c.time?.created)) tools.push(c.time.created);
  }
  return chars ? {chars, ...(tools.length ? {toolFirst: Math.min(...tools)} : {})} : {};
}

// V2 streamed is END of the model stream, not its first token. completed may
// include tools. Persisted reasoning/tool starts can recover first output;
// text has no persisted time and needs stored, observed payload deltas.
function firstContentTime(message: Extract<SessionMessageInfo, {type:'assistant'}>): number | undefined {
  if(message.content[0]?.type==='text' && message.content[0].text.trim()) return undefined;
  const times=message.content.flatMap(c=>c.type==='reasoning' && c.text?.length && finite(c.time?.created) && finite(c.time?.completed) && c.time.completed>c.time.created?[c.time.created]:c.type==='tool' && c.name?.length && finite(c.time.created)?[c.time.created]:[]);
  return times.length?Math.min(...times):undefined;
}
export function mergeReading(old: Reading | undefined, next: Reading): Reading {
  const observed = [old,next].filter((r): r is Reading => Boolean(r?.observed));
  const times=(observed.length?observed:[old,next]).map(r=>r?.first).filter(finite);
  // Earliest text batch wins; at the same instant the fuller batch is newer.
  const text=[old,next].filter((r): r is Reading => finite(r?.textFirst)).sort((a,b)=>a.textFirst!-b.textFirst! || (b.textLead??0)-(a.textLead??0))[0];
  return {...old,...next,first:times.length?Math.min(...times):undefined,textFirst:text?.textFirst,textLead:text?.textLead,observed:observed.length>0,streamEnd:next.streamEnd??old?.streamEnd,end:next.end??old?.end,tokens:next.tokens??old?.tokens};
}

export type TimingSample = {first:number;text?:number;lead?:number};
// A start notification can describe an empty block; only payload deltas count.
export function observeOutput(r: Reading, delta: string, time: number, text = false): Reading {
  if (!delta.length || !finite(time) || time<r.start || (finite(r.streamEnd) && time>r.streamEnd)) return r;
  const first=r.observed&&finite(r.first)?Math.min(r.first,time):time;
  const next=r.observed&&r.first===first?r:{...r,first,observed:true};
  if (!text || (finite(next.textFirst) && time>next.textFirst)) return next;
  // Deltas sharing the first timestamp arrived as one batch.
  return {...next,textFirst:time,textLead:(time===next.textFirst?next.textLead??0:0)+delta.length};
}
export function timingSample(r: Reading): TimingSample | undefined {
  return r.observed&&finite(r.first)?{first:r.first,...(finite(r.textFirst)?{text:r.textFirst,lead:r.textLead??0}:{})}:undefined;
}
export function restoreTiming(r: Reading, sample: unknown): Reading {
  if (!sample || typeof sample!=='object') return r;
  const s=sample as Partial<TimingSample>;
  const inside=(t: unknown): t is number => finite(t) && t>=r.start && !(finite(r.streamEnd)&&t>r.streamEnd);
  if (!inside(s.first)) return r;
  return mergeReading(r,{...r,first:s.first,observed:true,...(inside(s.text)&&finite(s.lead)?{textFirst:s.text,textLead:s.lead}:{})});
}

// Sum message-level usage, excluding title requests absent from the timeline.
export function sumUsage(usages: Iterable<TokenUsageInfo | undefined>): TokenUsageInfo | undefined {
  const sum: TokenUsageInfo = {input:0,output:0,reasoning:0,cache:{read:0,write:0}};
  for (const t of usages) {
    if (!t || ![t.input,t.output,t.reasoning,t.cache?.read,t.cache?.write].every(finite)) return undefined;
    sum.input+=t.input;sum.output+=t.output;sum.reasoning+=t.reasoning;
    sum.cache.read+=t.cache.read;sum.cache.write+=t.cache.write;
  }
  return sum;
}

/** DSH pressure fallback: request input and the capacity of that request's model. */
export function contextReading(tokens?: TokenUsageInfo, limit?: number) {
  const used = tokens && [tokens.input, tokens.cache?.read, tokens.cache?.write].every(finite) ? input(tokens) : undefined;
  const capacity = finite(limit) && limit > 0 ? limit : undefined;
  const percent = finite(used) && capacity ? Math.min(100, Math.round(used / capacity * 100)) : undefined;
  return {used, limit:capacity, percent};
}
