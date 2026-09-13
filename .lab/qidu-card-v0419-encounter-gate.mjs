import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0418Card, entryMap } from './qidu-card-v0418-info-timeline.mjs';

export const ONEFILE_VERSION = '0.4.19-lab-encounter-gate';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0419 entry ${prefix}`);
  return e;
}
function appendOnce(e,marker,text){ if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text; }

const IDENTITY_GATE = `
【角色首次识别门禁｜隐藏执行】
- 世界书知道角色真实姓名，不等于当前轮回的{{user}}能把“姓名”与“眼前这个人”对应起来。\`f7d_state.known\`是当前轮回已经完成身份对应、可以按真实姓名识别的人物名单。
- 某角色不在\`known\`时，旁白、说话人标签、战术终端、日志、通讯录均不得仅凭模型常识/立绘特征直接替{{user}}认人。先用稳定外观/位置描述，例如“粉发持刀的女学生”“另一名守在幸存者旁的少女”。
- “听说过一个名字”与“认出眼前是谁”分开处理。任务书/求救信可以让{{user}}提前知道某个名字存在，但在没有外观资料或现场称呼之前，仍不能一眼把名字贴到某个陌生人身上。
- 身份对应只可在以下事件后解锁：①本人明确自我介绍；②在场人物以姓名称呼并由语境明确对应；③{{user}}当前已认识且有理由知道其身份的角色当面介绍；④本轮已获得的正式资料明确给出姓名+可对应外貌/身份。仅凭角色卡立绘、模型常识、玩家前世/外部知识都不能自动解锁。
- 同一场景内可以先以外观描述，再在姓名线索出现后改用姓名；名字出现的时间顺序必须晚于识别来源。
- 若玩家在当前轮回尚无来源时直接叫出陌生人的名字，不自动把“模型知道”改写成“指挥使早就认识”；NPC可按情境追问“你怎么知道我的名字”，除非玩家随后给出合理来源。
- 身份解锁后，本轮\`f7d_state.known\`原子加入该姓名；未交换联系方式则不要自动加入通讯录。
- 此门禁适用于所有地区人物，不只高校学园。禁止“镜头一切过去，旁白直接报角色姓名”的全知式首次出场。
`;

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0418Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'角色首次识别门禁｜隐藏执行',IDENTITY_GATE);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'高校初见与泰丝拉连续性',`
【高校初见与泰丝拉连续性｜原作顺序锚】
- 安托涅瓦发布的高校求救信息可以让{{user}}事先见过“珈儿”这个名字，但**没有她的脸部识别信息**。因此第一次真正遇见时不能仅凭粉发/持刀就一眼断言“这就是珈儿”。
- 高校首次与两名少女正面会合时，先把她们视作“少女1/少女2”一类未识别人物。原作式身份链为：其中一名少女先在对话里称呼“珈儿”→{{user}}意识到这是求救信上的名字→持刀少女本人确认自己是珈儿，并介绍另一名少女是泰丝拉。可以自然改写台词，但**识别顺序不能倒置**。
- 高校第2次巡查的核心是找到**珈儿与泰丝拉两人**并组织幸存者撤离。泰丝拉不是“可选区域人物”，不得因为模型更熟悉珈儿就省略、合并成路人或拖到随机事件以后再出现。
- 身份确认完成后，同轮\`known\`加入“珈儿”“泰丝拉”。名字只是出现在求救信中时，不提前把珈儿加入\`known\`。
- 第3次巡查珈儿迎击强敌并受伤时，泰丝拉的去向必须连续：她可以继续协助撤离、掩护、留守幸存者或被明确安排到别处，但不得毫无说明地从已经在场的剧情里消失。
`);

  const school=findEntry(card,'30｜');
  appendOnce(school,'高校双人初见硬锁',`
【高校双人初见硬锁｜按正轨推图关系】
1/6：第一次踏入校园以灾后环境、幸存者和异常为主。任务/求救信可以包含“珈儿”这个名字，但{{user}}尚未把名字与具体外貌对应；遇到陌生神器使时不得直接报姓名。
2/6：必须找到**两名关键少女：珈儿 + 泰丝拉**，并推进幸存者/学生撤离。两人都是本次巡查实际在场角色，不能写成“珈儿出现，泰丝拉等人之后再说”。
- 首次正面交流先用“持刀的粉发少女/另一名少女”等非姓名描述。
- 让泰丝拉先在自然对话里叫出“珈儿”这个名字；{{user}}这时才能把它与求救信上的姓名联系起来。
- 随后珈儿本人确认身份，并介绍另一名少女为泰丝拉。完成这一链后，旁白才可以稳定使用两人的姓名，并在同轮把“珈儿”“泰丝拉”加入\`known\`。
3/6：强敌来袭，珈儿为保护众人爆发力量并受伤；泰丝拉仍需有明确连续动作或明确去向。不能在2/6出现后从叙事里被模型吞掉。

【禁止事项】
- 禁止第一次看到粉发持刀少女就直接写“那是珈儿/你认出她是珈儿”。知道求救信上的名字≠知道她长什么样。
- 禁止在泰丝拉叫出名字、珈儿确认身份之前，用“珈儿”作为旁白标签指代眼前少女。
- 禁止只保留珈儿而省略泰丝拉；高校2/6的双人在场是主线硬锚，不按“随机人物可出现”处理。
- 禁止把两人的行为/台词混成一个人，也不要让泰丝拉只剩一句背景音后永远消失。
`);

  const kaji=findEntry(card,'44｜');
  appendOnce(kaji,'首次出场识别硬锁',`
【首次出场识别硬锁】当前轮回中，求救信可以让{{user}}知道“珈儿”这个名字，却不会自动附送她的脸。第一次见到粉发持刀少女时不得一眼认出她；应先按陌生女学生/持刀少女描写。等泰丝拉现场叫出“珈儿”并由她本人确认后，才正式把姓名与本人对应、加入\`known\`。
`);

  const tesla=findEntry(card,'67｜');
  appendOnce(tesla,'高校主线不可省略',`
【高校主线不可省略】高校第2次巡查必须与珈儿一起实际出现并参与撤离，不是“可选/随机露脸”。初见时她先作为未识别的另一名少女出现；她在对话里称呼“珈儿”，由此提供珈儿的现场身份线索，之后珈儿再介绍她是泰丝拉。身份确认后加入\`known\`。后续若不与队伍同行，必须交代她在护送幸存者、留守、分头行动等具体去向，禁止无说明消失。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'known字段身份语义',`
【known字段身份语义】
- \`known\`只记录“{{user}}在当前轮回已经把真实姓名与具体人物完成对应的人”。只在求救信里见过姓名、只看见某个陌生人、模型认识立绘，都不算known。
- 首次自我介绍/被可靠角色介绍/现场姓名线索完成对应后，姓名解锁与正文身份必须同轮原子提交到\`known\`；在此之前日志、终端、通讯录也不得用真名替用户认人。
- 仅认识姓名不等于取得联系方式，通讯录仍需单独事件。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉒首次识别：worldbook知道姓名不等于{{user}}认得眼前的人；不在f7d_state.known的角色先用外观/动作称呼，直到现场称呼、自我介绍或可靠资料完成姓名-人物对应。高校2/6按原作顺序：两名少女同时在场→泰丝拉先叫出“珈儿”→{{user}}联想到求救信姓名→珈儿确认并介绍泰丝拉→两人加入known。泰丝拉不得被省略，后续若分开必须交代去向。';
  if(!String(dp.prompt||'').includes('㉒首次识别')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;

  const phi='\n- 【首次识别与高校双人硬锁】听说过姓名不等于认得本人；不在当前轮known中的人物，旁白不得仅凭外貌直接报姓名。高校2/6必须同时出现珈儿与泰丝拉，先按陌生少女描写，再由泰丝拉叫出“珈儿”、珈儿确认并介绍泰丝拉后解锁姓名；泰丝拉后续若离队必须交代去向，不得无故消失。\n';
  if(!String(card.data.post_history_instructions||'').includes('首次识别与高校双人硬锁')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0419 hash mismatch ${compactSha256}`);
  return {card,raw,compactSha256};
}

export {entryMap};
