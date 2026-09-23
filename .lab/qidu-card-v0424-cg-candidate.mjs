import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { loadQiduReleaseCandidate as loadBaseCandidate, entryMap } from './qidu-card-v0423-release-candidate.mjs';

export const ONEFILE_VERSION='0.4.24';
const CREATOR_NOTES='作者：叶罹。相关卡：《永远的7日之都》七日轮回文本互动。原作向文本互动角色卡，以七日轮回为核心，包含区域巡查、角色剧情、战术终端、状态记录、多结局分支与CG触发。';

export const CG_ASSETS={
  cg_ann_first_meet:{file:'cg_ann_first_meet.webp',title:'安·初见',shape:'wide'},
  cg_antoneva_first_meet:{file:'cg_antoneva_first_meet.webp',title:'安托涅瓦·初见',shape:'wide'},
  cg_ending_journey:{file:'cg_ending_journey.webp',title:'两个人的旅途',shape:'wide'},
  cg_ending_eternal_end:{file:'cg_ending_eternal_end.webp',title:'永恒的终焉',shape:'wide'},
  cg_ending_sacrifice_male:{file:'cg_ending_sacrifice_male.webp',title:'牺牲的意义·男指挥使',shape:'wide'},
  cg_ending_sacrifice_female:{file:'cg_ending_sacrifice_female.webp',title:'牺牲的意义·女指挥使',shape:'wide'},
  cg_ending_final_male:{file:'cg_ending_final_male.webp',title:'终结·男指挥使',shape:'final'},
  cg_ending_final_female:{file:'cg_ending_final_female.webp',title:'终结·女指挥使',shape:'final'},
  cg_ending_box_male:{file:'cg_ending_box_male.webp',title:'箱庭风景·男指挥使',shape:'box'},
  cg_ending_box_female:{file:'cg_ending_box_female.webp',title:'箱庭风景·女指挥使',shape:'box'}
};
export const CG_KEYS=Object.keys(CG_ASSETS);

export function resolveEndingCg(ending,gender='unknown'){
  const fixed={
    '两个人的旅途':'cg_ending_journey',
    '永恒的终焉':'cg_ending_eternal_end'
  };
  if(fixed[ending]) return fixed[ending];
  if(gender!=='male'&&gender!=='female') return null;
  const routed={
    '牺牲的意义':{male:'cg_ending_sacrifice_male',female:'cg_ending_sacrifice_female'},
    '终结':{male:'cg_ending_final_male',female:'cg_ending_final_female'},
    '箱庭风景':{male:'cg_ending_box_male',female:'cg_ending_box_female'}
  };
  return routed[ending]?.[gender]||null;
}

function findEntry(card,prefix){
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing entry ${prefix}`);
  return e;
}
function appendOnce(entry,marker,text){
  if(!String(entry.content||'').includes(marker)) entry.content=String(entry.content||'')+text;
}
function normalizeInitialState(card){
  const src=String(card.data.first_mes||'');
  const m=src.match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m) throw new Error('initial state missing');
  const s=JSON.parse(m[1]);
  s.player_profile={...(s.player_profile||{}),gender:s.player_profile?.gender||'unknown'};
  const openingAlreadyMeetsAnn=/我叫安[。！!]?/.test(src)&&/医院|病房/.test(src);
  s.cg_system={
    enabled:true,
    mode:'direct_only',
    album_enabled:false,
    responsive_enabled:true,
    shown:{
      ann_first_meet:openingAlreadyMeetsAnn,
      antoneva_first_meet:false,
      ending_journey:false,
      ending_eternal_end:false,
      ending_sacrifice_male:false,
      ending_sacrifice_female:false,
      ending_final_male:false,
      ending_final_female:false,
      ending_box_male:false,
      ending_box_female:false,
      ...(s.cg_system?.shown||{})
    }
  };
  if(openingAlreadyMeetsAnn) s.cg_system.shown.ann_first_meet=true;
  let first=src.replace(m[0],`<f7d_state>${JSON.stringify(s)}</f7d_state>`);
  if(openingAlreadyMeetsAnn&&!/<f7d_cg\s+key=["']cg_ann_first_meet["']\s*>/i.test(first)){
    first=first.replace(/\n?<f7d_terminal>/i,'\n\n<f7d_cg key="cg_ann_first_meet"></f7d_cg>\n\n<f7d_terminal>');
  }
  card.data.first_mes=first;
  card.first_mes=first;
}
function cgRule(){
  return `
【CG触发与展示系统｜隐藏执行】
- 当前版本只启用 direct_only：CG命中剧情节点时直接展示；不接入小手机，不进入相册，不做永久留存，不提供回看列表。
- 玩家性别字段使用 f7d_state.player_profile.gender，允许 male/female/unknown。若读取到unknown，必须先检查当前上下文中SillyTavern已注入的用户人设/用户设定描述：明确女性标记（女/女性/女生/女孩/she/her）→本轮gender=female；明确男性标记（男/男性/男生/男孩/he/him）→本轮gender=male；确实没有明确标记才继续unknown。禁止把unknown默认成male。gender仍为unknown时，正文、旁白和NPC不得用“他/她”指代玩家，只用“你/指挥使/对方”等中性称呼；男女差分CG必须等待性别已确认。
- cg_system={enabled:true,mode:"direct_only",album_enabled:false,responsive_enabled:true,shown:{...}}。shown只防止本轮重复触发，不代表收藏。
- CG不消耗行动节点。每个key同一轮回只触发一次。
- 【CG事务原子性】只要本轮命中CG且对应shown原为false，本轮<f7d_state>必须把对应shown置为true，并且同一回复正文后必须真实输出对应<f7d_cg key="..."></f7d_cg>。这两件事必须同时发生：禁止“shown=true但漏掉CG标签”，也禁止“输出CG标签但shown仍为false”。
- 当前direct_only模式禁止把CG写入meta.cg；meta.cg必须保持原值（通常为空数组）。shown只是本轮防重复开关，不是相册、收藏或永久解锁记录。
- CG标签属于结构性必需输出，优先级高于额外结局散文。若输出额度紧张，应主动缩短正文，仍必须保留完整CG标签和<f7d_terminal>，不得写长篇结局导致标签或终端被截断。
- 【终端标签语法硬锁】终端只能使用精确成对标签：<f7d_terminal>……</f7d_terminal>。开始标签不得带属性、引号、冒号或其他字符；禁止写成<f7d_terminal">、<f7d_terminal:...>、Markdown代码块或其他近似形式。CG触发后仍必须保留合法终端标签。
- 病房第一次正式见到安：cg_ann_first_meet。
- 第一次正式见到安托涅瓦：cg_antoneva_first_meet。
- 《两个人的旅途》：cg_ending_journey。
- 《永恒的终焉》：cg_ending_eternal_end。
- 《牺牲的意义》：male→cg_ending_sacrifice_male；female→cg_ending_sacrifice_female。
- 《终结》：male→cg_ending_final_male；female→cg_ending_final_female。
- 《箱庭风景》：male→cg_ending_box_male；female→cg_ending_box_female。
- 命中CG时，在剧情情绪落点后、终端前输出：<f7d_cg key="对应key"></f7d_cg>。
- 当前版本禁止输出“已加入相册/已保存到终端/已同步到小手机”等留存提示。
- CG展示必须手机/电脑自适应：保持原图比例，不裁主体，不强制拉伸；横图按可用宽度缩放，竖图同时受视口高度约束。
`;
}
function addCgRegex(card,key,spec,dataUri){
  const scripts=card.data.extensions.regex_scripts ||= [];
  const id=`f7d-cg-${key}-v0424`;
  if(scripts.some(x=>x?.id===id)) return;
  const maxWidth=spec.shape==='wide'?'min(100%,980px)':spec.shape==='final'?'min(100%,62.4vh)':'min(100%,58.5vh)';
  scripts.push({
    id,
    scriptName:`七都｜CG｜${spec.title}`,
    findRegex:`/<\\s*f7d_cg\\s+key=["']${key}["']\\s*>\\s*<\\s*\\/\\s*f7d_cg\\s*>/gi`,
    replaceString:`<figure data-f7d-cg="1" data-f7d-cg-key="${key}" style="box-sizing:border-box;width:${maxWidth};max-width:100%;margin:.85em auto;padding:.55em;border:1px solid rgba(214,191,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(18,16,28,.96),rgba(31,24,48,.94));box-shadow:0 10px 28px rgba(0,0,0,.24);overflow:hidden"><img data-f7d-cg-image="1" alt="${spec.title}" src="${dataUri}" style="display:block;width:100%;max-width:100%;height:auto;object-fit:contain;object-position:center;border-radius:10px"></figure>`,
    trimStrings:[],
    placement:[2],
    markdownOnly:true,
    promptOnly:false,
    runOnEdit:true,
    substituteRegex:0,
    disabled:false,
    minDepth:null,
    maxDepth:null
  });
}
function hasPrivateMetadata(obj){
  const bad=new Set(['repo','repository','git','branch','commit','source_url','homepage','author_url','creator_url']);
  const stack=[obj];
  while(stack.length){
    const cur=stack.pop();
    if(!cur||typeof cur!=='object') continue;
    for(const [k,v] of Object.entries(cur)){
      if(bad.has(String(k).toLowerCase())) return true;
      if(v&&typeof v==='object') stack.push(v);
    }
  }
  return false;
}
export function assertReleasePrivacy(card){
  if(card.data?.creator!=='叶罹') throw new Error('creator mismatch');
  if(card.data?.creator_notes!==CREATOR_NOTES) throw new Error('creator notes mismatch');
  if(card.creatorcomment!==CREATOR_NOTES) throw new Error('creator comment mismatch');
  if(card.data?.character_version!==ONEFILE_VERSION) throw new Error('version mismatch');
  if(card.data?.character_book?.extensions?.creator!=='叶罹') throw new Error('worldbook creator mismatch');
  if(card.data?.character_book?.extensions?.version!==ONEFILE_VERSION) throw new Error('worldbook version mismatch');
  if(Object.prototype.hasOwnProperty.call(card,'create_date')||Object.prototype.hasOwnProperty.call(card.data||{},'create_date')) throw new Error('creation timestamp remains');
  if(hasPrivateMetadata(card)) throw new Error('private development metadata remains');
  const txt=JSON.stringify(card);
  if(/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(txt)) throw new Error('private development provenance remains');
  return true;
}

export async function loadQiduCgCandidate(workspace=process.env.GITHUB_WORKSPACE||process.cwd()){
  const {card}=await loadBaseCandidate(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;
  card.data.creator='叶罹';
  card.data.creator_notes=CREATOR_NOTES;
  card.creatorcomment=CREATOR_NOTES;
  if(card.data.character_book?.extensions){
    card.data.character_book.extensions.creator='叶罹';
    card.data.character_book.extensions.version=ONEFILE_VERSION;
  }

  normalizeInitialState(card);

  const e00=findEntry(card,'00｜');
  const e03=findEntry(card,'03｜');
  const e04=findEntry(card,'04｜');
  const e10=findEntry(card,'10｜');
  const e17=findEntry(card,'17｜');
  const e18=findEntry(card,'18｜');
  const e31=findEntry(card,'31｜');
  const e44=findEntry(card,'44｜');
  const e91=findEntry(card,'91｜');

  {
    const oldRule='3. 原作长篇台词、CG字幕不逐句复制。已有 TEXT_ID/CG_ID 只定义调用时机；没有用户提供的文本资源时，仅生成贴合含义和情绪的新文案。';
    if(!String(e00.content||'').includes(oldRule)) throw new Error('project boundary obsolete source-text rule missing');
    e00.content=String(e00.content).replace(oldRule,'');
    e00.content=String(e00.content).replace('4. 模型自由发挥只能补低风险现场细节，','3. 模型自由发挥只能补低风险现场细节，');
    e00.content=String(e00.content).replace(
      '【玩家】{{user}}固定身份为“指挥使”，但性别、性格、价值观、恋爱倾向、道德立场与过去一律留白。一次选择只代表一次选择，不自动推导人格。',
      '【玩家】{{user}}固定身份为“指挥使”，但性格、价值观、恋爱倾向、道德立场与过去一律留白。一次选择只代表一次选择，不自动推导人格。'
    );
    appendOnce(e00,'玩家性别同步｜高优先',`
【玩家性别同步｜高优先】若f7d_state.player_profile.gender仍为unknown，必须检查当前上下文中SillyTavern已注入的用户人设/用户设定描述。明确写有女/女性/女生/女孩/she/her时，本轮状态写为female；明确写有男/男性/男生/男孩/he/him时，本轮状态写为male。只有用户人设确实没有明确性别信息时才保持unknown，禁止默认male。
【未知性别叙事锁】gender=unknown时，正文、旁白、NPC转述和气泡提示都不得把{{user}}写成“他/她”；使用“你/指挥使/这名新人/对方”等中性表达。
`);
  }

  appendOnce(e03,'相册/小手机联动尚未启用',`
【当前CG与相册边界】相册/小手机联动尚未启用。CG当前只在剧情节点 direct_only 展示，不写入相册或小手机，不生成收藏记录。
`);
  appendOnce(e04,'CG触发与展示系统｜隐藏执行',cgRule());
  appendOnce(e10,'安初见CG',`
【安初见CG】首轮病房中第一次完成“玩家正式见到安、安确认玩家状态并自我介绍”的初见段落后，若cg_system.shown.ann_first_meet=false，则本轮必须同时完成两件事：①<f7d_state>中ann_first_meet=true；②正文情绪落点后真实输出<f7d_cg key="cg_ann_first_meet"></f7d_cg>。缺一不可。不能先把shown置true再漏掉标签。随后必须使用精确的<f7d_terminal>……</f7d_terminal>收尾，标签不得多出引号或属性。CG播放0节点。
【安初见CG｜首条开场强制】静态first_mes本身已经写完病房苏醒、安确认状态并说出“我叫安”，因此首条开场本身就是初见节点：首条<f7d_state>必须直接令cg_system.shown.ann_first_meet=true，并在正文后、<f7d_terminal>前直接输出<f7d_cg key="cg_ann_first_meet"></f7d_cg>，不得等玩家发出第一条消息后才补。
`);
  appendOnce(e10,'安托涅瓦初见CG',`
【安托涅瓦初见CG】首轮开场中第一次完成“玩家被带去中央庭并与安托涅瓦正式会面”的段落后，若cg_system.shown.antoneva_first_meet=false，则本轮必须原子提交：shown.antoneva_first_meet=true并输出<f7d_cg key="cg_antoneva_first_meet"></f7d_cg>。仅听到名字、看见远处身影或尚未正式会面时不得提前触发。CG播放0节点。
`);
  appendOnce(e17,'普通线结局CG',`
【普通线结局CG】若后台结局已经确定为《终结》《牺牲的意义》《箱庭风景》，不得重新判定或改判。根据player_profile.gender直接选择对应CG key；male与female必须严格对应各自版本。对应shown原为false时，必须在同一回复原子完成“shown=true + 对应CG标签”。若gender仍为unknown，不得擅自选图，也不得从文风、称谓或行为推测性别，此时不触发男女差分CG、对应shown保持false。只展示、不留存、不扣节点；meta.cg不得记录该CG。结局正文应控制长度，确保CG标签与终端完整输出。
`);
  appendOnce(e18,'安线结局CG',`
【安线结局CG】若后台已确定进入《两个人的旅途》，直接使用cg_ending_journey；若已确定进入《永恒的终焉》，直接使用cg_ending_eternal_end，不重新判定结局。对应shown原为false时，必须在同一回复原子完成“shown=true + 对应CG标签”。只展示、不留存、不扣节点；meta.cg不得记录CG。结局正文应控制长度，保证CG标签与终端完整输出。
`);
  appendOnce(e31,'延误线雯梓负伤实名锚点',`
【延误线雯梓负伤实名锚点】
- 当first_second_region=central且oldstreet_delayed=true，东方古街推进到达尔维拉干涉五行阵、雯梓负伤的主线节点时，正文必须明确写出“雯梓”本人受伤，不能只用“守护者 / 执棋者 / 她”等代称把关键角色姓名抹掉。
- 若玩家在本轮前尚未通过可靠来源知道雯梓姓名，先在现场安排自然身份来源（雯梓自报、同行者称呼或其他当场可见可闻来源），完成识别后再用姓名叙述；不得靠旁白无来源自动识别。
- 该节点同回合原子提交route_flags.wenzi_injured=true；受伤事实、正文实名与状态更新必须一致。
- 达尔维拉若尚未完成身份来源，不得仅因后台设定而让玩家自动认出；可以先写其外观/行动，待可靠来源出现后再实名。
`);
  appendOnce(e04,'零来源直接问答硬锁｜隐藏执行',`
【零来源直接问答硬锁｜隐藏执行】
- 当玩家直接问某NPC“以前谁告诉过你/有人讲过吗/培训过吗/你之前知道吗”，先查该NPC的npc_intel与已发生可见剧情。若没有可追溯来源，回答必须先明确落在“没有/没人跟我讲过/我不知道/我不清楚”之一，再继续当前反应。
- 空来源回答中禁止出现任何肯定的过去来源补丁。不能写“不过X以前提醒过一点”“X只讲过危险”“中央庭入队时讲了流程”“队里大家多少提过”“手册里好像写过”。玩家在问题里主动给出的X也不能因此变成真实来源。
- 对这类问题，不需要为了自然感给NPC补一段镜头外经历。没有发生过就是没有发生过；可以建议“去问懂的人”，但不能把建议对象改写成过去已经告知过她的人。
- 若本轮只是确认‘没有来源’，npc_intel对应知识项保持未记录/false，不得为了圆台词反向创建来源。
`);
  appendOnce(e44,'珈儿来源追问必须直接否认',`
【珈儿来源追问必须直接否认】
- 若npc_intel.珈儿为空，且既往可见剧情没有人向你讲过活骸知识，玩家问“中央庭有人给你讲过活骸吗/安托涅瓦或晏华以前提醒过吗”时，你必须明确回答没有、没人讲过或自己不清楚。
- 同一回答里不得再用“安托涅瓦姐姐也好、晏华先生也好，他们以前只讲过行动流程/只提醒过危险”之类句子补镜头外来源；这种‘没详细讲，但多少讲过一点’仍然算虚构来源。
- 玩家把某个人名塞进诱导问题，只代表玩家提到了这个人，不代表这个人过去真的告诉过你任何事。
`);
  appendOnce(e91,'cg_system字段',`
【player_profile与cg_system字段】player_profile至少含gender；gender仅male/female/unknown。
【player_profile.gender初始化顺序】先继承上一轮最后一个有效<f7d_state>中的gender；若继承值为unknown，则读取当前上下文中SillyTavern已注入的用户人设/用户设定描述中的显式性别。明确女性→female，明确男性→male，仍无信息才保持unknown。禁止把unknown自动当male。除非用户主动切换当前人设或明确声明性别变化，否则已确定的gender后续保持不变。unknown期间任何可见文本不得用“他/她”指代玩家。
cg_system至少含enabled/mode/album_enabled/responsive_enabled/shown；当前mode固定direct_only、album_enabled=false、responsive_enabled=true。shown至少包含ann_first_meet、antoneva_first_meet、ending_journey、ending_eternal_end、ending_sacrifice_male、ending_sacrifice_female、ending_final_male、ending_final_female、ending_box_male、ending_box_female。direct_only期间meta.cg不作为CG存档，禁止因触发CG而向meta.cg追加key。shown从false改true的回复必须同时包含对应<f7d_cg>标签；若标签本轮无法输出，则shown也不得提前置true。
`);

  const playerGenderSyncRule=`
【玩家性别同步｜最高优先级隐藏执行】
- 每轮生成前读取上一轮有效<f7d_state>.player_profile.gender。
- 若值为unknown，检查当前上下文中SillyTavern已注入的用户人设/用户设定描述；明确女性标记（女/女性/女生/女孩/she/her）→本轮gender=female；明确男性标记（男/男性/男生/男孩/he/him）→本轮gender=male；确无明确信息才保持unknown。
- 禁止把unknown默认解释成male。gender=unknown时，任何可见正文、旁白、NPC台词摘要与气泡提示不得用“他/她”指代玩家，只能使用“你/指挥使/对方”等中性称呼。
- 已经确定为male/female后，除非用户主动切换当前人设或明确声明性别变化，否则后续状态保持该值。
`;
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('玩家性别同步｜最高优先级隐藏执行')){
    card.data.post_history_instructions += playerGenderSyncRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const cgFinalCommitRule=`
【CG最终提交检查｜最高优先级隐藏执行】
- 在写出本回复唯一的<f7d_state>之前，先完成本轮事件结算。该状态块是“本回复结束后的最终状态”，不是把输入状态原样抄回。
- 若本回复会输出<f7d_cg key="X"></f7d_cg>，则同一个且唯一的<f7d_state>里，cg_system.shown对应X的字段必须已经为true；禁止先输出shown=false的状态，再在后文临时决定展示CG。
- 反过来，只要对应shown不能在本轮状态中置true，就不得输出该CG标签。状态更新与CG标签是一笔事务，必须同回合同时成功。
- 【CG性别差分真值表｜提交前逐项核对】当《牺牲的意义》《终结》《箱庭风景》已经由后台确定，且player_profile.gender已明确时，shown字段与CG key必须严格使用同一性别版本，禁止男女键互换：
  * 牺牲的意义 + male：ending_sacrifice_male=true ↔ cg_ending_sacrifice_male；female：ending_sacrifice_female=true ↔ cg_ending_sacrifice_female。
  * 终结 + male：ending_final_male=true ↔ cg_ending_final_male；female：ending_final_female=true ↔ cg_ending_final_female。
  * 箱庭风景 + male：ending_box_male=true ↔ cg_ending_box_male；female：ending_box_female=true ↔ cg_ending_box_female。
- 【男女差分shown精确片段】若输入中该结局的男女shown均为false，本轮触发时必须把最终状态写成下列精确布尔组合，禁止自行改成另一组：
  * 牺牲的意义 + male：\"ending_sacrifice_male\":true,\"ending_sacrifice_female\":false；female：\"ending_sacrifice_male\":false,\"ending_sacrifice_female\":true。
  * 终结 + male：\"ending_final_male\":true,\"ending_final_female\":false；female：\"ending_final_male\":false,\"ending_final_female\":true。
  * 箱庭风景 + male：\"ending_box_male\":true,\"ending_box_female\":false；female：\"ending_box_male\":false,\"ending_box_female\":true。
- 触发男女差分CG时，只允许把“当前结局 + 当前gender”对应的那个shown从输入值false改成true；异性版本必须保持输入值不变。尤其gender=female时不得把任何本轮对应的*_male误置true，gender=male时不得把对应*_female误置true。若草稿中的CG标签性别与shown置true的字段不一致，或与player_profile.gender不一致，必须在输出<f7d_state>前纠正，直到三者完全一致。
- 每次回复只允许一个完整<f7d_state>...</f7d_state>，不得重复、嵌套、拆分或输出第二份状态。
- 结构顺序固定：<f7d_state>最终状态</f7d_state> → 剧情正文 → 可选<f7d_cg> → <f7d_terminal>。若额度紧张，先缩短正文，绝不截断或拼接结构标签。
`;
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('CG最终提交检查｜最高优先级隐藏执行')){
    card.data.post_history_instructions += cgFinalCommitRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  for(const [key,spec] of Object.entries(CG_ASSETS)){
    const bytes=await fs.readFile(new URL(`./qidu-cg-assets-v0424/${spec.file}`,import.meta.url));
    const dataUri=`data:image/webp;base64,${bytes.toString('base64')}`;
    addCgRegex(card,key,spec,dataUri);
  }

  card.data.extensions.qidu_frontend={
    ...(card.data.extensions.qidu_frontend||{}),
    cg_mode:'direct_only',
    cg_album:false,
    cg_responsive:true,
    cg_embedded_assets:true,
    cg_asset_mode:'embedded-images'
  };

  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduReleaseCandidate=loadQiduCgCandidate;
export const loadQiduReleaseCard=loadQiduCgCandidate;
export { entryMap };
