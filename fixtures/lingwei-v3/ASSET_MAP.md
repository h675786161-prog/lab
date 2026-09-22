# LingWei · Dream Dusk v3 素材映射

目标：SillyTavern 1.18.0 / commit `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`。

## 当前结构原则

这套素材直接服务真实 SillyTavern 组件，不做独立 demo，不把 PNG 当整页背景，也不通过漂浮贴图伪装结构。

- 大壳体、Drawer、顶栏、输入栏、消息纸张：优先用 `border-image` / 9-slice。
- 头像框：完整素材等比缩放，不拉伸。
- 原生按钮、输入框、Drawer、消息操作节点保持真实可点击。
- 顶部横条是**全局顶栏底座**，不属于任何单条消息。

| 素材 | 真实组件 | 接入方式 |
|---|---|---|
| `chat-shell-frame.png` | `#sheld` 中央聊天主壳 | `border-image` 九宫格 |
| `top-nav-base.png` | `#top-bar` | `border-image`，只让中段伸缩；原生 `#top-settings-holder` 功能按钮覆盖在其内容层 |
| `left-drawer-base.png` | `#right-nav-panel` 左侧角色 Drawer | `border-image` 九宫格 |
| `right-drawer-base.png` | `#left-nav-panel` 右侧设置 Drawer | `border-image` 九宫格 |
| `input-bar-base.png` | `#send_form` | `border-image`，中央输入区伸缩；左右功能节点保持原生 |
| `message-ai-paper.png` | AI `.mes_block` | `border-image` 九宫格 |
| `message-user-paper.png` | User `.mes_block` | `border-image` 九宫格 |
| `avatar-frame-bot.png` | AI `.mesAvatarWrapper::before` | 完整素材 `contain` 等比缩放，目标约 82×90，内部头像约 60×60 |
| `avatar-frame-user.png` | User `.mesAvatarWrapper::before` | 完整素材 `contain` 等比缩放；右侧排版需要时仅做镜像 |
| `date-divider.png` | `.lw-date-divider` | `border-image`，仅日期 / 分隔件使用 |

## QA

真实 SillyTavern `8172dcd0` + Chromium / Playwright。

必须覆盖：
- 桌面三栏 + 顶栏 + 中央聊天 + 输入栏；
- AI 单行短消息；
- User 3–5 行普通消息；
- AI 15–30 行长消息；
- User 超长连续文本；
- 左 / 右 Drawer；
- 顶栏确认在全局导航层，而不是消息 DOM；
- 输入栏真实 textarea 与左右原生功能区；
- 头像约 82×90、正文无横向溢出；
- 桌面与移动端截图。

加载顺序：
1. `theme.css`
2. `layout-guard.css`
3. `structure-pass.css`
