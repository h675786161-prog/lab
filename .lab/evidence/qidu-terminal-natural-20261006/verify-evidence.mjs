import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const manifest=await read('manifest.json');
for(const [name,hash] of Object.entries(manifest.files)){
 const actual=crypto.createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex');
 assert.equal(actual,hash,`${name} evidence hash`);
}
const report=await read('natural-live.json');
assert.equal(report.candidateSha256,manifest.candidateSha256);
assert.equal(report.cardModified,false);
assert.equal(report.phoneInstalled,false);
assert.equal(report.naturalGeneration,true);
assert.equal(report.requests.length,2);
assert.equal(report.responses.length,2);
assert.equal(report.failures.length,6);
assert.equal(report.runtimeLog.filter(x=>x.includes('Error: 七都：过期变量事务已取消')).length,2);
for(const id of ['morning','patrol']){
 const row=await read(id+'.json');
 assert.deepEqual(row,report.rounds.find(r=>r.id===id));
 assert.equal(row.passed,false);
 assert.equal(row.is_user,false);
 assert.equal(row.hasUpdateVariable,true);
 assert.equal(Object.hasOwn(row,'after'),false,'assistant message has no committed stat_data');
 assert.equal(row.terminal.status,'empty');
 assert.equal(row.terminal.snapshot,null);
 assert.ok(row.stale.length>0);
 assert.ok(row.timeline.every(x=>x.status==='empty'));
 assert.ok(row.publications.every(x=>x.id!==2),'no assistant message publication');
 const response=row.responses[0];
 assert.equal(response.status,200);
 assert.ok(response.finishReasons.every(x=>x.reason==='stop'));
 assert.equal(response.finishReasonKnown,true);
 assert.equal(response.doneSeen,true);
 assert.equal(response.invalidFrames,0);
 assert.equal(response.truncated,false);
 const commandPaths=phase=>row.commands.filter(x=>x.phase===phase).flatMap(x=>x.commands.map(c=>c.args?.[0]));
 if(id==='morning'){
  assert.equal(row.independentSeed,false);
  assert.ok(commandPaths('before').includes("'morning_flags.day6_monologue'"));
  assert.ok(!commandPaths('after').includes("'morning_flags.day6_monologue'"));
  assert.ok(commandPaths('after').includes("'morning_flags.day6_saiham'"));
 }else{
  assert.equal(row.independentSeed,true);
  assert.ok(row.commands.filter(x=>x.phase==='after').flatMap(x=>x.commands).some(c=>c.args?.[0]==="'clock_minutes'"&&c.args?.[2]==='560'));
  assert.ok(report.runtimeLog.some(x=>x.includes("Set 'clock_minutes' to '560'")));
 }
}
console.log('证据完整性与失败事实复核通过；产品自然生成验收仍为失败（6项断言失败）。');
