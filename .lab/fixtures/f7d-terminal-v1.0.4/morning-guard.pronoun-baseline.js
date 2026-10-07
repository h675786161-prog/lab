(() => {
  const helper=window.TavernHelper||{};
  const eventOn=helper.eventOn||window.eventOn;
  const eventRemoveListener=helper.eventRemoveListener||window.eventRemoveListener;
  const waitGlobalInitialized=helper.waitGlobalInitialized||window.waitGlobalInitialized;
  const host=window.parent||window;
  host.__F7D_MVU_GUARD__={ready:false,calls:0};
  if(!eventOn){host.__F7D_MVU_GUARD__.error='eventOn unavailable';return}
  let active=true;
  const get=(s,path)=>path.split('.').reduce((o,k)=>o?.[k],s);
  const val=x=>Array.isArray(x)&&x.length===2&&typeof x[1]==='string'&&!Array.isArray(x[0])?x[0]:x;
  const parse=x=>{try{return JSON.parse(x)}catch{return x}};
  const latestPlayer=()=>{
    try{const chat=window.parent?.SillyTavern?.getContext?.()?.chat||[];
      return String([...chat].reverse().find(m=>m.is_user)?.mes||'');}catch{return ''}
  };
  const narrative=text=>String(text||'').replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'').replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g,'');
  const hasMorningVoice=text=>{
    const opening=narrative(text).slice(0,1000);
    const dream=/(?:梦境|梦中|梦里|睡梦|半梦半醒|意识(?:的)?深处|尚未醒|醒来之前|醒前|沉睡|小神)/;
    const voice=/(?:声音|低语|轻语|呢喃|耳语|轻叹|自语|回响)/;
    const excluded=/(?:回忆|回想|想起|记得|昨天|昨日|如果|假如|要是)[^。！？\n]{0,80}(?:梦|小神|低语|声音)|(?:没有|并未|未曾|尚未|不再)[^。！？\n]{0,24}(?:声音|低语|轻语|呢喃|耳语)/;
    return opening.split(/[。！？\n]+/).some(p=>{
      if(excluded.test(p)||!voice.test(p))return false;
      if(dream.test(p))return true;
      const start=opening.indexOf(p),sound=start+(p.match(voice)?.index||0),wake=/(?:醒来|苏醒|睁开)/.exec(opening);
      if(wake){
        if(wake.index<=sound||/(?:没有|并未|尚未|还没|未曾|不会|如果|假如|要是|准备|将要)[^，,。！？\n]{0,20}$/.test(opening.slice(Math.max(0,wake.index-30),wake.index)))return false;
        const context=opening.slice(Math.max(0,start-160),wake.index);
        if(/(?:黑暗|虚空|虚无|意识|混沌(?:与|和)清醒)/.test(context))return true;
      }
      return /(?:黑暗|虚空|虚无|意识)/.test(opening.slice(Math.max(0,start-160),start+p.length))&&/(?:醒来|苏醒|睁开|天花板|晨光)/.test(opening.slice(start+p.length));
    });
  };
  const hasSaihamDeparture=text=>{
    const visible=narrative(text),sentences=visible.split(/[。！？\n]+/);
    const adjacentPairs=new Set(visible.split(/\n/).flatMap(line=>{const rows=line.split(/[。！？]+/);return rows.slice(1).map((p,i)=>JSON.stringify([rows[i],p]));}));
    // 晨间完成以希罗已实际接走赛哈姆为准，不要求登车或越过区域边界的描写。
    const takenAway=/(?:赛哈姆(?:已经|已|最终)?(?:被|由)希罗(?:已经|已|亲自)?(?:带走|接走)|希罗(?:已经|已|亲自)?(?:将|把)(?:(?:昏迷|受伤|失去意识)的)?赛哈姆(?!的)[^。！？\n]{0,30}(?:带走|接走)|希罗(?:已经|已|亲自)?(?:带走|接走)(?:了)?(?:(?:昏迷|受伤|失去意识)的)?赛哈姆)(?!的)/;
    const pendingHandoff=/(?:没有|并未|尚未|未曾|还没|没|不会)(?:被希罗)?(?:真正|实际|已经|再)?(?:带走|接走)|(?:允许|同意|请求|要求|准备|计划|打算|即将|将要|将会|想要|需要|希望|会|可能|应该|也许|如果|假如|要是|昨天|昨日|据说|听说|回忆|回想|声称|表示)[^。！？\n]{0,100}(?:带走|接走)/;
    const followingHiro=/(?:随行人员|黑衣人员|人员|部下|随从)[^。！？\n]{0,40}(?:将|把)(?:(?:昏迷|受伤|失去意识)的)?赛哈姆(?!的)[^。！？\n]{0,50}(?:搬上|抬上|推上|抱上|送上)[^。！？\n]{0,80}(?:随(?:着)?希罗|跟(?:着)?希罗)[^。！？\n]{0,50}(?:撤离|离开|离去|离场)/;
    const orderedHandoff=/希罗[^。！？\n]{0,40}(?:示意|指示)(?:随行人员|黑衣人员|人员|部下|随从)[^。！？\n]{0,30}(?:将|把)赛哈姆(?!的)[^。！？\n]{0,30}(?:带走|接走)/;
    const pendingFollowing=/(?:计划|打算|准备|即将|将要|将会|可能|如果|假如|要是|回忆|回想|昨天|昨日|据说|听说|允许|同意)[^。！？\n]{0,180}(?:搬上|抬上|撤离|离开|带走|接走)|(?:没有|并未|尚未|还没|不会)[^。！？\n]{0,30}(?:搬上|抬上|撤离|离开|带走|接走)/;
    // 紧邻两句组成一次接走事实：希罗的人员抬起本人，随后同一行人实际离开。
    // 不跨空行、对白或其他事件寻找代词，也不要求离开某个地域。
    const pickup=/希罗[^。！？\n]{0,120}(?:随行人员|黑衣人员|人员|部下|随从)[^。！？\n]{0,40}(?:(?:抬起|抱起|扶起|抬上|搬上)(?:了)?(?:(?:昏迷|受伤|失去意识)的)?赛哈姆(?!的)|(?:将|把)(?:(?:昏迷|受伤|失去意识)的)?赛哈姆(?!的)[^。！？\n]{0,30}(?:抬起|抱起|扶起|抬上|搬上))/;
    const unrealPickup=/(?:计划|打算|准备|即将|将要|将会|可能|如果|假如|要是|回忆|回想|昨天|昨日|据说|听说|允许|同意|请求|要求|希望)[^。！？\n]{0,180}(?:抬起|抱起|扶起|抬上|搬上|离开|离去|撤离)|(?:没有|并未|尚未|还没|不会|不曾|拒绝)[^，,。！？\n]{0,30}(?:抬起|抱起|扶起|抬上|搬上|离开|离去|撤离)|(?:会|将)(?:抬起|抱起|扶起|抬上|搬上)/;
    const groupExit=/^\s*(?:随后|接着|紧接着)?(?:一行人|他们|随行人员|这支队伍|护送队伍)([^。！？\n]{0,80}?)(?:离开|离去|撤离|离场)/;
    const handoffBroken=/另(?:一|外一)(?:人|队|支|群)|其他人|空担架|空载|(?:赛哈姆|她|担架)[^，,。！？\n]{0,30}(?:仍在|留在|留于|放在|放回|放下)|(?:赛哈姆|她)(?:仍|依旧|还)?被留下|(?:把|将)(?:她|赛哈姆)[^，,。！？\n]{0,30}(?:放下|留下|放回|留在)/;
    const adjacentHandoff=(p,previous)=>{
      if(!previous||!pickup.test(previous)||unrealPickup.test(previous)||unrealPickup.test(p)||handoffBroken.test(previous+p))return false;
      const exit=groupExit.exec(p);
      return !!exit&&!/(?:希罗|安(?:托涅瓦)?|晏华|赛哈姆|你|我|独自|单独|看着|注视|目送|等待|准备|计划|打算|可能|应该|也许|据说|听说|回忆|回想|没有|并未|尚未|还没|不会|不曾|要|会)/.test(exit[1]);
    };
    // 另一种同一事件的叙述顺序：人员已抬走本人，希罗在紧接下一句随该队伍离去。
    // 接走对象、执行者、实际离去、希罗同行分别校验，不依赖人员数量或担架名称。
    const carriedPerson=/(?:随行人员|黑衣人员|人员|部下|随从|护卫)[^。！？\n]{0,45}(?:将|把)(?:(?:昏迷(?:不醒|中)?|受伤|失去意识)的)?赛哈姆(?!的)[^，,。！？\n]{0,35}(?:抬起|抱起|扶起|抬上|搬上)/;
    const carrierExit=/(?:撤离|离开|离去|离场)/;
    const hiroJoins=/希罗[^。！？\n]{0,60}(?:(?:随着|跟着|随|跟)(?:医疗队伍|护送队伍|这支队伍|这队人员|一行人|他们)|(?:带着|带领)(?:队伍|医疗队伍|护送队伍|随行人员))[^。！？\n]{0,30}(?:离去|离开|撤离|离场)/;
    const unrealCarrier=/(?:计划|打算|准备|即将|将要|将会|可能|应该|也许|如果|假如|要是|回忆|回想|昨天|昨日|据说|听说|允许|同意|请求|要求|希望)[^。！？\n]{0,180}(?:抬起|抱起|扶起|抬上|搬上|转移出|带离|带走|接走|抬走|推走|运走|送走|离开|离去|撤离|随)|(?:没有|并未|尚未|还没|不会|不曾|拒绝)[^，,。！？\n]{0,30}(?:抬起|抱起|扶起|抬上|搬上|转移出|带离|带走|接走|抬走|推走|运走|送走|离开|离去|撤离|随)|(?:会|将)(?:抬起|抱起|扶起|抬上|搬上|转移出|带离|带走|接走|抬走|推走|运走|送走|随)/;
    const passiveExit=/赛哈姆(?!的)[^，,。！？\n]{0,20}被[^，,。！？\n]{0,45}(?:转移出|带离|带走|接走|抬走|推走|运走|送走|护送(?:离开|离去))/;
    const directHiro=/希罗([^。！？\n]{0,120})(?:(?:将|把)(?:[^，,。！？\n]{1,40}的)?赛哈姆(?!的|身旁|身边|旁边|附近)[^。！？\n]{0,35}(?:带走|接走|带离|抬走|送走)|(?:带着|护送着?)(?:[^，,。！？\n]{1,40}的)?赛哈姆(?!的|身旁|身边|旁边|附近)[^。！？\n]{0,60}(?:离去|离开|撤离))/;
    const hiroFact=p=>{
      if(unrealCarrier.test(p)||handoffBroken.test(p))return false;
      const direct=directHiro.exec(p);
      return !!direct&&!/(?:看着|望着|注视|目送|其他人|另一人|会|要|将)/.test(direct[1])&&!/(?:你|我|安(?:托涅瓦)?|晏华)(?:随后|随即|立即|立刻|迅速|独自)?\s*$/.test(direct[1]);
    };
    const personnelHandoff=(previous,p)=>{
      if(!previous||unrealCarrier.test(previous)||unrealCarrier.test(p)||handoffBroken.test(previous+p)||!hiroJoins.test(p))return false;
      if(passiveExit.test(previous)&&/(?:医疗人员|压制人员|随行人员|黑衣人员|人员|部下|随从|护卫)/.test(previous))return true;
      const pickup=carriedPerson.exec(previous);if(!pickup)return false;
      const tail=previous.slice(pickup.index+pickup[0].length),exit=carrierExit.exec(tail);
      return !!exit&&!/(?:希罗|安(?:托涅瓦)?|晏华|你|我|独自|单独|看着|注视|目送|等待|另(?:一|外)|他们|她|他|要|会)/.test(tail.slice(0,exit.index));
    };
    const sameSentenceHandoff=p=>{
      if(unrealCarrier.test(p)||handoffBroken.test(p))return false;
      const pickup=carriedPerson.exec(p);if(!pickup)return false;
      const prefix=p.slice(0,pickup.index);
      if(!/希罗[^。！？\n]{0,80}(?:挥(?:了)?(?:挥)?手|示意|指示|招手|下令|指挥)/.test(prefix))return false;
      const tail=p.slice(pickup.index+pickup[0].length),exit=carrierExit.exec(tail);
      return !!exit&&!/(?:希罗|安(?:托涅瓦)?|晏华|你|我|独自|单独|看着|注视|目送|等待|另(?:一|外)|他们|她|他|要|会)/.test(tail.slice(0,exit.index));
    };
    const complete=/(?:赛哈姆[^。！？\n]{0,100}(?:被(?:希罗)?(?:带|抬|推|护送)离(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道))|已经离开(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道))|随(?:着)?希罗[^。！？\n]{0,80}(?:离开|走出)(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道)))|(?:希罗|随从|护送人员|工作人员|几人|一行人|他)[^。！？\n]{0,100}(?:带着|抬着|推着|护送着)[^。！？\n]{0,120}赛哈姆[^。！？\n]{0,160}(?:离开|走出)(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道)))|(?:希罗|随从|随行人员|护送人员|工作人员|几人|一行人|他)[^。！？\n]{0,100}(?:将|把)赛哈姆[^。！？\n]{0,100}(?:带|抬|推|护送)(?:离|出)(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道))/;
    const escortedVehicle=/担架[^！？\n]{0,240}(?:一行人|希罗与随行队伍|护送队伍)[^！？\n]{0,240}(?:驶离|驶出)(?:了)?中央庭(?!的?(?:主廊|走廊|寝室|房间|会议室|办公室|庭院|大厅|病房|通道))/;
    // 同一运输事件须同时证明赛哈姆是乘员，以及该载具实际离开完整区域。
    const transportName='(?:运输车辆|运输车队|运输车|救护车|车辆|车队|汽车|押运飞行器|运输飞行器|飞行器|运输机|直升机|载具)';
    const passenger='(?:希罗(?:与|和|及))?(?:(?:昏迷(?:中)?|失去意识|受伤|被固定|活骸化|已经昏迷|陷入昏迷)的)?赛哈姆(?:与希罗|和希罗|及希罗)?';
    const carriedFirst=new RegExp('('+transportName+')[^。！？\\n]{0,60}(?:载着|搭载着?|带着)'+passenger+'(?!的)');
    const passengerFirst=new RegExp('(?:载着|搭载着?|带着)'+passenger+'的('+transportName+')');
    const boarded=new RegExp('赛哈姆(?!的(?!身影))([^。！？\\n]{0,100}?)(?:登上|踏上|上了|抬上|送上|抱上|扶上|装入|送入)[^。！？\\n]{0,50}?('+transportName+')');
    const escortedBoarded=new RegExp('(?:押运着|护送着|抬着|推着)赛哈姆的(?:特遣人员|随行人员|护送人员|工作人员|队伍)[^。！？\\n]{0,60}(?:登上|踏上|上了)[^。！？\\n]{0,50}?('+transportName+')');
    const transportNames=new RegExp(transportName,'g');
    const escortedPeople=/(?:运送|护送|押运)(?:着)?(?:(?:昏迷|受伤|失去意识)的)?赛哈姆的(?:队伍|一行人|特遣人员|随行人员|护送人员|工作人员)/;
    const directEscort=/(?:希罗|随行人员|护送人员|工作人员|随从|一行人)[^。！？\n]{0,100}(?:带着|抬着|推着|护送着?|运送着?|押运着?)(?:(?:昏迷|受伤|失去意识)的)?赛哈姆(?!的)/;
    const action='(?:载着|搭载着?|带着|带走|带离|护送|运送|押运|登上|踏上|上了|抬上|送上|抱上|扶上|装入|送入|驶离|驶出|飞离|飞出|离开|起飞|升空|升入)';
    const unrealTransport=new RegExp('(?:并未|没有|尚未|未曾|还没|不会|不曾|不)(?:真正|实际|已经|再)?'+action+'|(?:将(?!(?:(?:昏迷|受伤|失去意识)的)?赛哈姆)|会|预计|可能|应该|也许|昨天|昨日|此前|据说|听说)[^。！？\\n]{0,180}'+action+'|(?:计划|打算|准备|即将|将要|将会|声称|表示|如果|假如|要是|想象|回忆|回想)[^。！？\\n]{0,180}'+action);
    const changedPassenger=new RegExp('下车|下机|离开(?:了)?'+transportName+'|(?:留(?:在|于)|放(?:在|回)|停在)[^。！？\\n]{0,12}(?:中央庭|原地|车外|机外|门口|大厅|主廊|走廊|病房|停机坪|登机口)|另(?:一|外一)(?:辆|架|支)|空车|空载');
    const changedBoardingSubject=/希罗|随行人员|工作人员|护送人员|随从|其他人|另一人|他们|他(?:却|则|独自)|她(?:却|则|独自)|指挥使|安(?:托涅瓦)?|晏华|你|我|旁边|身旁|车旁|站在|站着|留在|停在|看着|望着|等待/;
    const exitEvent=/(?:驶离|驶出|飞离|飞出|离开)(?:了)?(?:整个|全部)?中央庭(?:(?:的)?(?:整个|全部)?(?:管辖区域|区域|辖区))?(?=\s*(?:$|[，,。！？；;：:]))/;
    const transportEvent=p=>{
      if(unrealTransport.test(p)||changedPassenger.test(p))return null;
      for(const re of [carriedFirst,passengerFirst,escortedBoarded]){
        const m=re.exec(p);if(m)return {vehicle:m[1],end:m.index+m[0].length};
      }
      const m=boarded.exec(p);
      if(m&&!changedBoardingSubject.test(m[1]))return {vehicle:m[2],end:m.index+m[0].length};
      const people=escortedPeople.exec(p)||directEscort.exec(p);
      return people?{vehicle:null,end:people.index+people[0].length}:null;
    };
    const normalizeVehicle=v=>v?.replace(/运输车辆|运输车队/,'运输车').replace(/押运飞行器|运输飞行器/,'飞行器');
    const actualTransportExit=(p,previous)=>{
      const exit=exitEvent.exec(p);if(!exit||unrealTransport.test(p)||changedPassenger.test(p))return false;
      const current=transportEvent(p),event=current||transportEvent(previous||'');if(!event)return false;
      if(current&&exit.index<event.end)return false;
      const prefix=p.slice(current?event.end:0,exit.index);
      if(!current&&!/^(?:直到|随后|接着|待|车门|引擎|这辆车|该车|该载具|该飞行器|运输车队|运输车|救护车|车辆|车队|载具|飞行器|运输机|直升机)/.test(p.trim()))return false;
      if(changedBoardingSubject.test(prefix))return false;
      const vehicle=[...prefix.matchAll(transportNames)].at(-1)?.[0];
      return !vehicle||normalizeVehicle(vehicle)===normalizeVehicle(event.vehicle);
    };
    const excluded=/(?:(?:没有|并未|尚未|还没|不会|未曾)(?:被(?:希罗|随从|护送人员)?)?(?:带着|抬着|推着|护送着|离开|带离|带出|走出|转移|带走|驶离|驶出)|(?:计划|打算|准备|即将|将要|将会|可能|声称|表示|如果|假如|要是|想象|回忆|回想)[^。！？\n]{0,180}(?:离开|带离|走出|转移|带走|驶离|驶出))/;
    const stay=/赛哈姆[^。！？\n]{0,100}(?:(?:仍|依旧|还)(?:留|在)[^。！？\n]{0,60}中央庭|(?:没有|并未|尚未|还没)(?:被)?(?:带走|带离|转移|离开))/;
    let lastComplete=-1,lastStay=-1;
    for(let i=0;i<sentences.length;i++){
      const p=sentences[i];
      if(stay.test(p))lastStay=i;
      const context=sentences.slice(Math.max(0,i-1),i+1).join('。');
      const transportExit=actualTransportExit(p,sentences[i-1]);
      const actualHandoff=hiroFact(p)||sameSentenceHandoff(p)||adjacentPairs.has(JSON.stringify([sentences[i-1],p]))&&(adjacentHandoff(p,sentences[i-1])||personnelHandoff(sentences[i-1],p))||!pendingHandoff.test(p)&&!pendingFollowing.test(p)&&(takenAway.test(p)||followingHiro.test(p)||orderedHandoff.test(p));
      if(actualHandoff||(!excluded.test(p)&&(complete.test(p)||transportExit))||(!excluded.test(context)&&escortedVehicle.test(context)))lastComplete=i;
    }
    const observed=String(text||'').replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'');
    return /希罗/.test(observed)&&/活骸/.test(observed)&&lastComplete>=0&&lastComplete>lastStay;
  };
  const gates={6:['day6_monologue','day6_saiham'],5:['day5_monologue','day5_split'],4:['day4_monologue','day4_speech'],3:['day3_monologue','day3_ann_departure'],2:['day2_monologue']};
  const morningReady=prior=>prior.day===7?prior.tasks?.DAY7_OPENING?.status==='completed':(gates[prior.day]||[]).every(key=>prior.morning_flags?.[key]===true);
  const endpoints=new Set(['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途']);
  function protect(variables,commands,message){
    host.__F7D_MVU_GUARD__.calls++;
    const prior=variables.stat_data||{};if(prior.schema!=='f7d_textloop_0.4')return;
    const user=latestPlayer();
    const story=String(message||'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'');
    const enteringDay6=prior.day===6||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'&&parse(c.args?.at(-1))===6);
    const midnight=commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440);
    for(let i=commands.length-1;i>=0;i--){
      const cmd=commands[i],path=String(cmd.args?.[0]||'').trim().replace(/^['"]|['"]$/g,''),old=val(get(prior,path)),next=parse(cmd.args?.at(-1));
      host.__F7D_MVU_GUARD__.lastPath=path;
      let invalid=!path||path.includes('$')||path==='schema'||path==='node_used'||path.includes('.patrol')||path==='known'&&cmd.type!=='set';
      if(['regions','cores','tasks','ann','route_flags','hiro','battle_flags','intel_flags','npc_intel','relationships','cg_system','meta','player_profile','morning_flags'].includes(path))invalid=true;
      if(path==='day')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next!==old-1||old<=0||!(/(睡|休息到明天|结束今天|跳过今天)/.test(user)||prior.clock_minutes===1440||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440));
      const shortExchange=/(?:听.{0,12}(?:说明|讲|解释)|询问|问清|了解|交谈|聊|请.{0,10}(?:介绍|讲清|说明))/.test(user)&&!/(?:前往|赶往|出发|巡查|战斗|救援|清理|深入|调查现场|进入(?:[一-龥]{2,8}区)|动手处理)/.test(user);
      if(path==='clock_minutes'&&next>old)invalid||=shortExchange;
      if(path==='clock_minutes'&&next>old)invalid||=!morningReady(prior);
      if(path==='clock_minutes')invalid||=cmd.type!=='set'||!Number.isInteger(next)||next<480||next>1440||(next!==480&&(next<old||(next-old)%80!==0))||(next===480&&old!==480&&!/(睡|休息到明天|结束今天|跳过今天)/.test(user)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'));
      if((path==='regions.east.liberated'||path==='regions.central.liberated')&&next===true){
        const zone=path.split('.')[1],name=zone==='east'?'东方古街':'中央城区';
        invalid||=old!==false||!String(prior.location||'').startsWith(name)||shortExchange||!/(?:区域|街区|古街|城区).{0,25}(?:解放|危机解除)|(?:解放|危机解除).{0,25}(?:区域|街区|古街|城区)/.test(story);
      }
      if(path==='battle_flags.sybilla_condition_obtained'&&next===true)invalid||=old!==false||!/(追查|调查|占卜|爱缪莎)/.test(user)||!/爱缪莎/.test(story)||!/(塔罗|占卜|牌阵)/.test(story);
      if(path==='battle_flags.sybilla_rescued'&&next===true)invalid||=get(prior,'battle_flags.sybilla_condition_obtained')!==true;
      const morningMarkers={day5_monologue:/低语|梦中.*声音|小神/,day5_split:/希罗[\s\S]*离开|离开[\s\S]*希罗/,day4_monologue:/低语|梦中.*声音|小神/,day4_speech:/希罗[\s\S]*演讲|演讲[\s\S]*希罗/,day3_monologue:/低语|梦中.*声音|小神/,day3_ann_departure:/安[\s\S]*(离开|不见|离去)/,day2_monologue:/低语|梦中.*声音|小神/};
      if(path.startsWith('morning_flags.')&&next===true){
        const key=path.slice('morning_flags.'.length),expected={day5_:5,day4_:4,day3_:3,day2_:2};
        const day=Number(key.match(/^day([2345])_/)?.[1]);
        if(day)invalid||=prior.day!==day||old!==false||!morningMarkers[key]?.test(story);
        if(key==='day5_split')invalid||=!/安托涅瓦/.test(story);
        if(key==='day5_split')invalid||=prior.morning_flags?.day5_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day5_monologue'));
        if(key==='day4_speech')invalid||=prior.morning_flags?.day4_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day4_monologue'));
        if(key==='day3_ann_departure')invalid||=prior.morning_flags?.day3_monologue!==true&&!commands.some(c=>String(c.args?.[0]).includes('day3_monologue'));
      }
      if(path==='tasks.DAY7_OPENING.status'&&next==='completed')invalid||=!/希罗/.test(story)||!/交付|开始行动|指挥使/.test(story);
      if(path==='morning_flags.day6_monologue'&&next===true)invalid||=cmd.type!=='set'||old!==false||!enteringDay6||!hasMorningVoice(story);
      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=cmd.type!=='set'||old!==false||!enteringDay6||!hasSaihamDeparture(story);
      if(path==='morning_flags.day6_saiham'&&old===true&&next!==true)invalid=true;
      if(path==='morning_flags.day6_seth'&&next===true)invalid||=!enteringDay6||!/赛斯/.test(story);
      if(path.startsWith('cores.')){
        const zone=path.split('.')[1];
        invalid||=cmd.type!=='set'||!['unknown','available','purified','lost'].includes(next)||old==='lost'&&next!==old||old==='purified'&&next!==old;
        if(next==='purified'&&old!==next)invalid||=!/(净化|净除黑核)/.test(user)||get(prior,'regions.'+zone+'.liberated')!==true;
      }
      if(path==='meta.endings'){
        invalid||=cmd.type!=='set'||!Array.isArray(next)||next.some(x=>!endpoints.has(x))||Array.isArray(old)&&old.length>0&&JSON.stringify(old)!==JSON.stringify(next);
      }
      if(path==='ann.eligible'&&next===true)invalid||=prior.day!==4||get(prior,'ann.affection')<100||!['ANN_CORE_30','ANN_CORE_60','ANN_CORE_80'].every(x=>get(prior,'ann.core_events')?.includes(x));
      if(path==='route'&&next==='ann')invalid||=get(prior,'ann.eligible')!==true||!/(追安|找安|跟安|追回)/.test(user);
      if(path==='cg_system.shown.ann_first_meet'&&next===false)invalid=true;
      if(invalid)commands.splice(i,1);
    }
    // 先过滤所有命令，再看实际留下的独白命令；不能依赖倒序遍历时尚未删除的命令。
    const acceptedMonologue=get(prior,'morning_flags.day6_monologue')===true||commands.some(c=>c.type==='set'&&String(c.args?.[0]||'').trim().replace(/^['"]|['"]$/g,'')==='morning_flags.day6_monologue'&&parse(c.args?.at(-1))===true);
    if(!acceptedMonologue)for(let i=commands.length-1;i>=0;i--){
      const c=commands[i],path=String(c.args?.[0]||'').trim().replace(/^['"]|['"]$/g,'');
      if(path==='morning_flags.day6_saiham'&&parse(c.args?.at(-1))===true)commands.splice(i,1);
    }
    const completed=zone=>prior.regions?.[zone]?.liberated===true||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='regions.'+zone+'.liberated'&&parse(c.args?.at(-1))===true);
    for(let i=commands.length-1;i>=0;i--){
      const c=commands[i],path=String(c.args?.[0]||'').replace(/^['"]|['"]$/g,''),next=parse(c.args?.at(-1));
      if(path==='route_flags.first_second_region'&&next!==prior.route_flags?.first_second_region){
        if(!['east','central'].includes(next)||prior.route_flags?.first_second_region!==null||!completed(next)||completed(next==='east'?'central':'east'))commands.splice(i,1);
      }
      if(path==='route_flags.oldstreet_delayed'&&next===true&&!completed('central'))commands.splice(i,1);
    }
    if(midnight&&prior.day>0&&commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440)){
      if(!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='day'))commands.push({type:'set',args:['day',String(prior.day-1)],reason:'午夜强制睡觉'});
      commands.push({type:'set',args:['clock_minutes','480'],reason:'次日08:00'});
    }
  }
  const bind=()=>{const mvu=host.Mvu||window.Mvu;if(!active||!mvu||host.__F7D_MVU_GUARD__.ready)return;
    eventOn(mvu.events.COMMAND_PARSED,protect);host.__F7D_MVU_GUARD__.ready=true};
  bind();
  if(!host.__F7D_MVU_GUARD__.ready){eventOn('global_Mvu_initialized',bind);if(waitGlobalInitialized)waitGlobalInitialized('Mvu').then(bind).catch(e=>console.warn('[qidu/mvu]',e))}
  window.addEventListener('pagehide',()=>{active=false;try{const mvu=window.parent?.Mvu||window.Mvu;eventRemoveListener?.(mvu.events.COMMAND_PARSED,protect)}catch{}},{once:true});
})();
