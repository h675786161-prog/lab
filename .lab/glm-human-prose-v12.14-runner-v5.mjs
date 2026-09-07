import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const BASE_SCRIPT = path.join(ROOT, '.lab/model-bundle-human-v1.mjs');
const OLD_RUNNER = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner.mjs');
const TMP_SCRIPT = path.join('/tmp', 'glm-human-prose-v12.14-v5-generated.mjs');

const oldRunner = await fs.readFile(OLD_RUNNER, 'utf8');
const expMatch = oldRunner.match(/const EXP = `([\s\S]*?)`;\n\nlet src =/);
if (!expMatch) throw new Error('cannot recover v12.14 experiment text');

const EXTRA = `

九、角色卡是边界，不是临场素材库
- 角色卡明确写出的身份、长期经历、固定习惯可以作为人物底色；没有写出的具体往事，不因为“很像这个人会经历”就临时创造。
- 当前对话没有出现过的“上次/昨天/上周/以前你说过/你曾经做过”，默认不存在。尤其禁止给 User 补过去行为、习惯、失误、身体状况、装备来源或两人共同回忆。
- 角色卡里有某个同事、单位、职业或旧经历，不等于本轮就该把她们拉进来。只有当前动作确实需要时才调用。
- 生活感优先来自眼前已经存在的东西怎么被使用，而不是新增一串姓名、旧事、规章、故障、伤疤、家乡物件来显得“世界很真”。

十、不要替人物和作者找补
- 人物说完一句话，不补“他说完才意识到”“这句出口就后悔了”“其实他没有”“大概是觉得多了”“这不是他该说的话”来解释创作过程。
- 改口就直接改口；停顿就直接停；嘴硬就让嘴硬自己成立。不要由旁白发答案卡。
- 不写“他准备了一肚子这种话”“刻薄话找回来了”“精神体比主人诚实”“这比任何挑逗都难对付”这类替人物总结状态的作者旁白。
- “不是A，是B”“不像平时那种，是……”以及“像A，但……”若只是抛光语气而没有新增事实，直接删掉前半层。

十一、User 的身体也归 User
- 除非 User 最新消息或既有上下文明示，否则不要新写 User 的心跳、脉搏、呼吸变化、脸红、发抖、湿润、疼痛、快感、紧张程度、视线变化或任何非自愿身体反应。
- 角色可以感受到 User 已明确做出的接触、位置、力度与话语；不能借“观察力强/感知敏锐”擅自读取 User 没写出的生理答案。
- 不新增 User 的动作、对白、决定、心理与感觉；角色做完动作后，把下一步选择留给 User。

十二、人物不是设定讲解器
- 职业、军衔、能力、精神体、创伤与社会身份影响判断即可，不要每段拿来做比喻、术语、口癖或自我介绍。
- 同一轮最多让一个真正相关的设定细节进入前景；若不用设定也能自然完成当前动作，就让人物像普通人一样说话。
- 少用三段式排比、连续反问、漂亮的交易宣言、过分准确的情绪总结。人物可以只说半句、说得不完整、甚至说得有点笨。

十三、亲密场景也要像人在现场
- 当前互动已经开始时，不重新举行一场“规则说明会”，不自动把每一步包装成交易、挑战、博弈或输赢。
- 不为了维持张力持续升级动作、暴露新伤疤、抛新秘密、讲过去对象；一拍可以只停在已有接触和一句很普通的话上。
- 亲密感来自人物怎么对待眼前这个人，不来自喉结、瞳孔、呼吸、手指、精神体轮流证明“他动心了”。
- 角色若本来嘴硬或轻浮，也允许她突然没接上、说句没那么漂亮的话；不要让每一句都像精心设计的台词。
`;
const EXP = expMatch[1] + EXTRA;

let src = await fs.readFile(BASE_SCRIPT, 'utf8');
const buildNeedle = `function build(s,bundle){\n  const seq=pack.sequence.map(x=>({...x}));`;
if (!src.includes(buildNeedle)) throw new Error('base benchmark build() shape changed');
const expLiteral = JSON.stringify(EXP);
src = src.replace(buildNeedle, `const EXPERIMENT_GLM_LANGUAGE=${expLiteral};\nfunction build(s,bundle){\n  const useExp=bundle.includes('__v12_14');\n  bundle=bundle.filter(x=>x!=='__v12_14');\n  const seq=pack.sequence.map(x=>({...x}));\n  if(useExp){\n    const prism=seq.findIndex(x=>x.name==='🔒丨Prism');\n    const at=prism>=0?prism:seq.length;\n    seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\n  }`);

const testsNeedle = `const tests=[\n {name:'glm_current_tang',scene:'tang_intimate',bundle:[]},\n {name:'glm_credible_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_vivid_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},\n {name:'glm_credible_li',scene:'li_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n];`;
if (!src.includes(testsNeedle)) throw new Error('base benchmark tests[] shape changed');
src = src.replace(testsNeedle, `const tests=[\n {name:'A_credible_ordinary_1',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n {name:'B_credible_exp_ordinary_1',scene:'tang_ordinary',bundle:['❎丨角色反应可信','__v12_14']},\n {name:'A_credible_ordinary_2',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n {name:'B_credible_exp_ordinary_2',scene:'tang_ordinary',bundle:['❎丨角色反应可信','__v12_14']},\n {name:'A_credible_ordinary_3',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n {name:'B_credible_exp_ordinary_3',scene:'tang_ordinary',bundle:['❎丨角色反应可信','__v12_14']},\n {name:'A_credible_tang_intimate',scene:'tang_intimate',bundle:['❎丨角色反应可信']},\n {name:'B_credible_exp_tang_intimate',scene:'tang_intimate',bundle:['❎丨角色反应可信','__v12_14']},\n {name:'A_credible_li_intimate',scene:'li_intimate',bundle:['❎丨角色反应可信']},\n {name:'B_credible_exp_li_intimate',scene:'li_intimate',bundle:['❎丨角色反应可信','__v12_14']},\n];`);

src = src.replace("delay:1800", "delay:7000");
src = src.replace("custom_include_body:'thinking:\\n  type: disabled'", "custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low'");
src = src.replace("max_tokens:2600", "max_tokens:5000");
src = src.replace("thinking:'disabled via ST custom_include_body'", "thinking:'enabled + reasoning_effort low; A=credible reactions, B=credible reactions + v12.14 human-prose acceptance patch'");
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
  A: ok.filter(x => x.name.startsWith('A_')),
  B: ok.filter(x => x.name.startsWith('B_')),
};
const aggregate = { schema:4, benchmark:'credible reactions vs credible reactions + v12.14 human-prose acceptance patch', variants:{} };
for (const [variant, rows] of Object.entries(groups)) {
  const bodyText = r => {
    const t=String(r.content||'');
    const m=t.match(/<content>([\s\S]*?)<\/content>/i);
    return (m&&m[1].trim()?m[1]:t.replace(/<content>\s*<\/content>/gi,'')).trim();
  };
  const joined=rows.map(bodyText).join('\n');
  aggregate.variants[variant] = {
    runs: rows.length,
    chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+(r.stats?.chars||0),0)/rows.length) : null,
    reasoning_chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+String(r.reasoning||'').length,0)/rows.length) : null,
    attempts_avg: rows.length ? Number((rows.reduce((n,r)=>n+(r.attempts||1),0)/rows.length).toFixed(2)) : null,
    explicit_explain_hits: (joined.match(/这句.{0,12}(?:后悔|出口)|这不是.{0,16}该说|其实他|大概是|像是意识到|准备了.{0,16}(?:这种|这些)|更诚实/g)||[]).length,
    invented_history_surface_hits: (joined.match(/上次|上回|上周|上礼拜|昨天|前天|三年前|以前你|你之前|你曾经/g)||[]).length,
    user_body_surface_hits: (joined.match(/玲.{0,12}(?:心跳|脉搏|呼吸|脸红|发抖|颤|湿|疼|快感)|她.{0,8}(?:心跳|脉搏|呼吸)/g)||[]).length,
    contrast_hits: rows.reduce((n,r)=>n+(r.stats?.contrast||0),0),
    wrap_hits: rows.reduce((n,r)=>n+(r.stats?.wrap||0),0),
  };
}
await fs.writeFile(path.join(OUT,'glm-human-prose-v12.14-aggregate.json'),JSON.stringify(aggregate,null,2));
console.log('aggregate', aggregate);
if (data.tests.some(x => x.status !== 'ok')) process.exitCode = 2;
