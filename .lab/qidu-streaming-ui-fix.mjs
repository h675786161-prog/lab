// Presentation-only patch. Do not change story, state, counters or model prompts.
export function fixStreamingUi(card) {
  const ext = card.data.extensions;
  const rules = ext.regex_scripts;
  const state = rules.find(x => x.id === 'f7d-state-hide-v040');
  state.findRegex = String.raw`/<\s*f7d_state\s*>[\s\S]*?(?:<\s*\/\s*f7d_state\s*>|$)/gi`;
  // Hold incomplete UI shells until their closing tag arrives. Raw model text is
  // untouched (display-only regex), including interrupted saves for recovery.
  rules.unshift({ ...state, id: 'f7d-streaming-shell-v0424',
    scriptName: '七都｜生成中界面防闪',
    findRegex: String.raw`/<\s*(f7d_terminal|f7d_choices)\s*>(?:(?!<\s*\/\s*\1\s*>)[\s\S])*$/gi`,
    replaceString: '' });
  for (const rule of rules.filter(x => x.id.startsWith('f7d-cg-'))) {
    const [width, height] = rule.id.includes('ending_box') ? [540,720]
      : rule.id.includes('ending_final') ? [576,720] : [720,405];
    rule.replaceString = rule.replaceString.replace('<img ', `<img width="${width}" height="${height}" `);
  }
  const bridge = ext.tavern_helper.scripts.find(x => x.id === 'qidu-v0424-choice-bridge');
  let s = bridge.content;
  const replace = (a,b) => { if (!s.includes(a)) throw new Error('Streaming patch anchor missing: '+a); s=s.replace(a,b); };
  replace("  const choice=", String.raw`  const host=window.parent||window;
  let generating=false, disposed=false, timer=null;
  const context=()=>host.SillyTavern?.getContext?.();
  const busy=()=>{
    const stream=context()?.streamingProcessor;
    return generating||Boolean(stream&&!stream.isFinished&&!stream.isStopped);
  };
  const subscriptions=[];
  const start=(type,options,dryRun)=>{
    if(dryRun||type==='quiet') return;
    generating=true;
  };
  const end=()=>{generating=false;refresh();};
  const choice=`);
  replace("  const normalizePresetShells=()=>{", "  const normalizePresetShells=()=>{\n    if(busy()) return;");
  replace("  const ensureTerminalFallbacks=()=>{", "  const ensureTerminalFallbacks=()=>{\n    if(busy()) return;");
  replace("    if(queued)return;", "    if(queued||disposed)return;");
  replace("    setTimeout(()=>{queued=false;", "    timer=setTimeout(()=>{timer=null;if(disposed)return;queued=false;");
  replace("    old?.observer?.disconnect?.();", "    old?.dispose?.();\n    old?.observer?.disconnect?.();");
  replace("    window.parent[KEY]={version:'1.6.0',", String.raw`    const ctx=context();
    for(const [name,fn] of [['GENERATION_STARTED',start],['GENERATION_ENDED',end],['GENERATION_STOPPED',end]]){
      const event=ctx?.eventTypes?.[name];
      if(event&&ctx?.eventSource){ctx.eventSource.on(event,fn);subscriptions.push([ctx.eventSource,event,fn]);}
    }
    const dispose=()=>{
      disposed=true;clearTimeout(timer);observer.disconnect();doc.removeEventListener('click',click,true);
      for(const [source,event,fn] of subscriptions)source.removeListener(event,fn);
    };
    window.addEventListener('pagehide',dispose,{once:true});
    window.parent[KEY]={version:'1.6.1',dispose,`);
  bridge.content=s;
  bridge.info+=' 生成期间不补建终端或重排预设选项，结束或停止后再补齐。';
  ext.qidu_frontend.ui_revision='stream-fix-1';
}
