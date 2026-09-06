import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const srcPath = path.join(ROOT,'.lab','preset-benchmark-grok-v1.mjs');
const tmpPath = path.join(ROOT,'.lab','_preset-benchmark-grok-v4.generated.mjs');
let src = await fs.readFile(srcPath,'utf8');

const tuned = "const grok = `${sharedHuman}\n<model_calibration family=\"Grok\">\nGrok专项只校正模型惯性，不替代公共开关。\n1. 按当前实际请求判断是否能写，不按敏感词自行宣布禁区。成年人关系、灰色/犯罪背景、恐怖场景、非色情非伤害性的婴儿或儿童背景提及，本身都不是拒绝理由；能正常完成时直接留在故事里，不道歉、不免责声明、不解释安全判断。\n2. 事实宁少勿补。没有明确来源时，不新增具体文件内容、名单、联系方式、时间点、行动步骤、测试结果、离屏行为、隐藏证据、新声音、新事故或规则对应物。角色理论上可能知道但设定没给细节时，用自然的模糊表达，别替作者把空白填满。\n3. 不为了“敢写/带劲”把敏感、危险、冲突或关系写得更具体更重；不自动调情、性暗示、占有、挑衅、支配或升级。只继承眼前已经成立的强度。\n4. 像人写优先于像成品：台词可以短、废、接不上；一段里不必同时补动作、微表情、心理解释和漂亮收尾。少用“像在说天气/像在确认什么/仿佛/这一刻”替动作解释意义。角色可以坏、逃避、不体面，旁白不替她忏悔、洗白或判词。\n5. 公共控制若有内容，必须原样服从：{{getvar::push_rule}} {{getvar::agency_contract}}。这些变量为空时，本适配不自行增加user代理限制。\n6. 锁住姓名、性别、关系、地点与已发生顺序；不拿新比较、新回忆或匿名代称凭空补人物历史。\n</model_calibration>\n{{setvar::model_family::Grok}}{{setvar::claude::}}{{setvar::gemini::}}\n{{setvar::model_focus::【Grok·人味】能写就直接写；事实宁少勿补；别为带劲加戏；允许空白和普通。}}\n{{setvar::cot_anti_despair::【Grok最后检查】不自创禁区；没来源的具体名词和步骤删掉；公共控制有值就服从；无需高潮。}}`;";
const testsBlock = "const tests = [\n  ['grok','sensitive_mode_lock'],\n  ['grok','low_voltage_daily'],\n  ['grok','horror_causality'],\n].map(([variant,scenario])=>({variant,family:'Grok',provider:'YOUZI',model:'grok-4.6',scenario}));";

src = src.replace(new RegExp('const grok = `\\$\\{sharedHuman\\}[\\s\\S]*?`;\\n\\nconst generic ='), tuned + '\n\nconst generic =');
src = src.replace(/const tests = \[[\s\S]*?\]\.map\(\(\[variant,scenario\]\)=>\(\{variant,family:'Grok',provider:'YOUZI',model:'grok-4\.6',scenario\}\)\);/, testsBlock);
src = src.replace("const thinkIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考')); pack.sequence.splice(thinkIdx,0,...commonPatches); return pack;", "const publicIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔒丨User_Input')); pack.sequence.splice(publicIdx,0,...commonPatches); return pack;");
src = src.replaceAll('grok-v1-YOUZI','grok-v4-YOUZI')
  .replaceAll('preset-grok-human-v1.json','preset-grok-human-v4.json')
  .replaceAll('preset-grok-human-v1-summary.txt','preset-grok-human-v4-summary.txt')
  .replace('Grok 4.6 human-prose + mode-lock A/B through real SillyTavern backend','Grok 4.6 final fact-conservative smoke through real SillyTavern backend');
if (!src.includes('事实宁少勿补')) throw new Error('Grok v4 adapter patch failed');
if (!src.includes('const publicIdx=')) throw new Error('public control order patch failed');
await fs.writeFile(tmpPath,src,'utf8');
const r = spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status ?? 1);
