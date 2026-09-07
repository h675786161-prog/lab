import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const BASE_SCRIPT = path.join(ROOT, '.lab/model-bundle-human-v1.mjs');
const OLD_RUNNER = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner.mjs');
const TMP_SCRIPT = path.join('/tmp', 'glm-human-prose-v12.14-v4-generated.mjs');

const oldRunner = await fs.readFile(OLD_RUNNER, 'utf8');
const expMatch = oldRunner.match(/const EXP = `([\s\S]*?)`;\n\nlet src =/);
if (!expMatch) throw new Error('cannot recover v12.14 experiment text');
const EXTRA = `

九、不要用新事实假装“活人感”
- 未在角色卡、世界设定、聊天历史或当前明确可见环境中出现的过去事件、第三人姓名、装备故障、训练规矩、私人物品、家乡物件、伤疤来历、曾经发生的“上次/昨天/三年前”等，默认不新建。
- User 的过去行为、习惯、物品来源、身体状况、曾经说过什么尤其不能靠想象补齐。已有信息只允许自然调用，不允许扩写成新的前史。
- 需要生活感时，优先使用当前已经存在的物件、眼前动作、现实结果与角色既有习惯；不要为了证明“像人”临时发明一段履历。
- 一条细节如果删掉后不影响当前动作、关系、事实或人物选择，就不要仅为了制造毛边而硬塞。

十、少替角色找补
- 人物说完一句话后，不自动补“大概是觉得多了”“也可能没有”“其实他只是”“像是在掩饰”之类作者解释。
- 改口就直接改口，停顿就直接停顿，嘴硬就让嘴硬自己成立；不要由旁白替角色解释她为什么这样。
- “不是A，是B”“不是平时那种……是……”和“像A，但……”若只是模型自我修辞，同样视作无效精修，不要换个连词绕过纠偏。
`;
const EXP = expMatch[1] + EXTRA;

let src = await fs.readFile(BASE_SCRIPT, 'utf8');

const buildNeedle = `function build(s,bundle){\n  const seq=pack.sequence.map(x=>({...x}));`;
if (!src.includes(buildNeedle)) throw new Error('base benchmark build() shape changed');
const expLiteral = JSON.stringify(EXP);
src = src.replace(buildNeedle, `const EXPERIMENT_GLM_LANGUAGE=${expLiteral};\nfunction build(s,bundle){\n  const useExp=bundle.includes('__v12_14');\n  bundle=bundle.filter(x=>x!=='__v12_14');\n  const seq=pack.sequence.map(x=>({...x}));\n  if(useExp){\n    const prism=seq.findIndex(x=>x.name==='🔒丨Prism');\n    const at=prism>=0?prism:seq.length;\n    seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\n  }`);

const testsNeedle = `const tests=[\n {name:'glm_current_tang',scene:'tang_intimate',bundle:[]},\n {name:'glm_credible_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_vivid_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},\n {name:'glm_credible_li',scene:'li_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n];`;
if (!src.includes(testsNeedle)) throw new Error('base benchmark tests[] shape changed');
src = src.replace(testsNeedle, `const tests=[\n {name:'A13_ordinary_1',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_1',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_2',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_2',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_3',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_3',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_tang_intimate',scene:'tang_intimate',bundle:[]},\n {name:'B14_tang_intimate',scene:'tang_intimate',bundle:['__v12_14']},\n];`);

src = src.replace("delay:1800", "delay:7000");
src = src.replace("custom_include_body:'thinking:\\n  type: disabled'", "custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low'");
src = src.replace("max_tokens:2600", "max_tokens:5000");
src = src.replace("thinking:'disabled via ST custom_include_body'", "thinking:'enabled + reasoning_effort low via ST custom_include_body; A=current active pack, B=current active pack + v12.14 GLM language experiment + fact boundary'");
src = src.replaceAll("model-bundle-human-v1.json", "glm-human-prose-v12.14.json");
src = src.replaceAll("model-bundle-human-v1-summary.txt", "glm-human-prose-v12.14-summary.txt");

const oldBody = `function body(t){t=String(t||'');const m=t.match(/<content>([\\s\\S]*?)<\\/content>/i);return(m?m[1]:t).trim()}`;
const newBody = `function body(t){t=String(t||'');const m=t.match(/<content>([\\s\\S]*?)<\\/content>/i);if(m&&m[1].trim())return m[1].trim();return t.replace(/<content>\\s*<\\/content>/gi,'').trim()}`;
if (!src.includes(oldBody)) throw new Error('base body() shape changed');
src = src.replace(oldBody, newBody);

const oldTry = `try{Object.assign(r,await gen(built.messages));r.status=r.content?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content)}catch(e){r.status='exception';r.error=String(e)}`;
const newTry = `try{let attempt=0;for(;attempt<3;attempt++){if(attempt)await sleep(9000);Object.assign(r,await gen(built.messages));if(body(r.content))break}r.attempts=attempt+1;r.status=body(r.content)?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content)}catch(e){r.status='exception';r.error=String(e)}`;
if (!src.includes(oldTry)) throw new Error('base generation loop shape changed');
src = src.replace(oldTry, newTry);

await fs.writeFile(TMP_SCRIPT, src, 'utf8');
await import(`${pathToFileURL(TMP_SCRIPT).href}?v=${Date.now()}`);

const resultPath = path.join(OUT, 'glm-human-prose-v12.14.json');
const data = JSON.parse(await fs.readFile(resultPath, 'utf8'));
const ok = data.tests.filter(x => x.status === 'ok');
const groups = {
  A: ok.filter(x => x.name.startsWith('A13_')),
  B: ok.filter(x => x.name.startsWith('B14_')),
};
const metrics = ['contrast','explain','wrap','micro','transitions'];
const aggregate = { schema:3, benchmark:'current active pack vs +v12.14 human-prose + fact-boundary experiment', variants:{} };
for (const [variant, rows] of Object.entries(groups)) {
  aggregate.variants[variant] = {
    runs: rows.length,
    chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+(r.stats?.chars||0),0)/rows.length) : null,
    reasoning_chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+String(r.reasoning||'').length,0)/rows.length) : null,
    attempts_avg: rows.length ? Number((rows.reduce((n,r)=>n+(r.attempts||1),0)/rows.length).toFixed(2)) : null,
  };
  for (const m of metrics) {
    aggregate.variants[variant][`${m}_avg`] = rows.length
      ? Number((rows.reduce((n,r)=>n+(r.stats?.[m]||0),0)/rows.length).toFixed(2))
      : null;
  }
}
await fs.writeFile(path.join(OUT,'glm-human-prose-v12.14-aggregate.json'),JSON.stringify(aggregate,null,2));
console.log('aggregate', aggregate);
if (data.tests.some(x => x.status !== 'ok')) process.exitCode = 2;
