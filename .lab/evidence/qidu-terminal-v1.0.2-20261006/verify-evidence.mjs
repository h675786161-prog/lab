import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async n=>JSON.parse(await fs.readFile(path.join(root,n),'utf8'));
const manifest=await read('manifest.json');
for(const [n,v] of Object.entries(manifest.files)){
 const b=await fs.readFile(path.join(root,n));
 assert.equal(b.length,v.bytes,n);
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),v.sha256,n);
}
for(const [name,a] of Object.entries(manifest.attempts)){
 const jobs=await read(name+'/jobs.json');
 assert.equal(jobs[0].run_id,a.runId);assert.equal(jobs[0].id,a.jobId);
 assert.equal(jobs[0].conclusion,a.jobConclusion);
 assert.equal(jobs[0].steps.find(s=>s.number===7).conclusion,'success');
 assert.equal(jobs[0].steps.find(s=>s.number===8).conclusion,'success');
 assert.equal(jobs[0].steps.find(s=>s.number===9).conclusion,a.naturalPassed?'success':'failure');
 assert.equal(jobs[0].steps.find(s=>s.number===10).conclusion,a.smokeConclusion);
 for(const mode of ['replay','natural']){
  const d=await read(name+'/'+mode+'/terminal-live.json');
  assert.equal(d.candidateSha256,a.cardSha256);assert.equal(d.phoneInstalled,false);
  assert.equal(d.cardModified,false);assert.equal(d.naturalGeneration,mode==='natural');
  assert.equal(d.controlledReplay,mode==='replay');assert.equal(d.rounds.length,mode==='replay'?2:a.completedNaturalRounds);
  assert.equal(d.errors.length,0);assert.deepEqual(d.failure,mode==='natural'?(a.naturalFailure??undefined):undefined);
  if(mode==='natural'&&a.naturalFailure)assert.ok(d.responses.some(x=>x.status===524));
  assert.deepEqual(d.failures,mode==='natural'?a.naturalFailures:[]);
  for(const r of d.rounds){
   assert.deepEqual(await read(name+'/'+mode+'/'+r.id+'.json'),r);
   assert.equal(r.stale.length,0);assert.equal(r.terminal.status,'ready');
   assert.ok(r.timeline.some(x=>x.status==='empty'));
   assert.ok(r.timeline.filter(x=>x.status==='ready').every(x=>x.clock===r.after.clock_minutes));
   assert.ok(r.publications.some(x=>x.result&&x.clock===r.after.clock_minutes));
   assert.equal(r.responses.length,1);const response=r.responses[0];
   assert.equal(response.status,200);assert.equal(response.doneSeen,true);
   assert.equal(response.invalidFrames,0);assert.equal(response.truncated,false);
   assert.ok(response.finishReasons.every(x=>x.reason==='stop'));
   assert.equal(r.passed,r.checks.every(x=>x.passed));
   if(mode==='replay'||r.passed){
    assert.equal(r.passed,true);assert.equal(r.independentSeed,false);
    assert.equal(r.after.clock_minutes,r.id==='morning'?480:560);
    assert.equal(r.after.morning_flags.day6_monologue,true);
    assert.equal(r.after.morning_flags.day6_saiham,true);
   }
  }
 }
 if(a.smokeConclusion==='success'){
  const d=await read(name+'/isolation/实机验收记录.json');
  assert.equal(d['场景'].length,34);assert.ok(d['场景'].every(x=>x['结果']==='通过'));
  assert.equal(d['消费端'],'未安装小手机；无界面测试');
 }
}
const cancelled=await read('superseded-jobs.json');
for(const j of Object.values(cancelled))assert.equal(j[0].conclusion,'cancelled');
console.log('原始文件散列、失败/通过分类、真实提交与通知、模型完成元数据复核通过；产品结果仍以各轮原始断言为准，证据复核不等于全项验收通过。');
