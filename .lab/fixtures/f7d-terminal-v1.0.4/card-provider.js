(() => {
  'use strict';
  let host;
  try { host = window.parent; void host.document; }
  catch { console.error('七都终端：需要酒馆助手同源脚本环境'); return; }
  const KEY = 'f7dTacticalTerminal';
  host[KEY]?.dispose?.();
  const clone = value => JSON.parse(JSON.stringify(value));
  const context = () => host.SillyTavern?.getContext?.();
  const listeners = new Set(), cleanups = [];
  let disposed = false, epoch = 0, revision = 0, generating = false, stopped = false;
  let state = { version: 1, status: 'empty', reason: '等待已提交存档', snapshot: null, error: null };
  const session = host.crypto.randomUUID();
  const ids = new WeakMap();
  const identity = m => { if (!ids.has(m)) ids.set(m, host.crypto.randomUUID()); return ids.get(m); };
  const signature = () => {
    const c = context();
    return JSON.stringify([c?.chatId ?? null, c?.characterId ?? null, c?.groupId ?? null,
      (c?.chat || []).map(m => [identity(m), m.swipe_id ?? 0, String(m.mes || '').replace(/<StatusPlaceHolderImpl\/>/g, '').trimEnd()])]);
  };
  const notify = () => { for (const fn of [...listeners]) { try { fn(clone(state)); } catch {} } };
  const clear = reason => { epoch++; state = { version: 1, status: 'empty', reason, snapshot: null, error: null }; notify(); };
  const fail = (code, message) => { state = { version: 1, status: 'error', reason: '', snapshot: null, error: { code, message } }; notify(); };
  const capture = () => ({ epoch, signature: signature(), chatId: context()?.chatId ?? null });
  const valid = t => !disposed && !stopped && t?.epoch === epoch && t.chatId === (context()?.chatId ?? null) && t.signature === signature();
  const string = v => typeof v === 'string' ? v : '';
  const entries = x => x && typeof x === 'object' && !Array.isArray(x) ? Object.entries(x).filter(([k]) => k !== '$meta') : [];
  const list = x => Array.isArray(x) ? x : [];
  const CG_IDS = ['ann_first_meet','antoneva_first_meet','ending_journey','ending_eternal_end','ending_sacrifice_male','ending_sacrifice_female','ending_final_male','ending_final_female','ending_box_male','ending_box_female'];
  const CG_NAMES = ['安·病房初见','安托涅瓦·初见','两个人的旅途','永恒的终焉','牺牲的意义·男指挥使','牺牲的意义·女指挥使','终结·男指挥使','终结·女指挥使','箱庭风景·男指挥使','箱庭风景·女指挥使'];
  const assets = window.__f7dCardAssets || {};
  const albumKey = 'f7d.album.v1';
  const album = s => {
    const unlocks = new Set(list(s.meta?.cg).map(x=>typeof x==='string'?x.replace(/^cg_/,''):'').filter(x => CG_IDS.includes(x)));
    // 已显示的开场图也算解锁；只在已提交存档被接纳时执行。
    for (const id of CG_IDS) if (s.cg_system?.shown?.[id] === true) unlocks.add(id);
    let saved = {}, warning = null, readable = true;
    try { const raw = context()?.accountStorage?.getItem(albumKey);
      saved = raw ? JSON.parse(raw) : {version:1,items:[]};
      if (saved.version !== 1 || !Array.isArray(saved.items)) throw Error('相册版本或格式不兼容'); }
    catch { readable = false; warning = '相册存档读取失败或版本不兼容，旧存档未覆盖'; }
    const existing = Array.isArray(saved.items) ? saved.items.filter(x => CG_IDS.includes(x)) : [];
    const items = [...new Set([...existing, ...unlocks])];
    try {
      const storage = context()?.accountStorage;
      if (!storage) throw Error();
      if (readable) storage.setItem(albumKey, JSON.stringify({ version: 1, items }));
    } catch { warning = '相册暂未保存，请导出备份'; }
    return { enabled: true, warning, items: items.map(id => ({ id, title: CG_NAMES[CG_IDS.indexOf(id)], assetKey: id })) };
  };
  const project = (s, messageId) => {
    const known = new Set(list(s.known));
    const tasks = entries(s.tasks).filter(([,t]) => t?.known === true && ['active','completed','expired','failed'].includes(t.status)).map(([id,t]) => ({
      id, title: string(t.title) || string(t.objective), objective: string(t.objective),
      status: t.status, statusLabel: ({ active:'进行中',completed:'已完成',expired:'已过期',failed:'已失败' })[t.status],
      deadlineLabel: t.deadline_known === true ? string(t.deadline) : '',
    }));
    const contacts = entries(s.terminal?.contacts).filter(([id,c]) => known.has(id) && c?.known === true && c.channel_acquired === true).map(([id,c]) => {
      const saiham=['赛哈姆','塞哈姆'].includes(id)||['赛哈姆','塞哈姆'].includes(string(c.name));
      const available=c.available===true&&!(saiham&&s.morning_flags?.day6_saiham===true);
      return {id,name:string(c.name),channel:string(c.channel),available,status:available?'online':'offline',statusLabel:available?'在线':'离线'};
    });
    const city = list(s.terminal?.city).filter(x => x?.known === true && x.loop === s.loop).map(x => ({ id:string(x.id),title:string(x.title),body:string(x.body) }));
    const journal = list(s.terminal?.journal).filter(x => x?.known === true && x.loop === s.loop).map(x => ({ id:string(x.id),title:string(x.title),body:string(x.body) }));
    const m = context().chat[messageId];
    return { schema:'f7d-terminal-v1', scope:{ chatId:context().chatId, branchId: session+':'+identity(m)+':'+(m.swipe_id ?? 0)+':'+epoch, loop:s.loop },
      revision:session+':'+(++revision), header:{ dayLabel:Number.isInteger(s.day)?'第'+s.day+'天':'', timeLabel:Number.isInteger(s.clock_minutes)?String(Math.floor(s.clock_minutes/60)).padStart(2,'0')+':'+String(s.clock_minutes%60).padStart(2,'0'):'', location:string(s.location) },
      tasks,contacts,city,journal,album:album(s) };
  };
  let pending = null;
  const publish = (ticket, messageId, reader) => {
    if (!valid(ticket)) return false;
    const c = context();
    if (messageId !== c.chat.length - 1 || c.chat[messageId]?.is_system) return false;
    try {
      const data = reader({ type:'message',message_id:messageId });
      const s = data?.stat_data;
      if (!s) { clear('该分支没有已提交数据'); return false; }
      if (s.schema !== 'f7d_textloop_0.4') { fail('SCHEMA_INCOMPATIBLE','卡片变量版本不兼容'); return false; }
      if (!Number.isInteger(s.loop) || s.loop < 1) { fail('INVALID_LOOP','轮回字段无效'); return false; }
      if (generating) { pending = { ticket,messageId,reader }; return true; }
      const oldLoop = state.snapshot?.scope.loop;
      if (oldLoop !== undefined && oldLoop !== s.loop) { clear('进入新轮回'); ticket = capture(); }
      state = { version:1,status:'ready',reason:'',snapshot:project(s,messageId),error:null }; notify(); return true;
    } catch { fail('READ_FAILED','读取已提交存档失败'); return false; }
  };
  const requestIntent = async p => {
    const failure = (code,message) => ({ ok:false,draft:null,inserted:false,error:{code,message} });
    if (state.status !== 'ready' || generating || stopped) return failure('NOT_READY','请等待剧情变量提交完成');
    const snap = state.snapshot;
    if (p?.revision !== snap.revision) return failure('STALE_SNAPSHOT','页面已更新，请重新选择');
    let draft;
    if (p.type === 'contact') {
      const contact = snap.contacts.find(x => x.id === p.id);
      if (!contact?.available) return failure('CONTACT_UNAVAILABLE','当前无法联系这位角色');
      draft = '我打开战术终端，尝试通过'+contact.channel+'联系'+contact.name+'。';
    } else if (p.type === 'viewTask') {
      const task = snap.tasks.find(x => x.id === p.id);
      if (!task) return failure('TASK_UNKNOWN','当前没有这项已知任务');
      draft = '我打开战术终端，查看“'+task.title+'”的已知详情。';
    } else if (p.type === 'viewTerminal') draft = '我打开战术终端，查看当前已知信息。';
    else return failure('INVALID_INTENT','不支持这项操作');
    const input = host.document.querySelector('#send_textarea');
    if (!input) return { ok:false,draft,inserted:false,error:{code:'COMPOSER_MISSING',message:'输入框不可用，草稿已保留'} };
    if (String(input.value || '').length) return { ok:false,draft,inserted:false,error:{code:'COMPOSER_OCCUPIED',message:'输入框已有文字，请先自行合并草稿'} };
    const setter = Object.getOwnPropertyDescriptor(host.HTMLTextAreaElement.prototype,'value')?.set;
    if (setter) setter.call(input,draft); else input.value=draft;
    input.dispatchEvent(new host.Event('input',{bubbles:true})); input.focus();
    return { ok:true,draft,inserted:true,error:null };
  };
  const api = { version:1, getSnapshot: () => clone(state), getAsset(id) {
    if(!state.snapshot?.album.items.some(x=>x.assetKey===id))return null;
    const value=assets[id];return typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(value)?value:null;
  }, exportAlbum() {
    return context()?.accountStorage?.getItem(albumKey) || JSON.stringify({version:1,items:[]});
  }, subscribe(fn) {
    if (typeof fn !== 'function') throw TypeError('订阅者必须是函数');
    listeners.add(fn); try { fn(clone(state)); } catch {}
    return () => listeners.delete(fn);
  }, requestIntent, dispose() {
    if (disposed) return; clear('提供者已卸载'); disposed=true; pending=null;
    cleanups.splice(0).forEach(fn=>fn()); listeners.clear();
    if (host[KEY] === api) delete host[KEY];
    if (host.__f7dCommitBridge === writer) delete host.__f7dCommitBridge;
  } };
  const writer = { capture, valid, publish, invalidate:clear, fail };
  host[KEY]=api; host.__f7dCommitBridge=writer;
  const c = context();
  for (const name of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_SWIPE_DELETED','MESSAGE_EDITED','MESSAGE_DELETED','CHARACTER_FIRST_MESSAGE_SELECTED']) {
    const type = c?.eventTypes?.[name]; if (!type) continue;
    const fn = () => { pending=null;generating=false;stopped=false;clear('聊天或消息分支已改变，等待重新读取'); if(name !== 'MESSAGE_EDITED')host.dispatchEvent(new host.Event('f7d:reload-committed')); };
    c.eventSource.on(type,fn); c.eventSource.makeFirst?.(type,fn); cleanups.push(()=>c.eventSource.removeListener(type,fn));
  }
  const bind = (name,fn) => { const type=c?.eventTypes?.[name]; if(type){c.eventSource.on(type,fn);c.eventSource.makeFirst?.(type,fn);cleanups.push(()=>c.eventSource.removeListener(type,fn));} };
  bind('GENERATION_STARTED',(type,options,dryRun)=>{ if(dryRun||type==='quiet')return;generating=true;stopped=false;pending=null;clear('剧情生成中'); });
  bind('GENERATION_STOPPED',()=>{generating=false;stopped=true;pending=null;clear('生成已中止，等待下一次有效提交');});
  bind('GENERATION_ENDED',()=>{generating=false;if(stopped)return; const p=pending;pending=null;if(p)publish(p.ticket,p.messageId,p.reader);});
  // 消息追加会改变分支签名；立即清空，等待该楼层写入完成。
  bind('MESSAGE_SENT',()=>{ pending=null;clear('等待玩家消息变量提交'); });
  bind('MESSAGE_RECEIVED',()=>{ pending=null;clear('等待回复变量提交'); });
  const unload=()=>api.dispose();window.addEventListener('pagehide',unload);cleanups.push(()=>window.removeEventListener('pagehide',unload));
  host.dispatchEvent(new host.Event('f7d:provider-ready'));
})();

