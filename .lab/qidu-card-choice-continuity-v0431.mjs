export const VERSION='0.4.31-choice-continuity';

export function preserveUnchosenActions(input){
  const card=structuredClone(input),d=card.data;
  const entry=id=>d.character_book.entries.find(e=>e.id===id);
  const rule='【上轮选项不可代选】上一轮给了参战、救人、追赶、净化、调查、答应或拒绝等选项后，只以{{user}}下一条实际输入决定执行哪项。若{{user}}改为问话、观察或另提行动，就让现场危险按角色与环境的能力继续存在或发展，不能把未选的战斗/救援写成{{user}}或同伴已经替{{user}}完成。NPC可独立防守或示警，但不能用一句“怪物清理干净了”消除上一轮未处理的冲突。等待选择不额外耗时、不把提议当成果。';
  for(const id of [4,31,32,91])entry(id).content+='\n'+rule;
  d.post_history_instructions=d.post_history_instructions.replace('玩家纠错优先修正旧猜测，NPC猜测、选项与内部推演不算既定事实。','玩家纠错优先修正旧猜测，NPC猜测、选项与内部推演不算既定事实。上一轮的可选战斗/救援没有被玩家选中时，不能在本轮开头写成已经打完或救完；先读玩家本轮实际动作。');
  d.character_version=card.character_version=VERSION;
  d.extensions.qidu_frontend.revision='v0.4.31';
  for(const k of ['description','personality','scenario','first_mes','post_history_instructions','mes_example'])card[k]=d[k];
  return card;
}
