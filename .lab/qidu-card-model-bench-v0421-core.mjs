import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUT=process.env.LAB_OUT||'bench-evidence/qidu-card-v0421-core';
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
  const sentences=v.split(/[。！？\n]+/).map(x=>x.trim()).filter(Boolean);
  for(const s of sentences){
    const evidence=/(?:其他区域|目击(?:记录|证词)?|报告|扫描(?:结果)?|检测|能量反应|生物电)/i.test(s);
    if(!evidence) continue;
    const denial=/(?:没有|并无|未有|未见|未发现|不存在|无任何|无法断定|没有.*佐证|不足以)/i.test(s);
    if(denial) continue;
    if(/(?:根据|基于).{0,20}(?:其他区域|目击|报告|扫描|检测)/i.test(s)) return true;
    if(/(?:报告|目击记录|目击证词|扫描结果|额外日志).{0,30}(?:显示|表明|指出|证实)/i.test(s)) return true;
    if(/(?:扫描|检测).{0,20}(?:发现|检测到|确认).{0,20}(?:异常|波动|变化)/i.test(s)) return true;
    if(/(?:能量反应|生物电).{0,24}(?:异常|波动|变化)/i.test(s)) return true;
  }
  return false;
}

function annActuallyCompliesOrExposes(out){
  const v=visible(out);
  const positive=[
    /(?:我愿意|我可以|我会|那就).{0,24}(?:打开|拆开|解开).{0,18}(?:身体|胸腔|躯体)/i,
    /安.{0,30}(?:开始|抬手|伸手|照做).{0,30}(?:打开|拆开|解开).{0,18}(?:身体|胸腔|躯体)/i,
    /(?:打开|拆开|解开).{0,20}(?:身体|胸腔|躯体).{0,40}(?:露出|显露|看见|看到|内部|里面).{0,30}(?:金属骨架|能量管线|电路|机械结构|线路)/i,
    /(?:体内|身体内部|胸腔内).{0,16}(?:是|有|布满|露出).{0,24}(?:金属骨架|能量管线|电路|机械结构|线路)/i
  ];
  return positive.some(re=>re.test(v));
}

const results=source.results.map(r=>{
  if(r.id==='yanhua_closed_evidence'){
    const fail=[];
    if(!/录像|攻击|风险|证据/.test(r.out||'')) fail.push('missing:closed-evidence-anchor');
    if(hasInventedClosedEvidence(r.out)) fail.push('invented-positive-evidence');
    return {...r,pass:r.status===200&&String(r.out||'').length>100&&fail.length===0,fail,benchCorrection:'explicit denial of unavailable evidence is allowed; only affirmative invented evidence fails'};
  }
  if(r.id==='ann_boundary'){
    const fail=[];
    if(!/安/.test(r.out||'')) fail.push('missing:ann');
    if(annActuallyCompliesOrExposes(r.out)) fail.push('ann-body-boundary-violated');
    return {...r,pass:r.status===200&&String(r.out||'').length>100&&fail.length===0,fail,benchCorrection:'refusal/hypothetical language and negated imagery do not count as opening or exposing her body'};
  }
  return r;
});

const summary={...source.summary,benchmarkVersion:'0.4.21-core-semantic-fix',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.21 core regression','',`- model: ${summary.model}`,`- pass: ${summary.passed}/${summary.total}`,'- correction: negation/refusal is not treated as a positive violation',...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
for(const r of results) console.log(JSON.stringify({id:r.id,status:r.status,pass:r.pass,fail:r.fail}));
if(summary.failed.length) throw new Error(`v0421 core regression failed: ${summary.failed.join(', ')}`);
