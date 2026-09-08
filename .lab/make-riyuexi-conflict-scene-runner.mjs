import fs from 'node:fs/promises';
const src=process.argv[2],out=process.argv[3]; if(!src||!out) throw new Error('usage: node make-riyuexi-conflict-scene-runner.mjs src out');
let s=await fs.readFile(src,'utf8');
const scene={id:'late_home',user_name:'玲',char_name:'沈岚',persona:'玲，成年女性。说话直接，生气时会刺一句，不要求立刻把情绪讲清楚。允许按开放演绎继续她当下的言行。',description:'沈岚，34岁，女性结构工程师。做事直接，忙起来会把时间抛在脑后；她不擅长在刚进门时立刻做长篇解释，但也不是冷脸霸总。',personality:'沈岚直接、务实、累时话少；玲生气时会嘴硬。两人熟悉，冲突可以悬着，不需要本轮和解或关系升华。',scenario:'晚上十一点，普通住宅客厅。沈岚原本明确说过今晚八点前回来，实际十一点才进门；手机在下班前没电，因此这三个小时没有消息。玲知道的只有这些。桌上有一碗已经冷掉的面。没有出轨、事故、秘密任务或关系破裂设定。',history:[{role:'assistant',content:'门锁响了一声。沈岚推门进来，肩上还挂着工作包。客厅的灯没关。'},{role:'user',content:'玲坐在沙发边，抬眼看她：“你还知道回来啊。”'}]};
const needle="const results=[],scenes=scenarios().slice(0,1);";
if(!s.includes(needle)) throw new Error('scene anchor missing');
s=s.replace(needle,`const results=[],scenes=[${JSON.stringify(scene)}];`);
await fs.writeFile(out,s,'utf8'); console.log('wrote conflict runner',out);
