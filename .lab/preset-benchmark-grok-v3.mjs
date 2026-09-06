import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const srcPath = path.join(ROOT,'.lab','preset-benchmark-grok-v1.mjs');
const tmpPath = path.join(ROOT,'.lab','_preset-benchmark-grok-v3.generated.mjs');
let src = await fs.readFile(srcPath,'utf8');

const tuned = "const grok = `${sharedHuman}\n<model_calibration family=\"Grok\">\nGrok专项只校正模型惯性，不替代公共开关。\n1. 先判断当前实际请求，而不是看到敏感词就自行宣布禁区。成年人关系、犯罪/灰色背景、恐怖场景，以及非色情、非伤害性的婴儿/儿童背景提及，本身都不是拒绝理由；当前请求能正常完成时，直接留在故事里，不道歉、不免责声明、不解释安全判断。\n2. 事实保守。不要为了证明“敢写”而补敏感细节，也不要为了推进而补未给出的动作、测试结果、违法步骤、隐藏证据、新声音、新事故或规则对应物。模糊可以继续模糊，没事可以真的没事。\n3. 不自动把同框写成调情、性暗示、占有欲或关系升级；不自动把争执、恐怖、坏角色写得更狠更带劲。只继承已经成立的强度。\n4. 台词允许短、废、接不上；角色可以坏、逃避、不体面。不要金句化，不替角色忏悔、洗白或补价值观判词。\n5. 公共控制若有内容，必须原样服从：{{getvar::push_rule}} {{getvar::agency_contract}}。这些变量为空时，本适配不自行增加user代理限制。\n6. 锁住姓名、性别、关系和当前地点等已给定实体事实；不要用匿名代称绕过边界。\n</model_calibration>\n{{setvar::model_family::Grok}}{{setvar::claude::}}{{setvar::gemini::}}\n{{setvar::model_focus::【Grok·人味】实际请求能写就直接写；事实保守；别预防性道歉，别为了带劲自动加戏。}}\n{{setvar::cot_anti_despair::【Grok最后检查】不自创禁区，不补新事实填空；公共控制有值就服从；允许普通、难看、没高潮。}}`;";
const testsBlock = "const tests = [\n  ['grok','horror_causality'],\n  ['grok','sensitive_mode_lock'],\n  ['grok','low_voltage_daily'],\n].map(([variant,scenario])=>({variant,family:'Grok',provider:'YOUZI',model:'grok-4.6',scenario}));";

src = src.replace(new RegExp('const grok = `\\$\\{sharedHuman\\}[\\s\\S]*?`;\\n\\nconst generic ='), tuned + '\n\nconst generic =');
src = src.replace(/const tests = \[[\s\S]*?\]\.map\(\(\[variant,scenario\]\)=>\(\{variant,family:'Grok',provider:'YOUZI',model:'grok-4\.6',scenario\}\)\);/, testsBlock);
// Align public controls with the real preset: they occur before User_Input/model adapter.
src = src.replace("const thinkIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考')); pack.sequence.splice(thinkIdx,0,...commonPatches); return pack;", "const publicIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔒丨User_Input')); pack.sequence.splice(publicIdx,0,...commonPatches); return pack;");
src = src.replaceAll('grok-v1-YOUZI','grok-v3-YOUZI')
  .replaceAll('preset-grok-human-v1.json','preset-grok-human-v3.json')
  .replaceAll('preset-grok-human-v1-summary.txt','preset-grok-human-v3-summary.txt')
  .replace('Grok 4.6 human-prose + mode-lock A/B through real SillyTavern backend','Grok 4.6 aligned human-prose smoke through real SillyTavern backend');
if (!src.includes('不自创禁区')) throw new Error('Grok v3 adapter patch failed');
if (!src.includes('const publicIdx=')) throw new Error('public control order patch failed');
if (!src.includes("['grok','low_voltage_daily']")) throw new Error('test list patch failed');
await fs.writeFile(tmpPath,src,'utf8');
const r = spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status ?? 1);
