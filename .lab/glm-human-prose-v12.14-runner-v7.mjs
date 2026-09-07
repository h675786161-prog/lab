import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const V5 = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner-v5.mjs');
const TMP = path.join('/tmp', 'glm-human-prose-v12.14-runner-v7-generated.mjs');
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
const expNeedle = "const EXP = expMatch[1] + EXTRA;";
if (!src.includes(expNeedle)) throw new Error('v5 EXP assembly changed');
src = src.replace(expNeedle, `const EXTRA2 = ${JSON.stringify(EXTRA2)};\nconst EXP = expMatch[1] + EXTRA + EXTRA2;`);

// Keep the existing v12.14 experiment as a single candidate switch, then add a late rail.
const injectNeedle = /seq\.splice\(at,0,\{identifier:'lab-glm-language-v12\.14'[\s\S]*?content:EXPERIMENT_GLM_LANGUAGE\}\);\\n  \}/;
if (!injectNeedle.test(src)) throw new Error('v5 experiment injection shape changed');
const lateRail = `<late_fact_freeze>只用已明确存在的事实续写。未知保持未知，不造上次/昨天/某人/故障/旧事。User 最新动作冻结，不替 User 移动、反应、呼吸或产生感觉。需要 User 配合时停在角色动作或台词，把下一步留给 User。</late_fact_freeze>`;
src = src.replace(injectNeedle, "seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\\n    const uiFreeze=seq.findIndex(x=>x.name==='🔒丨User_Input');\\n    if(uiFreeze>=0) seq.splice(uiFreeze,0,{identifier:'lab-glm-late-freeze-v12.14',name:'🧊丨事实与User末帧冻结·实验',role:'system',content:" + JSON.stringify(lateRail) + "});\\n  }");

const testsBlock = `const tests=[
 {name:'A_base_ensemble_knowledge',scene:'ensemble_knowledge',bundle:[]},
 {name:'B_credible_ensemble_knowledge',scene:'ensemble_knowledge',bundle:['❎丨角色反应可信']},
 {name:'C_human_ensemble_knowledge',scene:'ensemble_knowledge',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_ensemble_knowledge',scene:'ensemble_knowledge',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'A_base_strong_character_quiet',scene:'strong_character_quiet',bundle:[]},
 {name:'B_credible_strong_character_quiet',scene:'strong_character_quiet',bundle:['❎丨角色反应可信']},
 {name:'C_human_strong_character_quiet',scene:'strong_character_quiet',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_strong_character_quiet',scene:'strong_character_quiet',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'A_base_horror_causality',scene:'horror_causality',bundle:[]},
 {name:'B_credible_horror_causality',scene:'horror_causality',bundle:['❎丨角色反应可信']},
 {name:'C_human_horror_causality',scene:'horror_causality',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_horror_causality',scene:'horror_causality',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'A_base_tang_ordinary',scene:'tang_ordinary',bundle:[]},
 {name:'B_credible_tang_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},
 {name:'C_human_tang_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_tang_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'A_base_tang_intimate',scene:'tang_intimate',bundle:[]},
 {name:'B_credible_tang_intimate',scene:'tang_intimate',bundle:['❎丨角色反应可信']},
 {name:'C_human_tang_intimate',scene:'tang_intimate',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_tang_intimate',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'A_base_li_intimate',scene:'li_intimate',bundle:[]},
 {name:'B_credible_li_intimate',scene:'li_intimate',bundle:['❎丨角色反应可信']},
 {name:'C_human_li_intimate',scene:'li_intimate',bundle:['❎丨角色反应可信','__v12_14']},
 {name:'D_vivid_li_intimate',scene:'li_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},
];`;
if (!/const tests=\[[\s\S]*?\];/.test(src)) throw new Error('v5 tests block missing');
src = src.replace(/const tests=\[[\s\S]*?\];/, testsBlock);

const genericScenarios = {
  ensemble_knowledge: {
    id:'ensemble_knowledge', char_name:'同福客栈众人', user_name:'玲',
    persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',
    description:'场景发生在一间热闹客栈。掌柜佟湘玉精明会算账但怕惹事；白展堂嘴贫机灵、遇危险先衡量退路；郭芙蓉冲动好胜但并非无脑；吕秀才讲道理、胆子不大。玲坐在角落喝茶，没有参与他们之前在后院发生的争执。只有白展堂亲眼看见后院地上有一只沾泥的黑布包，其他人不知道；玲也不知道。当前没有敌人、追兵或突发危险。',
    world:'', scenario:'继续当前客栈日常。严格保持每个人只知道自己实际知道的信息；不要凭空制造敌人、事故、秘密揭晓或关系升级。',
    history:[{role:'assistant',content:'客栈里刚过饭点，桌椅还没收齐。佟湘玉在柜台后核账，郭芙蓉抱着抹布和白展堂为谁该去后院搬酒坛拌了两句嘴，吕秀才坐在门边誊账。白展堂刚从后院回来，神色比出去时安静一点，但什么也没说。'},{role:'user',content:'玲没插话，只抬眼看了他们一圈，继续喝茶。'}]
  },
  strong_character_quiet: {
    id:'strong_character_quiet', char_name:'沈妄', user_name:'玲',
    persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',
    description:'沈妄，34岁，安保公司负责人，冷静、控制欲强、习惯先处理问题再解释，不爱哄人，也不会因为对方示弱就立刻变温柔。她今晚刚结束一场麻烦的商务应酬，真正挂心的是明早的项目审计。玲和她交往半年，关系稳定但仍保留各自生活。当前只是两人深夜在家碰面，没有隐藏危机，也没有必须发生的冲突。',
    world:'', scenario:'自然续写这次深夜碰面。保持沈妄对工作事务的注意力，不自动把全部注意力转到玲身上，不总结关系，不强行升温，不制造事件。',
    history:[{role:'assistant',content:'门锁响了一声。沈妄进门，把车钥匙丢进玄关的小盘里，先低头回完手机上的工作消息，才抬眼看向客厅。她身上还带着外面的凉气和淡淡酒味。'},{role:'user',content:'玲窝在沙发里看她：“回来啦。”'}]
  },
  horror_causality: {
    id:'horror_causality', char_name:'林岚', user_name:'玲',
    persona:'玲，27岁，女性，明确成年人。玲只由用户控制。',
    description:'五人进入一栋废弃疗养院做限时调查。已知规则只有三条：午夜前不能进入地下室；听见婴儿哭声时必须停在原地十秒；二楼东侧房门上若出现红手印，不要触碰门把。玲和林岚在一楼药房，周野独自在二楼走廊。刚才周野看见东侧第三扇门出现红手印，但一楼两人并不知道。没有任何证据证明规则背后是什么，也不知道违规则会发生什么。',
    world:'', scenario:'继续药房内的调查，严格维持信息隔离和已知规则。不让一楼人物知道周野看到的红手印，不解释怪异现象真相，不为了制造恐怖感立刻触发新事故。',
    history:[{role:'assistant',content:'药房里只有应急灯的一点绿光。林岚翻到半本发潮的值班记录，页角粘在一起。楼上传来一声很轻的金属碰撞，随后又安静下来。'},{role:'user',content:'玲压低声音：“先看记录，别乱猜楼上发生了什么。”'}]
  }
};
const genericLiteral = JSON.stringify(genericScenarios);
const cardNeedle = 'const card=await importCard(),sc=scenarios(card);';
if (!src.includes(cardNeedle)) throw new Error('v5 scenario assembly changed');
src = src.replace(cardNeedle, `const card=await importCard(),sc=scenarios(card);\nObject.assign(sc,${genericLiteral});`);
src = src.replaceAll('runner-v5', 'runner-v7');
src = src.replace('schema:4', 'schema:7');
src = src.replace("credible reactions vs credible reactions + v12.14 human-prose acceptance patch", "GLM default-line matrix: base vs credible reactions vs v12.14 human-prose vs vivid");
src = src.replaceAll('glm-human-prose-v12.14.json', 'glm-human-prose-v12.14-matrix.json');
src = src.replaceAll('glm-human-prose-v12.14-summary.txt', 'glm-human-prose-v12.14-matrix-summary.txt');

await fs.writeFile(TMP, src, 'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);

const resultPath = path.join(process.env.LAB_EVIDENCE_DIR || path.join(ROOT,'lab-evidence'), 'glm-human-prose-v12.14-matrix.json');
const data = JSON.parse(await fs.readFile(resultPath, 'utf8'));
const rows = data.tests.filter(x=>x.status==='ok');
const groups = Object.fromEntries(['A','B','C','D'].map(k=>[k,rows.filter(x=>x.name.startsWith(`${k}_`))]));
const signals = t => {
  t=String(t||'');
  return {
    chars:t.length,
    contrast:(t.match(/不是.{0,24}而是|并非.{0,24}而是|与其说.{0,24}不如说|看似.{0,24}(?:其实|实则)|表面.{0,24}(?:实际|其实)/g)||[]).length,
    explain:(t.match(/这(?:说明|意味着)|像是在(?:证明|告诉)|仿佛在(?:证明|告诉)|说到底|归根结底|真正(?:地|的)|显然|其实他|其实她|这正是/g)||[]).length,
    wrap:(t.match(/这一刻|从这一刻|第一次在|终于(?:明白|意识到|承认)|无需多言|一切都/g)||[]).length,
    micro:(t.match(/呼吸一滞|喉结滚|指(?:尖|节|骨).{0,8}(?:白|紧|颤)|睫毛.{0,6}颤|眼神一(?:暗|沉|顿)|瞳孔.{0,6}(?:缩|放大)/g)||[]).length,
    invented_history:(t.match(/上(?:一周|周|个月|次)|昨天|昨晚|以前|曾经|多年前|几年前|四年|九年|上礼拜|去年/g)||[]).length,
    user_body:(t.match(/玲(?:抬眼|低头|看向|闭眼|呼吸|心跳|手指|手腕|肩膀|身体|腰|脸|耳朵|嘴唇|眼神|视线|退开|靠近|点头|摇头|开口|说了|笑了|沉默|没有动)/g)||[]).length
  };
};
const aggregate={schema:7,benchmark:'GLM default-line matrix: base vs credible reactions vs v12.14 human-prose vs vivid',variants:{}};
for(const [key,items] of Object.entries(groups)){
  const ss=items.map(x=>signals(x.content));
  const avg=k=>ss.length?Number((ss.reduce((n,x)=>n+x[k],0)/ss.length).toFixed(2)):null;
  aggregate.variants[key]={runs:items.length,chars_avg:avg('chars'),contrast_avg:avg('contrast'),explain_avg:avg('explain'),wrap_avg:avg('wrap'),micro_avg:avg('micro'),invented_history_avg:avg('invented_history'),user_body_avg:avg('user_body'),by_scene:Object.fromEntries([...new Set(items.map(x=>x.scene))].map(scene=>[scene,{runs:items.filter(x=>x.scene===scene).length,chars_avg:avgScene(items,scene,'chars'),explain_avg:avgScene(items,scene,'explain'),invented_history_avg:avgScene(items,scene,'invented_history'),user_body_avg:avgScene(items,scene,'user_body')}]))};
}
function avgScene(items,scene,key){const xs=items.filter(x=>x.scene===scene).map(x=>signals(x.content));return xs.length?Number((xs.reduce((n,x)=>n+x[key],0)/xs.length).toFixed(2)):null}
await fs.writeFile(path.join(path.dirname(resultPath),'glm-human-prose-v12.14-matrix-aggregate.json'),JSON.stringify(aggregate,null,2));
console.log('matrix aggregate',JSON.stringify(aggregate));
