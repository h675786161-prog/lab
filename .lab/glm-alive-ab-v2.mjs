import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const srcPath=path.join(ROOT,'.lab','glm-alive-ab-v1.mjs');
const tmpPath=path.join(ROOT,'.lab','_glm-alive-ab-v2.generated.mjs');
let src=await fs.readFile(srcPath,'utf8');
const rule=`<glm_character_locality>\n人设是后台约束，不是本轮输出任务。让性格主要通过当下的选择、措辞、注意力和忽略什么自然露出来。\n一个特点已经影响了当前选择，就让它停在那里；不要继续把这件事提炼成对人物本身的说明。\n每段优先写人物此刻真正注意、说、做或决定的东西。若一句话的主要作用只是解释上一句为什么“符合这个人”，省略它。\n反应可以很小、普通、没完成，也可以临时偏离人物最典型的表现。场合、疲劳、关系距离和眼前目标会改变同一个人的反应。\n允许注意力自然转移；一轮不要求完成人格、情绪或关系上的完整表达。\n</glm_character_locality>`;
const re=/const LOCALITY=`<glm_character_locality>[\s\S]*?<\/glm_character_locality>`;/;
if(!re.test(src))throw new Error('LOCALITY block not found');
src=src.replace(re,'const LOCALITY=`'+rule.replaceAll('`','\\`')+'`;');
src=src.replaceAll('glm-alive-ab-v1.json','glm-alive-ab-v2.json').replaceAll('glm-alive-ab-v1-summary.txt','glm-alive-ab-v2-summary.txt').replace("schema:1,model:'[B]glm-5.3-flash'","schema:2,model:'[B]glm-5.3-flash'").replace("focus:'current character over character-theme completion'","focus:'character card as background constraint; present scene first'");
await fs.writeFile(tmpPath,src,'utf8');
const r=spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status??1);
