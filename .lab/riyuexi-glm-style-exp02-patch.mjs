import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const CAL=`[模型校准·GLM｜人味取舍]
只纠正GLM在叙事里“什么都想写、什么都想写完”的倾向，不接管其他模块职责。

- 一段只抓当前真正值得写的变化。动作之间允许跳步，没改变现场、关系或语气的过程可以直接略过；不用证明人物一直在动、一直在看、一直在做事。
- 普通片段不需要形成完整小故事。问题答到、气氛落稳、人物各自继续做事，都可以自然停住；不要为了让这一轮显得完整，再补一个发现、误会、安排、回忆或收尾。

保留人物主动性、清楚度和直接感。具体句式、角色设定、抢转权限、世界规则、关系、长度、NSFW与输出格式仍由各自模块负责。`;
const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names)b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
let hit=0;
for(const item of pack.sequence){if(item.name==='✅GLM校准'){item.content=CAL;hit++;}}
if(hit!==1) throw new Error(`target cal=${hit}`);
pack.variant='GLM-style-exp02';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9});
const enc=gz.toString('base64');
const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++) await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),enc.slice(i*chunk,(i+1)*chunk),'utf8');
const out=process.env.LAB_EVIDENCE_DIR||ROOT; await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'exp02-patch-manifest.json'),JSON.stringify({source_sha256:pack.source_sha256,sequence_len:pack.sequence.length,targets:['✅GLM校准'],variant:pack.variant,raw_sha256:crypto.createHash('sha256').update(next).digest('hex')},null,2));
console.log(`patched exp02 sequence=${pack.sequence.length}`);
