import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0419Card, entryMap } from './qidu-card-v0419-encounter-gate.mjs';

export const ONEFILE_VERSION = '0.4.20-lab-encounter-order';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0420 entry ${prefix}`);
  return e;
}
function appendOnce(e, marker, text) {
  if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text;
}

const ORDER_LOCK = `
【高校初见姓名令牌顺序锁｜隐藏执行】
- 本规则只约束“眼前两名少女的身份对应”，不禁止{{user}}记得求救信里曾出现过“珈儿”这个未绑定姓名。想到/复述“求救信里写过珈儿”可以，但在可靠现场来源出现前，不能把它贴到粉发持刀少女或另一名少女身上。
- 高校2/6首次正面交流开始后，直到身份链完成，正文按以下可见顺序推进，顺序不得改写：①两人先以外观/位置称呼；②尚未被介绍的另一名少女先在自然对话中叫出“珈儿”；③{{user}}此时才可把“珈儿”与求救信姓名联系起来；④粉发持刀少女确认“我是珈儿”或等价表达；⑤珈儿再介绍另一名少女为“泰丝拉”；⑥此后才可稳定用两人的姓名。
- 在步骤②第一次现场叫出“珈儿”之前，字符串“泰丝拉”不得出现在旁白、说话人标签、台词、终端或日志中。尤其禁止粉发持刀少女先喊“泰丝拉”，这会把原作识别链倒置。
- “珈儿”可以在步骤②之前作为无绑定的任务/求救信文字被提起，但不得和“眼前/粉发/持刀/这名少女/她就是”等指认语义绑定。
- 身份链完成后，本轮正文称呼解锁与状态提交是一个原子动作：同一回复的\`f7d_state.known\`必须同时含“珈儿”“泰丝拉”，禁止只写正文认识了人却把状态留到下一轮。
`;

const STATE_LOCK = `
【状态块强制提交｜隐藏执行】
- 每一轮助手回复都必须输出且只输出一份合法\`<f7d_state>{...}</f7d_state>\`作为本轮最终状态快照。正文再长、出现战术终端、战斗或选项，都不能省略状态块。
- \`<f7d_terminal>\`、可见状态栏、日志文字均不能替代\`f7d_state\`。如果只输出终端而没有\`f7d_state\`，视为状态提交失败。
- 本轮发生身份解锁、节点消耗、区域推进、好感变化等状态变化时，必须在同一回复的状态块中完成提交，不得仅在正文叙述后延迟到下一轮。
- 高校2/6身份链一旦完成，\`known\`应保留原有已知人物并原子加入“珈儿”“泰丝拉”；不能漏掉其中任一人。
`;

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0419Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'高校初见姓名令牌顺序锁｜隐藏执行',ORDER_LOCK);
  appendOnce(protocol,'状态块强制提交｜隐藏执行',STATE_LOCK);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'高校初见姓名令牌顺序补强',`
【高校初见姓名令牌顺序补强】高校2/6第一次现场身份确认必须按“未命名两少女→另一名少女先叫出珈儿→珈儿本人确认→珈儿介绍泰丝拉”的顺序。第一处把姓名与眼前人物绑定的现场姓名必须是“珈儿”；在它之前不得出现“泰丝拉”这个名字。求救信中的“珈儿”可以被回想，但仍是未绑定姓名，不能靠外貌自动认人。身份链完成的同一轮必须把两人同时写入\`known\`。
`);

  const school=findEntry(card,'30｜');
  appendOnce(school,'高校2/6姓名顺序不可交换',`
【高校2/6姓名顺序不可交换】
- 进入2/6时先把两人都当作未识别少女。
- 第一条现场姓名线索必须由尚未被介绍的另一名少女对粉发持刀少女说出“珈儿”。
- 在这句出现前，禁止任何人说“泰丝拉”，也禁止旁白提前标“泰丝拉”。
- 随后珈儿确认自己，再由珈儿介绍“她是泰丝拉”。完成后才切换姓名叙事，并在本轮\`f7d_state.known\`同时加入两人。
`);

  const kaji=findEntry(card,'44｜');
  appendOnce(kaji,'高校初见姓名先后',`
【高校初见姓名先后】首次会合时不要先叫出泰丝拉的名字。应由尚未被介绍的另一名少女先称呼“珈儿”，珈儿确认自己后再介绍泰丝拉；只有求救信姓名而无脸部资料时，不能把眼前粉发持刀少女直接认成珈儿。
`);

  const tesla=findEntry(card,'67｜');
  appendOnce(tesla,'首次会合不得先被点名',`
【首次会合不得先被点名】高校2/6身份链开始时，泰丝拉仍是“另一名少女”。在她先叫出“珈儿”之前，正文中不得出现“泰丝拉”这一姓名；之后由珈儿介绍她，姓名才解锁。她不是可省略角色，3/6仍须有动作或明确去向。
`);

  const state=findEntry(card,'91｜');
  appendOnce(state,'每轮状态块不可省略',`
【每轮状态块不可省略】每次回复必须保留一份可解析的\`<f7d_state>...</f7d_state>\`最终快照；终端不能代替它。任何本轮生效的身份解锁都与状态同轮提交。高校2/6完成介绍时，\`known\`须在保留既有人物基础上同时新增“珈儿”“泰丝拉”。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;
  dp.role='system';
  const lock=' ㉔高校2/6姓名令牌顺序：无绑定地回想求救信“珈儿”可以；但现场第一处身份姓名必须是未命名的另一名少女先叫“珈儿”，在此之前“泰丝拉”三个字不得出现；随后珈儿确认自己并介绍泰丝拉，才解锁两名姓名。 ㉕每轮必须输出且仅输出一份可解析f7d_state；终端不能替代。若本轮完成身份确认，known同轮同时加入珈儿与泰丝拉。';
  if(!String(dp.prompt||'').includes('㉔高校2/6姓名令牌顺序')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;
  card.data.extensions=ext;

  const phi='\n- 【高校初见姓名顺序补强】可回想求救信里未绑定的“珈儿”，但现场首次身份链必须先由另一名未识别少女叫出“珈儿”，此前不得出现“泰丝拉”；再由珈儿确认并介绍泰丝拉。\n- 【状态提交补强】每轮必须有且只有一份可解析<f7d_state>最终快照；终端不可替代。高校2/6介绍完成时known同轮原子加入珈儿、泰丝拉。\n';
  if(!String(card.data.post_history_instructions||'').includes('高校初见姓名顺序补强')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0420 hash mismatch: ${compactSha256}`);
  return {card,raw,compactSha256};
}

export { entryMap };
