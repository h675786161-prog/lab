import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const srcPath=path.join(ROOT,'.lab','glm-alive-ab-v1.mjs');
const tmpPath=path.join(ROOT,'.lab','_glm-alive-ab-v3.generated.mjs');
let src=await fs.readFile(srcPath,'utf8');
const rule=`<glm_character_locality>\n先抓人物此刻最直接的现实目标或注意点，让本轮围着眼前这件事自然走；不要把人物卡里最深、最典型的性格主题自动选成本轮中心。\n人物卡负责约束“她会怎么选”，正文负责写“她现在做了什么”。一个特点已经通过选择、措辞或注意力露出来，就够了，不继续证明和解释。\n当前输入只需要局部反应时，允许反应很小、没完成，随后自然转去手头事务、环境变化、别的话题或沉默。人物不需要每轮都把自己表达完整。\n需要展开篇幅时，从眼前互动、现实事务、具体动作、对话来回和场景里已有的信息展开；不要用角色自我分析或旁白解释人物来填篇幅。\n每写完一段，只问它有没有新增当前场景的信息。若主要是在说明“这个角色为什么会这样”，就停在前一个已经成立的动作或对白上。\n</glm_character_locality>`;
const re=/const LOCALITY=`<glm_character_locality>[\s\S]*?<\/glm_character_locality>`;/;
if(!re.test(src))throw new Error('LOCALITY block not found');
src=src.replace(re,'const LOCALITY=`'+rule.replaceAll('`','\\`')+'`;');
src=src.replaceAll('glm-alive-ab-v1.json','glm-alive-ab-v3.json').replaceAll('glm-alive-ab-v1-summary.txt','glm-alive-ab-v3-summary.txt').replace("schema:1,model:'[B]glm-5.3-flash'","schema:3,model:'[B]glm-5.3-flash'").replace("focus:'current character over character-theme completion'","focus:'scene-first expansion; no character-theme padding'");
await fs.writeFile(tmpPath,src,'utf8');
const r=spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status??1);
