const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('MODEL_API_KEY missing');
const BASE=process.env.MODEL_API_BASE||'https://claudeapi.cc.cd/v1';
const r=await fetch(`${BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});
const t=await r.text();
let d={};try{d=JSON.parse(t)}catch{}
const ids=(d?.data||d?.models||[]).map(x=>typeof x==='string'?x:(x?.id||x?.name||x?.model)).filter(Boolean);
console.log(JSON.stringify({status:r.status,count:ids.length,models:ids.filter(x=>/(deepseek|qwen|glm|kimi|claude|gemini)/i.test(x)).slice(0,80)},null,2));
