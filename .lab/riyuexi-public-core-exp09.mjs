import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names)b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
if(!Array.isArray(pack.sequence)||pack.sequence.length!==222) throw new Error(`expected 222, got ${pack.sequence?.length}`);

function one(name){const xs=pack.sequence.filter(x=>x.name===name); if(xs.length!==1) throw new Error(`${name} count ${xs.length}`); return xs[0];}
const main=one('🔥万物诞生');
const law=one('🌌昼夜同权');

const reps=[
 [main,'2. 以日为刃：让选择带来后果，让疼痛有来处，“代价”从来不是空话。','2. 以日为刃：当选择真的改变局面时，让后果从行动里长出来；普通选择、闲聊和日常动作可以只发生，不必每次都制造代价、转折或意义。'],
 [main,'4. 昼夜交替：落笔前在`Ecot`里停一拍——月读确认“他们怕什么”，天照确认“他们愿意付出什么”，然后再写。','4. 昼夜交替：`Ecot`只在本轮确有冲突、代价或重要取舍需要判断时记录必要结论；普通场景不必提炼“怕什么”或“愿意付出什么”，直接跟着人物当前注意力写。'],
 [main,'8. 日月同辉：月读赋予文字深度、暧昧与余韵；天照赋予情节力度、感官与燃烧感。二者共同守护作品的完整、自由与真实。','8. 日月同辉：深度、暧昧、力度与感官都按场景需要自然出现，不作为每轮配额；安静、普通、没发生大事也可以完整成立。二者共同守护作品的自由与真实。'],
 [law,'2. 身体真实：人类是血肉之躯，受制于重力与痛觉；亲密与战斗都必须拆解为连续动作，禁止用概括性标签跳过过程，正文里也不使用括号解释隐喻或潜台词——让它们自己发生、自己发烫','2. 身体真实：人类是血肉之躯，受制于重力与痛觉；亲密与战斗要保持足够的身体连续性，让读者知道关键位置与动作如何变化。显而易见的过渡、重复和无信息步骤可以省略，不把正文写成动作记录；正文也不使用括号解释隐喻或潜台词——让它们自己发生。'],
 [law,'3. 物体连续：这个世界的物体不会凭空消失，你必须追踪物品状态；时间不许用模糊占位符，要给出确切坐标（例如：2026年）','3. 物体连续：重要物件不会凭空消失；只追踪本轮真正影响行动的物品状态，普通物件离开注意力后无需反复点名。时间沿用已建立信息即可；未建立具体年月时可自然使用相对时间，不为精确而发明坐标。'],
 [law,'4. 因果闭环：情绪可以汹涌，但结果必须有来处；救赎要付出代价，伤害要留下痕迹，不要为了讨好而让世界变轻，也不要为了“爽感”让逻辑变松','4. 因果连续：重要结果要有来处，真正造成的伤害和代价应留下后果；但单轮回复不必闭环，问题可以没解决，情绪可以悬着，人物也可以暂时什么都没想明白。不要为了讨好或爽感让既有逻辑失效。']
];
let changed=0;
for(const [obj,a,z] of reps){if(!obj.content.includes(a)) throw new Error(`missing source phrase: ${a.slice(0,30)}`); obj.content=obj.content.replace(a,z); changed++;}
pack.variant='public-core-exp09-alive-rp';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9}); const enc=gz.toString('base64'); const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++) await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),enc.slice(i*chunk,(i+1)*chunk),'utf8');
const out=process.env.LAB_EVIDENCE_DIR||ROOT; await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'exp09-patch-manifest.json'),JSON.stringify({source_sha256:pack.source_sha256,sequence_len:pack.sequence.length,targets:['🔥万物诞生','🌌昼夜同权'],replacements:changed,variant:pack.variant,raw_sha256:crypto.createHash('sha256').update(next).digest('hex')},null,2));
console.log(`patched public core exp09 replacements=${changed} sequence=${pack.sequence.length}`);
