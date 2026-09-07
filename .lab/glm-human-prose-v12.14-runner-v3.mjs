import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const BASE_SCRIPT = path.join(ROOT, '.lab/model-bundle-human-v1.mjs');
const OLD_RUNNER = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner.mjs');
const TMP_SCRIPT = path.join('/tmp', 'glm-human-prose-v12.14-v3-generated.mjs');

const oldRunner = await fs.readFile(OLD_RUNNER, 'utf8');
const expMatch = oldRunner.match(/const EXP = `([\s\S]*?)`;\n\nlet src =/);
if (!expMatch) throw new Error('cannot recover v12.14 experiment text');
const EXP = expMatch[1];

let src = await fs.readFile(BASE_SCRIPT, 'utf8');
const buildNeedle = `function build(s,bundle){\n  const seq=pack.sequence.map(x=>({...x}));`;
if (!src.includes(buildNeedle)) throw new Error('base benchmark build() shape changed');
const expLiteral = JSON.stringify(EXP);
src = src.replace(buildNeedle, `const EXPERIMENT_GLM_LANGUAGE=${expLiteral};\nfunction build(s,bundle){\n  const useExp=bundle.includes('__v12_14');\n  bundle=bundle.filter(x=>x!=='__v12_14');\n  const seq=pack.sequence.map(x=>({...x}));\n  if(useExp){\n    const prism=seq.findIndex(x=>x.name==='🔒丨Prism');\n    const at=prism>=0?prism:seq.length;\n    seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\n  }`);

const testsNeedle = `const tests=[\n {name:'glm_current_tang',scene:'tang_intimate',bundle:[]},\n {name:'glm_credible_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_vivid_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},\n {name:'glm_credible_li',scene:'li_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n];`;
if (!src.includes(testsNeedle)) throw new Error('base benchmark tests[] shape changed');
src = src.replace(testsNeedle, `const tests=[\n {name:'A13_ordinary_1',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_1',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_2',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_2',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_3',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_3',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_tang_intimate',scene:'tang_intimate',bundle:[]},\n {name:'B14_tang_intimate',scene:'tang_intimate',bundle:['__v12_14']},\n];`);

src = src.replace("delay:1800", "delay:4500");
src = src.replace("custom_include_body:'thinking:\\n  type: disabled'", "custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low'");
src = src.replace("max_tokens:2600", "max_tokens:5000");
src = src.replace("thinking:'disabled via ST custom_include_body'", "thinking:'enabled + reasoning_effort low via ST custom_include_body; A=current active pack, B=current active pack + v12.14 GLM language experiment'");
src = src.replaceAll("model-bundle-human-v1.json", "glm-human-prose-v12.14.json");
src = src.replaceAll("model-bundle-human-v1-summary.txt", "glm-human-prose-v12.14-summary.txt");

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
const aggregate = { schema:2, benchmark:'current active pack vs +v12.14 GLM language experiment', variants:{} };
for (const [variant, rows] of Object.entries(groups)) {
  aggregate.variants[variant] = {
    runs: rows.length,
    chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+(r.stats?.chars||0),0)/rows.length) : null,
    reasoning_chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+String(r.reasoning||'').length,0)/rows.length) : null,
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
