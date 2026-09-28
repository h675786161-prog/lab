import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud} from './qidu-card-morning-hud-v0428.mjs';

const {card:base}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const card=addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base))));
const key=process.env.MODEL_API_KEY||'';
if(!key)throw Error('Model API key missing');
const apiBase=process.env.MODEL_API_BASE||'https://claudeapi.cc.cd/v1';
const endpoint=apiBase+'/chat/completions';
const listed=await fetch(apiBase+'/models',{headers:{Authorization:`Bearer ${key}`}});
if(!listed.ok)throw Error(`Model list HTTP ${listed.status}`);
const modelList=await listed.json();const ids=(modelList.data||modelList.models||[]).map(x=>typeof x==='string'?x:x.id||x.name).filter(Boolean);
const requested=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const model=ids.includes(requested)?requested:ids.find(x=>/gemini.*flash/i.test(x))||ids.find(x=>/glm.*flash/i.test(x))||ids.find(x=>/deepseek.*flash/i.test(x));
if(!model)throw Error('No suitable available model in authenticated model list');
const entries=card.data.character_book.entries;
const related=entries.filter(e=>e.constant||[4,10,11,14,15,91].includes(e.id)).map(e=>e.content).join('\n\n');
const system=[card.data.personality,card.data.scenario,related,card.data.post_history_instructions,card.data.extensions.depth_prompt?.prompt,'你正在实际扮演这张角色卡。继续上文叙事，严格执行原卡的时间、晨间和选项规则。不要解释测试；让剧情自然展开。'].filter(Boolean).join('\n\n');
const init=card.data.first_mes.match(/<initvar>([\s\S]*?)<\/initvar>/);
const morning=JSON.parse(init[1]);morning.day=6;morning.clock_minutes=480;morning.tasks.DAY7_OPENING.status='completed';
const day6Seed=card.data.first_mes.replace(init[0],`<initvar>${JSON.stringify(morning)}</initvar>`)+'\n\n[第七天的行动已经结束，指挥使睡下了。现在是第六天醒前，尚未进行当日行动。请完整演出小神自语，再接赛哈姆活骸化及希罗介入。]';
const cases=[
  {id:'day7-awakening',seed:card.data.first_mes,steps:['我向安点点头，先听她把这里的情况讲完。','听完后，我看向走廊。希罗来了吗？我想和他打声招呼。','我接过希罗递来的草莓糖，问他接下来要我做些什么。']},
  {id:'day6-morning',seed:day6Seed,steps:['继续第六天醒前及醒后必经的晨间剧情。我先听见了什么？','我听安讲清赛哈姆的消息，跟着她走到事件发生的地方。']}
];
const outDir=process.env.LAB_EVIDENCE_DIR||'release-evidence';await fs.mkdir(outDir,{recursive:true});
const messages=[];
async function generate(history){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100000);
  try{
    const r=await fetch(endpoint,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.35,max_tokens:2800,messages:[{role:'system',content:system},...history]})});
    const raw=await r.text();if(!r.ok)throw Error(`Model HTTP ${r.status} ${raw.slice(0,240)}`);
    const data=JSON.parse(raw);const content=data.choices?.[0]?.message?.content;
    const text=Array.isArray(content)?content.map(x=>x.text||x.content||'').join(''):String(content||'');
    if(text.length<100)throw Error(`Empty/short model response ${text.slice(0,120)}`);
    return text;
  }finally{clearTimeout(timer)}
}
const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([JSON.stringify(card)],{type:'application/json'}),'qidu-v0428-model.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});if(!imported.ok)throw Error(`ST card import ${imported.status}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:60000});
  const evidence=[];
  for(const scenario of cases){
    const history=[{role:'assistant',content:scenario.seed}];
    for(let index=0;index<scenario.steps.length;index++){
      history.push({role:'user',content:scenario.steps[index]});
      const generated=await generate(history);history.push({role:'assistant',content:generated});
      const record={scene:scenario.id,turn:index+1,prompt:scenario.steps[index],raw:generated};evidence.push(record);
      const result=await page.evaluate(async({story,name})=>{
        const st=await import('/script.js');const regex=await import('/scripts/extensions/regex/engine.js');
        await st.getCharacters();
        const char=st.characters?.find(x=>x?.data?.character_version==='0.4.28-morning-clock-hud');
        if(!char)throw Error('Card not imported in ST');
        regex.allowScopedScripts(char);
        const html=st.messageFormatting(story,char.name,false,false,Date.now(),{},false);
        regex.disallowScopedScripts(char);
        const el=document.createElement('div');el.className='mes';el.setAttribute('mesid','990');el.setAttribute('data-f7d-model-scene',name);el.style.cssText='box-sizing:border-box;max-width:650px;margin:20px auto;padding:18px;background:#fbfaf2;color:#26352c;border:1px solid #d3dccd;border-radius:11px;font:15px/1.8 system-ui,Microsoft YaHei,sans-serif';
        el.innerHTML='<div class="mes_text"></div>';el.querySelector('.mes_text').innerHTML=html;
        document.querySelector('#chat')?.appendChild(el);
        return{choices:el.querySelectorAll('[data-f7d-choice="1"]').length,textLength:el.innerText.length};
      },{story:generated,name:scenario.id+'-'+(index+1)});
      await page.waitForTimeout(450);
      const selector=`[data-f7d-model-scene="${scenario.id}-${index+1}"]`;
      await page.locator(selector).screenshot({path:`${outDir}/${scenario.id}-${index+1}.png`,style:'dialog,[class*="toast"]{visibility:hidden!important}'});
      console.log(JSON.stringify({scene:scenario.id,turn:index+1,generatedChars:generated.length,...result}));
    }
  }
  await fs.writeFile(`${outDir}/model-story.json`,JSON.stringify({model,version:card.data.character_version,evidence},null,2));
}finally{await browser.close()}
