# 卡侧安装与复现

本交付不包含小手机 UI、入口、路由或补丁。仅依赖真实酒馆、酒馆助手和卡侧 MVU。

| 依赖 | 固定版本 |
| --- | --- |
| SillyTavern | 1.18.0 / 8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8 |
| 酒馆助手 JS-Slash-Runner | 4.11.2 / 519599bc68247d8e759cc844a983f8f5252941a8 |
| MagVarUpdate | 183d8ade3b9a3369e824a55cb13b4ddf91aada50 / artifact/bundle.js |
| 世界背面（可选） | 2.5.8 / f9babfa0ee0bd3003d3529fd171b83103cfee4c1 |
| 自动化浏览器 | Playwright 1.55.0 Chromium |
| 测试运行时 | Node 22（当前实机工作流） |

导入 Qidu-v0.4.41-terminal-v1.0.3.json，保留原 0.4.40 卡。导入并关联候选卡内世界书，启用酒馆助手角色脚本；不要同时运行旧卡的另一份 MVU 框架。

加载顺序：提供者 → 在 MVU 自己的脚本 iframe 内安装 mvu-commit-hook.js → 在同一个 iframe 动态 import 固定 MVU → 不可逆结算守卫。选项回填脚本保留候选卡原配置。候选卡已将钩子直接置于固定框架 import 前，不需要再添加单独窗口。独立 card-provider.js 使用 window.__f7dCardAssets 注入图片白名单；候选卡中该表达式已替换成原有十张图片，不需另下资源。

必须使用酒馆助手同源 iframe。提供者挂到 window.parent.f7dTacticalTerminal；同源父窗口扩展读取该属性，不能把 iframe 的 globalThis 当成父窗口。跨域直接拒绝。pagehide 和重复加载会卸载监听；钩子恢复原函数。

复现请使用专用酒馆副本和测试账户，脚本会导入测试卡、替换全局助手脚本、构造消息与临时元数据，并写账户收藏，不要在玩家正式存档运行。它不安装或依赖小手机。候选卡内容中的远端 import 在测试时换为同 SHA 的本地原始产物，未替换 MVU 实现。

1. 准备上述固定酒馆、助手。将固定 MVU 的 artifact/bundle.js 原样复制到酒馆 public/f7d-mvu.js。
2. 同装场景：将上述固定世界背面完整仓库安装为 public/scripts/extensions/third-party/world-backstage-test，保持完整 bootstrap，勿只安装 Phone Bridge 模块。
3. 启动专用酒馆。安装 Playwright 1.55.0 及其 Chromium。
4. 在含交付文件的目录运行（以绝对路径替换变量）：

```sh
F7D_FIXTURE_DIR=/absolute/path/to/delivery \
LAB_EVIDENCE_DIR=/absolute/path/to/output-with-wb \
LAB_ST_URL=http://127.0.0.1:8000 \
LAB_PLAYWRIGHT_CORE_ENTRY=/absolute/path/to/playwright/index.mjs \
node /absolute/path/to/delivery/card-only-smoke.mjs
```

无世界背面场景：专用酒馆副本不安装世界背面，增加 F7D_WITH_WB=0 并使用另一个证据目录。可用 LAB_CHROME 指定浏览器程序。

运行结果必须看退出码与结果文件；遇到断言失败会停止，不能拿已有旧报告冒充本轮通过。503设置保存是主动故障注入；其他HTTP异常均保留在本轮实机结果，不能拿历史归因冒充本轮已定位。当前行为为编辑立即清空，等待下一次有效 MVU 提交，不提供自动编辑重算。

交付修订1.0.3仅整合提供者尾部空白签名修正和第六天晨间守卫。守卫仅过滤模型实际提出的命令，不自动补演出旗标，不直接写变量；离场前置条件在过滤全部命令后检查。未知表达可能保守拒绝，文本规则不保证理解所有叙述。首轮模型中省略更新块仍不能结算，应保留失败报告。先通过候选实机验收再决定晋升；旧1.0.1交付保持原固定提交，不静默覆盖。

