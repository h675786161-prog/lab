(() => {
 'use strict';
 const host=window.parent;
 const KEY='f7dDayGate';
 host[KEY]?.dispose?.();
 const ctx=()=>host.SillyTavern?.getContext?.();
 function rule(entry){const m=String(entry.comment||'').match(/\[F7D_GATE:(.*?)\]/);if(!m)return null;try{return JSON.parse(m[1])}catch{return {deny:true}}}
 function allow(entry,s){const r=rule(entry);if(!r)return true;if(!s||r.deny)return false;if(r.day!==undefined&&s.day!==r.day)return false;if(r.unlock!==undefined&&s.day>r.unlock)return false;if(r.route&&s.route!==r.route)return false;if(r.flag){let v=s;for(const k of r.flag.split('.'))v=v?.[k];if(v!==true)return false}if(r.saiham&&s.morning_flags?.day6_saiham===true)return false;return true}
 function state(){
  const c=ctx();if(!c||!Array.isArray(c.chat))return null;
  for(let i=c.chat.length-1;i>=0;i--){
   const m=c.chat[i];if(m.is_user||m.is_system)continue;
   let d=null;
   try{if(typeof getVariables==='function')d=getVariables({type:'message',message_id:i});else if(host.Mvu?.getMvuData)d=host.Mvu.getMvuData({type:'message',message_id:i})}catch{return null}
   const s=d?.stat_data;if(!s||s.schema!=='f7d_textloop_0.4'||!Number.isInteger(s.day)||s.day<1||s.day>7)return null;
   return s;
  }
  return null;
 }
 function filter(payload){
  const s=state();
  for(const name of ['globalLore','characterLore','chatLore','personaLore']){
   const entries=payload?.[name];if(!Array.isArray(entries))continue;
   for(let i=entries.length-1;i>=0;i--){const e=entries[i];if(!rule(e))continue;if(!allow(e,s))entries.splice(i,1);else{e.disable=false;e.constant=true;e.sticky=0;e.cooldown=0;e.delay=0}}
  }
 }
 const c=ctx(),event=c?.eventTypes?.WORLDINFO_ENTRIES_LOADED;
 if(!event||!c.eventSource){console.error('七都日程：当前酒馆缺少世界书加载前置事件，日程条目保持关闭');return}
 c.eventSource.on(event,filter);c.eventSource.makeFirst?.(event,filter);
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;c.eventSource.removeListener(event,filter);window.removeEventListener('pagehide',dispose);window.removeEventListener('unload',dispose);if(host[KEY]?.dispose===dispose)delete host[KEY]};
 host[KEY]={version:1,allow,dispose};
 window.addEventListener('pagehide',dispose);window.addEventListener('unload',dispose);
})();