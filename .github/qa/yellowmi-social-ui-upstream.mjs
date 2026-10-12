import http from 'node:http';

const port = Number(process.env.UPSTREAM_PORT || 9051);
const actorId = 'card:default_Seraphina.png';

const rednote = [
  ['夜里修完最后一台旧收音机','回家的路上顺手买了热牛奶。今天的风有点凉，店门口那只猫还是不肯让我摸。','平静'],
  ['周末把桌面重新收拾了一遍','把常用工具按顺手程度重新排好，腾出了一个小角落放花。看起来终于不像临时工位了。','满足'],
  ['最近很喜欢这家小店','不是因为装修有多漂亮，是老板记得我不加糖。下午人少的时候坐窗边很安静。','放松'],
  ['今天的随手记录','雨停之后街道的反光很好看。绕了远路回去，结果意外发现一家还没打烊的面包店。','轻松'],
  ['把一直拖着的小东西做完了','原本以为十分钟能解决，最后还是拆了三遍。至少现在终于不会再半夜响了。','解脱'],
  ['下班后的二十分钟','没做什么特别的事，只是关掉消息坐了一会儿。偶尔什么都不安排也挺好。','安静'],
].map(([title,text,mood])=>({actorId,title,text,mood}));

const weibo = [
  ['今天终于把那台一直报错的设备修好了。结果故障原因只是一个接触不良的旧插头。折腾半天，人类文明有时候就卡在两毫米的金属片上。','工作日常'],
  ['下雨之后的空气比平时舒服很多。路边那家面包店居然还开着，买到了最后一份刚出炉的可颂。','雨天随手记'],
  ['整理抽屉翻到几年前留下的零件，居然还能用。于是本来五分钟的收拾变成了一个小时的临时改造。','旧物也有用'],
  ['今天不想讲大道理。按时吃饭，早点回家，剩下的明天再处理。','下班'],
  ['有人问我为什么工具一定要按固定位置放。因为凌晨两点找不到螺丝刀的时候，秩序就是一种美德。','工程师的执念'],
].map(([text,title],i)=>({actorId,authorKind:'character',title,text,category:'日常',claimStatus:i%2?'mixed':'fact',heat:i+1,replies:[]}));

function completion(content) {
  return JSON.stringify({id:'chatcmpl-social-ui',object:'chat.completion',created:Math.floor(Date.now()/1000),model:'yellowmi-social-ui',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
}

const server=http.createServer((req,res)=>{
  if(req.method==='GET'&&req.url?.includes('/models')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'yellowmi-social-ui',object:'model'}]}));return;}
  if(req.method!=='POST'||!req.url?.includes('/chat/completions')){res.writeHead(404,{'content-type':'application/json'});res.end('{}');return;}
  let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
    const isWeibo=/生成一屏微博|微博信息流|为当前酒馆世界生成手机里的微博/.test(raw);
    const posts=isWeibo?weibo:rednote;
    res.writeHead(200,{'content-type':'application/json'});res.end(completion(JSON.stringify({posts})));
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`social UI upstream listening on ${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
