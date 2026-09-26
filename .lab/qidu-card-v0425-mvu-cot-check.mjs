import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {addMvuCot,VERSION,MVU_COMMIT} from './qidu-card-v0425-mvu-cot.mjs';

const source=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const card=addMvuCot(source),d=card.data;
assert.equal(d.character_version,VERSION);
assert.equal(d.first_mes.includes('<f7d_state>'),false);
const greeting=JSON.parse(d.first_mes.match(/<initvar>(.*?)<\/initvar>/s)[1]);
const entry=d.character_book.entries.find(x=>x.name.startsWith('[InitVar]'));
assert.deepEqual(JSON.parse(entry.content),greeting);
assert.equal(entry.enabled,false);
assert.equal(new Set(d.character_book.entries.map(x=>x.id)).size,d.character_book.entries.length);
assert.equal(greeting.tasks.$meta.extensible,true);
assert.equal(greeting.relationships.$meta.extensible,true);
assert.equal(greeting.npc_intel.$meta.extensible,true);
assert.equal(greeting.node_used,undefined);
assert.equal(d.post_history_instructions.includes('f7d_state>最终状态'),false);
assert.equal(d.post_history_instructions.includes('{{get_message_variable::stat_data}}'),true);
assert.equal(/12个行动节点|6次巡查|<f7d_state>/.test(d.description+d.scenario+d.mes_example),false);
assert.equal(d.extensions.tavern_helper.scripts.some(x=>x.content.includes(`@${MVU_COMMIT}/artifact/bundle.js`)),true);

const scripts=d.extensions.tavern_helper.scripts;
assert.equal(typeof scripts[1].export_with,'object');
assert.ok(Array.isArray(scripts[1].button.buttons));
const guard=scripts.find(x=>x.id==='qidu-v0425-mvu-guard').content;
let listener=null,user='';
const mock={
  window:{TavernHelper:{eventOn:(ev,fn)=>listener=fn,eventRemoveListener:()=>{},waitGlobalInitialized:async()=>{}},Mvu:{events:{COMMAND_PARSED:'mag_command_parsed'}},parent:{SillyTavern:{getContext:()=>({chat:[{is_user:true,mes:user}]})}},addEventListener:()=>{}},console
};
vm.runInNewContext(guard,mock);
await new Promise(r=>setTimeout(r,0));assert.ok(listener);
const stat={...greeting,regions:{...greeting.regions,school:{liberated:true,build_steps:[]}},cores:{...greeting.cores,school:'available'}};
function filter(path,next,text){user=text;const commands=[{type:'set',args:[path,JSON.stringify(next)]}];listener({stat_data:stat},commands,'');return commands.length;}
assert.equal(filter('cores.school','purified','查看黑核'),0);
assert.equal(filter('"cores.school"','purified','查看黑核'),0);
assert.equal(filter('cores.school','purified','现在净化黑核'),1);
assert.equal(filter('cores.school','stolen','现在净化黑核'),1);
stat.cores.school='stolen';assert.equal(filter('cores.school','available','夺回黑核'),0);
stat.cores.school='available';assert.equal(filter('meta.endings',['HAPPY END'],''),0);
assert.equal(filter('day',6,'随便聊聊'),0);
assert.equal(filter('day',6,'睡到明天'),1);
assert.equal(filter('node_used',1,'睡到明天'),0);
assert.equal(filter('regions',{court:{}},'睡到明天'),0);
assert.equal(filter('cg_system.shown.ann_first_meet',false,''),0);
console.log('PASS: card schema, MVU init, CoT prompt, pinned plugin, and 10 guard decisions');
