import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.UPSTREAM_PORT || 9050);
const evidence = process.env.EVIDENCE || process.cwd();
const logPath = path.join(evidence, 'local-upstream-requests.jsonl');
let call = 0;
const actorId = 'card:default_Seraphina.png';
const fullPosts = Array.from({length:7}, (_,i) => ({
  actorId,
  title:`Lab完整笔记${i+1}`,
  text:`这是 Lab 真实酒馆链路生成的第 ${i+1} 条完整小红书测试动态。内容用于验证真实浏览器、SillyTavern 后端与黄米存档链路，不代表模型质量。`,
  mood:'测试',
}));
const partialOne = `{"posts":[${JSON.stringify({actorId,title:'截断前完整笔记',text:'这一篇必须完整保存，用来验证后续半篇不会污染已经闭合的帖子。',mood:'测试'})},{"actorId":"${actorId}","title":"半篇不能保存","text":"这里故意截断`;
const partialZero = `{"posts":[{"actorId":"${actorId}","title":"首篇就断","text":"这里故意在第一篇中间截断`;

function completion(content, finishReason='stop') {
  return JSON.stringify({
    id:`chatcmpl-yellowmi-${call}`, object:'chat.completion', created:Math.floor(Date.now()/1000), model:'yellowmi-local-qa',
    choices:[{index:0,message:{role:'assistant',content},finish_reason:finishReason}],
    usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},
  });
}

const server = http.createServer((req,res) => {
  if (req.method === 'GET' && req.url?.includes('/models')) {
    res.writeHead(200, {'content-type':'application/json'});
    res.end(JSON.stringify({object:'list',data:[{id:'yellowmi-local-qa',object:'model'}]}));
    return;
  }
  if (req.method !== 'POST' || !req.url?.includes('/chat/completions')) {
    res.writeHead(404, {'content-type':'application/json'}); res.end(JSON.stringify({error:'not found'})); return;
  }
  let raw='';
  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    call += 1;
    let body={}; try { body=JSON.parse(raw||'{}'); } catch { body={raw}; }
    fs.appendFileSync(logPath, JSON.stringify({call,url:req.url,max_tokens:body.max_tokens,model:body.model,messages:body.messages})+'\n');
    let content, finish='stop';
    if (call === 1) content = JSON.stringify({posts:fullPosts});
    else if (call === 2) { content = partialOne; finish='length'; }
    else { content = partialZero; finish='length'; }
    res.writeHead(200, {'content-type':'application/json'});
    res.end(completion(content, finish));
  });
});
server.listen(port, '127.0.0.1', () => console.log(`yellowmi local upstream listening on ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
