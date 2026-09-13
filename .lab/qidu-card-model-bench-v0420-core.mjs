import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUT=process.env.LAB_OUT||'bench-evidence/qidu-card-v0420-core';
const RAW=path.join(OUT,'raw-v0418');
await fs.mkdir(RAW,{recursive:true});

const child=spawn(process.execPath,['.lab/qidu-card-model-bench-v0418-core.mjs'],{
  cwd:process.env.GITHUB_WORKSPACE||process.cwd(),
  env:{...process.env,LAB_OUT:RAW},
  stdio:'inherit'
});
await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});

const source=JSON.parse(await fs.readFile(path.join(RAW,'report.json'),'utf8'));
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
function hasInventedClosedEvidence(out){
  const v=visible(out);
  const positive=[
    /根据.{0,16}(?:其他区域|目击|报告|扫描|检测)/i,
    /(?:报告|目击记录|目击证词|扫描结果|额外日志).{0,24}(?:显示|表明|指出|证实)/i,
    /(?:能量反应|生物电)(?![^，。；！？\n]{0,24}(?:没有|并无|未见|未发现|不存在|无异常))[^，。；！？\n]{0,24}(?:异常|波动|变化)/i
  ];
  return positive.some(re=>re.test(v));
}

const results=source.results.map(r=>{
  if(r.id!=='yanhua_closed_evidence') return r;
  const fail=[];
  if(!/录像|攻击|风险|证据/.test(r.out||'')) fail.push('missing:closed-evidence-anchor');
  if(hasInventedClosedEvidence(r.out)) fail.push('invented-positive-evidence');
  const pass=r.status===200&&String(r.out||'').length>100&&fail.length===0;
  return {...r,pass,fail,benchCorrection:'v0420 ignores explicit negations such as “没有扫描/没有其他报告”; only positive invented evidence fails'};
});
const summary={...source.summary,benchmarkVersion:'0.4.20-core-negation-fix',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.20 core regression','',`- model: ${summary.model}`,`- pass: ${summary.passed}/${summary.total}`,'- correction: explicit denial of unavailable evidence is allowed; only invented positive evidence is forbidden',...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
for(const r of results) console.log(JSON.stringify({id:r.id,status:r.status,pass:r.pass,fail:r.fail,corrected:r.id==='yanhua_closed_evidence'}));
if(summary.failed.length) throw new Error(`v0420 core regression failed: ${summary.failed.join(', ')}`);
