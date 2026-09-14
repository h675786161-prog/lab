import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0422Card, entryMap } from './qidu-card-v0422-npc-knowledge.mjs';

export const ONEFILE_VERSION = '0.4.23';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0423 entry ${prefix}`);
  return e;
}
function appendOnce(e, marker, text) {
  if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text;
}

const LOCKED_SECRET_SUPPRESSION = `
【未解锁秘密名词消隐｜隐藏执行】
- “不能透露”不等于“可以在否定句里点名”。只要某秘密层尚未对{{user}}解锁，玩家可见正文、角色台词、旁白、战术终端与选项里都不得主动出现该秘密的专名、身份标签或用于自检的元叙事说明。
- 尤其当\`intel_flags.zero_identity_known=false\`时，不得把“零”作为人名写进可见文本；禁止“没有提到零”“她不知道零”“那不是零”“零的名字仍被保密”这类看似没剧透、实际已经把名字递给玩家的句子。需要回避时直接省略，或只写“更深层的身份信息/那段记录”。普通词“零星”等不受影响。
- 当\`ann_origin_known=false\`时，同理不得用否定句、联想或旁白自检提前写出安的真实来源；当\`loop_truth_known=false\`时，不得提前点出轮回真相、世界重构机制等专名解释。
- 允许模型在隐藏规则与\`f7d_state\`中读取这些锁定项来做判断，但判断结果只能体现为“正文不说”，不能把“我正在避开什么”写给玩家看。
- 一旦对应情报按剧情正式解锁，才恢复正常专名与细节叙述。解锁前宁可少说一句，也不要用否定式泄密来证明自己遵守了保密规则。
`;

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0422Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  // Public card metadata only. Development/runtime provenance is intentionally excluded.
  card.data.creator='叶罹';
  card.data.creator_notes='《永远的7日之都》七日轮回文本互动角色卡。';

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'未解锁秘密名词消隐｜隐藏执行',LOCKED_SECRET_SUPPRESSION);

  const day6=findEntry(card,'11｜');
  appendOnce(day6,'第6天零身份仍锁定时禁止否定式点名',`
【第6天零身份仍锁定时禁止否定式点名】只解锁“活骸存在/过去尝试处置失败/希罗要研究赛哈姆”等当前层时，如果\`zero_identity_known=false\`，正文不要顺手补“没有提到零”“零仍保密”之类说明。那一层的人名与身份直接不出现；等剧情真正解锁后再正常叙述。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'秘密旗标控制可见专名',`
【秘密旗标控制可见专名】\`intel_flags\`中的锁定项不仅控制“事实是否可解释”，也控制“秘密专名是否可出现在玩家可见文本”。例如\`zero_identity_known=false\`时，隐藏状态可以保留该字段，但正文不得把“零”作为人物名出现，连否定式、保密声明和元叙事自检也不行；对应flag转true后才解除。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉘秘密名词消隐：未解锁秘密不得在玩家可见文本中以专名出现，连“没有提到X/仍不知道X/不是X”这种否定式自检也算泄露；zero_identity_known=false时禁止把“零”作为人名写出，普通“零星”等词不受影响。';
  if(!String(dp.prompt||'').includes('㉘秘密名词消隐')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;
  card.data.extensions=ext;

  const phi='\n- 【未解锁秘密名词消隐】锁定秘密在可见正文中连否定式点名都禁止。zero_identity_known=false时不要出现作为人名的“零”，也不要写“没有提到零/零仍保密”等元叙事；直接省略该层。其他锁定身世与轮回真相同理。\n';
  if(!String(card.data.post_history_instructions||'').includes('未解锁秘密名词消隐】锁定秘密')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0423 hash mismatch: ${compactSha256}`);
  return {card,raw,compactSha256};
}

export { entryMap };
