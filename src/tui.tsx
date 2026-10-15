import { Plugin } from '@opencode/plugin/tui';
import type { SessionMessageInfo } from '@opencode/client';
import type { BoxRenderable, Renderable } from '@opentui/core';
import { createEffect, createMemo, createSignal, For, Show, onCleanup, onMount } from 'solid-js';
import { cachePercent, contextReading, contextStep, compact, duration, finite, fold, mergeReading, reading, speed, total, sumUsage, observeOutput, restoreTiming, timingSample, type TimingSample, type Reading } from './metrics.js';

import { latestTurnCost, money, parsePrices, sessionCost, type Charge } from './cost.js';

import { customIcons, initialIcons, hasIconFont } from './icons.js';
import { wrapFooter } from './layout.js';

type Kind = 'time' | 'usage' | 'cost' | 'context';
type Popup = { kind: Kind; sessionID: string; x: number; y: number };
type Row = [string, string];

export default Plugin.define({
  id: 'opencode-stats-pills',
  setup(ctx) {
    const [icons, setIcons] = createSignal(initialIcons());
    void hasIconFont().then(found => { if (found && !disposed) setIcons(customIcons); });
    const [revision, setRevision] = createSignal(0);
    const [popup, setPopup] = createSignal<Popup>();
    const prices = parsePrices(ctx.options.prices);
    const charges = new Map<string, Map<string, Charge>>();
    const timelines = new Map<string, Map<string, {id:string;type:string;time:{created:number}}>>();
    const [timingCache, writeTimingCache] = ctx.storage.store<{sessions:Record<string,Record<string,TimingSample>>}>('timing-v1',{initial:{sessions:{}}});    const histories = new Map<string, Map<string, Reading>>();
    const loading = new Set<string>();
    const completedHydration = new Set<string>();
    const errors = new Set<string>();
    const usageHydrated = new Set<string>();
    let disposed = false;
    let previousFocus: Renderable | null | undefined;
    const changed = () => setRevision(n => n + 1);
    const history = (id: string) => {
      if (!histories.has(id)) histories.set(id, new Map());
      return histories.get(id)!;
    };
    const close = () => { setPopup(undefined); if (previousFocus && !previousFocus.isDestroyed) previousFocus.focus(); previousFocus=undefined; };
    const muted = () => ctx.theme.text.muted;
    const normal = () => ctx.theme.text.base;
    const hoverBg = () => ctx.themeMode === 'dark' ? '#292929' : '#e4e4e4';
    const panelBg = () => ctx.themeMode === 'dark' ? '#303030' : '#f4f4f4';

    function ingest(id: string, message: SessionMessageInfo) {
      if (!timelines.has(id)) timelines.set(id,new Map());
      timelines.get(id)!.set(message.id,{id:message.id,type:message.type,time:{created:message.time.created}});
      if (message.type === 'compaction' && message.status !== 'running') {
        if (message.tokens || message.cost !== undefined) {
          if (!charges.has(id)) charges.set(id,new Map());
          charges.get(id)!.set(message.id,{model:('model' in message ? message.model : undefined) ?? {providerID:'',id:''},tokens:message.tokens,cost:message.cost});
        }
        return;
      }
      if (message.type !== 'assistant') return;
      if (finite(message.time.completed)) {
        if (!charges.has(id)) charges.set(id, new Map());
        const old = charges.get(id)!.get(message.id);
        const tokens = message.tokens ?? old?.tokens, cost = message.cost ?? old?.cost;
        // A failed or interrupted step can complete before the provider reports
        // usage. Its usage is unknown, not the session's, so it is left out.
        if (tokens || cost !== undefined) charges.get(id)!.set(message.id, {model:message.model, tokens, cost});
      }
      const r = reading(message)!;
      const old = history(id).get(message.id);
      history(id).set(message.id, restoreTiming(mergeReading(old,r),timingCache.sessions[id]?.[message.id]));
    }
    async function hydrate(id: string) {
      if (loading.has(id) || completedHydration.has(id)) return;
      loading.add(id);
      try {
        let cursor: string | undefined;
        const seen = new Set<string>();
        do {
          const page = await ctx.client.message.list({sessionID:id,limit:100,...(cursor?{cursor}:{order:'asc' as const})});
          if (disposed) return;
          for (const message of page.data) ingest(id, message);
          cursor = page.cursor.next ?? undefined;
          if (cursor && seen.has(cursor)) throw new Error('Repeated history cursor');
          if (cursor) seen.add(cursor);
        } while (cursor);
        usageHydrated.add(id);
        // V2 history logs omit payload deltas. Restore observed times from
        // durable plugin storage; part timestamps remain a guarded fallback.
        completedHydration.add(id); errors.delete(id);
      } catch { errors.add(id); }
      finally { loading.delete(id); if (!disposed) changed(); }
    }
    function recordOutput(id:string,messageID:string,delta:string,time:number,text=false) {
      const r=history(id).get(messageID);
      if(!r)return;
      const next=observeOutput(r,delta,time,text);
      if(next===r)return;
      history(id).set(messageID,next);
      const sample=timingSample(next)!;
      const saved=timingCache.sessions[id]?.[messageID];
      if(saved?.first===sample.first&&saved.text===sample.text&&saved.lead===sample.lead)return;
      void writeTimingCache(draft=>{
        const entries=draft.sessions[id]??(draft.sessions[id]={});
        const old=entries[messageID];
        entries[messageID]={...sample,first:Math.min(old?.first??sample.first,sample.first)};
      }).catch(()=>{});
    }
    const disposers: (() => void)[] = [];
    disposers.push(ctx.data.listen(({details:event}) => {
      if (!('sessionID' in event.data) || typeof event.data.sessionID !== 'string') return;
      const id = event.data.sessionID;
      switch (event.type) {
        case 'session.step.started': {
          history(id).set(event.data.assistantMessageID,{id:event.data.assistantMessageID,start:event.data.started,toolMs:0}); break;
        }
        case 'session.tool.input.started': {
          // DSH counts a name-bearing tool delta as generated output.
          recordOutput(id,event.data.assistantMessageID,event.data.name,event.created);break;
        }
        case 'session.text.delta': case 'session.reasoning.delta': case 'session.tool.input.delta': {
          // Text needs its first batch captured here; reasoning times come from
          // the message itself. Any payload still marks TTFT.
          recordOutput(id,event.data.assistantMessageID,event.data.delta,event.created,event.type==='session.text.delta');break;
        }
        case 'session.step.streamed': {
          const r=history(id).get(event.data.assistantMessageID);
          if(r)r.streamEnd=event.created;break;
        }
        case 'session.step.ended': case 'session.step.failed': {
          const r = history(id).get(event.data.assistantMessageID);
          if (r) { r.end = event.created; r.tokens = event.data.tokens; }
          // The cache projection may publish after this event. Keep a content-free
          // completed message for usage and cost until the next cache update.
          const m = ctx.data.session.message.get(id,event.data.assistantMessageID);
          if (m?.type === 'assistant') ingest(id,{...m,time:{...m.time,completed:event.created},tokens:event.data.tokens,cost:event.data.cost});
          else if (r) ingest(id,{id:r.id,type:'assistant',time:{created:r.start,streamed:r.streamEnd,completed:r.end},tokens:r.tokens,model:ctx.data.session.get(id)?.model ?? {providerID:'',id:''},agent:'',content:[],cost:event.data.cost});
          break;
        }
        case 'session.idle': {
          for (const m of ctx.data.session.message.list(id)) ingest(id,m);
          break;
        }
        case 'session.revert.committed': case 'session.compaction.ended': {
          completedHydration.delete(id); history(id).clear(); charges.delete(id); timelines.delete(id); usageHydrated.delete(id); void hydrate(id); break;
        }
        case 'session.deleted': void writeTimingCache(draft=>{delete draft.sessions[id];}).catch(()=>{}); histories.delete(id); charges.delete(id); timelines.delete(id); usageHydrated.delete(id); completedHydration.delete(id); if(popup()?.sessionID===id) close(); break;
        default: return;
      }
      changed();
    }));
    function snapshot(id: string) {
      revision();
      const session = ctx.data.session.get(id);
      const messages = ctx.data.session.message.list(id);
      for (const m of messages) ingest(id,m);
      const entries = [...charges.get(id)?.values() ?? []];
      // A request may report a host charge without token counts; it still costs.
      const t = usageHydrated.has(id) ? sumUsage(entries.flatMap(c=>c.tokens?[c.tokens]:[])) : undefined;
      // The same step and revert boundary OpenCode uses for its own context usage.
      const last = contextStep(messages, session?.revert?.messageID);
      // Keep the measured usage and its request model together after model switches.
      const selected = last?.model ?? session?.model;
      const models = ctx.data.location.model.list(session?.location ?? ctx.location) ?? [];
      const model = models.find(m=>m.providerID===selected?.providerID && m.id===selected.id);
      const {used,limit,percent} = contextReading(last?.tokens,model?.limit.context);
      const cost = usageHydrated.has(id) ? sessionCost(entries, prices, models) : undefined;
      const lastCost = usageHydrated.has(id) ? latestTurnCost([...timelines.get(id)?.values() ?? []],charges.get(id) ?? new Map(),prices,models) : undefined;
      return {cost,lastCost,timing:fold(history(id).values()),tokens:t,used,limit,percent,modelName:model?.name,historyError:errors.has(id),loading:loading.has(id)};
    }
    function rows(id: string, kind: Kind): Row[] {
      const s = snapshot(id), t=s.tokens;
      if(kind==='time') return [
        ['模型用时',duration(s.timing.modelMs)],
        ['首 token 平均（TTFT）',duration(s.timing.ttftSteps?s.timing.ttftMs/s.timing.ttftSteps:undefined)],
        ['输出速度（TPS）',speed(s.timing)]
      ];
      if(kind==='cost') return [['当前会话',money(s.cost)],['最近一轮对话',money(s.lastCost)]];
      if(kind==='usage') return [
        ['缓存命中',cachePercent(t)],['未缓存输入',t?`${t.input.toLocaleString('en-US')} tok`:'—'],
        ['缓存读取',t?`${t.cache.read.toLocaleString('en-US')} tok`:'—'],
        ...(t?.cache.write?[['缓存写入',`${t.cache.write.toLocaleString('en-US')} tok`] as Row]:[]),
        ['输出',t?`${t.output.toLocaleString('en-US')} tok`:'—'],
        ...(t?.reasoning?[['思考',`${t.reasoning.toLocaleString('en-US')} tok`] as Row]:[])
      ];
      return [];
    }

    function open(id:string,kind:Kind,anchor?:BoxRenderable) {
      if (popup()?.sessionID===id && popup()?.kind===kind) {close();return;}
      previousFocus ??= ctx.renderer.currentFocusedRenderable;
      setPopup({sessionID:id,kind,x:anchor?.x??Math.floor(ctx.renderer.width/2),y:anchor?.y??ctx.renderer.height-3});
    }
    function Pill(props:{sessionID:string;kind:Kind;label:()=>string}) {
      const [hover,setHover]=createSignal(false);
      let anchor:BoxRenderable|undefined;
      const active=()=>popup()?.sessionID===props.sessionID && popup()?.kind===props.kind;
      // Keep adjacent cells in the same foreground run: enlarged icon outlines
      // overhang their cell, and terminal padding otherwise uses default colors.
      return <box ref={anchor} flexShrink={0}
        backgroundColor={hover()||active()?hoverBg():undefined}
        onMouseOver={()=>setHover(true)} onMouseOut={()=>setHover(false)}
        onMouseDown={e=>{if(e.button!==0)return;e.stopPropagation();open(props.sessionID,props.kind,anchor);}}>
        <text fg={hover()||active()?normal():muted()}>{` ${props.label()} `}</text>
      </box>;
    }
    function StatsPills(props:{sessionID?:string;sessionDock?:boolean}) {
      const s=createMemo(()=>props.sessionID?snapshot(props.sessionID):undefined);
      createEffect(()=>{const id=props.sessionID;if(id)void hydrate(id);if(popup() && popup()?.sessionID!==id)close();});
      let root:BoxRenderable|undefined;
      // OpenCode 2.0.26 places prompt.footer slots in one row. Wrap its
      // existing children onto the next row so host status/actions remain visible.
      let restoreFooter:(()=>void)|undefined;
      onMount(()=>{
        const dockParent=root?.parent as BoxRenderable|undefined;
        if(dockParent && !props.sessionDock) restoreFooter=wrapFooter(dockParent);
      });
      onCleanup(()=>restoreFooter?.());
      return <Show when={props.sessionID}><box ref={root} marginBottom={props.sessionDock?1:0} width="100%" flexDirection="row" justifyContent="center" columnGap={1} flexWrap="wrap" minHeight={1} flexShrink={0}>
        <Pill sessionID={props.sessionID!} kind="time" label={()=>`${icons().time} ${s()?speed(s()!.timing):'— tok/s'}`}/>
        <Pill sessionID={props.sessionID!} kind="usage" label={()=>`${icons().usage} ${s()?.tokens?compact(total(s()!.tokens!)):'—'} tok · 缓存命中 ${cachePercent(s()?.tokens)}`}/>
        <Pill sessionID={props.sessionID!} kind="cost" label={()=>`${icons().cost} ${money(s()?.cost).replace(/^\$ /,'')}`}/>
        <Pill sessionID={props.sessionID!} kind="context" label={()=>`${icons().context} ${s()?.percent == null ? '—' : `${s()!.percent}%`}`}/>
      </box></Show>;
    }
    function Details() {
      const p=()=>popup()!;
      const s=createMemo(()=>snapshot(p().sessionID));
      const content=createMemo(()=>rows(p().sessionID,p().kind));
      const width=()=>Math.max(12,Math.min(44,ctx.renderer.width-2));
      const height=()=>Math.min(p().kind==='context'?4:content().length+4,ctx.renderer.height-2);
      const heading=()=>p().kind==='time'?`${icons().time} 会话统计`:p().kind==='usage'?`${icons().usage} Token 用量`:p().kind==='cost'?`${icons().cost} 费用`:`上下文已用 ${s().percent == null ? '—' : `${s().percent}%`}`;
      const summary=()=>p().kind==='usage'?(s().tokens?total(s().tokens!).toLocaleString('en-US')+' tok':'—'):p().kind==='context'?`~${compact(s().used)} / ${compact(s().limit)}`:'';
      const filled=()=>Math.round((s().percent??0)/100*Math.max(0,width()-4));
      let panel:BoxRenderable|undefined;
      onMount(()=>{if(panel){panel.focusable=true;panel.focus();}});
      return <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} onMouseDown={e=>{if(e.button===0){e.stopPropagation();close();}}}>
        <box ref={panel} position="absolute" left={Math.max(0,Math.min(p().x,ctx.renderer.width-width()))}
          top={Math.max(0,p().y-height()-1)} width={width()} height={height()} paddingX={2} paddingY={1} flexDirection="column"
          backgroundColor={panelBg()} onMouseDown={e=>e.stopPropagation()}>
          <box height={1} flexShrink={0} flexDirection="row" justifyContent="space-between"><text fg={normal()}>{heading()}</text><text fg={normal()}>{summary()}</text></box>
          <Show when={p().kind!=='context'}><text height={1} flexShrink={0} fg={ctx.themeMode==='dark'?'#454545':'#cccccc'}>{'─'.repeat(Math.max(0,width()-4))}</text></Show>
          <Show when={p().kind==='context'} fallback={
            <scrollbox flexGrow={1} scrollbarOptions={{visible:false}}>
              <For each={content()}>{row=><box flexDirection="row" justifyContent="space-between"><text fg={muted()}>{row[0]}</text><text fg={normal()}>{row[1]}</text></box>}</For>
            </scrollbox>
          }>
            <box height={1} flexShrink={0} flexDirection="row"><text fg={normal()}>{'━'.repeat(filled())}</text><text fg={ctx.themeMode==='dark'?'#454545':'#cccccc'}>{'━'.repeat(Math.max(0,width()-4-filled()))}</text></box>
          </Show>
        </box>
      </box>;
    }
    ctx.keymap.layer(()=>({mode:'global',priority:100,enabled:()=>Boolean(popup()),commands:[{bind:'escape',run:close}]}));

    disposers.push(ctx.ui.slot({before:'prompt.footer',render:i=><StatsPills sessionID={i.sessionID}/>}));
    // Child sessions use the Subagents/Shell dock instead of an editable prompt.
    // The composer slot places child statistics above that panel in normal flow.
    disposers.push(ctx.ui.slot({append:'session.composer.top',render:i=><Show when={ctx.data.session.get(i.sessionID)?.parentID}><StatsPills sessionID={i.sessionID} sessionDock/></Show>}));
    disposers.push(ctx.ui.slot({append:'app',render:()=> <Show when={popup()}><Details/></Show>}));
    const resize=()=>close(); ctx.renderer.on('resize',resize);
    return ()=>{disposed=true;close();ctx.renderer.off('resize',resize);for(const d of disposers)d();histories.clear();charges.clear();timelines.clear();usageHydrated.clear();};
  }
});
