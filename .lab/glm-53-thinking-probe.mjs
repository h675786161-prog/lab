import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const KEY = process.env.YOUZI || '';

async function post(url, body, timeout=120000){
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), timeout);
  try {
    const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:c.signal});
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = {raw:text}; }
    return {status:r.status, ok:r.ok, data};
  } finally { clearTimeout(t); }
}

await fs.mkdir(OUT,{recursive:true});
if(!KEY) throw new Error('YOUZI secret missing');
const sec = await post(`${BASE}/api/secrets/write`, {key:'api_key_custom', value:KEY, label:'glm-53-thinking-probe'}, 30000);
if(!sec.ok) throw new Error(`secret write failed ${sec.status}`);

const payload = {
  chat_completion_source:'custom',
  custom_url:'https://youzi.today/v1',
  custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',
  model:'[B]glm-5.3-flash',
  messages:[{role:'user',content:'只回复“收到”。不要解释。'}],
  temperature:0.2,
  max_tokens:1200,
  stream:false,
};
const started=Date.now();
const r=await post(`${BASE}/api/backends/chat-completions/generate`, payload, 120000);
const msg=r.data?.choices?.[0]?.message || {};
const out={
  provider:'YOUZI', model:'[B]glm-5.3-flash', real_sillytavern:true,
  request:{thinking:{type:'enabled'},reasoning_effort:'low',max_tokens:1200},
  http_status:r.status, elapsed_ms:Date.now()-started,
  content:String(msg.content||''),
  reasoning_chars:String(msg.reasoning_content||msg.reasoning||'').length,
  finish_reason:r.data?.choices?.[0]?.finish_reason||null,
  error:r.data?.error||null,
};
await fs.writeFile(path.join(OUT,'glm-53-thinking-probe.json'), JSON.stringify(out,null,2));
console.log(JSON.stringify({...out, content:out.content.slice(0,80)}));
if(!r.ok || !out.content) process.exitCode=2;
