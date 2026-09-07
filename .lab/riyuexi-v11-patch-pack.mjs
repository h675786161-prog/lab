import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const CAL=`[模型校准·GLM｜文风专项]
只纠正GLM在长提示链里常见的“写得太全、太清楚、太像记录仪”的表达习惯，不接管其他模块职责。

- 不做现场全量记录。人物从A走到B，不必逐项写起身、转身、迈步、伸手、放下；只保留真正改变现场或有角色味的那一下。
- 不做物件盘点。一个场景抓一两个有用的东西就够了；不要为了显得生活化把桌面、衣服、杯子、纸张、天气、声音轮流点名。
- 职业是人物生活的一部分，不是持续生成专业名词的理由。除非当前动作或冲突真的需要，别反复拿图纸、节点、配筋、甲方、数据证明“她是工程师”。
- 已经看得见的反应不配字幕。动作、对白或事实成立后，不再补“她只是……”“这意味着……”“不是因为……而是……”之类作者解释。
- 对话可以没效率。允许只回半句、答错重点、懒得解释、说废话、突然换话题；不要让每一句都精准推进信息、关系或情节。
- 不需要每个在场人物都轮流响应。谁正在忙自己的事，就可以真的没接话。
- 小事情保持小尺度。回答完一个问题后，不自动继续制造调查链、未来安排、背景旧事或新的事件钩子来填满回复。
- 不为字数补写。场景已经自然停住就停；宁可少一段，也不要再添一轮动作、环境或解释把这一轮“写完整”。
- 保留GLM的清楚、稳定、行动能力和直接感。削掉的是过度覆盖与过度说明，不是信息量本身，也不是角色主动性。
- 若【表达去惯性】已开启，具体禁式和重复检测交给它；本模块只做上述GLM特有的取舍偏置。
- 本模块不修改人物设定、抢转权限、剧情速度、世界规则、关系、字数、NSFW强度、文风选择或输出格式。`;
const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names)b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
let a=0;
for(const item of pack.sequence){if(item.name==='✅GLM校准'){item.content=CAL;a++;}}
if(a!==1) throw new Error(`target cal=${a}`);
pack.variant='V11-GLM文风专项';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9}); const enc=gz.toString('base64'); const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++) await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),enc.slice(i*chunk,(i+1)*chunk),'utf8');
const out=process.env.LAB_EVIDENCE_DIR||ROOT; await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'v11-patch-manifest.json'),JSON.stringify({source_sha256:pack.source_sha256,sequence_len:pack.sequence.length,targets:['✅GLM校准'],raw_sha256:crypto.createHash('sha256').update(next).digest('hex')},null,2));
console.log(`patched V11 sequence=${pack.sequence.length}`);
