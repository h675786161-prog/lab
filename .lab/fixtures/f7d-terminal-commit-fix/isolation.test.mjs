import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('./card-provider.js',import.meta.url),'utf8');
const baseline=fs.readFileSync(new URL('./card-provider.baseline.js',import.meta.url),'utf8');
function setup(code=source){
 const emitter=new EventEmitter();emitter.makeFirst=(type,fn)=>{emitter.removeListener(type,fn);emitter.prependListener(type,fn);};
 const context={chatId:'chat-a',characterId:0,groupId:null,chat:[{mes:'当下剧情',swipe_id:0}],accountStorage:{getItem:()=>null,setItem:()=>{}},eventSource:emitter,eventTypes:Object.fromEntries(['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_SWIPE_DELETED','MESSAGE_EDITED','MESSAGE_DELETED','CHARACTER_FIRST_MESSAGE_SELECTED','GENERATION_STARTED','GENERATION_STOPPED','GENERATION_ENDED','MESSAGE_SENT','MESSAGE_RECEIVED'].map(x=>[x,x]))};
 const host={document:{},crypto,SillyTavern:{getContext:()=>context},dispatchEvent:()=>{},Event:class{constructor(type){this.type=type;}}};
 const win={parent:host,addEventListener:()=>{},removeEventListener:()=>{}};
 vm.runInNewContext(code,{window:win,console});
 return {context,host,emitter,bridge:host.__f7dCommitBridge,api:host.f7dTacticalTerminal};
}
test('原签名误拒绝变量框架追加的状态栏换行',()=>{const x=setup(baseline),t=x.bridge.capture();x.context.chat[0].mes+='\n\n<StatusPlaceHolderImpl/>';assert.equal(x.bridge.valid(t),false);});
test('修正只容许标签及尾部空白格式变化',()=>{const x=setup(),t=x.bridge.capture();x.context.chat[0].mes+='\n\n<StatusPlaceHolderImpl/>';assert.equal(x.bridge.valid(t),true);x.context.chat[0].mes+='\n下一段剧情';assert.equal(x.bridge.valid(t),false);});
for(const [name,mutate] of [
 ['切聊天',x=>x.context.chatId='chat-b'],
 ['切角色',x=>x.context.characterId=1],
 ['切群组',x=>x.context.groupId='group-b'],
 ['切消息分支',x=>x.context.chat[0].swipe_id=1],
 ['替换消息对象',x=>x.context.chat[0]={...x.context.chat[0]}],
 ['编辑正文',x=>x.context.chat[0].mes='被编辑的剧情'],
 ['追加消息',x=>x.context.chat.push({mes:'新楼层'})],
 ['删除消息',x=>x.context.chat.pop()],
 ['内部换行变化',x=>x.context.chat[0].mes='当下\n剧情'],
 ['前置空白变化',x=>x.context.chat[0].mes=' 当下剧情'],
])test(name+'使旧事务失效',()=>{const x=setup(),t=x.bridge.capture();mutate(x);assert.equal(x.bridge.valid(t),false);});
for(const name of ['MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_DELETED','CHAT_CHANGED','GENERATION_STOPPED','GENERATION_STARTED','MESSAGE_SENT','MESSAGE_RECEIVED'])test(name+'使旧事务失效且清空',()=>{const x=setup(),t=x.bridge.capture();x.emitter.emit(name,'normal',{},false);assert.equal(x.bridge.valid(t),false);assert.equal(x.api.getSnapshot().snapshot,null);});
test('仅修改尾部空白的编辑事件仍失效',()=>{const x=setup(),t=x.bridge.capture();x.context.chat[0].mes+=' ';x.emitter.emit('MESSAGE_EDITED');assert.equal(x.bridge.valid(t),false);});
test('发布必须等已提交变量与正常生成结束',()=>{
 const x=setup();const data={stat_data:{schema:'f7d_textloop_0.4',loop:1,day:6,clock_minutes:560,location:'中央庭'}};
 x.emitter.emit('GENERATION_STARTED','normal',{},false);const t=x.bridge.capture();x.context.chat[0].mes+='\n\n<StatusPlaceHolderImpl/>';
 assert.equal(x.bridge.publish(t,0,()=>data),true);assert.equal(x.api.getSnapshot().status,'empty');
 x.emitter.emit('GENERATION_ENDED');assert.equal(x.api.getSnapshot().status,'ready');assert.equal(x.api.getSnapshot().snapshot.header.timeLabel,'09:20');
});
test('中止后迟到发布不能恢复',()=>{const x=setup();x.emitter.emit('GENERATION_STARTED','normal',{},false);const t=x.bridge.capture();x.emitter.emit('GENERATION_STOPPED');assert.equal(x.bridge.publish(t,0,()=>({stat_data:{schema:'f7d_textloop_0.4',loop:1}})),false);x.emitter.emit('GENERATION_ENDED');assert.equal(x.api.getSnapshot().status,'empty');});
test('重复加载只有一组监听且旧票据失效',()=>{const x=setup(),t=x.bridge.capture();const counts=x.emitter.eventNames().map(k=>[k,x.emitter.listenerCount(k)]);vm.runInNewContext(source,{window:{parent:x.host,addEventListener:()=>{},removeEventListener:()=>{}},console});assert.equal(x.bridge.valid(t),false);assert.deepEqual(x.emitter.eventNames().map(k=>[k,x.emitter.listenerCount(k)]),counts);});
