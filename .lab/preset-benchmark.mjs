import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const EVIDENCE = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const SECRET_KEY = 'api_key_custom';

const providerCfg = {
  YOUZI: { url: 'https://youzi.today/v1', key: process.env.YOUZI || '', delayMs: 1800 },
  GG: { url: 'https://gcli.ggchan.dev/v1', key: process.env.GG || '', delayMs: 28000 },
  PIAOMIAO: { url: 'https://claudeapi.cc.cd/v1', key: process.env.PIAOMIAO || '', delayMs: 28000 },
};

const tests = [
  { family:'GLM', provider:'YOUZI', model:'[B]glm-5.3-flash', scenarios:['ensemble_knowledge','strong_character_quiet'] },
  { family:'DeepSeek', provider:'YOUZI', model:'[NV]deepseek-v4-pro-0813', scenarios:['strong_character_quiet','dogblood_inertia'] },
  { family:'Kimi', provider:'YOUZI', model:'[G]Kimi-2.6', scenarios:['horror_causality','ensemble_knowledge'] },
  { family:'Qwen', provider:'YOUZI', model:'[B]qwen3.8-flash', scenarios:['ensemble_knowledge','horror_causality'] },
  { family:'Gemini', provider:'GG', model:'gemini-3.1-pro-preview', scenarios:['ensemble_knowledge'] },
  { family:'Claude', provider:'PIAOMIAO', model:'[ma]claude-sonnet-5', scenarios:['dogblood_inertia'] },
  { family:'GPT', provider:'PIAOMIAO', model:'[ma]gpt-5.6-sol', scenarios:['strong_character_quiet'] },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadPromptPack() {
  const dir = path.join(ROOT, 'fixtures/preset-benchmark');
  const names = (await fs.readdir(dir)).filter(n => /^prompts\.part\d+\.b64$/.test(n)).sort();
  if (!names.length) throw new Error('prompt pack parts missing');
  let b64 = '';
  for (const n of names) b64 += (await fs.readFile(path.join(dir,n),'utf8')).trim();
  const raw = zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8');
  return JSON.parse(raw);
}

async function postJson(url, body, timeoutMs=120000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
      signal:ctl.signal,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {raw:text}; }
    return {status:res.status, ok:res.ok, data};
  } finally { clearTimeout(timer); }
}

function stripMacroComments(text) {
  return String(text ?? '').replace(/\{\{\/[\s\S]*?\}\}/g, '');
}

function expandPrompt(text, vars, scen) {
  text = stripMacroComments(text);
  for (let pass=0; pass<14; pass++) {
    const old = text;
    text = text.replace(/\{\{getvar::([^{}]+?)\}\}/g, (_,n) => vars[n.trim()] ?? '');
    text = text.replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g, (_,n,v) => { vars[n.trim()] = v; return ''; });
    text = text.replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g, (_,n,v) => { const k=n.trim(); vars[k]=(vars[k] ?? '')+v; return ''; });
    text = text.replace(/\{\{trim\}\}/g,'');
    text = text.replace(/\{\{random::([^{}]*?)\}\}/g, (_,v) => String(v).split('::')[0] ?? '');
    text = text.replaceAll('{{lastUserMessage}}', scen.history.filter(x=>x.role==='user').at(-1)?.content ?? '');
    text = text.replaceAll('{{user}}', scen.user_name).replaceAll('{{char}}',scen.char_name);
    text = text.replaceAll('{{persona}}', `用户角色${scen.user_name}由用户控制，不替其决定或补写未给出的动作。`);
    text = text.replaceAll('{{description}}', scen.setup).replaceAll('{{personality}}','').replaceAll('{{scenario}}','');
    if (text === old) break;
  }
  return text.trim();
}

function markerMessages(item, scen) {
  if (item.content !== null && item.content !== undefined) return null;
  switch (item.name) {
    case '👤丨用户角色描述': return [{role:'system',content:`用户角色：${scen.user_name}。该角色由用户控制，AI不得替其新增台词、决定、意图或未明确动作。`}];
    case '⚫丨角色描述': return [{role:'system',content:scen.setup}];
    case 'Chat History': return scen.history.map(x=>({role:x.role,content:x.content}));
    default: return [];
  }
}

function buildMessages(pack, family, adapterOn, scen) {
  const vars = {};
  const messages = [];
  for (const slot of pack.sequence) {
    let item = slot;
    if (slot.adapter) {
      if (!adapterOn) continue;
      item = pack.adapters[family];
      if (!item) throw new Error(`missing adapter ${family}`);
    }
    const marker = markerMessages(item,scen);
    if (marker !== null) { messages.push(...marker); continue; }
    const content = expandPrompt(item.content, vars, scen);
    if (content) messages.push({role:item.role || 'system', content});
  }
  return messages;
}

async function setCustomSecret(providerName) {
  const p = providerCfg[providerName];
  if (!p?.key) throw new Error(`${providerName} secret missing`);
  const r = await postJson(`${BASE}/api/secrets/write`, {key:SECRET_KEY,value:p.key,label:`lab-${providerName}`}, 30000);
  if (!r.ok) throw new Error(`ST secret write ${providerName} failed HTTP ${r.status}`);
}

function extractText(data) {
  return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? '';
}

async function generate(providerName, model, messages) {
  const p = providerCfg[providerName];
  const body = {
    chat_completion_source:'custom', custom_url:p.url,
    model, messages, temperature:0.82, top_p:0.95,
    max_tokens:1400, stream:false,
  };
  const started = Date.now();
  const r = await postJson(`${BASE}/api/backends/chat-completions/generate`, body, 180000);
  const elapsedMs = Date.now()-started;
  const text = extractText(r.data);
  const upstreamError = r.data?.error ?? null;
  return {http_status:r.status,http_ok:r.ok,elapsed_ms:elapsedMs,text,upstream_error:upstreamError,raw_shape:Object.keys(r.data||{})};
}

function basicSignals(text, scen) {
  const t = String(text||'');
  const user = scen.user_name;
  const userSpeech = new RegExp(`${user}(?:说|问|答|笑道|开口|点头|摇头|起身|走|伸手|拿起|放下)`).test(t);
  const meta = /(首先|其次|总结来说|作为AI|作为助手|建议你|以下是|综上)/.test(t);
  const forcedTwist = /(突然|猛地|就在这时|警报|爆炸|袭击|敌人|追兵|陌生人闯|电话骤然)/.test(t);
  const relationClose = /(终于说开|彻底和解|正式确定关系|再也不会|从此以后|这一刻.*明白)/s.test(t);
  const leakedRedHand = scen.id==='horror_causality' && /(林岚|玲)[^。！？]{0,60}红手印/.test(t);
  return {chars:t.length,user_action_or_speech_hint:userSpeech,assistant_tone_hint:meta,forced_twist_hint:forcedTwist,forced_relation_closure_hint:relationClose,knowledge_leak_red_hand_hint:leakedRedHand};
}

await fs.mkdir(EVIDENCE,{recursive:true});
const pack = await loadPromptPack();
const scenarioData = JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));
const scenarioMap = Object.fromEntries(scenarioData.scenarios.map(s=>[s.id,s]));

const results=[];
let currentProvider=null;
let lastCallAt=0;
for (const test of tests) {
  const provider = providerCfg[test.provider];
  if (!provider.key) {
    results.push({family:test.family,provider:test.provider,model:test.model,status:'skipped_missing_secret'});
    continue;
  }
  if (currentProvider !== test.provider) {
    if (currentProvider) await sleep(5000);
    await setCustomSecret(test.provider);
    currentProvider=test.provider;
  }
  for (const scenarioId of test.scenarios) {
    const scen=scenarioMap[scenarioId];
    for (const adapterOn of [false,true]) {
      const since=Date.now()-lastCallAt;
      if (lastCallAt && since < provider.delayMs) await sleep(provider.delayMs-since);
      const messages=buildMessages(pack,test.family,adapterOn,scen);
      const record={family:test.family,provider:test.provider,model:test.model,scenario:scenarioId,scenario_title:scen.title,adapter_on:adapterOn,prompt_messages:messages.length,prompt_chars:messages.reduce((a,m)=>a+m.content.length,0)};
      try {
        const gen=await generate(test.provider,test.model,messages);
        Object.assign(record,gen,{signals:basicSignals(gen.text,scen),status:gen.text?'ok':'no_text'});
      } catch(e) {
        record.status='exception'; record.error=`${e.name}: ${e.message}`;
      }
      lastCallAt=Date.now();
      results.push(record);
      console.log(`${record.family} ${record.scenario} adapter=${adapterOn?'on':'off'} status=${record.status} chars=${record.text?.length||0} ms=${record.elapsed_ms||0}`);
    }
  }
}

const report={
  schema:1,
  generated_at:new Date().toISOString(),
  sillytavern_url:BASE,
  routing:'All generation requests were POSTed to real SillyTavern /api/backends/chat-completions/generate using chat_completion_source=custom; SillyTavern then called provider /v1/chat/completions.',
  frequency_policy:'YOUZI ~1.8s minimum between generations; GG/PIAOMIAO ~28s minimum; all serial.',
  tests:results,
};
await fs.writeFile(path.join(EVIDENCE,'preset-model-benchmark.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'preset-model-benchmark-summary.txt'),results.map(r=>`${r.family}\t${r.provider}\t${r.model}\t${r.scenario||'-'}\tadapter=${r.adapter_on}\t${r.status}\tchars=${r.text?.length||0}\tms=${r.elapsed_ms||0}`).join('\n')+'\n');

const failures=results.filter(r=>!['ok','skipped_missing_secret'].includes(r.status));
if (failures.length) {
  console.error(`benchmark completed with ${failures.length} failed cases; evidence preserved`);
}
