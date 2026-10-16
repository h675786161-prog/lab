# 玲七实验酒馆 LAB

LAB 不是业务项目，也不是模型评测中心。它只负责提供一套可重复、可恢复、可真实点击的 SillyTavern 实机环境，供其他项目临时接入测试。

## 当前基线

- 默认：SillyTavern 1.19.0
- 兼容对照：SillyTavern 1.18.0
- 版本与精确 commit 统一记录在 `config/sillytavern-baselines.json`

## LAB 负责什么

- 拉起干净的 SillyTavern 环境
- 提供真实 Chromium 浏览器测试
- 支持桌面 / 平板 / 手机视口
- 收集截图、页面错误与运行日志
- 为外部项目提供临时安装、点击、回归所需的酒馆底座
- 测试结束后保持环境可销毁、可恢复

## LAB 不负责什么

- 不长期承载 `world-backstage`、`phone`、黄米等项目的业务逻辑
- 不替项目保存其专属测试规则
- 不把模型 benchmark、站点巡检、学习网站等继续扩成 LAB 本体功能

这些测试可以继续保留作历史记录，但新的项目专属测试应优先放回各自仓库。LAB 只提供真实运行环境。

## 标准使用方式

1. 选择 SillyTavern 基线，默认 `stable`。
2. 拉起干净运行时。
3. 临时接入要测试的项目或分支。
4. 用真实浏览器执行桌面 / 平板 / 手机测试。
5. 保存 evidence。
6. 销毁或恢复环境。

`LAB SillyTavern Runtime Smoke` 是当前推荐的基础环境自检入口。

## 目录约定

- `config/`：LAB 自己的运行时配置
- `fixtures/`：用于实机测试的最小测试素材
- `lab-evidence/`：历史证据与测试输出
- `.lab/`：实验脚本与历史工具
- `.github/workflows/`：实机环境与历史实验 Actions

原则只有一个：**LAB 保持轻，项目自己背自己的测试逻辑。**
