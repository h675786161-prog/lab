export const VERSION='0.4.29-countdown-cadence';

export function limitCountdownNarration(input){
  const card=structuredClone(input),d=card.data;
  const init=d.first_mes.match(/<initvar>([\s\S]*?)<\/initvar>/);
  if(!init)throw Error('Missing initial MVU state');
  const state=JSON.parse(init[1]);
  state.intel_flags.countdown_initial_mentions=1;
  state.intel_flags.countdown_last_narrated_day=7;
  d.first_mes=d.first_mes.replace(init[0],`<initvar>${JSON.stringify(state)}</initvar>`);
  const anchor='陌生的房间，陌生的少女，窗外则是一座像刚经历过灾难的城市。';
  if(!d.first_mes.includes(anchor))throw Error('Opening scene insertion point missing');
  d.first_mes=d.first_mes.replace(anchor,anchor+'\n\n你眨了眨眼，视野里短暂浮出一个淡淡的数字“7”。它没有挡住眼前的人，却仍停留在那里。');
  d.alternate_greetings=d.alternate_greetings.map((g,i)=>i===0?g.replace('晨光照进病房。','晨光照进病房。视野边缘有一个淡淡的数字“7”，眨眼后也没有消失。'):g);
  const entries=d.character_book.entries;
  const initEntry=entries.find(e=>e.name.startsWith('[InitVar]'));
  if(!initEntry)throw Error('InitVar worldbook entry missing');
  initEntry.content=JSON.stringify(state,null,2);
  const ten=entries.find(e=>e.id===10),ninetyOne=entries.find(e=>e.id===91);
  if(!ten||!ninetyOne)throw Error('Countdown worldbook entries missing');
  ten.content+='\n【视野倒计时的叙事频率】病房初醒时已写过一次数字“7”；苏醒段落最多再自然提及一次，不围绕它反复提示。随后不因镜头转移、交谈、巡查、战斗或普通行动重述视野里的数字，也不让旁白定期检查它。仅倒计时数值真正变化时可在正文短暂写一次变化；其余由stat_data保存，正文与终端都不循环播报。若玩家明确问起，只回答当下问题，不借此每轮重放视觉描写。';
  ninetyOne.content+='\n【倒计时出镜判定】intel_flags.countdown_initial_mentions初始为1（开场已描写）；countdown_last_narrated_day初始为7。首日初醒额外提及最多一次，之后仅在day变化且玩家实际感知到数字变化时更新countdown_last_narrated_day并短述一次；同一天的普通场景不输出倒计时描写。不要为镜头强调而改变计数或伪造数字减少。';
  d.post_history_instructions=d.post_history_instructions.replace('1. 从stat_data核对天数、时钟、当前位置、已演剧情、角色与玩家各自所知。','1. 从stat_data核对天数、时钟、当前位置、已演剧情、角色与玩家各自所知。视野数字“7”已在首个开场出现：首日最多再短提一次；之后仅倒计时真实减少或其他数值变化时在正文短写一次，同日其余回复完全不复述。');
  d.character_version=card.character_version=VERSION;
  d.extensions.qidu_frontend.revision='v0.4.29';
  for(const k of ['description','personality','scenario','first_mes','post_history_instructions','mes_example'])card[k]=d[k];
  return card;
}
