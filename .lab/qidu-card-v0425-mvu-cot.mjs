import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export const VERSION='0.4.25-mvu-cot';
export const MVU_COMMIT='183d8ade3b9a3369e824a55cb13b4ddf91aada50';
const INIT='[InitVar] 七都｜变量初始值';
const UPDATE='[mvu_update] 七都｜逐项结算和推理流程';

const book=(card)=>card.data.character_book.entries;
const by=(card,prefix)=>{const entry=book(card).find(x=>x.name.startsWith(prefix));if(!entry)throw Error(`missing ${prefix}`);return entry;};
const insert=(card,name,content)=>{
  const entries=book(card);const exemplar=by(card,'02｜');
  entries.push({...exemplar,id:Math.max(...entries.map(e=>e.id||0))+1,name,comment:name,content,keys:[],secondary_keys:[],constant:!name.startsWith('[InitVar]'),enabled:!name.startsWith('[InitVar]'),selective:false,insertion_order:999});
};
const regex=(name,pattern,markdownOnly,promptOnly)=>({id:`f7d-${name}`,scriptName:name,disabled:false,runOnEdit:true,findRegex:pattern,trimStrings:[],replaceString:'',placement:[2],substituteRegex:0,minDepth:null,maxDepth:null,markdownOnly,promptOnly});

function guardSource(){return String.raw`(() => {
  const helper=window.TavernHelper||{};
  const eventOn=helper.eventOn||window.eventOn;
  const eventRemoveListener=helper.eventRemoveListener||window.eventRemoveListener;
  const waitGlobalInitialized=helper.waitGlobalInitialized||window.waitGlobalInitialized;
  if(!eventOn||!waitGlobalInitialized)return;
  let active=true;
  const get=(s,path)=>path.split('.').reduce((o,k)=>o?.[k],s);
  const val=x=>Array.isArray(x)&&x.length===2&&typeof x[1]==='string'&&!Array.isArray(x[0])?x[0]:x;
  const parse=x=>{try{return JSON.parse(x)}catch{return x}};
  const latestPlayer=()=>{
    try{const chat=window.parent?.SillyTavern?.getContext?.()?.chat||[];
      return String([...chat].reverse().find(m=>m.is_user)?.mes||'');}catch{return ''}
  };
  const endpoints=new Set(['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途']);
  function protect(variables,commands,message){
    const prior=variables.stat_data||{};if(prior.schema!=='f7d_textloop_0.4')return;
    const user=latestPlayer();
    for(let i=commands.length-1;i>=0;i--){
      const cmd=commands[i],path=String(cmd.args?.[0]||''),old=val(get(prior,path)),next=parse(cmd.args?.at(-1));
      let invalid=!path||path.includes('$')||path==='schema'||path==='node_used'||path.includes('.patrol')||path==='known'&&cmd.type!=='set';
      if(['regions','cores','tasks','ann','route_flags','hiro','battle_flags','intel_flags','npc_intel','relationships','cg_system','meta','player_profile'].includes(path))invalid=true;
      if(path==='day')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next!==old-1||old<=1||!/(睡|休息到明天|结束今天|跳过今天)/.test(user);
      if(path.startsWith('cores.')){
        const zone=path.split('.')[1];
        invalid||=cmd.type!=='set'||!['unknown','available','purified','stolen'].includes(next)||old==='stolen'&&next!==old||old==='purified'&&next!==old;
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
  }
  waitGlobalInitialized('Mvu').then(()=>{if(active)eventOn(window.Mvu.events.COMMAND_PARSED,protect)}).catch(e=>console.warn('[qidu/mvu]',e));
  window.addEventListener('pagehide',()=>{active=false;try{eventRemoveListener?.(Mvu.events.COMMAND_PARSED,protect)}catch{}},{once:true});
})();`}

export function addMvuCot(input){
  const card=structuredClone(input),d=card.data;
  const match=d.first_mes.match(/<f7d_state>([\s\S]*?)<\/f7d_state>/);
  if(!match)throw Error('opening state missing');
  const initial=JSON.parse(match[1]);
  if(initial.node_used!==undefined||Object.values(initial.regions).some(x=>x.patrol!==undefined))throw Error('legacy counter in initial');
  for(const field of ['tasks','relationships','npc_intel'])initial[field].$meta={extensible:true};
  d.first_mes=d.first_mes.replace(match[0],`<initvar>${JSON.stringify(initial)}</initvar>`);
  card.first_mes=d.first_mes;
  d.description=d.description.replace('在七天倒计时与每天12个行动节点内','在七天倒计时与自然推进的剧情里').replace('区域六巡查','区域主线');
  d.scenario='七天倒计时文本游戏。区域剧情按已发生的调查、人物互动和冲突推进；区域解放与黑核净化分开结算。玩家明确睡到次日或主动跳日时先结算期限，再推进日期。希罗等NPC也会在镜头外行动，但玩家未获知的事实不能通过旁白或小剧场泄露。';
  d.mes_example=`<START>
{{user}}: 我先看看战术终端，不做别的。
{{char}}: 安站在一旁，没有催促你。
<f7d_terminal>【战术终端】第7天｜剧情推进中
当前位置：中央庭
任务：完成苏醒后的引导</f7d_terminal>
<UpdateVariable></UpdateVariable>`;
  card.description=d.description;card.scenario=d.scenario;card.mes_example=d.mes_example;
  d.creator_notes+=' 本测试版在 SillyTavern 中需启用 Tavern Helper 3.4.17 或更新版；卡内嵌入固定版本 MVU。旧聊天请保留原卡存档，新版建议新开聊天。';
  card.creator_notes=d.creator_notes;

  const e01=by(card,'01｜');
  e01.content=`【七日状态机】以最近消息 stat_data 为当前轮回状态；每轮仅结算本轮发生的真实事件。重Roll不重复结算，查看终端与 OOC 不推进。只在玩家明确睡到明天/跳日时按期限先结算，再 day-1；day=1不自动变成day=0。区域主线按已演出因果自然收束，不设节点或巡查数字门槛。区域解放与黑核净化各自独立，后者须玩家明确执行并满足所在区域专属条件。`;
  const e03=by(card,'03｜');
  e03.content=e03.content.replace(/区域通常需要累计完整区域主线解放。首次巡查强调[^\n]+第6次解决区域核心危机并解放。区域解放不等于黑核净化。黑核若有额外条件，必须另行完成。/,'区域主线通过灾情调查、人物关系、证据与关键冲突自然收束，收束后结算解放；不同区域不能套用固定巡查次数。区域解放不等于黑核净化，额外条件须另行满足。');
  by(card,'32｜').content+='\n【蜂蜜蛋糕证据边界】蛋糕是丽的偏好与相关人物互动线索。角色可以据反应继续调查；未锚定的“蛋糕导电、蜂蜜形成符文/线路、甜点自动定位或净化黑核”等机制不得凭空制造。找到黑核与执行净化都要实际演出，后者由玩家明确选择。';
  by(card,'04｜').content=`【输出协议｜MVU】剧情正文 → 首次触发时的<f7d_cg key="CG_ID"></f7d_cg> → <f7d_terminal>客观可见战术状态</f7d_terminal> → 如确需玩家决策则输出<f7d_choices>内2～4个自然行动<f7d_choice> → 最后输出隐藏的<UpdateVariable>差分命令。没有状态变化也输出空的<UpdateVariable></UpdateVariable>。
MVU 读取 stat_data 为唯一存档；不要输出<f7d_state>或重写完整JSON。终端逐字段读取 stat_data，未证实的黑核仍为unknown。选项只供点击参考，玩家可自由输入，选项生成本身不改变变量。`; 
  by(card,'91｜').name='91｜MVU状态路径与结算约束';
  by(card,'91｜').content=`【MVU状态路径】唯一状态为 {{get_message_variable::stat_data}}。包含 loop/day/route/location、regions.*.liberated、cores.*、tasks.*、known、relationships、ann、hiro、route_flags、battle_flags、intel_flags、npc_intel、player_profile、cg_system、meta。
只用 _.set('已有路径',旧值,新值);//本轮实际触发事实 修改发生变化的字段。数组字段可整体设值；动态字典已有的键可修改，若新键需先由框架可扩展配置创建。禁止整根覆盖、旧node_used与patrol计数。
黑核只有unknown→available→purified或stolen的真实事件；stolen/purified不逆转。玩家未明确下令净化时不能净化。day只在玩家明确睡到次日或主动跳日后减一；换日前先结算当日限时。安线资格第4天睡到第3天时按当时条件判定，不事后补签。完整结局名单：终结、箱庭风景、牺牲的意义、永恒的终焉、两个人的旅途。
发生的剧情、CG和变量命令必须一致；未来才可得到的线索不能提前写进known/intel_flags，旁白、小剧场与选项也不能提前公开。`;
  for(const entry of book(card)){
    if(entry.name.startsWith('17｜')||entry.name.startsWith('18｜'))entry.content=entry.content.split('【最终状态字面量锁｜')[0].split('【正式结局名不可重写｜')[0];
    if(!entry.name.startsWith('04｜')&&!entry.name.startsWith('91｜'))entry.content=entry.content.replaceAll('<f7d_state>','stat_data').replaceAll('f7d_state.','stat_data.');
    entry.content=entry.content.replace(/本条目若从旧聊天或旧存档带入“巡查次数、消耗\/扣除节点、node_used、patrol”等计数信息[^\n]*\n?/g,'');
    entry.content=entry.content.replace(/- 只要当前`day==4`，且本轮因为`node_used==12`后结束当天、或\{\{user\}\}明确“睡觉\/结束第4天\/进入第3天”，就必须在跨日前执行一次安线资格截止。/g,'- 只要当前day=4且玩家明确睡到第3天或主动跳日，跨日前执行安线资格截止。').replace(/`day=3,node_used=0`/g,'`day=3`');
    entry.content=entry.content.replace(/①stat_data中ann_first_meet=true/g,'①MVU更新cg_system.shown.ann_first_meet=true').replace(/首条stat_data必须直接令/g,'开局MVU变量必须令');
  }
  d.post_history_instructions=`【七都 CoT｜在模型原生推理阶段执行，不在剧情正文或小剧场展示】
1. 对照 stat_data 与玩家本轮原话，列出已经发生且可观察的事实，区分玩家意图、动作及实际结果；玩家熟悉原作不意味着角色已经得知未来。
2. 对每一条将要写出的信息检查来源：当前视角能看到什么、说话角色本人知道什么、玩家已经在剧情中获知什么。尚未开放的世界书背景只作编剧约束，不以旁白、心理、小剧场、选项或终端透露。
3. 先确定本轮场景的目标、必到场角色及其动机，再确定阻碍/后果。让玩家选重大路线、价值观、净化及关系承诺；只为当前可见局面提出行动选项，不替玩家决定。
4. 逐项核对当前日、限时、区域解放、黑核专属条件、安线资格和结局资格。尚未完成的动作不能在变量中当作成功。蜂蜜蛋糕是线索，不自行编造符文、电路、法阵机制。
5. 写自然正文后列出本轮**实际改变**的既有 MVU 路径，旧值必须与 stat_data 一致；没有变化不造变化。每项对应可指认的已演出事件。输出正文、终端/选项后，将 _.set 命令放在隐藏 <UpdateVariable> 里，不输出整份状态。
【输出】绝不输出可见思维链、规则检查记录或未揭晓的后台事实。CG使用原标签。终端展示已确认事实；选择建议不是按钮脚本执行剧情。
【MVU变量】<status_current_variable>{{get_message_variable::stat_data}}</status_current_variable>
【命令格式】<UpdateVariable>\n_.set('regions.school.liberated',false,true);//本轮高校主线收束\n</UpdateVariable>。这只是格式例子，未发生时不得更新。数组新值写有效JSON。`; 
  card.post_history_instructions=d.post_history_instructions;
  d.extensions.depth_prompt.prompt='七都：以最新 stat_data 为唯一账本，先按 CoT 核对玩家行动、角色知识和已演出的后果，再写正文与隐藏的 <UpdateVariable> 差分；禁止旧 f7d_state、节点/六巡查计数、未解锁信息泄露。';
  insert(card,INIT,JSON.stringify(initial,null,2));
  insert(card,UPDATE,`MVU只处理回复末尾的 <UpdateVariable>。先理解当前 <status_current_variable>{{get_message_variable::stat_data}}</status_current_variable>，然后按正文真实演出的事件逐项 _.set('路径',旧值,新值);//原因。仅写变化路径。不要写完整快照；旧值与现值保持一致。玩家未输入时选项不是行动。`);

  const scripts=d.extensions.tavern_helper.scripts;
  scripts.push({type:'script',enabled:true,name:'七都｜MVU变量框架（固定版本）',id:'qidu-v0425-mvu',content:`import 'https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@${MVU_COMMIT}/artifact/bundle.js'`,info:'需要 Tavern Helper 3.4.17+；网络需能访问 gcore.jsdelivr.net',button:{enabled:false},data:{},export_with:true});
  scripts.push({type:'script',enabled:true,name:'七都｜MVU不可逆结算守卫',id:'qidu-v0425-mvu-guard',content:guardSource(),info:'在 MVU 解析命令后过滤越权的关键状态更新',button:{enabled:false},data:{},export_with:true});
  for(const [label,tag] of [['MVU初始化', 'initvar'],['MVU差分','UpdateVariable']]){
    const re=`/<${tag}>[\\s\\S]*?(?:<\\/${tag}>|$)/gi`;
    d.extensions.regex_scripts.unshift(regex(`七都｜${label}提示词隐藏`,re,false,true));
    d.extensions.regex_scripts.unshift(regex(`七都｜${label}显示隐藏`,re,true,false));
  }
  d.character_version=VERSION;card.character_version=VERSION;
  d.extensions.qidu_frontend={...d.extensions.qidu_frontend,state_backend:'mvu',mvu_commit:MVU_COMMIT,cot:'five_step_native_reasoning'};
  return card;
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const [source,target]=process.argv.slice(2);if(!source||!target)throw Error('usage: node builder input.json output.json');
  const card=addMvuCot(JSON.parse(await fs.readFile(source,'utf8')));
  const json=JSON.stringify(card);await fs.writeFile(target,json);
  console.log(JSON.stringify({version:VERSION,bytes:Buffer.byteLength(json),sha256:crypto.createHash('sha256').update(json).digest('hex'),target}));
}
