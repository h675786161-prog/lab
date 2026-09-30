import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const withWB=process.env.F7D_WITH_WB!=='0';const root=process.cwd(),fixture=process.env.F7D_FIXTURE_DIR||root+'/deliverables/f7d-terminal',out=process.env.LAB_EVIDENCE_DIR||fixture+'/evidence-card-only';const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY||'/tmp/f7d-browser/node_modules/playwright/index.mjs');const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';await fs.mkdir(out,{recursive:true});
const c=JSON.parse(await fs.readFile(fixture+'/Qidu-v0.4.41-terminal-v1.json','utf8'));
const provider=c.data.extensions.tavern_helper.scripts[0],hook=await fs.readFile(fixture+'/mvu-commit-hook.js','utf8');
const init=JSON.parse(c.data.character_book.entries.find(x=>x.comment.startsWith('[InitVar]')).content);
const b=await chromium.launch({headless:true,...(process.env.LAB_CHROME?{executablePath:process.env.LAB_CHROME}:{}),args:['--no-sandbox']});const p=await b.newPage({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});const pageErrors=[],httpErrors=[];p.on('pageerror',e=>{pageErrors.push({message:e.message,stack:e.stack});console.log('PAGE_ERROR',e.message,e.stack)});p.on('response',async r=>{if(r.status()>=400){httpErrors.push({status:r.status(),path:new URL(r.url()).pathname});console.log('HTTP_ERROR',r.status(),new URL(r.url()).pathname)};});
p.setDefaultTimeout(15000);const tests=[];const check=(name,result)=>{assert.equal(result,true,name);tests.push({场景:name,结果:'通过'});console.log('通过',name);};
try{
await p.goto(baseUrl);await p.waitForTimeout(3000);
await p.evaluate(async ({init,c})=>{const f=new FormData();f.set('file_type','json');f.set('avatar',new Blob([JSON.stringify(c)],{type:'application/json'}),'qidu-terminal.json');const csrf=await (await fetch('/csrf-token')).json();const imported=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:f});if(!imported.ok)throw Error('导入失败');const st=await import('/script.js');await st.getCharacters();const i=st.characters.findIndex(x=>x.data?.character_version==='0.4.41-terminal-v1');st.setCharacterId(i);window.__initial=init;st.chat.splice(0,st.chat.length,{name:'七都',is_user:false,is_system:false,mes:'安在病房里向你说明情况。',swipe_id:0,variables:{0:{stat_data:init}}});await st.eventSource.emit('app_ready');for(const x of document.querySelectorAll('dialog'))x.remove();},{init,c});
await p.evaluate(({provider,hook,others})=>TavernHelper.replaceScriptTrees([provider,...others,{...provider,id:'f7d-mvu-test',name:'七都验收框架',content:hook+'\nawait import("/f7d-mvu.js");'}],{type:'global'}),{provider,hook,others:c.data.extensions.tavern_helper.scripts.filter((x,i)=>i!==0&&!x.name.includes('固定版本'))});
await p.waitForFunction(()=>window.Mvu&&window.f7dTacticalTerminal&&[...document.querySelectorAll('iframe')].some(f=>f.contentWindow?.__f7dCommitHook),{timeout:60000});
await p.waitForTimeout(1000);await p.evaluate(()=>window.dispatchEvent(new Event('f7d:reload-committed')));
const run=fn=>p.evaluate(fn);
await run(()=>{window.__audit=[];window.f7dTacticalTerminal.subscribe(e=>__audit.push(e));});
check('真实助手脚本窗口向酒馆父窗口暴露接口',await run(()=>f7dTacticalTerminal.version===1&&f7dTacticalTerminal.getSnapshot().status==='ready'));
check('未知任务、联系人、资讯与日志全部留空',await run(()=>{const s=f7dTacticalTerminal.getSnapshot().snapshot;return [s.tasks,s.contacts,s.city,s.journal].every(x=>x.length===0)}));
check('隐藏剧情字段没有进入接口',await run(()=>!/(ann_origin_known|hiro_chimera|loop_truth|npc_intel|route_flags)/.test(JSON.stringify(f7dTacticalTerminal.getSnapshot()))));
const commit=async changes=>p.evaluate(async changes=>{const frame=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;let d=Mvu.getMvuData({type:'message',message_id:0});d.stat_data ||= structuredClone(window.__initial);Object.assign(d.stat_data,changes);await frame.replaceVariables(d,{type:'message',message_id:0});},changes);
await commit({tasks:{A:{title:'已知救援',objective:'救援',known:true,deadline_known:false,deadline:'隐藏期限',status:'active'},B:{title:'已过期任务',objective:'旧任务',known:true,status:'expired'},C:{title:'隐藏剧情',known:false,status:'active'},D:{title:'未激活',known:true,status:'pending'}},known:['安'],terminal:{contacts:{安:{name:'安',known:true,channel_acquired:true,channel:'战术终端通讯',available:true},希罗:{name:'希罗',known:true,channel_acquired:true,channel:'隐藏联系',available:true}},city:[{id:'N',title:'已知资讯',body:'现场记录',known:true,loop:1},{id:'X',title:'安的身世',body:'隐藏',known:false,loop:1}],journal:[{id:'J',title:'本轮记录',body:'病房醒来',known:true,loop:1},{id:'OLD',title:'上轮真相',body:'隐藏',known:true,loop:2}]}});
check('任务激活与过期正确、未告知期限隐藏',await run(()=>{const t=f7dTacticalTerminal.getSnapshot().snapshot.tasks;return t.length===2&&t[0].statusLabel==='进行中'&&t[0].deadlineLabel===''&&t[1].statusLabel==='已过期'}));
check('联系人取得条件及日志轮回过滤正确',await run(()=>{const s=f7dTacticalTerminal.getSnapshot().snapshot;return s.contacts.length===1&&s.contacts[0].name==='安'&&s.city.length===1&&s.journal.length===1}));
await run(()=>{document.querySelector('#send_textarea').value='';window.__before=JSON.stringify(Mvu.getMvuData({type:'message',message_id:0}));});
check('联系只填可编辑草稿、不发消息不改状态',await run(async()=>{const s=f7dTacticalTerminal.getSnapshot().snapshot;const n=SillyTavern.getContext().chat.length;const r=await f7dTacticalTerminal.requestIntent({type:'contact',id:'安',revision:s.revision});return r.ok&&r.inserted&&document.querySelector('#send_textarea').value===r.draft&&n===SillyTavern.getContext().chat.length&&__before===JSON.stringify(Mvu.getMvuData({type:'message',message_id:0}))}));
check('输入框已有文字时不覆盖并保留草稿',await run(async()=>{const s=f7dTacticalTerminal.getSnapshot().snapshot;document.querySelector('#send_textarea').value='我的原有输入';const r=await f7dTacticalTerminal.requestIntent({type:'viewTask',id:'A',revision:s.revision});return r.error.code==='COMPOSER_OCCUPIED'&&!!r.draft&&document.querySelector('#send_textarea').value==='我的原有输入'}));
check('同步快照被调用者修改不会反写',await run(()=>{const s=f7dTacticalTerminal.getSnapshot();s.snapshot.tasks=[];return f7dTacticalTerminal.getSnapshot().snapshot.tasks.length===2}));
await commit({meta:{cg:['cg_antoneva_first_meet']}});
await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.GENERATION_STARTED,'normal',{},false);});
check('生成开始立即清空',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null));
await commit({location:'未结束生成地点'});
check('生成中的已写入快照也不提前展示',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null));
await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.GENERATION_STOPPED);await x.eventSource.emit(x.eventTypes.GENERATION_ENDED);const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;const d=Mvu.getMvuData({type:'message',message_id:0});d.stat_data.location='中止后迟到';await f.replaceVariables(d,{type:'message',message_id:0});});
check('中止后结束事件和迟到提交均不能更新',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null&&Mvu.getMvuData({type:'message',message_id:0}).stat_data.location!=='中止后迟到'));
await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.GENERATION_STARTED,'normal',{},false);});
await commit({location:'有效提交'});await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.GENERATION_ENDED);});
check('正常生成只有写入完成后恢复展示',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot?.header.location==='有效提交'));
check('固定变量框架解析结束不抢先发布，写入后才更新',await run(async()=>{
 const before=f7dTacticalTerminal.getSnapshot().snapshot.header.location;
 const old=Mvu.getMvuData({type:'message',message_id:0});
 const parsed=await Mvu.parseMessage("<UpdateVariable>_.set('location', '变量框架真实解析');</UpdateVariable>",old);
 const pending=f7dTacticalTerminal.getSnapshot().snapshot.header.location===before;
 const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;
 await f.replaceVariables(parsed,{type:'message',message_id:0});
 return pending&&f7dTacticalTerminal.getSnapshot().snapshot.header.location==='变量框架真实解析';
}));
await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.MESSAGE_EDITED,0);});
check('编辑消息不重新发布旧变量',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null));
await commit({location:'编辑后实际提交'});
check('编辑后重新提交才恢复',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot.header.location==='编辑后实际提交'));
await run(async()=>{const x=SillyTavern.getContext();window.__oldRevision=f7dTacticalTerminal.getSnapshot().snapshot.revision;x.chat[0].swipe_id=1;await x.eventSource.emit(x.eventTypes.MESSAGE_SWIPED,0);});
check('切消息分支立即清空且不回捞旧分支',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null));
await commit({location:'新分支',loop:2,known:[],tasks:{},terminal:{contacts:{},city:[],journal:[]},meta:{cg:[]},cg_system:{shown:{}}});
check('新轮回剧情记录清空、已解锁相册保留',await run(()=>{const s=f7dTacticalTerminal.getSnapshot().snapshot;return s.scope.loop===2&&s.tasks.length===0&&s.contacts.length===0&&s.album.items.some(x=>x.id==='ann_first_meet')&&!!f7dTacticalTerminal.getAsset('ann_first_meet')&&f7dTacticalTerminal.getAsset('ending_journey')===null}));
await run(async()=>{const st=await import('/script.js');const i=st.characters.findIndex(x=>x.data?.character_version!=='0.4.41-terminal-v1');st.setCharacterId(i);const x=SillyTavern.getContext();x.chat.splice(0,x.chat.length,{name:'其他角色',is_user:false,mes:'普通聊天',swipe_id:0});await x.eventSource.emit(x.eventTypes.CHAT_CHANGED,x.chatId);});
check('切普通聊天无旧剧情和相册残留',await run(()=>f7dTacticalTerminal.getSnapshot().snapshot===null));
check('删除消息先清空，不展示已删除楼层',await run(async()=>{
 const x=SillyTavern.getContext();x.chat.splice(0);void x.eventSource.emit(x.eventTypes.MESSAGE_DELETED,0);
 return f7dTacticalTerminal.getSnapshot().snapshot===null;
}));
await p.evaluate(async init=>{const st=await import('/script.js');st.setCharacterId(st.characters.findIndex(x=>x.data?.character_version==='0.4.41-terminal-v1'));st.chat.splice(0,st.chat.length,{name:'七都',is_user:false,mes:'测试',swipe_id:0,variables:{0:{stat_data:init}}});await st.eventSource.emit('chat_id_changed',SillyTavern.getContext().chatId);},init);
await p.evaluate(provider=>{console.log('开始重载');const old=f7dTacticalTerminal;window.__old=old;TavernHelper.replaceScriptTrees(TavernHelper.getScriptTrees({type:'global'}).map(x=>x.id===provider.id?{...provider,content:provider.content+'\n/*重新加载*/'}:x),{type:'global'});},provider);
await p.waitForTimeout(1000);
check('重复加载旧提供者卸载，新监听不重复',await run(async()=>{let count=0;const off=f7dTacticalTerminal.subscribe(()=>count++);const x=SillyTavern.getContext();void x.eventSource.emit(x.eventTypes.GENERATION_STARTED,'normal',{},false);off();return __old!==f7dTacticalTerminal&&count===2&&__old.getSnapshot().snapshot===null}));
await run(async()=>{const x=SillyTavern.getContext();await x.eventSource.emit(x.eventTypes.GENERATION_ENDED);});await commit({location:'中央庭',schema:'f7d_textloop_0.4'});
await commit({schema:'不兼容测试'});check('变量版本不兼容时关闭展示',await run(()=>f7dTacticalTerminal.getSnapshot().status==='error'&&f7dTacticalTerminal.getSnapshot().snapshot===null));await commit({schema:'f7d_textloop_0.4'});
if(withWB)check('同装世界背面时卡侧接口就绪',await run(()=>f7dTacticalTerminal.getSnapshot().status==='ready'&&worldBackstageHost.phoneBridgeVersion===2));else check('没有世界背面时独立工作',await run(()=>f7dTacticalTerminal.getSnapshot().status==='ready'&&!window.worldBackstageHost));

if(withWB){
await p.waitForSelector('#world-backstage-root',{timeout:30000,state:'attached'});
check('完整世界背面扩展根界面和 Phone Bridge v2 同时存在',await run(()=>!!document.querySelector('#world-backstage-root')&&worldBackstageHost.phoneBridgeVersion===2));
check('卡侧提交未改写世界背面状态与桥对象',await run(async()=>{
 const ctx=SillyTavern.getContext(),metadata=ctx.chatMetadata||ctx.chat_metadata;
 const core=await import('/scripts/extensions/third-party/world-backstage-test/core.js');const previous=metadata.world_backstage_v1;metadata.world_backstage_v1={...previous,currentState:core.createInitialState({worldName:'WB隔离哨兵'})};metadata.world_backstage_v1.currentState.world.name='WB隔离哨兵';
 const before=JSON.stringify(metadata.world_backstage_v1),bridge=worldBackstageHost.getPhoneSurface;
 const frame=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;
 const d=Mvu.getMvuData({type:'message',message_id:0});d.stat_data.location='七都隔离哨兵';
 await frame.replaceVariables(d,{type:'message',message_id:0});
 return before===JSON.stringify(metadata.world_backstage_v1)&&bridge===worldBackstageHost.getPhoneSurface&&worldBackstageHost.getPhoneSurface().worldName==='WB隔离哨兵'&&!JSON.stringify(worldBackstageHost.getPhoneSurface()).includes('七都隔离哨兵')&&!JSON.stringify(f7dTacticalTerminal.getSnapshot()).includes('WB隔离哨兵');
}));
check('世界背面公开桥读取不改写 MVU 与七都 revision',await run(()=>{
 const before=JSON.stringify(Mvu.getMvuData({type:'message',message_id:0})),revision=f7dTacticalTerminal.getSnapshot().snapshot.revision;
 worldBackstageHost.getPhoneSurface();
 return before===JSON.stringify(Mvu.getMvuData({type:'message',message_id:0}))&&revision===f7dTacticalTerminal.getSnapshot().snapshot.revision;
}));
}
check('过期 revision 与非法操作均拒绝',await run(async()=>{
 const s=f7dTacticalTerminal.getSnapshot().snapshot;
 return (await f7dTacticalTerminal.requestIntent({type:'viewTerminal',revision:'old'})).error.code==='STALE_SNAPSHOT'&&(await f7dTacticalTerminal.requestIntent({type:'writeState',revision:s.revision})).error.code==='INVALID_INTENT';
}));
check('空格输入不覆盖',await run(async()=>{
 document.querySelector('#send_textarea').value='  ';
 const r=await f7dTacticalTerminal.requestIntent({type:'viewTerminal',revision:f7dTacticalTerminal.getSnapshot().snapshot.revision});
 return r.error.code==='COMPOSER_OCCUPIED'&&document.querySelector('#send_textarea').value==='  ';
}));
check('相册读取损坏时明确警告且不覆盖原记录',await run(async()=>{
 const storage=SillyTavern.getContext().accountStorage,old=storage.getItem('f7d.album.v1');storage.setItem('f7d.album.v1','损坏原记录');
 try{const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;await f.replaceVariables(Mvu.getMvuData({type:'message',message_id:0}),{type:'message',message_id:0});return f7dTacticalTerminal.getSnapshot().snapshot.album.warning.includes('未覆盖')&&storage.getItem('f7d.album.v1')==='损坏原记录';}
 finally{storage.setItem('f7d.album.v1',old);}
}));
check('相册写入失败有警告且不污染角色知识',await run(async()=>{
 const storage=SillyTavern.getContext().accountStorage,original=storage.setItem,known=JSON.stringify(Mvu.getMvuData({type:'message',message_id:0}).stat_data.known);
 storage.setItem=function(k,v){if(k==='f7d.album.v1')throw Error('受控存储失败');return original.call(this,k,v)};
 try{const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;await f.replaceVariables(Mvu.getMvuData({type:'message',message_id:0}),{type:'message',message_id:0});return f7dTacticalTerminal.getSnapshot().snapshot.album.warning.includes('暂未保存')&&known===JSON.stringify(Mvu.getMvuData({type:'message',message_id:0}).stat_data.known);}
 finally{storage.setItem=original;}
}));
await commit({location:'验收恢复'});

check('订阅立即回调、异常隔离与重复取消',await run(()=>{
 let count=0;const bad=f7dTacticalTerminal.subscribe(()=>{throw Error('受控订阅错误')});const off=f7dTacticalTerminal.subscribe(()=>count++);off();off();bad();return count===1;
}));
check('真实解析后编辑消息使迟到事务失效',await run(async()=>{
 const d=Mvu.getMvuData({type:'message',message_id:0});const parsed=await Mvu.parseMessage("<UpdateVariable>_.set('location', '过期解析结果');</UpdateVariable>",d);
 const x=SillyTavern.getContext();x.chat[0].mes+='编辑哨兵';await x.eventSource.emit(x.eventTypes.MESSAGE_EDITED,0);
 const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow;await f.replaceVariables(parsed,{type:'message',message_id:0});
 return f7dTacticalTerminal.getSnapshot().snapshot===null&&Mvu.getMvuData({type:'message',message_id:0}).stat_data.location!=='过期解析结果';
}));
await commit({location:'提交恢复'});
check('受控长文本十二次真实解析保持提交顺序',await run(async()=>{
 const f=[...document.querySelectorAll('iframe')].find(x=>x.contentWindow.__f7dCommitHook).contentWindow,x=SillyTavern.getContext();
 for(let i=0;i<12;i++){
  await x.eventSource.emit(x.eventTypes.GENERATION_STARTED,'normal',{},false);
  const old=Mvu.getMvuData({type:'message',message_id:0});const parsed=await Mvu.parseMessage('现场记录。'.repeat(1200)+"<UpdateVariable>_.set('location', '长文"+i+"');</UpdateVariable>",old);
  if(f7dTacticalTerminal.getSnapshot().snapshot!==null)return false;
  await f.replaceVariables(parsed,{type:'message',message_id:0});if(f7dTacticalTerminal.getSnapshot().snapshot!==null)return false;
  await x.eventSource.emit(x.eventTypes.GENERATION_ENDED);if(f7dTacticalTerminal.getSnapshot().snapshot?.header.location!=='长文'+i)return false;
 }
 return true;
}));

await p.route('**/api/settings/save',route=>route.fulfill({status:503,contentType:'text/plain',body:'受控账户保存失败'}));
await run(async()=>{const st=await import('/script.js');await st.saveSettings();});
check('账户异步持久化失败有酒馆原生错误提示',await run(()=>/Settings could not be saved|无法保存设置|Settings.*saved/.test(document.querySelector('#toast-container')?.textContent||'')));
await p.unroute('**/api/settings/save');await run(async()=>{const st=await import('/script.js');await st.saveSettings();});
const rawSource=await run(()=>{const s=Mvu.getMvuData({type:'message',message_id:0}).stat_data;return Object.fromEntries(['schema','loop','day','clock_minutes','location','tasks','known','terminal','meta','cg_system'].map(k=>[k,s[k]??null]));});const snap=await run(()=>f7dTacticalTerminal.getSnapshot());await fs.writeFile(out+'/真实提交快照-脱敏.json',JSON.stringify({说明:'真实酒馆、原生酒馆助手消息变量；使用明确标注的验收输入，不是模型剧情自然产生的数据',来源字段:rawSource,...snap, snapshot:{...snap.snapshot,scope:{...snap.snapshot.scope,chatId:'已脱敏聊天',branchId:'已脱敏分支'},revision:'已脱敏修订'}},null,2));
await p.waitForTimeout(1800);await p.reload();await p.waitForTimeout(3500);check('浏览器重新加载后账户相册仍保留',await run(()=>JSON.parse(f7dTacticalTerminal.exportAlbum()).items.includes('antoneva_first_meet')));
await fs.writeFile(out+'/实机验收记录.json',JSON.stringify({酒馆提交:'8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8',变量框架提交:'183d8ade3b9a3369e824a55cb13b4ddf91aada50',助手版本:'4.11.2',验收性质:'真实酒馆+原生助手脚本窗口+固定变量框架；控制输入复现事件，不是模型长篇剧情验收',世界背面:withWB?'f9babfa0ee0bd3003d3529fd171b83103cfee4c1':'未安装',场景:tests,浏览器页面异常:pageErrors,HTTP异常:httpErrors,接口版本:1,消费端:'未安装小手机；无界面测试'},null,2));
}finally{await b.close();}
