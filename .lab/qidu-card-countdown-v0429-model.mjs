import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud} from './qidu-card-morning-hud-v0428.mjs';
import {limitCountdownNarration} from './qidu-card-countdown-v0429.mjs';

const key=process.env.MODEL_API_KEY;if(!key)throw Error('MODEL_API_KEY missing');
const {card:base}=await loadQiduReleaseCandidate(process.cwd(),{skipHashCheck:true});
const card=limitCountdownNarration(addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base))))).data;
const system=[card.personality,card.scenario,card.character_book.entries.filter(e=>e.constant||[10,91].includes(e.id)).map(e=>e.content).join('\n\n'),card.post_history_instructions].join('\n\n');
const prior=card.first_mes+'\n\n安已经说明这里是交界都市，向你介绍中央庭的职责。你听完了，仍坐在病房里。';
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
let response;
try{
  response=await fetch((process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1')+'/chat/completions',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gemini-3-flash-preview',temperature:.2,max_tokens:1600,messages:[{role:'system',content:system},{role:'assistant',content:prior},{role:'user',content:'我点头，继续听安介绍今天要做的事情。'}]})});
}finally{clearTimeout(timer)}
const data=await response.json();if(!response.ok)throw Error(`Model HTTP ${response.status} ${JSON.stringify(data).slice(0,250)}`);
const answer=String(data.choices?.[0]?.message?.content||'');
const visible=answer.split(/<f7d_terminal\b|<f7d_choices\b|<UpdateVariable\b/i)[0];
await fs.mkdir('release-evidence',{recursive:true});await fs.writeFile('release-evidence/qidu-v0429-countdown-model.txt',answer);
const repeated=/(?:倒计时|悬浮(?:的|着)?数字|视野[^。\n]{0,30}(?:数字|[“"]7[”"])|数字[“"]7[”"])/.test(visible);
console.log(JSON.stringify({version:card.character_version,chars:answer.length,repeated,excerpt:visible.slice(0,350)}));
if(repeated)throw Error('Unchanged countdown repeatedly narrated after opening');
