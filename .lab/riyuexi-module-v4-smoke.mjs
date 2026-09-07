import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v4');
const GG={url:'https://gcli.ggchan.dev/v1',key:process.env.GG||'',model:'gemini-3.5-flash',delayMs:31000};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const core=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/riyuexi-depattern/core-ab.json'),'utf8'));
const v4doc=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/riyuexi-depattern/v4-overlay.json'),'utf8'));
const v4=v4doc.overlay;

const TAKEOVER_CLOSED='[不演绎<user>言行] 只按转述设置承接已发生输入；转述后不得新增<user>的对话、动作、心理、立场与决策。';
const TAKEOVER_OPEN='[演绎<user>言行] 必须以<user>的人设续写其接下来的完整对话和伴随动作，像<user>本人继续操作；这是明确开放的代理授权。';
const NARRATE_CLOSED='[禁止转述<user>] 不引用、重复或概括上一条<user>输入，直接从其已经发生后的现场继续。';

const scenes=[
  {
    id:'ordinary_kitchen_closed',
    setup:'沈岚，34岁，女性，结构工程师。做事利落，熟人面前嘴有点欠，忙起来会忘记照顾气氛。她和玲认识很久，关系稳定。普通工作日清晨，厨房里只有早餐、没洗的杯子和待会要带走的图纸。今天没有纪念日、秘密、告白或关系转折。',
    history:[
      {role:'assistant',content:'沈岚站在料理台边翻图纸，吐司烤过头了一点。她把焦边掰下来丢进盘子，嘴里还在算昨天那组梁的尺寸。'},
      {role:'user',content:'玲把车钥匙放到桌上：“你再算两分钟，咖啡就凉了。”'}
    ],
    globals:{演绎授权:TAKEOVER_CLOSED,转述授权:NARRATE_CLOSED},
    guard:'当前是关闭演绎档。不要给玲新增台词、动作、心理、昨夜经历、工作、口味或未来决定。沈岚和环境应继续正常行动；不要为了生活感额外开无关小故障、小往事、小任务。'
  },
  {
    id:'ordinary_kitchen_open',
    setup:'沈岚，34岁，女性，结构工程师。做事利落，熟人面前嘴有点欠。她和玲认识很久，关系稳定。普通工作日清晨，没有重大剧情节点。当前测试特意把<user>演绎档开到“开放”。',
    history:[
      {role:'assistant',content:'沈岚把图纸卷起来塞进帆布袋，另一只手还端着咖啡，站在玄关找门禁卡。'},
      {role:'user',content:'玲靠在门边看她折腾，笑了一声。'}
    ],
    globals:{演绎授权:TAKEOVER_OPEN,转述授权:NARRATE_CLOSED},
    guard:'这是开放演绎回归测试：必须真的继续写玲接下来的合理动作与至少一句完整对话，同时继续写沈岚/NPC；不要被任何通用“不抢话”倾向缩回。不要给玲发明重大私设或突兀人生经历。'
  }
];

function clean(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(content,vars,globals){let t=clean(content);for(let i=0;i<32;i++){const old=t;t=t
  .replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,val)=>(vars[n.trim()]=val,''))
  .replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,val)=>(vars[n.trim()]=(vars[n.trim()]||'')+val,''))
  .replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]||'')
  .replace(/\{\{getglobalvar::([^{}]+?)\}\}/g,(_,n)=>globals[n.trim()]||'')
  .replace(/\{\{random::([^{}]*?)\}\}/g,(_,val)=>String(val).split('::')[0]||'')
  .replace(/\{\{lastUserMessage\}\}/g,globals.lastUserMessage||'')
  .replace(/\{\{trim\}\}/g,'');
  if(t===old)break;
}return t.trim()}

function build(scene){
  const vars={预设模式:'RP模式',核心语言:'简体中文',输入分析:''};
  const globals={
    叙述视角:'第三人称有限视角',char代词:'她',user代词:'她',字数总要求:'600-900中文字',单段落字数:'自然长短错落',
    lastUserMessage:scene.history.at(-1)?.content||'',...scene.globals
  };
  const msgs=[];
  const processed=new Set();
  for(const [name,baseContent] of Object.entries(core.shared||{})){
    if(name==='😡防八股glm'){
      const c=v4['😡表达去惯性']; if(c){const x=expand(c,vars,globals);if(x)msgs.push({role:'system',content:`[😡表达去惯性]\n${x}`});processed.add('😡表达去惯性');}
      continue;
    }
    const c=v4[name]??baseContent;
    const x=expand(c,vars,globals); if(x)msgs.push({role:'system',content:`[${name}]\n${x}`}); processed.add(name);
  }
  const merged={...(core.baseline||{}),...v4};
  const late=[];
  for(const [name,c] of Object.entries(merged)){
    if(processed.has(name))continue;
    if(name==='📍常规创作思维'||name==='🌓Gemini尾部②'){late.push([name,c]);continue;}
    const x=expand(c,vars,globals); if(x)msgs.push({role:'system',content:`[${name}]\n${x}`});
  }
  msgs.push({role:'system',content:`[角色与场景]\n${scene.setup}\n\n[本轮实验守卫]\n${scene.guard}\n正文约600-900中文字即可；自然更短也不必用无关内容硬凑。不要输出实验说明。`});
  msgs.push(...scene.history);
  for(const [name,c] of late){const x=expand(c,vars,globals);if(x)msgs.push({role:'system',content:`[${name}]\n${x}`});}
  return msgs;
}

async function post(url,body,timeout=240000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}}return{ok:r.ok,status:r.status,data:d,text:tx};}finally{clearTimeout(t)}}
async function secret(){if(!GG.key)throw new Error('GG secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:GG.key,label:'riyuexi-v4-gg'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:GG.url,model:GG.model,messages,temperature:.9,top_p:1,max_tokens:6500,stream:false},240000);const m=r.data?.choices?.[0]?.message||{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null}}
function body(raw){raw=String(raw||'');const m=raw.match(/<content>([\s\S]*?)(?:<\/content>|$)/i);return(m?m[1]:raw).trim()}
function cnt(re,t){return(t.match(re)||[]).length}
function stats(raw,id){const t=body(raw),e=(String(raw||'').match(/<electric>([\s\S]*?)<\/electric>/i)?.[1]||'');return{
 chars:t.length,ecot_chars:e.length,
 contrast:cnt(/不是.{0,24}而是|并非.{0,24}而是|与其说.{0,24}不如说|看似.{0,24}(?:其实|实则)/g,t),
 interpretive:cnt(/这(?:说明|意味着)|像是在|仿佛在|显然|真正(?:地|的)|说到底|归根结底/g,t),
 micro:cnt(/呼吸.{0,8}(?:滞|停|乱|缓)|指(?:尖|节|骨).{0,10}(?:紧|白|颤|停)|眼神.{0,8}(?:暗|沉|顿)|睫毛.{0,6}颤|喉结|抿唇|移开视线/g,t),
 relation_words:cnt(/关系|靠近|信任|防备|心软|依赖|归属|被看见/g,t),
 user_fact_risk:cnt(/玲.{0,10}(?:昨晚|眼眶|案子|订单|口味|平时|习惯|喜欢|不吃|加辣|没加辣|副驾)|你.{0,8}(?:昨晚|平时|喜欢|不吃|点的|案子)/g,t),
 outline_ecot:cnt(/停笔|动作：|闲聊：|情绪弧|结尾设计|最后一句|先.+再.+最后/g,e),
 authenticity_confetti:cnt(/昨晚.{0,10}(?:雨|听见|发生)|周末.{0,10}(?:买|去|修)|漏水|滑丝|报修|上礼拜|新人|刚毕业|新闻/g,t),
 open_user_dialogue:id.includes('_open')?cnt(/玲.{0,40}[“\"]/g,t):null
}}

await fs.mkdir(OUT,{recursive:true});await secret();
const results=[];
for(let i=0;i<scenes.length;i++){
  if(i)await sleep(GG.delayMs);
  const scene=scenes[i],messages=build(scene),r={scene:scene.id,variant:'v4',provider:'GG',model:GG.model,prompt_chars:messages.reduce((n,m)=>n+String(m.content||'').length,0)};
  try{Object.assign(r,await gen(messages));r.status=r.content?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content,scene.id);}catch(e){r.status='exception';r.error=String(e)}
  results.push(r);console.log(`${scene.id}/v4: ${r.status} HTTP=${r.http_status} chars=${r.stats?.chars||0} ecot=${r.stats?.ecot_chars||0} userRisk=${r.stats?.user_fact_risk||0} openDialog=${r.stats?.open_user_dialogue}`);
}
await fs.writeFile(path.join(OUT,'riyuexi-module-v4-smoke.json'),JSON.stringify({schema:1,kind:'riyuexi-v4-module-realignment-smoke',real_sillytavern:true,provider:'GG',model:GG.model,rpm_limit:2,delay_ms:GG.delayMs,scope_note:'Exact V4 changed core modules + existing core slice; static full JSON validation is separate. This is not a full browser prompt-manager import.',results},null,2));
for(const r of results)await fs.writeFile(path.join(OUT,`${r.scene}-v4.txt`),r.content||`ERROR ${JSON.stringify(r.error)}`);
await fs.writeFile(path.join(OUT,'summary-v4.txt'),results.map(r=>`${r.scene}/v4: ${r.status} HTTP=${r.http_status} ms=${r.elapsed_ms} prompt=${r.prompt_chars} stats=${JSON.stringify(r.stats||{})}`).join('\n')+'\n');
if(results.some(r=>r.status!=='ok'))process.exitCode=2;
