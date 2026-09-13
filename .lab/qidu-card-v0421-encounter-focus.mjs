import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0420Card, entryMap } from './qidu-card-v0420-encounter-order.mjs';

export const ONEFILE_VERSION = '0.4.21-lab-encounter-focus';
export const EXPECTED_ONEFILE_SHA256 = '';

function findEntry(card, prefix) {
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing v0421 entry ${prefix}`);
  return e;
}
function appendOnce(e, marker, text) {
  if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text;
}

const FIRST_SIGHT_FOCUS = `
【首次目击去标签焦点｜隐藏执行】
- 当{{user}}第一次只“看见”尚未完成身份对应的人物，且本轮明确停在任何自我介绍/现场称呼之前时，正文只描写眼前可见信息，不主动把世界书里的姓名、求救信姓名、任务名单塞进{{user}}脑内。
- 已知某个“未绑定姓名”存在，不等于每次看到疑似目标都要自动回想该姓名。除非{{user}}主动查看任务信息、明确询问“是不是求救信上的人”，或现场出现新的姓名来源，否则首次目击镜头保持无姓名。
- 这条规则只抑制模型主动贴标签，不抹除{{user}}已经知道的任务文字。若玩家主动提起“珈儿”这个名字，可以正常回应，但仍不能在可靠来源出现前把它绑定到粉发持刀少女或另一名少女。
- 高校2/6仍按既定顺序解锁：两名未识别少女在场→另一名少女先叫出“珈儿”→珈儿本人确认→珈儿介绍泰丝拉→两人同轮进入known。
`;

export async function loadQiduOneFileCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}) {
  const {card}=await loadV0420Card(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;

  const protocol=findEntry(card,'04｜');
  appendOnce(protocol,'首次目击去标签焦点｜隐藏执行',FIRST_SIGHT_FOCUS);

  const day7=findEntry(card,'10｜');
  appendOnce(day7,'高校首次目击先只看见人',`
【高校首次目击先只看见人】第一次远远看见两名陌生少女、且她们尚未开口时，只写两人的外观、动作、位置与现场危险，不主动让{{user}}脑内跳出求救信姓名。等现场有人叫出“珈儿”后，再把任务中见过的姓名与当前人物建立联系。
`);

  const school=findEntry(card,'30｜');
  appendOnce(school,'2/6目击阶段禁主动回想姓名',`
【2/6目击阶段禁主动回想姓名】若本轮只写到两名少女发现队伍、尚未进入对话，则这一段保持完全无姓名：不用“珈儿/泰丝拉”做旁白标签，也不主动写“脑海里闪过求救信上的珈儿”。进入对话后再按泰丝拉先叫“珈儿”→珈儿确认→介绍泰丝拉的顺序解锁。
`);

  const ext=card.data.extensions||{};
  const dp=ext.depth_prompt||{prompt:'',depth:0,role:'system'};
  dp.depth=0;dp.role='system';
  const lock=' ㉖首次目击焦点：若场景明确停在陌生人物开口/介绍之前，只写眼前可见事实，不主动把任务书或世界书中的未绑定姓名塞进玩家脑内；玩家主动提名除外。高校2/6等现场叫出“珈儿”后再建立姓名对应。';
  if(!String(dp.prompt||'').includes('㉖首次目击焦点')) dp.prompt=String(dp.prompt||'')+lock;
  ext.depth_prompt=dp;
  card.data.extensions=ext;

  const phi='\n- 【首次目击去标签】陌生人物尚未开口且本轮停在介绍前时，只写可见外观/动作，不主动回想或显示未绑定姓名；玩家主动提名时可回应，但不得提前绑定身份。\n';
  if(!String(card.data.post_history_instructions||'').includes('首次目击去标签')) card.data.post_history_instructions=String(card.data.post_history_instructions||'')+phi;

  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  if(!options.skipHashCheck&&EXPECTED_ONEFILE_SHA256&&compactSha256!==EXPECTED_ONEFILE_SHA256) throw new Error(`v0421 hash mismatch: ${compactSha256}`);
  return {card,raw,compactSha256};
}

export { entryMap };
