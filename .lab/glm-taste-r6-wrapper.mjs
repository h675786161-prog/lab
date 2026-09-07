import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r2.mjs');
const TMP='/tmp/glm-taste-r6-generated.mjs';
let s=await fs.readFile(SRC,'utf8');

s=s.replace("const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-r2');","const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-glm-r6');");
s=s.replace("label:'glm-taste-r2'","label:'glm-taste-r6'");

const oldAnti=s.match(/const ANTI_AUTHOR=`[\s\S]*?<\/glm_deperfume>`;/)?.[0];
if(!oldAnti)throw new Error('ANTI_AUTHOR block missing');
const newAnti=`const ANTI_AUTHOR=\`<anti_performance>\n别把这一轮当成一篇需要证明写作能力的作品。人物只活在现场，不替读者把自己讲清楚；叙述只留下真正发生、真正被注意到的东西。允许注意力偏、话没说完、无用的小事、私人习惯和不高明的反应。一个细节若只是为了显得有文学感，就不要写。\n</anti_performance>\`;\nconst PRIVATE=\`<private_texture>\n人物可以有很具体、很私人的小判断：嫌某样东西难用、突然想到一个无关经验、坚持一个别人不理解的习惯、在亲密时也保留自己的脾气和注意力。这样的东西不必服务剧情，也不必被解释。优先让差异来自人物自己的注意力，而不是来自修辞和镜头设计。\n</private_texture>\`;\nconst INTIMACY=\`<intimacy_continuity>\n性唤起只是人物当前状态，不是新的文体或新的人格。人物原来的说话习惯、判断方式、分心点、幽默感、现实顾虑和笨拙都继续存在。不要把“控制欲、冷淡、傲慢、温柔、占有”等性格词自动翻译成固定情色角色或床上套路；具体行为只从这个人和眼前互动里长出来。\n</intimacy_continuity>\`;\nconst PLATEAU=\`<intimacy_plateau>\n亲密没有必须不断升级的方向。强度可以停住、来回、换节奏、被一句废话或现实小事打断，也可以自然维持在当前程度。不要因为回复还没结束就继续加码动作、命令、身体反应或更强的措辞。\n</intimacy_plateau>\`;\nconst NO_LABEL=\`<no_narrator_label>\n旁白不替亲密行为命名或归类，不告诉读者“这叫控制、征服、占有、温柔、信任、确认、臣服”等，也不拿工作习惯、人格标签或过去经历来给床上的动作作文学对应。写发生的东西即可。\n</no_narrator_label>\`;`;
s=s.replace(oldAnti,newAnti);

s=s.replace("if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});","if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.privateTexture)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PRIVATE});if(v.intimacy)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:INTIMACY});if(v.plateau)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PLATEAU});if(v.noLabel)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:NO_LABEL});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>成人、双方自愿的亲密场景。继续眼前这一截即可。优先人物仍然像她自己，其次才是情色强度。玲只由用户控制。</lab_guard>'});");

const scStart=s.indexOf('function scenarios(card){');
const scEnd=s.indexOf('\nfunction strip(',scStart);
if(scStart<0||scEnd<0)throw new Error('scenarios block missing');
const SCENARIOS=`function scenarios(card){return{
 high:{id:'high',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',world:'',description:'沈妄，34岁，女性，安保公司负责人。冷静、务实、控制欲强，但并不把亲密当征服。她和玲交往半年，双方熟悉彼此边界，当前明确同意继续。即使在强烈性唤起中，她仍然保留判断、说话习惯、现实注意力、偶尔的分心和不那么漂亮的反应。',scenario:'双方都已赤裸并处在明显高唤起状态，正在自愿进行直接的性接触。测试重点不是情色强度，而是人物是否仍像原来的人；不要求持续升级，也不要求完成一个情色段落。',history:[{role:'assistant',content:'沈妄的呼吸已经乱了，手掌贴在玲的大腿内侧。刚才玲主动把她的手拉得更近，也明确说了可以。沈妄没有急着继续，先把碍事的枕头推到一边，又低声骂了一句床单太滑。'},{role:'user',content:'玲被她那句床单逗笑了，贴过去亲她：“你这时候还有空嫌床单？”'}]}
};}`;
s=s.slice(0,scStart)+SCENARIOS+s.slice(scEnd);

const vStart=s.indexOf('const V=['),vEnd=s.indexOf('];\nconst SC=',vStart)+2;
if(vStart<0||vEnd<2)throw new Error('variants block missing');
const base={on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true};
const V=`const V=[\n {id:'R6A',label:'控制：R5D入口母体',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true},\n {id:'R6B',label:'母体+亲密人格连续',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true},\n {id:'R6C',label:'R6B+亲密不必升级',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true},\n {id:'R6D',label:'R6C+旁白不命名',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true},\n {id:'R6E',label:'R6D复跑',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true,intimacy:true,plateau:true,noLabel:true}\n];`;
s=s.slice(0,vStart)+V+s.slice(vEnd);
s=s.replace("const SC=['ensemble'];","const SC=['high'];");
s=s.replaceAll('glm-taste-r2.json','glm-taste-r6.json').replaceAll('glm-taste-r2-summary.txt','glm-taste-r6-summary.txt');
s=s.replace('feedback-driven GLM deperfume round 2','GLM adult-intimacy anti-archetype and anti-ratchet round 6');

await fs.writeFile(TMP,s,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
