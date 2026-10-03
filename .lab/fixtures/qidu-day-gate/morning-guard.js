(() => {
  const helper=window.TavernHelper||{};
  const eventOn=helper.eventOn||window.eventOn;
  const eventRemoveListener=helper.eventRemoveListener||window.eventRemoveListener;
  const waitGlobalInitialized=helper.waitGlobalInitialized||window.waitGlobalInitialized;
  const host=window.parent||window;
  host.__F7D_MVU_GUARD__={ready:false,calls:0};
  if(!eventOn){host.__F7D_MVU_GUARD__.error='eventOn unavailable';return}
  let active=true;
  const get=(s,path)=>path.split('.').reduce((o,k)=>o?.[k],s);
  const val=x=>Array.isArray(x)&&x.length===2&&typeof x[1]==='string'&&!Array.isArray(x[0])?x[0]:x;
  const parse=x=>{try{return JSON.parse(x)}catch{return x}};
  const latestPlayer=()=>{
    try{const chat=window.parent?.SillyTavern?.getContext?.()?.chat||[];
      return String([...chat].reverse().find(m=>m.is_user)?.mes||'');}catch{return ''}
  };

  const narrative=x=>String(x||'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'').replace(/<f7d_terminal>[\s\S]*?<\/f7d_terminal>/gi,'');
  const sceneTranscript=(day,current)=>{
    const chat=host.SillyTavern?.getContext?.()?.chat||[],texts=[];
    for(let i=chat.length-1;i>=0;i--){
      const m=chat[i];if(m.is_user||m.is_system)continue;
      const saved=m.variables?.[m.swipe_id??0]?.stat_data;
      if(saved&&saved.day!==day)break;
      if(saved?.day===day)texts.unshift(narrative(m.mes));
    }
    return texts.concat(current).join('\n');
  };
  const hasMorningVoice=text=>{
    const dream=/(?:梦境|半梦半醒|梦中|意识(?:的)?深处|黑暗的深处|虚空|尚未醒|醒来之前|醒前|沉睡)/;
    const voice=/(?:声音|低语|呢喃|自语|回响|轻叹)/;
    return text.split(/\n{2,}/).some((p,i,parts)=>dream.test(p)&&voice.test(p+' '+(parts[i+1]||'')))
      || /小神[\s\S]{0,100}(?:低语|自语|声音)/.test(text)
      || /(?:低语|呢喃)[\s\S]{0,200}(?:苏醒|醒来|睁开)/.test(text);
  };
  const hasSaihamDeparture=text=>{
    const visible=text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g,'');
    return /赛哈姆/.test(visible)&&/希罗/.test(text)&&/活骸/.test(text)
      && /(?:赛哈姆[\s\S]{0,140}(?:被带走|被抬走|被送走|被转移|离开了|离去|离开中央庭)|(?:抬着|带着|护送|押送)[\s\S]{0,100}赛哈姆[\s\S]{0,100}(?:离开|离去|走出|送往)|(?:部下|随从|人员)[\s\S]{0,100}(?:担架|推车)[\s\S]{0,100}(?:离开|离去|走出))/.test(visible);
  };

  const gates={6:['day6_monologue','day6_saiham'],5:['day5_monologue','day5_split'],4:['day4_monologue','day4_speech'],3:['day3_monologue','day3_ann_departure'],2:['day2_monologue']};
  const morningReady=prior=>prior.day===7?prior.tasks?.DAY7_OPENING?.status==='completed':(gates[prior.day]||[]).every(key=>prior.morning_flags?.[key]===true);
  const endpoints=new Set(['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途']);
  function protect(variables,commands,message){
    host.__F7D_MVU_GUARD__.calls++;
    const prior=variables.stat_data||{};if(prior.schema!=='f7d_textloop_0.4')return;
    const user=latestPlayer();
    const story=String(message||'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'');
    const transcript=sceneTranscript(prior.day,story);
    const monologueKey='day'+prior.day+'_monologue';
    const addFlag=key=>{
      if(prior.morning_flags?.[key]!==false)return;
      if(!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='morning_flags.'+key&&parse(c.args?.at(-1))===true))
        commands.push({type:'set',args:['morning_flags.'+key,'false','true'],reason:'当前日正文已完成固定演出'});
    };
    if(prior.day>=2&&prior.day<=6&&hasMorningVoice(transcript))addFlag(monologueKey);
    if(prior.day===6&&hasMorningVoice(transcript)&&hasSaihamDeparture(transcript))addFlag('day6_saiham');
    const enteringDay6=prior.day===6||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'&&parse(c.args?.at(-1))===6);
    const midnight=commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440);
    for(let i=commands.length-1;i>=0;i--){
      const cmd=commands[i],path=String(cmd.args?.[0]||'').trim().replace(/^['"]|['"]$/g,''),old=val(get(prior,path)),next=parse(cmd.args?.at(-1));
      host.__F7D_MVU_GUARD__.lastPath=path;
      let invalid=!path||path.includes('$')||path==='schema'||path==='node_used'||path.includes('.patrol')||path==='known'&&cmd.type!=='set';
      if(['regions','cores','tasks','ann','route_flags','hiro','battle_flags','intel_flags','npc_intel','relationships','cg_system','meta','player_profile'].includes(path))invalid=true;
      if(path==='day')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next!==old-1||old<=0||!(/(睡|休息到明天|结束今天|跳过今天)/.test(user)||prior.clock_minutes===1440||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440));
      const shortExchange=/(?:听.{0,12}(?:说明|讲|解释)|询问|问清|了解|交谈|聊|请.{0,10}(?:介绍|讲清|说明))/.test(user)&&!/(?:前往|赶往|出发|巡查|战斗|救援|清理|深入|调查现场|进入(?:[一-龥]{2,8}区)|动手处理)/.test(user);
      if(path==='clock_minutes'&&next>old)invalid||=shortExchange;
      if(path==='clock_minutes'&&next>old)invalid||=!morningReady(prior);
      if(path==='clock_minutes')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next<480||next>1440||(next!==480&&(next<old||(next-old)%80!==0))||(next===480&&old!==480&&!/(睡|休息到明天|结束今天|跳过今天)/.test(user)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'));
      if((path==='regions.east.liberated'||path==='regions.central.liberated')&&next===true){
        const zone=path.split('.')[1],name=zone==='east'?'东方古街':'中央城区';
        invalid||=old!==false||!String(prior.location||'').startsWith(name)||shortExchange||!/(?:区域|街区|古街|城区).{0,25}(?:解放|危机解除)|(?:解放|危机解除).{0,25}(?:区域|街区|古街|城区)/.test(story);
      }
      if(path==='battle_flags.sybilla_condition_obtained'&&next===true)invalid||=old!==false||!/(追查|调查|占卜|爱缪莎)/.test(user)||!/爱缪莎/.test(story)||!/(塔罗|占卜|牌阵)/.test(story);
      if(path==='battle_flags.sybilla_rescued'&&next===true)invalid||=get(prior,'battle_flags.sybilla_condition_obtained')!==true;
      const morningMarkers={day5_monologue:/低语|梦中.*声音|小神/,day5_split:/希罗[\s\S]*离开|离开[\s\S]*希罗/,day4_monologue:/低语|梦中.*声音|小神/,day4_speech:/希罗[\s\S]*演讲|演讲[\s\S]*希罗/,day3_monologue:/低语|梦中.*声音|小神/,day3_ann_departure:/安[\s\S]*(离开|不见|离去)/,day2_monologue:/低语|梦中.*声音|小神/};
      if(path.startsWith('morning_flags.')&&next===true){
        const key=path.slice('morning_flags.'.length),expected={day5_:5,day4_:4,day3_:3,day2_:2};
        const day=Number(key.match(/^day([2345])_/)?.[1]);
        if(day)invalid||=prior.day!==day||old!==false||!(key.endsWith('_monologue')?hasMorningVoice(transcript):morningMarkers[key]?.test(story));
        if(key==='day5_split')invalid||=!/安托涅瓦/.test(story);
        if(key==='day5_split')invalid||=prior.morning_flags?.day5_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day5_monologue'))&&!hasMorningVoice(transcript);
        if(key==='day4_speech')invalid||=prior.morning_flags?.day4_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day4_monologue'))&&!hasMorningVoice(transcript);
        if(key==='day3_ann_departure')invalid||=prior.morning_flags?.day3_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day3_monologue'))&&!hasMorningVoice(transcript);
      }
      if(path==='tasks.DAY7_OPENING.status'&&next==='completed')invalid||=!/希罗/.test(story)||!/交付|开始行动|指挥使/.test(story);
      if(path==='morning_flags.day6_monologue'&&next===true)invalid||=!enteringDay6||!hasMorningVoice(transcript);
      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=!enteringDay6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))&&!hasMorningVoice(transcript)||!hasSaihamDeparture(transcript);
      if(path==='morning_flags.day6_seth'&&next===true)invalid||=!enteringDay6||!/赛斯/.test(story);
      if(path.startsWith('cores.')){
        const zone=path.split('.')[1];
        invalid||=cmd.type!=='set'||!['unknown','available','purified','lost'].includes(next)||old==='lost'&&next!==old||old==='purified'&&next!==old;
        if(next==='purified'&&old!==next)invalid||=!/(净化|净除黑核)/.test(user)||get(prior,'regions.'+zone+'.liberated')!==true;
      }
      if(path==='meta.endings'){
        invalid||=cmd.type!=='set'||!Array.isArray(next)||next.some(x=>!endpoints.has(x))||Array.isArray(old)&&old.length>0&&JSON.stringify(old)!==JSON.stringify(next);
      }
      if(path==='ann.eligible'&&next===true)invalid||=prior.day!==4||get(prior,'ann.affection')<100||!['ANN_CORE_30','ANN_CORE_60','ANN_CORE_80'].every(x=>get(prior,'ann.core_events')?.includes(x));
      if(path==='route'&&next==='ann')invalid||=get(prior,'ann.eligible')!==true||!/(追安|找安|跟安|追回)/.test(user);
      if(path==='cg_system.shown.ann_first_meet'&&next===false)invalid=true;
      if(invalid)commands.splice(i,1);
    }
    const completed=zone=>prior.regions?.[zone]?.liberated===true||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='regions.'+zone+'.liberated'&&parse(c.args?.at(-1))===true);
    for(let i=commands.length-1;i>=0;i--){
      const c=commands[i],path=String(c.args?.[0]||'').replace(/^['"]|['"]$/g,''),next=parse(c.args?.at(-1));
      if(path==='route_flags.first_second_region'&&next!==prior.route_flags?.first_second_region){
        if(!['east','central'].includes(next)||prior.route_flags?.first_second_region!==null||!completed(next)||completed(next==='east'?'central':'east'))commands.splice(i,1);
      }
      if(path==='route_flags.oldstreet_delayed'&&next===true&&!completed('central'))commands.splice(i,1);
    }
    if(midnight&&prior.day>0&&commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440)){
      if(!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'))commands.push({type:'set',args:['day',String(prior.day-1)],reason:'午夜强制睡觉'});
      commands.push({type:'set',args:['clock_minutes','480'],reason:'次日08:00'});
    }
  }
  const bind=()=>{const mvu=host.Mvu||window.Mvu;if(!active||!mvu||host.__F7D_MVU_GUARD__.ready)return;
    eventOn(mvu.events.COMMAND_PARSED,protect);host.__F7D_MVU_GUARD__.ready=true};
  bind();
  if(!host.__F7D_MVU_GUARD__.ready){eventOn('global_Mvu_initialized',bind);if(waitGlobalInitialized)waitGlobalInitialized('Mvu').then(bind).catch(e=>console.warn('[qidu/mvu]',e))}
  window.addEventListener('pagehide',()=>{active=false;try{const mvu=window.parent?.Mvu||window.Mvu;eventRemoveListener?.(mvu.events.COMMAND_PARSED,protect)}catch{}},{once:true});
})();