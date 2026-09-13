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
- 世界书知道角色真实姓名，不等于当前轮回的{{user}}知道。\`f7d_state.known\`是当前轮回“可以把某人按真实姓名识别”的权威名单，不是“模型知道有哪些角色”的名单。
- 某角色不在\`known\`时，旁白、说话人标签、战术终端、日志、通讯录均不得直接用真实姓名替{{user}}完成识别。先用稳定外观/位置描述，例如“粉发持刀的女学生”“另一名守在幸存者旁的少女”。
- 身份只可在以下事件后解锁：①本人明确自我介绍；②{{user}}当前已认识且有理由知道其身份的角色当面介绍；③当前轮回已获得的正式资料明确给出姓名与可对应身份。仅凭外貌、角色卡立绘、模型常识、玩家前世/外部知识都不能自动解锁。
- 同一场景内可以先以外观描述，再在本人报出名字或被介绍后改用姓名；名字出现的时间顺序必须晚于识别来源。
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
【高校初见与泰丝拉连续性】
- 第一次进入高校时，{{user}}若尚未获得姓名来源，不得一眼认出珈儿、泰丝拉等陌生神器使。先写外貌、武器、动作与现场位置；等本人自我介绍或由在场已知角色介绍后，才在正文中正式使用姓名并写入\`known\`。
- 高校第2次巡查的核心是找到**珈儿与泰丝拉两人**并组织幸存者撤离。泰丝拉不是“可选区域人物”，不得因为模型更熟悉珈儿就省略、合并成路人或拖到随机事件以后再出现。
- 第2次巡查若两人此前都未被识别，应让身份揭露发生在场景内：先按陌生少女描写，再由本人/彼此介绍名字。结算时若已完成介绍，\`known\`同时加入“珈儿”“泰丝拉”。
- 第3次巡查珈儿迎击强敌并受伤时，泰丝拉的去向必须连续：她可以继续协助撤离、掩护、留守幸存者或被明确安排到别处，但不得毫无说明地从已经在场的剧情里消失。
`);

  const school=findEntry(card,'30｜');
  appendOnce(school,'高校双人初见硬锁',`
【高校双人初见硬锁】
1/6：第一次踏入校园以灾后环境、幸存者和异常为主。遇到陌生神器使时执行“首次识别门禁”，未自报姓名前只用外观/动作描述，不让{{user}}凭空知道谁是珈儿或泰丝拉。
2/6：必须找到**两名关键幸存者/神器使：珈儿 + 泰丝拉**，并推进学生撤离。两人都是本次巡查的实际在场角色，不能写成“珈儿出现，泰丝拉等人之后再说”。若此前姓名未知，先写“粉发持刀的女学生”等描述，再通过自然自我介绍/彼此介绍完成姓名解锁；随后同轮把“珈儿”“泰丝拉”加入\`known\`。
3/6：强敌来袭，珈儿为保护众人爆发力量并受伤；泰丝拉仍需有明确连续动作或明确去向。不能在2/6出现后从叙事里被模型吞掉。

【禁止事项】
- 禁止旁白在自我介绍前直接写“珈儿冲了出来”“泰丝拉站在门边”，除非她们已在本轮\`known\`中。
- 禁止只保留珈儿而省略泰丝拉；高校2/6的双人在场是主线硬锚，不按“随机人物可出现”处理。
- 禁止把两人的行为/台词混成一个人，也不要让泰丝拉只剩一句背景音后永远消失。
`);

  const kaji=findEntry(card,'44｜');
  appendOnce(kaji,'首次出场识别硬锁',`
【首次出场识别硬锁】当前轮回{{user}}尚未获得姓名来源时，即使她的粉发、持刀姿态很有辨识度，旁白也不能直接替{{user}}认出“珈儿”。必须先按陌生女学生/持刀少女描写，等她本人自报姓名、泰丝拉介绍她或其他可靠来源出现后，再正式使用姓名并加入\`known\`。
`);

  const tesla=findEntry(card,'67｜');
  appendOnce(tesla,'高校主线不可省略',`
【高校主线不可省略】高校第2次巡查必须与珈儿一起实际出现并参与撤离，不是“可选/随机露脸”。首次见面同样执行识别门禁：未介绍前不直接报“泰丝拉”；介绍后加入\`known\`。后续若不与队伍同行，必须交代她在护送幸存者、留守、分头行动等具体去向，禁止无说明消失。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'known字段身份语义',`
【known字段身份语义】
- \`known\`只记录“{{user}}在当前轮回已经有合理来源知道其真实姓名/身份的人”。看见某个陌生人≠known；模型认识角色≠known；角色立绘有辨识度≠known。
- 首次自我介绍/被可靠角色介绍后，姓名与正文身份解锁必须同轮原子提交到\`known\`；在此之前日志、终端、通讯录也不得用真名替用户识别。
- 仅认识姓名不等于取得联系方式，通讯录仍需单独事件。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉒首次识别：worldbook知道姓名不等于{{user}}知道；不在f7d_state.known的陌生角色必须先用外观/动作称呼，直到本人自我介绍、可靠角色介绍或本轮正式资料明确识别后才能写真名并加入known。高校2/6珈儿与泰丝拉必须同时实际出现，泰丝拉不得被省略；3/6以后若分开必须交代去向。';
  if(!String(dp.prompt||'').includes('㉒首次识别')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;

  const phi='\n- 【首次识别与高校双人硬锁】不在当前轮known中的人物，旁白不得直接报姓名；先用外貌/动作描述，等自我介绍/可靠介绍后再解锁姓名并原子加入known。高校第2巡查必须同时出现珈儿与泰丝拉并推进撤离；泰丝拉后续若离队必须交代去向，不得无故消失。\n';
  if(!String(card.data.post_history_instructions||'').includes('首次识别与高校双人硬锁')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0419 hash mismatch ${compactSha256}`);
  return {card,raw,compactSha256};
}

export {entryMap};
