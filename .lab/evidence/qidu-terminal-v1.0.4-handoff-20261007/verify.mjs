import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url);
const index=JSON.parse(await fs.readFile(new URL('evidence.json',root),'utf8'));
let rawCount=0,stageCount=0;
for(const attempt of index.attempts){
 for(const stage of attempt.stages){
  const data=JSON.parse(await fs.readFile(new URL(attempt.directory+'/'+stage+'.json',root),'utf8'));
  for(const [name,raw] of Object.entries(data.rawFiles)){
   const b=Buffer.from(raw.content,'utf8');
   assert.equal(b.length,raw.bytes,name);
   assert.equal(crypto.createHash('sha256').update(b).digest('hex'),raw.sha256,name);
   JSON.parse(raw.content);rawCount++;
  }
  const aggregate=JSON.parse(data.rawFiles['terminal-live.json'].content);
  const rounds=['morning.json','patrol.json'].map(n=>JSON.parse(data.rawFiles[n].content));
  assert.deepEqual(aggregate.rounds,rounds,stage);
  if(!rounds[1].independentSeed)assert.deepEqual(rounds[1].before,rounds[0].after,'巡查必须沿用实际晨间存档');
  assert.equal(aggregate.candidateSha256,attempt.cardSha256,stage);
  assert.equal(aggregate.phoneInstalled,false);
  assert.deepEqual(data.summary.rounds.map(x=>x.checks),rounds.map(x=>x.checks));
  const passed=rounds.map(x=>[x.checks.filter(c=>c.passed).length,x.checks.length]);
  if(stage!=='natural')assert.deepEqual(passed,[[15,15],[14,14]],stage);
  else assert.deepEqual(passed,attempt.naturalChecks,stage);
  for(const r of rounds){
   const c=r.contactAttempt;
   assert.equal(c.contact.available,false);assert.equal(c.contact.status,'offline');assert.equal(c.contact.statusLabel,'离线');
   assert.equal(c.result.error.code,'CONTACT_UNAVAILABLE');assert.equal(c.result.draft,null);assert.equal(c.result.inserted,false);
   assert.ok(c.inputUnchanged&&c.variablesUnchanged&&c.chatCountUnchanged);
  }
  stageCount++;
 }
}
assert.equal(rawCount,index.rawJsonCount);assert.equal(stageCount,index.stageBundleCount);
console.log('原始文件散列、场景汇总、断言范围与离线联系证据核验通过。');
