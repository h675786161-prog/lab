import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const htmlFile = path.join(out, 'settings.html');
const cssFile = path.join(out, 'styles.css');
const appFile = path.join(out, 'app.js');

const esc = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const marker = (scope, item) => `
  <button class="setting-marker" type="button" style="--x:${item.x ?? 92};--y:${item.y}" data-settings-note="${scope}-${item.n}" data-settings-y="${item.y}" aria-label="查看 ${esc(item.title)} 的说明"><span>${item.n}</span></button>`;

const optionRows = rows => rows?.length ? `
  <div class="setting-option-rows">
    ${rows.map(row => `<div><b>${esc(row[0])}</b><span>${esc(row[1])}</span></div>`).join('')}
  </div>` : '';

const note = (scope, item) => `
  <article class="setting-note" id="setting-note-${scope}-${item.n}" data-settings-note="${scope}-${item.n}" data-settings-y="${item.y}" tabindex="0">
    <header><span>${item.n}</span><div><small>${esc(item.kicker || '这个设置')}</small><h3>${esc(item.title)}</h3></div>${item.badge ? `<em class="is-${esc(item.badgeTone || 'plain')}">${esc(item.badge)}</em>` : ''}</header>
    <p><b>它管什么：</b>${esc(item.what)}</p>
    ${optionRows(item.rows)}
    ${item.effect ? `<p><b>改了会怎样：</b>${esc(item.effect)}</p>` : ''}
    ${item.when ? `<p class="setting-when"><b>什么时候动：</b>${esc(item.when)}</p>` : ''}
  </article>`;

const atlas = (scope, image, imageAlt, items, intro) => `
  <div class="settings-atlas" data-settings-atlas="${scope}">
    <aside class="settings-atlas-visual">
      <div class="settings-atlas-toolbar"><b>完整真实界面</b><span>点右边说明，左图会带你跳到对应位置</span><a href="assets/${image}" target="_blank" rel="noreferrer">原尺寸 ↗</a></div>
      <div class="settings-atlas-scroll" data-settings-scroll>
        <div class="settings-atlas-stage">
          <img src="assets/${image}" alt="${esc(imageAlt)}" loading="lazy" decoding="async">
          ${items.map(item => marker(scope, item)).join('')}
        </div>
      </div>
    </aside>
    <div class="settings-atlas-notes">
      <div class="settings-atlas-intro"><span>怎么读这张图</span><p>${esc(intro)}</p></div>
      ${items.map(item => note(scope, item)).join('')}
    </div>
  </div>`;

const common = [
  { n:1, y:21.5, title:'界面明暗', kicker:'只改外观', what:'决定世界背面的界面用自动、日间还是夜间主题。', rows:[['自动','跟着世界时间判断昼夜。'],['日间','固定亮色界面。'],['夜间','固定暗色界面。']], effect:'只影响你看到的界面，不改变世界状态、模型或推演结果。', when:'单纯觉得亮或暗不舒服时改。' },
  { n:2, y:38, title:'界面字号', kicker:'只改阅读密度', what:'控制面板里文字和控件的阅读尺寸。', rows:[['紧凑','同屏信息更多。'],['标准','默认阅读密度。'],['大字','手机、小屏或远距离阅读更舒服。']], effect:'不会改变生成内容，只改变界面排版。', when:'字太挤、太小，或者你想一屏看更多内容时改。' },
  { n:3, y:51.5, title:'显示悬浮球', kicker:'入口显示', what:'控制聊天界面上那个打开世界背面的悬浮入口是否显示。', effect:'关掉以后插件照常运行，只是悬浮入口消失；之后仍可从 SillyTavern 的扩展设置重新打开。', when:'悬浮球挡住主题按钮或聊天内容时。' },
  { n:4, y:62, title:'悬浮球贴边收纳', kicker:'入口收纳', what:'让悬浮球自动吸到最近的屏幕边，只露出一部分。', effect:'入口仍然可以点击，不会关闭插件。', when:'觉得悬浮球碍眼，但又不想彻底隐藏时。' },
  { n:5, y:73.5, title:'启用世界引擎', kicker:'后台总开关', badge:'重要', badgeTone:'important', what:'决定镜头外的世界还要不要继续推演。', effect:'关掉以后不会继续产生新的后台发展，但已经发生、已经记录的世界状态不会被删除。', when:'你想临时冻结后台世界，或者正在排查推演问题时。' },
  { n:6, y:82.5, title:'自动运行', kicker:'自动推演', what:'决定世界背面是否按设定条件自动醒来进行推演。', effect:'关掉以后不是“世界引擎失效”，而是改成等你手动触发。', when:'你希望完全自己控制什么时候推演，或暂时减少自动请求时。' },
  { n:7, y:91.5, title:'通讯自主活动', kicker:'人物社交自动化', what:'控制人物是否会自己发消息、发好友申请、删好友或发朋友圈。', effect:'关闭后，已有通讯录和你主动进行的手动聊天仍然保留。', when:'你只想自己主动聊天，不希望 NPC 在通讯系统里自行活动时。' },
];

const injection = [
  { n:1, y:11.5, title:'正文注入总开关', kicker:'总闸门', badge:'不等于停机', badgeTone:'important', what:'决定后台信息是否递给当前正文模型参考。', effect:'关掉只会让后台“记着但先不说”，人物、暗流、记忆和舆情仍可继续运行。', when:'想临时测试“完全不带后台信息”的正文表现时。' },
  { n:2, y:23.5, title:'世界时间', kicker:'来自「此刻」', what:'决定要不要把当前世界时间递给正文，以及递到多精确。', rows:[['完整','日期、时段和具体时间都会给正文。'],['最小锚点','只提供维持时间连续性所需的信息。'],['关闭','正文不接收世界时间。']], effect:'只影响正文这一轮看到的时间信息，世界背面的时钟本身不会因此消失。', when:'模型总把时间写得太死，或反过来经常把昼夜、日期写乱时。' },
  { n:3, y:33.5, title:'世界背景', kicker:'来自「此刻」', what:'把世界长期成立的背景与地基信息递给正文。', effect:'关掉以后背景仍保存在后台，只是不主动进入正文上下文。', when:'背景信息太长、抢占上下文，或当前剧情暂时完全用不到时。' },
  { n:4, y:41, title:'当前状态', kicker:'来自「人物」', what:'把人物现在的位置、行动等当前状态递给正文。', effect:'关掉不会停止人物在后台生活，只是不把这些状态主动告诉正文。', when:'正文老被镜头外人物抢戏，或你想让某段剧情更局部时。' },
  { n:5, y:48, title:'进行中事件与世界环境', kicker:'来自「暗流」', what:'把仍在发展的事件、环境变化和镜头外进程递给正文。', effect:'暗流仍会继续发展，只是正文暂时看不到。', when:'世界变化出现得过于频繁，压住当前场景时。' },
  { n:6, y:55, title:'已结算后果', kicker:'来自「回声」', what:'把已经发生并结算完成的后果带给正文，用来防止结果被悄悄改写。', effect:'关闭注入不会删除这些后果。', when:'通常保持开启；只有你明确不想让正文携带这些结果时再关。' },
  { n:7, y:62, title:'世界事实', kicker:'来自「此刻」', what:'把已经成立的事实作为对账依据递给正文。', effect:'有助于避免“烧掉的信又出现”“已经停电却突然有电”一类事实冲突。', when:'一般不需要动；如果上下文特别拥挤再考虑暂时减少。' },
  { n:8, y:69, title:'长期记忆', kicker:'来自「记忆」', what:'把整理后的重要事实、关系、承诺与未收尾线索递给正文。', effect:'关闭后记忆系统仍可以继续整理，只是不把记忆主动塞进正文。', when:'长期记忆开始重复、抢戏，或你正在测试纯当前上下文时。' },
  { n:9, y:76, title:'新闻与论坛', kicker:'来自「舆情」', what:'把世界里的新闻、论坛和公共风声递给正文。', effect:'舆情本身仍可变化；这里只控制它离当前镜头有多近。', when:'公共信息太容易闯进私密场景时。' },
  { n:10, y:82.5, title:'最近聊天', kicker:'来自「通讯」', badge:'默认隔离', badgeTone:'safe', what:'把尚未结算的通讯记录作为正文参考。', effect:'即使开启，也只是告诉正文“谁说过什么”；聊天里的约定不会自动被当成已经发生的事实。', when:'你希望线下正文能接住之前的私聊内容时。' },
  { n:11, y:90, title:'正文显露度', kicker:'显露策略', what:'控制已经允许注入的信息出现得有多勤快。', rows:[['克制','少往镜头边递变化。'],['均衡','重要的递，不重要的先留后台。'],['活跃','更积极地让后台变化靠近正文。']], effect:'它改变“出现频率”，不是改变后台是否存在。', when:'觉得后台信息太安静或太抢戏时。' },
  { n:12, y:96, title:'显露时机', kicker:'显露策略', what:'控制后台变化适合在什么场景进入正文。', rows:[['严格','只在转场或空档显露。'],['智能','关键场景先延后，合适时再出现。'],['开放','允许更频繁的简短自然变化。']], effect:'越开放越容易在连续场景里看到世界变化。', when:'后台信息出现的位置不合时宜时，先调这个而不是删数据。' },
];

const connection = [
  { n:1, y:9, title:'当前连接状态', kicker:'先看，不用改', what:'这里告诉你世界推演现在实际走哪条连接、用什么模型、什么方式，以及当前是否正常。', rows:[['模型','当前实际使用的模型。'],['方式','例如独立上下文推演。'],['状态','等待正文、运行中或错误。']], effect:'这是状态牌，不是一个需要填写的设置。', when:'第一眼判断“到底有没有接上”时先看这里。' },
  { n:2, y:18.5, title:'世界推演连接', kicker:'选择走哪条路', what:'决定世界推演使用酒馆当前连接、酒馆已保存方案，还是世界背面的独立接口。', rows:[['跟随当前酒馆','主聊天换模型时，世界背面也跟着换。'],['酒馆已存方案','固定读取 SillyTavern 保存的连接方案，只记方案 ID，不复制 Key。'],['独立接口','世界背面自己使用单独的 URL、Key 和模型。']], effect:'只改变推演请求走哪条连接，不会改主聊天的模型。', when:'正常能用就保持当前方案；确实需要分开模型或接口时再改。' },
  { n:3, y:42, title:'独立接口配置', kicker:'URL / Key / 模型', badge:'有自己的接口才用', badgeTone:'plain', what:'给世界背面单独配置一条 OpenAI 兼容连接。', rows:[['接口地址','填到版本层，例如 https://example.com/v1；后面的 /chat/completions 由插件补。'],['API Key','保存在本机扩展设置，不写进导出的世界状态；已有 Key 时留空表示继续使用。'],['模型名称','可以手填，也可以先“拉取模型列表”再选择。'],['连接方式','经酒馆服务器转发是推荐方式；浏览器直连需要目标接口允许浏览器访问。'],['方案名称','可选。起名后方便保存成可复用方案。'],['保存默认独立接口并生效','把当前表单设为默认独立连接。'],['保存为方案 / 测试连接 / 拉取模型列表','分别用于复用、连通性检查和获取模型名。']], effect:'填写错误最常见的表现是测试失败或后台请求报错，不会直接改坏世界数据。', when:'你明确要让世界背面和主聊天分开走接口时。' },
  { n:4, y:69, title:'朋友圈生图接口', kicker:'可选能力', what:'给通讯里的朋友圈配图单独设置生图接口。', rows:[['允许朋友圈生成配图','开关关闭时不会自动请求图片。'],['生图 API 地址','使用 OpenAI 兼容的 /images/generations，地址填到 /v1；当前为浏览器直连，需要 CORS。'],['生图 API Key','只保存在本机扩展设置。'],['生图模型','例如 gpt-image-1 或你的接口支持的模型。'],['图片尺寸','选择接口支持的尺寸。'],['生成测试图（会计费）','真的会请求一次图片，用来验证接口。']], effect:'关闭开关不会删除已经生成过的朋友圈图片。', when:'只有你想让朋友圈自动配图时才需要配置。' },
  { n:5, y:87, title:'世界背面自存方案', kicker:'复用连接', what:'把常用独立接口保存成方案，之后不用重复填写 URL 和 Key。', rows:[['编辑','修改方案。'],['测试','验证方案是否可用。'],['模型','为方案拉取可用模型。'],['复制','复制一份方案再改。'],['删除','删除该保存方案。']], effect:'这里只管理世界背面自己保存的连接方案。', when:'你有两条以上常用接口，或者经常切模型时。' },
  { n:6, y:95, title:'模块 API 分流', kicker:'高级连接用法', what:'让不同后台任务分别走不同模型或连接。', rows:[['世界推演','镜头外世界发展。'],['人物即时观测','临时查看人物状态。'],['长期记忆 / 历史整理','记忆建档与整理。'],['世界舆情','新闻与论坛生成。']], effect:'没有单独指定的模块继续跟随世界背面默认连接。', when:'只有你已经确认默认连接稳定，并且确实想按任务拆模型时再用。' },
];

const advanced = [
  { n:1, y:13, title:'生成限制', kicker:'Token 与等待时间', what:'给后台请求设全局输出长度和最长等待时间，还可以按模块单独覆盖。', rows:[['全局 Token 上限','自动、4K、8K、12K 或自定义；0 表示让插件自动决定。'],['全局最长等待','自动、60s、120s、180s 或自定义；只计算模型真正生成的时间，不把排队、限流冷却算进去。'],['按模块单独设置','世界推演、人物观测、历史/记忆、舆情可以各自覆盖；填 0 就继承全局。'],['自动等待参考','世界推演 180s、人物观测 120s、历史/记忆 300s、舆情/闲逛 150s。']], effect:'设得太小容易截断或超时；设得很大也不会突破服务端自己的限制。', when:'频繁出现输出被截断或模型生成超时时再来调。' },
  { n:2, y:28, title:'数据备份', kicker:'搬家前先装箱', badge:'建议先备份', badgeTone:'safe', what:'导出当前世界状态，或把之前导出的世界状态重新导入。', rows:[['导出当前世界','保存当前聊天对应的后台世界。'],['导入世界状态','把备份状态恢复进来。']], effect:'适合迁移、测试和大调整前留保险。', when:'准备重置、导入、大改设置或做高风险测试之前。' },
  { n:3, y:36, title:'数据维护', kicker:'三个按钮完全不是一回事', badge:'重置有风险', badgeTone:'danger', what:'这里同时放了轻量清理、纠错和真正清空数据三个动作。', rows:[['清理当前聊天缓存','只扫临时缓存，不碰人物、记忆和世界状态。'],['让玲七检查世界状态','拿正文和明确事实重新对账；后台错了就修后台，不改已经发生的正文。'],['重置当前聊天数据','把当前聊天的后台世界清空，不碰正文和 API / 模型配置，而且不可撤回。']], effect:'前两个用于排错，第三个相当于给这个聊天的世界背面重新开档。', when:'“一键重置”前一定先导出备份；不要把它当刷新按钮。' },
  { n:4, y:61, title:'正文过滤', kicker:'只让叙事进入后台', what:'避免变量块、脚本块、状态栏等非叙事内容被当成剧情事实。', rows:[['启用标签过滤','控制成对标签过滤；HTML 注释即使关掉这个开关也会先被排除。'],['只读取某个正文标签','可选。有这个标签时只读标签内部；没有该标签的消息仍保留原文。'],['额外正则排除','一行一条，适合滤掉变量块或预设附加内容。'],['规则 1…N','手动填写开头标签和结尾标签；任一边可留空。'],['自动提取候选','可扫描最新正文或最近 5 条，只列出可疑标签，不会擅自添加。'],['添加选中候选 / 添加规则','确认后才真正加入过滤规则。']], effect:'规则写得过宽可能把真正剧情一起滤掉，所以这栏适合“有明确脏内容”再配置。', when:'后台开始把变量、脚本、状态栏当成故事内容时。' },
  { n:5, y:90, title:'安全恢复', kicker:'世界状态后悔药', what:'查看当前聊天最近的恢复点，手动保存新的恢复点，或恢复到最近保存。', rows:[['立即保存恢复点','给现在的后台状态留一份保险。'],['恢复最近保存','回到最近恢复点；恢复前还会先替当前状态再留一份保险。']], effect:'恢复点按聊天分别保存；升级旧数据、导入状态时也会自动留保险。', when:'后台状态明显跑偏、导入后不对，或做高风险操作之前。' },
  { n:6, y:96.5, title:'故障诊断', kicker:'求助时用', what:'整理版本、设备、接口模式和错误状态等排错信息。', rows:[['把诊断叼出来','复制可以直接发给维护者的诊断信息。'],['看看提示样式','预览插件提示长什么样。']], effect:'诊断不会把 API Key、接口地址、正文内容和角色私密设定一起复制出去。', when:'自己看不出问题，准备去社区求助时。' },
];

const section = ({ id, number, title, lead, image, items, intro, dark = false, footer }) => `
<section id="${id}" class="settings-chapter settings-chapter-annotated ${dark ? 'is-dark' : ''}">
  <header class="settings-chapter-head"><span>${number}</span><div><h2>${title}</h2><p>${lead}</p></div></header>
  ${atlas(id, image, `世界背面设置 · ${title}完整真实界面`, items, intro)}
  ${footer ? `<div class="setting-bottomline ${dark ? 'dark' : ''}"><span>${footer.icon}</span><p>${footer.text}</p></div>` : ''}
</section>`;

let html = await fs.readFile(htmlFile, 'utf8');
const replacements = {
  common: section({ id:'common', number:'01 · 常用', title:'这一页每个开关，到底动了什么？', lead:'常用页不只是外观。下面把你真实能点到的 7 个设置全部拆开。', image:'settings-common.png', items:common, intro:'先看编号，不用从头背。你想改哪个，就点右边那一项，左图会自动滚到对应位置。', footer:{icon:'🌸', text:'第一次用：主题、字号和悬浮球按喜好调；世界引擎、自动运行、通讯自主活动没有明确需求就先别动。'} }),
  injection: section({ id:'injection', number:'02 · 正文注入', title:'“后台有”与“正文看见”是两回事。', lead:'这一页的 12 个设置全部围绕一件事：后台已经知道的东西，这一轮要不要、什么时候、以多大频率递给正文。', image:'settings-injection.png', items:injection, intro:'最容易误会的是总开关。这里任何“关闭”都不等于删除对应后台数据。', dark:true, footer:{icon:'☾', text:'出现“后台抢戏”时先调显露度和显露时机；出现“模型老忘事实”时再检查对应注入项有没有被关。'} }),
  connection: section({ id:'connection', number:'03 · 连接与模型', title:'接口页不用怕，按“走哪条路”理解就行。', lead:'这页看着最技术，但真正需要理解的是 6 块。独立接口那块我把每个输入框和按钮都拆开写了。', image:'settings-connection.png', items:connection, intro:'能正常跑就先看第 1、2 项，别急着填 Key。只有你明确要分接口、分模型时，才往下面走。', footer:{icon:'🧶', text:'排错顺序：先看当前连接状态 → 再测试独立接口 → 最后检查模块分流。不要同时改三层，不然很难知道是哪一层断了。'} }),
  advanced: section({ id:'advanced', number:'04 · 高级维护', title:'这里不是“高级效果”，而是修理箱。', lead:'六个折叠组全部展开给你看。真正危险的操作我会明确标红，其他按钮分别说明会碰什么、不会碰什么。', image:'settings-advanced.png', items:advanced, intro:'高级维护最重要的不是“会不会用”，而是分清备份、清缓存、纠错、重置、恢复各自会动哪一层。', footer:{icon:'⚠️', text:'一键重置当前聊天数据不可撤回。当前世界还有价值时，先去“数据备份”导出，再碰它。'} }),
};

for (const [id, replacement] of Object.entries(replacements)) {
  const re = new RegExp(`<section id="${id}" class="settings-chapter[^>]*>[\\s\\S]*?<\\/section>(?=\\n\\n<section id=|\\n\\n<section class="settings-cheatsheet")`);
  if (!re.test(html)) throw new Error(`annotated settings target missing: ${id}`);
  html = html.replace(re, replacement);
}
await fs.writeFile(htmlFile, html);

let css = await fs.readFile(cssFile, 'utf8');
css += String.raw`

/* ===== settings atlas: full real UI on the left, every control explained on the right ===== */
.settings-chapter-annotated{padding:clamp(22px,3.2vw,38px)}
.settings-atlas{display:grid;grid-template-columns:minmax(330px,.88fr) minmax(390px,1.12fr);gap:clamp(22px,3vw,38px);align-items:start}
.settings-atlas-visual{position:sticky;top:142px;min-width:0}
.settings-atlas-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-bottom:9px;padding:10px 12px;border:1px solid rgba(101,77,115,.11);border-radius:15px;background:rgba(255,255,255,.86);font-size:10px;color:#817486}
.settings-atlas-toolbar b{font-size:11px;color:#4f4358}.settings-atlas-toolbar span{text-align:center}.settings-atlas-toolbar a{font-weight:900;color:#b24f82}
.is-dark .settings-atlas-toolbar{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.1);color:#c9c1d4}.is-dark .settings-atlas-toolbar b{color:#fff}.is-dark .settings-atlas-toolbar a{color:#ffd0e4}
.settings-atlas-scroll{max-height:calc(100vh - 190px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;border:1px solid rgba(91,70,106,.12);border-radius:24px;background:#f3f1f7;box-shadow:0 20px 55px rgba(53,39,67,.1)}
.settings-atlas-stage{position:relative;width:100%;line-height:0}.settings-atlas-stage img{display:block;width:100%;height:auto;filter:saturate(.98) contrast(1.01)}
.setting-marker{position:absolute;left:calc(var(--x)*1%);top:calc(var(--y)*1%);transform:translate(-50%,-50%);width:30px;height:30px;padding:0;border:3px solid rgba(255,255,255,.92);border-radius:999px;background:linear-gradient(135deg,#df5da3,#9c78e9);color:#fff;box-shadow:0 5px 20px rgba(173,66,136,.38);font:900 11px/1 system-ui;z-index:3;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
.setting-marker:hover,.setting-marker.is-active{transform:translate(-50%,-50%) scale(1.16);box-shadow:0 7px 26px rgba(173,66,136,.52)}
.setting-marker::after{content:"";position:absolute;inset:-8px;border:1px solid rgba(219,82,158,.2);border-radius:inherit;animation:settingPulse 2.2s ease-out infinite}
@keyframes settingPulse{0%{transform:scale(.7);opacity:.8}75%,100%{transform:scale(1.45);opacity:0}}
.settings-atlas-notes{display:grid;gap:11px;min-width:0}.settings-atlas-intro{padding:15px 17px;border-radius:18px;background:linear-gradient(135deg,#fbf0f6,#f2effc);border:1px solid rgba(211,91,150,.1)}.settings-atlas-intro span{display:block;margin-bottom:4px;color:#b14f82;font-size:10px;font-weight:900;letter-spacing:.08em}.settings-atlas-intro p{margin:0;color:#706477;font-size:12px;line-height:1.75}.is-dark .settings-atlas-intro{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.09)}.is-dark .settings-atlas-intro span{color:#ffd0e4}.is-dark .settings-atlas-intro p{color:#d3ccdc}
.setting-note{padding:16px 17px;border:1px solid rgba(99,75,112,.11);border-radius:19px;background:rgba(255,255,255,.9);box-shadow:0 9px 28px rgba(60,42,72,.035);outline:none;cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.setting-note:hover,.setting-note:focus-visible,.setting-note.is-active{transform:translateY(-1px);border-color:rgba(214,82,147,.34);box-shadow:0 14px 34px rgba(89,48,83,.09)}
.is-dark .setting-note{background:rgba(255,255,255,.075);border-color:rgba(255,255,255,.1);box-shadow:none}.is-dark .setting-note:hover,.is-dark .setting-note.is-active{border-color:rgba(255,208,228,.35)}
.setting-note header{display:flex;gap:10px;align-items:center;margin-bottom:10px}.setting-note header>span{display:grid;place-items:center;flex:0 0 27px;height:27px;border-radius:999px;background:#f0deea;color:#ad4f80;font-size:10px;font-weight:950}.is-dark .setting-note header>span{background:rgba(255,255,255,.12);color:#ffd0e4}.setting-note header div{min-width:0;flex:1}.setting-note header small{display:block;color:#a3899a;font-size:9px;font-weight:850;letter-spacing:.05em}.setting-note h3{margin:1px 0 0;font:700 18px/1.3 var(--serif);color:#44374d}.is-dark .setting-note h3{color:#fff}.setting-note header em{padding:4px 7px;border-radius:999px;font-size:9px;font-style:normal;font-weight:900;white-space:nowrap;background:#f2edf3;color:#806e84}.setting-note header em.is-important{background:#f9e5ef;color:#b14276}.setting-note header em.is-danger{background:#fff0f0;color:#b74747}.setting-note header em.is-safe{background:#eaf7f1;color:#3d7965}
.setting-note p{margin:7px 0 0;color:#746878;font-size:11px;line-height:1.75}.setting-note p b{color:#4e4056}.is-dark .setting-note p{color:#ccc4d5}.is-dark .setting-note p b{color:#fff}.setting-note .setting-when{margin-top:10px;padding-top:9px;border-top:1px dashed rgba(105,80,119,.13)}.is-dark .setting-note .setting-when{border-top-color:rgba(255,255,255,.12)}
.setting-option-rows{display:grid;gap:6px;margin:10px 0;padding:10px;border-radius:13px;background:#f8f5f8}.is-dark .setting-option-rows{background:rgba(0,0,0,.12)}.setting-option-rows div{display:grid;grid-template-columns:minmax(92px,.34fr) 1fr;gap:9px;align-items:start}.setting-option-rows b{font-size:10px;color:#9f4f79}.setting-option-rows span{font-size:10px;line-height:1.65;color:#756b79}.is-dark .setting-option-rows b{color:#ffc9e0}.is-dark .setting-option-rows span{color:#cbc4d2}
@media(max-width:980px){.settings-atlas{grid-template-columns:1fr}.settings-atlas-visual{position:relative;top:auto}.settings-atlas-scroll{max-height:68vh}.settings-atlas-toolbar{grid-template-columns:auto 1fr auto}}
@media(max-width:620px){.settings-chapter-annotated{padding:19px 13px}.settings-atlas-toolbar{grid-template-columns:1fr auto}.settings-atlas-toolbar span{grid-column:1/-1;grid-row:2;text-align:left}.settings-atlas-scroll{max-height:62vh;border-radius:18px}.setting-marker{width:27px;height:27px;border-width:2px}.setting-note{padding:14px 13px}.setting-option-rows div{grid-template-columns:1fr}.setting-option-rows b{margin-bottom:-3px}}
`;
await fs.writeFile(cssFile, css);

let app = await fs.readFile(appFile, 'utf8');
app += String.raw`

// Interactive settings atlas. Notes and numbered pins are two handles for the same place.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-settings-note]');
  if (!target) return;
  const atlas = target.closest('[data-settings-atlas]');
  if (!atlas) return;
  const key = target.dataset.settingsNote;
  const y = Number(target.dataset.settingsY || 0);
  atlas.querySelectorAll('[data-settings-note]').forEach(node => node.classList.toggle('is-active', node.dataset.settingsNote === key));
  const scroll = atlas.querySelector('[data-settings-scroll]');
  const stage = atlas.querySelector('.settings-atlas-stage');
  const noteNode = atlas.querySelector(`#setting-note-${CSS.escape(key)}`);
  if (scroll && stage && Number.isFinite(y)) {
    const wanted = stage.scrollHeight * (y / 100) - scroll.clientHeight * .44;
    scroll.scrollTo({ top: Math.max(0, wanted), behavior: 'smooth' });
  }
  if (target.classList.contains('setting-marker') && noteNode) noteNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList?.contains('setting-note')) {
    event.preventDefault();
    event.target.click();
  }
});
`;
await fs.writeFile(appFile, app);

console.log('interactive settings annotation atlas applied');
