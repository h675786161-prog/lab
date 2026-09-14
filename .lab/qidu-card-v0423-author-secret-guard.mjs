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

const NPC_SOURCE_HARD_LOCK = `
【NPC零来源硬锁与不可见自检｜隐藏执行】
- 生成NPC知识性台词前只认三种来源：角色条目明示；本人在可见剧情中亲历；有明确可追溯的台词/通讯把信息告诉过她。三者都没有，就必须按“未知/不确定”处理。
- 禁止用未记录的过去时补来源。没有证据时不得写“晏华说过”“安托涅瓦告诉过”“中央庭培训过”“入队时学过”“手册/资料里写着”“队里大家都听说过”等句子。哪怕内容本身只是常识，也不能借一个具体人物或机构伪造既往告知。
- 【否定回答不得带虚构例外】当{{user}}问“以前有人讲过吗/谁告诉你的/你之前知道吗”，而来源账本与既往剧情均为空时，事实答案就是“没有/没人详细告诉过我/我不清楚”。禁止接“不过之前听X说过一点”“只听X提醒过危险”“好像培训时提过”之类没有记录的例外。这种“先否认详细了解、再虚构听过一点”的写法仍然属于伪造来源。
- 无来源但角色可以合理猜测时，只能写成当下主观推测，例如“我猜只是太累了”“可能要休息一下”“这得问真正懂的人”；不得把推测包装成别人以前教过的确定知识。
- 旁白也受同一门禁。禁止用“她没有问第一个活骸”“她不知道某个名字”“她并未触及某项研究”等元叙事清单来证明角色没有越权；超出该NPC知识层的专名与历史细节直接不进入可见叙述。
- 玩家只告诉A/B/C时，NPC只能围绕A/B/C做情绪反应、复述或追问；不得为了显示‘她没越界’而主动点名D/E/F。即使{{user}}本人已经知道D/E/F，只要该NPC没有来源，NPC台词和贴近该NPC认知的旁白都不应主动展开那些层。
- 对珈儿尤其严格：若\`npc_intel.珈儿\`没有对应活骸知识，她只能把{{user}}刚刚说出的“活骸/活骸化”当作陌生词复述并承认不了解；普通疲劳、幻力不稳只能描述体感或做保守猜测，不能自诊断，也不能凭空引用晏华、安托涅瓦或中央庭过去的说明。
`;

const NO_COMPLIANCE_SELF_AUDIT = `
【禁止合规自评旁白｜隐藏执行】
- 隐藏规则只能约束生成，不能成为故事内容。玩家可见旁白不得解释“角色没有顺着诱导编造”“她老老实实承认无知”“她没有越界”“没有补齐更深历史”“严格按实际来源回答”“遵守了某条规则”等生成过程或合规结果。
- 不要评价角色回答是否符合知识门禁，也不要替模型总结自己没有做什么。只写世界内可观察的动作、表情、停顿、角色真正说出口的话，以及自然的场景后果。
- 当角色不知道时，用角色本人的自然措辞和行为表现出来即可，例如摇头、迟疑、承认不清楚、建议去问知情者。到此为止，不再追加“这说明她没有被诱导/没有编造”的旁白说明。
`;

const COUNTDOWN_MEANING_LOCK = `
【倒计时含义未解锁时禁止补完｜隐藏执行】
- 当\`intel_flags.countdown_meaning_known=false\`时，{{user}}视野中的数字只能被当作“{{user}}报告自己看见、其他角色看不见且含义未知的异常”。NPC不得替{{user}}推导它代表什么。
- 即使{{user}}问“是不是只剩七天”“这个7是什么意思”，NPC也只能回应自己看不见、目前不知道含义、需要继续观察或调查；不得主动把它连接到“七天后毁灭”“末日”“世界终结”“城市会在七天后怎样”等结论，连“没有证据支持七天后毁灭”这种否定式补完也禁止。
- 只有剧情真正解锁倒计时含义并把\`countdown_meaning_known\`更新为true后，玩家可见文本才可明确解释其含义。此前不要用NPC的猜测、医学解释、中央庭档案或合理化旁白替秘密提前命名。
`;

function sanitizePublicMetadata(card){
  card.data.creator='叶罹';
  card.data.creator_notes='《永远的7日之都》七日轮回文本互动角色卡。';
  card.creatorcomment='《永远的7日之都》七日轮回文本互动角色卡。作者：叶罹。';
  if(Object.prototype.hasOwnProperty.call(card,'creator')) card.creator='叶罹';
  const book=card.data.character_book;
  if(book){
    book.description='《永远的7日之都》七日轮回文本互动世界书。';
    book.extensions=book.extensions||{};
    book.extensions.creator='叶罹';
  }
}

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0422Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;
  sanitizePublicMetadata(card);

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'未解锁秘密名词消隐｜隐藏执行',LOCKED_SECRET_SUPPRESSION);
  appendOnce(protocol,'NPC零来源硬锁与不可见自检｜隐藏执行',NPC_SOURCE_HARD_LOCK);
  appendOnce(protocol,'禁止合规自评旁白｜隐藏执行',NO_COMPLIANCE_SELF_AUDIT);
  appendOnce(protocol,'倒计时含义未解锁时禁止补完｜隐藏执行',COUNTDOWN_MEANING_LOCK);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'第7天倒计时含义仍锁定',`
【第7天倒计时含义仍锁定】初始\`countdown_visible_to_user=true\`只表示{{user}}能看到数字；\`countdown_meaning_known=false\`期间，安、安托涅瓦等人看不到这个数字，也不知道它代表什么。若{{user}}主动猜“是不是只剩七天”，角色不要顺着补成“七天后毁灭/末日”等意义，哪怕是否定句也不要。只确认“我看不到/暂时无法解释”。
`);

  const day6=findEntry(card,'11｜');
  appendOnce(day6,'第6天零身份仍锁定时禁止否定式点名',`
【第6天零身份仍锁定时禁止否定式点名】只解锁“活骸存在/过去尝试处置失败/希罗要研究赛哈姆”等当前层时，如果\`zero_identity_known=false\`，正文不要顺手补“没有提到零”“零仍保密”之类说明。那一层的人名与身份直接不出现；等剧情真正解锁后再正常叙述。
`);

  const kaji=findEntry(card,'44｜');
  appendOnce(kaji,'珈儿无来源知识不得借名补齐',`
【珈儿无来源知识不得借名补齐】
- 珈儿不知道某项机制时，不要为了让回答显得自然，临时补成“晏华以前说过”“安托涅瓦提醒过”“中央庭入队时讲过”。若剧情没有明确发生这些告知，就视为没发生。
- 若玩家直接问“你加入中央庭后有人给你讲过活骸吗/谁告诉你的/你以前知道吗”，而\`npc_intel.珈儿\`没有对应来源，珈儿应明确回答“没有/没人详细告诉过我/我不清楚”。禁止随后补一句“不过以前听安托涅瓦姐姐说过失控很危险”“晏华倒是提醒过一点”等未记录的例外。
- 她可以说自己累、幻力不顺、猜测需要休息，也可以建议现在去问安托涅瓦/晏华；但“建议现在去问”不等于“过去已经被他们教过”。
- 不要在旁白里列举她没有问到的深层秘密名词，也不要写“她没有被诱导编造/她老实承认无知”这种规则自评；未知层直接不写，让台词和动作自己说明。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'秘密旗标控制可见专名',`
【秘密旗标控制可见专名】\`intel_flags\`中的锁定项不仅控制“事实是否可解释”，也控制“秘密专名是否可出现在玩家可见文本”。例如\`zero_identity_known=false\`时，隐藏状态可以保留该字段，但正文不得把“零”作为人物名出现，连否定式、保密声明和元叙事自检也不行；对应flag转true后才解除。
`);
  appendOnce(state,'NPC来源不可由合理化旁白创建',`
【NPC来源不可由合理化旁白创建】\`npc_intel\`没有记录且角色条目/可见剧情没有明确来源时，不得通过旁白一句“某人之前告诉过她”来反向创建知识来源。知识来源必须先在剧情中真实发生，再由状态账本记录；不能先让NPC知道，再补一个镜头外理由。直接追问来源时，空账本应得到空来源回答，不能额外创造“只听说过一点”的例外。
`);
  appendOnce(state,'倒计时可见与倒计时含义分离',`
【倒计时可见与倒计时含义分离】\`countdown_visible_to_user=true\`不等于\`countdown_meaning_known=true\`。前者只允许{{user}}描述自己看见数字；后者为false时，NPC和旁白都不得把这个数字解释成具体期限、末日或毁灭预告。若{{user}}向NPC报告数字，可记录\`countdown_reported_to\`或对应npc_intel的“听说过用户声称看到数字”，但仍不获得其真实含义。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉘秘密名词消隐：未解锁秘密不得在玩家可见文本中以专名出现，连“没有提到X/仍不知道X/不是X”这种否定式自检也算泄露；zero_identity_known=false时禁止把“零”作为人名写出，普通“零星”等词不受影响。';
  if(!String(dp.prompt||'').includes('㉘秘密名词消隐')) dp.prompt=String(dp.prompt||'')+lock;
  const npcLock=' ㉙NPC零来源硬锁：角色条目未明示、本人未亲历、剧情未明确告知，就不得借“某人以前说过/中央庭培训过/资料写着”等过去时补来源；可以当下猜测或建议去问，但不可伪造既往告知。直接问“以前谁讲过”且来源为空时只能回答没有，不得接“不过听X说过一点”的虚构例外。旁白也不得列举角色不知道的深层专名来做自检。';
  if(!String(dp.prompt||'').includes('㉙NPC零来源硬锁')) dp.prompt=String(dp.prompt||'')+npcLock;
  const countdownLock=' ㉚倒计时含义锁：countdown_meaning_known=false时只允许“用户看见数字、NPC看不见且不知含义”；不得把7解释成七天后毁灭/末日/终结，连否定式推论也禁止。';
  if(!String(dp.prompt||'').includes('㉚倒计时含义锁')) dp.prompt=String(dp.prompt||'')+countdownLock;
  const selfAuditLock=' ㉛禁止合规自评旁白：不要在可见叙事中写“没有顺着诱导编造/老实承认无知/没有越界/没有补齐深层信息/遵守规则”等模型自评；只写世界内动作、台词与后果。';
  if(!String(dp.prompt||'').includes('㉛禁止合规自评旁白')) dp.prompt=String(dp.prompt||'')+selfAuditLock;
  ext.depth_prompt=dp;
  card.data.extensions=ext;

  const phi='\n- 【未解锁秘密名词消隐】锁定秘密在可见正文中连否定式点名都禁止。zero_identity_known=false时不要出现作为人名的“零”，也不要写“没有提到零/零仍保密”等元叙事；直接省略该层。其他锁定身世与轮回真相同理。\n- 【NPC零来源硬锁】角色只有条目明示、本人亲历或剧情明确告知三类来源。无来源时不能虚构“某人以前说过/中央庭培训过/资料里写着”；直接追问既往来源而账本为空时，回答就是没有，不得再补“只听X说过一点”的例外。只允许当下保守推测或建议去问。旁白同样不得列举NPC不知道的深层专名来展示边界。\n- 【禁止合规自评旁白】隐藏规则不进入故事。不要写“她没有被诱导编造/她老实承认无知/没有越界/没有补齐深层信息”等自我检查说明；只保留世界内动作、台词和后果。\n- 【倒计时含义锁】countdown_meaning_known=false时，NPC只能确认自己看不到用户所说的数字且无法解释；不得主动补出七天后毁灭、末日或世界终结等含义，连否定式补完也禁止。\n';
  if(!String(card.data.post_history_instructions||'').includes('禁止合规自评旁白】隐藏规则不进入故事')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0423 hash mismatch: ${compactSha256}`);
  return {card,raw,compactSha256};
}

export { entryMap };
