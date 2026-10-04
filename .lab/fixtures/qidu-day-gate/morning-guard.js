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
    const dream=/(?:梦境|半梦半醒|梦中|意识(?:的)?深处|意识[^。\n]{0,30}(?:重归|回到)[^。\n]{0,20}躯壳|黑暗(?:的深处)?|虚空|虚无|尚未醒|醒来之前|醒前|沉睡|睁开双眼前|现实感知之前)/;
    const voice=/(?:声音|声响|低语|呢喃|自语|回响|轻叹)/;
    return text.split(/\n{2,}/).some((p,i,parts)=>dream.test(p)&&voice.test(p+' '+(parts[i+1]||'')))
      || /小神[\s\S]{0,100}(?:低语|自语|声音)/.test(text)
      || /(?:低语|呢喃)[\s\S]{0,200}(?:苏醒|醒来|睁开)/.test(text)
      || /(?:意识|黑暗|虚无|睡梦|醒来)[\s\S]{0,260}(?:声音|声响|低语|呢喃)[\s\S]{0,420}(?:醒来|睁开|现实|天花板|晨光)/.test(text);
  };
  const hasSaihamDeparture=text=>{
    const visible=text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g,'');
    if(!/赛哈姆/.test(visible)||!/希罗/.test(text)||!/活骸/.test(text))return false;
    // 只有“实际离场已经发生”才算完成。准备撤离、将被送往、要求保密、正在固定担架均不算。
    const completed=
      /赛哈姆[\s\S]{0,180}(?:被带离中央庭|被抬离中央庭|已经离开中央庭|随[^。\n]{0,60}(?:离开(?:了)?中央庭|走出(?:了)?中央庭))/.test(visible)
      || /(?:抬着|带着|护送着|押送着)[\s\S]{0,140}赛哈姆[\s\S]{0,180}(?:离开(?:了)?中央庭|走出(?:了)?中央庭|穿过[^。\n]{0,80}(?:安全通道|侧门|出口)[\s\S]{0,80}(?:消失|远去))/.test(visible)
      || /(?:担架|推车)[\s\S]{0,220}(?:穿过[^。\n]{0,80}(?:安全通道|侧门|出口)[\s\S]{0,100}(?:脚步声[^。\n]{0,60}(?:消失|远去)|消失在)|离开(?:了)?中央庭)/.test(visible);
    return completed&&!/(?:准备|即将|将要|打算|需要)[^。\n]{0,40}(?:撤离|离开|送往|转移)/.test(visible.slice(Math.max(0,visible.lastIndexOf('赛哈姆'))));
  };
  const day5DecisionMade=user=>{
    const t=String(user||'').replace(/\s+/g,'');
    return /(?:拒绝(?:希罗|邀请)?|不答应|不接受|不跟(?:希罗)?走|不加入|留在中央庭|选择中央庭|支持(?:你|希罗)|认同(?:你|希罗|这个方案|你的方案)|赞同(?:你|希罗|这个方案|你的方案)|愿意(?:和希罗)?合作|跟(?:你|希罗)走|加入(?:你|希罗)|保持沉默|暂不表态|不表态|暂不回答)/.test(t);
  };

  const inferSceneLocation=text=>{
    const rules=[
      ['中央庭会议室',/(?:你|你们)[^。\n]{0,90}(?:来到|进入|走进|抵达|赶到)[^。\n]{0,55}(?:中央庭的?)?(?:会议室|议事大厅|议事厅)/g],
      ['中央庭指挥室',/(?:你|你们)[^。\n]{0,90}(?:来到|进入|走进|抵达|赶到)[^。\n]{0,55}(?:中央庭的?)?(?:指挥室|办公室)/g],
      ['中央庭走廊',/(?:你|你们)[^。\n]{0,90}(?:来到|进入|走进|抵达|赶到|推门而出)[^。\n]{0,55}(?:中央庭的?)?(?:走廊|廊道)/g],
      ['中央庭寝室',/(?:你|你们)[^。\n]{0,90}(?:回到|返回|进入|走进)[^。\n]{0,55}(?:中央庭的?)?(?:寝室|房间)/g]
    ];
    let found=null,index=-1;
    for(const [name,re] of rules){for(const m of text.matchAll(re)){if(m.index>=index){index=m.index;found=name;}}}
    return found;
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
        if(key==='day5_split')invalid||=!/安托涅瓦/.test(story)||!day5DecisionMade(user);
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
    const inferredLocation=inferSceneLocation(story);
    const hasLocationUpdate=commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='location');
    if(inferredLocation&&inferredLocation!==prior.location&&!hasLocationUpdate)
      commands.push({type:'set',args:['location',String(prior.location||''),inferredLocation],reason:'正文已发生实际位移，同步当前位置'});
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