const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const real=JSON.parse(fs.readFileSync(__dirname+'/replay-fixture.json'));
const before=real.before;
function run(file,{user=real.user,text=real.text,state=before,commands=[],history=[]}={}){
 const listeners=new Map(),removed=[],lifecycle=new Map();
 const host={SillyTavern:{getContext:()=>({chat:[...history,{is_user:true,mes:user}]})},Mvu:{events:{COMMAND_PARSED:'parsed'}}};
 const win={parent:host,TavernHelper:{eventOn:(key,fn)=>listeners.set(key,fn),eventRemoveListener:(key,fn)=>{assert.equal(listeners.get(key),fn);listeners.delete(key);removed.push(key)}},addEventListener:(key,fn)=>lifecycle.set(key,fn)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/'+file,'utf8'),{window:win,console});
 assert.equal(host.__F7D_MVU_GUARD__.ready,true);
 const input={stat_data:structuredClone(state)},initial=JSON.stringify(input),out=structuredClone(commands);
 listeners.get('parsed')(input,out,text);
 assert.equal(JSON.stringify(input),initial,'守卫不能直接写变量');
 lifecycle.get('pagehide')();assert.equal(listeners.size,0,'卸载应解除回调');
 return JSON.parse(JSON.stringify(out));
}
const has=(xs,path)=>xs.some(c=>c.args[0]===path&&c.args.at(-1)==='true');
const rows=[];function test(name,fn){fn();rows.push({name,passed:true});}
let baseline,fixed;
test('原始整段守卫复现真实漏判',()=>{baseline=run('morning-guard.js');assert(has(baseline,'morning_flags.day6_monologue'));assert(!has(baseline,'morning_flags.day6_saiham'));});
test('修正整段守卫补齐离场命令',()=>{fixed=run('morning-guard.fixed.js');assert(has(fixed,'morning_flags.day6_monologue'));assert(has(fixed,'morning_flags.day6_saiham'));});
test('尚未决定不结算',()=>{assert(!has(run('morning-guard.fixed.js',{user:'先听希罗解释，暂不表态。'}),'morning_flags.day6_saiham'));});
test('只演出离场但没有晨间独白不结算',()=>{assert(!has(run('morning-guard.fixed.js',{text:'希罗处理活骸化的赛哈姆。赛哈姆被带离了中央庭。'}),'morning_flags.day6_saiham'));});
test('对白中的离场不结算且删去模型错误命令',()=>{const text='黑暗的虚空中响起低语。\n\n希罗处理活骸化的赛哈姆。“赛哈姆被带离了中央庭。”';assert(!has(run('morning-guard.fixed.js',{text,commands:[{type:'set',args:['morning_flags.day6_saiham','false','true']}]}),'morning_flags.day6_saiham'));});
test('尚未离场不结算且删去模型错误命令',()=>{const text='黑暗的虚空中响起低语。\n\n希罗处理活骸化的赛哈姆。赛哈姆尚未被带离中央庭。';assert(!has(run('morning-guard.fixed.js',{text,commands:[{type:'set',args:['morning_flags.day6_saiham','false','true']}]}),'morning_flags.day6_saiham'));});
test('前一天离场历史不替代今天演出',()=>{const old=structuredClone(before);old.day=7;assert(!has(run('morning-guard.fixed.js',{text:'你睁开眼。',history:[{is_user:false,mes:real.text,variables:{0:{stat_data:old}}}]}),'morning_flags.day6_saiham'));});
test('已结算的旗标不重复补写',()=>{const state=structuredClone(before);state.morning_flags.day6_saiham=true;state.morning_flags.day6_monologue=true;assert(!has(run('morning-guard.fixed.js',{state}),'morning_flags.day6_saiham'));});
test('晨间锁定拒绝额外消耗时间',()=>{const xs=run('morning-guard.fixed.js',{commands:[{type:'set',args:['clock_minutes','480','560']}]});assert(!xs.some(x=>x.args[0]==='clock_minutes'));});
const result={sourceCommit:'5bf28e33407938e42a5cdbbaad4c250e7dea0d99',sourceRun:'37211901343',scope:'整段守卫运行于模拟事件环境；不是实机提交验收',count:rows.length,rows,baseline,fixed};
fs.writeFileSync(__dirname+'/full-guard-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
