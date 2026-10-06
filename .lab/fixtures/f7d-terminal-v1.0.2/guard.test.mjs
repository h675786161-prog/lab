import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const fixture=JSON.parse(fs.readFileSync(new URL('./replay-fixture.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('./morning-guard.js',import.meta.url),'utf8');
const baseline=fs.readFileSync(new URL('./morning-guard.baseline.js',import.meta.url),'utf8');
const flag=(key,next='true')=>({type:'set',args:[JSON.stringify('morning_flags.'+key),'false',next]});
const mon=()=>flag('day6_monologue'),departure=()=>flag('day6_saiham');
const voice='黑暗与梦境的边缘，断续而稚嫩的声音从水底传来。你睁开双眼，寝室天花板映入眼帘。';
const left='希罗处理赛哈姆的活骸化。希罗带着昏迷的赛哈姆离开了中央庭。';
function run({text=voice+left,state=fixture.morning.before,commands=[mon(),departure()],code=source,user=fixture.morning.user}={}){
 const listeners=new Map(),host={SillyTavern:{getContext:()=>({chat:[{is_user:true,mes:user}]})},Mvu:{events:{COMMAND_PARSED:'parsed'}}};
 let unload;
 const win={parent:host,eventOn:(n,fn)=>{listeners.set(n,fn);},eventRemoveListener:(n,fn)=>{if(listeners.get(n)===fn)listeners.delete(n);},addEventListener:(n,fn)=>{if(n==='pagehide')unload=fn;}};
 vm.runInNewContext(code,{window:win,console});
 assert.equal(host.__F7D_MVU_GUARD__.ready,true);
 const data={stat_data:structuredClone(state)},out=structuredClone(commands),original=JSON.stringify(data);
 listeners.get('parsed')(data,out,text);
 assert.equal(JSON.stringify(data),original,'守卫不能直接改变量');
 unload();assert.equal(listeners.size,0,'守卫卸载必须移除监听');
 return out;
}
const has=(rows,key)=>rows.some(c=>JSON.parse(c.args[0])==='morning_flags.'+key&&c.args.at(-1)==='true');
test('真实晨间声音描写原版漏判，修正版保留两个命令',()=>{
 const text=fixture.morning.replayText;
 assert.equal(has(run({text,code:baseline}),'day6_monologue'),false);
 const fixed=run({text});assert.ok(has(fixed,'day6_monologue'));assert.ok(has(fixed,'day6_saiham'));
});
test('命令正序与倒序结果一致',()=>{for(const commands of [[mon(),departure()],[departure(),mon()]]){const rows=run({commands});assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));}});
test('独白命令被删后离场命令也删，顺序不影响',()=>{for(const commands of [[mon(),departure()],[departure(),mon()]]){const rows=run({text:'你醒来。'+left,commands});assert.equal(has(rows,'day6_monologue'),false);assert.equal(has(rows,'day6_saiham'),false);}});
test('没有模型更新命令时不自动补旗标',()=>{assert.equal(run({commands:[]}).length,0);});
test('已有真实独白提交可在下一条回复结算离场',()=>{const state=structuredClone(fixture.morning.before);state.morning_flags.day6_monologue=true;assert.ok(has(run({state,text:left,commands:[departure()]}),'day6_saiham'));});
test('只有独白描写但没有已提交或获准命令，离场不结算',()=>{assert.equal(has(run({commands:[departure()]}),'day6_saiham'),false);});
test('晨间同条回复的巡查耗时仍被拦住',()=>{const rows=run({commands:[mon(),departure(),{type:'set',args:['"clock_minutes"','480','560']}]});assert.equal(rows.some(c=>c.args[0]==='"clock_minutes"'),false);});
test('晨间提交后的下一次巡查允许80分钟',()=>{const rows=run({state:fixture.patrol.before,text:fixture.patrol.replayText,user:fixture.patrol.user,commands:[{type:'set',args:['"clock_minutes"','480','560']}]});assert.ok(rows.some(c=>c.args[0]==='"clock_minutes"'));});
test('非第六天拒绝第六天旗标',()=>{const state=structuredClone(fixture.morning.before);state.day=7;assert.equal(run({state}).length,0);});
for(const text of [
 '你回想起昨天梦境中的声音。'+left,
 '如果梦境中有声音，你会认真听。'+left,
 '梦境里没有任何声音。你睁开眼。'+left,
 '小神尚未低语。你还没有醒。'+left,
 '你走在大厅，听到工作人员的声音。'+left,
 '你醒来。<f7d_choices><f7d_choice>回到梦境，倾听小神的声音</f7d_choice></f7d_choices>'+left,
])test('回忆、假设、否定、日常声音或选项不冒充独白：'+text.slice(0,16),()=>{const rows=run({text});assert.equal(has(rows,'day6_monologue'),false);assert.equal(has(rows,'day6_saiham'),false);});
for(const text of [
 voice+'希罗处理赛哈姆的活骸化。“希罗带着赛哈姆离开了中央庭。”',
 voice+'希罗处理赛哈姆的活骸化。赛哈姆尚未被带离中央庭。',
 voice+'希罗处理赛哈姆的活骸化。希罗准备带着赛哈姆离开中央庭。',
 voice+'希罗处理赛哈姆的活骸化。如果希罗带着赛哈姆离开中央庭，你会追上去。',
 voice+'希罗处理赛哈姆的活骸化。你回忆希罗带着赛哈姆离开中央庭的情景。',
 voice+'希罗处理赛哈姆的活骸化。希罗带着赛哈姆离开了中央庭。赛哈姆仍留在中央庭。',
])test('对白、未发生、回忆或后续留场不结算离场：'+text.slice(-25),()=>{assert.equal(has(run({text}),'day6_saiham'),false);});
test('早先留场随后实际离开允许结算',()=>{const text=voice+'希罗处理赛哈姆的活骸化。赛哈姆仍在中央庭。随后希罗带着赛哈姆离开了中央庭。';assert.ok(has(run({text}),'day6_saiham'));});
test('不纠缠的否定不误判为未离开',()=>{const text=voice+'希罗处理赛哈姆的活骸化。他没有再多作纠缠，带着昏迷的赛哈姆离开了中央庭。';assert.ok(has(run({text}),'day6_saiham'));});
test('被带离了中央庭的实际叙述允许结算',()=>{const text=voice+'希罗处理赛哈姆的活骸化。赛哈姆被带离了中央庭。';assert.ok(has(run({text}),'day6_saiham'));});
test('没有希罗或活骸叙述时不借普通离场结算',()=>{for(const text of [voice+'工作人员带着赛哈姆离开中央庭。',voice+'希罗带着赛哈姆离开中央庭。'])assert.equal(has(run({text}),'day6_saiham'),false);});
test('错误操作类型不能绕过前置检查',()=>{const a=mon();a.type='insert';const b=departure();b.type='insert';assert.equal(run({commands:[a,b]}).length,0);});


test('整块晨间旗标写入不能绕过逐项校验',()=>{const rows=run({commands:[{type:'set',args:['\"morning_flags\"',JSON.stringify({day6_monologue:true,day6_saiham:true})]}]});assert.equal(rows.length,0);});

test('活骸概念通过现场对白获知不要求旁白重复',()=>{const text=voice+'希罗说：“这是活骸化。”希罗带着赛哈姆离开了中央庭。';assert.ok(has(run({text}),'day6_saiham'));});
test('随行人员将赛哈姆带离整个中央庭允许结算',()=>{const text=voice+'希罗处理赛哈姆的活骸化。随行人员将赛哈姆带离了中央庭。';assert.ok(has(run({text}),'day6_saiham'));});
test('被带离主廊不能冒充离开整个中央庭',()=>{const text=voice+'希罗处理赛哈姆的活骸化。赛哈姆被带离了中央庭主廊。';assert.equal(has(run({text}),'day6_saiham'),false);});
test('主动带离主廊不能冒充离开整个中央庭',()=>{const text=voice+'希罗处理赛哈姆的活骸化。随行人员将赛哈姆带离了中央庭主廊。';assert.equal(has(run({text}),'day6_saiham'),false);});
test('最新真实模型只离开主廊的错误完成命令被拒绝',()=>{const rows=run({text:fixture.latestNaturalFailure.text});assert.ok(has(rows,'day6_monologue'));assert.equal(has(rows,'day6_saiham'),false);});
