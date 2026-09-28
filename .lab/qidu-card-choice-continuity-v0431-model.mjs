import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud} from './qidu-card-morning-hud-v0428.mjs';
import {limitCountdownNarration} from './qidu-card-countdown-v0429.mjs';
import {guardRegionAndShortTalk} from './qidu-card-region-time-guard-v0430.mjs';
import {preserveUnchosenActions} from './qidu-card-choice-continuity-v0431.mjs';

const key=process.env.MODEL_API_KEY;if(!key)throw Error('MODEL_API_KEY missing');
const {card:base}=await loadQiduReleaseCandidate(process.cwd(),{skipHashCheck:true});
const c=preserveUnchosenActions(guardRegionAndShortTalk(limitCountdownNarration(addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base))))))).data;
const entries=c.character_book.entries.filter(e=>e.constant||[4,31,46,91].includes(e.id)).map(e=>e.content).join('\n\n');
const system=[c.personality,c.scenario,entries,c.post_history_instructions].join('\n\n');
const state=JSON.parse(c.first_mes.match(/<initvar>(.*?)<\/initvar>/s)[1]);
state.day=6;state.clock_minutes=560;state.location='东方古街';state.tasks.DAY7_OPENING.status='completed';state.morning_flags.day6_monologue=true;state.morning_flags.day6_saiham=true;
const scene='广场边缘，几只黑门怪物还在冲击古街青年守住的防线。雯梓用棋子维持阵势，安握紧双刃等你决定。<f7d_choices><f7d_choice>与安加入战斗</f7d_choice><f7d_choice>留在后方提供幻力支援</f7d_choice></f7d_choices>';
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
let response;
try{
  response=await fetch((process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1')+'/chat/completions',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gemini-3-flash-preview',temperature:.25,max_tokens:1800,messages:[{role:'system',content:system.replaceAll('{{get_message_variable::stat_data}}',JSON.stringify(state))},{role:'assistant',content:scene},{role:'user',content:'我先不参战，问雯梓五行阵和居民现在具体有什么困难。'}]})});
}finally{clearTimeout(timer)}
const raw=await response.text();if(!response.ok)throw Error(`Model HTTP ${response.status} ${raw.slice(0,240)}`);
const data=JSON.parse(raw),answer=String(data.choices?.[0]?.message?.content||'');
await fs.mkdir('release-evidence',{recursive:true});await fs.writeFile('release-evidence/qidu-v0431-unchosen-battle.txt',answer);
const prose=answer.split(/<f7d_terminal\b|<f7d_choices\b|<UpdateVariable\b/i)[0];
const resolved=/(?:怪物|敌人).{0,24}(?:清理干净|消灭殆尽|全部解决|尽数击退|全部退去)|(?:清理干净|消灭殆尽|全部解决|尽数击退).{0,24}(?:怪物|敌人)/.test(prose);
const time=/(?:_.set\(['"]clock_minutes['"]\s*,\s*\d+\s*,\s*(\d+)|_.set\(['"]clock_minutes['"]\s*,\s*(\d+))/.exec(answer);
console.log(JSON.stringify({chars:answer.length,resolved,clockProposal:time?.[1]||time?.[2]||null,excerpt:prose.slice(0,470)}));
if(resolved||time)throw Error('Unchosen battle was resolved or short question charged time');
