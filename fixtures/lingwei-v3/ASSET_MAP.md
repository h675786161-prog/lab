# LingWei · Dream Dusk v3 素材映射

目标：SillyTavern 1.18.0 / commit `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`。

## 结构原则

完整 PNG 不再作为 overlay、background 或装饰贴图覆盖原生 SillyTavern UI。接入分两类：

1. **九宫格结构素材**：由浏览器 `border-image` 直接拆成角件 / 边 / 中央填充，并作为真实组件壳体参与布局。
2. **非矩形或端件素材**：先从原始 PNG 生成结构片段，再把片段分别映射到真实组件的端件、状态层或头像框结构片。当前片段由 `build_parts.py` 在构建阶段从 10 张源 PNG 确定性切出，并复制到运行时 `parts/` 目录；浏览器只加载结构片，不加载完整顶栏 / 输入栏 / 头像框原图。

| 原始素材 | 真实组件 | 结构职责 / 接入方式 |
|---|---|---|
| `chat-shell-frame.png` | `#sheld` 中央聊天主壳 | `border-image` 九宫格：四角=角件，上下=横向边，左右=纵向边，中心=壳体填充 |
| `top-nav-base.png` | `#top-bar` + `#top-settings-holder` | 预拆为 **左端件 / 右端件**；中央伸缩壳体由 CSS 构造，真实 drawer toggles 构成导航内容层，完整原图不参与渲染 |
| `left-drawer-base.png` | `#right-nav-panel` 左侧角色 Drawer | `border-image` 九宫格，Drawer 内容保持真实可滚动层 |
| `right-drawer-base.png` | `#left-nav-panel` 右侧设置 Drawer | `border-image` 九宫格，控件与文字独立于边框层 |
| `input-bar-base.png` | `#send_form` | 预拆为 **左端件 / 右端件**；中央伸缩壳体由 CSS 构造，左工具 / textarea / 右工具是实际内容层，完整原图不参与渲染 |
| `message-ai-paper.png` | AI `.mes_block` | `border-image` 九宫格；中央内容层随正文增长，角件和边框不整体缩放 |
| `message-user-paper.png` | User `.mes_block` | `border-image` 九宫格；中央内容层随正文增长 |
| `avatar-frame-bot.png` | AI `.mesAvatarWrapper` | 预拆为 **上半框 / 下半框** 两个结构片，直接构造头像框；不再使用完整头像框 overlay |
| `avatar-frame-user.png` | User `.mesAvatarWrapper` | 同上，上下结构片构造用户头像框 |
| `date-divider.png` | `.lw-date-divider` | `border-image` 九宫格，仅作为日期分隔组件壳体 |

## 顶栏层级

- 壳体中央层：CSS 渐变与边框，负责伸缩和状态。
- 左右端件：`top-nav-base.png` 拆出的左右结构片。
- 内容层：原生 `#top-settings-holder > .drawer > .drawer-toggle`，保留原生点击与 Drawer 行为。
- 状态层：hover / focus 由 CSS 控制，不用 PNG 覆盖按钮。

## 输入栏层级

- 壳体中央层：CSS 背景与边框，负责伸缩。
- 左右端件：`input-bar-base.png` 拆出的左右结构片。
- 内容层：`#leftSendForm` / `#send_textarea` / `#rightSendForm`。
- 状态层：hover / focus / caret 由 CSS 控制。

## QA 覆盖

- 真实 SillyTavern `8172dcd0`。
- 真实 Chromium / Playwright。
- 单行 AI、4 行 User、16 行 AI、无空格超长连续文本。
- 九宫格素材 computed-style 挂载检查。
- 顶栏 / 输入栏 / AI 与 User 头像框必须命中结构片，并断言完整 `top-nav-base.png`、`input-bar-base.png`、`avatar-frame-bot.png`、`avatar-frame-user.png` 不出现在运行时 CSS 或 computed style。
- AI/User 头像尺寸检查。
- 左右 Drawer、中央聊天、输入栏与移动端几何检查。
- 完整桌面、长消息、移动端和局部截图。

## 加载顺序

1. `theme.css`
2. `layout-guard.css`
3. `structure-pass.css`（仅负责结构片映射与禁止完整 PNG 覆盖）

原始 10 张 PNG 继续作为唯一美术源文件保留在 `assets/`，便于追溯与后续重新切片。派生结构片不是新设计素材，不增加新的视觉元素，也不进入 `assets/` 作为额外美术源；它们由 `build_parts.py` 在构建时生成。
