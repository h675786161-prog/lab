import fs from 'node:fs/promises';
import { loadQiduCgCandidate, entryMap } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const API=`${API_BASE}/chat/completions`;
const MODEL=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const OUT=process.env.LAB_OUT_DISPATCH||'bench-evidence/qidu-card-v0424-dispatch-priority';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[
  card.data.personality,
  card.data.scenario,
  constants,
  card.data.post_history_instructions,
  card.data.extensions?.depth_prompt?.prompt,
  BOOK['04｜输出协议：隐藏状态、正文、终端'],
  BOOK['91｜f7d_state字段与更新规则']
].filter(Boolean).join('\n\n');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(prompt){
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),100000);
  try{
    const r=await fetch(API,{
      method:'POST',
      signal:ctl.signal,
      headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:MODEL,
        temperature:.05,
        top_p:.8,
        max_tokens:180,
        thinking:{type:'disabled'},
        messages:[
          {role:'system',content:BASE},
          {role:'user',content:prompt}
        ]
      })
    });
    const txt=await r.text();
    let data={}; try{data=JSON.parse(txt)}catch{}
    const c=data?.choices?.[0]?.message?.content;
    const out=Array.isArray(c)?c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join(''):String(c||'');
    return {status:r.status,out};
  } finally { clearTimeout(t); }
}

const cases=[
  {
    id:'forced_over_everything',
    expected:'FORCED',
    prompt:`这是剧情调度单元测试，不写正文，不输出状态块。只根据卡内“剧情调度唯一优先级”从下列已确认可执行候选中选本轮最高优先级一项，只输出一行 DISPATCH=<ID>。
候选：
FORCED = 已触发且必须连续结算的第三天追安失败固定剧情
FIRST_MAIN = 首轮尚未完成的关键主线
COMPANION = 玩家明确选择同行神器使且其角色剧情可触发
REGION = 当前区域主线
RANDOM = 自由/随机事件
当前没有任何更高于FORCED的例外。只输出选择。`
  },
  {
    id:'first_loop_main_over_companion',
    expected:'FIRST_MAIN',
    prompt:`这是剧情调度单元测试，不写正文，不输出状态块。只根据卡内“剧情调度唯一优先级”从下列已确认可执行候选中选本轮最高优先级一项，只输出一行 DISPATCH=<ID>。
FORCED = 无
FIRST_MAIN = 首轮关键主线尚未完成且本轮可继续
COMPANION = 玩家明确选择同行神器使且其个人剧情当前可触发
REGION = 当前区域主线可触发
RANDOM = 自由/随机事件可触发
只输出选择。`
  },
  {
    id:'companion_over_region',
    expected:'COMPANION',
    prompt:`这是剧情调度单元测试，不写正文，不输出状态块。只根据卡内“剧情调度唯一优先级”从下列已确认可执行候选中选本轮最高优先级一项，只输出一行 DISPATCH=<ID>。
FORCED = 无
FIRST_MAIN = 无
COMPANION = 玩家本轮明确选择同行神器使，且该神器使角色剧情满足触发条件
REGION = 当前地区区域剧情也满足触发条件
RANDOM = 自由/随机事件也满足触发条件
只输出选择。`
  },
  {
    id:'region_over_random',
    expected:'REGION',
    prompt:`这是剧情调度单元测试，不写正文，不输出状态块。只根据卡内“剧情调度唯一优先级”从下列已确认可执行候选中选本轮最高优先级一项，只输出一行 DISPATCH=<ID>。
FORCED = 无
FIRST_MAIN = 无
COMPANION = 玩家未选择同行神器使
REGION = 当前地区区域剧情满足触发条件
RANDOM = 自由/随机事件满足触发条件
只输出选择。`
  },
  {
    id:'ending_resolution_order',
    expected:'ROUTE_CLOSE>FORCED_RESULT>ENDING_ELIGIBILITY>ENDING_PRIORITY>PERFORMANCE',
    prompt:`这是结算顺序单元测试，不写正文，不输出状态块。卡内应规定唯一结算顺序。只输出一行 ORDER=<顺序ID>。可用ID：
ROUTE_CLOSE = 线路关闭条件
FORCED_RESULT = 强制剧情结果
ENDING_ELIGIBILITY = 结局资格条件
ENDING_PRIORITY = 结局优先级
PERFORMANCE = 结局演出/CG
按实际先后用>连接，只输出答案。`
  }
];

const results=[];
for(const tc of cases){
  let r=null, err='';
  try{r=await call(tc.prompt)}catch(e){err=String(e?.name==='AbortError'?'provider-timeout':e)}
  const out=String(r?.out||'').trim();
  let pass=false;
  if(tc.id==='ending_resolution_order'){
    const normalized=out.replace(/\s+/g,'').toUpperCase();
    pass=normalized.includes(`ORDER=${tc.expected}`);
  }else{
    pass=new RegExp(`DISPATCH\\s*=\\s*${tc.expected}\\b`,'i').test(out);
  }
  const row={id:tc.id,status:r?.status||0,expected:tc.expected,pass,error:err,output:out};
  results.push(row);
  console.log(JSON.stringify(row));
  await fs.writeFile(`${OUT}/${tc.id}.json`,JSON.stringify(row,null,2));
  await sleep(8000);
}
const summary={version:card.data.character_version,hash:compactSha256,model:MODEL,failed:results.filter(x=>!x.pass).map(x=>x.id),results};
await fs.writeFile(`${OUT}/summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(summary.failed.length) throw new Error(`dispatch priority regression failed: ${summary.failed.join(', ')}`);
