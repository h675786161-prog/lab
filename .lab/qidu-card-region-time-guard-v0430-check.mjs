import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud} from './qidu-card-morning-hud-v0428.mjs';
import {limitCountdownNarration} from './qidu-card-countdown-v0429.mjs';
import {guardRegionAndShortTalk,VERSION} from './qidu-card-region-time-guard-v0430.mjs';

const {card:base}=await loadQiduReleaseCandidate(process.cwd(),{skipHashCheck:true});
const d=guardRegionAndShortTalk(limitCountdownNarration(addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base)))))).data;
assert.equal(d.character_version,VERSION);
const source=d.extensions.tavern_helper.scripts.find(x=>x.id==='qidu-v0425-mvu-guard').content;
new vm.Script(source);
let listener,user='';
const parent={Mvu:{events:{COMMAND_PARSED:'parsed'}},SillyTavern:{getContext:()=>({chat:[{is_user:true,mes:user}]})}};
const win={parent,TavernHelper:{eventOn:(_event,fn)=>listener=fn,eventRemoveListener:()=>{},waitGlobalInitialized:async()=>{}},addEventListener:()=>{}};
vm.runInNewContext(source,{window:win,console});
const seed=JSON.parse(d.first_mes.match(/<initvar>(.*?)<\/initvar>/s)[1]);
function run(prior,pairs,message,request){
  user=request;const commands=pairs.map(([path,next])=>({type:'set',args:[path,JSON.stringify(next)]}));
  listener({stat_data:structuredClone(prior)},commands,message);
  return commands.map(c=>c.args[0]);
}
function state(location='中央庭'){
  const s=structuredClone(seed);s.day=6;s.clock_minutes=560;s.location=location;s.tasks.DAY7_OPENING.status='completed';s.morning_flags.day6_monologue=true;s.morning_flags.day6_saiham=true;return s;
}
let s=state('东方古街');
assert.deepEqual(run(s,[['clock_minutes',640]],'雯梓说明五行阵与居民受困的情况。','我和安走向负责这里的人，先听她说明五行阵和居民眼下的困难。'),[]);
assert.deepEqual(run(s,[['clock_minutes',640]],'雯梓带你到阵眼，怪物挡住去路。','我跟着雯梓去现场处理怪物。'),['clock_minutes']);
s=state();
assert.deepEqual(run(s,[['route_flags.first_second_region','east']], '雯梓在入口说明情况。','先去东方古街'),[]);
assert.deepEqual(run(s,[['regions.east.liberated',true],['route_flags.first_second_region','east']], '整片古街宣告解放。','先去东方古街'),[]);
s=state('东方古街');
assert.deepEqual(run(s,[['regions.east.liberated',true],['route_flags.first_second_region','east']], '五行阵危机解除，东方古街区域解放。','处理最后的五行阵危机，完成区域救援。'),['regions.east.liberated','route_flags.first_second_region']);
s=state();
assert.deepEqual(run(s,[['route_flags.first_second_region','central'],['route_flags.oldstreet_delayed',true]],'赛斯在城区入口等你。','先去中央城区'),[]);
s=state('中央城区');
assert.deepEqual(run(s,[['clock_minutes',640]],'赛斯说明居民和怪物的位置。','我先找负责现场疏散的人，问清居民和怪物分别在什么位置。'),[]);
assert.deepEqual(run(s,[['regions.central.liberated',true],['route_flags.first_second_region','central'],['route_flags.oldstreet_delayed',true]],'中央城区危机解除，整片城区正式解放。','解决最后的城区危机，完成地区救援。'),['regions.central.liberated','route_flags.first_second_region','route_flags.oldstreet_delayed']);
console.log('PASS v0430: conversation costs zero; route order follows actual region liberation in both districts');
