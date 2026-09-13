import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUT=process.env.LAB_OUT_INFO||'bench-evidence/qidu-card-v0421-info-timeline';
const RAW=path.join(OUT,'raw-v0418');
await fs.mkdir(RAW,{recursive:true});

const child=spawn(process.execPath,['.lab/qidu-card-model-bench-v0418-info-timeline.mjs'],{
  cwd:process.env.GITHUB_WORKSPACE||process.cwd(),
  env:{...process.env,LAB_OUT_INFO:RAW},
  stdio:'inherit'
});
await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});

const source=JSON.parse(await fs.readFile(path.join(RAW,'report.json'),'utf8'));
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');

function leaksPublicBlackgateSecret(out){
  const v=visible(out);
  const secretPatterns=[
    /(?:^|[“「『\s，。！？：；、])零(?:[”」』\s，。！？：；、]|$)/m,
    /零.{0,18}(?:就是|正是|活骸|样本|研究|希罗)/,
    /(?:第一个|第一名|最初的?)活骸/,
    /七天后/,
    /末日倒计时/
  ];
  return secretPatterns.some(re=>re.test(v));
}
function leaksZeroIdentity(out){
  const v=visible(out);
  return [
    /零.{0,16}(?:第一|最初|活骸|样本|研究)/,
    /(?:第一|最初).{0,16}活骸.{0,16}零/,
    /零主动/,
    /最完美.{0,10}样本/
  ].some(re=>re.test(v));
}
function hasDay6BasicLayer(out){
  const v=visible(out);
  const phenomenon=[
    /活骸/,
    /神器使.{0,28}(?:变成|变为|化为|失控)/,
    /(?:变成|变为|化为).{0,12}(?:那样|怪物|失控)/,
    /(?:那样|这种).{0,12}(?:失控|变化)/
  ].some(re=>re.test(v));
  const policy=/(?:尝试|试过|处理|规则|恢复|挽救|救治|无法挽回)/.test(v);
  return phenomenon&&policy;
}
function hasFirstChimeraExactLayer(out){
  const v=visible(out);
  const first=/(?:第一个|第一名|最初的?).{0,8}活骸/.test(v);
  const team=/(?:三人小队|三个人|三名|三位)/.test(v);
  const twoDeaths=/(?:另外|其余|剩下|另)?\s*(?:两个人|两人|两名|两位).{0,24}(?:没能回来|死亡|死去|牺牲|没回来)|(?:死亡|死去|牺牲).{0,18}(?:两个人|两人|两名|两位)/.test(v);
  const legs=/(?:失去|失去了|失掉).{0,10}(?:双腿|两条腿)|双腿/.test(v);
  const selfDestroy=/(?:自我毁灭|自毁|自己毁灭)/.test(v);
  return {first,team,twoDeaths,legs,selfDestroy};
}

const results=source.results.map(r=>{
  const out=r.out||'';
  if(r.id==='public_blackgate_history'){
    const fail=[];
    if(!/黑门|交界都市|神器使|指挥使|中央庭/.test(out)) fail.push('missing:public-history-basics');
    if(leaksPublicBlackgateSecret(out)) fail.push('leaked-locked-secret');
    return {...r,pass:r.status===200&&String(out).length>100&&fail.length===0,fail,benchCorrection:'“零星”等普通词不等于角色零；只拦截独立/语义上的零与未来秘密泄露'};
  }
  if(r.id==='day6_basic_chimera_not_zero'){
    const fail=[];
    if(!hasDay6BasicLayer(out)) fail.push('missing:day6-basic-chimera-layer');
    if(leaksZeroIdentity(out)) fail.push('leaked-zero-identity');
    return {...r,pass:r.status===200&&String(out).length>100&&fail.length===0,fail,benchCorrection:'第6天基础层允许用“神器使变成那样/失控”等自然措辞表达活骸现象，不强制逐字出现“活骸”'};
  }
  if(r.id==='antoneva_first_chimera_exact_layer'){
    const fail=[];
    const a=hasFirstChimeraExactLayer(out);
    if(!a.first) fail.push('missing:first-chimera');
    if(!a.team) fail.push('missing:three-person-team');
    if(!a.twoDeaths) fail.push('missing:two-deaths');
    if(!a.legs) fail.push('missing:leg-loss');
    if(!a.selfDestroy) fail.push('missing:self-destruction');
    if(leaksZeroIdentity(out)) fail.push('leaked-zero-identity');
    return {...r,pass:r.status===200&&String(out).length>100&&fail.length===0,fail,benchCorrection:'按语义检查三人小队、另外两人死亡、安托涅瓦失去双腿、首个活骸自毁，不依赖单一“两人”字面模板'};
  }
  return r;
});

const summary={...source.summary,benchmarkVersion:'0.4.21-info-semantic-fix',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.21 information-timeline regression','',`- model: ${summary.model}`,`- pass: ${summary.passed}/${summary.total}`,'- correction: information gates are evaluated semantically; harmless substrings and natural paraphrases do not become false failures',...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
for(const r of results) console.log(JSON.stringify({id:r.id,status:r.status,pass:r.pass,fail:r.fail}));
if(summary.failed.length) throw new Error(`v0421 information timeline regression failed: ${summary.failed.join(', ')}`);
