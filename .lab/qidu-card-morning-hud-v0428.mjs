export const VERSION='0.4.28-morning-clock-hud';
const extraFlags={day5_monologue:false,day5_split:false,day4_monologue:false,day4_speech:false,day3_monologue:false,day3_ann_departure:false,day2_monologue:false};

export function addMorningClockHud(input){
  const card=structuredClone(input),d=card.data,entries=d.character_book.entries;
  const entry=id=>entries.find(e=>e.id===id);
  const init=d.first_mes.match(/<initvar>([\s\S]*?)<\/initvar>/);
  if(!init)throw Error('initvar missing');
  const state=JSON.parse(init[1]);
  state.morning_flags={...state.morning_flags,...extraFlags};
  d.first_mes=d.first_mes.replace(init[0],`<initvar>${JSON.stringify(state)}</initvar>`);
  d.alternate_greetings=d.alternate_greetings.map(s=>s.replace('战术终端显示“第7天 · 0/12”','晨光照进病房'));
  entries.find(e=>e.name.startsWith('[InitVar]')).content=JSON.stringify(state,null,2);
  entry(1).content+='\n【固定剧情计时锁】第7天苏醒至希罗初见、交付行动权之前，时钟始终08:00；只有前一轮已完成开场，随后由指挥使实际发起的行动才计时。第6天至第2天每天先演出当天既定晨间事件，全部结束后才允许行动耗时。晨间对白、接过草莓糖、对固定事件表态均为0分钟；剧情可以登记已发生的事件标记，但不得因此扣行动时间。';
  entry(4).content+='\n【常驻状态栏】天数、时刻和位置只从stat_data写到界面状态栏；正文及选项不另行抄写数值。状态栏随消息、变量或界面重绘恢复，不以模型临时编写的状态块为准。';
  entry(10).content+='\n【开场时钟】希罗见面及中央庭交付行动权都属于第7天0分钟固定开场。此时可以交谈、询问、接受或拒绝草莓糖；只有该场景完整结束并已登记DAY7_OPENING完成后，后续由{{user}}实际选择的行动才开始消耗80分钟时段。';
  entry(11).content+='\n【晨间计时锁】小神醒前低语与赛哈姆活骸化、希罗介入完整演出前，时钟固定在08:00。两段各自在真实演出完成后登记标记；希罗现身或刚说第一句话不代表整段已结束。交谈、拒绝保密与追问不计时；离开此段后玩家主动巡查/调查才计时。';
  entry(12).content+='\n【晨间结束标记】第5天起床前小神低语完整出现后登记day5_monologue；中央庭分裂、希罗离开和安托涅瓦倒下实际演完后登记day5_split。两项都已在此前回复完成，后续真正行动才允许时钟推进。';
  entry(13).content+='\n【晨间结束标记】第4天小神醒前低语演完登记day4_monologue；希罗演讲与中央庭应对实际演完登记day4_speech。港湾黑核结算仍按既有条件一次性更新；晨间结算不扣时间。两段未完不计玩家行动耗时。';
  entry(14).content=entry(14).content.replace('任何从第4天跨入第3天的本轮，都必须在提交状态前完成第3天晨间0节点结算；正文中的“第3天晨”只是对已提交状态的呈现。','跨入第3天后先写小神醒前低语及安真实离开的清晨剧情，完成后才提交晨间标记；不在前夜跨日时预先登记完成。');
  entry(14).content+='\n【第三天晨间计时锁】小神自语完成后登记day3_monologue；安确实离开、指挥使发现她不在且追或不追的选择已呈现后登记day3_ann_departure。她的离开不是{{user}}行动，不扣80分钟；追赶分支只有用户真正行动时才按行动实际耗时结算。';
  entry(15).content+='\n【第二天晨间计时锁】醒前小神低语实际演完后登记day2_monologue，时钟保持08:00；探望安托涅瓦是之后由指挥使发起的实际行动，才判断耗时。';
  entry(91).content+='\n【晨间门槛】morning_flags记录第6天至第2天晨间各段已实际演完的事实。第7天DAY7_OPENING、以及当日全部晨间标记尚未在此前消息完成时，不得写入clock_minutes递增；当天固定剧情自身及其对话均0分钟。';
  d.post_history_instructions=d.post_history_instructions.replace('晨间/强制剧情优先；第6天起床前小神低语和赛哈姆活骸化及希罗介入不得跳；第6天首入中央城区演出赛斯。','先查当天开场/晨间固定段是否完整演完：第7天希罗初见及交付行动权，第6天小神与赛哈姆/希罗，第5天小神与中央庭分裂，第4天小神与希罗演讲，第3天小神与安离开，第2天小神。固定段不得跳，时钟保持08:00；第6天首入中央城区演出赛斯。');
  d.post_history_instructions=d.post_history_instructions.replace('晨间/强制剧情优先','晨间/强制剧情优先');
  const guard=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0425-mvu-guard');
  if(!guard)throw Error('MVU guard missing');
  guard.content=guard.content.replace('  const endpoints=new Set(',`  const gates={6:['day6_monologue','day6_saiham'],5:['day5_monologue','day5_split'],4:['day4_monologue','day4_speech'],3:['day3_monologue','day3_ann_departure'],2:['day2_monologue']};
  const morningReady=prior=>prior.day===7?prior.tasks?.DAY7_OPENING?.status==='completed':(gates[prior.day]||[]).every(key=>prior.morning_flags?.[key]===true);
  const endpoints=new Set(`);
  guard.content=guard.content.replace("if(path==='clock_minutes')invalid||=cmd.type!=='set'", "if(path==='clock_minutes'&&next>old)invalid||=!morningReady(prior);\n      if(path==='clock_minutes')invalid||=cmd.type!=='set'");
  guard.content=guard.content.replace("||!/希罗/.test(story);\n      if(path==='morning_flags.day6_seth'","||!/希罗/.test(story)||!/(带走赛哈姆|赛哈姆.{0,16}(?:离开|带走))/.test(story);\n      if(path==='morning_flags.day6_seth'");
  const anchor="      if(path==='morning_flags.day6_monologue'";
  if(!guard.content.includes(anchor))throw Error('morning guard insertion missing');
  guard.content=guard.content.replace(anchor,`      const morningMarkers={day5_monologue:/低语|梦中.*声音|小神/,day5_split:/希罗[\\s\\S]*离开|离开[\\s\\S]*希罗/,day4_monologue:/低语|梦中.*声音|小神/,day4_speech:/希罗[\\s\\S]*演讲|演讲[\\s\\S]*希罗/,day3_monologue:/低语|梦中.*声音|小神/,day3_ann_departure:/安[\\s\\S]*(离开|不见|离去)/,day2_monologue:/低语|梦中.*声音|小神/};
      if(path.startsWith('morning_flags.')&&next===true){
        const key=path.slice('morning_flags.'.length),expected={day5_:5,day4_:4,day3_:3,day2_:2};
        const day=Number(key.match(/^day([2345])_/)?.[1]);
        if(day)invalid||=prior.day!==day||old!==false||!morningMarkers[key]?.test(story);
        if(key==='day5_split')invalid||=!/安托涅瓦/.test(story);
        if(key==='day5_split')invalid||=prior.morning_flags?.day5_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day5_monologue'));
        if(key==='day4_speech')invalid||=prior.morning_flags?.day4_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day4_monologue'));
        if(key==='day3_ann_departure')invalid||=prior.morning_flags?.day3_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day3_monologue'));
      }
      if(path==='tasks.DAY7_OPENING.status'&&next==='completed')invalid||=!/希罗/.test(story)||!/交付|开始行动|指挥使/.test(story);
`+anchor);
  const bridge=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0424-choice-bridge');
  if(!bridge)throw Error('choice bridge missing');
  bridge.content=bridge.content.replace('  const classifyChoices=()=>{',`  let lastKnownStatus=null;
  const ensureStatusHud=()=>{
    const host=window.parent||window;
    const chat=host.SillyTavern?.getContext?.()?.chat;
    if(!Array.isArray(chat)||!chat.length)return;
    const mvu=host.Mvu||window.Mvu;
    let state=null;
    for(let i=chat.length-1;i>=0&&i>=chat.length-6;i--){
      if(chat[i]?.is_user)continue;
      try{state=mvu?.getMvuData?.({type:'message',message_id:i})?.stat_data||null}catch{}
      if(state?.schema==='f7d_textloop_0.4')break;
    }
    if(state?.schema==='f7d_textloop_0.4')lastKnownStatus=state;
    const s=lastKnownStatus;if(!s)return;
    const anchor=doc.querySelector('#send_form')||doc.querySelector('#chat');if(!anchor)return;
    let hud=doc.getElementById('f7d-status-hud-v0428');
    if(!hud){hud=doc.createElement('div');hud.id='f7d-status-hud-v0428';hud.setAttribute('data-f7d-status-hud','1');hud.style.cssText='box-sizing:border-box;width:min(100%,720px);margin:0 auto 4px;padding:7px 12px;border:1px solid #cbd6c7;border-radius:8px;background:#f8faf4;color:#456050;font:600 12px/1.45 system-ui,Microsoft YaHei,sans-serif;text-align:center;pointer-events:none;';}
    if(anchor.id==='send_form'){
      if(anchor.parentElement&&(hud.parentElement!==anchor.parentElement||hud.nextElementSibling!==anchor))anchor.parentElement.insertBefore(hud,anchor);
    }else if(hud.parentElement!==anchor||anchor.lastElementChild!==hud)anchor.appendChild(hud);
    const minutes=Number(s.clock_minutes);if(!Number.isFinite(minutes))return;
    const hh=String(Math.floor(minutes/60)).padStart(2,'0');const mm=String(minutes%60).padStart(2,'0');
    const label='第'+s.day+'天 · '+hh+':'+mm+' · '+String(s.location||'交界都市');
    if(hud.textContent!==label)hud.textContent=label;
  };
  const classifyChoices=()=>{`);
  bridge.content=bridge.content.replace('ensureTheme();scrubLegacyTerminalCounters();normalizePresetShells();','ensureTheme();ensureStatusHud();scrubLegacyTerminalCounters();normalizePresetShells();');
  d.character_version=card.character_version=VERSION;
  d.extensions.qidu_frontend.revision='v0.4.28';
  for(const k of ['description','personality','scenario','first_mes','post_history_instructions','mes_example'])card[k]=d[k];
  return card;
}
