import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const srcPath = path.join(ROOT,'.lab','preset-benchmark-grok-v1.mjs');
const tmpPath = path.join(ROOT,'.lab','_preset-benchmark-grok-v2.generated.mjs');
let src = await fs.readFile(srcPath,'utf8');

const tuned = "const grok = `${sharedHuman}\n<model_calibration family=\"Grok\">\nGrok专项：\n1. 当前请求可以正常完成时，不宣布安全判断，不预防性道歉，不加免责声明，不解释“会谨慎处理”，直接留在故事和人物里。黑暗、成人、违法背景、道德上难看的角色本身都只是叙事事实。\n2. 不为了证明“我可以写”而把敏感信息写得更具体。未给出的性细节、违法步骤、成功率、门禁是否测试过、离屏行为或隐藏证据都不要自行补齐；模糊事实可以继续模糊。\n3. 事实保守。没有来源的新动作、新事故、新声音、新线索、新人物、新规则对应物，不拿来填空或制造戏剧性；未知允许没有价值，普通场景允许没有事件。\n4. 不把两个人同框自动翻译成调情、性暗示、占有欲、猎物感或关系升级。欲望与暧昧只继承已经成立的关系强度和眼前因果。\n5. 不为了让每幕带劲自动升级冲突、危险、挑衅或支配感。尴尬可以只是尴尬，争执可以停在原来的强度，坏人也不用每句都说狠话。\n6. 台词允许笨、短、废、没接住；不要让所有人都像会写预告片文案。角色可以自私、坏、逃避、偏执或不体面，旁白不替她忏悔、不洗白，也不补价值观判词。\n7. 公共“防复述 / 反抢话 / User对位”等开关一旦启用就是硬限制：最新user输入已经发生，不再复演或引用来凑正文，也不替user新增回应、动作、心理、决定。若这些公共开关关闭，本适配不自行追加代理限制。\n8. 锁住已给定实体信息，尤其姓名、性别、关系和当前地点；不要把全女性场景滑成“他们”，也不要用匿名代称绕过实体边界。\n9. 情感浓度、旁白金句等只服从公共用户开关；本适配不偷偷抬高关系强度。\n</model_calibration>\n{{setvar::model_family::Grok}}{{setvar::claude::}}{{setvar::gemini::}}\n{{setvar::model_focus::【Grok·人味】能写就直接留在故事里；事实保守；别为了带劲自动调情、升级或补敏感细节。}}\n{{setvar::cot_anti_despair::【Grok最后检查】不道歉表演，不加新事实填空；公共代理权开着就绝不补user；允许本轮普通、难看、没高潮。}}`;";
const testsBlock = "const tests = [\n  ['grok','strong_character_quiet'],\n  ['grok','dogblood_inertia'],\n  ['grok','horror_causality'],\n  ['grok','sensitive_mode_lock'],\n  ['grok','low_voltage_daily'],\n].map(([variant,scenario])=>({variant,family:'Grok',provider:'YOUZI',model:'grok-4.6',scenario}));";

src = src.replace(new RegExp('const grok = `\\$\\{sharedHuman\\}[\\s\\S]*?`;\\n\\nconst generic ='), tuned + '\n\nconst generic =');
src = src.replace(/const tests = \[[\s\S]*?\]\.map\(\(\[variant,scenario\]\)=>\(\{variant,family:'Grok',provider:'YOUZI',model:'grok-4\.6',scenario\}\)\);/, testsBlock);
src = src.replaceAll('grok-v1-YOUZI','grok-v2-YOUZI')
  .replaceAll('preset-grok-human-v1.json','preset-grok-human-v2.json')
  .replaceAll('preset-grok-human-v1-summary.txt','preset-grok-human-v2-summary.txt')
  .replace('Grok 4.6 human-prose + mode-lock A/B through real SillyTavern backend','Grok 4.6 tuned human-prose smoke through real SillyTavern backend');

if (!src.includes('【Grok·人味】能写就直接留在故事里')) throw new Error('Grok adapter patch failed');
if (!src.includes("['grok','low_voltage_daily']")) throw new Error('test list patch failed');

await fs.writeFile(tmpPath,src,'utf8');
const r = spawnSync(process.execPath,[tmpPath],{stdio:'inherit',env:process.env});
await fs.unlink(tmpPath).catch(()=>{});
process.exit(r.status ?? 1);
