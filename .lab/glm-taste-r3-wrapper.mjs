import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r2.mjs');
const TMP='/tmp/glm-taste-r3-generated.mjs';
let s=await fs.readFile(SRC,'utf8');

s=s.replace("const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-r2');","const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-glm-r3');");
s=s.replace("label:'glm-taste-r2'","label:'glm-taste-r3'");

const oldAnti=s.match(/const ANTI_AUTHOR=`[\s\S]*?<\/glm_deperfume>`;/)?.[0];
if(!oldAnti)throw new Error('ANTI_AUTHOR block missing');
const newAnti=`const ANTI_AUTHOR=\`<glm_deperfume>\n正文只管眼前的人和事，不要表现“作者正在刻画人物”。动作和对白已经能懂就往下写，不补心理答案，不替人物总结，不给一句话安排意义。不要求段落完整，也不要求结尾漂亮。事情写到哪就停到哪。\n</glm_deperfume>\`;\nconst LIFE=\`<living_talk>\n把这一轮当成偶然听见的一截生活，不是需要写好的小说。人物先忙手上的事，再顺嘴讲话；可以说废话、答非所问、只接半句、没听清、临时改话题，也可以有人半天不参与。对白不必句句体现性格，动作不必句句推动剧情。旁白少替任何人解释。\n</living_talk>\`;`;
s=s.replace(oldAnti,newAnti);

s=s.replace("if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});","if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.life)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:LIFE});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写眼前这一小截。整体像真人现场聊天比情节完整更重要。约500-850中文字，没东西可写就早点停。</lab_guard>'});");

s=s.replace('async function gen(messages){','async function gen(messages,v){');
s=s.replace("custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low',model:MODEL,messages,temperature:.96,top_p:.96,max_tokens:3800,stream:false","custom_include_body:(v.thinking===false?'thinking:\\n  type: disabled':'thinking:\\n  type: enabled\\nreasoning_effort: low'),model:MODEL,messages,temperature:(v.temp??.96),top_p:(v.top_p??.96),max_tokens:4200,stream:false");
s=s.replace('await gen(built.messages)','await gen(built.messages,v)');

const vStart=s.indexOf('const V=['),vEnd=s.indexOf('];\nconst SC=',vStart)+2;
if(vStart<0||vEnd<2)throw new Error('variants block missing');
const V=`const baseOn=['❎丨角色反应可信','❎丨杀说明','❎丨抗过拟合'];\nconst V=[\n {id:'R3A',label:'母体',on:baseOn,antiAuthor:true},\n {id:'R3B',label:'母体+生活聊天',on:baseOn,antiAuthor:true,life:true},\n {id:'R3C',label:'母体+生活聊天+关闭思考',on:baseOn,antiAuthor:true,life:true,thinking:false},\n {id:'R3D',label:'生活聊天+关GLM专线',on:baseOn,antiAuthor:true,life:true,noAdapter:true},\n {id:'R3E',label:'母体+生活聊天+杀比拟',on:[...baseOn,'❎丨杀比拟'],antiAuthor:true,life:true},\n {id:'R3F',label:'母体+生活聊天+更松采样',on:baseOn,antiAuthor:true,life:true,temp:1.08,top_p:.98}\n];`;
s=s.slice(0,vStart)+V+s.slice(vEnd);
s=s.replace("const SC=['ensemble'];","const SC=['ensemble','quiet'];");
s=s.replaceAll('glm-taste-r2.json','glm-taste-r3.json').replaceAll('glm-taste-r2-summary.txt','glm-taste-r3-summary.txt');
s=s.replace('feedback-driven GLM deperfume round 2','GLM live-dialogue and low-AI-flavor round 3');

await fs.writeFile(TMP,s,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);