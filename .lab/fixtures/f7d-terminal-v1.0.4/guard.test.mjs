import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const fixture=JSON.parse(fs.readFileSync(new URL('./replay-fixture.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('./morning-guard.js',import.meta.url),'utf8');
const boardingBaseline=fs.readFileSync(new URL('./morning-guard.boarding-baseline.js',import.meta.url),'utf8');
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
const has=(rows,key)=>rows.some(c=>String(c.args[0]).trim().replace(/^['"]|['"]$/g,'')==='morning_flags.'+key&&c.args.at(-1)==='true');
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

test('第二轮真实醒前轻语与担架护送驶离保留合法命令',()=>{const rows=run({text:fixture.secondNaturalFailure.text});assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));});
test('醒后普通轻语不得补晨间独白',()=>{const rows=run({text:'你睁开双眼，看见天花板。晨光中，工作人员在走廊轻语。'+left});assert.equal(has(rows,'day6_monologue'),false);});
test('仅护送队伍驶离不能推定赛哈姆离开',()=>{const text=voice+'希罗处理赛哈姆的活骸化。希罗与随行队伍登上车，驶离了中央庭区域。';assert.equal(has(run({text}),'day6_saiham'),false);});
test('准备或假设担架队伍驶离不算发生',()=>{for(const prefix of ['准备','如果']){const text=voice+'希罗处理赛哈姆的活骸化。'+prefix+'担架由一行人推上车，驶离中央庭区域。';assert.equal(has(run({text}),'day6_saiham'),false);}});

const vehicleFailure=JSON.parse(fs.readFileSync(new URL('./vehicle-failure.json',import.meta.url),'utf8'));
const vehicleBaseline=fs.readFileSync(new URL('./morning-guard.vehicle-baseline.js',import.meta.url),'utf8');
const vehicleStory=s=>voice+'希罗解释了赛哈姆的活骸化。'+s;
test('最新真实运输车正文原版拒绝，修正版保留模型已提出的合法命令',()=>{
 const options={text:vehicleFailure.text,state:vehicleFailure.before,user:vehicleFailure.user,commands:vehicleFailure.commands};
 assert.equal(has(run({...options,code:vehicleBaseline}),'day6_saiham'),false);
 const rows=run(options);assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
 assert.ok(rows.every(c=>vehicleFailure.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))),'只能保留原命令，不能补命令');
});
for(const s of [
 '黑色运输车辆闭锁启动，载着赛哈姆与希罗彻底驶离了中央庭区域。',
 '运输车载着昏迷的赛哈姆，驶离了中央庭。',
 '救护车搭载着失去意识的赛哈姆，驶出了中央庭区域。',
 '车辆载着希罗和赛哈姆驶离中央庭。',
 '运输车辆没有再停留，载着赛哈姆驶离中央庭。',
])test('车辆明确搭载人物实际离场：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '“运输车辆载着赛哈姆驶离中央庭。”',
 '运输车辆准备载着赛哈姆驶离中央庭。',
 '如果运输车辆载着赛哈姆驶离中央庭，你会跟上。',
 '你回忆运输车辆载着赛哈姆驶离中央庭的情景。',
 '昨天运输车辆载着赛哈姆驶离了中央庭。',
 '据说运输车辆载着赛哈姆驶离了中央庭。',
 '运输车辆尚未载着赛哈姆驶离中央庭。',
 '运输车辆载着赛哈姆，尚未驶离中央庭。',
 '运输车辆将载着赛哈姆驶离中央庭。',
 '运输车辆载着赛哈姆，将驶离中央庭。',
 '运输车辆预计载着赛哈姆驶离中央庭。',
 '运输车辆不载着赛哈姆驶离中央庭。',
 '赛哈姆没有上车。运输车辆载着希罗驶离中央庭。',
 '运输车辆载着赛哈姆的行李驶离中央庭。',
 '运输车辆载着希罗，从赛哈姆身边驶离中央庭。',
 '运输车辆驶离中央庭。赛哈姆仍留在中央庭。',
 '运输车辆载着赛哈姆驶离中央庭主廊。',
 '运输车辆载着赛哈姆驶离中央庭的大厅。',
 '运输车辆载着赛哈姆驶离中央庭区域内的通道。',
 '运输车辆载着赛哈姆驶离中央庭大门。',
 '运输车辆载着赛哈姆驶离中央庭。赛哈姆仍留在中央庭。',
 '<f7d_choices><f7d_choice>让运输车辆载着赛哈姆驶离中央庭</f7d_choice></f7d_choices>',
])test('不借未发生或无人物关联的车辆叙述结算：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});
test('车辆离场也必须通过独白前置且不能补命令',()=>{
 const text=vehicleStory('运输车辆载着赛哈姆驶离中央庭。');
 assert.equal(has(run({text,commands:[departure()]}),'day6_saiham'),false);
 assert.equal(run({text,commands:[]}).length,0);
 assert.equal(has(run({text:'希罗解释活骸化。运输车辆载着赛哈姆驶离中央庭。'}),'day6_saiham'),false);
});

const scopeFailure=JSON.parse(fs.readFileSync(new URL('./scope-failure.json',import.meta.url),'utf8'));
const scopeBaseline=fs.readFileSync(new URL('./morning-guard.scope-baseline.js',import.meta.url),'utf8');
test('完整真实车队管辖区域正文修补前漏判，修补后保留原合法命令',()=>{
 const args={text:scopeFailure.text,state:scopeFailure.before,user:scopeFailure.user,commands:scopeFailure.commands};
 assert.equal(has(run({...args,code:scopeBaseline}),'day6_saiham'),false);
 const out=run(args);assert.ok(has(out,'day6_monologue'));assert.ok(has(out,'day6_saiham'));
 assert.ok(out.every(c=>scopeFailure.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
for(const s of [
 '希罗与随行车队带着赛哈姆彻底驶离了中央庭的管辖区域，消失在城市主干道的拐角处。',
 '车队带着赛哈姆驶离中央庭辖区。',
 '运输车辆载着赛哈姆驶出中央庭管辖区域。',
 '运输车没有再停留，带着赛哈姆驶离中央庭的管辖区域。',
 '车队带着赛哈姆驶离中央庭的管辖区域 ，消失在街角。',
])test('车队实际离开完整辖区：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '“车队带着赛哈姆驶离中央庭的管辖区域。”',
 '车队准备带着赛哈姆驶离中央庭的管辖区域。',
 '如果车队带着赛哈姆驶离中央庭的管辖区域，你会跟上。',
 '你回忆车队带着赛哈姆驶离中央庭的管辖区域的情景。',
 '昨天车队带着赛哈姆驶离了中央庭的管辖区域。',
 '据说车队带着赛哈姆驶离了中央庭的管辖区域。',
 '车队将带着赛哈姆驶离中央庭的管辖区域。',
 '车队不带着赛哈姆驶离中央庭的管辖区域。',
 '车队带着赛哈姆，尚未驶离中央庭的管辖区域。',
 '车队带着赛哈姆驶离中央庭的管辖区域内的主廊。',
 '车队带着赛哈姆驶离中央庭辖区内的通道。',
 '车队带着赛哈姆驶离中央庭 的大厅。',
 '车队带着赛哈姆驶离中央庭的管辖区域 内的主廊。',
 '车队带着赛哈姆驶离中央庭的管辖区域的大厅。',
 '车队带着赛哈姆的行李驶离中央庭的管辖区域。',
 '车队带着希罗，从赛哈姆身边驶离中央庭的管辖区域。',
 '车队带着赛哈姆驶离中央庭的管辖区域。赛哈姆仍留在中央庭。',
])test('车队辖区反例仍不得结算：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});

const boardingFailure=JSON.parse(fs.readFileSync(new URL('./boarding-failure.json',import.meta.url),'utf8'));
test('真实登车驶离全文修前拒绝，修后保留原命令且顺序无关',()=>{
 const opts={text:boardingFailure.text,state:boardingFailure.before,user:boardingFailure.user,commands:boardingFailure.commands};
 assert.equal(has(run({...opts,code:boardingBaseline}),'day6_saiham'),false);
 for(const commands of [opts.commands,[...opts.commands].reverse()]){
  const rows=run({...opts,commands});assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
  assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
 }
});
for(const s of [
 '赛哈姆登上运输车，随车流驶离了中央庭区域。',
 '随行人员将昏迷的赛哈姆抬上运输车，驶离中央庭的管辖区域。',
 '赛哈姆被送上早已等候的救护车，随后驶出了中央庭辖区。',
 '希罗护送着赛哈姆的身影穿过广场，登上防区边缘的专用运输车，随车流驶离了中央庭区域。',
 '赛哈姆上了运输车，驶离中央庭。',
 '赛哈姆没有再抵抗，被扶上救护车，驶离了中央庭区域。',
])test('人物登车与同车实际离场关联：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '赛哈姆登上运输车，停在中央庭。',
 '赛哈姆没有登上运输车，车辆驶离中央庭区域。',
 '赛哈姆未曾上了运输车，车辆驶离中央庭区域。',
 '赛哈姆被抬上运输车，尚未驶离中央庭区域。',
 '赛哈姆不会登上运输车，车辆驶离中央庭区域。',
 '赛哈姆登上运输车，将驶离中央庭区域。',
 '赛哈姆准备登上运输车，随后驶离中央庭区域。',
 '如果赛哈姆登上运输车，随车流驶离中央庭区域，你会跟上。',
 '你回忆赛哈姆登上运输车，随车流驶离中央庭区域的情景。',
 '昨天赛哈姆登上运输车，随车流驶离中央庭区域。',
 '据说赛哈姆登上运输车，随车流驶离中央庭区域。',
 '“赛哈姆登上运输车，随车流驶离中央庭区域。”',
 '赛哈姆的行李被送上运输车，驶离中央庭区域。',
 '赛哈姆的照片被送上运输车，驶离中央庭区域。',
 '赛哈姆站在旁边，希罗登上运输车，驶离中央庭区域。',
 '赛哈姆留在大厅，随行人员登上运输车，驶离中央庭区域。',
 '赛哈姆登上运输车，随后下车，车辆驶离中央庭区域。',
 '赛哈姆登上运输车，但又被放在原地，车辆驶离中央庭区域。',
 '赛哈姆登上运输车，另一辆车驶离中央庭区域。',
 '赛哈姆登上运输车，空车驶离中央庭区域。',
 '赛哈姆登上运输车，驶离中央庭区域内的通道。',
 '赛哈姆登上运输车，驶离中央庭的管辖区域内的主廊。',
 '赛哈姆登上运输车，驶离中央庭 的大厅。',
 '赛哈姆登上运输车，驶离中央庭大门。',
 '赛哈姆登上运输车，驶离中央庭区域。赛哈姆仍留在中央庭。',
 '赛哈姆没有登上运输车。希罗登上运输车，驶离中央庭区域。',
])test('登车关联反例不能冒充人物离场：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});
test('登车全文缺少模型离场命令仍不能自动补命令',()=>{assert.equal(has(run({text:boardingFailure.text,commands:[mon()]}),'day6_saiham'),false);});

const continuationBaseline=fs.readFileSync(new URL('./morning-guard.continuation-baseline.js',import.meta.url),'utf8');
const continuationFailure=JSON.parse(fs.readFileSync(new URL('./continuation-failure.json',import.meta.url),'utf8'));
test('相邻两句真实登车全文修前拒绝、修后保留模型命令',()=>{
 const opts={text:continuationFailure.text,state:continuationFailure.before,user:continuationFailure.user,commands:continuationFailure.commands};
 assert.equal(has(run({...opts,code:continuationBaseline}),'day6_saiham'),false);
 const rows=run(opts);assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
 assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
for(const s of [
 '希罗与押运着赛哈姆的特遣人员踏上研究院运输车队。直到车门闭锁、引擎发动并彻底驶离整个中央庭区域，广场才平静下来。',
 '赛哈姆登上运输车。随后车门闭锁，驶离了整个中央庭区域。',
 '赛哈姆被送上救护车。该车驶出了中央庭的管辖区域。',
 '赛哈姆踏上运输车，驶离整个中央庭区域。',
 '希罗与护送着赛哈姆的随行人员登上运输车，驶离整个中央庭区域。',
])test('同一实际登车事件承接实际驶离：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '赛哈姆没有登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '赛哈姆准备登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '如果赛哈姆登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '你回忆赛哈姆登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '昨天赛哈姆登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后车门闭锁，将驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后车门闭锁，尚未驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后她下车，车辆驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后另一辆汽车驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后空车驶离整个中央庭区域。',
 '赛哈姆登上救护车。运输车驶离整个中央庭区域。',
 '赛哈姆登上救护车，运输车驶离整个中央庭区域。',
 '赛哈姆站在旁边，希罗登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '希罗与押运着赛哈姆的特遣人员准备踏上运输车队。直到车门闭锁并驶离整个中央庭区域，你才会安心。',
 '赛哈姆的行李登上运输车。随后车门闭锁，驶离整个中央庭区域。',
 '赛哈姆登上运输车。运输车停在原地。随后车辆驶离整个中央庭区域。',
 '赛哈姆登上运输车。你走进大厅。随后车辆驶离整个中央庭区域。',
 '赛哈姆登上运输车。随后车辆驶离整个中央庭区域内的道路。',
 '赛哈姆登上运输车。“随后车门闭锁，驶离整个中央庭区域。”',
 '赛哈姆登上运输车。随后车辆驶离整个中央庭区域。赛哈姆仍留在中央庭。',
 '赛哈姆将让希罗登上运输车，驶离中央庭区域。',
])test('相邻句关联仍拒绝非实际离场：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});

const transportBaseline=fs.readFileSync(new URL('./morning-guard.transport-baseline.js',import.meta.url),'utf8');
const transportFailure=JSON.parse(fs.readFileSync(new URL('./transport-failure.json',import.meta.url),'utf8'));
test('载具升空离场完整自然失败正文修前拒绝、修后保留原命令',()=>{
 const opts={text:transportFailure.text,state:transportFailure.before,user:transportFailure.user,commands:transportFailure.commands};
 assert.equal(has(run({...opts,code:transportBaseline}),'day6_saiham'),false);
 for(const commands of [opts.commands,[...opts.commands].reverse()]){
  const rows=run({...opts,commands});assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
  assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
 }
});
for(const vehicle of ['运输车','救护车','飞行器','押运飞行器','运输机','直升机','载具']){
 for(const s of [
  vehicle+'载着希罗与赛哈姆，离开了中央庭整个管辖区域。',
  '载着希罗与赛哈姆的'+vehicle+'升入高空，彻底离开了中央庭整个管辖区域。',
  '搭载着昏迷的赛哈姆的'+vehicle+'离开中央庭的整个区域。',
 ])test('载具与乘员前后语序明确实际离场：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
}
for(const s of [
 '赛哈姆登上飞行器，飞离整个中央庭区域。',
 '赛哈姆被送入飞行器。该飞行器起飞并飞出了中央庭全部管辖区域。',
 '载着赛哈姆与希罗的载具离开中央庭。',
 '载着赛哈姆的飞行器没有再停留，离开中央庭的管辖区域。',
 '希罗与押运着赛哈姆的特遣人员登上飞行器。随后飞行器离开中央庭的整个辖区。',
 '运输车载着赛哈姆。随后车门闭锁，驶离中央庭整个管辖区域。',
])test('实际运输事件只在完整区域离场后结算：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '载着希罗与赛哈姆的载具升入高空。',
 '载着希罗与赛哈姆的载具起飞，在中央庭上空盘旋。',
 '载着希罗与赛哈姆的载具离开中央庭整个管辖区域内的停机坪。',
 '载着希罗与赛哈姆的载具离开中央庭的整个区域 内的主廊。',
 '载着希罗与赛哈姆的载具离开中央庭主楼。',
 '载着希罗与赛哈姆的载具离开中央庭大门。',
 '载着希罗与赛哈姆的载具准备离开中央庭整个管辖区域。',
 '载着希罗与赛哈姆的载具将离开中央庭整个管辖区域。',
 '载着希罗与赛哈姆的载具尚未离开中央庭整个管辖区域。',
 '载着希罗与赛哈姆的载具不会离开中央庭整个管辖区域。',
 '飞行器不载着赛哈姆，离开中央庭整个管辖区域。',
 '飞行器没有搭载赛哈姆，离开中央庭整个管辖区域。',
 '如果载着赛哈姆的飞行器离开中央庭区域，你会安心。',
 '你回忆载着赛哈姆的飞行器离开中央庭区域的情景。',
 '昨天载着赛哈姆的飞行器离开中央庭区域。',
 '据说载着赛哈姆的飞行器离开中央庭区域。',
 '“载着希罗与赛哈姆的载具离开中央庭整个管辖区域。”',
 '载着赛哈姆的行李的飞行器离开中央庭区域。',
 '载着赛哈姆的照片的载具离开中央庭区域。',
 '飞行器载着希罗，从赛哈姆身边飞离中央庭区域。',
 '赛哈姆站在旁边，希罗登上飞行器，飞离中央庭区域。',
 '赛哈姆登上飞行器，但又下机，飞行器离开中央庭区域。',
 '赛哈姆登上飞行器，另一架飞行器离开中央庭区域。',
 '赛哈姆登上飞行器。随后另一架飞行器离开中央庭区域。',
 '赛哈姆登上飞行器。运输车离开中央庭区域。',
 '赛哈姆登上飞行器，空载飞行器离开中央庭区域。',
 '载着赛哈姆的飞行器离开中央庭区域。赛哈姆仍留在中央庭。',
 '飞行器离开中央庭区域，赛哈姆才登上该飞行器。',
 '赛哈姆登上飞行器。飞行器停在原地。随后飞行器离开中央庭区域。',
 '赛哈姆登上飞行器。随后希罗独自离开中央庭区域。',
])test('载具、乘员与离场边界反例：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});
test('载具离场没有模型命令或独白前置仍不得补旗标',()=>{
 assert.equal(has(run({text:transportFailure.text,commands:[mon()]}),'day6_saiham'),false);
 assert.equal(has(run({text:transportFailure.text,commands:[departure()]}),'day6_saiham'),false);
});

const escortBaseline=fs.readFileSync(new URL('./morning-guard-escort-baseline.js',import.meta.url),'utf8');
const escortFailure=JSON.parse(fs.readFileSync(new URL('./escort-failure.json',import.meta.url),'utf8'));
test('徒步运送队伍全文修前拒绝、修后保留原有模型命令',()=>{
 const opts={text:escortFailure.text,state:escortFailure.before,user:escortFailure.user,commands:escortFailure.commands};
 assert.equal(has(run({...opts,code:escortBaseline}),'day6_saiham'),false);
 const rows=run(opts);assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
 assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
for(const s of [
 '希罗与运送赛哈姆的队伍消失在防线之外，离开了整个中央庭的管辖区域。',
 '护送着赛哈姆的随行人员离开了中央庭整个区域。',
 '希罗运送着昏迷的赛哈姆，离开整个中央庭辖区。',
 '运送赛哈姆的队伍迈出大门。随后队伍离开整个中央庭的管辖区域。',
])test('人员运送与完整区域实际离场关联：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '运送赛哈姆的队伍停在大门口。',
 '运送赛哈姆的队伍离开整个中央庭的管辖区域内的大厅。',
 '运送赛哈姆的队伍准备离开整个中央庭的管辖区域。',
 '如果运送赛哈姆的队伍离开整个中央庭的管辖区域，你会跟上。',
 '昨天运送赛哈姆的队伍离开整个中央庭的管辖区域。',
 '你回忆运送赛哈姆的队伍离开整个中央庭的管辖区域的情景。',
 '“运送赛哈姆的队伍离开整个中央庭的管辖区域。”',
 '运送赛哈姆的队伍尚未离开整个中央庭的管辖区域。',
 '运送赛哈姆的队伍没有带走她，离开整个中央庭的管辖区域。',
 '运送赛哈姆的队伍将她放在原地，离开整个中央庭的管辖区域。',
 '运送赛哈姆的行李的队伍离开整个中央庭的管辖区域。',
 '运送赛哈姆的照片的队伍离开整个中央庭的管辖区域。',
 '运送赛哈姆的队伍离开整个中央庭的管辖区域。赛哈姆仍留在中央庭。',
 '运送赛哈姆的队伍停在门口。你回寝室。随后队伍离开整个中央庭的管辖区域。',
 '希罗在赛哈姆身边，带着工作人员离开整个中央庭的管辖区域。',
])test('人员运送的非实际离场反例：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});

for(const s of [
 '运送赛哈姆的队伍将她留在门口，离开整个中央庭的管辖区域。',
 '运送赛哈姆的队伍将她放回大厅，离开整个中央庭的管辖区域。',
 '运送赛哈姆的队伍走到大门。随后另一支队伍离开整个中央庭的管辖区域。',
])test('人员中途留场与另一队伍离场仍不得结算：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});

const factBaseline=fs.readFileSync(new URL('./morning-guard.fact-baseline.js',import.meta.url),'utf8');
for(const s of ['赛哈姆已经被希罗带走。','希罗把赛哈姆带走救治。','希罗已经接走了昏迷的赛哈姆。','赛哈姆由希罗接走。'])test('只凭已发生的接走事实结算，无需路线或载具：'+s,()=>{
 const text=vehicleStory(s);assert.equal(has(run({text,code:factBaseline}),'day6_saiham'),false);assert.ok(has(run({text}),'day6_saiham'));
});
for(const s of ['你允许希罗把赛哈姆带走。','希罗准备把赛哈姆带走。','希罗会把赛哈姆带走。','如果希罗把赛哈姆带走，你会安心。','你回忆希罗把赛哈姆带走的情景。','昨天希罗把赛哈姆带走。','据说赛哈姆被希罗带走。','赛哈姆尚未被希罗带走。','“赛哈姆被希罗带走了。”','希罗把赛哈姆的行李带走。','希罗把赛哈姆的照片带走。','希罗把赛哈姆带走。赛哈姆仍留在中央庭。'])test('许可、未来、传闻、否定和物品不是接走事实：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});
test('本轮接走旗标不能被模型撤销恢复通信',()=>{const state=structuredClone(fixture.morning.before);state.morning_flags.day6_saiham=true;const rows=run({state,commands:[{type:'set',args:['"morning_flags.day6_saiham"','true','false']}],text:'赛哈姆发来消息。'});assert.equal(rows.length,0);});
test('接走事实仍需要真实独白前置且不能自动添加模型命令',()=>{const text=vehicleStory('赛哈姆被希罗带走。');assert.equal(has(run({text,commands:[departure()]}),'day6_saiham'),false);assert.equal(has(run({text,commands:[mon()]}),'day6_saiham'),false);});

const handoffFailure=JSON.parse(fs.readFileSync(new URL('./handoff-failure.json',import.meta.url),'utf8'));
const handoffBaseline=fs.readFileSync(new URL('./morning-guard.handoff-baseline.js',import.meta.url),'utf8');
test('自然正文实际抬起并随希罗接走，修前漏判、修后保留原命令',()=>{
 const opts={text:handoffFailure.text,state:handoffFailure.before,user:handoffFailure.user,commands:handoffFailure.commands};
 assert.equal(has(run({...opts,code:handoffBaseline}),'day6_saiham'),false);
 const rows=run(opts);assert.ok(has(rows,'day6_saiham'));assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
for(const s of [
 '黑衣人员将昏迷的赛哈姆搬上担架，随着希罗一同撤离了长廊。',
 '希罗示意随行人员将赛哈姆带走。',
])test('实际随希罗接走不要求离开地域边界：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '黑衣人员准备将赛哈姆抬上担架，随着希罗撤离长廊。',
 '如果人员将赛哈姆抬上担架，随着希罗撤离长廊，你会安心。',
 '昨天人员将赛哈姆抬上担架，随着希罗撤离长廊。',
 '人员将赛哈姆的行李抬上担架，随着希罗撤离长廊。',
 '人员将赛哈姆抬上担架，随后希罗独自离开。',
 '人员将赛哈姆抬上担架，但尚未随着希罗撤离。',
 '希罗准备示意人员将赛哈姆带走。',
 '希罗允许人员将赛哈姆带走。',
])test('随希罗的计划、否定和其他主体不算已接走：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});

const adjacentFailure=JSON.parse(fs.readFileSync(new URL('./adjacent-failure.json',import.meta.url),'utf8'));
const adjacentBaseline=fs.readFileSync(new URL('./morning-guard.adjacent-baseline.js',import.meta.url),'utf8');
test('希罗人员抬起本人后同一行人离开，完整自然正文修前拒绝修后保留原命令',()=>{
 const opts={text:adjacentFailure.text,state:adjacentFailure.before,user:adjacentFailure.user,commands:adjacentFailure.commands};
 assert.equal(has(run({...opts,code:adjacentBaseline}),'day6_saiham'),false);
 const rows=run(opts);assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
 assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
for(const s of [
 '希罗示意随行人员小心抬起赛哈姆。一行人迅速穿过走廊离开。',
 '希罗微微颔首，没有再多说一句劝诱的话，示意随行人员小心抬起赛哈姆。一行人迅速穿过走廊离开，脚步声渐渐远去。',
 '希罗的黑衣人员抱起昏迷的赛哈姆。随后他们迅速离去。',
 '希罗的人员将赛哈姆抬上担架。接着这支队伍一同撤离。',
 '希罗的随从扶起受伤的赛哈姆。随行人员离开。',
])test('紧邻两句实际接走不检查路线或地域：'+s,()=>{assert.ok(has(run({text:vehicleStory(s)}),'day6_saiham'));});
for(const s of [
 '希罗示意人员抬起赛哈姆。',
 '希罗准备示意人员抬起赛哈姆。一行人离开。',
 '希罗允许人员抬起赛哈姆。一行人离开。',
 '如果希罗的人员抬起赛哈姆。一行人离开。',
 '昨天希罗的人员抬起赛哈姆。一行人离开。',
 '你回忆希罗的人员抬起赛哈姆。一行人离开。',
 '据说希罗的人员抬起赛哈姆。一行人离开。',
 '希罗的人员没有抬起赛哈姆。一行人离开。',
 '希罗的人员尚未抬起赛哈姆。一行人离开。',
 '希罗的人员会抬起赛哈姆。一行人离开。',
 '希罗的人员抬起赛哈姆的行李。一行人离开。',
 '希罗的人员抱起赛哈姆的照片。一行人离开。',
 '希罗的人员抬起赛哈姆。随后希罗独自离开。',
 '希罗的人员抬起赛哈姆。另一支队伍离开。',
 '希罗的人员抬起赛哈姆。一行人看着安离开。',
 '希罗的人员抬起赛哈姆。一行人准备离开。',
 '希罗的人员抬起赛哈姆。一行人将会离开。',
 '希罗的人员抬起赛哈姆。一行人尚未离开。',
 '希罗的人员抬起赛哈姆。如果一行人离开，你会安心。',
 '希罗的人员抬起赛哈姆。据说一行人离开。',
 '希罗的人员抬起赛哈姆。一行人把她放回病房后离开。',
 '希罗的人员抬起赛哈姆。一行人离开，但将赛哈姆留在门口。',
 '希罗的人员抬起赛哈姆，随后又把她放下。一行人离开。',
 '希罗的人员抬起赛哈姆。一行人抬着空担架离开。',
 '希罗的人员抬起赛哈姆。你转身回房。一行人离开。',
 '希罗的人员抬起赛哈姆。\n\n一行人离开。',
 '“希罗的人员抬起赛哈姆。一行人离开。”',
 '希罗的人员抬起赛哈姆。一行人离开。赛哈姆仍留在中央庭。',
])test('紧邻接走拒绝未执行、否定、其他对象和留场：'+s,()=>{assert.equal(has(run({text:vehicleStory(s)}),'day6_saiham'),false);});
test('相邻接走不能补模型命令，不能绕过独白前置，也不能从选项或更新注释结算',()=>{
 const text=vehicleStory('希罗的人员抬起赛哈姆。一行人离开。');
 assert.equal(has(run({text,commands:[mon()]}),'day6_saiham'),false);
 assert.equal(has(run({text,commands:[departure()]}),'day6_saiham'),false);
 assert.equal(has(run({text:vehicleStory('<f7d_choices>希罗的人员抬起赛哈姆。一行人离开。</f7d_choices>')}),'day6_saiham'),false);
 assert.equal(has(run({text:vehicleStory('<UpdateVariable> // 希罗的人员抬起赛哈姆。一行人离开。</UpdateVariable>')}),'day6_saiham'),false);
});

const carrierFailure=JSON.parse(fs.readFileSync(new URL('./carrier-failure.json',import.meta.url),'utf8'));
const carrierBaseline=fs.readFileSync(new URL('./morning-guard.carrier-baseline.js',import.meta.url),'utf8');
test('人员抬走后希罗随同离去，完整自然正文修前拒绝修后保留原有命令',()=>{
 const opts={text:carrierFailure.text,state:carrierFailure.before,user:carrierFailure.user,commands:carrierFailure.commands};
 assert.equal(has(run({...opts,code:carrierBaseline}),'day6_saiham'),false);
 const rows=run(opts);assert.ok(has(rows,'day6_monologue'));assert.ok(has(rows,'day6_saiham'));
 assert.ok(rows.every(c=>opts.commands.some(old=>JSON.stringify(old)===JSON.stringify(c))));
});
const carrierStory=(first='两名部下迅速上前，将昏迷不醒的赛哈姆抬上专用的维生担架，带着抑制设备快步撤离回廊。',last='希罗向你微微颔首，随即随着医疗队伍一同离去。')=>vehicleStory(first+last);
for(const [first,last] of [
 [undefined,undefined],
 ['部下将赛哈姆抱起并离开。','希罗随后跟着护送队伍离去。'],
 ['随从把受伤的赛哈姆扶起，一同撤离。','希罗随他们离开。'],
])test('实际抬走与希罗随后同行的事件语序：'+first,()=>{assert.ok(has(run({text:carrierStory(first,last)}),'day6_saiham'));});
for(const [first,last] of [
 ['部下准备将赛哈姆抬上担架，撤离。',undefined],
 ['部下尚未将赛哈姆抬上担架，撤离。',undefined],
 ['昨天部下将赛哈姆抬上担架，撤离。',undefined],
 ['如果部下将赛哈姆抬上担架，撤离。',undefined],
 ['据说部下将赛哈姆抬上担架，撤离。',undefined],
 ['部下将赛哈姆的行李抬上担架，撤离。',undefined],
 ['部下将赛哈姆的照片抬上担架，撤离。',undefined],
 ['部下将赛哈姆抬上担架，等待。',undefined],
 ['部下将赛哈姆抬上担架，尚未撤离。',undefined],
 ['部下将赛哈姆抬上担架，随后你离开。',undefined],
 ['部下将赛哈姆抬上担架，看着安离开。',undefined],
 ['部下将赛哈姆抬上担架，空担架离开。',undefined],
 ['部下将赛哈姆抬上担架，把她留在原地后离开。',undefined],
 ['部下将赛哈姆抬上担架，离开。','希罗准备随着医疗队伍离去。'],
 ['部下将赛哈姆抬上担架，离开。','希罗尚未随着医疗队伍离去。'],
 ['部下将赛哈姆抬上担架，离开。','希罗独自离去。'],
 ['部下将赛哈姆抬上担架，离开。','希罗看着医疗队伍离去。'],
 ['部下将赛哈姆抬上担架，离开。','你返回房间。希罗随着医疗队伍离去。'],
 ['部下将赛哈姆抬上担架，离开。\n\n','希罗随着医疗队伍离去。'],
 ['部下将赛哈姆抬上担架，离开。','希罗随着医疗队伍离去。赛哈姆仍留在中央庭。'],
])test('人员接走事件的计划、否定、留场和主体断开反例：'+first+last,()=>{assert.equal(has(run({text:carrierStory(first,last)}),'day6_saiham'),false);});
test('人员接走仍不能补命令或跳过晨间独白',()=>{
 const text=carrierStory();assert.equal(has(run({text,commands:[mon()]}),'day6_saiham'),false);assert.equal(has(run({text,commands:[departure()]}),'day6_saiham'),false);
});
