// Runs within the existing, imported-card real SillyTavern acceptance session.
// Uses the real formatter/regex engine, DOM observer and generation event bus.
export async function checkStreamingUi(page) {
  return page.evaluate(async()=>{
    const st=await import('/script.js');
    const ctx=window.SillyTavern.getContext();
    const wait=()=>new Promise(resolve=>setTimeout(resolve,85));
    const emit=async(name,...args)=>ctx.eventSource.emit(ctx.eventTypes[name],...args);
    const originalLength=ctx.chat.length;
    const node=document.createElement('div');node.className='mes';node.setAttribute('mesid',String(originalLength));
    const text=document.createElement('div');text.className='mes_text';node.append(text);
    document.querySelector('#chat').append(node);
    ctx.chat.push({name:'流式回归',is_user:false,is_system:false,mes:''});
    const state='<f7d_state>'+JSON.stringify({day:7,location:'中央庭',tasks:{},cores:{court:'unknown'},private_stream_marker:'隐藏状态不可见'})+'</f7d_state>';
    const render=raw=>{ctx.chat[originalLength].mes=raw;text.innerHTML=st.messageFormatting(raw,'流式回归',false,false,originalLength,{},false);};
    const result={statePrefixesHidden:true,noTransientFallback:true,noHeightOscillation:true,partialShellsHidden:true,bodyPreserved:true};
    try {
      await emit('GENERATION_STARTED','normal',{},false);
      for(let i=state.indexOf('>')+1;i<=state.length;i++){
        render(state.slice(0,i));
        if(text.textContent.trim())result.statePrefixesHidden=false;
      }
      const body='安把终端递给你，等你看清上面的消息。';
      for(let i=1;i<=body.length;i++){
        render(state+body.slice(0,i));
        const height=text.getBoundingClientRect().height;
        await wait();
        if(text.querySelector('[data-f7d-terminal-fallback]'))result.noTransientFallback=false;
        if(text.getBoundingClientRect().height!==height)result.noHeightOscillation=false;
        if(text.textContent.trim()!==body.slice(0,i))result.bodyPreserved=false;
      }
      for(const tail of ['<f7d_terminal>第7天','<f7d_choices><f7d_choice>先看消息</f7d_choice>']){
        render(state+body+tail);await wait();
        if(text.textContent.trim()!==body)result.partialShellsHidden=false;
      }
      const full=state+body+'<f7d_terminal>第7天｜中央庭</f7d_terminal><f7d_choices><f7d_choice>先看消息</f7d_choice><f7d_choice>问安下一步安排</f7d_choice></f7d_choices>';
      render(full);await emit('GENERATION_ENDED',ctx.chat.length);await wait();
      result.finalShells=text.querySelectorAll('[data-f7d-terminal]').length===1&&text.querySelectorAll('[data-f7d-choice="1"]').length===2;
      result.rawUnchanged=ctx.chat[originalLength].mes===full;
      // A missing terminal is repaired only once after stopping, including a pause
      // longer than the debounce while streaming (the loop above).
      await emit('GENERATION_STARTED','normal',{},false);
      render(state+body);await wait();
      result.noFallbackBeforeStop=!text.querySelector('[data-f7d-terminal-fallback]');
      await emit('GENERATION_STOPPED');await wait();
      const terminal=text.querySelector('[data-f7d-terminal-fallback]');await wait();
      result.fallbackAfterStop=Boolean(terminal)&&terminal===text.querySelector('[data-f7d-terminal-fallback]')&&text.querySelectorAll('[data-f7d-terminal]').length===1;
      await emit('GENERATION_STARTED','normal',{},false);
      render(state.slice(0,-10));await emit('GENERATION_STOPPED');await wait();
      result.interruptedStateHidden=!text.textContent.trim()&&!text.querySelector('[data-f7d-terminal]');
      return result;
    }finally{
      await emit('GENERATION_ENDED',ctx.chat.length);node.remove();ctx.chat.splice(originalLength);
    }
  });
}
