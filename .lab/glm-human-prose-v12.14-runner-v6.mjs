import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const V5 = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner-v5.mjs');
const TMP = path.join('/tmp', 'glm-human-prose-v12.14-runner-v6-generated.mjs');

let src = await fs.readFile(V5, 'utf8');

const EXTRA2 = `

十四、未知就是未知，不要把空白补成事实
- 续写只能使用角色卡明确事实、当前场景明确事实、聊天历史明确发生过的事实。没有来源的具体信息保持未知，不要为了顺滑、生活感、世界感去补齐。
- 禁止临时创建“上一位向导/上次联合训练/昨晚我看见你/这车以前坏过/某人曾经说过/某处昨天化冻”等离屏往事。哪怕它很合理，只要本轮来源里没有，就不成立。
- 不要把角色卡的一般能力转换成具体目击史。看得远不等于昨晚看见了 User；经验丰富不等于已经经历过眼前这件事；认识同事不等于本轮发生过与同事有关的旧事。
- 需要琐碎感时，只用眼前已有物件的当前状态、角色自己的当下动作和角色卡已经写明的固定习惯。宁可少一个细节，也不要新增一段履历。

十五、冻结 User 最新一帧
- 最新 User 消息结束时 User 的动作、位置、接触、视线和身体状态就冻结在那里。除非下一条 User 消息自己改变，否则本轮绝不替 User 移动半寸、换姿势、加力、退开、靠近、抬眼、低头、呼吸变化或产生身体反应。
- 角色可以响应已经明确存在的接触，但不能以“观察力强”“感知敏锐”“顺势”作为读取或操纵 User 新动作的理由。
- 若角色动作需要 User 的下一步配合，写到角色动作或台词为止，把空位留给 User。

十六、不要用余波补满篇幅
- 当前动作和对白自然停住后可以结束，不补室内安静下来、光影落在物件上、纸条多一行字、远处声音之类镜头收尾，除非这些东西本轮真的发生了变化并影响下一步。
- 不为了接近目标字数而添离屏事实、环境余韵或人物解释。短一点但真实，优先于凑够篇幅。
`;

const needle = "const EXP = expMatch[1] + EXTRA;";
if (!src.includes(needle)) throw new Error('v5 EXP assembly changed');
src = src.replace(needle, `const EXTRA2 = ${JSON.stringify(EXTRA2)};\nconst EXP = expMatch[1] + EXTRA + EXTRA2;`);

// Put a compact fact/user freeze immediately before User_Input as a late rail.
const injectNeedle = "seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\\n  }";
const lateRail = `<late_fact_freeze>只用已明确存在的事实续写。未知保持未知，不造上次/昨天/某人/故障/旧事。User 最新动作冻结，不替 User 移动、反应、呼吸或产生感觉。需要 User 配合时停在角色动作或台词，把下一步留给 User。</late_fact_freeze>`;
if (!src.includes(injectNeedle)) throw new Error('v5 experiment injection shape changed');
src = src.replace(injectNeedle, "seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\\n    const uiFreeze=seq.findIndex(x=>x.name==='🔒丨User_Input');\\n    if(uiFreeze>=0) seq.splice(uiFreeze,0,{identifier:'lab-glm-late-freeze-v12.14',name:'🧊丨事实与User末帧冻结·实验',role:'system',content:" + JSON.stringify(lateRail) + "});\\n  }");

src = src.replaceAll('runner-v5', 'runner-v6');
src = src.replace("schema:4", "schema:5");
src = src.replace("credible reactions vs credible reactions + v12.14 human-prose acceptance patch", "credible reactions vs credible reactions + v12.14 human-prose + late fact/user freeze");

await fs.writeFile(TMP, src, 'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
