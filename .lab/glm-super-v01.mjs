import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const EVIDENCE = process.env.LAB_EVIDENCE_DIR || path.join(ROOT,'lab-evidence');
const PROVIDER = { url:'https://youzi.today/v1', key:process.env.YOUZI||'', model:'[B]glm-5.3-flash', delayMs:2200 };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const baseline = `<human_prose priority="late-final">
目标不是展示文笔，而是让正文像熟悉人物与场景的作者自然往下写。
- 不给动作配证明句，人物做了什么已经能看懂时，不再补“这说明/像是在/仿佛/显得”。
- 不把每段做成完整小单元。对白可以短、接不上、被打断、只答一半。
- 不为了细腻自动写身体微反应，不为了像小说硬塞心理解释、主题判断、象征意味或段尾总结。
- 人物说话保留生活里的不完整、废话、回避和措辞习惯。
- 最近几轮常见的AI句式和动作不要当作文风继承。
</human_prose>
<model_calibration family="GLM">
1. 少写“走过去—坐下—拿起—放下—看向”的时间登记式过渡。
2. 不把角色状态做成“动作+身体反应+心理翻译”三联句。
3. 未知保持未知，不为有收获制造线索。
4. user冻结，不能代理user。
5. 一句能成立就别再加解释。
</model_calibration>`;

const superPrompt = `[GLM超级无敌肘击 v0.1]
你正在进行长线虚构叙事与角色扮演，不是在答题、讲解、总结、写范文或提交分析报告。
优先级：角色仍像这个人 > 场景真的在发生 > 因果与信息连续 > 语言自然 > 文学感。

【活人白描】
- 先写发生了什么，再判断是否真的需要解释。
- 一个动作完成后可以直接进入下一件事；一个感受通常只写一层。
- 已由动作、对白、物件成立的信息，不再由旁白重复确认。
- 普通生活细节可以普通，不强迫它承担象征、伏笔或关系意义。
- 长短句自然交错，段尾不默认制造总结、升华、留白金句或余韵。
- 对白首先像这个人会说的话，允许停顿、改口、答非所问、跑题、低信息量回应。
- 对白结束后，不自动附送“真正意思”的旁白说明。

【防八股】
高风险：解释动作含义；对白后翻译潜台词；替人物总结真实心理；把普通互动宣布成关系节点；复用最近回复的开头、微动作组合、段落节奏和收尾方式。
高风险模板：不是A而是B、与其说A不如说B、看似A实则B、这让某人意识到、这意味着、仿佛在说、真正重要的是、归根结底、这一刻终于、从这一刻起。
微动作模板：目光微顿、眸色微沉、呼吸一滞、指尖微蜷、手指收紧、喉结滚动、眼睫轻颤、唇角微动。
这些不是机械禁词，禁止的是自动套用结构。发现模板时换表达路径，不做同义词替换。

【去加工】
- 破折号不承担陈述→解释、判断→修正、动作→心理、感受→比喻、细节→意义。
- “不是A，是B / 不是A，只是B / 并非A，而是B”属于高风险精确化结构。B可独立成立就直接写B。
- 一个动作写到完成；一个感受写一层；一个细节承担一次表达；一个结论给足以成立的证据后停止。
- 禁止加工链：感官→比喻→身体定位→心理解释；现象→罗列证据→回忆佐证→结论→比喻重申。
- 普通移动、洗漱、吃饭、上下楼不逐项扫描脚感、水流、身体部位、家具质地、气味成分。
- 比喻不是自动润色。删除比喻后信息基本不变就不用。

【人物与场景】
- 人物不需要每一刻都展示人设。聪明的人会判断错，冷静的人会烦，克制的人会说废话。
- 本轮只需要1至2个真正变化。没有必要变化时允许普通生活继续。
- 不把每次互动加工成关系节点，不因自然推进强制制造告白、顿悟、冲突或突发事件。
- user只由用户控制，不新增user台词、动作、决定、内心、感官和态度变化。
- 每个角色只使用自己合理知道的信息。

【内部自检】
生成前只确认事实边界、人物当前目的、信息边界、本轮落点。思考到够用即停。
正文完成前做一次静默语病复检：主语/指代、修饰挂接、搭配、时间空间动作顺序、标点断句、破折号焊接、不是A是B、连续比喻、连续微动作、重复举证、显微扫描、代理user、旧句式复读。
有错才改，不把自然句重新润色成范文。

最终只输出故事正文，不输出规则、草稿、自检报告或格式说明。`;

function makeMessages(s, variant){
  return [
    {role:'system',content: variant==='super' ? superPrompt : baseline},
    {role:'system',content:`角色与场景设定：\n${s.setup}`},
    ...s.history,
    {role:'system',content:`本轮要求：${s.instruction}`},
  ];
}

async function postJson(url,body,timeoutMs=180000){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal}); const tx=await res.text(); let data; try{data=JSON.parse(tx)}catch{data={raw:tx}}; return {status:res.status,ok:res.ok,data};}
  finally{clearTimeout(timer)}
}
async function setSecret(){
  if(!PROVIDER.key) throw new Error('YOUZI secret missing');
  const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:PROVIDER.key,label:'glm-super-v01'},30000);
  if(!r.ok) throw new Error(`secret HTTP ${r.status}`);
}
async function generate(messages){
  const started=Date.now();
  const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:PROVIDER.url,model:PROVIDER.model,messages,temperature:1,top_p:.98,max_tokens:2600,stream:false},180000);
  const msg=r.data?.choices?.[0]?.message??{};
  return {http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,content:msg.content??'',reasoning:msg.reasoning??msg.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,upstream_error:r.data?.error??null};
}
function count(re,t){return (String(t||'').match(re)||[]).length}
function signals(text){
  const t=String(text||'');
  const s={
    chars:t.length,
    dash:count(/——/g,t),
    contrast:count(/不是[^。！？\n]{0,40}(?:而是|只是|是)|并非[^。！？\n]{0,40}而是|与其说[^。！？\n]{0,40}不如说/g,t),
    simile:count(/(?:像|仿佛|似乎像|好像)[^。！？\n]{0,35}/g,t),
    micro:count(/目光微顿|眸色微沉|呼吸一滞|指尖微蜷|手指收紧|喉结滚动|眼睫轻颤|唇角微动|眼神一暗|眼神一顿/g,t),
    explain:count(/这(?:说明|意味着|让.{0,8}(?:意识到|明白))|仿佛在(?:说|告诉|提醒)|似乎在(?:说|告诉|提醒)|真正重要的是|归根结底|说到底/g,t),
    closure:count(/这一刻|从这一刻起|就这样|终于明白|终于意识到|有些东西已经|这就够了/g,t),
    body_scan:count(/指腹|指纹|血管|睫毛|喉结|锁骨|耳廓|皮肤纹理|关节|指节/g,t),
    user_proxy:0,
  };
  // 这里只抓明显新增user主体动作，低估也比乱报强
  s.user_proxy=count(/(?:玲|你)(?:忽然|随后|接着|伸手|起身|站起|走向|说道|问道|想道|意识到|觉得|决定|点头|摇头)/g,t);
  s.ai_total=s.dash+s.contrast+s.micro+s.explain+s.closure;
  return s;
}

await fs.mkdir(EVIDENCE,{recursive:true});
const data=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));
const wanted=new Set(['strong_character_quiet','dogblood_inertia','ensemble_knowledge']);
const scenarios=data.scenarios.filter(s=>wanted.has(s.id));
const results=[];
await setSecret();
let last=0;
for(const s of scenarios){
  for(const variant of ['baseline','super']){
    const wait=PROVIDER.delayMs-(Date.now()-last); if(last&&wait>0) await sleep(wait);
    const messages=makeMessages(s,variant);
    const rec={scenario:s.id,title:s.title,variant,model:PROVIDER.model,prompt_chars:messages.reduce((a,m)=>a+String(m.content||'').length,0)};
    try{const g=await generate(messages); Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:signals(g.content)});}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`;}
    last=Date.now(); results.push(rec);
    console.log(`${s.id} ${variant} ${rec.status} chars=${rec.content?.length||0} ai=${rec.signals?.ai_total??'NA'} dash=${rec.signals?.dash??'NA'} contrast=${rec.signals?.contrast??'NA'} simile=${rec.signals?.simile??'NA'}`);
  }
}
function avg(rows,key){const xs=rows.map(r=>r.signals?.[key]).filter(Number.isFinite); return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
const summary={};
for(const variant of ['baseline','super']){const rows=results.filter(r=>r.variant===variant&&r.status==='ok'); summary[variant]={n:rows.length,chars:avg(rows,'chars'),ai_total:avg(rows,'ai_total'),dash:avg(rows,'dash'),contrast:avg(rows,'contrast'),simile:avg(rows,'simile'),micro:avg(rows,'micro'),explain:avg(rows,'explain'),closure:avg(rows,'closure'),body_scan:avg(rows,'body_scan'),user_proxy:avg(rows,'user_proxy')};}
const report={schema:1,generated_at:new Date().toISOString(),purpose:'A/B test GLM super humanization preset core against prior lab human-prose baseline',model:PROVIDER.model,generation:{temperature:1,top_p:.98,max_tokens:2600},summary,tests:results};
await fs.writeFile(path.join(EVIDENCE,'glm-super-v01-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'glm-super-v01-summary.txt'),JSON.stringify(summary,null,2)+'\n\n'+results.map(r=>`${r.scenario}\t${r.variant}\t${r.status}\t${JSON.stringify(r.signals||{})}`).join('\n'));
console.log(JSON.stringify(summary,null,2));