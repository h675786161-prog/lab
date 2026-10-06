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
