import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const htmlFile = path.join(out, 'settings.html');
const cssFile = path.join(out, 'styles.css');

let html = await fs.readFile(htmlFile, 'utf8');
const replacement = String.raw`
<section class="settings-jump" aria-label="设置页快速跳转">
  <span>我想改的是：</span>
  <a href="#common">外观 / 圆球</a>
  <a href="#injection">正文里出现太多或太少</a>
  <a href="#connection">接口 / 模型</a>
  <a href="#advanced">备份 / 排错 / 重置</a>
</section>

<section id="common" class="settings-chapter">
  <header class="settings-chapter-head"><span>01 · 常用</span><div><h2>只想让它看着顺手，就在这里改。</h2><p>这一栏基本都是“你怎么看世界背面”，不是“世界背面怎么记世界”。改错了也不至于把剧情弄坏。</p></div></header>
  <div class="setting-explain-grid">
    <article><small>界面明暗</small><h3>白天、夜间，还是跟着世界时间走</h3><p>喜欢固定亮色或暗色就直接选；想让界面跟世界里的昼夜变化，就保持自动。</p><b>影响：只改外观。</b></article>
    <article><small>界面字号</small><h3>看着挤，就把字放大</h3><p>紧凑适合信息多的桌面；标准适合大多数人；大字更适合手机和远一点的屏幕。</p><b>影响：只改阅读密度。</b></article>
    <article><small>显示悬浮球</small><h3>圆球不想一直趴在屏幕上，可以藏</h3><p>关掉悬浮球以后，世界背面不会因此停工。只是入口不再浮在聊天界面上。</p><b>影响：入口显示，不影响后台。</b></article>
    <article><small>悬浮球贴边收纳</small><h3>嫌它挡东西，就让它贴边露半个脑袋</h3><p>这是比彻底隐藏更省心的办法。需要时仍然可以直接点开。</p><b>推荐：觉得挡屏时先试这个。</b></article>
  </div>
  <div class="setting-bottomline"><span>🌸</span><p><b>第一次用：</b>这一栏最多调调主题、字号和圆球，其他先保持原样就够了。</p></div>
</section>

<section id="injection" class="settings-chapter is-dark">
  <header class="settings-chapter-head"><span>02 · 正文注入</span><div><h2>后台记住很多，不代表每轮都要告诉正文。</h2><p>这一栏控制的是“这一轮要把哪些后台信息递给模型看”，不是删除记忆，也不是关闭对应功能。</p></div></header>
  <div class="injection-flow" aria-label="正文注入工作方式">
    <div><small>后台继续保存</small><b>人物、暗流、记忆、舆情</b><p>这些内容照常存在。</p></div>
    <i>→</i>
    <div><small>正文注入决定</small><b>这轮拿哪些出来</b><p>不需要的先留在后台。</p></div>
    <i>→</i>
    <div><small>模型这一轮看到</small><b>恰好够用的信息</b><p>避免每次都背整本档案。</p></div>
  </div>
  <div class="setting-explain-grid two">
    <article><small>正文注入总开关</small><h3>想暂时让后台“只记不说”，关这里</h3><p>关掉以后，人物、事件、记忆仍然继续在背后生活，只是不主动叼到正文边上。</p><b>别误会：关它 ≠ 清空后台。</b></article>
    <article><small>各类内容的注入</small><h3>觉得哪类信息老抢戏，就少给一点</h3><p>例如剧情里总冒出太多后台人物，就优先检查人物相关注入；不是跑去人物页把人删掉。</p><b>原则：先少量调整，别一口气全关。</b></article>
  </div>
  <div class="setting-bottomline dark"><span>☾</span><p><b>什么时候才来这里？</b> 当你明确觉得“后台信息在正文里太多、太少，或者出现得不合时机”时。</p></div>
</section>

<section id="connection" class="settings-chapter">
  <header class="settings-chapter-head"><span>03 · 连接与模型</span><div><h2>能正常跑，就先别碰这里。</h2><p>这栏是给换接口、换模型，或者想让不同功能走不同模型的人准备的。普通使用完全可以一直保持默认。</p></div></header>
  <div class="connection-path">
    <article class="recommended"><span>最省心</span><h3>什么都不改</h3><p>让所有功能继续走世界背面的默认连接。能跑、速度正常、结果正常，就没有理由为了“优化”硬改。</p></article>
    <article><span>我有自己的接口</span><h3>先配一条独立连接</h3><p>把接口地址、Key 和模型填好，确认能用，再保存成常用方案。不要还没测通就同时改一堆地方。</p></article>
    <article><span>我想分模型</span><h3>最后才做模块分流</h3><p>例如世界推演走一个模型，人物观测走另一个。没指定的模块会继续跟随默认连接。</p></article>
  </div>
  <div class="setting-bottomline"><span>🧶</span><p><b>排错顺序：</b> 先确认默认连接能不能用，再检查独立接口，最后才看有没有某个模块被单独分到坏掉的连接上。</p></div>
</section>

<section id="advanced" class="settings-chapter advanced-guide">
  <header class="settings-chapter-head"><span>04 · 高级维护</span><div><h2>这里不是“更高级所以效果更好”，而是工具箱。</h2><p>大多数按钮平时都不需要碰。真正要动之前，先看它属于“备份”“修复”还是“清空”。</p></div></header>
  <div class="advanced-actions">
    <article><small>生成限制</small><h3>后台经常超时，才来看等待时间和长度</h3><p>正常情况下保持默认。只有任务频繁因为等待过久或输出长度失败时，才需要微调。</p><span class="risk safe">平时不用动</span></article>
    <article><small>数据备份</small><h3>大改之前，先给当前世界留一份保险</h3><p>可以导出当前世界，也可以把之前导出的世界状态重新导入。搬家、测试、大调整前尤其有用。</p><span class="risk good">建议先备份</span></article>
    <article><small>数据维护</small><h3>“清缓存”和“重置当前聊天”不是一回事</h3><p>清缓存更偏向修理临时状态；重置当前聊天数据是真的把这个聊天对应的后台世界倒空。</p><span class="risk danger">重置前必须想清楚</span></article>
    <article><small>正文过滤</small><h3>后台误把脚本、变量块当剧情时再来</h3><p>它的作用是尽量只让真正的叙事正文进入后台。正常聊天没出现误识别，就不用研究。</p><span class="risk safe">有问题再动</span></article>
    <article><small>安全恢复</small><h3>世界状态真的跑偏时，看看有没有最近保存</h3><p>这里更像后悔药入口。先确认恢复点是什么时候留下的，再决定要不要恢复。</p><span class="risk good">先看时间再恢复</span></article>
    <article><small>故障诊断</small><h3>要去社区求助，就从这里把诊断信息带上</h3><p>它会整理排错需要的信息，方便别人判断问题。比只发一句“坏了”好查得多。</p><span class="risk safe">求助时很好用</span></article>
  </div>
  <div class="danger-strip"><b>⚠ 真正危险的是“一键重置当前聊天数据”</b><p>如果当前世界还有价值，先导出备份。别把“重置”当刷新按钮按。</p></div>
</section>

<section class="settings-cheatsheet">
  <header><small>最后只记这个</small><h2>看到问题，按这个方向找就够了。</h2></header>
  <div><p><b>看着不舒服</b><span>→ 常用</span></p><p><b>正文信息太多 / 太少</b><span>→ 正文注入</span></p><p><b>接口或模型有问题</b><span>→ 连接与模型</span></p><p><b>备份、恢复、清理、诊断</b><span>→ 高级维护</span></p></div>
</section>`;

const range = /<section class="scenario-grid">[\s\S]*?<section class="knowledge-box">[\s\S]*?<\/section>/;
if (!range.test(html)) throw new Error('settings guide target block not found');
html = html.replace(range, replacement);
await fs.writeFile(htmlFile, html);

let css = await fs.readFile(cssFile, 'utf8');
css += String.raw`

/* ===== settings guide: user-first deep explanation ===== */
.settings-jump{position:sticky;top:72px;z-index:18;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:24px 0 30px;padding:12px 14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,250,252,.93);backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(61,43,72,.07)}
.settings-jump>span{font-size:11px;font-weight:900;color:#8b7182;margin-right:3px}.settings-jump a{padding:7px 10px;border-radius:999px;background:#fff;border:1px solid rgba(98,73,111,.11);font-size:11px;color:#6f6278}.settings-jump a:hover{transform:translateY(-1px);border-color:rgba(220,83,145,.25);color:#c65087}
.settings-chapter{scroll-margin-top:138px;margin:34px 0;padding:30px;border:1px solid var(--line);border-radius:30px;background:rgba(255,255,255,.82);box-shadow:0 18px 48px rgba(63,44,76,.055)}
.settings-chapter.is-dark{background:linear-gradient(145deg,#303055,#413b67);color:#dcd5e7;border-color:rgba(255,255,255,.08)}
.settings-chapter-head{display:grid;grid-template-columns:120px 1fr;gap:24px;align-items:start;margin-bottom:24px}.settings-chapter-head>span{display:inline-flex;width:max-content;padding:7px 10px;border-radius:999px;background:#f4eaf2;color:#ad5a87;font-size:10px;font-weight:900;letter-spacing:.08em}.is-dark .settings-chapter-head>span{background:rgba(255,255,255,.09);color:#ffd0e4}.settings-chapter-head h2{font:700 clamp(24px,3vw,34px)/1.28 var(--serif);margin:0 0 7px}.settings-chapter-head p{margin:0;color:#786d80;font-size:13px}.is-dark .settings-chapter-head p{color:#beb6cc}
.setting-explain-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.setting-explain-grid.two{grid-template-columns:1fr 1fr}.setting-explain-grid article{padding:20px;border-radius:20px;background:#fff;border:1px solid var(--line)}.is-dark .setting-explain-grid article{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.09)}.setting-explain-grid small,.advanced-actions small{color:#b15785;font-weight:900}.is-dark .setting-explain-grid small{color:#ffd0e4}.setting-explain-grid h3,.connection-path h3,.advanced-actions h3{font:700 19px/1.35 var(--serif);margin:5px 0 8px}.setting-explain-grid p,.connection-path p,.advanced-actions p{margin:0;color:#786d80;font-size:12px}.is-dark .setting-explain-grid p{color:#c1b9ce}.setting-explain-grid b{display:block;margin-top:13px;font-size:11px;color:#8c6680}.is-dark .setting-explain-grid b{color:#e8bfd2}
.setting-bottomline{display:flex;gap:12px;align-items:flex-start;margin-top:16px;padding:15px 17px;border-radius:17px;background:#faf3f7;border:1px solid rgba(210,99,151,.1)}.setting-bottomline>span{font-size:20px}.setting-bottomline p{margin:0;color:#716576;font-size:12px}.setting-bottomline.dark{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.08)}.setting-bottomline.dark p{color:#d2cadc}
.injection-flow{display:grid;grid-template-columns:1fr 36px 1fr 36px 1fr;align-items:stretch;gap:7px;margin:8px 0 16px}.injection-flow>div{padding:18px;border-radius:19px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.08)}.injection-flow small,.injection-flow b,.injection-flow p{display:block}.injection-flow small{color:#f3b9d1;font-weight:900}.injection-flow b{margin:3px 0;color:#fff;font-family:var(--serif)}.injection-flow p{margin:0;color:#c2b9ce;font-size:11px}.injection-flow i{align-self:center;text-align:center;font-style:normal;color:#d7abc3}
.connection-path{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.connection-path article{padding:20px;border-radius:20px;background:#fff;border:1px solid var(--line)}.connection-path article.recommended{background:linear-gradient(145deg,#fff7fb,#f2edfb);border-color:rgba(196,90,143,.16)}.connection-path span{display:inline-block;padding:4px 8px;border-radius:999px;background:#f4edf5;color:#a45c83;font-size:9px;font-weight:900}
.advanced-guide{background:linear-gradient(160deg,#fffafc,#f8f3f8)}.advanced-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.advanced-actions article{display:flex;flex-direction:column;padding:20px;border-radius:20px;background:#fff;border:1px solid var(--line)}.advanced-actions .risk{width:max-content;margin-top:auto;padding-top:14px;font-size:10px;font-weight:900}.risk.safe{color:#7d7186}.risk.good{color:#527e61}.risk.danger{color:#c64e55}.danger-strip{display:flex;gap:16px;align-items:center;margin-top:16px;padding:16px 18px;border-radius:18px;background:#fff1ef;border:1px solid rgba(194,76,76,.13)}.danger-strip b{white-space:nowrap;color:#aa464b}.danger-strip p{margin:0;color:#7e6064;font-size:12px}
.settings-cheatsheet{margin:36px 0 12px;padding:26px;border-radius:26px;background:#2f2f54;color:#dad3e5}.settings-cheatsheet header small{color:#f2bad3;font-weight:900}.settings-cheatsheet h2{font:700 25px var(--serif);color:#fff;margin:4px 0 16px}.settings-cheatsheet>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.settings-cheatsheet p{display:flex;justify-content:space-between;gap:12px;margin:0;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:12px}.settings-cheatsheet span{color:#f2bfd6}
@media(max-width:900px){.settings-jump{top:64px}.settings-chapter-head{grid-template-columns:1fr;gap:10px}.connection-path,.advanced-actions{grid-template-columns:1fr 1fr}.injection-flow{grid-template-columns:1fr}.injection-flow i{transform:rotate(90deg)}.danger-strip{align-items:flex-start;flex-direction:column;gap:4px}.danger-strip b{white-space:normal}}
@media(max-width:620px){.settings-jump{position:relative;top:auto}.settings-chapter{padding:21px 15px;border-radius:23px}.setting-explain-grid,.setting-explain-grid.two,.connection-path,.advanced-actions,.settings-cheatsheet>div{grid-template-columns:1fr}.settings-chapter-head h2{font-size:24px}.settings-jump a{font-size:10px}}
`;
await fs.writeFile(cssFile, css);
console.log('settings guide enriched');
