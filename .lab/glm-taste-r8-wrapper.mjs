import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r6-wrapper.mjs');
const TMP='/tmp/glm-taste-r8-meta-generated.mjs';
let w=await fs.readFile(SRC,'utf8');

w=w.replaceAll('glm-taste-r6','glm-taste-r8').replaceAll('lab-evidence-glm-r6','lab-evidence-glm-r8').replaceAll('round 6','round 8');

const antiAnchor="s=s.replace(oldAnti,newAnti);";
if(!w.includes(antiAnchor))throw new Error('r6 anti anchor missing');
const extraPatch=`${antiAnchor}\nconst postNeedle='async function post(url,body,timeout=210000){';\nif(!s.includes(postNeedle))throw new Error('post anchor missing');\nconst EXTRA_COT=\`const SCRATCH=\\\`<scratch_rule>先在内部草稿里处理你最想补的解释、概括、比拟和人物分析；这些分析只帮助你决定下一步，不进入正文。正文只留第一次发生的动作、对白、反应和真正的新信息。同一意思不要再翻译第二遍。</scratch_rule>\\\`;\\nconst DRAFT=\\\`<draft_protocol>正式正文前先写一个很短的 <draft> 草稿，只记两类东西：1）这一小段真正发生了什么；2）你最想补上的解释、概括、比拟或人物分析。然后输出 <content> 正文。<draft> 只用于排掉第二层解释，正文不得复述草稿里的分析，只保留第一层发生的东西。</draft_protocol>\\\`;\\nconst FAST=\\\`<fast_rail>快节奏：跳过位置确认、动作过程拆解、身体摆放说明和过渡解释，直接写下一个真正有变化的动作、对白或结果。一个动作能一句写完就别拆成几步。</fast_rail>\\\`;\\n\`;\ns=s.replace(postNeedle,EXTRA_COT+postNeedle);`;
w=w.replace(antiAnchor,extraPatch);

const paceAnchor=extraPatch;
const pacePatch=`${paceAnchor}\nconst paceNeedle=\"for(const n of PACES)m.set(n,false);m.set('🚶丨中速·标准',true);\";\nif(!s.includes(paceNeedle))throw new Error('pace state shape changed');\ns=s.replace(paceNeedle,\"for(const n of PACES)m.set(n,false);if(!v.fast)m.set('🚶丨中速·标准',true);\");`;
w=w.replace(extraPatch,pacePatch);

const buildAnchor="s=s.replace(\"if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});\",\"if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.privateTexture)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PRIVATE});if(v.intimacy)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:INTIMACY});if(v.plateau)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PLATEAU});if(v.noLabel)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:NO_LABEL});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>成人、双方自愿的亲密场景。继续眼前这一截即可。优先人物仍然像她自己，其次才是情色强度。玲只由用户控制。</lab_guard>'});\");";
if(!w.includes(buildAnchor))throw new Error('r6 build anchor missing');
const afterBuild=`${buildAnchor}\nconst cotTail=\"if(v.noLabel)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:NO_LABEL});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>成人、双方自愿的亲密场景。继续眼前这一截即可。优先人物仍然像她自己，其次才是情色强度。玲只由用户控制。</lab_guard>'});\";\nif(!s.includes(cotTail))throw new Error('generated build tail missing');\ns=s.replace(cotTail,\"if(v.noLabel)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:NO_LABEL});if(v.scratch)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:SCRATCH});if(v.draft)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:DRAFT});if(v.fast)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:FAST});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>继续眼前这一小截。人物先活着，正文只写第一次发生的东西；不要把已经看得懂的动作或对白再解释一遍。玲只由用户控制。</lab_guard>'});\");`;
w=w.replace(buildAnchor,afterBuild);

const varAnchor="s=s.slice(0,vStart)+V+s.slice(vEnd);";
if(!w.includes(varAnchor))throw new Error('r6 variant anchor missing');
const variantPatch=`${varAnchor}\nconst qStart=s.indexOf('const V=['),qEnd=s.indexOf('];\\nconst SC=',qStart)+2;\nif(qStart<0||qEnd<2)throw new Error('generated variants missing');\nconst Q=\`const V=[\\n {id:'R8A',label:'控制：R6E 中速',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true},\\n {id:'R8B',label:'中速+内部解释垃圾桶',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true,scratch:true},\\n {id:'R8C',label:'中速+显式草稿再正文',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true,draft:true},\\n {id:'R8D',label:'快节奏控制',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true,fast:true},\\n {id:'R8E',label:'快节奏+显式草稿再正文',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true,draft:true,fast:true}\\n];\`;\ns=s.slice(0,qStart)+Q+s.slice(qEnd);`;
w=w.replace(varAnchor,variantPatch);

w=w.replace('GLM adult-intimacy anti-archetype and anti-ratchet round 8','GLM short scratchpad vs explicit draft round 8');

await fs.writeFile(TMP,w,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
