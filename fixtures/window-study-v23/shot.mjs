import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PW_ENTRY);
const cssParts = [];
for (let i = 0; i <= 6; i++) cssParts.push(await fs.readFile(`fixtures/window-study-v23/part${String(i).padStart(2,'0')}.csspart`, 'utf8'));
const css = cssParts.join('');
const evidence = process.env.EVIDENCE;
const pageErrors = [];
const consoleErrors = [];
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_BIN, args:['--no-sandbox','--disable-dev-shm-usage']});

async function prepare(page) {
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const response = await page.goto('http://127.0.0.1:8000/', {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForTimeout(2400);
  await page.addStyleTag({content: css});
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) {
      if (el instanceof HTMLElement) el.style.setProperty('display','none','important');
    }
    const chat = document.querySelector('#chat');
    if (!chat) return;
    chat.innerHTML = '';
    const avatar = (c1,c2) => `<div class="avatar"><div style="width:100%;height:100%;background:linear-gradient(145deg,${c1},${c2});"></div></div>`;
    const make = ({user,name,time,id,timer,tokens,text}) => {
      const row = document.createElement('div');
      row.className = 'mes last_mes';
      row.setAttribute('is_user', user ? 'true' : 'false');
      row.setAttribute('is_system','false');
      row.innerHTML = `<div class="mesAvatarWrapper">${avatar(user?'#f2d8e5':'#dfd6ed',user?'#c79eb7':'#b4a9d3')}<span class="mesIDDisplay">#${id}</span><span class="mes_timer">${timer}</span><span class="tokenCounterDisplay">${tokens}</span></div><div class="mes_block"><div class="ch_name"><div class="flex-container"><span class="name_text">${name}</span><span class="timestamp">${time}</span></div></div><div class="mes_text">${text}</div></div>`;
      return row;
    };
    chat.appendChild(make({
      user:false,name:'七',time:'03:25',id:'18',timer:'2.4s',tokens:'420t',
      text:'<p>这段正文现在应该老老实实占满整块纸面，不再为了装饰图在左边空出一条莫名其妙的走廊。</p><p>花枝只挂在边框角上，和文字各干各的。长消息继续往下长，装饰不会跟着被拉成长条，也不会逼正文绕着它走。</p><p>再加一段长文字验证内容增长：窗边的纸页可以继续延伸，装饰仍停留在自己的对角位置，正文保持完整阅读宽度。</p>'
    }));
    chat.appendChild(make({
      user:true,name:'玲',time:'03:26',id:'19',timer:'1.1s',tokens:'88t',
      text:'<p>这样才像挂在聊天框上的装饰，不是正文突然学会了环绕排版。</p>'
    }));
    chat.scrollTop = 0;
  });
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => {
    const row = document.querySelector('#chat > .mes');
    const block = row?.querySelector('.mes_block');
    const text = row?.querySelector('.mes_text');
    const name = row?.querySelector('.name_text');
    const simple = (s) => s ? ({display:s.display,visibility:s.visibility,opacity:s.opacity,color:s.color,zIndex:s.zIndex,position:s.position,width:s.width,height:s.height,top:s.top,left:s.left,right:s.right,bottom:s.bottom,backgroundImage:s.backgroundImage,content:s.content}) : null;
    const rect = (el) => el ? ({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}) : null;
    return {
      row: rect(row), block: rect(block), text: rect(text), name: rect(name),
      textStyle: simple(text && getComputedStyle(text)),
      nameStyle: simple(name && getComputedStyle(name)),
      rowAfter: simple(row && getComputedStyle(row,'::after')),
      blockBefore: simple(block && getComputedStyle(block,'::before')),
      textContent: text?.textContent ?? null
    };
  });
  return {
    status: response?.status() ?? null,
    title: await page.title(),
    nodes: {
      chat: !!await page.$('#chat'),
      send: !!await page.$('#send_but'),
      stop: !!await page.$('#mes_stop'),
      cont: !!await page.$('#mes_continue')
    },
    probe
  };
}

const d = await browser.newPage({viewport:{width:1480,height:1027}});
const dr = await prepare(d);
await d.screenshot({path:path.join(evidence,'window-study-v23-desktop.png'),fullPage:false});
const m = await browser.newPage({viewport:{width:430,height:844}});
const mr = await prepare(m);
const metrics = await m.evaluate(() => ({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth}));
await m.screenshot({path:path.join(evidence,'window-study-v23-mobile.png'),fullPage:false});
await fs.writeFile(path.join(evidence,'report.json'), JSON.stringify({desktop:dr,mobile:mr,metrics,pageErrors,consoleErrors},null,2));
await browser.close();
