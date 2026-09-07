import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r2.mjs');
const TMP='/tmp/glm-taste-r4-generated.mjs';
let s=await fs.readFile(SRC,'utf8');

s=s.replace("const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-r2');","const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-glm-r4');");
s=s.replace("label:'glm-taste-r2'","label:'glm-taste-r4'");

const oldAnti=s.match(/const ANTI_AUTHOR=`[\s\S]*?<\/glm_deperfume>`;/)?.[0];
if(!oldAnti)throw new Error('ANTI_AUTHOR block missing');
const newAnti=`const ANTI_AUTHOR=\`<anti_performance>\n别把这一轮当成一篇需要证明写作能力的作品。人物只活在现场，不替读者把自己讲清楚；叙述只留下真正发生、真正被注意到的东西。允许注意力偏、话没说完、无用的小事、私人习惯和不高明的反应。一个细节若只是为了显得有文学感，就不要写。\n</anti_performance>\`;\nconst PRIVATE=\`<private_texture>\n人物可以有很具体、很私人的小判断：嫌某样东西难用、记错一件小事、突然想到一个无关的经验、坚持一个别人不理解的习惯。这样的东西不必服务剧情，也不必被解释。优先让差异来自人物自己的注意力，而不是来自修辞和镜头设计。\n</private_texture>\`;`;
s=s.replace(oldAnti,newAnti);

s=s.replace("if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});","if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.privateTexture)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PRIVATE});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>续写眼前这截生活。玲只由用户控制。没有必须完成的段落任务，也不用向读者说明任何东西。约500-850中文字，停在哪都可以。</lab_guard>'});");

s=s.replace('async function gen(messages){','async function gen(messages,v){');
s=s.replace("custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low',model:MODEL,messages,temperature:.96,top_p:.96,max_tokens:3800,stream:false","custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low',model:MODEL,messages,temperature:(v.temp??.96),top_p:(v.top_p??.96),max_tokens:4200,stream:false");
s=s.replace('await gen(built.messages)','await gen(built.messages,v)');

const vStart=s.indexOf('const V=['),vEnd=s.indexOf('];\nconst SC=',vStart)+2;
if(vStart<0||vEnd<2)throw new Error('variants block missing');
const V=`const credible='❎丨角色反应可信', explain='❎丨杀说明', overfit='❎丨抗过拟合', metaphor='❎丨杀比拟';\nconst V=[\n {id:'R4A',label:'旧最佳复刻：可信+杀说明+抗过拟合+杀比拟+去作者',on:[credible,explain,overfit,metaphor],antiAuthor:true},\n {id:'R4B',label:'减法：可信+杀说明+抗过拟合+去表演',on:[credible,explain,overfit],antiAuthor:true},\n {id:'R4C',label:'再松：可信+抗过拟合+去表演（关杀说明）',on:[credible,overfit],off:[explain],antiAuthor:true},\n {id:'R4D',label:'去表演+私人纹理：可信+抗过拟合',on:[credible,overfit],off:[explain],antiAuthor:true,privateTexture:true},\n {id:'R4E',label:'极简：可信+去表演',on:[credible],off:[explain,overfit,metaphor],antiAuthor:true,privateTexture:true}\n];`;
s=s.slice(0,vStart)+V+s.slice(vEnd);
s=s.replace("const SC=['ensemble'];","const SC=['ensemble','quiet'];");
s=s.replaceAll('glm-taste-r2.json','glm-taste-r4.json').replaceAll('glm-taste-r2-summary.txt','glm-taste-r4-summary.txt');
s=s.replace('feedback-driven GLM deperfume round 2','GLM anti-performative-writing and private-texture round 4');

await fs.writeFile(TMP,s,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
