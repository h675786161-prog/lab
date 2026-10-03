import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const card=JSON.parse(fs.readFileSync(new URL('./Qidu-v0.4.42-day-gate.json',import.meta.url),'utf8'));
const source=card.data.extensions.tavern_helper.scripts.find(s=>s.name.includes('不可逆')).content;
const dream='在半梦半醒的意识深处，一个空灵的声音回响着。\n\n“你又醒来了。”';
const carry='希罗压制了赛哈姆的活骸化。部下抬着赛哈姆的担架离开了中央庭。';
function run(day,text,history=[],flags={},commands=[],user='继续'){
 let handler;const chat=history.concat({is_user:true,mes:user});
 const host={SillyTavern:{getContext:()=>({chat})},Mvu:{events:{COMMAND_PARSED:'commands'}}};
 const context={parent:host,TavernHelper:{eventOn:(name,fn)=>{if(name==='commands')handler=fn;},eventRemoveListener:()=>{}},addEventListener:()=>{}};context.window=context;
 vm.runInNewContext(source,context);
 const prior={schema:'f7d_textloop_0.4',day,clock_minutes:480,morning_flags:{['day'+day+'_monologue']:false,day6_saiham:false,...flags}};
 handler({stat_data:prior},commands,text);return commands;
}
const path=c=>c.args[0];
assert(run(6,dream).some(c=>path(c)==='morning_flags.day6_monologue'));
assert(!run(6,dream+'\n希罗说：“我需要带走赛哈姆进行活骸治疗。”').some(c=>path(c)==='morning_flags.day6_saiham'));
assert(run(6,carry,[{is_user:false,mes:dream,variables:{0:{stat_data:{day:6}}}}]).some(c=>path(c)==='morning_flags.day6_saiham'));
assert(!run(6,'安递来温水。',[{is_user:false,mes:dream,variables:{0:{stat_data:{day:5}}}}]).some(c=>path(c)==='morning_flags.day6_monologue'));
assert(!run(6,dream,[],{},[{type:'set',args:['clock_minutes','480','560']}],'去巡查').some(c=>path(c)==='clock_minutes'));
assert(run(6,'你和安巡查了街区。',[],{day6_monologue:true,day6_saiham:true},[{type:'set',args:['clock_minutes','480','560']}],'我去巡查').some(c=>path(c)==='clock_minutes'));
console.log('6 morning regression checks passed');
