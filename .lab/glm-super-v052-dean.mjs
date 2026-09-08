import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v052');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2200};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const common=`你正在进行长线虚构叙事与角色扮演，不是在答题、讲解、总结、写范文。角色仍像这个人 > 场景真的在发生 > 因果与信息连续 > 语言自然 > 文学感。\n- 已由动作、对白、物件成立的信息，不再旁白重复确认。\n- 不使用破折号承担普通解释/修正；避免“不是A，是B”式精确加工。\n- 一个感受写一层，一个结论证据够了就停。\n- 任何过去事实必须有前文来源；共同回忆、固定偏好、旧约定不能为了生活感现场补。\n- user只由用户控制。每个角色只使用自己合理知道的信息。\n- 段尾停在具体动作、对白、环境状态或未完成事务，不另造漂亮总结。\n- 比喻、微动作、身体部位与感官只在真正新增信息时出现。\n- 不把人物修正成更理性、更礼貌、更成熟、更会沟通的版本。`;

const persona=`[三好学生｜内部作者代号]\n“三好学生”只是内部作者代号，不是学生身份，不代表校园、乖巧、服从、道德优等生或应试作文人格。正文不得出现三好学生、教导主任、交卷、批改等内部代号。\n“三好”的意思只有：人物站得住，场景接得上，语言像人写的。\n人物可以自私、别扭、迟钝、犯错、误会、偏心、嘴硬、没想明白，也有自己的事情，不自动围着user转。普通场景可以普通，对白允许短、断、偏题、答一半、改口和沉默。观察细但不显摆，记事实牢但不写记录表，理解人物但不替人物总结。局部不完美允许存在。最危险的不是不够漂亮，而是太像经过优化。`;

const v051=`[v0.5.1]\n${persona}\n${common}\n【动作链】连续普通动作若只完成同一个生活目的，压成一个行动单位。\n【审改】作者先写当前自然段，审稿者随后检查该段的事实来源、user权限、真实语病/指代、明显AI加工。没有问题PASS；有问题只改问题句。每段最多审一次，不全文重写，不输出审稿过程。最终只输出故事正文。`;

const v052=`[v0.5.2]\n${persona}\n${common}\n【中间步骤删除测试】当多个普通动作只共同完成一个目的时，问：删掉这个中间步骤，人物、信息、因果、关系、场景状态会不会变？不会变就直接跨过去。职业行为可以专业，但不写成操作手册。文件名、编号、版本、附件、时间戳、截图、逐项核对等，只有真正改变判断、暴露问题或造成后果时才具体写；若一串步骤只共同证明“她在认真工作”，保留一个真正影响判断的具体问题，其余概括。\n【双人格接力】作者一次完成本轮当前事件单位的正文，写作过程中不调用审稿者、不逐段审稿、不边写边寻找AI味。正文完成后审稿者只在出口看一次：只抓一眼可确认的事实造假、User越权、真实语病/主体错误、严重AI加工。需要反复分析算不算问题=PASS；需要比较版本哪个好=PASS；只是可能有点AI味=PASS。禁止逐句遍历、候选改写、全文二审和重新规划。最终只输出故事正文。`;

const scenarios=[
{id:'action_chain',setup:'沈妄，34岁，安保公司负责人，冷静，今晚应酬后回家，明早九点有项目审计。她和玲交往半年。无危机。厨房有普通食材，但没有谁爱吃什么、谁平时做饭等设定。',history:[{role:'assistant',content:'门锁响了。沈妄进门，手机上是项目群未读消息。'},{role:'user',content:'“我先去洗澡，你忙你的。”玲说完回了卧室。'}],instruction:'只续写沈妄这一侧。不要替玲新增行为。保持普通深夜生活和她对明早审计的注意力。'},
{id:'procedure_ledger',setup:'沈妄，34岁，安保公司负责人。明早有例行项目审计。她已经拿到完整材料，当前只发现一处供应商签章日期前后不一致，其他材料没有问题。无需描写真实行业技术细节。',history:[{role:'assistant',content:'电脑还亮着，审计材料已经打开。沈妄靠在椅背上看了两分钟。'},{role:'user',content:'玲从门口说：“你今晚还要忙很久？”'}],instruction:'只续写沈妄。可以表现她专业、认真，但不要把工作写成文档编号、附件、版本、截图、逐项核对、翻页勾选的操作手册。唯一值得具体展开的问题是签章日期不一致。不要替玲新增行为。'},
{id:'past_fact_trap',setup:'许雾与玲边界混乱、尚未正式确定关系。过去两周因为一次失约有些别扭，但设定只确认“失约发生过”，没有给出当天时间、地点、原因、谁在哪里等经过。许雾自尊强、回避正面承诺，不轻易道歉。',history:[{role:'assistant',content:'许雾把菜单推到一边，手机屏幕朝下扣在桌上。'},{role:'user',content:'“你要是没话说，我们就先吃饭。”玲说。'}],instruction:'自然续写。不要替玲决定后续。可以触及失约，但不得补出设定没有提供的失约当天具体时间、地点、行动经过或原因。不要直接和解、决裂或告白。'},
{id:'abrasive_character',setup:'梁汐，39岁，急诊科护士长。高压、效率优先、嘴硬、耐心有限，关心人主要靠做事，不擅长温柔沟通，也不会因为别人指出她情绪就立刻自省。她刚下夜班，和玲在便利店门口碰见。',history:[{role:'assistant',content:'梁汐拧开矿泉水喝了两口，站在台阶边没动。'},{role:'user',content:'玲看了她一会儿：“你今天是不是心情不好？”'}],instruction:'自然续写梁汐。保留她不善沟通和嘴硬，不要自动写成成熟沟通示范，不要强制道歉、解释全部情绪或关系升华。'}
];

function msgs(s,v){return[{role:'system',content:v==='v052'?v052:v051},{role:'system',content:`设定：${s.setup}`},...s.history,{role:'system',content:`本轮要求：${s.instruction}`}];}
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d}}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'glm-v052'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,model:P.model,messages,temperature:1,top_p:.98,max_tokens:2800,stream:false,reasoning_effort:'low'});const m=r.data?.choices?.[0]?.message??{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content??'',reasoning:m.reasoning??m.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t){t=String(t||'');const paras=t.split(/\n\s*\n/).filter(Boolean).length||1;const av=count(/(?:换鞋|脱下|挂上|放下|拿起|倒水|打开|关上|取出|盛了|坐下|起身|走到|走进|走回|拉开|合上|翻开|点开|收起|塞进|搁在|摆在|烧水|捞面|调火|定闹钟)/g,t);return{chars:t.length,action_density:+(av/paras).toFixed(2),procedure:count(/(?:附件|版本|文档|编号|截图|扫描|第\d+项|逐项|勾选|页码|时间戳|B-\d+|A-\d+)/g,t),past_specific:count(/(?:那天|当天|上次|后来|以前|平时|一直).{0,55}(?:点|楼下|门口|公司|会议|等了|停了|没上去|去了|因为|喜欢|总会|每次)/g,t),campus_leak:count(/三好学生|教导主任|校规|校园|学校|课堂|作业|试卷|考试|同学|老师|交卷|批改|放学|上课|下课/g,t),dash:count(/——/g,t),contrast:count(/不是[^。！？\n]{0,40}(?:而是|只是|是)|并非[^。！？\n]{0,40}而是|与其说[^。！？\n]{0,40}不如说/g,t),closure:count(/这就够了|这一刻|从这一刻起|说到底|归根结底|剩下的交给|有些东西/g,t),user_proxy:count(/(?:玲|你)(?:忽然|随后|接着|伸手|起身|站起|走向|说道|问道|想道|意识到|觉得|决定|点头|摇头)/g,t),mature_fix:count(/(?:抱歉|对不起|我不该|我只是太累|不是你的问题|我们需要|好好沟通|我会注意|我会改)/g,t)}}

await fs.mkdir(EVIDENCE,{recursive:true});await secret();
const results=[];let last=0;
for(let rep=1;rep<=2;rep++){
 for(const s of scenarios){
  for(const v of ['v051','v052']){
   const w=P.delayMs-(Date.now()-last);if(last&&w>0)await sleep(w);
   const rec={rep,scenario:s.id,variant:v};
   try{const g=await gen(msgs(s,v));Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:sig(g.content),reasoning_signals:sig(g.reasoning)});}catch(e){rec.status='exception';rec.exception=`${e.name}: ${e.message}`;}
   last=Date.now();results.push(rec);console.log(rep,s.id,v,rec.status,rec.content?.length||0,rec.reasoning?.length||0,JSON.stringify(rec.signals||{}));
  }
 }
}
function avg(rows,k,src='signals'){const x=rows.map(r=>r[src]?.[k]).filter(Number.isFinite);return x.length?x.reduce((a,b)=>a+b,0)/x.length:null}
const summary={};
for(const v of ['v051','v052']){const rows=results.filter(r=>r.variant===v);const ok=rows.filter(r=>r.status==='ok');summary[v]={n:rows.length,content_nonempty:rows.filter(r=>String(r.content||'').length>0).length,empty_content:rows.filter(r=>!String(r.content||'').length).length,chars:avg(ok,'chars'),action_density:avg(ok,'action_density'),procedure:avg(ok,'procedure'),past_specific:avg(ok,'past_specific'),campus_leak:avg(ok,'campus_leak'),closure:avg(ok,'closure'),user_proxy:avg(ok,'user_proxy'),mature_fix:avg(ok,'mature_fix'),reasoning_chars:ok.length?ok.reduce((a,r)=>a+String(r.reasoning||'').length,0)/ok.length:null,elapsed_ms:ok.length?ok.reduce((a,r)=>a+(r.elapsed_ms||0),0)/ok.length:null,finish_reasons:[...new Set(rows.map(r=>r.finish_reason).filter(Boolean))]};}
const report={schema:1,generated_at:new Date().toISOString(),purpose:'v0.5.1 per-paragraph dean vs v0.5.2 exit-gate dean + action/procedure compression',summary,tests:results};
await fs.writeFile(path.join(EVIDENCE,'glm-super-v052-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'glm-super-v052-summary.txt'),JSON.stringify(summary,null,2));
for(const r of results){await fs.writeFile(path.join(EVIDENCE,`${r.rep}-${r.scenario}-${r.variant}.txt`),`STATUS ${r.status}\nFINISH ${r.finish_reason}\nELAPSED ${r.elapsed_ms}\n\n=== REASONING ===\n${r.reasoning||''}\n\n=== CONTENT ===\n${r.content||''}\n`)}
console.log(JSON.stringify(summary,null,2));