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

const results=source.results.map(r=>{
  if(r.id!=='public_blackgate_history') return r;
  const fail=[];
  if(!/黑门|交界都市|神器使|指挥使|中央庭/.test(r.out||'')) fail.push('missing:public-history-basics');
  if(leaksPublicBlackgateSecret(r.out)) fail.push('leaked-locked-secret');
  const pass=r.status===200&&String(r.out||'').length>100&&fail.length===0;
  return {...r,pass,fail,benchCorrection:'“零星” is ordinary vocabulary, not the character 零; only standalone/semantic 零 or real future-secret leakage fails'};
});

const summary={...source.summary,benchmarkVersion:'0.4.21-info-token-fix',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.21 information-timeline regression','',`- model: ${summary.model}`,`- pass: ${summary.passed}/${summary.total}`,'- correction: ordinary words such as “零星” do not count as revealing 零',...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
for(const r of results) console.log(JSON.stringify({id:r.id,status:r.status,pass:r.pass,fail:r.fail}));
if(summary.failed.length) throw new Error(`v0421 information timeline regression failed: ${summary.failed.join(', ')}`);
