export const VERSION='0.4.27-preset-choice-compat';

export function addPresetChoiceCompatibility(source){
  const card=structuredClone(source), d=card.data;
  d.alternate_greetings=d.alternate_greetings.map(s=>s.replace('橙发少女安','浅金发少女安'));
  const entries=d.character_book.entries;
  const output=entries.find(e=>e.id===4);
  if(!output)throw Error('Qidu output entry missing');
  output.content=output.content.replace(
    '有真实分歧时以原卡<f7d_choices>和<f7d_choice>美化界面给出行动意图。',
    '有真实分歧时给出行动意图。未启用预设选项时用<f7d_choices>和<f7d_choice>；预设已要求<branches>时只用其<branches>，不要再复制一份<f7d_choices>。两种格式都由卡的选项界面呈现。'
  )+'\n【选项兼容】选项只供{{user}}参考，尚未选择就不改变时间、关系或任务。预设要求固定数量时，不得为凑数虚构已知情报、替{{user}}说话或写成行动成功；仅列当前确实能尝试的行动，不足时减少数量或略去。正文只写已发生的事。';
  d.post_history_instructions=d.post_history_instructions.replace(
    '选择界面沿用卡内美化并只写行动意图；没有真实选择就不凑选项。',
    '有真实分歧才写行动意图：预设要求<branches>时只出该块，否则只出卡内<f7d_choices>，同轮不得双出；两者统一用卡内美化。选项未被玩家执行前不计时、不更新变量；没有真实选择就不凑选项。'
  );
  const bridge=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0424-choice-bridge');
  if(!bridge)throw Error('Qidu choice bridge missing');
  const anchor='  const scrubLegacyTerminalCounters=()=>{';
  if(!bridge.content.includes(anchor))throw Error('Choice bridge insertion point missing');
  bridge.content=bridge.content.replace(anchor,`  const parseRawBranches=raw=>{
    const block=String(raw||'').match(/<branches\\b[^>]*>([\\s\\S]*?)<\\/branches>/i)?.[1];
    if(!block)return [];
    return block.replace(/<details\\b[^>]*>|<\\/details>|<summary\\b[^>]*>[\\s\\S]*?<\\/summary>/gi,'')
      .replace(/<[^>]*>/g,'').split(/\\r?\\n/)
      .map(line=>line.trim().replace(/^(?:[A-F][.．、:：]|\\d+[.．、]|[-*])\\s*/i,''))
      .filter(line=>line.length>=2 && line.length<=300)
      .filter(line=>!/^(?:options|plans|activity|parallel)\\s*[:：]|^(?:说明|选项内容\\d+|剧情分支)\\s*[:：]?$/i.test(line))
      .slice(0,6);
  };
  const normalizeRawBranches=()=>{
    if(busy())return;
    const chat=context()?.chat;
    if(!Array.isArray(chat))return;
    for(const mes of doc.querySelectorAll('#chat > .mes[mesid]')){
      const text=mes.querySelector('.mes_text');
      if(!text||text.querySelector('[data-f7d-choice-grid="1"]'))continue;
      const message=chat[Number(mes.getAttribute('mesid'))];
      if(!message||message.is_user)continue;
      const options=parseRawBranches(message.mes);
      if(options.length>=2)text.appendChild(makeGrid(options));
    }
  };
`+anchor);
  bridge.content=bridge.content.replace('normalizePresetShells();classifyChoices();','normalizePresetShells();normalizeRawBranches();classifyChoices();');
  bridge.content=bridge.content.replace('setComposer,normalizePresetShells,ensureTerminalFallbacks','setComposer,normalizePresetShells,normalizeRawBranches,ensureTerminalFallbacks');
  if(!bridge.content.includes('normalizeRawBranches();classifyChoices();'))throw Error('Choice refresh hook missing');
  const scripts=d.extensions.regex_scripts;
  if(!scripts.some(s=>s.scriptName==='七都｜预设分支显示隐藏')){
    const template=scripts.find(s=>s.scriptName==='七都｜MVU差分显示隐藏');
    scripts.splice(4,0,{...template,id:'f7d-v0427-preset-branches-hide',scriptName:'七都｜预设分支显示隐藏',findRegex:'/<branches\\b[^>]*>[\\s\\S]*?(?:<\\/branches>|$)/gi',replaceString:''});
  }
  d.character_version=card.character_version=VERSION;
  d.extensions.qidu_frontend.revision='v0.4.27';
  for(const key of ['post_history_instructions','description','personality','scenario','first_mes','mes_example'])card[key]=d[key];
  return card;
}
