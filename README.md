# 玲七实验酒馆 · SillyTavern Lab

这是一个**公共、隔离、一次性的 SillyTavern 实机实验室**。

它不属于世界背面、小手机、酒馆诊所或任何单个插件；所有与 SillyTavern 有关的插件、脚本、主题和联调任务，都可以复用这里的真实 SillyTavern 运行环境。

## 当前固定基线

- SillyTavern: `1.18.0`
- Commit: `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`
- Runtime: GitHub Actions 临时 Ubuntu runner
- HTTP: `127.0.0.1:8000`
- Browser QA: runner Chrome + `playwright-core`
- 数据原则：临时目录、临时数据、运行结束销毁，不读取玲的日常酒馆数据

## 它负责什么

1. 拉取指定的真实 SillyTavern commit。
2. 安装依赖并启动真实 HTTP 服务。
3. 把当前被测仓库安装进隔离酒馆。
4. 用真实浏览器做基础 smoke。
5. 如果被测仓库提供 `.lab/runtime-smoke.mjs`，继续执行项目自己的深度实机验收。
6. 保存运行日志、截图和 JSON 报告为 GitHub Actions artifacts。
7. 无论成功失败都停止临时 runtime；runner 结束后整体销毁。

## 设计边界

- 实验酒馆是**基础设施**，不拥有任何插件的业务真相。
- 不把世界背面、小手机等业务逻辑写死进实验室核心。
- “目录存在”不等于“实机通过”；只有真实服务启动、HTTP 可访问、浏览器 smoke 完成后，才能声称对应证据等级已经达到。
- 不自动发布，不替业务仓库改 `main` / release。

## 新项目怎么接入

业务仓库只需要放一个很薄的 caller workflow，调用这里的 reusable workflow。示例见 `docs/CALLER_WORKFLOW.md`。

如果项目需要特殊安装方式，可在业务仓库提供：

- `.lab/install.sh`：自定义如何装进 `$ST_DIR`
- `.lab/runtime-smoke.mjs`：项目自己的真实浏览器验收

这样实验酒馆保持通用，插件自己负责自己的专项知识。

## 给新 ChatGPT 对话框的交接说明

见 `docs/NEW-CHAT-HANDOFF.md`。
