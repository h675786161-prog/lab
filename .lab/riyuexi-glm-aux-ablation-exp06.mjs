import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const DROP=new Set([
'==.✟.装饰组件.✟.==','✧─头部装饰─✧','🪶ta的物品组件','⏰现代文字标题','✧─文中装饰─✧','🍨随机视觉组件','🍨文字美化组件','✧─尾部装饰─✧','💌日月秘密来信','📟底部状态提醒','✧─摘要定制─✧','🔮角色关系','🔮涩涩控制','🔮绝密档案','❖摘要一键开关❖','✧─选项定制─✧','✶ ·选项类型·✶','🎮日常选项','✶ ·可选模块·✶','🗝️待办日程','🗝️活动灵感','❖选项一键开关❖'
]);
const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names)b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
const before=pack.sequence.length;
const removed=pack.sequence.filter(x=>DROP.has(String(x.name||''))).map(x=>x.name);
pack.sequence=pack.sequence.filter(x=>!DROP.has(String(x.name||'')));
if(removed.length!==DROP.size) throw new Error(`removed=${removed.length} expected=${DROP.size}; missing=${[...DROP].filter(n=>!removed.includes(n)).join(',')}`);
pack.variant='GLM-aux-ablation-exp06';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9}); const enc=gz.toString('base64'); const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++) await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),enc.slice(i*chunk,(i+1)*chunk),'utf8');
const out=process.env.LAB_EVIDENCE_DIR||ROOT; await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'exp06-ablation-manifest.json'),JSON.stringify({source_sha256:pack.source_sha256,before,after:pack.sequence.length,removed,variant:pack.variant,raw_sha256:crypto.createHash('sha256').update(next).digest('hex')},null,2));
console.log(`ablated exp06 ${before}->${pack.sequence.length}`);
