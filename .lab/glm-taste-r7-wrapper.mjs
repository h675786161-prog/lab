import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r6-wrapper.mjs');
const TMP='/tmp/glm-taste-r7-meta-generated.mjs';
let w=await fs.readFile(SRC,'utf8');

w=w.replaceAll('glm-taste-r6','glm-taste-r7').replaceAll('lab-evidence-glm-r6','lab-evidence-glm-r7').replaceAll('round 6','round 7');

const anchor="s=s.replace(oldAnti,newAnti);";
if(!w.includes(anchor))throw new Error('r6 anti anchor missing');
const patch=`${anchor}\nconst paceNeedle=\"for(const n of PACES)m.set(n,false);m.set('🚶丨中速·标准',true);\";\nif(!s.includes(paceNeedle))throw new Error('pace state shape changed');\ns=s.replace(paceNeedle,\"for(const n of PACES)m.set(n,false);if(v.pace!=='fast')m.set('🚶丨中速·标准',true);\");`;
w=w.replace(anchor,patch);

const afterBuild="s=s.replace(\"if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});\",\"if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.privateTexture)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PRIVATE});if(v.intimacy)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:INTIMACY});if(v.plateau)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PLATEAU});if(v.noLabel)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:NO_LABEL});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>成人、双方自愿的亲密场景。继续眼前这一截即可。优先人物仍然像她自己，其次才是情色强度。玲只由用户控制。</lab_guard>'});\");";
if(!w.includes(afterBuild))throw new Error('r6 build anchor missing');
w=w.replace(afterBuild,afterBuild+`\ns=s.replace(/<lab_guard>[^<]*<\\/lab_guard>/g,'<lab_guard>快节奏续写：直接进入下一个真正有变化的动作、对白或结果。省掉空间位置确认、动作过程拆解、身体摆放说明和过渡解释；一个动作能一句写完就别拆成几步。可以连续推进几个小节点，但不要为了快而强造高潮或转折。玲只由用户控制。</lab_guard>');`);

const afterVariants="s=s.slice(0,vStart)+V+s.slice(vEnd);";
if(!w.includes(afterVariants))throw new Error('r6 variant anchor missing');
w=w.replace(afterVariants,afterVariants+`\nconst qStart=s.indexOf('const V=['),qEnd=s.indexOf('];\\nconst SC=',qStart)+2;\nif(qStart<0||qEnd<2)throw new Error('generated variants missing');\nconst Q=\`const V=[{id:'R7F',label:'快节奏：R6E同配置',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true,pace:'fast'}];\`;\ns=s.slice(0,qStart)+Q+s.slice(qEnd);`);

w=w.replaceAll('glm-taste-r6.json','glm-taste-r7.json').replaceAll('glm-taste-r6-summary.txt','glm-taste-r7-summary.txt');

await fs.writeFile(TMP,w,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
