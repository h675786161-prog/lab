import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'harbor-pair-evidence');
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile(path.join(root,'.lab/fixtures/qidu-harbor-v0440/card.json'),'utf8'));
const entries=card.data.character_book.entries;
const relevant=entries.filter(e=>e.constant||[4,11,12,13,14,36,37,59,60,91,92,93].includes(e.id));
const system=[card.data.system_prompt,card.data.personality,card.data.scenario,...relevant.map(e=>e.content),card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const initial=JSON.parse(entries.find(e=>e.id===92).content);
const state=structuredClone(initial);
state.day=4;state.clock_minutes=480;state.location='中央庭';state.route='central';
state.regions.school.liberated=true;state.regions.east.liberated=true;state.regions.central.liberated=true;state.regions.institute.liberated=true;
state.regions.harbor.liberated=false;
state.cores.court='purified';state.cores.school='purified';state.cores.harbor='unknown';
state.hiro.intel=4;state.hiro.handled=['DAY4_HARBOR'];
for(const k of ['day6_monologue','day6_saiham','day6_seth','day5_monologue','day5_split','day4_monologue','day4_speech'])state.morning_flags[k]=true;
state.known=['安','安托涅瓦','晏华','珈儿','希罗','雯梓','赛斯','羽弥'];
const messages=[{role:'system',content:system}];
const actions=[
  '第4天晨间固定剧情已结束。安和我从中央庭前往港湾区，先在工业码头确认失联工人、撤离道路与目击线索。按人物和区域因果推进，不输出节点说明。',
  '我先协助工人撤离，向现场的神器使和目击者询问封锁区内发生了什么，记录可核查的线索。',
  '我与安沿安全通道调查船坞和仓储设施，确认异常的来源，遭遇危险则先救人。',
  '我们沿着现场留下的证据调查机械蜘蛛、装置与海面的异常，寻找仍被困的人。',
  '我将现场证据整理给两位弓手核对，再调查港口深处的设施；只依据已经取得的证据判断海中异常。',

