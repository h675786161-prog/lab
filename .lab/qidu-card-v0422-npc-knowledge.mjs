import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0421Card, entryMap } from './qidu-card-v0421-encounter-focus.mjs';

export const ONEFILE_VERSION = '0.4.22-lab-npc-knowledge';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0422 entry ${prefix}`);
  return e;
}
function appendOnce(e, marker, text) {
  if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text;
}

const NPC_KNOWLEDGE = `
【NPC知识来源门禁｜隐藏执行】
- 世界书中的客观真相、{{user}}已经获得的intel_flags、以及NPC本人知道什么，是三套不同信息。绝对禁止因为“模型知道”“玩家知道”“角色是神器使/中央庭成员”就自动把秘密塞进NPC脑内。
- NPC准备说出活骸、黑核、轮回、人物身世等非公开事实时，必须有明确来源：角色条目直接写明其知情；或当前/既往剧情中本人亲眼经历；或有明确台词/通讯把该信息告诉过她。没有来源时默认“不知道/不确定”，不能自行补一段合理化背景。
- \`known\`只表示{{user}}已经完成人物身份识别，不表示该NPC知道任何秘密；\`intel_flags\`只记录{{user}}获得的知识，不能被NPC自动继承。
- “被告知基础层”只解锁被告知的那一层。例如只听说“存在活骸化/会失控”，不等于知道发生机制、是否必然、具体征兆、第一活骸事故、零、希罗研究细节或中央庭内部处置历史。
- 若玩家追问超出NPC知识范围的问题，角色应按人设自然承认不清楚、只说自己亲历/被告知的部分，或建议去问真正知情者。禁止为了让回答显得完整而擅自补齐设定。
`;

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0421Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'NPC知识来源门禁｜隐藏执行',NPC_KNOWLEDGE);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'高校新生神器使知识边界',`
【高校新生神器使知识边界】珈儿成为神器使时间不长。高校主线时期，她首先知道的是自己的战斗体验、眼前怪物威胁与被明确告知的基础事项；不要因为她是神器使就默认她懂活骸化、第一活骸、零、中央庭内部研究或末日真相。若尚无剧情来源，她对这些问题应保持不清楚。
`);

  const day6=findEntry(card,'11｜');
  appendOnce(day6,'活骸情报不自动广播给全队',`
【活骸情报不自动广播给全队】赛哈姆事件与希罗说明只让现场亲历/实际被告知的人获得对应情报。{{user}}的intel_flags更新后，珈儿、泰丝拉等不在场或未被告知的角色不能同步获得知识。之后若{{user}}明确告诉某人，只按实际说出的内容更新该角色认知，不顺带解锁更深秘密。
`);

  const kaji=findEntry(card,'44｜');
  appendOnce(kaji,'活骸知识边界',`
【活骸知识边界】
- 珈儿刚成为神器使不久，对神器使体系中的隐秘风险并没有天然完整知识。高校阶段默认她不清楚“活骸化”的系统机制，也不知道第一活骸、零、希罗研究史、中央庭早期事故与完整处置规则。
- 她可以描述自己亲身感觉到的幻力、战斗状态、受伤与异常，但不能把主观感觉自动解释成“活骸征兆”，除非剧情中已有可靠知情者明确说明。
- 即使{{user}}已经知道活骸真相，只要没有把相关内容告诉珈儿，她就不能通过陪同/入队/同属中央庭而自动同步。
- 若有人只告诉她“神器使可能发生一种叫活骸化的失控现象”，她之后最多知道这一基础事实；不得自行补出“所有神器使最终都会这样”、具体机制、零的身份或第一事故细节。
- 被问到超出已知范围时，按珈儿性格自然表达“不太清楚/没人详细告诉我/这得问安托涅瓦或真正知情的人”等，不要为了显得博学而编造答案。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'玩家知识不等于NPC知识',`
【玩家知识不等于NPC知识】\`intel_flags\`仅代表{{user}}已获得的信息权限，任何字段变true都不能作为NPC自动知情的依据。NPC知识必须回到角色条目与剧情来源判定；没有明确来源就保持未知。\`known\`同样只表示{{user}}认得该角色，不携带知识共享语义。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉗NPC知识来源：玩家intel_flags和模型后台真相绝不自动复制给NPC；角色只有条目明示、本人亲历或剧情明确被告知才可知情。珈儿是刚成为神器使不久的新人，前期不默认懂活骸机制/必然性/第一活骸/零/希罗研究；只知道被明确告诉的层级，超出则承认不清楚。';
  if(!String(dp.prompt||'').includes('㉗NPC知识来源')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;
  card.data.extensions=ext;

  const phi='\n- 【NPC知识来源门禁】玩家知道≠NPC知道；intel_flags不得自动广播。珈儿作为刚成为神器使不久的新人，不默认掌握活骸化机制、必然性、第一活骸/零或希罗研究。只允许角色使用条目明示、本人亲历或剧情明确告知的信息，超出部分保持未知。\n';
  if(!String(card.data.post_history_instructions||'').includes('NPC知识来源门禁】玩家知道')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0422 hash mismatch: ${compactSha256}`);
  return {card,raw,compactSha256};
}

export { entryMap };
