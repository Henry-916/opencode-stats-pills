// src/tui.tsx
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { createEffect, createMemo, createSignal, For, Show, onCleanup, onMount } from "solid-js";

// src/metrics.ts
var finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
var output = (t) => t.output + t.reasoning;
var input = (t) => t.input + t.cache.read + t.cache.write;
var total = (t) => input(t) + output(t);
function cachePercent(t) {
  if (!t || !finite(t.cache?.read) || !finite(t.cache?.write) || input(t) <= 0) return "\u2014";
  const prompt = input(t), cached = t.cache.read;
  if (!Number.isSafeInteger(prompt) || !Number.isSafeInteger(cached) || cached > prompt) return "\u2014";
  const denominator = BigInt(prompt), numerator = BigInt(cached) * 100n;
  for (let places = 0, scale = 1n; places <= 16; places++, scale *= 10n) {
    const rounded = (numerator * scale * 2n + denominator) / (denominator * 2n);
    if (cached === prompt || rounded < 100n * scale) {
      const digits = rounded.toString().padStart(places + 1, "0");
      return `${places ? digits.slice(0, -places) + "." + digits.slice(-places) : digits}%`;
    }
  }
  return "\u2014";
}
function compact(n) {
  if (!finite(n)) return "\u2014";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
function duration(ms) {
  if (!finite(ms)) return "\u2014";
  if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
  const seconds = Math.round(ms / 1e3);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function fold(readings) {
  const result = { decodeMs: 0, decodeTokens: 0, modelMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, unmeasured: 0 };
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
      if (r.tokens && finite(r.tokens.output) && finite(r.tokens.reasoning) && finite(output(r.tokens))) {
        result.decodeMs += r.streamEnd - r.first;
        result.decodeTokens += output(r.tokens);
      } else result.unmeasured++;
    } else result.unmeasured++;
  }
  return result;
}
function speed(t) {
  return t.decodeMs > 0 && t.decodeTokens > 0 && finite(t.decodeMs) && finite(t.decodeTokens) ? `${(t.decodeTokens / (t.decodeMs / 1e3)).toFixed(1)} tok/s` : "\u2014 tok/s";
}
function reading(message) {
  if (message.type !== "assistant") return void 0;
  const toolMs = message.content.reduce((sum, c) => {
    if (c.type !== "tool") return sum;
    return sum + (finite(c.time.ran) && finite(c.time.completed) ? Math.max(0, c.time.completed - c.time.ran) : 0);
  }, 0);
  return { id: message.id, start: message.time.created, first: firstContentTime(message), streamEnd: message.time.streamed, end: message.time.completed, tokens: message.tokens, toolMs };
}
function firstContentTime(message) {
  if (message.content[0]?.type === "text" && message.content[0].text.trim()) return void 0;
  const times = message.content.flatMap((c) => c.type === "reasoning" && c.text?.length && finite(c.time?.created) && finite(c.time?.completed) && c.time.completed > c.time.created ? [c.time.created] : c.type === "tool" && c.name?.length && finite(c.time.created) ? [c.time.created] : []);
  return times.length ? Math.min(...times) : void 0;
}
function mergeReading(old, next) {
  const observed = [old, next].filter((r) => Boolean(r?.observed));
  const times = (observed.length ? observed : [old, next]).map((r) => r?.first).filter(finite);
  return { ...old, ...next, first: times.length ? Math.min(...times) : void 0, observed: observed.length > 0, streamEnd: next.streamEnd ?? old?.streamEnd, end: next.end ?? old?.end, tokens: next.tokens ?? old?.tokens };
}
function observeOutput(r, delta, time) {
  if (!delta.length || !finite(time) || time < r.start || finite(r.streamEnd) && time > r.streamEnd) return r;
  const first = r.observed && finite(r.first) ? Math.min(r.first, time) : time;
  return r.observed && r.first === first ? r : { ...r, first, observed: true };
}
function timingSample(r) {
  return r.observed && finite(r.first) ? { first: r.first } : void 0;
}
function restoreTiming(r, sample) {
  if (!sample || typeof sample !== "object") return r;
  const s = sample;
  if (!finite(s.first) || s.first < r.start || finite(r.streamEnd) && s.first > r.streamEnd) return r;
  return mergeReading(r, { ...r, first: s.first, observed: true });
}
function sumUsage(usages) {
  const sum = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
  for (const t of usages) {
    if (!t || ![t.input, t.output, t.reasoning, t.cache?.read, t.cache?.write].every(finite)) return void 0;
    sum.input += t.input;
    sum.output += t.output;
    sum.reasoning += t.reasoning;
    sum.cache.read += t.cache.read;
    sum.cache.write += t.cache.write;
  }
  return sum;
}
function contextReading(tokens, limit) {
  const used = tokens && [tokens.input, tokens.cache?.read, tokens.cache?.write].every(finite) ? input(tokens) : void 0;
  const capacity = finite(limit) && limit > 0 ? limit : void 0;
  const percent = finite(used) && capacity ? Math.min(100, Math.round(used / capacity * 100)) : void 0;
  return { used, limit: capacity, percent };
}

// src/cost.ts
function parsePrices(value) {
  if (value === void 0) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("StatsPills prices must be a provider/model map");
  for (const models of Object.values(value)) {
    if (!models || typeof models !== "object" || Array.isArray(models)) throw new Error("StatsPills prices must be a provider/model map");
    for (const price of Object.values(models)) {
      if (!price || typeof price !== "object" || Array.isArray(price)) throw new Error("Invalid StatsPills model price");
      const p = price;
      if (!finite(p.input) || !finite(p.output) || Object.entries(p).some(([key, rate]) => !["input", "output", "cacheRead"].includes(key) || !finite(rate))) {
        throw new Error("StatsPills prices require input/output and non-negative finite rates");
      }
    }
  }
  return value;
}
function tokenCost(t, p) {
  if (!t) return void 0;
  const buckets = [[t.input, p.input], [t.output, p.output], [t.reasoning, p.output], [t.cache.read, p.cacheRead], [t.cache.write, p.input]];
  let sum = 0;
  for (const [count, rate] of buckets) {
    if (!finite(count) || count > 0 && !finite(rate)) return void 0;
    sum += count === 0 ? 0 : count * rate / 1e6;
  }
  return finite(sum) ? sum : void 0;
}
function chargeCost(c, prices, models) {
  const custom = prices[c.model.providerID]?.[c.model.id];
  if (custom) return tokenCost(c.tokens, custom);
  if (finite(c.cost) && c.cost > 0) return c.cost;
  const model = models.find((m) => m.providerID === c.model.providerID && m.modelID === c.model.id);
  const knownFree = model?.cost.length && model.cost.every((p) => p.input === 0 && p.output === 0 && p.cache.read === 0 && p.cache.write === 0);
  return knownFree && c.cost === 0 ? 0 : void 0;
}
function sessionCost(charges, prices, models) {
  let sum = 0;
  for (const c of charges) {
    const cost = chargeCost(c, prices, models);
    if (cost === void 0) return void 0;
    sum += cost;
  }
  return finite(sum) ? sum : void 0;
}
function money(value) {
  if (!finite(value)) return "$ \u2014";
  if (value > 0 && value < 1e-4) return "$ <0.0001";
  return `$ ${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`;
}
function latestTurnCost(messages, charges, prices, models) {
  const start = messages.filter((m) => m.type === "user").reduce((latest, m) => Math.max(latest, m.time.created), -Infinity);
  if (!Number.isFinite(start)) return void 0;
  const requests = messages.filter((m) => m.type !== "user" && m.time.created >= start && charges.has(m.id)).map((m) => charges.get(m.id));
  return requests.length ? sessionCost(requests, prices, models) : void 0;
}

// src/icons.ts
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { win32 } from "node:path";
var iconFamily = "StatsPills Icons Large v1.7";
var customIcons = { time: "\uE900\uE904", usage: "\uE901", context: "\uE902", cost: "\uE903" };
var plainIcons = { time: ">", usage: "#", context: "%", cost: "$" };
function parseIconMode(value) {
  if (value === void 0 || value === "auto") return "auto";
  if (value === "plain" || value === "custom") return value;
  throw new Error("StatsPills icons must be auto, plain or custom");
}
function installedWindowsFont(exists = existsSync, env = process.env) {
  const local = env.LOCALAPPDATA ?? win32.join(env.USERPROFILE ?? homedir(), "AppData", "Local");
  const paths = [
    win32.join(local, "Microsoft", "Windows", "Fonts", "StatsPillsIcons-1.7.ttf"),
    win32.join(env.WINDIR ?? "C:\\Windows", "Fonts", "StatsPillsIcons-1.7.ttf")
  ];
  return paths.some((path) => {
    try {
      return exists(path);
    } catch {
      return false;
    }
  });
}
function initialIcons(mode = "auto") {
  if (mode === "plain") return plainIcons;
  if (mode === "custom") return customIcons;
  return process.platform === "win32" && installedWindowsFont() ? customIcons : plainIcons;
}
var probe = {
  run: (command, args) => new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: "utf8", windowsHide: true, timeout: 3e3, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout)
    );
  }),
  exists: async (path) => {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
};
async function detectIconFont(platform = process.platform, io = probe) {
  if (platform === "win32") {
    for (const hive of ["HKCU", "HKLM"]) {
      try {
        const output2 = await io.run("reg.exe", ["query", `${hive}\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts`, "/v", `${iconFamily} (TrueType)`]);
        const value = output2.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/)?.[1]?.trim();
        if (!value) continue;
        const expanded = value.replace(/%([^%]+)%/g, (match, name) => process.env[name] ?? match);
        const path = win32.isAbsolute(expanded) ? expanded : win32.join(process.env.WINDIR ?? "C:\\Windows", "Fonts", expanded);
        if (await io.exists(path)) return true;
      } catch {
      }
    }
    return false;
  }
  if (platform === "linux" || platform === "darwin") {
    try {
      const output2 = await io.run("fc-list", ["--format", "%{family}\n"]);
      return output2.split(/[\r\n,]/).some((family) => family.trim() === iconFamily);
    } catch {
      return false;
    }
  }
  return false;
}
var detected;
function hasIconFont() {
  return detected ??= process.platform === "win32" && installedWindowsFont() ? Promise.resolve(true) : detectIconFont();
}

// src/layout.ts
import { Gutter, Unit, Wrap } from "@opentui/core/yoga";
function wrapFooter(parent) {
  const node = parent.getLayoutNode();
  const previousWrap = node.getFlexWrap();
  const previousGap = { ...node.getGap(Gutter.Row) };
  node.setFlexWrap(Wrap.Wrap);
  node.setGap(Gutter.Row, 0);
  parent.requestRender();
  let restored = false;
  return () => {
    if (restored || parent.isDestroyed) return;
    restored = true;
    if (node.getFlexWrap() === Wrap.Wrap) node.setFlexWrap(previousWrap);
    const gap = node.getGap(Gutter.Row);
    if (gap.unit === Unit.Point && gap.value === 0) node.setGap(Gutter.Row, previousGap);
    parent.requestRender();
  };
}

// src/tui.tsx
var tui_default = Plugin.define({
  id: "opencode-stats-pills",
  setup(ctx) {
    const iconMode = parseIconMode(ctx.options.icons);
    const [icons, setIcons] = createSignal(initialIcons(iconMode));
    if (iconMode === "auto") void hasIconFont().then((found) => {
      if (found && !disposed) setIcons(customIcons);
    });
    const [revision, setRevision] = createSignal(0);
    const [popup, setPopup] = createSignal();
    const prices = parsePrices(ctx.options.prices);
    const charges = /* @__PURE__ */ new Map();
    const timelines = /* @__PURE__ */ new Map();
    const [timingCache, writeTimingCache] = ctx.storage.store("timing-v1", {
      initial: {
        sessions: {}
      }
    });
    const histories = /* @__PURE__ */ new Map();
    const latest = /* @__PURE__ */ new Map();
    const loading = /* @__PURE__ */ new Set();
    const completedHydration = /* @__PURE__ */ new Set();
    const errors = /* @__PURE__ */ new Set();
    const usageHydrated = /* @__PURE__ */ new Set();
    let disposed = false;
    let previousFocus;
    const changed = () => setRevision((n) => n + 1);
    const history = (id) => {
      if (!histories.has(id)) histories.set(id, /* @__PURE__ */ new Map());
      return histories.get(id);
    };
    const close = () => {
      setPopup(void 0);
      if (previousFocus && !previousFocus.isDestroyed) previousFocus.focus();
      previousFocus = void 0;
    };
    const muted = () => ctx.theme.text.muted;
    const normal = () => ctx.theme.text.base;
    const hoverBg = () => ctx.themeMode === "dark" ? "#292929" : "#e4e4e4";
    const panelBg = () => ctx.themeMode === "dark" ? "#303030" : "#f4f4f4";
    function ingest(id, message) {
      if (!timelines.has(id)) timelines.set(id, /* @__PURE__ */ new Map());
      timelines.get(id).set(message.id, {
        id: message.id,
        type: message.type,
        time: {
          created: message.time.created
        }
      });
      if (message.type === "compaction" && message.status !== "running") {
        if (message.tokens || message.cost !== void 0) {
          if (!charges.has(id)) charges.set(id, /* @__PURE__ */ new Map());
          charges.get(id).set(message.id, {
            model: ("model" in message ? message.model : void 0) ?? {
              providerID: "",
              id: ""
            },
            tokens: message.tokens,
            cost: message.cost
          });
        }
        return;
      }
      if (message.type !== "assistant") return;
      if (finite(message.time.completed)) {
        if (!charges.has(id)) charges.set(id, /* @__PURE__ */ new Map());
        const old2 = charges.get(id).get(message.id);
        charges.get(id).set(message.id, {
          model: message.model,
          tokens: message.tokens ?? old2?.tokens,
          cost: message.cost ?? old2?.cost
        });
      }
      const r = reading(message);
      const old = history(id).get(message.id);
      history(id).set(message.id, restoreTiming(mergeReading(old, r), timingCache.sessions[id]?.[message.id]));
      if (finite(message.time.completed) && message.tokens && message.time.created >= (latest.get(id)?.time.created ?? -1)) latest.set(id, message);
    }
    async function hydrate(id) {
      if (loading.has(id) || completedHydration.has(id)) return;
      loading.add(id);
      try {
        let cursor;
        const seen = /* @__PURE__ */ new Set();
        do {
          const page = await ctx.client.message.list({
            sessionID: id,
            limit: 100,
            ...cursor ? {
              cursor
            } : {
              order: "asc"
            }
          });
          if (disposed) return;
          for (const message of page.data) ingest(id, message);
          cursor = page.cursor.next ?? void 0;
          if (cursor && seen.has(cursor)) throw new Error("Repeated history cursor");
          if (cursor) seen.add(cursor);
        } while (cursor);
        usageHydrated.add(id);
        completedHydration.add(id);
        errors.delete(id);
      } catch {
        errors.add(id);
      } finally {
        loading.delete(id);
        if (!disposed) changed();
      }
    }
    function recordOutput(id, messageID, delta, time) {
      const r = history(id).get(messageID);
      if (!r) return;
      const next = observeOutput(r, delta, time);
      if (next === r) return;
      history(id).set(messageID, next);
      const sample = timingSample(next);
      const saved = timingCache.sessions[id]?.[messageID];
      if (saved?.first === sample.first) return;
      void writeTimingCache((draft) => {
        const entries = draft.sessions[id] ?? (draft.sessions[id] = {});
        const old = entries[messageID];
        entries[messageID] = {
          first: Math.min(old?.first ?? sample.first, sample.first)
        };
      }).catch(() => {
      });
    }
    const disposers = [];
    disposers.push(ctx.data.listen(({
      details: event
    }) => {
      if (!("sessionID" in event.data) || typeof event.data.sessionID !== "string") return;
      const id = event.data.sessionID;
      switch (event.type) {
        case "session.step.started": {
          history(id).set(event.data.assistantMessageID, {
            id: event.data.assistantMessageID,
            start: event.data.started,
            toolMs: 0
          });
          break;
        }
        case "session.tool.input.started": {
          recordOutput(id, event.data.assistantMessageID, event.data.name, event.created);
          break;
        }
        case "session.text.delta":
        case "session.reasoning.delta":
        case "session.tool.input.delta": {
          recordOutput(id, event.data.assistantMessageID, event.data.delta, event.created);
          break;
        }
        case "session.step.streamed": {
          const r = history(id).get(event.data.assistantMessageID);
          if (r) r.streamEnd = event.created;
          break;
        }
        case "session.step.ended": {
          const r = history(id).get(event.data.assistantMessageID);
          if (r) {
            r.end = event.created;
            r.tokens = event.data.tokens;
          }
          const m = ctx.data.session.message.get(id, event.data.assistantMessageID);
          if (m?.type === "assistant") ingest(id, {
            ...m,
            time: {
              ...m.time,
              completed: event.created
            },
            tokens: event.data.tokens,
            cost: event.data.cost
          });
          else if (r) ingest(id, {
            id: r.id,
            type: "assistant",
            time: {
              created: r.start,
              streamed: r.streamEnd,
              completed: r.end
            },
            tokens: r.tokens,
            model: ctx.data.session.get(id)?.model ?? {
              providerID: "",
              id: ""
            },
            agent: "",
            content: [],
            cost: event.data.cost
          });
          break;
        }
        case "session.idle": {
          for (const m of ctx.data.session.message.list(id)) ingest(id, m);
          break;
        }
        case "session.revert.committed":
        case "session.compaction.ended": {
          completedHydration.delete(id);
          history(id).clear();
          charges.delete(id);
          timelines.delete(id);
          latest.delete(id);
          usageHydrated.delete(id);
          void hydrate(id);
          break;
        }
        case "session.deleted":
          void writeTimingCache((draft) => {
            delete draft.sessions[id];
          }).catch(() => {
          });
          histories.delete(id);
          charges.delete(id);
          timelines.delete(id);
          latest.delete(id);
          usageHydrated.delete(id);
          completedHydration.delete(id);
          if (popup()?.sessionID === id) close();
          break;
        default:
          return;
      }
      changed();
    }));
    function snapshot(id) {
      revision();
      const session = ctx.data.session.get(id);
      const messages = ctx.data.session.message.list(id);
      for (const m of messages) ingest(id, m);
      const entries = [...charges.get(id)?.values() ?? []];
      const t = usageHydrated.has(id) ? sumUsage(entries.map((c) => c.tokens)) : void 0;
      const last = latest.get(id);
      const selected = last?.model ?? session?.model;
      const selectedID = selected && ("modelID" in selected ? selected.modelID : selected.id);
      const models = ctx.data.location.model.list(session?.location ?? ctx.location) ?? [];
      const model = models.find((m) => m.providerID === selected?.providerID && m.modelID === selectedID);
      const {
        used,
        limit,
        percent
      } = contextReading(last?.tokens, model?.limit.context);
      const cost = usageHydrated.has(id) ? sessionCost(entries, prices, models) : void 0;
      const lastCost = usageHydrated.has(id) ? latestTurnCost([...timelines.get(id)?.values() ?? []], charges.get(id) ?? /* @__PURE__ */ new Map(), prices, models) : void 0;
      return {
        cost,
        lastCost,
        timing: fold(history(id).values()),
        tokens: t,
        used,
        limit,
        percent,
        modelName: model?.name,
        historyError: errors.has(id),
        loading: loading.has(id)
      };
    }
    function rows(id, kind) {
      const s = snapshot(id), t = s.tokens;
      if (kind === "time") return [["\u6A21\u578B\u7528\u65F6", duration(s.timing.modelMs)], ["\u9996 token \u5E73\u5747\uFF08TTFT\uFF09", duration(s.timing.ttftSteps ? s.timing.ttftMs / s.timing.ttftSteps : void 0)], ["\u8F93\u51FA\u901F\u5EA6\uFF08TPS\uFF09", speed(s.timing)]];
      if (kind === "cost") return [["\u5F53\u524D\u4F1A\u8BDD", money(s.cost)], ["\u6700\u8FD1\u4E00\u8F6E\u5BF9\u8BDD", money(s.lastCost)]];
      if (kind === "usage") return [["\u7F13\u5B58\u547D\u4E2D", cachePercent(t)], ["\u672A\u7F13\u5B58\u8F93\u5165", t ? `${t.input.toLocaleString("en-US")} tok` : "\u2014"], ["\u7F13\u5B58\u8BFB\u53D6", t ? `${t.cache.read.toLocaleString("en-US")} tok` : "\u2014"], ...t?.cache.write ? [["\u7F13\u5B58\u5199\u5165", `${t.cache.write.toLocaleString("en-US")} tok`]] : [], ["\u8F93\u51FA", t ? `${t.output.toLocaleString("en-US")} tok` : "\u2014"], ...t?.reasoning ? [["\u601D\u8003", `${t.reasoning.toLocaleString("en-US")} tok`]] : []];
      return [];
    }
    function open(id, kind, anchor) {
      if (popup()?.sessionID === id && popup()?.kind === kind) {
        close();
        return;
      }
      previousFocus ??= ctx.renderer.currentFocusedRenderable;
      setPopup({
        sessionID: id,
        kind,
        x: anchor?.x ?? Math.floor(ctx.renderer.width / 2),
        y: anchor?.y ?? ctx.renderer.height - 3
      });
    }
    function Pill(props) {
      const [hover, setHover] = createSignal(false);
      let anchor;
      const active = () => popup()?.sessionID === props.sessionID && popup()?.kind === props.kind;
      return (() => {
        var _el$ = _$createElement("box"), _el$2 = _$createElement("text");
        _$insertNode(_el$, _el$2);
        var _ref$ = anchor;
        typeof _ref$ === "function" ? _$use(_ref$, _el$) : anchor = _el$;
        _$setProp(_el$, "flexShrink", 0);
        _$setProp(_el$, "onMouseOver", () => setHover(true));
        _$setProp(_el$, "onMouseOut", () => setHover(false));
        _$setProp(_el$, "onMouseDown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          open(props.sessionID, props.kind, anchor);
        });
        _$insert(_el$2, () => ` ${props.label()} `);
        _$effect((_p$) => {
          var _v$ = hover() || active() ? hoverBg() : void 0, _v$2 = hover() || active() ? normal() : muted();
          _v$ !== _p$.e && (_p$.e = _$setProp(_el$, "backgroundColor", _v$, _p$.e));
          _v$2 !== _p$.t && (_p$.t = _$setProp(_el$2, "fg", _v$2, _p$.t));
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$;
      })();
    }
    function StatsPills(props) {
      const s = createMemo(() => props.sessionID ? snapshot(props.sessionID) : void 0);
      createEffect(() => {
        const id = props.sessionID;
        if (id) void hydrate(id);
        if (popup() && popup()?.sessionID !== id) close();
      });
      let root;
      let restoreFooter;
      onMount(() => {
        const dockParent = root?.parent;
        if (dockParent && !props.sessionDock) restoreFooter = wrapFooter(dockParent);
      });
      onCleanup(() => restoreFooter?.());
      return _$createComponent(Show, {
        get when() {
          return props.sessionID;
        },
        get children() {
          var _el$3 = _$createElement("box");
          var _ref$2 = root;
          typeof _ref$2 === "function" ? _$use(_ref$2, _el$3) : root = _el$3;
          _$setProp(_el$3, "width", "100%");
          _$setProp(_el$3, "flexDirection", "row");
          _$setProp(_el$3, "justifyContent", "center");
          _$setProp(_el$3, "columnGap", 1);
          _$setProp(_el$3, "flexWrap", "wrap");
          _$setProp(_el$3, "minHeight", 1);
          _$setProp(_el$3, "flexShrink", 0);
          _$insert(_el$3, _$createComponent(Pill, {
            get sessionID() {
              return props.sessionID;
            },
            kind: "time",
            label: () => `${icons().time} ${s() ? speed(s().timing) : "\u2014 tok/s"}`
          }), null);
          _$insert(_el$3, _$createComponent(Pill, {
            get sessionID() {
              return props.sessionID;
            },
            kind: "usage",
            label: () => `${icons().usage} ${s()?.tokens ? compact(total(s().tokens)) : "\u2014"} tok \xB7 \u7F13\u5B58\u547D\u4E2D ${cachePercent(s()?.tokens)}`
          }), null);
          _$insert(_el$3, _$createComponent(Pill, {
            get sessionID() {
              return props.sessionID;
            },
            kind: "cost",
            label: () => `${icons().cost} ${money(s()?.cost).replace(/^\$ /, "")}`
          }), null);
          _$insert(_el$3, _$createComponent(Pill, {
            get sessionID() {
              return props.sessionID;
            },
            kind: "context",
            label: () => `${icons().context} ${s()?.percent == null ? "\u2014" : `${s().percent}%`}`
          }), null);
          _$effect((_$p) => _$setProp(_el$3, "marginBottom", props.sessionDock ? 1 : 0, _$p));
          return _el$3;
        }
      });
    }
    function Details() {
      const p = () => popup();
      const s = createMemo(() => snapshot(p().sessionID));
      const content = createMemo(() => rows(p().sessionID, p().kind));
      const width = () => Math.max(12, Math.min(44, ctx.renderer.width - 2));
      const height = () => Math.min(p().kind === "context" ? 4 : content().length + 4, ctx.renderer.height - 2);
      const heading = () => p().kind === "time" ? `${icons().time} \u4F1A\u8BDD\u7EDF\u8BA1` : p().kind === "usage" ? `${icons().usage} Token \u7528\u91CF` : p().kind === "cost" ? `${icons().cost} \u8D39\u7528` : `\u4E0A\u4E0B\u6587\u5DF2\u7528 ${s().percent == null ? "\u2014" : `${s().percent}%`}`;
      const summary = () => p().kind === "usage" ? s().tokens ? total(s().tokens).toLocaleString("en-US") + " tok" : "\u2014" : p().kind === "context" ? `~${compact(s().used)} / ${compact(s().limit)}` : "";
      const filled = () => Math.round((s().percent ?? 0) / 100 * Math.max(0, width() - 4));
      let panel;
      onMount(() => {
        if (panel) {
          panel.focusable = true;
          panel.focus();
        }
      });
      return (() => {
        var _el$4 = _$createElement("box"), _el$5 = _$createElement("box"), _el$6 = _$createElement("box"), _el$7 = _$createElement("text"), _el$8 = _$createElement("text");
        _$insertNode(_el$4, _el$5);
        _$setProp(_el$4, "position", "absolute");
        _$setProp(_el$4, "left", 0);
        _$setProp(_el$4, "top", 0);
        _$setProp(_el$4, "width", "100%");
        _$setProp(_el$4, "height", "100%");
        _$setProp(_el$4, "zIndex", 1e3);
        _$setProp(_el$4, "onMouseDown", (e) => {
          if (e.button === 0) {
            e.stopPropagation();
            close();
          }
        });
        _$insertNode(_el$5, _el$6);
        var _ref$3 = panel;
        typeof _ref$3 === "function" ? _$use(_ref$3, _el$5) : panel = _el$5;
        _$setProp(_el$5, "position", "absolute");
        _$setProp(_el$5, "paddingX", 2);
        _$setProp(_el$5, "paddingY", 1);
        _$setProp(_el$5, "flexDirection", "column");
        _$setProp(_el$5, "onMouseDown", (e) => e.stopPropagation());
        _$insertNode(_el$6, _el$7);
        _$insertNode(_el$6, _el$8);
        _$setProp(_el$6, "height", 1);
        _$setProp(_el$6, "flexShrink", 0);
        _$setProp(_el$6, "flexDirection", "row");
        _$setProp(_el$6, "justifyContent", "space-between");
        _$insert(_el$7, heading);
        _$insert(_el$8, summary);
        _$insert(_el$5, _$createComponent(Show, {
          get when() {
            return p().kind !== "context";
          },
          get children() {
            var _el$9 = _$createElement("text");
            _$setProp(_el$9, "height", 1);
            _$setProp(_el$9, "flexShrink", 0);
            _$insert(_el$9, () => "\u2500".repeat(Math.max(0, width() - 4)));
            _$effect((_$p) => _$setProp(_el$9, "fg", ctx.themeMode === "dark" ? "#454545" : "#cccccc", _$p));
            return _el$9;
          }
        }), null);
        _$insert(_el$5, _$createComponent(Show, {
          get when() {
            return p().kind === "context";
          },
          get fallback() {
            return (() => {
              var _el$11 = _$createElement("scrollbox");
              _$setProp(_el$11, "flexGrow", 1);
              _$setProp(_el$11, "scrollbarOptions", {
                visible: false
              });
              _$insert(_el$11, _$createComponent(For, {
                get each() {
                  return content();
                },
                children: (row) => (() => {
                  var _el$12 = _$createElement("box"), _el$13 = _$createElement("text"), _el$14 = _$createElement("text");
                  _$insertNode(_el$12, _el$13);
                  _$insertNode(_el$12, _el$14);
                  _$setProp(_el$12, "flexDirection", "row");
                  _$setProp(_el$12, "justifyContent", "space-between");
                  _$insert(_el$13, () => row[0]);
                  _$insert(_el$14, () => row[1]);
                  _$effect((_p$) => {
                    var _v$10 = muted(), _v$11 = normal();
                    _v$10 !== _p$.e && (_p$.e = _$setProp(_el$13, "fg", _v$10, _p$.e));
                    _v$11 !== _p$.t && (_p$.t = _$setProp(_el$14, "fg", _v$11, _p$.t));
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$12;
                })()
              }));
              return _el$11;
            })();
          },
          get children() {
            var _el$0 = _$createElement("box"), _el$1 = _$createElement("text"), _el$10 = _$createElement("text");
            _$insertNode(_el$0, _el$1);
            _$insertNode(_el$0, _el$10);
            _$setProp(_el$0, "height", 1);
            _$setProp(_el$0, "flexShrink", 0);
            _$setProp(_el$0, "flexDirection", "row");
            _$insert(_el$1, () => "\u2501".repeat(filled()));
            _$insert(_el$10, () => "\u2501".repeat(Math.max(0, width() - 4 - filled())));
            _$effect((_p$) => {
              var _v$3 = normal(), _v$4 = ctx.themeMode === "dark" ? "#454545" : "#cccccc";
              _v$3 !== _p$.e && (_p$.e = _$setProp(_el$1, "fg", _v$3, _p$.e));
              _v$4 !== _p$.t && (_p$.t = _$setProp(_el$10, "fg", _v$4, _p$.t));
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$0;
          }
        }), null);
        _$effect((_p$) => {
          var _v$5 = Math.max(0, Math.min(p().x, ctx.renderer.width - width())), _v$6 = Math.max(0, p().y - height() - 1), _v$7 = width(), _v$8 = height(), _v$9 = panelBg(), _v$0 = normal(), _v$1 = normal();
          _v$5 !== _p$.e && (_p$.e = _$setProp(_el$5, "left", _v$5, _p$.e));
          _v$6 !== _p$.t && (_p$.t = _$setProp(_el$5, "top", _v$6, _p$.t));
          _v$7 !== _p$.a && (_p$.a = _$setProp(_el$5, "width", _v$7, _p$.a));
          _v$8 !== _p$.o && (_p$.o = _$setProp(_el$5, "height", _v$8, _p$.o));
          _v$9 !== _p$.i && (_p$.i = _$setProp(_el$5, "backgroundColor", _v$9, _p$.i));
          _v$0 !== _p$.n && (_p$.n = _$setProp(_el$7, "fg", _v$0, _p$.n));
          _v$1 !== _p$.s && (_p$.s = _$setProp(_el$8, "fg", _v$1, _p$.s));
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0,
          i: void 0,
          n: void 0,
          s: void 0
        });
        return _el$4;
      })();
    }
    ctx.keymap.layer(() => ({
      mode: "global",
      priority: 100,
      enabled: () => Boolean(popup()),
      commands: [{
        bind: "escape",
        run: close
      }]
    }));
    disposers.push(ctx.ui.slot({
      before: "prompt.footer",
      render: (i) => _$createComponent(StatsPills, {
        get sessionID() {
          return i.sessionID;
        }
      })
    }));
    disposers.push(ctx.ui.slot({
      append: "session.composer.top",
      render: (i) => _$createComponent(Show, {
        get when() {
          return ctx.data.session.get(i.sessionID)?.parentID;
        },
        get children() {
          return _$createComponent(StatsPills, {
            get sessionID() {
              return i.sessionID;
            },
            sessionDock: true
          });
        }
      })
    }));
    disposers.push(ctx.ui.slot({
      append: "app",
      render: () => _$createComponent(Show, {
        get when() {
          return popup();
        },
        get children() {
          return _$createComponent(Details, {});
        }
      })
    }));
    const resize = () => close();
    ctx.renderer.on("resize", resize);
    return () => {
      disposed = true;
      close();
      ctx.renderer.off("resize", resize);
      for (const d of disposers) d();
      histories.clear();
      charges.clear();
      timelines.clear();
      usageHydrated.clear();
    };
  }
});
export {
  tui_default as default
};
