import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const manifest=await read('manifest.json');
for(const[name,sha]of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex'),sha,name);
const variants={};
for(const v of ['baseline','fixed']){
 const report=await read(v+'/commit-replay.json');variants[v]=report;
 assert.equal(report.controlledReplay,true);assert.equal(report.naturalGeneration,false);assert.equal(report.phoneInstalled,false);
 assert.equal(report.cardModified,v==='fixed');assert.equal(report.failures.length,0);assert.equal(report.errors.length,0);
 assert.equal(report.rounds.length,2);
 for(const id of ['morning','patrol']){
  const row=await read(v+'/'+id+'.json');assert.deepEqual(row,report.rounds.find(r=>r.id===id));
  assert.ok(row.checks.every(x=>x.passed));
  assert.equal(row.independentSeed,id==='patrol');
  if(v==='baseline'){
   assert.equal(Object.hasOwn(row,'after'),false);assert.equal(row.terminal.status,'empty');assert.ok(row.stale.length>0);
   for(const d of row.stale){assert.ok(d.epochMatch&&d.chatMatch&&d.characterMatch&&d.groupMatch&&d.messageCountMatch);
    assert.ok(d.messages.every(m=>m.identityMatch&&m.swipeMatch&&m.trimmedTextMatch));
    const changed=d.messages.filter(m=>!m.textMatch);assert.equal(changed.length,1);assert.equal(changed[0].newLength-changed[0].oldLength,2);assert.equal(changed[0].newTrailing,'\n\n');
   }
  }else{
   assert.equal(row.stale.length,0);assert.equal(row.terminal.status,'ready');
   assert.equal(row.after.clock_minutes,id==='morning'?480:560);
   assert.ok(row.timeline.some(x=>x.status==='empty'));
   const ready=row.timeline.filter(x=>x.status==='ready');assert.ok(ready.length>0);assert.ok(ready.every(x=>x.clock===row.after.clock_minutes));
   assert.ok(row.publications.some(x=>x.id===2&&x.result&&x.clock===row.after.clock_minutes));
   if(id==='morning'){assert.equal(row.after.morning_flags.day6_monologue,false);assert.equal(row.after.morning_flags.day6_saiham,true);}
   else assert.equal(row.terminal.snapshot.header.timeLabel,'09:20');
  }
 }
}
for(const id of ['morning','patrol'])assert.equal(variants.baseline.rounds.find(r=>r.id===id).text,variants.fixed.rounds.find(r=>r.id===id).text);
const smoke=await read('isolation/实机验收记录.json');
assert.equal(smoke['场景'].length,34);assert.ok(smoke['场景'].every(x=>x['结果']==='通过'));
assert.equal(smoke['浏览器页面异常'].length,0);assert.equal(smoke['消费端'],'未安装小手机；无界面测试');
console.log('原版误拒绝与修正版真实提交对照、原始文件散列、34项同装回归证据复核通过；晨间守卫与自然模型验证仍待后续完成。');
