import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const srcPath=path.join(ROOT,'.lab','riyuexi-glm-v7-focused.mjs');
const tmpPath=path.join(ROOT,'.lab','_riyuexi-glm-v71-focused.generated.mjs');
let src=await fs.readFile(srcPath,'utf8');

const rule=`[模型校准·GLM v7.1｜场景局部性与信息新增预算]
只纠正GLM把简单现场“补完整”、用新事实填篇幅的倾向，不削弱NPC主动性与世界运转。
- 当前输入若只是窄问题、提醒、确认或局部动作，先按同一尺度回应。人物可以继续做自己的事，但不要自动把一个小问题扩成完整事件链、调查流程或一轮小故事。
- 新增细节遵循“最小充分”。眼前可观察的小细节成本低；未出现在历史里的离屏事实、共享往事、长期习惯、具体订单、昨晚发生什么、上次说过什么、未来行程等属于高成本信息，只在当前人物判断或行动真正需要时新增。
- 不连续发明多个高成本事实来证明“生活感”“人物有自己的日子”或把正文填满。一个新事实已经够用，就先让它产生当前后果。
- 角色当然可以不知道、记错、猜错、只记得大概；不要为了给窄问题一个漂亮完整答案，临时补出完整物流链、时间线或幕后经过。
- 已有任务可继续，NPC也可以主动开新动作；但新动作优先从眼前物品、当前位置、已知任务与已建立关系长出来，而不是靠“昨晚/上次/平时/早就约好”凭空接枝。
- 字数是可用预算，不是事实发明配额。普通场景自然写短时允许短，不为达到目标字数增加回忆、采购计划、工作细节、关系旧梗或额外小事故。
- 可观察的动作、事实或对白已经成立时不追加解释性收束；具体句法去惯性继续交给【表达去惯性】。
- 本模块不修改人物设定、抢转权限、剧情速度、关系、世界规则、NSFW强度或文风选择。
目标：让GLM的清楚用在“眼前到底发生了什么”，而不是用在“把这一小段补成一份完整说明书”。`;

const old=/const GLM=`\[模型校准·GLM\][\s\S]*?`;\n\nconst ECOT=/;
if(!old.test(src))throw new Error('GLM calibration block not found');
const original=src.match(old)[0];
src=src.replace(original,original.replace(/`;\n\nconst ECOT=$/,'`;\nconst GLM_V71=`'+rule.replaceAll('`','\\`')+'`;\n\nconst ECOT='));
src=src.replace("if(variant==='v7'){const pos", "if(variant==='v7'||variant==='v71'){const pos");
src=src.replace("{role:'system',content:GLM},{role:'system',content:ECOT}","{role:'system',content:variant==='v71'?GLM_V71:GLM},{role:'system',content:ECOT}");
src=src.replace("for(const variant of ['current','v7'])", "for(const variant of ['v7','v71'])");
src=src.replaceAll("riyuexi-glm-v7-focused.json","riyuexi-glm-v71-focused.json").replaceAll("kind:'riyuexi-v7-glm-focused'","kind:'riyuexi-v71-glm-focused'").replace("note:'Focused compatibility probe: existing Riyuexi GLM pack + exact V7 corrective modules; not a full V7 frontend import.'","note:'Focused A/B: V7 corrective modules vs V7.1 GLM locality/fact-budget calibration; existing Riyuexi GLM pack base; not a full V7 frontend import.'");
await fs.writeFile(tmpPath,src,'utf8');
const check=spawnSync(process.execPath,['--check',tmpPath],{stdio:'inherit'});if(check.status!==0)process.exit(check.status??1);
const r=spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status??1);
