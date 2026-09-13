import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PW_ENTRY);
const css=await fs.readFile('/tmp/lingwei-v23.css','utf8');
const evidence=process.env.EVIDENCE;
const pageErrors=[]; const consoleErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});

function textFor(i,user){
  if(i===4) return '这一条故意做成长文本压力测试。'.repeat(20)+' 继续保持段落可读，不让头像、装饰和正文互相抢位置。';
  if(i===8) return '代码块测试：<pre><code>function longSession(turn){\n  const readable = turn < 1000;\n  return readable ? "keep talking" : "still keep talking";\n}\nconsole.log(longSession('+i+'));</code></pre>后面的正文也必须正常回到阅读节奏。';
  if(i===12) return '<blockquote>引用块应该属于内容，而不是把整条消息撑成一座纪念碑。</blockquote>正文继续。';
  const base=user?'今天继续聊吧。真正长期使用时，我不想每一句都像开屏海报。':'这里是日常对话消息。装饰应该留在房间里，而不是随着聊天记录复制一百遍。';
  return base+(i%7===0?' 这一轮稍微长一点，用来观察换行、阅读宽度和滚动密度。'.repeat(4):'');
}
async function prepare(page){
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(2200); await page.addStyleTag({content:css}); await page.waitForTimeout(500);
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    const chat=document.querySelector('#chat'); if(!chat) return; chat.innerHTML='';
    const make=(i,user,text)=>{const row=document.createElement('div');row.className='mes last_mes';row.setAttribute('is_user',user?'true':'false');row.setAttribute('is_system','false');const avatar=user?'':(i===0?'<div class="lw-avatar-matte" aria-hidden="true"></div>':'');row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar">${avatar}</div></div><div class="mes_block"><div class="ch_name"><span class="name_text">${user?'你':'玲味'}</span><span class="timestamp">22:${String(i).padStart(2,'0')}</span></div>${i===0?'<div class="mes_reasoning_details"><div class="mes_reasoning_header">thought trace</div><div class="mes_reasoning">首屏保留一次完整主视觉，后续进入真正的聊天密度。</div></div>':''}<div class="mes_text">${text}</div><div class="mes_buttons"></div></div>`;return row};
    window.__lw_make=make;
  });
  const payload=[]; for(let i=0;i<100;i++) payload.push({i,user:i%2===1,text:textFor(i,i%2===1)});
  await page.evaluate(payload=>{const chat=document.querySelector('#chat');for(const m of payload)chat.appendChild(window.__lw_make(m.i,m.user,m.text));chat.scrollTop=0;},payload);
  await page.waitForTimeout(650);
  return {status:response?.status()??null,title:await page.title(),nodes:{chat:!!await page.$('#chat'),send:!!await page.$('#send_but'),stop:!!await page.$('#mes_stop'),cont:!!await page.$('#mes_continue')}};
}
async function metrics(page){return await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,messageCount:document.querySelectorAll('#chat .mes').length,chatScrollHeight:document.querySelector('#chat')?.scrollHeight||0,chatClientHeight:document.querySelector('#chat')?.clientHeight||0,lastMessageBottom:(()=>{const e=document.querySelector('#chat .mes:last-child');if(!e)return null;return e.getBoundingClientRect().bottom})()}));}

const d=await browser.newPage({viewport:{width:1480,height:1027}}); const dr=await prepare(d); const dm=await metrics(d); await d.screenshot({path:path.join(evidence,'lingwei-v23-desktop-top.png')}); await d.evaluate(()=>{const c=document.querySelector('#chat');c.scrollTop=c.scrollHeight}); await d.waitForTimeout(300); await d.screenshot({path:path.join(evidence,'lingwei-v23-desktop-bottom.png')});
const m=await browser.newPage({viewport:{width:430,height:844}}); const mr=await prepare(m); const mm=await metrics(m); await m.screenshot({path:path.join(evidence,'lingwei-v23-mobile-top.png')}); await m.evaluate(()=>{const c=document.querySelector('#chat');c.scrollTop=c.scrollHeight}); await m.waitForTimeout(300); await m.screenshot({path:path.join(evidence,'lingwei-v23-mobile-bottom.png')});
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop:dr,mobile:mr,desktopMetrics:dm,mobileMetrics:mm,pageErrors,consoleErrors},null,2)); await browser.close();
