export const VERSION='0.4.30-region-time-guard';

export function guardRegionAndShortTalk(input){
  const card=structuredClone(input),d=card.data,entries=d.character_book.entries;
  const entry=id=>entries.find(e=>e.id===id);
  const rule='【地区结算】去东方古街或中央城区、同意先帮助某区、遇见雯梓/赛斯，只表示地区路线选择和当前所在地；route_flags.first_second_region只在其中一整区主线实际收束、regions.*.liberated已确实提交后，才写对应区域。中央城区先解放时才写oldstreet_delayed=true，不能一进城就判古街延误。区域初见、听取灾情、局部阵眼/一处救援均不构成解放。';
  entry(10).content+='\n'+rule;
  entry(31).content+='\n'+rule;
  entry(32).content+='\n'+rule;
  entry(91).content+='\n【短交谈计时】在同一地区只听说明、问情况、了解居民和怪物位置、短距离走到说话人身边，均0分钟；移动到不同地区、实际巡查、战斗、现场救援再按真实行动估时。单次行动跨数轮叙述也只结算一次。';
  d.post_history_instructions=d.post_history_instructions.replace('3. 根据用户实际行动估算耗时为80分钟的整数倍，短对话/查看/醒前固定事件可为0。','3. 根据用户实际行动估算耗时为80分钟的整数倍；同一地区短对话、听说明、问清情况、就近走到谈话人面前均0分钟，即使模型写了长篇说明也不能扣80分钟。');
  d.post_history_instructions+='\n地区选择和地区解放分开：仅进入古街/城区不写first_second_region或oldstreet_delayed；等区域主线真实完成才结算。';
  const guard=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0425-mvu-guard');
  if(!guard)throw Error('MVU guard missing');
  const timeAnchor="      if(path==='clock_minutes'&&next>old)invalid||=!morningReady(prior);";
  if(!guard.content.includes(timeAnchor))throw Error('Clock gate missing');
  guard.content=guard.content.replace(timeAnchor,`      const shortExchange=/(?:听.{0,12}(?:说明|讲|解释)|询问|问清|了解|交谈|聊|请.{0,10}(?:介绍|讲清|说明))/.test(user)&&!/(?:前往|赶往|出发|巡查|战斗|救援|清理|深入|调查现场|进入(?:[一-龥]{2,8}区)|动手处理)/.test(user);
      if(path==='clock_minutes'&&next>old)invalid||=shortExchange;
`+timeAnchor);
  const regionAnchor="      if(path==='battle_flags.sybilla_condition_obtained'";
  if(!guard.content.includes(regionAnchor))throw Error('Region guard insertion point missing');
  guard.content=guard.content.replace(regionAnchor,`      if((path==='regions.east.liberated'||path==='regions.central.liberated')&&next===true){
        const zone=path.split('.')[1],name=zone==='east'?'东方古街':'中央城区';
        invalid||=old!==false||!String(prior.location||'').startsWith(name)||shortExchange||!/(?:区域|街区|古街|城区).{0,25}(?:解放|危机解除)|(?:解放|危机解除).{0,25}(?:区域|街区|古街|城区)/.test(story);
      }
`+regionAnchor);
  const closeAnchor='    if(midnight&&prior.day>0';
  if(!guard.content.includes(closeAnchor))throw Error('Post-command gate missing');
  guard.content=guard.content.replace(closeAnchor,`    const completed=zone=>prior.regions?.[zone]?.liberated===true||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='regions.'+zone+'.liberated'&&parse(c.args?.at(-1))===true);
    for(let i=commands.length-1;i>=0;i--){
      const c=commands[i],path=String(c.args?.[0]||'').replace(/^['"]|['"]$/g,''),next=parse(c.args?.at(-1));
      if(path==='route_flags.first_second_region'&&next!==prior.route_flags?.first_second_region){
        if(!['east','central'].includes(next)||prior.route_flags?.first_second_region!==null||!completed(next)||completed(next==='east'?'central':'east'))commands.splice(i,1);
      }
      if(path==='route_flags.oldstreet_delayed'&&next===true&&!completed('central'))commands.splice(i,1);
    }
`+closeAnchor);
  d.character_version=card.character_version=VERSION;
  d.extensions.qidu_frontend.revision='v0.4.30';
  for(const k of ['description','personality','scenario','first_mes','post_history_instructions','mes_example'])card[k]=d[k];
  return card;
}
