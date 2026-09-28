import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud,VERSION} from './qidu-card-morning-hud-v0428.mjs';

const {card:base}=await loadQiduReleaseCandidate(process.cwd(),{skipHashCheck:true});
const d=addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base)))).data;
assert.equal(d.character_version,VERSION);
const initial=JSON.parse(d.first_mes.match(/<initvar>(.*?)<\/initvar>/s)[1]);
assert.deepEqual(initial,JSON.parse(d.character_book.entries.find(e=>e.name.startsWith('[InitVar]')).content));
const guard=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0425-mvu-guard').content;
const bridge=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0424-choice-bridge').content;
new vm.Script(guard);new vm.Script(bridge);
assert(bridge.includes('ensureStatusHud();scrubLegacyTerminalCounters()'));
assert(bridge.includes('f7d-status-hud-v0428'));
let listener,user='';
const host={Mvu:{events:{COMMAND_PARSED:'parsed'}},SillyTavern:{getContext:()=>({chat:[{is_user:true,mes:user}]})}};
const frame={parent:host,TavernHelper:{eventOn:(name,fn)=>listener=fn,eventRemoveListener:()=>{},waitGlobalInitialized:async()=>{}},addEventListener:()=>{}};
vm.runInNewContext(guard,{window:frame,console});assert(listener);
const run=(s,changes,story='',input='巡查')=>{
  user=input;
  const commands=changes.map(([path,value])=>({type:'set',args:[path,JSON.stringify(value)]}));
  listener({stat_data:structuredClone(s)},commands,story);
  return commands.map(x=>[x.args[0],JSON.parse(x.args.at(-1))]);
};
const state=()=>structuredClone(initial);
let s=state();
assert.equal(run(s,[['clock_minutes',560]],'希罗伸出手来。').length,0);
assert.equal(run(s,[['tasks.DAY7_OPENING.status','completed']],'希罗完成介绍，晏华将行动权交付指挥使。').length,1);
assert.equal(run(s,[['clock_minutes',560],['tasks.DAY7_OPENING.status','completed']],'希罗完成介绍，晏华交付行动权。').some(([p])=>p==='clock_minutes'),false);
s.tasks.DAY7_OPENING.status='completed';assert(run(s,[['clock_minutes',560]]).some(([p])=>p==='clock_minutes'));
for(const [day,flags] of Object.entries({6:['day6_monologue','day6_saiham'],5:['day5_monologue','day5_split'],4:['day4_monologue','day4_speech'],3:['day3_monologue','day3_ann_departure'],2:['day2_monologue']})){
  s=state();s.day=+day;
  assert.equal(run(s,[['clock_minutes',560]]).length,0,`day ${day} morning must block`);
  for(const flag of flags)s.morning_flags[flag]=true;
  assert(run(s,[['clock_minutes',560]]).some(([p])=>p==='clock_minutes'),`day ${day} finished morning permits actions`);
}
s=state();s.day=6;s.morning_flags.day6_monologue=true;
assert.equal(run(s,[['morning_flags.day6_saiham',true]],'赛哈姆活骸化，希罗到场。','继续剧情').length,0);
assert.equal(run(s,[['morning_flags.day6_saiham',true]],'赛哈姆活骸化，希罗带走赛哈姆。','继续剧情').length,1);
s=state();s.day=3;s.morning_flags.day3_monologue=true;
assert.equal(run(s,[['morning_flags.day3_ann_departure',true]],'安留在病房。','继续剧情').length,0);
assert.equal(run(s,[['morning_flags.day3_ann_departure',true]],'安已经离开，你发现她不见了。','继续剧情').length,1);
console.log('PASS v0428: opening and day6-to-day2 morning clocks, scene marks and status HUD');
