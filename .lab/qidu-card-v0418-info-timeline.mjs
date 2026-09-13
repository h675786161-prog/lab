import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0417Card, entryMap } from './qidu-card-v0417-knowledge-gate.mjs';

export const ONEFILE_VERSION = '0.4.18-lab-info-timeline';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0418 entry ${prefix}`);
  return e;
}
function appendOnce(e,marker,text){ if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text; }

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0417Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'指挥使能力边界与信息措辞',`
【指挥使能力边界与信息措辞】
- 原作公开定义：神器使是操纵神器的战斗专家；指挥使是为神器使提供特殊战斗补给、幻力调度并承担战术协调的异能力者。
- 指挥使非常重要，但神器使并非离开指挥使就完全不会战斗。禁止写“没有指挥使，神器使就是一盘散沙”“没有指挥使就无法战斗/毫无用处”等绝对化表述。
- 更准确的写法是：缺少指挥使的供给与协调会显著降低持续作战、组织防御和大规模行动效率；神器使仍保有自己的战斗能力、判断与行动意志。
- NPC解释制度时只说当前已知职责，不得借题提前说明末日、轮回、全员活骸等未来秘密。
`);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'第7天新手说明措辞锁',`
【第7天新手说明措辞锁】
- 介绍神器使/指挥使时，不得用“没指挥使就是一盘散沙”一类贬低神器使独立战斗能力的比喻。
- 可说：神器使是战斗专家；指挥使能为他们提供特殊战斗补给并统筹作战，因此中央庭需要新的指挥使协助组织防御。
- 这一阶段不得把城市危机说成“还剩七天”；{{user}}眼前的数字7只能被描写为来源不明、仅自己可见的悬浮数字。
`);

  const antoneva=findEntry(card,'41｜');
  appendOnce(antoneva,'第一活骸事故精确披露',`
【第一活骸事故精确披露】
- 只有第6天赛哈姆事件后、{{user}}实际向安托涅瓦坦白/追问她为何坚持处理活骸时，才允许她讲这段过去。
- 她必须明确这是“第一个出现的活骸/第一名活骸”的事故，而不是“发现活骸化之后又有一名神器使失控”。原作层级事实：第一个活骸无法控制自己，在城市中大肆破坏；中央庭派出三人小队阻止，最终两人死亡，幸存者安托涅瓦失去双腿；该活骸最后在巨大痛苦中自我毁灭。
- 这一层只称“第一个活骸/它/那个活骸”，不要使用“他/她”去擅自确定当时玩家尚未知晓的身份，也不要说出“零”。
- “第一个活骸就是零”“零主动让自己成为研究样本”等必须继续由后续安托涅瓦/希罗/零/相关调查明确揭露，不能在这段创伤讲述里顺带剧透。
`);

  const day6=findEntry(card,'11｜');
  appendOnce(day6,'第一活骸事故分层用词',`
【第一活骸事故分层用词】
- 安在赛哈姆事件后只可说“第一次发现神器使会活骸化时，中央庭曾尝试解除，但失败了”，以及安托涅瓦因此定下处理规则；安不得代讲第一活骸的完整身份。
- 若{{user}}随后向安托涅瓦坦白并追问，安托涅瓦才明确说“第一个活骸出现时……”并讲三人小队、两人死亡、自己失去双腿、自毁结局。
- 这两层不要混成同一句，也不要把“第一次发现活骸化”和“另一个神器使后来失控”写成两个不同事故。
`);

  const hiro=findEntry(card,'43｜');
  appendOnce(hiro,'早期指挥使措辞',`
【早期指挥使措辞】
- 第7天至正式分裂前，希罗是中央庭建立者、资深指挥使，也是{{user}}出现之前中央庭唯一的指挥使。可以讨论安托涅瓦在削减个人崇拜、寻找新指挥使来分担权力与责任，但不能把这件事说成“我现在已经不是指挥使”。
- 正式分裂后应写“希罗离开中央庭/不再代表中央庭行动”，而不是“失去指挥使身份”。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0; dp.role='system';
  const lock=` ㉑早期设定措辞：神器使没有指挥使时仍能独立战斗，不得说“一盘散沙/无法战斗”；第6天安托涅瓦被追问时才可把第一活骸事故明确为“第一个活骸”，讲三人小队两死一伤且自己失去双腿，但此时仍不说“零”，也不用他/她提前锁定身份。`;
  if(!String(dp.prompt||'').includes('早期设定措辞：')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;

  const phi=`\n- 【早期设定精确措辞】神器使是可独立战斗的战斗专家，指挥使提供特殊战斗补给/幻力调度与战术协调；禁写“没有指挥使就是一盘散沙/不能战斗”。第6天安托涅瓦的创伤披露必须明确“第一个活骸”的事故层，但在零身份解锁前只称“它/那个活骸”，不得提前说零。\n`;
  if(!String(card.data.post_history_instructions||'').includes('早期设定精确措辞')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0418 hash mismatch ${compactSha256}`);
  return {card,raw,compactSha256};
}

export {entryMap};
