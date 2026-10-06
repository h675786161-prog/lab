// 必须与固定版本变量框架处于同一个酒馆助手脚本窗口，并在导入框架前执行。
(() => {
  const host=window.parent;
  window.__f7dCommitHook?.dispose?.();
  const cleanups=[], originals=new Map(), tickets=new WeakMap(), stateTickets=new WeakMap();
  const bridge=()=>host.__f7dCommitBridge;
  const ctx=()=>host.SillyTavern.getContext();
  const latest=()=>ctx().chat.length-1;
  const on=(name,fn)=>{ const r=eventOn(name,fn);cleanups.push(()=>r?.stop?.()); };
  on('mag_variable_update_started',v=>{tickets.set(v,bridge()?.capture());});
  on('mag_variable_update_ended',v=>{if(v.stat_data)stateTickets.set(v.stat_data,tickets.get(v));});
  on('mag_before_message_update',c=>{if(c.variables?.stat_data)stateTickets.set(c.variables.stat_data,tickets.get(c.variables));});
  function patch(name) {
    const original=window[name];if(typeof original!=='function')throw Error('缺少变量写入接口：'+name);
    originals.set(name,original);
    window[name]=async function(first,options={type:'chat'}) {
      const ticket=bridge()?.capture();
      let resultData,trackedTicket=typeof first==='object'?stateTickets.get(first?.stat_data):undefined;
      const arg=typeof first==='function'?async old=>{
        resultData=await first(old);trackedTicket=stateTickets.get(resultData?.stat_data);
        if(!bridge()?.valid(trackedTicket||ticket))throw Error('七都：过期变量事务已取消');
        return resultData;
      }:first;
      try {
        if (!bridge()?.valid(trackedTicket||ticket)) return undefined;
        const result=await original.call(this,arg,options);
        if(options.type==='message') {
          const id=options.message_id===undefined||options.message_id==='latest'?latest():options.message_id<0?ctx().chat.length+options.message_id:options.message_id;
          const t=trackedTicket||ticket;
          if(bridge()?.valid(t)) {
            const reader=o=>getVariables(o);
            bridge().publish(t,id,reader);
          }
        }
        return result;
      } catch(e) { if(bridge()?.valid(trackedTicket||ticket))bridge()?.fail('COMMIT_FAILED','变量提交失败');throw e; }
    };
  }
  patch('updateVariablesWith');patch('replaceVariables');
  const reload=()=>{
    // 切聊天/回退只读当前选中楼层已有的消息变量，不向前搜索旧快照。
    const id=latest(), ticket=bridge()?.capture();
    if(id>=0&&ticket)bridge()?.publish(ticket,id,o=>getVariables(o));
  };
  host.addEventListener('f7d:reload-committed',reload);
  host.addEventListener('f7d:provider-ready',reload);
  cleanups.push(()=>host.removeEventListener('f7d:reload-committed',reload),()=>host.removeEventListener('f7d:provider-ready',reload));
  const dispose=()=>{cleanups.splice(0).forEach(fn=>fn());for(const [name,fn] of originals)window[name]=fn;window.removeEventListener('pagehide',dispose);};
  window.__f7dCommitHook={dispose,reload};window.addEventListener('pagehide',dispose);
  reload();
})();

