import fs from 'node:fs';

export const VERSION='0.4.26-mvu-story-repair';
const repair=JSON.parse(fs.readFileSync(new URL('../fixtures/qidu-card/plot-repairs-v0426.json',import.meta.url),'utf8'));

export function repairQiduCard(input){
  const card=structuredClone(input),d=card.data;
  const entries=new Map(d.character_book.entries.map(e=>[e.id,e]));
  for(const [id,content] of Object.entries(repair.entries))if(entries.has(+id))entries.get(+id).content=content;
  d.description=repair.description;
  d.personality=repair.personality;
  d.scenario=repair.scenario;
  d.creator_notes=d.creator_notes.replace(/ 本测试版在 SillyTavern 中需先通过角色[^。]*。旧聊天请保留原卡存档，新版建议新开聊天。/,'');
  const init=d.first_mes.match(/<initvar>([\s\S]*?)<\/initvar>/i);
  if(!init)throw Error('MVU initvar missing');
  const state=JSON.parse(init[1]);
  state.clock_minutes=480;
  state.morning_flags={day6_monologue:false,day6_saiham:false,day6_seth:false};
  const encoded=JSON.stringify(state);
  d.first_mes=d.first_mes.replace(init[0],`<initvar>${encoded}</initvar>`)
    .replace('橙色长发垂到肩前','浅金色长发垂到肩前')
    .replace(/\s*<f7d_terminal>[\s\S]*?<\/f7d_terminal>\s*$/,'\n');
  const initEntry=d.character_book.entries.find(e=>e.name.startsWith('[InitVar]'));
  initEntry.content=JSON.stringify(state,null,2);
  entries.get(11).constant=true;
  entries.get(4).content=`【输出】仅在实际改变变量时输出隐藏的<UpdateVariable>差分；小说式正文随真实事件推进，CG首次触发时出标签，指挥使主动查看时才有<f7d_terminal>，有真实分歧时以原卡<f7d_choices>和<f7d_choice>美化界面给出行动意图。无变化不输出占位空块。\n【隐私】时钟、节点、区域阶段、巡查比例、任务和黑核英文枚举只存在stat_data。正文、台词、终端与选项不能出现clock_minutes、x/6、available、purified、<status>、<char1>或<qiggle>等后台文本。终端把玩家确知的事转写成自然中文，不自动铺在每轮正文后。\n【时钟】08:00至24:00共16小时，按80分钟分12时段。模型按实际行动判断0、80、160分钟等，单一行动不因分多轮回复重复扣时。达到24:00立即强制睡觉、先结算截止，再减一天并重置到08:00；玩家可提前睡觉。第6天醒前必须先演小神低语，然后赛哈姆活骸化及希罗介入；首次进入中央城区必须给赛斯真实的相遇和行动。\n【救援】西比尔救活只能在已实际拜访爱缪莎并完成塔罗占卜、此前取得条件之后，在高校正式冲突中结算。未占卜时不能用临场推理或普通道具逆转。\n【人物】逐人照常驻外貌锚点写发色、发式、服装与可见配件；钟函谷不戴金丝眼镜、不随身拿算盘。普通善意或接近不自动变成圈套，未知身份不提前实名。`;
  entries.get(91).content=`【唯一变量树】stat_data保留loop/day/clock_minutes/morning_flags/route/location/regions/cores/tasks/known/relationships/ann/hiro/route_flags/battle_flags/meta/intel_flags/npc_intel/player_profile/cg_system等。使用_.set('已有路径',旧值,新值);//真实事件逐项更新，不输出完整JSON、旧node_used和patrol计数。初值clock_minutes=480，每80分钟推进，24:00强制跨日归480；固定晨间演出0分钟。\n【硬前置】第6天morning_flags.day6_monologue在醒前小神低语后置true，day6_saiham在赛哈姆活骸化及希罗出现后置true，day6_seth在该日中央城区赛斯现场出现后置true；前项未演不得开始普通行动。sybilla_condition_obtained仅在玩家确实追加调查、爱缪莎实际占卜后置true；sybilla_rescued=true必须读到此前已取得条件。其他黑核、安线、结局、CG的不可逆规则沿用原区域条目。\n【可见性】所有进度与英文枚举只写变量；正文仅陈述场景所见和人物能知道的事。`;
  const workflow=`【七都每轮场景核对｜只在模型内部执行】\n1. 从stat_data核对天数、时钟、当前位置、已演剧情、角色与玩家各自所知。玩家纠错优先修正旧猜测，NPC猜测、选项与内部推演不算既定事实。\n2. 晨间/强制剧情优先；第6天起床前小神低语和赛哈姆活骸化及希罗介入不得跳；第6天首入中央城区演出赛斯。随后再排首轮主线、角色剧情、地区与自由行动。\n3. 根据用户实际行动估算耗时为80分钟的整数倍，短对话/查看/醒前固定事件可为0。临近午夜不把长行动挤入剩余时间；24:00自动睡觉、截止结算、次日08:00。\n4. 人物首次进场按常驻立绘的发色、发式、衣装和配饰写出可见细节；未知身份不越级命名。人物怀疑只限证据，钟函谷不戴金丝眼镜、不随身持算盘，不无故把指挥使写成棋子。\n5. 西比尔救援严格读取此前的爱缪莎占卜与救援条件；黑核净化、路线与结局读各自前置。只给本轮确实发生的变化写UpdateVariable。\n6. 不把变量值、比例、阶段、英文状态或伪手机/独白标签带入正文、台词、终端、选项。选择界面沿用卡内美化并只写行动意图；没有真实选择就不凑选项。\n【MVU变量】<status_current_variable>{{get_message_variable::stat_data}}</status_current_variable>`;
  d.post_history_instructions=workflow;
  d.extensions.depth_prompt={prompt:workflow,depth:0,role:'system'};
  d.mes_example='<START>\n{{user}}: 我去看看中央城区的居民。\n{{char}}: 街边有人正扶起倒下的路牌。赛斯挽起袖子帮忙，转头问你是否愿意先听听附近住户的情况。<f7d_choices><f7d_choice>走近赛斯，询问街区现状</f7d_choice><f7d_choice>先协助疏散路边居民</f7d_choice></f7d_choices>';
  const bridge=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0424-choice-bridge');
  if(bridge)bridge.content=bridge.content.replace('ensureTerminalFallbacks();','');
  const guard=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0425-mvu-guard');
  if(!guard)throw Error('Pinned MVU guard missing');
  let source=guard.content;
  source=source.replaceAll("'stolen'","'lost'");
  source=source.replace('    const user=latestPlayer();',`    const user=latestPlayer();
    const story=String(message||'').replace(/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi,'');
    const enteringDay6=prior.day===6||commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='day'&&parse(c.args?.at(-1))===6);`);
  source=source.replace("if(path==='day')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next!==old-1||old<=1||!/(睡|休息到明天|结束今天|跳过今天)/.test(user);",
`if(path==='day')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next!==old-1||old<=0||!(/(睡|休息到明天|结束今天|跳过今天)/.test(user)||prior.clock_minutes===1440||commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440));
      if(path==='clock_minutes')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next<480||next>1440||(next!==480&&(next<old||(next-old)%80!==0))||(next===480&&old!==480&&!/(睡|休息到明天|结束今天|跳过今天)/.test(user)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='day'));
      if(path==='battle_flags.sybilla_condition_obtained'&&next===true)invalid||=old!==false||!/(追查|调查|占卜|爱缪莎)/.test(user)||!/爱缪莎/.test(story)||!/(塔罗|占卜|牌阵)/.test(story);
      if(path==='battle_flags.sybilla_rescued'&&next===true)invalid||=get(prior,'battle_flags.sybilla_condition_obtained')!==true;
      if(path==='morning_flags.day6_monologue'&&next===true)invalid||=!enteringDay6||!/(小神|低语|梦中.*声音)/.test(story);
      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=!enteringDay6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))||!/赛哈姆/.test(story)||!/活骸/.test(story)||!/希罗/.test(story);
      if(path==='morning_flags.day6_seth'&&next===true)invalid||=!enteringDay6||!/赛斯/.test(story);`);
  if(source===guard.content)throw Error('Guard anchor missing');
  source=source.replace('    for(let i=commands.length-1;i>=0;i--){',`    const midnight=commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440);
    for(let i=commands.length-1;i>=0;i--){`);
  source=source.replace('      if(invalid)commands.splice(i,1);',`      if(invalid)commands.splice(i,1);`);
  source=source.replace('    }\n  }\n  const bind=',`    }
    if(midnight&&prior.day>0&&commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440)){
      if(!commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='day'))commands.push({type:'set',args:['day',String(prior.day-1)],reason:'午夜强制睡觉'});
      commands.push({type:'set',args:['clock_minutes','480'],reason:'次日08:00'});
    }
  }
  const bind=`);
  guard.content=source;
  d.character_version=card.character_version=VERSION;
  d.name=card.name='永远的7日之都｜七日轮回文本互动｜MVU修订版';
  d.extensions.qidu_frontend={...d.extensions.qidu_frontend,progression_mode:'clock_80_minutes',action_nodes:12,
    day_transition:'midnight_forced_or_early_sleep',terminal_mode:'on_explicit_request_only',revision:'v0.4.26'};
  for(const key of ['description','personality','scenario','first_mes','post_history_instructions','mes_example'])card[key]=d[key];
  return card;
}
