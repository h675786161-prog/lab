import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const BASE_SCRIPT = path.join(ROOT, '.lab/model-bundle-human-v1.mjs');
const TMP_SCRIPT = path.join('/tmp', 'glm-human-prose-v12.14-generated.mjs');

const EXP = `<glm_language_patch>
【GLM语言纠偏｜活人稿实验版｜职责：只修最终正文口感，不改人物与剧情】

目标不是把文字写得更漂亮，而是让这一段像一个熟悉人物、熟悉现场的人自然写出来。
人物、事实、关系、POV、User控制、剧情推进、字数和已选文风仍服从各自模块；本层只处理表达选择。

一、先让事情发生，旁白少做讲解员
- 动作、对白或现场已经让读者看懂的内容，不再补一句解释它“说明了什么”。
- 人物的态度能从选择和反应里看出来时，不替人物命名情绪、认证动机、宣布关系变化。
- 必须说明时，只补读者无法从现场获得、但当前叙事权限允许知道的新信息。
- 同一个意思说一次就够；后一句只是换更精确、更漂亮的说法时，合并或删掉。

二、人物可以说得不漂亮，也可以没把话说完
- 对白首先像这个人，其次才是“好台词”。不同人物不要共享同一种精致、克制、聪明、会总结的口吻。
- 熟人可以省略、打断、接旧梗、答非所问、嘴硬、嫌弃、顺手岔题；关系生疏或正式时则保持相应距离。
- 人物可以误判、漏听、没接住话、临时改口、说一句没什么意义的话，只要符合她当时的状态。
- 不让人物为了展示设定、主题或作者意图而突然把潜台词完整说破。

三、普通东西先当普通东西写
- 一次停顿可以只是停顿，一个笑可以只是笑，一件旧物可以只是还在那里。
- 没有既有证据时，不把普通动作、时间点、环境细节自动升级成象征、秘密、伏笔、命运感或关系暗号。
- 场景允许平、松、琐碎，允许这一轮没有高潮、没有发现、没有新的关系结论。
- 真正重要的时刻再提高描写密度，不给每一拍都套“文学时刻”。

四、细腻来自人物差异，不来自身体零件巡检
- 细节优先承担新信息：位置变化、动作结果、感知结果、习惯、受力、关系距离、现实影响。
- 同一情绪不靠眼神、呼吸、喉结、手指、肩膀、嘴角轮流证明。一个局部焦点完成任务后，镜头回到人物整体与现场。
- 已建立的电视声、空调、灯光、包、座位、衣角等，只在本轮发生变化或参与行动时再写。
- 细腻应来自“这个人为什么在这里这样做”，而不是“这一句还能再加多少微动作”。

五、禁止把写作修改过程写进正文
- 旁白不要形成“先下判断→否掉→换成更高级判断”的自动骨架。
- “不是A而是B”“像A又不像A”“仿佛在说A却又不是”等结构如果没有新增事实，只是在制造深意或精修语感，就直接写最终那一层。
- 这些句式不是词汇黑名单：若确实符合人物说话习惯、当前文风且承担新信息，可以使用；禁止的是模型反复拿它们当默认润色动作。

六、段尾不负责交作业
- 段落结束不必总结上一拍的意义、感情、关系或主题。
- 不自动补一句短句做余韵、回环、升华、预告或“这一刻改变了什么”。
- 一个动作做完可以直接接下一个动作；对白停住可以就停住。没有新增信息时，停比补一句漂亮话更好。

七、给读者留一点没被解释完的地方
- 嘴硬、试探、敷衍、回避、尴尬、装没事，让人物自己继续演，不替读者发答案卡。
- 允许读者暂时误解、不确定或漏看；后续若重要，用人物行动和结果自然兑现。
- 不因为故事里存在秘密，就把每个细节都写得鬼鬼祟祟。

八、人味不等于故意写烂
- 不为了“去AI味”强行碎句、口语化、加脏话、加网络梗、制造语病或随机跑题。
- 不把所有文字压成干巴巴短句；该细的时候细，该长的时候长，服从当前文风与场景。
- 允许好句子存在，但好句子应像顺着人物和现场长出来，而不是模型停下来展示文笔。

【交付前静默验收】
只看五件事，不输出检查过程：
1. 删除角色名后，这段是不是很容易套给任何人？若是，回到人物差异。
2. 动作/对白已经说明的东西，旁白是不是又解释了一遍？若是，删解释。
3. 有没有连续微动作、连续近义句、连续“意味深长”只为证明细腻？若是，只留承担新信息的部分。
4. 有没有普通细节被无依据抬成象征、伏笔、暧昧或秘密？若是，降回普通事实。
5. 最后一两句是不是为了像小说而硬做余韵/升华？若是，让场景停在人物、动作、对白或真实状态上。

纠偏只删冗余、合并近义、收回模型自我展示；不重写人物，不降低真实情绪，不压缩必要剧情，也不把正文肘成统一短句体。
</glm_language_patch>`;

let src = await fs.readFile(BASE_SCRIPT, 'utf8');

const buildNeedle = `function build(s,bundle){\n  const seq=pack.sequence.map(x=>({...x}));`;
if (!src.includes(buildNeedle)) throw new Error('base benchmark build() shape changed');
const expLiteral = JSON.stringify(EXP);
src = src.replace(buildNeedle, `const EXPERIMENT_GLM_LANGUAGE=${expLiteral};\nfunction build(s,bundle){\n  const useExp=bundle.includes('__v12_14');\n  bundle=bundle.filter(x=>x!=='__v12_14');\n  const seq=pack.sequence.map(x=>({...x}));\n  if(useExp){\n    const li=seq.findIndex(x=>x.identifier==='de8407c8-0b1d-4c78-81bf-395bb0ba0c6b'||x.name==='🧼丨GLM语言纠偏@玲七'||x.name==='补丁·GLM语言纠偏');\n    if(li<0) throw new Error('GLM language prompt missing from active pack');\n    seq[li]={...seq[li],content:EXPERIMENT_GLM_LANGUAGE};\n  }`);

const testsNeedle = `const tests=[\n {name:'glm_current_tang',scene:'tang_intimate',bundle:[]},\n {name:'glm_credible_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_vivid_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},\n {name:'glm_credible_li',scene:'li_intimate',bundle:['❎丨角色反应可信']},\n {name:'glm_credible_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},\n];`;
if (!src.includes(testsNeedle)) throw new Error('base benchmark tests[] shape changed');
src = src.replace(testsNeedle, `const tests=[\n {name:'A13_ordinary_1',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_1',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_2',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_2',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_ordinary_3',scene:'tang_ordinary',bundle:[]},\n {name:'B14_ordinary_3',scene:'tang_ordinary',bundle:['__v12_14']},\n {name:'A13_tang_intimate',scene:'tang_intimate',bundle:[]},\n {name:'B14_tang_intimate',scene:'tang_intimate',bundle:['__v12_14']},\n];`);

src = src.replace("delay:1800", "delay:4500");
src = src.replace("custom_include_body:'thinking:\\n  type: disabled'", "custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low'");
src = src.replace("max_tokens:2600", "max_tokens:5000");
src = src.replace("thinking:'disabled via ST custom_include_body'", "thinking:'enabled + reasoning_effort low via ST custom_include_body; A=v12.13, B=v12.14 GLM language replacement'");
src = src.replaceAll("model-bundle-human-v1.json", "glm-human-prose-v12.14.json");
src = src.replaceAll("model-bundle-human-v1-summary.txt", "glm-human-prose-v12.14-summary.txt");

await fs.writeFile(TMP_SCRIPT, src, 'utf8');
await import(`${pathToFileURL(TMP_SCRIPT).href}?v=${Date.now()}`);

const resultPath = path.join(OUT, 'glm-human-prose-v12.14.json');
try {
  const data = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  const ok = data.tests.filter(x => x.status === 'ok');
  const groups = { A: ok.filter(x => x.name.startsWith('A13_')), B: ok.filter(x => x.name.startsWith('B14_')) };
  const metrics = ['contrast','explain','wrap','micro','transitions'];
  const aggregate = { schema:1, variants:{} };
  for (const [variant, rows] of Object.entries(groups)) {
    aggregate.variants[variant] = { runs:rows.length, chars_avg: rows.length ? Math.round(rows.reduce((n,r)=>n+(r.stats?.chars||0),0)/rows.length) : null };
    for (const m of metrics) aggregate.variants[variant][`${m}_avg`] = rows.length ? Number((rows.reduce((n,r)=>n+(r.stats?.[m]||0),0)/rows.length).toFixed(2)) : null;
  }
  await fs.writeFile(path.join(OUT,'glm-human-prose-v12.14-aggregate.json'),JSON.stringify(aggregate,null,2));
  console.log('aggregate', aggregate);
} catch (e) {
  console.error('aggregate failed', e);
  process.exitCode = process.exitCode || 3;
}
