import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const SRC=path.join(ROOT,'.lab/glm-taste-r2.mjs');
const TMP='/tmp/glm-taste-r5-generated.mjs';
let s=await fs.readFile(SRC,'utf8');

s=s.replace("const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-r2');","const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-glm-r5');");
s=s.replace("label:'glm-taste-r2'","label:'glm-taste-r5'");

const oldAnti=s.match(/const ANTI_AUTHOR=`[\s\S]*?<\/glm_deperfume>`;/)?.[0];
if(!oldAnti)throw new Error('ANTI_AUTHOR block missing');
const newAnti=`const ANTI_AUTHOR=\`<anti_performance>\n别把这一轮当成一篇需要证明写作能力的作品。人物只活在现场，不替读者把自己讲清楚；叙述只留下真正发生、真正被注意到的东西。允许注意力偏、话没说完、无用的小事、私人习惯和不高明的反应。一个细节若只是为了显得有文学感，就不要写。\n</anti_performance>\`;\nconst PRIVATE=\`<private_texture>\n人物可以有很具体、很私人的小判断：嫌某样东西难用、突然想到一个无关经验、坚持一个别人不理解的习惯、在亲密时也保留自己的脾气和注意力。这样的东西不必服务剧情，也不必被解释。优先让差异来自人物自己的注意力，而不是来自修辞和镜头设计。\n</private_texture>\`;`;
s=s.replace(oldAnti,newAnti);

s=s.replace("if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});","if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});if(v.privateTexture)messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:PRIVATE});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>这是成人、双方自愿的亲密场景压力测试。保持人物原来的脾气、判断和生活感；亲密不等于自动失控、升级、温柔化或文学化。续写眼前这一截即可，没必要完成一个情色段落。玲只由用户控制。</lab_guard>'});");

const scStart=s.indexOf('function scenarios(card){');
const scEnd=s.indexOf('\nfunction strip(',scStart);
if(scStart<0||scEnd<0)throw new Error('scenarios block missing');
const SCENARIOS=`function scenarios(card){return{
 onset:{id:'onset',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',world:'',description:'沈妄，34岁，女性，安保公司负责人。冷静、务实、控制欲强，做事有自己的节奏，不爱把感受讲成完整答案；她和玲交往半年，已有稳定且自愿的性生活。她在亲密时仍然是同一个人，不会自动变成粗暴、占有欲爆棚或满嘴情话的人。',scenario:'深夜在家，双方都明确愿意继续亲密。当前只是刚开始升温，不要求升级到更强烈行为；看人物自己会怎么继续。',history:[{role:'assistant',content:'沈妄洗完澡出来，头发还没完全吹干。她在床边坐下找充电线，玲从后面抱住她，在她肩上亲了一下。沈妄偏过头，手还捏着那根怎么都插不稳的线。'},{role:'user',content:'玲又亲了她一下，笑着问：“不理我？”'}]},
 heated:{id:'heated',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',world:'',description:'沈妄，34岁，女性，安保公司负责人。冷静、务实、控制欲强，习惯掌握节奏，但不是暴力或强制型人格。她和玲交往半年，双方已经多次自愿发生性关系。亲密时她仍会保留现实注意力、个人习惯、嫌麻烦和偶尔的分心，不会因为性欲就人格清零。',scenario:'双方已明确同意继续，正在持续亲吻和抚摸，衣物已经脱掉一部分。当前没有疼痛、拒绝或安全问题。测试模型是否会在情色状态下自动加码、堆身体反应或把人物写成欲望机器。',history:[{role:'assistant',content:'床头灯没关。沈妄半跪在床沿，衬衫扣子已经散开，玲的手还抓着她的衣领。两个人刚接了一个很长的吻，沈妄停下来换了口气，低头看见自己那颗掉到被子上的耳钉。'},{role:'user',content:'玲没催她，只伸手在她腰侧摸了一下：“还继续吗？”'}]},
 high:{id:'high',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',world:'',description:'沈妄，34岁，女性，安保公司负责人。冷静、务实、控制欲强，但并不把亲密当征服。她和玲交往半年，双方熟悉彼此边界，当前明确同意继续。即使在强烈性唤起中，她仍然保留判断、说话习惯和对现实细节的注意力。',scenario:'双方都已赤裸并处在明显高唤起状态，正在自愿进行直接的性接触。测试重点不是情色强度，而是模型会不会突然发狠、人格扁平、只剩身体描写、重复加码或用文绉绉的语言解释欲望。',history:[{role:'assistant',content:'沈妄的呼吸已经乱了，手掌贴在玲的大腿内侧。刚才玲主动把她的手拉得更近，也明确说了可以。沈妄没有急着继续，先把碍事的枕头推到一边，又低声骂了一句床单太滑。'},{role:'user',content:'玲被她那句床单逗笑了，贴过去亲她：“你这时候还有空嫌床单？”'}]},
 after:{id:'after',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',world:'',description:'沈妄，34岁，女性，安保公司负责人。冷静、务实、控制欲强，不爱把情绪说得很漂亮。她和玲交往半年，刚刚结束一次双方自愿且熟悉边界的性行为。她不会因为事后状态突然人格软化、开始人生感悟或发表关系宣言。',scenario:'亲密行为已经结束，双方身体安全，没有冲突。测试模型会不会自动升华、解释亲密意义、突然极端温柔，或把事后写成文学散文。',history:[{role:'assistant',content:'房间里有点热。沈妄把被子往下踢了踢，躺了半分钟又坐起来，伸手去够床头那瓶水。瓶盖之前拧得太紧，她试了一次没开。'},{role:'user',content:'玲趴在旁边笑她：“给我，我来。”'}]}
};}`;
s=s.slice(0,scStart)+SCENARIOS+s.slice(scEnd);

const vStart=s.indexOf('const V=['),vEnd=s.indexOf('];\nconst SC=',vStart)+2;
if(vStart<0||vEnd<2)throw new Error('variants block missing');
const V=`const V=[{id:'R5D',label:'当前入口母体：可信+抗过拟合+去表演+私人纹理',on:['❎丨角色反应可信','❎丨抗过拟合'],off:['❎丨杀说明','❎丨杀比拟'],antiAuthor:true,privateTexture:true}];`;
s=s.slice(0,vStart)+V+s.slice(vEnd);
s=s.replace("const SC=['ensemble'];","const SC=['onset','heated','high','after'];");
s=s.replaceAll('glm-taste-r2.json','glm-taste-r5.json').replaceAll('glm-taste-r2-summary.txt','glm-taste-r5-summary.txt');
s=s.replace('feedback-driven GLM deperfume round 2','GLM adult-intimacy personality-retention stress test round 5');

await fs.writeFile(TMP,s,'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
