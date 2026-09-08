import fs from 'node:fs/promises';
const src=process.argv[2],out=process.argv[3];
if(!src||!out) throw new Error('usage: node patch-riyuexi-g35-nsfw-calib-exp.mjs src out');
let s=await fs.readFile(src,'utf8');
const oldLine="  let q=pack.sequence.map(x=>({...x})).filter(x=>!['😡表达去惯性','✅GLM校准','🌓GLM尾部'].includes(String(x.name||'')));";
if(!s.includes(oldLine)) throw new Error('profile sequence anchor missing');
const wlw={identifier:'d18e9e43-7b61-45b1-84fd-96accef8e399',name:'🔥女女模式',role:'system',content:'{{setvar::常规性向4:: [性向/身体组合：女女] - 两名女性角色的主导、承受、主动、温柔、粗暴、情感距离与声口全部服从人物，不因为女女自动变成“温柔平等、同步共鸣”。 - 手指、口舌、阴蒂/外阴刺激、身体摩擦、玩具、相互自慰或其他符合身体设定的互动都可使用。 - 高潮不等于潮吹，也不要求同步；可以一方先、一方没有、连续、多次或本轮都没有。 - 不把“香气、柔软、对视、喘息和谐”当女女固定滤镜，保留角色自己的脾气与差异。 }}',marker:false,system_prompt:false};
const calib={identifier:'lab-g35-nsfw-semantic-translation',name:'✅Gemini3.5 NSFW语义校准LAB',role:'system',content:'[Gemini 3.5 NSFW语义校准]\n- “慢一点 / 就这样 / 别换 / 保持”表示当前动作与强度本身就是当下想要的状态。除非人物或上下文明确如此，不要把它翻译成前戏、延迟满足、忍耐、折磨、挑逗、压抑更猛烈的冲动、测试极限或通往高潮的蓄力。\n- 没有已经建立的D/s或权力玩法时，不因谁正在施加动作、谁正在接受刺激，就自动生成“主导/被动、掌控/顺从、占有/被占有”的角色结构。\n- 当前动作没有实质变化时，只写真正新增的信息。可以让人物说普通话、跑题、笑、走神、停顿，也可以让本轮自然停在这里；不要为了维持色情浓度，用同义身体反应循环重写同一个动作。\n- 本模块只校准Gemini 3.5在NSFW中的语义解释，不改变人物、关系、同意边界、抢转权限、实际强度或既有玩法。',marker:false,system_prompt:false};
const newLine=`  const wlw=${JSON.stringify(wlw)};\n  const g35NsfwCalib=${JSON.stringify(calib)};\n  let q=pack.sequence.map(x=>({...x})).filter(x=>!['😡表达去惯性','✅GLM校准','🌓GLM尾部','💘BDSM前置'].includes(String(x.name||''))).map(x=>x.name==='🔥男女模式'?wlw:x);\n  const g35NsfwIdx=q.findIndex(x=>x.name==='❖涩涩一键开关❖');\n  if(g35NsfwIdx<0) throw new Error('NSFW design anchor missing');\n  q.splice(g35NsfwIdx+1,0,g35NsfwCalib);`;
s=s.replace(oldLine,newLine);
const oldLen="pack.sequence.length!==222";
if(!s.includes(oldLen)) throw new Error('sequence length anchor missing');
// -1 BDSM prelude +1 Gemini3.5 semantic calibration = original length
s=s.replace(oldLen,"pack.sequence.length!==222");
if(!s.includes('Gemini3.5 NSFW语义校准LAB')||!s.includes('💘BDSM前置')||!s.includes('length!==222')) throw new Error('G35 NSFW semantic calibration patch failed');
await fs.writeFile(out,s,'utf8');
console.log('wrote Gemini 3.5 WLW + BDSM OFF + semantic translation calibration runner',out);
