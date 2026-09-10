import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const evidence = process.env.LAB_EVIDENCE_DIR;

const shots = [
  ['13a-设置-常用.png', 'settings-common.png'],
  ['13b-设置-正文注入.png', 'settings-injection.png'],
  ['13c-设置-连接与模型.png', 'settings-connection.png'],
  ['13d-设置-高级维护.png', 'settings-advanced.png'],
];
for (const [from, to] of shots) {
  await fs.copyFile(path.join(evidence, from), path.join(out, 'assets', to));
}

const file = path.join(out, 'settings.html');
let html = await fs.readFile(file, 'utf8');

// The old single giant screenshot made the page feel like a screenshot dump. Replace it with
// four smaller real-tab previews placed next to the explanation they belong to.
html = html.replace(/\n<section class="lesson simple">[\s\S]*?<\/section>\n\n<section class="settings-jump"/, '\n<section class="settings-jump"');

const visual = (src, label, note) => `\n  <figure class="settings-tab-visual">\n    <a href="assets/${src}" target="_blank" rel="noreferrer" aria-label="放大查看${label}真实界面">\n      <img src="assets/${src}" alt="世界背面设置 · ${label}真实界面" loading="lazy" decoding="async">\n      <span class="settings-zoom">点图放大 ↗</span>\n    </a>\n    <figcaption><b>真实界面 · ${label}</b><span>${note}</span></figcaption>\n  </figure>`;

html = html.replace(
  '</div></header>\n  <div class="setting-explain-grid">',
  `</div></header>${visual('settings-common.png','常用','先认位置，不需要把每个选项背下来。')}\n  <div class="setting-explain-grid">`
);
html = html.replace(
  '</div></header>\n  <div class="injection-flow"',
  `</div></header>${visual('settings-injection.png','正文注入','这栏只决定哪些后台信息递给这一轮正文。')}\n  <div class="injection-flow"`
);
html = html.replace(
  '</div></header>\n  <div class="connection-path">',
  `</div></header>${visual('settings-connection.png','连接与模型','能正常跑就不用改；要换接口时再照这里找。')}\n  <div class="connection-path">`
);
html = html.replace(
  '</div></header>\n  <div class="advanced-actions">',
  `</div></header>${visual('settings-advanced.png','高级维护','先分清备份、修复和清空，再决定要不要按。')}\n  <div class="advanced-actions">`
);
await fs.writeFile(file, html);

const cssFile = path.join(out, 'styles.css');
let css = await fs.readFile(cssFile, 'utf8');
css += String.raw`

/* Settings guide: real screenshots should support the explanation, not swallow the whole page. */
.settings-tab-visual{width:min(820px,100%);margin:26px auto 34px;padding:12px;border:1px solid rgba(93,70,108,.12);border-radius:27px;background:rgba(255,255,255,.82);box-shadow:0 18px 52px rgba(68,44,80,.08)}
.settings-tab-visual>a{position:relative;display:block;height:430px;overflow:hidden;border-radius:19px;background:linear-gradient(145deg,#f5f2f7,#eceaf1)}
.settings-tab-visual img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center;transition:transform .25s ease}
.settings-tab-visual>a:hover img{transform:scale(1.015)}
.settings-zoom{position:absolute;right:13px;bottom:13px;padding:8px 12px;border-radius:999px;background:rgba(43,42,77,.88);color:#fff;font-size:11px;font-weight:800;box-shadow:0 10px 28px rgba(31,28,54,.22)}
.settings-tab-visual figcaption{display:flex;justify-content:space-between;gap:18px;align-items:baseline;padding:12px 6px 2px;color:#786b7d;font-size:12px}
.settings-tab-visual figcaption b{color:#a84f7d;font-family:var(--serif);font-size:15px}
.settings-tab-visual figcaption span{text-align:right}
.settings-chapter.is-dark .settings-tab-visual{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);box-shadow:none}
.settings-chapter.is-dark .settings-tab-visual figcaption{color:#d2cce2}
.settings-chapter.is-dark .settings-tab-visual figcaption b{color:#ffd0e4}
@media(max-width:720px){.settings-tab-visual>a{height:340px}.settings-tab-visual figcaption{display:block}.settings-tab-visual figcaption span{display:block;margin-top:3px;text-align:left}}
@media(max-width:480px){.settings-tab-visual{padding:8px;border-radius:20px}.settings-tab-visual>a{height:300px;border-radius:15px}.settings-zoom{right:9px;bottom:9px}}
`;
await fs.writeFile(cssFile, css);
console.log('settings guide paired with four real tab screenshots');
