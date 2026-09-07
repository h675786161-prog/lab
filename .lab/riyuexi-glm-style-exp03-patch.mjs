import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const ADD=`\n\n[GLM取舍补丁]\n人写日常片段时，会默认大量信息根本不值得进入文字。先抓住本轮唯一主要变化；与它没有直接因果关系的环境补充、职业证明、过去轶事、额外物件和新事件留在场外。主要变化已经落下时，可以停在事情仍未解决、人物仍各忙各的地方，不必再制造第二件事。`;
const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names)b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
let hit=0;
for(const item of pack.sequence){
  if(item.name==='✅GLM校准'){
    if(String(item.content||'').includes('[GLM取舍补丁]')) throw new Error('already patched');
    item.content=String(item.content||'')+ADD;
    hit++;
  }
}
if(hit!==1) throw new Error(`target cal=${hit}`);
pack.variant='GLM-style-exp03';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9}); const enc=gz.toString('base64'); const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++) await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),enc.slice(i*chunk,(i+1)*chunk),'utf8');
const out=process.env.LAB_EVIDENCE_DIR||ROOT; await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'exp03-patch-manifest.json'),JSON.stringify({source_sha256:pack.source_sha256,sequence_len:pack.sequence.length,targets:['✅GLM校准 additive'],variant:pack.variant,raw_sha256:crypto.createHash('sha256').update(next).digest('hex')},null,2));
console.log(`patched exp03 sequence=${pack.sequence.length}`);
